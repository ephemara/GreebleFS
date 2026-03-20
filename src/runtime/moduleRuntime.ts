export interface RuntimeFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  modified: number;
  extension: string;
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
  const ts = await import('typescript');
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
