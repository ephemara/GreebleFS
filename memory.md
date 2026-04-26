# 2026-04-26 - Shared Desktop IPC Foundation Now Owns Artifacts, Streams, Resources, And Raw Byte Exceptions

- GreebleFS now has one reusable desktop IPC foundation instead of a pile of feature-local transport hacks:
  - `crates/greeble-ipc-contracts` is the shared contract crate exported through Specta.
  - `src-tauri/src/ipc_runtime/` owns the host-side artifact store, stream registry, resource registry, and shared raw-byte helper.
  - `src/runtime/ipc/` is the frontend-owned runtime seam for artifact URL resolution, stream subscription, resource release, and shared binary reads.
- Durable transport rule for new host-facing work:
  - `control`: Specta-generated commands/events for small typed metadata and intent payloads
  - `artifact`: backend-owned files/descriptors for thumbnails, previews, staged exports, and other cacheable bulk outputs
  - `stream`: ordered packet feeds for terminal output, progress, or any higher-rate event lane
  - `resource`: opaque handles for long-lived native or Python state such as sessions, jobs, caches, and engines
  - Do not add new base64/data-URL payloads, `number[]` byte arrays, or ad hoc custom event-name streams when one of those four lanes fits.
- First adopter shape:
  - `src/components/TerminalOverlay.tsx` now opens a typed terminal output stream handle and subscribes through `src/runtime/ipc/streams.ts`; terminal output should no longer depend on per-pane `listen("terminal-output-*")` names.
  - `src/runtime/explorerThumbnailArtifactRuntime.ts` now resolves `IpcArtifactDescriptor` values instead of assuming raw artifact paths, so thumbnail reuse stays inside the shared artifact lane.
  - `src/runtime/explorerBackend.ts` preview-byte reads now flow through the shared `src/runtime/ipc/binary.ts` helper instead of feature-local raw invoke code.
  - `src/runtime/pythonRuntimeBackend.ts` plus `src-tauri/src/python_sidecar.rs` now allow sidecar actions to exchange `inputArtifacts`, `outputArtifacts`, and `resourceHandles` so media/ML flows can move bulk data off the JSON control plane.
- Durable binding rule:
  - `src-tauri/src/specta_bindings.rs` must keep the generated `Channel as TAURI_CHANNEL` import alive, emit `void TAURI_CHANNEL;`, and export `__makeEvents__`. If that sanitizer regresses, stream-capable generated bindings silently rot even though Rust support still exists.
- Durable validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml sanitize_generated_typescript_preserves_channel_import_and_exports_event_helper --lib`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml persistent_artifact_registration_reuses_the_same_descriptor_id --lib`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml resource_release_is_safe_to_repeat --lib`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml stream_packet_metadata_is_ordered_per_stream --lib`
  - passed: `python3 -m py_compile src-python/greeblefs_sidecar/actions.py src-python/greeblefs_sidecar/server.py`
  - passed: `bunx vitest run src/test/ipcArtifactsRuntime.test.ts src/test/ipcStreamsRuntime.test.ts src/test/pythonRuntimeBackend.test.ts src/test/terminalOverlay.test.tsx --reporter=dot`
  - note: repo-wide `bunx tsc --noEmit` is still red on unrelated pre-existing settings/audio/vendored-editor paths, so IPC validation should keep using the repo’s filtered TS pattern against the touched runtime/test files until those workspace-wide failures are cleaned up.

# 2026-04-26 - Folder And Archive Preview Now Share Persistent Collection Modes

- Folder and archive preview lanes no longer own separate list UIs. `src/components/ExplorerCollectionPreviewSurface.tsx` is now the shared preview-pane collection surface used by both `ExplorerFolderPreview.tsx` and `ExplorerArchivePreview.tsx`.
- Durable mode routing:
  - `src/config/explorerCollectionPreviewModes.ts` is the source of truth for collection preview mode ids, labels, descriptions, and stepping order.
  - `src/store/settingsStore.ts` persists `settings.explorer.collectionPreviewMode`, so the chosen mode is shared across folder and archive previews instead of resetting per document.
  - `src/config/hotkeys.ts`, `src/components/SettingsPage.tsx`, and `src/components/FileExplorer.tsx` wire the shared cycling hotkeys (`Ctrl+Alt+V` forward, `Ctrl+Alt+Shift+V` backward).
- Current shared modes are:
  - `list`: dense row browser
  - `overview`: forced-thumbnail mosaic
  - `strata`: category ribbons
  - `timeline`: recency-first icon river
  - `orbit`: clustered category hub cards
- Durable thumbnail rule for `overview`:
  - `src/runtime/explorerCollectionPreviewThumbnails.ts` intentionally bypasses the normal explorer thumbnail toggle and requests artifact/model thumbnails anyway.
  - Archive members must stage through `materializeExplorerArchiveEntry({ mode: "stageTemporary" })` before thumbnail reads; do not reintroduce direct virtual-archive thumbnail assumptions in React.
- Durable interaction rule:
  - Every collection mode must keep using `src/components/useExplorerPreviewEntryDirectDrag.ts` for selection, open, and drag-out behavior. If a new layout bypasses that hook, multi-select drag consistency between preview modes breaks.
- Durable preview-local navigation rule:
  - `src/store/explorerStore.ts` now persists `previewJumpToFolderEnabled` per explorer session, and it defaults to `true`. Treat it as explorer-instance state, not as a global settings toggle.
  - When `previewJumpToFolderEnabled` is off, `src/components/FileExplorer.tsx` routes folder/archive collection clicks through preview-only browsing (`openPreviewOnlyCollectionEntry(...)`) so the preview can walk folders without mutating the main explorer path or selection.
  - External explorer-driven preview changes still clear preview-only history. Keep that reset behavior intact so the preview snaps back to the user’s main selection when they leave the side lane.
  - The preview-only back affordance is a real built-in chrome control (`previewNavigateBack`) that must stay registered in `src/config/explorerChromeLayouts.ts`. If you add preview-header controls but skip the chrome-layout catalog, the logic can exist without any visible button.
  - `src/components/FileExplorer.tsx` keeps preview-only navigation history in both React state and a synced ref. Do not rely on mutating local variables inside `setState` updater callbacks for back/forward logic; React concurrent scheduling can make that nondeterministic.
- Durable readability rule:
  - Non-list collection modes in `ExplorerCollectionPreviewSurface.tsx` should keep visible filename labels in the pane. The layouts can stay icon-forward, but unlabeled icon clusters become hard to navigate in narrow preview widths.
- Durable validation:
  - passed: `bunx vitest run src/test/explorerCollectionPreviewThumbnails.test.ts src/test/explorerFolderPreview.test.tsx src/test/explorerArchivePreview.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "cycles shared folder preview modes from the explorer hotkeys" --reporter=dot`
  - passed: `bunx vitest run src/test/explorerFolderPreview.test.tsx src/test/explorerArchivePreview.test.tsx src/test/explorerStore.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "lets the preview pane browse folders in place when jump to folder is off" --reporter=dot`
  - note: targeted `bunx tsc --noEmit --pretty false -p tsconfig.json` filtering still surfaces a pre-existing unrelated `src/components/SettingsPage.tsx` typing error around `activeSectionMeta.shell?.disableContentScroll`.

# 2026-04-26 - Explorer Refresh Now Reconciles Stable File Identities And Shared Thumbnail Artifacts

- Local explorer thumbnail churn is no longer purely path-first:
  - Rust now ships a backend-owned explorer identity/artifact layer (`src-tauri/src/explorer_identity.rs`) that resolves stable local file identities, preserves move/rename continuity, and persists thumbnail artifact metadata.
  - Local `FileEntry`, `FileSearchResult`, and `FileTransferResult` payloads now carry `entityId`, `identityKind`, and `contentRevision`. The frontend should treat those as the durable identity contract for refresh/reconcile work.
- Thumbnail generation is now split into two contracts:
  - `src-tauri/src/thumbnail_commands.rs` still exposes the legacy `fs_read_entry_thumbnail` data-URL command for old callers, but it now routes through the new artifact pipeline.
  - The new `fs_read_entry_thumbnail_artifact` command returns artifact file paths keyed by `entityId + contentRevision + variant + dimensions`. `src/runtime/explorerBackend.ts` exposes that bridge and `src/runtime/explorerThumbnailArtifactRuntime.ts` is now the shared TS cache/runtime that turns artifact paths into browser-safe URLs.
- `src/components/FileExplorer.tsx` now follows the stable-identity thumbnail rules:
  - navigation seeds thumbnail state from the shared artifact cache instead of treating every folder open like a cold start
  - refresh reconciles by `entityId + contentRevision` instead of clearing `entryThumbnailMap`
  - unchanged rows keep their thumbnails across relists and in-folder move/rename flows
  - visible thumbnail batches now read through `readExplorerThumbnailForEntry(...)`, while `getRenderableEntryThumbnail(...)` can also fall back to the shared cache directly
  - video hover scrub still loads lazily, but now rides the same artifact/runtime path
- Model thumbnails now use the same semantic cache key shape:
  - `src/runtime/modelThumbnailBackend.ts` keys cached renders by `entityId + contentRevision` instead of `path + size + modified`, so rename/move keeps model thumbnails hot too.
- File-operations window events now include resolved affected entries:
  - `src/runtime/fileOperationsWindow.ts` publishes `affectedEntries[]` with `entityId`, `sourcePath`, `destinationPath`, `contentRevision`, and `mutationKind`.
  - Current explorer listeners still refresh the affected folder, but refresh is now reconcile-based instead of path-wipe churn. Future targeted patching should build on `affectedEntries`, not invent another transfer event.
- Durable product rule:
  - Do not clear explorer thumbnail state wholesale on local refreshes anymore. If a future change needs to invalidate thumbnails, do it by comparing `entityId + contentRevision` and preserve move/rename continuity whenever the content revision is unchanged.
  - For normal explorer grid/list thumbnails, prefer `src/runtime/explorerThumbnailArtifactRuntime.ts` over direct `readExplorerEntryThumbnail(...)` calls.
- Durable validation:
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json | rg "ExplorerShaderWorkbench|FileExplorer|explorerBackend|modelThumbnailBackend|fileOperationsWindow|performanceTelemetry|explorerThumbnailArtifactRuntime|fileExplorer.latency.browser.test|constellationLayout.test|explorerArchivePreview.test|explorerBatchRename.test|explorerFolderPreview.test|explorerSideRail.test|fileOperationsWindow.test"`
  - passed: `bunx vitest run src/test/modelThumbnailBackend.test.ts src/test/fileOperationsWindow.test.ts src/test/explorerArchivePreview.test.tsx src/test/explorerFolderPreview.test.tsx src/test/explorerBatchRename.test.ts src/test/constellationLayout.test.ts src/test/performanceTelemetry.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/explorerSideRail.test.tsx --reporter=dot`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - note: repo-wide `bunx tsc --noEmit` is still red on unrelated pre-existing settings/icon-theme/vendored tiptap paths, so keep validation filtered to touched explorer/runtime surfaces until those workspace-level failures are cleaned up.

# 2026-04-25 - Explorer Video Preview Now Uses Native Byte Transport Plus MP4 Proxy Fallback

- The explorer video lane had two independent playback regressions that compounded into “video never works”:
  - `src-tauri/tauri.conf.json` was missing `security.assetProtocol`, so the Tauri-side local-media contract that ZenMocap relied on was incomplete.
  - `src-tauri/src/video_commands.rs` was still generating Linux-only VP9/WebM preview proxies, even though the durable repo intent and the working ZenMocap example both point to H.264/`yuv420p`/`+faststart` MP4 as the safe embedded-webview target.
- Durable implementation shape:
  - `src-tauri/tauri.conf.json` now enables `security.assetProtocol` with `scope = ["**"]`, and `src-tauri/Cargo.toml` now carries the matching Tauri feature `protocol-asset`. These two settings are coupled. If one moves without the other, local explorer media playback breaks again.
  - `src-tauri/src/video_commands.rs` now emits MP4 preview proxies on every platform using `libx264`, `yuv420p`, `+faststart`, AAC audio when present, and a width-capped preview scale filter so tall mobile/screen-recorded clips stay lighter without regressing decode safety.
  - `src/components/ExplorerVideoEditor.tsx` now treats source loading as host-owned byte transport. It resolves a direct-safe path or proxy-safe path through the typed backend, reads preview bytes through `readExplorerPreviewBytes(...)`, feeds the `<video>` element with a `blob:` URL, and only escalates from direct source to MP4 proxy when native transport or decode fails.
  - `src/runtime/videoEditorBackend.ts` now exposes the narrow preview-byte bridge used by the video lane, so the React surface does not reach into raw explorer transport helpers directly.
  - `src/test/explorerVideoEditor.test.tsx` now locks that fallback order down as direct native-byte playback first, then MP4 proxy native-byte playback.
- Durable product rule:
  - Future explorer video work must preserve the full local-media contract, not just the leaf `<video>` tag. Treat `security.assetProtocol`, the Cargo `protocol-asset` feature, the native preview-byte bridge, and MP4/H.264/AAC preview proxies as one pipeline.
- Durable validation:
  - passed: `bunx vitest run src/test/explorerVideoEditor.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "defaults videos to playback preview and only enters video edit mode when requested" --reporter=dot`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml preview_ --lib`
  - passed: `jq empty src-tauri/tauri.conf.json`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json | rg 'ExplorerVideoEditor|explorerVideoEditor'`

# 2026-04-26 - Video Preview Stage Now Shares The Image Preview Zoom And Background Contract

- The video lane was playable again, but it still felt visually and behaviorally detached from the image lane:
  - wheel zoom did not work in the preview surface
  - the stage background/checkerboard treatment drifted from the image preview lane
- Durable implementation shape:
  - `src/components/explorer/explorerImageStage.ts` now owns shared checkerboard background constants in addition to the existing zoom/pan math, making it the reusable stage contract for preview-first visual media lanes.
  - `src/components/ExplorerImageEditor.tsx` now consumes those shared checkerboard constants instead of carrying duplicate lane-local literals.
  - `src/components/ExplorerVideoEditor.tsx` now reuses the same stage vocabulary: wheel zoom updates a shared preview-stage transform, the bottom-right zoom badge matches the image lane, and the preview surface background now uses the same checkerboard contract.
  - Video edit transforms still remain lane-specific, but preview-stage zoom/pan is now intentionally shared so image and video feel like the same preview system.
- Durable product rule:
  - If a visual-media preview lane needs stage treatment changes, route them through `src/components/explorer/explorerImageStage.ts` first. Do not let image and video drift into copy-pasted stage CSS or incompatible zoom semantics again.
- Durable validation:
  - passed: `bunx vitest run src/test/explorerVideoEditor.test.tsx --reporter=dot`

# 2026-04-26 - Tool-Editor Settings Pages Can Now Opt Into A Fixed Viewport Shell

- The Settings shell now supports editor-style sections that should behave like a docked workbench surface instead of a scroll document:
  - `src/config/settingsNavigation.ts` now supports `shell.disableContentScroll`.
  - `src/components/settings/SettingsShell.tsx` keeps one stable scroll-host DOM node, but can lock the main viewport scroll and hand scrolling off to section-local lanes when `disableContentScroll` is enabled.
- `Context Menus` is the first section using that mode:
  - `src/components/settings/sections/ContextMenusSettingsSection.tsx` is now a fixed-height three-lane editor. The page itself should not scroll; the left utility lane, center menu canvas, and right library own their own overflow behavior.
  - The center `Menu Canvas` now stretches like a real editor stage. When only one or two menu columns are open, they expand to use the available width; deeper submenu stacks still spill horizontally like a real cascading menu authoring surface.
  - The right `Menu Library` now behaves more like Explorer’s docked actions pane by using the full lane height with an internal scroll surface instead of a short card sitting in a taller column.
- Durable product rule:
  - If a settings section is acting like a DCC/editor viewport, prefer `shell.disableContentScroll` plus internal lane scrolling over letting the whole page drift vertically.
- Context-menu composer follow-up polish from the same lane:
  - `src/components/settings/sections/ContextMenusSettingsSection.tsx` now treats the right `Menu Library` as a compact action browser instead of a stack of puffy cards. Library categories are collapsible, built-in/extension-heavy sections can stay tucked away by default, and the library lane owns its full height like Explorer’s actions pane.
  - Submenu/folder rows in the menu canvas should read differently from leaf commands. Folder rows now keep a lighter summary treatment, while leaf-command rows remain the place for fuller inline tweaks.
  - External library drags no longer depend on tiny explicit drop rails. `src/components/DraggablePanelList.tsx` now exports the ambient drop-target resolver used by the shared pointer runtime, and the context-menu library drag path reuses that helper so dropping into open submenu panels works across the full panel body.
  - The next compactness pass pushed that distinction further: selected submenu rows now use a branch-focused inline editor instead of expanding into the same heavy inspector block as leaf commands. Durable product rule: if a folder is already open as a sidecar menu column, keep its inline controls about branch naming/placement and leave content authoring to the open branch panel.
  - The right `Menu Library` should read like Explorer’s actions pane, not a stack of rounded cards. Keep section headers collapsible, flatten items into denser list rows, and prefer light metadata labels over large badge piles.
  - Empty folder targets now participate in external drag hover/highlight correctly because `src/components/DraggablePanelList.tsx` uses the effective external hovered drop index for empty lists too. This matters for newly created submenu branches with no children yet.
- Durable validation:
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "lets the dedicated context menu composer|adds new command nodes into the selected folder|drops library commands into the open folder panel|opens the dedicated context menu section" --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - note: the appearance override behavior spec is heavy enough now that it uses an explicit `10000` ms per-test timeout; keep queries narrow before widening more global time budgets.

# 2026-04-25 - Context Menu Composer Now Edits The Actual Menu Stack

- The context-menu editor should no longer read like a toy inspector around a fake list. The durable authoring model is now “edit the menu itself”:
  - `src/components/settings/sections/ContextMenusSettingsSection.tsx` uses the center lane as the real menu stack. Submenu/folder rows open sidecar panels, selected rows expand inline controls, and a breadcrumb strip shows the current open branch so nested editing stays readable.
  - The right lane is now a `Menu Library` sourced from structure nodes plus the shared actions/command catalog. Library items support direct pointer drag into exact menu branches, with quick-add as a fallback instead of the main ritual.
  - The left lane was intentionally slimmed to setup plus fallback quick-insert controls. Treat it as backup for keyboard-friendly inserts, not the primary editing experience.
- Durable implementation shape behind that UX:
  - `src/components/SettingsPage.tsx` now exposes explicit `insertContextMenuCommandEntryAt(...)`, `insertContextMenuSubmenuAt(...)`, `insertContextMenuSeparatorAt(...)`, and `insertContextMenuGroupSlotAt(...)` callbacks so external drags can target an exact `parentEntryId + insertionIndex` instead of piggybacking on selection-only add flows.
  - `src/components/DraggablePanelList.tsx` now supports external drag highlighting through `externalDragActive` and `externalHoveredDropIndex`, which lets Settings-hosted libraries reuse the same insertion affordance as in-list reorder without falling back to browser HTML drag/drop.
- Durable product rule:
  - Future context-menu work should preserve the illusion that the user is shaping the live explorer menu. Prefer inline row editing, sidecar submenu panels, breadcrumbs, and direct drag/drop over rebuilding a detached inspector-heavy CRUD layout.
- Durable validation:
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "lets the dedicated context menu composer|adds new command nodes into the selected folder|opens the dedicated context menu section" --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - note: repo-wide `bunx tsc --noEmit` still fails in pre-existing unrelated icon-theme / VS Code compatibility paths plus vendored `src/vendor/tiptap/**`; the context-menu pass was validated through the settings behavior suite instead.

# 2026-04-25 - Explorer Customize Exit Now Commits Draft Layouts By Default

- The explorer chrome customize ritual now treats the obvious user exit paths as save/commit, not discard:
  - `src/components/FileExplorer.tsx` now persists the active `ExplorerChromeEditSession.draftOverride` through one shared helper before closing the customize session. The commit uses the session’s own `themeId` and `layoutId`, so a draft still lands in the right theme/layout bucket even if the active explorer mode/layout changes while customize mode is open.
  - The live `customizeModeToggle` control, the command-path `customizeModeToggle` handler, and the docked Actions-pane `Done` / close flow now all exit through that save path. This fixes the user-facing bug where the authored layout looked correct during customize mode but snapped back as soon as customize was turned off.
  - The explicit discard path still exists, but it is now intentionally separate in the mode menu as `Discard Draft`. Durable product rule: the normal “turn customize off” ritual must keep the authored layout. If we want to throw the draft away, that has to be an explicit discard action.
- Durable validation:
  - passed: `bun x vitest run src/test/fileExplorer.viewModes.test.tsx -t 'commits the active chrome customize draft' --reporter=verbose`
  - passed: `bun x vitest run src/test/ExplorerChromeSurface.test.tsx src/test/explorerChromeLayouts.test.ts src/test/explorerCustomizePointerRuntime.test.tsx src/test/settingsStore.test.ts src/test/explorerStore.test.ts src/test/hotkeys.test.ts --reporter=dot`
  - passed: grep-filtered `bun x tsc --noEmit --pretty false -p tsconfig.json` produced no matches for `FileExplorer.tsx`, `fileExplorer.viewModes.test.tsx`, `ExplorerChromeSurface`, `explorerChromeLayouts`, `explorerCustomizePointerRuntime`, `settingsStore`, `explorerStore`, or `hotkeys`
  - note: a wider `fileExplorer.viewModes.test.tsx` batch still surfaces pre-existing unrelated heavy-suite failures / worker OOM outside this customize-exit seam, so keep validation focused when touching chrome customization.

# 2026-04-25 - Explorer Chrome Free-Space Placement Now Persists And Workspace Header Accepts Authored Actions

- Explorer chrome placement is no longer just zone reorder with a pretty ghost. The durable model now also persists authored empty-space offsets:
  - `src/config/explorerChromeLayouts.ts` carries `offsetPx` on both override entries and resolved placements. `moveExplorerChromeControlInResolvedSurfaces(...)` now preserves that offset when controls move between surfaces, so customize mode can leave intentional dead space instead of collapsing everything back into the next flex slot.
  - `src/components/explorer/explorerCustomizePointerRuntime.ts` now resolves an insertion `offsetPx` from ambient chrome territory, not just `surfaceId + zoneId + targetIndex`. `src/components/explorer/ExplorerChromeSurface.tsx` renders that back out as `marginLeft`, so the authored look during customize mode matches the saved look after customize mode exits.
  - Durable product rule: if a placed control is intentionally offset inside a chrome band, leaving customize mode must not snap it back into a packed slot layout. `offsetPx` is now part of layout truth for explorer chrome.
- Authored actions can now live in the workspace top strip, not just the toolbar/topbar/preview/status surfaces:
  - `src/config/explorerCustomizeCatalog.ts` now includes `workspaceHeader` in the default authored-action chrome surfaces.
  - `src/components/explorer/ExplorerWorkspace.tsx` now builds a workspace-local action registry from the shared customize catalog, renders action-backed controls on `workspaceHeader`, and routes keyboard-triggered command ids for those controls through the same action execution path as mouse clicks.
  - Durable product rule: the workspace header is a first-class explorer chrome band. If action-backed controls cannot be placed beside the tab strip / layout strip there, treat it as a regression.
- Durable validation:
  - passed: `bun x vitest run src/test/explorerCustomizePointerRuntime.test.tsx src/test/ExplorerChromeSurface.test.tsx src/test/explorerChromeLayouts.test.ts src/test/explorerCustomizeCatalog.test.ts src/test/ExplorerWorkspace.test.tsx src/test/explorerStore.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts`
  - note: full `bun x tsc --noEmit --pretty false -p tsconfig.json` still fails in pre-existing unrelated icon-theme / VS Code theme compatibility paths plus vendored `src/vendor/tiptap/**`; the explorer chrome files from this pass no longer appear in that output.

# 2026-04-25 - Explorer Chrome Now Treats Workspace Tabs, Status Controls, And Width Editing As First-Class

- Explorer chrome no longer stops at the top toolbar. The durable v2 shape is now:
  - `src/components/explorer/ExplorerWorkspace.tsx` exposes a shared `workspaceTabStrip` control on `workspaceHeader`. That one placeable/resizable control owns the workspace tabs, the `+` affordance, the `1-Up` / `2-Up` / `3-Up` / `4-Up` layout controls, and the pane-actions entrypoint instead of assuming those widgets live in a fixed hardcoded strip.
  - `src/components/FileExplorer.tsx` now treats status-strip affordances as real explorer chrome controls. `statusTaskBadge`, `terminalDrawerToggle`, and `statusViewToggles` all route through the same command/catalog/layout system as the top toolbar instead of relying on a centered hardcoded task anchor or immovable bottom-bar widgets.
  - `src/config/explorerCustomizeCatalog.ts` is now the place where resize capability lives. Strip/input-like controls such as `workspaceTabStrip` and `addressBar` can persist a `widthPx` override, while many chip/button controls now honor `sizeVariant` so top and bottom chrome density can be tuned without one-off JSX branches.
  - `src/components/explorer/explorerChromeResizeRuntime.ts` is the app-owned pointer resize seam for placed controls. Future width editing should keep flowing through that runtime plus `widthPx` overrides instead of inventing per-control resize math.
- Durable product rule:
  - Every non-viewport explorer chrome band should participate in the same authored system. If something in the workspace header, toolbar, or status bar cannot move with customize mode, that should be treated as a regression unless the control is intentionally non-placeable.
  - Width-bearing controls should preserve their `widthPx` override when moved across explorer surfaces. Do not reintroduce a layout model where moving a control silently drops its width state.
- Durable validation:
  - passed: `bun x vitest run src/test/ExplorerWorkspace.test.tsx src/test/ExplorerChromeSurface.test.tsx src/test/explorerChromeLayouts.test.ts src/test/settingsStore.test.ts src/test/explorerStore.test.ts src/test/hotkeys.test.ts`
  - passed: grep-filtered `bun x tsc --noEmit --pretty false -p tsconfig.json` produced no matches for `FileExplorer`, `ExplorerWorkspace`, `ExplorerActionsPane`, `ExplorerTaskStatusBadge`, `ExplorerChromeSurface`, `explorerChromeLayouts`, `explorerCustomizeCatalog`, or `settingsStore`

# 2026-04-25 - Cutout Empty Masks Stay Silent And Host Output Now Rejoins Explorer Clipboard/Refresh Flows

- The image cutout lane had a subtle but important mask-decoding trap:
  - `src/components/explorer/explorerImageCutoutMask.ts` must only treat a flat grayscale image as a luminance-backed mask when the alpha channel is also effectively opaque. Transparent white mask canvases (`RGB=255`, `A=0`) are part of the local refine pipeline, and if the decoder blindly prefers luminance for any grayscale image it turns an empty mask into a full-frame marching-ants rectangle.
  - Durable rule: empty transparent masks should decode through alpha, not luma. Opaque grayscale PNG masks from the Python runtime can still decode through luma.
- Explorer cutout output is now wired back into the flagship explorer workflow instead of stopping at the OS boundary:
  - `src/components/ExplorerImageCutoutSurface.tsx` still uses the native `image_cutout_copy_to_clipboard` seam, but the returned staged PNG artifact is now also passed back up to Explorer so `Ctrl+C` in Cutout fills the Explorer copy queue with a real file path that `Ctrl+V` can paste.
  - `src/components/ExplorerImageEditor.tsx` and `src/components/FileExplorer.tsx` now thread that queue callback through the preview host. The queue entry should be the staged PNG artifact path, not the original source image path.
  - Sibling save in Cutout now also calls back into the preview host after export so Explorer refreshes and the new `.cutout.png` actually appears in the current folder view.
- Local selection polish from the same pass:
  - `Magic Wand` and `Quick Select` now use eight-connected neighbor growth instead of strict four-connected growth, which makes diagonal subject regions behave more like a real image-selection tool and less like a toy grid flood fill.
- Durable validation:
  - passed: `bunx vitest run src/test/explorerImageCutoutMask.test.ts src/test/explorerImageCutoutSurface.test.tsx --reporter=dot --pool=forks`
  - passed: `bunx vitest run src/test/explorerImageEditor.test.tsx src/test/explorerImageCutoutSurface.test.tsx --reporter=dot --pool=forks`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "opens editable image previews in fullscreen preview mode and only enters edit tools on demand" --reporter=dot --pool=forks`
  - passed: grep-filtered `bunx tsc --noEmit --pretty false -p tsconfig.json` produced no matches for `ExplorerImageCutoutSurface`, `ExplorerImageEditor`, `explorerImageCutoutMask`, or `FileExplorer.tsx`

# 2026-04-25 - Explorer Customize Chrome Now Uses Ambient Band Targeting Instead Of Drop Rails

- Explorer chrome customize no longer depends on explicit per-gap drop-strip DOM nodes for placement. The durable interaction shape is now:
  - `src/components/explorer/explorerCustomizePointerRuntime.ts` resolves drop targets from ambient chrome geometry. It finds the hovered chrome surface, then infers the row, zone, and insertion index from full-band DOM rects plus control midpoints instead of relying on tiny dedicated drop targets.
  - `src/components/explorer/ExplorerChromeSurface.tsx` now exposes ambient `surface -> row -> zone -> control` geometry attributes and renders a single inline insertion ghost inside the resolved zone. The old blue-line rail treatment is intentionally gone.
  - The saved layout model is still the same `surfaceId + zone + order` override snapshot in `src/config/explorerChromeLayouts.ts`. Future customize work should keep persistence simple and make the freedom happen in the pointer/runtime layer, not by exploding the stored model into absolute-position noise.
- Durable product rule:
  - Any non-viewport explorer chrome band should feel droppable during customize mode. Do not reintroduce a UX where placement only works by hitting tiny explicit insertion rails.
  - The explorer content viewport remains the removal ritual. Ambient targeting should only activate while the pointer is actually inside chrome; do not snap to the "nearest" surface from the viewport or drag-to-remove will feel broken.
  - Same-zone reorder targeting now ignores the actively dragged placed control while computing insertion index, so reorder math should stay relative to the post-drop layout instead of the pre-drop DOM snapshot.
- Durable validation:
  - passed: `bun x vitest run src/test/explorerCustomizePointerRuntime.test.tsx src/test/ExplorerChromeSurface.test.tsx src/test/explorerChromeLayouts.test.ts src/test/explorerStore.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts`
  - note: full `bun x tsc --noEmit --pretty false -p tsconfig.json` still fails in pre-existing vendored `src/vendor/tiptap/**` typing/dependency paths; the ambient customize files from this pass did not appear in that output.

# 2026-04-25 - Explorer Phase 2 Replaced HTML Drag With Pointer Rituals And Promoted Actions Into A Real Pane

- Explorer chrome customize is no longer hosted by a floating HTML drag/drop overlay. The durable phase-2 shape is now:
  - `src/components/explorer/explorerCustomizePointerRuntime.ts` owns the Tauri-safe pointer drag session for explorer customize. It resolves drop lanes and remove zones through DOM hit-testing, uses movement-threshold activation plus global pointer listeners, and never touches `draggable` / `dataTransfer`.
  - `src/components/FileExplorer.tsx` now docks `src/components/explorer/ExplorerActionsPane.tsx` as a first-class explorer pane with its own persisted `actionsVisible` and `actionsWidth` session state. The pane trails Preview on the preview side (`preview -> actions -> content` when leading, `content -> preview -> actions` when trailing), and customize browsing now lives there instead of a floating overlay.
  - `src/config/explorerShellLayouts.ts` now carries `EXPLORER_ACTIONS_WIDTH_BOUNDS`. Actions width is persisted independently and intentionally does not participate in shell-layout width multipliers in this phase.
  - `src/components/explorer/ExplorerChromeSurface.tsx` is now pointer-driven for customize moves and supports always-on `Ctrl+Alt+Click` hotkey capture requests even when customize mode is off. The hover `X` removal affordance is the removal ritual for placed controls; dragging a placed control into the explorer content viewport still removes it, but now through the pointer runtime.
  - `src/components/FileExplorer.tsx` and `src/components/explorer/ExplorerWorkspace.tsx` both bridge the shared `chromeHotkeyCaptureControlId` store field into chrome surfaces. `Ctrl+Alt+Click` is therefore no longer gated by customize mode, while `Ctrl+Alt+Drag` still is.
  - `src/components/explorer/ExplorerCustomizeOverlay.tsx` was intentionally deleted. Do not resurrect a second floating customize host; future browse/inspect work belongs inside the docked Actions pane.
- Durable product rule:
  - The Actions pane is now the canonical authored-action browser for Explorer. In runtime mode it launches authored actions from the current explorer context. In customize mode it becomes the all-in browser/inspector for both built-in controls and authored actions.
  - If customize mode auto-opens the Actions pane, exiting customize restores the prior closed state. If the user explicitly closes the Actions pane during customize, that is treated as leaving customize mode too.
  - While the customize pointer ritual is active, normal explorer file/native drag startup is suppressed. Future drag work should keep that separation intact so the app-owned chrome ritual never leaks back into OS/browser drag semantics.
- Durable validation:
  - passed: `bun x vitest run src/test/ExplorerChromeSurface.test.tsx src/test/explorerStore.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts`
  - passed: grep-filtered `bun x tsc --noEmit --pretty false -p tsconfig.json` produced no matches for the touched explorer phase-2 files

# 2026-04-25 - Explorer ZBrush Customize Mode Now Runs On A Shared Chrome Catalog And Ritual Hotkeys

- Explorer chrome customization is now a real runtime-backed system instead of a layout-only shell trick.
- Durable implementation shape:
  - `src/config/explorerCustomizeCatalog.ts` is now the shared explorer chrome catalog. It merges built-in chrome controls and action-backed controls into one placeable registry with stable command ids (`explorer-control:*` for built-ins and `action:*` ids for authored actions). Future customize/browser work should consume this catalog instead of scraping JSX or leaning on legacy plugin context menu items.
  - `src/components/explorer/ExplorerChromeSurface.tsx` now owns the ritual interaction contract for placed controls: plain click selects in customize mode, `Ctrl+Alt+Drag` moves, `Ctrl+Alt+Click` arms hotkey capture, and drop-target highlighting routes through store-managed edit-session state.
  - `src/components/FileExplorer.tsx` now hosts the customize overlay browser/inspector, action-backed chrome execution, missing-action placeholders, hotkey capture, and delete-by-dropping-into-viewport behavior. Shared command hotkeys are intentionally scoped to the explorer instance that currently owns keyboard focus so multi-pane workspaces do not double-fire the same command.
  - `src/components/explorer/ExplorerWorkspace.tsx` and `src/components/explorer/ExplorerSideRail.tsx` now bridge the shared command ids into local workspace-header and rail-header behaviors, so moved or rebound controls still work after leaving the main explorer toolbar.
  - `src/config/hotkeys.ts` plus `src/store/settingsStore.ts` now persist dynamic explorer command bindings in `commandBindingsById` alongside the named app hotkeys. This is the only command-binding store for explorer chrome. Do not add a second explorer-only hotkey registry.
  - `src/components/SettingsPage.tsx` now shows the currently assigned explorer ritual bindings on the Hotkeys page. Settings is the edit/clear surface for existing command bindings, while discovery and placement still belong to customize mode itself.
- Durable product rule:
  - Future explorer chrome work should register stable control/command ids and route through the shared customize catalog so authored actions, built-in widgets, and moved controls all speak the same placement and hotkey language.
  - When an authored action disappears, preserve the persisted chrome/binding data as a missing-item placeholder instead of silently dropping it.
- Durable validation:
  - passed: `bun x vitest run src/test/hotkeys.test.ts src/test/settingsStore.test.ts`
  - passed: targeted `bun x tsc --noEmit --pretty false 2>&1 | rg "FileExplorer|ExplorerCustomizeOverlay|SettingsPage|ExplorerWorkspace|ExplorerSideRail|config/hotkeys|settingsStore"` produced no matches after the customize/hotkey wiring pass

- Customize-mode stability follow-up:
  - `ExplorerChromeSurface` registration effects must key off a semantic resolved-surface signature, not the raw `surface` or `editMode` object identities. Registering a surface writes back into `chromeEditSession.registeredSurfaces`, which recreates the session object; if the effect depends on the live objects, customize mode falls into a register/unregister rerender loop as soon as it opens.
  - Validation addendum: `bun x vitest run src/test/ExplorerChromeSurface.test.tsx src/test/hotkeys.test.ts src/test/settingsStore.test.ts`
  - Validation addendum: targeted `bun x tsc --noEmit --pretty false 2>&1 | rg "ExplorerChromeSurface|explorerChromeLayouts|explorerStore|ExplorerChromeSurface.test" || true` produced no matches after the surface-registration fix.

# 2026-04-25 - Frontend Checkbox UI Now Routes Through A Shared Branded Toggle System

- The app should no longer present browser-default checkbox chrome for normal boolean controls. GreebleFS now treats checkbox-like settings as a branded toggle lane inspired by desktop switch controls but rendered through the app theme system.
- Durable implementation shape:
  - `src/components/OverlayToggle.tsx` is the shared app-owned boolean control primitive for places that want an explicit reusable component.
  - `src/App.css` now contains the global checkbox skin. Any plain `input[type="checkbox"]` inside the app automatically adopts the new toggle treatment unless a future surface explicitly opts out with `data-overlay-toggle-ignore="true"`.
  - `src/components/settings/SettingsPrimitives.tsx` now auto-converts native checkbox controls passed into `SettingsRow` into `OverlayToggle`, so settings sections can stay declarative without each file hand-wrapping every boolean row.
  - `src/components/notes/NotesRichMarkdownEditor.tsx` includes the extra task-list layout glue needed for the vendored Tiptap checklist DOM so note checkboxes also read like proper toggles instead of browser defaults.
- Durable product rule:
  - Future boolean UI should either use `OverlayToggle` directly or rely on the shared checkbox skin. Do not introduce new browser-default checkbox styling or one-off bespoke toggles unless the product explicitly needs a special control model.
- Durable validation:
  - passed: `bunx vitest run src/test/explorerAudioWorkbench.test.tsx src/test/settingsPage.behavior.test.tsx --reporter=dot`

# 2026-04-25 - Context Menu Composer Drag Now Uses Pointer Runtime And The UI Slimmed Into Shared Settings Controls

- The reusable menu-authoring drag primitive no longer relies on browser-native HTML drag/drop. That path triggered OS-level drag affordances inside the Tauri webview, including the bad cancel cursor and host drag semantics that do not match GreebleFS’ app-owned interaction model.
- Durable implementation shape:
  - `src/components/DraggablePanelList.tsx` still owns the reusable reorderable panel-stack primitive, but it now runs through an app-owned pointer drag session instead of `draggable` / `dataTransfer`.
  - The primitive now exposes `dragHandleProps` to the row renderer, tracks one shared pointer drag session across nested lists, resolves drop targets through DOM hit-testing plus list-local drop-index math, and only uses the rendered drop rails as visual indicators plus optional explicit hit zones.
  - The intended mental model should now match Explorer’s internal drag runtime: Tauri is just the host window, while the app owns drag intent, hover resolution, and drop placement itself.
- Durable UI note:
  - `src/components/settings/sections/ContextMenusSettingsSection.tsx` was trimmed back toward the unified Settings shell. The extra top-heavy runtime explainer block is gone, the composer now uses shared `OverlayActionButton` controls plus the shared settings select/field styles from `SettingsPage.tsx`, and the editable menu canvas is intentionally width-constrained so it reads like a context menu in spirit rather than a generic full-width list editor.
  - Source-mix counts now live inside the setup summary instead of consuming a second inspector card, and the left rail summary explains insertion targeting directly where users add new actions/folders.
- Durable validation:
  - passed: `bunx vitest run src/test/draggablePanelList.test.tsx --reporter=verbose`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "lets the dedicated context menu composer|adds new command nodes into the selected folder|opens the dedicated context menu section" --reporter=verbose`

# 2026-04-25 - Repo Root Skills Mirror Now Symlinks To The Canonical .codex Skill Library

- `skills/` at the repo root is now the local discovery mirror for GreebleFS-specific skills. Each `greeblefs-*` entry is a symlink to the canonical folder under `/home/ephemara/.codex/skills`.
- This is intentional workflow infrastructure, not duplicated source. Update the real skill content in `/home/ephemara/.codex/skills/<skill-name>/`, and keep the repo mirror as symlinks so workspace-local discovery stays convenient without creating drift.
- Added `/home/ephemara/.codex/skills/refresh-relevant-skill` as the helper that tells agents to refresh the existing skill that matches their just-finished subsystem work.

# 2026-04-25 - Image Cutout Is Back To One Real Lane With A Docked Tool Rail

- Explorer image isolation no longer splits the product into `Cutout` versus `Remove BG` header tabs. The durable shell is back to one visible `Cutout` wildcard tab, with automatic background removal exposed as an in-lane tool action instead of pretending to be a separate workflow lane in the preview header.
- Durable implementation shape:
  - `src/config/imageCutoutTools.ts` now treats image isolation as one visible workflow tab plus a grouped tool catalog. The hidden `removeBackground` lane metadata still exists for internal bootstrap/reset use, but only `Cutout` registers into the preview header. The same config file now owns the left-rail tool families for `AI Select`, `Quick Select`, `Magic Wand`, `Lasso`, `Brush`, and `Erase`.
  - `src/components/explorer/explorerImageCutoutMask.ts` is now the real local selection-math seam. Future cutout tools should reuse it instead of burying pixel logic in React. In addition to direct brush/lasso primitives, the wand now uses perceptual color matching plus a contiguous toggle, and quick select now uses a bounded edge-aware grow pass instead of the earlier flat color brush.
  - `src/components/ExplorerImageCutoutSurface.tsx` was re-centered around a single cutout lane with a docked left tool rail instead of a floating palette bubble. `AI Select` still uses the backend prompt seam, `Magic Wand`, `Quick Select`, `Lasso`, `Brush`, and `Erase` are real local tools, `Auto Remove BG` merges its result into the current cutout history, `Ctrl+D` clears the current selection without resetting the session, and native drag-out moved to `Ctrl/Cmd+Shift+drag` so `Shift` can be reused by selection tools.
  - The preview-pane adaptive context menu for image cutout was intentionally kept minimal even after the tool expansion. The lane now registers only a compact set of preview actions (`Reset View`, `Reset Isolation`, `Auto Remove BG`, conditional `Deselect`, `Show/Hide Tool Rail`, `Show/Hide Refine Controls`) rather than mirroring every tool into right-click.
- Durable implementation lesson:
  - The local mask preview path in tests depends on the canvas mock preserving image data through canvas-to-canvas draws. If new local mask tools look broken only in unit tests, inspect the `ExplorerImageCutoutSurface` canvas test harness before assuming the real tool math regressed.
- Durable validation:
  - passed: `bunx vitest run src/test/hotkeys.test.ts src/test/settingsStore.test.ts src/test/explorerImageCutoutMask.test.ts src/test/explorerImageCutoutSurface.test.tsx --reporter=dot --pool=forks`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "opens editable image previews in fullscreen preview mode and only enters edit tools on demand|adapts preview-pane context-menu actions to the active image workflow tab" --reporter=dot --pool=forks`
  - passed: grep-filtered `bunx tsc --noEmit --pretty false -p tsconfig.json` returned no matches for the touched cutout/hotkey files

# 2026-04-25 - Context Menu Composer Is Now Canvas-First And Shares A Reusable Drag Panel Primitive

- The context-menu editor moved from a split “runtime preview + separate structure list” workflow into a canvas-first workflow:
  - `src/components/settings/sections/ContextMenusSettingsSection.tsx` is now the active composer seam. The center lane is a `Menu Canvas` with direct row dragging and minimal drop rails; runtime preview is still available, but now sits behind an explicit toggle instead of competing with a second structure panel.
  - `src/components/DraggablePanelList.tsx` is the new reusable drag/reorder primitive for panel-like rows. It owns the light drop-indicator line treatment plus external dragged-item coordination so nested editors can reuse one interaction model instead of each feature inventing bespoke HTML5 drag zones.
  - Future reorderable editor surfaces should prefer `DraggablePanelList` over hand-rolled `draggable` rows when the UX wants “panel stack with minimal insertion rails.”
- Add behavior is now contextual instead of root-only:
  - `src/components/SettingsPage.tsx` now resolves an insertion target from the current selection. If a submenu/folder is selected, new commands, separators, group slots, and folders insert inside it. Otherwise new nodes insert after the selected row, or at root when nothing is selected.
  - This is the key authoring contract behind the streamlined canvas: keep a folder selected, add new things, and they land there without touching the parent dropdown first.
- Durable UX fix:
  - submenu renaming in `SettingsPage.tsx` now stores the raw input value instead of snapping empty intermediate edits back to the previous title. Without that, “select all and replace” behaved like an append-only field during authoring.
- Durable validation:
  - passed: `bunx vitest run src/test/draggablePanelList.test.tsx --reporter=verbose`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "lets the dedicated context menu composer" --reporter=verbose`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "adds new command nodes into the selected folder" --reporter=verbose`

# 2026-04-25 - Actions-First Context Menus Now Have A Live Authoring Surface And Explorer Deep-Link

- The authored context-menu runtime has now crossed the line from “configurable” to “visually authorable.” The durable v1 shape is actions-first:
  - `actions/` is now the canonical managed extensibility root for new explorer commands, with plugin-local `actions/` folders treated as first-class catalog inputs instead of forcing plugins to hide behavior behind legacy `contextMenuItems`.
  - Explorer runtime assembly still flows through `src/components/explorer/explorerMenuRuntime.ts`, but the runtime now treats authored actions as a first-class source alongside built-ins, preview actions, and legacy plugin items.
  - `src/components/FileExplorer.tsx` now injects an `Edit Menu` affordance into the live explorer context menu. That action does not rebuild a second editor path; it deep-links straight into Settings and pins the composer to the active invocation context (`entry`, `background`, `multi-select`, `search-result`, or `preview-pane`).
- The Settings-side composer is no longer a bloated flat list editor:
  - `src/components/SettingsPage.tsx` now uses a three-lane `Context Menus` authoring surface: pack/context controls plus the action browser on the left, the real runtime menu preview in the center, and a selected-node inspector on the right.
  - The preview is built from the same runtime menu graph the explorer uses, not a second fake settings-only representation. Future authoring work should extend the shared runtime graph first, then let both Explorer and Settings consume it.
  - Node selection can come from either the structure tree or the live preview, and the inspector owns enabled state, folder naming, parent submenu selection, quick-slot placement, fallback bucket choice, and removal.
  - Reordering now has two durable seams: button-based sibling motion via `moveExplorerMenuLayoutEntry(...)` and drag/reparent placement via `placeExplorerMenuLayoutEntry(...)`. Cycle protection now explicitly rejects self-parenting and descendant-parenting in `withExplorerMenuLayoutEntryParent(...)`.
- Durable implementation lesson:
  - The Settings preview environment must normalize `detectClientPlatform()` before feeding `ExplorerMenuRuntimeEnvironment.runtimePlatform`; the runtime only accepts `windows | macos | linux`, so `unknown` needs a safe preview fallback.
- Durable validation:
  - passed: `bunx vitest run src/test/explorerContextMenu.layout.test.ts src/test/explorerMenuRuntime.test.ts src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - passed: `bash -lc 'bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "SettingsPage.tsx|explorerMenuRuntime.test.ts|explorerContextMenu.layout.test.ts|explorerMenuRuntime.ts|settingsStore.ts|FileExplorer.tsx"'`
  - note: repo-wide `bunx tsc --noEmit --pretty false -p tsconfig.json` still reports pre-existing unrelated failures in VS Code compatibility files and vendored `src/vendor/tiptap/**`; the context-menu/action authoring files above are clean in that output.

# 2026-04-24 - Storage Pane Now Uses A Minimal Three-Layer Workbench Shell

- The storage panel no longer reads like three separate dashboards bolted together. The durable default shell is now: compact scan rail on the left, one slim workbench command strip over the main storage view, and one unified inspector on the right.
- Durable implementation shape:
  - `src/components/StoragePanel.tsx` now accepts `appearance?: ResolvedOverlayAppearance` and resolves a fallback appearance locally for isolated tests. The storage shell uses shared `OverlayActionButton` controls and workbench chrome vars instead of the old storage-only button/chip styling.
  - The storage shell’s internal `SurfaceCard` body now behaves like a real flex column with `min-height: 0` and `overflow: hidden`. That is intentional: scrollable child surfaces like the matrix need an actual height budget or their scroll areas silently stop working.
  - `src/panels/panelRegistry.tsx` now passes the live `appearance` object into the storage panel so the panel participates in the real workbench theme/runtime path like the other first-class surfaces.
  - The left rail is intentionally tighter (`greeblefs-storage-rail-width-v2` now defaults to `224`) and only owns roots plus a small session/status block. The permanent cleanup queue card was removed from the rail on purpose.
  - Batch cleanup now lives in a header drawer instead of a permanent side card. The queue trigger in the storage toolbar shows staged count plus allocated bytes, and the drawer owns filter, queued rows, and batch `Trash` / `Delete`.
  - The right side is now one inspector shell. Selection metrics, direct actions, indexed jump, folder preview, and file details all live under that one container instead of stacked `Selection` and `Current Context` cards.
  - `src/store/storageStore.ts` still keeps `previewSplitMode` in persisted state for backward compatibility, but hydration now normalizes legacy `inline` snapshots back to `pane`, and the storage UI no longer exposes pane/inline toggles.
- Durable test note:
  - `src/test/storagePanel.layout.test.tsx` now asserts the compact rail default, the unified inspector, and the queue drawer living in one place.
  - `src/test/storageStore.test.ts` now protects the legacy `previewSplitMode: "inline" -> "pane"` migration.

# 2026-04-25 - Monaco Theme Defaults Must Be Hex-Safe And VSIX Imports Must Use fs_open_archive

- Two follow-up compatibility fixes matter for future theme/import work:
  - `src/config/explorerMonaco.ts` now normalizes Monaco UI colors away from raw CSS `rgb(...)` / `rgba(...)` strings into hex/hex8 before defining the Monaco theme. That is intentional because built-in GreebleFS themes and panel-transparency resolution frequently produce RGBA palette values, and Monaco can render obviously wrong UI accents when those values are passed through raw.
  - `src/config/vscodeThemeCompatibility.ts` must use `fsOpenArchive(...)` for cached `.vsix` imports. The Rust host rejects `fsExtractArchive({ mode: "openCached" })` on purpose and returns `Use fs_open_archive for cached archive opening.` if the wrong bridge is used.
- Durable validation:
  - passed: `bunx vitest run src/test/explorerMonaco.test.ts src/test/iconThemePackages.test.ts src/test/themePackages.test.ts`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml vsix`

# 2026-04-24 - VS Code Theme And Icon Imports Now Work As First-Class Compatibility Packages

- GreebleFS now treats common VS Code theme extensions as compatibility sources instead of forcing users to rewrite them into native bundle format first. `themes/` can ingest VS Code color-theme folders or `.vsix` archives, and `icon-themes/` can ingest VS Code file-icon folders or `.vsix` archives.
- Durable implementation shape:
  - `src/config/vscodeThemeCompatibility.ts` is the shared compatibility seam. It resolves extension roots from either a real folder or a cached `.vsix` extraction, checks both `package.json` and `extension/package.json`, parses JSONC, follows VS Code color-theme `include` chains, and adapts the result into normal GreebleFS theme/icon package shapes.
  - VS Code file icon themes stay on the existing string-only icon contract. Image-backed icons still become data URLs, and font-backed VS Code icons are converted into inline SVG data URLs so Seti-style packs work without adding a second runtime icon model.
  - `src/config/iconThemePackages.ts` now accepts native icon packs plus VS Code compatibility imports and tags them with explicit `sourceKind` / `sourceInfo` values (`vscode-icon-theme-directory`, `vscode-icon-theme-vsix`) so Settings and catalogs can label them clearly.
  - `src/config/themePackages.ts` now accepts native theme bundles plus VS Code compatibility imports, preserves the raw normalized theme payload during bundle resolution, and carries extension-contributed file icon themes along as local icon catalogs for mixed VS Code extensions.
  - `src/config/explorerMonaco.ts` is now the shared Monaco theme bridge for compatibility themes. Monaco surfaces derive their theme id/colors from the active resolved appearance and layer in VS Code token colors when the active theme came from a VS Code import. Do not hardcode `vs-dark` inside Monaco consumers anymore.
  - `src/components/FileExplorer.tsx`, `src/components/GitManager.tsx`, and `src/components/ExplorerShaderWorkbench.tsx` now use that shared Monaco compatibility path instead of per-surface hardcoded theme names.
  - `src/config/appearance.ts` now carries Monaco compatibility metadata on `theme.assets.monacoTheme` so the shell theme contract can stay GreebleFS-owned while Monaco still honors imported VS Code token colors.
  - `src-tauri/src/archive_ops.rs` now treats `.vsix` as a zip-class archive and reuses the cached extraction path. The original archive stays in place; the extracted extension root lives in the archive cache.
- Durable implementation lesson:
  - `joinPlatformPath(...)` only joins one segment at a time. When probing `extension/package.json`, nest the joins (`joinPlatformPath(joinPlatformPath(root, 'extension'), 'package.json')`) instead of passing three arguments, or the final filename is silently dropped.
- Validation:
  - passed: `bunx vitest run src/test/explorerMonaco.test.ts src/test/iconThemePackages.test.ts src/test/themePackages.test.ts`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "advertises VS Code folder and .vsix compatibility in theme settings copy"`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml vsix`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml detects_compound_archive_suffixes_before_single_suffixes`

# 2026-04-24 - Explorer Drag And Drop Now Coalesces Pointer Work And Reuses Drop-Surface Runtime State

- The flagship explorer drag/drop runtime got a focused performance pass aimed at 120 Hz feel without changing the product model. Internal app-owned drag is still the same system, but the hot path now does less DOM churn and less React-facing work per pointer frame.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now coalesces internal pointer-drag updates through a single `requestAnimationFrame` lane (`internalPointerDragFrameRef` / `internalPointerDragPendingPointerRef`) instead of running full drag hit-resolution on every raw `pointermove`.
  - The first internal drag frame still commits immediately when the gesture crosses the drag threshold. Keep that immediate lift-off path; it prevents the drag overlay and hovered target state from feeling one frame late even though follow-up movement is rAF-coalesced.
  - Native drag-out startup in `FileExplorer.tsx` now takes a synchronous fast path for normal local entries. Only archive-virtual entries still await materialization before calling the native drag bridge, which keeps `Alt` drag-out feeling instant for ordinary files.
  - `src/components/explorer/explorerDragAndDrop.ts` now memoizes drop-surface bindings by `surfaceId`, caches registered surface metadata/behavior by id and element, and keeps a scope-root lookup map so hit resolution no longer depends on repeated DOM queries for the scope root.
  - Important regression fix: when a drop-surface ref detaches and reattaches, the runtime must restore the surface behavior map as well as the metadata map. A temporary ref detach can still leave folder drops working while silently killing dwell-open, because hit resolution only needs metadata but hover-open needs `onAutoOpen` behavior. Keep those two maps in sync on reattach.
  - The drag runtime now reuses the last resolved drop hit while the pointer stays inside the same target surface, caches element rects for the current animation frame, and caches normalized source-path validation context by source-path array plus platform. Future perf work should extend these runtime caches before adding more state at the `FileExplorer.tsx` layer.
  - `setExplorerDragInteractionState(...)` now skips listener fan-out when the next state is the same object reference, which matters because the drag runtime frequently uses updater functions that intentionally return the current state on no-op paths.
  - `FileExplorer.tsx` now relies on per-entry drag presentation (`dragPresentation.isDropTarget`) instead of a top-level `dragOver === path` string path in the main explorer selector path. Keep pushing drag visuals toward leaf-local presentation state instead of broad explorer-shell subscriptions.
- Durable product note:
  - The current fast path is intentionally hybrid: immediate first-frame response, then coalesced follow-up updates. Do not “simplify” it back into raw `pointermove` hit-resolution unless a future measurement proves the browser/runtime changed enough that the coalescing is no longer buying real smoothness.
  - The next real perf ceiling is still large-surface rerender pressure in `FileExplorer.tsx`. If drag smoothness needs another pass, push more hover/drop visuals into smaller memoized leaves or DOM-local presentation hooks before adding more global drag-state subscriptions.
- Validation:
  - passed: `bunx vitest run src/test/explorerDragAndDrop.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/ExplorerWorkspace.test.tsx -t "mounts the shared drag overlay during normal live workspace panes|routes folder preview row drags through the app-owned explorer drag runtime|drops explorer files into the previewed folder and refreshes the preview lane|copies native external drops into the previewed folder and refreshes the preview lane|starts pointer-driven internal explorer drags without invoking the native drag bridge|moves multi-selected files into the hovered folder without leaking the drop to the viewport root|drops into the current folder when hovering explorer chrome outside the main file plane|copies native external drops into the hovered folder via the Tauri drag-drop listener|drops native external drags into the current folder when the pointer is over a file card|starts the native drag bridge only when Alt is held for supported local entries" --reporter=dot`
  - blocked currently: repo-wide `bunx tsc --noEmit --pretty false -p tsconfig.json` still fails in pre-existing unrelated `src-mobile/**`, `src/config/**`, and vendored `src/vendor/tiptap/**` typing/dependency paths outside this drag/drop performance pass

# 2026-04-24 - Mobile PWA Now Uses A Real Workbox Stack Plus Targeted Virtualization And Sheet Gestures

- The mobile shell is no longer running on a copied static `public/sw.js` cache hack. `vite.mobile.config.ts` now builds the mobile bundle through `vite-plugin-pwa` in `injectManifest` mode, and `src-mobile/sw.ts` is the new source-of-truth service worker.
- Durable implementation shape:
  - `src-mobile/sw.ts` now owns the mobile service worker as a first-class source file. It uses Workbox precaching/runtime routing for the mobile shell while preserving the repo’s existing push-notification behavior and download-intent handoff back into the phone UI.
  - `src-mobile/public/sw.js` was removed on purpose. Future service-worker changes should go through `src-mobile/sw.ts` and the Vite PWA build, not through a copied public asset.
  - `src-mobile/App.tsx` now carries two mobile-performance primitives:
    - `@tanstack/react-virtual` is wired into `MobileExplorerVirtualSurface` for large folder browsing
    - `interact.js` now drives the preview overlay as a draggable bottom sheet with swipe-down dismissal
  - The mobile shell chrome was also tightened in `src-mobile/App.tsx` and `src-mobile/mobile.css`: the top bar is now a compact identity row with icon-only refresh, the explorer root breadcrumb now uses the actual share name, and the root explorer header can expose lightweight `Places` pills for common directories already visible in the current share. Treat that `Places` strip as the current quick-traversal lane until a richer host-owned roots/drives endpoint exists.
  - Bottom dock clearance is now larger and scales with touch-target size so the fixed explorer action strip no longer sits on top of the lowest cards when chrome scale is pushed upward.
  - `vite.mobile.config.ts` now also uses explicit Rollup `manualChunks(...)` for the mobile build, and `src-mobile/App.tsx` no longer wildcard-imports `lucide-react`. The first pass of chunking exposed that the wildcard icon import was dominating the split, so the mobile icon usage is now registry-based and only imports the specific Lucide icons the mobile shell actually uses.
  - The explorer virtualization is intentionally selective. Small folders render directly for immediate paint and simpler testing; large folders switch to the virtualized path. Do not force virtualization onto every tiny directory just because the library is available.
  - The preview sheet is now the right extension point for future mobile interactions. If later passes add snap points, media galleries, or haptic-style affordances, build on the `mobile-overlay__sheet` lane instead of reverting to a static fullscreen overlay.
- Durable product note:
  - Treat the mobile shell as its own serious runtime, not a shrunken desktop panel. Performance and gesture polish now belong to the mobile architecture itself.
  - If a future agent needs richer offline behavior, retry queues, or background sync, extend the Workbox-backed service worker rather than adding a second cache/runtime abstraction beside it.
- Validation:
  - passed: `bun run build:mobile`
  - passed: `bunx vitest run src/test/mobileApp.test.tsx src/test/mobileTheme.test.ts --reporter=dot`
  - notable mobile build result after chunking cleanup: app shell is now split into `mobile-react-core`, `mobile-gestures`, `mobile-vendor`, `mobile-virtual`, `mobile-icons`, and the main app chunk; the Lucide chunk dropped from roughly `600 KB` down to under `10 KB` once the wildcard import was removed
  - note: repo-wide TypeScript remains expensive/noisy on this branch, so this pass relied on successful mobile build plus targeted mobile tests instead of claiming a clean full-repo `tsc`

# 2026-04-24 - Preview Panes Now Register Adaptive Context Menus

- Preview-pane right-click is still one shared explorer menu surface, but it no longer has to be generic-only. The menu can now adapt to the active preview kind plus the active workflow tab without each lane inventing its own private context menu system.
- Durable implementation shape:
  - `src/components/explorer/explorerPreviewContextMenu.ts` is the shared registration seam for preview-lane context actions. It owns the data shape for base preview actions plus workflow-tab overlays and merges them data-first by action id, including `hidden: true` removal for per-tab overrides.
  - `src/config/explorerContextMenu.ts`, `src/config/menuPacks.ts`, and `src/components/explorer/explorerMenuRuntime.ts` now treat preview-owned actions as first-class runtime menu nodes. `preview-pane` invocations carry `previewContext` metadata (`previewKind`, `workflowTabId`, `workflowBaseMode`), menu packs have a dedicated `preview` slot, and the runtime injects preview actions near the top when an older layout has no explicit preview slot.
  - The built-in `preview-pane` menu is now intentionally separate from the main explorer entry menu even though both still use the same authored system. The default preview layout is compact, hides descriptions, and keeps only `Open`, `Open With`, preview-lane actions, `Reveal in Explorer`, and `Copy Path` instead of inheriting the explorer clipboard/organize/library/danger stack.
  - `src/components/explorer/ExplorerContextMenu.tsx` now respects context-authored density and description visibility so preview panes can render a smaller, less hand-holdy menu without forking a second renderer.
  - `src/components/FileExplorer.tsx` now owns preview context-menu registration state at the explorer host layer instead of letting `PreviewPanel` hoard it locally. The mounted lane reports wildcard-tab/workflow context upward, and the shared preview-surface right-click path remains the default entrypoint for adaptive preview menus.
  - `src/components/ExplorerImageEditor.tsx` and `src/components/ExplorerImageCutoutSurface.tsx` are the first adopter of the seam. Generic image preview/edit actions register from the shared image workbench, while `Cutout` and `Remove BG` add workflow-specific overlays from the shared isolation surface instead of forcing more permanent header chrome.
- Durable implementation lesson:
  - Do not explode explorer menu contexts into `preview-image`, `preview-audio`, `preview-cutout`, etc. One `preview-pane` context plus metadata and lane-owned registrations is the scalable contract.
  - Do not let the default `preview-pane` layout drift back toward the full explorer entry menu. If a preview lane needs more tools, prefer lane-owned preview actions or an authored preview layout override before reintroducing clipboard/trash/library bulk by default.
  - If preview-specific menu items disappear, inspect the host-owned registration/cleanup flow in `FileExplorer.tsx` and the mounted lane registration effect before blaming the menu pack layout.
  - Child preview surfaces can still stop propagation when they truly need a local/editor-native menu, but they should not bypass the shared preview menu by default.
- Validation:
  - passed: `bunx vitest run src/test/explorerMenuRuntime.test.ts --reporter=dot --pool=forks`
  - passed: `bunx vitest run src/test/explorerImageEditor.test.tsx --reporter=dot --pool=forks`
  - passed: `bunx vitest run src/test/explorerImageCutoutSurface.test.tsx --reporter=dot --pool=forks`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "preview-pane context-menu|child preview surfaces suppress" --reporter=dot --pool=forks`
  - passed: targeted `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "explorerContextMenu|menuPacks|explorerMenuRuntime|FileExplorer|ExplorerImageEditor|ExplorerImageCutoutSurface|explorerPreviewContextMenu|explorerMenuRuntime.test|fileExplorer.viewModes.test|explorerImageEditor.test|explorerImageCutoutSurface.test"`
  - blocked currently: full `bunx vitest run src/test/fileExplorer.viewModes.test.tsx --reporter=dot --pool=forks` still fails outside this preview-menu slice in `opens executable scripts in an editor-first preview with edit left of the run workflow tab` and `drops explorer files into the previewed folder and refreshes the preview lane`, then eventually OOMs the worker process

# 2026-04-24 - Image Isolation Is Now Split Into Real `Cutout` And `Remove BG` Lanes

- Explorer image isolation no longer pretends that prompt-driven cutout and automatic background removal are the same workflow. Editable raster images now register two wildcard tabs: `Cutout` and `Remove BG`.
- Durable implementation shape:
  - `src/components/ExplorerImageEditor.tsx` now registers `Preview | Edit | Cutout | Remove BG` for editable raster images and routes both isolation tabs through the same `ExplorerImageCutoutSurface` mount using a required `workflowMode` prop (`cutout` or `removeBackground`).
  - `src/components/explorer/explorerImageStage.ts` is now the shared zoom/pan transform seam for both normal image preview and isolation preview. Future image-stage interaction changes should go there instead of forking preview math inside each lane.
  - `src/components/ExplorerImageCutoutSurface.tsx` was rebuilt into a compact explorer-native isolation surface instead of the old `Spark` / `Sweep` / `Add` / `Trim` toy shell. `Cutout` is prompt-first, plain click adds a positive prompt, `Alt`/right-click adds a negative prompt, plain drag pans, `Shift+drag` stages a transparent PNG for native drag-out, and refine controls stay collapsed behind `Refine` with `PremiumSlider` plus icon-first brush/erase controls. The cutout lane no longer mounts a floating explainer card; the only persistent chrome is the icon-first top-right action bar plus the compact bottom status pill.
  - `src/config/imageCutoutTools.ts` is now lane metadata rather than a text-tool catalog. It owns the workflow tab registration plus the lane copy/reset labels and the refine-tool definitions used by the isolation surface.
  - `src-tauri/src/image_cutout_commands.rs`, `src/generated/tauri.ts`, and `src/runtime/imageCutoutBackend.ts` now treat `workflowMode` as part of the typed contract, so the host/runtime seam can distinguish semantic `Cutout` sessions from explicit `Remove BG` sessions.
  - `src-python/greeblefs_sidecar/cutout_runtime.py` now boots and resets sessions by workflow mode: `cutout` starts from an empty mask with no automatic background removal, while `removeBackground` still uses the current heuristic auto-mask path and labels that path honestly as heuristic auto removal rather than semantic cutout.
- Durable product note:
  - Do not collapse `Cutout` back into “open tab and instantly auto-remove background.” Prompt-first isolation and one-click remove-background are separate workflows now, even if they share the same export/copy/drag plumbing.
  - The marching-ants overlay is currently a stage-local canvas effect, not a committed shader asset. If future polish revisits it, keep the mask-boundary visibility first-class instead of hiding it behind a theme-only experiment.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `python3 -m py_compile src-python/greeblefs_sidecar/*.py tests_python/test_cutout_runtime.py`
  - passed: `python3 -m unittest discover -s tests_python -p 'test_*.py' -v`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml image_cutout --quiet`
  - passed: `bunx vitest run src/test/explorerImageEditor.test.tsx src/test/explorerImageCutoutSurface.test.tsx src/test/explorerImageCutoutMask.test.ts --reporter=dot`
  - blocked currently: repo-wide `bunx tsc --noEmit --pretty false -p tsconfig.json` still fails in pre-existing vendored `src/vendor/tiptap/**` typing/dependency paths unrelated to this image-isolation rewrite

# 2026-04-24 - Explorer Preview Terminal And Bottom Drawer Are Separate Again

- The shared explorer-terminal refactor was reverted at the product-architecture level. The preview pane terminal and the bottom drawer are no longer one movable explorer-local terminal session.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now keeps two explicit embedded-terminal lanes:
    - a preview-owned terminal lane driven by `previewSurfaceMode`, `previewTerminalMounted`, `previewTerminalCommandRequest`, and preview-specific cwd-sync refs
    - a bottom-drawer terminal lane driven by `explorerTerminalMounted` / `explorerTerminalVisible`
  - Preview actions such as script runs, Python `Run in Terminal`, and managed REPL handoff now route back into the preview terminal lane instead of forcing the bottom drawer.
  - The bottom status-bar drawer remains its own integrated terminal surface and still uses the explorer-local `Ctrl+J` reveal path plus the `terminalDrawerToggle` chrome control.
  - Terminal-to-explorer cwd sync is preserved in both lanes: preview terminal shell cwd changes still navigate the explorer, and the bottom drawer keeps its own reported-cwd sync path.
- Durable product note:
  - Do not recombine the preview terminal and bottom drawer into one placement-swapping session unless the product explicitly changes direction. They serve different workflows, and the shared-session version regressed real preview-terminal behavior.
  - If preview-terminal behavior looks dead in tests or runtime, check whether preview actions are routing into the preview lane helpers (`revealPreviewTerminal`, `togglePreviewTerminal`, preview command queue) before blaming `TerminalOverlay`.
- Durable validation note:
  - A malformed generated bridge file can block explorer validation entirely. This pass had to remove merge-conflict markers from `src/generated/tauri.ts` before `src/test/fileExplorer.viewModes.test.tsx` could import again.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "terminal" --reporter=dot --pool=forks`
  - passed: `bunx vitest run src/test/explorerChromeLayouts.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot --pool=forks`
  - passed: targeted `bunx tsc --noEmit --pretty false -p tsconfig.json` grep for `src/components/FileExplorer.tsx|src/components/TerminalOverlay.tsx|src/test/fileExplorer.viewModes.test.tsx|src/generated/tauri.ts`

# 2026-04-24 - Explorer Images Now Have A Host-Owned Cutout Workflow Tab

- Editable explorer images no longer stop at `Preview` and `Edit`. The shared preview header now exposes a new `Cutout` wildcard tab for raster images, and that lane is built as a host-owned session flow instead of a browser-only export trick.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` still owns the shared preview shell, but image wildcard tabs now register from the mounted `ExplorerImageEditor.tsx` surface instead of being hardcoded in the preview panel. That keeps `Preview | Edit | Cutout` aligned with the actual mounted workbench and matches the existing audio/Python wildcard-tab model.
  - `src/components/ExplorerImageEditor.tsx` now multiplexes three image workflows: fullscreen preview, CropperJS edit, and the new `Cutout` lane. It stays the shared image surface for both explorer preview and screenshots, but only explorer image previews currently register the `Cutout` wildcard tab.
  - `src/components/ExplorerImageCutoutSurface.tsx` is the React cutout lane. It still bootstraps a host session for the initial auto-cutout, but normal refinement is now local and immediate: `Spark` performs connected color-island grabs, `Sweep` paints similar pixels with adjustable size/reach/softness, `Soft Edge` and `Edge Pull` reshape the resolved matte, the marching ants are drawn from the actual selection boundary, and undo/redo/reset operate on local mask history instead of round-tripping every click through Python. The lane deliberately reverted back to a preview-first immersive shell after the first tool pass felt too bloated: the subject stage stays fullscreen-first, tool buttons float as compact overlay chrome, and refine sliders only appear behind an explicit `Refine` panel.
  - `src/components/explorer/explorerImageCutoutMask.ts` is the local mask-ops seam. It owns mask decoding, grayscale-mask detection, boundary extraction, `Spark` flood-fill selection, `Sweep` brush math, and resolved-mask edge shaping. Keep future local cutout tools here instead of burying pixel math inside the React surface.
  - `src/config/imageCutoutTools.ts` is the data-driven catalog for cutout tools. New panel tools should register here instead of hardcoding tool labels/ids in JSX.
  - `src/runtime/imageCutoutBackend.ts` is the only TypeScript bridge for cutout sessions. React should use its typed `open/apply/reset/stage/copy/close/startNativeDrag` helpers instead of invoking raw commands, and host prompt-apply should stay reserved for true model-backed refinement rather than every interactive brush stroke.
  - `src-tauri/src/image_cutout_commands.rs` is the native contract. It owns session ids, safe temp/sibling output preparation, clipboard image copy, drag artifact staging, Python-sidecar dispatch, and the override-mask handoff used when the local tool path exports a refined matte.
  - `src-python/greeblefs_sidecar/cutout_runtime.py` is the current sidecar implementation. It keeps per-session caches plus prompt history and returns mask previews/export artifacts through manifest-registered actions. The shipping v1 runtime is intentionally heuristic and contract-ready: the catalog/default model now reserves the `image-cutout` capability for a future SAM2-class managed-weights lane, but the actual sidecar still uses a fast Pillow-based saliency/mask heuristic today instead of pretending real neural segmentation already landed.
  - `src/config/localModelCatalog.json` and `src/config/localModels.ts` now include the `image-cutout` capability with `auto` / `cpu` / `cuda` backend preferences so the cutout lane rides the existing local-model settings surface instead of inventing a private GPU toggle.
  - `src/config/hotkeys.ts`, `src/components/SettingsPage.tsx`, and the local preview key guard in `FileExplorer.tsx` now reserve `imageCutoutCopy` on `Ctrl+C`, reuse `saveFile` for sibling PNG save, and prevent explorer transfer-queue copy from firing while the cutout surface owns keyboard focus.
- Durable implementation lesson:
  - The auto-cutout model should bootstrap the first mask, not sit in the pointer-move loop. If the cutout lane ever feels laggy again, verify that interactive edits are still staying inside `explorerImageCutoutMask.ts` and that the host path is only being used for open/reset/export.
- Durable implementation lesson:
  - Do not spend pane width on permanent inspector chrome for the cutout lane. This preview behaves better when the image stage keeps the space budget and the UI uses floating tool groups plus progressive disclosure (`Select` first, `Refine` second).
- Durable implementation lesson:
  - Lane-owned wildcard tabs must register from the mounted surface, and the preview-header control registry must depend on the workflow-toggle renderer. We hit a real stale-closure regression where the header kept showing only `Preview | Edit` after the image lane registered `Cutout` because `previewChromeControlRegistry` was memoized without `renderPreviewWorkflowToggle`. If wildcard tabs disappear again, inspect preview-header memo dependencies before blaming the lane component.
- Validation:
  - passed: `python3 -m py_compile src-python/greeblefs_sidecar/*.py`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml image_cutout --quiet`
  - passed: `bunx vitest run src/test/explorerImageCutoutMask.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/explorerImageEditor.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "image" --reporter=dot`
  - passed: `bunx vitest run src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot`

# 2026-04-24 - Rust Workspace Loads Cleanly On Linux Again For Serena And Tauri

- The Linux Rust workspace is valid again for Cargo tooling, rust-analyzer, and Serena indexing. The prior failure was not one bug but two stacked workspace hazards.
- Durable implementation shape:
  - `crates/file-opening-macos/build.rs` now exits early unless `CARGO_CFG_TARGET_OS=macos`, so Linux-hosted tooling does not try to package the Swift bridge while loading the workspace.
  - `crates/file-opening-macos/Cargo.toml` now enables the `swift-rs` build feature for the build script and keeps the runtime `swift-rs` dependency scoped to macOS targets.
  - `crates/file-opening-macos/src/lib.rs` is now explicitly macOS-only, which keeps the crate from pretending to be a normal cross-platform library during Linux workspace checks.
  - Root `Cargo.toml` no longer lists the missing local playground member `.playground/terminal-shadow-probe` in `[workspace].members`, so Cargo metadata and rust-analyzer can load the workspace without requiring an absent scratch package.
- Durable workflow note:
  - Treat local playground crates as opt-in developer state, not committed workspace requirements, unless the package actually exists in the repo.
  - Any Swift/macOS bridge crate should gate build-script work by target and keep Apple-specific dependencies scoped to macOS. If Rust indexing suddenly dies on Linux again, check for unconditional build scripts before blaming Serena.
  - The local Serena override at `.serena/project.local.yml` is now the right place to re-enable or narrow indexing for the current machine without changing the repo-tracked Serena project config.
- Validation:
  - passed: `cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1`
  - passed: `cargo check -p file-opening-macos`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --package greeblefs --lib`
  - passed: `serena project index /home/ephemara/Dev/Apps-2D/GreebleFS` with `rust=162`, `typescript=473`, `python=23`

# 2026-04-24 - Reference Repos Now Have A Profile-Driven Scrubber And Repomap Flow

- The repo now has a durable reference-intake workflow for the ignored `reference/` folder instead of ad hoc manual flattening.
- Durable implementation shape:
  - `reference_scrub.py` is the root orchestrator for destructively normalizing any direct child of `reference/`
  - `reference_scrub_profiles.toml` is the source of truth for per-repo keep/drop/hoist/collapse behavior plus the generic fallback for newly added folders
  - `reference_scrub_vscode.py` and `reference_scrub_zed.py` are thin wrappers for the two largest imported repos
  - `tests_python/test_reference_scrub.py` is the safety net for path rejection, symlink rejection, dry-run behavior, hoist/collapse behavior, repomap generation, deterministic collision renaming, and repeated-run idempotence
- Durable safety model:
  - The scrubber only accepts direct child repo names under `reference/`
  - It rejects path traversal, absolute/outside targets, repo symlinks, and nested symlink entries
  - It stages the rewrite under `reference/.<repo>.reference-scrub-staging`, writes `reference-scrub-manifest.json`, runs compressed `repomix` to produce `repomap.md`, and then atomically replaces the original repo directory
  - Generated `repomap.md` and `reference-scrub-manifest.json` are excluded from future scrub inputs so repeated runs stay structurally idempotent
- Durable workflow note:
  - If future agents add another reference repo, they should first try `python3 reference_scrub.py --repo <folder> --skip-repomix` to validate the shape, then add or refine a profile in `reference_scrub_profiles.toml` only if the generic fallback is not aggressive enough
  - The wrapper scripts exist because `vscode` and `zed` are large enough that users may want explicit one-command reruns
  - Agents should use the generated `repomap.md` files for orientation before doing manual traversal inside those references
- Executed validation:
  - passed: `python3 -m unittest discover -s tests_python -p 'test_*.py' -v`
  - passed: `python3 -m py_compile reference_scrub.py reference_scrub_vscode.py reference_scrub_zed.py tests_python/test_reference_scrub.py`
  - passed: `python3 reference_scrub.py --all --skip-repomix`
  - passed: `python3 reference_scrub.py --all --apply`
  - passed: `python3 reference_scrub_vscode.py --apply`
  - passed: `python3 reference_scrub_zed.py --apply`
  - passed: post-run verification that every direct child of `reference/` contains both `repomap.md` and `reference-scrub-manifest.json`

# 2026-04-24 - Notes Panel Now Uses One Obsidian-Like Sidebar, Shared Menus, And Coalesced Autosave

- The notes panel no longer uses the earlier two-left-rail layout or browser-native confirm dialogs. It now behaves like a single sidebar tree with folders and notes in one surface, while the editor stays in the main lane.
- Durable implementation shape:
  - `src/components/NotesManager.tsx` now renders one explorer-like notes sidebar instead of separate folder and note-list panes. The tree shows folders plus nested notes, search filters the same tree, and the sidebar uses the existing `ExplorerContextMenu` presenter plus `AppPromptDialog` / `AppConfirmDialog` for folder/note actions.
  - The notes sidebar now keeps folder actions mostly in the shared context menu rather than always-visible inline buttons. The root state feels closer to Obsidian/iPhone Notes than a mini SaaS dashboard.
  - Notes saving is no longer "save then full workspace reload" on a short per-keystroke debounce. `NotesManager.tsx` now keeps the active markdown draft local, coalesces saves after idle time, flushes on blur/navigation/manual save, and patches the active note record into local workspace state after a successful write instead of rescanning the entire tree.
  - `src/runtime/notesWorkspaceBackend.ts` now exports `summarizeNotesMarkdown(...)` so the panel can update preview text and word count locally after save without duplicating markdown-summary logic.
  - `src/components/notes/NotesRichMarkdownEditor.tsx` now exposes a blur hook so the notes shell can flush pending markdown edits when the rich editor loses focus.
- Durable product note:
  - Keep the notes panel on the shared shell dialog/menu path. Do not reintroduce `window.confirm`, inline folder action spam, or a second dedicated note-list rail unless a future product change explicitly needs a different structure.
  - Keep saves local-first and coalesced. Structural operations can still reload the notes tree, but ordinary text edits should not rescan the full workspace after every write.
- Validation:
  - passed: `bunx vitest run src/test/notesManager.test.tsx src/test/notesConfig.test.ts src/test/notesMarkdownDocument.test.ts src/test/panelRegistry.test.tsx --reporter=dot`
  - passed: targeted `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "src/components/NotesManager.tsx|src/components/notes/NotesRichMarkdownEditor.tsx|src/runtime/notesWorkspaceBackend.ts|src/test/notesManager.test.tsx" || true`

# 2026-04-24 - Native Open With Is Now A Real Explorer Submenu With macOS Support

- Explorer `Open With` is no longer just a thin system-picker action. The explorer menu runtime now resolves a real submenu of associated apps from a host-owned native subsystem, while keeping the system picker as a fallback action where the platform supports it.
- Durable implementation shape:
  - `src-tauri/src/open_with/` is now wired into the live host through `src-tauri/src/lib.rs`, `src-tauri/src/specta_bindings.rs`, and `src-tauri/Cargo.toml`. The vendored subsystem now exports typed associated-program lookup plus explicit app launch commands for the frontend, and macOS support is provided through the existing `file_opening_macos` / `sd-desktop-macos` lane rather than a one-off shell script path.
  - `src-tauri/src/open_with/macos.rs` is the new macOS adapter for the vendored runtime. It maps macOS app associations into the shared `AssociatedProgramsCatalog`, launches a selected app by app id, and provides a native picker fallback through AppleScript when the user chooses the system picker path.
  - `src-tauri/src/fs_commands.rs` still exposes `fs_open_with_dialog`, but it now delegates to `src-tauri/src/open_with/` so the picker path and explicit app-launch path share one native subsystem instead of drifting apart by platform.
  - `src/runtime/explorerBackend.ts` is now the only TS bridge for open-with association lookup and explicit app launch. React surfaces should use `getExplorerAssociatedPrograms(...)`, `openExplorerPathWithProgram(...)`, and `openExplorerPathWithDialog(...)` there instead of inventing local platform logic.
  - `src/components/explorer/explorerMenuRuntime.ts` now treats `open-with` as a resolver-backed submenu. It reads cached app catalogs from the runtime environment, resolves real app entries plus loading/error/empty placeholders, and only appends `System Picker…` as a fallback item when the platform actually supports it.
  - `src/components/FileExplorer.tsx` now owns the cache/fetch path for associated programs keyed by target path and passes that state into the menu runtime environment. This keeps context-menu composition in the authored menu runtime while keeping async fetch state in the explorer shell that already owns the invocation snapshot.
  - The open-with request path is now hardened against stuck loads. `FileExplorer.tsx` tags each path lookup with a request id plus a frontend timeout, so one hung request can no longer leave a file path permanently stuck in `Loading Compatible Apps…` for the rest of the session.
  - `src-tauri/src/open_with/utils.rs` now provides a timeout helper used by the Linux MIME/app probes, and the Linux resolver skips expensive per-program icon extraction until the explorer menu renderer actually consumes app-specific icons. That keeps `Open With` lookup bounded and materially faster on Linux.
  - `src/components/explorer/ExplorerContextMenu.tsx` now honors disabled command nodes, which the runtime uses for loading/error/empty submenu placeholders.
- Durable product note:
  - Keep `Open With` as a host-owned explorer workflow, not a React-only branch. Platform association lookup, native picker fallback, and explicit app launch should continue to live under `src-tauri/src/open_with/` plus `src/runtime/explorerBackend.ts`.
  - If future menu renderers such as radial or hybrid need `Open With`, they should consume the same resolved submenu tree. Do not special-case `Open With` back into a renderer or into `FileExplorer.tsx`.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `bunx vitest run src/test/explorerMenuRuntime.test.ts src/test/explorerContextMenuRenderer.test.tsx --reporter=dot`
  - blocked currently: repo-wide `bunx tsc --noEmit --pretty false -p tsconfig.json` still fails in unrelated vendored `src/vendor/tiptap/**` paths

# 2026-04-24 - Shell Animation Progress Is Now Leaf-Local, Shell Effects Are Tiered, And Command Palette Search Is Deferred

- The main shell no longer pays the old `App.tsx` 120 Hz root-state tax during overlay animation. Frame-driven progress is now isolated in a dedicated shell scene leaf, while the root only changes coarse animation phase.
- Durable implementation shape:
  - `src/components/OverlayShellScene.tsx` is now the shell-animation leaf. It owns folder-authored animation progress with a local `requestAnimationFrame` loop and keeps built-in animation behavior on the existing CSS-transition path. Future shell-motion work should extend this leaf instead of reintroducing frame-by-frame `useState` at the `App.tsx` root.
  - `src/App.tsx` no longer stores `animationProgress` or a root progress frame ref. It now assembles shell frame/container/background/content surfaces once, passes them into `OverlayShellScene`, and only updates overlay phase/direction plus other real shell state.
  - `src/config/workbenchPerformance.ts` is now the runtime-only shell-effects policy seam. It resolves `full | reduced | minimal` shell tiers from platform plus `overlay_frame_time` telemetry, defaults Linux to `reduced`, caps blur in reduced mode, and gates wallpaper/theme-effect/shader/animation-overlay layers in lower tiers.
  - Heavy shell surfaces now declare `contain: layout paint style` and `isolation: isolate` in the main shell content container, pinned panel slots, and managed panel shells so browser layout/paint work stays more local when the compositor stack is already expensive.
  - The command palette now defers the query before sending it into global indexed search. `App.tsx` still uses the live query for local palette filtering/status, but the backend-facing `setGlobalSearchQuery(...)` call now consumes `useDeferredValue(commandPaletteQuery)` so typing stays ahead of the search lane.
  - `src/test/overlayShellScene.test.tsx` locks the key perf contract: stable shell content should not rerender on local folder-animation progress ticks. `src/test/workbenchPerformance.test.ts` locks the Linux default reduced tier and the minimal-tier downgrade under sustained frame pressure.
- Durable product note:
  - If shell smoothness regresses, inspect root-level React animation state and compositor-heavy shell layers before touching explorer internals. The first-line rule is now: shell motion belongs in leaf-local animation surfaces or CSS transitions, not in `App.tsx` root state.
  - `contain`/`isolation` help browser-side layout/paint scope, but they do not erase the OS compositor cost of transparent undecorated windows with blur/shaders/wallpapers. Keep adaptive shell-effect downgrades as a real runtime safety valve, especially on Linux and Windows.
- Validation:
  - passed: `bunx vitest run src/test/workbenchPerformance.test.ts src/test/overlayShellScene.test.tsx src/test/frameTelemetry.test.ts src/test/app.dockMode.test.tsx src/test/commandPalette.test.tsx --reporter=dot`
  - blocked currently: `bunx tsc --noEmit --pretty false -p tsconfig.json` still fails in pre-existing vendored `src/vendor/tiptap/**` typing/dependency paths unrelated to this shell-performance slice

# 2026-04-24 - Notes Panel Is Now A Folder-First Markdown Workspace Backed By Vendored Tiptap

- The notes surface no longer behaves like a hardcoded notes/todos/bugs/prompts board. It is now a real folder/document workspace over the managed `notes/` root, with empty-state-first behavior and no category-specific icons or app logic.
- Durable implementation shape:
  - `src/components/NotesManager.tsx` now owns a three-pane notes shell: folder tree, note list, and document workspace. Root selection behaves like `All Notes`, while real folders are just filesystem directories under `notes/`.
  - `src/components/notes/NotesRichMarkdownEditor.tsx` is the shell-owned rich editor surface. It uses the vendored Tiptap source tree for toolbar-driven rich editing while still persisting plain markdown.
  - `src/runtime/notesWorkspaceBackend.ts` is now the filesystem seam for notes. It creates/renames/deletes folders and notes through the explorer runtime, scans the notes tree recursively for list/search state, and preserves legacy frontmatter-based notes by stripping the old JSON envelope on read.
  - `src/runtime/notesMarkdownDocument.ts` is the markdown round-trip layer. It resolves the vendored Tiptap extensions, feeds their markdown hooks through a local Marked-based parser/renderer, and adds local markdown extensions for blockquotes, inline code, code blocks, hard breaks, and links so notes stay `.md` on disk instead of drifting into HTML storage.
  - `src/config/notes.ts` is now root-first instead of category-first. It exposes the notes workspace defaults plus supported markdown file extensions, and it no longer encodes app-specific subdirectories like `todos` or `bugs`.
  - `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `vitest.browser.config.ts` now resolve `@tiptap/*` imports into `src/vendor/tiptap/*`, while `package.json` / `bun.lock` now include the upstream ProseMirror runtime packages plus `fast-equals` and `use-sync-external-store` that the vendored editor depends on.
- Durable product note:
  - Treat the notes panel as a markdown workspace, not a task-board surface. Checklist syntax still exists as a markdown feature, but the panel should not grow special todo/bug/prompt modes again.
  - The vendored editor source is not self-contained: future agents who add more Tiptap packages must wire both alias resolution and any missing upstream runtime dependencies, not just copy source folders into `src/vendor/`.
- Validation:
  - passed: `bunx vitest run src/test/notesConfig.test.ts src/test/notesMarkdownDocument.test.ts src/test/panelRegistry.test.tsx --reporter=dot`
  - passed: targeted `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "NotesManager|NotesRichMarkdownEditor|notesMarkdownDocument|notesWorkspaceBackend|notesConfig|notesMarkdownDocument.test" || true`

# 2026-04-24 - Andromeda Theme Selection Now Resets Stale Overrides And Uses A Cheaper Always-On Visual Stack

- Selecting the authored `themes/andromeda/` bundle had a real performance trap: `applyThemeSelection(...)` only resets theme-managed appearance/layout state when the target theme id is registered in `src/config/pilotThemeContract.ts`, and Andromeda was not in that map yet.
- Durable implementation shape:
  - `src/config/pilotThemeContract.ts` now gives `andromeda` explicit selection defaults and extends theme-selection appearance defaults with `shaderPerformanceMode`. That means switching into Andromeda now clears stale wallpaper/shader overrides, resets blur/transparency/zoom back to the shared theme baseline, and forces shader mode back to `performance` instead of inheriting a heavier prior theme state.
  - `themes/andromeda/appearance-packs/appearance-core/appearance.json` now keeps the same identity but removes the always-on drifting/panning visual animations and lowers the overlay opacities. Treat this bundle as Linux-compositor-safe by default; animated shaders and bundle-local animations can still add motion intentionally, but the base appearance pack should not require them to feel correct.
  - `src/components/FileExplorer.tsx` no longer mixes `margin` with `marginBottom` in the toolbar shell, which removes the React style warning and avoids layout churn from conflicting shorthand/non-shorthand updates.
  - `src/components/StoragePanel.tsx` no longer nests a remove `<button>` inside a clickable queue-row `<button>`. Queue rows are now keyboard-accessible button-like containers with a separate real button for removal, which removes the invalid DOM nesting warning and the hydration risk it caused.
  - `src/test/settingsStore.test.ts` now locks the Andromeda regression path by asserting that theme selection clears stale wallpaper/shader/blur/zoom state, and `src/test/storagePanel.layout.test.tsx` now asserts that the cleanup queue does not render `button button` nesting.
- Durable product note:
  - Treat authored bundle theme switches like a controlled reset point. If a new bundle should restore a baseline shell state, register it in the theme-selection defaults map instead of assuming the manifest alone is enough.
  - Linux/Wayland compositor issues can amplify heavy visuals, but first verify whether the theme switch is leaking old user overrides or whether the base appearance pack itself is doing too much continuous work.

# 2026-04-24 - Andromeda Is The First Canonical Bundle-First Theme

- The repo-root `themes/andromeda/` bundle is now the first full, production-grade bundle-first theme for GreebleFS. It is intentionally the golden example for future authored themes and exercises the normal lane model without requiring any runtime code changes.
- Durable implementation shape:
  - `themes/andromeda/theme.json` orchestrates local bundle ids only and keeps the manifest strictly orchestration-focused.
  - The bundle ships one authored pack for each required core lane: `appearance-packs/appearance-core`, `theme-recipes/recipe-core`, `theme-engines/engine-core`, and `interaction-motion/motion-core`.
  - It also exercises the optional local lanes that matter for the product identity: `top-bars/stellar-bridge`, `icon-themes/andromeda-icons`, `wallpapers/andromeda-halo.svg`, `shaders/andromeda-drift.tsx`, and `animations/andromeda-gate.tsx`.
  - The theme stays on the standard shell runtime instead of introducing a custom renderer. That is deliberate: the reference theme demonstrates how far the current bundle system can go through authored content alone.
- Durable product note:
  - Treat `themes/andromeda/` as the canonical authored example for bundle-local ids, folder names, manifest ownership boundaries, and local asset/module placement until a dedicated starter bundle exists in-repo.
  - The older `src-tauri/themes/*` examples are still useful for aesthetic reference and legacy shape comparison, but future authored themes should prefer the modular pack layout used by Andromeda.
- Validation:
  - passed: `bunx vitest run src/test/andromedaThemeBundle.test.ts --reporter=dot`

# 2026-04-24 - Mobile Share Buttons Now Use A Shared Action-Button Surface With Static Hover Feedback

- The mobile-share flow had drifted away from the shell UI system: the route menu, QR-card actions, settings action row, and pairing-dialog footer were all hand-styled buttons with no consistent hover treatment, and the top-bar phone button relied too heavily on motion-only feedback.
- Durable implementation shape:
  - `src/config/interactionMotion.ts` now defines a dedicated `actionButton` surface under `shellChrome`. This keeps non-top-bar shell actions configurable through the same motion catalog without overloading `topBarButton` or `settingsCard`.
  - `src/components/OverlayActionButton.tsx` is now the shared primitive for shell action buttons outside the top bar. It owns static hover/press visuals, tone/size variants, and `useInteractionMotionController(...)` binding so affordance survives even when interaction motion is disabled.
  - The mobile-share flow now uses that primitive in `src/components/MobileShareRouteMenu.tsx`, `src/components/MobileShareQrDialog.tsx`, `src/components/MobileShareConnectionCards.tsx`, and the mobile action row inside `src/components/SettingsPage.tsx`. Future mobile-share button polish should extend `OverlayActionButton` instead of restyling each surface again.
  - `src/components/WorkbenchTopBar.tsx` now routes compact chrome hover/press visuals through a shared `CompactChromeButton`, so the phone/pair button reads as interactive before any transform/filter motion kicks in.
  - The settings-owned QR dialog had been mounted under the Top Bars section by mistake, which meant `Show QR Codes` from the Mobile section could toggle local state without rendering the dialog. `SettingsPage.tsx` now mounts `MobileShareQrDialog` at the page shell level so the mobile section can always open it.
- Durable product note:
  - Treat motion as additive polish, not as the only affordance. Shared shell buttons must still change border/background/shadow on hover when motion is disabled or reduced.
  - If another settings/dialog/menu workflow needs shell-style buttons, use `OverlayActionButton` and the `actionButton` surface instead of copying inline button styles or reusing `topBarButton`.
- Validation:
  - passed: `bunx vitest run src/test/interactionMotion.test.ts src/test/overlayActionButton.test.tsx src/test/workbenchTopBar.test.tsx src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "OverlayActionButton|interactionMotion.ts|MobileShareRouteMenu|MobileShareQrDialog|MobileShareConnectionCards|WorkbenchTopBar|SettingsPage|overlayActionButton.test|workbenchTopBar.test|settingsPage.behavior.test|interactionMotion.test" || true`

# 2026-04-23 - Deep Research Intake Now Maps Archive Access Policy Back Into The Repo

- `docs/deep-research-report.md` was broad and intentionally repo-agnostic, so the useful pieces were translated into repo-owned guidance instead of treated like a direct implementation spec.
- Durable implementation shape:
  - `src/config/explorerArchives.ts` now stores per-format access summaries, workflow recommendations, and user-facing guidance strings. Archive handling is no longer only suffix-aware; it is also access-aware.
  - `src/components/ExplorerArchivePreview.tsx` now surfaces those access hints in the archive header and marks the recommended extraction path for stream-heavy or compression-first formats.
  - `src/config/accelerationRuntime.ts` now makes the GPU-lane guidance more explicit: direct storage, AI indexing, similarity search, and file hashing all describe coarse-grained or batched acceleration rather than implying CUDA should own tiny metadata work.
  - `docs/architecture/storage-research-alignment.md` now maps the deep-research report back onto the actual GreebleFS architecture, calling out what already exists, what is still missing, and what future agents should not misread as immediate work.
- Durable product note:
  - Treat storage research as routing guidance, not as a command to bolt a speculative new filesystem into the shell. The highest-leverage near-term path is still typed archive/package policy, immutable-pack verification, and native index evolution.
  - Archives in the explorer are read-only virtual surfaces. Format-specific access guidance should live in the archive descriptor registry so future package and packed-image work can reuse the same policy language instead of hardcoding per-component copy.
- Validation:
  - passed: `bunx vitest run src/test/explorerArchives.test.ts src/test/explorerArchivePreview.test.tsx --reporter=dot`

# 2026-04-23 - Settings Now Exposes Modular Theme Bundle Lanes As First-Class Menus

- The bundle-first theme refactor is now surfaced directly in Settings instead of being hidden behind `theme.json` and bundle manifests only. The bottom appearance cluster now has dedicated rail sections for `Appearance Packs`, `Theme Recipes`, `Theme Engines`, and `Shell Renderers`, while `Interaction Motion` also shows the new standalone motion-pack catalog root.
- Durable implementation shape:
  - `src/components/SettingsPage.tsx` now treats the modular theme lanes as first-class catalog sections. Each new section follows the existing authored-catalog pattern: current resolved selection, `Follow Theme` vs `Pinned` mode, standalone/theme-contributed counts, refresh/open-folder actions, warnings/errors, and catalog cards that pin a lane-specific pack id back into `settings.appearance`.
  - `src/store/settingsStore.ts` now persists lane-level pack overrides for `activeAppearancePackId`, `activeThemeRecipeId`, `activeThemeEngineId`, and `activeShellRendererId`. Those overrides remain independent of the active theme bundle, so explicit user pins still win until cleared.
  - `src/App.tsx` now synthesizes temporary theme-bundle override manifests whenever those lane pins are active. The runtime still resolves through the bundle system instead of bypassing it, which keeps downstream `OverlayThemeDefinition` consumers stable while letting Settings pin modular lanes independently.
  - `src/panels/panelRegistry.tsx` now threads the new modular pack catalogs and authoring-root actions into `SettingsPage`, and `src/config/settingsNavigation.ts` includes the new sections in the canonical catalog ordering.
  - `src/test/settingsPage.behavior.test.tsx` now covers the new modular settings lanes by pinning appearance packs, recipe packs, theme engines, and shell renderers through their dedicated sections.
- Durable product note:
  - Treat the global theme as the orchestrator and the new settings sections as lane overrides, not as alternate theme systems. `Follow Theme` means "use the active bundle's effective composed default", even when that default comes through inheritance or embedded synthesized packs.
  - If future bundle lanes become user-pinnable, add them the same way: persist the lane override in `settings.appearance`, synthesize a temporary override bundle in `App.tsx`, and let Settings render the lane from its authored catalog root instead of inventing a second runtime path.
- Validation:
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - blocked currently: `bunx tsc --noEmit --pretty false` still fails only on unrelated mobile-share and mobile test typing drift in `src-mobile/App.tsx`, `src/App.tsx`, and `src/test/mobileApp.test.tsx`

# 2026-04-23 - Queue Intake Now Has A Repo-Local Analyzer And A Dedicated Agent Skill

- GreebleFS now has a durable queue-intake workflow for dragged-in code folders under `queue/`. The queue is intentionally gitignored, but it is not throwaway scratch space: it is the repo-local intake lane for user-owned code that may donate systems into the app.
- Durable implementation shape:
  - `queue/queue.py` is now the authoritative first-pass analyzer. It supports `list`, `check`, `sanitize`, and `move` commands over `queue/staging` and `queue/vault`.
  - The analyzer inventories file counts, line counts, bytes, detected languages, manifest files, and dependencies across common ecosystems (`Cargo.toml`, `package.json`, `pyproject.toml`, `go.mod`, `requirements.txt`).
  - It also builds repo-fit guidance by combining weighted path-token overlap against the live repo with curated adoption seams for contracts, frontend/explorer runtime, and native/GPU lanes, then emits a single report with summary, novelty, repo connections, sanitize findings, and suggested next steps.
  - The sanitize pass is heuristic but intentionally assimilation-focused: it surfaces machine-specific absolute paths, inline endpoints, localhost-only endpoints, magic ports, and candidate-wide brand identifiers that should be abstracted before code is ported into GreebleFS.
  - The current sample candidate, `queue/staging/kos-proto`, now correctly reads as low novelty, surfaces close existing repo references under `packages/KOS/crates/kos-proto`, and points likely adoption review toward `crates/overlay-contracts`, `src-tauri/src/specta_bindings.rs`, `src/generated/tauri.ts`, and explorer/frontend UI-runtime seams instead of forcing a blind repo crawl.
- Durable workflow note:
  - When the user says `check the queue`, future agents should start with `python3 queue/queue.py check` rather than manually traversing the monorepo.
  - Queue contents are explicitly user-owned code and are safe to copy from, but agents should still treat queue folders as selective-salvage candidates, not as greenfield subsystems to import wholesale.
  - If the queue analyzer surfaces `Existing Reference Paths`, treat the candidate as compare-or-salvage, not as automatically novel.
- Skill support:
  - Added `~/.codex/skills/greeblefs-queue`, which teaches agents what `check the queue` means, how to interpret `queue.py`, when to move folders between `staging` and `vault`, and how to route promising candidates into the real GreebleFS architecture.
- Validation:
  - passed: `python3 -m py_compile queue/queue.py`
  - passed: `python3 queue/queue.py check kos-proto --limit 12`
  - passed: `python3 queue/queue.py sanitize kos-proto`
  - passed: `python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py ~/.codex/skills/greeblefs-queue`

# 2026-04-23 - Python Files Now Use Shared Workflow Tabs With Dedicated Run And Runtime Lanes

- Python files no longer feel like plain generic text when opened from the explorer. `FileExplorer.tsx` still keeps them on the shared preview-header workflow system, but `.py`, `.pyw`, and executable/shebang Python scripts now open code-first on `Edit`, hide the generic `Preview` tab, and register `Run | Runtime` wildcard tabs instead of forking a separate header.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now carries explicit `pythonPreview` metadata on text preview state. Python files still resolve through the text preview lane, but the preview shell now knows when to open Monaco edit mode by default and when to mount the Python workbench under wildcard tabs.
  - `src/components/ExplorerPythonWorkbench.tsx` is the new pane-local Python surface. `Run` captures managed-runtime stdout/stderr back into the preview, while `Runtime` exposes runtime refresh, bootstrap, package-queue install, and managed REPL actions without leaving the preview shell.
  - `src/components/terminalCommandUtils.ts` now owns `buildTerminalPythonRunCommand(...)` so Python terminal fallback follows the same shell-aware command-building path as other executable preview actions.
  - `src-tauri/src/python_commands.rs` no longer throws Tauri errors for non-zero script exits. `python_execute` now returns structured `PythonActionResponse` payloads even when the script fails, so the preview workbench can render exit code/stdout/stderr instead of collapsing into a transport error.
  - `src/config/hotkeys.ts` plus `SettingsPage.tsx` now expose `F9` for managed Python run and `Ctrl+F9` for terminal fallback. `FileExplorer.tsx` wires those hotkeys locally, including the Monaco-focused Python editing path.
- Durable product note:
  - Python deliberately stayed on the shared preview-shell model without pretending it needs a rendered preview lane. Keep it code-first with `Edit | Run | Runtime` and add lane-specific actions through wildcard tabs rather than forking a second preview-header system for code files.
  - Executable text previews such as shell, batch, and PowerShell scripts should also stay code-first in the header. Their shared workflow tab order is now `Edit | Run`, with `Run` remaining a real execution action instead of a relabeled fake preview tab.
  - Managed runs are the preview-native path because they can return structured output into the pane. Terminal fallback and managed REPL intentionally route into the explorer embedded terminal bottom drawer so the Python workbench stays visible.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "Python" --reporter=dot --pool=forks`
  - passed: `bunx vitest run src/test/filePreview.test.ts src/test/terminalCommandUtils.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot --pool=forks`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml build_python_action_response_keeps_failed_script_results_structured -- --nocapture`
  - blocked currently: `bunx tsc --noEmit --pretty false -p tsconfig.json` still fails on unrelated mobile/share and settings type errors outside the Python preview lane (`src-mobile/App.tsx`, `src/App.tsx`, `src/components/SettingsPage.tsx`, `src/test/mobileApp.test.tsx`)

# 2026-04-23 - Mobile Share Is Now A Real Four-Tab PWA Shell Backed By A Native Mobile Control Plane

- The old one-screen phone share has been replaced with a proper mobile app shell under `src-mobile/`. The mobile bundle now has first-class `Explorer`, `Search`, `Transfers`, and `Settings` tabs, keeps its own browser-safe navigation/transfer state in `src-mobile/mobileStore.ts`, and still stays deliberately separate from the desktop Tauri session model.
- Durable implementation shape:
  - `src-mobile/App.tsx` now owns a preview-first mobile explorer with paged directory traversal, breadcrumbs, quick filter, upload buttons, preview overlay handling, transfer history, indexed-search tab, and paired-settings diagnostics instead of only rendering one directory list.
  - `src-mobile/mobileApi.ts`, `src-mobile/types.ts`, and `src-mobile/mobileShared.ts` are now the browser-safe contract layer for the PWA. Mobile no longer guesses entry presentation locally; it consumes typed desktop-authored metadata such as entry kind, preview kind, icon ids, thumbnail URLs, and download/open URLs from the host.
  - `src-tauri/src/lan_share/mobile.rs` is no longer a list-only route. It now serves the full mobile control plane: paged listings, theme/icon payloads, preview metadata, thumbnail reads, indexed search status/query/scan control, icon resolution, uploads, and the existing file/range stream lane.
  - `src-tauri/src/lan_share/types.rs` plus `src/config/mobileTheme.ts` now carry a larger mobile theme snapshot that includes desktop-owned icon-theme data and folder-icon rules, so the phone surface inherits the same visual/icon identity as the paired desktop shell.
  - `src-tauri/src/lan_share/handlers.rs` now exposes a shared multipart upload helper so the mobile upload endpoint can reuse the host upload path instead of inventing a second write flow.
- Durable product note:
  - Mobile still has its own session state, tab selection, and transfer queue, but desktop remains the source of truth for theme, icon theme, folder icon rules, thumbnail generation, preview classification, search indexing, and file streaming.
  - Downloads intentionally remain browser-managed final handoffs in v1. The mobile app tracks those actions in its transfer queue, but iOS/browser storage semantics still own the final save location.
  - This is a read-heavy, preview-heavy mobile surface. Editor-grade desktop workbenches are still out of scope for the PWA lane, but preview parity now covers image, video, audio, PDF, text, folder summaries, and archive summaries.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml lan_share::mobile -- --nocapture`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/mobileApp.test.tsx src/test/mobileTheme.test.ts --reporter=dot`
  - passed: `bun run build:mobile`

# 2026-04-23 - Explorer Context Menus Now Use Menu Packs, Typed Runtime Resolution, And A Classic Nested Renderer

- Explorer context menus no longer come from the old flat `CtxItem[]` flow inside `FileExplorer.tsx`. The explorer now resolves menus through four layers: a typed command graph in `src/config/explorerContextMenu.ts`, declarative authored packs in `src/config/menuPacks.ts`, theme presentation hints in `src/config/explorerTheme.ts`, and the runtime/renderer pair in `src/components/explorer/explorerMenuRuntime.ts` plus `src/components/explorer/ExplorerContextMenu.tsx`.
- Durable implementation shape:
  - `FileExplorer.tsx` now builds an `ExplorerMenuInvocationContext` for `entry`, `background`, `multi-select`, `search-result`, and `preview-pane`, then hands that snapshot to `buildExplorerRuntimeMenu(...)` instead of assembling menu JSX inline.
  - `src/config/menuPacks.ts` adds the new managed `menu-packs/` root plus the built-in `GreebleFS Classic Explorer Menu` authored pack. Packs own per-context layout trees, submenus, group slots, quick-slot/fallback placement, and optional renderer hints, but not execution code.
  - `src/store/settingsStore.ts` now persists `settings.explorer.activeMenuPackId` and `contextMenuLayoutOverridesByContext`. Legacy `contextMenuItemOverrides` is kept only as migration input and hydrates forward into the new per-context layout override model.
  - `src/components/SettingsPage.tsx` now exposes a dedicated top-level `Context Menus` settings section with a context-aware `Context Menu Composer`, active-pack selection, per-context renderer selection, command/group-slot/submenu authoring, parent placement, quick slots, fallback buckets, and reset controls. The Explorer section now links into that lane instead of embedding the whole composer inline.
  - `src/components/explorer/ExplorerContextMenu.tsx` is the first production renderer. It ships the classic nested menu path now, and keyboard-opened submenus now remember an anchor rect so the submenu can render instead of only updating hidden state.
- Durable product note:
  - Themes choose how menus look and which renderer family they prefer, but packs choose which commands appear where. Do not collapse menu content back into theme files or component JSX.
  - Only the classic nested renderer is fully shipped in this slice. `hybrid`, `radial`, `sheet`, and `hud` already exist in the schema/runtime as future-capability targets, so new work should preserve those typed paths even if the UI still falls back to `classic`.
- Validation:
  - passed: `bunx vitest run src/test/appContentDirectories.test.ts src/test/settingsStore.test.ts src/test/explorerContextMenu.test.ts src/test/menuPacks.test.ts src/test/explorerMenuRuntime.test.ts src/test/explorerContextMenuRenderer.test.tsx src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-23 - Audio VST Workflow Now Keeps Preview Context And Uses A Live Deck Host

- The audio `VST` workflow no longer hides the playback/waveform preview just because the user switched into plugin tweaking. It now keeps the shared preview-overview surface visible above the plugin lane so transport, scrub state, stats, and waveform context stay in view while VST controls are open.
- Durable implementation shape:
  - `src/components/ExplorerAudioWorkbench.tsx` now renders the same compact preview-overview card in both `Preview` and `VST` workflows. `Edit` still owns trim/fade/export, but `VST` no longer feels like a blank context switch away from the current audio file.
  - `crates/vst-host/src/lib.rs` now exposes live controller-backed parameter snapshots plus `set_parameter_value(...)`, and its parameter records carry current normalized values instead of assuming the default value is the active one forever.
  - `src-tauri/src/audio_engine.rs` now keeps a per-deck live `HeadlessVstHost` alongside the existing deck metadata. Loading a plugin stores that host, and parameter edits now round-trip through the live plugin controller before the deck snapshot is refreshed.
  - `src/test/explorerAudioWorkbench.test.tsx` now locks both user-visible guarantees: the `VST` workflow still shows the audio preview overview, and a parameter control updates through the deck bridge and reflects the new normalized value in the UI.
- Current limitation:
  - This still does not insert VST DSP into the realtime audio render path, and the native editor-session bridge still honestly reports inline attachment as unavailable. The fix here makes the headless control path real and keeps preview context visible, but true inline editor embedding and realtime processing are still separate backend work.
- Validation:
  - passed: `cargo test --manifest-path Cargo.toml -p vst-host -- --nocapture`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - passed: `bunx vitest run src/test/explorerAudioWorkbench.test.tsx --reporter=dot`
  - note: `bunx tsc --noEmit --pretty false -p tsconfig.json` is still blocked by a pre-existing unrelated error in `src/test/explorerContextMenuRenderer.test.tsx` (`'this' implicitly has type 'any'`)

# 2026-04-23 - Mobile QR Pairing Dialog Now Honors Wide Layouts And Viewport Bounds

- The centered phone-pairing surface no longer gets trapped inside the old narrow dialog shell. `src/components/AppModal.tsx` now lets callers provide an explicit `maxWidth`, clamps dialogs to the viewport height, enables dialog-body scrolling when content is tall, and allows action rows to wrap instead of overflowing on tighter DPI-scaled desktops.
- Durable implementation shape:
  - `src/components/MobileShareQrDialog.tsx` now opts into the wider pairing width explicitly (`width/maxWidth = 980`) so the mobile-share dialog can use a horizontal desktop layout when the viewport allows it.
  - `src/components/MobileShareConnectionCards.tsx` no longer hardcodes a rigid two-column card grid with fixed on-screen QR sizing. The shared card surface now uses an auto-fit grid, exposes the cards as an accessible list, and scales the displayed QR artwork down with `clamp(...)` so 2- and 3-route layouts stay inside smaller high-DPI desktop viewports.
  - QR generation still uses the existing 160px source asset from `qrcode`; only the presentation shell became responsive, so scan reliability is preserved while the desktop dialog stops bloating.
- Durable product note:
  - Treat phone pairing as a responsive desktop surface, not a fixed-pixel modal. If future pairing controls are added, keep them inside the shared dialog/card shells and preserve viewport clamping instead of reintroducing hardcoded wide-or-tall assumptions.
  - If a future dialog truly needs to be wider than the default shell, set both `width` and `maxWidth` on `AppDialogFrame`; the default modal contract still stays compact for the rest of the product.
- Validation:
  - passed: `bunx vitest run src/test/workbenchTopBar.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "keeps the live mobile QR cards visible in settings" --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "AppModal.tsx|MobileShareQrDialog.tsx|MobileShareConnectionCards.tsx|workbenchTopBar.test.tsx" || true`

# 2026-04-23 - Preview Panes Now Expose A Shared Drop-Target Contract

- Folder previews no longer rely on one-off row handlers for reverse drag/drop. `src/components/FileExplorer.tsx` now resolves a reusable `ExplorerPreviewDropTarget` from the active preview state, registers it as a real explorer drop surface, and feeds that into `PreviewPanel` so future preview lanes can opt into the same target model instead of inventing their own drag plumbing.
- Durable implementation shape:
  - `src/components/explorer/explorerDragAndDrop.ts` now exports `getExplorerPreviewDropSurfaceId(...)` so preview-target surfaces have stable ids inside the shared explorer drag runtime.
  - `src/components/FileExplorer.tsx` now computes `activePreviewDropTarget`, `previewDropBinding`, and preview-target active state from the existing drag-interaction store. The preview shell root itself owns the drop binding, highlight state, and target messaging, so dragging into a previewed folder routes through the exact same explorer drop-resolution path as folder cards, breadcrumbs, and the viewport root.
  - Transfer success paths now call a shared `refreshExplorerAfterTransferRequest(...)` helper that invalidates affected directories, refreshes the active explorer listing, and bumps a preview refresh revision whenever the previewed folder was either the transfer target or the source parent. That fixed both drag-into-preview and drag-out-from-preview staleness.
  - `src/components/ExplorerFolderPreview.tsx` accepts `refreshRevision` and re-runs its uncached listing effect when the explorer says the previewed folder changed underneath it.
- Durable product note:
  - Treat preview-pane drop support as pane infrastructure, not lane-local behavior. If a future preview wants to accept drops, extend `resolveExplorerPreviewDropTarget(...)` and let `PreviewPanel` inherit the same shell-level binding and visual treatment.
  - Refreshing previewed directories after transfer work belongs in the shared post-transfer helper, not in individual drag handlers. Otherwise preview rows will drift stale the next time a folder preview is both a drag source and a drag destination.

# 2026-04-23 - Explorer Now Shares One Embedded Terminal Between Preview And A Bottom Drawer

- The explorer-local embedded terminal no longer lives only inside the preview pane. Each `FileExplorer` instance now owns one reusable embedded terminal session that can surface either in the preview lane or as a bottom drawer above the explorer status area.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now keeps explorer-local terminal state in placement-aware form instead of preview-only booleans. The explorer owns `mounted`, `visible`, `placement`, pending command injection, reported cwd sync, focus request sequencing, and bottom-drawer height for one shared embedded terminal session.
  - The preview-pane terminal is no longer rendered inline inside `PreviewPanel`. `FileExplorer.tsx` now mounts one shared `ExplorerEmbeddedTerminalLayer` that reuses the same `TerminalOverlay` instance for both `preview` and `bottom` placement, so moving between surfaces does not create a second terminal session.
  - Script-preview runs still force the explorer terminal into `preview` placement, but the new explorer bottom drawer can be opened independently from the status bar or `Ctrl+J`. `Ctrl+Alt+T` remains preview-specific.
  - `src/components/TerminalOverlay.tsx` now accepts an optional `focusRequestKey` so parent surfaces can explicitly refocus the active xterm pane without tearing down the terminal session.
  - `src/config/explorerChromeLayouts.ts` now registers `terminalDrawerToggle` as a built-in chrome control on `explorerStatusBar`, which keeps the new bottom-terminal trigger layout-driven instead of hardcoding another footer button.
  - `src/config/hotkeys.ts` still keeps `terminalFocus = Ctrl+J`, but the description now reflects the explorer-local override path for the bottom drawer.
- Durable product note:
  - Treat the explorer embedded terminal as one movable surface, not as separate preview and footer terminals that must be synchronized. If future work adds more explorer terminal placements, it should still preserve one explorer-local session and move the mounted terminal between authored shells.
  - The bottom drawer trigger belongs in chrome layout/config, not in bespoke `FileExplorer` footer markup. Future modular shell work should keep terminal accessors data-driven through the explorer chrome registry.
- Validation:
  - passed: `bunx vitest run src/test/explorerChromeLayouts.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - passed: targeted `src/test/fileExplorer.viewModes.test.tsx` coverage for preview terminal toggle, script-run preview terminal, bottom drawer button, preview/bottom session reuse, `Ctrl+J` reveal, and cwd-sync navigation
  - note: full `bunx tsc --noEmit -p tsconfig.json` is still blocked by unrelated pre-existing errors in explorer menu/context-menu typing, `config/menuPacks.ts`, and other existing branch issues outside this bottom-drawer slice

# 2026-04-23 - Storage Tab Now Has Indexed Jump In Current Context And Its Inspector Scroll Owns The Pane

- The storage workbench no longer feels trapped in the matrix when you move into the inspector side. The right-hand lane now has an explicit `Current Context` surface with its own scroll boundary, and it can use the new Everything-style global index to jump around the active storage scope quickly.
- Durable implementation shape:
  - `src/components/StoragePanel.tsx` now splits the inspector into a `Selection` card plus a `Current Context` card. The current-context card owns its own `auto + minmax(0, 1fr)` layout, keeps the preview/results viewport clipped to the inspector lane, and routes its scroll through dedicated overlay scroll hosts instead of relying on outer panel overflow.
  - The indexed-jump path is now scoped natively instead of querying the whole index and trimming in React. `src-tauri/src/global_search/query.rs` adds `global_search_query_under_path(...)`, `src/runtime/tauriClient.ts` exposes the raw Tauri bridge for it, and `src/runtime/globalSearchBackend.ts` now gives the storage lane a direct "query under this path" helper.
  - `src/components/StoragePanel.tsx` now debounces the current-context search with the shared global-search debounce policy and calls that native scoped query directly, so the storage lane no longer does whole-index work on every keystroke just to search a subtree.
  - Clicking an indexed result now reveals it back into the storage matrix by expanding and loading the ancestor directory chain before selecting the target path. That reveal/routing math lives in `src/components/storage/storageWorkbench.ts` through the new root-membership and ancestor-chain helpers, so the panel does not hand-roll path ancestry logic inline.
  - The inspector still falls back to the existing directory preview shell when no search query is active. File selections keep their action-oriented summary state there instead of trying to fake a heavy inline file preview for the storage lane.
- Durable product note:
  - Keep storage scan truth and indexed filename search distinct. The storage scan still owns allocated/logical bytes, subtree shares, treemap state, and type buckets; the global index is now the fast navigation layer for jumping around that scanned truth.
  - The inspector lane should remain an independent scroll surface. Regressions that make wheel/trackpad input leak back into the main matrix again are storage-lane bugs, not explorer-preview niceties.
- Validation:
  - passed: `bunx vitest run src/test/storageWorkbench.test.ts src/test/storagePanel.layout.test.tsx --reporter=dot`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml global_search -- --nocapture`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "StoragePanel.tsx|storageWorkbench.ts|globalSearchBackend.ts|tauriClient.ts|storagePanel.layout.test.tsx|storageWorkbench.test.ts" || true`
  - note: full `bunx tsc --noEmit --pretty false -p tsconfig.json` is currently blocked by unrelated pre-existing errors in `App.tsx`, `WorkbenchTopBar.tsx`, `FileExplorer.tsx`, `SettingsPage.tsx`, `settingsStore.ts`, and missing `config/explorerContextMenu` imports outside this storage/global-search slice

# 2026-04-23 - Mobile Share Chrome Now Uses A Route Menu Plus Centered QR Pairing Surface

- The clipped top-bar QR hover is gone. Mobile share now uses a two-step shell flow: hover the phone control to open a compact route/control menu, then launch a centered pairing dialog for the actual QR cards. The Settings page now keeps the same live QR cards visible inline so phone pairing no longer depends on the top-bar chrome at all.
- Durable implementation shape:
  - `src/components/MobileShareRouteMenu.tsx` is now the anchored chrome menu for the phone button. It lets the user switch the selected route between `Local LAN` and `Tailscale`, start/restart/stop the live share, open the centered QR surface, and jump into the Mobile settings section.
  - `src/components/MobileShareQrDialog.tsx` plus `src/components/MobileShareConnectionCards.tsx` now own the real pairing surface. QR generation stays in React via `qrcode`, but the cards themselves are now a reusable component shared between the dialog and Settings.
  - `src/components/WorkbenchTopBar.tsx` no longer renders QR cards inside the bar. It opens only the route menu from chrome hover, flips shell overflow just for that menu, and launches the centered `Phone Pairing` dialog when the user requests QR codes.
  - `src/components/SettingsPage.tsx` now includes a persistent `Pairing Codes` block in the `Mobile` section. When a live share exists, the QR cards stay visible inline. When there is no live share yet, the section still reserves the same surface with a clear start-share call to action instead of hiding pairing behind hover chrome.
  - `src/App.tsx` now passes dedicated mobile-share actions into the top bar: silent start/stop handlers for chrome-driven flows and a direct remote-access-mode setter so the phone menu can update the selected route without reusing the alert-heavy command-palette action path.
  - `src/config/mobileAccess.ts` now treats the top-bar mobile hover as a lightweight menu open (`mobileShareMenuHoverDelayMs = 180`) instead of a 1+ second QR reveal.
- Durable product note:
  - Keep the top bar focused on route/status/control, not on rendering large pairing content. QR cards are now intentionally modal or settings-resident surfaces.
  - The top bar and Settings page should keep using the same QR card component so labels, preferred-route badging, copy/open actions, and future pairing polish do not drift.
- Validation:
  - passed: `bunx vitest run src/test/workbenchTopBar.test.tsx src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/app.dockMode.test.tsx -t "toggles the mobile share from the local keybinding" --reporter=dot`
  - note: full `bunx tsc --noEmit --pretty false -p tsconfig.json` is still blocked by unrelated pre-existing explorer context-menu/menu-pack typing errors on this branch

# 2026-04-23 - Mobile Share Hover QR Now Renders Reliably And Can Show Tailnet Beside LAN

- The phone button hover flow already had QR generation through the `qrcode` package, but the popover could still appear missing because the top-bar shell clipped absolutely positioned children and LAN-mode shares only surfaced a tailnet route when Tailscale mode was explicitly selected.
- Durable implementation shape:
  - `src/components/WorkbenchTopBar.tsx` now opens the actual top-bar shell overflow while the mobile popover is visible, instead of leaving the root chrome clipped. The panel menu keeps its own overflow behavior; the mobile share popover is the only thing that temporarily escapes the shell bounds.
  - `src-tauri/src/lan_share/server.rs` now opportunistically resolves a Tailscale target even when the selected mobile access mode is `lan`. That keeps LAN as the preferred route while still allowing the hover popover to show a second tailnet QR card when the desktop is already connected to Tailscale.
  - `src/config/mobileAccess.ts` lowered the hover-open delay to `1200ms`, which is still deliberate but much less likely to feel broken than the previous 3-second wait.
  - `src/test/workbenchTopBar.test.tsx` now covers the actual QR lane instead of only checking for popover text. The test mocks QR generation, verifies the top bar flips to `overflow: visible` once the hover popover opens, and asserts that both the LAN HTTPS and Tailnet QR images render.
- Durable product note:
  - Keep QR generation in the React popover layer unless the backend eventually needs printable/exportable QR artifacts for other surfaces. The browser already has the exact URLs and theme context needed for the current handoff flow.
  - The mobile popover should prefer the configured route, but it should still surface alternate reachable paths when they are already available. That is especially useful for “scan locally now, use tailnet later” pairing flows.
- Validation:
  - passed: `bunx vitest run src/test/workbenchTopBar.test.tsx --reporter=dot`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - note: full `bunx tsc --noEmit --pretty false -p tsconfig.json` is currently blocked by unrelated pre-existing `src/components/StoragePanel.tsx` errors on this branch

# 2026-04-23 - Preview-Row Dragging Now Uses The Explorer Pointer Runtime And Supports Ctrl Multiselect

- Folder-preview and archive-preview rows no longer behave like ad hoc mini-buttons that immediately kick off their own bespoke drag-out path. Their selection and drag-start behavior now matches the flagship explorer more closely.
- Durable implementation shape:
  - `src/components/useExplorerPreviewEntryDirectDrag.ts` is no longer just a threshold-to-callback helper. It now owns preview-row ctrl/meta multiselect state, click suppression after drag start, and grouped drag-request payloads (`entry` + `entries` + pointer/modifier metadata) so both preview lanes share one interaction model.
  - `src/components/ExplorerFolderPreview.tsx` and `src/components/ExplorerArchivePreview.tsx` now route row clicks through that shared hook, expose pressed/selected row styling, keep ctrl/meta clicks local to selection instead of opening/navigating, and start drags with the full selected set when the dragged row is already selected.
  - `src/components/FileExplorer.tsx` now consumes preview drag requests through the same explorer pointer-drag runtime used by the main file list. Preview rows build an `ExplorerInternalPointerDragCandidate`, feed the shared drag overlay/runtime, and only fall back to native-out when the dragged sources are archive-virtual or the user explicitly requests native-out through the existing intent rules.
  - Folder-preview drags now stay on the app-owned internal drag system by default, which means dropping a preview row onto explorer targets uses the existing internal transfer path instead of trying to initiate a browser/HTML-style drag.
- Durable product note:
  - Treat preview rows as secondary explorer surfaces, not as standalone HTML drag widgets. If preview-row drag behavior changes later, route it through the same shared pointer/runtime contract as the main explorer list instead of inventing another drag subsystem inside the preview pane.
  - Ctrl/meta multiselect in preview lanes is intentionally local selection state. It should not open/navigate rows, and dragging any selected row should carry the whole selected set.
- Validation:
  - passed: `bunx vitest run src/test/explorerFolderPreview.test.tsx src/test/explorerArchivePreview.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/explorerFolderPreview.test.tsx src/test/explorerArchivePreview.test.tsx src/test/fileExplorer.viewModes.test.tsx -t "supports ctrl multiselect in preview rows and drags the full selected set without opening|supports ctrl multiselect in archive preview rows and drags the full selection without opening|routes folder preview row drags through the app-owned explorer drag runtime" --reporter=dot --pool=forks`
  - note: full `bunx tsc --noEmit --pretty false -p tsconfig.json` is currently blocked by an unrelated `src/components/MobileShareRouteMenu.tsx` `QrCode` import error outside this slice
  - passed: touched-file type surface grep for `ExplorerFolderPreview|ExplorerArchivePreview|useExplorerPreviewEntryDirectDrag|FileExplorer|fileExplorer.viewModes|explorerFolderPreview|explorerArchivePreview`

# 2026-04-23 - Archives Now Browse As Read-Only Virtual Folders With Direct Drag-Out

- Archive files no longer need to be fully extracted before they feel explorable. Opening a supported archive now enters a `greeblefs://archive?...` location from the current explorer cwd, and the preview pane can drag individual files out on demand.
- Durable implementation shape:
  - `src/config/explorerArchives.ts` is now the TS source of truth for archive virtual paths, parent-path resolution, breadcrumb segments, and human labels for archive roots/current folders.
  - `src-tauri/src/archive_ops.rs` plus `src-tauri/src/fs_commands.rs` now expose typed archive directory listing and per-entry materialization. The Rust layer can stage a single file/folder temporarily, extract the current archive folder here, extract to a new folder, or extract to an explicit selected directory.
  - `src/runtime/explorerBackend.ts` now treats archive virtual locations as a first-class explorer listing kind and adds the `listArchiveDir(...)` plus `materializeArchiveEntry(...)` bridge used by the shell.
  - `src/components/FileExplorer.tsx` now opens supported archive files by navigating into the archive virtual route instead of immediately expanding the whole archive into cache-backed output. Nested archives inside an archive are staged temporarily, then reopened as their own archive virtual route.
  - Archive-backed previews now keep two paths in play: the logical archive path for explorer identity/selection/history, and a staged real filesystem path for actual readers/editors/players when bytes must be materialized.
  - `src/components/ExplorerArchivePreview.tsx` now renders from the typed archive-listing bridge, and both `ExplorerArchivePreview.tsx` and `ExplorerFolderPreview.tsx` support direct drag-out from preview rows via `src/components/useExplorerPreviewEntryDirectDrag.ts`.
  - Explorer chrome now exposes an `archiveActions` toolbar control when the current location is an archive virtual folder. It lets the user extract the current virtual folder here or to a new folder, with optional trashing of the source archive after extraction. Matching hotkeys live in `src/config/hotkeys.ts` (`Ctrl+Alt+E` and `Ctrl+Alt+Shift+E`).
  - Archive virtual locations are treated as read-only shells. `FileExplorer.tsx` now blocks mutation verbs and inbound drop targets there, and archive contents must leave the archive through direct drag-out, OS open, or explicit extract actions instead of copy/move/rename/paste.
- Durable product note:
  - Preserve the “virtual folder first, materialize on demand” model. The user should be able to navigate archives like normal folders, but the app should not silently spill archive contents into the working directory just to browse them.
  - Keep logical archive paths stable in explorer state even when a preview/editor needs a staged real path underneath. Losing the logical path breaks breadcrumbs, selection, history, and the ability to return to the same archive entry after staging.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml archive -- --nocapture`
  - passed: `bunx vitest run src/test/explorerArchivePreview.test.tsx src/test/explorerFolderPreview.test.tsx src/test/explorerBackend.bindings.test.ts src/test/hotkeys.test.ts --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-23 - Explorer Drag Hover Now Opens Folder Glyphs, Autoscrolls The Viewport, And Carries Real Stack Previews

- The premium drag pass now has the three missing interaction pieces: destination folders feel alive before navigation, long lists can scroll under an active drag, and multi-file drags show a more truthful bundle preview.
- Durable implementation shape:
  - `src/config/explorerDragInteractions.ts` now owns the authored drag-autoscroll and folder-inhale tuning, not just dwell timing. Edge size, activation outset, min/max autoscroll speed, and folder icon/stage inhale scales all live there as explorer interaction constants.
  - `src/components/FileExplorer.tsx` now drives internal drag autoscroll from the app-owned pointer runtime. While an internal drag is active near the top or bottom of the file viewport, the scroll area advances on `requestAnimationFrame`, updates `scrollTop`, and re-resolves the drop hit under the stationary pointer so the target/highlight track the scrolled content instead of freezing.
  - Folder hover-open is now expressed through the real icon/theme path instead of a fake one-off animation. Entry renderers in the main explorer views use the drag target/dwell state to request the open-folder icon variant and a stronger icon-stage inhale/lift when a folder is the active drag destination.
  - `src/components/explorer/explorerDragAndDrop.ts` now carries a small `sourceStackItems` preview payload in the shared drag state, and `src/components/explorer/ExplorerDragOverlay.tsx` uses that payload to render richer multi-file avatar stacks with real per-item preview icons instead of anonymous paper layers only.
- Durable product note:
  - Internal drag autoscroll is intentionally owned by the explorer pointer runtime, not by DOM drag events. Keep it tied to the app-owned internal drag path unless external/native drags prove they need the same treatment.
  - Folder hover “alive” feedback should continue to come from the actual open-folder glyph path plus subtle stage motion. Do not replace it with generic scale/glow-only effects that ignore the icon theme system.
- Validation:
  - passed: `bunx vitest run src/test/ExplorerWorkspace.test.tsx src/test/fileExplorer.viewModes.test.tsx -t "starts pointer-driven internal explorer drags without invoking the native drag bridge|moves multi-selected files into the hovered folder without leaking the drop to the viewport root|drops into the current folder when hovering explorer chrome outside the main file plane|mounts the shared drag overlay during normal live workspace panes|auto-opens hovered folder targets once after dwell" --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-23 - Explorer Drag Presentation Is Now App-Owned, Visible, And Non-Destructive To Layout

- Internal explorer drag truth still stays pointer-driven and app-owned, but the presentation layer is now first-class instead of piggybacking on browser drag visuals.
- Durable implementation shape:
  - `src/components/explorer/explorerDragAndDrop.ts` now carries presentation metadata alongside drag truth so the overlay, hover highlights, and dwell-progress surfaces all read from one runtime instead of local component state.
  - `src/components/explorer/ExplorerDragOverlay.tsx` is now the shared drag avatar layer. It renders a visible stacked internal-drag card, uses the shared runtime for phase/target state, treats same-folder no-ops as a neutral themed `No change` state instead of a danger/error look, and keeps initial lift in a neutral “choose a destination” state instead of falsely showing an invalid drop.
  - `src/components/explorer/ExplorerWorkspace.tsx` now mounts the drag overlay host unconditionally for live panes. The old invisible-drag bug came from the overlay only existing in the pane-unavailable branch.
  - `src/components/FileExplorer.tsx` keeps folder/file panes as transport surfaces only, but now ghosts drag sources, highlights hovered folder targets, and renders the current-folder / external-import scope indicators as absolute overlay chrome inside the explorer plane instead of sticky in-flow banners. That prevents drag affordances from pushing list/table content down during active drag.
  - `src/components/explorer/ExplorerSideRail.tsx` and workspace tabs consume the same dwell/highlight state so rail folders, breadcrumbs, and tabs all share one interaction model.
  - `src/config/explorerDragInteractions.ts` now owns the authored drag timing defaults. Folder auto-open is deliberately slower than the first pass (`directory-target` 950ms, `navigation-target` 900ms, tabs 1050ms) so hover-open requires deliberate intent instead of twitchy flyovers.
- Durable product note:
  - Keep drag routing and drag presentation separate. The explorer runtime decides what move/copy/no-op means; the overlay/highlight system is just the visual expression of that truth.
  - Scope-root/current-folder drag feedback must stay overlay-only. Do not reintroduce sticky/in-flow banners that change list geometry while the user is dragging, because that can shift destinations under the pointer.
- Validation:
  - passed: `bunx vitest run src/test/ExplorerWorkspace.test.tsx src/test/fileExplorer.viewModes.test.tsx -t "starts pointer-driven internal explorer drags without invoking the native drag bridge|moves multi-selected files into the hovered folder without leaking the drop to the viewport root|drops into the current folder when hovering explorer chrome outside the main file plane|mounts the shared drag overlay during normal live workspace panes|auto-opens hovered folder targets once after dwell" --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-23 - Mobile PWA Now Mirrors The Desktop Theme And Registers A Real Service Worker

- The mobile share is no longer visually orphaned from the main shell. It now pulls a paired theme snapshot from the desktop host and applies it to the phone UI, while also registering a service worker so the Home Screen install path is a real PWA lane instead of just a manifest bookmark.
- Durable implementation shape:
  - `src/config/mobileTheme.ts` is now the shared TS contract for the phone-facing theme snapshot. It derives a compact mobile-safe payload from `ResolvedOverlayAppearance`: theme identity, font families, palette colors, workbench radii/spacing, and the shell shadow.
  - `src/runtime/mobileShareThemeRuntime.ts` keeps the active mobile theme snapshot in the desktop frontend and syncs it to the native host through the new `mobile_share_set_theme_snapshot` command. `src/App.tsx` now updates that snapshot whenever the resolved desktop appearance changes, so the active shell theme becomes the source of truth for the mobile share.
  - The native host now stores and serves that snapshot:
    - `src-tauri/src/share_commands.rs` exposes `mobile_share_set_theme_snapshot`
    - `src-tauri/src/lan_share/types.rs` owns the serializable `MobileThemeSnapshot` plus the process-global active snapshot
    - `src-tauri/src/lan_share/mobile.rs` now serves `GET /api/theme`
  - `src-mobile/App.tsx` now fetches `/api/theme`, applies the returned colors/fonts/metrics as CSS variables, refreshes the paired theme on an interval + visibility resume, and surfaces standalone-mode state (`Home Screen App` vs `Safari Preview`) in the phone UI.
  - `src-mobile/public/sw.js` plus the registration in `src-mobile/main.tsx` give the mobile bundle a real app-shell service worker. It caches the shell paths/assets, keeps navigation working offline for the cached shell, and deliberately leaves `/api/*` and `/files/*` on the live network path.
  - `src-mobile/public/manifest.webmanifest` already had `display: "standalone"` before this pass; it now also includes `id` and `display_override`, while `src-mobile/index.html` continues to carry the Apple web-app meta tags.
- Durable product note:
  - The mobile UI now shares the desktop theme mood, but it is still a curated mobile surface, not a 1:1 CSS transplant of the desktop shell. Keep using theme snapshots and mobile-owned layout treatment instead of trying to render the full desktop chrome on iPhone.
  - The service worker is intentionally shell-focused. Do not cache file-stream responses or directory APIs aggressively there; the desktop engine remains the live source of truth for file listings and range-streamed media.
- Validation:
  - passed: `bun run build:mobile`
  - passed: `bunx vitest run src/test/mobileTheme.test.ts src/test/workbenchTopBar.test.tsx src/test/app.dockMode.test.tsx --reporter=dot`
  - note: full `bunx tsc --noEmit --pretty false -p tsconfig.json` is still blocked by unrelated pre-existing explorer/generated binding errors outside this slice
  - note: full `cargo check --manifest-path src-tauri/Cargo.toml -q` is still blocked by unrelated pre-existing `src-tauri/src/archive_ops.rs` errors outside this slice

# 2026-04-23 - The Top-Bar Blur Toggle Is Now The Mobile Share Launcher

- The old blur button in the global top bar is gone. Mobile share is now a first-class shell control instead of being buried behind Settings or the command palette.
- Durable implementation shape:
  - `src/components/WorkbenchTopBar.tsx` now treats the former blur slot as `mobile-share`. The control renders a phone glyph, uses the active theme accent when the share is live or transitioning, toggles the current mobile route on click, and opens a delayed QR popover on hover.
  - `src/config/topBars.ts` now has a real `mobile-share` control id and normalizes the legacy `blur-toggle` id to it so existing layouts/themes keep working without hand migration.
  - `src/runtime/mobileShareRuntime.ts`, `src/store/mobileShareStore.ts`, and `src/components/MobileSharePopover.tsx` form the shared mobile-share lane:
    - runtime resolves the actual share path, enforces Tailscale readiness when that route is selected, starts/stops the native share, and derives usable connection targets
    - store owns cross-surface phase/session/error/notice state so the top bar, Settings, command palette, and boot flow all stay in sync
    - popover renders nearby QR handoff cards plus copy/open/settings affordances for LAN and tailnet targets
  - `src/App.tsx` no longer owns ad hoc mobile-share state. It now uses the shared store/runtime for command-palette actions, the new local hotkey, and the boot-autostart path.
  - `src/components/SettingsPage.tsx` now reflects the shared mobile state instead of maintaining its own duplicate pending/error/status state, and it exposes the new `Start Mobile Share On Boot` system toggle.
  - `src/config/hotkeys.ts` adds `mobileShareToggle`, and Settings now exposes it in the main shell hotkeys section instead of hiding it as an unreachable local-only binding.
  - `src/store/settingsStore.ts` persists `system.startMobileShareOnBoot`, defaulting to `false`.
- Durable product note:
  - Mobile share is now shell chrome, not a hidden utility. Future mobile work should extend the shared runtime/store/popover path instead of reintroducing one-off start/stop logic in Settings or palette actions.
  - The top-bar hover contract is intentional: click is the quick toggle, hover is the pairing/QR affordance. If this changes later, preserve that separation instead of turning the launcher into another passive status icon.
- Validation:
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/workbenchTopBar.test.tsx src/test/hotkeys.test.ts src/test/settingsStore.test.ts src/test/app.dockMode.test.tsx src/test/settingsPage.behavior.test.tsx --reporter=dot`

# 2026-04-23 - Restored The CropperJS Image Editor And Removed The Runtime Package Seam

- The shared explorer/screenshot image editor is back on the correct implementation. The intermediate `@img-editor-runtime` / `packages/img-editor` swap was wrong for this product; the intended editor is the custom CropperJS-based lane with the exposure/filter panel and preview-first fullscreen image surface.
- Durable implementation shape:
  - `src/components/ExplorerImageEditor.tsx` now again owns the CropperJS preview/edit flow: fullscreen pannable/zoomable preview in `Preview` mode, filter/exposure controls plus crop session in `Edit`, save-time filter baking, static fallback for unsupported formats, and an imperative `save / hasUnsavedChanges / resetToSavedState` surface so `ScreenshotsManager.tsx` can keep sharing the same editor component.
  - `ScreenshotsManager.tsx` still uses the screenshot plugin capture pipeline, but its editing phase is now once again the shared CropperJS editor instead of the abandoned runtime package wrapper.
  - Removed the dead runtime integration seam by deleting `src/runtime/imageEditorRuntime.ts`, deleting `src/types/imgEditorRuntime.d.ts`, and removing the `@img-editor-runtime` alias from `vite.config.ts` so future work does not drift back toward the wrong editor stack.
  - Re-added `cropperjs` plus `@types/cropperjs` to the workspace dependencies because that package had been dropped when the runtime-package detour landed.
- Durable product note:
  - The screenshot capture backend and the screenshot editor are separate decisions. Keep `tauri-plugin-screenshots` for fast file-backed capture, but keep CropperJS as the shared explorer/screenshot editing surface unless the product explicitly replaces the filter/crop UX with something better.
- Validation:
  - passed: `bunx vitest run src/test/explorerImageEditor.test.tsx src/test/screenshotsManager.test.tsx --reporter=dot`
  - passed: filtered `tsc --noEmit -p tsconfig.json` grep reported no touched-file errors for `ExplorerImageEditor`, `cropperjs`, `imgEditorRuntime`, or `vite.config.ts`

# 2026-04-23 - Mobile Settings Now Own Tailscale-Aware Remote Share Routing

- The sovereign mobile PWA is no longer hard-wired to LAN-only launch assumptions. There is now a first-class `Mobile` settings slice plus a native Tailscale command surface so the desktop can prefer a tailnet URL when launching the mobile share.
- Durable implementation shape:
  - Added `src-tauri/src/tailscale_commands.rs` as the native Tailscale integration layer. It owns CLI status reads (`tailscale status --json` / `tailscale version --json`), best-effort connect/disconnect flows, and the helper used by `lan_share` to resolve a tailnet host plus HTTPS certificate domain.
  - `src-tauri/src/lan_share/server.rs` and `src-tauri/src/share_commands.rs` now accept a remote-access mode for mobile shares. LAN launches keep the old local-IP/mDNS behavior, while Tailscale launches prefer a tailnet URL and attempt to load a Tailscale-issued certificate with `tailscale cert` when the tailnet is HTTPS-ready.
  - `src/config/mobileAccess.ts` is now the TS source of truth for the mobile remote-access modes (`lan` / `tailscale`) plus the small set of external docs/installation links used by Settings.
  - `src/store/settingsStore.ts` now persists `settings.mobile.remoteAccessMode`, `settings.mobile.tailscaleLoginServer`, and `settings.mobile.tailscaleHostname`, and `src/config/settingsNavigation.ts` adds the new `Mobile` settings section.
  - `src/components/SettingsPage.tsx` now exposes the operator-facing mobile control surface: launch mode selection, Tailscale status, hostname/control-server fields, an ephemeral auth-key field, connect/disconnect/refresh actions, and inline start/stop mobile-share actions that reuse the current explorer folder.
  - `src/App.tsx` command-palette mobile share launch now reads `settings.mobile.remoteAccessMode` and uses the backend-provided `preferred_address` instead of guessing between LAN URLs in the frontend.
- Durable product note:
  - Treat this as the accountless remote-access control plane for the mobile PWA, not as a replacement for Tailscale itself. The desktop host still depends on the local Tailscale daemon/CLI for transport identity and HTTPS certificate issuance.
  - The current Tailscale integration is intentionally CLI-driven and desktop-first. It is good enough for built-in pairing/launch routing and remote share delivery, but deeper automation such as fully headless onboarding, QR-led VPN profile install, or relayless custom transport still belongs in a later pairing/discovery phase.
- Validation:
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/settingsStore.test.ts src/test/settingsPage.behavior.test.tsx`
  - passed: `bun run build`

# 2026-04-23 - Cloud OAuth Credentials Can Now Be Bundled From Ignored Env Files

- Google Drive / Dropbox sign-in already existed through the native cloud runtime, but shipping app-owned OAuth credentials still depended on per-user Settings or ad hoc runtime environment variables. That is now fixed for local/release builds.
- Durable implementation shape:
  - `src-tauri/build.rs` now scans ignored `.env` / `.env.local` files in the repo root and `src-tauri/`, plus any real process environment values, for the `GREEBLE_*` cloud OAuth keys and forwards them into the Tauri build with `cargo:rustc-env`.
  - `src-tauri/src/cloud_commands.rs` now treats those compile-time values as the environment-backed provider configuration fallback after saved Settings credentials, so built apps can open the browser-based Google Drive auth flow without asking each user to paste a client ID first.
  - `src/components/SettingsPage.tsx` now labels that source as `Bundled / Environment` and explicitly tells operators that ignored `.env` files can seed build-time credentials while still allowing per-machine overrides in Settings.
  - Added `.env.example` as the canonical template for the supported cloud provider keys. The real `.env` stays ignored so live secrets do not enter git.
- Durable product note:
  - Build-time bundled OAuth credentials are appropriate for shipping one app-owned Google/Dropbox client to many users, but saved Settings credentials still deliberately override the bundled defaults. Clearing a saved provider config should fall back to the bundled build credentials again.
- Validation:
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "saves cloud provider credentials from settings and enables the provider login action" --reporter=dot`

# 2026-04-23 - Shell Transition Motion Now Starts Disabled Until The User Opts In

- First-run `Ctrl+Space` no longer inherits theme open/close motion automatically. The persisted `appearance.animations` default is now `false`, and the runtime fallback in `App.tsx` treats missing legacy values as disabled instead of enabled.
- Durable implementation shape:
  - `src/store/settingsStore.ts` now seeds shell transition motion off by default and normalizes the `appearance.animations` flag explicitly instead of letting malformed imported data bleed through.
  - `src/components/SettingsPage.tsx` now exposes a dedicated `Enable Shell Transition Motion` toggle inside `Animations`, plus copy that explains the current business-focused default and that theme/default open-close bindings are merely parked while disabled.
  - Theme defaults and per-user `appOpenAnimation` / `appCloseAnimation` overrides are intentionally preserved while the toggle is off. Re-enabling motion resumes the selected theme/default choreography without forcing the user to re-pick modules.
- Durable product note:
  - Treat shell transition motion like the shader lane's performance-off default: a theme can still advertise rich motion, but the shell should not force that first impression. If future enterprise-facing presets need a calmer baseline, prefer this central gate over stripping motion data out of themes.
- Validation:
  - passed: `bunx vitest run src/test/settingsStore.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-23 - Folder And Archive Preview Rows Now Use Icon-Theme Glyphs Instead Of Generic Preview Icons

- Explorer preview-pane folder listings and archive listings no longer render generic Lucide file/folder placeholders for every row.
- Durable implementation shape:
  - Added `src/components/explorerPreviewEntryIcons.tsx` as the shared helper for preview-pane row icons. It resolves file glyphs through the active icon theme, resolves folder glyphs through the explorer folder-icon rules/default folder icon, and normalizes archive entry metadata before the lane renders.
  - `src/components/ExplorerFolderPreview.tsx` now renders icon-theme-backed row icons for folder contents and uses the same folder-icon configuration for its header/empty states. This lane still only calls `listExplorerDirUncached(...)`; it does not trigger thumbnail/native-preview generation.
  - `src/components/ExplorerArchivePreview.tsx` now infers archive row metadata from the inspected archive path list, detects directory rows from explicit separators plus parent-path hints, and renders folder/file icons through the same helper instead of a one-size-fits-all `FileSearch` glyph.
  - `src/components/FileExplorer.tsx` now passes the active `themeIconTheme`, `folderIconRules`, and `defaultFolderIcon` into both preview lanes so the preview pane stays aligned with the explorer’s current icon-theme/folder-icon setup.
- Durable product note:
  - Treat folder/archive preview row icons as icon-theme territory, not thumbnail territory. If future work wants richer preview chrome here, keep these lanes on managed icon resolution unless the user explicitly opts into heavier preview generation.
  - Archive directory detection is heuristic because `fs_inspect_archive(...)` returns paths, not typed entry metadata. The current rule is: explicit trailing slash/backslash wins, otherwise any path that is a parent of another archive entry is treated as a directory.
- Validation:
  - passed: `bunx vitest run src/test/explorerArchivePreview.test.tsx src/test/explorerFolderPreview.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "shows folder contents in preview pane when a folder is single-clicked in double-click mode" --reporter=dot --pool=forks`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-23 - Root Home Packs Now Ship Two Showcase Reference Packs

- The managed `home-packs/` root is no longer empty. It now contains two authored reference packs meant to prove the upper bound of the Home-pack runtime rather than act like throwaway demos:
  - `home-packs/atlas-cockpit/`
    Dense operator wall with telemetry-first layout, quick-target grid, launchpad actions, task center, saved-search rack, and drive/root pressure matrix.
  - `home-packs/prism-switchboard/`
    Editorial card-switcher surface with persistent deck selection, mood-based styling, hero destination cards, launch routes, and optional telemetry strip.
- Durable implementation shape:
  - Both packs follow the authored-pack contract introduced with the Home runtime: `home.json` manifest plus `index.tsx` entry exporting `homePack = defineHomePack(...)`.
  - Both packs intentionally exercise the constrained host API instead of reaching around it: bookmarks, quick access, most-used/recent telemetry, saved searches, drives, task-center state, launchpad actions, `openPanel(...)`, `openSettingsSection(...)`, `navigate(...)`, `refresh()`, and `updatePackState(...)`.
  - Pack-local settings are part of the reference story. `Atlas Cockpit` demonstrates a dense control-deck pack with toggled telemetry lanes and optional modules, while `Prism Switchboard` demonstrates a more cinematic scene with persistent local deck state and source-lane switching.
- Durable product note:
  - Treat these two folders as the golden authored examples for future Home-pack work. If a new pack needs reference code, start here before copying from built-ins.
  - Keep authored packs data-driven and host-constrained. The point of this root folder is to prove extension power without letting third-party packs own filesystem truth or shell internals.
- Validation:
  - passed: `bun x esbuild home-packs/atlas-cockpit/index.tsx --bundle --format=esm --external:lucide-react --external:greeblefs-home-pack --outfile=/tmp/atlas-cockpit-home-pack.js`
  - passed: `bun x esbuild home-packs/prism-switchboard/index.tsx --bundle --format=esm --external:lucide-react --external:greeblefs-home-pack --outfile=/tmp/prism-switchboard-home-pack.js`
  - passed: `bun x tsc --noEmit`

# 2026-04-22 - Sigma Global Search Is Now Assimilated Into The Command Palette

- GreebleFS now has a native indexed global filename search adapted from Sigma and surfaced through the shell command palette instead of a separate imported UI shell.
- Durable implementation shape:
  - Added `src-tauri/src/global_search/` as the native truth layer. It owns the Tantivy schema, app-local index storage, full-drive scan lifecycle, scan status, indexed query, and explicit priority-path query helpers.
  - `src/runtime/globalSearchBackend.ts` is the only TS bridge for this feature. It wraps the Specta commands, resolves drive roots from the existing explorer drive inventory, and merges indexed results with a small explicit-path fallback query so the palette can still feel responsive around open/bookmarked folders.
  - `src/store/globalSearchStore.ts` owns command-palette session behavior: one-time init, status polling, optional auto-start scan on first open when no valid index exists, debounced query dispatch, and the latest palette result set.
  - `src/App.tsx` now treats global search as a command-palette-first shell feature. The palette shows indexed file hits ahead of normal actions, exposes scan/rebuild/cancel controls, and formats live status/error messaging through `src/config/globalSearch.ts`.
  - `src/store/explorerStore.ts`, `src/components/explorer/ExplorerWorkspace.tsx`, and `src/components/FileExplorer.tsx` now support a host-owned "open/reveal in active explorer pane" flow. Palette results activate the explorer panel, navigate the active pane to the parent directory, clear local search state, and select the matched entry instead of opening files externally or spawning a parallel explorer shell.
- Durable product note:
  - Sigma's incremental `index_paths` path was intentionally not ported. In the upstream shape it deletes by a path field that is not modeled safely for descendant removal in the current schema, so porting it as-is would leave stale index rows behind. The shipped slice is full-scan plus indexed-query plus explicit priority-path fallback.
  - Explicit priority paths are trusted user context. `global_search_query_paths(...)` no longer filters those caller-provided paths back out through the builtin ignore list, which keeps palette fallback results working for folders under locations like `/tmp` when the user explicitly opened them.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/commandPalette.test.tsx src/test/ExplorerWorkspace.test.tsx src/test/explorerStore.test.ts --reporter=dot`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml global_search -- --nocapture`

# 2026-04-22 - Sovereign Mobile PWA First Slice Now Runs Through lan_share

# 2026-04-22 - Explorer Drag Is Now App-Owned Internally And Native At The Edge

- The durable cross-platform shape is no longer HTML5 drag for everything. Internal explorer moves are now pointer-driven and app-owned, while real OS ingress/egress stays on native/Tauri seams.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` no longer relies on `draggable` entry cards or HTML5 `dragstart` for normal explorer moves. Plain file/folder dragging now begins from pointer movement threshold and drives the shared drag interaction runtime directly.
  - Internal explorer drags now keep the interaction inside app-owned state:
    - pointer-down on an entry captures a drag candidate
    - pointer-move past threshold starts a shared internal drag session
    - hover targeting, whole-explorer fallback, and dwell auto-open still route through `src/components/explorer/explorerDragAndDrop.ts`
    - pointer-up resolves the current target and executes the transfer without `DataTransfer`
  - Native drag-out is explicit `Alt`+drag and still routes through the Rust bridge in `src-tauri/src/desktop_integration.rs`.
  - External/native file drops still use Tauri window drag-drop events, and `src-tauri/tauri.conf.json` now keeps `dragDropEnabled: true` so real OS file ingress remains available.
  - `src/components/explorer/explorerDragAndDrop.ts` still parses `text/uri-list` and `DataTransfer.files[*].path` for external/native drop payloads, which keeps external desktop-file-manager drops path-based instead of depending on plain-text fallbacks.
  - The registered explorer `scope-root` stays on the outer explorer shell, not just the file plane, so toolbar / preview / rail / other in-scope chrome can still fall back to the current folder instead of becoming dead zones.
- Durable product note:
  - Do not reintroduce `draggable` explorer entries for normal in-app moves. That path conflicts with Tauri/WebKit drag ownership and is not the stable enterprise-grade cross-platform solution.
  - Internal drag semantics belong to the explorer runtime, not the browser drag model. External file ingress/egress belongs to native adapters.
  - If drag/drop regresses again, inspect whether the bug is in:
    - pointer-driven internal drag state in `FileExplorer.tsx`
    - surface arbitration in `explorerDragAndDrop.ts`
    - native external drop events from Tauri
    before changing all three at once.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "starts pointer-driven internal explorer drags without invoking the native drag bridge|moves multi-selected files into the hovered folder without leaking the drop to the viewport root|copies native external drops into the hovered folder via the Tauri drag-drop listener|drops native external drags into the current folder when the pointer is over a file card|starts the native drag bridge only when Alt is held for supported local entries|drops into the current folder when hovering explorer chrome outside the main file plane" --pool=forks --reporter=dot`
  - passed: `bunx vitest run src/test/explorerSideRail.test.tsx -t "only shows the verbose drag guide when the rail is wide enough for it" --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

- GreebleFS now has a dedicated mobile-first share mode implemented inside the existing Axum `lan_share` subsystem instead of trying to remote the desktop Tauri shell into Safari.
- Durable implementation shape:
  - Added a separate Vite/React build surface for mobile in `src-mobile/` plus `vite.mobile.config.ts`. This bundle is browser-safe by design and must stay free of `@tauri-apps/api` imports.
  - `package.json` now exposes `build:mobile`, and the main `build` script also emits `dist-mobile/` so release builds generate the mobile bundle alongside the desktop bundle.
  - `src-tauri/src/lan_share/mobile.rs` now owns the mobile share router:
    - serves the compiled mobile SPA shell and static assets
    - exposes paged `GET /api/list` responses for large directories
    - exposes direct `GET /files/*path` media/file transport over the share tunnel
    - falls back to a clear “run bun run build:mobile” HTML message when the mobile bundle is missing in dev
  - `src-tauri/src/lan_share/server.rs` now supports a real `mobile` share mode. It accepts directory shares plus multi-file hub shares and routes them through the mobile router.
  - `src-tauri/src/lan_share/types.rs` `ShareState` now carries the `AppHandle`, which the mobile router uses to resolve bundled mobile assets from app resources or the repo-local `dist-mobile/` dev output.
  - `src-tauri/tauri.conf.json` now bundles `../dist-mobile/` into app resources as `mobile-dist/` so installed builds can resolve the mobile bundle from `resource_dir/mobile-dist`.
  - `src/runtime/lanShareRuntimeBackend.ts` now defaults `lanShareStart(...)` to `mobile` instead of the old invalid `"Share"` placeholder.
- Durable product note:
  - This first slice is intentionally a separate mobile surface, not a port of `src/App.tsx` or the desktop explorer runtime. Future mobile work should extend `src-mobile/` and the `lan_share/mobile.rs` API contract, not try to make the browser talk to Tauri IPC.
  - The mobile API is paged, but it still enumerates and sorts each directory server-side before slicing. If truly massive directories become a bottleneck, the next step is a native cursor/window listing contract rather than pushing more UI tricks into the browser.
  - The current mobile UI supports folder navigation, virtualized row rendering, local filtering over loaded rows, media overlay viewing, and streamed file opens. It does not yet reuse native thumbnail generation, task progress feeds, or authenticated overlay-network identity; those are the next high-value extensions.
- Validation:
  - passed: `bun run build:mobile`
  - passed: `bunx tsc --noEmit --pretty false --target ES2020 --module ESNext --lib ES2020,DOM,DOM.Iterable --moduleResolution bundler --allowImportingTsExtensions --resolveJsonModule --isolatedModules --jsx react-jsx --skipLibCheck --types node src-mobile/main.tsx src-mobile/App.tsx src-mobile/mobileApi.ts src-mobile/types.ts`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - note: repo-wide `bunx tsc --noEmit --pretty false` still reports an unrelated pre-existing error in `src/components/explorer/ExplorerWorkspace.tsx`, so the mobile pass used a targeted TypeScript proof instead of altering the user’s active explorer branch work.

# GreebleFS Memory

# 2026-04-22 - Explorer Drag/Drop Now Uses A Central Interaction Runtime

- Explorer file moving no longer relies on pane-local `dragOver` state and scattered `onDrop` branches. The drag/drop interaction path now routes through one shared controller in `src/components/explorer/explorerDragAndDrop.ts`.
- Durable implementation shape:
  - Added `src/config/explorerDragInteractions.ts` as the data-driven source of truth for drag-surface priorities, dwell timings, and overlay pointer offsets. Extend that file first instead of hardcoding target precedence or hover-open timing inside `FileExplorer.tsx`.
  - `src/components/explorer/explorerDragAndDrop.ts` now owns three concerns:
    - shared drag session continuity for internal/native-out drags
    - semantic drop-surface bindings (`scope-root`, `directory-target`, `navigation-target`) that UI surfaces attach declaratively
    - central drag interaction state for active-target resolution, invalid-drop rejection, and hover-dwell auto-open
  - `src/components/FileExplorer.tsx` now treats the explorer shell as a transport surface. The outer explorer root captures DOM drag events, the main pane registers the current-folder scope root, and folder cards plus breadcrumbs only register semantic targets through the shared binding helper.
  - `src/components/explorer/ExplorerWorkspace.tsx` now renders `ExplorerDragOverlay` once for the workspace and registers workspace tabs as navigation hover targets so drag-dwell can activate tabs without pane-local hacks.
  - `src/components/explorer/ExplorerSideRail.tsx` keeps bookmark-group import behavior, but bookmark rows with real filesystem paths now register as file-drop navigation targets through the same controller. Empty bookmark-space import remains separate on purpose.
- Durable product note:
  - Current-folder fallback now belongs to the registered scope root, not to random DOM gaps. If drag behavior regresses, inspect which semantic surface is registered for that area before adding another direct `onDragOver`.
  - Direct file-card drops intentionally resolve to the owning current folder unless the pointer is over a registered directory target.
  - Workspace tabs now participate in the shared drag state for hover activation and feedback, but direct “drop onto a tab chip and transfer immediately” is still weaker than pane/body folder drops. If that workflow needs to become first-class later, extend the shared controller with an explicit workspace-level drop executor instead of reintroducing local tab handlers.
- Validation:
  - passed: `bunx vitest run src/test/explorerDragAndDrop.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "moves multi-selected files into the hovered folder without leaking the drop to the viewport root|moves native same-window drags into the hovered folder via the Tauri drag-drop listener|drops native same-window drags into the current folder when the pointer is over a file card|keeps explorer drags internal when Shift is held|starts native drag on plain explorer drags while keeping in-app payloads available" --pool=forks --reporter=dot`
  - passed: `bunx vitest run src/test/explorerSideRail.test.tsx --reporter=dot`
  - note: filtered `tsc` grep over the touched explorer drag files emitted no touched-file errors; full repo typecheck still has unrelated branch drift outside this pass.

# 2026-04-22 - Premium Sliders Became A Shared Shell Primitive

- The shell no longer relies on scattered native `input[type="range"]` controls for premium-facing tuning surfaces. Slider styling and behavior now route through a shared Radix-backed primitive so motion settings, editors, and preview workbenches all inherit the same interaction quality.
- Durable implementation shape:
  - Added `src/components/PremiumSlider.tsx` as the canonical slider primitive. It wraps `@radix-ui/react-slider`, uses theme tokens such as `--overlay-accent` and workbench card-border variables, and bakes in larger grab targets, drag/focus state, compact vs comfortable density, smooth range fill, and thumb halo/locking feedback.
  - `src/components/SettingsPage.tsx` now routes `RangeField` and the hover-montage frame slider through `PremiumSlider`, so the interaction-motion controls and the broader settings surface use the same shell-owned control instead of browser-native ranges.
  - `src/components/ExplorerImageEditor.tsx`, `src/components/ExplorerVideoEditor.tsx`, `src/components/ExplorerAudioWorkbench.tsx`, and `src/components/ExplorerFontPreview.tsx` now consume the shared primitive instead of bespoke inline slider CSS. This removed the old local slider styles and keeps editor/workbench controls visually aligned with Settings.
  - Radix slider accessibility lives on the thumb role, not the outer root. `PremiumSlider` now applies the `aria-*` metadata directly to `SliderPrimitive.Thumb`, which is required for Testing Library queries and real assistive-tech naming to resolve correctly.
  - `src/test/setup.tsx` now provides a minimal global `ResizeObserver` shim for jsdom because `@radix-ui/react-slider` depends on it through `@radix-ui/react-use-size`.
- Durable product note:
  - Future shell sliders should reuse `PremiumSlider` instead of introducing new native range inputs or per-surface CSS tracks. If a slider needs a variant, extend the shared primitive or add a data-driven prop there first.
  - When testing Radix sliders, drive the thumb via keyboard or pointer semantics rather than faking native `change` events on a hidden/nonexistent range input.
- Validation:
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "updates interaction motion settings and exposes motion-lab preview surfaces" --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.shaders.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false`

# 2026-04-22 - KCloner-Style Interaction Motion Now Supports Per-Instance Step Offsets

- The shared UI motion system no longer forces every matching animated surface to loop in perfect lockstep. KCloner-style presets now expose a real `Step` modifier that phase-offsets repeated items such as selected explorer entries/icons, workflow tabs, rail rows, and top-bar controls.
- Durable implementation shape:
  - `src/config/interactionMotion.ts` now appends a `Step` control to every animated KCloner profile. It is stored as a per-preset modifier value in seconds, mirrors the KCloner mental model instead of a generic stagger percentage, and resolves into a negative animation delay based on each bound surface's instance index.
  - `resolveInteractionMotionSurfaceStyle(...)` now accepts an optional `motionStepIndex`. Animated presets use that index plus the active preset's `step` modifier to compute phase offsets, while non-animated/system presets safely ignore it.
  - `src/animation/interactionMotion.tsx` now threads `motionStepIndex` through the shared binder, so live surfaces can opt into phase offsets without inventing a second motion API.
  - `src/components/FileExplorer.tsx` now passes visible-entry order into both `explorerEntry` and `explorerEntryIcon` bindings across the main list/grid/table views plus the semantic, timeline-surface, and constellation views. This is the core fix for "selected icons all move together."
  - `src/components/WorkbenchTopBar.tsx`, `src/components/explorer/ExplorerSideRail.tsx`, and `src/animation/MotionLab.tsx` now pass stable per-list indices into the shared binder where those chrome surfaces already render through ordered arrays, so shell-chrome presets can benefit from the same step control instead of exposing a dead slider.
- Durable product note:
  - Treat `step` as part of the shared interaction-motion resolver, not a one-off explorer animation tweak. Future animated shell surfaces should pass a meaningful instance index into `bindSurface(...)` when they render repeated items, otherwise the step control will exist but do nothing for that surface.
  - The UI interpretation of `step` is "seconds of phase offset per repeated item," which maps more closely to KCloner's time-offset behavior than a normalized percentage-of-cycle slider.
- Validation:
  - passed: `bunx vitest run src/test/interactionMotion.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "updates interaction motion settings and exposes motion-lab preview surfaces" --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "routes explorer entry and preview workflow tab motion through the shared interaction resolver" --reporter=dot`
  - passed: `bunx vitest run src/test/explorerSideRail.test.tsx src/test/workbenchTopBar.test.tsx --reporter=dot`
  - passed: filtered touched-path TypeScript check for the interaction-motion, explorer, rail, top-bar, and Motion Lab files (no touched-file TypeScript errors surfaced)

# 2026-04-22 - Explorer Drag And Drop Now Uses Shared Scope Arbitration

- Explorer file drag/drop is no longer owned by scattered per-entry handlers plus pane-local native-drag refs. The explorer now has a shared interaction seam for drop-target hit testing and same-window drag state, which fixes the old "magic drop zones" behavior across panes and other explorer surfaces.
- Durable implementation shape:
  - `src/components/explorer/explorerDragAndDrop.ts` is now the canonical drag/drop helper for the explorer surface. It owns:
    - scope-aware hit testing (`data-overlay-explorer-drop-scope-id` plus root-path fallback)
    - direct-target vs viewport-root arbitration
    - shared same-window drag session state that survives native-out drag end briefly so another pane can still resolve the internal move/copy correctly
    - common payload parsing from `DataTransfer`
  - `src/components/FileExplorer.tsx` now treats the content viewport as the primary drop surface. Entry cards keep `data-overlay-drop-target-path`, but the hot path is root-owned:
    - root `dragover` / `drop` resolves the exact folder-under-pointer or falls back to the current directory
    - Tauri `onDragDropEvent` now gates itself to the pane actually under the pointer instead of letting every `FileExplorer` instance compete for the same window-level drop
    - native same-window drags now resolve through the same arbitration path as React drags, with a `mainRef.contains(...)` fallback when browser-style scope geometry is unavailable
  - `src/components/explorer/ExplorerSideRail.tsx` now reads dropped paths through the shared payload/session helper too, so bookmark imports can still resolve same-window explorer drags when the DOM payload is incomplete.
  - `src/test/explorerDragAndDrop.test.ts` now locks:
    - direct folder-vs-viewport arbitration
    - multi-scope pane routing
    - shared native-out drag-session linger
    - payload parsing fallback behavior
  - `src/test/fileExplorer.viewModes.test.tsx` now includes a native same-window regression case for dropping over a non-folder file card, which should still route to the current folder instead of rejecting the pane.
- Durable product note:
  - Treat explorer drag/drop as a first-class interaction layer, not as one-off `onDrop` handlers sprinkled across cards. If a new explorer surface becomes droppable later, wire it into `explorerDragAndDrop.ts` first so hit testing, pane ownership, and same-window native drag behavior stay coherent.
  - Dolphin’s useful pattern here was the distinction between a hovered item and the widget that is actually eligible to receive the drop. Preserve that distinction. Non-folder cards should not steal the drop from the viewport root, and background drops should not require "magic" empty regions.
- Validation:
  - passed: `bunx vitest run src/test/explorerDragAndDrop.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "starts native drag on plain explorer drags while keeping in-app payloads available|moves multi-selected files into the hovered folder without leaking the drop to the viewport root|moves native same-window drags into the hovered folder via the Tauri drag-drop listener|drops native same-window drags into the current folder when the pointer is over a file card|keeps explorer drags internal when Shift is held" --pool=forks --reporter=dot`
  - passed: `bunx vitest run src/test/explorerSideRail.test.tsx -t "prompts for dropped folders and creates bookmarks optimistically after confirmation" --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-22 - Explorer Preview Terminal Now Drives Explorer Navigation Through Native Shell Integration

- The embedded explorer preview terminal no longer depends on mocked callbacks or optimistic prompt timers to tell Explorer where the shell actually is. The native terminal lane now reports cwd changes from the shell prompt itself.
- Durable implementation shape:
  - `src-tauri/src/terminal.rs` now installs per-shell prompt hooks for `bash`, `zsh`, `fish`, `PowerShell`, and `cmd`, emitting a host-owned OSC marker whenever a prompt renders with a cwd.
  - The PTY reader now parses and strips those OSC markers before forwarding visible output to xterm, so the terminal view stays clean while Rust still gets a reliable cwd signal.
  - The terminal manager now routes those prompt-time cwd reports through `report_prompt_ready_cwd(...)`, which updates `TerminalShellIntegrationState`, marks the pane back at prompt, and reuses the existing pending-cwd flush path. This keeps explorer -> terminal and terminal -> explorer sync on one state machine instead of inventing a second channel.
  - Shell-integration event emission now uses the typed `TerminalShellIntegrationStateEvent` emitter, fixing the previous event-name drift between Rust and `TerminalOverlay.tsx`.
  - Windows-native path normalization now lives in the Rust terminal layer, including POSIX-style `/c/...` cwd reports from Unix-like shells on Windows, so Explorer gets a native path before React sees the event.
- Durable product note:
  - Keep terminal cwd sync in the native terminal host. Do not regress to parsing `cd ...` strings in React; shell truth belongs in the PTY/backend lane.
  - If new shells are supported later, extend the shell hook/bootstrap + cwd normalization path in `src-tauri/src/terminal.rs` rather than adding more frontend exceptions.
- Validation:
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml terminal_shell_integration -- --nocapture`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml terminal_shell_ -- --nocapture`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml terminal_shell_state_accepts_reported_cwd_from_shell_integration -- --nocapture`
  - passed: `bunx vitest run src/test/terminalOverlay.test.tsx -t "reports shell integration cwd changes only for the active pane prompt and dedupes repeats|injects a shell-specific cd command when the explorer queues a terminal cwd sync" --reporter=dot`
  - note: the repo still emits unrelated Rust warnings in other crates and existing non-terminal files in this worktree were already dirty during the pass; this change intentionally stayed scoped to the native terminal host plus docs.

# 2026-04-22 - Interaction Motion Now Splits Chrome From Files And Exposes KCloner-Style Modifier Knobs

- Interaction Motion no longer behaves like one flat preset applied everywhere. The resolver now routes surfaces through two durable modules:
  - `shellChrome` for rail items, tabs, top-bar buttons, and settings cards
  - `fileItems` for explorer rows/cards plus explorer entry icons
- Durable implementation shape:
  - `src/config/interactionMotion.ts` now owns `interactionMotionModuleCatalog`, module-aware surface metadata, module override normalization, and module routing helpers. Future interaction surfaces should declare their module there instead of inventing ad hoc override paths.
  - Appearance settings now persist `interactionMotionModuleOverrides`, letting each module carry its own enabled state, preset selection, intensity multiplier, and per-preset modifier values without breaking the existing global master switch and master intensity.
  - The KCloner-inspired presets no longer stop at preset selection. `src/config/interactionMotion.ts` now defines per-preset modifier control metadata plus a profile-tuning layer, so families like `bounce`, `lissajous`, `shake`, `float`, `elastic`, and `orbit` expose named control sets (`height`, `squash`, `pace`, `radius`, `spin`, etc.) and the resolver morphs the profile before surface transforms are computed.
  - `src/components/SettingsPage.tsx` now treats `Interaction Motion` like a real editor surface: one master state card, one module card for `Shell Chrome`, one for `Files & Folders`, per-module preset galleries, per-module intensity, and per-module modifier sliders. Preserve that split instead of collapsing back to a single preset studio.
- Durable product note:
  - File/folder interaction and shell-chrome interaction are different authoring problems. Keep them separately routable even when they share resolver infrastructure.
  - If future work adds cloners, fields, or authorable chains, route them through the module-aware resolver instead of bypassing it, otherwise the theme/default/reduced-motion/per-surface guarantees will fragment.
- Validation:
  - passed: `bunx vitest run src/test/interactionMotion.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "updates interaction motion settings and exposes motion-lab preview surfaces" --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "routes explorer entry and preview workflow tab motion through the shared interaction resolver" --reporter=dot`
  - passed: filtered touched-path TypeScript check for `interactionMotion.ts`, `interactionMotion.tsx`, `SettingsPage.tsx`, `settingsStore.ts`, and the touched tests

# 2026-04-22 - Interaction Motion Became A KCloner-Inspired UI Motion Suite

- Interaction Motion is no longer only three static shell presets. The subsystem now exposes a broader KCloner-style motion family set and can animate explorer icon stages independently from the surrounding row/card shell.
- Durable implementation shape:
  - `src/config/interactionMotion.ts` now includes a dedicated `explorerEntryIcon` surface plus ten animated motion-family presets: `bounce`, `lissajous`, `shake`, `float`, `pulse`, `elastic`, `wobble`, `sway`, `heartbeat`, and `orbit`, alongside the lighter `subtle`, `spring`, and `playful` system profiles.
  - That config now also carries preset grouping metadata (`system` vs `kcloner`) so Settings can present the suite as a gallery instead of a flat strip of buttons.
  - `src/animation/interactionMotion.tsx` now injects a shared keyframe stylesheet and applies animation CSS vars plus `animation` properties on bound surfaces. Animated presets still route through the same resolver/store path as the older static presets.
  - `src/components/FileExplorer.tsx` now binds the new `explorerEntryIcon` surface on thumbnail/icon wrappers, so selected files and folders can animate at icon level instead of only moving the whole row/card.
  - `src/animation/MotionLab.tsx` now previews icon-stage motion too, not just entry rows and shell chrome.
  - `src/components/SettingsPage.tsx` now renders a grouped `Preset Studio` inside `Interaction Motion`, separating fast shell defaults from the KCloner motion family set.
- Durable product note:
  - Treat animated motion families as first-class interaction presets, not as a separate engine. They should stay on the same resolver path so theme defaults, per-surface disables, reduced-motion handling, and Motion Lab all remain coherent.
  - Explorer feedback can now be split between row shell and icon shell. If future work adds clone/field authoring, preserve that separation instead of only animating whole entry cards.
- Validation:
  - passed: `bunx vitest run src/test/interactionMotion.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "updates interaction motion settings and exposes motion-lab preview surfaces" --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "routes explorer entry and preview workflow tab motion through the shared interaction resolver" --reporter=dot`
  - note: filtered touched-path TypeScript is still blocked by pre-existing unrelated `src/components/FileExplorer.tsx` `liveLayoutZoomStateRef` errors already present on this branch outside the interaction-motion changes

# 2026-04-22 - Focus Mode Search Control Now Stays In The Primary Toolbar Rail

- Explorer `focus` mode no longer parks the search-focus button beside the volatile folder/selection size summaries.
- Durable implementation shape:
  - `src/config/explorerChromeLayouts.ts` now places `focusAddressBar` in the `focused-search` layout's `primaryEnd` zone instead of `secondaryStart`, keeping the search affordance in the stable top toolbar row while `selectionSizeSummary` continues to live in the secondary metrics strip.
  - `src/test/explorerChromeLayouts.test.ts` now locks that built-in layout contract so future chrome-layout edits cannot silently push the control back into the secondary row.
  - `src/test/fileExplorer.viewModes.test.tsx` now verifies the rendered explorer keeps `focusAddressBar` in `primaryEnd` after switching into focus mode and after selecting entries, which protects against the specific "button drifts when selection changes" regression.
- Durable product note:
  - Search/path focus is muscle-memory chrome, not selection-context chrome. In future explorer layout passes, keep it anchored with navigation/address controls or another stable global slot, not next to live metrics whose width changes with selection.
- Validation:
  - passed: `bunx vitest run src/test/explorerChromeLayouts.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "lets the user switch explorer modes from the toolbar without mutating the live session shell preset or sources visibility|keeps the search focus control anchored in the primary toolbar zone in focus mode" --pool=forks --reporter=dot`

# 2026-04-22 - Explorer Ctrl+Scroll Now Uses A Live Spring Zoom Continuum

- Explorer ctrl/cmd+wheel no longer writes `settings.explorer` on every wheel threshold. The hot path is now a local live zoom controller that keeps the gesture inside Explorer and only commits back to persisted settings after the wheel gesture settles.
- Durable implementation shape:
  - `src/config/explorerViewModes.ts` now owns an internal `ExplorerLayoutZoomState` continuum for the flagship explorer. It maps persisted `viewMode` / `gridZoom` into a live `grid <-> list` zoom family, resolves the active display mode during the gesture, and commits the settled result back to the existing durable settings contract without changing schema.
  - The live continuum is intentionally limited to `icons-*` plus compact `list`. Manual `columns` and `details` remain explicit user-selected layouts; ctrl/cmd+wheel no longer cycles through every row preset automatically.
  - `src/components/FileExplorer.tsx` now drives ctrl/cmd+wheel through `framer-motion` motion values and a spring instead of the old `EXPLORER_LAYOUT_WHEEL_STEP_DELTA` accumulator. The explorer keeps a local live zoom state, applies pointer-anchor scroll correction while the spring updates, and delays `updateExplorerSettings(...)` until the gesture goes idle.
  - Explorer zoom now records `explorer_layout_zoom` samples in `src/config/performanceTelemetry.ts`, using the p95 frame time observed while the live zoom gesture is active.
  - Thumbnail behavior is intentionally cache-first during zoom. Existing visible thumbnails stay mounted and the regression tests now guard against refetching an already-visible generated thumbnail path during the gesture.
  - `src/test/explorerViewModes.test.ts` now locks the live zoom helper contract, and `src/test/fileExplorer.viewModes.test.tsx` now locks delayed commit, gesture-burst commit coalescing, file-area wheel routing, grid/list boundary behavior, viewport anchoring, and thumbnail stability.
  - `src/test/browser-proof/fileExplorer.layoutZoom.page.tsx` is the browser-proof/manual-validation entry for this work. Use it when checking the feel of ctrl/cmd+wheel alongside the Dev HUD.
- Durable product note:
  - Treat explorer ctrl/cmd+wheel as a local interaction runtime, not a direct settings write path. Future tuning should adjust the live continuum or spring parameters first, then the settled commit mapping, instead of reintroducing per-wheel persisted updates.
  - If future work adds more automatic wheel families, extend the continuum helper in `explorerViewModes.ts` first. Do not grow more one-off wheel logic inside `FileExplorer.tsx`.
  - A second pass widened the live grid-only zoom band using a Dolphin-inspired oversized range instead of adding new durable settings. `src/config/explorerViewModes.ts` now allows the live grid continuum to run past `icons-xl` up to a local oversized ceiling, with an eased metric expansion that can approach two-across browsing on wide panes while still committing the durable settings back to the existing `icons-xl` anchor.
  - Follow-up correction: oversized zoom is now durable in the existing `settings.explorer.gridZoom` number itself instead of being treated like a temporary local-only state. The schema did not change, but the accepted range for `gridZoom` is now wider, so remounts preserve oversized icon layouts cleanly.
  - `src/components/FileExplorer.tsx` no longer shows a fake `0-100%` zoom readout for the layout continuum. The layout picker/HUD now uses a continuum bar and an `XL / XL+ / XL++`-style label instead of pretending the oversize range maps to a finite percentage metric.
  - Dolphin reference note: the useful idea from `packages/dolphin-master` was not a fancy wheel algorithm. The smoothness comes from letting the view own zoom-level math and item-size updates, batching layout changes, and giving the large-icon end of the range much more headroom. Keep copying that shape rather than chasing per-wheel gimmicks.
  - The main hot-path cleanup in `FileExplorer.tsx` now memoizes the rail, toolbar, and preview subtrees so live zoom frames stop rebuilding those panes. It also disables per-entry size transitions while the live zoom spring is active, avoids React state updates on every spring tick, and pushes the visible grid/list sizing through DOM/CSS variables that the spring updates directly.
  - Tuning follow-up: removing React spring-frame updates entirely made the explorer feel worse because the layout was snapping toward target states while only the CSS variables were animating. The current shape keeps the spring-driven rendered layout state for the viewport itself while still keeping the surrounding explorer chrome cold.
  - Wheel tuning now uses range-aware damping inspired by Dolphin's restrained per-step zoom behavior. List-to-grid entry is slowed down, normal grid zoom moves in moderate increments, and oversized `XL+`/`XL++` travel is heavily damped so a single wheel burst does not jump half the continuum.
- Validation:
  - passed: `bunx vitest run src/test/explorerViewModes.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "scales the explorer grid with ctrl-wheel without changing app zoom and only commits after idle|settles one explorer-settings commit|scales the explorer grid when ctrl-wheel happens on the file area shell|drops into compact list mode|keeps a deep-grid viewport anchored|does not refetch an already-visible generated thumbnail" --pool=forks --reporter=dot`
  - note: repo-wide `bunx tsc --noEmit --pretty false -p tsconfig.json` still exits nonzero on this branch from unrelated existing drift outside the filtered zoom paths; the zoom-touched files emitted no filtered TypeScript errors in the targeted pass.

# 2026-04-22 - Explorer Home Is Now An App-Owned Surface With Home Packs

- Explorer `Home` no longer means "navigate to the machine home directory." The durable explorer default is now the virtual route `greeblefs://home`, which is an app-owned surface with its own rendering/runtime/settings model.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now treats `greeblefs://home` as a special explorer surface rather than a directory listing. It skips filesystem listing/search/preview assumptions, swaps in Home-specific toolbar/context actions, preserves history normally, and only records usage telemetry for successful local folder navigations.
  - `src/components/explorer/ExplorerSideRail.tsx` and `src/components/explorer/ExplorerWorkspace.tsx` now recognize the virtual Home route as a first-class location label/state instead of falling through to raw path leaf handling.
  - `src/components/home/ExplorerHomeSurface.tsx` is the host-owned Home renderer/runtime seam. It assembles quick access, bookmarks, saved searches, drives, task-center data, launchpad actions, and usage telemetry into one constrained pack host contract.
  - `src/components/home/homePackRuntime.tsx`, `src/components/home/builtInHomePacks.tsx`, and `src/config/homePackages.ts` now define the Home-pack system. Built-ins ship as `command-center` and `favorites-deck`, while authored packs live under the managed `home-packs/` root and can contribute presets, module layouts, custom renderers, and optional pack-specific settings UI.
  - `src/store/settingsStore.ts` now persists `settings.home.activePackId`, `usageTrackingEnabled`, `packStateById`, and `activePresetIdByPackId`. Treat this as the canonical Home-state contract instead of smuggling pack state into generic appearance or explorer settings.
  - `src/config/appearance.ts` and `src/config/themePackages.ts` now allow themes to suggest `defaultHomePackId`, but Home-pack choice remains independent from the active app theme.
  - `src-tauri/src/explorer_pro_commands.rs` now owns local-only Home usage telemetry through the existing explorer metadata lane. The typed commands `explorer_home_usage_list`, `explorer_home_usage_record`, and `explorer_home_usage_clear` feed the frontend's `most used` and `recent` lanes without inventing a second persistence store.
  - `src/components/SettingsPage.tsx` now has a dedicated `Home` section for active-pack selection, preset selection, usage-tracking toggle/reset, managed-folder open/refresh controls, and pack-provided settings UI. Home is intentionally its own settings surface, not a subsection of Explorer.
- Durable product note:
  - If a test or tool needs the explorer to boot into a real filesystem path, it must seed `settings.explorer.defaultPath` explicitly. The shipped default should remain `greeblefs://home`.
  - Keep Home packs modular and host-constrained. New Home content should extend the pack host/catalog or pack manifests first, not punch raw filesystem truth or random native invokes directly into pack code.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `bun x tsc --noEmit`
  - passed: `bun x vitest run src/test/panelRegistry.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsPage.shaders.test.tsx src/test/ExplorerWorkspace.test.tsx src/test/fileExplorer.searchTelemetry.test.tsx`
  - note: `src/test/fileExplorer.viewModes.test.tsx` still hits a Vitest heap OOM in this workspace even when isolated and retried with `--pool=forks`; the suite reached `63/88` passing tests before the harness died, so treat that as environment instability rather than a confirmed Home regression.

# 2026-04-22 - Models Settings Tab And Shared Local-Model Management

- Local models are no longer only an implementation detail of semantic search. GreebleFS now has a dedicated `Models` settings section intended to stay valid as more local-model features land, including semantic indexing now and future local inference or source-separation lanes later.
- Durable implementation shape:
  - `src/config/localModelCatalog.json` is the source of truth for curated local-model metadata. It owns backend options (`auto`, `cpu`, `onnx`, `cuda`), hardware-profile labels, capability ids, default capability bindings, and the current curated semantic-search model list.
  - `src/config/localModels.ts` is the typed normalization and resolution layer over that catalog. New local-model features should extend the catalog there first instead of hardcoding model ids, backend labels, or per-root override behavior inside React.
  - `src/store/settingsStore.ts` now persists `settings.models.capabilityBindings` plus `settings.models.semanticIndexRootOverrides`. Semantic search should read from those bindings, but the store shape is intentionally capability-first so new local-model features can reuse it.
  - `src-python/greeblefs_sidecar/model_management.py` is the shared Python-sidecar model-management seam. It owns the managed Hugging Face cache roots, registry manifests, backend/provider detection helpers, curated-model resolution, cache-footprint reporting, and model prewarm/download behavior.
  - `src-python/greeblefs-python-sidecar.json` plus `src-python/greeblefs_sidecar/actions.py` now advertise dedicated model-management actions: `models.catalog_status`, `models.cache_summary`, and `models.prewarm`.
  - `src/runtime/modelManagementBackend.ts` is the only TS bridge for model catalog status, cache summary, and prewarm actions. React should not call the Python sidecar directly for model-management work.
  - `src/components/SettingsPage.tsx` now has a first-class `Models` tab with four durable lanes:
    - shared cache/runtime summary
    - capability routing cards
    - curated installed-model catalog with `Download / Prewarm`
    - per-root semantic-index overrides
  - The Models tab intentionally grays out the `CUDA` backend option when the acceleration runtime does not report a ready/detected NVIDIA-capable provider. CUDA is additive, not required.
  - `src-tauri/src/semantic_search.rs`, `src-python/greeblefs_sidecar/semantic_search_runtime.py`, and `src/components/FileExplorer.tsx` now all accept explicit `modelId` / `backendPreference` inputs for semantic indexing/search/similarity, but live queries still prefer the model already recorded in the stored index summary so embedding compatibility is not silently broken.
- Durable product note:
  - Treat the Models tab as the shared local-AI operator surface, not a semantic-search-only admin pane.
  - Prewarm is currently the curated download path. If a broader Hugging Face browser/downloader lands later, it should still write through the same cache/registry contract instead of inventing a second local-model store.
- Validation:
  - passed: `python3 -m py_compile src-python/greeblefs_sidecar/*.py`
  - passed: `bunx vitest run src/test/settingsStore.test.ts src/test/settingsPage.behavior.test.tsx src/test/pythonConfig.test.ts --reporter=dot`
  - note: full repo `bunx tsc --noEmit --pretty false -p tsconfig.json` is currently blocked by unrelated branch drift in `FileExplorer`, Home-pack runtime wiring, and panel-registry prop updates outside this models-settings pass
  - note: full `cargo check --manifest-path src-tauri/Cargo.toml --quiet` is currently blocked by unrelated `specta_bindings.rs` / home-usage command drift already present in the branch

# 2026-04-22 - Interaction Motion Now Has Its Own Settings Pane

- `Animations` no longer carries both window transitions and shell micro-interactions in one pane. `Animations` is now window open/close only, while `Interaction Motion` is its own settings section with the existing resolver controls and Motion Lab.
- Durable implementation shape:
  - `src/config/settingsNavigation.ts` now declares `interaction-motion` as a standalone settings section. Keep `Animations` scoped to authored open/close transition modules, not shell micro-interaction controls.
  - `src/components/SettingsPage.tsx` now renders the full interaction-motion control surface under `Interaction Motion`, with `Animations` keeping only shell-transition controls and the animation authoring folder.
  - `src/test/settingsPage.behavior.test.tsx` now locks the split by asserting `Animations` no longer exposes the interaction-motion toggle and that the dedicated `Interaction Motion` pane still drives the store and Motion Lab preview.
- Durable product note:
  - If future procedural authoring grows beyond presets and per-surface toggles, extend `Interaction Motion` or add children beneath it. Do not stuff it back into `Animations`.
- Validation:
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "prioritizes core settings ahead of appearance sections in the rail" --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "updates interaction motion settings and exposes motion-lab preview surfaces" --reporter=dot`
  - passed: filtered touched-path TypeScript check for `SettingsPage.tsx`, `settingsNavigation.ts`, and `settingsPage.behavior.test.tsx`

# 2026-04-21 - Top Bars Now Have Their Own Managed Content Root

- Top bars are no longer only modular in code. They now also have a first-class authored storage root at `top-bars/`, so shell-header workflows can be shipped and mixed independently from whole theme packages.
- Durable implementation shape:
  - `src/config/appContentDirectories.ts` now treats `topBars` as a managed content directory with `VITE_GREEBLEFS_TOP_BARS_DIR` plus legacy `VITE_OVERLAYTERM_TOP_BARS_DIR` overrides. Dev uses repo-local `top-bars/`; release resolves under Tauri app-local data like other authored content roots.
  - `src/config/topBarPackages.ts` is the standalone loader for `top-bars/`. It resolves `top-bar.json` / `top-bar.toml` / `manifest.json` / `manifest.toml`, supports single-file shorthand manifests, scopes authored ids per package, and emits `LoadedOverlayTopBarPackage` records with flattened top-bar definitions.
  - `src/config/topBars.ts` now recognizes `top-bar-package` sources in addition to built-ins and theme-package contributions, while keeping the same active-resolution order and scoped-id behavior for theme-contributed bars.
  - `src/App.tsx` now refreshes and watches standalone top-bar packages separately from theme packages, opens the dedicated top-bars folder on demand, and resolves the active catalog from both authored top-bar packages and theme-package contributions.
  - `src/components/SettingsPage.tsx` now treats top bars like a real content root: the `Top Bars` section shows standalone-vs-theme contribution counts, opens `top-bars/`, refreshes both standalone and theme-contributed catalog sources, and lists `Top Bars` in the Overview workspace roots.
- Durable product note:
  - Treat `top-bars/` like `icon-themes/` or `wallpapers/`: user-authored shell identity layer with its own storage path, while themes remain allowed to publish bundled defaults and extra variants.
- Validation:
  - passed: `bunx vitest run src/test/appContentDirectories.test.ts src/test/topBars.test.ts src/test/topBarPackages.test.ts src/test/settingsPage.behavior.test.tsx src/test/settingsPage.shaders.test.tsx src/test/themePackageExplorerRecipe.test.ts --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-21 - Command Palette And Settings Navigation Became Catalog-Driven

- The command palette no longer hardcodes settings-section paths or managed-content folder opens. `App.tsx` now builds those actions from shared catalogs, so new settings sections or content roots become discoverable without adding one-off palette branches.
- Durable implementation shape:
  - `src/config/settingsNavigation.ts` is the source of truth for settings sections. It owns the canonical keys, labels, ordering, overview summaries, and keyword metadata used by the rail, overview shortcut cards, and command-palette deep links.
  - `src/store/settingsStore.ts` now persists `activeSection` as a typed `SettingsSectionKey`, with `overview` as the default. `SettingsPage.tsx` reads that store value directly, so the settings panel can land on `Icons`, `Top Bars`, or any future section without local state plumbing.
  - `src/config/appContentDirectories.ts` now owns the managed-content catalog and env override resolution for runtime roots such as `plugins`, `themes`, `top-bars`, `home-packs`, `icon-themes`, `shaders`, `animations`, `wallpapers`, `notes`, and `screenshots`.
  - `src/App.tsx` builds both the section-jump actions and the folder-open actions from those catalogs, while `SettingsPage.tsx` derives its overview workspace roots from the same managed-content list.
  - `src/test/settingsPage.behavior.test.tsx`, `src/test/appContentDirectories.test.ts`, and `src/test/panelRegistry.test.tsx` now lock the new catalog-driven behavior and the updated panel prop contract.
- Durable product note:
  - Treat settings sections and managed roots as catalog data, not hardcoded command targets. If a new settings area or authoring folder is added later, extend the catalog first and let the palette and settings page pick it up automatically.
- Validation:
  - passed: `bunx vitest run src/test/appContentDirectories.test.ts src/test/settingsPage.behavior.test.tsx src/test/panelRegistry.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/commandPalette.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-21 - Interaction Motion Is Now A First-Class Appearance Subsystem

- Micro-interactions are no longer scattered hover transforms inside explorer and shell components. GreebleFS now has a dedicated interaction-motion lane with theme defaults, persisted user overrides, and one shared resolver for high-frequency shell surfaces.
- Durable implementation shape:
  - `src/config/interactionMotion.ts` is the source of truth for the subsystem. It defines the v1 surface ids (`explorerEntry`, `explorerRailItem`, `previewWorkflowTab`, `panelTab`, `topBarButton`, `settingsCard`), trigger ids, built-in profiles (`subtle`, `spring`, `playful`), the theme recipe contract, and the precedence path `user preset > theme default > built-in subtle`.
  - `src/animation/interactionMotion.tsx` is the canonical runtime seam. `useInteractionMotionController(...)` merges theme defaults, persisted appearance state, and reduced-motion detection into one binder/resolver that returns stable style data plus pointer handlers. High-frequency shell UI should use this path instead of ad hoc inline `transform` writes.
  - `src/store/settingsStore.ts` now persists `appearance.interactionMotionEnabled`, `interactionMotionPresetId`, `interactionMotionIntensity`, and `interactionMotionSurfaceOverrides`. `interactionMotionPresetId: null` intentionally means "follow the active theme".
  - `src/config/appearance.ts` now accepts `theme.interactionMotion`, so themes can choose a default interaction profile and intensity without hijacking authored shell-transition modules.
  - `src/components/SettingsPage.tsx` split `Animations` into two lanes: existing shell-transition module selection and new `Interaction Motion` controls. That section now owns the enable toggle, `Follow Theme`, preset buttons, intensity slider, per-surface enablement, and the compact `Motion Lab` preview harness.
  - `src/components/FileExplorer.tsx`, `src/components/explorer/ExplorerSideRail.tsx`, and `src/components/WorkbenchTopBar.tsx` now route explorer entries, preview workflow tabs, explorer rail items, top-bar buttons, and panel tabs through the shared binder. Entry-surface styling still owns background/border/shadow, while motion composes on top instead of overwriting the rest of the visual state.
  - `src/animation/index.ts` now separates micro-interaction exports from advanced scene-effect exports. `SubtleEffects` plus the shared motion math remain the production hot-path lane; cloner/effector/field/fluid/particle tooling stays available for authored or lab-style scenes instead of becoming the default explorer-row runtime.
- Durable product note:
  - Treat interaction motion like icon packs or top bars: a shell identity layer with theme defaults plus user control, not a one-off explorer experiment.
  - Keep authored `animations/` modules for overlay/shell-transition work. Explorer rows, rails, tabs, and buttons should stay on the cheap shared resolver so virtualization and pointer latency remain predictable.
- Validation:
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/interactionMotion.test.ts src/test/explorerSideRail.test.tsx src/test/workbenchTopBar.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "updates interaction motion settings and exposes motion-lab preview surfaces" --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "routes explorer entry and preview workflow tab motion through the shared interaction resolver" --reporter=dot`
  - note: the full `src/test/fileExplorer.viewModes.test.tsx` suite still hits a Vitest worker heap OOM in this workspace, so the stable signal for this pass is the targeted resolver test above rather than the whole file
  - note: the full `src/test/settingsPage.behavior.test.tsx` suite still contains the pre-existing `Top Bars` assertion failure unrelated to the interaction-motion changes

# 2026-04-21 - Top Bars Became A Standalone Appearance System

- The global shell top bar is no longer trapped inside the active theme's workbench recipe. Top bars now resolve through their own catalog and selection path, so users can pin a shell-header workflow independently from the active theme while theme packages still publish defaults.
- Durable implementation shape:
  - `src/config/topBars.ts` is the new source of truth for top-bar variants. It defines built-in top bars, the control-zone schema (`leadingControls`, `navigationShortcuts`, `trailingControls`), legacy fallback from `theme.workbench.topBarStyle`, and the active selection resolver used by both the shell and Settings.
  - `src/components/WorkbenchTopBar.tsx` now owns the shell-header renderer. `App.tsx` resolves the active top bar and passes a data-driven definition into that component instead of owning one monolithic `TopBar` implementation inline.
  - `src/store/settingsStore.ts` now persists `settings.appearance.activeTopBarId`; `null` means "follow theme". This keeps user-pinned top bars stable across sessions without hijacking theme selection.
  - `src/config/appearance.ts` now allows themes to declare `defaultTopBarId`. Theme packages load top-bar contributions through `src/config/themePackages.ts`, qualify package-local ids, and surface those variants in `LoadedOverlayThemePackage.topBars`.
  - `src/components/SettingsPage.tsx` now has a dedicated `Top Bars` section with `Follow Theme` plus pin-able built-in and package-contributed top bars. This is the intended user-facing control surface for shell-header workflow swapping.
- Durable product note:
  - Treat top bars like icon packs or wallpapers: a modular shell-identity layer that can follow theme defaults but is not synonymous with theme selection.
  - New shell-header workflow work should extend `src/config/topBars.ts` and `src/components/WorkbenchTopBar.tsx`. Do not regress to re-embedding top-bar selection logic inside `theme.workbench` or back into `App.tsx`.
- Validation:
  - passed: `bunx vitest run src/test/topBars.test.ts src/test/themePackageExplorerRecipe.test.ts src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - passed: filtered touched-path typecheck via `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "App\\.tsx|WorkbenchTopBar\\.tsx|SettingsPage\\.tsx|themePackages\\.ts|appearance\\.ts|topBars\\.ts|settingsStore\\.ts|chromeEffects\\.ts|ExplorerSideRail"`, which only surfaced pre-existing `ExplorerSideRail.tsx` errors unrelated to this top-bar work
  - note: repo-wide `bunx tsc --noEmit --pretty false -p tsconfig.json` is still blocked by the existing `src/components/explorer/ExplorerSideRail.tsx` `bindRailMotion` errors on this branch

# 2026-04-21 - PDF Preview Pane Now Uses Shared Explorer Preview Theme Surfaces

- The embedded PDF workbench no longer ships its own hardcoded navy/blue shell. Its chrome now reads from the same explorer preview theme contract as the other preview lanes, so theme swaps and layout variants do not leave PDF on a private color system.
- Durable implementation shape:
  - `src/components/ExplorerPdfWorkbench.tsx` now routes the root/header/footer surfaces, save button, edit-tool palette, dialog buttons, and PDF form-field chrome through `--overlay-explorer-preview-*` and `--overlay-explorer-chip-*` variables instead of fixed `rgba(...)` / `#2563eb` values.
  - Lane status pills (`Saved`, `Unsaved`, `Saving`) now use the shared shell semantic colors `--overlay-success`, `--overlay-danger`, and `--overlay-warning` instead of lane-local hardcoded colors.
  - Content-specific PDF annotation defaults remain intact, but the surrounding preview shell now matches the SQLite/audio/video/image preview language.
  - `src/test/explorerPdfWorkbench.test.tsx` now locks the themed surface contract by asserting that the rendered PDF chrome points at the shared explorer preview tokens.
- Durable product note:
  - If future PDF work adds more pane chrome, keep it on the explorer preview token set first. PDF can have domain-specific document tooling, but it should not grow a private shell palette again.
- Validation:
  - passed: `bunx vitest run src/test/explorerPdfWorkbench.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-21 - Canonical Built-In Theme Now Advertises The Full UI Slot Surface

- The icon-theme runtime could already override app chrome, but the built-in canonical manifest only declared `folder_tree`, which made most of the UI contract invisible even though Lucide fallback still rendered.
- Durable implementation shape:
  - `src/config/canonicalIconTheme.json` now includes every `AppIcons.tsx` slot under `uiIcons`, mapped to its built-in `lucide:*` fallback reference.
  - `scripts/sync-canonical-ui-icons.mjs` is the tracked sync path for that contract. It parses `src/components/AppIcons.tsx` and rewrites the canonical `uiIcons` table so new app glyphs do not stay implicit.
  - `src/test/iconTheme.test.ts` now locks the built-in surface by asserting that every `createThemedIcon(...)` slot has a matching canonical `uiIcons` entry.
- Durable product note:
  - Treat `canonicalIconTheme.json` as the public built-in icon contract. If a slot exists in `AppIcons.tsx` but not in the canonical manifest, the theme system is incomplete even if fallback Lucide rendering still works.

# 2026-04-21 - Icon Theme Selection IDs Now Normalize Before Lookup

- Icon theme packs are normalized to canonical ids like `zen` when they load, so persisted selections must normalize too or the app silently falls back to Lucide even though the pack is installed.
- Durable implementation shape:
  - `src/config/iconThemePackages.ts` now owns `normalizeIconThemePackageSelectionId(...)` and `resolveLoadedIconThemePackage(...)`, which means the same mixed-case/whitespace-tolerant lookup logic is shared by the main shell, Settings, and the file-operations window.
  - `src/store/settingsStore.ts` now canonicalizes `appearance.activeIconThemeId` during merges and updates, which repairs old persisted values like `Zen` into `zen` instead of preserving a lookup miss forever.
  - `src/test/iconThemePackages.test.ts` and `src/test/settingsStore.test.ts` now lock the legacy-id path so authored packs keep applying even if earlier sessions stored display-name casing instead of the normalized package id.
- Durable product note:
  - Treat icon-theme ids as canonical machine ids, not display labels. UI can show `Zen`, but persisted lookups should always normalize through the package selection helper before comparing or rendering.

# 2026-04-21 - Git Manager Branch Selector No Longer Falls Back To Native White Chrome

- The Git manager branch picker no longer renders as a browser-native white box inside dark themes. The control now uses shell-owned select styling so branch switching reads like part of the Git header instead of a default form widget.
- Durable implementation shape:
  - `src/components/GitManager.tsx` now gives the branch selector a dedicated themed select contract: explicit dark/light `colorScheme` resolution from the resolved palette, `appearance: none`, a custom caret, and a shell-owned background/border instead of relying on UA-native select chrome.
  - The branch label wrapper was simplified so the select itself is the intentional control surface. This removes the old nested label shell that still let the native white box leak through.
  - The select-style helper is currently local to `GitManager.tsx` so the fix can land without touching other in-flight settings/audio work in the tree, but it is shaped to be reusable when more dropdown cleanup passes happen.
- Durable product note:
  - Any new select in Git or other dark-shell panels should opt into shell-owned form styling immediately. Native browser select chrome is not visually stable enough for GreebleFS themes.
- Validation:
  - passed: `bunx vitest run src/test/gitManager.history.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-21 - Wildcard Preview Tabs And Audio VST Workflow

- The shared Explorer preview header is no longer a hardcoded binary toggle. It now supports lane-owned wildcard workflow tabs while keeping the canonical non-edit-first ordering.
- Durable implementation shape:
  - `src/components/explorer/explorerPreviewWorkflowTabs.ts` is the shared contract for preview workflow tabs. It always builds the canonical built-in tabs first, then appends normalized wildcard tabs such as audio `VST`.
  - `src/components/FileExplorer.tsx` `PreviewPanel` now owns wildcard-tab registration and active-tab normalization. Wildcard tab ids are live preview UI state only; they are reset on preview path/type changes and are not persisted into explorer session state.
  - `src/components/ExplorerAudioWorkbench.tsx` now uses three workflows: `preview`, `edit`, and `vst`. `Preview` is dense and themed, `Edit` keeps trim/fade/export only, and `VST` is a host-dominant lane with compact plugin-picking chrome so the pane mostly belongs to the plugin UI.
  - `crates/vst-host/src/lib.rs` now resolves real VST3 load targets instead of assuming the user-picked `.vst3` path is always a directly loadable library. It handles flat binaries plus bundle layouts and rejects foreign-platform binaries for the current host.
  - `src-tauri/src/vst_commands.rs` now only surfaces host-ready VST3 entries in the picker, which prevents Linux/macOS from advertising incompatible Windows plugin binaries as selectable VSTs.
  - `src-tauri/src/audio_engine.rs` now stores deck-level `activePluginPath` plus `vstParameters`, and failed plugin loads now resolve into `deck.error` state instead of rejecting the whole preview workflow with an unhandled promise.
  - `src/runtime/audioVstEditorBackend.ts` plus `src-tauri/src/vst_host_runtime.rs` now own editor-session lifecycle and rect sync for the VST lane.
  - `crates/vst-host/src/lib.rs` also now follows the real VST3 module lifecycle on Linux/macOS instead of treating `GetPluginFactory` as sufficient. The loader activates the module (`ModuleEntry` / `bundleEntry`), passes a minimal `IHostApplication` context, instantiates the controller through `IComponent::getControllerClassId()` when available, and only calls the module exit hook after the COM objects have been terminated and released.
- Current limitation:
  - The VST session bridge is still honest scaffolding. It can validate/load plugins, track session state, and sync the requested host rect, but it still reports `attachMode: unavailable`. True inline native editor embedding and actual VST DSP insertion into the realtime audio render path are still pending.
- Validation:
  - passed: `cargo test --manifest-path Cargo.toml -p vst-host`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - passed: `bunx vitest run src/test/explorerAudioWorkbench.test.tsx --reporter=verbose --pool=forks`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx --reporter=verbose --pool=forks`
  - note: running both large Vitest files together with the default worker pool still hit a worker heap OOM in this workspace, so the stable validation signal is the per-file `--pool=forks` runs above.

# 2026-04-21 - Zen App-Chrome Coverage Is Now One Slot Per SVG

- The Zen icon pack stopped being a partial example with shared UI aliases. It is now the gold reference for fully tweakable app chrome.
- Durable implementation shape:
  - `packages/UI/scripts/generate_greeblefs_zen_ui_icons.py` now self-maps every `src/components/AppIcons.tsx` slot to its own `ui/<slot>.svg`, which means the top-bar, explorer toolbar, preview controls, and other shell chrome all have dedicated authored assets instead of aliasing back to older generic ids.
  - The same generator now also emits a dedicated `panel_sketchfab.svg` so the plugin tab row is covered without relying on a model fallback.
  - `src/test/iconThemePackages.test.ts` now checks the whole `AppIcons.tsx` slot surface against the Zen manifest, which makes alias regressions visible immediately.
- Durable product note:
  - If a future UI icon slot is added, it should get three things in the same pass: the `AppIcons.tsx` export, a Zen SVG from the generator, and a test expectation proving the slot self-maps.

# 2026-04-21 - Zen Now Covers The App-Chrome Slot Surface, Not Just Explorer Files

- The Zen icon pack is now the reference example for the full app icon contract, not only explorer file/folder glyphs.
- Durable implementation shape:
  - `src/components/AppIcons.tsx` remains the slot registry for app chrome. New shell glyphs should be added there first, then materialized into authored packs.
  - `packages/UI/scripts/generate_greeblefs_zen_ui_icons.py` is the repo-visible coverage generator. It reads the AppIcons slot list, emits `icon-themes/Zen/ui/*.svg`, and rewrites `icon-themes/Zen/icon-theme.json` so app slots like `camera`, `folder_tree`, `hard_drive`, `puzzle`, `settings2`, `sliders_horizontal`, and `sticky_note` are all first-class theme targets.
  - The sources toggle in the top bar is now covered by a real Zen SVG instead of a Lucide fallback, so the example pack demonstrates how to theme the top-bar rail controls as well as panel tabs.
- Durable product note:
  - Treat Zen as the gold example for authored icon packs. Future icon-slot work should update the slot registry, rerun the generator, and keep the generated pack committed so new themes can copy the exact manifest surface.

# 2026-04-21 - 3D Model Thumbnails Are Now Cached GPU Posters

- Explorer grid thumbnails now render `.fbx`, `.glb`, `.gltf`, `.obj`, and `.stl` as GPU-generated poster images instead of leaving them on file icons.
- Durable implementation shape:
  - `src/runtime/modelThumbnailRenderer.ts` owns a shared three.js WebGL renderer, lighting rig, and camera framing logic, and it serializes renders through a single queue so thumbnail generation does not churn WebGL contexts.
  - `src/runtime/modelThumbnailBackend.ts` turns `FileEntry` metadata into stable cache keys, stores poster data URLs in `src/components/explorer/explorerPreviewCache.ts`, and returns a normal `ExplorerEntryThumbnail` with `kind: "image"` so the explorer grid can stay unchanged.
  - `src/components/FileExplorer.tsx` now branches the thumbnail batch loader: model extensions go through the new backend, while the existing native explorer bridge still handles image, code, shader, audio, and video thumbnails.
  - `src/components/SettingsPage.tsx` now exposes a `3D Models` thumbnail toggle, `src/config/explorerThumbnails.ts` adds `includeModels`, and `src/config/filePreview.ts` keeps model extensions out of editable-text routing.
- Validation:
  - passed: `bunx vitest run src/test/filePreview.test.ts src/test/explorerThumbnails.test.ts src/test/settingsStore.test.ts src/test/modelThumbnailBackend.test.ts src/test/modelPreview.utils.test.ts src/test/modelPreviewSource.test.ts --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "modelThumbnailBackend|modelThumbnailRenderer|FileExplorer\\.tsx|SettingsPage\\.tsx|explorerThumbnails\\.ts|filePreview\\.ts|settingsStore\\.test\\.ts|modelThumbnailBackend\\.test\\.ts|modelPreview\\.utils\\.ts|modelPreviewSource\\.ts" || true`
- Durable product note:
  - This first pass stays in the frontend GPU stack. If future work needs native or Python-side thumbnail rasterization, keep the cache key and returned `ExplorerEntryThumbnail` shape stable so the explorer grid does not need a second thumbnail contract.

# 2026-04-21 - Explorer Semantic Search And Similarity V1

- Explorer search no longer has only a names-vs-content boolean. The durable shell contract is now an explicit `searchMode` enum with `name`, `content`, and `semantic`, and that mode is persisted in `src/store/explorerStore.ts` with legacy `searchIncludeContent` payloads normalized forward on hydration.
- Durable implementation shape:
  - `src-tauri/src/semantic_search.rs` is the new native orchestrator for semantic indexing, querying, similarity search, and index summary loading. It keeps the v1 scope intentionally narrow: local roots only, text/code files only, manual task-center flows only (`build`, `rebuild`, `clear`), and app-local SQLite storage under the explorer data root.
  - `src-python/greeblefs_sidecar/semantic_search_runtime.py` is the embedding/search engine. It owns chunking, backend resolution, embedding generation, chunk/file similarity scoring, and direct SQLite writes/reads. Backend resolution prefers ONNX/Torch GPU-capable paths when the acceleration routing resolves to CUDA, but still falls back cleanly to CPU-capable paths.
  - `src-python/greeblefs-python-sidecar.json` plus `src-python/greeblefs_sidecar/actions.py` now advertise dedicated semantic actions (`semantic.index_root`, `semantic.query_index`, `semantic.find_similar_file`, `semantic.delete_index`, `semantic.index_status`) instead of hiding this behind generic Python execution.
  - `src/config/semanticSearch.ts`, `src/config/semanticSearchFileTypes.json`, and `src/config/semanticSearchRuntime.json` are the TS-side source of truth for the search-mode enum, semantic file-type allowlist, chunk/model defaults, and mode labels/descriptions. Keep future expansion data-driven there instead of hardcoding more extension/model lists in components.
  - `src/runtime/explorerBackend.ts` is the only TS bridge for the semantic-search command surface. `src/components/FileExplorer.tsx` now reuses the existing omnibox and result flow, but adds semantic mode cycling, semantic status chips, index-management toolbar controls, semantic snippets/scores in search results, and a built-in `Find Similar` context-menu + hotkey path for eligible local text/code files.
  - `src/config/hotkeys.ts` and `src/components/SettingsPage.tsx` now treat semantic search as first-class workflow surface with `cycleExplorerSearchMode` and `findSimilarSelection`. The old `toggleExplorerSearchScope` hotkey is migrated forward for compatibility.
- Durable product note:
  - Semantic search is additive, not a replacement. Classic name/content search still routes through the native filesystem search commands, while semantic search routes through the Python sidecar plus the acceleration control plane.
  - CUDA is optional here too. If the sidecar is absent, Torch/ONNX GPU providers are unavailable, or the machine is not NVIDIA-capable, indexing and querying still work through CPU-capable backends.
  - V1 is intentionally not a global AI librarian. It does not index cloud roots, PDFs, Office docs, image/audio/video content, or watcher-driven background changes yet. If future work expands scope, treat that as a deliberate v2 contract change, not a silent broadening of the current manifest.
- Validation:
  - passed: `python3 -m py_compile src-python/greeblefs_sidecar/*.py`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml semantic_search --quiet`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/hotkeys.test.ts src/test/explorerStore.test.ts src/test/fileExplorer.searchTelemetry.test.tsx --reporter=dot`

# 2026-04-21 - Sources Rail Toggle Is Now A Compact Icon Slot

- The explorer no longer wastes a whole helper row just to reopen the sources rail. The closed-rail affordance is now a compact icon button in the shared chrome strip, and the old `Open Sources` row has been removed.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now renders `toggleSources` as a compact `FolderTree` icon button with an accessible open/close label instead of the previous text chip plus duplicate helper row.
  - `src/config/explorerChromeLayouts.ts` moved `toggleSources` to the leading `primaryStart` slot in the built-in toolbar layouts so it behaves like a nav control rather than a secondary action.
  - `src/config/canonicalIconTheme.json` now exposes a minimal `uiIcons.folder_tree` slot, and `icon-themes/Zen/icon-theme.json` mirrors that slot so authored packs can restyle the control through the normal icon-theme path.
  - `src/test/fileExplorer.viewModes.test.tsx`, `src/test/explorerChromeLayouts.test.ts`, and `src/test/iconThemePackages.test.ts` now lock the compact toggle placement and the new icon-slot contract.
- Durable product note:
  - Keep the sources rail toggle compact and icon-driven. Do not reintroduce a separate open-sources helper row unless the shell explicitly needs a second affordance for a different interaction.
- Validation:
  - passed: `bunx vitest run src/test/explorerChromeLayouts.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/iconThemePackages.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "toggles the sources panel from the explorer hotkey" --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "can render global controls on the explorer topbar surface" --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "keeps the sources rail toggle compact in multi-pane mode" --reporter=dot`

# 2026-04-21 - Timeline Surface Now Splits Fresh Activity Into Hour Bands

- Timeline Surface no longer jumps straight from same-day work into broad daily/week buckets at max granularity. The densest timeline stop now isolates newest activity into explicit hour bands so recent edits read like a real time surface instead of a generic "today" pile.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` `buildTimelineSurfaceBands(...)` now computes clock-hour boundaries and, at the `details` density stop, emits `This Hour` plus `N Hours Ago` bands for the last 6 hours before rolling the rest of the day into `Earlier Today`, then continuing into `Yesterday`, week, month, year, and archive bands.
  - `src/config/explorerExperimentalModes.ts` now exposes `Hours` as the densest timeline granularity label and updates the Timeline Surface description to mention hourly browsing.
  - `src/test/explorerExperimentalModes.test.ts` and `src/test/fileExplorer.viewModes.test.tsx` now lock both sides of the contract: the density descriptor says `Hours`, and dense timeline rendering actually places fresh files into the expected hourly sections.
- Durable product note:
  - Keep hourly slicing limited to the densest timeline stop. Coarser stops should still favor broad scanability over front-edge precision, or Timeline Surface will turn into noise.
- Validation:
  - passed: `bunx vitest run src/test/explorerExperimentalModes.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "timeline surface|hourly bands" --reporter=dot`

# 2026-04-21 - Markdown Preview Now Uses Explorer Theme Surfaces

- Markdown preview no longer ships with a lane-local hardcoded dark background. The rendered document surface now follows the active explorer/theme tokens, so the current light shell gets the white or near-white preview users expect while dark themes remain dark instead of being forced onto one fixed paper mode.
- Durable implementation shape:
  - `src/components/documentPreview.tsx` now routes markdown preview backgrounds, code blocks, tables, borders, and link chrome through existing overlay/explorer CSS variables instead of fixed dark hex and RGBA fills.
  - The shared HTML preview wrapper in the same component now uses the explorer preview background token too, but the iframe body stays isolated and white so arbitrary HTML documents remain sandboxed instead of being host-themed.
  - `src/components/FileExplorer.tsx` now sends any text preview with a real rendered `renderKind` into `preview` mode, not just `html`. That fixes the older mismatch where `.html` opened as a rendered preview but `.md` still dropped into Monaco edit mode.
  - `src/test/documentPreview.test.tsx` and `src/test/fileExplorer.viewModes.test.tsx` now lock both sides of the contract: markdown preview surfaces use theme vars, and selecting a markdown file in Explorer opens the rendered preview lane with the shared preview header chrome intact.
- Durable product note:
  - Treat markdown/html document preview like the other modern preview lanes: the shell owns the surrounding preview surface and theme tokens, while the document renderer only owns safe content rendering. Do not reintroduce lane-local hardcoded backgrounds in `documentPreview.tsx`.
- Validation:
  - passed: `bunx vitest run src/test/documentPreview.test.tsx src/test/fileExplorer.viewModes.test.tsx --reporter=dot`
  - repo-wide / filtered TypeScript check is still blocked by a pre-existing `src/components/FileExplorer.tsx` script-preview type error unrelated to this markdown change

# 2026-04-21 - Cross-Provider Acceleration Control Plane For CUDA / AI / Native GPU Routing

- GreebleFS now has a reusable acceleration-control seam above the native `wgpu` runtime. The point is to stop future CUDA, AI indexing, inference, similarity, media, or file-operation offload work from inventing ad hoc provider checks in random panels or commands.
- Durable implementation shape:
  - `src-tauri/src/acceleration_runtime.rs` is the new host-side control plane. It reads the existing `GpuRuntimeManager` snapshot, inspects Python-sidecar availability, optionally calls the managed sidecar action `acceleration.cuda_probe`, and returns a typed provider catalog plus workload routing snapshot through Specta.
  - The control plane intentionally separates provider kinds from workloads. Current provider kinds are `cpu`, native `wgpu`, and `cudaPython`; current workload ids are `thumbnails`, `mediaPipelines`, `highVolumePreviews`, `aiIndexing`, `localInference`, `similaritySearch`, `directStorage`, and `fileHashing`.
  - `src-python/greeblefs-python-sidecar.json` now advertises the `acceleration.cuda_probe` action and a `cuda-ai-indexing` preset for the managed runtime. That preset is the current install baseline for Torch / ONNX / embedding-style local AI work instead of forcing each future feature to list packages separately.
  - `src-python/greeblefs_sidecar/actions.py` now owns the first CUDA/AI probe. It reports Python version, platform, `CUDA_VISIBLE_DEVICES`, PyTorch CUDA visibility/device details, ONNX Runtime provider availability, and optional module presence for packages commonly needed by local indexing/search pipelines.
  - `src/config/accelerationRuntime.ts` is the TS-side routing catalog. It owns routing mode labels (`auto`, `preferNative`, `preferCuda`, `cpuOnly`), workload metadata, provider lookup helpers, and the canonical “which provider should handle this workload?” resolution logic.
  - `src/runtime/accelerationRuntimeBackend.ts` and `src/store/accelerationRuntimeStore.ts` are the only TS entry points for hydrating or observing that acceleration snapshot. `src/App.tsx` now hydrates the feed on boot, and `src/components/SettingsPage.tsx` exposes a dedicated `Acceleration Pipeline` section with routing controls, provider cards, workload-resolution preview, and a manual `Probe CUDA / AI` action.
  - `src/store/settingsStore.ts` now persists `settings.system.accelerationRoutingMode`, so future CUDA-first features can follow a shared user preference instead of each feature adding its own provider toggle.
- Durable product note:
  - Keep the layers distinct. `src-tauri/src/gpu_runtime/` is still the execution/runtime lane for native `wgpu` workloads. `src-tauri/src/acceleration_runtime.rs` is the control plane that decides which provider family is even available for a given class of work.
  - If a future feature wants NVIDIA acceleration, start by asking whether it fits an existing workload id and provider-routing rule. Extend the workload catalog or provider probe first; do not bury new CUDA branching inside one panel or command.
  - `preferCuda` is intentionally non-destructive. If the Python sidecar is absent, its CUDA probe action is unavailable, or CUDA libraries are not actually ready, the system still resolves back to native `wgpu` or CPU instead of failing the whole feature surface.
- Validation:
  - passed: `python3 -m py_compile src-python/greeblefs_sidecar/*.py`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml provider_statuses_mark_python_cuda_ready_when_probe_reports_cuda --quiet`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/pythonConfig.test.ts src/test/pythonRuntimeBackend.test.ts src/test/accelerationRuntimeConfig.test.ts src/test/accelerationRuntimeStore.test.ts --reporter=dot`

# 2026-04-21 - Constellation View Now Uses A Real Full-Canvas Camera

- Constellation view no longer behaves like a decorative section inside the explorer scroll column. It now claims the full explorer canvas and uses its own camera model for zoom/pan, which makes the mode feel like a dedicated workspace instead of an inline experiment.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now treats Constellation as an immersive canvas mode. The explorer scroll viewport switches to a constrained full-height content contract while Constellation is active, so the outer file list no longer becomes the primary scroll surface behind the graph.
  - Constellation camera math now routes through the explorer-local helper `src/components/explorer/constellationCamera.ts`. That helper owns fit-zoom, zoom clamping, cursor-anchored wheel zoom, centered pan clamping, and node-centering helpers instead of burying geometry rules inside the main explorer component.
  - Plain wheel input over the Constellation field now zooms the field camera, while the existing Ctrl/Cmd+wheel explorer-density path still works inside Constellation. This preserves the power-user density control without forcing users to scroll the whole explorer page just to inspect the map.
  - Drag-to-pan now uses a thresholded pointer gesture with click suppression, so a pan gesture no longer misfires as a node click after movement. The mode also keeps user-owned camera state until the scene changes, instead of constantly snapping back to a selected node after interaction.
  - The earlier explanatory overlay card was intentionally removed after review. The only persistent Constellation chrome is now a compact top-right telemetry chip for essential camera/density/map state, which keeps the surface legible without narrating the feature every time it is used.
  - Double-clicking empty Constellation space now reframes the full map, which gives users a recovery path after deep zoom/pan without adding another permanent button bar.
- Durable product note:
  - Treat Constellation like a camera-driven explorer surface, not a list variant. If future work touches this mode, prefer compact ambient telemetry and direct manipulation over explanatory overlay cards or extra page chrome.
  - The field-level wheel handler is intentionally scoped to the Constellation viewport only. Do not broaden it to the full explorer shell or normal row/grid views will regress.
- Validation:
  - passed: `bunx vitest run src/test/constellationCamera.test.ts src/test/constellationLayout.test.ts src/test/fileExplorer.viewModes.test.tsx --reporter=dot`
  - touched-path typecheck remains clean; repo-wide `bunx tsc --noEmit --pretty false -p tsconfig.json` is still blocked by unrelated pre-existing `SettingsPage.tsx` implicit-`any` errors plus acceleration-runtime generated-binding drift

# 2026-04-21 - Settings Rail Now Prioritizes Core Config And Uses Themed Select Surfaces

- The settings rail no longer opens with visual garnish ahead of machine and workflow controls. Core configuration now sits at the top, and the form controls that still depended on native select chrome no longer flash white-on-white against dark themes.
- Durable implementation shape:
  - `src/components/SettingsPage.tsx` now derives a settings form `colorScheme` from the active theme palette and reuses shared field/select style helpers for settings inputs that need real themed control surfaces. Selects now explicitly opt into themed rendering with a custom caret instead of falling back to OS-default white boxes.
  - Terminal-facing selects such as `Cursor Style` and `External Terminal Profile`, plus shared system selects like telemetry capture/payload mode and Linux display backend, now all ride the same settings select contract. Folder-icon fallback/rule selects were moved onto the same contract so settings form controls stop drifting section by section.
  - The left rail order is now intentionally operational first: `Overview`, `System`, `Terminal`, `Explorer`, `Layouts`, `Hotkeys`, `Cloud`, `Screenshots`, `Audio`, then the appearance stack (`Appearance`, `Icons`, `Wallpapers`, `Shaders`, `Animations`, `Theme JSON`).
  - The Overview shortcut card now mirrors that priority shift by surfacing `System`, `Terminal`, `Explorer`, and `Layouts` before theme authoring paths.
- Durable product note:
  - Treat settings ordering as product guidance, not arbitrary alphabet soup. Machine-level behavior, navigation/workflow configuration, and shell-operating defaults should come before appearance toys.
  - If new settings sections are added later, decide whether they belong in the core-operational band or the appearance-authoring band before dropping them into the rail.
- Validation:
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx src/test/settingsPage.shaders.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-21 - Icon Themes Now Own Panel Tabs And Plugin Tab Glyphs

- The shell icon-theme system no longer stops at generic stock UI glyphs. Built-in top-bar panels and folder-plugin tabs now have their own reserved icon-theme slots, so packs can restyle explorer-adjacent chrome without special-casing panel components.
- Durable implementation shape:
  - `src/config/iconTheme.ts` now exposes `createPanelIconSlotId(panelId)` and `resolvePanelIconReference(panelId, iconTheme)` as the canonical panel-slot helpers. The reserved contract is `uiIcons.panel_<normalized-panel-id>`.
  - `src/components/AppIcons.tsx` now exports `ThemedPanelIcon`, which resolves panel-specific slots first, then falls back to a generic UI slot, then finally to the Lucide fallback component. `src/panels/panelRegistry.tsx` uses that path for every built-in panel plus every folder plugin panel definition.
  - `src/components/SettingsPage.tsx` now previews the panel-slot contract directly in the `Icons` section, including built-ins and the bundled `drawable-canvas` plugin. The preview also surfaces the exact slot id so authored packs and future LLMs can copy the convention without spelunking through the registry code.
  - `icon-themes/Zen/icon-theme.json` now acts as the gold example for panel theming. It ships dedicated SVGs for `panel_storage`, `panel_notes`, `panel_screenshots`, `panel_plugins`, `panel_settings`, `panel_drawable_canvas`, `panel_chronorift`, `panel_filesystem_aquarium`, and `panel_vibe_capsule`, while also demonstrating that plugin slots can alias existing art via `panel_sketchfab: model3d`.
  - Zen also maps generic shell UI slots like `hard_drive`, `sticky_note`, `camera`, `puzzle`, `settings2`, and `sliders_horizontal` back onto those new panel glyphs, so theme authors can see how panel-specific art and broader shell UI coverage can share the same manifest assets.
- Durable product note:
  - Treat `panel_<id>` as the stable contract for any panel-tab icon that should be themeable. New built-in panels and new folder plugins should not wire custom icon rendering paths when a manifest slot can cover the same need.
  - Keep icon-theme behavior declarative. If a theme wants a plugin tab to look custom, add a `uiIcons.panel_<plugin-id>` entry in the pack instead of teaching the shell about that plugin’s brand.
- Validation:
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/iconThemePackages.test.ts src/test/panelRegistry.test.tsx src/test/settingsPage.behavior.test.tsx --reporter=dot`

# 2026-04-21 - Explorer Bottom Bar Now Hosts The Full View-Switch Strip

- The explorer no longer traps its experimental view surfaces behind a top-toolbar `Labs` launcher. The bottom status bar is now the primary quick-switch host for explorer view states.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now renders a five-button footer view switcher anchored at the far right of the status bar. The host exposes icon view, list view, adaptive semantic grid, constellation view, and timeline surface. The redundant “standard explorer” button was removed, and icon/list now act as the standard-view exit path by proxy.
  - The old top-toolbar `experimentalModes` control is retired from the visible chrome path, and the status footer no longer prints `Experimental:` copy for those alternate views. The existing density HUD still hangs off the footer switcher so Ctrl/Cmd+wheel and footer activation keep their feedback loop.
  - The explorer task badge no longer participates in the same flowing status-bar chrome layout as the footer text. `FileExplorer.tsx` now renders it as a fixed centered status-bar anchor so the task button stays dead center while the view switcher stays locked to the far-right edge.
  - `src/config/explorerChromeLayouts.ts` now reserves the far-right status-bar edge for the footer view host and moves transient clipboard/loading summaries out of that corner, which protects icon muscle memory from shifting with ephemeral status text.
- Durable product note:
  - Treat the status-bar view switcher as the growth lane for power-user explorer surfaces. If more explorer-specific view states arrive, add them to the same data-driven host instead of reintroducing another top-level mode launcher.
  - Existing keyboard coverage still applies here: `toggleExplorerLayout` plus Ctrl/Cmd+wheel remain the settings-backed rapid-switch path, so the footer refactor did not require a second shortcut system.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/explorerChromeLayouts.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-21 - Managed Python Sidecar And Embedded PyO3 Lane

- GreebleFS now has a first-class Python integration path that is meant to be reused across explorer, workbench, and automation features instead of spawning ad hoc scripts from random modules.
- Durable implementation shape:
  - `src-python/` is the repo-owned Python workspace. `src-python/greeblefs-python-sidecar.json` is the manifest source of truth for sidecar metadata, quick-install package presets, and the action catalog future frontend/backend callers should consume.
  - `src-python/greeblefs_sidecar/` is the persistent stdio JSON-line sidecar package. Built-in actions currently cover runtime summary, ML/runtime probing, directory scanning, and hash calculation, but the intended workflow is to keep extending this action registry instead of scattering one-off Python entrypoints.
  - `src-tauri/src/python_commands.rs` owns managed interpreter discovery, virtualenv bootstrap, package installation, and direct command/script/module execution.
  - `src-tauri/src/python_sidecar.rs` owns syncing `src-python` into the managed runtime, starting/stopping the long-lived sidecar, logging stderr to the managed runtime logs directory, validating the manifest/handshake, exposing typed start/status/call commands through Specta, and now exposing backend-facing typed helper APIs plus built-in action ids for other Rust modules.
  - `src-tauri/src/python_pyo3.rs` is the lightweight in-process Python lane. Use it for small pure-Python transforms that are cheaper to run inside Rust than through the full sidecar, and prefer its decoded JSON helper when the caller wants typed payload/result handling instead of raw strings.
  - `src/runtime/pythonRuntimeBackend.ts` is the frontend seam. React surfaces should call this layer for runtime bootstrap, package install, sidecar lifecycle, manifest-backed action runners, and embedded Python helpers instead of wiring raw Tauri command strings into components.
  - `src/components/TerminalOverlay.tsx` is the current operator surface for the feature. It exposes managed-runtime status, sidecar lifecycle buttons, and a few built-in sidecar actions so the system can be exercised without adding another bespoke UI first.
- Durable product note:
  - Default to the Python sidecar for filesystem-heavy work, ML/ONNX/Torch/CUDA-adjacent work, or features that need third-party Python packages.
  - Default to `pyo3` only for small synchronous helpers that do not need sidecar state, a managed venv package set, or heavyweight imports.
  - Keep the sidecar manifest data-driven. New quick presets or actions should start in `src-python/greeblefs-python-sidecar.json`, then flow outward into TS/Rust consumers.
  - The managed runtime still seeds its compatibility boilerplate package directory as `overlayterm_runtime`; treat that as a migration concern, not a casual rename.
- Validation:
  - passed: `python3 -m py_compile src-python/greeblefs_sidecar/*.py`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml python_ -- --nocapture`
  - passed: direct sidecar stdio smoke against `python3 -m greeblefs_sidecar`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml embedded_python_executes_json_returning_callable -- --nocapture`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-21 - Git Manager Now Has A Real History Lane And Branch Metadata

- The Git panel is no longer only a working-tree staging view. It now has a first-class `Changes | History` split inspired by the Xplorer reference, while still staying inside GreebleFS-owned seams.
- Durable implementation shape:
  - `src/runtime/gitPanelBackend.ts` is now the Git panel's shared TS runtime seam for repo-overview loading, local branch metadata, upstream ahead/behind counts, commit-log parsing, commit-file parsing, and commit patch loading. If future Git UI grows, extend this bridge instead of scattering more raw git parsing inside React.
  - `src/components/GitManager.tsx` now uses that runtime seam to enrich repo state with `upstreamName`, `aheadCount`, `behindCount`, and the local branch list. The header now exposes branch switching plus a dedicated `Fetch` action in addition to `Pull` / `Push`.
  - `src/components/GitHistoryPanel.tsx` is the new history surface. It adds a searchable grouped commit timeline, `Current Branch` vs `All Branches` history scope, changed-file browsing per commit, and inline per-file patch preview for historical commits.
  - The existing working-tree staging flow stayed intact: Stage/Commit/Quick Ship/file-level diff actions remain in the `Changes` tab, while historical inspection moved into the dedicated history lane.
- Durable product note:
  - Treat Git history as part of the Git manager contract now, not as a future addon. If new Git features are added, prefer splitting them by intent: working-tree mutation in `Changes`, repository archaeology in `History`, and shared metadata in `gitPanelBackend.ts`.
  - Branch metadata is now part of repo state. Future branch features should build on the existing branch list/upstream/ahead-behind shape instead of inventing another partial branch loader.
- Validation:
  - passed: `bunx vitest run src/test/gitPanelBackend.test.ts src/test/gitManager.utils.test.ts src/test/gitManager.behavior.test.tsx src/test/gitManager.history.test.tsx src/test/sourceRepositoryImportFlow.integration.test.tsx --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "gitPanelBackend|GitHistoryPanel|gitManager.history|gitPanelBackend.test" || true`

# 2026-04-21 - Shared Preview Header Mode Order Is Now Canonical

- The shared Explorer preview header no longer lets editable lanes drift between `Edit | Preview` and `Preview | Edit`. The canonical left-to-right contract is now the non-edit mode first, edit second.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now defines shared mode-toggle option constants for the preview header instead of repeating lane-local arrays. Standard editable lanes use `Preview | Edit`; executable text previews use `Run | Edit`, which preserves the same non-edit-first pattern.
  - Audio and video preview lanes inherit that contract through the shared fallback toggle group, while text/image/spreadsheet/shader reuse the same canonical option definitions.
  - `src/test/fileExplorer.viewModes.test.tsx` now includes a reusable button-order assertion and locks the order across script, HTML, spreadsheet, audio, video, shader, PDF, and editable image preview lanes.
- Durable product note:
  - Treat preview-header mode order as shell contract, not lane flavor. If a preview surface supports an edit mode, the leftmost mode button must represent the non-edit state and the next one must be `Edit`.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "FileExplorer.tsx|fileExplorer.viewModes.test.tsx" || true`

# 2026-04-21 - SQLite Preview Is Now Searchable, Streamed, And Grid-First

- SQLite preview in the explorer pane no longer behaves like a mini paginated database app with duplicated file metadata chrome. The pane is now table-first: compact horizontal table chips, one active-table control bar, then the data grid.
- Durable implementation shape:
  - `src/components/ExplorerSqlitePreview.tsx` dropped the redundant top identity banner and now keeps only the power-user controls that materially help inspection inside a narrow preview pane: table switcher, in-table search, row-density mode (`Dense` / `Table` / `Wrap`), clickable column sorting, and streamed row loading.
  - Pagination chrome is gone from the SQLite lane. Instead, the grid pulls rows through a `Load More` action plus near-bottom auto-streaming, so large tables keep the preview-pane silhouette and do not waste vertical space on page controls.
  - `src-tauri/src/sqlite_commands.rs` now exposes `sqlite_query_table_window` and the typed `SqliteTableQueryRequest` / `SqliteTableQueryResult` contract. The backend handles case-insensitive row search across visible columns, validated sortable columns/directions, primary-key fallback ordering when no sort is selected, filtered row counts, and the next stream offset.
  - `src/generated/tauri.ts` now includes the SQLite window-query contract, and `src/runtime/tauriClient.ts` should keep consuming the generated bridge instead of carrying a second hand-written SQLite command wrapper.
  - `src/test/explorerSqlitePreview.test.tsx` now locks the new behavior instead of the old page model: it covers streamed row loading, search reset when switching tables, sort cycling, and the preview-width layout helper.
- Durable product note:
  - Treat SQLite preview like a fast inspection surface, not a full query IDE. Keep the grid dominant, keep chrome sparse, and preserve the preview-pane constraint.
  - If future work adds more SQLite power features, prefer compact controls that operate on the active table rather than adding another metadata header or card stack above the grid.
- Validation:
  - passed: `bunx vitest run src/test/explorerSqlitePreview.test.tsx --reporter=dot`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml sqlite_commands -- --nocapture`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "ExplorerSqlitePreview|explorerSqlitePreview|tauriClient|src/generated/tauri.ts" || true`

# 2026-04-21 - Spreadsheet Preview Now Shares The SQLite Table Surface

- Spreadsheet preview no longer looks like a separate one-off workbench from the SQLite lane. Read-only spreadsheet preview now uses the same themed table-surface language as SQLite, while spreadsheet edit mode keeps the richer grid/formula/sheet tooling.
- Durable implementation shape:
  - Added `src/components/explorer/ExplorerTablePreviewSurface.tsx` as the shared shell for table-shaped preview lanes. It owns the responsive compact/wide breakpoint, identity header, metric pills, selector strip, dataset header, action buttons, centered fallback states, and the HTML table surface used by both SQLite and spreadsheet preview.
  - `src/components/ExplorerSqlitePreview.tsx` now composes that shared surface instead of carrying its own private table-preview chrome. The SQLite lane keeps the same pagination/query behavior, but its shell is now the reusable standard instead of a one-off implementation.
  - `src/components/ExplorerSpreadsheetWorkbench.tsx` now splits preview and edit more cleanly. Preview mode renders a read-only sheet snapshot through the shared table surface with sheet selectors, workbook/file metrics, and capped row/column previews for large sheets; edit mode still mounts `@glideapps/glide-data-grid`, the formula bar, sheet create/rename/delete actions, save flow, and close-guard behavior.
  - The spreadsheet grid theme now leans on overlay CSS variables instead of hardcoded blue-only values, so edit mode remains distinct without detaching from the active shell theme.
  - `src/test/explorerSpreadsheetWorkbench.test.tsx`, `src/test/explorerSqlitePreview.test.tsx`, and the spreadsheet-specific `src/test/fileExplorer.viewModes.test.tsx` path now lock the shared preview contract. `fileExplorer.viewModes.test.tsx` also mocks `@/components/AppIcons` back to `lucide-react` so preview tests are not blocked by the new icon wrapper layer.
- Durable product note:
  - Treat SQLite as the baseline visual language for simple table-shaped previews. If future lanes preview CSV-like, database-like, or matrix-like content, start from `ExplorerTablePreviewSurface.tsx` instead of inventing new table chrome inside the lane component.
  - Keep spreadsheet preview and spreadsheet editing separate intents. Preview should stay calm, themed, and table-forward; edit mode is where the heavier spreadsheet-native interaction model belongs.
- Validation:
  - passed: `bunx vitest run src/test/explorerSpreadsheetWorkbench.test.tsx src/test/explorerSqlitePreview.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "opens spreadsheet previews in preview mode and lets the shared preview header switch to edit" --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "ExplorerSpreadsheetWorkbench|ExplorerSqlitePreview|ExplorerTablePreviewSurface|fileExplorer.viewModes.test.tsx"`

# 2026-04-21 - Explorer Properties Checksums Now Survive Tab Remounts

- Explorer properties checksum autoload no longer trips the `getRootForUpdatedFiber` runtime path when a `FileExplorer` instance is replaced during tab/workspace swaps.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now gives recursive-size work, checksum work, and properties-info fetches their own request ids and invalidates them on unmount plus properties-panel scope changes.
  - The checksums autoload effect now defers its launch with `setTimeout(..., 0)` instead of synchronously scheduling state writes during passive-effect mount.
  - Stale checksum/info completions now bail before mutating component-local state or reopening the global properties panel after a newer panel scope takes over.
  - `src/test/fileExplorer.viewModes.test.tsx` now covers the remount case directly and clears the global `propertiesPanel` store slice in `beforeEach` so later explorer tests do not inherit dialog state.
- Durable product note:
  - The properties dialog is still store-global while its checksum/info payloads are component-local. Any future async work attached to that dialog needs both mount cleanup and scope invalidation, or explorer tab swaps will regress back into stale writes or remount-time crashes.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "FileExplorer.tsx|fileExplorer.viewModes.test.tsx" || true`

# 2026-04-20 - Shader Default Now Starts In Performance Mode

- Shell shader assignment now has a persisted `shaderPerformanceMode` setting in `src/store/settingsStore.ts` and `src/config/shaders.ts`.
- Durable implementation shape:
  - `src/config/shaders.ts` now defines `performance`, `balanced`, and `quality` shader profiles. `performance` is the default, skips automatic theme shader assignment, and lowers the live preview budget; `balanced` restores theme defaults with a capped preview; `quality` keeps theme defaults and spends more on the preview host.
  - `src/App.tsx` and `src/components/SettingsPage.tsx` now resolve the active shell shader through the performance profile instead of always honoring the theme default.
  - `src/components/SettingsPage.tsx` now exposes a shader-performance selector in the Shaders section, and the "Follow Theme Default" action switches back to `balanced` so it actually re-enables theme defaults.
  - `src/components/FileExplorer.tsx` now opens new shader previews in the profile’s default scene instead of always choosing the sphere, and forwards the performance mode into the workbench.
  - `src/components/ExplorerShaderWorkbench.tsx` now caps WebGPU preview DPR/frame rate through the profile, uses lower-detail sphere meshes for non-quality modes, and avoids per-frame React state churn while the live preview runs.
- Durable product note:
  - The slow path was the preview/composition budget, not shader math that needed to move into Rust. Keep the shader-performance mode as a user-facing quality/perf dial rather than hiding it in backend plumbing.
- Validation:
  - passed: `bunx vitest run src/test/shaderSystem.test.ts src/test/settingsStore.test.ts src/test/settingsPage.shaders.test.tsx`
  - passed: `bunx tsc -p tsconfig.json --noEmit`
- Follow-up still recommended:
  - if users still report shell sluggishness after switching to performance mode, inspect blur/backdrop-filter and other composition layers before adding more shader logic

# 2026-04-20 - Explorer Sources Panel No Longer Piggybacks On Focus Mode

- Explorer no longer uses mode changes as the way to close or reopen the Sources rail. `Focus` remains an Explorer mode preset, but Sources visibility is now an explicit panel toggle.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now treats Sources like a real Explorer panel with one visibility truth: `session.sourcesVisible`. The toolbar `Sources` button, collapsed opener, and local `Ctrl+B` hotkey all route through the same open/close/toggle helpers, and `applyModeProfilePreset(...)` no longer mutates Sources visibility when users switch between `Balanced`, `Navigator`, `Focus`, or `Inspector`.
  - `src/components/explorer/ExplorerSideRail.tsx` replaced the old rail-header `Focus` action with an explicit `Close` action. The rail no longer asks the shell to enter focus mode just to hide itself.
  - `src/store/explorerStore.ts` removed `sourcesRailPinnedOpen` from `ExplorerSessionSnapshot`. Hydration still tolerates old persisted payloads that contain that field, derives a safe `sourcesVisible` value for legacy data, and re-persists the new session shape without the removed field.
  - `src/config/explorerShellLayouts.ts` now models rail visibility as advisory layout metadata (`defaultSourcesVisible`) instead of authoritative UI state. Layout presets still describe their default shell silhouette, but live Sources visibility is owned by the session toggle state.
  - `src/config/hotkeys.ts` and `src/components/SettingsPage.tsx` now expose `toggleExplorerSources` with default `Ctrl+B`, so Sources visibility is settings-backed and keyboard reachable.
- Durable product note:
  - Treat Explorer modes and Explorer panels as separate systems. Mode presets may still affect chrome density, preview placement, and width suggestions, but they should not silently open or close user panels.
  - If future Explorer work adds more optional surfaces, prefer the same explicit panel-toggle model instead of coupling them to mode names like `Focus` or `Inspector`.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/hotkeys.test.ts src/test/settingsStore.test.ts src/test/explorerStore.test.ts src/test/explorerChromeLayouts.test.ts src/test/explorerSideRail.test.tsx src/test/ExplorerWorkspace.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/explorerStore.test.ts src/test/fileExplorer.viewModes.test.tsx --reporter=dot`

# 2026-04-20 - Storage Workbench Scroll Containers Now Stay Constrained After Directory Expansion

- The storage panel no longer lets its matrix/types/focus surfaces grow the whole center column and shove the workbench strip out of view when a directory selection hydrates more rows.
- Durable implementation shape:
  - `src/components/StoragePanel.tsx` now treats the storage shell like a constrained workbench viewport from the root down: the panel root uses `auto + minmax(0, 1fr)` rows, the body row and mode viewport both clip overflow, the inspector column now explicitly fills its slot, and the matrix/treemap/types surfaces claim `height: 100%` so their own scroll hosts take the overflow instead of the outer panel.
  - Added stable `data-testid` hooks for the storage root/body/workspace/mode viewport/inspector layout wrappers so the scroll-contract regression can be locked without relying on brittle DOM traversal.
  - `src/test/storagePanel.layout.test.tsx` now walks the real user path that was breaking the panel: scan a root, hydrate the matrix, click into a folder, and assert the workbench shell remains constrained while the storage viewport and inspector keep their overflow boundaries.
- Durable product note:
  - Treat the storage workbench like Explorer: every parent wrapper above an `OverlayScrollArea` needs an explicit `minmax(0, 1fr)` or equivalent constrained height contract, or the table/tree will start growing the whole pane again and the workbench strip will appear to “disappear” under expansion.
- Validation:
  - passed: `bunx vitest run src/test/storagePanel.layout.test.tsx src/test/storageWorkbench.test.ts src/test/storageStore.test.ts --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "StoragePanel.tsx|storagePanel.layout.test.tsx|storageWorkbench.test.ts|storageStore.test.ts" || true`

# 2026-04-20 - Model Preview Now Uses Native Raw-Byte Transport And Blob-Backed Sidecars

- The 3D preview lane no longer routes model files through the old base64/text preview commands that capped local binaries at 12 MB and text models at 10 MB. Model preview now uses a dedicated native raw-byte preview transport for local and cloud-backed reads.
- Durable implementation shape:
  - `src-tauri/src/fs_commands.rs` now exposes `fs_read_preview_bytes`, and `src-tauri/src/cloud_commands.rs` now exposes `cloud_read_preview_bytes`. Both commands clamp requested preview reads against a hard native limit and return raw bytes through `tauri::ipc::Response` instead of JSON arrays or base64 strings.
  - `src/runtime/tauriClient.ts` and `src/runtime/explorerBackend.ts` now surface those commands as `Uint8Array` reads, so preview consumers can stay typed while bypassing JSON/base64 inflation.
  - `src/components/modelPreviewSource.ts` now loads every supported 3D source format from raw bytes. `.glb`, `.fbx`, and `.stl` parse directly from `ArrayBuffer`; `.obj` and `.gltf` decode from bytes locally; glTF sidecars now become `blob:` URLs instead of giant inlined data URIs.
  - `src/runtime/telemetry.ts` now summarizes `ArrayBuffer` and typed-array payloads by byte length so native preview transport results do not explode telemetry metadata.
  - `src/config/filePreview.ts` now treats the 3D lane like a modern preview surface instead of a legacy fallback: raw source reads and proxy thresholds were raised to 128 MB root/sidecar reads, 2M vertices, 4M triangles, and 192 meshes before proxy fallback engages.
- Durable product note:
  - Keep large binary preview paths on raw IPC responses or other binary-native transports. Do not regress model preview back to base64 or giant JSON byte arrays just because those are easier to wire.
  - glTF sidecars are no longer the bottleneck they were on April 20, 2026. If a future follow-up adds deeper OBJ/FBX material sidecar support, preserve the blob-backed resource strategy instead of reintroducing data-URI inflation.
- Validation:
  - passed: `npx vitest run src/test/modelPreviewSource.test.ts src/test/modelPreview.utils.test.ts src/test/telemetry.test.ts --reporter=dot`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml fs_read_preview_bytes --lib`
  - passed: filtered `npx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "modelPreview|telemetry|tauriClient|explorerBackend|cloud_read_preview|fs_read_preview" || true`

# 2026-04-20 - Audio Preview Now Opens As A Clean Player Before The Heavy Editor

- Explorer audio files no longer drop straight into the dense trim/export/plugin workbench. They now open in a cleaner playback-first preview surface, and the heavier audio editing tools only appear after an explicit switch into edit mode.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now treats `preview.type === 'audio'` like the other explicit preview/editor lanes: selecting an audio file forces `documentViewMode` back to `preview`, the shared preview header exposes the `Preview` / `Edit` toggle for audio, the preview label reflects preview-vs-editor state, and the explorer-level key handler now routes the settings-backed `audioWorkbenchToggleEditMode` shortcut before type-to-jump can steal the `E` key.
  - `src/components/ExplorerAudioWorkbench.tsx` now accepts `mode: 'preview' | 'edit'`. Preview mode renders a cleaner hero-style native player with restrained transport, scrub, waveform, stats, and shortcut hints, while edit mode preserves the existing trim/fade/export/plugin rack workflow instead of deleting it.
  - The audio workbench still loads analysis plus the native deck for the selected file on entry, so switching from preview into edit is a shell-state change rather than a second audio-loading path.
  - VST discovery is now scoped to edit mode. The preview-first surface does not spend startup budget scanning plugins just to show a clean player.
  - `src/config/hotkeys.ts` and `src/components/SettingsPage.tsx` now expose `audioWorkbenchToggleEditMode` with the default binding `E`, and `src/test/explorerAudioWorkbench.test.tsx`, `src/test/fileExplorer.viewModes.test.tsx`, `src/test/hotkeys.test.ts`, and `src/test/settingsStore.test.ts` lock the preview shell, hotkey, and default-binding behavior.
- Durable product note:
  - Treat audio preview and audio editing as separate user intents. Keep the first-touch audio surface calm and playback-oriented; if future work adds more mastering or plugin depth, keep it behind explicit edit mode instead of bloating the default preview again.
  - The native audio engine remains the playback truth even in preview mode. Do not regress this lane back to browser `<audio>` behavior just because the UI is calmer now.
- Validation:
  - passed: `bunx vitest run src/test/explorerAudioWorkbench.test.tsx src/test/fileExplorer.viewModes.test.tsx src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json` check returned no matching errors for the touched audio/shell/hotkey/test files

# 2026-04-20 - Explorer Preview Pane Can Lock To The Current Item

- The explorer preview pane no longer has to live-update on every selection change. Users can now lock the active preview in place while they browse other files, which is useful for following tutorial text, reference notes, or any other “keep this file visible while I navigate” workflow.
- Durable implementation shape:
  - `src/store/explorerStore.ts` now persists `session.previewLocked` alongside the existing preview shell state so the explorer session can remember whether the preview is live-following selection or intentionally frozen.
  - `src/components/FileExplorer.tsx` now distinguishes selection-driven preview loads from explicit preview actions. When `previewLocked` is on, passive selection changes from clicks or arrow-key traversal no longer replace the current preview, but explicit preview-opening actions can still deliberately retarget the pane.
  - The preview header now exposes a dedicated lock toggle, visible lock state badge, and a `data-overlay-explorer-preview-locked` attribute on the pane shell for regression coverage.
  - Preview clearing paths that fully dismiss the preview surface also clear the lock state, so the explorer does not get stranded in a hidden-but-locked mode after the pane is closed or a previewed item is moved to trash.
  - `src/config/hotkeys.ts` and `src/components/SettingsPage.tsx` now expose a settings-backed `togglePreviewLock` shortcut with the default binding `Ctrl+Alt+P`.
  - `src/test/fileExplorer.viewModes.test.tsx`, `src/test/hotkeys.test.ts`, and `src/test/settingsStore.test.ts` lock the behavior: locked previews stay fixed while selection changes, the hotkey toggles the lock state, and theme/session flows preserve the new session flag.
- Durable product note:
  - Treat preview locking as a passive-selection override, not a blanket ban on all preview changes. The lock is there to stop browsing from stealing the pane; explicit preview actions are still allowed to move the preview intentionally.
  - If future preview work adds more selection or navigation paths, keep them routed through the same selection-vs-explicit distinction so lock behavior stays predictable.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json` check reported no matching errors for the touched preview/store/hotkey/settings files

# 2026-04-20 - Spreadsheet Preview Now Opens Read-Only First And The Workbench Chrome Was De-Bloated

- Explorer spreadsheets no longer drop straight into an always-edit grid shell, and the spreadsheet workbench no longer renders the earlier pill-heavy top section.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now treats `preview.type === 'spreadsheet'` like the other explicit workbench lanes: selecting a spreadsheet forces `documentViewMode` back to `preview`, the shared preview header now exposes the same `Preview` / `Edit` toggle for spreadsheets, and the spreadsheet preview label reflects preview-vs-editor state instead of a single generic spreadsheet title.
  - `src/components/ExplorerSpreadsheetWorkbench.tsx` now requires `mode: 'preview' | 'edit'` and keeps the grid read-only in preview mode. Preview mode hides the old edit-only chrome, keeps only a compact title/reload strip plus cell inspector and sheet tabs, and removes the earlier "tabular sheet / rows / cols / edit mode" pill clutter. Edit mode restores save plus sheet-management controls, and `@glideapps/glide-data-grid/dist/index.css` is now imported so tabular sheets actually render instead of falling into the blank-body / "only A1" failure mode.
  - Spreadsheet keyboard coverage is now settings-backed for the preview/edit split: `src/config/hotkeys.ts`, `src/components/SettingsPage.tsx`, `src/test/hotkeys.test.ts`, and `src/test/settingsStore.test.ts` now include `spreadsheetWorkbenchToggleEditMode` with the same `E` default used by the PDF/shader workbenches.
  - `src/test/explorerSpreadsheetWorkbench.test.tsx` now locks the read-only preview contract plus multi-cell CSV hydration, and `src/test/fileExplorer.viewModes.test.tsx` now locks the FileExplorer-level preview-to-edit handoff for spreadsheet entries.
- Durable product note:
  - Keep spreadsheet preview and spreadsheet editing as distinct intents. Preview mode should stay quiet and document-first; if future work adds more workbook tooling, prefer putting mutations behind edit mode or the sheet strip instead of letting the top bar bloat back into a debug dashboard.
  - If the spreadsheet grid ever disappears again after package upgrades, check for the mandatory Glide CSS import first before assuming the parser/regression is in workbook hydration.
- Validation:
  - passed: `bunx vitest run src/test/explorerSpreadsheetWorkbench.test.tsx src/test/fileExplorer.viewModes.test.tsx src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

# 2026-04-20 - Model Preview Now Reads Native Files Instead Of Browser-Fetching Asset URLs

- The 3D preview lane was fighting the browser because `ModelPreview.tsx` was still handing three.js loaders `asset://` URLs via `loadAsync(...)`. That path was replaced with native file reads and parser entrypoints so local model assets stop depending on browser fetch behavior.
- Durable implementation shape:
  - `src/components/modelPreviewSource.ts` is now the source-loading seam for model previews. It reads `.glb`, `.gltf`, `.obj`, `.fbx`, and `.stl` through the explorer backend, feeds three.js loaders directly from decoded bytes/text, and never builds `convertFileSrc(...)` URLs for the main model file.
  - glTF JSON sidecars are inlined before parse: relative `buffers[]` and `images[]` references are resolved through the explorer backend, converted to data URLs, and cached so repeated references do not trigger duplicate reads.
  - `src/components/ModelPreview.tsx` now focuses on the render/normalize/proxy pipeline only. Source loading is delegated to the helper, which keeps the preview component free of browser-fighting file-IO logic.
  - `src/test/modelPreviewSource.test.ts` locks the contract: native reads are used for every supported model format, and glTF sidecars are inlined before the loader parses the document.
- Durable product note:
  - Keep local model preview off browser fetch paths. If a future preview change wants to load another model format, add a native read/parse path first instead of routing through `asset://` or `loadAsync(...)`.
  - Self-contained model files are the strongest path. glTF sidecars are now handled, but textured OBJ/FBX sidecars are still limited by the current loader strategy and should be treated as a follow-up if deeper sidecar resolution becomes necessary.
- Validation:
  - passed: `npx vitest run src/test/modelPreviewSource.test.ts src/test/modelPreview.utils.test.ts --reporter=dot`
  - passed: filtered `npx tsc --noEmit --pretty false -p tsconfig.json` check reported no matching errors for `ModelPreview.tsx`, `modelPreviewSource.ts`, `modelPreviewSource.test.ts`, or `modelPreview.utils.ts`

# 2026-04-20 - Storage Panel Waits For The Active Completed Snapshot Before Loading Directory Rows

- The storage panel could raise `Storage directory listing not found: /home/...` even after the Linux path fix because the frontend was still requesting directory children while the native scan was mid-flight.
- Durable implementation shape:
  - `src/components/storage/storageWorkbench.ts` now exposes `isStorageSnapshotReadyForDirectoryLoads(scanId, snapshot)`, which requires a completed snapshot whose `scanId` matches the active panel scan before any directory-entry fetches are attempted.
  - `src/components/StoragePanel.tsx` now clears stale scan state when a new scan begins and gates `listStorageDirectory(...)` behind that active-snapshot readiness check, so rescan transitions do not reuse the previous completed snapshot and in-progress scans do not request unpublished directory listings.
  - `src/test/storageWorkbench.test.ts` now locks the readiness rule so mismatched or incomplete snapshots stay in the non-loadable state.
- Durable product note:
  - The current storage backend only publishes `directory_entries` once `run_storage_scan(...)` finishes and installs the completed snapshot. Treat directory hydration as a completed-snapshot feature unless the backend later grows explicit streaming/partial directory publication.
- Validation:
  - passed: `npx vitest run src/test/storageWorkbench.test.ts --reporter=dot`
  - passed: filtered `npx tsc --noEmit --pretty false 2>&1 | rg "StoragePanel.tsx|storageWorkbench.ts|storageWorkbench.test.ts" || true`

# 2026-04-20 - Linux Storage Roots Now Preserve POSIX Paths And Report Real Capacity

- The storage workbench had two Unix regressions after the first storage-tab pass: frontend directory lookup normalized every root into Windows-style backslashes, and the native drive enumerator returned `0` for Unix capacity while missing common Linux removable-media mounts under `/run/media`.
- Durable implementation shape:
  - `src/components/storage/storageWorkbench.ts` now exports `normalizeStorageWorkbenchPath(...)`, which preserves POSIX separators for `/...` roots while still canonicalizing Windows drive roots and Windows-style child paths.
  - `src/components/StoragePanel.tsx` now uses that shared normalizer for selected root state and `storage_scan_list_directory(...)` lookups, so Linux/macOS scans request the same `/...` directory keys that the Rust backend stores.
  - `src-tauri/src/fs_commands.rs` now uses `statvfs` through `libc` for Unix `Root`, `Home`, and mounted-volume capacity, and Linux drive discovery now also scans nested `/run/media/*/*` mount roots in addition to `/media` and `/mnt`.
- Durable product note:
  - Do not normalize storage-workbench paths as though every host were Windows. Storage roots and directory-entry lookup keys must stay host-native, or the frontend will ask Rust for directories that were never recorded.
  - On Linux, removable drives are commonly mounted under `/run/media/$USER/...`; treat that mount root as first-class in drive discovery unless the app later moves to a fuller `/proc/mounts`-based enumeration path.
- Validation:
  - passed: `npx vitest run src/test/storageWorkbench.test.ts --reporter=dot`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml unix_ -- --nocapture`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml mount_directories -- --nocapture`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`

# 2026-04-20 - Storage Tab Rebuilt As An Explorer-Native Workbench With Batch Queue

- The storage lane is no longer a card-heavy dashboard. It now behaves like a compact Explorer workbench with a dense matrix-first shell, preview-pane inspector, type analytics, focus mode, and a staged cleanup queue.
- Durable implementation shape:
  - `src/components/StoragePanel.tsx` now uses an Explorer-like shell contract: left root/queue rail, center matrix workspace, optional `matrix` / `split-map` / `types` / `focus` modes, and a preview-pane-style inspector that can render as a side pane or inline split via persisted `previewSplitMode`.
  - The matrix is now the primary navigation surface. It renders files and folders in one hierarchy, supports subtree-percentage bars plus root-share metrics, keeps sticky sortable columns, supports keyboard navigation (`Arrow` movement, `Enter`, `Delete`, `Shift+Delete`), and keeps context-menu/selection behavior aligned with staged queue actions.
  - `src/components/storage/storageWorkbench.ts` now owns the row/tree math for matrix flattening, subtree/root percentage calculations, treemap focus resolution, and queue summaries so the panel component stays orchestration-focused.
  - `src/store/storageStore.ts` now persists the storage-session state: active mode, selected root/path set, expanded paths, sort state, preview split mode, focus path, and the staged batch queue snapshot.
  - `src/config/storageBatchQueues.ts` defines batch queues as data. The first queue is `cleanup`, which currently supports `Trash` and `Delete`, but the queue shape is meant to support additional staged workflows later.
  - `src/runtime/storageBackend.ts`, `src-tauri/src/storage_commands.rs`, and `src-tauri/src/fs_commands.rs` now expose the richer storage contract: logical vs allocated bytes, waste bytes, file extension/type buckets, direct child directory listing for dense matrix hydration, and batch delete routing through the shared Explorer task infrastructure.
- Durable product note:
  - Treat Storage as an Explorer-adjacent workbench, not a one-off analytics screen. Future features should prefer reusing Explorer shell behaviors, preview patterns, scroll treatment, and task plumbing before inventing storage-only chrome.
  - The batch queue is intentionally explicit. Selection is not the queue. Users select items, then stage them into the queue for batch execution.
  - The current performance path is still native directory walking, not the planned NTFS MFT/USN fast path. Keep the frontend contract stable so the backend can swap in a faster scan engine later without another panel rewrite.
- Validation:
  - passed: `npx vitest run src/test/panelRegistry.test.tsx src/test/storageTreemap.test.ts src/test/storageWorkbench.test.ts src/test/storageStore.test.ts --reporter=dot`
  - passed: filtered `.\node_modules\.bin\tsc.exe --noEmit --pretty false -p tsconfig.json` check reported no matching errors for the touched storage frontend files
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml storage_scan_ -- --nocapture`

# 2026-04-20 - Image Preview Now Opens Fullscreen-First And Save Falls Back To The Explorer Backend

- Editable raster image previews no longer drop users straight into the full adjustment/crop toolbar, and local save no longer hard-fails when the Tauri fs plugin is missing from the host.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now treats editable image previews like an explicit preview/edit lane: selecting an image forces `documentViewMode` back to `preview`, exposes `Preview` / `Edit` controls in the preview header, and passes that mode into `ExplorerImageEditor.tsx`.
  - `src/components/ExplorerImageEditor.tsx` now supports `mode: "preview" | "edit"`. Preview mode keeps the fullscreen pannable/zoomable image surface and hides edit-only chrome; edit mode restores save/reset/crop/filter controls.
  - `src/config/filePreview.ts` now exposes shared editable-image helpers so `FileExplorer.tsx` and `ExplorerImageEditor.tsx` agree on which extensions should surface the image editor lane and which MIME/content type each editable raster format should save with.
  - Image save now degrades gracefully: the editor can still try `@tauri-apps/plugin-fs` for local files, but when that plugin is unavailable it falls back to `writeExplorerFile(...)` through `src/runtime/explorerBackend.ts`, which is already backed by the app's typed native filesystem command surface.
- Durable product note:
  - Keep fullscreen browsing and destructive image editing as separate intents. If the image lane grows more tools later, preserve the preview-first entry point so simple browsing/panning is not buried under crop/filter chrome again.
  - Do not build new explorer save flows around frontend-only plugin registration assumptions. The typed explorer backend is the stable contract when the Tauri host does not explicitly install a matching plugin.
- Validation:
  - passed: `npx vitest run src/test/explorerImageEditor.test.tsx src/test/fileExplorer.viewModes.test.tsx --reporter=dot`
  - passed: filtered `tsc --noEmit -p tsconfig.json` check reported no matching errors for `ExplorerImageEditor.tsx`, `FileExplorer.tsx`, `filePreview.ts`, `explorerImageEditor.test.tsx`, or `fileExplorer.viewModes.test.tsx`

# 2026-04-20 - Video Preview Now Defaults To Playback, Not Edit Chrome

- Explorer video preview no longer drops users straight into the full trim/inspector editor.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now treats video previews like other explicit preview/edit lanes: selecting a video forces `documentViewMode` back to `preview`, exposes the preview-header `Preview` / `Edit` toggle for videos, and passes that mode into `ExplorerVideoEditor.tsx`.
  - `src/components/ExplorerVideoEditor.tsx` now supports `mode: "preview" | "edit"`. Preview mode shows a playback-first `<video controls>` surface with lightweight source-status footer copy, while edit mode keeps the existing trim timeline, transform/color inspector, and export tooling.
  - The video surface now tracks readiness separately from `duration === 0`, so loading/error overlays do not misclassify every not-yet-probed file as an unplayable editor session.
  - Runtime fallback behavior is still intact: direct-source failure in the webview retries through `videoCreatePreviewProxy(...)`, and preview mode still surfaces proxy/direct status in the footer instead of silently burying playback failure state under editing chrome.
- Durable product note:
  - Keep video preview and video editing as separate user intents. If future work expands the editor, preserve a clean playback-first entry point so codec/debugging work is not hidden behind trim/crop UI again.
  - This pass did not replace the underlying webview paint path with a native renderer; if playback is still bad on specific hosts, the next layer to inspect is the direct/proxy source contract and system `ffmpeg` / codec availability, not the old “always open the editor” shell behavior.
- Validation:
  - passed: `npx vitest run src/test/explorerVideoEditor.test.tsx src/test/fileExplorer.viewModes.test.tsx -t "falls back to a generated proxy when direct playback fails in the webview|keeps preview mode focused on playback instead of mounting edit-only controls|defaults videos to playback preview and only enters video edit mode when requested"`
  - passed: filtered TypeScript check reported no matching errors for `ExplorerVideoEditor`, `FileExplorer`, `explorerVideoEditor.test`, or `fileExplorer.viewModes.test`

# 2026-04-20 - First-Class Storage Tab Added

- Added a built-in `storage` panel so the workbench can do WinDirStat-style storage inspection without leaving the app.
- Durable implementation shape:
  - `src/components/StoragePanel.tsx` is the panel shell. It asks the user which local drive/root to scan, shows an elevation-status banner, starts a native scan, polls live progress, renders a treemap, and exposes open/reveal/rescan/trash/permanent-delete actions on the selected path. The shell now uses a compact left navigation rail plus a scrollable workspace so the storage lane feels closer to the other panels instead of a full-width card stack.
  - `src/runtime/storageBackend.ts` is the single TS bridge for this lane. It wraps typed Tauri storage commands and reuses the existing explorer filesystem operations for destructive actions instead of inventing a second delete/trash stack.
  - `src-tauri/src/storage_commands.rs` owns the native scan implementation. It walks the filesystem on a background thread, tracks progress and cancellation, records the largest files/directories, and returns a condensed tree with synthetic `Other` buckets so the frontend can render a useful treemap without trying to mount the full filesystem.
  - `src/components/storage/storageTreemap.ts` keeps the treemap layout math pure and testable outside the panel.
  - `src/panels/panelRegistry.tsx` now registers `storage` as a built-in browse panel and includes it in the built-in panel catalog so it is a real first-class citizen of the workbench, not an ad hoc modal or plugin-only surface.
  - Completed native scan snapshots are pruned from the backend registry when newer scans start, so repeated rescans do not accumulate stale in-memory tree state for the rest of the session.
- Durable product note:
  - Destructive parity with WinDirStat depends on process elevation. The storage panel intentionally surfaces that state: protected/system paths can only be deleted when GreebleFS itself is running elevated and the OS allows the operation.
  - The current scan path is native, threaded, and progress-aware, but still uses a direct filesystem walk rather than MFT/USN-journal tricks. If future work needs another major speed jump on NTFS volumes, add it behind `storage_commands.rs` without changing the panel contract or the new rail/workspace layout.
- Validation:
  - passed: `npx vitest run src/test/panelRegistry.test.tsx src/test/storageTreemap.test.ts --reporter=dot`
  - passed: filtered `.\node_modules\.bin\tsc.exe --noEmit --pretty false -p tsconfig.json` produced no errors for `StoragePanel.tsx`, `storageTreemap.ts`, `storageBackend.ts`, `panelRegistry.tsx`, or the touched tests
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml storage_scan_ -- --nocapture`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - note: repo-wide `tsc` is still red in the unrelated nested `src/src/frontend/**` tree

# 2026-04-20 - Desktop Clean Install Launcher Added

- Added a double-clickable Windows desktop batch launcher that wraps `install.ps1` for one-click clean reinstalls.
- Durable implementation shape:
  - the launcher is intentionally thin and delegates the real work to the PowerShell installer
  - double-clicking it rebuilds the app, removes the prior install and state roots, then launches the fresh build
  - this keeps the desktop workflow simple while preserving the real cleanup logic in one source of truth
- Durable product note:
  - keep the desktop launcher and `install.ps1` in sync if the repo root or install contract changes, so the one-click path does not drift from the actual build/install behavior
- Validation:
  - launcher file written to the Windows desktop; the full clean-install path was not executed in this pass

# 2026-04-19 — Explorer Workspace Chrome Now Uses One Shared Focused-Pane Strip

- The explorer workspace no longer spends vertical space on both a monolithic tab bar and per-pane header chrome.
- Durable implementation shape:
  - `src/components/explorer/ExplorerWorkspace.tsx` now keeps one shared `workspaceHeader` strip, scopes `workspaceTabs` to `workspace.focusedPane`, uses compact `P1` / `P2` / `P3` / `P4` pane switcher chips only in multi-pane layouts, and routes duplicate/close/commander/split actions through a single overflow menu instead of permanently rendering every pane action inline.
  - Pane-local header rows were removed from `ExplorerWorkspace.tsx`; pane identity is now carried by the shared strip plus active-border treatment instead of repeating `Pane 1`, tab counts, and copied path chrome inside every pane.
  - `src/components/FileExplorer.tsx` now accepts `workspacePaneCount` so explorer instances can enter a denser workspace presentation. In multi-pane layouts it suppresses the side preview surface while preserving preview state, hides the status bar, removes low-value location strips, collapses the closed-sources explainer copy, tightens toolbar spacing, and hides more optional chrome in `4-Up`.
  - `src/config/explorerChromeLayouts.ts` now exposes `workspacePaneActionsMenu` as a first-class workspace chrome control so theme/layout overrides can still position the new overflow trigger.
- Durable product note:
  - Treat explorer workspace tabs as pane-scoped state with a focused-pane presentation, not a global strip of every tab in every pane. If future work adds more pane actions or workspace chrome controls, prefer extending the overflow menu or the compact pane switcher before reintroducing a second row of pane-local labels.
  - For multi-pane explorer work, prefer density presets over raw scaling. `workspacePaneCount` is now the contract that tells `FileExplorer.tsx` when shared chrome should get out of the way.
- Validation:
  - passed: `.\node_modules\.bin\tsc.exe --noEmit --pretty false`
  - passed: `npx vitest run src/test/ExplorerWorkspace.test.tsx --reporter=dot`
  - passed: `npx vitest run src/test/fileExplorer.viewModes.test.tsx -t "compacts explorer chrome and suppresses the side preview in multi-pane mode|collapses the closed sources rail helper copy in multi-pane mode|applies the aggressive compact preset in four-pane workspace mode|restores the remembered preview when workspace compaction ends|honors the preview toggle before opening previewable files|shows a friendly empty preview state while preview mode is enabled|only shows the preview split toggle when a preview is active" --reporter=dot`

# 2026-04-19 - Windows Clean Install Script Added

- Added a root-level Windows PowerShell entrypoint at `install.ps1` so the app can be rebuilt and reinstalled from one command on a Windows workstation.
- Durable implementation shape:
  - the script builds first, then clears the prior per-user install and managed user-state roots, and only then installs the fresh `greeblefs.exe`
  - cleanup covers current and legacy `GreebleFS` / `OverlayTerm` roots under `%LOCALAPPDATA%` and `%APPDATA%`, plus current-user Desktop and Start Menu shortcuts
  - `-UninstallOnly` reuses the same cleanup path without reinstalling
  - the script depends on Bun and Cargo, matching the repo's primary build tooling instead of introducing a second Windows-only build path
- Durable product note:
  - treat `install.ps1` as the canonical Windows clean-install flow. If future release work changes the install root, app identifiers, or managed-state locations, update the script and the docs together so the uninstall path stays honest.
- Validation:
  - syntax-checked locally after authoring; the full Windows build/install path was not executed in this pass

# 2026-04-19 — Explorer Preview And Editor Lanes Now Share Automatic Resilience Rules

- The explorer preview shell now treats corruption, unsupported formats, cache pressure, invalid edits, and save failures as shared system behaviors instead of scattered per-file-type branches.
- Durable implementation shape:
  - `src/components/explorer/explorerPreviewSystem.ts` now owns data-driven preview descriptor resolution plus the shared loading/error/unsupported fallback builders used by `FileExplorer.tsx`. Preview routing is no longer a long per-extension branch inside the shell.
  - `src/components/FileExplorer.tsx` now routes preview entry opening through that shared resolver, lets non-executable unsupported files land in the preview fallback instead of immediately escaping to external open, and uses a generic preview close-guard path so spreadsheet/PDF/shader lanes can block preview switches without type-specific hardcoding.
  - `src/components/explorer/explorerPreviewCache.ts` now provides a byte-budgeted preview cache with oldest-entry eviction. Text and image preview payloads use that cache, and explorer cache invalidation now clears preview payloads by path prefix too.
  - `src/components/explorer/explorerEditSession.ts` now owns persisted draft storage, rename-time draft moves, validator wrappers, and the standard “Draft preserved; use Save to retry.” failure message. Text and shader preview drafts now survive save failures and preview teardown, and text previews now expose an explicit retryable Save action in the preview chrome.
  - `src/runtime/spreadsheetWorkbook.ts` now exports `validateSpreadsheetRawCellContent(...)`, and `src/components/ExplorerSpreadsheetWorkbench.tsx` rejects invalid cell edits before they mutate workbook truth, restores the formula bar on rejected commits, and preserves the in-memory draft plus retry messaging when save fails.
  - `src/components/ExplorerPdfWorkbench.tsx` now validates required/selectable form edits from field metadata, rejects invalid dropdown/checkbox edits before they mutate saved form state where practical, validates the full form again before save, and preserves draft state with retry messaging on save failure.
- Durable product note:
  - Treat preview resilience as a shell-wide contract. New preview/editor lanes should extend `explorerPreviewSystem.ts`, `explorerPreviewCache.ts`, and `explorerEditSession.ts` first instead of growing one-off fallback, cache, or retry logic inside each workbench.
  - Unknown small files still intentionally route through the generic text-preview heuristic; unsupported fallback is for entries the resolver cannot safely classify as previewable. Keep that distinction explicit if preview heuristics change.
- Validation:
  - passed: `bunx tsc --noEmit --pretty false`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/explorerPdfWorkbench.test.tsx src/test/explorerSpreadsheetWorkbench.test.tsx src/test/explorerPreviewCache.test.ts --reporter=dot`

# 2026-04-19 — Explorer Hot Paths Now Defer Viewport Background Work And Reuse Sorted Search Cache Snapshots

- Explorer scroll/search hot paths now do less synchronous churn while preserving current UI behavior.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now builds `visibleEntryLookup` / `visibleEntryIndexLookup` once per visible-entry set so keyboard selection, shift-range expansion, jump-filter activation, and hover-scrub validation stop rescanning the full explorer list on each interaction.
  - Explorer background loaders for entry sizes, native icons, and generated thumbnails now run off a deferred virtualized-entry slice instead of the raw live viewport slice. Fast scroll still updates visible rows immediately, but expensive side effects wait for a calmer viewport snapshot before scheduling backend work.
  - Text preview metrics now use deferred preview content in `FileExplorer.tsx`, and `src/config/explorerMonaco.ts` computes chars/words/lines in one pass instead of repeated `split()` allocations.
  - `src-tauri/src/fs_commands.rs` now stores warm recursive search indexes as sorted shared `Arc<[...]>` snapshots. Warm names-only and content-enabled cache hits no longer clone full cache vectors just to sort them again, and names-only cache hits can stop once the requested result count is filled.
  - `src-tauri/src/fs_commands.rs` now has a regression test that proves warm names-only cache hits preserve sorted path ordering.
- Durable product note:
  - Treat explorer viewport rendering and explorer background enrichment as separate lanes. Rendering should respond immediately to scroll/selection, while icons/thumbnails/size probes should tolerate slight deferral to keep pointer and keyboard interactions smooth.
  - For recursive search caches, prefer “sort once on store, filter many times on hit” over “clone and sort on every lookup.” If future cache work touches directory listings or other warm indexes, keep this pattern in mind.
- Validation:
  - passed: `bunx vitest run src/test/explorerMonaco.test.ts --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false 2>&1 | rg "src/components/FileExplorer.tsx|src/config/explorerMonaco.ts" || true`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml search_entries_names_only_ -- --nocapture`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml search_entries_content_reuse_cached_index -- --nocapture`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`

# 2026-04-19 — Explorer Monaco Preview Now Shows Line/Cursor Status And Uses A Shared Fast Path

- Explorer text previews and shader edit previews now share one settings-backed Monaco configuration instead of each surface hardcoding its own small option bag.
- Durable implementation shape:
  - `src/config/explorerMonaco.ts` now owns the preview-editor policy: settings-backed font/cursor/wrap values, dynamic gutter sizing, disabled expensive Monaco extras, large-file-friendly limits, and a shared text-metrics helper for chars/words/lines.
  - `src/components/FileExplorer.tsx` now routes the Monaco text preview through that shared builder, gives the editor a stable `path` so Monaco can reuse per-file model/view state, and keeps a preview-status strip that shows chars/words/lines plus live `Ln / Col` cursor state when the Monaco surface is active.
  - `src/components/ExplorerShaderWorkbench.tsx` now uses the same preview Monaco builder for the editable shader lane, so the preview-pane editor behavior stays consistent across plain text and shader authoring.
  - `src/test/explorerMonaco.test.ts` locks the shared Monaco preview contract, and `src/test/fileExplorer.viewModes.test.tsx` now asserts that the preview status strip surfaces the expected text metrics and initial cursor location.
- Durable product note:
  - Treat explorer Monaco usage as a shared preview-surface runtime, not a pile of per-component one-off option literals. If future work adds more preview-pane Monaco surfaces, extend `src/config/explorerMonaco.ts` first so performance and editor behavior stay aligned.
  - Keep preview-pane Monaco optimized for reading and quick edits: visible line numbers, explicit line/cursor status, saved view state per file path, and expensive IDE-only widgets disabled unless the product deliberately wants them back.
- Validation:
  - passed: `bunx vitest run src/test/explorerMonaco.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "shows Monaco text preview metrics and cursor location in the preview status strip|switches text files back to Monaco with a loading fallback while text content resolves" --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false` check returned no matching errors for `src/config/explorerMonaco.ts`, `src/components/FileExplorer.tsx`, `src/components/ExplorerShaderWorkbench.tsx`, `src/test/explorerMonaco.test.ts`, and `src/test/setup.tsx`

# 2026-04-19 — Explorer Arrow Navigation Now Drives Immediate Preview Updates

- Explorer keyboard selection now treats directional movement as first-class navigation instead of a partial up/down-only selection helper.
- Durable implementation shape:
  - `src/config/hotkeys.ts` now defines settings-backed explorer movement bindings for `explorerMoveSelectionUp`, `explorerMoveSelectionDown`, `explorerMoveSelectionLeft`, and `explorerMoveSelectionRight`, with matching coverage exposed in `src/components/SettingsPage.tsx`.
  - `src/components/FileExplorer.tsx` now keeps keyboard focus and range-anchor state separate, so repeated `Shift` selection extension grows from the original anchor instead of drifting with the active row.
  - Explorer keyboard movement now updates the preview immediately for the newly focused file while moving through entries, and it scrolls the newly focused entry into view when that DOM node exists.
  - Directional movement is now layout-aware: list/table presentations move vertically, while icon/grid presentations use the live grid column count so left/right/up/down follow the actual tile layout.
  - Preview-panel close behavior now distinguishes between the explicit toolbar preview toggle and the panel close button: the panel close button still hides preview mode, but the next plain explorer selection can reopen preview in the remembered pane mode.
  - Explorer virtualization now has an unmeasured-viewport fallback that renders the full visible entry window until the scroll area reports real dimensions, and resolved directory navigation commits synchronously so deep-scroll folder navigation does not strand the destination listing.
- Durable product note:
  - Treat explorer keyboard traversal as equivalent to pointer traversal for preview refresh. If future work adds more explorer layouts or alternate navigation modes, keep the directional-index resolver and preview refresh path aligned so keyboard users always see the active file immediately.
  - Keep the toolbar preview toggle as the persistent enable/disable control, but treat the preview-pane close button as a temporary dismissal that can be re-armed by the next plain explorer selection.
- Validation:
  - passed: `bunx vitest run src/test/hotkeys.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "extends the selection with shift+arrow navigation|updates the preview while arrow navigation moves through row-based explorer views|uses the icon-grid layout for left-right-up-down explorer navigation" --reporter=dot`
  - note: the full `src/test/fileExplorer.viewModes.test.tsx` file is currently red in this worktree due separate in-flight Monaco preview / fallback-preview changes already present in `src/components/FileExplorer.tsx` and adjacent preview tests.

# 2026-04-19 — Constellation Mode Rebuilt As A Pannable Command Field

- Constellation mode no longer renders stacked per-band orbit cards with a centered `Orbit Map` explainer panel.
- Durable implementation shape:
  - `src/components/explorer/constellationLayout.ts` now builds one larger constellation field layout with distinct semantic-band clusters, bridge/link lines, cluster beacons, and a stable phyllotaxis-style node spread instead of stadium orbit lanes around a protected center safe zone.
  - `src/components/FileExplorer.tsx` now renders constellation mode as a single drag-to-pan command field with background grid treatment, floating cluster chips, and tighter node cards that only keep persistent labels on anchors/selected nodes so the surface reads cleaner under density.
  - The old explanatory band copy is no longer rendered inside the constellation surface, and the center explainer card is gone entirely.
  - Follow-up tuning tightened dominant-band packing so only a small anchor quota stays in the inner ring; the remaining folders fan out as satellites and the node cards are smaller by default, which prevents single-band folder maps from collapsing into one oversized pile at the center.
  - `src/test/constellationLayout.test.ts` now locks the new cluster-spread, density-cap, and selected-node-focus layout contract, while `src/test/fileExplorer.viewModes.test.tsx` now asserts the new `Constellation field` surface exists and the `Orbit Map` card text stays absent.
- Durable product note:
  - Treat constellation as an interactive spatial browser, not a decorative per-band infographic. Keep future work centered on node clarity, panning/focus behavior, and relationship legibility instead of reintroducing explanatory chrome in the middle of the field.
- Validation:
  - passed: `bunx vitest run src/test/constellationLayout.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "activates constellation view without mutating the saved normal layout mode" --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json` check for `constellationLayout`, `FileExplorer.tsx`, and `fileExplorer.viewModes.test.tsx` returned no matching errors

# 2026-04-19 — Explorer Preview Shell Stays Mounted In Idle State

- Explorer preview mode now treats the preview pane as a persistent shell, not a conditional side effect of an active selection.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now keeps the preview panel mounted whenever preview mode is enabled outside compact dock mode, even when no file or folder is selected.
  - The empty preview surface now renders a friendly idle card that tells the user the preview is ready and invites them to select any file or folder.
  - The preview panel header close button now turns preview mode off, so the shell can still be dismissed cleanly instead of leaving a dead empty pane behind.
- Durable product note:
  - Treat preview mode as a visible workspace state with an explicit idle presentation. Do not regress back to a hidden preview pane that only appears after the first selection.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "honors the preview toggle before opening previewable files|shows a friendly empty preview state while preview mode is enabled|only shows the preview split toggle when a preview is active" --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false`

# 2026-04-19 — Explorer Image Editor Now Has Live Preview Pan/Zoom

- The shell-owned image editor preview now behaves like an actual viewport instead of a static poster frame.
- Durable implementation shape:
  - `src/components/ExplorerImageEditor.tsx` now tracks preview scale plus pan offsets in React state, applies them to the live preview `<img>`, and clamps movement against the preview viewport so wheel zoom and drag pan stay bounded.
  - The reset/save/crop-apply flows now restore the preview fit state so the viewport does not carry stale pan/zoom after the image content changes.
  - A small zoom HUD is rendered directly on the preview surface so users get visible feedback that the editor is interactive.
- Durable product note:
  - Keep this interaction model aligned with the video editor surface: scroll zoom should stay pointer-centric, drag should move the preview image, and the preview viewport should remain separate from crop mode.
- Validation:
  - passed: `bunx vitest run src/test/explorerImageEditor.test.tsx --reporter=dot`
  - passed: `bun run build`
  - note: `src/components/FileExplorer.tsx` and `src/generated/tauri.ts` were already dirty in the worktree before this pass and were left untouched.

# 2026-04-19 — Native Audio Preview Now Falls Back To FFmpeg For Modern Formats

- Explorer audio preview now has a more forgiving native decode path instead of assuming Symphonia can handle every container/codec variant by itself.
- Durable implementation shape:
  - `src-tauri/src/audio_engine.rs` now tries Symphonia first, then falls back to a temporary `ffmpeg`-to-WAV transcode when native probing/decoding fails. That keeps the native deck path alive for formats that are better handled by the host codec toolchain.
  - `src/config/filePreview.ts` now treats `aifc` as part of the audio-preview family alongside the existing `aif` / `aiff` aliases, and `src-tauri/src/thumbnail_commands.rs` classifies it as audio for generated thumbnails as well.
  - `src/test/filePreview.test.ts` now locks the new alias routing, and `src-tauri/src/audio_engine.rs` has a fixture-backed smoke test that generates and verifies modern audio formats across `wav`, `aif`, `aiff`, `aifc`, `aac`, `alac`, `caf`, `flac`, `m4a`, `m4b`, `mka`, `mp3`, `oga`, `ogg`, `opus`, `weba`, and `wma`.
- Durable product note:
  - Keep the native audio lane Symphonia-first for performance, but do not treat Symphonia as the only decode backend. `ffmpeg` is the safety valve for the preview pane when users drop in a format the Rust decoder cannot open cleanly.
- Validation:
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml audio_engine::tests::analyze_audio_file_native_supports_common_modern_formats -- --nocapture`
  - passed: `bunx vitest run src/test/filePreview.test.ts --reporter=dot`

# 2026-04-19 — Host-Aware Cargo Suite Green On Linux

- The repo-wide Rust suite should be run through `node scripts/run-cargo-tests.mjs` on Linux, not raw `cargo test --workspace`, because the workspace includes host-specific crates that are not meant to build everywhere.
- Durable runner behavior:
  - `scripts/run-cargo-tests.mjs` now injects `--test-threads=1` by default unless the caller explicitly passes a test-thread override.
  - The runner already skips macOS/Windows-only crates on Linux, so the suite stays green without pretending unsupported packages are runnable.
- Durable backend/test fixes that were needed to get the suite green:
  - `src-tauri/src/fs_commands.rs` now invalidates the parent directory listing cache when a file path is refreshed externally, so directory listings pick up newly created siblings.
  - `src-tauri/src/plugin_commands.rs` now normalizes ignored-directory detection across `/` and `\`, skips Unix permission probing for missing backend executables, and has host-specific success tests for Unix shell backends plus Windows cmd backends.
  - `src-tauri/src/shader_preview_commands.rs` now reflects the inspector contract more honestly in tests by only asserting live preview when a stage/entry point is selected.
  - `src-tauri/src/fs_commands.rs` test-only direct filesystem helpers were kept so the crate does not hang on the scheduler path during unit tests.
- Validation:
  - passed: `node scripts/run-cargo-tests.mjs`
  - result: 39 packages passed, 3 packages skipped for host mismatch, 0 failed

# 2026-04-19 — Cargo Test Suite Now Defaults To Serial Libtest Execution

- The repo-wide Rust suite had hidden shared-state flakes when `cargo test` ran each crate’s libtest harness in the default parallel mode. The failures showed up in `src-tauri` cache tests even though the targeted tests passed in isolation.
- Durable runner shape:
  - `scripts/run-cargo-tests.mjs` now injects `--test-threads=1` by default for each crate’s test binary.
  - Explicit test-thread overrides still win if the caller passes `--test-threads` or `--test-threads=<n>` after `--`.
  - The runner still executes crates serially across the workspace list, so the suite now has deterministic package ordering plus deterministic libtest ordering.
- Durable test-fixture shape:
  - `src-tauri/src/entry_size_cache.rs` now uses an env-var guard in tests so `OVERLAYTERM_ENTRY_SIZE_DB_PATH` is restored even if a test panics.
  - `src-tauri/src/fs_commands.rs` now clears fs caches at the start of `external_path_invalidation_refreshes_parent_directory_listing_cache` so the test cannot inherit stale directory-list state from earlier cases.
- Durable product note:
  - For this repo’s Rust tests, prefer deterministic serial execution for stateful crates over relying on libtest parallelism. If a crate truly wants parallel tests, make the shared state explicit and opt back in with a thread override.
- Validation:
  - passed: targeted `cargo test` runs for `entry_size_cache::tests::persisted_entry_sizes_round_trip`
  - passed: targeted `cargo test` runs for `fs_commands::tests::external_path_invalidation_refreshes_parent_directory_listing_cache`
  - passed: targeted `cargo test` runs for `explorer_pro_commands::tests::batch_rename_apply_uses_the_preview_evaluator`
  - in progress: `node scripts/run-cargo-tests.mjs --workspace root` is executing successfully with the serial harness and progressing through the workspace package list

# 2026-04-19 — Rust Test Suite Modernization For `src-tauri`

- The `src-tauri` test surface was still carrying old `tauri::test::mock_app`-style patterns for logic that does not actually need a runtime handle. That made the suite brittle and kept direct helper tests tied to the Tauri test harness.
- Durable cleanup shape:
  - `src-tauri/src/fs_commands.rs` now tests the real internal async helpers directly through local shims instead of fabricating a mock app handle. The test layer now covers list-dir, uncached list-dir, search, search diagnostics, and size measurement without going through the command wrappers.
  - `src-tauri/src/plugin_commands.rs` now exercises backend resolution and execution through a direct test shim instead of a mocked Tauri app.
  - `src-tauri/src/video_engine.rs` test fixtures were updated to match the current `AudioDeckState` shape.
  - `src-tauri/src/explorer_pro_commands.rs` now uses a non-empty rename search in `batch_rename_apply_uses_the_preview_evaluator`, because the old empty search did not actually exercise the preview evaluator path.
- Durable product note:
  - For Rust unit tests in this repo, prefer direct helper coverage over Tauri runtime mocks when the code under test is already pure or only needs local state. Keep the runtime harness for integration-style command testing, not for every internal helper.
  - When a test name says it is verifying preview/apply behavior, make sure the fixture actually hits the preview/apply path. Empty search strings can silently collapse into no-op rename behavior.
- Validation:
  - passed: targeted `cargo test` runs for `fs_commands::tests::search_entries_names_only_reuse_cached_index`
  - passed: targeted `cargo test` runs for `fs_commands::tests::measure_entry_sizes_reports_files_and_nested_directory_totals`
  - passed: targeted `cargo test` runs for `explorer_pro_commands::tests::batch_rename_apply_uses_the_preview_evaluator`
  - note: full `cargo test --manifest-path src-tauri/Cargo.toml` is still a heavy suite and needs a long, uninterrupted run to finish cleanly on this machine

# 2026-04-19 — Linux Video Preview Proxy Fallback For Explorer MP4 Playback

- The preview-pane video editor could fail on Linux even for `.mp4` files because the shell still renders through an HTML `<video>` element inside the desktop webview, and the backend "fallback" path was transcoding unsupported inputs into another `mp4`/H.264/AAC proxy.
- Root cause:
  - `src/components/ExplorerVideoEditor.tsx` relied on `videoResolvePreviewSource(...)` during load, but if the webview rejected "direct" playback at runtime it only surfaced an error; it did not retry with a generated proxy.
  - `src-tauri/src/video_commands.rs` always emitted preview proxies as `mp4`, which does not help on Linux builds whose WebKit/GStreamer stack lacks the expected MP4 codec support.
- Durable fix shape:
  - `src-tauri/src/video_commands.rs` now emits platform-safe preview proxies: Linux gets `webm` preview proxies encoded as VP9 + Opus, while non-Linux builds keep the existing faststart `mp4` H.264 + AAC proxy path.
  - `src/components/ExplorerVideoEditor.tsx` now routes through `src/runtime/videoEditorBackend.ts`, preserves the resolved source kind/MIME type, and automatically retries with `videoCreatePreviewProxy(...)` if direct playback fails in the webview at runtime.
  - The preview player now mounts a `<source>` element with the resolved MIME type instead of relying on a bare `src`, which gives the webview a stricter content hint during playback selection.
  - `src/test/explorerVideoEditor.test.tsx` now locks the runtime fallback contract so a direct-play failure must trigger proxy generation and switch the player over to the generated proxy source.
- Durable product note:
  - For inline video preview in this repo, ffprobe-level codec/container checks are not enough by themselves because Linux webview decode support depends on the host runtime stack. Keep the runtime playback-error fallback path, not just the preflight compatibility probe.
  - Preview proxy format is a webview-compatibility concern, not just a transcoding concern. Do not assume `mp4` is the safest universal fallback for Linux preview surfaces.
- Validation:
  - passed: `bunx vitest run src/test/explorerVideoEditor.test.tsx --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false 2>&1 | rg "ExplorerVideoEditor|explorerVideoEditor.test|videoEditorBackend" || true`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - note: `cargo test --manifest-path src-tauri/Cargo.toml preview_proxy_output_uses_platform_safe_container_defaults -- --nocapture` is still blocked by unrelated pre-existing test compile drift in `src-tauri/src/fs_commands.rs`, `src-tauri/src/plugin_commands.rs`, and `src-tauri/src/video_engine.rs`

# 2026-04-19 — Dev Telemetry Now Writes Into Repo-Local `.telemetry/`

- `src-tauri/src/telemetry.rs` now resolves the telemetry trace directory differently in dev vs release:
  - `bun run tauri dev` stores session JSONL files under repo-local `.telemetry/`
  - release builds still use the Tauri app-log/app-data path
- The repo root is derived from `CARGO_MANIFEST_DIR` at runtime, so the dev path stays portable and does not hardcode a machine-specific absolute path.
- `.gitignore` now excludes `.telemetry/` so the local trace folder stays out of version control while remaining easy to inspect for agents.
- Validation:
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - targeted `cargo test --manifest-path src-tauri/Cargo.toml repo_root_directory_resolves_to_the_repository_root -- --nocapture` is still blocked by unrelated pre-existing compile drift in `src-tauri/src/plugin_commands.rs` and `src-tauri/src/video_engine.rs`

## 2026-04-18 — Spreadsheet Bootstrap Failure From `xlsx` Default Import

- The shell bootstrap can fail before React mounts if the spreadsheet lane imports `xlsx` as a default binding from the package ESM entry.
- Root cause:
  - `src/runtime/spreadsheetWorkbook.ts` sat on the main app import graph.
  - It used `import XLSX from "xlsx";`, but the installed `xlsx` ESM entry (`node_modules/xlsx/xlsx.mjs`) exposes named exports only and does not export `default`.
  - That mismatch breaks the `import("./App")` bootstrap path and can surface as a browser syntax error about resolving `default` through star-export entries.
- Durable fix shape:
  - Spreadsheet codepaths now use namespace imports (`import * as XLSX from "xlsx";`) in the runtime helper, the explorer spreadsheet workbench, and the spreadsheet runtime test.
- Durable product note:
  - Treat `xlsx` as a named-export / namespace-import package in this repo unless the dependency version changes and is reverified. Do not reintroduce default imports in spreadsheet runtime or UI code just because TypeScript accepts them under a looser interop mode.
- Validation:
  - passed: `bunx vitest run src/test/spreadsheetWorkbook.test.ts`
  - passed: `bun run build`

## 2026-04-18 — Explorer Shader Workbench For WGSL / HLSL / SPIR-V

- The explorer preview pane now has a dedicated shader workbench lane for `.wgsl`, `.hlsl`, and `.spv` instead of routing those files through generic text/markdown preview paths.
- Durable implementation shape:
  - `src/config/filePreview.ts` is now the extension router for shader-workbench file types. It explicitly classifies `wgsl`, `hlsl`, and `spv`, keeps `wgsl` / `hlsl` editable, and excludes all three from the generic editable-text lane so shader files do not silently fall back to Monaco text preview.
  - `src/components/FileExplorer.tsx` now owns a `preview.type === 'shader'` branch, session-scoped shader selection memory keyed by file path, and shader-specific preview-header chrome that reuses the existing `previewModeToggle` slot for `Preview`, `Edit`, `Sphere`, `Fullscreen`, and dirty-state `Save`.
  - `src/components/ExplorerShaderWorkbench.tsx` is the shell-owned shader lane. It provides the live WebGPU preview canvas, stage/entrypoint picker, diagnostics strip, debounced compile loop, dirty/save wiring for editable formats, and read-only SPIR-V inspection mode.
  - `src/runtime/shaderPreviewBackend.ts` is the TS runtime seam for shader inspection/compile work. React should talk to that seam instead of scattering raw shader preview invokes through explorer components.
  - `src-tauri/src/shader_preview_commands.rs` is the native normalization path. WGSL is parsed and validated with `naga`, HLSL is compiled to SPIR-V with `shaderc` and then normalized back through `naga`, and `.spv` files are reflected and translated through `naga` into inspection WGSL.
  - Relative HLSL `#include` resolution is now rooted at the shader file directory in the native layer, so preview/compile behavior matches the file’s on-disk location instead of depending on the process working directory.
  - The workbench now exposes and documents `GreebleFS Shader Preview ABI v1`. Shaders that compile but do not fit the host preview contract stay inside the shader workbench with diagnostics and normalized inspection output; they do not fall back to the generic text lane.
- Durable product note:
  - Keep shader normalization and stage/entrypoint truth in Rust. The React workbench should stay a shell-owned authoring/preview surface over typed shader-preview commands, not become a browser-side shader parser or format bridge.
  - Stage and entrypoint memory is intentionally explorer-session scoped inside `FileExplorer.tsx`. Do not persist those picks into global settings unless the product deliberately decides to make shader-preview presets a user-level feature.
  - If future work expands shader support beyond WGSL/HLSL/SPIR-V, extend the file-preview classifier and native normalization path together. Do not route new shader types through the generic text editor just because Monaco can display the source.
- Validation:
  - passed: `bun x vitest run src/test/filePreview.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts src/test/fileExplorer.viewModes.test.tsx -t "routes shader|remembers shader|hotkey config helpers|default hotkey settings|filePreview config"`
  - passed: `bun x tsc --noEmit --pretty false`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - note: targeted `cargo test --manifest-path src-tauri/Cargo.toml shader_preview_commands` is currently blocked by unrelated pre-existing test compile drift in `src-tauri/src/fs_commands.rs`, so the useful backend signal for this pass is the green non-test `cargo check`

## 2026-04-18 — Preview Pane Terminal + Reverse `cd` Sync

- The explorer preview pane can now host a live embedded terminal without leaving the current file-browser surface.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now owns a local `previewSurfaceMode` (`content` vs `terminal`) plus a sticky `previewTerminalMounted` flag so the preview terminal session stays alive when the user flips back to file preview content.
  - The preview header chrome is still driven by `src/config/explorerChromeLayouts.ts`. A new `previewTerminalToggle` control sits in the preview-header end zone, which keeps the feature compatible with theme/layout overrides instead of hardcoding a stray button outside the chrome registry.
  - In terminal mode, the preview header switches identity to `Terminal`, hides file-preview-only controls, and shows the terminal cwd while keeping split-mode and close controls available.
  - `src/components/TerminalOverlay.tsx` now supports namespaced pane ids plus direct `workingDirectory` input. That lets the preview terminal reuse the existing terminal surface without colliding with the main terminal tab/session ids.
  - The preview-terminal path uses `consumeExplorerCwdSync={false}` so it follows the explorer’s current folder directly instead of consuming the global explorer-to-terminal cwd queue that still belongs to the standalone terminal.
  - Shell integration events from the active preview pane now bubble back through `onReportedWorkingDirectoryChange(...)`; `FileExplorer` normalizes that cwd and routes it through the existing `navigate(...)` path so typing `cd` in the preview terminal moves the explorer itself.
- Durable product note:
  - The preview terminal is shell-owned presentation inside one explorer instance, not a second explorer or a second global terminal surface. Keep its lifetime scoped to the preview pane and keep its navigation truth routed back through normal explorer navigation.
  - If future work adds more embedded terminal surfaces, keep using terminal id namespaces plus explicit cwd-sync policy flags. Do not let multiple terminal mounts compete for the same global explorer cwd queue.
- Validation:
  - passed: `bunx vitest run src/test/terminalOverlay.test.tsx src/test/fileExplorer.viewModes.test.tsx src/test/hotkeys.test.ts src/test/settingsStore.test.ts`

## 2026-04-18 — Spreadsheet Viewer/Editor Workbench

- Spreadsheet files now route to a dedicated preview/editor lane instead of the Monaco text editor.
- Durable implementation shape:
  - `src/config/spreadsheet.ts` classifies spreadsheet extensions into workbook vs tabular file kinds and keeps the preview/export gates data-driven.
  - `src/config/filePreview.ts` excludes spreadsheet extensions from editable text routing so workbook files do not fall through to the plain text editor.
  - `src/components/FileExplorer.tsx` now resolves `preview.type === 'spreadsheet'` and mounts `ExplorerSpreadsheetWorkbench` in the preview pane.
  - `src/components/ExplorerSpreadsheetWorkbench.tsx` provides the grid UI, sheet tabs, formula bar, clipboard/edit operations, save/reload, and dirty/close-guard state on top of `@glideapps/glide-data-grid`.
  - `src/runtime/spreadsheetWorkbook.ts` is the SheetJS + HyperFormula bridge for workbook import/export, clipboard serialization, sheet mutation, and cell formatting.
  - `src-tauri/src/fs_commands.rs` treats `tsv` as searchable text so the explorer search path still covers tabular files.
- Validation:
  - passed: `bunx vitest run src/test/filePreview.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts src/test/spreadsheetWorkbook.test.ts`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - passed: filtered typecheck for the touched spreadsheet files
  - note: repo-wide `bunx tsc --noEmit --pretty false` still has unrelated existing failures in `src/components/ExplorerAudioWorkbench.tsx` and `src/runtime/vstBackend.ts`

## 2026-04-18 — Terminal Xterm Hot Path Simplification

- We pivoted back to xterm as the terminal engine because it already covers selection, hyperlink detection, IME, mouse reporting, and the other parity work a native rewrite would have to relearn.
- Durable implementation shape:
  - `src/components/TerminalOverlay.tsx` now keeps the pane surface memoized and imperative, with xterm still handling emulation/input/rendering and the overlay shell handling pane chrome plus lifecycle.
  - `src/components/terminal/TerminalViewportFx.tsx` is now an idle-only decorative layer for inactive DOM panes. The active viewport no longer carries the expensive overlay/filter stack.
  - Terminal panes are rendered opaque by default so the compositor does not have to blend a translucent live terminal surface on every frame.
- Durable product note:
  - For embedded terminals in this repo, the fastest working path is xterm plus a brutally simple hot path. Keep fancy styling out of the active viewport and keep cwd sync / broadcast input on the typed bridge.
- Validation:
  - passed: `bunx vitest run src/test/terminalOverlay.test.tsx src/test/workbenchTheme.test.ts`
  - passed: filtered typecheck via `bunx tsc --noEmit --pretty false 2>&1 | rg "src/components/TerminalOverlay.tsx|src/components/terminal/TerminalViewportFx.tsx|src/test/terminalOverlay.test.tsx|src/config/workbenchTheme.ts|src/config/pilotThemeContract.ts|src/test/workbenchTheme.test.tsx" || true`

## 2026-04-18 — Explorer Preview Split Mode Stays Local To FileExplorer

- The explorer preview can now be promoted into a pane-styled sibling surface without creating a second workspace pane or reusing the top-level `1-Up` / `2-Up` / `4-Up` system.
- Durable implementation shape:
  - `src/store/explorerStore.ts` now persists per-session `previewSplitMode: 'inline' | 'pane'` alongside the existing preview/session chrome state, so split presentation survives explorer remounts and pane-tab copies without touching workspace layout truth.
  - `src/config/explorerChromeLayouts.ts` now includes `previewSplitToggle` in the preview-header control registry, which means themes and chrome overrides can move/reorder/hide the new split button the same way they already handle `previewModeToggle`, `previewCopyPath`, and `previewClose`.
  - `src/components/FileExplorer.tsx` still owns the only preview source of truth. Pane mode is just a local presentation switch: the content viewport gets a pane shell, the preview panel gets pane shell styling plus a correctly sided resize handle, and selection changes keep driving the same live preview state.
  - `src/components/explorer/ExplorerWorkspace.tsx` and workspace layout snapshots were intentionally left alone. Top-level explorer panes remain whole `FileExplorer` instances; preview split is not a hidden workspace pane type.
- Durable product note:
  - If future work asks for pinned or independent preview panes, that is a deeper architecture change than this feature. Current truth is a live-synced preview lane rendered inside one explorer instance.
  - Preview shell controls that affect presentation should stay in the preview-header chrome registry so theme/layout override systems keep working. Do not hardcode one-off preview buttons outside that registry.
- Validation:
  - passed: `bunx vitest run src/test/ExplorerWorkspace.test.tsx src/test/fileExplorer.viewModes.test.tsx --reporter=dot`
  - passed: filtered typecheck via `bunx tsc --noEmit --pretty false 2>&1 | rg "src/components/FileExplorer.tsx|src/store/explorerStore.ts|src/config/explorerChromeLayouts.ts|src/test/fileExplorer.viewModes.test.tsx" || true`
  - note: repo-wide `bunx tsc --noEmit --pretty false` still reports unrelated pre-existing errors in `src/components/ExplorerAudioWorkbench.tsx` and `src/runtime/vstBackend.ts`

## 2026-04-18 — Explorer Font Preview Loading Stability

- The font preview panel could briefly show the previously loaded font while hopping to the next file because the component kept rendering the old "ready" state until the next font load completed.
- Durable fix shape:
  - `src/components/ExplorerFontPreview.tsx` now treats readiness as a path-specific key instead of a boolean that can lag one render behind the selected file.
  - The preview family name now comes from a stable hash-based helper so similarly named font files do not collide in the browser font cache.
  - The loading and error states now have explicit accessibility roles, which makes the preview transition easier to reason about in tests and in the UI.
- Validation:
  - passed: `bunx vitest run src/test/explorerFontPreview.test.tsx`
  - passed: filtered typecheck via `bunx tsc --noEmit --pretty false 2>&1 | rg "ExplorerFontPreview.tsx|explorerFontPreview.test.tsx" || true`

## 2026-04-18 — PDF Preview Render Status Feedback Loop

- The PDF workbench could get stuck flashing `Rendering PDF page…` even after the page image was visible.
- Root cause:
  - `ExplorerPdfWorkbench` only mounted the footer/status strip while `isRendering` or `error` was truthy.
  - That footer lives outside the viewport flex child, so toggling it changed the measured viewport height.
  - The workbench render effect depends on `viewportSize`, so the status strip itself became part of a resize -> render -> resize feedback loop.
  - Separate from that, the `ResizeObserver` callback was always writing a fresh `{ width, height }` object even when the measured size had not changed, so duplicate observer notifications could still retrigger page renders.
- Durable fix shape:
  - `src/components/ExplorerPdfWorkbench.tsx` now keeps the footer/status strip mounted at a stable height and only changes its message/content, so render state no longer changes the viewport box model.
  - The viewport container now uses `scrollbar-gutter: stable both-edges` to avoid fit-width oscillation when vertical scrollbars appear.
  - The `ResizeObserver` state write now dedupes identical width/height pairs before updating React state.
  - `src/test/explorerPdfWorkbench.test.tsx` now locks two invariants: the PDF footer stays mounted before the first page render finishes, and duplicate resize notifications do not trigger a second page render.
- Durable product note:
  - In preview surfaces that render from measured viewport size, status chrome must not mount/unmount in a way that changes the measured box. Keep the layout stable and vary content, not structure.
- Validation:
  - passed: `bunx vitest run src/test/explorerPdfWorkbench.test.tsx src/test/fileExplorer.viewModes.test.tsx`
  - passed: filtered typecheck via `bunx tsc --noEmit --pretty false 2>&1 | rg "ExplorerPdfWorkbench.tsx|explorerPdfWorkbench.test.tsx" || true`

## 2026-04-18 — Explorer Folder Preview Mirrors Archive Contents Pattern

- Clicking a folder in double-click navigation mode now opens a real preview-pane folder inspector instead of leaving the preview empty.
- Durable implementation shape:
  - `src/components/ExplorerFolderPreview.tsx` is new shell-owned folder preview surface. It mirrors archive-preview structure: header summary plus scrollable contents list, but it fetches live directory entries through the typed explorer backend and respects the current hidden-files setting.
  - `src/components/FileExplorer.tsx` now treats directory selection as a first-class `preview.type === 'folder'` lane, renders the folder preview component in the existing preview pane, and allows plain-click preview for folders in the same click path already used for files.
  - Folder preview rows are now actionable explorer controls, not static labels. Clicking a folder row navigates the main explorer into that folder and keeps the preview pane synced to that new folder; clicking a file row navigates into its parent folder, selects it in the main explorer, and opens its real inline preview/editor.
- Folder preview stays in the shell/render lane. No new Rust truth was needed because existing `fs_list_dir_uncached` / typed explorer runtime already own directory listing truth.
- Durable product note:
  - Folder preview should stay a lightweight inspector over existing directory-list truth, not a second recursive explorer runtime inside the preview pane.
  - Treat folder preview actions as first-class explorer navigation affordances. If future work adds richer folder-preview gestures, route them back through the real explorer navigation/selection/preview path instead of building a disconnected mini file manager inside the pane.
  - If this lane grows richer later, prefer reusing explorer backend listing contracts and theme chrome rather than inventing a special folder-only native API without evidence.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "shows folder contents in preview pane when a folder is single-clicked in double-click mode"`

## 2026-04-18 — PDF Preview Callback Stability Regression

- The inline PDF lane hit a React `Maximum update depth exceeded` failure plus intermittent `PDF preview session was not found` errors when opening a PDF.
- Root cause:
  - `PreviewPanel` was passing fresh inline PDF callbacks on each render, especially the save/refresh handoff.
  - `ExplorerPdfWorkbench` builds its controller from callbacks that include save behavior, so unstable parent callbacks kept rebuilding the controller.
  - The workbench was also clearing controller and close-guard registrations from effect cleanups tied to dependency churn instead of only on unmount.
  - Together, that created a parent/child passive-effect ping-pong that could also close PDF sessions mid-render and surface false `session was not found` errors.
- Durable fix shape:
  - `src/components/FileExplorer.tsx` now passes stable PDF workbench callbacks, including a direct stable `refresh` prop instead of an inline `() => refresh()` wrapper.
  - `src/components/ExplorerPdfWorkbench.tsx` now separates registration updates from unmount cleanup for controller and close-guard wiring, uses a stable `toggleEditMode` callback in the controller path, and defers native PDF session close through the runtime seam so React StrictMode cleanup does not kill a just-opened session during the dev-only mount/unmount/remount cycle.
  - `src/runtime/pdfPreviewBackend.ts` now owns cancellable delayed PDF-session close helpers. That seam exists specifically so frontend lifecycle churn can cancel a pending native close before it fires.
  - `src-tauri/src/pdf_commands.rs` now treats render-cache insertion after a session close as a no-op instead of surfacing `PDF preview session was not found` from a stale render completion.
  - `src/test/fileExplorer.viewModes.test.tsx` now uses a stricter PDF workbench mock whose controller depends on `onSaved`, so future unstable save callbacks will trip the explorer test instead of only failing at runtime.
  - `src/test/pdfPreviewBackend.test.ts` now locks the deferred-close contract directly with fake timers.
- Durable product note:
  - Treat the `PreviewPanel` -> `ExplorerPdfWorkbench` boundary as a stability boundary. If the workbench controller depends on a callback prop, keep that prop memoized or routed through a stable runtime seam. Do not reintroduce inline callback wrappers on the PDF preview lane.
  - React StrictMode is enabled in `src/main.tsx`. Native preview sessions that are torn down from effect cleanup must tolerate the dev-only cleanup/remount cycle or use a cancellable delayed close path.
- Validation:
  - passed: `bunx vitest run src/test/pdfPreviewBackend.test.ts src/test/fileExplorer.viewModes.test.tsx`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - passed: filtered typecheck via `bunx tsc --noEmit --pretty false 2>&1 | rg "src/components/ExplorerPdfWorkbench.tsx|src/runtime/pdfPreviewBackend.ts|src/test/pdfPreviewBackend.test.ts|src/test/fileExplorer.viewModes.test.tsx" || true`

## 2026-04-18 — Inline PDF Preview + Edit Workbench

- The explorer preview pane now has a dedicated PDF lane instead of falling back to text/unavailable states for `.pdf`.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now routes `.pdf` files into a `pdf` preview state, wires preview-close guards so dirty PDF sessions can block silent preview switches, and surfaces PDF page/zoom/fit/edit/save controls through the existing preview-header chrome slot instead of inventing a new chrome-layout schema.
  - `src/components/ExplorerPdfWorkbench.tsx` is the shell-owned PDF workbench. It renders one active page at a time, consumes settings-backed hotkeys, maps AcroForm widgets into page-space DOM overlays, authors overlay annotations in React, and exposes controller/chrome callbacks back to the explorer shell.
  - `src/config/hotkeys.ts` and `src/components/SettingsPage.tsx` now include a dedicated PDF workbench shortcut cluster for page travel, zoom, and preview/edit mode, while save continues to use the shared `saveFile` binding.
  - `src/test/filePreview.test.ts`, `src/test/hotkeys.test.ts`, `src/test/settingsStore.test.ts`, and `src/test/fileExplorer.viewModes.test.tsx` now lock the PDF lane routing plus the PDF hotkey defaults/settings contract.
- Durable product note:
  - Keep PDF document truth in Rust. The React workbench should stay a page-space authoring shell over typed session commands, not become a browser-side PDF parser/editor.
  - Reuse the existing preview-header chrome layout slot for PDF controls unless the whole preview chrome architecture changes. That keeps PDF support additive instead of forking the explorer chrome registry.
- Validation:
  - passed: `bun run test:unit src/test/filePreview.test.ts src/test/hotkeys.test.ts src/test/settingsStore.test.ts src/test/fileExplorer.viewModes.test.tsx`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - added: native PDF module tests in `src-tauri/src/pdf_commands.rs` now generate temp PDFs for open/render/save roundtrip coverage plus XFA and encrypted-edit rejection coverage
  - note: `cargo test --manifest-path src-tauri/Cargo.toml pdf_preview_ -- --nocapture` is currently blocked by unrelated pre-existing test compile failures in `src-tauri/src/fs_commands.rs`, `src-tauri/src/plugin_commands.rs`, and `src-tauri/src/video_engine.rs`, so the useful backend signal for this pass remains the green non-test `cargo check`
  - note: repo-wide `bunx tsc --noEmit` still fails on unrelated pre-existing explorer audio / VST typing issues outside the PDF lane.

## 2026-04-18 — Linux Wayland Startup Recovery / Local State Reset Script

- The Linux desktop startup invisibility issue was traced back to persisted `windowMode=overlay` state on Wayland. When that state combines with the separate Wayland dock host, the main window can render briefly and then hide itself during presentation handoff, leaving the app effectively invisible.
- Durable recovery shape:
  - `src/runtime/windowHost.ts` now exposes `shouldForceMainWindowStartupMode(...)`, a narrow policy helper for detecting the bad startup combination: Linux + Wayland + separate dock host + main host + persisted overlay mode.
  - `src/App.tsx` now applies a startup failsafe for that combination and immediately coerces startup back to `windowed` mode before the main window gets stranded behind dock-host handoff.
  - `reset-local-settings.sh` in the repo root now provides an operator-friendly local-state reset path. It backs up the current GreebleFS/OverlayTerm config and data directories under `~/.local/state/greeblefs-reset/<timestamp>/` before clearing them, so state reset is recoverable instead of destructive.
- Durable operator note:
  - if the app starts flashing the dev HUD and then disappears on KDE/Wayland, check the persisted localstore first; recurring `windowMode=overlay` drift is a strong signal that the app is re-entering the unsafe Wayland dock-host startup path.

## 2026-04-18 — Terminal WebGL Renderer + Theme-Owned FX Overlay

- Embedded terminals now have a first-class GPU renderer lane and a theme-owned post-FX contract instead of hardcoding all terminal presentation inside `TerminalOverlay.tsx`.
- Durable implementation shape:
  - `package.json` now includes `@xterm/addon-webgl`, and `src/components/TerminalOverlay.tsx` loads the addon for each pane when the resolved workbench theme requests `terminalRenderer: 'webgl'` or `'auto'`.
  - The xterm boot path still fits before PTY spawn, but it now also applies the theme recipe to the mounted instance after boot so font/theme changes and WebGL atlas refresh stay in sync without remounting panes.
  - `src/config/workbenchTheme.ts` now owns `terminalRenderer` plus a resolved `terminalFx` recipe (`preset`, scanlines, noise, vignette, glow, tint, curvature, saturation, contrast). Theme packages and built-in themes can drive terminal presentation through `theme.workbench`, just like the rest of the shell.
  - `src/components/terminal/TerminalViewportFx.tsx` is the leaf FX surface for pane-local terminal atmosphere. It adds scanline/noise/vignette/glow/tint layers and content filtering on top of the xterm viewport without moving terminal parsing/emulation out of xterm.
  - Performance correction: live WebGL panes no longer run under the expensive viewport filter/drop-shadow path, and the FX layer now collapses to a lighter overlay while terminal output is hot. The earlier all-layers-all-the-time version was compositor-heavy enough to tank terminal throughput.
  - `src/config/pilotThemeContract.ts` seeds the built-in pilot baseline with a subtle terminal FX profile, so the default terminal no longer looks like a raw xterm drop-in.
- Durable product note:
  - Terminal rendering strategy in this repo is now: xterm for emulation/input/selection, WebGL addon for fast paint when available, theme-owned FX overlay for shell identity. Do not jump straight to a bespoke glyph-atlas renderer unless the product explicitly decides to own terminal emulation/grid truth too.
  - Keep live terminal paint paths brutally simple. If FPS falls apart again, inspect CSS `filter`, `mix-blend-mode`, and per-frame overlay composition before blaming xterm or the PTY bridge.
  - If terminal visuals regress after a theme switch, inspect `ResolvedWorkbenchThemeRecipe.terminalRenderer`, `ResolvedWorkbenchThemeRecipe.terminalFx`, and the pane-local `TerminalViewportFx` layer before touching the PTY bridge.
- Validation:
  - passed: `bunx vitest run src/test/workbenchTheme.test.ts src/test/terminalOverlay.test.tsx`
  - passed: filtered typecheck via `bunx tsc --noEmit --pretty false 2>&1 | rg "src/components/TerminalOverlay|src/components/terminal/TerminalViewportFx|src/config/workbenchTheme|src/config/pilotThemeContract|src/test/terminalOverlay.test|src/test/workbenchTheme.test" || true`

## 2026-04-18 — Terminal WebGL Auto-Selection Hardened For Linux

- The embedded terminal WebGL path now avoids loading the addon when the browser-probed `webgl2` context looks software-backed or unavailable. That keeps `auto` from choosing a renderer that is technically present but operationally slow on the current webview/driver stack.
- The WebGL probe now retries without `failIfMajorPerformanceCaveat` after the strict probe path, so a GPU-backed browser context that is merely caveated still gets the WebGL renderer instead of getting stuck on the slow fallback path.
- `TerminalOverlay.tsx` also stopped carrying the expensive FX overlay in the WebGL hot path and now keeps xterm opaque when WebGL is active. The remaining FX overlay is DOM-only.
- Durable product note:
  - For embedded terminals on Linux, treat WebGL as a capability that must be proven by the webview and GPU stack, not assumed because the machine has an RTX card. If the browser probe says software or the compositor path is pathological, prefer the DOM renderer and keep the pane surface opaque.
- Validation:
  - passed: `bunx vitest run src/test/terminalRendererSupport.test.ts src/test/terminalOverlay.test.tsx src/test/workbenchTheme.test.ts`

## 2026-04-18 — Terminal Split Drag Uses Imperative Preview Geometry

- Embedded terminal pane-resize drag no longer drives the entire terminal shell through React state updates on every pointer move.
- Durable implementation shape:
  - `src/components/TerminalOverlay.tsx` now keeps split-drag preview geometry in refs and applies pane/handle positions directly to the mounted DOM nodes with a RAF-batched imperative path.
  - React state still owns the durable pane-tree layout, but the terminal only commits the final split ratio back into `tabs` on `pointerup`.
  - A small `useLayoutEffect` replay keeps the preview geometry pinned if any unrelated rerender happens while a drag is in flight.
  - The xterm boot path now fits the pane before spawning the PTY, so new panes start with the real mounted row/column geometry instead of the default `24x80` placeholder.
  - Follow-up fits preserve bottom lock when the viewport was already pinned near the prompt, which prevents split growth from leaving a dead gutter of blank rows under the active shell.
- Durable product note:
  - Keep xterm panes mounted and visually stable during split drag. If resize churn comes back, inspect the terminal split-handle path first and avoid reintroducing `setTabs(...)` on `pointermove`.
  - If terminal content looks like it is drifting inside an otherwise stable pane frame, check xterm fit timing and viewport bottom-lock behavior before blaming React reconciliation.
- Validation:
  - passed: `bunx vitest run src/test/terminalOverlay.test.tsx`

## 2026-04-17 — MoGraph Toolkit Bridged Into Authored Animation Runtime

- The imported Cinema 4D-style MoGraph folder under `src/animation/` is now sanitized for GreebleFS and exposed through the authored shell animation runtime instead of remaining as website-only raw material.
- Durable implementation shape:
  - `src/animation/` no longer depends on the website’s `@/shared/icons` surface or broken alias paths. The strict-TS breakpoints were removed, local imports were normalized, and the small library now compiles cleanly inside GreebleFS.
  - `src/animation/lib/ProceduralMotion.ts` now exposes a `resolveMotionModifier(...)` path and a lowercase-id lookup so `Cloner` can resolve motion entries by either catalog key or public motion id. The imported examples had drifted from the actual lookup contract.
  - `src/animation/runtimeExports.ts` is the host-owned adapter seam for runtime-authored animations. It centralizes the MoGraph/tooling exports that are safe to hand to authored modules.
  - `src/components/animationRuntime.tsx` now extends the `overlayterm-animation` runtime module with the sanitized toolkit, so authored files in `animations/` can import `Cloner`, `Field`, `ParticleUI`, subtle Framer-motion wrappers, `useAnimation`, `AnimationTimeline`, `MOTION_LIBRARY`, `applyMotion`, and `bakeAnimation` through the same stable runtime import they already use for `defineAnimation`.
  - `animations/README.md` now documents the expanded runtime import surface, and `src/test/animationRuntime.test.ts` locks the bridge by loading a custom authored animation that imports and uses the toolkit from `overlayterm-animation`.
- Durable product note:
  - Treat `src/animation/` as host-owned reusable motion infrastructure, not as a second app shell or a random website dump. Runtime-authored shell animations should consume it through `overlayterm-animation`, not by reaching into app-relative paths.
  - If more imported animation utilities are added later, extend `src/animation/runtimeExports.ts` instead of scattering new `allowedModules` exports directly through `animationRuntime.tsx`.
- Validation:
  - passed: filtered typecheck via `bunx tsc --noEmit --pretty false 2>&1 | rg "src/animation|src/components/animationRuntime|src/test/animationRuntime|overlayterm-animation"`
  - passed: `bunx vitest run src/test/animationRuntime.test.ts src/test/animationRuntime.edge.test.ts src/test/animationRuntime.boundary.test.tsx`

## 2026-04-17 — Explorer Drag-Out Contract Restored

- Explorer file drags now default back to the native Tauri drag-out bridge, and `Shift` is the explicit modifier for an explorer-only internal drag.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now resolves drag intent as `native-out` by default and falls back to `internal` only when `Shift` is held or when native drag-out is unsupported for the dragged paths.
  - Explorer drag sources no longer opt into the overlay-hide path during ordinary file drags, so native drag-out and in-app folder drops no longer share the same shell teardown behavior.
  - `src/components/explorer/ExplorerSideRail.tsx` now advertises the restored contract directly: plain drag exports files; `Shift` keeps the drag inside the explorer.
  - `src/test/fileExplorer.viewModes.test.tsx` and `src/test/explorerSideRail.test.tsx` now lock the contract: plain drag starts `fs_start_native_file_drag`, `Shift` keeps drag internal, and in-app drops still complete through the explorer transfer path.
- Durable product note:
  - Repo memory had drifted into two contradictory drag contracts. Current truth is: plain drag exports through the native bridge, `Shift` forces internal-only drag.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/explorerSideRail.test.tsx`

## 2026-04-17 — Text Thumbnail Legibility Pass

- Explorer text/code thumbnails are now deliberately more legible at small icon sizes instead of trying to cram too many tiny lines into the preview canvas.
- Durable implementation shape:
  - `src-tauri/src/thumbnail_commands.rs` now renders text thumbnails as a simpler preview card with fewer sampled lines, larger type, a dedicated preview panel, a single softer text shadow, and a lighter content gutter instead of the old dense 10-line composition.
  - Thumbnail cache variants were version-bumped to `code-v2`, `shader-v2`, and `audio-v2` so the new rendering ships immediately instead of reusing stale cached posters.
  - `src-tauri/src/thumbnail_commands.rs` also gained a small helper that filters blank preview lines and expands tabs before render.
- Durable product note:
  - For icon-sized previews, prioritize structure and contrast over raw text density. A few strong preview lines beat a tiny unreadable wall of content.
  - If thumbnail composition changes again, bump the cache variant alongside the renderer so the app does not keep serving old cached posters.
- Validation:
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml --lib thumbnail`
  - passed: `bunx vitest run src/test/explorerThumbnails.test.ts`

## 2026-04-17 — AIFF Preview Support + Compact Audio Workbench Summary

- AIFF preview/edit support is now wired through the existing audio preview and transport contracts without introducing a browser `<audio>` fallback.
- Durable implementation shape:
  - `src/config/filePreview.ts` now includes `.aif` and `.aiff` in the direct audio playback allowlist, which keeps the explorer preview routing aligned with the existing MIME map and with the native audio workbench.
  - The Rust audio backend already supported AIFF through Symphonia and the batch/edit registries, so the frontend allowlist was the missing gate.
  - `src/components/ExplorerAudioWorkbench.tsx` now uses a compact summary strip for the high-value metadata at the top of the panel instead of the larger analysis card grid.
  - The waveform buckets, spectral bars, and playhead marker are memoized subsurfaces. The playhead line is updated through an imperative RAF-driven transform path, and seek commands are throttled to one RAF commit per frame so scrubbing does not flood the native bridge.
- Durable product note:
  - Keep audio metadata summary chips compact and top-loaded. `Hz`, `RMS`, encoding, and similar analysis fields should stay small and shallow, not occupy full analysis cards.
  - Keep the playhead visual on an imperative/RAF path instead of tying it to parent React state. That is the part of the audio workbench most likely to regress under shell-level rerender churn.
  - If new audio formats are added later, update the central preview allowlist in `src/config/filePreview.ts` and the backend registry together so preview/edit support stays consistent.
- Validation:
  - passed: `bunx vitest run src/test/filePreview.test.ts src/test/explorerAudioWorkbench.test.tsx`

## 2026-04-17 — Folder Open Icon Follows Click Mode

- The explorer folder icon no longer flips to the open variant on single-click navigation. Open-folder rendering now follows the folder click mode so single-click feels immediate while double-click still gets primed selection feedback.
- Durable implementation shape:
  - `src/components/fileExplorerClickBehavior.ts` now owns both activation gating and folder-open icon gating via `shouldShowExplorerFolderOpenIcon(...)`.
  - `src/components/FileExplorer.tsx` uses a shared `getExplorerEntryIconSrc(...)` helper across adaptive grid, list, table/details, constellation, and timeline render paths so the folder open state stays consistent everywhere.
  - `src/test/fileExplorer.viewModes.test.tsx` now covers single-click navigation staying visually closed while the folder listing is still pending, plus double-click-mode priming in both grid and list views.
- Durable product note:
  - If future explorer work changes folder activation semantics, update both the trigger helper and the icon-state helper together. The visual open state should be treated as a deliberate feedback contract, not a generic selection side effect.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorerClickBehavior.test.ts src/test/fileExplorer.viewModes.test.tsx`

## 2026-04-17 — Explorer Video Playback Uses Rust Transport + Direct/Proxy Media Preview

- Explorer video playback/editing now uses a Rust-owned transport model with a real media-element preview surface instead of the old frame-preview contract.
- Durable implementation shape:
  - `src-tauri/src/video_engine.rs` owns source validation, metadata probing, loop-aware play/pause/seek state, deck-`B` audio linkage, silent-timing fallback, and the live `VideoEngineStateEvent` feed exported through Specta.
  - The video engine contract no longer exposes preview-frame fields or generates ffmpeg frame-sequence caches during normal source load. The realtime lane is transport truth in Rust plus a synced preview surface in the editor.
  - `src-tauri/src/video_commands.rs` now uses the vendored `ffmpeg-suite-rs` crates (`rust_ffprobe` and `rust_ffmpeg`) for preview-source resolution, MP4 preview-proxy generation, and trim export.
  - Direct preview is intentionally conservative: safe webview pairs play directly, and hostile formats fall back to an H.264/AAC MP4 preview proxy. Current tested matrix covers `mp4`, `mov`, `webm`, `mkv`, and `avi`.
  - `src/components/ExplorerVideoEditor.tsx` mounts a real `<video>` element again, syncs it to `src/store/videoEngineStore.ts`, auto-falls back to a generated proxy on media-surface failure, and no longer leaks the old `Load an audio file...` copy when deck `B` fails to link.
  - `src/generated/tauri.ts` and `src/store/videoEngineStore.ts` now model the trimmed transport contract: playback backend, duration, size, loop region, and audio-link status, without dead preview-frame fields.
- Durable product note:
  - Keep Rust as transport truth, the media element as the paint surface, and `ffmpeg` as the codec bridge for proxy/export work.
  - Do not reintroduce frame-sequence generation into the normal video load path. If a future native renderer is added, it should replace the paint surface cleanly without changing transport semantics.
  - Treat `audioTransportReady` as `video audio actually linked into deck B`, not as a synonym for `audio load command returned Ok(...)`. The audio engine can return a successful snapshot that still carries a deck-level decode error.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml video_ -- --nocapture`
  - passed: `bun run test:unit -- src/test/explorerVideoEditor.test.tsx`
  - passed: `bun run build`

## 2026-04-17 — Shell Zen Focus Mode

- The shell now has a layout-level zen focus mode that hides the top chrome without entering OS fullscreen and automatically foregrounds the explorer while the mode is active.
- Durable implementation shape:
  - `src/store/settingsStore.ts` now persists `settings.layout.zenFocusMode` and normalizes layout updates through a dedicated layout normalizer so theme defaults, imports, and partial layout writes do not accidentally drop the zen flag or panel-state map.
  - `src/config/hotkeys.ts` now defines `zenFocusModeToggle`, defaulting to `Ctrl+Alt+Z`, and `src/components/SettingsPage.tsx` exposes it alongside the other shell-presentation bindings.
  - `src/App.tsx` now treats zen focus mode as shell truth: local shell hotkey handling can toggle it, command palette and theme-renderer utility actions can toggle it, the default shell and theme-renderer shell both stop rendering the top bar while zen is active, and the theme-renderer shell model drops `chromeHeight` to `0` so layouts do not reserve dead space.
  - Zen mode captures the previously active non-explorer panel in a ref, forces the explorer open/active while enabled, then restores the captured panel when zen is disabled if that panel still exists.
  - The top bar now exposes a `Zen` control before it hides, so operators can enter the mode from chrome as well as by hotkey.
- Durable product note:
  - This is intentionally not native fullscreen. Future focus-mode work should stay in the shell/layout lane unless the task explicitly requires OS-level fullscreen/window-state control.
  - Zen mode is a shell-presentation state, not explorer-local state. Keep the persisted flag in layout settings and keep the actual chrome suppression in `App.tsx` instead of recreating per-panel hide/show logic.
- Validation:
  - passed: `bunx vitest run src/test/hotkeys.test.ts src/test/settingsStore.test.ts src/test/settingsPage.behavior.test.tsx src/test/app.dockMode.test.tsx`
  - passed: filtered typecheck via `bunx tsc --noEmit --pretty false 2>&1 | rg "App.tsx|SettingsPage.tsx|settingsStore.ts|hotkeys.ts|app.dockMode.test.tsx|settingsPage.behavior.test.tsx|settingsStore.test.ts|hotkeys.test.ts" || true`

## 2026-04-17 — Audio Workbench Waveform Fade Handles

- Explorer audio fades no longer live as separate transform inputs. The workbench now exposes small DAW-style fade-in/out handles directly on the waveform strip.
- Durable implementation shape:
  - `src/components/ExplorerAudioWorkbench.tsx` now renders tiny waveform-edge fade grips, clamps fade lengths against the current selection, and exports the clamped fade values instead of stale raw state.
  - The waveform fade overlays are intentionally narrow so they do not interfere with the main selection scrubbers.
  - `src/test/explorerAudioWorkbench.test.tsx` now covers dragging both fade handles and verifies the resulting export payload.
- Durable product note:
  - Keep fade controls on the waveform as edge affordances. Do not reintroduce separate fade buttons or number fields in the transform panel unless the waveform interaction model changes again.
- Validation:
  - passed: `bunx vitest run src/test/explorerAudioWorkbench.test.tsx`

## 2026-04-17 — Explorer Plugin Context Menu Render Guard

- The explorer and settings context-menu composer no longer trust plugin-contributed context-menu items blindly during render. Malformed plugin data now gets dropped or normalized instead of crashing `FileExplorer.tsx` inside the plugin-context-menu `useMemo`.
- Durable implementation shape:
  - `src/config/explorerContextMenu.ts` now sanitizes plugin context-menu contributions before converting them into explorer catalog items.
  - Invalid execution payloads are rejected early, malformed `contexts` / `appliesTo` / `group` / `iconName` values fall back to safe defaults, and non-string backend args or panel payload values are filtered out.
  - `src/components/FileExplorer.tsx` now hardens plugin-backend failure handling so a malformed backend result cannot throw on `result.stderr.trim()` when `stderr` is missing or non-string.
  - `src/test/explorerContextMenu.test.ts` covers the render-safety regression directly.
- Durable product note:
  - Plugin-contributed explorer menu items are an external boundary. Future work should keep validation at the config/runtime seam instead of assuming plugin manifests or plugin runtime data always match the ideal TS shape.
- Validation:
  - passed: `bunx vitest run src/test/explorerContextMenu.test.ts`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "lets the explorer context menu composer disable and reorder plugin menu items"`

## 2026-04-16 — Explorer Polish Tranche Native Bridge Pass

- The explorer polish tranche now routes its core heavy-truth workflows through Rust/Specta instead of keeping them as browser-only helpers.
- Durable implementation shape:
  - `src-tauri/src/fs_commands.rs` now exports native explorer metadata/search helpers for:
    - recursive-size jobs via `fs_calculate_recursive_sizes`
    - file checksums via `fs_calculate_checksums`
    - item metadata/permission snapshots via `fs_get_item_properties`
    - transient fuzzy jump filtering via `fs_fuzzy_filter_entries`
  - `src-tauri/src/explorer_pro_commands.rs` now owns recipe-based batch rename preview/apply through `FsBatchRenameRecipe`, `fs_batch_rename_preview`, and `fs_batch_rename_apply`, including regex replacement, token expansion, and stem/extension preservation.
  - `src-tauri/src/terminal.rs` now exposes shell-integration commands for embedded terminals:
    - `terminal_register_shell_integration`
    - `terminal_sync_cwd`
    - `terminal_set_prompt_state`
  - `src-tauri/src/specta_bindings.rs` and regenerated `src/generated/tauri.ts` now carry those explorer-polish commands/types into the typed bridge. Future frontend work should use the generated command surface instead of reintroducing raw invoke strings or browser-side checksum/rename truth.
  - `src/runtime/explorerBackend.ts` now exposes typed wrappers for native recursive sizes, checksums, item properties, fuzzy jump filtering, batch rename preview/apply, and terminal shell integration.
  - `src/components/FileExplorer.tsx` now uses the native bridge for:
    - live batch rename preview/apply
    - checksum calculation in the properties drawer
    - permission/timestamp snapshots in the properties drawer
    - fuzzy jump-filter result ranking
  - `src/components/TerminalOverlay.tsx` now treats explorer-driven cwd sync as terminal shell-integration work first (`terminal_sync_cwd`) and only falls back to literal command injection if native sync fails.
- Durable product note:
  - The explorer still has small browser helper modules (`explorerBatchRename.ts`, `explorerChecksums.ts`, `explorerJumpFilter.ts`) because tests and fallback paths still touch them, but they are no longer the primary truth path for the flagship explorer surface.
  - Embedded terminal auto-`cd` is currently prompt-safe by heuristic: `TerminalOverlay.tsx` marks the shell busy on submitted newline input and restores prompt state after output quiets. This is materially better than unconditional `cd` injection, but it is not yet a full PTY prompt-marker parser in Rust.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `bunx vitest run src/test/terminalOverlay.test.tsx src/test/explorerBatchRename.test.ts src/test/explorerMetadata.test.ts src/test/explorerStore.test.ts`
  - passed: `bunx vitest run --config vitest.browser.config.ts --browser.headless src/test/browser/fileExplorer.latency.browser.test.tsx`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml batch_rename_preview_supports_regex_tokens_and_extension_preservation --lib && cargo test --manifest-path src-tauri/Cargo.toml calculate_checksums_returns_md5_and_sha256 --lib && cargo test --manifest-path src-tauri/Cargo.toml recursive_size_task_returns_directory_totals --lib`

## 2026-04-16 — Native Explorer Thumbnails + Video Hover Scrub

- The explorer now has a Rust-owned rich-thumbnail lane instead of an image-only grid preview hack. Generated thumbnails can replace file icons when the operator enables explorer thumbnails.
- Durable implementation shape:
  - `src-tauri/src/thumbnail_commands.rs` is the new native thumbnail backend. It routes local files by type and generates:
    - raster/SVG image posters
    - code thumbnails rendered from source text
    - shader thumbnails rendered as a code card plus a procedural sphere preview
    - audio waveform/spectral thumbnails
    - video poster frames plus cached hover-scrub frame sequences
  - Thumbnail outputs are cached under the app-local `explorer-thumbnails` directory, keyed by file path plus metadata and requested dimensions so refreshes can invalidate naturally when the source changes.
  - `fs_read_image_thumbnail` in `src-tauri/src/fs_commands.rs` now delegates to the shared thumbnail module instead of maintaining a second image-thumbnail implementation.
  - `src/runtime/explorerBackend.ts` now exposes `readExplorerEntryThumbnail()` as the typed frontend bridge for generated thumbnails.
  - `src/config/explorerThumbnails.ts` is the TS-side thumbnail policy layer. It owns persisted enable/disable flags per media class, hover-scrub frame count clamping, and the shared batch sizing constants used by the explorer UI.
  - `src/store/settingsStore.ts` now persists explorer thumbnail settings under `settings.explorer.thumbnails`.
  - `src/components/SettingsPage.tsx` now exposes a dedicated explorer `Thumbnail Rendering` card so operators can toggle image/code/shader/audio/video thumbnails and video hover-scrub behavior.
  - `src/components/FileExplorer.tsx` now uses the rich thumbnail contract across the flagship explorer surfaces instead of only the old grid image path. Grid, list, table/details, adaptive semantic, constellation, and timeline entry renderers all prefer generated thumbnails and fall back to icons when thumbnails are disabled, unsupported, or unavailable.
  - Video hover scrub is on-demand instead of eager. The explorer loads poster thumbnails in the normal batch lane, then requests cached hover frames only when the pointer enters a supported video entry and the setting is enabled.
- Durable product note:
  - Generated thumbnails are now host-owned explorer truth, not decorative frontend sugar. Future work should extend the Rust thumbnail backend and the `explorerThumbnails` policy/config layer instead of scattering new file-type rendering logic through `FileExplorer.tsx`.
  - Hover-scrub should stay montage-based and cache-backed. Do not replace it with full inline autoplay inside entry cells.
- Validation:
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: filtered typecheck for the new thumbnail lane via `bunx tsc --noEmit --pretty false 2>&1 | rg "readEntryThumbnail|ExplorerEntryThumbnail|explorerThumbnails|SettingsPage.tsx|settingsStore.ts|explorerBackend.ts|fsReadEntryThumbnail|videoHoverScrub|thumbnail_commands" || true`
  - note: repo-wide TypeScript remains red on unrelated existing `FileExplorer.tsx`, `App.tsx`, and test typing debt, so the useful frontend signal for this pass is the thumbnail-specific filtered check rather than a clean full-project `tsc` exit.

## 2026-04-16 — Explorer File-List Scrollbar Visibility + Bottom-Zoom Clamp Timing

- The flagship explorer file list no longer inherits the app-wide "hide every scrollbar" rule. The main file-area viewport now opts into a dedicated visible scrollbar so operators can read list scale and position while browsing.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now marks the primary file-list `OverlayScrollArea` viewport with `overlay-scroll-area__viewport--explorer-file-list` instead of relying only on the generic hidden-scrollbar viewport class.
  - `src/App.css` now gives that explorer-specific viewport a thin native scrollbar, stable gutter reservation, and `overflow-anchor: none` so the scrollbar stays visible without re-enabling scrollbars across every other overlay panel.
  - The file-list layout clamp in `FileExplorer.tsx` now runs in `useLayoutEffect` instead of `useEffect`, so zoom-driven row/grid size changes clamp `scrollTop` before paint. That removes the visible bottom-edge jitter that happened when operators `Ctrl/Cmd + wheel`-zoomed while already pinned near the end of a long folder.
- Durable product note:
  - Visible explorer scrollbars are now intentional product chrome, not an accidental regression from the shared overlay scroll-area rules.
  - If bottom-edge zoom jitter returns, check pre-paint clamp timing and scroll anchoring on the file-list viewport before touching the wheel-step state machine.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/overlayScrollArea.test.tsx`

## 2026-04-16 — Explorer Ctrl-Wheel Reverse View Fix

- Explorer `Ctrl/Cmd + wheel` view stepping was not actually blocked by the wheel listener. The regression lived in mode normalization: the settings layer still rewrote `viewMode: 'list'` into `'details'`.
- Durable implementation shape:
  - `src/config/explorerViewModes.ts` now treats `list` as a first-class persisted explorer view mode instead of a legacy alias.
  - That change restores the normal reverse zoom chain for one-notch wheel gestures: `details -> list -> columns -> icons-s -> icons-m -> icons-l -> icons-xl`.
  - `src/test/fileExplorer.viewModes.test.tsx` now covers the real user path by dispatching a `Ctrl+wheel` event from a row element while the explorer is in `details`, proving that the first reverse step persists as `list`.
  - `src/test/settingsStore.test.ts` and `src/test/explorerViewModes.test.ts` now assert that persisted `list` stays `list`.
- Durable product note:
  - Do not overload `normalizeExplorerViewMode()` with legacy migration rules once a mode id becomes part of the live runtime contract. Runtime normalization and one-time legacy migration should stay separate or wheel/menu state machines will silently collapse valid modes.

## 2026-04-16 — Comprehensive Rust Cargo Test Suite

- `scripts/run-cargo-tests.mjs` is no longer a four-manifest hardcoded helper. It now discovers Rust packages from the repo’s cargo topology, runs them through a shared target-dir cache per workspace, and keeps host-native skips explicit instead of silently omitting big parts of the tree.
- Durable implementation shape:
  - `scripts/rust-cargo-test-suite.config.mjs` is the suite manifest. It defines the Rust workspaces the repo cares about and the host-platform skip rules for native-only crates.
  - The suite now walks both the root Rust surface and the vendored Yazi workspace, so `test:rust` covers `src-tauri`, top-level shared crates, `crates/yazi-specta`, and the embedded `crates/fileexplorer/crates/*` packages.
  - Linux skips are now explicit for `file-opening-macos`, `file-opening-windows`, and `sd-desktop-macos` rather than implicit through an under-scoped manifest list. Those packages still require native macOS/Windows hosts for real execution coverage.
  - The suite supports `--list`, `--no-run`, `--workspace <id>`, and passthrough cargo args after `--`, which makes it useful both as the default repo gate and as a targeted debugging tool.
  - The vendored Yazi workspace needed test-hardening to be runnable here:
    - `yazi-codegen` test targets now pull `mlua` with `vendored` enabled so integration tests do not depend on a system `lua55.pc`.
    - `yazi-widgets` now mirrors the rest of the Yazi crates with a `vendored-lua` default feature.
    - `yazi-watcher` tests were fixed for the newer `PathDyn` API and now serialize their global-state tests through a crate-level test mutex so reporter/watched tests do not race each other.
- Durable product note:
  - `bun run test:rust` is now the correct Rust entrypoint for repo-wide coverage on the current host.
  - Full host coverage is platform-scoped by design. Linux can prove the Linux-capable Rust surface; macOS- and Windows-only crates still need their native hosts.
  - The `src-tauri` backend still has a known long-running search/cache test cluster. The repo-wide full execution pass reaches that lane and can spend multiple minutes there without surfacing new assertion failures. For fast backend iteration, use targeted filters before defaulting to the full `greeblefs` suite.
- Validation:
  - passed: `node scripts/run-cargo-tests.mjs --list`
  - passed: `node scripts/run-cargo-tests.mjs --no-run`
  - passed: `cargo test --manifest-path crates/fileexplorer/crates/yazi-codegen/Cargo.toml --no-run`
  - passed: `cargo test --manifest-path crates/fileexplorer/crates/yazi-watcher/Cargo.toml`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml external_path_invalidation_refreshes_parent_directory_listing_cache -- --nocapture`
  - partial but informative: `node scripts/run-cargo-tests.mjs` progressed through the full crate set and reached the existing long-running `src-tauri` search/cache block on warm caches without any new assertion failures after the watcher fixes.

## 2026-04-16 — Explorer Drag Preview Cleanup

- Explorer file drags no longer rely on the browser/webview's default row snapshot. That path was producing oversized, column-bloated drag ghosts during in-app explorer transfers.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now draws a compact canvas-backed drag chip and feeds it through `dataTransfer.setDragImage(...)` for explorer entry drags.
  - The drag chip is intentionally minimal: accent dot, truncated primary label, and an optional `+N` badge for multi-selection drags. The same canvas is reused across drags instead of recreating a fresh element every time.
  - The old 1x1 transparent canvas still exists only as a fallback when the richer drag-preview canvas cannot be rendered.
  - Explorer drag intent semantics remain unchanged for now: plain drag stays internal, `Alt/Option` requests native drag-out. The stale rail helper copy was corrected to match that actual contract.
- Durable product note:
  - If drag visuals regress again, check `applyExplorerNativeFeelingDragImage()` before changing row rendering or selection styling. The drag preview is now a separate explicit surface instead of an accidental browser snapshot of the source row.

## 2026-04-16 — Terminal Split Tree + Resizable Workspace Panes

- The integrated terminal is no longer a flat `paneIds[]` list that reflows an entire tab whenever one split changes. Terminal workspaces now behave like targeted split trees with draggable dividers.
- Durable implementation shape:
  - `src/components/terminalPaneLayout.ts` is the new terminal layout contract. It owns the split-tree data model, per-pane leaf collection, split insertion/removal, ratio updates, active-pane direction lookup, and normalized geometry generation for pane cards plus resize handles.
  - `src/components/TerminalOverlay.tsx` now stores each workspace tab as a tree-backed layout with an `activePaneId` and `lastSplitDirection` instead of a single `splitDirection` plus `paneIds[]`.
  - Split actions now target the focused pane leaf. Splitting a pane wraps just that leaf in a new split node, so horizontal and vertical splits can be nested instead of flipping the whole workspace into one orientation.
  - Terminal panes are now rendered from absolute geometry derived from the split tree rather than by recursively moving the pane components through different parent containers. That keeps each pane's React identity stable while its rectangle moves, which prevents the old remount/restart behavior when new panes were added.
  - Workspace tabs now stay mounted even when inactive, so tab switches no longer tear down PTYs as a side effect of React unmounting the inactive tab's pane tree.
  - `XTermPane` now coalesces fit passes through `requestAnimationFrame` and skips duplicate `terminal_resize` writes when rows/cols did not actually change, which reduces prompt redraw spam during split/resize churn on Linux, macOS, and Windows shells.
  - Pane headers now expose local split-right/split-down actions, and resize handles are first-class separators instead of an implicit equal-width layout.
- Durable product note:
  - Terminal pane composition is now tree-owned. Future split/resize/tab work should extend `src/components/terminalPaneLayout.ts` and the geometry-driven render path instead of reintroducing flat `paneIds[]` layout state in `TerminalOverlay.tsx`.
  - If a terminal behavior seems to affect the wrong panes, check whether the bug is in the split-tree helpers, the geometry projection, or the broadcast-input targeting before touching the PTY backend.
- Validation:
  - passed: `bunx vitest run src/test/terminalOverlay.test.tsx src/test/terminalPaneLayout.test.ts`
  - blocked by unrelated repo issue: `npx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/components/TerminalOverlay.tsx src/components/terminalPaneLayout.ts src/test/terminalOverlay.test.tsx src/test/terminalPaneLayout.test.ts`
  - note: the targeted compile still resolves the existing unrelated `@img-editor-runtime` alias failure from `src/runtime/imageEditorRuntime.ts`, so the useful proof for this pass is the green terminal-focused vitest suite rather than a clean isolated `tsc` exit.

## 2026-04-16 — Explorer Side Rail Mode Redesign + Expand-To-Open Toggle

- The explorer side rail no longer treats `default`, `compact`, and `tree` as minor density variants. The three persisted rail modes now drive meaningfully different section and row presentation, and the rail ships with Windows-style manual expansion by default.
- Durable implementation shape:
  - `src/config/explorerRail.ts` now carries a richer presentation contract per rail mode, including section chrome style, row chrome style, hierarchy-guide strength, active-branch emphasis, and icon tone. The persisted mode ids stay `default`, `compact`, and `tree`.
  - `src/components/explorer/explorerRailState.ts` now persists `autoExpandToOpenFolder`, defaulting missing or legacy state to `false`, so the new manual-vs-auto expansion behavior rides the existing rail snapshot instead of inventing a second settings lane.
  - `src/components/explorer/ExplorerSideRail.tsx` now renders an `Auto` toggle beside the three rail-mode buttons. Off means manual Windows-style behavior: row click navigates and only the chevron expands. On means the rail follows the open path and auto-expands the active branch chain.
  - `ExplorerSideRail.tsx` also now resolves row and section chrome from the mode contract instead of relying only on shared static styling. `default` is carded and richer, `compact` is denser and flatter, and `tree` pushes the strongest hierarchy cues and branch lanes.
  - Local-tree refresh passes now explicitly invalidate the shared directory cache for the refreshed branch targets before reloading, so the auto-follow branch refresh path keeps the side rail in sync after explorer refresh/mutation.
  - Bookmark folders now expose an explicit ancestor row state when expanded, which makes grouped bookmarks read more like hierarchy instead of a flat list of identical pills.
- Durable product note:
  - The local side rail tree is no longer implicitly auto-following by default. Manual chevron expansion is the baseline model; auto-follow is now an explicit operator choice.
  - Future rail work should extend the mode contract in `src/config/explorerRail.ts` instead of scattering one-off presentation branches through `ExplorerSideRail.tsx`.
- Validation:
  - passed: `bunx vitest run src/test/explorerSideRail.test.tsx`

## 2026-04-16 — Native Dual-Deck Explorer Audio Engine

- Explorer audio preview no longer routes through the webview media stack. The preview pane is now a React transport UI over a native Rust engine.
- Durable implementation shape:
  - `src-tauri/src/audio_engine.rs` is the native realtime playback subsystem. It owns the default output device stream through `cpal`, clip decode through `symphonia`, sample-rate conversion through `rubato`, deck mixing, loop smoothing, gain/rate transport state, and the `AudioEngineStateEvent` feed exported through Specta.
  - The engine is explicitly dual-deck: `A` and `B`. Explorer selection loads into the currently armed deck, while the non-armed deck stays loaded until explicitly replaced or cleared.
  - `src/runtime/audioWorkbenchBackend.ts` now exposes explicit engine commands and event subscription helpers. The old preview-source/proxy APIs were removed from the public TS bridge.
  - `src/store/audioEngineStore.ts` is now the shell-side audio engine source of truth. It hydrates the engine, subscribes to `AudioEngineStateEvent`, and provides the deck transport helpers used by the workbench.
  - `src/components/ExplorerAudioWorkbench.tsx` was rewritten to remove the `<audio>` element path. It now renders dual deck cards, armed-deck behavior, native transport buttons, gain/rate meters, shared waveform loop selection, analysis cards, spectral profile, and the existing SoX offline export/spectrogram flow.
  - `src/components/FileExplorer.tsx` still routes previewable audio into the workbench, but preview now means “load the current selection into the native engine” rather than “attach a browser media source”.
  - `src-tauri/src/audio_commands.rs` still owns offline-only audio work: analysis, SoX export/convert/normalize, batch processing, and explorer task integration. Preview-proxy/browser-playback commands and types were removed.
- Durable product note:
  - audio playback should stay native. Do not reintroduce HTML media elements or preview proxies as the primary playback path for explorer audio.
  - SoX is now a static utility knife, not the transport engine.
  - `ffmpeg` still matters as a codec bridge for offline transforms when vendored SoX cannot read or write a target format on a given OS.
- Validation:
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml audio_engine -- --nocapture`
  - passed: `bunx vitest run src/test/explorerAudioWorkbench.test.tsx src/test/filePreview.test.ts src/test/fileExplorer.viewModes.test.tsx`
  - passed: filtered full-project typecheck grep for touched audio files via `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "ExplorerAudioWorkbench|audioWorkbenchBackend|audioEngineStore|src/generated/tauri.ts|FileExplorer.tsx|explorerAudioWorkbench.test.tsx"`
  - note: the repo still has unrelated project-wide TypeScript failures outside the audio lane, so the useful TS signal is the filtered grep, not a clean repo-wide `tsc` exit code.

## 2026-04-16 — Explorer Navigation Commit Smoothing

- Folder-to-folder movement in the flagship explorer should now feel materially less glitchy because the file area no longer hard-blanks itself while every navigation is in flight.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now keeps pending navigation state in refs and only commits `currentPath`, history, breadcrumbs, and the new entry list once the winning directory response is ready. That prevents the old `loading -> blank file area -> new folder` flash and also keeps stale requests from partially switching the explorer.
  - Refresh flows now understand in-flight navigation targets. If a newer refresh supersedes an older pending directory load, the refresh can still claim that target path and commit it as the live explorer location instead of getting blocked by an uncommitted `currentPath`.
  - The file-area surface now distinguishes blocking boot loading from in-place navigation loading. Initial mount can still show the centered loader when no location has resolved yet, but subsequent navigations keep the previous folder visible under a lightweight loading veil until the new listing lands.
  - Explorer entry sorting in `FileExplorer.tsx` now reuses a shared collator and a dedicated `sortExplorerEntries()` helper instead of rebuilding expensive locale-compare options inline for every comparator invocation. Type-sorted folders also precompute their type labels once per sort pass.
  - `src/test/fileExplorer.viewModes.test.tsx` now covers the new behavior where the current folder stays mounted until the destination folder listing resolves.
- Durable product note:
  - Explorer navigation is supposed to commit atomically. Future performance work should preserve that contract instead of reintroducing eager path/history mutations that make the shell flash or momentarily desynchronize its folder state.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx`
  - attempted: `bunx tsc --noEmit --pretty false`
  - note: the repo still has unrelated TypeScript failures in other app/theme/audio/test files, so there is no clean repo-wide typecheck signal for this change yet.

## 2026-04-16 — Terminal Sidebar Reopen / Persistence

- The integrated terminal sidebar can now be tucked away in both the embedded application panel and the dock overlay, and that visibility choice now persists through terminal settings instead of resetting every mount.
- Durable implementation shape:
  - `src/store/settingsStore.ts` now persists `terminal.showSidebar`, defaulting to `true` and normalizing missing/legacy imports back to a safe visible-by-default state.
  - `src/components/TerminalOverlay.tsx` now reads terminal sidebar visibility from settings instead of local-only component state, so hide/show is shared across terminal presentations and survives restarts.
  - The embedded terminal header now exposes the same explicit hide/show affordance the dock view already had, instead of forcing operators to rediscover that the active rail icon can collapse the panel.
  - `src/components/SettingsPage.tsx` now exposes `Show Terminal Sidebar` in the terminal section so the rail posture is discoverable and tweakable from the shared settings surface.
- Durable product note:
  - terminal sidebar posture is now a persisted shell preference, not a per-mount accident. Future terminal chrome work should route visibility state through terminal settings rather than adding new local toggle state in `TerminalOverlay.tsx`.
- Validation:
  - passed: `bunx vitest run src/test/terminalOverlay.test.tsx src/test/settingsStore.test.ts src/test/settingsPage.behavior.test.tsx -t "lets the embedded terminal tuck the sidebar away and persist that choice|stores terminal sidebar visibility independently from other terminal settings|switches the terminal between application and dock presentation and persists the windowed size"`

## 2026-04-17 — Explorer Viewport Ref Commit-Phase Crash Fix

- The FileExplorer runtime error came from a callback ref update path, not from the navigation refresh logic itself. `OverlayScrollArea` detached the viewport ref during commit, and `FileExplorer` was using that callback to call `setState` while React was still mutating the tree.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now passes the viewport `useRef` object directly into `OverlayScrollArea` instead of routing through a callback setter.
  - The explorer viewport metrics observer now binds from `useLayoutEffect` against the committed DOM node captured in the ref, so scroll/resize tracking still works without any commit-phase state writes.
  - `src/test/fileExplorer.viewModes.test.tsx` now unmounts the StrictMode explorer render inside the existing boot-path regression, so the detach path is covered instead of only the mount path.
- Durable product note:
  - Do not use callback refs as a disguised state pipeline for explorer viewport bookkeeping. If the code needs to observe the DOM node, keep the node in a ref and attach observers from an effect after commit.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/overlayScrollArea.test.tsx -t "does not trip the boot navigation mount path under StrictMode|maps vertical wheel delta to horizontal scrolling in horizontal mode|ignores wheel translation when horizontal intent is already dominant|does not remap wheel events in vertical mode"`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/overlayScrollArea.test.tsx`
  - passed: filtered typecheck for touched terminal/settings surfaces via `bunx tsc --noEmit --pretty false 2>&1 | rg "TerminalOverlay|settingsStore|SettingsPage|terminalOverlay|settingsPage.behavior" || true`
  - note: the broader `src/test/settingsPage.behavior.test.tsx` file still has an existing unrelated failure in `syncs startup registration, desktop visibility toggles, and commits hotkey edits`

## 2026-04-16 — Explorer Tree / Grid Zoom / Icon Grid Stabilization

- The explorer now survives the three failure modes that were feeding each other in the file-area workflow: unreliable `Ctrl/Cmd + wheel` scaling, blank icon grids after directory navigation, and stale/stuck local side-rail tree branches.
- Durable implementation shape:
  - `src/components/FileExplorer.tsx` now handles `Ctrl/Cmd + wheel` from the stable file-area shell instead of depending on a one-time wheel listener attached to whichever viewport DOM node happened to exist at mount time. The handler still ignores editable targets and preview-pane events, but it now accepts events from anywhere inside the file-area plane.
  - The explorer viewport metrics path in `FileExplorer.tsx` now tracks the actual live viewport element, rebinds scroll/resize observers when that element changes, and clamps virtual-window math against current content height and entry count. That prevents stale `scrollTop` from pushing icon mode into an empty visible range after navigating from a long folder into a short one.
  - Directory navigation in `FileExplorer.tsx` now resets the file-area scroll position and refreshes viewport metrics immediately. Layout/view-mode changes clamp existing scroll instead of leaving the viewport beyond the resized content height.
  - `src/components/explorer/ExplorerSideRail.tsx` now treats the local folder tree as active-path-driven state. Current-path ancestors auto-expand, unrelated local branches collapse, and cached local subtree state is pruned back to the active lineage instead of accumulating forever.
  - Side-rail local-tree refresh now uses a monotonic `localTreeRefreshRevision` prop from `FileExplorer.tsx` plus `forceRefresh` support in `src/components/explorer/explorerDirectoryCache.ts`. The rail can explicitly invalidate subtree listings after explorer refresh/mutation instead of reusing stale cached children.
  - The local-tree loader in `ExplorerSideRail.tsx` now reads child-folder state from a ref-backed snapshot instead of closing over `folderChildrenByPath` in its callback identity. That keeps the ancestor-loading effect stable during refresh passes and avoids cancelling a forced subtree reload after only the first ancestor finishes.
- Durable product note:
  - Explorer wheel-scaling is scoped to the file-area interaction plane, not to arbitrary remount-prone viewport nodes.
  - The local side-rail tree is now navigation-focused by design; persistent multi-branch manual expansion is no longer the model for local drives.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/explorerSideRail.test.tsx`
  - passed: filtered typecheck for touched explorer surfaces via `bunx tsc --noEmit --pretty false 2>&1 | rg "FileExplorer|ExplorerSideRail|explorerDirectoryCache|fileExplorer.viewModes|explorerSideRail"`

## 2026-04-16 — Explorer Rail Focus / Reopen Loop

- The explorer sources rail now behaves more like a closable Slate panel instead of a one-way mode preset.
- Durable implementation shape:
  - `src/components/explorer/ExplorerSideRail.tsx` now exposes a rail-header `Focus` action that tells the owning explorer to switch into the built-in `focus` mode profile and close the rail in one click.
  - `src/components/FileExplorer.tsx` now distinguishes three states for the sources rail:
    - normal layout-following visibility
    - explicitly closed
    - explicitly reopened while the active mode profile would normally hide the rail
  - That reopened-in-focus behavior is persisted through the new `session.sourcesRailPinnedOpen` flag in `src/store/explorerStore.ts`, so focus mode can still default to a hidden rail without trapping the operator in a no-reopen state.
  - The existing toolbar `Sources` control now reflects actual rendered rail visibility instead of only the old raw session boolean, and the toolbar shows an explicit `Open Sources` affordance whenever the rail is closed.
  - `src/config/explorerChromeLayouts.ts` treats the new rail focus action as first-class chrome so themes and chrome overrides can move it like the other explorer controls.
- Durable product note:
  - explorer mode presets still define the default rail posture, but panel reopen/close is now a live per-session interaction on top of that layout intent rather than a hard stop.
- Validation:
  - passed: `bunx vitest run src/test/explorerChromeLayouts.test.ts src/test/fileExplorer.viewModes.test.tsx src/test/explorerStore.test.ts src/test/settingsStore.test.ts`
  - passed: `bunx vitest run src/test/explorerSideRail.test.tsx -t "exposes a focus action in the rail header when the explorer supplies one"`
  - note: the broader `src/test/explorerSideRail.test.tsx` suite still has an existing failure in `reloads the active local tree branch when the explorer bumps the tree refresh revision`, and this workspace already had unrelated in-flight explorer cache/rail edits when this pass started

## 2026-04-16 — Inline Image Editor Fabric Reinit Guard

- The embedded image editor no longer trips Fabric's `Trying to initialize a canvas that has already been initialized` error when the preview editor remounts quickly or React dev lifecycle tears down one mount before the third-party editor finishes getting ready.
- Durable implementation shape:
  - `packages/img-editor/src/main.ts` now treats the vendored editor as a single active instance per host container. Reinitializing the same container destroys the previous instance first, clears stale DOM, and allocates a fresh canvas id instead of reusing the old Fabric target.
  - That same runtime seam now wraps `destroy()` so pending init promises reject cleanly if an editor is replaced or torn down before `_onReadyCallback` fires, which keeps shell-level callers from racing stale editor instances.
  - `packages/img-editor/src/editor/index.ts` now makes `destroy()` idempotent and safe against half-initialized instances, and async init exits early once the editor has been destroyed instead of continuing work against a disposed Fabric canvas.
  - `packages/img-editor/src/editor/ui/toolbar-manager/index.ts` now treats teardown as optional when `showToolbar` is disabled, so the shell-owned preview integration can destroy a partially initialized editor without dereferencing a toolbar element that was never created.
  - `packages/img-editor/src/main.test.ts` covers the regression path where one editor is still initializing and a second init for the same container arrives before readiness.
  - `packages/img-editor/src/editor/ui/toolbar-manager/index.test.ts` covers the disabled-toolbar destroy path that previously crashed with `this.el.removeEventListener`.
- Durable product note:
  - the imported image editor package is not safe to treat as fire-and-forget. Container ownership must remain exclusive, and future lifecycle changes need to preserve explicit pre-dispose behavior around same-container remounts.
- Validation:
  - passed: `bunx vitest run --config vitest.img-editor.temp.config.ts`
  - passed: `bunx vitest run src/test/explorerImageEditor.test.tsx`

## 2026-04-16 — Unix Explorer Rail Home Drive Rooting

- The explorer side rail now treats the real Unix home directory as a first-class local drive instead of only exposing `/` plus mount folders under `/media`, `/mnt`, or `/Volumes`.
- Durable implementation shape:
  - `src-tauri/src/fs_commands.rs` now synthesizes a Unix `Home` drive entry from `dirs::home_dir()` on Linux and macOS before appending root and mounted volumes.
  - The side rail drive-root matching in `src/components/explorer/ExplorerSideRail.tsx` now resolves the most specific local drive path for the active location instead of always anchoring descendant paths to `/`.
  - That same path-resolution pass now decides both active-drive highlighting and which ancestor folders auto-expand, so `/home/<user>/...` no longer expands the whole root/system tree just because `/` is present in the drive list.
  - Windows root descendant checks now honor drive roots like `C:\` without requiring a second separator boundary, which keeps the existing nested drive-tree behavior intact after the new shared helper was introduced.
- Durable product note:
  - On Unix, root is still available as a drive for system-level browsing, but it is no longer the default active tree branch when a more specific drive root like `Home` matches the current path.
- Validation:
  - passed: `bunx vitest run src/test/explorerSideRail.test.tsx`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml home_dir -- --nocapture`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml unix_home_drive_info -- --nocapture`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`

## 2026-04-16 — Dev Telemetry HUD Toggle

- The dev-only performance HUD is no longer unavoidably forced on whenever the app runs under `import.meta.env.DEV`.
- Durable implementation shape:
  - `src/store/settingsStore.ts` now persists `system.devTelemetryHudVisible`, defaulting to `true` so existing dev behavior stays intact until the operator explicitly hides the HUD.
  - `src/config/hotkeys.ts` now defines `toggleDeveloperTelemetryHud` (`Ctrl+Alt+D` by default) as a first-class local hotkey instead of burying the toggle inside ad hoc component state.
  - `src/App.tsx` now gates `DevPerformanceHud` on both developer tooling availability and the persisted visibility flag, and it listens for the new local hotkey only while dev tooling is active.
  - `src/components/SettingsPage.tsx` exposes that binding alongside the other shell-level hotkeys so operators can rebind it without touching storage manually.
- Durable product note:
  - developer mode and dev telemetry HUD visibility are now separate concerns. Future dev tooling should avoid assuming that `developerMode === visible diagnostics chrome`.
- Validation:
  - passed: `bunx vitest run src/test/hotkeys.test.ts src/test/settingsStore.test.ts`

## 2026-04-16 — Explorer Inline Video Editor

- Video files can now stay inside the explorer preview workflow with a host-native timeline surface instead of bouncing straight into the OS player.
- Durable implementation shape:
  - `src/config/filePreview.ts` now owns a dedicated video-preview extension/MIME registry, keeping preview routing data-driven and preventing small video files from falling through the editable-text heuristic. Bare `.ts` intentionally remains text-first because this repo is TypeScript-heavy; video transport streams should use container-specific extensions such as `mts` / `m2ts`.
  - `src/components/ExplorerVideoEditor.tsx` is the shell-owned inline video surface. It keeps the useful trim/timeline idea from `packages/vid-editor`, but the app shell now owns playback state, trim handles, export prompting, loop behavior, visual treatment, and the direct-to-proxy playback fallback so the feature feels native to the explorer instead of like an embedded demo app.
  - `src/components/FileExplorer.tsx` now treats previewable video entries as a first-class preview state and routes them into the embedded video editor instead of external open or text fallback.
  - `src-tauri/src/video_commands.rs` is now both the preview compatibility backend and the trim/export backend. It resolves direct preview sources, generates cacheable ffmpeg-backed MP4 preview proxies under app-local managed storage when the desktop webview cannot decode the original cleanly, validates trim ranges, ensures the output path stays separate from the source, and shells out to `ffmpeg` for a non-destructive MP4 export.
  - `src/runtime/videoEditorBackend.ts` is the TS bridge for those native video commands. React should resolve preview sources, request preview proxies, and export trims through that bridge instead of ad hoc `invoke(...)`.
- Durable product note:
  - this is intentionally a trim/export workflow, not a full nonlinear editor. The imported `packages/vid-editor` package was mostly CRA shell + Redux + remote upload/transcode assumptions, so only the timeline interaction concept was assimilated. Filesystem truth and final media mutation stay in the GreebleFS host architecture.
  - direct preview is still preferred when the webview can decode the source, but playback must no longer depend on desktop codec luck alone. The host now owns the fallback lane and regenerates a preview-safe MP4 proxy instead of leaving preview dead on `.mov` / unsupported codec captures.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml video_commands:: -- --nocapture`
  - passed: `bunx vitest run src/test/explorerVideoEditor.test.tsx src/test/explorerBackend.bindings.test.ts`
  - passed: filtered typecheck for touched video/editor surfaces via `bunx tsc --noEmit --pretty false 2>&1 | rg "ExplorerVideoEditor|videoEditorBackend|video_commands|explorerVideoEditor|explorerBackend.bindings|src/generated/tauri.ts" || true`

## 2026-04-16 — Explorer Inline Image Editor

- The explorer preview pane now embeds a built-in image editor for supported raster files instead of only showing a static image preview.
- Durable implementation shape:
  - `src/components/ExplorerImageEditor.tsx` is the shell-owned wrapper for the embedded preview editor. It owns the host-native toolbar, save/reset/undo/redo actions, resize adaptation, status chrome, and the static-preview fallback path.
  - The current inline editing support set is intentionally save-safe: `png`, `jpg`, `jpeg`, and `webp`. Other image previews still render as static previews instead of risking a format-mismatch write-back.
  - `src/runtime/imageEditorRuntime.ts` is the integration seam for the local `packages/img-editor` package. The app now loads that editor through the `@img-editor-runtime` alias so the runtime can consume the package without dragging its entire TS surface into the main app typecheck.
  - `src/components/FileExplorer.tsx` now routes supported image previews through the embedded editor wrapper and refreshes the explorer after successful saves so metadata and thumbnails stay current.
  - The imported editor package was cleaned where it matters for host UX:
    - runtime-visible toolbar labels are now English
    - the default inserted text is now English
    - noisy history/image/editor-init debug logging was removed
    - key runtime error/warning strings now read like host-facing diagnostics instead of demo-package copy
- Durable product note:
  - this is still a preview-surface workflow, not a new filesystem truth lane. Saves flow back through `writeExplorerFile` and the normal explorer refresh/cache invalidation path.
- Validation:
  - passed: `bunx vitest run src/test/explorerImageEditor.test.tsx src/test/fileExplorer.viewModes.test.tsx`
  - passed: filtered typecheck for touched explorer/editor surfaces via `bunx tsc --noEmit --skipLibCheck --pretty false 2>&1 | rg "ExplorerImageEditor|imageEditorRuntime|FileExplorer|explorerImageEditor|imgEditorRuntime|packages/img-editor" || true`
  - passed: `bun run build`

## 2026-04-16 — Frontend Worker Runtime / Runtime Module Offload

- Frontend worker execution is now an explicit shell subsystem instead of implicit one-off transpilation work.
- Durable implementation shape:
  - `src/runtime/workerHost.ts` is now the shared frontend worker orchestrator. It owns browser-worker lane lifecycle, request/response routing, fallback-to-main-thread behavior, and lane telemetry snapshots for runtime-authored frontend work.
  - `src/runtime/moduleRuntime.ts`, `src/runtime/moduleRuntimeCore.ts`, and `src/runtime/moduleRuntime.worker.ts` now split authored-module loading into:
    - shared pure compile/execute helpers in `moduleRuntimeCore`
    - a dedicated worker entrypoint for serializable transpilation work
    - a main-thread bridge that keeps the public runtime API stable while routing transpilation through the worker host
  - plugin, shader, animation, wallpaper, and theme-renderer loaders inherit the worker-backed transpilation path automatically because they already load through `moduleRuntime.ts`.
  - execution remains intentionally hybrid:
    - workers own serializable TS/TSX transpilation
    - the main thread still owns final module execution/materialization for React-bearing runtime exports and host-bound allowlisted imports
  - `src/components/DevPerformanceHud.tsx` now surfaces worker telemetry (`WORK`, `WFALL`, `WERR`, `WLAST`) so browser threading activity is visible during local profiling and regression work.
- Durable testing note:
  - `src/test/moduleRuntime.workerBridge.test.ts` covers the fallback bridge path used in Vitest/test mode and verifies that runtime-module graph transpilation still preserves relative module resolution while worker telemetry updates.
- Validation:
  - passed: `bunx vitest run src/test/moduleRuntime.workerBridge.test.ts src/test/pluginRuntime.test.ts src/test/shaderRuntime.test.ts src/test/animationRuntime.test.ts src/test/themeRendererRuntime.test.tsx`
  - targeted TS check no longer reports the touched HUD path after replacing `PerformanceEntryList.at()` with array indexing
- Current limit:
  - the worker system currently accelerates runtime-authored module transpilation and observability; explorer derivation and package/theme normalization are still future lanes rather than landed worker-backed paths.

## 2026-04-16 — Explorer SoX Audio Workbench

- Audio files now stay inside the explorer as a shell-native workbench instead of a lightweight inline player.
- Durable implementation shape:
  - `src-tauri/src/audio_commands.rs` is the native audio lane. It resolves vendored SoX bundles from `packages/sox/bin`, unpacks the current-platform bundle into app-local managed storage, and exposes typed commands for preview analysis, preview-proxy generation, single-file transforms, and batch processing.
  - That lane is now explicitly hybrid instead of assuming vendored SoX can handle every codec on every OS:
    - SoX still owns waveform analysis, trim/fade/normalize effects, and spectrogram generation.
    - `ffmpeg` is now the codec bridge when the vendored SoX bundle cannot read or write a format on the current platform. Current proven case: Linux SoX bundle cannot read or write `mp3`, so the backend now decodes unsupported inputs to cached WAV staging assets and re-encodes unsupported outputs through `ffmpeg`.
  - `src-tauri/src/fs_commands.rs` now treats audio transforms and audio batch runs as first-class explorer tasks, including retry/cancel support through the same task center used by copy/move/archive work.
  - `src/runtime/audioWorkbenchBackend.ts` is the TS bridge for the new audio command surface; React should call that bridge instead of raw invoke strings.
  - `src/components/ExplorerAudioWorkbench.tsx` is the shell-owned inline audio surface. It owns transport controls, waveform rendering, draggable in/out selection, analysis cards, trim/fade/normalize/convert actions, overwrite confirmation, spectrogram rendering, and reliable source reload/proxy retry behavior when the player swaps from direct media to a generated proxy.
  - `src/components/FileExplorer.tsx` now routes previewable audio into the workbench instead of the raw `<audio>` card, and audio-heavy selection context menus expose `Batch Convert Audio` plus `Batch Normalize Audio`.
  - `src/config/filePreview.ts` now also owns a data-driven audio export-format catalog, plus `DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID` so non-destructive exports default to a safe cross-platform target (`wav`) instead of blindly reusing the source extension.
- Durable operator note:
  - direct playback still depends on the host webview codec stack. The workbench now reloads the player source explicitly, retries playback after proxy generation, and prefers proxy playback earlier on Linux for webview-fragile codecs.
  - do not assume the vendored SoX bundle has `mp3` support just because another workstation did. The runtime must probe and route by actual platform capability.
  - batch v1 is intentionally narrow: convert/normalize only. Trim/fade stay single-file workbench actions.
- Validation:
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml audio_commands:: -- --nocapture`
  - passed: `bunx vitest run src/test/filePreview.test.ts src/test/explorerAudioWorkbench.test.tsx src/test/fileExplorer.viewModes.test.tsx`
  - passed: filtered typecheck for touched audio/explorer surfaces via `bunx tsc --noEmit --pretty false 2>&1 | rg "ExplorerAudioWorkbench|audioWorkbenchBackend|src/config/filePreview.ts|src/components/FileExplorer.tsx|src/test/explorerAudioWorkbench.test.tsx|src/test/filePreview.test.ts|src/test/fileExplorer.viewModes.test.tsx|src/runtime/audioWorkbenchBackend.ts" || true`
  - passed: shell smoke on Linux proving `mp3` input decode -> SoX trim/normalize/fade -> `mp3` re-encode plus playable WAV preview proxy via `ffmpeg` / `ffprobe`
  - note: Rust tests still emit the same pre-existing unrelated `src-tauri/src/terminal.rs` warnings about `OsStr` and `ENV_TEST_LOCK`; this pass did not touch that subsystem

## 2026-04-16 — Shell-Native Dialog Cleanup

- Browser-native `window.prompt` / `window.confirm` / `window.alert` usage has been removed from the shipped React shell surfaces so the app no longer leaks `localhost says`-style browser chrome into premium workflows.
- Durable implementation shape:
  - `src/components/AppModal.tsx` is the shared shell-native modal primitive for prompt and confirm flows. New shell dialogs should route through it instead of calling browser APIs directly.
  - Explorer tag actions now use the in-app prompt flow instead of browser prompts:
    - `Add Tags...`
    - `Remove Tags...`
    - toolbar `Tag`
  - Source Control repo-path entry and destructive file/conflict confirmations now use the shared in-app modal flow instead of browser prompt/confirm behavior.
  - Screenshot-library deletion now uses the shared in-app confirmation flow instead of browser confirm.
  - Theme JSON import failures now stay inline inside `SettingsPage.tsx` instead of opening a browser alert.
- Durable operator note:
  - future shell work should treat browser-native dialogs as a regression. If a workflow needs input or confirmation, it belongs in the app visual system.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx src/test/gitManager.behavior.test.tsx src/test/screenshotsManager.test.tsx src/test/settingsPage.behavior.test.tsx`
  - passed: filtered typecheck for touched shell/dialog surfaces via `bunx tsc --noEmit --skipLibCheck --pretty false 2>&1 | rg "AppModal|FileExplorer|GitManager|ScreenshotsManager|SettingsPage|fileExplorer.viewModes|gitManager.behavior|screenshotsManager|settingsPage.behavior" || true`

## 2026-04-16 — Native Archive Open / Extract Pass

- Local archive files are now a first-class explorer workflow instead of always falling back to the OS shell.
- Durable implementation shape:
  - `src-tauri/src/archive_ops.rs` is the new Rust archive layer. It detects supported archive suffixes, extracts archives through native Rust libraries, rejects unsafe embedded paths, and supports three explorer-facing modes:
    - cached archive open
    - `Extract Here`
    - `Extract to "<name>"/`
  - The current supported local formats are:
    - `zip`, `cbz`, `jar`, `apk`
    - `7z`
    - `tar`, `tar.gz` / `tgz`, `tar.bz2` / `tbz2`, `tar.xz` / `txz`
    - single-stream `gz`, `bz2`, and `xz`
  - `src-tauri/src/fs_commands.rs` now exposes `fs_open_archive` plus `fs_extract_archive`, and archive extractions register as durable explorer tasks under the existing task-center model.
  - `src/config/explorerArchives.ts` is the TS-side archive registry and naming contract, so archive suffix checks and extracted-folder labels are not hardcoded inline in `FileExplorer.tsx`.
  - `src/runtime/explorerBackend.ts` now owns the typed archive bridge for the frontend.
  - `src/components/FileExplorer.tsx` now routes supported local archive opens through native archive extraction/opening, and archive context menus expose `Open Extracted Contents`, `Extract Here`, and `Extract to "<name>"/`.
- Durable product note:
  - archive opening now favors a cache-backed “browse extracted contents” flow so double-clicking archives does not litter the working directory by default, while explicit extraction actions still create real local files/folders where operators expect them.
- Validation:
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml archive_ops:: -- --nocapture`
  - passed: `bunx vitest run src/test/explorerArchives.test.ts src/test/explorerBackend.bindings.test.ts`
  - passed: filtered typecheck for touched archive/explorer surfaces via `bunx tsc --noEmit --skipLibCheck --pretty false 2>&1 | rg "explorerArchives|explorerBackend|FileExplorer|explorerContextMenu|tauri.ts|explorerBackend.bindings|explorerArchives.test" || true`
  - note: Rust test output still included pre-existing unrelated warnings in `src-tauri/src/terminal.rs` (`unused import: OsStr`, `ENV_TEST_LOCK` dead code); this pass did not touch that subsystem

## 2026-04-16 — Linux NVIDIA WebKit Launch Guard

- GreebleFS now applies a native Linux NVIDIA WebKitGTK workaround before Tauri boot so the app can recover from the recent `libEGL` / `driver (null)` / `failed to create dri2 screen` startup failures that were blocking launch on the Linux workstation.
- Durable implementation shape:
  - `src-tauri/src/linux_graphics.rs` is the new native startup helper. It resolves the effective Linux display backend from `GDK_BACKEND`, `XDG_SESSION_TYPE`, `WAYLAND_DISPLAY`, and `DISPLAY`, then checks for an NVIDIA primary GPU or loaded NVIDIA kernel modules through sysfs.
  - The helper now also persists a Linux startup backend preference in `~/.config/GreebleFS/startup-preferences.json` and honors `Auto`, `X11`, or `Wayland`, with legacy `OverlayTerm` config/env names still accepted on read.
  - `Auto` now deliberately falls back to `GDK_BACKEND=x11` on NVIDIA Wayland sessions when `DISPLAY` is available, so the app can launch through XWayland instead of staying on the fragile native Wayland WebKit path.
  - Wayland + NVIDIA now sets both `WEBKIT_DISABLE_DMABUF_RENDERER=1` and `__NV_DISABLE_EXPLICIT_SYNC=1` before `tauri::Builder::default()`.
  - X11 + NVIDIA now sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` before `tauri::Builder::default()`.
  - Explicit user-provided env overrides are preserved, so operators can still force or disable these knobs outside the app when debugging.
  - `src-tauri/src/lib.rs` now calls the helper at the top of `run()`, making the workaround apply to both `bun run tauri dev` and installed release binaries instead of depending on shell wrappers.
  - `src-tauri/src/startup_commands.rs`, `src/App.tsx`, `src/components/SettingsPage.tsx`, and `src/store/settingsStore.ts` now expose a Linux-only startup toggle so the UI can switch between `Auto`, `X11`, and `Wayland` for the next launch instead of relying on manual shell env exports.
- Durable operator note:
  - Local evidence on the current Linux workstation showed NVIDIA `580.126.09` with `eglinfo -B` succeeding on GBM/surfaceless but failing on Wayland/X11 platform init, which matches the class of WebKitGTK + NVIDIA launch failures this guard targets.
  - This shell session had no active `DISPLAY` or `WAYLAND_DISPLAY`, so no GUI smoke launch was possible here; proof for this pass is compile/test coverage plus the native startup placement.
- Validation:
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml linux_graphics -- --nocapture`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`

## 2026-04-15 — Explorer Side Rail View Modes

- The explorer side rail now has an explicit persisted view-mode contract instead of relying only on width-driven density heuristics.
- Durable implementation shape:
  - `src/config/explorerRail.ts` now defines the rail mode catalog: `default`, `compact`, and `tree`. Each mode carries presentation rules such as metadata visibility, drive-capacity chrome visibility, flattened drive roots, and tree indentation depth.
  - `src/components/explorer/explorerRailState.ts` now persists `rail.viewMode` and normalizes old saved rail snapshots back to `default`, so this feature rides the existing explorer rail persistence path instead of inventing a second settings surface.
  - `src/components/explorer/ExplorerSideRail.tsx` now renders a mode switcher in the rail header and routes all tree/bookmark row density through the selected mode. `compact` trims supporting metadata for the local folder tree and saved-search rows; `tree` goes further by flattening drive roots and hiding drive-capacity chrome for a more navigation-first rail.
- Durable product note:
  - this is intentionally a rail-presentation layer, not new filesystem behavior. Folder loading, navigation, and cache truth still stay in the existing explorer cache/runtime path.
- Validation:
  - passed: `bunx vitest run src/test/explorerSideRail.test.tsx`
  - blocked: full `bunx tsc --noEmit --pretty false` still reports pre-existing unrelated repo errors in `App.tsx`, `ScreenshotsManager.tsx`, several config/contracts files, and multiple older tests; no new blocker surfaced in the rail-mode files during this pass

## 2026-04-15 — Dedicated File Operations Popout Window

- Explorer copy/move workflows now have a dedicated themeable popout window instead of only relying on in-surface destination picking and the inline task badge.
- Durable implementation shape:
  - `src/runtime/fileOperationsWindow.ts` is the shared request/completion bridge for the `file-operations` window. It owns the window label, persisted request keys, cross-window event names, and the helpers that create/focus the popout plus broadcast completed transfers.
  - `src/main.tsx` now bootstraps by webview label. The normal `main` window still renders `App`, while the `file-operations` label renders `src/windows/FileOperationsWindowApp.tsx`.
  - `src/windows/FileOperationsWindowApp.tsx` is now the standalone themed Task Center surface. Destination picking moved into the dedicated explorer picker window path, while the popout keeps transfer/task visibility in one shell-owned place.
  - `src/components/explorer/ExplorerTaskCenterContent.tsx` is the shared task-center body used by both the inline explorer badge and the dedicated popout window.
  - `src/components/explorer/ExplorerTaskStatusBadge.tsx` now exposes a `Pop Out` action so operators can move from the inline status surface into the standalone file-operations window.
  - `src/components/FileExplorer.tsx` now routes explicit `Copy To...` / `Move To...` context-menu actions through the dedicated explorer picker window, and all successful transfer paths publish a cross-window completion event so other explorer instances can refresh when source or target folders change.
  - `src/App.tsx` now routes the command-palette task-center action into the dedicated file-operations window instead of only toggling the inline badge.
- Durable product note:
  - the file-operations window is intentionally a shell surface, not a second filesystem truth layer. Rust task/transfer truth still flows through `src/runtime/explorerBackend.ts`; the popout only owns task presentation and cross-window coordination.
- Validation:
  - passed: `bunx vitest run src/test/fileOperationsWindow.test.ts src/test/pluginPanelRequests.test.ts src/test/app.dockMode.test.tsx`
  - passed: targeted file-operations/window mock coverage in `src/test/fileOperationsWindow.test.ts`
  - blocked: narrowed `npx tsc --noEmit ...` still reports a pre-existing unrelated `src/components/ScreenshotsManager.tsx` type error (`SelectionHandle` includes `"move"` but the resize-handle prop does not)

## 2026-04-26 — Explorer Picker Window Wiring Pass

- The dedicated explorer picker window was present in the codebase but not reliably reachable in the live app because the Tauri capability set never granted secondary webview-window creation to the `picker` / `file-operations` labels.
- Durable implementation shape:
  - `src-tauri/capabilities/default.json` now explicitly includes the `picker` and `file-operations` window labels plus `core:webview:allow-create-webview-window`, which is required for `new WebviewWindow(...)` to succeed at runtime.
  - `src/runtime/explorerPicker.ts` now waits for `tauri://created`, rejects on `tauri://error`, and times out secondary-window launches instead of silently hanging forever when a picker window fails to appear.
  - `src/runtime/fileOperationsWindow.ts` now uses the same secondary-window readiness/error contract, but it degrades to a logged failure plus `null` return because many callers fire-and-forget the Task Center popout.
  - `src/components/SettingsPage.tsx` no longer tries to use `@tauri-apps/plugin-fs` as a folder dialog for VST scan paths. The Audio settings `Add Folder…` action now routes through `openExplorerPicker({ kind: 'openFolders', presentation: 'window' })` and merges unique folder picks back into settings state.
  - `src/App.tsx` now uses the same picker window for repository import, so folder-selection UX stays consistent instead of mixing embedded and secondary-window picker paths for similarly scoped tasks.
- Durable product note:
  - if a future agent adds another file/folder selection flow, route it through `src/runtime/explorerPicker.ts` first. Avoid inventing a fresh native dialog call unless the product intentionally wants a non-explorer picker experience.

## 2026-04-15 — Explorer Transfer Collision Pass

- Local explorer transfers no longer rely on silent collision-safe renaming as the only behavior.
- Durable implementation shape:
  - `src-tauri/src/fs_commands.rs` now exposes `fs_plan_transfer_items` plus explicit transfer collision policies on `fs_transfer_items`: `keep_both`, `replace`, and `skip`.
  - transfer results now include both the collision policy used and whether each source was actually transferred or skipped, so the frontend can treat conflict resolution as first-class state instead of assuming every request mutated disk.
  - `src/runtime/explorerBackend.ts` now exposes the new transfer-planning path and forwards the collision policy through the generated Specta bindings.
  - `src/components/FileExplorer.tsx` now routes paste, drag/drop, window-drop imports, and workspace pane transfers through one shared transfer workflow:
    - local collisions are planned before execution
    - the explorer opens a modal conflict chooser instead of silently inventing destination names
    - breadcrumb chips are valid internal drop targets for ancestor-folder copy/move flows
  - `src/test/setup.tsx` now mocks enough Tauri window/webview APIs for the file-operations event bridge used by the explorer transfer flow.
- Durable product note:
  - this closes one of the main “below Explorer baseline” trust gaps. The shell can keep its premium/power-user posture, but the core move/copy loop now behaves like a serious file manager instead of a best-effort content browser.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml transfer_items_ -- --nocapture`
  - passed: `bun run test:unit -- src/test/fileExplorer.viewModes.test.tsx src/test/explorerBackend.bindings.test.ts`
  - passed: filtered typecheck for touched explorer/binding surfaces via `bunx tsc --noEmit --skipLibCheck --pretty false 2>&1 | rg 'FileExplorer|explorerBackend|fileExplorer.viewModes|explorerBackend.bindings|tauri.ts|setup.tsx|cloud_commands|fs_commands' || true`

## 2026-04-15 — Native OS Icons Default

- The explorer now defaults to native OS file/folder icons instead of the managed theme icon pack baseline.
- Durable implementation shape:
  - `src/store/settingsStore.ts` now seeds `appearance.useNativeOsIcons` to `true` for fresh settings.
  - `src/config/pilotThemeContract.ts` now resets built-in pilot theme selections back to native OS icons instead of forcing the sparse managed icon set.
  - `src/components/SettingsPage.tsx` no longer forces `forceManagedIcons` when selecting a packaged theme that advertises icon assets. Theme packs can still provide managed icons as the fallback layer, but they no longer automatically override the OS-icon preference.
  - `src-tauri/src/desktop_integration.rs` no longer depends solely on `file_icon_provider` for Windows explorer icons. It now tries a direct Win32 shell-icon extraction path (`SHGetFileInfoW` + `HICON` rasterization) before falling back to the crate path, and it logs backend failures instead of silently converting every Windows failure into permanent null icon cache entries.
- Durable product note:
  - Managed/theme icons are currently too sparse to be a credible default explorer presentation. Native OS icons should remain the front-door baseline until the managed icon catalog is substantially broader.
- Validation:
  - passed: `bunx vitest run src/test/settingsStore.test.ts src/test/settingsPage.behavior.test.tsx`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - blocked: cross-target Windows `cargo check --target x86_64-pc-windows-gnu` currently cannot complete on the Linux workstation because `ring` needs a MinGW compiler (`x86_64-w64-mingw32-gcc`) that is not installed here

## 2026-04-15 — Linux Native Dev Launch Preflight

- `bun run tauri dev` on Linux was crashing deep in `tao`/GTK when launched from a shell with no active desktop session environment.
- Durable implementation shape:
  - `scripts/run-platform-tauri.mjs` now preflights Linux native dev launches.
  - the launcher derives a sane `GDK_BACKEND` from `XDG_SESSION_TYPE`, `WAYLAND_DISPLAY`, and `DISPLAY` when the caller did not set one explicitly.
  - when no `DISPLAY` and no `WAYLAND_DISPLAY` are present, the script now fails fast with a direct error instead of allowing the Tauri host to panic in GTK initialization.
- Durable operator note:
  - this failure is not caused by persisted frontend settings. If native dev mode dies before app setup with GTK backend errors, inspect the shell environment first.
- Validation:
  - passed: `bunx vitest run src/test/runPlatformTauri.test.ts`

## 2026-04-15 — Explorer Grid Image Thumbnails

- Grid/icon explorer modes now support inline image thumbnails for visible local image files, so directories with screenshots, artwork, or captures read more like a modern content browser instead of an icon wall.
- Durable implementation shape:
  - `src-tauri/src/fs_commands.rs` exposes `fs_read_image_thumbnail`, which decodes local images, resizes them into bounded PNG thumbnails, and rejects oversized sources or invalid dimensions.
  - `src/runtime/explorerBackend.ts` now routes thumbnail reads through the typed explorer backend contract instead of ad hoc UI-side invoke calls.
  - `src/components/FileExplorer.tsx` batches thumbnail requests only for visible grid entries, caches them by path, invalidates them on refresh, and falls back to the existing icon lane for folders, cloud paths, non-images, or failed thumbnail reads.
  - `src/test/fileExplorer.viewModes.test.tsx` now covers the grid thumbnail path with a deterministic viewport-size shim so virtualization does not hide the tile under jsdom.
- Durable product note:
  - this is intentionally a grid-surface enhancement, not a replacement for the existing selected-item preview panel. The explorer now has both: focused preview on selection and thumbnail scanning while browsing image-heavy folders.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml fs_read_image_thumbnail`
  - passed: `bun run test:unit src/test/fileExplorer.viewModes.test.tsx`

## 2026-04-15 — Explorer Rail Folder Tree

- The explorer rail now has a real lazy local folder tree under `Drives`, closer to the expected Windows/Finder-style folder-navigation model instead of a flat drive-only list.
- Durable implementation shape:
  - `src/components/explorer/ExplorerSideRail.tsx` now expands local drive roots into nested folder rows, auto-expands the active path ancestors, shows load/error/empty states, and routes folder clicks back through the existing explorer navigation path.
  - `src/components/explorer/explorerDirectoryCache.ts` is now the shared directory-listing cache contract for both `FileExplorer.tsx` and the rail tree, so the side rail does not invent a second uncached filesystem-read path.
  - `src/components/FileExplorer.tsx` now passes hidden-file visibility into the rail and continues to own global cache invalidation through `invalidateExplorerResultCaches()`.
- Validation:
  - passed: `bunx vitest run --environment jsdom src/test/explorerSideRail.test.tsx`
  - passed: `bunx vitest run --environment jsdom src/test/fileExplorer.viewModes.test.tsx`
  - passed: `bun run build`

## 2026-04-15 — Explorer Task Center / Release Hardening

- Explorer long-running file operations now have a durable Rust-backed task model instead of a badge-only transient feed.
- Durable implementation shape:
  - `src-tauri/src/fs_commands.rs` now owns the explorer task registry and Specta-visible task contract for copy/move/delete plus shared retry/cancel/history commands.
  - `src-tauri/src/explorer_pro_commands.rs` now reports trash, batch rename, duplicate scans, and undo-capable trash actions through the same durable task system instead of isolated one-off status updates.
  - `src/runtime/explorerBackend.ts` is the typed TS bridge for task snapshots and task actions, and `src/store/explorerTaskStore.ts` hydrates from snapshot commands before merging live `explorerTaskProgressEvent` updates.
  - `src/components/explorer/ExplorerTaskStatusBadge.tsx` is now an explorer-local Task Center popover with active/history grouping, retry/cancel/reveal/open/copy-error actions, and recent trash undo.
  - `src/App.tsx` now exposes `Open Task Center`, `Retry Failed Explorer Tasks`, and `Clear Completed Explorer Tasks` through the command palette.
- Release-hardening notes:
  - `src/config/hotkeys.ts` now resolves the shipping collision set by moving explorer layout off `Ctrl+L`, leaving `Ctrl+L` for address focus, and leaving `find` / `replace` unassigned until they have a safe release default.
  - `scripts/build-and-install-linux-local-release.sh` now points at the actual Cargo workspace release artifact `target/release/greeblefs`.
  - `src-tauri/src/terminal.rs` warning cleanup removed unreachable code and stale locals so `cargo check` is clean again.
- Validation:
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `bun test src/test/explorerTaskStore.test.tsx src/test/explorerBackend.bindings.test.ts src/test/hotkeys.test.ts`
  - passed: `bun run build`

## 2026-04-15 — Constellation View Orbit Rebalance

- Constellation mode no longer relies on a loose hash-jittered ellipse that can bunch many folders onto one side of the field.
- Durable implementation shape:
  - `src/components/explorer/constellationLayout.ts` now owns the constellation placement algorithm as a dedicated helper instead of burying the orbit math inside `FileExplorer.tsx`.
  - visible nodes are distributed through deterministic multi-lane orbit slots with explicit left/right coverage, lane rotation, and a reserved center safe zone so entries do not stack under the `Orbit Map` card.
  - `FileExplorer.tsx` still renders the same experimental mode, but the orbit field now gets a taller adaptive band height and per-node constellation data attributes for easier diagnostics.
- Durable product note:
  - the goal of constellation mode is now practical scan value, not just spectacle. Dense folder sets should read like a broad map with breathing room instead of collapsing into one clustered blob.
- Validation:
  - passed: `bun run test:unit src/test/constellationLayout.test.ts src/test/fileExplorer.viewModes.test.tsx`

## 2026-04-15 — Release Readiness Pass / v0.1.0-rc1

- Ran a ship-room audit against the repo-declared Linux release path.
- Durable release state:
  - `bun run build` passes and exports bindings; the production frontend build completes and the optimized native binary exists at `src-tauri/target/release/greeblefs` when bundling runs.
  - `bun run release:linux:bundle` currently fails after building the optimized binary because Tauri bundling cannot detect an appindicator package through `pkg-config` on the Linux host. Runtime `libayatana-appindicator3.so.1` is installed, but `pkg-config` cannot resolve `ayatana-appindicator3-0.1` or `appindicator3-0.1`, so the missing piece is likely the development package on the bundle machine.
  - `bun run test:unit` is red with `9` failing files, `20` failing tests, and `2` unhandled errors. The failing areas include plugin watcher fallback timing, GitManager and telemetry expectations, generated binding expectations, workbench theme expectations, a settings composer timeout, terminal REPL behavior, and animation bundle count.
  - `bun run test:browser` is red on the repository-picker current-folder title expectation.
  - `bun run test:rust` compiles successfully and starts the `src-tauri` suite, but no green result was captured in the release pass because long-running filesystem search and transfer tests exceeded the time window.
- Durable shipping decision:
  - `v0.1.0-rc1` is blocked on both validation and Linux packaging even though the production build itself succeeds.
- Recommended next step:
  - fix the red JS and browser suites first, then rerun Rust to completion, then install the appindicator development package on the Linux bundle host and rerun `bun run release:linux:bundle`.

## 2026-04-15 — Release Candidate Rename / Compatibility Release Prep

- Release-critical naming is now aligned on `GreebleFS` without breaking the legacy runtime surface in one pass.
- Durable implementation shape:
  - release/package surfaces now ship as `GreebleFS` / `greeblefs`, including `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, installer metadata, and visible shell copy.
  - `scripts/build-and-install-linux-local-release.sh` now installs under `~/.local/opt/greeblefs`, creates `~/.local/bin/greeblefs`, and keeps a legacy `overlayterm` CLI alias for one RC.
  - `scripts/run-platform-tauri.mjs` and `src/config/appContentDirectories.ts` now support new `GREEBLEFS_*` / `VITE_GREEBLEFS_*` env names while preserving old `OVERLAYTERM_*` fallbacks.
  - `src/config/appContentDirectories.ts` now migrates release app-local content from the old Tauri identifier root `co.overlayterm.app` into `co.greeblefs.app`, not just the older home-root layout.
  - `docs/release-compatibility.md` is the explicit compatibility contract for the RC and documents which old plugin/runtime/event/storage identifiers remain intentionally unchanged.
- Durable validation note:
  - passed targeted release-surface tests:
    - `src/test/layoutProfiles.edge.test.ts`
    - `src/test/appContentDirectories.test.ts`
    - `src/test/settingsPage.behavior.test.tsx`
    - `src/test/gitManager.behavior.test.tsx`
  - `bun run build` passes.
  - `bun run release:linux:bundle` now reaches a concrete Linux host blocker: Tauri aborts with `Can't detect any appindicator library`.
  - `bun run test:rust` is still not a green gate; one `fs_commands` test failed and the long-running recursive search/transfer cluster remained unstable.

## 2026-04-15 — Explorer Commander Bridge / Cross-Pane Power Controls

- The explorer workspace now has first-class commander-style pane actions instead of only passive split layouts.
- Durable implementation shape:
  - `src/components/explorer/ExplorerWorkspace.tsx` now exposes cross-pane controls for path sync, linked navigation, copy-to-pane, and move-to-pane on top of the slot-based `1-Up` / `2-Up` / `4-Up` workspace shell.
  - `src/components/FileExplorer.tsx` now publishes a narrow runtime snapshot upward (`currentPath`, cloud/local state, and selected entries) and accepts explicit workspace commands for navigation, refresh, and selection transfer. This keeps transfer execution in the explorer/native layer instead of duplicating it in workspace chrome.
  - `src/config/explorerChromeLayouts.ts` now knows about the commander controls, so the workspace header can place them through the existing chrome-layout system instead of hardcoded JSX order.
  - `src/store/explorerStore.ts` now preserves focus when `createWorkspaceTab({ activate: false })` is used for hidden-pane creation, so cycling into split/quad layouts no longer steals the operator onto a newly spawned pane.
- Durable product note:
  - the power-user value here is the loop: split the workspace, keep pane focus stable, sync the target when needed, and copy/move the active selection across panes without bouncing through clipboard-only workflows.
- Validation:
  - passed: `bunx vitest run src/test/ExplorerWorkspace.test.tsx src/test/explorerStore.test.ts src/test/fileExplorer.viewModes.test.tsx`
  - observed no matching TypeScript errors for `ExplorerWorkspace`, `FileExplorer`, `explorerChromeLayouts`, `explorerStore`, or `explorerWorkspaceLayouts` while running `bunx tsc --noEmit --skipLibCheck --pretty false 2>&1 | rg "ExplorerWorkspace|FileExplorer|explorerChromeLayouts|explorerStore|explorerWorkspaceLayouts"`

## 2026-04-15 — Explorer Workspace Split System / Quad View

- The explorer workspace no longer assumes a hardcoded left/right dual-pane model.
- Durable implementation shape:
  - `src/config/explorerWorkspaceLayouts.ts` is now the data-driven workspace layout contract for `single`, `split`, and `quad`, plus pane-slot ids `pane-1` through `pane-4`.
  - `src/store/explorerStore.ts` now persists workspace activity against pane slots instead of `left` / `right`, and stores `columnSplitRatio` plus `rowSplitRatio` instead of one `splitRatio`.
  - workspace normalization now migrates legacy `left` / `right`, `dual`, and `splitRatio` state forward while reassigning tabs from hidden panes back into visible panes when layouts collapse.
  - `src/components/explorer/ExplorerWorkspace.tsx` now renders the workspace through the slot/layout contract, exposes `1-Up` / `2-Up` / `4-Up` mode controls, and treats pane focus/tab moves generically instead of hardcoding “other side”.
- Durable product note:
  - the explorer workspace should behave like a simple adaptive pane system, not a fragile left/right lock. `quad` is now the supported path for a denser workspace without introducing a custom docking runtime.
- Validation:
  - passed: `bunx vitest run src/test/explorerChromeLayouts.test.ts src/test/explorerTheme.test.ts src/test/settingsStore.test.ts src/test/explorerStore.test.ts src/test/ExplorerWorkspace.test.tsx src/test/fileExplorer.viewModes.test.tsx`

## 2026-04-15 — Theme Catalog Pilot Suite Reset

- Package themes are no longer treated as one flat catalog.
- Durable implementation shape:
  - `src/config/themeCatalogCuration.ts` is now the host-owned source of truth for package-theme curation tiers and official pilot ordering.
  - `src/config/themePackages.ts` attaches computed `catalog` metadata to every `LoadedOverlayThemePackage`, so downstream UI/runtime code can badge, sort, and group themes without hardcoding ids locally.
  - `src/components/SettingsPage.tsx` now presents the catalog as three lanes:
    - `Official Pilot Suite`
    - `Built-In Baselines`
    - `Legacy / Lab Archive`
  - the current official pilot package set is:
    - `vector-monolith`
    - `cyber-nexus-hud`
    - `celestial-astrolabe`
    - `clarity-line`
- Durable product note:
  - official pilot themes are now the intended front-of-house shells; the archive remains selectable but should not visually dominate Settings or read like equal-status product direction.
- Validation:
  - passed: `bunx vitest run --environment node src/test/themePackages.test.ts src/test/themeCatalogCuration.test.ts`
  - passed: `bunx vitest run --environment jsdom src/test/settingsPage.behavior.test.tsx`

## 2026-04-15 — Celestial Astrolabe Full-Screen Observatory

- `themes/celestial-astrolabe/renderers/astrolabe.tsx` no longer reads like a decorative three-column layout.
- Durable implementation shape:
  - the content stage now occupies the center of the viewport as the primary astronomical instrument
  - launcher groups and panel selectors orbit the stage instead of living as a conventional left sidebar
  - supporting controls moved into a full-width lower deck so the shell uses the full screen more aggressively
  - viewport-safe clamping still comes from the renderer-owned shell model and normalized layout regions
- Durable design note:
  - this theme is now intended to be part of the official pilot suite, not a legacy spectacle demo
- Validation:
  - passed: `bunx vite build`

## 2026-04-15 — Sketchfab Package Plugin / Generic Plugin Panel Requests

- Explorer plugin context menus can now open plugin panels through a shared generic handoff path instead of one-off panel bridges.
- Durable implementation shape:
  - `src/runtime/pluginPanelRequests.ts` is now the shared panel-request contract. It persists the latest request in local storage and broadcasts both a global open-panel event and a panel-specific event so plugins can react immediately when already mounted.
  - `src/config/pluginContributions.ts` and `src/config/pluginPackages.ts` now support a third explorer context-menu execution mode: `panel-request`. Use this when a context-menu action should open a plugin panel with structured payload such as a destination folder path.
  - `src/components/FileExplorer.tsx` resolves panel-request payload templates from the active explorer selection/background path and dispatches them through the shared request bridge, while `src/App.tsx` owns opening the requested plugin panel and surfacing the shell if it is hidden.
  - `src/components/pluginRuntime.tsx` now loads packaged frontend plugins through a module graph instead of a single transpiled file, so package plugins can import sibling helpers with package-local relative imports.
  - The `overlayterm-plugin` runtime module now exposes `getPluginPanelOpenRequestEvent()`, `readPluginPanelOpenRequest()`, and `requestPluginPanelOpen()` for packaged plugins that need to receive or emit shell-level panel handoffs.
  - `plugins/sketchfab/` is now a real package plugin with `plugin.json`, a rewritten `AssetBrowser.tsx`, and `sketchfabService.ts`. Explorer can hand the selected folder into the Sketchfab panel, search downloadable models, and save them into any chosen folder while writing a sibling `.sketchfab.json` attribution file.
- Durable authoring notes:
  - Package plugin relative imports must stay inside the package root. The runtime resolver intentionally blocks traversal outside the plugin directory.
  - `panelRequest.payload` values are string-template tokens resolved against explorer context before the panel opens. Use them for folder/file handoff, not for arbitrary code execution.
  - The Sketchfab plugin currently saves a direct `.glb` when available and otherwise saves the downloadable archive as provided by the API; archive extraction is not implemented yet.
- Validation:
  - passed: `bunx vitest run src/test/pluginRuntime.test.ts src/test/pluginRuntime.edge.test.ts src/test/pluginPackages.test.ts src/test/pluginPanelRequests.test.ts`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "context menu"`
  - passed: `timeout 20s bunx tsc --noEmit --skipLibCheck 2>&1 | rg "pluginPanelRequests|panel-request|Sketchfab|sketchfab|AssetBrowser|sketchfabService|resolveRelativeModuleSource|pluginRuntime|pluginPackages" || true`
  - passed: runtime smoke loading `plugins/sketchfab/AssetBrowser.tsx` through `loadPluginFromSource`

## 2026-04-15 — Custom Theme Renderer Overhaul Lane A

- Rewrote the owned custom themes to use the newer renderer contract and to feel materially more premium:
  - `themes/clarity-line/renderers/clarity-line-shell.tsx`
  - `themes/xmb-crosswave/renderers/xmb-crosswave.tsx`
  - `themes/wii-channel-home/renderers/wii-channel-home.tsx`
- Durable implementation shape:
  - all three themes now read from `host.shellModel` and normalize their visible shell rails from `host.shellModel.layout.regions`
  - no owned file uses `host.panels` or `host.renderChromeBar()`
  - each renderer uses `host.renderUtilityActionsSurface()` for utility chrome and renders launcher/pinned surfaces as theme-native structural regions instead of duplicated top bars
  - each renderer collapses hidden rails cleanly when the normalized shell regions disappear, so the layouts stay viewport-safe instead of depending on zero-width columns
  - Clarity Line is now an editorial shell with grouped launcher cards and a dedicated pinned rail, XMB Crosswave is a console-style axis/wave layout, and Wii Channel Home is a bright channel wall with a hero surface and channel cards
- Validation:
  - passed: `rg -n "host\\.panels|renderChromeBar\\(" themes/clarity-line themes/xmb-crosswave themes/wii-channel-home`
  - passed: `node <<'NODE' ... transpileModule ... NODE` over the three rewritten renderer files
  - passed: `bunx vite build`

## 2026-04-15 — Retro Console Renderer Rewrite Lane B

- Rebuilt the owned retro-console renderers to use the normalized renderer shell contract instead of the old hardcoded launcher/chrome compositions:
  - `themes/dreamcast-skyline/renderers/dreamcast-skyline.tsx`
  - `themes/gamecube-helix/renderers/gamecube-helix.tsx`
  - `themes/gamecube-orbital/renderers/gamecube-orbital.tsx`
  - `themes/gamecube-prism/renderers/gamecube-prism.tsx`
- Durable implementation shape:
  - all four renderers now anchor geometry to `host.shellModel.layout.regions` and use `host.shellModel.launcher` for groups/panels
  - all four claim `surfaceOwnership` for launcher, chrome, contentFrame, pinnedPanels, and wallpaper so the host does not inject duplicate launcher chrome or pinned surfaces
  - all four use `host.renderUtilityActionsSurface()` for utility chrome and avoid `host.panels` / `host.renderChromeBar()`
  - Dreamcast is now a bright dashboard shell, while the GameCube trio split into helix, orbital, and prism geometry languages instead of sharing one generic shell
- Validation:
  - passed: `npx vitest run --environment node src/test/themeRendererPackages.test.ts src/test/themeRendererRuntime.test.ts src/test/themeRendererShellModel.test.ts src/test/workbenchRenderRuntime.test.ts`
  - passed: `node - <<'NODE' ... transpileModule ... NODE` over the four rewritten renderer files
  - passed: `rg -n "host\\.panels|renderChromeBar" themes/dreamcast-skyline/renderers/dreamcast-skyline.tsx themes/gamecube-helix/renderers/gamecube-helix.tsx themes/gamecube-orbital/renderers/gamecube-orbital.tsx themes/gamecube-prism/renderers/gamecube-prism.tsx`

## 2026-04-15 — Custom Theme Renderer Overhaul Lane C

- Rewrote the owned spectacle themes to use the newer renderer contract instead of raw shell chrome:
  - `themes/celestial-astrolabe/renderers/astrolabe.tsx`
  - `themes/arcade-atrium/renderers/arcade-atrium-shell.tsx`
  - `themes/arcade-arcology/renderers/arcade-arcology.tsx`
- Durable implementation shape:
  - all three themes now build launcher/content geometry from `host.shellModel`, especially `launcher.groups`, `launcher.panels`, and normalized `layout.regions`
  - no owned file uses `host.panels` or `host.renderChromeBar()`
  - utility controls now come from `host.renderUtilityActionsSurface()` instead of duplicated chrome bars
  - the launcher is rendered as a theme-native structural surface in each file, with viewport-safe sizing derived from the normalized shell layout
  - `arcade-arcology` was upgraded from a default-navigation hybrid into a fully owned launcher/chrome shell so the right rail can stay independent of host chrome
- Design note:
  - these shells are now distinct layout languages rather than palette swaps
  - the goal was to keep them spectacle-heavy while still obeying the viewport clamps and ownership contract so they do not float off-screen or render duplicate launcher controls
- Validation:
  - passed: `rg -n "host\\.panels|renderChromeBar\\(" themes/celestial-astrolabe/renderers/astrolabe.tsx themes/arcade-atrium/renderers/arcade-atrium-shell.tsx themes/arcade-arcology/renderers/arcade-arcology.tsx`
  - passed: `node - <<'NODE' ... transpileModule ... NODE`
  - passed: `bash -lc 'if rg -n "host\\.panels|renderChromeBar\\(" themes/celestial-astrolabe/renderers/astrolabe.tsx themes/arcade-atrium/renderers/arcade-atrium-shell.tsx themes/arcade-arcology/renderers/arcade-arcology.tsx; then exit 1; else echo "forbidden patterns absent"; fi'`

## 2026-04-15 — Wayland Dock Host Split

- Linux Wayland dock mode now routes through a dedicated host instead of trying to make the normal `main` Tauri window behave like a panel.
- Durable implementation shape:
  - `src-tauri/src/wayland_dock.rs` owns the separate `dock` webview host and applies `gtk-layer-shell` anchoring/layout for Wayland panel behavior.
  - `src-tauri/src/window_commands.rs` exposes dock-host status and a native dock-layout command, while `src/runtime/windowHost.ts` owns the frontend `main` vs `dock` routing contract and host-targeted event names.
  - `src/App.tsx` now treats presentation as host-owned state on Wayland: `main` keeps the global shortcut and forwards toggle/show requests to `dock` when overlay mode is active, while inactive hosts stay hidden instead of trying to manage geometry.
  - `src/store/settingsStore.ts` and `src/store/explorerStore.ts` listen for `storage` updates so the hidden host can rehydrate persisted settings/explorer session state during cross-window handoff.
  - `src/components/SettingsPage.tsx` and `src/panels/panelRegistry.tsx` route window-mode changes through the host-aware mode-switch callback instead of directly mutating `settings.terminal.windowMode`.
- Validation:
  - passed: `bun run test:unit src/test/app.dockMode.test.tsx`
  - passed: `bun run test:unit src/test/app.dockMode.test.tsx src/test/panelRegistry.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsStore.test.ts`
  - passed: `bun run test:unit src/test/app.dockMode.test.tsx src/test/panelRegistry.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsStore.test.ts src/test/explorerStore.test.ts src/test/globalShortcuts.test.tsx`
  - passed: `bun run test:browser src/test/browser/animationRuntime.browser.test.tsx`
- Current blocker:
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings` is still red on unrelated pre-existing errors in `src-tauri/src/cloud_commands.rs`, so the Wayland dock commands currently need a centralized runtime wrapper instead of relying on freshly regenerated TS bindings.

## 2026-04-15 — Cloud Provider Credentials / Settings-Managed OAuth

- Cloud login no longer depends on external env vars alone.
- Durable implementation shape:
  - `src-tauri/src/cloud_commands.rs` now resolves provider credentials from two lanes:
    - Settings-managed provider config stored under app-local `cloud/providers.json` for the client ID plus OS keychain storage for the optional client secret
    - fallback runtime environment variables for Google Drive and Dropbox
  - Saved Settings credentials take precedence over env vars until the user clears them.
  - Refresh tokens still live in the OS keychain and account metadata still lives in app-local storage; this change only adds a first-class place to manage provider app credentials from inside the desktop shell.
  - Dropbox OAuth no longer uses a random loopback redirect. The backend now uses the fixed callback URI `http://localhost:53682/callback` so the Dropbox app console can whitelist one stable redirect target.
  - `src/runtime/explorerBackend.ts` exposes the new typed provider-config commands, and `src/components/SettingsPage.tsx` now renders per-provider client ID / client secret controls, save/clear actions, source/status badges, and provider-specific setup guidance inline with the Connect button.
- Durable operator note:
  - Google Drive should be set up as a desktop OAuth client.
  - Dropbox must allow `http://localhost:53682/callback`; if sign-in times out, verify that callback first.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx`
  - passed: filtered targeted TS check showing no errors from `src/runtime/explorerBackend.ts`, `src/components/SettingsPage.tsx`, `src/test/settingsPage.behavior.test.tsx`, or `src/generated/tauri.ts`
  - repo note: the narrowed `bunx tsc --noEmit ...` path is still red on unrelated existing failures in `FileExplorer.tsx`, `GitManager.tsx`, `ScreenshotsManager.tsx`, `performanceTelemetry.ts`, and `explorerStore.ts`

## 2026-04-15 — Vector Monolith Three.js Theme Package

- Added `themes/vector-monolith/` as the first packaged Three.js theme built on top of the new multi-file renderer module graph.
- Durable shape:
  - the package ships one renderer entrypoint but splits behavior into separate app and dock shells under `renderers/monolith/modes/`
  - the dock lane is authored in-package through `theme.dock.workbench` and `theme.dock.explorer`, so overlay mode gets tighter chrome and explorer defaults without needing a separate manifest contract
  - shared Three.js scene plumbing lives in `renderers/monolith/components/three-backdrop.tsx`, while the 3D shell framing stays in host-owned React surfaces via `host.renderPanelSurface(...)`
  - `src/test/themeRendererPackages.test.ts` now resolves real filesystem-relative imports, so packaged multi-file renderer fixtures are exercised directly instead of assuming single-file entrypoints
- Validation target:
  - `bunx vitest run src/test/themeRendererPackages.test.ts src/test/themeRendererRuntime.test.tsx src/test/themePackages.test.ts`
- Current limitation:
  - this is a shell-level 3D treatment around host panels; the explorer contents themselves are still DOM surfaces, not yet a native in-scene 3D object graph of individual files/folders

## 2026-04-15 — Explorer Context Menu Catalog / Plugin Composer

- Explorer context menus now resolve through a shared typed catalog instead of ad hoc hardcoded JSX-only item lists.
- Durable implementation shape:
  - `src/config/explorerContextMenu.ts` is the source of truth for built-in explorer context menu actions, group/order metadata, override normalization, sorting, and legacy explorer-action compatibility shims.
  - `src/config/pluginContributions.ts` and `src/config/pluginPackages.ts` now support `contextMenuItems` plugin contributions. Package manifests can contribute either:
    - terminal-template items that inject/run terminal commands with token substitution
    - compiled backend items that execute a plugin-owned binary/script entry through the existing native plugin backend runner
  - `src/runtime/useFolderPluginRuntime.ts`, `src/panels/panelRegistry.tsx`, `src/components/explorer/ExplorerWorkspace.tsx`, and `src/components/FileExplorer.tsx` now carry `pluginContextMenuItems` all the way into the explorer surface.
  - `FileExplorer.tsx` now builds entry/background menus from the shared catalog, then applies per-item visibility and user-defined sort overrides before rendering separators.
  - `src/store/settingsStore.ts` now persists `settings.explorer.contextMenuItemOverrides`, and `src/components/SettingsPage.tsx` exposes a `Context Menu Composer` for enabling/disabling items and reordering built-ins plus plugin items together.
- Durable authoring note:
  - plugin manifest `contributions.contextMenuItems` supports `contexts`, `appliesTo`, `group`, `order`, `iconName`, `command`, `runOnSelect`, and `backend.{ entry, args }`
  - plugin manifest `contributions.contextMenuItems` also supports `panelRequest.{ panelId?, payload }` for opening a plugin panel with explorer-derived context
  - backend entries must stay package-relative and pass the same safe-relative-path validation as other plugin assets
- Validation:
  - passed: `bunx vitest run src/test/pluginPackages.test.ts src/test/panelRegistry.test.tsx src/test/pluginsManager.test.tsx src/test/useFolderPluginRuntime.test.tsx src/test/useFolderPluginRuntime.queue.test.tsx src/test/ExplorerWorkspace.test.tsx`
  - passed: `bunx vitest run src/test/settingsStore.test.ts -t "context menu overrides"`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "context menu composer"`
  - repo note: broad `bunx tsc --noEmit --skipLibCheck` is still red on unrelated long-standing `explorerStore` and `FileExplorer.tsx` issues, and the fallback polling watcher suite still has pre-existing timer/cleanup instability that is not specific to the context-menu plugin path

## 2026-04-15 — Theme Renderer Multi-File Module Graph

- Theme renderers are no longer single-file only.
- Durable implementation shape:
  - `src/runtime/moduleRuntime.ts` now supports compiling and executing a small runtime module graph, not just a single transpiled module blob.
  - `src/components/themeRendererRuntime.tsx` now uses that graph path, so a renderer entry file can import sibling helpers with relative paths while still using the host-owned allowlist for external libraries.
  - `src/config/themePackages.ts` now resolves relative theme-renderer imports against the current theme package root, tries `.ts` / `.tsx` / `.js` / `.jsx` plus `index.*`, and blocks path traversal outside the package by returning no resolution when `..` would escape the root.
  - `three` remains a host allowlisted external import for theme renderers, but theme packages still do not get arbitrary package-manager access; external imports must be explicitly injected by the host runtime.
- Durable authoring note:
  - Theme renderer entries can now be split into small local files such as `renderers/shell/body.tsx` and `renderers/shell/frame.ts`.
  - Use relative imports for local helpers. Do not assume arbitrary npm dependencies are available inside theme packages.
- Validation:
  - passed: `bunx vitest run src/test/themeRendererRuntime.test.tsx src/test/themePackages.test.ts`
  - passed: `bunx vitest run src/test/themeRendererPackages.test.ts src/test/themePackageExplorerRecipe.test.ts`
  - blocked by pre-existing unrelated workspace TypeScript errors in `FileExplorer.tsx`, `GitManager.tsx`, `ScreenshotsManager.tsx`, `ExplorerWorkspace.tsx`, `explorerContextMenu.ts`, `performanceTelemetry.ts`, and `explorerStore.ts` during narrowed `bunx tsc --noEmit ...`

## 2026-04-15 — Pilot Default Theme Baseline

- Added `src/config/pilotThemeContract.ts` as the data-driven source of truth for the boring/default shell baseline.
- Durable implementation shape:
  - `pilot-dark` and `pilot-light` are now the canonical built-in defaults, and `pilot-dark` is the repo default/fallback theme instead of `operator`.
  - `src/config/appearance.ts` now gives all built-in themes the same pilot workbench, explorer, and dock recipe baseline, so built-in theme changes keep the shell layout contract stable even when the palette changes.
  - `src/store/settingsStore.ts` now owns `applyThemeSelection()` and `applyDockThemeSelection()`; Settings should use those actions instead of directly flipping `activeThemeId`.
  - built-in theme selection now resets theme-managed shell state in one place: dock follow/override defaults, wallpaper/shader/open-close motion overrides, clean app visual controls, explorer presentation defaults, primary layout profile, and dock theme normalization.
  - built-in theme selection deliberately does not mutate live explorer session state anymore. It resets explorer settings/layout defaults, but `currentPath`, `history`, `shellLayoutId`, preview/source visibility, and live sidebar/preview widths stay session-owned.
  - package theme selection still clears theme-managed shader/motion overrides and can force managed icons on, but it does not force the pilot layout reset path unless the selected theme id is in the built-in pilot-default contract.
- Durable UI note:
  - `src/components/SettingsPage.tsx` theme cards can now show both pilot recipe badges and package capability badges, so the capability badge limit was widened to keep package metadata visible after the pilot baseline landed.
- Validation:
  - passed: `bunx vitest run src/test/appearance.test.ts src/test/settingsStore.test.ts src/test/settingsPage.behavior.test.tsx src/test/app.dockMode.test.tsx`
  - passed: `bunx vitest run src/test/themeEngineBackend.test.ts src/test/workbenchRenderRuntime.test.ts src/test/fileExplorer.viewModes.test.tsx src/test/themeEngineCatalog.regression.test.ts`
  - repo note: broad `bunx tsc --noEmit` is still red on many pre-existing `App.tsx`, `FileExplorer.tsx`, store, and test typing issues outside this pilot-theme pass

## 2026-04-15 — Dock Theme Lane / Dock Presentation Split

- Dock mode is now a first-class presentation lane instead of a thin alias of the app shell.
- Durable implementation shape:
  - `src/store/settingsStore.ts` now persists `settings.appearance.dockThemeMode` (`follow-app` or `override`) plus `settings.appearance.activeDockThemeId`.
  - `src/config/appearance.ts` now resolves both `app` and `dock` appearance channels at once and then selects the active lane from `settings.terminal.windowMode`.
  - Theme manifests can now declare `theme.dock.workbench` and `theme.dock.explorer`. Those dock overrides merge on top of the selected dock base theme rather than replacing the entire theme pipeline.
  - When dock follows the app theme, the dock base theme is the active app theme. When dock overrides the app theme, the dock base theme comes from `activeDockThemeId`, with safe fallback back to the app theme if the override id is missing or invalid.
  - `src/config/themePackages.ts` now preserves `theme.dock.*` and exposes dock capability metadata so the theme catalog can label dock-aware themes.
  - `src/App.tsx` and `src/components/TerminalOverlay.tsx` now consume the mode-aware appearance result, and the explorer panel wiring now uses `explorerLayoutMode: 'dock'`.
  - `src/config/layoutProfiles.ts` normalizes legacy persisted `compact-dock` values to `dock`, so old layout/profile state keeps loading cleanly.
  - `src/components/SettingsPage.tsx` now exposes dock-theme controls: follow the application theme or pick a separate dock theme, plus theme-card badges for dock-capable packages.
- Durable behavior note:
  - dock still reuses the same explorer/workspace sessions and filesystem truth as app mode, but its layout and appearance are now intentionally separable so the UE-style dock surface can be tuned harder without destabilizing the main shell
  - the dock layout contract keeps inline preview closed, and `FileExplorer.tsx` now mounts cleanly in dock mode after removing a real `borderBottom`/`borderColor` style conflict from list rows
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `bunx vitest run src/test/appearance.test.ts src/test/settingsStore.test.ts src/test/themePackageExplorerRecipe.test.ts src/test/settingsPage.behavior.test.tsx src/test/app.dockMode.test.tsx src/test/layoutProfiles.test.ts src/test/fileExplorer.viewModes.test.tsx src/test/themePackages.test.ts`

## 2026-04-15 — Adaptive Explorer Chrome Phase 1

- Explorer chrome composition is now a first-class config/runtime layer, separate from explorer pane composition.
- Durable implementation shape:
  - `src/config/explorerChromeLayouts.ts` defines the built-in chrome surfaces (`explorerTopbar`, `explorerToolbar`, `workspaceHeader`), control ids, layout ids, zone/order metadata, and override normalization/resolution helpers.
  - `src/components/explorer/ExplorerChromeSurface.tsx` is the shared renderer for resolved chrome surfaces. `FileExplorer.tsx` and `ExplorerWorkspace.tsx` should render resolved control surfaces through this component instead of hardcoding toolbar/header button order in JSX.
  - `src/config/explorerTheme.ts` now carries `chromeLayoutId` on the resolved explorer recipe, with `default` normalization so existing themes keep working without explicit chrome config.
  - `src/store/settingsStore.ts` now persists `settings.explorer.chromeLayoutOverridesByThemeId`, keyed by theme id and `chromeLayoutId`. This is intentionally separate from `shellLayoutId`, `sidebarWidth`, `previewWidth`, `sourcesVisible`, and named explorer session state.
  - `shellLayoutId` still owns pane structure like rail visibility and preview placement. `chromeLayoutId` only owns explorer control composition.
- Stabilization fix:
  - `FileExplorer.tsx` no longer uses the old mount-time boot navigation effect path that could synchronously schedule state updates during passive-effect mount. Boot navigation now runs through a deferred callback path, which stops the `getRootForUpdatedFiber` / OverlayTerm runtime crash seen during initial explorer mount and strict remounts.
- Durable testing posture:
  - `src/test/explorerChromeLayouts.test.ts` covers chrome layout normalization and override resolution.
  - `src/test/explorerTheme.test.ts`, `src/test/themePackageExplorerRecipe.test.ts`, `src/test/settingsStore.test.ts`, `src/test/fileExplorer.viewModes.test.tsx`, and `src/test/ExplorerWorkspace.test.tsx` now cover `chromeLayoutId`, per-theme overrides, workspace-header chrome composition, topbar rendering, and the strict-mode boot regression.
- Related durable note:
  - explorer drag intent still defaults to native drag-out on plain drag and internal-only drag on `Shift`. Keep docs/tests aligned with that runtime contract unless the drag model is deliberately redesigned.

## 2026-04-15 — Adaptive Explorer Chrome Phase 2

- Explorer modes are now a first-class config/runtime layer instead of being implied by `session.shellLayoutId`.
- Durable implementation shape:
  - `src/config/explorerModeProfiles.ts` is the new source of truth for explorer mode identities. Built-ins currently map:
    - `balanced` -> `paneLayoutId: balanced`, `chromeLayoutId: default`
    - `navigator` -> `paneLayoutId: navigator`, `chromeLayoutId: default`
    - `focus` -> `paneLayoutId: focus`, `chromeLayoutId: focused-search`
    - `inspector` -> `paneLayoutId: inspector`, `chromeLayoutId: default`
  - `src/config/explorerTheme.ts` now resolves `defaultModeProfileId` on the explorer recipe. Theme/user mode resolution precedence is:
    - per-theme `settings.explorer.modeProfileOverridesByThemeId`
    - theme `defaultModeProfileId`
    - legacy `session.shellLayoutId`
    - built-in `balanced`
  - `src/store/settingsStore.ts` now persists `modeProfileOverridesByThemeId` separately from `chromeLayoutOverridesByThemeId`. Theme selection no longer rewrites explorer session pane state.
  - `src/config/explorerChromeLayouts.ts` now covers six surfaces instead of three:
    - `explorerTopbar`
    - `explorerToolbar`
    - `workspaceHeader`
    - `railHeader`
    - `previewHeader`
    - `explorerStatusBar`
  - `FileExplorer.tsx`, `ExplorerWorkspace.tsx`, `ExplorerSideRail.tsx`, and the preview panel now all resolve chrome through shared surface layouts. The status strip is no longer hardcoded JSX.
  - Zone-based chrome edit mode now exists for explorer chrome. It persists per-theme/per-layout override snapshots and only supports surface/zone/order changes; it is not a free-pixel docking system.
  - `session.shellLayoutId` still remains in `src/store/explorerStore.ts` as the pane-layout compatibility fallback for existing sessions, and live `sidebarWidth`, `previewWidth`, and `sourcesVisible` stay session-owned.
- Durable testing posture:
  - passed: `bunx vitest run src/test/explorerChromeLayouts.test.ts src/test/explorerTheme.test.ts src/test/settingsStore.test.ts src/test/fileExplorer.viewModes.test.tsx src/test/ExplorerWorkspace.test.tsx`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx -t "pilot light baseline|separate dock theme override"`
  - repo note: the full `src/test/settingsPage.behavior.test.tsx` file still contains an unrelated cloud-provider timeout outside the explorer/theme-selection path and was not treated as a regression from this pass.

## 2026-04-15 — Explorer To Filesystem Aquarium Handoff

- Explorer can now hand a folder or file context directly into the `filesystem-aquarium` plugin instead of making the user paste a path manually.
- Durable implementation shape:
  - `src/runtime/filesystemAquariumBridge.ts` is the shared handoff contract. It normalizes the requested path, persists the latest request in local storage, and broadcasts a window event so the plugin can react immediately if it is already mounted.
  - `src/App.tsx` owns panel activation for the handoff. Opening Aquarium from Explorer now ensures the `filesystem-aquarium` panel is visible, active, and undismissed before showing the shell if needed.
  - `src/panels/panelRegistry.tsx`, `src/components/explorer/ExplorerWorkspace.tsx`, and `src/components/FileExplorer.tsx` now route the `onOpenInFilesystemAquarium()` intent through the explorer surface.
  - Explorer exposes the handoff from three user-facing entry points:
    - file or folder context menu
    - empty-space folder context menu
    - current-location toolbar chip
  - The shipped `plugins/filesystem-aquarium/dist/index.tsx` runtime reads the persisted request on mount and listens for the handoff event, so the panel can retarget to the requested habitat without a refresh.
- Validation:
  - passed: `bunx vitest run src/test/filesystemAquariumBridge.test.ts src/test/ExplorerWorkspace.test.tsx src/test/panelRegistry.test.tsx`
  - passed: `bunx tsc --noEmit --skipLibCheck 2>&1 | rg "filesystemAquariumBridge|handleOpenInFilesystemAquarium|OpenInFilesystemAquarium|panelDefinitions|FILESYSTEM_AQUARIUM_PANEL_ID|src/test/fileExplorer.viewModes.test.tsx\\(287|src/test/fileExplorer.viewModes.test.tsx\\(308"`
    - interpretation: no output means the new Aquarium-specific symbols are no longer surfacing targeted TS errors in the noisy workspace typecheck.
  - passed: `cmp -s plugins/filesystem-aquarium/dist/index.tsx src-tauri/plugins/filesystem-aquarium/dist/index.tsx && echo mirrored`
  - repo note: the broad `src/test/fileExplorer.viewModes.test.tsx` suite still has pre-existing failures unrelated to the Aquarium handoff and is not a reliable green gate yet.

## 2026-04-15 — Screenshot Native Export / Capture Isolation / Editor Controls

- Moved annotated screenshot export out of the browser canvas path and into `src-tauri/src/screenshot_commands.rs`.
- Durable reason:
  annotated save/copy had been compositing against the preview-sized data URL inside `ScreenshotsManager`, which meant any annotated output was silently capped to preview resolution instead of the full cached capture.
- New native screenshot contract:
  - `screenshot_export_annotated` now accepts typed annotation payloads plus an optional crop region
  - Rust composites annotations directly onto the cached full-resolution `RgbaImage`
  - annotated save/copy now uses the same native image/clipboard path as the plain capture workflow
- Cross-platform capture isolation improved:
  - Windows still uses `WDA_EXCLUDEFROMCAPTURE`
  - non-Windows capture preview now temporarily hides/restores the app window around monitor capture instead of doing nothing
- `src/components/ScreenshotsManager.tsx` no longer writes annotated files or clipboard images through browser APIs.
- The screenshot editor now has a real selection interaction model:
  - drag inside the selection moves it
  - drag handles resize it
  - arrow keys nudge it
  - `Alt` + arrows resize it
  - `Ctrl/Cmd + A` selects the full preview
- Added focused proof:
  - `src/test/screenshotsManager.test.tsx` now covers native annotated export, keyboard move/resize, and pointer-handle resize behavior
  - `src/test/screenshotsUtils.test.ts` now covers resize-handle hit detection
  - Rust tests now cover annotated rectangle rendering and crop-region behavior
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml screenshot_commands`
  - passed: `bunx vitest run src/test/screenshotsManager.test.tsx src/test/screenshotsUtils.test.ts`
  - passed: `bun run build`
  - live smoke: `timeout 75s bun run tauri dev` reached Vite-ready state and launched `target/debug/greeble`; verified the native process was running with `ps -eo pid,cmd | rg 'target/debug/greeble|greeble$'`
- Remaining risk:
  the live Tauri smoke proved the desktop runtime boots with the new screenshot path, but it did not yet click through a fully automated real capture session inside the desktop window. A future proof harness should drive the screenshot panel in the running Tauri app, not only the jsdom/browser-mocked tests.

## 2026-04-15 — Vibe Capsule Flagship Plugin Pass

- Added a new built-in package plugin under `plugins/vibe-capsule/`:
  - `plugin.json` package manifest
  - `dist/index.tsx` runtime entry
  - `themes/vibe-capsule-shell/theme.json` packaged theme contribution
- `Vibe Capsule` is meant to be a high-signal consumer/creative reference plugin, not a narrow utility panel. It ingests dropped explorer paths or browser-picked files, derives a mood profile from the source material, renders a playable ambient shrine scene, persists archived capsules in plugin storage, and exports a generated shell-skin theme manifest.
- Durable implementation constraints:
  - the plugin runtime now supports package-local relative imports through the shared module-graph loader, but external imports are still limited to the allowlisted host modules (`react`, `lucide-react`, selected Tauri modules, `overlayterm-plugin`)
  - this plugin still stays intentionally lightweight and does not assume bundled `three` or arbitrary npm dependencies
  - explorer-origin drops flow through `application/x-overlayterm-paths`
  - native file access inside plugins currently routes through `api.invoke('fs_list_dir' | 'fs_read_text_file' | 'fs_read_file_base64' | 'fs_open_file' | 'fs_reveal_in_explorer')`
- Added regression coverage:
  - `src/test/pluginRuntime.test.ts` now validates the shipped runtime-entry plugins that actually exist on disk: `drawable-canvas`, `filesystem-aquarium`, and `vibe-capsule`
  - `src/test/vibeCapsule.pluginPackage.test.ts` exercises real on-disk package discovery for `plugins/vibe-capsule`, including its theme contribution
- Updated `.gitignore` to whitelist `plugins/**/dist/**`. Durable reason:
  packaged plugin `dist/` folders are source/runtime entries in this repo, not disposable app-build output. Without the whitelist, built-in package plugins vanish from Git tracking.
- Validation:
  - passed: `bunx vitest run src/test/pluginRuntime.test.ts src/test/vibeCapsule.pluginPackage.test.ts`
  - repo note: `bunx vitest run src/test/pluginPackages.test.ts` still has a pre-existing failing assertion in the unsafe-relative-path warning case and was not part of this plugin pass
- Recommended next step:
  if Aquarium becomes the second flagship plugin, either expose `three` through the plugin runtime allowlist or add a dedicated richer visual host path before pushing it further.

## 2026-04-15 — Renderer-Owned Shell Contract Pass

- Added `src/components/themeRendererShellModel.ts`, which builds a normalized theme-renderer shell model with:
  - grouped launcher metadata
  - utility action metadata
  - viewport metrics
  - clamped shell regions for chrome, launcher, content, and pinned panel sides
- `src/components/themeRendererRuntime.tsx` now supports explicit renderer `surfaceOwnership`, and `App.tsx` now uses that contract to suppress duplicated host surfaces when a theme renderer owns launcher/chrome/content/wallpaper responsibilities.
- `App.tsx` now also exposes `host.renderUtilityActionsSurface()`, and the bundled renderer catalog no longer relies on raw `host.panels` or `host.renderChromeBar()` for custom launcher shells.
- Corrected an important host-contract bug: `surfaceOwnership` now only suppresses the host's automatic shell placement. It no longer makes `host.renderDefaultNavigationSurface()` or `host.renderPinnedPanels()` return `null`, so hybrid renderers and starter templates can embed default host surfaces inside custom layouts safely.
- `TopBar` now removes launcher-facing chrome when the active renderer owns the launcher surface, which fixes the bundled “double top bar / duplicate launcher strip” failure mode without gutting the shared utility controls.
- `src/config/workbenchRenderRuntime.ts` now carries `navigationRailWidth`, and `WorkbenchNavigationSurface.tsx` consumes that runtime-owned sizing instead of hardcoded width branches.
- Migrated the starter renderer plus bundled custom shells to the new ownership model:
  - fully custom launcher shells now declare `launcher`, `chrome`, `contentFrame`, and `wallpaper`
  - hybrid shells like `arcade-arcology` keep the default launcher surface but still declare custom chrome/content ownership
- Durable reason:
  the old renderer contract let themes render their own launcher while still inheriting launcher/menu/tab chrome from `host.renderChromeBar()`, which caused duplicate bars, duplicate launcher affordances, and layout drift across the theme catalog.
- Validation:
  - passed: `npx vitest run --environment node src/test/themeRendererRuntime.test.tsx src/test/themeRendererShellModel.test.ts src/test/workbenchRenderRuntime.test.ts src/test/themeRendererPackages.test.ts`
  - passed: targeted TS transpile syntax check for `App.tsx`, the renderer runtime/shell model files, and the touched bundled renderers
  - blocked by pre-existing workspace type errors in `FileExplorer.tsx`, `GitManager.tsx`, `performanceTelemetry.ts`, and `explorerStore.ts`
- Recommended next step:
  migrate the remaining bundled renderers from raw `host.panels` iteration toward `host.shellModel.launcher` / normalized regions, then push the same structural-contract treatment deeper into explorer-local chrome and dialogs.

## 2026-04-15 — Vector Monolith Explorer Depth Pass

- `themes/vector-monolith/renderers/monolith/components/surface-stage.tsx` no longer places the live host panel DOM inside the rotated decorative stage mesh. Durable reason:
  explorer chrome menus and the explorer context menu depend on normal absolute/fixed positioning, and a transformed or overflow-clipped ancestor was making those surfaces appear empty or misplaced.
- The stage now splits into:
  - a transformed decorative Three.js-style chassis and holographic frame
  - a flat interactive plane above it that keeps `host.renderPanelSurface()` alive with `overflow: visible`
- `src/components/FileExplorer.tsx` now exposes stable `data-overlay-explorer-*` hooks for root mode and major planes like `rail`, `toolbar`, `file-area`, `content-viewport`, `preview`, and `status`.
- `themes/vector-monolith/renderers/monolith/components/scoped-styles.tsx` uses those hooks to push the live explorer DOM into a layered 3D cockpit treatment without taking ownership of explorer truth or breaking its menus.
- Durable lesson:
  renderer-owned 3D shells should not rotate or clip the actual interactive host surface if that surface contains fixed or absolute menus, drag affordances, or other UI that depends on normal DOM positioning. Keep the depth in sibling chrome and scoped descendant styling instead.

## 2026-04-15 — Theme Catalog / Renderer Stability Pass

- `src/components/SettingsPage.tsx` now keys theme catalog cards with source-aware composite keys instead of raw `theme.id`, so package/custom themes that intentionally share an id no longer spam React duplicate-key warnings in Settings.
- `src/config/themePackages.ts` now inlines packaged SVG preview and wallpaper assets through `fsReadFileBase64()` before handing them to the frontend. Durable reason:
  Tauri/WebKit was intermittently failing to display packaged SVG theme assets when they stayed on filesystem-backed URLs, which showed up as repeated `Failed to load resource` errors for theme wallpapers/previews.
- `themes/celestial-astrolabe/renderers/astrolabe.tsx` and `themes/cyber-nexus-hud/renderers/cyber-nexus.tsx` no longer animate via React state on every frame. They now use CSS keyframes for decorative motion so mounted heavy panels like `FileExplorer` are not forced through renderer-driven rerender loops.
- Added regression coverage for the touched runtime surface by extending `src/test/themeRendererPackages.test.ts` to load the Astrolabe and Cyber Nexus theme renderers, and kept `src/test/themePackages.test.ts` green with SVG asset inlining expectations.
- Validation:
  - passed: `bunx vitest run src/test/themePackages.test.ts src/test/themeRendererPackages.test.ts`
  - blocked by pre-existing workspace/typecheck issues: narrowed `bunx tsc --noEmit --skipLibCheck ...` still fails in unrelated `FileExplorer`, `GitManager`, `performanceTelemetry`, `explorerStore`, plus the runtime-only `overlayterm-theme-renderer` alias not being visible to plain `tsc`

## 2026-04-15 — File Explorer Async Navigation Guard

- `src/components/FileExplorer.tsx` now invalidates in-flight directory/search work on unmount and on newer directory-load requests.
- Durable reason:
  overlay-mode panel swaps and `React.StrictMode` remounts were letting stale boot/navigation completions call back into an explorer instance that had already been replaced, which could surface the `getRootForUpdatedFiber` runtime error and briefly repaint the wrong listing.
- `navigate()`, `refresh()`, the boot drive/path effect, and `runSearch()` now all check mount/request ownership before applying async results.
- Added focused regression coverage in `src/test/fileExplorer.viewModes.test.tsx` for a stale directory response arriving after a newer `showHiddenFiles` refresh.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "ignores stale directory responses after a newer refresh updates the explorer state"`
  - blocked by pre-existing workspace errors: narrowed `bunx tsc --noEmit --skipLibCheck ... src/components/FileExplorer.tsx src/test/fileExplorer.viewModes.test.tsx`

## 2026-04-15 — Overlay Render Ordering Crash Fix

- Reproduced the first-render crash in headless Chromium against `localhost:1420` and traced it to hook-order and TDZ bugs in the monolithic overlay shell.
- Fixed several render-time ordering failures:
  - `src/App.tsx` now declares the overlay auto-open effect after the memoized `openPanelIds` state it reads.
  - `src/components/FileExplorer.tsx` now declares `selectedEntries` before `selectedSizeSummary`, keeps the preview-close effects below `closePreview`, and wires `pollDuplicateScan` into the explorer backend destructure.
- The fixed-port `localhost:1420` dev server can look cross-wired if an old tab or another repo is still pointed at the same port. Verify the active client/server pair before assuming one repo imported another repo.
- Browser-only Tauri API errors are a separate issue from the Tauri webview runtime. They can appear when loading the Vite server directly in Chromium, so use the desktop runtime for real validation.

## 2026-04-15 — Dev HUD Always-On Pass

- Added `src/components/DevPerformanceHud.tsx` and mounted it from `App.tsx` so local development now always shows a fixed telemetry HUD without needing a separate plugin or settings hop.
- The HUD reuses the existing overlay frame sampler and adds browser-side navigation, long-task, CLS, INP, and memory reads so dev mode has a visible diagnostics surface instead of a hidden storage-only path.
- `import.meta.env.DEV` now forces the HUD on in local development; the existing `systemSettings.developerMode` toggle still gates the heavier live-reload/watch paths.
- Validation passed with `bunx vite build` and `bunx vitest run src/test/frameTelemetry.test.ts`.
- `bunx vitest run src/test/performanceTelemetry.test.ts` still has a pre-existing failure in the `git_repo_state_load` assertion and was not changed by this pass.

## 2026-04-14 — Terminal Handoff Validation Pass

- Explorer-to-terminal now uses the shared shell-aware `buildTerminalCdCommand` helper, which keeps PowerShell, cmd, and POSIX-style shells on the right `cd` syntax path.
- Focused test coverage passed for the helper itself, but the broader terminal overlay test is currently blocked here by a local `react/jsx-dev-runtime` module resolution issue.
- Next pass should either repair the local test environment or extend the terminal handoff coverage deeper once the UI runtime can start cleanly.

## 2026-04-14 — Taskbar Sync Native Pass

- `windowApplyMode` now drives taskbar visibility through the native platform helper, so macOS Dock state follows the same presentation policy as Linux/Windows skip-taskbar handling.
- `App.tsx` now syncs `windowSetTaskbarVisibility()` when the persisted `showInTaskbar` setting changes, so taskbar state updates immediately instead of waiting for the next mode transition.
- Validation here is still blocked by the mingw linker missing `-lgcc_eh` / `-lgcc`, and Vitest still fails to resolve `vitest/config` plus `@vitejs/plugin-react` in this workspace.

## 2026-04-14 — Explorer Workspace Split Controls Pass

- `ExplorerWorkspace` now shows a compact split indicator plus nudge/reset controls in dual-pane mode, so pane sizing is no longer dependent on the drag handle alone.
- This makes the two-pane layout faster to rebalance after opening a temporary tab or preview-heavy pane, which is a small but real dual-pane ergonomics win.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Clipboard Shared Across Panes

- Moved the explorer clipboard from `FileExplorer` local state into `src/store/explorerStore.ts`, so copy/cut/paste now survives switching panes and multiple explorer instances inside the same workspace.
- The clipboard payload is now normalized into a small shared snapshot (`path`, `name`, `is_dir`) instead of holding raw React entry objects.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-14 — Explorer Selected Size Pass

- The explorer toolbar now shows a compact size summary for selected items when size data is available.
- This gives the analyzer surface a more premium, action-oriented feel by answering the obvious follow-up question, "how much space is this selection taking?"
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Explorer Size Summary Pass

- The explorer toolbar now shows a compact size summary for the currently visible entries, using the already-cached entry size data.
- This is the first small step toward a premium storage-analyzer style surface, because it turns raw rows into an at-a-glance space readout.
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Explorer Bookmarks Strip Pass

- The explorer toolbar now surfaces a small pinned-locations strip alongside recent locations.
- This makes the navigation chrome feel more like a premium power-user launcher, because users can jump straight to saved places without hunting.
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Explorer Quick Pin Pass

- The explorer toolbar now exposes a quick `Pin` action for the current location.
- This turns the recent-locations strip into a stronger premium navigation pattern, because users can now keep important places at hand instead of rediscovering them.
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Explorer Recent Locations Pass

- The explorer toolbar now surfaces a small `Recent` strip built from navigation history.
- This gives users a one-click way back to the last few locations, which is a small but very premium-feeling navigation affordance.
- Next passes should keep pushing toward premium capability depth, especially queueing, network mounts, archive handling, compare/analyzer tools, and advanced automation.

## 2026-04-14 — Premium Feature Parity Focus Shift

- Explorer work is now explicitly aimed at premium feature parity, not just polish passes.
- Highest-value gaps to close next: cloud/network mounts, archive handling, file compare, storage analysis, sync/queue tools, metadata editing, and richer batch operations.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, large-folder performance, and premium capability depth.

## 2026-04-14 — Explorer Workspace Empty Pane Copy Pass

- The empty dual-pane placeholder now says `Open Explorer Here`, which makes the first action a little more obvious.
- This is a tiny clarity win, but it helps the split view feel less vague when one side is empty.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-14 — Explorer Workspace Focus Wash Pass

- The focused pane header now gets a slightly stronger accent-tinted background, which makes the active side pop faster in dual-pane mode.
- This is a small but constant readability win when both panes are busy.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-14 — Explorer Workspace Move Hint Pass

- The dual-pane chrome now reminds users they can move tabs with either the chip arrow or the dedicated Move button.
- This is a small guidance cue, but it helps the new dual-pane controls feel discoverable instead of hidden.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-14 — Explorer Workspace Active Tab Pass

- Active tabs in `ExplorerWorkspace` now show an explicit `Active` badge inside the chip, so the current tab is easier to spot in dense tab strips.
- This is a tiny but useful orientation cue for dual-pane work when multiple tabs are open on both sides.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Focus Cue Pass

- The active pane header now shows a small `Focused` badge, so the current work side is easier to spot instantly.
- This keeps dual-pane navigation from feeling ambiguous when both sides are full of tabs.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Tab Side Pass

- Tab chips in `ExplorerWorkspace` now carry an explicit `L` or `R` marker, so it’s easier to see which pane each tab belongs to.
- This complements the pane headers and action buttons, tightening the mental model for dual-pane work.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Pane Identity Pass

- Each dual-pane view now shows a small pane header with its side label and current path, which makes the split feel anchored and easier to scan.
- This pairs with the explicit pane action buttons and helps users keep a mental map of where they are working.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Pane Action Pass

- Added explicit left/right focus and move controls in the `ExplorerWorkspace` toolbar, so dual-pane tab movement is more discoverable.
- This reduces the “where do I send this tab?” moment and makes the workspace feel more like a real two-pane workbench.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Preview Trust Pass

- The preview header now shows whether a text preview is saved, dirty, or currently saving.
- This makes the inline editor feel less ambiguous when you’re actively changing files in the explorer.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Responsiveness Pass

- Reduced frontend pressure in `src/components/FileExplorer.tsx` by trimming the background viewport enrichment batches.
- File size measurement batches now top out lower, and native icon fetch bursts are smaller, which should help the explorer feel less busy on large folders.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Filter Count Clarity Pass

- The explorer footer now shows filtered-vs-source counts, so large folders and tagged searches are easier to reason about.
- When tag filters hide part of the result set, the footer now says how many items are hidden, which should reduce the “where did my files go?” moment.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — Explorer Workspace Pane Clarity Pass

- Added explicit left/right pane badges and active-pane text to the `ExplorerWorkspace` chrome, so dual-pane mode is easier to read at a glance.
- The explorer workspace header now tells you how many tabs live in each pane and which side has focus, which should reduce confusion when moving tabs between panes.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Preview Clarity Pass

- The explorer footer now names the active preview type when preview is open, instead of only showing preview on/off.
- Text previews, image previews, and 3D previews now surface their mode alongside the current file name, which makes inline preview state easier to trust at a glance.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Search Clarity Pass

- Tightened the explorer footer search affordance in `src/components/FileExplorer.tsx` so active searches now show result counts and loading state inline.
- The empty search state now explains whether recursive text search or names-only search is active, which should reduce confusion when results are sparse.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Tag Filter Clarity Pass

- Added a compact active-filter summary to `src/components/explorer/ExplorerSideRail.tsx`, so tag filters are easier to notice and clear at a glance.
- The side rail now surfaces the number of active tag filters before the tag chips themselves, which should make search/filter state feel less hidden.
- Next passes should keep pushing toward dual-pane ergonomics, search/filter polish, and large-folder performance.

## 2026-04-13 — File Explorer Heartbeat Plan

- Current explorer posture: `ExplorerWorkspace` owns tabs and panes, while `FileExplorer` remains the main work surface for navigation, preview, drag/drop, search, experimental modes, explorer-pro, and toolbar/rail controls.
- Shipping loop: run focused 20-minute passes, aiming for one meaningful explorer improvement per pass.
- Keep `AGENTS.md` and this file current as priorities shift, especially around monetizable polish, speed, and ergonomics.
- Near-term value targets: cross-pane clipboard flow, sharper search/filtering, preview ergonomics, smoother large-directory performance, and more obvious power-user affordances.

## 2026-04-10 — Explorer Pro Basics Tranche 1 Substrate

- Landed the first explorer-local workspace pass instead of extending the global workbench tab system:
  - new `src/components/explorer/ExplorerWorkspace.tsx` now owns explorer-local tabs, single/dual-pane layout, active pane focus, and persisted split ratio
  - `src/panels/panelRegistry.tsx` now mounts the explorer through `ExplorerWorkspace`, while each pane/tab still renders the existing `FileExplorer` with a distinct `instanceId`
  - `src/store/explorerStore.ts` now persists a workspace snapshot alongside named explorer sessions, including tabs, pane activity, layout mode, focus, and split ratio
- Added Rust-backed Explorer Pro commands in `src-tauri/src/explorer_pro_commands.rs` and exported them through Specta:
  - local app-managed trash with undoable recent action journal
  - batch rename validation/execution
  - progressive duplicate scan start/poll/cancel
  - app-data explorer metadata for tags and saved searches
- `src/runtime/explorerBackend.ts` now exposes the new explorer-pro command surface to the frontend instead of forcing ad hoc Tauri calls from components.
- `src/components/FileExplorer.tsx` picked up the first end-user integrations:
  - trash-by-default confirm flow with explicit permanent delete fallback
  - undo trash toolbar action
  - batch rename dialog with TS-side preview and Rust execution
  - duplicate finder dialog backed by the progressive scan commands
  - saved-search save/apply/delete flow
  - manual tags plus tag-filtered visible entries
  - explorer side rail now has saved-search and tag filter sections
- Durable implementation choices:
  - trash is currently app-managed under Tauri app data rather than OS-native trash because reliable cross-platform undo needs full control over restore locations
  - tags and saved searches are Rust-owned metadata, not project manifests or file xattrs
  - duplicate scanning is rooted at the current local folder tree and intentionally excludes cloud paths in v1
- Focused validation that passed:
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - `bunx vitest run src/test/explorerStore.test.ts`
  - `cargo test --manifest-path src-tauri/Cargo.toml explorer_pro_commands`
- Follow-up still recommended:
  - move explorer clipboard state out of `FileExplorer` local state so copy/cut/paste works seamlessly across dual panes
  - break more explorer-pro dialogs and metadata surfaces out of the monolithic `FileExplorer.tsx` once behavior stabilizes
  - add targeted UI tests around saved-search/tag rail sections and duplicate-finder actions when the current test environment is less noisy

## 2026-04-10 — Explorer Controls Returned To The Omnibox Row

- Moved explorer-only shell controls out of the shared top bar and back into the explorer chrome:
  - `src/App.tsx` now hosts the explorer with `explorerChromeControlSurface: 'toolbar'`
  - the shared `TopBar` no longer renders `Sources`, `Search`, Labs mode, shell layout, view mode, or preview controls
- `src/components/FileExplorer.tsx` now keeps the full explorer control cluster beside the path/search field in the local toolbar:
  - added `Sources` and `Search` buttons to the existing omnibox control row
  - retained the existing Labs, shell layout, view mode, and preview controls in that same row
- Removed the now-dead App/panel-registry wiring that only existed to push explorer toolbar actions through the top bar.
- Durable rationale:
  - the shared top bar should stay panel-agnostic and preserve horizontal space for global shell controls
  - explorer mode/source/preview controls are contextual and belong next to the explorer’s oversized path/search bar, where their impact on navigation is immediate

## 2026-04-10 — First Smoothness Pass For 120 Hz

- Landed a deliberate first pass focused on perceived smoothness rather than visual richness.
- `src/components/FileExplorer.tsx` no longer uses Framer Motion in the explorer hot path:
  - icon-size changes now use CSS transitions
  - experimental layout sections now render without JS-driven layout animation
  - the new-item grid placeholder no longer animates through Framer Motion
- The global blur toggle is now honored across the major shell surfaces:
  - explorer preview / toolbar / status / zoom HUD / experimental HUD
  - top bar and top bar menus
  - command palette scrim and body
  - settings shell
  - terminal shell
- `src/config/performanceTelemetry.ts` now records `overlay_frame_time` against an `8.3ms` p95 target so the stored frame budget matches a 120 Hz goal.
- Narrow validation passed with:
  - `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports src/vite-env.d.ts src/App.tsx src/components/FileExplorer.tsx src/components/CommandPalette.tsx src/components/SettingsPage.tsx src/components/TerminalOverlay.tsx src/config/performanceTelemetry.ts`
- Recommended next step:
  - profile release-mode wallpaper/shader/animation layer stacking and any remaining scroll-selection hotspots after testing with blur disabled

## 2026-04-10 — Screenshot Task Isolation + Managed Notes Root

- Fixed the screenshot panel status-bar bleed-through in `src/components/ScreenshotsManager.tsx`:
  - removed the `explorerTaskStore` subscription from the screenshot UI
  - durable reason: the explorer/Yazi task feed is global, so screenshot capture errors were surfacing unrelated delete jobs like stale note-file cleanup and making the screenshot tool look like it was deleting arbitrary files
- Fixed cross-platform path joining for screenshot annotated saves:
  - annotated saves now use `joinPlatformPath()` instead of forcing `\\`
  - this keeps Linux/macOS from writing odd backslash-bearing filenames when the screenshot library path is repo-relative or app-data-relative
- Moved notes storage off the old hardcoded Windows root in `src/components/NotesManager.tsx`:
  - new `src/config/notes.ts` resolves notes through `getManagedContentDirectory('notes')`
  - `src/config/appContentDirectories.ts` now treats `notes` as a first-class managed content root in both dev and release/runtime modes
  - note category/file paths now use platform-aware joining instead of manual `\\` concatenation
- This change addresses the bug that was creating literal filenames like `M:\\Assets\\OverlayTerm\\notes\\...md` inside the Linux workspace and then exposing those paths through unrelated explorer delete-task UI.
- Added focused regression coverage in:
  - `src/test/screenshotsManager.test.tsx`
  - `src/test/notesConfig.test.ts`
- Validation that passed:
  - `bunx vitest run src/test/screenshotsManager.test.tsx src/test/notesConfig.test.ts`
  - `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types node,vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/components/ScreenshotsManager.tsx src/components/NotesManager.tsx src/config/appContentDirectories.ts src/config/notes.ts src/test/screenshotsManager.test.tsx src/test/notesConfig.test.ts`
- Follow-up cleanup still recommended:
  - remove any already-created stray bug artifacts such as repo-local filenames that literally include `M:\\Assets\\OverlayTerm\\...` once the user confirms they are disposable

## 2026-04-09 — Explorer Rail + Drag UX Pass

- Reworked explorer drag behavior so file drag-out is no longer hidden behind `Alt`:
  - `src/components/FileExplorer.tsx` now defaults explorer drags to the native drag bridge and only forces an internal-only drag when `Shift` is held
  - explorer entries still publish the internal `application/x-overlayterm-paths` payload, so in-explorer drops keep their custom move/copy path available
  - explorer drag sources now tag themselves with `data-overlay-drag-intent` during drag start so the shell can distinguish native-export drags from internal explorer drags
- `src/App.tsx` no longer hides the entire overlay for ordinary explorer file drags unless a drag source explicitly opts into overlay-hide behavior.
  - durable reason: the old blanket hide-on-drag made “drag a file out” and “drag a file into another explorer folder” share the same shell teardown path, which made the whole interaction feel broken and fragile
- `src/components/explorer/ExplorerSideRail.tsx` was simplified into a navigator-first rail:
  - the header now foregrounds the current location and bookmark count
  - bookmark organization controls moved behind a deliberate `Manage` mode instead of always occupying the rail chrome
  - bookmark row controls for nested-folder creation, rename, recolor, and delete are hidden unless `Manage` is active
  - bookmark search remains always-on, but category chips and creation controls only surface when managing or when active filters are in play
  - the duplicate `Home` row inside the bookmark tree was removed to reduce visual repetition
- Explorer rail defaults were tightened:
  - `src/config/explorerRail.ts` now uses slimmer full/compact width bounds
  - `src/components/FileExplorer.tsx` now seeds the initial rail width from `getExplorerRailWidthBounds()` instead of the broader theme metric
- Added targeted regression updates in:
  - `src/test/fileExplorer.viewModes.test.tsx`
  - `src/test/explorerSideRail.test.tsx`
- Validation for this pass:
  - passed: narrowed `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types node,vitest/globals,@testing-library/jest-dom src/vite-env.d.ts src/App.tsx src/components/FileExplorer.tsx src/components/explorer/ExplorerSideRail.tsx src/config/explorerRail.ts src/store/explorerStore.ts src/test/explorerSideRail.test.tsx src/test/fileExplorer.viewModes.test.tsx`
  - blocked: Vitest/JSDOM coverage is still failing in this workspace because of the existing `html-encoding-sniffer` -> `@exodus/bytes` CommonJS/ESM incompatibility

## 2026-04-09 — Explorer UI Responsiveness Pass

- Reduced frontend jank in `src/components/FileExplorer.tsx` by moving large explorer result adoption onto React transitions:
  - directory loads now `startTransition()` the bulk `entries` update
  - search responses now `startTransition()` the `searchResults` update
  - background native-icon and entry-size maps now update through transitions instead of competing with active input/scroll work
- Added short viewport-settle delays before launching background enrichment work for visible entries:
  - entry-size batches wait `72ms`
  - native-icon batches wait `96ms`
- The settle-delay avoids firing repeated `fs_measure_entry_sizes` / `fs_resolve_native_icons` batches while the user is still scrolling the virtualized viewport, which reduces Tauri IPC churn and unnecessary rerender pressure during fast navigation.
- Exported `invalidateExplorerResultCaches()` from `src/components/FileExplorer.tsx` so tests and support tooling can explicitly clear the shared explorer directory/search caches when they need isolated backend state.
- Updated `src/test/fileExplorer.searchTelemetry.test.tsx` to clear the shared explorer caches in `beforeEach`, which keeps the diagnostics assertions honest now that cache reuse is an intentional cross-mount behavior.
- Validation completed for this pass:
  - `bun run test:browser`
  - `npx vitest run src/test/fileExplorer.searchTelemetry.test.tsx --reporter verbose`
  - `bun run build`
- Validation still blocked by pre-existing workspace issues:
  - `bun run test:unit` still does not complete cleanly within a 45s timeout and reports unrelated failures in `terminalOverlay`, `app.dockMode`, `pluginRuntime`, and `animationRuntime`
  - JSDOM still logs repeated `HTMLCanvasElement.getContext()` not-implemented warnings in this workspace without the optional `canvas` package

## 2026-04-09 — Shader Runtime Performance Pass

- Targeted the shell shader path because the sluggishness was coming from the built-in shader surfaces doing React-driven animation every frame.
- `src/components/shaderRuntime.tsx` now keeps the built-in animated shader surfaces off the React RAF path:
  - Nebula and Prism background/top-bar/border surfaces now use injected CSS keyframes instead of `useSyncExternalStore` + React rerenders every frame
  - this removes the shared built-in shader RAF clock entirely
- Canvas-backed shader surfaces still animate, but they are now throttled to roughly 24 FPS through the shared canvas animator instead of drawing every browser frame.
- Canvas shader DPR is now capped at `1.25` instead of `1.5` to reduce fill-rate pressure on large translucent surfaces.
- Validation that passed:
  - narrowed `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types node,vitest/globals,@testing-library/jest-dom ...`
  - `bunx vitest run --environment node src/test/shaderRuntime.test.ts`
- Remaining likely hotspots if the UI still feels slow after this pass:
  - shell-wide `backdrop-filter` blur
  - live wallpapers / video wallpapers
  - large explorer panel renders while shaders, wallpaper, and animation overlays are stacked together

## 2026-04-09 — Linux Local Installer Stale Binary Fix

- Fixed the local Linux install scripts so they no longer copy `src-tauri/target/release/greeble`.
- Root cause: this repo is a Cargo workspace, and `cargo build --manifest-path src-tauri/Cargo.toml --release` writes the fresh binary to the workspace target directory at `target/release/greeble`.
- The stale install symptom was caused by older binaries still sitting under `src-tauri/target/release/greeble`, which made the installed app show an older UI even though `bun run tauri dev` reflected current frontend changes.
- Follow-up root cause: the base `src-tauri/tauri.conf.json` also carried `build.devUrl`, which caused direct release builds to keep trying `http://localhost:1420` and surface the "Could not connect to localhost: Connection refused" startup error.
- `src-tauri/tauri.conf.json` now keeps only release-safe build settings, and `scripts/run-platform-tauri.mjs` injects `devUrl` only when running `tauri dev`.
- `scripts/build-and-install-linux-local-release.sh` now resolves `cargo metadata` `target_directory` with Bun and installs from that real workspace output.
- `scripts/platform/install_linux.sh` now resolves the same `target_directory` with Node before copying the built binary into `~/.local/bin`.
- Verified end-to-end with `bash ./install.sh` and confirmed:
  - `/home/ephemara/Dev/Apps-2D/GreebleFS/target/release/greeble` matches `/home/ephemara/.local/opt/overlayterm/overlayterm`
  - the installed binary no longer matches the stale `/home/ephemara/Dev/Apps-2D/GreebleFS/src-tauri/target/release/greeble`
  - `strace -f -e trace=connect` against the rebuilt installed binary shows no more connection attempts to `127.0.0.1:1420`
  - `timeout 20s bun run tauri dev` still starts Vite on `http://localhost:1420/` and reaches the Tauri dev runner

## 2026-04-09 — Theme Wallpapers + Wallpaper Runtime Layer

- Added a first-class wallpaper runtime so backgrounds are no longer limited to theme CSS gradients.
- Managed content now includes a `wallpapers/` root alongside `themes/`, `shaders/`, and `animations/`.
- New wallpaper runtime files:
  - `src/config/wallpapers.ts`
  - `src/components/wallpaperRuntime.tsx`
- Wallpapers now support:
  - theme-default wallpaper assets via `theme.assets.backgroundUrl`
  - imported image/video wallpapers saved into `wallpapers/`
  - authored live wallpaper modules in `wallpapers/`
- Wallpaper selection is now part of `settings.appearance`:
  - `activeWallpaperId: null` follows the active theme
  - `activeWallpaperId: 'none'` disables the wallpaper layer
  - any other id selects an imported/authored wallpaper override
  - `wallpaperFitMode`, `wallpaperOpacity`, and `wallpaperMuted` now persist too
- `src/App.tsx` render order was intentionally changed so the layers compose instead of replacing each other:
  - wallpaper base layer
  - theme effect layer
  - shader background surface
  - theme visuals
  - shader border surface
  - shell animation overlay
- This specifically preserves the user-requested behavior:
  - wallpapers can remain part of the theme system
  - user wallpaper overrides can still sit under live shader passes
  - wallpaper and shader effects can both be active at the same time
- `src/components/SettingsPage.tsx` now has a dedicated Wallpapers section for:
  - importing media/runtime wallpaper files
  - opening and refreshing the wallpaper folder
  - following the theme wallpaper, disabling the wallpaper layer, or choosing a user override
  - changing wallpaper fit, opacity, and mute state
- `src/panels/panelRegistry.tsx` and the Settings panel prop contract were extended so wallpaper catalog data and actions flow through the normal panel system.
- Durable implementation note:
  - theme packages often used `theme.effects.backgroundImage` as a fallback wallpaper path before this change
  - the runtime now suppresses that fallback only when it duplicates `theme.assets.backgroundUrl`, so explicit theme effect gradients still layer correctly above wallpapers
- Validation that passed:
  - narrowed `bunx tsc --noEmit --skipLibCheck --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --types vitest/globals,@testing-library/jest-dom ...`
  - `bunx vitest run src/test/settingsStore.test.ts src/test/panelRegistry.test.tsx src/test/settingsPage.behavior.test.tsx src/test/settingsPage.shaders.test.tsx src/test/wallpaperRuntime.test.ts`

## 2026-04-09 — Hybrid App Mode / Dock Mode Correction

- Corrected the shell model after the drawer misread:
  - `windowed` is the larger application shell
  - `overlay` is the compact dock shell
  - dock mode is not a separate in-app content drawer
- `src/App.tsx` now drives the explorer directly from `settings.terminal.windowMode` again:
  - `windowed` passes `explorerLayoutMode: 'full'`
  - `overlay` passes `explorerLayoutMode: 'dock'`
  - entering dock mode forces the explorer panel forward so the compact shell behaves like the portable UE-style browser
- Explorer shell controls were lifted back into the command-center top bar:
  - sources visibility
  - focus search
  - experimental mode cycling
  - shell layout cycling
  - view mode cycling
  - preview toggle
- `src/components/FileExplorer.tsx` no longer exposes drawer/dock surface semantics. It now renders as the same explorer surface in either `full` or `dock` mode, and embedded shell-layout/view/preview controls are suppressed when the command center owns them in the top bar.
- Added `settings.system.developerMode` and flipped live watcher behavior to opt-in:
  - plugin directory watching and fallback polling only run when developer mode is enabled
  - authored shader polling only runs when developer mode is enabled
  - authored animation polling only runs when developer mode is enabled
  - explorer entry-size root watching only runs when developer mode is enabled
- Manual refresh is now the default production path:
  - Plugins panel `Refresh`
  - Settings `Refresh Shaders`
  - Settings `Refresh Animations`
- Fixed the `FileExplorer.tsx` update-depth loop in the virtualized batching effects by keeping in-flight entry-size/native-icon sets stable until the async batch resolves instead of clearing/re-adding them every render.
- Removed the incorrect drawer/dock subsystem:
  - deleted `src/components/WorkbenchContentBrowserDock.tsx`
  - removed `contentBrowserDock` from `src/config/layoutProfiles.ts`
  - removed `layout.contentBrowserDockByProfile` from `src/store/settingsStore.ts`
  - removed the old content-browser-specific explorer instance ids from `src/store/explorerStore.ts`
- Restored shell copy and controls back to the actual product language:
  - `App/Dock Mode` in the shell and hotkeys
  - `Application Mode` / `Dock Mode` in settings
- Added focused app coverage in `src/test/app.dockMode.test.tsx` for:
  - full explorer rendering in application mode
  - dock explorer rendering in dock mode
  - foregrounding explorer when switching into dock mode
- Updated supporting tests to match the corrected model:
  - `src/test/layoutProfiles.test.ts`
  - `src/test/settingsPage.behavior.test.tsx`
  - `src/test/explorerStore.test.ts`
- Linux/native overlay positioning improvements remain in place:
  - monitor selection prefers the current or last-active monitor instead of `primaryMonitor()`
  - `computeOverlayWindowLayout()` left-anchors the overlay on X instead of centering it
- Validation that passed:
  - `bunx vite build`
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - `cargo build --manifest-path src-tauri/Cargo.toml --release`
  - narrowed `bunx tsc --noEmit --skipLibCheck ... src/store/settingsStore.ts src/runtime/useFolderPluginRuntime.ts src/components/FileExplorer.tsx src/components/PluginsManager.tsx src/components/SettingsPage.tsx src/App.tsx`
- Added a real local Linux installer entrypoint:
  - root `install.sh`
  - fixed `scripts/build-and-install-linux-local-release.sh`
  - patched `package.json` build/dev icon-sync commands to use Bun instead of Node for the JSON import-attribute script
- Corrected the release/install content-root behavior that was creating top-level home folders like `~/plugins`, `~/themes`, `~/shaders`, `~/animations`, and `~/Screenshots`:
  - added `src/config/appContentDirectories.ts`
  - `tauri dev` still uses repo-relative content folders for in-repo authoring
  - installed/release builds now resolve managed content under Tauri `AppLocalData`
  - `src/main.tsx` now initializes managed content directories before importing `App`
  - screenshot settings imports now migrate away from the old bad default path when loading persisted settings
  - the Linux installer now seeds `plugins`, `themes`, `shaders`, and `animations` into `~/.local/share/co.overlayterm.app`
- Fixed Linux dock-mode geometry regression where the overlay WM could recenter the dock in the middle of the screen after show:
  - added `computeAnchoredOverlayWindowLayout()` in `src/config/overlayWindow.ts`
  - `src/App.tsx` now preserves overlay size but always re-derives dock X/Y from the active monitor edge
  - Linux overlay open now performs a short delayed re-dock pass after `show()` to override WM recentering
  - overlay move/resize listeners now snap overlay mode back to the dock edge instead of persisting floating coordinates
  - added regression coverage in `src/test/overlayWindow.test.ts`
- Hardened the Linux dock path so presentation-only window flag failures do not cancel geometry:
  - `src-tauri/src/window_commands.rs` now logs best-effort failures for `set_decorations`, `set_always_on_top`, `set_shadow`, and `set_skip_taskbar` instead of aborting before `set_size` / `set_position`
  - `src/App.tsx` now unwraps `windowApplyMode()` results so Tauri command errors surface instead of being silently ignored on the TS side
  - this specifically protects `tauri dev` on Linux where some WMs reject transparent/undecorated presentation changes during startup
- Replaced the backend-forcing detour with a targeted Wayland toggle fix:
  - reverted the `src-tauri/src/main.rs` backend override so native Wayland stays enabled
  - added `window_get_linux_display_server()` in `src-tauri/src/window_commands.rs`
  - Wayland overlay reopen now preserves compositor-managed placement by skipping dock geometry reapplication during the hidden overlay open path
  - `src/App.tsx` now marks `isFreefloatingRef.current = true` on real overlay move/resize events so a snapped bottom-edge dock can survive `Ctrl+Space` close/open cycles
- The installer now performs the full build/install flow directly:
  - sync icons
  - regenerate Tauri bindings
  - build frontend
  - build release binary
  - install to `~/.local/opt/overlayterm`
  - update `~/.local/bin/overlayterm`
  - update the desktop entry and icon
- Verified end-to-end with `bash ./install.sh`.
- Validation/workflow blockers still present in the workspace:
  - JSDOM-backed `vitest` runs are still blocked by the existing `html-encoding-sniffer` / `@exodus/bytes` ESM worker failure
  - `bun run release:linux:install*` currently fails on Node 18 because `scripts/sync-canonical-icons.mjs` uses JSON import attributes; use the direct Bun/Cargo build path until Node is upgraded
- Release binary was rebuilt and reinstalled manually to:
  - `/home/ephemara/.local/opt/overlayterm/overlayterm`
  - symlink `/home/ephemara/.local/bin/overlayterm`
  - desktop entry `/home/ephemara/.local/share/applications/co.overlayterm.app.desktop`

## 2026-04-09 — Explorer Experimental Layouts Completed

- Finished the two previously stubbed explorer experimental modes in `src/components/FileExplorer.tsx`:
  - `constellation`
  - `timeline-surface`
- `src/config/explorerExperimentalModes.ts` now treats all three experimental layouts as shipped and adds mode-specific density descriptors so the same persisted `experimentalDensity` value can mean:
  - semantic density for `adaptive-semantic-grid`
  - link density for `constellation`
  - timeline granularity for `timeline-surface`
- `FileExplorer.tsx` now uses one shared experimental control plane across all modes:
  - the toolbar Labs button shows the active mode glyph and density percentage
  - the HUD reflects the active mode’s density descriptor instead of assuming adaptive-only labels
  - Ctrl/Cmd + wheel and the layout toggle hotkey step density for any active experimental mode, not just the adaptive grid
  - compact dock and active search still force the existing fallback to the normal explorer
- `constellation` reuses the semantic grouping system from the adaptive grid and renders those bands as orbital cluster fields with direct entry interaction.
- `timeline-surface` renders entries into time-banded surfaces whose bucket granularity changes with the same persisted density setting.
- Added/updated focused coverage in:
  - `src/test/explorerExperimentalModes.test.ts`
  - `src/test/fileExplorer.viewModes.test.tsx`
- Validation that passed for this change:
  - narrowed `tsc --noEmit` over `src/config/explorerExperimentalModes.ts`, `src/components/FileExplorer.tsx`, and the touched tests
- Validation that is still blocked by workspace issues:
  - `vitest run` remains blocked by the existing `html-encoding-sniffer` / `@exodus/bytes` JSDOM worker failure recorded in `ARCHITECTURE.md`

## 2026-04-09 — Explorer Shell Layout Presets + Real Preview Toggle

- Added `src/config/explorerShellLayouts.ts` as a data-driven explorer shell layout layer separate from theme recipes.
- Explorer shell layout presets now include:
  - `balanced`
  - `navigator`
  - `focus`
  - `inspector`
- These presets are session-persisted through `src/store/explorerStore.ts` via `session.shellLayoutId`.
- Explorer inline preview now has a real persisted enable/disable flag through `session.previewEnabled`.
- `src/components/FileExplorer.tsx` now treats the preview toggle as authoritative:
  - single-click no longer auto-previews files when preview is off
  - `openEntry()` no longer routes text/image/model files into the inline preview when preview is off
  - turning preview off closes the current preview and keeps the side pane hidden
- The shell layout presets currently change explorer structure without needing a theme swap:
  - `focus` hides the side rail
  - `inspector` moves the preview pane to the leading edge and enlarges it
  - `navigator` emphasizes the rail and de-emphasizes preview width
- Added focused coverage in:
  - `src/test/fileExplorer.viewModes.test.tsx`
  - `src/test/explorerStore.test.ts`
- Validation that passed for this change:
  - `npx vitest run src/test/explorerStore.test.ts src/test/fileExplorer.viewModes.test.tsx`
  - narrow `tsc --noEmit` over the touched explorer files

## 2026-04-08 — Workbench + Explorer Theme Recipe System

- Added a first-class app-wide theming layer under `theme.workbench`.
- Added a first-class explorer theming layer under `theme.explorer`.
- New resolvers live in:
  - `src/config/workbenchTheme.ts`
  - `src/config/explorerTheme.ts`
- Added `src/config/themeEngineBindings.ts` so workbench/explorer recipe resolution can bind to generalized theme-engine descriptors instead of only hardcoded archetypes.
- The workbench recipe supports optional recipe seeds (`workbench`, `xmb`, `channel-grid`), explicit `layoutPrimitiveId` / `navigationPatternId` / `renderStyleId` bindings, plus overrides for top bar chrome, command palette chrome, terminal shell chrome, settings shell chrome, tabs, metrics, surfaces, typography, and raw workbench CSS vars.
- The explorer recipe supports optional recipe seeds (`workbench`, `xmb`, `channel-grid`), explicit `layoutPrimitiveId` / `navigationPatternId` / `renderStyleId` bindings, plus overrides for chrome, preview, status bar, breadcrumb style, rail position, view-mode preference, metrics, surfaces, typography, and raw explorer-only CSS vars.
- `src/config/appearance.ts` now preserves compiled engine manifests on themes and compiles raw engine manifests when present, so built-ins, custom imports, and package themes can all feed the same live recipe path.
- Theme packages now carry `engineManifest` and `compiledEngineManifest` directly on their resolved `theme` object, which lets the active workbench/explorer recipes derive defaults from generic layout/navigation/render descriptors.
- `src/components/FileExplorer.tsx` now consumes the resolved explorer recipe and uses it to drive:
  - root/toolbar/preview/status chrome
  - rail placement
  - grid/list/table/adaptive metric scaling
  - entry hover/selection/drop behavior
  - more themeable input/dialog surfaces
- `src/components/explorer/ExplorerSideRail.tsx` now reads the explorer recipe branding/chrome variables instead of assuming a fixed workbench identity.
- `src/App.tsx`, `src/components/CommandPalette.tsx`, `src/components/TerminalOverlay.tsx`, and `src/components/SettingsPage.tsx` now consume the workbench recipe so theme packages can reshape the whole command center, not just the explorer.
- Added sample theme packages:
  - `themes/xmb-crosswave/theme.json`
  - `themes/wii-channel-home/theme.json`
- Added focused tests for the new recipe path:
  - `src/test/workbenchTheme.test.ts`
  - `src/test/explorerTheme.test.ts`
  - `src/test/themePackageExplorerRecipe.test.ts`

## 2026-04-08 — Live Render Runtime Layer

- Added `src/config/workbenchRenderRuntime.ts` so render styles now resolve into an actual shell interaction runtime instead of staying metadata-only.
- The runtime currently supports four interaction models:
  - `workbench-tabs`
  - `cross-axis-media`
  - `channel-launcher`
  - `desktop-stack`
- `src/components/WorkbenchNavigationSurface.tsx` now renders a runtime-specific launcher rail for cross-axis, channel-grid, and desktop-style shells.
- `src/App.tsx` now delegates shell navigation/content structure to the resolved runtime:
  - tabbed workbench keeps the old chrome tab strip
  - cross-axis themes get grouped launcher navigation
  - iOS / Wii style themes get larger grouped launcher tiles
  - desktop-style themes get dock/list navigation with card-style panel presentation
- `src/panels/panelRegistry.tsx` now attaches navigation metadata to panels so runtimes can regroup panels by domain without app-wide ad hoc switch statements.
- This keeps the system generalized: themes define `renderStyles`, `navigationPatterns`, `layoutPrimitives`, and `presentation`, and the app picks a runtime from those descriptors rather than from hardcoded theme names.

## Validation Notes

- Narrowed workbench/explorer typecheck passed except for the existing unrelated `src/runtime/useFolderPluginRuntime.ts` failure recorded in `ARCHITECTURE.md`.
- Pure Node Vitest coverage for the new recipe path passed.
- JSDOM-based explorer tests could not be executed in this environment because of the existing `html-encoding-sniffer` / `@exodus/bytes` ESM worker failure.

## Recommended Next Step

- Fix the workspace JSDOM/Vitest worker issue so the DOM-level explorer tests can run again, then add browser/RTL coverage that asserts:
  - workbench recipe chrome changes on the top bar, command palette, and settings shell
  - rail-right layouts
  - floating/glass preview shells
  - status-bar hidden/floating modes
  - theme-preferred initial explorer layout selection

## 2026-04-09 — Theme Pack Expansion

- Added ten new package themes under `themes/` so the theme picker has a broader range of shell personalities without requiring any app-code changes:
  - `windows-95-classic`
  - `windows-xp-luna`
  - `vista-aero-glass`
  - `amber-cathode`
  - `dos-navigator`
  - `palm-organizer`
  - `gamecube-orbital`
  - `dreamcast-skyline`
  - `synthwave-highway`
  - `midnight-noir`
- The new set intentionally spans multiple runtime families instead of only palette swaps:
  - desktop-window-manager shells for the Windows-inspired themes
  - launcher-grid shells for Palm / GameCube / Dreamcast inspired themes
  - cross-axis media styling for `synthwave-highway`
  - denser workbench shells for `amber-cathode`, `dos-navigator`, and `midnight-noir`
- Each theme is authored as a self-contained `theme.json` package with its own palette, workbench recipe, explorer recipe, engine metadata, and visual overlay layer.
- Validation completed for this pass:
  - all `themes/*/theme.json` files parse as valid JSON
  - theme ids are unique across the current package set

- GitManager badge polling now skips hidden documents during steady-state refresh, and visibility restoration triggers an immediate resync instead of waiting for the next 30s tick.

## 2026-04-14 — GitManager Visibility Restore Bound Pass

- Added an explicit one-shot visibility-restore guard in `src/components/GitManager.tsx` so a hidden panel only resyncs once per restore cycle.
- Added regression coverage for a second hide/show cycle to confirm the restore guard resets after the document hides again.
- Validation attempt: `bunx vitest run src/test/gitManager.behavior.test.tsx` is still blocked here because the repo environment cannot resolve `vitest` from `vitest.config.ts`.
- Next pass should keep pushing toward terminal throughput and shell handoff responsiveness, unless a GitManager regression shows up again.

## 2026-04-14 — Terminal Backend Reality Check

- The terminal backend no longer flushes on each write, so the remaining throughput hotspot is the shared terminal map mutex across write/read/resize paths.
- `cargo test --manifest-path src-tauri/Cargo.toml terminal -- --nocapture` is still blocked here by the mingw linker missing `-lgcc_eh` / `-lgcc`.
- Next terminal pass should address lock scope or instance ownership, not flush calls.

## 2026-04-16 — 120 Hz Overlay Budget + Explorer Thumbnail Hover Isolation

- The overlay frame telemetry contract now targets 120 Hz instead of a stale 60 Hz budget.
- Durable implementation shape:
  - `src/config/frameTelemetry.ts` now treats `8.33 ms` as the target frame budget and records `targetFps: 120` in persisted samples, so HUD/settings telemetry matches the current performance goal.
  - `src/components/DevPerformanceHud.tsx` and `src/components/SettingsPage.tsx` now label overlay-frame health against the 120 FPS target instead of the old 60 FPS wording.
  - `src/components/FileExplorer.tsx` no longer advances video hover-scrub thumbnails through parent explorer state on an interval. Hover animation now lives in a memoized `ExplorerThumbnailImage` leaf component, so only the active thumbnail animates instead of repeatedly rerendering the full explorer surface.
  - Parent explorer state still tracks the hovered entry path so the backend can opportunistically request hover frames, but frame stepping is no longer a top-level render driver.
- Durable product note:
  - If a future performance pass touches explorer thumbnails, keep hover-frame animation local to the thumbnail leaf or another isolated viewport lane. Do not reintroduce interval-driven parent state for thumbnail frame stepping.
- Validation:
  - passed: `bunx vitest run src/test/frameTelemetry.test.ts src/test/fileExplorer.viewModes.test.tsx`
  - passed: filtered typecheck grep for touched files via `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "FileExplorer.tsx|DevPerformanceHud.tsx|SettingsPage.tsx|frameTelemetry.test.ts|frameTelemetry.ts|fileExplorer.viewModes.test.tsx" || true`

## 2026-04-20 — Overlay Scrollbar Contract Unification

- Replaced the shipping shell's mixed native-scrollbar behavior with an explicit shared overlay contract:
  - `src/components/OverlayScrollArea.tsx` now exposes `scrollbarStyle: 'hidden' | 'themed' | 'explorer-file-list'` instead of relying on one-off viewport class wiring.
  - `src/App.css` now owns shared scrollbar variables plus a root `.overlay-scrollbar-scope` fallback so raw `overflow: auto` surfaces inside the shipping shell pick up themed scrollbar visuals instead of Windows-native scrollbars.
  - `src/main.tsx` now applies that scope to `html`, `body`, and `#root`, so the main shell and the `file-operations` popout share the same scrollbar baseline.
- Converted the high-value shipping surfaces onto the shared scroll host:
  - archive preview, folder preview, and the main explorer file list now use the explicit explorer-file-list scrollbar contract
  - the file-operations popout, plugin empty state, storage inspector lists, font preview, DOCX workbench, image editor tools lane, SQLite preview, and the explorer task-center popover now use the shared themed scrollbar variant
  - `ExplorerAudioWorkbench.tsx` no longer ships its own bespoke `::-webkit-scrollbar` styling; it now relies on the shell-owned scrollbar theme like the rest of the app
- Durable guidance:
  - new overlay-owned scroll panes should prefer `OverlayScrollArea` with an explicit `scrollbarStyle` instead of raw `overflow: auto`
  - the root fallback is safety net coverage for legacy/missed panes, not the preferred component API
- Validation:
  - passed targeted typecheck via `node_modules/.bin/tsc.exe --noEmit ...` over the touched shell files and new tests
  - passed `node_modules/.bin/vitest.exe run src/test/overlayScrollArea.test.tsx src/test/explorerArchivePreview.test.tsx`
  - passed `node_modules/.bin/vitest.exe run src/test/fileExplorer.viewModes.test.tsx -t "uses the dedicated explorer viewport class for visible file-list scrollbars"`

## 2026-04-20 — SQLite Preview Responsive Repack + Real Pagination

- Reworked the explorer SQLite preview so it behaves like a narrow preview-pane workbench instead of a squeezed full-page database viewer.
- Durable implementation shape:
  - `src/components/ExplorerSqlitePreview.tsx` now measures its own pane width and switches between a compact stacked layout and a wider split layout, so narrow preview panes stop burning horizontal space on a fixed left rail.
  - The table picker is now denser and more informative in both modes: table cards show row counts plus rough page counts, and the active table state is clearer.
  - The active table header now owns the paging chrome and status summary instead of burying pagination in a footer strip that competes with the small preview viewport.
  - Row pagination now keys off the selected table's known `row_count` from `sqlite_get_info`, so `Next` stays available for large tables even when the current page is full and the UI is constrained.
  - SQLite cells now wrap instead of forcing single-line truncation everywhere, which preserves more data in a sidebar-width preview without requiring as much horizontal scrolling.
  - Query failures now render an explicit in-pane error state instead of only logging to the console.
  - Follow-up compaction pass: the table selector no longer tries to read like a second content surface. It is now a thin horizontal strip of compact chips, so the row grid remains the dominant preview surface and table switching still works in one gesture via horizontal scrolling.
- Durable product note:
  - Treat the SQLite lane as preview-pane UI first. If future work adds schema inspection, filtering, or sorting, do not regress the selector back into a tall card wall or a wide side rail that competes with the actual table grid.
- Validation:
  - passed `bunx vitest run src/test/explorerSqlitePreview.test.tsx`
  - passed filtered typecheck via `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "ExplorerSqlitePreview|explorerSqlitePreview.test" || true`

## 2026-04-21 — Icon Themes Became A First-Class Shell System

- Icon theming is no longer buried inside Explorer-only folder-icon controls. The shell now treats icon packs as a dedicated managed content system parallel to themes, shaders, animations, and wallpapers.
- Durable implementation shape:
  - Dedicated icon-theme packages now live under `icon-themes/` and load through `src/config/iconThemePackages.ts`. Packs can ship `icon-theme.json` or `manifest.json` and override explorer file/folder mappings plus shell-wide UI icon slots.
  - `src/config/iconTheme.ts` now resolves both explorer icon mappings and UI icon-slot references, and `src/config/appearance.ts` injects the selected icon pack into the resolved app and dock appearance channels. This keeps icon swaps immediate in both the main shell and `src/windows/FileOperationsWindowApp.tsx`.
  - `src/components/AppIcons.tsx` is now the shell-wide icon compatibility layer. App chrome should import icons from there instead of `lucide-react` directly so UI glyphs can follow the active icon pack. The critical runtime lesson: Lucide exports forward-ref components, so the wrapper must render `<FallbackIcon {...props} />` / `<OverrideIcon {...props} />` as JSX instead of calling them like plain functions.
  - `src/components/SettingsPage.tsx` now has a dedicated `Icons` section that owns icon-theme selection, icon-theme root management, UI/explorer previews, the native OS icon fallback toggle, and folder icon rule authoring. The Explorer section should stay focused on navigation/view/thumbnail behavior rather than icon-pack management.
  - `src/config/iconThemePackages.ts` must treat `fs_read_file_base64` results as already-inlined data URLs when Tauri returns them that way. Re-prefixing those results with another `data:image/...;base64,` wrapper produces blank icons plus browser `Data URL decoding failed` errors.
  - Thumbnail generation remains independent. Explorer thumbnails still route through `src/config/explorerThumbnails.ts` and the existing preview/thumbnail systems; icon themes only affect file/folder glyph selection and UI chrome icons.
- Durable product note:
  - Treat icon packs like first-class shell identity, not a decorative explorer tweak. Any new stock shell icon imports should go through `AppIcons.tsx`, and any new icon-pack authoring surface should live under the dedicated icon-theme system rather than being stapled onto Explorer settings.
  - `icon-themes/Zen/icon-theme.json` is now the reference authored pack. Its manifest was built by intersecting the local SVG ids with the canonical matcher tables, then layering a few GreebleFS-specific folder aliases and shell UI slot overrides on top. Future icon packs should usually start from that same “canonical matcher intersection + targeted local additions” recipe instead of hand-authoring every extension map from scratch.
- Validation:
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/iconThemePackages.test.ts src/test/settingsStore.test.ts src/test/appearance.test.ts src/test/settingsPage.behavior.test.tsx src/test/settingsPage.shaders.test.tsx src/test/panelRegistry.test.tsx src/test/explorerSpreadsheetWorkbench.test.tsx src/test/explorerSqlitePreview.test.tsx --reporter=dot`

## 2026-04-21 — Native GPU Runtime V1 Landed

- GreebleFS now has a host-owned native GPU offload lane instead of isolated per-surface GPU experiments. The new runtime is meant for bounded explorer/media workloads with automatic CPU fallback, not for raw filesystem traversal.
- Durable implementation shape:
  - Added `src-tauri/src/gpu_runtime/` as the native `wgpu` subsystem. It owns adapter probing, `auto` / `safe` / `integrated` / `discrete` tier resolution, one long-lived device/queue, an internal workload registry, WGSL kernel loading, queue-depth telemetry, fallback accounting, and Specta-exported status/events.
  - `safe` is a real CPU kill-switch for native GPU offload. `integrated` is the default budget tier for the current workloads, while `discrete` currently adds headroom/adapter preference without changing the v1 workload budget. The scheduler now models those concerns separately: workloads declare where they are enabled and which GPU budget tier they actually consume.
  - V1 native GPU workloads are deliberately scoped: image thumbnails, image editor preview rendering, audio waveform reduction, audio spectral-band reduction, and audio spectrogram rasterization. Search/indexing, raw directory walking, and plugin GPU registration are still out of scope.
  - Existing explorer/media entrypoints stayed stable. `src-tauri/src/thumbnail_commands.rs`, `src-tauri/src/fs_commands.rs`, `src-tauri/src/image_commands.rs`, `src-tauri/src/audio_engine.rs`, and `src-tauri/src/audio_commands.rs` now prefer the native GPU runtime when available and fall back to the previous CPU paths when the tier is `safe`, the adapter is unsupported, or a workload exceeds the current budget.
  - The resource layer now respects adapter limits instead of assuming every device can accept arbitrary buffer/texture sizes. The runtime keeps the future seam for SPIR-V/Kain-like kernels, but v1 is intentionally WGSL-only.
  - Frontend control/diagnostics now live in `src/config/gpuRuntime.ts`, `src/runtime/gpuRuntimeBackend.ts`, `src/store/gpuRuntimeStore.ts`, `src/store/settingsStore.ts`, `src/App.tsx`, and `src/components/SettingsPage.tsx`. The shell persists `settings.system.gpuTierMode`, configures the runtime on startup/tier changes, and exposes read-only adapter/workload diagnostics in Settings.
- Durable product note:
  - Treat the native GPU runtime as the single host seam for future GPU-first explorer/media work. If a new workload needs offload, add it to `src-tauri/src/gpu_runtime/` with typed status and a CPU fallback instead of inventing another isolated WebGPU or browser-canvas pipeline.
  - Browser-local GPU surfaces still exist for their own reasons. The shader workbench and terminal renderer are not yet routed through the native GPU runtime, so do not conflate “native offload” with every GPU-using surface in the shell.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml gpu_runtime --quiet`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml thumbnail_commands --quiet`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml image_commands --quiet`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml audio_engine --quiet`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml --quiet`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/settingsStore.test.ts src/test/gpuRuntimeStore.test.ts src/test/settingsPage.behavior.test.tsx --reporter=dot`

## 2026-04-22 — Explorer Workspace Tabs Became Workspace-Owned

- The explorer workspace no longer treats tabs as pane-local stacks. `src/store/explorerStore.ts` now persists workspace tabs as whole explorer workspaces, where each tab owns:
  - its own layout mode (`single`, `split`, `triple`, `quad`)
  - focused pane
  - split ratios
  - stable pane slots (`pane-1` through `pane-4`) and their explorer session ids
- Durable implementation shape:
  - `src/config/explorerWorkspaceLayouts.ts` now includes `triple` as the built-in `3-Up` layout: one full-width top pane above a split lower row.
  - `src/store/explorerStore.ts` migrated from the old `tabs[] + activeTabIdByPane + global layout` model to `workspace.tabs[] + activeWorkspaceTabId`. Legacy persisted state is upgraded deterministically:
    - the old active pane tabs become one active multi-pane workspace tab
    - leftover pane-local tabs become their own single-pane workspace tabs
  - Layout changes now preserve hidden pane sessions instead of collapsing them. Moving `4-Up -> 3-Up -> 4-Up` or `3-Up -> 2-Up -> 3-Up` restores the same pane sessions.
  - New tabs created from a multi-pane workspace intentionally reset to a fresh `1-Up` workspace tab cloned from the focused pane session.
  - `src/components/explorer/ExplorerWorkspace.tsx` now renders a single workspace-tab strip plus a separate visible-pane switcher. Pane switching no longer swaps the tab strip.
  - The workspace header overflow actions now operate on workspace tabs, not pane-local tabs. The old "move tab to next pane" behavior was removed because it no longer fits the model.
  - `src/components/FileExplorer.tsx` now accepts `workspacePaneCount` values `1 | 2 | 3 | 4`. `paneCount > 1` still suppresses preview/status chrome, and `paneCount >= 3` now uses the aggressive compact treatment that used to be `4-Up` only.
  - The "tab resets to home folder" bug was fixed by making `ExplorerWorkspace` mount each `FileExplorer` with `key={instanceId}` and by stopping `FileExplorer` from pinning its initial store session behind a mount-only ref keyed to the first render.
- Durable product note:
  - Treat workspace tabs as the user-facing container and panes as layout-owned detail inside that tab. If future work adds drag-reorder, saved workspaces, pinned tabs, or pane templates, that behavior should extend the workspace-tab snapshot model rather than reviving pane-local tab stacks.
  - The tab label is intentionally derived from the focused pane within a workspace tab. A tab can therefore rename itself when focus moves between panes; that is expected under the new model.
- Validation:
  - passed: `bunx tsc --noEmit --pretty false`
  - passed: `bunx vitest run src/test/explorerStore.test.ts src/test/ExplorerWorkspace.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "multi-pane|aggressive compact|remembered preview|local pane without mutating workspace layout|keeps split pdf previews|closes split previews cleanly" --reporter=dot`
  - note: the full `src/test/fileExplorer.viewModes.test.tsx` file still hit a Vitest worker OOM when run as one large worker-thread batch in this environment, but the behavior slices touched by the refactor passed in isolation.

## 2026-04-23 — Screenshot Capture Swapped To Tauri Plugin + Shared Editor

- Replaced the old custom screenshot capture path with a file-backed plugin/stage pipeline.
- Durable implementation shape:
  - `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, and `src-tauri/capabilities/default.json` now register `tauri-plugin-screenshots` and grant `screenshots:default`.
  - Raw monitor capture no longer lives in Rust `xcap` commands. `src/runtime/screenshotBackend.ts` now bridges the JS guest API (`tauri-plugin-screenshots-api`) with typed Rust helpers for `screenshot_prepare_image_stage`, `screenshot_finalize_image`, `screenshot_copy_image_to_clipboard`, and `screenshot_delete_image_stage`.
  - `src-tauri/src/screenshot_commands.rs` is now intentionally narrow: it prepares a staged working file from a plugin capture, optionally crops that stage, finalizes the stage into the screenshot library, copies images to the system clipboard, and deletes staged files. The raw plugin capture must remain immutable during an edit session.
  - `src/components/ScreenshotsManager.tsx` no longer captures every monitor up front, no longer ships full-monitor base64 PNGs over IPC, and no longer owns a separate annotation canvas/editor. It now lazily captures the active monitor, lets the user define a region in a lightweight selection view, then opens the staged file in the shared image editor.
  - `src/components/ExplorerImageEditor.tsx` now uses the shared `@img-editor-runtime` path again for both explorer preview editing and screenshot editing. The screenshot tool and the preview pane now share the same editor component, save semantics, and object/shape/history model.
- Durable product notes:
  - Keep screenshot capture and screenshot editing as separate phases. Plugin capture is the raw source; Rust stage files are the editable working copy; the saved screenshot library entry is the finalized artifact.
  - Do not reintroduce eager multi-monitor capture on panel load. Capture should stay lazy so the tool feels instant on first open.
  - Do not reintroduce browser-owned annotated export or cropper-only preview editing. The stable direction is one shared runtime-backed editor plus typed file-stage helpers.
- Validation:
  - passed: `bun install`
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/explorerImageEditor.test.tsx src/test/screenshotsManager.test.tsx --reporter=dot`

## 2026-04-23 — Explorer Pane Resize Headroom Increased

- Explorer pane resizing now gives materially more headroom on wide desktops instead of feeling capped near the middle of the shell.
- Durable implementation shape:
  - `src/config/explorerShellLayouts.ts` raises `EXPLORER_PREVIEW_WIDTH_BOUNDS.max` from `920` to `1280`, so the preview pane can be pulled much farther without changing its default width or layout bias.
  - `src/config/explorerWorkspaceLayouts.ts` now exports `EXPLORER_WORKSPACE_AXIS_RATIO_BOUNDS` and widens the shared workspace split clamp from `28/72` to `18/82`, which applies to both live drag resizing and persisted workspace-tab hydration.
  - `src/config/explorerRail.ts` raises the sources rail max width to `520` in full explorer mode and `320` in compact mode so the other resizable explorer lane can also breathe on larger monitors.
- Durable product note:
  - Keep pane-resize freedom data-driven through the shared bounds/config files, not as one-off numbers inside `FileExplorer.tsx` or `ExplorerWorkspace.tsx`. Preview, rail, and workspace split behavior should continue to widen or tighten from those central contracts.
  - The current bounds are intentionally more permissive, not unlimited. They are meant to make the explorer feel less artificially constrained without letting one drag gesture permanently consume the whole shell.
- Validation:
  - passed: `bunx vitest run src/test/fileExplorer.viewModes.test.tsx -t "preserves preview width drag resize behavior while split mode is active" --reporter=dot`
  - passed: `bunx vitest run src/test/explorerStore.test.ts src/test/explorerSideRail.test.tsx --reporter=dot`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`

## 2026-04-23 — Theme Packages Became Bundle-First Orchestration Manifests

- Authored filesystem themes are no longer treated as giant monolithic payloads. `src/config/themePackages.ts` now loads `themes/` as bundle manifests that orchestrate modular child packs and/or explicit external pack ids, then composes those lanes back into the resolved downstream `OverlayThemeDefinition`.
- Durable implementation shape:
  - `src/config/themeBundlePacks.ts` is the new shared modular-pack loader layer for `appearance-packs/`, `interaction-motion/`, `shell-renderers/`, `theme-recipes/`, and `theme-engines/`. Theme bundles and standalone managed roots now share the same authored pack formats instead of duplicating pack logic inside `themePackages.ts`.
  - `src/config/themePackages.ts` now treats `theme.json` / `theme.toml` as a bundle manifest with explicit refs like `appearancePackId`, `topBarId`, `iconThemeId`, `wallpaperId`, `shaderId`, `openAnimationId`, `closeAnimationId`, `interactionMotionPackId`, `rendererId`, `themeRecipeId`, `themeEngineId`, `homePackId`, and `menuPackId`. Bundle-local child folders are auto-discovered under `appearance-packs/`, `top-bars/`, `icon-themes/`, `wallpapers/`, `shaders/`, `animations/`, `interaction-motion/`, `shell-renderers/`, `theme-recipes/`, `theme-engines/`, `home-packs/`, and `menu-packs/`.
  - Bundle-local authored ids are scoped as `<themeBundleId>:<localId>`, which lets local child packs flow through the same global catalogs without colliding with standalone authored roots.
  - `src/config/appContentDirectories.ts` now exposes standalone managed roots for the new pack families (`appearance-packs`, `interaction-motion`, `shell-renderers`, `theme-recipes`, `theme-engines`) so authors can ship them globally or nest them inside a bundle with the same manifest shape.
  - `src/App.tsx` now resolves three layers before appearance resolution: filesystem/plugin theme bundles, bundle-local pack catalogs, and standalone/global pack catalogs. The rest of the shell still consumes resolved `OverlayThemeDefinition` objects, so downstream UI/runtime consumers stay stable.
  - `src/store/settingsStore.ts` now persists `settings.appearance.customThemeBundles` alongside legacy `customThemes`. This is the durable storage path for authored Theme JSON edits after the bundle refactor.
  - `src/components/SettingsPage.tsx` `Theme JSON` now edits/imports bundle manifests instead of raw resolved theme definitions. Palette edits mutate the embedded appearance pack inside the editable bundle draft, imports persist to `customThemeBundles`, and legacy monolithic theme JSON is rejected with a clear unsupported-format error.
- Durable product note:
  - Treat theme bundles as orchestration manifests, not the place where every theming subsystem should be re-authored inline. Anything behavior-heavy or asset-heavy should prefer its own pack lane and let the bundle choose defaults.
  - User pins still win for the currently exposed Settings lanes. “Follow Theme” now means “follow the active theme bundle default,” not “read some monolithic blob.”
  - Legacy authored filesystem `theme.json` files are intentionally unsupported now. If a bundle-like migration path is needed, migrate old content into child pack folders or embedded bundle packs rather than reviving the monolithic parser.
- Validation:
  - passed: `bunx vitest run src/test/themePackages.test.ts --reporter=dot`
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx --reporter=dot`

## 2026-04-23 — Mobile Explorer Polish Phase 1

- The mobile PWA explorer now behaves like a real mobile browser instead of a raw list dump. The active desktop theme still owns palette, fonts, icon theme, folder-icon rules, thumbnails, and preview resources, but mobile now owns a small layout/browse contract tuned for phone ergonomics.
- Durable implementation shape:
  - `src/config/mobileLayout.ts` is now the shared mobile layout contract for both desktop settings and the browser shell. It owns `viewMode`, `gridZoom`, `showHiddenFiles`, `sortBy`, `sortOrder`, `directoriesFirst`, and `showTabLabels`, plus the default/normalization rules.
  - `src/store/settingsStore.ts`, `src/config/mobileTheme.ts`, and `src/App.tsx` now carry that layout subtree through `settings.mobile.layout` and into the mobile theme snapshot, so the phone shell can inherit desktop-owned presentation while still having its own layout lane.
  - `src-mobile/App.tsx` was rebuilt into a grid-first mobile explorer shell with a fixed Files-style bottom dock, compact explorer header, quick filter, view/sort/hidden/upload action strip, folder navigation, preview routing, transfer reveal, and per-folder scroll preservation.
  - Mobile navigation now routes through explicit history state (`tab` + `path`) rather than hover-only UI assumptions. The phone shell commits navigation intent immediately and keeps the browser state in sync for tab/path restoration.
  - `src-tauri/src/lan_share/mobile.rs` now treats `/api/list`, search, preview summaries, and icon resolution as browse-policy-aware surfaces. Hidden files are off by default, mobile list/search routes honor `showHiddenFiles`, sorting is data-driven (`name/date/size/type`, `asc/desc`, `directoriesFirst`), and list responses now include `parentPath` plus entry-level `isHidden`.
  - Mobile icon resolution is now safer. The host validates icon ids against the active icon theme before emitting them, and the phone-side browser-safe resolver still treats desktop folder/icon rules as source-of-truth with fallbacks when an icon id is missing or invalid.
  - `src/test/mobileApp.test.tsx`, `src/test/mobileTheme.test.ts`, and `src/test/settingsStore.test.ts` now cover the layout contract, mobile browse-policy wiring, grid/list mode toggles, and the new theme snapshot shape.
- Durable product notes:
  - Hidden files should stay opt-in on mobile. If future browse presets or mobile “pro” modes are added, keep the default conservative and route any changes through the shared mobile layout contract instead of hardcoding dotfile behavior inside the React shell.
  - Treat mobile history sync as part of the explorer experience, not as an afterthought. Folder traversal, deep-link restore, and browser back/forward should continue to flow through one location-state contract rather than separate UI-only history stacks.
  - Keep mobile and desktop icon behavior intertwined through shared resolvers and authored icon metadata. Do not let the phone shell drift into a separate icon-guessing system.
- Validation:
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - passed: `cargo test --manifest-path src-tauri/Cargo.toml lan_share::mobile -- --nocapture`
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/mobileApp.test.tsx src/test/mobileTheme.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - passed: `bun run build:mobile`

## 2026-04-24 — Blank Managed AI Runtime Uses An Explicit Terminal Download Button

- The Settings acceleration/model surfaces now expose the managed AI install flow as an explicit operator action instead of auto-starting work on page open. When the runtime is blank, the UI calls that out and offers a Download button that seeds the managed Python bootstrap package list, reveals the integrated Terminal, and injects the pip install command for the currently selected routing-mode preset only after the user clicks it.
- Durable implementation shape:
  - `src-python/greeblefs-python-sidecar.json` package presets are now the install truth for this workflow. `ml-core` includes `sentence-transformers` and `faiss-cpu`, and `cuda-ai-indexing` includes `faiss-cpu`, so the acceleration probe and the install presets stay aligned.
  - `src/config/python.ts` now owns the data-driven helpers for this flow: resolving the install preset from the current acceleration routing mode, merging/deduping the managed bootstrap queue, deciding when a probe is "effectively blank", and building a shell-correct managed pip install command for PowerShell, `cmd.exe`, and POSIX shells.
  - `src/components/SettingsPage.tsx` now keeps probing and downloading separate. The user can probe CUDA/AI explicitly, and the new Download button updates `settings.python.bootstrapPackages`, opens the `terminal` panel in the active layout profile, ensures the managed runtime exists, and dispatches the pip command through the existing `overlayterm:cmdinject` flow only on click.
  - `src/runtime/accelerationRuntimeBackend.ts` now rejects invalid/null acceleration snapshots from the native bridge instead of letting the store replace its snapshot with `null`. That keeps the Settings page stable if a mock, test harness, or unexpected bridge response fails to return a real snapshot object.
- Durable product notes:
  - Keep this workflow data-driven through the package presets and Python config helpers. If future routing modes or curated AI stacks are added, extend the preset catalog and preset-selection helper instead of hardcoding package lists inside `SettingsPage`.
  - The intended UX is "nothing starts until the operator clicks Download, then open Terminal and show the real install command." Silent runtime bootstrap before injection is acceptable, but the user-facing package install should continue to route through the integrated terminal flow.
- Validation:
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx --reporter=dot`
  - passed: `bunx vitest run src/test/accelerationRuntimeStore.test.ts src/test/pythonConfig.test.ts --reporter=dot`
  - note: `bunx tsc --noEmit --pretty false -p tsconfig.json` still reports unrelated repo-wide type errors in `src/config/soundPacks.ts`, `src/panels/panelRegistry.tsx`, and vendored `src/vendor/tiptap/**` files.

## 2026-04-24 — Theme-Aware Sound Packs and Native Notification Routing

- GreebleFS now has a first-class shell sound-effects lane instead of ad hoc per-component noise. Sound packs are treated like the other managed/theme-authored systems: themes can declare a default pack, users can pin an override, and the shell runtime resolves one active pack before shared button/explorer/task/notification cues play.
- Durable implementation shape:
  - `src/config/appContentDirectories.ts` now registers a managed `soundPacks` root backed by `sound-packs/`, so authored packs follow the same dev-vs-release content-root rules as themes, top bars, icon themes, wallpapers, shaders, and animations.
  - `src/config/soundPacks.ts` is the canonical loader/runtime contract for this lane. It owns the effect catalog (`shell-button-press`, `explorer-selection-step`, `explorer-open-entry`, `task-start`, `task-success`, `task-failure`, `notification-*`), the built-in synth fallback pack, standalone pack loading, bundle-local pack loading/scoping, and cue normalization.
  - `src/config/themePackages.ts` and `src/config/appearance.ts` now treat `soundPackId` / `defaultSoundPackId` as real theme lanes. Theme bundles can point at standalone packs or contribute `themes/<bundle>/sound-packs/*`, and the resolved downstream theme carries the default sound-pack id the same way it already carries top bar, icon theme, shader, animation, renderer, recipe, and engine defaults.
  - `src/store/settingsStore.ts` now persists the user-facing audio lane: `activeSoundPackId`, master enable, volume, per-category enable flags (`button`, `navigation`, `task`, `notification`), native-notification enable flags, and the existing VST3 path list.
  - `src/runtime/soundEffects.ts` is the shell playback runtime. It uses Web Audio for synth/sample playback, caches decoded samples, respects per-cue cooldowns, and exposes a preview path that bypasses live mute/category gating so authored packs can be auditioned safely from Settings.
  - `src/runtime/nativeNotifications.ts` is the host-notification bridge. The app now owns notification permission/status checks and `sendNativeNotification(...)` directly instead of leaving that path buried in plugin-only affordances.
  - `src/App.tsx` now hydrates the active sound-pack catalog, resolves the current pack from `settings.audio.activeSoundPackId ?? theme.defaultSoundPackId ?? DEFAULT_SOUND_PACK_ID`, configures the global sound runtime, and plays task sounds / sends native notifications off explorer task lifecycle transitions.
  - `src/components/SettingsPage.tsx` now has a real audio control surface:
    - sound-pack catalog section using the shared theme-bundle pack UI
    - sound enable/category toggles plus master volume
    - explicit cue preview buttons
    - native-notification permission/test controls
    - the existing VST3 discovery-path list
  - `src/components/OverlayActionButton.tsx`, `src/components/WorkbenchTopBar.tsx`, and `src/components/FileExplorer.tsx` now emit the shared shell-button / explorer-navigation cues so the system is audible in the actual workbench, not just configurable in Settings.
- Durable product notes:
  - Treat sound packs as shell identity, not as one-off UX garnish. New user-facing shell/explorer actions should reuse the central cue catalog and settings-backed category gates instead of hardcoding `new Audio(...)` or isolated browser playback inside components.
  - Native notifications are now app-owned behavior. Future task/report/reminder notifications should route through `src/runtime/nativeNotifications.ts` and the `settings.audio.native*` gates rather than directly importing Tauri notification APIs from random surfaces.
  - Theme bundles can now own a sound identity lane. If a future theme starter/example bundle is authored, include `soundPackId` and a local `sound-packs/` example so this capability stays visible in the bundle-first reference shape.
- Validation:
  - passed: `bunx vitest run src/test/soundPacks.test.ts src/test/themePackages.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "src/(config/soundPacks|components/SettingsPage|components/OverlayActionButton|components/WorkbenchTopBar|components/FileExplorer|panels/panelRegistry|runtime/nativeNotifications|runtime/soundEffects|App\\.tsx|store/settingsStore|config/themePackages|config/settingsNavigation|config/appearance|config/appContentDirectories|test/soundPacks|test/themePackages|test/settingsStore)"` returned no matching errors
  - note: repo-wide `bunx tsc --noEmit --pretty false -p tsconfig.json` is still noisy because of unrelated vendored `src/vendor/tiptap/**` failures and other pre-existing workspace issues, so use the filtered signal for this lane

## 2026-04-24 — Mobile PWA Layout Scaling And Push-Driven iPhone Downloads

- The sovereign mobile shell now has a real iPhone-tuned layout lane plus a first pass at push notifications. Mobile browsing is no longer locked to one density recipe, and the desktop explorer can now dispatch a file directly toward paired phones through web push.
- Durable implementation shape:
  - `src/config/mobileLayout.ts` now owns a richer mobile ergonomics contract: `interfaceScale`, `chromeScale`, `pagePadding`, and `touchComfort` were added alongside the existing view/sort/hidden-file settings. The defaults are intentionally phone-biased (`comfortable`, larger chrome, larger page gutters) and the normalization helpers clamp the lane centrally.
  - `src/store/settingsStore.ts`, `src/config/mobileTheme.ts`, and `src-tauri/src/lan_share/types.rs` now carry that richer layout snapshot end-to-end so the desktop Settings control plane, the native host, and the browser PWA all agree on the same mobile layout truth.
  - `src/components/SettingsPage.tsx` now exposes those controls inside `Settings -> Mobile -> Mobile Theme` with explicit sliders and comfort toggles instead of relying only on a single grid zoom value.
  - `src-mobile/App.tsx` and `src-mobile/mobile.css` now apply viewport-aware shell variables for interface scale, chrome scale, touch-target sizing, bottom-dock spacing, safe-area padding, and visual-viewport height. The mobile shell also now avoids stale broken-folder landings by recovering to a safe path and can consume deep-link download intents.
  - `src-mobile/public/sw.js` and `src-mobile/mobilePush.ts` now implement the PWA push lane: the service worker shows notifications, click-through routing opens or focuses the app, and the browser shell can subscribe/unsubscribe through `/api/push/*`.
  - `src-tauri/src/lan_share/push.rs` is the native push registry and dispatch layer. It persists paired-device subscriptions plus a VAPID key under app data and builds deep-link payloads that reopen the mobile app on the `Transfers` lane with enough path context to immediately start a browser download.
  - `src/runtime/mobilePushBackend.ts`, `src-tauri/src/share_commands.rs`, `src-tauri/src/lan_share/mobile.rs`, and `src-tauri/src/specta_bindings.rs` now give the desktop shell a typed command path for push config/registration/dispatch.
  - `src/config/explorerContextMenu.ts`, `src/config/menuPacks.ts`, `src/components/explorer/explorerMenuRuntime.ts`, and `src/components/FileExplorer.tsx` now surface a `Send to iPhone` explorer command for single local files. If the mobile share is not already running, the explorer first auto-starts the share using the current mobile remote-access settings and then sends the push payload.
- Durable product notes:
  - Keep mobile layout tuning inside the shared `settings.mobile.layout` contract. If future presets or per-device heuristics are added, extend that typed contract instead of scattering more one-off CSS literals through `src-mobile/App.tsx`.
  - Treat iPhone push notifications as an installed-PWA feature, not a generic browser-tab feature. The intended lane is: Home Screen install, enable notifications from the installed app, then let desktop explorer actions wake the phone into the mobile shell with a deep-link download intent.
  - The desktop push runtime should keep consuming generated Specta types instead of local copies. This lane changed shape once already (`deviceLabel`/`userAgent` nullability and the generated `p256Dh` key name), and local shadow interfaces drift too easily.
- Validation:
  - passed: `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings`
  - passed: `cargo check --manifest-path src-tauri/Cargo.toml -q`
  - passed: `bun run build:mobile`
  - passed: `bunx vitest run src/test/explorerMenuRuntime.test.ts src/test/mobileApp.test.tsx src/test/mobileTheme.test.ts src/test/settingsStore.test.ts --reporter=dot`
  - note: repo-wide `bunx tsc --noEmit --pretty false -p tsconfig.json` still has unrelated branch drift in `src/components/FileExplorer.tsx` and other existing workspace noise, so use scoped checks for this mobile/push lane unless that explorer terminal work is being addressed directly.

## 2026-04-25 — Settings Shell Standardization Pass Started With Shared Primitives And Representative Section Migrations

- The settings overhaul now has a real shared UI framework instead of every migrated page inventing its own shell. `src/components/settings/SettingsShell.tsx` owns the rail + header + full-width content viewport contract, and `src/components/settings/SettingsPrimitives.tsx` now provides the shared section/header/block/row/catalog/inspector/action-strip building blocks that the migrated pages render through.
- Durable implementation shape:
  - `src/config/settingsNavigation.ts` now carries typed page-grammar metadata. Each section entry has an archetype (`rows`, `catalog-inspector`, `tool-editor`, or `hybrid`) plus shell hints so the settings surface can standardize layout without changing persisted settings state.
  - `src/components/SettingsPage.tsx` now uses `SettingsShell` as the top-level settings layout and routes representative sections through extracted modules instead of owning all of their JSX inline. The first migrated sections are:
    - `src/components/settings/sections/SystemSettingsSection.tsx`
    - `src/components/settings/sections/AppearanceSettingsSection.tsx`
    - `src/components/settings/sections/IconSettingsSection.tsx`
    - `src/components/settings/sections/ContextMenusSettingsSection.tsx`
  - `src/components/settings/ThemeCatalog.tsx` now owns the reusable theme-catalog rendering path that the appearance lane uses, so theme-card behavior is no longer trapped inside `SettingsPage.tsx`.
  - The shared primitives now carry stable testing hooks (`data-settings-shell`, `data-settings-shell-content`, `data-settings-row`, `data-settings-catalog-grid`, `data-settings-catalog-card`, `data-settings-inspector`, etc.) and accessible naming defaults. `SettingsRow` auto-labels its control when the control does not already provide an accessible label, and clickable catalog cards now expose their title through `aria-label`. This keeps behavior tests stable while making the standardized settings surface more accessible.
  - The migrated Appearance copy restores the VS Code compatibility messaging the old tests expected, including the explicit `.vsix` warning language, while the System and Context Menus lanes now render through the extracted shared anatomy instead of bespoke inline sections.
- Durable product notes:
  - This is an intentional phased migration, not a finished purge. `SettingsPage.tsx` still contains commented legacy branches/helpers for the just-migrated lanes so behavior can be compared while the rest of the settings surface is still being ported. The next cleanup pass should delete those legacy branches once the remaining settings sections have moved onto the shared framework.
  - The new standard to preserve is: shell-level consistency first, then rich widgets inside that shell. Appearance and Icons stay rich through catalog + inspector treatment, System stays row-driven, and Context Menus keeps its three-lane editor/composer model rather than getting flattened into generic form rows.
  - When migrating another settings section, prefer extracting a dedicated section module under `src/components/settings/sections/` and feed it typed data/actions from `SettingsPage.tsx` rather than re-expanding inline JSX in the page entrypoint.
- Validation:
  - passed: `bunx vitest run src/test/settingsPage.behavior.test.tsx src/test/settingsPage.shaders.test.tsx --reporter=dot`
  - passed: filtered `bunx tsc --noEmit --pretty false -p tsconfig.json 2>&1 | rg "SettingsPage.tsx|src/components/settings/|src/test/settingsPage.behavior.test.tsx|settingsNavigation.ts"` returned no matching errors
