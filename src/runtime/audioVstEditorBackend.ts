import { invoke } from '@tauri-apps/api/core';
import type { Result } from '../generated/tauri';
import type { ExplorerAudioDeckId } from './audioWorkbenchBackend';
import { unwrapTauriResult } from './tauriClient';

export type ExplorerVstEditorAttachMode = 'inline' | 'detached' | 'unavailable';

export interface ExplorerVstEditorHostRect {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

export interface ExplorerVstEditorSessionState {
  sessionId: string;
  deckId: ExplorerAudioDeckId;
  pluginPath: string;
  attachMode: ExplorerVstEditorAttachMode;
  statusLabel: string;
  lastRect: ExplorerVstEditorHostRect | null;
}

export interface ExplorerVstEditorSessionCreateRequest {
  deckId: ExplorerAudioDeckId;
  pluginPath: string;
}

export interface ExplorerVstEditorSessionRectRequest {
  sessionId: string;
  rect: ExplorerVstEditorHostRect;
}

export async function createExplorerVstEditorSession(
  request: ExplorerVstEditorSessionCreateRequest,
): Promise<ExplorerVstEditorSessionState> {
  return unwrapTauriResult(
    await invoke<Result<ExplorerVstEditorSessionState, string>>(
      'vst_host_create_editor_session',
      { request },
    ),
  );
}

export async function syncExplorerVstEditorSessionRect(
  request: ExplorerVstEditorSessionRectRequest,
): Promise<ExplorerVstEditorSessionState> {
  return unwrapTauriResult(
    await invoke<Result<ExplorerVstEditorSessionState, string>>(
      'vst_host_update_editor_session_rect',
      { request },
    ),
  );
}

export async function focusExplorerVstEditorSession(
  sessionId: string,
): Promise<ExplorerVstEditorSessionState> {
  return unwrapTauriResult(
    await invoke<Result<ExplorerVstEditorSessionState, string>>(
      'vst_host_focus_editor_session',
      { sessionId },
    ),
  );
}

export async function destroyExplorerVstEditorSession(
  sessionId: string,
): Promise<void> {
  unwrapTauriResult(
    await invoke<Result<null, string>>('vst_host_destroy_editor_session', {
      sessionId,
    }),
  );
}
