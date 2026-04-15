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
      terminalFocus: '   ',
      windowModeToggle: '   ',
      zoomAdjust: 'Ctrl + Scroll',
    });

    expect(normalized.terminalToggle).toBe(defaults.terminalToggle);
    expect(defaults.terminalFocus).toBe('Ctrl+J');
    expect(normalized.terminalFocus).toBe(defaults.terminalFocus);
    expect(defaults.windowModeToggle).toBe('F11');
    expect(normalized.windowModeToggle).toBe(defaults.windowModeToggle);
    expect(normalized.zoomAdjust).toBe('Ctrl+Scroll');
    expect(defaults.opacityAdjust).toBe('Alt+Scroll');
    expect(defaults.goBackDirectory).toBe('Alt+Left');
    expect(defaults.goForwardDirectory).toBe('Alt+Right');
    expect(defaults.goHomeDirectory).toBe('Alt+Home');
    expect(defaults.clearExplorerSearch).toBe('Escape');
    expect(defaults.toggleExplorerSearchScope).toBe('Ctrl+Alt+F');
    expect(defaults.cycleExplorerSortKey).toBe('Ctrl+Alt+S');
    expect(defaults.toggleExplorerSortOrder).toBe('Ctrl+Alt+O');
    expect(defaults.selectAllExplorer).toBe('Ctrl+A');
    expect(defaults.clearExplorerSelection).toBe('Ctrl+Shift+A');
    expect(defaults.openInTerminal).toBe('Ctrl+Enter');
    expect(defaults.revealInExplorer).toBe('Ctrl+Alt+R');
    expect(defaults.openAsAdmin).toBe('Ctrl+Alt+Enter');
    expect(defaults.focusExplorerAddressBar).toBe('Ctrl+L');
    expect(defaults.toggleExplorerLayout).toBe('Ctrl+Shift+L');
    expect(defaults.searchExplorer).toBe('Ctrl+F');
    expect(defaults.find).toBe('');
    expect(defaults.toggleHiddenFiles).toBe('Ctrl+H');
    expect(defaults.replace).toBe('');
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
      { key: 'F11', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },
      'F11',
    )).toBe(true);

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

    expect(matchesKeybinding(
      { key: 'Left', ctrlKey: false, metaKey: false, altKey: true, shiftKey: false },
      'Alt+Left',
    )).toBe(true);
  });
});
