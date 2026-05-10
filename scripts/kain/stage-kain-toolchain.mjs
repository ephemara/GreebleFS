import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const toolchainConfigPath = path.join(projectRoot, "toolchains", "kain", "toolchains.json");
const defaultPayloadRoot = path.join(projectRoot, "toolchains", "kain", "payload-runtime");
let payloadRoot = defaultPayloadRoot;
let payloadManifestPath = path.join(payloadRoot, "kain-payload-manifest.json");
const defaultSourceRoot = process.platform === "win32"
  ? "D:\\Kain-Lang"
  : path.resolve(projectRoot, "..", "Kain-Lang");
const executableName = process.platform === "win32" ? "kain.exe" : "kain";
const optionalLauncherName = process.platform === "win32" ? "kn.exe" : "kn";
const fallbackPayloadDirectories = ["stdlib", "runtime"];
const fallbackKnownPayloadDirectories = ["stdlib", "runtime", "toolchain", "docs"];
const fallbackPayloadDirectoryExcludes = [
  "runtime/3rdparty",
  "runtime/fixtures",
  "runtime/conformance",
  "runtime/parallel",
  "runtime/changelogs",
];
const payloadSanitizerVersion = 2;

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const optional = args.has("--optional");
const verifyOnly = args.has("--verify-only");
const skip = parseBooleanEnv("GREEBLEFS_SKIP_KAIN_STAGE") || parseBooleanEnv("OVERLAYTERM_SKIP_KAIN_STAGE");

function parseBooleanEnv(name) {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function normalizeForLogs(value) {
  return value.replaceAll("\\", "/");
}

function normalizeRelativePayloadPath(value) {
  return normalizeForLogs(value)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function requireSafeRelativePayloadPath(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty relative path.`);
  }

  const normalized = normalizeRelativePayloadPath(value.trim());
  if (
    path.isAbsolute(normalized)
    || normalized === "."
    || normalized === ".."
    || normalized.startsWith("../")
    || normalized.includes("/../")
  ) {
    throw new Error(`${label} must stay inside the Kain payload: ${value}`);
  }

  return normalized;
}

function uniqueSafeRelativePayloadPaths(values, label) {
  const normalizedValues = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = requireSafeRelativePayloadPath(value, label);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      normalizedValues.push(normalized);
    }
  }
  return normalizedValues;
}

function resolveConfiguredPayloadRoot(toolchainConfig) {
  const configuredPayloadRoot = typeof toolchainConfig.payloadRoot === "string"
    ? toolchainConfig.payloadRoot.trim()
    : "";
  if (!configuredPayloadRoot) {
    return defaultPayloadRoot;
  }

  const candidate = path.resolve(projectRoot, configuredPayloadRoot);
  const relative = path.relative(projectRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Kain payloadRoot must stay inside the GreebleFS workspace: ${configuredPayloadRoot}`);
  }
  return candidate;
}

async function readKainToolchainConfig() {
  if (!(await pathExists(toolchainConfigPath))) {
    return {};
  }

  const rawConfig = await fs.readFile(toolchainConfigPath, "utf8");
  const parsedConfig = JSON.parse(rawConfig);
  return parsedConfig?.toolchains?.kain && typeof parsedConfig.toolchains.kain === "object"
    ? parsedConfig.toolchains.kain
    : {};
}

function resolvePayloadStageConfig(toolchainConfig) {
  const profileNameFromEnv = (
    process.env.GREEBLEFS_KAIN_PAYLOAD_PROFILE
    || process.env.KAIN_PAYLOAD_PROFILE
    || ""
  ).trim();
  const fullProfileRequested =
    parseBooleanEnv("GREEBLEFS_KAIN_STAGE_FULL")
    || parseBooleanEnv("KAIN_STAGE_FULL");
  const payloadProfiles = toolchainConfig.payloadProfiles && typeof toolchainConfig.payloadProfiles === "object"
    ? toolchainConfig.payloadProfiles
    : {};
  const defaultProfileName = typeof toolchainConfig.defaultPayloadProfile === "string"
    ? toolchainConfig.defaultPayloadProfile.trim()
    : "";
  const fullProfileName = typeof toolchainConfig.fullPayloadProfile === "string"
    ? toolchainConfig.fullPayloadProfile.trim()
    : "";
  const selectedProfileName = fullProfileRequested
    ? (fullProfileName || "full-local")
    : (profileNameFromEnv || defaultProfileName || "runtime-bundled");
  const selectedProfile = payloadProfiles[selectedProfileName] && typeof payloadProfiles[selectedProfileName] === "object"
    ? payloadProfiles[selectedProfileName]
    : {};

  const configuredDirectories =
    selectedProfile.payloadDirectories
    ?? selectedProfile.directories
    ?? toolchainConfig.payloadDirectories
    ?? fallbackPayloadDirectories;
  const configuredExcludes =
    selectedProfile.payloadDirectoryExcludes
    ?? selectedProfile.excludes
    ?? toolchainConfig.payloadDirectoryExcludes
    ?? fallbackPayloadDirectoryExcludes;
  const configuredKnownDirectories = new Set([
    ...fallbackKnownPayloadDirectories,
    ...uniqueSafeRelativePayloadPaths(toolchainConfig.payloadDirectories, "payloadDirectories"),
  ]);
  for (const profile of Object.values(payloadProfiles)) {
    if (!profile || typeof profile !== "object") {
      continue;
    }
    for (const directory of uniqueSafeRelativePayloadPaths(
      profile.payloadDirectories ?? profile.directories,
      "payloadProfiles.payloadDirectories",
    )) {
      configuredKnownDirectories.add(directory);
    }
  }

  return {
    profileName: selectedProfileName,
    directories: uniqueSafeRelativePayloadPaths(configuredDirectories, "payloadDirectories"),
    excludes: uniqueSafeRelativePayloadPaths(configuredExcludes, "payloadDirectoryExcludes"),
    knownDirectories: [...configuredKnownDirectories].sort((left, right) => left.localeCompare(right)),
    fullProfileRequested,
  };
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function requirePath(targetPath, label) {
  if (await pathExists(targetPath)) {
    return targetPath;
  }
  throw new Error(`${label} not found: ${normalizeForLogs(targetPath)}`);
}

function findOnPath(name) {
  const pathEntries = (process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, name);
    if (spawnSync(candidate, ["--version"], { stdio: "ignore" }).status === 0) {
      return candidate;
    }
  }
  return null;
}

async function resolveKainSourceRoot() {
  const configured = process.env.GREEBLEFS_KAIN_SOURCE_ROOT || process.env.KAIN_SOURCE_ROOT;
  const sourceRoot = path.resolve(configured || defaultSourceRoot);
  await requirePath(sourceRoot, "Kain source root");
  return sourceRoot;
}

function executableSupportsArgs(executablePath, args) {
  if (!args.length) {
    return true;
  }
  const probe = spawnSync(executablePath, args, {
    encoding: "utf8",
    stdio: "ignore",
  });
  return probe.status === 0;
}

async function resolveExecutable(sourceRoot, fileName, envName, requiredArgs = []) {
  const configured = process.env[envName];
  const candidates = [];

  if (configured?.trim()) {
    candidates.push(path.resolve(configured));
  }

  const sourceReleaseExecutable = path.join(sourceRoot, "target", "release", fileName);
  const sourceDebugExecutable = path.join(sourceRoot, "target", "debug", fileName);
  const sourceCodexDebugExecutable = path.join(sourceRoot, "target", "codex-cli-bridge-check", "debug", fileName);
  candidates.push(sourceReleaseExecutable, sourceDebugExecutable, sourceCodexDebugExecutable);

  const pathExecutable = findOnPath(fileName);
  if (pathExecutable) {
    candidates.push(pathExecutable);
  }

  const existingCandidates = [];
  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) {
      continue;
    }
    existingCandidates.push(candidate);
    if (executableSupportsArgs(candidate, requiredArgs)) {
      return candidate;
    }
  }

  if (requiredArgs.length && existingCandidates.length) {
    const requiredCommand = [fileName, ...requiredArgs].join(" ");
    const tried = existingCandidates.map(normalizeForLogs).join(", ");
    throw new Error(`Found ${fileName}, but no candidate supports '${requiredCommand}'. Tried: ${tried}`);
  }

  return null;
}

async function statFingerprintEntry(targetPath, label) {
  const stats = await fs.stat(targetPath);
  return {
    label,
    path: normalizeForLogs(targetPath),
    size: stats.size,
    modifiedMs: Math.trunc(stats.mtimeMs),
    directory: stats.isDirectory(),
  };
}

async function buildFingerprint(sourceRoot, kainExecutable, optionalLauncher, payloadStageConfig) {
  const entries = [
    await statFingerprintEntry(kainExecutable, "bin/kain"),
    {
      label: "payload-stage-config",
      path: normalizeForLogs(toolchainConfigPath),
      size: Buffer.byteLength(JSON.stringify(payloadStageConfig)),
      modifiedMs: 0,
      directory: false,
    },
  ];
  if (optionalLauncher) {
    entries.push(await statFingerprintEntry(optionalLauncher, "bin/kn"));
  }
  for (const directoryName of payloadStageConfig.directories) {
    const directoryPath = path.join(sourceRoot, directoryName);
    if (await pathExists(directoryPath)) {
      entries.push(await statFingerprintEntry(directoryPath, directoryName));
    }
  }
  const hash = createHash("sha256");
  hash.update(JSON.stringify(entries));
  return {
    digest: hash.digest("hex"),
    entries,
  };
}

async function readExistingManifest() {
  if (!(await pathExists(payloadManifestPath))) {
    return null;
  }
  try {
    return JSON.parse(await fs.readFile(payloadManifestPath, "utf8"));
  } catch {
    return null;
  }
}

function isExcludedPayloadPath(relativePath, excludedPaths) {
  const normalized = normalizeRelativePayloadPath(relativePath);
  return excludedPaths.some((excludedPath) =>
    normalized === excludedPath || normalized.startsWith(`${excludedPath}/`)
  );
}

async function payloadLooksComplete(payloadStageConfig) {
  if (!(await pathExists(path.join(payloadRoot, "bin", executableName)))) {
    return false;
  }
  for (const directoryName of payloadStageConfig.directories) {
    if (!(await pathExists(path.join(payloadRoot, directoryName)))) {
      return false;
    }
  }
  for (const excludedPath of payloadStageConfig.excludes) {
    if (await pathExists(path.join(payloadRoot, excludedPath))) {
      return false;
    }
  }
  return true;
}

async function makePathWritable(targetPath) {
  let stats;
  try {
    stats = await fs.lstat(targetPath);
  } catch {
    return;
  }

  if (stats.isDirectory() && !stats.isSymbolicLink()) {
    const entries = await fs.readdir(targetPath);
    await Promise.all(entries.map((entry) => makePathWritable(path.join(targetPath, entry))));
    await fs.chmod(targetPath, 0o777).catch(() => {});
    return;
  }

  await fs.chmod(targetPath, 0o666).catch(() => {});
}

async function removePath(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "EPERM" && error?.code !== "EACCES") {
      throw error;
    }
    await makePathWritable(targetPath);
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}

async function removePayloadRelativePath(relativePath) {
  const safeRelativePath = requireSafeRelativePayloadPath(relativePath, "payload cleanup path");
  const target = path.resolve(payloadRoot, safeRelativePath);
  const relative = path.relative(payloadRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove path outside Kain payload: ${target}`);
  }
  await removePath(target);
}

async function removeStalePayloadContent(payloadStageConfig) {
  const selectedDirectories = new Set(payloadStageConfig.directories);
  for (const directoryName of payloadStageConfig.knownDirectories) {
    if (!selectedDirectories.has(directoryName)) {
      await removePayloadRelativePath(directoryName);
    }
  }
  for (const excludedPath of payloadStageConfig.excludes) {
    await removePayloadRelativePath(excludedPath);
  }
}

async function copyDirectory(sourceRoot, directoryName, payloadStageConfig) {
  const sourcePath = path.join(sourceRoot, directoryName);
  if (!(await pathExists(sourcePath))) {
    return false;
  }
  const targetPath = path.join(payloadRoot, directoryName);
  try {
    await fs.cp(sourcePath, targetPath, {
      recursive: true,
      force: true,
      errorOnExist: false,
      filter: async (sourceEntryPath) => {
        const relativeSourcePath = path.relative(sourceRoot, sourceEntryPath);
        return !isExcludedPayloadPath(relativeSourcePath, payloadStageConfig.excludes);
      },
    });
  } catch (error) {
    if (await pathExists(targetPath)) {
      console.warn(`Kain payload directory refresh kept existing ${directoryName}: ${error.message}`);
      return true;
    }
    throw error;
  }
  return true;
}

async function stageExecutable(sourcePath, targetName) {
  if (!sourcePath) {
    return false;
  }
  await fs.mkdir(path.join(payloadRoot, "bin"), { recursive: true });
  await fs.copyFile(sourcePath, path.join(payloadRoot, "bin", targetName));
  return true;
}

async function materializePayloadSymlink(symlinkPath, stats) {
  const linkTarget = await fs.readlink(symlinkPath);
  const resolvedTarget = path.resolve(path.dirname(symlinkPath), linkTarget);
  let targetStats;
  try {
    targetStats = await fs.stat(resolvedTarget);
  } catch {
    await removePath(symlinkPath);
    return {
      action: "removed-missing-target",
      path: normalizeForLogs(symlinkPath),
      target: normalizeForLogs(resolvedTarget),
    };
  }

  await removePath(symlinkPath);
  if (targetStats.isDirectory()) {
    await fs.cp(resolvedTarget, symlinkPath, {
      recursive: true,
      force: true,
      errorOnExist: false,
    });
    return {
      action: "materialized-directory",
      path: normalizeForLogs(symlinkPath),
      target: normalizeForLogs(resolvedTarget),
    };
  }

  if (targetStats.isFile()) {
    await fs.mkdir(path.dirname(symlinkPath), { recursive: true });
    await fs.copyFile(resolvedTarget, symlinkPath);
    return {
      action: "materialized-file",
      path: normalizeForLogs(symlinkPath),
      target: normalizeForLogs(resolvedTarget),
    };
  }

  await removePath(symlinkPath);
  return {
    action: "removed-unsupported-target",
    path: normalizeForLogs(symlinkPath),
    target: normalizeForLogs(resolvedTarget),
    fileType: {
      directory: stats.isDirectory(),
      file: stats.isFile(),
      symbolicLink: stats.isSymbolicLink(),
    },
  };
}

async function sanitizePayloadSymlinks(rootPath, records = []) {
  if (!(await pathExists(rootPath))) {
    return records;
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    const stats = await fs.lstat(entryPath);
    if (stats.isSymbolicLink()) {
      records.push(await materializePayloadSymlink(entryPath, stats));
      continue;
    }
    if (stats.isDirectory()) {
      await sanitizePayloadSymlinks(entryPath, records);
    }
  }
  return records;
}

async function main() {
  if (skip) {
    console.log("Skipping Kain toolchain staging because skip env is enabled.");
    return;
  }

  const toolchainConfig = await readKainToolchainConfig();
  payloadRoot = resolveConfiguredPayloadRoot(toolchainConfig);
  payloadManifestPath = path.join(payloadRoot, "kain-payload-manifest.json");
  const payloadStageConfig = resolvePayloadStageConfig(toolchainConfig);
  let sourceRoot;
  let kainExecutable;
  let optionalLauncher;
  try {
    sourceRoot = await resolveKainSourceRoot();
    kainExecutable = await resolveExecutable(sourceRoot, executableName, "GREEBLEFS_KAIN_EXE", ["bridge", "serve", "--help"]);
    optionalLauncher = await resolveExecutable(sourceRoot, optionalLauncherName, "GREEBLEFS_KN_EXE");
    if (!kainExecutable) {
      throw new Error(`Unable to locate ${executableName} in ${normalizeForLogs(sourceRoot)}, GREEBLEFS_KAIN_EXE, or PATH.`);
    }
  } catch (error) {
    if (optional) {
      console.warn(`Kain toolchain staging skipped: ${error.message}`);
      return;
    }
    throw error;
  }

  const fingerprint = await buildFingerprint(sourceRoot, kainExecutable, optionalLauncher, payloadStageConfig);
  const existingManifest = await readExistingManifest();
  if (
    !force
    && existingManifest?.fingerprint?.digest === fingerprint.digest
    && existingManifest?.payloadSanitizerVersion === payloadSanitizerVersion
    && await payloadLooksComplete(payloadStageConfig)
  ) {
    console.log(`Kain toolchain payload '${payloadStageConfig.profileName}' up to date, skipping.`);
    return;
  }

  if (verifyOnly) {
    console.log(`Kain toolchain source verified at ${normalizeForLogs(sourceRoot)}.`);
    return;
  }

  await fs.mkdir(payloadRoot, { recursive: true });
  await removeStalePayloadContent(payloadStageConfig);
  await stageExecutable(kainExecutable, executableName);
  try {
    await stageExecutable(optionalLauncher, optionalLauncherName);
  } catch (error) {
    console.warn(`Optional Kain launcher staging skipped: ${error.message}`);
  }

  const copiedDirectories = [];
  for (const directoryName of payloadStageConfig.directories) {
    if (await copyDirectory(sourceRoot, directoryName, payloadStageConfig)) {
      copiedDirectories.push(directoryName);
    }
  }
  const symlinkSanitization = await sanitizePayloadSymlinks(payloadRoot);

  const doctor = spawnSync(kainExecutable, ["--version"], {
    encoding: "utf8",
    env: {
      ...process.env,
      KAIN_STDLIB_PATH: path.join(payloadRoot, "stdlib"),
      KAIN_RUNTIME_MANIFEST_PATH: path.join(payloadRoot, "runtime", "native_runtime.toml"),
      KAIN_RUNTIME_C_PATH: path.join(payloadRoot, "runtime", "kain_runtime.c"),
    },
  });

  const manifest = {
    schemaVersion: 1,
    sourceRoot: normalizeForLogs(sourceRoot),
    payloadRoot: normalizeForLogs(payloadRoot),
    stagedAt: new Date().toISOString(),
    fingerprint,
    executables: {
      kain: normalizeForLogs(kainExecutable),
      kn: optionalLauncher ? normalizeForLogs(optionalLauncher) : null,
    },
    payloadProfile: payloadStageConfig.profileName,
    copiedDirectories,
    excludedPayloadPaths: payloadStageConfig.excludes,
    fullProfileRequested: payloadStageConfig.fullProfileRequested,
    payloadSanitizerVersion,
    symlinkSanitization,
    version: doctor.status === 0 ? doctor.stdout.trim() : null,
  };
  await fs.writeFile(payloadManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    `Staged Kain toolchain payload '${payloadStageConfig.profileName}' at ${normalizeForLogs(path.relative(projectRoot, payloadRoot))}.`,
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
