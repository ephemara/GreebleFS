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
    expect(BUILT_IN_FOLDER_ICON_RULES.find(rule => rule.id === 'source')?.icon).toBe('src');
    expect(BUILT_IN_FOLDER_ICON_RULES.find(rule => rule.id === 'node-modules')?.icon).toBe('node_modules');
    expect(createDefaultFolderIconRules()).not.toBe(BUILT_IN_FOLDER_ICON_RULES);
  });

  it('maps semantic aliases onto stable common folder icons', () => {
    expect(getFolderIconSrc('C:\\repo\\documentation')).toBe('/icons/folder_custom_docs.svg');
    expect(getFolderIconSrc('C:\\repo\\node_modules')).toBe('/icons/folder_custom_node_modules.svg');
    expect(getFolderIconSrc('C:\\repo\\settings')).toBe('/icons/folder_custom_config.svg');
  });

  it('still supports path-aware rule matches for nested folders', () => {
    expect(getFolderIconSrc('M:\\Nodez\\src\\tauri')).toBe('/icons/folder_custom_src.svg');
    expect(getFolderIconSrc('M:\\Nodez\\src\\tauri', true)).toBe('/icons/folder_custom_src_open.svg');
  });

  it('falls back to the configured default folder icon when nothing matches', () => {
    const pair = resolveFolderIconPair('C:\\repo\\totally-unknown-folder');
    expect(DEFAULT_FOLDER_ICON_VALUE).toBe('folder');
    expect(pair.closed).toBe('folder.svg');
    expect(pair.open).toBe('folder_open.svg');
  });

  it('lets callers override both rules and the default icon', () => {
    const rules = [
      {
        id: 'overlayterm',
        label: 'OverlayTerm',
        matchers: ['overlayterm'],
        icon: 'overlayterm' as const,
      },
    ];

    expect(getFolderIconSrc('M:\\OverlayTerm', false, { rules, defaultIcon: 'api' })).toBe('/icons/folder_custom_overlayterm.svg');
    expect(getFolderIconSrc('M:\\Mystery', false, { rules, defaultIcon: 'api' })).toBe('/icons/folder_custom_api.svg');
  });

  it('resolves icon names directly for settings previews', () => {
    expect(getNamedFolderIconSrc('folder')).toBe('/icons/folder.svg');
    expect(getNamedFolderIconSrc('docs', true)).toBe('/icons/folder_custom_docs_open.svg');
  });
});
