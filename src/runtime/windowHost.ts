import { isTauri } from '@tauri-apps/api/core';
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { TerminalWindowMode } from '../store/settingsStore';

export const MAIN_WINDOW_HOST_LABEL = 'main';
export const DOCK_WINDOW_HOST_LABEL = 'dock';
export const TOGGLE_OVERLAY_REQUEST_EVENT = 'overlay://toggle-request';
export const SHOW_WINDOW_MODE_REQUEST_EVENT = 'overlay://show-window-mode-request';

export type WindowHostRole = typeof MAIN_WINDOW_HOST_LABEL | typeof DOCK_WINDOW_HOST_LABEL | 'unknown';

export function normalizeWindowHostRole(label: string | null | undefined): WindowHostRole {
  if (label === MAIN_WINDOW_HOST_LABEL || label === DOCK_WINDOW_HOST_LABEL) {
    return label;
  }

  return 'unknown';
}

export function getCurrentWindowHostRole(): WindowHostRole {
  if (!isTauri()) {
    return MAIN_WINDOW_HOST_LABEL;
  }

  try {
    return normalizeWindowHostRole(getCurrentWebviewWindow().label);
  } catch {
    return MAIN_WINDOW_HOST_LABEL;
  }
}

export function hasSeparateWaylandDockHost(args: {
  runtimePlatform: string;
  linuxDisplayServer: 'unknown' | 'wayland' | 'x11';
  waylandDockHostEnabled: boolean;
}): boolean {
  return args.runtimePlatform === 'linux'
    && args.linuxDisplayServer === 'wayland'
    && args.waylandDockHostEnabled;
}

export function shouldForceMainWindowStartupMode(args: {
  runtimePlatform: string;
  linuxDisplayServer: 'unknown' | 'wayland' | 'x11';
  useSeparateWaylandDockHost: boolean;
  windowMode: TerminalWindowMode;
  hostRole: WindowHostRole;
}): boolean {
  return args.runtimePlatform === 'linux'
    && args.linuxDisplayServer === 'wayland'
    && args.useSeparateWaylandDockHost
    && args.hostRole === MAIN_WINDOW_HOST_LABEL
    && args.windowMode === 'overlay';
}

export function resolvePresentationHostLabel(args: {
  windowMode: TerminalWindowMode;
  useSeparateWaylandDockHost: boolean;
}): typeof MAIN_WINDOW_HOST_LABEL | typeof DOCK_WINDOW_HOST_LABEL {
  if (!args.useSeparateWaylandDockHost) {
    return MAIN_WINDOW_HOST_LABEL;
  }

  return args.windowMode === 'overlay' ? DOCK_WINDOW_HOST_LABEL : MAIN_WINDOW_HOST_LABEL;
}

export function isWindowHostResponsibleForMode(args: {
  hostRole: WindowHostRole;
  windowMode: TerminalWindowMode;
  useSeparateWaylandDockHost: boolean;
}): boolean {
  return args.hostRole === resolvePresentationHostLabel({
    windowMode: args.windowMode,
    useSeparateWaylandDockHost: args.useSeparateWaylandDockHost,
  });
}

export function shouldRegisterGlobalShortcutForHost(hostRole: WindowHostRole): boolean {
  return hostRole !== DOCK_WINDOW_HOST_LABEL;
}

export async function emitWindowEventToHost<TPayload>(
  label: typeof MAIN_WINDOW_HOST_LABEL | typeof DOCK_WINDOW_HOST_LABEL,
  eventName: string,
  payload?: TPayload,
): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }

  const target = await WebviewWindow.getByLabel(label);
  if (!target) {
    return false;
  }

  await target.emit(eventName, payload);
  return true;
}
