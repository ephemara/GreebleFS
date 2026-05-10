import shippedExplorerDragEngineManifestJson from "../../usr/profiles/default/explorer-drag-engines/greeblefs-core/explorer-drag-engine.json";

export type ExplorerDropSurfaceRole =
  | "scope-root"
  | "directory-target"
  | "navigation-target"
  | "non-target-chrome";

export type ExplorerResolvedDropSurfaceKind =
  | "scope-root"
  | "directory"
  | "navigation";

export type ExplorerDragModifierKey = "alt" | "ctrl" | "shift" | "meta";
export type ExplorerDragHitTestMode = "registered-rects" | "element-from-point";
export type ExplorerDragOverlayRenderer =
  | "css-transform"
  | "framer-spring"
  | "none";
export type ExplorerDragStatePublishMode = "on-change" | "every-frame";
export type ExplorerDragIntentMode = "internal" | "native-out";
export type ExplorerDragPlatformKey = "windows" | "macos" | "linux";
export type ExplorerDragEngineSourceKind =
  | "built-in"
  | "usr-shipped-package"
  | "usr-user-package"
  | "kain-lattice";

export interface ExplorerDragSpringPolicy {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface ExplorerDragPointerPolicy {
  startDistancePx: number;
  coalesceWithRaf: boolean;
  hitTestMode: ExplorerDragHitTestMode;
  statePublish: ExplorerDragStatePublishMode;
  sharedSessionLingerMs: number;
}

export interface ExplorerDragIntentPolicy {
  plainDrag: ExplorerDragIntentMode;
  nativeOutModifier: ExplorerDragModifierKey;
  copyModifierByPlatform: Record<ExplorerDragPlatformKey, ExplorerDragModifierKey>;
}

export interface ExplorerDragDropTargetsPolicy {
  surfacePriority: Record<ExplorerDropSurfaceRole, number>;
  directoryAutoOpenDelayMs: number;
  navigationAutoOpenDelayMs: number;
  tabAutoOpenDelayMs: number;
}

export interface ExplorerDragAutoscrollPolicy {
  enabled: boolean;
  edgePx: number;
  outsetPx: number;
  minSpeedPxPerSecond: number;
  maxSpeedPxPerSecond: number;
}

export interface ExplorerDragPresentationPolicy {
  overlayRenderer: ExplorerDragOverlayRenderer;
  pointerOffset: { x: number; y: number };
  maxStackDepth: number;
  spring: ExplorerDragSpringPolicy;
  rotationSpring: ExplorerDragSpringPolicy;
  tiltFactor: number;
  maxTiltDegrees: number;
  sourceGhostOpacity: number;
  sourceGhostScale: number;
  targetHighlightScale: number;
  targetHighlightOpacity: number;
  dwellIndicatorHeightPx: number;
  folderInhaleScale: number;
  folderDwellScale: number;
  folderInhaleLiftPx: number;
  folderDwellLiftPx: number;
  dropBurstDurationMs: number;
  cancelBurstDurationMs: number;
  glassBlurEnabled: boolean;
  heavyShadowEnabled: boolean;
  overlayRadiusPx: number;
}

export interface ExplorerDragEngineControlValues {
  pointerStartDistancePx?: number;
  dwellDelayScale?: number;
  autoscrollSpeedScale?: number;
  overlayWeight?: number;
  targetMagnetism?: number;
  nativeOutModifier?: ExplorerDragModifierKey;
}

export interface ExplorerDragEngineDefinition {
  id: string;
  name: string;
  description: string;
  sourceKind: ExplorerDragEngineSourceKind;
  sourcePath: string;
  tags: string[];
  pointer: ExplorerDragPointerPolicy;
  intent: ExplorerDragIntentPolicy;
  dropTargets: ExplorerDragDropTargetsPolicy;
  autoscroll: ExplorerDragAutoscrollPolicy;
  presentation: ExplorerDragPresentationPolicy;
  controls: ExplorerDragEngineControlValues;
}

export type ResolvedExplorerDragEngine = ExplorerDragEngineDefinition;

export interface ExplorerDragEngineManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  defaultEngineId?: string;
  engines?: unknown[];
}

export interface LoadedExplorerDragEngineCatalog {
  version: number;
  id: string;
  name: string;
  description: string;
  defaultEngineId: string;
  engines: ResolvedExplorerDragEngine[];
  warnings: string[];
}

const dragSurfaceRoleOrder = [
  "scope-root",
  "non-target-chrome",
  "navigation-target",
  "directory-target",
] as const satisfies readonly ExplorerDropSurfaceRole[];

const explorerDragModifierKeys = [
  "alt",
  "ctrl",
  "shift",
  "meta",
] as const satisfies readonly ExplorerDragModifierKey[];

const fallbackPerformanceDragEngine: ResolvedExplorerDragEngine = Object.freeze({
  id: "performance",
  name: "Performance",
  description: "Lean registered-surface hit testing and CSS transforms for low-latency Explorer drags.",
  sourceKind: "built-in",
  sourcePath: "src/config/explorerDragEngines.ts",
  tags: ["default", "fast", "css"],
  pointer: Object.freeze({
    startDistancePx: 6,
    coalesceWithRaf: true,
    hitTestMode: "registered-rects",
    statePublish: "on-change",
    sharedSessionLingerMs: 1500,
  }),
  intent: Object.freeze({
    plainDrag: "internal",
    nativeOutModifier: "alt",
    copyModifierByPlatform: Object.freeze({
      windows: "ctrl",
      linux: "ctrl",
      macos: "alt",
    }),
  }),
  dropTargets: Object.freeze({
    surfacePriority: Object.freeze({
      "scope-root": 0,
      "non-target-chrome": 0,
      "navigation-target": 1,
      "directory-target": 2,
    }),
    directoryAutoOpenDelayMs: 950,
    navigationAutoOpenDelayMs: 900,
    tabAutoOpenDelayMs: 1050,
  }),
  autoscroll: Object.freeze({
    enabled: true,
    edgePx: 88,
    outsetPx: 24,
    minSpeedPxPerSecond: 220,
    maxSpeedPxPerSecond: 1680,
  }),
  presentation: Object.freeze({
    overlayRenderer: "css-transform",
    pointerOffset: Object.freeze({ x: 18, y: 20 }),
    maxStackDepth: 1,
    spring: Object.freeze({ stiffness: 420, damping: 34, mass: 0.42 }),
    rotationSpring: Object.freeze({ stiffness: 320, damping: 26, mass: 0.3 }),
    tiltFactor: 0.04,
    maxTiltDegrees: 3,
    sourceGhostOpacity: 0.24,
    sourceGhostScale: 0.985,
    targetHighlightScale: 1.018,
    targetHighlightOpacity: 0.92,
    dwellIndicatorHeightPx: 2,
    folderInhaleScale: 1.025,
    folderDwellScale: 1.045,
    folderInhaleLiftPx: 1,
    folderDwellLiftPx: 3,
    dropBurstDurationMs: 120,
    cancelBurstDurationMs: 90,
    glassBlurEnabled: false,
    heavyShadowEnabled: false,
    overlayRadiusPx: 12,
  }),
  controls: Object.freeze({
    pointerStartDistancePx: 6,
    dwellDelayScale: 1,
    autoscrollSpeedScale: 1,
    overlayWeight: 0.25,
    targetMagnetism: 0.55,
    nativeOutModifier: "alt",
  }),
});

let activeExplorerDragEngineCatalog = normalizeExplorerDragEngineManifest(
  shippedExplorerDragEngineManifestJson as ExplorerDragEngineManifest,
);

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asStringArray(value: unknown, fallback: readonly string[] = []): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function clampNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const source = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(maximum, Math.max(minimum, source));
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return Math.round(clampNumber(value, fallback, minimum, maximum));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeModifier(value: unknown, fallback: ExplorerDragModifierKey): ExplorerDragModifierKey {
  return explorerDragModifierKeys.includes(value as ExplorerDragModifierKey)
    ? (value as ExplorerDragModifierKey)
    : fallback;
}

function normalizeHitTestMode(value: unknown, fallback: ExplorerDragHitTestMode): ExplorerDragHitTestMode {
  return value === "element-from-point" || value === "registered-rects"
    ? value
    : fallback;
}

function normalizeOverlayRenderer(value: unknown, fallback: ExplorerDragOverlayRenderer): ExplorerDragOverlayRenderer {
  return value === "framer-spring" || value === "none" || value === "css-transform"
    ? value
    : fallback;
}

function normalizeStatePublishMode(value: unknown, fallback: ExplorerDragStatePublishMode): ExplorerDragStatePublishMode {
  return value === "every-frame" ? "every-frame" : fallback;
}

function normalizePlainDragIntent(value: unknown, fallback: ExplorerDragIntentMode): ExplorerDragIntentMode {
  return value === "native-out" ? "native-out" : fallback;
}

function normalizeSpringPolicy(value: unknown, fallback: ExplorerDragSpringPolicy): ExplorerDragSpringPolicy {
  const source = asObject(value) ?? {};
  return {
    stiffness: clampNumber(source.stiffness, fallback.stiffness, 40, 1200),
    damping: clampNumber(source.damping, fallback.damping, 4, 120),
    mass: clampNumber(source.mass, fallback.mass, 0.05, 4),
  };
}

function normalizeCopyModifierByPlatform(
  value: unknown,
  fallback: Record<ExplorerDragPlatformKey, ExplorerDragModifierKey>,
): Record<ExplorerDragPlatformKey, ExplorerDragModifierKey> {
  const source = asObject(value) ?? {};
  return {
    windows: normalizeModifier(source.windows, fallback.windows),
    linux: normalizeModifier(source.linux, fallback.linux),
    macos: normalizeModifier(source.macos, fallback.macos),
  };
}

function normalizeSurfacePriority(
  value: unknown,
  fallback: Record<ExplorerDropSurfaceRole, number>,
): Record<ExplorerDropSurfaceRole, number> {
  const source = asObject(value) ?? {};
  return Object.fromEntries(
    dragSurfaceRoleOrder.map((role) => [
      role,
      clampInteger(source[role], fallback[role] ?? 0, -10, 10),
    ]),
  ) as Record<ExplorerDropSurfaceRole, number>;
}

export function normalizeExplorerDragEngineSelectionId(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeExplorerDragEngineControlValues(value: unknown): ExplorerDragEngineControlValues {
  const source = asObject(value) ?? {};
  return {
    pointerStartDistancePx: clampInteger(
      source.pointerStartDistancePx,
      fallbackPerformanceDragEngine.controls.pointerStartDistancePx ?? 6,
      1,
      24,
    ),
    dwellDelayScale: clampNumber(source.dwellDelayScale, 1, 0.25, 2.5),
    autoscrollSpeedScale: clampNumber(source.autoscrollSpeedScale, 1, 0.25, 2.5),
    overlayWeight: clampNumber(source.overlayWeight, 0.25, 0, 1),
    targetMagnetism: clampNumber(source.targetMagnetism, 0.55, 0, 1),
    nativeOutModifier: normalizeModifier(
      source.nativeOutModifier,
      fallbackPerformanceDragEngine.intent.nativeOutModifier,
    ),
  };
}

export function normalizeExplorerDragEngineControlValueMap(
  value: unknown,
): Record<string, ExplorerDragEngineControlValues> {
  const source = asObject(value);
  if (!source) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(source)
      .map(([engineId, controls]) => {
        const normalizedEngineId = engineId.trim();
        if (!normalizedEngineId) {
          return null;
        }
        return [
          normalizedEngineId,
          normalizeExplorerDragEngineControlValues(controls),
        ] as const;
      })
      .filter(
        (entry): entry is readonly [string, ExplorerDragEngineControlValues] =>
          entry != null,
      ),
  );
}

function normalizeExplorerDragEngineDefinition(
  value: unknown,
  fallback: ResolvedExplorerDragEngine,
  sourcePath: string,
): ResolvedExplorerDragEngine | null {
  const wrapper = asObject(value);
  if (!wrapper) {
    return null;
  }
  const engine = asObject(wrapper.engine) ?? wrapper;
  const id = asString(wrapper.id ?? engine.id, "");
  if (!id) {
    return null;
  }
  const pointer = asObject(engine.pointer) ?? {};
  const intent = asObject(engine.intent) ?? {};
  const dropTargets = asObject(engine.dropTargets) ?? {};
  const autoscroll = asObject(engine.autoscroll) ?? {};
  const presentation = asObject(engine.presentation) ?? {};

  return {
    id,
    name: asString(wrapper.name ?? engine.name, fallback.name),
    description: asString(
      wrapper.description ?? engine.description,
      fallback.description,
    ),
    sourceKind: asString(
      wrapper.sourceKind ?? engine.sourceKind,
      fallback.sourceKind,
    ) as ExplorerDragEngineSourceKind,
    sourcePath: asString(wrapper.sourcePath ?? engine.sourcePath, sourcePath),
    tags: asStringArray(wrapper.tags ?? engine.tags, fallback.tags),
    pointer: {
      startDistancePx: clampInteger(
        pointer.startDistancePx,
        fallback.pointer.startDistancePx,
        1,
        24,
      ),
      coalesceWithRaf: asBoolean(
        pointer.coalesceWithRaf,
        fallback.pointer.coalesceWithRaf,
      ),
      hitTestMode: normalizeHitTestMode(
        pointer.hitTestMode,
        fallback.pointer.hitTestMode,
      ),
      statePublish: normalizeStatePublishMode(
        pointer.statePublish,
        fallback.pointer.statePublish,
      ),
      sharedSessionLingerMs: clampInteger(
        pointer.sharedSessionLingerMs,
        fallback.pointer.sharedSessionLingerMs,
        0,
        8000,
      ),
    },
    intent: {
      plainDrag: normalizePlainDragIntent(
        intent.plainDrag,
        fallback.intent.plainDrag,
      ),
      nativeOutModifier: normalizeModifier(
        intent.nativeOutModifier,
        fallback.intent.nativeOutModifier,
      ),
      copyModifierByPlatform: normalizeCopyModifierByPlatform(
        intent.copyModifierByPlatform,
        fallback.intent.copyModifierByPlatform,
      ),
    },
    dropTargets: {
      surfacePriority: normalizeSurfacePriority(
        dropTargets.surfacePriority,
        fallback.dropTargets.surfacePriority,
      ),
      directoryAutoOpenDelayMs: clampInteger(
        dropTargets.directoryAutoOpenDelayMs,
        fallback.dropTargets.directoryAutoOpenDelayMs,
        0,
        5000,
      ),
      navigationAutoOpenDelayMs: clampInteger(
        dropTargets.navigationAutoOpenDelayMs,
        fallback.dropTargets.navigationAutoOpenDelayMs,
        0,
        5000,
      ),
      tabAutoOpenDelayMs: clampInteger(
        dropTargets.tabAutoOpenDelayMs,
        fallback.dropTargets.tabAutoOpenDelayMs,
        0,
        5000,
      ),
    },
    autoscroll: {
      enabled: asBoolean(autoscroll.enabled, fallback.autoscroll.enabled),
      edgePx: clampInteger(autoscroll.edgePx, fallback.autoscroll.edgePx, 16, 220),
      outsetPx: clampInteger(autoscroll.outsetPx, fallback.autoscroll.outsetPx, 0, 160),
      minSpeedPxPerSecond: clampInteger(
        autoscroll.minSpeedPxPerSecond,
        fallback.autoscroll.minSpeedPxPerSecond,
        20,
        4000,
      ),
      maxSpeedPxPerSecond: clampInteger(
        autoscroll.maxSpeedPxPerSecond,
        fallback.autoscroll.maxSpeedPxPerSecond,
        40,
        6000,
      ),
    },
    presentation: {
      overlayRenderer: normalizeOverlayRenderer(
        presentation.overlayRenderer,
        fallback.presentation.overlayRenderer,
      ),
      pointerOffset: {
        x: clampInteger(
          asObject(presentation.pointerOffset)?.x,
          fallback.presentation.pointerOffset.x,
          -80,
          120,
        ),
        y: clampInteger(
          asObject(presentation.pointerOffset)?.y,
          fallback.presentation.pointerOffset.y,
          -80,
          120,
        ),
      },
      maxStackDepth: clampInteger(
        presentation.maxStackDepth,
        fallback.presentation.maxStackDepth,
        1,
        8,
      ),
      spring: normalizeSpringPolicy(presentation.spring, fallback.presentation.spring),
      rotationSpring: normalizeSpringPolicy(
        presentation.rotationSpring,
        fallback.presentation.rotationSpring,
      ),
      tiltFactor: clampNumber(
        presentation.tiltFactor,
        fallback.presentation.tiltFactor,
        0,
        0.5,
      ),
      maxTiltDegrees: clampNumber(
        presentation.maxTiltDegrees,
        fallback.presentation.maxTiltDegrees,
        0,
        18,
      ),
      sourceGhostOpacity: clampNumber(
        presentation.sourceGhostOpacity,
        fallback.presentation.sourceGhostOpacity,
        0,
        1,
      ),
      sourceGhostScale: clampNumber(
        presentation.sourceGhostScale,
        fallback.presentation.sourceGhostScale,
        0.5,
        1.2,
      ),
      targetHighlightScale: clampNumber(
        presentation.targetHighlightScale,
        fallback.presentation.targetHighlightScale,
        1,
        1.18,
      ),
      targetHighlightOpacity: clampNumber(
        presentation.targetHighlightOpacity,
        fallback.presentation.targetHighlightOpacity,
        0,
        1,
      ),
      dwellIndicatorHeightPx: clampInteger(
        presentation.dwellIndicatorHeightPx,
        fallback.presentation.dwellIndicatorHeightPx,
        1,
        10,
      ),
      folderInhaleScale: clampNumber(
        presentation.folderInhaleScale,
        fallback.presentation.folderInhaleScale,
        1,
        1.18,
      ),
      folderDwellScale: clampNumber(
        presentation.folderDwellScale,
        fallback.presentation.folderDwellScale,
        1,
        1.24,
      ),
      folderInhaleLiftPx: clampInteger(
        presentation.folderInhaleLiftPx,
        fallback.presentation.folderInhaleLiftPx,
        0,
        24,
      ),
      folderDwellLiftPx: clampInteger(
        presentation.folderDwellLiftPx,
        fallback.presentation.folderDwellLiftPx,
        0,
        32,
      ),
      dropBurstDurationMs: clampInteger(
        presentation.dropBurstDurationMs,
        fallback.presentation.dropBurstDurationMs,
        0,
        1000,
      ),
      cancelBurstDurationMs: clampInteger(
        presentation.cancelBurstDurationMs,
        fallback.presentation.cancelBurstDurationMs,
        0,
        1000,
      ),
      glassBlurEnabled: asBoolean(
        presentation.glassBlurEnabled,
        fallback.presentation.glassBlurEnabled,
      ),
      heavyShadowEnabled: asBoolean(
        presentation.heavyShadowEnabled,
        fallback.presentation.heavyShadowEnabled,
      ),
      overlayRadiusPx: clampInteger(
        presentation.overlayRadiusPx,
        fallback.presentation.overlayRadiusPx,
        4,
        32,
      ),
    },
    controls: normalizeExplorerDragEngineControlValues(
      wrapper.controls ?? engine.controls ?? fallback.controls,
    ),
  };
}

function normalizeExplorerDragEngineManifest(
  manifest: ExplorerDragEngineManifest | null | undefined,
): LoadedExplorerDragEngineCatalog {
  const source = asObject(manifest) ?? {};
  const manifestSourcePath = asString(
    source.sourcePath,
    "usr/profiles/default/explorer-drag-engines/greeblefs-core/explorer-drag-engine.json",
  );
  const warnings: string[] = [];
  const engines = Array.isArray(source.engines)
    ? source.engines
        .map((entry) =>
          normalizeExplorerDragEngineDefinition(
            entry,
            fallbackPerformanceDragEngine,
            manifestSourcePath,
          ),
        )
        .filter((entry): entry is ResolvedExplorerDragEngine => entry != null)
    : [];
  if (engines.length === 0) {
    warnings.push("Explorer drag engine manifest did not contain usable engines; using the built-in performance engine.");
    engines.push(fallbackPerformanceDragEngine);
  }
  const defaultEngineId = asString(source.defaultEngineId, engines[0]?.id ?? fallbackPerformanceDragEngine.id);
  const hasDefault = engines.some((engine) => engine.id === defaultEngineId);
  return {
    version: clampInteger(source.version, 1, 1, 99),
    id: asString(source.id, "greeblefs-core-drag-engines"),
    name: asString(source.name, "Explorer Drag Engines"),
    description: asString(source.description, "Explorer drag/drop engine policy catalog."),
    defaultEngineId: hasDefault ? defaultEngineId : engines[0]?.id ?? fallbackPerformanceDragEngine.id,
    engines,
    warnings,
  };
}

function cloneEngine(engine: ResolvedExplorerDragEngine): ResolvedExplorerDragEngine {
  return {
    ...engine,
    tags: [...engine.tags],
    pointer: { ...engine.pointer },
    intent: {
      ...engine.intent,
      copyModifierByPlatform: { ...engine.intent.copyModifierByPlatform },
    },
    dropTargets: {
      ...engine.dropTargets,
      surfacePriority: { ...engine.dropTargets.surfacePriority },
    },
    autoscroll: { ...engine.autoscroll },
    presentation: {
      ...engine.presentation,
      pointerOffset: { ...engine.presentation.pointerOffset },
      spring: { ...engine.presentation.spring },
      rotationSpring: { ...engine.presentation.rotationSpring },
    },
    controls: { ...engine.controls },
  };
}

function applyExplorerDragEngineControlValues(
  engine: ResolvedExplorerDragEngine,
  rawControls: unknown,
): ResolvedExplorerDragEngine {
  const controls = normalizeExplorerDragEngineControlValues({
    ...engine.controls,
    ...(asObject(rawControls) ?? {}),
  });
  const dwellDelayScale = controls.dwellDelayScale ?? 1;
  const autoscrollSpeedScale = controls.autoscrollSpeedScale ?? 1;
  const overlayWeight = controls.overlayWeight ?? 0.25;
  const targetMagnetism = controls.targetMagnetism ?? 0.55;

  return {
    ...engine,
    pointer: {
      ...engine.pointer,
      startDistancePx: controls.pointerStartDistancePx ?? engine.pointer.startDistancePx,
    },
    intent: {
      ...engine.intent,
      nativeOutModifier: controls.nativeOutModifier ?? engine.intent.nativeOutModifier,
    },
    dropTargets: {
      ...engine.dropTargets,
      directoryAutoOpenDelayMs: Math.round(engine.dropTargets.directoryAutoOpenDelayMs * dwellDelayScale),
      navigationAutoOpenDelayMs: Math.round(engine.dropTargets.navigationAutoOpenDelayMs * dwellDelayScale),
      tabAutoOpenDelayMs: Math.round(engine.dropTargets.tabAutoOpenDelayMs * dwellDelayScale),
    },
    autoscroll: {
      ...engine.autoscroll,
      minSpeedPxPerSecond: Math.round(engine.autoscroll.minSpeedPxPerSecond * autoscrollSpeedScale),
      maxSpeedPxPerSecond: Math.round(engine.autoscroll.maxSpeedPxPerSecond * autoscrollSpeedScale),
    },
    presentation: {
      ...engine.presentation,
      maxStackDepth: overlayWeight <= 0.18 ? 1 : engine.presentation.maxStackDepth,
      glassBlurEnabled: overlayWeight >= 0.5 && engine.presentation.glassBlurEnabled,
      heavyShadowEnabled: overlayWeight >= 0.45 && engine.presentation.heavyShadowEnabled,
      targetHighlightScale:
        1 + (engine.presentation.targetHighlightScale - 1) * targetMagnetism,
      folderInhaleScale:
        1 + (engine.presentation.folderInhaleScale - 1) * targetMagnetism,
      folderDwellScale:
        1 + (engine.presentation.folderDwellScale - 1) * targetMagnetism,
    },
    controls,
  };
}

export function applyUsrExplorerDragEngineManifest(
  manifest: ExplorerDragEngineManifest | null | undefined,
): void {
  activeExplorerDragEngineCatalog = normalizeExplorerDragEngineManifest(manifest);
}

export function loadExplorerDragEngineCatalog(): LoadedExplorerDragEngineCatalog {
  return {
    ...activeExplorerDragEngineCatalog,
    engines: activeExplorerDragEngineCatalog.engines.map(cloneEngine),
    warnings: [...activeExplorerDragEngineCatalog.warnings],
  };
}

export function resolveEffectiveExplorerDragEngine(args?: {
  activeDragEngineId?: string | null;
  controlValuesByEngineId?: Record<string, ExplorerDragEngineControlValues> | null;
  catalog?: LoadedExplorerDragEngineCatalog;
}): ResolvedExplorerDragEngine {
  const catalog = args?.catalog ?? activeExplorerDragEngineCatalog;
  const requestedId = normalizeExplorerDragEngineSelectionId(args?.activeDragEngineId);
  const baseEngine =
    catalog.engines.find((engine) => engine.id === requestedId) ??
    catalog.engines.find((engine) => engine.id === catalog.defaultEngineId) ??
    catalog.engines[0] ??
    fallbackPerformanceDragEngine;
  const controls = args?.controlValuesByEngineId?.[baseEngine.id] ?? baseEngine.controls;
  return applyExplorerDragEngineControlValues(cloneEngine(baseEngine), controls);
}

export function getExplorerDragEngineById(
  engineId: string | null | undefined,
  catalog: LoadedExplorerDragEngineCatalog = activeExplorerDragEngineCatalog,
): ResolvedExplorerDragEngine | null {
  const normalizedId = normalizeExplorerDragEngineSelectionId(engineId);
  return normalizedId
    ? catalog.engines.find((engine) => engine.id === normalizedId) ?? null
    : null;
}

export function formatExplorerDragEngineModifierLabel(
  modifier: ExplorerDragModifierKey,
): string {
  switch (modifier) {
    case "alt":
      return "Alt";
    case "ctrl":
      return "Ctrl";
    case "shift":
      return "Shift";
    case "meta":
      return "Meta";
    default:
      return modifier;
  }
}

export const explorerDragModifierOptions = explorerDragModifierKeys;
export const defaultExplorerDragEngine = resolveEffectiveExplorerDragEngine();
