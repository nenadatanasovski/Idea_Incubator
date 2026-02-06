#!/bin/bash
# E2E Test Runner for Parent Harness
# 
# This script:
# 1. Starts the backend API
# 2. Starts the frontend dev server
# 3. Waits for both to be ready
# 4. Runs E2E tests
# 5. Cleans up

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🧪 Parent Harness E2E Test Runner"
echo "================================="

# Cleanup function
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  exit $EXIT_CODE
}
trap cleanup EXIT

# Start backend
echo ""
echo "📦 Starting backend API..."
cd "$ROOT_DIR/orchestrator"

# Run migration and seed if needed
if [ ! -f "$ROOT_DIR/data/harness.db" ]; then
  echo "   Running migrations..."
  npm run migrate
  echo "   Seeding data..."
  npm run seed
fi

npm run dev &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend
echo "   Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:3333/health > /dev/null 2>&1; then
    echo "   ✅ Backend ready!"
    break
  fi
  sleep 1
done

# Start frontend
echo ""
echo "🎨 Starting frontend..."
cd "$ROOT_DIR/dashboard"
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Wait for frontend
echo "   Waiting for frontend to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✅ Frontend ready!"
    break
  fi
  sleep 1
done

# Run tests
echo ""
echo "🧪 Running E2E tests..."
echo ""

npm run test:e2e
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ All tests passed!"
else
  echo ""
  echo "❌ Some tests failed (exit code: $EXIT_CODE)"
fi
