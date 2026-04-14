# MEMORY.md - OT Plugins

## Durable role

- Agent: OT Plugins
- Lane: Plugin platform lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## 2026-04-14 plugin platform note

- `src-tauri/src/plugin_commands.rs` now runs plugin backends on `spawn_blocking` and enforces a 30s timeout, so backend plugins cannot pin the async runtime forever.
- Plugin backend execution now captures stdout/stderr from piped child handles and keeps the path containment check inside the plugin `backend/` directory.
- `src/config/pluginPackages.ts` now rejects unsafe package-relative paths before loading package entries, fonts, or theme directories, which blocks `..` and absolute-path escapes from plugin manifests.
