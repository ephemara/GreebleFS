# GreebleFS Architecture

## Purpose

GreebleFS is a Tauri desktop workbench centered on a highly themeable file explorer, terminal overlay, plugins, shaders, animations, screenshots, and settings-driven shell customization.

## Release Identity

- The canonical shipped product name is now `GreebleFS`.
- Release/package surfaces use:
  - npm package name `greeblefs`
  - Rust package/binary `greeblefs`
  - Tauri product name `GreebleFS`
  - Tauri identifier `co.greeblefs.app`
- The repository still intentionally preserves several legacy `OverlayTerm` runtime contracts for compatibility during `v0.1.0-rc1`:
  - plugin/runtime module ids such as `overlayterm-plugin`
  - event namespaces and drag payload keys prefixed with `overlayterm`
  - older `OVERLAYTERM_*` and `VITE_OVERLAYTERM_*` environment overrides as fallbacks
  - legacy layout/config discovery paths where migration is safe
  

## Stack

- Frontend: React 19 + TypeScript + Vite
- State: Zustand
- Desktop host: Tauri 2 + Rust
- Python runtime: managed virtualenv + persistent stdio JSON sidecar + embedded `pyo3` helpers
- Visual system: CSS variables, theme packages, icon themes, shaders, animations
- Tests: Vitest unit/browser, Rust tests

## Main Entry Points

- `src/main.tsx`
  Frontend bootstrap. It now selects the root app by webview label, rendering `App` for the main shell and `src/windows/FileOperationsWindowApp.tsx` for the dedicated `file-operations` popout.
- `install.sh`
  Root Linux local-install wrapper. It delegates to `scripts/build-and-install-linux-local-release.sh`, which builds the app and installs a per-user release on Linux.
- `install.ps1`
  Root Windows local clean-install/uninstall entrypoint. It builds with Bun and Cargo, removes the previous per-user install and user-state roots on demand, and reinstalls a fresh `greeblefs.exe` plus current-user Start Menu/Desktop shortcuts.
- `src/App.tsx`
  Overlay window shell, theme/runtime discovery, panel orchestration.
- `src/panels/panelRegistry.tsx`
  Built-in panel registration and prop wiring.
- `src/components/FileExplorer.tsx`
  Main explorer shell, navigation, preview, standard layout modes, experimental explorer runtimes, the embedded preview-pane image/video/audio editor paths, the shared preview-header workflow-tab system (`Preview` / `Edit` plus lane-owned wildcard tabs), the explorer-local preview split mode that can promote the live preview lane into a pane-styled sibling without creating another workspace pane, and the dock-owned layout contract used when the app switches into overlay mode.
- `src/components/OverlayScrollArea.tsx`
  Shared overlay scroll host. It owns the explicit scrollbar contract for shipping-shell panes (`hidden`, `themed`, `explorer-file-list`) so explorer lists, popouts, and workbench/detail surfaces can share themed scroll behavior without per-component scrollbar CSS.
- `src/components/ExplorerImageEditor.tsx`
  Shell-owned wrapper for the embedded preview-pane image lane. Editable raster files now open in fullscreen preview mode first and only reveal the heavier save/crop/filter chrome when `FileExplorer.tsx` switches the document into explicit `edit` mode. The component still provides GreebleFS-native toolbar/status chrome, live scroll-to-zoom and drag-to-pan preview interaction, save/reset wiring that restores the preview fit state, resize adaptation, and the static-preview fallback for unsupported image formats. Local saves may attempt the Tauri fs plugin path when it is available, but the durable write contract is the typed explorer backend fallback so missing plugin registration does not strand image edits.
- `src/components/ExplorerVideoEditor.tsx`
  Shell-owned wrapper for the embedded preview-pane video surface. It now defaults to a playback-first preview surface and only reveals the heavier trim/inspector editing chrome when Explorer switches the document into explicit edit mode. It mounts a real media-element preview that is driven by the Rust video engine/store, resolves direct-safe sources or ffmpeg-generated MP4 proxies through the typed backend, and exposes loop-aware transport plus non-destructive trim export.
- `src/components/ExplorerAudioWorkbench.tsx`
  Shell-owned wrapper for the embedded preview-pane audio surface. It now follows the same preview-first shell model as the image/video lanes, but audio is also the first wildcard-tab consumer: `FileExplorer.tsx` opens audio in a clean playback-first preview surface, the shared preview header exposes `Preview | Edit | VST`, trim/export tools stay in explicit `Edit`, and the `VST` workflow is a compact-picker, host-dominant plugin lane. Under that shell split it still rides the Rust audio engine, keeps shared waveform selection, DAW-style fade edge handles, memoized waveform/spectral subsurfaces, a RAF-driven playhead marker, loop/gain/rate control, offline export actions, and spectrogram rendering.
- `src/components/explorer/explorerPreviewWorkflowTabs.ts`
  Shared preview-header workflow-tab contract. It canonicalizes the built-in non-edit/edit tabs, normalizes lane-owned wildcard tabs, and resolves the active workflow tab without persisting wildcard ids into explorer session state.
- `src/components/ExplorerPdfWorkbench.tsx`
  Shell-owned wrapper for the embedded preview-pane PDF surface. It keeps the explorer preview-pane contract, renders one active page at a time, exposes page/zoom/fit/edit/save chrome, authors page-space overlay annotations plus AcroForm edits in React, and defers document truth/render/save back to the typed Rust PDF bridge.
- `src/components/ExplorerSpreadsheetWorkbench.tsx`
  Shell-owned wrapper for the embedded spreadsheet preview/editor surface. It now follows the same preview-first shell model as the image/video/PDF lanes: `FileExplorer.tsx` opens spreadsheets in preview mode first, the shared preview header owns the `Preview` / `Edit` toggle, and the workbench itself stays read-only until edit mode is requested. Preview mode now routes through the same themed table-preview surface language used by the SQLite lane, while edit mode keeps the spreadsheet-specific Glide grid, formula bar, sheet management, and save flow. Workbook truth plus import/export still route through the typed runtime.
- `src/components/explorer/ExplorerTablePreviewSurface.tsx`
  Shared themed shell primitives for table-shaped preview lanes. SQLite and spreadsheet preview now compose the same identity header, selector strip, dataset header, action buttons, centered states, responsive layout breakpoint, and HTML table surface here so table previews do not drift into lane-local one-off chrome.
- `src/components/ExplorerShaderWorkbench.tsx`
  Shell-owned wrapper for the embedded shader preview/editor surface. It renders WGSL/HLSL/SPIR-V documents inside the explorer preview pane, owns edit-vs-preview presentation, exposes stage/entrypoint pickers plus scene-mode controls, renders the WebGPU host canvas when available, and falls back to diagnostics plus inspection output when live preview is unsupported.
- `src/components/StoragePanel.tsx`
  First-class storage forensics tab. It now follows the Explorer shell contract more closely: left drive/context rail, dense matrix-first workspace, optional split-map/types/focus modes, preview-pane-style inspector, keyboard navigation, and a visible batch cleanup queue for staged trash/delete actions.
- `src/components/storage/storageTreemap.ts`
  Pure treemap layout helper for the storage tab. It turns the condensed native storage tree into deterministic SVG rectangles weighted by allocated bytes without mixing layout math into the panel component.
- `src/components/storage/storageWorkbench.ts`
  Pure storage-workbench helpers for matrix row flattening, sort/share math, treemap focus resolution, and queue summary calculations. Keep storage table/tree math here instead of burying it in `StoragePanel.tsx`.
- `src/config/storageBatchQueues.ts`
  Data-driven storage batch-queue definitions. The initial `cleanup` queue exposes staged `Trash` and `Delete` actions, but the config shape is intended to support future batch workflows without hardcoding them inside the panel.
- `src/store/storageStore.ts`
  Persisted storage-workbench session state. It owns active mode, selected root/path set, expanded tree paths, sort state, preview split mode, focus path, and the staged cleanup queue snapshot.
- `src/components/explorer/ExplorerWorkspace.tsx`
  Explorer-local workspace shell that wraps `FileExplorer` instances with explorer tabs, slot-based `1-Up` / `2-Up` / `4-Up` pane layouts, pane focus, adaptive split sizing, and one shared workspace strip that always shows the focused pane's tab set. This layer still owns top-level multi-pane explorer topology; the newer preview split stays inside a single `FileExplorer` instance instead of routing through workspace panes.
- `src/components/explorer/ExplorerSideRail.tsx`
  Explorer rail, drives, bookmarks, saved searches, and tag-filter browsing.
- `src/components/home/ExplorerHomeSurface.tsx`, `src/components/home/homePackRuntime.tsx`, and `src/config/homePackages.ts`
  Explorer Home surface runtime. This subsystem owns the virtual `greeblefs://home` route, the constrained host data/actions exposed to Home packs, built-in Home packs (`command-center`, `favorites-deck`), and authored pack discovery from `home-packs/`.
- `src/components/WorkbenchTopBar.tsx`
  Data-driven shell top bar renderer. It resolves launcher controls, navigation tabs or summary mode, window chrome, and theme-shader layering from the standalone top-bar catalog instead of burying the whole shell header inside `App.tsx`.
- `src/config/appearance.ts`
  Core overlay theme model and resolved CSS variables.
- `src/config/pilotThemeContract.ts`
  Data-driven pilot theme baseline for built-in theme defaults, app/dock recipe normalization, and explorer/layout reset behavior when built-in themes are selected.
- `src/config/workbenchTheme.ts`
  App-wide workbench recipe resolution and workbench-scoped CSS variable contract.
- `src/config/topBars.ts`
  Standalone top-bar catalog and resolver. It owns built-in top-bar variants, theme-package top-bar contribution loading, legacy `theme.workbench.topBarStyle` fallback mapping, and the active selection resolution path used by `App.tsx` and Settings.
- `src/config/explorerTheme.ts`
  Explorer-specific theme recipe resolution, metrics scaling, and explorer-scoped CSS variable contract.
- `src/config/explorerModeProfiles.ts`
  Explorer mode-profile registry that maps user-facing explorer modes onto pane-layout ids, chrome-layout ids, and view-bias defaults.
- `src/config/explorerShellLayouts.ts`
  Pane-layout presets that still own rail visibility, preview placement, and live pane sizing behavior. These remain the pane-composition layer even after mode profiles and chrome layouts were split out.
- `src/config/explorerChromeLayouts.ts`
  Explorer chrome layout registry/resolver for adaptive topbar, toolbar, workspace header, rail header, preview header, and status-strip control placement plus zone-based layout override snapshots.
- `src/config/themeEngineBindings.ts`
  Shared engine-manifest binding helpers for layout/navigation/render-driven recipe defaults.
- `src/config/workbenchRenderRuntime.ts`
  Resolves the active workbench interaction runtime from the theme engine manifest and layout profile.
- `src/config/layoutProfiles.ts`
  Built-in and external layout manifest normalization for shell blueprints, pinned panels, control docks, and top/bottom chrome behavior.
- `src/config/themePackages.ts`
  Theme package discovery and manifest loading from `themes/`.
- `src/config/topBarPackages.ts`
  Standalone top-bar package discovery and manifest loading from `top-bars/`.
- `src/config/iconTheme.ts` and `src/config/iconThemePackages.ts`
  VS Code-style icon-theme manifest resolution plus managed `icon-themes/` package discovery for explorer file/folder mappings and shell-wide UI icon overrides.
- `src/config/themeCatalogCuration.ts`
  Host-owned curation metadata for packaged themes. It defines the official pilot suite, legacy/lab tiers, archive tiers, and stable sort/badge metadata used by Settings and loader consumers.
- `src/config/wallpapers.ts`
  Wallpaper directory resolution, fit-mode contract, and wallpaper runtime config.
- `src/components/WorkbenchNavigationSurface.tsx`
  Runtime-swappable launcher surface for cross-axis, channel-grid, desktop, and tabbed shells.
- `src/components/TerminalOverlay.tsx`
  Integrated terminal shell. It owns the tree-based pane/workspace model, keeps PTYs mounted across workspace-tab switches, routes pane-resize behavior through draggable split handles plus the typed terminal command bridge, and keeps the terminal surface memoized and imperative so the hot path stays out of React churn. xterm remains the engine, WebGL is only loaded after a hardware probe passes, and explorer-driven cwd sync still goes through terminal shell-integration commands instead of literal `cd` injection. Reverse terminal-to-explorer sync now also rides the same native shell-integration lane: the Rust PTY host injects per-shell prompt hooks, strips host-owned OSC cwd markers out of terminal output, updates `TerminalShellIntegrationState`, and emits the typed shell-integration event that explorer preview terminals already consume.
- `src/components/terminal/TerminalViewportFx.tsx`
  Pane-local terminal presentation leaf. It is now an idle-only decorative layer for inactive DOM panes and avoids live viewport filtering or compositor-heavy effects on the active terminal surface.
- `src/components/terminal/terminalRendererSupport.ts`
  Small runtime probe for terminal WebGL support. It first tries a strict `webgl2` context, then retries without the major-performance-caveat gate if needed, and still rejects software renderers so `auto` mode does not opt into a slow or fallback-backed GPU path.
- `src/components/ScreenshotsManager.tsx`
  Screenshot capture/editor/library surface. It owns monitor preview orchestration, selection editing, annotation authoring, and gallery actions, but annotated export is now delegated to Rust instead of being rasterized in the browser.
- `src/components/GitManager.tsx`
  Source-control panel surface. It owns the repo rail, working-tree staging/diff actions, ship controls, and the top-level `Changes | History` split, while delegating reusable Git history/branch loading to the runtime seam instead of growing more inline git-command parsing in the component.
- `src/components/pluginRuntime.tsx`
  Packaged frontend plugin runtime loader. It owns the allowlisted module graph for frontend plugins, including package-local relative imports and the host-provided `overlayterm-plugin` bridge helpers.
- `src/components/animationRuntime.tsx`
  Authored shell-motion runtime loader. It normalizes built-in and folder-authored animation modules, renders shell overlay layers with failure isolation, and now exposes the sanitized `src/animation/` MoGraph toolkit through the `overlayterm-animation` runtime import so authored shell motion can reuse host-owned cloners, fields, particle/fluid helpers, subtle motion wrappers, and timeline utilities without importing app internals directly.
- `src/config/interactionMotion.ts`
  Data-driven shell interaction-motion contract. It owns the built-in micro-interaction profile catalog, surface ids, trigger ids, theme/default normalization, user-override precedence, per-surface toggle contract, and the canonical transform/filter/data-attribute payload used by shell surfaces.
- `src/animation/interactionMotion.tsx`
  Shared interaction-motion resolver and pointer binder. It merges the active theme lane, persisted appearance settings, and reduced-motion state into reusable bindings for explorer entries, explorer rail items, preview tabs, panel tabs, top-bar buttons, settings cards, and Motion Lab previews. High-frequency shell UI motion should enter through this hook instead of ad hoc inline transforms.
- `src/components/AppIcons.tsx`
  Shell-wide icon compatibility layer. App chrome should import icons from here instead of `lucide-react` directly so manifest-driven UI icon packs can swap explorer and stock shell glyphs immediately without touching thumbnail generation.
- `src/config/python.ts`
  Data-driven Python runtime config, example presets, sidecar action catalog, and package presets. The `src-python/greeblefs-python-sidecar.json` manifest is the source of truth for the sidecar action list and quick-install package presets exposed to React.
- `src/config/localModels.ts` and `src/config/localModelCatalog.json`
  Data-driven local-model catalog plus typed normalization helpers. This is the canonical source for curated local models, backend-option labels (`auto` / `cpu` / `onnx` / `cuda`), hardware-profile metadata, capability ids, default bindings, and semantic per-root override resolution used by Settings and semantic-search routing.
- `src/config/semanticSearch.ts`
  Data-driven explorer semantic-search config. It owns the canonical `name` / `content` / `semantic` search-mode contract, the search-mode labels/descriptions, the text/code extension registry loaded from `semanticSearchFileTypes.json`, and the runtime defaults loaded from `semanticSearchRuntime.json` for chunking/model/backend selection.
- `src/runtime/moduleRuntime.ts`
  Shared runtime-authored module bridge. It compiles authored TS/TSX module graphs for plugins, theme renderers, wallpapers, shaders, and animations, and now routes serializable compile work through the frontend worker host before falling back to the main thread.
- `src/runtime/workerHost.ts`
  Browser-worker orchestration layer for frontend CPU-heavy tasks. It owns worker-lane lifecycle, per-lane telemetry, fallback-to-main-thread behavior, and the shared request/response bridge used by runtime module compilation.
- `src/runtime/tauriClient.ts` and `src/runtime/explorerBackend.ts`
  Typed frontend bridge for native explorer/media commands. Large 3D preview reads now use raw-byte preview transport commands (`fs_read_preview_bytes` / `cloud_read_preview_bytes`) that return `Uint8Array` payloads instead of base64 strings.
- `src/runtime/gitPanelBackend.ts`
  Shared Git-panel runtime seam. It wraps the existing `git_exec` command for repo-overview loading, local-branch metadata, upstream ahead/behind counts, commit-history parsing, changed-file parsing, and commit patch loading so Git React surfaces do not each reinvent their own git-log parsers.
- `src/components/DevPerformanceHud.tsx`
  Fixed dev-only diagnostics HUD rendered by `App.tsx` whenever the frontend runs in `import.meta.env.DEV` or explicit developer mode. It shows live frame, navigation, CLS, INP, long-task, memory, and frontend worker telemetry for local development, and its visibility now rides a persisted system flag plus a local shell hotkey instead of being permanently forced on in dev sessions.
- `src/components/wallpaperRuntime.tsx`
  Imported image/video wallpapers, authored live wallpaper modules, and theme-wallpaper selection helpers.
- `src/runtime/pluginPanelRequests.ts`
  Shared plugin-panel handoff bridge for explorer/plugin context flows. It persists the latest request payload and dispatches shell-level open-panel events plus panel-specific update events.
- `src/runtime/storageBackend.ts`
  TS bridge for the storage tab. It exposes typed native scan start/poll/list-directory calls, filters local storage roots from the explorer drive inventory, and reuses existing explorer open/reveal/trash/delete operations plus batch delete wiring for storage cleanup actions.
- `src/runtime/fileOperationsWindow.ts`
  Shared file-operations popout bridge. It owns the `file-operations` window label, persisted request/completion payloads, cross-window event names, and the helper that creates or focuses the dedicated popout window.
- `src/runtime/imageEditorRuntime.ts`
  Runtime seam for the embedded preview-pane image editor. It loads the local editor package through the `@img-editor-runtime` alias so the shell can consume the editor at runtime without importing the package internals into the main app typecheck.
- `src/runtime/videoEditorBackend.ts`
  TS bridge for preview-source resolution, ffmpeg proxy generation, and trim export in the preview-pane video flow. Realtime transport still lives in the native video engine bridge and store.
- `src/runtime/videoEngineBackend.ts`
  TS bridge for the native preview-pane video engine. It exposes engine prepare/load/play/pause/stop/seek/loop commands plus the live `VideoEngineStateEvent` subscription.
- `src/runtime/audioWorkbenchBackend.ts`
  TS bridge for explorer audio analysis, native engine transport commands/events, and offline export/batch work. React should talk to this bridge and `src/store/audioEngineStore.ts` instead of browser media APIs or raw invoke strings.
- `src/runtime/audioVstEditorBackend.ts`
  TS bridge for explorer VST editor-session lifecycle. It owns typed session create/rect-sync/focus/destroy calls so the audio workbench does not issue raw VST-host invokes.
- `src/runtime/pdfPreviewBackend.ts`
  TS bridge for explorer PDF preview sessions. It owns typed open/render/save/close calls for the inline PDF workbench so React components do not scatter raw `invoke()` strings or local PDF truth.
- `src/runtime/shaderPreviewBackend.ts`
  TS bridge for explorer shader preview inspection and compile work. It owns typed shader inspect/compile calls so `FileExplorer.tsx` and `ExplorerShaderWorkbench.tsx` do not scatter raw shader-preview invokes or local format normalization logic.
- `src/runtime/spreadsheetWorkbook.ts`
  SheetJS + HyperFormula bridge for spreadsheet import/export, clipboard serialization, sheet mutation, and workbook/tabular save paths.
- `src/runtime/pythonRuntimeBackend.ts`
  Typed frontend seam for the managed Python runtime, persistent sidecar lifecycle, manifest-backed sidecar actions, and embedded `pyo3` execution. New React surfaces should call this layer instead of invoking Python Tauri commands directly.
- `src/runtime/modelManagementBackend.ts`
  Typed frontend seam for shared local-model management. It owns the curated model catalog status, cache-summary reads, and prewarm/download calls so Settings and future AI surfaces do not need to hand-roll Python-sidecar model-management requests.
- `src/runtime/explorerBackend.ts`
  Typed explorer bridge for filesystem/search/task work. In addition to classic name/content search, it now owns the semantic-search command surface (`getSemanticIndexSummary`, `buildSemanticIndex`, `searchSemantic`, `findSemanticSimilar`) so Explorer React code never needs raw invoke strings for AI indexing or similarity work.
- `src/runtime/modelThumbnailBackend.ts` and `src/runtime/modelThumbnailRenderer.ts`
  Frontend GPU-backed 3D model thumbnail generation for the explorer grid. The backend turns file metadata into cache keys, stores rendered poster data URLs through `src/components/explorer/explorerPreviewCache.ts`, and returns a normal `ExplorerEntryThumbnail` with `kind: "image"` so 3D model posters do not require a new explorer thumbnail contract.
- `src/config/accelerationRuntime.ts`
  Data-driven acceleration routing catalog for the cross-provider compute lane. It defines the shell-facing routing modes, workload ids, provider labels, and resolution helpers used to decide whether a workload should prefer CPU, native `wgpu`, or the Python-sidecar CUDA path.
- `src/runtime/accelerationRuntimeBackend.ts`
  Typed TS bridge for the acceleration control plane. It is the only frontend entry point for loading the provider snapshot that composes native GPU status plus Python-sidecar CUDA/AI capability probing.
- `src/components/explorer/explorerPreviewSystem.ts`
  Data-driven explorer preview descriptor resolver. It centralizes preview-kind classification, inline-preview routing, and the shared loading/error/unsupported fallback copy that `FileExplorer.tsx` uses instead of per-extension JSX branches.
- `src/components/explorer/explorerPreviewCache.ts`
  Explorer-local preview cache with a byte budget and oldest-entry eviction. Image/text/model preview payloads should flow through this seam so cache invalidation stays path-aware and memory pressure handling stays consistent across preview lanes.
- `src/components/explorer/explorerEditSession.ts`
  Shared explorer draft/session helper for persisted editor drafts, validator wrappers, draft-key moves during rename, and the standard “draft preserved; use Save to retry” save-failure messaging used by preview editors.
- `src/config/explorerArchives.ts`
  Data-driven archive registry for the explorer. It is the TS-side source of truth for which local archive suffixes should route through native extraction/opening and how archive folder labels are derived.
- `src/config/filePreview.ts`
  Data-driven preview/edit gate for explorer media, text, spreadsheet, and shader surfaces. It centralizes preview MIME mapping, direct-playback allowlists, spreadsheet exclusions, the explicit shader-workbench extension routing that keeps `wgsl` / `hlsl` / `spv` out of the generic plain-text editor, and the 3D preview source/proxy ceilings that now allow modern-size model reads before proxy fallback engages.
- `src/config/spreadsheet.ts`
  Data-driven spreadsheet extension router and file-kind helper shared by the preview shell, save/export path, and search routing.
- `src/config/explorerThumbnails.ts`
  Data-driven explorer thumbnail policy for generated image/code/shader/audio/video thumbnails, hover-scrub frame counts, and batch sizing limits.
- `src/config/gpuRuntime.ts`
  Frontend GPU-tier policy metadata for the native offload lane. It defines the shell-facing labels and descriptions for `auto`, `safe`, `integrated`, and `discrete`.
- `src/runtime/gpuRuntimeBackend.ts`
  Typed TS bridge for the native GPU runtime. It is the only frontend entry point for configuring the native `wgpu` runtime and subscribing to adapter/tier/workload status.
- `src/windows/FileOperationsWindowApp.tsx`
  Themeable secondary window for destination picking and long-running explorer file-operation visibility. It shares the same appearance/runtime stack as the main shell but stays scoped to copy/move flows and the explorer task feed.
- `src/store/explorerStore.ts`
  Persisted explorer rail, named explorer session snapshots, and explorer-local workspace state for tabs plus slot-based workspace layouts.
- `src/store/explorerTaskStore.ts`
  Explorer-local task-center store. It hydrates durable task history from the Rust backend, subscribes to live explorer task progress events, and owns the open/close state plus retry/cancel/clear helpers used by the explorer toolbar badge and command palette.
- `src/store/settingsStore.ts`
  Persisted layout/profile settings, wallpaper/shader/animation overrides, icon-theme selection, app-vs-dock theme selection, the native `windowMode` presentation toggle, the native GPU tier override, machine-level developer-mode behavior, and the new `settings.home` contract (active Home pack id, usage-telemetry toggle, per-pack state blobs, and active preset selection by pack id). Home configuration should live here rather than inside ad hoc component-local storage.
- `src/store/explorerStore.ts`
  Persisted explorer rail, named explorer session snapshots, and explorer-local workspace state for tabs plus slot-based workspace layouts. Explorer search state now persists the explicit `searchMode` enum, with legacy `searchIncludeContent` payloads normalized forward on hydration.
- `src/store/gpuRuntimeStore.ts`
  Shell-side source of truth for the native GPU runtime snapshot, hydration, event subscription, effective tier, and workload fallback telemetry surfaced in Settings.
- `src/store/accelerationRuntimeStore.ts`
  Shell-side source of truth for the cross-provider acceleration snapshot, hydration state, and routing-mode-aware provider availability surfaced in Settings. Future CUDA/AI/media-search surfaces should hydrate this store instead of inventing their own provider probe loop.
- `src/store/videoEngineStore.ts`
  Shell-side source of truth for the native video engine snapshot, hydration, event subscription, and transport helper wrappers used by `ExplorerVideoEditor.tsx`.

## Theme / Workbench Architecture

- Overlay themes still own the global palette, effects, fonts, icon theme, visuals, and shader/motion defaults.
- Top bars are now a first-class shell subsystem instead of an implicit side effect of `theme.workbench.topBarStyle`:
  - `src/config/topBars.ts` defines the built-in catalog, the control-zone schema (`leadingControls`, `navigationShortcuts`, `trailingControls`), and the active resolution order: explicit user pin, `theme.defaultTopBarId`, legacy `theme.workbench.topBarStyle`, then built-in fallback
  - `src/config/topBarPackages.ts` owns the standalone `top-bars/` loader, so authored top bars no longer need to hide inside theme packages just to exist on disk
  - `src/components/WorkbenchTopBar.tsx` renders the active top bar from that data-driven definition instead of hardcoding one shell-header workflow in `App.tsx`
  - `src/store/settingsStore.ts` now persists `settings.appearance.activeTopBarId`; `null` means "follow the active theme path"
  - `SettingsPage.tsx` owns top-bar selection in a dedicated `Top Bars` section, plus the open/refresh affordances for the standalone `top-bars/` root
  - Theme packages can still contribute top bars and choose `theme.defaultTopBarId`; the authored `top-bars/` root and theme package contributions both flow through the same resolver
- Settings navigation is now catalog-driven instead of hardcoded section ids:
  - `src/config/settingsNavigation.ts` defines the canonical settings-section keys, labels, ordering, overview summaries, and keyword metadata used by the rail, overview cards, and command palette
  - `src/store/settingsStore.ts` persists `activeSection` as a typed `SettingsSectionKey`, and `SettingsPage.tsx` reads that store value directly so palette deep-links can land on sections like `Icons` or `Top Bars` without component-local routing state
  - `src/App.tsx` builds section-jump command-palette entries from the same catalog instead of hardcoding menu paths, which keeps future settings sections discoverable as soon as they are added to the catalog
- Explorer Home is now a first-class app-owned surface instead of a synonym for the OS home directory:
  - the canonical startup route is `greeblefs://home`
  - `FileExplorer.tsx` special-cases that route as a rendered surface, not a directory listing
  - the machine home directory still appears inside Home as quick access / navigation target, but explicit filesystem startup paths remain valid
  - Home packs are independent from app themes: themes may suggest `defaultHomePackId`, but user pack selection and pack state persist through `settings.home`
  - usage telemetry for `most used` and `recent` folders is local-only and stored through the explorer metadata lane in `src-tauri/src/explorer_pro_commands.rs`
- Interaction motion is now a first-class appearance lane separate from authored shell-transition modules:
  - `src/config/interactionMotion.ts` defines the built-in `subtle`, `spring`, and `playful` profiles, the v1 shell surface catalog, the theme recipe contract, and the resolver precedence `user override > theme default > built-in subtle`
  - `src/store/settingsStore.ts` persists `settings.appearance.interactionMotionEnabled`, `interactionMotionPresetId`, `interactionMotionIntensity`, and `interactionMotionSurfaceOverrides`; `null` preset means "follow theme"
  - `src/animation/interactionMotion.tsx` is the only supported integration path for high-frequency shell controls. Components should use the shared surface binder instead of writing one-off `transform`/`transition` hover logic inline
  - `src/components/SettingsPage.tsx` exposes this lane inside `Animations` as `Interaction Motion`, including global enablement, preset selection, intensity scaling, per-surface toggles, and a compact `Motion Lab` preview harness that exercises the same resolver as the live shell
  - folder-authored modules under `animations/` and `src/components/animationRuntime.tsx` remain the shell-transition / authored-overlay lane; they are not the default engine for explorer rows, rail chips, tabs, or other hot-path shell controls
- Icon theming is now a first-class managed subsystem instead of an explorer-only concern:
  - `src/config/iconTheme.ts` resolves the canonical built-in icon map, folder/file matchers, UI icon slots, and merge rules for theme-default or user-selected icon packs
  - `src/config/canonicalIconTheme.json` now advertises the full built-in app-chrome slot surface via `uiIcons`, not just file/folder glyph ids; the built-in manifest should mirror the live `AppIcons.tsx` exports so theme authors can discover every overridable shell glyph from one place
  - `src/config/iconThemePackages.ts` discovers dedicated `icon-themes/` packages whose `icon-theme.json` / `manifest.json` files can override explorer file/folder ids plus shell UI icon slots
  - Top-bar and nav-tab panel icons now resolve through reserved `uiIcons.panel_<normalized-panel-id>` slots first, then fall back to generic UI slots like `folder_tree`, `hard_drive`, `sticky_note`, `camera`, `puzzle`, or `shell`
  - `icon-themes/Zen/` is the first full repo-local example pack; use it as the reference shape for authored icon themes
    - Zen now demonstrates both built-in panel slots like `panel_storage` / `panel_notes` / `panel_screenshots` and folder-plugin panel slots like `panel_drawable_canvas` / `panel_chronorift` / `panel_sketchfab`
    - `icon-themes/Zen/ui/` is the app-chrome coverage layer for the package; it now includes explicit SVGs for every `AppIcons.tsx` slot plus dedicated panel extras like `panel_storage`, `panel_drawable_canvas`, and `panel_sketchfab`
    - `packages/UI/scripts/generate_greeblefs_zen_ui_icons.py` is the reproducible coverage generator. Add new `AppIcons.tsx` slots there, rerun the script, and commit the generated `Zen/ui/*.svg` plus manifest updates so future packs see the exact SVG surface they need to implement
    - The Zen manifest is intentionally one-to-one for app chrome slots now. Avoid aliasing UI slots back onto older generic ids if the goal is to keep the pack as the gold example for complete tweakability
  - `scripts/sync-canonical-ui-icons.mjs` is the built-in manifest sync path. When `AppIcons.tsx` gains a new slot, rerun it so the canonical theme keeps advertising the full overridable UI surface
  - `src/components/AppIcons.tsx` is the only supported app-chrome icon import surface; direct `lucide-react` imports bypass the icon-theme system
  - `src/store/settingsStore.ts` persists `settings.appearance.activeIconThemeId`, while `src/config/appearance.ts` injects the selected icon pack into both the app and dock appearance channels so icon swaps land immediately in the main shell and the `file-operations` popout
  - `SettingsPage.tsx` owns icon-pack selection and folder-icon authoring in the dedicated `Icons` section; the Explorer section should no longer grow icon-pack management UI
- `src/config/pilotThemeContract.ts` is the source of truth for the boring default shell:
  - `pilot-dark` and `pilot-light` are the canonical built-in defaults
  - all built-in themes inherit the same pilot workbench, explorer, and dock recipe baseline unless they explicitly override it
  - built-in theme switches can also carry appearance/explorer/layout reset defaults instead of only changing palette data
- Theme packages can ship a wallpaper asset through `theme.assets.backgroundUrl`; that asset is now the theme-default wallpaper layer instead of only preview metadata.
- Package-theme curation is now host-owned instead of being implied by package manifests alone:
  - `src/config/themeCatalogCuration.ts` defines the current official pilot set and the non-flagship tiers
  - packaged themes carry computed `catalog` metadata through `LoadedOverlayThemePackage`
  - `SettingsPage.tsx` groups the catalog into `Official Pilot Suite`, `Built-In Baselines`, and `Legacy / Lab Archive` instead of presenting one flat wall
  - the current official pilot package set is `vector-monolith`, `cyber-nexus-hud`, `celestial-astrolabe`, and `clarity-line`
- Theme packages can also ship a generalized engine manifest through `presentation`, `layoutPrimitives`, `navigationPatterns`, and `renderStyles`.
- `src/config/appearance.ts` now preserves compiled engine manifests on the active theme so recipe resolution can use them at runtime.
- Workbench theming is now a first-class recipe layer under `theme.workbench`.
- `theme.workbench` supports optional recipe seeds like `workbench`, `xmb`, and `channel-grid`, plus explicit `layoutPrimitiveId` / `navigationPatternId` / `renderStyleId` bindings and app-wide overrides for:
  - command palette chrome
  - terminal shell chrome
  - terminal renderer mode and pane FX recipe
  - settings shell chrome
  - shared tabs and button treatment
  - shell insets, radii, and panel spacing
  - workbench-scoped CSS vars
- Treat `theme.workbench.topBarStyle` as a legacy visual hint for the standalone top-bar resolver, not as the only way to choose the shell header. New top-bar workflow work should land in `src/config/topBars.ts` plus `SettingsPage.tsx`, with themes optionally selecting defaults through `theme.defaultTopBarId`.
- Explorer theming is now a first-class recipe layer under `theme.explorer`.
- `theme.explorer` supports optional recipe seeds like `workbench`, `xmb`, and `channel-grid`, plus explicit `layoutPrimitiveId` / `navigationPatternId` / `renderStyleId` bindings and local overrides for:
  - chrome style
  - `chromeLayoutId` for explorer control composition
  - `defaultModeProfileId` for theme-driven explorer mode defaults
  - breadcrumb style
  - preview style
  - status bar style
  - rail position and brand label
  - preferred explorer view mode / experimental mode
  - metrics
  - surfaces
  - typography
  - raw explorer-only CSS vars
- When no recipe seed is provided, `src/config/workbenchTheme.ts` and `src/config/explorerTheme.ts` now derive shell defaults from the active engine-manifest presentation, layout primitive, navigation pattern, and render style.
- Render styles are no longer passive metadata. `src/config/workbenchRenderRuntime.ts` now maps the active theme engine state and active layout shell blueprint into a live interaction runtime:
  - `workbench-tabs`
  - `cross-axis-media`
  - `channel-launcher`
  - `desktop-stack`
- `App.tsx` now uses that runtime to swap navigation behavior and content presentation, and `OverlayPanelDefinition.navigation` metadata in `src/panels/panelRegistry.tsx` gives render runtimes enough structure to regroup panels without hardcoded one-off app logic.
- Custom theme renderers now run against a renderer-owned shell contract instead of implicitly layering custom launchers on top of shared chrome:
  - `src/components/themeRendererShellModel.ts` builds a normalized `shellModel` with launcher groups, utility actions, viewport metrics, and clamped shell regions for `chrome`, `launcher`, `content`, and pinned sides
  - `src/components/themeRendererRuntime.tsx` exposes that `shellModel` plus explicit `surfaceOwnership` flags on each renderer definition
  - `App.tsx` uses `surfaceOwnership` to suppress default launcher chrome, pinned shells, and duplicate wallpaper/content framing when the renderer claims those surfaces
  - ownership only suppresses the host's automatic placement; a renderer can still deliberately pull host surfaces into its own layout through `host.renderDefaultNavigationSurface()`, `host.renderPinnedPanels()`, and `host.renderDefaultContentSurface()`
  - bundled renderers should prefer `host.shellModel` and `host.renderUtilityActionsSurface()` over raw `host.panels` + `host.renderChromeBar()` composition where possible
- The retro-console custom renderers are now being rewritten as distinct shell languages instead of palette-only variants:
  - `themes/dreamcast-skyline/renderers/dreamcast-skyline.tsx`
  - `themes/gamecube-helix/renderers/gamecube-helix.tsx`
  - `themes/gamecube-orbital/renderers/gamecube-orbital.tsx`
  - `themes/gamecube-prism/renderers/gamecube-prism.tsx`
  - they now anchor all geometry to normalized shell regions and renderer-owned launcher/content surfaces so layout cannot drift off-screen
- The shared top bar is now renderer-aware instead of universally assuming launcher ownership:
  - `TopBar` strips launcher/menu/tab-strip chrome when the active renderer claims `launcher`, so themes with custom radial/channel/XMB launchers no longer render a second launcher system through `host.renderChromeBar()`
- `src/components/WorkbenchNavigationSurface.tsx` now takes its rail width from `src/config/workbenchRenderRuntime.ts` instead of hardcoded per-runtime widths inside the component, so launcher sizing stays in the runtime contract.
- `themes/celestial-astrolabe/renderers/astrolabe.tsx` was rebuilt as a full-screen observatory shell:
  - the content stage now owns the center of the viewport
  - launcher groups/panels orbit the stage instead of living in a boxed sidebar column
  - the lower deck is a full-width control band, so the theme uses the viewport more like a flagship shell and less like a themed three-column dashboard
- Wallpaper rendering is now a first-class layered pass in `App.tsx`:
  - theme wallpaper asset or user-selected wallpaper renders as the base layer
  - `theme.effects.backgroundImage` renders as the theme effect layer above the wallpaper
  - shader background/border surfaces still render above wallpapers
  - `theme.visuals` still render above the shader background
- Wallpaper selection is part of the persisted appearance contract:
  - `settings.appearance.activeWallpaperId === null` follows the active theme wallpaper
  - `settings.appearance.activeWallpaperId === 'none'` disables the wallpaper layer
  - any other id targets an imported or authored wallpaper in `wallpapers/`
- Wallpapers now support three sources:
  - theme asset wallpapers from `theme.assets.backgroundUrl`
  - imported media wallpapers in `wallpapers/` (`png`, `jpg`, `gif`, `webp`, `svg`, `mp4`, `webm`, etc.)
  - authored live wallpaper runtime modules in `wallpapers/` (`ts`, `tsx`, `js`, `jsx`)
- The shell now resolves two appearance lanes from the same theme catalog:
  - `settings.terminal.windowMode === 'windowed'` selects the app lane
  - `settings.terminal.windowMode === 'overlay'` selects the dock lane
  - `settings.appearance.dockThemeMode === 'follow-app'` reuses the active app theme as the dock base theme, then merges any optional `theme.dock.workbench` / `theme.dock.explorer` recipe overrides
  - `settings.appearance.dockThemeMode === 'override'` resolves the dock lane from `settings.appearance.activeDockThemeId`, with safe fallback to the active app theme when the dock override id is missing or invalid
  - `src/config/appearance.ts` returns both `app` and `dock` channels and exposes the currently active channel based on `windowMode`
- Theme selection now has an explicit normalization path in `src/store/settingsStore.ts`:
  - `applyThemeSelection()` is the correct path for app-theme switches
  - `applyDockThemeSelection()` is the correct path for dock override switches
  - built-in app-theme switches can reset theme-managed appearance overrides plus explorer/layout presentation state, but they intentionally preserve navigation truth like current path, history, and search
  - raw `updateAppearance({ activeThemeId })` should not be used for normal built-in theme switching because it skips that normalization contract
- Theme packages can now declare dock-specific recipe overlays under `theme.dock`:
  - `theme.dock.workbench` tunes dock-shell chrome without changing the application shell recipe
  - `theme.dock.explorer` tunes dock explorer chrome, metrics, and layout defaults without forking explorer domain behavior
  - `src/config/themePackages.ts` exposes dock capability metadata so Settings can label dock-aware themes
- Active explorer shell controls now belong to the explorer toolbar / omnibox row instead of the shared command-center top bar:
  - sources visibility
  - focus search
  - experimental mode
  - explorer mode picker
  - explorer view mode
  - preview toggle
- Explorer chrome composition is now a distinct layer from explorer pane composition:
  - `src/config/explorerShellLayouts.ts` still owns pane structure like rail visibility, preview side, and live session sizing behavior
  - `src/config/explorerModeProfiles.ts` owns the curated user-facing explorer modes (`balanced`, `navigator`, `focus`, `inspector`) and maps them onto pane-layout ids plus chrome-layout ids
  - `src/config/explorerChromeLayouts.ts` owns topbar/toolbar/workspace-header/rail-header/preview-header/status-strip control zones, order, and per-layout adaptive placement
  - `settingsStore.ts` persists per-theme `modeProfileOverridesByThemeId`, keyed by theme id, so users can retune a theme's default explorer mode without mutating live explorer session state
  - `settingsStore.ts` persists per-theme `chromeLayoutOverridesByThemeId`, keyed by theme id and `chromeLayoutId`
  - `FileExplorer.tsx`, `ExplorerWorkspace.tsx`, `ExplorerSideRail.tsx`, and the preview panel should render resolved chrome surfaces instead of hardcoded button sequences
  - zone-based chrome edit mode moves controls across those surfaces by rewriting override snapshots; it is not a free-pixel docking system
- `settings.system.developerMode` is now the live-reload gate for expensive development-only watchers:
  - plugin directory watch / fallback polling in `useFolderPluginRuntime.ts`
  - authored shader polling in `App.tsx`
  - authored animation polling in `App.tsx`
  - explorer entry-size root watching in `FileExplorer.tsx`
- `App.tsx` now also renders a fixed `DevPerformanceHud` in local development so frame and browser telemetry stay visible without a manual diagnostics toggle.
- Frontend worker execution is now a first-class runtime lane instead of an ad hoc optimization:
  - `src/runtime/workerHost.ts` is the only place that should create browser `Worker` instances for shared shell/runtime workloads
  - runtime-authored module transpilation now uses the `runtime-module` worker lane, while final React/component materialization still stays on the main thread
  - worker tasks must stay fully serializable; React elements, host APIs, DOM state, and Tauri handles must not cross the worker boundary
  - worker lanes must always keep a safe fallback path so test mode, unsupported environments, or worker boot failures do not break plugin/theme/shader loading
  - `DevPerformanceHud.tsx` now surfaces worker activity, fallback count, error count, and last-task duration so frontend threading changes are observable during local performance work
- Managed content roots now split by runtime mode:
  - `tauri dev` keeps repo-relative `plugins/`, `themes/`, `top-bars/`, `home-packs/`, `icon-themes/`, `shaders/`, `animations/`, `wallpapers/`, `notes/`, and `Screenshots/` so authoring stays in the workspace
  - installed/release builds resolve those directories under Tauri `AppLocalData` instead of creating top-level `$HOME/plugins`, `$HOME/themes`, `$HOME/top-bars`, `$HOME/home-packs`, `$HOME/icon-themes`, `$HOME/shaders`, `$HOME/animations`, `$HOME/wallpapers`, `$HOME/notes`, or `$HOME/Screenshots`
  - `src/config/appContentDirectories.ts` owns that bootstrap, the managed-content catalog, and the legacy-home-path detection/migration rules
  - `src/App.tsx` and `SettingsPage.tsx` consume the managed-content catalog so workspace roots and folder-open commands stay discoverable as new managed roots are added
  - release migrations now also carry old `co.overlayterm.app` app-local directories forward into `co.greeblefs.app`
  - layout auto-probe now prefers `~/.greeblefs/greeblefs.layouts.{json,toml}` before older `.greeble` / `.overlayterm` fallbacks
- Developer telemetry now follows the dev/release split too:
  - `bun run tauri dev` writes telemetry sessions into repo-local `.telemetry/` so traces stay in the workspace for agents and developers
  - installed/release builds continue using Tauri app-log/app-data storage for telemetry
  - `src-tauri/src/telemetry.rs` owns the path resolution, so frontend code does not need to guess where traces land
- Production/default behavior is manual refresh:
  - Plugins panel `Refresh`
  - Settings `Refresh Shaders`
  - Settings `Refresh Animations`
- Layout profiles still shape the shell through `shellBlueprint`, `chrome`, `controlDock`, `interaction`, and optional pinned panels. They do not define a separate content-browser drawer contract.
- `FileExplorer.tsx` consumes the resolved explorer recipe and applies it to:
  - shell chrome
  - rail placement
  - toolbar treatment
  - entry hover/selection behavior
  - grid/list/table metrics
  - adaptive semantic density metrics
  - preview panel chrome
  - status bar visibility/treatment
- `FileExplorer.tsx` also layers user-controlled explorer session state on top of the theme recipe:
  - persisted inline preview enable/disable
  - persisted generated-thumbnail toggles and video hover-scrub frame count
  - persisted path/history/search/layout/preview/source-panel state
  - legacy `session.shellLayoutId` remains the pane-layout compatibility fallback for older sessions
  - active explorer mode now resolves through theme default -> per-theme mode override -> legacy `session.shellLayoutId` -> built-in `balanced`
  - mode profiles can hide the rail or move the preview pane without requiring a theme swap, while live widths and source visibility remain session-owned
- Dock mode is now a distinct presentation subsystem over the same explorer/runtime truth layer:
  - `App.tsx` still forces the explorer forward when entering overlay mode, but now passes `explorerLayoutMode: 'dock'`
  - dock mode keeps the same explorer sessions, filesystem data plane, tabs, and workspace state as app mode
  - dock mode can diverge in workbench recipe, explorer recipe, metrics, and chrome layout without becoming a separate filesystem subsystem
  - the dock layout contract keeps inline preview closed so the overlay reads like a focused content browser instead of a zoomed-out app shell
  - `src/config/layoutProfiles.ts` still normalizes legacy persisted `compact-dock` layout values to `dock` for compatibility
- Linux Wayland dock mode now has a dedicated native host path instead of pretending a normal top-level window can behave like a panel:
  - `src-tauri/src/wayland_dock.rs` owns the separate `dock` webview host and applies `gtk-layer-shell` configuration for anchored panel behavior
  - `src-tauri/src/window_commands.rs` exposes the Wayland dock host status plus a dock-layout command so the frontend can switch between the normal app window path and the layer-shell dock path
  - `src/runtime/windowHost.ts` is the frontend routing contract for `main` vs `dock`, host-targeted events, and the global-shortcut ownership rule
  - `App.tsx` now decides which host owns the active presentation and forwards `Ctrl+Space` / mode-switch requests across windows instead of trying to show both modes from the same native window on Wayland
  - `src/store/settingsStore.ts` and `src/store/explorerStore.ts` rehydrate persisted state on `storage` events so the hidden host stays in sync with the active host during mode handoff
- `src/store/explorerStore.ts` supports named explorer sessions, and the dock now reuses those sessions through its own appearance/layout lane rather than through a separate drawer subsystem.
- The explorer now has a local workspace shell separate from the global workbench tabs:
  - `ExplorerWorkspace.tsx` owns explorer tabs, the shared focused-pane workspace strip, and slot-based `single` / `split` / `quad` rendering
  - each tab maps to a distinct `ExplorerInstanceId`, so the existing `FileExplorer` session model still owns path/history/search/preview state
  - `explorerStore.ts` persists the workspace snapshot (`tabs`, pane activity, layout mode, focused pane, column split ratio, row split ratio) alongside the underlying named sessions
  - workspace normalization is collapse-safe: when the UI drops from `quad` to `split` or `single`, tabs from hidden panes are reassigned into visible panes instead of being stranded in invisible left/right slots
  - commander-style cross-pane actions are an explicit bridge, not header-owned filesystem logic: `FileExplorer.tsx` publishes live pane path/selection snapshots upward, and `ExplorerWorkspace.tsx` sends navigation / refresh / selection-transfer requests back down into the active explorer instance
- `FileExplorer.tsx` now takes `workspacePaneCount` from `ExplorerWorkspace.tsx` so multi-pane layouts can compact toolbar chrome, suppress the explorer status bar, and hide the side preview surface until the workspace returns to `1-Up`.
- `FileExplorer.tsx` shares directory/search result caches across explorer sessions so alternate surfaces do not duplicate backend reads unless a mutation invalidates the cache.
- `FileExplorer.tsx` now treats folder navigation as an atomic commit: slow or stale directory loads should not blank the file area or partially switch path state. Keep the previous folder surface mounted until the winning listing is ready, then commit path/history/entries together.
- `FileExplorer.tsx` now settle-batches viewport enrichment work so visible-entry size measurement and native-icon resolution only launch after a short scroll idle window instead of hammering Tauri on every transient virtualized viewport shift.
- `FileExplorer.tsx` owns both file-centric actions and explorer-local shell controls, so the shared top bar stays panel-agnostic while the explorer keeps its mode/source/preview controls adjacent to the path/search field.
- Previewable media is now split into three host-owned explorer lanes instead of one generic browser fallback:
  - image editing stays in `ExplorerImageEditor.tsx` through the local package seam
  - audio playback/editing now lives in `ExplorerAudioWorkbench.tsx`, with a preview-first player surface, an explicit edit-mode workbench, and a wildcard `VST` workflow tab; transport truth still lives in `src-tauri/src/audio_engine.rs` and flows through `src/store/audioEngineStore.ts`
  - the browser `<audio>` lane and preview-proxy workaround are no longer the explorer playback path; the preview pane now talks to a CPAL + Symphonia native engine and only uses SoX for offline mutation
  - video playback/editing now lives in `ExplorerVideoEditor.tsx`, but transport truth lives in `src-tauri/src/video_engine.rs` and flows through `src/store/videoEngineStore.ts`
  - video preview now uses a real `<video>` paint surface again, but the transport/timeline truth still lives in Rust; `src-tauri/src/video_commands.rs` probes the file, allows direct playback only for safe codec/container pairs, and generates MP4 preview proxies for hostile formats
  - PDF preview/editing now lives in `ExplorerPdfWorkbench.tsx`, but document truth/render/save live in `src-tauri/src/pdf_commands.rs` and flow through `src/runtime/pdfPreviewBackend.ts`
  - the PDF lane is intentionally split: Rust owns session truth, page raster, AcroForm extraction, and save/writeback; React only owns page-space overlay UI and preview-pane chrome state
- Local archive handling is now a first-class explorer workflow instead of a pure OS-shell fallback:
  - `src/config/explorerArchives.ts` defines the supported local archive suffix registry (`zip`/`cbz`/`jar`/`apk`, `7z`, `tar`, `tar.gz`, `tar.bz2`, `tar.xz`, `gz`, `bz2`, `xz`) plus the default extracted-folder naming rules
  - `src-tauri/src/archive_ops.rs` owns the actual Rust extraction logic, including cache-backed archive opening and collision-safe extraction into the current folder
  - `src/runtime/explorerBackend.ts` is the only TS bridge for archive opening/extraction; `FileExplorer.tsx` should request archive actions there instead of calling raw commands
  - opening a supported local archive from the explorer now extracts it into a cache-backed folder and navigates the explorer there, while context menus expose `Extract Here` and `Extract to "<name>"/`
- `FileExplorer.tsx` had a dev-only infinite update loop risk in the virtualized entry-size and native-icon batching effects because in-flight `Set` state was being cleared/re-added on every render. Those effects now leave in-flight batches intact until async completion.
- Explorer Pro metadata and long-running utilities now route through Rust instead of TS-only persistence:
  - `src-tauri/src/explorer_pro_commands.rs` owns app-managed trash + undo, batch rename, duplicate-scan lifecycle, tags, and saved searches
  - `src-tauri/src/fs_commands.rs` now also owns the durable explorer task registry used by copy/move/delete jobs plus the retry/cancel/history command surface exposed through Specta
  - `src-tauri/src/fs_commands.rs` also owns explorer metadata helpers for recursive sizes, checksums, item-property snapshots, and fuzzy jump filtering
  - `src-tauri/src/audio_engine.rs` owns native explorer playback through a CPAL output stream, Symphonia decode with an ffmpeg fallback for formats Symphonia cannot open directly, rubato resampling, deck mixing, loop/gain/rate transport state, and `AudioEngineStateEvent`
  - the audio engine snapshot now also carries `activePluginPath` plus live `vstParameters` per deck, and VST load failures now flow back through deck error state instead of rejecting the whole preview workflow
  - `src/store/audioEngineStore.ts` is the shell-side source of truth for engine snapshots, hydration, and event subscription; components should not own playback state locally
  - `src-tauri/src/video_engine.rs` owns explorer video transport state, source validation, metadata probing, deck-`B` audio linkage/fallback, loop-aware play/pause/seek state, and `VideoEngineStateEvent`
  - `src-tauri/src/video_commands.rs` owns `ffprobe`/`ffmpeg` preview-source resolution, preview-proxy generation, and MP4 trim export for the explorer video lane
  - `src/store/videoEngineStore.ts` is the shell-side source of truth for video-engine snapshots, hydration, and event subscription; components should not own video transport state locally
  - `src-tauri/src/pdf_commands.rs` owns explorer PDF preview sessions, Pdfium page raster, AcroForm field extraction, overlay-annotation writeback, and overwrite-in-place save semantics for the inline PDF lane
  - `src-tauri/src/gpu_runtime/` owns the native `wgpu` offload subsystem: one long-lived device/queue, adapter capability probing, `safe` / `integrated` / `discrete` tier resolution, an internal workload registry, WGSL kernel loading, queue/fallback telemetry, and CPU-safe fallback semantics
  - the v1 GPU workloads are intentionally narrow and host-owned: image thumbnails, image editor preview rendering, audio waveform reduction, audio spectral-band reduction, and audio spectrogram rasterization
  - `src/runtime/gpuRuntimeBackend.ts` + `src/store/gpuRuntimeStore.ts` are the only TS entry points for configuring or observing that native GPU runtime; React surfaces should not start their own ad hoc native GPU control flows
  - `src-tauri/src/acceleration_runtime.rs` is the higher-level acceleration control plane. It composes the native `wgpu` runtime snapshot with Python-sidecar CUDA/AI probing, publishes provider/workload availability through Specta, and owns routing-mode-aware status for future media, indexing, inference, similarity, and file-operation offload work.
  - `src/runtime/accelerationRuntimeBackend.ts` + `src/store/accelerationRuntimeStore.ts` + `src/config/accelerationRuntime.ts` are the only TS entry points for deciding which provider should own a cross-provider workload. React surfaces should not hardcode their own “CUDA vs native vs CPU” decision trees.
  - `src-tauri/src/audio_commands.rs` now owns offline-only audio analysis/export/batch work plus vendored SoX runtime extraction and explorer task cancellation/retry hooks
  - the audio lane is intentionally split:
    - native playback and deck transport live in Rust without the webview media stack
    - SoX stays as the offline trim/fade/normalize/convert/spectrogram utility
    - `ffmpeg` remains the codec bridge for formats the vendored SoX bundle cannot read/write on a given platform (for example Linux `mp3`)
    - VST3 discovery filters to host-ready binaries in `src-tauri/src/vst_commands.rs` using `crates/vst-host`, while `src-tauri/src/vst_host_runtime.rs` currently owns session bookkeeping and host-rect sync for future inline editor attachment
    - on Linux and macOS, `crates/vst-host` must activate the module through the platform entry hook before touching the factory (`ModuleEntry` on Linux, `bundleEntry` on macOS). If a real VST3 crashes during `countClasses()` or `getClassInfo()`, check module activation and module-exit ordering before assuming the UI or Tauri command layer is at fault
  - the video lane is intentionally split:
    - native transport and preview-frame state live in Rust without the webview media stack
    - `src-tauri/src/video_commands.rs` keeps ffmpeg-backed trim export and compatibility preview-proxy helpers as the offline mutation lane
    - `src/runtime/videoEngineBackend.ts` + `src/store/videoEngineStore.ts` are the only TS entry points for realtime video transport
  - `src-tauri/src/thumbnail_commands.rs` owns rich explorer thumbnail generation and caching for image posters, code cards, shader spheres, audio waveform/spectral thumbnails, and video poster + hover-scrub frame sequences.
  - `src-tauri/src/thumbnail_commands.rs`, `src-tauri/src/image_commands.rs`, `src-tauri/src/audio_engine.rs`, and `src-tauri/src/audio_commands.rs` now attempt the native GPU runtime first where appropriate, but every shipped path still keeps its CPU fallback so unsupported adapters do not break explorer flows
  - `src/runtime/explorerBackend.ts` is the only TS bridge for `fs_read_entry_thumbnail`; React should request generated thumbnails there instead of decoding files, probing media, or shelling out from components.
  - `src/runtime/explorerBackend.ts` is also the only TS bridge for batch rename preview/apply, checksum calculation, item properties, fuzzy jump filtering, and terminal shell-integration commands used by explorer surfaces
  - local transfer UX now has a two-step contract instead of silent collision auto-rename:
    - `fs_plan_transfer_items` reports pending name collisions before paste/drag/pane transfers run
    - `fs_transfer_items` accepts explicit collision policies: `keep_both`, `replace`, and `skip`
    - transfer results now report both the collision policy used and whether a source was actually transferred or skipped
  - `src/runtime/explorerBackend.ts` is the only TS entry point for explorer task list/retry/cancel/clear operations; React surfaces should not call raw `invoke(...)` for task actions
  - `src/components/explorer/ExplorerTaskStatusBadge.tsx` is now an explorer-local Task Center popover instead of a transient badge-only indicator, and it is intentionally scoped to the explorer chrome rather than a global shell panel
  - `src/components/explorer/ExplorerTaskCenterContent.tsx` is the shared Task Center renderer used by both the inline explorer popover and the dedicated file-operations popout window
  - `src/runtime/fileOperationsWindow.ts` plus `src/windows/FileOperationsWindowApp.tsx` are now the shell-owned copy/move popout path:
    - `FileExplorer.tsx` can issue explicit `Copy To...` / `Move To...` requests into the popout
    - successful transfers publish completion events so other explorer instances can refresh source and target folders without inventing a second transfer backend
    - the popout is destination-picking and task-visibility UI only; transfer truth still stays in Rust plus `src/runtime/explorerBackend.ts`
  - tags and saved searches live under Tauri app-local explorer metadata
  - trash currently uses a GreebleFS-managed trash root so restore locations stay deterministic across platforms
- Explorer drag behavior now defaults to native file export while keeping internal drop metadata available:
  - plain explorer drag starts the native drag bridge and still publishes `application/x-overlayterm-paths` for in-app drops
  - `Shift` forces an internal-only explorer drag
  - breadcrumb chips now accept internal drop targets, so operators can move/copy directly onto ancestor folders without navigating first
  - native drag previews use the dragged item's native icon when available, with a generated file-shaped fallback instead of the app icon
- `ExplorerSideRail.tsx` is now navigator-first instead of bookmark-authoring-first:
  - the rail header foregrounds the current location and pinned-count summary
  - the `Drives` section now doubles as a lazy local folder tree, with drive-root expansion and nested folder navigation backed by the same cached directory listings used by the main explorer
  - bookmark search is always available
  - bookmark structure editing, category authoring, recolor, rename, and delete controls only appear in `Manage` mode
  - this keeps the default rail lighter in dock mode without removing the deeper bookmark tooling
- Overlay monitor placement is now resolved from the current or last-active monitor instead of always using the primary monitor, and `computeOverlayWindowLayout()` now left-anchors the overlay on X instead of centering it.
- Overlay/dock mode now treats position as edge-owned state:
  - `src/config/overlayWindow.ts` exposes `computeAnchoredOverlayWindowLayout()` so current overlay bounds can preserve size without preserving stale X/Y drift
  - `src/App.tsx` re-applies dock geometry after show on Linux so WMs that recenter undecorated windows cannot leave the dock floating in the middle of the screen
  - resize/move listeners in overlay mode now snap back to the dock edge instead of accepting free-floating coordinates as the persisted dock position
- The explorer now ships three experimental folder-view runtimes behind the Labs control:
  - `adaptive-semantic-grid`
  - `constellation`
  - `timeline-surface`
- `src/config/explorerExperimentalModes.ts` owns the shared metadata for those modes, including whether a mode is shipped and the meaning of the shared density/granularity control for each runtime.
- `FileExplorer.tsx` keeps the control plane shared across those experimental runtimes:
  - one persisted `experimentalViewMode`
  - one persisted `experimentalDensity`
  - Ctrl/Cmd + wheel and the layout hotkey now route into the active experimental runtime instead of only the adaptive grid
- `App.tsx`, `CommandPalette.tsx`, `TerminalOverlay.tsx`, and `SettingsPage.tsx` now consume the resolved workbench recipe and apply it to shared command-center chrome.

## Important Folders

- `src/components/`
  UI components and explorer runtime surfaces.
- `src/config/`
  Theme, explorer, layout, wallpaper, shader, animation, plugin, settings-navigation, managed-content, and runtime configuration.
- `src/runtime/`
  Tauri/backend bridge helpers.
- `src/store/`
  Persisted settings, explorer state, terminal state, and task state.
- `themes/`
  Theme packages discovered at runtime.
- `top-bars/`
  Standalone top-bar packages discovered at runtime.
- `animations/`
  Authored animation modules.
- `wallpapers/`
  Imported wallpaper media and authored live wallpaper modules.
- `src-python/`
  Repo-owned Python workspace for the managed sidecar. It contains the sidecar manifest, the Python package that serves JSON-line actions over stdio, and the durable guide for adding new Python-backed capabilities.
- `notes/`
  Managed notes/todos/bugs/prompts content root in development. Release builds move the same root under Tauri `AppLocalData`.
- `shaders/`
  Authored shader modules.
- `src-tauri/`
  Native host and Rust-side integration.
  `src-tauri/src/cloud_commands.rs` is the cloud-drive truth layer for provider credential resolution, OAuth callback handling, account metadata persistence, keychain refresh-token storage, and cloud-backed explorer file operations.
  `src-tauri/src/explorer_pro_commands.rs` is the explorer-pro feature backend for trash/undo, batch rename, duplicate scans, tags, and saved searches.
  `src-tauri/src/python_commands.rs` is the managed-runtime truth layer for interpreter discovery, virtualenv bootstrap, package installation, and direct Python execution.
  `src-tauri/src/python_sidecar.rs` owns the persistent managed sidecar lifecycle, workspace sync, stdio protocol, typed sidecar call/start/stop commands, and the backend-facing typed helper API (`action_ids`, decoded JSON helpers) for other Rust modules.
  `src-tauri/src/acceleration_runtime.rs` owns the cross-provider acceleration snapshot surfaced to the shell. It reads the native GPU runtime, optionally probes the Python sidecar for CUDA/Torch/ONNX capability, and turns those signals into a reusable provider catalog for future workload routing.
  `src-tauri/src/semantic_search.rs` is the explorer semantic-search orchestrator. It validates local-only roots/files, owns the app-local SQLite index contract plus manual task lifecycle, routes embedding/query/similarity work through the Python sidecar, and exposes the typed `build/query/find-similar/status` command surface through Specta.
  `src-tauri/src/python_pyo3.rs` owns the embedded `pyo3` seam for lightweight in-process Python helpers that do not need the long-lived sidecar, including decoded JSON helper functions for backend callers.
  `src-tauri/src/storage_commands.rs` is the storage-tab truth layer for native drive scans. It walks the filesystem on a background thread, tracks progress/cancellation, records logical vs allocated size, aggregates file-type buckets, caches direct child listings for the matrix view, builds a condensed tree plus largest-entry summaries, and prunes completed scan snapshots when newer scans start.
  `src-tauri/src/screenshot_commands.rs` is the screenshot truth layer for monitor capture, cached full-resolution images, native clipboard work, gallery thumbnails, and annotated export compositing.

## Validation Commands

- `npx vitest run --environment node src/test/workbenchTheme.test.ts src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts`
- `npx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/config/workbenchTheme.ts src/config/explorerTheme.ts src/config/appearance.ts src/components/CommandPalette.tsx src/components/TerminalOverlay.tsx src/components/SettingsPage.tsx src/components/explorer/ExplorerSideRail.tsx src/components/FileExplorer.tsx src/App.tsx src/test/workbenchTheme.test.ts src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts src/test/themePackages.test.ts src/test/explorerSideRail.test.tsx`
- `bun run test:unit`
- `bun run test:unit src/test/filePreview.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts src/test/fileExplorer.viewModes.test.tsx`
- `npx vitest run src/test/panelRegistry.test.tsx src/test/storageTreemap.test.ts src/test/storageWorkbench.test.ts src/test/storageStore.test.ts --reporter=dot`
- `bun run test:browser`
- `bun run build`
- `python3 -m py_compile src-python/greeblefs_sidecar/*.py`
- `node scripts/run-cargo-tests.mjs`
- `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
- `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
- `cargo test --manifest-path src-tauri/Cargo.toml storage_scan_ -- --nocapture`
- `bunx vitest run src/test/pythonConfig.test.ts src/test/pythonRuntimeBackend.test.ts src/test/terminalOverlay.test.tsx -t "Python" --reporter=dot`
- `bunx vitest run src/test/hotkeys.test.ts src/test/explorerStore.test.ts src/test/fileExplorer.searchTelemetry.test.tsx --reporter=dot`
- `bash ./install.sh`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1`
- `bash ./install.sh --launch`
- `bun run release:linux:install`

## Common Errors / Lessons Learned

- Cloud provider credentials now have two sources:
  - saved from `Settings > Cloud Accounts`, which stores the provider client ID in app-local data and the optional client secret in the OS keychain
  - runtime environment variables (`GREEBLE_GOOGLE_DRIVE_CLIENT_ID`, `GREEBLE_GOOGLE_DRIVE_CLIENT_SECRET`, `GREEBLE_DROPBOX_CLIENT_ID`, `GREEBLE_DROPBOX_CLIENT_SECRET`)
    Saved Settings credentials take precedence over env vars until they are cleared.
- Dropbox OAuth no longer uses a random localhost callback. The app now expects the Dropbox app console to allow the fixed redirect URI `http://localhost:53682/callback`; if Dropbox sign-in times out, check that exact callback registration before touching the browser-launch code.
- Repo-wide `npx tsc --noEmit` is currently red on several pre-existing generated-contract and test typing issues unrelated to the workbench/explorer theme system. The narrowed command above now only leaves `src/runtime/useFolderPluginRuntime.ts` as an unrelated pre-existing failure.
- Repo-wide `bunx tsc --noEmit` is also currently red on pre-existing explorer audio and VST typing issues outside the PDF lane (`src/components/ExplorerAudioWorkbench.tsx`, `src/runtime/vstBackend.ts`). Use targeted Vitest coverage plus `cargo check` when validating PDF work until those unrelated strict-mode failures are cleaned up.
- Repo-wide `.\node_modules\.bin\tsc.exe --noEmit -p tsconfig.json` is also currently red on the nested `src/src/frontend/**` workspace, which is not part of the main Tauri shell path. When validating work in the main app, filter the compiler output to the touched files instead of treating that secondary frontend tree as a regression in the storage lane.
- Use `node scripts/run-cargo-tests.mjs` for the Rust suite on Linux. Raw `cargo test --workspace` will try to build macOS and Windows workspace members that are intentionally skipped by the host-aware runner.
- Explorer rich thumbnails are native and cache-backed. `src-tauri/src/thumbnail_commands.rs` writes generated posters and video hover frames under the app-local `explorer-thumbnails` cache. If thumbnails look stale, inspect cache-key inputs and the app-local cache before trying to patch React rendering.
- Native GPU offload is now a host-owned subsystem, not a generic frontend WebGPU free-for-all. New GPU-first explorer/media work should enter through `src-tauri/src/gpu_runtime/`, expose typed status through Specta, and preserve a CPU fallback path; browser-local GPU surfaces like shader preview and terminal WebGL remain separate systems.
- If the video timeline starts asking for an audio file while editing a normal video, inspect `src-tauri/src/video_engine.rs` before touching UI copy. That symptom usually means the video engine failed to link deck `B` to the selected file’s embedded audio track; it is not a real request to import standalone audio.
- A current narrowed file-operations/explorer typecheck also still trips an unrelated screenshot typing issue in `src/components/ScreenshotsManager.tsx`: `SelectionHandle` includes `"move"` but the resize-handle consumer only accepts edge handles. Treat that as pre-existing unless the task is on screenshot selection editing.
- Built-in theme switches should go through `settingsStore.applyThemeSelection()` or the Settings theme catalog flow, not a direct `updateAppearance({ activeThemeId })` call. The direct path now skips pilot baseline resets for dock mode, layout profile, explorer presentation, wallpaper/shader overrides, and related default-shell behavior.
- JSDOM-backed Vitest runs currently fail in this workspace because `html-encoding-sniffer` requires an ESM dependency through a CommonJS path. Node-environment tests still work, so keep pure logic/package-loader tests runnable there until the dependency issue is fixed.
- Python sidecar actions are manifest-driven. Add the Python handler in `src-python/greeblefs_sidecar/actions.py`, register it in `src-python/greeblefs-python-sidecar.json`, and then consume it through `src/runtime/pythonRuntimeBackend.ts` or the Rust sidecar helpers instead of inventing one-off script launch paths.
- Cross-provider CUDA/AI routing is now control-plane-driven. If a new feature wants NVIDIA acceleration, add or reuse a workload id in `src/config/accelerationRuntime.ts` and extend `src-tauri/src/acceleration_runtime.rs` or the native GPU runtime instead of hardcoding provider selection inside a panel or backend command.
- `preferCuda` is a routing preference, not a guarantee. The shell will still fall back to native `wgpu` or CPU when the managed Python sidecar is not running, the CUDA probe action is unavailable, or CUDA/Torch/ONNX are not actually ready on the machine.
- Explorer semantic search is currently manual-task, local-root, and text/code-only by design. If semantic results look empty, check the current root's index status first; cloud roots, binary/media files, and unbuilt local roots are intentionally excluded from v1.
- The managed runtime still seeds its boilerplate package under `overlayterm_runtime` for compatibility. Do not rename that folder casually; it needs an explicit migration if we ever remove the legacy name from persisted runtimes.
- `bun run test:browser` currently launches a headed Playwright Chromium session in this workspace. Without an X server it fails before any tests run; use `xvfb-run` or a headless browser config if you need browser validation locally.
- `plugins/**/dist/**` is versioned source for packaged frontend plugins in this repo. Do not treat those directories like app-build output or let a blanket `dist/` ignore swallow shipped plugin entries.
- Packaged frontend plugins are no longer single-file only. `src/components/pluginRuntime.tsx` now executes a package-local module graph, so plugin entries may import sibling helpers with relative paths, but those imports must remain inside the plugin root and still cannot pull arbitrary npm dependencies.
- Explorer context-menu plugin contributions can now open plugin panels through `panel-request` execution. If a plugin needs a folder/file handoff from Explorer, use `src/runtime/pluginPanelRequests.ts` and the `overlayterm-plugin` helpers instead of inventing ad hoc window events or local-storage keys.
- The dev HUD is internal to this app. It is not a Tauri plugin or external Chrome overlay, and it should be treated as part of the shell runtime.
- Do not wire the screenshot panel to `explorerTaskStore`. That store is global explorer/Yazi task state; rendering it inside screenshot status chrome leaks unrelated delete/copy jobs into screenshot errors and makes debugging cross-subsystem issues much harder.
- Annotated screenshot export belongs in Rust now, not in the browser canvas path. The frontend should author selection/annotation intent, while `src-tauri/src/screenshot_commands.rs` composites those annotations onto the cached full-resolution capture and handles save/copy. Reintroducing browser-side annotated save logic will silently degrade output resolution again.
- Non-Windows screenshot preview capture now briefly hides/restores the app window to avoid self-capture. If Linux/macOS preview behavior regresses, inspect that hide/show path before assuming the capture backend itself is wrong.
- Explorer interaction tests that need DOM drag/drop still need a browser-like environment, so the current JSDOM dependency failure blocks the most relevant explorer UI regressions even when the narrowed TypeScript pass is green.
- Audio workbench playback state should not be tied to parent React state churn. Keep playhead motion on an imperative RAF path and keep waveform/spectral subsurfaces memoized so shell-level rerenders do not consume the frame budget.
- Packaged theme SVG previews and wallpapers are safest when inlined to data URLs before they reach the frontend. In this workspace, Tauri/WebKit can intermittently fail on filesystem-backed SVG theme assets and spam `Failed to load resource` errors if they stay on raw asset URLs.
- `fs_read_file_base64` already returns a complete data URL for small files in this workspace. Do not wrap its result in another `data:image/...;base64,` prefix inside icon/theme/media loaders, or browsers will reject the nested URL with `Data URL decoding failed`.
- Theme renderer motion should prefer CSS animation for decorative effects. Renderer-local React state that ticks every frame can force mounted heavy panels like `FileExplorer` through avoidable rerender pressure and can resurrect update-depth problems.
- The local Linux installer now avoids the old Node/Tauri wrapper path. `install.sh` and `scripts/build-and-install-linux-local-release.sh` build with Bun + Cargo directly, then install into `~/.local/opt/greeblefs`.
- Do not keep `build.devUrl` in the base `src-tauri/tauri.conf.json` for release-capable paths. In this workspace, a direct `cargo build --release` will otherwise compile a binary that keeps trying to boot from `http://localhost:1420`. `scripts/run-platform-tauri.mjs` now injects `devUrl` only for the `tauri dev` command.
- This repo is a Cargo workspace, so release binaries land under the workspace-level `target/` directory, not `src-tauri/target/`. Linux install scripts should resolve `cargo metadata` `target_directory` before copying binaries, or they can silently reinstall a stale executable from an old path or from the wrong binary name.
- The local Linux installer now also seeds the managed content directories into `~/.local/share/co.greeblefs.app/{plugins,themes,shaders,animations}` so the installed release has writable runtime content without polluting the top level of `$HOME`.
- Vite still prints a Node 18 warning during builds, but `bunx vite build` succeeds in this workspace and the installer completes successfully on that host setup.
- The explorer component is large and performance-sensitive. Route new chrome/metric changes through `src/config/explorerTheme.ts` instead of scattering new magic numbers through `FileExplorer.tsx`.
- Avoid mixing CSS border shorthands with border longhands in the same React style object on explorer rows and chrome surfaces. The dock/layout tests hit real `cssstyle` failures when `borderBottom` and `borderColor` were mounted together, and the longhand form is safer for theme-driven overrides anyway.
- Explorer directory/search caches are intentionally shared at the module level across explorer mounts. Tests or one-off diagnostics harnesses that need isolated backend behavior should call the exported `invalidateExplorerResultCaches()` helper before rendering.
- Explorer preview routing should extend `src/components/explorer/explorerPreviewSystem.ts`, not add new extension ladders in `FileExplorer.tsx`. That resolver is now the shell contract for “what kind of preview is this?” and for the shared fallback states.
- Wildcard preview tabs are live preview-shell state, not persisted explorer session state. Reset wildcard registrations when the preview kind/path changes, keep canonical non-edit/edit ordering, and let lanes register extra workflow tabs through the preview panel instead of hardcoding lane-local header buttons.
- VST3 discovery must validate the current host binary format, not just the `.vst3` suffix. Linux and macOS can see bundle directories or foreign-platform plugin files side by side, so scan/load code should route through `crates/vst-host` path resolution before surfacing a plugin as host-ready.
- Explorer image save flows should not assume `@tauri-apps/plugin-fs` is registered in the host. If a preview/editor lane needs a durable local write path, route it through `src/runtime/explorerBackend.ts` or provide an explicit fallback to `writeExplorerFile(...)`; otherwise frontend-only plugin calls can fail at runtime with `fs.write_file not allowed. Plugin not found`.
- Explorer preview drafts and retry messaging should extend `src/components/explorer/explorerEditSession.ts`, not invent per-workbench local-storage keys or save-failure copy. Text, shader, spreadsheet, and PDF lanes now share the same draft-preservation posture.
- The Windows `install.ps1` helper is intentionally destructive: it clears the current per-user install, managed state roots, and legacy `OverlayTerm` roots before reinstalling. If it fails during cleanup, make sure no `GreebleFS.exe` / `OverlayTerm.exe` process is still running and rerun with `-NoProfile -ExecutionPolicy Bypass`.
- Unknown small files still intentionally route through the editable-text heuristic in `src/config/filePreview.ts`; larger unknown files fall through to the unsupported fallback. If that heuristic changes, update the preview resolver and the unsupported-preview tests together so “unsupported” stays a deliberate product decision instead of an accident.
- The side rail local folder tree must use the shared explorer directory cache in `src/components/explorer/explorerDirectoryCache.ts` rather than calling `fs_list_dir` blindly from component-local state. Otherwise the rail and the main explorer will drift on refresh and remount behavior.
- The side rail local-tree refresh path is sensitive to effect cancellation. Do not make the ancestor-loading effect depend on a callback that closes over `folderChildrenByPath` or on a transient `shouldForceRefresh` boolean that flips during the same refresh pass; use a stable loader plus explicit refresh revision/state refs so forced subtree reloads can finish.
- Explorer async directory/search work needs both mount cleanup and request invalidation. Overlay-mode panel swaps and `React.StrictMode` remounts can otherwise let stale `navigate()` / `refresh()` completions write into a dead or superseded explorer instance, which shows up as `getRootForUpdatedFiber` runtime errors or visible listing flicker.
- Explorer `Ctrl/Cmd + wheel` density changes should be attached to the stable file-area interaction plane, not a remount-prone scroll viewport node. Otherwise icon/grid zoom appears to \"randomly\" stop responding after layout or DOM remounts even when the settings logic is correct.
- If the Linux/native overlay appears on the wrong display, inspect the monitor-resolution path in `App.tsx` before touching Rust window flags. The frontend now owns monitor selection and overlay geometry; `windowApplyMode` should only apply the chosen presentation atomically.
- If Linux dock mode starts floating in the middle of the screen again, check the post-show re-dock path in `App.tsx` and confirm overlay move/resize listeners are not re-persisting raw X/Y coordinates into `runtimeOverlayBoundsRef`.
- On Linux, do not let `window_apply_mode` abort geometry just because a WM rejects `set_shadow`, `set_skip_taskbar`, or another presentation-only flag. The TS call sites should unwrap the returned Tauri `Result`, and the Rust command should log best-effort flag failures while still applying size/position.
- Explorer task state is now durable and snapshot-backed. Task UIs should hydrate from `fs_list_explorer_tasks` through `src/runtime/explorerBackend.ts` and then merge live `explorerTaskProgressEvent` updates; do not rebuild task truth from component-local event listeners or assume the event stream alone is sufficient after remount/startup.
- Screenshot capture uses physical monitor geometry end-to-end for preview selection and crop/save math. Tauri `Monitor.size` / `Monitor.position` are physical pixels, while the Rust preview path should capture the full monitor image and the crop/save path should stay on the cached physical-pixel image. Keep logical scaling for human-readable labels only.
- Screenshot preview images should stay on stable data URLs or equally stable sources. Avoid converting them to blob URLs and revoking them inside a React state updater, because `React.StrictMode` can replay that updater and revoke the fresh preview before the browser finishes loading it.
- `bun run tauri dev` uses the generated runtime Tauri config from `scripts/run-platform-tauri.mjs`, which points Tauri at the Vite `devUrl`. TS/React edits hot-reload through Vite during that session, but binding generation and startup prep scripts only rerun when the Tauri dev process starts.
- Linux NVIDIA/WebKitGTK launch stability now has a native pre-Tauri guard in `src-tauri/src/linux_graphics.rs`:
  - it runs before `tauri::Builder::default()` so both dev and installed binaries inherit the workaround
  - it now owns Linux backend selection too: `Auto`, `X11`, or `Wayland` can be persisted in `~/.config/GreebleFS/startup-preferences.json`, while `GREEBLEFS_LINUX_DISPLAY_BACKEND` / `OVERLAYTERM_LINUX_DISPLAY_BACKEND` and `GDK_BACKEND` still override from the shell
  - in `Auto`, NVIDIA Wayland sessions that also expose X11 now fall back to `GDK_BACKEND=x11` before WebKit boots, so XWayland is used for the risky WebKit/NVIDIA path instead of native Wayland
  - when the active Linux backend resolves to Wayland on an NVIDIA system, it sets both `WEBKIT_DISABLE_DMABUF_RENDERER=1` and `__NV_DISABLE_EXPLICIT_SYNC=1`
  - when the active Linux backend resolves to X11 on an NVIDIA system, it sets `WEBKIT_DISABLE_DMABUF_RENDERER=1`
  - explicit user-provided values for those environment variables are respected
  - if Linux launch regresses with `libEGL`, `driver (null)`, `failed to create dri2 screen`, blank WebKit surfaces, or Wayland protocol errors on NVIDIA, inspect that helper before changing shell/UI code
- Wayland overlay handling is now compositor-preserving instead of backend-forcing:
  - `window_get_linux_display_server()` now reports the app's resolved backend, not just the raw compositor session, so X11 fallback and the Wayland dock host stay in sync
  - overlay `Ctrl+Space` reopen on Wayland now avoids reapplying dock geometry during the hidden-to-visible transition so manual compositor snaps can survive hide/show
  - `isFreefloatingRef` is now set on real overlay move/resize events so reopened overlay sessions can reuse the last compositor-managed bounds instead of recomputing from a fresh dock anchor every time
- Do not try to fix Wayland dock centering by adding more `set_position` / `set_outer_position` retries to the normal app window path. The durable fix is the separate layer-shell dock host in `src-tauri/src/wayland_dock.rs`; if dock mode recenters again, inspect host routing in `src/runtime/windowHost.ts` and `App.tsx` before touching generic window geometry.
- `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings` is green again. Keep `src/generated/tauri.ts` generated-only and route any new explorer task commands through `src/runtime/explorerBackend.ts` instead of introducing ad hoc `invoke` calls in React.
- Dev telemetry is intentionally repo-local in `tauri dev`; do not look in Tauri app-log directories when debugging local trace output unless you are validating a release build.
- Built-in shader performance is now split by runtime type and a persisted shader-performance mode:
  - `settings.appearance.shaderPerformanceMode` defaults to `performance`, which keeps automatic theme shader assignment off until the user explicitly opts into `balanced` or `quality`
  - the CSS-heavy built-ins no longer use a React RAF clock; they animate through injected keyframes so shader motion does not force React rerenders every frame
  - canvas-backed shader surfaces are throttled to about 24 FPS in performance/balanced mode and capped to a profile-driven `devicePixelRatio`, with new preview opens preferring the fullscreen scene unless the user asks for the higher-fidelity sphere path
  - if overlay performance still feels bad after this pass, inspect shell `backdrop-filter` blur and wallpaper/shader/animation layer stacking before adding more shader complexity
- Explorer smoothness now favors cheaper composition over JS-driven motion:
  - `FileExplorer.tsx` no longer uses Framer Motion in the main explorer path for grid/icon/layout transitions
  - size changes now rely on CSS transitions or immediate layout so directory navigation and zooming avoid extra layout animation work
- `settings.appearance.appBlur` is now the real shell-wide blur kill switch:
  - it still controls the outer shell blur in `App.tsx`
  - it now also disables top bar/menu blur, command palette blur, terminal blur, settings blur, and explorer-local blur surfaces
  - `src/config/performanceTelemetry.ts` now treats `overlay_frame_time` as an `8.3ms` p95 target so telemetry aligns with a 120 Hz goal instead of a 60 Hz goal
- Theme package manifests can now carry app-wide shell structure via `theme.workbench` and explorer-specific structure via `theme.explorer`; prefer those over ad hoc `cssVars` whenever a behavior or metric deserves a named contract.
- If a theme needs a default wallpaper, put the asset in `theme.assets.backgroundUrl`. Reserve `theme.effects.backgroundImage` for overlay gradients/effects so theme wallpaper assets and shader layers can stack cleanly instead of duplicating the same image twice.
- If a custom theme renderer owns a launcher, chrome band, content frame, or wallpaper treatment, declare it through `surfaceOwnership`. Do not rely on `host.renderChromeBar()` to magically cooperate with a fully custom launcher layout.


## /GreebleFS/packages folder
- The packages folder is a blend of both reference code and vendored code.. There are two key reference folders in it which are /packages/spacedrive and /packages/xplorer - feel free to use these whenever possible for refefence code delegating to anything and how file explorers work. There is a plethora of amazing reference code to base off new features and optimizations here.

- Another huge addition of reference code added and my own code was the /packages/KOS folder ---  Since this is my own code feel free to yoink any file or system out of this folder if needed, it is a massive DCC suite spanning across 16 applications and over 400 rust files of raw 3D fire power. Everything from svt texturing, to gpu sculpting, to buffer pools, PBR MATERIAL generation, procedural assets, simulations, IO for 3D models, IPC systems etc. Key folders are /crates and /src-frontend in this directory to get a good idea for it. You have full permission to copy and paste folders and files from it into GreebleFS for borrowing. You don`t even have to ask to use them.
