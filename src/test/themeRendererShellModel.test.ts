import { describe, expect, it } from 'vitest';

import { normalizeThemeRendererShellLayout } from '../components/themeRendererShellModel';

describe('themeRendererShellModel', () => {
  it('clamps shell geometry so content stays within the viewport', () => {
    const model = normalizeThemeRendererShellLayout({
      viewportWidth: 900,
      viewportHeight: 640,
      shellInset: 42,
      panelGap: 18,
      contentInnerPadding: 16,
      chromeHeight: 140,
      launcherVisible: true,
      launcherWidth: 420,
      leftPinnedWidth: 320,
      rightPinnedWidth: 340,
    });

    expect(model.regions.chrome.height).toBeLessThanOrEqual(96);
    expect(model.regions.launcher.width).toBeLessThanOrEqual(360);
    expect(model.regions.content.width).toBeGreaterThanOrEqual(280);
    expect(model.regions.content.x + model.regions.content.width).toBeLessThanOrEqual(model.viewportWidth - model.shellInset);
    expect(model.regions.content.y + model.regions.content.height).toBeLessThanOrEqual(model.viewportHeight - model.shellInset);
  });

  it('removes the launcher region when the runtime does not use one', () => {
    const model = normalizeThemeRendererShellLayout({
      viewportWidth: 1280,
      viewportHeight: 720,
      shellInset: 12,
      panelGap: 12,
      contentInnerPadding: 14,
      chromeHeight: 44,
      launcherVisible: false,
      launcherWidth: 280,
      leftPinnedWidth: 0,
      rightPinnedWidth: 0,
    });

    expect(model.regions.launcher.visible).toBe(false);
    expect(model.regions.launcher.width).toBe(0);
    expect(model.regions.content.width).toBeGreaterThan(900);
  });
});
