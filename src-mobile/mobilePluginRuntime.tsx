import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildMobileFileUrl,
  buildMobileThumbnailUrl,
  fetchMobileIndexPictures,
  fetchMobileSearchStatus,
  runMobilePluginBackend,
  startMobileSearchScan,
} from "./mobileApi";
import type {
  MobileIndexPicturesResponse,
  MobilePluginBackendRunResponse,
  MobilePluginPane,
  MobilePluginSummary,
  MobileSearchStatusResponse,
} from "./types";

export interface MobilePluginRuntimeContext {
  pane: MobilePluginPane;
  plugin: MobilePluginSummary | null;
  currentPath: string;
  assets: {
    resolveUrl: (relativePath: string) => string;
  };
  backend: {
    run: (
      entry: string,
      args?: string[],
    ) => Promise<MobilePluginBackendRunResponse>;
  };
  settings: {
    getValues: () => Record<string, unknown>;
    getValue: <TValue = unknown>(
      settingId: string,
      fallbackValue?: TValue,
    ) => TValue | null;
  };
  files: {
    buildFileUrl: (relativePath: string) => string;
    buildThumbnailUrl: (
      relativePath: string,
      width?: number,
      height?: number,
    ) => string;
    openPath: (relativePath: string) => void;
    openPreview: (relativePath: string) => Promise<void>;
  };
  index: {
    global: {
      getStatus: () => Promise<MobileSearchStatusResponse>;
      startScan: () => Promise<void>;
    };
    media: {
      findPictures: (options?: {
        query?: string | null;
        limit?: number;
        offset?: number;
        rootPaths?: string[];
        extensions?: string[];
        showHiddenFiles?: boolean;
      }) => Promise<MobileIndexPicturesResponse>;
    };
  };
}

export interface MobilePluginRuntimeInstance {
  update?: (context: MobilePluginRuntimeContext) => void;
  dispose?: () => void;
}

type MobilePluginRuntimeCleanup = void | (() => void) | MobilePluginRuntimeInstance;
type MobilePluginRuntimeMount = (
  container: HTMLElement,
  context: MobilePluginRuntimeContext,
) => MobilePluginRuntimeCleanup | Promise<MobilePluginRuntimeCleanup>;

interface MobilePluginRuntimeModule {
  default?: MobilePluginRuntimeMount | { mount?: MobilePluginRuntimeMount };
  mount?: MobilePluginRuntimeMount;
}

declare global {
  interface Window {
    __GREEBLEFS_MOBILE_PLUGIN_MODULES__?: Record<string, MobilePluginRuntimeModule>;
  }
}

export interface MobilePluginRuntimeSurfaceProps {
  pane: MobilePluginPane;
  plugin: MobilePluginSummary | null;
  currentPath: string;
  onOpenPath: (relativePath: string) => void;
  onOpenPreview: (relativePath: string) => Promise<void>;
}

function resolvePluginAssetUrl(
  pane: MobilePluginPane,
  plugin: MobilePluginSummary | null,
  relativePath: string,
): string {
  const cleaned = relativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const prefix = plugin?.rootAccess.assetRoutePrefix
    || `/api/plugins/${encodeURIComponent(pane.pluginId)}/assets`;
  return cleaned ? `${prefix}/${cleaned}` : prefix;
}

async function loadMobilePluginRuntimeModule(
  rendererUrl: string,
): Promise<MobilePluginRuntimeModule> {
  const registered = window.__GREEBLEFS_MOBILE_PLUGIN_MODULES__?.[rendererUrl];
  if (registered) {
    return registered;
  }
  return import(/* @vite-ignore */ rendererUrl) as Promise<MobilePluginRuntimeModule>;
}

function resolveRuntimeMount(
  runtimeModule: MobilePluginRuntimeModule,
): MobilePluginRuntimeMount | null {
  if (typeof runtimeModule.mount === "function") {
    return runtimeModule.mount;
  }
  if (typeof runtimeModule.default === "function") {
    return runtimeModule.default;
  }
  if (
    runtimeModule.default &&
    typeof runtimeModule.default === "object" &&
    typeof runtimeModule.default.mount === "function"
  ) {
    return runtimeModule.default.mount;
  }
  return null;
}

function normalizeRuntimeCleanup(
  cleanup: MobilePluginRuntimeCleanup,
): MobilePluginRuntimeInstance {
  if (typeof cleanup === "function") {
    return { dispose: cleanup };
  }
  if (cleanup && typeof cleanup === "object") {
    return cleanup;
  }
  return {};
}

export function MobilePluginRuntimeSurface({
  pane,
  plugin,
  currentPath,
  onOpenPath,
  onOpenPreview,
}: MobilePluginRuntimeSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runtimeInstanceRef = useRef<MobilePluginRuntimeInstance | null>(null);
  const runtimeContextRef = useRef<MobilePluginRuntimeContext | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<{
    phase: "loading" | "ready" | "error";
    message: string;
  }>({
    phase: "loading",
    message: "Loading mobile plugin runtime.",
  });

  const runtimeContext = useMemo<MobilePluginRuntimeContext>(() => ({
    pane,
    plugin,
    currentPath,
    assets: {
      resolveUrl: (relativePath) => resolvePluginAssetUrl(pane, plugin, relativePath),
    },
    backend: {
      run: (entry, args = []) => runMobilePluginBackend(pane.pluginId, {
        entry,
        args,
        contextPath: currentPath,
        paneId: pane.localId,
      }),
    },
    settings: {
      getValues: () => plugin?.settingsValues ?? {},
      getValue: <TValue = unknown>(settingId: string, fallbackValue?: TValue) => {
        const normalizedSettingId = settingId.trim();
        const values = plugin?.settingsValues ?? {};
        return normalizedSettingId
          && Object.prototype.hasOwnProperty.call(values, normalizedSettingId)
          ? (values[normalizedSettingId] as TValue)
          : (fallbackValue ?? null);
      },
    },
    files: {
      buildFileUrl: buildMobileFileUrl,
      buildThumbnailUrl: buildMobileThumbnailUrl,
      openPath: onOpenPath,
      openPreview: onOpenPreview,
    },
    index: {
      global: {
        getStatus: fetchMobileSearchStatus,
        startScan: startMobileSearchScan,
      },
      media: {
        findPictures: fetchMobileIndexPictures,
      },
    },
  }), [currentPath, onOpenPath, onOpenPreview, pane, plugin]);
  const styleUrlSignature = pane.styleUrls.join("|");

  useEffect(() => {
    runtimeContextRef.current = runtimeContext;
    runtimeInstanceRef.current?.update?.(runtimeContext);
  }, [runtimeContext]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pane.rendererUrl) {
      return;
    }
    const mountContainer = container;

    let disposed = false;
    const styleLinks = pane.styleUrls.map((styleUrl) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = styleUrl;
      link.dataset.mobilePluginStyle = pane.id;
      document.head.appendChild(link);
      return link;
    });

    async function mountRuntime() {
      setRuntimeStatus({
        phase: "loading",
        message: "Loading mobile plugin runtime.",
      });
      mountContainer.innerHTML = "";
      runtimeInstanceRef.current?.dispose?.();
      runtimeInstanceRef.current = null;

      try {
        const runtimeModule = await loadMobilePluginRuntimeModule(pane.rendererUrl);
        if (disposed) {
          return;
        }
        const mount = resolveRuntimeMount(runtimeModule);
        if (!mount) {
          throw new Error("Mobile plugin renderer does not export mount(container, api).");
        }
        const cleanup = await mount(mountContainer, runtimeContextRef.current ?? runtimeContext);
        if (disposed) {
          normalizeRuntimeCleanup(cleanup).dispose?.();
          return;
        }
        runtimeInstanceRef.current = normalizeRuntimeCleanup(cleanup);
        setRuntimeStatus({
          phase: "ready",
          message: "",
        });
      } catch (error) {
        if (disposed) {
          return;
        }
        setRuntimeStatus({
          phase: "error",
          message: error instanceof Error ? error.message : "Mobile plugin renderer failed.",
        });
      }
    }

    void mountRuntime();

    return () => {
      disposed = true;
      runtimeInstanceRef.current?.dispose?.();
      runtimeInstanceRef.current = null;
      container.innerHTML = "";
      styleLinks.forEach((link) => link.remove());
    };
  }, [pane.id, pane.rendererUrl, styleUrlSignature]);

  return (
    <article className="mobile-plugin-runtime-card">
      {runtimeStatus.phase !== "ready" ? (
        <div className={`mobile-plugin-runtime-status mobile-plugin-runtime-status--${runtimeStatus.phase}`}>
          {runtimeStatus.message}
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="mobile-plugin-runtime-host"
        data-mobile-plugin-id={pane.pluginId}
        data-mobile-plugin-pane-id={pane.localId}
      />
    </article>
  );
}
