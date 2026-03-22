import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  cacheDir: process.env.OVERLAYTERM_VITE_CACHE_DIR,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    exclude: ['src/test/browser/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: process.env.OVERLAYTERM_VITEST_COVERAGE_DIR,
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
