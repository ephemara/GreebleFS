import { describe, expect, it, vi } from 'vitest';
import {
  dispatchTerminalCommand,
  resolvePluginCommandTemplate,
} from '../config/pluginContributions';

describe('plugin contribution helpers', () => {
  it('resolves explorer command templates against the selected entry context', () => {
    const resolved = resolvePluginCommandTemplate('echo {pluginName}:{name}:{path}:{kind}', {
      path: 'C:/lab/file.txt',
      name: 'file.txt',
      parent: 'C:/lab',
      extension: 'txt',
      stem: 'file',
      isDirectory: false,
      pluginId: 'mega-plugin',
      pluginName: 'Mega Plugin',
    });

    expect(resolved).toBe('echo Mega Plugin:file.txt:C:/lab/file.txt:file');
  });

  it('dispatches terminal command injection events', () => {
    const handler = vi.fn();
    window.addEventListener('overlayterm:cmdinject', handler);

    dispatchTerminalCommand('npm run build', true);

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<{ command: string; run?: boolean }>;
    expect(event.detail).toEqual({ command: 'npm run build', run: true });

    window.removeEventListener('overlayterm:cmdinject', handler);
  });
});
