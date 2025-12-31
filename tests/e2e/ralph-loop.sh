#!/bin/bash

# =============================================================================
# Ralph Loop Orchestrator v2.0
# =============================================================================
# Spawns E2E-AGENT sessions that FIX CODE to make tests pass.
# Model: Claude Opus 4.5 (claude-opus-4-5-20250929)
# Based on auto-build-agent patterns: Fix first, then verify.
# =============================================================================

PROJECT_DIR="/Users/nenadatanasovski/idea_incurator"
E2E_DIR="$PROJECT_DIR/tests/e2e"
PROMPTS_DIR="$E2E_DIR/prompts"
MAX_ITERATIONS=500
ITERATION=0

cd "$PROJECT_DIR"

# Ensure directories exist
mkdir -p "$E2E_DIR/logs"
mkdir -p "$PROMPTS_DIR"

# File paths
PROMPT_FILE="$E2E_DIR/.current-prompt.txt"
PROGRESS_FILE="$E2E_DIR/progress.txt"
MEMORY_FILE="$E2E_DIR/agent-memory.json"
STATE_FILE="$E2E_DIR/test-state.json"
HANDOFF_FILE="$E2E_DIR/HANDOFF.md"

# Initialize progress file if needed
if [ ! -f "$PROGRESS_FILE" ]; then
    cat > "$PROGRESS_FILE" << 'PROGRESS_INIT'
# E2E Test Progress Notes
# ========================
# Each session appends its results here.
# This file persists across sessions to maintain continuity.

PROGRESS_INIT
fi

# =============================================================================
# FUNCTIONS
# =============================================================================

check_servers() {
    echo "[ORCHESTRATOR] Checking servers..."

    local frontend_ok=false
    local backend_ok=false

    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "[ORCHESTRATOR] Frontend: OK (port 3000)"
        frontend_ok=true
    else
        echo "[ORCHESTRATOR] Frontend: DOWN - starting..."
        cd "$PROJECT_DIR/frontend" && npm run dev > "$E2E_DIR/logs/frontend.log" 2>&1 &
        sleep 8
        cd "$PROJECT_DIR"
    fi

    if curl -s http://localhost:3001/api/profiles > /dev/null 2>&1; then
        echo "[ORCHESTRATOR] Backend: OK (port 3001)"
        backend_ok=true
    else
        echo "[ORCHESTRATOR] Backend: DOWN - starting..."
        npm run server > "$E2E_DIR/logs/backend.log" 2>&1 &
        sleep 5
    fi

    # Verify both are up
    sleep 2
    if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "[ORCHESTRATOR] WARNING: Frontend still not responding"
    fi
    if ! curl -s http://localhost:3001/api/profiles > /dev/null 2>&1; then
        echo "[ORCHESTRATOR] WARNING: Backend still not responding"
    fi
}

get_summary() {
    local passed=$(jq '.summary.passed // 0' "$STATE_FILE" 2>/dev/null || echo 0)
    local total=$(jq '.summary.total // 64' "$STATE_FILE" 2>/dev/null || echo 64)
    local blocked=$(jq '.summary.blocked // 0' "$STATE_FILE" 2>/dev/null || echo 0)
    local pending=$(jq '.summary.pending // 64' "$STATE_FILE" 2>/dev/null || echo 64)
    echo "Passed: $passed | Blocked: $blocked | Pending: $pending | Total: $total"
}

get_next_test() {
    jq -r '.tests[] | select(.status == "pending") | .id' "$STATE_FILE" 2>/dev/null | head -1
}

get_blocked_count() {
    jq '.summary.blocked // 0' "$STATE_FILE" 2>/dev/null || echo 0
}

generate_prompt() {
    local next_test="$1"
    local iteration="$2"

    # Read the E2E-AGENT prompt template
    if [ -f "$PROMPTS_DIR/E2E-AGENT.md" ]; then
        cat "$PROMPTS_DIR/E2E-AGENT.md"
    else
        # Fallback to inline prompt
        cat << 'AGENT_PROMPT'
# E2E-AGENT Session

You are testing the Ideation Agent application.

## CRITICAL: Get Your Bearings First

1. Read tests/e2e/agent-memory.json for schema info
2. Read tests/e2e/test-state.json for current progress
3. Read tests/e2e/HANDOFF.md for context from last session

## Your Task

Execute the assigned test. If it fails, diagnose WHY before retrying.
Fix bugs when found. Update state when done.

## Rules

- ONE test at a time
- Diagnose failures, don't blind retry
- Use correct schema (agent-memory.json)
- Event-based waits, not setTimeout stacking
- Single browser tab, don't proliferate sessions
AGENT_PROMPT
    fi

    # Add session-specific context
    cat << CONTEXT_EOF

---

## THIS SESSION

- **Iteration:** $iteration
- **Next Test:** $next_test
- **Date:** $(date '+%Y-%m-%d %H:%M:%S')

## Files to Read First

1. \`tests/e2e/agent-memory.json\` - Schema, patterns, known bugs
2. \`tests/e2e/test-state.json\` - Current test status
3. \`tests/e2e/HANDOFF.md\` - Context from previous session
4. \`docs/specs/ideation-agent/E2E-TEST-PLAN.md\` - Test definitions

## Begin

Start by running STEP 1: GET YOUR BEARINGS from the agent prompt.
Then execute test: **$next_test**
CONTEXT_EOF
}

run_agent() {
    local log_file="$1"
    local next_test="$2"
    local iteration="$3"

    echo "[ORCHESTRATOR] Generating prompt for $next_test..."
    generate_prompt "$next_test" "$iteration" > "$PROMPT_FILE"

    echo "[ORCHESTRATOR] Running E2E-AGENT..."
    echo "" >> "$log_file"
    echo "==========================================" >> "$log_file"
    echo "E2E-AGENT OUTPUT" >> "$log_file"
    echo "==========================================" >> "$log_file"
    echo "" >> "$log_file"

    # Capture state hash before
    local state_before=$(md5 -q "$STATE_FILE" 2>/dev/null || md5sum "$STATE_FILE" | cut -d' ' -f1)

    # Run claude with Opus 4.5 and appropriate tools
    local output_file="$log_file.output"
    timeout 1800 claude -p \
        --model "claude-opus-4-5-20250929" \
        --allowedTools "mcp__puppeteer__*,Read,Write,Edit,Glob,Grep,Bash,TodoWrite" \
        < "$PROMPT_FILE" 2>&1 | tee "$output_file"

    local exit_code=$?

    # Capture output
    cat "$output_file" >> "$log_file" 2>/dev/null
    rm -f "$output_file"

    # Check state hash after
    local state_after=$(md5 -q "$STATE_FILE" 2>/dev/null || md5sum "$STATE_FILE" | cut -d' ' -f1)

    echo "" >> "$log_file"
    echo "==========================================" >> "$log_file"
    echo "Exit code: $exit_code" >> "$log_file"
    echo "State changed: $([ "$state_before" != "$state_after" ] && echo 'YES' || echo 'NO')" >> "$log_file"
    echo "==========================================" >> "$log_file"

    # Evaluate result
    if [ $exit_code -eq 124 ]; then
        echo "[ORCHESTRATOR] Agent timed out (30 min limit)"
        return 1
    fi

    if [ "$state_before" = "$state_after" ]; then
        echo "[ORCHESTRATOR] WARNING: State not updated"
        # Don't fail - agent might have been investigating
        return 0
    fi

    return 0
}

update_handoff() {
    local next_test="$1"
    local iteration="$2"
    local summary=$(get_summary)

    cat > "$HANDOFF_FILE" << HANDOFF_EOF
# E2E Test Handoff

## Current State
- **Iteration:** $iteration
- **Progress:** $summary
- **Updated:** $(date '+%Y-%m-%d %H:%M:%S')

## Next Test
**$next_test**

## For Next Agent

1. Read \`agent-memory.json\` for schema (avoid wrong column names)
2. Read \`test-state.json\` for full context
3. Execute the test above
4. Diagnose failures before retrying
5. Update state and this handoff when done

## Schema Quick Reference

\`\`\`sql
-- Sessions (NOT created_at, use started_at)
SELECT id, status, started_at, message_count FROM ideation_sessions;

-- Messages (created_at is correct here)
SELECT id, role, content, created_at FROM ideation_messages;
\`\`\`

## Known Issues

$(jq -r '.blockedTests[] | "- \(.testId): \(.description)"' "$STATE_FILE" 2>/dev/null || echo "- None")
HANDOFF_EOF
}

# =============================================================================
# MAIN LOOP
# =============================================================================

echo ""
echo "=========================================="
echo "   RALPH LOOP v2.0 - E2E TESTING"
echo "=========================================="
echo ""
echo "Project: $PROJECT_DIR"
echo "Model: Claude Opus 4.5 (claude-opus-4-5-20250929)"
echo "Mode: FIX CODE to make tests pass"
echo "Max Iterations: $MAX_ITERATIONS"
echo ""

check_servers

echo ""
echo "Initial state: $(get_summary)"
echo ""

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    LOG_FILE="$E2E_DIR/logs/run-$ITERATION-$(date +%s).log"

    # Find next test
    NEXT_TEST=$(get_next_test)

    if [ -z "$NEXT_TEST" ]; then
        echo ""
        echo "=========================================="
        echo "   ALL TESTS COMPLETE!"
        echo "=========================================="
        echo ""
        echo "Final Results: $(get_summary)"
        rm -f "$PROMPT_FILE"
        exit 0
    fi

    echo ""
    echo "=========================================="
    echo "[ITERATION $ITERATION] $TIMESTAMP"
    echo "=========================================="
    echo "Next Test: $NEXT_TEST"
    echo ""

    # Log header
    cat > "$LOG_FILE" << LOG_HEADER
==========================================
RALPH LOOP - ITERATION $ITERATION
==========================================
Time: $TIMESTAMP
Test: $NEXT_TEST
State: $(get_summary)
==========================================

LOG_HEADER

    # Update handoff for this iteration
    update_handoff "$NEXT_TEST" "$ITERATION"

    # Run the agent
    run_agent "$LOG_FILE" "$NEXT_TEST" "$ITERATION"

    echo ""
    echo "Session complete. State: $(get_summary)"

    # Check if done
    PENDING=$(jq '.summary.pending // 64' "$STATE_FILE" 2>/dev/null || echo 64)
    if [ "$PENDING" -eq 0 ]; then
        echo ""
        echo "No more pending tests!"
        break
    fi

    # Brief pause between iterations
    sleep 3
done

echo ""
echo "=========================================="
echo "   FINAL RESULTS"
echo "=========================================="
echo ""
echo "$(get_summary)"
echo ""
echo "Blocked tests:"
jq -r '.blockedTests[] | "  - \(.testId): \(.description)"' "$STATE_FILE" 2>/dev/null || echo "  None"
echo ""

rm -f "$PROMPT_FILE"
