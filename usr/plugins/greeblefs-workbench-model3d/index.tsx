import React from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'GreebleFS 3D Model Workbench',
  component: function Model3dWorkbenchPackagePanel() {
    return (
      <div style={{ padding: 16, color: 'var(--overlay-text-primary)' }}>
        3D model workbench package
      </div>
    );
  },
});
