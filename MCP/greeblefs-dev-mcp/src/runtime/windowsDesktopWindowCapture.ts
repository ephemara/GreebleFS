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
if ($records.Count -eq 0) {
  '[]'
} else {
  $records | ConvertTo-Json -Depth 4 -Compress
}
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
  public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
  public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  [DllImport("user32.dll", EntryPoint="GetWindowLong")]
  public static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

  [DllImport("user32.dll", EntryPoint="GetWindowLongPtr")]
  public static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

  public static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) {
    if (IntPtr.Size == 8) {
      return GetWindowLongPtr64(hWnd, nIndex);
    }
    return new IntPtr(GetWindowLong32(hWnd, nIndex));
  }
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

$GWL_EXSTYLE = -20
$WS_EX_TOPMOST = 0x00000008
$SW_SHOWNORMAL = 1
$SWP_NOSIZE = 0x0001
$SWP_NOMOVE = 0x0002
$SWP_SHOWWINDOW = 0x0040
$windowStyle = [GreebleFsDesktopWindowCapture]::GetWindowLongPtr($target.MainWindowHandle, $GWL_EXSTYLE).ToInt64()
$wasTopmost = (($windowStyle -band $WS_EX_TOPMOST) -ne 0)
[void][GreebleFsDesktopWindowCapture]::ShowWindow($target.MainWindowHandle, $SW_SHOWNORMAL)
[void][GreebleFsDesktopWindowCapture]::SetWindowPos(
  $target.MainWindowHandle,
  [GreebleFsDesktopWindowCapture]::HWND_TOPMOST,
  0,
  0,
  0,
  0,
  $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_SHOWWINDOW
)
[void][GreebleFsDesktopWindowCapture]::SetForegroundWindow($target.MainWindowHandle)
Start-Sleep -Milliseconds 180

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
if (-not $wasTopmost) {
  [void][GreebleFsDesktopWindowCapture]::SetWindowPos(
    $target.MainWindowHandle,
    [GreebleFsDesktopWindowCapture]::HWND_NOTOPMOST,
    0,
    0,
    0,
    0,
    $SWP_NOMOVE -bor $SWP_NOSIZE
  )
}

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
