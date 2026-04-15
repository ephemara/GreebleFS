import React from "react";
import ReactDOM from "react-dom/client";
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

async function bootstrapApp() {
    try {
        await initializeManagedContentDirectories();
        const { default: App } = await import("./App");

        ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
    } catch (error) {
        reportGlobalError("GreebleFS render bootstrap failed", formatGlobalErrorDetail(error));
    }
}

void bootstrapApp();
