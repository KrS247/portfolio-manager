#!/bin/bash
# sync.sh — Sync local SQLite → Supabase PostgreSQL + redeploy public site
# Run from the portfolio-manager directory: ./sync.sh

PHP="/Users/christopherganesh/homebrew/bin/php"
RAILWAY="/Users/christopherganesh/.npm-global/bin/railway"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQLITE_SRC="$SCRIPT_DIR/backend-node/data/portfolio.db"
SQLITE_DEST="$SCRIPT_DIR/backend/database/portfolio.db"
SQLITE_SNAPSHOT="$SCRIPT_DIR/backend/database/portfolio_snapshot"

echo "======================================"
echo "  Portfolio Manager — Cloud Sync"
echo "======================================"
echo ""

# Step 1: Sync to Supabase PostgreSQL
echo "📤 Step 1: Syncing to Supabase..."
$PHP "$SCRIPT_DIR/sync-to-cloud.php"

# Step 2: Copy SQLite snapshot into Railway backend folder
echo ""
echo "📦 Step 2: Copying SQLite snapshot for Railway deployment..."
cp "$SQLITE_SRC" "$SQLITE_DEST"
cp "$SQLITE_SRC" "$SQLITE_SNAPSHOT"   # extension-free copy — never excluded by *.db gitignore
echo "  ✅ Copied portfolio.db + portfolio_snapshot to backend/database/"

# Step 3: Redeploy Railway backend with latest data
echo ""
echo "🚀 Step 3: Redeploying public site (Railway)..."
cd "$SCRIPT_DIR/backend"
$RAILWAY up --detach --service portfolio-manager-backend
echo "  ✅ Deployment triggered. Public site will update in ~2 minutes."
echo ""
echo "  🌐 Public URL: https://portfolio-manager-backend-production-4df0.up.railway.app"
echo ""
