function escapeSingleQuotedPath(path: string): string {
  return path.replace(/'/g, `'"'"'`);
}

function shellExecutableName(shell: string): string {
  const trimmed = shell.trim();
  if (!trimmed) {
    return '';
  }

  const match = trimmed.match(/^(?:\"([^\"]+)\"|'([^']+)'|(\S+))/);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? trimmed).toLowerCase();
}

export function buildTerminalCdCommand(path: string, shell: string): string {
  const normalizedPath = path.trim();
  const normalizedShell = shellExecutableName(shell);

  if (!normalizedPath) {
    return '';
  }

  if (normalizedShell.endsWith('powershell.exe') || normalizedShell.endsWith('powershell') || normalizedShell.endsWith('pwsh.exe') || normalizedShell.endsWith('pwsh')) {
    return `Set-Location -LiteralPath '${escapeSingleQuotedPath(normalizedPath)}'`;
  }

  if (normalizedShell.endsWith('cmd.exe') || normalizedShell.endsWith('cmd')) {
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
