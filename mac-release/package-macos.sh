#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_ROOT="$SCRIPT_DIR/output"
TIMESTAMP="$(date +"%Y-%m-%d_%H-%M-%S")"
STAGE_DIR="$OUTPUT_ROOT/OverlayTerm-macOS-$TIMESTAMP"
LOG_FILE="$STAGE_DIR/build.log"

mkdir -p "$STAGE_DIR"

exec > >(tee "$LOG_FILE") 2>&1

fail() {
  echo ""
  echo "[overlayterm-mac] $1"
  exit 1
}

need_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Missing '$cmd'. $hint"
  fi
}

copy_if_exists() {
  local source_path="$1"
  if [[ -e "$source_path" ]]; then
    cp -R "$source_path" "$STAGE_DIR/"
  fi
}

echo "[overlayterm-mac] Starting macOS packaging run..."
echo "[overlayterm-mac] Repo root: $REPO_ROOT"
echo "[overlayterm-mac] Output: $STAGE_DIR"

[[ "$(uname -s)" == "Darwin" ]] || fail "This script must be run on macOS."

if ! xcode-select -p >/dev/null 2>&1; then
  fail "Xcode Command Line Tools are not installed. Run: xcode-select --install"
fi

need_cmd node "Install Node.js first. Example: brew install node"
need_cmd npm "Install npm/Node.js first. Example: brew install node"
need_cmd cargo "Install Rust first. Example: curl https://sh.rustup.rs -sSf | sh"

cd "$REPO_ROOT"

if [[ -f package-lock.json ]]; then
  echo "[overlayterm-mac] Installing dependencies with npm ci..."
  npm ci
else
  echo "[overlayterm-mac] Installing dependencies with npm install..."
  npm install
fi

echo "[overlayterm-mac] Running tests..."
npm test -- --run

echo "[overlayterm-mac] Building Tauri macOS bundle..."
npm run tauri -- build

BUNDLE_ROOT="$REPO_ROOT/src-tauri/target/release/bundle"

copy_if_exists "$BUNDLE_ROOT/macos/OverlayTerm.app"
copy_if_exists "$BUNDLE_ROOT/dmg/OverlayTerm_0.1.0_aarch64.dmg"
copy_if_exists "$BUNDLE_ROOT/dmg/OverlayTerm_0.1.0_x64.dmg"

if compgen -G "$BUNDLE_ROOT/dmg/*.dmg" > /dev/null; then
  while IFS= read -r dmg_file; do
    copy_if_exists "$dmg_file"
  done < <(find "$BUNDLE_ROOT/dmg" -maxdepth 1 -type f -name "*.dmg")
fi

if compgen -G "$BUNDLE_ROOT/macos/*.app" > /dev/null; then
  while IFS= read -r app_bundle; do
    copy_if_exists "$app_bundle"
  done < <(find "$BUNDLE_ROOT/macos" -maxdepth 1 -type d -name "*.app")
fi

cat > "$STAGE_DIR/INSTALL-ON-MAC.txt" <<'EOF'
OverlayTerm macOS package output

What to use:
- If there is a .dmg here, open that first and drag OverlayTerm into Applications.
- If there is only an .app here, drag the app into Applications manually.

If macOS warns that the app is from an unidentified developer:
1. Move the app to Applications.
2. Control-click the app and choose Open.
3. Click Open again in the confirmation dialog.

Build note:
- This package was produced locally from the OverlayTerm source tree with the mac-release packaging script.
EOF

echo ""
echo "[overlayterm-mac] Done."
echo "[overlayterm-mac] Packaged files are in: $STAGE_DIR"
