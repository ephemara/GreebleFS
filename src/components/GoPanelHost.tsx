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
import {
  buildGoRuntimePackage,
  type GoRuntimeMode,
  type GoRuntimeTarget,
} from '../runtime/goRuntimeBackend';

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
   * Allows the Wasm module to call a typed runtime action through the
   * universal pipeline. The runtime id is fixed to the mounted package.
   */
  callRuntimeAction: <TResult = unknown, TPayload = unknown>(
    actionId: string,
    payload?: TPayload,
  ) => Promise<TResult>;
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
      async <TResult, TPayload>(actionId: string, payload?: TPayload): Promise<TResult> => {
        const { callGoSidecarAction } = await import('../runtime/goRuntimeBackend');
        const response = await callGoSidecarAction<TResult, TPayload>({
          runtimeId,
          actionId,
          payload,
        });
        return response.result;
      },
    [runtimeId],
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
        const storageKey = `greeblefs.runtime.${runtimeId}.storage`;
        const bridge: GoPanelHostBridge = {
          emitEvent: event => onEvent?.(event),
          callRuntimeAction: callRuntimeAction as GoPanelHostBridge['callRuntimeAction'],
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

        const wasmResponse = await fetch(`file://${prepared.artifactPath}`);
        if (!wasmResponse.ok) {
          throw new Error(`Failed to fetch compiled wasm artifact: ${wasmResponse.status}`);
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
      if (token && typeof window !== 'undefined' && window[HOST_BRIDGE_GLOBAL]) {
        delete window[HOST_BRIDGE_GLOBAL]![token];
      }
    };
  }, [runtimeId, buildMode, buildTarget, reloadKey, callRuntimeAction, onEvent, context]);

  if (error) {
    return (
      <div className={className} style={style} data-runtime-id={runtimeId}>
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
      data-go-panel-ready={isReady ? 'true' : 'false'}
    >
      {!isReady && (renderLoading ? renderLoading() : <div style={{ padding: 12 }}>Loading {runtimeId}…</div>)}
    </div>
  );
});

export default GoPanelHost;
