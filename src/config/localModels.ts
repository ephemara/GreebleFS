import localModelCatalogJson from './localModelCatalog.json';

export type LocalModelBackendPreference = 'auto' | 'cpu' | 'onnx' | 'cuda';
export type LocalModelCapabilityAvailability = 'active' | 'planned';

export interface LocalModelCatalogCacheDefinition {
  runtimeRelativeRoot: string;
  huggingFaceDirectoryName: string;
  registryDirectoryName: string;
}

export interface LocalModelBackendOption {
  id: LocalModelBackendPreference;
  label: string;
  description: string;
}

export interface LocalModelHardwareProfileDefinition {
  id: string;
  label: string;
  description: string;
}

export interface LocalModelCapabilityDefinition {
  id: string;
  label: string;
  description: string;
  availability: LocalModelCapabilityAvailability;
  supportsPerRootOverrides: boolean;
  defaultModelId: string | null;
  defaultBackendPreference: LocalModelBackendPreference;
  backendOptionIds: LocalModelBackendPreference[];
}

export interface LocalModelDefinition {
  id: string;
  label: string;
  description: string;
  provider: string;
  providerModelId: string;
  family: string;
  hardwareProfileId: string;
  recommendedBackendPreference: LocalModelBackendPreference;
  estimatedFootprintMb: number | null;
  capabilityIds: string[];
  tags: string[];
}

export interface LocalModelCatalogDefinition {
  schemaVersion: number;
  cache: LocalModelCatalogCacheDefinition;
  backendOptions: LocalModelBackendOption[];
  hardwareProfiles: LocalModelHardwareProfileDefinition[];
  capabilities: LocalModelCapabilityDefinition[];
  models: LocalModelDefinition[];
}

export interface LocalModelCapabilityBinding {
  modelId: string | null;
  backendPreference: LocalModelBackendPreference;
}

export interface LocalModelCapabilityBindingMap {
  [capabilityId: string]: LocalModelCapabilityBinding;
}

export interface LocalModelRootOverrideMap {
  [rootPath: string]: LocalModelCapabilityBinding;
}

export const localModelCatalog =
  localModelCatalogJson as LocalModelCatalogDefinition;

export const localModelBackendOptions = localModelCatalog.backendOptions;
export const localModelHardwareProfiles = localModelCatalog.hardwareProfiles;
export const localModelCapabilityCatalog = localModelCatalog.capabilities;
export const localModelDefinitions = localModelCatalog.models;

export const semanticIndexingCapabilityId = 'semantic-indexing';

export function normalizeLocalModelBackendPreference(
  value: unknown,
): LocalModelBackendPreference {
  return value === 'cpu' || value === 'onnx' || value === 'cuda' ? value : 'auto';
}

export function getLocalModelCapabilityDefinition(
  capabilityId: string,
): LocalModelCapabilityDefinition | null {
  return localModelCapabilityCatalog.find(capability => capability.id === capabilityId) ?? null;
}

export function getLocalModelDefinition(modelId: string | null | undefined): LocalModelDefinition | null {
  if (!modelId) {
    return null;
  }

  return localModelDefinitions.find(model => model.id === modelId) ?? null;
}

export function getLocalModelDefinitionByProviderModelId(
  providerModelId: string | null | undefined,
): LocalModelDefinition | null {
  if (!providerModelId) {
    return null;
  }

  return localModelDefinitions.find(model => model.providerModelId === providerModelId) ?? null;
}

export function getLocalModelHardwareProfile(
  hardwareProfileId: string | null | undefined,
): LocalModelHardwareProfileDefinition | null {
  if (!hardwareProfileId) {
    return null;
  }

  return localModelHardwareProfiles.find(profile => profile.id === hardwareProfileId) ?? null;
}

export function getCapabilityModels(capabilityId: string): LocalModelDefinition[] {
  return localModelDefinitions.filter(model => model.capabilityIds.includes(capabilityId));
}

export function createDefaultLocalModelCapabilityBindings(): LocalModelCapabilityBindingMap {
  return Object.fromEntries(
    localModelCapabilityCatalog.map(capability => [
      capability.id,
      {
        modelId: capability.defaultModelId,
        backendPreference: capability.defaultBackendPreference,
      },
    ]),
  );
}

export function normalizeLocalModelCapabilityBinding(
  binding: unknown,
  fallback: LocalModelCapabilityBinding,
): LocalModelCapabilityBinding {
  const source = binding && typeof binding === 'object'
    ? binding as Partial<LocalModelCapabilityBinding>
    : {};
  const normalizedModelId = typeof source.modelId === 'string'
    ? source.modelId.trim() || null
    : source.modelId === null
      ? null
      : fallback.modelId;
  return {
    modelId: normalizedModelId,
    backendPreference: normalizeLocalModelBackendPreference(source.backendPreference ?? fallback.backendPreference),
  };
}

export function normalizeLocalModelCapabilityBindingMap(
  value: unknown,
): LocalModelCapabilityBindingMap {
  const defaults = createDefaultLocalModelCapabilityBindings();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    localModelCapabilityCatalog.map(capability => [
      capability.id,
      normalizeLocalModelCapabilityBinding(
        source[capability.id],
        defaults[capability.id] ?? {
          modelId: capability.defaultModelId,
          backendPreference: capability.defaultBackendPreference,
        },
      ),
    ]),
  );
}

export function normalizeLocalModelRootOverrideMap(
  value: unknown,
  capabilityId: string,
): LocalModelRootOverrideMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const capability = getLocalModelCapabilityDefinition(capabilityId);
  const capabilityFallback: LocalModelCapabilityBinding = {
    modelId: capability?.defaultModelId ?? null,
    backendPreference: capability?.defaultBackendPreference ?? 'auto',
  };

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([rootPath, binding]) => {
        const trimmedRootPath = rootPath.trim();
        if (!trimmedRootPath) {
          return null;
        }

        return [
          trimmedRootPath,
          normalizeLocalModelCapabilityBinding(binding, capabilityFallback),
        ] as const;
      })
      .filter((entry): entry is readonly [string, LocalModelCapabilityBinding] => entry != null),
  );
}

export function resolveLocalModelCapabilityBinding(
  bindings: LocalModelCapabilityBindingMap,
  capabilityId: string,
): LocalModelCapabilityBinding {
  const capability = getLocalModelCapabilityDefinition(capabilityId);
  return bindings[capabilityId] ?? {
    modelId: capability?.defaultModelId ?? null,
    backendPreference: capability?.defaultBackendPreference ?? 'auto',
  };
}

export function resolveLocalModelBindingForRoot(
  bindings: LocalModelCapabilityBindingMap,
  capabilityId: string,
  rootPath: string | null | undefined,
  rootOverrides: LocalModelRootOverrideMap,
): LocalModelCapabilityBinding {
  const trimmedRootPath = rootPath?.trim() ?? '';
  if (trimmedRootPath && rootOverrides[trimmedRootPath]) {
    return rootOverrides[trimmedRootPath] as LocalModelCapabilityBinding;
  }

  return resolveLocalModelCapabilityBinding(bindings, capabilityId);
}

export function formatLocalModelEstimatedFootprint(
  estimatedFootprintMb: number | null | undefined,
): string {
  if (typeof estimatedFootprintMb !== 'number' || !Number.isFinite(estimatedFootprintMb) || estimatedFootprintMb <= 0) {
    return 'Cache footprint varies by backend';
  }

  return estimatedFootprintMb >= 1024
    ? `~${(estimatedFootprintMb / 1024).toFixed(1)} GB`
    : `~${Math.round(estimatedFootprintMb)} MB`;
}
