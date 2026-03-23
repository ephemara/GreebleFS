// Vitest global setup — runs before every test file
import '@testing-library/jest-dom';

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
  getCurrentWindow: vi.fn(() => ({
    scaleFactor: vi.fn().mockResolvedValue(1),
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    outerSize: vi.fn().mockResolvedValue({ width: 1000, height: 500 }),
    onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
    onResized: vi.fn().mockResolvedValue(() => {}),
    onMoved: vi.fn().mockResolvedValue(() => {}),
    is_visible: vi.fn().mockResolvedValue(false),
    startResizeDragging: vi.fn().mockResolvedValue(undefined),
  })),
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
  vi.restoreAllMocks();
});
