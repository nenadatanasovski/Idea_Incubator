# PHASE2-TASK-02: Build Agent v0.1 - Task Executor with File Modification + Test Running

**Status:** 🔄 SPECIFICATION COMPLETE
**Created:** 2026-02-08
**Priority:** P0 (Critical Path - Phase 2)
**Effort:** Large (10-12 hours)
**Model:** Opus
**Agent Type:** spec_agent → build_agent

---

## Overview

Implement Build Agent v0.1 as the second component of the autonomous task execution pipeline (Spec Agent → **Build Agent** → QA Agent). The Build Agent transforms technical specifications into working code by executing atomic tasks, modifying files, running tests, and managing the full implementation lifecycle.

This is the **execution engine** for Phase 2's autonomous development vision. While Spec Agent creates detailed plans, Build Agent brings those plans to life by writing code, validating changes, and ensuring correctness.

### Problem Statement

**Current State:**

- Build Agent framework exists (`agents/build/`, `coding-loops/agents/build_agent_worker.py`)
- Task executor has core infrastructure (context loading, task state management)
- Python worker has Claude integration and observability framework
- BUT: No end-to-end integration between TypeScript orchestrator and Python worker
- No file modification pipeline (code generation → write → validate → commit)
- No test execution framework for validating changes

**Desired State:**

- Build Agent executes tasks from Spec Agent specifications
- Generates code using Claude Opus with full task context
- Writes files to disk with proper error handling
- Runs validation tests to confirm correctness
- Reports results back for QA Agent validation
- Complete Spec → Build → QA pipeline functional

### Value Proposition

The Build Agent serves as the **"Implementation Executor"** between specification and validation:

1. **Automates Code Writing** - Transforms requirements into working code
2. **Ensures Correctness** - Validates changes with automated tests
3. **Reduces Human Effort** - Handles tedious implementation work autonomously
4. **Enables Iteration** - Retries failed tasks with improved context
5. **Maintains Quality** - Follows project conventions and patterns

---

## Requirements

### Functional Requirements

#### 1. Task Execution Pipeline

**Input:** Technical specification from Spec Agent

```typescript
interface SpecificationFile {
  path: string; // e.g., "docs/specs/TASK-042-user-auth.md"
  content: string; // Full markdown specification
  tasks: AtomicTask[]; // Parsed task breakdown
}
```

**Process Flow:**

```
1. Load spec from docs/specs/ directory
2. Parse atomic tasks with dependencies
3. For each task in dependency order:
   a. Load task context (spec sections, related files, gotchas)
   b. Generate code using Claude Opus
   c. Write file to disk (CREATE/UPDATE/DELETE)
   d. Run validation test
   e. Record result (success/failure)
   f. On failure: retry with enhanced context or escalate
4. Report execution summary
```

**Output:** Build execution record

```typescript
interface BuildResult {
  buildId: string;
  specId: string;
  status: "completed" | "failed" | "partial";
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  results: TaskExecutionResult[];
  duration: number;
  error?: string;
}
```

#### 2. Code Generation

Use Claude Opus to generate code based on task context:

**Context Assembly:**

```typescript
interface TaskContext {
  task: AtomicTask; // Requirements, gotchas, validation
  specSections: string[]; // Relevant spec sections
  dependencyOutputs: Record<string, string>; // Code from dependencies
  conventions: string; // Project coding standards
  relatedFiles: Record<string, string>; // Existing code patterns
  gotchas: Gotcha[]; // Common mistakes to avoid
  tokenCount: number; // Total context size
}
```

**Generation Requirements:**

- Use `claude-opus-4-6` model for complex reasoning
- Include full error messages from previous attempts (retry context)
- Respect token limits (max 180K context, leave 20K for output)
- Stream responses for progress tracking
- Handle API errors (rate limits, timeouts) with exponential backoff

#### 3. File Operations

**File Writer Capabilities:**

- CREATE: Write new file to path (error if exists)
- UPDATE: Modify existing file (error if missing)
- DELETE: Remove file (error if missing)
- Atomic writes: temp file → validate → rename
- Preserve file permissions and line endings
- Create parent directories as needed

**Error Handling:**

- File permission errors → escalate to SIA
- Path traversal attempts → reject immediately
- Disk space errors → fail build with clear message
- Concurrent modification detection → retry with fresh read

#### 4. Test Execution

**Validation Levels (from `build_agent_worker.py` config):**

```python
test_commands = {
    "codebase": ["npm", "run", "build"],           # TypeScript compilation
    "api": ["npm", "run", "test:api"],             # API health check
    "ui": ["npm", "run", "test:ui"],               # UI tests
    "python": ["python3", "-m", "pytest", "{file}"] # Python validation
}
```

**Validation Runner:**

- Execute command with timeout (default 120s)
- Capture stdout/stderr
- Parse output for expected patterns (from task.validation.expected)
- Return pass/fail with detailed output
- Handle timeout gracefully (kill process, report timeout)

#### 5. Progress Tracking & Observability

**Database Records:**

- `build_executions`: Overall build status
- `task_executions`: Individual task status with attempts
- `build_checkpoints`: State snapshots for recovery
- `agent_heartbeats`: Liveness monitoring (Python worker)

**Real-Time Updates:**

- Emit WebSocket events for UI updates
- Log to observability API (if available)
- Update task status in database after each step
- Record token usage and costs

#### 6. Error Classification & Retry Logic

**Error Types (from GAP-007):**

**Transient Errors (retry with backoff):**

- Network timeouts
- Rate limits (HTTP 429)
- Service unavailable (HTTP 503, 502)
- Connection resets
- Out of memory (OOM)

**Permanent Errors (escalate immediately):**

- Syntax errors in generated code
- Type errors
- Logic errors (wrong implementation)
- Missing dependencies
- Invalid file paths

**Retry Strategy:**

```typescript
interface RetryConfig {
  maxRetries: 3;
  baseDelaySeconds: 1.0;
  maxDelaySeconds: 30.0;
  backoffMultiplier: 2.0;
}
```

**Escalation Trigger:**

- 3 consecutive permanent failures → escalate to SIA
- 5 total failures (any type) → escalate to SIA
- Infinite loop detected (same error 3x) → escalate to SIA

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Orchestrator                   │
│  (server/services/task-agent/build-agent-orchestrator.ts)   │
│                                                              │
│  - Load spec from docs/specs/                               │
│  - Parse atomic tasks with dependencies                     │
│  - Spawn Python worker subprocess                           │
│  - Monitor heartbeats (30s interval)                        │
│  - Handle process failures                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ spawn + args
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Python Worker (build_agent_worker.py)           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Task Loading                                       │  │
│  │    - Read task from SQLite                           │  │
│  │    - Load file impacts                               │  │
│  │    - Assemble context                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2. Code Generation                                    │  │
│  │    - Build Claude API request                        │  │
│  │    - Include spec + context + gotchas                │  │
│  │    - Stream response                                 │  │
│  │    - Parse code from markdown blocks                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3. File Writing                                       │  │
│  │    - Write to temp file                              │  │
│  │    - Validate syntax (if applicable)                 │  │
│  │    - Atomic rename to target path                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 4. Test Execution                                     │  │
│  │    - Run validation command                          │  │
│  │    - Capture output                                  │  │
│  │    - Match expected pattern                          │  │
│  │    - Return pass/fail                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 5. Result Recording                                   │  │
│  │    - Update task status in DB                        │  │
│  │    - Record execution details                        │  │
│  │    - Exit with code 0 (success) or 1 (failure)       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

#### Component 1: TypeScript Orchestrator Integration

**File:** `server/services/task-agent/build-agent-orchestrator.ts`

**Current State:**

- Spawns Python worker with arguments
- Monitors heartbeats and tracks process lifecycle
- Handles errors and escalation to SIA
- Database tracking for agent instances

**Additions Needed:**

```typescript
/**
 * Execute a specification using Build Agent
 */
export async function executeSpecification(
  specPath: string,
  options?: BuildOptions,
): Promise<BuildResult> {
  // 1. Load specification file
  const spec = await loadSpecification(specPath);

  // 2. Parse atomic tasks from spec
  const tasks = await parseAtomicTasks(spec);

  // 3. Create build execution record
  const buildId = uuidv4();
  await createBuildExecution({ id: buildId, specId: spec.id, specPath });

  // 4. Create task list in database
  const taskListId = await createTaskList(tasks);

  // 5. Execute tasks (spawn workers for each task)
  const results = await executeTasks(buildId, taskListId, tasks, options);

  // 6. Update build execution with final status
  await updateBuildExecution(buildId, {
    status: results.status,
    completedAt: new Date().toISOString(),
  });

  return results;
}
```

#### Component 2: Python Worker Enhancements

**File:** `coding-loops/agents/build_agent_worker.py`

**Current Capabilities:**

- ✅ Database connection (SQLite)
- ✅ ObservableAgent integration
- ✅ Heartbeat monitoring
- ✅ Configuration system
- ✅ Error classification

**Additions Needed:**

```python
def execute_task(task_id: str, agent_id: str) -> int:
    """Execute a single task: load → generate → write → validate"""

    # 1. Load task context
    context = load_task_context(task_id)

    # 2. Generate code
    code = generate_code_with_claude(context)

    # 3. Write file
    write_result = write_file(context.task.file, code, context.task.action)
    if not write_result.success:
        return 1  # Exit with failure

    # 4. Run validation
    validation_result = run_validation_test(context.task.validation)
    if not validation_result.success:
        return 1  # Exit with failure

    # 5. Update database
    update_task_status(task_id, "completed")

    return 0  # Success
```

**Claude Integration:**

```python
def generate_code_with_claude(context: TaskContext) -> str:
    """Generate code using Claude API"""

    # Build prompt from context
    prompt = build_code_generation_prompt(context)

    # Call Claude Opus
    response = anthropic_client.messages.create(
        model="claude-opus-4-6",
        max_tokens=20000,
        temperature=0.0,  # Deterministic for code generation
        messages=[{"role": "user", "content": prompt}]
    )

    # Extract code from response
    code = extract_code_blocks(response.content)

    return code
```

**File Writing:**

```python
def write_file(path: str, content: str, action: str) -> WriteResult:
    """Write file with atomic operations"""

    # Validate path (prevent directory traversal)
    if ".." in path or path.startswith("/"):
        raise ValueError(f"Invalid path: {path}")

    full_path = PROJECT_ROOT / path

    # Handle based on action type
    if action == "CREATE":
        if full_path.exists():
            return WriteResult(success=False, error="File already exists")
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content)

    elif action == "UPDATE":
        if not full_path.exists():
            return WriteResult(success=False, error="File does not exist")
        # Atomic write: temp → rename
        temp_path = full_path.with_suffix('.tmp')
        temp_path.write_text(content)
        temp_path.rename(full_path)

    elif action == "DELETE":
        if not full_path.exists():
            return WriteResult(success=False, error="File does not exist")
        full_path.unlink()

    return WriteResult(success=True)
```

**Test Execution:**

```python
def run_validation_test(validation: ValidationConfig) -> ValidationResult:
    """Run validation command and check output"""

    try:
        result = subprocess.run(
            validation.command.split(),
            capture_output=True,
            text=True,
            timeout=120,  # 2 minute timeout
            cwd=PROJECT_ROOT
        )

        # Check expected pattern
        if validation.expected:
            if validation.expected in result.stdout or validation.expected in result.stderr:
                return ValidationResult(success=True, output=result.stdout)
            else:
                return ValidationResult(
                    success=False,
                    output=result.stdout,
                    error=f"Expected pattern '{validation.expected}' not found"
                )

        # Check exit code
        if result.returncode == 0:
            return ValidationResult(success=True, output=result.stdout)
        else:
            return ValidationResult(
                success=False,
                output=result.stdout,
                error=f"Command exited with code {result.returncode}"
            )

    except subprocess.TimeoutExpired:
        return ValidationResult(
            success=False,
            error="Validation timeout after 120 seconds"
        )
```

#### Component 3: Context Assembly

**File:** `agents/build/context-primer.ts`

**Enhancements Needed:**

```typescript
export class ContextPrimer {
  /**
   * Assemble full context for task execution
   */
  async primeTask(task: AtomicTask, spec: string): Promise<TaskContext> {
    // 1. Extract relevant spec sections
    const specSections = this.extractRelevantSections(spec, task);

    // 2. Load dependency outputs (code from tasks this depends on)
    const dependencyOutputs = await this.loadDependencyOutputs(task.dependsOn);

    // 3. Load coding conventions
    const conventions = await this.loadConventions(task.file);

    // 4. Load related files (for pattern matching)
    const relatedFiles = await this.loadRelatedFiles(task.file);

    // 5. Load gotchas (common mistakes)
    const gotchas = await this.loadGotchas(task.file, task.action);

    // 6. Calculate token count
    const tokenCount = this.estimateTokens({
      specSections,
      dependencyOutputs,
      conventions,
      relatedFiles,
      gotchas,
    });

    // 7. Trim if needed (keep most relevant, remove least relevant)
    if (tokenCount > 180000) {
      return this.trimContext({
        task,
        specSections,
        dependencyOutputs,
        conventions,
        relatedFiles,
        gotchas,
      });
    }

    return {
      task,
      specSections,
      dependencyOutputs,
      conventions,
      relatedFiles,
      gotchas,
      tokenCount,
    };
  }
}
```

#### Component 4: Spec Parser

**New File:** `agents/build/spec-parser.ts`

```typescript
/**
 * Parse atomic tasks from specification markdown
 */
export function parseAtomicTasks(spec: string): AtomicTask[] {
  const tasks: AtomicTask[] = [];

  // Look for "## Task Breakdown" or "## Implementation Plan" section
  const taskSection = extractSection(spec, [
    "Task Breakdown",
    "Implementation Plan",
  ]);

  if (!taskSection) {
    throw new Error("Specification missing task breakdown section");
  }

  // Parse tasks (expected format from Spec Agent)
  // Each task is in format:
  // ### Task 1: Description
  // - **File**: path/to/file.ts
  // - **Action**: CREATE|UPDATE|DELETE
  // - **Validation**: command | expected output
  // - **Depends On**: Task 2, Task 3

  const taskBlocks = taskSection.split(/###\s+Task\s+\d+:/).slice(1);

  for (const block of taskBlocks) {
    const task = parseTaskBlock(block);
    tasks.push(task);
  }

  return tasks;
}
```

### Integration Points

#### 1. Spec Agent Output → Build Agent Input

**Contract:** Spec Agent must produce specifications with task breakdown section

**Format Example:**

```markdown
## Task Breakdown

### Task 1: Create user model

- **File**: `server/models/user.ts`
- **Action**: CREATE
- **Requirements**:
  - Define User interface with id, email, name fields
  - Export UserRow type for database
- **Validation**: `npm run build` | no errors
- **Depends On**: none

### Task 2: Create user service

- **File**: `server/services/user-service.ts`
- **Action**: CREATE
- **Requirements**:
  - Import User model
  - Implement createUser, getUser, updateUser functions
- **Validation**: `npm run test:api` | user-service tests pass
- **Depends On**: Task 1
```

#### 2. Build Agent Output → QA Agent Input

**Contract:** Build Agent produces execution records for validation

**Format:**

```typescript
interface BuildExecutionRecord {
  buildId: string;
  specPath: string;
  status: "completed" | "partial" | "failed";
  tasks: Array<{
    taskId: string;
    file: string;
    action: string;
    status: "completed" | "failed";
    attempts: number;
    generatedCode: string | null;
    validationOutput: string | null;
    error: string | null;
  }>;
}
```

QA Agent reads this record and verifies:

- All tasks completed successfully
- Validation tests passed
- Code follows project conventions
- No security vulnerabilities introduced

#### 3. Database Schema

**Tables Used:**

- `build_executions` - Overall build tracking
- `task_executions` - Individual task results
- `build_checkpoints` - State snapshots for recovery
- `build_agent_instances` - Worker process tracking
- `agent_heartbeats` - Liveness monitoring

**Tables Referenced:**

- `tasks` - Task definitions and metadata
- `task_lists_v2` - Task list organization
- `task_file_impacts` - Files affected by task

### Error Handling

#### 1. Generation Errors

**Scenario:** Claude API fails or returns invalid code

**Handling:**

```python
try:
    code = generate_code_with_claude(context)
except anthropic.APIError as e:
    if e.status_code == 429:  # Rate limit
        # Transient error - retry with exponential backoff
        time.sleep(calculate_backoff(attempt))
        return retry_task(task_id, attempt + 1)
    else:
        # Permanent error - escalate
        escalate_to_sia(task_id, f"Claude API error: {e}")
        return 1
```

#### 2. File System Errors

**Scenario:** Disk full, permission denied, concurrent modification

**Handling:**

```python
try:
    write_file(path, content, action)
except PermissionError:
    # Escalate - human intervention needed
    escalate_to_sia(task_id, f"Permission denied writing {path}")
    return 1
except OSError as e:
    if "No space left" in str(e):
        # Fail build - infrastructure issue
        fail_build(build_id, "Disk space exhausted")
        return 1
    else:
        raise  # Unexpected error
```

#### 3. Validation Failures

**Scenario:** Test fails after code generation

**Handling:**

```python
validation_result = run_validation_test(context.task.validation)

if not validation_result.success:
    if attempt < MAX_RETRIES:
        # Add validation output to context for next attempt
        enhanced_context = add_error_feedback(context, validation_result)
        return retry_task_with_context(task_id, enhanced_context, attempt + 1)
    else:
        # Max retries exceeded - escalate
        escalate_to_sia(
            task_id,
            f"Validation failed after {MAX_RETRIES} attempts: {validation_result.error}"
        )
        return 1
```

#### 4. Dependency Failures

**Scenario:** Task depends on failed task

**Handling:**

```typescript
// In orchestrator - check dependencies before spawning worker
const failedDependencies = task.dependsOn.filter((depId) => {
  const depResult = taskResults.get(depId);
  return depResult?.status === "failed";
});

if (failedDependencies.length > 0) {
  // Skip task - mark as blocked
  await updateTaskStatus(task.id, "blocked", {
    reason: `Dependencies failed: ${failedDependencies.join(", ")}`,
  });
  return;
}
```

---

## Pass Criteria

### 1. ✅ Specification Loading

- [ ] Load spec from `docs/specs/TASK-*.md` path
- [ ] Parse frontmatter (status, priority, effort)
- [ ] Extract task breakdown section
- [ ] Handle missing or malformed specs gracefully

**Test:**

```typescript
const spec = await loadSpecification(
  "docs/specs/PHASE2-TASK-01-spec-agent-v0.1.md",
);
expect(spec.tasks).toHaveLength(6); // Spec has 6 atomic tasks
```

### 2. ✅ Task Parsing

- [ ] Parse task ID, title, file, action, requirements, validation
- [ ] Parse dependency relationships (dependsOn)
- [ ] Validate required fields present
- [ ] Handle circular dependencies (error detection)

**Test:**

```typescript
const tasks = parseAtomicTasks(specContent);
expect(tasks[1].dependsOn).toContain(tasks[0].id); // Task 2 depends on Task 1
```

### 3. ✅ Context Assembly

- [ ] Load relevant spec sections
- [ ] Load dependency outputs (code from completed tasks)
- [ ] Load coding conventions from CLAUDE.md files
- [ ] Load related files for pattern matching
- [ ] Load gotchas from docs/gotchas/
- [ ] Respect token limits (180K context max)

**Test:**

```typescript
const context = await contextPrimer.primeTask(task, specContent);
expect(context.tokenCount).toBeLessThan(180000);
expect(context.gotchas).not.toBeEmpty();
```

### 4. ✅ Code Generation

- [ ] Call Claude Opus API with full context
- [ ] Include task requirements and gotchas
- [ ] Include error feedback from previous attempts (retry context)
- [ ] Parse code blocks from response
- [ ] Handle API errors with retry logic

**Test:**

````typescript
const code = await codeGenerator.generate(task, context);
expect(code).toContain("export"); // Generated TypeScript
expect(code).not.toContain("```"); // No markdown artifacts
````

### 5. ✅ File Writing

- [ ] CREATE: Write new file (error if exists)
- [ ] UPDATE: Modify existing file (error if missing)
- [ ] DELETE: Remove file (error if missing)
- [ ] Atomic operations (temp file → rename)
- [ ] Create parent directories as needed
- [ ] Validate path security (no traversal)

**Test:**

```typescript
const result = await fileWriter.write("test/generated.ts", code);
expect(result.success).toBe(true);
expect(fs.existsSync("test/generated.ts")).toBe(true);
```

### 6. ✅ Test Execution

- [ ] Run validation command from task
- [ ] Capture stdout/stderr
- [ ] Match expected pattern (if provided)
- [ ] Return pass/fail with output
- [ ] Handle timeouts gracefully

**Test:**

```typescript
const result = await validationRunner.run("npm run build", "no errors");
expect(result.success).toBe(true);
expect(result.output).toContain("Build succeeded");
```

### 7. ✅ Retry Logic

- [ ] Retry transient errors (rate limits, timeouts)
- [ ] Exponential backoff (1s → 2s → 4s → ...)
- [ ] Max 3 retries before escalation
- [ ] Enhanced context on retry (include previous error)
- [ ] Escalate to SIA after max retries

**Test:**

```python
# Simulate rate limit error
with mock.patch('anthropic.Client.messages.create', side_effect=RateLimitError):
    result = execute_task(task_id, agent_id)

# Should retry 3 times then escalate
assert get_task_attempts(task_id) == 3
assert get_task_status(task_id) == "escalated"
```

### 8. ✅ Error Classification

- [ ] Classify errors as transient vs permanent
- [ ] Transient: network, rate limit, OOM, 503/502
- [ ] Permanent: syntax errors, type errors, logic errors
- [ ] Immediate escalation for permanent errors
- [ ] Retry with backoff for transient errors

**Test:**

```python
assert classify_error("Rate limit exceeded") == "transient"
assert classify_error("SyntaxError: Unexpected token") == "permanent"
```

### 9. ✅ Database Integration

- [ ] Create build_executions record
- [ ] Create task_executions for each task
- [ ] Update task status after each step
- [ ] Record attempt count and errors
- [ ] Track token usage and costs
- [ ] Create checkpoints for recovery

**Test:**

```typescript
const build = await getBuildExecution(buildId);
expect(build.status).toBe("completed");
expect(build.tasksCompleted).toBe(6);
```

### 10. ✅ End-to-End Workflow

- [ ] Load spec → Parse tasks → Execute in order → Validate → Report
- [ ] Handle dependencies correctly (wait for upstream tasks)
- [ ] Skip tasks blocked by failures
- [ ] Complete successfully for simple spec
- [ ] Report detailed results for QA validation

**Integration Test:**

```typescript
// Create test spec with 3 simple tasks
const specPath = await createTestSpec({
  tasks: [
    { file: "test1.ts", action: "CREATE", validation: "tsc test1.ts" },
    {
      file: "test2.ts",
      action: "CREATE",
      validation: "tsc test2.ts",
      dependsOn: ["task1"],
    },
    {
      file: "test3.ts",
      action: "CREATE",
      validation: "tsc test3.ts",
      dependsOn: ["task2"],
    },
  ],
});

// Execute build
const result = await executeSpecification(specPath);

// Verify
expect(result.status).toBe("completed");
expect(result.tasksCompleted).toBe(3);
expect(result.tasksFailed).toBe(0);
expect(fs.existsSync("test1.ts")).toBe(true);
expect(fs.existsSync("test2.ts")).toBe(true);
expect(fs.existsSync("test3.ts")).toBe(true);
```

---

## Dependencies

### Upstream Dependencies (must exist first)

1. **PHASE2-TASK-01: Spec Agent v0.1** ✅ COMPLETE
   - Provides specifications in required format
   - Task breakdown section with atomic tasks
   - Pass criteria for validation

2. **Database Schema**
   - `build_executions` table (migration 025)
   - `task_executions` table (migration 025)
   - `build_checkpoints` table (migration 025)
   - `build_agent_instances` table (migration 054)
   - `agent_heartbeats` table (migration 054)

3. **Infrastructure**
   - Claude API key configured (ANTHROPIC_API_KEY env var)
   - Python 3.11+ with anthropic package
   - Node.js with TypeScript compilation
   - SQLite database at `database/ideas.db`

### Downstream Dependencies (blocked until this completes)

1. **PHASE2-TASK-03: QA Agent v0.1**
   - Needs build execution records to validate
   - Needs generated code to review
   - Needs test results to verify

2. **PHASE3-TASK-01: Task Queue Persistence**
   - Needs working Build Agent for integration testing
   - Needs execution metrics for optimization

3. **PHASE3-TASK-02: Wave-Based Parallelism**
   - Needs Build Agent to execute multiple tasks concurrently
   - Needs dependency handling for wave calculation

### External Dependencies

1. **Claude API (Anthropic)**
   - Opus model for code generation
   - Rate limit: 4000 requests/minute
   - Token limit: 200K context (use 180K max)

2. **File System**
   - Read/write permissions for project directory
   - Sufficient disk space for generated files
   - Atomic rename support (POSIX systems)

3. **Test Infrastructure**
   - npm scripts: `build`, `test:api`, `test:ui`
   - pytest for Python validation
   - TypeScript compiler (tsc)

---

## Implementation Notes

### Code Organization

```
agents/build/
├── core.ts                    # Main BuildAgent class (EXISTING)
├── task-executor.ts           # Task execution loop (EXISTING)
├── context-primer.ts          # Context assembly (EXISTING)
├── code-generator.ts          # Claude integration (EXISTING)
├── file-writer.ts             # File operations (EXISTING)
├── validation-runner.ts       # Test execution (EXISTING)
├── spec-parser.ts             # NEW: Parse specs → tasks
└── retry-handler.ts           # EXISTING: Retry logic

coding-loops/agents/
└── build_agent_worker.py      # ENHANCE: Add file ops + tests

server/services/task-agent/
└── build-agent-orchestrator.ts # ENHANCE: Add executeSpecification()
```

### Testing Strategy

**Unit Tests:**

- `spec-parser.test.ts` - Parse atomic tasks from markdown
- `context-primer.test.ts` - Context assembly and token management
- `file-writer.test.ts` - File operations (CREATE/UPDATE/DELETE)
- `validation-runner.test.ts` - Test execution and output parsing

**Integration Tests:**

- `build-agent-integration.test.ts` - Full pipeline with mock Claude API
- `test_build_agent_worker.py` - Python worker E2E tests

**E2E Tests:**

- `honest-validation.test.ts` - Real spec → build → validation
- Create simple test spec, execute with real Claude API, verify files created

### Performance Considerations

1. **Token Management**
   - Context assembly should prioritize most relevant information
   - Trim least important sections if over 180K tokens
   - Cache loaded files to avoid repeated reads

2. **Parallelism**
   - Execute independent tasks concurrently (Phase 3)
   - For now: sequential execution in dependency order

3. **Caching**
   - Cache Claude responses for identical contexts (future optimization)
   - Cache file reads for context assembly
   - Cache gotchas and conventions (load once per build)

### Security Considerations

1. **Path Validation**
   - Reject absolute paths (only relative from project root)
   - Reject directory traversal (../)
   - Whitelist allowed directories (agents/, server/, tests/)

2. **Code Execution**
   - Run validation tests in isolated environment (future: Docker)
   - Timeout all subprocess calls
   - Capture and sanitize output (no secrets in logs)

3. **API Key Protection**
   - Load from environment variable only
   - Never log API key or full request bodies
   - Rotate keys if compromised

### Migration Path

**Phase 1:** Basic Integration (This Task)

- Load spec → parse tasks → execute sequentially
- Simple retry logic
- Manual escalation

**Phase 2:** Enhanced Execution (PHASE3-TASK-01)

- Parallel execution with wave/lane calculation
- Automatic checkpoint/recovery
- Resource conflict detection

**Phase 3:** Self-Improvement (PHASE4-TASK-04)

- Learning from build failures
- Pattern recognition for common errors
- Context optimization based on success rates

---

## Success Metrics

### Quantitative Metrics

1. **Build Success Rate**
   - Target: >80% of tasks complete on first attempt
   - Measure: `tasksCompleted / tasksTotal` across all builds

2. **Retry Efficiency**
   - Target: <20% of tasks require retries
   - Measure: `tasksWithRetries / tasksTotal`

3. **Escalation Rate**
   - Target: <10% of tasks escalate to SIA
   - Measure: `tasksEscalated / tasksTotal`

4. **Validation Pass Rate**
   - Target: >90% of generated code passes validation
   - Measure: `validationsPassed / validationsRun`

5. **End-to-End Pipeline**
   - Target: 100% of Spec Agent outputs executable by Build Agent
   - Measure: `successfulBuilds / totalSpecs`

### Qualitative Metrics

1. **Code Quality**
   - Generated code follows project conventions
   - No security vulnerabilities introduced
   - Readable and maintainable

2. **Error Messages**
   - Clear and actionable error messages
   - Sufficient context for debugging
   - Proper error classification

3. **Developer Experience**
   - Easy to understand build logs
   - Clear progress indicators
   - Helpful retry context

---

## Risks & Mitigations

| Risk                        | Impact | Probability | Mitigation                                         |
| --------------------------- | ------ | ----------- | -------------------------------------------------- |
| Claude API rate limits      | High   | Medium      | Implement exponential backoff, queue management    |
| Generated code has bugs     | High   | High        | Comprehensive validation tests, multiple retries   |
| Context exceeds token limit | Medium | Medium      | Prioritized context assembly, intelligent trimming |
| File system errors          | Medium | Low         | Atomic operations, proper error handling           |
| Infinite retry loops        | Medium | Medium      | Max retry limit, escalation trigger                |
| Dependency resolution fails | High   | Low         | Topological sort, cycle detection                  |
| Validation tests timeout    | Low    | Medium      | Configurable timeouts, graceful handling           |
| Database corruption         | High   | Very Low    | Atomic transactions, checkpoints                   |

---

## Future Enhancements (Out of Scope)

1. **Caching Layer** - Cache Claude responses for identical contexts
2. **Parallel Execution** - Execute independent tasks concurrently (PHASE3-TASK-02)
3. **Checkpointing** - Resume builds from last successful task
4. **Docker Isolation** - Run validation tests in containers
5. **Learning System** - Improve prompts based on success patterns (PHASE4-TASK-04)
6. **Diff-Based Updates** - For UPDATE operations, generate minimal diffs
7. **Multi-File Tasks** - Tasks that modify multiple files atomically
8. **Interactive Debugging** - Pause on error for human inspection

---

## References

### Documentation

- [STRATEGIC_PLAN.md](../../STRATEGIC_PLAN.md) - Phase 2 roadmap
- [PHASE2-TASK-01-spec-agent-v0.1.md](./PHASE2-TASK-01-spec-agent-v0.1.md) - Spec Agent specification
- [build-agent-dependency-resolution.md](../build-agent-dependency-resolution.md) - Dependency handling

### Code References

- `agents/build/core.ts` - BuildAgent main class
- `agents/build/task-executor.ts` - Task execution framework
- `coding-loops/agents/build_agent_worker.py` - Python worker implementation
- `server/services/task-agent/build-agent-orchestrator.ts` - TypeScript orchestrator
- `types/build-agent.ts` - Type definitions

### Database Schema

- Migration 025: `build_executions`, `task_executions`, `build_checkpoints`
- Migration 054: `build_agent_instances`, `agent_heartbeats`

### External APIs

- [Claude API Documentation](https://docs.anthropic.com/claude/reference) - Opus model usage
- [Claude Code](https://github.com/anthropics/claude-code) - Patterns for code generation

---

**End of Specification**
