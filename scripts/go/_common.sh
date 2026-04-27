#!/usr/bin/env bash
# Shared helpers for GreebleFS Go pipeline scripts.
# Exposes:
#   GREEBLEFS_REPO_ROOT
#   GREEBLEFS_GO_WORKSPACE
#   GREEBLEFS_GO_TOOLCHAIN_MANIFEST
#   greeblefs_go::log
#   greeblefs_go::require_command
#   greeblefs_go::host_target

set -euo pipefail

if [[ -n "${GREEBLEFS_GO_COMMON_LOADED:-}" ]]; then
  return 0
fi
GREEBLEFS_GO_COMMON_LOADED=1

GREEBLEFS_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GREEBLEFS_GO_WORKSPACE="${GREEBLEFS_REPO_ROOT}/src-go"
GREEBLEFS_GO_TOOLCHAIN_MANIFEST="${GREEBLEFS_REPO_ROOT}/toolchains/go/toolchains.json"

greeblefs_go::log() {
  printf '[greeblefs/go] %s\n' "$*" >&2
}

greeblefs_go::require_command() {
  local command="$1"
  if ! command -v "$command" >/dev/null 2>&1; then
    greeblefs_go::log "missing required command: $command"
    return 1
  fi
}

greeblefs_go::host_target() {
  local kernel
  kernel="$(uname -s 2>/dev/null || echo unknown)"
  local arch
  arch="$(uname -m 2>/dev/null || echo unknown)"
  printf '%s-%s' "$kernel" "$arch"
}
