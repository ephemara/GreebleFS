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
  show: async () => undefined,
  setFocus: async () => undefined,
  hide: async () => undefined,
  outerPosition: async () => ({ x: 0, y: 0 }),
  outerSize: async () => ({ width: 1000, height: 500 }),
  onDragDropEvent: async () => () => {},
  onResized: async () => () => {},
  onMoved: async () => () => {},
  is_visible: async () => false,
  startResizeDragging: async () => undefined,
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
