# PHASE2-TASK-02: Build Agent Task Executor with File Modification + Test Running

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-02-08
**Priority:** P0 (Critical Path - Phase 2)
**Effort:** Large (16-20 hours)
**Model:** Opus
**Agent Type:** build_agent

---

## Overview

Implement the Build Agent task executor that consumes technical specifications created by the Spec Agent (PHASE2-TASK-01), executes tasks autonomously by modifying files and running tests, and reports results to the QA Agent for validation. This completes the **Spec Agent → Build Agent → QA Agent** autonomous execution pipeline.

### Problem Statement

**Current State:**

- Spec Agent creates detailed technical specifications ✅ (PHASE2-TASK-01 complete)
- Build Agent orchestrator infrastructure exists ✅ (`build-agent-orchestrator.ts`)
- Python worker exists ✅ (`build_agent_worker.py` with 1800+ lines)
- **BUT** Build Agent lacks autonomous execution capability for spec-driven tasks
- Build Agent needs integration with Spec Agent output format
- No automated file modification based on specification requirements
- No test execution and validation reporting

**Desired State:**

- Build Agent reads specs from `docs/specs/TASK-{ID}.md`
- Parses technical design and implementation plan from spec
- Modifies files autonomously based on pass criteria
- Runs validation tests automatically
- Reports success/failure to orchestrator and QA Agent
- Handles errors gracefully with retry logic

### Value Proposition

The Build Agent is the **"Implementation Executor"** that bridges specifications and working code:

1. **Enables Full Autonomy** - Complete pipeline from task brief → working code
2. **Reduces Manual Coding** - Build Agent implements based on specs
3. **Maintains Quality** - Automated test validation before completion
4. **Accelerates Development** - Parallel execution of independent tasks
5. **Improves Reliability** - Consistent implementation patterns

---

## Requirements

### Functional Requirements

#### 1. Specification Consumption

**Input:** Path to specification markdown file created by Spec Agent

```markdown
# TASK-042: Add user authentication

## Technical Design

### Files to Modify

- `server/routes/auth.ts` - Create new auth endpoints
- `server/middleware/auth.ts` - Add JWT verification middleware
  ...

## Pass Criteria

1. POST /api/auth/login returns 200 with JWT token when credentials valid
2. POST /api/auth/login returns 401 when password incorrect
   ...

## Implementation Plan

### Phase 1: Database Schema

- Create users table migration
- Add password_hash field
  ...
```

**Processing:**

- Parse markdown sections (Technical Design, Pass Criteria, Implementation Plan)
- Extract file paths to create/modify
- Extract validation commands from pass criteria
- Build dependency graph from Implementation Plan phases

#### 2. File Modification

The Build Agent must be able to:

**Create New Files:**

- Generate boilerplate based on project conventions
- Use Read tool to understand existing patterns
- Write complete file content using Write tool

**Modify Existing Files:**

- Read current file content
- Identify insertion/replacement points
- Use Edit tool for precise modifications
- Preserve existing code structure and style

**Example Workflow:**

```typescript
// Build Agent receives task: "Add login endpoint"

// Step 1: Read existing routes file for patterns
const authRoutes = await Read('server/routes/auth.ts');

// Step 2: Identify pattern (Express router setup)
const pattern = extractPattern(authRoutes); // POST /api/auth/...

// Step 3: Generate new endpoint following pattern
const loginEndpoint = generateCode({
  pattern,
  requirements: spec.requirements,
  passC criteria: spec.passCriteria
});

// Step 4: Insert into file
await Edit('server/routes/auth.ts', {
  old_string: '// Add routes here',
  new_string: loginEndpoint + '\n// Add routes here'
});
```

#### 3. Test Execution

The Build Agent must validate work by running tests:

**Test Levels (from spec pass criteria):**

```typescript
interface TestValidation {
  // Level 1: TypeScript compilation
  compilation: {
    command: "npx tsc --noEmit";
    mustPass: true;
  };

  // Level 2: Unit tests
  unit: {
    command: "npm test -- path/to/test.test.ts";
    mustPass: true;
  };

  // Level 3: Integration tests
  integration: {
    command: "npm run test:integration";
    mustPass: true;
  };

  // Level 4: Manual validation
  manual: {
    description: "Verify dashboard UI renders correctly";
    requiresHuman: true;
  };
}
```

**Test Execution Flow:**

1. Extract test commands from pass criteria
2. Run tests in dependency order (compilation → unit → integration)
3. Capture stdout/stderr
4. Parse test results (pass/fail counts, error messages)
5. Determine overall success/failure
6. Report detailed results to orchestrator

#### 4. Code Generation via Claude

The Build Agent uses Claude Opus to generate code:

**Generation Process:**

```typescript
interface CodeGenerationContext {
  task: {
    id: string;
    title: string;
    requirements: string[];
  };

  spec: {
    technicalDesign: string;
    implementationPlan: string;
    passCriteria: string[];
  };

  codebase: {
    // Read from existing files
    relatedFiles: Map<string, string>; // path → content
    patterns: string[]; // Extracted conventions
    gotchas: string[]; // From docs/gotchas/ or spec
  };

  dependencies: {
    // Output from dependent tasks
    completedTasks: Map<string, string>; // taskId → generated code
  };
}

// Build Agent constructs prompt
const prompt = `
You are implementing a task for the Vibe platform.

TASK: ${context.task.title}

REQUIREMENTS:
${context.task.requirements.join("\n")}

TECHNICAL DESIGN:
${context.spec.technicalDesign}

EXISTING CODE PATTERNS:
${context.codebase.patterns.join("\n")}

PASS CRITERIA (your code must satisfy these):
${context.spec.passCriteria.join("\n")}

Generate the code for: ${filePath}
`;

const response = await claude.messages.create({
  model: "claude-opus-4",
  max_tokens: 4096,
  messages: [{ role: "user", content: prompt }],
});
```

#### 5. Error Handling and Retry

When tasks fail, the Build Agent must:

**Classify Errors (GAP-007):**

```typescript
interface ClassifiedError {
  type: "transient" | "permanent" | "unknown";
  category:
    | "network"
    | "validation"
    | "compilation"
    | "test_failure"
    | "file_error";
  message: string;
  isRetryable: boolean;
  suggestedAction: "retry" | "skip" | "escalate" | "abort";
}
```

**Retry Logic:**

- Transient errors (network timeout, rate limit): Retry with exponential backoff
- Compilation errors: Retry once with error feedback to Claude
- Test failures: Retry once with test output feedback to Claude
- Permanent errors (missing dependencies, invalid spec): Escalate to SIA

**Example Retry Flow:**

```typescript
let attempt = 1;
const maxRetries = 3;

while (attempt <= maxRetries) {
  try {
    // Generate code
    const code = await generateCode(context);

    // Write file
    await writeFile(filePath, code);

    // Run tests
    const testResult = await runTests(passCriteria);

    if (testResult.allPassed) {
      return { status: "completed", output: code };
    } else {
      // Feed test failures back to Claude
      context.previousAttempt = {
        code,
        testOutput: testResult.output,
        failedCriteria: testResult.failures,
      };
      attempt++;
    }
  } catch (error) {
    const classified = classifyError(error);

    if (!classified.isRetryable || attempt >= maxRetries) {
      return { status: "failed", error: classified };
    }

    await sleep(exponentialBackoff(attempt));
    attempt++;
  }
}
```

#### 6. Observability Integration

The Build Agent must integrate with the observability system (OBS-102):

**4-Phase Logging:**

```typescript
// Phase 1: Parse (Read specification)
agent.logPhase("parse", "Reading spec from docs/specs/TASK-042.md");

// Phase 2: Context (Load codebase patterns)
agent.logPhase("context", "Loaded 3 related files, 5 patterns, 2 gotchas");

// Phase 3: Execute (Generate and write code)
agent.logPhase(
  "execute",
  "Generated auth.ts (245 lines), wrote to server/routes/",
);

// Phase 4: Validate (Run tests)
agent.logPhase("validate", "Compilation: PASS, Unit tests: 12/12 PASS");
```

**Database Records:**

- `task_executions` - One record per task execution attempt
- `task_execution_log` - Detailed logs per phase
- `agent_heartbeats` - Health monitoring (every 30s)

### Non-Functional Requirements

#### Performance

- Spec parsing: < 5 seconds
- Code generation: < 60 seconds per file (Claude API latency)
- Test execution: Respects test timeout from config (default 120s)
- Total task execution: < 5 minutes for simple tasks, < 15 minutes for complex

#### Quality

- Generated code must compile (TypeScript validation)
- Generated code must pass specified tests (100% pass criteria)
- Generated code must follow project conventions (linting, formatting)
- Error messages must be actionable (include fix suggestions)

#### Reliability

- Graceful handling of Claude API failures (retry 3x)
- Graceful handling of file system errors (permissions, disk space)
- Graceful handling of test failures (capture output, don't crash)
- Worker process must not hang (enforce timeouts)

#### Integration

- Compatible with Spec Agent output format (PHASE2-TASK-01)
- Compatible with QA Agent input expectations (validation reports)
- Compatible with orchestrator lifecycle (spawn, heartbeat, exit)
- Compatible with existing `build_agent_worker.py` infrastructure

---

## Technical Design

### Architecture

```
Orchestrator detects task ready for build
    ↓
Spawns BuildAgentWorker (Python process)
    ↓
┌──────────────────────────────────────────────────┐
│           Build Agent Worker                      │
│                                                   │
│  Phase 1: Parse Specification                    │
│     - Read docs/specs/TASK-{ID}.md               │
│     - Extract technical design                    │
│     - Extract pass criteria                       │
│     - Extract implementation plan                 │
│                                                   │
│  Phase 2: Load Context                           │
│     - Read related files from codebase           │
│     - Extract code patterns                       │
│     - Load gotchas from spec or knowledge base   │
│     - Get outputs from dependent tasks           │
│                                                   │
│  Phase 3: Execute Task                           │
│     For each file in implementation plan:        │
│       - Generate code via Claude API             │
│       - Write/edit file using tools              │
│       - Log progress                             │
│                                                   │
│  Phase 4: Validate                               │
│     For each pass criterion:                     │
│       - Run validation command                   │
│       - Capture output                           │
│       - Determine pass/fail                      │
│                                                   │
│  Result: Report success/failure to DB            │
│     - Update task status                         │
│     - Write execution log                        │
│     - Exit with code 0 (success) or 1 (failure) │
└──────────────────────────────────────────────────┘
    ↓
Orchestrator detects exit → triggers QA Agent (if success)
```

### Key Components

#### 1. Spec Parser (NEW - Python)

**File:** `coding-loops/agents/build_agent_worker.py` (extend existing)

```python
class SpecParser:
    """
    Parses Spec Agent markdown files into structured data
    """

    def parse(self, spec_path: str) -> ParsedSpec:
        """
        Parse specification markdown into structured format

        Returns:
            ParsedSpec with:
            - technical_design: dict with files, architecture, integrations
            - pass_criteria: list of testable criteria
            - implementation_plan: ordered list of phases/steps
            - dependencies: upstream and downstream tasks
        """
        with open(spec_path, 'r') as f:
            content = f.read()

        # Parse markdown sections
        sections = self._split_sections(content)

        return ParsedSpec(
            technical_design=self._parse_technical_design(sections.get('Technical Design', '')),
            pass_criteria=self._parse_pass_criteria(sections.get('Pass Criteria', '')),
            implementation_plan=self._parse_implementation_plan(sections.get('Implementation Plan', '')),
            dependencies=self._parse_dependencies(sections.get('Dependencies', ''))
        )

    def _parse_technical_design(self, section: str) -> dict:
        """
        Extract:
        - Files to create/modify
        - Key functions/classes to implement
        - Integration points
        """
        files = []
        # Regex to find: - `path/to/file.ts` - Description
        pattern = r'-\s+`([^`]+)`\s+-\s+(.+)'
        for match in re.finditer(pattern, section):
            files.append({
                'path': match.group(1),
                'description': match.group(2),
                'action': 'CREATE' if 'create' in match.group(2).lower() else 'MODIFY'
            })

        return {'files': files}

    def _parse_pass_criteria(self, section: str) -> list:
        """
        Extract numbered criteria:
        1. npm test passes
        2. TypeScript compiles with no errors
        ...
        """
        criteria = []
        # Regex: 1. Criterion text
        pattern = r'^\d+\.\s+(.+)$'
        for line in section.split('\n'):
            match = re.match(pattern, line.strip())
            if match:
                criterion = match.group(1)
                criteria.append({
                    'text': criterion,
                    'command': self._extract_command(criterion),
                    'testable': self._is_testable(criterion)
                })

        return criteria

    def _extract_command(self, criterion: str) -> Optional[str]:
        """
        Extract executable command from criterion

        Examples:
        - "npm test passes" → "npm test"
        - "TypeScript compiles" → "npx tsc --noEmit"
        - "POST /api/auth/login returns 200" → "curl -X POST http://localhost:3001/api/auth/login"
        """
        # Common patterns
        if 'npm test' in criterion.lower():
            return 'npm test'
        if 'typescript' in criterion.lower() and 'compile' in criterion.lower():
            return 'npx tsc --noEmit'
        # Add more patterns as needed
        return None
```

#### 2. Code Generator (EXTEND EXISTING - Python)

**File:** `coding-loops/agents/build_agent_worker.py` (already has Claude client)

````python
class CodeGenerator:
    """
    Generate code using Claude API based on spec + context
    """

    def __init__(self, api_key: str):
        if not ANTHROPIC_AVAILABLE:
            raise RuntimeError("anthropic package required for code generation")
        self.client = anthropic.Anthropic(api_key=api_key)

    def generate(self, context: GenerationContext) -> str:
        """
        Generate code for a specific file

        Args:
            context: Contains task spec, codebase patterns, dependencies

        Returns:
            Generated code as string
        """
        prompt = self._build_prompt(context)

        response = self.client.messages.create(
            model='claude-opus-4',
            max_tokens=4096,
            temperature=0.2,  # Lower temperature for more deterministic code
            messages=[{'role': 'user', 'content': prompt}]
        )

        code = response.content[0].text

        # Extract code from markdown fences if present
        return self._extract_code_blocks(code)

    def _build_prompt(self, context: GenerationContext) -> str:
        """
        Construct prompt for Claude with all necessary context
        """
        return f"""
You are implementing a task for the Vibe autonomous agent platform.

TASK: {context.task_title}

FILE TO IMPLEMENT: {context.file_path}
ACTION: {context.action}  (CREATE or MODIFY)

REQUIREMENTS:
{self._format_list(context.requirements)}

TECHNICAL DESIGN:
{context.technical_design}

{'EXISTING CODE PATTERNS:' if context.patterns else ''}
{self._format_list(context.patterns)}

{'GOTCHAS (avoid these mistakes):' if context.gotchas else ''}
{self._format_list(context.gotchas)}

{'EXISTING FILE CONTENT:' if context.existing_content else ''}
{context.existing_content or '(new file)'}

PASS CRITERIA (your code MUST satisfy these):
{self._format_list(context.pass_criteria)}

Generate the {'complete file content' if context.action == 'CREATE' else 'modified code'}.
Follow existing code style and conventions.
Include all necessary imports.
Add brief comments for complex logic.
Do not add extra features beyond requirements.

Output only the code, no explanations.
"""

    def _extract_code_blocks(self, response: str) -> str:
        """
        Extract code from markdown code fences if Claude wrapped it
        """
        # Pattern: ```typescript\ncode\n```
        pattern = r'```(?:typescript|ts|javascript|js)?\n(.+?)\n```'
        matches = re.findall(pattern, response, re.DOTALL)

        if matches:
            return matches[0]

        # No code fence, return as-is
        return response
````

#### 3. File Writer (EXTEND EXISTING - Python)

**File:** `coding-loops/agents/build_agent_worker.py` (already has file ops)

```python
class FileWriter:
    """
    Write or edit files safely with validation
    """

    def __init__(self, project_root: Path):
        self.project_root = project_root

    def write_file(self, file_path: str, content: str) -> None:
        """
        Create or overwrite a file

        Args:
            file_path: Relative path from project root
            content: File content to write

        Raises:
            FileWriteError: If write fails
        """
        full_path = self.project_root / file_path

        # Create parent directories if needed
        full_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            full_path.write_text(content, encoding='utf-8')
            print(f"[FileWriter] Wrote {len(content)} bytes to {file_path}")
        except Exception as e:
            raise FileWriteError(f"Failed to write {file_path}: {e}")

    def edit_file(self, file_path: str, old_string: str, new_string: str) -> None:
        """
        Edit a file by replacing old_string with new_string

        Args:
            file_path: Relative path from project root
            old_string: Text to replace (must be unique)
            new_string: Replacement text

        Raises:
            FileEditError: If old_string not found or not unique
        """
        full_path = self.project_root / file_path

        if not full_path.exists():
            raise FileEditError(f"File not found: {file_path}")

        content = full_path.read_text(encoding='utf-8')

        # Check uniqueness
        count = content.count(old_string)
        if count == 0:
            raise FileEditError(f"String not found in {file_path}: {old_string[:50]}...")
        if count > 1:
            raise FileEditError(f"String appears {count} times in {file_path}, must be unique")

        # Replace
        new_content = content.replace(old_string, new_string, 1)

        full_path.write_text(new_content, encoding='utf-8')
        print(f"[FileWriter] Edited {file_path}: replaced {len(old_string)} → {len(new_string)} chars")
```

#### 4. Test Runner (EXTEND EXISTING - Python)

**File:** `coding-loops/agents/build_agent_worker.py` (already has subprocess execution)

```python
class TestRunner:
    """
    Execute validation commands and parse results
    """

    def __init__(self, cwd: Path, timeout: int = 120):
        self.cwd = cwd
        self.timeout = timeout

    def run_validation(self, criteria: list) -> ValidationResult:
        """
        Run all validation commands from pass criteria

        Args:
            criteria: List of pass criteria with commands

        Returns:
            ValidationResult with overall pass/fail and details
        """
        results = []
        all_passed = True

        for criterion in criteria:
            if not criterion.get('testable') or not criterion.get('command'):
                # Skip non-testable criteria (manual validation)
                continue

            result = self._run_command(criterion['command'])
            passed = result['exit_code'] == 0

            results.append({
                'criterion': criterion['text'],
                'command': criterion['command'],
                'passed': passed,
                'output': result['output'],
                'duration_ms': result['duration_ms']
            })

            if not passed:
                all_passed = False

        return ValidationResult(
            all_passed=all_passed,
            total_criteria=len(criteria),
            testable_criteria=len(results),
            passed_count=sum(1 for r in results if r['passed']),
            results=results
        )

    def _run_command(self, command: str) -> dict:
        """
        Execute a shell command and capture output
        """
        start_time = time.time()

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(self.cwd),
                capture_output=True,
                text=True,
                timeout=self.timeout
            )

            duration_ms = int((time.time() - start_time) * 1000)

            return {
                'exit_code': result.returncode,
                'output': result.stdout + result.stderr,
                'duration_ms': duration_ms
            }
        except subprocess.TimeoutExpired:
            return {
                'exit_code': -1,
                'output': f"Command timed out after {self.timeout}s",
                'duration_ms': self.timeout * 1000
            }
        except Exception as e:
            return {
                'exit_code': -1,
                'output': f"Command failed: {e}",
                'duration_ms': int((time.time() - start_time) * 1000)
            }
```

#### 5. Main Worker Loop (MODIFY EXISTING)

**File:** `coding-loops/agents/build_agent_worker.py`

```python
def main():
    """
    Main entry point for Build Agent Worker
    """
    # Parse CLI args (already exists)
    args = parse_arguments()

    # Initialize database (already exists)
    db = Database(config.db_path)

    # Initialize observability (already exists)
    if OBSERVABLE_AVAILABLE:
        agent = ObservableAgent(
            agent_id=args.agent_id,
            agent_type='build_agent',
            db_path=str(config.db_path)
        )

    try:
        # Load task from database
        task = db.query_one(
            "SELECT * FROM tasks WHERE id = ?",
            (args.task_id,)
        )

        if not task:
            raise TaskNotFoundError(f"Task {args.task_id} not found")

        # Phase 1: Parse specification
        agent.log_phase('parse', f"Reading spec from {task['spec_file_path']}")
        spec_parser = SpecParser()
        spec = spec_parser.parse(task['spec_file_path'])

        # Phase 2: Load context
        agent.log_phase('context', 'Loading codebase patterns and dependencies')
        context_loader = ContextLoader(PROJECT_ROOT)
        context = context_loader.load(spec, task)

        # Phase 3: Execute task (generate + write files)
        agent.log_phase('execute', f"Implementing {len(spec.technical_design['files'])} files")

        code_generator = CodeGenerator(os.getenv('ANTHROPIC_API_KEY'))
        file_writer = FileWriter(PROJECT_ROOT)

        for file_spec in spec.technical_design['files']:
            # Generate code
            gen_context = GenerationContext(
                task_title=task['title'],
                file_path=file_spec['path'],
                action=file_spec['action'],
                requirements=spec.requirements,
                technical_design=spec.technical_design_text,
                pass_criteria=[c['text'] for c in spec.pass_criteria],
                patterns=context.patterns,
                gotchas=context.gotchas,
                existing_content=context.files.get(file_spec['path'])
            )

            code = code_generator.generate(gen_context)

            # Write file
            if file_spec['action'] == 'CREATE':
                file_writer.write_file(file_spec['path'], code)
            else:
                # For MODIFY, need to identify insertion point
                # This is simplified - real implementation needs smarter editing
                file_writer.write_file(file_spec['path'], code)

        # Phase 4: Validate
        agent.log_phase('validate', 'Running validation tests')
        test_runner = TestRunner(PROJECT_ROOT, timeout=config.validation_timeout_seconds)
        validation = test_runner.run_validation(spec.pass_criteria)

        if validation.all_passed:
            # Update task status to completed
            db.execute(
                "UPDATE tasks SET status = 'completed', updated_at = datetime('now') WHERE id = ?",
                (args.task_id,)
            )

            agent.complete('success', f"Validation: {validation.passed_count}/{validation.testable_criteria} passed")
            sys.exit(0)  # Success
        else:
            # Update task status to failed
            db.execute(
                "UPDATE tasks SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
                (args.task_id,)
            )

            failed_criteria = [r for r in validation.results if not r['passed']]
            error_msg = f"Validation failed: {len(failed_criteria)} criteria failed"

            agent.complete('failure', error_msg)
            sys.exit(1)  # Failure

    except Exception as e:
        # Log error and exit with failure
        traceback.print_exc()

        if OBSERVABLE_AVAILABLE:
            agent.complete('error', str(e))

        # Record error in database
        db.execute(
            "UPDATE tasks SET status = 'failed', last_error_message = ?, updated_at = datetime('now') WHERE id = ?",
            (str(e), args.task_id)
        )

        sys.exit(1)

    finally:
        db.close()
```

### Database Schema

**No schema changes required** - Existing tables support Build Agent execution:

- `tasks` - Task records with `spec_file_path`, `status`, `last_error_message`
- `task_executions` - Execution attempts with `generated_code`, `validation_output`
- `task_execution_log` - Phase logs (parse, context, execute, validate)
- `agent_heartbeats` - Worker health monitoring
- `build_agent_instances` - Worker process tracking

### Integration Points

#### 1. Spec Agent Output → Build Agent Input

**Spec Agent creates:** `docs/specs/TASK-042-user-auth.md`

**Build Agent reads:** Parses markdown to extract:

- Technical Design → Files to modify
- Pass Criteria → Validation commands
- Implementation Plan → Task ordering

#### 2. Build Agent Output → QA Agent Input

**Build Agent writes to database:**

```sql
UPDATE tasks
SET status = 'completed',
    spec_file_path = 'docs/specs/TASK-042-user-auth.md',
    updated_at = datetime('now')
WHERE id = '...';

INSERT INTO task_executions (id, task_id, generated_code, validation_output, status)
VALUES ('...', '...', '<generated code>', '<test output>', 'completed');
```

**QA Agent queries:**

```sql
SELECT * FROM tasks WHERE status = 'completed' AND assigned_agent_id = 'build_agent';
-- Read spec_file_path to get pass criteria
-- Read generated_code from task_executions
-- Validate against pass criteria
```

#### 3. Orchestrator → Build Agent Lifecycle

**Orchestrator spawns:**

```typescript
spawnBuildAgent(taskId, taskListId)
  → spawn('python3', ['coding-loops/agents/build_agent_worker.py', '--task-id', taskId, ...])
```

**Worker reports:**

- Heartbeat every 30s via database update
- Exit code 0 = success, 1 = failure
- Orchestrator detects exit → triggers next wave or QA validation

### Error Handling

#### 1. Specification Parsing Errors

**Scenario:** Spec file missing or malformed

**Recovery:**

```python
try:
    spec = spec_parser.parse(task['spec_file_path'])
except FileNotFoundError:
    # Escalate to SIA - spec file missing
    db.execute(
        "UPDATE tasks SET status = 'failed', last_error_message = ?, escalated_to_sia = 1 WHERE id = ?",
        (f"Spec file not found: {task['spec_file_path']}", task_id)
    )
    sys.exit(1)
except SpecParseError as e:
    # Escalate to Spec Agent - malformed spec
    db.execute(
        "UPDATE tasks SET status = 'blocked', last_error_message = ? WHERE id = ?",
        (f"Invalid spec format: {e}", task_id)
    )
    sys.exit(1)
```

#### 2. Code Generation Failures

**Scenario:** Claude API timeout or rate limit

**Recovery:**

```python
for attempt in range(1, config.max_retries + 1):
    try:
        code = code_generator.generate(context)
        break
    except anthropic.RateLimitError:
        if attempt >= config.max_retries:
            raise
        wait_time = min(2 ** attempt, 60)  # Exponential backoff, max 60s
        print(f"Rate limited, waiting {wait_time}s before retry {attempt + 1}/{config.max_retries}")
        time.sleep(wait_time)
```

#### 3. Test Validation Failures

**Scenario:** Generated code doesn't pass tests

**Recovery:**

```python
# First attempt fails validation
if not validation.all_passed and attempt == 1:
    # Retry with test feedback
    context.previous_attempt = {
        'code': code,
        'test_output': validation.results,
        'failed_criteria': [r for r in validation.results if not r['passed']]
    }

    # Regenerate with feedback
    code = code_generator.generate(context)
    file_writer.write_file(file_path, code)
    validation = test_runner.run_validation(spec.pass_criteria)

# Second attempt still fails
if not validation.all_passed:
    # Escalate to QA Agent for manual review
    db.execute(
        "UPDATE tasks SET status = 'needs_review', last_error_message = ? WHERE id = ?",
        (f"Tests failed after 2 attempts: {validation.failed_count} criteria", task_id)
    )
```

#### 4. File System Errors

**Scenario:** Permission denied, disk full, file locked

**Recovery:**

```python
try:
    file_writer.write_file(file_path, code)
except PermissionError:
    # Permanent error - abort
    raise TaskExecutionError(f"Permission denied writing {file_path}")
except OSError as e:
    if 'No space left on device' in str(e):
        # Permanent error - abort
        raise TaskExecutionError("Disk full")
    else:
        # Unknown OS error - escalate
        raise
```

---

## Pass Criteria

### 1. ✅ Spec Parser Parses Spec Agent Output

**Test:**

```bash
# Create test spec file
cat > docs/specs/TEST-BUILD-001.md << 'EOF'
# TEST-BUILD-001: Simple test task

## Technical Design
### Files to Modify
- `test-output.txt` - Create test file

## Pass Criteria
1. File exists at test-output.txt
2. File contains "Hello from Build Agent"

## Implementation Plan
### Phase 1: Create file
Write "Hello from Build Agent" to test-output.txt
EOF

# Run Build Agent worker
python3 coding-loops/agents/build_agent_worker.py \
  --agent-id test-agent-001 \
  --task-id test-task-001 \
  --task-list-id test-list-001
```

**Expected:**

- Worker parses spec successfully
- Extracts file path: `test-output.txt`
- Extracts 2 pass criteria
- Logs: "Parsed spec: 1 file, 2 criteria"

### 2. ✅ Code Generator Creates Valid TypeScript

**Test:**

```bash
# Create task requiring TypeScript generation
# Spec: Create server/routes/test.ts with GET /test endpoint

# Run Build Agent
# ...

# Verify output
npx tsc --noEmit server/routes/test.ts
```

**Expected:**

- File created at `server/routes/test.ts`
- TypeScript compilation passes (exit code 0)
- Code follows Express.js patterns (router, async handlers)

### 3. ✅ File Writer Creates New Files

**Test:**

```bash
# Build Agent task: Create new file

# Check file created
ls -la path/to/new/file.ts
cat path/to/new/file.ts
```

**Expected:**

- File exists
- Contains generated code
- Parent directories created if needed

### 4. ✅ File Writer Modifies Existing Files

**Test:**

```bash
# Create existing file
echo "// Placeholder" > server/routes/existing.ts

# Build Agent task: Add new route to existing.ts

# Check modification
grep "new route" server/routes/existing.ts
```

**Expected:**

- File modified (not overwritten)
- New code inserted correctly
- Existing code preserved

### 5. ✅ Test Runner Executes Validation Commands

**Test:**

```bash
# Spec pass criteria:
# 1. npm test passes
# 2. TypeScript compiles

# Build Agent runs these commands
# Verify in logs:
grep "Running validation: npm test" logs/build-agent.log
grep "Running validation: npx tsc --noEmit" logs/build-agent.log
```

**Expected:**

- Both commands executed
- Exit codes captured
- Output logged to database

### 6. ✅ Success Path: Task Completes Successfully

**Test:**

```sql
-- Create task with spec
INSERT INTO tasks (id, display_id, title, spec_file_path, status, task_list_id)
VALUES ('test-001', 'TEST-001', 'Test task', 'docs/specs/TEST-001.md', 'pending', 'list-001');

-- Spawn Build Agent via orchestrator
-- Wait for completion

-- Check task status
SELECT status, last_error_message FROM tasks WHERE id = 'test-001';
```

**Expected Output:**

```
completed | NULL
```

### 7. ✅ Failure Path: Test Validation Fails

**Test:**

```bash
# Create task with intentionally failing test
# Spec: Create file that should export function, but generated code doesn't

# Run Build Agent
# Check status
```

**Expected:**

- Task status = 'failed'
- `last_error_message` contains test failure details
- Worker exits with code 1

### 8. ✅ Retry on Transient Errors

**Test:**

```python
# Mock Claude API to fail twice, succeed third time
with mock_claude_api(fail_count=2):
    result = build_agent.run(task)

# Check logs
assert "Retry 1/3" in logs
assert "Retry 2/3" in logs
assert "Generation succeeded" in logs
```

**Expected:**

- Worker retries on rate limit / timeout
- Exponential backoff applied
- Eventually succeeds

### 9. ✅ Escalation on Permanent Errors

**Test:**

```bash
# Create task with missing spec file
# Run Build Agent

# Check database
sqlite3 database/ideas.db "SELECT status, escalated_to_sia FROM tasks WHERE id = 'test-001';"
```

**Expected Output:**

```
failed | 1
```

### 10. ✅ Observability Logs All Phases

**Test:**

```sql
-- After task execution
SELECT phase, message FROM task_execution_log WHERE execution_id = '...' ORDER BY created_at;
```

**Expected Output:**

```
parse   | Reading spec from docs/specs/TEST-001.md
context | Loaded 2 related files, 3 patterns
execute | Generated test.ts (150 lines)
validate | Compilation: PASS, Tests: 5/5 PASS
```

---

## Dependencies

### Upstream (must exist first)

- ✅ PHASE2-TASK-01: Spec Agent v0.1 (creates specs that Build Agent consumes)
- ✅ Build Agent orchestrator (`build-agent-orchestrator.ts`)
- ✅ Python worker infrastructure (`build_agent_worker.py` - 1800+ lines)
- ✅ Database schema (tasks, task_executions, agent_heartbeats)
- ✅ Anthropic API access (Claude Opus for code generation)

### Downstream (depends on this)

- PHASE2-TASK-03: QA Agent validation (validates Build Agent output)
- PHASE3-TASK-01: Task queue persistence (persistent execution state)
- PHASE4-TASK-04: Build-QA feedback loop (learning from failures)

### External Dependencies

- `anthropic` Python package (Claude API client)
- `sqlite3` Python module (database access)
- Node.js + npm (for running TypeScript compilation and tests)

---

## Implementation Plan

### Phase 1: Spec Parser (3-4 hours)

**Tasks:**

1. Implement `SpecParser` class in `build_agent_worker.py`
2. Add markdown section parsing (regex-based)
3. Add technical design extraction (files, actions)
4. Add pass criteria extraction (criteria, commands)
5. Add implementation plan parsing (phases, dependencies)
6. Write unit tests for parser

**Deliverables:**

- `SpecParser.parse()` returns `ParsedSpec` object
- Handles all Spec Agent output formats
- Graceful error handling for malformed specs

### Phase 2: Context Loading (2-3 hours)

**Tasks:**

1. Implement `ContextLoader` class
2. Read related files from codebase
3. Extract code patterns (imports, function signatures, etc.)
4. Load gotchas from spec or knowledge base
5. Fetch outputs from dependent tasks (if any)

**Deliverables:**

- `ContextLoader.load()` returns `GenerationContext`
- Provides Claude with relevant codebase examples
- Token-aware (respects context limits)

### Phase 3: Code Generation Integration (4-5 hours)

**Tasks:**

1. Extend existing `CodeGenerator` class
2. Build comprehensive prompts with context
3. Handle Claude API errors (rate limits, timeouts)
4. Implement retry logic with exponential backoff
5. Extract code from Claude responses (remove markdown fences)
6. Add feedback loop for failed attempts (include test errors in retry)

**Deliverables:**

- `CodeGenerator.generate()` produces valid code
- Retries on transient errors
- Includes previous attempt feedback for better results

### Phase 4: File Operations (2-3 hours)

**Tasks:**

1. Extend existing `FileWriter` class
2. Implement safe file creation (mkdir -p parents)
3. Implement precise file editing (old_string → new_string)
4. Add validation (file exists, string is unique)
5. Add error handling (permissions, disk space)

**Deliverables:**

- `FileWriter.write_file()` creates files safely
- `FileWriter.edit_file()` modifies files precisely
- Comprehensive error messages

### Phase 5: Test Validation (3-4 hours)

**Tasks:**

1. Implement `TestRunner` class
2. Parse pass criteria to extract commands
3. Execute commands via subprocess
4. Capture stdout/stderr and exit codes
5. Parse test output (pytest, npm test, tsc, etc.)
6. Aggregate results (total, passed, failed)
7. Add timeout handling

**Deliverables:**

- `TestRunner.run_validation()` returns `ValidationResult`
- Executes all testable criteria
- Detailed pass/fail reporting

### Phase 6: Main Worker Integration (2-3 hours)

**Tasks:**

1. Modify `main()` in `build_agent_worker.py`
2. Add spec parsing phase
3. Add context loading phase
4. Add execution phase (loop over files)
5. Add validation phase
6. Update database with results
7. Exit with appropriate code (0 or 1)

**Deliverables:**

- Full execution pipeline: parse → context → execute → validate
- Database updates (task status, execution logs)
- Proper exit codes for orchestrator

### Phase 7: Error Handling & Retry (2-3 hours)

**Tasks:**

1. Add error classification (transient vs permanent)
2. Implement retry logic for transient errors
3. Implement feedback loop for test failures
4. Add escalation for permanent errors (SIA)
5. Add comprehensive logging

**Deliverables:**

- Graceful handling of all error types
- Automatic retry with backoff
- Clear error messages in database

### Phase 8: Integration Testing (2-3 hours)

**Tasks:**

1. Create end-to-end test: Spec Agent → Build Agent → validation
2. Test success path (all criteria pass)
3. Test failure path (tests fail)
4. Test retry path (transient errors)
5. Test escalation path (permanent errors)
6. Verify observability logs

**Deliverables:**

- 5+ end-to-end test scenarios
- All pass criteria validated
- Integration with orchestrator confirmed

**Total Estimated Time:** 16-24 hours (2-3 days)

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/build-agent/test_spec_parser.py`

```python
def test_parse_spec_with_technical_design():
    parser = SpecParser()
    spec = parser.parse('docs/specs/TEST-001.md')

    assert len(spec.technical_design['files']) == 2
    assert spec.technical_design['files'][0]['path'] == 'server/routes/auth.ts'
    assert spec.technical_design['files'][0]['action'] == 'CREATE'

def test_parse_pass_criteria():
    parser = SpecParser()
    spec = parser.parse('docs/specs/TEST-001.md')

    assert len(spec.pass_criteria) == 5
    assert spec.pass_criteria[0]['text'] == 'npm test passes'
    assert spec.pass_criteria[0]['command'] == 'npm test'
    assert spec.pass_criteria[0]['testable'] == True
```

### Integration Tests

**File:** `tests/integration/build-agent/test_execution.py`

```python
def test_build_agent_executes_simple_task():
    # Create test task with spec
    task_id = create_test_task(
        spec_path='docs/specs/TEST-SIMPLE-001.md',
        status='pending'
    )

    # Spawn Build Agent
    result = subprocess.run(
        ['python3', 'coding-loops/agents/build_agent_worker.py',
         '--agent-id', 'test-agent', '--task-id', task_id],
        capture_output=True,
        timeout=120
    )

    # Verify success
    assert result.returncode == 0

    # Check task status
    task = db.query_one("SELECT * FROM tasks WHERE id = ?", (task_id,))
    assert task['status'] == 'completed'

    # Check generated file exists
    assert Path('test-output.txt').exists()
```

### Manual Testing Checklist

- [ ] Build Agent parses Spec Agent output correctly
- [ ] Build Agent generates valid TypeScript code
- [ ] Build Agent creates new files
- [ ] Build Agent modifies existing files
- [ ] Build Agent runs validation tests
- [ ] Build Agent retries on transient errors
- [ ] Build Agent escalates permanent errors
- [ ] Build Agent logs all phases to database
- [ ] Orchestrator detects Build Agent completion
- [ ] QA Agent can validate Build Agent output

---

## Open Questions

### 1. Code Editing Strategy?

**Question:** How should Build Agent edit existing files precisely?

**Options:**

- **A:** Always regenerate entire file (simple but loses unrelated changes)
- **B:** Use Edit tool with old_string/new_string (requires identifying exact insertion points)
- **C:** Use AST parsing to insert at specific nodes (complex but precise)

**Recommendation:** **B** for Phase 2, upgrade to **C** in Phase 4 (advanced features)

### 2. Test Failure Retry Limit?

**Question:** How many times should Build Agent retry when tests fail?

**Options:**

- **A:** 1 retry (fast feedback, may miss edge cases)
- **B:** 2 retries (balance speed and quality)
- **C:** 3 retries (thorough but slower)

**Recommendation:** **B** (2 retries: initial + 1 retry with feedback)

### 3. Validation Timeout?

**Question:** How long should Build Agent wait for tests to complete?

**Options:**

- **A:** 60 seconds (fast but may timeout large test suites)
- **B:** 120 seconds (default, works for most projects)
- **C:** 300 seconds (slow but safe for integration tests)

**Recommendation:** **B** (120s default, configurable via task metadata)

### 4. Manual Validation Handling?

**Question:** What should Build Agent do with non-testable pass criteria (e.g., "UI looks good")?

**Options:**

- **A:** Skip and mark as passed (optimistic)
- **B:** Skip and mark as needs_review (conservative)
- **C:** Generate screenshot and send to QA Agent (advanced)

**Recommendation:** **B** for Phase 2, **C** in Phase 6 (visual validation)

---

## References

### Existing Specifications

- **PHASE2-TASK-01**: Spec Agent v0.1 (creates input for Build Agent)
- **BUILD-AGENT-DEVELOPER-BRIEF**: Overview of Build Agent architecture
- **BUILD-AGENT-IMPLEMENTATION-PLAN**: 100-task implementation plan

### Architecture Documents

- **STRATEGIC_PLAN.md**: Phase 2 roadmap (lines 172-201)
- **parent-harness/docs/AGENTS.md**: Agent definitions

### Code References

- **coding-loops/agents/build_agent_worker.py**: Existing Python worker (1800+ lines)
- **server/services/task-agent/build-agent-orchestrator.ts**: TypeScript orchestrator
- **agents/build/core.ts**: Build Agent core (TypeScript version)
- **types/build-agent.ts**: Type definitions

---

## Success Metrics

### Short-term (2 weeks)

1. **Task Completion Rate**: 70% of tasks complete successfully on first attempt
2. **Validation Pass Rate**: 85% of generated code passes specified tests
3. **Error Recovery**: 90% of transient errors recovered via retry
4. **Execution Time**: Average task completion < 5 minutes

### Medium-term (1 month)

1. **Autonomous Execution**: 60% of user tasks complete fully autonomously (Spec → Build → QA → Done)
2. **Code Quality**: 80% of generated code requires no manual fixes
3. **Test Coverage**: Generated code includes tests (when specified)
4. **Developer Satisfaction**: Positive feedback on generated code quality

### Long-term (3 months)

1. **Full Autonomy**: 80% of tasks complete without human intervention
2. **Pattern Learning**: Build Agent references existing patterns in 95%+ of implementations
3. **Zero-Regression**: <2% of generated code breaks existing tests
4. **Cost Efficiency**: Average code generation cost <$0.30 per task (Claude API)

---

## Conclusion

PHASE2-TASK-02 completes the autonomous task execution pipeline by implementing the Build Agent's core execution capabilities. By consuming Spec Agent output, generating code via Claude, and validating through automated tests, the Build Agent enables true autonomous development from task brief to working, tested code.

**Key Success Factors:**

1. **Robust Spec Parsing** - Must handle all Spec Agent output formats
2. **Intelligent Code Generation** - Context-aware prompts with codebase patterns
3. **Reliable Validation** - Comprehensive test execution and result parsing
4. **Graceful Error Handling** - Retry transient errors, escalate permanent ones

**Next Steps:**

1. **Approval** - Review and approve this specification
2. **Implementation** - Assign to Build Agent (self-implementation!)
3. **Validation** - QA Agent verifies against pass criteria
4. **Integration** - Test full pipeline: Spec Agent → Build Agent → QA Agent

**Status:** Ready for implementation.
