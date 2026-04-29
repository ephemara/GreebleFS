import { describe, expect, it } from 'vitest';

import {
  createLoadedTopBarDefinition,
  resolveAvailableTopBars,
  resolveActiveTopBarSelection,
} from '../config/topBars';

describe('top bar selection', () => {
  it('prefers an explicit pinned top bar over theme defaults', () => {
    const packageTopBar = createLoadedTopBarDefinition(
      {
        id: 'package-deck',
        name: 'Package Deck',
        topBarStyle: 'glass',
        navigationMode: 'summary',
      },
      {
        source: 'theme-package',
        sourceLabel: 'Cyberdeck',
        sourceThemeId: 'cyberdeck',
      },
    );

    const result = resolveActiveTopBarSelection({
      requestedTopBarId: packageTopBar.id,
      theme: {
        name: 'Cyberdeck',
        defaultTopBarId: 'command-center',
        workbench: {
          topBarStyle: 'minimal',
        },
      },
      packageSources: [{ topBars: [packageTopBar] }],
    });

    expect(result.topBar.id).toBe(packageTopBar.id);
    expect(result.resolvedFrom).toBe('explicit');
    expect(result.explicitSelectionMissing).toBe(false);
  });

  it('falls back through the legacy theme topBarStyle when a theme has no standalone default', () => {
    const result = resolveActiveTopBarSelection({
      theme: {
        name: 'Channel Home',
        workbench: {
          topBarStyle: 'minimal',
        },
      },
    });

    expect(result.topBar.id).toBe('focus-strip');
    expect(result.resolvedFrom).toBe('theme-legacy-style');
  });

  it('drops back to the theme path when the pinned top bar no longer exists', () => {
    const result = resolveActiveTopBarSelection({
      requestedTopBarId: 'missing-top-bar',
      theme: {
        name: 'Orbital',
        defaultTopBarId: 'orbital-glass',
      },
    });

    expect(result.topBar.id).toBe('orbital-glass');
    expect(result.resolvedFrom).toBe('theme-default');
    expect(result.explicitSelectionMissing).toBe(true);
  });

  it('prefers authored usr top bars when they redefine a shipped built-in id', () => {
    const authoredOverride = createLoadedTopBarDefinition(
      {
        id: 'command-center',
        name: 'Usr Command Center',
        topBarStyle: 'glass',
        navigationMode: 'summary',
      },
      {
        source: 'top-bar-package',
        sourceLabel: 'usr/top-bars',
        sourcePackageId: 'greeblefs-core-top-bars',
      },
    );

    const availableTopBars = resolveAvailableTopBars([{ topBars: [authoredOverride] }]);
    const resolvedTopBar = availableTopBars.find((topBar) => topBar.id === 'command-center');

    expect(resolvedTopBar).toMatchObject({
      id: 'command-center',
      name: 'Usr Command Center',
      source: 'top-bar-package',
      navigationMode: 'summary',
    });
  });

  it('migrates legacy panel-menu controls to the surface controls popover', () => {
    const legacyTopBar = createLoadedTopBarDefinition(
      {
        id: 'legacy-panel-menu',
        name: 'Legacy Panel Menu',
        leadingControls: ['panel-menu'],
        navigationShortcuts: [],
        trailingControls: ['blur-toggle'],
      },
      {
        source: 'top-bar-package',
        sourceLabel: 'usr/top-bars',
      },
    );

    expect(legacyTopBar.leadingControls).toEqual(['surface-controls']);
    expect(legacyTopBar.trailingControls).toEqual(['mobile-share']);
  });
});
