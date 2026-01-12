---
id: validation-agent
title: Validation Agent
complexity: medium
status: approved
version: 1.0.0
generated: 2026-01-11
---

# Validation Agent

## Overview

**Problem:** After the Build Agent generates code, there is no comprehensive validation system. Build Agent runs basic per-task validation, but there's no holistic validation, graduated levels, or integration with test suites.

**Solution:** Validation Agent is a multi-level code validation system that runs graduated validation from QUICK to RELEASE levels, integrates test suites, checks code quality, performs security scanning, and reports results through Communication Hub.

## Functional Requirements

- **[FR-001]** Define 4 validation levels: QUICK, STANDARD, THOROUGH, RELEASE _(must)_
- **[FR-002]** Run TypeScript compilation check (tsc --noEmit) _(must)_
- **[FR-003]** Integrate with vitest for unit test execution _(must)_
- **[FR-004]** Run npm audit for security vulnerabilities _(must)_
- **[FR-005]** Report code coverage metrics _(should)_
- **[FR-006]** Aggregate results from all validators _(must)_
- **[FR-007]** Determine pass/fail based on level requirements _(must)_
- **[FR-008]** Report failures through Communication Hub _(must)_
- **[FR-009]** Return structured JSON results _(must)_
- **[FR-010]** Respect time budgets per validation level _(should)_
- **[FR-011]** Support partial re-validation of changed files only _(could)_

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Validation Agent                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐                                        │
│  │   Orchestrator   │  ◀── Entry point, level selection     │
│  └────────┬─────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                        │
│  │  Level Configs   │  ◀── What validators run at each level│
│  └────────┬─────────┘                                        │
│           │                                                  │
│     ┌─────┴─────┬─────────┬─────────┐                       │
│     ▼           ▼         ▼         ▼                       │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                     │
│  │  TS  │  │ Test │  │ Sec  │  │ Cov  │   ◀── Validators   │
│  │Check │  │Runner│  │Scan │  │Report│                      │
│  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘                     │
│     │         │         │         │                         │
│     └─────────┴─────────┴─────────┘                         │
│                    │                                         │
│                    ▼                                         │
│           ┌──────────────────┐                               │
│           │Result Aggregator │                               │
│           └────────┬─────────┘                               │
│                    │                                         │
│           ┌────────┴────────┐                               │
│           ▼                 ▼                               │
│  ┌──────────────┐   ┌──────────────┐                        │
│  │Comm Reporter │   │ JSON Output  │                        │
│  └──────────────┘   └──────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| Orchestrator | Entry point, select level, coordinate validators |
| Level Configs | Define what validators run at each level with time budgets |
| TypeScript Validator | Run tsc --noEmit, parse errors |
| Test Runner | Execute vitest, collect results |
| Security Scanner | Run npm audit, parse vulnerabilities |
| Coverage Reporter | Analyze coverage data |
| Result Aggregator | Combine all validator results |
| Comm Reporter | Send failures to Communication Hub |

## Validation Levels

| Level | Time Budget | Validators |
|-------|-------------|------------|
| QUICK | < 30s | TypeScript compilation only |
| STANDARD | < 2min | TypeScript + All unit tests |
| THOROUGH | < 10min | TypeScript strict + Unit tests + npm audit |
| RELEASE | No limit | Everything + Coverage + License check |

## API Design

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/validation/run | POST | Start validation at specified level |
| /api/validation/:id | GET | Get validation run status |
| /api/validation/:id/results | GET | Get detailed validator results |
| /api/validation/levels | GET | List available levels with configs |
| /api/validation/history | GET | Recent validation runs |

### Request/Response Examples

**POST /api/validation/run**
```json
{
  "level": "STANDARD",
  "buildId": "build_abc123",
  "options": {
    "changedFilesOnly": false,
    "failFast": true
  }
}
```

**GET /api/validation/:id**
```json
{
  "id": "val_xyz789",
  "level": "STANDARD",
  "status": "completed",
  "passed": true,
  "duration_ms": 45000,
  "summary": {
    "validators_run": 2,
    "validators_passed": 2,
    "validators_failed": 0
  },
  "startedAt": "2026-01-11T10:00:00Z",
  "completedAt": "2026-01-11T10:00:45Z"
}
```

**GET /api/validation/:id/results**
```json
{
  "runId": "val_xyz789",
  "results": [
    {
      "validator": "typescript",
      "passed": true,
      "duration_ms": 12000,
      "details": {
        "errors": 0,
        "warnings": 3
      }
    },
    {
      "validator": "vitest",
      "passed": true,
      "duration_ms": 33000,
      "details": {
        "tests": 150,
        "passed": 150,
        "failed": 0,
        "skipped": 2
      }
    }
  ]
}
```

## Data Models

```typescript
export type ValidationLevel = 'QUICK' | 'STANDARD' | 'THOROUGH' | 'RELEASE';

export interface ValidationRun {
  id: string;
  buildId: string | null;
  level: ValidationLevel;
  status: ValidationStatus;
  passed: boolean | null;
  startedAt: string;
  completedAt: string | null;
  summaryJson: string | null;
}

export type ValidationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ValidatorResult {
  id: string;
  runId: string;
  validatorName: string;
  status: ValidatorStatus;
  passed: boolean | null;
  output: string | null;
  durationMs: number | null;
  createdAt: string;
}

export type ValidatorStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface LevelConfig {
  level: ValidationLevel;
  timeBudgetMs: number;
  validators: ValidatorConfig[];
}

export interface ValidatorConfig {
  name: string;
  command: string;
  args: string[];
  required: boolean;
  timeoutMs: number;
}
```

## Database Schema

```sql
-- Validation run tracking
CREATE TABLE IF NOT EXISTS validation_runs (
    id TEXT PRIMARY KEY,
    build_id TEXT,
    level TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    passed INTEGER,
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

## Gotchas

1. **[G-001]** Use TEXT for dates in SQLite, not DATETIME
2. **[G-002]** Always include `IF NOT EXISTS` in CREATE TABLE
3. **[G-003]** vitest uses different exit codes than jest - check for non-zero
4. **[G-004]** npm audit returns exit code 1 even for low severity - parse JSON output
5. **[G-005]** tsc --noEmit with strict mode is different from project tsconfig
6. **[G-006]** Coverage thresholds should be configurable, not hardcoded
7. **[G-007]** Child process timeouts need SIGKILL after SIGTERM grace period

## Non-Functional Requirements

- **Performance:** QUICK validation must complete in < 30 seconds
- **Reliability:** Failed validators should not crash the entire run
- **Observability:** All validator output must be captured and stored
- **Extensibility:** New validators can be added via configuration
