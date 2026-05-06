import { beforeEach, describe, expect, it } from 'vitest';

import { createLookdevPresetManifestFromScopeSnapshot } from '../config/lookdevPresets';
import {
  resolveLookdevEditableScope,
  useLookdevStore,
} from '../store/lookdevStore';
import { defaultSettings } from '../store/settingsStore';

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createBaselineSnapshot() {
  return {
    appearance: cloneJsonValue(defaultSettings.appearance),
    explorer: cloneJsonValue(defaultSettings.explorer),
    dock: cloneJsonValue(defaultSettings.dock),
    presentation: cloneJsonValue(defaultSettings.presentation),
  };
}

beforeEach(() => {
  const store = useLookdevStore.getState();
  store.closeSession();
  store.setCatalogState({
    presets: [],
    presetsDirectory: '',
    presetsLoading: false,
    presetsError: null,
    presetsWarnings: [],
  });
  store.setActiveLens('theme');
  store.setScopeMode('follow-current');
  store.setSelectedPresetId(null);
  store.clearActiveAppliedPresetId();
  store.setStatusMessage(null);
});

describe('lookdev store', () => {
  it('resolves follow-current scopes from the active presentation mode', () => {
    expect(resolveLookdevEditableScope('follow-current', 'windowed')).toBe('windowed');
    expect(resolveLookdevEditableScope('follow-current', 'dock')).toBe('dock');
    expect(resolveLookdevEditableScope('shared', 'dock')).toBe('shared');
  });

  it('opens a draft session from an explicit draft manifest', () => {
    const draftManifest = createLookdevPresetManifestFromScopeSnapshot({
      id: 'live-lookdev-session',
      name: 'Live Lookdev Session',
      scope: 'windowed',
      scopedOverrides: {
        appearance: {
          activeThemeId: 'pilot-dark',
        },
      },
    });

    useLookdevStore.getState().openSession({
      baseline: createBaselineSnapshot(),
      initialWindowMode: 'windowed',
      draftManifest,
    });

    const { draftSession, isOpen } = useLookdevStore.getState();
    expect(isOpen).toBe(true);
    expect(draftSession?.manifest).toEqual(draftManifest);
  });

  it('merges scoped section patches into the active draft manifest', () => {
    useLookdevStore.getState().openSession({
      baseline: createBaselineSnapshot(),
      initialWindowMode: 'windowed',
      draftManifest: createLookdevPresetManifestFromScopeSnapshot({
        id: 'lookdev-test',
        name: 'Lookdev Test',
        scope: 'windowed',
        scopedOverrides: {
          appearance: {
            activeThemeId: 'pilot-dark',
          },
        },
      }),
    });

    useLookdevStore.getState().updateDraftScopedSection('dock', 'dock', {
      edgeSize: 280,
      edgeWidth: 1360,
    });

    expect(useLookdevStore.getState().draftSession?.manifest.dock?.dock).toMatchObject({
      edgeSize: 280,
      edgeWidth: 1360,
    });
    expect(useLookdevStore.getState().draftSession?.manifest.windowed?.appearance).toMatchObject({
      activeThemeId: 'pilot-dark',
    });
  });
});
