#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PHP="/Users/christopherganesh/homebrew/bin/php"
BACKEND_PORT=3001
FRONTEND_PORT=5173

echo "======================================"
echo "  Portfolio Manager — Start Script"
echo "======================================"

# ── Kill anything already on these ports ──────────────────────────────────────
echo ""
echo "→ Stopping any existing processes..."

for PORT in $BACKEND_PORT $FRONTEND_PORT; do
  PID=$(lsof -ti tcp:$PORT 2>/dev/null)
  if [ -n "$PID" ]; then
    kill -9 $PID 2>/dev/null
    echo "  Killed process on port $PORT (PID $PID)"
  fi
done

sleep 1

# ── Start backend ─────────────────────────────────────────────────────────────
echo ""
echo "→ Starting backend (Laravel) on port $BACKEND_PORT..."
cd "$PROJECT_DIR/backend"
$PHP artisan serve --port=$BACKEND_PORT > /tmp/pm_backend.log 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ── Start frontend ────────────────────────────────────────────────────────────
echo ""
echo "→ Starting frontend (Vite) on port $FRONTEND_PORT..."
cd "$PROJECT_DIR/frontend"
npm run dev > /tmp/pm_frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

# ── Wait and health check ─────────────────────────────────────────────────────
echo ""
echo "→ Waiting for services to start..."
sleep 5

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/api/health)
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT)

echo ""
echo "======================================"
echo "  Status"
echo "======================================"

if [ "$BACKEND_STATUS" = "200" ]; then
  echo "  ✅ Backend  → http://localhost:$BACKEND_PORT  (OK)"
else
  echo "  ❌ Backend  → http://localhost:$BACKEND_PORT  (HTTP $BACKEND_STATUS)"
  echo "     Logs: tail -f /tmp/pm_backend.log"
fi

if [ "$FRONTEND_STATUS" = "200" ]; then
  echo "  ✅ Frontend → http://localhost:$FRONTEND_PORT  (OK)"
else
  echo "  ❌ Frontend → http://localhost:$FRONTEND_PORT  (HTTP $FRONTEND_STATUS)"
  echo "     Logs: tail -f /tmp/pm_frontend.log"
fi

echo "======================================"
echo ""
echo "  To stop: run ./stop.sh"
echo "  Logs:    tail -f /tmp/pm_backend.log"
echo "           tail -f /tmp/pm_frontend.log"
echo ""
