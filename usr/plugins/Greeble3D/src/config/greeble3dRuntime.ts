import manifest from '../../Greeble3D.manifest.json'

type Greeble3DManifest = typeof manifest

const env = import.meta.env

const readOptionalBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback
  }

  return value === 'true'
}

export const greeble3dRuntimeConfig: Greeble3DManifest = {
  ...manifest,
  storage: {
    ...manifest.storage,
    layoutAutoSaveId: env.VITE_GREEBLE3D_LAYOUT_ID ?? manifest.storage.layoutAutoSaveId,
    sketchfabTokenKey: env.VITE_GREEBLE3D_SKETCHFAB_TOKEN_KEY ?? manifest.storage.sketchfabTokenKey,
  },
  runtime: {
    ...manifest.runtime,
    defaultTitle: env.VITE_GREEBLE3D_TITLE ?? manifest.runtime.defaultTitle,
    exitHref: env.VITE_GREEBLE3D_EXIT_HREF ?? manifest.runtime.exitHref,
    showExitButton: readOptionalBoolean(env.VITE_GREEBLE3D_SHOW_EXIT, manifest.runtime.showExitButton),
  },
  integrations: {
    ...manifest.integrations,
    sketchfab: {
      ...manifest.integrations.sketchfab,
      apiBaseUrl: env.VITE_GREEBLE3D_SKETCHFAB_API_BASE ?? manifest.integrations.sketchfab.apiBaseUrl,
    },
    wasm: {
      ...manifest.integrations.wasm,
      globalKey: env.VITE_GREEBLE3D_WASM_GLOBAL_KEY ?? manifest.integrations.wasm.globalKey,
      readyEventName: env.VITE_GREEBLE3D_WASM_READY_EVENT ?? manifest.integrations.wasm.readyEventName,
    },
  },
}

export const getGreeble3DWasmGlobalKey = () => greeble3dRuntimeConfig.integrations.wasm.globalKey

export const getGreeble3DWasmReadyEventName = () => greeble3dRuntimeConfig.integrations.wasm.readyEventName

export const getGreeble3DWasmFromWindow = () => {
  const dynamicWindow = window as unknown as Record<string, unknown>
  const globalKey = getGreeble3DWasmGlobalKey()
  return (dynamicWindow[globalKey] as any) ?? null
}
