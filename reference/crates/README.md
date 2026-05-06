# Archived Crates

This folder holds code that used to sit under the live `crates/` tree but is not wired into the current desktop app graph.

These moves were made on 2026-05-05 after auditing `src-tauri` with `cargo metadata` and checking supported desktop targets.

## Archived Items

- `explorer/`
  - Legacy ULTACODE-style explorer backend/module bundle. It is not a Cargo crate and nothing in the current GreebleFS app references it.
- `greeblefs/`
  - Adoption/reference bundle extracted from `bevydcc`. Useful study material, but explicitly described as staging-only and not a direct dependency.
- `overlay-theme/`
  - Small wrapper crate around `overlay-contracts`. No active Rust code in the app imports it, so it no longer belongs in the live workspace.
- `ffmpeg-suite-rs/rust_ffplay/`
  - Dormant ffplay wrapper. The app uses `rust_ffmpeg` and `rust_ffprobe`, not the playback wrapper.
- `file-opening-linux/`
  - Linux open-with helper crate that is no longer referenced by `src-tauri/Cargo.toml` on any supported target.

## Rule

- If code here becomes live again, move it back under `crates/`, rewire the relevant Cargo manifests, and document the activation in `crates/README.md` plus `memory.md`.
