import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const ignoredWatchGlobs = [
  '**/.git/**',
  '**/coverage/**',
  '**/dist/**',
  '**/output/**',
  '**/release-packages/**',
  '**/src-tauri/target*/**',
  '**/target-tests*/**',
  '**/plugins/**/node_modules/**',
];

export default defineConfig({
  cacheDir: process.env.OVERLAYTERM_VITE_CACHE_DIR,
  plugins: [react()],
  server: {
    watch: {
      ignored: ignoredWatchGlobs,
    },
  },
  optimizeDeps: {
    include: [
      '@tauri-apps/api/event',
      '@tauri-apps/plugin-global-shortcut',
      '@tauri-apps/plugin-store',
      '@monaco-editor/react',
      '@testing-library/user-event',
      'smol-toml',
      'zustand',
      'zustand/middleware',
    ],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    globals: true,
    maxWorkers: 1,
    fileParallelism: false,
    setupFiles: ['./src/test/browser.setup.ts'],
    include: ['src/test/browser/**/*.browser.test.{ts,tsx}'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  },
});
