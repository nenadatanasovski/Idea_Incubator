---
id: build-agent
complexity: complex
total_tasks: 24
phases:
  database: 3
  types: 3
  services: 8
  api: 6
  tests: 4
---

# Build Agent - Implementation Tasks

## Task Summary

| Phase    | Count |
| -------- | ----- |
| database | 3     |
| types    | 3     |
| services | 8     |
| api      | 6     |
| tests    | 4     |

---

## Tasks

### T-001: database - CREATE build_agent_migrations.sql

```yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/025_build_agent.sql"
status: pending
requirements:
  - "Create build_executions table"
  - "Create task_executions table"
  - "Create build_checkpoints table"
  - "Add indexes for common queries"
gotchas:
  - "Use TEXT for timestamps in SQLite"
  - "Add created_at and updated_at columns"
  - "Use IF NOT EXISTS for idempotent migrations"
validation:
  command: "sqlite3 :memory: < database/migrations/025_build_agent.sql && echo OK"
  expected: "OK"
code_template: |
  -- Migration 025: Build Agent Tables
  -- Created: 2026-01-11

  CREATE TABLE IF NOT EXISTS build_executions (
      id TEXT PRIMARY KEY,
      spec_id TEXT NOT NULL,
      spec_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      current_task_id TEXT,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_build_executions_status ON build_executions(status);
  CREATE INDEX IF NOT EXISTS idx_build_executions_spec_id ON build_executions(spec_id);

  CREATE TABLE IF NOT EXISTS task_executions (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      attempt INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      started_at TEXT,
      completed_at TEXT,
      generated_code TEXT,
      validation_output TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (build_id) REFERENCES build_executions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_task_executions_build ON task_executions(build_id);
  CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);

  CREATE TABLE IF NOT EXISTS build_checkpoints (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (build_id) REFERENCES build_executions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_checkpoints_build ON build_checkpoints(build_id);
depends_on: []
```

### T-002: database - UPDATE db.ts queries

```yaml
id: T-002
phase: database
action: UPDATE
file: "database/db.ts"
status: pending
requirements:
  - "Add build execution CRUD functions"
  - "Add task execution CRUD functions"
  - "Add checkpoint CRUD functions"
  - "Use parameterized queries"
gotchas:
  - "Use db.prepare().run/get/all() pattern"
  - "Wrap multiple operations in transactions"
  - "Add JSDoc comments"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-001
```

### T-003: database - CREATE db migrations runner

```yaml
id: T-003
phase: database
action: UPDATE
file: "database/migrate.ts"
status: pending
requirements:
  - "Add migration 025 to migration list"
  - "Ensure migrations run in order"
gotchas:
  - "Check migration hasn't already run"
  - "Use transactions for safety"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-001
```

### T-004: types - CREATE build-agent types

```yaml
id: T-004
phase: types
action: CREATE
file: "types/build-agent.ts"
status: pending
requirements:
  - "Define BuildExecution interface"
  - "Define TaskExecution interface"
  - "Define BuildCheckpoint interface"
  - "Define BuildStatus and TaskStatus types"
  - "Define BuildOptions interface"
  - "Export all types"
gotchas:
  - "Export all interfaces for use by other modules"
  - "Use readonly for immutable properties"
  - "Handle null explicitly"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Build Agent Types
   */

  export type BuildStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  export type TaskStatus = 'pending' | 'running' | 'validating' | 'completed' | 'failed' | 'skipped';

  export interface BuildExecution {
    id: string;
    specId: string;
    specPath: string;
    status: BuildStatus;
    currentTaskId: string | null;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  }

  export interface TaskExecution {
    id: string;
    buildId: string;
    taskId: string;
    attempt: number;
    status: TaskStatus;
    startedAt: string;
    completedAt: string | null;
    generatedCode: string | null;
    validationOutput: string | null;
    errorMessage: string | null;
  }

  export interface BuildCheckpoint {
    id: string;
    buildId: string;
    taskId: string;
    stateJson: string;
    createdAt: string;
  }

  export interface BuildOptions {
    autoCommit?: boolean;
    maxRetries?: number;
    skipValidation?: boolean;
    dryRun?: boolean;
  }
depends_on:
  - T-001
```

### T-005: types - CREATE task-loader types

```yaml
id: T-005
phase: types
action: CREATE
file: "types/task-loader.ts"
status: pending
requirements:
  - "Define LoadedTask interface"
  - "Define TasksFile interface"
  - "Define task dependency types"
gotchas:
  - "Match YAML structure from tasks.md"
  - "Include all task fields"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Task Loader Types
   */

  export interface LoadedTask {
    id: string;
    phase: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    file: string;
    status: string;
    requirements: string[];
    gotchas: string[];
    validation: {
      command: string;
      expected: string;
    };
    codeTemplate?: string;
    dependsOn: string[];
  }

  export interface TasksFile {
    id: string;
    complexity: string;
    totalTasks: number;
    phases: Record<string, number>;
    tasks: LoadedTask[];
  }
depends_on:
  - T-004
```

### T-006: types - CREATE context-primer types

```yaml
id: T-006
phase: types
action: CREATE
file: "types/context-primer.ts"
status: pending
requirements:
  - "Define PrimedContext interface"
  - "Define ContextFile interface"
gotchas:
  - "Include token estimates"
  - "Allow for file content"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Context Primer Types
   */

  export interface ContextFile {
    path: string;
    content: string;
    relevance: number;
  }

  export interface PrimedContext {
    claudeMd: string;
    relatedFiles: ContextFile[];
    gotchas: string[];
    taskRequirements: string[];
    tokenEstimate: number;
  }
depends_on:
  - T-004
```

### T-007: services - CREATE task-loader.ts

```yaml
id: T-007
phase: services
action: CREATE
file: "agents/build/task-loader.ts"
status: pending
requirements:
  - "Parse tasks.md YAML frontmatter"
  - "Extract all task YAML blocks"
  - "Order tasks by dependencies"
  - "Validate task structure"
gotchas:
  - "Use yaml package for parsing"
  - "Handle missing optional fields"
  - "Detect circular dependencies"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Task Loader for Build Agent
   */

  import * as fs from 'fs';
  import * as yaml from 'yaml';
  import { LoadedTask, TasksFile } from '../../types/task-loader.js';

  export class TaskLoader {
    load(tasksPath: string): TasksFile {
      // Implementation
    }

    private parseFrontmatter(content: string): Record<string, any> {
      // Implementation
    }

    private extractTasks(content: string): LoadedTask[] {
      // Implementation
    }

    orderByDependency(tasks: LoadedTask[]): LoadedTask[] {
      // Topological sort
    }
  }
depends_on:
  - T-005
```

### T-008: services - CREATE context-primer.ts

```yaml
id: T-008
phase: services
action: CREATE
file: "agents/build/context-primer.ts"
status: pending
requirements:
  - "Load CLAUDE.md content"
  - "Find related files based on task file path"
  - "Include task gotchas"
  - "Estimate token count"
gotchas:
  - "Limit context to avoid token overflow"
  - "Prioritize most relevant files"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Context Primer for Build Agent
   */

  import * as fs from 'fs';
  import * as path from 'path';
  import { LoadedTask } from '../../types/task-loader.js';
  import { PrimedContext, ContextFile } from '../../types/context-primer.js';

  export class ContextPrimer {
    prime(task: LoadedTask): PrimedContext {
      // Implementation
    }

    private loadClaudeMd(): string {
      // Implementation
    }

    private findRelatedFiles(taskFile: string): ContextFile[] {
      // Implementation
    }

    private estimateTokens(context: PrimedContext): number {
      // Implementation
    }
  }
depends_on:
  - T-006
```

### T-009: services - CREATE code-generator.ts

```yaml
id: T-009
phase: services
action: CREATE
file: "agents/build/code-generator.ts"
status: pending
requirements:
  - "Call Claude API with primed context"
  - "Include task requirements in prompt"
  - "Parse generated code from response"
  - "Handle API errors"
gotchas:
  - "Use claude-sonnet-4-20250514 model"
  - "Set appropriate max_tokens"
  - "Implement retry logic"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Code Generator for Build Agent
   */

  import Anthropic from '@anthropic-ai/sdk';
  import { LoadedTask } from '../../types/task-loader.js';
  import { PrimedContext } from '../../types/context-primer.js';

  export interface GeneratedCode {
    code: string;
    explanation: string;
    tokensUsed: number;
  }

  export class CodeGenerator {
    private client: Anthropic;

    constructor(apiKey?: string) {
      this.client = new Anthropic({ apiKey });
    }

    async generate(task: LoadedTask, context: PrimedContext): Promise<GeneratedCode> {
      // Implementation
    }

    private buildPrompt(task: LoadedTask, context: PrimedContext): string {
      // Implementation
    }
  }
depends_on:
  - T-006
  - T-008
```

### T-010: services - CREATE file-writer.ts

```yaml
id: T-010
phase: services
action: CREATE
file: "agents/build/file-writer.ts"
status: pending
requirements:
  - "Create backup before overwrite"
  - "Write to temp file first"
  - "Atomic rename to target"
  - "Create directories if needed"
gotchas:
  - "Handle file locking"
  - "Preserve file permissions"
  - "Clean up temp files on failure"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * File Writer for Build Agent
   */

  import * as fs from 'fs';
  import * as path from 'path';

  export interface WriteResult {
    success: boolean;
    backupPath?: string;
    error?: string;
  }

  export class FileWriter {
    async write(filePath: string, content: string): Promise<WriteResult> {
      // Implementation
    }

    private createBackup(filePath: string): string | null {
      // Implementation
    }

    private ensureDirectory(filePath: string): void {
      // Implementation
    }
  }
depends_on:
  - T-004
```

### T-011: services - CREATE validation-runner.ts

```yaml
id: T-011
phase: services
action: CREATE
file: "agents/build/validation-runner.ts"
status: pending
requirements:
  - "Execute validation command"
  - "Capture stdout and stderr"
  - "Check expected output"
  - "Handle timeout"
gotchas:
  - "Set reasonable timeout (60s)"
  - "Escape shell arguments"
  - "Handle non-zero exit codes"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Validation Runner for Build Agent
   */

  import { exec } from 'child_process';
  import { promisify } from 'util';

  const execAsync = promisify(exec);

  export interface ValidationResult {
    success: boolean;
    output: string;
    exitCode: number;
    error?: string;
  }

  export class ValidationRunner {
    async run(command: string, expected: string): Promise<ValidationResult> {
      // Implementation
    }
  }
depends_on:
  - T-004
```

### T-012: services - CREATE checkpoint-manager.ts

```yaml
id: T-012
phase: services
action: CREATE
file: "agents/build/checkpoint-manager.ts"
status: pending
requirements:
  - "Save checkpoint after each task"
  - "Load latest checkpoint for build"
  - "Serialize/deserialize state"
  - "Clean up old checkpoints"
gotchas:
  - "Use JSON for state serialization"
  - "Include all necessary state"
  - "Handle missing checkpoints"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Checkpoint Manager for Build Agent
   */

  import { BuildCheckpoint } from '../../types/build-agent.js';

  export interface BuildState {
    buildId: string;
    completedTasks: string[];
    currentTaskIndex: number;
    context: Record<string, any>;
  }

  export class CheckpointManager {
    save(buildId: string, taskId: string, state: BuildState): void {
      // Implementation
    }

    load(buildId: string): BuildState | null {
      // Implementation
    }

    cleanup(buildId: string, keepLast: number): void {
      // Implementation
    }
  }
depends_on:
  - T-002
  - T-004
```

### T-013: services - CREATE retry-handler.ts

```yaml
id: T-013
phase: services
action: CREATE
file: "agents/build/retry-handler.ts"
status: pending
requirements:
  - "Implement exponential backoff"
  - "Track retry attempts"
  - "Determine if error is retryable"
  - "Cap max retries at 3"
gotchas:
  - "Add jitter to prevent thundering herd"
  - "Max backoff of 60 seconds"
  - "Log retry attempts"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Retry Handler for Build Agent
   */

  export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  }

  export class RetryHandler {
    private config: RetryConfig;

    constructor(config?: Partial<RetryConfig>) {
      this.config = {
        maxRetries: config?.maxRetries ?? 3,
        baseDelay: config?.baseDelay ?? 1000,
        maxDelay: config?.maxDelay ?? 60000
      };
    }

    async withRetry<T>(
      operation: () => Promise<T>,
      isRetryable: (error: any) => boolean
    ): Promise<T> {
      // Implementation
    }

    private calculateBackoff(attempt: number): number {
      // Implementation
    }
  }
depends_on:
  - T-004
```

### T-014: services - CREATE task-executor.ts

```yaml
id: T-014
phase: services
action: CREATE
file: "agents/build/task-executor.ts"
status: pending
requirements:
  - "Orchestrate full task execution flow"
  - "Call context primer, code generator, file writer, validator"
  - "Handle failures with retry handler"
  - "Create checkpoints"
  - "Update task status in database"
gotchas:
  - "Execute tasks in dependency order"
  - "Stop on unrecoverable failure"
  - "Emit progress events"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Task Executor for Build Agent
   */

  import { TaskLoader } from './task-loader.js';
  import { ContextPrimer } from './context-primer.js';
  import { CodeGenerator } from './code-generator.js';
  import { FileWriter } from './file-writer.js';
  import { ValidationRunner } from './validation-runner.js';
  import { CheckpointManager } from './checkpoint-manager.js';
  import { RetryHandler } from './retry-handler.js';
  import { BuildExecution, TaskExecution, BuildOptions } from '../../types/build-agent.js';
  import { LoadedTask } from '../../types/task-loader.js';

  export class TaskExecutor {
    async execute(buildId: string, tasks: LoadedTask[], options: BuildOptions): Promise<void> {
      // Implementation
    }

    private async executeTask(task: LoadedTask, buildId: string): Promise<TaskExecution> {
      // Implementation
    }
  }
depends_on:
  - T-007
  - T-008
  - T-009
  - T-010
  - T-011
  - T-012
  - T-013
```

### T-015: api - CREATE builds router

```yaml
id: T-015
phase: api
action: CREATE
file: "server/routes/builds.ts"
status: pending
requirements:
  - "POST /api/builds - Start new build"
  - "GET /api/builds - List builds"
  - "GET /api/builds/:id - Get build status"
  - "GET /api/builds/:id/tasks - Get task history"
  - "POST /api/builds/:id/resume - Resume from checkpoint"
  - "POST /api/builds/:id/cancel - Cancel build"
gotchas:
  - "Add input validation"
  - "Return consistent response shapes"
  - "Use async/await"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Build Agent API Routes
   */

  import { Router, Request, Response } from 'express';
  import { TaskExecutor } from '../../agents/build/task-executor.js';
  import { TaskLoader } from '../../agents/build/task-loader.js';

  const router = Router();

  // POST /api/builds
  router.post('/', async (req: Request, res: Response) => {
    // Implementation
  });

  // GET /api/builds
  router.get('/', async (req: Request, res: Response) => {
    // Implementation
  });

  // GET /api/builds/:id
  router.get('/:id', async (req: Request, res: Response) => {
    // Implementation
  });

  export default router;
depends_on:
  - T-014
  - T-002
```

### T-016: api - UPDATE api.ts mount builds

```yaml
id: T-016
phase: api
action: UPDATE
file: "server/api.ts"
status: pending
requirements:
  - "Import builds router"
  - "Mount at /api/builds"
gotchas:
  - "Add after other routes"
  - "Check for conflicts"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-015
```

### T-017: api - CREATE build websocket events

```yaml
id: T-017
phase: api
action: UPDATE
file: "server/websocket.ts"
status: pending
requirements:
  - "Add build progress event type"
  - "Add task completion event type"
  - "Add build error event type"
gotchas:
  - "Follow existing event patterns"
  - "Include build ID in events"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-015
```

### T-018: api - CREATE build error types

```yaml
id: T-018
phase: api
action: CREATE
file: "server/errors/build-errors.ts"
status: pending
requirements:
  - "Define BuildError base class"
  - "Define TaskExecutionError"
  - "Define ValidationError"
  - "Define CheckpointError"
gotchas:
  - "Extend Error properly"
  - "Include error codes"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Build Agent Error Types
   */

  export class BuildError extends Error {
    constructor(
      message: string,
      public code: string,
      public buildId?: string
    ) {
      super(message);
      this.name = 'BuildError';
    }
  }

  export class TaskExecutionError extends BuildError {
    constructor(
      message: string,
      public taskId: string,
      buildId?: string
    ) {
      super(message, 'TASK_EXECUTION_ERROR', buildId);
      this.name = 'TaskExecutionError';
    }
  }
depends_on:
  - T-004
```

### T-019: api - CREATE git-integration.ts

```yaml
id: T-019
phase: api
action: CREATE
file: "agents/build/git-integration.ts"
status: pending
requirements:
  - "Commit after successful task"
  - "Include task ID in commit message"
  - "Handle git not initialized"
gotchas:
  - "Check if git is available"
  - "Don't commit if nothing changed"
  - "Use conventional commit format"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Git Integration for Build Agent
   */

  import { exec } from 'child_process';
  import { promisify } from 'util';

  const execAsync = promisify(exec);

  export class GitIntegration {
    async commit(taskId: string, filePath: string): Promise<boolean> {
      // Implementation
    }

    async isGitRepo(): Promise<boolean> {
      // Implementation
    }

    async hasChanges(filePath: string): Promise<boolean> {
      // Implementation
    }
  }
depends_on:
  - T-004
```

### T-020: api - CREATE core.ts for Build Agent

```yaml
id: T-020
phase: api
action: CREATE
file: "agents/build/core.ts"
status: pending
requirements:
  - "Export BuildAgent class"
  - "Wire up all components"
  - "Provide run() method"
gotchas:
  - "Initialize components in constructor"
  - "Handle missing API key"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  /**
   * Build Agent Core
   */

  import { TaskLoader } from './task-loader.js';
  import { TaskExecutor } from './task-executor.js';
  import { BuildOptions, BuildExecution } from '../../types/build-agent.js';

  export class BuildAgent {
    private taskLoader: TaskLoader;
    private taskExecutor: TaskExecutor;

    constructor(apiKey?: string) {
      // Initialize components
    }

    async run(tasksPath: string, options?: BuildOptions): Promise<BuildExecution> {
      // Implementation
    }
  }

  export function createBuildAgent(apiKey?: string): BuildAgent {
    return new BuildAgent(apiKey);
  }
depends_on:
  - T-014
  - T-019
```

### T-021: tests - CREATE task-loader tests

```yaml
id: T-021
phase: tests
action: CREATE
file: "tests/build-agent/task-loader.test.ts"
status: pending
requirements:
  - "Test YAML parsing"
  - "Test dependency ordering"
  - "Test error handling"
gotchas:
  - "Use vitest describe/it/expect"
  - "Test edge cases"
validation:
  command: "npm test -- tests/build-agent/task-loader.test.ts"
  expected: "all tests pass"
code_template: |
  /**
   * Task Loader Tests
   */

  import { describe, it, expect } from 'vitest';
  import { TaskLoader } from '../../agents/build/task-loader.js';

  describe('TaskLoader', () => {
    it('should parse tasks.md', () => {
      // Test implementation
    });

    it('should order by dependencies', () => {
      // Test implementation
    });
  });
depends_on:
  - T-007
```

### T-022: tests - CREATE code-generator tests

```yaml
id: T-022
phase: tests
action: CREATE
file: "tests/build-agent/code-generator.test.ts"
status: pending
requirements:
  - "Test prompt building"
  - "Test response parsing"
  - "Mock API calls"
gotchas:
  - "Mock Anthropic SDK"
  - "Test error scenarios"
validation:
  command: "npm test -- tests/build-agent/code-generator.test.ts"
  expected: "all tests pass"
code_template: |
  /**
   * Code Generator Tests
   */

  import { describe, it, expect, vi } from 'vitest';
  import { CodeGenerator } from '../../agents/build/code-generator.js';

  vi.mock('@anthropic-ai/sdk');

  describe('CodeGenerator', () => {
    it('should build prompt correctly', () => {
      // Test implementation
    });
  });
depends_on:
  - T-009
```

### T-023: tests - CREATE validation-runner tests

```yaml
id: T-023
phase: tests
action: CREATE
file: "tests/build-agent/validation-runner.test.ts"
status: pending
requirements:
  - "Test command execution"
  - "Test expected output matching"
  - "Test timeout handling"
gotchas:
  - "Use safe test commands"
  - "Test failure scenarios"
validation:
  command: "npm test -- tests/build-agent/validation-runner.test.ts"
  expected: "all tests pass"
code_template: |
  /**
   * Validation Runner Tests
   */

  import { describe, it, expect } from 'vitest';
  import { ValidationRunner } from '../../agents/build/validation-runner.js';

  describe('ValidationRunner', () => {
    it('should run validation command', async () => {
      // Test implementation
    });

    it('should handle timeout', async () => {
      // Test implementation
    });
  });
depends_on:
  - T-011
```

### T-024: tests - CREATE acceptance tests

```yaml
id: T-024
phase: tests
action: CREATE
file: "tests/build-agent/acceptance.test.ts"
status: pending
requirements:
  - "Test full build execution"
  - "Test checkpoint and resume"
  - "Test error recovery"
gotchas:
  - "Use test fixtures"
  - "Clean up after tests"
validation:
  command: "npm test -- tests/build-agent/acceptance.test.ts"
  expected: "all tests pass"
code_template: |
  /**
   * Build Agent Acceptance Tests
   */

  import { describe, it, expect, beforeAll, afterAll } from 'vitest';
  import { BuildAgent } from '../../agents/build/core.js';

  describe('Build Agent Acceptance', () => {
    it('should execute simple spec', async () => {
      // Test implementation
    });

    it('should resume from checkpoint', async () => {
      // Test implementation
    });
  });
depends_on:
  - T-020
```
