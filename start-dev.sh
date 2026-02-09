#!/usr/bin/env bash
set -e

echo "Starting Nivas PMS Development Servers..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/nivas-backend"
FRONTEND_DIR="$SCRIPT_DIR/nivas-frontend"

# Check bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: bun is not installed. Install it from https://bun.sh"
    exit 1
fi

echo "Bun version: $(bun --version)"
echo ""

# Start backend in background
echo "Starting Backend Server (port 3000)..."
(cd "$BACKEND_DIR" && bun run start) &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend in background
echo "Starting Frontend Server (port 5173)..."
(cd "$FRONTEND_DIR" && bun run dev) &
FRONTEND_PID=$!

echo ""
echo "Both servers are starting!"
echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

# Trap SIGINT/SIGTERM to kill both processes
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    wait $FRONTEND_PID 2>/dev/null
    echo "Servers stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
