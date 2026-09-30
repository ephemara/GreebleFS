/**
 * UpdatesSettingsSection — System → Updates card.
 * Self-contained: reads useUpdateStore directly so no prop-drilling through
 * the 18k-line legacy settings page. Embed at the top of SystemSettingsSection.
 */

import { useCallback, type CSSProperties } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { UPDATE_RELEASES_PAGE_URL } from '../../../runtime/updateChecker';
import {
  UPDATE_AUTO_CHECK_INTERVALS,
  useUpdateStore,
  type UpdateAutoCheckIntervalId,
} from '../../../store/updateStore';
import {
  SettingsCompactActionButton,
  SettingsCompactSection,
  SettingsControlRow,
  SettingsIconActionButton,
  SettingsInlineNotice,
  SettingsMetricStrip,
  ThemeBadge,
} from '../SettingsPrimitives';
import { Download, Loader2, RefreshCw } from '@/components/AppIcons';

function formatCheckedAt(ts: number | null): string {
  if (!ts) return 'never checked';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function formatBytes(size: number | null): string {
  if (size == null || !Number.isFinite(size)) return 'size n/a';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdatesSettingsSection({
  accent,
  border,
  settingsSelectStyle,
}: {
  accent: string;
  border: string;
  text: string;
  muted: string;
  settingsSelectStyle: CSSProperties;
}) {
  const currentVersion = useUpdateStore(s => s.currentVersion);
  const latest = useUpdateStore(s => s.latest);
  const updateAvailable = useUpdateStore(s => s.updateAvailable);
  const checking = useUpdateStore(s => s.checking);
  const lastCheckedAt = useUpdateStore(s => s.lastCheckedAt);
  const lastError = useUpdateStore(s => s.lastError);
  const autoCheckEnabled = useUpdateStore(s => s.autoCheckEnabled);
  const autoCheckIntervalId = useUpdateStore(s => s.autoCheckIntervalId);
  const skippedVersion = useUpdateStore(s => s.skippedVersion);

  const checkForUpdates = useUpdateStore(s => s.checkForUpdates);
  const skipVersion = useUpdateStore(s => s.skipVersion);
  const clearSkipped = useUpdateStore(s => s.clearSkipped);
  const setAutoCheckEnabled = useUpdateStore(s => s.setAutoCheckEnabled);
  const setAutoCheckInterval = useUpdateStore(s => s.setAutoCheckInterval);

  const openExternal = useCallback(async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const latestLabel = latest ? (latest.name?.trim() ? latest.name.trim() : latest.tag) : 'none yet';
  const tone = updateAvailable ? 'warning' : lastError ? 'danger' : 'success';
  const statusLine = checking
    ? 'Checking GitHub releases…'
    : lastError
      ? `Last check failed: ${lastError}`
      : latest == null
        ? `No releases seen yet · last checked ${formatCheckedAt(lastCheckedAt)}`
        : updateAvailable
          ? `${latestLabel} is ready — you have v${currentVersion}`
          : `You're on the latest (v${currentVersion}) · checked ${formatCheckedAt(lastCheckedAt)}`;

  return (
    <SettingsCompactSection
      title="Updates"
      subtitle={`v${currentVersion} · auto-check ${autoCheckEnabled ? 'on' : 'off'}`}
      actions={(
        <>
          <SettingsIconActionButton
            aria-label="Check for updates now"
            title="Check for updates now"
            onClick={() => void checkForUpdates({ manual: true })}
            disabled={checking}
            active={checking}
            accent={accent}
          >
            {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </SettingsIconActionButton>
          {updateAvailable && latest ? (
            <SettingsCompactActionButton
              onClick={() => void openExternal(latest.installerUrl ?? latest.htmlUrl)}
              accent={accent}
              active
              title="Open the release download"
            >
              <Download size={12} />
              <span className="truncate">Get {latest.tag}</span>
            </SettingsCompactActionButton>
          ) : null}
        </>
      )}
    >
      <SettingsMetricStrip
        items={[
          {
            id: 'current',
            label: 'Installed',
            value: `v${currentVersion}`,
            tone: 'default',
          },
          {
            id: 'latest',
            label: 'Latest',
            value: latest ? latest.tag : 'unknown',
            tone: updateAvailable ? 'accent' : 'default',
          },
          {
            id: 'status',
            label: 'Status',
            value: checking ? 'checking' : updateAvailable ? 'update ready' : lastError ? 'error' : 'up to date',
            tone: updateAvailable ? 'accent' : 'default',
          },
        ]}
      />

      <SettingsInlineNotice tone={tone} className="mx-3 my-2">
        {statusLine}
      </SettingsInlineNotice>

      {latest ? (
        <SettingsControlRow
          label={latestLabel}
          detail={[
            latest.publishedAt ? new Date(latest.publishedAt).toLocaleDateString() : null,
            latest.prerelease ? 'pre-release' : 'stable',
            `${latest.assets.length} file${latest.assets.length === 1 ? '' : 's'}`,
          ].filter(Boolean).join(' · ')}
          control={<ThemeBadge label={latest.tag} active={updateAvailable} />}
          action={(
            <button
              type="button"
              onClick={() => void openExternal(latest.htmlUrl)}
              style={{ fontSize: 11, textDecoration: 'underline', opacity: 0.8, cursor: 'pointer' }}
            >
              notes
            </button>
          )}
        />
      ) : null}

      {latest && latest.assets.length > 0 ? (
        <div
          className="flex min-w-0 flex-wrap gap-1.5 border-t px-3 py-2"
          style={{ borderColor: border }}
        >
          {(latest.installerUrl ? [{ name: 'Windows setup', url: latest.installerUrl, size: null }] : []).map(f => (
            <button
              key={f.name}
              type="button"
              onClick={() => void openExternal(f.url!)}
              style={{ fontSize: 11, textDecoration: 'underline', cursor: 'pointer', opacity: 0.9 }}
            >
              {f.name}
            </button>
          ))}
          {latest.assets.slice(0, 6).map(a => (
            <ThemeBadge
              key={`${a.name}-${a.browserDownloadUrl}`}
              label={`${a.name} · ${formatBytes(a.size)}`}
            />
          ))}
          {latest.assets.length > 6 ? <ThemeBadge label={`+${latest.assets.length - 6} more`} /> : null}
        </div>
      ) : null}

      {updateAvailable && latest ? (
        <div className="flex flex-wrap gap-1.5 border-t px-3 py-2" style={{ borderColor: border }}>
          <SettingsCompactActionButton
            onClick={() => void openExternal(latest.htmlUrl)}
            accent={accent}
            active
          >
            <Download size={12} />
            <span className="truncate">Release notes</span>
          </SettingsCompactActionButton>
          <SettingsCompactActionButton
            onClick={() => skipVersion(latest.tag)}
            accent={accent}
            title={`Skip ${latest.tag} — won't nag again`}
          >
            <span className="truncate">Skip {latest.tag}</span>
          </SettingsCompactActionButton>
        </div>
      ) : null}

      {skippedVersion ? (
        <SettingsInlineNotice tone="muted" className="mx-3 my-2">
          Skipped {skippedVersion}.{' '}
          <button
            type="button"
            onClick={clearSkipped}
            style={{ textDecoration: 'underline', cursor: 'pointer' }}
          >
            Unskip
          </button>
        </SettingsInlineNotice>
      ) : null}

      <SettingsControlRow
        label="Auto-check"
        detail="Ping GitHub releases in the background + OS notification on new tags"
        control={(
          <input
            type="checkbox"
            checked={autoCheckEnabled}
            onChange={e => setAutoCheckEnabled(e.target.checked)}
          />
        )}
      />
      <SettingsControlRow
        label="Frequency"
        detail="how often to poll when the app is open"
        control={(
          <select
            aria-label="Update check frequency"
            value={autoCheckIntervalId}
            disabled={!autoCheckEnabled}
            onChange={e => setAutoCheckInterval(e.target.value as UpdateAutoCheckIntervalId)}
            className="w-full max-w-xs"
            style={{ ...settingsSelectStyle, borderColor: border }}
          >
            {UPDATE_AUTO_CHECK_INTERVALS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        )}
      />
      <div className="border-t px-3 py-2 text-[10px] opacity-60" style={{ borderColor: border }}>
        Source: <button type="button" onClick={() => void openExternal(UPDATE_RELEASES_PAGE_URL)} style={{ textDecoration: 'underline', cursor: 'pointer' }}>ephemara/GreebleFS releases</button>
        {' '}· last checked {formatCheckedAt(lastCheckedAt)}
      </div>
    </SettingsCompactSection>
  );
}
