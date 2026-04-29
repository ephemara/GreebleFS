import type {
  MobileLayoutSettings,
  MobileIndexPicturesResponse,
  MobilePluginBackendRunRequest,
  MobilePluginBackendRunResponse,
  MobilePluginCatalogResponse,
  MobilePreviewResponse,
  MobileSearchResponse,
  MobileSearchStatusResponse,
  MobileShareListingResponse,
  MobileShareThemeSnapshot,
  MobileUploadResponse,
} from "./types";

export const MOBILE_PAGE_SIZE = 160;
export const MOBILE_SEARCH_DEBOUNCE_MS = 160;

export interface MobileBrowseRequestOptions
  extends Pick<
    MobileLayoutSettings,
    "showHiddenFiles" | "sortBy" | "sortOrder" | "directoriesFirst"
  > {}

function encodeRelativePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildPathQuery(path: string): string {
  return `path=${encodeURIComponent(path)}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export function buildMobileFileUrl(relativePath: string): string {
  const encoded = encodeRelativePath(relativePath);
  return encoded.length > 0 ? `/files/${encoded}` : "/files";
}

export function buildMobileThumbnailUrl(
  relativePath: string,
  width = 160,
  height = 160,
): string {
  return `/api/thumbnail?${buildPathQuery(relativePath)}&w=${width}&h=${height}`;
}

export async function fetchMobilePluginCatalog(): Promise<MobilePluginCatalogResponse> {
  return fetchJson<MobilePluginCatalogResponse>("/api/plugins", {
    headers: {
      "Cache-Control": "no-cache",
    },
  });
}

export async function runMobilePluginBackend(
  pluginId: string,
  request: MobilePluginBackendRunRequest,
): Promise<MobilePluginBackendRunResponse> {
  return fetchJson<MobilePluginBackendRunResponse>(
    `/api/plugins/${encodeURIComponent(pluginId)}/backend`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
}

export async function fetchMobileListing(
  path: string,
  offset: number,
  options: MobileBrowseRequestOptions,
  limit: number = MOBILE_PAGE_SIZE,
): Promise<MobileShareListingResponse> {
  const params = new URLSearchParams();
  if (path.length > 0) {
    params.set("path", path);
  }
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  params.set("showHiddenFiles", String(options.showHiddenFiles));
  params.set("sortBy", options.sortBy);
  params.set("sortOrder", options.sortOrder);
  params.set("directoriesFirst", String(options.directoriesFirst));

  return fetchJson<MobileShareListingResponse>(`/api/list?${params.toString()}`);
}

export async function fetchMobileThemeSnapshot(): Promise<MobileShareThemeSnapshot> {
  return fetchJson<MobileShareThemeSnapshot>("/api/theme", {
    headers: {
      "Cache-Control": "no-cache",
    },
  });
}

export async function fetchMobileSearchStatus(): Promise<MobileSearchStatusResponse> {
  return fetchJson<MobileSearchStatusResponse>("/api/search/status", {
    headers: {
      "Cache-Control": "no-cache",
    },
  });
}

export async function fetchMobileSearchResults(
  query: string,
  options: {
    showHiddenFiles: boolean;
    limit?: number;
  },
): Promise<MobileSearchResponse> {
  const params = new URLSearchParams({
    query,
    limit: String(options.limit ?? 48),
    showHiddenFiles: String(options.showHiddenFiles),
  });
  return fetchJson<MobileSearchResponse>(`/api/search?${params.toString()}`);
}

export async function fetchMobileIndexPictures(options: {
  query?: string | null;
  limit?: number;
  offset?: number;
  showHiddenFiles?: boolean;
} = {}): Promise<MobileIndexPicturesResponse> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 96),
    offset: String(options.offset ?? 0),
  });
  if (options.query?.trim()) {
    params.set("query", options.query.trim());
  }
  if (typeof options.showHiddenFiles === "boolean") {
    params.set("showHiddenFiles", String(options.showHiddenFiles));
  }
  return fetchJson<MobileIndexPicturesResponse>(`/api/index/pictures?${params.toString()}`);
}

export async function startMobileSearchScan(): Promise<void> {
  const response = await fetch("/api/search/scan", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to start search scan (${response.status})`);
  }
}

export async function cancelMobileSearchScan(): Promise<void> {
  const response = await fetch("/api/search/cancel", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel search scan (${response.status})`);
  }
}

export async function fetchMobilePreview(
  relativePath: string,
  options?: {
    showHiddenFiles?: boolean;
  },
): Promise<MobilePreviewResponse> {
  const params = new URLSearchParams({
    path: relativePath,
  });
  if (typeof options?.showHiddenFiles === "boolean") {
    params.set("showHiddenFiles", String(options.showHiddenFiles));
  }
  return fetchJson<MobilePreviewResponse>(`/api/preview?${params.toString()}`);
}

export interface MobileUploadTask {
  cancel: () => void;
  promise: Promise<MobileUploadResponse>;
}

export function startMobileUpload(args: {
  path: string;
  files: File[];
  onProgress?: (progress: {
    loaded: number;
    total: number;
    fraction: number;
  }) => void;
}): MobileUploadTask {
  const formData = new FormData();
  for (const file of args.files) {
    formData.append("files", file, file.name);
  }

  const request = new XMLHttpRequest();
  const uploadUrl = `/api/upload?${buildPathQuery(args.path)}`;
  request.open("POST", uploadUrl, true);
  request.setRequestHeader("Accept", "application/json");

  const promise = new Promise<MobileUploadResponse>((resolve, reject) => {
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }
      args.onProgress?.({
        loaded: event.loaded,
        total: event.total,
        fraction: event.total > 0 ? event.loaded / event.total : 0,
      });
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText) as MobileUploadResponse);
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error("Failed to decode mobile upload response."),
          );
        }
        return;
      }

      reject(
        new Error(`Failed to upload to the mobile share (${request.status})`),
      );
    });

    request.addEventListener("error", () => {
      reject(new Error("Mobile upload failed due to a network error."));
    });

    request.addEventListener("abort", () => {
      reject(new Error("Mobile upload canceled."));
    });
  });

  request.send(formData);

  return {
    cancel: () => {
      request.abort();
    },
    promise,
  };
}
