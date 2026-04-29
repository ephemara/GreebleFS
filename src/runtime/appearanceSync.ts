import type {
  OverlayThemePalette,
  ResolvedOverlayAppearance,
} from '../config/appearance';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface BrowserEventTargetLike {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  dispatchEvent(event: Event): boolean;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export interface SyncedOverlayAppearanceSnapshot {
  version: 1;
  publishedAt: number;
  mode: ResolvedOverlayAppearance['mode'];
  themeId: string;
  themeName: string;
  cssVars: Record<string, string>;
  explorerCssVars: Record<string, string>;
  fonts: ResolvedOverlayAppearance['fonts'];
  palette: OverlayThemePalette;
}

export const SYNCED_OVERLAY_APPEARANCE_STORAGE_KEY = 'greeblefs:appearance:resolved-snapshot';
export const SYNCED_OVERLAY_APPEARANCE_EVENT = 'greeblefs:appearance:resolved-snapshot';

export function createSyncedOverlayAppearanceSnapshot(
  appearance: ResolvedOverlayAppearance,
  publishedAt = Date.now(),
): SyncedOverlayAppearanceSnapshot {
  return {
    version: 1,
    publishedAt,
    mode: appearance.mode,
    themeId: appearance.theme.id,
    themeName: appearance.theme.name,
    cssVars: sanitizeStringRecord(appearance.cssVars),
    explorerCssVars: sanitizeStringRecord(appearance.explorerTheme.cssVars),
    fonts: {
      ui: appearance.fonts.ui,
      mono: appearance.fonts.mono,
    },
    palette: { ...appearance.theme.palette },
  };
}

export function publishSyncedOverlayAppearanceSnapshot(
  appearance: ResolvedOverlayAppearance,
  options?: {
    storage?: StorageLike | null;
    target?: BrowserEventTargetLike | null;
  },
): SyncedOverlayAppearanceSnapshot {
  const snapshot = createSyncedOverlayAppearanceSnapshot(appearance);
  const storage = options?.storage ?? getBrowserLocalStorage();
  const target = options?.target ?? getBrowserWindow();

  try {
    storage?.setItem(
      SYNCED_OVERLAY_APPEARANCE_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // Secondary windows can still fall back to local settings resolution.
  }

  target?.dispatchEvent(
    new CustomEvent<SyncedOverlayAppearanceSnapshot>(
      SYNCED_OVERLAY_APPEARANCE_EVENT,
      { detail: snapshot },
    ),
  );

  return snapshot;
}

export function readSyncedOverlayAppearanceSnapshot(
  storage?: StorageLike | null,
): SyncedOverlayAppearanceSnapshot | null {
  const activeStorage = storage ?? getBrowserLocalStorage();
  if (!activeStorage) {
    return null;
  }

  try {
    const rawValue = activeStorage.getItem(SYNCED_OVERLAY_APPEARANCE_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    return parseSyncedOverlayAppearanceSnapshot(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function listenToSyncedOverlayAppearanceSnapshots(
  listener: (snapshot: SyncedOverlayAppearanceSnapshot) => void,
  options?: {
    storage?: StorageLike | null;
    target?: BrowserEventTargetLike | null;
  },
): () => void {
  const target = options?.target ?? getBrowserWindow();
  const storage = options?.storage ?? getBrowserLocalStorage();

  const handleSnapshotEvent = (event: Event) => {
    const snapshot = parseSyncedOverlayAppearanceSnapshot(
      (event as CustomEvent<unknown>).detail,
    );
    if (snapshot) {
      listener(snapshot);
    }
  };

  const handleStorageEvent = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (
      storageEvent.key !== SYNCED_OVERLAY_APPEARANCE_STORAGE_KEY
      || !storageEvent.newValue
    ) {
      return;
    }

    try {
      const snapshot = parseSyncedOverlayAppearanceSnapshot(
        JSON.parse(storageEvent.newValue),
      );
      if (snapshot) {
        listener(snapshot);
      }
    } catch {
      // Ignore malformed cross-window payloads.
    }
  };

  target?.addEventListener(SYNCED_OVERLAY_APPEARANCE_EVENT, handleSnapshotEvent);
  target?.addEventListener('storage', handleStorageEvent);

  const currentSnapshot = parseSyncedOverlayAppearanceSnapshot(
    readSyncedOverlayAppearanceSnapshot(storage),
  );
  if (currentSnapshot) {
    listener(currentSnapshot);
  }

  return () => {
    target?.removeEventListener(SYNCED_OVERLAY_APPEARANCE_EVENT, handleSnapshotEvent);
    target?.removeEventListener('storage', handleStorageEvent);
  };
}

function parseSyncedOverlayAppearanceSnapshot(
  value: unknown,
): SyncedOverlayAppearanceSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.version !== 1) {
    return null;
  }

  const cssVars = parseStringRecord(record.cssVars);
  const explorerCssVars = parseStringRecord(record.explorerCssVars);
  const fonts = parseFonts(record.fonts);
  const palette = parsePalette(record.palette);
  const themeId = typeof record.themeId === 'string' ? record.themeId.trim() : '';
  const themeName = typeof record.themeName === 'string' ? record.themeName.trim() : '';
  const mode = record.mode === 'overlay' ? 'overlay' : 'windowed';

  if (!themeId || !themeName || !cssVars || !explorerCssVars || !fonts || !palette) {
    return null;
  }

  return {
    version: 1,
    publishedAt: typeof record.publishedAt === 'number' ? record.publishedAt : 0,
    mode,
    themeId,
    themeName,
    cssVars,
    explorerCssVars,
    fonts,
    palette,
  };
}

function parseFonts(value: unknown): SyncedOverlayAppearanceSnapshot['fonts'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const ui = typeof record.ui === 'string' ? record.ui.trim() : '';
  const mono = typeof record.mono === 'string' ? record.mono.trim() : '';
  if (!ui || !mono) {
    return null;
  }
  return { ui, mono };
}

function parsePalette(value: unknown): OverlayThemePalette | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const requiredKeys: Array<keyof OverlayThemePalette> = [
    'appBackground',
    'appBackgroundAlt',
    'shellBackground',
    'shellBackgroundSolid',
    'topBarBackground',
    'topBarMenuBackground',
    'sidebarBackground',
    'panelBackground',
    'panelAltBackground',
    'cardBackground',
    'cardHoverBackground',
    'contextMenuBackground',
    'inputBackground',
    'terminalBackground',
    'selectionBackground',
    'scrimBackground',
    'textPrimary',
    'textSecondary',
    'textMuted',
    'textDim',
    'textInverse',
    'border',
    'borderStrong',
    'accent',
    'accentSoft',
    'accentContrast',
    'success',
    'warning',
    'danger',
    'info',
    'note',
    'todo',
    'bug',
    'prompt',
  ];

  if (requiredKeys.some((key) => typeof record[key] !== 'string')) {
    return null;
  }

  return Object.fromEntries(
    requiredKeys.map((key) => [key, String(record[key])]),
  ) as unknown as OverlayThemePalette;
}

function parseStringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return sanitizeStringRecord(value as Record<string, unknown>);
}

function sanitizeStringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string',
    ),
  );
}

function getBrowserLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function getBrowserWindow(): BrowserEventTargetLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window;
}
