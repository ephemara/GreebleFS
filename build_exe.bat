@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo =======================================================
echo Building OverlayTerm to a standalone executable (.exe)
echo =======================================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm is not available on PATH.
  goto :fail
)

where cargo >nul 2>&1
if errorlevel 1 (
  echo ERROR: cargo is not available on PATH. Install Rust toolchain first.
  goto :fail
)

echo Installing node modules...
call npm install
if errorlevel 1 goto :fail

echo.
echo Building frontend assets...
call npm run build
if errorlevel 1 goto :fail

echo.
echo Building Rust backend and packaging app...
echo This will take a moment (it has to compile Rust dependencies for release).
echo.
call npm run tauri -- build
if errorlevel 1 goto :fail

echo.
echo =======================================================
echo BUILD COMPLETE!
echo.
echo Your standalone executable is located at:
echo m:\OverlayTerm\src-tauri\target\release\OverlayTerm.exe
echo.
echo Note: If you have MSI/NSIS bundling enabled, there will also be an installer at:
echo m:\OverlayTerm\src-tauri\target\release\bundle\nsis\
echo =======================================================
pause
exit /b 0

:fail
echo.
echo =======================================================
echo BUILD FAILED. See errors above.
echo =======================================================
pause
exit /b 1
