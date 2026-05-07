@echo off
REM Build VirtualFirework.exe with PyInstaller (Windows).
REM
REM Run this from a command prompt at the repo root.
REM First time: create the venv and install deps.
REM Subsequent runs: just rebuild.

setlocal

if not exist .venv (
    echo Creating virtualenv...
    python -m venv .venv || goto :fail
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip || goto :fail
    pip install -r requirements.txt || goto :fail
) else (
    call .venv\Scripts\activate.bat
)

if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

pyinstaller ^
    --name VirtualFirework ^
    --onefile ^
    --windowed ^
    --collect-all ursina ^
    --collect-all panda3d ^
    src\main.py || goto :fail

echo.
echo Build OK. Executable: dist\VirtualFirework.exe
exit /b 0

:fail
echo.
echo Build FAILED.
exit /b 1
