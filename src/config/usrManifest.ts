import shippedUsrManifestJson from '../../usr/manifest.json';

export interface GreebleUsrManifestEntry {
  id: string;
  relativeDirectory: string;
  envVarSuffix?: string;
  bundled: boolean;
  bootstrapToManagedRoot: boolean;
}

export interface GreebleUsrManifest {
  version: number;
  entries: GreebleUsrManifestEntry[];
}

const rawUsrManifest = shippedUsrManifestJson as GreebleUsrManifest;

function normalizeUsrManifestEntry(entry: GreebleUsrManifestEntry): GreebleUsrManifestEntry {
  return {
    id: String(entry.id).trim(),
    relativeDirectory: String(entry.relativeDirectory).trim(),
    envVarSuffix: typeof entry.envVarSuffix === 'string' && entry.envVarSuffix.trim().length > 0
      ? entry.envVarSuffix.trim()
      : undefined,
    bundled: entry.bundled !== false,
    bootstrapToManagedRoot: entry.bootstrapToManagedRoot !== false,
  };
}

export const greebleUsrManifest: GreebleUsrManifest = {
  version: typeof rawUsrManifest.version === 'number' ? rawUsrManifest.version : 1,
  entries: Array.isArray(rawUsrManifest.entries)
    ? rawUsrManifest.entries.map(normalizeUsrManifestEntry)
    : [],
};

export const greebleUsrManifestEntries = greebleUsrManifest.entries;

export const greebleUsrManagedContentEntries = greebleUsrManifestEntries.filter(
  (entry): entry is GreebleUsrManifestEntry & { envVarSuffix: string } => (
    typeof entry.envVarSuffix === 'string' && entry.envVarSuffix.length > 0
  ),
);

const greebleUsrManifestEntryLookup = new Map(
  greebleUsrManifestEntries.map(entry => [entry.id, entry] as const),
);

export const PRIMARY_USR_SOURCE_ROOT_ENV_VAR = 'VITE_GREEBLEFS_USR_DIR';
export const LEGACY_USR_SOURCE_ROOT_ENV_VAR = 'VITE_OVERLAYTERM_USR_DIR';
export const PRIMARY_NATIVE_USR_SOURCE_ROOT_ENV_VAR = 'GREEBLEFS_USR_DIR';
export const LEGACY_NATIVE_USR_SOURCE_ROOT_ENV_VAR = 'OVERLAYTERM_USR_DIR';
export const PRIMARY_MANAGED_CONTENT_ROOT_ENV_VAR = 'GREEBLEFS_MANAGED_CONTENT_ROOT';
export const LEGACY_MANAGED_CONTENT_ROOT_ENV_VAR = 'OVERLAYTERM_MANAGED_CONTENT_ROOT';

export function getGreebleUsrManifestEntry(entryId: string): GreebleUsrManifestEntry | null {
  return greebleUsrManifestEntryLookup.get(entryId) ?? null;
}
