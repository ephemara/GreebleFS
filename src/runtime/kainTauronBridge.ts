import {
  call,
  dispatch,
  manifest,
  reflection,
  reload,
  status,
  type KainBridgeRequest,
  type KainBridgeStatus,
  type KainReloadOptions,
  type KainReloadResult,
} from '@tauri-apps/api/kain';

export type KainTauronBridgeStatus = KainBridgeStatus
export type KainTauronBridgeRequest<Args = unknown> = KainBridgeRequest<Args>

export interface KainTauronBridgeProbe {
  available: boolean
  status: KainBridgeStatus | null
  error: string | null
}

export async function probeKainTauronBridge(): Promise<KainTauronBridgeProbe> {
  try {
    return {
      available: true,
      status: await status(),
      error: null,
    }
  } catch (error) {
    return {
      available: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function getKainTauronBridgeManifest<T = unknown>(): Promise<T> {
  return manifest<T>()
}

export async function getKainTauronBridgeReflection<T = unknown>(): Promise<T> {
  return reflection<T>()
}

export async function dispatchKainTauronBridgeRequest<
  T = unknown,
  Args = unknown,
>(request: KainBridgeRequest<Args>): Promise<T> {
  return dispatch<T, Args>(request)
}

export async function callKainTauronBridge<T = unknown, Args = unknown>(
  namespace: string,
  method: string,
  args?: Args,
  correlationId?: string,
): Promise<T> {
  return call<T, Args>(namespace, method, args, correlationId)
}

export async function reloadKainTauronBridge(
  options?: KainReloadOptions,
): Promise<KainReloadResult> {
  return reload(options)
}
