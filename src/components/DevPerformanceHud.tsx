import { useEffect, useRef, useState } from 'react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import type { OverlayFrameTelemetryStats } from '../config/frameTelemetry';

interface DevPerformanceHudSnapshot {
  navigationMs: number | null;
  longTaskCount: number;
  longTaskDurationMs: number | null;
  firstInputDelayMs: number | null;
  inpMs: number | null;
  cls: number | null;
  memoryUsedMb: number | null;
  memoryLimitMb: number | null;
}

interface DevPerformanceHudProps {
  enabled: boolean;
  appearance: ResolvedOverlayAppearance;
  activePanelLabel: string;
  openPanelCount: number;
  frameStats: OverlayFrameTelemetryStats | null;
}

const EMPTY_SNAPSHOT: DevPerformanceHudSnapshot = {
  navigationMs: null,
  longTaskCount: 0,
  longTaskDurationMs: null,
  firstInputDelayMs: null,
  inpMs: null,
  cls: null,
  memoryUsedMb: null,
  memoryLimitMb: null,
};

export function DevPerformanceHud({
  enabled,
  appearance,
  activePanelLabel,
  openPanelCount,
  frameStats,
}: DevPerformanceHudProps) {
  const snapshot = useDevPerformanceHudSnapshot(enabled, activePanelLabel);

  const accent = appearance.theme.palette.accent;
  const border = appearance.theme.palette.border;
  const panel = appearance.theme.palette.panelBackground;
  const panelAlt = appearance.theme.palette.panelAltBackground;
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const subtleBorder = `${accent}33`;
  const hudTiles = [
    {
      label: 'NAV',
      value: formatMilliseconds(snapshot.navigationMs),
      title: 'Last completed panel transition, measured from activation until the first paint after it settles.',
    },
    {
      label: 'FPS',
      value: frameStats ? formatNumber(frameStats.avgFps) : 'n/a',
      title: 'Rolling average FPS from the sampled overlay frame window.',
    },
    {
      label: 'FRAME',
      value: frameStats ? formatMilliseconds(frameStats.p95FrameMs) : 'n/a',
      title: 'Overlay frame p95 from the current sampled window.',
    },
    {
      label: 'JANK',
      value: frameStats ? formatInteger(frameStats.overBudgetCount) : 'n/a',
      title: 'Frames in the sampled window that exceeded the target frame budget.',
    },
    {
      label: 'LONG',
      value: formatInteger(snapshot.longTaskCount),
      title: 'Observed long tasks in the current session.',
    },
    {
      label: 'DELAY',
      value: formatMilliseconds(snapshot.firstInputDelayMs),
      title: 'First-input delay, if the browser reported one.',
    },
    {
      label: 'INP',
      value: formatMilliseconds(snapshot.inpMs),
      title: 'Interaction to Next Paint approximation from browser event timing, when supported.',
    },
    {
      label: 'CLS',
      value: snapshot.cls == null ? 'n/a' : formatNumber(snapshot.cls),
      title: 'Cumulative layout shift accumulated since the overlay started.',
    },
    {
      label: 'MEM',
      value: snapshot.memoryUsedMb == null ? 'n/a' : `${formatNumber(snapshot.memoryUsedMb)} MB`,
      title: snapshot.memoryLimitMb == null
        ? 'JavaScript heap usage, if the browser exposes it.'
        : `JavaScript heap usage. Limit: ${formatNumber(snapshot.memoryLimitMb)} MB.`,
    },
  ];

  if (!enabled) {
    return null;
  }

  return (
    <div
      aria-label="Developer performance HUD"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 110,
        width: 'min(640px, calc(100vw - 24px))',
        color: text,
        fontFamily: appearance.fonts.ui,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          border: `1px solid ${subtleBorder}`,
          borderRadius: 18,
          background: `linear-gradient(180deg, ${panelAlt}, ${panel})`,
          boxShadow: 'var(--overlay-workbench-shell-shadow)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          padding: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 9,
                lineHeight: 1,
                color: muted,
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              Dev HUD
            </div>
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.4, color: text }}>
              Always-on local development telemetry.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <HudPill label={`Panel ${activePanelLabel}`} accent={accent} border={border} text={text} muted={muted} />
            <HudPill label={`Open ${openPanelCount}`} accent={accent} border={border} text={text} muted={muted} />
            <HudPill label={frameStats?.withinTarget ? '60 FPS target' : 'Over budget'} accent={accent} border={border} text={text} muted={muted} active={frameStats?.withinTarget ?? false} />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {hudTiles.map(tile => (
            <MetricTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              title={tile.title}
              accent={accent}
              border={border}
              text={text}
              muted={muted}
              active={tile.label === 'FPS' || tile.label === 'FRAME' ? Boolean(frameStats) : false}
              tone={tile.label === 'JANK' && frameStats && frameStats.overBudgetCount > 0 ? 'warning' : 'normal'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function useDevPerformanceHudSnapshot(enabled: boolean, navigationKey: string): DevPerformanceHudSnapshot {
  const snapshotRef = useRef<DevPerformanceHudSnapshot>(EMPTY_SNAPSHOT);
  const [snapshot, setSnapshot] = useState<DevPerformanceHudSnapshot>(EMPTY_SNAPSHOT);
  const navigationStartRef = useRef<number | null>(null);
  const navigationPaintsRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      snapshotRef.current = { ...EMPTY_SNAPSHOT };
      setSnapshot(snapshotRef.current);
      navigationStartRef.current = null;
      navigationPaintsRef.current = 0;
      return;
    }

    navigationStartRef.current = performance.now();
    navigationPaintsRef.current = 0;
    let rafId = window.requestAnimationFrame(function waitForSettle() {
      if (navigationStartRef.current == null) {
        return;
      }

      navigationPaintsRef.current += 1;
      if (navigationPaintsRef.current >= 2) {
        snapshotRef.current = {
          ...snapshotRef.current,
          navigationMs: roundMetric(performance.now() - navigationStartRef.current),
        };
        setSnapshot({ ...snapshotRef.current });
        navigationStartRef.current = null;
        return;
      }

      rafId = window.requestAnimationFrame(waitForSettle);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [enabled, navigationKey]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const supportedEntryTypes = typeof PerformanceObserver !== 'undefined'
      ? new Set(PerformanceObserver.supportedEntryTypes ?? [])
      : new Set<string>();
    const observers: PerformanceObserver[] = [];

    if (supportedEntryTypes.has('longtask')) {
      const observer = new PerformanceObserver(list => {
        let longTaskCount = snapshotRef.current.longTaskCount;
        let longTaskDurationMs = snapshotRef.current.longTaskDurationMs;
        for (const entry of list.getEntries()) {
          longTaskCount += 1;
          longTaskDurationMs = roundMetric(entry.duration);
        }
        snapshotRef.current = {
          ...snapshotRef.current,
          longTaskCount,
          longTaskDurationMs,
        };
      });

      observer.observe({ entryTypes: ['longtask'] });
      observers.push(observer);
    }

    if (supportedEntryTypes.has('layout-shift')) {
      const observer = new PerformanceObserver(list => {
        let cls = snapshotRef.current.cls ?? 0;
        for (const entry of list.getEntries()) {
          const shiftEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (shiftEntry.hadRecentInput) {
            continue;
          }
          cls += shiftEntry.value ?? 0;
        }

        snapshotRef.current = {
          ...snapshotRef.current,
          cls: roundMetric(cls),
        };
      });

      observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    }

    if (supportedEntryTypes.has('first-input')) {
      const observer = new PerformanceObserver(list => {
        const latest = list.getEntries().at(-1) as PerformanceEntry & { processingStart?: number; startTime?: number } | undefined;
        if (!latest || typeof latest.processingStart !== 'number' || typeof latest.startTime !== 'number') {
          return;
        }

        snapshotRef.current = {
          ...snapshotRef.current,
          firstInputDelayMs: roundMetric(latest.processingStart - latest.startTime),
        };
      });

      observer.observe({ type: 'first-input', buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    }

    if (supportedEntryTypes.has('event')) {
      const observer = new PerformanceObserver(list => {
        let inpMs = snapshotRef.current.inpMs;
        for (const entry of list.getEntries()) {
          const eventEntry = entry as PerformanceEntry & { interactionId?: number };
          if (typeof eventEntry.interactionId === 'number' && eventEntry.interactionId > 0) {
            inpMs = inpMs == null
              ? roundMetric(eventEntry.duration)
              : Math.max(inpMs, roundMetric(eventEntry.duration));
          }
        }

        snapshotRef.current = {
          ...snapshotRef.current,
          inpMs,
        };
      });

      observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
      observers.push(observer);
    }

    const intervalId = window.setInterval(() => {
      snapshotRef.current = {
        ...snapshotRef.current,
        ...readMemorySnapshot(),
      };
      setSnapshot({ ...snapshotRef.current });
    }, 250);

    return () => {
      window.clearInterval(intervalId);
      observers.forEach(observer => observer.disconnect());
    };
  }, [enabled]);

  return snapshot;
}

function MetricTile({
  label,
  value,
  title,
  accent,
  border,
  text,
  muted,
  active,
  tone = 'normal',
}: {
  label: string;
  value: string;
  title: string;
  accent: string;
  border: string;
  text: string;
  muted: string;
  active: boolean;
  tone?: 'normal' | 'warning';
}) {
  const background = tone === 'warning'
    ? 'rgba(180, 83, 9, 0.18)'
    : active
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(255,255,255,0.03)';
  const valueColor = tone === 'warning' ? '#fde68a' : text;

  return (
    <div
      title={title}
      style={{
        minHeight: 58,
        borderRadius: 14,
        border: `1px solid ${active ? accent : border}`,
        background,
        padding: '8px 10px 9px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: 9,
          lineHeight: 1,
          color: muted,
          fontWeight: 800,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.1,
          color: valueColor,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function HudPill({
  label,
  accent,
  border,
  text,
  muted,
  active = false,
}: {
  label: string;
  accent: string;
  border: string;
  text: string;
  muted: string;
  active?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '6px 9px',
        border: `1px solid ${active ? accent : border}`,
        background: active ? `${accent}18` : 'rgba(255,255,255,0.03)',
        color: active ? text : muted,
        fontSize: 9,
        lineHeight: 1,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

function readMemorySnapshot(): Pick<DevPerformanceHudSnapshot, 'memoryUsedMb' | 'memoryLimitMb'> {
  const memory = typeof performance !== 'undefined'
    ? (performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      }).memory
    : undefined;

  if (!memory) {
    return { memoryUsedMb: null, memoryLimitMb: null };
  }

  return {
    memoryUsedMb: roundMetric(memory.usedJSHeapSize / 1024 / 1024),
    memoryLimitMb: roundMetric(memory.jsHeapSizeLimit / 1024 / 1024),
  };
}

function formatMilliseconds(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'n/a';
  }

  return `${formatNumber(value)} ms`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${roundTo(value, 2)}`;
}

function formatInteger(value: number | null): string {
  return value == null || !Number.isFinite(value) ? 'n/a' : `${Math.round(value)}`;
}

function roundMetric(value: number): number {
  return roundTo(value, 2);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
