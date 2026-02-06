#!/bin/bash
# Phase 1: Frontend Shell Verification
# All steps write events to verification_events table
# Validation checks all events exist

set -e

PHASE=1
DB_PATH="../data/harness.db"
SCRIPT_DIR="$(dirname "$0")"

# Helper function to write event
write_event() {
  local task=$1
  local step=$2
  local status=$3
  local exit_code=${4:-0}
  local output=${5:-""}
  local error=${6:-""}
  
  sqlite3 "$DB_PATH" "INSERT INTO verification_events 
    (timestamp, phase, task_number, step_name, status, exit_code, output, error_message)
    VALUES (datetime('now'), $PHASE, $task, '$step', '$status', $exit_code, '$output', '$error');"
}

# Helper function to check event exists
check_event() {
  local task=$1
  local step=$2
  local expected_status=$3
  
  local count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM verification_events 
    WHERE phase = $PHASE AND task_number = $task AND step_name = '$step' AND status = '$expected_status';")
  
  if [ "$count" -eq 0 ]; then
    echo "❌ Missing event: Phase $PHASE, Task $task, Step '$step', Status '$expected_status'"
    return 1
  fi
  return 0
}

echo "🔍 Verifying Phase 1: Frontend Shell"
echo "======================================"
echo ""

cd "$SCRIPT_DIR/../dashboard"

# ============================================
# STEP 1: npm build
# ============================================
echo "Step 1/7: npm run build"
write_event 1 "npm_build" "started"

if npm run build > /tmp/build.log 2>&1; then
  write_event 1 "npm_build" "completed" 0 "$(head -c 500 /tmp/build.log)"
  echo "  ✅ Build succeeded"
else
  write_event 1 "npm_build" "failed" $? "" "$(tail -c 500 /tmp/build.log)"
  echo "  ❌ Build failed"
  exit 1
fi

# ============================================
# STEP 2: TypeScript check
# ============================================
echo "Step 2/7: npm run typecheck"
write_event 1 "typecheck" "started"

if npm run typecheck > /tmp/typecheck.log 2>&1; then
  write_event 1 "typecheck" "completed" 0
  echo "  ✅ Typecheck passed"
else
  write_event 1 "typecheck" "failed" $? "" "$(tail -c 500 /tmp/typecheck.log)"
  echo "  ❌ Typecheck failed"
  exit 1
fi

# ============================================
# STEP 3: Start preview server
# ============================================
echo "Step 3/7: Starting preview server"
write_event 1 "preview_start" "started"

npm run preview > /tmp/preview.log 2>&1 &
PID=$!
sleep 3

if curl -sf http://localhost:4173 > /dev/null 2>&1; then
  write_event 1 "preview_start" "completed" 0
  echo "  ✅ Preview server running"
else
  write_event 1 "preview_start" "failed" 1 "" "Server not responding"
  kill $PID 2>/dev/null
  echo "  ❌ Preview server failed to start"
  exit 1
fi

# ============================================
# STEP 4: Test root route
# ============================================
echo "Step 4/7: Testing root route (/)"
write_event 1 "route_root" "started"

if curl -sf http://localhost:4173 | grep -q "Agent"; then
  write_event 1 "route_root" "completed" 0
  echo "  ✅ Root route renders"
else
  write_event 1 "route_root" "failed" 1 "" "Agent text not found"
  kill $PID 2>/dev/null
  echo "  ❌ Root route failed"
  exit 1
fi

# ============================================
# STEP 5: Test /tasks route
# ============================================
echo "Step 5/7: Testing /tasks route"
write_event 1 "route_tasks" "started"

if curl -sf http://localhost:4173/tasks | grep -q "Task"; then
  write_event 1 "route_tasks" "completed" 0
  echo "  ✅ Tasks route renders"
else
  write_event 1 "route_tasks" "failed" 1 "" "Task text not found"
  kill $PID 2>/dev/null
  echo "  ❌ Tasks route failed"
  exit 1
fi

# ============================================
# STEP 6: Test /sessions route
# ============================================
echo "Step 6/7: Testing /sessions route"
write_event 1 "route_sessions" "started"

if curl -sf http://localhost:4173/sessions | grep -q "Session"; then
  write_event 1 "route_sessions" "completed" 0
  echo "  ✅ Sessions route renders"
else
  write_event 1 "route_sessions" "failed" 1 "" "Session text not found"
  kill $PID 2>/dev/null
  echo "  ❌ Sessions route failed"
  exit 1
fi

# ============================================
# STEP 7: Check mock agents
# ============================================
echo "Step 7/7: Checking mock agents"
write_event 1 "mock_agents" "started"

AGENT_COUNT=$(curl -sf http://localhost:4173 | grep -c "agent-card" || echo "0")
if [ "$AGENT_COUNT" -ge 3 ]; then
  write_event 1 "mock_agents" "completed" 0 "Found $AGENT_COUNT agents"
  echo "  ✅ Mock agents displayed ($AGENT_COUNT found)"
else
  write_event 1 "mock_agents" "failed" 1 "" "Expected 3+ agents, found $AGENT_COUNT"
  kill $PID 2>/dev/null
  echo "  ❌ Mock agents check failed"
  exit 1
fi

kill $PID 2>/dev/null

echo ""
echo "======================================"
echo "📋 Validating all events were recorded..."
echo "======================================"
echo ""

# Validate all events exist in database
MISSING=0

check_event 1 "npm_build" "completed" || MISSING=$((MISSING+1))
check_event 1 "typecheck" "completed" || MISSING=$((MISSING+1))
check_event 1 "preview_start" "completed" || MISSING=$((MISSING+1))
check_event 1 "route_root" "completed" || MISSING=$((MISSING+1))
check_event 1 "route_tasks" "completed" || MISSING=$((MISSING+1))
check_event 1 "route_sessions" "completed" || MISSING=$((MISSING+1))
check_event 1 "mock_agents" "completed" || MISSING=$((MISSING+1))

if [ "$MISSING" -gt 0 ]; then
  echo ""
  echo "❌ PHASE 1 FAILED - $MISSING event(s) missing from log"
  exit 1
fi

echo ""
echo "======================================"
echo "✅ PHASE 1 PASSED"
echo "   - All 7 steps executed"
echo "   - All 7 events recorded"
echo "   - All 7 events validated"
echo "======================================"
echo ""
echo "Phase 2 (Data Model) may now begin."
