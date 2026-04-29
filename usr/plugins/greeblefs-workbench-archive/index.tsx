import React from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'GreebleFS Archive Workbench',
  component: function ArchiveWorkbenchPackagePanel() {
    return (
      <div style={{ padding: 16, color: 'var(--overlay-text-primary)' }}>
        Archive workbench package
      </div>
    );
  },
});
