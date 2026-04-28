import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Cpu, LoaderCircle, RefreshCw } from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  GoPanelHost,
  type GoPanelHostContext,
  type GoPanelHostEvent,
  type GoPanelHostHandle,
} from './GoPanelHost';

const PANEL_BACKGROUND = 'var(--overlay-bg-panel)';
const PANEL_BACKGROUND_ALT = 'var(--overlay-bg-panel-alt)';
const PANEL_BORDER = 'var(--overlay-border)';
const PANEL_TEXT = 'var(--overlay-text-primary)';
const PANEL_MUTED = 'var(--overlay-text-muted)';
const PANEL_ACCENT = 'var(--overlay-accent)';

type PanelRuntimeStatus = 'booting' | 'ready' | 'error';

function createDefaultHostSize(): { width: number; height: number } {
  return { width: 520, height: 360 };
}

function formatRuntimeEventLabel(event: GoPanelHostEvent | null): string {
  if (!event) {
    return 'No runtime event yet';
  }
  if (event.kind === 'ready') {
    return 'runtime ready';
  }
  if (event.kind === 'error') {
    return `runtime error: ${event.message}`;
  }
  if (event.kind === 'request-resize') {
    return `resize requested: ${event.width}x${event.height}`;
  }
  const payloadPreview =
    event.payload == null ? '' : ` ${JSON.stringify(event.payload)}`;
  return `${event.name}${payloadPreview}`.trim();
}

function hostToolbarButtonStyle(): CSSProperties {
  return {
    borderRadius: 10,
    border: `1px solid color-mix(in srgb, ${PANEL_ACCENT} 30%, ${PANEL_BORDER})`,
    background: 'color-mix(in srgb, var(--overlay-accent) 10%, transparent)',
    color: PANEL_TEXT,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

function hostPillStyle(background: string): CSSProperties {
  return {
    borderRadius: 999,
    padding: '6px 10px',
    background,
    border: `1px solid ${PANEL_BORDER}`,
    fontSize: 11,
    color: PANEL_TEXT,
    whiteSpace: 'nowrap',
  };
}

export function GoRuntimeSmokePanel({
  appearance,
}: {
  appearance?: ResolvedOverlayAppearance;
}) {
  const panelRef = useRef<GoPanelHostHandle | null>(null);
  const runtimeViewportRef = useRef<HTMLDivElement | null>(null);
  const [hostSize, setHostSize] = useState(createDefaultHostSize);
  const [hasResolvedHostSize, setHasResolvedHostSize] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<PanelRuntimeStatus>('booting');
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [lastRuntimeEvent, setLastRuntimeEvent] = useState<GoPanelHostEvent | null>(null);
  const [lastRuntimeEventAt, setLastRuntimeEventAt] = useState<string | null>(null);

  useEffect(() => {
    const element = runtimeViewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      setHasResolvedHostSize(true);
      return undefined;
    }

    const observer = new ResizeObserver(entries => {
      const nextRect = entries[0]?.contentRect;
      if (!nextRect) {
        return;
      }
      const nextWidth = Math.max(320, Math.round(nextRect.width));
      const nextHeight = Math.max(240, Math.round(nextRect.height));
      setHostSize(current =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
      setHasResolvedHostSize(true);
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const context = useMemo<GoPanelHostContext>(
    () => ({
      runtimeId: 'sample-panel',
      panelId: 'go-sample-panel',
      appearanceId: appearance?.theme.id ?? null,
      densityToken: appearance?.theme.presentation?.density ?? 'comfortable',
      cssVariables: appearance?.cssVars ?? {},
      assetUrls: {},
      size: hostSize,
    }),
    [appearance, hostSize],
  );

  const handleRuntimeEvent = useCallback((event: GoPanelHostEvent) => {
    setLastRuntimeEvent(event);
    setLastRuntimeEventAt(new Date().toLocaleTimeString());
    if (event.kind === 'error') {
      setRuntimeStatus('error');
      setRuntimeError(event.message);
      return;
    }
    if (event.kind === 'ready') {
      setRuntimeStatus('ready');
      setRuntimeError(null);
    }
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flex: 1,
        minHeight: 0,
        padding: 14,
        background: PANEL_BACKGROUND,
        color: PANEL_TEXT,
      }}
    >
      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: 14,
          borderRadius: 16,
          border: `1px solid ${PANEL_BORDER}`,
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--overlay-accent) 12%, transparent), transparent 58%), var(--overlay-bg-panel-alt)',
        }}
      >
        <div style={{ minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                background: 'color-mix(in srgb, var(--overlay-accent) 15%, transparent)',
                border: `1px solid color-mix(in srgb, var(--overlay-accent) 45%, transparent)`,
              }}
            >
              <Cpu size={16} style={{ color: PANEL_ACCENT }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                Go/Wasm Runtime Smoke Panel
              </div>
              <div style={{ fontSize: 11, color: PANEL_MUTED, marginTop: 2 }}>
                Real `wasm-panel` runtime, live host events, and persisted local state.
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 12,
            }}
          >
            <div
              style={hostPillStyle(
                runtimeStatus === 'ready'
                  ? 'color-mix(in srgb, var(--overlay-success) 18%, transparent)'
                  : runtimeStatus === 'error'
                    ? 'color-mix(in srgb, var(--overlay-danger) 16%, transparent)'
                    : 'color-mix(in srgb, var(--overlay-warning) 16%, transparent)',
              )}
            >
              Status: {runtimeStatus}
            </div>
            <div style={hostPillStyle(PANEL_BACKGROUND)}>
              Runtime: `sample-panel`
            </div>
            <div style={hostPillStyle(PANEL_BACKGROUND)}>
              Viewport: {hostSize.width}x{hostSize.height}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setRuntimeStatus('booting');
              setRuntimeError(null);
              panelRef.current?.reload();
            }}
            style={hostToolbarButtonStyle()}
          >
            <RefreshCw size={14} />
            Reload Runtime
          </button>
          <div
            style={{
              maxWidth: 360,
              fontSize: 11,
              color: PANEL_MUTED,
              textAlign: 'right',
              lineHeight: 1.5,
            }}
          >
            Last runtime event{lastRuntimeEventAt ? ` at ${lastRuntimeEventAt}` : ''}: {formatRuntimeEventLabel(lastRuntimeEvent)}
          </div>
        </div>
      </section>

      <div
        ref={runtimeViewportRef}
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: 18,
          border: `1px solid ${PANEL_BORDER}`,
          background: PANEL_BACKGROUND_ALT,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {hasResolvedHostSize ? (
          <GoPanelHost
            ref={panelRef}
            runtimeId="sample-panel"
            context={context}
            onEvent={handleRuntimeEvent}
            className="go-runtime-smoke-host"
            style={{
              width: '100%',
              height: '100%',
              minHeight: 0,
              background: PANEL_BACKGROUND_ALT,
            }}
            renderLoading={() => (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  color: PANEL_MUTED,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LoaderCircle size={14} className="animate-spin" />
                  Building Go/Wasm smoke runtime...
                </div>
              </div>
            )}
            renderError={(error, retry) => (
              <div
                role="alert"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 20,
                  background: 'color-mix(in srgb, var(--overlay-danger) 8%, transparent)',
                }}
              >
                <div
                  style={{
                    maxWidth: 420,
                    borderRadius: 16,
                    border: `1px solid color-mix(in srgb, var(--overlay-danger) 40%, ${PANEL_BORDER})`,
                    background: PANEL_BACKGROUND,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: PANEL_TEXT }}>
                    Go runtime boot failed
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: PANEL_MUTED, lineHeight: 1.55 }}>
                    {runtimeError ?? error}
                  </div>
                  <button
                    type="button"
                    onClick={retry}
                    style={{ ...hostToolbarButtonStyle(), marginTop: 14 }}
                  >
                    <RefreshCw size={14} />
                    Retry Runtime
                  </button>
                </div>
              </div>
            )}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: PANEL_MUTED,
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LoaderCircle size={14} className="animate-spin" />
              Resolving runtime viewport...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GoRuntimeSmokePanel;
