#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/vps-artifacts.sh"
node "$script_dir/check-vps-node-runtime.mjs"

exec "$@"
