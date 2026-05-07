import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { assertTauronForkAvailable } from "./tauron-preflight.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const explicitBindingsCargoTargetDir =
  process.env.GREEBLEFS_BINDINGS_CARGO_TARGET_DIR
  || process.env.OVERLAYTERM_BINDINGS_CARGO_TARGET_DIR;
const inheritedCargoTargetDir = process.env.CARGO_TARGET_DIR;
const defaultSharedBindingsCargoTargetDir = inheritedCargoTargetDir
  ? path.resolve(inheritedCargoTargetDir)
  : path.join(projectRoot, "target");
const bindingsCargoTargetDir = explicitBindingsCargoTargetDir
  ? path.resolve(explicitBindingsCargoTargetDir)
  : defaultSharedBindingsCargoTargetDir;

function readMergedTauriConfigOverride() {
  let existingConfig = {};

  if (typeof process.env.TAURI_CONFIG === "string" && process.env.TAURI_CONFIG.trim().length > 0) {
    existingConfig = JSON.parse(process.env.TAURI_CONFIG);
  }

  const filteredBundleResources = existingConfig.bundle?.resources
    && !Array.isArray(existingConfig.bundle.resources)
    ? Object.fromEntries(
        Object.entries(existingConfig.bundle.resources).filter(
          ([resourceSource]) => !resourceSource.includes("dist-mobile"),
        ),
      )
    : existingConfig.bundle?.resources;

  return {
    ...existingConfig,
    build: {
      ...(existingConfig.build ?? {}),
      beforeBuildCommand: null,
      beforeDevCommand: null,
    },
    bundle: existingConfig.bundle
      ? {
          ...existingConfig.bundle,
          resources: filteredBundleResources,
        }
      : existingConfig.bundle,
  };
}

function run() {
  assertTauronForkAvailable(projectRoot);
  const tauriConfigOverride = readMergedTauriConfigOverride();
  const child = spawn(
    "cargo",
    [
      "run",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--bin",
      "export-bindings",
      ...process.argv.slice(2),
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        CARGO_TARGET_DIR: bindingsCargoTargetDir,
        TAURI_CONFIG: JSON.stringify(tauriConfigOverride),
      },
    },
  );

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

run();
