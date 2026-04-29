import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IconThemeProvider, RefreshCw, X } from '@/components/AppIcons';
import {
  describeFileOperationsWindowRequest,
  listenToFileOperationsWindowRequests,
  readFileOperationsWindowRequest,
  type FileOperationsWindowRequest,
} from '../runtime/fileOperationsWindow';
import {
  useExplorerTaskProgressFeed,
  useExplorerTaskSnapshots,
} from '../store/explorerTaskStore';
import { useSettingsStore } from '../store/settingsStore';
import { ExplorerTaskCenterContent } from '../components/explorer/ExplorerTaskCenterContent';
import { OverlayScrollArea } from '../components/OverlayScrollArea';
import { useSyncedWindowAppearance } from './useSyncedWindowAppearance';

export default function FileOperationsWindowApp() {
  useExplorerTaskProgressFeed();

  const appearanceSelection = useSettingsStore((state) => state.settings.appearance);
  const windowAppearance = useSyncedWindowAppearance(appearanceSelection);
  const tasks = useExplorerTaskSnapshots();
  const [request, setRequest] = useState<FileOperationsWindowRequest | null>(() =>
    readFileOperationsWindowRequest(),
  );

  useEffect(() => {
    return listenToFileOperationsWindowRequests((nextRequest) => {
      setRequest(nextRequest);
    });
  }, []);

  useEffect(() => {
    const title = describeFileOperationsWindowRequest(request);
    void getCurrentWindow().setTitle(title).catch(() => undefined);
  }, [request]);

  const closeWindow = useCallback(() => {
    void getCurrentWindow().close().catch(() => undefined);
  }, []);

  const palette = windowAppearance.palette;
  const title = describeFileOperationsWindowRequest(request);

  return (
    <IconThemeProvider iconTheme={windowAppearance.iconTheme}>
      <div
        data-overlay-explorer
        data-file-operations-theme-id={windowAppearance.themeId}
        className="overlay-window-host w-full h-full overflow-hidden"
        style={{
          ...(windowAppearance.cssVars as CSSProperties),
          ...(windowAppearance.explorerCssVars as CSSProperties),
          minHeight: '100vh',
          backgroundColor: 'var(--overlay-bg-app)',
          backgroundImage: 'var(--overlay-background-image), var(--overlay-workbench-settings-bg, linear-gradient(180deg, var(--overlay-bg-app-alt), var(--overlay-bg-app)))',
          backgroundPosition: 'var(--overlay-background-position)',
          backgroundSize: 'var(--overlay-background-size)',
          color: palette.textPrimary,
          fontFamily: windowAppearance.fonts.ui,
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '18px 20px',
              borderBottom: '1px solid var(--overlay-workbench-chrome-border, var(--overlay-border))',
              background: 'var(--overlay-workbench-chrome-bg, var(--overlay-bg-topbar))',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: palette.textPrimary,
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {title}
              </div>
              <div
                style={{
                  marginTop: 4,
                  color: palette.textMuted,
                  fontSize: 11,
                }}
              >
                Live history for explorer transfers, archive extraction, trash actions, and other durable filesystem tasks.
              </div>
            </div>
            <button
              type="button"
              onClick={closeWindow}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 'var(--overlay-explorer-control-radius, 10px)',
                border: '1px solid var(--overlay-workbench-chrome-border, var(--overlay-border))',
                background: 'var(--overlay-workbench-chrome-button-bg, var(--overlay-bg-card))',
                color: palette.textPrimary,
                cursor: 'pointer',
              }}
              aria-label="Close file operations window"
              title="Close file operations window"
            >
              <X size={14} />
            </button>
          </header>
          <OverlayScrollArea style={{ minHeight: 0 }} scrollbarStyle="themed">
            <div style={{ padding: 20 }}>
              <ExplorerTaskCenterContent
                accent={palette.accent}
                border={palette.border}
                danger={palette.danger}
                muted={palette.textMuted}
                tasks={tasks}
                text={palette.textPrimary}
                title="Explorer Tasks"
                headerActions={(
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 'var(--overlay-explorer-control-radius, 10px)',
                      border: '1px solid var(--overlay-explorer-chip-border, var(--overlay-border))',
                      background: 'var(--overlay-explorer-chip-bg, var(--overlay-bg-card))',
                      color: palette.textPrimary,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <RefreshCw size={13} />
                    Refresh View
                  </button>
                )}
              />
            </div>
          </OverlayScrollArea>
        </div>
      </div>
    </IconThemeProvider>
  );
}
