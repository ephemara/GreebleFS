import {
  getSpreadsheetFileKind,
  isSpreadsheetPreviewExtension,
} from "./spreadsheet";

export { getSpreadsheetFileKind, isSpreadsheetPreviewExtension };

export type ModelPreviewFormat = "fbx" | "glb" | "gltf" | "obj" | "stl";
export type ExplorerAudioExportFormatId = "mp3" | "wav" | "flac" | "ogg";
export type ShaderPreviewFormat = "wgsl" | "hlsl" | "spv";
export type ExplorerExecutableScriptRunner =
  | "batch"
  | "powershell"
  | "sh"
  | "bash"
  | "zsh"
  | "fish"
  | "ksh"
  | "direct";

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

export const MODEL_PREVIEW_SOURCE_CONFIG = {
  maxRootSourceBytes: 128 * 1024 * 1024,
  maxGltfExternalResourceBytes: 128 * 1024 * 1024,
} as const;

export const MODEL_PREVIEW_PROXY_CONFIG = {
  maxDirectSourceBytes: MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
  maxRenderableVertexCount: 2_000_000,
  maxRenderableTriangleCount: 4_000_000,
  maxRenderableMeshCount: 192,
  maxProxyMeshes: 48,
} as const;

export const MODEL_THUMBNAIL_RENDER_CONFIG = {
  backgroundColor: "#090d12",
  ambientIntensity: 1.15,
  keyLightIntensity: 1.35,
  fillLightIntensity: 0.45,
  cameraFov: 42,
  maxPixelRatio: 1.5,
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

const PYTHON_PREVIEW_EXTENSIONS = ["py", "pyw"] as const;

const IMAGE_EDITOR_CONTENT_TYPE_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const satisfies Record<string, string>;

const AUDIO_PREVIEW_MIME_TYPE_BY_EXTENSION = {
  aac: "audio/aac",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  aifc: "audio/aiff",
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
  "aifc",
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

const EXECUTABLE_SCRIPT_RUNNER_BY_EXTENSION = {
  bat: "batch",
  cmd: "batch",
  ps1: "powershell",
  sh: "sh",
  bash: "bash",
  zsh: "zsh",
  fish: "fish",
  ksh: "ksh",
  command: "sh",
} as const satisfies Record<
  string,
  Exclude<ExplorerExecutableScriptRunner, "direct">
>;

const EXECUTABLE_BINARY_EXTENSIONS = [
  "exe",
  "msi",
  "com",
  "app",
  "dmg",
] as const;

const EDITABLE_TEXT_EXTENSIONS = [
  // Web / JS ecosystem
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "vue",
  "svelte",
  "astro",
  "html",
  "htm",
  "css",
  "scss",
  "sass",
  "less",
  // Systems
  "rs",
  "c",
  "cpp",
  "cc",
  "cxx",
  "h",
  "hpp",
  "hxx",
  "zig",
  "d",
  "nim",
  "odin",
  "v",
  // JVM / managed
  "java",
  "kt",
  "kts",
  "cs",
  "fs",
  "fsi",
  "fsx",
  "vb",
  "scala",
  "groovy",
  "clj",
  "cljs",
  "cljc",
  // Scripting
  "py",
  "pyw",
  "rb",
  "rbw",
  "php",
  "php3",
  "php4",
  "php5",
  "pl",
  "pm",
  "t",
  "lua",
  "tcl",
  "r",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ksh",
  "ps1",
  "bat",
  "cmd",
  // Functional
  "hs",
  "lhs",
  "ml",
  "mli",
  "mll",
  "mly",
  "purs",
  "elm",
  "ex",
  "exs",
  "erl",
  "hrl",
  "lisp",
  "el",
  "scm",
  "rkt",
  "ml",
  "ocaml",
  "f",
  "f90",
  "f95",
  "for",
  // Go / Swift / Dart etc.
  "go",
  "swift",
  "dart",
  // Shader
  "glsl",
  "vert",
  "frag",
  "comp",
  "metal",
  // Data / config
  "json",
  "jsonc",
  "json5",
  "jsonl",
  "toml",
  "yaml",
  "yml",
  "xml",
  "ini",
  "cfg",
  "conf",
  "env",
  "properties",
  "editorconfig",
  "gitignore",
  "gitattributes",
  "hcl",
  "tf",
  "tfvars",
  "nix",
  "dhall",
  "ron",
  "kdl",
  "cue",
  "pkl",
  "graphql",
  "gql",
  "proto",
  "fbs",
  "capnp",
  // Docs / markup
  "md",
  "mdx",
  "markdown",
  "rst",
  "adoc",
  "tex",
  "latex",
  "txt",
  "log",
  "csv",
  "tsv",
  // DB / query
  "sql",
  "psql",
  "cql",
  "flux",
  // Blockchain / emerging
  "sol",
  "move",
  "cairo",
  "vyper",
  // Infra / cloud
  "bicep",
  "dockerfile",
  "vagrantfile",
  // Other languages
  "coffee",
  "hx",
  "cr",
  "raku",
  "p6",
  "apl",
  "hack",
  "hack",
  "wat",
  "wasm_text",
  "jl",
  // Project-specific
  "kain",
  "ink",
  // Subtitles / playlists (text)
  "srt",
  "vtt",
  "ass",
  "ssa",
  "sub",
  "m3u",
  "pls",
  // Cert / key (text)
  "pem",
  "crt",
  "cer",
  "pub",
  "asc",
  // Game / engine text assets
  "uss",
  "pcf",
  // Misc plain text
  "diff",
  "patch",
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

// ── DOCX / Office word-processor formats ──────────────────────────────────────
const DOCX_PREVIEW_EXTENSIONS = ["docx", "doc", "rtf", "odt"] as const;

const DOCX_PREVIEW_EXTENSION_SET = new Set<string>(DOCX_PREVIEW_EXTENSIONS);

export function isDocxPreviewExtension(extension: string): boolean {
  return DOCX_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

const MONACO_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  // TypeScript / JavaScript
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  // Web
  vue: "html",
  svelte: "html",
  astro: "html",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  // Systems
  rs: "rust",
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  zig: "zig",
  d: "plaintext",
  nim: "plaintext",
  odin: "plaintext",
  v: "plaintext",
  // JVM / managed
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  cs: "csharp",
  fs: "fsharp",
  fsi: "fsharp",
  fsx: "fsharp",
  vb: "vb",
  scala: "scala",
  groovy: "java",
  clj: "clojure",
  cljs: "clojure",
  cljc: "clojure",
  // Scripting
  py: "python",
  pyw: "python",
  rb: "ruby",
  rbw: "ruby",
  php: "php",
  pl: "perl",
  pm: "perl",
  lua: "lua",
  tcl: "tcl",
  r: "r",
  // Shell
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  ksh: "shell",
  ps1: "powershell",
  bat: "bat",
  cmd: "bat",
  // Functional
  hs: "haskell",
  lhs: "haskell",
  ml: "plaintext",
  mli: "plaintext",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hrl: "erlang",
  elm: "elm",
  purs: "plaintext",
  lisp: "plaintext",
  el: "plaintext",
  scm: "plaintext",
  rkt: "plaintext",
  f: "plaintext",
  f90: "plaintext",
  f95: "plaintext",
  // Go / Swift / Dart
  go: "go",
  swift: "swift",
  dart: "dart",
  // Shader
  glsl: "glsl",
  hlsl: "hlsl",
  wgsl: "wgsl",
  vert: "glsl",
  frag: "glsl",
  comp: "glsl",
  metal: "plaintext",
  // Data / config
  json: "json",
  jsonc: "json",
  json5: "json",
  jsonl: "json",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  env: "shell",
  properties: "ini",
  hcl: "hcl",
  tf: "hcl",
  tfvars: "hcl",
  nix: "plaintext",
  graphql: "graphql",
  gql: "graphql",
  proto: "proto",
  // Docs / markup
  md: "markdown",
  mdx: "markdown",
  markdown: "markdown",
  rst: "restructuredtext",
  tex: "latex",
  latex: "latex",
  txt: "plaintext",
  log: "plaintext",
  // DB / query
  sql: "sql",
  psql: "pgsql",
  cql: "plaintext",
  flux: "plaintext",
  // Blockchain / emerging
  sol: "sol",
  move: "plaintext",
  cairo: "plaintext",
  vyper: "python",
  // Infra
  bicep: "bicep",
  // WebAssembly text
  wat: "wat",
  // Julia
  jl: "julia",
  // Other
  coffee: "coffeescript",
  cr: "plaintext",
  // Subtitles / playlists
  srt: "plaintext",
  vtt: "plaintext",
  ass: "plaintext",
  ssa: "plaintext",
  sub: "plaintext",
  m3u: "plaintext",
  pls: "ini",
  // Certs / keys
  pem: "plaintext",
  crt: "plaintext",
  cer: "plaintext",
  pub: "plaintext",
  asc: "plaintext",
  // Miscellaneous
  diff: "diff",
  patch: "diff",
  // GIS text formats
  prj: "plaintext",
  cpg: "plaintext",
  // Project-specific
  kain: "plaintext",
  ink: "plaintext",
};

const IMAGE_PREVIEW_EXTENSION_SET = new Set<string>(IMAGE_PREVIEW_EXTENSIONS);
const PYTHON_PREVIEW_EXTENSION_SET = new Set<string>(PYTHON_PREVIEW_EXTENSIONS);
const AUDIO_PREVIEW_EXTENSION_SET = new Set<string>(
  Object.keys(AUDIO_PREVIEW_MIME_TYPE_BY_EXTENSION),
);
const VIDEO_PREVIEW_EXTENSION_SET = new Set<string>(
  Object.keys(VIDEO_PREVIEW_MIME_TYPE_BY_EXTENSION),
);
const EXECUTABLE_SCRIPT_EXTENSION_SET = new Set<string>(
  Object.keys(EXECUTABLE_SCRIPT_RUNNER_BY_EXTENSION),
);
const EXECUTABLE_BINARY_EXTENSION_SET = new Set<string>(
  EXECUTABLE_BINARY_EXTENSIONS,
);
const EXECUTABLE_EXTENSION_SET = new Set<string>([
  ...EXECUTABLE_SCRIPT_EXTENSION_SET,
  ...EXECUTABLE_BINARY_EXTENSION_SET,
]);
const EDITABLE_TEXT_EXTENSION_SET = new Set<string>(EDITABLE_TEXT_EXTENSIONS);

const FONT_PREVIEW_EXTENSIONS = ["ttf", "otf", "woff", "woff2"] as const;

const FONT_PREVIEW_EXTENSION_SET = new Set<string>(FONT_PREVIEW_EXTENSIONS);
const PDF_PREVIEW_EXTENSION_SET = new Set<string>(["pdf"]);

const SQLITE_PREVIEW_EXTENSIONS = ["sqlite", "sqlite3", "db"] as const;

const SQLITE_PREVIEW_EXTENSION_SET = new Set<string>(SQLITE_PREVIEW_EXTENSIONS);
const SHADER_PREVIEW_FORMAT_BY_EXTENSION = {
  wgsl: "wgsl",
  hlsl: "hlsl",
  spv: "spv",
} as const satisfies Record<string, ShaderPreviewFormat>;
const SHADER_PREVIEW_EXTENSION_SET = new Set<string>(
  Object.keys(SHADER_PREVIEW_FORMAT_BY_EXTENSION),
);

export function isImagePreviewExtension(extension: string): boolean {
  return IMAGE_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isEditableImagePreviewExtension(extension: string): boolean {
  return getImageEditorContentType(extension) !== null;
}

export function getImageEditorContentType(extension: string): string | null {
  const normalizedExtension = normalizeExtension(extension);
  return normalizedExtension in IMAGE_EDITOR_CONTENT_TYPE_BY_EXTENSION
    ? IMAGE_EDITOR_CONTENT_TYPE_BY_EXTENSION[
        normalizedExtension as keyof typeof IMAGE_EDITOR_CONTENT_TYPE_BY_EXTENSION
      ]
    : null;
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

export function isShaderPreviewExtension(extension: string): boolean {
  return SHADER_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function getShaderPreviewFormat(
  extension: string,
): ShaderPreviewFormat | null {
  const normalizedExtension = normalizeExtension(extension);
  if (!isShaderPreviewExtension(normalizedExtension)) {
    return null;
  }
  return SHADER_PREVIEW_FORMAT_BY_EXTENSION[
    normalizedExtension as keyof typeof SHADER_PREVIEW_FORMAT_BY_EXTENSION
  ];
}

export function isExecutableExtension(extension: string): boolean {
  return EXECUTABLE_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isExecutableScriptExtension(extension: string): boolean {
  return EXECUTABLE_SCRIPT_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isExecutableBinaryExtension(extension: string): boolean {
  return EXECUTABLE_BINARY_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isPythonPreviewExtension(extension: string): boolean {
  return PYTHON_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function getExecutableScriptRunner(
  extension: string,
): ExplorerExecutableScriptRunner | null {
  const normalizedExtension = normalizeExtension(extension);
  return (
    EXECUTABLE_SCRIPT_RUNNER_BY_EXTENSION[
      normalizedExtension as keyof typeof EXECUTABLE_SCRIPT_RUNNER_BY_EXTENSION
    ] ?? null
  );
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

export function isModelPreviewExtension(extension: string): boolean {
  return getModelPreviewFormat(extension) != null;
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
    isExecutableBinaryExtension(normalizedExtension)
  ) {
    return false;
  }
  if (isSpreadsheetPreviewExtension(normalizedExtension)) {
    return false;
  }
  if (isShaderPreviewExtension(normalizedExtension)) {
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
  if (isDocxPreviewExtension(normalizedExtension)) {
    return false;
  }
  if (isModelPreviewExtension(normalizedExtension)) {
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
