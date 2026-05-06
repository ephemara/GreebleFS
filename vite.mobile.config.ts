import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const mobileBuildOutDir =
  process.env.GREEBLEFS_VITE_MOBILE_OUT_DIR
  ?? process.env.OVERLAYTERM_VITE_MOBILE_OUT_DIR
  ?? path.resolve(__dirname, "dist-mobile");

export default defineConfig({
  root: path.resolve(__dirname, "src-mobile"),
  base: "/",
  publicDir: path.resolve(__dirname, "src-mobile/public"),
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: ".",
      filename: "sw.ts",
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
    }),
  ],
  cacheDir: path.resolve(__dirname, "node_modules/.vite-mobile"),
  build: {
    outDir: mobileBuildOutDir,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "mobile-react-core";
          }

          if (id.includes("/lucide-react/")) {
            return "mobile-icons";
          }

          if (id.includes("/interactjs/")) {
            return "mobile-gestures";
          }

          if (id.includes("/@tanstack/react-virtual/")) {
            return "mobile-virtual";
          }

          return "mobile-vendor";
        },
      },
    },
  },
});
