/**
 * K-Greeble Standalone Key Map
 * Simplified input system for the web demo
 */

export const InputActions = {
    // MOVEMENT
    FORWARD: 'FORWARD',
    BACKWARD: 'BACKWARD',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    UP: 'UP',
    DOWN: 'DOWN',
    FAST: 'FAST',
    SLOW: 'SLOW',

    // TOOLS & UX
    NAVIGATE: 'NAVIGATE', // Alt (Orbit)
    MENU: 'MENU',         // Space (Pie Menu / Mods)
    FOCUS: 'FOCUS',       // F (Frame Selected)
    DELETE: 'DELETE',     // Del/Backspace

    // HISTORY & FILE
    UNDO: 'UNDO',
    REDO: 'REDO',
    SAVE: 'SAVE',

    // EDITOR
    DUPLICATE: 'DUPLICATE',
    SELECT_ALL: 'SELECT_ALL',

    // SLOTS
    SLOT_1: 'SLOT_1',
    SLOT_2: 'SLOT_2',
    SLOT_3: 'SLOT_3',
    SLOT_4: 'SLOT_4',

    // GIZMO & MODES
    GIZMO_TRANSLATE: 'GIZMO_TRANSLATE',
    GIZMO_ROTATE: 'GIZMO_ROTATE',
    GIZMO_SCALE: 'GIZMO_SCALE',
    
    // MODIFIERS
    SYMMETRY_X: 'SYMMETRY_X',
    SYMMETRY_Z: 'SYMMETRY_Z',
    SYMMETRY_RADIAL: 'SYMMETRY_RADIAL',
    TOGGLE_GRID: 'TOGGLE_GRID',
    TOGGLE_SURFACE: 'TOGGLE_SURFACE',
    TOGGLE_MODE: 'TOGGLE_MODE',
} as const;

export type InputActionType = keyof typeof InputActions;

export const DefaultKeyMap: Record<string, InputActionType> = {
    // Movement
    'w': 'FORWARD',
    's': 'BACKWARD',
    'a': 'LEFT',
    'd': 'RIGHT',
    'e': 'UP',
    'q': 'DOWN',
    'shift': 'FAST',
    'control': 'SLOW',

    // UX
    'alt': 'NAVIGATE',
    ' ': 'MENU',
    'f': 'FOCUS',
    'delete': 'DELETE',
    'backspace': 'DELETE',
    'escape': 'MENU',
    'tab': 'TOGGLE_MODE',

    // History
    'z': 'UNDO',
    'y': 'REDO',
    'd_ctrl': 'DUPLICATE',
    'a_ctrl': 'SELECT_ALL',

    // Gizmos (Overriding Slots 1-3)
    '1': 'GIZMO_TRANSLATE',
    '2': 'GIZMO_ROTATE',
    '3': 'GIZMO_SCALE',
    '4': 'SLOT_4',

    // Modifiers
    'x': 'SYMMETRY_X',
    'c': 'SYMMETRY_Z',
    'v': 'SYMMETRY_RADIAL',
    'b': 'TOGGLE_GRID',
    'g': 'TOGGLE_SURFACE', // G for Ground/Surface
};
