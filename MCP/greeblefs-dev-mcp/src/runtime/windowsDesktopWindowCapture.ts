import { spawn } from 'node:child_process';

export interface WindowsDesktopWindowRecord {
  processId: number;
  processName: string;
  title: string;
  handle: string;
  startTime: string | null;
}

export interface WindowsDesktopWindowScreenshotRecord extends WindowsDesktopWindowRecord {
  imagePath: string;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface WindowsDesktopWindowSelection {
  processName?: string;
  handle?: string;
  processId?: number;
  titleContains?: string;
}

function escapePowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeJsonArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function runPowerShellCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-Command', command],
      {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on('data', (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new Error(
          stderr || stdout || `PowerShell desktop-window command failed with exit code ${code ?? -1}.`,
        ),
      );
    });
  });
}

function buildWindowProcessFilterCommand(processName = 'greeblefs'): string {
  const escapedProcessName = escapePowerShellSingleQuotedString(processName);
  return [
    'Get-Process -ErrorAction SilentlyContinue',
    `| Where-Object { $_.ProcessName -eq '${escapedProcessName}' -and $_.MainWindowHandle -ne 0 }`,
    '| Sort-Object StartTime',
  ].join(' ');
}

export async function listWindowsDesktopWindows(
  processName = 'greeblefs',
): Promise<WindowsDesktopWindowRecord[]> {
  const processQuery = buildWindowProcessFilterCommand(processName);
  const command = `
$records = @(${processQuery} | ForEach-Object {
      [PSCustomObject]@{
        processId = $_.Id
        processName = $_.ProcessName
        title = $_.MainWindowTitle
        handle = $_.MainWindowHandle.ToString()
        startTime = if ($_.StartTime) { $_.StartTime.ToString('o') } else { $null }
      }
    })
$records | ConvertTo-Json -Depth 4 -Compress
`;
  const raw = await runPowerShellCommand(command);
  return normalizeJsonArray(JSON.parse(raw) as WindowsDesktopWindowRecord[] | WindowsDesktopWindowRecord);
}

export async function captureWindowsDesktopWindowScreenshot(
  selection: WindowsDesktopWindowSelection & { imagePath: string },
): Promise<WindowsDesktopWindowScreenshotRecord> {
  const processName = selection.processName ?? 'greeblefs';
  const escapedProcessName = escapePowerShellSingleQuotedString(processName);
  const escapedHandle = escapePowerShellSingleQuotedString(selection.handle ?? '');
  const escapedTitleContains = escapePowerShellSingleQuotedString(selection.titleContains ?? '');
  const escapedImagePath = escapePowerShellSingleQuotedString(selection.imagePath);
  const processId = Number.isFinite(selection.processId) ? Math.trunc(selection.processId as number) : 0;

  const command = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class GreebleFsDesktopWindowCapture {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@

$windows = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq '${escapedProcessName}' -and $_.MainWindowHandle -ne 0 } | Sort-Object StartTime)

$target = $null
if ('${escapedHandle}') {
  $target = $windows | Where-Object { $_.MainWindowHandle.ToString() -eq '${escapedHandle}' } | Select-Object -First 1
}
if (-not $target -and ${processId} -gt 0) {
  $target = $windows | Where-Object { $_.Id -eq ${processId} } | Select-Object -First 1
}
if (-not $target -and '${escapedTitleContains}') {
  $needle = '${escapedTitleContains}'
  $target = $windows | Where-Object {
    $_.MainWindowTitle -and $_.MainWindowTitle.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  } | Select-Object -First 1
}
if (-not $target) {
  $target = $windows | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
}
if (-not $target) {
  $target = $windows | Select-Object -First 1
}
if (-not $target) {
  throw 'No matching desktop window was found for screenshot capture.'
}

$rect = New-Object GreebleFsDesktopWindowCapture+RECT
[void][GreebleFsDesktopWindowCapture]::GetWindowRect($target.MainWindowHandle, [ref]$rect)
$width = [Math]::Max(1, $rect.Right - $rect.Left)
$height = [Math]::Max(1, $rect.Bottom - $rect.Top)
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
$bitmap.Save('${escapedImagePath}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

[PSCustomObject]@{
  processId = $target.Id
  processName = $target.ProcessName
  title = $target.MainWindowTitle
  handle = $target.MainWindowHandle.ToString()
  startTime = if ($target.StartTime) { $target.StartTime.ToString('o') } else { $null }
  imagePath = '${escapedImagePath}'
  bounds = [PSCustomObject]@{
    left = $rect.Left
    top = $rect.Top
    width = $width
    height = $height
  }
} | ConvertTo-Json -Depth 6 -Compress
`;

  const raw = await runPowerShellCommand(command);
  return JSON.parse(raw) as WindowsDesktopWindowScreenshotRecord;
}
