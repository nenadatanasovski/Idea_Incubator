# PHASE2-TASK-01: Spec Agent v0.1 - Task Breakdown

> **Specification:** docs/specs/PHASE2-TASK-01-spec-agent-v0.1.md
> **Priority:** P0 (Critical Path - Phase 2)
> **Prerequisites:** Parent Harness database, Orchestrator infrastructure
> **Estimated Total Effort:** 10-15 hours (1-2 days with 2 agents)

---

## Wave Analysis

```
Wave 1: SPEC-001, SPEC-002 (foundation - no dependencies)
Wave 2: SPEC-003, SPEC-004, SPEC-005 (API layer - depends on Wave 1)
Wave 3: SPEC-006, SPEC-007 (orchestrator integration - depends on Wave 2)
Wave 4: SPEC-008, SPEC-009 (database persistence - depends on Wave 3)
Wave 5: SPEC-010, SPEC-011 (validation & testing - depends on Wave 4)
Wave 6: SPEC-012 (documentation - depends on all)
```

**Parallelization Opportunities:**

- Wave 1: Both tasks can run in parallel (independent modules)
- Wave 2: Three API-related tasks can run in parallel
- Wave 3: Orchestrator integration depends on APIs, sequential
- Wave 4: Database tasks can run in parallel
- Wave 5: Testing tasks can run in parallel

**Estimated Timeline:**

- Serial execution: ~12 hours
- Parallel execution (2 agents): ~7 hours
- With review/iteration: ~10 hours total

---

## Tasks

```yaml
# ==============================================================================
# WAVE 1: Database Schema & Foundation (Parallel)
# ==============================================================================

- id: SPEC-001
  title: "Create briefs database table"
  phase: 1_prepare
  action: CREATE
  file: "parent-harness/database/migrations/026_add_briefs_table.sql"
  status: pending
  wave: 1

  requirements:
    - "Create briefs table with id, title, problem, solution, complexity, source, status columns"
    - "Create specifications table with brief_id foreign key, spec_path, content, tokens_used"
    - "Add CHECK constraints for complexity enum (LOW, MEDIUM, HIGH, VERY_HIGH)"
    - "Add CHECK constraints for source enum (user, planning_agent, build_agent)"
    - "Add CHECK constraints for status enum (pending_spec, spec_in_progress, spec_complete, spec_failed)"
    - "Create indexes on briefs(status), briefs(source), briefs(created_at)"
    - "Create indexes on specifications(brief_id), specifications(created_at)"
    - "Add ON DELETE CASCADE for foreign key from specifications to briefs"

  file_impacts:
    - path: "parent-harness/database/migrations/026_add_briefs_table.sql"
      action: CREATE
    - path: "parent-harness/data/harness.db"
      action: UPDATE

  gotchas:
    - "GOTCHA-SQL-001: Enable foreign keys with PRAGMA foreign_keys=ON"
    - "GOTCHA-SQL-002: Use TEXT for datetime columns with DEFAULT (datetime('now'))"
    - "GOTCHA-SQL-003: JSON metadata stored as TEXT, validate on app side"

  validation:
    command: 'sqlite3 parent-harness/data/harness.db ".schema briefs"'
    expected: "exit code 0, table structure matches specification"

  depends_on: []

# ------------------------------------------------------------------------------

- id: SPEC-002
  title: "Create brief database module"
  phase: 1_prepare
  action: CREATE
  file: "parent-harness/orchestrator/src/db/briefs.ts"
  status: pending
  wave: 1

  requirements:
    - "Export Brief interface matching database schema"
    - "Implement generateBriefId() - generates BRIEF-001 format"
    - "Implement createBrief(brief) - inserts and returns created brief"
    - "Implement getBriefById(id) - returns brief or undefined"
    - "Implement getBriefs(filters) - supports status/source filtering"
    - "Implement updateBriefStatus(id, status) - updates status and updated_at"
    - "Use parameterized queries to prevent SQL injection"
    - "Import getDb from './index.js'"

  file_impacts:
    - path: "parent-harness/orchestrator/src/db/briefs.ts"
      action: CREATE
    - path: "parent-harness/orchestrator/src/db/index.ts"
      action: READ

  gotchas:
    - "GOTCHA-TS-001: Use .js extension in imports (TypeScript ESM requirement)"
    - "GOTCHA-TS-002: Mark return types explicitly (Brief | undefined, not just Brief)"
    - "GOTCHA-DB-001: Always use prepared statements, never string concatenation"

  validation:
    command: "npx tsc --noEmit"
    expected: "exit code 0, no type errors"

  depends_on: []

# ==============================================================================
# WAVE 2: API Layer (Parallel)
# ==============================================================================

- id: SPEC-003
  title: "Create brief API endpoints"
  phase: 2_implement
  action: CREATE
  file: "parent-harness/orchestrator/src/api/briefs.ts"
  status: pending
  wave: 2

  requirements:
    - "Implement POST /api/briefs - create new brief"
    - "Validate required fields (title, problem, solution)"
    - "Generate brief ID via briefs.generateBriefId()"
    - "Set default complexity='MEDIUM', source='user', status='pending_spec'"
    - "Return 201 Created with brief object"
    - "Implement GET /api/briefs/:id - retrieve brief by ID"
    - "Return 404 if brief not found"
    - "Implement GET /api/briefs - list all briefs with optional filters"
    - "Support query params: ?status=pending_spec&source=user"
    - "Use Express Router pattern"

  file_impacts:
    - path: "parent-harness/orchestrator/src/api/briefs.ts"
      action: CREATE
    - path: "parent-harness/orchestrator/src/db/briefs.ts"
      action: READ

  gotchas:
    - "GOTCHA-API-001: Always validate input before database operations"
    - "GOTCHA-API-002: Use proper HTTP status codes (201 for create, 404 for not found)"
    - "GOTCHA-API-003: Wrap async handlers in try-catch, return 500 on errors"

  validation:
    command: 'curl -X POST http://localhost:3333/api/briefs -H "Content-Type: application/json" -d "{\"title\":\"test\",\"problem\":\"test\",\"solution\":\"test\"}"'
    expected: "HTTP 201, response contains brief ID (BRIEF-001)"

  depends_on: [SPEC-001, SPEC-002]

# ------------------------------------------------------------------------------

- id: SPEC-004
  title: "Register brief API routes in server"
  phase: 2_implement
  action: MODIFY
  file: "parent-harness/orchestrator/src/server.ts"
  status: pending
  wave: 2

  requirements:
    - "Import briefsRouter from './api/briefs.js'"
    - "Register route: app.use('/api/briefs', briefsRouter)"
    - "Place after existing API routes (tasks, agents, sessions)"
    - "Ensure error middleware applied to all routes"

  file_impacts:
    - path: "parent-harness/orchestrator/src/server.ts"
      action: UPDATE
    - path: "parent-harness/orchestrator/src/api/briefs.ts"
      action: READ

  gotchas:
    - "GOTCHA-SERVER-001: Order matters - register routes before error middleware"
    - "GOTCHA-SERVER-002: Use .js extension in import paths"

  validation:
    command: "curl http://localhost:3333/api/briefs"
    expected: "HTTP 200, empty array []"

  depends_on: [SPEC-003]

# ------------------------------------------------------------------------------

- id: SPEC-005
  title: "Create Spec Agent spawner"
  phase: 2_implement
  action: CREATE
  file: "parent-harness/orchestrator/src/spawner/spec-agent-spawner.ts"
  status: pending
  wave: 2

  requirements:
    - "Export spawnSpecAgent(brief) async function"
    - "Write brief to temp file /tmp/brief-{brief.id}.json"
    - "Spawn Node process running agents/specification/cli.js"
    - "Pass --brief and --output-dir flags"
    - "Use spawn from child_process, set stdio: 'inherit'"
    - "Return Promise that resolves on exit code 0, rejects on error"
    - "Clean up temp file on both success and failure"
    - "Handle process errors (ENOENT, EPERM)"

  file_impacts:
    - path: "parent-harness/orchestrator/src/spawner/spec-agent-spawner.ts"
      action: CREATE
    - path: "parent-harness/orchestrator/src/db/briefs.ts"
      action: READ

  gotchas:
    - "GOTCHA-SPAWN-001: Use path.join for cross-platform compatibility"
    - "GOTCHA-SPAWN-002: Always clean up temp files in finally block"
    - "GOTCHA-SPAWN-003: Check process.cwd() matches project root"

  validation:
    command: "Unit test with mock brief"
    expected: "Process spawns successfully, temp file cleaned up"

  depends_on: [SPEC-002]

# ==============================================================================
# WAVE 3: Orchestrator Integration (Sequential)
# ==============================================================================

- id: SPEC-006
  title: "Create Spec Agent CLI"
  phase: 2_implement
  action: CREATE
  file: "agents/specification/cli.ts"
  status: pending
  wave: 3

  requirements:
    - "Add shebang: #!/usr/bin/env node"
    - "Parse --brief and --output-dir flags using parseArgs from util"
    - "Load brief from JSON file (fs.readFileSync + JSON.parse)"
    - "Create SpecAgent instance with model=opus, maxTokens=16384"
    - "Call agent.generateSpec({ briefPath, ideaSlug, skipQuestions: false })"
    - "Write spec to {output-dir}/PHASE2-TASK-{brief.id}-{slug}.md"
    - "Log: tokens used, task count, spec path"
    - "Exit with code 0 on success, code 1 on error"
    - "Make file executable (chmod +x)"

  file_impacts:
    - path: "agents/specification/cli.ts"
      action: CREATE
    - path: "agents/specification/core.ts"
      action: READ

  gotchas:
    - "GOTCHA-CLI-001: Use parseArgs from 'util' (Node 18+), not third-party lib"
    - "GOTCHA-CLI-002: Validate --brief path exists before processing"
    - "GOTCHA-CLI-003: Wrap main() in try-catch, log errors to stderr"

  validation:
    command: "node agents/specification/cli.js --brief /tmp/test.json --output-dir /tmp"
    expected: "Spec file created in /tmp, exit code 0"

  depends_on: [SPEC-004, SPEC-005]

# ------------------------------------------------------------------------------

- id: SPEC-007
  title: "Integrate Spec Agent into orchestrator tick loop"
  phase: 3_integrate
  action: MODIFY
  file: "parent-harness/orchestrator/src/orchestrator/index.ts"
  status: pending
  wave: 3

  requirements:
    - "Import briefs from '../db/briefs.js'"
    - "Import spawnSpecAgent from '../spawner/spec-agent-spawner.js'"
    - "Add checkPendingBriefs() function to tick()"
    - "Query briefs with status='pending_spec'"
    - "For each brief: update status='spec_in_progress', spawn Spec Agent"
    - "Use crashProtect wrapper for error handling"
    - "On success: update brief status='spec_complete'"
    - "On failure: update brief status='spec_failed', log error"
    - "Avoid blocking orchestrator - spawn async, don't await"

  file_impacts:
    - path: "parent-harness/orchestrator/src/orchestrator/index.ts"
      action: UPDATE
    - path: "parent-harness/orchestrator/src/db/briefs.ts"
      action: READ
    - path: "parent-harness/orchestrator/src/spawner/spec-agent-spawner.ts"
      action: READ

  gotchas:
    - "GOTCHA-ORCH-001: Don't block tick loop - spawn async and continue"
    - "GOTCHA-ORCH-002: Use crashProtect to prevent orchestrator crashes"
    - "GOTCHA-ORCH-003: Log all brief processing (start, success, failure)"

  validation:
    command: "Create brief via API, wait 30s, check orchestrator logs"
    expected: "Logs show 📝 Generating spec for brief BRIEF-001"

  depends_on: [SPEC-006]

# ==============================================================================
# WAVE 4: Database Persistence (Parallel)
# ==============================================================================

- id: SPEC-008
  title: "Persist specifications to database"
  phase: 3_integrate
  action: MODIFY
  file: "agents/specification/cli.ts"
  status: pending
  wave: 4

  requirements:
    - "After spec generation, connect to parent-harness database"
    - "Insert into specifications table (id, brief_id, spec_path, content, tokens_used, task_count)"
    - "Use uuid for spec ID"
    - "Read spec content from file system (fs.readFileSync)"
    - "Extract metadata from output (tokens_used, task_count)"
    - "Use transaction for atomicity"
    - "Handle unique constraint violations (brief already has spec)"

  file_impacts:
    - path: "agents/specification/cli.ts"
      action: UPDATE
    - path: "parent-harness/orchestrator/src/db/index.ts"
      action: READ

  gotchas:
    - "GOTCHA-DB-002: Use transactions for multi-step database operations"
    - "GOTCHA-DB-003: Handle SQLITE_CONSTRAINT errors gracefully"

  validation:
    command: 'sqlite3 parent-harness/data/harness.db "SELECT * FROM specifications"'
    expected: "Spec record present with correct brief_id"

  depends_on: [SPEC-007]

# ------------------------------------------------------------------------------

- id: SPEC-009
  title: "Persist tasks to database"
  phase: 3_integrate
  action: MODIFY
  file: "agents/specification/cli.ts"
  status: pending
  wave: 4

  requirements:
    - "After task generation, insert tasks into tasks table"
    - "For each task: set brief_id, status='pending', assigned_agent=NULL"
    - "Insert task_dependencies (many-to-many relationship)"
    - "Use transaction for batch insert"
    - "Validate task dependencies exist before inserting"
    - "Log task count and wave distribution"

  file_impacts:
    - path: "agents/specification/cli.ts"
      action: UPDATE
    - path: "parent-harness/orchestrator/src/db/tasks.ts"
      action: READ

  gotchas:
    - "GOTCHA-DB-004: Validate all dependency task IDs exist before insert"
    - "GOTCHA-DB-005: Use batch inserts for performance (single transaction)"

  validation:
    command: 'sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM tasks WHERE brief_id=''BRIEF-001''"'
    expected: "Count matches spec task count"

  depends_on: [SPEC-008]

# ==============================================================================
# WAVE 5: Validation & Testing (Parallel)
# ==============================================================================

- id: SPEC-010
  title: "Add QA validation for specs (optional)"
  phase: 4_validate
  action: CREATE
  file: "parent-harness/orchestrator/src/qa/spec-validator.ts"
  status: pending
  wave: 5

  requirements:
    - "Export validateSpec(specPath) function"
    - "Parse markdown spec file (use remark/unified)"
    - "Check for required sections: Overview, Requirements, Technical Design, Pass Criteria, Dependencies"
    - "Validate pass criteria format (must include verification methods)"
    - "Check for vague language (should, might, consider, etc.)"
    - "Return validation report { valid, warnings, errors }"
    - "Integration point: call from orchestrator after spec generation"

  file_impacts:
    - path: "parent-harness/orchestrator/src/qa/spec-validator.ts"
      action: CREATE

  gotchas:
    - "GOTCHA-PARSE-001: Use remark-parse for markdown parsing, not regex"
    - "GOTCHA-VALID-001: Allow warnings but block on critical errors"

  validation:
    command: "Unit test with sample spec (valid and invalid)"
    expected: "Valid spec passes, invalid spec returns errors"

  depends_on: [SPEC-009]

# ------------------------------------------------------------------------------

- id: SPEC-011
  title: "Write integration test for full pipeline"
  phase: 4_validate
  action: CREATE
  file: "tests/integration/spec-agent-pipeline.test.ts"
  status: pending
  wave: 5

  requirements:
    - "Test: Submit brief → Spec generated → Tasks created → Build Agent assigned"
    - "Use test database (harness-test.db)"
    - "Mock Anthropic API calls (avoid token costs)"
    - "Verify end-to-end timing (< 90s)"
    - "Test error scenarios: invalid brief, spec generation failure"
    - "Test agent-created tasks skip spec phase"
    - "Clean up test data (briefs, specs, tasks) after test"

  file_impacts:
    - path: "tests/integration/spec-agent-pipeline.test.ts"
      action: CREATE
    - path: "parent-harness/orchestrator/src/api/briefs.ts"
      action: READ

  gotchas:
    - "GOTCHA-TEST-001: Always use test database, never production database"
    - "GOTCHA-TEST-002: Mock external API calls (Anthropic) to avoid costs"
    - "GOTCHA-TEST-003: Clean up test data in afterEach hook"

  validation:
    command: "npm test -- spec-agent-pipeline"
    expected: "All assertions pass, no test failures"

  depends_on: [SPEC-009]

# ==============================================================================
# WAVE 6: Documentation (Sequential)
# ==============================================================================

- id: SPEC-012
  title: "Update documentation"
  phase: 5_document
  action: MODIFY
  file: "parent-harness/README.md"
  status: pending
  wave: 6

  requirements:
    - "Add section: 'Spec Agent Workflow' under Architecture"
    - "Document API endpoints: POST /api/briefs, GET /api/briefs/:id"
    - "Explain brief → spec → tasks pipeline with ASCII diagram"
    - "Include example usage: curl commands for brief submission"
    - "Document task status lifecycle: pending_spec → spec_in_progress → spec_complete → ready"
    - "Add troubleshooting section: spec generation failures, timeout handling"
    - "Link to PHASE2-TASK-01-spec-agent-v0.1.md for full specification"

  file_impacts:
    - path: "parent-harness/README.md"
      action: UPDATE
    - path: "docs/specs/PHASE2-TASK-01-spec-agent-v0.1.md"
      action: READ

  gotchas:
    - "GOTCHA-DOC-001: Keep examples concise and runnable (actual curl commands)"
    - "GOTCHA-DOC-002: Update table of contents if adding new sections"

  validation:
    command: "Read README, verify clarity and correctness"
    expected: "New users can understand Spec Agent workflow"

  depends_on: [SPEC-010, SPEC-011]
```

---

## Summary

**Total Tasks:** 12
**Waves:** 6
**Critical Path:** SPEC-001 → SPEC-002 → SPEC-003 → SPEC-004 → SPEC-006 → SPEC-007 → SPEC-008 → SPEC-009 → SPEC-011 → SPEC-012

**Estimated Effort:**

- Wave 1: 2 hours (parallel: 1 hour with 2 agents)
- Wave 2: 3 hours (parallel: 1.5 hours with 2 agents)
- Wave 3: 3 hours (sequential)
- Wave 4: 2 hours (parallel: 1 hour with 2 agents)
- Wave 5: 3 hours (parallel: 1.5 hours with 2 agents)
- Wave 6: 1 hour

**Total Serial:** ~14 hours
**Total Parallel (2 agents):** ~9 hours

---

## Completion Checklist

### Phase 1: Prepare ✓

- [ ] SPEC-001: Database migration created and applied
- [ ] SPEC-002: Brief database module implemented with type safety

### Phase 2: Implement ✓

- [ ] SPEC-003: Brief API endpoints functional (POST, GET)
- [ ] SPEC-004: API routes registered in server
- [ ] SPEC-005: Spec Agent spawner implemented
- [ ] SPEC-006: Spec Agent CLI accepts flags and generates specs

### Phase 3: Integrate ✓

- [ ] SPEC-007: Orchestrator detects pending_spec briefs and spawns Spec Agent
- [ ] SPEC-008: Specifications persisted to database
- [ ] SPEC-009: Tasks persisted to database with dependencies

### Phase 4: Validate ✓

- [ ] SPEC-010: QA spec validator implemented
- [ ] SPEC-011: Integration test passes (brief → spec → tasks → assignment)

### Phase 5: Document ✓

- [ ] SPEC-012: README updated with Spec Agent workflow

### Final Validation ✓

- [ ] All 12 tasks completed
- [ ] TypeScript compilation passes (npx tsc --noEmit)
- [ ] Integration test passes (npm test -- spec-agent-pipeline)
- [ ] Manual test: Submit brief via API → Spec generated in < 90s
- [ ] Manual test: Build Agent receives tasks from Spec Agent
- [ ] No regressions: Existing tests still pass

---

## Risk Mitigation

| Risk                          | Task               | Mitigation                                                    |
| ----------------------------- | ------------------ | ------------------------------------------------------------- |
| Spec generation timeout       | SPEC-006           | Add timeout handling, fail gracefully with spec_failed status |
| Database locking              | SPEC-008, SPEC-009 | Use WAL mode (already enabled), batch inserts in transactions |
| Build Agent can't parse specs | SPEC-011           | Integration test validates Build Agent consumption            |
| Token costs exceed budget     | SPEC-006           | Mock Anthropic API in tests, monitor production usage         |

---

## Next Steps

1. **Approval:** Review and approve this task breakdown
2. **Assignment:** Assign tasks to Build Agent(s)
   - Option A: Single Build Agent (sequential, ~14 hours)
   - Option B: Two Build Agents (parallel, ~9 hours) **RECOMMENDED**
3. **Execution:** Build Agents execute tasks wave-by-wave
4. **Validation:** QA Agent validates each wave before proceeding
5. **Integration:** Test full pipeline with real brief submission

---

## References

- **Specification:** docs/specs/PHASE2-TASK-01-spec-agent-v0.1.md
- **Parent Harness Schema:** parent-harness/database/schema.sql
- **Orchestrator:** parent-harness/orchestrator/src/orchestrator/index.ts
- **Existing Spec Agent:** agents/specification/core.ts
- **Agent Metadata:** parent-harness/orchestrator/src/agents/metadata.ts (lines 78-100)
