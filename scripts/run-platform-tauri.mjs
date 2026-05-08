import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { cleanupGreeblefsDevProcesses } from "./cleanup-dev-processes.mjs";
import { assertTauronForkAvailable } from "./tauron-preflight.mjs";
import { getUsrEntrySourcePath, getUsrManagedContentEntries } from "./usr-manifest.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const isDirectScriptRun = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;
const sharedNodeModules = path.join(projectRoot, "node_modules");
const sharedTauriCliDir = path.join(sharedNodeModules, "@tauri-apps", "cli");
const sharedTauriCliEntry = path.join(sharedTauriCliDir, "tauri.js");
const srcTauriRoot = path.join(projectRoot, "src-tauri");
const defaultWorkspaceCargoTargetDir = path.join(projectRoot, "target");
const cacheRoot = path.join(os.homedir(), ".cache", "greeblefs-tauri");
const defaultWindowsReleaseArtifactRoot = path.join(defaultWorkspaceCargoTargetDir, "release-support");
const windowsReleaseInstallerAliasFileName = "GreebleFS Setup.exe";
const hasExplicitArtifactRoot = Boolean(
  process.env.GREEBLEFS_VPS_ARTIFACTS_ROOT || process.env.OVERLAYTERM_VPS_ARTIFACTS_ROOT,
);
const artifactRoot = hasExplicitArtifactRoot
  ? path.resolve(process.env.GREEBLEFS_VPS_ARTIFACTS_ROOT || process.env.OVERLAYTERM_VPS_ARTIFACTS_ROOT)
  : cacheRoot;
const defaultFrontendDist = hasExplicitArtifactRoot
  ? path.join(artifactRoot, "dist")
  : path.join(projectRoot, "dist");
const defaultRepoMobileShareBundleDist = path.join(projectRoot, "dist-mobile");
const defaultArtifactMobileShareBundleDist = process.platform === "win32" && !hasExplicitArtifactRoot
  ? path.join(defaultWindowsReleaseArtifactRoot, "dist-mobile")
  : path.join(artifactRoot, "dist-mobile");
const defaultCargoTargetDir = hasExplicitArtifactRoot
  ? path.join(artifactRoot, "cargo-target", "tauri")
  : defaultWorkspaceCargoTargetDir;
const cacheNodeModules = path.join(cacheRoot, "node_modules");
const defaultViteCacheDir = path.join(cacheRoot, "vite", "desktop");
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
const spectaBindingsGeneratedRelativePath = path.join("src", "generated", "tauri.ts");
const spectaBindingsGeneratedPath = path.join(projectRoot, spectaBindingsGeneratedRelativePath);
const spectaBindingsCacheDirectory = path.join(tauriCargoTargetDir, "dev-cache");
const spectaBindingsCachePath = path.join(spectaBindingsCacheDirectory, "specta-bindings-state.json");
const spectaBindingsCacheVersion = 1;
const goRuntimeAssetsCachePath = path.join(spectaBindingsCacheDirectory, "go-runtime-assets-state.json");
const goRuntimeAssetsCacheVersion = 1;
const mobileShareBundleCachePath = path.join(spectaBindingsCacheDirectory, "mobile-share-bundle-state.json");
const mobileShareBundleCacheVersion = 1;
const kainToolchainPayloadRoot = path.join(projectRoot, "toolchains", "kain", "payload");
const kainRuntimeSourceRoot = path.join(projectRoot, "src-kain", "runtimes");
const kainAppSourceRoot = path.join(projectRoot, "src-kain", "app");
const nodeRuntimeSourceRoot = path.join(projectRoot, "src-node", "builtin-runtimes");
const spectaBindingsFingerprintTargets = [
  { kind: "file", relativePath: "Cargo.toml" },
  { kind: "file", relativePath: "Cargo.lock" },
  { kind: "file", relativePath: path.join("src-tauri", "Cargo.toml") },
  { kind: "file", relativePath: path.join("src-tauri", "build.rs") },
  { kind: "directory", relativePath: path.join("src-tauri", "src"), extension: ".rs" },
  { kind: "directory", relativePath: path.join("crates", "overlay-contracts"), extension: ".rs" },
  { kind: "directory", relativePath: path.join("crates", "yazi-specta"), extension: ".rs" },
  { kind: "directory", relativePath: path.join("crates", "greeble-ipc-contracts"), extension: ".rs" },
];
const goRuntimeAssetsFingerprintTargets = [
  { kind: "file", relativePath: path.join("scripts", "go", "bootstrap.sh") },
  { kind: "file", relativePath: path.join("scripts", "go", "_common.sh") },
  { kind: "directory", relativePath: "src-go" },
];
const mobileShareBundleFingerprintTargets = [
  { kind: "file", relativePath: "package.json" },
  { kind: "file", relativePath: "bun.lock" },
  { kind: "file", relativePath: "vite.mobile.config.ts" },
  { kind: "file", relativePath: "tsconfig.json" },
  { kind: "directory", relativePath: "src-mobile" },
];

const usrRootEnvironmentKeys = {
  frontendPrimary: "VITE_GREEBLEFS_USR_DIR",
  frontendLegacy: "VITE_OVERLAYTERM_USR_DIR",
  nativePrimary: "GREEBLEFS_USR_DIR",
  nativeLegacy: "OVERLAYTERM_USR_DIR",
};

const managedContentRootEnvironmentKeys = {
  primary: "GREEBLEFS_MANAGED_CONTENT_ROOT",
  legacy: "OVERLAYTERM_MANAGED_CONTENT_ROOT",
};

const devRuntimeStateDirectoryEnvKeys = {
  notes: { primary: "VITE_GREEBLEFS_NOTES_DIR", legacy: "VITE_OVERLAYTERM_NOTES_DIR" },
};

const devRuntimeStateDirectoryNames = {
  notes: "notes",
};
const mcpRoot = path.join(projectRoot, "MCP");
const mcpStateDirectory = path.join(mcpRoot, ".state");
const mcpTauriDevStatusPath = path.join(mcpStateDirectory, "tauri-dev-session.json");
const mcpTauriDevLogPath = path.join(mcpStateDirectory, "tauri-dev.log");
const mcpNativeAutomationSessionPath = path.join(mcpStateDirectory, "greeblefs-native-automation.json");
const mcpTauronWebviewDiagnosticsPath = path.join(mcpStateDirectory, "tauron-webview2-session.json");
const defaultMcpWebviewDebugPort = (
  process.env.GREEBLEFS_MCP_WEBVIEW2_DEBUG_PORT
  || process.env.OVERLAYTERM_MCP_WEBVIEW2_DEBUG_PORT
  || "9222"
).trim();

function hasExplicitEnvValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePathForLogs(value) {
  return value.replace(/\\/g, "/");
}

function formatBundleDirectoryResourcePath(directoryPath) {
  return `${directoryPath.replace(/\\/g, "/").replace(/\/+$/, "")}/`;
}

function formatProjectPathForTauriConfig(targetPath, pathLabel) {
  const relativePath = path.relative(srcTauriRoot, targetPath);
  if (path.isAbsolute(relativePath)) {
    throw new Error(
      `${pathLabel} must stay on the same drive as src-tauri so Tauri can bundle it correctly. Received ${normalizePathForLogs(targetPath)}.`,
    );
  }

  return normalizePathForLogs(relativePath || ".");
}

function formatBundleDirectoryResourcePathForTauriProject(directoryPath) {
  return formatBundleDirectoryResourcePath(
    formatProjectPathForTauriConfig(directoryPath, "bundle resource directory"),
  );
}

function resolveMobileShareBundleDist(tauriCommand, existingEnv = process.env) {
  const explicitMobileOutDir = (
    existingEnv.GREEBLEFS_VITE_MOBILE_OUT_DIR
    || existingEnv.OVERLAYTERM_VITE_MOBILE_OUT_DIR
  )?.trim();
  if (explicitMobileOutDir) {
    return path.resolve(explicitMobileOutDir);
  }

  return tauriCommand === "build"
    ? defaultArtifactMobileShareBundleDist
    : defaultRepoMobileShareBundleDist;
}

function resolveTauriFrontendDevUrl(existingEnv = process.env) {
  const explicitDevUrl = (existingEnv.GREEBLEFS_TAURI_DEV_URL || existingEnv.OVERLAYTERM_TAURI_DEV_URL)?.trim();
  const explicitDevPort = (existingEnv.GREEBLEFS_TAURI_DEV_PORT || existingEnv.OVERLAYTERM_TAURI_DEV_PORT)?.trim();
  const resolvedDevPort = explicitDevPort || "1420";
  return explicitDevUrl || `http://localhost:${resolvedDevPort}`;
}

function appendBrowserArgument(existingArguments, argument) {
  const trimmedExistingArguments = existingArguments?.trim() || "";
  if (!trimmedExistingArguments) {
    return argument;
  }
  if (trimmedExistingArguments.includes(argument)) {
    return trimmedExistingArguments;
  }
  return `${trimmedExistingArguments} ${argument}`;
}

function buildMcpDevelopmentEnvironment({
  tauriCommand,
  existingEnv = process.env,
  platform = process.platform,
} = {}) {
  if (tauriCommand !== "dev") {
    return {
      environment: {},
      session: null,
    };
  }

  const frontendDevUrl = resolveTauriFrontendDevUrl(existingEnv);
  const webviewDebugPort = (
    existingEnv.GREEBLEFS_MCP_WEBVIEW2_DEBUG_PORT
    || existingEnv.OVERLAYTERM_MCP_WEBVIEW2_DEBUG_PORT
    || defaultMcpWebviewDebugPort
  ).trim();
  const environment = {
    GREEBLEFS_MCP_ENABLED: "1",
    OVERLAYTERM_MCP_ENABLED: "1",
    VITE_GREEBLEFS_MCP_ENABLED: "1",
    VITE_OVERLAYTERM_MCP_ENABLED: "1",
    GREEBLEFS_MCP_STATUS_FILE: mcpTauriDevStatusPath,
    OVERLAYTERM_MCP_STATUS_FILE: mcpTauriDevStatusPath,
    GREEBLEFS_MCP_LOG_FILE: mcpTauriDevLogPath,
    OVERLAYTERM_MCP_LOG_FILE: mcpTauriDevLogPath,
    GREEBLEFS_MCP_FRONTEND_DEV_URL: frontendDevUrl,
    OVERLAYTERM_MCP_FRONTEND_DEV_URL: frontendDevUrl,
    GREEBLEFS_MCP_WEBVIEW2_DEBUG_PORT: webviewDebugPort,
    OVERLAYTERM_MCP_WEBVIEW2_DEBUG_PORT: webviewDebugPort,
    GREEBLEFS_MCP_NATIVE_AUTOMATION_FILE: mcpNativeAutomationSessionPath,
    OVERLAYTERM_MCP_NATIVE_AUTOMATION_FILE: mcpNativeAutomationSessionPath,
  };

  if (platform === "win32" && webviewDebugPort) {
    environment.TAURON_WEBVIEW2_REMOTE_DEBUGGING_PORT = webviewDebugPort;
    environment.TAURON_WEBVIEW2_DIAGNOSTICS_FILE = mcpTauronWebviewDiagnosticsPath;
    environment.TAURON_WEBVIEW2_LOG = "1";

    const tauronAdditionalBrowserArgs = (
      existingEnv.GREEBLEFS_MCP_WEBVIEW2_BROWSER_ARGS
      || existingEnv.OVERLAYTERM_MCP_WEBVIEW2_BROWSER_ARGS
      || existingEnv.TAURON_WEBVIEW2_ADDITIONAL_BROWSER_ARGS
    )?.trim();
    if (tauronAdditionalBrowserArgs) {
      environment.TAURON_WEBVIEW2_ADDITIONAL_BROWSER_ARGS = tauronAdditionalBrowserArgs;
    }

    if (hasExplicitEnvValue(existingEnv.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS)) {
      environment.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS =
        existingEnv.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS.trim();
    }
  }

  return {
    environment,
    session: {
      projectRoot: normalizePathForLogs(projectRoot),
      statusFilePath: normalizePathForLogs(mcpTauriDevStatusPath),
      logFilePath: normalizePathForLogs(mcpTauriDevLogPath),
      nativeAutomationFilePath: normalizePathForLogs(mcpNativeAutomationSessionPath),
      frontendDevUrl,
      webviewDebugPort,
      tauronWebviewDiagnosticsPath: platform === "win32"
        ? normalizePathForLogs(mcpTauronWebviewDiagnosticsPath)
        : null,
    },
  };
}

async function ensureMcpStateDirectory() {
  await fs.mkdir(mcpStateDirectory, { recursive: true });
}

async function writeMcpTauriSessionFile(sessionState) {
  await ensureMcpStateDirectory();
  await fs.writeFile(
    mcpTauriDevStatusPath,
    `${JSON.stringify({
      version: 1,
      product: "GreebleFS",
      ...sessionState,
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    "utf8",
  );
}

function formatTauriDevLogChunk(streamName, chunk) {
  const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  if (!text) {
    return "";
  }
  const isoTimestamp = new Date().toISOString();
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line, index, lines) => {
      if (!line && index === lines.length - 1) {
        return "";
      }
      return `[${isoTimestamp}] [${streamName}] ${line}`;
    })
    .filter(Boolean)
    .join("\n") + "\n";
}

function setEnvironmentPairIfMissing(targetEnvironment, existingEnv, keys, value) {
  if (hasExplicitEnvValue(existingEnv[keys.primary]) || hasExplicitEnvValue(existingEnv[keys.legacy])) {
    return;
  }

  targetEnvironment[keys.primary] = value;
  targetEnvironment[keys.legacy] = value;
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

  if (
    hasExplicitEnvValue(existingEnv.GREEBLEFS_LINUX_DISPLAY_BACKEND)
    || hasExplicitEnvValue(existingEnv.OVERLAYTERM_LINUX_DISPLAY_BACKEND)
  ) {
    return {};
  }

  if (sessionType === "wayland" && hasWaylandDisplay) {
    return hasDisplay ? {} : { GDK_BACKEND: "wayland" };
  }

  if (sessionType === "x11" && hasDisplay) {
    return hasWaylandDisplay ? {} : { GDK_BACKEND: "x11" };
  }

  if (hasWaylandDisplay && hasDisplay) {
    return {};
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
  const canonicalUsrRoot = path.join(projectRootPath, "usr");

  setEnvironmentPairIfMissing(
    managedContentEnvironment,
    existingEnv,
    {
      primary: usrRootEnvironmentKeys.frontendPrimary,
      legacy: usrRootEnvironmentKeys.frontendLegacy,
    },
    canonicalUsrRoot,
  );
  setEnvironmentPairIfMissing(
    managedContentEnvironment,
    existingEnv,
    {
      primary: usrRootEnvironmentKeys.nativePrimary,
      legacy: usrRootEnvironmentKeys.nativeLegacy,
    },
    canonicalUsrRoot,
  );
  setEnvironmentPairIfMissing(
    managedContentEnvironment,
    existingEnv,
    managedContentRootEnvironmentKeys,
    canonicalUsrRoot,
  );

  for (const entry of getUsrManagedContentEntries()) {
    const envKeys = {
      primary: `VITE_GREEBLEFS_${entry.envVarSuffix}_DIR`,
      legacy: `VITE_OVERLAYTERM_${entry.envVarSuffix}_DIR`,
    };
    const directoryPath = getUsrEntrySourcePath(entry, { projectRootPath });
    setEnvironmentPairIfMissing(managedContentEnvironment, existingEnv, envKeys, directoryPath);
  }

  for (const [directoryId, envKeys] of Object.entries(devRuntimeStateDirectoryEnvKeys)) {
    const directoryPath = path.join(projectRootPath, devRuntimeStateDirectoryNames[directoryId]);
    setEnvironmentPairIfMissing(managedContentEnvironment, existingEnv, envKeys, directoryPath);
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

async function collectDirectoryFilesRecursively(rootPath, extension, matchingFiles = []) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      await collectDirectoryFilesRecursively(entryPath, extension, matchingFiles);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!extension || entry.name.endsWith(extension)) {
      matchingFiles.push(entryPath);
    }
  }

  return matchingFiles;
}

async function resolveFingerprintFiles(fingerprintTargets) {
  const resolvedFiles = new Set();

  for (const target of fingerprintTargets) {
    const absolutePath = path.join(projectRoot, target.relativePath);
    if (!(await pathExists(absolutePath))) {
      continue;
    }

    if (target.kind === "file") {
      resolvedFiles.add(absolutePath);
      continue;
    }

    const directoryFiles = await collectDirectoryFilesRecursively(absolutePath, target.extension);
    for (const filePath of directoryFiles) {
      resolvedFiles.add(filePath);
    }
  }

  return [...resolvedFiles].sort((left, right) => left.localeCompare(right));
}

async function computeFingerprintForTargets(fingerprintTargets) {
  const inputFiles = await resolveFingerprintFiles(fingerprintTargets);
  const hash = createHash("sha256");

  for (const absolutePath of inputFiles) {
    const relativePath = normalizePathForLogs(path.relative(projectRoot, absolutePath));
    const contents = await fs.readFile(absolutePath);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }

  return {
    fingerprint: hash.digest("hex"),
    inputFiles,
  };
}

async function computeSpectaBindingsFingerprint() {
  return computeFingerprintForTargets(spectaBindingsFingerprintTargets);
}

async function readJsonCacheState(cachePath) {
  if (!(await pathExists(cachePath))) {
    return null;
  }

  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch {
    return null;
  }
}

async function readSpectaBindingsCacheState() {
  return readJsonCacheState(spectaBindingsCachePath);
}

async function outputPathsExist(outputPaths) {
  for (const outputPath of outputPaths) {
    if (!(await pathExists(outputPath))) {
      return false;
    }
  }
  return true;
}

async function getNewestFileMtimeMs(filePaths) {
  let newestMtimeMs = 0;
  for (const filePath of filePaths) {
    const stats = await fs.stat(filePath);
    newestMtimeMs = Math.max(newestMtimeMs, stats.mtimeMs);
  }
  return newestMtimeMs;
}

async function getOldestFileMtimeMs(filePaths) {
  let oldestMtimeMs = Number.POSITIVE_INFINITY;
  for (const filePath of filePaths) {
    const stats = await fs.stat(filePath);
    oldestMtimeMs = Math.min(oldestMtimeMs, stats.mtimeMs);
  }
  return oldestMtimeMs;
}

async function shouldPrepareFingerprintCachedAsset({
  cachePath,
  cacheVersion,
  fingerprintTargets,
  outputPaths,
  forceEnvKeys = [],
  seedCacheWhenOutputsLookFresh = false,
  seedCacheWhenOutputsArePresent = false,
}) {
  const forceRequested = forceEnvKeys.some((envKey) => hasExplicitEnvValue(process.env[envKey]));
  const { fingerprint, inputFiles } = await computeFingerprintForTargets(fingerprintTargets);
  const cachedState = await readJsonCacheState(cachePath);
  const outputsArePresent = await outputPathsExist(outputPaths);
  const cacheIsCurrent =
    outputsArePresent
    && cachedState?.version === cacheVersion
    && cachedState?.fingerprint === fingerprint;
  const outputsLookFresh = outputsArePresent
    && inputFiles.length > 0
    && await getNewestFileMtimeMs(inputFiles) <= await getOldestFileMtimeMs(outputPaths);
  const shouldSeedCache = !forceRequested
    && !cacheIsCurrent
    && (
      (seedCacheWhenOutputsLookFresh && outputsLookFresh)
      || (seedCacheWhenOutputsArePresent && outputsArePresent)
    );

  return {
    fingerprint,
    inputFiles,
    outputsArePresent,
    shouldPrepare: forceRequested || (!cacheIsCurrent && !shouldSeedCache),
    shouldSeedCache,
  };
}

async function writeFingerprintCacheState({
  cachePath,
  cacheVersion,
  fingerprint,
  inputFiles,
  outputPaths,
}) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(
    cachePath,
    `${JSON.stringify({
      version: cacheVersion,
      fingerprint,
      inputFileCount: inputFiles.length,
      outputPaths: outputPaths.map((outputPath) =>
        normalizePathForLogs(path.relative(projectRoot, outputPath) || outputPath)
      ),
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
  );
}

async function writeSpectaBindingsCacheState({ fingerprint, inputFiles }) {
  await fs.mkdir(spectaBindingsCacheDirectory, { recursive: true });
  await fs.writeFile(
    spectaBindingsCachePath,
    `${JSON.stringify({
      version: spectaBindingsCacheVersion,
      fingerprint,
      generatedBindingsPath: normalizePathForLogs(spectaBindingsGeneratedRelativePath),
      inputFileCount: inputFiles.length,
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
  );
}

async function shouldPrepareSpectaBindings() {
  const generatedBindingsExist = await pathExists(spectaBindingsGeneratedPath);
  const { fingerprint, inputFiles } = await computeSpectaBindingsFingerprint();
  const cachedState = await readSpectaBindingsCacheState();
  const cacheIsCurrent =
    generatedBindingsExist
    && cachedState?.version === spectaBindingsCacheVersion
    && cachedState?.fingerprint === fingerprint;

  return {
    fingerprint,
    inputFiles,
    shouldPrepare: !cacheIsCurrent,
  };
}

function buildWindowsRustAccelerationEnvironment({
  existingEnv = process.env,
  platform = process.platform,
} = {}) {
  if (platform !== "win32") {
    return {};
  }

  const windowsRustEnvironment = {};
  const hasSccache = commandExists("sccache");
  const hasClangCl = commandExists("clang-cl");
  const hasLldLink = commandExists("lld-link");
  const canUseLlvmFastLink = hasClangCl && hasLldLink;

  if (hasSccache && !hasExplicitEnvValue(existingEnv.RUSTC_WRAPPER)) {
    windowsRustEnvironment.RUSTC_WRAPPER = "sccache";
  }

  if (!canUseLlvmFastLink) {
    return windowsRustEnvironment;
  }

  if (!hasExplicitEnvValue(existingEnv.CC)) {
    windowsRustEnvironment.CC = "clang-cl";
  }

  if (!hasExplicitEnvValue(existingEnv.CXX)) {
    windowsRustEnvironment.CXX = "clang-cl";
  }

  if (!hasExplicitEnvValue(existingEnv.CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER)) {
    windowsRustEnvironment.CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = "lld-link";
  }

  return windowsRustEnvironment;
}

async function writeRuntimeTauriConfig(packageManagerCommand, tauriCommand) {
  const tauriConfigPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
  const rawConfig = await fs.readFile(tauriConfigPath, "utf8");
  const config = JSON.parse(rawConfig);
  const runtimeConfigPath = path.join(tauriConfigDir, "tauri.vps.config.json");
  const mobileShareBundleDist = resolveMobileShareBundleDist(tauriCommand);
  const runtimeFrontendDist = formatProjectPathForTauriConfig(frontendDist, "frontendDist");
  const runPrefix = `${packageManagerCommand} run`;
  const explicitDevUrl = (process.env.GREEBLEFS_TAURI_DEV_URL || process.env.OVERLAYTERM_TAURI_DEV_URL)?.trim();
  const explicitDevPort = (process.env.GREEBLEFS_TAURI_DEV_PORT || process.env.OVERLAYTERM_TAURI_DEV_PORT)?.trim();
  const isDevCommand = tauriCommand === "dev";
  const resolvedDevPort = explicitDevPort || "1420";
  const resolvedDevUrl = isDevCommand
    ? explicitDevUrl || `http://localhost:${resolvedDevPort}`
    : null;
  const beforeDevCommand = explicitDevPort
    ? `${runPrefix} dev:frontend -- --port ${explicitDevPort}`
    : `${runPrefix} dev:frontend`;

  config.build = {
    ...config.build,
    beforeDevCommand,
    beforeBuildCommand: `${runPrefix} build`,
    frontendDist: runtimeFrontendDist,
  };

  if (config.bundle?.resources && !Array.isArray(config.bundle.resources)) {
    const rewrittenResources = {};
    for (const [resourceSource, resourceDestination] of Object.entries(config.bundle.resources)) {
      if (resourceSource === "../dist-mobile/" || resourceSource === "../dist-mobile") {
        rewrittenResources[formatBundleDirectoryResourcePathForTauriProject(mobileShareBundleDist)] = resourceDestination;
      } else {
        rewrittenResources[resourceSource] = resourceDestination;
      }
    }
    config.bundle = {
      ...config.bundle,
      resources: rewrittenResources,
    };
    if (await pathExists(kainToolchainPayloadRoot)) {
      config.bundle.resources[formatBundleDirectoryResourcePathForTauriProject(kainToolchainPayloadRoot)] = "toolchains/kain/";
    }
    if (await pathExists(kainRuntimeSourceRoot)) {
      config.bundle.resources[formatBundleDirectoryResourcePathForTauriProject(kainRuntimeSourceRoot)] = "runtimes/kain/";
    }
    if (await pathExists(kainAppSourceRoot)) {
      config.bundle.resources[formatBundleDirectoryResourcePathForTauriProject(kainAppSourceRoot)] = "src-kain/app/";
    }
    if (await pathExists(nodeRuntimeSourceRoot)) {
      config.bundle.resources[formatBundleDirectoryResourcePathForTauriProject(nodeRuntimeSourceRoot)] = "runtimes/node/";
    }
  }

  if (resolvedDevUrl) {
    config.build.devUrl = resolvedDevUrl;
  } else {
    delete config.build.devUrl;
  }

  await fs.mkdir(tauriConfigDir, { recursive: true });
  await fs.writeFile(runtimeConfigPath, `${JSON.stringify(config, null, 2)}\n`);
  return runtimeConfigPath;
}

async function prepareTauriDevBindings(packageManagerCommand, tauriCommand, extraEnv = {}) {
  if (tauriCommand !== "dev") {
    return;
  }

  const bindingsMode = (
    process.env.GREEBLEFS_TAURI_BINDINGS_MODE
    || process.env.OVERLAYTERM_TAURI_BINDINGS_MODE
    || "missing"
  ).trim().toLowerCase();
  const generatedBindingsExist = await pathExists(spectaBindingsGeneratedPath);
  if (bindingsMode === "off" || bindingsMode === "skip") {
    console.log("Specta bindings prep disabled, skipping.");
    return;
  }
  if (bindingsMode === "missing" && generatedBindingsExist) {
    console.log("Specta bindings present, skipping automatic export.");
    return;
  }

  const preparationState = await shouldPrepareSpectaBindings();
  if (bindingsMode !== "always" && !preparationState.shouldPrepare) {
    console.log("Specta bindings up to date, skipping.");
    return;
  }

  console.log("Preparing Specta bindings before Tauri dev...");
  const prepareExitCode = await runCommand(
    packageManagerCommand,
    ["run", "bindings:generate"],
    extraEnv,
  );
  if (prepareExitCode !== 0) {
    process.exit(prepareExitCode);
  }

  await writeSpectaBindingsCacheState(preparationState);
}

async function prepareGoRuntimeAssets(packageManagerCommand, tauriCommand) {
  if (tauriCommand !== "dev" && tauriCommand !== "build") {
    return;
  }

  const outputPaths = [path.join(projectRoot, "public", "runtime", "wasm_exec.js")];
  const preparationState = await shouldPrepareFingerprintCachedAsset({
    cachePath: goRuntimeAssetsCachePath,
    cacheVersion: goRuntimeAssetsCacheVersion,
    fingerprintTargets: goRuntimeAssetsFingerprintTargets,
    outputPaths,
    forceEnvKeys: ["GREEBLEFS_FORCE_GO_BOOTSTRAP", "OVERLAYTERM_FORCE_GO_BOOTSTRAP"],
    seedCacheWhenOutputsArePresent: true,
  });
  if (!preparationState.shouldPrepare) {
    if (preparationState.shouldSeedCache) {
      await writeFingerprintCacheState({
        cachePath: goRuntimeAssetsCachePath,
        cacheVersion: goRuntimeAssetsCacheVersion,
        fingerprint: preparationState.fingerprint,
        inputFiles: preparationState.inputFiles,
        outputPaths,
      });
    }
    console.log("Go runtime assets up to date, skipping.");
    return;
  }

  console.log("Preparing Go runtime assets...");
  const bootstrapExitCode = await runCommand(packageManagerCommand, ["run", "go:bootstrap"]);
  if (bootstrapExitCode !== 0) {
    process.exit(bootstrapExitCode);
  }
  await writeFingerprintCacheState({
    cachePath: goRuntimeAssetsCachePath,
    cacheVersion: goRuntimeAssetsCacheVersion,
    fingerprint: preparationState.fingerprint,
    inputFiles: preparationState.inputFiles,
    outputPaths,
  });
}

async function prepareKainToolchainPayload(tauriCommand) {
  if (tauriCommand !== "dev" && tauriCommand !== "build") {
    return;
  }
  const stageArgs = ["scripts/kain/stage-kain-toolchain.mjs"];
  if (tauriCommand === "dev") {
    stageArgs.push("--optional");
  }
  const exitCode = await runCommand(process.execPath, stageArgs);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function prepareMobileShareBundle(packageManagerCommand, tauriCommand) {
  if (tauriCommand !== "dev") {
    return;
  }

  const mobileShareBundleDist = resolveMobileShareBundleDist(tauriCommand);
  const outputPaths = [
    path.join(mobileShareBundleDist, "index.html"),
    path.join(mobileShareBundleDist, "sw.js"),
  ];
  const preparationState = await shouldPrepareFingerprintCachedAsset({
    cachePath: mobileShareBundleCachePath,
    cacheVersion: mobileShareBundleCacheVersion,
    fingerprintTargets: mobileShareBundleFingerprintTargets,
    outputPaths,
    forceEnvKeys: ["GREEBLEFS_FORCE_MOBILE_BUILD", "OVERLAYTERM_FORCE_MOBILE_BUILD"],
    seedCacheWhenOutputsArePresent: true,
  });
  if (!preparationState.shouldPrepare) {
    if (preparationState.shouldSeedCache) {
      await writeFingerprintCacheState({
        cachePath: mobileShareBundleCachePath,
        cacheVersion: mobileShareBundleCacheVersion,
        fingerprint: preparationState.fingerprint,
        inputFiles: preparationState.inputFiles,
        outputPaths,
      });
    }
    console.log("Mobile share bundle up to date, skipping.");
    return;
  }

  console.log(
    `Preparing mobile share bundle at ${normalizePathForLogs(path.relative(projectRoot, mobileShareBundleDist) || ".")}...`
  );
  const mobileBundleExitCode = await runCommand(
    packageManagerCommand,
    ["run", "build:mobile"],
    {
      GREEBLEFS_VITE_MOBILE_OUT_DIR: mobileShareBundleDist,
      OVERLAYTERM_VITE_MOBILE_OUT_DIR: mobileShareBundleDist,
    },
  );
  if (mobileBundleExitCode !== 0) {
    process.exit(mobileBundleExitCode);
  }
  await writeFingerprintCacheState({
    cachePath: mobileShareBundleCachePath,
    cacheVersion: mobileShareBundleCacheVersion,
    fingerprint: preparationState.fingerprint,
    inputFiles: preparationState.inputFiles,
    outputPaths,
  });
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

async function findLatestNsisInstallerExecutable(bundleDirectoryPath) {
  if (!(await pathExists(bundleDirectoryPath))) {
    return null;
  }

  const installerCandidates = await Promise.all(
    (await fs.readdir(bundleDirectoryPath, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".exe"))
      .map(async (entry) => {
        const installerPath = path.join(bundleDirectoryPath, entry.name);
        const stats = await fs.stat(installerPath);
        return {
          installerPath,
          lastModifiedAt: stats.mtimeMs,
        };
      }),
  );

  installerCandidates.sort((left, right) => right.lastModifiedAt - left.lastModifiedAt);
  return installerCandidates[0]?.installerPath ?? null;
}

async function mirrorWindowsInstallerIntoReleaseRoot() {
  if (process.platform !== "win32") {
    return null;
  }

  const releaseDirectoryPath = path.join(tauriCargoTargetDir, "release");
  const nsisBundleDirectoryPath = path.join(releaseDirectoryPath, "bundle", "nsis");
  const latestInstallerPath = await findLatestNsisInstallerExecutable(nsisBundleDirectoryPath);
  if (!latestInstallerPath) {
    return null;
  }

  const versionedInstallerPath = path.join(releaseDirectoryPath, path.basename(latestInstallerPath));
  const stableInstallerPath = path.join(releaseDirectoryPath, windowsReleaseInstallerAliasFileName);

  await fs.mkdir(releaseDirectoryPath, { recursive: true });
  await fs.copyFile(latestInstallerPath, versionedInstallerPath);
  await fs.copyFile(latestInstallerPath, stableInstallerPath);

  return {
    sourceInstallerPath: latestInstallerPath,
    versionedInstallerPath,
    stableInstallerPath,
  };
}

async function runCommandWithMcpTauriDevStatus(command, args, extraEnv = {}, sessionConfig) {
  const useShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  await ensureMcpStateDirectory();
  await fs.writeFile(mcpTauriDevLogPath, "", "utf8");

  const sessionState = {
    command: [command, ...args].join(" "),
    cwd: normalizePathForLogs(projectRoot),
    running: false,
    status: "launching",
    tauriCommand: "dev",
    pid: null,
    exitCode: null,
    signal: null,
    startedAt: new Date().toISOString(),
    lastOutputAt: null,
    frontendDevUrl: sessionConfig.frontendDevUrl,
    webviewDebugPort: sessionConfig.webviewDebugPort,
    tauronWebviewDiagnosticsPath: sessionConfig.tauronWebviewDiagnosticsPath ?? null,
    nativeAutomationFilePath: sessionConfig.nativeAutomationFilePath ?? null,
    logFilePath: sessionConfig.logFilePath,
    statusFilePath: sessionConfig.statusFilePath,
  };
  await writeMcpTauriSessionFile(sessionState);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ["inherit", "pipe", "pipe"],
      shell: useShell,
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    const updateSessionState = async (nextState) => {
      Object.assign(sessionState, nextState);
      await writeMcpTauriSessionFile(sessionState);
    };

    sessionState.pid = child.pid ?? null;
    void updateSessionState({
      running: true,
      status: "running",
    }).catch(() => {});

    const handleOutputChunk = async (streamName, chunk, targetStream) => {
      targetStream.write(chunk);
      sessionState.lastOutputAt = new Date().toISOString();
      const formattedChunk = formatTauriDevLogChunk(streamName, chunk);
      if (formattedChunk) {
        await fs.appendFile(mcpTauriDevLogPath, formattedChunk, "utf8");
      }
      await writeMcpTauriSessionFile(sessionState);
    };

    child.stdout?.on("data", (chunk) => {
      void handleOutputChunk("stdout", chunk, process.stdout).catch(() => {});
    });
    child.stderr?.on("data", (chunk) => {
      void handleOutputChunk("stderr", chunk, process.stderr).catch(() => {});
    });

    child.on("exit", (code, signal) => {
      void updateSessionState({
        running: false,
        status: signal ? "terminated" : "exited",
        exitCode: code ?? 0,
        signal: signal ?? null,
        endedAt: new Date().toISOString(),
      })
        .catch(() => {})
        .finally(() => {
          resolve(code ?? 0);
        });
    });

    child.on("error", (error) => {
      void updateSessionState({
        running: false,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        endedAt: new Date().toISOString(),
      })
        .catch(() => {})
        .finally(() => {
          reject(error);
        });
    });
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

  const sharedBindingDir = path.join(sharedNodeModules, ...nativeBinding.split("/"));
  if (await pathExists(sharedBindingDir)) {
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

  const packageManagerCommand = getPackageManagerCommand();
  const cliArgs = process.argv.slice(2);
  const tauriCommand = cliArgs.find((arg) => !arg.startsWith("-")) ?? null;
  if (tauriCommand === "dev") {
    cleanupGreeblefsDevProcesses({
      projectRootPath: projectRoot,
      includeRunning: true,
    });
  }
  assertTauronForkAvailable(projectRoot);
  await ensureNativeBindingAvailable();
  const mobileShareBundleDist = resolveMobileShareBundleDist(tauriCommand);
  await fs.mkdir(frontendDist, { recursive: true });
  await fs.mkdir(mobileShareBundleDist, { recursive: true });
  const windowsRustAccelerationEnvironment = buildWindowsRustAccelerationEnvironment();
  const sharedRustBuildEnvironment = {
    CARGO_TARGET_DIR: tauriCargoTargetDir,
    GREEBLEFS_TAURON_PREFLIGHT_DONE: "1",
    OVERLAYTERM_TAURON_PREFLIGHT_DONE: "1",
    ...windowsRustAccelerationEnvironment,
  };
  await prepareKainToolchainPayload(tauriCommand);
  await prepareGoRuntimeAssets(packageManagerCommand, tauriCommand);
  await prepareMobileShareBundle(packageManagerCommand, tauriCommand);
  await prepareTauriDevBindings(
    packageManagerCommand,
    tauriCommand,
    sharedRustBuildEnvironment,
  );
  if (
    tauriCommand === "dev"
    && (
      hasExplicitEnvValue(process.env.GREEBLEFS_TAURI_PREP_ONLY)
      || hasExplicitEnvValue(process.env.OVERLAYTERM_TAURI_PREP_ONLY)
    )
  ) {
    console.log("Tauri dev prep complete; skipping native launch because prep-only mode is enabled.");
    return;
  }
  const linuxGraphicsEnvironment = buildLinuxGraphicsEnvironment({ tauriCommand });
  const existingNodePath = process.env.NODE_PATH
    ? `${cacheNodeModules}${path.delimiter}${process.env.NODE_PATH}`
    : cacheNodeModules;
  const viteCacheDir = (
    process.env.GREEBLEFS_VITE_CACHE_DIR
    || process.env.OVERLAYTERM_VITE_CACHE_DIR
    || defaultViteCacheDir
  );
  const hasExplicitConfig = cliArgs.includes("--config") || cliArgs.includes("-c");
  const runtimeConfigPath = await writeRuntimeTauriConfig(packageManagerCommand, tauriCommand);
  const mcpDevelopment = buildMcpDevelopmentEnvironment({ tauriCommand });
  const tauriArgs = hasExplicitConfig
    ? cliArgs
    : cliArgs.length === 0
      ? ["--config", runtimeConfigPath]
      : [cliArgs[0], "--config", runtimeConfigPath, ...cliArgs.slice(1)];

  const tauriEnvironment = {
    NODE_PATH: existingNodePath,
    npm_config_optional: "true",
    GREEBLEFS_VITE_CACHE_DIR: viteCacheDir,
    OVERLAYTERM_VITE_CACHE_DIR: viteCacheDir,
    GREEBLEFS_VITE_OUT_DIR: frontendDist,
    OVERLAYTERM_VITE_OUT_DIR: frontendDist,
    GREEBLEFS_VITE_MOBILE_OUT_DIR: mobileShareBundleDist,
    OVERLAYTERM_VITE_MOBILE_OUT_DIR: mobileShareBundleDist,
    ...linuxGraphicsEnvironment,
    ...sharedRustBuildEnvironment,
    ...buildManagedContentDirectoryEnvironment({ tauriCommand }),
    ...mcpDevelopment.environment,
  };
  const exitCode = tauriCommand === "dev" && mcpDevelopment.session
    ? await runCommandWithMcpTauriDevStatus(
        process.execPath,
        [sharedTauriCliEntry, ...tauriArgs],
        tauriEnvironment,
        mcpDevelopment.session,
      )
    : await runCommand(
        process.execPath,
        [sharedTauriCliEntry, ...tauriArgs],
        tauriEnvironment,
      );

  if (exitCode === 0 && tauriCommand === "build") {
    const mirroredInstaller = await mirrorWindowsInstallerIntoReleaseRoot();
    if (mirroredInstaller) {
      console.log(
        `Mirrored Windows installer to ${normalizePathForLogs(path.relative(projectRoot, mirroredInstaller.stableInstallerPath) || mirroredInstaller.stableInstallerPath)} and ${normalizePathForLogs(path.relative(projectRoot, mirroredInstaller.versionedInstallerPath) || mirroredInstaller.versionedInstallerPath)}.`,
      );
    }
  }

  process.exit(exitCode);
}

if (isDirectScriptRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
