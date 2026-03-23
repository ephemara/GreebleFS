export type HotkeyBindingKey =
  | 'commandPalette'
  | 'terminalFocus'
  | 'terminalToggle'
  | 'windowModeToggle'
  | 'saveFile'
  | 'newFile'
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
    key: 'terminalToggle',
    label: 'Toggle Overlay',
    description: 'Global shortcut used to open or hide the overlay window.',
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
    label: 'Toggle Window Mode',
    description: 'Switch between the anchored overlay and the regular resizable panel window.',
    defaultValue: 'F11',
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
    description: 'Reserved for file creation actions.',
    defaultValue: 'Ctrl+N',
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
    defaultValue: 'Ctrl+F',
    scope: 'local',
  },
  {
    key: 'replace',
    label: 'Replace',
    description: 'Reserved for replace actions.',
    defaultValue: 'Ctrl+H',
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
