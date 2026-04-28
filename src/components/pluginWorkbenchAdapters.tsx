import { useCallback, useEffect } from 'react';
import {
  getSpreadsheetFileKind,
  getVideoPreviewMimeType,
} from '../config/filePreview';
import { ExplorerAudioWorkbench } from './ExplorerAudioWorkbench';
import { ExplorerDocxWorkbench } from './ExplorerDocxWorkbench';
import { ExplorerSpreadsheetWorkbench } from './ExplorerSpreadsheetWorkbench';
import { ExplorerSqlitePreview } from './ExplorerSqlitePreview';
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
