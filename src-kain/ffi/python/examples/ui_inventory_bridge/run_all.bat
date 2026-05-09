@echo off
setlocal
call "%~dp0run_test.bat"
if errorlevel 1 exit /b %errorlevel%
call "%~dp0run_interpret.bat"
