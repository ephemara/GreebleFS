import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sharedNodeModules = path.join(projectRoot, "node_modules");
const sharedTauriCliDir = path.join(sharedNodeModules, "@tauri-apps", "cli");
const sharedTauriCliEntry = path.join(sharedTauriCliDir, "tauri.js");
const cacheRoot = path.join(os.homedir(), ".cache", "overlayterm-tauri");
const hasExplicitArtifactRoot = Boolean(process.env.OVERLAYTERM_VPS_ARTIFACTS_ROOT);
const artifactRoot = hasExplicitArtifactRoot
  ? path.resolve(process.env.OVERLAYTERM_VPS_ARTIFACTS_ROOT)
  : cacheRoot;
const defaultFrontendDist = hasExplicitArtifactRoot
  ? path.join(artifactRoot, "dist")
  : path.join(projectRoot, "dist");
const defaultCargoTargetDir = hasExplicitArtifactRoot
  ? path.join(artifactRoot, "cargo-target", "tauri")
  : path.join(projectRoot, "src-tauri", "target");
const cacheNodeModules = path.join(cacheRoot, "node_modules");
const frontendDist = process.env.OVERLAYTERM_TAURI_FRONTEND_DIST
  ? path.resolve(process.env.OVERLAYTERM_TAURI_FRONTEND_DIST)
  : defaultFrontendDist;
const tauriConfigDir = process.env.OVERLAYTERM_TAURI_CONFIG_DIR
  ? path.resolve(process.env.OVERLAYTERM_TAURI_CONFIG_DIR)
  : path.join(artifactRoot, "tauri-config");
const tauriCargoTargetDir =
  process.env.CARGO_TARGET_DIR ??
  process.env.OVERLAYTERM_TAURI_CARGO_TARGET_DIR ??
  defaultCargoTargetDir;

function getLibcFlavor() {
  if (process.platform !== "linux") {
    return null;
  }

  const report = process.report?.getReport?.();
  return report?.header?.glibcVersionRuntime ? "gnu" : "musl";
}

function getNativeBindingPackageName() {
  const arch = process.arch;

  if (process.platform === "linux") {
    return `@tauri-apps/cli-linux-${arch}-${getLibcFlavor()}`;
  }

  if (process.platform === "win32") {
    return `@tauri-apps/cli-win32-${arch}-msvc`;
  }

  if (process.platform === "darwin") {
    return `@tauri-apps/cli-darwin-${arch}`;
  }

  return null;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeRuntimeTauriConfig() {
  const tauriConfigPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
  const rawConfig = await fs.readFile(tauriConfigPath, "utf8");
  const config = JSON.parse(rawConfig);
  const runtimeConfigPath = path.join(tauriConfigDir, "tauri.vps.config.json");

  config.build = {
    ...config.build,
    frontendDist,
  };

  await fs.mkdir(tauriConfigDir, { recursive: true });
  await fs.writeFile(runtimeConfigPath, `${JSON.stringify(config, null, 2)}\n`);
  return runtimeConfigPath;
}

function runCommand(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited from signal ${signal}`));
        return;
      }

      resolve(code ?? 0);
    });

    child.on("error", reject);
  });
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function readSharedCliVersion() {
  const packageJsonPath = path.join(sharedTauriCliDir, "package.json");

  if (!(await pathExists(packageJsonPath))) {
    throw new Error(
      "Shared @tauri-apps/cli package is missing. Run npm install in OverlayTerm first."
    );
  }

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  return packageJson.version;
}

async function ensureNativeBindingAvailable() {
  const nativeBinding = getNativeBindingPackageName();
  if (!nativeBinding) {
    return;
  }

  const bindingDir = path.join(cacheNodeModules, ...nativeBinding.split("/"));
  if (await pathExists(bindingDir)) {
    return;
  }

  const cliVersion = await readSharedCliVersion();
  await fs.mkdir(cacheRoot, { recursive: true });

  console.log(`Installing ${nativeBinding}@${cliVersion} into VPS-local cache...`);

  const installCode = await runCommand(getNpmCommand(), [
    "install",
    "--no-save",
    "--prefix",
    cacheRoot,
    `${nativeBinding}@${cliVersion}`,
  ]);

  if (installCode !== 0) {
    process.exit(installCode);
  }
}

async function main() {
  if (!(await pathExists(sharedTauriCliEntry))) {
    throw new Error(
      "Shared Tauri CLI entrypoint is missing. Run npm install in OverlayTerm first."
    );
  }

  await ensureNativeBindingAvailable();
  await fs.mkdir(frontendDist, { recursive: true });

  const existingNodePath = process.env.NODE_PATH
    ? `${cacheNodeModules}${path.delimiter}${process.env.NODE_PATH}`
    : cacheNodeModules;
  const runtimeConfigPath = await writeRuntimeTauriConfig();
  const cliArgs = process.argv.slice(2);
  const hasExplicitConfig = cliArgs.includes("--config") || cliArgs.includes("-c");
  const tauriArgs =
    hasExplicitConfig || cliArgs.length === 0
      ? cliArgs
      : [cliArgs[0], "--config", runtimeConfigPath, ...cliArgs.slice(1)];

  const exitCode = await runCommand(
    process.execPath,
    [sharedTauriCliEntry, ...tauriArgs],
    {
      NODE_PATH: existingNodePath,
      npm_config_optional: "true",
      CARGO_TARGET_DIR: tauriCargoTargetDir,
      OVERLAYTERM_VITE_OUT_DIR: frontendDist,
    }
  );

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
