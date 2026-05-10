import Editor from "@monaco-editor/react";
import { AlertTriangle, Cpu, Eye, Layers3, Loader2 } from "@/components/AppIcons";
import { AppSelect } from "./AppSelect";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  type OrbitCameraState,
  type ShaderWorkbenchScene as UpgradedScene,
  PREVIEW_UNIFORM_BYTES,
  buildHostVertexModule as buildUpgradedHostVertexModule,
  buildHostFragmentModule as buildUpgradedHostFragmentModule,
  buildTextureDisplayModule as buildUpgradedTextureDisplayModule,
  createPreviewUniformState as createUpgradedUniformState,
  writePreviewUniformBuffer as writeUpgradedUniformBuffer,
  meshForScene,
} from "./shaderWorkbenchUpgrades";
import { readExplorerEntryThumbnail } from "../runtime/explorerBackend";
import {
  compileExplorerShaderPreviewDocument,
  type ExplorerShaderPreviewCompileOutput,
  type ExplorerShaderPreviewDiagnostic,
  type ExplorerShaderPreviewEntryPoint,
  type ExplorerShaderPreviewFormat,
  type ExplorerShaderPreviewStage,
} from "../runtime/shaderPreviewBackend";
import {
  applyExplorerMonacoTheme,
  buildExplorerMonacoPreviewOptions,
  resolveExplorerMonacoThemeId,
} from "../config/explorerMonaco";
import type { ResolvedOverlayAppearance } from "../config/appearance";
import {
  getShaderPerformanceProfile,
  type ShaderPerformanceMode,
} from "../config/shaders";
import type { EditorSettings } from "../store/settingsStore";

type ExplorerDocumentViewMode = "preview" | "edit";
type ShaderWorkbenchScene = "sphere" | "fullscreen" | "torus" | "cube";

type ExplorerShaderWorkbenchProps = {
  path: string;
  name: string;
  format: ExplorerShaderPreviewFormat;
  editableSource: string | null;
  inspectionSource: string;
  isReadOnly: boolean;
  normalizedWgsl: string | null;
  diagnostics: ExplorerShaderPreviewDiagnostic[];
  entryPoints: ExplorerShaderPreviewEntryPoint[];
  selectedScene: ShaderWorkbenchScene;
  selectedStage: ExplorerShaderPreviewStage | null;
  selectedEntryPoint: string | null;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  viewMode: ExplorerDocumentViewMode;
  appearance?: ResolvedOverlayAppearance;
  editorSettings: EditorSettings;
  shaderPerformanceMode: ShaderPerformanceMode;
  onSourceChange: (path: string, value: string) => void;
  onSelectionChange: (
    path: string,
    selection: {
      selectedStage?: ExplorerShaderPreviewStage | null;
      selectedEntryPoint?: string | null;
    },
  ) => void;
  onCompileResult: (
    path: string,
    result: ExplorerShaderPreviewCompileOutput,
  ) => void;
  onRegisterCloseGuard?: (guard: (() => Promise<boolean>) | null) => void;
  onSceneChange?: (scene: ShaderWorkbenchScene) => void;
};

type ShaderPreviewCanvasStatus = {
  mode: "loading" | "ready" | "unavailable" | "error";
  message: string | null;
};

const shaderWorkbenchShellStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  width: "100%",
  height: "100%",
  minHeight: 0,
  background:
    "radial-gradient(circle at top, rgba(86, 120, 255, 0.16), transparent 36%), var(--overlay-explorer-preview-bg)",
};

const shaderToolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderBottom: "1px solid var(--overlay-explorer-preview-border)",
  background: "rgba(8, 10, 16, 0.62)",
  backdropFilter: "blur(14px)",
  flexWrap: "wrap",
};

const pickerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const pickerStyle: CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(10, 12, 18, 0.9)",
  color: "var(--overlay-fg, #eef2ff)",
  padding: "6px 10px",
  fontSize: 12,
  minWidth: 150,
};

const diagnosticsPanelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "14px 16px",
  borderLeft: "1px solid var(--overlay-explorer-preview-border)",
  background: "rgba(9, 11, 17, 0.88)",
  overflow: "auto",
};

const previewViewportShellStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 32%)",
  minHeight: 0,
  width: "100%",
  height: "100%",
};

const previewCanvasShellStyle: CSSProperties = {
  position: "relative",
  minHeight: 0,
  overflow: "hidden",
  background:
    "radial-gradient(circle at 18% 22%, rgba(50, 84, 170, 0.34), transparent 24%), radial-gradient(circle at 82% 18%, rgba(239, 120, 64, 0.16), transparent 18%), linear-gradient(180deg, rgba(12, 15, 24, 0.98), rgba(8, 11, 18, 1))",
};

const previewCanvasStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  cursor: "grab",
};

const canvasOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 12,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  pointerEvents: "none",
};

const statusPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 700,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(8, 12, 18, 0.78)",
  color: "rgba(232, 239, 255, 0.92)",
};

const readonlyCodeShellStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 0,
  overflow: "auto",
  padding: "16px 18px",
  fontFamily:
    '"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
  fontSize: 12,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  color: "var(--overlay-fg, #eef2ff)",
  background:
    "linear-gradient(180deg, rgba(10, 12, 18, 0.98), rgba(8, 10, 16, 1))",
};

function isNavigatorWithGpu(
  value: Navigator,
): value is Navigator & { gpu: GPU } {
  return "gpu" in value && value.gpu != null;
}

function getShaderStageOptions(
  entryPoints: ExplorerShaderPreviewEntryPoint[],
): ExplorerShaderPreviewStage[] {
  const seen = new Set<ExplorerShaderPreviewStage>();
  for (const entryPoint of entryPoints) {
    seen.add(entryPoint.stage);
  }
  return Array.from(seen);
}

function getEntryPointOptionsForStage(
  entryPoints: ExplorerShaderPreviewEntryPoint[],
  stage: ExplorerShaderPreviewStage | null,
) {
  return entryPoints.filter((entryPoint) =>
    stage ? entryPoint.stage === stage : true,
  );
}

function buildSelectionStateLabel(
  selectedStage: ExplorerShaderPreviewStage | null,
  selectedEntryPoint: string | null,
) {
  if (!selectedStage || !selectedEntryPoint) {
    return "Select a stage and entry point to compile this shader.";
  }
  return `${selectedStage} · ${selectedEntryPoint}`;
}

function buildFallbackPosterMessage(
  normalizedWgsl: string | null,
  selectedStage: ExplorerShaderPreviewStage | null,
  selectedEntryPoint: string | null,
) {
  if (!normalizedWgsl) {
    return "No normalized WGSL is available yet. Fix the compile diagnostics first.";
  }
  if (!selectedStage || !selectedEntryPoint) {
    return "Pick a stage and entry point to drive the preview host.";
  }
  return "Using cached shader poster while the live WebGPU preview host is unavailable.";
}



function ShaderDiagnosticsList({
  diagnostics,
  supportsLivePreview,
  normalizedWgsl,
  error,
  isDirty,
  isSaving,
}: {
  diagnostics: ExplorerShaderPreviewDiagnostic[];
  supportsLivePreview: boolean;
  normalizedWgsl: string | null;
  error: string | null;
  isDirty: boolean;
  isSaving: boolean;
}) {
  const cards = useMemo(() => {
    const output = diagnostics.map((diagnostic) => ({
      key: `${diagnostic.severity}:${diagnostic.message}:${diagnostic.lineNumber ?? "na"}`,
      title: diagnostic.severity.toUpperCase(),
      tone:
        diagnostic.severity === "error"
          ? "rgba(255, 106, 106, 0.92)"
          : diagnostic.severity === "warning"
            ? "rgba(255, 204, 87, 0.96)"
            : "rgba(143, 208, 255, 0.96)",
      body: diagnostic.message,
      meta:
        diagnostic.lineNumber != null
          ? `Line ${diagnostic.lineNumber}${diagnostic.columnNumber != null ? `:${diagnostic.columnNumber}` : ""}`
          : null,
    }));
    if (error) {
      output.unshift({
        key: `save:${error}`,
        title: "SAVE",
        tone: "rgba(255, 106, 106, 0.92)",
        body: error,
        meta: null,
      });
    }
    return output;
  }, [diagnostics, error]);

  return (
    <div style={diagnosticsPanelStyle}>
      <div style={{ display: "grid", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "rgba(237, 242, 255, 0.94)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <Layers3 size={15} />
          Shader Status
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.5, color: "rgba(186, 194, 211, 0.88)" }}>
          {supportsLivePreview
            ? "Live preview host is armed for the selected entry point."
            : "The workbench stays open even when the selected shader cannot render live yet."}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={statusPillStyle}>{normalizedWgsl ? "WGSL ready" : "WGSL unavailable"}</span>
          <span style={statusPillStyle}>
            {isSaving ? "Saving…" : isDirty ? "Unsaved edits" : "Saved"}
          </span>
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {cards.length > 0 ? (
          cards.map((card) => (
            <div
              key={card.key}
              style={{
                display: "grid",
                gap: 4,
                padding: "12px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ color: card.tone, fontSize: 11, fontWeight: 800 }}>
                  {card.title}
                </span>
                {card.meta ? (
                  <span style={{ color: "rgba(186, 194, 211, 0.72)", fontSize: 10 }}>
                    {card.meta}
                  </span>
                ) : null}
              </div>
              <div style={{ color: "rgba(226, 232, 244, 0.92)", fontSize: 12, lineHeight: 1.5 }}>
                {card.body}
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              padding: "12px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(186, 194, 211, 0.82)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            No diagnostics reported for the current shader build.
          </div>
        )}
      </div>
    </div>
  );
}

function ShaderPreviewCanvas({
  path,
  normalizedWgsl,
  selectedStage,
  selectedEntryPoint,
  selectedScene,
  shaderPerformanceMode,
}: {
  path: string;
  normalizedWgsl: string | null;
  selectedStage: ExplorerShaderPreviewStage | null;
  selectedEntryPoint: string | null;
  selectedScene: ShaderWorkbenchScene;
  shaderPerformanceMode: ShaderPerformanceMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<ShaderPreviewCanvasStatus>({
    mode: "loading",
    message: "Preparing shader preview host…",
  });
  const [fallbackPosterDataUrl, setFallbackPosterDataUrl] = useState<string | null>(
    null,
  );
  const previewProfile = getShaderPerformanceProfile(shaderPerformanceMode);

  useEffect(() => {
    let cancelled = false;
    setFallbackPosterDataUrl(null);
    void readExplorerEntryThumbnail({
      path,
      entityId: null,
      contentRevision: null,
      maxWidth: 640,
      maxHeight: 360,
      includeVideoHoverScrub: false,
      videoHoverFrameCount: 1,
    })
      .then((thumbnail) => {
        if (cancelled) {
          return;
        }
        setFallbackPosterDataUrl(thumbnail.posterDataUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [path]);

  const cameraRef = useRef<OrbitCameraState>({
    yaw: 0.6, pitch: 0.3, distance: 3.2, autoRotate: true,
    mouseX: 0, mouseY: 0, dragging: false,
  });
  const [fpsDisplay, setFpsDisplay] = useState("--");

  useEffect(() => {
    let cancelled = false;
    let frameHandle = 0;
    let lastTs = 0;
    let frameCount = 0;
    let fpsAccum = 0;
    let fpsFrames = 0;
    let resizeObs: ResizeObserver | null = null;
    const canvas = canvasRef.current;
    const cam = cameraRef.current;

    // Orbit camera pointer handlers
    const onDown = (e: PointerEvent) => { cam.dragging = true; cam.autoRotate = false; canvas?.setPointerCapture(e.pointerId); };
    const onUp = (e: PointerEvent) => { cam.dragging = false; canvas?.releasePointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (canvas) { cam.mouseX = e.offsetX / canvas.clientWidth; cam.mouseY = 1 - e.offsetY / canvas.clientHeight; }
      if (!cam.dragging) return;
      cam.yaw += e.movementX * 0.008;
      cam.pitch = Math.max(-1.4, Math.min(1.4, cam.pitch - e.movementY * 0.008));
    };
    const onWh = (e: WheelEvent) => { e.preventDefault(); cam.distance = Math.max(1.2, Math.min(12, cam.distance + e.deltaY * 0.005)); };
    canvas?.addEventListener("pointerdown", onDown);
    canvas?.addEventListener("pointerup", onUp);
    canvas?.addEventListener("pointermove", onMove);
    canvas?.addEventListener("wheel", onWh, { passive: false });

    async function run() {
      if (!canvas) return;
      if (!normalizedWgsl || !selectedStage || !selectedEntryPoint) {
        setStatus({ mode: "unavailable", message: buildFallbackPosterMessage(normalizedWgsl, selectedStage, selectedEntryPoint) });
        return;
      }
      if (!isNavigatorWithGpu(window.navigator)) {
        setStatus({ mode: "unavailable", message: "WebGPU is unavailable in this webview." });
        return;
      }
      setStatus({ mode: "loading", message: "Compiling shader preview pipeline…" });

      try {
        const adapter = await window.navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("No WebGPU adapter.");
        const device = await adapter.requestDevice();
        if (cancelled) { device.destroy(); return; }

        const pr = Math.max(1, Math.min(window.devicePixelRatio || 1, previewProfile.previewPixelRatioCap));
        let W = Math.max(1, Math.floor(canvas.clientWidth * pr));
        let H = Math.max(1, Math.floor(canvas.clientHeight * pr));
        canvas.width = W; canvas.height = H;

        const ctx = canvas.getContext("webgpu");
        if (!ctx) throw new Error("No WebGPU canvas context.");
        const fmt = window.navigator.gpu.getPreferredCanvasFormat();
        ctx.configure({ device, format: fmt, alphaMode: "premultiplied" });

        // MSAA + Depth
        const sc = 4;
        let msaaTex = device.createTexture({ size: { width: W, height: H }, format: fmt, sampleCount: sc, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        let depTex = device.createTexture({ size: { width: W, height: H }, format: "depth24plus", sampleCount: sc, usage: GPUTextureUsage.RENDER_ATTACHMENT });

        // ResizeObserver
        resizeObs = new ResizeObserver(() => {
          const nw = Math.max(1, Math.floor(canvas.clientWidth * pr));
          const nh = Math.max(1, Math.floor(canvas.clientHeight * pr));
          if (nw === W && nh === H) return;
          W = nw; H = nh; canvas.width = W; canvas.height = H;
          ctx.configure({ device, format: fmt, alphaMode: "premultiplied" });
          msaaTex.destroy(); depTex.destroy();
          msaaTex = device.createTexture({ size: { width: W, height: H }, format: fmt, sampleCount: sc, usage: GPUTextureUsage.RENDER_ATTACHMENT });
          depTex = device.createTexture({ size: { width: W, height: H }, format: "depth24plus", sampleCount: sc, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        });
        resizeObs.observe(canvas);

        // Mesh (use upgrades module)
        const mesh = meshForScene(selectedScene as UpgradedScene, previewProfile.previewSphereSegments, previewProfile.previewSphereRings);
        const vBuf = device.createBuffer({ size: mesh.vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, mappedAtCreation: true });
        new Float32Array(vBuf.getMappedRange()).set(mesh.vertices); vBuf.unmap();
        const iBuf = device.createBuffer({ size: mesh.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, mappedAtCreation: true });
        new Uint16Array(iBuf.getMappedRange()).set(mesh.indices); iBuf.unmap();

        // Uniform buffer (expanded)
        const uBuf = device.createBuffer({ size: PREVIEW_UNIFORM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

        // Shader modules (use upgraded host modules with N·L lighting)
        const hvMod = device.createShaderModule({ code: buildUpgradedHostVertexModule() });
        const hfMod = device.createShaderModule({ code: buildUpgradedHostFragmentModule() });
        const tdMod = device.createShaderModule({ code: buildUpgradedTextureDisplayModule() });
        const uMod = device.createShaderModule({ code: normalizedWgsl });

        let rPipe: GPURenderPipeline | null = null;
        let cPipe: GPUComputePipeline | null = null;
        let cBG: GPUBindGroup | null = null;
        let cTex: GPUTexture | null = null;
        let dBG: GPUBindGroup | null = null;

        const needsMesh = selectedScene !== "fullscreen" || selectedStage === "vertex";
        const depSt: GPUDepthStencilState = { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" };

        if (selectedStage === "compute") {
          cTex = device.createTexture({ size: { width: W, height: H }, format: "rgba8unorm", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
          const cBGL = device.createBindGroupLayout({ entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba8unorm", viewDimension: "2d" } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
          ]});
          cPipe = await device.createComputePipelineAsync({ layout: device.createPipelineLayout({ bindGroupLayouts: [cBGL] }), compute: { module: uMod, entryPoint: selectedEntryPoint } });
          cBG = device.createBindGroup({ layout: cBGL, entries: [{ binding: 0, resource: cTex.createView() }, { binding: 1, resource: { buffer: uBuf } }] });
          const tBGL = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }] });
          rPipe = await device.createRenderPipelineAsync({ layout: device.createPipelineLayout({ bindGroupLayouts: [tBGL] }), vertex: { module: tdMod, entryPoint: "greeblefs_texture_vertex" }, fragment: { module: tdMod, entryPoint: "greeblefs_texture_fragment", targets: [{ format: fmt }] }, primitive: { topology: "triangle-list" }, multisample: { count: sc } });
          dBG = device.createBindGroup({ layout: tBGL, entries: [{ binding: 0, resource: cTex.createView() }] });
        } else {
          const rBGL = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }] });
          rPipe = await device.createRenderPipelineAsync({
            layout: device.createPipelineLayout({ bindGroupLayouts: [rBGL] }),
            vertex: { module: selectedStage === "vertex" ? uMod : hvMod, entryPoint: selectedStage === "vertex" ? selectedEntryPoint : "greeblefs_preview_host_vertex", buffers: [{ arrayStride: 32, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }, { shaderLocation: 2, offset: 24, format: "float32x2" }] }] },
            fragment: { module: selectedStage === "fragment" ? uMod : hfMod, entryPoint: selectedStage === "fragment" ? selectedEntryPoint : "greeblefs_preview_host_fragment", targets: [{ format: fmt }] },
            primitive: { topology: "triangle-list", cullMode: needsMesh ? "back" : undefined },
            depthStencil: needsMesh ? depSt : undefined,
            multisample: { count: sc },
          });
          cBG = device.createBindGroup({ layout: rBGL, entries: [{ binding: 0, resource: { buffer: uBuf } }] });
        }

        const tgtMs = 1000 / Math.max(previewProfile.previewFrameRate, 1);
        setStatus({ mode: "ready", message: selectedStage === "compute" ? "Compute preview active." : "Live WebGPU preview is active." });

        const renderFrame = (ts: number) => {
          if (cancelled || !rPipe) return;
          if (lastTs > 0 && ts - lastTs < tgtMs) { frameHandle = requestAnimationFrame(renderFrame); return; }
          const dt = lastTs > 0 ? (ts - lastTs) / 1000 : 0.016;
          lastTs = ts; frameCount++;
          fpsAccum += dt; fpsFrames++;
          if (fpsAccum >= 0.5) { setFpsDisplay(`${Math.round(fpsFrames / fpsAccum)}`); fpsAccum = 0; fpsFrames = 0; }
          if (cam.autoRotate) cam.yaw += dt * 0.5;

          const us = createUpgradedUniformState(W, H, W / Math.max(H, 1), selectedScene as UpgradedScene, ts / 1000, dt, frameCount, cam);
          writeUpgradedUniformBuffer(device, uBuf, us, selectedScene as UpgradedScene);

          const enc = device.createCommandEncoder();
          if (cPipe && cBG && cTex) { const p = enc.beginComputePass(); p.setPipeline(cPipe); p.setBindGroup(0, cBG); p.dispatchWorkgroups(Math.ceil(W/8), Math.ceil(H/8)); p.end(); }

          const msV = msaaTex.createView();
          const rpDesc: GPURenderPassDescriptor = {
            colorAttachments: [{ view: msV, resolveTarget: ctx.getCurrentTexture().createView(), clearValue: { r: 0.04, g: 0.05, b: 0.08, a: 1 }, loadOp: "clear", storeOp: "store" }],
            ...(needsMesh && selectedStage !== "compute" ? { depthStencilAttachment: { view: depTex.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" } } : {}),
          };
          const rp = enc.beginRenderPass(rpDesc);
          rp.setPipeline(rPipe);
          if (selectedStage === "compute") { if (dBG) rp.setBindGroup(0, dBG); rp.draw(6); }
          else { if (cBG) rp.setBindGroup(0, cBG); rp.setVertexBuffer(0, vBuf); rp.setIndexBuffer(iBuf, "uint16"); rp.drawIndexed(mesh.indices.length); }
          rp.end();
          device.queue.submit([enc.finish()]);
          frameHandle = requestAnimationFrame(renderFrame);
        };
        frameHandle = requestAnimationFrame(renderFrame);
      } catch (e) {
        if (!cancelled) setStatus({ mode: "error", message: String(e) });
      }
    }
    void run();
    return () => {
      cancelled = true;
      if (frameHandle) cancelAnimationFrame(frameHandle);
      resizeObs?.disconnect();
      canvas?.removeEventListener("pointerdown", onDown);
      canvas?.removeEventListener("pointerup", onUp);
      canvas?.removeEventListener("pointermove", onMove);
      canvas?.removeEventListener("wheel", onWh);
    };
  }, [normalizedWgsl, selectedEntryPoint, selectedScene, selectedStage, shaderPerformanceMode]);

  return (
    <div style={previewCanvasShellStyle}>
      {status.mode === "ready" ? null : fallbackPosterDataUrl ? (
        <img
          src={fallbackPosterDataUrl}
          alt={`${path} preview poster`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.72,
            filter: "saturate(0.92) brightness(0.9)",
          }}
        />
      ) : null}
      <canvas ref={canvasRef} style={previewCanvasStyle} />
      <div style={canvasOverlayStyle}>
        <span style={statusPillStyle}>
          <Eye size={13} />
          {status.mode === "ready"
            ? "Live preview"
            : status.mode === "loading"
              ? "Building"
              : status.mode === "unavailable"
                ? "Fallback"
                : "Preview error"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {status.mode === "ready" ? (
            <span style={statusPillStyle}>{fpsDisplay} FPS</span>
          ) : null}
          <span style={statusPillStyle}>
            <Cpu size={13} />
            {selectedStage ?? "no-stage"}
          </span>
        </div>
      </div>
      {status.mode === "ready" ? null : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 24,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              display: "grid",
              gap: 10,
              padding: "16px 18px",
              borderRadius: 18,
              background: "rgba(7, 10, 15, 0.82)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(233, 240, 255, 0.94)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {status.mode === "loading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <AlertTriangle size={16} />
              )}
              {status.mode === "loading"
                ? "Preparing preview"
                : status.mode === "unavailable"
                  ? "Preview fallback"
                  : "WebGPU preview error"}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              {status.message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExplorerShaderWorkbench({
  path,
  name,
  format,
  editableSource,
  inspectionSource,
  isReadOnly,
  normalizedWgsl,
  diagnostics,
  entryPoints,
  selectedScene,
  selectedStage,
  selectedEntryPoint,
  isDirty,
  isSaving,
  error,
  viewMode,
  appearance,
  editorSettings,
  shaderPerformanceMode,
  onSourceChange,
  onSelectionChange,
  onCompileResult,
  onRegisterCloseGuard,
  onSceneChange,
}: ExplorerShaderWorkbenchProps) {
  const compileRequestIdRef = useRef(0);
  const monacoRef = useRef<any>(null);
  const monacoThemeId = resolveExplorerMonacoThemeId(appearance);

  const stageOptions = useMemo(
    () => getShaderStageOptions(entryPoints),
    [entryPoints],
  );
  const entryPointOptions = useMemo(
    () => getEntryPointOptionsForStage(entryPoints, selectedStage),
    [entryPoints, selectedStage],
  );

  useEffect(() => {
    if (!onRegisterCloseGuard) {
      return;
    }
    if (isReadOnly || !isDirty) {
      onRegisterCloseGuard(null);
      return;
    }
    onRegisterCloseGuard(async () =>
      window.confirm(
        `Discard unsaved shader edits for ${name}?`,
      ),
    );
    return () => {
      onRegisterCloseGuard(null);
    };
  }, [isDirty, isReadOnly, name, onRegisterCloseGuard]);

  useEffect(() => {
    if (!monacoRef.current) {
      return;
    }
    applyExplorerMonacoTheme(monacoRef.current, appearance);
  }, [appearance]);

  useEffect(() => {
    if (format === "spv" && !selectedStage && entryPoints.length === 1) {
      const onlyEntryPoint = entryPoints[0];
      onSelectionChange(path, {
        selectedStage: onlyEntryPoint.stage,
        selectedEntryPoint: onlyEntryPoint.name,
      });
    }
  }, [entryPoints, format, onSelectionChange, path, selectedStage]);

  useEffect(() => {
    const nextRequestId = compileRequestIdRef.current + 1;
    compileRequestIdRef.current = nextRequestId;
    const timeoutId = window.setTimeout(() => {
      void compileExplorerShaderPreviewDocument({
        path,
        format,
        sourceText: editableSource,
        selectedStage,
        selectedEntryPoint,
      })
        .then((result) => {
          if (compileRequestIdRef.current !== nextRequestId) {
            return;
          }
          onCompileResult(path, result);
        })
        .catch(() => {});
    }, editableSource != null ? 220 : 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    editableSource,
    format,
    onCompileResult,
    path,
    selectedEntryPoint,
    selectedStage,
  ]);

  return (
    <div style={shaderWorkbenchShellStyle}>
      <div style={shaderToolbarStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "rgba(238, 244, 255, 0.96)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <Layers3 size={15} />
            Shader Workbench
          </div>
          <div style={{ color: "rgba(183, 191, 208, 0.84)", fontSize: 11 }}>
            {buildSelectionStateLabel(selectedStage, selectedEntryPoint)}
          </div>
        </div>
        <div style={pickerRowStyle}>
          <AppSelect
            aria-label="Shader stage"
            value={selectedStage ?? ""}
            onChange={(event) => {
              const nextStage = (event.currentTarget.value || null) as
                | ExplorerShaderPreviewStage
                | null;
              const nextEntryPoint =
                getEntryPointOptionsForStage(entryPoints, nextStage)[0]?.name ?? null;
              onSelectionChange(path, {
                selectedStage: nextStage,
                selectedEntryPoint: nextEntryPoint,
              });
            }}
            style={pickerStyle}
          >
            <option value="">Select stage</option>
            {stageOptions.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </AppSelect>
          <AppSelect
            aria-label="Shader entry point"
            value={selectedEntryPoint ?? ""}
            onChange={(event) =>
              onSelectionChange(path, {
                selectedEntryPoint: event.currentTarget.value || null,
              })
            }
            style={pickerStyle}
          >
            <option value="">Select entry point</option>
            {entryPointOptions.map((entryPoint) => (
              <option key={`${entryPoint.stage}:${entryPoint.name}`} value={entryPoint.name}>
                {entryPoint.name}
              </option>
            ))}
          </AppSelect>
          <span style={statusPillStyle}>
            {format.toUpperCase()}
            {isReadOnly ? " · Read only" : ""}
          </span>
          {onSceneChange ? (
            <AppSelect
              aria-label="Preview scene"
              value={selectedScene}
              onChange={(e) => onSceneChange(e.currentTarget.value as ShaderWorkbenchScene)}
              style={pickerStyle}
            >
              <option value="sphere">Sphere</option>
              <option value="torus">Torus</option>
              <option value="cube">Cube</option>
              <option value="fullscreen">Fullscreen</option>
            </AppSelect>
          ) : null}
        </div>
      </div>

      {viewMode === "edit" ? (
        editableSource != null ? (
          <Editor
            path={path}
            height="100%"
            theme={monacoThemeId}
            language={format === "wgsl" ? "wgsl" : format === "hlsl" ? "hlsl" : "plaintext"}
            value={editableSource}
            beforeMount={(monaco) => {
              applyExplorerMonacoTheme(monaco, appearance);
            }}
            onMount={(_editor, monaco) => {
              monacoRef.current = monaco;
              applyExplorerMonacoTheme(monaco, appearance);
            }}
            onChange={(value) => onSourceChange(path, value ?? "")}
            saveViewState
            options={buildExplorerMonacoPreviewOptions({
              editorSettings,
              lineCount: editableSource.split(/\r?\n/).length,
              readOnly: false,
              allowFolding: true,
              topPadding: 10,
            })}
          />
        ) : (
          <pre style={readonlyCodeShellStyle}>{inspectionSource}</pre>
        )
      ) : (
        <div style={previewViewportShellStyle}>
          <ShaderPreviewCanvas
            path={path}
            normalizedWgsl={normalizedWgsl}
            selectedStage={selectedStage}
            selectedEntryPoint={selectedEntryPoint}
            selectedScene={selectedScene}
            shaderPerformanceMode={shaderPerformanceMode}
          />
          <ShaderDiagnosticsList
            diagnostics={diagnostics}
            supportsLivePreview={
              Boolean(normalizedWgsl && selectedStage && selectedEntryPoint)
            }
            normalizedWgsl={normalizedWgsl}
            error={error}
            isDirty={isDirty}
            isSaving={isSaving}
          />
        </div>
      )}
    </div>
  );
}
