import { callGreebleNative, isGreebleNativeControlAvailable } from './nativeControl';

export interface NativeSurfaceTelemetry {
  available: boolean;
  running: boolean;
  visualHostingMode: string;
  compositionControllerReady: boolean;
  wgpuSurfaceReady: boolean;
  adapterName: string | null;
  backend: string | null;
  surfaceFormat: string | null;
  windowLabel: string;
  width: number;
  height: number;
  framesRendered: number;
  averageFrameMs: number | null;
  lastError: string | null;
  lastUpdatedAtUnixMs: number;
}

export interface NativeSurfaceResizeRequest {
  width: number;
  height: number;
}

const DEFAULT_NATIVE_SURFACE_TELEMETRY: NativeSurfaceTelemetry = {
  available: false,
  running: false,
  visualHostingMode: 'unavailable',
  compositionControllerReady: false,
  wgpuSurfaceReady: false,
  adapterName: null,
  backend: null,
  surfaceFormat: null,
  windowLabel: 'main',
  width: 0,
  height: 0,
  framesRendered: 0,
  averageFrameMs: null,
  lastError: 'native surface unavailable',
  lastUpdatedAtUnixMs: 0,
}

function normalizeTelemetry(
  telemetry: Partial<NativeSurfaceTelemetry> | null | undefined,
  fallbackReason = DEFAULT_NATIVE_SURFACE_TELEMETRY.lastError,
): NativeSurfaceTelemetry {
  return {
    ...DEFAULT_NATIVE_SURFACE_TELEMETRY,
    ...telemetry,
    adapterName: telemetry?.adapterName ?? null,
    backend: telemetry?.backend ?? null,
    surfaceFormat: telemetry?.surfaceFormat ?? null,
    averageFrameMs: telemetry?.averageFrameMs ?? null,
    lastError: telemetry?.lastError ?? fallbackReason ?? null,
    lastUpdatedAtUnixMs: telemetry?.lastUpdatedAtUnixMs ?? DEFAULT_NATIVE_SURFACE_TELEMETRY.lastUpdatedAtUnixMs,
  }
}

async function nativeSurfaceCall(
  method: 'create' | 'resize' | 'destroy' | 'telemetry',
  args?: NativeSurfaceResizeRequest,
): Promise<NativeSurfaceTelemetry> {
  if (!isGreebleNativeControlAvailable()) {
    return normalizeTelemetry(DEFAULT_NATIVE_SURFACE_TELEMETRY, 'native control unavailable')
  }

  try {
    const response = await callGreebleNative<Partial<NativeSurfaceTelemetry>, NativeSurfaceResizeRequest | undefined>(
      'nativeSurface',
      method,
      args,
    )
    return normalizeTelemetry(response, null)
  } catch (error) {
    return normalizeTelemetry(
      {
        ...DEFAULT_NATIVE_SURFACE_TELEMETRY,
        lastError: error instanceof Error ? error.message : String(error),
      },
      null,
    )
  }
}

export function isGreebleNativeSurfaceAvailable(): boolean {
  return isGreebleNativeControlAvailable()
}

export async function createGreebleNativeSurface(): Promise<NativeSurfaceTelemetry> {
  return nativeSurfaceCall('create')
}

export async function resizeGreebleNativeSurface(
  request: NativeSurfaceResizeRequest,
): Promise<NativeSurfaceTelemetry> {
  return nativeSurfaceCall('resize', request)
}

export async function destroyGreebleNativeSurface(): Promise<NativeSurfaceTelemetry> {
  return nativeSurfaceCall('destroy')
}

export async function getGreebleNativeSurfaceTelemetry(): Promise<NativeSurfaceTelemetry> {
  return nativeSurfaceCall('telemetry')
}
