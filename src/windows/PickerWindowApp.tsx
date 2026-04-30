import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IconThemeProvider, X } from '@/components/AppIcons';
import { FileExplorer } from '../components/FileExplorer';
import {
  EXPLORER_PICKER_WINDOW_CONFIG,
  listenToExplorerPickerRequests,
  publishExplorerPickerResult,
  readExplorerPickerRequest,
  type ExplorerPickerRequest,
} from '../runtime/explorerPicker';
import { useSettingsStore } from '../store/settingsStore';
import { useSyncedWindowAppearance } from './useSyncedWindowAppearance';

function isWindowPickerRequest(
  request: ExplorerPickerRequest | null,
): request is ExplorerPickerRequest {
  return Boolean(request && request.presentation === 'window');
}

export default function PickerWindowApp() {
  const appearanceSelection = useSettingsStore((state) => state.settings.appearance);
  const resolvedAppearance = useSyncedWindowAppearance(appearanceSelection);
  const [request, setRequest] = useState<ExplorerPickerRequest | null>(() => {
    const initialRequest = readExplorerPickerRequest();
    return isWindowPickerRequest(initialRequest) ? initialRequest : null;
  });

  useEffect(() => {
    return listenToExplorerPickerRequests((nextRequest) => {
      if (nextRequest.presentation !== 'window') {
        return;
      }

      setRequest(nextRequest);
    });
  }, []);

  useEffect(() => {
    if (!request) {
      return;
    }

    void getCurrentWindow()
      .setTitle(request.title || EXPLORER_PICKER_WINDOW_CONFIG.title)
      .catch(() => undefined);
  }, [request]);

  const closeWindow = useCallback(() => {
    void getCurrentWindow().close().catch(() => undefined);
  }, []);

  const handleCancel = useCallback(() => {
    if (!request) {
      closeWindow();
      return;
    }

    const fallbackDirectory = request.startPath ?? '/';
    void publishExplorerPickerResult({
      cancelled: true,
      currentDirectory: fallbackDirectory,
      nonce: request.nonce,
    }).finally(() => {
      closeWindow();
    });
  }, [closeWindow, request]);

  const handleConfirm = useCallback((result: {
    currentDirectory: string;
    entries: Array<{ path: string; name: string; kind: 'file' | 'folder' }>;
  }) => {
    if (!request) {
      closeWindow();
      return;
    }

    void publishExplorerPickerResult({
      currentDirectory: result.currentDirectory,
      entries: result.entries,
      nonce: request.nonce,
    }).finally(() => {
      closeWindow();
    });
  }, [closeWindow, request]);

  const palette = resolvedAppearance.theme.palette;

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
                {request?.title || EXPLORER_PICKER_WINDOW_CONFIG.title}
              </div>
              <div
                style={{
                  marginTop: 4,
                  color: palette.textMuted,
                  fontSize: 11,
                }}
              >
                Browse with the main Explorer surface and confirm the selection when ready.
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancel}
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
              aria-label="Close picker"
              title="Close picker"
            >
              <X size={14} />
            </button>
          </header>
          <div style={{ minHeight: 0 }}>
            {request ? (
              <FileExplorer
                appearance={resolvedAppearance}
                explorerPicker={request}
                theme={{
                  accent: palette.accent,
                  bg: palette.appBackground,
                  bgPanel: palette.panelBackground,
                  text: palette.textPrimary,
                  border: palette.border,
                  textMuted: palette.textMuted,
                }}
                onOpenInTerminal={() => undefined}
                onOpenInFilesystemAquarium={() => undefined}
                onAddBookmark={async () => undefined}
                onExplorerPickerConfirm={handleConfirm}
                onExplorerPickerCancel={handleCancel}
              />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 24,
                  color: palette.textMuted,
                  textAlign: 'center',
                }}
              >
                Waiting for a picker request.
              </div>
            )}
          </div>
        </div>
      </div>
    </IconThemeProvider>
  );
}
