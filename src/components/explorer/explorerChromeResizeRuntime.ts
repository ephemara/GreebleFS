import type {
  ExplorerChromeControlId,
  ExplorerChromeSizeVariant,
} from "../../config/explorerChromeLayouts";

type ExplorerChromeResizePoint = {
  x: number;
  y: number;
};

type ExplorerChromeResizeKind = "width-px" | "size-variant";

interface ExplorerChromeResizeSession {
  pointerId: number;
  controlId: ExplorerChromeControlId;
  kind: ExplorerChromeResizeKind;
  startPoint: ExplorerChromeResizePoint;
  initialWidthPx: number | null;
  minWidthPx: number;
  maxWidthPx: number;
  initialSizeVariant: ExplorerChromeSizeVariant;
  sizeVariants: ExplorerChromeSizeVariant[];
  active: boolean;
  onActivate?: (() => void) | null;
  onWidthChange?: ((widthPx: number) => void) | null;
  onSizeVariantChange?:
    | ((sizeVariant: ExplorerChromeSizeVariant) => void)
    | null;
  onComplete?: (() => void) | null;
}

export interface BeginExplorerChromeResizeSessionArgs {
  pointerId: number;
  controlId: ExplorerChromeControlId;
  startPoint: ExplorerChromeResizePoint;
  kind: ExplorerChromeResizeKind;
  initialWidthPx?: number | null;
  minWidthPx?: number | null;
  maxWidthPx?: number | null;
  initialSizeVariant?: ExplorerChromeSizeVariant | null;
  sizeVariants?: ExplorerChromeSizeVariant[] | null;
  onActivate?: (() => void) | null;
  onWidthChange?: ((widthPx: number) => void) | null;
  onSizeVariantChange?:
    | ((sizeVariant: ExplorerChromeSizeVariant) => void)
    | null;
  onComplete?: (() => void) | null;
}

const EXPLORER_CHROME_RESIZE_VARIANT_STEP_PX = 64;

let activeExplorerChromeResizeSession: ExplorerChromeResizeSession | null = null;
let resizeWindowListenersAttached = false;
let savedBodyUserSelect: string | null = null;
let savedBodyCursor: string | null = null;

function attachBodyResizeState(): void {
  if (typeof document === "undefined") {
    return;
  }

  const { body } = document;
  if (!body) {
    return;
  }

  if (savedBodyUserSelect === null) {
    savedBodyUserSelect = body.style.userSelect;
  }
  if (savedBodyCursor === null) {
    savedBodyCursor = body.style.cursor;
  }

  body.style.userSelect = "none";
  body.style.cursor = "ew-resize";
}

function restoreBodyResizeState(): void {
  if (typeof document === "undefined") {
    savedBodyUserSelect = null;
    savedBodyCursor = null;
    return;
  }

  const { body } = document;
  if (!body) {
    savedBodyUserSelect = null;
    savedBodyCursor = null;
    return;
  }

  if (savedBodyUserSelect !== null) {
    body.style.userSelect = savedBodyUserSelect;
  } else {
    body.style.removeProperty("user-select");
  }
  if (savedBodyCursor !== null) {
    body.style.cursor = savedBodyCursor;
  } else {
    body.style.removeProperty("cursor");
  }

  savedBodyUserSelect = null;
  savedBodyCursor = null;
}

function clampWidthPx(value: number, minWidthPx: number, maxWidthPx: number): number {
  return Math.max(minWidthPx, Math.min(maxWidthPx, Math.round(value)));
}

function resolveSizeVariantFromDelta(
  session: ExplorerChromeResizeSession,
  deltaX: number,
): ExplorerChromeSizeVariant {
  const variantCount = session.sizeVariants.length;
  if (variantCount <= 1) {
    return session.initialSizeVariant;
  }

  const initialVariantIndex = Math.max(
    0,
    session.sizeVariants.indexOf(session.initialSizeVariant),
  );
  const rawOffset = Math.round(deltaX / EXPLORER_CHROME_RESIZE_VARIANT_STEP_PX);
  const nextIndex = Math.max(
    0,
    Math.min(variantCount - 1, initialVariantIndex + rawOffset),
  );
  return session.sizeVariants[nextIndex] ?? session.initialSizeVariant;
}

function completeExplorerChromeResizeSession(): void {
  const session = activeExplorerChromeResizeSession;
  activeExplorerChromeResizeSession = null;
  restoreBodyResizeState();
  if (session?.onComplete) {
    session.onComplete();
  }
}

function handleExplorerChromeResizePointerMove(event: PointerEvent): void {
  const session = activeExplorerChromeResizeSession;
  if (!session || event.pointerId !== session.pointerId) {
    return;
  }

  event.preventDefault();

  if (!session.active) {
    session.active = true;
    session.onActivate?.();
  }

  const deltaX = event.clientX - session.startPoint.x;
  if (session.kind === "width-px") {
    const nextWidthPx = clampWidthPx(
      (session.initialWidthPx ?? session.minWidthPx) + deltaX,
      session.minWidthPx,
      session.maxWidthPx,
    );
    session.onWidthChange?.(nextWidthPx);
    return;
  }

  const nextSizeVariant = resolveSizeVariantFromDelta(session, deltaX);
  session.onSizeVariantChange?.(nextSizeVariant);
}

function handleExplorerChromeResizePointerUp(event: PointerEvent): void {
  if (
    !activeExplorerChromeResizeSession ||
    event.pointerId !== activeExplorerChromeResizeSession.pointerId
  ) {
    return;
  }
  completeExplorerChromeResizeSession();
}

function handleExplorerChromeResizePointerCancel(event: PointerEvent): void {
  if (
    !activeExplorerChromeResizeSession ||
    event.pointerId !== activeExplorerChromeResizeSession.pointerId
  ) {
    return;
  }
  completeExplorerChromeResizeSession();
}

function handleExplorerChromeResizeWindowBlur(): void {
  if (!activeExplorerChromeResizeSession) {
    return;
  }
  completeExplorerChromeResizeSession();
}

function handleExplorerChromeResizeEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !activeExplorerChromeResizeSession) {
    return;
  }
  event.preventDefault();
  completeExplorerChromeResizeSession();
}

function ensureResizeWindowListeners(): void {
  if (resizeWindowListenersAttached || typeof window === "undefined") {
    return;
  }
  window.addEventListener("pointermove", handleExplorerChromeResizePointerMove, {
    passive: false,
  });
  window.addEventListener("pointerup", handleExplorerChromeResizePointerUp);
  window.addEventListener("pointercancel", handleExplorerChromeResizePointerCancel);
  window.addEventListener("blur", handleExplorerChromeResizeWindowBlur);
  window.addEventListener("keydown", handleExplorerChromeResizeEscape);
  resizeWindowListenersAttached = true;
}

export function beginExplorerChromeResizeSession(
  args: BeginExplorerChromeResizeSessionArgs,
): void {
  cancelExplorerChromeResizeSession();
  ensureResizeWindowListeners();
  attachBodyResizeState();

  activeExplorerChromeResizeSession = {
    pointerId: args.pointerId,
    controlId: args.controlId,
    kind: args.kind,
    startPoint: args.startPoint,
    initialWidthPx: args.initialWidthPx ?? null,
    minWidthPx: args.minWidthPx ?? 96,
    maxWidthPx: args.maxWidthPx ?? 1600,
    initialSizeVariant: args.initialSizeVariant ?? "regular",
    sizeVariants:
      args.sizeVariants?.length && args.sizeVariants.length > 0
        ? [...args.sizeVariants]
        : ["compact", "regular", "wide"],
    active: false,
    onActivate: args.onActivate,
    onWidthChange: args.onWidthChange,
    onSizeVariantChange: args.onSizeVariantChange,
    onComplete: args.onComplete,
  };
}

export function cancelExplorerChromeResizeSession(): void {
  if (!activeExplorerChromeResizeSession) {
    restoreBodyResizeState();
    return;
  }
  completeExplorerChromeResizeSession();
}
