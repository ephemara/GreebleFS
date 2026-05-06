#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_root="${XDG_STATE_HOME:-$HOME/.local/state}/greeblefs-reset/$timestamp"

targets=(
  "$HOME/.config/co.greeblefs.app"
  "$HOME/.config/co.overlayterm.app"
  "$HOME/.config/GreebleFS"
  "$HOME/.config/OverlayTerm"
  "$HOME/.local/share/co.greeblefs.app"
  "$HOME/.local/share/co.overlayterm.app"
)

confirmed=false
if [[ "${1:-}" == "--yes" ]]; then
  confirmed=true
elif [[ "${1:-}" != "" ]]; then
  echo "Unknown argument: $1" >&2
  echo "Usage: $0 [--yes]" >&2
  exit 1
fi

echo "GreebleFS local settings reset"
echo "Repo: $repo_root"
echo "Backup root: $backup_root"
echo
echo "Targets:"
for target in "${targets[@]}"; do
  echo "  $target"
done
echo

if [[ "$confirmed" != true ]]; then
  read -r -p "Move these paths into the backup folder and clear local state? [y/N] " reply
  case "$reply" in
    y|Y|yes|YES)
      ;;
    *)
      echo "Aborted."
      exit 0
      ;;
  esac
fi

mkdir -p "$backup_root"
cleared_count=0

for target in "${targets[@]}"; do
  if [[ ! -e "$target" ]]; then
    echo "skip  $target"
    continue
  fi

  destination="$backup_root${target}"
  mkdir -p "$(dirname "$destination")"
  mv "$target" "$destination"
  echo "moved $target -> $destination"
  cleared_count=$((cleared_count + 1))
done

echo
echo "Reset complete. Moved $cleared_count path(s) into:"
echo "  $backup_root"
echo
echo "Next step:"
echo "  Relaunch GreebleFS. The app will rebuild fresh local state on startup."
