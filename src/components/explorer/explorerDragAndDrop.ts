import type { RuntimePlatform } from "../../config/platform";

export type ExplorerDragIntent = "internal" | "native-out";

export const EXPLORER_DROP_TARGET_ATTRIBUTE = "data-overlay-drop-target-path";
export const EXPLORER_DROP_SCOPE_ATTRIBUTE =
  "data-overlay-explorer-drop-scope-id";
export const EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE =
  "data-overlay-explorer-drop-root-path";

export type ExplorerDropPointerLike = {
  x: number;
  y: number;
  toLogical?: (scaleFactor: number) => { x: number; y: number };
};

export type ExplorerResolvedDropHit = {
  scopeId: string;
  targetKind: "directory" | "viewport";
  targetPath: string;
  scopeElement: HTMLElement;
  targetElement: HTMLElement | null;
  point: {
    x: number;
    y: number;
  };
};

export type ExplorerSharedDragSession = {
  paths: string[];
  intent: ExplorerDragIntent;
  sourceScopeId: string | null;
  startedAt: number;
  expiresAt: number | null;
};

const EXPLORER_SHARED_DRAG_SESSION_LINGER_MS = 1500;

let explorerSharedDragSession: ExplorerSharedDragSession | null = null;
let explorerSharedDragSessionExpiryTimer: ReturnType<typeof setTimeout> | null =
  null;

function clearExplorerSharedDragSessionExpiryTimer(): void {
  if (explorerSharedDragSessionExpiryTimer !== null) {
    clearTimeout(explorerSharedDragSessionExpiryTimer);
    explorerSharedDragSessionExpiryTimer = null;
  }
}

function scheduleExplorerSharedDragSessionExpiry(durationMs: number): void {
  clearExplorerSharedDragSessionExpiryTimer();
  explorerSharedDragSessionExpiryTimer = setTimeout(() => {
    explorerSharedDragSession = null;
    explorerSharedDragSessionExpiryTimer = null;
  }, durationMs);
}

function isPointWithinElementRect(
  element: HTMLElement,
  point: { x: number; y: number },
): boolean {
  const rect = element.getBoundingClientRect();
  const hasUsableRect =
    rect.width > 0 ||
    rect.height > 0 ||
    rect.left !== 0 ||
    rect.top !== 0 ||
    rect.right !== 0 ||
    rect.bottom !== 0;
  if (!hasUsableRect) {
    return true;
  }
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function normalizeExplorerDropPoint(
  pointer: ExplorerDropPointerLike,
  scaleFactor: number,
): { x: number; y: number } {
  const safeScaleFactor =
    Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  if (typeof pointer.toLogical === "function") {
    return pointer.toLogical(safeScaleFactor);
  }
  return {
    x: pointer.x / safeScaleFactor,
    y: pointer.y / safeScaleFactor,
  };
}

export function resolveExplorerDropHitFromPoint(
  pointer: ExplorerDropPointerLike,
  scaleFactor = 1,
): ExplorerResolvedDropHit | null {
  if (
    typeof document === "undefined" ||
    typeof document.elementFromPoint !== "function"
  ) {
    return null;
  }

  const point = normalizeExplorerDropPoint(pointer, scaleFactor);
  const elementAtPointer = document.elementFromPoint(point.x, point.y);
  if (!(elementAtPointer instanceof Element)) {
    return null;
  }

  const scopeElement = elementAtPointer.closest<HTMLElement>(
    `[${EXPLORER_DROP_SCOPE_ATTRIBUTE}]`,
  );
  if (!scopeElement || !isPointWithinElementRect(scopeElement, point)) {
    return null;
  }

  const scopeId = scopeElement.getAttribute(EXPLORER_DROP_SCOPE_ATTRIBUTE);
  if (!scopeId) {
    return null;
  }

  const targetElement = elementAtPointer.closest<HTMLElement>(
    `[${EXPLORER_DROP_TARGET_ATTRIBUTE}]`,
  );
  if (
    targetElement &&
    targetElement !== scopeElement &&
    scopeElement.contains(targetElement) &&
    isPointWithinElementRect(targetElement, point)
  ) {
    const targetPath = targetElement.getAttribute(
      EXPLORER_DROP_TARGET_ATTRIBUTE,
    );
    if (targetPath) {
      return {
        scopeId,
        targetKind: "directory",
        targetPath,
        scopeElement,
        targetElement,
        point,
      };
    }
  }

  const rootPath = scopeElement.getAttribute(
    EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE,
  );
  if (!rootPath) {
    return null;
  }

  return {
    scopeId,
    targetKind: "viewport",
    targetPath: rootPath,
    scopeElement,
    targetElement: null,
    point,
  };
}

export function startExplorerSharedDragSession(args: {
  paths: readonly string[];
  intent: ExplorerDragIntent;
  sourceScopeId: string | null;
}): void {
  clearExplorerSharedDragSessionExpiryTimer();
  explorerSharedDragSession = {
    paths: [...args.paths],
    intent: args.intent,
    sourceScopeId: args.sourceScopeId,
    startedAt: Date.now(),
    expiresAt: null,
  };
}

export function settleExplorerSharedDragSessionAfterDragEnd(
  intent: ExplorerDragIntent,
  lingerMs = EXPLORER_SHARED_DRAG_SESSION_LINGER_MS,
): void {
  if (!explorerSharedDragSession) {
    return;
  }

  if (intent !== "native-out") {
    clearExplorerSharedDragSession();
    return;
  }

  const durationMs =
    Number.isFinite(lingerMs) && lingerMs > 0
      ? Math.floor(lingerMs)
      : EXPLORER_SHARED_DRAG_SESSION_LINGER_MS;
  explorerSharedDragSession = {
    ...explorerSharedDragSession,
    expiresAt: Date.now() + durationMs,
  };
  scheduleExplorerSharedDragSessionExpiry(durationMs);
}

export function clearExplorerSharedDragSession(): void {
  clearExplorerSharedDragSessionExpiryTimer();
  explorerSharedDragSession = null;
}

export function getExplorerSharedDragSession():
  | ExplorerSharedDragSession
  | null {
  if (
    explorerSharedDragSession &&
    explorerSharedDragSession.expiresAt !== null &&
    explorerSharedDragSession.expiresAt <= Date.now()
  ) {
    clearExplorerSharedDragSession();
    return null;
  }

  return explorerSharedDragSession
    ? {
        ...explorerSharedDragSession,
        paths: [...explorerSharedDragSession.paths],
      }
    : null;
}

export function readExplorerPathsFromDataTransfer(args: {
  dataTransfer: DataTransfer | null | undefined;
  fallbackPaths?: readonly string[];
}): string[] {
  const { dataTransfer, fallbackPaths = [] } = args;
  const normalizedFallbackPaths = fallbackPaths.filter(
    (path): path is string => typeof path === "string" && path.trim().length > 0,
  );

  if (!dataTransfer || typeof dataTransfer.getData !== "function") {
    return [...normalizedFallbackPaths];
  }

  const payload = dataTransfer.getData("application/x-overlayterm-paths");
  if (payload) {
    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        const payloadPaths = parsed.filter(
          (path): path is string =>
            typeof path === "string" && path.trim().length > 0,
        );
        if (payloadPaths.length > 0) {
          return payloadPaths;
        }
      }
    } catch {
      // Keep falling through to plain-text or fallback paths.
    }
  }

  const plainTextPath = dataTransfer.getData("text/plain").trim();
  if (plainTextPath) {
    return [plainTextPath];
  }

  return [...normalizedFallbackPaths];
}

export function normalizeExplorerComparablePath(
  path: string,
  platform: RuntimePlatform,
): string {
  const collapsed = path.replace(/[\\/]+/g, "/").replace(/\/$/, "");
  return platform === "windows" ? collapsed.toLowerCase() : collapsed;
}

export function doesExplorerPayloadMatchSharedDragSession(args: {
  payloadPaths: readonly string[];
  platform: RuntimePlatform;
  session?: ExplorerSharedDragSession | null;
}): boolean {
  const session = args.session ?? getExplorerSharedDragSession();
  if (!session || session.paths.length === 0) {
    return false;
  }

  const normalizedSessionPaths = session.paths.map((path) =>
    normalizeExplorerComparablePath(path, args.platform),
  );
  const normalizedPayloadPaths = args.payloadPaths.map((path) =>
    normalizeExplorerComparablePath(path, args.platform),
  );

  return (
    normalizedPayloadPaths.length === normalizedSessionPaths.length &&
    normalizedPayloadPaths.every((path) =>
      normalizedSessionPaths.includes(path),
    )
  );
}
