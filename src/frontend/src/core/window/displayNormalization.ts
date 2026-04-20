import { LogicalSize, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';

const DEFAULT_WINDOW_WIDTH = 1400;
const DEFAULT_WINDOW_HEIGHT = 900;
const MIN_WINDOW_WIDTH = 1180;
const MIN_WINDOW_HEIGHT = 760;
const MAX_BOOTSTRAP_WIDTH = 1920;
const MAX_BOOTSTRAP_HEIGHT = 1280;

function isTauriRuntime(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

function applyDocumentMetrics(width: number, height: number, scaleFactor: number) {
    const root = document.documentElement;
    root.style.setProperty('--kos-window-width', `${Math.round(width)}px`);
    root.style.setProperty('--kos-window-height', `${Math.round(height)}px`);
    root.style.setProperty('--kos-window-scale-factor', `${scaleFactor}`);
    root.style.setProperty('--kos-visual-viewport-scale', `${window.visualViewport?.scale ?? 1}`);
    root.style.fontSize = '16px';

    document.body.style.zoom = '1';
}

function installZoomGuards(reapply: () => void) {
    const preventGestureZoom = (event: Event) => {
        event.preventDefault();
        reapply();
    };

    const preventShortcutZoom = (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey)) {
            return;
        }

        if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '0') {
            event.preventDefault();
            reapply();
        }
    };

    const preventWheelZoom = (event: WheelEvent) => {
        if (!(event.ctrlKey || event.metaKey)) {
            return;
        }

        event.preventDefault();
        reapply();
    };

    window.addEventListener('keydown', preventShortcutZoom, { passive: false });
    window.addEventListener('wheel', preventWheelZoom, { passive: false });
    window.addEventListener('gesturestart', preventGestureZoom, { passive: false });
    window.addEventListener('gesturechange', preventGestureZoom, { passive: false });
    window.addEventListener('gestureend', preventGestureZoom, { passive: false });

    return () => {
        window.removeEventListener('keydown', preventShortcutZoom);
        window.removeEventListener('wheel', preventWheelZoom);
        window.removeEventListener('gesturestart', preventGestureZoom);
        window.removeEventListener('gesturechange', preventGestureZoom);
        window.removeEventListener('gestureend', preventGestureZoom);
    };
}

export async function installDisplayNormalization(): Promise<void> {
    if (typeof window === 'undefined') {
        return;
    }

    const reapplyBrowserMetrics = () => {
        applyDocumentMetrics(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    };

    if (!isTauriRuntime()) {
        reapplyBrowserMetrics();
        installZoomGuards(reapplyBrowserMetrics);
        return;
    }

    const appWindow = getCurrentWindow();
    const webview = getCurrentWebview();

    let rafId = 0;

    const applyNormalization = async (allowResize: boolean) => {
        try {
            await webview.setAutoResize(true);
        } catch {}

        try {
            await webview.setZoom(1);
        } catch {}

        try {
            const scaleFactor = await appWindow.scaleFactor();
            const innerSize = await appWindow.innerSize();
            const logicalSize = innerSize.toLogical(scaleFactor);

            applyDocumentMetrics(logicalSize.width, logicalSize.height, scaleFactor);

            if (!allowResize) {
                return;
            }

            const monitor = await currentMonitor();
            const isMaximized = await appWindow.isMaximized();

            await appWindow
                .setMinSize(new LogicalSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT))
                .catch(() => {});

            if (!monitor || isMaximized) {
                return;
            }

            const workArea = monitor.workArea.size.toLogical(monitor.scaleFactor);
            const isDefaultBootstrapSize =
                logicalSize.width <= DEFAULT_WINDOW_WIDTH + 40
                && logicalSize.height <= DEFAULT_WINDOW_HEIGHT + 40;
            const exceedsWorkArea =
                logicalSize.width > workArea.width * 0.98
                || logicalSize.height > workArea.height * 0.98;
            const significantlyUndersized =
                workArea.width >= 1600
                && logicalSize.width < workArea.width * 0.78;

            if (!isDefaultBootstrapSize && !exceedsWorkArea && !significantlyUndersized) {
                return;
            }

            const targetWidth = Math.max(
                MIN_WINDOW_WIDTH,
                Math.min(MAX_BOOTSTRAP_WIDTH, Math.floor(workArea.width * 0.92))
            );
            const targetHeight = Math.max(
                MIN_WINDOW_HEIGHT,
                Math.min(MAX_BOOTSTRAP_HEIGHT, Math.floor(workArea.height * 0.92))
            );

            await appWindow.setSize(new LogicalSize(targetWidth, targetHeight));
            await appWindow.center().catch(() => {});
            applyDocumentMetrics(targetWidth, targetHeight, scaleFactor);
        } catch {
            reapplyBrowserMetrics();
        }
    };

    const scheduleNormalization = (allowResize: boolean) => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            void applyNormalization(allowResize);
        });
    };

    const removeZoomGuards = installZoomGuards(() => scheduleNormalization(false));
    const handleResize = () => scheduleNormalization(false);

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    const unlistenResized = await appWindow.onResized(() => scheduleNormalization(false)).catch(() => null);
    const unlistenFocused = await appWindow.onFocusChanged(({ payload }) => {
        if (payload) {
            scheduleNormalization(false);
        }
    }).catch(() => null);
    const unlistenScale = await appWindow.onScaleChanged(() => scheduleNormalization(true)).catch(() => null);

    window.addEventListener('beforeunload', () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', handleResize);
        window.visualViewport?.removeEventListener('resize', handleResize);
        removeZoomGuards();
        unlistenResized?.();
        unlistenFocused?.();
        unlistenScale?.();
    }, { once: true });

    await applyNormalization(true);
}
