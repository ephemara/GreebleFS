#!/usr/bin/env bash
# Compiles a single GreebleFS Go runtime package into the host-supplied
# output path. Invoked by the Rust runtime pipeline (`runtime_prepare_package`)
# and reusable from the CLI.
#
# Required flags:
#   --runtime-id <id>
#   --module-dir <absolute path>
#   --entry <path or "."> — relative to module-dir
#   --compiler <go-native | go-js-wasm | tinygo-wasm>
#   --target <triple or js-wasm | tinygo-wasm | host>
#   --mode <release | debug>
#   --output <absolute artifact path>

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
source "${SCRIPT_DIR}/_common.sh"

RUNTIME_ID=""
MODULE_DIR=""
ENTRY="."
COMPILER=""
TARGET=""
MODE="release"
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runtime-id) RUNTIME_ID="$2"; shift 2 ;;
    --module-dir) MODULE_DIR="$2"; shift 2 ;;
    --entry) ENTRY="$2"; shift 2 ;;
    --compiler) COMPILER="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    *) greeblefs_go::log "unexpected argument: $1"; exit 2 ;;
  esac
done

for required in RUNTIME_ID MODULE_DIR COMPILER OUTPUT; do
  if [[ -z "${!required}" ]]; then
    greeblefs_go::log "missing required flag for --${required,,}"
    exit 2
  fi
done

MODULE_DIR="$(greeblefs_go::to_shell_path "${MODULE_DIR}")"
OUTPUT="$(greeblefs_go::to_shell_path "${OUTPUT}")"
ENTRY="$(greeblefs_go::to_shell_path "${ENTRY}")"

mkdir -p "$(dirname "${OUTPUT}")"

case "${COMPILER}" in
  go-native)
    if ! greeblefs_go::require_command go; then exit 3; fi
    BUILD_FLAGS=()
    if [[ "${MODE}" == "release" ]]; then
      BUILD_FLAGS+=(-trimpath -ldflags "-s -w")
    fi
    pushd "${MODULE_DIR}" >/dev/null
    GOWORK=off go build "${BUILD_FLAGS[@]}" -o "${OUTPUT}" "${ENTRY}"
    popd >/dev/null
    ;;
  go-js-wasm)
    if ! greeblefs_go::require_command go; then exit 3; fi
    BUILD_FLAGS=()
    if [[ "${MODE}" == "release" ]]; then
      BUILD_FLAGS+=(-trimpath -ldflags "-s -w")
    fi
    pushd "${MODULE_DIR}" >/dev/null
    GOOS=js GOARCH=wasm GOWORK=off go build "${BUILD_FLAGS[@]}" -o "${OUTPUT}" "${ENTRY}"
    popd >/dev/null
    ;;
  tinygo-wasm)
    if ! greeblefs_go::require_command tinygo; then exit 3; fi
    pushd "${MODULE_DIR}" >/dev/null
    if [[ "${MODE}" == "release" ]]; then
      tinygo build -o "${OUTPUT}" -target=wasm -opt=2 -no-debug "${ENTRY}"
    else
      tinygo build -o "${OUTPUT}" -target=wasm "${ENTRY}"
    fi
    popd >/dev/null
    ;;
  *)
    greeblefs_go::log "unsupported compiler: ${COMPILER}"
    exit 4
    ;;
esac

greeblefs_go::log "built ${RUNTIME_ID} (${COMPILER}/${TARGET}/${MODE}) -> ${OUTPUT}"
