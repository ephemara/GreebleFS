import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const iconSyncScriptPath = path.join(projectRoot, "scripts", "sync-canonical-icons.mjs");
const viteCliEntryPath = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const viteConfigPath = path.join(projectRoot, "vite.config.ts");
const desktopWarmupUrls = [
  "/src/main.tsx",
  "/src/App.tsx",
  "/src/App.css",
  "/src/windows/FileOperationsWindowApp.tsx",
  "/src/windows/PickerWindowApp.tsx",
];

function runNodeScript(scriptPath, forwardedArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...forwardedArgs], {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${path.basename(scriptPath)} exited from signal ${signal}`));
        return;
      }

      resolve(code ?? 0);
    });
  });
}

function readFlagValue(args, index, flagName) {
  const currentArg = args[index];
  const inlinePrefix = `${flagName}=`;
  if (currentArg.startsWith(inlinePrefix)) {
    return { value: currentArg.slice(inlinePrefix.length), nextIndex: index };
  }
  return { value: args[index + 1], nextIndex: index + 1 };
}

function readOptionalFlagValue(args, index, flagName) {
  const currentArg = args[index];
  const inlinePrefix = `${flagName}=`;
  if (currentArg.startsWith(inlinePrefix)) {
    return { value: currentArg.slice(inlinePrefix.length), nextIndex: index };
  }
  const nextArg = args[index + 1];
  if (!nextArg || nextArg.startsWith("-")) {
    return { value: true, nextIndex: index };
  }
  return { value: nextArg, nextIndex: index + 1 };
}

function parseViteServeArgs(args) {
  const server = {};
  let mode;
  let shouldFallbackToCli = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--port" || arg.startsWith("--port=")) {
      const parsed = readFlagValue(args, index, "--port");
      const port = Number.parseInt(parsed.value, 10);
      if (Number.isFinite(port)) {
        server.port = port;
      }
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--host" || arg.startsWith("--host=")) {
      const parsed = readOptionalFlagValue(args, index, "--host");
      server.host = parsed.value || true;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--strictPort") {
      server.strictPort = true;
      continue;
    }
    if (arg === "--mode" || arg.startsWith("--mode=")) {
      const parsed = readFlagValue(args, index, "--mode");
      mode = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    shouldFallbackToCli = true;
  }

  return { server, mode, shouldFallbackToCli };
}

function shouldWarmDesktopEntrypoints() {
  const value = (
    process.env.GREEBLEFS_VITE_DEV_WARMUP
    || process.env.OVERLAYTERM_VITE_DEV_WARMUP
    || "1"
  ).trim();
  return value !== "0" && value.toLowerCase() !== "false";
}

async function warmDesktopEntrypoints(server) {
  if (!shouldWarmDesktopEntrypoints()) {
    console.log("Desktop frontend warmup disabled.");
    return;
  }

  const startedAt = performance.now();
  for (const url of desktopWarmupUrls) {
    const urlStartedAt = performance.now();
    try {
      await server.warmupRequest(url);
      console.log(
        `Warmed ${url} in ${Math.round(performance.now() - urlStartedAt)}ms.`,
      );
    } catch (error) {
      console.warn(
        `Unable to warm ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const idleStartedAt = performance.now();
  const idleTimeoutMs = Number.parseInt(process.env.GREEBLEFS_VITE_DEV_IDLE_TIMEOUT_MS || "10000", 10);
  const idleResult = await Promise.race([
    server.waitForRequestsIdle().then(() => "idle"),
    new Promise((resolve) => {
      setTimeout(() => resolve("timeout"), Number.isFinite(idleTimeoutMs) ? idleTimeoutMs : 10000);
    }),
  ]);
  console.log(
    idleResult === "idle"
      ? `Desktop frontend dependency crawl idle after ${Math.round(performance.now() - idleStartedAt)}ms.`
      : `Desktop frontend dependency crawl idle wait capped after ${Math.round(performance.now() - idleStartedAt)}ms.`,
  );
  console.log(`Desktop frontend warmup complete in ${Math.round(performance.now() - startedAt)}ms.`);
}

function waitForShutdownSignal() {
  return new Promise((resolve) => {
    const resolveOnce = () => resolve();
    process.once("SIGINT", resolveOnce);
    process.once("SIGTERM", resolveOnce);
  });
}

async function runWarmViteDevServer(forwardedArgs) {
  const { server: serverOptions, mode, shouldFallbackToCli } = parseViteServeArgs(forwardedArgs);
  if (shouldFallbackToCli) {
    return runNodeScript(viteCliEntryPath, forwardedArgs);
  }

  const server = await createServer({
    root: projectRoot,
    configFile: viteConfigPath,
    mode,
    server: {
      ...serverOptions,
      warmup: { clientFiles: [] },
    },
  });

  await server.listen();
  server.printUrls();
  console.log("Desktop frontend dev server is listening.");
  await warmDesktopEntrypoints(server);
  console.log("Desktop frontend dev server is warm.");

  try {
    await waitForShutdownSignal();
  } finally {
    await server.close();
  }

  return 0;
}

async function main() {
  const syncExitCode = await runNodeScript(iconSyncScriptPath);
  if (syncExitCode !== 0) {
    process.exit(syncExitCode);
  }

  const viteExitCode = await runWarmViteDevServer(process.argv.slice(2));
  process.exit(viteExitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
