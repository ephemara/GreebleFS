/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GreebleFS Extension API — the public contract                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Everything an extension can see is declared in THIS file. Nothing else is
 * exported to extension authors. An extension is a TypeScript module whose
 * default export is a factory:
 *
 *   import type { GreebleHarness } from 'greeblefs';
 *
 *   export default function (fs: GreebleHarness) {
 *     fs.registerViewMode({ id: 'xmb-row', title: 'XMB Row', component: XmbRow });
 *     fs.on('file:before-open', (event, ctx) => { ... });
 *   }
 *
 * The host executes the factory with a harness bound to that extension's
 * capabilities. Registration verbs write into typed registries. The event
 * spine lets extensions observe, patch, or block named moments.
 *
 * ── DESIGN RULES (do not break these) ────────────────────────────────────────
 *
 *  1. NO CLOSED UNIONS. New domains/events/capabilities are added by
 *     declaration merging, never by editing this file's implementation.
 *  2. REGISTRATION IS A VERB. Extensions call `fs.registerX()`. There are no
 *     manifest files, no TOML, no JSON contribution blocks.
 *  3. CONTEXT IS INJECTED. Handlers receive a capability bag (`ctx`), not a
 *     pile of imports.
 *  4. ONE REGISTRY PRIMITIVE. Every domain is a `GreebleRegistry<T>`; adding a
 *     domain never touches the registry implementation.
 *  5. VERSIONED. `GreebleHarness.apiVersion` is checked at load; unknown
 *     future domains degrade gracefully instead of throwing.
 *
 * ── EXTENDING THE API ────────────────────────────────────────────────────────
 *
 * Extension authors (and future GreebleFS subsystems) widen the API with
 * declaration merging:
 *
 *   declare module 'greeblefs' {
 *     interface GreebleEventMap {
 *       'xmb:beat': { track: string };
 *     }
 *     interface GreebleContext {
 *       xmb: { play(track: string): void };
 *     }
 *     interface GreebleDomainCatalog {
 *       visualizer: GreebleVisualizerContribution;
 *     }
 *   }
 *
 * That is the entire extensibility story. The core never changes.
 */

import type { ComponentType, ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
//  VERSION
// ═══════════════════════════════════════════════════════════════════════════

/** Bumped on any breaking change to the contract. */
export const GREEBLE_API_VERSION = 1 as const;

/** Human-readable version string, surfaced in diagnostics. */
export const GREEBLE_API_VERSION_STRING = '1.0.0' as const;

/** The virtual module id extensions import from. */
export const GREEBLE_RUNTIME_MODULE = 'greeblefs' as const;

// ═══════════════════════════════════════════════════════════════════════════
//  IDENTITY & CAPABILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Capability tokens gate what an extension is allowed to do. The host grants a
 * set per extension; the harness refuses capability-bearing calls that were not
 * granted. Unknown strings are allowed and treated as opt-in future verbs.
 */
export type GreebleCapability =
  | 'fs:read'
  | 'fs:write'
  | 'fs:watch'
  | 'index:query'
  | 'process:spawn'
  | 'net:fetch'
  | 'shell:panel'
  | 'shell:chrome'
  | 'ui:overlay'
  | 'ui:notify'
  | 'storage:read'
  | 'storage:write'
  | 'settings:write'
  | 'theme:override'
  // Extension authors may introduce namespaced capabilities; the host decides
  // whether to honour them.
  | (string & {});

/** Immutable identity passed to every extension. */
export interface GreebleExtensionIdentity {
  /** Stable, unique extension id (e.g. `xmb`, `workbench-pdf`). */
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly author?: string;
  readonly homepage?: string;
  /** Absolute path of the executed entry module. */
  readonly entryPath: string;
  /** Absolute path of the extension root directory. */
  readonly rootDir: string;
  /** Capabilities the host granted this extension. */
  readonly capabilities: ReadonlySet<GreebleCapability>;
  /** Curated tags used for grouping and filtering. */
  readonly tags: readonly string[];
  /** Author-declared, machine-readable metadata. */
  readonly meta: Readonly<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONTRIBUTION PRIMITIVE
// ═══════════════════════════════════════════════════════════════════════════

/** Every registrable thing has a stable id unique within its domain. */
export interface GreebleContribution {
  readonly id: string;
}

/**
 * Returned by every registration verb. Call `dispose()` to withdraw the
 * contribution (e.g. on hot reload teardown). Idempotent.
 */
export interface GreebleHandle {
  readonly id: string;
  readonly domain: string;
  readonly owner: string;
  dispose(): void;
}

/** Snapshot listener fired whenever a registry's contents change. */
export type GreebleRegistryListener<T extends GreebleContribution> = (
  snapshot: readonly T[],
) => void;

/**
 * The one registry primitive every domain uses. The host owns registry
 * instances; extensions only ever receive handles.
 */
export interface GreebleRegistry<T extends GreebleContribution> {
  readonly domain: string;
  register(entry: T, owner: string): GreebleHandle;
  unregister(id: string): boolean;
  get(id: string): T | undefined;
  has(id: string): boolean;
  list(): readonly T[];
  /** Monotonic version, bumped on every mutation. Drives re-render. */
  version(): number;
  subscribe(listener: GreebleRegistryListener<T>): GreebleHandle;
}

/**
 * The collection of all registries. Domains can be defined at runtime, which is
 * what makes the API open-ended: a future subsystem calls `book.define('foo')`
 * and instantly owns a registry the harness can register into.
 */
export interface GreebleDomainBook {
  get<T extends GreebleContribution>(domain: string): GreebleRegistry<T> | undefined;
  /** Create-or-get. Idempotent for a given domain. */
  define<T extends GreebleContribution>(
    domain: string,
    options?: GreebleRegistryOptions<T>,
  ): GreebleRegistry<T>;
  domains(): readonly string[];
  /** Remove every contribution owned by `owner` across all domains. */
  unregisterOwner(owner: string): number;
}

export interface GreebleRegistryOptions<T extends GreebleContribution> {
  /** Ascending sort accessor for `list()`. */
  readonly order?: (entry: T) => number;
  /** Called when an entry is replaced or removed. */
  readonly onDispose?: (entry: T) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
//  RENDER SURFACE
// ═══════════════════════════════════════════════════════════════════════════

export type GreebleDensity = 'compact' | 'regular' | 'comfortable' | 'immersive';

/** Geometry + theme supplied to every rendered contribution. */
export interface GreebleRenderContext {
  readonly containerWidth: number;
  readonly containerHeight: number;
  readonly zoom: number;
  readonly density: GreebleDensity;
  /** Resolved theme tokens as CSS custom properties. */
  readonly cssVars: Readonly<Record<string, string>>;
  /** Resolved Font families. */
  readonly fonts: { readonly ui: string; readonly mono: string };
}

/** Props handed to every registered React contribution. */
export interface GreebleRenderProps<TData = unknown> {
  readonly data: TData;
  readonly ctx: GreebleContext;
  readonly render: GreebleRenderContext;
}

/**
 * A renderable contribution. React components are the primary form; a plain
 * function returning `ReactNode` is accepted for sugar.
 */
export type GreebleComponent<TData = unknown> =
  | ComponentType<GreebleRenderProps<TData>>
  | ((props: GreebleRenderProps<TData>) => ReactNode);

// ═══════════════════════════════════════════════════════════════════════════
//  SELECTION / MATCHING
// ═══════════════════════════════════════════════════════════════════════════

export interface GreebleSelection {
  readonly paths: readonly string[];
  readonly anchorPath: string | null;
  readonly count: number;
}

export interface GreebleEntry {
  readonly path: string;
  readonly name: string;
  readonly extension: string;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly modified: number;
}

export interface GreebleMenuTarget {
  readonly path: string | null;
  readonly isDirectory: boolean;
  readonly selection: GreebleSelection;
  readonly cwd: string;
}

export type GreebleOpenSource =
  | 'explorer'
  | 'command'
  | 'external'
  | 'preview'
  | 'api'
  | (string & {});

/**
 * Declarative path matcher. Every field is optional; unset fields match
 * anything. An empty matcher matches everything.
 */
export interface GreebleMatch {
  readonly isDirectory?: boolean;
  readonly extensions?: readonly string[];
  readonly fileNames?: readonly string[];
  readonly kinds?: readonly string[];
  /** Glob patterns (e.g. `**\/*.tsx`). */
  readonly glob?: readonly string[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOMAIN CONTRIBUTION CATALOG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The catalog maps every registration domain to its contribution shape. Add a
 * domain by extending this interface via declaration merging — the harness's
 * generic `register()` and the domain book pick it up automatically.
 */
export interface GreebleDomainCatalog {
  // ── Shell, presentation & godmode theme lanes ──
  shell: GreebleShellContribution;
  theme: GreebleThemeContribution;
  iconTheme: GreebleIconThemeContribution;
  soundPack: GreebleSoundPackContribution;
  shader: GreebleShaderContribution;
  motion: GreebleMotionContribution;
  animation: GreebleAnimationContribution;
  homePack: GreebleHomePackContribution;
  menuPack: GreebleMenuPackContribution;
  layout: GreebleLayoutContribution;
  font: GreebleFontContribution;

  // ── Explorer surfaces ──
  viewMode: GreebleViewModeContribution;
  previewLane: GreeblePreviewLaneContribution;
  explorerWidget: GreebleWidgetContribution;
  activityLane: GreebleActivityLaneContribution;

  // ── Interaction ──
  command: GreebleCommandContribution;
  action: GreebleActionContribution;
  actionPack: GreebleActionPackContribution;
  contextMenuItem: GreebleContextMenuItemContribution;
  hotkey: GreebleHotkeyContribution;
  workflow: GreebleWorkflowContribution;

  // ── Panels & settings ──
  panel: GreeblePanelContribution;
  settingsSlot: GreebleSettingsSlotContribution;

  // ── Lower-level ──
  provider: GreebleProviderContribution;
  tool: GreebleToolContribution;
}

/** Union of all known domain keys. Open for augmentation. */
export type GreebleDomain = keyof GreebleDomainCatalog;

/** Contribution type for a domain key. */
export type GreebleContributionFor<D extends GreebleDomain> = GreebleDomainCatalog[D];

// ── Shell ───────────────────────────────────────────────────────────────────

/**
 * A shell contribution can replace the ENTIRE application chrome. Its render
 * function receives a host with surface renderers, so a shell can choose to
 * take over everything, nothing, or any subset.
 */
export interface GreebleShellContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly priority?: number;
  /** When true the shell is only used if explicitly pinned. */
  readonly optIn?: boolean;
  readonly component: GreebleComponent<GreebleShellData>;
}

export interface GreebleShellData {
  /**
   * Host-owned surfaces a shell may compose. Calling any of these renders the
   * default GreebleFS implementation of that region, so partial shells are
   * first-class — a theme can restyle only the chrome bar and keep everything
   * else.
   */
  readonly host: GreebleShellHost;
}

export interface GreebleShellHost {
  renderDefaultShell(): ReactNode;
  renderChromeBar(): ReactNode;
  renderNavigationSurface(): ReactNode;
  renderContentSurface(): ReactNode;
  renderPanelSurface(side: 'left' | 'right'): ReactNode;
  renderStatusBar(): ReactNode;
  renderDomainPicker(): ReactNode;
  renderWindowControls(): ReactNode;
}

// ── Theme ───────────────────────────────────────────────────────────────────

export interface GreebleThemeContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly author?: string;
  readonly tags?: readonly string[];
  /** Theme id this theme composes from; its tokens become the baseline. */
  readonly extends?: string;
  /** Design tokens. Unknown keys are preserved and exposed as CSS vars. */
  readonly tokens: GreebleThemeTokens;
  /** Composition — imported modules, not id strings. */
  readonly shell?: GreebleShellContribution;
  readonly iconTheme?: GreebleIconThemeContribution;
  readonly soundPack?: GreebleSoundPackContribution;
  readonly shaders?: readonly GreebleShaderContribution[];
  readonly motion?: GreebleMotionContribution;
  readonly viewModes?: readonly GreebleViewModeContribution[];
  readonly layouts?: readonly GreebleLayoutContribution[];
  readonly preview?: GreeblePreviewRef;
}

export interface GreeblePreviewRef {
  /** Path relative to the extension root, or an absolute asset url. */
  readonly asset?: string;
  readonly component?: GreebleComponent;
}

/** Arbitrary design tokens; `--` keys pass through verbatim as CSS vars. */
export type GreebleThemeTokens = Readonly<Record<string, string | number>>;

export interface GreebleIconThemeContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  /** Resolve an icon id/name to a renderable node or asset url. */
  readonly resolve: (name: string, ctx: GreebleContext) => ReactNode | string | null;
  /** Optional explicit map for fast lookups. */
  readonly icons?: Readonly<Record<string, ReactNode | string>>;
}

export interface GreebleSoundPackContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly cues: Readonly<Record<string, GreebleSoundCue>>;
}

export interface GreebleSoundCue {
  /** Asset path relative to the extension root. */
  readonly asset?: string;
  /** A synthesized cue descriptor; host-defined interpretation. */
  readonly synth?: Readonly<Record<string, number | string>>;
  readonly gain?: number;
}

export interface GreebleShaderContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly component?: GreebleComponent;
  /** Optional uniforms declaration for host tooling. */
  readonly uniforms?: Readonly<Record<string, GreebleShaderUniform>>;
}

export interface GreebleShaderUniform {
  readonly type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'color' | 'bool' | 'int';
  readonly default: number | boolean | string | readonly number[];
  readonly min?: number;
  readonly max?: number;
}

export interface GreebleMotionContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly presets?: Readonly<Record<string, GreebleMotionPreset>>;
}

export interface GreebleMotionPreset {
  readonly durationMs: number;
  readonly easing: string;
  readonly intensity?: number;
}

export interface GreebleAnimationContribution extends GreebleContribution {
  readonly title: string;
  readonly kind: 'open' | 'close' | 'transition' | (string & {});
  readonly component: GreebleComponent;
}

export interface GreebleHomePackContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly component: GreebleComponent;
}

export interface GreebleMenuPackContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  /** Menu structure; item ids may reference registered commands. */
  readonly menus: readonly GreebleMenuDefinition[];
}

export interface GreebleMenuDefinition {
  readonly id: string;
  readonly label: string;
  readonly items: readonly GreebleMenuItemRef[];
}

export type GreebleMenuItemRef =
  | { readonly command: string; readonly label?: string }
  | { readonly separator: true }
  | { readonly submenu: GreebleMenuDefinition };

export interface GreebleLayoutContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly kind: 'shell' | 'explorer' | 'dock' | (string & {});
  /** Opaque layout descriptor interpreted by the matching renderer. */
  readonly spec?: Readonly<Record<string, unknown>>;
  readonly component?: GreebleComponent;
}

export interface GreebleFontContribution extends GreebleContribution {
  readonly family: string;
  readonly title?: string;
  readonly weights?: readonly number[];
  /** Asset files relative to the extension root. */
  readonly files?: readonly string[];
  /** CSS @font-face src value(s). */
  readonly src?: string;
}

// ── Explorer surfaces ───────────────────────────────────────────────────────

export interface GreebleViewModeContribution<TData = unknown>
  extends GreebleContribution {
  readonly title: string;
  readonly shortLabel?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly priority?: number;
  readonly appliesTo?: GreebleMatch;
  readonly component: GreebleComponent<TData>;
  /** Optional density contract for host-driven zoom. */
  readonly zoom?: { readonly min: number; readonly max: number; readonly step: number };
}

export interface GreeblePreviewLaneContribution<TData = unknown>
  extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly priority?: number;
  readonly appliesTo?: GreebleMatch;
  readonly component: GreebleComponent<TData>;
  readonly chrome?: {
    readonly includePreviewTab?: boolean;
    readonly includeEditTab?: boolean;
    readonly topBarDensity?: GreebleDensity;
  };
}

export interface GreebleWidgetContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly priority?: number;
  readonly component: GreebleComponent;
}

export interface GreebleActivityLaneContribution extends GreebleContribution {
  readonly title: string;
  readonly icon?: ReactNode;
  readonly priority?: number;
  readonly component: GreebleComponent;
  readonly placement?: 'rail' | 'sidebar' | 'statusbar' | (string & {});
}

// ── Interaction ─────────────────────────────────────────────────────────────

export interface GreebleCommandContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly keywords?: readonly string[];
  readonly icon?: ReactNode;
  /** When provided, the command is exposed to automation / the LLM. */
  readonly parameters?: Record<string, unknown>;
  readonly run: (args: GreebleCommandArgs, ctx: GreebleContext) => unknown | Promise<unknown>;
  /** Optional argument completion source. */
  readonly complete?: (
    partial: string,
    ctx: GreebleContext,
  ) => readonly GreebleCompletion[] | Promise<readonly GreebleCompletion[]>;
}

export interface GreebleCommandArgs {
  readonly raw: string;
  readonly tokens: readonly string[];
  readonly named: Readonly<Record<string, string>>;
  readonly targets: readonly string[];
}

export interface GreebleCompletion {
  readonly value: string;
  readonly label?: string;
  readonly detail?: string;
}

export interface GreebleActionContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly appliesTo?: GreebleMatch;
  /** Runs against the current selection. */
  readonly run: (targets: readonly string[], ctx: GreebleContext) => unknown | Promise<unknown>;
}

export interface GreebleActionPackContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly actions: readonly GreebleActionContribution[];
}

export interface GreebleContextMenuItemContribution extends GreebleContribution {
  readonly title: string;
  readonly appliesTo?: GreebleMatch;
  /** `'inline'` items run directly; `'submenu'` open `items`. */
  readonly placement?: 'inline' | 'submenu' | 'section';
  readonly order?: number;
  readonly run?: GreebleContextMenuItemRun;
  readonly items?: readonly GreebleContextMenuItemContribution[];
}

export type GreebleContextMenuItemRun = (
  target: GreebleMenuTarget,
  ctx: GreebleContext,
) => unknown | Promise<unknown>;

export interface GreebleHotkeyContribution extends GreebleContribution {
  readonly title: string;
  readonly keys: string;
  /** Command id to invoke, or an inline handler. */
  readonly command?: string;
  readonly run?: (ctx: GreebleContext) => unknown | Promise<unknown>;
  readonly when?: string;
}

export interface GreebleWorkflowContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly component: GreebleComponent;
}

// ── Panels & settings ───────────────────────────────────────────────────────

export interface GreeblePanelContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly component: GreebleComponent;
  readonly placement?: 'tab' | 'floating' | 'dock' | (string & {});
  readonly defaultOpen?: boolean;
  readonly keepMounted?: boolean;
}

export interface GreebleSettingsSlotContribution extends GreebleContribution {
  readonly title: string;
  readonly description?: string;
  readonly section?: string;
  readonly order?: number;
  readonly component: GreebleComponent;
}

// ── Lower-level ─────────────────────────────────────────────────────────────

export interface GreebleProviderContribution extends GreebleContribution {
  readonly title: string;
  readonly baseUrl?: string;
  readonly models?: readonly string[];
}

export interface GreebleToolContribution extends GreebleContribution {
  readonly title: string;
  readonly description: string;
  /** JSON-schema-ish parameter descriptor for automation callers. */
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly run: (input: unknown, ctx: GreebleContext) => unknown | Promise<unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONTEXT — the injected capability bag
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Every handler receives a `GreebleContext`. It is a capability bag, not an
 * import surface: the host decides what each extension may touch. Extend it by
 * declaration merging to expose new subsystems.
 */
export interface GreebleContext {
  readonly extension: GreebleExtensionIdentity;
  /** Abort signal for the active operation, if any. */
  readonly signal: AbortSignal | undefined;
  readonly hasUI: boolean;

  readonly ui: GreebleUICapability;
  readonly explorer: GreebleExplorerCapability;
  readonly paths: GreeblePathCapability;
  readonly fs: GreebleFileSystemCapability;
  readonly index: GreebleIndexCapability;
  readonly settings: GreebleSettingsCapability;
  readonly storage: GreebleStorageCapability;
  readonly shell: GreebleShellCapability;
  readonly log: GreebleLogCapability;
  readonly events: GreebleExtensionBus;
}

export interface GreebleUICapability {
  notify(message: string, level?: 'info' | 'warning' | 'error'): void;
  confirm(title: string, message: string): Promise<boolean>;
  select(title: string, options: readonly GreebleCompletion[]): Promise<string | undefined>;
  input(title: string, placeholder?: string): Promise<string | undefined>;
  /** Render a transient full-surface overlay owned by the extension. */
  overlay(render: GreebleComponent, options?: { readonly dismissable?: boolean }): Promise<void>;
  setStatus(id: string, text: string | undefined): void;
  setWidget(id: string, content: ReactNode | undefined): void;
}

export interface GreebleExplorerCapability {
  currentDirectory(): string;
  selection(): GreebleSelection;
  entries(): Promise<readonly GreebleEntry[]>;
  open(path: string, options?: { readonly inNewTab?: boolean }): Promise<void>;
  reveal(path: string): Promise<void>;
  refresh(): void;
  subscribe(listener: (selection: GreebleSelection) => void): GreebleHandle;
}

export interface GreeblePathCapability {
  readonly cwd: string;
  readonly roots: readonly string[];
  resolve(...segments: string[]): string;
  dirname(path: string): string;
  basename(path: string, suffix?: string): string;
  extname(path: string): string;
  join(...segments: string[]): string;
  relative(from: string, to: string): string;
  isAbsolute(path: string): boolean;
}

export interface GreebleFileSystemCapability {
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  writeText(path: string, data: string): Promise<void>;
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<GreebleEntry | null>;
  list(path: string): Promise<readonly GreebleEntry[]>;
  mkdir(path: string, options?: { readonly recursive?: boolean }): Promise<void>;
  remove(path: string, options?: { readonly recursive?: boolean }): Promise<void>;
  move(from: string, to: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
}

export interface GreebleIndexCapability {
  query(text: string, options?: { readonly limit?: number }): Promise<readonly GreebleEntry[]>;
  stats(): Promise<Readonly<Record<string, number>>>;
}

export interface GreebleSettingsCapability {
  get<T = unknown>(key: string, fallback?: T): T;
  set(key: string, value: unknown): void;
  patch(values: Readonly<Record<string, unknown>>): void;
  reset(keys?: readonly string[]): void;
  subscribe(listener: (values: Readonly<Record<string, unknown>>) => void): GreebleHandle;
}

export interface GreebleStorageCapability {
  readonly rootDir: string;
  ensureDir(relativePath?: string): Promise<string>;
  readText(relativePath: string): Promise<string>;
  writeText(relativePath: string, data: string): Promise<void>;
  writeBytes(relativePath: string, data: Uint8Array): Promise<void>;
}

export interface GreebleShellCapability {
  openPanel(panelId: string, payload?: Readonly<Record<string, string>>): void;
  closePanel(panelId: string): void;
  focusPanel(panelId: string): void;
  openWindowedPanel(panelId: string, payload?: Readonly<Record<string, string>>): void;
}

export interface GreebleLogCapability {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

// ═══════════════════════════════════════════════════════════════════════════
//  EVENTS — the spine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lifecycle events. Handlers may observe, patch the payload, or block. Only
 * `*:before-*` events honour `block`; the host decides for each.
 *
 * Extend via declaration merging. Namespaced free-form channels (for
 * inter-extension chatter) travel on `GreebleExtensionBus`, not here.
 */
export interface GreebleEventMap {
  'app:start': { readonly reason: 'startup' | 'reload' | 'profile-switch'; readonly profileId: string | null };
  'app:shutdown': { readonly reason: 'quit' | 'reload' };
  'profile:load': { readonly profileId: string; readonly previousProfileId: string | null };
  'module:load': { readonly extensionId: string; readonly entryPath: string };
  'module:unload': { readonly extensionId: string; readonly entryPath: string };

  'file:before-open': GreebleOpenEvent;
  'file:after-open': GreebleOpenEvent & { readonly ok: boolean; readonly error?: string };
  'file:before-write': { readonly path: string; readonly bytes: number };
  'file:after-write': { readonly path: string; readonly ok: boolean; readonly error?: string };

  'explorer:selection-changed': { readonly selection: GreebleSelection };
  'explorer:directory-changed': { readonly path: string; readonly previousPath: string | null };
  'explorer:before-action': { readonly actionId: string; readonly targets: readonly string[]; readonly cwd: string };
  'explorer:after-action': { readonly actionId: string; readonly targets: readonly string[]; readonly ok: boolean; readonly error?: string };

  'context-menu:build': { readonly target: GreebleMenuTarget; readonly items: GreebleMenuItemComputed[] };
  'command:invoke': { readonly commandId: string; readonly args: GreebleCommandArgs };
  'preview:resolve': { readonly path: string; readonly candidates: string[] };
  'view:resolve': { readonly path: string; readonly candidates: string[] };
  'theme:resolve': { readonly requestedId: string; readonly resolvedId: string };
}

export interface GreebleOpenEvent {
  readonly path: string;
  readonly name: string;
  readonly extension: string;
  readonly size: number;
  readonly isDirectory: boolean;
  readonly source: GreebleOpenSource;
}

export interface GreebleMenuItemComputed {
  readonly id: string;
  readonly label: string;
  readonly order?: number;
  readonly run?: () => unknown | Promise<unknown>;
}

/**
 * A handler's return value. `block` cancels the operation (before-events only),
 * `patch` merges into the payload for the next handler, `replace` swaps the
 * items array (context-menu build).
 */
export interface GreebleEventResult<TPayload> {
  readonly block?: boolean;
  readonly reason?: string;
  readonly patch?: Partial<TPayload>;
}

export type GreebleEventHandler<K extends keyof GreebleEventMap> = (
  payload: GreebleEventMap[K],
  ctx: GreebleContext,
) => void | GreebleEventResult<GreebleEventMap[K]> | Promise<void | GreebleEventResult<GreebleEventMap[K]>>;

/** Outcome of dispatching an event through all handlers. */
export interface GreebleEmission<TPayload> {
  readonly blocked: boolean;
  readonly reason?: string;
  readonly payload: TPayload;
  readonly results: readonly GreebleEventResult<TPayload>[];
}

/** The lifecycle spine, bound into the context and the harness. */
export interface GreebleEventSpine {
  on<K extends keyof GreebleEventMap>(
    event: K,
    handler: GreebleEventHandler<K>,
    options?: { readonly priority?: number },
  ): GreebleHandle;
  off(handle: GreebleHandle): void;
  /** Dispatch synchronously-collected handlers; awaits async ones. */
  emit<K extends keyof GreebleEventMap>(
    event: K,
    payload: GreebleEventMap[K],
    ctx: GreebleContext,
  ): Promise<GreebleEmission<GreebleEventMap[K]>>;
}

/**
 * Free-form, namespaced bus for extension-to-extension communication. Channels
 * MUST be namespaced (`xmb:ready`, `workflow-pdf:render`). The host never
 * inspects payloads.
 */
export interface GreebleExtensionBus {
  on<T = unknown>(channel: string, handler: (payload: T, ctx: GreebleContext) => void | Promise<void>): GreebleHandle;
  off(handle: GreebleHandle): void;
  emit<T = unknown>(channel: string, payload?: T): void;
  channels(): readonly string[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  THE HARNESS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The object handed to every extension factory. Registration verbs write into
 * typed registries; the event spine observes lifecycle moments; the context
 * accessor exposes granted capabilities.
 *
 * All registration verbs return a `GreebleHandle`. Disposing every handle an
 * extension holds is how hot reload cleanly removes it.
 */
export interface GreebleHarness {
  readonly apiVersion: typeof GREEBLE_API_VERSION;
  readonly identity: GreebleExtensionIdentity;

  // ── Generic registration (the escape hatch) ──
  /**
   * Register into ANY domain by key. Domains the API does not know yet work
   * here, which is what keeps the surface open-ended.
   */
  register<D extends GreebleDomain>(domain: D, entry: GreebleContributionFor<D>): GreebleHandle;
  register<T extends GreebleContribution>(domain: string, entry: T): GreebleHandle;

  // ── Typed sugar over `register` ──
  registerShell(entry: GreebleShellContribution): GreebleHandle;
  registerTheme(entry: GreebleThemeContribution): GreebleHandle;
  registerIconTheme(entry: GreebleIconThemeContribution): GreebleHandle;
  registerSoundPack(entry: GreebleSoundPackContribution): GreebleHandle;
  registerShader(entry: GreebleShaderContribution): GreebleHandle;
  registerMotion(entry: GreebleMotionContribution): GreebleHandle;
  registerAnimation(entry: GreebleAnimationContribution): GreebleHandle;
  registerHomePack(entry: GreebleHomePackContribution): GreebleHandle;
  registerMenuPack(entry: GreebleMenuPackContribution): GreebleHandle;
  registerLayout(entry: GreebleLayoutContribution): GreebleHandle;
  registerFont(entry: GreebleFontContribution): GreebleHandle;
  registerViewMode<TData = unknown>(entry: GreebleViewModeContribution<TData>): GreebleHandle;
  registerPreviewLane<TData = unknown>(entry: GreeblePreviewLaneContribution<TData>): GreebleHandle;
  registerExplorerWidget(entry: GreebleWidgetContribution): GreebleHandle;
  registerActivityLane(entry: GreebleActivityLaneContribution): GreebleHandle;
  registerCommand(entry: GreebleCommandContribution): GreebleHandle;
  registerAction(entry: GreebleActionContribution): GreebleHandle;
  registerActionPack(entry: GreebleActionPackContribution): GreebleHandle;
  registerContextMenuItem(entry: GreebleContextMenuItemContribution): GreebleHandle;
  registerHotkey(entry: GreebleHotkeyContribution): GreebleHandle;
  registerWorkflow(entry: GreebleWorkflowContribution): GreebleHandle;
  registerPanel(entry: GreeblePanelContribution): GreebleHandle;
  registerSettingsSlot(entry: GreebleSettingsSlotContribution): GreebleHandle;
  registerProvider(entry: GreebleProviderContribution): GreebleHandle;
  registerTool(entry: GreebleToolContribution): GreebleHandle;

  // ── Event spine ──
  on<K extends keyof GreebleEventMap>(
    event: K,
    handler: GreebleEventHandler<K>,
    options?: { readonly priority?: number },
  ): GreebleHandle;
  off(handle: GreebleHandle): void;
  emit<K extends keyof GreebleEventMap>(
    event: K,
    payload: GreebleEventMap[K],
  ): Promise<GreebleEmission<GreebleEventMap[K]>>;

  // ── Inter-extension bus ──
  readonly events: GreebleExtensionBus;

  // ── Persistence (survives reload; never sent to the model) ──
  appendEntry<T = unknown>(key: string, value: T): void;
  getEntry<T = unknown>(key: string, fallback?: T): T | undefined;

  // ── Capabilities ──
  /** True if the host granted this capability token. */
  can(capability: GreebleCapability): boolean;
  /** Current context. Handlers receive it directly; this is the escape hatch. */
  context(): GreebleContext;

  // ── Lifecycle ──
  /** Dispose every handle this extension created. Called on unload/reload. */
  dispose(): void;
}

/** Default export shape of an extension module. */
export type GreebleExtensionFactory = (
  fs: GreebleHarness,
) => void | Promise<void>;

/** What the runtime accepts as a module default export. */
export type GreebleExtensionModule =
  | { readonly default: GreebleExtensionFactory }
  | GreebleExtensionFactory;

// ═══════════════════════════════════════════════════════════════════════════
//  AUTHOR HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Identity helper for readable extension modules and better inference. */
export function defineExtension(factory: GreebleExtensionFactory): GreebleExtensionFactory {
  return factory;
}

/**
 * Evaluate a `GreebleMatch` against a path. Exposed so authors can test their
 * own matchers and hosts share one implementation.
 */
export function matchGreeblePath(
  input: { path: string; isDirectory?: boolean; extension?: string; name?: string },
  match?: GreebleMatch,
): boolean {
  if (!match) {
    return true;
  }
  if (typeof match.isDirectory === 'boolean' && match.isDirectory !== Boolean(input.isDirectory)) {
    return false;
  }
  const extension = input.extension ?? extractExtension(input.path);
  if (match.extensions && match.extensions.length > 0) {
    const wanted = match.extensions.map(entry => entry.replace(/^\./, '').toLowerCase());
    if (!wanted.includes(extension.toLowerCase())) {
      return false;
    }
  }
  const name = input.name ?? extractBaseName(input.path);
  if (match.fileNames && match.fileNames.length > 0 && !match.fileNames.includes(name)) {
    return false;
  }
  if (match.glob && match.glob.length > 0 && !match.glob.some(pattern => matchSimpleGlob(pattern, input.path))) {
    return false;
  }
  return true;
}

function extractExtension(path: string): string {
  const base = extractBaseName(path);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1) : '';
}

function extractBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

/** Minimal glob matcher: `*`, `**`, `?`. No dependency, host-shared. */
export function matchSimpleGlob(pattern: string, value: string): boolean {
  const normalizedValue = value.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  const escaped = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`).test(normalizedValue);
}
