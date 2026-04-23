import type {
  MobileShareEntry,
  MobileShareListingResponse,
  MobileShareThemeSnapshot,
} from "./types";

export const MOBILE_PAGE_SIZE = 160;

function encodeRelativePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildMobileFileUrl(relativePath: string): string {
  const encoded = encodeRelativePath(relativePath);
  return encoded.length > 0 ? `/files/${encoded}` : "/files";
}

export function guessMediaKind(entry: MobileShareEntry): "image" | "video" | "audio" | null {
  const extension = entry.extension.toLowerCase();
  if (
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "bmp",
      "ico",
      "avif",
      "tiff",
      "tif",
    ].includes(extension)
  ) {
    return "image";
  }

  if (
    [
      "mp4",
      "m4v",
      "mov",
      "webm",
      "ogv",
      "mkv",
      "avi",
      "wmv",
      "mpeg",
      "mpg",
    ].includes(extension)
  ) {
    return "video";
  }

  if (
    [
      "mp3",
      "wav",
      "flac",
      "ogg",
      "opus",
      "m4a",
      "aac",
      "aiff",
      "aif",
      "weba",
    ].includes(extension)
  ) {
    return "audio";
  }

  return null;
}

export async function fetchMobileListing(
  path: string,
  offset: number,
  limit: number = MOBILE_PAGE_SIZE,
): Promise<MobileShareListingResponse> {
  const params = new URLSearchParams();
  if (path.length > 0) {
    params.set("path", path);
  }
  params.set("offset", String(offset));
  params.set("limit", String(limit));

  const response = await fetch(`/api/list?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load mobile listing (${response.status})`);
  }

  return (await response.json()) as MobileShareListingResponse;
}

export async function fetchMobileThemeSnapshot(): Promise<MobileShareThemeSnapshot> {
  const response = await fetch('/api/theme', {
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load mobile theme (${response.status})`);
  }

  return (await response.json()) as MobileShareThemeSnapshot;
}
