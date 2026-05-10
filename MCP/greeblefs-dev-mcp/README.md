# GreebleFS Dev MCP

Standalone MCP server for driving a live `bun run tauri dev` GreebleFS session.

## What it does

- reads the dev-session status/log files published by `scripts/run-platform-tauri.mjs`
- attaches to the running Tauri WebView through Playwright/CDP when available
- falls back to the frontend dev URL for browser-side inspection when native attach is unavailable
- captures real desktop `greeblefs.exe` windows through a Windows-native screenshot path when WebView/CDP is unavailable
- calls the dev-only in-app bridge for semantic state, performance, profiles, console retention, and host methods when the attachment is a real Tauri webview
- exposes a compact MCP tool surface by default: `gfs_help`, `gfs_app`, `gfs_ui_snapshot`, `gfs_ui_act`, `gfs_ui_capture`, `gfs_host`, `gfs_events`, `gfs_code`, and `gfs_validate`
- keeps rich host methods discoverable through `gfs_help` / `gfs_host schema` and callable through `gfs_host command=call`, instead of registering one MCP tool per host method

## Runtime notes

- Runtime automation uses `node --import tsx`, not Bun. On this Windows host, Playwright browser/CDP attachment was reliable under Node and stalled under Bun.
- TypeScript validation still uses Bun: `bun run --cwd MCP/greeblefs-dev-mcp typecheck`.
- `bun run tauri dev` publishes live session truth to:
  - `MCP/.state/tauri-dev-session.json`
  - `MCP/.state/tauri-dev.log`
- The MCP runtime checks those files first so agents can tell whether the app is actually running before trying to attach.
- Default MCP tool count should stay under 10. Add new automation as commands on the compact router tools unless a capability truly needs top-level model attention.

## Scripts

- `bun run dev`
  Start the server over stdio for MCP clients.
- `bun run dev:http`
  Start the server on localhost Streamable HTTP.
- `bun run doctor`
  Run local attach/status diagnostics without starting the MCP transport.
- `bun run smoke`
  Run a live attach/snapshot smoke pass.
- `bun run smoke:screenshot`
  Run the smoke pass and save a screenshot under `MCP/.state/screenshots/`.
