import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerAudioWorkbench } from "../components/ExplorerAudioWorkbench";

const {
  analyzeExplorerAudioPreviewMock,
  createExplorerAudioPreviewProxyMock,
  exportExplorerAudioTransformMock,
  resolveExplorerAudioPreviewSourceMock,
} = vi.hoisted(() => ({
  analyzeExplorerAudioPreviewMock: vi.fn(),
  createExplorerAudioPreviewProxyMock: vi.fn(),
  exportExplorerAudioTransformMock: vi.fn(),
  resolveExplorerAudioPreviewSourceMock: vi.fn(),
}));

vi.mock("../runtime/audioWorkbenchBackend", () => ({
  analyzeExplorerAudioPreview: analyzeExplorerAudioPreviewMock,
  createExplorerAudioPreviewProxy: createExplorerAudioPreviewProxyMock,
  exportExplorerAudioTransform: exportExplorerAudioTransformMock,
  resolveExplorerAudioPreviewSource: resolveExplorerAudioPreviewSourceMock,
}));

describe("ExplorerAudioWorkbench", () => {
  beforeEach(() => {
    analyzeExplorerAudioPreviewMock.mockReset();
    createExplorerAudioPreviewProxyMock.mockReset();
    exportExplorerAudioTransformMock.mockReset();
    resolveExplorerAudioPreviewSourceMock.mockReset();

    resolveExplorerAudioPreviewSourceMock.mockResolvedValue({
      taskId: null,
      sourcePath: "/tmp/anthem.mp3",
      sourceKind: "direct",
      mimeType: "audio/mpeg",
      generatedFromPath: null,
    });
    analyzeExplorerAudioPreviewMock.mockResolvedValue({
      inputPath: "/tmp/anthem.mp3",
      durationSeconds: 24,
      sampleRateHz: 44100,
      channels: 2,
      encoding: "MPEG audio",
      bitsPerSample: 16,
      containerType: "mp3",
      peakLevel: 0.82,
      rmsLevel: 0.45,
      loudnessDb: -6.9,
      headroomDb: 1.7,
      waveformBuckets: Array.from({ length: 24 }, (_, index) => ({
        index,
        peakLevel: 0.25 + index * 0.01,
        rmsLevel: 0.12 + index * 0.004,
      })),
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders native analysis cards for the selected audio file", async () => {
    render(
      <ExplorerAudioWorkbench
        audioPath="/tmp/anthem.mp3"
        audioName="anthem.mp3"
        audioSource="asset://localhost/tmp/anthem.mp3"
        audioExtension="mp3"
        audioMimeType="audio/mpeg"
        audioSize={6 * 1024 * 1024}
      />,
    );

    expect(
      await screen.findByText(
        /ready to scrub, trim, normalize, convert, and export/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/44,100 Hz/i)).toBeInTheDocument();
    expect(screen.getAllByText("0:24").length).toBeGreaterThan(0);
    expect(screen.getByText("MPEG audio · 16-bit")).toBeInTheDocument();
  });

  it("falls back to a SoX proxy when direct playback fails", async () => {
    createExplorerAudioPreviewProxyMock.mockResolvedValue({
      taskId: null,
      sourcePath: "/tmp/anthem.preview.wav",
      sourceKind: "proxy",
      mimeType: "audio/wav",
      generatedFromPath: "/tmp/anthem.mp3",
    });

    render(
      <ExplorerAudioWorkbench
        audioPath="/tmp/anthem.mp3"
        audioName="anthem.mp3"
        audioSource="asset://localhost/tmp/anthem.mp3"
        audioExtension="mp3"
        audioMimeType="audio/mpeg"
        audioSize={6 * 1024 * 1024}
      />,
    );

    const player = await screen.findByLabelText(
      /audio preview player for anthem\.mp3/i,
    );
    fireEvent.error(player);

    await waitFor(() => {
      expect(createExplorerAudioPreviewProxyMock).toHaveBeenCalledWith(
        "/tmp/anthem.mp3",
      );
    });
    expect(await screen.findByText(/proxy playback/i)).toBeInTheDocument();
  });

  it("keeps overwrite-original behind an explicit confirmation dialog", async () => {
    exportExplorerAudioTransformMock.mockResolvedValue({
      taskId: "audio-transform-1",
      outputPath: "/tmp/anthem.mp3",
      spectrogramPath: null,
      durationSeconds: 24,
      outputFormat: "mp3",
      overwrittenOriginal: true,
      soxBinary: "/tmp/sox",
    });

    render(
      <ExplorerAudioWorkbench
        audioPath="/tmp/anthem.mp3"
        audioName="anthem.mp3"
        audioSource="asset://localhost/tmp/anthem.mp3"
        audioExtension="mp3"
        audioMimeType="audio/mpeg"
        audioSize={6 * 1024 * 1024}
      />,
    );

    await screen.findByText(
      /ready to scrub, trim, normalize, convert, and export/i,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /overwrite original/i }),
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^overwrite original$/i }),
    );

    await waitFor(() => {
      expect(exportExplorerAudioTransformMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inputPath: "/tmp/anthem.mp3",
          outputPath: "/tmp/anthem.mp3",
          mode: "overwriteOriginal",
        }),
      );
    });
  });

  it("defaults non-destructive exports to wav even for mp3 sources", async () => {
    exportExplorerAudioTransformMock.mockResolvedValue({
      taskId: "audio-transform-2",
      outputPath: "/tmp/anthem.clip.wav",
      spectrogramPath: null,
      durationSeconds: 24,
      outputFormat: "wav",
      overwrittenOriginal: false,
      soxBinary: "/tmp/sox",
    });

    render(
      <ExplorerAudioWorkbench
        audioPath="/tmp/anthem.mp3"
        audioName="anthem.mp3"
        audioSource="asset://localhost/tmp/anthem.mp3"
        audioExtension="mp3"
        audioMimeType="audio/mpeg"
        audioSize={6 * 1024 * 1024}
      />,
    );

    await screen.findByText(
      /ready to scrub, trim, normalize, convert, and export/i,
    );
    fireEvent.click(screen.getByRole("button", { name: /export clip/i }));

    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByDisplayValue("/tmp/anthem.clip.wav");
    fireEvent.change(input, { target: { value: "/tmp/anthem.clip.wav" } });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /run sox export/i }),
    );

    await waitFor(() => {
      expect(exportExplorerAudioTransformMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inputPath: "/tmp/anthem.mp3",
          outputPath: "/tmp/anthem.clip.wav",
          outputFormat: "wav",
          mode: "exportClip",
        }),
      );
    });
  });
});
