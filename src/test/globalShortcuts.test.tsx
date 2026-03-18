import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';
import { useGlobalShortcut } from '../input/GlobalShortcuts';

describe('useGlobalShortcut', () => {
  let previousTauriValue: unknown;

  beforeEach(() => {
    previousTauriValue = (window as Window & { __TAURI__?: unknown }).__TAURI__;
    delete (window as Window & { __TAURI__?: unknown }).__TAURI__;
  });

  afterEach(() => {
    if (previousTauriValue === undefined) {
      delete (window as Window & { __TAURI__?: unknown }).__TAURI__;
    } else {
      (window as Window & { __TAURI__?: unknown }).__TAURI__ = previousTauriValue;
    }
  });

  it('does not register an event listener when disabled', () => {
    (window as Window & { __TAURI__?: unknown }).__TAURI__ = {};
    const callback = vi.fn();

    renderHook(() => useGlobalShortcut('Ctrl+Space', callback, false));

    expect(vi.mocked(listen)).not.toHaveBeenCalled();
  });

  it('does not register an event listener outside tauri runtime', () => {
    const callback = vi.fn();

    renderHook(() => useGlobalShortcut('Ctrl+Space', callback, true));

    expect(vi.mocked(listen)).not.toHaveBeenCalled();
  });

  it('listens for overlay toggle events, invokes callback, and unsubscribes on unmount', async () => {
    const callback = vi.fn();
    const unlisten = vi.fn();
    let eventHandler: (() => void) | undefined;

    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      eventHandler = handler as () => void;
      return unlisten;
    });
    (window as Window & { __TAURI__?: unknown }).__TAURI__ = {};

    const { unmount } = renderHook(() => useGlobalShortcut('Ctrl+Space', callback, true));

    await waitFor(() => {
      expect(vi.mocked(listen)).toHaveBeenCalledWith('overlay://toggle-request', expect.any(Function));
    });

    eventHandler?.();
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('logs a warning when listener registration fails', async () => {
    vi.mocked(listen).mockRejectedValueOnce(new Error('failed to listen'));
    (window as Window & { __TAURI__?: unknown }).__TAURI__ = {};

    renderHook(() => useGlobalShortcut('Ctrl+Space', vi.fn(), true));

    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to listen for overlay toggle event:',
        expect.any(Error),
      );
    });
  });
});
