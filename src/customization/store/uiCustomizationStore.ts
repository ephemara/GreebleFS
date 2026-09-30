import { create } from "zustand";
import type {
  ExplorerChromeControlId,
  ExplorerChromeOverrideSnapshot,
  ZBrushDragState,
  ZBrushDropTarget,
  ZBrushHotkeyModalState,
  ZBrushIconPickerState,
} from "../types";

export interface UiCustomizationState {
  isCustomizeMode: boolean;
  activeDrag: ZBrushDragState | null;
  selectedControlId: ExplorerChromeControlId | null;
  hotkeyModal: ZBrushHotkeyModalState | null;
  iconPicker: ZBrushIconPickerState | null;
  undoHistory: ExplorerChromeOverrideSnapshot[];
  redoHistory: ExplorerChromeOverrideSnapshot[];

  // Actions
  setCustomizeMode: (active: boolean) => void;
  toggleCustomizeMode: () => void;
  startDrag: (args: {
    controlId: ExplorerChromeControlId;
    sourceKind: "placed" | "catalog";
    sourceSurfaceId?: ZBrushDragState["sourceSurfaceId"];
    sourceZoneId?: ZBrushDragState["sourceZoneId"];
    sourceIndex?: number;
    label: string;
    iconName?: string;
    pointerX: number;
    pointerY: number;
  }) => void;
  updateDragPointer: (
    pointerX: number,
    pointerY: number,
    dropTarget: ZBrushDropTarget | null,
    isRemoveTarget: boolean,
  ) => void;
  finishDrag: () => void;
  cancelDrag: () => void;
  setSelectedControl: (controlId: ExplorerChromeControlId | null) => void;
  openHotkeyModal: (args: {
    controlId: ExplorerChromeControlId;
    commandId: string;
    label: string;
    currentBinding?: string | null;
  }) => void;
  closeHotkeyModal: () => void;
  openIconPicker: (
    controlId: ExplorerChromeControlId,
    anchorRect?: ZBrushIconPickerState["anchorRect"],
  ) => void;
  closeIconPicker: () => void;
  pushSnapshot: (snapshot: ExplorerChromeOverrideSnapshot) => void;
  undo: () => ExplorerChromeOverrideSnapshot | null;
  redo: () => ExplorerChromeOverrideSnapshot | null;
  clearHistory: () => void;
}

const MAX_HISTORY = 30;

export const useUiCustomizationStore = create<UiCustomizationState>((set, get) => ({
  isCustomizeMode: false,
  activeDrag: null,
  selectedControlId: null,
  hotkeyModal: null,
  iconPicker: null,
  undoHistory: [],
  redoHistory: [],

  setCustomizeMode: (active: boolean) =>
    set({
      isCustomizeMode: active,
      activeDrag: null,
      selectedControlId: active ? get().selectedControlId : null,
      hotkeyModal: null,
      iconPicker: null,
    }),

  toggleCustomizeMode: () =>
    set((state) => ({
      isCustomizeMode: !state.isCustomizeMode,
      activeDrag: null,
      selectedControlId: !state.isCustomizeMode ? state.selectedControlId : null,
      hotkeyModal: null,
      iconPicker: null,
    })),

  startDrag: (args) =>
    set({
      activeDrag: {
        active: true,
        controlId: args.controlId,
        sourceKind: args.sourceKind,
        sourceSurfaceId: args.sourceSurfaceId,
        sourceZoneId: args.sourceZoneId,
        sourceIndex: args.sourceIndex,
        label: args.label,
        iconName: args.iconName,
        pointerX: args.pointerX,
        pointerY: args.pointerY,
        dropTarget: null,
        isRemoveTarget: false,
      },
      selectedControlId: args.controlId,
    }),

  updateDragPointer: (pointerX, pointerY, dropTarget, isRemoveTarget) =>
    set((state) => {
      if (!state.activeDrag) return state;
      return {
        activeDrag: {
          ...state.activeDrag,
          pointerX,
          pointerY,
          dropTarget,
          isRemoveTarget,
        },
      };
    }),

  finishDrag: () =>
    set({
      activeDrag: null,
    }),

  cancelDrag: () =>
    set({
      activeDrag: null,
    }),

  setSelectedControl: (controlId) =>
    set({
      selectedControlId: controlId,
    }),

  openHotkeyModal: (args) =>
    set({
      hotkeyModal: {
        active: true,
        controlId: args.controlId,
        commandId: args.commandId,
        label: args.label,
        currentBinding: args.currentBinding ?? null,
      },
    }),

  closeHotkeyModal: () =>
    set({
      hotkeyModal: null,
    }),

  openIconPicker: (controlId, anchorRect) =>
    set({
      iconPicker: {
        active: true,
        controlId,
        anchorRect: anchorRect ?? null,
      },
    }),

  closeIconPicker: () =>
    set({
      iconPicker: null,
    }),

  pushSnapshot: (snapshot) =>
    set((state) => ({
      undoHistory: [...state.undoHistory.slice(-(MAX_HISTORY - 1)), snapshot],
      redoHistory: [],
    })),

  undo: () => {
    const { undoHistory, redoHistory } = get();
    if (undoHistory.length === 0) return null;
    const previous = undoHistory[undoHistory.length - 1];
    const newUndo = undoHistory.slice(0, -1);
    set({
      undoHistory: newUndo,
      redoHistory: [previous, ...redoHistory.slice(0, MAX_HISTORY - 1)],
    });
    return previous;
  },

  redo: () => {
    const { undoHistory, redoHistory } = get();
    if (redoHistory.length === 0) return null;
    const next = redoHistory[0];
    const newRedo = redoHistory.slice(1);
    set({
      undoHistory: [...undoHistory, next],
      redoHistory: newRedo,
    });
    return next;
  },

  clearHistory: () =>
    set({
      undoHistory: [],
      redoHistory: [],
    }),
}));
