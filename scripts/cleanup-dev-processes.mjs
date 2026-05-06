import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultProjectRoot = path.resolve(__dirname, "..");

function parseProcessSnapshotLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
  if (!match) {
    return null;
  }

  return {
    pid: Number(match[1]),
    parentPid: Number(match[2]),
    stat: match[3],
    command: match[4],
  };
}

function buildTargetCommandMarkers(projectRootPath) {
  return [
    "node scripts/run-platform-tauri.mjs",
    "node scripts/run-frontend-dev.mjs",
    "bun run tauri dev",
    `${path.join(projectRootPath, "node_modules", "@tauri-apps", "cli", "tauri.js")} dev`,
    `${path.join(projectRootPath, "node_modules", ".bin", "vite")}`,
    `${path.join(projectRootPath, "node_modules", "vite", "bin", "vite.js")}`,
    "node scripts/run-export-bindings.mjs",
    "cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings",
    `${path.join(projectRootPath, "target", "debug", "export-bindings")}`,
    "bun scripts/sync-canonical-icons.mjs && cargo run --manifest-path src-tauri/Cargo.toml --bin export-bindings && vite",
    "bun scripts/sync-canonical-icons.mjs && bun run bindings:generate && vite",
  ];
}

function isStoppedProcessState(stat) {
  return typeof stat === "string" && stat.includes("T");
}

function isTargetDevelopmentProcess(command, projectRootPath) {
  if (typeof command !== "string" || command.length === 0) {
    return false;
  }

  const targetMarkers = buildTargetCommandMarkers(projectRootPath);
  return targetMarkers.some((marker) => command.includes(marker));
}

export function cleanupGreeblefsDevProcesses({
  projectRootPath = defaultProjectRoot,
  includeRunning = false,
  logger = console,
} = {}) {
  if (process.platform === "win32") {
    return [];
  }

  const processSnapshot = spawnSync("ps", ["-eo", "pid=,ppid=,stat=,args="], {
    encoding: "utf8",
  });

  if (processSnapshot.error) {
    throw processSnapshot.error;
  }

  if (processSnapshot.status !== 0) {
    throw new Error(processSnapshot.stderr || "Failed to inspect local process list.");
  }

  const currentPid = process.pid;
  const killedProcesses = [];
  const parsedProcesses = [];

  for (const line of processSnapshot.stdout.split("\n")) {
    const parsedProcess = parseProcessSnapshotLine(line);
    if (parsedProcess) {
      parsedProcesses.push(parsedProcess);
    }
  }

  const processByPid = new Map(parsedProcesses.map((processEntry) => [processEntry.pid, processEntry]));
  const protectedAncestorPids = new Set([currentPid]);
  let cursorPid = currentPid;
  while (true) {
    const currentProcess = processByPid.get(cursorPid);
    if (!currentProcess || !currentProcess.parentPid || protectedAncestorPids.has(currentProcess.parentPid)) {
      break;
    }
    protectedAncestorPids.add(currentProcess.parentPid);
    cursorPid = currentProcess.parentPid;
  }

  for (const parsedProcess of parsedProcesses) {
    if (protectedAncestorPids.has(parsedProcess.pid)) {
      continue;
    }

    if (!includeRunning && !isStoppedProcessState(parsedProcess.stat)) {
      continue;
    }

    if (!isTargetDevelopmentProcess(parsedProcess.command, projectRootPath)) {
      continue;
    }

    try {
      process.kill(parsedProcess.pid, "SIGKILL");
      killedProcesses.push(parsedProcess);
    } catch {
      // Another shell may have already cleaned it up between ps and kill.
    }
  }

  if (killedProcesses.length > 0) {
    logger.log(
      `Cleaned ${killedProcesses.length} stale GreebleFS dev process${killedProcesses.length === 1 ? "" : "es"} before startup.`,
    );
  }

  return killedProcesses;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const includeRunning = process.argv.includes("--include-running");
  try {
    cleanupGreeblefsDevProcesses({
      includeRunning,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
