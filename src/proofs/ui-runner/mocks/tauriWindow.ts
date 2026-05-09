export class PhysicalPosition {
  constructor(public x: number, public y: number) {}
}

export class PhysicalSize {
  constructor(public width: number, public height: number) {}
}

export const currentMonitor = async () => ({
  name: "Tauron UI Runner",
  position: { x: 0, y: 0 },
  size: { width: 1440, height: 920 },
  scaleFactor: 1,
  workArea: {
    position: { x: 0, y: 0 },
    size: { width: 1440, height: 920 },
  },
});

export const primaryMonitor = currentMonitor;
export const availableMonitors = async () => [await currentMonitor()];

export function getCurrentWindow() {
  return {
    label: "main",
    close: async () => undefined,
    emit: async () => undefined,
    emitTo: async () => undefined,
    hide: async () => undefined,
    isMaximized: async () => false,
    isVisible: async () => true,
    is_visible: async () => true,
    listen: async () => () => undefined,
    maximize: async () => undefined,
    minimize: async () => undefined,
    onCloseRequested: async () => () => undefined,
    onDragDropEvent: async () => () => undefined,
    onMoved: async () => () => undefined,
    onResized: async () => () => undefined,
    outerPosition: async () => ({ x: 0, y: 0 }),
    outerSize: async () => ({ width: 1440, height: 920 }),
    scaleFactor: async () => 1,
    setAlwaysOnTop: async () => undefined,
    setDecorations: async () => undefined,
    setFocus: async () => undefined,
    setPosition: async () => undefined,
    setResizable: async () => undefined,
    setShadow: async () => undefined,
    setSize: async () => undefined,
    setSkipTaskbar: async () => undefined,
    setTitle: async () => undefined,
    show: async () => undefined,
    startDragging: async () => undefined,
    startResizeDragging: async () => undefined,
    unmaximize: async () => undefined,
    unminimize: async () => undefined,
  };
}
