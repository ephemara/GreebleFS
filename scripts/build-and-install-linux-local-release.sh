#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install_root="${GREEBLEFS_INSTALL_ROOT:-${OVERLAYTERM_INSTALL_ROOT:-$HOME/.local/opt/greeblefs}}"
legacy_install_root="${OVERLAYTERM_INSTALL_ROOT:-$HOME/.local/opt/overlayterm}"
bin_dir="${XDG_BIN_HOME:-$HOME/.local/bin}"
data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
app_local_data_root="$data_home/co.greeblefs.app"
applications_dir="$data_home/applications"
icons_dir="$data_home/icons/hicolor/128x128/apps"
binary_target="$install_root/greeblefs"
legacy_binary_target="$legacy_install_root/overlayterm"
cli_link_path="$bin_dir/greeblefs"
legacy_cli_link_path="$bin_dir/overlayterm"
desktop_entry_path="$applications_dir/co.greeblefs.app.desktop"
legacy_desktop_entry_path="$applications_dir/co.overlayterm.app.desktop"
icon_target="$icons_dir/greeblefs.png"
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
  echo "bun is required to build GreebleFS." >&2
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo is required to build GreebleFS." >&2
  exit 1
fi

cargo_target_dir="$(
  cargo metadata --manifest-path "$repo_root/src-tauri/Cargo.toml" --no-deps --format-version 1 \
    | bun -e 'const metadata = JSON.parse(await Bun.stdin.text()); process.stdout.write(metadata.target_directory);'
)"
binary_source="$cargo_target_dir/release/greeblefs"

echo "[1/5] Syncing canonical icons..."
bun scripts/sync-canonical-icons.mjs

echo "[2/5] Regenerating Tauri bindings..."
node scripts/run-export-bindings.mjs

echo "[3/5] Building frontend bundle..."
bunx vite build

echo "[4/5] Building native release binary..."
cargo build --manifest-path src-tauri/Cargo.toml --release

if [[ ! -x "$binary_source" ]]; then
  echo "Release binary was not produced at $binary_source" >&2
  exit 1
fi

echo "[5/5] Installing into $install_root ..."
mkdir -p "$install_root" "$legacy_install_root" "$bin_dir" "$applications_dir" "$icons_dir" "$app_local_data_root"
install -Dm755 "$binary_source" "$binary_target"
install -Dm644 "$repo_root/src-tauri/icons/128x128.png" "$icon_target"
version="$(rg --no-filename '^  "version": ' package.json | sed -E 's/^  "version": "([^"]+)",$/\1/' | head -n 1)"
printf '%s\n' "${version:-0.0.0}" > "$version_file"
ln -sfn "$binary_target" "$cli_link_path"
ln -sfn "$binary_target" "$legacy_cli_link_path"
ln -sfn "$binary_target" "$legacy_binary_target"

for content_dir in plugins themes shaders animations runtimes; do
  source_dir="$repo_root/$content_dir"
  target_dir="$app_local_data_root/$content_dir"

  if [[ -d "$source_dir" ]]; then
    mkdir -p "$target_dir"
    cp -a --update=none "$source_dir"/. "$target_dir"/
  fi
done

# Universal runtime pipeline: copy the Go SDK + builtin runtimes so the
# release host can compile authored content lazily even when the workspace
# `src-go/` is not on disk. Toolchain bootstrap stays opt-in via
# `bun run go:bootstrap` so we never reach for the network during install.
if [[ -d "$repo_root/src-go" ]]; then
  mkdir -p "$app_local_data_root/src-go"
  cp -a --update=none "$repo_root/src-go"/. "$app_local_data_root/src-go"/
fi
if [[ -d "$repo_root/toolchains" ]]; then
  mkdir -p "$app_local_data_root/toolchains"
  cp -a --update=none "$repo_root/toolchains"/. "$app_local_data_root/toolchains"/
fi
# scripts/go/ contains the host-invoked build/test/check entrypoints. Without
# this copy, the installed runtime cannot lazily compile managed Go runtimes
# because `commands.rs::resolve_go_build_script_path` can only find them under
# the app-local root or the GREEBLEFS_GO_BUILD_SCRIPT env override.
if [[ -d "$repo_root/scripts/go" ]]; then
  mkdir -p "$app_local_data_root/scripts/go"
  cp -a --update=none "$repo_root/scripts/go"/. "$app_local_data_root/scripts/go"/
  chmod +x "$app_local_data_root/scripts/go"/*.sh 2>/dev/null || true
fi

cat > "$desktop_entry_path" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=GreebleFS
Comment=GreebleFS desktop workbench
Exec=$binary_target
Icon=greeblefs
Terminal=false
Categories=Development;Utility;FileManager;
StartupWMClass=GreebleFS
EOF

cat > "$legacy_desktop_entry_path" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=OverlayTerm
Comment=Legacy launcher for GreebleFS
Exec=$binary_target
Icon=greeblefs
Terminal=false
Categories=Development;Utility;FileManager;
StartupWMClass=GreebleFS
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$applications_dir" >/dev/null 2>&1 || true
fi

echo "Installed."
echo "Binary: $binary_target"
echo "CLI link: $cli_link_path"
echo "Legacy CLI link: $legacy_cli_link_path"
echo "Desktop entry: $desktop_entry_path"
echo "Legacy desktop entry: $legacy_desktop_entry_path"
echo "Icon: $icon_target"
echo "Managed content root: $app_local_data_root"

if [[ "$launch_after_install" == true ]]; then
  echo "Launching installed release binary..."
  nohup "$binary_target" >/tmp/greeblefs-release.log 2>&1 &
  disown || true
fi
