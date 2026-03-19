import { describe, expect, it } from 'vitest';
import {
  createDefaultKeybindingSettings,
  matchesWheelHotkey,
  normalizeKeybindingSettings,
  normalizeKeybindingValue,
} from '../config/hotkeys';

describe('hotkey config helpers', () => {
  it('normalizes shortcut spacing and preserves meaningful tokens', () => {
    expect(normalizeKeybindingValue('  Ctrl +  Space  ', 'Alt+K')).toBe('Ctrl+Space');
  });

  it('falls back to defaults for missing or blank keybinding values', () => {
    const defaults = createDefaultKeybindingSettings();
    const normalized = normalizeKeybindingSettings({
      terminalToggle: '   ',
      zoomAdjust: 'Ctrl + Scroll',
    });

    expect(normalized.terminalToggle).toBe(defaults.terminalToggle);
    expect(normalized.zoomAdjust).toBe('Ctrl+Scroll');
  });

  it('matches ctrl plus wheel gestures and rejects plain scrolling', () => {
    expect(matchesWheelHotkey(
      { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
      'Ctrl+Scroll',
    )).toBe(true);

    expect(matchesWheelHotkey(
      { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },
      'Ctrl+Scroll',
    )).toBe(false);
  });
});
