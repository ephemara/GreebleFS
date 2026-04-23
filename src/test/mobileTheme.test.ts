import { describe, expect, it } from 'vitest';

import { resolveOverlayAppearance } from '../config/appearance';
import { createMobileShareThemeSnapshot } from '../config/mobileTheme';

describe('mobile theme snapshot builder', () => {
  it('derives the phone theme payload from the resolved desktop appearance', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const snapshot = createMobileShareThemeSnapshot(appearance);

    expect(snapshot.themeId).toBe(appearance.theme.id);
    expect(snapshot.themeName).toBe(appearance.theme.name);
    expect(snapshot.uiFontFamily).toBe(appearance.fonts.ui);
    expect(snapshot.palette.accent).toBe(appearance.theme.palette.accent);
    expect(snapshot.palette.panelBackground).toBe(appearance.theme.palette.panelBackground);
    expect(snapshot.metrics.panelRadius).toBe(appearance.workbenchTheme.metrics.panelRadius);
    expect(snapshot.shadow).toBe(appearance.theme.effects.shadow);
  });
});
