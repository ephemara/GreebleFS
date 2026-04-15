export type ModelPreviewFormat = 'fbx' | 'glb' | 'gltf' | 'obj' | 'stl';

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
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif',
] as const;

const EXECUTABLE_EXTENSIONS = [
  'exe', 'msi', 'bat', 'cmd', 'ps1', 'sh', 'app', 'dmg',
] as const;

const EDITABLE_TEXT_EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'c', 'cpp', 'h', 'hpp', 'cs', 'java', 'rb',
  'php', 'swift', 'kt', 'vue', 'html', 'css', 'scss', 'json', 'toml', 'yaml', 'yml', 'xml',
  'md', 'sh', 'ps1', 'bat', 'lua', 'sql', 'zig', 'env', 'dart', 'glsl', 'wgsl', 'hlsl', 'ini',
  'txt', 'kain', 'ink', 'log',
] as const;

export const MODEL_PREVIEW_FORMAT_BY_EXTENSION: Record<string, ModelPreviewFormat> = {
  fbx: 'fbx',
  glb: 'glb',
  gltf: 'gltf',
  obj: 'obj',
  stl: 'stl',
};

const MONACO_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  rs: 'rust',
  py: 'python',
  go: 'go',
  c: 'c',
  cpp: 'cpp',
  h: 'cpp',
  cs: 'csharp',
  java: 'java',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  vue: 'html',
  html: 'html',
  css: 'css',
  scss: 'scss',
  json: 'json',
  toml: 'toml',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  md: 'markdown',
  sh: 'shell',
  ps1: 'powershell',
  bat: 'bat',
  lua: 'lua',
  sql: 'sql',
  zig: 'zig',
  ini: 'ini',
  env: 'shell',
  dart: 'dart',
  glsl: 'glsl',
  wgsl: 'wgsl',
  hlsl: 'hlsl',
  kain: 'plaintext',
  ink: 'plaintext',
  log: 'plaintext',
};

const IMAGE_PREVIEW_EXTENSION_SET = new Set<string>(IMAGE_PREVIEW_EXTENSIONS);
const EXECUTABLE_EXTENSION_SET = new Set<string>(EXECUTABLE_EXTENSIONS);
const EDITABLE_TEXT_EXTENSION_SET = new Set<string>(EDITABLE_TEXT_EXTENSIONS);

export function isImagePreviewExtension(extension: string): boolean {
  return IMAGE_PREVIEW_EXTENSION_SET.has(normalizeExtension(extension));
}

export function isExecutableExtension(extension: string): boolean {
  return EXECUTABLE_EXTENSION_SET.has(normalizeExtension(extension));
}

export function getModelPreviewFormat(extension: string): ModelPreviewFormat | null {
  return MODEL_PREVIEW_FORMAT_BY_EXTENSION[normalizeExtension(extension)] ?? null;
}

export function getMonacoLanguage(extension: string): string {
  return MONACO_LANGUAGE_BY_EXTENSION[normalizeExtension(extension)] ?? 'plaintext';
}

export function isEditableTextExtension(extension: string, size: number): boolean {
  const normalizedExtension = normalizeExtension(extension);
  if (!normalizedExtension) {
    return size < 2 * 1024 * 1024;
  }
  if (isImagePreviewExtension(normalizedExtension) || isExecutableExtension(normalizedExtension)) {
    return false;
  }
  if (getModelPreviewFormat(normalizedExtension)) {
    return false;
  }
  return EDITABLE_TEXT_EXTENSION_SET.has(normalizedExtension) || size < 2 * 1024 * 1024;
}

function normalizeExtension(extension: string): string {
  return extension.trim().replace(/^\./, '').toLowerCase();
}
