import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTauri } from '@tauri-apps/api/core';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { useGlobalShortcut } from '../input/GlobalShortcuts';

describe('useGlobalShortcut', () => {
  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(true);
  });

  afterEach(() => {
    vi.mocked(isTauri).mockReturnValue(true);
  });

  it('does not register an event listener when disabled', () => {
    const callback = vi.fn();

    renderHook(() => useGlobalShortcut('Ctrl+Space', callback, false));

    expect(vi.mocked(register)).not.toHaveBeenCalled();
  });

  it('does not register a shortcut outside tauri runtime', () => {
    const callback = vi.fn();
    vi.mocked(isTauri).mockReturnValue(false);

    renderHook(() => useGlobalShortcut('Ctrl+Space', callback, true));

    expect(vi.mocked(register)).not.toHaveBeenCalled();
  });

  it('registers the shortcut, invokes callback on press, and unregisters on unmount', async () => {
    const callback = vi.fn();
    let eventHandler: ((event: { state: 'Pressed' | 'Released'; shortcut: string; id: number }) => void) | undefined;

    vi.mocked(register).mockImplementation(async (_shortcut, handler) => {
      eventHandler = handler;
    });

    const { unmount } = renderHook(() => useGlobalShortcut('Ctrl+Space', callback, true));

    await waitFor(() => {
      expect(vi.mocked(register)).toHaveBeenCalledWith('Ctrl+Space', expect.any(Function));
    });

    eventHandler?.({ state: 'Released', shortcut: 'Ctrl+Space', id: 1 });
    expect(callback).not.toHaveBeenCalled();

    eventHandler?.({ state: 'Pressed', shortcut: 'Ctrl+Space', id: 1 });
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();
    await waitFor(() => {
      expect(vi.mocked(unregister)).toHaveBeenCalledWith('Ctrl+Space');
    });
  });

  it('logs a warning when shortcut registration fails', async () => {
    vi.mocked(register).mockRejectedValueOnce(new Error('failed to register'));

    renderHook(() => useGlobalShortcut('Ctrl+Space', vi.fn(), true));

    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to register global shortcut "Ctrl+Space":',
        expect.any(Error),
      );
    });
  });

  it('keeps the registration stable while invoking the latest callback after rerenders', async () => {
    let eventHandler: ((event: { state: 'Pressed' | 'Released'; shortcut: string; id: number }) => void) | undefined;
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    vi.mocked(register).mockImplementation(async (_shortcut, handler) => {
      eventHandler = handler;
    });

    const { rerender } = renderHook(
      ({ callback }) => useGlobalShortcut('Ctrl+Space', callback, true),
      { initialProps: { callback: firstCallback } },
    );

    await waitFor(() => {
      expect(vi.mocked(register).mock.calls.length).toBeGreaterThan(0);
    });
    const registerCountBeforeRerender = vi.mocked(register).mock.calls.length;

    rerender({ callback: secondCallback });

    eventHandler?.({ state: 'Pressed', shortcut: 'Ctrl+Space', id: 1 });
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
    expect(vi.mocked(register).mock.calls.length).toBe(registerCountBeforeRerender);
  });
});
