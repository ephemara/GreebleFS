import { afterEach, describe, expect, it, vi } from "vitest";
import { withNativePooledBufferOnce } from "@tauri-apps/api/native-buffer-pool";

describe("Tauron native buffer pool API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "chrome");
    Reflect.deleteProperty(window, "__TAURI_NATIVE_CONTROL__");
  });

  it("decodes one shared buffer packet then releases WebView2 and native ownership", async () => {
    let sharedBufferListener: ((event: {
      additionalData: unknown;
      getBuffer(): ArrayBuffer;
    }) => void) | null = null;
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
});
