import React, { useCallback, useRef } from 'react';

type OverlayScrollDirection = 'vertical' | 'horizontal' | 'both';

interface OverlayScrollAreaProps {
  children: React.ReactNode;
  direction?: OverlayScrollDirection;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
  viewportStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
}

export function OverlayScrollArea({
  children,
  direction = 'vertical',
  className,
  viewportClassName,
  contentClassName,
  style,
  viewportStyle,
  contentStyle,
}: OverlayScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (direction !== 'horizontal') {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    viewport.scrollLeft += event.deltaY;
  }, [direction]);

  return (
    <div
      className={joinClassNames('overlay-scroll-area', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minWidth: 0,
        minHeight: 0,
        ...style,
      }}
    >
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        className={joinClassNames(
          'overlay-scroll-area__viewport',
          `overlay-scroll-area__viewport--${direction}`,
          viewportClassName,
        )}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0,
          ...viewportStyle,
        }}
      >
        <div
          className={joinClassNames('overlay-scroll-area__content', contentClassName)}
          style={{
            flex: '0 0 auto',
            minWidth: 0,
            ...contentStyle,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
