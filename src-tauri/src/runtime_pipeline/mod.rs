//! Universal polyglot runtime pipeline.
//!
//! Generalizes the Python sidecar pattern into a shared system that hosts
//! `python-sidecar`, `go-native`, `go-js-wasm`, and `tinygo-wasm` packages
//! through a single manifest contract (`runtime.toml`).
//!
//! - `manifest`   — typed `runtime.toml` parser/normalizer.
//! - `discovery`  — root walking for builtin + managed-content runtimes.
//! - `cache`      — content-addressed compile/build cache keyed by id +
//!                  toolchain version + source signature + target + mode.
//! - `toolchain`  — Go/TinyGo/Python presence probing (best-effort, host-side).
//! - `sidecar`    — long-lived stdio JSON-lines child lifecycle.
//! - `command`    — short-lived `runtime_run_command` execution.
//! - `tui`        — routes a runtime into the existing terminal infra.
//! - `commands`   — Tauri/Specta surface (`runtime_*`).

pub mod cache;
pub mod command_runtime;
pub mod commands;
pub mod discovery;
pub mod driver;
pub mod extension_host;
pub mod manifest;
pub mod registry;
pub mod sidecar;
pub mod toolchain;
pub mod tui;

pub use cache::{compute_source_signature, CacheKeyParts, CompileCacheEntry, CompileCacheLayout};
pub use commands::*;
pub use driver::*;
pub use extension_host::*;
pub use manifest::{
    RuntimeCompiler, RuntimeKind, RuntimeManifest, RuntimePackagePermissions, RuntimePanelConfig,
    RuntimeSidecarConfig, RuntimeTuiConfig,
};
pub use registry::{RuntimeRegistry, RuntimeRegistryState};
