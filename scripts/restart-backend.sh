#!/bin/bash
# Script to kill any process on port 3002 and restart the backend server

PORT=${1:-3002}

echo "🔍 Checking for process on port $PORT..."
PID=$(lsof -ti:$PORT 2>/dev/null)

if [ ! -z "$PID" ]; then
  echo "🛑 Killing existing process $PID on port $PORT..."
  kill -9 $PID 2>/dev/null
  sleep 2
  echo "✅ Process killed"
else
  echo "✅ Port $PORT is free"
fi

echo ""
echo "🚀 Starting backend server on port $PORT..."
PORT=$PORT bun run server
