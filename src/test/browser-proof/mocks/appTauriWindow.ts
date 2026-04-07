const monitor = {
  name: 'Primary Display',
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  scaleFactor: 1,
  workArea: {
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
  },
};

const currentWindow = {
  scaleFactor: async () => 1,
  setSize: async () => undefined,
  setPosition: async () => undefined,
  setDecorations: async () => undefined,
  setAlwaysOnTop: async () => undefined,
  setResizable: async () => undefined,
  setShadow: async () => undefined,
  setSkipTaskbar: async () => undefined,
  show: async () => undefined,
  setFocus: async () => undefined,
  hide: async () => undefined,
  maximize: async () => undefined,
  unmaximize: async () => undefined,
  minimize: async () => undefined,
  unminimize: async () => undefined,
  isMaximized: async () => false,
  isVisible: async () => true,
  outerPosition: async () => ({ x: 0, y: 0 }),
  outerSize: async () => ({ width: 1280, height: 720 }),
  onDragDropEvent: async () => () => {},
  onResized: async () => () => {},
  onMoved: async () => () => {},
  onCloseRequested: async () => () => {},
  is_visible: async () => true,
  startResizeDragging: async () => undefined,
  startDragging: async () => undefined,
};

export async function availableMonitors() {
  return [monitor];
}

export async function currentMonitor() {
  return monitor;
}

export function getCurrentWindow() {
  return currentWindow;
}

export async function primaryMonitor() {
  return monitor;
}

export class PhysicalSize {}

export class PhysicalPosition {}
