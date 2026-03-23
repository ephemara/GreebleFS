import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const ignoredWatchGlobs = [
  "**/.git/**",
  "**/coverage/**",
  "**/dist/**",
  "**/output/**",
  "**/release-packages/**",
  "**/src-tauri/**",
  "**/src-tauri/target*/**",
  "**/target-tests*/**",
  "**/plugins/**/node_modules/**",
];

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": "/src",
    },
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
