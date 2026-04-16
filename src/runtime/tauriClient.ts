import { invoke } from '@tauri-apps/api/core';
import * as tauriBindings from '../generated/tauri';
import type { Result } from '../generated/tauri';

export type {
  LinuxDisplayBackendPreference,
  LinuxDisplayBackendStatus,
} from '../generated/tauri';

export interface WaylandDockHostStatus {
  enabled: boolean;
  windowLabel: string | null;
}

export type WaylandDockAnchor = 'top' | 'bottom';

export const commands = {
  ...tauriBindings.commands,
  windowGetWaylandDockHostStatus: () => invoke<WaylandDockHostStatus>('window_get_wayland_dock_host_status'),
  windowApplyWaylandDockLayout: (
    anchor: WaylandDockAnchor,
    monitorName: string | null,
    width: number,
    height: number,
  ) => invoke<Result<null, string>>('window_apply_wayland_dock_layout', {
    anchor,
    monitorName,
    width,
    height,
  }),
};
export const events = tauriBindings.events;

export function unwrapTauriResult<T>(result: Result<T, string>): T {
  if (result.status === 'ok') {
    return result.data;
  }

  throw new Error(result.error);
}
