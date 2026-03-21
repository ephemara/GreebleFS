import React, { useEffect, useMemo, useState } from 'react';

export function clampPanelSize(value: number, minSize: number, maxSize: number): number {
  return Math.max(minSize, Math.min(maxSize, value));
}

export function usePersistentPanelSize(
  storageKey: string,
  initialSize: number,
  minSize: number,
  maxSize: number,
): [number, React.Dispatch<React.SetStateAction<number>>] {
  const [size, setSize] = useState(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return clampPanelSize(initialSize, minSize, maxSize);
      }

      return clampPanelSize(Number.parseFloat(raw), minSize, maxSize);
    } catch {
      return clampPanelSize(initialSize, minSize, maxSize);
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(clampPanelSize(size, minSize, maxSize)));
    } catch {
      // Ignore storage failures; the panel can still resize for the current session.
    }
  }, [maxSize, minSize, size, storageKey]);

  return [clampPanelSize(size, minSize, maxSize), setSize];
}

export function ResizablePane({
  size,
  minSize,
  maxSize,
  onSizeChange,
  borderColor,
  handleSide = 'right',
  children,
  style,
}: {
  size: number;
  minSize: number;
  maxSize: number;
  onSizeChange: (nextSize: number) => void;
  borderColor: string;
  handleSide?: 'left' | 'right';
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const handleStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 6,
    cursor: 'col-resize',
    zIndex: 10,
    background: 'transparent',
    touchAction: 'none',
    [handleSide]: -3,
  }), [handleSide]);

  return (
    <div
      style={{
        width: size,
        minWidth: size,
        maxWidth: size,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
      <div
        onMouseDown={event => {
          event.preventDefault();
          const startX = event.clientX;
          const startSize = size;
          const direction = handleSide === 'right' ? 1 : -1;

          const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = (moveEvent.clientX - startX) * direction;
            onSizeChange(clampPanelSize(startSize + delta, minSize, maxSize));
          };
          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };

          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        }}
        style={handleStyle}
        onMouseEnter={event => { event.currentTarget.style.background = borderColor; }}
        onMouseLeave={event => { event.currentTarget.style.background = 'transparent'; }}
      />
    </div>
  );
}
