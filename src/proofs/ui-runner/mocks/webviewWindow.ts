function createWindow(label: string) {
  return {
    label,
    close: async () => undefined,
    emit: async () => undefined,
    hide: async () => undefined,
    listen: async () => () => undefined,
    once: async (_event: string, handler?: () => void | Promise<void>) => {
      await handler?.();
      return () => undefined;
    },
    setFocus: async () => undefined,
    show: async () => undefined,
  };
}

export function getCurrentWebviewWindow() {
  return createWindow("main");
}

export class WebviewWindow {
  static async getByLabel(label: string) {
    return createWindow(label);
  }

  constructor(label: string) {
    return createWindow(label);
  }
}
