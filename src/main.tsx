import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
