export type HotkeyBindingKey =
  | 'toggleDeveloperTelemetryHud'
  | 'commandPalette'
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
  | 'toggleExplorerSearchScope'
  | 'cycleExplorerSortKey'
  | 'toggleExplorerSortOrder'
  | 'focusExplorerList'
  | 'focusExplorerAddressBar'
  | 'focusExplorerPreview'
  | 'openInTerminal'
  | 'calculateRecursiveSize'
  | 'revealInExplorer'
  | 'openAsAdmin'
  | 'goUpDirectory'
  | 'copyPath'
  | 'copySelection'
  | 'cutSelection'
  | 'pasteSelection'
  | 'toggleHiddenFiles'
  | 'toggleExplorerLayout'
  | 'selectAllExplorer'
  | 'clearExplorerSelection'
  | 'searchExplorer'
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

export type HotkeyBindingSettings = Record<HotkeyBindingKey, string>;

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
    description: 'Global shortcut used to jump directly into the terminal panel.',
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
    key: 'toggleExplorerSearchScope',
    label: 'Toggle Include Text Search',
    description: 'Toggle whether explorer search includes file contents.',
    defaultValue: 'Ctrl+Alt+F',
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
    description: 'Copy the current explorer selection into the transfer queue.',
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
  return hotkeyBindingDefinitions.reduce((result, definition) => {
    result[definition.key] = definition.defaultValue;
    return result;
  }, {} as HotkeyBindingSettings);
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
  value: Partial<Record<HotkeyBindingKey, unknown>> | undefined,
): HotkeyBindingSettings {
  const defaults = createDefaultKeybindingSettings();

  return hotkeyBindingDefinitions.reduce((result, definition) => {
    result[definition.key] = normalizeKeybindingValue(value?.[definition.key], defaults[definition.key]);
    return result;
  }, {} as HotkeyBindingSettings);
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
