import type { ChangeEvent } from 'react';
import {
  Bot,
  Cpu,
  Database,
  Download,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from '@/components/AppIcons';
import {
  formatLocalModelEstimatedFootprint,
  getCapabilityModels,
  getLocalModelDefinition,
  getLocalModelDefinitionByProviderModelId,
  getLocalModelHardwareProfile,
  localModelBackendOptions,
  localModelCapabilityCatalog,
  localModelDefinitions,
  normalizeLocalModelBackendPreference,
  semanticIndexingCapabilityId,
  type LocalModelBackendPreference,
  type LocalModelDefinition,
  type LocalModelHardwareProfileDefinition,
} from '../../../config/localModels';
import type { LocalModelCatalogStatus, LocalModelCatalogStatusEntry } from '../../../runtime/modelManagementBackend';
import type { ModelsSettings } from '../../../store/settingsStore';
import {
  InfoBubble,
  SettingsCompactActionButton,
  SettingsCompactPath,
  SettingsCompactSection,
  SettingsControlRow,
  SettingsIconActionButton,
  SettingsInlineNotice,
  SettingsMetricStrip,
  SettingsSectionScaffold,
  SettingsSelect,
  ThemeBadge,
} from '../SettingsPrimitives';

type ModelCapabilityBindingUpdate = {
  modelId?: string | null;
  backendPreference?: LocalModelBackendPreference;
};

function formatModelTimestamp(epochMs: number | null | undefined): string {
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs) || epochMs <= 0) {
    return 'Never';
  }

  return new Date(epochMs).toLocaleString();
}

function getSemanticModelBinding(modelsSettings: ModelsSettings) {
  const capability = localModelCapabilityCatalog.find(
    item => item.id === semanticIndexingCapabilityId,
  );

  return modelsSettings.capabilityBindings[semanticIndexingCapabilityId] ?? {
    modelId: capability?.defaultModelId ?? null,
    backendPreference: capability?.defaultBackendPreference ?? 'auto',
  };
}

function getBackendLabel(backendPreference: LocalModelBackendPreference): string {
  return localModelBackendOptions.find(option => option.id === backendPreference)?.label ?? 'Auto';
}

function ModelBackendSelect({
  value,
  optionIds,
  cudaProviderReady,
  ariaLabel,
  onChange,
}: {
  value: LocalModelBackendPreference;
  optionIds: readonly LocalModelBackendPreference[];
  cudaProviderReady: boolean;
  ariaLabel: string;
  onChange: (value: LocalModelBackendPreference) => void;
}) {
  return (
    <SettingsSelect
      aria-label={ariaLabel}
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
        onChange(normalizeLocalModelBackendPreference(event.target.value))
      }
      className="w-full"
    >
      {localModelBackendOptions
        .filter(option => optionIds.includes(option.id))
        .map(option => (
          <option
            key={option.id}
            value={option.id}
            disabled={option.id === 'cuda' && !cudaProviderReady}
          >
            {option.label}
          </option>
        ))}
    </SettingsSelect>
  );
}

function ModelSummaryLine({
  model,
  hardwareProfile,
  status,
}: {
  model: LocalModelDefinition | null;
  hardwareProfile: LocalModelHardwareProfileDefinition | null;
  status: LocalModelCatalogStatusEntry | null;
}) {
  if (!model) {
    return <span className="opacity-45">No model selected</span>;
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <ThemeBadge label={status?.installed ? 'Installed' : 'Not Warmed'} active={status?.installed === true} />
      {hardwareProfile ? <ThemeBadge label={hardwareProfile.label} /> : null}
      <ThemeBadge label={formatLocalModelEstimatedFootprint(model.estimatedFootprintMb)} />
    </span>
  );
}

export function ModelsSettingsSection({
  modelsSettings,
  localModelStatus,
  localModelStatusById,
  localModelStatusPending,
  localModelStatusError,
  localModelNotice,
  installedLocalModelCount,
  localModelCacheFootprint,
  managedRuntimeRoot,
  cudaProviderReady,
  cudaProviderLabel,
  cudaProviderDetail,
  accelerationRoutingMode,
  accelerationPipelineStatus,
  accelerationInstallRecommended,
  accelerationInstallButtonLabel,
  accelerationProbePending,
  accelerationInstallPending,
  accelerationInstallAvailable,
  semanticIndexingBackendLabel,
  semanticIndexingSelectedModel,
  semanticIndexingSelectedModelStatus,
  semanticIndexingSelectedHardwareProfile,
  modelPrewarmPendingId,
  semanticOverrideRootPathDraft,
  semanticOverrideModelIdDraft,
  semanticOverrideBackendPreferenceDraft,
  onSemanticOverrideRootPathDraftChange,
  onSemanticOverrideModelIdDraftChange,
  onSemanticOverrideBackendPreferenceDraftChange,
  onRefreshLocalModels,
  onOpenLocalModelCache,
  onProbeAccelerationPipeline,
  onQueueAccelerationInstall,
  onUpdateModelCapabilityBinding,
  onPrewarmLocalModel,
  onApplySemanticIndexOverride,
  onRemoveSemanticIndexOverride,
}: {
  modelsSettings: ModelsSettings;
  localModelStatus: LocalModelCatalogStatus | null;
  localModelStatusById: ReadonlyMap<string, LocalModelCatalogStatusEntry>;
  localModelStatusPending: boolean;
  localModelStatusError: string | null;
  localModelNotice: string | null;
  installedLocalModelCount: number;
  localModelCacheFootprint: string;
  managedRuntimeRoot: string | null;
  cudaProviderReady: boolean;
  cudaProviderLabel: string;
  cudaProviderDetail: string;
  accelerationRoutingMode: string;
  accelerationPipelineStatus: string;
  accelerationInstallRecommended: boolean;
  accelerationInstallButtonLabel: string;
  accelerationProbePending: boolean;
  accelerationInstallPending: boolean;
  accelerationInstallAvailable: boolean;
  semanticIndexingBackendLabel: string;
  semanticIndexingSelectedModel: LocalModelDefinition | null;
  semanticIndexingSelectedModelStatus: LocalModelCatalogStatusEntry | null;
  semanticIndexingSelectedHardwareProfile: LocalModelHardwareProfileDefinition | null;
  modelPrewarmPendingId: string | null;
  semanticOverrideRootPathDraft: string;
  semanticOverrideModelIdDraft: string | null;
  semanticOverrideBackendPreferenceDraft: LocalModelBackendPreference;
  onSemanticOverrideRootPathDraftChange: (value: string) => void;
  onSemanticOverrideModelIdDraftChange: (value: string | null) => void;
  onSemanticOverrideBackendPreferenceDraftChange: (value: LocalModelBackendPreference) => void;
  onRefreshLocalModels: () => Promise<void> | void;
  onOpenLocalModelCache: () => Promise<void> | void;
  onProbeAccelerationPipeline: () => Promise<void> | void;
  onQueueAccelerationInstall: () => Promise<void> | void;
  onUpdateModelCapabilityBinding: (
    capabilityId: string,
    updates: ModelCapabilityBindingUpdate,
  ) => void;
  onPrewarmLocalModel: (
    modelId: string,
    capabilityId: string | null,
    backendPreference: LocalModelBackendPreference,
  ) => Promise<void> | void;
  onApplySemanticIndexOverride: () => void;
  onRemoveSemanticIndexOverride: (rootPath: string) => void;
}) {
  const semanticIndexingCapability = localModelCapabilityCatalog.find(
    capability => capability.id === semanticIndexingCapabilityId,
  );
  const semanticIndexingModels = getCapabilityModels(semanticIndexingCapabilityId);
  const semanticIndexRootOverrides = Object.entries(
    modelsSettings.semanticIndexRootOverrides,
  ).sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath));
  const semanticBinding = getSemanticModelBinding(modelsSettings);
  const cacheRoot = localModelStatus?.cacheRoot ?? managedRuntimeRoot ?? 'Runtime pending';
  const registryRoot = localModelStatus?.registryRoot ?? 'Registry pending';

  return (
    <SettingsSectionScaffold
      sectionKey="models"
      icon={<Bot size={12} />}
      title="Models"
      subtitle="Local model cache, capability routing, and semantic overrides."
      badges={[
        `${installedLocalModelCount} installed`,
        localModelCacheFootprint,
        semanticIndexingBackendLabel,
      ]}
      actions={(
        <>
          <SettingsIconActionButton
            aria-label="Refresh local models"
            title="Refresh local models"
            onClick={() => void onRefreshLocalModels()}
            disabled={localModelStatusPending}
            active={!localModelStatusPending}
          >
            {localModelStatusPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </SettingsIconActionButton>
          <SettingsIconActionButton
            aria-label="Open model cache"
            title="Open model cache"
            onClick={() => void onOpenLocalModelCache()}
          >
            <FolderOpen size={13} />
          </SettingsIconActionButton>
        </>
      )}
    >
      <SettingsMetricStrip
        items={[
          {
            id: 'cache',
            label: 'Cache',
            value: localModelCacheFootprint,
            tone: installedLocalModelCount > 0 ? 'accent' : 'default',
          },
          {
            id: 'python',
            label: 'Python',
            value: localModelStatus?.pythonVersion ?? 'Pending',
          },
          {
            id: 'cuda',
            label: 'CUDA',
            value: cudaProviderReady ? 'Ready' : 'Unavailable',
            tone: cudaProviderReady ? 'accent' : 'default',
          },
          {
            id: 'semantic',
            label: 'Semantic',
            value: semanticIndexingSelectedModel?.label ?? 'No model',
          },
          {
            id: 'routing',
            label: 'Routing',
            value: accelerationRoutingMode,
          },
          {
            id: 'overrides',
            label: 'Overrides',
            value: semanticIndexRootOverrides.length,
          },
        ]}
      />

      {localModelNotice ? <SettingsInlineNotice tone="info">{localModelNotice}</SettingsInlineNotice> : null}
      {localModelStatusError ? (
        <SettingsInlineNotice tone="danger">{localModelStatusError}</SettingsInlineNotice>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.44fr)]">
        <div className="min-w-0 space-y-2">
          <SettingsCompactSection
            title="Capability Routing"
            subtitle={`${localModelCapabilityCatalog.length} lanes`}
          >
            {localModelCapabilityCatalog.map(capability => {
              const binding = modelsSettings.capabilityBindings[capability.id] ?? {
                modelId: capability.defaultModelId,
                backendPreference: capability.defaultBackendPreference,
              };
              const selectedModel =
                getLocalModelDefinition(binding.modelId) ??
                getLocalModelDefinitionByProviderModelId(binding.modelId);
              const selectedModelStatus = selectedModel
                ? (localModelStatusById.get(selectedModel.id) ?? null)
                : null;
              const hardwareProfile = getLocalModelHardwareProfile(
                selectedModel?.hardwareProfileId,
              );
              const capabilityModels = getCapabilityModels(capability.id);
              const isActive = capability.availability === 'active';

              return (
                <SettingsControlRow
                  key={capability.id}
                  label={(
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{capability.label}</span>
                      <InfoBubble description={capability.description} label={`About ${capability.label}`} />
                    </span>
                  )}
                  detail={<ModelSummaryLine model={selectedModel} hardwareProfile={hardwareProfile} status={selectedModelStatus} />}
                  control={isActive ? (
                    <div className="grid min-w-0 grid-cols-1 gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(9rem,0.32fr)]">
                      <SettingsSelect
                        aria-label={`${capability.label} model`}
                        value={binding.modelId ?? ''}
                        onChange={(event) =>
                          onUpdateModelCapabilityBinding(capability.id, {
                            modelId: event.target.value || null,
                          })
                        }
                      >
                        {capabilityModels.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </SettingsSelect>
                      <ModelBackendSelect
                        ariaLabel={`${capability.label} backend`}
                        value={normalizeLocalModelBackendPreference(binding.backendPreference)}
                        optionIds={capability.backendOptionIds}
                        cudaProviderReady={cudaProviderReady}
                        onChange={(backendPreference) =>
                          onUpdateModelCapabilityBinding(capability.id, { backendPreference })
                        }
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] opacity-45">Planned</span>
                  )}
                  action={<ThemeBadge label={isActive ? 'Active' : 'Planned'} active={isActive} />}
                />
              );
            })}
          </SettingsCompactSection>

          <SettingsCompactSection
            title="Installed Model Catalog"
            subtitle={`${localModelDefinitions.length} curated`}
          >
            {localModelDefinitions.map(model => {
              const status = localModelStatusById.get(model.id) ?? null;
              const hardwareProfile = getLocalModelHardwareProfile(model.hardwareProfileId);
              const recommendedBackend = normalizeLocalModelBackendPreference(
                model.recommendedBackendPreference,
              );
              const recommendedBackendLabel = getBackendLabel(recommendedBackend);
              const prewarmDisabled = modelPrewarmPendingId != null && modelPrewarmPendingId !== model.id;
              const semanticModelActive = semanticBinding.modelId === model.id;

              return (
                <SettingsControlRow
                  key={model.id}
                  label={(
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{model.label}</span>
                      <InfoBubble description={model.description} label={`About ${model.label}`} />
                    </span>
                  )}
                  detail={(
                    <span className="flex min-w-0 flex-wrap items-center gap-1">
                      <ThemeBadge label={status?.installed ? 'Installed' : 'Not Warmed'} active={status?.installed === true} />
                      {hardwareProfile ? <ThemeBadge label={hardwareProfile.label} /> : null}
                      <ThemeBadge label={formatLocalModelEstimatedFootprint(model.estimatedFootprintMb)} />
                      <ThemeBadge label={`Recommend ${recommendedBackendLabel}`} />
                    </span>
                  )}
                  control={(
                    <div className="grid min-w-0 gap-0.5 text-[10px] opacity-55">
                      <SettingsCompactPath value={model.providerModelId} title={model.providerModelId} />
                      <span className="truncate">
                        Warmed {formatModelTimestamp(status?.lastWarmedAtMs)} · Used {formatModelTimestamp(status?.lastUsedAtMs)}
                      </span>
                      {status?.lastError ? <span className="truncate text-[10px] text-[var(--overlay-warning)]">{status.lastError}</span> : null}
                    </div>
                  )}
                  action={(
                    <div className="flex items-center gap-1">
                      <SettingsIconActionButton
                        aria-label={semanticModelActive ? 'Semantic default model' : `Use ${model.label} for semantic indexing`}
                        title={semanticModelActive ? 'Semantic default model' : `Use ${model.label} for semantic indexing`}
                        active={semanticModelActive}
                        onClick={() =>
                          onUpdateModelCapabilityBinding(semanticIndexingCapabilityId, {
                            modelId: model.id,
                          })
                        }
                      >
                        <Bot size={13} />
                      </SettingsIconActionButton>
                      <SettingsIconActionButton
                        aria-label={status?.installed ? `Rewarm ${model.label}` : `Download ${model.label}`}
                        title={status?.installed ? `Rewarm ${model.label}` : `Download ${model.label}`}
                        onClick={() =>
                          void onPrewarmLocalModel(
                            model.id,
                            model.capabilityIds[0] ?? semanticIndexingCapabilityId,
                            recommendedBackend,
                          )
                        }
                        disabled={prewarmDisabled}
                        active={!prewarmDisabled}
                      >
                        {modelPrewarmPendingId === model.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      </SettingsIconActionButton>
                    </div>
                  )}
                />
              );
            })}
          </SettingsCompactSection>
        </div>

        <div className="min-w-0 space-y-2">
          <SettingsCompactSection
            title="Runtime"
            subtitle={cudaProviderLabel}
            actions={(
              <>
                <SettingsIconActionButton
                  aria-label="Probe acceleration pipeline"
                  title="Probe acceleration pipeline"
                  onClick={() => void onProbeAccelerationPipeline()}
                  disabled={accelerationProbePending}
                  active={!accelerationProbePending}
                >
                  {accelerationProbePending ? <Loader2 size={13} className="animate-spin" /> : <Cpu size={13} />}
                </SettingsIconActionButton>
                <SettingsIconActionButton
                  aria-label={accelerationInstallButtonLabel}
                  title={accelerationInstallButtonLabel}
                  onClick={() => void onQueueAccelerationInstall()}
                  disabled={accelerationInstallPending || !accelerationInstallAvailable}
                  active={accelerationInstallRecommended}
                >
                  {accelerationInstallPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                </SettingsIconActionButton>
              </>
            )}
          >
            <SettingsControlRow
              label="Cache"
              control={<SettingsCompactPath value={cacheRoot} title={cacheRoot} />}
              action={<Database size={13} />}
            />
            <SettingsControlRow
              label="Registry"
              control={<SettingsCompactPath value={registryRoot} title={registryRoot} />}
              action={<FolderOpen size={13} />}
            />
            <SettingsControlRow
              label="CUDA Provider"
              detail={cudaProviderDetail}
              control={<span className="text-[11px] opacity-75">{cudaProviderReady ? 'Ready' : 'CPU fallback'}</span>}
              action={<ThemeBadge label={cudaProviderReady ? 'Ready' : 'Fallback'} active={cudaProviderReady} />}
            />
            <SettingsControlRow
              label="Pipeline"
              control={<span className="text-[11px] opacity-65">{accelerationPipelineStatus}</span>}
              action={<Cpu size={13} />}
            />
          </SettingsCompactSection>

          <SettingsCompactSection
            title="Semantic Default"
            subtitle={semanticIndexingSelectedModel?.label ?? 'No model'}
          >
            <SettingsControlRow
              label="Model"
              detail={semanticIndexingSelectedHardwareProfile?.label}
              control={(
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <ThemeBadge label={semanticIndexingSelectedModelStatus?.installed ? 'Installed' : 'Not Warmed'} active={semanticIndexingSelectedModelStatus?.installed === true} />
                  <ThemeBadge label={semanticIndexingBackendLabel} active />
                </span>
              )}
              action={<Bot size={13} />}
            />
            <SettingsControlRow
              label="Overrides"
              control={<span className="text-[11px] opacity-65">{semanticIndexRootOverrides.length} pinned root{semanticIndexRootOverrides.length === 1 ? '' : 's'}</span>}
              action={<ThemeBadge label={`${semanticIndexRootOverrides.length}`} active={semanticIndexRootOverrides.length > 0} />}
            />
          </SettingsCompactSection>

          {semanticIndexingCapability?.supportsPerRootOverrides ? (
            <SettingsCompactSection
              title="Root Overrides"
              subtitle={`${semanticIndexRootOverrides.length} overrides`}
            >
              <SettingsControlRow
                label="Root Path"
                control={(
                  <input
                    aria-label="Semantic index override root path"
                    value={semanticOverrideRootPathDraft}
                    onChange={(event) => onSemanticOverrideRootPathDraftChange(event.target.value)}
                    placeholder="/workspace/project"
                    className="h-7 w-full min-w-0 rounded border bg-transparent px-2 text-[11px] outline-none"
                    style={{
                      borderColor: 'var(--overlay-workbench-settings-badge-border)',
                      background: 'var(--overlay-workbench-settings-badge-bg)',
                      color: 'var(--overlay-text-primary)',
                      fontFamily: 'var(--overlay-font-mono)',
                    }}
                  />
                )}
              />
              <SettingsControlRow
                label="Model"
                control={(
                  <SettingsSelect
                    aria-label="Semantic index override model"
                    value={semanticOverrideModelIdDraft ?? ''}
                    onChange={(event) => onSemanticOverrideModelIdDraftChange(event.target.value || null)}
                    className="w-full"
                  >
                    {semanticIndexingModels.map(model => (
                      <option key={`semantic-override-${model.id}`} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </SettingsSelect>
                )}
              />
              <SettingsControlRow
                label="Backend"
                control={(
                  <ModelBackendSelect
                    ariaLabel="Semantic index override backend"
                    value={semanticOverrideBackendPreferenceDraft}
                    optionIds={semanticIndexingCapability.backendOptionIds}
                    cudaProviderReady={cudaProviderReady}
                    onChange={onSemanticOverrideBackendPreferenceDraftChange}
                  />
                )}
                action={(
                  <SettingsCompactActionButton
                    onClick={onApplySemanticIndexOverride}
                    disabled={!semanticOverrideRootPathDraft.trim()}
                    active={semanticOverrideRootPathDraft.trim().length > 0}
                  >
                    <Plus size={12} />
                    <span>Save</span>
                  </SettingsCompactActionButton>
                )}
              />
              {semanticIndexRootOverrides.length > 0 ? (
                <div className="border-t" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)' }}>
                  {semanticIndexRootOverrides.map(([rootPath, binding]) => {
                    const overrideModel =
                      getLocalModelDefinition(binding.modelId) ??
                      getLocalModelDefinitionByProviderModelId(binding.modelId);
                    const backendLabel = getBackendLabel(
                      normalizeLocalModelBackendPreference(binding.backendPreference),
                    );

                    return (
                      <SettingsControlRow
                        key={`semantic-override-entry-${rootPath}`}
                        label={<SettingsCompactPath value={rootPath} title={rootPath} />}
                        control={(
                          <span className="text-[11px] opacity-70">
                            {overrideModel?.label ?? binding.modelId ?? 'No model'} · {backendLabel}
                          </span>
                        )}
                        action={(
                          <div className="flex items-center gap-1">
                            <SettingsIconActionButton
                              aria-label={`Load override for ${rootPath}`}
                              title={`Load override for ${rootPath}`}
                              onClick={() => {
                                onSemanticOverrideRootPathDraftChange(rootPath);
                                onSemanticOverrideModelIdDraftChange(binding.modelId);
                                onSemanticOverrideBackendPreferenceDraftChange(
                                  normalizeLocalModelBackendPreference(binding.backendPreference),
                                );
                              }}
                            >
                              <Bot size={13} />
                            </SettingsIconActionButton>
                            <SettingsIconActionButton
                              aria-label={`Remove override for ${rootPath}`}
                              title={`Remove override for ${rootPath}`}
                              onClick={() => onRemoveSemanticIndexOverride(rootPath)}
                            >
                              <Trash2 size={13} />
                            </SettingsIconActionButton>
                          </div>
                        )}
                      />
                    );
                  })}
                </div>
              ) : (
                <SettingsInlineNotice>No semantic root overrides.</SettingsInlineNotice>
              )}
            </SettingsCompactSection>
          ) : null}
        </div>
      </div>
    </SettingsSectionScaffold>
  );
}
