# Observability Python Data Producers

> **Navigation:** [Documentation Index](../../DOCUMENTATION-INDEX.md) > [Observability Spec](../SPEC.md) > Python
> **Location:** `docs/specs/observability/python/README.md`
> **Purpose:** Python data producer classes for Build Agent observability

---

## Overview

The observability system uses 4 Python data producer classes that run within Build Agent workers:

```
┌─────────────────────────────────────────────────────────────┐
│                    BUILD AGENT WORKER                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐     ┌──────────────────┐             │
│  │ TranscriptWriter │     │  ToolUseLogger   │             │
│  │ (transcript_writer.py) │ (tool_use_logger.py)          │
│  └────────┬─────────┘     └────────┬─────────┘             │
│           │                        │                        │
│           │   ┌────────────────────┤                        │
│           │   │                    │                        │
│           ▼   ▼                    ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐             │
│  │  SkillTracer     │     │AssertionRecorder │             │
│  │ (skill_tracer.py)│     │(assertion_recorder.py)         │
│  └────────┬─────────┘     └────────┬─────────┘             │
│           │                        │                        │
│           └────────────────────────┤                        │
│                                    │                        │
│                                    ▼                        │
│                        ┌──────────────────┐                │
│                        │   SQLite + JSONL  │                │
│                        │   (shared output)  │                │
│                        └──────────────────┘                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## File Locations

| Class               | File Path                                   |
| ------------------- | ------------------------------------------- |
| `TranscriptWriter`  | `coding-loops/shared/transcript_writer.py`  |
| `ToolUseLogger`     | `coding-loops/shared/tool_use_logger.py`    |
| `SkillTracer`       | `coding-loops/shared/skill_tracer.py`       |
| `AssertionRecorder` | `coding-loops/shared/assertion_recorder.py` |

---

## 1. TranscriptWriter

Writes unified transcript entries to JSONL files and SQLite.

### Class Interface

```python
class TranscriptWriter:
    def __init__(self, execution_id: str, instance_id: str):
        """Initialize writer for an execution."""
        pass

    def write(self, entry: TranscriptEntry) -> str:
        """
        Write a transcript entry.

        Args:
            entry: TranscriptEntry object (without id, timestamp, sequence)

        Returns:
            Generated entry ID
        """
        pass

    def flush(self) -> None:
        """Flush buffered entries to JSONL file."""
        pass

    def close(self) -> None:
        """Close writer and finalize transcript."""
        pass
```

### Entry Types

| Type             | When to Use                                       |
| ---------------- | ------------------------------------------------- |
| `phase_start`    | Beginning of PIV phase (prime, iterate, validate) |
| `phase_end`      | End of PIV phase                                  |
| `task_start`     | Beginning of task execution                       |
| `task_end`       | End of task execution                             |
| `tool_use`       | Tool invocation (linked to ToolUseLogger)         |
| `skill_invoke`   | Skill invocation start                            |
| `skill_complete` | Skill invocation end                              |
| `decision`       | Agent decision point                              |
| `validation`     | Validation check                                  |
| `assertion`      | Test assertion                                    |
| `discovery`      | Knowledge discovery                               |
| `error`          | Error occurred                                    |
| `checkpoint`     | Checkpoint created/restored                       |
| `lock_acquire`   | File lock acquired                                |
| `lock_release`   | File lock released                                |

---

## 2. ToolUseLogger

Captures every tool invocation with inputs, outputs, and result status.

### Class Interface

```python
class ToolUseLogger:
    def __init__(self, transcript_writer: TranscriptWriter):
        """Initialize logger with transcript writer."""
        pass

    def log_start(self, tool_use_block: ToolUseBlock) -> str:
        """
        Log start of tool use.

        Args:
            tool_use_block: Claude SDK ToolUseBlock

        Returns:
            Generated tool use ID
        """
        pass

    def log_end(self, tool_use_id: str, tool_result_block: ToolResultBlock) -> None:
        """
        Log end of tool use with result.

        Args:
            tool_use_id: ID from log_start
            tool_result_block: Claude SDK ToolResultBlock
        """
        pass

    def log_blocked(self, tool_use_id: str, reason: str) -> None:
        """
        Log security-blocked tool use.

        Args:
            tool_use_id: ID from log_start
            reason: Why command was blocked
        """
        pass
```

### Result Status Mapping

| Condition                        | Status    |
| -------------------------------- | --------- |
| `is_error=False` and not blocked | `done`    |
| `is_error=True`                  | `error`   |
| Security hook blocked            | `blocked` |

---

## 3. SkillTracer

Traces skill invocations with file:line references.

### Class Interface

```python
class SkillTracer:
    def __init__(self, transcript_writer: TranscriptWriter, tool_logger: ToolUseLogger):
        """Initialize tracer with writer and tool logger."""
        pass

    def trace_start(self, skill_ref: SkillReference) -> str:
        """
        Start tracing a skill invocation.

        Args:
            skill_ref: SkillReference with file, line, section

        Returns:
            Generated skill trace ID
        """
        pass

    def trace_end(self, trace_id: str, status: str, error: Optional[str] = None) -> None:
        """
        End skill trace.

        Args:
            trace_id: ID from trace_start
            status: 'success', 'partial', or 'failed'
            error: Error message if failed
        """
        pass

    def get_active_skill(self) -> Optional[str]:
        """Get ID of currently active skill trace (for nesting)."""
        pass
```

### Skill Reference

```python
@dataclass
class SkillReference:
    skill_name: str        # e.g., "code-generation"
    skill_file: str        # e.g., "skills/code-generation.md"
    line_number: int       # Line where skill is defined
    section_title: str     # Section heading in skill file
```

---

## 4. AssertionRecorder

Records test assertions with evidence linking.

### Class Interface

```python
class AssertionRecorder:
    def __init__(self, transcript_writer: TranscriptWriter, execution_id: str):
        """Initialize recorder."""
        pass

    def assert_file_created(self, task_id: str, file_path: str) -> AssertionResult:
        """Assert file was created."""
        pass

    def assert_file_modified(self, task_id: str, file_path: str) -> AssertionResult:
        """Assert file was modified."""
        pass

    def assert_typescript_compiles(self, task_id: str) -> AssertionResult:
        """Assert TypeScript compilation passes."""
        pass

    def assert_lint_passes(self, task_id: str, file_path: str) -> AssertionResult:
        """Assert linting passes."""
        pass

    def assert_tests_pass(self, task_id: str, test_pattern: str) -> AssertionResult:
        """Assert tests pass."""
        pass

    def assert_custom(
        self,
        task_id: str,
        category: str,
        description: str,
        command: str
    ) -> AssertionResult:
        """Run custom assertion with command."""
        pass

    def start_chain(self, task_id: str, description: str) -> str:
        """Start assertion chain for a task."""
        pass

    def end_chain(self, chain_id: str) -> ChainResult:
        """End assertion chain and compute result."""
        pass
```

### Assertion Categories

| Category              | Assertion Method               |
| --------------------- | ------------------------------ |
| `file_created`        | `assert_file_created()`        |
| `file_modified`       | `assert_file_modified()`       |
| `file_deleted`        | `assert_file_deleted()`        |
| `typescript_compiles` | `assert_typescript_compiles()` |
| `lint_passes`         | `assert_lint_passes()`         |
| `tests_pass`          | `assert_tests_pass()`          |
| `api_responds`        | `assert_api_responds()`        |
| `schema_valid`        | `assert_schema_valid()`        |
| `dependency_met`      | `assert_dependency_met()`      |

---

## Integration with Build Agent

```python
# In build_agent_worker.py

from shared.transcript_writer import TranscriptWriter
from shared.tool_use_logger import ToolUseLogger
from shared.skill_tracer import SkillTracer
from shared.assertion_recorder import AssertionRecorder

class BuildAgentWorker:
    def __init__(self, execution_id: str, instance_id: str):
        # Initialize observability
        self.transcript = TranscriptWriter(execution_id, instance_id)
        self.tool_logger = ToolUseLogger(self.transcript)
        self.skill_tracer = SkillTracer(self.transcript, self.tool_logger)
        self.assertions = AssertionRecorder(self.transcript, execution_id)

    def execute_task(self, task: Task):
        # Start task
        self.transcript.write(TranscriptEntry(
            entry_type='task_start',
            task_id=task.id,
            summary=f"Starting task: {task.title}"
        ))

        # Start assertion chain
        chain_id = self.assertions.start_chain(task.id, f"Validate {task.action}")

        try:
            # Execute task...

            # Run assertions
            if task.action == 'CREATE':
                self.assertions.assert_file_created(task.id, task.file)

            self.assertions.assert_typescript_compiles(task.id)
            self.assertions.assert_lint_passes(task.id, task.file)

        finally:
            # End assertion chain
            chain_result = self.assertions.end_chain(chain_id)

            # End task
            self.transcript.write(TranscriptEntry(
                entry_type='task_end',
                task_id=task.id,
                summary=f"Task completed: {chain_result.overall_result}"
            ))

    def handle_tool_use(self, tool_use_block):
        # Log tool start
        tool_id = self.tool_logger.log_start(tool_use_block)

        # Check security hooks
        if is_blocked(tool_use_block):
            self.tool_logger.log_blocked(tool_id, get_block_reason())
            return

        # Execute tool
        result = execute_tool(tool_use_block)

        # Log tool end
        self.tool_logger.log_end(tool_id, result)
```

---

## 5. ObservabilitySkills (Query Tools)

In addition to the data producers above, there is a companion class for **querying** observability data.

### Class Interface

```python
from shared.observability_skills import ObservabilitySkills

class ObservabilitySkills:
    """39 SQL tools for validation, troubleshooting, investigation, aggregation."""

    def __init__(self, db_path: str = "database/observability.db"):
        """Initialize with database path."""
        pass

    # Validation (V001-V007)
    def validate(self, execution_id: str) -> List[ValidationIssue]:
        """Run all validation checks on an execution."""
        pass

    # Troubleshooting (T001-T006)
    def find_errors(self, execution_id: str) -> List[ErrorRecord]:
        """Find all errors with root cause identification."""
        pass

    def find_blocked(self, execution_id: str) -> List[Dict]:
        """Find security-blocked commands."""
        pass

    def find_incomplete(self, execution_id: str) -> List[StuckOperation]:
        """Find operations that never completed."""
        pass

    # Parallel Execution (P001-P007)
    def parallel_health(self, execution_id: str) -> ParallelHealthReport:
        """Check health of parallel execution."""
        pass

    def find_wave_bottlenecks(self, execution_id: str) -> List[Dict]:
        """Find slowest tasks in each wave."""
        pass

    # Anomaly Detection (D001-D006)
    def detect_anomalies(self, execution_id: str) -> AnomalyReport:
        """Detect unusual patterns."""
        pass

    # Aggregation (A001-A006)
    def execution_summary(self, execution_id: str) -> Dict:
        """Get high-level execution metrics."""
        pass

    def tool_usage_stats(self, execution_id: str) -> List[Dict]:
        """Analyze tool usage patterns."""
        pass

    # Investigation (I001-I007)
    def trace_task(self, task_id: str) -> List[Dict]:
        """Get complete execution path for a task."""
        pass
```

### Usage Example

```python
from shared.observability_skills import ObservabilitySkills

skills = ObservabilitySkills("database/observability.db")

# After execution completes, validate data integrity
issues = skills.validate("exec-123")
if issues:
    print(f"Found {len(issues)} validation issues")
    for issue in issues:
        print(f"  [{issue.check_id}] {issue.description}")

# Check parallel execution health
health = skills.parallel_health("exec-123")
if not health.is_healthy:
    print(f"Parallel issues: {health.issues}")

# Find root cause of failure
errors = skills.find_errors("exec-123")
root_cause = next((e for e in errors if e.is_root_cause), None)
```

### Convenience Functions

```python
from shared.observability_skills import (
    obs_validate,
    obs_errors,
    obs_parallel_health,
    obs_anomalies,
    obs_summary
)

# Direct skill invocation
issues = obs_validate("exec-123")
errors = obs_errors("exec-123")
health = obs_parallel_health("exec-123")
anomalies = obs_anomalies("exec-123")
summary = obs_summary("exec-123")
```

---

## Related Documents

| Document                                                                   | Description                        |
| -------------------------------------------------------------------------- | ---------------------------------- |
| [Types (appendices/TYPES.md)](../appendices/TYPES.md)                      | TypeScript/Python type definitions |
| [SPEC.md §2-4](../SPEC.md#2-unified-transcript-schema)                     | Detailed logging specifications    |
| [BUILD-AGENT-APPENDIX-C-PYTHON.md](../../BUILD-AGENT-APPENDIX-C-PYTHON.md) | Python worker patterns             |
| [SQL Tools](../tools/OBSERVABILITY-SQL-TOOLS.md)                           | Full SQL tool documentation        |
| [Agent Skills](../tools/SKILLS.md)                                         | /obs-\* skill definitions          |

---

_Python implementation files: `coding-loops/shared/*.py`_
