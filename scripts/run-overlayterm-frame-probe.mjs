import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cacheDir = path.join(repoRoot, 'node_modules', '.vite-proof', 'overlayterm-frame-probe');
const screenshotPath = path.join(
  repoRoot,
  'automations',
  'echo',
  'evidence',
  'overlayterm.frame-probe.png',
);

function resolveFromRoot(...segments) {
  return path.join(repoRoot, ...segments);
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve a local frame probe port.'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

const port = await findOpenPort();
const server = await createServer({
  appType: 'spa',
  cacheDir,
  configFile: false,
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolveFromRoot('src'),
      '@tauri-apps/api/core': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'appTauriCore.ts'),
      '@tauri-apps/api/window': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'appTauriWindow.ts'),
      '@tauri-apps/api/event': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'tauriEvent.ts'),
      '@tauri-apps/plugin-store': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'pluginStore.ts'),
      '@tauri-apps/plugin-global-shortcut': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'globalShortcut.ts'),
      '@tauri-apps/plugin-fs': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'pluginFs.ts'),
      '@tauri-apps/plugin-notification': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'notification.ts'),
      '@tauri-apps/plugin-shell': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'shell.ts'),
      '@tauri-apps/plugin-opener': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'opener.ts'),
      '@monaco-editor/react': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'monacoReact.tsx'),
    },
  },
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
});

let browser;

try {
  await server.listen();
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const probeUrl = `http://127.0.0.1:${port}/`;

  console.log(`PROBE_URL ${probeUrl}`);
  await page.goto(probeUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 1520, height: 960 },
    { width: 1280, height: 820 },
    { width: 1440, height: 920 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(650);
  }

  await page.mouse.move(900, 120);
  await page.mouse.wheel(0, 520);
  await page.waitForTimeout(2000);

  const latestFrameSample = await page.waitForFunction(() => {
    try {
      const raw = window.localStorage.getItem('overlayterm-explorer-performance-v1');
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      const samples = parsed?.samples?.overlay_frame_time;
      return Array.isArray(samples) && samples.length > 0 ? samples[samples.length - 1] : null;
    } catch {
      return null;
    }
  }, { timeout: 12000 });

  const sample = await latestFrameSample.jsonValue();
  console.log(`FRAME_SAMPLE ${JSON.stringify(sample)}`);

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`SCREENSHOT ${screenshotPath}`);
  console.log('RESULT overlayterm frame probe passed');
} finally {
  await browser?.close();
  await server.close();
}
