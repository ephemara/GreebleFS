import Editor from "@monaco-editor/react";
import { AlertTriangle, Cpu, Eye, Layers3, Loader2 } from "@/components/AppIcons";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
type ShaderWorkbenchScene = "sphere" | "fullscreen";

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
};

type ShaderPreviewCanvasStatus = {
  mode: "loading" | "ready" | "unavailable" | "error";
  message: string | null;
};

type PreviewUniformState = {
  timeSeconds: number;
  aspect: number;
  mvp: Float32Array;
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

function buildHostVertexModule() {
  return `
struct PreviewUniforms {
  timeSeconds: f32,
  aspect: f32,
  sceneMode: f32,
  padding0: f32,
  modelViewProjection: mat4x4<f32>,
};

@group(0) @binding(0)
var<uniform> previewUniforms: PreviewUniforms;

struct PreviewVertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
};

struct PreviewVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) normal: vec3<f32>,
};

@vertex
fn greeblefs_preview_host_vertex(input: PreviewVertexInput) -> PreviewVertexOutput {
  var output: PreviewVertexOutput;
  output.position = previewUniforms.modelViewProjection * vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  output.normal = input.normal;
  return output;
}
`;
}

function buildHostFragmentModule() {
  return `
@fragment
fn greeblefs_preview_host_fragment() -> @location(0) vec4<f32> {
  return vec4<f32>(0.82, 0.91, 1.0, 1.0);
}
`;
}

function buildTextureDisplayModule() {
  return `
@group(0) @binding(0)
var previewTexture: texture_2d<f32>;

struct DisplayVertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn greeblefs_texture_vertex(@builtin(vertex_index) vertexIndex: u32) -> DisplayVertexOutput {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
  );
  let position = positions[vertexIndex];
  var output: DisplayVertexOutput;
  output.position = vec4<f32>(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2<f32>(0.5, 0.5);
  return output;
}

@fragment
fn greeblefs_texture_fragment(input: DisplayVertexOutput) -> @location(0) vec4<f32> {
  let size = textureDimensions(previewTexture);
  let coords = vec2<i32>(clamp(input.uv * vec2<f32>(size), vec2<f32>(0.0), vec2<f32>(size) - vec2<f32>(1.0)));
  return textureLoad(previewTexture, coords, 0);
}
`;
}

function createPlaneMesh(): {
  vertices: Float32Array;
  indices: Uint16Array;
} {
  const vertices = new Float32Array([
    -1, -1, 0, 0, 0, 1, 0, 0,
    1, -1, 0, 0, 0, 1, 1, 0,
    1, 1, 0, 0, 0, 1, 1, 1,
    -1, 1, 0, 0, 0, 1, 0, 1,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  return { vertices, indices };
}

function createSphereMesh(segments = 32, rings = 18): {
  vertices: Float32Array;
  indices: Uint16Array;
} {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let ringIndex = 0; ringIndex <= rings; ringIndex += 1) {
    const v = ringIndex / rings;
    const phi = v * Math.PI;
    const y = Math.cos(phi);
    const radius = Math.sin(phi);

    for (let segmentIndex = 0; segmentIndex <= segments; segmentIndex += 1) {
      const u = segmentIndex / segments;
      const theta = u * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      vertices.push(x, y, z, x, y, z, u, 1 - v);
    }
  }

  for (let ringIndex = 0; ringIndex < rings; ringIndex += 1) {
    for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
      const a = ringIndex * (segments + 1) + segmentIndex;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}

function multiplyMatrices4x4(left: Float32Array, right: Float32Array) {
  const output = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let sum = 0;
      for (let index = 0; index < 4; index += 1) {
        sum +=
          left[index * 4 + row] *
          right[column * 4 + index];
      }
      output[column * 4 + row] = sum;
    }
  }
  return output;
}

function buildPerspectiveMatrix(aspect: number, fieldOfViewRadians: number) {
  const f = 1 / Math.tan(fieldOfViewRadians / 2);
  const near = 0.1;
  const far = 100;
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, far / (near - far), -1,
    0, 0, (near * far) / (near - far), 0,
  ]);
}

function buildTranslationMatrix(x: number, y: number, z: number) {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

function buildYAxisRotationMatrix(angleRadians: number) {
  const c = Math.cos(angleRadians);
  const s = Math.sin(angleRadians);
  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

function createPreviewUniformState(
  aspect: number,
  scene: ShaderWorkbenchScene,
  timeSeconds: number,
): PreviewUniformState {
  if (scene === "fullscreen") {
    return {
      timeSeconds,
      aspect,
      mvp: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]),
    };
  }

  const projection = buildPerspectiveMatrix(aspect, Math.PI / 3);
  const rotation = buildYAxisRotationMatrix(timeSeconds * 0.5);
  const translation = buildTranslationMatrix(0, 0, -3.1);
  return {
    timeSeconds,
    aspect,
    mvp: multiplyMatrices4x4(
      projection,
      multiplyMatrices4x4(translation, rotation),
    ),
  };
}

function writePreviewUniformBuffer(
  device: GPUDevice,
  uniformBuffer: GPUBuffer,
  state: PreviewUniformState,
  scene: ShaderWorkbenchScene,
) {
  const uniformValues = new Float32Array(20);
  uniformValues[0] = state.timeSeconds;
  uniformValues[1] = state.aspect;
  uniformValues[2] = scene === "sphere" ? 1 : 0;
  uniformValues.set(state.mvp, 4);
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues.buffer);
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

  useEffect(() => {
    let cancelled = false;
    let frameHandle = 0;
    let lastRenderedTimestamp = 0;
    const canvas = canvasRef.current;

    async function run() {
      if (!canvas) {
        return;
      }
      if (!normalizedWgsl || !selectedStage || !selectedEntryPoint) {
        setStatus({
          mode: "unavailable",
          message: buildFallbackPosterMessage(
            normalizedWgsl,
            selectedStage,
            selectedEntryPoint,
          ),
        });
        return;
      }
      if (!isNavigatorWithGpu(window.navigator)) {
        setStatus({
          mode: "unavailable",
          message:
            "WebGPU is unavailable in this webview. The shader workbench is showing diagnostics and the cached poster instead.",
        });
        return;
      }

      setStatus({
        mode: "loading",
        message: "Compiling shader preview pipeline…",
      });

      try {
        const adapter = await window.navigator.gpu.requestAdapter();
        if (!adapter) {
          throw new Error("No WebGPU adapter is available.");
        }
        const device = await adapter.requestDevice();
        if (cancelled) {
          return;
        }

        const pixelRatio = Math.max(
          1,
          Math.min(window.devicePixelRatio || 1, previewProfile.previewPixelRatioCap),
        );
        const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
        const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("webgpu");
        if (!context) {
          throw new Error("Failed to acquire a WebGPU canvas context.");
        }

        const canvasFormat = window.navigator.gpu.getPreferredCanvasFormat();
        context.configure({
          device,
          format: canvasFormat,
          alphaMode: "premultiplied",
        });

        const mesh =
          selectedScene === "sphere"
            ? createSphereMesh(
                previewProfile.previewSphereSegments,
                previewProfile.previewSphereRings,
              )
            : createPlaneMesh();
        const vertexBuffer = device.createBuffer({
          size: mesh.vertices.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true,
        });
        new Float32Array(vertexBuffer.getMappedRange()).set(mesh.vertices);
        vertexBuffer.unmap();

        const indexBuffer = device.createBuffer({
          size: mesh.indices.byteLength,
          usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true,
        });
        new Uint16Array(indexBuffer.getMappedRange()).set(mesh.indices);
        indexBuffer.unmap();

        const uniformBuffer = device.createBuffer({
          size: 20 * 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const hostVertexModule = device.createShaderModule({
          code: buildHostVertexModule(),
        });
        const hostFragmentModule = device.createShaderModule({
          code: buildHostFragmentModule(),
        });
        const textureDisplayModule = device.createShaderModule({
          code: buildTextureDisplayModule(),
        });
        const userModule = device.createShaderModule({ code: normalizedWgsl });

        let renderPipeline: GPURenderPipeline | null = null;
        let computePipeline: GPUComputePipeline | null = null;
        let computeBindGroup: GPUBindGroup | null = null;
        let computeTexture: GPUTexture | null = null;
        let displayBindGroup: GPUBindGroup | null = null;

        if (selectedStage === "compute") {
          computeTexture = device.createTexture({
            size: { width, height },
            format: "rgba8unorm",
            usage:
              GPUTextureUsage.STORAGE_BINDING |
              GPUTextureUsage.TEXTURE_BINDING |
              GPUTextureUsage.RENDER_ATTACHMENT,
          });
          const computeBindGroupLayout = device.createBindGroupLayout({
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                  access: "write-only",
                  format: "rgba8unorm",
                  viewDimension: "2d",
                },
              },
              {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" },
              },
            ],
          });
          computePipeline = await device.createComputePipelineAsync({
            layout: device.createPipelineLayout({
              bindGroupLayouts: [computeBindGroupLayout],
            }),
            compute: {
              module: userModule,
              entryPoint: selectedEntryPoint,
            },
          });
          computeBindGroup = device.createBindGroup({
            layout: computeBindGroupLayout,
            entries: [
              { binding: 0, resource: computeTexture.createView() },
              { binding: 1, resource: { buffer: uniformBuffer } },
            ],
          });

          const textureDisplayLayout = device.createBindGroupLayout({
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: "float" },
              },
            ],
          });
          renderPipeline = await device.createRenderPipelineAsync({
            layout: device.createPipelineLayout({
              bindGroupLayouts: [textureDisplayLayout],
            }),
            vertex: {
              module: textureDisplayModule,
              entryPoint: "greeblefs_texture_vertex",
            },
            fragment: {
              module: textureDisplayModule,
              entryPoint: "greeblefs_texture_fragment",
              targets: [{ format: canvasFormat }],
            },
            primitive: { topology: "triangle-list" },
          });
          displayBindGroup = device.createBindGroup({
            layout: textureDisplayLayout,
            entries: [{ binding: 0, resource: computeTexture.createView() }],
          });
        } else {
          const renderBindGroupLayout = device.createBindGroupLayout({
            entries: [
              {
                binding: 0,
                visibility:
                  GPUShaderStage.VERTEX |
                  GPUShaderStage.FRAGMENT |
                  GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" },
              },
            ],
          });
          renderPipeline = await device.createRenderPipelineAsync({
            layout: device.createPipelineLayout({
              bindGroupLayouts: [renderBindGroupLayout],
            }),
            vertex: {
              module:
                selectedStage === "vertex" ? userModule : hostVertexModule,
              entryPoint:
                selectedStage === "vertex"
                  ? selectedEntryPoint
                  : "greeblefs_preview_host_vertex",
              buffers: [
                {
                  arrayStride: 8 * 4,
                  attributes: [
                    { shaderLocation: 0, offset: 0, format: "float32x3" },
                    { shaderLocation: 1, offset: 3 * 4, format: "float32x3" },
                    { shaderLocation: 2, offset: 6 * 4, format: "float32x2" },
                  ],
                },
              ],
            },
            fragment: {
              module:
                selectedStage === "fragment" ? userModule : hostFragmentModule,
              entryPoint:
                selectedStage === "fragment"
                  ? selectedEntryPoint
                  : "greeblefs_preview_host_fragment",
              targets: [{ format: canvasFormat }],
            },
            primitive: {
              topology: "triangle-list",
              cullMode: selectedScene === "sphere" ? "back" : undefined,
            },
          });
          computeBindGroup = device.createBindGroup({
            layout: renderBindGroupLayout,
            entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
          });
        }

        const targetFrameMs = 1000 / Math.max(previewProfile.previewFrameRate, 1);
        setStatus({
          mode: "ready",
          message:
            selectedStage === "compute"
              ? "Compute preview rendered through the storage-texture host."
              : "Live WebGPU preview is active.",
        });

        const renderFrame = (timestamp: number) => {
          if (cancelled || !renderPipeline) {
            return;
          }

          if (lastRenderedTimestamp !== 0 && timestamp - lastRenderedTimestamp < targetFrameMs) {
            frameHandle = window.requestAnimationFrame(renderFrame);
            return;
          }
          lastRenderedTimestamp = timestamp;

          const uniformState = createPreviewUniformState(
            width / Math.max(height, 1),
            selectedScene,
            timestamp / 1000,
          );
          writePreviewUniformBuffer(device, uniformBuffer, uniformState, selectedScene);

          const encoder = device.createCommandEncoder();
          if (computePipeline && computeBindGroup && computeTexture) {
            const pass = encoder.beginComputePass();
            pass.setPipeline(computePipeline);
            pass.setBindGroup(0, computeBindGroup);
            pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
            pass.end();
          }

          const renderPass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.04, g: 0.05, b: 0.08, a: 1 },
                loadOp: "clear",
                storeOp: "store",
              },
            ],
          });
          renderPass.setPipeline(renderPipeline);
          if (selectedStage === "compute") {
            if (displayBindGroup) {
              renderPass.setBindGroup(0, displayBindGroup);
            }
            renderPass.draw(6);
          } else {
            if (computeBindGroup) {
              renderPass.setBindGroup(0, computeBindGroup);
            }
            renderPass.setVertexBuffer(0, vertexBuffer);
            renderPass.setIndexBuffer(indexBuffer, "uint16");
            renderPass.drawIndexed(mesh.indices.length);
          }
          renderPass.end();

          device.queue.submit([encoder.finish()]);
          frameHandle = window.requestAnimationFrame(renderFrame);
        };

        frameHandle = window.requestAnimationFrame(renderFrame);
      } catch (error) {
        if (!cancelled) {
          setStatus({
            mode: "error",
            message: String(error),
          });
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      if (frameHandle) {
        window.cancelAnimationFrame(frameHandle);
      }
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
        <span style={statusPillStyle}>
          <Cpu size={13} />
          {selectedStage ?? "no-stage"}
        </span>
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
          <select
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
          </select>
          <select
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
          </select>
          <span style={statusPillStyle}>
            {format.toUpperCase()}
            {isReadOnly ? " · Read only" : ""}
          </span>
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
