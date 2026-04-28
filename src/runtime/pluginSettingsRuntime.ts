import {
  normalizeOverlayPluginSettingsValueMap,
  resolveOverlayPluginSettingsSlotValues,
  sanitizeOverlayPluginSettingsValue,
  type OverlayPluginSettingsSlotDescriptor,
  type OverlayPluginSettingsValue,
} from '../config/pluginSettings';
import { useSettingsStore } from '../store/settingsStore';

export interface OverlayPluginRuntimeSettingsController {
  getStoredValues: () => Record<string, OverlayPluginSettingsValue>;
  getResolvedValues: (
    slot?: Pick<OverlayPluginSettingsSlotDescriptor, 'defaults' | 'fields'> | null,
  ) => Record<string, OverlayPluginSettingsValue>;
  getValue: <TValue = OverlayPluginSettingsValue>(
    settingId: string,
    fallbackValue?: TValue,
  ) => TValue | OverlayPluginSettingsValue;
  setValue: (settingId: string, value: unknown) => void;
  patchValues: (updates: Record<string, unknown>) => void;
  resetValues: (settingIds?: string[]) => void;
  subscribe: (
    listener: (values: Record<string, OverlayPluginSettingsValue>) => void,
  ) => () => void;
}

function readPluginStoredSettings(
  pluginId: string,
): Record<string, OverlayPluginSettingsValue> {
  return (
    useSettingsStore.getState().settings.plugins.valuesByPluginId[pluginId] ?? {}
  );
}

export function createOverlayPluginRuntimeSettingsController(
  pluginId: string,
): OverlayPluginRuntimeSettingsController {
  return {
    getStoredValues: () => readPluginStoredSettings(pluginId),
    getResolvedValues: (slot) =>
      slot
        ? resolveOverlayPluginSettingsSlotValues(
            slot,
            readPluginStoredSettings(pluginId),
          )
        : readPluginStoredSettings(pluginId),
    getValue: (settingId, fallbackValue) => {
      const normalizedSettingId = settingId.trim();
      if (!normalizedSettingId) {
        return fallbackValue ?? null;
      }
      const storedValues = readPluginStoredSettings(pluginId);
      return normalizedSettingId in storedValues
        ? storedValues[normalizedSettingId]
        : (fallbackValue ?? null);
    },
    setValue: (settingId, value) => {
      const normalizedSettingId = settingId.trim();
      if (!normalizedSettingId) {
        return;
      }
      useSettingsStore
        .getState()
        .setPluginSettingValue(pluginId, normalizedSettingId, value);
    },
    patchValues: (updates) => {
      useSettingsStore.getState().patchPluginSettings(pluginId, updates);
    },
    resetValues: (settingIds) => {
      useSettingsStore.getState().resetPluginSettings(pluginId, settingIds);
    },
    subscribe: (listener) =>
      useSettingsStore.subscribe((state, previousState) => {
        const nextValues = state.settings.plugins.valuesByPluginId[pluginId] ?? {};
        const previousValues =
          previousState.settings.plugins.valuesByPluginId[pluginId] ?? {};
        if (nextValues === previousValues) {
          return;
        }
        listener(nextValues);
      }),
  };
}

export function resolveOverlayPluginSettingsDefaultMap(
  value: unknown,
): Record<string, OverlayPluginSettingsValue> {
  return normalizeOverlayPluginSettingsValueMap(value);
}

export function sanitizeOverlayPluginRuntimeSettingValue(
  value: unknown,
): OverlayPluginSettingsValue | undefined {
  return sanitizeOverlayPluginSettingsValue(value);
}
