import React from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'GreebleFS Folder Workbench',
  component: function FolderWorkbenchPackagePanel() {
    return (
      <div style={{ padding: 16, color: 'var(--overlay-text-primary)' }}>
        Folder workbench package
      </div>
    );
  },
});
