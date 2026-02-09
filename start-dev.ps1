# Development Script for Nivas PMS
# Run this script to start both backend and frontend servers

Write-Host "Starting Nivas PMS Development Servers..." -ForegroundColor Cyan
Write-Host ""

# Check if bun is installed
try {
    $bunVersion = bun --version
    Write-Host "Bun version: $bunVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: bun is not installed. Please install bun first." -ForegroundColor Red
    exit 1
}

# Define paths
$backendPath = "c:\Users\LENOVO\development\nivas-backend"
$frontendPath = "c:\Users\LENOVO\development\nivas-frontend"

# Start backend in a new terminal
Write-Host "Starting Backend Server (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend Server' -ForegroundColor Cyan; bun run start"

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend in a new terminal
Write-Host "Starting Frontend Server (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Frontend Server' -ForegroundColor Cyan; bun run dev"

Write-Host ""
Write-Host "Both servers are starting in separate terminals!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C in each terminal to stop the servers." -ForegroundColor Gray
