/**
 * updateChecker — GitHub Releases update probe for GreebleFS.
 *
 * Pure logic, no store imports (store lives in src/store/updateStore.ts).
 * Hits the public GitHub Releases API and compares semver tags against the
 * running app version. Works from VPS and local builds alike since both can
 * reach api.github.com.
 */

export const UPDATE_REPO_OWNER = 'ephemara';
export const UPDATE_REPO_NAME = 'GreebleFS';
export const UPDATE_LATEST_API_URL =
  `https://api.github.com/repos/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases/latest`;
export const UPDATE_RELEASES_PAGE_URL =
  `https://github.com/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases`;
export const UPDATE_FALLBACK_VERSION = '0.1.0';
export const UPDATE_CHECK_TIMEOUT_MS = 15_000;

export interface UpdateReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number | null;
  contentType: string | null;
}

export interface UpdateReleaseInfo {
  tag: string;
  version: string;
  name: string | null;
  body: string | null;
  htmlUrl: string;
  publishedAt: string | null;
  prerelease: boolean;
  assets: UpdateReleaseAsset[];
  /** Best guess at the Windows installer (.exe setup) if present. */
  installerUrl: string | null;
  /** Best guess at the portable zip if present. */
  portableUrl: string | null;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latest: UpdateReleaseInfo | null;
  updateAvailable: boolean;
  checkedAt: number;
  error: string | null;
}

interface GitHubReleaseAssetJson {
  name?: string;
  browser_download_url?: string;
  size?: number;
  content_type?: string;
}

interface GitHubReleaseJson {
  tag_name?: string;
  name?: string | null;
  body?: string | null;
  html_url?: string;
  published_at?: string | null;
  prerelease?: boolean;
  assets?: GitHubReleaseAssetJson[];
}

/** Strip leading v/V, whitespace, and build metadata for comparison. */
export function normalizeVersionTag(tag: string | null | undefined): string {
  if (!tag) return '';
  return String(tag).trim().replace(/^[vV]/, '').split('+')[0].trim();
}

function parseNumericParts(version: string): number[] {
  const core = normalizeVersionTag(version).split('-')[0];
  if (!core) return [];
  return core.split('.').map(part => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/** Numeric semver compare. Returns -1 | 0 | 1 (a vs b). Non-numeric suffixes ignored. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseNumericParts(a);
  const pb = parseNumericParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

export function isUpdateAvailable(currentVersion: string, latestTag: string | null | undefined): boolean {
  if (!latestTag) return false;
  return compareVersions(normalizeVersionTag(currentVersion), normalizeVersionTag(latestTag)) === -1;
}

function pickAssetUrl(assets: UpdateReleaseAsset[], predicate: (name: string) => boolean): string | null {
  const hit = assets.find(a => predicate(a.name.toLowerCase()));
  return hit ? hit.browserDownloadUrl : null;
}

export function normalizeReleaseJson(json: GitHubReleaseJson): UpdateReleaseInfo | null {
  const tag = typeof json.tag_name === 'string' ? json.tag_name.trim() : '';
  if (!tag) return null;
  const assets: UpdateReleaseAsset[] = Array.isArray(json.assets)
    ? json.assets
      .filter(a => a && typeof a.browser_download_url === 'string')
      .map(a => ({
        name: typeof a.name === 'string' ? a.name : 'download',
        browserDownloadUrl: String(a.browser_download_url),
        size: typeof a.size === 'number' ? a.size : null,
        contentType: typeof a.content_type === 'string' ? a.content_type : null,
      }))
    : [];
  return {
    tag,
    version: normalizeVersionTag(tag),
    name: typeof json.name === 'string' ? json.name : null,
    body: typeof json.body === 'string' ? json.body : null,
    htmlUrl: typeof json.html_url === 'string' && json.html_url
      ? json.html_url
      : `${UPDATE_RELEASES_PAGE_URL}/tag/${encodeURIComponent(tag)}`,
    publishedAt: typeof json.published_at === 'string' ? json.published_at : null,
    prerelease: json.prerelease === true,
    assets,
    installerUrl: pickAssetUrl(assets, name => name.endsWith('-setup.exe') || (name.endsWith('.exe') && name.includes('setup'))),
    portableUrl: pickAssetUrl(assets, name => name.endsWith('.zip')),
  };
}

/** Resolve the running app version. Tauri first, fallback to bundled constant. */
export async function getCurrentAppVersion(): Promise<string> {
  try {
    const mod = await import('@tauri-apps/api/app').catch(() => null);
    if (mod && typeof (mod as { getVersion?: unknown }).getVersion === 'function') {
      const v = await (mod as { getVersion: () => Promise<string> }).getVersion().catch(() => null);
      if (v && String(v).trim()) return String(v).trim();
    }
  } catch {
    // fall through to bundled fallback (browser / tests)
  }
  return UPDATE_FALLBACK_VERSION;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchLatestRelease(timeoutMs = UPDATE_CHECK_TIMEOUT_MS): Promise<UpdateReleaseInfo | null> {
  const res = await fetchJsonWithTimeout(UPDATE_LATEST_API_URL, timeoutMs);
  if (res.status === 404) return null; // no releases published yet
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub releases API ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
  }
  const json = (await res.json()) as GitHubReleaseJson;
  return normalizeReleaseJson(json);
}

export async function checkForAppUpdates(
  currentVersionOverride?: string,
  timeoutMs = UPDATE_CHECK_TIMEOUT_MS,
): Promise<UpdateCheckResult> {
  const checkedAt = Date.now();
  const currentVersion = (currentVersionOverride ?? await getCurrentAppVersion()).trim() || UPDATE_FALLBACK_VERSION;
  try {
    const latest = await fetchLatestRelease(timeoutMs);
    if (!latest) {
      return { currentVersion, latest: null, updateAvailable: false, checkedAt, error: null };
    }
    return {
      currentVersion,
      latest,
      updateAvailable: isUpdateAvailable(currentVersion, latest.tag),
      checkedAt,
      error: null,
    };
  } catch (error) {
    return {
      currentVersion,
      latest: null,
      updateAvailable: false,
      checkedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
