#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const appIconsPath = path.join(projectRoot, 'src', 'components', 'AppIcons.tsx');
const canonicalThemePath = path.join(projectRoot, 'src', 'config', 'canonicalIconTheme.json');

const APP_ICON_BINDING_PATTERN = /createThemedIcon\('([^']+)',\s*LucideIcons\.([A-Za-z0-9]+)\)/g;

function sortObjectEntries(source) {
  return Object.fromEntries(
    Object.entries(source).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );
}

function extractAppIconBindings(sourceText) {
  const bindings = [];
  for (const match of sourceText.matchAll(APP_ICON_BINDING_PATTERN)) {
    const [, slotId, lucideIconName] = match;
    bindings.push([slotId, `lucide:${lucideIconName}`]);
  }
  return bindings;
}

async function main() {
  const [appIconsSourceText, canonicalThemeText] = await Promise.all([
    readFile(appIconsPath, 'utf8'),
    readFile(canonicalThemePath, 'utf8'),
  ]);

  const appIconBindings = extractAppIconBindings(appIconsSourceText);
  if (appIconBindings.length === 0) {
    throw new Error(`Failed to extract AppIcons bindings from ${appIconsPath}`);
  }

  const canonicalTheme = JSON.parse(canonicalThemeText);
  const preservedUiIcons = Object.fromEntries(
    Object.entries(canonicalTheme.uiIcons ?? {}).filter(([slotId]) =>
      !appIconBindings.some(([appSlotId]) => appSlotId === slotId),
    ),
  );

  canonicalTheme.uiIcons = sortObjectEntries({
    ...preservedUiIcons,
    ...Object.fromEntries(appIconBindings),
  });

  await writeFile(
    canonicalThemePath,
    `${JSON.stringify(canonicalTheme, null, 2)}\n`,
    'utf8',
  );

  console.log(`Synced ${appIconBindings.length} AppIcons UI slots into ${canonicalThemePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
