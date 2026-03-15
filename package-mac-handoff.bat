@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%I"
if not defined STAMP (
  echo [OverlayTerm] Failed to generate timestamp for package name.
  exit /b 1
)

set "OUTPUT_DIR=%REPO_ROOT%\release-packages"
set "ZIP_NAME=OverlayTerm-mac-handoff-%STAMP%.zip"
set "ZIP_PATH=%OUTPUT_DIR%\%ZIP_NAME%"
set "STAGE_DIR=%TEMP%\OverlayTerm_mac_handoff_%STAMP%"

echo [OverlayTerm] Preparing Mac handoff package...
echo [OverlayTerm] Repo root: %REPO_ROOT%
echo [OverlayTerm] Output zip: %ZIP_PATH%

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

if exist "%STAGE_DIR%" rmdir /s /q "%STAGE_DIR%"
mkdir "%STAGE_DIR%" >nul 2>nul

echo [OverlayTerm] Staging files without build artifacts...
robocopy "%REPO_ROOT%" "%STAGE_DIR%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP ^
  /XD "%REPO_ROOT%\node_modules" ^
      "%REPO_ROOT%\dist" ^
      "%REPO_ROOT%\.git" ^
      "%REPO_ROOT%\src-tauri\target" ^
      "%REPO_ROOT%\mac-release\output" ^
      "%REPO_ROOT%\release-packages" ^
      "%REPO_ROOT%\coverage" ^
  /XF "*.zip" "*.log"

set "ROBOCODE=%ERRORLEVEL%"
if %ROBOCODE% GEQ 8 (
  echo [OverlayTerm] Robocopy failed with exit code %ROBOCODE%.
  exit /b %ROBOCODE%
)

if exist "%ZIP_PATH%" del /f /q "%ZIP_PATH%"

echo [OverlayTerm] Creating zip archive...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Compress-Archive -Path '%STAGE_DIR%\*' -DestinationPath '%ZIP_PATH%' -CompressionLevel Optimal"

if errorlevel 1 (
  echo [OverlayTerm] Zip creation failed.
  exit /b 1
)

rmdir /s /q "%STAGE_DIR%"

echo [OverlayTerm] Done.
echo [OverlayTerm] Send this file to your brother:
echo %ZIP_PATH%
endlocal
