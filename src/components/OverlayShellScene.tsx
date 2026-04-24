import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  AnimationOverlayLayer,
  resolveAnimationShellStyle,
  type LoadedOverlayAnimation,
} from './animationRuntime';
import type { OverlayThemeDefinition } from '../config/appearance';
import type {
  OverlayAnimationDirection,
  OverlayAnimationPhase,
  OverlayAnimationVerticalOrigin,
} from '../config/overlayAnimations';

export interface OverlayShellSceneProps {
  animation: LoadedOverlayAnimation | null;
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  durationMs: number;
  baseOpacity: number;
  intensity: number;
  verticalOrigin: OverlayAnimationVerticalOrigin;
  accentColor: string;
  blurStrength: number;
  zoom: number;
  theme: OverlayThemeDefinition;
  viewportWidth: number;
  viewportHeight: number;
  frameStyle: CSSProperties;
  transformOrigin: string;
  containerStyle: CSSProperties;
  backgroundLayers: ReactNode;
  contentLayer: ReactNode;
  showAnimationOverlay: boolean;
}

export const OverlayShellScene = memo(function OverlayShellScene({
  animation,
  phase,
  direction,
  durationMs,
  baseOpacity,
  intensity,
  verticalOrigin,
  accentColor,
  blurStrength,
  zoom,
  theme,
  viewportWidth,
  viewportHeight,
  frameStyle,
  transformOrigin,
  containerStyle,
  backgroundLayers,
  contentLayer,
  showAnimationOverlay,
}: OverlayShellSceneProps) {
  const animationProgress = useOverlayAnimationProgress({
    animation,
    phase,
    direction,
    durationMs,
  });
  const animationContext = useMemo(
    () => ({
      animation: animation ?? {
        id: 'builtin:none',
        name: 'Animation',
        filePath: 'builtin:animation',
        animationRoot: 'builtin',
        source: 'built-in' as const,
      },
      phase,
      direction,
      progress: animationProgress,
      durationMs,
      baseOpacity,
      intensity,
      verticalOrigin,
      accentColor,
      blurStrength,
      zoom,
      theme,
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
        anchoredTo: verticalOrigin,
      },
    }),
    [
      accentColor,
      animation,
      animationProgress,
      baseOpacity,
      blurStrength,
      direction,
      durationMs,
      intensity,
      phase,
      theme,
      verticalOrigin,
      viewportHeight,
      viewportWidth,
      zoom,
    ],
  );
  const shellAnimationStyle = useMemo(
    () => resolveAnimationShellStyle(animation, animationContext),
    [animation, animationContext],
  );
  const combinedShellTransform = typeof shellAnimationStyle.transform === 'string'
    ? `${shellAnimationStyle.transform} scale(${zoom})`
    : `scale(${zoom})`;

  return (
    <div style={frameStyle}>
      <div
        style={{
          width: '100%',
          height: '100%',
          ...shellAnimationStyle,
          transform: combinedShellTransform,
          transformOrigin,
        }}
      >
        <div style={containerStyle}>
          {backgroundLayers}
          {showAnimationOverlay ? (
            <AnimationOverlayLayer animation={animation} context={animationContext} />
          ) : null}
          {contentLayer}
        </div>
      </div>
    </div>
  );
});

function resolveStaticAnimationProgress(phase: OverlayAnimationPhase): number {
  if (phase === 'open') {
    return 1;
  }

  return 0;
}

function useOverlayAnimationProgress(args: {
  animation: LoadedOverlayAnimation | null;
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  durationMs: number;
}): number {
  const [progress, setProgress] = useState(() =>
    resolveStaticAnimationProgress(args.phase),
  );
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const shouldRunFrameLoop =
      args.animation?.source === 'folder'
      && (args.phase === 'opening' || args.phase === 'closing');
    if (!shouldRunFrameLoop) {
      setProgress(resolveStaticAnimationProgress(args.phase));
      return;
    }

    let cancelled = false;
    const safeDurationMs = Math.max(args.durationMs, 1);
    const startedAt = performance.now();
    setProgress(0);

    const tick = (frameNow: number) => {
      if (cancelled) {
        return;
      }

      const nextProgress = Math.min(
        Math.max((frameNow - startedAt) / safeDurationMs, 0),
        1,
      );
      setProgress(nextProgress);
      if (nextProgress >= 1) {
        frameRef.current = null;
        return;
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [args.animation?.id, args.animation?.source, args.direction, args.durationMs, args.phase]);

  return progress;
}
