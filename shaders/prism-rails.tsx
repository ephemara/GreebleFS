import { defineShader, lerp } from 'overlayterm-shader';

export default defineShader({
  name: 'Prism Rails',
  description: 'A compact authoring sample that leans on style resolvers instead of canvas rendering.',
  group: 'Authoring Samples',
  tags: ['prism', 'style', 'border'],
  resolveSharedUniforms: context => ({
    accentWeight: context.zoom > 1 ? 0.62 : 0.48,
  }),
  background: {
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 18% 18%, ${context.accentColor}22, transparent 24%)`,
        'radial-gradient(circle at 82% 22%, rgba(255,255,255,0.14), transparent 18%)',
        'linear-gradient(135deg, rgba(255,255,255,0.03), transparent 46%, rgba(59,130,246,0.12) 76%, transparent 100%)',
      ].join(', '),
      filter: `blur(${lerp(8, 18, Math.min(context.blurStrength / 32, 1))}px)`,
      opacity: 0.72,
      mixBlendMode: 'screen',
    }),
  },
  topBar: {
    resolveStyle: context => ({
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 40%, ${context.accentColor}1d 50%, rgba(255,255,255,0.16) 60%, transparent 100%)`,
      opacity: 0.66,
      filter: 'blur(8px)',
      transform: 'scale(1.04)',
    }),
  },
  border: {
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}44`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 20px ${context.accentColor}${Math.round(Number(context.sharedUniforms.accentWeight ?? 0.48) * 255).toString(16).padStart(2, '0')}`,
    }),
  },
});
