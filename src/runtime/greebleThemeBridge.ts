/**
 * greebleThemeBridge — backs the `theme` API domain with a real renderer path.
 *
 * API-registered themes (`fs.registerTheme`) live in the shared harness book.
 * This bridge converts them into `OverlayThemeDefinition`s so the ENTIRE
 * existing pipeline — ThemeCatalog, applyThemeSelection, appearance
 * resolution, CSS vars — consumes them with zero special-casing:
 *
 * - tokens → CSS vars (`--` keys verbatim, others `--greeble-theme-<key>`)
 * - tokens matching palette fields (accent, …) also override the palette
 * - `extends` resolves against built-in presets (fallback: first preset)
 * - definition ids keep the authored id when free, else `api-<id>`
 * - reactive via the registry version (`useGreebleApiThemeDefinitions`)
 *
 * Legacy JSON packs keep working untouched; API themes simply appear
 * alongside them. Disposing a harness withdraws its themes live.
 */

import { useSyncExternalStore } from 'react';
import {
  normalizeThemeDefinition,
  overlayThemePresets,
  type OverlayThemeDefinition,
} from '../config/appearance';
import type {
  GreebleRegistry,
  GreebleThemeContribution,
} from '../api/greeble';
import { getGreebleDomainBook } from './greebleHost';

function getThemeRegistry(): GreebleRegistry<GreebleThemeContribution> {
  return getGreebleDomainBook().define<GreebleThemeContribution>('theme');
}

function resolveFallbackPreset(
  extendsId: string | undefined,
): OverlayThemeDefinition {
  if (extendsId) {
    const hit = overlayThemePresets.find(preset => preset.id === extendsId);
    if (hit) return hit;
  }
  return overlayThemePresets[0];
}

/** Authored id when free, `api-<id>` on collision with built-ins/packs. */
export function resolveApiThemeDefinitionId(
  contributionId: string,
  takenIds: ReadonlySet<string>,
): string {
  const wanted = contributionId.trim() || 'api-theme';
  if (!takenIds.has(wanted)) return wanted;
  let suffix = 2;
  while (takenIds.has(`api-${wanted}-${suffix}`)) suffix += 1;
  return `api-${wanted}-${suffix}`;
}

export function convertGreebleThemeToDefinition(
  entry: GreebleThemeContribution,
  takenIds: Set<string>,
): OverlayThemeDefinition | null {
  try {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) {
      return null;
    }
    const fallback = resolveFallbackPreset(entry.extends);
    const paletteKeys = new Set(Object.keys(fallback.palette ?? {}));
    const cssVars: Record<string, string> = {};
    const paletteOverlay: Record<string, string> = {};
    for (const [key, value] of Object.entries(entry.tokens ?? {})) {
      if (typeof key !== 'string' || key.length === 0) continue;
      const text = String(value);
      cssVars[key.startsWith('--') ? key : `--greeble-theme-${key}`] = text;
      if (paletteKeys.has(key) && typeof value === 'string') {
        paletteOverlay[key] = value;
      }
    }
    const definitionId = resolveApiThemeDefinitionId(entry.id, takenIds);
    takenIds.add(definitionId);
    return normalizeThemeDefinition(
      {
        id: definitionId,
        name: entry.title?.trim() ? entry.title : entry.id,
        description: entry.description ?? `API theme "${entry.id}" via the greeblefs harness.`,
        extendsThemeId: fallback.id,
        palette: { ...fallback.palette, ...paletteOverlay },
        cssVars: { ...(fallback.cssVars ?? {}), ...cssVars },
        source: 'custom',
      },
      fallback,
    );
  } catch (error) {
    console.warn(`GreebleFS API theme "${(entry as { id?: unknown })?.id}" failed to convert`, error);
    return null;
  }
}

interface ApiThemeSnapshot {
  version: number;
  definitions: OverlayThemeDefinition[];
}

let snapshotCache: ApiThemeSnapshot | null = null;

function readApiThemeSnapshot(): ApiThemeSnapshot {
  const registry = getThemeRegistry();
  const version = registry.version();
  if (snapshotCache && snapshotCache.version === version) {
    return snapshotCache;
  }
  const takenIds = new Set<string>(overlayThemePresets.map(preset => preset.id));
  const definitions: OverlayThemeDefinition[] = [];
  for (const entry of registry.list()) {
    const definition = convertGreebleThemeToDefinition(entry, takenIds);
    if (definition) definitions.push(definition);
  }
  snapshotCache = { version, definitions };
  return snapshotCache;
}

/** All currently registered API themes as renderable definitions. */
export function getGreebleApiThemeDefinitions(): OverlayThemeDefinition[] {
  return readApiThemeSnapshot().definitions;
}

/** Look a converted definition back up by definition id. */
export function resolveGreebleApiThemeDefinition(
  definitionId: string,
): OverlayThemeDefinition | null {
  return getGreebleApiThemeDefinitions().find(def => def.id === definitionId) ?? null;
}

/** Reactive hook for App/settings — re-renders when themes (un)register. */
export function useGreebleApiThemeDefinitions(): OverlayThemeDefinition[] {
  return useSyncExternalStore(
    (notify: () => void) => {
      const handle = getThemeRegistry().subscribe(() => notify());
      return () => handle.dispose();
    },
    () => getGreebleApiThemeDefinitions(),
    () => getGreebleApiThemeDefinitions(),
  );
}
