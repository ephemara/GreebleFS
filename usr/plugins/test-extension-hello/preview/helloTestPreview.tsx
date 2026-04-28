import React from 'react';
import { definePreviewLane } from 'overlayterm-plugin';

export default definePreviewLane({
  component: function HelloTestPreview({ executionContext, file }) {
    return (
      <div
        data-testid="test-extension-hello-preview"
        style={{
          display: 'grid',
          gap: 10,
          minHeight: '100%',
          padding: 20,
          color: 'var(--overlay-text-primary)',
          background:
            'linear-gradient(160deg, rgba(35, 49, 79, 0.88), rgba(17, 22, 34, 0.94))',
          fontFamily: 'var(--overlay-font-ui, sans-serif)',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Hello World
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.86 }}>
          The plugin-owned preview lane claimed this
          {' '}
          <code>.test</code>
          {' '}
          file successfully.
        </div>
        <div
          style={{
            display: 'grid',
            gap: 6,
            padding: 12,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 14,
            background: 'rgba(255, 255, 255, 0.06)',
            fontSize: 13,
          }}
        >
          <div>
            <strong>File:</strong>
            {' '}
            {file.name}
          </div>
          <div>
            <strong>Extension:</strong>
            {' '}
            .{file.extension || 'unknown'}
          </div>
          <div>
            <strong>Active Directory:</strong>
            {' '}
            {executionContext?.activeDirectory ?? 'unavailable'}
          </div>
        </div>
      </div>
    );
  },
});
