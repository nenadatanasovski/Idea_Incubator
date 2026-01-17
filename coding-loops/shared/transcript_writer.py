"""
TranscriptWriter - Unified transcript writer for observability system.

Writes to both JSONL files and SQLite database.
"""

import json
import os
import sqlite3
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional

PROJECT_ROOT = Path(__file__).parent.parent.parent


class TranscriptEntryType(str, Enum):
    """Valid transcript entry types."""
    PHASE_START = "phase_start"
    PHASE_END = "phase_end"
    TASK_START = "task_start"
    TASK_END = "task_end"
    TOOL_USE = "tool_use"
    SKILL_INVOKE = "skill_invoke"
    SKILL_COMPLETE = "skill_complete"
    VALIDATION = "validation"
    ASSERTION = "assertion"
    DISCOVERY = "discovery"
    ERROR = "error"
    CHECKPOINT = "checkpoint"
    LOCK_ACQUIRE = "lock_acquire"
    LOCK_RELEASE = "lock_release"


class EntryCategory(str, Enum):
    """Valid entry categories."""
    LIFECYCLE = "lifecycle"
    ACTION = "action"
    VALIDATION = "validation"
    KNOWLEDGE = "knowledge"
    COORDINATION = "coordination"


class TranscriptWriter:
    """
    Unified transcript writer for observability.

    Writes transcript entries to both:
    1. JSONL file for persistence and debugging
    2. SQLite database for querying and aggregation

    Thread-safe with monotonically increasing sequence numbers per execution.
    """

    def __init__(
        self,
        execution_id: str,
        instance_id: str,
        wave_id: Optional[str] = None,
        wave_number: Optional[int] = None,
        db_path: Optional[Path] = None,
        source: str = "agent"
    ):
        """
        Initialize TranscriptWriter.

        Args:
            execution_id: Execution run ID
            instance_id: Build Agent instance ID
            wave_id: Optional wave ID for parallel execution
            wave_number: Optional wave number (1-indexed)
            db_path: Optional custom database path
            source: Event source (default: "agent")
        """
        self.execution_id = execution_id
        self.instance_id = instance_id
        self.wave_id = wave_id
        self.wave_number = wave_number
        self.db_path = db_path or PROJECT_ROOT / "database" / "ideas.db"
        self.source = source

        self._sequence = 0
        self._lock = threading.Lock()
        self._buffer: list = []
        self._local = threading.local()

        # Create transcript directory
        self._transcript_dir = PROJECT_ROOT / "coding-loops" / "transcripts" / execution_id
        self._transcript_dir.mkdir(parents=True, exist_ok=True)
        self._jsonl_path = self._transcript_dir / "unified.jsonl"

    def _get_connection(self) -> sqlite3.Connection:
        """Get thread-local database connection."""
        if not hasattr(self._local, 'conn') or self._local.conn is None:
            self._local.conn = sqlite3.connect(str(self.db_path), timeout=30.0)
            self._local.conn.execute("PRAGMA foreign_keys = ON")
        return self._local.conn

    def write(self, entry: Dict[str, Any]) -> str:
        """
        Write a transcript entry.

        Args:
            entry: Entry dict with at minimum entry_type, category, and summary

        Returns:
            Generated entry ID
        """
        with self._lock:
            self._sequence += 1
            seq = self._sequence

        entry_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"

        full_entry = {
            "id": entry_id,
            "timestamp": timestamp,
            "sequence": seq,
            "source": self.source,
            "execution_id": self.execution_id,
            "instance_id": self.instance_id,
            **entry
        }

        if self.wave_id:
            full_entry["wave_id"] = self.wave_id
        if self.wave_number:
            full_entry["wave_number"] = self.wave_number

        self._buffer.append(full_entry)

        # Auto-flush if buffer grows large
        if len(self._buffer) >= 10:
            self.flush()

        return entry_id

    def write_phase_start(self, phase_name: str, details: Optional[Dict] = None) -> str:
        """Write a phase_start entry."""
        return self.write({
            "entry_type": TranscriptEntryType.PHASE_START.value,
            "category": EntryCategory.LIFECYCLE.value,
            "summary": f"Phase started: {phase_name}",
            "details": json.dumps(details or {"phase": phase_name})
        })

    def write_phase_end(self, phase_name: str, duration_ms: Optional[int] = None, details: Optional[Dict] = None) -> str:
        """Write a phase_end entry."""
        return self.write({
            "entry_type": TranscriptEntryType.PHASE_END.value,
            "category": EntryCategory.LIFECYCLE.value,
            "summary": f"Phase completed: {phase_name}",
            "duration_ms": duration_ms,
            "details": json.dumps(details or {"phase": phase_name})
        })

    def write_task_start(self, task_id: str, task_title: str, details: Optional[Dict] = None) -> str:
        """Write a task_start entry."""
        return self.write({
            "entry_type": TranscriptEntryType.TASK_START.value,
            "category": EntryCategory.LIFECYCLE.value,
            "task_id": task_id,
            "summary": f"Task started: {task_title[:100]}",
            "details": json.dumps(details or {"task_id": task_id, "title": task_title})
        })

    def write_task_end(self, task_id: str, status: str, duration_ms: Optional[int] = None, details: Optional[Dict] = None) -> str:
        """Write a task_end entry."""
        return self.write({
            "entry_type": TranscriptEntryType.TASK_END.value,
            "category": EntryCategory.LIFECYCLE.value,
            "task_id": task_id,
            "summary": f"Task completed with status: {status}",
            "duration_ms": duration_ms,
            "details": json.dumps(details or {"task_id": task_id, "status": status})
        })

    def write_error(self, message: str, task_id: Optional[str] = None, details: Optional[Dict] = None) -> str:
        """Write an error entry."""
        return self.write({
            "entry_type": TranscriptEntryType.ERROR.value,
            "category": EntryCategory.LIFECYCLE.value,
            "task_id": task_id,
            "summary": f"Error: {message[:180]}",
            "details": json.dumps(details or {"error": message})
        })

    def write_discovery(self, discovery_type: str, content: str, task_id: Optional[str] = None, details: Optional[Dict] = None) -> str:
        """Write a discovery entry (gotcha, pattern, etc.)."""
        return self.write({
            "entry_type": TranscriptEntryType.DISCOVERY.value,
            "category": EntryCategory.KNOWLEDGE.value,
            "task_id": task_id,
            "summary": f"Discovery ({discovery_type}): {content[:150]}",
            "details": json.dumps(details or {"type": discovery_type, "content": content})
        })

    def write_checkpoint(self, checkpoint_id: str, task_id: Optional[str] = None, details: Optional[Dict] = None) -> str:
        """Write a checkpoint entry."""
        return self.write({
            "entry_type": TranscriptEntryType.CHECKPOINT.value,
            "category": EntryCategory.LIFECYCLE.value,
            "task_id": task_id,
            "summary": f"Checkpoint created: {checkpoint_id}",
            "details": json.dumps(details or {"checkpoint_id": checkpoint_id})
        })

    def flush(self) -> None:
        """Flush buffered entries to disk and database."""
        with self._lock:
            entries_to_write = self._buffer[:]
            self._buffer.clear()

        if not entries_to_write:
            return

        # Write to JSONL
        with open(self._jsonl_path, "a") as f:
            for entry in entries_to_write:
                f.write(json.dumps(entry) + "\n")

        # Write to SQLite
        conn = self._get_connection()
        for entry in entries_to_write:
            try:
                conn.execute("""
                    INSERT INTO transcript_entries (
                        id, timestamp, sequence, source, execution_id, instance_id,
                        task_id, wave_id, wave_number, entry_type, category,
                        summary, details, duration_ms
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    entry["id"],
                    entry["timestamp"],
                    entry["sequence"],
                    entry.get("source", "agent"),
                    entry["execution_id"],
                    entry["instance_id"],
                    entry.get("task_id"),
                    entry.get("wave_id"),
                    entry.get("wave_number"),
                    entry["entry_type"],
                    entry["category"],
                    entry["summary"],
                    entry.get("details", "{}"),
                    entry.get("duration_ms")
                ))
            except sqlite3.Error as e:
                # Log but don't fail on DB errors
                print(f"Warning: Failed to write transcript entry to DB: {e}")
        conn.commit()

    def get_sequence(self) -> int:
        """Get current sequence number."""
        with self._lock:
            return self._sequence

    def close(self) -> None:
        """Flush and close all resources."""
        self.flush()
        if hasattr(self._local, 'conn') and self._local.conn:
            self._local.conn.close()
            self._local.conn = None


# Convenience function for testing
def create_test_transcript_writer() -> TranscriptWriter:
    """Create a TranscriptWriter for testing."""
    import tempfile
    test_exec_id = f"test-{uuid.uuid4().hex[:8]}"
    test_instance_id = f"test-instance-{uuid.uuid4().hex[:8]}"
    return TranscriptWriter(test_exec_id, test_instance_id)
