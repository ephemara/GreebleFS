import { describe, expect, it } from 'vitest';
import {
  createDefaultKeybindingSettings,
  matchesKeybinding,
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
    expect(defaults.opacityAdjust).toBe('Alt+Scroll');
  });

  it('normalizes option-based wheel bindings to alt-modified scroll gestures', () => {
    expect(matchesWheelHotkey(
      { ctrlKey: false, metaKey: false, altKey: true, shiftKey: false },
      'Option+Scroll',
    )).toBe(true);
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

    expect(matchesWheelHotkey(
      { ctrlKey: false, metaKey: false, altKey: true, shiftKey: false },
      'Alt+Scroll',
    )).toBe(true);
  });

  it('matches keyboard shortcuts with modifier keys for local actions', () => {
    expect(matchesKeybinding(
      { key: 'k', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
      'Ctrl+K',
    )).toBe(true);

    expect(matchesKeybinding(
      { key: 'k', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },
      'Ctrl+K',
    )).toBe(false);

    expect(matchesKeybinding(
      { key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },
      'Escape',
    )).toBe(true);
  });
});
