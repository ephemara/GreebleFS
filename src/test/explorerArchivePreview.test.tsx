import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerArchivePreview } from '../components/ExplorerArchivePreview';
import { explorerBackendContract } from '../runtime/explorerBackend';

vi.mock('../runtime/explorerBackend', () => ({
  explorerBackendContract: {
    inspectArchive: vi.fn(),
  },
}));

describe('ExplorerArchivePreview', () => {
  beforeEach(() => {
    vi.mocked(explorerBackendContract.inspectArchive).mockReset();
  });

  it('renders archive contents inside the shared explorer scrollbar viewport', async () => {
    const archivePath = 'C:\\Assets\\demo.zip';

    vi.mocked(explorerBackendContract.inspectArchive).mockResolvedValue([
      'textures/hero/diffuse.png',
      'docs/readme.txt',
    ]);

    const { container } = render(
      <ExplorerArchivePreview
        archivePath={archivePath}
        archiveName="demo.zip"
        archiveSize={2048}
        descriptor={{ id: 'zip', suffixes: ['.zip'], label: 'Zip Archive' }}
        onExtract={() => undefined}
      />,
    );

    expect(await screen.findByText('diffuse.png')).toBeInTheDocument();
    expect(screen.getByText('readme.txt')).toBeInTheDocument();
    expect(vi.mocked(explorerBackendContract.inspectArchive)).toHaveBeenCalledWith(archivePath);

    const viewport = container.querySelector('[data-overlay-scrollbar-style="explorer-file-list"]');
    expect(viewport).not.toBeNull();
    expect(viewport?.classList.contains('overlay-scroll-area__viewport--explorer-file-list')).toBe(true);
  });
});
