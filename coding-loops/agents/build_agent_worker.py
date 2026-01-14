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
import sqlite3
import subprocess
import sys
import threading
import time
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

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
    db_path: Path = PROJECT_ROOT / "database" / "ideas.db"


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
            self._local.conn = None


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
            print(f"[CodeGenerator] Claude API error: {e}", file=sys.stderr)
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

class BuildAgentWorker:
    """
    Build Agent Worker - Executes a single task

    This is the main worker class that:
    1. Loads task details from the database
    2. Generates code using Claude
    3. Writes the file
    4. Runs validation
    5. Updates task status
    6. Sends heartbeats
    """

    def __init__(
        self,
        agent_id: str,
        task_id: str,
        task_list_id: str,
        config: Optional[WorkerConfig] = None
    ):
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

    def run(self) -> int:
        """
        Execute the task

        Returns:
            0 on success, non-zero on failure
        """
        print(f"[BuildAgentWorker] Starting agent {self.agent_id} for task {self.task_id}")

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

            print(f"[BuildAgentWorker] Loaded task: {self.task.display_id} - {self.task.title}")

            # Load context
            self._update_progress("loading_context", 20)
            conventions = self._load_conventions()
            idea_context = self._load_idea_context()

            # Load relevant gotchas from Knowledge Base (BA-038, BA-039)
            self.gotchas = self._load_gotchas()

            # Generate code
            self._update_progress("generating_code", 40)
            result = self._generate_code(conventions, idea_context)

            if not result.success:
                self._record_failure(result.error_message)
                return 1

            # Create checkpoint before writing (BA-018)
            checkpoint_ref = self._create_checkpoint()

            # Write file
            self._update_progress("writing_file", 60)
            if self.task.primary_file and result.generated_code:
                self._write_file(result.generated_code)

            # Run validation
            self._update_progress("validating", 80)
            validation_result = self._run_validation()

            if not validation_result.success:
                # Rollback to checkpoint on failure (BA-020)
                if checkpoint_ref:
                    self._rollback_to_checkpoint(checkpoint_ref)
                self._record_failure(validation_result.error_message)
                return 1

            # Success!
            self._update_progress("completed", 100)
            self._record_success(result)

            print(f"[BuildAgentWorker] Task {self.task.display_id} completed successfully")
            return 0

        except Exception as e:
            print(f"[BuildAgentWorker] Fatal error: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            self._record_failure(str(e))
            return 1

        finally:
            self._stop_heartbeat()
            self.db.close()

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

    def _update_progress(self, step: str, percent: int):
        """Update progress in heartbeat"""
        if self.heartbeat_thread:
            self.heartbeat_thread.update_progress(step, percent)

    def _load_task(self) -> Optional[TaskDetails]:
        """Load task details from database"""
        # Load core task info
        row = self.db.query_one(
            """SELECT
                t.id, t.display_id, t.title, t.description,
                t.category, t.priority, t.effort,
                t.task_list_id, t.status
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
            primary_action=primary_action
        )

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
        """Generate code for the task"""
        if not self.task:
            return TaskResult(success=False, error_message="No task loaded")

        try:
            # Format gotchas for the prompt (BA-039)
            gotchas_text = self._format_gotchas_for_prompt()
            code = self.code_generator.generate(self.task, conventions, idea_context, gotchas_text)
            return TaskResult(success=True, generated_code=code)
        except Exception as e:
            return TaskResult(success=False, error_message=f"Code generation failed: {e}")

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
        """Run the validation command"""
        if not self.task:
            return TaskResult(success=False, error_message="No task loaded")

        # In simulation mode, skip TypeScript validation as generated code is placeholder
        if self.code_generator.is_simulation_mode:
            print("[BuildAgentWorker] Skipping validation in simulation mode", file=sys.stderr)
            return TaskResult(
                success=True,
                validation_output="Validation skipped (simulation mode - no API key)"
            )

        # Default validation: TypeScript compilation check
        command = "npx tsc --noEmit"
        expected = "exit code 0"

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

            if success:
                return TaskResult(success=True, validation_output=output)
            else:
                return TaskResult(
                    success=False,
                    error_message=f"Validation failed (exit code {result.returncode})",
                    validation_output=output
                )

        except subprocess.TimeoutExpired:
            return TaskResult(success=False, error_message="Validation timed out")
        except Exception as e:
            return TaskResult(success=False, error_message=f"Validation error: {e}")

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

    def _record_failure(self, error_message: Optional[str]):
        """Record task failure in database"""
        now = datetime.now(timezone.utc).isoformat()

        # Update task status (no error_message column in tasks table)
        self.db.execute(
            """UPDATE tasks
               SET status = 'failed',
                   updated_at = ?
               WHERE id = ?""",
            (now, self.task_id)
        )

        # Log failure with error details
        self._log_event("task_failed", f"Task failed: {error_message}")

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

    return worker.run()


if __name__ == '__main__':
    sys.exit(main())
