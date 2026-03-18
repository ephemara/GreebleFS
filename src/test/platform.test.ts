import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultCommandBookmarks,
  createDefaultDirectoryBookmarks,
  detectClientPlatform,
  getDefaultIntegratedShell,
  getExternalTerminalProfileOptions,
  getFallbackExplorerPath,
  getPlatformPathSeparator,
  joinPlatformPath,
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
    expect(getDefaultIntegratedShell('windows')).toBe('powershell.exe');
    expect(getDefaultIntegratedShell('macos')).toBe('/bin/zsh');
    expect(getDefaultIntegratedShell('linux')).toBe('/bin/bash');
    expect(getDefaultIntegratedShell('unknown')).toBe('');
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
