import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WindowMgrSessionInfo,
  WindowMgrSurfaceBounds,
} from '@tauri-apps/api/windowmgr';

const windowMgrMock = vi.hoisted(() => {
  const unlisten = vi.fn();
  const session = {
    hostWindowLabel: 'main',
    sessionId: 'greeblefs-windowmgr-notepad-proof',
    executableId: 'windows-notepad',
    backendKind: 'legacyOwnedWindow',
    pid: 42,
    hwnd: 100,
    visible: true,
    launchStatus: 'attached',
  } satisfies WindowMgrSessionInfo;

  return {
    session,
    boundsFromDomRect: vi.fn((rect: DOMRectReadOnly): WindowMgrSurfaceBounds => ({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    })),
    getCurrentWindowMgrHostLabel: vi.fn(() => 'main'),
    hideWindowMgrSession: vi.fn(async () => session),
    observeWindowMgrSurfaceBounds: vi.fn((
      _element: HTMLElement,
      onBoundsChanged: (bounds: WindowMgrSurfaceBounds) => void,
    ) => {
      onBoundsChanged({ x: 0, y: 0, width: 0, height: 0 });
      return unlisten;
    }),
    onWindowMgrSessionBoundsUpdated: vi.fn(async () => unlisten),
    onWindowMgrSessionError: vi.fn(async () => unlisten),
    onWindowMgrSessionExited: vi.fn(async () => unlisten),
    onWindowMgrSessionHidden: vi.fn(async () => unlisten),
    onWindowMgrSessionShown: vi.fn(async () => unlisten),
    onWindowMgrSessionStarted: vi.fn(async () => unlisten),
    showWindowMgrSession: vi.fn(async () => session),
    startInlineWindowMgrSession: vi.fn(async () => session),
    stopWindowMgrSession: vi.fn(async () => ({ ...session, visible: false, launchStatus: 'exited' })),
    updateWindowMgrSessionBounds: vi.fn(async () => session),
  };
});

vi.mock('@tauri-apps/api/windowmgr', () => windowMgrMock);

const windowApiMock = vi.hoisted(() => {
  const unlisten = vi.fn();
  const currentWindow = {
    label: 'main',
    innerPosition: vi.fn(async () => ({ x: 1000, y: 500 })),
    innerSize: vi.fn(async () => ({ width: 2000, height: 1000 })),
    onMoved: vi.fn(async () => unlisten),
    onResized: vi.fn(async () => unlisten),
  };

  return {
    currentWindow,
    getCurrentWindow: vi.fn(() => currentWindow),
  };
});

vi.mock('@tauri-apps/api/window', () => windowApiMock);

import { getDefaultWindowMgrProofDefinition } from '../config/windowMgrProofs';
import {
  buildGreebleWindowMgrBoundsRequest,
  nativeWindowMgrBoundsFromDomRect,
  observeGreebleWindowMgrProofBounds,
  startGreebleWindowMgrProofSession,
} from '../runtime/windowMgr';

describe('windowMgr runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 500,
    });
  });

  it('keeps the default proof data-driven and Windows gated', () => {
    const windowsProof = getDefaultWindowMgrProofDefinition('windows');

    expect(windowsProof?.id).toBe('windows-notepad');
    expect(windowsProof?.executable.executablePath).toBe('C:\\Windows\\System32\\notepad.exe');
    expect(windowsProof?.executable.backendPreference).toBe('auto');
    expect(getDefaultWindowMgrProofDefinition('linux')).toBeNull();
  });

  it('starts the inline Tauron session with the proof executable', async () => {
    const proof = getDefaultWindowMgrProofDefinition('windows');
    expect(proof).not.toBeNull();

    await startGreebleWindowMgrProofSession(proof!, 'main');

    expect(windowMgrMock.startInlineWindowMgrSession).toHaveBeenCalledWith({
      hostWindowLabel: 'main',
      sessionId: 'greeblefs-windowmgr-notepad-proof',
      executableSpec: proof!.executable,
    });
  });

  it('normalizes proof surface bounds into native desktop pixels for legacy HWND sessions', async () => {
    const proof = getDefaultWindowMgrProofDefinition('windows');
    const element = document.createElement('div');
    element.getBoundingClientRect = vi.fn(() => ({
      x: 12.4,
      y: 9.6,
      width: 0,
      height: 0,
      top: 9.6,
      left: 12.4,
      right: 12.4,
      bottom: 9.6,
      toJSON: () => ({}),
    } as DOMRect));

    const request = await buildGreebleWindowMgrBoundsRequest(
      proof!,
      element,
      'main',
      windowMgrMock.session,
    );

    expect(request.bounds).toEqual({
      x: 1025,
      y: 519,
      width: 1,
      height: 1,
    });
  });

  it('can build host-local native bounds for DirectComposition surfaces', () => {
    const rect = {
      x: 12.4,
      y: 9.6,
      width: 10,
      height: 4,
    } as DOMRectReadOnly;

    expect(nativeWindowMgrBoundsFromDomRect(rect, {
      originX: 0,
      originY: 0,
      scaleX: 2,
      scaleY: 2,
    })).toEqual({
      x: 25,
      y: 19,
      width: 20,
      height: 8,
    });
  });

  it('clamps observed resize bounds to nonzero native dimensions', async () => {
    const element = document.createElement('div');
    const observed: WindowMgrSurfaceBounds[] = [];

    observeGreebleWindowMgrProofBounds(element, bounds => observed.push(bounds));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(observed).toEqual([{ x: 1000, y: 500, width: 1, height: 1 }]);
    expect(windowApiMock.currentWindow.onMoved).toHaveBeenCalledTimes(1);
    expect(windowApiMock.currentWindow.onResized).toHaveBeenCalledTimes(1);
  });
});
