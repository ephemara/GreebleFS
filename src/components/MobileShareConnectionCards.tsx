import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Copy, ExternalLink, Loader2 } from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { mobileShareQrCodeSizePx } from '../config/mobileAccess';
import { copyTextToClipboardSafely, type MobileShareSession } from '../runtime/mobileShareRuntime';
import { OverlayActionButton } from './OverlayActionButton';

interface MobileShareConnectionCardsProps {
  appearance: ResolvedOverlayAppearance;
  session: MobileShareSession | null;
  emptyState?: ReactNode;
}

export function MobileShareConnectionCards({
  appearance,
  session,
  emptyState = null,
}: MobileShareConnectionCardsProps) {
  const [qrCodeByUrl, setQrCodeByUrl] = useState<Record<string, string>>({});
  const connectionTargets = session?.connectionTargets ?? [];
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const accent = appearance.theme.palette.accent;
  const border = appearance.theme.palette.border;
  const controlRadius = appearance.workbenchTheme.metrics.controlRadius;
  const qrDisplaySize = connectionTargets.length >= 3
    ? 'clamp(100px, 9vw, 128px)'
    : 'clamp(112px, 11vw, 152px)';
  const qrGridStyle = {
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 216px), 1fr))',
    alignItems: 'start',
    '--mobile-share-qr-size': qrDisplaySize,
  } as CSSProperties;

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

  if (connectionTargets.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div
      role="list"
      aria-label="Mobile share connection targets"
      className="grid gap-3"
      style={qrGridStyle}
    >
      {connectionTargets.map(target => (
        <div
          key={target.url}
          role="listitem"
          className="rounded border p-3"
          style={{
            borderColor: target.isPreferred ? `${accent}66` : border,
            background: target.isPreferred ? `${accent}0d` : 'rgba(255,255,255,0.03)',
            minWidth: 0,
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

          <div
            className="mt-3 flex items-center justify-center rounded border bg-white p-2"
            style={{
              borderColor: border,
              minHeight: 'calc(var(--mobile-share-qr-size) + 16px)',
            }}
          >
            {qrCodeByUrl[target.url] ? (
              <img
                src={qrCodeByUrl[target.url]}
                alt={`QR code for ${target.label}`}
                style={{
                  width: 'var(--mobile-share-qr-size)',
                  height: 'var(--mobile-share-qr-size)',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Loader2 size={16} className="animate-spin" style={{ color: '#111111' }} />
            )}
          </div>

          <div
            className="mt-3 rounded border px-2 py-2 text-[10px]"
            style={{
              borderColor: border,
              background: 'rgba(255,255,255,0.03)',
              color: text,
              wordBreak: 'break-all',
            }}
          >
            {target.url}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <OverlayActionButton
              appearance={appearance}
              tone="neutral"
              size="compact"
              onClick={() => void copyTextToClipboardSafely(target.url)}
              className="gap-1"
            >
              <Copy size={10} />
              Copy URL
            </OverlayActionButton>
            <OverlayActionButton
              appearance={appearance}
              tone="neutral"
              size="compact"
              onClick={() => window.open(target.url, '_blank', 'noopener,noreferrer')}
              className="gap-1"
            >
              <ExternalLink size={10} />
              Open
            </OverlayActionButton>
          </div>
        </div>
      ))}
    </div>
  );
}
