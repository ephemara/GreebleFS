import { render, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ExplorerChromeSurface } from '../components/explorer/ExplorerChromeSurface';
import type { ExplorerChromeResolvedSurface } from '../config/explorerChromeLayouts';

const toolbarSurface: ExplorerChromeResolvedSurface = {
  surfaceId: 'explorerToolbar',
  rows: [
    {
      id: 'primary',
      zones: [
        {
          id: 'primaryStart',
          controls: [
            {
              controlId: 'refresh',
              surfaceId: 'explorerToolbar',
              zone: 'primaryStart',
              order: 10,
            },
          ],
        },
      ],
    },
  ],
  visibleControlIds: ['refresh'],
};

describe('ExplorerChromeSurface', () => {
  it('registers a customize surface once when parent rerenders recreate the edit-mode object', async () => {
    const registerCalls: string[] = [];
    const unregisterCalls: string[] = [];

    function Harness() {
      const [, setRevision] = useState(0);
      const registerSurface = useCallback((surface: ExplorerChromeResolvedSurface) => {
        registerCalls.push(surface.surfaceId);
        if (registerCalls.length < 3) {
          setRevision((current) => current + 1);
        }
      }, []);
      const unregisterSurface = useCallback((surfaceId: string) => {
        unregisterCalls.push(surfaceId);
      }, []);

      return (
        <ExplorerChromeSurface
          surface={toolbarSurface}
          renderControl={() => <button type="button">Refresh</button>}
          editMode={{
            active: true,
            draggingControlId: null,
            onRegisterSurface: registerSurface,
            onUnregisterSurface: unregisterSurface,
            onDragStart: () => undefined,
            onDragEnd: () => undefined,
            onMoveControl: () => undefined,
          }}
        />
      );
    }

    const rendered = render(<Harness />);

    await waitFor(() => {
      expect(registerCalls).toEqual(['explorerToolbar']);
    });
    expect(unregisterCalls).toHaveLength(0);

    rendered.unmount();

    await waitFor(() => {
      expect(unregisterCalls).toEqual(['explorerToolbar']);
    });
  });
});
