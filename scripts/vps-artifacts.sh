#!/usr/bin/env bash
set -euo pipefail

overlayterm_vps_artifacts_root="${OVERLAYTERM_VPS_ARTIFACTS_ROOT:-$HOME/.cache/overlayterm-vps}"

mkdir -p \
  "$overlayterm_vps_artifacts_root/dist" \
  "$overlayterm_vps_artifacts_root/vite-cache" \
  "$overlayterm_vps_artifacts_root/coverage" \
  "$overlayterm_vps_artifacts_root/playwright" \
  "$overlayterm_vps_artifacts_root/npm-cache" \
  "$overlayterm_vps_artifacts_root/tmp" \
  "$overlayterm_vps_artifacts_root/cargo-target" \
  "$overlayterm_vps_artifacts_root/cargo-tests" \
  "$overlayterm_vps_artifacts_root/tauri-config"

export OVERLAYTERM_VPS_ARTIFACTS_ROOT="$overlayterm_vps_artifacts_root"
export OVERLAYTERM_VITE_OUT_DIR="${OVERLAYTERM_VITE_OUT_DIR:-$overlayterm_vps_artifacts_root/dist}"
export OVERLAYTERM_VITE_CACHE_DIR="${OVERLAYTERM_VITE_CACHE_DIR:-$overlayterm_vps_artifacts_root/vite-cache}"
export OVERLAYTERM_VITEST_COVERAGE_DIR="${OVERLAYTERM_VITEST_COVERAGE_DIR:-$overlayterm_vps_artifacts_root/coverage}"
export OVERLAYTERM_CARGO_TEST_TARGET_ROOT="${OVERLAYTERM_CARGO_TEST_TARGET_ROOT:-$overlayterm_vps_artifacts_root/cargo-tests}"
export OVERLAYTERM_TAURI_FRONTEND_DIST="${OVERLAYTERM_TAURI_FRONTEND_DIST:-$overlayterm_vps_artifacts_root/dist}"
export OVERLAYTERM_TAURI_CARGO_TARGET_DIR="${OVERLAYTERM_TAURI_CARGO_TARGET_DIR:-$overlayterm_vps_artifacts_root/cargo-target/tauri}"
export OVERLAYTERM_TAURI_CONFIG_DIR="${OVERLAYTERM_TAURI_CONFIG_DIR:-$overlayterm_vps_artifacts_root/tauri-config}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$overlayterm_vps_artifacts_root/playwright}"
export npm_config_cache="${npm_config_cache:-$overlayterm_vps_artifacts_root/npm-cache}"
export TMPDIR="${TMPDIR:-$overlayterm_vps_artifacts_root/tmp}"

