import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Play, RefreshCw, Square, X } from '../AppIcons';
import { getDefaultWindowMgrProofDefinition, type WindowMgrProofDefinition } from '../../config/windowMgrProofs';
import {
  bindGreebleWindowMgrProofEvents,
  buildGreebleWindowMgrBoundsRequest,
  describeWindowMgrError,
  getGreebleWindowMgrHostLabel,
  observeGreebleWindowMgrProofBounds,
  showGreebleWindowMgrProofSessionAtElement,
  startGreebleWindowMgrProofSession,
  stopGreebleWindowMgrProofSession,
  updateGreebleWindowMgrProofSessionBounds,
  type WindowMgrSessionInfo,
  type WindowMgrSurfaceBounds,
} from '../../runtime/windowMgr';
import {
  SettingsControlRow,
  SettingsIconActionButton,
  SettingsInlineNotice,
  ThemeBadge,
} from './SettingsPrimitives';

type WindowMgrProofAction = 'start' | 'sync' | 'stop';

function formatWindowMgrBounds(bounds: WindowMgrSurfaceBounds | null): string {
  if (!bounds) {
    return 'bounds pending';
  }

  return `${bounds.width}x${bounds.height} @ ${bounds.x},${bounds.y}`;
}

function resolveWindowMgrProofTone(
  proofDefinition: WindowMgrProofDefinition | null,
  session: WindowMgrSessionInfo | null,
): boolean {
  return proofDefinition != null
    && session?.launchStatus === 'attached'
    && session.visible;
}

export function WindowMgrProofSurface({
  platform,
  accent,
  border,
}: {
  platform: 'windows' | 'macos' | 'linux' | 'unknown';
  accent: string;
  border: string;
}) {
  const proofDefinition = useMemo(() => getDefaultWindowMgrProofDefinition(platform), [platform]);
  const hostWindowLabel = useMemo(() => getGreebleWindowMgrHostLabel(), []);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<WindowMgrSessionInfo | null>(null);
  const [session, setSession] = useState<WindowMgrSessionInfo | null>(null);
  const [lastBounds, setLastBounds] = useState<WindowMgrSurfaceBounds | null>(null);
  const [pendingAction, setPendingAction] = useState<WindowMgrProofAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!proofDefinition) {
      setSession(null);
      setLastBounds(null);
      setError(null);
      return () => {};
    }

    const cleanup = bindGreebleWindowMgrProofEvents(proofDefinition, hostWindowLabel, {
      onSession: nextSession => {
        setSession(nextSession);
        if (nextSession.launchStatus !== 'failed') {
          setError(null);
        }
      },
      onError: payload => setError(describeWindowMgrError(payload.error)),
    });

    return () => {
      cleanup();
    };
  }, [hostWindowLabel, proofDefinition]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !proofDefinition) {
      return () => {};
    }

    const cleanup = observeGreebleWindowMgrProofBounds(surface, bounds => {
      setLastBounds(bounds);
      const activeSession = sessionRef.current;
      if (
        activeSession?.visible === true
        && activeSession.launchStatus === 'attached'
      ) {
        void updateGreebleWindowMgrProofSessionBounds(
          proofDefinition,
          surface,
          hostWindowLabel,
          activeSession,
        ).catch(nextError => setError(describeWindowMgrError(nextError)));
      }
    }, () => sessionRef.current);

    return () => {
      cleanup();
    };
  }, [hostWindowLabel, proofDefinition]);

  useEffect(() => () => {
    const activeSession = sessionRef.current;
    if (
      proofDefinition
      && activeSession
      && activeSession.launchStatus !== 'exited'
    ) {
      void stopGreebleWindowMgrProofSession(proofDefinition, hostWindowLabel).catch(() => {});
    }
  }, [hostWindowLabel, proofDefinition]);

  const syncBounds = useCallback(async (sessionOverride?: WindowMgrSessionInfo | null) => {
    if (!proofDefinition || !surfaceRef.current) {
      return null;
    }

    const activeSession = sessionOverride ?? sessionRef.current;
    const boundsRequest = await buildGreebleWindowMgrBoundsRequest(
      proofDefinition,
      surfaceRef.current,
      hostWindowLabel,
      activeSession,
    );
    setLastBounds(boundsRequest.bounds);

    if (activeSession?.visible) {
      return updateGreebleWindowMgrProofSessionBounds(
        proofDefinition,
        surfaceRef.current,
        hostWindowLabel,
        activeSession,
      );
    }

    return showGreebleWindowMgrProofSessionAtElement(
      proofDefinition,
      surfaceRef.current,
      hostWindowLabel,
      activeSession,
    );
  }, [hostWindowLabel, proofDefinition]);

  const handleStart = useCallback(async () => {
    if (!proofDefinition) {
      return;
    }

    setPendingAction('start');
    setError(null);
    try {
      const startedSession = await startGreebleWindowMgrProofSession(
        proofDefinition,
        hostWindowLabel,
      );
      setSession(startedSession);
      const shownSession = await syncBounds(startedSession);
      if (shownSession) {
        setSession(shownSession);
      }
    } catch (nextError) {
      setError(describeWindowMgrError(nextError));
    } finally {
      setPendingAction(null);
    }
  }, [hostWindowLabel, proofDefinition, syncBounds]);

  const handleSync = useCallback(async () => {
    if (!proofDefinition) {
      return;
    }

    setPendingAction('sync');
    setError(null);
    try {
      const nextSession = await syncBounds();
      if (nextSession) {
        setSession(nextSession);
      }
    } catch (nextError) {
      setError(describeWindowMgrError(nextError));
    } finally {
      setPendingAction(null);
    }
  }, [proofDefinition, syncBounds]);

  const handleStop = useCallback(async () => {
    if (!proofDefinition) {
      return;
    }

    setPendingAction('stop');
    setError(null);
    try {
      const stoppedSession = await stopGreebleWindowMgrProofSession(
        proofDefinition,
        hostWindowLabel,
      );
      setSession(stoppedSession);
    } catch (nextError) {
      setSession(null);
      setError(describeWindowMgrError(nextError));
    } finally {
      setPendingAction(null);
    }
  }, [hostWindowLabel, proofDefinition]);

  const proofActive = resolveWindowMgrProofTone(proofDefinition, session);
  const launchStatus = proofDefinition == null
    ? 'unsupported'
    : pendingAction ?? session?.launchStatus ?? 'ready';
  const backendLabel = session?.backendKind ?? proofDefinition?.executable.backendPreference ?? 'auto';
  const processLabel = session?.pid ? `pid ${session.pid}` : 'pid pending';

  return (
    <>
      <SettingsControlRow
        label="WindowMgr"
        detail={`${hostWindowLabel} · ${formatWindowMgrBounds(lastBounds)}`}
        control={<ThemeBadge label={`${launchStatus} · ${backendLabel}`} active={proofActive} />}
        action={(
          <div className="flex items-center gap-1">
            <SettingsIconActionButton
              aria-label="Launch WindowMgr Proof"
              title="Launch WindowMgr Proof"
              onClick={() => void handleStart()}
              disabled={!proofDefinition || pendingAction != null}
              active={pendingAction === 'start'}
              accent={accent}
            >
              {pendingAction === 'start' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            </SettingsIconActionButton>
            <SettingsIconActionButton
              aria-label="Sync WindowMgr Bounds"
              title="Sync WindowMgr Bounds"
              onClick={() => void handleSync()}
              disabled={!proofDefinition || !session || pendingAction != null}
              active={pendingAction === 'sync'}
            >
              {pendingAction === 'sync' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </SettingsIconActionButton>
            <SettingsIconActionButton
              aria-label="Stop WindowMgr Proof"
              title="Stop WindowMgr Proof"
              onClick={() => void handleStop()}
              disabled={!proofDefinition || !session || pendingAction != null}
              active={pendingAction === 'stop'}
            >
              {pendingAction === 'stop' ? <Loader2 size={13} className="animate-spin" /> : <Square size={12} />}
            </SettingsIconActionButton>
          </div>
        )}
      />
      <div
        ref={surfaceRef}
        className="relative min-h-40 overflow-hidden border-t"
        data-windowmgr-proof-surface="notepad"
        data-windowmgr-proof-status={launchStatus}
        style={{
          borderColor: border,
          background: proofActive
            ? 'var(--overlay-workbench-chrome-button-active-bg)'
            : 'var(--overlay-workbench-settings-badge-bg)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-3 text-center">
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] opacity-45">
              {proofDefinition?.label ?? 'Windows only'}
            </div>
            <div className="mt-1 truncate text-[10px] opacity-35">
              {session ? `${processLabel} · hwnd ${session.hwnd ?? 'pending'}` : formatWindowMgrBounds(lastBounds)}
            </div>
          </div>
        </div>
      </div>
      {error ? (
        <SettingsInlineNotice
          tone={proofDefinition ? 'warning' : 'muted'}
          className="mx-3 my-2"
          action={session ? (
            <button
              type="button"
              aria-label="Clear WindowMgr Error"
              title="Clear WindowMgr Error"
              onClick={() => setError(null)}
              className="inline-flex h-5 w-5 items-center justify-center rounded"
              style={{
                border: '1px solid var(--overlay-workbench-settings-badge-border)',
                background: 'var(--overlay-workbench-settings-badge-bg)',
                color: 'var(--overlay-text-primary)',
              }}
            >
              <X size={12} />
            </button>
          ) : undefined}
        >
          {error}
        </SettingsInlineNotice>
      ) : null}
    </>
  );
}
