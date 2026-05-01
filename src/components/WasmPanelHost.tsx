/**
 * `WasmPanelHost` mounts a compiler-aware Wasm runtime into a DOM root managed
 * by the React shell. Go/TinyGo and Rust `wasm-bindgen` share the same host
 * bridge, lifecycle, and storage/event wiring; compiler-specific bootstrapping
 * is isolated behind small adapter helpers below.
 */

import {
  convertFileSrc,
} from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
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
  callRuntimeAction,
  getRuntimePackage,
  prepareRuntimePackage,
  type DiscoveredRuntimePackage,
  type RuntimeCallTypedRequest,
  type RuntimePreparePackageResponse,
} from '../runtime/externalRuntimeBackend';
import { createExtensionHostClient } from '../runtime/extensionHostApi';

const HOST_BRIDGE_GLOBAL = '__greeblefsRuntimeHostBridge';

export interface WasmPanelHostContext {
  runtimeId: string;
  panelId: string | null;
  appearanceId: string | null;
  densityToken: string | null;
  cssVariables: Record<string, string>;
  assetUrls: Record<string, string>;
  size: { width: number; height: number };
  surfaceKind?: string | null;
  surfaceContext?: unknown;
}

export interface WasmPanelHostBridge {
  emitEvent: (event: WasmPanelHostEvent) => void;
  callRuntimeAction: <TResult = unknown, TPayload = unknown>(
    targetRuntimeId: string,
    actionId: string,
    payload?: TPayload,
  ) => Promise<TResult>;
  callHostMethod: <TPayload = unknown>(
    methodId: string,
    payload?: TPayload,
  ) => Promise<string>;
  subscribeHostEvents: (
    request: unknown,
    onEventJson: (eventJson: string) => void,
  ) => Promise<string>;
  unsubscribeHostEvents: (subscriptionId: string) => Promise<string>;
  readStorageBlob: () => string | null;
  writeStorageBlob: (next: string | null) => void;
}

export type WasmPanelHostEvent =
  | { kind: 'ready' }
  | { kind: 'error'; message: string }
  | { kind: 'request-resize'; width: number; height: number }
  | { kind: 'host-event'; name: string; payload?: unknown };

export interface WasmPanelHostHandle {
  reload: () => void;
  pushHostEvent: (name: string, payload?: unknown) => void;
}

export type WasmPanelBuildMode = 'release' | 'debug';
export type WasmPanelBuildTarget =
  | 'js-wasm'
  | 'tinygo-wasm'
  | 'wasm-bindgen-web'
  | (string & {});

export interface WasmPanelHostProps {
  runtimeId: string;
  context: WasmPanelHostContext;
  buildMode?: WasmPanelBuildMode;
  buildTarget?: WasmPanelBuildTarget;
  onEvent?: (event: WasmPanelHostEvent) => void;
  renderLoading?: () => React.ReactNode;
  renderError?: (error: string, retry: () => void) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hostElementRef?: React.RefObject<HTMLDivElement | null>;
}

interface RuntimeBootBridgeRegistry {
  [token: string]: {
    context: Record<string, unknown>;
    bridge: WasmPanelHostBridge;
  };
}

interface GoWasmInstance {
  run: (instance: WebAssembly.Instance) => Promise<void>;
  importObject: WebAssembly.Imports;
  exit?: (code: number) => void;
}

interface WasmBindgenPanelModule {
  default?: (() => Promise<unknown>) | ((input?: unknown) => Promise<unknown>);
  init?: (() => Promise<unknown>) | ((input?: unknown) => Promise<unknown>);
  mountPanel?: (bridgeToken: string) => unknown;
  mount_panel?: (bridgeToken: string) => unknown;
  unmountPanel?: (bridgeToken: string) => unknown;
  unmount_panel?: (bridgeToken: string) => unknown;
}

declare global {
  interface Window {
    [HOST_BRIDGE_GLOBAL]?: RuntimeBootBridgeRegistry;
    Go?: new () => GoWasmInstance;
  }
}

function resolveWasmExecSrc(): string {
  if (typeof document === 'undefined') {
    return 'runtime/wasm_exec.js';
  }
  return new URL('runtime/wasm_exec.js', document.baseURI).toString();
}

async function ensureGoWasmExecLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('WasmPanelHost can only run in a browser/webview environment');
  }
  if (window.Go) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const wasmExecSrc = resolveWasmExecSrc();
    script.src = wasmExecSrc;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${wasmExecSrc}`));
    document.head.appendChild(script);
  });
}

function ensureBridgeRegistry(): RuntimeBootBridgeRegistry {
  if (typeof window === 'undefined') {
    throw new Error('WasmPanelHost requires a window/global scope');
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

function synchronizeBridgeContext(
  target: Record<string, unknown>,
  nextContext: WasmPanelHostContext,
): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, nextContext);
}

function resolvePrimaryCompiler(
  runtimePackage: DiscoveredRuntimePackage | null,
): DiscoveredRuntimePackage['manifest']['compiler'] | null {
  return runtimePackage?.manifest.compiler ?? null;
}

async function bootGoPanelRuntime(args: {
  prepared: RuntimePreparePackageResponse;
  runtimeId: string;
  bridgeToken: string;
}): Promise<() => void> {
  const { prepared, runtimeId, bridgeToken } = args;
  await ensureGoWasmExecLoaded();
  if (!window.Go) {
    throw new Error('wasm_exec.js failed to expose `window.Go`');
  }

  const goInstance = new window.Go();
  (goInstance as unknown as { argv?: string[] }).argv = [
    'greeblefs-panel',
    `--bridge-token=${bridgeToken}`,
    `--runtime-id=${runtimeId}`,
  ];

  const wasmFileBytes = await readFile(prepared.artifactPath);
  const wasmBytes = wasmFileBytes.buffer.slice(
    wasmFileBytes.byteOffset,
    wasmFileBytes.byteOffset + wasmFileBytes.byteLength,
  );
  const wasmModule = await WebAssembly.instantiate(
    wasmBytes,
    goInstance.importObject,
  );
  void goInstance.run(wasmModule.instance);

  return () => {
    try {
      goInstance.exit?.(0);
    } catch {
      // Some Go runtimes do not surface exit hooks.
    }
  };
}

async function importRuntimeModule(modulePath: string): Promise<WasmBindgenPanelModule> {
  return import(/* @vite-ignore */ modulePath) as Promise<WasmBindgenPanelModule>;
}

async function bootRustWasmBindgenPanelRuntime(args: {
  prepared: RuntimePreparePackageResponse;
  bridgeToken: string;
}): Promise<() => Promise<void>> {
  const moduleUrl = `${convertFileSrc(args.prepared.artifactPath)}?cacheKey=${encodeURIComponent(args.prepared.cacheKey)}`;
  const runtimeModule = await importRuntimeModule(moduleUrl);
  const init =
    typeof runtimeModule.default === 'function'
      ? runtimeModule.default
      : typeof runtimeModule.init === 'function'
        ? runtimeModule.init
        : null;
  if (!init) {
    throw new Error(
      'cargo-wasm-bindgen panel runtimes must expose a default init() function.',
    );
  }
  await init();

  const mountPanel =
    typeof runtimeModule.mountPanel === 'function'
      ? runtimeModule.mountPanel
      : typeof runtimeModule.mount_panel === 'function'
        ? runtimeModule.mount_panel
        : null;
  if (!mountPanel) {
    throw new Error(
      'cargo-wasm-bindgen panel runtimes must export mountPanel(bridgeToken).',
    );
  }

  await Promise.resolve(mountPanel(args.bridgeToken));

  const unmountPanel =
    typeof runtimeModule.unmountPanel === 'function'
      ? runtimeModule.unmountPanel
      : typeof runtimeModule.unmount_panel === 'function'
        ? runtimeModule.unmount_panel
        : null;

  return async () => {
    if (unmountPanel) {
      await Promise.resolve(unmountPanel(args.bridgeToken));
    }
  };
}

export const WasmPanelHost = forwardRef<WasmPanelHostHandle, WasmPanelHostProps>(
  function WasmPanelHost(props, ref) {
    const {
      runtimeId,
      context,
      buildMode = 'release',
      buildTarget,
      onEvent,
      renderLoading,
      renderError,
      className,
      style,
      hostElementRef,
    } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const bridgeContextRef = useRef<Record<string, unknown> | null>(null);
    const runtimeCleanupRef = useRef<(() => void | Promise<void>) | null>(null);
    const hostEventUnsubscribersRef = useRef<
      Map<string, () => Promise<void> | void>
    >(new Map());
    const [reloadKey, setReloadKey] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [bridgeToken, setBridgeToken] = useState<string | null>(null);
    const bridgeTokenRef = useRef<string | null>(null);

    const reload = useCallback(() => {
      setError(null);
      setIsReady(false);
      setReloadKey((value) => value + 1);
    }, []);

    const pushHostEvent = useCallback(
      (name: string, payload?: unknown) => {
        bridgeTokenRef.current;
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

    const callPeerRuntimeAction = useMemo(
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
          const response = await callRuntimeAction<TResult, TPayload>({
            runtimeId: targetRuntimeId,
            actionId,
            payload,
          } satisfies RuntimeCallTypedRequest<TPayload>);
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
          const runtimePackage = await getRuntimePackage(runtimeId);
          if (cancelled) {
            return;
          }
          if (!runtimePackage) {
            throw new Error(`runtime package ${runtimeId} could not be resolved`);
          }
          const compiler = resolvePrimaryCompiler(runtimePackage);
          if (!compiler) {
            throw new Error(`runtime package ${runtimeId} has no compiler metadata`);
          }

          const prepared = await prepareRuntimePackage({
            runtimeId,
            mode: buildMode,
            target: buildTarget ?? null,
            forceRebuild: false,
          });
          if (cancelled) {
            return;
          }

          const registry = ensureBridgeRegistry();
          const token = makeBridgeToken(runtimeId);
          const mutableContext = { ...context } as Record<string, unknown>;
          bridgeContextRef.current = mutableContext;
          bridgeTokenRef.current = token;
          setBridgeToken(token);

          const storageKey = `greeblefs.runtime.${runtimeId}.storage`;
          const bridge: WasmPanelHostBridge = {
            emitEvent: (event) => onEvent?.(event),
            callRuntimeAction:
              callPeerRuntimeAction as WasmPanelHostBridge['callRuntimeAction'],
            callHostMethod:
              callHostMethod as WasmPanelHostBridge['callHostMethod'],
            subscribeHostEvents: async (request, onEventJson) => {
              const registration = await hostClient.events.subscribe(
                (request ?? {}) as Parameters<typeof hostClient.events.subscribe>[0],
                (event) => {
                  onEventJson(JSON.stringify(event));
                },
              );
              hostEventUnsubscribersRef.current.set(
                registration.subscription.subscriptionId,
                registration.unsubscribe,
              );
              return JSON.stringify(registration.subscription);
            },
            unsubscribeHostEvents: async (subscriptionId) => {
              const unsubscribe =
                hostEventUnsubscribersRef.current.get(subscriptionId) ?? null;
              hostEventUnsubscribersRef.current.delete(subscriptionId);
              if (unsubscribe) {
                await unsubscribe();
              } else {
                await hostClient.events.unsubscribe(subscriptionId).catch(() => null);
              }
              return 'null';
            },
            readStorageBlob: () => {
              try {
                return window.localStorage.getItem(storageKey);
              } catch {
                return null;
              }
            },
            writeStorageBlob: (next) => {
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
          registry[token] = {
            context: mutableContext,
            bridge,
          };

          if (compiler === 'go-js-wasm' || compiler === 'tinygo-wasm') {
            runtimeCleanupRef.current = await bootGoPanelRuntime({
              prepared,
              runtimeId,
              bridgeToken: token,
            });
          } else if (compiler === 'cargo-wasm-bindgen') {
            runtimeCleanupRef.current = await bootRustWasmBindgenPanelRuntime({
              prepared,
              bridgeToken: token,
            });
          } else {
            throw new Error(
              `WasmPanelHost does not support runtime compiler ${compiler}.`,
            );
          }

          if (cancelled) {
            return;
          }
          setIsReady(true);
          onEvent?.({ kind: 'ready' });
        } catch (err) {
          if (cancelled) {
            return;
          }
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[WasmPanelHost:${runtimeId}]`, message, err);
          setError(message);
          onEvent?.({ kind: 'error', message });
        }
      }

      void mount();

      return () => {
        cancelled = true;
        const pendingUnsubscribers = [...hostEventUnsubscribersRef.current.values()];
        hostEventUnsubscribersRef.current.clear();
        pendingUnsubscribers.forEach((unsubscribe) => {
          void Promise.resolve(unsubscribe()).catch(() => {});
        });
        const dispose = runtimeCleanupRef.current;
        runtimeCleanupRef.current = null;
        if (dispose) {
          void Promise.resolve(dispose()).catch(() => {});
        }
        const token = bridgeTokenRef.current;
        bridgeTokenRef.current = null;
        bridgeContextRef.current = null;
        setBridgeToken(null);
        if (token && typeof window !== 'undefined' && window[HOST_BRIDGE_GLOBAL]) {
          delete window[HOST_BRIDGE_GLOBAL]![token];
        }
      };
    }, [
      runtimeId,
      buildMode,
      buildTarget,
      reloadKey,
      callHostMethod,
      callPeerRuntimeAction,
      hostClient.events,
      onEvent,
      context,
    ]);

    useEffect(() => {
      if (!bridgeContextRef.current) {
        return;
      }
      synchronizeBridgeContext(bridgeContextRef.current, context);
    }, [context]);

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
              <div>Wasm runtime failed: {error}</div>
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
        ref={(element) => {
          containerRef.current = element;
          if (hostElementRef) {
            hostElementRef.current = element;
          }
        }}
        className={className}
        style={style}
        data-runtime-id={runtimeId}
        data-bridge-token={bridgeTokenAttr}
        data-wasm-panel-ready={isReady ? 'true' : 'false'}
      >
        {!isReady &&
          (renderLoading ? (
            renderLoading()
          ) : (
            <div style={{ padding: 12 }}>Loading {runtimeId}…</div>
          ))}
      </div>
    );
  },
);

export default WasmPanelHost;
