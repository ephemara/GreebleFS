@echo off
setlocal

cd /d "%~dp0"

set "installerPath=%CD%\scripts\platform\install-windows-local.ps1"
set "modeLabel=full clean install plus launch"
set "mode=launch"

if /I "%~1"=="install-only" (
    set "modeLabel=full clean install"
    set "mode=install-only"
) else (
    if /I "%~1"=="uninstall" (
        set "modeLabel=uninstall only"
        set "mode=uninstall"
    ) else (
        if /I "%~1"=="help" goto :usage
        if /I "%~1"=="--help" goto :usage
        if /I "%~1"=="-h" goto :usage
        if not "%~1"=="" (
            echo ERROR: Unknown mode "%~1".
            echo.
            goto :usage_error
        )
    )
)

if not exist "%installerPath%" (
    echo ERROR: Could not find the Windows installer script:
    echo   "%installerPath%"
    exit /b 1
)

echo ======================================================
echo GreebleFS Windows new-user flow
echo ======================================================
echo Mode: %modeLabel%
echo Delegating to scripts\platform\install-windows-local.ps1
echo.

if /I "%mode%"=="uninstall" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%installerPath%" -UninstallOnly
) else (
    if /I "%mode%"=="install-only" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%installerPath%"
    ) else (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%installerPath%" -Launch
    )
)

set "exitCode=%ERRORLEVEL%"
if not "%exitCode%"=="0" (
    echo.
    echo New-user flow failed with exit code %exitCode%.
    exit /b %exitCode%
)

echo.
echo New-user flow finished successfully.
exit /b 0

:usage
echo Usage: %~nx0 [install-only^|uninstall]
echo.
echo   no args       Build release, wipe local install and user state, reinstall, and launch.
echo   install-only  Build release, wipe local install and user state, reinstall, and do not launch.
echo   uninstall     Wipe local install and user state without reinstalling.
exit /b 0

:usage_error
echo Usage: %~nx0 [install-only^|uninstall]
exit /b 1
