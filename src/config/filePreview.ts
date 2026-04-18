export type ModelPreviewFormat = "fbx" | "glb" | "gltf" | "obj" | "stl";
export type ExplorerAudioExportFormatId = "mp3" | "wav" | "flac" | "ogg";

export interface ExplorerAudioExportFormatDefinition {
  id: ExplorerAudioExportFormatId;
  label: string;
  extension: string;
  mimeType: string;
}

export const EXPLORER_IMAGE_TILE_PREVIEW_CONFIG = {
  batchSize: 12,
  maxDimensionPx: 256,
  minStagePx: 36,
} as const;

export const MODEL_PREVIEW_PROXY_CONFIG = {
  maxDirectSourceBytes: 48 * 1024 * 1024,
  maxRenderableVertexCount: 350_000,
  maxRenderableTriangleCount: 700_000,
  maxRenderableMeshCount: 96,
  maxProxyMeshes: 32,
} as const;

const IMAGE_PREVIEW_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "tiff",
  "tif",
  "avif",
] as const;

const AUDIO_PREVIEW_MIME_TYPE_BY_EXTENSION = {
  aac: "audio/aac",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  alac: "audio/mp4",
  amr: "audio/amr",
  caf: "audio/x-caf",
  flac: "audio/flac",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  mid: "audio/midi",
  midi: "audio/midi",
  mka: "audio/x-matroska",
  mp3: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/ogg; codecs=opus",
  wav: "audio/wav",
  wave: "audio/wav",
  weba: "audio/webm",
  wma: "audio/x-ms-wma",
} as const satisfies Record<string, string>;

export const EXPLORER_AUDIO_EXPORT_FORMATS: readonly ExplorerAudioExportFormatDefinition[] =
  [
    { id: "mp3", label: "MP3", extension: "mp3", mimeType: "audio/mpeg" },
    { id: "wav", label: "WAV", extension: "wav", mimeType: "audio/wav" },
    { id: "flac", label: "FLAC", extension: "flac", mimeType: "audio/flac" },
    { id: "ogg", label: "Ogg", extension: "ogg", mimeType: "audio/ogg" },
  ] as const;

export const DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID: ExplorerAudioExportFormatId =
  "wav";

const DIRECT_AUDIO_PLAYBACK_EXTENSION_SET = new Set<string>([
  "mp3",
  "wav",
  "wave",
  "aif",
  "aiff",
  "ogg",
  "oga",
  "opus",
  "flac",
  "m4a",
  "m4b",
  "weba",
]);

const VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION = {
  "3g2": "video/3gpp2",
  "3gp": "video/3gpp",
  asf: "video/x-ms-asf",
  avi: "video/x-msvideo",
  flv: "video/x-flv",
  m2ts: "video/mp2t",
  m2v: "video/mpeg",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  mpe: "video/mpeg",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  mts: "video/mp2t",
  ogv: "video/ogg",
  qt: "video/quicktime",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
} as const satisfies Record<string, string>;

const EXECUTABLE_EXTENSIONS = [
  "exe",
  "msi",
  "bat",
  "cmd",
  "ps1",
  "sh",
  "app",
  "dmg",
] as const;

const EDITABLE_TEXT_EXTENSIONS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "rs",
  "py",
  "go",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "java",
  "rb",
  "php",
  "swift",
  "kt",
  "vue",
  "html",
  "css",
  "scss",
  "json",
  "toml",
  "yaml",
  "yml",
  "xml",
  "md",
  "sh",
  "ps1",
  "bat",
  "lua",
  "sql",
  "zig",
  "env",
  "dart",
  "glsl",
  "wgsl",
  "hlsl",
  "ini",
  "txt",
  "kain",
  "ink",
  "log",
] as const;

export const MODEL_PREVIEW_FORMAT_BY_EXTENSION: Record<
  string,
  ModelPreviewFormat
> = {
  fbx: "fbx",
  glb: "glb",
  gltf: "gltf",
  obj: "obj",
  stl: "stl",
};

const MONACO_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  rs: "rust",
  py: "python",
  go: "go",
  c: "c",
  cpp: "cpp",
  h: "cpp",
  cs: "csharp",
  java: "java",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  vue: "html",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  md: "markdown",
  sh: "shell",
  ps1: "powershell",
  bat: "bat",
  lua: "lua",
  sql: "sql",
  zig: "zig",
  ini: "ini",
  env: "shell",
  dart: "dart",
  glsl: "glsl",
  wgsl: "wgsl",
  hlsl: "hlsl",
  kain: "plaintext",
  ink: "plaintext",
  log: "plaintext",
};

const IMAGE_PREVIEW_EXTENSION_SET = new Set<string>(IMAGE_PREVIEW_EXTENSIONS);
const AUDIO_PREVIEW_EXTENSION_SET = new Set<string>(
  Object.keys(AUDIO_PREVIEW_MIME_TYPE_BY_EXTENSION),
);
const VIDEO_PREVIEW_EXTENSION_SET = new Set<string>(
  Object.keys(VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION),
);
const EXECUTABLE_EXTENSION_SET = new Set<string>(EXECUTABLE_EXTENSIONS);
const EDITABLE_TEXT_EXTENSION_SET = new Set<string>(EDITABLE_TEXT_EXTENSIONS);

const FONT_PREVIEW_EXTENSIONS = [
  "ttf",
  "otf",
  "woff",
  "woff2",
] as const;

const FONT_PREVIEW_EXTENSION_SET = new Set<string>(FONT_PREVIEW_EXTENSIONS);
const PDF_PREVIEW_EXTENSION_SET = new Set<string>(["pdf"]);

const SQLITE_PREVIEW_EXTENSIONS = [
  "sqlite",
  "sqlite3",
  "db",
] as const;

const SQLITE_PREVIEW_EXTENSION_SET = new Set<string>(SQLITE_PREVIEW_EXTENSIONS);

export function isImagePreviewExtension(extension: string): boolean {
  return IMAGE_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isFontPreviewExtension(extension: string): boolean {
  return FONT_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isPdfPreviewExtension(extension: string): boolean {
  return PDF_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isSqlitePreviewExtension(extension: string): boolean {
  return SQLITE_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isExecutableExtension(extension: string): boolean {
  return EXECUTABLE_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isAudioPreviewExtension(extension: string): boolean {
  return AUDIO_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isVideoPreviewExtension(extension: string): boolean {
  return VIDEO_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function getAudioPreviewMimeType(extension: string): string | null {
  const normalizedExtension = normalizeExtension(extension);
  return normalizedExtension in AUDIO_PREVIEW_MIME_TYPE_BY_EXTENSION
    ? AUDIO_PREVIEW_MIME_TYPE_BY_EXTENSION[
        normalizedExtension as keyof typeof AUDIO_PREVIEW_MIME_TYPE_BY_EXTENSION
      ]
    : null;
}

export function getExplorerAudioExportFormatDefinition(
  formatId: string,
): ExplorerAudioExportFormatDefinition | null {
  const normalizedId = normalizeExtension(formatId);
  return (
    EXPLORER_AUDIO_EXPORT_FORMATS.find(
      (format) => format.id === normalizedId,
    ) ?? null
  );
}

export function isDirectAudioPreviewExtension(extension: string): boolean {
  return DIRECT_AUDIO_PLAYBACK_EXTENSION_SET.has(normalizeExtension(extension));
}

export function getVideoPreviewMimeType(extension: string): string | null {
  const normalizedExtension = normalizeExtension(extension);
  return normalizedExtension in VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION
    ? VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION[
        normalizedExtension as keyof typeof VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION
      ]
    : null;
}

export function getModelPreviewFormat(
  extension: string,
): ModelPreviewFormat | null {
  return (
    MODEL_PREVIEW_FORMAT_BY_EXTENSION[normalizeExtension(extension)] ?? null
  );
}

export function getMonacoLanguage(extension: string): string {
  return (
    MONACO_LANGUAGE_BY_EXTENSION[normalizeExtension(extension)] ?? "plaintext"
  );
}

export function isEditableTextExtension(
  extension: string,
  size: number,
): boolean {
  const normalizedExtension = normalizeExtension(extension);
  if (!normalizedExtension) {
    return size < 2 * 1024 * 1024;
  }
  if (
    isImagePreviewExtension(normalizedExtension) ||
    isExecutableExtension(normalizedExtension)
  ) {
    return false;
  }
  if (isAudioPreviewExtension(normalizedExtension)) {
    return false;
  }
  if (isVideoPreviewExtension(normalizedExtension)) {
    return false;
  }
  if (isFontPreviewExtension(normalizedExtension)) {
    return false;
  }
  if (isPdfPreviewExtension(normalizedExtension)) {
    return false;
  }
  if (getModelPreviewFormat(normalizedExtension)) {
    return false;
  }
  return (
    EDITABLE_TEXT_EXTENSION_SET.has(normalizedExtension) ||
    size < 2 * 1024 * 1024
  );
}

function normalizeExtension(extension: string): string {
  return extension.trim().replace(/^\./, "").toLowerCase();
}
