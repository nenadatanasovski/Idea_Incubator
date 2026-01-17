# Observability System Implementation Plan - Phase 3: Agent Integration

> **Location:** `docs/specs/observability/implementation-plan-phase-3.md`
> **Purpose:** Actionable implementation plan for integrating observability into all agent types
> **Status:** Ready for execution
> **Priority:** P0 (Critical)
> **Dependencies:** Phase 1 (Database Schema), Phase 2 (Python Producers)

---

## Executive Summary

Phase 3 integrates the observability data producers (from Phase 2) into all existing agent types. Every agent must emit observability events through the standard producer interfaces.

| Scope               | Details                                                   |
| ------------------- | --------------------------------------------------------- |
| **Agent Types**     | Build, Specification, Validation, UX, SIA, Monitoring     |
| **Tasks**           | OBS-100 to OBS-115                                        |
| **Deliverables**    | Observability integration in 6 agent types + 1 base class |
| **Test Validation** | E2E test verifying all agents produce observability data  |

---

## First Principles: Agent Observability Contract

### Every Agent MUST

1. **Log lifecycle events**: `phase_start`, `phase_end` for major phases
2. **Log all tool invocations**: Every tool call through `ToolUseLogger`
3. **Handle errors with context**: All exceptions logged with stack traces
4. **Cleanup properly**: Call `close()` to flush and finalize transcripts

### Agent-Specific Requirements

| Agent Type  | Additional Requirements                                      |
| ----------- | ------------------------------------------------------------ |
| Build Agent | `task_start/end`, `lock_acquire/release`, `checkpoint`       |
| Spec Agent  | `phase_start/end` for analyze, question, generate, decompose |
| Validation  | `assertion` entries with evidence chains                     |
| UX Agent    | `phase_start/end` for journeys, `assertion` for a11y         |
| SIA         | `discovery` entries for gotchas, patterns, decisions         |
| Monitoring  | `validation`, `error` with severity levels                   |

---

## Task Breakdown

### OBS-100: Create Observable Agent Base Class (Python)

**File:** `coding-loops/shared/observable_agent.py`

**Purpose:** Provide a standard base class that all Python agents extend.

#### Class Implementation

```python
"""
Observable Agent Base Class

All Python agents should extend this class to get built-in observability.
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any
import uuid
import traceback

from shared.transcript_writer import TranscriptWriter
from shared.tool_use_logger import ToolUseLogger
from shared.skill_tracer import SkillTracer
from shared.assertion_recorder import AssertionRecorder


@dataclass
class AgentContext:
    """Context passed to all observability methods."""
    execution_id: str
    agent_type: str
    instance_id: str
    task_id: Optional[str] = None
    wave_id: Optional[str] = None


class ObservableAgent:
    """
    Base class for agents with observability integration.

    Usage:
        class MyAgent(ObservableAgent):
            def __init__(self, execution_id: str):
                super().__init__(
                    agent_type="my-agent",
                    execution_id=execution_id
                )
    """

    def __init__(self, agent_type: str, execution_id: str, wave_id: str = None):
        self.context = AgentContext(
            execution_id=execution_id,
            agent_type=agent_type,
            instance_id=str(uuid.uuid4()),
            wave_id=wave_id
        )

        # Initialize observability producers
        self.transcript = TranscriptWriter(
            execution_id=execution_id,
            instance_id=self.context.instance_id,
            wave_id=wave_id
        )
        self.tool_logger = ToolUseLogger(self.transcript)
        self.skill_tracer = SkillTracer(self.transcript, self.tool_logger)
        self.assertions = AssertionRecorder(self.transcript, execution_id)

    # =========================================================================
    # LIFECYCLE EVENTS
    # =========================================================================

    def log_phase_start(self, phase_name: str, summary: str = None) -> str:
        """Log start of a phase. Returns entry_id."""
        return self.transcript.write({
            "entry_type": "phase_start",
            "category": "lifecycle",
            "summary": summary or f"Starting phase: {phase_name}",
            "details": {
                "phase": phase_name,
                "agent_type": self.context.agent_type
            }
        })

    def log_phase_end(self, phase_name: str, status: str, summary: str = None) -> str:
        """Log end of a phase."""
        return self.transcript.write({
            "entry_type": "phase_end",
            "category": "lifecycle",
            "summary": summary or f"Completed phase: {phase_name} ({status})",
            "details": {
                "phase": phase_name,
                "status": status,
                "agent_type": self.context.agent_type
            }
        })

    def log_task_start(self, task_id: str, task_title: str) -> str:
        """Log start of task execution."""
        self.context.task_id = task_id
        return self.transcript.write({
            "entry_type": "task_start",
            "category": "lifecycle",
            "task_id": task_id,
            "summary": f"Starting task: {task_title}",
            "details": {"task_id": task_id, "title": task_title}
        })

    def log_task_end(self, task_id: str, status: str, summary: str = None) -> str:
        """Log end of task execution."""
        entry_id = self.transcript.write({
            "entry_type": "task_end",
            "category": "lifecycle",
            "task_id": task_id,
            "summary": summary or f"Task {status}: {task_id}",
            "details": {"task_id": task_id, "status": status}
        })
        self.context.task_id = None
        return entry_id

    # =========================================================================
    # TOOL USE LOGGING
    # =========================================================================

    def log_tool_start(self, tool_use_block) -> str:
        """Log start of tool invocation. Returns tool_use_id."""
        return self.tool_logger.log_start(tool_use_block)

    def log_tool_end(self, tool_use_id: str, tool_result_block) -> None:
        """Log completion of tool invocation."""
        self.tool_logger.log_end(tool_use_id, tool_result_block)

    def log_tool_blocked(self, tool_use_id: str, reason: str) -> None:
        """Log security-blocked tool invocation."""
        self.tool_logger.log_blocked(tool_use_id, reason)

    # =========================================================================
    # ASSERTIONS
    # =========================================================================

    def start_assertion_chain(self, description: str) -> str:
        """Start assertion chain. Returns chain_id."""
        return self.assertions.start_chain(
            task_id=self.context.task_id,
            description=description
        )

    def end_assertion_chain(self, chain_id: str):
        """End assertion chain and return result."""
        return self.assertions.end_chain(chain_id)

    def assert_file_created(self, file_path: str):
        """Assert file was created."""
        return self.assertions.assert_file_created(
            self.context.task_id, file_path
        )

    def assert_file_modified(self, file_path: str):
        """Assert file was modified."""
        return self.assertions.assert_file_modified(
            self.context.task_id, file_path
        )

    def assert_typescript_compiles(self):
        """Assert TypeScript compilation passes."""
        return self.assertions.assert_typescript_compiles(self.context.task_id)

    def assert_tests_pass(self, pattern: str):
        """Assert tests pass."""
        return self.assertions.assert_tests_pass(self.context.task_id, pattern)

    def assert_custom(self, category: str, description: str, command: str):
        """Run custom assertion."""
        return self.assertions.assert_custom(
            self.context.task_id, category, description, command
        )

    # =========================================================================
    # ERROR HANDLING
    # =========================================================================

    def log_error(self, error: Exception, context: Dict[str, Any] = None) -> str:
        """Log an error with full context."""
        return self.transcript.write({
            "entry_type": "error",
            "category": "lifecycle",
            "summary": f"Error: {str(error)[:150]}",
            "details": {
                "error_type": type(error).__name__,
                "error_message": str(error),
                "stack_trace": traceback.format_exc(),
                "context": context or {},
                "task_id": self.context.task_id,
                "agent_type": self.context.agent_type
            }
        })

    # =========================================================================
    # DISCOVERY (for SIA-like agents)
    # =========================================================================

    def log_discovery(self, discovery_type: str, content: str, confidence: float) -> str:
        """Log a knowledge discovery."""
        return self.transcript.write({
            "entry_type": "discovery",
            "category": "knowledge",
            "summary": f"Discovered {discovery_type}: {content[:100]}",
            "details": {
                "discovery_type": discovery_type,
                "content": content,
                "confidence": confidence,
                "agent_type": self.context.agent_type
            }
        })

    # =========================================================================
    # COORDINATION (for Build-like agents)
    # =========================================================================

    def log_lock_acquire(self, file_path: str) -> str:
        """Log file lock acquisition."""
        return self.transcript.write({
            "entry_type": "lock_acquire",
            "category": "coordination",
            "summary": f"Acquired lock: {file_path}",
            "details": {
                "file_path": file_path,
                "holder": self.context.instance_id,
                "task_id": self.context.task_id
            }
        })

    def log_lock_release(self, file_path: str) -> str:
        """Log file lock release."""
        return self.transcript.write({
            "entry_type": "lock_release",
            "category": "coordination",
            "summary": f"Released lock: {file_path}",
            "details": {
                "file_path": file_path,
                "holder": self.context.instance_id,
                "task_id": self.context.task_id
            }
        })

    def log_checkpoint(self, checkpoint_id: str, files: list) -> str:
        """Log checkpoint creation."""
        return self.transcript.write({
            "entry_type": "checkpoint",
            "category": "coordination",
            "summary": f"Created checkpoint: {checkpoint_id}",
            "details": {
                "checkpoint_id": checkpoint_id,
                "files": files,
                "task_id": self.context.task_id
            }
        })

    # =========================================================================
    # CLEANUP
    # =========================================================================

    def close(self) -> None:
        """Flush and close all observability writers."""
        self.transcript.flush()
        self.transcript.close()
```

#### Acceptance Criteria

- [ ] Class provides all lifecycle methods (`log_phase_start/end`, `log_task_start/end`)
- [ ] Class provides tool logging methods (`log_tool_start/end/blocked`)
- [ ] Class provides assertion methods (chain management + specific assertions)
- [ ] Class provides error logging with stack traces
- [ ] Class provides discovery logging for SIA-type agents
- [ ] Class provides coordination logging (locks, checkpoints)
- [ ] All methods return entry IDs for cross-referencing
- [ ] `close()` properly flushes and closes all writers

---

### OBS-101: Create Observable Agent Base Class (TypeScript)

**File:** `server/agents/observable-agent.ts`

**Purpose:** Provide a standard base class for TypeScript agents.

#### Class Implementation

```typescript
/**
 * Observable Agent Base Class (TypeScript)
 *
 * All TypeScript agents should extend this class for built-in observability.
 */

import { v4 as uuid } from "uuid";
import { TranscriptWriter } from "../services/observability/transcript-writer";
import { ToolUseLogger } from "../services/observability/tool-use-logger";
import { AssertionRecorder } from "../services/observability/assertion-recorder";

interface AgentContext {
  executionId: string;
  agentType: string;
  instanceId: string;
  taskId?: string;
  waveId?: string;
}

interface ToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  content: string | unknown[];
  is_error: boolean;
}

export abstract class ObservableAgent {
  protected context: AgentContext;
  protected transcript: TranscriptWriter;
  protected toolLogger: ToolUseLogger;
  protected assertions: AssertionRecorder;

  constructor(agentType: string, executionId: string, waveId?: string) {
    this.context = {
      executionId,
      agentType,
      instanceId: uuid(),
    };
    if (waveId) this.context.waveId = waveId;

    this.transcript = new TranscriptWriter(
      executionId,
      this.context.instanceId,
      waveId,
    );
    this.toolLogger = new ToolUseLogger(this.transcript);
    this.assertions = new AssertionRecorder(this.transcript, executionId);
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  protected logPhaseStart(phaseName: string, summary?: string): string {
    return this.transcript.write({
      entryType: "phase_start",
      category: "lifecycle",
      summary: summary || `Starting phase: ${phaseName}`,
      details: { phase: phaseName, agentType: this.context.agentType },
    });
  }

  protected logPhaseEnd(
    phaseName: string,
    status: "success" | "partial" | "failed",
    summary?: string,
  ): string {
    return this.transcript.write({
      entryType: "phase_end",
      category: "lifecycle",
      summary: summary || `Completed phase: ${phaseName} (${status})`,
      details: { phase: phaseName, status, agentType: this.context.agentType },
    });
  }

  protected logTaskStart(taskId: string, taskTitle: string): string {
    this.context.taskId = taskId;
    return this.transcript.write({
      entryType: "task_start",
      category: "lifecycle",
      taskId,
      summary: `Starting task: ${taskTitle}`,
      details: { taskId, title: taskTitle },
    });
  }

  protected logTaskEnd(
    taskId: string,
    status: string,
    summary?: string,
  ): string {
    const entryId = this.transcript.write({
      entryType: "task_end",
      category: "lifecycle",
      taskId,
      summary: summary || `Task ${status}: ${taskId}`,
      details: { taskId, status },
    });
    this.context.taskId = undefined;
    return entryId;
  }

  // =========================================================================
  // TOOL USE
  // =========================================================================

  protected logToolStart(toolUseBlock: ToolUseBlock): string {
    return this.toolLogger.logStart(toolUseBlock);
  }

  protected logToolEnd(
    toolUseId: string,
    toolResultBlock: ToolResultBlock,
  ): void {
    this.toolLogger.logEnd(toolUseId, toolResultBlock);
  }

  protected logToolBlocked(toolUseId: string, reason: string): void {
    this.toolLogger.logBlocked(toolUseId, reason);
  }

  // =========================================================================
  // ASSERTIONS
  // =========================================================================

  protected startAssertionChain(description: string): string {
    return this.assertions.startChain(this.context.taskId!, description);
  }

  protected endAssertionChain(chainId: string) {
    return this.assertions.endChain(chainId);
  }

  protected assertFileCreated(filePath: string) {
    return this.assertions.assertFileCreated(this.context.taskId!, filePath);
  }

  protected assertFileModified(filePath: string) {
    return this.assertions.assertFileModified(this.context.taskId!, filePath);
  }

  protected assertTypescriptCompiles() {
    return this.assertions.assertTypescriptCompiles(this.context.taskId!);
  }

  protected assertTestsPass(pattern: string) {
    return this.assertions.assertTestsPass(this.context.taskId!, pattern);
  }

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  protected logError(error: Error, context?: Record<string, unknown>): string {
    return this.transcript.write({
      entryType: "error",
      category: "lifecycle",
      summary: `Error: ${error.message.slice(0, 150)}`,
      details: {
        errorType: error.name,
        errorMessage: error.message,
        stackTrace: error.stack,
        context: context || {},
        taskId: this.context.taskId,
        agentType: this.context.agentType,
      },
    });
  }

  // =========================================================================
  // DISCOVERY
  // =========================================================================

  protected logDiscovery(
    discoveryType: string,
    content: string,
    confidence: number,
  ): string {
    return this.transcript.write({
      entryType: "discovery",
      category: "knowledge",
      summary: `Discovered ${discoveryType}: ${content.slice(0, 100)}`,
      details: {
        discoveryType,
        content,
        confidence,
        agentType: this.context.agentType,
      },
    });
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  protected logValidation(
    checkName: string,
    passed: boolean,
    details?: Record<string, unknown>,
  ): string {
    return this.transcript.write({
      entryType: "validation",
      category: "validation",
      summary: `Validation ${passed ? "passed" : "failed"}: ${checkName}`,
      details: {
        checkName,
        passed,
        ...details,
      },
    });
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  async close(): Promise<void> {
    await this.transcript.flush();
    await this.transcript.close();
  }
}
```

#### Acceptance Criteria

- [ ] Class mirrors Python `ObservableAgent` functionality
- [ ] All methods are `protected` for subclass use
- [ ] Async `close()` method for proper cleanup
- [ ] TypeScript interfaces defined for tool use/result blocks

---

### OBS-102: Integrate Build Agent Worker

**File:** `coding-loops/agents/build_agent_worker.py`

**Purpose:** Retrofit the Build Agent worker with observability.

#### Integration Points

| Location                  | What to Add                                         |
| ------------------------- | --------------------------------------------------- |
| `__init__`                | Initialize `ObservableAgent` base class             |
| Task execution loop start | `log_task_start()`                                  |
| Task execution loop end   | `log_task_end()` with status                        |
| File lock acquisition     | `log_lock_acquire()`                                |
| File lock release         | `log_lock_release()`                                |
| Checkpoint creation       | `log_checkpoint()`                                  |
| Tool execution            | `log_tool_start()` / `log_tool_end()`               |
| Validation phase          | `start_assertion_chain()` / `end_assertion_chain()` |
| Error handler             | `log_error()` with context                          |
| Cleanup                   | `close()` in finally block                          |

#### Code Modification Pattern

```python
# Before
class BuildAgentWorker:
    def __init__(self, execution_id: str, instance_id: str):
        self.execution_id = execution_id
        self.instance_id = instance_id

# After
from shared.observable_agent import ObservableAgent

class BuildAgentWorker(ObservableAgent):
    def __init__(self, execution_id: str, wave_id: str = None):
        super().__init__(
            agent_type="build-agent",
            execution_id=execution_id,
            wave_id=wave_id
        )
```

#### Acceptance Criteria

- [ ] Build Agent extends `ObservableAgent`
- [ ] Every task execution produces `task_start` and `task_end` entries
- [ ] All tool invocations logged through `ToolUseLogger`
- [ ] File locks logged as `lock_acquire` and `lock_release`
- [ ] Checkpoints logged with file list
- [ ] Errors logged with stack traces and context
- [ ] `close()` called in finally block of main execution

---

### OBS-103: Integrate Build Agent Message Loop

**File:** `coding-loops/agents/build_agent_worker.py` (message loop section)

**Purpose:** Wrap Claude SDK message loop to capture all tool uses.

#### Integration Pattern

```python
async def run_message_loop(self, client, messages):
    """Message loop with observability."""

    while True:
        response = await client.messages.create(
            model="claude-opus-4-5-20251101",
            max_tokens=4096,
            tools=self.tools,
            messages=messages
        )

        for block in response.content:
            if isinstance(block, ToolUseBlock):
                # Log tool start BEFORE execution
                tool_use_id = self.log_tool_start(block)

                try:
                    # Check security hooks first
                    if self.is_blocked(block):
                        self.log_tool_blocked(tool_use_id, self.get_block_reason(block))
                        result = ToolResultBlock(
                            content="Command blocked by security policy",
                            is_error=True
                        )
                    else:
                        # Execute tool
                        result = await self.execute_tool(block)
                        # Log tool end AFTER execution
                        self.log_tool_end(tool_use_id, result)

                except Exception as e:
                    self.log_error(e, {"tool": block.name, "input": str(block.input)[:200]})
                    raise

                # Continue conversation
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": [result]})

        # Check for stop condition
        if response.stop_reason == "end_turn":
            break
```

#### Acceptance Criteria

- [ ] Every tool invocation has a corresponding `tool_uses` row
- [ ] `log_tool_start` called BEFORE tool execution
- [ ] `log_tool_end` called AFTER tool execution
- [ ] `log_tool_blocked` called for security-blocked commands
- [ ] Exceptions logged with tool context

---

### OBS-104: Integrate Build Agent Validation Phase

**File:** `coding-loops/agents/build_agent_worker.py` (validation section)

**Purpose:** Use AssertionRecorder for PIV Validate phase.

#### Integration Pattern

```python
def validate_task(self, task):
    """Validation phase with assertion chains."""

    # Log validation phase start
    self.log_phase_start("validate", f"Validating task: {task.id}")

    # Start assertion chain
    chain_id = self.start_assertion_chain(f"Validate {task.action} task")

    try:
        # File existence assertions based on action
        if task.action == "CREATE":
            self.assert_file_created(task.file)
        elif task.action == "UPDATE":
            self.assert_file_modified(task.file)
        elif task.action == "DELETE":
            self.assertions.assert_file_deleted(self.context.task_id, task.file)

        # Always check TypeScript compilation
        if task.file.endswith(('.ts', '.tsx')):
            self.assert_typescript_compiles()

        # Run task-specific validation command if provided
        if task.validation_command:
            self.assert_custom(
                category="custom_validation",
                description=f"Task validation: {task.validation_command}",
                command=task.validation_command
            )

    finally:
        # End chain and get result
        chain_result = self.end_assertion_chain(chain_id)

        # Log validation phase end
        self.log_phase_end("validate", chain_result.overall_result)

        return chain_result
```

#### Acceptance Criteria

- [ ] Assertion chains created for each task validation
- [ ] File assertions match task action type (CREATE/UPDATE/DELETE)
- [ ] TypeScript compilation checked for `.ts`/`.tsx` files
- [ ] Custom validation commands supported
- [ ] Chain result includes pass/fail counts

---

### OBS-105: Integrate Specification Agent

**File:** `agents/specification/core.ts`

**Purpose:** Add observability to the Specification Agent.

#### Phases to Instrument

| Phase     | Entry Type    | Summary                           |
| --------- | ------------- | --------------------------------- |
| Analyze   | `phase_start` | "Analyzing brief document"        |
| Question  | `phase_start` | "Generating clarifying questions" |
| Generate  | `phase_start` | "Generating specification"        |
| Decompose | `phase_start` | "Decomposing into tasks"          |

#### Integration Pattern

```typescript
import { ObservableAgent } from "../observable-agent";

class SpecificationAgent extends ObservableAgent {
  constructor(executionId: string) {
    super("specification-agent", executionId);
  }

  async generateSpecification(briefPath: string): Promise<Specification> {
    // Phase 1: Analyze
    this.logPhaseStart("analyze", "Analyzing brief document");
    try {
      const analysis = await this.analyzeBrief(briefPath);
      this.logPhaseEnd("analyze", "success");
    } catch (error) {
      this.logError(error, { phase: "analyze", brief: briefPath });
      this.logPhaseEnd("analyze", "failed");
      throw error;
    }

    // Phase 2: Question (if needed)
    if (analysis.hasAmbiguities) {
      this.logPhaseStart("question", "Generating clarifying questions");
      const questions = await this.generateQuestions(analysis);
      this.logPhaseEnd("question", "success");
    }

    // Phase 3: Generate
    this.logPhaseStart("generate", "Generating specification");
    const spec = await this.generateSpec(analysis);

    // Validate spec was created
    const chainId = this.startAssertionChain("Spec generation validation");
    this.assertFileCreated("build/spec.md");
    const result = this.endAssertionChain(chainId);

    this.logPhaseEnd(
      "generate",
      result.overallResult === "pass" ? "success" : "partial",
    );

    // Phase 4: Decompose
    this.logPhaseStart("decompose", "Decomposing into atomic tasks");
    const tasks = await this.decomposeTasks(spec);
    this.assertFileCreated("build/tasks.md");
    this.logPhaseEnd("decompose", "success");

    await this.close();
    return spec;
  }
}
```

#### Acceptance Criteria

- [ ] Spec Agent extends `ObservableAgent`
- [ ] All 4 phases produce `phase_start` and `phase_end` entries
- [ ] Spec and tasks file creation validated with assertions
- [ ] Errors logged with phase context
- [ ] `close()` called on completion

---

### OBS-106: Integrate Validation Agent

**File:** `agents/validation/orchestrator.ts`

**Purpose:** Add observability to the Validation Agent.

#### Events to Log

| Event            | Entry Type   | Details                                 |
| ---------------- | ------------ | --------------------------------------- |
| Validation Start | `validation` | Test suite being executed               |
| Test Result      | `assertion`  | Individual test pass/fail with evidence |
| Coverage Check   | `assertion`  | Coverage percentage with threshold      |
| Security Scan    | `assertion`  | Security scan results                   |
| Validation End   | `phase_end`  | Overall validation result               |

#### Integration Pattern

```typescript
import { ObservableAgent } from "../observable-agent";

class ValidationAgent extends ObservableAgent {
  constructor(executionId: string) {
    super("validation-agent", executionId);
  }

  async runValidationSuite(taskId: string): Promise<ValidationResult> {
    this.context.taskId = taskId;

    this.logPhaseStart("validation", `Running validation suite for ${taskId}`);
    const chainId = this.startAssertionChain("Full validation suite");

    try {
      // TypeScript compilation
      const tscResult = this.assertTypescriptCompiles();

      // Lint check
      this.assertCustom("lint_passes", "ESLint passes", "npm run lint");

      // Unit tests
      this.assertTestsPass("**/*.test.ts");

      // Coverage check
      this.assertCustom(
        "coverage_check",
        "Coverage meets threshold (80%)",
        "npm run test:coverage -- --passWithNoTests",
      );

      // Security scan (if configured)
      if (this.securityScanEnabled) {
        this.assertCustom(
          "security_scan",
          "No high-severity vulnerabilities",
          "npm audit --audit-level=high",
        );
      }
    } finally {
      const result = this.endAssertionChain(chainId);
      this.logPhaseEnd("validation", result.overallResult);
      return result;
    }
  }
}
```

#### Acceptance Criteria

- [ ] Validation Agent extends `ObservableAgent`
- [ ] Each validation check creates an assertion entry
- [ ] Evidence includes command output and exit codes
- [ ] Chain aggregates all validation results
- [ ] Overall validation status logged as `phase_end`

---

### OBS-107: Integrate UX Agent

**File:** `agents/ux/orchestrator.ts`

**Purpose:** Add observability to the UX Agent.

#### Events to Log

| Event               | Entry Type    | Details                    |
| ------------------- | ------------- | -------------------------- |
| Journey Start       | `phase_start` | User journey being tested  |
| Screenshot          | `tool_use`    | Screenshot captured        |
| Click/Fill/Navigate | `tool_use`    | User interaction simulated |
| A11y Check          | `assertion`   | Accessibility check result |
| Journey End         | `phase_end`   | Journey completion status  |

#### Integration Pattern

```typescript
import { ObservableAgent } from "../observable-agent";

class UXAgent extends ObservableAgent {
  constructor(executionId: string) {
    super("ux-agent", executionId);
  }

  async runUserJourney(
    journeyName: string,
    steps: JourneyStep[],
  ): Promise<JourneyResult> {
    this.logPhaseStart("journey", `Running user journey: ${journeyName}`);
    const chainId = this.startAssertionChain(`UX Journey: ${journeyName}`);

    try {
      for (const step of steps) {
        // Log each interaction as tool use
        const toolId = this.logToolStart({
          id: `ux-${step.action}-${Date.now()}`,
          name: `puppeteer_${step.action}`,
          input: step.params,
        });

        const result = await this.executeStep(step);

        this.logToolEnd(toolId, {
          content: result.screenshot
            ? "Screenshot captured"
            : "Action completed",
          is_error: !result.success,
        });

        // Accessibility check after each navigation
        if (step.action === "navigate") {
          this.assertCustom(
            "accessibility_check",
            `Page accessible: ${step.params.url}`,
            "npx axe-core --check-page",
          );
        }
      }
    } finally {
      const result = this.endAssertionChain(chainId);
      this.logPhaseEnd("journey", result.overallResult);
      return result;
    }
  }
}
```

#### Acceptance Criteria

- [ ] UX Agent extends `ObservableAgent`
- [ ] User journeys logged as phases
- [ ] Each interaction step logged as tool use
- [ ] Accessibility checks recorded as assertions
- [ ] Screenshots referenced in tool output summaries

---

### OBS-108: Integrate Self-Improvement Agent (SIA)

**File:** `agents/sia/index.ts`

**Purpose:** Add observability to the SIA.

#### Events to Log

| Event              | Entry Type  | Details                        |
| ------------------ | ----------- | ------------------------------ |
| Pattern Extraction | `discovery` | Pattern found with confidence  |
| Gotcha Recording   | `discovery` | Gotcha recorded for KB         |
| Decision Capture   | `discovery` | Architecture decision captured |
| KB Update          | `phase_end` | Knowledge base updated         |

#### Integration Pattern

```typescript
import { ObservableAgent } from "../observable-agent";

class SelfImprovementAgent extends ObservableAgent {
  constructor(executionId: string) {
    super("sia", executionId);
  }

  async analyzeExecution(executionId: string): Promise<LearningReport> {
    this.logPhaseStart("extraction", "Extracting patterns from execution");

    const patterns: Pattern[] = [];
    const gotchas: Gotcha[] = [];
    const decisions: Decision[] = [];

    try {
      // Analyze failures for gotchas
      const failures = await this.getFailures(executionId);
      for (const failure of failures) {
        const gotcha = this.extractGotcha(failure);
        if (gotcha && gotcha.confidence > 0.7) {
          gotchas.push(gotcha);
          this.logDiscovery("gotcha", gotcha.description, gotcha.confidence);
        }
      }

      // Analyze successes for patterns
      const successes = await this.getSuccesses(executionId);
      for (const success of successes) {
        const pattern = this.extractPattern(success);
        if (pattern && pattern.confidence > 0.8) {
          patterns.push(pattern);
          this.logDiscovery("pattern", pattern.description, pattern.confidence);
        }
      }

      // Capture architecture decisions
      const architectureEvents = await this.getArchitectureEvents(executionId);
      for (const event of architectureEvents) {
        const decision = this.extractDecision(event);
        if (decision) {
          decisions.push(decision);
          this.logDiscovery(
            "decision",
            decision.description,
            decision.confidence,
          );
        }
      }

      // Update knowledge base
      await this.updateKnowledgeBase(patterns, gotchas, decisions);

      this.logPhaseEnd(
        "extraction",
        "success",
        `Extracted ${patterns.length} patterns, ${gotchas.length} gotchas, ${decisions.length} decisions`,
      );
    } catch (error) {
      this.logError(error, { executionId });
      this.logPhaseEnd("extraction", "failed");
      throw error;
    }

    await this.close();
    return { patterns, gotchas, decisions };
  }
}
```

#### Acceptance Criteria

- [ ] SIA extends `ObservableAgent`
- [ ] Every discovered pattern/gotcha/decision logged as `discovery`
- [ ] Confidence scores included in discovery details
- [ ] KB updates logged as phase completions
- [ ] Analysis failures logged with context

---

### OBS-109: Integrate Monitoring Agent

**File:** `server/monitoring/monitoring-agent.ts`

**Purpose:** Add observability to the Monitoring Agent.

#### Events to Log

| Event             | Entry Type   | Details                  |
| ----------------- | ------------ | ------------------------ |
| Health Check      | `validation` | System component health  |
| Anomaly Detection | `discovery`  | Anomaly found in metrics |
| Alert Raised      | `error`      | Alert with severity      |
| Threshold Breach  | `validation` | Threshold exceeded       |

#### Integration Pattern

```typescript
import { ObservableAgent } from "../observable-agent";

class MonitoringAgent extends ObservableAgent {
  constructor(executionId: string) {
    super("monitoring-agent", executionId);
  }

  async runHealthChecks(): Promise<HealthReport> {
    this.logPhaseStart("health-check", "Running system health checks");

    const results: HealthCheckResult[] = [];

    // Check database connectivity
    const dbCheck = await this.checkDatabase();
    this.logValidation("database_connectivity", dbCheck.healthy, {
      responseTimeMs: dbCheck.responseTimeMs,
    });
    results.push(dbCheck);

    // Check agent heartbeats
    const agentCheck = await this.checkAgentHeartbeats();
    this.logValidation("agent_heartbeats", agentCheck.healthy, {
      activeAgents: agentCheck.activeCount,
      stuckAgents: agentCheck.stuckCount,
    });
    results.push(agentCheck);

    // Check queue depth
    const queueCheck = await this.checkQueueDepth();
    if (!queueCheck.healthy) {
      this.logError(
        new Error(`Queue depth exceeded threshold: ${queueCheck.depth}`),
        {
          severity: "warning",
          threshold: queueCheck.threshold,
          actual: queueCheck.depth,
        },
      );
    }
    results.push(queueCheck);

    // Anomaly detection
    const anomalies = await this.detectAnomalies();
    for (const anomaly of anomalies) {
      this.logDiscovery("anomaly", anomaly.description, anomaly.severity / 10);

      if (anomaly.severity >= 8) {
        this.logError(
          new Error(`Critical anomaly detected: ${anomaly.description}`),
          {
            severity: "critical",
            anomalyType: anomaly.type,
            metrics: anomaly.metrics,
          },
        );
      }
    }

    const overallHealthy = results.every((r) => r.healthy);
    this.logPhaseEnd("health-check", overallHealthy ? "success" : "partial");

    return { results, anomalies, healthy: overallHealthy };
  }
}
```

#### Acceptance Criteria

- [ ] Monitoring Agent extends `ObservableAgent`
- [ ] Health checks logged as `validation` entries
- [ ] Anomalies logged as `discovery` entries
- [ ] Alerts logged as `error` with severity levels
- [ ] Overall health status logged as phase completion

---

### OBS-110: Create TypeScript Observability Services

**Files:**

- `server/services/observability/transcript-writer.ts`
- `server/services/observability/tool-use-logger.ts`
- `server/services/observability/assertion-recorder.ts`

**Purpose:** TypeScript implementations of data producers for TS agents.

These mirror the Python implementations from Phase 2 but in TypeScript.

#### TranscriptWriter (TypeScript)

```typescript
// server/services/observability/transcript-writer.ts

import Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

interface TranscriptEntryInput {
  entryType: string;
  category: string;
  summary: string;
  taskId?: string;
  details?: Record<string, unknown>;
  durationMs?: number;
}

export class TranscriptWriter {
  private db: Database.Database;
  private executionId: string;
  private instanceId: string;
  private waveId?: string;
  private sequence: number = 0;
  private jsonlPath: string;
  private buffer: string[] = [];

  constructor(executionId: string, instanceId: string, waveId?: string) {
    this.executionId = executionId;
    this.instanceId = instanceId;
    this.waveId = waveId;

    this.db = new Database("database/ideas.db");
    this.db.pragma("foreign_keys = ON");

    // Setup JSONL file
    const transcriptDir = `coding-loops/transcripts/${executionId}`;
    fs.mkdirSync(transcriptDir, { recursive: true });
    this.jsonlPath = path.join(transcriptDir, "unified.jsonl");
  }

  write(entry: TranscriptEntryInput): string {
    const id = uuid();
    const timestamp = new Date().toISOString();
    this.sequence++;

    const fullEntry = {
      id,
      timestamp,
      sequence: this.sequence,
      executionId: this.executionId,
      instanceId: this.instanceId,
      waveId: this.waveId,
      ...entry,
    };

    // Write to JSONL buffer
    this.buffer.push(JSON.stringify(fullEntry));

    // Write to SQLite
    const stmt = this.db.prepare(`
      INSERT INTO transcript_entries (
        id, timestamp, sequence, execution_id, instance_id, wave_id,
        entry_type, category, task_id, summary, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      timestamp,
      this.sequence,
      this.executionId,
      this.instanceId,
      this.waveId || null,
      entry.entryType,
      entry.category,
      entry.taskId || null,
      entry.summary,
      JSON.stringify(entry.details || {}),
    );

    return id;
  }

  async flush(): Promise<void> {
    if (this.buffer.length > 0) {
      fs.appendFileSync(this.jsonlPath, this.buffer.join("\n") + "\n");
      this.buffer = [];
    }
  }

  async close(): Promise<void> {
    await this.flush();
    this.db.close();
  }
}
```

#### Acceptance Criteria

- [ ] `TranscriptWriter` writes to both SQLite and JSONL
- [ ] `ToolUseLogger` creates linked `tool_uses` records
- [ ] `AssertionRecorder` creates chains and results
- [ ] All services use proper connection management
- [ ] Services are importable from `server/services/observability/`

---

## Phase 3 Test Validation Script

**File:** `tests/e2e/test-obs-phase3-integration.py`

```python
#!/usr/bin/env python3
"""
Phase 3 Agent Integration Validation Tests

Validates that all agents properly emit observability data.
"""

import sys
import os
import sqlite3
import time
from typing import List, Dict, Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../coding-loops'))

DB_PATH = 'database/ideas.db'
TEST_EXECUTION_ID = f'test-phase3-{int(time.time())}'


def get_db():
    return sqlite3.connect(DB_PATH)


# ============================================================================
# TEST 1: ObservableAgent base class works
# ============================================================================
def test_observable_agent_base_class():
    print("\n" + "=" * 70)
    print("TEST 1: ObservableAgent Base Class")
    print("=" * 70)

    from shared.observable_agent import ObservableAgent

    class TestAgent(ObservableAgent):
        def __init__(self):
            super().__init__(
                agent_type="test-agent",
                execution_id=TEST_EXECUTION_ID
            )

        def run_test_phase(self):
            self.log_phase_start("test", "Running test phase")
            self.log_task_start("task-001", "Test task")
            self.log_task_end("task-001", "success")
            self.log_phase_end("test", "success")

    agent = TestAgent()
    agent.run_test_phase()
    agent.close()

    # Verify entries created
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT entry_type, summary FROM transcript_entries
        WHERE execution_id = ?
        ORDER BY sequence
    """, (TEST_EXECUTION_ID,))

    entries = cursor.fetchall()
    assert len(entries) == 4, f"Expected 4 entries, got {len(entries)}"

    entry_types = [e[0] for e in entries]
    assert entry_types == ['phase_start', 'task_start', 'task_end', 'phase_end']

    conn.close()

    print("✓ ObservableAgent creates phase and task entries")
    print("✓ Entries are in correct sequence order")
    print("✓ TEST 1 PASSED\n")


# ============================================================================
# TEST 2: Tool logging through ObservableAgent
# ============================================================================
def test_tool_logging():
    print("=" * 70)
    print("TEST 2: Tool Logging via ObservableAgent")
    print("=" * 70)

    from shared.observable_agent import ObservableAgent

    class ToolTestAgent(ObservableAgent):
        def __init__(self):
            super().__init__(
                agent_type="tool-test-agent",
                execution_id=TEST_EXECUTION_ID
            )

    class MockToolUseBlock:
        id = "tool-test-id"
        name = "Read"
        input = {"file_path": "/test/path.txt"}

    class MockToolResultBlock:
        content = "File content"
        is_error = False

    agent = ToolTestAgent()

    tool_id = agent.log_tool_start(MockToolUseBlock())
    time.sleep(0.1)
    agent.log_tool_end(tool_id, MockToolResultBlock())

    agent.close()

    # Verify tool_uses record
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT tool, result_status, duration_ms
        FROM tool_uses
        WHERE execution_id = ?
    """, (TEST_EXECUTION_ID,))

    row = cursor.fetchone()
    assert row is not None, "No tool_uses record found"
    assert row[0] == "Read", f"Expected tool='Read', got {row[0]}"
    assert row[1] == "done", f"Expected status='done', got {row[1]}"
    assert row[2] >= 100, f"Expected duration >= 100ms, got {row[2]}"

    conn.close()

    print("✓ Tool logging creates tool_uses records")
    print("✓ Duration calculated correctly")
    print("✓ TEST 2 PASSED\n")


# ============================================================================
# TEST 3: Assertion chains through ObservableAgent
# ============================================================================
def test_assertion_chains():
    print("=" * 70)
    print("TEST 3: Assertion Chains via ObservableAgent")
    print("=" * 70)

    from shared.observable_agent import ObservableAgent

    class AssertionTestAgent(ObservableAgent):
        def __init__(self):
            super().__init__(
                agent_type="assertion-test-agent",
                execution_id=TEST_EXECUTION_ID
            )

    agent = AssertionTestAgent()
    agent.log_task_start("task-002", "Test assertions")

    # Create test file
    test_file = "/tmp/test_phase3_file.txt"
    with open(test_file, "w") as f:
        f.write("test")

    chain_id = agent.start_assertion_chain("Test assertion chain")

    result1 = agent.assert_file_created(test_file)  # Should pass
    result2 = agent.assert_file_created("/nonexistent.txt")  # Should fail

    chain_result = agent.end_assertion_chain(chain_id)

    agent.log_task_end("task-002", "partial")
    agent.close()

    # Cleanup
    os.remove(test_file)

    # Verify chain
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT overall_result, pass_count, fail_count
        FROM assertion_chains
        WHERE id = ?
    """, (chain_id,))

    row = cursor.fetchone()
    assert row is not None, "No assertion chain found"
    assert row[0] == "fail", f"Expected overall_result='fail', got {row[0]}"
    assert row[1] == 1, f"Expected pass_count=1, got {row[1]}"
    assert row[2] == 1, f"Expected fail_count=1, got {row[2]}"

    conn.close()

    print("✓ Assertion chains track pass/fail counts")
    print("✓ Overall result computed correctly")
    print("✓ TEST 3 PASSED\n")


# ============================================================================
# TEST 4: Error logging with context
# ============================================================================
def test_error_logging():
    print("=" * 70)
    print("TEST 4: Error Logging with Context")
    print("=" * 70)

    from shared.observable_agent import ObservableAgent

    class ErrorTestAgent(ObservableAgent):
        def __init__(self):
            super().__init__(
                agent_type="error-test-agent",
                execution_id=TEST_EXECUTION_ID
            )

    agent = ErrorTestAgent()

    try:
        raise ValueError("Test error for observability")
    except Exception as e:
        agent.log_error(e, {"phase": "test", "custom_data": "test123"})

    agent.close()

    # Verify error entry
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT entry_type, summary, details
        FROM transcript_entries
        WHERE execution_id = ? AND entry_type = 'error'
    """, (TEST_EXECUTION_ID,))

    row = cursor.fetchone()
    assert row is not None, "No error entry found"
    assert "ValueError" in row[2], "Error type not in details"
    assert "Test error" in row[1], "Error message not in summary"

    conn.close()

    print("✓ Errors logged with type and message")
    print("✓ Stack traces captured in details")
    print("✓ TEST 4 PASSED\n")


# ============================================================================
# TEST 5: Discovery logging (SIA-style)
# ============================================================================
def test_discovery_logging():
    print("=" * 70)
    print("TEST 5: Discovery Logging (SIA-style)")
    print("=" * 70)

    from shared.observable_agent import ObservableAgent

    class SIATestAgent(ObservableAgent):
        def __init__(self):
            super().__init__(
                agent_type="sia-test-agent",
                execution_id=TEST_EXECUTION_ID
            )

    agent = SIATestAgent()

    agent.log_discovery("gotcha", "Use TEXT for dates in SQLite, not DATETIME", 0.95)
    agent.log_discovery("pattern", "Always check file exists before reading", 0.87)
    agent.log_discovery("decision", "Using React Query for data fetching", 0.92)

    agent.close()

    # Verify discoveries
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COUNT(*) FROM transcript_entries
        WHERE execution_id = ? AND entry_type = 'discovery'
    """, (TEST_EXECUTION_ID,))

    count = cursor.fetchone()[0]
    assert count == 3, f"Expected 3 discoveries, got {count}"

    conn.close()

    print("✓ Discovery entries created for gotchas, patterns, decisions")
    print("✓ Confidence scores included")
    print("✓ TEST 5 PASSED\n")


# ============================================================================
# TEST 6: Coordination logging (locks, checkpoints)
# ============================================================================
def test_coordination_logging():
    print("=" * 70)
    print("TEST 6: Coordination Logging (Locks, Checkpoints)")
    print("=" * 70)

    from shared.observable_agent import ObservableAgent

    class BuildTestAgent(ObservableAgent):
        def __init__(self):
            super().__init__(
                agent_type="build-test-agent",
                execution_id=TEST_EXECUTION_ID
            )

    agent = BuildTestAgent()

    agent.log_lock_acquire("src/user.ts")
    agent.log_checkpoint("chk-001", ["src/user.ts", "src/index.ts"])
    agent.log_lock_release("src/user.ts")

    agent.close()

    # Verify coordination entries
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT entry_type FROM transcript_entries
        WHERE execution_id = ? AND category = 'coordination'
        ORDER BY sequence
    """, (TEST_EXECUTION_ID,))

    entries = [r[0] for r in cursor.fetchall()]
    assert entries == ['lock_acquire', 'checkpoint', 'lock_release']

    conn.close()

    print("✓ Lock acquire/release logged")
    print("✓ Checkpoints logged with file lists")
    print("✓ TEST 6 PASSED\n")


# ============================================================================
# TEST 7: Full agent simulation
# ============================================================================
def test_full_agent_simulation():
    print("=" * 70)
    print("TEST 7: Full Agent Simulation")
    print("=" * 70)

    from shared.observable_agent import ObservableAgent

    class FullTestAgent(ObservableAgent):
        def __init__(self):
            super().__init__(
                agent_type="full-test-agent",
                execution_id=TEST_EXECUTION_ID
            )

        def execute(self):
            # Prime phase
            self.log_phase_start("prime", "Loading context")
            self.log_phase_end("prime", "success")

            # Iterate phase with task
            self.log_phase_start("iterate", "Executing tasks")

            self.log_task_start("task-full-001", "Create user.ts")
            self.log_lock_acquire("src/user.ts")

            # Simulate tool use
            class MockTool:
                id = "full-tool-1"
                name = "Write"
                input = {"file_path": "src/user.ts", "content": "..."}

            class MockResult:
                content = "File written"
                is_error = False

            tool_id = self.log_tool_start(MockTool())
            self.log_tool_end(tool_id, MockResult())

            self.log_lock_release("src/user.ts")
            self.log_checkpoint("chk-full-001", ["src/user.ts"])
            self.log_task_end("task-full-001", "success")

            self.log_phase_end("iterate", "success")

            # Validate phase
            self.log_phase_start("validate", "Running validation")

            # Create test file for assertion
            test_file = "/tmp/test_full_agent.txt"
            with open(test_file, "w") as f:
                f.write("test")

            chain_id = self.start_assertion_chain("Validate task")
            self.assert_file_created(test_file)
            result = self.end_assertion_chain(chain_id)

            os.remove(test_file)

            self.log_phase_end("validate", result.overall_result)

    agent = FullTestAgent()
    agent.execute()
    agent.close()

    # Verify comprehensive data
    conn = get_db()
    cursor = conn.cursor()

    # Check phase entries
    cursor.execute("""
        SELECT COUNT(*) FROM transcript_entries
        WHERE execution_id = ? AND entry_type IN ('phase_start', 'phase_end')
    """, (TEST_EXECUTION_ID,))
    phase_count = cursor.fetchone()[0]
    assert phase_count == 6, f"Expected 6 phase entries (3 start + 3 end), got {phase_count}"

    # Check task entries
    cursor.execute("""
        SELECT COUNT(*) FROM transcript_entries
        WHERE execution_id = ? AND entry_type IN ('task_start', 'task_end')
    """, (TEST_EXECUTION_ID,))
    task_count = cursor.fetchone()[0]
    assert task_count == 2, f"Expected 2 task entries, got {task_count}"

    # Check tool uses
    cursor.execute("""
        SELECT COUNT(*) FROM tool_uses
        WHERE execution_id = ?
    """, (TEST_EXECUTION_ID,))
    tool_count = cursor.fetchone()[0]
    assert tool_count >= 1, f"Expected at least 1 tool use, got {tool_count}"

    # Check assertions
    cursor.execute("""
        SELECT COUNT(*) FROM assertion_chains
        WHERE execution_id = ?
    """, (TEST_EXECUTION_ID,))
    chain_count = cursor.fetchone()[0]
    assert chain_count >= 1, f"Expected at least 1 assertion chain, got {chain_count}"

    conn.close()

    print("✓ Full agent lifecycle captured")
    print("✓ All PIV phases logged")
    print("✓ Tool uses and assertions recorded")
    print("✓ TEST 7 PASSED\n")


# ============================================================================
# Cleanup
# ============================================================================
def cleanup():
    print("=" * 70)
    print("CLEANUP: Removing test data")
    print("=" * 70)

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM assertion_results WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM assertion_chains WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM tool_uses WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM skill_traces WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM transcript_entries WHERE execution_id = ?", (TEST_EXECUTION_ID,))

    conn.commit()
    conn.close()

    print("✓ Test data cleaned up\n")


# ============================================================================
# Main
# ============================================================================
def main():
    print("\n" + "=" * 70)
    print("OBSERVABILITY PHASE 3 AGENT INTEGRATION TESTS")
    print("=" * 70)

    try:
        test_observable_agent_base_class()
        test_tool_logging()
        test_assertion_chains()
        test_error_logging()
        test_discovery_logging()
        test_coordination_logging()
        test_full_agent_simulation()

        print("=" * 70)
        print("ALL PHASE 3 TESTS PASSED")
        print("=" * 70)

    except Exception as e:
        print("\n" + "=" * 70)
        print(f"PHASE 3 TEST FAILURE: {e}")
        print("=" * 70)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cleanup()


if __name__ == "__main__":
    main()
```

---

## Task Summary

| Task ID | Title                              | File                                        | Priority | Dependencies       |
| ------- | ---------------------------------- | ------------------------------------------- | -------- | ------------------ |
| OBS-100 | Observable Agent Base (Python)     | `coding-loops/shared/observable_agent.py`   | P0       | OBS-003 to OBS-006 |
| OBS-101 | Observable Agent Base (TypeScript) | `server/agents/observable-agent.ts`         | P0       | OBS-110            |
| OBS-102 | Build Agent Integration            | `coding-loops/agents/build_agent_worker.py` | P0       | OBS-100            |
| OBS-103 | Build Agent Message Loop           | `coding-loops/agents/build_agent_worker.py` | P0       | OBS-102            |
| OBS-104 | Build Agent Validation Phase       | `coding-loops/agents/build_agent_worker.py` | P0       | OBS-102            |
| OBS-105 | Specification Agent Integration    | `agents/specification/core.ts`              | P0       | OBS-101            |
| OBS-106 | Validation Agent Integration       | `agents/validation/orchestrator.ts`         | P0       | OBS-101            |
| OBS-107 | UX Agent Integration               | `agents/ux/orchestrator.ts`                 | P0       | OBS-101            |
| OBS-108 | SIA Integration                    | `agents/sia/index.ts`                       | P0       | OBS-101            |
| OBS-109 | Monitoring Agent Integration       | `server/monitoring/monitoring-agent.ts`     | P0       | OBS-101            |
| OBS-110 | TypeScript Observability Services  | `server/services/observability/*.ts`        | P0       | OBS-001, OBS-002   |

### Test Validation Tasks

| Task ID     | Title                          | File                                       | Priority | Dependencies       |
| ----------- | ------------------------------ | ------------------------------------------ | -------- | ------------------ |
| OBS-TEST-03 | Phase 3 integration validation | `tests/e2e/test-obs-phase3-integration.py` | P0       | OBS-100 to OBS-110 |

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3 IMPLEMENTATION SEQUENCE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRE-REQUISITES (from Phases 1 & 2)                                     │
│  ─────────────────────────────────                                      │
│  ✓ Database tables created (Phase 1)                                    │
│  ✓ Python producers implemented (Phase 2)                               │
│                                                                          │
│  PHASE 3a: Base Classes                                                  │
│  ─────────────────────────                                              │
│  1. OBS-100: Create Python ObservableAgent base class                   │
│  2. OBS-110: Create TypeScript observability services                   │
│  3. OBS-101: Create TypeScript ObservableAgent base class               │
│                                                                          │
│  PHASE 3b: Python Agents                                                 │
│  ───────────────────────                                                │
│  4. OBS-102: Integrate Build Agent (base)                               │
│  5. OBS-103: Integrate Build Agent message loop                         │
│  6. OBS-104: Integrate Build Agent validation phase                     │
│                                                                          │
│  PHASE 3c: TypeScript Agents                                             │
│  ──────────────────────────                                             │
│  7. OBS-105: Integrate Specification Agent                              │
│  8. OBS-106: Integrate Validation Agent                                 │
│  9. OBS-107: Integrate UX Agent                                         │
│  10. OBS-108: Integrate SIA                                             │
│  11. OBS-109: Integrate Monitoring Agent                                │
│                                                                          │
│  VALIDATION                                                              │
│  ──────────                                                             │
│  12. Run: python3 tests/e2e/test-obs-phase3-integration.py             │
│      └─ Verify: ALL PHASE 3 TESTS PASSED                                │
│                                                                          │
│  SUCCESS CRITERIA                                                        │
│  ────────────────                                                       │
│  ✓ All 6 agent types extend ObservableAgent                             │
│  ✓ All agents produce transcript entries                                │
│  ✓ Tool uses logged for every tool invocation                           │
│  ✓ Assertion chains created for validation                              │
│  ✓ Errors logged with stack traces                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Run Commands

```bash
# After implementing Phase 3 tasks
python3 tests/e2e/test-obs-phase3-integration.py
```

### Expected Output (Success)

```
======================================================================
OBSERVABILITY PHASE 3 AGENT INTEGRATION TESTS
======================================================================

======================================================================
TEST 1: ObservableAgent Base Class
======================================================================
✓ ObservableAgent creates phase and task entries
✓ Entries are in correct sequence order
✓ TEST 1 PASSED

======================================================================
TEST 2: Tool Logging via ObservableAgent
======================================================================
✓ Tool logging creates tool_uses records
✓ Duration calculated correctly
✓ TEST 2 PASSED

[... all 7 tests pass ...]

======================================================================
ALL PHASE 3 TESTS PASSED
======================================================================
```

---

## Related Documents

| Document                                                                 | Purpose                     |
| ------------------------------------------------------------------------ | --------------------------- |
| [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md)         | Full integration template   |
| [implementation-plan-phases-1-2.md](./implementation-plan-phases-1-2.md) | Phase 1 & 2 (prerequisites) |
| [python/README.md](./python/README.md)                                   | Python producer APIs        |
| [appendices/TYPES.md](./appendices/TYPES.md)                             | TypeScript type definitions |

---

_Phase 3 Implementation Plan: Agent Integration_
