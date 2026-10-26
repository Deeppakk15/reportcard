@echo off
echo ========================================================
echo   CDC Student Performance Index & Ranking Platform
echo ========================================================
echo Starting local ranking server at http://localhost:5050 ...
start http://localhost:5050
python server.py
pause
