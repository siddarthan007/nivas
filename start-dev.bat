@echo off
echo Starting Nivas PMS Development Servers...
echo.

:: Start backend in a new terminal
echo Starting Backend Server (port 3000)...
start "Nivas Backend" cmd /k "cd /d c:\Users\LENOVO\development\nivas-backend && bun run start"

:: Wait a moment for backend to start
timeout /t 2 /nobreak > nul

:: Start frontend in a new terminal  
echo Starting Frontend Server (port 5173)...
start "Nivas Frontend" cmd /k "cd /d c:\Users\LENOVO\development\nivas-frontend && bun run dev"

echo.
echo Both servers are starting in separate terminals!
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Close the terminal windows to stop the servers.
pause
