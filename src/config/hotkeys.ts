export type HotkeyBindingKey =
  | 'toggleDeveloperTelemetryHud'
  | 'commandPalette'
  | 'mobileShareToggle'
  | 'terminalFocus'
  | 'terminalToggle'
  | 'windowModeToggle'
  | 'zenFocusModeToggle'
  | 'saveFile'
  | 'newFile'
  | 'newFolder'
  | 'renameItem'
  | 'deleteItem'
  | 'duplicateItem'
  | 'refreshExplorer'
  | 'goBackDirectory'
  | 'goForwardDirectory'
  | 'goHomeDirectory'
  | 'clearExplorerSearch'
  | 'cycleExplorerSearchMode'
  | 'findSimilarSelection'
  | 'cycleExplorerSortKey'
  | 'toggleExplorerSortOrder'
  | 'focusExplorerList'
  | 'focusExplorerAddressBar'
  | 'focusExplorerPreview'
  | 'toggleExplorerSources'
  | 'cycleCollectionPreviewMode'
  | 'cycleCollectionPreviewModeReverse'
  | 'explorerMoveSelectionUp'
  | 'explorerMoveSelectionDown'
  | 'explorerMoveSelectionLeft'
  | 'explorerMoveSelectionRight'
  | 'togglePreviewLock'
  | 'togglePreviewTerminal'
  | 'openInTerminal'
  | 'calculateRecursiveSize'
  | 'revealInExplorer'
  | 'openAsAdmin'
  | 'extractArchiveFolderHere'
  | 'extractArchiveFolderToNewFolder'
  | 'goUpDirectory'
  | 'copyPath'
  | 'copySelection'
  | 'cutSelection'
  | 'pasteSelection'
  | 'toggleHiddenFiles'
  | 'toggleExplorerLayout'
  | 'cycleConstellationLens'
  | 'toggleConstellationRouteMode'
  | 'toggleConstellationPinSelection'
  | 'selectAllExplorer'
  | 'clearExplorerSelection'
  | 'searchExplorer'
  | 'pdfWorkbenchPreviousPage'
  | 'pdfWorkbenchNextPage'
  | 'pdfWorkbenchZoomIn'
  | 'pdfWorkbenchZoomOut'
  | 'pdfWorkbenchToggleEditMode'
  | 'shaderWorkbenchToggleEditMode'
  | 'shaderWorkbenchToggleScene'
  | 'spreadsheetWorkbenchToggleEditMode'
  | 'spreadsheetWorkbenchPreviousSheet'
  | 'spreadsheetWorkbenchNextSheet'
  | 'spreadsheetWorkbenchNewSheet'
  | 'spreadsheetWorkbenchFocusFormulaBar'
  | 'audioWorkbenchPlayPause'
  | 'audioWorkbenchToggleEditMode'
  | 'audioWorkbenchJumpToSelectionStart'
  | 'audioWorkbenchJumpToSelectionEnd'
  | 'audioWorkbenchPreviousSilence'
  | 'audioWorkbenchNextSilence'
  | 'audioWorkbenchExportClip'
  | 'pythonWorkbenchRunManaged'
  | 'pythonWorkbenchRunInTerminal'
  | 'imageCutoutCopy'
  | 'imageCutoutDeselect'
  | 'imageEditorUndo'
  | 'imageEditorRedo'
  | 'imageEditorReset'
  | 'closeTab'
  | 'find'
  | 'replace'
  | 'zoomAdjust'
  | 'opacityAdjust';

export interface HotkeyBindingDefinition {
  key: HotkeyBindingKey;
  label: string;
  description: string;
  defaultValue: string;
  scope: 'global' | 'gesture' | 'local';
}

export type CommandHotkeyBindingMap = Record<string, string>;

export type HotkeyBindingSettings = Record<HotkeyBindingKey, string> & {
  commandBindingsById: CommandHotkeyBindingMap;
};

export const hotkeyBindingDefinitions: HotkeyBindingDefinition[] = [
  {
    key: 'toggleDeveloperTelemetryHud',
    label: 'Toggle Dev Telemetry HUD',
    description: 'Show or hide the developer telemetry HUD while local developer tooling is active.',
    defaultValue: 'Ctrl+Alt+D',
    scope: 'local',
  },
  {
    key: 'terminalToggle',
    label: 'Toggle Main Window',
    description: 'Global shortcut used to open or hide the app window in its current presentation mode.',
    defaultValue: 'Ctrl+Space',
    scope: 'global',
  },
  {
    key: 'terminalFocus',
    label: 'Focus Terminal',
    description: 'Jump directly into the terminal panel, or reveal the explorer bottom terminal drawer when an explorer has focus.',
    defaultValue: 'Ctrl+J',
    scope: 'global',
  },
  {
    key: 'windowModeToggle',
    label: 'Toggle App/Dock Mode',
    description: 'Switch between the dock-style overlay shell and the regular desktop application window.',
    defaultValue: 'F11',
    scope: 'local',
  },
  {
    key: 'zenFocusModeToggle',
    label: 'Toggle Zen Focus Mode',
    description: 'Hide or restore the shell top bar and foreground the explorer for a cleaner focus pass.',
    defaultValue: 'Ctrl+Alt+Z',
    scope: 'local',
  },
  {
    key: 'zoomAdjust',
    label: 'Zoom Overlay',
    description: 'Hold the modifier and scroll anywhere in the overlay to change zoom.',
    defaultValue: 'Ctrl+Scroll',
    scope: 'gesture',
  },
  {
    key: 'opacityAdjust',
    label: 'Opacity Overlay',
    description: 'Hold the modifier and scroll anywhere in the overlay to change opacity.',
    defaultValue: 'Alt+Scroll',
    scope: 'gesture',
  },
  {
    key: 'commandPalette',
    label: 'Command Palette',
    description: 'Global shortcut used to open the overlay command palette.',
    defaultValue: 'Ctrl+Shift+P',
    scope: 'global',
  },
  {
    key: 'mobileShareToggle',
    label: 'Toggle Mobile Share',
    description: 'Start or stop the phone-facing mobile share using the current Mobile settings route.',
    defaultValue: 'Ctrl+Alt+Shift+M',
    scope: 'local',
  },
  {
    key: 'saveFile',
    label: 'Save File',
    description: 'Reserved for editor save actions.',
    defaultValue: 'Ctrl+S',
    scope: 'local',
  },
  {
    key: 'newFile',
    label: 'New File',
    description: 'Create a new file in the active explorer folder.',
    defaultValue: 'Ctrl+N',
    scope: 'local',
  },
  {
    key: 'newFolder',
    label: 'New Folder',
    description: 'Create a new folder in the active explorer folder.',
    defaultValue: 'Ctrl+Shift+N',
    scope: 'local',
  },
  {
    key: 'renameItem',
    label: 'Rename Item',
    description: 'Rename the current explorer selection.',
    defaultValue: 'F2',
    scope: 'local',
  },
  {
    key: 'deleteItem',
    label: 'Delete Item',
    description: 'Delete the current explorer selection.',
    defaultValue: 'Delete',
    scope: 'local',
  },
  {
    key: 'duplicateItem',
    label: 'Duplicate Item',
    description: 'Duplicate the current explorer selection.',
    defaultValue: 'Ctrl+D',
    scope: 'local',
  },
  {
    key: 'refreshExplorer',
    label: 'Refresh Explorer',
    description: 'Reload the current explorer directory.',
    defaultValue: 'F5',
    scope: 'local',
  },
  {
    key: 'goBackDirectory',
    label: 'Go Back',
    description: 'Navigate back through explorer history.',
    defaultValue: 'Alt+Left',
    scope: 'local',
  },
  {
    key: 'goForwardDirectory',
    label: 'Go Forward',
    description: 'Navigate forward through explorer history.',
    defaultValue: 'Alt+Right',
    scope: 'local',
  },
  {
    key: 'goHomeDirectory',
    label: 'Go Home',
    description: 'Jump to the explorer home directory.',
    defaultValue: 'Alt+Home',
    scope: 'local',
  },
  {
    key: 'clearExplorerSearch',
    label: 'Clear Explorer Search',
    description: 'Clear the current explorer search query.',
    defaultValue: 'Escape',
    scope: 'local',
  },
  {
    key: 'cycleExplorerSearchMode',
    label: 'Cycle Explorer Search Mode',
    description: 'Cycle explorer search among name, content, and semantic modes.',
    defaultValue: 'Ctrl+Alt+F',
    scope: 'local',
  },
  {
    key: 'findSimilarSelection',
    label: 'Find Similar File',
    description: 'Run semantic similarity search for the active local text/code selection.',
    defaultValue: 'Ctrl+Alt+M',
    scope: 'local',
  },
  {
    key: 'cycleExplorerSortKey',
    label: 'Cycle Sort Key',
    description: 'Step through explorer sort keys.',
    defaultValue: 'Ctrl+Alt+S',
    scope: 'local',
  },
  {
    key: 'toggleExplorerSortOrder',
    label: 'Toggle Sort Order',
    description: 'Flip the current explorer sort order.',
    defaultValue: 'Ctrl+Alt+O',
    scope: 'local',
  },
  {
    key: 'focusExplorerList',
    label: 'Focus Explorer List',
    description: 'Focus the main file list.',
    defaultValue: 'Ctrl+1',
    scope: 'local',
  },
  {
    key: 'focusExplorerAddressBar',
    label: 'Focus Explorer Address Bar',
    description: 'Focus the explorer address bar.',
    defaultValue: 'Ctrl+L',
    scope: 'local',
  },
  {
    key: 'focusExplorerPreview',
    label: 'Focus Explorer Preview',
    description: 'Focus the explorer preview panel.',
    defaultValue: 'Ctrl+2',
    scope: 'local',
  },
  {
    key: 'toggleExplorerSources',
    label: 'Toggle Sources Panel',
    description: 'Show or hide the explorer sources panel.',
    defaultValue: 'Ctrl+B',
    scope: 'local',
  },
  {
    key: 'cycleCollectionPreviewMode',
    label: 'Cycle Collection Preview Mode',
    description: 'Advance the shared folder and archive preview pane through its collection preview modes.',
    defaultValue: 'Ctrl+Alt+V',
    scope: 'local',
  },
  {
    key: 'cycleCollectionPreviewModeReverse',
    label: 'Reverse Collection Preview Mode',
    description: 'Move backward through the shared folder and archive preview pane collection preview modes.',
    defaultValue: 'Ctrl+Alt+Shift+V',
    scope: 'local',
  },
  {
    key: 'togglePreviewLock',
    label: 'Toggle Preview Lock',
    description: 'Lock or unlock the active explorer preview so selection changes stop replacing it.',
    defaultValue: 'Ctrl+Alt+P',
    scope: 'local',
  },
  {
    key: 'explorerMoveSelectionUp',
    label: 'Explorer Move Selection Up',
    description: 'Move the current explorer selection upward. Icon layouts follow the visible grid.',
    defaultValue: 'ArrowUp',
    scope: 'local',
  },
  {
    key: 'explorerMoveSelectionDown',
    label: 'Explorer Move Selection Down',
    description: 'Move the current explorer selection downward. Icon layouts follow the visible grid.',
    defaultValue: 'ArrowDown',
    scope: 'local',
  },
  {
    key: 'explorerMoveSelectionLeft',
    label: 'Explorer Move Selection Left',
    description: 'Move the current explorer selection left. In icon layouts this follows the row layout.',
    defaultValue: 'ArrowLeft',
    scope: 'local',
  },
  {
    key: 'explorerMoveSelectionRight',
    label: 'Explorer Move Selection Right',
    description: 'Move the current explorer selection right. In icon layouts this follows the row layout.',
    defaultValue: 'ArrowRight',
    scope: 'local',
  },
  {
    key: 'togglePreviewTerminal',
    label: 'Toggle Preview Terminal',
    description: 'Show or hide the embedded preview-pane terminal in the active explorer.',
    defaultValue: 'Ctrl+Alt+T',
    scope: 'local',
  },
  {
    key: 'openInTerminal',
    label: 'Open in Terminal',
    description: 'Open the selected folder in a terminal.',
    defaultValue: 'Ctrl+Enter',
    scope: 'local',
  },
  {
    key: 'calculateRecursiveSize',
    label: 'Calculate Recursive Size',
    description: 'Measure folder sizes for the current selection or visible entries.',
    defaultValue: 'Alt+S',
    scope: 'local',
  },
  {
    key: 'revealInExplorer',
    label: 'Reveal in Explorer',
    description: 'Reveal the selected item in the system file explorer.',
    defaultValue: 'Ctrl+Alt+R',
    scope: 'local',
  },
  {
    key: 'openAsAdmin',
    label: 'Open as Admin',
    description: 'Open the selected item with elevated permissions.',
    defaultValue: 'Ctrl+Alt+Enter',
    scope: 'local',
  },
  {
    key: 'extractArchiveFolderHere',
    label: 'Extract Archive Folder Here',
    description: 'Extract the current archive folder into the archive container directory.',
    defaultValue: 'Ctrl+Alt+E',
    scope: 'local',
  },
  {
    key: 'extractArchiveFolderToNewFolder',
    label: 'Extract Archive Folder to New Folder',
    description: 'Extract the current archive folder into a fresh wrapper folder beside the archive.',
    defaultValue: 'Ctrl+Alt+Shift+E',
    scope: 'local',
  },
  {
    key: 'goUpDirectory',
    label: 'Go Up Directory',
    description: 'Navigate to the parent folder in Explorer.',
    defaultValue: 'Backspace',
    scope: 'local',
  },
  {
    key: 'copyPath',
    label: 'Copy Path',
    description: 'Copy the selected path(s) to the system clipboard.',
    defaultValue: 'Ctrl+Shift+C',
    scope: 'local',
  },
  {
    key: 'copySelection',
    label: 'Copy Selection',
    description:
      'Copy the current explorer selection into the transfer queue, or toggle Explorer selection mode when nothing is selected.',
    defaultValue: 'Ctrl+C',
    scope: 'local',
  },
  {
    key: 'cutSelection',
    label: 'Cut Selection',
    description: 'Cut the current explorer selection into the transfer queue.',
    defaultValue: 'Ctrl+X',
    scope: 'local',
  },
  {
    key: 'pasteSelection',
    label: 'Paste Selection',
    description: 'Paste the current transfer queue into the active folder.',
    defaultValue: 'Ctrl+V',
    scope: 'local',
  },
  {
    key: 'toggleHiddenFiles',
    label: 'Toggle Hidden Files',
    description: 'Show or hide hidden files in Explorer.',
    defaultValue: 'Ctrl+H',
    scope: 'local',
  },
  {
    key: 'toggleExplorerLayout',
    label: 'Toggle Explorer Layout',
    description: 'Step through the explorer content-browser layouts.',
    defaultValue: 'Ctrl+Shift+L',
    scope: 'local',
  },
  {
    key: 'cycleConstellationLens',
    label: 'Cycle Constellation Lens',
    description: 'Step through the active Constellation relationship lens while the canvas is focused.',
    defaultValue: 'L',
    scope: 'local',
  },
  {
    key: 'toggleConstellationRouteMode',
    label: 'Toggle Constellation Route',
    description: 'Highlight the top likely next moves from the active Constellation anchor.',
    defaultValue: 'R',
    scope: 'local',
  },
  {
    key: 'toggleConstellationPinSelection',
    label: 'Toggle Constellation Workset Pin',
    description: 'Pin or unpin the current explorer selection inside the active Constellation workset.',
    defaultValue: 'P',
    scope: 'local',
  },
  {
    key: 'selectAllExplorer',
    label: 'Select All',
    description: 'Select every visible explorer entry.',
    defaultValue: 'Ctrl+A',
    scope: 'local',
  },
  {
    key: 'clearExplorerSelection',
    label: 'Clear Explorer Selection',
    description: 'Clear the current explorer selection.',
    defaultValue: 'Ctrl+Shift+A',
    scope: 'local',
  },
  {
    key: 'searchExplorer',
    label: 'Search Explorer',
    description: 'Focus the explorer search/address bar.',
    defaultValue: 'Ctrl+F',
    scope: 'local',
  },
  {
    key: 'pdfWorkbenchPreviousPage',
    label: 'PDF Workbench Previous Page',
    description: 'Jump to the previous page in the explorer PDF workbench.',
    defaultValue: 'PageUp',
    scope: 'local',
  },
  {
    key: 'pdfWorkbenchNextPage',
    label: 'PDF Workbench Next Page',
    description: 'Jump to the next page in the explorer PDF workbench.',
    defaultValue: 'PageDown',
    scope: 'local',
  },
  {
    key: 'pdfWorkbenchZoomIn',
    label: 'PDF Workbench Zoom In',
    description: 'Increase the active PDF preview zoom level.',
    defaultValue: 'Ctrl+=',
    scope: 'local',
  },
  {
    key: 'pdfWorkbenchZoomOut',
    label: 'PDF Workbench Zoom Out',
    description: 'Decrease the active PDF preview zoom level.',
    defaultValue: 'Ctrl+-',
    scope: 'local',
  },
  {
    key: 'pdfWorkbenchToggleEditMode',
    label: 'PDF Workbench Toggle Edit Mode',
    description: 'Toggle between preview and edit mode for the explorer PDF workbench.',
    defaultValue: 'E',
    scope: 'local',
  },
  {
    key: 'shaderWorkbenchToggleEditMode',
    label: 'Shader Workbench Toggle Edit Mode',
    description: 'Toggle between preview and edit mode for the explorer shader workbench.',
    defaultValue: 'E',
    scope: 'local',
  },
  {
    key: 'shaderWorkbenchToggleScene',
    label: 'Shader Workbench Toggle Scene',
    description: 'Toggle the active shader preview scene between the sphere and fullscreen hosts.',
    defaultValue: 'F',
    scope: 'local',
  },
  {
    key: 'spreadsheetWorkbenchToggleEditMode',
    label: 'Spreadsheet Workbench Toggle Edit Mode',
    description: 'Toggle between preview and edit mode for the explorer spreadsheet workbench.',
    defaultValue: 'E',
    scope: 'local',
  },
  {
    key: 'spreadsheetWorkbenchPreviousSheet',
    label: 'Spreadsheet Previous Sheet',
    description: 'Move to the previous sheet in the spreadsheet workbench.',
    defaultValue: 'Ctrl+PageUp',
    scope: 'local',
  },
  {
    key: 'spreadsheetWorkbenchNextSheet',
    label: 'Spreadsheet Next Sheet',
    description: 'Move to the next sheet in the spreadsheet workbench.',
    defaultValue: 'Ctrl+PageDown',
    scope: 'local',
  },
  {
    key: 'spreadsheetWorkbenchNewSheet',
    label: 'Spreadsheet New Sheet',
    description: 'Create a new sheet in the spreadsheet workbench.',
    defaultValue: 'Shift+F11',
    scope: 'local',
  },
  {
    key: 'spreadsheetWorkbenchFocusFormulaBar',
    label: 'Spreadsheet Focus Formula Bar',
    description: 'Jump focus to the active spreadsheet formula bar.',
    defaultValue: 'F2',
    scope: 'local',
  },
  {
    key: 'audioWorkbenchPlayPause',
    label: 'Audio Workbench Play/Pause',
    description: 'Toggle native audio playback in the audio workbench.',
    defaultValue: 'Space',
    scope: 'local',
  },
  {
    key: 'audioWorkbenchToggleEditMode',
    label: 'Audio Workbench Toggle Edit Mode',
    description: 'Switch between the clean audio preview player and the full audio editor.',
    defaultValue: 'E',
    scope: 'local',
  },
  {
    key: 'audioWorkbenchJumpToSelectionStart',
    label: 'Audio Workbench Jump To In',
    description: 'Move the playhead to the current trim in-point.',
    defaultValue: 'I',
    scope: 'local',
  },
  {
    key: 'audioWorkbenchJumpToSelectionEnd',
    label: 'Audio Workbench Jump To Out',
    description: 'Move the playhead to the current trim out-point.',
    defaultValue: 'O',
    scope: 'local',
  },
  {
    key: 'audioWorkbenchPreviousSilence',
    label: 'Audio Workbench Previous Silence',
    description: 'Jump to the previous detected silence region.',
    defaultValue: 'Shift+ArrowLeft',
    scope: 'local',
  },
  {
    key: 'audioWorkbenchNextSilence',
    label: 'Audio Workbench Next Silence',
    description: 'Jump to the next detected silence region.',
    defaultValue: 'Shift+ArrowRight',
    scope: 'local',
  },
  {
    key: 'audioWorkbenchExportClip',
    label: 'Audio Workbench Export Clip',
    description: 'Open the clip export flow from the audio workbench.',
    defaultValue: 'Ctrl+Shift+S',
    scope: 'local',
  },
  {
    key: 'pythonWorkbenchRunManaged',
    label: 'Python Workbench Run Managed',
    description: 'Run the active Python preview through the managed Python runtime.',
    defaultValue: 'F9',
    scope: 'local',
  },
  {
    key: 'pythonWorkbenchRunInTerminal',
    label: 'Python Workbench Run In Terminal',
    description: 'Queue the active Python preview into the explorer embedded terminal.',
    defaultValue: 'Ctrl+F9',
    scope: 'local',
  },
  {
    key: 'imageCutoutCopy',
    label: 'Image Cutout Copy',
    description: 'Copy the active explorer cutout selection as a transparent image to the system clipboard.',
    defaultValue: 'Ctrl+C',
    scope: 'local',
  },
  {
    key: 'imageCutoutDeselect',
    label: 'Image Cutout Deselect',
    description: 'Clear the current explorer cutout selection without resetting the cutout session.',
    defaultValue: 'Ctrl+D',
    scope: 'local',
  },
  {
    key: 'imageEditorUndo',
    label: 'Image Editor Undo',
    description: 'Undo the last canvas edit inside the explorer image editor.',
    defaultValue: 'Ctrl+Z',
    scope: 'local',
  },
  {
    key: 'imageEditorRedo',
    label: 'Image Editor Redo',
    description: 'Redo the last undone canvas edit inside the explorer image editor.',
    defaultValue: 'Ctrl+Shift+Z',
    scope: 'local',
  },
  {
    key: 'imageEditorReset',
    label: 'Image Editor Reset',
    description: 'Restore the image editor to the last saved base grade and overlay state.',
    defaultValue: 'Escape',
    scope: 'local',
  },
  {
    key: 'closeTab',
    label: 'Close Tab',
    description: 'Reserved for tab close actions.',
    defaultValue: 'Ctrl+W',
    scope: 'local',
  },
  {
    key: 'find',
    label: 'Find',
    description: 'Reserved for search actions.',
    defaultValue: '',
    scope: 'local',
  },
  {
    key: 'replace',
    label: 'Replace',
    description: 'Reserved for replace actions.',
    defaultValue: '',
    scope: 'local',
  },
];

const hotkeyDefinitionByKey = new Map(
  hotkeyBindingDefinitions.map(definition => [definition.key, definition]),
);

export function createDefaultKeybindingSettings(): HotkeyBindingSettings {
  const normalizedSettings = hotkeyBindingDefinitions.reduce((result, definition) => {
    result[definition.key] = definition.defaultValue;
    return result;
  }, {} as HotkeyBindingSettings);
  normalizedSettings.commandBindingsById = {};
  return normalizedSettings;
}

export function normalizeKeybindingValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value
    .split('+')
    .map(segment => segment.trim())
    .filter(Boolean)
    .join('+');

  return normalized || fallback;
}

export function normalizeKeybindingSettings(
  value:
    | (Partial<Record<HotkeyBindingKey, unknown>> & {
        commandBindingsById?: unknown;
        toggleExplorerSearchScope?: unknown;
      })
    | undefined,
): HotkeyBindingSettings {
  const defaults = createDefaultKeybindingSettings();
  const legacyValue = value as Record<string, unknown> | undefined;

  const normalizedSettings = hotkeyBindingDefinitions.reduce((result, definition) => {
    const legacyFallbackValue =
      definition.key === 'cycleExplorerSearchMode'
        ? legacyValue?.toggleExplorerSearchScope
        : undefined;
    result[definition.key] = normalizeKeybindingValue(
      value?.[definition.key] ?? legacyFallbackValue,
      defaults[definition.key],
    );
    return result;
  }, {} as HotkeyBindingSettings);
  normalizedSettings.commandBindingsById = normalizeCommandHotkeyBindingMap(
    legacyValue?.commandBindingsById,
  );
  return normalizedSettings;
}

export function normalizeCommandHotkeyBindingMap(value: unknown): CommandHotkeyBindingMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([commandId, binding]) => {
        const trimmedCommandId = commandId.trim();
        if (!trimmedCommandId) {
          return null;
        }
        const normalizedBinding = normalizeKeybindingValue(binding, '');
        if (!normalizedBinding) {
          return null;
        }
        return [trimmedCommandId, normalizedBinding] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry != null),
  );
}

export function getCommandHotkeyBinding(
  settings: Pick<HotkeyBindingSettings, 'commandBindingsById'>,
  commandId: string,
): string {
  return settings.commandBindingsById[commandId] ?? '';
}

export function getHotkeyBindingDefinition(key: HotkeyBindingKey): HotkeyBindingDefinition {
  return hotkeyDefinitionByKey.get(key) ?? hotkeyBindingDefinitions[0];
}

export function formatHotkeyLabel(value: string): string {
  return value.trim() || 'Unassigned';
}

function normalizeGestureToken(token: string): string {
  const normalized = token.trim().toLowerCase();

  if (normalized === 'control') {
    return 'ctrl';
  }

  if (normalized === 'option') {
    return 'alt';
  }

  if (normalized === 'cmdorcontrol') {
    return 'commandorcontrol';
  }

  return normalized;
}

function normalizeKeyToken(token: string): string {
  if (token === ' ') {
    return 'space';
  }
  const normalized = normalizeGestureToken(token);
  switch (normalized) {
    case 'esc':
      return 'escape';
    case 'return':
      return 'enter';
    case 'spacebar':
      return 'space';
    default:
      return normalized;
  }
}

export function matchesKeybinding(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  binding: string,
): boolean {
  const tokens = normalizeKeybindingValue(binding, '')
    .split('+')
    .map(normalizeKeyToken)
    .filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  const keyToken = tokens.find(token => !['ctrl', 'meta', 'cmd', 'command', 'alt', 'shift', 'commandorcontrol'].includes(token));
  if (!keyToken) {
    return false;
  }

  const needsCtrl = tokens.includes('ctrl');
  const needsMeta = tokens.includes('meta') || tokens.includes('cmd') || tokens.includes('command');
  const needsAlt = tokens.includes('alt');
  const needsShift = tokens.includes('shift');
  const needsCommandOrControl = tokens.includes('commandorcontrol');

  const ctrlMatches = needsCommandOrControl ? (event.ctrlKey || event.metaKey) : event.ctrlKey === needsCtrl;
  const metaMatches = needsCommandOrControl ? true : event.metaKey === needsMeta;
  const altMatches = event.altKey === needsAlt;
  const shiftMatches = event.shiftKey === needsShift;
  const normalizedEventKey = normalizeKeyToken(event.key.length === 1 ? event.key.toLowerCase() : event.key);

  return ctrlMatches
    && metaMatches
    && altMatches
    && shiftMatches
    && normalizedEventKey === keyToken;
}

export function matchesWheelHotkey(
  event: Pick<WheelEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  binding: string,
): boolean {
  const tokens = normalizeKeybindingValue(binding, 'Ctrl+Scroll')
    .split('+')
    .map(normalizeGestureToken);

  if (!tokens.includes('scroll')) {
    return false;
  }

  const needsCtrl = tokens.includes('ctrl');
  const needsMeta = tokens.includes('meta') || tokens.includes('cmd') || tokens.includes('command');
  const needsAlt = tokens.includes('alt');
  const needsShift = tokens.includes('shift');
  const needsCommandOrControl = tokens.includes('commandorcontrol');

  const ctrlMatches = needsCommandOrControl ? (event.ctrlKey || event.metaKey) : event.ctrlKey === needsCtrl;
  const metaMatches = needsCommandOrControl ? true : event.metaKey === needsMeta;

  return ctrlMatches
    && metaMatches
    && event.altKey === needsAlt
    && event.shiftKey === needsShift;
}
