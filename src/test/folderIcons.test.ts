import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_FOLDER_ICON_RULES,
  createDefaultFolderIconRules,
  DEFAULT_FOLDER_ICON_VALUE,
  getFolderIconSrc,
  getNamedFolderIconSrc,
  resolveFolderIconPair,
} from '../config/folderIcons';

describe('folder icon resolver', () => {
  it('ships curated coding-folder associations by default', () => {
    expect(BUILT_IN_FOLDER_ICON_RULES.find(rule => rule.icon === 'folder_src')?.matchers).toContain('src');
    expect(BUILT_IN_FOLDER_ICON_RULES.find(rule => rule.icon === 'folder_packages')?.matchers).toContain('node_modules');
    expect(createDefaultFolderIconRules()).not.toBe(BUILT_IN_FOLDER_ICON_RULES);
  });

  it('maps semantic aliases onto stable common folder icons', () => {
    expect(getFolderIconSrc('C:\\repo\\documentation')).toBe('/icons/folder_docs.svg');
    expect(getFolderIconSrc('C:\\repo\\node_modules')).toBe('/icons/folder_packages.svg');
    expect(getFolderIconSrc('C:\\repo\\settings')).toBe('/icons/folder_config.svg');
  });

  it('still supports path-aware rule matches for nested folders', () => {
    expect(getFolderIconSrc('M:\\Nodez\\src\\tauri')).toBe('/icons/folder_src.svg');
    expect(getFolderIconSrc('M:\\Nodez\\src\\tauri', true)).toBe('/icons/folder_src_open.svg');
  });

  it('falls back to the configured default folder icon when nothing matches', () => {
    const pair = resolveFolderIconPair('C:\\repo\\totally-unknown-folder');
    expect(DEFAULT_FOLDER_ICON_VALUE).toBe('folder');
    expect(pair.closed).toBe('/icons/folder.svg');
    expect(pair.open).toBe('/icons/folder_open.svg');
  });

  it('lets callers override both rules and the default icon', () => {
    const rules = [
      {
        id: 'overlayterm',
        label: 'OverlayTerm',
        matchers: ['overlayterm'],
        icon: 'folder_docs' as const,
      },
    ];

    expect(getFolderIconSrc('M:\\OverlayTerm', false, { rules, defaultIcon: 'folder_api' })).toBe('/icons/folder_docs.svg');
    expect(getFolderIconSrc('M:\\Mystery', false, { rules, defaultIcon: 'folder_api' })).toBe('/icons/folder_api.svg');
  });

  it('resolves icon names directly for settings previews', () => {
    expect(getNamedFolderIconSrc('folder')).toBe('/icons/folder.svg');
    expect(getNamedFolderIconSrc('folder_docs', true)).toBe('/icons/folder_docs_open.svg');
  });
});
