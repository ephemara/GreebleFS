import type {
  GpuRuntimeStatusEvent,
  GpuRuntimeStatusSnapshot,
  GpuTierMode,
} from '../generated/tauri';
import { commands, events, unwrapTauriResult } from './tauriClient';

export type NativeGpuTierMode = GpuTierMode;
export type NativeGpuRuntimeStatusSnapshot = GpuRuntimeStatusSnapshot;
export type NativeGpuRuntimeStatusEvent = GpuRuntimeStatusEvent;

export async function configureGpuRuntime(
  tierOverride: NativeGpuTierMode,
): Promise<NativeGpuRuntimeStatusSnapshot> {
  return unwrapTauriResult(await commands.gpuRuntimeConfigure({ tierOverride }));
}

export async function getGpuRuntimeStatus(): Promise<NativeGpuRuntimeStatusSnapshot> {
  return unwrapTauriResult(await commands.gpuRuntimeGetStatus());
}

export async function listenToGpuRuntimeStatus(
  listener: (event: NativeGpuRuntimeStatusEvent) => void,
): Promise<() => void> {
  return events.gpuRuntimeStatusEvent.listen(
    (event: { payload: NativeGpuRuntimeStatusEvent }) => listener(event.payload),
  );
}
