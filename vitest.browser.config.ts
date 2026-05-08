import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { searchForWorkspaceRoot } from 'vite';
import { projectPath, tauronApiDistPath, tauronApiViteAliases } from './vite.shared.ts';

const ignoredWatchGlobs = [
  '**/.git/**',
  '**/coverage/**',
  '**/dist/**',
  '**/output/**',
  '**/release-packages/**',
  '**/target/**',
  '**/src-tauri/target*/**',
  '**/target-tests*/**',
  '**/plugins/**/node_modules/**',
];

const tiptapVendorAliases = [
  { find: '@tiptap/core/jsx-runtime', replacement: projectPath('src/vendor/tiptap/core/src/jsx-runtime.ts') },
  { find: '@tiptap/core/jsx-dev-runtime', replacement: projectPath('src/vendor/tiptap/core/src/jsx-runtime.ts') },
  { find: '@tiptap/core', replacement: projectPath('src/vendor/tiptap/core/src/index.ts') },
  { find: '@tiptap/react', replacement: projectPath('src/vendor/tiptap/react/src/index.ts') },
  { find: /^@tiptap\/pm\/(.+)$/, replacement: `${projectPath('src/vendor/tiptap/pm')}/$1/index.ts` },
  { find: /^@tiptap\/(.+)$/, replacement: `${projectPath('src/vendor/tiptap')}/$1/src/index.ts` },
] as const;

export default defineConfig({
  cacheDir: process.env.OVERLAYTERM_VITE_CACHE_DIR,
  plugins: [react()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), tauronApiDistPath],
    },
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
    alias: [
      { find: '@', replacement: '/src' },
      { find: '@img-editor-runtime', replacement: projectPath('packages/img-editor/src/main.ts') },
      ...tauronApiViteAliases,
      ...tiptapVendorAliases,
    ],
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
