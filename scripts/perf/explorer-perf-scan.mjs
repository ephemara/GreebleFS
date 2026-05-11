#!/usr/bin/env node
import { chromium } from "playwright";
import { parse } from "@babel/parser";
import { performance } from "node:perf_hooks";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const stateRoot = path.join(repoRoot, "MCP", ".state");
const evidenceRoot = path.join(
  repoRoot,
  "automations",
  "explorer-perf",
  "evidence",
);

const defaultProbePaths = [
  "C:\\Users\\Admin",
  "D:\\GreebleFS",
  "D:\\GreebleFS\\usr",
  "D:\\",
];

const astTargets = [
  "src/components/FileExplorer.tsx",
  "src/runtime/explorerBackend.ts",
  "src/runtime/explorerViewportPreviewPrefetchScheduler.ts",
  "src/runtime/explorerPathIndex.ts",
  "src/runtime/localDirectoryListing.ts",
  "src/config/explorerPerformance.ts",
  "src-tauri/src/indexing/mod.rs",
];

async function main() {
  const startedAt = new Date();
  const nativeSession = await readJson(
    path.join(stateRoot, "greeblefs-native-automation.json"),
  ).catch(() => null);
  const webviewSession = await readJson(
    path.join(stateRoot, "tauron-webview2-session.json"),
  ).catch(() => null);
  const tauriSession = await readJson(
    path.join(stateRoot, "tauri-dev-session.json"),
  ).catch(() => null);

  const result = {
    version: 1,
    generatedAt: startedAt.toISOString(),
    repoRoot,
    sessions: {
      tauri: summarizeSession(tauriSession),
      nativeAutomation: summarizeSession(nativeSession),
      webview: summarizeSession(webviewSession),
    },
    native: await captureNativeEvidence(nativeSession),
    frontend: await captureFrontendEvidence(webviewSession),
    source: {
      ast: await analyzeAstTargets(astTargets),
    },
  };

  await fs.mkdir(evidenceRoot, { recursive: true });
  const fileName = `explorer-perf-${formatTimestamp(startedAt)}.json`;
  const outPath = path.join(evidenceRoot, fileName);
  await fs.writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outPath, summary: summarizeResult(result) }, null, 2));
}

async function captureNativeEvidence(session) {
  if (!session?.rpcUrl || !session?.authToken) {
    return { available: false, errors: ["Native automation session is not published."] };
  }
  const errors = [];
  const flowSnapshot = await nativeRpc(session, "performance.get_flow_snapshot").catch(
    (error) => {
      errors.push(`performance.get_flow_snapshot failed: ${messageOf(error)}`);
      return null;
    },
  );
  const ringBenchmark = await nativeRpc(session, "diagnostics.native_ring_benchmark", {
    webviewLabel: "main",
    packets: 256,
    packetBytes: 4096,
    capacity: 4 * 1024 * 1024,
  }).catch((error) => {
    errors.push(`diagnostics.native_ring_benchmark failed: ${messageOf(error)}`);
    return null;
  });
  const listLocationTimings = await timeNativeListLocations(session, probePaths());
  errors.push(...listLocationTimings.errors);
  return {
    available: true,
    errors,
    flowSnapshot,
    ringBenchmark,
    listLocationTimings,
  };
}

async function timeNativeListLocations(session, paths) {
  const timings = [];
  const errors = [];
  for (const probePath of paths) {
    for (const phase of ["coldish", "warm"]) {
      const started = performance.now();
      try {
        const response = await nativeRpc(session, "host.call", {
          methodId: "explorer.list_location",
          payload: { path: probePath, showHidden: false },
        });
        timings.push({
          path: probePath,
          phase,
          durationMs: round(performance.now() - started),
          entryCount: Array.isArray(response?.entries) ? response.entries.length : null,
          kind: response?.kind ?? null,
        });
      } catch (error) {
        errors.push(`explorer.list_location ${probePath} ${phase} failed: ${messageOf(error)}`);
      }
    }
  }
  return { timings, errors };
}

async function captureFrontendEvidence(webviewSession) {
  const port = resolveCdpPort(webviewSession) ?? 9222;
  const endpoint = `http://127.0.0.1:${port}`;
  const browser = await chromium.connectOverCDP(endpoint).catch((error) => ({
    error,
  }));
  if ("error" in browser) {
    return {
      available: false,
      cdpEndpoint: endpoint,
      errors: [`CDP attach failed: ${messageOf(browser.error)}`],
    };
  }

  try {
    const context = browser.contexts()[0];
    const page =
      context?.pages().find((candidate) => candidate.url().includes("localhost:1420")) ??
      context?.pages()[0];
    if (!page) {
      return { available: false, cdpEndpoint: endpoint, errors: ["No CDP page found."] };
    }
    const client = await page.context().newCDPSession(page);
    const [dom, heap, raf, longTasks, trace, bridgePerformance] = await Promise.all([
      captureDomSummary(page),
      captureHeapSummary(page, client),
      captureRafSummary(page, 2200),
      captureLongTaskSummary(page, 2200),
      captureTraceSummary(page, client, 5200),
      captureBridgePerformance(page),
    ]);
    return {
      available: true,
      cdpEndpoint: endpoint,
      pageUrl: page.url(),
      dom,
      heap,
      raf,
      longTasks,
      trace,
      bridgePerformance,
      errors: [],
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function captureDomSummary(page) {
  return page.evaluate(() => {
    const explorerRoot = document.querySelector("[data-overlay-explorer]");
    return {
      totalNodes: document.querySelectorAll("*").length,
      explorerNodes: explorerRoot ? explorerRoot.querySelectorAll("*").length : 0,
      images: document.images.length,
      canvases: document.querySelectorAll("canvas").length,
      visibleRows: document.querySelectorAll("[data-entry-path]").length,
      virtualSurfaceCount: document.querySelectorAll("[data-overlay-explorer-virtual-surface]").length,
    };
  });
}

async function captureHeapSummary(page, client) {
  const metrics = await client.send("Runtime.getHeapUsage").catch(() => null);
  const memory = await page.evaluate(() => {
    const perfMemory = performance.memory;
    return perfMemory
      ? {
          usedJSHeapSize: perfMemory.usedJSHeapSize,
          totalJSHeapSize: perfMemory.totalJSHeapSize,
          jsHeapSizeLimit: perfMemory.jsHeapSizeLimit,
        }
      : null;
  });
  return { runtime: metrics, performanceMemory: memory };
}

async function captureRafSummary(page, durationMs) {
  return page.evaluate(async (sampleDurationMs) => {
    const frames = [];
    let previous = performance.now();
    const endAt = previous + sampleDurationMs;
    await new Promise((resolve) => {
      function tick(now) {
        frames.push(now - previous);
        previous = now;
        if (now >= endAt) {
          resolve(undefined);
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    return summarizeDurations(frames);
  }, durationMs);
}

async function captureLongTaskSummary(page, durationMs) {
  return page.evaluate(async (sampleDurationMs) => {
    if (!("PerformanceObserver" in window)) {
      return { supported: false };
    }
    const durations = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        durations.push(entry.duration);
      }
    });
    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      return { supported: false };
    }
    await new Promise((resolve) => setTimeout(resolve, sampleDurationMs));
    observer.disconnect();
    return { supported: true, ...summarizeDurations(durations) };
  }, durationMs);
}

async function captureTraceSummary(page, client, durationMs) {
  const events = [];
  client.on("Tracing.dataCollected", (event) => {
    if (Array.isArray(event.value)) {
      events.push(...event.value);
    }
  });
  await client.send("Tracing.start", {
    categories: [
      "devtools.timeline",
      "disabled-by-default-v8.cpu_profiler",
      "blink.user_timing",
      "loading",
      "v8",
    ].join(","),
    options: "sampling-frequency=10000",
  });
  await page.evaluate((sampleDurationMs) => new Promise((resolve) => setTimeout(resolve, sampleDurationMs)), durationMs);
  const tracingComplete = new Promise((resolve) => {
    client.once("Tracing.tracingComplete", resolve);
  });
  await client.send("Tracing.end");
  await tracingComplete;
  return summarizeTraceEvents(events);
}

async function captureBridgePerformance(page) {
  return page.evaluate(async () => {
    const bridge = window.__GREEBLEFS_DEV_MCP__;
    if (!bridge?.getPerformanceSnapshot) {
      return null;
    }
    return bridge.getPerformanceSnapshot();
  });
}

async function analyzeAstTargets(targets) {
  const summaries = [];
  for (const relativePath of targets) {
    const absolutePath = path.join(repoRoot, relativePath);
    const source = await fs.readFile(absolutePath, "utf8");
    const isTsLike = /\.(ts|tsx)$/.test(relativePath);
    const ast = parse(source, {
      sourceType: "module",
      plugins: isTsLike
        ? ["typescript", "jsx", "importMeta", "decorators-legacy"]
        : ["jsx", "importMeta"],
      errorRecovery: true,
    });
    const counts = {
      functions: 0,
      jsxElements: 0,
      callExpressions: 0,
      useMemo: 0,
      useCallback: 0,
      useEffect: 0,
      arrayMapCalls: 0,
      arrayFilterCalls: 0,
      promiseAllCalls: 0,
      requestAnimationFrameCalls: 0,
      conditionals: 0,
    };
    walkAst(ast, (node) => {
      switch (node.type) {
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ArrowFunctionExpression":
          counts.functions += 1;
          break;
        case "JSXElement":
          counts.jsxElements += 1;
          break;
        case "ConditionalExpression":
        case "IfStatement":
        case "SwitchStatement":
          counts.conditionals += 1;
          break;
        case "CallExpression":
          counts.callExpressions += 1;
          observeCall(node, counts);
          break;
      }
    });
    summaries.push({
      path: relativePath,
      bytes: Buffer.byteLength(source),
      lines: source.split(/\r?\n/).length,
      counts,
    });
  }
  return summaries;
}

function observeCall(node, counts) {
  const calleeName = readCalleeName(node.callee);
  if (calleeName === "useMemo") counts.useMemo += 1;
  if (calleeName === "useCallback") counts.useCallback += 1;
  if (calleeName === "useEffect") counts.useEffect += 1;
  if (calleeName === "map") counts.arrayMapCalls += 1;
  if (calleeName === "filter") counts.arrayFilterCalls += 1;
  if (calleeName === "Promise.all") counts.promiseAllCalls += 1;
  if (calleeName === "requestAnimationFrame") counts.requestAnimationFrameCalls += 1;
}

function readCalleeName(callee) {
  if (!callee) return "";
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression") {
    const objectName = readCalleeName(callee.object);
    const propertyName =
      callee.property?.type === "Identifier"
        ? callee.property.name
        : callee.property?.type === "StringLiteral"
          ? callee.property.value
          : "";
    return objectName ? `${objectName}.${propertyName}` : propertyName;
  }
  return "";
}

function walkAst(node, visitor) {
  if (!node || typeof node !== "object") return;
  visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "start" || key === "end" || key === "extra") continue;
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visitor);
    } else if (value && typeof value === "object" && typeof value.type === "string") {
      walkAst(value, visitor);
    }
  }
}

function summarizeTraceEvents(events) {
  const mainEvents = events.filter((event) => event.ph === "X" && typeof event.dur === "number");
  const durationByName = new Map();
  for (const event of mainEvents) {
    const ms = event.dur / 1000;
    const current = durationByName.get(event.name) ?? {
      name: event.name,
      count: 0,
      totalMs: 0,
      maxMs: 0,
    };
    current.count += 1;
    current.totalMs += ms;
    current.maxMs = Math.max(current.maxMs, ms);
    durationByName.set(event.name, current);
  }
  const top = [...durationByName.values()]
    .map((entry) => ({
      ...entry,
      totalMs: round(entry.totalMs),
      maxMs: round(entry.maxMs),
    }))
    .sort((left, right) => right.maxMs - left.maxMs)
    .slice(0, 20);
  return {
    eventCount: events.length,
    completeEventCount: mainEvents.length,
    topByMaxDuration: top,
    longTasksOver50Ms: mainEvents.filter((event) => event.dur / 1000 > 50).length,
  };
}

function summarizeDurations(values) {
  const durations = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (durations.length === 0) {
    return { count: 0, avgMs: null, p95Ms: null, maxMs: null, over16Ms: 0, over50Ms: 0 };
  }
  const total = durations.reduce((sum, value) => sum + value, 0);
  const p95 = durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)];
  return {
    count: durations.length,
    avgMs: round(total / durations.length),
    p95Ms: round(p95),
    maxMs: round(durations[durations.length - 1]),
    over16Ms: durations.filter((value) => value > 16.7).length,
    over50Ms: durations.filter((value) => value > 50).length,
  };
}

async function nativeRpc(session, method, payload = {}) {
  const response = await fetch(session.rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-greeblefs-dev-token": session.authToken,
    },
    body: JSON.stringify({ method, payload }),
  });
  const body = await response.text();
  const json = body ? JSON.parse(body) : null;
  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message ?? json?.error ?? body ?? response.statusText);
  }
  return json?.result ?? json?.data ?? json;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function summarizeSession(session) {
  if (!session || typeof session !== "object") return null;
  return {
    pid: session.pid ?? null,
    running: session.running ?? null,
    status: session.status ?? null,
    startedAt: session.startedAt ?? session.startedAtUnixMs ?? null,
    updatedAt: session.updatedAt ?? session.updatedAtUnixMs ?? null,
    frontendDevUrl: session.frontendDevUrl ?? null,
    rpcUrl: session.rpcUrl ?? null,
    webviewDebugPort: session.webviewDebugPort ?? null,
    lastError: session.lastError ?? null,
  };
}

function resolveCdpPort(webviewSession) {
  const main = webviewSession?.webviews?.main;
  return Number(main?.remoteDebuggingPort ?? webviewSession?.webviewDebugPort) || null;
}

function probePaths() {
  const raw = process.env.GREEBLEFS_EXPLORER_PERF_PATHS;
  return raw
    ? raw.split(";").map((entry) => entry.trim()).filter(Boolean)
    : defaultProbePaths;
}

function summarizeResult(result) {
  return {
    nativeErrors: result.native?.errors?.length ?? 0,
    frontendErrors: result.frontend?.errors?.length ?? 0,
    listTimings: result.native?.listLocationTimings?.timings ?? [],
    raf: result.frontend?.raf ?? null,
    traceLongTasksOver50Ms: result.frontend?.trace?.longTasksOver50Ms ?? null,
    astHotFiles: result.source.ast
      .slice()
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 3)
      .map((entry) => ({ path: entry.path, lines: entry.lines, bytes: entry.bytes })),
  };
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
