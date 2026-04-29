# Vendored Tauri Plugin Source

This folder is the source-control lane for Tauri plugin crates that GreebleFS needs to inspect, patch, fork, or own more tightly than a `crates.io` dependency allows.

Use this folder for Rust/Tauri plugin source such as `tauri-plugin-*` crates. Do not use it for GreebleFS packaged runtime plugins; those stay under `usr/plugins/`. Do not use it for app-owned native command modules; those stay under `src-tauri/src/` unless they are deliberately extracted into a reusable crate.

## Why This Lives Here

- `crates/` already owns repo-local Rust crates and vendored native substrates.
- `src-tauri/` should remain the app host that wires chosen capabilities together.
- `usr/plugins/` is runtime-authored content discovered by the app, not compile-time Rust source.
- `packages/` and `reference/` are intake/reference lanes, not the place for active Rust dependencies.

## Preferred Layout

```text
crates/tauri-plugins/
  tauri-plugin-source-index.toml
  tauri-plugin-example/
    Cargo.toml
    src/
    permissions/
    guest-js/
    integration-notes.md
```

Keep each upstream plugin in its own direct child folder named after the Rust crate when possible. If an upstream repo contains multiple crates, keep the upstream shape intact under one child folder and document the active crate paths in `tauri-plugin-source-index.toml`.

## Promotion Checklist

1. Drop or clone the plugin source into `crates/tauri-plugins/<plugin-crate-or-repo>/`.
2. Add an entry to `tauri-plugin-source-index.toml` with the upstream URL, revision, license, status, and active local crate path.
3. Add or update the plugin's `integration-notes.md` using `_template/integration-notes.md`.
4. Keep dormant source out of the Cargo workspace until GreebleFS actually builds it.
5. When activating a plugin, add its Rust crate to the root `Cargo.toml` workspace members and change `src-tauri/Cargo.toml` to a path dependency, for example:

```toml
tauri-plugin-example = { path = "../crates/tauri-plugins/tauri-plugin-example" }
```

6. Register the plugin in `src-tauri/src/lib.rs` with the rest of the Tauri builder setup.
7. Update `src-tauri/capabilities/default.json` for any plugin permissions.
8. If the plugin exposes guest JavaScript APIs, wrap those calls in a host-owned `src/runtime/*Backend.ts` module instead of importing the plugin API directly from random React surfaces.
9. Run the narrowest proof that covers the activation path, usually:

```powershell
cargo check --manifest-path src-tauri/Cargo.toml --quiet
```

Run `cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings` only when Rust command types or Specta-exported surfaces changed.

## Ownership Rules

- GreebleFS owns app orchestration, permissions, capabilities, runtime wrappers, settings exposure, and frontend UI.
- Vendored plugin source may own its internal implementation, but local patches must be documented in that plugin's `integration-notes.md`.
- If a plugin becomes heavily modified and no longer behaves like upstream, consider promoting it into a first-party crate under `crates/<capability-name>/`.
- Keep local path dependencies explicit; do not add wildcard workspace members for this folder.
