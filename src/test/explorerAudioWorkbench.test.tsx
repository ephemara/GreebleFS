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
  loadAudioDeckPluginMock,
  clearAudioDeckPluginMock,
} = vi.hoisted(() => ({
  loadSelectionIntoAudioDeckMock: vi.fn(),
  pauseAudioDeckMock: vi.fn(),
  playAudioDeckMock: vi.fn(),
  seekAudioDeckMock: vi.fn(),
  setAudioDeckGainMock: vi.fn(),
  setAudioDeckLoopRegionMock: vi.fn(),
  setAudioDeckRateMock: vi.fn(),
  stopAudioDeckMock: vi.fn(),
  loadAudioDeckPluginMock: vi.fn(),
  clearAudioDeckPluginMock: vi.fn(),
}));

const {
  getExplorerVstDefaultScanPathsMock,
  scanExplorerVstPluginsMock,
} = vi.hoisted(() => ({
  getExplorerVstDefaultScanPathsMock: vi.fn(),
  scanExplorerVstPluginsMock: vi.fn(),
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
      activePluginPath: null,
      vstParameters: [],
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
      activePluginPath: null,
      vstParameters: [],
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

vi.mock('../runtime/vstBackend', () => ({
  getExplorerVstDefaultScanPaths: getExplorerVstDefaultScanPathsMock,
  scanExplorerVstPlugins: scanExplorerVstPluginsMock,
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
  loadAudioDeckPlugin: loadAudioDeckPluginMock,
  clearAudioDeckPlugin: clearAudioDeckPluginMock,
}));

vi.mock('../store/settingsStore', () => ({
  useSettingsStore: (selector: (state: {
    settings: {
      keybindings: {
        audioWorkbenchPlayPause: string;
        audioWorkbenchToggleEditMode: string;
        audioWorkbenchJumpToSelectionStart: string;
        audioWorkbenchJumpToSelectionEnd: string;
        audioWorkbenchPreviousSilence: string;
        audioWorkbenchNextSilence: string;
        audioWorkbenchExportClip: string;
      };
      audio?: {
        vst3AdditionalFolders?: string[];
      };
    };
  }) => unknown) =>
    selector({
      settings: {
        keybindings: {
          audioWorkbenchPlayPause: 'Space',
          audioWorkbenchToggleEditMode: 'E',
          audioWorkbenchJumpToSelectionStart: 'I',
          audioWorkbenchJumpToSelectionEnd: 'O',
          audioWorkbenchPreviousSilence: 'Shift+ArrowLeft',
          audioWorkbenchNextSilence: 'Shift+ArrowRight',
          audioWorkbenchExportClip: 'Ctrl+Shift+S',
        },
        audio: {
          vst3AdditionalFolders: [],
        },
      },
    }),
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
    loadAudioDeckPluginMock.mockReset();
    clearAudioDeckPluginMock.mockReset();
    getExplorerVstDefaultScanPathsMock.mockReset();
    scanExplorerVstPluginsMock.mockReset();

    loadSelectionIntoAudioDeckMock.mockResolvedValue(audioEngineSnapshot);
    pauseAudioDeckMock.mockResolvedValue(audioEngineSnapshot);
    playAudioDeckMock.mockResolvedValue(audioEngineSnapshot);
    seekAudioDeckMock.mockResolvedValue(audioEngineSnapshot);
    setAudioDeckGainMock.mockResolvedValue(audioEngineSnapshot);
    setAudioDeckLoopRegionMock.mockResolvedValue(audioEngineSnapshot);
    setAudioDeckRateMock.mockResolvedValue(audioEngineSnapshot);
    stopAudioDeckMock.mockResolvedValue(audioEngineSnapshot);
    loadAudioDeckPluginMock.mockResolvedValue(audioEngineSnapshot);
    clearAudioDeckPluginMock.mockResolvedValue(audioEngineSnapshot);
    getExplorerVstDefaultScanPathsMock.mockResolvedValue([
      {
        exists: true,
        path: '/Library/Audio/Plug-Ins/VST3',
      },
    ]);
    scanExplorerVstPluginsMock.mockResolvedValue([]);

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
      estimatedBpm: 128,
      silenceRegions: [
        { startSeconds: 0, endSeconds: 0.4, durationSeconds: 0.4 },
        { startSeconds: 23.2, endSeconds: 24, durationSeconds: 0.8 },
      ],
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
      await screen.findByText(/audio loaded and ready for playback/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/44,100 Hz/i)).toBeInTheDocument();
    expect(screen.getByText(/0:24/i)).toBeInTheDocument();
    expect(screen.getByText(/128 BPM/i)).toBeInTheDocument();
    expect(screen.getByText(/silence regions: 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/^deck b$/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(scanExplorerVstPluginsMock).toHaveBeenCalledWith([
        '/Library/Audio/Plug-Ins/VST3',
      ]);
    });
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

  it('loads the native deck before requesting preview analysis', async () => {
    render(
      <ExplorerAudioWorkbench
        audioPath='/tmp/anthem.mp3'
        audioName='anthem.mp3'
        audioExtension='mp3'
        audioSize={6 * 1024 * 1024}
      />,
    );

    await waitFor(() => {
      expect(analyzeExplorerAudioPreviewMock).toHaveBeenCalledWith('/tmp/anthem.mp3');
    });

    expect(loadSelectionIntoAudioDeckMock.mock.invocationCallOrder[0]).toBeLessThan(
      analyzeExplorerAudioPreviewMock.mock.invocationCallOrder[0],
    );
  });

  it('keeps preview mode focused on the clean player and skips edit-only chrome', async () => {
    render(
      <ExplorerAudioWorkbench
        audioPath='/tmp/anthem.mp3'
        audioName='anthem.mp3'
        audioExtension='mp3'
        audioSize={6 * 1024 * 1024}
        mode='preview'
      />,
    );

    expect(await screen.findByTestId('audio-preview-surface')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play audio preview/i })).toBeInTheDocument();
    expect(screen.queryByText(/precision trim/i)).toBeNull();
    expect(screen.queryByText(/transform & export/i)).toBeNull();
    expect(screen.queryByText(/plugin rack \(vst3\)/i)).toBeNull();
    expect(screen.getByText(/space play\/pause/i)).toBeInTheDocument();
    expect(screen.getByText(/e edit/i)).toBeInTheDocument();
    expect(scanExplorerVstPluginsMock).not.toHaveBeenCalled();
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

    await screen.findByText(/audio loaded and ready for playback/i);
    fireEvent.click(screen.getByRole('button', { name: /save edits to file/i }));

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

    await screen.findByText(/audio loaded and ready for playback/i);
    fireEvent.click(screen.getByRole('button', { name: /export clip/i }));

    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByDisplayValue('/tmp/anthem.clip.wav');
    fireEvent.change(input, { target: { value: '/tmp/anthem.clip.wav' } });
    fireEvent.click(
      within(dialog).getByRole('button', { name: /export audio/i }),
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

    await screen.findByText(/audio loaded and ready for playback/i);

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
      within(dialog).getByRole('button', { name: /export audio/i }),
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

  it('includes pitch shifting in audio exports', async () => {
    exportExplorerAudioTransformMock.mockResolvedValue({
      taskId: 'audio-transform-4',
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

    await screen.findByText(/audio loaded and ready for playback/i);
    fireEvent.change(screen.getByLabelText(/pitch shift cents/i), {
      target: { value: '250' },
    });
    fireEvent.click(screen.getByRole('button', { name: /export clip/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: /export audio/i }),
    );

    await waitFor(() => {
      expect(exportExplorerAudioTransformMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inputPath: '/tmp/anthem.mp3',
          pitchShiftCents: 250,
          mode: 'exportClip',
        }),
      );
    });
  });

  it('supports audio workbench transport and export hotkeys', async () => {
    render(
      <ExplorerAudioWorkbench
        audioPath='/tmp/anthem.mp3'
        audioName='anthem.mp3'
        audioExtension='mp3'
        audioSize={6 * 1024 * 1024}
      />,
    );

    await screen.findByText(/audio loaded and ready for playback/i);

    fireEvent.keyDown(window, { key: ' ' });
    await waitFor(() => {
      expect(playAudioDeckMock).toHaveBeenCalledWith('a');
    });

    fireEvent.keyDown(window, { key: 'S', ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
