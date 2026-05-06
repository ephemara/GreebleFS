import { useCallback, useEffect, useState } from 'react';

import { getExplorerArchiveDescriptor } from '../config/explorerArchives';
import {
  getImageEditorContentType,
  getModelPreviewFormat,
  getMonacoLanguage,
  getSpreadsheetFileKind,
  getVideoPreviewMimeType,
} from '../config/filePreview';
import { useSettingsStore } from '../store/settingsStore';
import { readExplorerTextFile } from '../runtime/explorerBackend';
import {
  openExplorerPdfPreviewDocument,
  type ExplorerPdfPreviewDocument,
} from '../runtime/pdfPreviewBackend';
import {
  inspectExplorerShaderPreviewDocument,
  type ExplorerShaderPreviewCompileOutput,
  type ExplorerShaderPreviewDiagnostic,
  type ExplorerShaderPreviewEntryPoint,
  type ExplorerShaderPreviewFormat,
  type ExplorerShaderPreviewStage,
} from '../runtime/shaderPreviewBackend';
import { ExplorerArchivePreview } from './ExplorerArchivePreview';
import { ExplorerAudioWorkbench } from './ExplorerAudioWorkbench';
import { ExplorerDocxWorkbench } from './ExplorerDocxWorkbench';
import { ExplorerFolderPreview } from './ExplorerFolderPreview';
import { ExplorerImageEditor } from './ExplorerImageEditor';
import { ExplorerShaderWorkbench } from './ExplorerShaderWorkbench';
import { ModelPreview } from './ModelPreview';
import { ExplorerPdfWorkbench } from './ExplorerPdfWorkbench';
import { ExplorerSpreadsheetWorkbench } from './ExplorerSpreadsheetWorkbench';
import { ExplorerSqlitePreview } from './ExplorerSqlitePreview';
import { ExplorerTextWorkbenchSurface } from './ExplorerTextWorkbenchSurface';
import { ExplorerVideoEditor } from './ExplorerVideoEditor';
import type {
  OverlayPluginPreviewLaneProps,
  OverlayPluginPreviewWorkbenchStatus,
} from './pluginRuntime';

function resolveSpreadsheetWorkbenchStatus(
  status: { isDirty: boolean; isSaving: boolean } | null,
): OverlayPluginPreviewWorkbenchStatus | null {
  if (!status) {
    return null;
  }

  if (status.isSaving) {
    return {
      label: 'Saving?',
      tone: 'warning',
    };
  }

  if (status.isDirty) {
    return {
      label: 'Unsaved',
      tone: 'danger',
    };
  }

  return {
    label: 'Saved',
    tone: 'success',
  };
}

function resolveShaderWorkbenchStatus(status: {
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
} | null): OverlayPluginPreviewWorkbenchStatus | null {
  if (!status) {
    return null;
  }

  if (status.error) {
    return {
      label: 'Error',
      tone: 'danger',
    };
  }

  if (status.isSaving) {
    return {
      label: 'Saving?',
      tone: 'warning',
    };
  }

  if (status.isDirty) {
    return {
      label: 'Unsaved',
      tone: 'warning',
    };
  }

  return {
    label: 'Saved',
    tone: 'success',
  };
}

function buildStandaloneTextRenderKind(extension: string): 'none' | 'markdown' | 'html' {
  const normalizedExtension = extension.trim().toLowerCase();
  if (normalizedExtension === 'md' || normalizedExtension === 'markdown') {
    return 'markdown';
  }
  if (normalizedExtension === 'html' || normalizedExtension === 'htm') {
    return 'html';
  }
  return 'none';
}

const TEXT_SCRIPT_WORKFLOW_TABS = [
  { id: 'run', label: 'Run', baseMode: 'preview' },
] as const;

const TEXT_PYTHON_WORKFLOW_TABS = [
  { id: 'run', label: 'Run', baseMode: 'preview' },
  { id: 'runtime', label: 'Runtime', baseMode: 'preview' },
] as const;

async function readStandaloneTextPreviewFile(
  filePath: string,
  assetUrl: string,
): Promise<string> {
  if (!filePath.trim()) {
    return '';
  }

  if (
    typeof window !== 'undefined' &&
    (window as any).__TAURI_INTERNALS__ == null &&
    assetUrl.trim()
  ) {
    const response = await fetch(assetUrl);
    return response.text();
  }

  return readExplorerTextFile(filePath);
}

function useStandaloneTextWorkbenchState({
  enabled,
  filePath,
  extension,
  assetUrl,
}: {
  enabled: boolean;
  filePath: string;
  extension: string;
  assetUrl: string;
}) {
  const editorSettings = useSettingsStore((state) => state.settings.editor);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      setContent('');
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    void readStandaloneTextPreviewFile(filePath, assetUrl)
      .then((nextContent) => {
        if (!active) {
          return;
        }
        setContent(nextContent);
        setLoading(false);
      })
      .catch((nextError) => {
        if (!active) {
          return;
        }
        setContent('');
        setError(String(nextError));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [assetUrl, enabled, filePath]);

  return {
    editorSettings,
    content,
    setContent,
    loading,
    error,
    renderKind: buildStandaloneTextRenderKind(extension),
  };
}

function useStandalonePdfDocument({
  enabled,
  filePath,
}: {
  enabled: boolean;
  filePath: string;
}) {
  const [document, setDocument] = useState<ExplorerPdfPreviewDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDocument(null);
      setError(null);
      return;
    }

    let active = true;
    setDocument(null);
    setError(null);
    void openExplorerPdfPreviewDocument(filePath)
      .then((nextDocument) => {
        if (!active) {
          return;
        }
        setDocument(nextDocument);
      })
      .catch((nextError) => {
        if (!active) {
          return;
        }
        setError(String(nextError));
      });

    return () => {
      active = false;
    };
  }, [enabled, filePath]);

  return { document, error };
}

type StandaloneShaderWorkbenchState = {
  format: ExplorerShaderPreviewFormat;
  editableSource: string | null;
  inspectionSource: string;
  isReadOnly: boolean;
  normalizedWgsl: string | null;
  diagnostics: ExplorerShaderPreviewDiagnostic[];
  entryPoints: ExplorerShaderPreviewEntryPoint[];
  selectedScene: 'sphere' | 'fullscreen';
  selectedStage: ExplorerShaderPreviewStage | null;
  selectedEntryPoint: string | null;
  previewAbi: string;
  supportsLivePreview: boolean;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
};

function useStandaloneShaderWorkbenchState({
  enabled,
  filePath,
}: {
  enabled: boolean;
  filePath: string;
}) {
  const shaderPerformanceMode = useSettingsStore(
    (state) => state.settings.appearance.shaderPerformanceMode,
  );
  const [state, setState] = useState<StandaloneShaderWorkbenchState | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setState(null);
    setLoading(true);
    setError(null);
    void inspectExplorerShaderPreviewDocument(filePath)
      .then((document) => {
        if (!active) {
          return;
        }

        setState({
          format: document.format,
          editableSource: document.editableSource,
          inspectionSource: document.inspectionSource,
          isReadOnly: document.isReadOnly,
          normalizedWgsl: document.normalizedWgsl,
          diagnostics: document.diagnostics,
          entryPoints: document.entryPoints,
          selectedScene: 'sphere',
          selectedStage: document.selectedStage,
          selectedEntryPoint: document.selectedEntryPoint,
          previewAbi: document.previewAbi,
          supportsLivePreview: document.supportsLivePreview,
          isDirty: false,
          isSaving: false,
          error: null,
        });
        setLoading(false);
      })
      .catch((nextError) => {
        if (!active) {
          return;
        }
        setState(null);
        setError(String(nextError));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, filePath]);

  const onSourceChange = useCallback((value: string) => {
    setState((current) =>
      current
        ? {
            ...current,
            editableSource: value,
            inspectionSource: value,
            isDirty: true,
            error: null,
          }
        : current,
    );
  }, []);

  const onSelectionChange = useCallback(
    (selection: {
      selectedStage?: ExplorerShaderPreviewStage | null;
      selectedEntryPoint?: string | null;
    }) => {
      setState((current) =>
        current
          ? {
              ...current,
              selectedStage:
                selection.selectedStage !== undefined
                  ? selection.selectedStage
                  : current.selectedStage,
              selectedEntryPoint:
                selection.selectedEntryPoint !== undefined
                  ? selection.selectedEntryPoint
                  : current.selectedEntryPoint,
            }
          : current,
      );
    },
    [],
  );

  const onCompileResult = useCallback((result: ExplorerShaderPreviewCompileOutput) => {
    setState((current) =>
      current
        ? {
            ...current,
            inspectionSource: result.inspectionSource,
            entryPoints: result.entryPoints,
            selectedStage: result.selectedStage,
            selectedEntryPoint: result.selectedEntryPoint,
            diagnostics: result.diagnostics,
            normalizedWgsl: result.normalizedWgsl,
            previewAbi: result.previewAbi,
            supportsLivePreview: result.supportsLivePreview,
            error: null,
          }
        : current,
    );
  }, []);

  const onSceneChange = useCallback((scene: 'sphere' | 'fullscreen') => {
    setState((current) => (current ? { ...current, selectedScene: scene } : current));
  }, []);

  return {
    shaderPerformanceMode,
    state,
    loading,
    error,
    onSourceChange,
    onSelectionChange,
    onCompileResult,
    onSceneChange,
  };
}

export function SqliteWorkbenchPreviewAdapter({
  file,
}: OverlayPluginPreviewLaneProps) {
  return (
    <ExplorerSqlitePreview
      dbPath={file.resolvedPath}
      dbName={file.name}
    />
  );
}

export function FolderWorkbenchPreviewAdapter({
  file,
  workbench,
}: OverlayPluginPreviewLaneProps) {
  if (!file.isDirectory) {
    return null;
  }

  return (
    <ExplorerFolderPreview
      folderPath={file.resolvedPath}
      folderName={file.name}
      refreshRevision={workbench?.collection?.refreshRevision ?? 0}
      showHiddenFiles={workbench?.collection?.showHiddenFiles ?? false}
      onOpenEntry={workbench?.collection?.onOpenEntry ?? (() => {})}
      onStartDragOutEntry={workbench?.collection?.onStartDragOutEntry}
      jumpToFolderEnabled={workbench?.collection?.jumpToFolderEnabled ?? false}
      onToggleJumpToFolder={workbench?.collection?.onToggleJumpToFolder}
      iconTheme={workbench?.collection?.iconTheme}
      folderIconRules={workbench?.collection?.folderIconRules}
      defaultFolderIcon={workbench?.collection?.defaultFolderIcon}
    />
  );
}

export function ArchiveWorkbenchPreviewAdapter({
  file,
  workbench,
}: OverlayPluginPreviewLaneProps) {
  const descriptor =
    workbench?.delegateDescriptor?.kind === 'archive'
      ? workbench.delegateDescriptor.descriptor
      : getExplorerArchiveDescriptor(file.name);

  if (!descriptor) {
    return null;
  }

  return (
    <ExplorerArchivePreview
      archivePath={file.resolvedPath}
      archiveName={file.name}
      archiveSize={file.size}
      descriptor={descriptor}
      onExtract={workbench?.collection?.onExtractArchive ?? (() => {})}
      onOpenEntry={workbench?.collection?.onOpenEntry ?? (() => {})}
      onStartDragOutEntry={workbench?.collection?.onStartDragOutEntry}
      jumpToFolderEnabled={workbench?.collection?.jumpToFolderEnabled ?? false}
      onToggleJumpToFolder={workbench?.collection?.onToggleJumpToFolder}
      iconTheme={workbench?.collection?.iconTheme}
      folderIconRules={workbench?.collection?.folderIconRules}
      defaultFolderIcon={workbench?.collection?.defaultFolderIcon}
    />
  );
}

export function ModelWorkbenchPreviewAdapter({
  file,
  workbench,
}: OverlayPluginPreviewLaneProps) {
  const format =
    workbench?.delegateDescriptor?.kind === 'model3d'
      ? workbench.delegateDescriptor.format
      : getModelPreviewFormat(file.extension);
  if (!format) {
    return null;
  }

  return (
    <ModelPreview
      entryName={file.name}
      format={format}
      sourcePath={file.resolvedPath}
      sourceBytes={file.size}
    />
  );
}

export function PdfWorkbenchPreviewAdapter({
  file,
  workbench,
}: OverlayPluginPreviewLaneProps) {
  const standaloneDocument = useStandalonePdfDocument({
    enabled: !workbench?.pdf,
    filePath: file.resolvedPath,
  });
  const document = workbench?.pdf?.document ?? standaloneDocument.document;

  if (!document) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--overlay-explorer-preview-bg)',
          color: 'var(--overlay-text-muted)',
          fontSize: 11,
        }}
      >
        {standaloneDocument.error ?? 'Loading PDF workbench...'}
      </div>
    );
  }

  return (
    <ExplorerPdfWorkbench
      document={document}
      onSaved={workbench?.pdf?.onSaved}
      onDocumentChange={workbench?.pdf?.onDocumentChange}
      onChromeStateChange={workbench?.pdf?.onChromeStateChange as any}
      onControllerChange={workbench?.pdf?.onControllerChange as any}
      onRegisterCloseGuard={
        workbench?.pdf?.onRegisterCloseGuard
      }
    />
  );
}

export function TextWorkbenchPreviewAdapter({
  appearance,
  file,
  workbench,
  viewMode,
  workflowTabId,
  previewBackedByArchiveVirtual,
  onRegisterWorkflowTabs,
  onRegisterWorkbenchStatus,
}: OverlayPluginPreviewLaneProps) {
  const standaloneState = useStandaloneTextWorkbenchState({
    enabled: !workbench?.text,
    filePath: file.resolvedPath,
    extension: file.extension,
    assetUrl: file.assetUrl,
  });
  const textWorkbench = workbench?.text;
  const content = textWorkbench?.content ?? standaloneState.content;
  const renderKind = textWorkbench?.renderKind ?? standaloneState.renderKind;
  const language = textWorkbench?.language ?? getMonacoLanguage(file.extension);
  const editorSettings = textWorkbench?.editorSettings ?? standaloneState.editorSettings;

  useEffect(() => {
    if (!onRegisterWorkflowTabs) {
      return undefined;
    }

    if (textWorkbench?.pythonPreview) {
      onRegisterWorkflowTabs([...TEXT_PYTHON_WORKFLOW_TABS]);
      return () => onRegisterWorkflowTabs(null);
    }

    if (textWorkbench?.scriptPreview) {
      onRegisterWorkflowTabs([...TEXT_SCRIPT_WORKFLOW_TABS]);
      return () => onRegisterWorkflowTabs(null);
    }

    onRegisterWorkflowTabs(null);
    return () => onRegisterWorkflowTabs(null);
  }, [
    onRegisterWorkflowTabs,
    textWorkbench?.pythonPreview,
    textWorkbench?.scriptPreview,
  ]);

  useEffect(() => {
    if (!onRegisterWorkbenchStatus) {
      return undefined;
    }

    if (textWorkbench) {
      onRegisterWorkbenchStatus({
        label: textWorkbench.isSaving
          ? 'Saving?'
          : textWorkbench.error
            ? 'Error'
            : textWorkbench.isDirty
              ? 'Unsaved'
              : 'Saved',
        tone: textWorkbench.error || textWorkbench.isDirty
          ? 'warning'
          : textWorkbench.isSaving
            ? 'neutral'
            : 'success',
      });
      return () => onRegisterWorkbenchStatus(null);
    }

    onRegisterWorkbenchStatus({
      label: standaloneState.loading
        ? 'Loading'
        : standaloneState.error
          ? 'Error'
          : 'Preview',
      tone: standaloneState.error ? 'danger' : 'neutral',
    });
    return () => onRegisterWorkbenchStatus(null);
  }, [
    onRegisterWorkbenchStatus,
    standaloneState.error,
    standaloneState.loading,
    textWorkbench,
  ]);

  if (!textWorkbench && standaloneState.loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--overlay-explorer-preview-bg)',
          color: 'var(--overlay-text-muted)',
          fontSize: 11,
        }}
      >
        Loading text workbench...
      </div>
    );
  }

  if (!textWorkbench && standaloneState.error) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--overlay-explorer-preview-bg)',
          color: 'var(--overlay-danger, #fca5a5)',
          fontSize: 11,
          padding: 16,
          textAlign: 'center',
        }}
      >
        {standaloneState.error}
      </div>
    );
  }

  return (
    <ExplorerTextWorkbenchSurface
      appearance={appearance as any}
      path={file.resolvedPath}
      name={file.name}
      content={content}
      language={language}
      renderKind={renderKind}
      scriptPreview={textWorkbench?.scriptPreview ?? null}
      pythonPreview={textWorkbench?.pythonPreview ?? null}
      focusTarget={textWorkbench?.focusTarget ?? null}
      viewMode={textWorkbench ? viewMode : renderKind === 'none' ? 'edit' : 'preview'}
      workflowTabId={workflowTabId}
      previewBackedByArchiveVirtual={previewBackedByArchiveVirtual}
      editorSettings={editorSettings}
      pythonRuntimeConfig={textWorkbench?.pythonRuntimeConfig ?? null}
      pythonBootstrapPackageInput={
        textWorkbench?.pythonBootstrapPackageInput ?? ''
      }
      onChange={textWorkbench?.onChange ?? standaloneState.setContent}
      onCursorPositionChange={textWorkbench?.onCursorPositionChange}
      onRunScript={textWorkbench?.onRunScript}
      onStopScriptRun={textWorkbench?.onStopScriptRun}
      onRunPythonManaged={textWorkbench?.onRunPythonManaged}
      onRunPythonInTerminal={textWorkbench?.onRunPythonInTerminal}
      onOpenManagedPythonRepl={textWorkbench?.onOpenManagedPythonRepl}
    />
  );
}

export function ShaderWorkbenchPreviewAdapter({
  appearance,
  file,
  workbench,
  viewMode,
  onRegisterCloseGuard,
  onRegisterWorkbenchStatus,
}: OverlayPluginPreviewLaneProps) {
  const editorSettings = useSettingsStore((state) => state.settings.editor);
  const standaloneState = useStandaloneShaderWorkbenchState({
    enabled: !workbench?.shader,
    filePath: file.resolvedPath,
  });
  const shaderHost = workbench?.shader ?? null;
  const shaderWorkbench = shaderHost ?? standaloneState.state;

  useEffect(() => {
    if (!onRegisterWorkbenchStatus) {
      return undefined;
    }

    if (shaderWorkbench) {
      onRegisterWorkbenchStatus(
        resolveShaderWorkbenchStatus({
          isDirty: shaderWorkbench.isDirty,
          isSaving: shaderWorkbench.isSaving,
          error: shaderWorkbench.error,
        }),
      );
      return () => onRegisterWorkbenchStatus(null);
    }

    onRegisterWorkbenchStatus({
      label: standaloneState.loading
        ? 'Loading'
        : standaloneState.error
          ? 'Error'
          : 'Preview',
      tone: standaloneState.error ? 'danger' : 'neutral',
    });
    return () => onRegisterWorkbenchStatus(null);
  }, [
    onRegisterWorkbenchStatus,
    shaderWorkbench,
    standaloneState.error,
    standaloneState.loading,
  ]);

  if (!shaderWorkbench && standaloneState.loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--overlay-explorer-preview-bg)',
          color: 'var(--overlay-text-muted)',
          fontSize: 11,
        }}
      >
        Loading shader workbench...
      </div>
    );
  }

  if (!shaderWorkbench && standaloneState.error) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--overlay-explorer-preview-bg)',
          color: 'var(--overlay-danger, #fca5a5)',
          fontSize: 11,
          padding: 16,
          textAlign: 'center',
        }}
      >
        {standaloneState.error}
      </div>
    );
  }

  if (!shaderWorkbench) {
    return null;
  }

  return (
    <ExplorerShaderWorkbench
      path={file.resolvedPath}
      name={file.name}
      format={shaderWorkbench.format}
      editableSource={shaderWorkbench.editableSource}
      inspectionSource={shaderWorkbench.inspectionSource}
      isReadOnly={shaderWorkbench.isReadOnly}
      normalizedWgsl={shaderWorkbench.normalizedWgsl}
      diagnostics={shaderWorkbench.diagnostics}
      entryPoints={shaderWorkbench.entryPoints}
      selectedScene={shaderWorkbench.selectedScene}
      selectedStage={shaderWorkbench.selectedStage}
      selectedEntryPoint={shaderWorkbench.selectedEntryPoint}
      isDirty={shaderWorkbench.isDirty}
      isSaving={shaderWorkbench.isSaving}
      error={shaderWorkbench.error}
      viewMode={viewMode}
      appearance={appearance as any}
      editorSettings={editorSettings}
      shaderPerformanceMode={standaloneState.shaderPerformanceMode}
      onSourceChange={(_path, value) =>
        shaderHost
          ? shaderHost.onSourceChange(value)
          : standaloneState.onSourceChange(value)
      }
      onSelectionChange={(_path, selection) =>
        shaderHost
          ? shaderHost.onSelectionChange(selection)
          : standaloneState.onSelectionChange(selection)
      }
      onCompileResult={(_path, result) =>
        shaderHost
          ? shaderHost.onCompileResult(result)
          : standaloneState.onCompileResult(result)
      }
      onRegisterCloseGuard={onRegisterCloseGuard}
    />
  );
}

export function DocxWorkbenchPreviewAdapter({
  file,
  onRefreshPreviewEntry,
}: OverlayPluginPreviewLaneProps) {
  return (
    <ExplorerDocxWorkbench
      path={file.resolvedPath}
      name={file.name}
      extension={file.extension}
      onRefreshPreviewEntry={onRefreshPreviewEntry}
    />
  );
}

export function SpreadsheetWorkbenchPreviewAdapter({
  file,
  previewBackedByArchiveVirtual,
  viewMode,
  onRegisterCloseGuard,
  onRegisterWorkbenchStatus,
  onRefreshPreviewEntry,
  onViewModeChange,
}: OverlayPluginPreviewLaneProps) {
  const handleStatusChange = useCallback(
    (status: { isDirty: boolean; isSaving: boolean } | null) => {
      onRegisterWorkbenchStatus?.(
        resolveSpreadsheetWorkbenchStatus(status),
      );
    },
    [onRegisterWorkbenchStatus],
  );

  useEffect(
    () => () => {
      onRegisterWorkbenchStatus?.(null);
    },
    [onRegisterWorkbenchStatus],
  );

  return (
    <ExplorerSpreadsheetWorkbench
      path={file.resolvedPath}
      name={file.name}
      sourceExtension={file.extension}
      fileKind={getSpreadsheetFileKind(file.extension) ?? 'workbook'}
      mode={previewBackedByArchiveVirtual ? 'preview' : viewMode}
      onModeChange={onViewModeChange}
      onRefreshPreviewEntry={onRefreshPreviewEntry}
      onRegisterCloseGuard={onRegisterCloseGuard}
      onStatusChange={handleStatusChange}
    />
  );
}

export function AudioWorkbenchPreviewAdapter({
  file,
  viewMode,
  workflowTabId,
  onRegisterWorkflowTabs,
  onRefreshPreviewEntry,
}: OverlayPluginPreviewLaneProps) {
  return (
    <ExplorerAudioWorkbench
      audioPath={file.resolvedPath}
      audioName={file.name}
      audioExtension={file.extension}
      audioSize={file.size}
      mode={viewMode}
      workflowTabId={workflowTabId}
      onRegisterWorkflowTabs={onRegisterWorkflowTabs}
      onExported={() => onRefreshPreviewEntry?.()}
    />
  );
}

export function ImageWorkbenchPreviewAdapter({
  file,
  viewMode,
  workflowTabId,
  previewBackedByArchiveVirtual,
  onRegisterWorkflowTabs,
  onRegisterContextMenuRegistration,
  onRefreshPreviewEntry,
}: OverlayPluginPreviewLaneProps) {
  const isEditableImageFormat = getImageEditorContentType(file.extension) != null;
  const imageSource = file.assetUrl.trim() || file.resolvedPath;

  return (
    <ExplorerImageEditor
      imagePath={file.resolvedPath}
      logicalImagePath={file.path}
      imageName={file.name}
      imageSource={imageSource}
      mode={
        isEditableImageFormat &&
        viewMode === 'edit' &&
        !previewBackedByArchiveVirtual
          ? 'edit'
          : 'preview'
      }
      workflowTabId={workflowTabId}
      onRegisterWorkflowTabs={onRegisterWorkflowTabs}
      onRegisterContextMenuRegistration={onRegisterContextMenuRegistration}
      onSaved={() => onRefreshPreviewEntry?.()}
    />
  );
}

export function VideoWorkbenchPreviewAdapter({
  file,
  viewMode,
  onRefreshPreviewEntry,
}: OverlayPluginPreviewLaneProps) {
  return (
    <ExplorerVideoEditor
      videoPath={file.resolvedPath}
      videoName={file.name}
      videoSource={file.assetUrl}
      videoExtension={file.extension}
      videoMimeType={getVideoPreviewMimeType(file.extension)}
      videoSize={file.size}
      mode={viewMode}
      onExported={() => onRefreshPreviewEntry?.()}
    />
  );
}
