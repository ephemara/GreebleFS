import { useEffect, useMemo, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildExplorerBatchRenamePreview, type ExplorerBatchRenameRecipe } from '../../components/explorerBatchRename';
import { useExplorerStore, type ExplorerRecursiveSizeCacheEntry } from '../../store/explorerStore';

interface FixtureEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  is_hidden: boolean;
  is_symlink: boolean;
}

const REPO_ROOT = 'C:\\workspace\\repo';
const LARGE_DIRECTORY_FIXTURE = Array.from({ length: 5000 }, (_, index) => ({
  name: index % 11 === 0 ? `folder-${index}` : `file-${index}.txt`,
  path: index % 11 === 0
    ? `${REPO_ROOT}\\folder-${index}`
    : `${REPO_ROOT}\\file-${index}.txt`,
  is_dir: index % 11 === 0,
  size: index % 11 === 0 ? 0 : (index + 1) * 128,
  modified: index,
  extension: index % 11 === 0 ? '' : 'txt',
  is_hidden: false,
  is_symlink: false,
} satisfies FixtureEntry));
const RENAME_FIXTURE: FixtureEntry[] = [
  {
    name: 'notes.txt',
    path: `${REPO_ROOT}\\notes.txt`,
    is_dir: false,
    size: 128,
    modified: 0,
    extension: 'txt',
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: 'preview.png',
    path: `${REPO_ROOT}\\preview.png`,
    is_dir: false,
    size: 4096,
    modified: 0,
    extension: 'png',
    is_hidden: false,
    is_symlink: false,
  },
];

function ExplorerLatencyProbe() {
  const recursiveSizeCache = useExplorerStore((state) => state.recursiveSizeCache);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [trashDialogVisible, setTrashDialogVisible] = useState(false);
  const [renameRecipe, setRenameRecipe] = useState<ExplorerBatchRenameRecipe>({
    mode: 'literal',
    findText: '',
    replaceText: '',
    prefix: '',
    suffix: '',
    startingNumber: 1,
    padding: 2,
  });

  const largeFolderSummary = useMemo(() => ({
    fileCount: LARGE_DIRECTORY_FIXTURE.filter((entry) => !entry.is_dir).length,
    folderCount: LARGE_DIRECTORY_FIXTURE.filter((entry) => entry.is_dir).length,
  }), []);
  const renamePreview = useMemo(
    () => buildExplorerBatchRenamePreview(RENAME_FIXTURE, renameRecipe),
    [renameRecipe],
  );
  const selectedSizeSummary = useMemo(() => {
    const selectedEntries = selectedPaths
      .map((path) => recursiveSizeCache[path])
      .filter((value): value is ExplorerRecursiveSizeCacheEntry => Boolean(value));
    if (selectedEntries.length === 0) {
      return null;
    }

    return {
      count: selectedEntries.length,
      bytes: selectedEntries.reduce((sum, entry) => sum + entry.bytes, 0),
    };
  }, [recursiveSizeCache, selectedPaths]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Delete' && selectedPaths.length > 0) {
        setTrashDialogVisible(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedPaths]);

  return (
    <div>
      <button type="button" onClick={() => setSelectedPaths([`${REPO_ROOT}\\notes.txt`])}>
        Select notes.txt
      </button>
      <button type="button" onClick={() => setSelectedPaths(RENAME_FIXTURE.map((entry) => entry.path))}>
        Select measured items
      </button>
      {trashDialogVisible ? <div>Move to Trash</div> : null}

      <label htmlFor="rename-prefix">Prefix</label>
      <input
        id="rename-prefix"
        placeholder="Prefix"
        value={renameRecipe.prefix}
        onChange={(event) => setRenameRecipe((current) => ({ ...current, prefix: event.target.value }))}
      />

      <div aria-label="rename-preview">
        {renamePreview.rows.map((row) => (
          <div key={row.sourcePath}>{row.nextName}</div>
        ))}
      </div>

      <div title="Visible folder size summary">
        {largeFolderSummary.fileCount} files · {largeFolderSummary.folderCount} folders
      </div>
      <div title="Selected item size summary">
        {selectedSizeSummary ? `${selectedSizeSummary.count} measured` : '0 measured'}
      </div>
    </div>
  );
}

describe('FileExplorer latency harness', () => {
  beforeEach(() => {
    useExplorerStore.getState().resetSession();
    useExplorerStore.getState().setPropertiesPanel(null);
    useExplorerStore.getState().setPendingTerminalCwdSync(null);
    useExplorerStore.getState().setRecursiveSizeCacheEntry(`${REPO_ROOT}\\notes.txt`, null);
    useExplorerStore.getState().setRecursiveSizeCacheEntry(`${REPO_ROOT}\\preview.png`, null);
    useExplorerStore.getState().setRecursiveSizeCacheEntry(`${REPO_ROOT}\\notes.txt`, {
      bytes: 128,
      fileCount: 1,
      folderCount: 0,
      pending: false,
      updatedAt: 0,
    });
    useExplorerStore.getState().setRecursiveSizeCacheEntry(`${REPO_ROOT}\\preview.png`, {
      bytes: 4096,
      fileCount: 1,
      folderCount: 0,
      pending: false,
      updatedAt: 0,
    });
  });

  it('shows the trash dialog immediately after the delete key is pressed on a selection', async () => {
    render(<ExplorerLatencyProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'Select notes.txt' }));

    const startedAt = performance.now();
    fireEvent.keyDown(window, { key: 'Delete' });

    expect(screen.getByText('Move to Trash')).toBeInTheDocument();
    expect(performance.now() - startedAt).toBeLessThan(16);
  });

  it('updates the batch rename preview immediately when the prefix changes', async () => {
    render(<ExplorerLatencyProbe />);

    const prefixInput = screen.getByPlaceholderText('Prefix');
    const startedAt = performance.now();
    fireEvent.change(prefixInput, { target: { value: 'renamed-' } });

    expect(screen.getByText('renamed-notes01.txt')).toBeInTheDocument();
    expect(performance.now() - startedAt).toBeLessThan(16);
  });

  it('keeps folder and selection size summaries in sync with measured entry sizes', async () => {
    render(<ExplorerLatencyProbe />);

    expect(screen.getByTitle('Visible folder size summary')).toHaveTextContent('4545 files · 455 folders');

    const startedAt = performance.now();
    fireEvent.click(screen.getByRole('button', { name: 'Select measured items' }));

    expect(screen.getByTitle('Selected item size summary')).toHaveTextContent('2 measured');
    expect(performance.now() - startedAt).toBeLessThan(16);
  });
});
