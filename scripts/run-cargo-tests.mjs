import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function manifestsForPlatform(platform) {
  const manifests = ['src-tauri/Cargo.toml', 'crates/file-opening/Cargo.toml'];

  if (platform === 'win32') {
    manifests.push('crates/file-opening-windows/Cargo.toml');
  } else if (platform === 'darwin') {
    manifests.push('crates/file-opening-macos/Cargo.toml', 'crates/macos/Cargo.toml');
  } else if (platform === 'linux') {
    manifests.push('crates/file-opening-linux/Cargo.toml');
  }

  return manifests;
}

function runCargoTest(manifestPath) {
  const manifestDirName = path.basename(path.dirname(manifestPath));
  const targetDir = path.join(projectRoot, 'target-tests', 'cargo', process.platform, manifestDirName);
  const result = spawnSync('cargo', ['test', '--manifest-path', manifestPath, '--target-dir', targetDir], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const manifest of manifestsForPlatform(process.platform)) {
  runCargoTest(path.join(projectRoot, manifest));
}
