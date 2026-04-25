import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
    outDir: path.resolve(__dirname, "dist-mobile"),
    emptyOutDir: true,
  },
});
