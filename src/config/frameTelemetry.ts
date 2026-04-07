import { recordExplorerPerformanceSample } from './performanceTelemetry';
import type { ExplorerPerformanceSample } from './performanceTelemetry';

export const OVERLAY_FRAME_TARGET_MS = 1000 / 60;
const FRAME_TELEMETRY_MIN_SAMPLES = 90;
const FRAME_TELEMETRY_MIN_WINDOW_MS = 1_500;

export interface OverlayFrameTelemetryStats {
  avgFrameMs: number;
  avgFps: number;
  p95FrameMs: number;
  worstFrameMs: number;
  frameCount: number;
  overBudgetCount: number;
  withinTarget: boolean;
  windowDurationMs: number;
}

export function shouldFlushOverlayFrameWindow(frameCount: number, windowDurationMs: number): boolean {
  return frameCount >= FRAME_TELEMETRY_MIN_SAMPLES || windowDurationMs >= FRAME_TELEMETRY_MIN_WINDOW_MS;
}

export function summarizeOverlayFrameWindow(
  frameDurations: readonly number[],
  windowDurationMs: number,
): OverlayFrameTelemetryStats | null {
  if (frameDurations.length === 0 || windowDurationMs <= 0) {
    return null;
  }

  const sorted = [...frameDurations].sort((left, right) => left - right);
  const total = sorted.reduce((sum, duration) => sum + duration, 0);
  const avgFrameMs = roundMetric(total / sorted.length);
  const p95Index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.95) - 1),
  );
  const p95FrameMs = roundMetric(sorted[p95Index] ?? sorted[sorted.length - 1] ?? 0);
  const worstFrameMs = roundMetric(sorted[sorted.length - 1] ?? 0);

  const overBudgetCount = frameDurations.filter(duration => duration > OVERLAY_FRAME_TARGET_MS).length;

  return {
    avgFrameMs,
    avgFps: avgFrameMs > 0 ? roundMetric(1000 / avgFrameMs) : 0,
    p95FrameMs,
    worstFrameMs,
    frameCount: frameDurations.length,
    overBudgetCount,
    withinTarget: overBudgetCount === 0 && p95FrameMs <= roundMetric(OVERLAY_FRAME_TARGET_MS),
    windowDurationMs: roundMetric(windowDurationMs),
  };
}

export function recordOverlayFrameTelemetry(
  stats: OverlayFrameTelemetryStats,
  metadata: Record<string, string | number | boolean | null> = {},
): ExplorerPerformanceSample {
  const sample: ExplorerPerformanceSample = {
    metricId: 'overlay_frame_time',
    durationMs: stats.p95FrameMs,
    recordedAt: Date.now(),
    metadata: {
      avgFps: stats.avgFps,
      avgFrameMs: stats.avgFrameMs,
      frameCount: stats.frameCount,
      overBudgetCount: stats.overBudgetCount,
      targetFps: 60,
      targetFrameMs: roundMetric(OVERLAY_FRAME_TARGET_MS),
      withinTarget: stats.withinTarget,
      windowDurationMs: stats.windowDurationMs,
      worstFrameMs: stats.worstFrameMs,
      ...metadata,
    },
  };
  recordExplorerPerformanceSample(sample);
  return sample;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}
