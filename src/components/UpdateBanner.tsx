/**
 * UpdateBanner — global fixed top-center pill shown when an update is ready.
 * Renders nothing when up-to-date, skipped, or dismissed for the tag.
 */

import { useCallback } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { UPDATE_RELEASES_PAGE_URL } from '../runtime/updateChecker';
import { useUpdateStore } from '../store/updateStore';

function formatCheckedAt(ts: number | null): string {
  if (!ts) return 'never';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return 'recently';
  }
}

export function UpdateBanner({ accent = '#8fd3ff' }: { accent?: string }) {
  const latest = useUpdateStore(s => s.latest);
  const updateAvailable = useUpdateStore(s => s.updateAvailable);
  const bannerDismissedFor = useUpdateStore(s => s.bannerDismissedFor);
  const skippedVersion = useUpdateStore(s => s.skippedVersion);
  const currentVersion = useUpdateStore(s => s.currentVersion);
  const checking = useUpdateStore(s => s.checking);

  const dismissBanner = useUpdateStore(s => s.dismissBanner);
  const skipVersion = useUpdateStore(s => s.skipVersion);
  const checkForUpdates = useUpdateStore(s => s.checkForUpdates);

  const openRelease = useCallback(async (url: string | null) => {
    const target = url ?? UPDATE_RELEASES_PAGE_URL;
    try {
      await openUrl(target);
    } catch {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  }, []);

  if (!updateAvailable || !latest) return null;
  if (bannerDismissedFor === latest.tag) return null;
  if (skippedVersion === latest.tag) return null;

  const label = latest.name?.trim() ? latest.name.trim() : latest.tag;

  return (
    <div
      data-update-banner="true"
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: 'min(560px, calc(100% - 32px))',
        padding: '8px 10px 8px 12px',
        borderRadius: 12,
        border: `1px solid ${accent}66`,
        background: 'rgba(12, 18, 28, 0.92)',
        color: '#e8f1ff',
        boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontSize: 12,
        pointerEvents: 'auto',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: accent,
          boxShadow: `0 0 10px ${accent}`,
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Update ready: {label}
          <span style={{ fontWeight: 400, opacity: 0.7 }}> · you have v{currentVersion}</span>
        </div>
        <div style={{ opacity: 0.65, fontSize: 11 }}>
          Checked {formatCheckedAt(useUpdateStore.getState().lastCheckedAt)} · {latest.prerelease ? 'pre-release' : 'stable'}
          {latest.assets.length > 0 ? ` · ${latest.assets.length} file${latest.assets.length === 1 ? '' : 's'}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => void openRelease(latest.installerUrl ?? latest.htmlUrl)}
          style={{
            border: `1px solid ${accent}`,
            background: accent,
            color: '#08131f',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Get it
        </button>
        <button
          type="button"
          title="Open release notes"
          onClick={() => void openRelease(latest.htmlUrl)}
          style={{
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'transparent',
            color: '#e8f1ff',
            borderRadius: 8,
            padding: '4px 9px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Notes
        </button>
        <button
          type="button"
          title={`Skip ${latest.tag} (won't nag again)`}
          onClick={() => skipVersion(latest.tag)}
          style={{
            border: '1px solid transparent',
            background: 'transparent',
            color: '#9fb2cc',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Skip
        </button>
        <button
          type="button"
          aria-label="Dismiss update banner"
          title="Dismiss until next release"
          onClick={dismissBanner}
          style={{
            border: '1px solid transparent',
            background: 'transparent',
            color: '#9fb2cc',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      {checking ? (
        <span style={{ fontSize: 11, opacity: 0.6 }}>checking…</span>
      ) : (
        <button
          type="button"
          title="Re-check now"
          onClick={() => void checkForUpdates({ manual: true })}
          style={{
            border: '1px solid transparent',
            background: 'transparent',
            color: '#9fb2cc',
            borderRadius: 8,
            padding: '4px 6px',
            fontSize: 11,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          re-check
        </button>
      )}
    </div>
  );
}
