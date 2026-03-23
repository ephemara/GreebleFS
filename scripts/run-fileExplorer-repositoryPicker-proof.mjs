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
const cacheDir = path.join(repoRoot, 'node_modules', '.vite-proof', 'repository-picker');
const proofEntry = path.join(repoRoot, 'browser-proof', 'fileExplorer.repositoryPicker.html');
const screenshotPath = path.join(
  repoRoot,
  'automations',
  'echo',
  'evidence',
  'fileExplorer.repositoryPicker.proof.png',
);
const ignoredWatchGlobs = [
  '**/.git/**',
  '**/coverage/**',
  '**/dist/**',
  '**/output/**',
  '**/release-packages/**',
  '**/src-tauri/**',
  '**/src-tauri/target*/**',
  '**/target-tests*/**',
  '**/plugins/**/node_modules/**',
];

function resolveFromRoot(...segments) {
  return path.join(repoRoot, ...segments);
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve a local proof port.'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function createAssertion(message, condition) {
  if (!condition) {
    throw new Error(message);
  }
}

const port = await findOpenPort();
const browserErrors = [];
const pageErrors = [];

const server = await createServer({
  appType: 'mpa',
  cacheDir,
  configFile: false,
  logLevel: 'error',
  optimizeDeps: {
    entries: [proofEntry],
    include: [
      '@tauri-apps/api/event',
      '@tauri-apps/plugin-global-shortcut',
      '@tauri-apps/plugin-store',
      '@monaco-editor/react',
      'zustand',
      'zustand/middleware',
    ],
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolveFromRoot('src'),
      '@tauri-apps/api/core': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'tauriCore.ts'),
      '@tauri-apps/api/window': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'tauriWindow.ts'),
      '@tauri-apps/api/event': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'tauriEvent.ts'),
      '@tauri-apps/plugin-store': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'pluginStore.ts'),
      '@tauri-apps/plugin-global-shortcut': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'globalShortcut.ts'),
      '@monaco-editor/react': resolveFromRoot('src', 'test', 'browser-proof', 'mocks', 'monacoReact.tsx'),
    },
  },
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    watch: {
      ignored: ignoredWatchGlobs,
    },
  },
});

let browser;

try {
  await server.listen();
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1560, height: 980 } });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });

  const proofUrl = `http://127.0.0.1:${port}/browser-proof/fileExplorer.repositoryPicker.html`;
  console.log(`PROOF_URL ${proofUrl}`);
  await page.goto(proofUrl, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('proof-title').waitFor();
  await page.getByText('alpha').waitFor();

  console.log('STEP 1 current-folder fallback banner rendered');
  await page.getByText('No folders selected yet, so OverlayTerm can add the current folder directly.').waitFor();
  const addCurrentFolderButton = page.getByRole('button', { name: 'Add Current Folder' });
  createAssertion(
    'Expected Add Current Folder button to be enabled.',
    await addCurrentFolderButton.isEnabled(),
  );

  await addCurrentFolderButton.click();
  await page.getByTestId('confirmed-paths').waitFor({ state: 'visible' });
  const currentFolderConfirmation = await page.getByTestId('confirmed-paths').textContent();
  createAssertion(
    'Current-folder confirmation did not match the proof root.',
    currentFolderConfirmation === 'C:\\workspace\\repo',
  );
  console.log(`STEP 2 add-current-folder confirmed ${currentFolderConfirmation}`);

  await page.getByTestId('scenario-single').click();
  await page.getByText('alpha').waitFor();
  await page.getByText('nested').waitFor();
  createAssertion(
    'Single-select scenario did not activate.',
    (await page.getByTestId('picker-mode').textContent()) === 'single',
  );
  console.log('STEP 3 single-select scenario loaded');

  await page.getByText('alpha').click();
  await page.getByText('nested').click({ modifiers: ['Control'] });
  await page.getByText('1 folder selected.').waitFor();
  await page.getByRole('button', { name: 'Add Selected Folder' }).click();

  const singleFolderConfirmation = await page.getByTestId('confirmed-paths').textContent();
  createAssertion(
    'Single-select confirmation did not preserve the last selected directory.',
    singleFolderConfirmation === 'C:\\workspace\\repo\\nested',
  );
  console.log(`STEP 4 single-select confirmed ${singleFolderConfirmation}`);

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`SCREENSHOT ${screenshotPath}`);

  if (pageErrors.length > 0) {
    throw new Error(`Page errors detected during proof: ${pageErrors.join(' | ')}`);
  }

  if (browserErrors.length > 0) {
    console.log(`BROWSER_ERRORS ${browserErrors.join(' | ')}`);
  }

  console.log('RESULT repository picker proof passed');
} finally {
  await browser?.close();
  await server.close();
}
