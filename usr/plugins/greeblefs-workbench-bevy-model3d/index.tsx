import React from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'GreebleFS Bevy 3D Workbench',
  component: function BevyModel3dWorkbenchPackagePanel() {
    return (
      <div style={{ padding: 16, color: 'var(--overlay-text-primary)' }}>
        Bevy 3D workbench package
      </div>
    );
  },
});
