#!/usr/bin/env bash
# Runs `go vet` + `gofmt -l` for every workspace module.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_common.sh
source "${SCRIPT_DIR}/_common.sh"

if ! greeblefs_go::require_command go; then exit 1; fi

failures=0
pushd "${GREEBLEFS_GO_WORKSPACE}" >/dev/null
while IFS= read -r module_dir; do
  if [[ -d "${module_dir}" ]]; then
    pushd "${module_dir}" >/dev/null
    greeblefs_go::log "go vet ./... in ${module_dir}"
    if ! greeblefs_go::run_go_command_for_module . go vet ./...; then
      failures=$((failures + 1))
    fi
    unformatted="$(greeblefs_go::list_unformatted_go_files . || true)"
    if [[ -n "${unformatted}" ]]; then
      greeblefs_go::log "gofmt found unformatted files in ${module_dir}:"
      printf '%s\n' "${unformatted}"
      failures=$((failures + 1))
    fi
    popd >/dev/null
  fi
done < <(greeblefs_go::workspace_modules)
popd >/dev/null

if [[ ${failures} -gt 0 ]]; then
  greeblefs_go::log "check failed with ${failures} issue group(s)"
  exit 1
fi
