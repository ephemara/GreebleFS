# Crates Inventory

`crates/` is the live Rust dependency surface for GreebleFS plus one explicit staging lane for vendored Tauri plugin source.

Run the audit before adding or deleting anything:

```powershell
node scripts/devtools/audit-crates.mjs
```

## Live App-Wired Crates

- `greeble-ipc-contracts/`
  - Shared IPC artifact and stream contracts used by `src-tauri/src/ipc_runtime/**`, `terminal.rs`, `python_sidecar.rs`, and related Specta exports.
- `overlay-contracts/`
  - Shared shell/theme/domain contracts consumed by `src-tauri/src/domain_commands.rs`, `specta_bindings.rs`, and LAN-share theme snapshots.
- `yazi-specta/`
  - Yazi-facing DTO and binding manifest layer consumed by `src-tauri/src/fs_commands.rs` and `specta_bindings.rs`.
- `vst-host/`
  - Native VST3 host/runtime bridge consumed by `src-tauri/src/audio_engine.rs`, `vst_commands.rs`, and `vst_host_runtime.rs`.
- `file-opening/`
  - Cross-platform open-with abstraction shared by the platform-specific crates.
- `file-opening-windows/`
  - Windows open-with implementation wired into the active Windows build.
- `ffmpeg-suite-rs/`
  - The app currently uses `ffmpeg-common`, `rust_ffmpeg`, and `rust_ffprobe`.
- `fileexplorer/`
  - Vendored Yazi substrate. The current app graph reaches the nested `yazi-*` crates that back explorer filesystem, scheduler, parser, config, plugin, and TTY flows.
  - The audit script still reports a dormant upstream subset inside this vendored workspace (`yazi-actor`, `yazi-build`, `yazi-cli`, `yazi-core`, `yazi-fm`, `yazi-packing`, `yazi-watcher`). Those were left in place for now because the current generated Yazi binding surface still enumerates them.

## Target-Specific But Still Wired

- `file-opening-macos/`
  - Not used on the current Windows host, but still wired for macOS builds.
- `macos/`
  - The `sd-desktop-macos` bridge crate. Keep it in `crates/` because `src-tauri/Cargo.toml` still references it for macOS.

## Staging Lane

- `tauri-plugins/`
  - This folder stays in `crates/` even when no plugin is active. It is the dedicated compile-time source lane for vendored `tauri-plugin-*` crates.

## Archived Reference Lane

- Dormant or study-only code belongs under `reference/crates/`, not in this live tree.
- That currently includes the archived `file-opening-linux/` crate plus the dormant top-level study bundles moved out of `crates/`.
- Current archived items are documented in `reference/crates/README.md`.
