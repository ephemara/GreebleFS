# Action Forge

First-party GreebleFS plugin panel for authoring explorer action packs directly into `usr/actions`.

## What It Ships

- Pack discovery from `usr/actions`
- New-pack and existing-pack action scaffolding
- Presets for PowerShell, Python, JavaScript, TypeScript, Bash, inline shell, Cargo, binary, and workflow launchers
- Live manifest/script/file previews before writing
- Draft persistence through plugin storage
- Direct host writes into the managed `usr/actions` lane

## Package Shape

```text
usr/plugins/greeblefs-action-forge/
├── extension.toml
├── index.tsx
├── templates.ts
└── README.md
```

## Validation

The fastest proof path for this plugin is:

```powershell
bunx esbuild usr/plugins/greeblefs-action-forge/index.tsx --bundle --platform=browser --format=esm --external:react --external:overlayterm-plugin --external:lucide-react --outfile=.tmp-action-forge-check.js
cargo run --manifest-path src-tauri/Cargo.toml --bin greeble -- ext inspect usr/plugins/greeblefs-action-forge --json
```
