import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { detectClientPlatform } from '../config/platform';

type OverlayScrollDirection = 'vertical' | 'horizontal' | 'both';
type OverlayScrollbarStyle = 'hidden' | 'themed' | 'explorer-file-list';

interface OverlayScrollAreaProps {
  children: React.ReactNode;
  direction?: OverlayScrollDirection;
  scrollbarStyle?: OverlayScrollbarStyle;
  inertialScroll?: boolean;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
  viewportStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  viewportRef?: React.Ref<HTMLDivElement>;
  onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
}

const INERTIAL_SCROLL_IMMEDIATE_DELTA_FACTOR = 0.38;
const INERTIAL_SCROLL_DELTA_CLAMP_PX = 180;
const INERTIAL_SCROLL_VELOCITY_BLEND_FACTOR = 0.28;
const INERTIAL_SCROLL_VELOCITY_CARRY_FACTOR = 0.32;
const INERTIAL_SCROLL_VELOCITY_CLAMP_PX = 180;
const INERTIAL_SCROLL_FRICTION_PER_FRAME = 0.84;
const INERTIAL_SCROLL_MIN_VELOCITY_PX = 0.28;

export function OverlayScrollArea({
  children,
  direction = 'vertical',
  scrollbarStyle = 'hidden',
  inertialScroll = false,
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
  const inertialScrollFrameRef = useRef<number | null>(null);
  const inertialScrollVelocityRef = useRef({ x: 0, y: 0 });
  const inertialScrollLastFrameAtRef = useRef<number | null>(null);
  const scheduleScrollbarPresentationSyncRef =
    useRef<(options?: { sustain?: boolean }) => void>(() => {});
  const scrollbarSettleFramesRemainingRef = useRef(0);
  const stableScrollbarMeasurementFramesRef = useRef(0);
  const lastScrollbarMeasurementRef =
    useRef<OverlayScrollbarMeasurementSnapshot | null>(null);
  const scrollbarDragStateRef = useRef<OverlayScrollbarDragState | null>(null);
  const runtimePlatformRef = useRef(detectClientPlatform());

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
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

  const syncScrollbarPresentation =
    useCallback((): OverlayScrollbarMeasurementSnapshot | null => {
    const root = rootRef.current;
    const viewport = internalViewportRef.current;
    if (!root || !viewport) {
      return null;
    }

    const measurement = readScrollbarMeasurementSnapshot(viewport);
    if (scrollbarStyle === 'hidden') {
      root.dataset.overlayVerticalScrollbarVisible = 'false';
      root.dataset.overlayHorizontalScrollbarVisible = 'false';
      root.style.setProperty('--overlay-scroll-area-vertical-reserve', '0px');
      root.style.setProperty('--overlay-scroll-area-horizontal-reserve', '0px');
      return measurement;
    }

    const computedStyle = window.getComputedStyle(root);
    const resolvedScrollbarSize = Number.parseFloat(
      computedStyle.getPropertyValue('--overlay-scrollbar-size'),
    );
    const scrollbarSizePx = Number.isFinite(resolvedScrollbarSize)
      ? resolvedScrollbarSize
      : 11;
    const verticalScrollbarVisible =
      direction !== 'horizontal'
      && viewport.scrollHeight > viewport.clientHeight + 1;
    const horizontalScrollbarVisible =
      direction !== 'vertical'
      && viewport.scrollWidth > viewport.clientWidth + 1;

    root.dataset.overlayVerticalScrollbarVisible = verticalScrollbarVisible
      ? 'true'
      : 'false';
    root.dataset.overlayHorizontalScrollbarVisible = horizontalScrollbarVisible
      ? 'true'
      : 'false';
    root.style.setProperty(
      '--overlay-scroll-area-vertical-reserve',
      verticalScrollbarVisible ? `${scrollbarSizePx}px` : '0px',
    );
    root.style.setProperty(
      '--overlay-scroll-area-horizontal-reserve',
      horizontalScrollbarVisible ? `${scrollbarSizePx}px` : '0px',
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
  }, [direction, scrollbarStyle]);

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
  scheduleScrollbarPresentationSyncRef.current = scheduleScrollbarPresentationSync;

  const stopInertialScroll = useCallback(() => {
    if (inertialScrollFrameRef.current != null) {
      window.cancelAnimationFrame(inertialScrollFrameRef.current);
      inertialScrollFrameRef.current = null;
    }
    inertialScrollVelocityRef.current = { x: 0, y: 0 };
    inertialScrollLastFrameAtRef.current = null;
  }, []);

  const applyInertialScrollDelta = useCallback((
    viewport: HTMLDivElement,
    deltaX: number,
    deltaY: number,
  ): boolean => {
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const nextScrollLeft = clampNumber(
      viewport.scrollLeft + deltaX,
      0,
      maxScrollLeft,
    );
    const nextScrollTop = clampNumber(
      viewport.scrollTop + deltaY,
      0,
      maxScrollTop,
    );
    const didMove =
      Math.abs(nextScrollLeft - viewport.scrollLeft) > 0.01 ||
      Math.abs(nextScrollTop - viewport.scrollTop) > 0.01;

    viewport.scrollLeft = nextScrollLeft;
    viewport.scrollTop = nextScrollTop;
    return didMove;
  }, []);

  const stepInertialScroll = useCallback((frameTime: number) => {
    const viewport = internalViewportRef.current;
    if (!viewport) {
      stopInertialScroll();
      return;
    }

    const lastFrameAt = inertialScrollLastFrameAtRef.current ?? frameTime;
    inertialScrollLastFrameAtRef.current = frameTime;
    const frameScale = clampNumber((frameTime - lastFrameAt) / 16.67, 0.5, 2.4);
    const velocity = inertialScrollVelocityRef.current;
    const didMove = applyInertialScrollDelta(
      viewport,
      velocity.x * frameScale,
      velocity.y * frameScale,
    );
    const friction = Math.pow(INERTIAL_SCROLL_FRICTION_PER_FRAME, frameScale);
    const nextVelocity = {
      x: velocity.x * friction,
      y: velocity.y * friction,
    };
    const shouldContinue =
      didMove &&
      (
        Math.abs(nextVelocity.x) > INERTIAL_SCROLL_MIN_VELOCITY_PX ||
        Math.abs(nextVelocity.y) > INERTIAL_SCROLL_MIN_VELOCITY_PX
      );

    if (!shouldContinue) {
      stopInertialScroll();
      scheduleScrollbarPresentationSyncRef.current();
      return;
    }

    inertialScrollVelocityRef.current = nextVelocity;
    scheduleScrollbarPresentationSyncRef.current();
    inertialScrollFrameRef.current = window.requestAnimationFrame(stepInertialScroll);
  }, [applyInertialScrollDelta, stopInertialScroll]);

  const startInertialScroll = useCallback((deltaX: number, deltaY: number) => {
    const clampedDeltaX = clampNumber(
      deltaX,
      -INERTIAL_SCROLL_DELTA_CLAMP_PX,
      INERTIAL_SCROLL_DELTA_CLAMP_PX,
    );
    const clampedDeltaY = clampNumber(
      deltaY,
      -INERTIAL_SCROLL_DELTA_CLAMP_PX,
      INERTIAL_SCROLL_DELTA_CLAMP_PX,
    );
    const currentVelocity = inertialScrollVelocityRef.current;
    inertialScrollVelocityRef.current = {
      x: clampNumber(
        currentVelocity.x * INERTIAL_SCROLL_VELOCITY_CARRY_FACTOR +
          clampedDeltaX * INERTIAL_SCROLL_VELOCITY_BLEND_FACTOR,
        -INERTIAL_SCROLL_VELOCITY_CLAMP_PX,
        INERTIAL_SCROLL_VELOCITY_CLAMP_PX,
      ),
      y: clampNumber(
        currentVelocity.y * INERTIAL_SCROLL_VELOCITY_CARRY_FACTOR +
          clampedDeltaY * INERTIAL_SCROLL_VELOCITY_BLEND_FACTOR,
        -INERTIAL_SCROLL_VELOCITY_CLAMP_PX,
        INERTIAL_SCROLL_VELOCITY_CLAMP_PX,
      ),
    };

    if (inertialScrollFrameRef.current == null) {
      inertialScrollLastFrameAtRef.current = null;
      inertialScrollFrameRef.current = window.requestAnimationFrame(stepInertialScroll);
    }
  }, [stepInertialScroll]);

  useEffect(() => {
    const viewport = internalViewportRef.current;
    if (!viewport || !inertialScroll) {
      stopInertialScroll();
      return;
    }

    const handleInertialWheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        shouldReduceScrollMotion()
      ) {
        stopInertialScroll();
        return;
      }

      const delta = normalizeWheelDeltaForViewport(event, viewport);
      const scrollDelta = resolveInertialScrollDelta(direction, delta);
      if (Math.abs(scrollDelta.x) < 0.01 && Math.abs(scrollDelta.y) < 0.01) {
        return;
      }

      if (shouldUseNativePixelScroll(event, runtimePlatformRef.current)) {
        stopInertialScroll();
        return;
      }

      const immediateScrollDelta = {
        x: scrollDelta.x * INERTIAL_SCROLL_IMMEDIATE_DELTA_FACTOR,
        y: scrollDelta.y * INERTIAL_SCROLL_IMMEDIATE_DELTA_FACTOR,
      };
      const carriedMomentumDelta = {
        x: scrollDelta.x - immediateScrollDelta.x,
        y: scrollDelta.y - immediateScrollDelta.y,
      };

      event.preventDefault();
      const didMove = applyInertialScrollDelta(
        viewport,
        immediateScrollDelta.x,
        immediateScrollDelta.y,
      );
      if (didMove) {
        startInertialScroll(
          carriedMomentumDelta.x,
          carriedMomentumDelta.y,
        );
        scheduleScrollbarPresentationSync();
      } else {
        stopInertialScroll();
      }
    };

    viewport.addEventListener('wheel', handleInertialWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleInertialWheel);
      stopInertialScroll();
    };
  }, [
    applyInertialScrollDelta,
    direction,
    inertialScroll,
    scheduleScrollbarPresentationSync,
    startInertialScroll,
    stopInertialScroll,
  ]);

  const handleViewportScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    onViewportScroll?.(event);
    scheduleScrollbarPresentationSync();
  }, [onViewportScroll, scheduleScrollbarPresentationSync]);

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

    stopInertialScroll();
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
  }, [handleScrollbarDragPointerEnd, handleScrollbarDragPointerMove, stopInertialScroll]);

  useLayoutEffect(() => {
    scheduleScrollbarPresentationSync({ sustain: true });
  }, [children, contentClassName, contentStyle, direction, scheduleScrollbarPresentationSync, scrollbarStyle, viewportClassName, viewportStyle]);

  useEffect(() => {
    const viewport = internalViewportRef.current;
    const content = contentRef.current;
    if (!viewport) {
      return;
    }

    scheduleScrollbarPresentationSync({ sustain: true });

    const handleWindowResize = () => {
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
  }, [children, handleScrollbarDragPointerEnd, scheduleScrollbarPresentationSync]);

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
        onWheel={handleWheel}
        onPointerDown={stopInertialScroll}
        onScroll={handleViewportScroll}
        className={joinClassNames(
          'overlay-scroll-area__viewport',
          `overlay-scroll-area__viewport--${direction}`,
          resolveScrollbarViewportClassName(scrollbarStyle),
          viewportClassName,
        )}
        data-overlay-scrollbar-style={scrollbarStyle}
        data-overlay-inertial-scroll={inertialScroll ? 'true' : 'false'}
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
      {scrollbarStyle !== 'hidden' ? (
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

  track.dataset.visible = visible ? 'true' : 'false';
  if (!visible) {
    thumb.style.transform = axis === 'vertical'
      ? 'translate3d(0, 0, 0)'
      : 'translate3d(0, 0, 0)';
    if (axis === 'vertical') {
      thumb.style.height = '0px';
    } else {
      thumb.style.width = '0px';
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
    thumb.style.minHeight = `${minimumThumbSize}px`;
    thumb.style.height = `${thumbSize}px`;
    thumb.style.transform = `translate3d(0, ${thumbOffset}px, 0)`;
  } else {
    thumb.style.minWidth = `${minimumThumbSize}px`;
    thumb.style.width = `${thumbSize}px`;
    thumb.style.transform = `translate3d(${thumbOffset}px, 0, 0)`;
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
    && first.scrollLeft === second.scrollLeft
    && first.scrollTop === second.scrollTop
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

function shouldReduceScrollMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function shouldUseNativePixelScroll(
  event: WheelEvent,
  runtimePlatform: ReturnType<typeof detectClientPlatform>,
): boolean {
  // WebView2 already delivers high-resolution pixel wheel deltas for precision
  // devices on Windows. Replaying those through our synthetic inertia made the
  // explorer feel chunked, so let native scrolling own that lane.
  return (
    runtimePlatform === 'windows' &&
    event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
  );
}

function normalizeWheelDeltaForViewport(
  event: WheelEvent,
  viewport: HTMLDivElement,
): { x: number; y: number } {
  const scale =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 18
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? Math.max(1, viewport.clientHeight)
        : 1;
  return {
    x: event.deltaX * scale,
    y: event.deltaY * scale,
  };
}

function resolveInertialScrollDelta(
  direction: OverlayScrollDirection,
  delta: { x: number; y: number },
): { x: number; y: number } {
  if (direction === 'horizontal') {
    return {
      x: Math.abs(delta.y) > Math.abs(delta.x) ? delta.y : delta.x,
      y: 0,
    };
  }
  if (direction === 'vertical') {
    return { x: 0, y: delta.y };
  }
  return delta;
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
