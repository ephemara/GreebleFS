import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { OverlayProvider } from "react-aria";
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
import {
    initializeUsrProfilesBootstrap,
} from "./runtime/usrProfiles";
import { FILE_OPERATIONS_WINDOW_LABEL } from "./runtime/fileOperationsWindow";
import { EXPLORER_PICKER_WINDOW_LABEL } from "./runtime/explorerPicker";
import {
    getCurrentSecondaryWindowDescriptor,
    type SecondaryWindowDescriptor,
} from "./runtime/secondaryWindows";
import {
    installGreeblefsDevMcpBridge,
    markGreeblefsDevMcpBridgeRenderComplete,
} from "./runtime/devMcpBridge";
import type {
    BootstrapRootComponent,
    BootstrapRootId,
} from "./runtime/bootstrapRootModules";

type BootstrapRootModule = {
    default: BootstrapRootComponent;
};

const DEV_BOOTSTRAP_ROOT_MODULE_PATHS = {
    app: "/src/App.tsx",
    fileOperations: "/src/windows/FileOperationsWindowApp.tsx",
    explorerPicker: "/src/windows/PickerWindowApp.tsx",
} satisfies Record<BootstrapRootId, string>;

const importUnanalyzedModule = new Function("modulePath", "return import(modulePath)") as <Module>(
    modulePath: string,
) => Promise<Module>;

async function loadDevBootstrapRoot(rootId: BootstrapRootId) {
    const modulePath = DEV_BOOTSTRAP_ROOT_MODULE_PATHS[rootId];
    const module = await importUnanalyzedModule<BootstrapRootModule>(modulePath);
    return module.default;
}

async function loadBootstrapRoot(rootId: BootstrapRootId) {
    if (import.meta.env.DEV) {
        return loadDevBootstrapRoot(rootId);
    }

    const { loadProductionBootstrapRoot } = await import("./runtime/bootstrapRootModules");
    return loadProductionBootstrapRoot(rootId);
}

if (import.meta.env.VITE_GREEBLEFS_REACT_SCAN_ENABLED === "1") {
    void import("./runtime/devReactScan").then(({ installDevReactScan }) => installDevReactScan());
}

function markBootstrapPhase(phase: string) {
    const elapsedMs = Math.round(performance.now());
    performance.mark(`greeblefs-bootstrap:${phase}`);
    console.info(`[GreebleFS bootstrap] ${phase} at ${elapsedMs}ms`);
}

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

async function resolveBootstrapTarget() {
    if (isTauri()) {
        try {
            const secondaryWindowDescriptor = await getCurrentSecondaryWindowDescriptor();
            if (secondaryWindowDescriptor) {
                if (secondaryWindowDescriptor.surfaceKind === 'file-operations') {
                    return {
                        RootComponent: await loadBootstrapRoot("fileOperations"),
                        rootProps: {},
                    };
                }
                if (secondaryWindowDescriptor.surfaceKind === 'explorer-picker') {
                    return {
                        RootComponent: await loadBootstrapRoot("explorerPicker"),
                        rootProps: {},
                    };
                }

                return {
                    RootComponent: await loadBootstrapRoot("app"),
                    rootProps: { secondaryWindowDescriptor },
                };
            }

            const windowLabel = getCurrentWebviewWindow().label;
            if (windowLabel === FILE_OPERATIONS_WINDOW_LABEL) {
                return {
                    RootComponent: await loadBootstrapRoot("fileOperations"),
                    rootProps: {},
                };
            }
            if (windowLabel === EXPLORER_PICKER_WINDOW_LABEL) {
                return {
                    RootComponent: await loadBootstrapRoot("explorerPicker"),
                    rootProps: {},
                };
            }
        } catch {
            // Fall back to the main app bootstrap when the webview label is unavailable.
        }
    }

    return {
        RootComponent: await loadBootstrapRoot("app"),
        rootProps: {} as { secondaryWindowDescriptor?: SecondaryWindowDescriptor | null },
    };
}

async function bootstrapApp() {
    try {
        markBootstrapPhase('bridge-install-start');
        await installGreeblefsDevMcpBridge();
        markBootstrapPhase('managed-content-start');
        await initializeManagedContentDirectories();
        markBootstrapPhase('usr-profiles-start');
        await initializeUsrProfilesBootstrap();
        markBootstrapPhase('root-target-start');
        const { RootComponent, rootProps } = await resolveBootstrapTarget();
        markBootstrapPhase('root-target-ready');
        document.documentElement.classList.add('overlay-scrollbar-scope');
        document.body.classList.add('overlay-scrollbar-scope');
        document.getElementById('root')?.classList.add('overlay-scrollbar-scope');

        ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
          <React.StrictMode>
            <OverlayProvider>
              <RootComponent {...rootProps} />
            </OverlayProvider>
          </React.StrictMode>
        );
        markGreeblefsDevMcpBridgeRenderComplete();
        markBootstrapPhase('root-render-submitted');
    } catch (error) {
        reportGlobalError("GreebleFS render bootstrap failed", formatGlobalErrorDetail(error));
    }
}

void bootstrapApp();
