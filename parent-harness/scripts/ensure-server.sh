#!/bin/bash
# Ensure harness server is running - auto-restart if down
# Run this before any agent operations

HARNESS_DIR="/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator/parent-harness/orchestrator"
LOG_FILE="/tmp/orchestrator.log"
HEALTH_URL="http://localhost:3333/health"

check_health() {
  curl -sf --connect-timeout 3 "$HEALTH_URL" > /dev/null 2>&1
}

start_server() {
  echo "[$(date)] Starting harness server..."
  cd "$HARNESS_DIR"
  
  # Load env
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
  
  # Start in background
  nohup node dist/server.js >> "$LOG_FILE" 2>&1 &
  
  # Wait for startup
  for i in {1..10}; do
    sleep 1
    if check_health; then
      echo "[$(date)] Server started successfully"
      return 0
    fi
  done
  
  echo "[$(date)] Server failed to start"
  return 1
}

# Main
if check_health; then
  echo "[$(date)] Server is healthy"
  exit 0
else
  echo "[$(date)] Server is down, restarting..."
  
  # Kill any zombie processes
  pkill -f "node dist/server.js" 2>/dev/null
  sleep 1
  
  start_server
  exit $?
fi
