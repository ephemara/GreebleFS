import React, {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { OverlayScrollArea } from 'overlayterm-plugin';

export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  height?: number;
  width?: number | string;
  className?: string;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  onScroll?: (scrollTop: number) => void;
  scrollbarStyle?: 'hidden' | 'themed' | 'explorer-file-list';
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 6,
  height = 400,
  width = '100%',
  className,
  style,
  contentStyle,
  onScroll,
  scrollbarStyle = 'themed',
}: VirtualizedListProps<T>): JSX.Element {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const visibleCount = Math.max(1, Math.ceil(height / itemHeight));
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + (overscan * 2));
  const totalHeight = items.length * itemHeight;

  const handleViewportScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const nextScrollTop = event.currentTarget.scrollTop;
    requestAnimationFrame(() => {
      setScrollTop(nextScrollTop);
      onScroll?.(nextScrollTop);
    });
  }, [onScroll]);

  const visibleItems: ReactNode[] = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const item = items[index];
    if (item == null) {
      continue;
    }
    visibleItems.push(
      <div
        key={index}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: itemHeight,
          transform: `translateY(${index * itemHeight}px)`,
        }}
      >
        {renderItem(item, index)}
      </div>,
    );
  }

  return (
    <OverlayScrollArea
      className={className}
      viewportRef={viewportRef}
      scrollbarStyle={scrollbarStyle}
      onViewportScroll={handleViewportScroll}
      style={{
        width,
        height,
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          minWidth: 0,
          height: totalHeight,
          ...contentStyle,
        }}
      >
        {visibleItems}
      </div>
    </OverlayScrollArea>
  );
}

export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 6,
) {
  const [scrollTop, setScrollTop] = useState(0);
  const visibleCount = Math.max(1, Math.ceil(containerHeight / itemHeight));
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + (overscan * 2));

  return {
    endIndex,
    offsetY: startIndex * itemHeight,
    scrollTop,
    setScrollTop,
    startIndex,
    totalHeight: items.length * itemHeight,
    visibleItems: items.slice(startIndex, endIndex),
  };
}
