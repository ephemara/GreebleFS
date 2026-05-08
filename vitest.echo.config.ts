import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { tauronApiViteAliases } from './vite.shared.ts';

export default defineConfig({
  cacheDir: process.env.OVERLAYTERM_VITE_CACHE_DIR,
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: '/src' },
      ...tauronApiViteAliases,
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/browser.setup.ts'],
    include: ['src/test/browser/fileExplorer.repositoryPicker.browser.test.tsx'],
  },
});
