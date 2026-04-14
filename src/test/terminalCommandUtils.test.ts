import { describe, expect, it } from 'vitest';
import { buildTerminalCdCommand } from '../components/terminalCommandUtils';

describe('buildTerminalCdCommand', () => {
  it('uses a PowerShell literal path for PowerShell shells', () => {
    expect(buildTerminalCdCommand("C:\\Dev\\Taloor's Lab", 'pwsh.exe')).toBe(
      "Set-Location -LiteralPath 'C:\\Dev\\Taloor'\"'\"'s Lab'",
    );
  });

  it('uses cmd /d for cmd shells', () => {
    expect(buildTerminalCdCommand('C:\\Work\\OverlayTerm', 'cmd.exe')).toBe(
      'cd /d "C:\\Work\\OverlayTerm"',
    );
  });

  it('uses shell-safe cd syntax for unix shells', () => {
    expect(buildTerminalCdCommand("/home/taloor/overlay's", '/bin/bash')).toBe(
      "cd -- '/home/taloor/overlay'\"'\"'s'",
    );
  });
});
