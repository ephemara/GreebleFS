import { describe, expect, it } from 'vitest';
import { loadAnimationFromSource } from '../components/animationRuntime';

describe('animationRuntime edge cases', () => {
  it('returns a structured error when an animation imports an unsupported module', async () => {
    const loaded = await loadAnimationFromSource(
      `
        import leftPad from 'left-pad';

        export default {
          open: {
            resolveShellStyle: () => ({ opacity: leftPad('1', 2) }),
          },
        };
      `,
      {
        name: 'broken-animation.tsx',
        path: 'animations/broken-animation.tsx',
        is_dir: false,
        modified: 1,
        extension: 'tsx',
      },
    );

    expect(loaded.open).toBeNull();
    expect(loaded.close).toBeNull();
    expect(loaded.error).toContain('Unsupported import "left-pad"');
  });
});
