import React from 'react';
interface GreebleAppShellProps {
    topBar: React.ReactNode;
    leftPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    viewport: React.ReactNode;
    bottomOverlay?: React.ReactNode;
    autoSaveId?: string;
}
export declare function GreebleAppShell({ topBar, leftPanel, rightPanel, viewport, bottomOverlay, autoSaveId, }: GreebleAppShellProps): import("react/jsx-runtime").JSX.Element;
export {};
