# OverlayTerm Repo Review

Date: 2026-04-06

Scope:
- Full repo review with extra attention on startup/build packaging, plugin/theme/shader/layout runtime, and the Yazi-adjacent file explorer shell.
- Findings below are against the current working tree.

Checks run:
- `bun x vitest run src/test/useFolderPluginRuntime.test.tsx src/test/useFolderPluginRuntime.queue.test.tsx src/test/useFolderPluginRuntime.fallback.test.tsx src/test/pluginWatchPaths.test.ts`
- Manual packaged-app validation with WebView2 remote debugging on Windows.

## Findings

### [P1] Explicit artifact/VPS builds still route the packaged frontend through absolute filesystem paths

Files:
- `scripts/run-platform-tauri.mjs:73`
- `scripts/run-platform-tauri.mjs:84`

Why this matters:
- When the runtime-config path is used, the wrapper rewrites `frontendDist` to an absolute path. In practice, that causes the packaged app to load through `file://...` instead of Tauri's packaged origin.
- On WebView2, that breaks module/CSS loading with CORS errors and leaves the desktop window blank even though the process is alive.

Evidence:
- The current wrapper still writes `frontendDist` directly from the resolved absolute path in `writeRuntimeTauriConfig`.
- This is exactly the path the app takes when `hasExplicitArtifactRoot` or the related override env vars are set.

Impact:
- Local builds are now recoverable if they avoid the runtime-config path, but the explicit artifact/VPS path remains capable of generating a non-functional packaged app.

Recommended fix:
- Keep the runtime config on the original project-relative `frontendDist` value, or compute a served origin that preserves `http://tauri.localhost/` semantics instead of switching to filesystem URLs.

### [P1] Package plugin backends break when a manifest `id` differs from the directory name

Files:
- `src/config/pluginPackages.ts:279`
- `src/config/pluginPackages.ts:429`
- `src/config/pluginPackages.ts:435`
- `src/runtime/useFolderPluginRuntime.ts:135`
- `src/runtime/useFolderPluginRuntime.ts:136`
- `src-tauri/src/plugin_commands.rs:128`
- `src-tauri/src/plugin_commands.rs:142`

Why this matters:
- Package plugins are allowed to derive their runtime `id` from `manifest.id`.
- The frontend then launches backend helpers using that `plugin.id`.
- The Rust side resolves the backend path as `plugins_root/<plugin_id>/backend/...`, not from the actual plugin directory that was loaded.

Failure mode:
- If a package lives in `plugins/foo/` but its manifest `id` is `bar`, the frontend will ask Rust to execute `plugins/bar/backend/...`.
- The panel/plugin can load, but all backend actions fail at runtime with "backend dir for plugin ... could not open".

Recommended fix:
- Pass the actual plugin directory or backend directory to the backend command instead of reconstructing it from `plugin.id`.
- Alternatively, enforce `manifest.id === directoryName` for package plugins and fail discovery if they diverge.

### [P2] Duplicate theme package IDs are accepted and silently override each other

Files:
- `src/config/themePackages.ts:674`
- `src/config/themePackages.ts:683`
- `src/config/appearance.ts:994`
- `src/config/appearance.ts:1000`

Why this matters:
- Theme packages are collapsed into a `Map` keyed by derived package id with no duplicate detection.
- The appearance resolver later builds another id-keyed `Map` for all package/custom/built-in themes.

Failure mode:
- If two package directories resolve to the same theme id, only the last one wins during inheritance/lookup, while both package records can still appear in higher-level UI state.
- That creates hard-to-debug behavior where the selected theme id resolves to a different package than the package list implies.

Recommended fix:
- Detect duplicate package ids during discovery and surface them as hard errors or at least explicit warnings.
- Apply the same uniqueness rule to plugin-packaged themes before they are merged into the appearance resolver.

### [P2] Asset URL fallbacks still degrade to raw `file://` URLs, which are brittle under the desktop webview

Files:
- `src/runtime/useFolderPluginRuntime.ts:80`
- `src/runtime/useFolderPluginRuntime.ts:86`
- `src/config/pluginPackages.ts:287`
- `src/config/pluginPackages.ts:296`
- `src/config/themePackages.ts:224`
- `src/config/themePackages.ts:233`
- `src/config/themePackages.ts:237`
- `src/config/themePackages.ts:245`

Why this matters:
- Plugin asset URLs, package font URLs, and theme asset URLs all fall back to raw `file://` strings if `convertFileSrc` or inline-file loading fails.
- The packaged app already demonstrated that the WebView2 environment is sensitive to filesystem-origin loading.

Failure mode:
- Any environment/configuration that makes `convertFileSrc` unavailable, or any asset path that falls through the `fsReadFileBase64` path, can regress from the working Tauri origin back to filesystem-origin behavior.
- That may not fail uniformly: images, fonts, and CSS-backed assets can fail differently across hosts, which makes debugging much harder.

Recommended fix:
- Treat `convertFileSrc` failure as an error in packaged desktop mode instead of silently returning `file://`.
- For theme/package assets that must remain portable, prefer Tauri-served URLs or fully inlined data URLs and make the failure path explicit.

## Residual risks

- `src/runtime/moduleRuntime.ts:35` and `src/runtime/moduleRuntime.ts:81` still compile and execute runtime modules on the UI side by importing the full TypeScript compiler and evaluating output with `new Function`. That may be acceptable for a trusted local-plugin model, but it is still a significant maintainability/performance/security tradeoff and is not isolated.
- The targeted plugin watcher tests are green, so the watcher/debounce plumbing itself looks healthy. The higher-risk issues are identity/pathing and packaged-runtime loading, which those tests do not cover.
