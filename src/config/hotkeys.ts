export type HotkeyBindingKey =
  | 'commandPalette'
  | 'terminalToggle'
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
    description: 'Reserved for command palette actions.',
    defaultValue: 'Ctrl+K',
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
