function escapeSingleQuotedPath(path: string): string {
  return path.replace(/'/g, `'"'"'`);
}

export function buildTerminalCdCommand(path: string, shell: string): string {
  const normalizedPath = path.trim();
  const normalizedShell = shell.trim().toLowerCase();

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

  return `cd -- '${escapeSingleQuotedPath(normalizedPath)}'`;
}
