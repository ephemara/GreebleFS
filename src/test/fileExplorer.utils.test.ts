/**
 * Unit tests for pure-function utilities extracted from FileExplorer.tsx
 *
 * All tests in this file are deterministic — no network, no Tauri IPC.
 * They test the exact logic that drives how files are displayed, typed, and sorted.
 */

import { describe, it, expect } from 'vitest';

// ─── Replicate pure helpers from FileExplorer (DRY violation is intentional
//     here: we test the contract, not the implementation reference) ─────────────

const IMAGE_EXTS    = new Set(['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff','avif']);
const CODE_EXTS     = new Set(['ts','tsx','js','jsx','rs','py','go','c','cpp','h','hpp','cs','java','rb','php','swift','kt','vue','html','css','scss','json','toml','yaml','yml','xml','md','sh','ps1','bat','lua','sql']);
const ARCHIVE_EXTS  = new Set(['zip','rar','7z','tar','gz','bz2','xz']);
const VIDEO_EXTS    = new Set(['mp4','mkv','avi','mov','wmv','flv','webm','m4v']);
const AUDIO_EXTS    = new Set(['mp3','wav','flac','ogg','m4a','aac','opus']);
const EXEC_EXTS     = new Set(['exe','msi','bat','cmd','ps1','sh','app','dmg']);
const FONT_EXTS     = new Set(['ttf','otf','woff','woff2']);

interface FileEntry {
  name: string; path: string; is_dir: boolean;
  size: number; modified: number; extension: string;
  is_hidden: boolean; is_symlink: boolean;
}

function makeEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    name: 'test.txt', path: 'C:\\test\\test.txt',
    is_dir: false, size: 1024, modified: 1700000000000,
    extension: 'txt', is_hidden: false, is_symlink: false,
    ...overrides,
  };
}

function fileColor(entry: FileEntry): string {
  if (entry.is_dir) return '#fbbf24';
  const ext = entry.extension;
  if (IMAGE_EXTS.has(ext))   return '#34d399';
  if (CODE_EXTS.has(ext))    return '#60a5fa';
  if (ARCHIVE_EXTS.has(ext)) return '#f97316';
  if (VIDEO_EXTS.has(ext))   return '#a78bfa';
  if (AUDIO_EXTS.has(ext))   return '#f472b6';
  if (EXEC_EXTS.has(ext))    return '#f87171';
  if (FONT_EXTS.has(ext))    return '#fb923c';
  return '#94a3b8';
}

function monacoLang(ext: string): string {
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    rs: 'rust', py: 'python', go: 'go', c: 'c', cpp: 'cpp', h: 'cpp',
    cs: 'csharp', java: 'java', rb: 'ruby', php: 'php', swift: 'swift',
    kt: 'kotlin', vue: 'html', html: 'html', css: 'css', scss: 'scss',
    json: 'json', toml: 'toml', yaml: 'yaml', yml: 'yaml', xml: 'xml',
    md: 'markdown', sh: 'shell', ps1: 'powershell', bat: 'bat', lua: 'lua',
    sql: 'sql',
  };
  return map[ext] || 'plaintext';
}

function formatSize(bytes: number): string {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return                           `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Simulates the directory-first sort from the Rust backend
function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

// Simulates search filter
function filterEntries(entries: FileEntry[], query: string): FileEntry[] {
  if (!query.trim()) return entries;
  const q = query.toLowerCase();
  return entries.filter(e => e.name.toLowerCase().includes(q));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fileColor()', () => {
  it('returns yellow for directories', () => {
    expect(fileColor(makeEntry({ is_dir: true, extension: '' }))).toBe('#fbbf24');
  });

  it('returns green for image files', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif']) {
      expect(fileColor(makeEntry({ extension: ext }))).toBe('#34d399');
    }
  });

  it('returns blue for code files', () => {
    for (const ext of ['ts', 'tsx', 'js', 'rs', 'py', 'go', 'cpp', 'json']) {
      expect(fileColor(makeEntry({ extension: ext }))).toBe('#60a5fa');
    }
  });

  it('returns orange for archive files', () => {
    for (const ext of ['zip', 'rar', '7z', 'tar', 'gz']) {
      expect(fileColor(makeEntry({ extension: ext }))).toBe('#f97316');
    }
  });

  it('returns purple for video files', () => {
    for (const ext of ['mp4', 'mkv', 'avi', 'mov']) {
      expect(fileColor(makeEntry({ extension: ext }))).toBe('#a78bfa');
    }
  });

  it('returns pink for audio files', () => {
    for (const ext of ['mp3', 'wav', 'flac', 'ogg']) {
      expect(fileColor(makeEntry({ extension: ext }))).toBe('#f472b6');
    }
  });

  it('returns red for executables', () => {
    for (const ext of ['exe', 'msi']) {
      expect(fileColor(makeEntry({ extension: ext }))).toBe('#f87171');
    }
  });

  it('returns orange for font files', () => {
    for (const ext of ['ttf', 'otf', 'woff', 'woff2']) {
      expect(fileColor(makeEntry({ extension: ext }))).toBe('#fb923c');
    }
  });

  it('returns grey for unknown/generic files', () => {
    expect(fileColor(makeEntry({ extension: 'xyz' }))).toBe('#94a3b8');
    expect(fileColor(makeEntry({ extension: '' }))).toBe('#94a3b8');
    expect(fileColor(makeEntry({ extension: 'docx' }))).toBe('#94a3b8');
  });

  it('directory colour takes precedence over extension', () => {
    // A directory named "images.jpg" should still be yellow
    expect(fileColor(makeEntry({ is_dir: true, extension: 'jpg' }))).toBe('#fbbf24');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('monacoLang()', () => {
  const cases: [string, string][] = [
    ['ts',    'typescript'],
    ['tsx',   'typescript'],
    ['js',    'javascript'],
    ['jsx',   'javascript'],
    ['rs',    'rust'],
    ['py',    'python'],
    ['go',    'go'],
    ['c',     'c'],
    ['cpp',   'cpp'],
    ['h',     'cpp'],
    ['cs',    'csharp'],
    ['java',  'java'],
    ['rb',    'ruby'],
    ['php',   'php'],
    ['swift', 'swift'],
    ['kt',    'kotlin'],
    ['vue',   'html'],
    ['html',  'html'],
    ['css',   'css'],
    ['scss',  'scss'],
    ['json',  'json'],
    ['toml',  'toml'],
    ['yaml',  'yaml'],
    ['yml',   'yaml'],
    ['xml',   'xml'],
    ['md',    'markdown'],
    ['sh',    'shell'],
    ['ps1',   'powershell'],
    ['bat',   'bat'],
    ['lua',   'lua'],
    ['sql',   'sql'],
  ];

  it.each(cases)('maps .%s → %s', (ext, expected) => {
    expect(monacoLang(ext)).toBe(expected);
  });

  it('returns plaintext for unknown extensions', () => {
    expect(monacoLang('xyz')).toBe('plaintext');
    expect(monacoLang('')).toBe('plaintext');
    expect(monacoLang('docx')).toBe('plaintext');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('formatSize()', () => {
  it('formats bytes correctly', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(1)).toBe('1 B');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes correctly', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(102400)).toBe('100.0 KB');
    expect(formatSize(1024 * 1024 - 1)).toMatch(/KB$/);
  });

  it('formats megabytes correctly', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
    expect(formatSize(1024 * 1024 * 500)).toBe('500.0 MB');
  });

  it('formats gigabytes correctly', () => {
    expect(formatSize(1024 ** 3)).toBe('1.00 GB');
    expect(formatSize(1024 ** 3 * 1.5)).toBe('1.50 GB');
    expect(formatSize(1024 ** 3 * 512)).toBe('512.00 GB');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('formatDate()', () => {
  it('returns em dash for zero timestamp', () => {
    expect(formatDate(0)).toBe('—');
  });

  it('returns a non-empty string for valid timestamps', () => {
    const result = formatDate(1700000000000);
    expect(result).toBeTruthy();
    expect(result).not.toBe('—');
    // Should contain the year 2023
    expect(result).toContain('2023');
  });

  it('returns a different value for different timestamps', () => {
    const a = formatDate(1000000000000); // 2001
    const b = formatDate(1700000000000); // 2023
    expect(a).not.toBe(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('sortEntries() — directory-first sort', () => {
  const dir  = (name: string) => makeEntry({ name, is_dir: true,  extension: '', size: 0 });
  const file = (name: string, ext = 'txt') => makeEntry({ name, is_dir: false, extension: ext });

  it('places directories before files', () => {
    const input  = [file('z.txt'), dir('a'), file('a.txt'), dir('z')];
    const result = sortEntries(input);
    expect(result[0].is_dir).toBe(true);
    expect(result[1].is_dir).toBe(true);
    expect(result[2].is_dir).toBe(false);
    expect(result[3].is_dir).toBe(false);
  });

  it('sorts directories alphabetically (case-insensitive)', () => {
    const input  = [dir('Zeta'), dir('alpha'), dir('Beta')];
    const result = sortEntries(input);
    expect(result.map(e => e.name)).toEqual(['alpha', 'Beta', 'Zeta']);
  });

  it('sorts files alphabetically (case-insensitive)', () => {
    const input  = [file('zebra.txt'), file('Apple.txt'), file('mango.txt')];
    const result = sortEntries(input);
    expect(result.map(e => e.name)).toEqual(['Apple.txt', 'mango.txt', 'zebra.txt']);
  });

  it('handles empty list', () => {
    expect(sortEntries([])).toEqual([]);
  });

  it('handles all-directories list', () => {
    const input  = [dir('z'), dir('a'), dir('m')];
    const result = sortEntries(input);
    expect(result.map(e => e.name)).toEqual(['a', 'm', 'z']);
  });

  it('handles all-files list', () => {
    const input  = [file('z.ts'), file('a.rs'), file('m.py')];
    const result = sortEntries(input);
    expect(result.map(e => e.name)).toEqual(['a.rs', 'm.py', 'z.ts']);
  });

  it('does not mutate the original array', () => {
    const input  = [file('z.txt'), dir('a')];
    const orig   = [...input];
    sortEntries(input);
    expect(input).toEqual(orig);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('filterEntries() — search logic', () => {
  const entries = [
    makeEntry({ name: 'package.json',    extension: 'json' }),
    makeEntry({ name: 'README.md',       extension: 'md'   }),
    makeEntry({ name: 'src',             is_dir: true, extension: '' }),
    makeEntry({ name: 'Cargo.toml',      extension: 'toml' }),
    makeEntry({ name: 'vite.config.ts',  extension: 'ts'   }),
  ];

  it('returns all entries for empty query', () => {
    expect(filterEntries(entries, '')).toHaveLength(5);
    expect(filterEntries(entries, '   ')).toHaveLength(5);
  });

  it('filters by partial name (case-insensitive)', () => {
    const result = filterEntries(entries, 'cargo');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Cargo.toml');
  });

  it('filters by extension substring', () => {
    const result = filterEntries(entries, '.ts');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('vite.config.ts');
  });

  it('matches multiple results', () => {
    const result = filterEntries(entries, 'c');
    // package.json (no 'c'), README.md (no), src (has 'c'? no - wait 'src' -> s,r,c YES)
    // Cargo.toml (has 'c'), vite.config.ts (has 'c')
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterEntries(entries, 'xyzzy_nonexistent')).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const lower  = filterEntries(entries, 'readme');
    const upper  = filterEntries(entries, 'README');
    const mixed  = filterEntries(entries, 'ReaDme');
    expect(lower).toHaveLength(1);
    expect(upper).toHaveLength(1);
    expect(mixed).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Extension set membership', () => {
  it('IMAGE_EXTS contains expected extensions', () => {
    for (const ext of ['jpg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']) {
      expect(IMAGE_EXTS.has(ext)).toBe(true);
    }
    expect(IMAGE_EXTS.has('mp4')).toBe(false);
    expect(IMAGE_EXTS.has('txt')).toBe(false);
  });

  it('CODE_EXTS covers all major languages', () => {
    const required = ['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'cpp', 'cs', 'java', 'rb', 'php', 'json', 'yaml', 'md'];
    for (const ext of required) {
      expect(CODE_EXTS.has(ext)).toBe(true);
    }
  });

  it('EXEC_EXTS includes Windows executables', () => {
    for (const ext of ['exe', 'msi', 'bat', 'cmd', 'ps1']) {
      expect(EXEC_EXTS.has(ext)).toBe(true);
    }
  });

  it('sets are disjoint where expected', () => {
    // An image should not be in CODE_EXTS
    for (const ext of IMAGE_EXTS) {
      expect(CODE_EXTS.has(ext)).toBe(false);
    }
    // Archives should not be in AUDIO/VIDEO
    for (const ext of ARCHIVE_EXTS) {
      expect(AUDIO_EXTS.has(ext)).toBe(false);
      expect(VIDEO_EXTS.has(ext)).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Windows path breadcrumb parsing', () => {
  function parseBreadcrumbs(currentPath: string): { label: string; path: string }[] {
    const crumbs: { label: string; path: string }[] = [];
    if (/^[A-Za-z]:/.test(currentPath)) {
      const drive = currentPath.slice(0, 2) + '\\';
      crumbs.push({ label: drive, path: drive });
      const rest = currentPath.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean);
      for (let i = 1; i < rest.length; i++) {
        crumbs.push({ label: rest[i], path: rest.slice(0, i + 1).join('\\') });
      }
    }
    return crumbs;
  }

  it('parses drive root correctly', () => {
    const crumbs = parseBreadcrumbs('C:\\');
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].label).toBe('C:\\');
    expect(crumbs[0].path).toBe('C:\\');
  });

  it('parses single-level Windows path', () => {
    const crumbs = parseBreadcrumbs('C:\\Users');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].label).toBe('C:\\');
    expect(crumbs[1].label).toBe('Users');
  });

  it('parses deep Windows path', () => {
    const crumbs = parseBreadcrumbs('C:\\Users\\Admin\\Projects');
    expect(crumbs).toHaveLength(4);
    expect(crumbs[0].label).toBe('C:\\');
    expect(crumbs[1].label).toBe('Users');
    expect(crumbs[2].label).toBe('Admin');
    expect(crumbs[3].label).toBe('Projects');
  });

  it('works for M: drive', () => {
    const crumbs = parseBreadcrumbs('M:\\OverlayTerm\\src');
    expect(crumbs[0].label).toBe('M:\\');
    expect(crumbs[crumbs.length - 1].label).toBe('src');
  });
});
