import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react';

import { ExternalLink, Puzzle, RefreshCw, RotateCcw, SlidersHorizontal } from '@/components/AppIcons';

import type { OverlayPluginSettingsSlotContribution } from '../../../config/pluginContributions';
import type {
  OverlayPluginSettingsFieldDefinition,
  OverlayPluginSettingsValue,
} from '../../../config/pluginSettings';
import type { OverlayPluginProps } from '../../pluginRuntime';
import { createOverlayPluginRuntimeSettingsController } from '../../../runtime/pluginSettingsRuntime';
import {
  SettingsActionButton,
  SettingsActionStrip,
  SettingsRow,
  SettingsRowGroup,
  SettingsSectionBlock,
  SettingsStatusPill,
  ThemeBadge,
} from '../SettingsPrimitives';

function formatPluginSettingsValuePreview(value: OverlayPluginSettingsValue): string {
  if (value == null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value.length > 64 ? `${value.slice(0, 61)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 64 ? `${serialized.slice(0, 61)}...` : serialized;
  } catch {
    return '[unserializable]';
  }
}

function formatPluginSettingsValueJson(value: OverlayPluginSettingsValue): string {
  if (value == null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function parsePluginSettingsJsonDraft(draft: string): {
  ok: boolean;
  value: OverlayPluginSettingsValue | null;
  error: string | null;
} {
  const trimmedDraft = draft.trim();
  if (!trimmedDraft) {
    return { ok: true, value: null, error: null };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(trimmedDraft) as OverlayPluginSettingsValue,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

function buildGeneratedFieldControl(
  field: OverlayPluginSettingsFieldDefinition,
  value: OverlayPluginSettingsValue,
  onChange: (nextValue: unknown) => void,
) {
  const controlStyle = {
    borderColor: 'var(--overlay-workbench-settings-card-border)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--overlay-text-primary)',
  } as const;

  switch (field.kind) {
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? String(value) : ''}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue.length > 0 ? Number(nextValue) : null);
          }}
          className="w-[128px] rounded border px-3 py-2 text-[12px]"
          style={controlStyle}
        />
      );
    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-[180px] rounded border px-3 py-2 text-[12px]"
          style={controlStyle}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case 'text':
    default:
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-[220px] rounded border px-3 py-2 text-[12px]"
          style={controlStyle}
        />
      );
  }
}

function PluginLongFormSettingsField({
  field,
  value,
  onChange,
}: {
  field: OverlayPluginSettingsFieldDefinition;
  value: OverlayPluginSettingsValue;
  onChange: (nextValue: unknown) => void;
}) {
  const initialDraft = useMemo(() => {
    if (field.kind === 'json') {
      return formatPluginSettingsValueJson(value);
    }
    return typeof value === 'string' ? value : '';
  }, [field.kind, value]);
  const [draft, setDraft] = useState(initialDraft);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialDraft);
    setErrorMessage(null);
  }, [initialDraft]);

  const handleJsonApply = () => {
    const parsedDraft = parsePluginSettingsJsonDraft(draft);
    if (!parsedDraft.ok) {
      setErrorMessage(parsedDraft.error);
      return;
    }
    setErrorMessage(null);
    onChange(parsedDraft.value);
  };

  const handleTextAreaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextDraft = event.target.value;
    setDraft(nextDraft);
    if (field.kind === 'textarea') {
      onChange(nextDraft);
    }
  };

  return (
    <SettingsSectionBlock
      title={field.label}
      subtitle={field.description ?? field.kind}
      badges={[field.kind]}
      tone="muted"
    >
      <textarea
        value={draft}
        placeholder={field.placeholder}
        onChange={handleTextAreaChange}
        className="min-h-[140px] w-full rounded border px-3 py-3 text-[12px]"
        style={{
          borderColor: 'var(--overlay-workbench-settings-card-border)',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--overlay-text-primary)',
          fontFamily: field.kind === 'json' ? 'var(--overlay-font-mono, monospace)' : undefined,
          resize: 'vertical',
        }}
      />
      {field.kind === 'json' ? (
        <SettingsActionStrip className="mt-3">
          <SettingsActionButton onClick={handleJsonApply}>
            <SlidersHorizontal size={12} />
            Apply JSON
          </SettingsActionButton>
          <SettingsActionButton
            onClick={() => {
              setDraft(initialDraft);
              setErrorMessage(null);
            }}
          >
            <RotateCcw size={12} />
            Reset Draft
          </SettingsActionButton>
          {errorMessage ? (
            <span
              className="text-[10px] uppercase tracking-[0.12em]"
              style={{ color: 'var(--overlay-danger)' }}
            >
              {errorMessage}
            </span>
          ) : null}
        </SettingsActionStrip>
      ) : null}
    </SettingsSectionBlock>
  );
}

function PluginRawSettingsEditor({
  values,
  onReplace,
}: {
  values: Record<string, OverlayPluginSettingsValue>;
  onReplace: (nextValues: Record<string, unknown>) => void;
}) {
  const serializedValues = useMemo(
    () => JSON.stringify(values, null, 2),
    [values],
  );
  const [draft, setDraft] = useState(serializedValues);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(serializedValues);
    setErrorMessage(null);
  }, [serializedValues]);

  return (
    <SettingsSectionBlock
      title="Raw Settings"
      subtitle="This slot ships no generated fields, so edit the stored values directly."
      badges={['json']}
      tone="muted"
    >
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="min-h-[180px] w-full rounded border px-3 py-3 text-[12px]"
        style={{
          borderColor: 'var(--overlay-workbench-settings-card-border)',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--overlay-text-primary)',
          fontFamily: 'var(--overlay-font-mono, monospace)',
          resize: 'vertical',
        }}
      />
      <SettingsActionStrip className="mt-3">
        <SettingsActionButton
          onClick={() => {
            const parsedDraft = parsePluginSettingsJsonDraft(draft);
            if (
              !parsedDraft.ok
              || parsedDraft.value == null
              || Array.isArray(parsedDraft.value)
              || typeof parsedDraft.value !== 'object'
            ) {
              setErrorMessage(
                parsedDraft.error ?? 'Settings JSON must resolve to an object.',
              );
              return;
            }
            setErrorMessage(null);
            onReplace(parsedDraft.value as Record<string, unknown>);
          }}
        >
          <SlidersHorizontal size={12} />
          Apply Values
        </SettingsActionButton>
        <SettingsActionButton
          onClick={() => {
            setDraft(serializedValues);
            setErrorMessage(null);
          }}
        >
          <RotateCcw size={12} />
          Reset Draft
        </SettingsActionButton>
        {errorMessage ? (
          <span
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ color: 'var(--overlay-danger)' }}
          >
            {errorMessage}
          </span>
        ) : null}
      </SettingsActionStrip>
    </SettingsSectionBlock>
  );
}

export function PluginSettingsSection({
  appearance,
  slot,
  accent,
  onRefreshPlugins,
  onOpenPluginsFolder,
  pluginsLoading,
  pluginsError,
}: {
  appearance: OverlayPluginProps['appearance'];
  slot: OverlayPluginSettingsSlotContribution;
  accent: string;
  onRefreshPlugins: () => Promise<void>;
  onOpenPluginsFolder: () => Promise<void>;
  pluginsLoading: boolean;
  pluginsError: string | null;
}) {
  const controller = useMemo(
    () => createOverlayPluginRuntimeSettingsController(slot.pluginId),
    [slot.pluginId],
  );
  const resolvedValues = useSyncExternalStore(
    (onStoreChange) => controller.subscribe(() => onStoreChange()),
    () => controller.getResolvedValues(slot),
    () => controller.getResolvedValues(slot),
  );
  const storedValues = useSyncExternalStore(
    (onStoreChange) => controller.subscribe(() => onStoreChange()),
    controller.getStoredValues,
    controller.getStoredValues,
  );

  const settingsHost = useMemo(
    () => ({
      getValues: () => resolvedValues,
      getValue: <TValue,>(settingId: string, fallbackValue?: TValue) =>
        Object.prototype.hasOwnProperty.call(resolvedValues, settingId)
          ? (resolvedValues[settingId] as TValue | OverlayPluginSettingsValue)
          : (fallbackValue ?? null),
      setValue: controller.setValue,
      patchValues: controller.patchValues,
      resetValues: controller.resetValues,
      subscribe: (
        listener: (values: Record<string, OverlayPluginSettingsValue>) => void,
      ) => controller.subscribe(() => listener(controller.getResolvedValues(slot))),
    }),
    [controller, resolvedValues, slot],
  );

  const scalarFields = slot.fields.filter(
    (field) => field.kind !== 'textarea' && field.kind !== 'json',
  );
  const longFormFields = slot.fields.filter(
    (field) => field.kind === 'textarea' || field.kind === 'json',
  );
  const hasCustomComponent = slot.component != null;
  const currentValueEntries = Object.entries(resolvedValues);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <SettingsSectionBlock
          title={slot.title}
          subtitle={
            slot.description
            ?? `Plugin-owned settings slot from ${slot.pluginName}.`
          }
          badges={[
            slot.pluginName,
            hasCustomComponent ? 'custom-ui' : 'generated-ui',
            `${slot.fields.length} fields`,
          ]}
          actions={(
            <SettingsActionStrip>
              <SettingsActionButton
                onClick={() => controller.resetValues()}
                accent={accent}
              >
                <RotateCcw size={12} />
                Reset Slot
              </SettingsActionButton>
              <SettingsActionButton onClick={() => void onRefreshPlugins()}>
                <RefreshCw size={12} />
                {pluginsLoading ? 'Refreshing…' : 'Refresh Plugins'}
              </SettingsActionButton>
              <SettingsActionButton onClick={() => void onOpenPluginsFolder()}>
                <ExternalLink size={12} />
                Open Plugins Folder
              </SettingsActionButton>
            </SettingsActionStrip>
          )}
          accent={accent}
        >
          {pluginsError ? (
            <div
              className="rounded border px-3 py-2 text-[11px]"
              style={{
                borderColor: 'var(--overlay-danger)',
                background: 'rgba(255,64,64,0.06)',
                color: 'var(--overlay-text-primary)',
              }}
            >
              {pluginsError}
            </div>
          ) : null}

          {slot.component ? (
            <slot.component
              appearance={appearance}
              slot={slot}
              host={settingsHost}
            />
          ) : (
            <div className="space-y-3">
              {scalarFields.length > 0 ? (
                <SettingsRowGroup>
                  {scalarFields.map((field) => (
                    <SettingsRow
                      key={field.id}
                      title={field.label}
                      description={field.description ?? field.kind}
                      note={field.options.length > 0
                        ? `Options: ${field.options.map((option) => option.label).join(', ')}`
                        : undefined}
                      control={buildGeneratedFieldControl(
                        field,
                        resolvedValues[field.id] ?? null,
                        (nextValue) => controller.setValue(field.id, nextValue),
                      )}
                    />
                  ))}
                </SettingsRowGroup>
              ) : null}

              {longFormFields.map((field) => (
                <PluginLongFormSettingsField
                  key={field.id}
                  field={field}
                  value={resolvedValues[field.id] ?? null}
                  onChange={(nextValue) => controller.setValue(field.id, nextValue)}
                />
              ))}

              {slot.fields.length === 0 ? (
                <PluginRawSettingsEditor
                  values={resolvedValues}
                  onReplace={(nextValues) => controller.patchValues(nextValues)}
                />
              ) : null}
            </div>
          )}
        </SettingsSectionBlock>
      </div>

      <div className="space-y-3">
        <SettingsSectionBlock
          title="Slot Details"
          subtitle="Shared host metadata for this plugin settings lane."
          tone="muted"
        >
          <div className="flex flex-wrap gap-1.5">
            <ThemeBadge label={slot.pluginName} active />
            <ThemeBadge label={slot.pluginId} />
            {slot.rendererEntry ? <ThemeBadge label="custom renderer" /> : null}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-[11px]">
            <div className="rounded border px-3 py-2" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Slot Id</div>
              <div className="mt-1 break-all">{slot.id}</div>
            </div>
            <div className="rounded border px-3 py-2" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Keywords</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {slot.keywords.length > 0
                  ? slot.keywords.map((keyword) => (
                    <SettingsStatusPill key={keyword}>{keyword}</SettingsStatusPill>
                  ))
                  : <span className="opacity-45">No keywords declared.</span>}
              </div>
            </div>
            <div className="rounded border px-3 py-2" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Current Values</div>
              <div className="mt-1 space-y-1">
                {currentValueEntries.length > 0 ? currentValueEntries.map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3">
                    <span className="truncate opacity-60">{key}</span>
                    <span className="max-w-[180px] break-all text-right">{formatPluginSettingsValuePreview(value)}</span>
                  </div>
                )) : (
                  <span className="opacity-45">No values stored yet.</span>
                )}
              </div>
            </div>
          </div>
        </SettingsSectionBlock>

        {slot.fields.length > 0 ? (
          <SettingsSectionBlock
            title="Field Catalog"
            subtitle="Schema-backed fields declared by the plugin manifest."
            tone="muted"
          >
            <div className="space-y-2">
              {slot.fields.map((field) => (
                <div
                  key={field.id}
                  className="rounded border px-3 py-2"
                  style={{
                    borderColor: 'var(--overlay-workbench-settings-card-border)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold">
                        {field.label}
                      </div>
                      <div className="mt-1 text-[10px] opacity-55">
                        {field.description ?? field.id}
                      </div>
                    </div>
                    <SettingsStatusPill>{field.kind}</SettingsStatusPill>
                  </div>
                </div>
              ))}
            </div>
          </SettingsSectionBlock>
        ) : null}

        <SettingsSectionBlock
          title="Stored Payload"
          subtitle="The raw persisted values currently living in the shared settings store."
          tone="muted"
        >
          <pre
            className="max-h-[360px] overflow-auto rounded border px-3 py-3 text-[11px]"
            style={{
              borderColor: 'var(--overlay-workbench-settings-card-border)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--overlay-text-primary)',
              fontFamily: appearance.fonts.mono,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(storedValues, null, 2) || '{}'}
          </pre>
        </SettingsSectionBlock>
      </div>
    </div>
  );
}

export function EmptyPluginSettingsState({
  accent,
  onRefreshPlugins,
  onOpenPluginsFolder,
  pluginsLoading,
  pluginsError,
}: {
  accent: string;
  onRefreshPlugins: () => Promise<void>;
  onOpenPluginsFolder: () => Promise<void>;
  pluginsLoading: boolean;
  pluginsError: string | null;
}) {
  return (
    <SettingsSectionBlock
      title="Plugin Settings"
      subtitle="Discovered plugin settings slots will appear here as soon as extensions contribute them."
      badges={['plugins', 'settings-slots']}
      tone="muted"
      accent={accent}
      actions={(
        <SettingsActionStrip>
          <SettingsActionButton onClick={() => void onRefreshPlugins()}>
            <RefreshCw size={12} />
            {pluginsLoading ? 'Refreshing…' : 'Refresh Plugins'}
          </SettingsActionButton>
          <SettingsActionButton onClick={() => void onOpenPluginsFolder()}>
            <ExternalLink size={12} />
            Open Plugins Folder
          </SettingsActionButton>
        </SettingsActionStrip>
      )}
    >
      <div className="flex items-start gap-3 rounded border px-3 py-3" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="pt-0.5">
          <Puzzle size={16} />
        </div>
        <div className="min-w-0 text-[11px] leading-5 opacity-75">
          Plugin authors can now ship durable settings slots through
          {' '}
          <code>contributions.settingsSlots</code>
          {' '}
          and bind custom renderers with
          {' '}
          <code>defineSettingsSlot(...)</code>
          . Once a plugin contributes a slot, it will show up under its own
          rail label here instead of bloating the core settings stack.
          {pluginsError ? (
            <div className="mt-2" style={{ color: 'var(--overlay-danger)' }}>
              {pluginsError}
            </div>
          ) : null}
        </div>
      </div>
    </SettingsSectionBlock>
  );
}
