#!/bin/bash
#
# Start Orchestrator in Production Mode
#
# Features:
# - Auto-restart on crash
# - Logging to file
# - Memory monitoring
# - Graceful shutdown
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ORCHESTRATOR_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$HOME/.harness/logs"
PM2_APP_NAME="orchestrator"

# Create log directory
mkdir -p "$LOG_DIR"

# Kill any existing instance
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

# Build if needed
cd "$ORCHESTRATOR_DIR"
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo "📦 Building orchestrator..."
    npm run build
fi

# Start with PM2
echo "🚀 Starting orchestrator with PM2..."
pm2 start ecosystem.config.cjs

# Show status
echo ""
pm2 status

echo ""
echo "📊 View logs: pm2 logs $PM2_APP_NAME"
echo "📈 Monitor: pm2 monit"
echo "🛑 Stop: pm2 stop $PM2_APP_NAME"
echo "🔄 Restart: pm2 restart $PM2_APP_NAME"
