#!/usr/bin/env bash
# Shared helpers for GreebleFS Go pipeline scripts.
# Exposes:
#   GREEBLEFS_REPO_ROOT
#   GREEBLEFS_GO_WORKSPACE
#   GREEBLEFS_GO_TOOLCHAIN_MANIFEST
#   greeblefs_go::log
#   greeblefs_go::require_command
#   greeblefs_go::host_target
#   greeblefs_go::to_shell_path
#   greeblefs_go::workspace_modules
#   greeblefs_go::run_go_command_for_module
#   greeblefs_go::list_unformatted_go_files

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

greeblefs_go::is_windows_bash() {
  local kernel
  kernel="$(uname -s 2>/dev/null || echo unknown)"
  [[ "${kernel}" == MINGW* || "${kernel}" == MSYS* || "${kernel}" == CYGWIN* ]]
}

greeblefs_go::strip_windows_verbatim_prefix() {
  local raw_path="${1:-}"
  if [[ "${raw_path}" == \\\\?\UNC\\* ]]; then
    printf '\\\\%s' "${raw_path#\\\\?\\UNC\\}"
    return 0
  fi
  printf '%s' "${raw_path#\\\\?\\}"
}

greeblefs_go::to_shell_path() {
  local raw_path="${1:-}"
  if [[ -z "${raw_path}" ]]; then
    printf '%s' ""
    return 0
  fi

  local normalized_path
  normalized_path="$(greeblefs_go::strip_windows_verbatim_prefix "${raw_path}")"

  if command -v cygpath >/dev/null 2>&1; then
    case "${normalized_path}" in
      [A-Za-z]:[\\/]*|\\\\*|//*)
        cygpath -u "${normalized_path}"
        return 0
        ;;
    esac
  fi

  if greeblefs_go::is_windows_bash; then
    case "${normalized_path}" in
      [A-Za-z]:[\\/]*)
        local drive_letter="${normalized_path:0:1}"
        local remainder="${normalized_path:2}"
        remainder="${remainder//\\//}"
        remainder="${remainder#/}"
        printf '/%s/%s' "$(printf '%s' "${drive_letter}" | tr '[:upper:]' '[:lower:]')" "${remainder}"
        return 0
        ;;
    esac
  fi

  printf '%s' "${normalized_path}"
}

greeblefs_go::workspace_modules() {
  local workspace_file="${GREEBLEFS_GO_WORKSPACE}/go.work"
  if [[ ! -f "${workspace_file}" ]]; then
    greeblefs_go::log "go workspace manifest missing at ${workspace_file}"
    return 1
  fi

  awk '
    BEGIN { in_use_block = 0 }
    /^[[:space:]]*use[[:space:]]*\(/ {
      in_use_block = 1
      next
    }
    in_use_block && /^[[:space:]]*\)/ {
      in_use_block = 0
      next
    }
    in_use_block {
      line = $0
      sub(/\/\/.*$/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      sub(/^\.\//, "", line)
      if (line != "") {
        print line
      }
      next
    }
    /^[[:space:]]*use[[:space:]]+\.[^[:space:]]*/ {
      line = $0
      sub(/^[[:space:]]*use[[:space:]]+/, "", line)
      sub(/\/\/.*$/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      sub(/^\.\//, "", line)
      if (line != "") {
        print line
      }
    }
  ' "${workspace_file}"
}

greeblefs_go::module_runtime_compiler() {
  local module_dir="${1:-.}"
  local manifest_path="${module_dir}/runtime.toml"
  if [[ ! -f "${manifest_path}" ]]; then
    printf '%s' ""
    return 0
  fi

  awk -F '=' '
    /^[[:space:]]*compiler[[:space:]]*=/ {
      value = $2
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^"/, "", value)
      gsub(/"$/, "", value)
      print value
      exit
    }
  ' "${manifest_path}"
}

greeblefs_go::run_go_command_for_module() {
  local module_dir="${1:-.}"
  shift
  local compiler
  compiler="$(greeblefs_go::module_runtime_compiler "${module_dir}")"

  case "${compiler}" in
    go-js-wasm|tinygo-wasm)
      GOWORK=off GOOS=js GOARCH=wasm "$@"
      ;;
    *)
      GOWORK=off "$@"
      ;;
  esac
}

greeblefs_go::list_unformatted_go_files() {
  local search_root="${1:-.}"
  local restore_globstar restore_nullglob
  restore_globstar="$(shopt -p globstar || true)"
  restore_nullglob="$(shopt -p nullglob || true)"
  shopt -s globstar nullglob
  local go_file
  for go_file in "${search_root}"/**/*.go; do
    local normalized_current formatted_output
    normalized_current="$(mktemp)"
    formatted_output="$(mktemp)"

    tr -d '\r' < "${go_file}" > "${normalized_current}"
    gofmt "${go_file}" > "${formatted_output}"

    if ! cmp -s "${normalized_current}" "${formatted_output}"; then
      printf '%s\n' "${go_file#./}"
    fi

    rm -f "${normalized_current}" "${formatted_output}"
  done
  eval "${restore_globstar}"
  eval "${restore_nullglob}"
}
