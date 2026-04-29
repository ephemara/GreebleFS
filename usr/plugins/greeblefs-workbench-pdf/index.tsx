import React from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'GreebleFS PDF Workbench',
  component: function PdfWorkbenchPackagePanel() {
    return (
      <div style={{ padding: 16, color: 'var(--overlay-text-primary)' }}>
        PDF workbench package
      </div>
    );
  },
});
