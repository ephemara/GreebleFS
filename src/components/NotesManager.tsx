import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Search,
  Trash2,
} from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { notesWorkspaceConfig } from '../config/notes';
import {
  createNotesDirectory,
  createNotesDocument,
  deleteNotesDirectory,
  deleteNotesDocument,
  loadNotesWorkspaceSnapshot,
  renameNotesDirectory,
  renameNotesDocument,
  saveNotesDocument,
  type NotesDirectoryRecord,
  type NotesDocumentRecord,
  type NotesWorkspaceSnapshot,
} from '../runtime/notesWorkspaceBackend';
import { revealExplorerPath } from '../runtime/explorerBackend';
import { OverlayActionButton } from './OverlayActionButton';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import { TextDocumentPreview } from './documentPreview';
import { NotesRichMarkdownEditor } from './notes/NotesRichMarkdownEditor';

type NotesViewMode = 'rich' | 'markdown' | 'preview' | 'split';
type NotesSortMode = 'modified' | 'title';

type DirectoryDraftState =
  | { mode: 'create'; parentPath: string; value: string }
  | { mode: 'rename'; path: string; value: string }
  | null;

interface NotesDirectoryNode {
  record: NotesDirectoryRecord;
  children: NotesDirectoryNode[];
}

export function NotesManager({
  appearance,
}: {
  appearance: ResolvedOverlayAppearance;
}) {
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<NotesWorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDirectoryPath, setSelectedDirectoryPath] = useState<string | null>(null);
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string | null>(null);
  const [documentSearchQuery, setDocumentSearchQuery] = useState('');
  const deferredDocumentSearchQuery = useDeferredValue(documentSearchQuery);
  const [sortMode, setSortMode] = useState<NotesSortMode>('modified');
  const [viewMode, setViewMode] = useState<NotesViewMode>('rich');
  const [folderTreeWidth, setFolderTreeWidth] = usePersistentPanelSize('greeblefs-notes-tree-width', 260, 220, 420);
  const [documentListWidth, setDocumentListWidth] = usePersistentPanelSize('greeblefs-notes-list-width', 320, 260, 460);
  const [draftDirectoryState, setDraftDirectoryState] = useState<DirectoryDraftState>(null);
  const [documentTitleDraft, setDocumentTitleDraft] = useState('');
  const [documentMarkdownDraft, setDocumentMarkdownDraft] = useState('');
  const [documentDraftPath, setDocumentDraftPath] = useState<string | null>(null);
  const [isDocumentDirty, setIsDocumentDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  const reloadWorkspace = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const nextSnapshot = await loadNotesWorkspaceSnapshot();
      startTransition(() => {
        setWorkspaceSnapshot(nextSnapshot);
        setLoading(false);
      });
    } catch (error) {
      setLoading(false);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load the notes workspace.');
    }
  }, []);

  useEffect(() => {
    void reloadWorkspace();
  }, [reloadWorkspace]);

  const directoryLookup = useMemo(() => {
    return new Map(
      (workspaceSnapshot?.directories ?? []).map((directory) => [directory.path, directory] as const),
    );
  }, [workspaceSnapshot]);

  const documentLookup = useMemo(() => {
    return new Map(
      (workspaceSnapshot?.documents ?? []).map((document) => [document.path, document] as const),
    );
  }, [workspaceSnapshot]);

  const rootDirectoryPath = workspaceSnapshot?.rootDirectoryPath ?? null;
  const activeDirectoryPath = selectedDirectoryPath ?? rootDirectoryPath;

  const directoryTree = useMemo(() => {
    if (!workspaceSnapshot) {
      return null;
    }

    const nodeLookup = new Map<string, NotesDirectoryNode>();
    for (const directory of workspaceSnapshot.directories) {
      nodeLookup.set(directory.path, {
        record: directory,
        children: [],
      });
    }

    let rootNode: NotesDirectoryNode | null = null;
    for (const directory of workspaceSnapshot.directories) {
      const currentNode = nodeLookup.get(directory.path)!;
      if (!directory.parentPath) {
        rootNode = currentNode;
        continue;
      }

      const parentNode = nodeLookup.get(directory.parentPath);
      if (parentNode) {
        parentNode.children.push(currentNode);
      }
    }

    for (const node of nodeLookup.values()) {
      node.children.sort((left, right) =>
        left.record.name.localeCompare(right.record.name, undefined, {
          sensitivity: 'base',
          numeric: true,
        }),
      );
    }

    return rootNode;
  }, [workspaceSnapshot]);

  useEffect(() => {
    if (!workspaceSnapshot) {
      return;
    }

    if (!selectedDirectoryPath || !directoryLookup.has(selectedDirectoryPath)) {
      setSelectedDirectoryPath(workspaceSnapshot.rootDirectoryPath);
    }

    if (selectedDocumentPath && !documentLookup.has(selectedDocumentPath)) {
      setSelectedDocumentPath(null);
    }
  }, [directoryLookup, documentLookup, selectedDirectoryPath, selectedDocumentPath, workspaceSnapshot]);

  const activeDocumentRecord = selectedDocumentPath
    ? documentLookup.get(selectedDocumentPath) ?? null
    : null;

  useEffect(() => {
    if (!activeDocumentRecord) {
      setDocumentTitleDraft('');
      setDocumentMarkdownDraft('');
      setDocumentDraftPath(null);
      setIsDocumentDirty(false);
      setSaveStatus('idle');
      setSaveErrorMessage(null);
      return;
    }

    setDocumentDraftPath(activeDocumentRecord.path);
    setDocumentTitleDraft(activeDocumentRecord.title);
    setDocumentMarkdownDraft(activeDocumentRecord.markdown);
    setIsDocumentDirty(false);
    setSaveStatus('idle');
    setSaveErrorMessage(null);
  }, [activeDocumentRecord?.path]);

  const documentsInScope = useMemo(() => {
    if (!workspaceSnapshot || !activeDirectoryPath) {
      return [];
    }

    const searchQuery = deferredDocumentSearchQuery.trim().toLowerCase();
    const scopedDocuments = workspaceSnapshot.documents.filter((document) => (
      activeDirectoryPath === workspaceSnapshot.rootDirectoryPath
        ? true
        : document.directoryPath === activeDirectoryPath
    ));

    const filteredDocuments = searchQuery.length === 0
      ? scopedDocuments
      : scopedDocuments.filter((document) => {
          const haystack = `${document.title}\n${document.previewText}\n${document.markdown}`.toLowerCase();
          return haystack.includes(searchQuery);
        });

    return filteredDocuments.sort((left, right) => {
      if (sortMode === 'title') {
        return left.title.localeCompare(right.title, undefined, {
          sensitivity: 'base',
          numeric: true,
        });
      }

      return right.modifiedAt - left.modifiedAt;
    });
  }, [activeDirectoryPath, deferredDocumentSearchQuery, sortMode, workspaceSnapshot]);

  const documentHeadingCount = useMemo(() => {
    return documentMarkdownDraft
      .split('\n')
      .filter((line) => /^#{1,6}\s+\S/.test(line.trim()))
      .length;
  }, [documentMarkdownDraft]);

  const documentWordCount = useMemo(() => {
    return documentMarkdownDraft.trim().length === 0
      ? 0
      : documentMarkdownDraft
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .length;
  }, [documentMarkdownDraft]);

  const activeDirectoryLabel = useMemo(() => {
    if (!activeDirectoryPath || !workspaceSnapshot) {
      return 'Notes';
    }

    if (activeDirectoryPath === workspaceSnapshot.rootDirectoryPath) {
      return 'All Notes';
    }

    return directoryLookup.get(activeDirectoryPath)?.name ?? 'Folder';
  }, [activeDirectoryPath, directoryLookup, workspaceSnapshot]);

  const handleSelectDirectory = useCallback((directoryPath: string) => {
    setSelectedDirectoryPath(directoryPath);

    if (!workspaceSnapshot) {
      return;
    }

    if (!selectedDocumentPath) {
      return;
    }

    const selectedDocument = documentLookup.get(selectedDocumentPath);
    if (!selectedDocument) {
      setSelectedDocumentPath(null);
      return;
    }

    const isDocumentStillVisible = directoryPath === workspaceSnapshot.rootDirectoryPath
      || selectedDocument.directoryPath === directoryPath;

    if (!isDocumentStillVisible) {
      setSelectedDocumentPath(null);
    }
  }, [documentLookup, selectedDocumentPath, workspaceSnapshot]);

  const handleDraftMarkdownChange = useCallback((nextMarkdown: string) => {
    setDocumentMarkdownDraft(nextMarkdown);
    setIsDocumentDirty(true);
    setSaveStatus('idle');
    setSaveErrorMessage(null);
  }, []);

  useEffect(() => {
    if (!documentDraftPath || documentDraftPath !== selectedDocumentPath || !isDocumentDirty) {
      return;
    }

    setSaveStatus('saving');
    setSaveErrorMessage(null);

    const saveTimer = window.setTimeout(() => {
      void (async () => {
        try {
          await saveNotesDocument(documentDraftPath, documentMarkdownDraft);
          setIsDocumentDirty(false);
          setSaveStatus('saved');
          await reloadWorkspace();
        } catch (error) {
          setSaveStatus('error');
          setSaveErrorMessage(error instanceof Error ? error.message : 'Unable to save the note.');
        }
      })();
    }, 550);

    return () => window.clearTimeout(saveTimer);
  }, [documentDraftPath, documentMarkdownDraft, isDocumentDirty, reloadWorkspace, selectedDocumentPath]);

  const handleCreateDirectory = useCallback((parentPath: string) => {
    setDraftDirectoryState({
      mode: 'create',
      parentPath,
      value: notesWorkspaceConfig.defaultDirectoryName,
    });
  }, []);

  const commitDirectoryDraft = useCallback(async () => {
    if (!draftDirectoryState) {
      return;
    }

    try {
      if (draftDirectoryState.mode === 'create') {
        const nextDirectoryPath = await createNotesDirectory(
          draftDirectoryState.parentPath,
          draftDirectoryState.value,
        );
        setSelectedDirectoryPath(nextDirectoryPath);
      } else {
        const nextDirectoryPath = await renameNotesDirectory(
          draftDirectoryState.path,
          draftDirectoryState.value,
        );
        setSelectedDirectoryPath((currentPath) => (
          currentPath === draftDirectoryState.path ? nextDirectoryPath : currentPath
        ));
      }

      setDraftDirectoryState(null);
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update the folder.');
    }
  }, [draftDirectoryState, reloadWorkspace]);

  const handleDeleteDirectory = useCallback(async (directoryPath: string, directoryName: string) => {
    const confirmed = window.confirm(`Delete the folder "${directoryName}" and every note inside it?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteNotesDirectory(directoryPath);
      setSelectedDirectoryPath(rootDirectoryPath);
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete the folder.');
    }
  }, [reloadWorkspace, rootDirectoryPath]);

  const handleCreateDocument = useCallback(async () => {
    if (!workspaceSnapshot || !activeDirectoryPath) {
      return;
    }

    try {
      const targetDirectoryPath = activeDirectoryPath === workspaceSnapshot.rootDirectoryPath
        ? workspaceSnapshot.rootDirectoryPath
        : activeDirectoryPath;
      const nextDocumentPath = await createNotesDocument(targetDirectoryPath);
      setSelectedDocumentPath(nextDocumentPath);
      setViewMode('rich');
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create the note.');
    }
  }, [activeDirectoryPath, reloadWorkspace, workspaceSnapshot]);

  const commitDocumentTitle = useCallback(async () => {
    if (!selectedDocumentPath || !documentTitleDraft.trim()) {
      if (activeDocumentRecord) {
        setDocumentTitleDraft(activeDocumentRecord.title);
      }
      return;
    }

    if (activeDocumentRecord && documentTitleDraft.trim() === activeDocumentRecord.title.trim()) {
      return;
    }

    try {
      const nextDocumentPath = await renameNotesDocument(selectedDocumentPath, documentTitleDraft);
      await saveNotesDocument(nextDocumentPath, documentMarkdownDraft);
      setSelectedDocumentPath(nextDocumentPath);
      setDocumentDraftPath(nextDocumentPath);
      setIsDocumentDirty(false);
      setSaveStatus('saved');
      await reloadWorkspace();
    } catch (error) {
      setSaveStatus('error');
      setSaveErrorMessage(error instanceof Error ? error.message : 'Unable to rename the note.');
    }
  }, [activeDocumentRecord, documentMarkdownDraft, documentTitleDraft, reloadWorkspace, selectedDocumentPath]);

  const handleDeleteDocument = useCallback(async () => {
    if (!activeDocumentRecord) {
      return;
    }

    const confirmed = window.confirm(`Delete the note "${activeDocumentRecord.title}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteNotesDocument(activeDocumentRecord.path);
      setSelectedDocumentPath(null);
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete the note.');
    }
  }, [activeDocumentRecord, reloadWorkspace]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!documentMarkdownDraft) {
      return;
    }

    try {
      await navigator.clipboard.writeText(documentMarkdownDraft);
    } catch (error) {
      setSaveStatus('error');
      setSaveErrorMessage(error instanceof Error ? error.message : 'Unable to copy markdown.');
    }
  }, [documentMarkdownDraft]);

  const activeDirectoryRecord = activeDirectoryPath ? directoryLookup.get(activeDirectoryPath) ?? null : null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        height: '100%',
        minHeight: 0,
        background: 'var(--overlay-bg-shell)',
        color: 'var(--overlay-text-primary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--overlay-border)',
          background:
            `linear-gradient(135deg, color-mix(in srgb, ${appearance.theme.palette.accent} 14%, transparent), transparent 42%), ` +
            'var(--overlay-bg-panel)',
        }}
      >
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Notes Workspace
          </div>
          <div style={{ fontSize: 12, color: 'var(--overlay-text-muted)' }}>
            Folder-first markdown notes with rich editing, source mode, and live preview.
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <OverlayActionButton appearance={appearance} tone="neutral" size="compact" onClick={() => handleCreateDirectory(activeDirectoryPath ?? rootDirectoryPath ?? '')}>
            <FolderPlus size={12} />
            New Folder
          </OverlayActionButton>
          <OverlayActionButton appearance={appearance} tone="accent" size="compact" onClick={handleCreateDocument}>
            <FilePlus size={12} />
            New Note
          </OverlayActionButton>
          <OverlayActionButton appearance={appearance} tone="quiet" size="compact" onClick={() => void reloadWorkspace()}>
            <RefreshCw size={12} />
            Refresh
          </OverlayActionButton>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        <ResizablePane
          size={folderTreeWidth}
          minSize={220}
          maxSize={420}
          onSizeChange={setFolderTreeWidth}
          borderColor={`${appearance.theme.palette.border}`}
          style={{
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            background: 'var(--overlay-bg-panel)',
            borderRight: '1px solid var(--overlay-border)',
          }}
        >
          <PaneHeader
            title="Folders"
            subtitle={activeDirectoryRecord?.recursiveDocumentCount ?? workspaceSnapshot?.documents.length ?? 0}
            subtitleLabel="notes"
          />
          <OverlayScrollArea style={{ minHeight: 0 }}>
            {directoryTree ? (
              <div style={{ padding: '10px 10px 20px' }}>
                <NotesDirectoryTreeItem
                  appearance={appearance}
                  node={directoryTree}
                  selectedDirectoryPath={activeDirectoryPath}
                  draftDirectoryState={draftDirectoryState}
                  onSelectDirectory={handleSelectDirectory}
                  onStartCreateDirectory={handleCreateDirectory}
                  onStartRenameDirectory={(directory) => {
                    setDraftDirectoryState({
                      mode: 'rename',
                      path: directory.path,
                      value: directory.name,
                    });
                  }}
                  onDeleteDirectory={handleDeleteDirectory}
                  onChangeDraftValue={(value) => {
                    setDraftDirectoryState((currentState) => currentState ? { ...currentState, value } : currentState);
                  }}
                  onCommitDraft={() => void commitDirectoryDraft()}
                  onCancelDraft={() => setDraftDirectoryState(null)}
                  depth={0}
                />
              </div>
            ) : (
              <PaneEmptyMessage label="Loading folders…" />
            )}
          </OverlayScrollArea>
        </ResizablePane>

        <ResizablePane
          size={documentListWidth}
          minSize={260}
          maxSize={460}
          onSizeChange={setDocumentListWidth}
          borderColor={`${appearance.theme.palette.border}`}
          style={{
            display: 'grid',
            gridTemplateRows: 'auto auto minmax(0, 1fr)',
            background: 'var(--overlay-bg-sidebar)',
            borderRight: '1px solid var(--overlay-border)',
          }}
        >
          <PaneHeader
            title={activeDirectoryLabel}
            subtitle={documentsInScope.length}
            subtitleLabel="shown"
          />
          <div style={{ display: 'grid', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--overlay-border)' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 36,
                padding: '0 12px',
                borderRadius: 12,
                border: '1px solid var(--overlay-border)',
                background: 'color-mix(in srgb, var(--overlay-bg-card) 88%, transparent)',
              }}
            >
              <Search size={12} style={{ color: 'var(--overlay-text-muted)' }} />
              <input
                value={documentSearchQuery}
                onChange={(event) => setDocumentSearchQuery(event.target.value)}
                placeholder="Search titles, snippets, and markdown"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--overlay-text-primary)',
                  fontSize: 12,
                }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <OverlayActionButton
                appearance={appearance}
                tone={sortMode === 'modified' ? 'accent' : 'quiet'}
                size="compact"
                active={sortMode === 'modified'}
                onClick={() => setSortMode('modified')}
              >
                Recent
              </OverlayActionButton>
              <OverlayActionButton
                appearance={appearance}
                tone={sortMode === 'title' ? 'accent' : 'quiet'}
                size="compact"
                active={sortMode === 'title'}
                onClick={() => setSortMode('title')}
              >
                A-Z
              </OverlayActionButton>
            </div>
          </div>

          <OverlayScrollArea style={{ minHeight: 0 }}>
            {loading ? (
              <PaneEmptyMessage label="Loading notes…" />
            ) : documentsInScope.length === 0 ? (
              <PaneEmptyMessage label={documentSearchQuery ? 'No notes match this query.' : 'No notes in this folder yet.'} />
            ) : (
              <div style={{ padding: '10px 10px 20px', display: 'grid', gap: 8 }}>
                {documentsInScope.map((document) => (
                  <NotesDocumentListItem
                    key={document.path}
                    appearance={appearance}
                    document={document}
                    isSelected={selectedDocumentPath === document.path}
                    showDirectoryLabel={activeDirectoryPath === rootDirectoryPath}
                    onSelect={() => setSelectedDocumentPath(document.path)}
                  />
                ))}
              </div>
            )}
          </OverlayScrollArea>
        </ResizablePane>

        <div style={{ display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr) auto', minHeight: 0, flex: 1 }}>
          <div
            style={{
              display: 'grid',
              gap: 8,
              padding: '16px 20px 14px',
              borderBottom: '1px solid var(--overlay-border)',
              background: 'var(--overlay-bg-panel)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={documentTitleDraft}
                onChange={(event) => setDocumentTitleDraft(event.target.value)}
                onBlur={() => void commitDocumentTitle()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void commitDocumentTitle();
                  }
                  if (event.key === 'Escape' && activeDocumentRecord) {
                    setDocumentTitleDraft(activeDocumentRecord.title);
                  }
                }}
                disabled={!activeDocumentRecord}
                placeholder={notesWorkspaceConfig.defaultDocumentTitle}
                style={{
                  flex: 1,
                  minWidth: 220,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--overlay-text-primary)',
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                }}
              />

              {activeDocumentRecord ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <OverlayActionButton appearance={appearance} tone={viewMode === 'rich' ? 'accent' : 'quiet'} size="compact" active={viewMode === 'rich'} onClick={() => setViewMode('rich')}>
                    Edit
                  </OverlayActionButton>
                  <OverlayActionButton appearance={appearance} tone={viewMode === 'markdown' ? 'accent' : 'quiet'} size="compact" active={viewMode === 'markdown'} onClick={() => setViewMode('markdown')}>
                    Markdown
                  </OverlayActionButton>
                  <OverlayActionButton appearance={appearance} tone={viewMode === 'preview' ? 'accent' : 'quiet'} size="compact" active={viewMode === 'preview'} onClick={() => setViewMode('preview')}>
                    <Eye size={12} />
                    Preview
                  </OverlayActionButton>
                  <OverlayActionButton appearance={appearance} tone={viewMode === 'split' ? 'accent' : 'quiet'} size="compact" active={viewMode === 'split'} onClick={() => setViewMode('split')}>
                    Split
                  </OverlayActionButton>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: 'var(--overlay-text-muted)', fontSize: 11 }}>
              {activeDocumentRecord ? (
                <>
                  <span>{formatRelativeTimestamp(activeDocumentRecord.modifiedAt)}</span>
                  <span>{documentWordCount} words</span>
                  <span>{documentMarkdownDraft.length} chars</span>
                  <span>{documentHeadingCount} headings</span>
                  <span>{activeDocumentRecord.directoryPath.replace(/\\/g, '/')}</span>
                </>
              ) : (
                <span>Select a note or create a new one.</span>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              padding: '12px 20px',
              borderBottom: '1px solid var(--overlay-border)',
              background: 'color-mix(in srgb, var(--overlay-bg-panel) 86%, transparent)',
            }}
          >
            <OverlayActionButton appearance={appearance} tone="accent" size="compact" onClick={handleCreateDocument}>
              <FilePlus size={12} />
              New Note
            </OverlayActionButton>
            <OverlayActionButton appearance={appearance} tone="quiet" size="compact" disabled={!activeDocumentRecord} onClick={() => void handleCopyMarkdown()}>
              <Copy size={12} />
              Copy Markdown
            </OverlayActionButton>
            <OverlayActionButton appearance={appearance} tone="quiet" size="compact" disabled={!activeDocumentRecord} onClick={() => activeDocumentRecord ? void revealExplorerPath(activeDocumentRecord.path) : undefined}>
              <FolderOpen size={12} />
              Reveal
            </OverlayActionButton>
            <OverlayActionButton appearance={appearance} tone="danger" size="compact" disabled={!activeDocumentRecord} onClick={() => void handleDeleteDocument()}>
              <Trash2 size={12} />
              Delete
            </OverlayActionButton>
          </div>

          <div style={{ minHeight: 0, background: 'var(--overlay-bg-panel)' }}>
            {!activeDocumentRecord ? (
              <EmptyWorkspaceSurface
                appearance={appearance}
                onCreateDocument={handleCreateDocument}
                onCreateDirectory={() => handleCreateDirectory(activeDirectoryPath ?? rootDirectoryPath ?? '')}
              />
            ) : viewMode === 'rich' ? (
              <NotesRichMarkdownEditor
                appearance={appearance}
                markdown={documentMarkdownDraft}
                onMarkdownChange={handleDraftMarkdownChange}
              />
            ) : viewMode === 'markdown' ? (
              <textarea
                value={documentMarkdownDraft}
                onChange={(event) => handleDraftMarkdownChange(event.target.value)}
                spellCheck
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  padding: '24px 28px 96px',
                  background:
                    `linear-gradient(180deg, color-mix(in srgb, ${appearance.theme.palette.accent} 10%, transparent), transparent 160px), var(--overlay-bg-panel)`,
                  color: 'var(--overlay-text-primary)',
                  fontFamily: 'var(--overlay-font-mono, "JetBrains Mono", monospace)',
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              />
            ) : viewMode === 'preview' ? (
              <TextDocumentPreview kind="markdown" content={documentMarkdownDraft} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', height: '100%', minHeight: 0 }}>
                <textarea
                  value={documentMarkdownDraft}
                  onChange={(event) => handleDraftMarkdownChange(event.target.value)}
                  spellCheck
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    padding: '24px 28px 96px',
                    background: 'var(--overlay-bg-panel)',
                    color: 'var(--overlay-text-primary)',
                    fontFamily: 'var(--overlay-font-mono, "JetBrains Mono", monospace)',
                    fontSize: 13,
                    lineHeight: 1.7,
                    borderRight: '1px solid var(--overlay-border)',
                  }}
                />
                <TextDocumentPreview kind="markdown" content={documentMarkdownDraft} />
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 20px',
              borderTop: '1px solid var(--overlay-border)',
              background: 'var(--overlay-bg-panel)',
              color: 'var(--overlay-text-muted)',
              fontSize: 11,
            }}
          >
            <span>
              {saveStatus === 'saving' ? 'Saving markdown…' : saveStatus === 'saved' ? 'Saved to disk.' : saveStatus === 'error' ? 'Save failed.' : activeDocumentRecord ? 'Ready.' : 'No note selected.'}
            </span>
            <span>
              {saveErrorMessage ?? errorMessage ?? ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaneHeader({
  title,
  subtitle,
  subtitleLabel,
}: {
  title: string;
  subtitle: number;
  subtitleLabel: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 14px 12px',
        borderBottom: '1px solid var(--overlay-border)',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {title}
      </span>
      <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
        {subtitle} {subtitleLabel}
      </span>
    </div>
  );
}

function PaneEmptyMessage({
  label,
}: {
  label: string;
}) {
  return (
    <div
      style={{
        padding: '26px 18px',
        color: 'var(--overlay-text-muted)',
        fontSize: 12,
      }}
    >
      {label}
    </div>
  );
}

function NotesDirectoryTreeItem({
  appearance,
  node,
  selectedDirectoryPath,
  draftDirectoryState,
  onSelectDirectory,
  onStartCreateDirectory,
  onStartRenameDirectory,
  onDeleteDirectory,
  onChangeDraftValue,
  onCommitDraft,
  onCancelDraft,
  depth,
}: {
  appearance: ResolvedOverlayAppearance;
  node: NotesDirectoryNode;
  selectedDirectoryPath: string | null;
  draftDirectoryState: DirectoryDraftState;
  onSelectDirectory: (directoryPath: string) => void;
  onStartCreateDirectory: (directoryPath: string) => void;
  onStartRenameDirectory: (directory: NotesDirectoryRecord) => void;
  onDeleteDirectory: (directoryPath: string, directoryName: string) => void;
  onChangeDraftValue: (value: string) => void;
  onCommitDraft: () => void;
  onCancelDraft: () => void;
  depth: number;
}) {
  const isSelected = selectedDirectoryPath === node.record.path;
  const isDraftCreateRowVisible = draftDirectoryState?.mode === 'create' && draftDirectoryState.parentPath === node.record.path;
  const isRenameActive = draftDirectoryState?.mode === 'rename' && draftDirectoryState.path === node.record.path;
  const canDelete = node.record.parentPath !== null;
  const isExpanded = true;

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {isRenameActive ? (
          <div style={{ paddingLeft: `${12 + depth * 16}px` }}>
            <InlineDraftInput
              value={draftDirectoryState?.value ?? ''}
              onChange={onChangeDraftValue}
              onCommit={onCommitDraft}
              onCancel={onCancelDraft}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelectDirectory(node.record.path)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto auto minmax(0, 1fr)',
              alignItems: 'center',
              gap: 8,
              minHeight: 38,
              padding: `0 10px 0 ${12 + depth * 16}px`,
              borderRadius: 12,
              border: '1px solid transparent',
              background: isSelected ? `${appearance.theme.palette.accent}1a` : 'transparent',
              color: isSelected ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {node.children.length > 0 ? (
              isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            ) : (
              <span style={{ width: 12 }} />
            )}
            {isSelected ? <FolderOpen size={14} /> : <Folder size={14} />}
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, minWidth: 0, width: '100%' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.record.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
                {node.record.recursiveDocumentCount}
              </span>
            </span>
          </button>
        )}
        {canDelete ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <OverlayActionButton appearance={appearance} tone="quiet" size="compact" onClick={() => onStartCreateDirectory(node.record.path)}>
              <FolderPlus size={12} />
            </OverlayActionButton>
            <OverlayActionButton appearance={appearance} tone="quiet" size="compact" onClick={() => onStartRenameDirectory(node.record)}>
              Rename
            </OverlayActionButton>
            <OverlayActionButton appearance={appearance} tone="danger" size="compact" onClick={() => onDeleteDirectory(node.record.path, node.record.name)}>
              <Trash2 size={12} />
            </OverlayActionButton>
          </div>
        ) : (
          <OverlayActionButton appearance={appearance} tone="quiet" size="compact" onClick={() => onStartCreateDirectory(node.record.path)}>
            <FolderPlus size={12} />
          </OverlayActionButton>
        )}
      </div>

      {isDraftCreateRowVisible ? (
        <div style={{ paddingLeft: `${36 + depth * 16}px` }}>
          <InlineDraftInput
            value={draftDirectoryState?.value ?? ''}
            onChange={onChangeDraftValue}
            onCommit={onCommitDraft}
            onCancel={onCancelDraft}
          />
        </div>
      ) : null}

      {node.children.length > 0 ? (
        <div style={{ display: 'grid', gap: 4 }}>
          {node.children.map((childNode) => (
            <NotesDirectoryTreeItem
              key={childNode.record.path}
              appearance={appearance}
              node={childNode}
              selectedDirectoryPath={selectedDirectoryPath}
              draftDirectoryState={draftDirectoryState}
              onSelectDirectory={onSelectDirectory}
              onStartCreateDirectory={onStartCreateDirectory}
              onStartRenameDirectory={onStartRenameDirectory}
              onDeleteDirectory={onDeleteDirectory}
              onChangeDraftValue={onChangeDraftValue}
              onCommitDraft={onCommitDraft}
              onCancelDraft={onCancelDraft}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NotesDocumentListItem({
  appearance,
  document,
  isSelected,
  showDirectoryLabel,
  onSelect,
}: {
  appearance: ResolvedOverlayAppearance;
  document: NotesDocumentRecord;
  isSelected: boolean;
  showDirectoryLabel: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'grid',
        gap: 8,
        width: '100%',
        padding: '12px 14px',
        borderRadius: 14,
        border: `1px solid ${isSelected ? `${appearance.theme.palette.accent}66` : 'var(--overlay-border)'}`,
        background: isSelected ? `${appearance.theme.palette.accent}12` : 'color-mix(in srgb, var(--overlay-bg-card) 88%, transparent)',
        color: 'var(--overlay-text-primary)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FileText size={14} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {document.title}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--overlay-text-muted)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {document.previewText || 'Empty note.'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--overlay-text-muted)' }}>
        <span>{formatRelativeTimestamp(document.modifiedAt)}</span>
        <span>{document.wordCount} words</span>
        {showDirectoryLabel ? (
          <span>{document.directoryPath.replace(/\\/g, '/')}</span>
        ) : null}
      </div>
    </button>
  );
}

function InlineDraftInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => handleInlineDraftInputKeyDown(event, onCommit, onCancel)}
      style={{
        width: '100%',
        minHeight: 34,
        padding: '0 10px',
        borderRadius: 10,
        border: '1px solid var(--overlay-accent)',
        background: 'var(--overlay-bg-shell)',
        color: 'var(--overlay-text-primary)',
        fontSize: 12,
        outline: 'none',
      }}
    />
  );
}

function EmptyWorkspaceSurface({
  appearance,
  onCreateDocument,
  onCreateDirectory,
}: {
  appearance: ResolvedOverlayAppearance;
  onCreateDocument: () => void;
  onCreateDirectory: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        height: '100%',
        padding: 24,
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: 18,
          width: 'min(540px, 100%)',
          padding: '28px 30px',
          borderRadius: 24,
          border: '1px solid var(--overlay-border)',
          background:
            `radial-gradient(circle at top right, color-mix(in srgb, ${appearance.theme.palette.accent} 16%, transparent), transparent 30%), ` +
            'color-mix(in srgb, var(--overlay-bg-card) 90%, transparent)',
        }}
      >
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderOpen size={18} />
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Start a markdown notebook, not a SaaS checklist.
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--overlay-text-muted)' }}>
            Create folders for projects, specs, references, or research. Notes stay as plain markdown files on disk, with rich editing when you want it and raw markdown when you need it.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <OverlayActionButton appearance={appearance} tone="accent" onClick={onCreateDocument}>
            <FilePlus size={12} />
            New Note
          </OverlayActionButton>
          <OverlayActionButton appearance={appearance} tone="neutral" onClick={onCreateDirectory}>
            <FolderPlus size={12} />
            New Folder
          </OverlayActionButton>
        </div>
      </div>
    </div>
  );
}

function handleInlineDraftInputKeyDown(
  event: ReactKeyboardEvent<HTMLInputElement>,
  onCommit: () => void,
  onCancel: () => void,
) {
  if (event.key === 'Enter') {
    event.preventDefault();
    onCommit();
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    onCancel();
  }
}

function formatRelativeTimestamp(timestamp: number): string {
  const elapsed = Date.now() - timestamp;

  if (elapsed < 60_000) {
    return 'just now';
  }

  if (elapsed < 3_600_000) {
    return `${Math.floor(elapsed / 60_000)}m ago`;
  }

  if (elapsed < 86_400_000) {
    return `${Math.floor(elapsed / 3_600_000)}h ago`;
  }

  if (elapsed < 604_800_000) {
    return `${Math.floor(elapsed / 86_400_000)}d ago`;
  }

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: new Date(timestamp).getFullYear() !== new Date().getFullYear()
      ? 'numeric'
      : undefined,
  });
}
