import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const probeOutputPath = path.join(
  repoRoot,
  'automations',
  'echo',
  'evidence',
  'overlayterm.tauri-frame-probe.json',
);
const tauriConfigDir = path.join(repoRoot, 'target-codex-tests', 'tauri-frame-probe');
const devPort = await findOpenPort();
const devUrl = `http://localhost:${devPort}/?frameProbeFile=${encodeURIComponent(probeOutputPath)}`;

await fs.mkdir(path.dirname(probeOutputPath), { recursive: true });
await fs.rm(probeOutputPath, { force: true });
await fs.mkdir(tauriConfigDir, { recursive: true });

const child = spawn(
  process.execPath,
  [path.join(repoRoot, 'scripts', 'run-platform-tauri.mjs'), 'dev'],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      OVERLAYTERM_TAURI_CONFIG_DIR: tauriConfigDir,
      OVERLAYTERM_TAURI_DEV_PORT: String(devPort),
      OVERLAYTERM_TAURI_DEV_URL: devUrl,
      VITE_OVERLAYTERM_FRAME_PROBE_FILE: probeOutputPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

child.stdout?.on('data', chunk => process.stdout.write(chunk));
child.stderr?.on('data', chunk => process.stderr.write(chunk));

try {
  const sample = await waitForProbeFile(probeOutputPath, 420_000);
  console.log(`TAURI_FRAME_SAMPLE ${JSON.stringify(sample)}`);
  console.log(`PROBE_FILE ${probeOutputPath}`);
  console.log('RESULT tauri frame probe passed');
} finally {
  await killProcessTree(child.pid);
}

async function waitForProbeFile(filePath, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.metricId === 'overlay_frame_time') {
        return parsed;
      }
    } catch {
      // Wait for the desktop app to boot and emit a sample.
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for Tauri frame probe sample at ${filePath}`);
}

async function killProcessTree(pid) {
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }

  child.kill('SIGTERM');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function freeRepoVitePort(port, rootPath) {
  if (process.platform !== 'win32') {
    return;
  }

  const escapedRoot = rootPath.replace(/\\/g, '\\\\');
  const command = `
    $connection = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $connection) { exit 0 }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)"
    if ($null -ne $process -and $process.CommandLine -like "*${escapedRoot}*" -and $process.CommandLine -like "*vite*") {
      Stop-Process -Id $connection.OwningProcess -Force
    }
  `;

  await new Promise(resolve => {
    const cleaner = spawn('powershell', ['-NoProfile', '-Command', command], { stdio: 'ignore' });
    cleaner.on('exit', () => resolve());
    cleaner.on('error', () => resolve());
  });
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve a local Tauri dev probe port.'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}
