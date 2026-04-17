import { copyFile, mkdir, readdir, rm, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalIconTheme from '../src/config/canonicalIconTheme.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const targetDir = path.join(projectRoot, 'public', 'icons');
const sourceDirectories = [
  path.join(projectRoot, 'vscode-icon-theme', 'icons'),
  path.join(projectRoot, 'node_modules', 'material-icon-theme', 'icons'),
];

function normalizeIconPath(iconPath) {
  return iconPath.replace(/\\/g, '/').replace(/^\.\//, '');
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildCanonicalIconFileNames() {
  const iconDefinitions = canonicalIconTheme.iconDefinitions ?? {};
  return new Set(
    Object.entries(iconDefinitions)
      .map(([, definition]) => {
        const iconPath = typeof definition === 'string' ? definition : definition?.iconPath;
        return normalizeIconPath(String(iconPath ?? ''));
      })
      .filter(iconPath => iconPath.startsWith('icons/'))
      .map(iconPath => path.basename(iconPath)),
  );
}

function buildSourceCandidates(fileName) {
  const baseName = fileName.replace(/\.svg$/i, '');
  return Array.from(new Set([
    fileName,
    `${baseName.replace(/_open$/i, '-open')}.svg`,
    `${baseName.replace(/_open$/i, '-open').replace(/_/g, '-')}.svg`,
    `${baseName.replace(/_/g, '-')}.svg`,
  ]));
}

async function resolveSourceIconPath(fileName) {
  const candidateFileNames = buildSourceCandidates(fileName);

  for (const sourceDir of sourceDirectories) {
    for (const candidateFileName of candidateFileNames) {
      const candidatePath = path.join(sourceDir, candidateFileName);
      if (await pathExists(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

function createFallbackIconSvg(fileName) {
  if (/^folder/i.test(fileName)) {
    const isOpen = /(?:_open|-open)\.svg$/i.test(fileName);
    const body = isOpen
      ? '<path d="M6 11.5h23.5L26 27H6.5A2.5 2.5 0 0 1 4 24.5v-10A2.5 2.5 0 0 1 6.5 12z" fill="#d2a24c"/><path d="M4 12.5h11l2-3h12A2.5 2.5 0 0 1 31.5 12H6.5A2.5 2.5 0 0 0 4 14.5z" fill="#f3c46b"/>'
      : '<path d="M4 10.5A2.5 2.5 0 0 1 6.5 8H16l2 3h11.5A2.5 2.5 0 0 1 32 13.5v11A2.5 2.5 0 0 1 29.5 27h-23A2.5 2.5 0 0 1 4 24.5z" fill="#d6a551"/><path d="M4 14.5h28v2H4z" fill="#f2c86f" opacity="0.85"/>';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">${body}</svg>\n`;
  }

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">',
    '<path d="M10 4.5h10l6 6V31.5H10A2.5 2.5 0 0 1 7.5 29V7A2.5 2.5 0 0 1 10 4.5z" fill="#67b7ff"/>',
    '<path d="M20 4.5v6h6" fill="#bde1ff"/>',
    '<path d="M12 17h12v2H12zm0 5h9v2h-9z" fill="#0f2a43" opacity="0.7"/>',
    '</svg>\n',
  ].join('');
}

async function syncCanonicalIcons() {
  const iconFileNames = buildCanonicalIconFileNames();
  let copiedCount = 0;
  let fallbackCount = 0;

  await mkdir(targetDir, { recursive: true });

  for (const fileName of iconFileNames) {
    const sourcePath = await resolveSourceIconPath(fileName);
    const targetPath = path.join(targetDir, fileName);

    if (sourcePath) {
      await copyFile(sourcePath, targetPath);
      copiedCount += 1;
      continue;
    }

    await writeFile(targetPath, createFallbackIconSvg(fileName), 'utf8');
    fallbackCount += 1;
  }

  return {
    totalCount: iconFileNames.size,
    copiedCount,
    fallbackCount,
  };
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
  const syncSummary = await syncCanonicalIcons();
  const removedCount = await removeLegacyFolderIcons();

  if (syncSummary.copiedCount === 0 && syncSummary.totalCount > 0) {
    const sourceDirectoryStatus = await Promise.all(
      sourceDirectories.map(async sourceDir => ({
        sourceDir,
        exists: await pathExists(sourceDir),
      })),
    );

    const formattedSourceDirectoryStatus = sourceDirectoryStatus
      .map(({ sourceDir, exists }) => `${sourceDir} [${exists ? 'present' : 'missing'}]`)
      .join(', ');

    throw new Error(
      `Canonical icon sync did not find any real source icons. Checked: ${formattedSourceDirectoryStatus}. ` +
      'Install `material-icon-theme` or provide `vscode-icon-theme/icons` before running dev/build so the explorer does not fall back to placeholder file/folder art.',
    );
  }

  console.log(
    `Synced ${syncSummary.totalCount} canonical icons (${syncSummary.copiedCount} copied, ${syncSummary.fallbackCount} generated) and removed ${removedCount} legacy folder icons.`,
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
