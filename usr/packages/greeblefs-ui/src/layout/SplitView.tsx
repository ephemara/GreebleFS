import React, {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { ResizeHandle } from './ResizeHandle';

export interface SplitViewProps {
  direction?: 'horizontal' | 'vertical';
  first: ReactNode;
  second: ReactNode;
  defaultFirstSize?: number;
  minFirstSize?: number;
  minSecondSize?: number;
  persistId?: string;
  className?: string;
  style?: CSSProperties;
  handleSize?: number;
  firstPaneStyle?: CSSProperties;
  secondPaneStyle?: CSSProperties;
  onFirstSizeChange?: (size: number) => void;
}

export function SplitView({
  direction = 'horizontal',
  first,
  second,
  defaultFirstSize = 50,
  minFirstSize = 20,
  minSecondSize = 20,
  persistId,
  className,
  style,
  handleSize = 8,
  firstPaneStyle,
  secondPaneStyle,
  onFirstSizeChange,
}: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [firstSizePercent, setFirstSizePercent] = useState(defaultFirstSize);
  const storageKey = persistId ? `greeblefs-ui:split-view:${persistId}` : null;

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) {
      return;
    }
    const parsedValue = Number.parseFloat(storedValue);
    if (Number.isFinite(parsedValue)) {
      setFirstSizePercent(clampSplitPercent(parsedValue, minFirstSize, minSecondSize));
    }
  }, [minFirstSize, minSecondSize, storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(storageKey, String(firstSizePercent));
  }, [firstSizePercent, storageKey]);

  const commitSize = (nextPercent: number) => {
    const clampedPercent = clampSplitPercent(nextPercent, minFirstSize, minSecondSize);
    setFirstSizePercent(clampedPercent);
    onFirstSizeChange?.(clampedPercent);
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        minWidth: 0,
        minHeight: 0,
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          flexBasis: `calc(${firstSizePercent}% - ${handleSize / 2}px)`,
          flexGrow: 0,
          flexShrink: 0,
          ...firstPaneStyle,
        }}
      >
        {first}
      </div>
      <ResizeHandle
        direction={direction}
        thickness={handleSize}
        onResize={(delta) => {
          const container = containerRef.current;
          if (!container) {
            return;
          }
          const totalSize = direction === 'horizontal'
            ? container.clientWidth - handleSize
            : container.clientHeight - handleSize;
          if (totalSize <= 0) {
            return;
          }
          const nextPercent = firstSizePercent + ((delta / totalSize) * 100);
          commitSize(nextPercent);
        }}
      />
      <div
        style={{
          position: 'relative',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          flexBasis: `calc(${100 - firstSizePercent}% - ${handleSize / 2}px)`,
          flexGrow: 1,
          flexShrink: 1,
          ...secondPaneStyle,
        }}
      >
        {second}
      </div>
    </div>
  );
}

function clampSplitPercent(
  value: number,
  minFirstSize: number,
  minSecondSize: number,
): number {
  const minimum = Math.max(0, minFirstSize);
  const maximum = Math.max(minimum, 100 - Math.max(0, minSecondSize));
  return Math.min(maximum, Math.max(minimum, value));
}
