# OverlayTerm Plugins

Drop a self-contained `.tsx` plugin file into this folder and the `Plugins` tab will pick it up automatically.

Simple frontend plugin example:

```tsx
import React, { useState } from 'react';
import { definePlugin } from 'overlayterm-plugin';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw } from 'lucide-react';

export default definePlugin({
  name: 'Hello Plugin',
  description: 'Minimal drop-in example',
  component: function HelloPlugin({ plugin, api }) {
    const [message, setMessage] = useState('ready');

    async function ping() {
      await invoke('fs_create_dir', { path: `${plugin.pluginDirectory}\\data` });
      setMessage('it works');
    }

    return (
      <div style={{ padding: 16, color: '#eef0ff' }}>
        <h2 style={{ marginTop: 0 }}>Hello Plugin</h2>
        <p>{message}</p>
        <button onClick={ping} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} />
          Ping
        </button>
      </div>
    );
  },
});
```

Optional native/backend helper layout:

```text
plugins/
  my-plugin.tsx
  my-plugin/
    backend/
      tool.exe
```

From the plugin component you can call:

```ts
await api.runBackend('tool.exe', ['--hello']);
```

Supported imports inside plugin files:

- `react`
- `lucide-react`
- `@tauri-apps/api/core`
- `@tauri-apps/api/event`
- `@tauri-apps/api/window`
- `@tauri-apps/plugin-fs`
- `overlayterm-plugin`
