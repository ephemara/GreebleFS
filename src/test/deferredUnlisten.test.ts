import { describe, expect, it, vi } from 'vitest';

import { bindDeferredUnlisten, type UnlistenCallback } from '../runtime/deferredUnlisten';

describe('bindDeferredUnlisten', () => {
  it('unlistens an async registration that resolves after cleanup', async () => {
    let resolveRegistration: (unlisten: UnlistenCallback) => void = () => {};
    const unlisten = vi.fn();
    const registration = new Promise<UnlistenCallback>((resolve) => {
      resolveRegistration = resolve;
    });

    const cleanup = bindDeferredUnlisten(registration);
    cleanup();
    resolveRegistration(unlisten);
    await registration;

    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('unlistens an async registration that resolved before cleanup', async () => {
    const unlisten = vi.fn();
    const registration = Promise.resolve<UnlistenCallback>(unlisten);

    const cleanup = bindDeferredUnlisten(registration);
    await registration;
    cleanup();
    cleanup();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('reports registration and unlisten errors without throwing from cleanup', async () => {
    const onError = vi.fn();
    const registrationError = new Error('registration failed');
    const unlistenError = new Error('unlisten failed');

    bindDeferredUnlisten(Promise.reject(registrationError), { onError });
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(registrationError);

    const cleanup = bindDeferredUnlisten(Promise.resolve(() => {
      throw unlistenError;
    }), { onError });
    await Promise.resolve();
    await Promise.resolve();

    expect(() => cleanup()).not.toThrow();
    expect(onError).toHaveBeenCalledWith(unlistenError);
  });
});
