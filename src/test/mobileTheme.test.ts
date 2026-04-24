import { describe, expect, it } from 'vitest';

import { resolveOverlayAppearance } from '../config/appearance';
import { createDefaultFolderIconRules } from '../config/folderIcons';
import { defaultMobileLayoutSettings } from '../config/mobileLayout';
import { createMobileShareThemeSnapshot } from '../config/mobileTheme';

describe('mobile theme snapshot builder', () => {
  it('derives the phone theme payload from the resolved desktop appearance', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const snapshot = createMobileShareThemeSnapshot(appearance, {
      folderIconRules: createDefaultFolderIconRules(),
      defaultFolderIcon: 'folder_src',
    });

    expect(snapshot.themeId).toBe(appearance.theme.id);
    expect(snapshot.themeName).toBe(appearance.theme.name);
    expect(snapshot.uiFontFamily).toBe(appearance.fonts.ui);
    expect(snapshot.palette.accent).toBe(appearance.theme.palette.accent);
    expect(snapshot.palette.panelBackground).toBe(appearance.theme.palette.panelBackground);
    expect(snapshot.metrics.panelRadius).toBe(appearance.workbenchTheme.metrics.panelRadius);
    expect(snapshot.shadow).toBe(appearance.theme.effects.shadow);
    expect(snapshot.iconTheme.id).toBeTruthy();
    expect(snapshot.iconTheme.iconDefinitions.folder).toBeTruthy();
    expect(snapshot.folderIconRules.length).toBeGreaterThan(0);
    expect(snapshot.defaultFolderIcon).toBe('folder_src');
    expect(snapshot.layout).toEqual(defaultMobileLayoutSettings);
  });
});
