import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const activeResizePointerIdRef = useRef<number | null>(null);
  const previewSizeRef = useRef<number | null>(null);

  const applyPreviewSize = useCallback((nextSize: number) => {
    const paneElement = rootRef.current;
    if (!paneElement) {
      return;
    }

    const widthPx = `${Math.round(nextSize)}px`;
    paneElement.style.width = widthPx;
    paneElement.style.minWidth = widthPx;
    paneElement.style.maxWidth = widthPx;
  }, []);

  const cancelPreviewFrame = useCallback(() => {
    if (previewFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(previewFrameRef.current);
    }
    previewFrameRef.current = null;
  }, []);

  const schedulePreviewFlush = useCallback(() => {
    if (previewFrameRef.current !== null || typeof window === 'undefined') {
      return;
    }

    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null;
      if (previewSizeRef.current != null) {
        applyPreviewSize(previewSizeRef.current);
      }
    });
  }, [applyPreviewSize]);

  useEffect(() => {
    if (activeResizePointerIdRef.current != null) {
      return;
    }

    previewSizeRef.current = null;
    applyPreviewSize(clampPanelSize(size, minSize, maxSize));
  }, [applyPreviewSize, maxSize, minSize, size]);

  useEffect(
    () => () => {
      cancelPreviewFrame();
      activeResizePointerIdRef.current = null;
      previewSizeRef.current = null;
    },
    [cancelPreviewFrame],
  );

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
      ref={rootRef}
      data-resizable-pane-root="true"
      style={{
        width: previewSizeRef.current ?? size,
        minWidth: previewSizeRef.current ?? size,
        maxWidth: previewSizeRef.current ?? size,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
      <div
        data-resizable-pane-handle={handleSide}
        onPointerDown={event => {
          if (event.button !== 0) {
            return;
          }
          event.preventDefault();
          const startX = event.clientX;
          const startSize = size;
          const direction = handleSide === 'right' ? 1 : -1;
          const handleElement = event.currentTarget;
          const paneElement = rootRef.current;
          const previousUserSelect = document.body.style.userSelect;
          const previousCursor = document.body.style.cursor;
          const previousWillChange = paneElement?.style.willChange ?? '';

          activeResizePointerIdRef.current = event.pointerId;
          previewSizeRef.current = clampPanelSize(startSize, minSize, maxSize);
          applyPreviewSize(previewSizeRef.current);
          if (paneElement) {
            paneElement.style.willChange = 'width';
          }
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'col-resize';
          handleElement.style.background = borderColor;

          if (typeof handleElement.setPointerCapture === 'function') {
            try {
              handleElement.setPointerCapture(event.pointerId);
            } catch {
              // Ignore pointer-capture failures and rely on global listeners.
            }
          }

          const cleanupResize = (nextCommittedSize: number | null) => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerCancel);
            window.removeEventListener('blur', onWindowBlur);
            window.removeEventListener('keydown', onWindowKeyDown);
            document.body.style.userSelect = previousUserSelect;
            document.body.style.cursor = previousCursor;
            handleElement.style.background = 'transparent';
            if (paneElement) {
              paneElement.style.willChange = previousWillChange;
            }

            if (typeof handleElement.releasePointerCapture === 'function') {
              try {
                handleElement.releasePointerCapture(event.pointerId);
              } catch {
                // Ignore pointer-capture release failures for browsers/tests.
              }
            }

            cancelPreviewFrame();
            activeResizePointerIdRef.current = null;

            if (nextCommittedSize == null) {
              previewSizeRef.current = null;
              applyPreviewSize(clampPanelSize(startSize, minSize, maxSize));
              return;
            }

            previewSizeRef.current = null;
            applyPreviewSize(nextCommittedSize);
            if (nextCommittedSize !== size) {
              onSizeChange(nextCommittedSize);
            }
          };

          const resolveNextSize = (clientX: number) =>
            clampPanelSize(startSize + (clientX - startX) * direction, minSize, maxSize);

          const onPointerMove = (moveEvent: PointerEvent) => {
            if (activeResizePointerIdRef.current !== moveEvent.pointerId) {
              return;
            }
            previewSizeRef.current = resolveNextSize(moveEvent.clientX);
            schedulePreviewFlush();
          };

          const onPointerUp = (moveEvent: PointerEvent) => {
            if (activeResizePointerIdRef.current !== moveEvent.pointerId) {
              return;
            }
            cleanupResize(resolveNextSize(moveEvent.clientX));
          };

          const onPointerCancel = (moveEvent: PointerEvent) => {
            if (activeResizePointerIdRef.current !== moveEvent.pointerId) {
              return;
            }
            cleanupResize(null);
          };

          const onWindowBlur = () => {
            cleanupResize(null);
          };

          const onWindowKeyDown = (keyboardEvent: KeyboardEvent) => {
            if (keyboardEvent.key !== 'Escape') {
              return;
            }
            keyboardEvent.preventDefault();
            cleanupResize(null);
          };

          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
          window.addEventListener('pointercancel', onPointerCancel);
          window.addEventListener('blur', onWindowBlur);
          window.addEventListener('keydown', onWindowKeyDown);
        }}
        style={handleStyle}
        onMouseEnter={event => { event.currentTarget.style.background = borderColor; }}
        onMouseLeave={event => { event.currentTarget.style.background = 'transparent'; }}
      />
    </div>
  );
}
