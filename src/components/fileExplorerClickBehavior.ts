import type { ExplorerFolderClickMode } from '../store/settingsStore';

export type ExplorerActivationTrigger = 'click' | 'double-click';

export function shouldOpenExplorerEntryOnTrigger({
  isDirectory,
  trigger,
  plainClick,
  folderClickMode,
}: {
  isDirectory: boolean;
  trigger: ExplorerActivationTrigger;
  plainClick: boolean;
  folderClickMode: ExplorerFolderClickMode;
}): boolean {
  if (!isDirectory) {
    return trigger === 'double-click';
  }

  if (folderClickMode === 'single') {
    return trigger === 'click' && plainClick;
  }

  return trigger === 'double-click';
}

export function shouldNavigateExplorerDirectoryOnSecondClick({
  isDirectory,
  clickDetail,
  plainClick,
  folderClickMode,
  selectionModeActive,
  immediateNavigationEnabled,
}: {
  isDirectory: boolean;
  clickDetail: number;
  plainClick: boolean;
  folderClickMode: ExplorerFolderClickMode;
  selectionModeActive: boolean;
  immediateNavigationEnabled: boolean;
}): boolean {
  return (
    immediateNavigationEnabled &&
    isDirectory &&
    clickDetail > 1 &&
    plainClick &&
    folderClickMode === 'double' &&
    !selectionModeActive
  );
}

export function shouldShowExplorerFolderOpenIcon({
  isDirectory,
  isSelected,
  isDropTarget,
  isOpenPrimed,
  folderClickMode,
}: {
  isDirectory: boolean;
  isSelected: boolean;
  isDropTarget: boolean;
  isOpenPrimed: boolean;
  folderClickMode: ExplorerFolderClickMode;
}): boolean {
  if (!isDirectory) {
    return false;
  }

  if (isDropTarget) {
    return true;
  }

  return folderClickMode === 'double' && isSelected && isOpenPrimed;
}

export function shouldNavigateUpOnEmptyExplorerDoubleClick({
  enabled,
  target,
  currentTarget,
}: {
  enabled: boolean;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}): boolean {
  if (!enabled) {
    return false;
  }

  if (!(currentTarget instanceof HTMLElement)) {
    return false;
  }

  if (!(target instanceof Node) || !currentTarget.contains(target)) {
    return false;
  }

  if (!(target instanceof Element)) {
    return true;
  }

  const blockedAncestor = target.closest(
    [
      '[data-entry-path]',
      '[data-overlay-drag-source="file"]',
      'button',
      'input',
      'textarea',
      'select',
      'a',
      '[contenteditable="true"]',
      '[role="button"]',
      '[role="menu"]',
      '[role="menuitem"]',
      '[data-no-empty-double-click]',
    ].join(', '),
  );

  return blockedAncestor == null || !currentTarget.contains(blockedAncestor);
}
