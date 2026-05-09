import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const tauronRoot = path.resolve(repoRoot, "..", "tauron");
const tauronApiDistPath = path.join(tauronRoot, "packages", "api", "dist").replace(/\\/g, "/");
const tauronApiViteAliases = [
  { find: /^@tauri-apps\/api$/, replacement: `${tauronApiDistPath}/index.js` },
  { find: /^@tauri-apps\/api\/(.+)$/, replacement: `${tauronApiDistPath}/$1.js` },
];
const suiteName = readSuiteName();
const suites = {
  smoke: {
    name: "smoke",
    publicPath: "/proofs/ui-runner/fixture-host-smoke.html",
    entryPath: path.join(repoRoot, "proofs", "ui-runner", "fixture-host-smoke.html"),
    title: "GreebleFS UI Proof",
    optimizeDeps: ["react", "react-dom", "react-dom/client"],
  },
  explorer: {
    name: "explorer",
    publicPath: "/proofs/ui-runner/fileExplorer.repositoryPicker.html",
    entryPath: path.join(repoRoot, "proofs", "ui-runner", "fileExplorer.repositoryPicker.html"),
    title: "GreebleFS Explorer UI Proof",
    optimizeDeps: [
      "react",
      "react-dom",
      "react-dom/client",
      "zustand",
      "zustand/middleware",
      "@monaco-editor/react",
    ],
  },
};
const suite = suites[suiteName];
if (!suite) {
  console.error(`Unknown Tauron UI proof suite: ${suiteName}`);
  process.exit(2);
}
const fixturePath = path.join(
  repoRoot,
  "scripts",
  "proofs",
  "fixtures",
  "greeblefs-ui-runner.explorer.json",
);
const evidenceDir = path.join(repoRoot, "automations", "echo", "evidence");
const sessionPath = path.join(evidenceDir, "tauron-ui-runner-session.json");
const cacheDir = process.env.GREEBLEFS_TAURON_UI_PROOF_CACHE_DIR
  ? path.resolve(process.env.GREEBLEFS_TAURON_UI_PROOF_CACHE_DIR)
  : path.join(repoRoot, "node_modules", ".vite-proof", "tauron-ui-runner");
const mockRoot = path.join(repoRoot, "src", "proofs", "ui-runner", "mocks");
const ignoredWatchGlobs = [
  "**/.git/**",
  "**/coverage/**",
  "**/dist/**",
  "**/output/**",
  "**/release-packages/**",
  "**/src-tauri/**",
  "**/src-tauri/target*/**",
  "**/target-tests*/**",
  "**/plugins/**/node_modules/**",
];

function resolveFromRoot(...segments) {
  return path.join(repoRoot, ...segments).replace(/\\/g, "/");
}

function mockPath(fileName) {
  return path.join(mockRoot, fileName).replace(/\\/g, "/");
}

function readSuiteName() {
  const suiteIndex = process.argv.indexOf("--suite");
  if (suiteIndex >= 0) {
    return process.argv[suiteIndex + 1] ?? "smoke";
  }
  return process.env.GREEBLEFS_TAURON_UI_PROOF_SUITE ?? "smoke";
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not resolve a local proof port."));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitFor(fn, { timeoutMs = 20_000, intervalMs = 120, label = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

function parseRunnerEvalPayload(resultJson) {
  let value = resultJson;
  for (let index = 0; index < 4 && typeof value === "string"; index += 1) {
    try {
      value = JSON.parse(value);
    } catch {
      break;
    }
  }
  return value;
}

async function runnerFetch(session, endpoint, options = {}) {
  const { timeoutMs = 20_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${session.rpcUrl}${endpoint}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(fetchOptions.headers ?? {}),
      },
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(`${endpoint} failed: ${JSON.stringify(body)}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function runnerEval(session, script, options = {}) {
  const response = await runnerFetch(session, "/eval", {
    method: "POST",
    body: JSON.stringify({ script }),
    timeoutMs: options.timeoutMs ?? 20_000,
  });
  if (!response.ok) {
    throw new Error(response.error ?? "runner eval failed");
  }
  const payload = parseRunnerEvalPayload(response.resultJson);
  if (!payload?.ok) {
    throw new Error(payload?.error ?? `runner eval returned ${JSON.stringify(payload)}`);
  }
  return payload.value;
}

function startTauronUiRunner(proofUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cargo",
      [
        "run",
        "-p",
        "tauron-ui-runner",
        "--",
        "--url",
        proofUrl,
        "--title",
        suite.title,
        "--width",
        "1500",
        "--height",
        "940",
        "--fixture",
        fixturePath,
        "--session-file",
        sessionPath,
      ],
      {
        cwd: tauronRoot,
        env: {
          ...process.env,
          CARGO_TARGET_DIR:
            process.env.TAURON_UI_RUNNER_TARGET_DIR ??
            path.join(tauronRoot, "target", "ui-runner"),
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let resolved = false;
    const failTimer = setTimeout(() => {
      if (!resolved) {
        reject(new Error(`Timed out waiting for Tauron UI runner session.\n${stderrBuffer}`));
      }
    }, 90_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const marker = "TAURON_UI_RUNNER_SESSION ";
        if (line.startsWith(marker)) {
          try {
            const session = JSON.parse(line.slice(marker.length));
            resolved = true;
            clearTimeout(failTimer);
            resolve({ child, session });
          } catch (error) {
            reject(error);
          }
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      stderrBuffer += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (!resolved) {
        clearTimeout(failTimer);
        reject(new Error(`Tauron UI runner exited before session: code=${code} signal=${signal}`));
      }
    });
  });
}

async function clickByText(session, selector, text) {
  await runnerEval(
    session,
    `
const element = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
  .find((node) => (node.textContent || '').replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)}));
if (!element) {
  throw new Error('Could not find ' + ${JSON.stringify(selector)} + ' containing ' + ${JSON.stringify(text)});
}
element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
return element.textContent;
`,
  );
}

async function clickEntry(session, leafName) {
  await runnerEval(
    session,
    `
const entry = Array.from(document.querySelectorAll('[data-entry-path]')).find((element) => {
  const path = element.getAttribute('data-entry-path') || '';
  const leaf = path.split(/[\\\\/]/).filter(Boolean).at(-1) || '';
  return leaf.toLowerCase() === ${JSON.stringify(leafName.toLowerCase())};
});
if (!entry) {
  throw new Error('Could not find entry ' + ${JSON.stringify(leafName)});
}
entry.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
return entry.getAttribute('data-entry-path');
`,
  );
}

async function getText(session, testId) {
  return runnerEval(
    session,
    `
const element = document.querySelector('[data-testid="${testId}"]');
return element ? element.textContent : null;
`,
  );
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.mkdir(cacheDir, { recursive: true });

  const port = await findOpenPort();
  const server = await createServer({
    appType: "mpa",
    cacheDir,
    configFile: false,
    logLevel: "error",
    optimizeDeps: {
      entries: [suite.entryPath],
      include: suite.optimizeDeps,
    },
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^@tauri-apps\/api\/core$/, replacement: mockPath("tauriCore.ts") },
        { find: /^@tauri-apps\/api\/window$/, replacement: mockPath("tauriWindow.ts") },
        { find: /^@tauri-apps\/api\/webviewWindow$/, replacement: mockPath("webviewWindow.ts") },
        { find: /^@tauri-apps\/api\/event$/, replacement: mockPath("event.ts") },
        { find: /^@tauri-apps\/plugin-store$/, replacement: mockPath("pluginStore.ts") },
        { find: /^@tauri-apps\/plugin-global-shortcut$/, replacement: mockPath("globalShortcut.ts") },
        { find: /^@tauri-apps\/plugin-fs$/, replacement: mockPath("pluginFs.ts") },
        { find: /^@tauri-apps\/plugin-shell$/, replacement: mockPath("shell.ts") },
        { find: /^@tauri-apps\/plugin-notification$/, replacement: mockPath("notification.ts") },
        { find: /^@tauri-apps\/plugin-opener$/, replacement: mockPath("opener.ts") },
        { find: /^tauri-plugin-screenshots-api$/, replacement: mockPath("screenshots.ts") },
        { find: /^@monaco-editor\/react$/, replacement: mockPath("monacoReact.tsx") },
        { find: "@", replacement: resolveFromRoot("src") },
        { find: "@img-editor-runtime", replacement: resolveFromRoot("packages", "img-editor", "src", "main.ts") },
        ...tauronApiViteAliases,
      ],
    },
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: false,
      fs: {
        allow: [repoRoot, tauronRoot],
      },
      watch: {
        ignored: ignoredWatchGlobs,
      },
    },
  });

  let runner = null;
  try {
    await server.listen();
    const proofUrl = `http://127.0.0.1:${port}${suite.publicPath}`;
    console.log(`PROOF_URL ${proofUrl}`);
    runner = await startTauronUiRunner(proofUrl);
    const { session } = runner;

    await waitFor(
      async () => {
        const health = await runnerFetch(session, "/health", { timeoutMs: 5_000 });
        return health.page?.loaded === true;
      },
      { label: "WebView page load", timeoutMs: 150_000, intervalMs: 500 },
    );
    await waitFor(
      () =>
        runnerEval(
          session,
          `
return Boolean(document.querySelector('[data-testid="proof-title"]'));
`,
          { timeoutMs: 2_500 },
        ),
      { label: "proof title", timeoutMs: 90_000, intervalMs: 250 },
    );
    console.log(`STEP 1 Tauron UI runner rendered ${await getText(session, "proof-title")}`);

    await waitFor(
      () =>
        runnerEval(
          session,
          `
return Array.from(document.querySelectorAll('[data-entry-path]'))
  .map((element) => element.getAttribute('data-entry-path'))
  .filter(Boolean);
`,
        ).then((entries) => entries.includes("C:\\workspace\\repo\\alpha") && entries),
      { label: "fixture explorer entries" },
    );
    console.log("STEP 2 fixture Explorer entries rendered in real WebView");

    await clickByText(session, "button", "Add Current Folder");
    await waitFor(
      async () => (await getText(session, "confirmed-paths")) === "C:\\workspace\\repo",
      { label: "current folder confirmation" },
    );
    console.log("STEP 3 open-folders scenario confirmed current folder");

    await runnerEval(
      session,
      `
(document.querySelector('[data-testid="scenario-files"]') || document.querySelector('[data-testid="mode-files"]'))?.dispatchEvent(
  new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
);
return document.querySelector('[data-testid="picker-mode"]')?.textContent;
`,
    );
    await waitFor(async () => (await getText(session, "picker-mode")) === "openFiles", {
      label: "file picker scenario",
    });
    await clickEntry(session, "notes.txt");
    await clickByText(session, "button", "Choose Files");
    await waitFor(
      async () => (await getText(session, "confirmed-paths")) === "C:\\workspace\\repo\\notes.txt",
      { label: "selected file confirmation" },
    );
    console.log("STEP 4 open-files scenario confirmed notes.txt");

    const events = await runnerFetch(session, "/events");
    const consoleErrors = events.events.filter(
      (event) =>
        event.kind === "ipc" &&
        (event.payload?.kind === "window-error" ||
          event.payload?.kind === "unhandled-rejection" ||
          (event.payload?.kind === "console" && event.payload?.level === "error")),
    );
    if (consoleErrors.length > 0) {
      throw new Error(`Runner captured UI errors: ${JSON.stringify(consoleErrors.slice(-5), null, 2)}`);
    }

    const summary = {
      status: "ok",
      lane: "tauron-ui-runner",
      suite: suite.name,
      proofUrl,
      session,
      checkedFlows: ["openFolders.currentFolder", "openFiles.notesTxt"],
      eventCount: events.events.length,
    };
    await fs.writeFile(
      path.join(evidenceDir, "tauron-ui-runner-proof.json"),
      JSON.stringify(summary, null, 2),
    );
    console.log(`RESULT ${JSON.stringify(summary, null, 2)}`);
  } catch (error) {
    if (runner?.session) {
      const diagnostic = {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        health: await runnerFetch(runner.session, "/health", { timeoutMs: 3_000 }).catch((healthError) => ({
          error: healthError instanceof Error ? healthError.message : String(healthError),
        })),
        events: await runnerFetch(runner.session, "/events", { timeoutMs: 3_000 }).catch((eventsError) => ({
          error: eventsError instanceof Error ? eventsError.message : String(eventsError),
        })),
      };
      await fs.writeFile(
        path.join(evidenceDir, "tauron-ui-runner-proof.failure.json"),
        JSON.stringify(diagnostic, null, 2),
      );
      console.error(`DIAGNOSTIC ${JSON.stringify(diagnostic, null, 2)}`);
    }
    throw error;
  } finally {
    if (runner?.session) {
      await runnerFetch(runner.session, "/close", {
        method: "POST",
        body: JSON.stringify({ exitCode: 0 }),
        timeoutMs: 2_000,
      }).catch(() => undefined);
    }
    runner?.child?.kill();
    await Promise.race([
      server.close(),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
