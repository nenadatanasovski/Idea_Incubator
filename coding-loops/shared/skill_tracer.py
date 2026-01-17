"""
SkillTracer - Traces skill invocations with file:line references.
"""

import json
import sqlite3
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .transcript_writer import TranscriptWriter
from .tool_use_logger import ToolUseLogger

PROJECT_ROOT = Path(__file__).parent.parent.parent


@dataclass
class SkillReference:
    """Reference to a skill definition."""
    skill_name: str
    skill_file: str
    line_number: int
    section_title: str


@dataclass
class PendingTrace:
    """Tracks a skill trace in progress."""
    id: str
    skill_ref: SkillReference
    start_time: float
    tool_calls: List[str]
    task_id: Optional[str] = None


class SkillTracer:
    """
    Traces skill invocations with file:line references.

    Links tool calls to skill traces and records comprehensive
    execution metadata for observability.
    """

    def __init__(
        self,
        transcript_writer: TranscriptWriter,
        tool_logger: ToolUseLogger,
        db_path: Optional[Path] = None
    ):
        """
        Initialize SkillTracer.

        Args:
            transcript_writer: TranscriptWriter instance
            tool_logger: ToolUseLogger instance for linking tool calls
            db_path: Optional custom database path
        """
        self.transcript = transcript_writer
        self.tool_logger = tool_logger
        self.db_path = db_path or PROJECT_ROOT / "database" / "ideas.db"

        self._pending: Dict[str, PendingTrace] = {}

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def trace_start(
        self,
        skill_ref: SkillReference,
        task_id: Optional[str] = None
    ) -> str:
        """
        Start tracing a skill invocation.

        Args:
            skill_ref: Reference to the skill being invoked
            task_id: Optional task ID context

        Returns:
            trace_id
        """
        trace_id = str(uuid.uuid4())

        # Write transcript entry
        self.transcript.write({
            "entry_type": "skill_invoke",
            "category": "action",
            "task_id": task_id,
            "summary": f"Skill: {skill_ref.skill_name}",
            "details": json.dumps({
                "skill_name": skill_ref.skill_name,
                "skill_file": skill_ref.skill_file,
                "line_number": skill_ref.line_number,
                "section_title": skill_ref.section_title
            })
        })

        # Store pending trace
        self._pending[trace_id] = PendingTrace(
            id=trace_id,
            skill_ref=skill_ref,
            start_time=time.time(),
            tool_calls=[],
            task_id=task_id
        )

        # Insert initial row
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT INTO skill_traces (
                    id, execution_id, task_id, skill_name,
                    skill_file, line_number, section_title,
                    status, start_time, wave_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                trace_id,
                self.transcript.execution_id,
                task_id,
                skill_ref.skill_name,
                skill_ref.skill_file,
                skill_ref.line_number,
                skill_ref.section_title,
                "running",
                datetime.utcnow().isoformat() + "Z",
                self.transcript.wave_id
            ))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Warning: Failed to start skill trace in DB: {e}")
        finally:
            conn.close()

        return trace_id

    def add_tool_call(self, trace_id: str, tool_use_id: str) -> None:
        """
        Associate a tool use with this skill trace.

        Args:
            trace_id: ID of the skill trace
            tool_use_id: ID of the tool use to link
        """
        pending = self._pending.get(trace_id)
        if not pending:
            return

        pending.tool_calls.append(tool_use_id)

        # Update tool_uses.within_skill
        conn = self._get_connection()
        try:
            conn.execute("""
                UPDATE tool_uses SET within_skill = ? WHERE id = ?
            """, (trace_id, tool_use_id))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Warning: Failed to link tool call to skill: {e}")
        finally:
            conn.close()

    def trace_end(
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
        pending = self._pending.pop(trace_id, None)
        if not pending:
            return

        end_time = time.time()
        duration_ms = int((end_time - pending.start_time) * 1000)

        # Write transcript entry
        self.transcript.write({
            "entry_type": "skill_complete",
            "category": "action",
            "task_id": pending.task_id,
            "summary": f"Skill completed: {pending.skill_ref.skill_name} ({status})",
            "duration_ms": duration_ms,
            "details": json.dumps({
                "skill_name": pending.skill_ref.skill_name,
                "status": status,
                "error": error,
                "tool_call_count": len(pending.tool_calls)
            })
        })

        # Update skill trace
        conn = self._get_connection()
        try:
            conn.execute("""
                UPDATE skill_traces SET
                    status = ?,
                    error_message = ?,
                    output_summary = ?,
                    tool_calls = ?,
                    end_time = ?,
                    duration_ms = ?
                WHERE id = ?
            """, (
                status,
                error,
                output_summary[:500] if output_summary else None,
                json.dumps(pending.tool_calls),
                datetime.utcnow().isoformat() + "Z",
                duration_ms,
                trace_id
            ))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Warning: Failed to end skill trace in DB: {e}")
        finally:
            conn.close()

    def create_skill_ref(
        self,
        skill_name: str,
        skill_file: str,
        line_number: int = 0,
        section_title: str = ""
    ) -> SkillReference:
        """
        Create a SkillReference.

        Convenience method for creating skill references.

        Args:
            skill_name: Name of the skill
            skill_file: Path to the skill file
            line_number: Line number in the file
            section_title: Section heading

        Returns:
            SkillReference instance
        """
        return SkillReference(
            skill_name=skill_name,
            skill_file=skill_file,
            line_number=line_number,
            section_title=section_title
        )

    def trace_simple(
        self,
        skill_name: str,
        skill_file: str,
        status: str = "success",
        task_id: Optional[str] = None,
        line_number: int = 0,
        section_title: str = "",
        error: Optional[str] = None
    ) -> str:
        """
        Record a complete skill trace in one call.

        Convenience method for when you have all information at once.

        Args:
            skill_name: Name of the skill
            skill_file: Path to the skill file
            status: Final status
            task_id: Optional task ID context
            line_number: Line number in the file
            section_title: Section heading
            error: Error message if failed

        Returns:
            trace_id
        """
        skill_ref = self.create_skill_ref(
            skill_name, skill_file, line_number, section_title
        )
        trace_id = self.trace_start(skill_ref, task_id)
        self.trace_end(trace_id, status, error)
        return trace_id
