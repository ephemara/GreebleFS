import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadNotesWorkspaceSnapshot, saveNotesDocument } = vi.hoisted(() => ({
  loadNotesWorkspaceSnapshot: vi.fn(),
  saveNotesDocument: vi.fn(),
}));

vi.mock('../runtime/notesWorkspaceBackend', async () => {
  const actual = await vi.importActual<typeof import('../runtime/notesWorkspaceBackend')>(
    '../runtime/notesWorkspaceBackend',
  );

  return {
    ...actual,
    loadNotesWorkspaceSnapshot,
    saveNotesDocument,
    createNotesDirectory: vi.fn(),
    createNotesDocument: vi.fn(),
    deleteNotesDirectory: vi.fn(),
    deleteNotesDocument: vi.fn(),
    renameNotesDirectory: vi.fn(),
    renameNotesDocument: vi.fn(),
  };
});

vi.mock('../runtime/explorerBackend', () => ({
  revealExplorerPath: vi.fn(),
}));

vi.mock('../store/settingsStore', () => ({
  useSettingsStore: (selector: (state: {
    settings: {
      keybindings: Record<string, string>;
    };
  }) => unknown) => selector({
    settings: {
      keybindings: {
        saveFile: 'Ctrl+S',
        searchExplorer: 'Ctrl+F',
        newFile: 'Ctrl+N',
        newFolder: 'Ctrl+Shift+N',
        renameItem: 'F2',
        deleteItem: 'Delete',
        revealInExplorer: 'Ctrl+Alt+R',
      },
    },
  }),
}));

vi.mock('../components/ResizablePane', async () => {
  const ReactModule = await import('react');

  return {
    ResizablePane: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
      <div style={style}>{children}</div>
    ),
    usePersistentPanelSize: (_key: string, defaultSize: number) => ReactModule.useState(defaultSize),
  };
});

vi.mock('../components/OverlayScrollArea', () => ({
  OverlayScrollArea: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={style}>{children}</div>
  ),
}));

vi.mock('../components/OverlayActionButton', () => ({
  OverlayActionButton: ({
    children,
    onClick,
    disabled,
    title,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  ),
}));

vi.mock('../components/documentPreview', () => ({
  TextDocumentPreview: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('../components/explorer/ExplorerContextMenu', () => ({
  ExplorerContextMenu: () => null,
}));

vi.mock('../components/notes/NotesRichMarkdownEditor', () => ({
  NotesRichMarkdownEditor: ({
    markdown,
    onMarkdownChange,
    onBlur,
  }: {
    markdown: string;
    onMarkdownChange: (markdown: string) => void;
    onBlur?: () => void;
  }) => (
    <textarea
      aria-label="Rich Markdown Editor"
      value={markdown}
      onChange={(event) => onMarkdownChange(event.target.value)}
      onBlur={() => onBlur?.()}
    />
  ),
}));

import { NotesManager } from '../components/NotesManager';

const notesSnapshot = {
  rootDirectoryPath: '/notes',
  directories: [
    {
      path: '/notes',
      name: 'Notes',
      parentPath: null,
      modifiedAt: 100,
      directDocumentCount: 1,
      recursiveDocumentCount: 1,
      childDirectoryPaths: [],
    },
  ],
  documents: [
    {
      path: '/notes/First Note.md',
      directoryPath: '/notes',
      fileName: 'First Note.md',
      title: 'First Note',
      markdown: 'Original markdown',
      previewText: 'Original markdown',
      wordCount: 2,
      modifiedAt: 100,
      legacyTitleHint: null,
    },
  ],
} as const;

describe('NotesManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loadNotesWorkspaceSnapshot.mockReset();
    saveNotesDocument.mockReset();
    loadNotesWorkspaceSnapshot.mockResolvedValue(notesSnapshot);
    saveNotesDocument.mockResolvedValue(undefined);
  });

  it('coalesces draft edits into one idle save without reloading the workspace', async () => {
    render(
      <NotesManager
        appearance={{
          theme: {
            palette: {
              accent: '#44ff88',
              border: '#2a2a2a',
            },
          },
        } as never}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('First Note')).toBeInTheDocument();

    fireEvent.click(screen.getByText('First Note'));
    await act(async () => {
      await Promise.resolve();
    });

    const editor = screen.getByLabelText('Rich Markdown Editor');
    fireEvent.change(editor, { target: { value: 'First edit' } });
    fireEvent.change(editor, { target: { value: 'Second edit' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1700);
    });
    expect(saveNotesDocument).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(saveNotesDocument).toHaveBeenCalledTimes(1);
    expect(saveNotesDocument).toHaveBeenCalledWith(
      '/notes/First Note.md',
      'Second edit',
    );
    expect(loadNotesWorkspaceSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not render the managed notes root as a selectable folder row', async () => {
    render(
      <NotesManager
        appearance={{
          theme: {
            palette: {
              accent: '#44ff88',
              border: '#2a2a2a',
            },
          },
        } as never}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('First Note')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notes' })).not.toBeInTheDocument();
  });
});
