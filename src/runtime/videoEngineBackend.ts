import type {
  VideoEngineLoadSourceRequest,
  VideoEngineLoopRegion,
  VideoEngineLoopRegionRequest,
  VideoEngineSeekRequest,
  VideoEngineStateEvent,
  VideoEngineStateSnapshot,
  VideoPlaybackBackend,
} from '../generated/tauri';
import { commands, events, unwrapTauriResult } from './tauriClient';

export type ExplorerVideoPlaybackBackend = VideoPlaybackBackend;
export type ExplorerVideoEngineLoopRegion = VideoEngineLoopRegion;
export type ExplorerVideoEngineStateEvent = VideoEngineStateEvent;
export type ExplorerVideoEngineStateSnapshot = VideoEngineStateSnapshot;

export async function prepareExplorerVideoEngine(): Promise<ExplorerVideoEngineStateSnapshot> {
  return unwrapTauriResult(await commands.videoEnginePrepare());
}

export async function getExplorerVideoEngineState(): Promise<ExplorerVideoEngineStateSnapshot> {
  return unwrapTauriResult(await commands.videoEngineGetState());
}

export async function loadExplorerVideoSource(
  request: VideoEngineLoadSourceRequest,
): Promise<ExplorerVideoEngineStateSnapshot> {
  return unwrapTauriResult(await commands.videoEngineLoadSource(request));
}

export async function playExplorerVideo(): Promise<ExplorerVideoEngineStateSnapshot> {
  return unwrapTauriResult(await commands.videoEnginePlay());
}

export async function pauseExplorerVideo(): Promise<ExplorerVideoEngineStateSnapshot> {
  return unwrapTauriResult(await commands.videoEnginePause());
}

export async function stopExplorerVideo(): Promise<ExplorerVideoEngineStateSnapshot> {
  return unwrapTauriResult(await commands.videoEngineStop());
}

export async function seekExplorerVideo(
  request: VideoEngineSeekRequest,
): Promise<ExplorerVideoEngineStateSnapshot> {
  return unwrapTauriResult(await commands.videoEngineSeek(request));
}

export async function setExplorerVideoLoopRegion(
  request: VideoEngineLoopRegionRequest,
): Promise<ExplorerVideoEngineStateSnapshot> {
  return unwrapTauriResult(await commands.videoEngineSetLoopRegion(request));
}

export async function listenToExplorerVideoEngineState(
  listener: (event: ExplorerVideoEngineStateEvent) => void,
): Promise<() => void> {
  return events.videoEngineStateEvent.listen(
    (event: { payload: ExplorerVideoEngineStateEvent }) => listener(event.payload),
  );
}
