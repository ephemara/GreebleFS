import { describe, expect, it } from 'vitest';
import {
  shouldOpenExplorerEntryOnTrigger,
  shouldNavigateExplorerDirectoryOnSecondClick,
  shouldNavigateUpOnEmptyExplorerDoubleClick,
  shouldShowExplorerFolderOpenIcon,
} from '../components/fileExplorerClickBehavior';

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

  it('only shows the open-folder icon for selected folders in double-click mode', () => {
    expect(shouldShowExplorerFolderOpenIcon({
      isDirectory: true,
      isSelected: true,
      isDropTarget: false,
      isOpenPrimed: true,
      folderClickMode: 'double',
    })).toBe(true);

    expect(shouldShowExplorerFolderOpenIcon({
      isDirectory: true,
      isSelected: true,
      isDropTarget: false,
      isOpenPrimed: true,
      folderClickMode: 'single',
    })).toBe(false);

    expect(shouldShowExplorerFolderOpenIcon({
      isDirectory: true,
      isSelected: true,
      isDropTarget: false,
      isOpenPrimed: false,
      folderClickMode: 'double',
    })).toBe(false);
  });

  it('keeps drag targets open regardless of click mode', () => {
    expect(shouldShowExplorerFolderOpenIcon({
      isDirectory: true,
      isSelected: false,
      isDropTarget: true,
      isOpenPrimed: false,
      folderClickMode: 'single',
    })).toBe(true);

    expect(shouldShowExplorerFolderOpenIcon({
      isDirectory: false,
      isSelected: false,
      isDropTarget: true,
      isOpenPrimed: false,
      folderClickMode: 'double',
    })).toBe(false);
  });

  it('only navigates up on empty-space double click when toggle enabled', () => {
    const viewport = document.createElement('div');
    const emptyWrapper = document.createElement('div');
    const child = document.createElement('div');
    const row = document.createElement('div');
    row.setAttribute('data-overlay-drag-source', 'file');
    const button = document.createElement('button');
    viewport.append(emptyWrapper, row, button);
    emptyWrapper.appendChild(child);

    expect(shouldNavigateUpOnEmptyExplorerDoubleClick({
      enabled: true,
      target: viewport,
      currentTarget: viewport,
    })).toBe(true);

    expect(shouldNavigateUpOnEmptyExplorerDoubleClick({
      enabled: false,
      target: viewport,
      currentTarget: viewport,
    })).toBe(false);

    expect(shouldNavigateUpOnEmptyExplorerDoubleClick({
      enabled: true,
      target: child,
      currentTarget: viewport,
    })).toBe(true);

    expect(shouldNavigateUpOnEmptyExplorerDoubleClick({
      enabled: true,
      target: row,
      currentTarget: viewport,
    })).toBe(false);

    expect(shouldNavigateUpOnEmptyExplorerDoubleClick({
      enabled: true,
      target: button,
      currentTarget: viewport,
    })).toBe(false);
  });
});

describe('shouldNavigateExplorerDirectoryOnSecondClick', () => {
  it('treats the second plain folder click in double-click mode as immediate navigation', () => {
    expect(shouldNavigateExplorerDirectoryOnSecondClick({
      isDirectory: true,
      clickDetail: 2,
      plainClick: true,
      folderClickMode: 'double',
      selectionModeActive: false,
      immediateNavigationEnabled: true,
    })).toBe(true);
  });

  it('keeps non-folder and non-plain interactions out of the immediate folder path', () => {
    expect(shouldNavigateExplorerDirectoryOnSecondClick({
      isDirectory: false,
      clickDetail: 2,
      plainClick: true,
      folderClickMode: 'double',
      selectionModeActive: false,
      immediateNavigationEnabled: true,
    })).toBe(false);
    expect(shouldNavigateExplorerDirectoryOnSecondClick({
      isDirectory: true,
      clickDetail: 2,
      plainClick: false,
      folderClickMode: 'double',
      selectionModeActive: false,
      immediateNavigationEnabled: true,
    })).toBe(false);
    expect(shouldNavigateExplorerDirectoryOnSecondClick({
      isDirectory: true,
      clickDetail: 1,
      plainClick: true,
      folderClickMode: 'double',
      selectionModeActive: false,
      immediateNavigationEnabled: true,
    })).toBe(false);
    expect(shouldNavigateExplorerDirectoryOnSecondClick({
      isDirectory: true,
      clickDetail: 2,
      plainClick: true,
      folderClickMode: 'single',
      selectionModeActive: false,
      immediateNavigationEnabled: true,
    })).toBe(false);
    expect(shouldNavigateExplorerDirectoryOnSecondClick({
      isDirectory: true,
      clickDetail: 2,
      plainClick: true,
      folderClickMode: 'double',
      selectionModeActive: true,
      immediateNavigationEnabled: true,
    })).toBe(false);
    expect(shouldNavigateExplorerDirectoryOnSecondClick({
      isDirectory: true,
      clickDetail: 2,
      plainClick: true,
      folderClickMode: 'double',
      selectionModeActive: false,
      immediateNavigationEnabled: false,
    })).toBe(false);
  });
});
