#!/usr/bin/env bash
# Runs `go test ./...` for every workspace module. Used in CI and locally to
# guard the SDK + builtin runtimes.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
source "${SCRIPT_DIR}/_common.sh"

if ! greeblefs_go::require_command go; then exit 1; fi

pushd "${GREEBLEFS_GO_WORKSPACE}" >/dev/null
while IFS= read -r module_dir; do
  if [[ -d "${module_dir}" ]]; then
    pushd "${module_dir}" >/dev/null
    greeblefs_go::log "go test ./... in ${module_dir}"
    greeblefs_go::run_go_command_for_module . go test ./... || exit $?
    popd >/dev/null
  fi
done < <(greeblefs_go::workspace_modules)
popd >/dev/null
