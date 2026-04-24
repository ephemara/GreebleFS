import type {
  AccelerationRuntimeRequest,
  AccelerationRuntimeStatusSnapshot,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type ManagedAccelerationRuntimeRequest = AccelerationRuntimeRequest;
export type ManagedAccelerationRuntimeStatusSnapshot = AccelerationRuntimeStatusSnapshot;

function isAccelerationRuntimeStatusSnapshot(
  value: unknown,
): value is ManagedAccelerationRuntimeStatusSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ManagedAccelerationRuntimeStatusSnapshot>;
  return Array.isArray(candidate.providers)
    && candidate.nativeGpu != null
    && typeof candidate.nativeGpu === 'object'
    && typeof candidate.routingMode === 'string'
    && typeof candidate.pythonProbeAttempted === 'boolean';
}

export async function getAccelerationRuntimeStatus(
  request: ManagedAccelerationRuntimeRequest,
): Promise<ManagedAccelerationRuntimeStatusSnapshot> {
  const snapshot = unwrapTauriResult(await commands.accelerationRuntimeGetStatus(request));
  if (!isAccelerationRuntimeStatusSnapshot(snapshot)) {
    throw new Error('Acceleration runtime returned an invalid status snapshot.');
  }

  return snapshot;
}
