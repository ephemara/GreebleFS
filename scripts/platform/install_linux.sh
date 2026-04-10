#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "======================================"
echo " Greeble Linux Installer"
echo "======================================"
echo ""

# 1. Install System Dependencies
echo "[1/4] Installing Required System Dependencies..."
sudo apt update
sudo apt install -y curl wget file build-essential \
  libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  libpipewire-0.3-dev \
  clang libclang-dev libgbm-dev

# 2. Install NPM Dependencies
echo "[2/4] Installing Project Node Dependencies..."
npm install

# 3. Sync Stock Icons
echo "[3/4] Syncing Canonical Icon Catalog..."
npm run icons:folders

# 4. Build Tauri App
echo "[4/4] Building Tauri Executable (This may take a few minutes)..."
npm run tauri build

# 5. Global Install
echo "Installing to ~/.local/bin..."
mkdir -p ~/.local/bin
TARGET_DIR="$(
  cargo metadata --manifest-path src-tauri/Cargo.toml --no-deps --format-version 1 \
    | node -e 'let input = ""; process.stdin.on("data", (chunk) => input += chunk); process.stdin.on("end", () => process.stdout.write(JSON.parse(input).target_directory));'
)"
cp "$TARGET_DIR/release/greeble" ~/.local/bin/

echo "Creating Desktop Entry..."
mkdir -p ~/.local/share/applications/
cat <<EOF > ~/.local/share/applications/greeble.desktop
[Desktop Entry]
Name=Greeble
Exec=$HOME/.local/bin/greeble
Icon=utilities-terminal
Type=Application
Categories=Utility;TerminalEmulator;Development;
Terminal=false
EOF

echo "======================================"
echo "Installation Complete! 🎉"
echo "======================================"
echo "You can now launch Greeble by:"
echo "1. Opening it from your application menu."
echo "2. Running '~/.local/bin/greeble' in your terminal."
echo "   (Make sure ~/.local/bin is in your PATH)"
