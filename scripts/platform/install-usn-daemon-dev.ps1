param(
  [switch]$NoBuild,
  [switch]$StopOnly
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ServiceName = "GreebleFSUsnIndexer"
$DaemonExe = Join-Path $RepoRoot "target\release\greeblefs-usn-daemon.exe"

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
    cargo build --release -p greeblefs-usn-daemon
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $DaemonExe)) {
  throw "Missing daemon binary at $DaemonExe"
}

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
