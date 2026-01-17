"""
ObservableAgent - Base class for all observable agents.

Provides unified observability infrastructure for any agent
by composing TranscriptWriter, ToolUseLogger, SkillTracer, and AssertionRecorder.

OBS-100: Phase 3 Agent Integration
"""

import time
import traceback
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from .transcript_writer import TranscriptWriter
from .tool_use_logger import ToolUseLogger
from .skill_tracer import SkillTracer, SkillReference
from .assertion_recorder import AssertionRecorder, AssertionEvidence

PROJECT_ROOT = Path(__file__).parent.parent.parent


class ObservableAgent:
    """
    Base class for observable agents.

    Composes all observability infrastructure and provides
    a unified interface for logging lifecycle events, tool uses,
    assertions, and discoveries.

    Usage:
        class MyAgent(ObservableAgent):
            def __init__(self, execution_id: str, instance_id: str):
                super().__init__(execution_id, instance_id, agent_type="my-agent")

            def run(self, task_id: str):
                self.log_task_start(task_id, "My task")
                try:
                    # Do work...
                    self.log_task_end(task_id, "complete")
                except Exception as e:
                    self.log_error(str(e), task_id)
                    raise
                finally:
                    self.close()
    """

    def __init__(
        self,
        execution_id: str,
        instance_id: str,
        agent_type: str = "agent",
        wave_id: Optional[str] = None,
        wave_number: Optional[int] = None,
        db_path: Optional[Path] = None
    ):
        """
        Initialize ObservableAgent.

        Args:
            execution_id: Execution run ID
            instance_id: Agent instance ID
            agent_type: Type of agent (build, spec, validation, etc.)
            wave_id: Optional wave ID for parallel execution
            wave_number: Optional wave number (1-indexed)
            db_path: Optional custom database path
        """
        self.execution_id = execution_id
        self.instance_id = instance_id
        self.agent_type = agent_type
        self.wave_id = wave_id
        self.wave_number = wave_number
        self.db_path = db_path or PROJECT_ROOT / "database" / "ideas.db"

        # Initialize observability infrastructure
        self._transcript = TranscriptWriter(
            execution_id=execution_id,
            instance_id=instance_id,
            wave_id=wave_id,
            wave_number=wave_number,
            db_path=self.db_path,
            source="agent"
        )

        self._tool_logger = ToolUseLogger(
            transcript_writer=self._transcript,
            db_path=self.db_path
        )

        self._skill_tracer = SkillTracer(
            transcript_writer=self._transcript,
            tool_logger=self._tool_logger,
            db_path=self.db_path
        )

        self._assertion_recorder = AssertionRecorder(
            transcript_writer=self._transcript,
            execution_id=execution_id,
            db_path=self.db_path
        )

        # Track timing for phases
        self._phase_start_times: Dict[str, float] = {}
        self._task_start_times: Dict[str, float] = {}
        self._current_task_id: Optional[str] = None

    # =========================================================================
    # Lifecycle Logging
    # =========================================================================

    def log_phase_start(self, phase_name: str, details: Optional[Dict] = None) -> str:
        """
        Log start of a phase.

        Args:
            phase_name: Name of the phase (e.g., "prime", "execute", "validate")
            details: Optional additional details

        Returns:
            entry_id for cross-referencing
        """
        self._phase_start_times[phase_name] = time.time()
        return self._transcript.write_phase_start(phase_name, {
            "agent_type": self.agent_type,
            **(details or {})
        })

    def log_phase_end(self, phase_name: str, details: Optional[Dict] = None) -> str:
        """
        Log end of a phase.

        Args:
            phase_name: Name of the phase
            details: Optional additional details

        Returns:
            entry_id for cross-referencing
        """
        start_time = self._phase_start_times.pop(phase_name, None)
        duration_ms = None
        if start_time:
            duration_ms = int((time.time() - start_time) * 1000)

        return self._transcript.write_phase_end(phase_name, duration_ms, {
            "agent_type": self.agent_type,
            **(details or {})
        })

    def log_task_start(self, task_id: str, task_title: str, details: Optional[Dict] = None) -> str:
        """
        Log start of a task.

        Args:
            task_id: Task ID
            task_title: Task title/description
            details: Optional additional details

        Returns:
            entry_id for cross-referencing
        """
        self._task_start_times[task_id] = time.time()
        self._current_task_id = task_id
        return self._transcript.write_task_start(task_id, task_title, details)

    def log_task_end(self, task_id: str, status: str, details: Optional[Dict] = None) -> str:
        """
        Log end of a task.

        Args:
            task_id: Task ID
            status: Final status (complete, failed, skipped)
            details: Optional additional details

        Returns:
            entry_id for cross-referencing
        """
        start_time = self._task_start_times.pop(task_id, None)
        duration_ms = None
        if start_time:
            duration_ms = int((time.time() - start_time) * 1000)

        if self._current_task_id == task_id:
            self._current_task_id = None

        return self._transcript.write_task_end(task_id, status, duration_ms, details)

    # =========================================================================
    # Tool Logging
    # =========================================================================

    def log_tool_start(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        task_id: Optional[str] = None
    ) -> str:
        """
        Log start of a tool invocation.

        Args:
            tool_name: Name of the tool (Read, Write, Bash, etc.)
            tool_input: Tool input parameters
            task_id: Optional task ID context

        Returns:
            tool_use_id for completing the log later
        """
        return self._tool_logger.log_start(
            tool_name,
            tool_input,
            task_id or self._current_task_id
        )

    def log_tool_end(
        self,
        tool_use_id: str,
        output: Any,
        is_error: bool = False,
        error_message: Optional[str] = None
    ) -> None:
        """
        Log completion of a tool invocation.

        Args:
            tool_use_id: ID returned from log_tool_start
            output: Tool output/result
            is_error: Whether the tool failed
            error_message: Error message if failed
        """
        self._tool_logger.log_end(tool_use_id, output, is_error, error_message)

    def log_tool_blocked(self, tool_use_id: str, reason: str) -> None:
        """
        Log security-blocked tool invocation.

        Args:
            tool_use_id: ID returned from log_tool_start
            reason: Why the command was blocked
        """
        self._tool_logger.log_blocked(tool_use_id, reason)

    def log_tool_simple(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        output: Any,
        task_id: Optional[str] = None,
        is_error: bool = False,
        error_message: Optional[str] = None
    ) -> str:
        """
        Log a complete tool invocation in one call.

        Args:
            tool_name: Name of the tool
            tool_input: Tool input parameters
            output: Tool output/result
            task_id: Optional task ID context
            is_error: Whether the tool failed
            error_message: Error message if failed

        Returns:
            tool_use_id
        """
        return self._tool_logger.log_simple(
            tool_name, tool_input, output,
            task_id or self._current_task_id,
            is_error, error_message
        )

    # =========================================================================
    # Skill Tracing
    # =========================================================================

    def log_skill_start(
        self,
        skill_name: str,
        skill_file: str,
        line_number: int = 0,
        section_title: str = "",
        task_id: Optional[str] = None
    ) -> str:
        """
        Start tracing a skill invocation.

        Args:
            skill_name: Name of the skill
            skill_file: Path to the skill file
            line_number: Line number in the file
            section_title: Section heading
            task_id: Optional task ID context

        Returns:
            trace_id
        """
        skill_ref = SkillReference(
            skill_name=skill_name,
            skill_file=skill_file,
            line_number=line_number,
            section_title=section_title
        )
        return self._skill_tracer.trace_start(skill_ref, task_id or self._current_task_id)

    def log_skill_end(
        self,
        trace_id: str,
        status: str,
        error: Optional[str] = None,
        output_summary: Optional[str] = None
    ) -> None:
        """
        End skill trace.

        Args:
            trace_id: ID of the trace to end
            status: Final status (success, partial, failed)
            error: Error message if failed
            output_summary: Summary of skill output
        """
        self._skill_tracer.trace_end(trace_id, status, error, output_summary)

    def add_tool_to_skill(self, trace_id: str, tool_use_id: str) -> None:
        """
        Associate a tool use with a skill trace.

        Args:
            trace_id: ID of the skill trace
            tool_use_id: ID of the tool use to link
        """
        self._skill_tracer.add_tool_call(trace_id, tool_use_id)

    # =========================================================================
    # Assertion Recording
    # =========================================================================

    def start_assertion_chain(self, task_id: str, description: str) -> str:
        """
        Start an assertion chain for validation.

        Args:
            task_id: Task being validated
            description: What this chain validates

        Returns:
            chain_id
        """
        return self._assertion_recorder.start_chain(
            task_id or self._current_task_id,
            description
        )

    def end_assertion_chain(self, chain_id: str):
        """
        End assertion chain and get results.

        Args:
            chain_id: Chain to complete

        Returns:
            ChainResult with counts and overall status
        """
        return self._assertion_recorder.end_chain(chain_id)

    def assert_file_created(self, task_id: str, file_path: str) -> str:
        """Assert a file was created."""
        return self._assertion_recorder.assert_file_created(
            task_id or self._current_task_id,
            file_path
        )

    def assert_file_modified(self, task_id: str, file_path: str) -> str:
        """Assert a file was modified."""
        return self._assertion_recorder.assert_file_modified(
            task_id or self._current_task_id,
            file_path
        )

    def assert_file_deleted(self, task_id: str, file_path: str) -> str:
        """Assert a file was deleted."""
        return self._assertion_recorder.assert_file_deleted(
            task_id or self._current_task_id,
            file_path
        )

    def assert_typescript_compiles(self, task_id: Optional[str] = None) -> str:
        """Assert TypeScript compilation passes."""
        return self._assertion_recorder.assert_typescript_compiles(
            task_id or self._current_task_id
        )

    def assert_lint_passes(self, task_id: Optional[str] = None) -> str:
        """Assert linting passes."""
        return self._assertion_recorder.assert_lint_passes(
            task_id or self._current_task_id
        )

    def assert_tests_pass(self, task_id: Optional[str] = None, pattern: str = "") -> str:
        """Assert tests pass."""
        return self._assertion_recorder.assert_tests_pass(
            task_id or self._current_task_id,
            pattern
        )

    def assert_custom(
        self,
        task_id: str,
        category: str,
        description: str,
        command: str,
        timeout: int = 60
    ) -> str:
        """Run a custom assertion via command."""
        return self._assertion_recorder.assert_custom(
            task_id or self._current_task_id,
            category,
            description,
            command,
            timeout
        )

    def assert_manual(
        self,
        task_id: str,
        category: str,
        description: str,
        passed: bool,
        evidence_details: Optional[Dict] = None
    ) -> str:
        """Record a manual assertion result."""
        return self._assertion_recorder.assert_manual(
            task_id or self._current_task_id,
            category,
            description,
            passed,
            evidence_details
        )

    # =========================================================================
    # Error Logging
    # =========================================================================

    def log_error(
        self,
        message: str,
        task_id: Optional[str] = None,
        include_traceback: bool = True,
        details: Optional[Dict] = None
    ) -> str:
        """
        Log an error with optional stack trace.

        Args:
            message: Error message
            task_id: Optional task ID context
            include_traceback: Whether to include stack trace
            details: Optional additional details

        Returns:
            entry_id for cross-referencing
        """
        error_details = details or {}
        if include_traceback:
            error_details["traceback"] = traceback.format_exc()
        error_details["agent_type"] = self.agent_type

        return self._transcript.write_error(
            message,
            task_id or self._current_task_id,
            error_details
        )

    # =========================================================================
    # Discovery Logging (for SIA-type agents)
    # =========================================================================

    def log_discovery(
        self,
        discovery_type: str,
        content: str,
        confidence: float = 0.5,
        task_id: Optional[str] = None,
        details: Optional[Dict] = None
    ) -> str:
        """
        Log a discovery (gotcha, pattern, decision).

        Args:
            discovery_type: Type of discovery (gotcha, pattern, decision)
            content: Discovery content
            confidence: Confidence score (0.0-1.0)
            task_id: Optional task ID context
            details: Optional additional details

        Returns:
            entry_id for cross-referencing
        """
        discovery_details = {
            "type": discovery_type,
            "confidence": max(0.0, min(1.0, confidence)),
            "agent_type": self.agent_type,
            **(details or {})
        }
        return self._transcript.write_discovery(
            discovery_type,
            content,
            task_id or self._current_task_id,
            discovery_details
        )

    # =========================================================================
    # Coordination Logging
    # =========================================================================

    def log_lock_acquire(
        self,
        resource: str,
        lock_type: str = "exclusive",
        task_id: Optional[str] = None
    ) -> str:
        """
        Log file/resource lock acquisition.

        Args:
            resource: Resource being locked (usually file path)
            lock_type: Type of lock (exclusive, shared)
            task_id: Optional task ID context

        Returns:
            entry_id for cross-referencing
        """
        return self._transcript.write({
            "entry_type": "lock_acquire",
            "category": "coordination",
            "task_id": task_id or self._current_task_id,
            "summary": f"Lock acquired: {resource}",
            "details": {
                "resource": resource,
                "lock_type": lock_type,
                "agent_type": self.agent_type
            }
        })

    def log_lock_release(
        self,
        resource: str,
        task_id: Optional[str] = None
    ) -> str:
        """
        Log file/resource lock release.

        Args:
            resource: Resource being unlocked
            task_id: Optional task ID context

        Returns:
            entry_id for cross-referencing
        """
        return self._transcript.write({
            "entry_type": "lock_release",
            "category": "coordination",
            "task_id": task_id or self._current_task_id,
            "summary": f"Lock released: {resource}",
            "details": {
                "resource": resource,
                "agent_type": self.agent_type
            }
        })

    def log_checkpoint(
        self,
        checkpoint_id: str,
        task_id: Optional[str] = None,
        details: Optional[Dict] = None
    ) -> str:
        """
        Log checkpoint creation.

        Args:
            checkpoint_id: ID of the checkpoint
            task_id: Optional task ID context
            details: Optional additional details

        Returns:
            entry_id for cross-referencing
        """
        return self._transcript.write_checkpoint(
            checkpoint_id,
            task_id or self._current_task_id,
            {
                "agent_type": self.agent_type,
                **(details or {})
            }
        )

    # =========================================================================
    # Cleanup
    # =========================================================================

    def flush(self) -> None:
        """Flush all pending writes."""
        self._transcript.flush()

    def close(self) -> None:
        """Flush and close all resources."""
        self._transcript.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - ensures cleanup."""
        if exc_type is not None:
            self.log_error(str(exc_val), include_traceback=True)
        self.close()
        return False  # Don't suppress exceptions
