import React from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'GreebleFS Text Workbench',
  component: function TextWorkbenchPackagePanel() {
    return (
      <div style={{ padding: 16, color: 'var(--overlay-text-primary)' }}>
        Text workbench package
      </div>
    );
  },
});
