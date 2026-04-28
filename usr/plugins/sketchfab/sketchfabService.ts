const SKETCHFAB_API_BASE_URL = 'https://api.sketchfab.com/v3';
const DEFAULT_RESULTS_PER_PAGE = 24;

export interface SketchfabAuthorSummary {
  username: string;
  displayName: string;
  profileUrl: string;
}

export interface SketchfabLicenseSummary {
  label: string;
  requirements: string[];
  url: string | null;
}

export interface SketchfabModelSummary {
  uid: string;
  name: string;
  description: string;
  viewerUrl: string;
  thumbnailUrl: string | null;
  author: SketchfabAuthorSummary;
  license: SketchfabLicenseSummary | null;
  vertexCount: number | null;
  faceCount: number | null;
  animationCount: number | null;
  archivesAvailable: string[];
}

export interface SketchfabSearchResult {
  models: SketchfabModelSummary[];
  totalCount: number;
  nextCursor: string | null;
  prevCursor: string | null;
}

export interface SketchfabDownloadAsset {
  format: 'glb' | 'gltf' | 'original';
  url: string;
  fileName: string;
  fileExtension: string;
  archive: boolean;
}

export interface SketchfabSearchOptions {
  accessToken?: string;
  count?: number;
  cursor?: string | null;
}

export async function searchSketchfabModels(
  query: string,
  options: SketchfabSearchOptions = {},
): Promise<SketchfabSearchResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      models: [],
      totalCount: 0,
      nextCursor: null,
      prevCursor: null,
    };
  }

  const searchUrl = new URL(`${SKETCHFAB_API_BASE_URL}/search`);
  searchUrl.searchParams.set('type', 'models');
  searchUrl.searchParams.set('q', trimmedQuery);
  searchUrl.searchParams.set('downloadable', 'true');
  searchUrl.searchParams.set('sort_by', '-relevance');
  searchUrl.searchParams.set('count', String(clampResultsPerPage(options.count ?? DEFAULT_RESULTS_PER_PAGE)));
  if (options.cursor) {
    searchUrl.searchParams.set('cursor', options.cursor);
  }

  const response = await fetch(searchUrl, {
    headers: buildSketchfabHeaders(options.accessToken),
  });
  if (!response.ok) {
    throw new Error(await extractSketchfabErrorMessage(response, 'Sketchfab search failed.'));
  }

  const data = await response.json() as Record<string, unknown>;
  const results = Array.isArray(data.results) ? data.results : [];

  return {
    models: results.map(mapSketchfabSearchModel).filter((model): model is SketchfabModelSummary => model != null),
    totalCount: typeof data.totalResults === 'number' ? data.totalResults : results.length,
    nextCursor: getCursorValue(data.cursors, 'next'),
    prevCursor: getCursorValue(data.cursors, 'previous'),
  };
}

export async function requestSketchfabDownloadAsset(
  modelUid: string,
  accessToken: string,
): Promise<SketchfabDownloadAsset> {
  const trimmedModelUid = modelUid.trim();
  const trimmedAccessToken = accessToken.trim();
  if (!trimmedModelUid) {
    throw new Error('Sketchfab model uid is required.');
  }
  if (!trimmedAccessToken) {
    throw new Error('Sketchfab OAuth access token is required for downloads.');
  }

  const response = await fetch(`${SKETCHFAB_API_BASE_URL}/models/${encodeURIComponent(trimmedModelUid)}/download`, {
    headers: buildSketchfabHeaders(trimmedAccessToken),
  });
  if (!response.ok) {
    throw new Error(await extractSketchfabErrorMessage(
      response,
      'Sketchfab download request failed.',
    ));
  }

  const data = await response.json() as Record<string, unknown>;
  const selectedAsset = selectSketchfabDownloadAsset(data);
  if (!selectedAsset) {
    throw new Error('Sketchfab did not return a downloadable GLB, archive, or original source payload.');
  }

  return selectedAsset;
}

function mapSketchfabSearchModel(value: unknown): SketchfabModelSummary | null {
  const record = asRecord(value);
  const uid = asString(record?.uid);
  const name = asString(record?.name);
  if (!uid || !name) {
    return null;
  }

  const authorRecord = asRecord(record.user);
  const licenseRecord = asRecord(record.license);
  const archivesRecord = asRecord(record.archives);

  return {
    uid,
    name,
    description: asString(record.description),
    viewerUrl: toAbsoluteSketchfabUrl(asString(record.viewerUrl) || asString(record.viewerUrl as string)),
    thumbnailUrl: resolveSketchfabThumbnailUrl(record.thumbnails),
    author: {
      username: asString(authorRecord?.username) || 'unknown',
      displayName: asString(authorRecord?.displayName) || asString(authorRecord?.username) || 'Unknown creator',
      profileUrl: toAbsoluteSketchfabUrl(asString(authorRecord?.profileUrl) || asString(authorRecord?.uri)),
    },
    license: licenseRecord
      ? {
        label: asString(licenseRecord.label) || 'License unavailable',
        requirements: asStringArray(licenseRecord.requirements),
        url: asString(licenseRecord.url) || null,
      }
      : null,
    vertexCount: asNumber(record.vertexCount),
    faceCount: asNumber(record.faceCount),
    animationCount: asNumber(record.animationCount),
    archivesAvailable: Object.keys(archivesRecord ?? {}),
  };
}

function selectSketchfabDownloadAsset(data: Record<string, unknown>): SketchfabDownloadAsset | null {
  const glbAsset = toSketchfabDownloadAsset('glb', data.glb, false, 'glb');
  if (glbAsset) {
    return glbAsset;
  }

  const gltfArchive = toSketchfabDownloadAsset('gltf', data.gltf, true, 'zip');
  if (gltfArchive) {
    return gltfArchive;
  }

  return toSketchfabDownloadAsset('original', data.original, true, undefined);
}

function toSketchfabDownloadAsset(
  format: SketchfabDownloadAsset['format'],
  value: unknown,
  archive: boolean,
  fallbackExtension?: string,
): SketchfabDownloadAsset | null {
  const record = asRecord(value);
  const url = asString(record?.url);
  if (!url) {
    return null;
  }

  const suggestedFileName = asString(record?.filename) || deriveFileNameFromUrl(url);
  const fileExtension = inferFileExtension(suggestedFileName, fallbackExtension);
  const fileName = suggestedFileName || `sketchfab-${format}.${fileExtension}`;

  return {
    format,
    url,
    fileName,
    fileExtension,
    archive,
  };
}

function resolveSketchfabThumbnailUrl(value: unknown): string | null {
  const thumbnailsRecord = asRecord(value);
  const images = Array.isArray(thumbnailsRecord?.images) ? thumbnailsRecord.images : [];
  const bestThumbnail = images
    .map(entry => ({
      url: asString(asRecord(entry)?.url),
      width: asNumber(asRecord(entry)?.width) ?? 0,
    }))
    .filter((entry): entry is { url: string; width: number } => Boolean(entry.url))
    .sort((left, right) => right.width - left.width)[0];

  return bestThumbnail?.url ?? null;
}

function deriveFileNameFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const pathLeaf = parsedUrl.pathname.split('/').filter(Boolean).pop() ?? '';
    return pathLeaf.trim();
  } catch {
    return '';
  }
}

function inferFileExtension(fileName: string, fallbackExtension = 'bin'): string {
  const lowerName = fileName.toLowerCase();
  const extension = lowerName.split('.').pop()?.trim();
  if (extension && extension !== lowerName) {
    return extension;
  }
  return fallbackExtension;
}

function buildSketchfabHeaders(accessToken?: string): HeadersInit {
  const trimmedAccessToken = accessToken?.trim();
  return trimmedAccessToken
    ? { Authorization: `Bearer ${trimmedAccessToken}` }
    : {};
}

function clampResultsPerPage(value: number): number {
  return Math.min(Math.max(Math.round(value), 1), 24);
}

function getCursorValue(value: unknown, key: 'next' | 'previous'): string | null {
  const record = asRecord(value);
  const cursor = asString(record?.[key]);
  return cursor || null;
}

function toAbsoluteSketchfabUrl(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }
  if (trimmedValue.startsWith('/')) {
    return `https://sketchfab.com${trimmedValue}`;
  }
  return trimmedValue;
}

async function extractSketchfabErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const data = await response.json() as Record<string, unknown>;
    const detail = asString(data.detail)
      || asString(data.error)
      || asString(data.message)
      || asString((Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : null));
    if (detail) {
      return detail;
    }
  } catch {
    // Ignore JSON parsing failures.
  }

  if (response.status === 401) {
    return 'Sketchfab rejected the access token. Use a valid OAuth access token.';
  }
  if (response.status === 403) {
    return 'Sketchfab denied this download. The selected model may require a different account permission.';
  }
  return fallbackMessage;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map(entry => entry.trim())
    : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
