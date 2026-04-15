export const FILESYSTEM_AQUARIUM_PANEL_ID = 'filesystem-aquarium';
export const FILESYSTEM_AQUARIUM_OPEN_REQUEST_EVENT = 'greeblefs:filesystem-aquarium:open-request';
export const FILESYSTEM_AQUARIUM_OPEN_REQUEST_STORAGE_KEY = 'greeblefs:filesystem-aquarium:open-request';

export interface FilesystemAquariumOpenRequest {
  path: string;
  requestedAt: number;
  nonce: string;
  source: 'explorer';
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createFilesystemAquariumOpenRequest(path: string): FilesystemAquariumOpenRequest {
  const trimmedPath = path.trim();
  return {
    path: trimmedPath,
    requestedAt: Date.now(),
    nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    source: 'explorer',
  };
}

export function readFilesystemAquariumOpenRequest(
  storage?: StorageLike | null,
): FilesystemAquariumOpenRequest | null {
  const activeStorage = storage ?? getBrowserLocalStorage();
  if (!activeStorage) {
    return null;
  }

  try {
    const rawValue = activeStorage.getItem(FILESYSTEM_AQUARIUM_OPEN_REQUEST_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    const parsed = JSON.parse(rawValue) as Partial<FilesystemAquariumOpenRequest>;
    if (typeof parsed.path !== 'string' || !parsed.path.trim()) {
      return null;
    }
    if (typeof parsed.nonce !== 'string' || !parsed.nonce.trim()) {
      return null;
    }
    return {
      path: parsed.path.trim(),
      requestedAt: typeof parsed.requestedAt === 'number' ? parsed.requestedAt : 0,
      nonce: parsed.nonce,
      source: 'explorer',
    };
  } catch {
    return null;
  }
}

export function requestFilesystemAquariumOpen(
  path: string,
  options?: {
    storage?: StorageLike | null;
    target?: Pick<Window, 'dispatchEvent'> | null;
  },
): FilesystemAquariumOpenRequest | null {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return null;
  }

  const request = createFilesystemAquariumOpenRequest(trimmedPath);
  const activeStorage = options?.storage ?? getBrowserLocalStorage();

  try {
    activeStorage?.setItem(
      FILESYSTEM_AQUARIUM_OPEN_REQUEST_STORAGE_KEY,
      JSON.stringify(request),
    );
  } catch {
    // Persisting the last request is best-effort only.
  }

  const target = options?.target ?? getBrowserWindow();
  target?.dispatchEvent(new CustomEvent<FilesystemAquariumOpenRequest>(
    FILESYSTEM_AQUARIUM_OPEN_REQUEST_EVENT,
    { detail: request },
  ));

  return request;
}

function getBrowserLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function getBrowserWindow(): Window | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window;
}
