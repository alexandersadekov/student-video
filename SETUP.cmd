@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js LTS first. & pause & exit /b 1)
where python >nul 2>nul || (echo Install Python 3.11 or newer first. & pause & exit /b 1)
where ffmpeg >nul 2>nul || (echo Install FFmpeg and add it to PATH first. & pause & exit /b 1)
call npm install
if errorlevel 1 (pause & exit /b 1)
python -m venv .venv
.venv\Scripts\python.exe -m pip install faster-whisper==1.2.1
if errorlevel 1 (pause & exit /b 1)
echo Ready. Drop a video onto IMPORT-VIDEO.cmd, then open START-STUDIO.cmd.
pause
