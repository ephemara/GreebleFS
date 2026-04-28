import React from 'react';
import { defineShader } from 'overlayterm-shader';

export default defineShader({
  id: 'cobalt-halo',
  name: 'Cobalt Halo',
  description: 'Example package shader that adds a cool blue glow behind the shell.',
  group: 'Plugin Template',
  background: {
    render: function CobaltHalo() {
      return React.createElement('div', {
        style: {
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 18% 24%, rgba(56,189,248,0.24), transparent 42%), radial-gradient(circle at 82% 16%, rgba(14,165,233,0.18), transparent 34%)',
          pointerEvents: 'none',
        },
      });
    },
  },
});
