# OverlayTerm Animation Modules

Drop `*.ts`, `*.tsx`, `*.js`, or `*.jsx` files into this folder to author custom
window open/close motion for OverlayTerm.

Keep this folder focused on shell motion and lightweight overlay effects. Ambient or
surface-oriented shader work belongs in the sibling `shaders/` folder instead of the
animation catalog.

Runtime imports:

- `react`
- `lucide-react`
- `@tauri-apps/api/core`
- `@tauri-apps/api/event`
- `@tauri-apps/api/window`
- `@tauri-apps/plugin-fs`
- `overlayterm-animation`

Recommended export shape:

```tsx
import React from 'react';
import { defineAnimation } from 'overlayterm-animation';

export default defineAnimation({
  name: 'My Motion',
  description: 'Custom open and close motion.',
  open: {
    resolveShellStyle: context => ({
      opacity: context.baseOpacity * context.progress,
      transition: 'none',
    }),
  },
  close: {
    resolveShellStyle: context => ({
      opacity: context.baseOpacity * (1 - context.progress),
      transition: 'none',
    }),
  },
});
```

If a module throws or fails to transpile, OverlayTerm keeps running and the load
error appears in the Appearance > Window Motion section.
