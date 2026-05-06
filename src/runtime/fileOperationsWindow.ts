import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { ExplorerFileTransferOperation, ExplorerFileTransferResult } from './explorerBackend';
import {
  FILE_OPERATIONS_SECONDARY_WINDOW_ID,
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

const FILE_OPERATIONS_WINDOW_BASE_TITLE = 'File Operations';

export const FILE_OPERATIONS_WINDOW_LABEL = 'file-operations';
export const FILE_OPERATIONS_WINDOW_REQUEST_EVENT = 'greeblefs:file-operations:request';
export const FILE_OPERATIONS_TRANSFER_COMPLETED_EVENT = 'greeblefs:file-operations:transfer-completed';

export const FILE_OPERATIONS_WINDOW_REQUEST_STORAGE_KEY = 'greeblefs:file-operations:last-request';
export const FILE_OPERATIONS_TRANSFER_COMPLETED_STORAGE_KEY = 'greeblefs:file-operations:last-transfer';

export const FILE_OPERATIONS_WINDOW_CONFIG = {
  height: 720,
  minHeight: 520,
  minWidth: 700,
  resizable: true,
  title: FILE_OPERATIONS_WINDOW_BASE_TITLE,
  width: 980,
} as const;

export interface FileOperationsTaskWindowRequest {
  nonce: string;
  requestedAt: number;
  sourceWindowLabel: string | null;
  view: 'tasks';
}

export type FileOperationsWindowRequest = FileOperationsTaskWindowRequest;

export type FileOperationsAffectedEntryMutationKind = 'copy' | 'move' | 'skip';

export interface FileOperationsAffectedEntry {
  entityId: string;
  sourcePath: string;
  destinationPath: string;
  contentRevision: string;
  mutationKind: FileOperationsAffectedEntryMutationKind;
}

export interface FileOperationsTransferCompletedEventDetail {
  affectedEntries: FileOperationsAffectedEntry[];
  completedAt: number;
  destinationPaths: string[];
  nonce: string;
  operation: ExplorerFileTransferOperation;
  results: ExplorerFileTransferResult[];
  sourcePaths: string[];
  targetDir: string;
}

export function isCurrentFileOperationsWindow(): boolean {
  if (!isTauri()) {
    return false;
  }

  try {
    return getCurrentWebviewWindow().label === FILE_OPERATIONS_WINDOW_LABEL;
  } catch {
    return false;
  }
}

export function describeFileOperationsWindowRequest(
  _request: FileOperationsWindowRequest | null | undefined,
): string {
  return FILE_OPERATIONS_WINDOW_BASE_TITLE;
}

export function createFileOperationsWindowRequest(
  _value: { view: 'tasks' },
): FileOperationsWindowRequest | null {
  const sourceWindowLabel = getCurrentWindowLabel();
  const requestedAt = Date.now();
  const nonce = `${requestedAt}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    nonce,
    requestedAt,
    sourceWindowLabel,
    view: 'tasks',
  };
}

export function readFileOperationsWindowRequest(
  storage?: StorageLike | null,
): FileOperationsWindowRequest | null {
  const activeStorage = storage ?? getBrowserLocalStorage();
  if (!activeStorage) {
    return null;
  }

  try {
    const rawValue = activeStorage.getItem(FILE_OPERATIONS_WINDOW_REQUEST_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    return parseFileOperationsWindowRequest(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function readFileOperationsTransferCompletedEvent(
  storage?: StorageLike | null,
): FileOperationsTransferCompletedEventDetail | null {
  const activeStorage = storage ?? getBrowserLocalStorage();
  if (!activeStorage) {
    return null;
  }

  try {
    const rawValue = activeStorage.getItem(FILE_OPERATIONS_TRANSFER_COMPLETED_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }
    return parseFileOperationsTransferCompletedEvent(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export async function openFileOperationsWindow(
  value: { view: 'tasks' },
): Promise<FileOperationsWindowRequest | null> {
  const request = createFileOperationsWindowRequest(value);
  if (!request) {
    return null;
  }

  persistJsonValue(FILE_OPERATIONS_WINDOW_REQUEST_STORAGE_KEY, request);
  dispatchBrowserCustomEvent(FILE_OPERATIONS_WINDOW_REQUEST_EVENT, request);
  await broadcastWindowEvent(FILE_OPERATIONS_WINDOW_REQUEST_EVENT, request);

  if (isTauri()) {
    try {
      await openSecondaryWindow(createSecondaryWindowOpenRequest({
        windowId: FILE_OPERATIONS_SECONDARY_WINDOW_ID,
        surfaceKind: 'file-operations',
        presentation: 'tool-window',
        title: FILE_OPERATIONS_WINDOW_BASE_TITLE,
        payload: {
          view: request.view,
        },
      }));
    } catch (error) {
      console.error('GreebleFS: failed to open file operations window', error);
      return null;
    }
  }

  return request;
}

export async function publishFileOperationsTransferCompleted(
  value: {
    operation: ExplorerFileTransferOperation;
    results: ExplorerFileTransferResult[];
    sourcePaths: string[];
    targetDir: string;
  },
): Promise<FileOperationsTransferCompletedEventDetail | null> {
  const detail = createFileOperationsTransferCompletedEvent(value);
  if (!detail) {
    return null;
  }

  persistJsonValue(FILE_OPERATIONS_TRANSFER_COMPLETED_STORAGE_KEY, detail);
  dispatchBrowserCustomEvent(FILE_OPERATIONS_TRANSFER_COMPLETED_EVENT, detail);
  await broadcastWindowEvent(FILE_OPERATIONS_TRANSFER_COMPLETED_EVENT, detail);
  return detail;
}

export function listenToFileOperationsWindowRequests(
  listener: (request: FileOperationsWindowRequest) => void,
  options?: {
    storage?: StorageLike | null;
    target?: BrowserEventTargetLike | null;
  },
): () => void {
  return registerCrossWindowListener({
    eventName: FILE_OPERATIONS_WINDOW_REQUEST_EVENT,
    listener,
    parseDetail: parseFileOperationsWindowRequest,
    storageKey: FILE_OPERATIONS_WINDOW_REQUEST_STORAGE_KEY,
    storage: options?.storage ?? null,
    target: options?.target ?? null,
  });
}

export function listenToFileOperationsTransferCompleted(
  listener: (detail: FileOperationsTransferCompletedEventDetail) => void,
  options?: {
    storage?: StorageLike | null;
    target?: BrowserEventTargetLike | null;
  },
): () => void {
  return registerCrossWindowListener({
    eventName: FILE_OPERATIONS_TRANSFER_COMPLETED_EVENT,
    listener,
    parseDetail: parseFileOperationsTransferCompletedEvent,
    storageKey: FILE_OPERATIONS_TRANSFER_COMPLETED_STORAGE_KEY,
    storage: options?.storage ?? null,
    target: options?.target ?? null,
  });
}

function createFileOperationsTransferCompletedEvent(value: {
  operation: ExplorerFileTransferOperation;
  results: ExplorerFileTransferResult[];
  sourcePaths: string[];
  targetDir: string;
}): FileOperationsTransferCompletedEventDetail | null {
  const targetDir = value.targetDir.trim();
  const sourcePaths = Array.from(new Set(value.sourcePaths.map((path) => path.trim()).filter(Boolean)));
  if (!targetDir || sourcePaths.length === 0) {
    return null;
  }

  const completedAt = Date.now();
  const affectedEntries = buildFileOperationsAffectedEntries(
    value.operation,
    value.results,
  );
  return {
    affectedEntries,
    completedAt,
    destinationPaths: affectedEntries
      .map((entry) => entry.destinationPath.trim())
      .filter(Boolean),
    nonce: `${completedAt}-${Math.random().toString(36).slice(2, 10)}`,
    operation: value.operation === 'move' ? 'move' : 'copy',
    results: value.results,
    sourcePaths,
    targetDir,
  };
}

function parseFileOperationsWindowRequest(value: unknown): FileOperationsWindowRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const requestedAt = typeof record.requestedAt === 'number' ? record.requestedAt : 0;
  const nonce = typeof record.nonce === 'string' ? record.nonce.trim() : '';
  const sourceWindowLabel = typeof record.sourceWindowLabel === 'string'
    ? record.sourceWindowLabel.trim() || null
    : null;
  if (!nonce) {
    return null;
  }

  if (record.view === 'tasks') {
    return {
      nonce,
      requestedAt,
      sourceWindowLabel,
      view: 'tasks',
    };
  }

  return null;
}

function parseFileOperationsTransferCompletedEvent(
  value: unknown,
): FileOperationsTransferCompletedEventDetail | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nonce = typeof record.nonce === 'string' ? record.nonce.trim() : '';
  const targetDir = typeof record.targetDir === 'string' ? record.targetDir.trim() : '';
  if (!nonce || !targetDir) {
    return null;
  }

  const results = Array.isArray(record.results)
    ? record.results.filter(isExplorerFileTransferResult)
    : [];
  const operation = record.operation === 'move' ? 'move' : 'copy';
  const affectedEntries = Array.isArray(record.affectedEntries)
    ? dedupeFileOperationsAffectedEntries(
      record.affectedEntries.filter(isFileOperationsAffectedEntry),
    )
    : buildFileOperationsAffectedEntries(operation, results);
  const sourcePaths = Array.isArray(record.sourcePaths)
    ? Array.from(
      new Set(record.sourcePaths.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)),
    )
    : [];

  if (sourcePaths.length === 0) {
    return null;
  }

  return {
    affectedEntries,
    completedAt: typeof record.completedAt === 'number' ? record.completedAt : 0,
    destinationPaths: Array.isArray(record.destinationPaths)
      ? Array.from(
        new Set(record.destinationPaths.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)),
      )
      : affectedEntries.map((entry) => entry.destinationPath),
    nonce,
    operation,
    results,
    sourcePaths,
    targetDir,
  };
}

function isExplorerFileTransferResult(value: unknown): value is ExplorerFileTransferResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.source_path === 'string'
    && typeof record.destination_path === 'string'
    && (record.operation === 'copy' || record.operation === 'move');
}

function isFileOperationsAffectedEntry(
  value: unknown,
): value is FileOperationsAffectedEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.entityId === 'string'
    && typeof record.sourcePath === 'string'
    && typeof record.destinationPath === 'string'
    && typeof record.contentRevision === 'string'
    && (
      record.mutationKind === 'copy'
      || record.mutationKind === 'move'
      || record.mutationKind === 'skip'
    );
}

function buildFileOperationsAffectedEntries(
  operation: ExplorerFileTransferOperation,
  results: readonly ExplorerFileTransferResult[],
): FileOperationsAffectedEntry[] {
  return dedupeFileOperationsAffectedEntries(
    results.map((result) => ({
      entityId: result.entityId,
      sourcePath: result.source_path.trim(),
      destinationPath: result.destination_path.trim(),
      contentRevision: result.contentRevision,
      mutationKind: result.disposition === 'skipped_existing'
        ? 'skip'
        : operation === 'move'
          ? 'move'
          : 'copy',
    })),
  );
}

function dedupeFileOperationsAffectedEntries(
  entries: readonly FileOperationsAffectedEntry[],
): FileOperationsAffectedEntry[] {
  const seenEntries = new Set<string>();
  const nextEntries: FileOperationsAffectedEntry[] = [];
  for (const entry of entries) {
    if (
      !entry.entityId.trim()
      || !entry.sourcePath.trim()
      || !entry.destinationPath.trim()
      || !entry.contentRevision.trim()
    ) {
      continue;
    }

    const dedupeKey = [
      entry.entityId,
      entry.sourcePath,
      entry.destinationPath,
      entry.contentRevision,
      entry.mutationKind,
    ].join('::');
    if (seenEntries.has(dedupeKey)) {
      continue;
    }
    seenEntries.add(dedupeKey);
    nextEntries.push(entry);
  }
  return nextEntries;
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

function persistJsonValue(key: string, value: unknown): void {
  try {
    getBrowserLocalStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Persisting the latest window payload is best-effort only.
  }
}
