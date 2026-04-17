# GPU Runtime Bundle

This crate stages the bevydcc code most relevant to a high-FPS GreebleFS preview and rendering lane.

Primary value:

- reusable GPU buffers and staging paths instead of per-frame allocation churn
- render-service patterns that keep preview work off the UI thread
- render-graph examples for structured offscreen preview passes
- device and portability boundaries for native `wgpu` plus browser-style WebGPU paths

Use this lane when lifting:

- thumbnail and preview texture upload logic
- waveform, spectrogram, image, video, or model preview pipelines
- dirty-tracked redraw scheduling for heavy preview surfaces

The copied upstream files live under `upstream/` with original relative paths preserved.
