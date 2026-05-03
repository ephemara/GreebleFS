export type UnlistenCallback = () => void;

export interface DeferredUnlistenOptions {
  onError?: (error: unknown) => void;
}

function reportDeferredUnlistenError(
  error: unknown,
  options: DeferredUnlistenOptions,
): void {
  options.onError?.(error);
}

export function bindDeferredUnlisten(
  unlistenPromise: Promise<UnlistenCallback>,
  options: DeferredUnlistenOptions = {},
): UnlistenCallback {
  let disposed = false;
  let resolvedUnlisten: UnlistenCallback | null = null;

  void unlistenPromise
    .then((unlisten) => {
      if (disposed) {
        try {
          unlisten();
        } catch (error) {
          reportDeferredUnlistenError(error, options);
        }
        return;
      }

      resolvedUnlisten = unlisten;
    })
    .catch((error) => {
      if (!disposed) {
        reportDeferredUnlistenError(error, options);
      }
    });

  return () => {
    disposed = true;
    const unlisten = resolvedUnlisten;
    resolvedUnlisten = null;
    if (!unlisten) {
      return;
    }

    try {
      unlisten();
    } catch (error) {
      reportDeferredUnlistenError(error, options);
    }
  };
}
