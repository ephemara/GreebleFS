import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  EXPLORER_PICKER_SECONDARY_WINDOW_ID,
  createSecondaryWindowOpenRequest,
  openSecondaryWindow,
} from './secondaryWindows';
import { bindDeferredUnlisten } from './deferredUnlisten';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface BrowserEventTargetLike {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  dispatchEvent(event: Event): boolean;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export type ExplorerPickerRequestKind =
  | 'openFile'
  | 'openFiles'
  | 'openFolder'
  | 'openFolders'
  | 'pickDestinationFolder'
  | 'saveFile';

export type ExplorerPickerPresentation = 'embedded' | 'window' | 'auto';
export type ExplorerPickerResolvedPresentation = Exclude<ExplorerPickerPresentation, 'auto'>;
export type ExplorerPickerEntryKind = 'file' | 'folder';

export interface ExplorerPickerEntry {
  kind: ExplorerPickerEntryKind;
  name: string;
  path: string;
}

export interface OpenExplorerPickerRequest {
  allowCreateDirectory?: boolean;
  allowedExtensions?: string[];
  confirmLabel?: string;
  defaultExtension?: string | null;
  initialFileName?: string | null;
  kind: ExplorerPickerRequestKind;
  presentation?: ExplorerPickerPresentation;
  startPath?: string | null;
  title?: string;
}

export interface ExplorerPickerRequest {
  allowCreateDirectory: boolean;
  allowedExtensions: string[];
  confirmLabel: string;
  defaultExtension: string | null;
  initialFileName: string | null;
  kind: ExplorerPickerRequestKind;
  nonce: string;
  presentation: ExplorerPickerResolvedPresentation;
  requestedAt: number;
  sourceWindowLabel: string | null;
  startPath: string | null;
  title: string;
}

export interface ExplorerPickerResult {
  cancelled: boolean;
  completedAt: number;
  currentDirectory: string;
  entries: ExplorerPickerEntry[];
  nonce: string;
}

const EXPLORER_PICKER_WINDOW_BASE_TITLE = 'Explorer Picker';

export const EXPLORER_PICKER_WINDOW_LABEL = 'picker';
export const EXPLORER_PICKER_REQUEST_EVENT = 'greeblefs:explorer-picker:request';
export const EXPLORER_PICKER_RESULT_EVENT = 'greeblefs:explorer-picker:result';
export const EXPLORER_PICKER_REQUEST_STORAGE_KEY = 'greeblefs:explorer-picker:last-request';
export const EXPLORER_PICKER_RESULT_STORAGE_KEY = 'greeblefs:explorer-picker:last-result';

export const EXPLORER_PICKER_WINDOW_CONFIG = {
  height: 760,
  minHeight: 560,
  minWidth: 780,
  resizable: true,
  title: EXPLORER_PICKER_WINDOW_BASE_TITLE,
  width: 1080,
} as const;

export function isCurrentExplorerPickerWindow(): boolean {
  if (!isTauri()) {
    return false;
  }

  try {
    return getCurrentWebviewWindow().label === EXPLORER_PICKER_WINDOW_LABEL;
  } catch {
    return false;
  }
}

export function createExplorerPickerRequest(
  value: OpenExplorerPickerRequest,
): ExplorerPickerRequest | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const kind = normalizeExplorerPickerKind(value.kind);
  if (!kind) {
    return null;
  }

  const requestedAt = Date.now();
  const nonce = `${requestedAt}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    allowCreateDirectory:
      typeof value.allowCreateDirectory === 'boolean'
        ? value.allowCreateDirectory
        : kind !== 'openFile' && kind !== 'openFiles',
    allowedExtensions: normalizeAllowedExtensions(value.allowedExtensions),
    confirmLabel: normalizeNonEmptyString(value.confirmLabel)
      ?? getDefaultExplorerPickerConfirmLabel(kind),
    defaultExtension: normalizeExtension(value.defaultExtension),
    initialFileName: normalizeOptionalPathSegment(value.initialFileName),
    kind,
    nonce,
    presentation: resolveExplorerPickerPresentation(value.presentation),
    requestedAt,
    sourceWindowLabel: getCurrentWindowLabel(),
    startPath: normalizeOptionalPath(value.startPath),
    title: normalizeNonEmptyString(value.title) ?? getDefaultExplorerPickerTitle(kind),
  };
}

export function readExplorerPickerRequest(
  storage?: StorageLike | null,
): ExplorerPickerRequest | null {
  const activeStorage = storage ?? getBrowserLocalStorage();
  if (!activeStorage) {
    return null;
  }

  try {
    const rawValue = activeStorage.getItem(EXPLORER_PICKER_REQUEST_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    return parseExplorerPickerRequest(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function readExplorerPickerResult(
  storage?: StorageLike | null,
): ExplorerPickerResult | null {
  const activeStorage = storage ?? getBrowserLocalStorage();
  if (!activeStorage) {
    return null;
  }

  try {
    const rawValue = activeStorage.getItem(EXPLORER_PICKER_RESULT_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    return parseExplorerPickerResult(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export async function openExplorerPicker(
  value: OpenExplorerPickerRequest,
): Promise<ExplorerPickerResult | null> {
  const request = createExplorerPickerRequest(value);
  if (!request) {
    return null;
  }

  persistJsonValue(EXPLORER_PICKER_REQUEST_STORAGE_KEY, request);
  dispatchBrowserCustomEvent(EXPLORER_PICKER_REQUEST_EVENT, request);
  await broadcastWindowEvent(EXPLORER_PICKER_REQUEST_EVENT, request);

  if (request.presentation === 'window' && isTauri()) {
    try {
      await openSecondaryWindow(createSecondaryWindowOpenRequest({
        windowId: EXPLORER_PICKER_SECONDARY_WINDOW_ID,
        surfaceKind: 'explorer-picker',
        presentation: 'frameless-widget',
        title: request.title || EXPLORER_PICKER_WINDOW_BASE_TITLE,
        payload: {
          requestKind: request.kind,
          requestNonce: request.nonce,
        },
      }));
    } catch (error) {
      console.error('GreebleFS: failed to open explorer picker window', error);
      return null;
    }
  }

  return waitForExplorerPickerResult(request.nonce);
}

export async function publishExplorerPickerResult(value: {
  cancelled?: boolean;
  currentDirectory: string;
  entries?: ExplorerPickerEntry[];
  nonce: string;
}): Promise<ExplorerPickerResult | null> {
  const detail = createExplorerPickerResult(value);
  if (!detail) {
    return null;
  }

  persistJsonValue(EXPLORER_PICKER_RESULT_STORAGE_KEY, detail);
  dispatchBrowserCustomEvent(EXPLORER_PICKER_RESULT_EVENT, detail);
  await broadcastWindowEvent(EXPLORER_PICKER_RESULT_EVENT, detail);
  return detail;
}

export function listenToExplorerPickerRequests(
  listener: (request: ExplorerPickerRequest) => void,
  options?: {
    storage?: StorageLike | null;
    target?: BrowserEventTargetLike | null;
  },
): () => void {
  return registerCrossWindowListener({
    eventName: EXPLORER_PICKER_REQUEST_EVENT,
    listener,
    parseDetail: parseExplorerPickerRequest,
    storage: options?.storage ?? null,
    storageKey: EXPLORER_PICKER_REQUEST_STORAGE_KEY,
    target: options?.target ?? null,
  });
}

export function listenToExplorerPickerResults(
  listener: (result: ExplorerPickerResult) => void,
  options?: {
    storage?: StorageLike | null;
    target?: BrowserEventTargetLike | null;
  },
): () => void {
  return registerCrossWindowListener({
    eventName: EXPLORER_PICKER_RESULT_EVENT,
    listener,
    parseDetail: parseExplorerPickerResult,
    storage: options?.storage ?? null,
    storageKey: EXPLORER_PICKER_RESULT_STORAGE_KEY,
    target: options?.target ?? null,
  });
}

async function waitForExplorerPickerResult(
  nonce: string,
): Promise<ExplorerPickerResult | null> {
  const existing = readExplorerPickerResult();
  if (existing?.nonce === nonce) {
    return existing.cancelled ? null : existing;
  }

  return new Promise<ExplorerPickerResult | null>((resolve) => {
    const stopListening = listenToExplorerPickerResults((result) => {
      if (result.nonce !== nonce) {
        return;
      }

      stopListening();
      resolve(result.cancelled ? null : result);
    });
  });
}

function createExplorerPickerResult(value: {
  cancelled?: boolean;
  currentDirectory: string;
  entries?: ExplorerPickerEntry[];
  nonce: string;
}): ExplorerPickerResult | null {
  const nonce = typeof value.nonce === 'string' ? value.nonce.trim() : '';
  const currentDirectory = typeof value.currentDirectory === 'string'
    ? value.currentDirectory.trim()
    : '';
  if (!nonce || !currentDirectory) {
    return null;
  }

  const entries = normalizeExplorerPickerEntries(value.entries ?? []);
  return {
    cancelled: Boolean(value.cancelled),
    completedAt: Date.now(),
    currentDirectory,
    entries,
    nonce,
  };
}

function parseExplorerPickerRequest(value: unknown): ExplorerPickerRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const kind = normalizeExplorerPickerKind(record.kind);
  const presentation = normalizeExplorerPickerResolvedPresentation(record.presentation);
  const nonce = typeof record.nonce === 'string' ? record.nonce.trim() : '';
  if (!kind || !presentation || !nonce) {
    return null;
  }

  return {
    allowCreateDirectory:
      typeof record.allowCreateDirectory === 'boolean'
        ? record.allowCreateDirectory
        : kind !== 'openFile' && kind !== 'openFiles',
    allowedExtensions: normalizeAllowedExtensions(record.allowedExtensions),
    confirmLabel:
      normalizeNonEmptyString(record.confirmLabel)
      ?? getDefaultExplorerPickerConfirmLabel(kind),
    defaultExtension: normalizeExtension(record.defaultExtension),
    initialFileName: normalizeOptionalPathSegment(record.initialFileName),
    kind,
    nonce,
    presentation,
    requestedAt: typeof record.requestedAt === 'number' ? record.requestedAt : 0,
    sourceWindowLabel:
      typeof record.sourceWindowLabel === 'string'
        ? record.sourceWindowLabel.trim() || null
        : null,
    startPath: normalizeOptionalPath(record.startPath),
    title: normalizeNonEmptyString(record.title) ?? getDefaultExplorerPickerTitle(kind),
  };
}

function parseExplorerPickerResult(value: unknown): ExplorerPickerResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nonce = typeof record.nonce === 'string' ? record.nonce.trim() : '';
  const currentDirectory =
    typeof record.currentDirectory === 'string' ? record.currentDirectory.trim() : '';
  if (!nonce || !currentDirectory) {
    return null;
  }

  return {
    cancelled: Boolean(record.cancelled),
    completedAt: typeof record.completedAt === 'number' ? record.completedAt : 0,
    currentDirectory,
    entries: normalizeExplorerPickerEntries(record.entries),
    nonce,
  };
}

function normalizeExplorerPickerEntries(value: unknown): ExplorerPickerEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nextEntries: ExplorerPickerEntry[] = [];
  const seenPaths = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const kind = normalizeExplorerPickerEntryKind(record.kind);
    const path = typeof record.path === 'string' ? record.path.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!kind || !path || !name || seenPaths.has(path)) {
      continue;
    }

    seenPaths.add(path);
    nextEntries.push({ kind, name, path });
  }

  return nextEntries;
}

function normalizeExplorerPickerKind(value: unknown): ExplorerPickerRequestKind | null {
  switch (value) {
    case 'openFile':
    case 'openFiles':
    case 'openFolder':
    case 'openFolders':
    case 'pickDestinationFolder':
    case 'saveFile':
      return value;
    default:
      return null;
  }
}

function normalizeExplorerPickerEntryKind(value: unknown): ExplorerPickerEntryKind | null {
  return value === 'file' || value === 'folder' ? value : null;
}

function normalizeExplorerPickerResolvedPresentation(
  value: unknown,
): ExplorerPickerResolvedPresentation | null {
  return value === 'embedded' || value === 'window' ? value : null;
}

function resolveExplorerPickerPresentation(
  value: ExplorerPickerPresentation | undefined,
): ExplorerPickerResolvedPresentation {
  if (value === 'embedded' || value === 'window') {
    return value;
  }

  return getCurrentWindowLabel() === 'main' ? 'embedded' : 'window';
}

function normalizeAllowedExtensions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueValues = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeExtension(entry);
    if (!normalized || uniqueValues.has(normalized)) {
      continue;
    }
    uniqueValues.add(normalized);
  }
  return [...uniqueValues];
}

function normalizeExtension(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/^\.+/, '').toLowerCase();
  return normalized || null;
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeOptionalPath(value: unknown): string | null {
  return normalizeNonEmptyString(value);
}

function normalizeOptionalPathSegment(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function getDefaultExplorerPickerTitle(kind: ExplorerPickerRequestKind): string {
  switch (kind) {
    case 'openFile':
      return 'Select File';
    case 'openFiles':
      return 'Select Files';
    case 'openFolder':
      return 'Select Folder';
    case 'openFolders':
      return 'Select Folders';
    case 'pickDestinationFolder':
      return 'Choose Destination Folder';
    case 'saveFile':
      return 'Save File';
  }
}

function getDefaultExplorerPickerConfirmLabel(kind: ExplorerPickerRequestKind): string {
  switch (kind) {
    case 'openFile':
      return 'Choose File';
    case 'openFiles':
      return 'Choose Files';
    case 'openFolder':
      return 'Choose Folder';
    case 'openFolders':
      return 'Choose Folders';
    case 'pickDestinationFolder':
      return 'Choose Destination';
    case 'saveFile':
      return 'Save File';
  }
}

function registerCrossWindowListener<T>(args: {
  eventName: string;
  listener: (value: T) => void;
  parseDetail: (value: unknown) => T | null;
  storage?: StorageLike | null;
  storageKey: string;
  target?: BrowserEventTargetLike | null;
}): () => void {
  const browserTarget = args.target ?? getBrowserWindow();

  const handleBrowserEvent = (event: Event) => {
    const value = args.parseDetail((event as CustomEvent<unknown>).detail);
    if (value) {
      args.listener(value);
    }
  };
  const handleStorageEvent = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key !== args.storageKey || !storageEvent.newValue) {
      return;
    }

    try {
      const parsed = args.parseDetail(JSON.parse(storageEvent.newValue));
      if (parsed) {
        args.listener(parsed);
      }
    } catch {
      // Ignore malformed cross-window payloads.
    }
  };

  browserTarget?.addEventListener(args.eventName, handleBrowserEvent);
  browserTarget?.addEventListener('storage', handleStorageEvent);

  let closed = false;
  let stopTauriListener: (() => void) | null = null;
  if (isTauri()) {
    stopTauriListener = bindDeferredUnlisten(
      getCurrentWindow().listen<unknown>(args.eventName, (event) => {
        const value = args.parseDetail(event.payload);
        if (value) {
          args.listener(value);
        }
      }),
      { onError: () => undefined },
    );
  }

  return () => {
    if (closed) {
      return;
    }
    closed = true;
    browserTarget?.removeEventListener(args.eventName, handleBrowserEvent);
    browserTarget?.removeEventListener('storage', handleStorageEvent);
    stopTauriListener?.();
  };
}

async function broadcastWindowEvent<T>(eventName: string, payload: T): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    await getCurrentWindow().emit(eventName, payload);
  } catch {
    // Browser and non-window test environments fall back to local dispatch only.
  }
}

function dispatchBrowserCustomEvent<T>(eventName: string, detail: T): void {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return;
  }

  browserWindow.dispatchEvent(new CustomEvent<T>(eventName, { detail }));
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

function getCurrentWindowLabel(): string | null {
  if (!isTauri()) {
    return null;
  }

  try {
    return getCurrentWebviewWindow().label;
  } catch {
    return null;
  }
}

function persistJsonValue(storageKey: string, value: unknown): void {
  const activeStorage = getBrowserLocalStorage();
  if (!activeStorage) {
    return;
  }

  try {
    activeStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore storage write failures in constrained environments.
  }
}
