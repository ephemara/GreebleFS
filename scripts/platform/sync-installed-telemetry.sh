#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
target_dir="$repo_root/.telemetry"

bin_home="${XDG_BIN_HOME:-$HOME/.local/bin}"
state_home="${XDG_STATE_HOME:-$HOME/.local/state}"
data_home="${XDG_DATA_HOME:-$HOME/.local/share}"

declare -a binary_candidates=(
  "$bin_home/greeblefs"
  "$bin_home/overlayterm"
)

declare -a install_roots=()
for binary_path in "${binary_candidates[@]}"; do
  if [[ -e "$binary_path" ]]; then
    resolved_binary_path="$(readlink -f "$binary_path" 2>/dev/null || true)"
    if [[ -n "$resolved_binary_path" ]]; then
      install_roots+=("$(dirname "$resolved_binary_path")")
    fi
  fi
done

declare -a telemetry_candidates=(
  "$state_home/co.greeblefs.app/logs/.telemetry"
  "$state_home/co.greeblefs.app/logs/telemetry"
  "$data_home/co.greeblefs.app/logs/.telemetry"
  "$data_home/co.greeblefs.app/logs/telemetry"
  "$state_home/co.overlayterm.app/logs/.telemetry"
  "$state_home/co.overlayterm.app/logs/telemetry"
  "$data_home/co.overlayterm.app/logs/.telemetry"
  "$data_home/co.overlayterm.app/logs/telemetry"
)

for install_root in "${install_roots[@]}"; do
  telemetry_candidates+=(
    "$install_root/.telemetry"
    "$install_root/telemetry"
    "$install_root/logs/.telemetry"
    "$install_root/logs/telemetry"
    "$install_root/../.telemetry"
    "$install_root/../telemetry"
  )
done

declare -A seen_dirs=()
declare -a existing_sources=()

for candidate in "${telemetry_candidates[@]}"; do
  normalized_candidate="$(readlink -f "$candidate" 2>/dev/null || true)"
  if [[ -z "$normalized_candidate" || ! -d "$normalized_candidate" ]]; then
    continue
  fi
  if [[ -n "${seen_dirs[$normalized_candidate]:-}" ]]; then
    continue
  fi
  seen_dirs["$normalized_candidate"]=1
  existing_sources+=("$normalized_candidate")
done

if [[ ${#existing_sources[@]} -eq 0 ]]; then
  {
    echo "No installed telemetry directory was found."
    echo "Checked candidates:"
    printf '  %s\n' "${telemetry_candidates[@]}"
  } >&2
  exit 1
fi

mkdir -p "$target_dir"

if command -v rsync >/dev/null 2>&1; then
  for source_dir in "${existing_sources[@]}"; do
    echo "Syncing telemetry from $source_dir"
    rsync -a "$source_dir"/ "$target_dir"/
  done
else
  for source_dir in "${existing_sources[@]}"; do
    echo "Syncing telemetry from $source_dir"
    cp -a "$source_dir"/. "$target_dir"/
  done
fi

echo "Telemetry copied into $target_dir"
