import { useEffect, useMemo, useState, type PointerEventHandler } from 'react';
import QRCode from 'qrcode';
import {
  Copy,
  ExternalLink,
  Loader2,
  Settings2,
  ShieldCheck,
  Smartphone,
} from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  getMobileRemoteAccessModeDefinition,
  mobileShareQrCodeSizePx,
  type MobileRemoteAccessMode,
} from '../config/mobileAccess';
import type { MobileSharePhase } from '../store/mobileShareStore';
import type { MobileShareSession } from '../runtime/mobileShareRuntime';

interface MobileSharePopoverProps {
  appearance: ResolvedOverlayAppearance;
  phase: MobileSharePhase;
  session: MobileShareSession | null;
  remoteAccessMode: MobileRemoteAccessMode;
  error: string | null;
  notice: string | null;
  onOpenMobileSettings: () => void;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
}

export function MobileSharePopover({
  appearance,
  phase,
  session,
  remoteAccessMode,
  error,
  notice,
  onOpenMobileSettings,
  onPointerEnter,
  onPointerLeave,
}: MobileSharePopoverProps) {
  const [qrCodeByUrl, setQrCodeByUrl] = useState<Record<string, string>>({});
  const accessDefinition = useMemo(
    () => getMobileRemoteAccessModeDefinition(remoteAccessMode),
    [remoteAccessMode],
  );
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const accent = appearance.theme.palette.accent;
  const border = appearance.theme.palette.border;
  const controlRadius = appearance.workbenchTheme.metrics.controlRadius;
  const panelRadius = appearance.workbenchTheme.metrics.panelRadius;
  const connectionTargets = session?.connectionTargets ?? [];
  const isPending = phase === 'starting' || phase === 'stopping';
  const isRunning = phase === 'running' && session != null;

  useEffect(() => {
    let cancelled = false;
    const activeTargets = connectionTargets.filter(target => target.url.length > 0);
    if (activeTargets.length === 0) {
      setQrCodeByUrl({});
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(activeTargets.map(async target => [
      target.url,
      await QRCode.toDataURL(target.url, {
        margin: 1,
        width: mobileShareQrCodeSizePx,
        color: {
          dark: '#111111',
          light: '#ffffff',
        },
      }),
    ] as const))
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setQrCodeByUrl(Object.fromEntries(entries));
      })
      .catch((generationError) => {
        if (!cancelled) {
          console.warn('GreebleFS: failed to generate mobile share QR code', generationError);
          setQrCodeByUrl({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connectionTargets]);

  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: connectionTargets.length > 1 ? 376 : 316,
        maxWidth: 'calc(100vw - 16px)',
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
                border: `1px solid ${isRunning || isPending ? accent : border}`,
                background: isRunning || isPending ? `${accent}16` : 'rgba(255,255,255,0.04)',
                color: isRunning || isPending ? accent : muted,
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
                {isRunning ? `${accessDefinition.label} live` : isPending ? 'Updating mobile share...' : `${accessDefinition.label} ready`}
              </div>
            </div>
          </div>
        </div>
        <span
          className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: isRunning ? `${accent}66` : border,
            background: isRunning ? `${accent}14` : 'rgba(255,255,255,0.04)',
            color: isRunning ? accent : muted,
          }}
        >
          {isRunning ? 'Online' : isPending ? 'Working' : 'Offline'}
        </span>
      </div>

      {session ? (
        <div className="mt-3 rounded border px-3 py-2 text-[10px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: muted }}>
          Sharing
          {' '}
          <span style={{ color: text, wordBreak: 'break-all' }}>{session.sharePath}</span>
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

      {connectionTargets.length > 0 ? (
        <div
          className="mt-3 grid gap-3"
          style={{ gridTemplateColumns: connectionTargets.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' }}
        >
          {connectionTargets.map(target => (
            <div
              key={target.url}
              className="rounded border p-3"
              style={{
                borderColor: target.isPreferred ? `${accent}66` : border,
                background: target.isPreferred ? `${accent}0d` : 'rgba(255,255,255,0.03)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold" style={{ color: text }}>
                      {target.label}
                    </span>
                    {target.isPreferred ? (
                      <span
                        className="rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
                        style={{ borderColor: `${accent}66`, color: accent }}
                      >
                        Scan First
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[10px] leading-4" style={{ color: muted }}>
                    {target.description}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center rounded border bg-white p-2" style={{ borderColor: border, minHeight: mobileShareQrCodeSizePx + 16 }}>
                {qrCodeByUrl[target.url] ? (
                  <img
                    src={qrCodeByUrl[target.url]}
                    alt={`QR code for ${target.label}`}
                    style={{
                      width: mobileShareQrCodeSizePx,
                      height: mobileShareQrCodeSizePx,
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <Loader2 size={16} className="animate-spin" style={{ color: '#111111' }} />
                )}
              </div>

              <div className="mt-3 rounded border px-2 py-2 text-[10px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text, wordBreak: 'break-all' }}>
                {target.url}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(target.url)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                  style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text, borderRadius: controlRadius }}
                >
                  <Copy size={10} />
                  Copy URL
                </button>
                <button
                  type="button"
                  onClick={() => window.open(target.url, '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                  style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text, borderRadius: controlRadius }}
                >
                  <ExternalLink size={10} />
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded border px-3 py-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: muted }}>
          Click the phone control once to bring the mobile PWA online. Hovering here after that keeps the QR handoff close to the launcher instead of burying it in Settings.
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-[10px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-2" style={{ color: muted }}>
          <ShieldCheck size={11} style={{ color: accent }} />
          <span>
            Need to adjust LAN vs tailnet routing, hostname, or Tailscale login?
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenMobileSettings}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
          style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text, borderRadius: controlRadius }}
        >
          <Settings2 size={10} />
          Mobile Settings
        </button>
      </div>
    </div>
  );
}
