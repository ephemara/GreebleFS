import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { projectPath, tauronApiDistPath, tauronApiViteAliases } from "./vite.shared.ts";

const repoSkillsMirrorPath = projectPath("skills");

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
  "**/MCP/.state/**",
  "**/plugins/**/node_modules/**",
  "skills",
  "skills/**",
  repoSkillsMirrorPath,
  `${repoSkillsMirrorPath}/**`,
  "**/usr/profiles/**/settings.json",
];

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
      { find: "@greeblefs/ui", replacement: projectPath("usr/packages/greeblefs-ui/src/index.tsx") },
      { find: "overlayterm-plugin", replacement: projectPath("src/components/pluginRuntime.tsx") },
      ...tauronApiViteAliases,
      ...tiptapVendorAliases,
    ],
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  cacheDir: process.env.GREEBLEFS_VITE_CACHE_DIR
    ?? process.env.OVERLAYTERM_VITE_CACHE_DIR
    ?? path.resolve("node_modules/.vite"),
  optimizeDeps: {
    entries: ["index.html"],
  },
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
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), tauronApiDistPath],
    },
    watch: {
      // 3. keep large artifact trees and plugin dependency folders out of the live watcher.
      ignored: ignoredWatchGlobs,
    },
  },
}));
