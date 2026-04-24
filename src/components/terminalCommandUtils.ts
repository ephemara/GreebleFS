import type { ExplorerExecutableScriptRunner } from "../config/filePreview";

function escapeSingleQuotedPath(path: string): string {
  return path.replace(/'/g, `'"'"'`);
}

function escapePowerShellSingleQuotedPath(path: string): string {
  return path.replace(/'/g, "''");
}

function shellExecutableName(shell: string): string {
  const trimmed = shell.trim();
  if (!trimmed) {
    return '';
  }

  const match = trimmed.match(/^(?:\"([^\"]+)\"|'([^']+)'|(\S+))/);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? trimmed).toLowerCase();
}

function isPowerShellShell(normalizedShell: string): boolean {
  return normalizedShell.endsWith('powershell.exe')
    || normalizedShell.endsWith('powershell')
    || normalizedShell.endsWith('pwsh.exe')
    || normalizedShell.endsWith('pwsh');
}

function isCmdShell(normalizedShell: string): boolean {
  return normalizedShell.endsWith('cmd.exe') || normalizedShell.endsWith('cmd');
}

function quotePathForPowerShell(path: string): string {
  return `'${escapePowerShellSingleQuotedPath(path)}'`;
}

function quotePathForCmd(path: string): string {
  return `"${path.replace(/"/g, '""')}"`;
}

function quotePathForUnixShell(path: string): string {
  return `'${escapeSingleQuotedPath(path)}'`;
}

export function buildTerminalCdCommand(path: string, shell: string): string {
  const normalizedPath = path.trim();
  const normalizedShell = shellExecutableName(shell);

  if (!normalizedPath) {
    return '';
  }

  if (isPowerShellShell(normalizedShell)) {
    return `Set-Location -LiteralPath '${escapeSingleQuotedPath(normalizedPath)}'`;
  }

  if (isCmdShell(normalizedShell)) {
    const escaped = normalizedPath.replace(/"/g, '""');
    return `cd /d "${escaped}"`;
  }

  if (
    normalizedShell.endsWith('bash.exe')
    || normalizedShell.endsWith('bash')
    || normalizedShell.endsWith('zsh')
    || normalizedShell.endsWith('fish')
  ) {
    return `builtin cd -- '${escapeSingleQuotedPath(normalizedPath)}'`;
  }

  return `cd -- '${escapeSingleQuotedPath(normalizedPath)}'`;
}

export function buildTerminalScriptRunCommand(args: {
  path: string;
  shell: string;
  runner: ExplorerExecutableScriptRunner;
}): string {
  const normalizedPath = args.path.trim();
  const normalizedShell = shellExecutableName(args.shell);

  if (!normalizedPath) {
    return '';
  }

  if (args.runner === 'batch') {
    if (isPowerShellShell(normalizedShell)) {
      return `& ${quotePathForPowerShell(normalizedPath)}`;
    }
    if (isCmdShell(normalizedShell)) {
      return `call ${quotePathForCmd(normalizedPath)}`;
    }
    return `cmd.exe /c ${quotePathForUnixShell(quotePathForCmd(normalizedPath))}`;
  }

  if (args.runner === 'powershell') {
    if (isPowerShellShell(normalizedShell)) {
      return `& ${quotePathForPowerShell(normalizedPath)}`;
    }
    if (isCmdShell(normalizedShell)) {
      return `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${quotePathForCmd(normalizedPath)}`;
    }
    return `if command -v pwsh >/dev/null 2>&1; then pwsh -NoProfile -ExecutionPolicy Bypass -File ${quotePathForUnixShell(normalizedPath)}; elif command -v powershell >/dev/null 2>&1; then powershell -NoProfile -ExecutionPolicy Bypass -File ${quotePathForUnixShell(normalizedPath)}; else echo 'PowerShell is not available in PATH.'; fi`;
  }

  if (args.runner === 'direct') {
    if (isPowerShellShell(normalizedShell)) {
      return `& ${quotePathForPowerShell(normalizedPath)}`;
    }
    if (isCmdShell(normalizedShell)) {
      return `call ${quotePathForCmd(normalizedPath)}`;
    }
    return quotePathForUnixShell(normalizedPath);
  }

  const interpreter = args.runner;
  if (isPowerShellShell(normalizedShell)) {
    return `& ${interpreter} ${quotePathForPowerShell(normalizedPath)}`;
  }
  if (isCmdShell(normalizedShell)) {
    return `${interpreter} ${quotePathForCmd(normalizedPath)}`;
  }
  return `${interpreter} ${quotePathForUnixShell(normalizedPath)}`;
}

export function buildTerminalPythonRunCommand(args: {
  path: string;
  shell: string;
}): string {
  const normalizedPath = args.path.trim();
  const normalizedShell = shellExecutableName(args.shell);

  if (!normalizedPath) {
    return "";
  }

  if (isPowerShellShell(normalizedShell)) {
    return `if (Get-Command python -ErrorAction SilentlyContinue) { & python ${quotePathForPowerShell(normalizedPath)} } elseif (Get-Command py -ErrorAction SilentlyContinue) { & py -3 ${quotePathForPowerShell(normalizedPath)} } else { Write-Host 'Python is not available in PATH.' }`;
  }

  if (isCmdShell(normalizedShell)) {
    return `python ${quotePathForCmd(normalizedPath)} || py -3 ${quotePathForCmd(normalizedPath)}`;
  }

  return `if command -v python3 >/dev/null 2>&1; then python3 ${quotePathForUnixShell(normalizedPath)}; elif command -v python >/dev/null 2>&1; then python ${quotePathForUnixShell(normalizedPath)}; else echo 'Python is not available in PATH.'; fi`;
}
