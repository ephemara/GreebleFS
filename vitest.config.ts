import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { projectPath, tauronApiViteAliases } from './vite.shared.ts';

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
    watch: {
      ignored: ignoredWatchGlobs,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'threads',
    maxWorkers: 2,
    fileParallelism: false,
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
    alias: [
      { find: '@', replacement: '/src' },
      { find: '@img-editor-runtime', replacement: projectPath('packages/img-editor/src/main.ts') },
      ...tauronApiViteAliases,
      ...tiptapVendorAliases,
    ],
  },
});
