import * as tauriBindings from '../generated/tauri';
import type { Result } from '../generated/tauri';

export const commands = tauriBindings.commands;
export const events = tauriBindings.events;

export function unwrapTauriResult<T>(result: Result<T, string>): T {
  if (result.status === 'ok') {
    return result.data;
  }

  throw new Error(result.error);
}
