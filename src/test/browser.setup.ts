import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

const browserMocks = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(null),
  isTauri: vi.fn(() => true),
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
  mainWebviewWindow: {
    label: 'main',
    emit: vi.fn().mockResolvedValue(undefined),
    listen: vi.fn().mockResolvedValue(() => {}),
    once: vi.fn().mockResolvedValue(() => {}),
  },
  dockWebviewWindow: {
    label: 'dock',
    emit: vi.fn().mockResolvedValue(undefined),
    listen: vi.fn().mockResolvedValue(() => {}),
    once: vi.fn().mockResolvedValue(() => {}),
  },
  getCurrentWebviewWindow: vi.fn(),
  getWebviewWindowByLabel: vi.fn(),
  getCurrentWindow: vi.fn(() => ({
    scaleFactor: vi.fn().mockResolvedValue(1),
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    setDecorations: vi.fn().mockResolvedValue(undefined),
    setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
    setResizable: vi.fn().mockResolvedValue(undefined),
    setShadow: vi.fn().mockResolvedValue(undefined),
    setSkipTaskbar: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    maximize: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
    minimize: vi.fn().mockResolvedValue(undefined),
    unminimize: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockResolvedValue(false),
    outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    outerSize: vi.fn().mockResolvedValue({ width: 1000, height: 500 }),
    onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
    onResized: vi.fn().mockResolvedValue(() => {}),
    onMoved: vi.fn().mockResolvedValue(() => {}),
    onCloseRequested: vi.fn().mockResolvedValue(() => {}),
    is_visible: vi.fn().mockResolvedValue(false),
    startResizeDragging: vi.fn().mockResolvedValue(undefined),
    startDragging: vi.fn().mockResolvedValue(undefined),
  })),
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
  PhysicalSize: vi.fn(),
  PhysicalPosition: vi.fn(),
}));

browserMocks.getCurrentWebviewWindow.mockImplementation(() => browserMocks.mainWebviewWindow);
browserMocks.getWebviewWindowByLabel.mockImplementation(async (label: string) => (
  label === 'dock' ? browserMocks.dockWebviewWindow : browserMocks.mainWebviewWindow
));

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
  WebviewWindow: {
    getByLabel: browserMocks.getWebviewWindowByLabel,
  },
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
  vi.restoreAllMocks();
});
