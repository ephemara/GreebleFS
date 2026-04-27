#!/usr/bin/env bash
# Runs `go test ./...` for every workspace module. Used in CI and locally to
# guard the SDK + builtin runtimes.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
source "${SCRIPT_DIR}/_common.sh"

if ! greeblefs_go::require_command go; then exit 1; fi

pushd "${GREEBLEFS_GO_WORKSPACE}" >/dev/null
for module_dir in sdk/greeblefs-go builtin-runtimes/echo-sidecar builtin-runtimes/echo-command builtin-runtimes/sample-panel; do
  if [[ -d "${module_dir}" ]]; then
    pushd "${module_dir}" >/dev/null
    greeblefs_go::log "go test ./... in ${module_dir}"
    GOWORK=off go test ./... || exit $?
    popd >/dev/null
  fi
done
popd >/dev/null
