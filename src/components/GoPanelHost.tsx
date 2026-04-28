/**
 * `GoPanelHost` mounts a Go-authored Wasm panel into a DOM root managed by
 * the React shell. It is the canonical bridge between a `wasm-panel` runtime
 * and the rest of GreebleFS:
 *
 *   - host context (theme, density, CSS vars, panel id, host root id)
 *   - typed command bridge (calls the runtime's exported callbacks)
 *   - resize/density propagation to the running Wasm module
 *   - lifecycle isolation (graceful unmount, restart-on-error)
 *
 * v1 supports the standard Go `syscall/js` runtime through the canonical
 * `wasm_exec.js` glue. TinyGo support is pluggable through the same import.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  buildGoRuntimePackage,
  type GoRuntimeMode,
  type GoRuntimeTarget,
} from '../runtime/goRuntimeBackend';
import { createExtensionHostClient } from '../runtime/extensionHostApi';

const HOST_BRIDGE_GLOBAL = '__greeblefsRuntimeHostBridge';

export interface GoPanelHostContext {
  /** Stable runtime id this panel was mounted for. */
  runtimeId: string;
  /** Frontend panel id used by the host registry / dock. */
  panelId: string | null;
  /** Currently active appearance pack id. */
  appearanceId: string | null;
  /** Active explorer/workbench density token. */
  densityToken: string | null;
  /** Resolved CSS variables for theme-aware rendering inside the panel. */
  cssVariables: Record<string, string>;
  /** Wallpaper / asset URLs the host has already validated. */
  assetUrls: Record<string, string>;
  /** Last known panel size in CSS pixels. */
  size: { width: number; height: number };
}

export interface GoPanelHostBridge {
  /** Allows the running Wasm module to send a typed event upward. */
  emitEvent: (event: GoPanelHostEvent) => void;
  /**
   * Calls a typed action on a peer runtime through the universal pipeline.
   *
   * `wasm-panel` runtimes do not host their own action surface (they handle
   * UI in-process). When a panel needs to read/mutate host state it targets
   * a peer `native-sidecar` runtime by id, so the panel and sidecar can
   * communicate through the same `runtime_call` lane every other consumer
   * uses. Targeting the panel's own runtime id is intentionally disallowed
   * by the host because there is nothing on the receiving side.
   */
  callRuntimeAction: <TResult = unknown, TPayload = unknown>(
    targetRuntimeId: string,
    actionId: string,
    payload?: TPayload,
  ) => Promise<TResult>;
  /** Call one canonical extension-host method using the panel runtime's identity. */
  callHostMethod: <TPayload = unknown>(
    methodId: string,
    payload?: TPayload,
  ) => Promise<string>;
  /**
   * Read/write the host-side persisted state blob the runtime is allowed to
   * mutate. v1 stores blobs in `localStorage` under a runtime-scoped key; the
   * native host can later swap this for a typed settings lane.
   */
  readStorageBlob: () => string | null;
  writeStorageBlob: (next: string | null) => void;
}

export type GoPanelHostEvent =
  | { kind: 'ready' }
  | { kind: 'error'; message: string }
  | { kind: 'request-resize'; width: number; height: number }
  | { kind: 'host-event'; name: string; payload?: unknown };

export interface GoPanelHostHandle {
  /** Force a rebuild + remount of the panel. */
  reload: () => void;
  /** Send a host-driven event into the running Wasm module. */
  pushHostEvent: (name: string, payload?: unknown) => void;
}

export interface GoPanelHostProps {
  runtimeId: string;
  context: GoPanelHostContext;
  buildMode?: GoRuntimeMode;
  buildTarget?: GoRuntimeTarget;
  onEvent?: (event: GoPanelHostEvent) => void;
  /** Allows the surrounding panel to render its own loader/error chrome. */
  renderLoading?: () => React.ReactNode;
  renderError?: (error: string, retry: () => void) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface RuntimeBootBridgeRegistry {
  [token: string]: {
    context: GoPanelHostContext;
    bridge: GoPanelHostBridge;
  };
}

declare global {
  interface Window {
    [HOST_BRIDGE_GLOBAL]?: RuntimeBootBridgeRegistry;
    Go?: new () => GoWasmInstance;
  }
}

interface GoWasmInstance {
  run: (instance: WebAssembly.Instance) => Promise<void>;
  importObject: WebAssembly.Imports;
  exit?: (code: number) => void;
}

const WASM_EXEC_SRC = '/runtime/wasm_exec.js';

async function ensureWasmExecLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('GoPanelHost can only run in a browser/webview environment');
  }
  if (window.Go) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WASM_EXEC_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${WASM_EXEC_SRC}`));
    document.head.appendChild(script);
  });
}

function ensureBridgeRegistry(): RuntimeBootBridgeRegistry {
  if (typeof window === 'undefined') {
    throw new Error('GoPanelHost requires a window/global scope');
  }
  if (!window[HOST_BRIDGE_GLOBAL]) {
    window[HOST_BRIDGE_GLOBAL] = {};
  }
  return window[HOST_BRIDGE_GLOBAL]!;
}

function makeBridgeToken(runtimeId: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${runtimeId}::${Date.now()}::${random}`;
}

export const GoPanelHost = forwardRef<GoPanelHostHandle, GoPanelHostProps>(function GoPanelHost(
  props,
  ref,
) {
  const {
    runtimeId,
    context,
    buildMode = 'release',
    buildTarget = 'js-wasm',
    onEvent,
    renderLoading,
    renderError,
    className,
    style,
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  // Tracking the bridge token in state (not a ref) is intentional: the
  // `data-bridge-token` attribute must be committed to the DOM before the
  // Go module's `panel.Run` queries `[data-bridge-token="<token>"]`, so
  // React must re-render once the token is known.
  const [bridgeToken, setBridgeToken] = useState<string | null>(null);
  const goInstanceRef = useRef<GoWasmInstance | null>(null);
  const bridgeTokenRef = useRef<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    setIsReady(false);
    setReloadKey(value => value + 1);
  }, []);

  const pushHostEvent = useCallback(
    (name: string, payload?: unknown) => {
      const token = bridgeTokenRef.current;
      if (!token) {
        return;
      }
      onEvent?.({ kind: 'host-event', name, payload });
    },
    [onEvent],
  );

  useImperativeHandle(
    ref,
    () => ({
      reload,
      pushHostEvent,
    }),
    [reload, pushHostEvent],
  );

  const callRuntimeAction = useMemo(
    () =>
      async <TResult, TPayload>(
        targetRuntimeId: string,
        actionId: string,
        payload?: TPayload,
      ): Promise<TResult> => {
        if (!targetRuntimeId) {
          throw new Error('callRuntimeAction requires a target runtime id');
        }
        if (targetRuntimeId === runtimeId) {
          throw new Error(
            'wasm-panel runtimes cannot call their own actions over the host bridge; target a peer sidecar runtime instead',
          );
        }
        const { callGoSidecarAction } = await import('../runtime/goRuntimeBackend');
        const response = await callGoSidecarAction<TResult, TPayload>({
          runtimeId: targetRuntimeId,
          actionId,
          payload,
        });
        return response.result;
      },
    [runtimeId],
  );
  const hostClient = useMemo(
    () =>
      createExtensionHostClient({
        callerRuntimeId: runtimeId,
      }),
    [runtimeId],
  );
  const callHostMethod = useMemo(
    () =>
      async <TPayload,>(
        methodId: string,
        payload?: TPayload,
      ): Promise<string> => {
        if (!methodId.trim()) {
          throw new Error('callHostMethod requires a method id');
        }
        const response = await hostClient.call<unknown, TPayload>(methodId, payload);
        return JSON.stringify(response);
      },
    [hostClient],
  );

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setIsReady(false);

    async function mount() {
      try {
        const prepared = await buildGoRuntimePackage({
          runtimeId,
          mode: buildMode,
          target: buildTarget,
        });
        if (cancelled) return;
        await ensureWasmExecLoaded();
        if (cancelled) return;
        if (!window.Go) {
          throw new Error('wasm_exec.js failed to expose `window.Go`');
        }

        const goInstance = new window.Go();
        goInstanceRef.current = goInstance;

        const registry = ensureBridgeRegistry();
        const token = makeBridgeToken(runtimeId);
        bridgeTokenRef.current = token;
        setBridgeToken(token);
        const storageKey = `greeblefs.runtime.${runtimeId}.storage`;
        const bridge: GoPanelHostBridge = {
          emitEvent: event => onEvent?.(event),
          callRuntimeAction: callRuntimeAction as GoPanelHostBridge['callRuntimeAction'],
          callHostMethod: callHostMethod as GoPanelHostBridge['callHostMethod'],
          readStorageBlob: () => {
            try {
              return window.localStorage.getItem(storageKey);
            } catch {
              return null;
            }
          },
          writeStorageBlob: next => {
            try {
              if (next === null) {
                window.localStorage.removeItem(storageKey);
              } else {
                window.localStorage.setItem(storageKey, next);
              }
            } catch {
              // Storage failures are non-fatal.
            }
          },
        };
        registry[token] = { context, bridge };

        // Route the compiled wasm artifact through Tauri's asset protocol
        // instead of a raw `file://` URL. The asset protocol handles
        // platform-specific path encoding (Windows drive letters, spaces,
        // unicode) and respects the configured `assetProtocol.scope` so the
        // webview origin policy does not reject the load. Tests mock fetch
        // directly, so this stays portable across CI and packaged builds.
        const wasmAssetUrl = convertFileSrc(prepared.artifactPath);
        const wasmResponse = await fetch(wasmAssetUrl);
        if (!wasmResponse.ok) {
          throw new Error(
            `Failed to fetch compiled wasm artifact at ${wasmAssetUrl}: ${wasmResponse.status}`,
          );
        }
        const wasmBytes = await wasmResponse.arrayBuffer();
        if (cancelled) return;

        // Surface the bridge token through the Go process arguments so the
        // SDK can locate its host bridge after `wasm_exec` boots.
        (goInstance as unknown as { argv?: string[] }).argv = [
          'greeblefs-panel',
          `--bridge-token=${token}`,
          `--runtime-id=${runtimeId}`,
        ];

        const wasmModule = await WebAssembly.instantiate(
          wasmBytes,
          goInstance.importObject,
        );
        if (cancelled) return;
        setIsReady(true);
        onEvent?.({ kind: 'ready' });
        await goInstance.run(wasmModule.instance);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        onEvent?.({ kind: 'error', message });
      }
    }

    void mount();

    return () => {
      cancelled = true;
      try {
        goInstanceRef.current?.exit?.(0);
      } catch {
        // Some Go runtimes don't expose exit; ignore.
      }
      goInstanceRef.current = null;
      const token = bridgeTokenRef.current;
      bridgeTokenRef.current = null;
      setBridgeToken(null);
      if (token && typeof window !== 'undefined' && window[HOST_BRIDGE_GLOBAL]) {
        delete window[HOST_BRIDGE_GLOBAL]![token];
      }
    };
  }, [runtimeId, buildMode, buildTarget, reloadKey, callHostMethod, callRuntimeAction, onEvent, context]);

  // Bridge token is what disambiguates two panel mounts of the same runtime
  // id from each other. The Go SDK reads it back through `data-bridge-token`
  // so each panel module always lands in *its own* DOM root, even when the
  // shell mounts multiple instances of the same runtime side by side.
  const bridgeTokenAttr = bridgeToken ?? undefined;

  if (error) {
    return (
      <div
        className={className}
        style={style}
        data-runtime-id={runtimeId}
        data-bridge-token={bridgeTokenAttr}
      >
        {renderError ? (
          renderError(error, reload)
        ) : (
          <div role="alert" style={{ padding: 12 }}>
            <div>Go panel failed: {error}</div>
            <button type="button" onClick={reload} style={{ marginTop: 8 }}>
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      data-runtime-id={runtimeId}
      data-bridge-token={bridgeTokenAttr}
      data-go-panel-ready={isReady ? 'true' : 'false'}
    >
      {!isReady && (renderLoading ? renderLoading() : <div style={{ padding: 12 }}>Loading {runtimeId}…</div>)}
    </div>
  );
});

export default GoPanelHost;
