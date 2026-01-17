"""
AssertionRecorder - Records test assertions with evidence linking.
"""

import json
import os
import sqlite3
import subprocess
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from .transcript_writer import TranscriptWriter

PROJECT_ROOT = Path(__file__).parent.parent.parent


class AssertionCategory(str, Enum):
    """Built-in assertion categories."""
    FILE_CREATED = "file_created"
    FILE_MODIFIED = "file_modified"
    FILE_DELETED = "file_deleted"
    TYPESCRIPT_COMPILES = "typescript_compiles"
    LINT_PASSES = "lint_passes"
    TESTS_PASS = "tests_pass"
    API_RESPONDS = "api_responds"
    SCHEMA_VALID = "schema_valid"
    DEPENDENCY_MET = "dependency_met"
    CUSTOM = "custom"


class AssertionResult(str, Enum):
    """Assertion result statuses."""
    PASS = "pass"
    FAIL = "fail"
    SKIP = "skip"
    WARN = "warn"


@dataclass
class AssertionEvidence:
    """Evidence collected for an assertion."""
    command: Optional[str] = None
    exit_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    file_path: Optional[str] = None
    file_exists: Optional[bool] = None
    error_message: Optional[str] = None


@dataclass
class ChainResult:
    """Result of an assertion chain."""
    overall_result: str
    pass_count: int
    fail_count: int
    first_failure_id: Optional[str]


class AssertionRecorder:
    """
    Records test assertions with evidence linking.

    Supports assertion chains that group related assertions,
    tracking pass/fail counts and computing overall results.
    """

    def __init__(
        self,
        transcript_writer: TranscriptWriter,
        execution_id: str,
        db_path: Optional[Path] = None
    ):
        """
        Initialize AssertionRecorder.

        Args:
            transcript_writer: TranscriptWriter instance
            execution_id: Execution run ID
            db_path: Optional custom database path
        """
        self.transcript = transcript_writer
        self.execution_id = execution_id
        self.db_path = db_path or PROJECT_ROOT / "database" / "ideas.db"

        self._current_chain_id: Optional[str] = None
        self._chain_pass_count: int = 0
        self._chain_fail_count: int = 0
        self._first_failure_id: Optional[str] = None
        self._chain_position: int = 0

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def start_chain(self, task_id: str, description: str) -> str:
        """
        Start an assertion chain.

        Args:
            task_id: Task being validated
            description: What this chain validates

        Returns:
            chain_id
        """
        chain_id = str(uuid.uuid4())
        self._current_chain_id = chain_id
        self._chain_pass_count = 0
        self._chain_fail_count = 0
        self._first_failure_id = None
        self._chain_position = 0

        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT INTO assertion_chains (
                    id, task_id, execution_id, description,
                    overall_result, pass_count, fail_count,
                    started_at, wave_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                chain_id,
                task_id,
                self.execution_id,
                description,
                "pending",
                0,
                0,
                datetime.utcnow().isoformat() + "Z",
                self.transcript.wave_id
            ))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Warning: Failed to start assertion chain in DB: {e}")
        finally:
            conn.close()

        return chain_id

    def end_chain(self, chain_id: str) -> ChainResult:
        """
        End chain and compute overall result.

        Args:
            chain_id: Chain to complete

        Returns:
            ChainResult with counts and overall status
        """
        if self._chain_fail_count > 0:
            overall = "fail"
        elif self._chain_pass_count > 0:
            overall = "pass"
        else:
            overall = "skip"

        conn = self._get_connection()
        try:
            conn.execute("""
                UPDATE assertion_chains SET
                    overall_result = ?,
                    pass_count = ?,
                    fail_count = ?,
                    first_failure_id = ?,
                    completed_at = ?
                WHERE id = ?
            """, (
                overall,
                self._chain_pass_count,
                self._chain_fail_count,
                self._first_failure_id,
                datetime.utcnow().isoformat() + "Z",
                chain_id
            ))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Warning: Failed to end assertion chain in DB: {e}")
        finally:
            conn.close()

        result = ChainResult(
            overall_result=overall,
            pass_count=self._chain_pass_count,
            fail_count=self._chain_fail_count,
            first_failure_id=self._first_failure_id
        )

        self._current_chain_id = None
        return result

    def _record_assertion(
        self,
        task_id: str,
        category: str,
        description: str,
        result: str,
        evidence: AssertionEvidence
    ) -> str:
        """
        Record a single assertion result.

        Args:
            task_id: Task being validated
            category: Assertion category
            description: What we're asserting
            result: pass, fail, skip, or warn
            evidence: Evidence collected

        Returns:
            assertion_id
        """
        assertion_id = str(uuid.uuid4())

        # Update chain counts
        if result == "pass":
            self._chain_pass_count += 1
        elif result == "fail":
            self._chain_fail_count += 1
            if self._first_failure_id is None:
                self._first_failure_id = assertion_id

        # Get position in chain
        position = self._chain_position
        self._chain_position += 1

        # Write transcript entry
        self.transcript.write({
            "entry_type": "assertion",
            "category": "validation",
            "task_id": task_id,
            "summary": f"Assertion {result}: {description[:150]}",
            "details": json.dumps({
                "category": category,
                "result": result,
                "evidence": asdict(evidence)
            })
        })

        # Insert assertion result
        conn = self._get_connection()
        try:
            conn.execute("""
                INSERT INTO assertion_results (
                    id, task_id, execution_id, category,
                    description, result, evidence, chain_id,
                    chain_position, timestamp, wave_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                assertion_id,
                task_id,
                self.execution_id,
                category,
                description,
                result,
                json.dumps(asdict(evidence)),
                self._current_chain_id,
                position,
                datetime.utcnow().isoformat() + "Z",
                self.transcript.wave_id
            ))
            conn.commit()
        except sqlite3.Error as e:
            print(f"Warning: Failed to record assertion in DB: {e}")
        finally:
            conn.close()

        return assertion_id

    def assert_file_created(self, task_id: str, file_path: str) -> str:
        """
        Assert a file was created.

        Args:
            task_id: Task being validated
            file_path: Path to file that should exist

        Returns:
            assertion_id
        """
        full_path = Path(file_path)
        if not full_path.is_absolute():
            full_path = PROJECT_ROOT / file_path

        exists = full_path.exists()
        evidence = AssertionEvidence(
            file_path=str(file_path),
            file_exists=exists
        )

        result = "pass" if exists else "fail"
        return self._record_assertion(
            task_id,
            AssertionCategory.FILE_CREATED.value,
            f"File created: {file_path}",
            result,
            evidence
        )

    def assert_file_modified(self, task_id: str, file_path: str) -> str:
        """
        Assert a file was modified (exists).

        Args:
            task_id: Task being validated
            file_path: Path to file that should exist

        Returns:
            assertion_id
        """
        full_path = Path(file_path)
        if not full_path.is_absolute():
            full_path = PROJECT_ROOT / file_path

        exists = full_path.exists()
        evidence = AssertionEvidence(
            file_path=str(file_path),
            file_exists=exists
        )

        result = "pass" if exists else "fail"
        return self._record_assertion(
            task_id,
            AssertionCategory.FILE_MODIFIED.value,
            f"File modified: {file_path}",
            result,
            evidence
        )

    def assert_file_deleted(self, task_id: str, file_path: str) -> str:
        """
        Assert a file was deleted (does not exist).

        Args:
            task_id: Task being validated
            file_path: Path to file that should not exist

        Returns:
            assertion_id
        """
        full_path = Path(file_path)
        if not full_path.is_absolute():
            full_path = PROJECT_ROOT / file_path

        exists = full_path.exists()
        evidence = AssertionEvidence(
            file_path=str(file_path),
            file_exists=exists
        )

        result = "pass" if not exists else "fail"
        return self._record_assertion(
            task_id,
            AssertionCategory.FILE_DELETED.value,
            f"File deleted: {file_path}",
            result,
            evidence
        )

    def assert_typescript_compiles(self, task_id: str) -> str:
        """
        Assert TypeScript compilation passes.

        Args:
            task_id: Task being validated

        Returns:
            assertion_id
        """
        try:
            result = subprocess.run(
                ["npx", "tsc", "--noEmit"],
                capture_output=True,
                text=True,
                timeout=120,
                cwd=str(PROJECT_ROOT)
            )
            evidence = AssertionEvidence(
                command="npx tsc --noEmit",
                exit_code=result.returncode,
                stdout=result.stdout[:2000] if result.stdout else None,
                stderr=result.stderr[:2000] if result.stderr else None
            )
            status = "pass" if result.returncode == 0 else "fail"
        except subprocess.TimeoutExpired:
            evidence = AssertionEvidence(
                command="npx tsc --noEmit",
                error_message="Command timed out after 120 seconds"
            )
            status = "fail"
        except Exception as e:
            evidence = AssertionEvidence(
                command="npx tsc --noEmit",
                error_message=str(e)
            )
            status = "fail"

        return self._record_assertion(
            task_id,
            AssertionCategory.TYPESCRIPT_COMPILES.value,
            "TypeScript compilation",
            status,
            evidence
        )

    def assert_lint_passes(self, task_id: str) -> str:
        """
        Assert linting passes.

        Args:
            task_id: Task being validated

        Returns:
            assertion_id
        """
        try:
            result = subprocess.run(
                ["npm", "run", "lint"],
                capture_output=True,
                text=True,
                timeout=60,
                cwd=str(PROJECT_ROOT)
            )
            evidence = AssertionEvidence(
                command="npm run lint",
                exit_code=result.returncode,
                stdout=result.stdout[:2000] if result.stdout else None,
                stderr=result.stderr[:2000] if result.stderr else None
            )
            status = "pass" if result.returncode == 0 else "fail"
        except Exception as e:
            evidence = AssertionEvidence(
                command="npm run lint",
                error_message=str(e)
            )
            status = "fail"

        return self._record_assertion(
            task_id,
            AssertionCategory.LINT_PASSES.value,
            "Lint check",
            status,
            evidence
        )

    def assert_tests_pass(self, task_id: str, pattern: str = "") -> str:
        """
        Assert tests pass.

        Args:
            task_id: Task being validated
            pattern: Optional test pattern to run

        Returns:
            assertion_id
        """
        cmd = ["npm", "test"]
        if pattern:
            cmd.extend(["--", pattern])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,
                cwd=str(PROJECT_ROOT)
            )
            evidence = AssertionEvidence(
                command=" ".join(cmd),
                exit_code=result.returncode,
                stdout=result.stdout[:2000] if result.stdout else None,
                stderr=result.stderr[:2000] if result.stderr else None
            )
            status = "pass" if result.returncode == 0 else "fail"
        except Exception as e:
            evidence = AssertionEvidence(
                command=" ".join(cmd),
                error_message=str(e)
            )
            status = "fail"

        return self._record_assertion(
            task_id,
            AssertionCategory.TESTS_PASS.value,
            f"Tests pass{': ' + pattern if pattern else ''}",
            status,
            evidence
        )

    def assert_custom(
        self,
        task_id: str,
        category: str,
        description: str,
        command: str,
        timeout: int = 60
    ) -> str:
        """
        Run a custom assertion via command.

        Args:
            task_id: Task being validated
            category: Custom category name
            description: What we're asserting
            command: Shell command to run
            timeout: Timeout in seconds

        Returns:
            assertion_id
        """
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(PROJECT_ROOT)
            )
            evidence = AssertionEvidence(
                command=command,
                exit_code=result.returncode,
                stdout=result.stdout[:2000] if result.stdout else None,
                stderr=result.stderr[:2000] if result.stderr else None
            )
            status = "pass" if result.returncode == 0 else "fail"
        except subprocess.TimeoutExpired:
            evidence = AssertionEvidence(
                command=command,
                error_message=f"Command timed out after {timeout} seconds"
            )
            status = "fail"
        except Exception as e:
            evidence = AssertionEvidence(
                command=command,
                error_message=str(e)
            )
            status = "fail"

        return self._record_assertion(
            task_id,
            category,
            description,
            status,
            evidence
        )

    def assert_manual(
        self,
        task_id: str,
        category: str,
        description: str,
        passed: bool,
        evidence_details: Optional[Dict] = None
    ) -> str:
        """
        Record a manual assertion result.

        Args:
            task_id: Task being validated
            category: Assertion category
            description: What we're asserting
            passed: Whether the assertion passed
            evidence_details: Optional evidence details

        Returns:
            assertion_id
        """
        evidence = AssertionEvidence()
        if evidence_details:
            for key, value in evidence_details.items():
                if hasattr(evidence, key):
                    setattr(evidence, key, value)

        result = "pass" if passed else "fail"
        return self._record_assertion(
            task_id,
            category,
            description,
            result,
            evidence
        )
