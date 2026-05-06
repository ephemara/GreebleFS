@echo off
setlocal

cd /d "%~dp0"

set "installerPath=%CD%\scripts\platform\install-windows-local.ps1"
set "modeLabel=omega build + reveal installer"
set "mode=reveal"

if "%~1"=="" goto :run
if /I "%~1"=="help" goto :usage
if /I "%~1"=="--help" goto :usage
if /I "%~1"=="-h" goto :usage

if /I "%~1"=="reveal" (
    set "modeLabel=omega build + reveal installer"
    set "mode=reveal"
    goto :run
)

if /I "%~1"=="interactive" (
    set "modeLabel=interactive installer flow"
    set "mode=interactive"
    goto :run
)

if /I "%~1"=="install-only" (
    set "modeLabel=omega release install"
    set "mode=install-only"
    goto :run
)

if /I "%~1"=="launch" (
    set "modeLabel=omega release install + launch"
    set "mode=launch"
    goto :run
)

if /I "%~1"=="uninstall" (
    set "modeLabel=uninstall only"
    set "mode=uninstall"
    goto :run
)

echo ERROR: Unknown mode "%~1".
echo.
goto :usage_error

:run
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
) else if /I "%mode%"=="install-only" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%installerPath%"
) else if /I "%mode%"=="interactive" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%installerPath%" -Interactive
) else if /I "%mode%"=="launch" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%installerPath%" -Launch
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%installerPath%" -RevealInstaller
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
echo Usage: %~nx0 [reveal^|interactive^|install-only^|launch^|uninstall]
echo.
echo   no args       Full omega build: install dependencies, build JS + Rust release, mirror the NSIS installer into target\release, then open Explorer with it selected.
echo   reveal        Same as no args.
echo   interactive   Full omega build: install dependencies, build JS + Rust release, then open the interactive NSIS installer UI.
echo   install-only  Full omega build: install dependencies, build JS + Rust release, then run the passive NSIS installer without launching.
echo   launch        Full omega build: install dependencies, build JS + Rust release, then run the passive NSIS installer and launch the installed app.
echo   uninstall     Wipe local install and user state without reinstalling.
exit /b 0

:usage_error
echo Usage: %~nx0 [reveal^|interactive^|install-only^|launch^|uninstall]
exit /b 1
