import { describe, expect, it } from 'vitest';
import {
  buildTerminalCdCommand,
  buildTerminalPythonRunCommand,
  buildTerminalScriptRunCommand,
} from '../components/terminalCommandUtils';

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

describe('buildTerminalScriptRunCommand', () => {
  it('runs batch files directly inside PowerShell terminals', () => {
    expect(
      buildTerminalScriptRunCommand({
        path: "C:\\Dev\\Taloor's Lab\\build.bat",
        shell: 'pwsh.exe',
        runner: 'batch',
      }),
    ).toBe("& 'C:\\Dev\\Taloor''s Lab\\build.bat'");
  });

  it('uses call for batch files inside cmd terminals', () => {
    expect(
      buildTerminalScriptRunCommand({
        path: 'C:\\Work\\OverlayTerm\\build.bat',
        shell: 'cmd.exe',
        runner: 'batch',
      }),
    ).toBe('call "C:\\Work\\OverlayTerm\\build.bat"');
  });

  it('launches PowerShell scripts from cmd terminals through powershell.exe', () => {
    expect(
      buildTerminalScriptRunCommand({
        path: 'C:\\Work\\OverlayTerm\\build.ps1',
        shell: 'cmd.exe',
        runner: 'powershell',
      }),
    ).toBe(
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\Work\\OverlayTerm\\build.ps1"',
    );
  });

  it('runs direct executable scripts in unix shells without wrapping an interpreter', () => {
    expect(
      buildTerminalScriptRunCommand({
        path: "/workspace/overlay's/run-tool",
        shell: '/bin/bash',
        runner: 'direct',
      }),
    ).toBe("'/workspace/overlay'\"'\"'s/run-tool'");
  });

  it('uses the requested shell interpreter for shell-authored scripts', () => {
    expect(
      buildTerminalScriptRunCommand({
        path: '/workspace/repo/build.zsh',
        shell: '/bin/bash',
        runner: 'zsh',
      }),
    ).toBe("zsh '/workspace/repo/build.zsh'");
  });
});

describe('buildTerminalPythonRunCommand', () => {
  it('prefers python and falls back to py inside PowerShell terminals', () => {
    expect(
      buildTerminalPythonRunCommand({
        path: "C:\\Dev\\Taloor's Lab\\tool.py",
        shell: 'pwsh.exe',
      }),
    ).toBe(
      "if (Get-Command python -ErrorAction SilentlyContinue) { & python 'C:\\Dev\\Taloor''s Lab\\tool.py' } elseif (Get-Command py -ErrorAction SilentlyContinue) { & py -3 'C:\\Dev\\Taloor''s Lab\\tool.py' } else { Write-Host 'Python is not available in PATH.' }",
    );
  });

  it('uses python then py -3 inside cmd terminals', () => {
    expect(
      buildTerminalPythonRunCommand({
        path: 'C:\\Work\\OverlayTerm\\tool.py',
        shell: 'cmd.exe',
      }),
    ).toBe('python "C:\\Work\\OverlayTerm\\tool.py" || py -3 "C:\\Work\\OverlayTerm\\tool.py"');
  });

  it('prefers python3 then python inside unix shells', () => {
    expect(
      buildTerminalPythonRunCommand({
        path: "/workspace/overlay's/tool.py",
        shell: '/bin/bash',
      }),
    ).toBe(
      "if command -v python3 >/dev/null 2>&1; then python3 '/workspace/overlay'\"'\"'s/tool.py'; elif command -v python >/dev/null 2>&1; then python '/workspace/overlay'\"'\"'s/tool.py'; else echo 'Python is not available in PATH.'; fi",
    );
  });
});
