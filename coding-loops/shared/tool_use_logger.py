"""
ToolUseLogger - Logs tool invocations with timing and results.
"""

import json
import sqlite3
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional

from .transcript_writer import TranscriptWriter

PROJECT_ROOT = Path(__file__).parent.parent.parent


class ToolCategory(str, Enum):
    """Tool categories for classification."""
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    SHELL = "shell"
    BROWSER = "browser"
    NETWORK = "network"
    AGENT = "agent"
    CUSTOM = "custom"


# Map tool names to categories
TOOL_CATEGORY_MAP = {
    "Read": ToolCategory.FILE_READ,
    "Glob": ToolCategory.FILE_READ,
    "Grep": ToolCategory.FILE_READ,
    "LS": ToolCategory.FILE_READ,
    "Write": ToolCategory.FILE_WRITE,
    "Edit": ToolCategory.FILE_WRITE,
    "NotebookEdit": ToolCategory.FILE_WRITE,
    "Bash": ToolCategory.SHELL,
    "WebFetch": ToolCategory.BROWSER,
    "WebSearch": ToolCategory.BROWSER,
    "Task": ToolCategory.AGENT,
}


@dataclass
class PendingToolUse:
    """Tracks a tool use in progress."""
    id: str
    tool: str
    tool_category: str
    input: Dict[str, Any]
    input_summary: str
    transcript_entry_id: str
    start_time: float
    task_id: Optional[str] = None


class ToolUseLogger:
    """
    Logs tool invocations with timing and results.

    Tracks tool starts and ends, calculates duration, and records
    to both transcript and tool_uses table.
    """

    def __init__(
        self,
        transcript_writer: TranscriptWriter,
        db_path: Optional[Path] = None
    ):
        """
        Initialize ToolUseLogger.

        Args:
            transcript_writer: TranscriptWriter instance for transcript entries
            db_path: Optional custom database path
        """
        self.transcript = transcript_writer
        self.db_path = db_path or PROJECT_ROOT / "database" / "ideas.db"
        self._pending: Dict[str, PendingToolUse] = {}

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _categorize_tool(self, tool_name: str) -> str:
        """Get tool category from tool name."""
        return TOOL_CATEGORY_MAP.get(tool_name, ToolCategory.CUSTOM).value

    def _summarize(self, data: Any, max_length: int = 500) -> str:
        """Create a summary of data, truncating if needed."""
        if data is None:
            return ""
        if isinstance(data, dict):
            s = json.dumps(data)
        else:
            s = str(data)
        if len(s) > max_length:
            return s[:max_length - 3] + "..."
        return s

    def log_start(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        task_id: Optional[str] = None
    ) -> str:
        """
        Log start of tool invocation.

        Args:
            tool_name: Name of the tool (Read, Write, Bash, etc.)
            tool_input: Tool input parameters
            task_id: Optional task ID context

        Returns:
            tool_use_id for completing the log later
        """
        tool_id = str(uuid.uuid4())
        tool_category = self._categorize_tool(tool_name)
        input_summary = self._summarize(tool_input)

        # Write transcript entry
        transcript_id = self.transcript.write({
            "entry_type": "tool_use",
            "category": "action",
            "task_id": task_id,
            "summary": f"Tool: {tool_name}",
            "details": json.dumps({
                "tool": tool_name,
                "input_summary": input_summary[:200]
            })
        })

        # Flush to ensure transcript_entry exists before FK reference
        self.transcript.flush()

        # Store pending for later completion
        self._pending[tool_id] = PendingToolUse(
            id=tool_id,
            tool=tool_name,
            tool_category=tool_category,
            input=tool_input if isinstance(tool_input, dict) else {},
            input_summary=input_summary,
            transcript_entry_id=transcript_id,
            start_time=time.time(),
            task_id=task_id
        )

        # Insert initial row with pending status
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT INTO tool_uses (
                    id, execution_id, task_id, transcript_entry_id,
                    tool, tool_category, input, input_summary,
                    result_status, output_summary, start_time, end_time,
                    duration_ms, wave_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tool_id,
                self.transcript.execution_id,
                task_id,
                transcript_id,
                tool_name,
                tool_category,
                json.dumps(tool_input if isinstance(tool_input, dict) else {}),
                input_summary[:200],
                "pending",
                "",  # output_summary placeholder
                datetime.utcnow().isoformat() + "Z",
                datetime.utcnow().isoformat() + "Z",  # end_time placeholder
                0,  # duration_ms placeholder
                self.transcript.wave_id
            ))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Warning: Failed to log tool start to DB: {e}")
        finally:
            conn.close()

        return tool_id

    def log_end(
        self,
        tool_use_id: str,
        output: Any,
        is_error: bool = False,
        error_message: Optional[str] = None
    ) -> None:
        """
        Log completion of tool invocation.

        Args:
            tool_use_id: ID returned from log_start
            output: Tool output/result
            is_error: Whether the tool failed
            error_message: Error message if failed
        """
        pending = self._pending.pop(tool_use_id, None)
        if not pending:
            return

        end_time = time.time()
        duration_ms = int((end_time - pending.start_time) * 1000)

        output_summary = self._summarize(output)
        status = "error" if is_error else "done"

        conn = self._get_connection()
        try:
            conn.execute("""
                UPDATE tool_uses SET
                    result_status = ?,
                    output = ?,
                    output_summary = ?,
                    is_error = ?,
                    error_message = ?,
                    end_time = ?,
                    duration_ms = ?
                WHERE id = ?
            """, (
                status,
                json.dumps(output) if not isinstance(output, str) else output,
                output_summary[:500],
                1 if is_error else 0,
                error_message,
                datetime.utcnow().isoformat() + "Z",
                duration_ms,
                tool_use_id
            ))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Warning: Failed to log tool end to DB: {e}")
        finally:
            conn.close()

    def log_blocked(self, tool_use_id: str, reason: str) -> None:
        """
        Log security-blocked tool invocation.

        Args:
            tool_use_id: ID returned from log_start
            reason: Why the command was blocked
        """
        pending = self._pending.pop(tool_use_id, None)
        if not pending:
            return

        end_time = time.time()
        duration_ms = int((end_time - pending.start_time) * 1000)

        conn = self._get_connection()
        try:
            conn.execute("""
                UPDATE tool_uses SET
                    result_status = ?,
                    is_blocked = ?,
                    block_reason = ?,
                    end_time = ?,
                    duration_ms = ?
                WHERE id = ?
            """, (
                "blocked",
                1,
                reason,
                datetime.utcnow().isoformat() + "Z",
                duration_ms,
                tool_use_id
            ))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Warning: Failed to log blocked tool to DB: {e}")
        finally:
            conn.close()

    def log_simple(
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

        Convenience method for when you have all information at once.

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
        tool_id = self.log_start(tool_name, tool_input, task_id)
        self.log_end(tool_id, output, is_error, error_message)
        return tool_id
