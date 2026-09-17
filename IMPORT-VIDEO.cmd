@echo off
cd /d "%~dp0"
if "%~1"=="" (echo Drag a video file onto this script. & pause & exit /b 1)
.venv\Scripts\python.exe scripts\import-video.py "%~1"
pause
