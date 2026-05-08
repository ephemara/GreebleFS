import {
  isNativeControlAvailable,
  nativeCall,
  nativeControlCapabilities,
  type NativeControlCapabilities
} from '@tauri-apps/api/native-control'

export type GreebleNativeControlCapabilities = NativeControlCapabilities

export interface GreebleNativeCallOptions {
  correlationId?: string
}

export function isGreebleNativeControlAvailable(): boolean {
  return isNativeControlAvailable()
}

export async function getGreebleNativeControlCapabilities(): Promise<GreebleNativeControlCapabilities> {
  return nativeControlCapabilities()
}

export async function callGreebleNative<TResult = unknown, TArgs = unknown>(
  namespace: string,
  method: string,
  args?: TArgs,
  options: GreebleNativeCallOptions = {}
): Promise<TResult> {
  return nativeCall<TResult, TArgs>(namespace, method, args, options)
}

export async function pingGreebleNative<TArgs = unknown>(args?: TArgs): Promise<unknown> {
  return callGreebleNative('system', 'ping', args)
}
