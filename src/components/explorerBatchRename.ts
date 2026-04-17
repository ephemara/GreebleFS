import type { ExplorerFileEntry } from '../runtime/explorerBackend';

export type ExplorerBatchRenameMode = 'literal' | 'regex';

export interface ExplorerBatchRenameRecipe {
  mode: ExplorerBatchRenameMode;
  findText: string;
  replaceText: string;
  prefix: string;
  suffix: string;
  startingNumber: number;
  padding: number;
}

export interface ExplorerBatchRenamePreviewRow {
  sourcePath: string;
  currentName: string;
  nextName: string;
  destinationPath: string;
  collision: boolean;
  validationError: string | null;
}

export interface ExplorerBatchRenamePreviewResult {
  rows: ExplorerBatchRenamePreviewRow[];
  validationError: string | null;
}

interface SplitEntryName {
  stem: string;
  extension: string;
}

const BATCH_RENAME_INDEX_TOKEN_PATTERN = /{{\s*index\s*}}/i;
const BATCH_RENAME_DATE_TOKEN_PATTERN = /{{\s*date\s*}}/gi;
const BATCH_RENAME_INDEX_TOKEN_PATTERN_GLOBAL = /{{\s*index\s*}}/gi;
const BATCH_RENAME_PARENT_TOKEN_PATTERN = /{{\s*parent\s*}}/gi;

export function buildExplorerBatchRenamePreview(
  entries: ExplorerFileEntry[],
  recipe: ExplorerBatchRenameRecipe,
): ExplorerBatchRenamePreviewResult {
  const renameTargets = entries.filter((entry) => !entry.is_dir);
  const validationError = validateBatchRenameRecipe(recipe);
  if (validationError) {
    return {
      rows: renameTargets.map((entry) => ({
        sourcePath: entry.path,
        currentName: entry.name,
        nextName: entry.name,
        destinationPath: entry.path,
        collision: true,
        validationError,
      })),
      validationError,
    };
  }

  const previewRows = renameTargets.map((entry, index) => {
    const splitName = splitEntryName(entry.name);
    const parentPath = getPathParent(entry.path);
    const formattedIndex = formatSequenceNumber(recipe.startingNumber + index, recipe.padding);
    const tokenContext = {
      date: formatLocalDateToken(new Date()),
      index: formattedIndex,
      parent: getPathLeaf(parentPath),
    };

    const transformedStem = applyRenameTransform(splitName.stem, recipe);
    const nextStem = applyRenameTokens(transformedStem, tokenContext);
    const prefix = applyRenameTokens(recipe.prefix, tokenContext);
    const suffix = applyRenameTokens(recipe.suffix, tokenContext);
    const shouldAppendSequentialIndex = !BATCH_RENAME_INDEX_TOKEN_PATTERN.test(
      `${recipe.findText}${recipe.replaceText}${recipe.prefix}${recipe.suffix}`,
    );
    const nextName = `${prefix}${nextStem}${suffix}${shouldAppendSequentialIndex ? formattedIndex : ''}${splitName.extension}`;

    const row: ExplorerBatchRenamePreviewRow = {
      sourcePath: entry.path,
      currentName: entry.name,
      nextName,
      destinationPath: joinPath(parentPath, nextName),
      collision: false,
      validationError: null,
    };
    return row;
  });
  const nextRows = previewRows.map((row) => ({ ...row, validationError }));
  const collisionCounts = new Map<string, number>();

  for (const row of nextRows) {
    collisionCounts.set(row.destinationPath, (collisionCounts.get(row.destinationPath) ?? 0) + 1);
  }

  for (const row of nextRows) {
    row.collision = Boolean(validationError) || (collisionCounts.get(row.destinationPath) ?? 0) > 1;
  }

  return {
    rows: nextRows,
    validationError,
  };
}

function validateBatchRenameRecipe(recipe: ExplorerBatchRenameRecipe): string | null {
  if (recipe.mode === 'regex' && recipe.findText.trim().length === 0) {
    return 'Regex mode requires a pattern.';
  }

  if (recipe.padding < 0 || !Number.isFinite(recipe.padding)) {
    return 'Padding must be a finite, non-negative number.';
  }

  if (!Number.isFinite(recipe.startingNumber)) {
    return 'Starting number must be finite.';
  }

  if (recipe.mode !== 'regex') {
    return null;
  }

  try {
    // Use the same matcher for preview and apply so the preview stays exact.
    new RegExp(recipe.findText, 'g');
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return `Invalid regex pattern: ${detail}`;
  }
}

function applyRenameTransform(stem: string, recipe: ExplorerBatchRenameRecipe): string {
  if (recipe.findText.trim().length === 0) {
    return stem;
  }

  if (recipe.mode === 'regex') {
    const regex = new RegExp(recipe.findText, 'g');
    return stem.replace(regex, normalizeRegexReplacement(recipe.replaceText));
  }

  return stem.split(recipe.findText).join(recipe.replaceText);
}

function applyRenameTokens(
  value: string,
  context: { date: string; index: string; parent: string },
): string {
  return value
    .replace(BATCH_RENAME_DATE_TOKEN_PATTERN, context.date)
    .replace(BATCH_RENAME_PARENT_TOKEN_PATTERN, context.parent)
    .replace(BATCH_RENAME_INDEX_TOKEN_PATTERN_GLOBAL, context.index);
}

function formatLocalDateToken(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSequenceNumber(value: number, padding: number): string {
  const width = Math.max(1, Math.trunc(padding) || 1);
  return String(Math.max(0, Math.trunc(value))).padStart(width, '0');
}

function normalizeRegexReplacement(value: string): string {
  return value.replace(/\$\{([A-Za-z_][\w]*)\}/g, '$<$1>');
}

function splitEntryName(name: string): SplitEntryName {
  const extensionMatch = name.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] ?? '';
  const stem = extension ? name.slice(0, -extension.length) : name;
  return { stem, extension };
}

function getPathParent(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const parentPath = trimmed.replace(/[/\\][^/\\]+$/, '');
  return parentPath && parentPath !== trimmed ? parentPath : '';
}

function getPathLeaf(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const match = trimmed.match(/([^/\\]+)$/);
  return match?.[1] ?? trimmed;
}

function joinPath(parentPath: string, leafName: string): string {
  if (!parentPath) {
    return leafName;
  }

  const separator = parentPath.includes('\\') ? '\\' : '/';
  return `${parentPath}${separator}${leafName}`;
}
