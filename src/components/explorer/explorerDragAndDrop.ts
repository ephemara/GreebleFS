import { useRef, useSyncExternalStore } from "react";
import type { RuntimePlatform } from "../../config/platform";
import {
  type ExplorerDropSurfaceRole,
  type ExplorerResolvedDropSurfaceKind,
  resolveEffectiveExplorerDragEngine,
  type ResolvedExplorerDragEngine,
} from "../../config/explorerDragEngines";
import {
  EXPLORER_DRAG_CANCEL_BURST_DURATION_MS,
  EXPLORER_DRAG_DROP_BURST_DURATION_MS,
  EXPLORER_DRAG_OVERLAY_POINTER_OFFSET,
  EXPLORER_SHARED_DRAG_SESSION_LINGER_MS,
} from "../../config/explorerDragInteractions";
import {
  recordExplorerPerformanceSample,
  type ExplorerPerformanceMetadata,
  type ExplorerPerformanceMetricId,
} from "../../config/performanceTelemetry";

export type ExplorerDragIntent = "internal" | "native-out";
export type ExplorerDragOperation = "move" | "copy";
export type ExplorerDragSourceKind = "internal" | "external";
export type ExplorerDragVisualPhase =
  | "idle"
  | "lift"
  | "dragging-valid"
  | "dragging-invalid"
  | "dwell-opening"
  | "dropping"
  | "cancelled";
export type ExplorerDragAvatarKind = "file" | "folder" | "mixed" | "external";
export type ExplorerDragAvatarStackItem = {
  path: string;
  label: string;
  iconSrc: string | null;
  itemKind: ExplorerDragAvatarKind;
};

export const EXPLORER_DROP_TARGET_ATTRIBUTE = "data-overlay-drop-target-path";
export const EXPLORER_DROP_SCOPE_ATTRIBUTE =
  "data-overlay-explorer-drop-scope-id";
export const EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE =
  "data-overlay-explorer-drop-root-path";
export const EXPLORER_DROP_SURFACE_ROLE_ATTRIBUTE =
  "data-overlay-explorer-drop-surface-role";
export const EXPLORER_DROP_SURFACE_ID_ATTRIBUTE =
  "data-overlay-explorer-drop-surface-id";

export type ExplorerDropPointerLike = {
  x: number;
  y: number;
  toLogical?: (scaleFactor: number) => { x: number; y: number };
};

export type ExplorerResolvedDropHit = {
  scopeId: string;
  surfaceId: string;
  surfaceRole: ExplorerDropSurfaceRole;
  targetKind: ExplorerResolvedDropSurfaceKind;
  targetPath: string;
  scopeElement: HTMLElement | null;
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

export type ExplorerDropValidation = {
  valid: boolean;
  reason: "self" | "descendant" | "no-op" | null;
};

export type ExplorerDropSurfaceDescriptor = {
  surfaceId: string;
  scopeId: string;
  role: ExplorerDropSurfaceRole;
  targetPath?: string | null;
  rootPath?: string | null;
  autoOpenDelayMs?: number | null;
  onAutoOpen?: (() => void) | null;
  label?: string | null;
};

type ExplorerDropSurfaceBehavior = {
  autoOpenDelayMs: number | null;
  label: string | null;
  onAutoOpen: (() => void) | null;
};

type ExplorerResolvedSurfaceMetadata = {
  surfaceId: string;
  scopeId: string;
  role: ExplorerDropSurfaceRole;
  targetPath: string | null;
  rootPath: string | null;
};

export type ExplorerDropSurfaceBinding = {
  ref: (node: HTMLElement | null) => void;
  [EXPLORER_DROP_SCOPE_ATTRIBUTE]: string;
  [EXPLORER_DROP_SURFACE_ROLE_ATTRIBUTE]: ExplorerDropSurfaceRole;
  [EXPLORER_DROP_SURFACE_ID_ATTRIBUTE]: string;
  [EXPLORER_DROP_TARGET_ATTRIBUTE]?: string;
  [EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE]?: string;
};

export type ExplorerDragInteractionState = {
  active: boolean;
  phase: ExplorerDragVisualPhase;
  sourceKind: ExplorerDragSourceKind | null;
  sourceScopeId: string | null;
  sourcePrimaryPath: string | null;
  sourceItemKind: ExplorerDragAvatarKind;
  sourceIconSrc: string | null;
  sourceStackItems: ExplorerDragAvatarStackItem[];
  operation: ExplorerDragOperation;
  paths: string[];
  itemCount: number;
  primaryLabel: string | null;
  pointer: {
    x: number;
    y: number;
  } | null;
  overlayPointer: {
    x: number;
    y: number;
  } | null;
  scopeId: string | null;
  targetPath: string | null;
  targetKind: ExplorerResolvedDropSurfaceKind | null;
  targetSurfaceId: string | null;
  targetSurfaceRole: ExplorerDropSurfaceRole | null;
  presentationTargetPoint: {
    x: number;
    y: number;
  } | null;
  valid: boolean;
  invalidReason: ExplorerDropValidation["reason"];
  externalWindowItemCount: number;
  dwellSurfaceId: string | null;
  dwellTargetPath: string | null;
  dwellProgress: number;
  dwellDelayMs: number | null;
  dwellLabel: string | null;
};

export function getExplorerDropScopeId(instanceId: string | number): string {
  return `explorer-drop-${String(instanceId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function getExplorerDirectoryDropSurfaceId(path: string): string {
  return `explorer-directory:${path}`;
}

export function getExplorerPreviewDropSurfaceId(path: string): string {
  return `explorer-preview:${path}`;
}

let explorerDragEnginePolicy = resolveEffectiveExplorerDragEngine();
const explorerDragTelemetryLastRecordedAtByMetric = new Map<
  ExplorerPerformanceMetricId,
  number
>();

export function configureExplorerDragEnginePolicy(
  policy: ResolvedExplorerDragEngine | null | undefined,
): void {
  const nextPolicy = policy ?? resolveEffectiveExplorerDragEngine();
  if (nextPolicy.id === explorerDragEnginePolicy.id) {
    explorerDragEnginePolicy = nextPolicy;
    return;
  }
  explorerDragEnginePolicy = nextPolicy;
  clearExplorerResolvedDropHitCache();
  clearExplorerCachedElementRects();
}

export function getCurrentExplorerDragEnginePolicy(): ResolvedExplorerDragEngine {
  return explorerDragEnginePolicy;
}

function getDragNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function recordExplorerDragMetric(
  metricId: ExplorerPerformanceMetricId,
  durationMs: number,
  metadata: ExplorerPerformanceMetadata = {},
): void {
  const now = Date.now();
  const lastRecordedAt =
    explorerDragTelemetryLastRecordedAtByMetric.get(metricId) ?? 0;
  if (now - lastRecordedAt < 80) {
    return;
  }
  explorerDragTelemetryLastRecordedAtByMetric.set(metricId, now);
  recordExplorerPerformanceSample({
    metricId,
    durationMs,
    recordedAt: now,
    metadata: {
      engineId: explorerDragEnginePolicy.id,
      ...metadata,
    },
  });
}

const explorerDropSurfaceBindingById = new Map<
  string,
  ExplorerDropSurfaceBinding
>();
const explorerDropSurfaceBehaviorById = new Map<
  string,
  ExplorerDropSurfaceBehavior
>();
const explorerDropSurfaceElementById = new Map<string, HTMLElement>();
const explorerDropSurfaceMetadataById = new Map<
  string,
  ExplorerResolvedSurfaceMetadata
>();
const explorerDropSurfaceMetadataByElement = new WeakMap<
  HTMLElement,
  ExplorerResolvedSurfaceMetadata
>();
const explorerDropScopeRootSurfaceIdByScopeId = new Map<string, string>();
const explorerDropValidationContextByPaths = new WeakMap<
  readonly string[],
  Map<
    RuntimePlatform,
    {
      normalizedSourcePaths: string[];
      uniqueParentPaths: Set<string>;
    }
  >
>();

let explorerSharedDragSession: ExplorerSharedDragSession | null = null;
let explorerSharedDragSessionExpiryTimer: ReturnType<typeof setTimeout> | null =
  null;
let explorerDragPresentationTimer: ReturnType<typeof setTimeout> | null = null;
let explorerLastResolvedDropHit: ExplorerResolvedDropHit | null = null;
let explorerElementRectCacheClearFrame: number | null = null;
let explorerElementRectCacheEnabled = false;
let explorerElementRectCache = new WeakMap<HTMLElement, DOMRectReadOnly>();

const explorerDragInteractionListeners = new Set<() => void>();
function createEmptyExplorerDragInteractionState(): ExplorerDragInteractionState {
  return {
    active: false,
    phase: "idle",
    sourceKind: null,
    sourceScopeId: null,
    sourcePrimaryPath: null,
    sourceItemKind: "external",
    sourceIconSrc: null,
    sourceStackItems: [],
    operation: "move",
    paths: [],
    itemCount: 0,
    primaryLabel: null,
    pointer: null,
    overlayPointer: null,
    scopeId: null,
    targetPath: null,
    targetKind: null,
    targetSurfaceId: null,
    targetSurfaceRole: null,
    presentationTargetPoint: null,
    valid: false,
    invalidReason: null,
    externalWindowItemCount: 0,
    dwellSurfaceId: null,
    dwellTargetPath: null,
    dwellProgress: 0,
    dwellDelayMs: null,
    dwellLabel: null,
  };
}

let explorerDragInteractionState: ExplorerDragInteractionState =
  createEmptyExplorerDragInteractionState();

let explorerDragAutoOpenTimer: ReturnType<typeof setTimeout> | null = null;
let explorerDragAutoOpenFrame: number | null = null;
let explorerDragAutoOpenStartedAt = 0;

function emitExplorerDragInteractionState(): void {
  for (const listener of explorerDragInteractionListeners) {
    listener();
  }
}

function pointsEqual(
  left: { x: number; y: number } | null,
  right: { x: number; y: number } | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      Math.abs(left.x - right.x) < 0.01 &&
      Math.abs(left.y - right.y) < 0.01)
  );
}

function areExplorerDragStatesEquivalent(
  left: ExplorerDragInteractionState,
  right: ExplorerDragInteractionState,
): boolean {
  return (
    left.active === right.active &&
    left.phase === right.phase &&
    left.sourceKind === right.sourceKind &&
    left.sourceScopeId === right.sourceScopeId &&
    left.sourcePrimaryPath === right.sourcePrimaryPath &&
    left.sourceItemKind === right.sourceItemKind &&
    left.sourceIconSrc === right.sourceIconSrc &&
    left.sourceStackItems === right.sourceStackItems &&
    left.operation === right.operation &&
    left.paths === right.paths &&
    left.itemCount === right.itemCount &&
    left.primaryLabel === right.primaryLabel &&
    pointsEqual(left.pointer, right.pointer) &&
    pointsEqual(left.overlayPointer, right.overlayPointer) &&
    left.scopeId === right.scopeId &&
    left.targetPath === right.targetPath &&
    left.targetKind === right.targetKind &&
    left.targetSurfaceId === right.targetSurfaceId &&
    left.targetSurfaceRole === right.targetSurfaceRole &&
    pointsEqual(left.presentationTargetPoint, right.presentationTargetPoint) &&
    left.valid === right.valid &&
    left.invalidReason === right.invalidReason &&
    left.externalWindowItemCount === right.externalWindowItemCount &&
    left.dwellSurfaceId === right.dwellSurfaceId &&
    left.dwellTargetPath === right.dwellTargetPath &&
    Math.abs(left.dwellProgress - right.dwellProgress) < 0.001 &&
    left.dwellDelayMs === right.dwellDelayMs &&
    left.dwellLabel === right.dwellLabel
  );
}

function setExplorerDragInteractionState(
  nextState:
    | ExplorerDragInteractionState
    | ((
        currentState: ExplorerDragInteractionState,
      ) => ExplorerDragInteractionState),
): void {
  const resolvedNextState =
    typeof nextState === "function"
      ? nextState(explorerDragInteractionState)
      : nextState;
  if (
    resolvedNextState === explorerDragInteractionState ||
    (explorerDragEnginePolicy.pointer.statePublish === "on-change" &&
      areExplorerDragStatesEquivalent(
        explorerDragInteractionState,
        resolvedNextState,
      ))
  ) {
    return;
  }
  explorerDragInteractionState = resolvedNextState;
  emitExplorerDragInteractionState();
}

function clearExplorerSharedDragSessionExpiryTimer(): void {
  if (explorerSharedDragSessionExpiryTimer !== null) {
    clearTimeout(explorerSharedDragSessionExpiryTimer);
    explorerSharedDragSessionExpiryTimer = null;
  }
}

function clearExplorerDragPresentationTimer(): void {
  if (explorerDragPresentationTimer !== null) {
    clearTimeout(explorerDragPresentationTimer);
    explorerDragPresentationTimer = null;
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
  const rect = getExplorerCachedElementRect(element);
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

function getExplorerDropSurfaceBehavior(
  surfaceId: string | null | undefined,
): ExplorerDropSurfaceBehavior | null {
  if (!surfaceId) {
    return null;
  }
  return explorerDropSurfaceBehaviorById.get(surfaceId) ?? null;
}

function stabilizeExplorerPaths(nextPaths: readonly string[]): string[] {
  const currentPaths = explorerDragInteractionState.paths;
  if (
    currentPaths.length === nextPaths.length &&
    currentPaths.every((path, index) => path === nextPaths[index])
  ) {
    return currentPaths;
  }
  return [...nextPaths];
}

function stabilizeExplorerDragAvatarStackItems(
  nextItems: readonly ExplorerDragAvatarStackItem[],
): ExplorerDragAvatarStackItem[] {
  const currentItems = explorerDragInteractionState.sourceStackItems;
  if (
    currentItems.length === nextItems.length &&
    currentItems.every(
      (item, index) =>
        item.path === nextItems[index]?.path &&
        item.label === nextItems[index]?.label &&
        item.iconSrc === nextItems[index]?.iconSrc &&
        item.itemKind === nextItems[index]?.itemKind,
    )
  ) {
    return currentItems;
  }
  return nextItems.map((item) => ({ ...item }));
}

function getExplorerDragPresentationTargetPoint(
  hit: ExplorerResolvedDropHit | null,
): { x: number; y: number } | null {
  const targetElement = hit?.targetElement ?? hit?.scopeElement ?? null;
  if (targetElement) {
    return getElementCenterPoint(targetElement);
  }
  return hit?.point ?? null;
}

function resolveExplorerScopeElement(scopeId: string): HTMLElement | null {
  const scopeRootSurfaceId =
    explorerDropScopeRootSurfaceIdByScopeId.get(scopeId) ?? null;
  if (scopeRootSurfaceId) {
    return explorerDropSurfaceElementById.get(scopeRootSurfaceId) ?? null;
  }
  const selector = `[${EXPLORER_DROP_SURFACE_ROLE_ATTRIBUTE}="scope-root"][${EXPLORER_DROP_SCOPE_ATTRIBUTE}="${CSS.escape(
    scopeId,
  )}"]`;
  const element = document.querySelector(selector);
  return element instanceof HTMLElement ? element : null;
}

function getSurfaceMetadataFromElement(
  element: HTMLElement,
): ExplorerResolvedSurfaceMetadata | null {
  const registeredMetadata =
    explorerDropSurfaceMetadataByElement.get(element) ?? null;
  if (registeredMetadata) {
    return registeredMetadata;
  }

  const surfaceId = element.getAttribute(EXPLORER_DROP_SURFACE_ID_ATTRIBUTE);
  if (surfaceId) {
    const cachedMetadata = explorerDropSurfaceMetadataById.get(surfaceId) ?? null;
    if (cachedMetadata) {
      return cachedMetadata;
    }
  }
  const scopeId = element.getAttribute(EXPLORER_DROP_SCOPE_ATTRIBUTE);
  const role = element.getAttribute(
    EXPLORER_DROP_SURFACE_ROLE_ATTRIBUTE,
  ) as ExplorerDropSurfaceRole | null;
  if (!surfaceId || !scopeId || !role) {
    return null;
  }
  return {
    surfaceId,
    scopeId,
    role,
    targetPath: element.getAttribute(EXPLORER_DROP_TARGET_ATTRIBUTE),
    rootPath: element.getAttribute(EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE),
  };
}

function registerExplorerScopeRootSurface(
  surfaceId: string,
  previousMetadata: ExplorerResolvedSurfaceMetadata | null,
  nextMetadata: ExplorerResolvedSurfaceMetadata | null,
): void {
  if (
    previousMetadata?.role === "scope-root" &&
    explorerDropScopeRootSurfaceIdByScopeId.get(previousMetadata.scopeId) ===
      surfaceId
  ) {
    explorerDropScopeRootSurfaceIdByScopeId.delete(previousMetadata.scopeId);
  }

  if (nextMetadata?.role === "scope-root") {
    explorerDropScopeRootSurfaceIdByScopeId.set(nextMetadata.scopeId, surfaceId);
  }
}

function resolveDropHitFromSurfaceMetadata(args: {
  metadata: ReturnType<typeof getSurfaceMetadataFromElement>;
  point: {
    x: number;
    y: number;
  };
  targetElement: HTMLElement;
}): ExplorerResolvedDropHit | null {
  const { metadata, point, targetElement } = args;
  if (!metadata) {
    return null;
  }

  if (metadata.role === "directory-target" && metadata.targetPath) {
    return {
      scopeId: metadata.scopeId,
      surfaceId: metadata.surfaceId,
      surfaceRole: metadata.role,
      targetKind: "directory",
      targetPath: metadata.targetPath,
      scopeElement: resolveExplorerScopeElement(metadata.scopeId),
      targetElement,
      point,
    };
  }

  if (metadata.role === "navigation-target" && metadata.targetPath) {
    return {
      scopeId: metadata.scopeId,
      surfaceId: metadata.surfaceId,
      surfaceRole: metadata.role,
      targetKind: "navigation",
      targetPath: metadata.targetPath,
      scopeElement: resolveExplorerScopeElement(metadata.scopeId),
      targetElement,
      point,
    };
  }

  if (metadata.role === "scope-root" && metadata.rootPath) {
    return {
      scopeId: metadata.scopeId,
      surfaceId: metadata.surfaceId,
      surfaceRole: metadata.role,
      targetKind: "scope-root",
      targetPath: metadata.rootPath,
      scopeElement: targetElement,
      targetElement: null,
      point,
    };
  }

  return null;
}

function clearExplorerDragAutoOpenState(): void {
  if (explorerDragAutoOpenTimer !== null) {
    clearTimeout(explorerDragAutoOpenTimer);
    explorerDragAutoOpenTimer = null;
  }
  if (
    explorerDragAutoOpenFrame !== null &&
    typeof cancelAnimationFrame === "function"
  ) {
    cancelAnimationFrame(explorerDragAutoOpenFrame);
    explorerDragAutoOpenFrame = null;
  }
  explorerDragAutoOpenStartedAt = 0;
}

function updateExplorerDragDwellState(args: {
  surfaceId: string | null;
  targetPath: string | null;
  delayMs: number | null;
  label: string | null;
}): void {
  setExplorerDragInteractionState((currentState) => ({
    ...currentState,
    phase:
      currentState.phase === "dropping" || currentState.phase === "cancelled"
        ? currentState.phase
        : args.surfaceId && currentState.valid
          ? "dwell-opening"
          : currentState.valid
            ? "dragging-valid"
            : currentState.active
              ? "dragging-invalid"
              : "idle",
    dwellSurfaceId: args.surfaceId,
    dwellTargetPath: args.targetPath,
    dwellDelayMs: args.delayMs,
    dwellLabel: args.label,
    dwellProgress:
      args.surfaceId && args.delayMs && args.delayMs > 0
        ? currentState.dwellProgress
        : 0,
  }));
}

function scheduleExplorerDragAutoOpen(hit: ExplorerResolvedDropHit | null): void {
  const behavior = getExplorerDropSurfaceBehavior(hit?.surfaceId);
  if (!hit || !behavior?.onAutoOpen) {
    clearExplorerDragAutoOpenState();
    updateExplorerDragDwellState({
      surfaceId: null,
      targetPath: null,
      delayMs: null,
      label: null,
    });
    return;
  }

  const configuredDelay =
    behavior.autoOpenDelayMs ??
    (hit.surfaceRole === "directory-target"
      ? explorerDragEnginePolicy.dropTargets.directoryAutoOpenDelayMs
      : hit.surfaceRole === "navigation-target"
        ? explorerDragEnginePolicy.dropTargets.navigationAutoOpenDelayMs
        : null) ??
    (hit.targetKind === "navigation"
      ? explorerDragEnginePolicy.dropTargets.tabAutoOpenDelayMs
      : explorerDragEnginePolicy.dropTargets.tabAutoOpenDelayMs);
  if (!configuredDelay || configuredDelay <= 0) {
    clearExplorerDragAutoOpenState();
    updateExplorerDragDwellState({
      surfaceId: null,
      targetPath: null,
      delayMs: null,
      label: null,
    });
    return;
  }

  if (
    explorerDragInteractionState.dwellSurfaceId === hit.surfaceId &&
    explorerDragAutoOpenTimer !== null
  ) {
    return;
  }

  clearExplorerDragAutoOpenState();
  explorerDragAutoOpenStartedAt = Date.now();
  updateExplorerDragDwellState({
    surfaceId: hit.surfaceId,
    targetPath: hit.targetPath,
    delayMs: configuredDelay,
    label: behavior.label,
  });

  const tick = () => {
    const elapsed = Date.now() - explorerDragAutoOpenStartedAt;
    const progress = Math.max(0, Math.min(1, elapsed / configuredDelay));
    setExplorerDragInteractionState((currentState) => {
      if (currentState.dwellSurfaceId !== hit.surfaceId) {
        return currentState;
      }
      return {
        ...currentState,
        dwellProgress: progress,
      };
    });
    if (progress < 1 && typeof requestAnimationFrame === "function") {
      explorerDragAutoOpenFrame = requestAnimationFrame(tick);
    } else {
      explorerDragAutoOpenFrame = null;
    }
  };

  if (typeof requestAnimationFrame === "function") {
    explorerDragAutoOpenFrame = requestAnimationFrame(tick);
  }

  explorerDragAutoOpenTimer = setTimeout(() => {
    explorerDragAutoOpenTimer = null;
    behavior.onAutoOpen?.();
    clearExplorerDragAutoOpenState();
    setExplorerDragInteractionState((currentState) => ({
      ...currentState,
      dwellSurfaceId: null,
      dwellTargetPath: null,
      dwellProgress: 0,
      dwellDelayMs: null,
      dwellLabel: null,
    }));
  }, configuredDelay);
}

function getExplorerDropSurfaceCandidates(
  startElement: Element | null,
): HTMLElement[] {
  const candidates: HTMLElement[] = [];
  let currentElement = startElement;
  while (currentElement instanceof HTMLElement) {
    if (
      currentElement.hasAttribute(EXPLORER_DROP_SURFACE_ROLE_ATTRIBUTE) &&
      currentElement.hasAttribute(EXPLORER_DROP_SCOPE_ATTRIBUTE)
    ) {
      candidates.push(currentElement);
    }
    currentElement = currentElement.parentElement;
  }
  return candidates;
}

function resolveExplorerDropHitFromCandidateElements(args: {
  candidates: HTMLElement[];
  point: {
    x: number;
    y: number;
  };
  enforcePointContainment: boolean;
}): ExplorerResolvedDropHit | null {
  let bestHit: ExplorerResolvedDropHit | null = null;
  let bestPriority = -1;
  for (const candidate of args.candidates) {
    if (
      args.enforcePointContainment &&
      !isPointWithinElementRect(candidate, args.point)
    ) {
      continue;
    }
    const metadata = getSurfaceMetadataFromElement(candidate);
    const hit = resolveDropHitFromSurfaceMetadata({
      metadata,
      point: args.point,
      targetElement: candidate,
    });
    if (!hit) {
      continue;
    }
    const priority =
      explorerDragEnginePolicy.dropTargets.surfacePriority[hit.surfaceRole] ??
      0;
    if (priority > bestPriority) {
      bestPriority = priority;
      bestHit = hit;
    }
  }
  return bestHit;
}

function getElementCenterPoint(element: HTMLElement): { x: number; y: number } {
  const rect = getExplorerCachedElementRect(element);
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function clearExplorerCachedElementRects(): void {
  if (
    explorerElementRectCacheClearFrame !== null &&
    typeof cancelAnimationFrame === "function"
  ) {
    cancelAnimationFrame(explorerElementRectCacheClearFrame);
  }
  explorerElementRectCacheClearFrame = null;
  explorerElementRectCacheEnabled = false;
  explorerElementRectCache = new WeakMap<HTMLElement, DOMRectReadOnly>();
}

function scheduleExplorerCachedElementRectReset(): void {
  if (explorerElementRectCacheClearFrame !== null) {
    return;
  }
  if (typeof requestAnimationFrame !== "function") {
    explorerElementRectCacheEnabled = false;
    return;
  }
  explorerElementRectCacheClearFrame = requestAnimationFrame(() => {
    explorerElementRectCacheClearFrame = null;
    explorerElementRectCacheEnabled = false;
    explorerElementRectCache = new WeakMap<HTMLElement, DOMRectReadOnly>();
  });
}

function getExplorerCachedElementRect(element: HTMLElement): DOMRectReadOnly {
  if (!explorerElementRectCacheEnabled) {
    explorerElementRectCacheEnabled = true;
    scheduleExplorerCachedElementRectReset();
  }
  const cachedRect = explorerElementRectCache.get(element);
  if (cachedRect) {
    return cachedRect;
  }
  const nextRect = element.getBoundingClientRect();
  explorerElementRectCache.set(element, nextRect);
  return nextRect;
}

function clearExplorerResolvedDropHitCache(): void {
  explorerLastResolvedDropHit = null;
}

function tryResolveExplorerDropHitFromCachedTarget(point: {
  x: number;
  y: number;
}): ExplorerResolvedDropHit | null {
  const cachedHit = explorerLastResolvedDropHit;
  const cachedTargetElement = cachedHit?.targetElement ?? null;
  if (
    !(cachedTargetElement instanceof HTMLElement) ||
    !cachedTargetElement.isConnected ||
    !isPointWithinElementRect(cachedTargetElement, point)
  ) {
    return null;
  }
  return resolveDropHitFromSurfaceMetadata({
    metadata: getSurfaceMetadataFromElement(cachedTargetElement),
    point,
    targetElement: cachedTargetElement,
  });
}

function resolveExplorerDropHitFromRegisteredSurfaces(point: {
  x: number;
  y: number;
}): ExplorerResolvedDropHit | null {
  let bestHit: ExplorerResolvedDropHit | null = null;
  let bestPriority = -Infinity;
  let bestArea = Infinity;
  for (const [surfaceId, element] of explorerDropSurfaceElementById) {
    if (!element.isConnected || !isPointWithinElementRect(element, point)) {
      continue;
    }
    const metadata = explorerDropSurfaceMetadataById.get(surfaceId) ?? null;
    const hit = resolveDropHitFromSurfaceMetadata({
      metadata,
      point,
      targetElement: element,
    });
    if (!hit) {
      continue;
    }
    const priority =
      explorerDragEnginePolicy.dropTargets.surfacePriority[hit.surfaceRole] ??
      0;
    const rect = getExplorerCachedElementRect(element);
    const area = Math.max(1, rect.width * rect.height);
    if (priority > bestPriority || (priority === bestPriority && area < bestArea)) {
      bestHit = hit;
      bestPriority = priority;
      bestArea = area;
    }
  }
  return bestHit;
}

function resolveLegacyExplorerDropHitFromElement(
  element: HTMLElement,
  point: { x: number; y: number },
): ExplorerResolvedDropHit | null {
  const legacyScopeElement = element.closest<HTMLElement>(
    `[${EXPLORER_DROP_SCOPE_ATTRIBUTE}]`,
  );
  if (!legacyScopeElement) {
    return null;
  }
  const legacyScopeId = legacyScopeElement.getAttribute(
    EXPLORER_DROP_SCOPE_ATTRIBUTE,
  );
  if (!legacyScopeId) {
    return null;
  }
  const legacyTargetElement = element.closest<HTMLElement>(
    `[${EXPLORER_DROP_TARGET_ATTRIBUTE}]`,
  );
  const legacyTargetPath = legacyTargetElement?.getAttribute(
    EXPLORER_DROP_TARGET_ATTRIBUTE,
  );
  if (legacyTargetElement && legacyTargetPath) {
    return {
      scopeId: legacyScopeId,
      surfaceId: `legacy-directory:${legacyTargetPath}`,
      surfaceRole: "directory-target",
      targetKind: "directory",
      targetPath: legacyTargetPath,
      scopeElement: legacyScopeElement,
      targetElement: legacyTargetElement,
      point,
    };
  }
  const legacyRootPath = legacyScopeElement.getAttribute(
    EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE,
  );
  if (!legacyRootPath) {
    return null;
  }
  return {
    scopeId: legacyScopeId,
    surfaceId: `legacy-scope:${legacyScopeId}`,
    surfaceRole: "scope-root",
    targetKind: "scope-root",
    targetPath: legacyRootPath,
    scopeElement: legacyScopeElement,
    targetElement: null,
    point,
  };
}

export function resolveExplorerDropHitFromElement(
  element: Element | null,
): ExplorerResolvedDropHit | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const point = getElementCenterPoint(element);
  const candidates = getExplorerDropSurfaceCandidates(element);
  if (candidates.length > 0) {
    return resolveExplorerDropHitFromCandidateElements({
      candidates,
      point,
      enforcePointContainment: false,
    });
  }
  return resolveLegacyExplorerDropHitFromElement(element, point);
}

export function resolveExplorerDropHitFromPoint(
  pointer: ExplorerDropPointerLike,
  scaleFactor = 1,
): ExplorerResolvedDropHit | null {
  const startedAt = getDragNow();
  if (
    typeof document === "undefined" ||
    typeof document.elementFromPoint !== "function"
  ) {
    return null;
  }

  const point = normalizeExplorerDropPoint(pointer, scaleFactor);
  const cachedHit = tryResolveExplorerDropHitFromCachedTarget(point);
  if (cachedHit) {
    explorerLastResolvedDropHit = cachedHit;
    recordExplorerDragMetric(
      "explorer_drag_hit_test",
      getDragNow() - startedAt,
      { mode: "cached" },
    );
    return cachedHit;
  }

  if (explorerDragEnginePolicy.pointer.hitTestMode === "registered-rects") {
    const registeredHit = resolveExplorerDropHitFromRegisteredSurfaces(point);
    if (registeredHit) {
      explorerLastResolvedDropHit = registeredHit.targetElement
        ? registeredHit
        : null;
      recordExplorerDragMetric(
        "explorer_drag_hit_test",
        getDragNow() - startedAt,
        { mode: "registered-rects" },
      );
      return registeredHit;
    }
  }

  const elementAtPointer = document.elementFromPoint(point.x, point.y);
  if (!(elementAtPointer instanceof HTMLElement)) {
    clearExplorerResolvedDropHitCache();
    recordExplorerDragMetric(
      "explorer_drag_hit_test",
      getDragNow() - startedAt,
      { mode: "element-from-point", hit: false },
    );
    return null;
  }

  const candidates = getExplorerDropSurfaceCandidates(elementAtPointer);
  if (candidates.length === 0) {
    const legacyHit = resolveLegacyExplorerDropHitFromElement(
      elementAtPointer,
      point,
    );
    explorerLastResolvedDropHit = legacyHit?.targetElement ? legacyHit : null;
    recordExplorerDragMetric(
      "explorer_drag_hit_test",
      getDragNow() - startedAt,
      { mode: "legacy", hit: Boolean(legacyHit) },
    );
    return legacyHit;
  }

  const resolvedHit = resolveExplorerDropHitFromCandidateElements({
    candidates,
    point,
    enforcePointContainment: true,
  });
  explorerLastResolvedDropHit = resolvedHit?.targetElement ? resolvedHit : null;
  recordExplorerDragMetric(
    "explorer_drag_hit_test",
    getDragNow() - startedAt,
    { mode: "element-from-point", hit: Boolean(resolvedHit) },
  );
  return resolvedHit;
}

export function normalizeExplorerComparablePath(
  path: string,
  platform: RuntimePlatform,
): string {
  const collapsed = path.replace(/[\\/]+/g, "/").replace(/\/$/, "");
  return platform === "windows" ? collapsed.toLowerCase() : collapsed;
}

function getExplorerParentComparablePath(
  path: string,
  platform: RuntimePlatform,
): string {
  const normalizedPath = normalizeExplorerComparablePath(path, platform);
  const parts = normalizedPath.split("/").filter(Boolean);
  parts.pop();
  if (parts.length === 0) {
    return normalizedPath.startsWith("/") ? "/" : "";
  }
  return `${normalizedPath.startsWith("/") ? "/" : ""}${parts.join("/")}`;
}

export function validateExplorerDropTarget(args: {
  sourcePaths: readonly string[];
  targetPath: string;
  platform: RuntimePlatform;
}): ExplorerDropValidation {
  const normalizedTargetPath = normalizeExplorerComparablePath(
    args.targetPath,
    args.platform,
  );
  let platformValidationContext =
    explorerDropValidationContextByPaths.get(args.sourcePaths)?.get(
      args.platform,
    ) ?? null;
  if (!platformValidationContext) {
    const normalizedSourcePaths = args.sourcePaths.map((sourcePath) =>
      normalizeExplorerComparablePath(sourcePath, args.platform),
    );
    platformValidationContext = {
      normalizedSourcePaths,
      uniqueParentPaths: new Set(
        normalizedSourcePaths.map((sourcePath) =>
          getExplorerParentComparablePath(sourcePath, args.platform),
        ),
      ),
    };
    const contextByPlatform =
      explorerDropValidationContextByPaths.get(args.sourcePaths) ?? new Map();
    contextByPlatform.set(args.platform, platformValidationContext);
    explorerDropValidationContextByPaths.set(args.sourcePaths, contextByPlatform);
  }
  const { normalizedSourcePaths, uniqueParentPaths } = platformValidationContext;

  if (normalizedSourcePaths.some((sourcePath) => sourcePath === normalizedTargetPath)) {
    return { valid: false, reason: "self" };
  }

  if (
    normalizedSourcePaths.some(
      (sourcePath) =>
        normalizedTargetPath.startsWith(`${sourcePath}/`) &&
        normalizedTargetPath !== sourcePath,
    )
  ) {
    return { valid: false, reason: "descendant" };
  }

  if (
    uniqueParentPaths.size === 1 &&
    uniqueParentPaths.has(normalizedTargetPath)
  ) {
    return { valid: false, reason: "no-op" };
  }

  return { valid: true, reason: null };
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

  const dedupePaths = (paths: readonly string[]): string[] =>
    Array.from(
      new Set(
        paths.filter(
          (path): path is string =>
            typeof path === "string" && path.trim().length > 0,
        ),
      ),
    );

  const readPathsFromUriList = (value: string): string[] => {
    if (!value.trim()) {
      return [];
    }

    return dedupePaths(
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
        .map((line) => {
          if (!/^file:/i.test(line)) {
            return null;
          }

          try {
            const url = new URL(line);
            if (url.protocol !== "file:") {
              return null;
            }

            const decodedPathname = decodeURIComponent(url.pathname);
            if (!decodedPathname) {
              return null;
            }

            const windowsPath = decodedPathname.match(/^\/([a-zA-Z]:\/.*)$/);
            if (windowsPath) {
              return windowsPath[1].replace(/\//g, "\\");
            }

            return decodedPathname;
          } catch {
            return null;
          }
        })
        .filter((path): path is string => typeof path === "string"),
    );
  };

  const readPathsFromFiles = (): string[] => {
    const fileList = Array.from(dataTransfer.files ?? []);
    return dedupePaths(
      fileList
        .map((file) => {
          const filePath =
            typeof (file as File & { path?: string }).path === "string"
              ? (file as File & { path: string }).path
              : null;
          return filePath?.trim() ? filePath : null;
        })
        .filter((path): path is string => typeof path === "string"),
    );
  };

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

  const uriListPaths = readPathsFromUriList(
    dataTransfer.getData("text/uri-list"),
  );
  if (uriListPaths.length > 0) {
    return uriListPaths;
  }

  const fileListPaths = readPathsFromFiles();
  if (fileListPaths.length > 0) {
    return fileListPaths;
  }

  const plainTextPath = dataTransfer.getData("text/plain").trim();
  if (plainTextPath) {
    return [plainTextPath];
  }

  return [...normalizedFallbackPaths];
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

export function createExplorerDropSurfaceBinding(
  descriptor: ExplorerDropSurfaceDescriptor,
): ExplorerDropSurfaceBinding {
  const normalizedTargetPath =
    typeof descriptor.targetPath === "string" && descriptor.targetPath.trim()
      ? descriptor.targetPath
      : undefined;
  const normalizedRootPath =
    typeof descriptor.rootPath === "string" && descriptor.rootPath.trim()
      ? descriptor.rootPath
      : undefined;
  const nextMetadata: ExplorerResolvedSurfaceMetadata = {
    surfaceId: descriptor.surfaceId,
    scopeId: descriptor.scopeId,
    role: descriptor.role,
    targetPath: normalizedTargetPath ?? null,
    rootPath:
      descriptor.role === "scope-root" ? normalizedRootPath ?? null : null,
  };
  const previousMetadata =
    explorerDropSurfaceMetadataById.get(descriptor.surfaceId) ?? null;
  explorerDropSurfaceMetadataById.set(descriptor.surfaceId, nextMetadata);
  explorerDropSurfaceBehaviorById.set(descriptor.surfaceId, {
    autoOpenDelayMs: descriptor.autoOpenDelayMs ?? null,
    label: descriptor.label ?? null,
    onAutoOpen: descriptor.onAutoOpen ?? null,
  });

  const mountedSurfaceElement =
    explorerDropSurfaceElementById.get(descriptor.surfaceId) ?? null;
  if (mountedSurfaceElement) {
    explorerDropSurfaceMetadataByElement.set(mountedSurfaceElement, nextMetadata);
    registerExplorerScopeRootSurface(
      descriptor.surfaceId,
      previousMetadata,
      nextMetadata,
    );
  }

  const existingBinding =
    explorerDropSurfaceBindingById.get(descriptor.surfaceId) ?? null;
  if (existingBinding) {
    existingBinding[EXPLORER_DROP_SCOPE_ATTRIBUTE] = descriptor.scopeId;
    existingBinding[EXPLORER_DROP_SURFACE_ROLE_ATTRIBUTE] = descriptor.role;
    existingBinding[EXPLORER_DROP_SURFACE_ID_ATTRIBUTE] = descriptor.surfaceId;
    if (normalizedTargetPath) {
      existingBinding[EXPLORER_DROP_TARGET_ATTRIBUTE] = normalizedTargetPath;
    } else {
      delete existingBinding[EXPLORER_DROP_TARGET_ATTRIBUTE];
    }
    if (descriptor.role === "scope-root" && normalizedRootPath) {
      existingBinding[EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE] =
        normalizedRootPath;
    } else {
      delete existingBinding[EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE];
    }
    return existingBinding;
  }

  const binding: ExplorerDropSurfaceBinding = {
    ref: (node) => {
      if (!node) {
        const removedMetadata =
          explorerDropSurfaceMetadataById.get(descriptor.surfaceId) ?? null;
        explorerDropSurfaceBehaviorById.delete(descriptor.surfaceId);
        explorerDropSurfaceElementById.delete(descriptor.surfaceId);
        explorerDropSurfaceMetadataById.delete(descriptor.surfaceId);
        registerExplorerScopeRootSurface(
          descriptor.surfaceId,
          removedMetadata,
          null,
        );
        explorerDropSurfaceBindingById.delete(descriptor.surfaceId);
        return;
      }
      const behavior =
        explorerDropSurfaceBehaviorById.get(descriptor.surfaceId) ?? {
          autoOpenDelayMs: descriptor.autoOpenDelayMs ?? null,
          label: descriptor.label ?? null,
          onAutoOpen: descriptor.onAutoOpen ?? null,
        };
      explorerDropSurfaceElementById.set(descriptor.surfaceId, node);
      explorerDropSurfaceBehaviorById.set(descriptor.surfaceId, behavior);
      explorerDropSurfaceBindingById.set(descriptor.surfaceId, binding);
      const metadata =
        explorerDropSurfaceMetadataById.get(descriptor.surfaceId) ?? nextMetadata;
      explorerDropSurfaceMetadataById.set(descriptor.surfaceId, metadata);
      explorerDropSurfaceMetadataByElement.set(node, metadata);
      registerExplorerScopeRootSurface(descriptor.surfaceId, null, metadata);
    },
    [EXPLORER_DROP_SCOPE_ATTRIBUTE]: descriptor.scopeId,
    [EXPLORER_DROP_SURFACE_ROLE_ATTRIBUTE]: descriptor.role,
    [EXPLORER_DROP_SURFACE_ID_ATTRIBUTE]: descriptor.surfaceId,
    ...(normalizedTargetPath
      ? { [EXPLORER_DROP_TARGET_ATTRIBUTE]: normalizedTargetPath }
      : {}),
    ...(descriptor.role === "scope-root" && normalizedRootPath
      ? { [EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE]: normalizedRootPath }
      : {}),
  };
  explorerDropSurfaceBindingById.set(descriptor.surfaceId, binding);
  return binding;
}

export function getExplorerDropBindingElementProps(
  binding: ExplorerDropSurfaceBinding | null | undefined,
): Partial<ExplorerDropSurfaceBinding> {
  if (!binding) {
    return {};
  }
  return {
    ref: binding.ref,
    [EXPLORER_DROP_SCOPE_ATTRIBUTE]: binding[EXPLORER_DROP_SCOPE_ATTRIBUTE],
    [EXPLORER_DROP_SURFACE_ROLE_ATTRIBUTE]:
      binding[EXPLORER_DROP_SURFACE_ROLE_ATTRIBUTE],
    [EXPLORER_DROP_SURFACE_ID_ATTRIBUTE]:
      binding[EXPLORER_DROP_SURFACE_ID_ATTRIBUTE],
    ...(binding[EXPLORER_DROP_TARGET_ATTRIBUTE]
      ? { [EXPLORER_DROP_TARGET_ATTRIBUTE]: binding[EXPLORER_DROP_TARGET_ATTRIBUTE] }
      : {}),
    ...(binding[EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE]
      ? {
          [EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE]:
            binding[EXPLORER_DROP_SCOPE_ROOT_PATH_ATTRIBUTE],
        }
      : {}),
  };
}

function buildExplorerDragSnapshot(args: {
  sourceKind: ExplorerDragSourceKind;
  sourceScopeId?: string | null;
  sourcePrimaryPath?: string | null;
  sourceItemKind?: ExplorerDragAvatarKind;
  sourceIconSrc?: string | null;
  sourceStackItems?: readonly ExplorerDragAvatarStackItem[];
  sourcePaths: readonly string[];
  operation: ExplorerDragOperation;
  primaryLabel?: string | null;
  pointer: {
    x: number;
    y: number;
  } | null;
  resolvedHit: ExplorerResolvedDropHit | null;
  validation: ExplorerDropValidation;
  externalWindowItemCount?: number;
}): ExplorerDragInteractionState {
  const nextPaths = stabilizeExplorerPaths(args.sourcePaths);
  const presentationTargetPoint = getExplorerDragPresentationTargetPoint(
    args.resolvedHit,
  );
  const phase: ExplorerDragVisualPhase = !args.pointer
    ? "lift"
    : args.resolvedHit
      ? args.validation.valid
        ? explorerDragInteractionState.dwellSurfaceId === args.resolvedHit.surfaceId &&
          explorerDragInteractionState.dwellDelayMs !== null
          ? "dwell-opening"
          : "dragging-valid"
        : "dragging-invalid"
      : "dragging-invalid";
  return {
    active: true,
    phase,
    sourceKind: args.sourceKind,
    sourceScopeId:
      args.sourceScopeId ?? explorerDragInteractionState.sourceScopeId,
    sourcePrimaryPath:
      args.sourcePrimaryPath ?? explorerDragInteractionState.sourcePrimaryPath,
    sourceItemKind:
      args.sourceItemKind ?? explorerDragInteractionState.sourceItemKind,
    sourceIconSrc: args.sourceIconSrc ?? explorerDragInteractionState.sourceIconSrc,
    sourceStackItems:
      args.sourceStackItems != null
        ? stabilizeExplorerDragAvatarStackItems(args.sourceStackItems)
        : explorerDragInteractionState.sourceStackItems,
    operation: args.operation,
    paths: nextPaths,
    itemCount: nextPaths.length,
    primaryLabel: args.primaryLabel ?? explorerDragInteractionState.primaryLabel,
    pointer: args.pointer,
    overlayPointer: args.pointer
      ? {
          x: args.pointer.x + EXPLORER_DRAG_OVERLAY_POINTER_OFFSET.x,
          y: args.pointer.y + EXPLORER_DRAG_OVERLAY_POINTER_OFFSET.y,
        }
      : null,
    scopeId: args.resolvedHit?.scopeId ?? null,
    targetPath: args.validation.valid
      ? args.resolvedHit?.targetPath ?? null
      : args.resolvedHit?.targetPath ?? null,
    targetKind: args.resolvedHit?.targetKind ?? null,
    targetSurfaceId: args.resolvedHit?.surfaceId ?? null,
    targetSurfaceRole: args.resolvedHit?.surfaceRole ?? null,
    presentationTargetPoint,
    valid: args.resolvedHit ? args.validation.valid : false,
    invalidReason: args.resolvedHit ? args.validation.reason : null,
    externalWindowItemCount: args.externalWindowItemCount ?? 0,
    dwellSurfaceId: explorerDragInteractionState.dwellSurfaceId,
    dwellTargetPath: explorerDragInteractionState.dwellTargetPath,
    dwellProgress: explorerDragInteractionState.dwellProgress,
    dwellDelayMs: explorerDragInteractionState.dwellDelayMs,
    dwellLabel: explorerDragInteractionState.dwellLabel,
  };
}

export function beginExplorerDragInteraction(args: {
  sourceKind: ExplorerDragSourceKind;
  sourceScopeId?: string | null;
  sourcePrimaryPath?: string | null;
  sourceItemKind?: ExplorerDragAvatarKind;
  sourceIconSrc?: string | null;
  sourceStackItems?: readonly ExplorerDragAvatarStackItem[];
  sourcePaths: readonly string[];
  operation: ExplorerDragOperation;
  primaryLabel?: string | null;
  externalWindowItemCount?: number;
}): void {
  clearExplorerDragPresentationTimer();
  setExplorerDragInteractionState((currentState) => ({
    ...currentState,
    active: true,
    phase: "lift",
    sourceKind: args.sourceKind,
    sourceScopeId: args.sourceScopeId ?? currentState.sourceScopeId,
    sourcePrimaryPath: args.sourcePrimaryPath ?? currentState.sourcePrimaryPath,
    sourceItemKind: args.sourceItemKind ?? currentState.sourceItemKind,
    sourceIconSrc: args.sourceIconSrc ?? currentState.sourceIconSrc,
    sourceStackItems:
      args.sourceStackItems != null
        ? stabilizeExplorerDragAvatarStackItems(args.sourceStackItems)
        : currentState.sourceStackItems,
    operation: args.operation,
    paths: stabilizeExplorerPaths(args.sourcePaths),
    itemCount: args.sourcePaths.length,
    primaryLabel: args.primaryLabel ?? currentState.primaryLabel,
    externalWindowItemCount: args.externalWindowItemCount ?? 0,
  }));
}

export function updateExplorerDragInteractionFromPoint(args: {
  pointer: ExplorerDropPointerLike;
  sourceKind: ExplorerDragSourceKind;
  sourceScopeId?: string | null;
  sourcePrimaryPath?: string | null;
  sourceItemKind?: ExplorerDragAvatarKind;
  sourceIconSrc?: string | null;
  sourceStackItems?: readonly ExplorerDragAvatarStackItem[];
  sourcePaths: readonly string[];
  operation: ExplorerDragOperation;
  platform: RuntimePlatform;
  scaleFactor?: number;
  primaryLabel?: string | null;
  externalWindowItemCount?: number;
}): ExplorerResolvedDropHit | null {
  const scaleFactor = args.scaleFactor ?? 1;
  const point = normalizeExplorerDropPoint(args.pointer, scaleFactor);
  const resolvedHit = resolveExplorerDropHitFromPoint(args.pointer, scaleFactor);
  const validation =
    resolvedHit && args.sourcePaths.length > 0
      ? validateExplorerDropTarget({
          sourcePaths: args.sourcePaths,
          targetPath: resolvedHit.targetPath,
          platform: args.platform,
        })
      : { valid: false, reason: null };

  setExplorerDragInteractionState(
    buildExplorerDragSnapshot({
      sourceKind: args.sourceKind,
      sourceScopeId: args.sourceScopeId,
      sourcePrimaryPath: args.sourcePrimaryPath,
      sourceItemKind: args.sourceItemKind,
      sourceIconSrc: args.sourceIconSrc,
      sourceStackItems: args.sourceStackItems,
      sourcePaths: args.sourcePaths,
      operation: args.operation,
      primaryLabel: args.primaryLabel,
      pointer: point,
      resolvedHit,
      validation,
      externalWindowItemCount: args.externalWindowItemCount,
    }),
  );

  if (resolvedHit && validation.valid) {
    scheduleExplorerDragAutoOpen(resolvedHit);
  } else {
    scheduleExplorerDragAutoOpen(null);
  }

  return resolvedHit;
}

export function updateExplorerDragInteractionFromResolvedHit(args: {
  resolvedHit: ExplorerResolvedDropHit | null;
  sourceKind: ExplorerDragSourceKind;
  sourceScopeId?: string | null;
  sourcePrimaryPath?: string | null;
  sourceItemKind?: ExplorerDragAvatarKind;
  sourceIconSrc?: string | null;
  sourceStackItems?: readonly ExplorerDragAvatarStackItem[];
  sourcePaths: readonly string[];
  operation: ExplorerDragOperation;
  platform: RuntimePlatform;
  primaryLabel?: string | null;
  externalWindowItemCount?: number;
  pointer?: {
    x: number;
    y: number;
  } | null;
}): ExplorerResolvedDropHit | null {
  const validation =
    args.resolvedHit && args.sourcePaths.length > 0
      ? validateExplorerDropTarget({
          sourcePaths: args.sourcePaths,
          targetPath: args.resolvedHit.targetPath,
          platform: args.platform,
        })
      : { valid: false, reason: null };

  setExplorerDragInteractionState(
    buildExplorerDragSnapshot({
      sourceKind: args.sourceKind,
      sourceScopeId: args.sourceScopeId,
      sourcePrimaryPath: args.sourcePrimaryPath,
      sourceItemKind: args.sourceItemKind,
      sourceIconSrc: args.sourceIconSrc,
      sourceStackItems: args.sourceStackItems,
      sourcePaths: args.sourcePaths,
      operation: args.operation,
      primaryLabel: args.primaryLabel,
      pointer: args.pointer ?? args.resolvedHit?.point ?? null,
      resolvedHit: args.resolvedHit,
      validation,
      externalWindowItemCount: args.externalWindowItemCount,
    }),
  );

  if (args.resolvedHit && validation.valid) {
    scheduleExplorerDragAutoOpen(args.resolvedHit);
  } else {
    scheduleExplorerDragAutoOpen(null);
  }

  return args.resolvedHit;
}

export function clearExplorerDragInteractionTarget(): void {
  clearExplorerResolvedDropHitCache();
  scheduleExplorerDragAutoOpen(null);
  setExplorerDragInteractionState((currentState) => ({
    ...currentState,
    phase:
      currentState.phase === "dropping" || currentState.phase === "cancelled"
        ? currentState.phase
        : currentState.active
          ? "dragging-invalid"
          : "idle",
    scopeId: null,
    targetPath: null,
    targetKind: null,
    targetSurfaceId: null,
    targetSurfaceRole: null,
    presentationTargetPoint: null,
    valid: false,
    invalidReason: null,
    dwellSurfaceId: null,
    dwellTargetPath: null,
    dwellProgress: 0,
    dwellDelayMs: null,
    dwellLabel: null,
  }));
}

export function finishExplorerDragInteractionPresentation(args: {
  phase: "dropping" | "cancelled";
  durationMs?: number;
  presentationTargetPoint?: {
    x: number;
    y: number;
  } | null;
}): void {
  clearExplorerResolvedDropHitCache();
  clearExplorerDragAutoOpenState();
  clearExplorerDragPresentationTimer();
  setExplorerDragInteractionState((currentState) => {
    if (!currentState.active) {
      return currentState;
    }
    return {
      ...currentState,
      phase: args.phase,
      presentationTargetPoint:
        args.presentationTargetPoint ?? currentState.presentationTargetPoint,
    };
  });

  const fallbackDuration =
    args.phase === "dropping"
      ? EXPLORER_DRAG_DROP_BURST_DURATION_MS
      : EXPLORER_DRAG_CANCEL_BURST_DURATION_MS;
  const durationMs =
    Number.isFinite(args.durationMs) && args.durationMs && args.durationMs > 0
      ? Math.floor(args.durationMs)
      : fallbackDuration;
  explorerDragPresentationTimer = setTimeout(() => {
    explorerDragPresentationTimer = null;
    setExplorerDragInteractionState(createEmptyExplorerDragInteractionState());
  }, durationMs);
}

export function endExplorerDragInteraction(): void {
  clearExplorerResolvedDropHitCache();
  clearExplorerCachedElementRects();
  scheduleExplorerDragAutoOpen(null);
  clearExplorerDragPresentationTimer();
  setExplorerDragInteractionState(createEmptyExplorerDragInteractionState());
}

export function getExplorerDragInteractionState(): ExplorerDragInteractionState {
  return explorerDragInteractionState;
}

export function subscribeToExplorerDragInteraction(
  listener: () => void,
): () => void {
  explorerDragInteractionListeners.add(listener);
  return () => {
    explorerDragInteractionListeners.delete(listener);
  };
}

export function useExplorerDragInteractionSelector<T>(
  selector: (state: ExplorerDragInteractionState) => T,
  isEqual: (left: T, right: T) => boolean = Object.is,
): T {
  const selectedValueRef = useRef(selector(getExplorerDragInteractionState()));
  return useSyncExternalStore(
    subscribeToExplorerDragInteraction,
    () => {
      const nextSelectedValue = selector(getExplorerDragInteractionState());
      if (!isEqual(selectedValueRef.current, nextSelectedValue)) {
        selectedValueRef.current = nextSelectedValue;
      }
      return selectedValueRef.current;
    },
    () => selectedValueRef.current,
  );
}

export function shallowEqualExplorerDragSelection<
  T extends Record<string, unknown>,
>(left: T, right: T): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) {
    return false;
  }
  return leftEntries.every(([key, value]) => Object.is(value, right[key]));
}
