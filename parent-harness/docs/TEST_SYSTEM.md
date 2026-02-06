# Test Record System

Complete specification for test definitions, execution, and self-healing.

## Core Concept

Tests are not just recorded - they trigger a **self-healing loop**:
```
Test fails → Agent analyzes failure → Fixes code → Retry → Repeat until pass
```

## Test Types

| Type | Purpose | Speed | Runner |
|------|---------|-------|--------|
| unit | Isolated function tests | Fast | Jest/Vitest |
| integration | API/service tests | Medium | Jest |
| e2e | Browser automation | Slow | Playwright |
| verification | Phase gate checks | Medium | Bash scripts |
| lint | Code quality | Fast | ESLint/Prettier |
| typecheck | Type safety | Fast | tsc |

## Data Model

### Test Definitions

```
test_suites
├── id, name, description
├── type (unit|integration|e2e|verification|lint|typecheck)
├── source (code|phases|task_agent|planning_agent)
├── file_path (for code-based tests)
├── phase (for verification tests)
└── created_by, created_at

test_cases
├── id, suite_id
├── name, description
├── priority (P0-P4)
├── timeout_ms
├── retry_limit
├── depends_on (JSON array of test_case IDs)
├── tags (JSON array)
└── enabled, created_at

test_steps
├── id, case_id
├── sequence (order within case)
├── name, description
├── command (what to execute)
├── expected_exit_code
├── expected_output_contains
├── timeout_ms
└── created_at

test_assertions
├── id, step_id
├── sequence
├── assertion_type (equals|contains|matches|exists|truthy)
├── target (what to check)
├── expected_value
├── error_message
└── created_at
```

### Test Execution

```
test_runs
├── id
├── trigger (manual|cron|task_completion|phase_gate|ci)
├── triggered_by (agent_id or 'human')
├── started_at, completed_at
├── status (running|passed|failed|partial)
├── suites_run, suites_passed, suites_failed
├── total_duration_ms
└── session_id

test_suite_results
├── id, run_id, suite_id
├── status (running|passed|failed|skipped)
├── started_at, completed_at
├── cases_run, cases_passed, cases_failed
├── duration_ms
├── retry_count
└── fix_attempts (JSON array of fix session IDs)

test_case_results
├── id, suite_result_id, case_id
├── status (running|passed|failed|skipped|fixing)
├── started_at, completed_at
├── steps_run, steps_passed, steps_failed
├── duration_ms
├── retry_count
├── error_message
├── stack_trace
└── fix_session_id (if being fixed)

test_step_results
├── id, case_result_id, step_id
├── status (running|passed|failed|skipped)
├── started_at, completed_at
├── actual_exit_code
├── actual_output (truncated)
├── full_output_path (file path for full log)
├── duration_ms
├── assertions_run, assertions_passed, assertions_failed
└── screenshots (JSON array of paths, for E2E)

test_assertion_results
├── id, step_result_id, assertion_id
├── status (passed|failed)
├── actual_value
├── expected_value
├── error_message
└── timestamp
```

### Test-Task Linking

```
task_test_links
├── id
├── task_id
├── test_case_id
├── link_type (pass_criteria|acceptance|regression|smoke)
├── required_for_completion (boolean)
└── created_at

test_dependencies
├── id
├── test_case_id
├── depends_on_test_id
├── dependency_type (must_pass|should_pass|blocks)
└── created_at
```

### Fix Tracking

```
test_fix_attempts
├── id
├── case_result_id
├── agent_id
├── session_id
├── started_at, completed_at
├── status (attempting|fixed|failed|escalated)
├── analysis (what the agent found wrong)
├── fix_description (what was changed)
├── files_modified (JSON array)
├── commits (JSON array)
└── retry_after_fix (boolean - did it pass after?)
```

## Self-Healing Loop

```
┌─────────────────────────────────────────────────────────┐
│                    TEST EXECUTION                        │
│                                                          │
│  1. Run test suite                                       │
│  2. For each test case:                                  │
│     a. Check dependencies (skip if deps failed)          │
│     b. Run test steps                                    │
│     c. Record assertions                                 │
│     d. If PASSED → record, continue                      │
│     e. If FAILED → enter fix loop                        │
│                                                          │
│  ┌─────────── FIX LOOP ───────────┐                     │
│  │                                 │                     │
│  │  1. Analyze failure             │                     │
│  │  2. Agent attempts fix          │                     │
│  │  3. Record fix attempt          │                     │
│  │  4. Re-run test                 │                     │
│  │  5. If PASSED → exit loop       │                     │
│  │  6. If FAILED:                  │                     │
│  │     - retry_count < limit?      │                     │
│  │       → back to step 1          │                     │
│  │     - else → escalate to human  │                     │
│  │                                 │                     │
│  └─────────────────────────────────┘                     │
│                                                          │
│  3. Aggregate results                                    │
│  4. Update dashboard                                     │
│  5. Prune history > 2 weeks                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Test Sources

### 1. Code-Based Tests
```typescript
// Discovered from test files
// Jest: **/*.test.ts, **/*.spec.ts
// Playwright: tests/**/*.spec.ts
```

### 2. PHASES.md Pass Criteria
```markdown
**Pass Criteria:**
- [ ] `npm run build` succeeds
→ Creates test_case with step: "npm run build", assertion: exit_code = 0
```

### 3. Task Agent Created
```typescript
// When task has acceptance criteria
await taskAgent.createTestsFromCriteria(task);
// Generates test_cases linked to task
```

### 4. Planning Agent Created
```typescript
// When Planning Agent identifies coverage gap
await planningAgent.createRegressionTest({
  description: "Ensure login flow works after auth changes",
  steps: [...]
});
```

## Dashboard View

```
┌─────────────────────────────────────────────────────────┐
│ TEST DASHBOARD                                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────────────────┐  ┌──────────────────┐              │
│ │ Last Run: 12:45  │  │ Pass Rate: 94.2% │              │
│ │ Duration: 3m 42s │  │ 892/947 passing  │              │
│ └──────────────────┘  └──────────────────┘              │
│                                                          │
│ By Type:                                                 │
│ ┌────────────┬────────┬────────┬────────┐               │
│ │ Type       │ Total  │ Pass   │ Fail   │               │
│ ├────────────┼────────┼────────┼────────┤               │
│ │ Unit       │ 542    │ 540    │ 2      │               │
│ │ Integration│ 128    │ 125    │ 3      │               │
│ │ E2E        │ 71     │ 68     │ 3      │               │
│ │ Lint       │ 156    │ 156    │ 0      │               │
│ │ Typecheck  │ 50     │ 50     │ 0      │               │
│ └────────────┴────────┴────────┴────────┘               │
│                                                          │
│ Failed Tests (8):                         [Auto-Fix ON] │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ❌ auth.test.ts > login flow > redirects after login│ │
│ │    Status: FIXING (attempt 2/5)                      │ │
│ │    Agent: Build Agent                                │ │
│ │    [View Log] [View Fix] [Skip]                      │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ ❌ api.test.ts > tasks > returns 404 for missing    │ │
│ │    Status: QUEUED FOR FIX                            │ │
│ │    [View Log] [Assign Agent]                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Recent Fix Successes (last 24h):                         │
│ ✅ user.test.ts - Fixed by Build Agent (2 attempts)     │
│ ✅ db.test.ts - Fixed by Build Agent (1 attempt)        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Retention Policy

- **Last 2 weeks** of test results kept
- Older results pruned automatically
- Aggregated stats (pass rate, trends) kept longer
- Failed tests with fix attempts kept until resolved

## Integration Points

### With Tasks
- Task completion requires linked tests to pass
- Task Agent creates tests from acceptance criteria
- Test failures can create bug tasks

### With Agents
- Build Agent fixes failing tests
- QA Agent runs verification tests
- Planning Agent creates regression tests

### With Phases
- Phase verification = special test suite
- Must pass before next phase
- Creates verification test records

### With CI
- Triggered on git push
- Results flow back to dashboard
- Failures trigger fix loop
