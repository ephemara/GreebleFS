import React from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'GreebleFS Spreadsheet Workbench',
  component: function SpreadsheetWorkbenchPackagePanel() {
    return (
      <div style={{ padding: 16, color: 'var(--overlay-text-primary)' }}>
        Spreadsheet workbench package
      </div>
    );
  },
});
