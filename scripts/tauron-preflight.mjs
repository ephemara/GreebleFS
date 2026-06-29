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
  path.join("crates", "tauri-plugin-windowmgr", "Cargo.toml"),
];

const tauronApiSourceRelativePaths = [
  path.join("packages", "api", "package.json"),
  path.join("packages", "api", "src", "core.ts"),
  path.join("packages", "api", "src", "global.d.ts"),
  path.join("packages", "api", "src", "index.ts"),
  path.join("packages", "api", "src", "mocks.ts"),
  path.join("packages", "api", "src", "dev-observatory.ts"),
  path.join("packages", "api", "src", "native-buffer-pool.ts"),
  path.join("packages", "api", "src", "native-control.ts"),
  path.join("packages", "api", "src", "native-stream.ts"),
  path.join("packages", "api", "src", "transport.ts"),
  path.join("packages", "api", "src", "windowmgr.ts"),
  path.join("crates", "tauri", "scripts", "core.js"),
];

const tauronApiDistRequiredRelativePaths = [
  path.join("packages", "api", "dist", "package.json"),
  path.join("packages", "api", "dist", "core.js"),
  path.join("packages", "api", "dist", "index.js"),
  path.join("packages", "api", "dist", "dev-observatory.js"),
  path.join("packages", "api", "dist", "native-buffer-pool.js"),
  path.join("packages", "api", "dist", "native-control.js"),
  path.join("packages", "api", "dist", "native-stream.js"),
  path.join("packages", "api", "dist", "transport.js"),
  path.join("packages", "api", "dist", "windowmgr.js"),
];

const tauronApiDistGeneratedRelativePaths = [
  path.join("packages", "api", "dist", "core.js"),
  path.join("packages", "api", "dist", "index.js"),
  path.join("packages", "api", "dist", "dev-observatory.js"),
  path.join("packages", "api", "dist", "native-buffer-pool.js"),
  path.join("packages", "api", "dist", "native-control.js"),
  path.join("packages", "api", "dist", "native-stream.js"),
  path.join("packages", "api", "dist", "transport.js"),
  path.join("packages", "api", "dist", "windowmgr.js"),
  path.join("crates", "tauri", "scripts", "bundle.global.js"),
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
  const missingRequiredApiDistPaths = collectMissingAbsolutePaths(
    tauronRoot,
    tauronApiDistRequiredRelativePaths,
  );
  const missingGeneratedApiDistPaths = collectMissingAbsolutePaths(
    tauronRoot,
    tauronApiDistGeneratedRelativePaths,
  );

  const tauronApiSourcePaths = tauronApiSourceRelativePaths.map((relativePath) =>
    path.join(tauronRoot, relativePath),
  );
  const tauronApiGeneratedDistPaths = tauronApiDistGeneratedRelativePaths.map((relativePath) =>
    path.join(tauronRoot, relativePath),
  );
  const tauronApiRequiredDistPaths = tauronApiDistRequiredRelativePaths.map((relativePath) =>
    path.join(tauronRoot, relativePath),
  );

  const apiDistIsStale = missingRequiredApiDistPaths.length > 0
    || missingGeneratedApiDistPaths.length > 0
    || getNewestMtimeMs(tauronApiSourcePaths) > getOldestMtimeMs(tauronApiGeneratedDistPaths);

  if (!apiDistIsStale) {
    return {
      apiDistPaths: tauronApiRequiredDistPaths,
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
    tauronApiDistRequiredRelativePaths,
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
    apiDistPaths: tauronApiRequiredDistPaths,
    apiSourcePaths: tauronApiSourcePaths,
  };
}

export function resolveTauronRoot(projectRoot) {
  return path.resolve(projectRoot, "tauron");
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
