import type { OverlayWorkbenchTerminalRenderer } from '../../config/workbenchTheme';

export interface TerminalWebglSupportSnapshot {
  contextAvailable: boolean;
  rendererLabel: string | null;
  softwareRenderer: boolean;
}

const SOFTWARE_RENDERER_PATTERNS = [
  /llvmpipe/i,
  /softpipe/i,
  /swrast/i,
  /swiftshader/i,
  /software/i,
  /mesa offscreen/i,
];

let cachedTerminalWebglSupport: TerminalWebglSupportSnapshot | null = null;

function formatRendererLabel(vendor: unknown, renderer: unknown): string | null {
  const vendorLabel = typeof vendor === 'string' ? vendor.trim() : '';
  const rendererLabel = typeof renderer === 'string' ? renderer.trim() : '';
  const combinedLabel = [vendorLabel, rendererLabel].filter(Boolean).join(' ');
  return combinedLabel || null;
}

function isSoftwareRendererLabel(rendererLabel: string | null): boolean {
  return rendererLabel != null && SOFTWARE_RENDERER_PATTERNS.some(pattern => pattern.test(rendererLabel));
}

function createTerminalWebgl2Context(canvas: HTMLCanvasElement, failIfMajorPerformanceCaveat: boolean) {
  return canvas.getContext('webgl2', {
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat,
  } as WebGLContextAttributes) as WebGL2RenderingContext | null;
}

export function resetTerminalWebglSupportCacheForTests(): void {
  cachedTerminalWebglSupport = null;
}

export function probeTerminalWebglSupport(): TerminalWebglSupportSnapshot {
  if (cachedTerminalWebglSupport) {
    return cachedTerminalWebglSupport;
  }

  if (typeof document === 'undefined') {
    cachedTerminalWebglSupport = {
      contextAvailable: false,
      rendererLabel: null,
      softwareRenderer: false,
    };
    return cachedTerminalWebglSupport;
  }

  try {
    const canvas = document.createElement('canvas');
    const context = createTerminalWebgl2Context(canvas, true) ?? createTerminalWebgl2Context(canvas, false);

    if (!context) {
      cachedTerminalWebglSupport = {
        contextAvailable: false,
        rendererLabel: null,
        softwareRenderer: false,
      };
      return cachedTerminalWebglSupport;
    }

    const debugRendererInfo = context.getExtension('WEBGL_debug_renderer_info') as {
      UNMASKED_VENDOR_WEBGL: number;
      UNMASKED_RENDERER_WEBGL: number;
    } | null;

    const rendererLabel = debugRendererInfo
      ? formatRendererLabel(
        context.getParameter(debugRendererInfo.UNMASKED_VENDOR_WEBGL),
        context.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL),
      )
      : null;

    const softwareRenderer = isSoftwareRendererLabel(rendererLabel);
    const loseContextExtension = context.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null;
    loseContextExtension?.loseContext?.();

    cachedTerminalWebglSupport = {
      contextAvailable: true,
      rendererLabel,
      softwareRenderer,
    };
    return cachedTerminalWebglSupport;
  } catch {
    cachedTerminalWebglSupport = {
      contextAvailable: false,
      rendererLabel: null,
      softwareRenderer: false,
    };
    return cachedTerminalWebglSupport;
  }
}

export function shouldLoadTerminalWebglRenderer(
  rendererPreference: OverlayWorkbenchTerminalRenderer,
): boolean {
  if (rendererPreference === 'dom') {
    return false;
  }

  const support = probeTerminalWebglSupport();
  return support.contextAvailable && !support.softwareRenderer;
}
