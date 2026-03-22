#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function detectLinuxRollupPackage() {
  if (process.platform !== 'linux') {
    return null;
  }

  const archMap = {
    arm64: 'arm64',
    x64: 'x64',
  };
  const mappedArch = archMap[process.arch];
  if (!mappedArch) {
    return null;
  }

  const glibcVersion = process.report?.getReport?.().header?.glibcVersionRuntime;
  const libcFamily = glibcVersion ? 'gnu' : 'musl';
  return `@rollup/rollup-linux-${mappedArch}-${libcFamily}`;
}

function main() {
  const repoRoot = process.cwd();
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const nodeModulesPath = path.join(repoRoot, 'node_modules');

  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(nodeModulesPath)) {
    return;
  }

  const rollupPackageName = detectLinuxRollupPackage();
  if (!rollupPackageName) {
    return;
  }

  try {
    require.resolve(rollupPackageName, { paths: [repoRoot] });
  } catch {
    console.error(
      [
        `Missing Linux-native Rollup package: ${rollupPackageName}`,
        'This usually means node_modules was installed on another platform and then reused on the VPS.',
        'Run `npm install` from the VPS workspace before running Vite/Vitest/Tauri commands.',
      ].join('\n'),
    );
    process.exit(1);
  }
}

main();
