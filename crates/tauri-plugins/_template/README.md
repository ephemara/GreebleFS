# Tauri Plugin Import Template

This folder is not a Cargo crate. Use it as the minimum note shape when importing a new Tauri plugin into `crates/tauri-plugins/`.

For a new plugin:

1. Create `crates/tauri-plugins/<plugin-crate-or-repo>/`.
2. Copy or clone the upstream plugin source into that folder.
3. Copy `_template/integration-notes.md` into the plugin folder.
4. Fill out the notes before changing behavior.
5. Add the plugin to `tauri-plugin-source-index.toml`.

Do not activate the plugin in the Cargo workspace until the app actually needs to build it.
