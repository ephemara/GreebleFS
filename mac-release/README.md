# OverlayTerm Mac Build Kit

This folder is the handoff kit for building and packaging OverlayTerm on a Mac.

## Fast path

1. Unzip the repo on the Mac.
2. Open `mac-release`.
3. Double-click `build-overlayterm-macos.command`.
4. When it finishes, send the contents of `mac-release/output/<timestamped-folder>/`.

If macOS says the script is not executable after unzip, run:

`chmod +x mac-release/build-overlayterm-macos.command mac-release/package-macos.sh`

## What it does

- checks that it is running on macOS
- checks for Xcode Command Line Tools, Node/npm, and Rust/cargo
- installs JS dependencies
- runs the test suite
- builds the Tauri app bundle
- collects the `.app` and `.dmg` into `mac-release/output/...`

## Output

After a successful run, look in `mac-release/output/OverlayTerm-macOS-<timestamp>/`.

That folder is the one to hand off. It will contain:

- `OverlayTerm.app` if the app bundle was produced
- `OverlayTerm.dmg` if the installer disk image was produced
- `INSTALL-ON-MAC.txt`
- `build.log`

## If the Mac is missing prerequisites

The script will stop and print what is missing. The usual fixes are:

- Xcode Command Line Tools: `xcode-select --install`
- Homebrew Node: `brew install node`
- Rust: `curl https://sh.rustup.rs -sSf | sh`

## Notes

- This script must be run on a Mac. It cannot produce a working macOS app bundle from Windows.
- The build uses the repo's current Tauri config and icons, including the `.icns` app icon.
