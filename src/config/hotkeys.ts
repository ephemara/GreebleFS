import shippedHotkeyManifestJson from "../../usr/hotkeys/greeblefs-core/hotkeys.json";
export type HotkeyBindingKey =
  | "toggleDeveloperTelemetryHud"
  | "commandPalette"
  | "mobileShareToggle"
  | "terminalFocus"
  | "terminalToggle"
  | "windowModeToggle"
  | "zenFocusModeToggle"
  | "saveFile"
  | "newFile"
  | "newFolder"
  | "renameItem"
  | "deleteItem"
  | "duplicateItem"
  | "refreshExplorer"
  | "goBackDirectory"
  | "goForwardDirectory"
  | "goHomeDirectory"
  | "clearExplorerSearch"
  | "cycleExplorerSearchMode"
  | "findSimilarSelection"
  | "cycleExplorerSortKey"
  | "toggleExplorerSortOrder"
  | "focusExplorerList"
  | "focusExplorerAddressBar"
  | "focusExplorerPreview"
  | "toggleExplorerSources"
  | "cycleCollectionPreviewMode"
  | "cycleCollectionPreviewModeReverse"
  | "explorerMoveSelectionUp"
  | "explorerMoveSelectionDown"
  | "explorerMoveSelectionLeft"
  | "explorerMoveSelectionRight"
  | "togglePreviewLock"
  | "togglePreviewTerminal"
  | "openInTerminal"
  | "calculateRecursiveSize"
  | "revealInExplorer"
  | "openAsAdmin"
  | "extractArchiveFolderHere"
  | "extractArchiveFolderToNewFolder"
  | "goUpDirectory"
  | "copyPath"
  | "copySelection"
  | "cutSelection"
  | "pasteSelection"
  | "toggleHiddenFiles"
  | "toggleExplorerLayout"
  | "toggleExplorerCustomize"
  | "openExplorerLayoutSwitcher"
  | "cycleConstellationLens"
  | "toggleConstellationRouteMode"
  | "toggleConstellationPinSelection"
  | "selectAllExplorer"
  | "clearExplorerSelection"
  | "searchExplorer"
  | "pdfWorkbenchPreviousPage"
  | "pdfWorkbenchNextPage"
  | "pdfWorkbenchZoomIn"
  | "pdfWorkbenchZoomOut"
  | "pdfWorkbenchToggleEditMode"
  | "shaderWorkbenchToggleEditMode"
  | "shaderWorkbenchToggleScene"
  | "spreadsheetWorkbenchToggleEditMode"
  | "spreadsheetWorkbenchPreviousSheet"
  | "spreadsheetWorkbenchNextSheet"
  | "spreadsheetWorkbenchNewSheet"
  | "spreadsheetWorkbenchFocusFormulaBar"
  | "audioWorkbenchPlayPause"
  | "audioWorkbenchToggleEditMode"
  | "audioWorkbenchJumpToSelectionStart"
  | "audioWorkbenchJumpToSelectionEnd"
  | "audioWorkbenchPreviousSilence"
  | "audioWorkbenchNextSilence"
  | "audioWorkbenchExportClip"
  | "pythonWorkbenchRunManaged"
  | "pythonWorkbenchRunInTerminal"
  | "imageCutoutCopy"
  | "imageCutoutDeselect"
  | "imageEditorUndo"
  | "imageEditorRedo"
  | "imageEditorReset"
  | "closeTab"
  | "find"
  | "replace"
  | "zoomAdjust"
  | "opacityAdjust";

export interface HotkeyBindingDefinition {
  key: HotkeyBindingKey;
  label: string;
  description: string;
  defaultValue: string;
  scope: "global" | "gesture" | "local";
}

export type CommandHotkeyBindingMap = Record<string, string>;

export type HotkeyBindingSettings = Record<HotkeyBindingKey, string> & {
  commandBindingsById: CommandHotkeyBindingMap;
};

interface ShippedHotkeyManifest {
  bindings?: HotkeyBindingDefinition[];
}

const shippedHotkeyManifest =
  shippedHotkeyManifestJson as ShippedHotkeyManifest;

export const hotkeyBindingDefinitions: HotkeyBindingDefinition[] =
  Array.isArray(shippedHotkeyManifest.bindings)
    ? shippedHotkeyManifest.bindings.map((definition) => ({ ...definition }))
    : [];

const hotkeyDefinitionByKey = new Map(
  hotkeyBindingDefinitions.map((definition) => [definition.key, definition]),
);

export function createDefaultKeybindingSettings(): HotkeyBindingSettings {
  const normalizedSettings = hotkeyBindingDefinitions.reduce(
    (result, definition) => {
      result[definition.key] = definition.defaultValue;
      return result;
    },
    {} as HotkeyBindingSettings,
  );
  normalizedSettings.commandBindingsById = {};
  return normalizedSettings;
}

export function normalizeKeybindingValue(
  value: unknown,
  fallback: string,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value
    .split("+")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("+");

  return normalized || fallback;
}

export function normalizeKeybindingSettings(
  value:
    | (Partial<Record<HotkeyBindingKey, unknown>> & {
        commandBindingsById?: unknown;
        toggleExplorerSearchScope?: unknown;
      })
    | undefined,
): HotkeyBindingSettings {
  const defaults = createDefaultKeybindingSettings();
  const legacyValue = value as Record<string, unknown> | undefined;

  const normalizedSettings = hotkeyBindingDefinitions.reduce(
    (result, definition) => {
      const legacyFallbackValue =
        definition.key === "cycleExplorerSearchMode"
          ? legacyValue?.toggleExplorerSearchScope
          : undefined;
      result[definition.key] = normalizeKeybindingValue(
        value?.[definition.key] ?? legacyFallbackValue,
        defaults[definition.key],
      );
      return result;
    },
    {} as HotkeyBindingSettings,
  );
  normalizedSettings.commandBindingsById = normalizeCommandHotkeyBindingMap(
    legacyValue?.commandBindingsById,
  );
  return normalizedSettings;
}

export function normalizeCommandHotkeyBindingMap(
  value: unknown,
): CommandHotkeyBindingMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([commandId, binding]) => {
        const trimmedCommandId = commandId.trim();
        if (!trimmedCommandId) {
          return null;
        }
        const normalizedBinding = normalizeKeybindingValue(binding, "");
        if (!normalizedBinding) {
          return null;
        }
        return [trimmedCommandId, normalizedBinding] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry != null),
  );
}

export function getCommandHotkeyBinding(
  settings: Pick<HotkeyBindingSettings, "commandBindingsById">,
  commandId: string,
): string {
  return settings.commandBindingsById[commandId] ?? "";
}

export function getHotkeyBindingDefinition(
  key: HotkeyBindingKey,
): HotkeyBindingDefinition {
  return hotkeyDefinitionByKey.get(key) ?? hotkeyBindingDefinitions[0];
}

export function formatHotkeyLabel(value: string): string {
  return value.trim() || "Unassigned";
}

function normalizeGestureToken(token: string): string {
  const normalized = token.trim().toLowerCase();

  if (normalized === "control") {
    return "ctrl";
  }

  if (normalized === "option") {
    return "alt";
  }

  if (normalized === "cmdorcontrol") {
    return "commandorcontrol";
  }

  return normalized;
}

function normalizeKeyToken(token: string): string {
  if (token === " ") {
    return "space";
  }
  const normalized = normalizeGestureToken(token);
  switch (normalized) {
    case "esc":
      return "escape";
    case "return":
      return "enter";
    case "spacebar":
      return "space";
    default:
      return normalized;
  }
}

export function matchesKeybinding(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
  binding: string,
): boolean {
  const tokens = normalizeKeybindingValue(binding, "")
    .split("+")
    .map(normalizeKeyToken)
    .filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  const keyToken = tokens.find(
    (token) =>
      ![
        "ctrl",
        "meta",
        "cmd",
        "command",
        "alt",
        "shift",
        "commandorcontrol",
      ].includes(token),
  );
  if (!keyToken) {
    return false;
  }

  const needsCtrl = tokens.includes("ctrl");
  const needsMeta =
    tokens.includes("meta") ||
    tokens.includes("cmd") ||
    tokens.includes("command");
  const needsAlt = tokens.includes("alt");
  const needsShift = tokens.includes("shift");
  const needsCommandOrControl = tokens.includes("commandorcontrol");

  const ctrlMatches = needsCommandOrControl
    ? event.ctrlKey || event.metaKey
    : event.ctrlKey === needsCtrl;
  const metaMatches = needsCommandOrControl
    ? true
    : event.metaKey === needsMeta;
  const altMatches = event.altKey === needsAlt;
  const shiftMatches = event.shiftKey === needsShift;
  const normalizedEventKey = normalizeKeyToken(
    event.key.length === 1 ? event.key.toLowerCase() : event.key,
  );

  return (
    ctrlMatches &&
    metaMatches &&
    altMatches &&
    shiftMatches &&
    normalizedEventKey === keyToken
  );
}

export function matchesWheelHotkey(
  event: Pick<WheelEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
  binding: string,
): boolean {
  const tokens = normalizeKeybindingValue(binding, "Ctrl+Scroll")
    .split("+")
    .map(normalizeGestureToken);

  if (!tokens.includes("scroll")) {
    return false;
  }

  const needsCtrl = tokens.includes("ctrl");
  const needsMeta =
    tokens.includes("meta") ||
    tokens.includes("cmd") ||
    tokens.includes("command");
  const needsAlt = tokens.includes("alt");
  const needsShift = tokens.includes("shift");
  const needsCommandOrControl = tokens.includes("commandorcontrol");

  const ctrlMatches = needsCommandOrControl
    ? event.ctrlKey || event.metaKey
    : event.ctrlKey === needsCtrl;
  const metaMatches = needsCommandOrControl
    ? true
    : event.metaKey === needsMeta;

  return (
    ctrlMatches &&
    metaMatches &&
    event.altKey === needsAlt &&
    event.shiftKey === needsShift
  );
}
