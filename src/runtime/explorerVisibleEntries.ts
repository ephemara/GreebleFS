import type { ExplorerFileEntry as FileEntry } from './explorerBackend';

export type ExplorerVisibleEntriesSortKey = 'name' | 'size' | 'date' | 'type';

export interface ExplorerPathTagAssignment {
  path: string;
  tagIds: readonly string[];
}

export interface ExplorerVisibleEntriesComputeInput<
  TEntry extends ExplorerVisibleEntryLike = FileEntry,
> {
  entries: readonly TEntry[];
  activeTagFilterIds: readonly string[];
  pathTagAssignments: readonly ExplorerPathTagAssignment[];
  sortBy: ExplorerVisibleEntriesSortKey;
  sortOrder: 'asc' | 'desc';
}

export const EXPLORER_VISIBLE_ENTRIES_WORKER_TASK_TYPE =
  'shape-base-visible-entries';

export function canReuseBackendSortedExplorerEntries(
  input: Pick<
    ExplorerVisibleEntriesComputeInput,
    'activeTagFilterIds' | 'pathTagAssignments' | 'sortBy' | 'sortOrder'
  >,
): boolean {
  return (
    input.activeTagFilterIds.length === 0 &&
    input.sortBy === 'name' &&
    input.sortOrder === 'asc'
  );
}

type ExplorerVisibleEntryLike = Pick<
  FileEntry,
  'path' | 'is_dir' | 'name' | 'extension' | 'size' | 'modified'
>;

const EXT_TYPE_LABEL: Record<string, string> = {
  rs: 'Rust',
  c: 'C',
  h: 'C Header',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  hpp: 'C++ Header',
  hxx: 'C++ Header',
  zig: 'Zig',
  d: 'D',
  nim: 'Nim',
  odin: 'Odin',
  v: 'V',
  java: 'Java',
  kt: 'Kotlin',
  kts: 'Kotlin',
  cs: 'C#',
  fs: 'F#',
  fsi: 'F#',
  fsx: 'F# Script',
  vb: 'VB.NET',
  scala: 'Scala',
  groovy: 'Groovy',
  clj: 'Clojure',
  cljs: 'ClojureScript',
  cljc: 'Clojure',
  py: 'Python',
  pyw: 'Python',
  rb: 'Ruby',
  rbw: 'Ruby',
  php: 'PHP',
  pl: 'Perl',
  pm: 'Perl',
  lua: 'Lua',
  tcl: 'Tcl',
  r: 'R',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  mts: 'TypeScript',
  cts: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  vue: 'Vue',
  svelte: 'Svelte',
  astro: 'Astro',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  fish: 'Shell',
  ksh: 'Shell',
  ps1: 'PowerShell',
  bat: 'Batch',
  cmd: 'Command',
  hs: 'Haskell',
  lhs: 'Haskell',
  ml: 'OCaml',
  mli: 'OCaml',
  ex: 'Elixir',
  exs: 'Elixir',
  erl: 'Erlang',
  hrl: 'Erlang',
  elm: 'Elm',
  purs: 'PureScript',
  lisp: 'Lisp',
  el: 'Emacs Lisp',
  scm: 'Scheme',
  rkt: 'Racket',
  f: 'Fortran',
  f90: 'Fortran',
  f95: 'Fortran',
  go: 'Go',
  swift: 'Swift',
  dart: 'Dart',
  glsl: 'GLSL',
  hlsl: 'HLSL',
  wgsl: 'WGSL',
  vert: 'Shader',
  frag: 'Shader',
  comp: 'Compute Shader',
  metal: 'Metal',
  json: 'JSON',
  jsonc: 'JSON',
  json5: 'JSON5',
  jsonl: 'JSON Lines',
  toml: 'TOML',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  ini: 'Config',
  cfg: 'Config',
  conf: 'Config',
  env: 'Env',
  properties: 'Properties',
  hcl: 'HCL',
  tf: 'Terraform',
  tfvars: 'Terraform',
  nix: 'Nix',
  dhall: 'Dhall',
  ron: 'RON',
  kdl: 'KDL',
  pkl: 'Pkl',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  proto: 'Protobuf',
  fbs: 'FlatBuffers',
  capnp: "Cap'n Proto",
  md: 'Markdown',
  mdx: 'MDX',
  markdown: 'Markdown',
  rst: 'reStructuredText',
  adoc: 'AsciiDoc',
  tex: 'LaTeX',
  latex: 'LaTeX',
  txt: 'Text',
  log: 'Log',
  sql: 'SQL',
  psql: 'PostgreSQL',
  cql: 'CQL',
  db: 'Database',
  sqlite: 'SQLite',
  sqlite3: 'SQLite',
  pdf: 'PDF',
  csv: 'CSV',
  tsv: 'TSV',
  xls: 'Spreadsheet',
  xlsx: 'Spreadsheet',
  xlsm: 'Spreadsheet',
  xlsb: 'Spreadsheet',
  ods: 'Spreadsheet',
  docx: 'Word Document',
  doc: 'Word Document',
  rtf: 'Rich Text',
  odt: 'OpenDocument Text',
  pptx: 'PowerPoint',
  ppt: 'PowerPoint',
  odp: 'OpenDocument Presentation',
  epub: 'E-Book',
  ttf: 'Font',
  otf: 'Font',
  woff: 'Font',
  woff2: 'Font',
  fbx: '3D Model',
  obj: '3D Model',
  glb: '3D Model',
  gltf: '3D Model',
  stl: '3D Model',
  uasset: 'UE Asset',
  uproject: 'UE Project',
  jpg: 'Image',
  jpeg: 'Image',
  png: 'Image',
  gif: 'Image',
  webp: 'Image',
  bmp: 'Image',
  ico: 'Image',
  svg: 'Vector',
  tiff: 'Image',
  tif: 'Image',
  avif: 'Image',
  heic: 'Image',
  heif: 'Image',
  jxl: 'Image',
  psd: 'Photoshop',
  ai: 'Illustrator',
  xcf: 'GIMP',
  mp4: 'Video',
  mkv: 'Video',
  avi: 'Video',
  mov: 'Video',
  wmv: 'Video',
  flv: 'Video',
  webm: 'Video',
  mp3: 'Audio',
  wav: 'Audio',
  flac: 'Audio',
  ogg: 'Audio',
  m4a: 'Audio',
  aac: 'Audio',
  opus: 'Audio',
  aiff: 'Audio',
  zip: 'Archive',
  rar: 'Archive',
  '7z': 'Archive',
  tar: 'Archive',
  gz: 'Archive',
  bz2: 'Archive',
  xz: 'Archive',
  zst: 'Archive',
  lz4: 'Archive',
  deb: 'Debian Package',
  rpm: 'RPM Package',
  dmg: 'Disk Image',
  iso: 'Disk Image',
  exe: 'Executable',
  msi: 'Installer',
  dll: 'Library',
  so: 'Library',
  dylib: 'Library',
  sol: 'Solidity',
  move: 'Move',
  cairo: 'Cairo',
  vyper: 'Vyper',
  srt: 'Subtitles',
  vtt: 'WebVTT',
  ass: 'Subtitles',
  ssa: 'Subtitles',
  lock: 'Lockfile',
  diff: 'Diff',
  patch: 'Patch',
  pem: 'Certificate',
  crt: 'Certificate',
  cer: 'Certificate',
  pub: 'Public Key',
  asc: 'PGP Key',
  wat: 'WebAssembly',
  jl: 'Julia',
  coffee: 'CoffeeScript',
  cr: 'Crystal',
  geojson: 'GeoJSON',
  gpx: 'GPS Track',
  kml: 'KML',
  kmz: 'KMZ',
  shp: 'Shapefile',
  prj: 'Projection',
  kain: 'Kain',
  ink: 'Ink',
};

const FILENAME_TYPE_LABEL: Record<string, string> = {
  dockerfile: 'Docker',
  makefile: 'Makefile',
  rakefile: 'Ruby',
  cmake: 'CMake',
  '.gitignore': 'Git',
  '.gitattributes': 'Git',
  '.gitmodules': 'Git',
  '.env': 'Environment',
  '.env.local': 'Environment',
  '.editorconfig': 'EditorConfig',
  'package.json': 'NPM Package',
  'package-lock.json': 'NPM Lockfile',
  'cargo.toml': 'Cargo Manifest',
  'cargo.lock': 'Cargo Lockfile',
};

const EXPLORER_ENTRY_TEXT_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

export function getEntryExtension(
  entry: Pick<FileEntry, 'is_dir' | 'name' | 'extension'>,
): string {
  if (entry.is_dir) {
    return '';
  }

  const normalizedExtension = (entry.extension ?? '')
    .trim()
    .replace(/^\./, '')
    .toLowerCase();
  if (normalizedExtension) {
    return normalizedExtension;
  }

  const lastDotIndex = entry.name.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === entry.name.length - 1) {
    return '';
  }

  return entry.name.slice(lastDotIndex + 1).toLowerCase();
}

export function getEntryTypeLabel(
  entry: Pick<FileEntry, 'is_dir' | 'name' | 'extension'>,
): string {
  if (entry.is_dir) {
    return 'Folder';
  }

  const filename = entry.name.toLowerCase();
  if (FILENAME_TYPE_LABEL[filename]) {
    return FILENAME_TYPE_LABEL[filename];
  }

  const extension = getEntryExtension(entry);
  if (!extension) {
    return 'File';
  }

  return EXT_TYPE_LABEL[extension] ?? `${extension.toUpperCase()} File`;
}

function compareExplorerEntryText(left: string, right: string): number {
  return EXPLORER_ENTRY_TEXT_COLLATOR.compare(left, right);
}

export function compareExplorerEntries<
  TEntry extends ExplorerVisibleEntryLike,
>(
  left: TEntry,
  right: TEntry,
  sortBy: ExplorerVisibleEntriesSortKey,
  sortOrder: 'asc' | 'desc',
): number {
  if (left.is_dir !== right.is_dir) {
    return left.is_dir ? -1 : 1;
  }

  let comparison = 0;
  switch (sortBy) {
    case 'size':
      comparison = left.size - right.size;
      break;
    case 'date':
      comparison = left.modified - right.modified;
      break;
    case 'type':
      comparison = compareExplorerEntryText(
        getEntryTypeLabel(left),
        getEntryTypeLabel(right),
      );
      break;
    case 'name':
    default:
      comparison = compareExplorerEntryText(left.name, right.name);
      break;
  }

  if (comparison === 0) {
    comparison = compareExplorerEntryText(left.name, right.name);
  }

  return sortOrder === 'asc' ? comparison : -comparison;
}

export function sortExplorerEntries<TEntry extends ExplorerVisibleEntryLike>(
  entries: readonly TEntry[],
  sortBy: ExplorerVisibleEntriesSortKey,
  sortOrder: 'asc' | 'desc',
): TEntry[] {
  if (entries.length <= 1) {
    return [...entries];
  }

  if (sortBy !== 'type') {
    return [...entries].sort((left, right) =>
      compareExplorerEntries(left, right, sortBy, sortOrder),
    );
  }

  const decoratedEntries = entries.map((entry, index) => ({
    entry,
    index,
    typeLabel: getEntryTypeLabel(entry),
  }));

  decoratedEntries.sort((left, right) => {
    if (left.entry.is_dir !== right.entry.is_dir) {
      return left.entry.is_dir ? -1 : 1;
    }

    let comparison = compareExplorerEntryText(left.typeLabel, right.typeLabel);
    if (comparison === 0) {
      comparison = compareExplorerEntryText(left.entry.name, right.entry.name);
    }
    if (comparison === 0) {
      comparison = left.index - right.index;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return decoratedEntries.map(({ entry }) => entry);
}

export function computeExplorerBaseVisibleEntries<
  TEntry extends ExplorerVisibleEntryLike,
>(input: ExplorerVisibleEntriesComputeInput<TEntry>): TEntry[] {
  const pathTagIdsByPath = new Map(
    input.pathTagAssignments.map(assignment => [
      assignment.path,
      assignment.tagIds,
    ] as const),
  );
  const filteredEntries = input.entries.filter(entry => {
    if (input.activeTagFilterIds.length === 0) {
      return true;
    }
    const tagIds = pathTagIdsByPath.get(entry.path) ?? [];
    return input.activeTagFilterIds.every(tagId => tagIds.includes(tagId));
  });

  return sortExplorerEntries(
    filteredEntries,
    input.sortBy,
    input.sortOrder,
  );
}
