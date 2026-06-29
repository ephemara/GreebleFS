import path from "node:path";
import type { Alias } from "vite";

export function projectPath(...segments: string[]): string {
  return path.resolve(...segments).replace(/\\/g, "/");
}

export const tauronApiDistPath = projectPath("tauron", "packages", "api", "dist");

export const tauronApiViteAliases = [
  { find: /^@tauri-apps\/api$/, replacement: `${tauronApiDistPath}/index.js` },
  { find: /^@tauri-apps\/api\/(.+)$/, replacement: `${tauronApiDistPath}/$1.js` },
] satisfies Alias[];
