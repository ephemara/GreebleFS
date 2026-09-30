import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  isUpdateAvailable,
  normalizeReleaseJson,
  normalizeVersionTag,
} from '../runtime/updateChecker';

describe('updateChecker version compare', () => {
  it('normalizes v-prefixed tags', () => {
    expect(normalizeVersionTag('v0.1.0')).toBe('0.1.0');
    expect(normalizeVersionTag('V2.0')).toBe('2.0');
    expect(normalizeVersionTag('  v1.2.3  ')).toBe('1.2.3');
  });

  it('compares semver numerically', () => {
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1);
    expect(compareVersions('0.2.0', '0.1.0')).toBe(1);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('v0.1.0', 'v0.1.1')).toBe(-1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
  });

  it('detects updates only when latest is newer', () => {
    expect(isUpdateAvailable('0.1.0', 'v0.2.0')).toBe(true);
    expect(isUpdateAvailable('0.2.0', 'v0.2.0')).toBe(false);
    expect(isUpdateAvailable('0.3.0', 'v0.2.0')).toBe(false);
    expect(isUpdateAvailable('0.1.0', null)).toBe(false);
  });

  it('normalizes GitHub release JSON + picks installer/zip', () => {
    const info = normalizeReleaseJson({
      tag_name: 'v0.2.0',
      name: 'GreebleFS v0.2.0',
      body: 'notes here',
      html_url: 'https://github.com/ephemara/GreebleFS/releases/tag/v0.2.0',
      published_at: '2026-09-30T00:00:00Z',
      prerelease: false,
      assets: [
        { name: 'GreebleFS_0.2.0_x64-setup.exe', browser_download_url: 'https://example/setup.exe', size: 10, content_type: 'application/octet-stream' },
        { name: 'greeblefs-v0.2.0-windows-x64-portable.zip', browser_download_url: 'https://example/portable.zip', size: 20, content_type: 'application/zip' },
      ],
    });
    expect(info?.tag).toBe('v0.2.0');
    expect(info?.version).toBe('0.2.0');
    expect(info?.installerUrl).toBe('https://example/setup.exe');
    expect(info?.portableUrl).toBe('https://example/portable.zip');
  });

  it('returns null when tag is missing', () => {
    expect(normalizeReleaseJson({})).toBeNull();
  });
});
