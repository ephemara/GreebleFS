#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_ROOTS = ['src', 'src-mobile'];
const DEFAULT_BASELINE = 'scripts/ui-literal-audit.baseline.json';
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.sass', '.html']);
const IGNORED_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'target',
  'vendor',
  'generated',
  '.git',
]);

const RULES = [
  {
    id: 'hex-color',
    description: 'raw hex color literal',
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
  },
  {
    id: 'functional-color',
    description: 'raw rgb/rgba/hsl/hsla color literal',
    pattern: /\b(?:rgb|rgba|hsl|hsla)\s*\(/g,
  },
  {
    id: 'px-length',
    description: 'raw px length literal',
    pattern: /(?<![A-Za-z0-9_-])\d+(?:\.\d+)?px\b/g,
  },
  {
    id: 'blur-length',
    description: 'raw blur(px) literal',
    pattern: /\bblur\(\s*\d+(?:\.\d+)?px\s*\)/g,
  },
  {
    id: 'shadow-literal',
    description: 'raw shadow literal',
    pattern: /(?:boxShadow\s*:|box-shadow\s*:|textShadow\s*:|text-shadow\s*:|filter\s*:\s*drop-shadow\(|\b\d+(?:\.\d+)?px\s+\d+(?:\.\d+)?px\s+\d+(?:\.\d+)?px\s+(?:rgba?\(|#[0-9a-fA-F]))/g,
  },
  {
    id: 'z-layer',
    description: 'raw z-index layer literal',
    pattern: /(?:zIndex\s*:|z-index\s*:)\s*-?\d+/g,
  },
  {
    id: 'duration-ms',
    description: 'raw millisecond duration literal',
    pattern: /\b\d+(?:\.\d+)?ms\b/g,
  },
  {
    id: 'easing',
    description: 'raw cubic-bezier literal',
    pattern: /\bcubic-bezier\s*\(/g,
  },
];

function parseArgs(argv) {
  const options = {
    roots: [],
    baseline: DEFAULT_BASELINE,
    updateBaseline: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      const root = argv[index + 1];
      if (!root) {
        throw new Error('--root requires a path');
      }
      options.roots.push(root);
      index += 1;
      continue;
    }
    if (arg === '--baseline') {
      const baseline = argv[index + 1];
      if (!baseline) {
        throw new Error('--baseline requires a path');
      }
      options.baseline = baseline;
      index += 1;
      continue;
    }
    if (arg === '--update-baseline') {
      options.updateBaseline = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.roots.length === 0) {
    options.roots = [...DEFAULT_ROOTS];
  }

  return options;
}

function normalizePathForBaseline(filePath, repoRoot) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function shouldIgnorePath(filePath, repoRoot) {
  const relative = normalizePathForBaseline(filePath, repoRoot);
  const segments = relative.split('/');
  if (segments.some(segment => IGNORED_SEGMENTS.has(segment))) {
    return true;
  }
  return /\.test\.[cm]?[jt]sx?$/.test(relative)
    || /\.spec\.[cm]?[jt]sx?$/.test(relative)
    || relative.endsWith('.d.ts');
}

async function collectFiles(rootPath, repoRoot) {
  const absoluteRoot = path.resolve(repoRoot, rootPath);
  const files = [];

  async function walk(directory) {
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (String(error).includes('ENOENT')) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (shouldIgnorePath(entryPath, repoRoot)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (entry.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  await walk(absoluteRoot);
  return files;
}

function normalizeLineForFingerprint(line) {
  return line.trim().replace(/\s+/g, ' ');
}

function createFingerprint(violation) {
  return [
    violation.path,
    violation.ruleId,
    normalizeLineForFingerprint(violation.lineText),
  ].join('|');
}

function scanTextForViolations(text, relativePath) {
  const violations = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((lineText, lineIndex) => {
    if (lineText.includes('ui-literal-audit: allow')) {
      return;
    }

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let match = rule.pattern.exec(lineText);
      while (match) {
        violations.push({
          path: relativePath,
          line: lineIndex + 1,
          column: match.index + 1,
          ruleId: rule.id,
          description: rule.description,
          snippet: match[0],
          lineText,
        });
        match = rule.pattern.exec(lineText);
      }
    }
  });

  return violations;
}

export async function scanUiLiteralViolations(options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? REPO_ROOT);
  const roots = options.roots ?? DEFAULT_ROOTS;
  const files = (await Promise.all(roots.map(root => collectFiles(root, repoRoot)))).flat();
  const violations = [];

  for (const filePath of files.sort()) {
    const text = await fs.readFile(filePath, 'utf8');
    const relativePath = normalizePathForBaseline(filePath, repoRoot);
    violations.push(...scanTextForViolations(text, relativePath));
  }

  return violations.map(violation => ({
    ...violation,
    fingerprint: createFingerprint(violation),
  }));
}

async function readBaseline(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(text);
  const fingerprints = Array.isArray(parsed.fingerprints)
    ? parsed.fingerprints.filter(entry => typeof entry === 'string')
    : [];
  return new Set(fingerprints);
}

async function writeBaseline(filePath, violations, roots) {
  const uniqueFingerprints = Array.from(new Set(violations.map(violation => violation.fingerprint))).sort();
  const baseline = {
    version: 1,
    generatedBy: 'scripts/audit-ui-literals.mjs',
    roots,
    fingerprintCount: uniqueFingerprints.length,
    fingerprints: uniqueFingerprints,
  };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(baseline, null, 2)}\n`);
}

function formatViolations(violations) {
  return violations
    .slice(0, 80)
    .map(violation => `${violation.path}:${violation.line}:${violation.column} ${violation.ruleId} ${violation.snippet}`)
    .join('\n');
}

export async function runUiLiteralAudit(cliOptions) {
  const repoRoot = REPO_ROOT;
  const roots = cliOptions.roots;
  const baselinePath = path.resolve(repoRoot, cliOptions.baseline);
  const violations = await scanUiLiteralViolations({ repoRoot, roots });

  if (cliOptions.updateBaseline) {
    await writeBaseline(baselinePath, violations, roots);
    return {
      ok: true,
      violations,
      newViolations: [],
      baselinePath,
      message: `Updated UI literal baseline with ${new Set(violations.map(violation => violation.fingerprint)).size} fingerprints.`,
    };
  }

  const baselineFingerprints = await readBaseline(baselinePath);
  const newViolations = violations.filter(violation => !baselineFingerprints.has(violation.fingerprint));

  return {
    ok: newViolations.length === 0,
    violations,
    newViolations,
    baselinePath,
    message: newViolations.length === 0
      ? `UI literal audit passed against ${baselineFingerprints.size} baseline fingerprints.`
      : `UI literal audit found ${newViolations.length} new hardcoded UI literal(s).`,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runUiLiteralAudit(options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.message);
      if (!result.ok) {
        console.error(formatViolations(result.newViolations));
        console.error('Move presentational values into /usr token or recipe files, or use // ui-literal-audit: allow for approved non-presentational math.');
      }
    }
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}
