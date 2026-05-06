import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const requiredTauronRelativeManifestPaths = [
  "Cargo.toml",
  path.join("crates", "tauri", "Cargo.toml"),
  path.join("crates", "tauri-build", "Cargo.toml"),
  path.join("crates", "tauri-codegen", "Cargo.toml"),
  path.join("crates", "tauri-macros", "Cargo.toml"),
  path.join("crates", "tauri-plugin", "Cargo.toml"),
  path.join("crates", "tauri-runtime", "Cargo.toml"),
  path.join("crates", "tauri-runtime-wry", "Cargo.toml"),
  path.join("crates", "tauri-utils", "Cargo.toml"),
];

const tauronApiSourceRelativePaths = [
  path.join("packages", "api", "package.json"),
  path.join("packages", "api", "src", "core.ts"),
  path.join("packages", "api", "src", "global.d.ts"),
  path.join("packages", "api", "src", "index.ts"),
  path.join("packages", "api", "src", "mocks.ts"),
  path.join("packages", "api", "src", "transport.ts"),
  path.join("crates", "tauri", "scripts", "core.js"),
];

const tauronApiDistRelativePaths = [
  path.join("packages", "api", "dist", "package.json"),
  path.join("packages", "api", "dist", "core.js"),
  path.join("packages", "api", "dist", "index.js"),
  path.join("packages", "api", "dist", "transport.js"),
];

function normalizePathForLogs(value) {
  return value.replace(/\\/g, "/");
}

function collectMissingAbsolutePaths(root, relativePaths) {
  return relativePaths
    .map((relativePath) => ({
      relativePath,
      absolutePath: path.join(root, relativePath),
    }))
    .filter(({ absolutePath }) => !fs.existsSync(absolutePath));
}

function renderMissingAbsolutePaths(missingPaths) {
  return missingPaths
    .map(({ absolutePath }) => `  - ${normalizePathForLogs(absolutePath)}`)
    .join("\n");
}

function getNewestMtimeMs(absolutePaths) {
  return absolutePaths.reduce((latestMtimeMs, absolutePath) => {
    const currentMtimeMs = fs.statSync(absolutePath).mtimeMs;
    return Math.max(latestMtimeMs, currentMtimeMs);
  }, 0);
}

function getOldestMtimeMs(absolutePaths) {
  return absolutePaths.reduce((oldestMtimeMs, absolutePath) => {
    const currentMtimeMs = fs.statSync(absolutePath).mtimeMs;
    return Math.min(oldestMtimeMs, currentMtimeMs);
  }, Number.POSITIVE_INFINITY);
}

function ensureTauronApiDist(tauronRoot) {
  const missingApiDistPaths = collectMissingAbsolutePaths(
    tauronRoot,
    tauronApiDistRelativePaths,
  );

  const tauronApiSourcePaths = tauronApiSourceRelativePaths.map((relativePath) =>
    path.join(tauronRoot, relativePath),
  );
  const tauronApiDistPaths = tauronApiDistRelativePaths.map((relativePath) =>
    path.join(tauronRoot, relativePath),
  );

  const apiDistIsStale = missingApiDistPaths.length > 0
    || getNewestMtimeMs(tauronApiSourcePaths) > getOldestMtimeMs(tauronApiDistPaths);

  if (!apiDistIsStale) {
    return {
      apiDistPaths: tauronApiDistPaths,
      apiSourcePaths: tauronApiSourcePaths,
    };
  }

  const buildCommand = process.platform === "win32"
    ? {
        command: "cmd.exe",
        args: ["/d", "/s", "/c", "pnpm build:api"],
      }
    : {
        command: "pnpm",
        args: ["build:api"],
      };
  const buildResult = spawnSync(
    buildCommand.command,
    buildCommand.args,
    {
      cwd: tauronRoot,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (buildResult.error) {
    throw buildResult.error;
  }

  if (buildResult.status !== 0) {
    throw new Error(
      `Failed to build tauron JS API dist via 'pnpm build:api' in ${normalizePathForLogs(tauronRoot)}.`,
    );
  }

  const missingApiDistPathsAfterBuild = collectMissingAbsolutePaths(
    tauronRoot,
    tauronApiDistRelativePaths,
  );
  if (missingApiDistPathsAfterBuild.length > 0) {
    throw new Error(
      [
        "Tauron JS API dist is still incomplete after running 'pnpm build:api'.",
        `Expected tauron workspace root: ${normalizePathForLogs(tauronRoot)}`,
        "Missing required tauron API dist paths:",
        renderMissingAbsolutePaths(missingApiDistPathsAfterBuild),
      ].join("\n"),
    );
  }

  return {
    apiDistPaths: tauronApiDistPaths,
    apiSourcePaths: tauronApiSourcePaths,
  };
}

export function resolveTauronRoot(projectRoot) {
  return path.resolve(projectRoot, "..", "tauron");
}

export function assertTauronForkAvailable(projectRoot) {
  const tauronRoot = resolveTauronRoot(projectRoot);
  const missingManifestPaths = collectMissingAbsolutePaths(
    tauronRoot,
    requiredTauronRelativeManifestPaths,
  );

  if (missingManifestPaths.length > 0) {
    throw new Error(
      [
        "GreebleFS now requires the sibling tauron fork for Rust-side Tauri crates.",
        `Expected tauron workspace root: ${normalizePathForLogs(tauronRoot)}`,
        "Missing required tauron manifest paths:",
        renderMissingAbsolutePaths(missingManifestPaths),
        "Restore or clone the tauron workspace beside GreebleFS before running Cargo-backed scripts.",
      ].join("\n"),
    );
  }

  const { apiDistPaths, apiSourcePaths } = ensureTauronApiDist(tauronRoot);

  return {
    tauronRoot,
    requiredManifestPaths: requiredTauronRelativeManifestPaths.map((relativeManifestPath) =>
      path.join(tauronRoot, relativeManifestPath),
    ),
    apiDistPaths,
    apiSourcePaths,
  };
}
