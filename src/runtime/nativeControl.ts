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
  if (typeof window === 'undefined') {
    return false
  }
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

export async function callGreebleNativeWithInvokeFallback<TResult, TArgs = unknown>(
  namespace: string,
  method: string,
  args: TArgs | undefined,
  fallback: () => Promise<TResult>,
  options: GreebleNativeCallOptions = {}
): Promise<TResult> {
  if (!isGreebleNativeControlAvailable()) {
    return fallback()
  }

  try {
    return await callGreebleNative<TResult, TArgs>(namespace, method, args, options)
  } catch {
    return fallback()
  }
}

export async function pingGreebleNative<TArgs = unknown>(args?: TArgs): Promise<unknown> {
  return callGreebleNative('system', 'ping', args)
}
