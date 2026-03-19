# OverlayTerm Plugins

Drop a self-contained `.tsx` file into this folder and the `Plugins` tab will pick it up automatically.

The runtime is intentionally small:

- one file per plugin
- no relative imports
- only approved runtime modules
- file-name-derived plugin ids

For users, the safest pattern is to keep examples frontend-only and store any data in app-local storage through `@tauri-apps/plugin-fs`.

## Included Examples

- `drawable-canvas.tsx`: a richer painter plugin with pressure, effect passes, and sketch saving.
- `platform-inspector.tsx`: a lightweight cross-platform inspector for plugin metadata and host state.
- `quick-notes.tsx`: a portable scratchpad that persists notes in app-local data.
- `theme-gallery.tsx`: a theme preview sample that shows palette and CSS variables.

## Minimal Plugin

```tsx
import React, { useState } from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'Hello Plugin',
  description: 'Minimal drop-in example',
  component: function HelloPlugin({ plugin, api }) {
    const [message, setMessage] = useState('ready');

    async function ping() {
      const baseDir = api.fs?.BaseDirectory?.AppLocalData;
      if (!baseDir || !api.fs?.mkdir) {
        setMessage('filesystem API unavailable');
        return;
      }

      await api.fs.mkdir('overlayterm/examples/hello-plugin', { baseDir, recursive: true });
      setMessage(`saved for ${plugin.name}`);
    }

    return (
      <div style={{ padding: 16, color: 'var(--overlay-text-primary)' }}>
        <h2 style={{ marginTop: 0 }}>Hello Plugin</h2>
        <p>{message}</p>
        <button onClick={ping}>Ping</button>
      </div>
    );
  },
});
```

## Portable Storage Pattern

Use `AppLocalData` and forward slashes for plugin-owned files:

```ts
const baseDir = api.fs?.BaseDirectory?.AppLocalData;
await api.fs.mkdir('overlayterm/notes/my-plugin', { baseDir, recursive: true });
await api.fs.writeTextFile('overlayterm/notes/my-plugin/state.json', json, { baseDir });
```

That pattern works on Windows, macOS, and Linux because Tauri handles the underlying filesystem translation for you.

## Optional Backend Layout

If a plugin needs a native helper, keep it inside the plugin folder:

```text
plugins/
  my-plugin.tsx
  my-plugin/
    backend/
      tool
```

Prefer frontend-only examples when possible. A single backend binary is not automatically portable across every operating system, so cross-platform samples should either avoid native helpers or ship per-platform entrypoints.

From the plugin component you can call:

```ts
await api.runBackend('tool', ['--hello']);
```

## Supported Imports

- `react`
- `lucide-react`
- `@tauri-apps/api/core`
- `@tauri-apps/api/event`
- `@tauri-apps/api/window`
- `@tauri-apps/plugin-fs`
- `overlayterm-plugin`

## Plugin Root

By default the app scans the local `plugins/` directory. You can override the root with `VITE_OVERLAYTERM_PLUGINS_DIR` if you want to point OverlayTerm at a different plugin folder.
