@echo off
title Vibe Clinic Dashboard Launcher
echo --------------------------------------------------
echo  Starting Vibe Clinic Dashboard (.env active)
echo --------------------------------------------------
cd /d "%~dp0"
node --env-file=.env backend/bin/vibe-clinic.js dashboard --cwd examples/calculator --port 7700
pause
