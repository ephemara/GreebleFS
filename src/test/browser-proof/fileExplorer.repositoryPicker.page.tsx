import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { FileExplorer } from '../../components/FileExplorer';
import { resolveOverlayAppearance } from '../../config/appearance';
import { createDefaultExplorerRailSnapshot } from '../../components/explorer/explorerRailState';
import { EXPLORER_PERFORMANCE_HISTORY_KEY } from '../../config/performanceTelemetry';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
  useExplorerStore,
} from '../../store/explorerStore';
import { useSettingsStore } from '../../store/settingsStore';
import {
  createExplorerPickerRequest,
  type ExplorerPickerRequestKind,
} from '../../runtime/explorerPicker';

function resetProofState() {
  window.localStorage.removeItem('ultacode-settings');
  window.localStorage.removeItem(EXPLORER_STATE_STORAGE_KEY);
  window.localStorage.removeItem(EXPLORER_STATE_BACKUP_KEY);
  window.localStorage.removeItem(EXPLORER_LEGACY_BOOKMARKS_KEY);
  window.localStorage.removeItem(EXPLORER_PERFORMANCE_HISTORY_KEY);
  useSettingsStore.getState().resetToDefaults();
  useExplorerStore.getState().resetSession();
  useExplorerStore.getState().replaceRail(createDefaultExplorerRailSnapshot());
  useExplorerStore.getState().clearPersistenceNotice();
}

function createProofPickerRequest(kind: ExplorerPickerRequestKind) {
  return createExplorerPickerRequest({
    kind,
    presentation: 'embedded',
    initialFileName: kind === 'saveFile' ? 'notes' : undefined,
    defaultExtension: kind === 'saveFile' ? 'txt' : undefined,
    confirmLabel:
      kind === 'openFile'
        ? 'Choose File'
        : kind === 'openFiles'
          ? 'Choose Files'
          : kind === 'openFolder'
            ? 'Choose Folder'
            : kind === 'openFolders'
              ? 'Choose Folders'
              : kind === 'pickDestinationFolder'
                ? 'Choose Destination'
                : 'Save File',
  });
}

function ExplorerPickerProofPage() {
  const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
  const [kind, setKind] = useState<ExplorerPickerRequestKind>('openFolders');
  const [confirmedPaths, setConfirmedPaths] = useState<string[]>([]);
  const request = useMemo(() => createProofPickerRequest(kind), [kind]);

  const resetScenario = (nextKind: ExplorerPickerRequestKind) => {
    resetProofState();
    setKind(nextKind);
    setConfirmedPaths([]);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#f4f7fb' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(12,17,28,0.94)',
          flexWrap: 'wrap',
        }}
      >
        <strong data-testid="proof-title">Explorer picker browser proof</strong>
        <button data-testid="scenario-files" onClick={() => resetScenario('openFiles')} type="button">
          Files
        </button>
        <button data-testid="scenario-folders" onClick={() => resetScenario('openFolders')} type="button">
          Folders
        </button>
        <button data-testid="scenario-destination" onClick={() => resetScenario('pickDestinationFolder')} type="button">
          Destination
        </button>
        <button data-testid="scenario-save" onClick={() => resetScenario('saveFile')} type="button">
          Save
        </button>
        <span data-testid="picker-mode">{kind}</span>
        <span data-testid="confirmed-paths">
          {confirmedPaths.length > 0 ? confirmedPaths.join(' | ') : 'none'}
        </span>
      </div>
      <div style={{ height: 'calc(100vh - 58px)' }}>
        <FileExplorer
          theme={{
            accent: appearance.theme.palette.accent,
            bg: appearance.theme.palette.appBackground,
            bgPanel: appearance.theme.palette.panelBackground,
            text: appearance.theme.palette.textPrimary,
            border: appearance.theme.palette.border,
            textMuted: appearance.theme.palette.textMuted,
          }}
          appearance={appearance}
          onOpenInFilesystemAquarium={() => {}}
          onOpenInTerminal={() => {}}
          onAddBookmark={async () => {}}
          explorerPicker={request}
          onExplorerPickerConfirm={(result) =>
            setConfirmedPaths(result.entries.map((entry) => entry.path))
          }
          onExplorerPickerCancel={() => setConfirmedPaths(['cancelled'])}
        />
      </div>
    </div>
  );
}

resetProofState();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Proof root element was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ExplorerPickerProofPage />
  </React.StrictMode>,
);
