# GreebleFS Dev MCP

Standalone MCP server for driving a live `bun run tauri dev` GreebleFS session.

## What it does

- reads the dev-session status/log files published by `scripts/run-platform-tauri.mjs`
- attaches to the running Tauri WebView through Playwright/CDP when available
- falls back to the frontend dev URL for browser-only inspection when native attach is unavailable
- calls the dev-only in-app bridge for semantic state, telemetry, performance, profiles, and host methods

## Scripts

- `bun run dev`
  Start the server over stdio for MCP clients.
- `bun run dev:http`
  Start the server on localhost Streamable HTTP.
- `bun run doctor`
  Run local attach/status diagnostics without starting the MCP transport.
