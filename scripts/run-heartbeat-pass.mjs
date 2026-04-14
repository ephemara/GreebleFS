import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function runGit(args) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

function safeRunGit(args) {
  try {
    return runGit(args);
  } catch (error) {
    const message = error?.stderr?.toString?.().trimEnd?.() || error?.message || String(error);
    return `[git ${args.join(' ')} failed] ${message}`;
  }
}

function collectChangedFiles() {
  const output = safeRunGit(['status', '--short']);
  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.replace(/^..\s+/, ''));
}

function classifyFiles(files) {
  const buckets = new Set();
  for (const file of files) {
    if (file.startsWith('src-tauri/')) buckets.add('rust');
    if (file.startsWith('src/')) buckets.add('frontend');
    if (file.startsWith('scripts/')) buckets.add('scripts');
    if (file.endsWith('.md')) buckets.add('docs');
    if (file.startsWith('crates/')) buckets.add('rust');
  }
  return [...buckets];
}

function recommendedChecks(kinds) {
  const checks = [];
  if (kinds.includes('scripts')) checks.push('bun run test:unit');
  if (kinds.includes('frontend')) checks.push('bun vitest run src/test/terminalCommandUtils.test.ts src/test/gitManager.behavior.test.tsx');
  if (kinds.includes('rust')) checks.push('cargo test --manifest-path src-tauri/Cargo.toml');
  if (kinds.length === 0) checks.push('git status --short');
  return checks;
}

function getActivePerformanceSpec() {
  const specDir = path.join(projectRoot, '.specs', 'overlayterm-performance-60fps');
  const tasksPath = path.join(specDir, 'tasks.md');
  const validationPath = path.join(specDir, 'validation.md');
  return fs.existsSync(tasksPath) && fs.existsSync(validationPath)
    ? { slug: 'overlayterm-performance-60fps', specDir, tasksPath, validationPath }
    : null;
}

function countOpenTasks(tasksPath) {
  try {
    const content = fs.readFileSync(tasksPath, 'utf8');
    const matches = content.match(/^- \[ \]/gm);
    return matches ? matches.length : 0;
  } catch {
    return null;
  }
}

function performanceValidationHints(spec, files) {
  if (!spec) return [];
  const hints = [];
  const touchesFrontend = files.some((file) => file.startsWith('src/'));
  const touchesRust = files.some((file) => file.startsWith('src-tauri/'));
  const touchesScripts = files.some((file) => file.startsWith('scripts/'));

  hints.push('baseline scenario: GitManager + explorer-adjacent repo workflows');
  hints.push(`spec validation: python3 scripts/validate_spec.py ${spec.slug}`);
  if (touchesRust) hints.push('rust validation: cargo test --manifest-path src-tauri/Cargo.toml');
  if (touchesFrontend) hints.push('frontend validation: bun vitest run src/test/gitManager.behavior.test.tsx src/test/performanceTelemetry.test.ts');
  if (touchesScripts) hints.push('script validation: bun run test:unit');
  return hints;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const files = collectChangedFiles();
  const kinds = classifyFiles(files);
  const checks = recommendedChecks(kinds);
  const perfSpec = getActivePerformanceSpec();
  const perfHints = performanceValidationHints(perfSpec, files);
  const openTaskCount = perfSpec ? countOpenTasks(perfSpec.tasksPath) : null;

  console.log('=== OverlayTerm heartbeat pass ===');
  console.log(`branch: ${safeRunGit(['branch', '--show-current']) || '(detached)'}`);
  console.log(`head: ${safeRunGit(['rev-parse', '--short', 'HEAD'])}`);
  console.log(`changed files: ${files.length}`);
  if (files.length) {
    for (const file of files.slice(0, 40)) {
      console.log(`  - ${file}`);
    }
    if (files.length > 40) {
      console.log(`  ... ${files.length - 40} more`);
    }
  }
  console.log(`kinds: ${kinds.length ? kinds.join(', ') : 'none'}`);
  console.log('recommended checks:');
  for (const check of checks) {
    console.log(`  - ${check}`);
  }

  if (perfSpec) {
    console.log(`active spec: ${perfSpec.slug}`);
    if (openTaskCount !== null) {
      console.log(`open tasks: ${openTaskCount}`);
    }
    console.log(`spec validation: python3 scripts/validate_spec.py ./.specs/${perfSpec.slug}`);
  }

  if (perfHints.length) {
    console.log('\nperformance validation hints:');
    for (const hint of perfHints) {
      console.log(`  - ${hint}`);
    }
  }

  if (args.has('--stat')) {
    console.log('\n=== git diff --stat ===');
    console.log(safeRunGit(['diff', '--stat']));
  }

  if (args.has('--untracked')) {
    console.log('\n=== untracked files ===');
    const untracked = safeRunGit(['status', '--short', '--untracked-files=all'])
      .split('\n')
      .filter((line) => line.startsWith('?? '))
      .map((line) => line.slice(3));
    for (const file of untracked) {
      console.log(`  - ${file}`);
    }
  }

  if (args.has('--workspace-summary')) {
    console.log('\n=== workspace roots ===');
    for (const entry of ['src', 'src-tauri', 'scripts', 'crates', 'themes', 'plugins']) {
      const fullPath = path.join(projectRoot, entry);
      console.log(`  - ${entry}: ${fs.existsSync(fullPath) ? 'present' : 'missing'}`);
    }
  }
}

main();
