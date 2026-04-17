import { describe, expect, it } from 'vitest';
import { buildTerminalCdCommand } from '../components/terminalCommandUtils';

describe('buildTerminalCdCommand', () => {
  it('uses a PowerShell literal path for PowerShell shells', () => {
    expect(buildTerminalCdCommand("C:\\Dev\\Taloor's Lab", 'pwsh.exe')).toBe(
      "Set-Location -LiteralPath 'C:\\Dev\\Taloor'\"'\"'s Lab'",
    );
  });

  it('detects PowerShell shells even when the shell string includes arguments', () => {
    expect(buildTerminalCdCommand("C:\\Dev\\OverlayTerm", 'pwsh.exe -NoLogo')).toBe(
      "Set-Location -LiteralPath 'C:\\Dev\\OverlayTerm'",
    );
  });

  it('uses cmd /d for cmd shells', () => {
    expect(buildTerminalCdCommand('C:\\Work\\OverlayTerm', 'cmd.exe')).toBe(
      'cd /d "C:\\Work\\OverlayTerm"',
    );
  });

  it('uses shell-safe cd syntax for unix shells', () => {
    expect(buildTerminalCdCommand("/home/taloor/overlay's", '/bin/bash')).toBe(
      "builtin cd -- '/home/taloor/overlay'\"'\"'s'",
    );
  });

  it('handles quoted shell names and additional shell arguments', () => {
    expect(buildTerminalCdCommand('/workspace/repo', '"C:\\Program Files\\Git\\bin\\bash.exe" --login')).toBe(
      "builtin cd -- '/workspace/repo'",
    );
    expect(buildTerminalCdCommand('/workspace/repo', "'/opt/homebrew/bin/fish' -l")).toBe(
      "builtin cd -- '/workspace/repo'",
    );
  });

  it('returns an empty command when the target path is blank', () => {
    expect(buildTerminalCdCommand('   ', 'bash')).toBe('');
  });
});
