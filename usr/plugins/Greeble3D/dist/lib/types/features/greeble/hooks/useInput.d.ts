/**
 * K-Greeble Standalone Input Hook
 * Simplified input system for the web demo
 */
import { InputActionType } from './keyMap';
type ActionHandler = () => void;
interface InputOptions {
    onActionDown?: Partial<Record<InputActionType, ActionHandler>>;
    onActionUp?: Partial<Record<InputActionType, ActionHandler>>;
    enable?: boolean;
}
export declare const useInput: (options?: InputOptions) => {
    activeActions: import("react").MutableRefObject<Set<"FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "UP" | "DOWN" | "FAST" | "SLOW" | "NAVIGATE" | "MENU" | "FOCUS" | "DELETE" | "UNDO" | "REDO" | "SAVE" | "DUPLICATE" | "SELECT_ALL" | "SLOT_1" | "SLOT_2" | "SLOT_3" | "SLOT_4" | "GIZMO_TRANSLATE" | "GIZMO_ROTATE" | "GIZMO_SCALE" | "SYMMETRY_X" | "SYMMETRY_Z" | "SYMMETRY_RADIAL" | "TOGGLE_GRID" | "TOGGLE_SURFACE" | "TOGGLE_MODE">>;
    isPressed: (action: InputActionType) => boolean;
};
export {};
