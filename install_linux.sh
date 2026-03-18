#!/bin/bash
set -e

echo "======================================"
echo " OverlayTerm Linux Installer"
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

# 3. Build Icons
echo "[3/4] Building Icons Manifest..."
mkdir -p public/icons
# Copy all generated SVG icon tools over and rename them to match the expected format
if [ -d "output/folder-icon-library" ]; then
    find output/folder-icon-library -name "folder-*.svg" -exec sh -c 'cp "$1" "public/icons/folder_custom_$(basename "$1" | sed "s/^folder-//")"' _ {} \;
    find output/folder-icon-library -name "generic-*.svg" -exec sh -c 'cp "$1" "public/icons/folder_generic_$(basename "$1" | sed "s/^generic-//")"' _ {} \;
else
    echo "Warning: output/folder-icon-library not found. Falling back to python script..."
    python3 generate_folder_icons.py || true
    find output/folder-icon-library -name "folder-*.svg" -exec sh -c 'cp "$1" "public/icons/folder_custom_$(basename "$1" | sed "s/^folder-//")"' _ {} \;
    find output/folder-icon-library -name "generic-*.svg" -exec sh -c 'cp "$1" "public/icons/folder_generic_$(basename "$1" | sed "s/^generic-//")"' _ {} \;
fi

npm run icons:folders

# 4. Build Tauri App
echo "[4/4] Building Tauri Executable (This may take a few minutes)..."
npm run tauri build

# 5. Global Install
echo "Installing to ~/.local/bin..."
mkdir -p ~/.local/bin
cp src-tauri/target/release/overlayterm ~/.local/bin/

echo "Creating Desktop Entry..."
mkdir -p ~/.local/share/applications/
cat <<EOF > ~/.local/share/applications/overlayterm.desktop
[Desktop Entry]
Name=OverlayTerm
Exec=$HOME/.local/bin/overlayterm
Icon=utilities-terminal
Type=Application
Categories=Utility;TerminalEmulator;Development;
Terminal=false
EOF

echo "======================================"
echo "Installation Complete! 🎉"
echo "======================================"
echo "You can now launch OverlayTerm by:"
echo "1. Opening it from your application menu."
echo "2. Running '~/.local/bin/overlayterm' in your terminal."
echo "   (Make sure ~/.local/bin is in your PATH)"
