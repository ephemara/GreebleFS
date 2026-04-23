import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IconThemeProvider, RefreshCw, X } from '@/components/AppIcons';
import { resolveOverlayAppearance } from '../config/appearance';
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

export default function FileOperationsWindowApp() {
  useExplorerTaskProgressFeed();

  const appearanceSelection = useSettingsStore((state) => state.settings.appearance);
  const resolvedAppearance = useMemo(
    () => resolveOverlayAppearance(appearanceSelection),
    [appearanceSelection],
  );
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

  const palette = resolvedAppearance.theme.palette;
  const title = describeFileOperationsWindowRequest(request);

  return (
    <IconThemeProvider iconTheme={resolvedAppearance.theme.assets?.iconTheme}>
      <div
        className="overlay-window-host w-full h-full overflow-hidden"
        style={{
          ...(resolvedAppearance.cssVars as CSSProperties),
          minHeight: '100vh',
          background: `radial-gradient(circle at top right, ${palette.accentSoft}22, transparent 34%), linear-gradient(180deg, ${palette.appBackgroundAlt}, ${palette.appBackground})`,
          color: palette.textPrimary,
          fontFamily: resolvedAppearance.fonts.ui,
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
              borderBottom: '1px solid var(--overlay-border)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
              backdropFilter: 'blur(18px)',
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
                borderRadius: 10,
                border: '1px solid var(--overlay-border)',
                background: 'rgba(255,255,255,0.05)',
                color: palette.textPrimary,
                cursor: 'pointer',
              }}
              aria-label="Close file operations window"
              title="Close file operations window"
            >
              <X size={14} />
            </button>
          </header>
          <OverlayScrollArea style={{ minHeight: 0 }}>
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
                      borderRadius: 10,
                      border: '1px solid var(--overlay-border)',
                      background: 'rgba(255,255,255,0.04)',
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
