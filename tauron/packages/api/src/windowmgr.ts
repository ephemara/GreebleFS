// Tauron guest API source stub: windowmgr (mirrors dist/windowmgr.js).
export interface WindowMgrSessionInfo {
  hostWindowLabel: string;
  sessionId: string;
  [key: string]: unknown;
}
export function getCurrentWindowMgrHostLabel(): string {
  return '';
}
export async function startInlineWindowMgrSession(request: unknown): Promise<WindowMgrSessionInfo> {
  void request;
  throw new Error('stub source only; see dist/windowmgr.js');
}
export type WindowMgrExecutableSpec = { command: string; [key: string]: unknown };
export type WindowMgrBoundsUpdateRequest = Record<string, unknown>;
export type WindowMgrError = { kind: string; message: string; [key: string]: unknown };
export type WindowMgrErrorPayload = Record<string, unknown>;
export type WindowMgrSessionLocator = { hostWindowLabel: string; sessionId: string };
export type WindowMgrSurfaceBounds = { x: number; y: number; width: number; height: number };
