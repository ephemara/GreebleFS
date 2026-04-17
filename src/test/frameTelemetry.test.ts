import {
  OVERLAY_FRAME_TARGET_MS,
  shouldFlushOverlayFrameWindow,
  summarizeOverlayFrameWindow,
} from '../config/frameTelemetry';

describe('frameTelemetry', () => {
  it('summarizes frame windows into fps and p95 data', () => {
    const stats = summarizeOverlayFrameWindow([16, 17, 18, 20, 15, 19], 105);
    expect(stats).not.toBeNull();
    expect(stats?.frameCount).toBe(6);
    expect(stats?.avgFrameMs).toBeGreaterThan(0);
    expect(stats?.avgFps).toBeGreaterThan(0);
    expect(stats?.p95FrameMs).toBe(20);
    expect(stats?.worstFrameMs).toBe(20);
    expect(stats?.overBudgetCount).toBe(
      [16, 17, 18, 20, 15, 19].filter(duration => duration > OVERLAY_FRAME_TARGET_MS).length,
    );
    expect(stats?.withinTarget).toBe(false);
  });

  it('marks frame windows that stay within the 120 fps budget', () => {
    const stats = summarizeOverlayFrameWindow([7.5, 7.8, 8.1, 8.2], 31.6);
    expect(stats).not.toBeNull();
    expect(stats?.overBudgetCount).toBe(0);
    expect(stats?.withinTarget).toBe(true);
  });

  it('waits for a meaningful sample window before flushing', () => {
    expect(shouldFlushOverlayFrameWindow(20, 500)).toBe(false);
    expect(shouldFlushOverlayFrameWindow(90, 500)).toBe(true);
    expect(shouldFlushOverlayFrameWindow(20, 1500)).toBe(true);
  });
});
