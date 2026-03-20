import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalIconTheme from '../src/config/canonicalIconTheme.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'vscode-icon-theme', 'icons');
const targetDir = path.join(projectRoot, 'public', 'icons');

function normalizeIconPath(iconPath) {
  return iconPath.replace(/\\/g, '/').replace(/^\.\//, '');
}

async function copyCanonicalFolderIcons() {
  const iconDefinitions = canonicalIconTheme.iconDefinitions ?? {};
  const folderFileNames = new Set(
    Object.entries(iconDefinitions)
      .filter(([iconId]) => iconId === 'folder' || iconId.startsWith('folder_'))
      .map(([, definition]) => {
        const iconPath = typeof definition === 'string' ? definition : definition?.iconPath;
        return normalizeIconPath(String(iconPath ?? ''));
      })
      .filter(iconPath => iconPath.startsWith('icons/'))
      .map(iconPath => path.basename(iconPath)),
  );

  await mkdir(targetDir, { recursive: true });

  for (const fileName of folderFileNames) {
    await copyFile(path.join(sourceDir, fileName), path.join(targetDir, fileName));
  }

  return folderFileNames.size;
}

async function removeLegacyFolderIcons() {
  const entries = await readdir(targetDir, { withFileTypes: true });
  const legacyFiles = entries
    .filter(entry => entry.isFile() && /^folder_(custom|generic)_.*\.svg$/i.test(entry.name))
    .map(entry => path.join(targetDir, entry.name));

  await Promise.all(legacyFiles.map(filePath => rm(filePath, { force: true })));
  return legacyFiles.length;
}

async function main() {
  const copiedCount = await copyCanonicalFolderIcons();
  const removedCount = await removeLegacyFolderIcons();
  console.log(`Synced ${copiedCount} canonical folder icons and removed ${removedCount} legacy folder icons.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
