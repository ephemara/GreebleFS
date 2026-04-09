#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install_root="${OVERLAYTERM_INSTALL_ROOT:-$HOME/.local/opt/overlayterm}"
bin_dir="${XDG_BIN_HOME:-$HOME/.local/bin}"
data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
app_local_data_root="$data_home/co.overlayterm.app"
applications_dir="$data_home/applications"
icons_dir="$data_home/icons/hicolor/128x128/apps"
binary_source="$repo_root/src-tauri/target/release/greeble"
binary_target="$install_root/overlayterm"
desktop_entry_path="$applications_dir/co.overlayterm.app.desktop"
icon_target="$icons_dir/overlayterm.png"
version_file="$install_root/VERSION"
launch_after_install=false

for arg in "$@"; do
  case "$arg" in
    --launch)
      launch_after_install=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This installer only supports Linux." >&2
  exit 1
fi

cd "$repo_root"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to build OverlayTerm." >&2
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo is required to build OverlayTerm." >&2
  exit 1
fi

echo "[1/5] Syncing canonical icons..."
bun scripts/sync-canonical-icons.mjs

echo "[2/5] Regenerating Tauri bindings..."
cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings

echo "[3/5] Building frontend bundle..."
bunx vite build

echo "[4/5] Building native release binary..."
cargo build --manifest-path src-tauri/Cargo.toml --release

if [[ ! -x "$binary_source" ]]; then
  echo "Release binary was not produced at $binary_source" >&2
  exit 1
fi

echo "[5/5] Installing into $install_root ..."
mkdir -p "$install_root" "$bin_dir" "$applications_dir" "$icons_dir" "$app_local_data_root"
install -Dm755 "$binary_source" "$binary_target"
install -Dm644 "$repo_root/src-tauri/icons/128x128.png" "$icon_target"
version="$(rg --no-filename '^  "version": ' package.json | sed -E 's/^  "version": "([^"]+)",$/\1/' | head -n 1)"
printf '%s\n' "${version:-0.0.0}" > "$version_file"
ln -sfn "$binary_target" "$bin_dir/overlayterm"

for content_dir in plugins themes shaders animations; do
  source_dir="$repo_root/$content_dir"
  target_dir="$app_local_data_root/$content_dir"

  if [[ -d "$source_dir" ]]; then
    mkdir -p "$target_dir"
    cp -a --update=none "$source_dir"/. "$target_dir"/
  fi
done

cat > "$desktop_entry_path" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=OverlayTerm
Comment=Greeble command center
Exec=$binary_target
Icon=overlayterm
Terminal=false
Categories=Development;Utility;FileManager;
StartupWMClass=OverlayTerm
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$applications_dir" >/dev/null 2>&1 || true
fi

echo "Installed."
echo "Binary: $binary_target"
echo "CLI link: $bin_dir/overlayterm"
echo "Desktop entry: $desktop_entry_path"
echo "Icon: $icon_target"
echo "Managed content root: $app_local_data_root"

if [[ "$launch_after_install" == true ]]; then
  echo "Launching installed release binary..."
  nohup "$binary_target" >/tmp/overlayterm-release.log 2>&1 &
  disown || true
fi
