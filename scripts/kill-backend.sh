#!/bin/bash
# Quick script to kill the backend server on port 3002

PORT=${1:-3002}
PID=$(lsof -ti:$PORT 2>/dev/null)

if [ ! -z "$PID" ]; then
  echo "🛑 Killing process $PID on port $PORT..."
  kill -9 $PID 2>/dev/null
  sleep 1
  echo "✅ Done"
else
  echo "✅ No process found on port $PORT"
fi
