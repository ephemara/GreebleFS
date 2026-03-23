#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/vps-artifacts.sh"

original_repo_root="$(pwd -P)"
mounted_windows_root="/home/azureuser/Desktop/M on Player (NoMachine)"
exec_repo_root="${OVERLAYTERM_VPS_EXEC_ROOT:-$original_repo_root}"

if [[ ! -d "$exec_repo_root" || ! -f "$exec_repo_root/package.json" ]]; then
  echo "OVERLAYTERM_VPS_EXEC_ROOT must point to a repo root with package.json: $exec_repo_root" >&2
  exit 1
fi

if [[ -z "${OVERLAYTERM_VPS_EXEC_ROOT:-}" && ( "$original_repo_root" == "$mounted_windows_root" || "$original_repo_root" == "$mounted_windows_root"/* ) ]]; then
  cat >&2 <<EOF
Mounted Windows workspace detected at:
  $original_repo_root

Node-based VPS validator commands are currently not deterministic from this filesystem and can hang during module startup.
Set OVERLAYTERM_VPS_EXEC_ROOT to a VPS-local OverlayTerm checkout or worktree before running build/test/browser commands.
EOF
  exit 1
fi

export OVERLAYTERM_VPS_SOURCE_ROOT="$original_repo_root"

cd "$exec_repo_root"
node "$script_dir/check-vps-node-runtime.mjs"

exec "$@"
