# GreebleFS Architecture

## Purpose

GreebleFS is a Tauri desktop workbench centered on a highly themeable file explorer, terminal overlay, plugins, shaders, animations, and settings-driven shell customization.

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
- Visual system: CSS variables, theme bundles, appearance packs, icon themes, top bars, shaders, animations
- Tests: Vitest unit/browser, Rust tests

## Main Entry Points

- `src/main.tsx`
  Frontend bootstrap. It now selects the root app by webview label, rendering `App` for the main shell and `src/windows/FileOperationsWindowApp.tsx` for the dedicated `file-operations` popout.
- `vite.mobile.config.ts`, `src-mobile/main.tsx`, `src-mobile/App.tsx`, `src-mobile/mobileApi.ts`, and `src-mobile/mobileStore.ts`
  The browser-safe mobile/PWA surface. This is a separate Vite entrypoint that builds `dist-mobile/` for Axum to serve over LAN/mobile sharing; it must stay free of Tauri-only runtime assumptions and talks to the desktop host through HTTP endpoints instead of direct `invoke()` calls. The mobile shell has built-in `Explorer`, `Search`, `Transfers`, and `Settings` tabs, plus host-discovered plugin tabs from `usr/plugins/**/extension.toml` `contributions.mobilePanes`. Its browser-safe Zustand store owns mobile-only path memory, transfer state, and layout overrides while desktop-owned theme/icon resources and plugin catalogs arrive over HTTP instead of being duplicated in the phone bundle.
- `install.sh`
  Root Linux local-install wrapper. It delegates to `scripts/build-and-install-linux-local-release.sh`, which builds the app and installs a per-user release on Linux.
- `install.ps1`
  Root Windows local clean-install/uninstall entrypoint. It builds with Bun and Cargo, removes the previous per-user install and user-state roots on demand, and reinstalls a fresh `greeblefs.exe` plus current-user Start Menu/Desktop shortcuts.
- `src/App.tsx`
  Overlay window shell, theme/runtime discovery, panel orchestration, and shell-level utilities such as the command-palette launchers for the mobile share server. The command palette now also hosts indexed global file search plus scan/rebuild controls, using host-owned stores/runtime seams instead of letting the explorer or an imported search package own shell truth. Root overlay animation progress no longer lives here; `App.tsx` now assembles the shell scene and changes only coarse overlay phase/direction, while command-palette global-search queries are deferred before they hit the backend path.
- `src/components/OverlayShellScene.tsx`
  Leaf shell-animation surface for the overlay/app shell. It owns folder-authored animation progress locally with `requestAnimationFrame`, keeps built-in animation behavior on the existing CSS-transition path, and prevents frame-rate animation progress from forcing the full `App.tsx` tree to reconcile.
- `src/panels/panelRegistry.tsx`
  Built-in panel registration, prop wiring, and the shared surface registry used by the IDE workbench shell. `OverlayPanelDefinition.dock` plus `WorkbenchSurfaceDefinition` are now the canonical default-placement/default-visibility contract for built-ins and plugin surfaces in dock-graph mode.
- `src/components/FileExplorer.tsx`
  Main explorer shell, navigation, preview, standard layout modes, experimental explorer runtimes, the embedded preview-pane image/video/audio/Python editor-workbench paths, the shared preview-header workflow-tab system (`Preview` / `Edit` plus lane-owned wildcard tabs), the adaptive preview-pane context-menu host that merges preview-kind/workflow metadata with lane-registered actions, the explorer-local preview split mode that can promote the live preview lane into a pane-styled sibling without creating another workspace pane, and the dock-owned layout contract used when the app switches into overlay mode. It also owns the docked `ExplorerActionsPane` host, the pointer-driven explorer chrome customize/runtime loop, the shared command-execution path for movable top/bottom/status controls, and the shared folder/archive collection-preview mode hotkeys. Shell-level actions such as command-palette global-search results can reopen the active pane at a directory and select a concrete entry without bypassing explorer state. React keeps render/hot-interaction ownership, Rust remains filesystem truth, and ordinary navigation/open-entry policy stays local by default; the Go policy sidecar is diagnostics/parity only unless a measured feature proves it needs that isolation.
- `src/components/explorer/explorerPreviewRegistry.ts` and `src/config/explorerWorkbenches.ts`
  Preview/workbench arbitration lives here. The registry now collects every matching built-in and plugin candidate, then selects the active workbench by saved user default for the normalized extension, priority, and deterministic discovery order. `FileExplorer.tsx` hosts the chooser UI and fallback behavior; do not reintroduce one-off "first match wins" preview picking in feature components.
- `src/components/pluginWorkbenchAdapters.tsx` and `usr/plugins/greeblefs-workbench-*`
  First-party rich preview workbenches are moving into extension packages one workbench at a time. SQLite is now fully extension-owned through `usr/plugins/greeblefs-workbench-sqlite`, while the current document, spreadsheet, audio, and video packages still mount existing React workbenches through `greeblefs-workbenches` adapter exports and keep temporary built-in fallback branches until parity is proven and removed. Workbench plugin manifests also declare catalog `category`, `tags`, and `testFiles`; `src/components/PluginsManager.tsx` uses that metadata to organize plugins and render the selected workbench preview against a shipped fixture file directly inside the Plugins panel.
- `src/components/ExplorerCollectionPreviewSurface.tsx`
  Shared folder/archive preview-pane collection surface. It owns the compact icon-only mode strip, pane-optimized collection layouts (`list`, forced-thumbnail `overview`, `strata`, `timeline`, `orbit`), and must keep row/tile interactions routed through `useExplorerPreviewEntryDirectDrag.ts` so selection and drag-out behavior stays identical across modes.
- `src/components/OverlayScrollArea.tsx`
  Shared overlay scroll host. It owns the explicit scrollbar contract for shipping-shell panes (`hidden`, `themed`, `explorer-file-list`) so explorer lists, popouts, and workbench/detail surfaces can share themed scroll behavior without per-component scrollbar CSS. Virtualized Explorer rows may change child identity on every visible-window shift, so this component must not restart sustained measurement loops solely because `children` changed. The primary Explorer file list also stays on native browser/WebView wheel scrolling; do not attach the synthetic inertial wheel interceptor to the `explorer-file-list` scrollbar style.
- `src/components/ExplorerImageEditor.tsx`
  Shell-owned image workbench for the embedded preview-pane raster lane. Editable images stay on the shared workflow-tab system: `Preview` keeps the fullscreen pannable/zoomable surface, `Edit` keeps the CropperJS filter/crop deck, and `Cutout` mounts the dedicated subject-extraction lane instead of forking a second preview shell. The component still owns the shared save/reset surface that `ScreenshotsManager.tsx` uses, but cutout/copy/drag/save now route through host-owned cutout sessions instead of the old browser-only image-export path.
- `src/components/explorer/explorerImageStage.ts`
  Shared zoom/pan math and checkerboard-stage surface contract for preview-first visual media lanes. The image lane is the canonical consumer, and the video lane now reuses the same transform, zoom badge, and stage background constants so preview behavior does not drift between media types.
- `src/components/ExplorerImageCutoutSurface.tsx`
  Shell-owned cutout lane for explorer images. It opens one native `cutout` session for the visible lane, keeps a hidden `removeBackground` session only as an internal helper, then switches to local mask editing for responsiveness: `AI Select` prompt clicks hit the backend prompt seam, `Magic Wand` now uses perceptual color matching with a real contiguous toggle, `Quick Select` uses a bounded edge-aware local grow pass instead of a plain color brush, `Lasso` fills a local polygon region, and `Brush` / `Erase` paint directly into the matte. `Auto Remove BG` now lives inside the lane and merges its result into the same visible cutout history instead of exposing a second header tab. The lane stays preview-first inside the pane: the subject stage remains fullscreen-first, the top-right action bar owns undo/redo/reset/tools/refine/save/copy as icon-first chrome, the left-docked tool rail owns grouped Photoshop-style tool families plus flyouts, and edge/tool sliders only surface behind an explicit `Refine` inspector instead of permanently consuming pane width or adding a tutorial card. `Ctrl+D` clears the active selection locally, while native drag-out moved to `Ctrl/Cmd+Shift+drag` so `Shift` is free for selection-tool semantics again. Marching ants must only render when the resolved matte contains real selected pixels; empty transparent masks are intentional and should stay visually silent. Copy/drag/save still route through the host by sending the locally refined mask back only when output is requested, but copy now queues the staged PNG into Explorer’s own copy/paste queue in addition to the OS image clipboard, and sibling save must call back into the preview host so the explorer refreshes after export.
- `src/components/ExplorerVideoEditor.tsx`
  Shell-owned wrapper for the embedded preview-pane video surface. It now defaults to a playback-first preview surface and only reveals the heavier trim/inspector editing chrome when Explorer switches the document into explicit edit mode. For local playback it reads preview bytes through the typed backend, feeds the `<video>` element with a `blob:` URL, escalates to an ffmpeg-generated MP4 proxy when native transport or decode fails, and reuses the shared image-stage zoom/background contract so the video lane feels like the same preview system instead of a separate mini app.
- `src/components/ExplorerAudioWorkbench.tsx`
  Shell-owned wrapper for the embedded preview-pane audio surface. It now follows the same preview-first shell model as the image/video lanes, but audio is also the first wildcard-tab consumer: `FileExplorer.tsx` opens audio in a clean playback-first preview surface, the shared preview header exposes `Preview | Edit | VST`, trim/export tools stay in explicit `Edit`, and the `VST` workflow keeps the playback/waveform overview visible while stacking a compact plugin lane underneath it. Headless VST parameter edits now round-trip through a live per-deck host instead of detached metadata, while inline native editor attachment still remains an honest unavailable path. Under that shell split it still rides the Rust audio engine, keeps shared waveform selection, DAW-style fade edge handles, memoized waveform/spectral subsurfaces, a RAF-driven playhead marker, loop/gain/rate control, offline export actions, and spectrogram rendering.
- `src/components/explorer/explorerPreviewWorkflowTabs.ts`
  Shared preview-header workflow-tab contract. It canonicalizes the built-in non-edit/edit tabs, normalizes lane-owned wildcard tabs, and resolves the active workflow tab without persisting wildcard ids into explorer session state.
- `src/components/explorer/explorerPreviewContextMenu.ts`
  Shared preview-lane context-menu registration seam. Preview workbenches register base actions plus workflow-tab overlays here, and the merge contract deliberately keeps one `preview-pane` menu context while letting the runtime adapt actions by `previewKind` and active workflow tab.
- `src/components/ExplorerPythonWorkbench.tsx`
  Shell-owned wrapper for the embedded Python preview lane. Python files stay on the shared workflow-tab system, but they are now explicitly code-first: `FileExplorer.tsx` opens them on `Edit`, hides the generic `Preview` tab, and adds `Run | Runtime` wildcard tabs for managed execution, runtime bootstrap/package maintenance, and managed REPL handoff. Managed runs render structured stdout/stderr back into the preview pane, while terminal-backed fallback routes into the explorer embedded terminal bottom drawer so the workbench does not disappear.
- `src/components/ExplorerPdfWorkbench.tsx`
  Shell-owned wrapper for the embedded preview-pane PDF surface. It keeps the explorer preview-pane contract, renders one active page at a time, exposes page/zoom/fit/edit/save chrome, authors page-space overlay annotations plus AcroForm edits in React, and defers document truth/render/save back to the typed Rust PDF bridge.
- `src/components/ExplorerSpreadsheetWorkbench.tsx`
  Shell-owned wrapper for the embedded spreadsheet preview/editor surface. It now follows the same preview-first shell model as the image/video/PDF lanes: `FileExplorer.tsx` opens spreadsheets in preview mode first, the shared preview header owns the `Preview` / `Edit` toggle, and the workbench itself stays read-only until edit mode is requested. Preview mode now routes through the same themed table-preview surface language used by the SQLite lane, while edit mode keeps the spreadsheet-specific Glide grid, formula bar, sheet management, and save flow. Workbook truth plus import/export still route through the typed runtime.
- `src/components/explorer/ExplorerTablePreviewSurface.tsx`
  Shared themed shell primitives for table-shaped preview lanes. SQLite and spreadsheet preview now compose the same identity header, selector strip, dataset header, action buttons, centered states, responsive layout breakpoint, and HTML table surface here so table previews do not drift into lane-local one-off chrome.
- `src/components/ExplorerShaderWorkbench.tsx`
  Shell-owned wrapper for the embedded shader preview/editor surface. It renders WGSL/HLSL/SPIR-V documents inside the explorer preview pane, owns edit-vs-preview presentation, exposes stage/entrypoint pickers plus scene-mode controls, renders the WebGPU host canvas when available, and falls back to diagnostics plus inspection output when live preview is unsupported.
- `src/components/StoragePanel.tsx`
  First-class storage forensics tab. It now follows the Explorer shell contract more closely: left drive/context rail, dense matrix-first workspace, optional split-map/types/focus modes, a scroll-safe preview-pane-style inspector with a `Current Context` lane, keyboard navigation, indexed jump/search inside the active storage scope, and a visible batch cleanup queue for staged trash/delete actions.
- `src/components/NotesManager.tsx`, `src/components/notes/NotesRichMarkdownEditor.tsx`, `src/runtime/notesWorkspaceBackend.ts`, and `src/runtime/notesMarkdownDocument.ts`
  Shell-owned notes workspace. The notes panel is no longer a hardcoded notes/todos/bugs/prompts board; it is now a folder-first markdown workspace over the managed `notes/` root. `NotesManager.tsx` owns a single explorer-like sidebar tree, shared context-menu/dialog flows, and coalesced autosave/flush behavior. `NotesRichMarkdownEditor.tsx` owns the vendored Tiptap editor chrome, `notesWorkspaceBackend.ts` owns filesystem-backed folder/document operations through the explorer runtime plus local markdown summarization for post-save UI updates, and `notesMarkdownDocument.ts` owns the markdown-to-Tiptap round-trip plus local markdown extensions (blockquote, code, code block, hard break, link) that the vendored editor needs.
- `src/components/storage/storageTreemap.ts`
  Pure treemap layout helper for the storage tab. It turns the condensed native storage tree into deterministic SVG rectangles weighted by allocated bytes without mixing layout math into the panel component.
- `src/components/storage/storageWorkbench.ts`
  Pure storage-workbench helpers for matrix row flattening, sort/share math, treemap focus resolution, and queue summary calculations. Keep storage table/tree math here instead of burying it in `StoragePanel.tsx`.
- `src/config/storageBatchQueues.ts`
  Data-driven storage batch-queue definitions. The initial `cleanup` queue exposes staged `Trash` and `Delete` actions, but the config shape is intended to support future batch workflows without hardcoding them inside the panel.
- `src/store/storageStore.ts`
  Persisted storage-workbench session state. It owns active mode, selected root/path set, expanded tree paths, sort state, preview split mode, focus path, and the staged cleanup queue snapshot.
- `src/components/explorer/ExplorerWorkspace.tsx`
  Explorer-local workspace shell that wraps `FileExplorer` instances with workspace-owned tabs, slot-based `1-Up` / `2-Up` / `3-Up` / `4-Up` pane layouts, pane focus, adaptive split sizing, and a single workspace tab strip. Each workspace tab owns its own pane topology plus per-pane explorer sessions; pane switching does not swap the tab strip. The workspace header now exposes that whole strip as one shared `workspaceTabStrip` chrome control, so tab affordances, new-tab, pane-layout switching, and pane actions can move/resize with the rest of explorer chrome instead of living in a fixed hardcoded header. This layer still owns top-level multi-pane explorer topology; the newer preview split stays inside a single `FileExplorer` instance instead of routing through workspace panes.
- `src/components/explorer/ExplorerActionsPane.tsx`
  Docked explorer-side host for authored actions plus chrome customization. In normal runtime it browses/launches explorer actions from the merged catalog; in customize mode it becomes the all-in browser/inspector for built-in explorer controls and authored actions instead of spawning a floating overlay.
- `src/components/explorer/ExplorerSideRail.tsx`
  Explorer rail, drives, bookmarks, saved searches, and tag-filter browsing.
- `src/components/home/ExplorerHomeSurface.tsx`, `src/components/home/homePackRuntime.tsx`, and `src/config/homePackages.ts`
  Explorer Home surface runtime. This subsystem owns the virtual `greeblefs://home` route, the constrained host data/actions exposed to Home packs, built-in Home packs (`command-center`, `favorites-deck`), and authored pack discovery from `home-packs/`.
- `src/components/WorkbenchTopBar.tsx`
  Data-driven shell top bar renderer. It resolves launcher controls, navigation tabs or summary mode, window chrome, theme-shader layering, the live top-bar customize mode, and the canonical shell-family switcher (`Classic` vs `IDE`) from the standalone top-bar catalog instead of burying the whole shell header inside `App.tsx`.
- `src/components/WorkbenchIdeShell.tsx`
  Canonical IDE-shell renderer. It owns the phase-1 dock graph UI: activity rail, left/center/right/bottom regions, stack tabs, collapse/restore, maximize, floating utility windows, and split-handle resizing. Extend this component and `ideWorkbenchLayout.ts` together for IDE-shell behavior instead of reintroducing app-shell dock logic in random panels.
- `src/config/appearance.ts`
  Core overlay theme model and resolved CSS variables.
- `src/config/pilotThemeContract.ts`
  Data-driven pilot theme baseline for built-in theme defaults, app/dock recipe normalization, and explorer/layout reset behavior when built-in themes are selected.
- `src/config/workbenchTheme.ts`
  App-wide workbench recipe resolution and workbench-scoped CSS variable contract.
- `src/config/topBars.ts`
  Standalone top-bar catalog and resolver. The shipped first-party top-bar catalog now lives in `usr/top-bars/**/top-bar.json`; this module should stay a loader/resolver over that authored data plus theme-package top-bar contribution loading, legacy `theme.workbench.topBarStyle` fallback mapping, and the active selection path used by `App.tsx` and Settings.
- `src/config/layoutDynamics.ts`, `src/runtime/layoutDynamicsRuntime.ts`, `src/components/layoutDynamics/LayoutDynamicsCanvas.tsx`, and `src/animation/layoutDynamics.tsx`
  Shared layout-authoring physics subsystem. The shipped solver presets and adopted-surface catalog now live in `usr/layout-dynamics/**/layout-dynamics.json`; code owns normalization, per-frame repulsion/spring math, the reusable authoring canvas, and the runtime controller that resolves the effective surface settings for explorer chrome and the shell top bar.
- `src/config/explorerTheme.ts`
  Explorer-specific theme recipe resolution, metrics scaling, and explorer-scoped CSS variable contract.
- `src/config/explorerModeProfiles.ts`
  Explorer mode-profile registry/loader. The shipped user-facing explorer modes now live in `usr/explorer-mode-profiles/**/explorer-mode-profile.json`, and this module maps them onto pane-layout ids, chrome-layout ids, and view-bias defaults.
- `src/config/explorerShellLayouts.ts`
  Pane-layout preset loader for `usr/explorer-shell-layouts/**/explorer-shell-layout.json`. These manifests own rail visibility, preview placement, and live pane sizing behavior, and remain the pane-composition layer even after mode profiles and chrome layouts were split out.
- `src/config/explorerChromeLayouts.ts`
  Explorer chrome layout registry/resolver over `usr/explorer-chrome-layouts/**/explorer-chrome-layout.json`. This is the persistence layer for moveable explorer chrome; `widthPx`, `sizeVariant`, `showLabel`, and `showIcon` overrides should survive moves between supported surfaces, and v1 layout-dynamics adoption can now also persist authored `bandId` / `anchorX` / `anchorY` metadata alongside the legacy slot data.
- `src/config/explorerCustomizeCatalog.ts`
  Unified placeable explorer-control catalog loader over `usr/explorer-customize-controls/**/explorer-customize-control.json`. It is the source of truth for shared command ids, supported surfaces, resize/size capabilities, default width hints, and customize-browser grouping. New explorer chrome should register here instead of being wired as JSX-only hardcoded buttons.
- `src/config/hotkeys.ts`
  Shipped hotkey-catalog loader over `usr/hotkeys/**/hotkeys.json`. The default binding map is now authored data; TypeScript should stay the normalization/matching layer instead of the place where new built-in shortcut rows are authored.
- `src/config/explorerContextMenu.ts` and `src/config/menuPacks.ts`
  Typed explorer-menu command graph plus declarative `menu-packs/` loader. The registry owns action metadata, preview-pane invocation metadata (`previewKind`, `workflowTabId`, `workflowBaseMode`), preview-owned command sources, context-authored density/description visibility, and legacy migration helpers; menu packs own per-context placement, submenu/group-slot structure, the dedicated `preview` slot used by adaptive preview menus, quick-slot/fallback hints, and the built-in classic authored pack. The default `preview-pane` layout is intentionally much smaller than the main explorer entry menu even though both ride the same system.
- `src/config/themeEngineBindings.ts`
  Shared engine-manifest binding helpers for layout/navigation/render-driven recipe defaults.
- `src/config/workbenchRenderRuntime.ts`
  Resolves the active workbench interaction runtime from the theme engine manifest and layout profile.
- `src/config/workbenchPerformance.ts`
  Runtime-only shell-performance policy for adaptive effects tiers. It resolves `full | reduced | minimal` shell visuals from platform plus overlay frame telemetry, caps blur on reduced tiers, and gates wallpaper/theme-effect/shader/animation-overlay layers before those costs spill across the whole shell.
- `src/config/layoutProfiles.ts`
  Built-in and external layout manifest normalization for shell blueprints, shell families, pinned panels, control docks, and top/bottom chrome behavior. `workbench-ide` is now the built-in canonical IDE-shell profile, and layout cycling can stay scoped to the active shell family instead of blindly rotating across incompatible shell models.
- `src/config/ideWorkbenchLayout.ts`
  Dock-graph state model and normalization helpers for the IDE shell. It owns the persisted split tree, stack placements, floating nodes, rail state, focus fallback, maximize state, and the explorer-first default-center behavior.
- `src/config/themePackages.ts`
  Theme-bundle discovery and orchestration from `themes/`. Filesystem themes are now bundle manifests that compose external `/usr` pack ids back into resolved `OverlayThemeDefinition` objects; v1 keeps Settings simple by persisting only the active theme engine id.
- `src/config/themeBundlePacks.ts`
  Standalone modular pack loaders for `appearance-packs/`, `interaction-motion/`, `shell-renderers/`, `theme-recipes/`, and `theme-engines/`. Appearance and motion packs load per-category `tokens/*.json` files; recipe packs load `presentation.json`, `layout.json`, `navigation.json`, `render.json`, `workbench.json`, `explorer.json`, and `mobile.json`; theme engines are thin composition manifests.
- `src/config/uiTokenContract.ts`
  Shared UI-token contract for `color | typography | spacing | radius | border | shadow | opacity | blur | geometry | layer | motion | interaction`. It normalizes category files, emits shared `--gfs-ui-*` CSS variables, and flattens tokens into the Rust/TS theme engine snapshot.
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
  Integrated terminal shell. It owns the tree-based pane/workspace model, keeps PTYs mounted across workspace-tab switches, routes pane-resize behavior through draggable split handles plus the typed terminal command bridge, and keeps the terminal surface memoized and imperative so the hot path stays out of React churn. Terminal rendering is now host-selectable: `settings.terminal.integratedHost` chooses between the Go PTY `wasm-panel` host and xterm, while `TerminalOverlay` keeps one shared pane/tab model above both. Windows defaults to xterm for startup stability; Linux/macOS keep the Go PTY path as the default fast path. The Go path mounts `src/components/terminal/GoPtyTerminalPane.tsx` through `GoPanelHost.tsx`, uses the same Rust PTY backend, and automatically degrades the session back to xterm if the Go runtime cannot boot or encounters unsupported terminal-control flow. xterm remains the compatibility host, and its WebGL renderer is still only loaded after a hardware probe passes. Explorer-driven cwd sync still goes through terminal shell-integration commands instead of literal `cd` injection. Reverse terminal-to-explorer sync now also rides the same native shell-integration lane: the Rust PTY host injects per-shell prompt hooks, strips host-owned OSC cwd markers out of terminal output, updates `TerminalShellIntegrationState`, and emits the typed shell-integration event that explorer preview terminals already consume. Terminal output itself now flows through the shared IPC stream lane plus the runtime host-event bus instead of ad hoc per-pane event names. Integrated shell launch is now profile-aware: `settings.terminal.shellProfile`, `shellPath`, and `shellArgs` describe the durable config, `settings.terminal.shell` is the derived effective command string used by shell-aware frontend helpers, and the actual PTY spawn path still preserves a real backend-side `auto` fallback so Windows can prefer `pwsh` without hard-failing when it is absent.
- `src/components/terminal/GoPtyTerminalPane.tsx` and `src/components/terminal/terminalHostRegistry.ts`
  Shared terminal-host seam above pane rendering. `GoPtyTerminalPane.tsx` is the React wrapper for the Go PTY `wasm-panel` runtime, and `terminalHostRegistry.ts` is the host-agnostic imperative pane registry that lets `TerminalOverlay` focus, clear, and copy across either xterm or Go-backed panes without reaching into host-specific instances.
- `src/components/terminal/TerminalViewportFx.tsx`
  Pane-local terminal presentation leaf. It is now an idle-only decorative layer for inactive DOM panes and avoids live viewport filtering or compositor-heavy effects on the active terminal surface.
- `src/components/terminal/terminalRendererSupport.ts`
  Small runtime probe for terminal WebGL support. It first tries a strict `webgl2` context, then retries without the major-performance-caveat gate if needed, and still rejects software renderers so `auto` mode does not opt into a slow or fallback-backed GPU path.
- `src/components/ScreenshotsManager.tsx`
  Dormant screenshot capture/editor/library surface. The code is retained for a possible future revival, but the active shell must not register it as a built-in panel, home launchpad item, settings section, managed-content catalog entry, or authored icon-theme panel slot while the screenshot suite is disabled.
- `src/components/GitManager.tsx`
  Source-control panel surface. It owns the repo rail, working-tree staging/diff actions, ship controls, and the top-level `Changes | History` split, while delegating reusable Git history/branch loading to the runtime seam instead of growing more inline git-command parsing in the component.
- `src/components/pluginRuntime.tsx`
  Packaged frontend plugin runtime loader. It owns the allowlisted module graph for frontend plugins, including package-local relative imports, `definePreviewLane(...)` preview-lane registration, `defineSettingsSlot(...)` plugin-settings registration, and the host-provided `overlayterm-plugin` bridge helpers/runtime bridge.
- `src/config/pluginPackages.ts` and `src/runtime/useFolderPluginRuntime.ts`
  Packaged plugin discovery/aggregation lane. These files normalize package manifests, bind plugin preview-lane renderers plus plugin-authored settings-slot renderers into the host runtime, aggregate diagnostics/capability counts, and surface the discovered `previewLanes` and `settingsSlots` catalogs upward to `App.tsx`, the panel registry, Explorer, and Settings.
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
  Data-driven local-model catalog plus typed normalization helpers. This is the canonical source for curated local models, backend-option labels (`auto` / `cpu` / `onnx` / `cuda`), hardware-profile metadata, capability ids, default bindings, and per-root override resolution used by Settings plus local AI surfaces. Semantic search still rides this catalog, and the explorer image-cutout lane now uses the same model/capability system through the `image-cutout` capability instead of inventing a feature-local accelerator toggle.
- `src/config/semanticSearch.ts`
  Data-driven explorer semantic-search config. It owns the canonical `name` / `content` / `semantic` search-mode contract, the search-mode labels/descriptions, the text/code extension registry loaded from `semanticSearchFileTypes.json`, and the runtime defaults loaded from `semanticSearchRuntime.json` for chunking/model/backend selection.
- `src/runtime/moduleRuntime.ts`
  Shared runtime-authored module bridge. It compiles authored TS/TSX module graphs for plugins, theme renderers, wallpapers, shaders, and animations, and now routes serializable compile work through the frontend worker host before falling back to the main thread.
- `src/runtime/workerHost.ts`
  Browser-worker orchestration layer for frontend CPU-heavy tasks. It owns worker-lane lifecycle, per-lane telemetry, fallback-to-main-thread behavior, and the shared request/response bridge used by runtime module compilation plus explorer visible-entry shaping.
- `src/runtime/explorerVisibleEntries.ts` and `src/runtime/explorerVisibleEntriesRuntime.ts`
  Shared explorer visible-entry compute lane. Keep canonical tag-filter + dir-first sort semantics here so `FileExplorer.tsx`, the `explorer-compute` worker lane, and any future non-React callers do not drift. Standard backend browsing has a deliberate fast path: when the active source is not search, no tag filter is active, and the view is the backend-sorted `name/asc` default, `FileExplorer.tsx` reuses the listing array directly instead of structured-cloning 100k rows through the worker.
- `src/runtime/tauriClient.ts` and `src/runtime/explorerBackend.ts`
  Typed frontend bridge for native explorer/media commands. Large 3D preview reads now use raw-byte preview transport commands (`fs_read_preview_bytes` / `cloud_read_preview_bytes`) that return `Uint8Array` payloads instead of base64 strings. Explorer `Open With` association lookup and explicit app launch also belong here through the `open_with_*` commands; React should not reintroduce raw platform pickers or per-component shelling-out. Explorer thumbnail callers should enter through this seam too: it now exposes both the legacy data-URL thumbnail command and the identity-aware thumbnail-artifact command used by the shared explorer thumbnail runtime.
- `src/runtime/ipc/` and `src-tauri/src/ipc_runtime/`
  Shared desktop IPC foundation. `control` stays on Specta-generated commands/events for small typed payloads, `artifact` owns backend-cached files and staged binary outputs, `stream` owns ordered packet feeds, and `resource` owns opaque handles for long-lived native/Python state. New high-throughput or long-lived host-facing work should choose one of those lanes explicitly instead of inventing base64/data-URL payloads, `number[]` byte arrays, or custom event-name plumbing.
- `src-tauri/src/lan_share/mobile.rs`
  Browser-facing Axum surface for the sovereign mobile share. It serves the compiled `dist-mobile/` bundle, exposes the full mobile control plane (`/api/list`, `/api/theme`, `/api/search`, `/api/search/status`, `/api/search/scan`, `/api/search/cancel`, `/api/preview`, `/api/thumbnail`, `/api/icon`, `/api/upload`, `/api/plugins`), falls back cleanly when the mobile bundle is missing, and reuses the existing file/Range streaming lane for direct media playback from the desktop host. This layer is now also the resolver for mobile presentation metadata such as entry kind, icon ids, thumbnail URLs, preview capability, and desktop-authored icon-theme/folder-icon rules.
- `src-tauri/src/lan_share/mobile_plugins.rs`
  Host-owned mobile plugin bridge. It scans the same desktop `usr/plugins` root as the packaged plugin system, reads `contributions.mobilePanes` from JSON/TOML manifests, exposes a mobile-safe catalog through `/api/plugins`, streams plugin-local assets through `/api/plugins/{pluginId}/assets/{path}`, and runs mobile backend actions through the existing `plugin_run_backend(...)` path so mobile panes get desktop plugin root access without adding Tauri APIs to the phone bundle.
- `src-tauri/src/open_with/`
  Native `Open With` subsystem. It wraps the vendored platform association/runtime crate, resolves associated apps for Windows/Linux/macOS, launches a selected app against a file, and backs the system picker fallback used by explorer context menus.
- `src-tauri/src/tailscale_commands.rs`
  Native Tailscale integration seam for the mobile share. It owns CLI-backed tailnet status, connect/disconnect flows, and the tailnet host/certificate resolution used when the mobile share needs a remote-safe URL instead of a LAN-only address.
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
  Shared file-operations popout bridge. It owns the `file-operations` window label, persisted request/completion payloads, cross-window event names, and the helper that creates or focuses the dedicated popout window. Transfer completion payloads now also carry `affectedEntries[]` with `entityId`, source/destination paths, `contentRevision`, and mutation kind so explorer refresh logic can reconcile instead of blindly resetting visible state.
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
  Typed frontend seam for the managed Python runtime, persistent sidecar lifecycle, manifest-backed sidecar actions, and embedded `pyo3` execution. Sidecar actions can now exchange `inputArtifacts`, `outputArtifacts`, and `resourceHandles` in addition to plain JSON payloads, so media/ML workflows can keep heavy data off the JSON control lane. New React surfaces should call this layer instead of invoking Python Tauri commands directly.
- `src/runtime/modelManagementBackend.ts`
  Typed frontend seam for shared local-model management. It owns the curated model catalog status, cache-summary reads, and prewarm/download calls so Settings and future AI surfaces do not need to hand-roll Python-sidecar model-management requests.
- `src/runtime/imageCutoutBackend.ts`
  Typed frontend seam for explorer image cutout sessions. It owns session open/prompt/reset/export/copy/close commands plus native drag-start staging so React cutout surfaces never issue raw image-cutout invokes or local temp-file logic. Current UI usage is intentionally bootstrap-first: the surface opens/resets through this seam, edits the mask locally in TypeScript, and only sends an override mask back through export/copy staging when host output is needed.
- `src/runtime/explorerBackend.ts`
  Typed explorer bridge for filesystem/search/task work. In addition to classic name/content search, it now owns the semantic-search command surface (`getSemanticIndexSummary`, `buildSemanticIndex`, `searchSemantic`, `findSemanticSimilar`) so Explorer React code never needs raw invoke strings for AI indexing or similarity work. It is now also the frontend boundary between Rust host truth and the explorer policy lane: host-backed reads/writes stay here, while `bootstrapPolicySession`, `navigatePolicySession`, and `resolveEntryOpenWithPolicy` route through a policy adapter. Ordinary folder navigation defaults to the in-process local policy path on every platform to avoid TS -> Rust -> Go -> Rust navigation round trips. Use `VITE_GREEBLEFS_EXPLORER_POLICY_RUNTIME=go-sidecar` only to force the sidecar for diagnostics or parity work.
- `src/runtime/goExplorerPolicyService.ts` and `src-go/builtin-runtimes/explorer-policy-service/`
  First-slice Go explorer policy service. The TypeScript adapter remains the sidecar client for explorer session bootstrap, navigation/history transitions, and open-entry preview-vs-open-vs-navigate decisions when diagnostics force the policy mode to `go-sidecar`. It is intentionally a policy/orchestration layer, not filesystem truth: listings, file opens, archive inspection, search, and tasks still route through Rust host methods. Do not put normal folder entry back on this sidecar by default without re-proving startup/navigation latency and the extra host-call round trip.
- `src/runtime/extensionHostApi.ts`
  Typed frontend client for the canonical extension-host API. Preview lanes, Go panel runtimes, and future extension surfaces should reach host services such as `context`, `events`, `files`, `selection`, `explorer`, `preview`, `tasks`, `terminal`, and `repo` through this seam instead of inventing ad hoc invoke wrappers. This is now also the frontend wrapper for `events.subscribe`, `files.watch`, `files.unwatch`, `tasks.start_process`, and `tasks.stop_process`.
- `src/runtime/explorerExtensionContext.ts`
  Explorer-owned ambient execution-context builder. It turns the active pane reality into an `ExecutionContextSnapshot` (`roots`, `activeDirectory`, `cwd`, selection, preview session, pane id, `workspaceTabId`, `activeFileType`, `revision`, and repo context) so preview lanes, commands, and runtime calls do not have to guess cwd or focused-file truth from local component state. This builder must stay sparse: it may scan only selected/preview target paths and must not build a full active-directory entry map just to publish `activeDirectory` into the extension host.
- `src-tauri/src/runtime_pipeline/host_events.rs`
  Rust-owned host event bus and ambient explorer-context cache. It owns the built-in topic catalog (`selection.changed`, `preview.session.changed`, `cwd.changed`, `tasks.output`, `tasks.progress`, `files.watch`, and more), browser stream subscriptions, v2 sidecar callback subscriptions, replay/snapshot generation, extension-scoped `ext.<extensionId>.*` publication, and the diffing logic that turns synced explorer snapshots into canonical host events.
- `src/runtime/useFolderPluginRuntime.ts`, `src/components/pluginRuntime.tsx`, and `src/components/GoPanelHost.tsx`
  Shared extension-runtime adapters. `useFolderPluginRuntime.ts` binds discovered plugin packages to the canonical host client plus the current explorer execution context, `pluginRuntime.tsx` is the package-local React/runtime shell that mounted preview lanes consume, and `GoPanelHost.tsx` is the Wasm-panel host bridge that exposes the same host contract plus event-bus subscriptions to Go UI runtimes.
- `src-go/sdk/greeblefs-go/runtime/host_services.go` and `src-go/sdk/greeblefs-go/hostapi/services.go`
  The first-class Go SDK clients for the extension host. Sidecars and Go/Wasm panels now call typed services such as `Context`, `Events`, `Files`, `Selection`, `Explorer`, `Preview`, `Tasks`, `Terminal`, and `Repo` through these SDKs instead of raw host method id strings. The Go SDK now also owns the first-class wrappers for host-event subscriptions plus streamed task/file-watch handles.
- `src/runtime/explorerThumbnailArtifactRuntime.ts`
  Shared explorer thumbnail runtime above `FileExplorer.tsx`. It resolves backend-owned `IpcArtifactDescriptor` thumbnail outputs into browser-safe local asset URLs and caches results by `entityId + contentRevision + dimensions + hover variant` so folder opens and refreshes can preserve visible thumbnails instead of treating every relist as a cold start.
- `src/runtime/explorerCollectionPreviewThumbnails.ts`
  Shared forced-thumbnail seam for folder/archive `overview` mode. It bypasses the normal explorer thumbnail toggle, reuses artifact/model thumbnail readers for local entries, and stages archive members into temporary real files before reading thumbnails so virtual-archive previews stay thumbnail-capable.
- `src/runtime/globalSearchBackend.ts`
  Typed TS bridge for the native global filename index. It wraps the Tauri/Specta commands, resolves local drive roots, merges indexed Tantivy hits with explicit priority-path fallback results, and keeps command-palette consumers out of generated-command details.
- `src/runtime/modelThumbnailBackend.ts` and `src/runtime/modelThumbnailRenderer.ts`
  Frontend GPU-backed 3D model thumbnail generation for the explorer grid. The backend now keys rendered posters by the same semantic identity contract as the rest of Explorer (`entityId + contentRevision`), stores rendered poster data URLs through `src/components/explorer/explorerPreviewCache.ts`, and returns a normal `ExplorerEntryThumbnail` with `kind: "image"` so 3D model posters do not require a separate explorer thumbnail contract.
- `src/config/accelerationRuntime.ts`
  Data-driven acceleration routing catalog for the cross-provider compute lane. It defines the shell-facing routing modes, workload ids, provider labels, and resolution helpers used to decide whether a workload should prefer CPU, native `wgpu`, or the Python-sidecar CUDA path.
- `src/runtime/accelerationRuntimeBackend.ts`
  Typed TS bridge for the acceleration control plane. It is the only frontend entry point for loading the provider snapshot that composes native GPU status plus Python-sidecar CUDA/AI capability probing.
- `src/components/explorer/explorerPreviewRegistry.ts`
  Host-owned explorer preview-lane registry. It resolves built-in lane adapters plus plugin-contributed `previewLanes`, sorts them by priority, matches entries against lane rules, and returns the canonical descriptor that `FileExplorer.tsx` mounts.
- `src/components/explorer/explorerPreviewSystem.ts`
  Shared preview fallback/copy layer plus compatibility export surface. Matching and lane registration now live in `explorerPreviewRegistry.ts`; this file keeps the loading/error/unsupported fallback builders that the preview shell uses.
- `src/components/explorer/explorerPreviewCache.ts`
  Explorer-local preview cache with a byte budget and oldest-entry eviction. Image/text/model preview payloads should flow through this seam so cache invalidation stays path-aware and memory pressure handling stays consistent across preview lanes.
- `src/components/explorer/explorerEditSession.ts`
  Shared explorer draft/session helper for persisted editor drafts, validator wrappers, draft-key moves during rename, and the standard “draft preserved; use Save to retry” save-failure messaging used by preview editors.
- `src/config/explorerArchives.ts`
  Data-driven archive registry for the explorer. It is the TS-side source of truth for which local archive suffixes should route through native extraction/opening and how archive folder labels are derived.
- `src/config/filePreview.ts`
  Data-driven preview metadata helpers for explorer media/text lanes. It centralizes preview MIME mapping, editable-text heuristics, direct-playback allowlists, spreadsheet exclusions, shader format metadata, and the 3D preview source/proxy ceilings. Shell-level preview ownership/matching now routes through `explorerPreviewRegistry.ts` instead of directly branching on these helpers inside `FileExplorer.tsx`.
- `src-tauri/src/runtime_pipeline/extension_host.rs`, `src-tauri/src/runtime_pipeline/commands.rs`, and `src-tauri/src/bin/greeble.rs`
  Canonical Rust-owned extension platform surface. `extension_host.rs` defines the versioned host API schema, permission model, ambient execution-context types, canonical extension manifest normalization, and `.gfsx` inspect/build/pack/install helpers. `commands.rs` exports that surface to Tauri/Specta and is the only place new host-call ids should be added. `greeble.rs` is the local CLI for `greeble ext dev|inspect|build|pack|install`.
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
  Persisted explorer rail, named explorer session snapshots, explorer-local workspace state for tabs plus slot-based workspace layouts, the docked Actions-pane visibility/width snapshot, and the live explorer chrome edit session used by pointer customize/resize flows.
- `src/store/explorerTaskStore.ts`
  Explorer-local task-center store. It hydrates durable task history from the Rust backend, subscribes to live explorer task progress events, and owns the open/close state plus retry/cancel/clear helpers used by the explorer toolbar badge and command palette.
- `src/store/globalSearchStore.ts`
  Palette-scoped global-search state. It owns first-open initialization, status polling, debounced queries, scan lifecycle, and the latest indexed results shown in the shell command palette.
- `src/store/settingsStore.ts`
  Persisted layout/profile settings, wallpaper/shader/animation overrides, icon-theme selection, app-vs-dock theme selection, the native `windowMode` presentation toggle, the native GPU tier override, machine-level developer-mode behavior, the System `developerTestSettingsEnabled` proof toggle, the explorer menu authoring contract (`activeMenuPackId` plus per-context `contextMenuLayoutOverridesByContext`), per-theme explorer chrome layout overrides, dynamic explorer `commandBindingsById` hotkey state, the integrated-terminal profile contract (`shellProfile`, `shellPath`, `shellArgs`, plus the derived `shell` preview string), the `settings.home` contract (active Home pack id, usage-telemetry toggle, per-pack state blobs, and active preset selection by pack id), the plugin-authored settings catalog under `settings.plugins.valuesByPluginId`, the Settings shell path state (`activeRailPath`, `activePluginSettingsSlotId`), and the `settings.mobile` contract for remote mobile-share delivery (`remoteAccessMode`, `tailscaleLoginServer`, `tailscaleHostname`, boot/autostart behavior, and paired-shell preferences). Shell/mobile/plugin configuration should live here rather than inside ad hoc component-local storage. IDE-shell persistence now also lives here through `layout.shellStateByProfile`, `layout.lastProfileIdByShellFamily`, and `layout.followThemeDefaults`.
- `src/store/gpuRuntimeStore.ts`
  Shell-side source of truth for the native GPU runtime snapshot, hydration, event subscription, effective tier, and workload fallback telemetry surfaced in Settings. The System `Developer Test Proofs` block reuses this snapshot rather than inventing a second GPU diagnostics lane.
- `src/store/accelerationRuntimeStore.ts`
  Shell-side source of truth for the cross-provider acceleration snapshot, hydration state, and routing-mode-aware provider availability surfaced in Settings. Future CUDA/AI/media-search surfaces should hydrate this store instead of inventing their own provider probe loop, and the System proof surface should keep reusing its provider/backend diagnostics instead of adding ad hoc CUDA state.
- `src/store/videoEngineStore.ts`
  Shell-side source of truth for the native video engine snapshot, hydration, event subscription, and transport helper wrappers used by `ExplorerVideoEditor.tsx`.

## Theme / Workbench Architecture

- Overlay themes still resolve as the downstream shell identity, but authored filesystem themes are now bundle-first orchestration manifests instead of monolithic packages.
- Theme bundles now orchestrate modular authored lanes:
  - `themes/<bundle>/theme.json` or `theme.toml` points at lanes such as `appearancePackId`, `topBarId`, `iconThemeId`, `wallpaperId`, `shaderId`, `openAnimationId`, `closeAnimationId`, `soundPackId`, `interactionMotionPackId`, `rendererId`, `themeRecipeId`, `themeEngineId`, `homePackId`, and `menuPackId`
  - visual and interaction values should live in top-level `/usr` packs, not bundle-local inline copies: `usr/appearance-packs/<pack>/tokens/{color,typography,spacing,radius,border,shadow,opacity,blur,geometry,layer}.json`, `usr/interaction-motion/<pack>/tokens/{motion,interaction}.json`, and `usr/theme-recipes/<recipe>/{presentation,layout,navigation,render,workbench,explorer,mobile}.json`
  - bundle-local child folders can still package non-token assets and legacy-compatible packs, but canonical first-party theme values should be authored once in the top-level lanes
  - local child ids are scoped as `<themeBundleId>:<localId>` so bundle-local authored packs do not collide with standalone managed roots
  - `src/components/SettingsPage.tsx` `Theme JSON` now edits/imports bundle manifests and persists them in `settings.appearance.customThemeBundles`; legacy monolithic theme JSON is intentionally rejected
  - `themes/andromeda/` is the first full repo-local example that exercises the required core lanes plus local top bar, icon theme, wallpaper, shader, and animation without needing runtime code changes
- Sound packs are now a first-class theme and settings lane:
  - `src/config/soundPacks.ts` owns the managed `sound-packs/` catalog, built-in synth fallback pack, standalone/theme-local manifest loading, and cue ids for shell buttons, explorer navigation, task lifecycle, and notification audio
  - `src/runtime/soundEffects.ts` is the shell-side playback runtime. It resolves the current pack plus category toggles into Web Audio playback and keeps explicit preview support separate from the live enabled-state gates
  - `src/runtime/nativeNotifications.ts` is the host-notification bridge used by the shell to check/request permission and dispatch OS-native notifications without scattering plugin calls through components
  - `src/store/settingsStore.ts` now persists `settings.audio.activeSoundPackId`; `null` means "follow the active theme path", matching the other bundle-pack lanes
  - `SettingsPage.tsx` owns the authored sound-pack selector, cue-category toggles, native-notification controls, and VST path management in one audio section
- Top bars are now a first-class shell subsystem instead of an implicit side effect of `theme.workbench.topBarStyle`:
  - `usr/top-bars/**/top-bar.json` is the canonical shipped top-bar catalog, and `src/config/topBars.ts` should stay the control-zone schema (`leadingControls`, `navigationShortcuts`, `trailingControls`) plus resolver path: explicit user pin, `theme.defaultTopBarId`, legacy `theme.workbench.topBarStyle`, then shipped fallback
  - `src/config/topBarPackages.ts` owns the standalone `top-bars/` loader, so authored top bars no longer need to hide inside theme bundles just to exist on disk
  - `src/components/WorkbenchTopBar.tsx` renders the active top bar from that data-driven definition instead of hardcoding one shell-header workflow in `App.tsx`
  - `src/store/settingsStore.ts` now persists `settings.appearance.activeTopBarId`; `null` means "follow the active theme path"
  - `SettingsPage.tsx` owns top-bar selection in a dedicated `Top Bars` section, plus the open/refresh affordances for the standalone `top-bars/` root
  - Theme bundles can still contribute top bars and choose `theme.defaultTopBarId`; the authored `top-bars/` root and theme-bundle contributions both flow through the same resolver
- Settings navigation is now catalog-driven instead of hardcoded section ids:
  - `src/config/settingsNavigation.ts` defines the canonical settings-section keys, labels, ordering, overview summaries, and keyword metadata used by the rail, overview cards, and command palette
  - `src/store/settingsStore.ts` persists `activeSection` as a typed `SettingsSectionKey`, and `SettingsPage.tsx` reads that store value directly so palette deep-links can land on sections like `Icons`, `Top Bars`, or `Context Menus` without component-local routing state
  - `SettingsPage.tsx` now has two top-level rail paths: the built-in `Settings` catalog and a dedicated `Plugins` path backed by discovered plugin `settingsSlots`
  - `src/components/settings/sections/PluginSettingsSection.tsx` is the shared official Settings host for plugin-authored slots. Plugins should render durable configuration there through the shared store/runtime lane instead of inventing settings UI inside the Plugins manager
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
- Layout dynamics is now a first-class appearance lane separate from interaction motion:
  - `usr/layout-dynamics/**/layout-dynamics.json` is the canonical shipped solver/surface catalog, and `src/config/layoutDynamics.ts` should stay the theme recipe contract plus authoring snapshot/normalization layer over that data
  - `src/runtime/layoutDynamicsRuntime.ts` owns the solver math and the band/free-2d stepping rules, while `src/components/layoutDynamics/LayoutDynamicsCanvas.tsx` is the only supported hot-path integration path for live repulsion, collision recovery, and anchor-return authoring UI
  - `src/store/settingsStore.ts` persists `settings.appearance.layoutDynamicsEnabled`, `layoutDynamicsPresetId`, `layoutDynamicsIntensity`, `layoutDynamicsSurfaceOverrides`, and `topBarLayoutSnapshotsById`; those top-bar snapshots store authored anchors only, never the transient repelled positions
  - `src/components/explorer/ExplorerChromeSurface.tsx` and `src/components/WorkbenchTopBar.tsx` are the first adopters. Explorer adoption is intentionally mixed-mode in v1: surfaces that already carry authored `bandId` / `anchorX` / `anchorY` metadata switch into the layout-dynamics canvas, while untouched legacy slot drafts stay on the old zone/order/offset path until they are explicitly adopted
  - `src/components/SettingsPage.tsx` now exposes a dedicated `Layout Dynamics` section plus `src/animation/LayoutDynamicsLab.tsx`, and those settings are the supported place to tune shared presets, per-surface overrides, and top-bar snapshot resets
- Icon theming is now a first-class managed subsystem instead of an explorer-only concern:
  - `src/config/iconTheme.ts` resolves the canonical built-in icon map, folder/file matchers, UI icon slots, and merge rules for theme-default or user-selected icon packs
  - `src/config/canonicalIconTheme.json` now advertises the full built-in app-chrome slot surface via `uiIcons`, not just file/folder glyph ids; the built-in manifest should mirror the live `AppIcons.tsx` exports so theme authors can discover every overridable shell glyph from one place
  - `src/config/iconThemePackages.ts` discovers dedicated `icon-themes/` packages whose `icon-theme.json` / `manifest.json` files can override explorer file/folder ids plus shell UI icon slots
  - Top-bar and nav-tab panel icons now resolve through reserved `uiIcons.panel_<normalized-panel-id>` slots first, then fall back to generic UI slots like `folder_tree`, `hard_drive`, `sticky_note`, `camera`, `puzzle`, or `shell`
  - `icon-themes/Zen/` is the first full repo-local example pack; use it as the reference shape for authored icon themes
    - Zen now demonstrates both built-in panel slots like `panel_storage` / `panel_notes` and folder-plugin panel slots like `panel_drawable_canvas` / `panel_chronorift` / `panel_sketchfab`
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
  - `usr/explorer-shell-layouts/**/explorer-shell-layout.json` owns pane structure like rail visibility, preview side, and live session sizing behavior
  - `usr/explorer-mode-profiles/**/explorer-mode-profile.json` owns the curated user-facing explorer modes (`balanced`, `navigator`, `focus`, `inspector`) and maps them onto pane-layout ids plus chrome-layout ids
  - `usr/explorer-chrome-layouts/**/explorer-chrome-layout.json` owns topbar/toolbar/workspace-header/rail-header/preview-header/status-strip control zones, order, and per-layout adaptive placement
  - `usr/explorer-customize-controls/**/explorer-customize-control.json` owns the built-in movable-control catalog for the ZBrush-style explorer customize/browser flow
  - `usr/explorer-workspace-layouts/**/explorer-workspace-layout.json` owns multi-pane workspace topology presets, and `usr/explorer-experimental-modes/**/explorer-experimental-mode.json` owns the shipped experimental explorer-mode catalog
  - `settingsStore.ts` persists per-theme `modeProfileOverridesByThemeId`, keyed by theme id, so users can retune a theme's default explorer mode without mutating live explorer session state
  - `settingsStore.ts` persists per-theme `chromeLayoutOverridesByThemeId`, keyed by theme id and `chromeLayoutId`
  - `FileExplorer.tsx`, `ExplorerWorkspace.tsx`, `ExplorerSideRail.tsx`, and the preview panel should render resolved chrome surfaces instead of hardcoded button sequences
  - zone-based chrome edit mode moves controls across those surfaces by rewriting override snapshots; it is not a free-pixel docking system
- Explorer context menus now resolve through a layered authored runtime instead of a flat JSX list:
  - `src/config/explorerContextMenu.ts` is the typed command graph. It owns built-in explorer action ids, metadata (`contexts`, `group`, `priority`, `tone`, `shortcutId`, `behavior`), layout-entry normalization, and legacy flat-override migration helpers.
  - `src/config/menuPacks.ts` owns the declarative `menu-packs/` loader plus the built-in submenu-aware classic pack. Menu packs place command ids, submenus, group slots, separators, quick slots, fallback buckets, and optional per-context renderer hints, but they do not own execution code.
  - `src/config/actionPacks.ts` owns the first-class `actions/` catalog. Action packs are pack-first (`actions/<pack>/action-pack.toml`, `actions/<pack>/actions/<action-id>/action.toml`), can also be discovered from plugin-local `actions/` folders, and are the canonical extensibility lane for new explorer commands going forward.
  - `src-tauri/src/action_commands.rs` plus `src/runtime/actionBackend.ts` are the host-owned execution seam for authored actions. They resolve runner metadata (`interpreter`, `shell`, `cargo`, `binary`), emit the structured invocation context file/env contract, and capture stdout/stderr/exit status so React never shells out directly.
  - `src/config/explorerTheme.ts` resolves `theme.explorer.menuPresentation`, which is presentation-only: renderer preference, materials, motion, density, focus treatment, submenu behavior, and capability routing. Themes can bias `classic` / `hybrid` / `radial` / `sheet` / `hud`, but the active menu pack still owns content.
  - `src/components/explorer/explorerMenuRuntime.ts` combines the invocation snapshot, command registry, authored actions, legacy plugin items, active menu pack, and per-context user overrides into resolved runtime nodes, then hands those nodes to `src/components/explorer/ExplorerContextMenu.tsx`.
  - `open-with` is now a first-class resolver-backed submenu, not a hardcoded menu branch. The runtime reads associated apps from `src/runtime/explorerBackend.ts`, renders those as stable command nodes, and keeps the native system picker as a fallback action instead of the only action.
  - `FileExplorer.tsx` should only create the invocation context and call the runtime. Do not rebuild menu trees inline there. The live explorer menu now also injects an `Edit Menu` affordance that deep-links back into the Settings composer for the current context.
  - `SettingsPage.tsx` now exposes a dedicated top-level `Context Menus` settings section with a three-lane authoring surface: pack/context selection plus action browser on the left, the real runtime menu preview in the middle, and a selected-node inspector on the right. The Explorer section should only link to that lane; do not bury future menu authoring UI back under generic explorer settings.
  - `settings.explorer.contextMenuItemOverrides` is now legacy migration input only; new work should persist `activeMenuPackId` and `contextMenuLayoutOverridesByContext`.
  - Current ship constraint: only the classic nested renderer is fully implemented. The runtime/schema already carries `hybrid`, `radial`, `sheet`, and `hud` as presentation targets for future work.
- `settings.system.developerMode` is now the live-reload gate for expensive development-only watchers:
  - plugin directory watch / fallback polling in `useFolderPluginRuntime.ts`
  - authored shader polling in `App.tsx`
  - authored animation polling in `App.tsx`
  - explorer entry-size root watching in `FileExplorer.tsx`
- `App.tsx` now also renders a fixed `DevPerformanceHud` in local development so frame and browser telemetry stay visible without a manual diagnostics toggle.
- Frontend worker execution is now a first-class runtime lane instead of an ad hoc optimization:
  - `src/runtime/workerHost.ts` is the only place that should create browser `Worker` instances for shared shell/runtime workloads
  - runtime-authored module transpilation uses the `runtime-module` worker lane, while explorer visible-entry shaping uses the `explorer-compute` lane and final React/component materialization still stays on the main thread
  - worker tasks must stay fully serializable; React elements, host APIs, DOM state, and Tauri handles must not cross the worker boundary
  - worker lanes must always keep a safe fallback path so test mode, unsupported environments, or worker boot failures do not break plugin/theme/shader loading or core explorer rendering
  - `DevPerformanceHud.tsx` now surfaces worker activity, fallback count, error count, and last-task duration so frontend threading changes are observable during local performance work
- Universal polyglot runtime pipeline (`runtime-host-v1`):
  - `src-tauri/src/runtime_pipeline/` is the host-owned subsystem that generalizes the Python sidecar pattern into a shared system for `native-sidecar`, `native-command`, `native-tui`, `wasm-panel`, and `wasm-worker` runtime packages
  - every runtime is a self-describing folder containing a single `runtime.toml` (id, kind, compiler, module dir, entry, watch globs, env, args, working directory, permissions, optional `panel` / `command` / `sidecar` / `tui` blocks). Compilers are `go-native`, `go-js-wasm`, `tinygo-wasm`, or `python-sidecar`
  - the `runtime_*` Tauri/Specta surface is the `runtime-host-v1` bridge: `runtime_list_packages`, `runtime_prepare_package`, `runtime_start_sidecar`, `runtime_stop_sidecar`, `runtime_call`, `runtime_run_command`, `runtime_open_tui`, `runtime_get_toolchain_status`. React surfaces should never `invoke()` runtime commands directly; they enter through `src/runtime/externalRuntimeBackend.ts` (generic) or `src/runtime/goRuntimeBackend.ts` (Go-flavored convenience)
  - `native-sidecar` runtimes are now true host peers instead of one-way action sinks. `src-go/sdk/greeblefs-go/ipc/protocol.go`, `src-go/sdk/greeblefs-go/runtime/sidecar.go`, and `src-tauri/src/runtime_pipeline/sidecar.rs` implement nested `host-call` / `host-response` packets, so one Go action may synchronously call typed host methods before returning its final action result.
  - `src/components/GoPanelHost.tsx` is the canonical host for `wasm-panel` runtimes inside the React shell. It mounts a typed bridge on `window.__greeblefsRuntimeHostBridge`, feeds host context (theme/density/CSS vars/size) into the running Go module, and exposes `callRuntimeAction` / `readStorageBlob` / `writeStorageBlob` plus typed events back to the runtime
  - the terminal bridge is now part of the canonical extension-host surface for both Go sidecars and Go/Wasm panels. `terminal.spawn`, `terminal.write`, `terminal.write_many`, `terminal.resize`, `terminal.kill`, `terminal.open_output_stream`, `terminal.register_shell_integration`, `terminal.sync_cwd`, and `terminal.set_prompt_state` are declared in `src-tauri/src/runtime_pipeline/extension_host.rs`, dispatched in `src-tauri/src/runtime_pipeline/commands.rs`, wrapped in `src/runtime/extensionHostApi.ts`, and mirrored in the Go SDK under `src-go/sdk/greeblefs-go/{hostapi,runtime}/`
  - the host-side compile/build cache is content-addressed: `{runtime_id}-{compiler}-{toolchain_version}-{target}-{mode}-{source_signature}` lives under Tauri app-local `runtime-cache/`. Source signatures fingerprint the module dir (path + size + mtime + first 4KiB of content) so authored edits invalidate stale builds without full content hashing
  - builtin runtimes live under `src-go/builtin-runtimes/`; managed-content runtimes live under the new managed-content `runtimes/` root (dev: repo-relative, release: app-local). Both flow through the same registry so plugins/actions/workbenches reference runtimes by `id` instead of inventing per-feature compile/run lanes
  - the Go workspace at `src-go/` owns the first-party SDK (`sdk/greeblefs-go/{ipc,runtime,hostapi,panel}`) plus reference builtin runtimes (`echo-sidecar`, `echo-command`, `sample-panel`, `go-pty-panel`). `sample-panel` is still the canonical host-bridge smoke runtime; `go-pty-panel` is the integrated terminal fast path. It renders common PTY output inside a `wasm-panel`, forwards keyboard, paste, and resize back through the shared terminal host API, subscribes to `terminal.output` and `terminal.shell_integration.changed`, and explicitly requests xterm fallback when it sees unsupported alternate-screen or complex escape-sequence paths. Managed-content Go packages stay outside this workspace and own their own `go.mod`
  - the first real sidecar-host-bridge consumer is `explorer-policy-service`, but it is a diagnostic/parity path for Explorer policy rather than the default folder-open path. Host-call ids such as `explorer.list_location` and `explorer.open_path` belong in `src-tauri/src/runtime_pipeline/commands.rs::dispatch_runtime_sidecar_host_call`; React should not become the permanent broker for those policy reads.
  - pinned toolchain expectations live in `toolchains/go/toolchains.json`. The host probes Go/TinyGo/Python presence at runtime through `runtime_get_toolchain_status`; install/bootstrap stays in `scripts/go/{bootstrap,status,build,test,check}.sh` (exposed via `bun run go:*`) so the native host never reaches for the network on its own
  - the Go workspace scripts are now `go.work`-driven instead of carrying separate hardcoded module lists. Keep new first-party Go SDK/runtime modules registered in `src-go/go.work`, and let `scripts/go/{bootstrap,test,check}.sh` inherit from that source of truth.
  - Windows-specific Go pipeline guardrails now live in the shared bash helper plus runtime-manifest serialization: Rust strips `\\?\` verbatim prefixes before manifest paths reach `bash`, the bash helper converts native Windows paths into shell-usable paths, `bootstrap.sh` probes both `lib/wasm/wasm_exec.js` (newer Go) and `misc/wasm/wasm_exec.js` (older Go), and wasm-only runtimes run `go test` / `go vet` under `GOOS=js GOARCH=wasm`.
  - the Python sidecar's external behavior is unchanged, but it now also ships a `runtime.toml` mirror at `src-python/runtime.toml`, so the universal registry sees one unified catalog. The legacy `python_*` Tauri commands still own Python sidecar lifecycle/IPC; the new `runtime_*` surface is the lane for Go and future Wasm work
  - `src-tauri/src/runtime_pipeline/driver.rs` is now the compiler-driver seam for runtime packages. Default target resolution, toolchain-version routing, artifact naming, and build invocation belong there instead of inside `commands.rs`; future compiler families should land by adding a driver entry first.
  - hardening contracts that future runtime work must preserve:
    - **Path sandboxing for managed-content runtimes.** `src-tauri/src/runtime_pipeline/discovery.rs::enforce_managed_path_sandbox` rejects any managed-content runtime whose resolved `module_dir` / `entry` / `working_directory` escapes the package directory the manifest lives in. Builtins are trusted source so they skip the check. Add to the sandbox set whenever `RuntimeManifest` grows new host-resolved paths.
    - **Wasm artifact loading goes through the Tauri asset protocol.** `GoPanelHost.tsx` resolves the compiled `.wasm` via `convertFileSrc(prepared.artifactPath)` before fetching, so packaged builds respect the configured `assetProtocol.scope` and platform-specific path encoding. Do not regress to raw `file://` fetches.
    - **`wasm-panel` runtimes cannot self-call the host bridge.** `GoPanelHostBridge.callRuntimeAction(targetRuntimeId, ...)` requires the *peer* runtime id; targeting the panel's own id throws. Panels needing host state must talk to a peer `native-sidecar` runtime through the same `runtime_call` lane every other consumer uses.
    - **Each panel mount carries a unique `data-bridge-token`.** The Go SDK locates its DOM root through `[data-bridge-token="<token>"]`, so multiple panels of the same runtime id mount cleanly side by side. The token is committed to React state (not a ref) so the DOM attribute is observable before the Go module's `panel.Run` queries it.
    - **Lazy compilation must keep working in installed builds.** `runtime_pipeline::driver::resolve_go_build_script_path` resolves `scripts/go/build.sh` in this order: `GREEBLEFS_GO_BUILD_SCRIPT` env override → `<app_local_data>/scripts/go/build.sh` (what the installer copies) → repo-relative dev fallback. `scripts/build-and-install-linux-local-release.sh` is the source of truth for the install copy step; if you add a new Go pipeline script, copy it there too. `GREEBLEFS_APP_LOCAL_DATA_DIR` overrides the app-local root for tests and ops scenarios.
- Managed content roots now split by runtime mode around a canonical `usr/` backbone:
  - repo `usr/` is the only canonical shipped-content authoring root for configurable systems such as themes, top bars, explorer layouts, explorer performance tuning, menu packs, sound packs, home packs, icon themes, actions, runtimes, wallpapers, shaders, animations, interaction motion, shell renderers, theme recipes, theme engines, and the Rust domain catalogs
  - UI visual and interaction tokens are authored under the top-level pack lanes. `usr/domain/theme-manifests.json` is derived/cache metadata for the Rust domain catalog and must not become an authored UI value store.
  - `usr/manifest.json` plus `src/config/usrManifest.ts` are the source of truth for shipped lanes, bundled lanes, and env-var suffixes; do not add new configurable shipped folders without registering them there
  - `bun run tauri dev` injects `VITE_GREEBLEFS_USR_DIR` / `GREEBLEFS_USR_DIR`, `GREEBLEFS_MANAGED_CONTENT_ROOT`, and the legacy `OVERLAYTERM_*` aliases from the manifest so every shipped configurable lane resolves out of `usr/<lane>` in dev by default
  - installed/release builds bundle `usr/` once as a Tauri resource, then bootstrap missing files into the writable managed-content root under Tauri `AppLocalData/usr`; runtime reads the writable root, not the immutable bundled copy
  - `src/config/appContentDirectories.ts` owns managed-content path resolution, manifest-backed lane mapping, and the release/runtime root bootstrap contract; `notes/` and `Screenshots/` remain runtime-state roots outside shipped `usr/`
  - `src/App.tsx` and `SettingsPage.tsx` consume the managed-content catalog so workspace roots and folder-open commands stay discoverable as new managed roots are added
  - release migrations now also carry old `co.overlayterm.app` app-local directories forward into `co.greeblefs.app`
  - layout auto-probe now prefers `~/.greeblefs/greeblefs.layouts.{json,toml}` before older `.greeble` / `.overlayterm` fallbacks
  - explorer layout picker ownership/order now rides the file-backed manifests too: `usr/explorer-layouts/**/explorer-layout.json` may declare `ownership: "shipped" | "user"` and per-layout `sortOrder`, and first-party shipped presets should always mark themselves `shipped` so the picker does not bucket them as user content
  - Rust domain presets now treat `usr/domain/shell-blueprints.json`, `usr/domain/theme-manifests.json`, and `usr/domain/workbench-presets.json` as the authored source of truth; `overlay-contracts` validates the bundled JSON and `src-tauri/src/domain_commands.rs` prefers runtime-editable `usr/domain/*.json` from the writable managed root before falling back to the bundled copies
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
  - `ExplorerWorkspace.tsx` owns workspace tabs, the separate visible-pane switcher, and slot-based `single` / `split` / `triple` / `quad` rendering
  - each workspace tab owns a stable set of pane slots (`pane-1` through `pane-4`) and each occupied pane slot maps to its own `ExplorerInstanceId`, so `FileExplorer` still owns path/history/search/preview state at the session level
  - `explorerStore.ts` persists the workspace snapshot as `workspace.tabs[] + activeWorkspaceTabId`, where each workspace tab stores its own layout mode, focused pane, split ratios, and pane-slot session bindings
  - workspace normalization is collapse-safe: when the UI drops from `quad` to `triple` / `split` / `single`, hidden pane sessions stay attached to their slots and are restored when the layout expands again
  - commander-style cross-pane actions are an explicit bridge, not header-owned filesystem logic: `FileExplorer.tsx` publishes live pane path/selection snapshots upward, and `ExplorerWorkspace.tsx` sends navigation / refresh / selection-transfer requests back down into the active explorer instance
- `FileExplorer.tsx` now takes `workspacePaneCount` from `ExplorerWorkspace.tsx` so multi-pane layouts can compact toolbar chrome, suppress the explorer status bar, and hide the side preview surface until the workspace returns to `1-Up`.
- `FileExplorer.tsx` shares directory/search result caches across explorer sessions so alternate surfaces do not duplicate backend reads unless a mutation invalidates the cache.
- `FileExplorer.tsx` now treats folder navigation as an atomic commit: slow or stale directory loads should not blank the file area or partially switch path state. Keep the previous folder surface mounted until the winning listing is ready, then commit path/history/entries together.
- `FileExplorer.tsx` now settle-batches viewport enrichment work so visible-entry size measurement and native-icon resolution only launch after a short scroll idle window instead of hammering Tauri on every transient virtualized viewport shift.
- `FileExplorer.tsx` keeps small folders mounted under a bounded entry limit so ordinary home/project folders do not churn a virtual row window while the user fling-scrolls. Huge folders still use the bounded virtual window and must not render the entire listing.
- `FileExplorer.tsx` owns both file-centric actions and explorer-local shell controls, so the shared top bar stays panel-agnostic while the explorer keeps its mode/source/preview controls adjacent to the path/search field.
- Previewable media is now split into three host-owned explorer lanes instead of one generic browser fallback:
  - image editing stays in `ExplorerImageEditor.tsx` through the shared CropperJS-based editor used by explorer preview and retained dormant screenshot code
  - audio playback/editing now lives in `ExplorerAudioWorkbench.tsx`, with a preview-first player surface, an explicit edit-mode workbench, and a wildcard `VST` workflow tab; transport truth still lives in `src-tauri/src/audio_engine.rs` and flows through `src/store/audioEngineStore.ts`
  - the browser `<audio>` lane and preview-proxy workaround are no longer the explorer playback path; the preview pane now talks to a CPAL + Symphonia native engine and only uses SoX for offline mutation
  - video playback/editing now lives in `ExplorerVideoEditor.tsx`, but transport truth lives in `src-tauri/src/video_engine.rs` and flows through `src/store/videoEngineStore.ts`
  - video preview now uses a real `<video>` paint surface again, but the transport/timeline truth still lives in Rust; `src-tauri/src/video_commands.rs` probes the file, allows direct playback only for safe codec/container pairs, and generates MP4 preview proxies for hostile formats
  - PDF preview/editing now lives in `ExplorerPdfWorkbench.tsx`, but document truth/render/save live in `src-tauri/src/pdf_commands.rs` and flow through `src/runtime/pdfPreviewBackend.ts`
  - the PDF lane is intentionally split: Rust owns session truth, page raster, AcroForm extraction, and save/writeback; React only owns page-space overlay UI and preview-pane chrome state
- Local archive handling is now a first-class explorer workflow instead of a pure OS-shell fallback:
  - `src/config/explorerArchives.ts` defines the supported local archive suffix registry (`zip`/`cbz`/`jar`/`apk`, `7z`, `tar`, `tar.gz`, `tar.bz2`, `tar.xz`, `gz`, `bz2`, `xz`) plus the `greeblefs://archive?...` virtual-path helpers, breadcrumb/parent derivation, and archive-folder labels
  - `src-tauri/src/archive_ops.rs` owns the Rust archive truth: full extraction, typed directory listing, per-entry materialization/staging, cache-backed archive opening, explicit extract-to-directory support, and collision-safe extraction into local folders
  - `src/runtime/explorerBackend.ts` is the only TS bridge for archive open/extract/list/materialize work; React should consume archive entries and staged real paths there instead of calling raw commands
  - `FileExplorer.tsx` now treats archive virtual locations as read-only explorer folders: opening a supported archive enters the virtual route from the current cwd, breadcrumbs/history work like a normal folder, nested archives stage temporarily before re-entering another archive route, and preview/editor lanes read from staged real paths while keeping the logical archive path as explorer identity
  - archive contents are intentionally materialize-on-demand: direct drag-out, OS open, or explicit extract actions create real filesystem output, while copy/move/rename/paste remain disabled inside archive virtual routes until native writeback exists
- Native `Open With` is now an explorer-owned workflow instead of a Windows-only picker affordance:
  - `src-tauri/src/open_with/` wraps the vendored cross-platform association/runtime layer and now supports Windows, Linux desktop ids, and macOS app ids plus native picker fallback where the OS exposes one
  - `src-tauri/src/fs_commands.rs` still owns the durable `fs_open_with_dialog` shell command, but it delegates actual picker behavior to `src-tauri/src/open_with/` instead of duplicating per-platform launch logic locally
  - `src/runtime/explorerBackend.ts` is the only TS bridge for associated-program lookup and explicit app launch; React surfaces should call `getExplorerAssociatedPrograms(...)` / `openExplorerPathWithProgram(...)` there instead of shelling out directly
  - `src/components/explorer/explorerMenuRuntime.ts` resolves `Open With` children lazily from cached association state so the classic context menu can show real apps, loading/error placeholders, and the system picker fallback without hardcoded JSX branches
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
    - local preview playback in `src/components/ExplorerVideoEditor.tsx` now rides host-owned byte transport instead of raw asset/file URLs: `src/runtime/videoEditorBackend.ts` calls `readExplorerPreviewBytes(...)`, the React lane creates a `blob:` URL from those bytes, and the lane escalates from the direct source into an ffmpeg MP4 proxy only when native byte transport or the webview decoder fails
    - Tauri asset-protocol support still must stay enabled end to end for the broader local-media contract and future parity with other media surfaces: `src-tauri/tauri.conf.json` must keep `security.assetProtocol.enable = true` with a wide local scope, and `src-tauri/Cargo.toml` must keep the matching `tauri` feature `protocol-asset`
    - preview proxies must stay webview-safe MP4 (`libx264` + `yuv420p` + `+faststart`) even on Linux; the earlier Linux-only WebM/VP9 proxy path regressed real explorer playback for common phone/screen-recording clips
    - preview-stage zoom/pan treatment for visual media is shared on purpose: `src/components/explorer/explorerImageStage.ts` owns the checkerboard background contract and wheel-zoom math used by both image and video preview lanes, so do not fork lane-local stage CSS unless the product intentionally wants them to feel different
  - `src-tauri/src/explorer_identity.rs` is the backend-owned stable-identity layer for the local explorer. It resolves native file identity where possible, preserves in-app move/rename continuity, persists entity/artifact metadata in SQLite under app-local data, and gives the frontend a durable `entityId + contentRevision` contract instead of treating a row as only a path. Windows directory listing intentionally uses `resolve_fast_local_listing_identity(...)` through `fs_commands.rs` so first-frame folder opens do not open a native handle for every listed file; keep stronger native identity work lazy or operation-scoped unless a measured Windows pass proves it belongs in listing.
  - `src-tauri/src/thumbnail_commands.rs` owns rich explorer thumbnail generation and caching for image posters, code cards, shader spheres, audio waveform/spectral thumbnails, and video poster + hover-scrub frame sequences.
  - `src-tauri/src/thumbnail_commands.rs`, `src-tauri/src/image_commands.rs`, `src-tauri/src/audio_engine.rs`, and `src-tauri/src/audio_commands.rs` now attempt the native GPU runtime first where appropriate, but every shipped path still keeps its CPU fallback so unsupported adapters do not break explorer flows
  - `src/runtime/explorerBackend.ts` is the only TS bridge for explorer thumbnail commands. `fs_read_entry_thumbnail` now exists as a legacy data-URL shim for non-migrated callers, while the normal explorer grid/list path should prefer `fs_read_entry_thumbnail_artifact` plus `src/runtime/explorerThumbnailArtifactRuntime.ts`.
  - `src/components/FileExplorer.tsx` should reconcile visible thumbnail state by `entityId + contentRevision`, not by raw path alone. Opening a folder or refreshing an existing one should preserve unchanged visible thumbnails whenever that identity contract is stable.
  - `src/runtime/explorerBackend.ts` is also the only TS bridge for batch rename preview/apply, checksum calculation, item properties, fuzzy jump filtering, and terminal shell-integration commands used by explorer surfaces
  - local transfer UX now has a two-step contract instead of silent collision auto-rename:
    - `fs_plan_transfer_items` reports pending name collisions before paste/drag/pane transfers run
    - `fs_transfer_items` accepts explicit collision policies: `keep_both`, `replace`, and `skip`
    - transfer results now report both the collision policy used and whether a source was actually transferred or skipped
  - `src/runtime/explorerBackend.ts` is the only TS entry point for explorer task list/retry/cancel/clear operations; React surfaces should not call raw `invoke(...)` for task actions
  - `src/components/explorer/ExplorerTaskStatusBadge.tsx` is now an explorer-local Task Center popover instead of a transient badge-only indicator, and it is intentionally scoped to the explorer chrome rather than a global shell panel
  - `src/components/explorer/ExplorerTaskCenterContent.tsx` is the shared Task Center renderer used by both the inline explorer popover and the dedicated file-operations popout window
  - `src/runtime/explorerPicker.ts` plus `src/windows/PickerWindowApp.tsx` are the shell-owned secondary picker surface:
    - archive extraction, `Copy To...`, `Move To...`, repository import, and other file/folder selection flows should route through this runtime instead of ad hoc OS dialog calls
    - `src/main.tsx` boots the `picker` webview label into `PickerWindowApp`, while `App.tsx` only handles embedded picker mode for the few workflows that intentionally stay in-surface
    - picker requests/results are persisted and broadcast cross-window so the requester and picker surface can stay decoupled without inventing a second filesystem truth layer
  - `src/runtime/fileOperationsWindow.ts` plus `src/windows/FileOperationsWindowApp.tsx` are now the shell-owned Task Center popout path:
    - successful transfers publish completion events so other explorer instances can refresh source and target folders without inventing a second transfer backend
    - those completion events now include identity-aware `affectedEntries[]`; future targeting work should extend that payload instead of adding another transfer notification path
    - the popout is task-visibility UI only; transfer truth still stays in Rust plus `src/runtime/explorerBackend.ts`
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
- Secondary Tauri windows require both halves of the contract:
  - the frontend must launch them through `src/runtime/explorerPicker.ts` or `src/runtime/fileOperationsWindow.ts` instead of scattered ad hoc `WebviewWindow` calls
  - `src-tauri/capabilities/default.json` must explicitly include the `picker` / `file-operations` labels plus `core:webview:allow-create-webview-window`, otherwise the UI can look wired while the secondary window silently never appears at runtime
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
- `constellation` has a bounded graph-compute contract:
  - `src/config/constellationGraph.ts` owns graph node budgets and recent-entry limits
  - `src/components/explorer/constellationGraph.ts` must keep relationship edge comparison capped before pairwise scoring, while preserving selected, pinned, and bookmarked workset nodes
  - `FileExplorer.tsx` owns memoized Constellation edge/adjacency lookups; hover explanation should reuse those maps instead of rebuilding graph indexes per pointer event
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
  Theme bundles discovered at runtime. Each bundle is an orchestration manifest that can package local child folders and/or reference standalone managed packs.
  `themes/andromeda/` is the canonical bundle-first reference theme and shows the preferred authored layout for future theme work.
- `appearance-packs/`
  Standalone appearance packs discovered at runtime. First-party packs should use `manifest.json` plus per-category `tokens/color.json`, `typography.json`, `spacing.json`, `radius.json`, `border.json`, `shadow.json`, `opacity.json`, `blur.json`, `geometry.json`, and `layer.json`.
- `top-bars/`
  Standalone top-bar packages discovered at runtime.
- `sound-packs/`
  Standalone shell sound packs discovered at runtime. Theme bundles can pin these by id or contribute bundle-local packs through `themes/<bundle>/sound-packs/`.
- `icon-themes/`
  Standalone icon-theme packages discovered at runtime.
- `menu-packs/`
  Authored explorer menu packs discovered at runtime. These control menu structure per explorer context independently from theme presentation.
- `interaction-motion/`
  Standalone shell interaction-motion packs discovered at runtime. First-party packs should use `manifest.json` plus `tokens/motion.json` and `tokens/interaction.json`.
- `shell-renderers/`
  Standalone shell renderer packs discovered at runtime.
- `theme-recipes/`
  Standalone recipe packs for workbench, explorer, mobile, and dock presentation discovered at runtime. First-party packs should split data across `presentation.json`, `layout.json`, `navigation.json`, `render.json`, `workbench.json`, `explorer.json`, and `mobile.json`.
- `theme-engines/`
  Thin composition manifests discovered at runtime. Engine files should point at `appearancePackId`, `interactionMotionPackId`, and `themeRecipeId`; compiled snapshots are produced by the loader instead of authored as inline token payloads.
- `animations/`
  Authored animation modules.
- `wallpapers/`
  Imported wallpaper media and authored live wallpaper modules.
- `src-python/`
  Repo-owned Python workspace for the managed sidecar. It contains the sidecar manifest, the Python package that serves JSON-line actions over stdio, and the durable guide for adding new Python-backed capabilities.
- `notes/`
  Managed folder-first markdown notes root in development. Release builds move the same root under Tauri `AppLocalData`. Older notes/todos/bugs/prompts subfolders may still exist as plain folders inside this root, but the panel no longer treats them as special categories.
- `skills/`
  Repo-local agent-discovery mirror for the canonical GreebleFS skill folders stored under `/home/ephemara/.codex/skills`. Keep these entries as symlinks to the `.codex` source of truth instead of copying skill contents into the repo.
- `src/vendor/tiptap/`
  Vendored Tiptap source packages used by the notes workspace. Resolution is wired through `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `vitest.browser.config.ts`, while the upstream ProseMirror runtime packages still live in the app dependency graph.
- `queue/`
  Repo-local intake lane for user-owned code folders that may donate systems into GreebleFS. `queue/staging/` is the active review lane, `queue/vault/` is the deferred/rejected lane, and `queue/queue.py` is the first-pass analyzer for repo fit, novelty, dependencies, semantic/path connections, and sanitize/scrub findings before agents start manual assimilation work.
- `reference/`
  Repo-local reference-code intake lane for flattened third-party explorer/editor repos that agents should study without directory-traversal sprawl. The tracked workflow lives at the repo root:
  - `reference_scrub.py` is the profile-driven destructive scrubber for any direct child of `reference/`
  - `reference_scrub_profiles.toml` is the source of truth for per-repo keep/drop/hoist/collapse rules plus the generic fallback
  - `reference_scrub_vscode.py` and `reference_scrub_zed.py` are thin wrappers for the two largest reference repos
  - each scrubbed reference repo gets a root `reference-scrub-manifest.json` plus compressed `repomap.md`
  The scrubber hard-fails on path traversal, absolute/outside targets, and symlink entries, stages the rewrite under `reference/.<repo>.reference-scrub-staging`, and only ever replaces a direct child inside `reference/`
- `shaders/`
  Authored shader modules.
- `src-tauri/`
  Native host and Rust-side integration.
  `src-tauri/src/cloud_commands.rs` is the cloud-drive truth layer for provider credential resolution, OAuth callback handling, account metadata persistence, keychain refresh-token storage, and cloud-backed explorer file operations.
  `src-tauri/src/explorer_pro_commands.rs` is the explorer-pro feature backend for trash/undo, batch rename, duplicate scans, tags, and saved searches.
  `src-tauri/src/image_cutout_commands.rs` is the host-owned explorer image-isolation contract. It owns workflow-mode-aware (`Cutout` vs `Remove BG`) session bookkeeping, Python-sidecar dispatch, transparent PNG staging, sibling save naming, clipboard copy, native drag-prep, and override-mask export handoff for the shared image-isolation surface.
  `src-tauri/src/python_commands.rs` is the managed-runtime truth layer for interpreter discovery, virtualenv bootstrap, package installation, and direct Python execution.
  `src-tauri/src/python_sidecar.rs` owns the persistent managed sidecar lifecycle, workspace sync, stdio protocol, typed sidecar call/start/stop commands, and the backend-facing typed helper API (`action_ids`, decoded JSON helpers) for other Rust modules. The explorer cutout lane now rides that same manifest-backed action system instead of launching a separate Python process per click.
  `src-tauri/src/acceleration_runtime.rs` owns the cross-provider acceleration snapshot surfaced to the shell. It reads the native GPU runtime, optionally probes the Python sidecar for CUDA/Torch/ONNX capability, and turns those signals into a reusable provider catalog for future workload routing.
  `src-tauri/src/global_search/` is the native indexed filename-search subsystem adapted from Sigma. It owns Tantivy schema/index lifecycle, full-drive scans, status tracking, indexed query, and explicit priority-path query helpers; the app intentionally does not expose Sigma's incremental `index_paths` flow because the upstream delete-by-path approach is unsafe for descendant cleanup in the current schema.
  `src-tauri/src/semantic_search.rs` is the explorer semantic-search orchestrator. It validates local-only roots/files, owns the app-local SQLite index contract plus manual task lifecycle, routes embedding/query/similarity work through the Python sidecar, and exposes the typed `build/query/find-similar/status` command surface through Specta.
  `src-tauri/src/python_pyo3.rs` owns the embedded `pyo3` seam for lightweight in-process Python helpers that do not need the long-lived sidecar, including decoded JSON helper functions for backend callers.
  `src-tauri/src/storage_commands.rs` is the storage-tab truth layer for native drive scans. It walks the filesystem on a background thread, tracks progress/cancellation, records logical vs allocated size, aggregates file-type buckets, caches direct child listings for the matrix view, builds a condensed tree plus largest-entry summaries, and prunes completed scan snapshots when newer scans start.
  `src-tauri/src/screenshot_commands.rs` is the retained dormant screenshot file-processing truth layer. It should remain disconnected from visible shell routes unless the screenshot suite is intentionally revived.

## Validation Commands

- `npx vitest run --environment node src/test/workbenchTheme.test.ts src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts`
- `npx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/config/workbenchTheme.ts src/config/explorerTheme.ts src/config/appearance.ts src/components/CommandPalette.tsx src/components/TerminalOverlay.tsx src/components/SettingsPage.tsx src/components/explorer/ExplorerSideRail.tsx src/components/FileExplorer.tsx src/App.tsx src/test/workbenchTheme.test.ts src/test/explorerTheme.test.ts src/test/themePackageExplorerRecipe.test.ts src/test/themePackages.test.ts src/test/explorerSideRail.test.tsx`
- `bun run test:unit`
- `bun run test:runtime-stack:quick`
- `bun run test:runtime-stack`
- `bun run test:unit src/test/filePreview.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts src/test/fileExplorer.viewModes.test.tsx`
- `npx vitest run src/test/panelRegistry.test.tsx src/test/storageTreemap.test.ts src/test/storageWorkbench.test.ts src/test/storageStore.test.ts --reporter=dot`
- `bun run test:browser`
- `bunx vitest run src/test/commandPalette.test.tsx src/test/ExplorerWorkspace.test.tsx src/test/explorerStore.test.ts --reporter=dot`
- `bun run build:mobile`
- `bunx vitest run src/test/mobileApp.test.tsx --reporter=dot --testTimeout=30000`
- `bun run build`
- `cargo test --manifest-path src-tauri/Cargo.toml global_search -- --nocapture`
- `python3 -m py_compile src-python/greeblefs_sidecar/*.py`
- `node scripts/run-cargo-tests.mjs`
- `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
- `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib`
- `cargo test --manifest-path src-tauri/Cargo.toml runtime_pipeline:: -- --nocapture`
- `go test ./sdk/greeblefs-go/...`
- `cargo test --manifest-path src-tauri/Cargo.toml storage_scan_ -- --nocapture`
- `bunx vitest run src/test/pluginPackages.test.ts src/test/pluginRuntime.test.ts src/test/pluginRuntime.edge.test.ts src/test/vibeCapsule.pluginPackage.test.ts src/test/useFolderPluginRuntime.test.tsx src/test/useFolderPluginRuntime.fallback.test.tsx src/test/useFolderPluginRuntime.queue.test.tsx src/test/goPanelHost.test.tsx --reporter=dot`
- `cargo run --manifest-path src-tauri/Cargo.toml --bin greeble -- ext inspect <plugin-dir> --json`
- `cargo run --manifest-path src-tauri/Cargo.toml --bin greeble -- ext build <plugin-dir> <staging-dir> --json`
- `cargo run --manifest-path src-tauri/Cargo.toml --bin greeble -- ext pack <plugin-dir> <bundle.gfsx> --json`
- `bunx vitest run src/test/pythonConfig.test.ts src/test/pythonRuntimeBackend.test.ts src/test/terminalOverlay.test.tsx -t "Python" --reporter=dot`
- `bunx vitest run src/test/hotkeys.test.ts src/test/explorerStore.test.ts src/test/fileExplorer.searchTelemetry.test.tsx --reporter=dot`
- `bunx vitest run src/test/explorerImageEditor.test.tsx --reporter=dot`
- `bunx vitest run src/test/explorerImageEditor.test.tsx src/test/explorerImageCutoutSurface.test.tsx src/test/explorerImageCutoutMask.test.ts --reporter=dot`
- `bunx vitest run src/test/explorerVideoEditor.test.tsx --reporter=dot`
- `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "image" --reporter=dot`
- `python3 -m unittest discover -s tests_python -p 'test_*.py' -v`
- `python3 reference_scrub.py --all --skip-repomix`
- `python3 reference_scrub.py --all --apply`
- `python3 reference_scrub_vscode.py --apply`
- `python3 reference_scrub_zed.py --apply`
- `bash ./install.sh`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1`
- `bash ./install.sh --launch`
- `bun run release:linux:install`

## Common Errors / Lessons Learned

- Cloud provider credentials now have two sources:
  - saved from `Settings > Cloud Accounts`, which stores the provider client ID in app-local data and the optional client secret in the OS keychain
  - bundled or runtime environment variables (`GREEBLE_GOOGLE_DRIVE_CLIENT_ID`, `GREEBLE_GOOGLE_DRIVE_CLIENT_SECRET`, `GREEBLE_DROPBOX_CLIENT_ID`, `GREEBLE_DROPBOX_CLIENT_SECRET`)
    `src-tauri/build.rs` now loads those keys from the real process environment plus ignored `.env` / `.env.local` files in the repo root or `src-tauri/`, then bakes them into the Tauri build so release binaries can ship app-owned OAuth credentials without committing secrets.
    Saved Settings credentials take precedence over env vars until they are cleared.
- Dropbox OAuth no longer uses a random localhost callback. The app now expects the Dropbox app console to allow the fixed redirect URI `http://localhost:53682/callback`; if Dropbox sign-in times out, check that exact callback registration before touching the browser-launch code.
- Repo-wide `npx tsc --noEmit` is currently red on several pre-existing generated-contract and test typing issues unrelated to the workbench/explorer theme system. The narrowed command above now only leaves `src/runtime/useFolderPluginRuntime.ts` as an unrelated pre-existing failure.
- Repo-wide `bunx tsc --noEmit` is also currently red on pre-existing explorer audio and VST typing issues outside the PDF lane (`src/components/ExplorerAudioWorkbench.tsx`, `src/runtime/vstBackend.ts`). Use targeted Vitest coverage plus `cargo check` when validating PDF work until those unrelated strict-mode failures are cleaned up.
- Repo-wide `.\node_modules\.bin\tsc.exe --noEmit -p tsconfig.json` is also currently red on the nested `src/src/frontend/**` workspace, which is not part of the main Tauri shell path. When validating work in the main app, filter the compiler output to the touched files instead of treating that secondary frontend tree as a regression in the storage lane.
- Use `node scripts/run-cargo-tests.mjs` for the Rust suite on Linux. Raw `cargo test --workspace` will try to build macOS and Windows workspace members that are intentionally skipped by the host-aware runner.
- On this Windows 10 26100 machine, the previous Rust lib-test startup crash (`STATUS_ENTRYPOINT_NOT_FOUND` / `0xc0000139`) was fixed by keeping `cargo test --manifest-path src-tauri/Cargo.toml --lib` on a Windows-safe unit graph. `src-tauri/src/lib.rs` now excludes desktop/Tauri/native-host modules from `cfg(test)`, uses small test stubs for acceleration/fs/PyO3 seams, and leaves production builds on the full module graph. `scripts/validate-runtime-stack.mjs --quick` now requires the Rust lib harness to run and pairs it with `cargo check --manifest-path src-tauri/Cargo.toml --lib`; do not reintroduce compile-proof fallbacks or API-set DLL shims for this issue.
- If Go runtime prep breaks only on Windows, inspect the Windows-path normalization seam before touching explorer/terminal runtime logic. The durable hot spots are `src-tauri/src/runtime_pipeline/manifest.rs` for stripping `\\?\` canonicalized paths and `scripts/go/_common.sh` for converting Windows-native paths plus probing the correct `wasm_exec.js` location for the installed Go version.
- The shared desktop IPC foundation is now the default transport policy for the desktop shell. Keep small metadata on Specta/control, use `src/runtime/ipc/*` plus `src-tauri/src/ipc_runtime/*` for backend-owned artifacts, ordered streams, and opaque resource handles, and only add a raw-byte exception through the shared binary helpers. New base64/data-URL, `number[]`, or ad hoc `listen(\"terminal-output-*\")` hot paths should be treated as regressions unless there is a documented reason they cannot use the shared lanes.
- Explorer rich thumbnails are native and cache-backed. `src-tauri/src/thumbnail_commands.rs` writes generated posters and video hover frames under the app-local `explorer-thumbnails` cache, keyed by `entityId + contentRevision + variant + dimensions`. If thumbnails look stale, inspect that identity/revision contract and the app-local cache before trying to patch React rendering. React refresh paths should preserve unchanged thumbnail state; a blanket thumbnail-map clear on routine relist is now a regression.
- If explorer video playback suddenly dies with blank preview panes again, check the whole local-media chain before touching the UI chrome: `security.assetProtocol` in `src-tauri/tauri.conf.json`, the `protocol-asset` feature in `src-tauri/Cargo.toml`, the native preview-byte bridge in `src/runtime/videoEditorBackend.ts`, and the preview-proxy codec/container in `src-tauri/src/video_commands.rs`. The safe baseline is native preview bytes into `blob:` playback plus MP4/H.264/AAC proxies when decode or transport fails.
- Native GPU offload is now a host-owned subsystem, not a generic frontend WebGPU free-for-all. New GPU-first explorer/media work should enter through `src-tauri/src/gpu_runtime/`, expose typed status through Specta, and preserve a CPU fallback path; browser-local GPU surfaces like shader preview and terminal WebGL remain separate systems.
- If the video timeline starts asking for an audio file while editing a normal video, inspect `src-tauri/src/video_engine.rs` before touching UI copy. That symptom usually means the video engine failed to link deck `B` to the selected file’s embedded audio track; it is not a real request to import standalone audio.
- Built-in theme switches should go through `settingsStore.applyThemeSelection()` or the Settings theme catalog flow, not a direct `updateAppearance({ activeThemeId })` call. The direct path now skips pilot baseline resets for dock mode, layout profile, explorer presentation, wallpaper/shader overrides, and related default-shell behavior.
- JSDOM-backed Vitest runs currently fail in this workspace because `html-encoding-sniffer` requires an ESM dependency through a CommonJS path. Node-environment tests still work, so keep pure logic/package-loader tests runnable there until the dependency issue is fixed.
- Python sidecar actions are manifest-driven. Add the Python handler in `src-python/greeblefs_sidecar/actions.py`, register it in `src-python/greeblefs-python-sidecar.json`, and then consume it through `src/runtime/pythonRuntimeBackend.ts` or the Rust sidecar helpers instead of inventing one-off script launch paths.
- Python sidecar payload design now has two lanes: keep lightweight control data in JSON, but pass heavyweight media/ML artifacts through `inputArtifacts` / `outputArtifacts` and long-lived interpreter/job/session state through `resourceHandles`. If a Python feature starts moving image bytes, masks, embeddings, or repeated session state through `payloadJson`, stop and redesign the contract around the shared IPC foundation first.
- Cross-provider CUDA/AI routing is now control-plane-driven. If a new feature wants NVIDIA acceleration, add or reuse a workload id in `src/config/accelerationRuntime.ts` and extend `src-tauri/src/acceleration_runtime.rs` or the native GPU runtime instead of hardcoding provider selection inside a panel or backend command.
- `preferCuda` is a routing preference, not a guarantee. The shell will still fall back to native `wgpu` or CPU when the managed Python sidecar is not running, the CUDA probe action is unavailable, or CUDA/Torch/ONNX are not actually ready on the machine.
- Explorer semantic search is currently manual-task, local-root, and text/code-only by design. If semantic results look empty, check the current root's index status first; cloud roots, binary/media files, and unbuilt local roots are intentionally excluded from v1.
- The managed runtime still seeds its boilerplate package under `overlayterm_runtime` for compatibility. Do not rename that folder casually; it needs an explicit migration if we ever remove the legacy name from persisted runtimes.
- `bun run test:browser` currently launches a headed Playwright Chromium session in this workspace. Without an X server it fails before any tests run; use `xvfb-run` or a headless browser config if you need browser validation locally.
- Keep Vite/Vitest watcher ignore lists covering the repo-root Rust `target/` tree, not just `src-tauri/target*`. After `cargo test` or `export-bindings`, browser runs can hit Linux `ENOSPC` watcher limits if the root `target/` artifacts are still inside the watch graph.
- `plugins/**/dist/**` is versioned source for packaged frontend plugins in this repo. Do not treat those directories like app-build output or let a blanket `dist/` ignore swallow shipped plugin entries.
- The reference scrubber is intentionally destructive. Future agents should not manually flatten `reference/*` by hand and should not point the scrubber at anything outside `reference/`; use `python3 reference_scrub.py --repo <name>` or the wrapper scripts so the safety checks and repomap generation stay intact.
- Packaged frontend plugins are no longer single-file only. `src/components/pluginRuntime.tsx` now executes a package-local module graph, so plugin entries may import sibling helpers with relative paths, but those imports must remain inside the plugin root and still cannot pull arbitrary npm dependencies.
- Packaged preview lanes now ride the same plugin package system as actions/context menus instead of a separate extension stack.
  - `src/config/pluginPackages.ts` is the only place that should turn manifest `contributions.previewLanes` into bound React lane components plus runtime ids.
  - `useFolderPluginRuntime.ts`, `App.tsx`, `panelRegistry.tsx`, `ExplorerWorkspace.tsx`, and `FileExplorer.tsx` should only consume the aggregated preview-lane catalog; do not rediscover plugin preview manifests ad hoc in panel code.
- The extension platform is now Rust-owned, Go-first, and TS-thin by design.
  - `src-tauri/src/runtime_pipeline/extension_host.rs` owns the canonical schema, permissions, bundle tooling, and `ExecutionContextSnapshot` truth.
  - `src-go/sdk/greeblefs-go/runtime/host_services.go` and `src-go/sdk/greeblefs-go/hostapi/services.go` are the reference orchestration SDKs.
  - `src/runtime/extensionHostApi.ts` should stay a thin generated-types-aware wrapper, not a second source of truth.
- Preview lanes and extension runtimes should consume the ambient execution context instead of inventing their own cwd/path heuristics.
  - `src/runtime/explorerExtensionContext.ts` is the source for explorer-derived `ExecutionContextSnapshot`.
  - `useFolderPluginRuntime.ts`, plugin preview props, and runtime host calls already forward that context; if a future lane starts manually reconstructing cwd from local component state, treat it as a regression.
- Canonical extension manifests can now come from either `extension.toml` or legacy `plugin.json`, but both normalize through the same Rust extension-host model before discovery/build/install.
  - Keep `src/config/plugins.ts`, `src/config/pluginPackages.ts`, and `src-tauri/src/runtime_pipeline/extension_host.rs` in sync whenever manifest shape changes.
- `.gfsx` is now the canonical packed extension artifact and `src-tauri/src/bin/greeble.rs` is the local bundling/install CLI.
  - Source-folder authoring still stays valid under `usr/plugins/**`, but distribution/validation should prefer `greeble ext inspect`, `build`, `pack`, and `install` instead of hand-copying plugin folders around.
- Mobile plugin panes deliberately reuse the desktop plugin root but stay HTTP-only on the PWA side.
  - `src-tauri/src/lan_share/mobile_plugins.rs` owns manifest discovery, backend execution, asset path validation, and current mobile-share context resolution.
  - `src-mobile/**` should consume `/api/plugins` through `mobileApi.ts` and should never import Tauri `invoke`, desktop plugin runtime modules, or filesystem APIs.
  - Mobile pane theme data belongs in manifest-driven CSS variables (`contributions.mobilePanes.theme.cssVars`) so plugin panes can follow the same bundle/themeable pipeline without hardcoded phone UI colors.
- `cargo-native` is now a real runtime compiler family and `c-native` is still intentionally unsupported.
  - If an extension needs native Rust behavior today, route it through `cargo-native`. If `c-native` is requested, the current correct behavior is the explicit typed unsupported-driver error from `runtime_pipeline/driver.rs`, not a silent fallback.
- Host event streaming is now dual-stack.
  - `runtime-host-v3` plus `stdio-json-lines-v2` support real unsolicited `event` and `snapshot` packets for sidecars, Go/Wasm panels, and TS preview lanes.
  - Legacy `stdio-json-lines` sidecars still remain request/response only. If a runtime needs push subscriptions, opt it into the v2 transport instead of assuming the old bridge will magically receive host events.
- Plugin-shipped themes must stay bundle-first even inside extension content.
  - Legacy monolithic theme package shapes are intentionally rejected now. Theme contributions under plugins should embed or reference modern bundle lanes such as `appearancePackId`, not old top-level `theme` / `visuals` blobs.
- UI presentational literals are guarded by `scripts/audit-ui-literals.mjs`.
  - New raw `px`, color, blur, shadow, z-index, duration, or easing literals in `src/**` and `src-mobile/**` should fail the audit unless they are approved non-presentational math with an inline `ui-literal-audit: allow` note.
  - Prefer adding values to `/usr` appearance, interaction-motion, or theme-recipe packs and consuming emitted CSS variables or typed token lookups in UI source.
- Explorer context-menu plugin contributions can now open plugin panels through `panel-request` execution. If a plugin needs a folder/file handoff from Explorer, use `src/runtime/pluginPanelRequests.ts` and the `overlayterm-plugin` helpers instead of inventing ad hoc window events or local-storage keys.
- The dev HUD is internal to this app. It is not a Tauri plugin or external Chrome overlay, and it should be treated as part of the shell runtime.
- The screenshot suite is currently disabled from the visible product. `ScreenshotsManager.tsx`, `screenshotBackend.ts`, and `src-tauri/src/screenshot_commands.rs` remain in-tree, but future agents must not surface screenshot UI through `panelRegistry.tsx`, `ExplorerHomeSurface.tsx`, Settings navigation/content, managed-content catalog cards, or icon-theme panel slots without an explicit product decision to revive it.
- If the screenshot suite is revived, do not wire the screenshot panel to `explorerTaskStore`. That store is global explorer/Yazi task state; rendering it inside screenshot status chrome leaks unrelated delete/copy jobs into screenshot errors and makes debugging cross-subsystem issues much harder.
- The retained screenshot capture path is plugin-backed and file-first:
  - `src/runtime/screenshotBackend.ts` bridges `tauri-plugin-screenshots-api` guest calls with the typed Rust stage/finalize helpers.
  - `src/components/ScreenshotsManager.tsx` should capture monitors lazily, not all at once, and should keep raw plugin capture files immutable for the lifetime of a capture session.
  - If a user wants to edit a region, crop into a staged working file first. Do not mutate the raw plugin capture in place or you lose the full-monitor source for recrop/re-edit.
- Retained screenshot editing shares the preview-pane editor:
  - `src/components/ExplorerImageEditor.tsx` is the shared image editor surface for both explorer preview editing and screenshot editing.
  - Do not split explorer images and screenshots onto different editors again, and do not reintroduce the old screenshot-only annotation canvas inside `ScreenshotsManager.tsx`; both paths should stay on the same CropperJS-based editor surface.
- Preview wildcard tabs must be registered by the mounted lane surface, not guessed only from `FileExplorer.tsx`.
  - `ExplorerAudioWorkbench.tsx`, `ExplorerPythonWorkbench.tsx`, and the image cutout path all rely on lane-owned wildcard registration.
  - if the preview header stops reflecting a lane-owned tab, inspect memo dependencies around `renderPreviewWorkflowToggle` and the preview-chrome registry before assuming the lane forgot to register tabs.
- Preview-pane context menus must stay host-owned and metadata-driven.
  - Preview workbenches should register base actions and workflow overlays through `explorerPreviewContextMenu.ts` instead of inventing separate right-click systems.
  - If preview-specific menu items disappear, inspect the host-owned registration/cleanup path in `FileExplorer.tsx` before changing menu-pack layouts or adding more permanent header chrome.
- Image isolation is now one visible `Cutout` lane backed by two workflow modes.
  - `Cutout` is prompt-first and must open with an empty mask.
  - `removeBackground` still exists as the explicit heuristic auto-removal workflow mode, but it stays hidden behind `Auto Remove BG` and should behave like a helper that merges back into the visible cutout history instead of another preview-header tab.
  - The left tool rail is the durable home for grouped cutout tools. If future work adds more isolation tools, extend the tool-group registry in `src/config/imageCutoutTools.ts` before adding more permanent chrome.
  - If future work makes the visible lane feel like two separate mini apps again, check `workflowMode` handling in `ExplorerImageEditor.tsx`, `ExplorerImageCutoutSurface.tsx`, `src-tauri/src/image_cutout_commands.rs`, and `src-python/greeblefs_sidecar/cutout_runtime.py` before adding more UI chrome.
- Avoid sending screenshot previews through Rust as base64 PNG payloads again. The current screenshot path is intentionally file-backed so capture stays fast, monitor previews can use asset URLs, and final output only crosses the bridge as small typed commands.
- Explorer interaction tests that need DOM drag/drop still need a browser-like environment, so the current JSDOM dependency failure blocks the most relevant explorer UI regressions even when the narrowed TypeScript pass is green.
- Audio workbench playback state should not be tied to parent React state churn. Keep playhead motion on an imperative RAF path and keep waveform/spectral subsurfaces memoized so shell-level rerenders do not consume the frame budget.
- Managed SVG wallpapers and theme previews are safest when inlined to data URLs before they reach the frontend. In this workspace, Tauri/WebKit can intermittently fail on filesystem-backed SVG theme assets and imported custom SVG wallpapers, then spam `Failed to load resource` errors if they stay on raw asset URLs.
- `fs_read_file_base64` already returns a complete data URL for small files in this workspace. Do not wrap its result in another `data:image/...;base64,` prefix inside icon/theme/media loaders, or browsers will reject the nested URL with `Data URL decoding failed`.
- Theme renderer motion should prefer CSS animation for decorative effects. Renderer-local React state that ticks every frame can force mounted heavy panels like `FileExplorer` through avoidable rerender pressure and can resurrect update-depth problems.
- Do not put shell animation-progress state back into `App.tsx` root state. Folder-authored animation progress now belongs in `src/components/OverlayShellScene.tsx`, and built-in shell motion should stay on CSS transitions. A root `requestAnimationFrame` + `useState` loop will immediately reintroduce frame-budget collapse across the whole shell.
- Shell containment and adaptive effects are complementary, not interchangeable. `contain: layout paint style` / `isolation: isolate` help localize browser layout and paint work, but transparent undecorated windows with blur, wallpapers, and shaders still pay an OS compositor tax. If shell FPS drops, inspect `src/config/workbenchPerformance.ts` and the active wallpaper/shader/theme-effect stack before adding more visual layers.
- The adaptive shell-effects policy may disable blur, shaders, and decorative theme visuals, but it should not hide the selected wallpaper/theme wallpaper base layer. If a wallpaper shows on first paint and then disappears, inspect `src/config/workbenchPerformance.ts` before debugging the asset loader.
- Command-palette typing should stay ahead of indexed search. `App.tsx` now uses the live query for local palette UI but defers the backend-facing global-search query. Do not route every keystroke straight into synchronous or eagerly blocking search work again.
- The local Linux installer now avoids the old Node/Tauri wrapper path. `install.sh` and `scripts/build-and-install-linux-local-release.sh` build with Bun + Cargo directly, then install into `~/.local/opt/greeblefs`.
- Do not keep `build.devUrl` in the base `src-tauri/tauri.conf.json` for release-capable paths. In this workspace, a direct `cargo build --release` will otherwise compile a binary that keeps trying to boot from `http://localhost:1420`. `scripts/run-platform-tauri.mjs` now injects `devUrl` only for the `tauri dev` command.
- This repo is a Cargo workspace, so release binaries land under the workspace-level `target/` directory, not `src-tauri/target/`. Linux install scripts should resolve `cargo metadata` `target_directory` before copying binaries, or they can silently reinstall a stale executable from an old path or from the wrong binary name.
- The local Linux installer now also seeds the managed content directories into `~/.local/share/co.greeblefs.app/{plugins,themes,shaders,animations}` so the installed release has writable runtime content without polluting the top level of `$HOME`.
- Vite still prints a Node 18 warning during builds, but `bunx vite build` succeeds in this workspace and the installer completes successfully on that host setup.
- If a first-party explorer layout shows up under the picker `User` section instead of `Shipped`, the layout package manifest is missing `ownership: "shipped"` or the runtime is still reading an older manifest copy from the writable managed `usr/` root.
- The explorer component is large and performance-sensitive. Route new chrome/metric changes through `src/config/explorerTheme.ts` instead of scattering new magic numbers through `FileExplorer.tsx`.
- Avoid mixing CSS border shorthands with border longhands in the same React style object on explorer rows and chrome surfaces. The dock/layout tests hit real `cssstyle` failures when `borderBottom` and `borderColor` were mounted together, and the longhand form is safer for theme-driven overrides anyway.
- Explorer directory/search caches are intentionally shared at the module level across explorer mounts. Tests or one-off diagnostics harnesses that need isolated backend behavior should call the exported `invalidateExplorerResultCaches()` helper before rendering.
- Explorer preview routing should extend `src/components/explorer/explorerPreviewRegistry.ts`, not add new extension ladders in `FileExplorer.tsx`. `explorerPreviewSystem.ts` now owns fallback copy, while the registry is the shell contract for “what kind of preview is this?” and for priority-based built-in vs plugin lane ownership.
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
- Explorer live layout zoom now splits durable anchors from live presentation. `src/config/explorerViewModes.ts` owns the continuous live grid metrics that render on screen, while `resolveExplorerGridIconModeForCommittedViewMode(...)` in `FileExplorer.tsx` still tracks the committed/durable band for menus, HUD, and persistence. Thumbnail fetch identity stays decoupled from live stage size, so the visible stage and fallback icon can scale continuously without refetch churn.
- Zoom presentation tuning belongs in `usr/explorer-zoom-behaviors/**/explorer-zoom-behavior.json`. `src/config/explorerZoomBehavior.ts` now normalizes grid item padding, thumbnail radius, and row thumbnail-stage sizing from that manifest. If Explorer zoom geometry feels off, tune the `/usr` manifest first instead of re-hardcoding pixel thresholds in `FileExplorer.tsx`.
- Folder-activation performance tuning belongs in `usr/explorer-performance/**/explorer-performance.json` through `src/config/explorerPerformance.ts`. Normal directory double-click navigation must use the direct `navigate(path)` hot path instead of open-entry policy; first-click preview priming stays delayed and cancellable.
- If the Linux/native overlay appears on the wrong display, inspect the monitor-resolution path in `App.tsx` before touching Rust window flags. The frontend now owns monitor selection and overlay geometry; `windowApplyMode` should only apply the chosen presentation atomically.
- If Linux dock mode starts floating in the middle of the screen again, check the post-show re-dock path in `App.tsx` and confirm overlay move/resize listeners are not re-persisting raw X/Y coordinates into `runtimeOverlayBoundsRef`.
- On Linux, do not let `window_apply_mode` abort geometry just because a WM rejects `set_shadow`, `set_skip_taskbar`, or another presentation-only flag. The TS call sites should unwrap the returned Tauri `Result`, and the Rust command should log best-effort flag failures while still applying size/position.
- Explorer task state is now durable and snapshot-backed. Task UIs should hydrate from `fs_list_explorer_tasks` through `src/runtime/explorerBackend.ts` and then merge live `explorerTaskProgressEvent` updates; do not rebuild task truth from component-local event listeners or assume the event stream alone is sufficient after remount/startup.
- Screenshot capture uses physical monitor geometry end-to-end for preview selection and crop/save math. Tauri `Monitor.size` / `Monitor.position` are physical pixels, while the Rust preview path should capture the full monitor image and the crop/save path should stay on the cached physical-pixel image. Keep logical scaling for human-readable labels only.
- Screenshot preview images should stay on stable data URLs or equally stable sources. Avoid converting them to blob URLs and revoking them inside a React state updater, because `React.StrictMode` can replay that updater and revoke the fresh preview before the browser finishes loading it.
- `bun run tauri dev` uses the generated runtime Tauri config from `scripts/run-platform-tauri.mjs`, which points Tauri at the Vite `devUrl`. TS/React edits hot-reload through Vite during that session, but binding generation and startup prep scripts only rerun when the Tauri dev process starts.
- `bun run tauri dev` must keep `beforeDevCommand` Cargo-free. `scripts/run-platform-tauri.mjs` now pre-runs `bindings:generate` once, then hands Tauri a frontend-only `beforeDevCommand` (`bun run dev:frontend`) so the native Rust compile and the Vite boot do not fight over Cargo locks. If the old `Waiting for your frontend dev server to start on http://localhost:1420/...` loop comes back, inspect that split before touching preview code, Go policy code, or the dev URL itself.
- `bun run tauri dev` is now also allowed to reclaim older live GreebleFS frontend/dev siblings before startup. `scripts/cleanup-dev-processes.mjs` recognizes the real running commands (`node .../@tauri-apps/cli/tauri.js dev`, `node .../vite/bin/vite.js`, `node scripts/run-frontend-dev.mjs`, `target/debug/export-bindings`) and skips the current process ancestry so it kills stale siblings without murdering the launch in progress. If the boot fails with `Port 1420 is already in use`, rerun `bun run tauri dev` or manually run `bun run dev:cleanup -- --include-running`.
- Native sidecar host callbacks still ride a blocking stdio loop. `src-tauri/src/runtime_pipeline/commands.rs::runtime_call(...)` must keep `ExternalSidecarManager::call(...)` inside `tauri::async_runtime::spawn_blocking(...)`, because nested host callbacks currently use `dispatch_runtime_sidecar_host_call(...)` -> `tauri::async_runtime::block_on(...)`. Running that exchange directly on a Tokio worker thread reproduces the `Cannot start a runtime from within a runtime` panic and can leave the sidecar manager in a poisoned state.
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
- Explorer drag/drop is split by ownership on purpose:
  - internal explorer moves are pointer-driven and app-owned inside `src/components/FileExplorer.tsx` plus `src/components/explorer/explorerDragAndDrop.ts`
  - external OS file drops still use native/Tauri window drag-drop events
  - native drag-out still routes through `src-tauri/src/desktop_integration.rs`
  Keep `src-tauri/tauri.conf.json` `dragDropEnabled: true` for external ingress, but do not reintroduce HTML5 `draggable` entry cards for normal in-app explorer moves. That mixed ownership is what caused Linux/WebKit drag behavior to feel random and non-deterministic.
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
