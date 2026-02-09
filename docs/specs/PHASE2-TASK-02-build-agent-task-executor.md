# PHASE2-TASK-02: Build Agent Task Executor with File Modification + Test Running

**Status:** Specification
**Created:** 2026-02-08
**Priority:** P0 (Critical Path - Phase 2)
**Effort:** Large (10-15 hours)
**Model:** Opus
**Agent Type:** build_agent
**Dependencies:** PHASE2-TASK-01 (Spec Agent v0.1)

---

## Overview

Implement the Build Agent task executor as the core implementation component of the autonomous task execution pipeline (Spec Agent → **Build Agent** → QA Agent). The Build Agent reads technical specifications, modifies files, runs tests, and validates its work autonomously.

This is the **critical execution engine** for Phase 2's autonomous development vision. While Spec Agent provides clarity and QA Agent validates quality, Build Agent is where the actual implementation happens.

### Problem Statement

**Current State:**
- Build Agent orchestrator exists (`build-agent-orchestrator.ts`) for spawning agents
- Python worker exists (`build_agent_worker.py`) but is incomplete for spec-driven execution
- No integration between Spec Agent output and Build Agent input
- No systematic file modification workflow based on specifications
- Test running is ad-hoc without structured validation against pass criteria

**Desired State:**
- Build Agent reads specs from `docs/specs/` directory
- Parses specifications to extract requirements, technical design, pass criteria
- Modifies files systematically based on technical design section
- Runs appropriate tests (unit, integration, compilation) automatically
- Validates work against specification pass criteria
- Reports completion or failure with structured error information

### Value Proposition

The Build Agent serves as the **"Implementation Executor"** between specification and validation:

1. **Enables Autonomous Development** - Implements features without human coding
2. **Maintains Code Quality** - Follows existing patterns discovered from specs
3. **Reduces Iteration Cycles** - Self-validates before QA to catch errors early
4. **Scales Parallelism** - Multiple Build Agents work on independent tasks simultaneously
5. **Provides Traceability** - Logs all file changes and test runs for debugging

---

## Requirements

### Functional Requirements

#### FR-1: Specification Reading and Parsing

**Input:** Task record with `spec_file_path` populated by Spec Agent

```typescript
interface Task {
  id: string;
  display_id: string;          // e.g., "TASK-042"
  title: string;
  spec_file_path: string;       // e.g., "docs/specs/TASK-042-user-auth.md"
  status: 'ready';              // Set by Spec Agent when spec complete
  assigned_agent_id: 'build_agent';
}
```

**Process:**
1. Read specification file from `spec_file_path`
2. Parse markdown to extract key sections:
   - **Requirements**: What functionality to implement
   - **Technical Design**: Files to create/modify, architecture
   - **Pass Criteria**: Testable validation points
   - **Implementation Plan**: Phased breakdown of work
3. Build task execution context with all relevant information
4. Validate spec completeness (all required sections present)

**Output:** Structured task context for agent execution

```typescript
interface TaskExecutionContext {
  taskId: string;
  displayId: string;
  specification: {
    overview: string;
    requirements: {
      functional: string[];
      nonFunctional: string[];
    };
    technicalDesign: {
      filesToCreate: string[];
      filesToModify: string[];
      architecture: string;
      keyComponents: string;
    };
    passCriteria: string[];
    implementationPlan: {
      phase: number;
      description: string;
      steps: string[];
    }[];
  };
  specPath: string;
  codebasePatterns: Record<string, string>; // Patterns referenced in spec
}
```

#### FR-2: Codebase Exploration

Before implementing, Build Agent must:

**Explore Referenced Files:**
- Read all files mentioned in Technical Design section
- Understand existing patterns, naming conventions, structure
- Identify interfaces, types, functions that need integration

**Discover Related Files:**
- Find similar implementations (e.g., other API endpoints if adding new endpoint)
- Locate test files that may need updates
- Check for existing utilities that can be reused

**Pattern Analysis:**
- Extract coding style (indentation, quotes, semicolons)
- Identify error handling patterns
- Note testing conventions (describe/it structure, mock patterns)
- Understand import/export patterns

**Example for "Add user authentication" task:**
```typescript
// Build Agent reads spec, which references:
- server/routes/auth.ts
- server/middleware/auth-middleware.ts
- database/migrations/042_users_table.sql

// Build Agent then explores:
- server/routes/*.ts (other route patterns)
- server/middleware/*.ts (middleware conventions)
- tests/integration/routes/*.test.ts (testing patterns)
```

#### FR-3: File Modification Workflow

**Process:**
1. **Create Implementation Plan** from spec's Implementation Plan section
2. **For each file operation:**
   - **CREATE new file**: Use Write tool with template based on patterns
   - **MODIFY existing file**: Use Edit tool for targeted changes
   - **DELETE sections**: Use Edit tool to replace with empty string
3. **Maintain atomic commits**: Group related changes together
4. **Follow spec order**: Implement phases sequentially (DB → Types → Logic → API → Tests)

**File Operations:**

```typescript
// Example: Create new API endpoint
// Spec says: "Create server/routes/auth.ts with login and register endpoints"

// 1. Read existing route file for pattern
const userRoutes = await readFile('server/routes/users.ts');

// 2. Extract pattern (Express Router, error handling, validation)
const pattern = analyzePattern(userRoutes);

// 3. Create new file following pattern
await writeFile('server/routes/auth.ts', generateAuthRoutes(pattern));

// 4. Update route index to register new routes
await editFile('server/routes/index.ts', {
  old: "export { userRouter } from './users.js';",
  new: "export { userRouter } from './users.js';\nexport { authRouter } from './auth.js';"
});
```

**Code Generation Guidelines:**
- Follow existing patterns discovered from codebase exploration
- Use TypeScript with proper type annotations
- Include error handling matching project conventions
- Add JSDoc comments for public APIs
- Import dependencies in consistent order
- Match indentation and formatting style

#### FR-4: Test Execution and Validation

**Test Strategy (from spec):**
Each spec includes Testing Strategy section:
```markdown
## Testing Strategy
- Unit tests: `npm test -- auth.test.ts`
- Integration tests: `npm test -- integration/auth`
- Type check: `npm run typecheck`
- Manual verification: `curl -X POST http://localhost:3001/api/auth/login`
```

**Execution Process:**
1. **Pre-implementation validation**: Run existing tests to establish baseline
2. **Incremental testing**: After each phase, run relevant tests
3. **Comprehensive validation**: Run full test suite before completion
4. **Pass criteria verification**: Explicitly check each criterion from spec

**Test Execution:**

```typescript
interface TestExecution {
  testId: string;
  command: string;               // e.g., "npm test -- auth.test.ts"
  expectedPattern?: string;      // Optional regex for pass detection
  timeout: number;               // milliseconds
  requiredForCompletion: boolean; // Must pass to complete task
}

interface TestResult {
  testId: string;
  passed: boolean;
  output: string;
  duration: number;
  error?: string;
}
```

**Test Types:**

| Test Level | Command | When to Run | Required |
|------------|---------|-------------|----------|
| TypeScript Compilation | `npx tsc --noEmit` | After every file change | ✅ Yes |
| Unit Tests | `npm test -- <file>.test.ts` | After logic changes | ✅ Yes |
| Integration Tests | `npm test -- integration/<module>` | After API/DB changes | ✅ Yes |
| Linting | `npm run lint` | Before completion | ⚠️ Optional |
| Full Suite | `npm test` | Before completion | ⚠️ Optional |

**Pass Criteria Validation:**

Specs include explicit pass criteria like:
```markdown
## Pass Criteria
1. ✅ POST /api/auth/login returns 200 with JWT token when credentials valid
2. ✅ POST /api/auth/login returns 401 when password incorrect
3. ✅ Protected routes return 403 when no auth token provided
4. ✅ npm test passes all auth integration tests
5. ✅ TypeScript compilation passes with no errors
```

Build Agent must:
- Parse pass criteria into testable checks
- Execute relevant tests/commands
- Verify each criterion explicitly
- Report which criteria passed/failed

#### FR-5: Error Handling and Recovery

**Error Classification:**

Build Agent classifies errors to determine retry strategy (from `build_agent_worker.py` lines 164-200):

```python
class ErrorClassifier:
    TRANSIENT_PATTERNS = [
        'ETIMEDOUT', 'ECONNRESET', 'rate limit', '429', '503', '502'
    ]
    PERMANENT_PATTERNS = [
        'Syntax error', 'Type error', 'Cannot find module',
        'Test failed', 'ENOENT'
    ]
```

**Error Types:**

| Category | Examples | Retry Strategy | Max Retries |
|----------|----------|----------------|-------------|
| Transient | Network timeout, rate limit | Fast exponential backoff (30s, 1m, 2m) | 5 |
| Code Error | TypeScript error, syntax error | Medium delay (2m, 5m, 15m) | 3 |
| Test Failure | Assertion failed, test timeout | Medium delay (2m, 5m, 15m) | 3 |
| Resource | Out of memory, disk full | Long delay (15m, 30m, 60m) | 2 |
| Unknown | Unexpected error | Default medium delay | 3 |

**Recovery Actions:**

1. **Transient Errors**: Retry immediately with backoff
2. **Code Errors**:
   - Analyze error message for file/line info
   - Read relevant file section
   - Attempt fix based on error message
   - Retry with corrected code
3. **Test Failures**:
   - Analyze test output for assertion details
   - Check if implementation matches spec requirements
   - Adjust implementation logic
   - Retry tests
4. **Resource Errors**: Wait for resources to free up
5. **Unknown Errors**: Escalate to SIA (Self-Improvement Agent) after 3 failures

**Failure Reporting:**

```typescript
interface FailureReport {
  taskId: string;
  errorType: string;           // 'transient' | 'code_error' | 'test_failure' | 'resource' | 'unknown'
  errorMessage: string;
  errorLocation?: string;      // file:line if available
  attemptNumber: number;
  maxAttempts: number;
  nextRetryAt?: string;        // ISO timestamp
  stackTrace?: string;
  suggestedFix?: string;
  escalateToSIA: boolean;
}
```

#### FR-6: Agent Session Management

**Session Lifecycle:**

```
1. Orchestrator assigns task to build_agent
2. Spawn Build Agent session (via build-agent-orchestrator.ts)
3. Build Agent worker process starts (build_agent_worker.py)
4. Session heartbeats every 30 seconds
5. Work execution (file mods, tests, validation)
6. Session completion (exit code 0 = success, non-zero = failure)
7. Orchestrator processes result, spawns next wave
```

**Heartbeat Mechanism:**

```typescript
interface AgentHeartbeat {
  agentId: string;
  taskId: string;
  status: 'running' | 'testing' | 'validating' | 'stuck';
  progressPercent?: number;
  currentStep?: string;       // e.g., "Running unit tests"
  memoryMb?: number;
  cpuPercent?: number;
  timestamp: string;
}
```

Heartbeats sent to `agent_heartbeats` table (from `build-agent-orchestrator.ts` lines 678-709).

**Session States:**

| State | Description | Transitions To |
|-------|-------------|----------------|
| spawning | Process starting | running, terminated |
| running | Actively executing task | testing, completed, failed |
| testing | Running validation tests | validating, failed |
| validating | Checking pass criteria | completed, failed |
| completed | Task finished successfully | N/A (terminal) |
| failed | Task execution failed | N/A (terminal, retry creates new session) |
| terminated | Process killed/crashed | N/A (terminal) |

#### FR-7: Output Format and Reporting

**Completion Report:**

```markdown
# Build Agent Report: TASK-042

**Status:** ✅ Completed
**Duration:** 4m 23s
**Files Modified:** 8
**Tests Run:** 12 passed, 0 failed

## Implementation Summary

Created user authentication system with JWT tokens.

### Files Created
- server/routes/auth.ts (247 lines)
- server/middleware/auth-middleware.ts (89 lines)
- database/migrations/042_users_table.sql (34 lines)
- tests/integration/auth.test.ts (156 lines)

### Files Modified
- server/routes/index.ts (+2 lines)
- server/types/user.ts (+15 lines)
- database/schema.ts (+8 lines)
- tests/integration/setup.ts (+12 lines)

## Pass Criteria Validation

1. ✅ POST /api/auth/login returns 200 with JWT token when credentials valid
   - Test: `auth.test.ts:45` - PASSED
2. ✅ POST /api/auth/login returns 401 when password incorrect
   - Test: `auth.test.ts:62` - PASSED
3. ✅ Protected routes return 403 when no auth token provided
   - Test: `auth-middleware.test.ts:28` - PASSED
4. ✅ npm test passes all auth integration tests
   - Command: `npm test -- integration/auth` - 12/12 PASSED
5. ✅ TypeScript compilation passes with no errors
   - Command: `npx tsc --noEmit` - SUCCESS

## Test Results

### Unit Tests (8 passed)
- ✅ auth.test.ts: 6 passed in 234ms
- ✅ auth-middleware.test.ts: 2 passed in 89ms

### Integration Tests (4 passed)
- ✅ integration/auth.test.ts: 4 passed in 1.2s

### Type Checking
- ✅ TypeScript compilation successful

## Git Commit

```
feat(auth): implement user authentication with JWT

- Add auth routes for login and registration
- Create auth middleware for protected routes
- Add users table migration with password hashing
- Implement JWT token generation and validation
- Add comprehensive test coverage

Closes: TASK-042
```

## Ready for QA

Task is ready for QA Agent validation.
```

**Failure Report:**

```markdown
# Build Agent Report: TASK-043

**Status:** ❌ Failed
**Duration:** 2m 47s
**Attempt:** 2 / 3
**Next Retry:** 2026-02-08T16:15:00Z (in 5 minutes)

## Error Details

**Type:** code_error
**Category:** TypeScript compilation error

### Error Message

```
server/routes/payments.ts:42:18 - error TS2339: Property 'amount' does not exist on type 'PaymentRequest'.

42     const total = req.body.amount * 1.1;
                    ~~~~~~~~~~~~~~~~~~
```

### Error Location
- File: server/routes/payments.ts
- Line: 42
- Column: 18

### Root Cause Analysis

The PaymentRequest type is missing the 'amount' field. Spec requires amount field but type definition doesn't include it.

### Suggested Fix

Add `amount: number` to PaymentRequest interface in `server/types/payment.ts`.

### Files Modified (Before Failure)
- server/routes/payments.ts (CREATED)
- server/types/payment.ts (CREATED - INCOMPLETE)

## Retry Plan

**Next Steps:**
1. Fix PaymentRequest type definition
2. Re-run TypeScript compilation
3. Continue with test execution if compilation passes

**Escalation:**
If failure persists after attempt 3/3, task will be escalated to SIA for diagnosis.
```

### Non-Functional Requirements

#### NFR-1: Performance

- **Spec Parsing**: < 5 seconds per specification
- **File Operations**: < 10 files modified per minute
- **Test Execution**: Timeout after 5 minutes for full suite
- **Heartbeat Frequency**: Every 30 seconds
- **Session Lifetime**: < 15 minutes for simple tasks, < 60 minutes for complex

#### NFR-2: Reliability

- **Crash Recovery**: Agent crash does not corrupt task state
- **Idempotency**: Retrying same task produces same result
- **Atomicity**: File changes committed together via git
- **State Persistence**: Progress tracked in database, survives orchestrator restarts

#### NFR-3: Resource Management

- **Memory**: < 512MB per agent session
- **CPU**: < 100% of one core (no blocking operations)
- **Disk**: Clean up temp files after completion
- **Concurrency**: Support up to 5 concurrent Build Agent sessions

#### NFR-4: Observability

- **Logging**: All tool uses logged with timestamps
- **Tracing**: Session ID attached to all logs
- **Metrics**: Track success rate, avg duration, error types
- **Debugging**: Full error context captured for failures

---

## Technical Design

### Architecture

```
Orchestrator (TypeScript)
    ↓ assigns task with status='ready'
    ↓ spec_file_path populated by Spec Agent
┌────────────────────────────────────────────────┐
│  Build Agent Orchestrator                      │
│  (build-agent-orchestrator.ts)                 │
│                                                │
│  - Spawns Python Build Agent worker process    │
│  - Monitors heartbeats                         │
│  - Handles process exit codes                  │
│  - Updates task status in database             │
│  - Triggers next wave on completion            │
└────────────────────────────────────────────────┘
    ↓ spawns subprocess
┌────────────────────────────────────────────────┐
│  Build Agent Worker (Python)                   │
│  (build_agent_worker.py)                       │
│                                                │
│  Phase 1: Spec Reading & Parsing              │
│    - Read spec file from spec_file_path        │
│    - Parse markdown sections                   │
│    - Extract requirements, design, criteria    │
│    - Build task execution context              │
│                                                │
│  Phase 2: Codebase Exploration                 │
│    - Read files from Technical Design          │
│    - Discover related implementations          │
│    - Analyze patterns and conventions          │
│    - Build code generation templates           │
│                                                │
│  Phase 3: Implementation Execution             │
│    - FOR each phase in Implementation Plan:    │
│      - Create/modify files per Technical Design│
│      - Run incremental tests (type check)      │
│      - Validate against patterns               │
│      - Send heartbeat with progress            │
│                                                │
│  Phase 4: Test & Validation                    │
│    - Run unit tests for modified modules       │
│    - Run integration tests if API/DB changed   │
│    - Validate each pass criterion explicitly   │
│    - Generate completion report                │
│                                                │
│  Phase 5: Completion & Reporting               │
│    - Create git commit with changes            │
│    - Update task status to 'pending_validation'│
│    - Write report to task execution log        │
│    - Exit with code 0 (success) or non-zero    │
└────────────────────────────────────────────────┘
    ↓ exit code
Orchestrator receives completion
    ↓ success → assign to QA Agent
    ↓ failure → retry or escalate
```

### Key Components

#### 1. Build Agent Orchestrator (EXISTING, MINOR UPDATES)

**File:** `parent-harness/orchestrator/src/server/services/task-agent/build-agent-orchestrator.ts`

**Status:** ✅ Already implemented (lines 1-1204)

**Current Features:**
- ✅ `spawnBuildAgent(taskId, taskListId)` - Spawns Python worker
- ✅ `handleAgentCompletion(agentId, taskListId)` - Spawns next wave
- ✅ `handleAgentFailure(agentId, taskId, taskListId, errorMessage)` - Retry logic
- ✅ `recordHeartbeat(heartbeat)` - Tracks agent health
- ✅ `getActiveAgents(taskListId)` - Query active sessions

**Required Updates:**

```typescript
// Update spawn command to pass spec_file_path
export async function spawnBuildAgent(
  taskId: string,
  taskListId: string,
): Promise<BuildAgentInstance> {
  // ... existing code ...

  // NEW: Get task to read spec_file_path
  const task = await getOne<{ spec_file_path: string }>(
    'SELECT spec_file_path FROM tasks WHERE id = ?',
    [taskId]
  );

  if (!task?.spec_file_path) {
    throw new Error(`Task ${taskId} missing spec_file_path - ensure Spec Agent completed`);
  }

  // Pass spec path to Python worker
  const agentProcess = spawn(
    "python3",
    [
      "coding-loops/agents/build_agent_worker.py",
      "--agent-id", id,
      "--task-id", taskId,
      "--task-list-id", taskListId,
      "--spec-file", task.spec_file_path,  // NEW: Pass spec path
    ],
    // ... rest of spawn config ...
  );
}
```

#### 2. Build Agent Worker - Spec Parser (NEW MODULE)

**File:** `coding-loops/agents/build_agent/spec_parser.py` (NEW)

```python
"""
Specification Parser for Build Agent

Reads markdown specifications and extracts structured data.
"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

@dataclass
class SpecSection:
    """Parsed specification section"""
    title: str
    content: str
    subsections: Dict[str, str]

@dataclass
class ParsedSpec:
    """Fully parsed specification"""
    task_id: str
    title: str
    overview: str
    requirements: Dict[str, List[str]]  # functional, non-functional
    technical_design: Dict[str, str]    # architecture, components, integration
    pass_criteria: List[str]
    implementation_plan: List[Dict[str, any]]
    testing_strategy: str
    dependencies: Dict[str, List[str]]  # upstream, downstream

    # Extracted file operations
    files_to_create: List[str]
    files_to_modify: List[str]
    files_to_read: List[str]  # For pattern discovery

class SpecParser:
    """Parse markdown specification into structured data"""

    def parse_file(self, spec_path: Path) -> ParsedSpec:
        """Parse specification file"""
        content = spec_path.read_text()

        # Extract sections by ## headers
        sections = self._parse_sections(content)

        # Extract task ID from title (e.g., "# TASK-042: User Auth")
        task_id = self._extract_task_id(sections.get('title', ''))

        # Parse each section
        overview = sections.get('Overview', '')
        requirements = self._parse_requirements(sections.get('Requirements', ''))
        technical_design = self._parse_technical_design(sections.get('Technical Design', ''))
        pass_criteria = self._parse_pass_criteria(sections.get('Pass Criteria', ''))
        implementation_plan = self._parse_implementation_plan(sections.get('Implementation Plan', ''))
        testing_strategy = sections.get('Testing Strategy', '')
        dependencies = self._parse_dependencies(sections.get('Dependencies', ''))

        # Extract file operations from Technical Design
        files_to_create = self._extract_files_to_create(technical_design)
        files_to_modify = self._extract_files_to_modify(technical_design)
        files_to_read = self._extract_referenced_files(technical_design)

        return ParsedSpec(
            task_id=task_id,
            title=sections.get('title', ''),
            overview=overview,
            requirements=requirements,
            technical_design=technical_design,
            pass_criteria=pass_criteria,
            implementation_plan=implementation_plan,
            testing_strategy=testing_strategy,
            dependencies=dependencies,
            files_to_create=files_to_create,
            files_to_modify=files_to_modify,
            files_to_read=files_to_read,
        )

    def _parse_sections(self, content: str) -> Dict[str, str]:
        """Split markdown into sections by ## headers"""
        sections = {}
        current_section = None
        current_content = []

        for line in content.split('\n'):
            if line.startswith('## '):
                if current_section:
                    sections[current_section] = '\n'.join(current_content)
                current_section = line[3:].strip()
                current_content = []
            elif line.startswith('# '):
                sections['title'] = line[2:].strip()
            else:
                current_content.append(line)

        if current_section:
            sections[current_section] = '\n'.join(current_content)

        return sections

    def _extract_task_id(self, title: str) -> str:
        """Extract TASK-XXX from title"""
        match = re.search(r'(TASK-\d+|PHASE\d+-TASK-\d+)', title)
        return match.group(1) if match else 'UNKNOWN'

    def _parse_pass_criteria(self, criteria_section: str) -> List[str]:
        """Extract pass criteria as list"""
        criteria = []
        for line in criteria_section.split('\n'):
            # Match numbered criteria: "1. ✅ TypeScript compiles"
            match = re.match(r'^\d+\.\s+[✅❌]?\s*(.+)$', line.strip())
            if match:
                criteria.append(match.group(1))
        return criteria

    # ... additional parsing methods ...
```

#### 3. Build Agent Worker - Code Executor (ENHANCE EXISTING)

**File:** `coding-loops/agents/build_agent_worker.py` (lines 1-200 exist, enhance rest)

**Current Status:** ✅ Basic structure exists (Database, ErrorClassifier, WorkerConfig)

**Required Enhancements:**

```python
class BuildAgentExecutor:
    """Main execution engine for Build Agent tasks"""

    def __init__(self, agent_id: str, task_id: str, task_list_id: str, spec_file: Path):
        self.agent_id = agent_id
        self.task_id = task_id
        self.task_list_id = task_list_id
        self.spec_file = spec_file
        self.db = Database(WorkerConfig().db_path)
        self.spec_parser = SpecParser()
        self.file_modifier = FileModifier()
        self.test_runner = TestRunner()
        self.heartbeat_thread = None

    def execute(self) -> int:
        """
        Main execution loop

        Returns:
            0 for success, non-zero for failure
        """
        try:
            # Start heartbeat thread
            self._start_heartbeat()

            # Phase 1: Parse specification
            print(f"[BuildAgent] Reading spec: {self.spec_file}")
            spec = self.spec_parser.parse_file(self.spec_file)
            self._send_heartbeat("Parsed specification", 10)

            # Phase 2: Explore codebase
            print(f"[BuildAgent] Exploring codebase patterns...")
            patterns = self._explore_codebase(spec)
            self._send_heartbeat("Explored codebase", 20)

            # Phase 3: Execute implementation plan
            print(f"[BuildAgent] Executing implementation plan ({len(spec.implementation_plan)} phases)...")
            for i, phase in enumerate(spec.implementation_plan):
                progress = 20 + (i / len(spec.implementation_plan)) * 50
                self._execute_implementation_phase(phase, spec, patterns)
                self._send_heartbeat(f"Completed {phase['description']}", progress)

            # Phase 4: Run tests and validate
            print(f"[BuildAgent] Running validation tests...")
            test_results = self._run_tests(spec)
            self._send_heartbeat("Ran tests", 80)

            # Phase 5: Validate pass criteria
            print(f"[BuildAgent] Validating pass criteria...")
            validation = self._validate_pass_criteria(spec, test_results)
            self._send_heartbeat("Validated criteria", 90)

            if not validation.all_passed:
                raise BuildError(f"Pass criteria validation failed: {validation.failures}")

            # Phase 6: Create report and commit
            report = self._generate_report(spec, test_results, validation)
            self._create_git_commit(spec)
            self._update_task_status('completed', report)

            print(f"[BuildAgent] ✅ Task completed successfully")
            return 0

        except BuildError as e:
            print(f"[BuildAgent] ❌ Build failed: {e}")
            self._handle_failure(e)
            return 1
        except Exception as e:
            print(f"[BuildAgent] ❌ Unexpected error: {e}")
            self._handle_failure(e)
            return 2
        finally:
            self._stop_heartbeat()
            self.db.close()

    def _explore_codebase(self, spec: ParsedSpec) -> Dict[str, any]:
        """Explore codebase to understand patterns"""
        patterns = {
            'coding_style': {},
            'import_patterns': [],
            'error_handling': [],
            'test_patterns': [],
        }

        # Read files mentioned in spec for pattern discovery
        for file_path in spec.files_to_read:
            if Path(file_path).exists():
                content = Path(file_path).read_text()
                patterns['coding_style'].update(self._analyze_style(content))
                patterns['import_patterns'].extend(self._extract_imports(content))

        return patterns

    def _execute_implementation_phase(
        self,
        phase: Dict[str, any],
        spec: ParsedSpec,
        patterns: Dict[str, any]
    ) -> None:
        """Execute one phase of implementation plan"""
        print(f"[BuildAgent] Phase: {phase['description']}")

        # Determine files to create/modify based on phase description
        # This would use Claude API to generate code based on:
        # - Spec requirements
        # - Technical design
        # - Discovered patterns
        # - Phase-specific instructions

        # For now, placeholder for code generation
        # Real implementation would call Claude API with context
        pass

    def _run_tests(self, spec: ParsedSpec) -> Dict[str, TestResult]:
        """Run tests defined in spec"""
        results = {}

        # Extract test commands from Testing Strategy section
        test_commands = self._parse_test_commands(spec.testing_strategy)

        for test_name, command in test_commands.items():
            result = self.test_runner.run(command)
            results[test_name] = result

        return results

    def _validate_pass_criteria(
        self,
        spec: ParsedSpec,
        test_results: Dict[str, TestResult]
    ) -> ValidationResult:
        """Validate each pass criterion"""
        validation = ValidationResult()

        for criterion in spec.pass_criteria:
            # Match criterion to test result
            # e.g., "TypeScript compilation passes" → test_results['typecheck']
            passed = self._check_criterion(criterion, test_results)
            validation.add_result(criterion, passed)

        return validation

    # ... additional helper methods ...
```

#### 4. File Modifier Module (NEW)

**File:** `coding-loops/agents/build_agent/file_modifier.py` (NEW)

```python
"""
File modification utilities for Build Agent

Handles file creation, editing, and deletion with pattern awareness.
"""

from pathlib import Path
from typing import Optional

class FileModifier:
    """Modify files following codebase patterns"""

    def create_file(self, path: Path, content: str) -> None:
        """Create new file with content"""
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        print(f"[FileModifier] Created: {path}")

    def modify_file(self, path: Path, old_content: str, new_content: str) -> None:
        """Modify existing file by replacing content"""
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        content = path.read_text()

        if old_content not in content:
            raise ValueError(f"Old content not found in {path}")

        modified = content.replace(old_content, new_content)
        path.write_text(modified)
        print(f"[FileModifier] Modified: {path}")

    def append_to_file(self, path: Path, content: str) -> None:
        """Append content to existing file"""
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        with path.open('a') as f:
            f.write('\n' + content)
        print(f"[FileModifier] Appended to: {path}")
```

#### 5. Test Runner Module (NEW)

**File:** `coding-loops/agents/build_agent/test_runner.py` (NEW)

```python
"""
Test execution for Build Agent

Runs tests and parses results.
"""

import subprocess
from dataclasses import dataclass
from typing import Optional

@dataclass
class TestResult:
    """Result of test execution"""
    passed: bool
    output: str
    duration: float  # seconds
    error: Optional[str] = None

class TestRunner:
    """Execute tests and parse results"""

    def run(self, command: str, timeout: int = 300) -> TestResult:
        """Run test command and return result"""
        import time

        start = time.time()

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=Path.cwd(),
            )

            duration = time.time() - start
            passed = result.returncode == 0
            output = result.stdout + result.stderr

            return TestResult(
                passed=passed,
                output=output,
                duration=duration,
                error=None if passed else f"Exit code: {result.returncode}"
            )

        except subprocess.TimeoutExpired:
            return TestResult(
                passed=False,
                output="",
                duration=timeout,
                error=f"Test timeout after {timeout}s"
            )
        except Exception as e:
            return TestResult(
                passed=False,
                output="",
                duration=time.time() - start,
                error=str(e)
            )
```

### Database Schema

**No changes required** - Existing schema supports all needed fields:

```sql
-- Existing tables (already in schema)

-- Tasks table has all needed fields
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  title TEXT NOT NULL,
  spec_file_path TEXT,           -- Path to spec (set by Spec Agent)
  status TEXT DEFAULT 'pending', -- 'ready' when spec complete
  retry_count INTEGER DEFAULT 0,
  -- ... other fields ...
);

-- Build agent instances tracked
CREATE TABLE build_agent_instances (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  status TEXT,  -- 'spawning', 'running', 'testing', 'validating', 'completed', 'failed'
  -- ... heartbeat fields ...
);

-- Heartbeats for monitoring
CREATE TABLE agent_heartbeats (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task_id TEXT,
  status TEXT,
  progress_percent REAL,
  current_step TEXT,
  -- ... other fields ...
);
```

### Integration Points

#### 1. Spec Agent → Build Agent Handoff

```
1. Spec Agent completes specification
2. Writes spec to docs/specs/TASK-{ID}.md
3. Updates task:
   - spec_file_path = "docs/specs/TASK-{ID}.md"
   - status = 'ready'
4. Emits event: task:spec_complete
5. Orchestrator detects task with status='ready'
6. Assigns to build_agent
7. Spawns Build Agent session with --spec-file parameter
```

#### 2. Build Agent → QA Agent Handoff

```
1. Build Agent completes implementation
2. Creates git commit (not pushed yet)
3. Updates task:
   - status = 'pending_verification'
   - completion_report = <markdown report>
4. Emits event: task:build_complete
5. Orchestrator detects task with status='pending_verification'
6. Assigns to qa_agent
7. QA Agent validates against pass criteria
8. If valid: push commit, mark completed
9. If invalid: revert changes, mark failed, retry
```

#### 3. Build Agent Error → Retry/SIA Escalation

```
1. Build Agent fails with error
2. Error classified by ErrorClassifier
3. If retryable:
   - Increment retry_count
   - Calculate retry delay based on error type
   - Update status = 'pending' with retry_after timestamp
   - Orchestrator retries after delay
4. If max retries exceeded:
   - Update status = 'blocked'
   - Escalate to SIA (Self-Improvement Agent)
   - SIA analyzes failure, proposes fixes
```

### Error Handling

#### 1. Spec File Missing

**Scenario:** Task assigned without spec_file_path

**Recovery:**
```python
if not spec_file or not Path(spec_file).exists():
    raise BuildError(
        "Spec file missing - ensure Spec Agent completed before Build Agent"
    )
```
**Orchestrator Action:** Mark task as `blocked`, escalate to human

#### 2. Spec Parsing Failure

**Scenario:** Malformed specification markdown

**Recovery:**
```python
try:
    spec = spec_parser.parse_file(spec_file)
except SpecParseError as e:
    # Log error details
    print(f"[BuildAgent] Spec parse failed: {e}")
    # Try to salvage partial spec
    spec = spec_parser.parse_partial(spec_file)
    if not spec.has_minimum_sections():
        raise BuildError(f"Spec incomplete: {e}")
```
**Action:** If minimum sections missing, fail fast and notify

#### 3. Code Generation Failure

**Scenario:** Claude API error, rate limit, or network timeout

**Recovery:**
- Classify as transient error
- Retry with exponential backoff (30s, 1m, 2m)
- If persistent, escalate to SIA

#### 4. Test Failure

**Scenario:** Tests fail after implementation

**Recovery:**
```python
if test_results.failed_count > 0:
    # Analyze test output
    failure_analysis = analyze_test_failures(test_results)

    # Attempt fix if pattern recognized
    if failure_analysis.has_suggested_fix:
        apply_fix(failure_analysis.suggested_fix)
        test_results = run_tests_again()

    # If still failing, report with details
    if test_results.failed_count > 0:
        raise BuildError(
            f"Tests failed: {test_results.failed_count} failures\n"
            f"Details: {failure_analysis.summary}"
        )
```
**Action:** Retry with fix suggestion, escalate if persists

#### 5. Resource Exhaustion

**Scenario:** Out of memory, disk full, CPU timeout

**Recovery:**
- Classify as resource error
- Long retry delay (15m, 30m, 60m)
- Alert orchestrator to check system health
- If persistent, pause all agents and alert admin

---

## Pass Criteria

### 1. ✅ Build Agent Spawns with Spec File Path

**Test:**
```bash
# Create task with spec
sqlite3 parent-harness/data/harness.db "
  INSERT INTO tasks (id, display_id, title, spec_file_path, status)
  VALUES ('test-001', 'TEST-001', 'Test Task', 'docs/specs/TEST-001.md', 'ready');
"

# Trigger orchestrator to spawn Build Agent
curl -X POST http://localhost:3333/api/orchestrator/tick

# Check agent spawned with correct args
ps aux | grep build_agent_worker.py | grep "TEST-001"
```

**Expected:** Process running with `--spec-file docs/specs/TEST-001.md`

### 2. ✅ Specification Parsed Correctly

**Test:**
```python
# Unit test for spec parser
spec_parser = SpecParser()
spec = spec_parser.parse_file(Path('docs/specs/TEST-001.md'))

assert spec.task_id == 'TEST-001'
assert len(spec.pass_criteria) > 0
assert len(spec.files_to_create) > 0
assert 'Overview' in spec.overview
```

**Expected:** All spec sections extracted without errors

### 3. ✅ Files Created/Modified According to Spec

**Test:**
```bash
# Create spec that requires:
# - Create: server/routes/test.ts
# - Modify: server/routes/index.ts

# Run Build Agent
python3 coding-loops/agents/build_agent_worker.py \
  --agent-id test-agent \
  --task-id test-001 \
  --task-list-id test-list \
  --spec-file docs/specs/TEST-001.md

# Verify files
test -f server/routes/test.ts && echo "✅ Created"
git diff server/routes/index.ts | grep "+export { testRouter }" && echo "✅ Modified"
```

**Expected:** All specified files created/modified

### 4. ✅ Tests Executed Successfully

**Test:**
```python
# Mock spec with test commands
spec = ParsedSpec(
    testing_strategy="""
    - TypeScript: npx tsc --noEmit
    - Unit tests: npm test -- test.test.ts
    """
)

test_runner = TestRunner()
results = test_runner.run("npx tsc --noEmit")

assert results.passed == True
assert results.duration < 60  # Less than 60 seconds
```

**Expected:** Tests run and results captured

### 5. ✅ Pass Criteria Validated

**Test:**
```python
spec = ParsedSpec(
    pass_criteria=[
        "TypeScript compilation passes",
        "Unit tests pass"
    ]
)

test_results = {
    'typecheck': TestResult(passed=True, output="No errors", duration=5.2),
    'unit': TestResult(passed=True, output="8 passed", duration=2.1),
}

validation = validator.validate_pass_criteria(spec, test_results)

assert validation.all_passed == True
assert len(validation.results) == 2
```

**Expected:** All criteria validated correctly

### 6. ✅ Heartbeats Sent During Execution

**Test:**
```bash
# Start Build Agent
python3 coding-loops/agents/build_agent_worker.py --agent-id test-agent ... &

# Wait 60 seconds
sleep 60

# Check heartbeats recorded
sqlite3 parent-harness/data/harness.db "
  SELECT COUNT(*) FROM agent_heartbeats
  WHERE agent_id = 'test-agent'
    AND created_at > datetime('now', '-2 minutes');
"
```

**Expected:** At least 2 heartbeats (one every 30 seconds)

### 7. ✅ Completion Report Generated

**Test:**
```python
executor = BuildAgentExecutor(...)
exit_code = executor.execute()

assert exit_code == 0

# Check report written to database
task = db.query_one("SELECT completion_report FROM tasks WHERE id = ?", (task_id,))
assert task['completion_report'] is not None
assert '## Implementation Summary' in task['completion_report']
assert '## Pass Criteria Validation' in task['completion_report']
```

**Expected:** Detailed markdown report created

### 8. ✅ Git Commit Created on Success

**Test:**
```bash
# Run Build Agent to completion
python3 coding-loops/agents/build_agent_worker.py ...

# Check git log
git log -1 --oneline | grep "TASK-001"
git show HEAD --stat | grep "server/routes/test.ts"
```

**Expected:** Commit created with task ID in message

### 9. ✅ Task Status Updated to pending_verification

**Test:**
```bash
# After successful Build Agent completion
sqlite3 parent-harness/data/harness.db "
  SELECT status FROM tasks WHERE id = 'test-001';
"
```

**Expected Output:** `pending_verification`

### 10. ✅ Error Handling and Retry Logic

**Test:**
```python
# Simulate code error (TypeScript compilation failure)
# Mock file with syntax error
Path('server/routes/test.ts').write_text('const x: number = "string";')

executor = BuildAgentExecutor(...)
exit_code = executor.execute()

assert exit_code == 1  # Failure

# Check task marked for retry
task = db.query_one("SELECT status, retry_count FROM tasks WHERE id = ?", (task_id,))
assert task['status'] == 'pending'
assert task['retry_count'] == 1
```

**Expected:** Task marked for retry with incremented count

---

## Dependencies

### Upstream (must exist first)

- ✅ PHASE2-TASK-01: Spec Agent v0.1 (creates specifications)
- ✅ Build Agent Orchestrator (`build-agent-orchestrator.ts`)
- ✅ Build Agent Worker skeleton (`build_agent_worker.py`)
- ✅ Database schema with tasks, agent_instances, heartbeats tables
- ✅ Orchestrator cron loop infrastructure

### Downstream (depends on this)

- QA Agent v0.1 (validates Build Agent output)
- Task decomposition workflow (parallel Build Agent execution)
- Self-Improvement Agent (analyzes Build Agent failures)

### External Dependencies

- Claude API (Opus model for code generation)
- Python 3.11+ with anthropic library
- Node.js 20+ with TypeScript
- Git (for commit creation)
- npm/test framework (for test execution)

---

## Implementation Plan

### Phase 1: Spec Parser Module (2-3 hours)

**Tasks:**
1. Create `coding-loops/agents/build_agent/spec_parser.py`
2. Implement markdown section parsing
3. Implement pass criteria extraction
4. Implement file operation extraction
5. Unit tests for parser

**Deliverable:** `SpecParser` class that converts markdown to `ParsedSpec`

### Phase 2: File Modifier Module (1-2 hours)

**Tasks:**
1. Create `coding-loops/agents/build_agent/file_modifier.py`
2. Implement `create_file()`, `modify_file()`, `append_to_file()`
3. Add path validation and error handling
4. Unit tests for file operations

**Deliverable:** `FileModifier` class for safe file operations

### Phase 3: Test Runner Module (1-2 hours)

**Tasks:**
1. Create `coding-loops/agents/build_agent/test_runner.py`
2. Implement command execution with timeout
3. Implement output parsing (PASS/FAIL detection)
4. Add test result data structure
5. Unit tests for test execution

**Deliverable:** `TestRunner` class for test execution

### Phase 4: Build Agent Executor Enhancement (3-4 hours)

**Tasks:**
1. Enhance `build_agent_worker.py` with `BuildAgentExecutor` class
2. Implement 5-phase execution flow (parse, explore, implement, test, validate)
3. Add heartbeat mechanism integration
4. Add error classification and retry logic
5. Add report generation

**Deliverable:** Complete Build Agent execution engine

### Phase 5: Code Generation Integration (2-3 hours)

**Tasks:**
1. Add Claude API client for code generation
2. Build prompt templates for different code types (routes, middleware, tests)
3. Implement pattern-aware code generation
4. Add token usage tracking
5. Add rate limit handling

**Deliverable:** Claude-powered code generation within Build Agent

### Phase 6: Orchestrator Integration (1-2 hours)

**Tasks:**
1. Update `spawnBuildAgent()` to pass `--spec-file` parameter
2. Add spec_file_path validation before spawn
3. Test orchestrator → Build Agent → QA handoff
4. Add WebSocket event emission for build progress

**Deliverable:** End-to-end Spec → Build → QA pipeline

### Phase 7: Testing & Validation (2-3 hours)

**Tasks:**
1. Create test specifications for different task types
2. Test simple task (create single file)
3. Test complex task (multiple files, dependencies)
4. Test failure scenarios (code error, test failure)
5. Test retry logic with different error types
6. Validate pass criteria checking

**Deliverable:** Comprehensive test suite for Build Agent

### Phase 8: Documentation & Polish (1-2 hours)

**Tasks:**
1. Document Build Agent architecture in `AGENTS.md`
2. Create example specifications for reference
3. Add logging improvements
4. Add Telegram notifications for build events
5. Performance optimization (parallel file ops where possible)

**Deliverable:** Production-ready Build Agent v0.1

**Total Estimated Time:** 13-20 hours (2-3 days)

---

## Testing Strategy

### Unit Tests

**File:** `coding-loops/agents/build_agent/tests/test_spec_parser.py`

```python
def test_parse_spec_sections():
    """Test spec parsing extracts all sections"""
    spec_content = """
    # TASK-001: Test Task

    ## Overview
    This is a test.

    ## Pass Criteria
    1. ✅ Tests pass
    2. ✅ TypeScript compiles
    """

    spec = SpecParser().parse_content(spec_content)
    assert spec.task_id == 'TASK-001'
    assert len(spec.pass_criteria) == 2
    assert 'Tests pass' in spec.pass_criteria[0]
```

**File:** `coding-loops/agents/build_agent/tests/test_file_modifier.py`

```python
def test_create_file():
    """Test file creation"""
    modifier = FileModifier()
    test_file = Path('/tmp/test_create.ts')

    modifier.create_file(test_file, 'const x = 1;')

    assert test_file.exists()
    assert test_file.read_text() == 'const x = 1;'
```

### Integration Tests

**File:** `parent-harness/orchestrator/tests/build-agent-integration.test.ts`

```typescript
describe('Build Agent Integration', () => {
  it('should execute task from spec to completion', async () => {
    // 1. Create spec file
    const specPath = 'docs/specs/TEST-INTEGRATION-001.md';
    await writeFile(specPath, createTestSpec());

    // 2. Create task
    const task = await createTask({
      display_id: 'TEST-INTEGRATION-001',
      spec_file_path: specPath,
      status: 'ready',
    });

    // 3. Spawn Build Agent
    const agent = await spawnBuildAgent(task.id, 'test-list-id');

    // 4. Wait for completion (max 5 min)
    await waitForTaskStatus(task.id, 'pending_verification', 300_000);

    // 5. Verify results
    const updated = await getTask(task.id);
    expect(updated.status).toBe('pending_verification');
    expect(updated.completion_report).toBeTruthy();

    // 6. Verify files created
    expect(existsSync('server/routes/test.ts')).toBe(true);

    // 7. Verify git commit
    const lastCommit = execSync('git log -1 --oneline').toString();
    expect(lastCommit).toContain('TEST-INTEGRATION-001');
  });
});
```

### Manual Testing Checklist

- [ ] Simple task (create 1 file) → Build Agent completes in <5 min
- [ ] Complex task (create 5+ files) → Build Agent completes in <15 min
- [ ] Task with dependencies → Build Agent reads dependency files correctly
- [ ] TypeScript error → Build Agent detects, attempts fix, retries
- [ ] Test failure → Build Agent reports failure details, retries with fix
- [ ] Network error during code gen → Build Agent retries with backoff
- [ ] Heartbeats visible in dashboard → Real-time progress updates
- [ ] Completion report accurate → All pass criteria checked
- [ ] Git commit clean → Only intended files modified
- [ ] QA Agent can validate → Handoff to QA works smoothly

---

## Open Questions

### 1. Code Generation Approach?

**Question:** How should Build Agent generate code from specifications?

**Options:**
- **A:** Generate all code upfront, then write files (fast but risky)
- **B:** Generate incrementally per file (slower but safer)
- **C:** Generate per implementation phase (balanced)

**Recommendation:** **C** (per phase) - Matches spec structure, allows incremental testing

### 2. Test Failure Recovery Strategy?

**Question:** When tests fail, how aggressively should Build Agent attempt fixes?

**Options:**
- **A:** Single fix attempt, then fail (conservative)
- **B:** Multiple fix attempts with different approaches (aggressive)
- **C:** Analyze failure, ask QA Agent for guidance (collaborative)

**Recommendation:** **B** for Phase 2, add **C** in Phase 4 (agent collaboration)

### 3. Code Review Before Commit?

**Question:** Should Build Agent create draft commits or final commits?

**Options:**
- **A:** Final commits (auto-push after QA validation)
- **B:** Draft commits (human reviews before push)
- **C:** Configurable per task (high-risk tasks need review)

**Recommendation:** **A** for Phase 2 (trust QA Agent), add **C** in Phase 8

### 4. Parallel File Operations?

**Question:** Should Build Agent modify multiple files concurrently?

**Options:**
- **A:** Sequential (simpler, easier to debug)
- **B:** Parallel within phase (faster for independent files)
- **C:** Fully parallel (fastest but complex)

**Recommendation:** **A** for Phase 2, optimize to **B** if performance bottleneck

---

## Success Metrics

### Short-term (2 weeks)

1. **Task Completion Rate**: 70% of tasks with specs complete without human intervention
2. **Build Success Rate**: 60% of builds succeed on first attempt
3. **Average Duration**: <10 minutes for simple tasks, <30 minutes for complex
4. **Test Pass Rate**: 80% of generated code passes tests on first run

### Medium-term (1 month)

1. **Autonomous Rate**: 80% of tasks complete Spec → Build → QA → Merge autonomously
2. **Retry Efficiency**: 50% of retries succeed (vs random retry)
3. **Code Quality**: Generated code passes human review 90% of time
4. **Pattern Adherence**: 95% of generated code follows discovered patterns

### Long-term (3 months)

1. **Full Autonomy**: 90% of user tasks complete without human coding
2. **Self-Improvement**: Build Agent learns from QA feedback, improves over time
3. **Parallel Execution**: 5+ Build Agents working simultaneously without conflicts
4. **Cost Efficiency**: Average task cost <$2 (Opus token usage)

---

## Conclusion

Build Agent v0.1 is the **critical execution engine** for autonomous development in the Vibe platform. By reading detailed specifications, following codebase patterns, and validating work rigorously, it transforms written requirements into tested, working code.

**Key Success Factors:**

1. **Spec-Driven Execution** - All work guided by detailed specifications
2. **Pattern Awareness** - Generated code matches existing codebase style
3. **Rigorous Validation** - Every pass criterion checked explicitly
4. **Intelligent Retry** - Error classification enables smart recovery
5. **Complete Observability** - Heartbeats and reports enable debugging

**Next Steps:**

1. **Approval** - Review and approve this specification
2. **Implementation** - Build in phases (parser → executor → integration)
3. **Validation** - Test with real tasks from Phase 1 backlog
4. **Iteration** - Refine based on first 20 build executions

**Status:** Ready for implementation.
