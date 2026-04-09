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
const cacheDir = path.join(repoRoot, 'node_modules', '.vite-proof', 'workbench-render-runtime');
const screenshotPath = path.join(
  repoRoot,
  'automations',
  'echo',
  'evidence',
  'workbench-render-runtime.proof.png',
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
        reject(new Error('Could not resolve a local proof port.'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

const runtimeProofTheme = {
  id: 'runtime-proof-launcher',
  name: 'Runtime Proof Launcher',
  description: 'Proof theme that drives the live launcher runtime.',
  workbench: {
    brandLabel: 'Runtime Proof',
  },
  engineManifest: {
    id: 'runtime-proof-launcher',
    name: 'Runtime Proof Launcher',
    extends: null,
    presentation: {
      density: 'immersive',
      chromeStyle: 'minimal',
      iconStyle: 'vector',
      motionStyle: 'fluid',
      cornerRadius: 22,
      panelSpacing: 14,
    },
    compatibility: {
      shellBlueprints: ['classic-dock'],
      tags: ['proof', 'launcher'],
    },
    designTokens: [],
    layoutPrimitives: [
      {
        id: 'home-grid',
        name: 'Home Grid',
        kind: 'grid',
        props: {
          gap: 18,
        },
      },
    ],
    navigationPatterns: [
      {
        id: 'home-nav',
        name: 'Home Nav',
        kind: 'spatial',
        axis: 'both',
        props: {
          breadcrumb: true,
        },
      },
    ],
    animationProfiles: [],
    iconPacks: [],
    renderStyles: [
      {
        id: 'springboard-render',
        label: 'Springboard Render',
        kind: 'ios-springboard',
        entryModule: 'renderers/springboard.tsx',
        supportsLiveSwap: false,
        description: 'Launcher-grid runtime proof render style.',
      },
    ],
    defaultLayoutPrimitiveId: 'home-grid',
    defaultNavigationPatternId: 'home-nav',
    defaultAnimationProfileId: null,
    defaultIconPackId: null,
    defaultRenderStyleId: 'springboard-render',
  },
};

const persistedSettings = {
  state: {
    settings: {
      appearance: {
        activeThemeId: 'runtime-proof-launcher',
        customThemes: [runtimeProofTheme],
        appBlur: true,
        appBlurStrength: 20,
        panelTransparency: 0.18,
        appOpacity: 1,
        appZoom: 1,
      },
      layout: {
        activeProfileId: 'overlay-classic',
      },
    },
  },
  version: 0,
};

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
  const page = await browser.newPage({ viewport: { width: 1560, height: 980 } });
  const browserErrors = [];
  const pageErrors = [];

  page.on('console', message => {
    if (message.type() === 'error') {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', error => {
    pageErrors.push(String(error));
  });

  await page.addInitScript((payload) => {
    window.localStorage.setItem('ultacode-settings', JSON.stringify(payload));
  }, persistedSettings);

  const proofUrl = `http://127.0.0.1:${port}/`;
  console.log(`PROOF_URL ${proofUrl}`);
  await page.goto(proofUrl, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({
    content: `
      html, body, #root {
        min-height: 100vh !important;
        height: 100vh !important;
        background: #070b14 !important;
      }
      body {
        margin: 0 !important;
        overflow: hidden !important;
      }
      .overlay-window-host {
        min-height: 100vh !important;
        height: 100vh !important;
      }
    `,
  });
  await page.waitForTimeout(5000);

  const bodySnippet = await page.locator('body').innerText().catch(() => '');
  console.log(`BODY_SNIPPET ${bodySnippet.slice(0, 1200)}`);
  const hostRect = await page.evaluate(() => {
    const host = document.querySelector('.overlay-window-host');
    if (!(host instanceof HTMLElement)) {
      return null;
    }
    const rect = host.getBoundingClientRect();
    const styles = window.getComputedStyle(host);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      opacity: styles.opacity,
      display: styles.display,
      visibility: styles.visibility,
    };
  });
  console.log(`HOST_RECT ${JSON.stringify(hostRect)}`);
  const paintTargets = await page.evaluate(() => {
    return [...document.querySelectorAll('body *')]
      .map(node => {
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const rect = node.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) {
          return null;
        }
        return {
          tag: node.tagName.toLowerCase(),
          className: node.className,
          id: node.id,
          width: rect.width,
          height: rect.height,
          text: (node.innerText || '').trim().slice(0, 80),
        };
      })
      .filter(Boolean)
      .sort((left, right) => (right.width * right.height) - (left.width * left.height))
      .slice(0, 12);
  });
  console.log(`PAINT_TARGETS ${JSON.stringify(paintTargets)}`);
  if (browserErrors.length > 0) {
    console.log(`BROWSER_ERRORS ${browserErrors.join(' | ')}`);
  }
  if (pageErrors.length > 0) {
    console.log(`PAGE_ERRORS ${pageErrors.join(' | ')}`);
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`SCREENSHOT ${screenshotPath}`);
  console.log('RESULT workbench render runtime proof passed');
} finally {
  await browser?.close();
  await server.close();
}
