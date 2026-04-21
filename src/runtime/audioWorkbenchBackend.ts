import type {
  AudioBatchProcessRequest,
  AudioBatchProcessResult,
  AudioDeckId,
  AudioDeckState,
  AudioEngineDeckRequest,
  AudioEngineGainRequest,
  AudioEngineLoadDeckRequest,
  AudioEngineLoadPluginRequest,
  AudioEngineLoopRegionRequest,
  AudioEngineRateRequest,
  AudioEngineSeekRequest,
  AudioEngineSetArmedDeckRequest,
  AudioEngineStateEvent,
  AudioEngineStateSnapshot,
  AudioEngineSyncSelectionRequest,
  AudioPreviewAnalysis,
  AudioTransformRequest,
  AudioTransformResult,
} from '../generated/tauri';
import { commands, events, unwrapTauriResult } from './tauriClient';

export type ExplorerAudioDeckId = AudioDeckId;
export type ExplorerAudioDeckState = AudioDeckState;
export type ExplorerAudioEngineStateEvent = AudioEngineStateEvent;
export type ExplorerAudioEngineStateSnapshot = AudioEngineStateSnapshot;
export type ExplorerAudioPreviewAnalysis = AudioPreviewAnalysis;
export type ExplorerAudioTransformInput = AudioTransformRequest;
export type ExplorerAudioTransformOutput = AudioTransformResult;
export type ExplorerAudioBatchInput = AudioBatchProcessRequest;
export type ExplorerAudioBatchOutput = AudioBatchProcessResult;
export interface ExplorerAudioDeckPluginParameterRequest {
  deckId: ExplorerAudioDeckId;
  parameterId: number;
  valueNormalized: number;
}

export async function analyzeExplorerAudioPreview(
  inputPath: string,
): Promise<ExplorerAudioPreviewAnalysis> {
  return unwrapTauriResult(await commands.audioAnalyzePreview(inputPath));
}

export async function exportExplorerAudioTransform(
  request: ExplorerAudioTransformInput,
): Promise<ExplorerAudioTransformOutput> {
  return unwrapTauriResult(await commands.audioExportTransform(request));
}

export async function runExplorerAudioBatchProcess(
  request: ExplorerAudioBatchInput,
): Promise<ExplorerAudioBatchOutput> {
  return unwrapTauriResult(await commands.audioBatchProcess(request));
}

export async function prepareExplorerAudioEngine(): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEnginePrepare());
}

export async function getExplorerAudioEngineState(): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineGetState());
}

export async function loadExplorerAudioDeck(
  request: AudioEngineLoadDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineLoadDeck(request));
}

export async function syncExplorerSelectionToArmedDeck(
  request: AudioEngineSyncSelectionRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(
    await commands.audioEngineSyncSelectionToArmedDeck(request),
  );
}

export async function unloadExplorerAudioDeck(
  request: AudioEngineDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineUnloadDeck(request));
}

export async function setExplorerArmedAudioDeck(
  request: AudioEngineSetArmedDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineSetArmedDeck(request));
}

export async function playExplorerAudioDeck(
  request: AudioEngineDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEnginePlay(request));
}

export async function pauseExplorerAudioDeck(
  request: AudioEngineDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEnginePause(request));
}

export async function stopExplorerAudioDeck(
  request: AudioEngineDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineStop(request));
}

export async function seekExplorerAudioDeck(
  request: AudioEngineSeekRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineSeek(request));
}

export async function setExplorerAudioLoopRegion(
  request: AudioEngineLoopRegionRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineSetLoopRegion(request));
}

export async function setExplorerAudioDeckGain(
  request: AudioEngineGainRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineSetGain(request));
}

export async function setExplorerAudioDeckRate(
  request: AudioEngineRateRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineSetRate(request));
}

export async function listenToExplorerAudioEngineState(
  listener: (event: ExplorerAudioEngineStateEvent) => void,
): Promise<() => void> {
  return events.audioEngineStateEvent.listen(
    (event: { payload: ExplorerAudioEngineStateEvent }) => listener(event.payload),
  );
}

export async function loadExplorerAudioDeckPlugin(
  request: AudioEngineLoadPluginRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineLoadPlugin(request));
}

export async function clearExplorerAudioDeckPlugin(
  request: AudioEngineDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineClearDeckPlugin(request));
}

export async function setExplorerAudioDeckPluginParameter(
  request: ExplorerAudioDeckPluginParameterRequest,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return unwrapTauriResult(await commands.audioEngineSetPluginParameter(request));
}
