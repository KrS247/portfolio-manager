#!/bin/bash

echo "======================================"
echo "  Portfolio Manager — Stop Script"
echo "======================================"
echo ""

for PORT in 3001 5173; do
  PID=$(lsof -ti tcp:$PORT 2>/dev/null)
  if [ -n "$PID" ]; then
    kill -9 $PID 2>/dev/null
    echo "  ✅ Stopped process on port $PORT (PID $PID)"
  else
    echo "  —  Nothing running on port $PORT"
  fi
done

echo ""
echo "  All services stopped."
echo "======================================"
echo ""
