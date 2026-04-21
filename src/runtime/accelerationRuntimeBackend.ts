import type {
  AccelerationRuntimeRequest,
  AccelerationRuntimeStatusSnapshot,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type ManagedAccelerationRuntimeRequest = AccelerationRuntimeRequest;
export type ManagedAccelerationRuntimeStatusSnapshot = AccelerationRuntimeStatusSnapshot;

export async function getAccelerationRuntimeStatus(
  request: ManagedAccelerationRuntimeRequest,
): Promise<ManagedAccelerationRuntimeStatusSnapshot> {
  return unwrapTauriResult(await commands.accelerationRuntimeGetStatus(request));
}
