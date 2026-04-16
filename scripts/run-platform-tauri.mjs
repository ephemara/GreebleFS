import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const isDirectScriptRun = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;
const sharedNodeModules = path.join(projectRoot, "node_modules");
const sharedTauriCliDir = path.join(sharedNodeModules, "@tauri-apps", "cli");
const sharedTauriCliEntry = path.join(sharedTauriCliDir, "tauri.js");
const cacheRoot = path.join(os.homedir(), ".cache", "greeblefs-tauri");
const hasExplicitArtifactRoot = Boolean(
  process.env.GREEBLEFS_VPS_ARTIFACTS_ROOT || process.env.OVERLAYTERM_VPS_ARTIFACTS_ROOT,
);
const artifactRoot = hasExplicitArtifactRoot
  ? path.resolve(process.env.GREEBLEFS_VPS_ARTIFACTS_ROOT || process.env.OVERLAYTERM_VPS_ARTIFACTS_ROOT)
  : cacheRoot;
const defaultFrontendDist = hasExplicitArtifactRoot
  ? path.join(artifactRoot, "dist")
  : path.join(projectRoot, "dist");
const defaultCargoTargetDir = hasExplicitArtifactRoot
  ? path.join(artifactRoot, "cargo-target", "tauri")
  : path.join(projectRoot, "src-tauri", "target");
const cacheNodeModules = path.join(cacheRoot, "node_modules");
const frontendDist = process.env.GREEBLEFS_TAURI_FRONTEND_DIST || process.env.OVERLAYTERM_TAURI_FRONTEND_DIST
  ? path.resolve(process.env.GREEBLEFS_TAURI_FRONTEND_DIST || process.env.OVERLAYTERM_TAURI_FRONTEND_DIST)
  : defaultFrontendDist;
const tauriConfigDir = process.env.GREEBLEFS_TAURI_CONFIG_DIR || process.env.OVERLAYTERM_TAURI_CONFIG_DIR
  ? path.resolve(process.env.GREEBLEFS_TAURI_CONFIG_DIR || process.env.OVERLAYTERM_TAURI_CONFIG_DIR)
  : path.join(artifactRoot, "tauri-config");
const tauriCargoTargetDir =
  process.env.CARGO_TARGET_DIR ??
  process.env.GREEBLEFS_TAURI_CARGO_TARGET_DIR ??
  process.env.OVERLAYTERM_TAURI_CARGO_TARGET_DIR ??
  defaultCargoTargetDir;

const devManagedContentDirectoryEnvKeys = {
  plugins: { primary: "VITE_GREEBLEFS_PLUGINS_DIR", legacy: "VITE_OVERLAYTERM_PLUGINS_DIR" },
  themes: { primary: "VITE_GREEBLEFS_THEMES_DIR", legacy: "VITE_OVERLAYTERM_THEMES_DIR" },
  shaders: { primary: "VITE_GREEBLEFS_SHADERS_DIR", legacy: "VITE_OVERLAYTERM_SHADERS_DIR" },
  animations: { primary: "VITE_GREEBLEFS_ANIMATIONS_DIR", legacy: "VITE_OVERLAYTERM_ANIMATIONS_DIR" },
  wallpapers: { primary: "VITE_GREEBLEFS_WALLPAPERS_DIR", legacy: "VITE_OVERLAYTERM_WALLPAPERS_DIR" },
  notes: { primary: "VITE_GREEBLEFS_NOTES_DIR", legacy: "VITE_OVERLAYTERM_NOTES_DIR" },
};

const devManagedContentDirectoryNames = {
  plugins: "plugins",
  themes: "themes",
  shaders: "shaders",
  animations: "animations",
  wallpapers: "wallpapers",
  notes: "notes",
};

function hasExplicitEnvValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildLinuxGraphicsEnvironment({
  tauriCommand,
  existingEnv = process.env,
  platform = process.platform,
} = {}) {
  if (platform !== "linux" || tauriCommand !== "dev") {
    return {};
  }

  const display = existingEnv.DISPLAY?.trim() || "";
  const waylandDisplay = existingEnv.WAYLAND_DISPLAY?.trim() || "";
  const sessionType = existingEnv.XDG_SESSION_TYPE?.trim().toLowerCase() || "";
  const hasDisplay = display.length > 0;
  const hasWaylandDisplay = waylandDisplay.length > 0;

  if (!hasDisplay && !hasWaylandDisplay) {
    throw new Error(
      "Native Tauri dev mode requires a graphical Linux session. No DISPLAY or WAYLAND_DISPLAY environment variable was found. Start a desktop session, or forward one into this shell before running `bun run tauri dev`."
    );
  }

  if (hasExplicitEnvValue(existingEnv.GDK_BACKEND)) {
    return {};
  }

  if (sessionType === "wayland" && hasWaylandDisplay) {
    return { GDK_BACKEND: "wayland" };
  }

  if (sessionType === "x11" && hasDisplay) {
    return { GDK_BACKEND: "x11" };
  }

  if (hasWaylandDisplay && hasDisplay) {
    return { GDK_BACKEND: "wayland,x11" };
  }

  if (hasWaylandDisplay) {
    return { GDK_BACKEND: "wayland" };
  }

  return { GDK_BACKEND: "x11" };
}

export function buildManagedContentDirectoryEnvironment({
  tauriCommand,
  projectRootPath = projectRoot,
  existingEnv = process.env,
} = {}) {
  if (tauriCommand !== "dev") {
    return {};
  }

  const managedContentEnvironment = {};

  for (const [directoryId, envKeys] of Object.entries(devManagedContentDirectoryEnvKeys)) {
    if (hasExplicitEnvValue(existingEnv[envKeys.primary]) || hasExplicitEnvValue(existingEnv[envKeys.legacy])) {
      continue;
    }

    const directoryPath = path.join(
      projectRootPath,
      devManagedContentDirectoryNames[directoryId],
    );
    managedContentEnvironment[envKeys.primary] = directoryPath;
    managedContentEnvironment[envKeys.legacy] = directoryPath;
  }

  return managedContentEnvironment;
}

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

async function writeRuntimeTauriConfig(packageManagerCommand, tauriCommand) {
  const tauriConfigPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
  const rawConfig = await fs.readFile(tauriConfigPath, "utf8");
  const config = JSON.parse(rawConfig);
  const runtimeConfigPath = path.join(tauriConfigDir, "tauri.vps.config.json");
  const runPrefix = `${packageManagerCommand} run`;
  const explicitDevUrl = (process.env.GREEBLEFS_TAURI_DEV_URL || process.env.OVERLAYTERM_TAURI_DEV_URL)?.trim();
  const explicitDevPort = (process.env.GREEBLEFS_TAURI_DEV_PORT || process.env.OVERLAYTERM_TAURI_DEV_PORT)?.trim();
  const isDevCommand = tauriCommand === "dev";
  const resolvedDevPort = explicitDevPort || "1420";
  const resolvedDevUrl = isDevCommand
    ? explicitDevUrl || `http://localhost:${resolvedDevPort}`
    : null;
  const beforeDevCommand = explicitDevPort
    ? `${runPrefix} dev -- --port ${explicitDevPort}`
    : `${runPrefix} dev`;

  config.build = {
    ...config.build,
    beforeDevCommand,
    beforeBuildCommand: `${runPrefix} build`,
    frontendDist,
  };

  if (resolvedDevUrl) {
    config.build.devUrl = resolvedDevUrl;
  } else {
    delete config.build.devUrl;
  }

  await fs.mkdir(tauriConfigDir, { recursive: true });
  await fs.writeFile(runtimeConfigPath, `${JSON.stringify(config, null, 2)}\n`);
  return runtimeConfigPath;
}

function runCommand(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const useShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: useShell,
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

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
    shell: false,
  });
  return !result.error && result.status === 0;
}

function getPackageManagerCommand() {
  const explicit = (process.env.GREEBLEFS_PACKAGE_MANAGER || process.env.OVERLAYTERM_PACKAGE_MANAGER)?.trim();
  const bunCommand = process.platform === "win32" ? "bun.exe" : "bun";
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  if (explicit) {
    return explicit;
  }

  if (commandExists(bunCommand)) {
    return bunCommand;
  }

  return npmCommand;
}

async function readSharedCliVersion() {
  const packageJsonPath = path.join(sharedTauriCliDir, "package.json");

  if (!(await pathExists(packageJsonPath))) {
    throw new Error(
      "Shared @tauri-apps/cli package is missing. Run bun install in GreebleFS first."
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

  const packageManager = getPackageManagerCommand();
  const installArgs = packageManager.includes("bun")
    ? ["add", "--no-save", "--cwd", cacheRoot, `${nativeBinding}@${cliVersion}`]
    : ["install", "--no-save", "--prefix", cacheRoot, `${nativeBinding}@${cliVersion}`];
  const installCode = await runCommand(packageManager, installArgs);

  if (installCode !== 0) {
    process.exit(installCode);
  }
}

async function main() {
  if (!(await pathExists(sharedTauriCliEntry))) {
    throw new Error(
      "Shared Tauri CLI entrypoint is missing. Run bun install in GreebleFS first."
    );
  }

  await ensureNativeBindingAvailable();
  await fs.mkdir(frontendDist, { recursive: true });
  const packageManagerCommand = getPackageManagerCommand();
  const cliArgs = process.argv.slice(2);
  const tauriCommand = cliArgs.find((arg) => !arg.startsWith("-")) ?? null;
  const linuxGraphicsEnvironment = buildLinuxGraphicsEnvironment({ tauriCommand });
  const existingNodePath = process.env.NODE_PATH
    ? `${cacheNodeModules}${path.delimiter}${process.env.NODE_PATH}`
    : cacheNodeModules;
  const hasExplicitConfig = cliArgs.includes("--config") || cliArgs.includes("-c");
  const runtimeConfigPath = await writeRuntimeTauriConfig(packageManagerCommand, tauriCommand);
  const tauriArgs = hasExplicitConfig
    ? cliArgs
    : cliArgs.length === 0
      ? ["--config", runtimeConfigPath]
      : [cliArgs[0], "--config", runtimeConfigPath, ...cliArgs.slice(1)];

  const exitCode = await runCommand(
    process.execPath,
    [sharedTauriCliEntry, ...tauriArgs],
    {
      NODE_PATH: existingNodePath,
      npm_config_optional: "true",
      CARGO_TARGET_DIR: tauriCargoTargetDir,
      GREEBLEFS_VITE_OUT_DIR: frontendDist,
      OVERLAYTERM_VITE_OUT_DIR: frontendDist,
      ...linuxGraphicsEnvironment,
      ...buildManagedContentDirectoryEnvironment({ tauriCommand }),
    }
  );

  process.exit(exitCode);
}

if (isDirectScriptRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
