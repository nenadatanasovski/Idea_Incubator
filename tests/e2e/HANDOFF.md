# E2E Test Handoff

## Current State
- **Last Updated:** 2025-12-31 Session 3
- **Progress:** Passed: 22 | Blocked: 1 | Pending: 41 | Total: 64

## IMPORTANT FOR NEXT AGENT

### Code Fix Committed But NOT Verified

I fixed a bug for TEST-BI-006 but the browser session became unresponsive before I could verify it.

**What was fixed:**
- Backend was returning `ideaCandidate` but frontend expects `candidateUpdate`
- Changed server/routes/ideation.ts to return `candidateUpdate`
- Also added `confidence`, `viability`, and `risks` fields to the response
- This affects both `/api/ideation/message` and `/api/ideation/button` endpoints

**What you need to do:**
1. Navigate to http://localhost:3000/ideate
2. Start a session (click "Start Ideation Session" -> "Help me discover")
3. Interact with the conversation (click buttons, send messages about an idea)
4. Check if the "Idea Candidate" panel on the right updates with the idea title/summary

**If the panel updates:**
- Mark TEST-BI-006 as passed in test-state.json
- Progress becomes 23/64

**If the panel still doesn't update:**
- Check server logs: `tail -50 tests/e2e/logs/backend.log`
- The orchestrator may not be returning `candidateUpdate` - check `agents/ideation/orchestrator.ts`

## Known Issues

| Test | Bug | Description |
|------|-----|-------------|
| TEST-SL-008 | BUG-001 | Missing timeout message - UI silently redirects when session expired |

## Schema Quick Reference

```sql
-- Sessions: use started_at, NOT created_at
SELECT id, status, started_at, message_count FROM ideation_sessions;

-- Messages: use created_at, NOT timestamp
SELECT id, role, content, created_at FROM ideation_messages ORDER BY created_at;
```

## Key Patterns

**DO:**
- Use button clicks for initial interactions (more reliable)
- Wait for elements with event-based polling, not setTimeout
- Check API state via curl when UI is unclear
- Diagnose failures before retrying

**DON'T:**
- Stack multiple setTimeout waits
- Create new sessions for each retry
- Query `created_at` on sessions or `timestamp` on messages

## Files Structure

```
tests/e2e/
├── agent-memory.json    # Schema, patterns, known bugs
├── test-state.json      # Test status (source of truth)
├── HANDOFF.md           # This file
├── progress.txt         # Running log of all sessions
├── prompts/
│   ├── E2E-AGENT.md         # Main agent prompt
│   ├── DIAGNOSTIC-CHECKPOINT.md  # How to diagnose failures
│   └── WAITING-PATTERNS.md  # Event-based waiting patterns
└── logs/                # Detailed logs from each run
```

## Git History

```
1a4f937 Fix TEST-BI-006: Align candidateUpdate field name between backend and frontend
5bda881 Fix TEST-BI-002/003/004: Custom input, keyboard nav, multiple buttons
fc5c47a update
7974a59 Initial commit: Idea Incubator system
```
