# GreebleFS Dev MCP Agent Manual

Use this manual when you are attached to the GreebleFS dev MCP and need to decide which compact router tool to call.

## Overview

The dev MCP intentionally exposes a small top-level tool surface. Do not look for one tool per host method or one tool per UI action. Use the router tools with a `command` field.

Default tools:

- `gfs_how_to_use`: read this markdown manual.
- `gfs_help`: list router tools, commands, and host method ids.
- `gfs_app`: inspect or control the live Tauri dev app.
- `gfs_ui_snapshot`: read UI, console, telemetry, performance, native flow, and profile state.
- `gfs_ui_act`: click, type, press keys, invoke actions, evaluate scripts, and clear console retention.
- `gfs_ui_capture`: capture screenshots and accessibility trees.
- `gfs_host`: read/call extension-host methods.
- `gfs_events`: inspect, subscribe to, and publish host events.
- `gfs_code`: gather coding context, git state, memory, architecture, and workspace file data.
- `gfs_kain`: read Kain docs/examples and run the active local Kain CLI.
- `gfs_validate`: plan and run focused validation plus native performance probes.

## Quick Start

For coding work, start with:

```json
{ "command": "agent_context" }
```

Use that with `gfs_code`. It returns branch, dirty files, recent commits, recent memory, architecture pointers, app status, and recommended validation.

For live-app proof, start with:

```json
{ "command": "status", "includeAttachProbe": true }
```

Use that with `gfs_app`. If the app is reachable, attach with `gfs_app command=attach`, inspect with `gfs_ui_snapshot`, act with `gfs_ui_act`, and capture proof with `gfs_ui_capture`.

## Tool Map

- `gfs_how_to_use`
  - `section`: `all`, `overview`, `quick_start`, `tool_map`, `recipes`, `payloads`, `host_methods`, `validation`, `troubleshooting`.
- `gfs_help`
  - `category`: `all`, `app`, `ui_snapshot`, `ui_act`, `ui_capture`, `host`, `events`, `code`, `validate`, `host_commands`.
  - Use `category: "host_commands"` to list extension-host method ids without bloating the MCP tool list.
- `gfs_app`
  - `status`, `doctor`, `start`, `stop`, `wait_ready`, `attach`, `log`, `windows`.
- `gfs_ui_snapshot`
  - `snapshot`, `actions`, `console`, `telemetry`, `performance`, `flow`, `profile`.
- `gfs_ui_act`
  - `click`, `hover`, `type`, `key`, `select`, `drag`, `invoke_action`, `evaluate`, `console_clear`.
- `gfs_ui_capture`
  - `screenshot`, `native_window_screenshot`, `accessibility`.
- `gfs_host`
  - `schema`, `call`, `context`, `selection`, `preview`.
- `gfs_events`
  - `describe`, `snapshot`, `subscribe`, `read`, `unsubscribe`, `publish`.
- `gfs_code`
  - `agent_context`, `git_status`, `git_branch`, `git_recent_commits`, `git_changed_files`, `git_diff`, `git_show`, `memory_recent`, `memory_search`, `architecture`, `lessons`, `workspace_read`, `workspace_write`, `workspace_list`, `workspace_stat`, `workspace_delete`, `workspace_run`.
- `gfs_kain`
  - `overview`, `guide`, `search`, `examples`, `cli`, `doctor`, `run`, `validate_examples`.
- `gfs_validate`
  - `plan`, `run`, `typecheck`, `test_file`, `rust_test`, `smoke`, `smoke_screenshot`, `runtime_stack_quick`, `native_ring_benchmark`.

## Recipes

Check whether the app is healthy:

```json
{ "command": "status", "includeAttachProbe": true }
```

If status is unclear, run:

```json
{ "command": "doctor" }
```

Attach to the app:

```json
{ "command": "attach", "preferNative": true, "allowFallbackBrowser": true }
```

Inspect visible actions:

```json
{ "command": "actions" }
```

Invoke a visible action by stable action id:

```json
{ "command": "invoke_action", "target": { "actionId": "settings:open" } }
```

Capture visual proof:

```json
{ "command": "screenshot", "pathHint": "feature-proof", "includeImageData": false }
```

Inspect backend-native performance flow after code changes:

```json
{ "command": "flow", "limit": 40 }
```

Use that with `gfs_ui_snapshot`. It returns app status, recent git changes, frontend performance, native task graph policy/telemetry, preview streaming policy, host-event and telemetry ring pressure, native buffer pool, native byte-stream, GPU status, recent telemetry records, and agent-readable warning signals.

Probe WebView2 native ring throughput:

```json
{ "command": "native_ring_benchmark", "windowLabel": "main", "packets": 256, "packetBytes": 4096, "capacity": 4194304 }
```

Use that with `gfs_validate`. It posts a benchmark-scoped native ring to the target WebView and returns packet/byte/drop/timing telemetry.

Get current Kain guidance:

```json
{ "command": "overview" }
```

Use that with `gfs_kain`. It returns the canonical doc roots, quickstart/guide-map excerpts, and live `.cargo/bin/kain.exe` help/doctor output.

Read a Kain guide:

```json
{ "command": "guide", "path": "syntax-and-semantics/types.md" }
```

Search the Kain docs and FFI examples:

```json
{ "command": "search", "query": "import-crate", "roots": ["guides", "ffi_examples"], "limit": 40 }
```

List or inspect FFI examples:

```json
{ "command": "examples" }
```

```json
{ "command": "examples", "path": "c_ffi/beacon_math/README.md" }
```

Run the active local Kain CLI:

```json
{ "command": "cli", "args": ["build", "src-kain/guides/examples/00_hello_and_cli.kn", "-t", "rust", "-o", "generated/kain-proof/hello"] }
```

Validate the docs example ladder through the canonical validator:

```json
{ "command": "validate_examples", "path": "00_hello_and_cli.kn" }
```

Discover host methods:

```json
{ "category": "host_commands" }
```

Call a host method:

```json
{ "command": "call", "methodId": "selection.get_snapshot" }
```

Plan validation from changed files:

```json
{ "command": "plan" }
```

## Payloads

UI targets accept any of these keys:

```json
{ "selector": "[data-example]" }
```

```json
{ "role": "button", "name": "Save" }
```

```json
{ "actionId": "explorer.refresh" }
```

Prefer stable `actionId` or `agentId` when available. Use selectors for proof hooks and roles/names for accessible surfaces.

Host calls use:

```json
{ "command": "call", "methodId": "namespace.method", "payload": {}, "executionContext": {} }
```

Workspace reads and writes are repo-root scoped. Prefer Codex native shell/file tools for normal coding when available; use `gfs_code` workspace commands when another MCP client lacks those tools.

## Host Methods

Host methods stay inside the app/runtime schema. They should not become top-level MCP tools.

Use one of:

```json
{ "category": "host_commands" }
```

with `gfs_help`, or:

```json
{ "command": "schema" }
```

with `gfs_host`.

Then call:

```json
{ "command": "call", "methodId": "events.describe_topics" }
```

with `gfs_host`.

## Kain

Kain is private and not part of model pretraining. Treat `gfs_kain` as the first stop before editing or judging `.kn` code.

Truth order:

- live CLI output from `C:\Users\Admin\.cargo\bin\kain.exe`
- `src-kain/guides/quickstart.md`
- `src-kain/guides/README.md`
- focused guide files under `src-kain/guides/**`
- current smoke/proof lanes under `src-kain/ffi/examples/**`

Prefer `gfs_kain command=overview` before making assumptions. Use `guide` for one doc, `search` for concepts/errors, `examples` for FFI smoke surfaces, `doctor` for active binary truth, `cli` for explicit compiler commands, `run` for `.kn` files, and `validate_examples` for the canonical docs example validator.

## Validation

For MCP changes:

```json
{ "command": "typecheck", "target": "mcp" }
```

For repo TypeScript:

```json
{ "command": "typecheck", "target": "repo" }
```

For a focused file:

```json
{ "command": "test_file", "path": "src/test/example.test.tsx" }
```

For a live MCP proof:

```json
{ "command": "smoke" }
```

Use `gfs_validate command=plan` before running expensive checks.

## Troubleshooting

- If the app seems missing, call `gfs_app command=status` before probing ports manually.
- If attach fails, call `gfs_app command=doctor` and inspect startup phase plus log tail.
- If browser fallback attaches but host calls fail, use the native automation lane status in `gfs_app command=status`.
- If screenshots are blank, try `gfs_ui_capture command=native_window_screenshot` after `gfs_app command=windows`.
- If you need an extension-host capability, do not ask for a new MCP tool first. Discover host methods, then use `gfs_host command=call`.
- If a new automation capability is needed, add it to an existing router unless it deserves top-level model attention like this manual.
