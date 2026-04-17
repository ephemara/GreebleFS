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

export function shouldShowExplorerFolderOpenIcon({
  isDirectory,
  isSelected,
  isDropTarget,
  folderClickMode,
}: {
  isDirectory: boolean;
  isSelected: boolean;
  isDropTarget: boolean;
  folderClickMode: ExplorerFolderClickMode;
}): boolean {
  if (!isDirectory) {
    return false;
  }

  if (isDropTarget) {
    return true;
  }

  return folderClickMode === 'double' && isSelected;
}
