// Vitest global setup — runs before every test file
import '@testing-library/jest-dom';

// Provide a resilient in-memory Storage so persistence-heavy tests work even if
// the runtime lacks a real DOM localStorage (e.g., Node with an invalid
// --localstorage-file flag).
const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(String(key), String(value));
    },
  } as Storage;
};

(() => {
  const storageLike = (candidate: unknown): candidate is Storage =>
    !!candidate &&
    typeof (candidate as Storage).getItem === 'function' &&
    typeof (candidate as Storage).setItem === 'function' &&
    typeof (candidate as Storage).removeItem === 'function' &&
    typeof (candidate as Storage).clear === 'function' &&
    typeof (candidate as Storage).key === 'function';

  // Avoid invoking Node's experimental localStorage getter, which emits a
  // warning when --localstorage-file lacks a path. Inspect the descriptor
  // instead; if it is an accessor or not storage-like, replace it with a
  // quiet in-memory implementation.
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const existingValue = descriptor?.value;
  const needsShim =
    !storageLike(existingValue) ||
    (descriptor && typeof descriptor.get === 'function'); // accessor triggers warning

  if (needsShim) {
    const memoryStorage = createMemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: memoryStorage,
      writable: true,
      configurable: true,
    });
  }
})();

// ─── Mock the entire @tauri-apps/* surface ───────────────────────────────────
// We are testing logic / rendering only. Real Tauri IPC is NOT available in
// jsdom, so every `invoke`, `listen`, etc. must be stubbed.

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
  isTauri: vi.fn(() => true),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

const createMockWebviewWindow = (label: string) => ({
  label,
  close: vi.fn().mockResolvedValue(undefined),
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => {}),
  once: vi.fn().mockImplementation(async (_event: string, handler?: () => void | Promise<void>) => {
    await handler?.();
    return () => {};
  }),
  hide: vi.fn().mockResolvedValue(undefined),
  setFocus: vi.fn().mockResolvedValue(undefined),
  show: vi.fn().mockResolvedValue(undefined),
});

const webviewWindowRegistry = new Map<string, ReturnType<typeof createMockWebviewWindow>>();

const ensureMockWebviewWindow = (label: string) => {
  const existingWindow = webviewWindowRegistry.get(label);
  if (existingWindow) {
    return existingWindow;
  }

  const nextWindow = createMockWebviewWindow(label);
  webviewWindowRegistry.set(label, nextWindow);
  return nextWindow;
};

const mainWebviewWindowMock = ensureMockWebviewWindow('main');
const dockWebviewWindowMock = ensureMockWebviewWindow('dock');

class MockWebviewWindow {
  static getByLabel = vi.fn(async (label: string) => webviewWindowRegistry.get(label) ?? null);

  constructor(label: string) {
    return ensureMockWebviewWindow(label);
  }
}

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: vi.fn(() => mainWebviewWindowMock),
  WebviewWindow: MockWebviewWindow,
}));

const currentWindowMock = {
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

function resetMockWebviewWindowRegistry() {
  webviewWindowRegistry.clear();
  webviewWindowRegistry.set('main', mainWebviewWindowMock);
  webviewWindowRegistry.set('dock', dockWebviewWindowMock);
}

vi.mock('@tauri-apps/api/window', () => ({
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
  getCurrentWindow: vi.fn(() => currentWindowMock),
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

// Monaco editor — heavy and irrelevant for unit tests
vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => (
    <pre data-testid="monaco-editor">{value}</pre>
  ),
}));

// Silence console.warn / console.error during tests (keeps output clean)
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetMockWebviewWindowRegistry();
  vi.restoreAllMocks();
});
