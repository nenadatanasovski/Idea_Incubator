# Agent Observability Integration Template

> **Location:** `docs/specs/observability/AGENT-INTEGRATION-TEMPLATE.md`
> **Purpose:** Standard template for integrating ANY agent with the observability system
> **Audience:** Agent developers building new agents or retrofitting existing ones

---

## Overview

This template provides the standard pattern for any agent to emit observability data. The observability system is **agent-agnostic** - it works with:

- Build Agents
- Specification Agents
- Validation Agents
- UX Agents
- Self-Improvement Agents (SIA)
- Monitoring Agents
- Custom/Future Agents

Every agent follows the same integration pattern regardless of its specific function.

---

## 1. Required Integration Points

Every agent MUST implement these four integration points:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AGENT OBSERVABILITY CONTRACT                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   YOUR AGENT                      OBSERVABILITY SYSTEM                  │
│   ──────────                      ────────────────────                  │
│                                                                         │
│   ┌──────────────────┐            ┌──────────────────┐                 │
│   │ 1. TRANSCRIPT    │ ────────── │ transcript_      │                 │
│   │    Write events  │            │ entries          │                 │
│   └──────────────────┘            └──────────────────┘                 │
│                                                                         │
│   ┌──────────────────┐            ┌──────────────────┐                 │
│   │ 2. TOOL USE      │ ────────── │ tool_uses        │                 │
│   │    Log all tools │            │                  │                 │
│   └──────────────────┘            └──────────────────┘                 │
│                                                                         │
│   ┌──────────────────┐            ┌──────────────────┐                 │
│   │ 3. ASSERTIONS    │ ────────── │ assertion_       │                 │
│   │    Record tests  │            │ results          │                 │
│   └──────────────────┘            └──────────────────┘                 │
│                                                                         │
│   ┌──────────────────┐            ┌──────────────────┐                 │
│   │ 4. SKILLS        │ ────────── │ skill_traces     │                 │
│   │    Trace skills  │ (optional) │                  │                 │
│   └──────────────────┘            └──────────────────┘                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Python Integration Template

### 2.1 Base Agent Class Pattern

```python
"""
Template for agent observability integration.
Copy this pattern when building new agents.
"""

from shared.transcript_writer import TranscriptWriter
from shared.tool_use_logger import ToolUseLogger
from shared.skill_tracer import SkillTracer
from shared.assertion_recorder import AssertionRecorder
from dataclasses import dataclass
from typing import Optional
import uuid


@dataclass
class AgentContext:
    """Context passed to all observability methods."""
    execution_id: str
    agent_type: str  # e.g., "build", "spec", "validation", "ux", "sia"
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

    def __init__(self, agent_type: str, execution_id: str):
        self.context = AgentContext(
            execution_id=execution_id,
            agent_type=agent_type,
            instance_id=str(uuid.uuid4())
        )

        # Initialize observability producers
        self.transcript = TranscriptWriter(
            execution_id=execution_id,
            instance_id=self.context.instance_id
        )
        self.tool_logger = ToolUseLogger(self.transcript)
        self.skill_tracer = SkillTracer(self.transcript, self.tool_logger)
        self.assertions = AssertionRecorder(self.transcript, execution_id)

    # =========================================================================
    # LIFECYCLE EVENTS - Call these at phase boundaries
    # =========================================================================

    def log_phase_start(self, phase_name: str, summary: str = None):
        """
        Log the start of a phase.

        Args:
            phase_name: Name of phase (e.g., "prime", "execute", "validate")
            summary: Optional description of what this phase will do
        """
        self.transcript.write({
            "entry_type": "phase_start",
            "category": "lifecycle",
            "summary": summary or f"Starting phase: {phase_name}",
            "details": {
                "phase": phase_name,
                "agent_type": self.context.agent_type
            }
        })

    def log_phase_end(self, phase_name: str, status: str, summary: str = None):
        """
        Log the end of a phase.

        Args:
            phase_name: Name of phase
            status: "success", "partial", "failed"
            summary: Optional description of outcome
        """
        self.transcript.write({
            "entry_type": "phase_end",
            "category": "lifecycle",
            "summary": summary or f"Completed phase: {phase_name} ({status})",
            "details": {
                "phase": phase_name,
                "status": status,
                "agent_type": self.context.agent_type
            }
        })

    def log_task_start(self, task_id: str, task_title: str):
        """Log start of task execution."""
        self.context.task_id = task_id
        self.transcript.write({
            "entry_type": "task_start",
            "category": "lifecycle",
            "task_id": task_id,
            "summary": f"Starting task: {task_title}",
            "details": {"task_id": task_id, "title": task_title}
        })

    def log_task_end(self, task_id: str, status: str, summary: str = None):
        """Log end of task execution."""
        self.transcript.write({
            "entry_type": "task_end",
            "category": "lifecycle",
            "task_id": task_id,
            "summary": summary or f"Task {status}: {task_id}",
            "details": {"task_id": task_id, "status": status}
        })
        self.context.task_id = None

    # =========================================================================
    # TOOL USE - Wrap every tool invocation
    # =========================================================================

    def log_tool_start(self, tool_use_block) -> str:
        """
        Log start of tool invocation.

        Args:
            tool_use_block: The ToolUseBlock from Claude SDK

        Returns:
            tool_use_id for use in log_tool_end
        """
        return self.tool_logger.log_start(tool_use_block)

    def log_tool_end(self, tool_use_id: str, tool_result_block):
        """
        Log completion of tool invocation.

        Args:
            tool_use_id: ID returned from log_tool_start
            tool_result_block: The ToolResultBlock from Claude SDK
        """
        self.tool_logger.log_end(tool_use_id, tool_result_block)

    def log_tool_blocked(self, tool_use_id: str, reason: str):
        """
        Log security-blocked tool invocation.

        Args:
            tool_use_id: ID returned from log_tool_start
            reason: Why the tool was blocked
        """
        self.tool_logger.log_blocked(tool_use_id, reason)

    # =========================================================================
    # ASSERTIONS - Record test results with evidence
    # =========================================================================

    def start_assertion_chain(self, description: str) -> str:
        """
        Start a chain of assertions for a task.

        Args:
            description: What this assertion chain validates

        Returns:
            chain_id for use in end_assertion_chain
        """
        return self.assertions.start_chain(
            task_id=self.context.task_id,
            description=description
        )

    def assert_file_created(self, file_path: str):
        """Assert a file was created."""
        return self.assertions.assert_file_created(
            self.context.task_id, file_path
        )

    def assert_file_modified(self, file_path: str):
        """Assert a file was modified."""
        return self.assertions.assert_file_modified(
            self.context.task_id, file_path
        )

    def assert_typescript_compiles(self):
        """Assert TypeScript compilation passes."""
        return self.assertions.assert_typescript_compiles(self.context.task_id)

    def assert_tests_pass(self, test_pattern: str):
        """Assert tests pass."""
        return self.assertions.assert_tests_pass(
            self.context.task_id, test_pattern
        )

    def assert_custom(self, category: str, description: str, command: str):
        """Run a custom assertion."""
        return self.assertions.assert_custom(
            self.context.task_id, category, description, command
        )

    def end_assertion_chain(self, chain_id: str):
        """End assertion chain and compute result."""
        return self.assertions.end_chain(chain_id)

    # =========================================================================
    # SKILLS - Trace skill invocations (optional)
    # =========================================================================

    def trace_skill_start(self, skill_name: str, skill_file: str,
                          line_number: int, section_title: str) -> str:
        """
        Start tracing a skill invocation.

        Args:
            skill_name: Name of the skill
            skill_file: Path to skill definition file
            line_number: Line where skill is defined
            section_title: Section heading in skill file

        Returns:
            trace_id for use in trace_skill_end
        """
        from shared.skill_tracer import SkillReference
        return self.skill_tracer.trace_start(SkillReference(
            skill_name=skill_name,
            skill_file=skill_file,
            line_number=line_number,
            section_title=section_title
        ))

    def trace_skill_end(self, trace_id: str, status: str, error: str = None):
        """
        End skill trace.

        Args:
            trace_id: ID from trace_skill_start
            status: "success", "partial", or "failed"
            error: Error message if failed
        """
        self.skill_tracer.trace_end(trace_id, status, error)

    # =========================================================================
    # ERROR HANDLING - Log errors with context
    # =========================================================================

    def log_error(self, error: Exception, context: dict = None):
        """
        Log an error with full context.

        Args:
            error: The exception that occurred
            context: Additional context about what was happening
        """
        import traceback
        self.transcript.write({
            "entry_type": "error",
            "category": "lifecycle",
            "summary": f"Error: {str(error)}",
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
    # DISCOVERY - Log knowledge discoveries
    # =========================================================================

    def log_discovery(self, discovery_type: str, content: str, confidence: float):
        """
        Log a knowledge discovery (gotcha, pattern, decision).

        Args:
            discovery_type: "gotcha", "pattern", or "decision"
            content: What was discovered
            confidence: 0.0 to 1.0
        """
        self.transcript.write({
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
    # CLEANUP - Always call when agent completes
    # =========================================================================

    def close(self):
        """Flush and close all observability writers."""
        self.transcript.flush()
        self.transcript.close()
```

### 2.2 Usage Example: Custom Agent

```python
class SpecificationAgent(ObservableAgent):
    """Example: Specification Agent with observability."""

    def __init__(self, execution_id: str):
        super().__init__(
            agent_type="specification",
            execution_id=execution_id
        )

    def generate_specification(self, brief_path: str):
        """Generate spec from brief with full observability."""

        # Log phase start
        self.log_phase_start("analyze", "Analyzing brief document")

        try:
            # Start assertion chain
            chain_id = self.start_assertion_chain("Brief analysis validation")

            # Tool use is automatically logged when using Claude SDK
            # The message loop should call log_tool_start/end

            # After generating spec, validate
            self.assert_file_created("build/spec.md")
            self.assert_custom(
                category="schema_valid",
                description="Spec matches required schema",
                command="python3 validate_spec.py build/spec.md"
            )

            # End chain
            result = self.end_assertion_chain(chain_id)

            # Log phase end
            self.log_phase_end("analyze", result.overall_result)

        except Exception as e:
            self.log_error(e, {"phase": "analyze", "brief": brief_path})
            self.log_phase_end("analyze", "failed")
            raise

        finally:
            self.close()
```

---

## 3. TypeScript Integration Template

For TypeScript agents, use this pattern:

```typescript
// server/agents/observable-agent.ts

import { TranscriptWriter } from "../services/observability/transcript-writer";
import { ToolUseLogger } from "../services/observability/tool-use-logger";
import { AssertionRecorder } from "../services/observability/assertion-recorder";
import { v4 as uuid } from "uuid";

interface AgentContext {
  executionId: string;
  agentType: string;
  instanceId: string;
  taskId?: string;
  waveId?: string;
}

export abstract class ObservableAgent {
  protected context: AgentContext;
  protected transcript: TranscriptWriter;
  protected toolLogger: ToolUseLogger;
  protected assertions: AssertionRecorder;

  constructor(agentType: string, executionId: string) {
    this.context = {
      executionId,
      agentType,
      instanceId: uuid(),
    };

    this.transcript = new TranscriptWriter(
      executionId,
      this.context.instanceId,
    );
    this.toolLogger = new ToolUseLogger(this.transcript);
    this.assertions = new AssertionRecorder(this.transcript, executionId);
  }

  // Lifecycle
  logPhaseStart(phaseName: string, summary?: string): void {
    this.transcript.write({
      entryType: "phase_start",
      category: "lifecycle",
      summary: summary || `Starting phase: ${phaseName}`,
      details: { phase: phaseName, agentType: this.context.agentType },
    });
  }

  logPhaseEnd(
    phaseName: string,
    status: "success" | "partial" | "failed",
  ): void {
    this.transcript.write({
      entryType: "phase_end",
      category: "lifecycle",
      summary: `Completed phase: ${phaseName} (${status})`,
      details: { phase: phaseName, status, agentType: this.context.agentType },
    });
  }

  // Tool use
  logToolStart(toolUseBlock: ToolUseBlock): string {
    return this.toolLogger.logStart(toolUseBlock);
  }

  logToolEnd(toolUseId: string, toolResultBlock: ToolResultBlock): void {
    this.toolLogger.logEnd(toolUseId, toolResultBlock);
  }

  // Assertions
  startAssertionChain(description: string): string {
    return this.assertions.startChain(this.context.taskId!, description);
  }

  assertFileCreated(filePath: string): AssertionResult {
    return this.assertions.assertFileCreated(this.context.taskId!, filePath);
  }

  // Error handling
  logError(error: Error, context?: Record<string, unknown>): void {
    this.transcript.write({
      entryType: "error",
      category: "lifecycle",
      summary: `Error: ${error.message}`,
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

  // Cleanup
  async close(): Promise<void> {
    await this.transcript.flush();
    await this.transcript.close();
  }
}
```

---

## 4. Required Events by Agent Type

Different agents emit different events. Here's what each agent type MUST log:

### 4.1 All Agents (Required)

| Event           | When                   | Entry Type    |
| --------------- | ---------------------- | ------------- |
| Agent Start     | Agent begins execution | `phase_start` |
| Agent End       | Agent completes        | `phase_end`   |
| Tool Invocation | Every tool call        | `tool_use`    |
| Errors          | Any exception          | `error`       |

### 4.2 Build Agent

| Event       | When                | Entry Type     |
| ----------- | ------------------- | -------------- |
| Task Start  | Beginning task      | `task_start`   |
| Task End    | Completing task     | `task_end`     |
| File Lock   | Acquiring lock      | `lock_acquire` |
| File Unlock | Releasing lock      | `lock_release` |
| Checkpoint  | Creating checkpoint | `checkpoint`   |
| Assertion   | Running test        | `assertion`    |

### 4.3 Specification Agent

| Event               | When               | Entry Type                |
| ------------------- | ------------------ | ------------------------- |
| Brief Analysis      | Parsing brief      | `phase_start` (analyze)   |
| Question Generation | Creating questions | `phase_start` (question)  |
| Spec Generation     | Writing spec       | `phase_start` (generate)  |
| Task Generation     | Creating tasks     | `phase_start` (decompose) |

### 4.4 Validation Agent

| Event          | When                  | Entry Type   |
| -------------- | --------------------- | ------------ |
| Validation Run | Starting validation   | `validation` |
| Test Execution | Running tests         | `assertion`  |
| Coverage Check | Checking coverage     | `assertion`  |
| Security Scan  | Running security scan | `assertion`  |

### 4.5 UX Agent

| Event               | When                   | Entry Type    |
| ------------------- | ---------------------- | ------------- |
| Journey Start       | Beginning user journey | `phase_start` |
| Screenshot          | Taking screenshot      | `tool_use`    |
| Accessibility Check | Running a11y check     | `assertion`   |
| Journey End         | Completing journey     | `phase_end`   |

### 4.6 SIA (Self-Improvement Agent)

| Event              | When             | Entry Type  |
| ------------------ | ---------------- | ----------- |
| Pattern Extraction | Finding patterns | `discovery` |
| Gotcha Recording   | Recording gotcha | `discovery` |
| Knowledge Update   | Updating KB      | `phase_end` |

### 4.7 Monitoring Agent

| Event             | When            | Entry Type              |
| ----------------- | --------------- | ----------------------- |
| Health Check      | Running check   | `validation`            |
| Anomaly Detection | Finding anomaly | `discovery`             |
| Alert             | Raising alert   | `error` (with severity) |

---

## 5. Integration Checklist

Use this checklist when integrating a new agent:

### 5.1 Setup

- [ ] Import observability classes
- [ ] Extend `ObservableAgent` base class (or implement interface)
- [ ] Set unique `agent_type` identifier
- [ ] Generate unique `instance_id` per execution

### 5.2 Lifecycle Events

- [ ] Log `phase_start` at beginning of each phase
- [ ] Log `phase_end` at end of each phase with status
- [ ] Log `task_start`/`task_end` if agent processes tasks
- [ ] Log `error` for all exceptions with context

### 5.3 Tool Use

- [ ] Wrap Claude SDK message loop to capture tool blocks
- [ ] Call `log_tool_start()` before tool execution
- [ ] Call `log_tool_end()` after tool completion
- [ ] Call `log_tool_blocked()` for security-blocked tools

### 5.4 Assertions (if applicable)

- [ ] Start assertion chain at beginning of validation
- [ ] Record individual assertions with evidence
- [ ] End chain and capture overall result

### 5.5 Cleanup

- [ ] Call `close()` in finally block
- [ ] Ensure transcript is flushed on errors

---

## 6. Testing Your Integration

### 6.1 Verify Data Flow

After running your agent, check:

```sql
-- Verify transcript entries exist
SELECT * FROM transcript_entries
WHERE execution_id = 'your-exec-id'
ORDER BY sequence;

-- Verify tool uses logged
SELECT * FROM tool_uses
WHERE execution_id = 'your-exec-id';

-- Verify assertions recorded
SELECT * FROM assertion_results
WHERE execution_id = 'your-exec-id';
```

### 6.2 Use Observability Skills

```bash
# Validate data completeness
/obs-validate your-exec-id

# Check for errors
/obs-errors your-exec-id

# Get execution summary
/obs-summary your-exec-id
```

### 6.3 Verify in UI

1. Open Observability Dashboard
2. Select your execution
3. Verify Timeline shows phases
4. Verify Tool HeatMap shows tool usage
5. Verify Assertions show in sparklines

---

## 7. Common Patterns

### 7.1 Wrapping Claude SDK Message Loop

```python
async def run_message_loop(self, client, messages):
    """Message loop with observability."""

    while True:
        response = await client.messages.create(...)

        for block in response.content:
            if isinstance(block, ToolUseBlock):
                # Log tool start
                tool_id = self.log_tool_start(block)

                # Execute tool
                try:
                    result = await self.execute_tool(block)

                    # Check if blocked
                    if is_blocked(block):
                        self.log_tool_blocked(tool_id, get_block_reason())
                    else:
                        self.log_tool_end(tool_id, result)

                except Exception as e:
                    self.log_error(e, {"tool": block.name})
                    raise
```

### 7.2 Assertion Chain Pattern

```python
def validate_task(self, task):
    """Validation with assertion chain."""

    chain_id = self.start_assertion_chain(f"Validate {task.action}")

    try:
        if task.action == "CREATE":
            self.assert_file_created(task.file)
        elif task.action == "UPDATE":
            self.assert_file_modified(task.file)

        # Always check compilation
        self.assert_typescript_compiles()

        # Task-specific tests
        if task.test_pattern:
            self.assert_tests_pass(task.test_pattern)

    finally:
        result = self.end_assertion_chain(chain_id)
        return result.overall_result
```

### 7.3 Error Boundary Pattern

```python
def execute_with_observability(self, func, *args, **kwargs):
    """Execute function with error logging."""

    try:
        return func(*args, **kwargs)
    except Exception as e:
        self.log_error(e, {
            "function": func.__name__,
            "args": str(args)[:200],
            "kwargs": str(kwargs)[:200]
        })
        raise
```

---

## 8. Quick Reference

### 8.1 Entry Types

| Entry Type       | Category     | When to Use              |
| ---------------- | ------------ | ------------------------ |
| `phase_start`    | lifecycle    | Beginning of major phase |
| `phase_end`      | lifecycle    | End of major phase       |
| `task_start`     | lifecycle    | Beginning of task        |
| `task_end`       | lifecycle    | End of task              |
| `tool_use`       | action       | Tool invocation          |
| `skill_invoke`   | action       | Skill invocation start   |
| `skill_complete` | action       | Skill invocation end     |
| `validation`     | validation   | Validation check         |
| `assertion`      | validation   | Test assertion           |
| `discovery`      | knowledge    | Knowledge discovery      |
| `error`          | lifecycle    | Error occurred           |
| `checkpoint`     | coordination | Checkpoint created       |
| `lock_acquire`   | coordination | File locked              |
| `lock_release`   | coordination | File unlocked            |

### 8.2 Categories

| Category       | Purpose                          |
| -------------- | -------------------------------- |
| `lifecycle`    | Agent/task lifecycle events      |
| `action`       | Tool and skill invocations       |
| `validation`   | Tests and assertions             |
| `knowledge`    | Discoveries and learnings        |
| `coordination` | Locks, checkpoints, coordination |

### 8.3 Result Statuses

| Context     | Statuses                       |
| ----------- | ------------------------------ |
| Tool Result | `done`, `error`, `blocked`     |
| Phase/Task  | `success`, `partial`, `failed` |
| Assertion   | `pass`, `fail`, `skip`, `warn` |
| Chain       | `pass`, `fail`, `partial`      |

---

## Related Documents

| Document                                       | Purpose                          |
| ---------------------------------------------- | -------------------------------- |
| [SPEC.md](./SPEC.md)                           | Full observability specification |
| [python/README.md](./python/README.md)         | Python producer class details    |
| [data-model/README.md](./data-model/README.md) | Database schema                  |
| [tools/SKILLS.md](./tools/SKILLS.md)           | Query skills for validation      |
| [appendices/TYPES.md](./appendices/TYPES.md)   | Type definitions                 |

---

_Every agent that produces evidence can be trusted. Every agent that doesn't, cannot._
