import {
  useEffect,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from 'react';

export interface DraggablePanelListRenderItemArgs<TItem> {
  item: TItem;
  itemId: string;
  isActive: boolean;
  isDragging: boolean;
}

export interface DraggablePanelListProps<TItem> {
  items: readonly TItem[];
  getItemId: (item: TItem) => string;
  renderItem: (args: DraggablePanelListRenderItemArgs<TItem>) => ReactNode;
  renderChildren?: (item: TItem) => ReactNode;
  activeItemId?: string | null;
  draggedItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
  onDragStart?: (itemId: string) => void;
  onDragEnd?: () => void;
  onDropItem: (itemId: string, index: number) => void;
  emptyState?: ReactNode;
  className?: string;
  style?: CSSProperties;
  listLabel?: string;
  accentColor?: string;
  borderColor?: string;
}

const DEFAULT_ACCENT_COLOR = 'var(--overlay-accent)';
const DEFAULT_BORDER_COLOR = 'var(--overlay-workbench-settings-card-border)';

export function DraggablePanelList<TItem>({
  items,
  getItemId,
  renderItem,
  renderChildren,
  activeItemId = null,
  draggedItemId = null,
  onSelectItem,
  onDragStart,
  onDragEnd,
  onDropItem,
  emptyState,
  className,
  style,
  listLabel = 'panel-list',
  accentColor = DEFAULT_ACCENT_COLOR,
  borderColor = DEFAULT_BORDER_COLOR,
}: DraggablePanelListProps<TItem>) {
  const [hoveredDropIndex, setHoveredDropIndex] = useState<number | null>(null);
  const dragActive = draggedItemId != null;

  useEffect(() => {
    if (!dragActive) {
      setHoveredDropIndex(null);
    }
  }, [dragActive]);

  const handleDropZoneDragOver = (
    event: ReactDragEvent<HTMLElement>,
    dropIndex: number,
  ) => {
    if (!dragActive) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setHoveredDropIndex(dropIndex);
  };

  const handleDropZoneDrop = (
    event: ReactDragEvent<HTMLElement>,
    dropIndex: number,
  ) => {
    if (!draggedItemId) {
      return;
    }
    event.preventDefault();
    onDropItem(draggedItemId, dropIndex);
    setHoveredDropIndex(null);
    onDragEnd?.();
  };

  const renderDropZone = (dropIndex: number) => {
    const indicatorActive = dragActive && hoveredDropIndex === dropIndex;

    return (
      <div
        key={`${listLabel}-drop-${dropIndex}`}
        data-draggable-panel-drop-zone={`${listLabel}:${dropIndex}`}
        aria-label={`Drop at position ${dropIndex + 1}`}
        onDragOver={(event) => handleDropZoneDragOver(event, dropIndex)}
        onDragEnter={(event) => handleDropZoneDragOver(event, dropIndex)}
        onDragLeave={() => {
          setHoveredDropIndex(current => (current === dropIndex ? null : current));
        }}
        onDrop={(event) => handleDropZoneDrop(event, dropIndex)}
        style={{
          minHeight: dragActive ? 14 : 6,
          padding: dragActive ? '1px 0' : 0,
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'relative',
            height: indicatorActive ? 10 : 4,
            opacity: dragActive || indicatorActive ? 1 : 0,
            transition: 'opacity 120ms ease, height 120ms ease',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: indicatorActive ? 2 : 1,
              transform: 'translateY(-50%)',
              borderRadius: 999,
              background: indicatorActive ? accentColor : `${borderColor}cc`,
            }}
          />
          {indicatorActive ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  width: 8,
                  height: 8,
                  borderRadius: '999px',
                  transform: 'translateY(-50%)',
                  background: accentColor,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: 0,
                  width: 8,
                  height: 8,
                  borderRadius: '999px',
                  transform: 'translateY(-50%)',
                  background: accentColor,
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    );
  };

  if (items.length === 0) {
    const emptyActive = dragActive && hoveredDropIndex === 0;

    return (
      <div
        data-draggable-panel-list={listLabel}
        className={className}
        style={style}
      >
        <div
          data-draggable-panel-empty={listLabel}
          aria-label={`Empty ${listLabel}`}
          onDragOver={(event) => handleDropZoneDragOver(event, 0)}
          onDragEnter={(event) => handleDropZoneDragOver(event, 0)}
          onDragLeave={() => {
            setHoveredDropIndex(current => (current === 0 ? null : current));
          }}
          onDrop={(event) => handleDropZoneDrop(event, 0)}
          className="rounded-xl border border-dashed px-3 py-4 text-[11px]"
          style={{
            borderColor: emptyActive ? accentColor : `${borderColor}aa`,
            background: emptyActive ? `${accentColor}10` : 'rgba(255,255,255,0.02)',
            transition: 'border-color 120ms ease, background 120ms ease',
          }}
        >
          {emptyState}
        </div>
      </div>
    );
  }

  return (
    <div
      data-draggable-panel-list={listLabel}
      className={className}
      style={style}
    >
      {renderDropZone(0)}
      {items.map((item, index) => {
        const itemId = getItemId(item);
        const isActive = activeItemId === itemId;
        const isDragging = draggedItemId === itemId;

        return (
          <div
            key={itemId}
            data-draggable-panel-item={itemId}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', itemId);
              onDragStart?.(itemId);
              onSelectItem?.(itemId);
            }}
            onDragEnd={() => {
              setHoveredDropIndex(null);
              onDragEnd?.();
            }}
            style={{
              opacity: isDragging ? 0.72 : 1,
              transition: 'opacity 120ms ease',
            }}
          >
            {renderItem({
              item,
              itemId,
              isActive,
              isDragging,
            })}
            {renderChildren?.(item)}
          </div>
        );
      })}
      {renderDropZone(items.length)}
    </div>
  );
}
