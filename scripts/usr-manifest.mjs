import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultProjectRoot = path.resolve(__dirname, "..");

function normalizeManifestEntry(entry) {
  return {
    id: String(entry.id ?? "").trim(),
    relativeDirectory: String(entry.relativeDirectory ?? "").trim(),
    envVarSuffix: typeof entry.envVarSuffix === "string" && entry.envVarSuffix.trim().length > 0
      ? entry.envVarSuffix.trim()
      : undefined,
    bundled: entry.bundled !== false,
    bootstrapToManagedRoot: entry.bootstrapToManagedRoot !== false,
  };
}

export function getUsrManifestPath({ projectRootPath = defaultProjectRoot } = {}) {
  return path.join(projectRootPath, "usr", "manifest.json");
}

export function readUsrManifest({ projectRootPath = defaultProjectRoot } = {}) {
  const manifestPath = getUsrManifestPath({ projectRootPath });
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(manifestText);
  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    entries: Array.isArray(parsed.entries) ? parsed.entries.map(normalizeManifestEntry) : [],
  };
}

export function getUsrManagedContentEntries({ projectRootPath = defaultProjectRoot } = {}) {
  return readUsrManifest({ projectRootPath }).entries.filter(
    (entry) => typeof entry.envVarSuffix === "string" && entry.envVarSuffix.length > 0,
  );
}

export function getUsrEntrySourcePath(entry, { projectRootPath = defaultProjectRoot } = {}) {
  return path.join(projectRootPath, "usr", entry.relativeDirectory);
}
