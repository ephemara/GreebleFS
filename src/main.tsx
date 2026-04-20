import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./App.css";
import {
    shouldAllowDocumentSelection,
    shouldAllowNativeContextMenu,
} from "./runtime/documentInteractionGuards";
import {
    formatGlobalErrorDetail,
    reportGlobalError,
} from "./runtime/globalErrorPanel";
import { initializeManagedContentDirectories } from "./config/appContentDirectories";
import { FILE_OPERATIONS_WINDOW_LABEL } from "./runtime/fileOperationsWindow";

window.addEventListener("error", (event) => {
    reportGlobalError(
        "GreebleFS runtime error",
        formatGlobalErrorDetail(
            event.error
            ?? {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            },
        ),
    );
});

window.addEventListener("unhandledrejection", (event) => {
    reportGlobalError("GreebleFS unhandled rejection", formatGlobalErrorDetail(event.reason));
});

// Disable default browser context menu globally for Tauri
document.addEventListener('contextmenu', (e) => {
    if (!shouldAllowNativeContextMenu(e.target)) {
        e.preventDefault();
    }
}, { capture: true });

// Disable text selection on double-click
document.addEventListener('selectstart', (e) => {
    if (!shouldAllowDocumentSelection(e.target)) {
        e.preventDefault();
    }
});

document.addEventListener('keydown', (e) => {
    const isTerminalFocusChord = e.ctrlKey
        && !e.metaKey
        && !e.altKey
        && !e.shiftKey
        && e.key.toLowerCase() === 'j';

    if (isTerminalFocusChord) {
        e.preventDefault();
    }
}, { capture: true });

async function resolveBootstrapComponent() {
    if (isTauri()) {
        try {
            if (getCurrentWebviewWindow().label === FILE_OPERATIONS_WINDOW_LABEL) {
                return import("./windows/FileOperationsWindowApp");
            }
        } catch {
            // Fall back to the main app bootstrap when the webview label is unavailable.
        }
    }

    return import("./App");
}

async function bootstrapApp() {
    try {
        await initializeManagedContentDirectories();
        const { default: RootComponent } = await resolveBootstrapComponent();
        document.documentElement.classList.add('overlay-scrollbar-scope');
        document.body.classList.add('overlay-scrollbar-scope');
        document.getElementById('root')?.classList.add('overlay-scrollbar-scope');

        ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
          <React.StrictMode>
            <RootComponent />
          </React.StrictMode>
        );
    } catch (error) {
        reportGlobalError("GreebleFS render bootstrap failed", formatGlobalErrorDetail(error));
    }
}

void bootstrapApp();
