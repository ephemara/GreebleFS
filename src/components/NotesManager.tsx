import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
} from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { formatHotkeyLabel, matchesKeybinding } from '../config/hotkeys';
import { notesWorkspaceConfig } from '../config/notes';
import { resolveEventTargetElement } from '../runtime/documentInteractionGuards';
import { revealExplorerPath } from '../runtime/explorerBackend';
import {
  createNotesDirectory,
  createNotesDocument,
  deleteNotesDirectory,
  deleteNotesDocument,
  loadNotesWorkspaceSnapshot,
  renameNotesDirectory,
  renameNotesDocument,
  saveNotesDocument,
  summarizeNotesMarkdown,
  type NotesDirectoryRecord,
  type NotesDocumentRecord,
  type NotesWorkspaceSnapshot,
} from '../runtime/notesWorkspaceBackend';
import { useSettingsStore } from '../store/settingsStore';
import { AppConfirmDialog, AppPromptDialog } from './AppModal';
import { OverlayActionButton } from './OverlayActionButton';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import { TextDocumentPreview } from './documentPreview';
import { ExplorerContextMenu } from './explorer/ExplorerContextMenu';
import type { ExplorerRuntimeMenuNode } from './explorer/explorerMenuRuntime';
import { NotesRichMarkdownEditor } from './notes/NotesRichMarkdownEditor';

type NotesViewMode = 'rich' | 'markdown' | 'preview' | 'split';
type NotesSortMode = 'modified' | 'title';
type NotesSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface NotesWorkspaceTreeNode {
  directory: NotesDirectoryRecord;
  children: NotesWorkspaceTreeNode[];
  documents: NotesDocumentRecord[];
}

type NotesPromptDialogAction =
  | {
      kind: 'create-directory';
      parentPath: string;
      value: string;
      title: string;
      description: string;
      submitLabel: string;
    }
  | {
      kind: 'rename-directory';
      directoryPath: string;
      value: string;
      title: string;
      description: string;
      submitLabel: string;
    }
  | {
      kind: 'rename-document';
      documentPath: string;
      value: string;
      title: string;
      description: string;
      submitLabel: string;
    };

type NotesConfirmDialogAction =
  | { kind: 'delete-directory'; directoryPath: string; directoryName: string }
  | { kind: 'delete-document'; documentPath: string; documentTitle: string };

type NotesContextMenuTarget =
  | { kind: 'background' }
  | { kind: 'directory'; directoryPath: string }
  | { kind: 'document'; documentPath: string };

interface NotesContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  target: NotesContextMenuTarget | null;
}

const NOTES_AUTOSAVE_IDLE_MS = 1800;
const NOTES_EXPANDED_DIRECTORIES_STORAGE_KEY = 'greeblefs-notes-expanded-directories';

export function NotesManager({
  appearance,
}: {
  appearance: ResolvedOverlayAppearance;
}) {
  const keybindings = useSettingsStore((state) => state.settings.keybindings);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<NotesWorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDirectoryPath, setSelectedDirectoryPath] = useState<string | null>(null);
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string | null>(null);
  const [documentSearchQuery, setDocumentSearchQuery] = useState('');
  const deferredDocumentSearchQuery = useDeferredValue(documentSearchQuery);
  const [sortMode, setSortMode] = useState<NotesSortMode>('modified');
  const [viewMode, setViewMode] = useState<NotesViewMode>('rich');
  const [sidebarWidth, setSidebarWidth] = usePersistentPanelSize(
    'greeblefs-notes-sidebar-width',
    320,
    248,
    520,
  );
  const [expandedDirectoryPaths, setExpandedDirectoryPaths] = useState<string[]>(
    () => readPersistedExpandedDirectoryPaths(),
  );
  const [promptAction, setPromptAction] = useState<NotesPromptDialogAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<NotesConfirmDialogAction | null>(null);
  const [contextMenu, setContextMenu] = useState<NotesContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    target: null,
  });
  const [documentDraftPath, setDocumentDraftPath] = useState<string | null>(null);
  const [documentMarkdownDraft, setDocumentMarkdownDraft] = useState('');
  const [saveStatus, setSaveStatus] = useState<NotesSaveStatus>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedDocumentPathRef = useRef<string | null>(null);
  const draftPathRef = useRef<string | null>(null);
  const draftMarkdownRef = useRef('');
  const lastSavedMarkdownRef = useRef('');
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);

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

  const directoryLookup = useMemo(() => (
    new Map((workspaceSnapshot?.directories ?? []).map((directory) => [directory.path, directory] as const))
  ), [workspaceSnapshot]);

  const documentLookup = useMemo(() => (
    new Map((workspaceSnapshot?.documents ?? []).map((document) => [document.path, document] as const))
  ), [workspaceSnapshot]);

  const rootDirectoryPath = workspaceSnapshot?.rootDirectoryPath ?? null;
  const activeDocumentRecord = selectedDocumentPath
    ? documentLookup.get(selectedDocumentPath) ?? null
    : null;
  const activeDirectoryPath = selectedDirectoryPath
    ?? activeDocumentRecord?.directoryPath
    ?? rootDirectoryPath;
  const activeDirectoryRecord = activeDirectoryPath
    ? directoryLookup.get(activeDirectoryPath) ?? null
    : null;
  const activeDirectoryLabel = activeDirectoryPath && rootDirectoryPath
    ? getDirectoryDisplayName(activeDirectoryPath, rootDirectoryPath, directoryLookup)
    : 'Notes';
  const isSearchActive = deferredDocumentSearchQuery.trim().length > 0;

  useEffect(() => {
    selectedDocumentPathRef.current = selectedDocumentPath;
  }, [selectedDocumentPath]);

  useEffect(() => {
    draftPathRef.current = documentDraftPath;
  }, [documentDraftPath]);

  useEffect(() => {
    draftMarkdownRef.current = documentMarkdownDraft;
  }, [documentMarkdownDraft]);

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

  useEffect(() => {
    if (!activeDocumentRecord) {
      setDocumentDraftPath(null);
      setDocumentMarkdownDraft('');
      lastSavedMarkdownRef.current = '';
      draftPathRef.current = null;
      draftMarkdownRef.current = '';
      setSaveStatus('idle');
      setSaveErrorMessage(null);
      return;
    }

    setDocumentDraftPath(activeDocumentRecord.path);
    setDocumentMarkdownDraft(activeDocumentRecord.markdown);
    draftPathRef.current = activeDocumentRecord.path;
    draftMarkdownRef.current = activeDocumentRecord.markdown;
    lastSavedMarkdownRef.current = activeDocumentRecord.markdown;
    setSaveStatus('saved');
    setSaveErrorMessage(null);
  }, [activeDocumentRecord?.path]);

  const matchingDocumentPathSet = useMemo(() => {
    const documents = workspaceSnapshot?.documents ?? [];
    const normalizedQuery = deferredDocumentSearchQuery.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return new Set(documents.map((document) => document.path));
    }

    return new Set(
      documents
        .filter((document) => matchesNotesDocumentQuery(document, normalizedQuery))
        .map((document) => document.path),
    );
  }, [deferredDocumentSearchQuery, workspaceSnapshot]);

  const documentComparator = useMemo(
    () => createNotesDocumentComparator(sortMode),
    [sortMode],
  );

  const directoryTree = useMemo(() => {
    if (!workspaceSnapshot) {
      return null;
    }

    return buildNotesWorkspaceTree({
      snapshot: workspaceSnapshot,
      documentComparator,
      matchingDocumentPathSet,
      hideEmptyDirectories: isSearchActive,
    });
  }, [documentComparator, isSearchActive, matchingDocumentPathSet, workspaceSnapshot]);

  const visibleDocumentCount = useMemo(
    () => matchingDocumentPathSet.size,
    [matchingDocumentPathSet],
  );

  useEffect(() => {
    if (!rootDirectoryPath) {
      return;
    }

    const directoryPathsToKeepExpanded = new Set<string>([rootDirectoryPath]);
    for (const path of collectDirectoryAncestorPaths(activeDirectoryPath, directoryLookup)) {
      directoryPathsToKeepExpanded.add(path);
    }
    for (const path of collectDirectoryAncestorPaths(activeDocumentRecord?.directoryPath ?? null, directoryLookup)) {
      directoryPathsToKeepExpanded.add(path);
    }

    setExpandedDirectoryPaths((currentPaths) => mergeExpandedDirectoryPaths(
      currentPaths,
      [...directoryPathsToKeepExpanded],
    ));
  }, [activeDirectoryPath, activeDocumentRecord?.path, directoryLookup, rootDirectoryPath]);

  useEffect(() => {
    persistExpandedDirectoryPaths(expandedDirectoryPaths);
  }, [expandedDirectoryPaths]);

  const documentHeadingCount = useMemo(() => {
    return documentMarkdownDraft
      .split('\n')
      .filter((line) => /^#{1,6}\s+\S/.test(line.trim()))
      .length;
  }, [documentMarkdownDraft]);

  const documentWordCount = useMemo(() => {
    return documentMarkdownDraft.trim().length === 0
      ? 0
      : documentMarkdownDraft.trim().split(/\s+/).filter(Boolean).length;
  }, [documentMarkdownDraft]);

  const applySavedDocumentToWorkspace = useCallback((
    documentPath: string,
    markdown: string,
    modifiedAt = Date.now(),
  ) => {
    const summary = summarizeNotesMarkdown(markdown);
    setWorkspaceSnapshot((currentSnapshot) => {
      if (!currentSnapshot) {
        return currentSnapshot;
      }

      return {
        ...currentSnapshot,
        documents: currentSnapshot.documents.map((document) => (
          document.path === documentPath
            ? {
                ...document,
                markdown,
                previewText: summary.previewText,
                wordCount: summary.wordCount,
                modifiedAt,
              }
            : document
        )),
      };
    });
  }, []);

  const flushDocumentSave = useCallback(async function flushDocumentSaveInternal(): Promise<boolean> {
    if (saveInFlightRef.current) {
      const pendingResult = await saveInFlightRef.current;
      if (!pendingResult) {
        return false;
      }

      const hasMoreDraftChanges = Boolean(
        draftPathRef.current
        && draftPathRef.current === selectedDocumentPathRef.current
        && draftMarkdownRef.current !== lastSavedMarkdownRef.current,
      );
      return hasMoreDraftChanges ? flushDocumentSaveInternal() : true;
    }

    const activePath = draftPathRef.current;
    const activeSelectedPath = selectedDocumentPathRef.current;
    const markdownToSave = draftMarkdownRef.current;
    const needsSave = Boolean(
      activePath
      && activePath === activeSelectedPath
      && markdownToSave !== lastSavedMarkdownRef.current,
    );

    if (!needsSave) {
      if (activePath && activePath === activeSelectedPath) {
        setSaveStatus(markdownToSave === lastSavedMarkdownRef.current ? 'saved' : 'dirty');
      }
      return true;
    }

    const savePromise = (async (): Promise<boolean> => {
      setSaveStatus('saving');
      setSaveErrorMessage(null);

      try {
        await saveNotesDocument(activePath!, markdownToSave);
        applySavedDocumentToWorkspace(activePath!, markdownToSave);

        if (draftPathRef.current === activePath) {
          lastSavedMarkdownRef.current = markdownToSave;
          const stillDirty = draftMarkdownRef.current !== markdownToSave;
          setSaveStatus(stillDirty ? 'dirty' : 'saved');
        }

        return true;
      } catch (error) {
        setSaveStatus('error');
        setSaveErrorMessage(error instanceof Error ? error.message : 'Unable to save the note.');
        return false;
      } finally {
        saveInFlightRef.current = null;
      }
    })();

    saveInFlightRef.current = savePromise;
    const saveSucceeded = await savePromise;
    if (!saveSucceeded) {
      return false;
    }

    const hasMoreDraftChanges = Boolean(
      draftPathRef.current
      && draftPathRef.current === selectedDocumentPathRef.current
      && draftMarkdownRef.current !== lastSavedMarkdownRef.current,
    );
    return hasMoreDraftChanges ? flushDocumentSaveInternal() : true;
  }, [applySavedDocumentToWorkspace]);

  useEffect(() => {
    if (!documentDraftPath || documentDraftPath !== selectedDocumentPath) {
      return;
    }

    if (documentMarkdownDraft === lastSavedMarkdownRef.current) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      void flushDocumentSave();
    }, NOTES_AUTOSAVE_IDLE_MS);

    return () => window.clearTimeout(saveTimer);
  }, [documentDraftPath, documentMarkdownDraft, flushDocumentSave, selectedDocumentPath]);

  useEffect(() => () => {
    void flushDocumentSave();
  }, [flushDocumentSave]);

  const handleDraftMarkdownChange = useCallback((nextMarkdown: string) => {
    setDocumentMarkdownDraft(nextMarkdown);
    draftMarkdownRef.current = nextMarkdown;
    setSaveStatus(nextMarkdown === lastSavedMarkdownRef.current ? 'saved' : 'dirty');
    setSaveErrorMessage(null);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      target: null,
    });
  }, []);

  const openContextMenu = useCallback((
    event: Pick<ReactMouseEvent, 'clientX' | 'clientY' | 'preventDefault' | 'stopPropagation'>,
    target: NotesContextMenuTarget,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      target,
    });
  }, []);

  const handleToggleDirectoryExpanded = useCallback((directoryPath: string) => {
    if (!rootDirectoryPath || directoryPath === rootDirectoryPath) {
      return;
    }

    setExpandedDirectoryPaths((currentPaths) => (
      currentPaths.includes(directoryPath)
        ? currentPaths.filter((path) => path !== directoryPath)
        : [...currentPaths, directoryPath]
    ));
  }, [rootDirectoryPath]);

  const handleRefreshWorkspace = useCallback(() => {
    closeContextMenu();
    void (async () => {
      const saved = await flushDocumentSave();
      if (!saved) {
        return;
      }
      await reloadWorkspace();
    })();
  }, [closeContextMenu, flushDocumentSave, reloadWorkspace]);

  const openCreateDirectoryPrompt = useCallback((parentPath: string) => {
    if (!parentPath) {
      return;
    }

    closeContextMenu();
    setPromptAction({
      kind: 'create-directory',
      parentPath,
      value: notesWorkspaceConfig.defaultDirectoryName,
      title: 'Create Folder',
      description: `Create a folder inside ${getDirectoryDisplayName(parentPath, rootDirectoryPath, directoryLookup)}.`,
      submitLabel: 'Create Folder',
    });
  }, [closeContextMenu, directoryLookup, rootDirectoryPath]);

  const openRenameDirectoryPrompt = useCallback((directory: NotesDirectoryRecord) => {
    closeContextMenu();
    setPromptAction({
      kind: 'rename-directory',
      directoryPath: directory.path,
      value: directory.name,
      title: 'Rename Folder',
      description: `Rename ${directory.name}. Notes inside the folder will keep their relative paths.`,
      submitLabel: 'Rename Folder',
    });
  }, [closeContextMenu]);

  const openRenameDocumentPrompt = useCallback((document: NotesDocumentRecord) => {
    closeContextMenu();
    setPromptAction({
      kind: 'rename-document',
      documentPath: document.path,
      value: document.title,
      title: 'Rename Note',
      description: `Rename ${document.title}. The markdown file on disk will be renamed too.`,
      submitLabel: 'Rename Note',
    });
  }, [closeContextMenu]);

  const openDeleteDirectoryConfirm = useCallback((directory: NotesDirectoryRecord) => {
    closeContextMenu();
    setConfirmAction({
      kind: 'delete-directory',
      directoryPath: directory.path,
      directoryName: directory.name,
    });
  }, [closeContextMenu]);

  const openDeleteDocumentConfirm = useCallback((document: NotesDocumentRecord) => {
    closeContextMenu();
    setConfirmAction({
      kind: 'delete-document',
      documentPath: document.path,
      documentTitle: document.title,
    });
  }, [closeContextMenu]);

  const handleCreateDocument = useCallback((targetDirectoryPath?: string) => {
    closeContextMenu();
    void (async () => {
      const saved = await flushDocumentSave();
      if (!saved) {
        return;
      }

      const resolvedDirectoryPath = targetDirectoryPath
        ?? activeDirectoryPath
        ?? rootDirectoryPath
        ?? '';

      try {
        const nextDocumentPath = await createNotesDocument(resolvedDirectoryPath);
        setSelectedDirectoryPath(resolvedDirectoryPath || rootDirectoryPath);
        setSelectedDocumentPath(nextDocumentPath);
        setExpandedDirectoryPaths((currentPaths) => mergeExpandedDirectoryPaths(
          currentPaths,
          collectDirectoryAncestorPaths(resolvedDirectoryPath, directoryLookup),
        ));
        setViewMode('rich');
        await reloadWorkspace();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to create the note.');
      }
    })();
  }, [activeDirectoryPath, closeContextMenu, directoryLookup, flushDocumentSave, reloadWorkspace, rootDirectoryPath]);

  const handleSelectDirectory = useCallback((directoryPath: string) => {
    closeContextMenu();
    void (async () => {
      const saved = await flushDocumentSave();
      if (!saved) {
        return;
      }

      setSelectedDirectoryPath(directoryPath);
      setExpandedDirectoryPaths((currentPaths) => mergeExpandedDirectoryPaths(
        currentPaths,
        collectDirectoryAncestorPaths(directoryPath, directoryLookup),
      ));
    })();
  }, [closeContextMenu, directoryLookup, flushDocumentSave]);

  const handleSelectDocument = useCallback((documentPath: string) => {
    closeContextMenu();
    void (async () => {
      const saved = await flushDocumentSave();
      if (!saved) {
        return;
      }

      const selectedDocument = documentLookup.get(documentPath);
      if (!selectedDocument) {
        return;
      }

      setSelectedDirectoryPath(selectedDocument.directoryPath);
      setSelectedDocumentPath(selectedDocument.path);
      setExpandedDirectoryPaths((currentPaths) => mergeExpandedDirectoryPaths(
        currentPaths,
        collectDirectoryAncestorPaths(selectedDocument.directoryPath, directoryLookup),
      ));
    })();
  }, [closeContextMenu, directoryLookup, documentLookup, flushDocumentSave]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!activeDocumentRecord) {
      return;
    }

    try {
      await navigator.clipboard.writeText(documentMarkdownDraft);
    } catch (error) {
      setSaveStatus('error');
      setSaveErrorMessage(error instanceof Error ? error.message : 'Unable to copy markdown.');
    }
  }, [activeDocumentRecord, documentMarkdownDraft]);

  const handleSubmitPromptAction = useCallback(async () => {
    if (!promptAction) {
      return;
    }

    const nextValue = promptAction.value.trim();
    if (!nextValue) {
      setPromptAction(null);
      return;
    }

    const saved = await flushDocumentSave();
    if (!saved) {
      return;
    }

    try {
      if (promptAction.kind === 'create-directory') {
        const nextDirectoryPath = await createNotesDirectory(promptAction.parentPath, nextValue);
        setSelectedDirectoryPath(nextDirectoryPath);
        setExpandedDirectoryPaths((currentPaths) => mergeExpandedDirectoryPaths(
          currentPaths,
          [
            ...collectDirectoryAncestorPaths(promptAction.parentPath, directoryLookup),
            nextDirectoryPath,
          ],
        ));
      } else if (promptAction.kind === 'rename-directory') {
        const nextDirectoryPath = await renameNotesDirectory(promptAction.directoryPath, nextValue);
        setSelectedDirectoryPath((currentPath) => replaceDirectoryScopedPath(
          currentPath,
          promptAction.directoryPath,
          nextDirectoryPath,
        ));
        setSelectedDocumentPath((currentPath) => replaceDirectoryScopedPath(
          currentPath,
          promptAction.directoryPath,
          nextDirectoryPath,
        ));
        setExpandedDirectoryPaths((currentPaths) => dedupeDirectoryPaths(
          currentPaths.map((path) => replaceDirectoryScopedPath(
            path,
            promptAction.directoryPath,
            nextDirectoryPath,
          )).filter((path): path is string => Boolean(path)),
        ));
      } else {
        const nextDocumentPath = await renameNotesDocument(promptAction.documentPath, nextValue);
        setSelectedDocumentPath((currentPath) => (
          currentPath === promptAction.documentPath ? nextDocumentPath : currentPath
        ));
        if (documentDraftPath === promptAction.documentPath) {
          setDocumentDraftPath(nextDocumentPath);
          draftPathRef.current = nextDocumentPath;
        }
      }

      setPromptAction(null);
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update the notes workspace.');
    }
  }, [directoryLookup, documentDraftPath, flushDocumentSave, promptAction, reloadWorkspace]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) {
      return;
    }

    const saved = await flushDocumentSave();
    if (!saved) {
      return;
    }

    try {
      if (confirmAction.kind === 'delete-directory') {
        await deleteNotesDirectory(confirmAction.directoryPath);
        setSelectedDirectoryPath((currentPath) => (
          isPathInsideDirectoryScope(currentPath, confirmAction.directoryPath)
            ? rootDirectoryPath
            : currentPath
        ));
        setSelectedDocumentPath((currentPath) => (
          isPathInsideDirectoryScope(currentPath, confirmAction.directoryPath)
            ? null
            : currentPath
        ));
        setExpandedDirectoryPaths((currentPaths) => currentPaths.filter(
          (path) => !isPathInsideDirectoryScope(path, confirmAction.directoryPath),
        ));
      } else {
        await deleteNotesDocument(confirmAction.documentPath);
        setSelectedDocumentPath((currentPath) => (
          currentPath === confirmAction.documentPath ? null : currentPath
        ));
      }

      setConfirmAction(null);
      await reloadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update the notes workspace.');
    }
  }, [confirmAction, flushDocumentSave, reloadWorkspace, rootDirectoryPath]);

  const contextMenuNodes = useMemo(() => {
    if (!contextMenu.visible || !contextMenu.target) {
      return [];
    }

    if (contextMenu.target.kind === 'background') {
      return [
        createNotesMenuCommandNode({
          id: 'notes.new-note',
          label: 'New Note',
          iconName: 'FilePlus',
          shortcutId: formatHotkeyLabel(keybindings.newFile),
          onSelect: () => handleCreateDocument(),
        }),
        createNotesMenuCommandNode({
          id: 'notes.new-folder',
          label: 'New Folder',
          iconName: 'FolderPlus',
          shortcutId: formatHotkeyLabel(keybindings.newFolder),
          onSelect: () => openCreateDirectoryPrompt(activeDirectoryPath ?? rootDirectoryPath ?? ''),
        }),
        createNotesMenuSeparatorNode('notes.separator.background'),
        createNotesMenuCommandNode({
          id: 'notes.refresh',
          label: 'Refresh',
          iconName: 'RefreshCw',
          onSelect: () => handleRefreshWorkspace(),
        }),
      ];
    }

    if (contextMenu.target.kind === 'directory') {
      const directory = directoryLookup.get(contextMenu.target.directoryPath);
      if (!directory) {
        return [];
      }

      const canDelete = directory.parentPath !== null;
      return [
        createNotesMenuCommandNode({
          id: 'notes.directory.new-note',
          label: 'New Note',
          iconName: 'FilePlus',
          shortcutId: formatHotkeyLabel(keybindings.newFile),
          onSelect: () => handleCreateDocument(directory.path),
        }),
        createNotesMenuCommandNode({
          id: 'notes.directory.new-folder',
          label: 'New Folder',
          iconName: 'FolderPlus',
          shortcutId: formatHotkeyLabel(keybindings.newFolder),
          onSelect: () => openCreateDirectoryPrompt(directory.path),
        }),
        ...(canDelete
          ? [
              createNotesMenuSeparatorNode('notes.separator.directory.primary'),
              createNotesMenuCommandNode({
                id: 'notes.directory.rename',
                label: 'Rename Folder',
                iconName: 'Edit3',
                shortcutId: formatHotkeyLabel(keybindings.renameItem),
                onSelect: () => openRenameDirectoryPrompt(directory),
              }),
            ]
          : []),
        createNotesMenuCommandNode({
          id: 'notes.directory.reveal',
          label: 'Reveal in Explorer',
          iconName: 'FolderOpen',
          shortcutId: formatHotkeyLabel(keybindings.revealInExplorer),
          onSelect: async () => {
            await revealExplorerPath(directory.path);
          },
        }),
        ...(canDelete
          ? [
              createNotesMenuSeparatorNode('notes.separator.directory.danger'),
              createNotesMenuCommandNode({
                id: 'notes.directory.delete',
                label: 'Delete Folder',
                iconName: 'Trash2',
                tone: 'danger',
                shortcutId: formatHotkeyLabel(keybindings.deleteItem),
                onSelect: () => openDeleteDirectoryConfirm(directory),
              }),
            ]
          : []),
      ];
    }

    const document = documentLookup.get(contextMenu.target.documentPath);
    if (!document) {
      return [];
    }

    return [
      createNotesMenuCommandNode({
        id: 'notes.document.rename',
        label: 'Rename Note',
        iconName: 'Edit3',
        shortcutId: formatHotkeyLabel(keybindings.renameItem),
        onSelect: () => openRenameDocumentPrompt(document),
      }),
      createNotesMenuCommandNode({
        id: 'notes.document.copy-markdown',
        label: 'Copy Markdown',
        iconName: 'Copy',
        onSelect: async () => {
          setSelectedDocumentPath(document.path);
          setSelectedDirectoryPath(document.directoryPath);
          await navigator.clipboard.writeText(
            document.path === selectedDocumentPath ? documentMarkdownDraft : document.markdown,
          );
        },
      }),
      createNotesMenuCommandNode({
        id: 'notes.document.reveal',
        label: 'Reveal in Explorer',
        iconName: 'FolderOpen',
        shortcutId: formatHotkeyLabel(keybindings.revealInExplorer),
        onSelect: async () => {
          await revealExplorerPath(document.path);
        },
      }),
      createNotesMenuSeparatorNode('notes.separator.document.danger'),
      createNotesMenuCommandNode({
        id: 'notes.document.delete',
        label: 'Delete Note',
        iconName: 'Trash2',
        tone: 'danger',
        shortcutId: formatHotkeyLabel(keybindings.deleteItem),
        onSelect: () => openDeleteDocumentConfirm(document),
      }),
    ];
  }, [
    activeDirectoryPath,
    closeContextMenu,
    contextMenu.target,
    contextMenu.visible,
    directoryLookup,
    documentLookup,
    documentMarkdownDraft,
    handleCreateDocument,
    handleRefreshWorkspace,
    keybindings.deleteItem,
    keybindings.newFile,
    keybindings.newFolder,
    keybindings.renameItem,
    keybindings.revealInExplorer,
    openCreateDirectoryPrompt,
    openDeleteDirectoryConfirm,
    openDeleteDocumentConfirm,
    openRenameDirectoryPrompt,
    openRenameDocumentPrompt,
    rootDirectoryPath,
    selectedDocumentPath,
  ]);

  const hasDialogOpen = promptAction !== null || confirmAction !== null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (hasDialogOpen) {
        return;
      }

      if (matchesKeybinding(event, keybindings.saveFile)) {
        if (!selectedDocumentPathRef.current) {
          return;
        }
        event.preventDefault();
        void flushDocumentSave();
        return;
      }

      if (matchesKeybinding(event, keybindings.searchExplorer)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (matchesKeybinding(event, keybindings.newFile)) {
        event.preventDefault();
        handleCreateDocument();
        return;
      }

      if (matchesKeybinding(event, keybindings.newFolder)) {
        event.preventDefault();
        openCreateDirectoryPrompt(activeDirectoryPath ?? rootDirectoryPath ?? '');
        return;
      }

      const targetElement = resolveEventTargetElement(event.target);
      const isEditableTarget = Boolean(
        targetElement
        && (
          targetElement.tagName === 'INPUT'
          || targetElement.tagName === 'TEXTAREA'
          || targetElement.isContentEditable
        ),
      );

      if (isEditableTarget) {
        return;
      }

      if (matchesKeybinding(event, keybindings.renameItem)) {
        if (activeDocumentRecord) {
          event.preventDefault();
          openRenameDocumentPrompt(activeDocumentRecord);
          return;
        }

        if (activeDirectoryRecord && activeDirectoryRecord.parentPath !== null) {
          event.preventDefault();
          openRenameDirectoryPrompt(activeDirectoryRecord);
        }
        return;
      }

      if (matchesKeybinding(event, keybindings.deleteItem)) {
        if (activeDocumentRecord) {
          event.preventDefault();
          openDeleteDocumentConfirm(activeDocumentRecord);
          return;
        }

        if (activeDirectoryRecord && activeDirectoryRecord.parentPath !== null) {
          event.preventDefault();
          openDeleteDirectoryConfirm(activeDirectoryRecord);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    activeDirectoryPath,
    activeDirectoryRecord,
    activeDocumentRecord,
    confirmAction,
    flushDocumentSave,
    handleCreateDocument,
    hasDialogOpen,
    keybindings.deleteItem,
    keybindings.newFile,
    keybindings.newFolder,
    keybindings.renameItem,
    keybindings.saveFile,
    keybindings.searchExplorer,
    openCreateDirectoryPrompt,
    openDeleteDirectoryConfirm,
    openDeleteDocumentConfirm,
    openRenameDirectoryPrompt,
    openRenameDocumentPrompt,
    promptAction,
    rootDirectoryPath,
  ]);

  const saveStatusLabel = activeDocumentRecord
    ? saveStatus === 'saving'
      ? 'Saving markdown…'
      : saveStatus === 'dirty'
        ? 'Unsaved changes'
        : saveStatus === 'saved'
          ? 'Saved'
          : saveStatus === 'error'
            ? 'Save failed'
            : 'Ready'
    : 'No note selected';

  const saveStatusDetail = saveErrorMessage
    ?? errorMessage
    ?? (
      activeDocumentRecord
        ? `Autosaves after ${Math.round(NOTES_AUTOSAVE_IDLE_MS / 1000)}s idle. Press ${formatHotkeyLabel(keybindings.saveFile)} to save now.`
        : `Press ${formatHotkeyLabel(keybindings.newFile)} for a new note or ${formatHotkeyLabel(keybindings.newFolder)} for a new folder.`
    );

  return (
    <div
      style={{
        display: 'flex',
        minHeight: 0,
        height: '100%',
        background: 'var(--overlay-bg-shell)',
        color: 'var(--overlay-text-primary)',
      }}
    >
      <ResizablePane
        size={sidebarWidth}
        minSize={248}
        maxSize={520}
        onSizeChange={setSidebarWidth}
        borderColor={appearance.theme.palette.border}
        style={{
          display: 'grid',
          gridTemplateRows: 'auto auto minmax(0, 1fr) auto',
          background: 'var(--overlay-bg-panel)',
          borderRight: '1px solid var(--overlay-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--overlay-border)',
            background:
              `linear-gradient(180deg, color-mix(in srgb, ${appearance.theme.palette.accent} 10%, transparent), transparent 70%), ` +
              'var(--overlay-bg-panel)',
          }}
        >
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Notes
            </span>
            <span style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
              {visibleDocumentCount} {isSearchActive ? 'matching notes' : 'markdown files'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <OverlayActionButton
              appearance={appearance}
              tone="quiet"
              size="compact"
              title="New folder"
              onClick={() => openCreateDirectoryPrompt(activeDirectoryPath ?? rootDirectoryPath ?? '')}
            >
              <FolderPlus size={12} />
            </OverlayActionButton>
            <OverlayActionButton
              appearance={appearance}
              tone="accent"
              size="compact"
              title="New note"
              onClick={() => handleCreateDocument()}
            >
              <FilePlus size={12} />
            </OverlayActionButton>
            <OverlayActionButton
              appearance={appearance}
              tone="quiet"
              size="compact"
              title="Refresh"
              onClick={handleRefreshWorkspace}
            >
              <RefreshCw size={12} />
            </OverlayActionButton>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 10,
            padding: '12px 14px',
            borderBottom: '1px solid var(--overlay-border)',
            background: 'color-mix(in srgb, var(--overlay-bg-sidebar) 86%, transparent)',
          }}
        >
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
              ref={searchInputRef}
              value={documentSearchQuery}
              onChange={(event) => setDocumentSearchQuery(event.target.value)}
              placeholder={`Search notes (${formatHotkeyLabel(keybindings.searchExplorer)})`}
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
              {activeDirectoryLabel}
            </span>
            <OverlayActionButton
              appearance={appearance}
              tone="quiet"
              size="compact"
              onClick={() => setSortMode((currentMode) => currentMode === 'modified' ? 'title' : 'modified')}
              title={sortMode === 'modified' ? 'Sort by recent changes' : 'Sort alphabetically'}
            >
              <ArrowUpDown size={12} />
              {sortMode === 'modified' ? 'Recent' : 'A-Z'}
            </OverlayActionButton>
          </div>
        </div>

        <div
          style={{ minHeight: 0 }}
          onContextMenu={(event) => openContextMenu(event, { kind: 'background' })}
        >
          <OverlayScrollArea style={{ minHeight: 0 }}>
            {loading ? (
              <SidebarEmptyState label="Loading notes…" />
            ) : directoryTree ? (
              <div style={{ padding: '10px 10px 18px' }}>
                <NotesSidebarDirectoryNode
                  appearance={appearance}
                  node={directoryTree}
                  rootDirectoryPath={rootDirectoryPath}
                  activeDirectoryPath={activeDirectoryPath}
                  selectedDocumentPath={selectedDocumentPath}
                  expandedDirectoryPaths={expandedDirectoryPaths}
                  isSearchActive={isSearchActive}
                  onSelectDirectory={handleSelectDirectory}
                  onSelectDocument={handleSelectDocument}
                  onToggleExpanded={handleToggleDirectoryExpanded}
                  onOpenContextMenu={openContextMenu}
                />
              </div>
            ) : (
              <SidebarEmptyState
                label={isSearchActive ? 'No notes match this search.' : 'No folders or notes yet.'}
              />
            )}
          </OverlayScrollArea>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 14px',
            borderTop: '1px solid var(--overlay-border)',
            background: 'var(--overlay-bg-panel)',
            color: 'var(--overlay-text-muted)',
            fontSize: 11,
          }}
        >
          <span>{activeDirectoryLabel}</span>
          <span>{workspaceSnapshot?.documents.length ?? 0} total</span>
        </div>
      </ResizablePane>

      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', minHeight: 0, flex: 1 }}>
        <div
          style={{
            display: 'grid',
            gap: 12,
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--overlay-border)',
            background:
              `linear-gradient(135deg, color-mix(in srgb, ${appearance.theme.palette.accent} 9%, transparent), transparent 42%), ` +
              'var(--overlay-bg-panel)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {activeDirectoryLabel}
              </span>
              <span
                style={{
                  fontSize: 32,
                  lineHeight: 1.05,
                  fontWeight: 700,
                  letterSpacing: '-0.05em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {activeDocumentRecord?.title ?? 'Notes Workspace'}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                {activeDocumentRecord ? (
                  <>
                    <span>{formatRelativeTimestamp(activeDocumentRecord.modifiedAt)}</span>
                    <span>{documentWordCount} words</span>
                    <span>{documentMarkdownDraft.length} chars</span>
                    <span>{documentHeadingCount} headings</span>
                    <span>{activeDocumentRecord.path.replace(/\\/g, '/')}</span>
                  </>
                ) : (
                  <>
                    <span>{activeDirectoryLabel}</span>
                    <span>Markdown files stay on disk inside the managed notes root.</span>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
              {activeDocumentRecord ? (
                <>
                  <OverlayActionButton
                    appearance={appearance}
                    tone={viewMode === 'rich' ? 'accent' : 'quiet'}
                    size="compact"
                    active={viewMode === 'rich'}
                    onClick={() => setViewMode('rich')}
                  >
                    Edit
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone={viewMode === 'markdown' ? 'accent' : 'quiet'}
                    size="compact"
                    active={viewMode === 'markdown'}
                    onClick={() => setViewMode('markdown')}
                  >
                    Markdown
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone={viewMode === 'preview' ? 'accent' : 'quiet'}
                    size="compact"
                    active={viewMode === 'preview'}
                    onClick={() => setViewMode('preview')}
                  >
                    <Eye size={12} />
                    Preview
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone={viewMode === 'split' ? 'accent' : 'quiet'}
                    size="compact"
                    active={viewMode === 'split'}
                    onClick={() => setViewMode('split')}
                  >
                    Split
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone={saveStatus === 'dirty' ? 'accent' : 'quiet'}
                    size="compact"
                    title="Save now"
                    onClick={() => void flushDocumentSave()}
                  >
                    Save
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone="quiet"
                    size="compact"
                    title="Copy markdown"
                    onClick={() => void handleCopyMarkdown()}
                  >
                    <Copy size={12} />
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone="quiet"
                    size="compact"
                    title="Reveal in explorer"
                    onClick={() => void revealExplorerPath(activeDocumentRecord.path)}
                  >
                    <FolderOpen size={12} />
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone="quiet"
                    size="compact"
                    title="Rename note"
                    onClick={() => openRenameDocumentPrompt(activeDocumentRecord)}
                  >
                    <Edit3 size={12} />
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone="danger"
                    size="compact"
                    title="Delete note"
                    onClick={() => openDeleteDocumentConfirm(activeDocumentRecord)}
                  >
                    <Trash2 size={12} />
                  </OverlayActionButton>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ minHeight: 0, background: 'var(--overlay-bg-panel)' }}>
          {!activeDocumentRecord ? (
            <EmptyWorkspaceSurface
              appearance={appearance}
              activeDirectoryLabel={activeDirectoryLabel}
              onCreateDocument={() => handleCreateDocument()}
              onCreateDirectory={() => openCreateDirectoryPrompt(activeDirectoryPath ?? rootDirectoryPath ?? '')}
              onFocusSearch={() => {
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
              }}
              keybindingHints={{
                newFile: formatHotkeyLabel(keybindings.newFile),
                newFolder: formatHotkeyLabel(keybindings.newFolder),
                search: formatHotkeyLabel(keybindings.searchExplorer),
              }}
            />
          ) : viewMode === 'rich' ? (
            <NotesRichMarkdownEditor
              appearance={appearance}
              markdown={documentMarkdownDraft}
              onMarkdownChange={handleDraftMarkdownChange}
              onBlur={() => {
                void flushDocumentSave();
              }}
            />
          ) : viewMode === 'markdown' ? (
            <textarea
              value={documentMarkdownDraft}
              onChange={(event) => handleDraftMarkdownChange(event.target.value)}
              onBlur={() => {
                void flushDocumentSave();
              }}
              spellCheck
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                padding: '24px 28px 96px',
                background:
                  `linear-gradient(180deg, color-mix(in srgb, ${appearance.theme.palette.accent} 10%, transparent), transparent 180px), var(--overlay-bg-panel)`,
                color: 'var(--overlay-text-primary)',
                fontFamily: 'var(--overlay-font-mono, "JetBrains Mono", monospace)',
                fontSize: 13,
                lineHeight: 1.72,
              }}
            />
          ) : viewMode === 'preview' ? (
            <TextDocumentPreview kind="markdown" content={documentMarkdownDraft} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', height: '100%', minHeight: 0 }}>
              <textarea
                value={documentMarkdownDraft}
                onChange={(event) => handleDraftMarkdownChange(event.target.value)}
                onBlur={() => {
                  void flushDocumentSave();
                }}
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
                  lineHeight: 1.72,
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
            gap: 16,
            padding: '8px 20px',
            borderTop: '1px solid var(--overlay-border)',
            background: 'var(--overlay-bg-panel)',
            color: 'var(--overlay-text-muted)',
            fontSize: 11,
          }}
        >
          <span>{saveStatusLabel}</span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {saveStatusDetail}
          </span>
        </div>
      </div>

      <ExplorerContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        nodes={contextMenuNodes}
        onClose={closeContextMenu}
        renderIcon={renderNotesContextMenuIcon}
      />

      <AppPromptDialog
        open={promptAction !== null}
        title={promptAction?.title ?? 'Notes'}
        description={promptAction?.description}
        icon={promptAction?.kind === 'rename-document' ? <FileText size={16} /> : <Folder size={16} />}
        value={promptAction?.value ?? ''}
        onChange={(value) => {
          setPromptAction((currentAction) => currentAction ? { ...currentAction, value } : currentAction);
        }}
        onSubmit={() => {
          void handleSubmitPromptAction();
        }}
        onCancel={() => setPromptAction(null)}
        submitLabel={promptAction?.submitLabel ?? 'Confirm'}
        placeholder={
          promptAction?.kind === 'rename-document'
            ? notesWorkspaceConfig.defaultDocumentTitle
            : notesWorkspaceConfig.defaultDirectoryName
        }
      />

      <AppConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.kind === 'delete-directory'
            ? 'Delete Folder'
            : 'Delete Note'
        }
        description={
          confirmAction?.kind === 'delete-directory'
            ? `Delete ${confirmAction.directoryName} and every markdown note inside it?`
            : confirmAction?.kind === 'delete-document'
              ? `Delete ${confirmAction.documentTitle}?`
              : undefined
        }
        icon={<Trash2 size={16} />}
        confirmLabel={
          confirmAction?.kind === 'delete-directory'
            ? 'Delete Folder'
            : 'Delete Note'
        }
        tone="danger"
        onConfirm={() => {
          void handleConfirmAction();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function NotesSidebarDirectoryNode({
  appearance,
  node,
  rootDirectoryPath,
  activeDirectoryPath,
  selectedDocumentPath,
  expandedDirectoryPaths,
  isSearchActive,
  onSelectDirectory,
  onSelectDocument,
  onToggleExpanded,
  onOpenContextMenu,
}: {
  appearance: ResolvedOverlayAppearance;
  node: NotesWorkspaceTreeNode;
  rootDirectoryPath: string | null;
  activeDirectoryPath: string | null;
  selectedDocumentPath: string | null;
  expandedDirectoryPaths: string[];
  isSearchActive: boolean;
  onSelectDirectory: (directoryPath: string) => void;
  onSelectDocument: (documentPath: string) => void;
  onToggleExpanded: (directoryPath: string) => void;
  onOpenContextMenu: (
    event: Pick<ReactMouseEvent, 'clientX' | 'clientY' | 'preventDefault' | 'stopPropagation'>,
    target: NotesContextMenuTarget,
  ) => void;
}) {
  const isRoot = rootDirectoryPath === node.directory.path;
  const isExpanded = isRoot || isSearchActive || expandedDirectoryPaths.includes(node.directory.path);
  const isActiveDirectory = activeDirectoryPath === node.directory.path;
  const hasChildren = node.children.length > 0 || node.documents.length > 0;
  const depth = getDirectoryDepth(node.directory.path, rootDirectoryPath);
  const rowBackground = isActiveDirectory
    ? `${appearance.theme.palette.accent}12`
    : 'transparent';
  const rowColor = isActiveDirectory
    ? 'var(--overlay-text-primary)'
    : 'var(--overlay-text-muted)';

  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 8,
          minHeight: 34,
          padding: `0 10px 0 ${12 + depth * 14}px`,
          borderRadius: 12,
          border: '1px solid transparent',
          background: rowBackground,
          color: rowColor,
        }}
        onContextMenu={(event) => onOpenContextMenu(event, {
          kind: 'directory',
          directoryPath: node.directory.path,
        })}
      >
        {hasChildren && !isRoot ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(node.directory.path);
            }}
            style={treeToggleButtonStyle}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span style={{ width: 12, display: 'inline-flex' }} />
        )}

        <button
          type="button"
          onClick={() => onSelectDirectory(node.directory.path)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
            minHeight: 34,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          {isActiveDirectory || isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
          <span
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 12,
            }}
          >
            {isRoot ? 'Notes' : node.directory.name}
          </span>
        </button>

        <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
          {node.directory.recursiveDocumentCount}
        </span>
      </div>

      {isExpanded ? (
        <div style={{ display: 'grid', gap: 2 }}>
          {node.documents.map((document) => (
            <NotesSidebarDocumentRow
              key={document.path}
              appearance={appearance}
              document={document}
              selectedDocumentPath={selectedDocumentPath}
              rootDirectoryPath={rootDirectoryPath}
              isSearchActive={isSearchActive}
              onSelectDocument={onSelectDocument}
              onOpenContextMenu={onOpenContextMenu}
            />
          ))}

          {node.children.map((childNode) => (
            <NotesSidebarDirectoryNode
              key={childNode.directory.path}
              appearance={appearance}
              node={childNode}
              rootDirectoryPath={rootDirectoryPath}
              activeDirectoryPath={activeDirectoryPath}
              selectedDocumentPath={selectedDocumentPath}
              expandedDirectoryPaths={expandedDirectoryPaths}
              isSearchActive={isSearchActive}
              onSelectDirectory={onSelectDirectory}
              onSelectDocument={onSelectDocument}
              onToggleExpanded={onToggleExpanded}
              onOpenContextMenu={onOpenContextMenu}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NotesSidebarDocumentRow({
  appearance,
  document,
  selectedDocumentPath,
  rootDirectoryPath,
  isSearchActive,
  onSelectDocument,
  onOpenContextMenu,
}: {
  appearance: ResolvedOverlayAppearance;
  document: NotesDocumentRecord;
  selectedDocumentPath: string | null;
  rootDirectoryPath: string | null;
  isSearchActive: boolean;
  onSelectDocument: (documentPath: string) => void;
  onOpenContextMenu: (
    event: Pick<ReactMouseEvent, 'clientX' | 'clientY' | 'preventDefault' | 'stopPropagation'>,
    target: NotesContextMenuTarget,
  ) => void;
}) {
  const isSelected = selectedDocumentPath === document.path;
  const depth = getDirectoryDepth(document.directoryPath, rootDirectoryPath) + 1;

  return (
    <button
      type="button"
      onClick={() => onSelectDocument(document.path)}
      onContextMenu={(event) => onOpenContextMenu(event, {
        kind: 'document',
        documentPath: document.path,
      })}
      style={{
        display: 'grid',
        gap: (isSelected || isSearchActive) ? 4 : 0,
        width: '100%',
        minHeight: 30,
        padding: `7px 12px 7px ${22 + depth * 14}px`,
        borderRadius: 12,
        border: '1px solid transparent',
        background: isSelected ? `${appearance.theme.palette.accent}16` : 'transparent',
        color: isSelected ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <FileText size={13} />
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 12,
          }}
        >
          {document.title}
        </span>
      </span>

      {(isSelected || isSearchActive) ? (
        <span
          style={{
            color: 'var(--overlay-text-muted)',
            fontSize: 10,
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: isSelected ? 2 : 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {document.previewText || 'Empty note.'}
        </span>
      ) : null}
    </button>
  );
}

function SidebarEmptyState({
  label,
}: {
  label: string;
}) {
  return (
    <div
      style={{
        padding: '24px 18px',
        color: 'var(--overlay-text-muted)',
        fontSize: 12,
      }}
    >
      {label}
    </div>
  );
}

function EmptyWorkspaceSurface({
  appearance,
  activeDirectoryLabel,
  onCreateDocument,
  onCreateDirectory,
  onFocusSearch,
  keybindingHints,
}: {
  appearance: ResolvedOverlayAppearance;
  activeDirectoryLabel: string;
  onCreateDocument: () => void;
  onCreateDirectory: () => void;
  onFocusSearch: () => void;
  keybindingHints: {
    newFile: string;
    newFolder: string;
    search: string;
  };
}) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        height: '100%',
        padding: 28,
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: 20,
          width: 'min(620px, 100%)',
          padding: '30px 32px',
          borderRadius: 26,
          border: '1px solid var(--overlay-border)',
          background:
            `radial-gradient(circle at top right, color-mix(in srgb, ${appearance.theme.palette.accent} 14%, transparent), transparent 32%), ` +
            'color-mix(in srgb, var(--overlay-bg-card) 90%, transparent)',
        }}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StickyNote size={18} />
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em' }}>
              One sidebar. Real folders. Plain markdown files.
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--overlay-text-muted)' }}>
            The active folder is {activeDirectoryLabel}. Create a note, spin up a folder, or search across the workspace without the old fake SaaS buckets and double-sidebar noise.
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
          <OverlayActionButton appearance={appearance} tone="quiet" onClick={onFocusSearch}>
            <Search size={12} />
            Search
          </OverlayActionButton>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <HintRow label="New note" shortcut={keybindingHints.newFile} />
          <HintRow label="New folder" shortcut={keybindingHints.newFolder} />
          <HintRow label="Focus search" shortcut={keybindingHints.search} />
        </div>
      </div>
    </div>
  );
}

function HintRow({
  label,
  shortcut,
}: {
  label: string;
  shortcut: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 14,
        border: '1px solid var(--overlay-border)',
        background: 'color-mix(in srgb, var(--overlay-bg-card) 86%, transparent)',
        fontSize: 12,
      }}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--overlay-text-muted)' }}>{shortcut}</span>
    </div>
  );
}

function buildNotesWorkspaceTree(options: {
  snapshot: NotesWorkspaceSnapshot;
  documentComparator: (left: NotesDocumentRecord, right: NotesDocumentRecord) => number;
  matchingDocumentPathSet: Set<string>;
  hideEmptyDirectories: boolean;
}): NotesWorkspaceTreeNode | null {
  const nodeLookup = new Map<string, NotesWorkspaceTreeNode>();

  for (const directory of options.snapshot.directories) {
    nodeLookup.set(directory.path, {
      directory,
      children: [],
      documents: [],
    });
  }

  for (const document of options.snapshot.documents) {
    if (!options.matchingDocumentPathSet.has(document.path)) {
      continue;
    }
    nodeLookup.get(document.directoryPath)?.documents.push(document);
  }

  let rootNode: NotesWorkspaceTreeNode | null = null;
  for (const directory of options.snapshot.directories) {
    const currentNode = nodeLookup.get(directory.path)!;
    currentNode.documents.sort(options.documentComparator);
    currentNode.children.sort((left, right) => compareDirectoryNames(left.directory.name, right.directory.name));

    if (!directory.parentPath) {
      rootNode = currentNode;
      continue;
    }

    nodeLookup.get(directory.parentPath)?.children.push(currentNode);
  }

  if (!rootNode) {
    return null;
  }

  for (const node of nodeLookup.values()) {
    node.children.sort((left, right) => compareDirectoryNames(left.directory.name, right.directory.name));
  }

  return options.hideEmptyDirectories
    ? filterNotesWorkspaceTree(rootNode, options.snapshot.rootDirectoryPath)
    : rootNode;
}

function filterNotesWorkspaceTree(
  node: NotesWorkspaceTreeNode,
  rootDirectoryPath: string,
): NotesWorkspaceTreeNode | null {
  const children = node.children
    .map((child) => filterNotesWorkspaceTree(child, rootDirectoryPath))
    .filter((child): child is NotesWorkspaceTreeNode => child !== null);

  if (
    node.directory.path !== rootDirectoryPath
    && node.documents.length === 0
    && children.length === 0
  ) {
    return null;
  }

  return {
    ...node,
    children,
  };
}

function createNotesDocumentComparator(sortMode: NotesSortMode) {
  return (left: NotesDocumentRecord, right: NotesDocumentRecord) => {
    if (sortMode === 'title') {
      return left.title.localeCompare(right.title, undefined, {
        sensitivity: 'base',
        numeric: true,
      });
    }

    if (right.modifiedAt !== left.modifiedAt) {
      return right.modifiedAt - left.modifiedAt;
    }

    return left.title.localeCompare(right.title, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  };
}

function matchesNotesDocumentQuery(document: NotesDocumentRecord, normalizedQuery: string): boolean {
  const haystack = `${document.title}\n${document.previewText}\n${document.markdown}`.toLowerCase();
  return haystack.includes(normalizedQuery);
}

function collectDirectoryAncestorPaths(
  directoryPath: string | null | undefined,
  directoryLookup: Map<string, NotesDirectoryRecord>,
): string[] {
  if (!directoryPath) {
    return [];
  }

  const ancestorPaths: string[] = [];
  let cursorPath: string | null = directoryPath;

  while (cursorPath) {
    ancestorPaths.push(cursorPath);
    cursorPath = directoryLookup.get(cursorPath)?.parentPath ?? null;
  }

  return ancestorPaths.reverse();
}

function readPersistedExpandedDirectoryPaths(): string[] {
  try {
    const rawValue = localStorage.getItem(NOTES_EXPANDED_DIRECTORIES_STORAGE_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed)
      ? dedupeDirectoryPaths(parsed.filter((entry): entry is string => typeof entry === 'string'))
      : [];
  } catch {
    return [];
  }
}

function persistExpandedDirectoryPaths(paths: string[]): void {
  try {
    localStorage.setItem(
      NOTES_EXPANDED_DIRECTORIES_STORAGE_KEY,
      JSON.stringify(dedupeDirectoryPaths(paths)),
    );
  } catch {
    // Best-effort persistence only.
  }
}

function mergeExpandedDirectoryPaths(currentPaths: string[], nextPaths: string[]): string[] {
  return dedupeDirectoryPaths([...currentPaths, ...nextPaths.filter(Boolean)]);
}

function dedupeDirectoryPaths(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))];
}

function compareDirectoryNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

function getDirectoryDisplayName(
  directoryPath: string,
  rootDirectoryPath: string | null,
  directoryLookup: Map<string, NotesDirectoryRecord>,
): string {
  if (directoryPath === rootDirectoryPath) {
    return 'Notes';
  }

  return directoryLookup.get(directoryPath)?.name ?? 'Folder';
}

function getDirectoryDepth(
  directoryPath: string,
  rootDirectoryPath: string | null,
): number {
  if (!directoryPath || !rootDirectoryPath || directoryPath === rootDirectoryPath) {
    return 0;
  }

  const normalizedRootPath = trimTrailingPathSeparator(rootDirectoryPath);
  const normalizedDirectoryPath = trimTrailingPathSeparator(directoryPath);
  const relativePath = normalizedDirectoryPath.startsWith(normalizedRootPath)
    ? normalizedDirectoryPath.slice(normalizedRootPath.length)
    : normalizedDirectoryPath;

  return relativePath
    .split(/[\\/]/)
    .filter(Boolean)
    .length;
}

function trimTrailingPathSeparator(path: string): string {
  return path.replace(/[\\/]+$/, '');
}

function isPathInsideDirectoryScope(
  candidatePath: string | null | undefined,
  directoryPath: string,
): boolean {
  if (!candidatePath) {
    return false;
  }

  const normalizedCandidatePath = trimTrailingPathSeparator(candidatePath);
  const normalizedDirectoryPath = trimTrailingPathSeparator(directoryPath);
  return normalizedCandidatePath === normalizedDirectoryPath
    || normalizedCandidatePath.startsWith(`${normalizedDirectoryPath}/`)
    || normalizedCandidatePath.startsWith(`${normalizedDirectoryPath}\\`);
}

function replaceDirectoryScopedPath(
  candidatePath: string | null | undefined,
  previousDirectoryPath: string,
  nextDirectoryPath: string,
): string | null {
  if (!candidatePath) {
    return null;
  }

  if (!isPathInsideDirectoryScope(candidatePath, previousDirectoryPath)) {
    return candidatePath;
  }

  if (trimTrailingPathSeparator(candidatePath) === trimTrailingPathSeparator(previousDirectoryPath)) {
    return nextDirectoryPath;
  }

  return `${nextDirectoryPath}${candidatePath.slice(previousDirectoryPath.length)}`;
}

function createNotesMenuCommandNode(options: {
  id: string;
  label: string;
  iconName?: string;
  tone?: 'safe' | 'danger';
  shortcutId?: string;
  onSelect: () => void | Promise<void>;
}): ExplorerRuntimeMenuNode {
  return {
    kind: 'command',
    id: options.id,
    commandId: options.id,
    label: options.label,
    depth: 0,
    iconName: options.iconName,
    tone: options.tone ?? 'safe',
    source: 'layout',
    quickSlot: 'none',
    fallbackBucket: 'default',
    disabled: false,
    shortcutId: options.shortcutId,
    command: {} as never,
    onSelect: options.onSelect,
  } as ExplorerRuntimeMenuNode;
}

function createNotesMenuSeparatorNode(id: string): ExplorerRuntimeMenuNode {
  return {
    kind: 'separator',
    id,
    depth: 0,
    label: '',
    tone: 'muted',
    source: 'layout',
    quickSlot: 'none',
    fallbackBucket: 'default',
  } as ExplorerRuntimeMenuNode;
}

function renderNotesContextMenuIcon(iconName?: string) {
  switch (iconName) {
    case 'Copy':
      return <Copy size={14} />;
    case 'Edit3':
      return <Edit3 size={14} />;
    case 'FilePlus':
      return <FilePlus size={14} />;
    case 'FileText':
      return <FileText size={14} />;
    case 'FolderOpen':
      return <FolderOpen size={14} />;
    case 'FolderPlus':
      return <FolderPlus size={14} />;
    case 'RefreshCw':
      return <RefreshCw size={14} />;
    case 'Trash2':
      return <Trash2 size={14} />;
    default:
      return <FileText size={14} />;
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

  return new Date(timestamp).toLocaleDateString();
}

const treeToggleButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
};
