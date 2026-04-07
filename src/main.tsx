import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

function mountFatalOverlay(title: string, detail: string): void {
    const existing = document.getElementById("overlayterm-fatal-startup-error");
    if (existing) {
        existing.textContent = `${title}\n\n${detail}`;
        return;
    }

    const pre = document.createElement("pre");
    pre.id = "overlayterm-fatal-startup-error";
    pre.textContent = `${title}\n\n${detail}`;
    pre.style.position = "fixed";
    pre.style.inset = "24px";
    pre.style.margin = "0";
    pre.style.padding = "20px";
    pre.style.zIndex = "2147483647";
    pre.style.overflow = "auto";
    pre.style.whiteSpace = "pre-wrap";
    pre.style.fontFamily = "Consolas, 'Courier New', monospace";
    pre.style.fontSize = "13px";
    pre.style.lineHeight = "1.5";
    pre.style.color = "#ffe7e7";
    pre.style.background = "rgba(26, 8, 10, 0.96)";
    pre.style.border = "1px solid rgba(255, 120, 120, 0.42)";
    pre.style.borderRadius = "16px";
    pre.style.boxShadow = "0 24px 80px rgba(0, 0, 0, 0.45)";
    document.body.appendChild(pre);
}

function formatFatalDetail(value: unknown): string {
    if (value instanceof Error) {
        return value.stack || `${value.name}: ${value.message}`;
    }

    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

window.addEventListener("error", (event) => {
    mountFatalOverlay("OverlayTerm startup error", formatFatalDetail(event.error ?? event.message));
});

window.addEventListener("unhandledrejection", (event) => {
    mountFatalOverlay("OverlayTerm unhandled rejection", formatFatalDetail(event.reason));
});

// Disable default browser context menu globally for Tauri
document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const isContentEditable = target.isContentEditable;

    if (!isInput && !isContentEditable) {
        e.preventDefault();
    }
}, { capture: true });

// Disable text selection on double-click
document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const isContentEditable = target.isContentEditable;
    const isCode = target.closest('.monaco-editor, pre, code');

    if (!isInput && !isContentEditable && !isCode) {
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

try {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
} catch (error) {
    mountFatalOverlay("OverlayTerm render bootstrap failed", formatFatalDetail(error));
    throw error;
}
