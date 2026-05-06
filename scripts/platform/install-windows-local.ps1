param(
    [switch]$Launch,
    [switch]$UninstallOnly,
    [switch]$Interactive,
    [switch]$RevealInstaller,
    [string]$InstallDirectory,
    [string]$UsrRootDirectory
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

function Invoke-ProcessAndRequireSuccess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [string[]]$Arguments = @(),
        [switch]$Hidden,
        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    $formattedArguments = if ($Arguments.Count -gt 0) { ' ' + ($Arguments -join ' ') } else { '' }
    Write-Host "> $FilePath$formattedArguments"

    $startProcessParameters = @{
        FilePath     = $FilePath
        ArgumentList = $Arguments
        Wait         = $true
        PassThru     = $true
    }
    if ($Hidden) {
        $startProcessParameters.WindowStyle = 'Hidden'
    }

    $process = Start-Process @startProcessParameters
    if ($process.ExitCode -ne 0) {
        throw "$FailureMessage (exit code $($process.ExitCode))."
    }
}

function Get-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path)
}

function Get-DefaultProgramFilesInstallRoot {
    $programFilesRoot = [Environment]::GetFolderPath([System.Environment+SpecialFolder]::ProgramFiles)
    if ([string]::IsNullOrWhiteSpace($programFilesRoot)) {
        throw 'Unable to resolve Program Files on this machine.'
    }

    return Join-Path $programFilesRoot 'GreebleFS'
}

function Get-NormalizedOptionalPath {
    param(
        [AllowNull()]
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $null
    }

    return Get-AbsolutePath $Path.Trim().Trim('"')
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

function Add-UniquePath {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.List[string]]$Paths,
        [AllowNull()]
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }

    $normalizedPath = Get-AbsolutePath $Path
    if (-not $Paths.Contains($normalizedPath)) {
        $Paths.Add($normalizedPath) | Out-Null
    }
}

function Stop-GreebleProcesses {
    $appProcessNames = @('greeblefs', 'overlayterm', 'greeble')
    $managedWebViewCommandLinePatterns = @(
        '--webview-exe-name=greeblefs.exe',
        '--webview-exe-name=overlayterm.exe',
        '--webview-exe-name=greeble.exe',
        '\co.greeblefs.app\EBWebView',
        '\co.overlayterm.app\EBWebView'
    )

    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        Get-Process -Name $appProcessNames -ErrorAction SilentlyContinue |
            Stop-Process -Force -ErrorAction SilentlyContinue

        Get-CimInstance Win32_Process -Filter "Name = 'msedgewebview2.exe'" -ErrorAction SilentlyContinue |
            Where-Object {
                $commandLine = [string]$_.CommandLine
                if ([string]::IsNullOrWhiteSpace($commandLine)) {
                    return $false
                }

                foreach ($pattern in $managedWebViewCommandLinePatterns) {
                    if ($commandLine.IndexOf($pattern, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                        return $true
                    }
                }

                return $false
            } |
            ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }

        Start-Sleep -Milliseconds 500
    }
}

function Normalize-RegistryString {
    param(
        [AllowNull()]
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    return $Value.Trim().Trim('"')
}

function Get-InstalledGreeblefsRecord {
    $registryPaths = @(
        'Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\GreebleFS',
        'Registry::HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Uninstall\GreebleFS'
    )

    foreach ($registryPath in $registryPaths) {
        if (-not (Test-Path -LiteralPath $registryPath)) {
            continue
        }

        $registryItem = Get-ItemProperty -LiteralPath $registryPath
        return [pscustomobject]@{
            RegistryPath    = $registryPath
            InstallLocation = Get-NormalizedOptionalPath (Normalize-RegistryString $registryItem.InstallLocation)
            UninstallString = Normalize-RegistryString $registryItem.UninstallString
            UsrRootDirectory = Get-NormalizedOptionalPath (Normalize-RegistryString $registryItem.UsrRootDirectory)
        }
    }

    return $null
}

function Invoke-InstalledUninstaller {
    param(
        [AllowNull()]
        [psobject]$InstallRecord
    )

    if ($null -eq $InstallRecord) {
        return
    }

    $candidatePaths = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($InstallRecord.InstallLocation)) {
        Add-UniquePath -Paths $candidatePaths -Path (Join-Path $InstallRecord.InstallLocation 'uninstall.exe')
    }

    if (-not [string]::IsNullOrWhiteSpace($InstallRecord.UninstallString)) {
        $uninstallString = $InstallRecord.UninstallString.Trim()
        if ($uninstallString.StartsWith('"')) {
            $closingQuoteIndex = $uninstallString.IndexOf('"', 1)
            if ($closingQuoteIndex -gt 1) {
                Add-UniquePath -Paths $candidatePaths -Path $uninstallString.Substring(1, $closingQuoteIndex - 1)
            }
        } else {
            Add-UniquePath -Paths $candidatePaths -Path ($uninstallString.Split(' ')[0])
        }
    }

    $uninstallerPath = $candidatePaths |
        Where-Object { Test-Path -LiteralPath $_ } |
        Select-Object -First 1

    if ([string]::IsNullOrWhiteSpace($uninstallerPath)) {
        return
    }

    Invoke-ProcessAndRequireSuccess `
        -FilePath $uninstallerPath `
        -Arguments @('/P') `
        -Hidden `
        -FailureMessage 'Installed GreebleFS uninstaller failed'
}

function Get-TauriCargoTargetDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepositoryRoot
    )

    foreach ($variableName in @('CARGO_TARGET_DIR', 'GREEBLEFS_TAURI_CARGO_TARGET_DIR', 'OVERLAYTERM_TAURI_CARGO_TARGET_DIR')) {
        $candidate = [Environment]::GetEnvironmentVariable($variableName)
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return Get-AbsolutePath $candidate
        }
    }

    return Join-Path $RepositoryRoot 'target'
}

function Get-ReleaseDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepositoryRoot
    )

    return Join-Path (Get-TauriCargoTargetDirectory -RepositoryRoot $RepositoryRoot) 'release'
}

function Get-NsisBundleDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepositoryRoot
    )

    return Join-Path (Get-TauriCargoTargetDirectory -RepositoryRoot $RepositoryRoot) 'release\bundle\nsis'
}

function Get-LatestNsisInstallerExecutable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BundleDirectory
    )

    if (-not (Test-Path -LiteralPath $BundleDirectory)) {
        throw "NSIS bundle directory was not produced: $BundleDirectory"
    }

    $installerExecutable = Get-ChildItem -LiteralPath $BundleDirectory -Filter '*.exe' -File |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if ($null -eq $installerExecutable) {
        throw "No NSIS installer executable was produced in $BundleDirectory"
    }

    return $installerExecutable.FullName
}

function Copy-NsisInstallerToReleaseRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepositoryRoot,
        [Parameter(Mandatory = $true)]
        [string]$InstallerExecutable
    )

    $releaseDirectory = Get-ReleaseDirectory -RepositoryRoot $RepositoryRoot
    $versionedInstallerPath = Join-Path $releaseDirectory ([System.IO.Path]::GetFileName($InstallerExecutable))
    $stableInstallerPath = Join-Path $releaseDirectory 'GreebleFS Setup.exe'

    [System.IO.Directory]::CreateDirectory($releaseDirectory) | Out-Null
    Copy-Item -LiteralPath $InstallerExecutable -Destination $versionedInstallerPath -Force
    Copy-Item -LiteralPath $InstallerExecutable -Destination $stableInstallerPath -Force

    return [pscustomobject]@{
        ReleaseDirectory       = $releaseDirectory
        VersionedInstallerPath = $versionedInstallerPath
        StableInstallerPath    = $stableInstallerPath
    }
}

function Reveal-PathInExplorer {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Unable to reveal a path that does not exist: $Path"
    }

    Invoke-ProcessAndRequireSuccess `
        -FilePath 'explorer.exe' `
        -Arguments @("/select,$Path") `
        -FailureMessage 'Windows Explorer could not reveal the built installer'
}

$repoRoot = Get-AbsolutePath (Join-Path $PSScriptRoot '..\..')
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

    $interactiveMode = $Interactive.IsPresent
    $revealInstallerMode = $RevealInstaller.IsPresent
    $defaultInstallRoot = Get-DefaultProgramFilesInstallRoot
    $resolvedInstallDirectory = Get-NormalizedOptionalPath $InstallDirectory
    $installDirectoryWasExplicit = -not [string]::IsNullOrWhiteSpace($resolvedInstallDirectory)
    if (-not $installDirectoryWasExplicit) {
        $resolvedInstallDirectory = $defaultInstallRoot
    }

    $resolvedUsrRootDirectory = Get-NormalizedOptionalPath $UsrRootDirectory
    $usrRootDirectoryWasExplicit = -not [string]::IsNullOrWhiteSpace($resolvedUsrRootDirectory)
    if (-not $usrRootDirectoryWasExplicit) {
        $resolvedUsrRootDirectory = Join-Path $resolvedInstallDirectory 'usr'
    }

    $currentUserInstallRoots = @(
        Join-Path (Join-Path $localAppData 'Programs') 'GreebleFS'
        Join-Path (Join-Path $localAppData 'Programs') 'OverlayTerm'
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

    $installRecord = Get-InstalledGreeblefsRecord
    $preservedUsrWorkspace = $null
    if ($installRecord -and -not [string]::IsNullOrWhiteSpace($installRecord.UsrRootDirectory)) {
        $usrWorkspaceLivesUnderInstallRoot = $false
        if (-not [string]::IsNullOrWhiteSpace($installRecord.InstallLocation)) {
            $usrWorkspaceLivesUnderInstallRoot = Test-PathUnderRoots `
                -Path $installRecord.UsrRootDirectory `
                -AllowedRoots @($installRecord.InstallLocation)
        }

        if ((-not (Test-PathUnderRoots -Path $installRecord.UsrRootDirectory -AllowedRoots $cleanupRoots)) -and -not $usrWorkspaceLivesUnderInstallRoot) {
            $preservedUsrWorkspace = $installRecord.UsrRootDirectory
        }
    }

    $cleanupTargets = New-Object System.Collections.Generic.List[string]
    foreach ($path in $shortcutPaths + $managedStateRoots + $currentUserInstallRoots) {
        Add-UniquePath -Paths $cleanupTargets -Path $path
    }
    if ($installRecord -and -not [string]::IsNullOrWhiteSpace($installRecord.InstallLocation)) {
        if (Test-PathUnderRoots -Path $installRecord.InstallLocation -AllowedRoots $cleanupRoots) {
            Add-UniquePath -Paths $cleanupTargets -Path $installRecord.InstallLocation
        }
    }
    if ($installRecord -and -not [string]::IsNullOrWhiteSpace($installRecord.UsrRootDirectory)) {
        if (Test-PathUnderRoots -Path $installRecord.UsrRootDirectory -AllowedRoots $cleanupRoots) {
            Add-UniquePath -Paths $cleanupTargets -Path $installRecord.UsrRootDirectory
        }
    }

    if ($UninstallOnly) {
        Write-Host '======================================'
        Write-Host ' GreebleFS Windows Uninstaller'
        Write-Host '======================================'
        Write-Host ''
        Write-Step '[1/2] Removing the installed GreebleFS app if present...'
        Stop-GreebleProcesses
        Invoke-InstalledUninstaller -InstallRecord $installRecord

        Write-Step '[2/2] Cleaning remaining local install artifacts and state roots...'
        foreach ($path in $cleanupTargets) {
            Remove-ManagedPath -Path $path -AllowedRoots $cleanupRoots
        }

        if (-not [string]::IsNullOrWhiteSpace($preservedUsrWorkspace)) {
            Write-Host ''
            Write-Host "Preserved external usr workspace outside the managed cleanup roots: $preservedUsrWorkspace"
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
    Write-Host ' GreebleFS Windows NSIS Installer'
    Write-Host '======================================'
    Write-Host ''
    $modeDescription = if ($revealInstallerMode) {
        'build bundle and reveal installer in target\release'
    } elseif ($interactiveMode) {
        'interactive installer UI'
    } elseif ($Launch) {
        'passive installer + launch'
    } else {
        'passive installer'
    }
    Write-Host "Repository: $repoRoot"
    Write-Host "Mode: $modeDescription"
    Write-Host "Install root: $resolvedInstallDirectory"
    Write-Host "Usr workspace: $resolvedUsrRootDirectory"
    Write-Host ''

    Write-Host 'Stopping running GreebleFS processes before the bundle build...'
    Stop-GreebleProcesses
    Write-Host ''

    Write-Step '[1/4] Installing project dependencies...'
    Invoke-Tool -Command 'bun' -Arguments @('install', '--frozen-lockfile')

    Write-Step '[2/4] Generating branded NSIS installer artwork...'
    Invoke-Tool -Command 'powershell' -Arguments @(
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        '.\scripts\platform\generate-windows-installer-art.ps1'
    )

    Write-Step '[3/4] Building the Windows NSIS release bundle...'
    Invoke-Tool -Command 'bun' -Arguments @('run', 'release:windows:bundle')
    $bundleDirectory = Get-NsisBundleDirectory -RepositoryRoot $repoRoot
    $installerExecutable = Get-LatestNsisInstallerExecutable -BundleDirectory $bundleDirectory
    $mirroredInstaller = Copy-NsisInstallerToReleaseRoot -RepositoryRoot $repoRoot -InstallerExecutable $installerExecutable

    if ($revealInstallerMode) {
        Write-Step '[4/4] Revealing the freshly built installer in target\release...'
        Reveal-PathInExplorer -Path $mirroredInstaller.StableInstallerPath

        Write-Host ''
        Write-Host 'Installer bundle is ready.'
        Write-Host "NSIS bundle: $installerExecutable"
        Write-Host "Release installer: $($mirroredInstaller.StableInstallerPath)"
        Write-Host "Versioned installer: $($mirroredInstaller.VersionedInstallerPath)"
        return
    }

    Write-Step '[4/4] Running the freshly built NSIS installer...'
    Stop-GreebleProcesses
    $installerArguments = New-Object System.Collections.Generic.List[string]
    if (-not $interactiveMode) {
        $null = $installerArguments.Add('/P')
        if ($Launch) {
            $null = $installerArguments.Add('/R')
        }
    } elseif ($Launch) {
        Write-Host 'Interactive mode leaves launch control on the NSIS finish page.'
    }

    if ($usrRootDirectoryWasExplicit) {
        $null = $installerArguments.Add("/USRDIR=$resolvedUsrRootDirectory")
    }
    if ($installDirectoryWasExplicit) {
        $null = $installerArguments.Add("/D=$resolvedInstallDirectory")
    }

    Invoke-ProcessAndRequireSuccess `
        -FilePath $installerExecutable `
        -Arguments $installerArguments.ToArray() `
        -FailureMessage 'Fresh GreebleFS installer failed'

    if (-not [string]::IsNullOrWhiteSpace($preservedUsrWorkspace)) {
        Write-Host ''
        Write-Host "Preserved external usr workspace outside the managed cleanup roots: $preservedUsrWorkspace"
    }

    Write-Host ''
    Write-Host 'Installer run complete.'
    Write-Host "NSIS bundle: $installerExecutable"
    Write-Host "Release installer: $($mirroredInstaller.StableInstallerPath)"
}
finally {
    Pop-Location
}
