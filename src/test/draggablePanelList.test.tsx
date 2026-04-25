import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DraggablePanelList } from '../components/DraggablePanelList';

function assignRect(
  element: Element,
  rect: Partial<DOMRectReadOnly>,
): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    width: rect.width ?? 100,
    height: rect.height ?? 24,
    top: rect.top ?? 0,
    right: rect.right ?? ((rect.left ?? 0) + (rect.width ?? 100)),
    bottom: rect.bottom ?? ((rect.top ?? 0) + (rect.height ?? 24)),
    left: rect.left ?? 0,
    toJSON: () => ({}),
  } as DOMRectReadOnly);
}

function DraggablePanelListHarness({
  onDropItem,
}: {
  onDropItem: (itemId: string, index: number) => void;
}) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  return (
    <DraggablePanelList
      items={[
        { id: 'alpha', label: 'Alpha' },
        { id: 'beta', label: 'Beta' },
      ]}
      getItemId={(item) => item.id}
      activeItemId={null}
      draggedItemId={draggedItemId}
      onDragStart={setDraggedItemId}
      onDragEnd={() => setDraggedItemId(null)}
      onDropItem={onDropItem}
      listLabel="test-panels"
      emptyState={<div>Empty</div>}
      renderItem={({ itemId, item, dragHandleProps }) => (
        <div data-testid={`panel-row-${itemId}`}>
          <div {...dragHandleProps} data-testid={`panel-handle-${itemId}`}>
            Drag
          </div>
          <div>{item.label}</div>
        </div>
      )}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DraggablePanelList', () => {
  it('drops a dragged row onto the targeted position with pointer-driven dragging', () => {
    const onDropItem = vi.fn();
    render(<DraggablePanelListHarness onDropItem={onDropItem} />);

    const listRoot = document.querySelector(
      '[data-draggable-panel-list="test-panels"]',
    );
    if (!(listRoot instanceof HTMLElement)) {
      throw new Error('Expected list root');
    }

    const alphaRow = document.querySelector(
      '[data-draggable-panel-row-shell="alpha"]',
    );
    const betaRow = document.querySelector(
      '[data-draggable-panel-row-shell="beta"]',
    );
    if (!(alphaRow instanceof HTMLElement) || !(betaRow instanceof HTMLElement)) {
      throw new Error('Expected draggable panel row shells');
    }

    assignRect(listRoot, { top: 0, left: 0, width: 240, height: 120 });
    assignRect(alphaRow, { top: 20, left: 0, width: 240, height: 28 });
    assignRect(betaRow, { top: 60, left: 0, width: 240, height: 28 });

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => listRoot),
    });

    const betaHandle = screen.getByTestId('panel-handle-beta');
    fireEvent.pointerDown(betaHandle, {
      button: 0,
      pointerId: 1,
      clientX: 40,
      clientY: 74,
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 40,
      clientY: 6,
    });
    fireEvent.pointerUp(window, {
      pointerId: 1,
      clientX: 40,
      clientY: 6,
    });

    expect(onDropItem).toHaveBeenCalledWith('beta', 0);
  });
});
