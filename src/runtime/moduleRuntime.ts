import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  executeRuntimeModuleGraph,
  isSupportedRuntimeFile,
  transpileRuntimeModuleGraphLocal,
  transpileRuntimeModuleSourceLocal,
  unwrapRuntimeModuleExport,
  type RuntimeFileEntry,
  type RuntimeModuleGraph,
  type RuntimeRelativeModuleResolveArgs,
  type RuntimeRelativeModuleSourceResolver,
  type RuntimeResolvedRelativeModuleSource,
} from './moduleRuntimeCore';
import { runFrontendWorkerTask } from './workerHost';

export type {
  RuntimeFileEntry,
  RuntimeModuleGraph,
  RuntimeRelativeModuleResolveArgs,
  RuntimeRelativeModuleSourceResolver,
  RuntimeResolvedRelativeModuleSource,
};

export {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  executeRuntimeModuleGraph,
  isSupportedRuntimeFile,
  unwrapRuntimeModuleExport,
};

export async function transpileRuntimeModuleSource(
  source: string,
  prependCode = '',
): Promise<string> {
  return runFrontendWorkerTask({
    laneId: 'runtime-module',
    taskType: 'transpile-runtime-module-source',
    payload: {
      source,
      prependCode,
    },
    fallback: () => transpileRuntimeModuleSourceLocal(source, prependCode),
  });
}

export async function transpileRuntimeModuleGraph(args: {
  entryModulePath: string;
  entrySource: string;
  prependCode?: string;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
}): Promise<RuntimeModuleGraph> {
  return transpileRuntimeModuleGraphLocal({
    ...args,
    transpileModuleSource: transpileRuntimeModuleSource,
  });
}
