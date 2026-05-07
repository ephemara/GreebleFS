import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const payloadRoot = path.join(projectRoot, "toolchains", "kain", "payload");
const payloadManifestPath = path.join(payloadRoot, "kain-payload-manifest.json");
const defaultSourceRoot = process.platform === "win32"
  ? "D:\\Kain-Lang"
  : path.resolve(projectRoot, "..", "Kain-Lang");
const executableName = process.platform === "win32" ? "kain.exe" : "kain";
const optionalLauncherName = process.platform === "win32" ? "kn.exe" : "kn";
const payloadDirectories = ["stdlib", "runtime", "toolchain", "docs"];
const payloadSanitizerVersion = 1;

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

async function resolveExecutable(sourceRoot, fileName, envName) {
  const configured = process.env[envName];
  if (configured?.trim()) {
    return requirePath(path.resolve(configured), envName);
  }

  const sourceReleaseExecutable = path.join(sourceRoot, "target", "release", fileName);
  if (await pathExists(sourceReleaseExecutable)) {
    return sourceReleaseExecutable;
  }

  const pathExecutable = findOnPath(fileName);
  if (pathExecutable) {
    return pathExecutable;
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

async function buildFingerprint(sourceRoot, kainExecutable, optionalLauncher) {
  const entries = [
    await statFingerprintEntry(kainExecutable, "bin/kain"),
  ];
  if (optionalLauncher) {
    entries.push(await statFingerprintEntry(optionalLauncher, "bin/kn"));
  }
  for (const directoryName of payloadDirectories) {
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

async function payloadLooksComplete() {
  if (!(await pathExists(path.join(payloadRoot, "bin", executableName)))) {
    return false;
  }
  if (!(await pathExists(path.join(payloadRoot, "stdlib")))) {
    return false;
  }
  return true;
}

async function removePath(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function removePayloadChild(childName) {
  const target = path.resolve(payloadRoot, childName);
  const relative = path.relative(payloadRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove path outside Kain payload: ${target}`);
  }
  await removePath(target);
}

async function copyDirectory(sourceRoot, directoryName) {
  const sourcePath = path.join(sourceRoot, directoryName);
  if (!(await pathExists(sourcePath))) {
    return false;
  }
  await removePayloadChild(directoryName);
  await fs.cp(sourcePath, path.join(payloadRoot, directoryName), {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
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

  let sourceRoot;
  let kainExecutable;
  let optionalLauncher;
  try {
    sourceRoot = await resolveKainSourceRoot();
    kainExecutable = await resolveExecutable(sourceRoot, executableName, "GREEBLEFS_KAIN_EXE");
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

  const fingerprint = await buildFingerprint(sourceRoot, kainExecutable, optionalLauncher);
  const existingManifest = await readExistingManifest();
  if (
    !force
    && existingManifest?.fingerprint?.digest === fingerprint.digest
    && existingManifest?.payloadSanitizerVersion === payloadSanitizerVersion
    && await payloadLooksComplete()
  ) {
    console.log("Kain toolchain payload up to date, skipping.");
    return;
  }

  if (verifyOnly) {
    console.log(`Kain toolchain source verified at ${normalizeForLogs(sourceRoot)}.`);
    return;
  }

  await fs.mkdir(payloadRoot, { recursive: true });
  await removePayloadChild("bin");
  await stageExecutable(kainExecutable, executableName);
  await stageExecutable(optionalLauncher, optionalLauncherName);

  const copiedDirectories = [];
  for (const directoryName of payloadDirectories) {
    if (await copyDirectory(sourceRoot, directoryName)) {
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
    copiedDirectories,
    payloadSanitizerVersion,
    symlinkSanitization,
    version: doctor.status === 0 ? doctor.stdout.trim() : null,
  };
  await fs.writeFile(payloadManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Staged Kain toolchain payload at ${normalizeForLogs(path.relative(projectRoot, payloadRoot))}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
