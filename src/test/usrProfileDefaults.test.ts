import shippedDefaultProfileSettingsJson from '../../usr/profiles/default/settings.json';
import shippedSharedSettingsJson from '../../usr/profiles/shared/settings.json';
import {
  buildUsrProfileSettingsVariantOverrides,
  getUsrProfileSettingsVariant,
  usrProfileSettingsVariants,
} from '../config/usrProfileSettingsVariants';
import { defaultSettings, mergeSettingsWithDefaults } from '../store/settingsStore';

describe('usr canonical defaults', () => {
  it('keeps frontend defaults aligned with the shipped usr settings baseline', () => {
    const shippedDefaultProfileSettings = shippedDefaultProfileSettingsJson as Record<string, any>;
    const shippedSharedSettings = shippedSharedSettingsJson as Record<string, any>;

    expect(defaultSettings.explorer.showHiddenFiles).toBe(
      shippedDefaultProfileSettings.explorer.showHiddenFiles,
    );
    expect(defaultSettings.explorer.viewMode).toBe(
      shippedDefaultProfileSettings.explorer.viewMode,
    );
    expect(defaultSettings.appearance.appZoom).toBe(
      shippedDefaultProfileSettings.appearance.appZoom,
    );
    expect(defaultSettings.audio.soundEffectsEnabled).toBe(
      shippedDefaultProfileSettings.audio.soundEffectsEnabled,
    );
    expect(defaultSettings.system.devTelemetryHudVisible).toBe(
      shippedSharedSettings.system.devTelemetryHudVisible,
    );
  });

  it('ships named profile-setting variations rooted in the canonical baseline', () => {
    expect(usrProfileSettingsVariants.map((variant) => variant.id)).toEqual(
      expect.arrayContaining([
        'canonical-default',
        'focused-authoring',
        'review-presentation',
        'minimal-low-motion',
      ]),
    );

    const focusedAuthoring = getUsrProfileSettingsVariant('focused-authoring');
    expect(focusedAuthoring).not.toBeNull();
    const focusedAuthoringSettings = mergeSettingsWithDefaults(
      buildUsrProfileSettingsVariantOverrides(focusedAuthoring!),
    );
    expect(focusedAuthoringSettings.explorer.viewMode).toBe('details');
    expect(focusedAuthoringSettings.terminal.showSidebar).toBe(false);
    expect(focusedAuthoringSettings.appearance.interactionMotionEnabled).toBe(false);

    const lowMotion = getUsrProfileSettingsVariant('minimal-low-motion');
    expect(lowMotion).not.toBeNull();
    const lowMotionSettings = mergeSettingsWithDefaults(
      buildUsrProfileSettingsVariantOverrides(lowMotion!),
    );
    expect(lowMotionSettings.appearance.layoutDynamicsEnabled).toBe(false);
    expect(lowMotionSettings.audio.notificationSoundsEnabled).toBe(false);
  });
});
