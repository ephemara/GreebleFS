# GreebleFS Memory

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
  - `src/windows/FileOperationsWindowApp.tsx` is a standalone themed destination picker plus Task Center surface. It can browse folders, create a destination folder, submit copy/move operations, and then fall back to the shared explorer task feed.
  - `src/components/explorer/ExplorerTaskCenterContent.tsx` is the shared task-center body used by both the inline explorer badge and the dedicated popout window.
  - `src/components/explorer/ExplorerTaskStatusBadge.tsx` now exposes a `Pop Out` action so operators can move from the inline status surface into the standalone file-operations window.
  - `src/components/FileExplorer.tsx` now routes explicit `Copy To...` / `Move To...` context-menu actions through the popout destination picker, and all successful transfer paths publish a cross-window completion event so other explorer instances can refresh when source or target folders change.
  - `src/App.tsx` now routes the command-palette task-center action into the dedicated file-operations window instead of only toggling the inline badge.
- Durable product note:
  - the file-operations window is intentionally a shell surface, not a second filesystem truth layer. Rust task/transfer truth still flows through `src/runtime/explorerBackend.ts`; the popout only owns presentation, destination selection, and cross-window coordination.
- Validation:
  - passed: `bunx vitest run src/test/fileOperationsWindow.test.ts src/test/pluginPanelRequests.test.ts src/test/app.dockMode.test.tsx`
  - passed: targeted file-operations/window mock coverage in `src/test/fileOperationsWindow.test.ts`
  - blocked: narrowed `npx tsc --noEmit ...` still reports a pre-existing unrelated `src/components/ScreenshotsManager.tsx` type error (`SelectionHandle` includes `"move"` but the resize-handle prop does not)

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
  - Thumbnail generation remains independent. Explorer thumbnails still route through `src/config/explorerThumbnails.ts` and the existing preview/thumbnail systems; icon themes only affect file/folder glyph selection and UI chrome icons.
- Durable product note:
  - Treat icon packs like first-class shell identity, not a decorative explorer tweak. Any new stock shell icon imports should go through `AppIcons.tsx`, and any new icon-pack authoring surface should live under the dedicated icon-theme system rather than being stapled onto Explorer settings.
- Validation:
  - passed: `bunx tsc --noEmit --pretty false -p tsconfig.json`
  - passed: `bunx vitest run src/test/settingsStore.test.ts src/test/appearance.test.ts src/test/settingsPage.behavior.test.tsx src/test/settingsPage.shaders.test.tsx src/test/panelRegistry.test.tsx --reporter=dot`

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
