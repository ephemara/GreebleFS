import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS } from '../config/explorerContextMenu';
import { ExplorerContextMenu } from '../components/explorer/ExplorerContextMenu';
import type { ExplorerRuntimeMenuNode } from '../components/explorer/explorerMenuRuntime';

const openCommandDefinition = BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS.find(
  (command) => command.id === 'built-in.open',
);

function createCommandNode(
  overrides?: Partial<Extract<ExplorerRuntimeMenuNode, { kind: 'command' }>>,
): Extract<ExplorerRuntimeMenuNode, { kind: 'command' }> {
  if (!openCommandDefinition) {
    throw new Error('Missing built-in open command definition');
  }

  return {
    kind: 'command',
    id: 'command.open',
    commandId: openCommandDefinition.id,
    label: 'Open',
    depth: 0,
    tone: 'safe',
    source: 'layout',
    quickSlot: 'none',
    fallbackBucket: 'default',
    disabled: false,
    command: openCommandDefinition,
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe('ExplorerContextMenu', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
  });

  it('supports keyboard-driven submenu traversal and command selection', async () => {
    const onClose = vi.fn();
    const onDelete = vi.fn();
    const nodes: ExplorerRuntimeMenuNode[] = [
      {
        kind: 'submenu',
        id: 'submenu.more',
        label: 'More',
        depth: 0,
        tone: 'safe',
        source: 'layout',
        quickSlot: 'none',
        fallbackBucket: 'default',
        children: [
          createCommandNode({
            id: 'submenu.more.delete',
            label: 'Delete',
            depth: 1,
            tone: 'danger',
            onSelect: onDelete,
          }),
        ],
      },
      createCommandNode({
        id: 'command.open.secondary',
        label: 'Open',
      }),
    ];

    render(
      <ExplorerContextMenu
        visible
        x={32}
        y={48}
        nodes={nodes}
        onClose={onClose}
        renderIcon={() => null}
      />,
    );

    const overlayRoot = document.querySelector('[tabindex="-1"]');
    if (!(overlayRoot instanceof HTMLElement)) {
      throw new Error('Expected menu overlay root');
    }

    fireEvent.keyDown(overlayRoot, { key: 'ArrowRight' });
    fireEvent.keyDown(overlayRoot, { key: 'Enter' });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses when the user clicks outside the menu surface', () => {
    const onClose = vi.fn();

    render(
      <ExplorerContextMenu
        visible
        x={24}
        y={24}
        nodes={[createCommandNode()]}
        onClose={onClose}
        renderIcon={() => null}
      />,
    );

    fireEvent.mouseDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clamps the root panel inside the viewport bounds', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 300 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 200 });

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      if (this.dataset.overlayExplorerContextMenuPanel) {
        return new DOMRect(0, 0, 260, 190);
      }
      return new DOMRect(0, 0, 40, 20);
    });

    render(
      <ExplorerContextMenu
        visible
        x={280}
        y={180}
        nodes={[createCommandNode()]}
        onClose={() => {}}
        renderIcon={() => null}
      />,
    );

    const rootPanel = document.querySelector('[data-overlay-explorer-context-menu-panel="root"]');
    if (!(rootPanel instanceof HTMLElement)) {
      throw new Error('Expected root menu panel');
    }

    await waitFor(() => {
      expect(rootPanel.style.left).toBe('32px');
      expect(rootPanel.style.top).toBe('8px');
    });
  });
});
