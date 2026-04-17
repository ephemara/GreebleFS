import re

with open('src/components/ExplorerAudioWorkbench.tsx', 'r') as f:
    content = f.read()

# We want to replace the UI components and styles defined before ExplorerAudioWorkbench.
# Find where toolbarButtonStyle starts
start_styles = content.find("function toolbarButtonStyle(")
# Find where AudioWorkbenchWaveformBars starts
start_waveform = content.find("type AudioWorkbenchWaveformBarsProps = {")
# Find where ExplorerAudioWorkbench starts
start_component = content.find("export function ExplorerAudioWorkbench({")

# Extract everything up to start_styles
part1 = content[:start_styles]

# Define new styles and subcomponents
new_styles_and_subcomponents = """
function toolbarButtonStyle(emphasis: 'default' | 'primary' | 'danger' | 'ghost' = 'default'): CSSProperties {
  const base = {
    appearance: 'none' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid transparent',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
  };

  if (emphasis === 'primary') return { ...base, background: '#2563eb', color: '#fff' };
  if (emphasis === 'danger') return { ...base, background: '#dc2626', color: '#fff' };
  if (emphasis === 'ghost') return { ...base, background: 'transparent', color: 'rgba(255,255,255,0.7)' };
  return { ...base, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' };
}

type AudioWorkbenchPlayheadMarkerHandle = {
  setPreviewSeconds: (seconds: number) => void;
  clearPreview: () => void;
};

type AudioWorkbenchPlayheadMarkerProps = {
  currentTimeSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
};

type AudioWorkbenchWaveformBarsProps = {
  waveformBuckets: ExplorerAudioPreviewAnalysis['waveformBuckets'];
  isAnalyzing: boolean;
};

type AudioWorkbenchSpectralBarsProps = {
  spectralBands: number[];
};

const AudioWorkbenchWaveformBars = memo(function AudioWorkbenchWaveformBars({
  waveformBuckets,
  isAnalyzing,
}: AudioWorkbenchWaveformBarsProps) {
  if (waveformBuckets.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{isAnalyzing ? 'Analyzing...' : 'Waveform unavailable'}</div>;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', height: '100%', gap: 0 }}>
      {waveformBuckets.map((bucket) => (
        <div
          key={bucket.index}
          style={{
            flex: 1,
            height: `${Math.max(2, bucket.peakLevel * 100)}%`,
            background: bucket.rmsLevel > 0.05 ? '#60a5fa' : '#3b82f6',
            opacity: bucket.rmsLevel > 0.05 ? 1 : 0.6,
            minWidth: 1,
          }}
        />
      ))}
    </div>
  );
});

const AudioWorkbenchSpectralBars = memo(function AudioWorkbenchSpectralBars({
  spectralBands,
}: AudioWorkbenchSpectralBarsProps) {
  if (spectralBands.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%', width: '100%', opacity: 0.7 }}>
      {spectralBands.map((band, index) => (
        <div
          key={`${index}-${band}`}
          style={{
            flex: 1,
            height: `${Math.max(4, band * 100)}%`,
            background: '#eab308',
            minWidth: 1,
          }}
        />
      ))}
    </div>
  );
});

const AudioWorkbenchPlayheadMarker = memo(
  forwardRef<AudioWorkbenchPlayheadMarkerHandle, AudioWorkbenchPlayheadMarkerProps>(
    function AudioWorkbenchPlayheadMarker(
      { currentTimeSeconds, durationSeconds, isPlaying, playbackRate },
      ref,
    ) {
      const playheadRef = useRef<HTMLDivElement | null>(null);
      const previewSecondsRef = useRef<number | null>(null);
      const playbackBaseSecondsRef = useRef(currentTimeSeconds);
      const playbackBaseTimestampRef = useRef(0);
      const playbackFrameRef = useRef<number | null>(null);

      function paint(seconds: number) {
        const node = playheadRef.current;
        if (!node || durationSeconds <= 0) return;
        const bounded = clamp(seconds, 0, durationSeconds);
        node.style.transform = `translate3d(${(bounded / durationSeconds) * 100}%, 0, 0)`;
      }

      useImperativeHandle(
        ref,
        () => ({
          setPreviewSeconds(seconds: number) {
            if (durationSeconds <= 0) return;
            const bounded = clamp(seconds, 0, durationSeconds);
            previewSecondsRef.current = bounded;
            paint(bounded);
          },
          clearPreview() {
            previewSecondsRef.current = null;
            paint(currentTimeSeconds);
          },
        }),
        [currentTimeSeconds, durationSeconds],
      );

      useLayoutEffect(() => {
        const bounded = clamp(currentTimeSeconds, 0, durationSeconds);
        playbackBaseSecondsRef.current = bounded;
        playbackBaseTimestampRef.current = performance.now();
        const previewSeconds = previewSecondsRef.current;
        if (previewSeconds == null) {
          paint(bounded);
        } else if (Math.abs(previewSeconds - bounded) < 0.02) {
          previewSecondsRef.current = null;
          paint(bounded);
        } else {
          paint(previewSeconds);
        }
      }, [currentTimeSeconds, durationSeconds]);

      useEffect(() => {
        if (!isPlaying || durationSeconds <= 0) {
          paint(previewSecondsRef.current ?? playbackBaseSecondsRef.current);
          return undefined;
        }

        const tick = (now: number) => {
          const previewSeconds = previewSecondsRef.current;
          const nextSeconds =
            previewSeconds != null
              ? previewSeconds
              : clamp(
                  playbackBaseSecondsRef.current +
                    ((now - playbackBaseTimestampRef.current) / 1000) * playbackRate,
                  0,
                  durationSeconds,
                );
          paint(nextSeconds);
          playbackFrameRef.current = window.requestAnimationFrame(tick);
        };

        playbackFrameRef.current = window.requestAnimationFrame(tick);
        return () => {
          if (playbackFrameRef.current != null) {
            window.cancelAnimationFrame(playbackFrameRef.current);
            playbackFrameRef.current = null;
          }
        };
      }, [durationSeconds, isPlaying, playbackRate]);

      return (
        <div
          ref={playheadRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            pointerEvents: 'none',
            transform: 'translate3d(0%, 0, 0)',
            willChange: 'transform',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 1,
              height: '100%',
              background: '#ef4444',
            }}
          />
        </div>
      );
    },
  ),
);

"""

# Find return statement of ExplorerAudioWorkbench
start_return = content.find("  return (", start_component)
# Find the end of the file or just the end of the component return
end_of_component = content.find("export function isAudioPreviewExtension", start_return) # wait, it's end of file

# Extract the logic inside the component before the return
logic_part = content[start_component:start_return]

new_return_statement = """  return (
    <>
      <style>{`
        .pro-slider { -webkit-appearance: none; width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; }
        .pro-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 8px; height: 12px; border-radius: 2px; background: #ccc; cursor: pointer; }
        .pro-slider::-webkit-slider-thumb:hover { background: #fff; }
        .pro-input { appearance: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 11px; width: 100%; }
        .pro-input:focus { outline: none; border-color: rgba(255,255,255,0.3); }
        .pro-select { appearance: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 11px; width: 100%; cursor: pointer; }
        .pro-panel { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
        .pro-panel-header { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; }
        .pro-label { font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: block; }
        .pro-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .pro-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .pro-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .pro-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
      <div
        ref={rootRef}
        tabIndex={-1}
        className="pro-scrollbar"
        style={{
          width: '100%',
          height: '100%',
          background: '#0e0e0e',
          color: '#fff',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121212', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 6, borderRadius: 4 }}>
              <AudioLines size={16} color="#aaa" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{audioName}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                {audioExtension.toUpperCase()} • {formatSize(audioSize)} • {formatDuration(analysis?.durationSeconds ?? effectiveDuration)} • {analysis?.sampleRateHz ? `${analysis.sampleRateHz} Hz` : 'Unknown Hz'} • {formatBpm(estimatedBpm)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={toolbarButtonStyle('ghost')} onClick={() => void handleStopPlayback()}>
              Stop
            </button>
            <button type="button" style={toolbarButtonStyle('primary')} onClick={() => void togglePreviewDeckPlayback()}>
              {previewDeck.isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {previewDeck.isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              ref={timelineRef}
              role="presentation"
              onMouseDown={(event) => beginTimelineDrag('playhead', event.clientX)}
              style={{
                position: 'relative',
                height: 120,
                borderRadius: 4,
                background: '#000',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'stretch',
                overflow: 'hidden'
              }}
            >
              <AudioWorkbenchWaveformBars waveformBuckets={waveformBuckets} isAnalyzing={isAnalyzing} />
              
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: selectionLeft,
                  width: selectionWidth,
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderLeft: '1px solid rgba(59, 130, 246, 0.5)',
                  borderRight: '1px solid rgba(59, 130, 246, 0.5)',
                  pointerEvents: 'none',
                }}
              />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: selectionLeft, width: fadeInWidth, background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: fadeOutHandleLeft, width: fadeOutWidth, background: 'linear-gradient(270deg, rgba(255,255,255,0.1), transparent)', pointerEvents: 'none' }} />

              <div
                role="presentation"
                onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('selectionStart', event.clientX); }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: selectionLeft, width: 10, marginLeft: -5, cursor: 'ew-resize', display: 'flex', justifyContent: 'center' }}
              >
                <div style={{ width: 2, height: '100%', background: '#3b82f6' }} />
              </div>
              <div
                role="presentation"
                onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('selectionEnd', event.clientX); }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${selectionLeft} + ${selectionWidth})`, width: 10, marginLeft: -5, cursor: 'ew-resize', display: 'flex', justifyContent: 'center' }}
              >
                <div style={{ width: 2, height: '100%', background: '#3b82f6' }} />
              </div>
              
              <div
                role="slider"
                tabIndex={0}
                aria-label={`Fade in handle for ${audioName}`}
                aria-valuemin={0}
                aria-valuemax={selectionDuration}
                aria-valuenow={boundedFadeInSeconds}
                aria-valuetext={formatFadeDuration(boundedFadeInSeconds)}
                onKeyDown={(event) => handleFadeHandleKeyDown('fadeIn', event)}
                onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('fadeIn', event.clientX); }}
                style={{ position: 'absolute', top: 0, width: 10, height: 10, left: fadeInHandleLeft, transform: 'translateX(-50%)', cursor: 'ew-resize', zIndex: 4 }}
              >
                <div style={{ width: 0, height: 0, borderTop: '10px solid #cbd5e1', borderRight: '10px solid transparent' }} />
              </div>
              <div
                role="slider"
                tabIndex={0}
                aria-label={`Fade out handle for ${audioName}`}
                aria-valuemin={0}
                aria-valuemax={selectionDuration}
                aria-valuenow={boundedFadeOutSeconds}
                aria-valuetext={formatFadeDuration(boundedFadeOutSeconds)}
                onKeyDown={(event) => handleFadeHandleKeyDown('fadeOut', event)}
                onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('fadeOut', event.clientX); }}
                style={{ position: 'absolute', top: 0, width: 10, height: 10, left: fadeOutHandleLeft, transform: 'translateX(-50%)', cursor: 'ew-resize', zIndex: 4 }}
              >
                <div style={{ width: 0, height: 0, borderTop: '10px solid #cbd5e1', borderLeft: '10px solid transparent' }} />
              </div>

              <AudioWorkbenchPlayheadMarker
                ref={playheadMarkerRef}
                currentTimeSeconds={previewDeck.currentTimeSeconds}
                durationSeconds={effectiveDuration}
                isPlaying={previewDeck.isPlaying}
                playbackRate={previewDeck.rate}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
              <div>In: {formatPreciseSeconds(selectionStart)}s | Out: {formatPreciseSeconds(selectionEnd)}s | Len: {formatPreciseSeconds(selectionDuration)}s</div>
              <div>Fade In: {formatFadeDuration(boundedFadeInSeconds)} | Fade Out: {formatFadeDuration(boundedFadeOutSeconds)}</div>
            </div>
          </div>

          {(spectralBands.length > 0 || spectrogramSource) && (
            <div style={{ display: 'flex', gap: 12, marginTop: -12, height: 48 }}>
              {spectralBands.length > 0 && (
                <div style={{ flex: 1, background: '#000', borderRadius: 4, overflow: 'hidden' }}>
                  <AudioWorkbenchSpectralBars spectralBands={spectralBands} />
                </div>
              )}
              {spectrogramSource && (
                <div style={{ flex: 1, borderRadius: 4, overflow: 'hidden' }}>
                  <img src={spectrogramSource} alt="Spectrogram" style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="pro-panel">
              <div className="pro-panel-header">Deck Controls</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="pro-label">Gain ({previewDeck.gainLinear.toFixed(2)}x)</label>
                  <input type="range" className="pro-slider" min="0" max="2" step="0.01" value={previewDeck.gainLinear} onChange={(event) => void handleGainChange(Number(event.target.value))} />
                </div>
                <div>
                  <label className="pro-label">Rate ({previewDeck.rate.toFixed(2)}x)</label>
                  <input type="range" className="pro-slider" min="0.5" max="2" step="0.01" value={previewDeck.rate} onChange={(event) => void handleRateChange(Number(event.target.value))} />
                </div>
              </div>
              <div>
                <label className="pro-label">Pitch Shift ({formatPitchShift(pitchShiftCents)})</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="range" className="pro-slider" min="-1200" max="1200" step="1" value={pitchShiftCents} onChange={(event) => setPitchShiftCents(Number(event.target.value))} />
                  <input type="number" className="pro-input" style={{ width: 70 }} min="-1200" max="1200" value={Math.round(pitchShiftCents)} onChange={(event) => { const nextValue = Number(event.target.value); if (Number.isFinite(nextValue)) setPitchShiftCents(clamp(nextValue, -1200, 1200)); }} />
                </div>
              </div>
            </div>

            <div className="pro-panel">
              <div className="pro-panel-header">Precision Trim</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="pro-label">In</label>
                  <input type="number" className="pro-input" step="0.001" min="0" value={formatPreciseSeconds(selectionStart)} onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v)) updateSelectionStartFromInput(v); }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="pro-label">Out</label>
                  <input type="number" className="pro-input" step="0.001" min="0" value={formatPreciseSeconds(selectionEnd)} onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v)) updateSelectionEndFromInput(v); }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="pro-label">Length</label>
                  <input type="number" className="pro-input" step="0.001" min={MINIMUM_SELECTION_SECONDS.toString()} value={formatPreciseSeconds(selectionDuration)} onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v)) updateSelectionDurationFromInput(v); }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" style={toolbarButtonStyle()} onClick={() => nudgeSelectionBoundary('start', -FINE_TRIM_NUDGE_SECONDS)}>-10ms In</button>
                <button type="button" style={toolbarButtonStyle()} onClick={() => nudgeSelectionBoundary('start', FINE_TRIM_NUDGE_SECONDS)}>+10ms In</button>
                <button type="button" style={toolbarButtonStyle()} onClick={() => nudgeSelectionBoundary('end', -FINE_TRIM_NUDGE_SECONDS)}>-10ms Out</button>
                <button type="button" style={toolbarButtonStyle()} onClick={() => nudgeSelectionBoundary('end', FINE_TRIM_NUDGE_SECONDS)}>+10ms Out</button>
                <button type="button" style={toolbarButtonStyle()} onClick={trimLeadingSilence}>Trim Head</button>
                <button type="button" style={toolbarButtonStyle()} onClick={trimTrailingSilence}>Trim Tail</button>
                <button type="button" style={toolbarButtonStyle()} onClick={trimDetectedContent}>Trim Content</button>
                <button type="button" style={toolbarButtonStyle()} onClick={() => void clearLoopRegion()}>Clear</button>
              </div>
            </div>

            <div className="pro-panel">
              <div className="pro-panel-header">Transform & Export</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="pro-label">Convert Format</label>
                  <select className="pro-select" value={convertFormat} onChange={(event) => setConvertFormat(event.target.value as 'mp3' | 'wav' | 'flac' | 'ogg')}>
                    {EXPLORER_AUDIO_EXPORT_FORMATS.map((format) => (
                      <option key={format.id} value={format.id}>{format.label}</option>
                    ))}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', paddingBottom: 4 }}>
                  <input type="checkbox" checked={generateSpectrogram} onChange={(event) => setGenerateSpectrogram(event.target.checked)} />
                  Spectrogram Preview
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('clip')}>Export Clip</button>
                <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('normalized')}>Export Normalized</button>
                <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('convert')}>Convert</button>
                <button type="button" style={toolbarButtonStyle('danger')} onClick={() => setExportDialogMode('overwrite')}>Overwrite Original</button>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'flex', gap: 16, flexWrap: 'wrap', paddingBottom: 20 }}>
            {workbenchError || snapshot.engineError ? (
              <span style={{ color: '#ef4444' }}>{workbenchError ?? previewDeck.error ?? snapshot.engineError}</span>
            ) : (
              <span>{workbenchStatus}</span>
            )}
            {exportMessage && <span>• {exportMessage}</span>}
            <span>• Peak: {formatDb(analysis?.peakLevel)} / RMS: {formatDb(analysis?.rmsLevel)}</span>
            <span>• Silence Regions: {silenceRegions.length}</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={toolbarButtonStyle('ghost')} onClick={() => jumpToAdjacentSilence('previous')}>Prev Silence</button>
              <button type="button" style={toolbarButtonStyle('ghost')} onClick={() => jumpToAdjacentSilence('next')}>Next Silence</button>
            </span>
          </div>

        </div>
      </div>

      <AppPromptDialog
        open={
          exportDialogMode === 'clip' ||
          exportDialogMode === 'normalized' ||
          exportDialogMode === 'convert'
        }
        title={
          exportDialogMode === 'clip'
            ? 'Export Audio Clip'
            : exportDialogMode === 'normalized'
              ? 'Export Normalized Audio'
              : 'Convert Audio Format'
        }
        description={
          exportDialogMode === 'convert'
            ? `SoX will write a ${convertFormat.toUpperCase()} export using the current trim, pitch, fade, and spectrogram settings.`
            : 'Choose the output path for the new audio export.'
        }
        value={exportPathInput}
        onChange={setExportPathInput}
        onCancel={() => setExportDialogMode(null)}
        onSubmit={() => {
          if (
            exportDialogMode === 'clip' ||
            exportDialogMode === 'normalized' ||
            exportDialogMode === 'convert'
          ) {
            void submitExport(exportDialogMode);
          }
        }}
        submitLabel='Run SoX Export'
      />

      <AppConfirmDialog
        open={exportDialogMode === 'overwrite'}
        title='Overwrite Original Audio'
        tone='danger'
        confirmLabel='Overwrite Original'
        description={`This will rewrite ${audioName} in place using the current trim, pitch, fade, normalize, and spectrogram settings.`}
        onCancel={() => setExportDialogMode(null)}
        onConfirm={() => {
          void submitOverwriteOriginal();
        }}
      >
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--overlay-text-muted)',
          }}
        >
          The default flow is non-destructive export. Use this only when you want the selected file replaced.
        </div>
      </AppConfirmDialog>
    </>
  );
}
"""

with open('src/components/ExplorerAudioWorkbench.tsx', 'w') as f:
    f.write(part1 + new_styles_and_subcomponents + logic_part + new_return_statement)
