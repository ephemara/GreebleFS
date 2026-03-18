import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/TerminalOverlay', () => ({
  default: () => null,
}));

vi.mock('../components/FileExplorer', () => ({
  FileExplorer: () => null,
}));

vi.mock('../components/GitManager', () => ({
  GitManager: () => null,
}));

vi.mock('../components/NotesManager', () => ({
  NotesManager: () => null,
}));

vi.mock('../components/ScreenshotsManager', () => ({
  ScreenshotsManager: () => null,
}));

vi.mock('../components/PluginsManager', () => ({
  FolderPluginRenderer: () => null,
}));

vi.mock('../components/SettingsPage', () => ({
  SettingsPage: () => null,
}));

import { createBuiltInPanelDefinitions } from '../panels/panelRegistry';

describe('createBuiltInPanelDefinitions', () => {
  it('keeps the explorer panel mounted so tab switches do not reset its state', () => {
    const panels = createBuiltInPanelDefinitions({
      appearance: {
        theme: {
          palette: {
            accent: '#44ff88',
            appBackground: '#0a0a0a',
            panelBackground: '#101010',
            textPrimary: '#f5f5f5',
            border: '#2a2a2a',
            textMuted: '#9a9a9a',
          },
        },
      } as never,
      explorerLayoutMode: 'full',
      isOpen: true,
      hideOverlay: () => {},
      onOpenInTerminal: () => {},
      onAddBookmark: async () => {},
      renderPluginsManager: () => null,
    });

    const explorer = panels.find(panel => panel.id === 'explorer');

    expect(explorer?.keepMounted).toBe(true);
  });
});
