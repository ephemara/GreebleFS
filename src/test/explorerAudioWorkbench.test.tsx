import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerAudioWorkbench } from '../components/ExplorerAudioWorkbench';
import type { ExplorerAudioEngineStateSnapshot } from '../runtime/audioWorkbenchBackend';

const {
  analyzeExplorerAudioPreviewMock,
  exportExplorerAudioTransformMock,
} = vi.hoisted(() => ({
  analyzeExplorerAudioPreviewMock: vi.fn(),
  exportExplorerAudioTransformMock: vi.fn(),
}));

const {
  loadSelectionIntoAudioDeckMock,
  pauseAudioDeckMock,
  playAudioDeckMock,
  seekAudioDeckMock,
  setAudioDeckGainMock,
  setAudioDeckLoopRegionMock,
  setAudioDeckRateMock,
  stopAudioDeckMock,
} = vi.hoisted(() => ({
  loadSelectionIntoAudioDeckMock: vi.fn(),
  pauseAudioDeckMock: vi.fn(),
  playAudioDeckMock: vi.fn(),
  seekAudioDeckMock: vi.fn(),
  setAudioDeckGainMock: vi.fn(),
  setAudioDeckLoopRegionMock: vi.fn(),
  setAudioDeckRateMock: vi.fn(),
  stopAudioDeckMock: vi.fn(),
}));

const audioEngineSnapshot: ExplorerAudioEngineStateSnapshot = {
  ready: true,
  engineError: null,
  armedDeck: 'a',
  outputSampleRateHz: 48000,
  outputChannels: 2,
  decks: [
    {
      deckId: 'a',
      loadedPath: '/tmp/anthem.mp3',
      loadedName: 'anthem.mp3',
      durationSeconds: 24,
      currentTimeSeconds: 6,
      gainLinear: 1,
      rate: 1,
      isPlaying: false,
      isLoading: false,
      isBuffering: false,
      peakMeterLinear: 0.82,
      rmsMeterLinear: 0.45,
      loopRegion: {
        startSeconds: 0,
        endSeconds: 24,
        enabled: false,
      },
      error: null,
    },
    {
      deckId: 'b',
      loadedPath: '/tmp/reference.wav',
      loadedName: 'reference.wav',
      durationSeconds: 12,
      currentTimeSeconds: 0,
      gainLinear: 1,
      rate: 1,
      isPlaying: false,
      isLoading: false,
      isBuffering: false,
      peakMeterLinear: 0.12,
      rmsMeterLinear: 0.08,
      loopRegion: {
        startSeconds: 0,
        endSeconds: 12,
        enabled: false,
      },
      error: null,
    },
  ],
};

const waveformTimelineRect = {
  left: 0,
  top: 0,
  width: 240,
  height: 120,
  right: 240,
  bottom: 120,
  x: 0,
  y: 0,
  toJSON() {
    return this;
  },
} as DOMRect;

vi.mock('../runtime/audioWorkbenchBackend', () => ({
  analyzeExplorerAudioPreview: analyzeExplorerAudioPreviewMock,
  exportExplorerAudioTransform: exportExplorerAudioTransformMock,
}));

vi.mock('../store/audioEngineStore', () => ({
  useAudioEngineFeed: () => undefined,
  useAudioEngineSnapshot: () => audioEngineSnapshot,
  useAudioEngineStore: {
    getState: () => ({ snapshot: audioEngineSnapshot }),
  },
  getAudioDeckState: (
    snapshot: ExplorerAudioEngineStateSnapshot,
    deckId: 'a' | 'b',
  ) => snapshot.decks.find((deck) => deck.deckId === deckId) ?? snapshot.decks[0],
  loadSelectionIntoAudioDeck: loadSelectionIntoAudioDeckMock,
  pauseAudioDeck: pauseAudioDeckMock,
  playAudioDeck: playAudioDeckMock,
  seekAudioDeck: seekAudioDeckMock,
  setAudioDeckGain: setAudioDeckGainMock,
  setAudioDeckLoopRegion: setAudioDeckLoopRegionMock,
  setAudioDeckRate: setAudioDeckRateMock,
  stopAudioDeck: stopAudioDeckMock,
}));

describe('ExplorerAudioWorkbench', () => {
  beforeEach(() => {
    analyzeExplorerAudioPreviewMock.mockReset();
    exportExplorerAudioTransformMock.mockReset();
    loadSelectionIntoAudioDeckMock.mockReset();
    pauseAudioDeckMock.mockReset();
    playAudioDeckMock.mockReset();
    seekAudioDeckMock.mockReset();
    setAudioDeckGainMock.mockReset();
    setAudioDeckLoopRegionMock.mockReset();
    setAudioDeckRateMock.mockReset();
    stopAudioDeckMock.mockReset();

    loadSelectionIntoAudioDeckMock.mockResolvedValue(audioEngineSnapshot);
    pauseAudioDeckMock.mockResolvedValue(audioEngineSnapshot);
    playAudioDeckMock.mockResolvedValue(audioEngineSnapshot);
    seekAudioDeckMock.mockResolvedValue(audioEngineSnapshot);
    setAudioDeckGainMock.mockResolvedValue(audioEngineSnapshot);
    setAudioDeckLoopRegionMock.mockResolvedValue(audioEngineSnapshot);
    setAudioDeckRateMock.mockResolvedValue(audioEngineSnapshot);
    stopAudioDeckMock.mockResolvedValue(audioEngineSnapshot);

    analyzeExplorerAudioPreviewMock.mockResolvedValue({
      inputPath: '/tmp/anthem.mp3',
      durationSeconds: 24,
      sampleRateHz: 44100,
      channels: 2,
      encoding: 'MPEG audio',
      bitsPerSample: 16,
      containerType: 'mp3',
      peakLevel: 0.82,
      rmsLevel: 0.45,
      loudnessDb: -6.9,
      headroomDb: 1.7,
      waveformBuckets: Array.from({ length: 24 }, (_, index) => ({
        index,
        peakLevel: 0.25 + index * 0.01,
        rmsLevel: 0.12 + index * 0.004,
      })),
      spectralBands: Array.from({ length: 24 }, (_, index) => 1 - index / 24),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('renders native analysis cards for the selected audio file', async () => {
    render(
      <ExplorerAudioWorkbench
        audioPath='/tmp/anthem.mp3'
        audioName='anthem.mp3'
        audioExtension='mp3'
        audioSize={6 * 1024 * 1024}
      />,
    );

    expect(
      await screen.findByText(/loaded in the native engine/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/44,100 Hz/i)).toBeInTheDocument();
    expect(screen.getAllByText('0:24').length).toBeGreaterThan(0);
    expect(screen.getByText('MPEG audio · 16-bit')).toBeInTheDocument();
    expect(screen.getByText(/loaded file/i)).toBeInTheDocument();
    expect(screen.queryByText(/^deck b$/i)).not.toBeInTheDocument();
  });

  it('loads the current explorer selection into the single native playback lane', async () => {
    render(
      <ExplorerAudioWorkbench
        audioPath='/tmp/anthem.mp3'
        audioName='anthem.mp3'
        audioExtension='mp3'
        audioSize={6 * 1024 * 1024}
      />,
    );

    await waitFor(() => {
      expect(loadSelectionIntoAudioDeckMock).toHaveBeenCalledWith('a', '/tmp/anthem.mp3');
    });
  });

  it('keeps overwrite-original behind an explicit confirmation dialog', async () => {
    exportExplorerAudioTransformMock.mockResolvedValue({
      taskId: 'audio-transform-1',
      outputPath: '/tmp/anthem.mp3',
      spectrogramPath: null,
      durationSeconds: 24,
      outputFormat: 'mp3',
      overwrittenOriginal: true,
      soxBinary: '/tmp/sox',
    });

    render(
      <ExplorerAudioWorkbench
        audioPath='/tmp/anthem.mp3'
        audioName='anthem.mp3'
        audioExtension='mp3'
        audioSize={6 * 1024 * 1024}
      />,
    );

    await screen.findByText(/loaded in the native engine/i);
    fireEvent.click(screen.getByRole('button', { name: /overwrite original/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: /^overwrite original$/i }),
    );

    await waitFor(() => {
      expect(exportExplorerAudioTransformMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inputPath: '/tmp/anthem.mp3',
          outputPath: '/tmp/anthem.mp3',
          mode: 'overwriteOriginal',
        }),
      );
    });
  });

  it('defaults non-destructive exports to wav even for mp3 sources', async () => {
    exportExplorerAudioTransformMock.mockResolvedValue({
      taskId: 'audio-transform-2',
      outputPath: '/tmp/anthem.clip.wav',
      spectrogramPath: null,
      durationSeconds: 24,
      outputFormat: 'wav',
      overwrittenOriginal: false,
      soxBinary: '/tmp/sox',
    });

    render(
      <ExplorerAudioWorkbench
        audioPath='/tmp/anthem.mp3'
        audioName='anthem.mp3'
        audioExtension='mp3'
        audioSize={6 * 1024 * 1024}
      />,
    );

    await screen.findByText(/loaded in the native engine/i);
    fireEvent.click(screen.getByRole('button', { name: /export clip/i }));

    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByDisplayValue('/tmp/anthem.clip.wav');
    fireEvent.change(input, { target: { value: '/tmp/anthem.clip.wav' } });
    fireEvent.click(
      within(dialog).getByRole('button', { name: /run sox export/i }),
    );

    await waitFor(() => {
      expect(exportExplorerAudioTransformMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inputPath: '/tmp/anthem.mp3',
          outputPath: '/tmp/anthem.clip.wav',
          outputFormat: 'wav',
          mode: 'exportClip',
        }),
      );
    });
  });

  it('lets the waveform fade handles drive export fade settings', async () => {
    exportExplorerAudioTransformMock.mockResolvedValue({
      taskId: 'audio-transform-3',
      outputPath: '/tmp/anthem.clip.wav',
      spectrogramPath: null,
      durationSeconds: 24,
      outputFormat: 'wav',
      overwrittenOriginal: false,
      soxBinary: '/tmp/sox',
    });

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      waveformTimelineRect,
    );

    render(
      <ExplorerAudioWorkbench
        audioPath='/tmp/anthem.mp3'
        audioName='anthem.mp3'
        audioExtension='mp3'
        audioSize={6 * 1024 * 1024}
      />,
    );

    await screen.findByText(/loaded in the native engine/i);

    fireEvent.mouseDown(screen.getByRole('slider', { name: /fade in handle/i }), {
      clientX: 60,
    });
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(screen.getByRole('slider', { name: /fade out handle/i }), {
      clientX: 180,
    });
    fireEvent.mouseUp(window);

    fireEvent.click(screen.getByRole('button', { name: /export clip/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: /run sox export/i }),
    );

    await waitFor(() => {
      expect(exportExplorerAudioTransformMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inputPath: '/tmp/anthem.mp3',
          trimStartSeconds: 0,
          trimEndSeconds: 24,
          fadeInSeconds: 6,
          fadeOutSeconds: 6,
          mode: 'exportClip',
        }),
      );
    });
  });
});
