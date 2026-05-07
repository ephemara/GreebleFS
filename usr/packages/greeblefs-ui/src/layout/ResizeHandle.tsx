import React, {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

export interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  sensitivity?: number;
  thickness?: number;
  showGrip?: boolean;
}

export const ResizeHandle = React.forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({
    direction,
    onResize,
    onResizeStart,
    onResizeEnd,
    className,
    style,
    disabled = false,
    sensitivity = 1,
    thickness = 8,
    showGrip = true,
  }, ref) => {
    const [isDragging, setIsDragging] = useState(false);
    const lastPositionRef = useRef<number | null>(null);

    useEffect(() => {
      if (!isDragging) {
        return;
      }

      const handlePointerMove = (event: PointerEvent) => {
        if (lastPositionRef.current == null) {
          return;
        }
        const currentPosition = direction === 'horizontal' ? event.clientX : event.clientY;
        const delta = (currentPosition - lastPositionRef.current) * sensitivity;
        if (delta === 0) {
          return;
        }
        lastPositionRef.current = currentPosition;
        onResize(delta);
      };

      const finishDrag = () => {
        setIsDragging(false);
        lastPositionRef.current = null;
        document.body.style.cursor = '';
        onResizeEnd?.();
      };

      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', finishDrag);
      window.addEventListener('pointercancel', finishDrag);
      window.addEventListener('blur', finishDrag);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', finishDrag);
        window.removeEventListener('pointercancel', finishDrag);
        window.removeEventListener('blur', finishDrag);
        document.body.style.cursor = '';
      };
    }, [direction, isDragging, onResize, onResizeEnd, sensitivity]);

    return (
      <div
        ref={ref}
        role="separator"
        tabIndex={disabled ? -1 : 0}
        aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
        className={className}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) {
            return;
          }
          lastPositionRef.current = direction === 'horizontal' ? event.clientX : event.clientY;
          setIsDragging(true);
          onResizeStart?.();
          event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }
          const amount = event.shiftKey ? 48 : 12;
          if (direction === 'horizontal') {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              onResizeStart?.();
              onResize(-amount);
              onResizeEnd?.();
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              onResizeStart?.();
              onResize(amount);
              onResizeEnd?.();
            }
          } else {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              onResizeStart?.();
              onResize(-amount);
              onResizeEnd?.();
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              onResizeStart?.();
              onResize(amount);
              onResizeEnd?.();
            }
          }
        }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          outline: 'none',
          cursor: disabled ? 'default' : direction === 'horizontal' ? 'col-resize' : 'row-resize',
          background: isDragging
            ? 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)'
            : 'transparent',
          transition: 'background 120ms ease',
          width: direction === 'horizontal' ? thickness : '100%',
          height: direction === 'vertical' ? thickness : '100%',
          ...style,
        }}
      >
        {showGrip ? (
          <div
            aria-hidden="true"
            style={{
              width: direction === 'horizontal' ? 4 : 28,
              height: direction === 'horizontal' ? 28 : 4,
              borderRadius: 999,
              background: isDragging
                ? 'var(--overlay-accent, #60a5fa)'
                : 'color-mix(in srgb, var(--overlay-text-muted) 72%, transparent)',
              boxShadow: isDragging ? '0 0 0 1px rgba(255,255,255,0.08)' : 'none',
            }}
          />
        ) : null}
      </div>
    );
  },
);

ResizeHandle.displayName = 'ResizeHandle';
