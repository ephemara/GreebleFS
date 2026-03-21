import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsPage } from '../components/SettingsPage';
import { createBuiltInOverlayShaders, type LoadedOverlayShader } from '../components/shaderRuntime';
import { resolveOverlayAppearance } from '../config/appearance';
import { useSettingsStore } from '../store/settingsStore';

function findButtonByText(label: string): HTMLButtonElement {
  const button = screen.getAllByRole('button').find(entry => entry.textContent?.includes(label));
  if (!button) {
    throw new Error(`Unable to find button containing "${label}"`);
  }
  return button as HTMLButtonElement;
}

describe('SettingsPage shaders section', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it('shows the Shaders rail item, renders built-ins plus authored shaders, and updates the live override', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const authoredShader: LoadedOverlayShader = {
      id: 'aurora-ribbon',
      name: 'Aurora Ribbon',
      filePath: 'shaders/aurora-ribbon.tsx',
      shaderRoot: 'shaders',
      source: 'folder',
      modified: 1,
      description: 'A soft aurora wash with glossy chrome highlights for all three shell surfaces.',
      group: 'Authoring Samples',
      tags: ['aurora'],
      controls: [
        {
          id: 'intensity',
          label: 'Intensity',
          min: 0,
          max: 1,
          step: 0.05,
          defaultValue: 0.4,
        },
      ],
      resolveSharedUniforms: undefined,
      background: { resolveStyle: () => ({ opacity: 0.6 }) },
      topBar: { resolveStyle: () => ({ opacity: 0.4 }) },
      border: { resolveStyle: () => ({ opacity: 0.3 }) },
      error: null,
    };

    render(
      <SettingsPage
        appearance={appearance}
        themePackages={[]}
        themePackagesDirectory="themes"
        themePackagesLoading={false}
        themePackagesError={null}
        onRefreshThemes={async () => {}}
        onOpenThemesFolder={async () => {}}
        shaders={[...createBuiltInOverlayShaders(), authoredShader]}
        shaderDiagnostics={[]}
        shadersDirectory="shaders"
        shadersLoading={false}
        shadersError={null}
        onRefreshShaders={async () => {}}
        onOpenShadersFolder={async () => {}}
        animations={[]}
        animationDiagnostics={[]}
        animationsDirectory="animations"
        animationsLoading={false}
        animationsError={null}
        onRefreshAnimations={async () => {}}
        onOpenAnimationsFolder={async () => {}}
      />,
    );

    fireEvent.click(findButtonByText('Shaders'));

    expect(screen.getByText('Shader Catalog')).toBeInTheDocument();
    expect(screen.getAllByText('Nebula Flow').length).toBeGreaterThan(0);
    expect(screen.getByText('Aurora Ribbon')).toBeInTheDocument();
    expect(screen.getByText('Surface Coverage')).toBeInTheDocument();
    expect(screen.getByText('Shader Controls')).toBeInTheDocument();
    expect(screen.getAllByText('Soft volumetric glows drift across the full shell with chrome shimmer and accent rails.').length).toBeGreaterThan(0);

    fireEvent.click(findButtonByText('Aurora Ribbon'));
    fireEvent.change(screen.getByRole('slider', { name: /Intensity/i }), { target: { value: '0.8' } });

    expect(useSettingsStore.getState().settings.appearance.activeShaderId).toBe('aurora-ribbon');
    expect(useSettingsStore.getState().settings.appearance.shaderControlValues['aurora-ribbon']?.intensity).toBe(0.8);
    expect(screen.getAllByText('A soft aurora wash with glossy chrome highlights for all three shell surfaces.').length).toBeGreaterThan(0);
  }, 30000);
});
