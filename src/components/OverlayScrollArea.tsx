import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const internalViewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const verticalTrackRef = useRef<HTMLDivElement | null>(null);
  const verticalThumbRef = useRef<HTMLDivElement | null>(null);
  const horizontalTrackRef = useRef<HTMLDivElement | null>(null);
  const horizontalThumbRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollbarSyncFrameRef = useRef<number | null>(null);
  const scrollbarSettleFramesRemainingRef = useRef(0);
  const stableScrollbarMeasurementFramesRef = useRef(0);
  const lastScrollbarMeasurementRef =
    useRef<OverlayScrollbarMeasurementSnapshot | null>(null);
  const scrollbarDragStateRef = useRef<OverlayScrollbarDragState | null>(null);
  const scrollbarSizePxRef = useRef(11);
  const usesAppOwnedScrollbarChrome = scrollbarStyle === 'themed';

  const refreshScrollbarSizeFromStyle = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const resolvedScrollbarSize = Number.parseFloat(
      window.getComputedStyle(root).getPropertyValue('--overlay-scrollbar-size'),
    );
    scrollbarSizePxRef.current = Number.isFinite(resolvedScrollbarSize)
      ? resolvedScrollbarSize
      : 11;
  }, []);

  const syncScrollbarPresentation =
    useCallback((): OverlayScrollbarMeasurementSnapshot | null => {
    const root = rootRef.current;
    const viewport = internalViewportRef.current;
    if (!root || !viewport) {
      return null;
    }

    const measurement = readScrollbarMeasurementSnapshot(viewport);
    if (!usesAppOwnedScrollbarChrome) {
      setDatasetValueIfChanged(root, 'overlayVerticalScrollbarVisible', 'false');
      setDatasetValueIfChanged(root, 'overlayHorizontalScrollbarVisible', 'false');
      setStylePropertyIfChanged(root, '--overlay-scroll-area-vertical-reserve', '0');
      setStylePropertyIfChanged(root, '--overlay-scroll-area-horizontal-reserve', '0');
      return measurement;
    }

    const scrollbarSizePx = scrollbarSizePxRef.current;
    const verticalScrollbarVisible =
      direction !== 'horizontal'
      && viewport.scrollHeight > viewport.clientHeight + 1;
    const horizontalScrollbarVisible =
      direction !== 'vertical'
      && viewport.scrollWidth > viewport.clientWidth + 1;

    setDatasetValueIfChanged(
      root,
      'overlayVerticalScrollbarVisible',
      verticalScrollbarVisible ? 'true' : 'false',
    );
    setDatasetValueIfChanged(
      root,
      'overlayHorizontalScrollbarVisible',
      horizontalScrollbarVisible ? 'true' : 'false',
    );
    setStylePropertyIfChanged(
      root,
      '--overlay-scroll-area-vertical-reserve',
      verticalScrollbarVisible ? `${scrollbarSizePx}px` : '0',
    );
    setStylePropertyIfChanged(
      root,
      '--overlay-scroll-area-horizontal-reserve',
      horizontalScrollbarVisible ? `${scrollbarSizePx}px` : '0',
    );

    syncAxisScrollbarPresentation({
      axis: 'vertical',
      thumb: verticalThumbRef.current,
      track: verticalTrackRef.current,
      visible: verticalScrollbarVisible,
      viewport,
    });
    syncAxisScrollbarPresentation({
      axis: 'horizontal',
      thumb: horizontalThumbRef.current,
      track: horizontalTrackRef.current,
      visible: horizontalScrollbarVisible,
      viewport,
    });
    return measurement;
  }, [direction, usesAppOwnedScrollbarChrome]);

  const scheduleScrollbarPresentationSync = useCallback((options?: {
    sustain?: boolean;
  }) => {
    if (options?.sustain) {
      scrollbarSettleFramesRemainingRef.current = Math.max(
        scrollbarSettleFramesRemainingRef.current,
        18,
      );
      stableScrollbarMeasurementFramesRef.current = 0;
    }
    if (pendingScrollbarSyncFrameRef.current != null) {
      return;
    }

    pendingScrollbarSyncFrameRef.current = window.requestAnimationFrame(() => {
      pendingScrollbarSyncFrameRef.current = null;
      const measurement = syncScrollbarPresentation();
      const shouldKeepSettling =
        scrollbarSettleFramesRemainingRef.current > 0 && measurement != null;
      if (!shouldKeepSettling) {
        lastScrollbarMeasurementRef.current = measurement;
        stableScrollbarMeasurementFramesRef.current = 0;
        return;
      }

      const previousMeasurement = lastScrollbarMeasurementRef.current;
      const isStable =
        previousMeasurement != null &&
        areScrollbarMeasurementsEqual(previousMeasurement, measurement);
      stableScrollbarMeasurementFramesRef.current = isStable
        ? stableScrollbarMeasurementFramesRef.current + 1
        : 0;
      lastScrollbarMeasurementRef.current = measurement;
      scrollbarSettleFramesRemainingRef.current = Math.max(
        0,
        scrollbarSettleFramesRemainingRef.current - 1,
      );

      if (
        stableScrollbarMeasurementFramesRef.current < 2 &&
        scrollbarSettleFramesRemainingRef.current > 0
      ) {
        scheduleScrollbarPresentationSync();
        return;
      }

      scrollbarSettleFramesRemainingRef.current = 0;
      stableScrollbarMeasurementFramesRef.current = 0;
    });
  }, [syncScrollbarPresentation]);
  const handleViewportScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    onViewportScroll?.(event);
    if (usesAppOwnedScrollbarChrome) {
      scheduleScrollbarPresentationSync();
    }
  }, [
    onViewportScroll,
    scheduleScrollbarPresentationSync,
    usesAppOwnedScrollbarChrome,
  ]);

  const handleScrollbarDragPointerMove = useCallback((event: PointerEvent) => {
    const dragState = scrollbarDragStateRef.current;
    const viewport = internalViewportRef.current;
    if (!dragState || !viewport) {
      return;
    }

    const pointerOffset =
      dragState.axis === 'vertical'
        ? event.clientY - dragState.trackStart - dragState.thumbPointerOffset
        : event.clientX - dragState.trackStart - dragState.thumbPointerOffset;
    const maxThumbTravel = Math.max(1, dragState.trackSize - dragState.thumbSize);
    const nextScrollRatio = clampNumber(pointerOffset / maxThumbTravel, 0, 1);
    const nextScrollOffset = nextScrollRatio * dragState.maxScrollOffset;

    if (dragState.axis === 'vertical') {
      viewport.scrollTop = nextScrollOffset;
    } else {
      viewport.scrollLeft = nextScrollOffset;
    }

    syncScrollbarPresentation();
  }, [syncScrollbarPresentation]);

  const handleScrollbarDragPointerEnd = useCallback(() => {
    scrollbarDragStateRef.current = null;
    window.removeEventListener('pointermove', handleScrollbarDragPointerMove);
    window.removeEventListener('pointerup', handleScrollbarDragPointerEnd);
    window.removeEventListener('pointercancel', handleScrollbarDragPointerEnd);
  }, [handleScrollbarDragPointerMove]);

  const beginScrollbarDrag = useCallback((args: {
    axis: OverlayScrollbarAxis;
    event: React.PointerEvent<HTMLDivElement>;
    source: 'thumb' | 'track';
  }) => {
    const viewport = internalViewportRef.current;
    const trackElement =
      args.axis === 'vertical' ? verticalTrackRef.current : horizontalTrackRef.current;
    const thumbElement =
      args.axis === 'vertical' ? verticalThumbRef.current : horizontalThumbRef.current;
    if (!viewport || !trackElement || !thumbElement) {
      return;
    }

    const trackRect = trackElement.getBoundingClientRect();
    const thumbRect = thumbElement.getBoundingClientRect();
    const trackSize =
      args.axis === 'vertical' ? trackRect.height : trackRect.width;
    const thumbSize =
      args.axis === 'vertical' ? thumbRect.height : thumbRect.width;
    const maxScrollOffset =
      args.axis === 'vertical'
        ? Math.max(0, viewport.scrollHeight - viewport.clientHeight)
        : Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    if (trackSize <= 0 || thumbSize <= 0 || maxScrollOffset <= 0) {
      return;
    }

    args.event.preventDefault();
    args.event.stopPropagation();

    const thumbPointerOffset = args.source === 'thumb'
      ? (
          args.axis === 'vertical'
            ? args.event.clientY - thumbRect.top
            : args.event.clientX - thumbRect.left
        )
      : thumbSize / 2;

    scrollbarDragStateRef.current = {
      axis: args.axis,
      maxScrollOffset,
      thumbPointerOffset,
      thumbSize,
      trackSize,
      trackStart: args.axis === 'vertical' ? trackRect.top : trackRect.left,
    };

    window.addEventListener('pointermove', handleScrollbarDragPointerMove);
    window.addEventListener('pointerup', handleScrollbarDragPointerEnd);
    window.addEventListener('pointercancel', handleScrollbarDragPointerEnd);
    handleScrollbarDragPointerMove(args.event.nativeEvent);
  }, [handleScrollbarDragPointerEnd, handleScrollbarDragPointerMove]);

  useLayoutEffect(() => {
    if (!usesAppOwnedScrollbarChrome) {
      return;
    }
    refreshScrollbarSizeFromStyle();
    scheduleScrollbarPresentationSync({ sustain: true });
  }, [
    contentClassName,
    contentStyle,
    direction,
    refreshScrollbarSizeFromStyle,
    scheduleScrollbarPresentationSync,
    usesAppOwnedScrollbarChrome,
    viewportClassName,
    viewportStyle,
  ]);

  useEffect(() => {
    if (!usesAppOwnedScrollbarChrome) {
      handleScrollbarDragPointerEnd();
      if (pendingScrollbarSyncFrameRef.current != null) {
        window.cancelAnimationFrame(pendingScrollbarSyncFrameRef.current);
        pendingScrollbarSyncFrameRef.current = null;
      }
      return;
    }

    const viewport = internalViewportRef.current;
    const content = contentRef.current;
    if (!viewport) {
      return;
    }

    refreshScrollbarSizeFromStyle();
    scheduleScrollbarPresentationSync({ sustain: true });

    const handleWindowResize = () => {
      refreshScrollbarSizeFromStyle();
      scheduleScrollbarPresentationSync({ sustain: true });
    };

    window.addEventListener('resize', handleWindowResize);

    if (typeof ResizeObserver !== 'function') {
      return () => {
        window.removeEventListener('resize', handleWindowResize);
        handleScrollbarDragPointerEnd();
        if (pendingScrollbarSyncFrameRef.current != null) {
          window.cancelAnimationFrame(pendingScrollbarSyncFrameRef.current);
          pendingScrollbarSyncFrameRef.current = null;
        }
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      refreshScrollbarSizeFromStyle();
      scheduleScrollbarPresentationSync({ sustain: true });
    });
    resizeObserver.observe(viewport);
    if (content) {
      resizeObserver.observe(content);
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
      handleScrollbarDragPointerEnd();
      if (pendingScrollbarSyncFrameRef.current != null) {
        window.cancelAnimationFrame(pendingScrollbarSyncFrameRef.current);
        pendingScrollbarSyncFrameRef.current = null;
      }
    };
  }, [
    handleScrollbarDragPointerEnd,
    refreshScrollbarSizeFromStyle,
    scheduleScrollbarPresentationSync,
    usesAppOwnedScrollbarChrome,
  ]);

  return (
    <div
      ref={rootRef}
      className={joinClassNames(
        'overlay-scroll-area',
        `overlay-scroll-area--${scrollbarStyle}`,
        className,
      )}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minWidth: 0,
        minHeight: 0,
        position: 'relative',
        ...style,
      }}
    >
      <div
        ref={mergeRefs(internalViewportRef, viewportRef)}
        onScroll={handleViewportScroll}
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
          ref={contentRef}
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
      {usesAppOwnedScrollbarChrome ? (
        <>
          <div
            ref={verticalTrackRef}
            className="overlay-scroll-area__scrollbar overlay-scroll-area__scrollbar--vertical"
            data-visible="false"
            onPointerDown={(event) =>
              beginScrollbarDrag({ axis: 'vertical', event, source: 'track' })
            }
          >
            <div
              ref={verticalThumbRef}
              className="overlay-scroll-area__scrollbar-thumb overlay-scroll-area__scrollbar-thumb--vertical"
              onPointerDown={(event) =>
                beginScrollbarDrag({ axis: 'vertical', event, source: 'thumb' })
              }
            />
          </div>
          <div
            ref={horizontalTrackRef}
            className="overlay-scroll-area__scrollbar overlay-scroll-area__scrollbar--horizontal"
            data-visible="false"
            onPointerDown={(event) =>
              beginScrollbarDrag({ axis: 'horizontal', event, source: 'track' })
            }
          >
            <div
              ref={horizontalThumbRef}
              className="overlay-scroll-area__scrollbar-thumb overlay-scroll-area__scrollbar-thumb--horizontal"
              onPointerDown={(event) =>
                beginScrollbarDrag({ axis: 'horizontal', event, source: 'thumb' })
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

type OverlayScrollbarAxis = 'vertical' | 'horizontal';

interface OverlayScrollbarDragState {
  axis: OverlayScrollbarAxis;
  maxScrollOffset: number;
  thumbPointerOffset: number;
  thumbSize: number;
  trackSize: number;
  trackStart: number;
}

function syncAxisScrollbarPresentation(args: {
  axis: OverlayScrollbarAxis;
  thumb: HTMLDivElement | null;
  track: HTMLDivElement | null;
  visible: boolean;
  viewport: HTMLDivElement;
}) {
  const { axis, thumb, track, visible, viewport } = args;
  if (!thumb || !track) {
    return;
  }

  setDatasetValueIfChanged(track, 'visible', visible ? 'true' : 'false');
  if (!visible) {
    setStylePropertyIfChanged(thumb, 'transform', 'translate3d(0, 0, 0)');
    if (axis === 'vertical') {
      setStylePropertyIfChanged(thumb, 'height', '0');
    } else {
      setStylePropertyIfChanged(thumb, 'width', '0');
    }
    return;
  }

  const trackSize = axis === 'vertical' ? track.clientHeight : track.clientWidth;
  const viewportSize = axis === 'vertical' ? viewport.clientHeight : viewport.clientWidth;
  const scrollSize = axis === 'vertical' ? viewport.scrollHeight : viewport.scrollWidth;
  const scrollOffset = axis === 'vertical' ? viewport.scrollTop : viewport.scrollLeft;
  const maxScrollOffset = Math.max(0, scrollSize - viewportSize);
  const minimumThumbSize = resolveMinimumThumbSize({
    axis,
    scrollSize,
    trackSize,
    viewportSize,
  });
  const thumbSize = clampNumber(
    (viewportSize / scrollSize) * trackSize,
    minimumThumbSize,
    trackSize,
  );
  const maxThumbTravel = Math.max(0, trackSize - thumbSize);
  const thumbOffset = maxScrollOffset > 0
    ? (scrollOffset / maxScrollOffset) * maxThumbTravel
    : 0;

  if (axis === 'vertical') {
    setStylePropertyIfChanged(thumb, 'min-height', `${minimumThumbSize}px`);
    setStylePropertyIfChanged(thumb, 'height', `${thumbSize}px`);
    setStylePropertyIfChanged(thumb, 'transform', `translate3d(0, ${thumbOffset}px, 0)`);
  } else {
    setStylePropertyIfChanged(thumb, 'min-width', `${minimumThumbSize}px`);
    setStylePropertyIfChanged(thumb, 'width', `${thumbSize}px`);
    setStylePropertyIfChanged(thumb, 'transform', `translate3d(${thumbOffset}px, 0, 0)`);
  }
}

interface OverlayScrollbarMeasurementSnapshot {
  clientHeight: number;
  clientWidth: number;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
}

function readScrollbarMeasurementSnapshot(
  viewport: HTMLDivElement,
): OverlayScrollbarMeasurementSnapshot {
  return {
    clientHeight: viewport.clientHeight,
    clientWidth: viewport.clientWidth,
    scrollHeight: viewport.scrollHeight,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
    scrollWidth: viewport.scrollWidth,
  };
}

function areScrollbarMeasurementsEqual(
  first: OverlayScrollbarMeasurementSnapshot,
  second: OverlayScrollbarMeasurementSnapshot,
): boolean {
  return first.clientHeight === second.clientHeight
    && first.clientWidth === second.clientWidth
    && first.scrollHeight === second.scrollHeight
    && first.scrollWidth === second.scrollWidth;
}

function resolveMinimumThumbSize(args: {
  axis: OverlayScrollbarAxis;
  scrollSize: number;
  trackSize: number;
  viewportSize: number;
}): number {
  const { axis, scrollSize, trackSize, viewportSize } = args;
  const compactMinimum = axis === 'vertical' ? 12 : 16;
  const comfortableMinimum = axis === 'vertical' ? 28 : 32;
  if (
    !Number.isFinite(scrollSize) ||
    !Number.isFinite(trackSize) ||
    !Number.isFinite(viewportSize) ||
    scrollSize <= 0 ||
    trackSize <= 0 ||
    viewportSize <= 0
  ) {
    return compactMinimum;
  }

  const overflowRatio = Math.max(1, scrollSize / viewportSize);
  const compressionProgress = clampNumber(Math.log10(overflowRatio) / 3, 0, 1);
  const adaptiveMinimum =
    comfortableMinimum -
    (comfortableMinimum - compactMinimum) * compressionProgress;
  return clampNumber(
    adaptiveMinimum,
    compactMinimum,
    Math.max(compactMinimum, trackSize * 0.45),
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

function setDatasetValueIfChanged(
  element: HTMLElement,
  key: string,
  value: string,
) {
  if (element.dataset[key] === value) {
    return;
  }
  element.dataset[key] = value;
}

function setStylePropertyIfChanged(
  element: HTMLElement,
  propertyName: string,
  value: string,
) {
  if (element.style.getPropertyValue(propertyName) === value) {
    return;
  }
  element.style.setProperty(propertyName, value);
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
