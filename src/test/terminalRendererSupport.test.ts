import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  probeTerminalWebglSupport,
  resetTerminalWebglSupportCacheForTests,
  shouldLoadTerminalWebglRenderer,
} from '../components/terminal/terminalRendererSupport';

const WEBGL_DEBUG_RENDERER_INFO = {
  UNMASKED_VENDOR_WEBGL: 0x9245,
  UNMASKED_RENDERER_WEBGL: 0x9246,
};

function installWebglContextMock(
  rendererLabel: string | null,
  options: { strictContextFailure?: boolean } = {},
) {
  const getExtension = vi.fn((name: string) => {
    if (name === 'WEBGL_debug_renderer_info' && rendererLabel) {
      return WEBGL_DEBUG_RENDERER_INFO;
    }

    if (name === 'WEBGL_lose_context') {
      return { loseContext: vi.fn() };
    }

    return null;
  });

  const getParameter = vi.fn((parameter: number) => {
    if (parameter === WEBGL_DEBUG_RENDERER_INFO.UNMASKED_VENDOR_WEBGL) {
      return rendererLabel?.split(' ')[0] ?? '';
    }

    if (parameter === WEBGL_DEBUG_RENDERER_INFO.UNMASKED_RENDERER_WEBGL) {
      return rendererLabel ?? '';
    }

    return null;
  });

  const getContext = vi.fn((kind: string, contextAttributes?: WebGLContextAttributes) => {
    if (kind !== 'webgl2') {
      return null;
    }

    if (options.strictContextFailure && contextAttributes?.failIfMajorPerformanceCaveat) {
      return null;
    }

    if (rendererLabel === null) {
      return null;
    }

    return {
      getExtension,
      getParameter,
    };
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: getContext,
  });

  return { getContext, getExtension, getParameter };
}

describe('terminal webgl support probing', () => {
  beforeEach(() => {
    resetTerminalWebglSupportCacheForTests();
  });

  it('rejects missing webgl2 support', () => {
    installWebglContextMock(null);

    const support = probeTerminalWebglSupport();

    expect(support.contextAvailable).toBe(false);
    expect(shouldLoadTerminalWebglRenderer('auto')).toBe(false);
  });

  it('rejects software-backed renderers', () => {
    installWebglContextMock('Mesa llvmpipe');

    const support = probeTerminalWebglSupport();

    expect(support.contextAvailable).toBe(true);
    expect(support.softwareRenderer).toBe(true);
    expect(support.rendererLabel).toContain('llvmpipe');
    expect(shouldLoadTerminalWebglRenderer('webgl')).toBe(false);
  });

  it('accepts a hardware renderer', () => {
    installWebglContextMock('NVIDIA Corporation Quadro RTX 3000/PCIe/SSE2');

    const support = probeTerminalWebglSupport();

    expect(support.contextAvailable).toBe(true);
    expect(support.softwareRenderer).toBe(false);
    expect(support.rendererLabel).toContain('NVIDIA');
    expect(shouldLoadTerminalWebglRenderer('auto')).toBe(true);
  });

  it('falls back to a relaxed webgl2 probe when the strict probe is rejected', () => {
    installWebglContextMock('NVIDIA Corporation Quadro RTX 3000/PCIe/SSE2', {
      strictContextFailure: true,
    });

    const support = probeTerminalWebglSupport();

    expect(support.contextAvailable).toBe(true);
    expect(support.softwareRenderer).toBe(false);
    expect(shouldLoadTerminalWebglRenderer('auto')).toBe(true);
  });
});
