import type {
  ThemeDesignToken,
  ThemeTokenKind,
  ThemeValue,
} from '../generated/tauri';
import { z } from 'zod';

import { sanitizeRecordValues } from './schemaSanitizers';

export const UI_TOKEN_CATEGORIES = [
  'color',
  'typography',
  'spacing',
  'radius',
  'border',
  'shadow',
  'opacity',
  'blur',
  'geometry',
  'layer',
  'motion',
  'interaction',
] as const satisfies readonly ThemeTokenKind[];

export type UiTokenCategory = typeof UI_TOKEN_CATEGORIES[number];
export type UiTokenPrimitiveValue = string | number | boolean | null;
export type UiTokenValue = UiTokenPrimitiveValue | UiTokenValue[] | { [key: string]: UiTokenValue };
export type UiTokenCategoryMap = Record<string, UiTokenValue>;
export type UiTokenCollection = Partial<Record<UiTokenCategory, UiTokenCategoryMap>>;

const UI_TOKEN_CATEGORY_SET = new Set<string>(UI_TOKEN_CATEGORIES);

const uiTokenPrimitiveValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const uiTokenValueSchema: z.ZodType<UiTokenValue> = z.lazy(() => z.union([
  uiTokenPrimitiveValueSchema,
  z.array(uiTokenValueSchema),
  z.record(z.string(), uiTokenValueSchema),
]));

const uiTokenCollectionShape = Object.fromEntries(
  UI_TOKEN_CATEGORIES.map((category) => [category, z.unknown().optional()]),
) as Record<UiTokenCategory, z.ZodOptional<z.ZodUnknown>>;

const uiTokenCollectionSchema = z.object(uiTokenCollectionShape).strip();

export function isUiTokenCategory(value: unknown): value is UiTokenCategory {
  return typeof value === 'string' && UI_TOKEN_CATEGORY_SET.has(value);
}

export function normalizeUiTokenCategoryMap(value: unknown): UiTokenCategoryMap {
  return sanitizeRecordValues(value, uiTokenValueSchema) as UiTokenCategoryMap;
}

export function normalizeUiTokenCollection(value: unknown): UiTokenCollection {
  const parsedCollection = uiTokenCollectionSchema.safeParse(value);
  if (!parsedCollection.success) {
    return {};
  }

  const normalized: UiTokenCollection = {};
  for (const category of UI_TOKEN_CATEGORIES) {
    const categoryTokens = normalizeUiTokenCategoryMap(parsedCollection.data[category]);
    if (Object.keys(categoryTokens).length > 0) {
      normalized[category] = categoryTokens;
    }
  }

  return normalized;
}

export function mergeUiTokenCollections(
  ...collections: Array<UiTokenCollection | undefined>
): UiTokenCollection {
  const merged: UiTokenCollection = {};
  for (const collection of collections) {
    if (!collection) {
      continue;
    }
    for (const category of UI_TOKEN_CATEGORIES) {
      const tokens = collection[category];
      if (!tokens || Object.keys(tokens).length === 0) {
        continue;
      }
      merged[category] = {
        ...(merged[category] ?? {}),
        ...tokens,
      };
    }
  }
  return merged;
}

function toTokenIdFragment(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toDisplayName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
}

export function flattenUiTokenCollectionToDesignTokens(
  tokens: UiTokenCollection | undefined,
  options: {
    idPrefix?: string;
    namePrefix?: string;
  } = {},
): ThemeDesignToken[] {
  if (!tokens) {
    return [];
  }

  const designTokens: ThemeDesignToken[] = [];
  for (const category of UI_TOKEN_CATEGORIES) {
    const categoryTokens = tokens[category];
    if (!categoryTokens) {
      continue;
    }

    for (const [tokenName, tokenValue] of Object.entries(categoryTokens)) {
      const idParts = [
        options.idPrefix,
        category,
        toTokenIdFragment(tokenName),
      ].filter(Boolean);
      const nameParts = [
        options.namePrefix,
        toDisplayName(category),
        toDisplayName(tokenName),
      ].filter(Boolean);
      designTokens.push({
        id: idParts.join('-'),
        name: nameParts.join(' '),
        kind: category,
        value: tokenValue as ThemeValue,
      });
    }
  }

  return designTokens;
}

export function createUiTokenCssVars(
  tokens: UiTokenCollection | undefined,
  prefix = '--gfs-ui',
): Record<string, string> {
  const cssVars: Record<string, string> = {};
  if (!tokens) {
    return cssVars;
  }

  for (const category of UI_TOKEN_CATEGORIES) {
    const categoryTokens = tokens[category];
    if (!categoryTokens) {
      continue;
    }

    for (const [tokenName, tokenValue] of Object.entries(categoryTokens)) {
      if (typeof tokenValue === 'string' || typeof tokenValue === 'number') {
        cssVars[`${prefix}-${category}-${toTokenIdFragment(tokenName)}`] = String(tokenValue);
      }
    }
  }

  return cssVars;
}
