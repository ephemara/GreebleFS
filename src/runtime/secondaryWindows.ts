import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type {
  SecondaryWindowDescriptor,
  SecondaryWindowDockTarget,
  SecondaryWindowDragSessionRequest,
  SecondaryWindowOpenRequest,
  SecondaryWindowPresentation,
  SecondaryWindowSize,
  SecondaryWindowSurfaceKind,
} from '../generated/tauri';
export type {
  SecondaryWindowDescriptor,
  SecondaryWindowDockTarget,
  SecondaryWindowDragSessionRequest,
  SecondaryWindowOpenRequest,
  SecondaryWindowPresentation,
  SecondaryWindowSize,
  SecondaryWindowSurfaceKind,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export const SECONDARY_WINDOW_DESCRIPTOR_EVENT = 'greeblefs:secondary-window:descriptor';
export const SECONDARY_WINDOW_CLOSED_EVENT = 'greeblefs:secondary-window:closed';
export const SECONDARY_WINDOW_DOCK_BACK_EVENT = 'greeblefs:secondary-window:dock-back';
export const EXPLORER_PICKER_SECONDARY_WINDOW_ID = 'explorer-picker';
export const FILE_OPERATIONS_SECONDARY_WINDOW_ID = 'file-operations';

export interface SecondaryWindowClosedEventDetail {
  windowId: string;
  windowLabel: string;
  descriptor: SecondaryWindowDescriptor;
}

export interface SecondaryWindowDockBackEventDetail {
  windowId: string;
  windowLabel: string;
  dockTarget: SecondaryWindowDockTarget;
  descriptor: SecondaryWindowDescriptor;
}

export async function openSecondaryWindow(
  request: SecondaryWindowOpenRequest,
): Promise<SecondaryWindowDescriptor> {
  return unwrapTauriResult(await commands.secondaryWindowOpen(request));
}

export async function focusSecondaryWindow(windowId: string): Promise<void> {
  unwrapTauriResult(await commands.secondaryWindowFocus(windowId));
}

export async function closeSecondaryWindow(windowId: string): Promise<void> {
  unwrapTauriResult(await commands.secondaryWindowClose(windowId));
}

export async function dockBackSecondaryWindow(windowId: string): Promise<void> {
  unwrapTauriResult(await commands.secondaryWindowDockBack(windowId));
}

export async function beginSecondaryWindowDragSession(
  request: SecondaryWindowDragSessionRequest,
): Promise<SecondaryWindowDragSessionRequest> {
  return commands.secondaryWindowBeginDragSession(request);
}

export async function completeSecondaryWindowDragSession(
  windowId: string,
): Promise<SecondaryWindowDragSessionRequest | null> {
  return commands.secondaryWindowCompleteDragSession(windowId);
}

export async function getCurrentSecondaryWindowDescriptor(): Promise<SecondaryWindowDescriptor | null> {
  if (!isTauri()) {
    return null;
  }

  try {
    return await commands.secondaryWindowGetCurrentDescriptor();
  } catch {
    return null;
  }
}

export function createWorkbenchSurfaceSecondaryWindowId(surfaceId: string): string {
  const trimmedSurfaceId = surfaceId.trim();
  return trimmedSurfaceId ? `workbench-surface-${trimmedSurfaceId}` : 'workbench-surface';
}

export function serializeSecondaryWindowPayload(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function parseSecondaryWindowPayload<TValue>(payloadJson: string | null | undefined): TValue | null {
  if (!payloadJson) {
    return null;
  }

  try {
    return JSON.parse(payloadJson) as TValue;
  } catch {
    return null;
  }
}

export function createSecondaryWindowOpenRequest(args: {
  windowId: string;
  surfaceKind: SecondaryWindowSurfaceKind;
  presentation: SecondaryWindowPresentation;
  title: string;
  initialSize?: SecondaryWindowSize | null;
  minSize?: SecondaryWindowSize | null;
  dockTarget?: SecondaryWindowDockTarget | null;
  payload?: unknown;
}): SecondaryWindowOpenRequest {
  return {
    windowId: args.windowId,
    surfaceKind: args.surfaceKind,
    presentation: args.presentation,
    title: args.title,
    initialSize: args.initialSize ?? null,
    minSize: args.minSize ?? null,
    sourceWindowLabel: getCurrentSecondaryWindowSourceLabel(),
    dockTarget: args.dockTarget ?? null,
    payloadJson: serializeSecondaryWindowPayload(args.payload),
  };
}

export function listenToSecondaryWindowDescriptorUpdates(
  listener: (descriptor: SecondaryWindowDescriptor) => void,
): () => void {
  return registerSecondaryWindowListener(SECONDARY_WINDOW_DESCRIPTOR_EVENT, listener);
}

export function listenToSecondaryWindowClosed(
  listener: (detail: SecondaryWindowClosedEventDetail) => void,
): () => void {
  return registerSecondaryWindowListener(SECONDARY_WINDOW_CLOSED_EVENT, listener);
}

export function listenToSecondaryWindowDockBack(
  listener: (detail: SecondaryWindowDockBackEventDetail) => void,
): () => void {
  return registerSecondaryWindowListener(SECONDARY_WINDOW_DOCK_BACK_EVENT, listener);
}

function registerSecondaryWindowListener<TDetail>(
  eventName: string,
  listener: (detail: TDetail) => void,
): () => void {
  const browserWindow = getBrowserWindow();
  const browserListener = (event: Event) => {
    const detail = (event as CustomEvent<TDetail>).detail;
    if (detail != null) {
      listener(detail);
    }
  };
  browserWindow?.addEventListener(eventName, browserListener);

  let isDisposed = false;
  let tauriUnlisten: (() => void) | null = null;
  if (isTauri()) {
    void listen<TDetail>(eventName, (event) => {
      listener(event.payload);
    }).then((unlisten) => {
      if (isDisposed) {
        unlisten();
        return;
      }

      tauriUnlisten = unlisten;
    }).catch(() => undefined);
  }

  return () => {
    isDisposed = true;
    browserWindow?.removeEventListener(eventName, browserListener);
    tauriUnlisten?.();
  };
}

function getCurrentSecondaryWindowSourceLabel(): string | null {
  if (!isTauri()) {
    return null;
  }

  try {
    return getCurrentWebviewWindow().label;
  } catch {
    return null;
  }
}

function getBrowserWindow(): Window | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window;
}
