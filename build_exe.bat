@echo off
echo =======================================================
echo Building OverlayTerm to a standalone executable (.exe)
echo =======================================================
echo.
echo Installing node modules...
call npm install

echo.
echo Compiling the React UI and building the Rust binary...
echo This will take a moment (it has to compile Rust dependencies for release).
echo.
call npm run tauri build

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
