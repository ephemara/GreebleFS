// Reconstructed Tauron guest binding types: windowmgr.
export interface WindowMgrSurfaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface WindowMgrSessionLocator {
  hostWindowLabel: string;
  sessionId: string;
}
export interface WindowMgrBoundsUpdateRequest extends WindowMgrSessionLocator {
  bounds: WindowMgrSurfaceBounds;
}
export interface WindowMgrExecutableSpec {
  command: string;
  args?: string[];
  [key: string]: unknown;
}
export interface WindowMgrSessionInfo extends WindowMgrSessionLocator {
  backendKind?: string;
  [key: string]: unknown;
}
export interface WindowMgrError {
  kind: string;
  message: string;
  [key: string]: unknown;
}
export interface WindowMgrErrorPayload extends WindowMgrSessionLocator {
  error: WindowMgrError;
  [key: string]: unknown;
}
export interface WindowMgrInlineSessionRequest extends WindowMgrSessionLocator {
  executableSpec: WindowMgrExecutableSpec;
  [key: string]: unknown;
}
export declare function getCurrentWindowMgrHostLabel(): string;
export declare function startInlineWindowMgrSession(
  request: WindowMgrInlineSessionRequest,
): Promise<WindowMgrSessionInfo>;
export declare function showWindowMgrSession(
  request: WindowMgrBoundsUpdateRequest,
): Promise<WindowMgrSessionInfo>;
export declare function hideWindowMgrSession(
  locator: WindowMgrSessionLocator,
): Promise<WindowMgrSessionInfo>;
export declare function stopWindowMgrSession(
  locator: WindowMgrSessionLocator,
): Promise<WindowMgrSessionInfo>;
export declare function updateWindowMgrSessionBounds(
  request: WindowMgrBoundsUpdateRequest,
): Promise<WindowMgrSessionInfo>;
export declare function onWindowMgrSessionStarted(
  listener: (session: WindowMgrSessionInfo) => void,
): Promise<() => void>;
export declare function onWindowMgrSessionShown(
  listener: (session: WindowMgrSessionInfo) => void,
): Promise<() => void>;
export declare function onWindowMgrSessionHidden(
  listener: (session: WindowMgrSessionInfo) => void,
): Promise<() => void>;
export declare function onWindowMgrSessionBoundsUpdated(
  listener: (session: WindowMgrSessionInfo) => void,
): Promise<() => void>;
export declare function onWindowMgrSessionExited(
  listener: (session: WindowMgrSessionInfo) => void,
): Promise<() => void>;
export declare function onWindowMgrSessionError(
  listener: (payload: WindowMgrErrorPayload) => void,
): Promise<() => void>;
