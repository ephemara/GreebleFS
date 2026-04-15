export const PLUGIN_PANEL_OPEN_REQUEST_EVENT = 'greeblefs:plugin-panel:open-request';

export interface PluginPanelOpenRequest {
  panelId: string;
  payload: Record<string, string>;
  requestedAt: number;
  nonce: string;
  source: 'plugin-context-menu' | 'plugin-runtime' | 'host';
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getPluginPanelOpenRequestStorageKey(panelId: string): string {
  return `greeblefs:plugin-panel:${panelId.trim()}:open-request`;
}

export function getPluginPanelOpenRequestEvent(panelId: string): string {
  return `greeblefs:plugin-panel:${panelId.trim()}:open-request`;
}

export function createPluginPanelOpenRequest(
  panelId: string,
  payload: Record<string, string>,
  source: PluginPanelOpenRequest['source'] = 'host',
): PluginPanelOpenRequest | null {
  const trimmedPanelId = panelId.trim();
  if (!trimmedPanelId) {
    return null;
  }

  return {
    panelId: trimmedPanelId,
    payload: normalizePluginPanelPayload(payload),
    requestedAt: Date.now(),
    nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    source,
  };
}

export function readPluginPanelOpenRequest(
  panelId: string,
  storage?: StorageLike | null,
): PluginPanelOpenRequest | null {
  const trimmedPanelId = panelId.trim();
  if (!trimmedPanelId) {
    return null;
  }

  const activeStorage = storage ?? getBrowserLocalStorage();
  if (!activeStorage) {
    return null;
  }

  try {
    const rawValue = activeStorage.getItem(getPluginPanelOpenRequestStorageKey(trimmedPanelId));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<PluginPanelOpenRequest>;
    if (typeof parsed.panelId !== 'string' || parsed.panelId.trim() !== trimmedPanelId) {
      return null;
    }

    if (typeof parsed.nonce !== 'string' || !parsed.nonce.trim()) {
      return null;
    }

    return {
      panelId: trimmedPanelId,
      payload: normalizePluginPanelPayload(asStringRecord(parsed.payload)),
      requestedAt: typeof parsed.requestedAt === 'number' ? parsed.requestedAt : 0,
      nonce: parsed.nonce,
      source: parsed.source === 'plugin-runtime' || parsed.source === 'host'
        ? parsed.source
        : 'plugin-context-menu',
    };
  } catch {
    return null;
  }
}

export function requestPluginPanelOpen(
  panelId: string,
  payload: Record<string, string>,
  options?: {
    storage?: StorageLike | null;
    source?: PluginPanelOpenRequest['source'];
    target?: Pick<Window, 'dispatchEvent'> | null;
  },
): PluginPanelOpenRequest | null {
  const request = createPluginPanelOpenRequest(panelId, payload, options?.source ?? 'host');
  if (!request) {
    return null;
  }

  const activeStorage = options?.storage ?? getBrowserLocalStorage();
  try {
    activeStorage?.setItem(
      getPluginPanelOpenRequestStorageKey(request.panelId),
      JSON.stringify(request),
    );
  } catch {
    // Persisting the last request is best-effort only.
  }

  const target = options?.target ?? getBrowserWindow();
  target?.dispatchEvent(new CustomEvent<PluginPanelOpenRequest>(
    PLUGIN_PANEL_OPEN_REQUEST_EVENT,
    { detail: request },
  ));
  target?.dispatchEvent(new CustomEvent<PluginPanelOpenRequest>(
    getPluginPanelOpenRequestEvent(request.panelId),
    { detail: request },
  ));

  return request;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => typeof entry === 'string')
      .map(([key, entry]) => [key, entry.trim()]),
  );
}

function normalizePluginPanelPayload(payload: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, value]) => [key.trim(), value.trim()]),
  );
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
