# GreebleFS Plugin & Content System (`usr/`)

> Companion to `06-EXTENSION-API.md` (the contract) and
> `02-THEMING-SYSTEM.md` (theme deep-dive). This document describes content
> delivery: the `usr/` tree as **legacy input** plus the harness registries
> that actually apply it. New work targets the API; JSON packs keep working
> as bridge-fed data.

GreebleFS ships a managed content root (`usr/`) — plugins, themes, icon
packs, wallpapers, profiles — that is bundled with the installer,
bootstrapped to a writable directory on first run, and hot-reloaded while
the app runs. Think of it as a tiny distro userland inside the app.

## Layout

```
usr/
  manifest.json          # bootstrap map: what ships, where it lands
  plugins/               # workbench + tool plugins (extension.toml + index.tsx)
  plugins-kain/          # Kain-language plugin examples (ffi, converters)
  themes/                # theme playlists (theme.json -> child lanes)
  appearance-packs/      # color/typography/spacing/radius tokens
  theme-engines/         # recipe -> CSS compilers
  theme-recipes/         # explorer/layout/mobile/navigation/presentation/…
  icon-themes/           # icon packs (zen, blueprint, toon-icons, …)
  top-bars/ wallpapers/ shaders/ sound-packs/ animations/
  interaction-motion/    # motion packs
  profiles/              # default, minimal-low-motion, shared, variants.json
  packages/ actions/ domain/ explorer-views/ explorer-widgets/
  layout-dynamics/ lookdev-presets/
```

## Bootstrap: bundled → managed root

`usr/manifest.json` declares every lane: `bundled`, `bootstrapToManagedRoot`,
and `profileMode` (`shared-root` vs `profile-overlay`). On launch the Rust
backend (`src-tauri/src/usr.rs`, `bootstrap_usr_content`) copies the bundled
tree into the writable managed root — **copy-missing only**:

- Files present in the bundle but missing on disk → copied in.
- Files you edited on disk → **never overwritten**.
- Files *deleted* from a newer bundle → **never deleted on disk**.

Consequences worth knowing:

1. Upgrades can only *add* content. If a release removes or renames a pack,
   the old copy lingers in your managed root until you delete it by hand.
2. If your managed root predates a root migration (e.g. v0.2.2 "Usr Root
   Honored" moved lanes under the writable root), the scanner reads the
   **new** location — old packs sit orphaned in the old directory. When
   themes "stop working" after an update, check for packs in the wrong root
   first (this exact failure deleted every theme pack from the catalog with
   zero errors — loaders fall back silently).

Managed-root overrides: env vars per lane (`..._PLUGINS`, `..._THEMES`,
see `manifest.json` `envVarSuffix`), plus a source-root override for dev.

## Authoring a plugin (today's format)

Each plugin is a folder with an `extension.toml` manifest and a TSX entry:

```toml
# usr/plugins/greeblefs-workbench-text/extension.toml
id = "greeblefs-workbench-text"
version = "1"
name = "GreebleFS Text Workbench"
entry = "index.tsx"
category = "First-party Workbenches"

[[contributions.previewLanes]]
id = "text"
title = "Text Workbench"
renderer = "preview/textWorkbench.tsx"
priority = 640

[contributions.previewLanes.match]
appliesTo = "file"
previewKinds = ["text", "script"]

[contributions.previewLanes.workbenchChrome]
includePreviewTab = true
```

The entry `index.tsx` default-exports a factory receiving the **legacy**
host object (not yet the `greeblefs` harness — see migration below). Test
fixtures live next to the plugin (`examples/`, `preview/`, `testFiles`).

Shipped first-party workbenches: text, image, audio, video, pdf, archive,
docx, spreadsheet, sqlite, folder, shader, python, model3d, bevy-model3d.
Third-party compat: `.vsix` files (e.g. VS Code 3D viewer) load as viewers.

## Themes: API first, JSON as legacy input

Theme *application* runs through the harness `theme` domain
(`src/runtime/greebleThemeBridge.ts`): `fs.registerTheme` contributions
(tokens + composed modules) convert to renderable definitions and merge
into the same pipeline — ThemeCatalog, selection, CSS vars — as JSON
packs. JSON `theme.json` playlists still load and keep working; they are
simply no longer the only way in. Author new themes against
`06-EXTENSION-API.md`; reach for `theme.json` only to patch legacy packs.

## Authoring a theme, legacy format (still supported)

A theme is a **playlist**: `usr/themes/<id>/theme.json` points at lane IDs,
each lane independently overridable (`null` = follow the theme):

```json
{
  "id": "andromeda",
  "extends": "github-dark",
  "appearancePackId": "andromeda-appearance",
  "themeRecipeId": "andromeda-observatory",
  "themeEngineId": "andromeda-engine",
  "interactionMotionPackId": "andromeda-motion",
  "topBarId": "stellar-bridge",
  "iconThemeId": "andromeda-icons",
  "wallpaperId": "andromeda-halo",
  "shaderId": "andromeda-drift",
  "openAnimationId": "andromeda-gate"
}
```

Clicking a theme in Settings → Theme Suite runs `applyThemeSelection`,
which resolves each ID against the managed catalog and writes the lanes
into settings. Rules of the road:

- **Dangling IDs fail silently.** A lane pointing at a pack that isn't in
  the managed catalog falls back to built-in defaults with no error. If a
  theme "does nothing," resolve its IDs against the catalog first.
- Child packs can live nested inside the theme folder (e.g.
  `andromeda/icon-themes/andromeda-icons/`) or in the top-level lanes.
- `extends` names a built-in preset fallback (`github-dark`, `operator`, …).
- Profiles (`profiles/default`, `minimal-low-motion`, `variants.json`)
  resolve as active profile → canonical baseline → bundled fallback.

## Kain plugins (`plugins-kain/`)

Kain-language extensions: `kain-image-converter`,
`kain-plugin-authoring-examples`, `kain-workbench-smoke`, and the
`kain-plugin-ffi-full-stack-example`. They exercise the Kain bridge
(`src-kain/`, `toolchains/kain/`) rather than the TSX path.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Theme click does nothing | Pack IDs dangling (catalog empty or packs in the pre-migration root). Check the managed root, not the repo `usr/`. |
| Plugin missing from workbench list | `extension.toml` id/entry mismatch, or renderer path wrong. |
| Edits to bundled files "revert" | You're editing the repo copy; the app reads the managed copy. Edit in the managed root or re-install. |
| Stale packs after upgrade | Copy-missing never deletes. Remove the old pack dir by hand. |
| Settings shows dead dropdowns | Catalog lane is empty (see theme case above). |

## Migration roadmap (toward `06-EXTENSION-API.md`)

- [x] `greeblefs` import map live in both transpiler lanes
  (`pluginRuntime`, `themeRendererRuntime`) — TSX can import the contract.
- [x] Theme domain backed by a real renderer path
  (`greebleThemeBridge`: registry → definitions → catalog/apply/CSS).
- [x] Legacy `defineThemeRenderer` TSX shimmed onto `registerShell`
  (`greebleLegacyShim` + App adoption effect + live host provider).
- [x] Legacy `definePlugin` / `extension.toml` shimmed onto the new verbs
  (`greeblePluginShim` + App adoption effect + live host providers).
- [x] `previewLane` merged into preview resolution; `viewMode` registry-listed
  (`greebleLaneBridge`; switch-UI merge needs a custom-mode-aware consumer).
- [x] Factory modules + flagship API themes (XMB, Wii Menu, Finder) +
  content watcher hot-reload loop (`greebleFactory`, `greebleWatch`).
- [ ] Multi-root watch + API shell host (render book shells structurally).

`extension.toml` packs and `theme.json` playlists run on their legacy
loaders while API registrations flow through the bridge — both visible
side by side, with legacy shells adopted into the API book.
