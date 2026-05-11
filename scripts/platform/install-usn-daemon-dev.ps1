param(
  [switch]$NoBuild,
  [switch]$StopOnly,
  [string]$DaemonExe,
  [switch]$UseSharedCargoTarget
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ServiceName = "GreebleFSUsnIndexer"
$IsolatedTargetDir = Join-Path $RepoRoot "target\usn-service"
$IsolatedDaemonExe = Join-Path $IsolatedTargetDir "release\greeblefs-usn-daemon.exe"
$SharedDaemonExe = Join-Path $RepoRoot "target\release\greeblefs-usn-daemon.exe"

if ([string]::IsNullOrWhiteSpace($DaemonExe)) {
  if ($UseSharedCargoTarget) {
    $DaemonExe = $SharedDaemonExe
  } else {
    $DaemonExe = $IsolatedDaemonExe
  }
} else {
  $DaemonExe = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($DaemonExe)
}

function Assert-Elevated {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this helper from an elevated PowerShell so the service can be installed as LocalSystem."
  }
}

function Invoke-ServiceCommand {
  param([string[]]$Arguments)
  & sc.exe @Arguments | Write-Host
}

Assert-Elevated

if ($StopOnly) {
  Invoke-ServiceCommand @("stop", $ServiceName)
  Invoke-ServiceCommand @("delete", $ServiceName)
  exit 0
}

if (-not $NoBuild) {
  Push-Location $RepoRoot
  try {
    $PreviousCargoTargetDir = $env:CARGO_TARGET_DIR
    if (-not $UseSharedCargoTarget) {
      $env:CARGO_TARGET_DIR = $IsolatedTargetDir
    }
    cargo build --release -p greeblefs-usn-daemon
  } finally {
    if ($null -eq $PreviousCargoTargetDir) {
      Remove-Item Env:CARGO_TARGET_DIR -ErrorAction SilentlyContinue
    } else {
      $env:CARGO_TARGET_DIR = $PreviousCargoTargetDir
    }
    Pop-Location
  }
}

if (-not (Test-Path $DaemonExe) -and -not $UseSharedCargoTarget -and (Test-Path $SharedDaemonExe)) {
  Write-Host "Isolated daemon binary was not found; using shared target binary at $SharedDaemonExe"
  $DaemonExe = $SharedDaemonExe
}

if (-not (Test-Path $DaemonExe)) {
  throw "Missing daemon binary at $DaemonExe"
}

Write-Host "Installing $ServiceName from $DaemonExe"

Invoke-ServiceCommand @("stop", $ServiceName)
Invoke-ServiceCommand @("delete", $ServiceName)
Start-Sleep -Milliseconds 500

$BinaryPath = "`"$DaemonExe`" --service"
Invoke-ServiceCommand @(
  "create",
  $ServiceName,
  "binPath=",
  $BinaryPath,
  "start=",
  "auto",
  "DisplayName=",
  "GreebleFS USN Indexer"
)
Invoke-ServiceCommand @(
  "description",
  $ServiceName,
  "Indexes local NTFS volumes for GreebleFS through the Windows USN journal."
)
Invoke-ServiceCommand @(
  "failure",
  $ServiceName,
  "reset=",
  "86400",
  "actions=",
  "restart/5000/restart/15000/`"`"/30000"
)
Invoke-ServiceCommand @("start", $ServiceName)
Invoke-ServiceCommand @("query", $ServiceName)
