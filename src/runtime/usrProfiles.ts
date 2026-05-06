import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { bindDeferredUnlisten } from './deferredUnlisten';

import {
  applyManagedContentDirectoryStackOverrides,
  clearManagedContentDirectoryStackOverrides,
  type ManagedContentDirectoryStackOverride,
} from '../config/appContentDirectories';
export type UsrProfileLaneMode = 'shared-root' | 'profile-overlay';

export interface UsrProfileSummary {
  id: string;
  name: string;
  overrideSlices: string[];
  createdAtMs: number;
  updatedAtMs: number;
  directoryPath: string;
  settingsPath: string;
  isActive: boolean;
}

export interface UsrManagedContentDirectoryStack {
  laneId: string;
  profileMode: UsrProfileLaneMode;
  directories: string[];
  sharedRootDirectory: string;
  bundledDirectory: string | null;
  profileDirectory: string | null;
  writableDirectory: string;
}

export interface UsrProfileRuntimeSnapshot {
  activeProfileId: string;
  profilesRoot: string;
  sharedSettingsPath: string;
  sharedSettingsJson: string;
  activeProfileSettingsPath: string;
  activeProfileSettingsJson: string;
  effectiveSettingsJson: string;
  profiles: UsrProfileSummary[];
  managedContentDirectoryStacks: UsrManagedContentDirectoryStack[];
}

interface UsrProfileChangedEvent {
  snapshot: UsrProfileRuntimeSnapshot;
}

export interface UsrProfileCreateRequest {
  name: string;
  profileId?: string | null;
  activate?: boolean;
  seedSettingsJson?: string | null;
}

export interface UsrProfileDuplicateRequest {
  sourceProfileId: string;
  name: string;
  profileId?: string | null;
  activate?: boolean;
  currentSettingsJson?: string | null;
}

export interface UsrProfileRenameRequest {
  profileId: string;
  name: string;
}

export interface UsrProfileDeleteRequest {
  profileId: string;
  fallbackProfileId?: string | null;
}

const SETTINGS_STORAGE_KEY = 'ultacode-settings';
const USR_PROFILE_CHANGED_EVENT_NAME = 'usr-profile-changed-event';
const PROFILE_SETTINGS_SLICE_KEYS = [
  'editor',
  'presentation',
  'dock',
  'terminal',
  'explorer',
  'home',
  'appearance',
  'keybindings',
  'layout',
  'audio',
  'plugins',
] as const;
const SHARED_SETTINGS_SLICE_KEYS = [
  'python',
  'models',
  'system',
  'mobile',
  'screenshots',
  'polygemini',
] as const;

type JsonRecord = Record<string, unknown>;
type UsrProfileListener = (snapshot: UsrProfileRuntimeSnapshot | null) => void;

let activeUsrProfileSnapshot: UsrProfileRuntimeSnapshot | null = null;
let activeUsrProfileSnapshotFingerprint = '';
let usrProfileRuntimeRevision = 0;
let usrProfileRuntimeListeners = new Set<UsrProfileListener>();
let usrProfileBootstrapPromise: Promise<UsrProfileRuntimeSnapshot | null> | null = null;
let usrProfileChangedUnlistenPromise: Promise<(() => void) | null> | null = null;
let usrProfilePersistenceInstalled = false;
let usrProfilePersistenceTimer: number | null = null;
let lastPersistedEffectiveSettingsJson = '';
let isApplyingHostSnapshot = false;

function normalizeObjectRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function tryParseJsonRecord(json: string | null | undefined): JsonRecord | null {
  if (typeof json !== 'string' || json.trim().length === 0) {
    return null;
  }

  try {
    return normalizeObjectRecord(JSON.parse(json));
  } catch {
    return null;
  }
}

function readPersistedSettingsEnvelope(): JsonRecord | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return tryParseJsonRecord(window.localStorage.getItem(SETTINGS_STORAGE_KEY));
}

function readCurrentPersistedSettings(): JsonRecord | null {
  const envelope = readPersistedSettingsEnvelope();
  const state = normalizeObjectRecord(envelope?.state);
  const settings = normalizeObjectRecord(state.settings);
  return Object.keys(settings).length > 0 ? settings : null;
}

function writeEffectiveSettingsIntoLocalStorage(effectiveSettings: JsonRecord): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const existingEnvelope = readPersistedSettingsEnvelope();
  const nextEnvelope = normalizeObjectRecord(existingEnvelope);
  const nextState = normalizeObjectRecord(nextEnvelope.state);
  nextState.settings = effectiveSettings;
  nextEnvelope.state = nextState;
  if (typeof nextEnvelope.version !== 'number') {
    nextEnvelope.version = 0;
  }
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextEnvelope));
}

function buildSnapshotFingerprint(snapshot: UsrProfileRuntimeSnapshot | null): string {
  if (!snapshot) {
    return '';
  }

  return JSON.stringify({
    activeProfileId: snapshot.activeProfileId,
    effectiveSettingsJson: snapshot.effectiveSettingsJson,
    sharedSettingsJson: snapshot.sharedSettingsJson,
    activeProfileSettingsJson: snapshot.activeProfileSettingsJson,
    profiles: snapshot.profiles.map((profile) => ({
      id: profile.id,
      updatedAtMs: profile.updatedAtMs,
      name: profile.name,
      isActive: profile.isActive,
    })),
    managedContentDirectoryStacks: snapshot.managedContentDirectoryStacks.map((stack) => ({
      laneId: stack.laneId,
      writableDirectory: stack.writableDirectory,
      directories: stack.directories,
    })),
  });
}

function notifyUsrProfileRuntimeListeners(): void {
  for (const listener of usrProfileRuntimeListeners) {
    listener(activeUsrProfileSnapshot);
  }
}

async function rehydrateSettingsStore(): Promise<void> {
  try {
    const settingsStoreModule = await import('../store/settingsStore');
    const persistApi = (settingsStoreModule.useSettingsStore as typeof settingsStoreModule.useSettingsStore & {
      persist?: { rehydrate?: () => Promise<void> | void };
    }).persist;
    await persistApi?.rehydrate?.();
  } catch (error) {
    console.warn('GreebleFS: failed to rehydrate settings store after usr profile change', error);
  }
}

async function applyUsrProfileSnapshot(
  snapshot: UsrProfileRuntimeSnapshot | null,
  options: { rehydrateStore?: boolean; notifyListeners?: boolean } = {},
): Promise<UsrProfileRuntimeSnapshot | null> {
  const nextFingerprint = buildSnapshotFingerprint(snapshot);
  if (snapshot && nextFingerprint === activeUsrProfileSnapshotFingerprint) {
    return activeUsrProfileSnapshot;
  }

  if (!snapshot) {
    activeUsrProfileSnapshot = null;
    activeUsrProfileSnapshotFingerprint = '';
    clearManagedContentDirectoryStackOverrides();
    if (options.notifyListeners !== false) {
      usrProfileRuntimeRevision += 1;
      notifyUsrProfileRuntimeListeners();
    }
    return null;
  }

  const effectiveSettings = tryParseJsonRecord(snapshot.effectiveSettingsJson) ?? {};
  const stackOverrides: ManagedContentDirectoryStackOverride[] =
    snapshot.managedContentDirectoryStacks.map((stack) => ({
      laneId: stack.laneId,
      directories: stack.directories,
      writableDirectory: stack.writableDirectory,
    }));

  isApplyingHostSnapshot = true;
  try {
    applyManagedContentDirectoryStackOverrides(stackOverrides);
    const staticConfigRuntime = await import('./usrProfileStaticConfigRuntime');
    await staticConfigRuntime.refreshUsrProfileStaticConfigRuntime();
    writeEffectiveSettingsIntoLocalStorage(effectiveSettings);
    activeUsrProfileSnapshot = snapshot;
    activeUsrProfileSnapshotFingerprint = nextFingerprint;
    lastPersistedEffectiveSettingsJson = snapshot.effectiveSettingsJson;
  } finally {
    isApplyingHostSnapshot = false;
  }

  if (options.rehydrateStore) {
    await rehydrateSettingsStore();
  }

  if (options.notifyListeners !== false) {
    usrProfileRuntimeRevision += 1;
    notifyUsrProfileRuntimeListeners();
  }

  return snapshot;
}

async function ensureUsrProfileChangedListener(): Promise<void> {
  if (!isTauri() || usrProfileChangedUnlistenPromise) {
    return;
  }

  const unlistenPromise = listen<UsrProfileChangedEvent>(
    USR_PROFILE_CHANGED_EVENT_NAME,
    async (event) => {
      await applyUsrProfileSnapshot(event.payload?.snapshot ?? null, {
        rehydrateStore: true,
        notifyListeners: true,
      });
    },
  );
  bindDeferredUnlisten(unlistenPromise);
  usrProfileChangedUnlistenPromise = unlistenPromise.then(() => null);
}

function currentSettingsJsonOrNull(explicitSettings?: unknown): string | null {
  const candidate =
    explicitSettings ?? readCurrentPersistedSettings() ?? undefined;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  try {
    return JSON.stringify(candidate);
  } catch {
    return null;
  }
}

function formatUsrProfileInvokeError(commandName: string, error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return new Error(error);
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return new Error((error as { message: string }).message);
  }

  return new Error(`Tauri command ${commandName} failed`);
}

async function invokeUsrProfileCommand<T>(
  commandName: string,
  args: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(commandName, args);
  } catch (error) {
    throw formatUsrProfileInvokeError(commandName, error);
  }
}

export async function initializeUsrProfilesBootstrap(): Promise<UsrProfileRuntimeSnapshot | null> {
  if (!isTauri()) {
    clearManagedContentDirectoryStackOverrides();
    return null;
  }

  if (usrProfileBootstrapPromise) {
    return usrProfileBootstrapPromise;
  }

  usrProfileBootstrapPromise = (async () => {
    const legacySettingsStorageJson =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(SETTINGS_STORAGE_KEY)
        : null;
    const currentSettingsJson = currentSettingsJsonOrNull();
    const snapshot = await invokeUsrProfileCommand<UsrProfileRuntimeSnapshot>(
      'usr_profiles_initialize',
      {
        currentSettingsJson,
        legacySettingsStorageJson,
      },
    );
    await applyUsrProfileSnapshot(snapshot, {
      rehydrateStore: false,
      notifyListeners: false,
    });
    await ensureUsrProfileChangedListener();
    return snapshot;
  })();

  return usrProfileBootstrapPromise;
}

export function getUsrProfileRuntimeSnapshot(): UsrProfileRuntimeSnapshot | null {
  return activeUsrProfileSnapshot;
}

export function getUsrProfileRuntimeRevision(): number {
  return usrProfileRuntimeRevision;
}

export function subscribeToUsrProfileRuntime(listener: UsrProfileListener): () => void {
  usrProfileRuntimeListeners.add(listener);
  return () => {
    usrProfileRuntimeListeners.delete(listener);
  };
}

export function getUsrProfileSettingSliceKeys(): readonly string[] {
  return PROFILE_SETTINGS_SLICE_KEYS;
}

export function getUsrProfileSharedSettingSliceKeys(): readonly string[] {
  return SHARED_SETTINGS_SLICE_KEYS;
}

export async function installUsrProfileSettingsPersistence(): Promise<void> {
  if (!isTauri() || usrProfilePersistenceInstalled) {
    return;
  }

  const settingsStoreModule = await import('../store/settingsStore');
  const { useSettingsStore } = settingsStoreModule;

  const schedulePersist = (settings: unknown) => {
    if (isApplyingHostSnapshot) {
      return;
    }

    let nextSettingsJson: string;
    try {
      nextSettingsJson = JSON.stringify(settings);
    } catch {
      return;
    }

    if (
      nextSettingsJson.length === 0 ||
      nextSettingsJson === lastPersistedEffectiveSettingsJson
    ) {
      return;
    }

    if (usrProfilePersistenceTimer !== null) {
      window.clearTimeout(usrProfilePersistenceTimer);
    }

    usrProfilePersistenceTimer = window.setTimeout(() => {
      usrProfilePersistenceTimer = null;
      void persistActiveUsrProfileSettingsSnapshot(settings).catch((error) => {
        console.warn('GreebleFS: failed to persist usr profile settings snapshot', error);
      });
    }, 180);
  };

  useSettingsStore.subscribe((state, previousState) => {
    if (state.settings === previousState.settings) {
      return;
    }
    schedulePersist(state.settings);
  });

  usrProfilePersistenceInstalled = true;
  lastPersistedEffectiveSettingsJson = currentSettingsJsonOrNull(useSettingsStore.getState().settings) ?? '';
}

export async function refreshUsrProfileRuntimeSnapshot(): Promise<UsrProfileRuntimeSnapshot | null> {
  if (!isTauri()) {
    return null;
  }

  const snapshot = await invokeUsrProfileCommand<UsrProfileRuntimeSnapshot>(
    'usr_profiles_get_runtime_snapshot',
    {},
  );
  return applyUsrProfileSnapshot(snapshot, {
    rehydrateStore: true,
    notifyListeners: true,
  });
}

export async function persistActiveUsrProfileSettingsSnapshot(
  settings: unknown,
): Promise<UsrProfileRuntimeSnapshot | null> {
  if (!isTauri()) {
    return null;
  }

  const settingsJson = currentSettingsJsonOrNull(settings);
  if (!settingsJson) {
    return activeUsrProfileSnapshot;
  }

  const snapshot = await invokeUsrProfileCommand<UsrProfileRuntimeSnapshot>(
    'usr_profiles_persist_active_settings_snapshot',
    { settingsJson },
  );
  return applyUsrProfileSnapshot(snapshot, {
    rehydrateStore: false,
    notifyListeners: true,
  });
}

export async function switchUsrProfile(
  profileId: string,
  currentSettings?: unknown,
): Promise<UsrProfileRuntimeSnapshot | null> {
  if (!isTauri()) {
    return null;
  }

  const snapshot = await invokeUsrProfileCommand<UsrProfileRuntimeSnapshot>(
    'usr_profiles_switch',
    {
      profileId,
      currentSettingsJson: currentSettingsJsonOrNull(currentSettings),
    },
  );
  return applyUsrProfileSnapshot(snapshot, {
    rehydrateStore: true,
    notifyListeners: true,
  });
}

export async function createUsrProfile(
  request: UsrProfileCreateRequest,
): Promise<UsrProfileRuntimeSnapshot | null> {
  if (!isTauri()) {
    return null;
  }

  const snapshot = await invokeUsrProfileCommand<UsrProfileRuntimeSnapshot>(
    'usr_profiles_create',
    {
      request: {
        name: request.name,
        profileId: request.profileId ?? null,
        activate: request.activate !== false,
        seedSettingsJson: request.seedSettingsJson ?? null,
      },
    },
  );
  return applyUsrProfileSnapshot(snapshot, {
    rehydrateStore: request.activate !== false,
    notifyListeners: true,
  });
}

export async function duplicateUsrProfile(
  request: Omit<UsrProfileDuplicateRequest, 'currentSettingsJson'> & {
    currentSettings?: unknown;
  },
): Promise<UsrProfileRuntimeSnapshot | null> {
  if (!isTauri()) {
    return null;
  }

  const snapshot = await invokeUsrProfileCommand<UsrProfileRuntimeSnapshot>(
    'usr_profiles_duplicate',
    {
      request: {
        sourceProfileId: request.sourceProfileId,
        name: request.name,
        profileId: request.profileId ?? null,
        activate: request.activate !== false,
        currentSettingsJson: currentSettingsJsonOrNull(request.currentSettings),
      },
    },
  );
  return applyUsrProfileSnapshot(snapshot, {
    rehydrateStore: request.activate !== false,
    notifyListeners: true,
  });
}

export async function renameUsrProfile(
  request: UsrProfileRenameRequest,
): Promise<UsrProfileRuntimeSnapshot | null> {
  if (!isTauri()) {
    return null;
  }

  const snapshot = await invokeUsrProfileCommand<UsrProfileRuntimeSnapshot>(
    'usr_profiles_rename',
    { request },
  );
  return applyUsrProfileSnapshot(snapshot, {
    rehydrateStore: false,
    notifyListeners: true,
  });
}

export async function deleteUsrProfile(
  request: UsrProfileDeleteRequest,
): Promise<UsrProfileRuntimeSnapshot | null> {
  if (!isTauri()) {
    return null;
  }

  const snapshot = await invokeUsrProfileCommand<UsrProfileRuntimeSnapshot>(
    'usr_profiles_delete',
    {
      request: {
        profileId: request.profileId,
        fallbackProfileId: request.fallbackProfileId ?? null,
      },
    },
  );
  return applyUsrProfileSnapshot(snapshot, {
    rehydrateStore: true,
    notifyListeners: true,
  });
}
