import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react';

import {
  ExternalLink,
  FolderPlus,
  Puzzle,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  X,
} from '@/components/AppIcons';

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
  RangeField,
  SettingsRow,
  SettingsRowGroup,
  SettingsSectionBlock,
} from '../SettingsPrimitives';
import { openExplorerPicker } from '../../../runtime/explorerPicker';

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

function parsePluginSettingsTextList(value: OverlayPluginSettingsValue): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      typeof entry === 'string' ? parsePluginSettingsTextList(entry) : [],
    );
  }
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(/[\n,;]+/g)
    .map(entry => entry.trim())
    .filter(Boolean);
}

function dedupePluginSettingsListEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const normalizedEntries: string[] = [];
  for (const entry of entries) {
    const normalizedEntry = entry.trim();
    const key = normalizedEntry.toLocaleLowerCase();
    if (!normalizedEntry || seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalizedEntries.push(normalizedEntry);
  }
  return normalizedEntries;
}

function normalizeExtensionToken(value: string): string {
  return value.trim().replace(/^\.+/, '').toLocaleLowerCase();
}

function formatPathListValue(paths: string[]): string {
  return dedupePluginSettingsListEntries(paths).join('\n');
}

function formatExtensionListValue(extensions: string[]): string {
  return dedupePluginSettingsListEntries(
    extensions
      .map(normalizeExtensionToken)
      .filter(Boolean),
  ).join(', ');
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

function PluginPathListSettingsField({
  field,
  value,
  onChange,
}: {
  field: OverlayPluginSettingsFieldDefinition;
  value: OverlayPluginSettingsValue;
  onChange: (nextValue: unknown) => void;
}) {
  const paths = dedupePluginSettingsListEntries(parsePluginSettingsTextList(value));

  const handleAddFolders = async () => {
    const pickerResult = await openExplorerPicker({
      kind: 'openFolders',
      presentation: 'window',
      title: `Add ${field.label}`,
      confirmLabel: 'Add Folders',
      allowCreateDirectory: true,
      startPath: paths[0] ?? null,
    });

    if (!pickerResult || pickerResult.cancelled) {
      return;
    }

    const nextPaths = pickerResult.entries.length > 0
      ? pickerResult.entries
        .filter(entry => entry.kind === 'folder')
        .map(entry => entry.path)
      : [pickerResult.currentDirectory];

    onChange(formatPathListValue([...paths, ...nextPaths]));
  };

  return (
    <SettingsSectionBlock
      title={field.label}
      subtitle={field.description ?? 'Choose one or more folders with the Explorer picker.'}
      badges={['folder-picker']}
      tone="muted"
      actions={(
        <SettingsActionStrip>
          <SettingsActionButton onClick={() => void handleAddFolders()}>
            <FolderPlus size={12} />
            Add Folder
          </SettingsActionButton>
          {paths.length > 0 ? (
            <SettingsActionButton onClick={() => onChange('')}>
              <RotateCcw size={12} />
              Clear
            </SettingsActionButton>
          ) : null}
        </SettingsActionStrip>
      )}
    >
      {paths.length > 0 ? (
        <div className="space-y-2">
          {paths.map((path) => (
            <div
              key={path}
              className="flex min-w-0 items-center justify-between gap-3 rounded border px-3 py-2 text-[11px]"
              style={{
                borderColor: 'var(--overlay-workbench-settings-card-border)',
                background: 'var(--overlay-workbench-settings-card-bg)',
              }}
            >
              <span className="min-w-0 flex-1 truncate font-mono opacity-75">
                {path}
              </span>
              <SettingsActionButton
                aria-label={`Remove ${path}`}
                onClick={() => onChange(formatPathListValue(paths.filter(entry => entry !== path)))}
              >
                <X size={12} />
                Remove
              </SettingsActionButton>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded border px-3 py-3 text-[11px] leading-5 opacity-65"
          style={{
            borderColor: 'var(--overlay-workbench-settings-card-border)',
            background: 'var(--overlay-workbench-settings-card-bg)',
          }}
        >
          No folders selected. The plugin will use the active index scope.
        </div>
      )}
    </SettingsSectionBlock>
  );
}

function PluginExtensionListSettingsField({
  field,
  value,
  onChange,
}: {
  field: OverlayPluginSettingsFieldDefinition;
  value: OverlayPluginSettingsValue;
  onChange: (nextValue: unknown) => void;
}) {
  const extensionOptions = field.options.map(option => ({
    ...option,
    value: normalizeExtensionToken(option.value),
  })).filter(option => option.value);
  const optionValueSet = new Set(extensionOptions.map(option => option.value));
  const selectedExtensions = parsePluginSettingsTextList(value)
    .map(normalizeExtensionToken)
    .filter(Boolean);
  const selectedOptionSet = new Set(
    selectedExtensions.filter(extension => optionValueSet.has(extension)),
  );
  const customExtensions = selectedExtensions.filter(
    extension => !optionValueSet.has(extension),
  );
  const customExtensionsDraftValue = customExtensions.join(', ');

  const commitExtensionState = (
    nextSelectedOptionSet: Set<string>,
    nextCustomExtensions: string[],
  ) => {
    onChange(formatExtensionListValue([
      ...extensionOptions
        .map(option => option.value)
        .filter(extension => nextSelectedOptionSet.has(extension)),
      ...nextCustomExtensions,
    ]));
  };

  return (
    <SettingsSectionBlock
      title={field.label}
      subtitle={field.description ?? 'Choose default image extensions and add custom extensions at the end.'}
      badges={['image-types', `${selectedExtensions.length} active`]}
      tone="muted"
    >
      <div className="space-y-3">
        {extensionOptions.length > 0 ? (
          <SettingsRowGroup>
            {extensionOptions.map((option) => (
              <SettingsRow
                key={option.value}
                title={`.${option.value}`}
                description={option.description ?? `Include ${option.label} images in gallery results.`}
                control={(
                  <input
                    type="checkbox"
                    checked={selectedOptionSet.has(option.value)}
                    onChange={(event) => {
                      const nextSelectedOptionSet = new Set(selectedOptionSet);
                      if (event.target.checked) {
                        nextSelectedOptionSet.add(option.value);
                      } else {
                        nextSelectedOptionSet.delete(option.value);
                      }
                      commitExtensionState(nextSelectedOptionSet, customExtensions);
                    }}
                  />
                )}
              />
            ))}
          </SettingsRowGroup>
        ) : null}

        <label
          className="block rounded border px-3 py-3"
          style={{
            borderColor: 'var(--overlay-workbench-settings-card-border)',
            background: 'var(--overlay-workbench-settings-card-bg)',
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
            Custom Extensions
          </div>
          <p className="mt-1 text-[11px] leading-4 opacity-45">
            Add comma-separated extras after the default gallery types. Leading dots are optional.
          </p>
          <PluginCustomExtensionsInput
            value={customExtensionsDraftValue}
            placeholder={field.placeholder}
            onChange={(nextDraft) => {
              commitExtensionState(
                selectedOptionSet,
                parsePluginSettingsTextList(nextDraft).map(normalizeExtensionToken),
              );
            }}
          />
        </label>
      </div>
    </SettingsSectionBlock>
  );
}

function PluginCustomExtensionsInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (nextDraft: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        onChange(nextDraft);
      }}
      className="mt-3 w-full rounded border px-3 py-2 text-[12px]"
      style={{
        borderColor: 'var(--overlay-workbench-settings-card-border)',
        background: 'rgba(255,255,255,0.04)',
        color: 'var(--overlay-text-primary)',
      }}
    />
  );
}

function PluginGeneratedSettingsField({
  field,
  value,
  onChange,
}: {
  field: OverlayPluginSettingsFieldDefinition;
  value: OverlayPluginSettingsValue;
  onChange: (nextValue: unknown) => void;
}) {
  if (field.kind === 'textarea' || field.kind === 'json') {
    return (
      <PluginLongFormSettingsField
        field={field}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (field.kind === 'path-list') {
    return (
      <PluginPathListSettingsField
        field={field}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (field.kind === 'extension-list') {
    return (
      <PluginExtensionListSettingsField
        field={field}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (field.kind === 'number') {
    const numericValue = typeof value === 'number' && Number.isFinite(value)
      ? value
      : typeof field.defaultValue === 'number'
        ? field.defaultValue
        : field.min ?? 0;
    return (
      <RangeField
        label={field.label}
        description={field.description ?? 'Numeric plugin setting.'}
        min={field.min ?? 0}
        max={field.max ?? Math.max(numericValue, 100)}
        step={field.step ?? 1}
        value={numericValue}
        valueLabel={String(numericValue)}
        onChange={onChange}
      />
    );
  }

  return (
    <SettingsRow
      title={field.label}
      description={field.description ?? field.kind}
      note={field.options.length > 0
        ? `Options: ${field.options.map((option) => option.label).join(', ')}`
        : undefined}
      control={buildGeneratedFieldControl(field, value, onChange)}
    />
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
  const storedValues = useSyncExternalStore(
    (onStoreChange) => controller.subscribe(() => onStoreChange()),
    controller.getStoredValues,
    controller.getStoredValues,
  );
  const resolvedValues = useMemo(
    () => controller.getResolvedValues(slot),
    [controller, slot, storedValues],
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

  const hasCustomComponent = slot.component != null;

  return (
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
            {slot.fields.some(field => !['textarea', 'json', 'path-list', 'extension-list', 'number'].includes(field.kind)) ? (
              <SettingsRowGroup>
                {slot.fields
                  .filter(field => !['textarea', 'json', 'path-list', 'extension-list', 'number'].includes(field.kind))
                  .map((field) => (
                    <PluginGeneratedSettingsField
                      key={field.id}
                      field={field}
                      value={resolvedValues[field.id] ?? null}
                      onChange={(nextValue) => controller.setValue(field.id, nextValue)}
                    />
                  ))}
              </SettingsRowGroup>
            ) : null}

            {slot.fields
              .filter(field => ['textarea', 'json', 'path-list', 'extension-list', 'number'].includes(field.kind))
              .map((field) => (
                <PluginGeneratedSettingsField
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
