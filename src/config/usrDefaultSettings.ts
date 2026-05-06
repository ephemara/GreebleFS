import shippedDefaultProfileSettingsJson from '../../usr/profiles/default/settings.json';
import shippedSharedSettingsJson from '../../usr/profiles/shared/settings.json';

export type UsrSettingsJsonRecord = Record<string, unknown>;

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonValue(entry)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as UsrSettingsJsonRecord).map(([key, entryValue]) => [
        key,
        cloneJsonValue(entryValue),
      ]),
    ) as T;
  }
  return value;
}

function normalizeJsonRecord(value: unknown): UsrSettingsJsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? cloneJsonValue(value as UsrSettingsJsonRecord)
    : {};
}

export const shippedUsrSharedDefaultSettings = normalizeJsonRecord(
  shippedSharedSettingsJson,
);

export const shippedUsrDefaultProfileSettings = normalizeJsonRecord(
  shippedDefaultProfileSettingsJson,
);

export function buildShippedUsrEffectiveDefaultSettings(): UsrSettingsJsonRecord {
  return {
    ...cloneJsonValue(shippedUsrSharedDefaultSettings),
    ...cloneJsonValue(shippedUsrDefaultProfileSettings),
  };
}
