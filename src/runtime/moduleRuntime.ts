export interface RuntimeFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  modified: number;
  extension: string;
}

export interface RuntimeRelativeModuleResolveArgs {
  fromModulePath: string;
  specifier: string;
}

export interface RuntimeResolvedRelativeModuleSource {
  modulePath: string;
  source: string;
}

export type RuntimeRelativeModuleSourceResolver = (
  args: RuntimeRelativeModuleResolveArgs,
) => Promise<RuntimeResolvedRelativeModuleSource | null>;

export interface RuntimeModuleGraph {
  entryModulePath: string;
  moduleCodeByPath: Record<string, string>;
  relativeSpecifierResolutionsByModulePath: Record<string, Record<string, string>>;
}

let typescriptModulePromise: Promise<typeof import('typescript')> | null = null;

function loadTypeScriptModule(): Promise<typeof import('typescript')> {
  if (!typescriptModulePromise) {
    typescriptModulePromise = import('typescript');
  }
  return typescriptModulePromise;
}

export function isSupportedRuntimeFile(
  entry: RuntimeFileEntry,
  extensions: readonly string[],
): boolean {
  return !entry.is_dir
    && extensions.includes(entry.extension.toLowerCase());
}

export function deriveRuntimeModuleId(name: string, fallback = 'module'): string {
  return name
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

export function deriveRuntimeModuleName(name: string, fallback = 'Module'): string {
  const base = name.replace(/\.[^.]+$/, '');
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase()) || fallback;
}

export async function transpileRuntimeModuleSource(
  source: string,
  prependCode = '',
): Promise<string> {
  const ts = await loadTypeScriptModule();
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    reportDiagnostics: true,
  });

  const diagnostics = transpiled.diagnostics
    ?.map(diagnostic => (
      typeof diagnostic.messageText === 'string'
        ? diagnostic.messageText
        : diagnostic.messageText.messageText
    ))
    .filter(Boolean);

  if (diagnostics && diagnostics.length > 0) {
    throw new Error(diagnostics.join('\n'));
  }

  return `${prependCode}${transpiled.outputText}`;
}

function extractRuntimeRequireSpecifiers(code: string): string[] {
  const specifiers = new Set<string>();
  for (const match of code.matchAll(/\brequire\((['"])([^'"]+)\1\)/g)) {
    const specifier = match[2]?.trim();
    if (specifier) {
      specifiers.add(specifier);
    }
  }
  return [...specifiers];
}

function isRelativeRuntimeSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

export async function transpileRuntimeModuleGraph(args: {
  entryModulePath: string;
  entrySource: string;
  prependCode?: string;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
}): Promise<RuntimeModuleGraph> {
  const moduleCodeByPath = new Map<string, string>();
  const relativeSpecifierResolutionsByModulePath = new Map<string, Record<string, string>>();
  const compilePromises = new Map<string, Promise<void>>();

  const compileModule = async (modulePath: string, source: string): Promise<void> => {
    const existing = compilePromises.get(modulePath);
    if (existing) {
      return existing;
    }

    const compilePromise = (async () => {
      const transpiledCode = await transpileRuntimeModuleSource(source, args.prependCode ?? '');
      const relativeSpecifierResolutions: Record<string, string> = {};
      relativeSpecifierResolutionsByModulePath.set(modulePath, relativeSpecifierResolutions);

      for (const specifier of extractRuntimeRequireSpecifiers(transpiledCode)) {
        if (!isRelativeRuntimeSpecifier(specifier)) {
          continue;
        }

        if (!args.resolveRelativeModuleSource) {
          throw new Error(
            `Relative import "${specifier}" in "${modulePath}" requires a relative module source resolver.`,
          );
        }

        const resolvedModule = await args.resolveRelativeModuleSource({
          fromModulePath: modulePath,
          specifier,
        });
        if (!resolvedModule) {
          throw new Error(`Could not resolve relative import "${specifier}" from "${modulePath}".`);
        }

        relativeSpecifierResolutions[specifier] = resolvedModule.modulePath;
        await compileModule(resolvedModule.modulePath, resolvedModule.source);
      }

      moduleCodeByPath.set(modulePath, transpiledCode);
    })();

    compilePromises.set(modulePath, compilePromise);
    return compilePromise;
  };

  await compileModule(args.entryModulePath, args.entrySource);

  return {
    entryModulePath: args.entryModulePath,
    moduleCodeByPath: Object.fromEntries(moduleCodeByPath),
    relativeSpecifierResolutionsByModulePath: Object.fromEntries(relativeSpecifierResolutionsByModulePath),
  };
}

export function executeRuntimeModule(
  code: string,
  allowedModules: Record<string, unknown>,
): unknown {
  const module = { exports: {} as Record<string, unknown> };

  const require = (specifier: string) => {
    if (!(specifier in allowedModules)) {
      throw new Error(
        `Unsupported import "${specifier}". Allowed imports: ${Object.keys(allowedModules).join(', ')}`,
      );
    }
    return allowedModules[specifier];
  };

  const runner = new Function('module', 'exports', 'require', code);
  runner(module, module.exports, require);
  return module.exports;
}

export function executeRuntimeModuleGraph(
  graph: RuntimeModuleGraph,
  allowedModules: Record<string, unknown>,
): unknown {
  const moduleCache = new Map<string, { exports: Record<string, unknown> }>();

  const executeModuleByPath = (modulePath: string): unknown => {
    const cachedModule = moduleCache.get(modulePath);
    if (cachedModule) {
      return cachedModule.exports;
    }

    const code = graph.moduleCodeByPath[modulePath];
    if (!code) {
      throw new Error(`Runtime module graph is missing compiled code for "${modulePath}".`);
    }

    const module = { exports: {} as Record<string, unknown> };
    moduleCache.set(modulePath, module);

    const require = (specifier: string) => {
      if (specifier in allowedModules) {
        return allowedModules[specifier];
      }

      const resolvedModulePath = graph.relativeSpecifierResolutionsByModulePath[modulePath]?.[specifier];
      if (resolvedModulePath) {
        return executeModuleByPath(resolvedModulePath);
      }

      throw new Error(
        `Unsupported import "${specifier}". Allowed imports: ${Object.keys(allowedModules).join(', ')}`,
      );
    };

    const runner = new Function('module', 'exports', 'require', code);
    runner(module, module.exports, require);
    return module.exports;
  };

  return executeModuleByPath(graph.entryModulePath);
}

export function unwrapRuntimeModuleExport(
  exported: unknown,
  preferredKeys: string[] = [],
): unknown {
  if (!exported || typeof exported !== 'object') {
    return exported;
  }

  const record = exported as Record<string, unknown>;
  for (const key of ['default', ...preferredKeys]) {
    if (key in record) {
      return record[key];
    }
  }

  return record;
}
