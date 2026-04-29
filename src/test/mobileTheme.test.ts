import { describe, expect, it } from 'vitest';

import { resolveOverlayAppearance, type OverlayThemeDefinition } from '../config/appearance';
import { createDefaultFolderIconRules } from '../config/folderIcons';
import { defaultMobileLayoutSettings } from '../config/mobileLayout';
import { createMobileShareThemeSnapshot } from '../config/mobileTheme';

describe('mobile theme snapshot builder', () => {
  it('derives the phone theme payload from the resolved desktop appearance', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const snapshot = createMobileShareThemeSnapshot(appearance, {
      folderIconRules: createDefaultFolderIconRules(),
      defaultFolderIcon: 'folder_src',
      pluginSettingsById: {
        'greeblefs-index-photo-gallery': {
          rootPaths: 'C:/Pictures',
          includeHidden: true,
        },
      },
    });

    expect(snapshot.themeId).toBe(appearance.theme.id);
    expect(snapshot.themeName).toBe(appearance.theme.name);
    expect(snapshot.uiFontFamily).toBe(appearance.fonts.ui);
    expect(snapshot.palette.accent).toBe(appearance.theme.palette.accent);
    expect(snapshot.palette.panelBackground).toBe(appearance.theme.palette.panelBackground);
    expect(snapshot.metrics.panelRadius).toBe(appearance.workbenchTheme.metrics.panelRadius);
    expect(snapshot.shadow).toBe(appearance.theme.effects.shadow);
    expect(snapshot.cssVars['--mobile-scrollbar-thumb']).toBe(appearance.theme.palette.borderStrong);
    expect(snapshot.cssVars['--mobile-scrollbar-track']).toBe(appearance.theme.palette.panelBackground);
    expect(snapshot.iconTheme.id).toBeTruthy();
    expect(snapshot.iconTheme.iconDefinitions.folder).toBeTruthy();
    expect(snapshot.folderIconRules.length).toBeGreaterThan(0);
    expect(snapshot.defaultFolderIcon).toBe('folder_src');
    expect(snapshot.layout).toEqual(defaultMobileLayoutSettings);
    expect(snapshot.pluginSettingsById['greeblefs-index-photo-gallery']).toEqual({
      rootPaths: 'C:/Pictures',
      includeHidden: true,
    });
  });

  it('passes explicit structured scrollbar theme colors through to mobile css vars', () => {
    const appearance = resolveOverlayAppearance({
      activeThemeId: 'mobile-scrollbar-lab',
      customThemes: [{
        id: 'mobile-scrollbar-lab',
        name: 'Mobile Scrollbar Lab',
        extendsThemeId: 'github-dark',
        scrollbar: {
          thumb: '#123456',
          thumbHover: '#234567',
          track: '#020406',
        },
      } as OverlayThemeDefinition],
    });
    const snapshot = createMobileShareThemeSnapshot(appearance);

    expect(snapshot.cssVars['--mobile-scrollbar-thumb']).toBe('#123456');
    expect(snapshot.cssVars['--mobile-scrollbar-thumb-hover']).toBe('#234567');
    expect(snapshot.cssVars['--mobile-scrollbar-track']).toBe('#020406');
  });
});
