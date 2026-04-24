import { Loader2, Settings2, ShieldCheck, Smartphone } from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { getMobileRemoteAccessModeDefinition, type MobileRemoteAccessMode } from '../config/mobileAccess';
import type { MobileSharePhase } from '../store/mobileShareStore';
import type { MobileShareSession } from '../runtime/mobileShareRuntime';
import { AppDialogFrame } from './AppModal';
import { MobileShareConnectionCards } from './MobileShareConnectionCards';
import { OverlayActionButton } from './OverlayActionButton';

interface MobileShareQrDialogProps {
  open: boolean;
  appearance: ResolvedOverlayAppearance;
  phase: MobileSharePhase;
  session: MobileShareSession | null;
  remoteAccessMode: MobileRemoteAccessMode;
  notice: string | null;
  error: string | null;
  showSettingsAction?: boolean;
  onClose: () => void;
  onOpenMobileSettings: () => void;
  onStartOrRestartShare: () => void | Promise<void>;
  onStopShare: () => void | Promise<void>;
}

export function MobileShareQrDialog({
  open,
  appearance,
  phase,
  session,
  remoteAccessMode,
  notice,
  error,
  showSettingsAction = true,
  onClose,
  onOpenMobileSettings,
  onStartOrRestartShare,
  onStopShare,
}: MobileShareQrDialogProps) {
  if (!open) {
    return null;
  }

  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const accent = appearance.theme.palette.accent;
  const border = appearance.theme.palette.border;
  const remoteAccessDefinition = getMobileRemoteAccessModeDefinition(remoteAccessMode);
  const isPending = phase === 'starting' || phase === 'stopping';
  const selectedModeDiffersFromLiveSession = session != null
    && session.remoteAccessMode !== remoteAccessMode;

  return (
    <AppDialogFrame
      title="Phone Pairing"
      description={`Bring the ${remoteAccessDefinition.label} mobile route online, then scan the desktop-hosted explorer directly from your phone.`}
      icon={<Smartphone size={16} />}
      width={980}
      maxWidth={980}
      onClose={onClose}
      actions={(
        <>
          {showSettingsAction ? (
            <OverlayActionButton
              appearance={appearance}
              tone="neutral"
              onClick={onOpenMobileSettings}
            >
              <Settings2 size={11} />
              Mobile Settings
            </OverlayActionButton>
          ) : null}
          <OverlayActionButton
            appearance={appearance}
            tone="accent"
            onClick={() => void onStartOrRestartShare()}
          >
            {phase === 'starting' ? <Loader2 size={11} className="animate-spin" /> : null}
            {session ? `Restart ${remoteAccessDefinition.launchBadge} Share` : `Start ${remoteAccessDefinition.launchBadge} Share`}
          </OverlayActionButton>
          <OverlayActionButton
            appearance={appearance}
            tone="neutral"
            disabled={isPending}
            onClick={() => void onStopShare()}
          >
            {phase === 'stopping' ? 'Stopping...' : 'Stop Share'}
          </OverlayActionButton>
          <OverlayActionButton
            appearance={appearance}
            tone="quiet"
            onClick={onClose}
          >
            Close
          </OverlayActionButton>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="rounded border px-4 py-4" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
            <div className="flex items-center gap-2">
              <div
                className="grid place-items-center rounded-full"
                style={{
                  width: 28,
                  height: 28,
                  border: `1px solid ${isPending ? accent : border}`,
                  background: isPending ? `${accent}18` : 'rgba(255,255,255,0.04)',
                  color: isPending ? accent : muted,
                }}
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: muted }}>
                  Selected Route
                </div>
                <div className="text-[13px] font-semibold" style={{ color: text }}>
                  {remoteAccessDefinition.label}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-5" style={{ color: muted }}>
              {remoteAccessDefinition.description}
            </p>
            {selectedModeDiffersFromLiveSession ? (
              <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}55`, background: 'rgba(255,255,255,0.03)', color: text }}>
                The live share is still using
                {' '}
                <span style={{ color: accent }}>
                  {getMobileRemoteAccessModeDefinition(session.remoteAccessMode).label}
                </span>
                . Restart the share to regenerate the QR codes for the newly selected route.
              </div>
            ) : null}
          </div>

          <div className="grid gap-3">
            <div className="rounded border px-4 py-4 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
              <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Live Share Path</div>
              <div className="mt-2 break-all" style={{ color: session ? text : muted }}>
                {session?.sharePath ?? 'Start the mobile share to generate live pairing routes.'}
              </div>
            </div>
            <div className="rounded border px-4 py-4 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
              <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Preferred Phone URL</div>
              <div className="mt-2 break-all" style={{ color: session ? text : muted }}>
                {session?.preferredUrl ?? 'No live route yet.'}
              </div>
            </div>
          </div>
        </div>

        {notice ? (
          <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${accent}55`, background: `${accent}10`, color: text }}>
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.12)', color: '#fecaca' }}>
            {error}
          </div>
        ) : null}

        <MobileShareConnectionCards
          appearance={appearance}
          session={session}
          emptyState={(
            <div className="rounded border px-4 py-10 text-center" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: text }}>
                No Live Pairing Codes Yet
              </div>
              <p className="mt-2 text-[11px] leading-5" style={{ color: muted }}>
                Start the current
                {' '}
                {remoteAccessDefinition.label}
                {' '}
                route and the QR cards will appear here in a centered pairing surface instead of a clipped top-bar hover.
              </p>
            </div>
          )}
        />
      </div>
    </AppDialogFrame>
  );
}
