import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
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
