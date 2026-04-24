import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const ignoredWatchGlobs = [
  "**/.git/**",
  "**/coverage/**",
  "**/dist/**",
  "**/output/**",
  "**/release-packages/**",
  "**/target/**",
  "**/src-tauri/**",
  "**/src-tauri/target*/**",
  "**/src/test/**",
  "**/target-tests*/**",
  "**/plugins/**/node_modules/**",
];

function projectPath(...segments: string[]): string {
  return path.resolve(...segments).replace(/\\/g, "/");
}

const tiptapVendorAliases = [
  { find: "@tiptap/core/jsx-runtime", replacement: projectPath("src/vendor/tiptap/core/src/jsx-runtime.ts") },
  { find: "@tiptap/core/jsx-dev-runtime", replacement: projectPath("src/vendor/tiptap/core/src/jsx-runtime.ts") },
  { find: "@tiptap/core", replacement: projectPath("src/vendor/tiptap/core/src/index.ts") },
  { find: "@tiptap/react", replacement: projectPath("src/vendor/tiptap/react/src/index.ts") },
  { find: /^@tiptap\/pm\/(.+)$/, replacement: `${projectPath("src/vendor/tiptap/pm")}/$1/index.ts` },
  { find: /^@tiptap\/(.+)$/, replacement: `${projectPath("src/vendor/tiptap")}/$1/src/index.ts` },
] as const;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: [
      { find: "@", replacement: "/src" },
      ...tiptapVendorAliases,
    ],
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  cacheDir: process.env.OVERLAYTERM_VITE_CACHE_DIR ?? path.resolve("node_modules/.vite"),
  build: {
    outDir: process.env.OVERLAYTERM_VITE_OUT_DIR ?? "dist",
    emptyOutDir: true,
  },
  worker: {
    format: "es",
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: true, // listen on all addresses
    watch: {
      // 3. keep large artifact trees and plugin dependency folders out of the live watcher.
      ignored: ignoredWatchGlobs,
    },
  },
}));
