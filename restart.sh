#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PHP="/Users/christopherganesh/homebrew/bin/php"
NODE="/usr/local/bin/node"
NPM="/usr/local/lib/node_modules/npm/bin/npm-cli.js"
BACKEND_PORT=3001
FRONTEND_PORT=5173

echo "======================================"
echo "  Portfolio Manager — Restart"
echo "======================================"

# ── Kill anything on these ports ──────────────────────────────────────────────
echo ""
echo "→ Stopping existing processes..."
for PORT in $BACKEND_PORT $FRONTEND_PORT; do
  PID=$(lsof -ti tcp:$PORT 2>/dev/null)
  if [ -n "$PID" ]; then
    kill -9 $PID 2>/dev/null
    echo "  Killed PID $PID on port $PORT"
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
$NODE $NPM run dev > /tmp/pm_frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

# ── Health check ──────────────────────────────────────────────────────────────
echo ""
echo "→ Waiting for services..."
sleep 5

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/api/health)
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT)

echo ""
echo "======================================"
echo "  Status"
echo "======================================"

if [ "$BACKEND_STATUS" = "200" ]; then
  echo "  ✅ Backend  → http://localhost:$BACKEND_PORT"
else
  echo "  ❌ Backend  → http://localhost:$BACKEND_PORT  (HTTP $BACKEND_STATUS)"
  echo "     Logs: tail -f /tmp/pm_backend.log"
fi

if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "304" ]; then
  echo "  ✅ Frontend → http://localhost:$FRONTEND_PORT"
else
  echo "  ❌ Frontend → http://localhost:$FRONTEND_PORT  (HTTP $FRONTEND_STATUS)"
  echo "     Logs: tail -f /tmp/pm_frontend.log"
fi

echo "======================================"
echo ""
echo "  Logs: tail -f /tmp/pm_backend.log"
echo "        tail -f /tmp/pm_frontend.log"
echo ""
