import React from 'react';
import { definePlugin } from 'overlayterm-plugin';

export default definePlugin({
  name: 'Test Extension Hello',
  component: function TestExtensionHelloPanel() {
    return (
      <div
        style={{
          display: 'grid',
          gap: 12,
          padding: 18,
          color: 'var(--overlay-text-primary)',
          fontFamily: 'var(--overlay-font-ui, sans-serif)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          .test Preview Smoke Test
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.82 }}>
          Open
          {' '}
          <code>usr/plugins/test-extension-hello/examples/hello-world.test</code>
          {' '}
          in the explorer preview pane. If the extension host is wired up
          correctly, the preview should render the plugin-owned hello world
          surface instead of the built-in text lane.
        </div>
      </div>
    );
  },
});
