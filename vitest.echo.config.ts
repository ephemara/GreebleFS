import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: process.env.OVERLAYTERM_VITE_CACHE_DIR,
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/browser.setup.ts'],
    include: ['src/test/browser/fileExplorer.repositoryPicker.browser.test.tsx'],
  },
});
