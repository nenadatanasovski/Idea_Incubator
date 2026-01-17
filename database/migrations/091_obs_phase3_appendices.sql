-- =============================================================================
-- Migration: 091_obs_phase3_appendices.sql
-- Purpose: Insert acceptance criteria and test commands for Observability Phase 3 tasks
-- Created: 2026-01-17
-- =============================================================================

-- =============================================================================
-- OBS-100: Observable Agent Base Class (Python)
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs100-ac', 'obs-100', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-100
================================================================================

1. File Location
   - File exists at: coding-loops/shared/observable_agent.py

2. Class Definition
   - Class named ObservableAgent exists
   - Class is importable: from shared.observable_agent import ObservableAgent

3. Producer Initialization
   - __init__ initializes self.transcript_writer (TranscriptWriter instance)
   - __init__ initializes self.tool_logger (ToolUseLogger instance)
   - __init__ initializes self.skill_tracer (SkillTracer instance)
   - __init__ initializes self.assertion_recorder (AssertionRecorder instance)

4. Lifecycle Methods
   - log_phase_start(phase_name, details=None) -> str (returns entry_id)
   - log_phase_end(phase_name, duration_ms=None, details=None) -> str
   - log_task_start(task_id, task_title, details=None) -> str
   - log_task_end(task_id, status, duration_ms=None, details=None) -> str

5. Tool Logging Methods
   - log_tool_start(tool_name, tool_input, task_id=None) -> str (returns tool_id)
   - log_tool_end(tool_id, output, is_error=False, error_message=None) -> None
   - log_tool_blocked(tool_id, reason) -> None

6. Assertion Methods
   - start_assertion_chain(task_id, description) -> str (returns chain_id)
   - end_assertion_chain(chain_id) -> ChainResult
   - assert_manual(task_id, category, description, passed, evidence=None) -> str

7. Error Logging
   - log_error(message, task_id=None, details=None) -> str

8. Resource Management
   - close() method flushes all producers and closes connections

TEST COMMANDS
================================================================================
# Run test file
python3 tests/e2e/test-obs-phase3-integration.py

# Individual import test
python3 -c "from shared.observable_agent import ObservableAgent; print(''SUCCESS'')"

# Class inspection
python3 -c "from shared.observable_agent import ObservableAgent; print(dir(ObservableAgent))"
', 1),

    ('ta-obs100-code', 'obs-100', 'code_context', 'inline',
     '# ObservableAgent expected signature
class ObservableAgent:
    """Base class for agents with observability instrumentation."""

    def __init__(
        self,
        execution_id: str,
        instance_id: str,
        wave_id: Optional[str] = None,
        db_path: Optional[Path] = None
    ):
        """Initialize all observability producers."""
        self.execution_id = execution_id
        self.instance_id = instance_id

        # Initialize producers
        self.transcript_writer = TranscriptWriter(
            execution_id=execution_id,
            instance_id=instance_id,
            wave_id=wave_id,
            db_path=db_path
        )
        self.tool_logger = ToolUseLogger(self.transcript_writer, db_path=db_path)
        self.skill_tracer = SkillTracer(self.transcript_writer, self.tool_logger, db_path=db_path)
        self.assertion_recorder = AssertionRecorder(self.transcript_writer, execution_id, db_path=db_path)

    # Lifecycle methods
    def log_phase_start(self, phase_name: str, details: Optional[Dict] = None) -> str: ...
    def log_phase_end(self, phase_name: str, duration_ms: Optional[int] = None, details: Optional[Dict] = None) -> str: ...
    def log_task_start(self, task_id: str, task_title: str, details: Optional[Dict] = None) -> str: ...
    def log_task_end(self, task_id: str, status: str, duration_ms: Optional[int] = None, details: Optional[Dict] = None) -> str: ...

    # Tool logging
    def log_tool_start(self, tool_name: str, tool_input: Dict, task_id: Optional[str] = None) -> str: ...
    def log_tool_end(self, tool_id: str, output: Any, is_error: bool = False, error_message: Optional[str] = None) -> None: ...
    def log_tool_blocked(self, tool_id: str, reason: str) -> None: ...

    # Assertions
    def start_assertion_chain(self, task_id: str, description: str) -> str: ...
    def end_assertion_chain(self, chain_id: str) -> ChainResult: ...
    def assert_manual(self, task_id: str, category: str, description: str, passed: bool, evidence: Optional[Dict] = None) -> str: ...

    # Error logging
    def log_error(self, message: str, task_id: Optional[str] = None, details: Optional[Dict] = None) -> str: ...

    # Resource management
    def close(self) -> None: ...
', 2);

-- =============================================================================
-- OBS-110: TypeScript Observability Services
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs110-ac', 'obs-110', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-110
================================================================================

1. File Structure
   - server/services/observability/transcript-writer.ts exists
   - server/services/observability/tool-use-logger.ts exists
   - server/services/observability/assertion-recorder.ts exists
   - server/services/observability/index.ts exports all classes

2. TranscriptWriter Class
   - Constructor accepts: executionId, instanceId, waveId?, dbPath?
   - write(entry: TranscriptEntry) -> string (returns entry_id)
   - writePhaseStart(phaseName, details?) -> string
   - writePhaseEnd(phaseName, durationMs?, details?) -> string
   - writeTaskStart(taskId, taskTitle, details?) -> string
   - writeTaskEnd(taskId, status, durationMs?, details?) -> string
   - writeError(message, taskId?, details?) -> string
   - flush() -> Promise<void>
   - close() -> Promise<void>

3. ToolUseLogger Class
   - Constructor accepts: transcriptWriter, dbPath?
   - logStart(toolName, toolInput, taskId?) -> string (returns tool_id)
   - logEnd(toolId, output, isError?, errorMessage?) -> Promise<void>
   - logBlocked(toolId, reason) -> Promise<void>
   - logSimple(toolName, input, output, taskId?, isError?, errorMessage?) -> string

4. AssertionRecorder Class
   - Constructor accepts: transcriptWriter, executionId, dbPath?
   - startChain(taskId, description) -> string (returns chain_id)
   - endChain(chainId) -> Promise<ChainResult>
   - assertFileCreated(taskId, filePath) -> Promise<string>
   - assertFileModified(taskId, filePath) -> Promise<string>
   - assertTypescriptCompiles(taskId) -> Promise<string>
   - assertManual(taskId, category, description, passed, evidence?) -> string

5. Database Integration
   - Uses better-sqlite3 for database access
   - Writes to transcript_entries table
   - Writes to tool_uses table
   - Writes to assertion_chains table
   - Writes to assertion_results table

6. TypeScript Compilation
   - All files compile without errors: npx tsc --noEmit

TEST COMMANDS
================================================================================
# TypeScript compilation check
npx tsc --noEmit

# Check exports
grep -E "export.*TranscriptWriter" server/services/observability/index.ts
grep -E "export.*ToolUseLogger" server/services/observability/index.ts
grep -E "export.*AssertionRecorder" server/services/observability/index.ts
', 1),

    ('ta-obs110-gotcha', 'obs-110', 'gotcha_list', 'inline',
     'GOTCHAS FOR OBS-110
================================================================================

1. Use better-sqlite3, NOT sql.js
   - sql.js has performance issues with large databases
   - better-sqlite3 is synchronous but more reliable

2. Date Handling
   - Store dates as ISO8601 TEXT: new Date().toISOString()
   - SQLite does not have native datetime type

3. Foreign Keys
   - Must enable: db.pragma("foreign_keys = ON")
   - transcript_entries.execution_id -> task_list_execution_runs.id

4. Buffer Management
   - Implement buffering like Python version
   - Auto-flush when buffer reaches threshold
   - Explicit flush() before close()

5. JSONL Files
   - Also write to JSONL files for debugging
   - Path: coding-loops/transcripts/{execution_id}/unified.jsonl

6. Error Handling
   - Wrap DB operations in try/catch
   - Log but do not throw on write failures
   - Critical: do not break agent execution due to logging errors
', 2);

-- =============================================================================
-- OBS-101: Observable Agent Base Class (TypeScript)
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs101-ac', 'obs-101', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-101
================================================================================

1. File Location
   - File exists at: server/agents/observable-agent.ts

2. Class Definition
   - Abstract class named ObservableAgent
   - Exported from the file

3. Constructor
   - Accepts: executionId, instanceId, waveId?, dbPath?
   - Initializes transcriptWriter from server/services/observability/
   - Initializes toolUseLogger from server/services/observability/
   - Initializes assertionRecorder from server/services/observability/

4. Lifecycle Methods (protected)
   - logPhaseStart(phaseName: string, details?: Record<string, any>): string
   - logPhaseEnd(phaseName: string, durationMs?: number, details?: Record<string, any>): string
   - logTaskStart(taskId: string, taskTitle: string, details?: Record<string, any>): string
   - logTaskEnd(taskId: string, status: string, durationMs?: number, details?: Record<string, any>): string

5. Tool Logging Methods (protected)
   - logToolStart(toolName: string, toolInput: Record<string, any>, taskId?: string): string
   - logToolEnd(toolId: string, output: any, isError?: boolean, errorMessage?: string): Promise<void>
   - logToolBlocked(toolId: string, reason: string): Promise<void>

6. Error Logging (protected)
   - logError(message: string, taskId?: string, details?: Record<string, any>): string

7. Resource Management
   - async close(): Promise<void>

8. Imports
   - Imports from server/services/observability/
   - Does NOT duplicate implementation

TEST COMMANDS
================================================================================
# TypeScript compilation
npx tsc --noEmit

# Check class export
grep -E "export.*abstract.*class.*ObservableAgent" server/agents/observable-agent.ts

# Check import of observability services
grep -E "import.*services/observability" server/agents/observable-agent.ts
', 1);

-- =============================================================================
-- OBS-102: Build Agent Worker Base Integration
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs102-ac', 'obs-102', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-102
================================================================================

1. Build Agent Extends ObservableAgent
   - Import: from shared.observable_agent import ObservableAgent
   - Class: class BuildAgentWorker(ObservableAgent):
   - OR: Compose with self.observable = ObservableAgent(...)

2. Constructor Initialization
   - Call ObservableAgent.__init__() with execution_id, instance_id, wave_id
   - OR: Create ObservableAgent instance with same parameters

3. Lifecycle Method Calls
   - Call log_task_start() when task begins
   - Call log_task_end() when task completes (success or failure)
   - Call log_phase_start() for major phases (loading, generating, validating)
   - Call log_phase_end() when phases complete

4. Resource Cleanup
   - Call close() in finally block of run() method
   - Ensures all observability data is flushed before exit

TEST COMMANDS
================================================================================
# Run Phase 3 tests
python3 tests/e2e/test-obs-phase3-integration.py

# Check import
grep -E "from shared.observable_agent import" coding-loops/agents/build_agent_worker.py

# Check class inheritance or composition
grep -E "class BuildAgentWorker.*ObservableAgent|self.observable.*ObservableAgent" coding-loops/agents/build_agent_worker.py

# Check lifecycle calls
grep -E "log_task_start|log_task_end|log_phase_start|log_phase_end" coding-loops/agents/build_agent_worker.py
', 1);

-- =============================================================================
-- OBS-103: Build Agent Message Loop Integration
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs103-ac', 'obs-103', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-103
================================================================================

1. Tool Logging Before Execution
   - Call log_tool_start() BEFORE tool executes
   - Returns tool_id for tracking

2. Tool Logging After Execution
   - Call log_tool_end() AFTER tool completes
   - Pass tool_id, output, is_error flag

3. Security-Blocked Command Logging
   - Call log_tool_blocked() for security-blocked commands
   - Include reason why command was blocked

4. Tool Categories
   - Properly categorize tools (file_read, file_write, shell, etc.)
   - Use tool_logger.categorize_tool() or similar

5. All Claude SDK Tool Uses Logged
   - Every tool invocation through Claude SDK is captured
   - No tool use goes unlogged

TEST COMMANDS
================================================================================
# Run Phase 3 tests
python3 tests/e2e/test-obs-phase3-integration.py

# Check tool logging calls
grep -E "log_tool_start|log_tool_end|log_tool_blocked" coding-loops/agents/build_agent_worker.py

# Verify blocked logging
grep -E "blocked|security" coding-loops/agents/build_agent_worker.py
', 1);

-- =============================================================================
-- OBS-104: Build Agent Validation Phase Integration
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs104-ac', 'obs-104', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-104
================================================================================

1. Assertion Chains for Validation
   - Create assertion chain at start of validation
   - End chain at end of validation with overall result

2. File Assertions Match Task Action
   - CREATE tasks: assert_file_created()
   - UPDATE tasks: assert_file_modified()
   - DELETE tasks: assert_file_deleted()

3. TypeScript Compilation for .ts/.tsx
   - Check assert_typescript_compiles() for TypeScript files
   - Record compilation result as assertion

4. Evidence Collection
   - Each assertion includes evidence (command, exit_code, output)
   - Evidence links to how assertion was verified

5. Chain Aggregation
   - Chain overall_result reflects individual assertions
   - Pass/fail counts are accurate

TEST COMMANDS
================================================================================
# Run Phase 3 tests
python3 tests/e2e/test-obs-phase3-integration.py

# Check assertion usage
grep -E "assertion_recorder|start_chain|end_chain|assert_" coding-loops/agents/build_agent_worker.py

# Verify file assertions match actions
grep -E "assert_file_created|assert_file_modified|assert_file_deleted" coding-loops/agents/build_agent_worker.py
', 1);

-- =============================================================================
-- OBS-105: Specification Agent Integration
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs105-ac', 'obs-105', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-105
================================================================================

1. Extends/Uses ObservableAgent
   - Import from server/agents/observable-agent
   - Extend or compose with ObservableAgent

2. Four Phases Logged
   - analyze: when analyzing idea/brief
   - question: when generating questions
   - generate: when generating spec.md
   - decompose: when creating tasks.md

3. Assertion Chains for Validation
   - Create chain to validate spec.md creation
   - Create chain to validate tasks.md creation

4. Error Logging with Phase Context
   - Errors include which phase they occurred in
   - Use logError() with phase in details

TEST COMMANDS
================================================================================
# TypeScript compilation
npx tsc --noEmit

# Check ObservableAgent usage
grep -E "ObservableAgent|observable-agent" agents/specification/core.ts

# Check phase logging
grep -E "analyze|question|generate|decompose" agents/specification/core.ts
', 1);

-- =============================================================================
-- OBS-106: Validation Agent Integration
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs106-ac', 'obs-106', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-106
================================================================================

1. Extends/Uses ObservableAgent
   - Import from server/agents/observable-agent
   - Extend or compose with ObservableAgent

2. Each Validation Check Creates Assertion
   - TypeScript compilation -> assertion
   - Lint check -> assertion
   - Test execution -> assertion
   - Custom validation -> assertion

3. Evidence Includes Command Output
   - command: the command that was run
   - exit_code: the exit code
   - stdout/stderr: truncated output

4. Chain Aggregates Results
   - Overall result: pass/fail/partial
   - Accurate pass/fail counts

TEST COMMANDS
================================================================================
# TypeScript compilation
npx tsc --noEmit

# Check assertion patterns
grep -E "assertion|validate|check|evidence" agents/validation/orchestrator.ts
', 1);

-- =============================================================================
-- OBS-107: UX Agent Integration
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs107-ac', 'obs-107', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-107
================================================================================

1. Extends/Uses ObservableAgent
   - Import from server/agents/observable-agent
   - Extend or compose with ObservableAgent

2. User Journeys Logged as Phases
   - Each journey is a phase (logPhaseStart/End)
   - Journey steps within phase

3. Puppeteer Interactions as Tool Uses
   - click, fill, navigate logged as tool_use
   - Screenshot captures logged

4. Accessibility Checks as Assertions
   - axe-core results become assertions
   - WCAG violations are assertion failures

TEST COMMANDS
================================================================================
# TypeScript compilation
npx tsc --noEmit

# Check journey logging
grep -E "journey|phase|step" agents/ux/orchestrator.ts

# Check accessibility
grep -E "accessibility|a11y|axe" agents/ux/orchestrator.ts
', 1);

-- =============================================================================
-- OBS-108: SIA Integration
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs108-ac', 'obs-108', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-108
================================================================================

1. Extends/Uses ObservableAgent
   - Import from server/agents/observable-agent
   - Extend or compose with ObservableAgent

2. Discovery Logging
   - Every discovered pattern logged as discovery entry
   - Every discovered gotcha logged as discovery entry
   - Every architecture decision logged as discovery entry

3. Confidence Scores Included
   - Each discovery has confidence (0.0-1.0)
   - Confidence affects KB propagation

4. KB Updates Logged
   - Log when writing to knowledge_entries table
   - Log analysis failures with details

TEST COMMANDS
================================================================================
# TypeScript compilation
npx tsc --noEmit

# Check discovery logging
grep -E "discovery|pattern|gotcha|decision|knowledge" agents/sia/index.ts

# Check confidence
grep -E "confidence" agents/sia/index.ts
', 1);

-- =============================================================================
-- OBS-109: Monitoring Agent Integration
-- =============================================================================

INSERT OR REPLACE INTO task_appendices (id, task_id, appendix_type, content_type, content, position)
VALUES
    ('ta-obs109-ac', 'obs-109', 'acceptance_criteria', 'inline',
     'ACCEPTANCE CRITERIA FOR OBS-109
================================================================================

1. Extends/Uses ObservableAgent
   - Import from server/agents/observable-agent
   - Extend or compose with ObservableAgent

2. Health Checks as Validation Entries
   - Regular health checks logged
   - Use logPhaseStart/End for check cycles

3. Anomalies as Discovery Entries
   - Detected anomalies logged as discoveries
   - Type: "anomaly"

4. Alerts as Errors with Severity
   - Alerts logged with logError()
   - Severity in details: info, warning, error, critical

TEST COMMANDS
================================================================================
# TypeScript compilation
npx tsc --noEmit

# Check health logging
grep -E "health|check|status|monitor" server/monitoring/monitoring-agent.ts

# Check anomaly logging
grep -E "anomaly|alert|issue" server/monitoring/monitoring-agent.ts
', 1);
