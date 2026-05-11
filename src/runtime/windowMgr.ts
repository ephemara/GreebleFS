import {
  getCurrentWindowMgrHostLabel,
  hideWindowMgrSession,
  onWindowMgrSessionBoundsUpdated,
  onWindowMgrSessionError,
  onWindowMgrSessionExited,
  onWindowMgrSessionHidden,
  onWindowMgrSessionShown,
  onWindowMgrSessionStarted,
  showWindowMgrSession,
  startInlineWindowMgrSession,
  stopWindowMgrSession,
  updateWindowMgrSessionBounds,
  type WindowMgrBoundsUpdateRequest,
  type WindowMgrError,
  type WindowMgrErrorPayload,
  type WindowMgrSessionInfo,
  type WindowMgrSessionLocator,
  type WindowMgrSurfaceBounds,
} from '@tauri-apps/api/windowmgr';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { WindowMgrProofDefinition } from '../config/windowMgrProofs';
import { bindDeferredUnlisten, type UnlistenCallback } from './deferredUnlisten';

export type {
  WindowMgrBoundsUpdateRequest,
  WindowMgrError,
  WindowMgrErrorPayload,
  WindowMgrSessionInfo,
  WindowMgrSessionLocator,
  WindowMgrSurfaceBounds,
};

export interface GreebleWindowMgrProofEventHandlers {
  onSession?: (session: WindowMgrSessionInfo) => void;
  onError?: (payload: WindowMgrErrorPayload) => void;
}

type WindowMgrBoundsCoordinateMode = 'desktop-physical' | 'host-local-physical';

export interface WindowMgrViewportMetrics {
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
}

export function getGreebleWindowMgrHostLabel(fallback = 'main'): string {
  try {
    const hostLabel = getCurrentWindowMgrHostLabel();
    return hostLabel.trim() ? hostLabel : fallback;
  } catch {
    return fallback;
  }
}

export function describeWindowMgrError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : null;
    const kind = typeof record.kind === 'string' ? record.kind : null;
    if (message && kind) {
      return `${kind}: ${message}`;
    }
    if (message) {
      return message;
    }
  }

  return String(error);
}

function roundedNonzero(value: number): number {
  return Math.max(1, Math.round(value));
}

function readCssViewportMetrics(): { width: number; height: number } {
  const documentElement = globalThis.document?.documentElement;
  return {
    width: Math.max(1, globalThis.window?.innerWidth ?? documentElement?.clientWidth ?? 1),
    height: Math.max(1, globalThis.window?.innerHeight ?? documentElement?.clientHeight ?? 1),
  };
}

function resolveWindowMgrBoundsCoordinateMode(
  session: WindowMgrSessionInfo | null | undefined,
): WindowMgrBoundsCoordinateMode {
  return session?.backendKind === 'directComposition'
    ? 'host-local-physical'
    : 'desktop-physical';
}

async function resolveWindowMgrViewportMetrics(
  coordinateMode: WindowMgrBoundsCoordinateMode,
): Promise<WindowMgrViewportMetrics> {
  try {
    const currentWindow = getCurrentWindow();
    const [innerPosition, innerSize] = await Promise.all([
      currentWindow.innerPosition(),
      currentWindow.innerSize(),
    ]);
    const viewport = readCssViewportMetrics();

    return {
      originX: coordinateMode === 'desktop-physical' ? innerPosition.x : 0,
      originY: coordinateMode === 'desktop-physical' ? innerPosition.y : 0,
      scaleX: Math.max(0.0001, innerSize.width / viewport.width),
      scaleY: Math.max(0.0001, innerSize.height / viewport.height),
    };
  } catch {
    return {
      originX: 0,
      originY: 0,
      scaleX: 1,
      scaleY: 1,
    };
  }
}

export function nativeWindowMgrBoundsFromDomRect(
  rect: DOMRectReadOnly,
  metrics: WindowMgrViewportMetrics,
): WindowMgrSurfaceBounds {
  return {
    x: Math.round(metrics.originX + rect.x * metrics.scaleX),
    y: Math.round(metrics.originY + rect.y * metrics.scaleY),
    width: roundedNonzero(rect.width * metrics.scaleX),
    height: roundedNonzero(rect.height * metrics.scaleY),
  };
}

export async function boundsFromWindowMgrElement(
  element: HTMLElement,
  session?: WindowMgrSessionInfo | null,
): Promise<WindowMgrSurfaceBounds> {
  const metrics = await resolveWindowMgrViewportMetrics(
    resolveWindowMgrBoundsCoordinateMode(session),
  );
  return nativeWindowMgrBoundsFromDomRect(element.getBoundingClientRect(), metrics);
}

export function buildGreebleWindowMgrLocator(
  proofDefinition: WindowMgrProofDefinition,
  hostWindowLabel = getGreebleWindowMgrHostLabel(),
): WindowMgrSessionLocator {
  return {
    hostWindowLabel,
    sessionId: proofDefinition.sessionId,
  };
}

export async function buildGreebleWindowMgrBoundsRequest(
  proofDefinition: WindowMgrProofDefinition,
  element: HTMLElement,
  hostWindowLabel = getGreebleWindowMgrHostLabel(),
  session?: WindowMgrSessionInfo | null,
): Promise<WindowMgrBoundsUpdateRequest> {
  return {
    ...buildGreebleWindowMgrLocator(proofDefinition, hostWindowLabel),
    bounds: await boundsFromWindowMgrElement(element, session),
  };
}

export async function startGreebleWindowMgrProofSession(
  proofDefinition: WindowMgrProofDefinition,
  hostWindowLabel = getGreebleWindowMgrHostLabel(),
): Promise<WindowMgrSessionInfo> {
  return startInlineWindowMgrSession({
    hostWindowLabel,
    sessionId: proofDefinition.sessionId,
    executableSpec: proofDefinition.executable,
  });
}

export async function showGreebleWindowMgrProofSessionAtElement(
  proofDefinition: WindowMgrProofDefinition,
  element: HTMLElement,
  hostWindowLabel = getGreebleWindowMgrHostLabel(),
  session?: WindowMgrSessionInfo | null,
): Promise<WindowMgrSessionInfo> {
  return showWindowMgrSession(await buildGreebleWindowMgrBoundsRequest(
    proofDefinition,
    element,
    hostWindowLabel,
    session,
  ));
}

export async function updateGreebleWindowMgrProofSessionBounds(
  proofDefinition: WindowMgrProofDefinition,
  element: HTMLElement,
  hostWindowLabel = getGreebleWindowMgrHostLabel(),
  session?: WindowMgrSessionInfo | null,
): Promise<WindowMgrSessionInfo> {
  return updateWindowMgrSessionBounds(await buildGreebleWindowMgrBoundsRequest(
    proofDefinition,
    element,
    hostWindowLabel,
    session,
  ));
}

export async function hideGreebleWindowMgrProofSession(
  proofDefinition: WindowMgrProofDefinition,
  hostWindowLabel = getGreebleWindowMgrHostLabel(),
): Promise<WindowMgrSessionInfo> {
  return hideWindowMgrSession(buildGreebleWindowMgrLocator(proofDefinition, hostWindowLabel));
}

export async function stopGreebleWindowMgrProofSession(
  proofDefinition: WindowMgrProofDefinition,
  hostWindowLabel = getGreebleWindowMgrHostLabel(),
): Promise<WindowMgrSessionInfo> {
  return stopWindowMgrSession(buildGreebleWindowMgrLocator(proofDefinition, hostWindowLabel));
}

export function observeGreebleWindowMgrProofBounds(
  element: HTMLElement,
  onBoundsChanged: (bounds: WindowMgrSurfaceBounds) => void,
  getSession?: () => WindowMgrSessionInfo | null,
): UnlistenCallback {
  let disposed = false;
  let revision = 0;

  const emitBounds = () => {
    const emitRevision = ++revision;
    void boundsFromWindowMgrElement(element, getSession?.() ?? null).then(bounds => {
      if (!disposed && emitRevision === revision) {
        onBoundsChanged(bounds);
      }
    });
  };

  emitBounds();

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(emitBounds)
    : null;
  resizeObserver?.observe(element);
  window.addEventListener('resize', emitBounds);

  const currentWindow = getCurrentWindow();
  const movedCleanup = bindDeferredUnlisten(currentWindow.onMoved(emitBounds));
  const resizedCleanup = bindDeferredUnlisten(currentWindow.onResized(emitBounds));

  return () => {
    disposed = true;
    resizeObserver?.disconnect();
    window.removeEventListener('resize', emitBounds);
    movedCleanup();
    resizedCleanup();
  };
}

export function bindGreebleWindowMgrProofEvents(
  proofDefinition: WindowMgrProofDefinition,
  hostWindowLabel: string,
  handlers: GreebleWindowMgrProofEventHandlers,
): UnlistenCallback {
  const matchesProofSession = (session: WindowMgrSessionInfo): boolean =>
    session.hostWindowLabel === hostWindowLabel
    && session.sessionId === proofDefinition.sessionId;
  const cleanups = [
    bindDeferredUnlisten(onWindowMgrSessionStarted(session => {
      if (matchesProofSession(session)) {
        handlers.onSession?.(session);
      }
    })),
    bindDeferredUnlisten(onWindowMgrSessionShown(session => {
      if (matchesProofSession(session)) {
        handlers.onSession?.(session);
      }
    })),
    bindDeferredUnlisten(onWindowMgrSessionHidden(session => {
      if (matchesProofSession(session)) {
        handlers.onSession?.(session);
      }
    })),
    bindDeferredUnlisten(onWindowMgrSessionBoundsUpdated(session => {
      if (matchesProofSession(session)) {
        handlers.onSession?.(session);
      }
    })),
    bindDeferredUnlisten(onWindowMgrSessionExited(session => {
      if (matchesProofSession(session)) {
        handlers.onSession?.(session);
      }
    })),
    bindDeferredUnlisten(onWindowMgrSessionError(payload => {
      if (
        payload.hostWindowLabel === hostWindowLabel
        && payload.sessionId === proofDefinition.sessionId
      ) {
        handlers.onError?.(payload);
      }
    })),
  ];

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
