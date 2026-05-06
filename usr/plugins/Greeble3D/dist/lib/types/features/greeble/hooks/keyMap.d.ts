/**
 * K-Greeble Standalone Key Map
 * Simplified input system for the web demo
 */
export declare const InputActions: {
    readonly FORWARD: "FORWARD";
    readonly BACKWARD: "BACKWARD";
    readonly LEFT: "LEFT";
    readonly RIGHT: "RIGHT";
    readonly UP: "UP";
    readonly DOWN: "DOWN";
    readonly FAST: "FAST";
    readonly SLOW: "SLOW";
    readonly NAVIGATE: "NAVIGATE";
    readonly MENU: "MENU";
    readonly FOCUS: "FOCUS";
    readonly DELETE: "DELETE";
    readonly UNDO: "UNDO";
    readonly REDO: "REDO";
    readonly SAVE: "SAVE";
    readonly DUPLICATE: "DUPLICATE";
    readonly SELECT_ALL: "SELECT_ALL";
    readonly SLOT_1: "SLOT_1";
    readonly SLOT_2: "SLOT_2";
    readonly SLOT_3: "SLOT_3";
    readonly SLOT_4: "SLOT_4";
    readonly GIZMO_TRANSLATE: "GIZMO_TRANSLATE";
    readonly GIZMO_ROTATE: "GIZMO_ROTATE";
    readonly GIZMO_SCALE: "GIZMO_SCALE";
    readonly SYMMETRY_X: "SYMMETRY_X";
    readonly SYMMETRY_Z: "SYMMETRY_Z";
    readonly SYMMETRY_RADIAL: "SYMMETRY_RADIAL";
    readonly TOGGLE_GRID: "TOGGLE_GRID";
    readonly TOGGLE_SURFACE: "TOGGLE_SURFACE";
    readonly TOGGLE_MODE: "TOGGLE_MODE";
};
export type InputActionType = keyof typeof InputActions;
export declare const DefaultKeyMap: Record<string, InputActionType>;
