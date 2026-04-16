import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

const browserMocks = vi.hoisted(() => {
  const createMockWebviewWindow = (label: string) => ({
    label,
    close: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    listen: vi.fn().mockResolvedValue(() => {}),
    once: vi.fn().mockImplementation(async (_event: string, handler?: () => void | Promise<void>) => {
      await handler?.();
      return () => {};
    }),
    setFocus: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
  });

  const webviewWindowRegistry = new Map<string, ReturnType<typeof createMockWebviewWindow>>();
  const ensureWebviewWindow = (label: string) => {
    const existingWindow = webviewWindowRegistry.get(label);
    if (existingWindow) {
      return existingWindow;
    }

    const nextWindow = createMockWebviewWindow(label);
    webviewWindowRegistry.set(label, nextWindow);
    return nextWindow;
  };

  const mainWebviewWindow = ensureWebviewWindow('main');
  const dockWebviewWindow = ensureWebviewWindow('dock');

  class MockWebviewWindow {
    static getByLabel = vi.fn(async (label: string) => webviewWindowRegistry.get(label) ?? null);

    constructor(label: string) {
      return ensureWebviewWindow(label);
    }
  }

  const currentWindow = {
    close: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn().mockResolvedValue(undefined),
    emitTo: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockResolvedValue(false),
    is_visible: vi.fn().mockResolvedValue(false),
    listen: vi.fn().mockResolvedValue(() => {}),
    maximize: vi.fn().mockResolvedValue(undefined),
    minimize: vi.fn().mockResolvedValue(undefined),
    onCloseRequested: vi.fn().mockResolvedValue(() => {}),
    onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
    onMoved: vi.fn().mockResolvedValue(() => {}),
    onResized: vi.fn().mockResolvedValue(() => {}),
    outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    outerSize: vi.fn().mockResolvedValue({ width: 1000, height: 500 }),
    scaleFactor: vi.fn().mockResolvedValue(1),
    setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
    setDecorations: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    setResizable: vi.fn().mockResolvedValue(undefined),
    setShadow: vi.fn().mockResolvedValue(undefined),
    setSize: vi.fn().mockResolvedValue(undefined),
    setSkipTaskbar: vi.fn().mockResolvedValue(undefined),
    setTitle: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    startDragging: vi.fn().mockResolvedValue(undefined),
    startResizeDragging: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
    unminimize: vi.fn().mockResolvedValue(undefined),
  };

  const resetMockWebviewWindows = () => {
    webviewWindowRegistry.clear();
    webviewWindowRegistry.set('main', mainWebviewWindow);
    webviewWindowRegistry.set('dock', dockWebviewWindow);
  };

  return {
    PhysicalPosition: vi.fn(),
    PhysicalSize: vi.fn(),
    availableMonitors: vi.fn().mockResolvedValue([{
      name: 'Primary Display',
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      scaleFactor: 1,
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
      },
    }]),
    currentMonitor: vi.fn().mockResolvedValue({
      name: 'Primary Display',
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      scaleFactor: 1,
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
      },
    }),
    currentWindow,
    dockWebviewWindow,
    emit: vi.fn().mockResolvedValue(undefined),
    ensureWebviewWindow,
    getCurrentWebviewWindow: vi.fn(() => mainWebviewWindow),
    getCurrentWindow: vi.fn(() => currentWindow),
    getWebviewWindowByLabel: MockWebviewWindow.getByLabel,
    invoke: vi.fn().mockResolvedValue(null),
    isTauri: vi.fn(() => true),
    listen: vi.fn().mockResolvedValue(() => {}),
    mainWebviewWindow,
    MockWebviewWindow,
    primaryMonitor: vi.fn().mockResolvedValue({
      name: 'Primary Display',
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      scaleFactor: 1,
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
      },
    }),
    resetMockWebviewWindows,
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: browserMocks.invoke,
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
  isTauri: browserMocks.isTauri,
}));

vi.mock('@tauri-apps/api/window', () => ({
  availableMonitors: browserMocks.availableMonitors,
  currentMonitor: browserMocks.currentMonitor,
  getCurrentWindow: browserMocks.getCurrentWindow,
  primaryMonitor: browserMocks.primaryMonitor,
  PhysicalSize: browserMocks.PhysicalSize,
  PhysicalPosition: browserMocks.PhysicalPosition,
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: browserMocks.getCurrentWebviewWindow,
  WebviewWindow: browserMocks.MockWebviewWindow,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: browserMocks.listen,
  emit: browserMocks.emit,
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);

    constructor(_name: string) {}
  },
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
  isRegistered: vi.fn().mockResolvedValue(false),
  unregisterAll: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@monaco-editor/react', () => ({
  default: () => null,
}));

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  browserMocks.resetMockWebviewWindows();
  vi.restoreAllMocks();
});
