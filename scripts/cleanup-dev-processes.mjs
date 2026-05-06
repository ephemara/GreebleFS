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

function normalizeCommandForMatching(value) {
  return value.replace(/\\/g, "/").toLowerCase();
}

function isStoppedProcessState(stat) {
  return typeof stat === "string" && stat.includes("T");
}

function isTargetDevelopmentProcess(command, projectRootPath) {
  if (typeof command !== "string" || command.length === 0) {
    return false;
  }

  const normalizedCommand = normalizeCommandForMatching(command);
  const targetMarkers = buildTargetCommandMarkers(projectRootPath).map(normalizeCommandForMatching);
  return targetMarkers.some((marker) => normalizedCommand.includes(marker));
}

function normalizeWindowsProcessEntries(rawValue) {
  if (!rawValue) {
    return [];
  }
  const entries = Array.isArray(rawValue) ? rawValue : [rawValue];
  return entries
    .map((entry) => ({
      pid: Number(entry.ProcessId),
      parentPid: Number(entry.ParentProcessId),
      command: typeof entry.CommandLine === "string" ? entry.CommandLine : "",
    }))
    .filter((entry) => Number.isFinite(entry.pid) && entry.pid > 0);
}

function inspectWindowsProcesses() {
  const command = "$ErrorActionPreference = 'Stop'; "
    + "Get-CimInstance Win32_Process "
    + "| Select-Object ProcessId, ParentProcessId, CommandLine "
    + "| ConvertTo-Json -Compress";
  const snapshot = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  if (snapshot.error) {
    throw snapshot.error;
  }

  if (snapshot.status !== 0) {
    throw new Error(snapshot.stderr || "Failed to inspect Windows process list.");
  }

  return normalizeWindowsProcessEntries(JSON.parse(snapshot.stdout || "[]"));
}

function collectProtectedAncestorPids(processes, currentPid) {
  const processByPid = new Map(processes.map((processEntry) => [processEntry.pid, processEntry]));
  const protectedAncestorPids = new Set([currentPid]);
  let cursorPid = currentPid;
  while (true) {
    const currentProcess = processByPid.get(cursorPid);
    if (
      !currentProcess
      || !currentProcess.parentPid
      || protectedAncestorPids.has(currentProcess.parentPid)
    ) {
      break;
    }
    protectedAncestorPids.add(currentProcess.parentPid);
    cursorPid = currentProcess.parentPid;
  }
  return protectedAncestorPids;
}

function collectProcessTreePids(processes, rootPids) {
  const childrenByParentPid = new Map();
  for (const processEntry of processes) {
    if (!childrenByParentPid.has(processEntry.parentPid)) {
      childrenByParentPid.set(processEntry.parentPid, []);
    }
    childrenByParentPid.get(processEntry.parentPid).push(processEntry.pid);
  }

  const collected = new Set();
  const queue = [...rootPids];
  while (queue.length > 0) {
    const nextPid = queue.shift();
    if (!nextPid || collected.has(nextPid)) {
      continue;
    }
    collected.add(nextPid);
    queue.push(...(childrenByParentPid.get(nextPid) ?? []));
  }
  return collected;
}

function cleanupWindowsGreeblefsDevProcesses({
  projectRootPath,
  includeRunning,
  logger,
}) {
  if (!includeRunning) {
    return [];
  }

  const processes = inspectWindowsProcesses();
  const protectedAncestorPids = collectProtectedAncestorPids(processes, process.pid);
  const rootPids = processes
    .filter((processEntry) => !protectedAncestorPids.has(processEntry.pid))
    .filter((processEntry) => isTargetDevelopmentProcess(processEntry.command, projectRootPath))
    .map((processEntry) => processEntry.pid);
  const targetPids = [...collectProcessTreePids(processes, rootPids)]
    .filter((pid) => !protectedAncestorPids.has(pid));

  const killedProcesses = [];
  for (const pid of targetPids) {
    const result = spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
      stdio: "pipe",
    });
    if (result.status === 0) {
      const processEntry = processes.find((entry) => entry.pid === pid);
      killedProcesses.push(processEntry ?? { pid, parentPid: 0, command: "" });
    }
  }

  if (killedProcesses.length > 0) {
    logger.log(
      `Cleaned ${killedProcesses.length} stale GreebleFS dev process${killedProcesses.length === 1 ? "" : "es"} before startup.`,
    );
  }

  return killedProcesses;
}

export function cleanupGreeblefsDevProcesses({
  projectRootPath = defaultProjectRoot,
  includeRunning = false,
  logger = console,
} = {}) {
  if (process.platform === "win32") {
    return cleanupWindowsGreeblefsDevProcesses({
      projectRootPath,
      includeRunning,
      logger,
    });
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
