const EXPLORER_SEARCH_SCOPE_PREFIX = 'file-explorer';
const DEFAULT_EXPLORER_SEARCH_SCOPE = `${EXPLORER_SEARCH_SCOPE_PREFIX}:instance`;

function normalizeScopeToken(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveExplorerSearchScope(instanceId: string): string {
  const normalizedInstanceId = normalizeScopeToken(instanceId);
  return normalizedInstanceId
    ? `${EXPLORER_SEARCH_SCOPE_PREFIX}:${normalizedInstanceId}`
    : DEFAULT_EXPLORER_SEARCH_SCOPE;
}
