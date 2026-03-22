# OverlayTerm Plugins

OverlayTerm now supports two plugin workflows:

- Legacy file plugins: drop a self-contained `.tsx/.ts/.jsx/.js` file into `plugins/`
- Package plugins: drop a folder with `plugin.json` or `plugin.toml`

That means you can stay lightweight for tiny panels, or ship a full plugin package with its own entry bundle, themes, shaders, fonts, assets, commands, explorer actions, and backend helpers.

## Included Examples

- `drawable-canvas.tsx`: richer single-file painter plugin
- `platform-inspector.tsx`: host/runtime inspection panel
- `quick-notes.tsx`: persistent scratchpad example
- `theme-gallery.tsx`: theme preview sample
- `examples/manifest-package/`: first-party folder-plugin template

## Legacy File Plugins

Use this when you want the fastest possible workflow.

```tsx
import React from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'Hello Plugin',
  component: function HelloPlugin({ plugin, api }) {
    return (
      <div style={{ padding: 16, color: 'var(--overlay-text-primary)' }}>
        <h2 style={{ marginTop: 0 }}>{plugin.name}</h2>
        <button onClick={() => api.refreshPlugins()}>Refresh Plugins</button>
      </div>
    );
  },
});
```

Legacy file plugins are intentionally constrained:

- one file per plugin
- no relative imports
- only approved runtime modules
- file-name-derived plugin ids

## Package Plugins

Use this when you want a larger plugin with bundled frontend code and manifest-driven contributions.

```text
plugins/
  my-plugin/
    plugin.json
    dist/
      index.js
    assets/
    shaders/
    themes/
    backend/
```

Example manifest:

```json
{
  "version": 1,
  "id": "my-plugin",
  "name": "My Plugin",
  "entry": "dist/index.js",
  "defaultOpen": false,
  "contributions": {
    "themes": ["themes/cobalt-lab"],
    "shaders": ["shaders/cobalt-halo.tsx"],
    "commands": [
      {
        "id": "project-build",
        "name": "Project Build",
        "command": "npm run build"
      }
    ],
    "explorerActions": [
      {
        "id": "echo-selected-path",
        "label": "Echo Selected Path",
        "command": "echo {path}",
        "appliesTo": "file",
        "runOnSelect": true
      }
    ]
  }
}
```

Package plugins currently support:

- panel entry bundles
- theme package contributions
- shader contributions
- local font registration
- terminal command contributions
- explorer context-menu actions
- backend helper binaries/scripts

## Asset Helpers

Large plugins can treat bundled assets as first-class files through `api.assets`.

```ts
const imageUrl = api.assets?.resolveUrl('assets/panel-grid.svg');
const absolutePath = api.assets?.resolvePath('assets/panel-grid.svg');
```

That makes it easy to load SVGs, images, configuration files, or any other package-owned file without hardcoding absolute paths.

## Storage Pattern

For plugin-owned persistence, use `api.storage` when available:

```ts
await api.storage?.ensureDir('notes');
await api.storage?.writeTextFile('notes/state.json', JSON.stringify(state, null, 2));
```

## Commands And Explorer Actions

Command and explorer-action contributions use string templates. Available tokens:

- `{path}`
- `{name}`
- `{parent}`
- `{extension}`
- `{stem}`
- `{pluginId}`
- `{pluginName}`
- `{kind}`

Explorer actions resolve those tokens from the selected file or folder, then inject or run the result in the integrated terminal.

## Optional Backend Layout

If a plugin needs a native helper, keep it inside the plugin folder:

```text
plugins/
  my-plugin/
    plugin.json
    backend/
      tool
```

From the plugin component you can call:

```ts
await api.runBackend('tool', ['--hello']);
```

## Supported Imports

Package entry bundles and legacy file plugins both use the same approved runtime imports:

- `react`
- `lucide-react`
- `@tauri-apps/api/core`
- `@tauri-apps/api/event`
- `@tauri-apps/api/window`
- `@tauri-apps/plugin-fs`
- `overlayterm-plugin`

## Plugin Root

By default the app scans the local `plugins/` directory. You can override the root with `VITE_OVERLAYTERM_PLUGINS_DIR` if you want to point OverlayTerm at a different plugin folder.
