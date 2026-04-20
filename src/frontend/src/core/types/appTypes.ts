// Common app state types used across all K-apps

export interface AppStatus {
    message: string;
    timestamp?: number;
}

export type AppMode = string;
export type AppTab = string;

export interface SpaceMenuState {
    isOpen: boolean;
    position: { x: number; y: number };
}

