import React, { useState } from 'react';
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

function RepositoryPickerProofPage() {
  const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [requestId, setRequestId] = useState(1);
  const [confirmedPaths, setConfirmedPaths] = useState<string[]>([]);

  const resetScenario = (nextAllowMultiple: boolean) => {
    resetProofState();
    setAllowMultiple(nextAllowMultiple);
    setConfirmedPaths([]);
    setRequestId(current => current + 1);
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
        }}
      >
        <strong data-testid="proof-title">Repository picker browser proof</strong>
        <button data-testid="scenario-multi" onClick={() => resetScenario(true)} type="button">
          Multi-select scenario
        </button>
        <button data-testid="scenario-single" onClick={() => resetScenario(false)} type="button">
          Single-select scenario
        </button>
        <span data-testid="picker-mode">{allowMultiple ? 'multi' : 'single'}</span>
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
          onOpenInTerminal={() => {}}
          onAddBookmark={async () => {}}
          repositoryPicker={{
            active: true,
            allowMultiple,
            requestId,
            onConfirm: (paths) => setConfirmedPaths(paths),
            onCancel: () => setConfirmedPaths(['cancelled']),
          }}
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
    <RepositoryPickerProofPage />
  </React.StrictMode>,
);
