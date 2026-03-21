import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/App.tsx',
        'src/components/**',
        'src/store/**',
        'src/config/**',
        'src/input/**',
        'src/panels/**',
        'src/runtime/**',
      ],
    },
  },
  resolve: {
    alias: { '@': '/src' },
  },
});
