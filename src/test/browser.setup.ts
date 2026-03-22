import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
  isTauri: vi.fn(() => true),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    scaleFactor: vi.fn().mockResolvedValue(1),
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
    onResized: vi.fn().mockResolvedValue(() => {}),
    is_visible: vi.fn().mockResolvedValue(false),
    startResizeDragging: vi.fn().mockResolvedValue(undefined),
  })),
  primaryMonitor: vi.fn().mockResolvedValue({
    workArea: {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
    },
  }),
  PhysicalSize: vi.fn(),
  PhysicalPosition: vi.fn(),
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
