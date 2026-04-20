export const DEFAULT_EXPLORER_PREVIEW_CACHE_BUDGET_BYTES = 500 * 1024 * 1024;

type ExplorerPreviewCacheEntry<Value> = {
  path: string;
  value: Value;
  bytes: number;
  lastAccessedAt: number;
};

export class ExplorerPreviewCache<Value> {
  private readonly entries = new Map<string, ExplorerPreviewCacheEntry<Value>>();
  private currentBytes = 0;

  constructor(private readonly budgetBytes = DEFAULT_EXPLORER_PREVIEW_CACHE_BUDGET_BYTES) {}

  read(key: string): Value | null {
    const cachedEntry = this.entries.get(key);
    if (!cachedEntry) {
      return null;
    }

    this.entries.delete(key);
    cachedEntry.lastAccessedAt = Date.now();
    this.entries.set(key, cachedEntry);
    return cachedEntry.value;
  }

  write(args: {
    key: string;
    path: string;
    value: Value;
    bytes: number;
  }): string[] {
    const normalizedBytes = Math.max(0, Math.floor(args.bytes));
    const existingEntry = this.entries.get(args.key);
    if (existingEntry) {
      this.entries.delete(args.key);
      this.currentBytes -= existingEntry.bytes;
    }

    if (normalizedBytes > this.budgetBytes) {
      return [];
    }

    const evictedKeys: string[] = [];
    while (
      this.entries.size > 0 &&
      this.currentBytes + normalizedBytes > this.budgetBytes
    ) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.delete(oldestKey);
      evictedKeys.push(oldestKey);
    }

    this.entries.set(args.key, {
      path: args.path,
      value: args.value,
      bytes: normalizedBytes,
      lastAccessedAt: Date.now(),
    });
    this.currentBytes += normalizedBytes;
    return evictedKeys;
  }

  delete(key: string): void {
    const existingEntry = this.entries.get(key);
    if (!existingEntry) {
      return;
    }

    this.entries.delete(key);
    this.currentBytes -= existingEntry.bytes;
  }

  invalidate(pathPrefix?: string): void {
    if (!pathPrefix) {
      this.clear();
      return;
    }

    for (const [key, entry] of this.entries) {
      if (matchesExplorerPreviewPathPrefix(entry.path, pathPrefix)) {
        this.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
    this.currentBytes = 0;
  }

  getStats(): {
    budgetBytes: number;
    currentBytes: number;
    entryCount: number;
  } {
    return {
      budgetBytes: this.budgetBytes,
      currentBytes: this.currentBytes,
      entryCount: this.entries.size,
    };
  }
}

const sharedExplorerPreviewCache = new ExplorerPreviewCache<unknown>();

export function readCachedExplorerPreview<Value>(key: string): Value | null {
  return (sharedExplorerPreviewCache.read(key) as Value | null) ?? null;
}

export function storeCachedExplorerPreview<Value>(args: {
  key: string;
  path: string;
  value: Value;
  bytes: number;
}): string[] {
  return sharedExplorerPreviewCache.write(args);
}

export function invalidateExplorerPreviewCache(pathPrefix?: string): void {
  sharedExplorerPreviewCache.invalidate(pathPrefix);
}

export function estimateStringPreviewCacheBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function matchesExplorerPreviewPathPrefix(path: string, pathPrefix: string): boolean {
  if (path === pathPrefix) {
    return true;
  }

  if (!path.startsWith(pathPrefix)) {
    return false;
  }

  const boundary = path.charAt(pathPrefix.length);
  return boundary === "" || boundary === "/" || boundary === "\\";
}
