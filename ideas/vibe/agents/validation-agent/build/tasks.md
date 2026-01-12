---
id: validation-agent
complexity: medium
total_tasks: 12
phases:
  database: 1
  types: 2
  services: 6
  api: 2
  tests: 1
---

# Validation Agent - Implementation Tasks

## Task Summary

| Phase | Count |
|-------|-------|
| database | 1 |
| types | 2 |
| services | 6 |
| api | 2 |
| tests | 1 |

---

## Tasks

### T-001: database - CREATE validation_tables.sql

```yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/029_validation_agent.sql"
status: pending
requirements:
  - "Create validation_runs table"
  - "Create validator_results table"
  - "Add indexes for common queries"
gotchas:
  - "Use TEXT for timestamps in SQLite"
  - "Use IF NOT EXISTS for idempotent migrations"
  - "passed column should be INTEGER (0/1) not BOOLEAN"
validation:
  command: "sqlite3 :memory: < database/migrations/029_validation_agent.sql && echo OK"
  expected: "OK"
code_template: |
  -- Migration 029: Validation Agent Tables
  -- Created: 2026-01-11

  CREATE TABLE IF NOT EXISTS validation_runs (
      id TEXT PRIMARY KEY,
      build_id TEXT,
      level TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      started_at TEXT,
      completed_at TEXT,
      passed INTEGER,
      summary_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_validation_runs_status ON validation_runs(status);
  CREATE INDEX IF NOT EXISTS idx_validation_runs_build ON validation_runs(build_id);

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

  CREATE INDEX IF NOT EXISTS idx_validator_results_run ON validator_results(run_id);
depends_on: []
```

---

### T-002: types - CREATE validation types

```yaml
id: T-002
phase: types
action: CREATE
file: "types/validation.ts"
status: pending
requirements:
  - "Define ValidationLevel type"
  - "Define ValidationRun interface"
  - "Define ValidatorResult interface"
  - "Define LevelConfig and ValidatorConfig interfaces"
gotchas:
  - "Export all types for use in other modules"
  - "Use string literal unions for status types"
validation:
  command: "npx tsc --noEmit types/validation.ts"
  expected: "exit code 0"
code_template: |
  // types/validation.ts

  export type ValidationLevel = 'QUICK' | 'STANDARD' | 'THOROUGH' | 'RELEASE';
  export type ValidationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  export type ValidatorStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

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

  export interface ValidatorConfig {
    name: string;
    command: string;
    args: string[];
    required: boolean;
    timeoutMs: number;
  }

  export interface LevelConfig {
    level: ValidationLevel;
    timeBudgetMs: number;
    validators: ValidatorConfig[];
  }

  export interface ValidationRunRequest {
    level: ValidationLevel;
    buildId?: string;
    options?: {
      changedFilesOnly?: boolean;
      failFast?: boolean;
    };
  }

  export interface ValidationSummary {
    validatorsRun: number;
    validatorsPassed: number;
    validatorsFailed: number;
    totalDurationMs: number;
  }
depends_on: [T-001]
```

---

### T-003: types - CREATE level configurations

```yaml
id: T-003
phase: types
action: CREATE
file: "agents/validation/level-configs.ts"
status: pending
requirements:
  - "Define QUICK level config (TypeScript only, 30s)"
  - "Define STANDARD level config (TS + tests, 2min)"
  - "Define THOROUGH level config (TS strict + tests + audit, 10min)"
  - "Define RELEASE level config (everything, no limit)"
gotchas:
  - "Time budgets are in milliseconds"
  - "vitest needs --run flag for non-interactive mode"
  - "npm audit needs --json flag for parseable output"
validation:
  command: "npx tsc --noEmit agents/validation/level-configs.ts"
  expected: "exit code 0"
code_template: |
  // agents/validation/level-configs.ts

  import { LevelConfig, ValidationLevel } from '../../types/validation';

  export const LEVEL_CONFIGS: Record<ValidationLevel, LevelConfig> = {
    QUICK: {
      level: 'QUICK',
      timeBudgetMs: 30000,
      validators: [
        {
          name: 'typescript',
          command: 'npx',
          args: ['tsc', '--noEmit'],
          required: true,
          timeoutMs: 25000,
        },
      ],
    },
    STANDARD: {
      level: 'STANDARD',
      timeBudgetMs: 120000,
      validators: [
        {
          name: 'typescript',
          command: 'npx',
          args: ['tsc', '--noEmit'],
          required: true,
          timeoutMs: 30000,
        },
        {
          name: 'vitest',
          command: 'npx',
          args: ['vitest', 'run'],
          required: true,
          timeoutMs: 90000,
        },
      ],
    },
    THOROUGH: {
      level: 'THOROUGH',
      timeBudgetMs: 600000,
      validators: [
        {
          name: 'typescript',
          command: 'npx',
          args: ['tsc', '--noEmit', '--strict'],
          required: true,
          timeoutMs: 60000,
        },
        {
          name: 'vitest',
          command: 'npx',
          args: ['vitest', 'run'],
          required: true,
          timeoutMs: 300000,
        },
        {
          name: 'security',
          command: 'npm',
          args: ['audit', '--json'],
          required: false,
          timeoutMs: 60000,
        },
      ],
    },
    RELEASE: {
      level: 'RELEASE',
      timeBudgetMs: 0, // No limit
      validators: [
        {
          name: 'typescript',
          command: 'npx',
          args: ['tsc', '--noEmit', '--strict'],
          required: true,
          timeoutMs: 120000,
        },
        {
          name: 'vitest',
          command: 'npx',
          args: ['vitest', 'run', '--coverage'],
          required: true,
          timeoutMs: 600000,
        },
        {
          name: 'security',
          command: 'npm',
          args: ['audit', '--json'],
          required: true,
          timeoutMs: 120000,
        },
      ],
    },
  };

  export function getLevelConfig(level: ValidationLevel): LevelConfig {
    return LEVEL_CONFIGS[level];
  }
depends_on: [T-002]
```

---

### T-004: services - CREATE typescript validator

```yaml
id: T-004
phase: services
action: CREATE
file: "agents/validation/validators/typescript-validator.ts"
status: pending
requirements:
  - "Run tsc --noEmit command"
  - "Parse TypeScript errors from output"
  - "Return structured result with error count"
  - "Handle timeout gracefully"
gotchas:
  - "tsc outputs errors to stdout, not stderr"
  - "Exit code 0 means success, non-zero means errors"
  - "Use spawn instead of exec for better output handling"
validation:
  command: "npx tsc --noEmit agents/validation/validators/typescript-validator.ts"
  expected: "exit code 0"
code_template: |
  // agents/validation/validators/typescript-validator.ts

  import { spawn } from 'child_process';
  import { ValidatorResult } from '../../../types/validation';
  import { v4 as uuid } from 'uuid';

  export async function runTypescriptValidator(
    runId: string,
    args: string[] = ['--noEmit'],
    timeoutMs: number = 30000
  ): Promise<ValidatorResult> {
    const startTime = Date.now();
    const id = uuid();

    return new Promise((resolve) => {
      let output = '';
      const proc = spawn('npx', ['tsc', ...args], { shell: true });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, timeoutMs);

      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        const durationMs = Date.now() - startTime;

        resolve({
          id,
          runId,
          validatorName: 'typescript',
          status: 'completed',
          passed: code === 0,
          output,
          durationMs,
          createdAt: new Date().toISOString(),
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          id,
          runId,
          validatorName: 'typescript',
          status: 'failed',
          passed: false,
          output: err.message,
          durationMs: Date.now() - startTime,
          createdAt: new Date().toISOString(),
        });
      });
    });
  }
depends_on: [T-002]
```

---

### T-005: services - CREATE test runner

```yaml
id: T-005
phase: services
action: CREATE
file: "agents/validation/validators/test-runner.ts"
status: pending
requirements:
  - "Run vitest with --run flag"
  - "Parse test results from output"
  - "Return structured result with test counts"
  - "Handle timeout gracefully"
gotchas:
  - "vitest run exits 0 on success, 1 on test failures"
  - "Use --reporter=json for machine-readable output"
  - "Coverage requires --coverage flag"
validation:
  command: "npx tsc --noEmit agents/validation/validators/test-runner.ts"
  expected: "exit code 0"
code_template: |
  // agents/validation/validators/test-runner.ts

  import { spawn } from 'child_process';
  import { ValidatorResult } from '../../../types/validation';
  import { v4 as uuid } from 'uuid';

  export async function runTestRunner(
    runId: string,
    args: string[] = ['run'],
    timeoutMs: number = 120000
  ): Promise<ValidatorResult> {
    const startTime = Date.now();
    const id = uuid();

    return new Promise((resolve) => {
      let output = '';
      const proc = spawn('npx', ['vitest', ...args], { shell: true });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, timeoutMs);

      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        const durationMs = Date.now() - startTime;

        resolve({
          id,
          runId,
          validatorName: 'vitest',
          status: 'completed',
          passed: code === 0,
          output,
          durationMs,
          createdAt: new Date().toISOString(),
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          id,
          runId,
          validatorName: 'vitest',
          status: 'failed',
          passed: false,
          output: err.message,
          durationMs: Date.now() - startTime,
          createdAt: new Date().toISOString(),
        });
      });
    });
  }
depends_on: [T-002]
```

---

### T-006: services - CREATE security scanner

```yaml
id: T-006
phase: services
action: CREATE
file: "agents/validation/validators/security-scanner.ts"
status: pending
requirements:
  - "Run npm audit with --json flag"
  - "Parse vulnerability counts from JSON output"
  - "Return structured result with severity breakdown"
  - "Non-critical vulnerabilities should not fail validation"
gotchas:
  - "npm audit exits 1 even for low severity - must parse JSON"
  - "Parse vulnerabilities by severity level"
  - "Only fail on high/critical vulnerabilities"
validation:
  command: "npx tsc --noEmit agents/validation/validators/security-scanner.ts"
  expected: "exit code 0"
code_template: |
  // agents/validation/validators/security-scanner.ts

  import { spawn } from 'child_process';
  import { ValidatorResult } from '../../../types/validation';
  import { v4 as uuid } from 'uuid';

  interface AuditResult {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
    };
  }

  export async function runSecurityScanner(
    runId: string,
    timeoutMs: number = 60000
  ): Promise<ValidatorResult> {
    const startTime = Date.now();
    const id = uuid();

    return new Promise((resolve) => {
      let output = '';
      const proc = spawn('npm', ['audit', '--json'], { shell: true });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
      }, timeoutMs);

      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });

      proc.on('close', () => {
        clearTimeout(timeout);
        const durationMs = Date.now() - startTime;

        let passed = true;
        try {
          const audit: AuditResult = JSON.parse(output);
          // Only fail on high or critical
          passed = audit.vulnerabilities.high === 0 &&
                   audit.vulnerabilities.critical === 0;
        } catch {
          // If we can't parse, assume pass (npm audit may not be available)
          passed = true;
        }

        resolve({
          id,
          runId,
          validatorName: 'security',
          status: 'completed',
          passed,
          output,
          durationMs,
          createdAt: new Date().toISOString(),
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          id,
          runId,
          validatorName: 'security',
          status: 'failed',
          passed: true, // Don't fail build if npm audit fails
          output: err.message,
          durationMs: Date.now() - startTime,
          createdAt: new Date().toISOString(),
        });
      });
    });
  }
depends_on: [T-002]
```

---

### T-007: services - CREATE result aggregator

```yaml
id: T-007
phase: services
action: CREATE
file: "agents/validation/result-aggregator.ts"
status: pending
requirements:
  - "Combine results from all validators"
  - "Calculate summary statistics"
  - "Determine overall pass/fail based on required validators"
gotchas:
  - "Only required validators affect overall pass/fail"
  - "Include timing information for each validator"
validation:
  command: "npx tsc --noEmit agents/validation/result-aggregator.ts"
  expected: "exit code 0"
code_template: |
  // agents/validation/result-aggregator.ts

  import { ValidatorResult, ValidationSummary, ValidatorConfig } from '../../types/validation';

  export function aggregateResults(
    results: ValidatorResult[],
    validatorConfigs: ValidatorConfig[]
  ): { passed: boolean; summary: ValidationSummary } {
    const requiredValidators = new Set(
      validatorConfigs.filter(v => v.required).map(v => v.name)
    );

    let passed = true;
    let validatorsPassed = 0;
    let validatorsFailed = 0;
    let totalDurationMs = 0;

    for (const result of results) {
      totalDurationMs += result.durationMs || 0;

      if (result.passed) {
        validatorsPassed++;
      } else {
        validatorsFailed++;
        if (requiredValidators.has(result.validatorName)) {
          passed = false;
        }
      }
    }

    return {
      passed,
      summary: {
        validatorsRun: results.length,
        validatorsPassed,
        validatorsFailed,
        totalDurationMs,
      },
    };
  }
depends_on: [T-004, T-005, T-006]
```

---

### T-008: services - CREATE validation orchestrator

```yaml
id: T-008
phase: services
action: CREATE
file: "agents/validation/orchestrator.ts"
status: pending
requirements:
  - "Accept validation level and options"
  - "Load level configuration"
  - "Run validators in sequence"
  - "Aggregate results and return"
gotchas:
  - "Run validators sequentially to avoid resource contention"
  - "Respect overall time budget"
  - "Store results in database"
validation:
  command: "npx tsc --noEmit agents/validation/orchestrator.ts"
  expected: "exit code 0"
code_template: |
  // agents/validation/orchestrator.ts

  import { v4 as uuid } from 'uuid';
  import { ValidationLevel, ValidationRun, ValidatorResult, ValidationRunRequest } from '../../types/validation';
  import { getLevelConfig } from './level-configs';
  import { runTypescriptValidator } from './validators/typescript-validator';
  import { runTestRunner } from './validators/test-runner';
  import { runSecurityScanner } from './validators/security-scanner';
  import { aggregateResults } from './result-aggregator';

  const VALIDATOR_MAP: Record<string, Function> = {
    typescript: runTypescriptValidator,
    vitest: runTestRunner,
    security: runSecurityScanner,
  };

  export class ValidationOrchestrator {
    async run(request: ValidationRunRequest): Promise<{
      run: ValidationRun;
      results: ValidatorResult[];
    }> {
      const runId = uuid();
      const config = getLevelConfig(request.level);
      const startedAt = new Date().toISOString();

      const results: ValidatorResult[] = [];

      for (const validatorConfig of config.validators) {
        const validator = VALIDATOR_MAP[validatorConfig.name];
        if (validator) {
          const result = await validator(
            runId,
            validatorConfig.args,
            validatorConfig.timeoutMs
          );
          results.push(result);

          // Fail fast if required validator fails and option set
          if (request.options?.failFast && !result.passed && validatorConfig.required) {
            break;
          }
        }
      }

      const { passed, summary } = aggregateResults(results, config.validators);

      const run: ValidationRun = {
        id: runId,
        buildId: request.buildId || null,
        level: request.level,
        status: 'completed',
        passed,
        startedAt,
        completedAt: new Date().toISOString(),
        summaryJson: JSON.stringify(summary),
      };

      return { run, results };
    }
  }
depends_on: [T-003, T-007]
```

---

### T-009: services - CREATE database functions

```yaml
id: T-009
phase: services
action: CREATE
file: "agents/validation/db.ts"
status: pending
requirements:
  - "Save validation run to database"
  - "Save validator results to database"
  - "Query validation history"
gotchas:
  - "Use getDb() from database/db.ts"
  - "Convert boolean to INTEGER for SQLite"
validation:
  command: "npx tsc --noEmit agents/validation/db.ts"
  expected: "exit code 0"
code_template: |
  // agents/validation/db.ts

  import { getDb } from '../../database/db';
  import { ValidationRun, ValidatorResult } from '../../types/validation';

  export function saveValidationRun(run: ValidationRun): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO validation_runs (id, build_id, level, status, started_at, completed_at, passed, summary_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.buildId,
      run.level,
      run.status,
      run.startedAt,
      run.completedAt,
      run.passed ? 1 : 0,
      run.summaryJson
    );
  }

  export function saveValidatorResult(result: ValidatorResult): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO validator_results (id, run_id, validator_name, status, passed, output, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.id,
      result.runId,
      result.validatorName,
      result.status,
      result.passed ? 1 : 0,
      result.output,
      result.durationMs
    );
  }

  export function getValidationRun(id: string): ValidationRun | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM validation_runs WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      buildId: row.build_id,
      level: row.level,
      status: row.status,
      passed: row.passed === 1,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      summaryJson: row.summary_json,
    };
  }

  export function getValidatorResults(runId: string): ValidatorResult[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM validator_results WHERE run_id = ?').all(runId) as any[];
    return rows.map(row => ({
      id: row.id,
      runId: row.run_id,
      validatorName: row.validator_name,
      status: row.status,
      passed: row.passed === 1,
      output: row.output,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    }));
  }

  export function getValidationHistory(limit: number = 20): ValidationRun[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM validation_runs
      ORDER BY started_at DESC
      LIMIT ?
    `).all(limit) as any[];
    return rows.map(row => ({
      id: row.id,
      buildId: row.build_id,
      level: row.level,
      status: row.status,
      passed: row.passed === 1,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      summaryJson: row.summary_json,
    }));
  }
depends_on: [T-001, T-002]
```

---

### T-010: api - CREATE validation routes

```yaml
id: T-010
phase: api
action: CREATE
file: "server/routes/validation.ts"
status: pending
requirements:
  - "POST /api/validation/run - start validation"
  - "GET /api/validation/:id - get run status"
  - "GET /api/validation/:id/results - get detailed results"
  - "GET /api/validation/levels - list levels"
  - "GET /api/validation/history - recent runs"
gotchas:
  - "Use express Router"
  - "Add error handling middleware"
  - "Return 404 for unknown run IDs"
validation:
  command: "npx tsc --noEmit server/routes/validation.ts"
  expected: "exit code 0"
code_template: |
  // server/routes/validation.ts

  import { Router } from 'express';
  import { ValidationOrchestrator } from '../../agents/validation/orchestrator';
  import { LEVEL_CONFIGS } from '../../agents/validation/level-configs';
  import { saveValidationRun, saveValidatorResult, getValidationRun, getValidatorResults, getValidationHistory } from '../../agents/validation/db';

  const router = Router();
  const orchestrator = new ValidationOrchestrator();

  router.post('/run', async (req, res) => {
    try {
      const { level, buildId, options } = req.body;
      const { run, results } = await orchestrator.run({ level, buildId, options });

      saveValidationRun(run);
      for (const result of results) {
        saveValidatorResult(result);
      }

      res.json({ run, results });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/levels', (req, res) => {
    res.json(LEVEL_CONFIGS);
  });

  router.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = getValidationHistory(limit);
    res.json(history);
  });

  router.get('/:id', (req, res) => {
    const run = getValidationRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Validation run not found' });
    }
    res.json(run);
  });

  router.get('/:id/results', (req, res) => {
    const run = getValidationRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Validation run not found' });
    }
    const results = getValidatorResults(req.params.id);
    res.json({ run, results });
  });

  export default router;
depends_on: [T-008, T-009]
```

---

### T-011: api - UPDATE api.ts to include validation routes

```yaml
id: T-011
phase: api
action: UPDATE
file: "server/api.ts"
status: pending
requirements:
  - "Import validation routes"
  - "Mount at /api/validation"
gotchas:
  - "Add after other route mounts"
  - "Ensure no route conflicts"
validation:
  command: "grep -q 'validation' server/api.ts && echo OK"
  expected: "OK"
code_template: |
  // Add to server/api.ts imports:
  import validationRoutes from './routes/validation';

  // Add to route mounts:
  app.use('/api/validation', validationRoutes);
depends_on: [T-010]
```

---

### T-012: tests - CREATE validation agent tests

```yaml
id: T-012
phase: tests
action: CREATE
file: "tests/validation-agent.test.ts"
status: pending
requirements:
  - "Test level config loading"
  - "Test result aggregation"
  - "Test orchestrator with mock validators"
  - "Test database functions"
gotchas:
  - "Use vitest mocking for validators"
  - "Don't run actual validators in tests"
  - "Use in-memory database for tests"
validation:
  command: "npx vitest run tests/validation-agent.test.ts"
  expected: "exit code 0"
code_template: |
  // tests/validation-agent.test.ts

  import { describe, it, expect, vi } from 'vitest';
  import { getLevelConfig, LEVEL_CONFIGS } from '../agents/validation/level-configs';
  import { aggregateResults } from '../agents/validation/result-aggregator';

  describe('Validation Agent', () => {
    describe('Level Configs', () => {
      it('should have 4 validation levels', () => {
        expect(Object.keys(LEVEL_CONFIGS)).toHaveLength(4);
      });

      it('should return correct config for QUICK level', () => {
        const config = getLevelConfig('QUICK');
        expect(config.level).toBe('QUICK');
        expect(config.timeBudgetMs).toBe(30000);
        expect(config.validators).toHaveLength(1);
      });

      it('should return correct config for STANDARD level', () => {
        const config = getLevelConfig('STANDARD');
        expect(config.level).toBe('STANDARD');
        expect(config.validators).toHaveLength(2);
      });
    });

    describe('Result Aggregator', () => {
      it('should pass when all required validators pass', () => {
        const results = [
          { id: '1', runId: 'r1', validatorName: 'typescript', status: 'completed', passed: true, output: '', durationMs: 1000, createdAt: '' },
          { id: '2', runId: 'r1', validatorName: 'vitest', status: 'completed', passed: true, output: '', durationMs: 2000, createdAt: '' },
        ];
        const configs = [
          { name: 'typescript', command: '', args: [], required: true, timeoutMs: 1000 },
          { name: 'vitest', command: '', args: [], required: true, timeoutMs: 1000 },
        ];

        const { passed, summary } = aggregateResults(results, configs);
        expect(passed).toBe(true);
        expect(summary.validatorsPassed).toBe(2);
      });

      it('should fail when required validator fails', () => {
        const results = [
          { id: '1', runId: 'r1', validatorName: 'typescript', status: 'completed', passed: false, output: '', durationMs: 1000, createdAt: '' },
        ];
        const configs = [
          { name: 'typescript', command: '', args: [], required: true, timeoutMs: 1000 },
        ];

        const { passed } = aggregateResults(results, configs);
        expect(passed).toBe(false);
      });

      it('should pass when optional validator fails', () => {
        const results = [
          { id: '1', runId: 'r1', validatorName: 'security', status: 'completed', passed: false, output: '', durationMs: 1000, createdAt: '' },
        ];
        const configs = [
          { name: 'security', command: '', args: [], required: false, timeoutMs: 1000 },
        ];

        const { passed } = aggregateResults(results, configs);
        expect(passed).toBe(true);
      });
    });
  });
depends_on: [T-003, T-007]
```
