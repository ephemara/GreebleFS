import type { ManagedPythonRuntimeConfig } from './pythonRuntimeBackend';
import { createPythonSidecarActionRunner } from './pythonRuntimeBackend';

export interface LocalModelCacheSummary {
  pythonVersion: string;
  cacheRoot: string;
  huggingFaceCacheRoot: string;
  registryRoot: string;
  totalCacheSizeBytes: number;
  installedModelCount: number;
}

export interface LocalModelCatalogStatusEntry {
  modelId: string;
  installed: boolean;
  backendKinds: string[];
  providerKinds: string[];
  lastWarmedAtMs: number | null;
  lastUsedAtMs: number | null;
  lastError: string | null;
}

export interface LocalModelCatalogStatus extends LocalModelCacheSummary {
  models: LocalModelCatalogStatusEntry[];
}

export interface LocalModelPrewarmRequest {
  modelId: string;
  capabilityId?: string | null;
  backendPreference?: 'auto' | 'cpu' | 'onnx' | 'cuda' | null;
}

export interface LocalModelPrewarmResult extends LocalModelCacheSummary {
  modelId: string;
  providerModelId: string;
  backendKind: string;
  providerKind: string;
  backendPreference: string;
  message: string;
}

export interface LocalModelActionRequest<TPayload = unknown> {
  config: ManagedPythonRuntimeConfig | null;
  payload?: TPayload;
  startIfNeeded?: boolean | null;
}

export const getLocalModelCatalogStatus =
  createPythonSidecarActionRunner<Record<string, never>, LocalModelCatalogStatus>(
    'models.catalog_status',
  );

export const getLocalModelCacheSummary =
  createPythonSidecarActionRunner<Record<string, never>, LocalModelCacheSummary>(
    'models.cache_summary',
  );

export const prewarmLocalModel =
  createPythonSidecarActionRunner<LocalModelPrewarmRequest, LocalModelPrewarmResult>(
    'models.prewarm',
  );
