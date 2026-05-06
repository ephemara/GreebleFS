import shippedUsrProfileVariantsJson from '../../usr/profiles/variants.json';

type JsonRecord = Record<string, unknown>;

export interface UsrProfileSettingsVariantDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
  sharedSettings: JsonRecord;
  profileSettings: JsonRecord;
}

export interface UsrProfileSettingsVariantCatalog {
  version: number;
  variants: UsrProfileSettingsVariantDefinition[];
}

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonValue(entry)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, entryValue]) => [
        key,
        cloneJsonValue(entryValue),
      ]),
    ) as T;
  }
  return value;
}

function normalizeJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? cloneJsonValue(value as JsonRecord)
    : {};
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
    : [];
}

function normalizeVariantDefinition(value: unknown): UsrProfileSettingsVariantDefinition | null {
  const source = normalizeJsonRecord(value);
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!id) {
    return null;
  }
  const name = typeof source.name === 'string' && source.name.trim().length > 0
    ? source.name.trim()
    : id;
  const description = typeof source.description === 'string'
    ? source.description.trim()
    : '';

  return {
    id,
    name,
    description,
    tags: normalizeStringArray(source.tags),
    sharedSettings: normalizeJsonRecord(source.sharedSettings),
    profileSettings: normalizeJsonRecord(source.profileSettings),
  };
}

const rawCatalog = normalizeJsonRecord(shippedUsrProfileVariantsJson) as {
  version?: unknown;
  variants?: unknown[];
};

export const usrProfileSettingsVariantCatalog: UsrProfileSettingsVariantCatalog = {
  version: typeof rawCatalog.version === 'number' ? rawCatalog.version : 1,
  variants: Array.isArray(rawCatalog.variants)
    ? rawCatalog.variants
      .map((entry) => normalizeVariantDefinition(entry))
      .filter((entry): entry is UsrProfileSettingsVariantDefinition => entry != null)
    : [],
};

export const usrProfileSettingsVariants = usrProfileSettingsVariantCatalog.variants;

const usrProfileSettingsVariantById = new Map(
  usrProfileSettingsVariants.map((variant) => [variant.id, variant] as const),
);

export function getUsrProfileSettingsVariant(
  variantId: string,
): UsrProfileSettingsVariantDefinition | null {
  return usrProfileSettingsVariantById.get(variantId) ?? null;
}

export function buildUsrProfileSettingsVariantOverrides(
  variant: UsrProfileSettingsVariantDefinition,
): JsonRecord {
  return {
    ...cloneJsonValue(variant.sharedSettings),
    ...cloneJsonValue(variant.profileSettings),
  };
}
