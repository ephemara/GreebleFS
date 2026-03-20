import { describe, expect, it } from 'vitest';
import { shouldOpenExplorerEntryOnTrigger } from '../components/fileExplorerClickBehavior';

describe('shouldOpenExplorerEntryOnTrigger', () => {
  it('opens folders on a plain single click when single-click mode is enabled', () => {
    expect(shouldOpenExplorerEntryOnTrigger({
      isDirectory: true,
      trigger: 'click',
      plainClick: true,
      folderClickMode: 'single',
    })).toBe(true);
  });

  it('does not open folders on modified clicks in single-click mode', () => {
    expect(shouldOpenExplorerEntryOnTrigger({
      isDirectory: true,
      trigger: 'click',
      plainClick: false,
      folderClickMode: 'single',
    })).toBe(false);
  });

  it('keeps folders on double-click activation when double-click mode is enabled', () => {
    expect(shouldOpenExplorerEntryOnTrigger({
      isDirectory: true,
      trigger: 'double-click',
      plainClick: true,
      folderClickMode: 'double',
    })).toBe(true);

    expect(shouldOpenExplorerEntryOnTrigger({
      isDirectory: true,
      trigger: 'click',
      plainClick: true,
      folderClickMode: 'double',
    })).toBe(false);
  });

  it('keeps file opening tied to double click regardless of folder mode', () => {
    expect(shouldOpenExplorerEntryOnTrigger({
      isDirectory: false,
      trigger: 'click',
      plainClick: true,
      folderClickMode: 'single',
    })).toBe(false);

    expect(shouldOpenExplorerEntryOnTrigger({
      isDirectory: false,
      trigger: 'double-click',
      plainClick: true,
      folderClickMode: 'double',
    })).toBe(true);
  });
});
