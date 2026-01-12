# Validation Agent Brief

## Metadata

| Field | Value |
|-------|-------|
| **ID** | validation-agent |
| **Title** | Validation Agent |
| **Complexity** | medium |
| **Author** | Human |
| **Created** | 2026-01-11 |

---

## Problem

After the Build Agent generates code, there is no comprehensive validation system. Currently:

1. Build Agent runs basic validation commands per task
2. No holistic validation across the entire build
3. No graduated validation levels (quick vs thorough)
4. No integration with test suites
5. No security scanning
6. No code quality checks

We need an agent that validates build outputs at multiple levels of thoroughness, from quick smoke tests to full release validation.

---

## Solution

Validation Agent is a multi-level code validation system that:

1. **Runs graduated validation** from QUICK to RELEASE levels
2. **Integrates test suites** (vitest, playwright, etc.)
3. **Checks code quality** (TypeScript strict, linting)
4. **Performs security scanning** (dependency vulnerabilities)
5. **Validates integration** between components
6. **Reports results** through Communication Hub

Validation Agent can be invoked at different levels depending on context:
- QUICK: During development (< 30 seconds)
- STANDARD: Before commits (< 2 minutes)
- THOROUGH: Before merges (< 10 minutes)
- RELEASE: Before deployment (comprehensive)

---

## MVP Scope

**In Scope:**
- Define 4 validation levels (QUICK, STANDARD, THOROUGH, RELEASE)
- TypeScript compilation check (tsc --noEmit)
- Unit test runner integration (vitest)
- Basic security check (npm audit)
- Code coverage reporting
- Result aggregation and reporting
- Integration with Communication Hub for alerts
- Pass/fail determination with detailed output

**Out of Scope:**
- E2E test integration (playwright) - deferred to v0.2
- Performance benchmarking
- Visual regression testing
- Custom rule engine
- Historical trend analysis
- Auto-fix capabilities

---

## Constraints

1. Must not modify any source code
2. Must respect validation level time budgets
3. Must integrate with existing test infrastructure
4. Must use Communication Hub for reporting
5. Must provide machine-readable results (JSON)
6. Must support partial re-validation (only changed files)

---

## Success Criteria

1. QUICK validation completes in < 30 seconds
2. STANDARD validation completes in < 2 minutes
3. Correctly identifies TypeScript errors
4. Correctly runs and reports test results
5. Detects security vulnerabilities from npm audit
6. Reports through Communication Hub on failure
7. Returns structured JSON results

---

## Architecture Hints

```
Validation Agent Components:
├── validation-orchestrator.ts  - Main entry, level selection
├── level-configs.ts            - Define what runs at each level
├── typescript-validator.ts     - tsc --noEmit wrapper
├── test-runner.ts              - vitest integration
├── security-scanner.ts         - npm audit wrapper
├── coverage-reporter.ts        - Coverage analysis
├── result-aggregator.ts        - Combine all results
└── communication-reporter.ts   - Hub integration
```

**Validation Levels:**
```
QUICK (< 30s):
  - TypeScript compilation
  - Changed file tests only

STANDARD (< 2min):
  - TypeScript compilation
  - All unit tests
  - Basic lint check

THOROUGH (< 10min):
  - TypeScript strict mode
  - All unit tests
  - Integration tests
  - npm audit

RELEASE (comprehensive):
  - Everything in THOROUGH
  - Full coverage report
  - License compliance
  - Bundle size check
```

**Execution Flow:**
```
1. Receive validation request with level
2. Load level configuration
3. Run validators in parallel where possible
4. Aggregate results
5. Determine pass/fail
6. Report through Communication Hub
7. Return structured results
```

---

## Database Schema

```sql
-- Validation run tracking
CREATE TABLE IF NOT EXISTS validation_runs (
    id TEXT PRIMARY KEY,
    build_id TEXT,
    level TEXT NOT NULL,  -- QUICK, STANDARD, THOROUGH, RELEASE
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    passed INTEGER,  -- 0 or 1
    summary_json TEXT
);

-- Individual validator results
CREATE TABLE IF NOT EXISTS validator_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    validator_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    passed INTEGER,
    output TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES validation_runs(id)
);
```

---

## API Design

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/validation/run | POST | Start validation at specified level |
| /api/validation/:id | GET | Get validation run status |
| /api/validation/:id/results | GET | Get detailed results |
| /api/validation/levels | GET | List available levels |
| /api/validation/history | GET | Recent validation history |

---

## Risk Mitigation

1. **Timeout**: Hard time limits per level, kill long-running validators
2. **False positives**: Allow known-issue suppression list
3. **Resource usage**: Run validators sequentially if memory constrained
4. **Flaky tests**: Retry failed tests once before reporting
5. **Blocking builds**: QUICK level should never block, only warn
