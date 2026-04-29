export type OverlayPluginSettingsValue =
  | string
  | number
  | boolean
  | null
  | OverlayPluginSettingsValue[]
  | { [key: string]: OverlayPluginSettingsValue };

export type OverlayPluginSettingsFieldKind =
  | 'boolean'
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'json'
  | 'path-list'
  | 'extension-list';

export interface OverlayPluginSettingsOptionDefinition {
  value: string;
  label: string;
  description?: string;
}

export interface OverlayPluginSettingsFieldDefinition {
  id: string;
  label: string;
  description?: string;
  kind: OverlayPluginSettingsFieldKind;
  placeholder?: string;
  defaultValue?: OverlayPluginSettingsValue;
  min?: number;
  max?: number;
  step?: number;
  options: OverlayPluginSettingsOptionDefinition[];
  order: number;
  keywords: string[];
}

export interface OverlayPluginSettingsSlotDescriptor {
  id: string;
  pluginId: string;
  pluginName: string;
  title: string;
  description?: string;
  iconName?: string;
  keywords: string[];
  order: number;
  rendererEntry: string | null;
  defaults: Record<string, OverlayPluginSettingsValue>;
  fields: OverlayPluginSettingsFieldDefinition[];
}

export function sanitizeOverlayPluginSettingsValue(
  value: unknown,
): OverlayPluginSettingsValue | undefined {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeOverlayPluginSettingsValue(entry))
      .filter(
        (entry): entry is OverlayPluginSettingsValue => entry !== undefined,
      );
  }
  if (typeof value === 'object') {
    const normalizedEntries = Object.entries(
      value as Record<string, unknown>,
    ).flatMap(([key, entry]) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        return [];
      }
      const normalizedEntry = sanitizeOverlayPluginSettingsValue(entry);
      return normalizedEntry === undefined
        ? []
        : [[trimmedKey, normalizedEntry] as const];
    });
    return Object.fromEntries(normalizedEntries);
  }
  return undefined;
}

export function normalizeOverlayPluginSettingsValueMap(
  value: unknown,
): Record<string, OverlayPluginSettingsValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        return [];
      }
      const normalizedEntry = sanitizeOverlayPluginSettingsValue(entry);
      return normalizedEntry === undefined
        ? []
        : [[trimmedKey, normalizedEntry] as const];
    }),
  );
}

function clampNumberValue(
  value: number,
  min?: number,
  max?: number,
): number {
  let nextValue = value;
  if (typeof min === 'number' && Number.isFinite(min)) {
    nextValue = Math.max(min, nextValue);
  }
  if (typeof max === 'number' && Number.isFinite(max)) {
    nextValue = Math.min(max, nextValue);
  }
  return nextValue;
}

function getOverlayPluginSettingsFieldFallbackValue(
  field: OverlayPluginSettingsFieldDefinition,
): OverlayPluginSettingsValue {
  switch (field.kind) {
    case 'boolean':
      return false;
    case 'number':
      return clampNumberValue(0, field.min, field.max);
    case 'select':
      return field.options[0]?.value ?? '';
    case 'json':
      return null;
    case 'textarea':
    case 'path-list':
    case 'extension-list':
    case 'text':
    default:
      return '';
  }
}

export function coerceOverlayPluginSettingsFieldValue(
  field: OverlayPluginSettingsFieldDefinition,
  value: unknown,
): OverlayPluginSettingsValue {
  switch (field.kind) {
    case 'boolean':
      return value === true;
    case 'number': {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return clampNumberValue(value, field.min, field.max);
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsedValue = Number(value.trim());
        if (Number.isFinite(parsedValue)) {
          return clampNumberValue(parsedValue, field.min, field.max);
        }
      }
      return field.defaultValue ?? getOverlayPluginSettingsFieldFallbackValue(field);
    }
    case 'select': {
      const normalizedValue =
        typeof value === 'string' && value.trim().length > 0
          ? value.trim()
          : '';
      if (
        normalizedValue &&
        field.options.some((option) => option.value === normalizedValue)
      ) {
        return normalizedValue;
      }
      if (
        typeof field.defaultValue === 'string' &&
        field.options.some((option) => option.value === field.defaultValue)
      ) {
        return field.defaultValue;
      }
      return getOverlayPluginSettingsFieldFallbackValue(field);
    }
    case 'json': {
      const normalizedValue = sanitizeOverlayPluginSettingsValue(value);
      return normalizedValue ?? field.defaultValue ?? null;
    }
    case 'textarea':
    case 'path-list':
    case 'extension-list':
    case 'text':
    default:
      return typeof value === 'string'
        ? value
        : typeof field.defaultValue === 'string'
          ? field.defaultValue
          : getOverlayPluginSettingsFieldFallbackValue(field);
  }
}

export function resolveOverlayPluginSettingsSlotValues(
  slot: Pick<OverlayPluginSettingsSlotDescriptor, 'defaults' | 'fields'>,
  storedValues: Record<string, OverlayPluginSettingsValue> | null | undefined,
): Record<string, OverlayPluginSettingsValue> {
  const resolvedValues = {
    ...normalizeOverlayPluginSettingsValueMap(slot.defaults),
    ...normalizeOverlayPluginSettingsValueMap(storedValues),
  };

  slot.fields.forEach((field) => {
    const resolvedValue = Object.prototype.hasOwnProperty.call(
      resolvedValues,
      field.id,
    )
      ? resolvedValues[field.id]
      : field.defaultValue;
    resolvedValues[field.id] = coerceOverlayPluginSettingsFieldValue(
      field,
      resolvedValue,
    );
  });

  return resolvedValues;
}
