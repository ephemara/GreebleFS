export interface ProofFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  is_hidden: boolean;
  is_symlink: boolean;
}

export const REPO_ROOT = 'C:\\workspace\\repo';

export const EXPLORER_ENTRIES: ProofFileEntry[] = [
  {
    name: 'alpha',
    path: `${REPO_ROOT}\\alpha`,
    is_dir: true,
    size: 0,
    modified: 0,
    extension: '',
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: 'nested',
    path: `${REPO_ROOT}\\nested`,
    is_dir: true,
    size: 0,
    modified: 0,
    extension: '',
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: 'notes.txt',
    path: `${REPO_ROOT}\\notes.txt`,
    is_dir: false,
    size: 12,
    modified: 0,
    extension: 'txt',
    is_hidden: false,
    is_symlink: false,
  },
];

export const RUNTIME_POLICY = {
  dirListCacheTtlMs: 2000,
  searchNameIndexCacheTtlMs: 1500,
  searchContentIndexCacheTtlMs: 1000,
  entrySizeCacheTtlMs: 10000,
  entrySizeScanBudgetMs: 900,
  searchContentIndexTotalBytesBudget: 12 * 1024 * 1024,
  maxSearchContentFileBytes: 8 * 1024 * 1024,
  searchMaxIndexedEntries: 25000,
};

export function buildEntrySizeResults(paths: string[]) {
  return paths.map(path => {
    const matchingEntry = EXPLORER_ENTRIES.find(entry => entry.path === path);
    return {
      path,
      bytes: matchingEntry?.size ?? 0,
      is_dir: matchingEntry?.is_dir ?? false,
      is_complete: true,
    };
  });
}
