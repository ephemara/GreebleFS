#!/usr/bin/env bash
# Reports presence + versions of Go, TinyGo, and Python plus the pinned
# toolchain manifest. Mirrors the data the host's `runtime_get_toolchain_status`
# command returns so engineers can sanity-check from the terminal.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
source "${SCRIPT_DIR}/_common.sh"

print_tool() {
  local label="$1" cmd="$2" version_args="$3"
  if command -v "$cmd" >/dev/null 2>&1; then
    local version
    version="$($cmd $version_args 2>&1 | head -n 1)"
    printf '  %-8s %s\n' "$label" "$version"
  else
    printf '  %-8s (not installed)\n' "$label"
  fi
}

greeblefs_go::log "Toolchain status"
echo "Tools:"
print_tool "go" "go" "version"
print_tool "tinygo" "tinygo" "version"
print_tool "python" "python3" "--version"

echo
echo "Manifest:"
if [[ -f "${GREEBLEFS_GO_TOOLCHAIN_MANIFEST}" ]]; then
  printf '  pinned at %s\n' "${GREEBLEFS_GO_TOOLCHAIN_MANIFEST}"
else
  printf '  pinned manifest missing at %s\n' "${GREEBLEFS_GO_TOOLCHAIN_MANIFEST}"
fi

echo
echo "Workspace:"
if [[ -d "${GREEBLEFS_GO_WORKSPACE}" ]]; then
  printf '  go workspace: %s\n' "${GREEBLEFS_GO_WORKSPACE}"
  if [[ -f "${GREEBLEFS_GO_WORKSPACE}/go.work" ]]; then
    printf '  go.work present\n'
  else
    printf '  go.work missing!\n'
  fi
else
  printf '  go workspace missing at %s\n' "${GREEBLEFS_GO_WORKSPACE}"
fi
