import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DraggablePanelList } from '../components/DraggablePanelList';

function createDataTransfer(): DataTransfer {
  const store = new Map<string, string>();
  return {
    dropEffect: 'move',
    effectAllowed: 'all',
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData: vi.fn((format?: string) => {
      if (format) {
        store.delete(format);
      } else {
        store.clear();
      }
    }),
    getData: vi.fn((format: string) => store.get(format) ?? ''),
    setData: vi.fn((format: string, value: string) => {
      store.set(format, value);
    }),
    setDragImage: vi.fn(),
  } as unknown as DataTransfer;
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
      renderItem={({ itemId, item }) => (
        <button type="button" data-testid={`panel-row-${itemId}`}>
          {item.label}
        </button>
      )}
    />
  );
}

describe('DraggablePanelList', () => {
  it('drops a dragged row onto the targeted position', () => {
    const onDropItem = vi.fn();
    render(<DraggablePanelListHarness onDropItem={onDropItem} />);

    const dataTransfer = createDataTransfer();
    const draggedRow = screen
      .getByTestId('panel-row-beta')
      .closest('[data-draggable-panel-item="beta"]');
    if (!(draggedRow instanceof HTMLElement)) {
      throw new Error('Expected draggable row wrapper');
    }

    fireEvent.dragStart(draggedRow, { dataTransfer });

    const firstDropZone = document.querySelector(
      '[data-draggable-panel-drop-zone="test-panels:0"]',
    );
    if (!(firstDropZone instanceof HTMLElement)) {
      throw new Error('Expected first drop zone');
    }

    fireEvent.dragEnter(firstDropZone, { dataTransfer });
    fireEvent.dragOver(firstDropZone, { dataTransfer });
    fireEvent.drop(firstDropZone, { dataTransfer });

    expect(onDropItem).toHaveBeenCalledWith('beta', 0);
  });
});
