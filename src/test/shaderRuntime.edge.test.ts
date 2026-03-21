import { describe, expect, it } from 'vitest';
import { loadShaderFromSource } from '../components/shaderRuntime';

describe('shaderRuntime edge cases', () => {
  it('returns a structured error when a shader imports an unsupported module', async () => {
    const loaded = await loadShaderFromSource(
      `
        import leftPad from 'left-pad';

        export default {
          background: {
            resolveStyle: () => ({ opacity: leftPad('1', 2) }),
          },
        };
      `,
      {
        name: 'broken-shader.tsx',
        path: 'shaders/broken-shader.tsx',
        is_dir: false,
        modified: 1,
        extension: 'tsx',
      },
    );

    expect(loaded.background).toBeNull();
    expect(loaded.topBar).toBeNull();
    expect(loaded.border).toBeNull();
    expect(loaded.error).toContain('Unsupported import "left-pad"');
  });
});
