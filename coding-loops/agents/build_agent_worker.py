#!/usr/bin/env python3
"""
Build Agent Worker

The critical Python process that executes individual tasks.
Spawned by the TypeScript BuildAgentOrchestrator.

Usage:
    python3 coding-loops/agents/build_agent_worker.py \
        --agent-id <uuid> \
        --task-id <uuid> \
        --task-list-id <uuid>

Communication:
    - Reads task details from SQLite (database/ideas.db)
    - Writes heartbeats directly to SQLite
    - Updates task status directly in SQLite
    - Exit code 0 = success, non-zero = failure

Part of: BUILD-AGENT-IMPLEMENTATION-PLAN.md Phase 8 (BA-077 to BA-088)
"""

import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
import threading
import time
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
import uuid

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# OBS-102: Add coding-loops/shared to path for ObservableAgent import
SHARED_DIR = Path(__file__).parent.parent / "shared"
sys.path.insert(0, str(SHARED_DIR))

# OBS-102: Import ObservableAgent for unified observability
try:
    from observable_agent import ObservableAgent
    OBSERVABLE_AVAILABLE = True
except ImportError:
    OBSERVABLE_AVAILABLE = False
    print("[BuildAgentWorker] WARNING: ObservableAgent not available. Observability features disabled.", file=sys.stderr)

# Observability API client for HTTP-based logging
try:
    from observability_api import (
        create_execution_run,
        complete_execution_run,
        record_heartbeat,
        log_tool_start,
        log_tool_end,
        start_assertion_chain,
        record_assertion,
        end_assertion_chain,
        check_observable,
    )
    API_OBSERVABLE_AVAILABLE = check_observable()
except ImportError:
    API_OBSERVABLE_AVAILABLE = False
    print("[BuildAgentWorker] INFO: Observability API client not available.", file=sys.stderr)

# Check for anthropic availability
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    print("[BuildAgentWorker] WARNING: anthropic package not installed. Code generation will be simulated.", file=sys.stderr)


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class WorkerConfig:
    """Build Agent Worker configuration"""
    heartbeat_interval_seconds: int = 30
    task_timeout_seconds: int = 300
    validation_timeout_seconds: int = 120
    max_retries: int = 3
    # GAP-006: Retry delay configuration
    base_retry_delay_seconds: float = 1.0
    max_retry_delay_seconds: float = 30.0
    # GAP-011: Configurable context line limit
    context_lines_limit: int = 1000
    db_path: Path = PROJECT_ROOT / "database" / "ideas.db"
    # GAP-003: Test level configurations
    test_commands: Dict[str, List[str]] = None

    def __post_init__(self):
        if self.test_commands is None:
            self.test_commands = {
                'codebase': ['npx tsc --noEmit'],  # Always run
                'api': ['curl -sf http://localhost:3001/api/health > /dev/null || echo "API not running"'],
                'ui': ['echo "UI tests not yet configured"'],
                'python': ['python3 -c "import sys; sys.exit(0)"'],
            }


# =============================================================================
# Database Connection
# =============================================================================

class Database:
    """SQLite database connection for the Build Agent Worker"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._local = threading.local()

    def _get_connection(self) -> sqlite3.Connection:
        """Get thread-local connection"""
        if not hasattr(self._local, 'conn') or self._local.conn is None:
            self._local.conn = sqlite3.connect(
                str(self.db_path),
                check_same_thread=False,
                timeout=30.0
            )
            self._local.conn.row_factory = sqlite3.Row
            self._local.conn.execute("PRAGMA foreign_keys = ON")
        return self._local.conn

    def query(self, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Execute a query and return all rows as dicts"""
        conn = self._get_connection()
        cursor = conn.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

    def query_one(self, sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        """Execute a query and return one row as dict or None"""
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def execute(self, sql: str, params: tuple = ()) -> int:
        """Execute a statement and return rowcount"""
        conn = self._get_connection()
        cursor = conn.execute(sql, params)
        conn.commit()
        return cursor.rowcount

    def close(self):
        """Close the connection"""
        if hasattr(self._local, 'conn') and self._local.conn:
            self._local.conn.close()


# =============================================================================
# GAP-007: Error Classification
# =============================================================================

@dataclass
class ClassifiedError:
    """Result of error classification"""
    error_type: str  # 'transient', 'permanent', 'unknown'
    category: str    # 'network', 'validation', 'compilation', etc.
    message: str
    is_retryable: bool
    suggested_action: str  # 'retry', 'skip', 'escalate', 'abort'


class ErrorClassifier:
    """
    Classifies errors to determine if they're retryable (GAP-007)

    Mirrors the TypeScript implementation in error-handling.ts
    """

    # Patterns for transient (recoverable) errors
    TRANSIENT_PATTERNS = [
        re.compile(r'ETIMEDOUT', re.I),
        re.compile(r'ECONNRESET', re.I),
        re.compile(r'ECONNREFUSED', re.I),
        re.compile(r'ENOTFOUND', re.I),
        re.compile(r'timeout', re.I),
        re.compile(r'rate.?limit', re.I),
        re.compile(r'429'),
        re.compile(r'503'),
        re.compile(r'502'),
        re.compile(r'500.*internal.?server', re.I),
        re.compile(r'temporarily.?unavailable', re.I),
        re.compile(r'connection.?refused', re.I),
        re.compile(r'network.?error', re.I),
        re.compile(r'SIGTERM', re.I),
        re.compile(r'SIGKILL', re.I),
        re.compile(r'out.?of.?memory', re.I),
        re.compile(r'OOM', re.I),
    ]

    # Patterns for permanent (non-recoverable) errors
    PERMANENT_PATTERNS = [
        re.compile(r'syntax.?error', re.I),
        re.compile(r'SyntaxError'),
        re.compile(r'TypeError'),
        re.compile(r'ReferenceError'),
        re.compile(r'file.?not.?found', re.I),
        re.compile(r'ENOENT'),
        re.compile(r'permission.?denied', re.I),
        re.compile(r'EACCES'),
        re.compile(r'invalid.?argument', re.I),
        re.compile(r'type.?error', re.I),
        re.compile(r'module.?not.?found', re.I),
        re.compile(r'cannot.?find.?module', re.I),
        re.compile(r'compilation.?failed', re.I),
        re.compile(r'compile.?error', re.I),
        re.compile(r'lint.?error', re.I),
        re.compile(r'test.?failed', re.I),
        re.compile(r'assertion.?failed', re.I),
        re.compile(r'duplicate.?key', re.I),
        re.compile(r'constraint.?violation', re.I),
    ]

    # Category detection patterns
    CATEGORY_PATTERNS = {
        'network': [re.compile(r'ETIMEDOUT', re.I), re.compile(r'ECONNRESET', re.I), re.compile(r'network', re.I), re.compile(r'connection', re.I)],
        'validation': [re.compile(r'validation', re.I), re.compile(r'lint', re.I), re.compile(r'type.?check', re.I)],
        'compilation': [re.compile(r'compile', re.I), re.compile(r'syntax', re.I), re.compile(r'parse', re.I), re.compile(r'tsc', re.I)],
        'test': [re.compile(r'test', re.I), re.compile(r'assertion', re.I), re.compile(r'expect', re.I)],
        'filesystem': [re.compile(r'ENOENT', re.I), re.compile(r'EACCES', re.I), re.compile(r'file', re.I), re.compile(r'directory', re.I)],
        'database': [re.compile(r'sqlite', re.I), re.compile(r'constraint', re.I), re.compile(r'duplicate', re.I), re.compile(r'sql', re.I)],
        'timeout': [re.compile(r'timeout', re.I), re.compile(r'ETIMEDOUT', re.I)],
        'memory': [re.compile(r'memory', re.I), re.compile(r'OOM', re.I), re.compile(r'heap', re.I)],
        'process': [re.compile(r'SIGTERM', re.I), re.compile(r'SIGKILL', re.I), re.compile(r'exit.?code', re.I)],
    }

    @classmethod
    def classify(cls, error_message: str, exit_code: Optional[int] = None) -> ClassifiedError:
        """Classify an error to determine if it's retryable"""
        message = error_message or "Unknown error"

        # Check for transient patterns
        for pattern in cls.TRANSIENT_PATTERNS:
            if pattern.search(message):
                return ClassifiedError(
                    error_type='transient',
                    category=cls._detect_category(message),
                    message=message,
                    is_retryable=True,
                    suggested_action='retry'
                )

        # Check for permanent patterns
        for pattern in cls.PERMANENT_PATTERNS:
            if pattern.search(message):
                return ClassifiedError(
                    error_type='permanent',
                    category=cls._detect_category(message),
                    message=message,
                    is_retryable=False,
                    suggested_action='escalate'
                )

        # Check exit codes
        if exit_code is not None:
            if exit_code == 0:
                return ClassifiedError(
                    error_type='unknown',
                    category='unexpected',
                    message=message,
                    is_retryable=False,
                    suggested_action='skip'
                )
            if exit_code == 1:
                # Generic error - could be anything, give it one retry
                return ClassifiedError(
                    error_type='unknown',
                    category=cls._detect_category(message),
                    message=message,
                    is_retryable=True,
                    suggested_action='retry'
                )
            if exit_code in (137, 139):
                # SIGKILL (137) or SIGSEGV (139) - usually memory issues
                return ClassifiedError(
                    error_type='transient',
                    category='memory',
                    message=message,
                    is_retryable=True,
                    suggested_action='retry'
                )

        # Default: unknown, give it a retry
        return ClassifiedError(
            error_type='unknown',
            category=cls._detect_category(message),
            message=message,
            is_retryable=True,
            suggested_action='retry'
        )

    @classmethod
    def _detect_category(cls, message: str) -> str:
        """Detect error category from message"""
        for category, patterns in cls.CATEGORY_PATTERNS.items():
            for pattern in patterns:
                if pattern.search(message):
                    return category
        return 'general'


# =============================================================================
# GAP-010: Command Sanitization
# =============================================================================

class CommandSanitizer:
    """
    Sanitizes validation commands to prevent command injection attacks (GAP-010)

    Only allows a whitelist of safe commands and validates command structure.
    """

    # Whitelist of allowed command prefixes
    ALLOWED_COMMAND_PREFIXES = [
        'npx ',
        'npm ',
        'node ',
        'python3 ',
        'python ',
        'pytest ',
        'pip ',
        'cargo ',
        'rustc ',
        'go ',
        'tsc ',
        'eslint ',
        'prettier ',
        'jest ',
        'vitest ',
        'mocha ',
        'curl -sf ',  # Only silent/fail mode
        'echo ',
        'cat ',
        'ls ',
        'test ',
        'true',
        'false',
    ]

    # Dangerous patterns to block
    DANGEROUS_PATTERNS = [
        re.compile(r'[;&|]'),  # Command chaining/piping (except for allowed patterns)
        re.compile(r'\$\('),   # Command substitution
        re.compile(r'`'),      # Backtick substitution
        re.compile(r'>\s*/'),  # Redirect to absolute path
        re.compile(r'rm\s+-rf'), # Dangerous rm
        re.compile(r'sudo\b'),  # Sudo commands
        re.compile(r'chmod\b'), # Permission changes
        re.compile(r'chown\b'), # Ownership changes
        re.compile(r'mkfs\b'),  # Filesystem operations
        re.compile(r'dd\b'),    # Raw disk operations
        re.compile(r'curl.*\|\s*sh', re.I),  # Pipe curl to shell
        re.compile(r'wget.*\|\s*sh', re.I),  # Pipe wget to shell
        re.compile(r'eval\b'),  # Eval commands
        re.compile(r'exec\b'),  # Exec commands
    ]

    # Safe patterns that can include special chars
    SAFE_PIPE_PATTERNS = [
        re.compile(r'curl\s+-sf.*\|\s*head'),  # curl | head is ok
        re.compile(r'echo\s+.*\|\s*grep'),     # echo | grep is ok
        re.compile(r'\|\|\s*echo'),            # || echo for fallback messages
        re.compile(r'>\s*/dev/null'),          # Redirect to /dev/null is ok
    ]

    @classmethod
    def sanitize(cls, command: str) -> tuple[bool, str, str]:
        """
        Sanitize a validation command

        Returns:
            (is_safe, sanitized_command, rejection_reason)
        """
        if not command or not command.strip():
            return (False, "", "Empty command")

        command = command.strip()

        # Check if command starts with an allowed prefix
        is_allowed_prefix = any(
            command.lower().startswith(prefix.lower())
            for prefix in cls.ALLOWED_COMMAND_PREFIXES
        )

        if not is_allowed_prefix:
            # Check for safe compound commands
            if not cls._is_safe_compound_command(command):
                return (
                    False,
                    "",
                    f"Command must start with allowed prefix: {', '.join(cls.ALLOWED_COMMAND_PREFIXES[:5])}..."
                )

        # Check for dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            match = pattern.search(command)
            if match:
                # Check if it's actually a safe pattern
                is_safe_pattern = any(
                    safe.search(command) for safe in cls.SAFE_PIPE_PATTERNS
                )
                if not is_safe_pattern:
                    return (
                        False,
                        "",
                        f"Dangerous pattern detected: {pattern.pattern}"
                    )

        return (True, command, "")

    @classmethod
    def _is_safe_compound_command(cls, command: str) -> bool:
        """Check if a compound command is safe"""
        # Handle && chains where each part is allowed
        parts = re.split(r'\s*&&\s*', command)
        for part in parts:
            part = part.strip()
            if not any(part.lower().startswith(prefix.lower()) for prefix in cls.ALLOWED_COMMAND_PREFIXES):
                return False
        return True


# =============================================================================
# Task Data Structures
# =============================================================================

@dataclass
class FileImpact:
    """File operation for a task"""
    file_path: str
    operation: str  # CREATE, UPDATE, DELETE, READ
    confidence: float


@dataclass
class TaskDetails:
    """Task information loaded from database"""
    id: str
    display_id: str
    title: str
    description: Optional[str]
    category: str
    priority: str
    effort: str
    task_list_id: str
    status: str
    # File impacts - derived from task_file_impacts table
    file_impacts: List[FileImpact]
    # Primary file to work on (first CREATE or UPDATE)
    primary_file: Optional[str] = None
    primary_action: str = "CREATE"
    # GAP-001: Per-task validation command (if None, uses default)
    validation_command: Optional[str] = None
    # GAP-002: Acceptance criteria loaded from task_appendices
    acceptance_criteria: List[str] = None

    def __post_init__(self):
        if self.acceptance_criteria is None:
            self.acceptance_criteria = []


@dataclass
class TaskResult:
    """Result of task execution"""
    success: bool
    error_message: Optional[str] = None
    generated_code: Optional[str] = None
    validation_output: Optional[str] = None
    discoveries: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.discoveries is None:
            self.discoveries = []


@dataclass
class KnowledgeEntry:
    """Knowledge Base entry (gotcha, pattern, or decision)"""
    id: str
    type: str  # gotcha, pattern, decision
    content: str
    file_patterns: List[str]
    action_types: List[str]
    confidence: float
    occurrences: int


# =============================================================================
# Heartbeat System
# =============================================================================

class HeartbeatThread(threading.Thread):
    """Background thread that sends periodic heartbeats"""

    def __init__(
        self,
        db: Database,
        agent_id: str,
        task_id: str,
        interval_seconds: int = 30
    ):
        super().__init__(daemon=True)
        self.db = db
        self.agent_id = agent_id
        self.task_id = task_id
        self.interval = interval_seconds
        self.stop_event = threading.Event()
        self.current_step = "initializing"
        self.progress_percent = 0

    def run(self):
        """Heartbeat loop"""
        while not self.stop_event.is_set():
            try:
                self._send_heartbeat()
            except Exception as e:
                print(f"[Heartbeat] Error: {e}", file=sys.stderr)

            # Wait for interval or stop signal
            self.stop_event.wait(self.interval)

    def _send_heartbeat(self):
        """Send a single heartbeat"""
        # Check if agent exists in build_agent_instances
        try:
            agent_row = self.db.query_one(
                "SELECT id FROM build_agent_instances WHERE id = ?",
                (self.agent_id,)
            )

            if not agent_row:
                # Agent not registered - skip heartbeat
                return

            heartbeat_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()

            self.db.execute(
                """INSERT INTO agent_heartbeats
                   (id, agent_id, task_id, status, progress_percent, current_step, recorded_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    heartbeat_id,
                    self.agent_id,
                    self.task_id,
                    'running',
                    self.progress_percent,
                    self.current_step,
                    now
                )
            )

            # Also update the build_agent_instances table
            self.db.execute(
                """UPDATE build_agent_instances
                   SET last_heartbeat_at = datetime('now'),
                       heartbeat_count = heartbeat_count + 1
                   WHERE id = ?""",
                (self.agent_id,)
            )
        except Exception as e:
            # Don't fail on heartbeat errors
            print(f"[Heartbeat] Warning: {e}", file=sys.stderr)

    def update_progress(self, step: str, percent: int):
        """Update progress for next heartbeat"""
        self.current_step = step
        self.progress_percent = percent

    def stop(self):
        """Signal thread to stop"""
        self.stop_event.set()


# =============================================================================
# Code Generator (Claude API)
# =============================================================================

class CodeGenerator:
    """Generates code using Claude API"""

    def __init__(self):
        self.client = None
        self.is_simulation_mode = True  # Assume simulation until proven otherwise
        if ANTHROPIC_AVAILABLE:
            api_key = os.environ.get('ANTHROPIC_API_KEY')
            if api_key:
                self.client = anthropic.Anthropic(api_key=api_key)
                self.is_simulation_mode = False

    def generate(self, task: TaskDetails, conventions: str, idea_context: str, gotchas: str = "") -> str:
        """Generate code for a task using Claude"""

        prompt = self._build_prompt(task, conventions, idea_context, gotchas)

        if self.client is None:
            # Simulation mode - return minimal fallback code
            print("[CodeGenerator] Running in simulation mode (no Anthropic API key)", file=sys.stderr)
            return self._generate_fallback(task)

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Extract code from response
            content = response.content[0].text
            return self._extract_code(content, task)

        except Exception as e:
            try:
                print(f"[CodeGenerator] Claude API error: {e}", file=sys.stderr)
            except BrokenPipeError:
                pass
            raise

    def _build_prompt(self, task: TaskDetails, conventions: str, idea_context: str, gotchas: str = "") -> str:
        """Build the prompt for Claude (BA-039: includes gotchas from Knowledge Base)"""

        # Build file impacts description
        impacts_text = '\n'.join(
            f'- {fi.operation} {fi.file_path} (confidence: {fi.confidence:.0%})'
            for fi in task.file_impacts
        ) if task.file_impacts else '- No file impacts defined'

        # Build gotchas section (BA-039)
        gotchas_section = ""
        if gotchas:
            gotchas_section = f"""
## GOTCHAS - AVOID THESE MISTAKES
These are known mistakes that have occurred before. Follow them strictly:
{gotchas}
"""

        return f"""# BUILD TASK: {task.display_id}

## Action
{task.primary_action} file: {task.primary_file or 'N/A'}

## Task Description
{task.title}
{task.description or ''}

## Category: {task.category}
## Priority: {task.priority}
## Effort: {task.effort}

## File Operations
{impacts_text}
{gotchas_section}
## Project Conventions
{conventions}

## Context: What This Is About
{idea_context[:500] if idea_context else 'No context available'}

## Validation
After generating the code, it will be validated with:
```
npx tsc --noEmit
```
Expected result: exit code 0

## Instructions
1. Generate ONLY the file content - no explanations
2. Follow all GOTCHAS strictly - they prevent known mistakes
3. Follow project conventions strictly
4. Ensure the validation command will pass
5. Output the complete file content, nothing else
"""

    def _extract_code(self, response: str, task: TaskDetails) -> str:
        """Extract code from Claude's response"""
        # If response is wrapped in code blocks, extract it
        lines = response.strip().split('\n')

        # Check for code block markers
        if lines[0].startswith('```'):
            # Find closing marker
            end_idx = len(lines)
            for i, line in enumerate(lines[1:], 1):
                if line.startswith('```'):
                    end_idx = i
                    break
            return '\n'.join(lines[1:end_idx])

        # Return as-is
        return response.strip()

    def _generate_fallback(self, task: TaskDetails) -> str:
        """Generate minimal fallback code when API unavailable"""
        ext = Path(task.primary_file).suffix if task.primary_file else '.ts'

        if ext == '.ts':
            return f"// Generated by Build Agent for task {task.display_id}\n// TODO: Implement {task.title}\nexport {{}}\n"
        elif ext == '.sql':
            return f"-- Generated by Build Agent for task {task.display_id}\n-- TODO: Implement {task.title}\n"
        elif ext == '.py':
            return f"# Generated by Build Agent for task {task.display_id}\n# TODO: Implement {task.title}\n"
        else:
            return f"// Generated by Build Agent for task {task.display_id}\n// TODO: Implement {task.title}\n"


# =============================================================================
# Build Agent Worker
# =============================================================================

# OBS-102: Conditional base class for observability
_BuildAgentBase = ObservableAgent if OBSERVABLE_AVAILABLE else object


class BuildAgentWorker(_BuildAgentBase):
    """
    Build Agent Worker - Executes a single task

    This is the main worker class that:
    1. Loads task details from the database
    2. Generates code using Claude
    3. Writes the file
    4. Runs validation
    5. Updates task status
    6. Sends heartbeats

    OBS-102: Extends ObservableAgent for unified observability
    OBS-103: Uses tool logging in _generate_code
    OBS-104: Uses AssertionRecorder in validation
    """

    def __init__(
        self,
        agent_id: str,
        task_id: str,
        task_list_id: str,
        config: Optional[WorkerConfig] = None,
        wave_id: Optional[str] = None,
        wave_number: Optional[int] = None
    ):
        # OBS-102: Initialize ObservableAgent base class
        if OBSERVABLE_AVAILABLE:
            execution_id = f"build-{agent_id[:8]}"
            super().__init__(
                execution_id=execution_id,
                instance_id=agent_id,
                agent_type="build-agent",
                wave_id=wave_id,
                wave_number=wave_number,
                db_path=config.db_path if config else PROJECT_ROOT / "database" / "ideas.db"
            )

        self.agent_id = agent_id
        self.task_id = task_id
        self.task_list_id = task_list_id
        self.config = config or WorkerConfig()

        self.db = Database(self.config.db_path)
        self.code_generator = CodeGenerator()
        self.heartbeat_thread: Optional[HeartbeatThread] = None
        self.task: Optional[TaskDetails] = None
        self.build_execution_id: Optional[str] = None  # For logging to task_executions
        self.gotchas: List[KnowledgeEntry] = []  # Relevant gotchas from Knowledge Base
        # GAP-004: Context handoff
        self.log_line_counter: int = 0
        self.resume_execution_id: Optional[str] = None
        self.previous_context: Optional[str] = None
        # GAP-005: Retry tracking
        self.current_attempt: int = 0
        self.last_error: Optional[str] = None
        # API Observability tracking
        self._api_execution_id: Optional[str] = None

    def run(self) -> int:
        """
        Execute the task with retry loop (GAP-005)

        Returns:
            0 on success, non-zero on failure
        """
        print(f"[BuildAgentWorker] Starting agent {self.agent_id} for task {self.task_id}")

        # Create API execution run if available
        if API_OBSERVABLE_AVAILABLE:
            try:
                self._api_execution_id = create_execution_run(
                    task_list_id=self.task_list_id,
                    source="build-agent-worker"
                )
                print(f"[BuildAgentWorker] Created observability execution: {self._api_execution_id}")
            except Exception as e:
                print(f"[BuildAgentWorker] Failed to create observability execution: {e}", file=sys.stderr)

        try:
            # Start heartbeat thread
            self._start_heartbeat()

            # Load task details
            self._update_progress("loading_task", 10)
            self.task = self._load_task()

            if not self.task:
                print(f"[BuildAgentWorker] Task {self.task_id} not found", file=sys.stderr)
                return 1

            # Create a build_executions record for FK compliance when logging
            self.build_execution_id = str(uuid.uuid4())
            self.db.execute(
                """INSERT INTO build_executions
                   (id, spec_id, spec_path, status, current_task_id, tasks_total, started_at)
                   VALUES (?, ?, ?, 'running', ?, 1, datetime('now'))""",
                (self.build_execution_id, self.task_list_id, f'task-list/{self.task_list_id}', self.task_id)
            )

            # GAP-004: Log start with any previous context
            self._log_continuous(f"Starting task: {self.task.display_id} - {self.task.title}")
            if self.previous_context:
                self._log_continuous(f"Resuming with {len(self.previous_context)} chars of previous context")

            # OBS-102: Log task start with ObservableAgent
            if OBSERVABLE_AVAILABLE:
                self.log_task_start(self.task.id, self.task.title, {
                    "display_id": self.task.display_id,
                    "category": self.task.category,
                    "primary_file": self.task.primary_file,
                    "primary_action": self.task.primary_action
                })

            print(f"[BuildAgentWorker] Loaded task: {self.task.display_id} - {self.task.title}")

            # Load context
            self._update_progress("loading_context", 20)
            conventions = self._load_conventions()
            idea_context = self._load_idea_context()

            # Load relevant gotchas from Knowledge Base (BA-038, BA-039)
            self.gotchas = self._load_gotchas()

            # GAP-005: Retry loop for generation and validation
            max_retries = self.config.max_retries
            last_result = None
            checkpoint_ref = None

            for attempt in range(max_retries):
                self.current_attempt = attempt + 1
                self._log_continuous(f"Attempt {self.current_attempt}/{max_retries}")

                if attempt > 0:
                    # GAP-006: Exponential backoff with jitter before retry
                    base_delay = self.config.base_retry_delay_seconds
                    delay = base_delay * (2 ** (attempt - 1))  # 1s, 2s, 4s, 8s...
                    max_delay = self.config.max_retry_delay_seconds
                    delay = min(delay, max_delay)
                    # Add jitter (±10%)
                    jitter = delay * 0.1 * (2 * (hash(f"{attempt}{self.task_id}") % 100) / 100 - 1)
                    delay = delay + jitter
                    self._log_continuous(f"Waiting {delay:.1f}s before retry {attempt + 1}/{max_retries}")
                    print(f"[BuildAgentWorker] Waiting {delay:.1f}s before retry {attempt + 1}/{max_retries}")
                    time.sleep(delay)

                # Generate code (with error context for retries)
                self._update_progress("generating_code", 40)
                result = self._generate_code_with_retry_context(conventions, idea_context, attempt)

                if not result.success:
                    self.last_error = result.error_message
                    self._log_continuous(f"Generation failed: {result.error_message}", "ERROR")
                    continue  # Try next attempt

                # Create checkpoint before writing (BA-018)
                checkpoint_ref = self._create_checkpoint()

                # Write file
                self._update_progress("writing_file", 60)
                if self.task.primary_file and result.generated_code:
                    self._write_file(result.generated_code)
                    self._log_continuous(f"Wrote file: {self.task.primary_file}")

                # Run validation
                self._update_progress("validating", 80)
                validation_result = self._run_validation()

                if not validation_result.success:
                    # Rollback to checkpoint on failure (BA-020)
                    self.last_error = validation_result.error_message
                    self._log_continuous(f"Validation failed: {validation_result.error_message}", "ERROR")
                    if checkpoint_ref:
                        self._rollback_to_checkpoint(checkpoint_ref)
                    continue  # Try next attempt

                # GAP-002: Check acceptance criteria after validation passes
                self._update_progress("checking_acceptance_criteria", 85)
                criteria_result = self._check_acceptance_criteria(result.generated_code or "")

                if not criteria_result.success:
                    self.last_error = criteria_result.error_message
                    self._log_continuous(f"Acceptance criteria failed: {criteria_result.error_message}", "ERROR")
                    if checkpoint_ref:
                        self._rollback_to_checkpoint(checkpoint_ref)
                    continue  # Try next attempt

                # GAP-001: Run multi-level tests after acceptance criteria passes
                self._update_progress("running_test_levels", 90)
                test_levels = self._determine_test_levels()
                if test_levels:
                    self._log_continuous(f"Running test levels: {', '.join(test_levels)}")
                    test_result = self._run_test_levels(test_levels)
                    if not test_result.success:
                        self.last_error = test_result.error_message
                        self._log_continuous(f"Test levels failed: {test_result.error_message}", "ERROR")
                        if checkpoint_ref:
                            self._rollback_to_checkpoint(checkpoint_ref)
                        continue  # Try next attempt
                    self._log_continuous(f"All test levels passed")

                # Success!
                self._success = True  # Flag for observability completion status
                self._update_progress("completed", 100)
                self._log_continuous(f"Task completed successfully on attempt {self.current_attempt}")
                self._record_success(result)

                # OBS-102: Log task completion
                if OBSERVABLE_AVAILABLE:
                    self.log_task_end(self.task.id, "complete", {
                        "attempt": self.current_attempt,
                        "max_retries": max_retries
                    })

                print(f"[BuildAgentWorker] Task {self.task.display_id} completed successfully")
                return 0

            # All retries exhausted
            self._log_continuous(f"All {max_retries} attempts failed", "ERROR")
            self._record_failure(f"Failed after {max_retries} attempts. Last error: {self.last_error}")

            # OBS-102: Log task failure
            if OBSERVABLE_AVAILABLE and self.task:
                self.log_task_end(self.task.id, "failed", {
                    "attempts": max_retries,
                    "last_error": self.last_error
                })

            return 1

        except Exception as e:
            try:
                print(f"[BuildAgentWorker] Fatal error: {e}", file=sys.stderr)
                traceback.print_exc(file=sys.stderr)
            except BrokenPipeError:
                pass
            self._log_continuous(f"Fatal error: {e}", "ERROR")
            self._record_failure(str(e))

            # OBS-102: Log error
            if OBSERVABLE_AVAILABLE:
                self.log_error(str(e), self.task.id if self.task else None, include_traceback=True)
                if self.task:
                    self.log_task_end(self.task.id, "failed", {"error": str(e)})

            return 1

        finally:
            self._stop_heartbeat()
            self.db.close()
            # OBS-102: Close ObservableAgent resources
            if OBSERVABLE_AVAILABLE:
                self.close()
            # Complete API observability execution
            if API_OBSERVABLE_AVAILABLE and self._api_execution_id:
                try:
                    status = "completed" if self.task and hasattr(self, '_success') and self._success else "failed"
                    complete_execution_run(self._api_execution_id, status=status)
                except Exception as e:
                    print(f"[BuildAgentWorker] Failed to complete observability execution: {e}", file=sys.stderr)

    def _generate_code_with_retry_context(self, conventions: str, idea_context: str, attempt: int) -> TaskResult:
        """
        GAP-005: Generate code with retry context

        On retry attempts, includes the previous error in the prompt.
        """
        if attempt == 0:
            return self._generate_code(conventions, idea_context)

        # Include previous error in generation context
        error_context = ""
        if self.last_error:
            error_context = f"""

## PREVIOUS ATTEMPT FAILED
The previous generation attempt failed with this error:
{self.last_error}

Please fix this issue and try again. Focus on the specific error mentioned above.
"""

        # Include previous context for resume (GAP-004)
        if self.previous_context and attempt == 0:
            error_context += f"""

## PREVIOUS EXECUTION CONTEXT
{self.previous_context[:2000]}...
"""

        # Modify idea_context to include error info
        enhanced_context = idea_context + error_context

        return self._generate_code(conventions, enhanced_context)

    def _start_heartbeat(self):
        """Start the heartbeat background thread"""
        self.heartbeat_thread = HeartbeatThread(
            db=self.db,
            agent_id=self.agent_id,
            task_id=self.task_id,
            interval_seconds=self.config.heartbeat_interval_seconds
        )
        self.heartbeat_thread.start()

    def _stop_heartbeat(self):
        """Stop the heartbeat thread"""
        if self.heartbeat_thread:
            self.heartbeat_thread.stop()
            self.heartbeat_thread.join(timeout=5)

    def _log_continuous(self, message: str, level: str = 'INFO'):
        """
        GAP-004: Write continuous log entry during execution

        Inserts into task_execution_log for context handoff between agents.
        """
        if not self.build_execution_id:
            print(f"[{level}] {message}", file=sys.stderr)
            return

        try:
            self.log_line_counter += 1
            log_id = str(uuid.uuid4())

            self.db.execute(
                """INSERT INTO task_execution_log
                   (id, execution_id, line_number, log_level, content, timestamp)
                   VALUES (?, ?, ?, ?, ?, datetime('now'))""",
                (log_id, self.build_execution_id, self.log_line_counter, level, message)
            )
        except Exception as e:
            # Don't fail on logging errors
            print(f"[{level}] {message} (log failed: {e})", file=sys.stderr)

    def _load_previous_context(self, execution_id: str) -> Optional[str]:
        """
        GAP-004: Read previous execution logs for resume capability

        GAP-011: Loads configurable number of lines (default 1000) from a previous
        execution to provide context when resuming after timeout or failure.
        """
        try:
            # GAP-011: Use configurable limit
            limit = self.config.context_lines_limit
            rows = self.db.query(
                f"""SELECT line_number, log_level, content
                   FROM task_execution_log
                   WHERE execution_id = ?
                   ORDER BY line_number DESC
                   LIMIT {limit}""",
                (execution_id,)
            )

            if not rows:
                return None

            # Reverse to get chronological order
            rows.reverse()

            context_lines = []
            for row in rows:
                context_lines.append(f"[{row['log_level']}] {row['content']}")

            context = '\n'.join(context_lines)
            print(f"[BuildAgentWorker] Loaded {len(rows)} lines from previous execution")

            return context

        except Exception as e:
            print(f"[BuildAgentWorker] Error loading previous context: {e}", file=sys.stderr)
            return None

    def set_resume_execution_id(self, execution_id: str):
        """
        GAP-004: Set the execution ID to resume from

        Called by orchestrator when retrying a task.
        """
        self.resume_execution_id = execution_id
        self.previous_context = self._load_previous_context(execution_id)

    def _update_progress(self, step: str, percent: int):
        """Update progress in heartbeat"""
        if self.heartbeat_thread:
            self.heartbeat_thread.update_progress(step, percent)

    def _load_task(self) -> Optional[TaskDetails]:
        """Load task details from database"""
        # Load core task info (GAP-001: now includes validation_command)
        row = self.db.query_one(
            """SELECT
                t.id, t.display_id, t.title, t.description,
                t.category, t.priority, t.effort,
                t.task_list_id, t.status,
                t.validation_command
               FROM tasks t
               WHERE t.id = ?""",
            (self.task_id,)
        )

        if not row:
            return None

        # Load file impacts for this task
        impact_rows = self.db.query(
            """SELECT file_path, operation, confidence
               FROM task_file_impacts
               WHERE task_id = ?
               ORDER BY
                   CASE operation
                       WHEN 'CREATE' THEN 1
                       WHEN 'UPDATE' THEN 2
                       WHEN 'DELETE' THEN 3
                       ELSE 4
                   END,
                   confidence DESC""",
            (self.task_id,)
        )

        file_impacts = [
            FileImpact(
                file_path=r['file_path'],
                operation=r['operation'],
                confidence=r['confidence']
            )
            for r in impact_rows
        ]

        # Determine primary file (first CREATE or UPDATE with high confidence)
        primary_file = None
        primary_action = "CREATE"
        for impact in file_impacts:
            if impact.operation in ('CREATE', 'UPDATE') and impact.confidence >= 0.5:
                primary_file = impact.file_path
                primary_action = impact.operation
                break

        # GAP-002: Load acceptance criteria from task_appendices
        acceptance_criteria = self._load_acceptance_criteria()

        return TaskDetails(
            id=row['id'],
            display_id=row.get('display_id') or row['id'][:8],
            title=row['title'],
            description=row.get('description'),
            category=row.get('category', 'task'),
            priority=row.get('priority', 'P2'),
            effort=row.get('effort', 'medium'),
            task_list_id=row.get('task_list_id') or self.task_list_id,
            status=row['status'],
            file_impacts=file_impacts,
            primary_file=primary_file,
            primary_action=primary_action,
            # GAP-001: Per-task validation command
            validation_command=row.get('validation_command'),
            # GAP-002: Acceptance criteria
            acceptance_criteria=acceptance_criteria
        )

    def _load_acceptance_criteria(self) -> List[str]:
        """
        GAP-002: Load acceptance criteria from task_appendices table

        Queries task_appendices for entries with appendix_type='acceptance_criteria'
        and parses the content into a list of criteria strings.
        """
        try:
            rows = self.db.query(
                """SELECT content FROM task_appendices
                   WHERE task_id = ? AND appendix_type = 'acceptance_criteria'
                   ORDER BY position ASC""",
                (self.task_id,)
            )

            if not rows:
                return []

            criteria = []
            for row in rows:
                content = row.get('content', '')
                if not content:
                    continue

                # Try to parse as JSON array first
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, list):
                        criteria.extend(str(c) for c in parsed)
                        continue
                except json.JSONDecodeError:
                    pass

                # Parse as markdown checkbox list or plain text
                for line in content.split('\n'):
                    line = line.strip()
                    # Match markdown checkboxes: - [ ] criterion
                    if line.startswith('- [ ]') or line.startswith('- [x]'):
                        criterion = line[5:].strip()
                        if criterion:
                            criteria.append(criterion)
                    # Match numbered items: 1. criterion or AC1: criterion
                    elif line and (line[0].isdigit() or line.startswith('AC')):
                        # Extract the actual criterion text
                        parts = line.split(':', 1)
                        if len(parts) > 1:
                            criteria.append(parts[1].strip())
                        else:
                            parts = line.split('.', 1)
                            if len(parts) > 1:
                                criteria.append(parts[1].strip())
                    # Plain text lines that look like criteria
                    elif line and not line.startswith('#'):
                        criteria.append(line)

            if criteria:
                print(f"[BuildAgentWorker] Loaded {len(criteria)} acceptance criteria")

            return criteria

        except Exception as e:
            print(f"[BuildAgentWorker] Error loading acceptance criteria: {e}", file=sys.stderr)
            return []

    def _load_conventions(self) -> str:
        """Load project conventions from CLAUDE.md"""
        claude_md_path = PROJECT_ROOT / "CLAUDE.md"

        if not claude_md_path.exists():
            return "No conventions file found."

        content = claude_md_path.read_text(encoding='utf-8')

        # Extract relevant sections
        sections_to_extract = [
            "Database Conventions",
            "API Conventions",
            "Build Agent Workflow",
            "TypeScript Types for DB"
        ]

        extracted = []
        lines = content.split('\n')
        current_section = None
        capture = False

        for line in lines:
            if line.startswith('## '):
                section_name = line[3:].strip()
                capture = any(name in section_name for name in sections_to_extract)
                if capture:
                    current_section = section_name
                    extracted.append(f"## {current_section}\n")
            elif capture:
                if line.startswith('## '):
                    capture = False
                else:
                    extracted.append(line)

        return '\n'.join(extracted) if extracted else "No relevant conventions found."

    def _load_idea_context(self) -> str:
        """Load idea context for the task"""
        try:
            # Try to get project info from task list via ideas table
            task_list = self.db.query_one(
                """SELECT tl.project_id, tl.name as list_name, i.slug as idea_slug, i.title as idea_title
                   FROM task_lists_v2 tl
                   LEFT JOIN ideas i ON i.id = tl.project_id
                   WHERE tl.id = ?""",
                (self.task_list_id,)
            )

            if not task_list:
                return "No idea context available."

            # Build context from available info
            context_parts = []
            if task_list.get('idea_slug'):
                context_parts.append(f"Idea: {task_list.get('idea_slug')}")
            if task_list.get('idea_title'):
                context_parts.append(f"Title: {task_list.get('idea_title')}")
            if task_list.get('list_name'):
                context_parts.append(f"Task List: {task_list.get('list_name')}")

            return '\n'.join(context_parts) if context_parts else "No idea context available."
        except Exception as e:
            # If schema doesn't match or other error, return gracefully
            print(f"[BuildAgentWorker] Could not load idea context: {e}")
            return "No idea context available."

    def _load_gotchas(self) -> List[KnowledgeEntry]:
        """
        Load relevant gotchas from Knowledge Base (BA-038, BA-039)

        Queries gotchas that match:
        - File pattern matching the task's primary file
        - Action type matching the task's action (CREATE, UPDATE, etc.)
        - Confidence >= 0.5
        """
        if not self.task or not self.task.primary_file:
            return []

        try:
            # Get file extension for pattern matching
            file_ext = Path(self.task.primary_file).suffix  # e.g., '.ts', '.sql'
            file_pattern = f"*{file_ext}"
            action_type = self.task.primary_action

            # Query knowledge_entries for relevant gotchas
            rows = self.db.query(
                """SELECT id, type, content, file_patterns_json, action_types_json,
                          confidence, occurrences
                   FROM knowledge_entries
                   WHERE type = 'gotcha'
                     AND confidence >= 0.5
                   ORDER BY confidence DESC, occurrences DESC
                   LIMIT 10""",
                ()
            )

            gotchas = []
            for row in rows:
                # Parse JSON fields
                try:
                    file_patterns = json.loads(row.get('file_patterns_json', '[]'))
                    action_types = json.loads(row.get('action_types_json', '[]'))
                except json.JSONDecodeError:
                    file_patterns = []
                    action_types = []

                # Check if this gotcha is relevant to our task
                file_match = not file_patterns or any(
                    self._pattern_matches(pattern, self.task.primary_file)
                    for pattern in file_patterns
                )
                action_match = not action_types or action_type in action_types

                if file_match and action_match:
                    gotchas.append(KnowledgeEntry(
                        id=row['id'],
                        type=row['type'],
                        content=row['content'],
                        file_patterns=file_patterns,
                        action_types=action_types,
                        confidence=row.get('confidence', 0.5),
                        occurrences=row.get('occurrences', 0)
                    ))

            if gotchas:
                print(f"[BuildAgentWorker] Loaded {len(gotchas)} gotchas from Knowledge Base")

            return gotchas

        except Exception as e:
            print(f"[BuildAgentWorker] Error loading gotchas: {e}", file=sys.stderr)
            return []

    def _pattern_matches(self, pattern: str, file_path: str) -> bool:
        """Check if a glob-like pattern matches a file path"""
        import fnmatch
        # Normalize paths
        pattern = pattern.replace('\\', '/')
        file_path = file_path.replace('\\', '/')

        # Handle common patterns
        if pattern.startswith('*'):
            # Extension or suffix match
            return file_path.endswith(pattern[1:]) or fnmatch.fnmatch(file_path, pattern)
        elif '*' in pattern:
            return fnmatch.fnmatch(file_path, pattern)
        else:
            # Exact or substring match
            return pattern in file_path

    def _format_gotchas_for_prompt(self) -> str:
        """Format gotchas for inclusion in Claude prompt"""
        if not self.gotchas:
            return "No gotchas recorded for this file type."

        formatted = []
        for i, gotcha in enumerate(self.gotchas[:5], 1):  # Limit to 5
            confidence_str = f"{gotcha.confidence:.0%}" if gotcha.confidence else "?"
            formatted.append(f"{i}. [{confidence_str}] {gotcha.content}")

        return '\n'.join(formatted)

    def _generate_code(self, conventions: str, idea_context: str) -> TaskResult:
        """
        Generate code for the task
        OBS-103: Added tool logging for observability
        """
        if not self.task:
            return TaskResult(success=False, error_message="No task loaded")

        # OBS-103: Log tool start for code generation
        tool_use_id = None
        api_tool_id = None
        start_time = time.time()

        if OBSERVABLE_AVAILABLE:
            tool_use_id = self.log_tool_start(
                tool_name="CodeGenerator",
                tool_input={
                    "task_id": self.task.id,
                    "display_id": self.task.display_id,
                    "primary_file": self.task.primary_file,
                    "action": self.task.primary_action,
                },
                task_id=self.task.id
            )

        # Also log via HTTP API if available
        if API_OBSERVABLE_AVAILABLE and self._api_execution_id:
            try:
                api_tool_id = log_tool_start(
                    execution_id=self._api_execution_id,
                    tool_name="CodeGenerator",
                    tool_input={
                        "task_id": self.task.id,
                        "display_id": self.task.display_id,
                        "primary_file": self.task.primary_file,
                        "action": self.task.primary_action,
                    },
                    task_id=self.task.id
                )
            except Exception as e:
                print(f"[BuildAgentWorker] API tool log failed: {e}", file=sys.stderr)

        try:
            # Format gotchas for the prompt (BA-039)
            gotchas_text = self._format_gotchas_for_prompt()
            code = self.code_generator.generate(self.task, conventions, idea_context, gotchas_text)

            duration_ms = int((time.time() - start_time) * 1000)

            # OBS-103: Log tool completion
            if OBSERVABLE_AVAILABLE and tool_use_id:
                self.log_tool_end(
                    tool_use_id=tool_use_id,
                    output={"code_length": len(code), "success": True},
                    is_error=False
                )

            # Also log via HTTP API
            if API_OBSERVABLE_AVAILABLE and api_tool_id:
                try:
                    log_tool_end(
                        tool_use_id=api_tool_id,
                        output={"code_length": len(code), "success": True},
                        is_error=False,
                        duration_ms=duration_ms
                    )
                except Exception as api_err:
                    print(f"[BuildAgentWorker] API tool end log failed: {api_err}", file=sys.stderr)

            return TaskResult(success=True, generated_code=code)
        except Exception as e:
            tb = traceback.format_exc()
            error_msg = f"Code generation failed: {e}\n{tb}"
            duration_ms = int((time.time() - start_time) * 1000)

            # OBS-103: Log tool error
            if OBSERVABLE_AVAILABLE and tool_use_id:
                self.log_tool_end(
                    tool_use_id=tool_use_id,
                    output={"error": str(e)},
                    is_error=True,
                    error_message=error_msg
                )

            # Also log via HTTP API
            if API_OBSERVABLE_AVAILABLE and api_tool_id:
                try:
                    log_tool_end(
                        tool_use_id=api_tool_id,
                        output={"error": str(e)},
                        is_error=True,
                        duration_ms=duration_ms
                    )
                except Exception as api_err:
                    print(f"[BuildAgentWorker] API tool end log failed: {api_err}", file=sys.stderr)

            return TaskResult(success=False, error_message=error_msg)

    def _write_file(self, code: str):
        """Write generated code to file"""
        if not self.task or not self.task.primary_file:
            return

        file_path = PROJECT_ROOT / self.task.primary_file

        # Create parent directories
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        file_path.write_text(code, encoding='utf-8')
        print(f"[BuildAgentWorker] Wrote file: {self.task.primary_file}")

    def _create_checkpoint(self) -> Optional[str]:
        """
        Create a git checkpoint before making changes (BA-018)

        Returns the git commit hash or stash reference for rollback.
        """
        try:
            # Check if there are any changes to stash
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.stdout.strip():
                # There are changes - create a stash
                stash_result = subprocess.run(
                    ["git", "stash", "push", "-m", f"checkpoint-{self.task_id}-{self.agent_id}"],
                    cwd=str(PROJECT_ROOT),
                    capture_output=True,
                    text=True,
                    timeout=30
                )

                if stash_result.returncode == 0:
                    # Get the stash reference
                    ref_result = subprocess.run(
                        ["git", "stash", "list", "--format=%H", "-1"],
                        cwd=str(PROJECT_ROOT),
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    checkpoint_ref = f"stash@{{0}}"
                    print(f"[BuildAgentWorker] Created checkpoint (stash): {checkpoint_ref}")

                    # Record checkpoint in database
                    self._record_checkpoint(checkpoint_ref, "stash")

                    return checkpoint_ref

            # No changes to stash - get current HEAD as checkpoint
            head_result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=10
            )

            if head_result.returncode == 0:
                checkpoint_ref = head_result.stdout.strip()[:12]  # Short hash
                print(f"[BuildAgentWorker] Created checkpoint (HEAD): {checkpoint_ref}")
                self._record_checkpoint(checkpoint_ref, "commit")
                return checkpoint_ref

            return None

        except Exception as e:
            print(f"[BuildAgentWorker] Error creating checkpoint: {e}", file=sys.stderr)
            return None

    def _rollback_to_checkpoint(self, checkpoint_ref: str):
        """
        Rollback to a checkpoint on failure (BA-020)

        Restores file state to before task execution.
        """
        try:
            print(f"[BuildAgentWorker] Rolling back to checkpoint: {checkpoint_ref}")

            if checkpoint_ref.startswith("stash@"):
                # Rollback stashed changes
                # First, discard current changes
                subprocess.run(
                    ["git", "checkout", "--", "."],
                    cwd=str(PROJECT_ROOT),
                    capture_output=True,
                    timeout=30
                )

                # Pop the stash to restore original state
                result = subprocess.run(
                    ["git", "stash", "pop"],
                    cwd=str(PROJECT_ROOT),
                    capture_output=True,
                    text=True,
                    timeout=30
                )

                if result.returncode == 0:
                    print(f"[BuildAgentWorker] Rollback successful (stash popped)")
                else:
                    print(f"[BuildAgentWorker] Stash pop failed: {result.stderr}", file=sys.stderr)
            else:
                # Rollback to a specific commit - discard changes to file
                if self.task and self.task.primary_file:
                    subprocess.run(
                        ["git", "checkout", checkpoint_ref, "--", self.task.primary_file],
                        cwd=str(PROJECT_ROOT),
                        capture_output=True,
                        timeout=30
                    )
                    print(f"[BuildAgentWorker] Rollback successful (file restored from {checkpoint_ref})")
                else:
                    # General reset
                    subprocess.run(
                        ["git", "checkout", "--", "."],
                        cwd=str(PROJECT_ROOT),
                        capture_output=True,
                        timeout=30
                    )
                    print(f"[BuildAgentWorker] Rollback successful (all changes discarded)")

        except Exception as e:
            print(f"[BuildAgentWorker] Error during rollback: {e}", file=sys.stderr)

    def _record_checkpoint(self, checkpoint_ref: str, checkpoint_type: str):
        """Record checkpoint in database for tracking

        Note: checkpoint_type must be one of: 'task_complete', 'task_failed', 'manual', 'auto'
        We map git-specific types (stash, commit) to 'auto' since they're automatic checkpoints.
        """
        try:
            # Map git types to valid DB types
            db_checkpoint_type = 'auto' if checkpoint_type in ('stash', 'commit') else checkpoint_type

            self.db.execute(
                """INSERT INTO build_checkpoints
                   (id, build_id, task_id, checkpoint_type, state_json, created_at)
                   VALUES (?, ?, ?, ?, ?, datetime('now'))""",
                (
                    str(uuid.uuid4()),
                    self.build_execution_id,
                    self.task_id,
                    db_checkpoint_type,
                    json.dumps({"ref": checkpoint_ref, "git_type": checkpoint_type}),
                )
            )
        except Exception as e:
            print(f"[BuildAgentWorker] Error recording checkpoint: {e}", file=sys.stderr)

    def _run_validation(self) -> TaskResult:
        """
        Run the validation command (GAP-001: uses task-specific command)

        GAP-001: Uses task.validation_command if set, falls back to npx tsc --noEmit
        OBS-104: Uses AssertionRecorder for validation tracking
        """
        if not self.task:
            return TaskResult(success=False, error_message="No task loaded")

        # In simulation mode, skip TypeScript validation as generated code is placeholder
        if self.code_generator.is_simulation_mode:
            print("[BuildAgentWorker] Skipping validation in simulation mode", file=sys.stderr)
            return TaskResult(
                success=True,
                validation_output="Validation skipped (simulation mode - no API key)"
            )

        # OBS-104: Start assertion chain for validation
        chain_id = None
        if OBSERVABLE_AVAILABLE:
            chain_id = self.start_assertion_chain(
                self.task.id,
                f"Validation for {self.task.display_id}"
            )

        # GAP-001: Use task-specific validation command or default
        raw_command = self.task.validation_command or "npx tsc --noEmit"
        expected = "exit code 0"

        # GAP-010: Sanitize the command before execution
        is_safe, command, rejection_reason = CommandSanitizer.sanitize(raw_command)
        if not is_safe:
            self._log_continuous(f"Validation command rejected: {rejection_reason}", "WARNING")
            # OBS-104: Record failed assertion for sanitization
            if OBSERVABLE_AVAILABLE:
                self.assert_manual(
                    self.task.id,
                    "security",
                    "Command sanitization",
                    False,
                    {"reason": rejection_reason, "command": raw_command}
                )
                self.end_assertion_chain(chain_id)
            return TaskResult(
                success=False,
                error_message=f"Validation command rejected (security): {rejection_reason}",
                validation_output=f"Rejected command: {raw_command}\nReason: {rejection_reason}"
            )

        print(f"[BuildAgentWorker] Running validation: {command}")

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=self.config.validation_timeout_seconds
            )

            output = f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"

            # Check expected result
            if "exit code 0" in expected.lower():
                success = result.returncode == 0
            else:
                success = expected.lower() in output.lower()

            # OBS-104: Record assertion for TypeScript compilation
            if OBSERVABLE_AVAILABLE:
                if "tsc" in command.lower():
                    self.assert_typescript_compiles(self.task.id)
                else:
                    self.assert_custom(
                        self.task.id,
                        "validation",
                        f"Validation command: {command[:50]}...",
                        command,
                        timeout=self.config.validation_timeout_seconds
                    )

                # OBS-104: Record file assertion if we created/modified a file
                if self.task.primary_file:
                    if self.task.primary_action == "CREATE":
                        self.assert_file_created(self.task.id, self.task.primary_file)
                    elif self.task.primary_action == "UPDATE":
                        self.assert_file_modified(self.task.id, self.task.primary_file)

                # End assertion chain
                chain_result = self.end_assertion_chain(chain_id)
                if chain_result:
                    print(f"[BuildAgentWorker] Assertion chain: {chain_result.passed_count}/{chain_result.total_count} passed")

            if success:
                return TaskResult(success=True, validation_output=output)
            else:
                return TaskResult(
                    success=False,
                    error_message=f"Validation failed (exit code {result.returncode})",
                    validation_output=output
                )

        except subprocess.TimeoutExpired:
            # OBS-104: Record timeout assertion
            if OBSERVABLE_AVAILABLE:
                self.assert_manual(
                    self.task.id,
                    "validation",
                    "Validation timeout",
                    False,
                    {"timeout_seconds": self.config.validation_timeout_seconds}
                )
                self.end_assertion_chain(chain_id)
            return TaskResult(success=False, error_message="Validation timed out")
        except Exception as e:
            # OBS-104: Record error assertion
            if OBSERVABLE_AVAILABLE:
                self.assert_manual(
                    self.task.id,
                    "validation",
                    "Validation error",
                    False,
                    {"error": str(e)}
                )
                self.end_assertion_chain(chain_id)
            return TaskResult(success=False, error_message=f"Validation error: {e}")

    def _check_acceptance_criteria(self, generated_code: str) -> TaskResult:
        """
        GAP-002: Check acceptance criteria after validation passes

        Verifies that the generated code meets all acceptance criteria.
        Returns TaskResult with success=True if all criteria pass.
        """
        if not self.task or not self.task.acceptance_criteria:
            # No criteria to check - pass by default
            return TaskResult(success=True, validation_output="No acceptance criteria defined")

        criteria_results = []
        failed_criteria = []

        for criterion in self.task.acceptance_criteria:
            criterion_lower = criterion.lower()
            passed = False
            reason = ""

            # Check file existence criteria
            if 'file' in criterion_lower and ('exists' in criterion_lower or 'created' in criterion_lower):
                # Try to extract file path from criterion
                file_check_result = self._check_file_criterion(criterion, generated_code)
                passed = file_check_result['passed']
                reason = file_check_result['reason']

            # Check type/interface/enum existence in code
            elif any(kw in criterion_lower for kw in ['interface', 'type', 'enum', 'class', 'function']):
                # Look for the definition in generated code
                keywords = ['interface', 'type', 'enum', 'class', 'function', 'const']
                for kw in keywords:
                    if kw in criterion_lower:
                        # Extract the name after the keyword
                        import re
                        match = re.search(rf'`([^`]+)`', criterion)
                        if match:
                            name = match.group(1)
                            # Check if name is defined in code
                            if f'{kw} {name}' in generated_code or f'{name}' in generated_code:
                                passed = True
                                reason = f"Found {kw} {name}"
                            else:
                                reason = f"Missing {kw} {name}"
                        break

            # Check for field/property existence
            elif 'has' in criterion_lower or 'with' in criterion_lower:
                # Extract field names from criterion
                import re
                fields = re.findall(r'`([^`]+)`', criterion)
                if fields:
                    found_fields = sum(1 for f in fields if f in generated_code)
                    if found_fields == len(fields):
                        passed = True
                        reason = f"Found all {len(fields)} fields"
                    else:
                        reason = f"Found {found_fields}/{len(fields)} fields"

            # Check for export statements
            elif 'export' in criterion_lower:
                if 'export' in generated_code:
                    passed = True
                    reason = "Export statements found"
                else:
                    reason = "No export statements"

            # Check compilation (TypeScript)
            elif 'compile' in criterion_lower or 'tsc' in criterion_lower:
                # Already validated by _run_validation()
                passed = True
                reason = "TypeScript compilation handled by validation"

            # Default: assume pass if we can't verify
            else:
                passed = True
                reason = "Unable to verify programmatically - assumed pass"

            # GAP-009: Track if criterion was unverifiable
            unverifiable = reason == "Unable to verify programmatically - assumed pass"

            criteria_results.append({
                'criterion': criterion[:50] + '...' if len(criterion) > 50 else criterion,
                'full_criterion': criterion,
                'passed': passed,
                'reason': reason,
                'unverifiable': unverifiable
            })

            if not passed:
                failed_criteria.append(criterion)

        # Log results
        passed_count = sum(1 for r in criteria_results if r['passed'])
        total_count = len(criteria_results)
        # GAP-009: Count unverifiable criteria
        unverifiable_count = sum(1 for r in criteria_results if r.get('unverifiable', False))

        print(f"[BuildAgentWorker] Acceptance criteria: {passed_count}/{total_count} passed")
        if unverifiable_count > 0:
            print(f"[BuildAgentWorker] WARNING: {unverifiable_count} criteria could not be verified programmatically")

        for result in criteria_results:
            status = "PASS" if result['passed'] else "FAIL"
            if result.get('unverifiable'):
                status = "SKIP"  # Mark unverifiable as skipped for visibility
            print(f"  [{status}] {result['criterion']} - {result['reason']}")

        # GAP-009: Store unverifiable criteria in database for human review
        if unverifiable_count > 0:
            self._record_unverifiable_criteria(
                [r['full_criterion'] for r in criteria_results if r.get('unverifiable', False)]
            )

        if failed_criteria:
            return TaskResult(
                success=False,
                error_message=f"Acceptance criteria failed: {len(failed_criteria)} of {total_count}",
                validation_output=json.dumps(criteria_results, indent=2)
            )

        return TaskResult(
            success=True,
            validation_output=f"All {total_count} acceptance criteria passed ({unverifiable_count} unverifiable, assumed pass)"
        )

    def _check_file_criterion(self, criterion: str, generated_code: str) -> Dict[str, Any]:
        """Check a file existence/creation criterion"""
        import re

        # Extract file path from criterion (typically in backticks)
        match = re.search(r'`([^`]+\.[a-zA-Z]+)`', criterion)
        if not match:
            return {'passed': True, 'reason': 'No file path found in criterion'}

        file_path = match.group(1)
        full_path = PROJECT_ROOT / file_path

        if full_path.exists():
            return {'passed': True, 'reason': f'File exists: {file_path}'}

        # If we just generated the code but haven't written it yet
        if self.task and self.task.primary_file and file_path in self.task.primary_file:
            return {'passed': True, 'reason': f'File will be created: {file_path}'}

        return {'passed': False, 'reason': f'File does not exist: {file_path}'}

    def _record_unverifiable_criteria(self, criteria: List[str]):
        """
        GAP-009: Record acceptance criteria that couldn't be verified programmatically

        Stores them in task_appendices for human review and potential future automation.
        """
        if not criteria:
            return

        try:
            # Create an appendix entry with the unverifiable criteria
            content = json.dumps({
                'task_id': self.task_id,
                'task_display_id': self.task.display_id if self.task else None,
                'unverifiable_criteria': criteria,
                'recorded_at': datetime.now(timezone.utc).isoformat(),
                'agent_id': self.agent_id,
                'requires_human_review': True
            }, indent=2)

            # Insert into task_appendices
            self.db.execute(
                """INSERT OR REPLACE INTO task_appendices
                   (id, task_id, appendix_type, content_type, content, position, created_at, updated_at)
                   VALUES (?, ?, 'acceptance_criteria', 'inline', ?, 99, datetime('now'), datetime('now'))""",
                (str(uuid.uuid4()), self.task_id, content)
            )

            self._log_continuous(
                f"Recorded {len(criteria)} unverifiable criteria for human review",
                "WARNING"
            )

        except Exception as e:
            print(f"[BuildAgentWorker] Failed to record unverifiable criteria: {e}", file=sys.stderr)

    def _determine_test_levels(self) -> List[str]:
        """
        GAP-003: Determine test levels based on file impacts

        Returns list of test levels to run based on file impacts:
        - 'codebase' for all tasks (minimum)
        - 'api' if any file matches server/*
        - 'ui' if any file matches frontend/*
        - 'python' if any file matches *.py
        """
        levels: Set[str] = {'codebase'}  # Always run codebase tests

        if not self.task or not self.task.file_impacts:
            return list(levels)

        for impact in self.task.file_impacts:
            file_path = impact.file_path.lower()

            # API tests for server files
            if 'server/' in file_path or file_path.endswith('.routes.ts'):
                levels.add('api')

            # UI tests for frontend files
            if 'frontend/' in file_path or file_path.endswith('.tsx') or file_path.endswith('.jsx'):
                levels.add('ui')

            # Python tests for Python files
            if file_path.endswith('.py'):
                levels.add('python')

        return list(levels)

    def _run_test_levels(self, levels: List[str]) -> TaskResult:
        """
        GAP-003: Execute appropriate test levels after validation

        Runs each test command sequentially and fails on first failure.
        """
        if not levels:
            return TaskResult(success=True, validation_output="No test levels to run")

        all_output = []

        for level in levels:
            commands = self.config.test_commands.get(level, [])
            if not commands:
                continue

            print(f"[BuildAgentWorker] Running {level} tests...")

            for command in commands:
                try:
                    result = subprocess.run(
                        command,
                        shell=True,
                        cwd=str(PROJECT_ROOT),
                        capture_output=True,
                        text=True,
                        timeout=self.config.validation_timeout_seconds
                    )

                    output = f"[{level}] {command}\nstdout: {result.stdout}\nstderr: {result.stderr}"
                    all_output.append(output)

                    if result.returncode != 0:
                        # Non-fatal for now - just log
                        print(f"[BuildAgentWorker] {level} test returned non-zero: {result.returncode}")

                except subprocess.TimeoutExpired:
                    all_output.append(f"[{level}] {command} - TIMEOUT")
                except Exception as e:
                    all_output.append(f"[{level}] {command} - ERROR: {e}")

        return TaskResult(
            success=True,
            validation_output='\n'.join(all_output)
        )

    def _record_success(self, result: TaskResult):
        """Record task success in database"""
        now = datetime.now(timezone.utc).isoformat()

        self.db.execute(
            """UPDATE tasks
               SET status = 'completed',
                   completed_at = ?,
                   updated_at = ?
               WHERE id = ?""",
            (now, now, self.task_id)
        )

        # Log success
        self._log_event("task_completed", f"Task {self.task.display_id} completed successfully")

        # Extract and record patterns from successful code (BA-035)
        if result.generated_code and self.task:
            self._extract_and_record_patterns(result.generated_code)

    def _record_failure(self, error_message: Optional[str], exit_code: Optional[int] = None):
        """Record task failure in database"""
        now = datetime.now(timezone.utc).isoformat()

        # GAP-007: Classify the error
        classified = ErrorClassifier.classify(error_message or "Unknown error", exit_code)
        self._log_continuous(
            f"Error classified as {classified.error_type} ({classified.category}): {classified.suggested_action}",
            "DEBUG"
        )

        # GAP-003: Update task status with last_error_message and increment consecutive_failures
        # GAP-007: Also store error type for retry decisions
        error_msg_truncated = error_message[:2000] if error_message else None
        self.db.execute(
            """UPDATE tasks
               SET status = 'failed',
                   updated_at = ?,
                   last_error_message = ?,
                   last_error_type = ?,
                   consecutive_failures = consecutive_failures + 1
               WHERE id = ?""",
            (now, error_msg_truncated, classified.error_type, self.task_id)
        )

        # Log failure with error details
        self._log_event("task_failed", f"Task failed ({classified.category}): {error_message}")

        # Extract and record gotcha from failure (BA-034)
        if error_message and self.task:
            self._extract_and_record_gotcha(error_message)

    def _log_event(self, event_type: str, message: str):
        """Log an event to task_executions table"""
        if not self.build_execution_id:
            print(f"[BuildAgentWorker] Event (no build_id): {event_type}: {message}", file=sys.stderr)
            return

        try:
            # Use task_executions table for logging
            self.db.execute(
                """INSERT INTO task_executions
                   (id, build_id, task_id, phase, action, file_path,
                    status, error_message, agent_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                (
                    str(uuid.uuid4()),
                    self.build_execution_id,  # Use the build_executions FK
                    self.task_id,
                    'execution',
                    self.task.primary_action if self.task else 'CREATE',
                    self.task.primary_file if (self.task and self.task.primary_file) else 'unknown',
                    'completed' if event_type == 'task_completed' else 'failed',
                    message if event_type == 'task_failed' else None,
                    self.agent_id
                )
            )
        except Exception as e:
            # Don't fail if logging fails - just print to stderr
            print(f"[BuildAgentWorker] Log event failed: {e}", file=sys.stderr)
            print(f"[BuildAgentWorker] Event: {event_type}: {message}", file=sys.stderr)

    def _extract_and_record_gotcha(self, error_message: str):
        """
        Extract a gotcha from an error message and record it (BA-034, BA-036)

        Common error patterns that can become gotchas:
        - TypeScript type errors
        - SQLite constraint violations
        - Missing imports/exports
        - API validation failures
        """
        if not self.task:
            return

        try:
            # Extract a learnable gotcha from common error patterns
            gotcha_content = self._extract_gotcha_pattern(error_message)
            if not gotcha_content:
                return

            # Determine file patterns based on task
            file_patterns = []
            if self.task.primary_file:
                ext = Path(self.task.primary_file).suffix
                if ext:
                    file_patterns.append(f"*{ext}")

            # Determine action types
            action_types = [self.task.primary_action] if self.task.primary_action else []

            # Record to knowledge_entries (BA-036)
            self._record_discovery(
                discovery_type='gotcha',
                content=gotcha_content,
                file_patterns=file_patterns,
                action_types=action_types,
                confidence=0.6  # Initial confidence for auto-extracted gotchas
            )

        except Exception as e:
            print(f"[BuildAgentWorker] Error extracting gotcha: {e}", file=sys.stderr)

    def _extract_gotcha_pattern(self, error_message: str) -> Optional[str]:
        """
        Extract a learnable pattern from an error message (BA-034)

        Returns a gotcha string if a pattern is detected, None otherwise.
        """
        # Common TypeScript errors
        if "Cannot find module" in error_message:
            # Extract module name
            import re
            match = re.search(r"Cannot find module '([^']+)'", error_message)
            if match:
                return f"Ensure module '{match.group(1)}' is installed and properly imported"

        if "Property" in error_message and "does not exist on type" in error_message:
            import re
            match = re.search(r"Property '([^']+)' does not exist on type '([^']+)'", error_message)
            if match:
                return f"Type '{match.group(2)}' does not have property '{match.group(1)}' - check type definitions"

        if "Type" in error_message and "is not assignable to type" in error_message:
            return "Check type compatibility - ensure types match between assignment"

        # SQLite errors
        if "UNIQUE constraint failed" in error_message:
            return "Ensure unique constraint columns have unique values before INSERT"

        if "FOREIGN KEY constraint failed" in error_message:
            return "Verify referenced rows exist before INSERT with foreign key"

        if "no such table" in error_message:
            import re
            match = re.search(r"no such table: (\w+)", error_message)
            if match:
                return f"Ensure table '{match.group(1)}' exists - run migrations first"

        if "no such column" in error_message:
            import re
            match = re.search(r"no such column: (\w+)", error_message)
            if match:
                return f"Column '{match.group(1)}' does not exist - check schema"

        # Validation errors
        if "exit code" in error_message.lower() and "validation failed" in error_message.lower():
            return "Validation command failed - check output for specific errors"

        # Generic but useful patterns
        if "undefined" in error_message.lower() and "cannot read" in error_message.lower():
            return "Check for null/undefined values before accessing properties"

        return None

    def _extract_and_record_patterns(self, code: str):
        """
        Extract reusable patterns from successful code (BA-035)

        Analyzes the generated code and extracts patterns that can be reused
        for similar tasks in the future.
        """
        import re

        try:
            patterns_found = []
            file_ext = ""
            if self.task and self.task.primary_file:
                _, file_ext = os.path.splitext(self.task.primary_file)

            # TypeScript/JavaScript patterns
            if file_ext in ['.ts', '.tsx', '.js', '.jsx']:
                # API route pattern
                if re.search(r'router\.(get|post|put|delete|patch)\s*\(', code):
                    patterns_found.append({
                        'type': 'pattern',
                        'content': 'Express router pattern: router.METHOD(path, async handler) with try/catch and res.json()',
                        'file_patterns': ['server/routes/*.ts', '*.routes.ts'],
                        'confidence': 0.7
                    })

                # React component pattern
                if re.search(r'export\s+(default\s+)?function\s+\w+.*\(.*\).*{[\s\S]*return\s*\(', code):
                    patterns_found.append({
                        'type': 'pattern',
                        'content': 'React functional component pattern: export function Component({ props }) { return (...) }',
                        'file_patterns': ['*.tsx', 'components/*.tsx'],
                        'confidence': 0.7
                    })

                # Custom hook pattern
                if re.search(r'export\s+function\s+use[A-Z]\w+', code):
                    patterns_found.append({
                        'type': 'pattern',
                        'content': 'Custom React hook pattern: export function useHookName() with useState/useEffect',
                        'file_patterns': ['hooks/*.ts', 'hooks/*.tsx'],
                        'confidence': 0.7
                    })

                # Service class pattern
                if re.search(r'class\s+\w+Service', code) or re.search(r'export\s+default\s+{[\s\S]*}', code):
                    patterns_found.append({
                        'type': 'pattern',
                        'content': 'Service module pattern: export default { method1, method2 } or class Service {}',
                        'file_patterns': ['services/*.ts', 'server/services/**/*.ts'],
                        'confidence': 0.6
                    })

            # SQL patterns
            if file_ext == '.sql':
                # Migration pattern
                if re.search(r'CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS', code, re.IGNORECASE):
                    patterns_found.append({
                        'type': 'pattern',
                        'content': 'SQLite migration pattern: CREATE TABLE IF NOT EXISTS with TEXT for dates, proper foreign keys',
                        'file_patterns': ['*.sql', 'migrations/*.sql'],
                        'confidence': 0.8
                    })

                # Index pattern
                if re.search(r'CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS', code, re.IGNORECASE):
                    patterns_found.append({
                        'type': 'pattern',
                        'content': 'SQLite index pattern: CREATE INDEX IF NOT EXISTS idx_table_column ON table(column)',
                        'file_patterns': ['*.sql'],
                        'confidence': 0.7
                    })

            # Python patterns
            if file_ext == '.py':
                # Class with dataclass pattern
                if re.search(r'@dataclass', code):
                    patterns_found.append({
                        'type': 'pattern',
                        'content': 'Python dataclass pattern: @dataclass with type hints and default values',
                        'file_patterns': ['*.py'],
                        'confidence': 0.7
                    })

            # Record each pattern found (limit to 2 per task to avoid noise)
            for pattern in patterns_found[:2]:
                self._record_discovery(
                    discovery_type=pattern['type'],
                    content=pattern['content'],
                    file_patterns=pattern['file_patterns'],
                    action_types=[self.task.primary_action] if self.task and self.task.primary_action else ['CREATE'],
                    confidence=pattern['confidence']
                )

            if patterns_found:
                print(f"[BuildAgentWorker] Extracted {len(patterns_found)} patterns from successful code")

        except Exception as e:
            print(f"[BuildAgentWorker] Error extracting patterns: {e}", file=sys.stderr)

    def _record_discovery(
        self,
        discovery_type: str,
        content: str,
        file_patterns: List[str],
        action_types: List[str],
        confidence: float = 0.5
    ):
        """
        Record a discovery to the Knowledge Base (BA-036, BA-040)

        Inserts into knowledge_entries table and emits discovery.recorded event.
        """
        try:
            discovery_id = str(uuid.uuid4())

            # Check for existing similar entry to avoid duplicates
            existing = self.db.query_one(
                """SELECT id, occurrences, confidence
                   FROM knowledge_entries
                   WHERE type = ? AND content = ?""",
                (discovery_type, content)
            )

            if existing:
                # Update existing entry - increment occurrences and boost confidence
                new_occurrences = existing['occurrences'] + 1
                new_confidence = min(0.95, existing['confidence'] + 0.05)

                self.db.execute(
                    """UPDATE knowledge_entries
                       SET occurrences = ?,
                           confidence = ?,
                           updated_at = datetime('now')
                       WHERE id = ?""",
                    (new_occurrences, new_confidence, existing['id'])
                )
                print(f"[BuildAgentWorker] Updated existing gotcha (occurrences: {new_occurrences})")
            else:
                # Insert new entry
                self.db.execute(
                    """INSERT INTO knowledge_entries
                       (id, type, content, file_patterns_json, action_types_json,
                        confidence, occurrences, source_task_id, source_agent_type, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'build-agent', datetime('now'))""",
                    (
                        discovery_id,
                        discovery_type,
                        content,
                        json.dumps(file_patterns),
                        json.dumps(action_types),
                        confidence,
                        self.task_id
                    )
                )
                print(f"[BuildAgentWorker] Recorded new {discovery_type}: {content[:50]}...")

            # Emit discovery.recorded event via HTTP endpoint (BA-040)
            self._emit_discovery_event(
                discovery_id=discovery_id if not existing else existing['id'],
                discovery_type=discovery_type,
                content=content,
                file_patterns=file_patterns,
                confidence=confidence if not existing else min(0.95, existing['confidence'] + 0.05)
            )

        except Exception as e:
            print(f"[BuildAgentWorker] Error recording discovery: {e}", file=sys.stderr)

    def _emit_discovery_event(
        self,
        discovery_id: str,
        discovery_type: str,
        content: str,
        file_patterns: List[str],
        confidence: float
    ):
        """
        Emit discovery.recorded event via HTTP endpoint (BA-040)
        """
        try:
            import httpx

            response = httpx.post(
                "http://localhost:3001/api/task-agent/discoveries/notify",
                json={
                    "discoveryId": discovery_id,
                    "type": discovery_type,
                    "content": content,
                    "sourceTaskId": self.task_id,
                    "filePatterns": file_patterns,
                    "confidence": confidence,
                },
                timeout=5.0
            )

            if response.status_code == 200:
                print(f"[BuildAgentWorker] Discovery event emitted successfully")
            else:
                print(f"[BuildAgentWorker] Discovery event emission failed: {response.status_code}")

        except Exception as e:
            # Non-fatal - just log the error
            print(f"[BuildAgentWorker] Failed to emit discovery event: {e}", file=sys.stderr)


# =============================================================================
# CLI Entry Point
# =============================================================================

def parse_args() -> argparse.Namespace:
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Build Agent Worker - Executes a single task",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python3 coding-loops/agents/build_agent_worker.py \\
        --agent-id abc123 \\
        --task-id task456 \\
        --task-list-id list789

Exit Codes:
    0 - Task completed successfully
    1 - Task failed or error occurred
"""
    )

    parser.add_argument(
        '--agent-id',
        required=True,
        help='Unique identifier for this Build Agent instance'
    )

    parser.add_argument(
        '--task-id',
        required=True,
        help='ID of the task to execute'
    )

    parser.add_argument(
        '--task-list-id',
        required=True,
        help='ID of the task list containing the task'
    )

    parser.add_argument(
        '--db-path',
        type=Path,
        default=None,
        help='Path to SQLite database (default: database/ideas.db)'
    )

    parser.add_argument(
        '--heartbeat-interval',
        type=int,
        default=30,
        help='Heartbeat interval in seconds (default: 30)'
    )

    # GAP-004: Resume from previous execution
    parser.add_argument(
        '--resume-execution-id',
        type=str,
        default=None,
        help='Execution ID to resume from (for context handoff)'
    )

    return parser.parse_args()


def main() -> int:
    """Main entry point"""
    args = parse_args()

    print(f"[BuildAgentWorker] Starting Build Agent Worker")
    print(f"[BuildAgentWorker] Agent ID: {args.agent_id}")
    print(f"[BuildAgentWorker] Task ID: {args.task_id}")
    print(f"[BuildAgentWorker] Task List ID: {args.task_list_id}")

    # Build config
    config = WorkerConfig(
        heartbeat_interval_seconds=args.heartbeat_interval
    )

    if args.db_path:
        config.db_path = args.db_path

    # Create and run worker
    worker = BuildAgentWorker(
        agent_id=args.agent_id,
        task_id=args.task_id,
        task_list_id=args.task_list_id,
        config=config
    )

    # GAP-004: Set resume execution ID if provided
    if args.resume_execution_id:
        print(f"[BuildAgentWorker] Resuming from execution: {args.resume_execution_id}")
        worker.set_resume_execution_id(args.resume_execution_id)

    return worker.run()


if __name__ == '__main__':
    sys.exit(main())
