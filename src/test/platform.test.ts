import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultCommandBookmarks,
  createDefaultDirectoryBookmarks,
  detectClientPlatform,
  getDefaultIntegratedTerminalHost,
  getDefaultIntegratedShell,
  getDefaultIntegratedTerminalProfile,
  getExternalTerminalProfileOptions,
  getFallbackExplorerPath,
  getIntegratedTerminalProfileOptions,
  getPlatformPathSeparator,
  inferIntegratedTerminalProfileFromShell,
  joinPlatformPath,
  resolveIntegratedTerminalShellCommand,
  resolveIntegratedTerminalSpawnShellCommand,
} from '../config/platform';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('platform config', () => {
  it('detects the client platform from navigator values', () => {
    vi.stubGlobal('navigator', {
      platform: 'Win32',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      userAgentData: { platform: 'Windows' },
    } as unknown as Navigator);

    expect(detectClientPlatform()).toBe('windows');
  });

  it('returns terminal defaults for each platform', () => {
    expect(getDefaultIntegratedTerminalProfile('windows')).toBe('auto');
    expect(getDefaultIntegratedTerminalHost('windows')).toBe('xterm');
    expect(getDefaultIntegratedTerminalHost('linux')).toBe('go-pty-panel');
    expect(getDefaultIntegratedShell('windows')).toBe('pwsh.exe -NoLogo');
    expect(getDefaultIntegratedShell('macos')).toBe('/bin/zsh -l');
    expect(getDefaultIntegratedShell('linux')).toBe('/bin/bash -l');
    expect(getDefaultIntegratedShell('unknown')).toBe('');
  });

  it('returns platform-specific integrated terminal profiles', () => {
    expect(getIntegratedTerminalProfileOptions('windows').map(option => option.id)).toEqual([
      'auto',
      'pwsh',
      'powershell',
      'cmd',
      'custom',
    ]);
    expect(getIntegratedTerminalProfileOptions('linux').map(option => option.id)).toEqual([
      'auto',
      'bash',
      'zsh',
      'fish',
      'custom',
    ]);
  });

  it('returns platform-specific external terminal profiles', () => {
    expect(getExternalTerminalProfileOptions('windows').map(option => option.id)).toEqual([
      'auto',
      'windows-terminal',
      'pwsh',
      'powershell',
      'cmd',
      'custom',
    ]);
    expect(getExternalTerminalProfileOptions('linux').map(option => option.id)).toEqual([
      'auto',
      'system',
      'gnome-terminal',
      'konsole',
      'xterm',
      'custom',
    ]);
  });

  it('resolves integrated shell commands from profile defaults and overrides', () => {
    expect(resolveIntegratedTerminalShellCommand({
      profile: 'pwsh',
      platform: 'windows',
    })).toBe('pwsh.exe -NoLogo');
    expect(resolveIntegratedTerminalShellCommand({
      profile: 'pwsh',
      shellPath: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      shellArgs: '-NoLogo -NoProfile',
      platform: 'windows',
    })).toBe('"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo -NoProfile');
  });

  it('keeps auto launch shells null so the native host can fall back cleanly', () => {
    expect(resolveIntegratedTerminalSpawnShellCommand({
      profile: 'auto',
      shellPath: '',
      shellArgs: '',
      platform: 'windows',
    })).toBeNull();
    expect(resolveIntegratedTerminalSpawnShellCommand({
      profile: 'pwsh',
      platform: 'windows',
    })).toBe('pwsh.exe -NoLogo');
  });

  it('infers integrated shell profile settings from a legacy shell string', () => {
    expect(inferIntegratedTerminalProfileFromShell({
      shell: '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo -NoProfile',
      platform: 'windows',
    })).toEqual({
      shellProfile: 'pwsh',
      shellPath: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      shellArgs: '-NoLogo -NoProfile',
    });
  });

  it('joins paths using the target platform separator', () => {
    expect(joinPlatformPath('C:\\Users\\Admin\\', 'Projects', 'windows')).toBe('C:\\Users\\Admin\\Projects');
    expect(joinPlatformPath('/home/user/', 'code', 'linux')).toBe('/home/user/code');
  });

  it('returns a reasonable explorer fallback path', () => {
    expect(getFallbackExplorerPath('windows')).toBe('C:\\');
    expect(getFallbackExplorerPath('linux')).toBe('/');
  });

  it('seeds sensible default bookmarks', () => {
    expect(createDefaultDirectoryBookmarks('C:\\Users\\Admin', 'windows')).toEqual([
      { id: 'def-dir-home', name: 'Home', value: 'C:\\Users\\Admin' },
      { id: 'def-dir-desktop', name: 'Desktop', value: 'C:\\Users\\Admin\\Desktop' },
      { id: 'def-dir-documents', name: 'Documents', value: 'C:\\Users\\Admin\\Documents' },
    ]);

    expect(createDefaultDirectoryBookmarks('/home/admin', 'linux').map(bookmark => bookmark.name)).toEqual([
      'Home',
      'Desktop',
      'Documents',
      'Projects',
    ]);

    expect(createDefaultCommandBookmarks()).toEqual([
      { id: 'def-cmd-git-status', name: 'Git Status', value: 'git status' },
      { id: 'def-cmd-rust-build', name: 'Rust Build', value: 'cargo build' },
      { id: 'def-cmd-install-deps', name: 'Install Deps', value: 'npm install' },
    ]);
  });

  it('uses the expected path separator per platform', () => {
    expect(getPlatformPathSeparator('windows')).toBe('\\');
    expect(getPlatformPathSeparator('linux')).toBe('/');
  });
});
