export type ActionForgeMenuContext =
  | 'entry'
  | 'background'
  | 'multi-select'
  | 'search-result'
  | 'preview-pane';

export type ActionForgeAppliesTo = 'any' | 'file' | 'directory';
export type ActionForgeOutputTarget =
  | 'task-center'
  | 'preview-terminal'
  | 'native-terminal'
  | 'silent';
export type ActionForgeModeId =
  | 'powershell-script'
  | 'python-script'
  | 'javascript-script'
  | 'typescript-script'
  | 'bash-script'
  | 'inline-shell'
  | 'cargo-rust'
  | 'binary'
  | 'workflow';

export interface ActionForgeModeDefinition {
  id: ActionForgeModeId;
  label: string;
  badge: string;
  family: 'script' | 'inline-shell' | 'cargo' | 'binary' | 'workflow';
  runner: 'interpreter' | 'shell' | 'cargo' | 'binary' | null;
  directoryName?: string;
  fileExtension?: string;
  defaultInterpreter?: string;
}

export interface ActionPackSummary {
  id: string;
  name: string;
  path: string;
  manifestPath: string;
  readmePath: string;
  actionsPath: string;
  actionCount: number;
  hasManifest: boolean;
  hasReadme: boolean;
  description?: string;
}

export interface ActionForgeDraft {
  mode: ActionForgeModeId;
  packMode: 'existing' | 'new';
  selectedPackId: string;
  newPackName: string;
  newPackId: string;
  newPackDescription: string;
  packAuthor: string;
  packTagsText: string;
  actionName: string;
  actionId: string;
  actionDescription: string;
  iconName: string;
  actionTagsText: string;
  contexts: ActionForgeMenuContext[];
  appliesTo: ActionForgeAppliesTo;
  allowFiles: boolean;
  allowDirectories: boolean;
  minCountText: string;
  maxCountText: string;
  extensionsText: string;
  outputTarget: ActionForgeOutputTarget;
  entryRelativePath: string;
  runtimeOverride: string;
  argsText: string;
  envText: string;
  scriptBody: string;
  shellBody: string;
  workflowId: string;
  workflowPayloadText: string;
  overwriteExisting: boolean;
  revealAfterCreate: boolean;
}

export interface ActionForgeValidationIssue {
  level: 'error' | 'warning';
  field: string;
  message: string;
}

export interface GeneratedActionFile {
  path: string;
  label: string;
  content: string;
}

export interface GeneratedActionBlueprint {
  packId: string;
  packName: string;
  packPath: string;
  packManifestPath: string;
  packReadmePath: string;
  actionId: string;
  actionName: string;
  actionPath: string;
  actionManifestPath: string;
  mode: ActionForgeModeDefinition;
  files: GeneratedActionFile[];
  issues: ActionForgeValidationIssue[];
}

export const ACTION_FORGE_CONTEXT_LABELS: Record<ActionForgeMenuContext, string> = {
  entry: 'Entry',
  background: 'Background',
  'multi-select': 'Multi',
  'search-result': 'Search',
  'preview-pane': 'Preview',
};

export const ACTION_FORGE_MODE_CATALOG: ActionForgeModeDefinition[] = [
  {
    id: 'powershell-script',
    label: 'PowerShell Script',
    badge: 'PS1',
    family: 'script',
    runner: 'interpreter',
    directoryName: 'powershell',
    fileExtension: 'ps1',
  },
  {
    id: 'python-script',
    label: 'Python Script',
    badge: 'PY',
    family: 'script',
    runner: 'interpreter',
    directoryName: 'python',
    fileExtension: 'py',
  },
  {
    id: 'javascript-script',
    label: 'JavaScript Script',
    badge: 'JS',
    family: 'script',
    runner: 'interpreter',
    directoryName: 'javascript',
    fileExtension: 'js',
  },
  {
    id: 'typescript-script',
    label: 'TypeScript Script',
    badge: 'TS',
    family: 'script',
    runner: 'interpreter',
    directoryName: 'typescript',
    fileExtension: 'ts',
  },
  {
    id: 'bash-script',
    label: 'Bash Script',
    badge: 'SH',
    family: 'script',
    runner: 'interpreter',
    directoryName: 'bash',
    fileExtension: 'sh',
  },
  {
    id: 'inline-shell',
    label: 'Inline Shell',
    badge: 'CMD',
    family: 'inline-shell',
    runner: 'shell',
    defaultInterpreter: 'powershell',
  },
  {
    id: 'cargo-rust',
    label: 'Cargo / Rust',
    badge: 'RS',
    family: 'cargo',
    runner: 'cargo',
  },
  {
    id: 'binary',
    label: 'Binary',
    badge: 'BIN',
    family: 'binary',
    runner: 'binary',
  },
  {
    id: 'workflow',
    label: 'Workflow Launcher',
    badge: 'WF',
    family: 'workflow',
    runner: null,
  },
];

const DEFAULT_CONTEXTS: ActionForgeMenuContext[] = ['entry'];

function findMode(modeId: ActionForgeModeId): ActionForgeModeDefinition {
  return ACTION_FORGE_MODE_CATALOG.find((mode) => mode.id === modeId)
    ?? ACTION_FORGE_MODE_CATALOG[0];
}

function normalizeSeparator(path: string): '\\' | '/' {
  const slashIndex = path.lastIndexOf('/');
  const backslashIndex = path.lastIndexOf('\\');
  return backslashIndex > slashIndex ? '\\' : '/';
}

function trimPathEdges(value: string): string {
  return value.replace(/^[\\/]+|[\\/]+$/g, '');
}

export function joinPath(basePath: string, ...segments: string[]): string {
  const separator = normalizeSeparator(basePath);
  const base = basePath.replace(/[\\/]+$/g, '');
  const suffix = segments
    .flatMap((segment) => trimPathEdges(segment).split(/[\\/]+/g))
    .filter(Boolean)
    .join(separator);
  return suffix ? `${base}${separator}${suffix}` : base;
}

export function dirname(path: string): string {
  const normalized = path.replace(/[\\/]+$/g, '');
  const slashIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (slashIndex <= 0) {
    return normalized;
  }
  return normalized.slice(0, slashIndex);
}

export function resolveActionsRoot(pluginDirectory: string): string {
  return joinPath(dirname(dirname(pluginDirectory)), 'actions');
}

export function sanitizeSlug(value: string, fallback: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || fallback;
}

export function titleCaseSlug(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function splitTags(value: string): string[] {
  return value
    .split(/[\n\r,;]+/g)
    .map((entry) => sanitizeSlug(entry, ''))
    .filter(Boolean);
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitExtensions(value: string): string[] {
  return value
    .split(/[\n\r,;\s]+/g)
    .map((entry) => entry.replace(/^\./, '').trim().toLowerCase())
    .filter(Boolean);
}

function parseOptionalCount(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed);
}

function parseEnvironmentText(value: string): {
  values: Record<string, string>;
  issues: ActionForgeValidationIssue[];
} {
  const values: Record<string, string> = {};
  const issues: ActionForgeValidationIssue[] = [];
  const lines = splitLines(value);
  for (const line of lines) {
    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      issues.push({
        level: 'error',
        field: 'envText',
        message: `Environment lines must be KEY=value: ${line}`,
      });
      continue;
    }
    const key = line.slice(0, equalsIndex).trim();
    const envValue = line.slice(equalsIndex + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      issues.push({
        level: 'error',
        field: 'envText',
        message: `Environment key is invalid: ${key}`,
      });
      continue;
    }
    values[key] = envValue;
  }
  return { values, issues };
}

function parseWorkflowPayloadText(value: string): {
  payload: Record<string, unknown> | null;
  issues: ActionForgeValidationIssue[];
} {
  if (!value.trim()) {
    return { payload: null, issues: [] };
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        payload: null,
        issues: [{
          level: 'error',
          field: 'workflowPayloadText',
          message: 'Workflow payload must be a JSON object.',
        }],
      };
    }
    return { payload: parsed as Record<string, unknown>, issues: [] };
  } catch (error) {
    return {
      payload: null,
      issues: [{
        level: 'error',
        field: 'workflowPayloadText',
        message: `Workflow payload is not valid JSON: ${String(error)}`,
      }],
    };
  }
}

function quoteTomlString(value: string): string {
  return JSON.stringify(value);
}

function quoteTomlStringArray(values: string[]): string {
  return `[${values.map(quoteTomlString).join(', ')}]`;
}

function quoteTomlInlineValue(value: unknown): string {
  if (typeof value === 'string') {
    return quoteTomlString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(quoteTomlInlineValue).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    return `{ ${Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key} = ${quoteTomlInlineValue(entry)}`)
      .join(', ')} }`;
  }
  return 'null';
}

function quoteTomlEntryValue(value: string): string {
  if (value.includes('\n')) {
    return `'''\n${value.replace(/\r\n/g, '\n')}\n'''`;
  }
  if (value.includes('"') && !value.includes("'''")) {
    return `'''${value}'''`;
  }
  return quoteTomlString(value);
}

function createPowerShellTemplate(actionName: string): string {
  return [
    `$contextPath = $env:GREEBLEFS_ACTION_CONTEXT_FILE`,
    `$context = $null`,
    `if ($contextPath -and (Test-Path $contextPath)) {`,
    `  $context = Get-Content -LiteralPath $contextPath -Raw | ConvertFrom-Json`,
    `}`,
    ``,
    `Write-Output "${actionName}"`,
    `Write-Output "Primary: $($env:GREEBLEFS_PRIMARY_PATH)"`,
    `Write-Output "Selected: $($env:GREEBLEFS_SELECTED_COUNT)"`,
    `Write-Output ""`,
    `if ($context -and $context.invocation) {`,
    `  Write-Output "Current location: $($context.invocation.currentLocation)"`,
    `}`,
  ].join('\n');
}

function createPythonTemplate(actionName: string): string {
  return [
    'from __future__ import annotations',
    '',
    'import json',
    'import os',
    'from pathlib import Path',
    '',
    '',
    'def load_context() -> dict | None:',
    '    context_path = os.environ.get("GREEBLEFS_ACTION_CONTEXT_FILE", "").strip()',
    '    if not context_path:',
    '        return None',
    '    path = Path(context_path)',
    '    if not path.exists():',
    '        return None',
    '    return json.loads(path.read_text(encoding="utf-8"))',
    '',
    '',
    'context = load_context() or {}',
    'invocation = context.get("invocation") or {}',
    '',
    `print(${JSON.stringify(actionName)})`,
    'print(f"Primary: {os.environ.get(\'GREEBLEFS_PRIMARY_PATH\', \'<none>\')}")',
    'print(f"Selected: {os.environ.get(\'GREEBLEFS_SELECTED_COUNT\', \'0\')}")',
    'print()',
    'print(f"Current location: {invocation.get(\'currentLocation\', \'<none>\')}")',
  ].join('\n');
}

function createJavascriptTemplate(actionName: string, typed = false): string {
  const header = typed
    ? [
      'type ActionContextPayload = {',
      '  invocation?: {',
      '    currentLocation?: string;',
      '  };',
      '};',
      '',
    ].join('\n')
    : '';
  return [
    header,
    "import fs from 'node:fs';",
    '',
    'function loadContext() {',
    "  const contextPath = (process.env.GREEBLEFS_ACTION_CONTEXT_FILE || '').trim();",
    '  if (!contextPath || !fs.existsSync(contextPath)) {',
    '    return null;',
    '  }',
    "  return JSON.parse(fs.readFileSync(contextPath, 'utf8'));",
    '}',
    '',
    typed ? 'const context = (loadContext() ?? null) as ActionContextPayload | null;' : 'const context = loadContext();',
    '',
    `console.log(${JSON.stringify(actionName)});`,
    "console.log(`Primary: ${process.env.GREEBLEFS_PRIMARY_PATH || '<none>'}`);",
    "console.log(`Selected: ${process.env.GREEBLEFS_SELECTED_COUNT || '0'}`);",
    'console.log();',
    "console.log(`Current location: ${context?.invocation?.currentLocation || '<none>'}`);",
  ].join('\n');
}

function createBashTemplate(actionName: string): string {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    `printf '%s\n' ${JSON.stringify(actionName)}`,
    `printf 'Primary: %s\n' "\${GREEBLEFS_PRIMARY_PATH:-<none>}"`,
    `printf 'Selected: %s\n' "\${GREEBLEFS_SELECTED_COUNT:-0}"`,
    `printf '\nCurrent location: %s\n' "\${GREEBLEFS_CURRENT_LOCATION:-<none>}"`,
  ].join('\n');
}

function createInlineShellTemplate(): string {
  return [
    "Write-Output 'Action Forge inline shell'",
    'Write-Output "Primary: $env:GREEBLEFS_PRIMARY_PATH"',
    'Write-Output "Selected: $env:GREEBLEFS_SELECTED_COUNT"',
  ].join('\n');
}

function createCargoManifest(packName: string, actionId: string): string {
  return [
    '[package]',
    `name = ${quoteTomlString(`${sanitizeSlug(packName, 'action-pack')}-${actionId}`)}`,
    'version = "0.1.0"',
    'edition = "2024"',
    '',
    '[dependencies]',
    'serde = { version = "1", features = ["derive"] }',
    'serde_json = "1"',
  ].join('\n');
}

function createCargoMain(actionName: string): string {
  return [
    'use std::env;',
    'use std::fs;',
    '',
    'fn main() {',
    `    println!(${JSON.stringify(actionName)});`,
    '    println!(',
    '        "Primary: {}",',
    '        env::var("GREEBLEFS_PRIMARY_PATH").unwrap_or_else(|_| "<none>".to_string())',
    '    );',
    '    println!(',
    '        "Selected: {}",',
    '        env::var("GREEBLEFS_SELECTED_COUNT").unwrap_or_else(|_| "0".to_string())',
    '    );',
    '',
    '    if let Ok(context_path) = env::var("GREEBLEFS_ACTION_CONTEXT_FILE") {',
    '        if let Ok(content) = fs::read_to_string(&context_path) {',
    '            println!();',
    '            println!("{}", content);',
    '        }',
    '    }',
    '}',
  ].join('\n');
}

function createPackManifest(packId: string, packName: string, draft: ActionForgeDraft): string {
  const tags = splitTags(draft.packTagsText);
  const lines = [
    'version = 1',
    `id = ${quoteTomlString(packId)}`,
    `name = ${quoteTomlString(packName)}`,
  ];
  if (draft.newPackDescription.trim()) {
    lines.push(`description = ${quoteTomlString(draft.newPackDescription.trim())}`);
  }
  if (draft.packAuthor.trim()) {
    lines.push(`author = ${quoteTomlString(draft.packAuthor.trim())}`);
  }
  if (tags.length > 0) {
    lines.push(`tags = ${quoteTomlStringArray(tags)}`);
  }
  return lines.join('\n');
}

function createPackReadme(packName: string, actionName: string, actionDescription: string): string {
  return [
    `# ${packName}`,
    '',
    'Action pack created with Action Forge.',
    '',
    '## Actions',
    '',
    `- **${actionName}**${actionDescription ? ` - ${actionDescription}` : ''}`,
  ].join('\n');
}

function buildActionManifest(
  draft: ActionForgeDraft,
  packId: string,
  actionId: string,
  mode: ActionForgeModeDefinition,
  entryRelativePath: string,
  payload: Record<string, unknown> | null,
): string {
  const tags = splitTags(draft.actionTagsText);
  const extensions = splitExtensions(draft.extensionsText);
  const args = splitLines(draft.argsText);
  const { values: envValues } = parseEnvironmentText(draft.envText);
  const minCount = parseOptionalCount(draft.minCountText);
  const maxCount = parseOptionalCount(draft.maxCountText);
  const lines: string[] = [
    'version = 1',
    `id = ${quoteTomlString(actionId)}`,
    `name = ${quoteTomlString(draft.actionName.trim())}`,
  ];

  if (draft.actionDescription.trim()) {
    lines.push(`description = ${quoteTomlString(draft.actionDescription.trim())}`);
  }
  if (draft.iconName.trim()) {
    lines.push(`icon = ${quoteTomlString(draft.iconName.trim())}`);
  }
  if (tags.length > 0) {
    lines.push(`tags = ${quoteTomlStringArray(tags)}`);
  }
  lines.push(`contexts = ${quoteTomlStringArray(draft.contexts)}`);
  lines.push(`appliesTo = ${quoteTomlString(draft.appliesTo)}`);
  lines.push('');
  lines.push('[selection]');
  if (minCount != null) {
    lines.push(`minCount = ${minCount}`);
  }
  if (maxCount != null) {
    lines.push(`maxCount = ${maxCount}`);
  }
  if (extensions.length > 0) {
    lines.push(`extensions = ${quoteTomlStringArray(extensions)}`);
  }
  lines.push(`allowFiles = ${draft.allowFiles ? 'true' : 'false'}`);
  lines.push(`allowDirectories = ${draft.allowDirectories ? 'true' : 'false'}`);

  if (mode.family !== 'workflow') {
    lines.push('');
    lines.push('[execution]');
    lines.push(`runner = ${quoteTomlString(mode.runner ?? 'interpreter')}`);
    lines.push(`entry = ${quoteTomlEntryValue(entryRelativePath)}`);
    if (args.length > 0) {
      lines.push(`args = ${quoteTomlStringArray(args)}`);
    }
    if (draft.runtimeOverride.trim()) {
      lines.push(`interpreter = ${quoteTomlString(draft.runtimeOverride.trim())}`);
    }
    if (Object.keys(envValues).length > 0) {
      lines.push('');
      lines.push('[execution.env]');
      for (const [key, value] of Object.entries(envValues)) {
        lines.push(`${key} = ${quoteTomlString(value)}`);
      }
    }
  }

  lines.push('');
  lines.push('[presentation]');
  if (mode.family === 'workflow') {
    lines.push('kind = "workflow"');
    lines.push(`workflowId = ${quoteTomlString(draft.workflowId.trim())}`);
    if (payload && Object.keys(payload).length > 0) {
      lines.push(`workflowPayload = ${quoteTomlInlineValue(payload)}`);
    }
  } else {
    lines.push(`outputTarget = ${quoteTomlString(draft.outputTarget)}`);
  }

  return lines.join('\n');
}

export function deriveDefaultEntryRelativePath(
  modeId: ActionForgeModeId,
  actionId: string,
): string {
  const safeActionId = sanitizeSlug(actionId, 'action');
  const mode = findMode(modeId);
  if (mode.family === 'script' && mode.directoryName && mode.fileExtension) {
    return `${mode.directoryName}/${safeActionId}.${mode.fileExtension}`;
  }
  if (mode.family === 'inline-shell') {
    return '';
  }
  if (mode.family === 'cargo') {
    return `cargo/${safeActionId}`;
  }
  if (mode.family === 'binary') {
    return `bin/${safeActionId}`;
  }
  return '';
}

export function deriveDefaultBody(
  modeId: ActionForgeModeId,
  actionName: string,
): string {
  switch (modeId) {
    case 'powershell-script':
      return createPowerShellTemplate(actionName);
    case 'python-script':
      return createPythonTemplate(actionName);
    case 'javascript-script':
      return createJavascriptTemplate(actionName, false);
    case 'typescript-script':
      return createJavascriptTemplate(actionName, true);
    case 'bash-script':
      return createBashTemplate(actionName);
    case 'inline-shell':
      return createInlineShellTemplate();
    case 'cargo-rust':
      return createCargoMain(actionName);
    default:
      return '';
  }
}

export function createDefaultActionForgeDraft(): ActionForgeDraft {
  const actionName = 'Selection Snapshot';
  const actionId = sanitizeSlug(actionName, 'selection-snapshot');
  return {
    mode: 'powershell-script',
    packMode: 'new',
    selectedPackId: '',
    newPackName: 'Custom Actions Pack',
    newPackId: 'custom-actions-pack',
    newPackDescription: 'Custom actions authored through Action Forge.',
    packAuthor: '',
    packTagsText: 'custom, actions',
    actionName,
    actionId,
    actionDescription: 'Print the active selection context into the task center.',
    iconName: 'Sparkles',
    actionTagsText: 'custom, selection',
    contexts: [...DEFAULT_CONTEXTS],
    appliesTo: 'any',
    allowFiles: true,
    allowDirectories: true,
    minCountText: '1',
    maxCountText: '',
    extensionsText: '',
    outputTarget: 'task-center',
    entryRelativePath: deriveDefaultEntryRelativePath('powershell-script', actionId),
    runtimeOverride: '',
    argsText: '',
    envText: '',
    scriptBody: deriveDefaultBody('powershell-script', actionName),
    shellBody: createInlineShellTemplate(),
    workflowId: '',
    workflowPayloadText: '{\n  "source": "action-forge"\n}',
    overwriteExisting: false,
    revealAfterCreate: true,
  };
}

export function buildActionBlueprint(options: {
  actionsRoot: string;
  draft: ActionForgeDraft;
  selectedPack: ActionPackSummary | null;
}): GeneratedActionBlueprint {
  const { actionsRoot, draft, selectedPack } = options;
  const mode = findMode(draft.mode);
  const issues: ActionForgeValidationIssue[] = [];

  const packName = draft.packMode === 'existing'
    ? selectedPack?.name?.trim() || titleCaseSlug(draft.selectedPackId || 'actions')
    : (draft.newPackName.trim() || titleCaseSlug(draft.newPackId || 'custom-actions-pack'));
  const packId = draft.packMode === 'existing'
    ? sanitizeSlug(draft.selectedPackId, 'actions-pack')
    : sanitizeSlug(draft.newPackId || draft.newPackName, 'custom-actions-pack');
  const actionName = draft.actionName.trim();
  const actionId = sanitizeSlug(draft.actionId || actionName, 'custom-action');

  if (!packId) {
    issues.push({ level: 'error', field: 'packId', message: 'Pack id is required.' });
  }
  if (!actionName) {
    issues.push({ level: 'error', field: 'actionName', message: 'Action name is required.' });
  }
  if (!actionId) {
    issues.push({ level: 'error', field: 'actionId', message: 'Action id is required.' });
  }
  if (draft.contexts.length === 0) {
    issues.push({
      level: 'error',
      field: 'contexts',
      message: 'At least one menu context is required.',
    });
  }
  if (!draft.allowFiles && !draft.allowDirectories) {
    issues.push({
      level: 'error',
      field: 'selectionKinds',
      message: 'Allow files or directories.',
    });
  }
  const minCount = parseOptionalCount(draft.minCountText);
  const maxCount = parseOptionalCount(draft.maxCountText);
  if (draft.minCountText.trim() && minCount == null) {
    issues.push({
      level: 'error',
      field: 'minCountText',
      message: 'Minimum count must be a non-negative integer.',
    });
  }
  if (draft.maxCountText.trim() && maxCount == null) {
    issues.push({
      level: 'error',
      field: 'maxCountText',
      message: 'Maximum count must be a non-negative integer.',
    });
  }
  if (minCount != null && maxCount != null && maxCount < minCount) {
    issues.push({
      level: 'error',
      field: 'maxCountText',
      message: 'Maximum count cannot be smaller than minimum count.',
    });
  }

  const entryRelativePath = mode.family === 'inline-shell'
    ? draft.shellBody
    : mode.family === 'workflow'
      ? ''
      : (draft.entryRelativePath.trim()
        || deriveDefaultEntryRelativePath(mode.id, actionId));

  if (mode.family === 'script' && !draft.scriptBody.trim()) {
    issues.push({
      level: 'error',
      field: 'scriptBody',
      message: 'Script body cannot be empty.',
    });
  }
  if (mode.family === 'inline-shell' && !draft.shellBody.trim()) {
    issues.push({
      level: 'error',
      field: 'shellBody',
      message: 'Inline shell body cannot be empty.',
    });
  }
  if ((mode.family === 'cargo' || mode.family === 'binary') && !entryRelativePath.trim()) {
    issues.push({
      level: 'error',
      field: 'entryRelativePath',
      message: 'Entry path is required for this action mode.',
    });
  }
  if (mode.family === 'workflow' && !draft.workflowId.trim()) {
    issues.push({
      level: 'error',
      field: 'workflowId',
      message: 'Workflow id is required.',
    });
  }

  const envResult = parseEnvironmentText(draft.envText);
  issues.push(...envResult.issues);

  const workflowPayloadResult = parseWorkflowPayloadText(draft.workflowPayloadText);
  issues.push(...workflowPayloadResult.issues);

  const packPath = joinPath(actionsRoot, packId);
  const actionPath = joinPath(packPath, 'actions', actionId);
  const actionManifestPath = joinPath(actionPath, 'action.toml');
  const packManifestPath = joinPath(packPath, 'action-pack.toml');
  const packReadmePath = joinPath(packPath, 'README.md');

  const files: GeneratedActionFile[] = [];
  const shouldEmitPackManifest = draft.packMode === 'new' || !selectedPack?.hasManifest;
  const shouldEmitPackReadme = draft.packMode === 'new' || !selectedPack?.hasReadme;

  if (shouldEmitPackManifest) {
    files.push({
      path: packManifestPath,
      label: 'Pack Manifest',
      content: createPackManifest(packId, packName, draft),
    });
  }
  if (shouldEmitPackReadme) {
    files.push({
      path: packReadmePath,
      label: 'Pack README',
      content: createPackReadme(packName, actionName, draft.actionDescription.trim()),
    });
  }

  let generatedEntryPath = entryRelativePath;
  if (mode.family === 'script') {
    const scriptContent = draft.scriptBody.replace(/\r\n/g, '\n');
    generatedEntryPath = draft.entryRelativePath.trim()
      || deriveDefaultEntryRelativePath(mode.id, actionId);
    files.push({
      path: joinPath(actionPath, generatedEntryPath),
      label: `${mode.badge} Script`,
      content: scriptContent,
    });
  } else if (mode.family === 'cargo') {
    const cargoDirectory = joinPath(actionPath, entryRelativePath);
    files.push({
      path: joinPath(cargoDirectory, 'Cargo.toml'),
      label: 'Cargo Manifest',
      content: createCargoManifest(packName, actionId),
    });
    files.push({
      path: joinPath(cargoDirectory, 'src', 'main.rs'),
      label: 'Cargo Main',
      content: draft.scriptBody.replace(/\r\n/g, '\n') || createCargoMain(actionName),
    });
  }

  files.push({
    path: actionManifestPath,
    label: 'Action Manifest',
    content: buildActionManifest(
      draft,
      packId,
      actionId,
      mode,
      mode.family === 'inline-shell' ? draft.shellBody.replace(/\r\n/g, '\n') : generatedEntryPath,
      workflowPayloadResult.payload,
    ),
  });

  return {
    packId,
    packName,
    packPath,
    packManifestPath,
    packReadmePath,
    actionId,
    actionName,
    actionPath,
    actionManifestPath,
    mode,
    files,
    issues,
  };
}
