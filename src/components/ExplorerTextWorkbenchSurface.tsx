import React from 'react';

import {
  buildExplorerMonacoPreviewOptions,
  getExplorerTextPreviewMetrics,
} from '../config/explorerMonaco';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import type { ManagedPythonRuntimeConfig } from '../runtime/pythonRuntimeBackend';
import type { ExplorerResolvedScriptPreview } from './explorer/explorerScriptRuntime';
import type { EditorSearchFocusTarget } from './fileExplorerSearchFocus';
import { TextDocumentPreview, type DocumentPreviewKind } from './documentPreview';
import { ExplorerMonacoCodeView, type ExplorerMonacoCursorPosition } from './ExplorerMonacoCodeView';
import { ExplorerPythonWorkbench } from './ExplorerPythonWorkbench';

export interface ExplorerTextWorkbenchSurfaceProps {
  appearance?: ResolvedOverlayAppearance;
  path: string;
  name: string;
  content: string;
  language: string;
  renderKind: DocumentPreviewKind;
  scriptPreview: ExplorerResolvedScriptPreview | null;
  pythonPreview: { source: 'extension' | 'executable' } | null;
  focusTarget: EditorSearchFocusTarget | null;
  viewMode: 'preview' | 'edit';
  workflowTabId: string;
  previewBackedByArchiveVirtual: boolean;
  editorSettings: import('../store/settingsStore').EditorSettings;
  pythonRuntimeConfig: ManagedPythonRuntimeConfig | null;
  pythonBootstrapPackageInput: string;
  onChange: (value: string) => void;
  onCursorPositionChange?: (
    position: ExplorerMonacoCursorPosition,
  ) => void;
  onRunPythonManaged?: () => Promise<unknown>;
  onRunPythonInTerminal?: () => Promise<void>;
  onOpenManagedPythonRepl?: () => Promise<void>;
}

function DocumentPreviewFallback({ label }: { label: string }) {
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
      {label}
    </div>
  );
}

export function ExplorerTextWorkbenchSurface({
  appearance,
  path,
  name,
  content,
  language,
  renderKind,
  scriptPreview,
  pythonPreview,
  focusTarget,
  viewMode,
  workflowTabId,
  previewBackedByArchiveVirtual,
  editorSettings,
  pythonRuntimeConfig,
  pythonBootstrapPackageInput,
  onChange,
  onCursorPositionChange,
  onRunPythonManaged,
  onRunPythonInTerminal,
  onOpenManagedPythonRepl,
}: ExplorerTextWorkbenchSurfaceProps) {
  const supportsRenderedPreview =
    scriptPreview == null && renderKind !== 'none';
  const showsPythonWorkbench = pythonPreview != null;
  const textPreviewMetrics = getExplorerTextPreviewMetrics(content);

  if (viewMode === 'preview' && supportsRenderedPreview) {
    return <TextDocumentPreview kind={renderKind} content={content} sourcePath={path} />;
  }

  if (showsPythonWorkbench) {
    return (
      <ExplorerPythonWorkbench
        pythonPath={path}
        pythonName={name}
        workingDirectory={path.replace(/[/\\][^/\\]+$/, '') || ''}
        workflowTabId={workflowTabId}
        runtimeConfig={pythonRuntimeConfig}
        packageInput={pythonBootstrapPackageInput}
        onRunManaged={async () => {
          if (!onRunPythonManaged) {
            throw new Error('Python run is unavailable in this host.');
          }
          return onRunPythonManaged();
        }}
        onRunInTerminal={async () => {
          if (!onRunPythonInTerminal) {
            return;
          }
          await onRunPythonInTerminal();
        }}
        onOpenManagedRepl={async () => {
          if (!onOpenManagedPythonRepl) {
            return;
          }
          await onOpenManagedPythonRepl();
        }}
      />
    );
  }

  if (
    viewMode === 'edit' ||
    pythonPreview != null ||
    (scriptPreview == null && !supportsRenderedPreview)
  ) {
    return (
      <ExplorerMonacoCodeView
        appearance={appearance}
        path={path}
        value={content || ''}
        language={language || 'plaintext'}
        focusTarget={focusTarget}
        onChange={
          previewBackedByArchiveVirtual ||
          (pythonPreview != null && viewMode !== 'edit')
            ? undefined
            : onChange
        }
        onCursorPositionChange={onCursorPositionChange}
        options={buildExplorerMonacoPreviewOptions({
          editorSettings,
          lineCount: textPreviewMetrics.lineCount ?? 1,
          readOnly:
            previewBackedByArchiveVirtual ||
            (pythonPreview != null && viewMode !== 'edit'),
          allowFolding: false,
          topPadding: 8,
        })}
      />
    );
  }

  return <DocumentPreviewFallback label="Text workbench unavailable." />;
}
