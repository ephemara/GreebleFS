import { commands, events, type Result } from '../generated/tauri';

export { commands, events };

export function unwrapTauriResult<T>(result: Result<T, string>): T {
  if (result.status === 'ok') {
    return result.data;
  }

  throw new Error(result.error);
}
