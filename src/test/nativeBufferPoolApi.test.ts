import { afterEach, describe, expect, it, vi } from "vitest";
import { withNativePooledBufferOnce } from "@tauri-apps/api/native-buffer-pool";

type TestSharedBufferEvent = {
  additionalData: unknown;
  getBuffer(): ArrayBuffer;
};

type TestSharedBufferListener = (event: TestSharedBufferEvent) => void;

describe("Tauron native buffer pool API", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "chrome");
    Reflect.deleteProperty(window, "__TAURI_NATIVE_CONTROL__");
  });

  it("decodes one shared buffer packet then releases WebView2 and native ownership", async () => {
    let sharedBufferListener: TestSharedBufferListener | null = null;
    const releaseBuffer = vi.fn();
    const controlCall = vi.fn(async (request: {
      namespace: string;
      method: string;
      args?: Record<string, unknown>;
    }) => {
      if (request.namespace === "nativeBufferPool") {
        return { released: 1, errors: [] };
      }

      const buffer = new Uint8Array([7, 8, 9]).buffer;
      queueMicrotask(() => {
        sharedBufferListener?.({
          additionalData: {
            tauronNativePooledBuffer: true,
            streamId: request.args?.streamId,
            sequence: 0,
            byteLength: 3,
            buffer: {
              id: 11,
              generation: 2,
              sizeClass: 4096,
              byteLength: 3,
            },
          },
          getBuffer: () => buffer,
        });
      });
      return { scheduled: true };
    });

    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        webview: {
          addEventListener: vi.fn((_event, listener) => {
            sharedBufferListener = listener;
          }),
          removeEventListener: vi.fn(() => {
            sharedBufferListener = null;
          }),
          releaseBuffer,
        },
      },
    });
    Object.defineProperty(window, "__TAURI_NATIVE_CONTROL__", {
      configurable: true,
      value: {
        available: true,
        call: controlCall,
      },
    });

    const result = await withNativePooledBufferOnce({
      namespace: "explorer",
      method: "readPreviewBytes",
      args: { path: "D:/demo/a.bin" },
      decode: (bytes) => [...bytes],
    });

    expect(result).toEqual([7, 8, 9]);
    expect(releaseBuffer).toHaveBeenCalledTimes(1);
    expect(controlCall).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "nativeBufferPool",
        method: "releaseBatch",
        args: {
          buffers: [{ id: 11, generation: 2, sizeClass: 4096, byteLength: 3 }],
        },
      }),
    );
  });

  it("keeps a late release listener after timeout so native buffers do not leak", async () => {
    vi.useFakeTimers();
    let sharedBufferListener: TestSharedBufferListener | null = null;
    const releaseBuffer = vi.fn();
    const controlCall = vi.fn(async (request: {
      namespace: string;
      method: string;
      args?: Record<string, unknown>;
    }) => {
      if (request.namespace === "nativeBufferPool") {
        return { released: 1, errors: [] };
      }
      return { scheduled: true };
    });

    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        webview: {
          addEventListener: vi.fn((_event, listener) => {
            sharedBufferListener = listener;
          }),
          removeEventListener: vi.fn(() => {
            sharedBufferListener = null;
          }),
          releaseBuffer,
        },
      },
    });
    Object.defineProperty(window, "__TAURI_NATIVE_CONTROL__", {
      configurable: true,
      value: {
        available: true,
        call: controlCall,
      },
    });

    const pending = withNativePooledBufferOnce({
      namespace: "explorer",
      method: "readPreviewBytes",
      args: { path: "D:/demo/late.bin" },
      timeoutMs: 5,
      latePacketReleaseGraceMs: 1000,
      decode: (bytes) => [...bytes],
    });

    const pendingRejection = pending.catch((error) => error);
    await vi.advanceTimersByTimeAsync(5);
    expect(await pendingRejection).toEqual(
      expect.objectContaining({
        message: expect.stringMatching(
          /Timed out waiting for native pooled buffer/,
        ),
      }),
    );
    expect(sharedBufferListener).not.toBeNull();

    const buffer = new Uint8Array([1, 2, 3]).buffer;
    const lateSharedBufferListener: TestSharedBufferListener =
      sharedBufferListener ??
      (() => {
        throw new Error("Late shared-buffer listener was not retained");
      });
    lateSharedBufferListener({
      additionalData: {
        tauronNativePooledBuffer: true,
        streamId: controlCall.mock.calls[0]?.[0].args?.streamId,
        sequence: 0,
        byteLength: 3,
        buffer: {
          id: 21,
          generation: 4,
          sizeClass: 4096,
          byteLength: 3,
        },
      },
      getBuffer: () => buffer,
    });
    await vi.runAllTimersAsync();

    expect(releaseBuffer).toHaveBeenCalledTimes(1);
    expect(controlCall).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "nativeBufferPool",
        method: "releaseBatch",
        args: {
          buffers: [{ id: 21, generation: 4, sizeClass: 4096, byteLength: 3 }],
        },
      }),
    );
    expect(sharedBufferListener).toBeNull();
  });
});
