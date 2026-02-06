#!/bin/bash
# Phase 1: Frontend Shell Verification
# All criteria must pass for Phase 2 to begin

set -e

echo "🔍 Verifying Phase 1: Frontend Shell"
echo "======================================"

cd "$(dirname "$0")/../dashboard"

echo ""
echo "1/7 Checking npm build..."
npm run build || { echo "❌ Build failed"; exit 1; }
echo "✅ Build succeeded"

echo ""
echo "2/7 Checking TypeScript..."
npm run typecheck || { echo "❌ Typecheck failed"; exit 1; }
echo "✅ Typecheck passed"

echo ""
echo "3/7 Starting preview server..."
npm run preview &
PID=$!
sleep 3

echo ""
echo "4/7 Testing root route (/)..."
curl -sf http://localhost:4173 | grep -q "Agent" || { kill $PID 2>/dev/null; echo "❌ Root route failed"; exit 1; }
echo "✅ Root route renders"

echo ""
echo "5/7 Testing /tasks route..."
curl -sf http://localhost:4173/tasks | grep -q "Task" || { kill $PID 2>/dev/null; echo "❌ Tasks route failed"; exit 1; }
echo "✅ Tasks route renders"

echo ""
echo "6/7 Testing /sessions route..."
curl -sf http://localhost:4173/sessions | grep -q "Session" || { kill $PID 2>/dev/null; echo "❌ Sessions route failed"; exit 1; }
echo "✅ Sessions route renders"

echo ""
echo "7/7 Checking for mock data..."
AGENT_COUNT=$(curl -sf http://localhost:4173 | grep -c "agent-card" || echo "0")
if [ "$AGENT_COUNT" -lt 3 ]; then
  kill $PID 2>/dev/null
  echo "❌ Expected 3+ agent cards, found $AGENT_COUNT"
  exit 1
fi
echo "✅ Mock agents displayed"

kill $PID 2>/dev/null

echo ""
echo "======================================"
echo "✅ PHASE 1 PASSED - All criteria met"
echo "======================================"
echo ""
echo "Phase 2 (Data Model) may now begin."
