
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
    'escape': 'MENU', // Contextual close

    // History (Combinations are handled by parser logic in hook)
    'z': 'UNDO', // + Ctrl
    'y': 'REDO', // + Ctrl
    // 's' for SAVE is handled in logic (Ctrl+S), 's' here is BACKWARD
    'd_ctrl': 'DUPLICATE', // Special marker for combo if needed, or handled via logic
    'a_ctrl': 'SELECT_ALL',

    // Slots
    '1': 'SLOT_1',
    '2': 'SLOT_2',
    '3': 'SLOT_3',
    '4': 'SLOT_4',
};
