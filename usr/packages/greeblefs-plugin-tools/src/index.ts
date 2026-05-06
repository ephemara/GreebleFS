export const greeblePluginToolsVersion = '1.0.0';

type AnyRecord = Record<string, any>;
type AnyPluginApi = AnyRecord;

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return typeof error === 'string' && error.trim() ? error : 'Unknown plugin error';
}

export function normalizePluginPathPart(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^[\\/]+|[\\/]+$/g, '');
}

export function joinPluginPath(...parts: unknown[]): string {
  const firstRaw = typeof parts[0] === 'string' ? parts[0] : '';
  const drivePrefix = firstRaw.match(/^([A-Za-z]:)[\\/]/)?.[1] ?? '';
  const normalizedParts = parts
    .map(normalizePluginPathPart)
    .flatMap(part => part.split('/'))
    .filter(Boolean);
  if (normalizedParts.length === 0) {
    return '';
  }
  if (drivePrefix && normalizedParts[0] === drivePrefix) {
    normalizedParts.shift();
  }
  const prefix = drivePrefix ? `${drivePrefix}/` : '';
  return `${prefix}${normalizedParts.join('/')}`.replace(/\/+/g, '/');
}

export function getParentPluginPath(path: string): string {
  const normalized = String(path ?? '').replace(/\\/g, '/').replace(/\/+$/g, '');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

export function safeJsonParse<TValue>(source: string, fallback: TValue): TValue {
  try {
    return JSON.parse(source) as TValue;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown, space = 2): string {
  return JSON.stringify(value, null, space) ?? 'null';
}

function requireHostFiles(api: AnyPluginApi) {
  const files = api?.host?.files;
  if (!files) {
    throw new Error('Plugin host file API is not available.');
  }
  return files;
}

export function createFileOperations(api: AnyPluginApi) {
  const files = requireHostFiles(api);
  const storage = api?.storage;

  const readText = (path: string) => files.readText(path);
  const writeText = (path: string, content: unknown) => files.writeText(path, String(content ?? ''));
  const stat = (path: string) => files.stat(path);
  const listDirectory = (path: string, showHidden = false) => files.listDirectory(path, showHidden);

  return {
    readText,
    writeText,
    readJson: async <TValue = unknown>(path: string, fallback?: TValue): Promise<TValue> => {
      if (typeof files.readJson === 'function') {
        return files.readJson(path, fallback);
      }
      try {
        return JSON.parse(await readText(path)) as TValue;
      } catch (error) {
        if (fallback !== undefined) {
          return fallback;
        }
        throw error;
      }
    },
    writeJson: async (path: string, value: unknown, space = 2) => {
      if (typeof files.writeJson === 'function') {
        await files.writeJson(path, value, space);
        return;
      }
      await writeText(path, stringifyJson(value, space));
    },
    listDirectory,
    stat,
    exists: async (path: string) => {
      if (typeof files.exists === 'function') {
        return files.exists(path);
      }
      return Boolean((await stat(path))?.exists);
    },
    ensureDirectory: (path: string) => files.createDirectory(path),
    createDirectory: (path: string) => files.createDirectory(path),
    deletePath: (path: string, options: { recursive?: boolean } = {}) => files.delete(path, options),
    deleteMany: (paths: string[]) => files.deleteMany(paths),
    rename: (oldPath: string, newPath: string) => files.rename(oldPath, newPath),
    move: (src: string, dst: string) => files.move(src, dst),
    copy: (src: string, dst: string) => files.copy(src, dst),
    trash: (paths: string[]) => files.trash(paths),
    watch: (request: AnyRecord) => files.watch(request),
    unwatch: (watchId: string) => files.unwatch(watchId),
    storageRoot: storage?.rootDir ?? '',
    ensureStorageDirectory: (relativePath = '') => {
      if (!storage?.ensureDir) {
        throw new Error('Plugin storage API is not available.');
      }
      return storage.ensureDir(relativePath);
    },
    readStorageText: (relativePath: string) => {
      if (!storage?.readTextFile) {
        throw new Error('Plugin storage API is not available.');
      }
      return storage.readTextFile(relativePath);
    },
    writeStorageText: async (relativePath: string, content: unknown) => {
      if (!storage?.writeTextFile) {
        throw new Error('Plugin storage API is not available.');
      }
      await storage.writeTextFile(relativePath, String(content ?? ''));
    },
    readStorageJson: async <TValue = unknown>(relativePath: string, fallback: TValue): Promise<TValue> => {
      if (!storage?.readTextFile) {
        return fallback;
      }
      return safeJsonParse(await storage.readTextFile(relativePath), fallback);
    },
    writeStorageJson: async (relativePath: string, value: unknown, space = 2) => {
      if (!storage?.writeTextFile) {
        throw new Error('Plugin storage API is not available.');
      }
      await storage.writeTextFile(relativePath, stringifyJson(value, space));
    },
  };
}

export function createPluginStore<TState extends AnyRecord>(
  api: AnyPluginApi,
  options: {
    path?: string;
    defaults: TState;
    space?: number;
  },
) {
  const fileOps = createFileOperations(api);
  const storagePath = options.path ?? 'state.json';
  const defaults = { ...options.defaults };
  const space = options.space ?? 2;

  return {
    path: storagePath,
    defaults,
    load: () => fileOps.readStorageJson<TState>(storagePath, defaults as TState),
    save: (state: TState) => fileOps.writeStorageJson(storagePath, state, space),
    patch: async (patch: Partial<TState> | ((current: TState) => Partial<TState>)) => {
      const current = await fileOps.readStorageJson<TState>(storagePath, defaults as TState);
      const nextPatch = typeof patch === 'function' ? patch(current) : patch;
      const next = { ...current, ...nextPatch };
      await fileOps.writeStorageJson(storagePath, next, space);
      return next;
    },
    reset: async () => {
      await fileOps.writeStorageJson(storagePath, defaults, space);
      return { ...defaults } as TState;
    },
  };
}

export function createWritePlan(rootPath: string) {
  const root = String(rootPath ?? '').replace(/[\\/]+$/g, '');
  const files: Array<{ path: string; content: string; label?: string }> = [];

  return {
    root,
    files,
    addText(relativePath: string, content: unknown, label?: string) {
      files.push({
        path: joinPluginPath(root, relativePath),
        content: String(content ?? ''),
        label,
      });
      return this;
    },
    addJson(relativePath: string, value: unknown, label?: string, space = 2) {
      files.push({
        path: joinPluginPath(root, relativePath),
        content: stringifyJson(value, space),
        label,
      });
      return this;
    },
    async write(api: AnyPluginApi) {
      const fileOps = createFileOperations(api);
      for (const file of files) {
        await fileOps.writeText(file.path, file.content);
      }
      return files.slice();
    },
  };
}

export const createPluginFileOperations = createFileOperations;
