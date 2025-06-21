#!/bin/bash

# WebGPU Water Flow Simulation - Development Server Starter
echo "🌊 Starting WebGPU Water Flow Simulation Development Server..."

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Python is not installed. Please install Python to run the development server."
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the script directory
cd "$SCRIPT_DIR"

# Check if index.html exists
if [ ! -f "index.html" ]; then
    echo "❌ index.html not found in current directory: $SCRIPT_DIR"
    exit 1
fi

# Find an available port (default 8000, fallback to 8001-8010)
PORT=8000
for p in {8000..8010}; do
    if ! lsof -i:$p > /dev/null 2>&1; then
        PORT=$p
        break
    fi
done

echo "📁 Serving files from: $SCRIPT_DIR"
echo "🌐 Server will be available at: http://localhost:$PORT"
echo "📄 Opening: http://localhost:$PORT/index.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo "======================================="

# Start the server in the background
$PYTHON_CMD -m http.server $PORT &
SERVER_PID=$!

# Wait a moment for the server to start
sleep 2

# Open the browser (macOS)
if command -v open &> /dev/null; then
    open "http://localhost:$PORT/index.html"
# Linux
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:$PORT/index.html"
# Windows (if running in WSL or Git Bash)
elif command -v cmd.exe &> /dev/null; then
    cmd.exe /c start "http://localhost:$PORT/index.html"
else
    echo "🌐 Please open your browser and go to: http://localhost:$PORT/index.html"
fi

# Function to cleanup when script exits
cleanup() {
    echo ""
    echo "🛑 Shutting down development server..."
    kill $SERVER_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Keep the script running and wait for the server process
wait $SERVER_PID 