import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { SettingsPage } from '../components/SettingsPage';
import { createBuiltInOverlayAnimations } from '../components/animationRuntime';
import { createBuiltInOverlayShaders } from '../components/shaderRuntime';
import { resolveOverlayAppearance } from '../config/appearance';
import { createDefaultFolderIconRules } from '../config/folderIcons';
import { useSettingsStore } from '../store/settingsStore';
import { useTerminalStore } from '../store/terminalStore';

function findSectionButton(label: string): HTMLButtonElement {
  const button = screen.getAllByRole('button').find(entry => entry.textContent?.includes(label));
  if (!button) {
    throw new Error(`Unable to find button containing "${label}"`);
  }
  return button as HTMLButtonElement;
}

function renderSettingsPage() {
  const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });

  render(
    <SettingsPage
      appearance={appearance}
      themePackages={[]}
      themePackagesDirectory="themes"
      themePackagesLoading={false}
      themePackagesError={null}
      onRefreshThemes={async () => {}}
      onOpenThemesFolder={async () => {}}
      shaders={createBuiltInOverlayShaders()}
      shaderDiagnostics={[]}
      shadersDirectory="shaders"
      shadersLoading={false}
      shadersError={null}
      onRefreshShaders={async () => {}}
      onOpenShadersFolder={async () => {}}
      animations={createBuiltInOverlayAnimations()}
      animationDiagnostics={[]}
      animationsDirectory="animations"
      animationsLoading={false}
      animationsError={null}
      onRefreshAnimations={async () => {}}
      onOpenAnimationsFolder={async () => {}}
    />,
  );
}

describe('SettingsPage behavior', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
    useTerminalStore.setState({
      isInitialized: true,
      directoryBookmarks: [],
      commandBookmarks: [],
    });

    vi.mocked(invoke).mockReset();
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });
  });

  it('updates explorer click mode, restores folder rules, and seeds bookmarks without duplicates', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const homeDir = 'C:\\Users\\Alex';

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'fs_get_home_dir') {
        return homeDir;
      }

      return null;
    });

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        explorer: {
          ...state.settings.explorer,
          folderClickMode: 'double',
          folderIconRules: [
            {
              id: 'custom-rule',
              label: 'Custom Rule',
              matchers: ['custom'],
              icon: 'folder_docs',
            },
          ],
        },
      },
    }));

    useTerminalStore.setState({
      isInitialized: true,
      directoryBookmarks: [
        { id: 'def-dir-home', name: 'Home', value: homeDir },
      ],
      commandBookmarks: [],
    });

    renderSettingsPage();

    await user.click(findSectionButton('Explorer'));
    expect(useSettingsStore.getState().settings.explorer.folderClickMode).toBe('double');

    await user.click(screen.getByRole('button', { name: /^Single Click/i }));
    expect(useSettingsStore.getState().settings.explorer.folderClickMode).toBe('single');

    await user.click(screen.getByRole('button', { name: 'Restore Rules' }));
    expect(useSettingsStore.getState().settings.explorer.folderIconRules).toHaveLength(
      createDefaultFolderIconRules().length,
    );

    await user.click(screen.getByRole('button', { name: 'Seed Platform Bookmarks' }));

    await waitFor(() => {
      expect(useTerminalStore.getState().directoryBookmarks).toHaveLength(3);
    });

    expect(useTerminalStore.getState().directoryBookmarks.map(bookmark => bookmark.value)).toEqual(
      expect.arrayContaining([
        homeDir,
        'C:\\Users\\Alex\\Desktop',
        'C:\\Users\\Alex\\Documents',
      ]),
    );
    expect(invokeMock).toHaveBeenCalledWith('fs_get_home_dir');
  }, 30000);

  it('syncs startup registration, desktop visibility toggles, and commits hotkey edits', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'startup_set_launch_at_startup') {
        const payload = args as { enabled?: boolean } | undefined;
        return Boolean(payload?.enabled);
      }

      return null;
    });

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        system: {
          ...state.settings.system,
          hideAppInTray: true,
          showInTaskbar: false,
        },
      },
    }));

    renderSettingsPage();

    await user.click(findSectionButton('System'));
    const startupToggle = screen.getByRole('checkbox', { name: /launch at startup/i });

    await user.click(startupToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.launchAtStartup).toBe(true);
    });
    expect(invokeMock).toHaveBeenLastCalledWith('startup_set_launch_at_startup', { enabled: true });

    await user.click(startupToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.launchAtStartup).toBe(false);
    });
    expect(invokeMock).toHaveBeenLastCalledWith('startup_set_launch_at_startup', { enabled: false });

    const trayToggle = screen.getByRole('checkbox', { name: /hide app in tray/i });
    const taskbarToggle = screen.getByRole('checkbox', { name: /show in taskbar/i });

    await user.click(taskbarToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.showInTaskbar).toBe(true);
    });

    await user.click(trayToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.hideAppInTray).toBe(false);
    });

    await user.click(findSectionButton('Hotkeys'));
    const toggleInput = screen.getByDisplayValue('Ctrl+Space');
    await user.clear(toggleInput);
    await user.type(toggleInput, 'Ctrl + Shift + Space');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.keybindings.terminalToggle).toBe('Ctrl+Shift+Space');
    });

    await user.click(screen.getAllByRole('button', { name: 'Reset' })[0]);
    expect(useSettingsStore.getState().settings.keybindings.terminalToggle).toBe('Ctrl+Space');
  }, 30000);
});
