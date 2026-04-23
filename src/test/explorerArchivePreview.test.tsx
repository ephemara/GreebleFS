import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerArchivePreview } from '../components/ExplorerArchivePreview';
import { getFolderIconSrc } from '../config/folderIcons';
import { getBuiltInIconTheme, resolveFileIconSrc } from '../config/iconTheme';
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
    const iconTheme = getBuiltInIconTheme();

    vi.mocked(explorerBackendContract.inspectArchive).mockResolvedValue([
      'textures/',
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
        iconTheme={iconTheme}
      />,
    );

    expect(await screen.findByText('textures')).toBeInTheDocument();
    expect(await screen.findByText('diffuse.png')).toBeInTheDocument();
    expect(screen.getByText('readme.txt')).toBeInTheDocument();
    expect(vi.mocked(explorerBackendContract.inspectArchive)).toHaveBeenCalledWith(archivePath);

    const folderRow = container.querySelector(
      '[data-overlay-preview-entry-path="textures/"]',
    );
    const fileRow = container.querySelector(
      '[data-overlay-preview-entry-path="docs/readme.txt"]',
    );
    const folderIcon = folderRow?.querySelector(
      '[data-overlay-preview-entry-icon="true"]',
    );
    const fileIcon = fileRow?.querySelector(
      '[data-overlay-preview-entry-icon="true"]',
    );

    expect(folderIcon).toBeInstanceOf(HTMLImageElement);
    expect(fileIcon).toBeInstanceOf(HTMLImageElement);
    expect((folderIcon as HTMLImageElement).getAttribute('src')).toBe(
      getFolderIconSrc('textures', false, { iconTheme }),
    );
    expect((fileIcon as HTMLImageElement).getAttribute('src')).toBe(
      resolveFileIconSrc('readme.txt', 'txt', iconTheme),
    );

    const viewport = container.querySelector('[data-overlay-scrollbar-style="explorer-file-list"]');
    expect(viewport).not.toBeNull();
    expect(viewport?.classList.contains('overlay-scroll-area__viewport--explorer-file-list')).toBe(true);
  });
});
