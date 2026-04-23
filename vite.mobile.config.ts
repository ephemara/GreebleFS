import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: path.resolve(__dirname, "src-mobile"),
  base: "/",
  publicDir: path.resolve(__dirname, "src-mobile/public"),
  plugins: [react()],
  cacheDir: path.resolve(__dirname, "node_modules/.vite-mobile"),
  build: {
    outDir: path.resolve(__dirname, "dist-mobile"),
    emptyOutDir: true,
  },
});
