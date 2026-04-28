#!/usr/bin/env bash
# Bootstraps the GreebleFS Go pipeline by:
#   1. Verifying Go (and optionally TinyGo) are present on PATH.
#   2. Copying the GOROOT-bundled `wasm_exec.js` into `public/runtime/` so
#      the GoPanelHost loader has a stable URL.
#   3. Pre-tidying every workspace module so downstream builds skip a slow
#      first-run module resolution step.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
source "${SCRIPT_DIR}/_common.sh"

if ! greeblefs_go::require_command go; then
  greeblefs_go::log "install Go from https://go.dev/dl/ — see toolchains/go/toolchains.json for the pinned versions."
  exit 1
fi

GOROOT="$(go env GOROOT)"
if [[ -z "${GOROOT}" ]]; then
  greeblefs_go::log "go env GOROOT returned empty; aborting"
  exit 1
fi

WASM_EXEC_SRC="${GOROOT}/misc/wasm/wasm_exec.js"
if [[ ! -f "${WASM_EXEC_SRC}" ]]; then
  greeblefs_go::log "wasm_exec.js not found at ${WASM_EXEC_SRC}; cannot install for GoPanelHost"
else
  WASM_EXEC_DEST="${GREEBLEFS_REPO_ROOT}/public/runtime/wasm_exec.js"
  mkdir -p "$(dirname "${WASM_EXEC_DEST}")"
  cp "${WASM_EXEC_SRC}" "${WASM_EXEC_DEST}"
  greeblefs_go::log "installed wasm_exec.js -> public/runtime/wasm_exec.js"
fi

if ! command -v tinygo >/dev/null 2>&1; then
  greeblefs_go::log "tinygo not found on PATH (optional). wasm-worker / size-optimised wasm-panel builds will fall back to standard Go."
fi

greeblefs_go::log "tidying workspace modules"
pushd "${GREEBLEFS_GO_WORKSPACE}" >/dev/null
for module_dir in sdk/greeblefs-go builtin-runtimes/echo-sidecar builtin-runtimes/echo-command builtin-runtimes/sample-panel builtin-runtimes/go-pty-panel; do
  if [[ -d "${module_dir}" ]]; then
    pushd "${module_dir}" >/dev/null
    GOWORK=off go mod tidy >/dev/null 2>&1 || greeblefs_go::log "go mod tidy failed for ${module_dir}; continuing"
    popd >/dev/null
  fi
done
popd >/dev/null

greeblefs_go::log "bootstrap complete"
