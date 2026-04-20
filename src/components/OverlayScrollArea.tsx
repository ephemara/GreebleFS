import React, { useCallback, useRef } from 'react';

type OverlayScrollDirection = 'vertical' | 'horizontal' | 'both';
type OverlayScrollbarStyle = 'hidden' | 'themed' | 'explorer-file-list';

interface OverlayScrollAreaProps {
  children: React.ReactNode;
  direction?: OverlayScrollDirection;
  scrollbarStyle?: OverlayScrollbarStyle;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
  viewportStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  viewportRef?: React.Ref<HTMLDivElement>;
  onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
}

export function OverlayScrollArea({
  children,
  direction = 'vertical',
  scrollbarStyle = 'hidden',
  className,
  viewportClassName,
  contentClassName,
  style,
  viewportStyle,
  contentStyle,
  viewportRef,
  onViewportScroll,
}: OverlayScrollAreaProps) {
  const internalViewportRef = useRef<HTMLDivElement | null>(null);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (direction !== 'horizontal') {
      return;
    }

    const viewport = internalViewportRef.current;
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
        ref={mergeRefs(internalViewportRef, viewportRef)}
        onWheel={handleWheel}
        onScroll={onViewportScroll}
        className={joinClassNames(
          'overlay-scroll-area__viewport',
          `overlay-scroll-area__viewport--${direction}`,
          resolveScrollbarViewportClassName(scrollbarStyle),
          viewportClassName,
        )}
        data-overlay-scrollbar-style={scrollbarStyle}
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

function resolveScrollbarViewportClassName(scrollbarStyle: OverlayScrollbarStyle): string {
  switch (scrollbarStyle) {
    case 'themed':
      return 'overlay-scroll-area__viewport--scrollbar-themed';
    case 'explorer-file-list':
      return 'overlay-scroll-area__viewport--explorer-file-list';
    case 'hidden':
    default:
      return 'overlay-scroll-area__viewport--scrollbar-hidden';
  }
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return value => {
    for (const ref of refs) {
      if (!ref) {
        continue;
      }

      if (typeof ref === 'function') {
        ref(value);
        continue;
      }

      (ref as React.MutableRefObject<T | null>).current = value;
    }
  };
}
