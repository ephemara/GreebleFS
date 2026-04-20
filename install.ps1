param(
    [switch]$Launch,
    [switch]$UninstallOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'This installer only supports Windows.'
}

function Write-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    Write-Host $Message
}

function Invoke-Tool {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $formattedArguments = if ($Arguments.Count -gt 0) { ' ' + ($Arguments -join ' ') } else { '' }
    Write-Host "> $Command$formattedArguments"
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $Command$formattedArguments"
    }
}

function Get-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path)
}

function Test-PathUnderRoots {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string[]]$AllowedRoots
    )

    $normalizedPath = Get-AbsolutePath $Path

    foreach ($root in $AllowedRoots) {
        if ([string]::IsNullOrWhiteSpace($root)) {
            continue
        }

        $normalizedRoot = Get-AbsolutePath $root.TrimEnd('\', '/')
        if ($normalizedPath.Equals($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }

        $prefix = $normalizedRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
        if ($normalizedPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    return $false
}

function Remove-ManagedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string[]]$AllowedRoots
    )

    if (-not (Test-PathUnderRoots -Path $Path -AllowedRoots $AllowedRoots)) {
        throw "Refusing to remove path outside the managed cleanup roots: $Path"
    }

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

function Stop-GreebleProcesses {
    # Kill the currently running app so uninstall/replace can actually clear the install tree.
    Get-Process -Name 'greeblefs', 'overlayterm', 'greeble' -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function New-Shortcut {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ShortcutPath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $shortcutParent = Split-Path -Parent $ShortcutPath
    if ($shortcutParent) {
        New-Item -ItemType Directory -Force -Path $shortcutParent | Out-Null
    }

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.Description = $Description
    $shortcut.IconLocation = "$TargetPath,0"
    $shortcut.Save()
}

function Get-RepositoryVersion {
    $packageJsonPath = Join-Path $repoRoot 'package.json'
    $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($packageJson.version)) {
        throw 'package.json does not declare a version.'
    }

    return [string]$packageJson.version
}

function Get-CargoTargetDirectory {
    $metadataJson = & cargo metadata --manifest-path (Join-Path $repoRoot 'src-tauri/Cargo.toml') --no-deps --format-version 1
    if ($LASTEXITCODE -ne 0) {
        throw 'cargo metadata failed.'
    }

    $metadata = $metadataJson | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($metadata.target_directory)) {
        throw 'cargo metadata did not return a target_directory.'
    }

    return [string]$metadata.target_directory
}

$repoRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    throw 'Unable to resolve the repository root.'
}

Push-Location $repoRoot
try {
    $localAppData = [Environment]::GetFolderPath([System.Environment+SpecialFolder]::LocalApplicationData)
    $roamingAppData = [Environment]::GetFolderPath([System.Environment+SpecialFolder]::ApplicationData)
    $desktopDir = [Environment]::GetFolderPath([System.Environment+SpecialFolder]::DesktopDirectory)
    $startMenuPrograms = [Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)

    foreach ($path in @($localAppData, $roamingAppData, $desktopDir, $startMenuPrograms)) {
        if ([string]::IsNullOrWhiteSpace($path)) {
            throw 'Unable to resolve one or more Windows shell folders.'
        }
    }

    $programsRoot = Join-Path $localAppData 'Programs'
    $installRoot = Join-Path $programsRoot 'GreebleFS'
    $installBinary = Join-Path $installRoot 'greeblefs.exe'
    $versionFile = Join-Path $installRoot 'VERSION'

    $legacyInstallRoots = @(
        Join-Path $programsRoot 'OverlayTerm'
    )

    $managedStateRoots = @(
        Join-Path $localAppData 'co.greeblefs.app'
        Join-Path $localAppData 'co.overlayterm.app'
        Join-Path $roamingAppData 'GreebleFS'
        Join-Path $roamingAppData 'OverlayTerm'
        Join-Path $roamingAppData 'co.greeblefs.app'
        Join-Path $roamingAppData 'co.overlayterm.app'
    )

    $shortcutPaths = @(
        Join-Path $desktopDir 'GreebleFS.lnk'
        Join-Path $desktopDir 'OverlayTerm.lnk'
        Join-Path $desktopDir 'Greeble.lnk'
        Join-Path $startMenuPrograms 'GreebleFS.lnk'
        Join-Path $startMenuPrograms 'OverlayTerm.lnk'
        Join-Path $startMenuPrograms 'Greeble.lnk'
    )

    $cleanupRoots = @(
        $localAppData
        $roamingAppData
        $desktopDir
        $startMenuPrograms
    )

    if ($UninstallOnly) {
        Write-Host '======================================'
        Write-Host ' GreebleFS Windows Uninstaller'
        Write-Host '======================================'
        Write-Host ''
        Write-Step '[1/1] Removing previous install and user state...'
        Stop-GreebleProcesses
        foreach ($path in $shortcutPaths + $managedStateRoots + $legacyInstallRoots + @($installRoot)) {
            Remove-ManagedPath -Path $path -AllowedRoots $cleanupRoots
        }
        Write-Host ''
        Write-Host 'Uninstall complete.'
        return
    }

    if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
        throw 'bun is required to build GreebleFS on Windows.'
    }

    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        throw 'cargo is required to build GreebleFS on Windows.'
    }

    Write-Host '======================================'
    Write-Host ' GreebleFS Windows Clean Installer'
    Write-Host '======================================'
    Write-Host ''
    Write-Host "Repository: $repoRoot"
    Write-Host "Install root: $installRoot"
    Write-Host ''

    Write-Step '[1/6] Installing project dependencies...'
    Invoke-Tool -Command 'bun' -Arguments @('install', '--frozen-lockfile')

    Write-Step '[2/6] Syncing canonical icons...'
    Invoke-Tool -Command 'bun' -Arguments @('scripts/sync-canonical-icons.mjs')

    Write-Step '[3/6] Regenerating Tauri bindings...'
    Invoke-Tool -Command 'cargo' -Arguments @(
        'run',
        '--manifest-path',
        'src-tauri/Cargo.toml',
        '--bin',
        'export-bindings'
    )

    Write-Step '[4/6] Building frontend bundle...'
    Invoke-Tool -Command 'bun' -Arguments @('x', 'vite', 'build')

    Write-Step '[5/6] Building native release binary...'
    Invoke-Tool -Command 'cargo' -Arguments @(
        'build',
        '--manifest-path',
        'src-tauri/Cargo.toml',
        '--release'
    )

    # Build first so a failed compile leaves the previous install intact.
    $cargoTargetDirectory = Get-CargoTargetDirectory
    $releaseBinarySource = Join-Path (Join-Path $cargoTargetDirectory 'release') 'greeblefs.exe'
    if (-not (Test-Path -LiteralPath $releaseBinarySource)) {
        throw "Release binary was not produced at $releaseBinarySource"
    }

    $version = Get-RepositoryVersion

    Write-Step '[6/6] Removing previous install and installing the fresh build...'
    Stop-GreebleProcesses
    foreach ($path in $shortcutPaths + $managedStateRoots + $legacyInstallRoots + @($installRoot)) {
        Remove-ManagedPath -Path $path -AllowedRoots $cleanupRoots
    }

    New-Item -ItemType Directory -Force -Path $programsRoot | Out-Null
    New-Item -ItemType Directory -Force -Path $installRoot | Out-Null

    Copy-Item -LiteralPath $releaseBinarySource -Destination $installBinary -Force
    Set-Content -LiteralPath $versionFile -Value $version -Encoding Ascii

    New-Shortcut -ShortcutPath (Join-Path $desktopDir 'GreebleFS.lnk') `
        -TargetPath $installBinary `
        -WorkingDirectory $installRoot `
        -Description 'GreebleFS desktop workbench'

    New-Shortcut -ShortcutPath (Join-Path $startMenuPrograms 'GreebleFS.lnk') `
        -TargetPath $installBinary `
        -WorkingDirectory $installRoot `
        -Description 'GreebleFS desktop workbench'

    Write-Host ''
    Write-Host 'Installed.'
    Write-Host "Binary: $installBinary"
    Write-Host "Desktop shortcut: $(Join-Path $desktopDir 'GreebleFS.lnk')"
    Write-Host "Start Menu shortcut: $(Join-Path $startMenuPrograms 'GreebleFS.lnk')"
    Write-Host ''

    if ($Launch) {
        Write-Step 'Launching installed release binary...'
        Start-Process -FilePath $installBinary -WorkingDirectory $installRoot
    }
}
finally {
    Pop-Location
}
