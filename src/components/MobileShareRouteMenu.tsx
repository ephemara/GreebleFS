import type { PointerEventHandler } from 'react';
import { Check, Loader2, ScanLine, Settings2, ShieldCheck, Smartphone } from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  getMobileRemoteAccessModeDefinition,
  mobileRemoteAccessModeDefinitions,
  type MobileRemoteAccessMode,
} from '../config/mobileAccess';
import type { MobileSharePhase } from '../store/mobileShareStore';
import type { MobileShareSession } from '../runtime/mobileShareRuntime';

interface MobileShareRouteMenuProps {
  appearance: ResolvedOverlayAppearance;
  phase: MobileSharePhase;
  session: MobileShareSession | null;
  remoteAccessMode: MobileRemoteAccessMode;
  error: string | null;
  notice: string | null;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
  onSelectRemoteAccessMode: (mode: MobileRemoteAccessMode) => void | Promise<void>;
  onShowQrCodes: () => void | Promise<void>;
  onStartOrRestartShare: () => void | Promise<void>;
  onStopShare: () => void | Promise<void>;
  onOpenMobileSettings: () => void | Promise<void>;
}

export function MobileShareRouteMenu({
  appearance,
  phase,
  session,
  remoteAccessMode,
  error,
  notice,
  onPointerEnter,
  onPointerLeave,
  onSelectRemoteAccessMode,
  onShowQrCodes,
  onStartOrRestartShare,
  onStopShare,
  onOpenMobileSettings,
}: MobileShareRouteMenuProps) {
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const accent = appearance.theme.palette.accent;
  const border = appearance.theme.palette.border;
  const controlRadius = appearance.workbenchTheme.metrics.controlRadius;
  const panelRadius = appearance.workbenchTheme.metrics.panelRadius;
  const remoteAccessDefinition = getMobileRemoteAccessModeDefinition(remoteAccessMode);
  const isPending = phase === 'starting' || phase === 'stopping';
  const liveSessionMismatch = session != null && session.remoteAccessMode !== remoteAccessMode;

  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 344,
        maxWidth: 'calc(100vw - 24px)',
        padding: 12,
        borderRadius: panelRadius,
        border: '1px solid var(--overlay-workbench-chrome-border)',
        background: 'var(--overlay-workbench-chrome-menu-bg)',
        boxShadow: 'var(--overlay-workbench-shell-shadow)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 60,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '999px',
                display: 'grid',
                placeItems: 'center',
                border: `1px solid ${isPending || session ? accent : border}`,
                background: isPending || session ? `${accent}16` : 'rgba(255,255,255,0.04)',
                color: isPending || session ? accent : muted,
                flexShrink: 0,
              }}
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} />}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text }}>
                Mobile Share
              </div>
              <div className="text-[10px]" style={{ color: muted }}>
                {session ? `${getMobileRemoteAccessModeDefinition(session.remoteAccessMode).label} live` : 'Choose the route, then pair the phone'}
              </div>
            </div>
          </div>
        </div>
        <span
          className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: session ? `${accent}66` : border,
            background: session ? `${accent}14` : 'rgba(255,255,255,0.04)',
            color: session ? accent : muted,
          }}
        >
          {session ? 'Online' : isPending ? 'Working' : 'Offline'}
        </span>
      </div>

      <div className="mt-3 rounded border px-3 py-3" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={12} style={{ color: accent }} />
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: text }}>
            Selected Route
          </div>
        </div>
        <div className="mt-2 text-[12px] font-semibold" style={{ color: text }}>
          {remoteAccessDefinition.label}
        </div>
        <p className="mt-1 text-[10px] leading-4" style={{ color: muted }}>
          {remoteAccessDefinition.summary}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {mobileRemoteAccessModeDefinitions.map(option => {
          const isSelected = remoteAccessMode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => void onSelectRemoteAccessMode(option.id)}
              className="rounded px-3 py-3 text-left transition-colors"
              style={{
                border: `1px solid ${isSelected ? accent : border}`,
                background: isSelected ? `${accent}16` : 'rgba(255,255,255,0.03)',
                color: text,
                borderRadius: controlRadius,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold">{option.label}</div>
                {isSelected ? <Check size={11} style={{ color: accent }} /> : null}
              </div>
              <p className="mt-1 text-[10px] leading-4" style={{ color: muted }}>
                {option.summary}
              </p>
            </button>
          );
        })}
      </div>

      {liveSessionMismatch ? (
        <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}55`, background: 'rgba(255,255,255,0.03)', color: text }}>
          The live share is still using
          {' '}
          <span style={{ color: accent }}>
            {getMobileRemoteAccessModeDefinition(session.remoteAccessMode).label}
          </span>
          . Restart it or use
          {' '}
          <span style={{ color: accent }}>Show QR Codes</span>
          {' '}
          to regenerate the pairing cards for the newly selected route.
        </div>
      ) : null}

      {notice ? (
        <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}55`, background: `${accent}10`, color: text }}>
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.12)', color: '#fecaca' }}>
          {error}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void onShowQrCodes()}
          className="inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ border: `1px solid ${accent}55`, background: `${accent}18`, color: text, borderRadius: controlRadius }}
        >
          <ScanLine size={11} />
          Show QR Codes
        </button>
        <button
          type="button"
          onClick={() => void onStartOrRestartShare()}
          className="inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text, borderRadius: controlRadius }}
        >
          {isPending && phase === 'starting' ? <Loader2 size={11} className="animate-spin" /> : null}
          {session ? `Restart ${remoteAccessDefinition.launchBadge}` : `Start ${remoteAccessDefinition.launchBadge}`}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void onStopShare()}
          className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text, borderRadius: controlRadius, opacity: isPending ? 0.7 : 1 }}
        >
          {phase === 'stopping' ? 'Stopping...' : 'Stop Share'}
        </button>
        <button
          type="button"
          onClick={() => void onOpenMobileSettings()}
          className="inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text, borderRadius: controlRadius }}
        >
          <Settings2 size={11} />
          Settings
        </button>
      </div>
    </div>
  );
}
