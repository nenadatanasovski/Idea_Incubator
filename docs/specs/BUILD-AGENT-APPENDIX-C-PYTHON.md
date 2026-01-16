# Build Agent Appendix C: Python Implementation

> **Parent Document:** [BUILD-AGENT-IMPLEMENTATION-PLAN.md](./BUILD-AGENT-IMPLEMENTATION-PLAN.md)

---

## C.1 Build Agent Class

```python
# coding-loops/agents/build_agent.py

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from enum import Enum
import asyncio
import uuid
from datetime import datetime

from shared.message_bus import MessageBus
from shared.knowledge_base import KnowledgeBase
from shared.checkpoint_manager import CheckpointManager
from shared.resource_registry import ResourceRegistry
from shared.git_manager import GitManager


class BuildAgentStatus(Enum):
    INITIALIZING = "initializing"
    RUNNING = "running"
    IDLE = "idle"
    COMPLETED = "completed"
    FAILED = "failed"
    STUCK = "stuck"


@dataclass
class BuildAgentConfig:
    max_retries: int = 3
    heartbeat_interval_ms: int = 30000
    task_timeout_ms: int = 300000
    validation_timeout_ms: int = 120000


@dataclass
class PrimeResult:
    task_list: Dict[str, Any]
    tasks: List[Dict[str, Any]]
    spec_content: Optional[str]
    tasks_content: Optional[str]
    conventions: str
    idea_context: Dict[str, str]
    gotchas: Dict[str, List[Dict[str, Any]]]
    ownership: Dict[str, Optional[str]]
    execution_id: str


@dataclass
class TaskResult:
    task_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    error: Optional[str]
    commit_sha: Optional[str]
    discoveries: List[Dict[str, Any]]


class BuildAgent:
    """
    Build Agent - Executes atomic tasks from task lists.

    Operates within the PIV (Prime, Iterate, Validate) loop pattern.
    Supports parallel execution through wave-based task grouping.
    """

    def __init__(
        self,
        instance_id: str,
        execution_id: str,
        wave_number: int,
        loop_id: str,
        config: Optional[BuildAgentConfig] = None
    ):
        self.instance_id = instance_id
        self.execution_id = execution_id
        self.wave_number = wave_number
        self.loop_id = loop_id
        self.config = config or BuildAgentConfig()
        self.status = BuildAgentStatus.INITIALIZING
        self.current_task_id: Optional[str] = None

        # Shared services
        self.message_bus = MessageBus()
        self.knowledge_base = KnowledgeBase()
        self.checkpoint_manager = CheckpointManager()
        self.resource_registry = ResourceRegistry()
        self.git = GitManager()

        # State tracking
        self.consecutive_failures = 0
        self.discoveries: List[Dict[str, Any]] = []
        self.tasks: List[Dict[str, Any]] = []

    async def run(self, assigned_tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Execute the PIV loop for assigned tasks."""
        try:
            # Publish spawn event
            await self.message_bus.publish("agent.spawned", {
                "instance_id": self.instance_id,
                "execution_id": self.execution_id,
                "wave_number": self.wave_number
            })

            # PRIME: Load context
            self.status = BuildAgentStatus.RUNNING
            context = await self._prime_phase()

            # Start heartbeat
            heartbeat_task = asyncio.create_task(self._heartbeat_loop())

            try:
                # ITERATE: Execute tasks
                results = await self._iterate_phase(context, assigned_tasks)

                # VALIDATE: Run comprehensive tests
                validation = await self._validate_phase(results)

                # Determine final status
                if validation["all_passed"]:
                    self.status = BuildAgentStatus.COMPLETED
                elif self.consecutive_failures >= 3:
                    self.status = BuildAgentStatus.STUCK
                    await self._escalate_to_sia()
                else:
                    self.status = BuildAgentStatus.FAILED

            finally:
                # Stop heartbeat
                heartbeat_task.cancel()

            return {
                "instance_id": self.instance_id,
                "status": self.status.value,
                "results": results,
                "validation": validation,
                "discoveries": self.discoveries
            }

        except Exception as e:
            self.status = BuildAgentStatus.FAILED
            await self._log_error(str(e))
            raise

    async def _prime_phase(self) -> PrimeResult:
        """Load all necessary context for execution."""
        # Implementation in C.2 below
        pass

    async def _iterate_phase(
        self,
        context: PrimeResult,
        tasks: List[Dict[str, Any]]
    ) -> List[TaskResult]:
        """Execute tasks sequentially with checkpoints."""
        # Implementation in C.3 below
        pass

    async def _validate_phase(self, results: List[TaskResult]) -> Dict[str, Any]:
        """Run three-level test framework."""
        # Implementation in C.4 below
        pass

    async def _heartbeat_loop(self):
        """Publish periodic heartbeats."""
        while True:
            await self.message_bus.publish("agent.heartbeat", {
                "instance_id": self.instance_id,
                "status": self.status.value,
                "current_task_id": self.current_task_id,
                "progress_percent": self._calculate_progress()
            })
            await asyncio.sleep(self.config.heartbeat_interval_ms / 1000)

    async def _escalate_to_sia(self):
        """Hand off to SIA after repeated failures."""
        await self.message_bus.publish("build.stuck", {
            "instance_id": self.instance_id,
            "execution_id": self.execution_id,
            "consecutive_failures": self.consecutive_failures,
            "context": await self._gather_failure_context()
        })

    async def _log_error(self, message: str):
        """Log error to execution log."""
        await self._log_event("error", message)

    async def _log_event(self, event_type: str, message: str, context: Optional[Dict] = None):
        """Log event to task_execution_log table."""
        from shared.database import db
        await db.insert("task_execution_log", {
            "execution_id": self.execution_id,
            "task_id": self.current_task_id,
            "instance_id": self.instance_id,
            "event_type": event_type,
            "message": message,
            "context": json.dumps(context) if context else None
        })

    async def _gather_failure_context(self) -> Dict[str, Any]:
        """Gather context for SIA analysis."""
        from shared.database import db

        # Get last 500 log entries for this execution
        logs = await db.query("""
            SELECT * FROM task_execution_log
            WHERE execution_id = ?
            ORDER BY timestamp DESC
            LIMIT 500
        """, [self.execution_id])

        return {
            "task_id": self.current_task_id,
            "error_history": [
                {"timestamp": log["timestamp"], "message": log["message"]}
                for log in logs if log["event_type"] in ("task_failed", "error")
            ],
            "execution_log_tail": "\n".join(
                f"[{log['timestamp']}] {log['event_type']}: {log['message']}"
                for log in reversed(logs[:100])
            )
        }

    def _calculate_progress(self) -> int:
        """Calculate execution progress percentage."""
        if not self.tasks:
            return 0
        completed = sum(1 for t in self.tasks if t.get("status") == "complete")
        return int((completed / len(self.tasks)) * 100)
```

---

## C.2 Prime Phase Implementation

```python
# coding-loops/agents/build_agent.py (continued)

async def _prime_phase(self) -> PrimeResult:
    """Load all necessary context for execution."""
    from shared.database import db
    from shared.file_utils import read_file, file_exists

    # 1. LOAD TASK LIST METADATA
    task_list = await db.query_one(
        "SELECT * FROM task_lists_v2 WHERE id = ?",
        [self.task_list_id]
    )

    # 2. LOAD TASKS FROM LIST (in execution order)
    tasks = await db.query("""
        SELECT t.* FROM tasks t
        JOIN task_list_items tli ON t.id = tli.task_id
        WHERE tli.task_list_id = ?
        AND t.status IN ('pending', 'in_progress')
        ORDER BY tli.position, t.priority DESC
    """, [self.task_list_id])

    self.tasks = tasks

    # 3. LOAD SPEC.MD FILE (if exists)
    base_path = f"users/{task_list['user_slug']}/ideas/{task_list['idea_slug']}"
    spec_path = f"{base_path}/build/spec.md"
    spec_content = await read_file(spec_path) if await file_exists(spec_path) else None

    # 4. LOAD TASKS.MD FILE (if exists)
    tasks_path = f"{base_path}/build/tasks.md"
    tasks_content = await read_file(tasks_path) if await file_exists(tasks_path) else None

    # 5. LOAD CLAUDE.MD (project conventions)
    claude_md = await read_file("CLAUDE.md")
    conventions = self._extract_sections(claude_md, [
        "Database Conventions",
        "API Conventions",
        "Build Agent Workflow"
    ])

    # 6. LOAD IDEA CONTEXT (for understanding)
    idea_context = {
        'readme': await read_file(f"{base_path}/README.md") or "",
        'problem_solution': await read_file(f"{base_path}/problem-solution.md") or "",
        'target_users': await read_file(f"{base_path}/target-users.md") or "",
    }

    # 7. QUERY KNOWLEDGE BASE FOR GOTCHAS
    file_patterns = set(task['file'] for task in tasks if task.get('file'))
    gotchas = {}

    for pattern in file_patterns:
        gotchas[pattern] = await self.knowledge_base.query(
            item_type='gotcha',
            file_pattern=self._get_pattern(pattern),
            min_confidence=0.6
        )

    # 8. CHECK RESOURCE OWNERSHIP
    ownership = {}
    for task in tasks:
        if not task.get('file'):
            continue
        owner = await self.resource_registry.get_owner(task['file'])
        ownership[task['file']] = owner

        if owner and owner != self.loop_id:
            task['requires_coordination'] = True

    # 9. LOG PRIME COMPLETION
    await self._log_event("info", f"Prime phase complete. Loaded {len(tasks)} tasks.")

    return PrimeResult(
        task_list=task_list,
        tasks=tasks,
        spec_content=spec_content,
        tasks_content=tasks_content,
        conventions=conventions,
        idea_context=idea_context,
        gotchas=gotchas,
        ownership=ownership,
        execution_id=self.execution_id
    )

def _extract_sections(self, content: str, section_names: List[str]) -> str:
    """Extract specific sections from CLAUDE.md."""
    extracted = []
    lines = content.split('\n')
    current_section = None
    capture = False

    for line in lines:
        if line.startswith('## '):
            section_name = line[3:].strip()
            capture = any(name in section_name for name in section_names)
            if capture:
                current_section = section_name
                extracted.append(f"## {current_section}\n")
        elif capture:
            if line.startswith('## '):
                capture = False
            else:
                extracted.append(line)

    return '\n'.join(extracted)

def _get_pattern(self, file_path: str) -> str:
    """Convert file path to pattern for gotcha matching."""
    # "database/migrations/001_habits.sql" -> "*.sql"
    # "server/routes/habits.ts" -> "server/routes/*"
    if '.' in file_path:
        ext = file_path.split('.')[-1]
        return f"*.{ext}"
    return file_path
```

---

## C.3 Iterate Phase Implementation

```python
# coding-loops/agents/build_agent.py (continued)

async def _iterate_phase(
    self,
    context: PrimeResult,
    tasks: List[Dict[str, Any]]
) -> List[TaskResult]:
    """Execute tasks sequentially with checkpoints."""
    results = []

    for task in tasks:
        self.current_task_id = task['id']

        # Check if we can execute this task
        can_execute, reason = await self._can_execute_task(task)
        if not can_execute:
            await self._log_event("task_skipped", f"Skipped: {reason}", {"task_id": task['id']})
            results.append(TaskResult(
                task_id=task['id'],
                status='skipped',
                started_at=datetime.now(),
                completed_at=datetime.now(),
                error=reason,
                commit_sha=None,
                discoveries=[]
            ))
            continue

        # Load task-specific gotchas
        gotchas = context.gotchas.get(task.get('file', ''), [])

        # Acquire file lock
        lock = await self.message_bus.acquire_lock(task.get('file'), self.instance_id)
        if not lock:
            await self._log_event("task_skipped", "Could not acquire file lock")
            continue

        try:
            # Create checkpoint
            checkpoint_id = await self.checkpoint_manager.create(
                execution_id=self.execution_id,
                task_id=task['id'],
                instance_id=self.instance_id
            )

            await self._log_event("checkpoint_created", f"Checkpoint: {checkpoint_id}")

            # Execute the task
            result = await self._execute_single_task(task, gotchas, context)

            # Run validation
            if task.get('validation'):
                validation_result = await self._run_validation(task['validation'])

                if validation_result['success']:
                    # Task succeeded
                    await self._log_event("task_completed", f"Task completed: {task['id']}")

                    # Extract and record discoveries
                    discoveries = await self._extract_discoveries(task, validation_result)
                    for discovery in discoveries:
                        await self.knowledge_base.record(discovery)
                        await self._log_event("discovery_recorded", discovery['content'])

                    self.discoveries.extend(discoveries)
                    self.consecutive_failures = 0

                    # Commit changes
                    commit_sha = await self.git.commit(
                        message=f"Task {task['id']}: {task.get('title', 'Complete')}",
                        files=[task['file']] if task.get('file') else None
                    )

                    results.append(TaskResult(
                        task_id=task['id'],
                        status='complete',
                        started_at=result['started_at'],
                        completed_at=datetime.now(),
                        error=None,
                        commit_sha=commit_sha,
                        discoveries=discoveries
                    ))

                else:
                    # Validation failed - rollback
                    await self.checkpoint_manager.restore(checkpoint_id)
                    await self._log_event("checkpoint_restored", f"Rolled back to {checkpoint_id}")

                    self.consecutive_failures += 1

                    # Decide how to handle failure
                    decision = await self._handle_task_failure(task, validation_result['error'])

                    if decision['action'] == 'RETRY' and task.get('attempts', 0) < self.config.max_retries:
                        task['attempts'] = task.get('attempts', 0) + 1
                        # Re-add to queue for retry
                    else:
                        results.append(TaskResult(
                            task_id=task['id'],
                            status='failed',
                            started_at=result['started_at'],
                            completed_at=datetime.now(),
                            error=validation_result['error'],
                            commit_sha=None,
                            discoveries=[]
                        ))

        finally:
            # Release file lock
            await self.message_bus.release_lock(task.get('file'), self.instance_id)

        # Check if we should continue
        should_continue, reason = await self._should_continue()
        if not should_continue:
            await self._log_event("info", f"Stopping execution: {reason}")
            break

    self.current_task_id = None
    return results

async def _can_execute_task(self, task: Dict[str, Any]) -> tuple[bool, str]:
    """Check if task can be executed."""
    from shared.database import db

    # Check 1: Dependencies complete?
    if task.get('depends_on'):
        for dep_id in task['depends_on']:
            dep_task = await db.query_one(
                "SELECT status FROM tasks WHERE id = ?",
                [dep_id]
            )
            if dep_task and dep_task['status'] not in ('completed', 'skipped'):
                return False, f"Blocked by {dep_id}"

    # Check 2: File ownership allowed?
    if task.get('file'):
        owner = await self.resource_registry.get_owner(task['file'])
        if owner and owner != self.loop_id:
            return False, f"Owned by {owner}"

        # Check 3: File not locked by another agent?
        lock = await self.message_bus.check_lock(task['file'])
        if lock and lock['locked_by'] != self.instance_id:
            return False, f"Locked by {lock['locked_by']}"

    return True, "Ready"

async def _should_continue(self) -> tuple[bool, str]:
    """Check if execution should continue."""
    # Check 1: Too many failures?
    failed_tasks = [t for t in self.tasks if t.get('status') == 'failed']
    if len(failed_tasks) > 3:
        return False, "Too many failures (>3)"

    # Check 2: Critical task failed?
    critical_failed = any(
        t.get('phase') == 'database' and t.get('status') == 'failed'
        for t in self.tasks
    )
    if critical_failed:
        return False, "Critical database task failed"

    # Check 3: Received stop signal?
    if await self.message_bus.has_event('build.stop', self.execution_id):
        return False, "Stop signal received"

    return True, "Continue"
```

---

## C.4 Validate Phase Implementation

```python
# coding-loops/agents/build_agent.py (continued)

async def _validate_phase(self, results: List[TaskResult]) -> Dict[str, Any]:
    """Run three-level test framework."""
    validation_results = []
    all_passed = True

    # Level 1: Codebase tests (always run)
    await self._log_event("validation_run", "Running codebase validation")
    codebase_result = await self._run_codebase_tests()
    validation_results.append(codebase_result)

    if not codebase_result['passed']:
        all_passed = False
        # Stop early on compilation failures
        return {
            "all_passed": False,
            "results": validation_results,
            "failed_at": "codebase"
        }

    # Determine what was changed
    has_backend_changes = any(
        'server/' in r.discoveries[0]['file_pattern']
        for r in results
        if r.discoveries
    )

    has_frontend_changes = any(
        'frontend/' in r.discoveries[0]['file_pattern']
        for r in results
        if r.discoveries
    )

    # Level 2: API tests (if backend files modified)
    if has_backend_changes:
        await self._log_event("validation_run", "Running API tests")
        api_result = await self._run_api_tests()
        validation_results.append(api_result)
        if not api_result['passed']:
            all_passed = False

    # Level 3: UI tests (if frontend files modified)
    if has_frontend_changes:
        await self._log_event("validation_run", "Running UI tests")
        ui_result = await self._run_ui_tests()
        validation_results.append(ui_result)
        if not ui_result['passed']:
            all_passed = False

    return {
        "all_passed": all_passed,
        "results": validation_results,
        "failed_at": None if all_passed else validation_results[-1]['level']
    }

async def _run_codebase_tests(self) -> Dict[str, Any]:
    """Run TypeScript compilation and linting."""
    import subprocess

    start = datetime.now()

    try:
        # TypeScript compilation
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            capture_output=True,
            text=True,
            timeout=self.config.validation_timeout_ms / 1000
        )

        passed = result.returncode == 0
        output = result.stdout + result.stderr

        return {
            "level": "codebase",
            "passed": passed,
            "output": output,
            "failed_tests": self._parse_tsc_errors(output) if not passed else [],
            "duration": (datetime.now() - start).total_seconds()
        }

    except subprocess.TimeoutExpired:
        return {
            "level": "codebase",
            "passed": False,
            "output": "TypeScript compilation timed out",
            "failed_tests": ["timeout"],
            "duration": self.config.validation_timeout_ms / 1000
        }

async def _run_api_tests(self) -> Dict[str, Any]:
    """Run API integration tests."""
    import subprocess

    start = datetime.now()

    try:
        result = subprocess.run(
            ["npm", "test", "--", "--grep", "api"],
            capture_output=True,
            text=True,
            timeout=self.config.validation_timeout_ms / 1000
        )

        passed = result.returncode == 0
        output = result.stdout + result.stderr

        return {
            "level": "api",
            "passed": passed,
            "output": output,
            "failed_tests": self._parse_test_failures(output) if not passed else [],
            "duration": (datetime.now() - start).total_seconds()
        }

    except subprocess.TimeoutExpired:
        return {
            "level": "api",
            "passed": False,
            "output": "API tests timed out",
            "failed_tests": ["timeout"],
            "duration": self.config.validation_timeout_ms / 1000
        }

async def _run_ui_tests(self) -> Dict[str, Any]:
    """Run UI component tests."""
    import subprocess

    start = datetime.now()

    try:
        result = subprocess.run(
            ["npm", "test", "--", "--grep", "ui|component"],
            capture_output=True,
            text=True,
            timeout=self.config.validation_timeout_ms / 1000
        )

        passed = result.returncode == 0
        output = result.stdout + result.stderr

        return {
            "level": "ui",
            "passed": passed,
            "output": output,
            "failed_tests": self._parse_test_failures(output) if not passed else [],
            "duration": (datetime.now() - start).total_seconds()
        }

    except subprocess.TimeoutExpired:
        return {
            "level": "ui",
            "passed": False,
            "output": "UI tests timed out",
            "failed_tests": ["timeout"],
            "duration": self.config.validation_timeout_ms / 1000
        }

def _parse_tsc_errors(self, output: str) -> List[str]:
    """Parse TypeScript compilation errors."""
    errors = []
    for line in output.split('\n'):
        if 'error TS' in line:
            errors.append(line.strip())
    return errors

def _parse_test_failures(self, output: str) -> List[str]:
    """Parse test failure messages."""
    failures = []
    capture_next = False
    for line in output.split('\n'):
        if 'FAIL' in line or 'failing' in line.lower():
            capture_next = True
        elif capture_next and line.strip():
            failures.append(line.strip())
            capture_next = False
    return failures
```

---

## C.5 Claude Prompt Construction

```python
# coding-loops/agents/build_agent.py (continued)

def build_task_prompt(
    self,
    task: Dict[str, Any],
    context: PrimeResult
) -> str:
    """Build Claude prompt for task execution."""

    gotchas = context.gotchas.get(task.get('file', ''), [])
    gotcha_text = '\n'.join(f'- {g["content"]}' for g in gotchas)

    requirements_text = '\n'.join(f'- {r}' for r in task.get('requirements', []))

    prompt = f"""
# BUILD TASK: {task.get('id', 'unknown')}

## Action
{task.get('action', 'CREATE')} file: {task.get('file', 'unknown')}

## Requirements
{requirements_text}

## Gotchas (AVOID THESE MISTAKES)
{gotcha_text if gotcha_text else '- No known gotchas for this file type'}

## Project Conventions (from CLAUDE.md)
{context.conventions}

## Code Template (use as starting point)
```

{task.get('code_template', '# No template provided')}

```

## Context: What This Idea Is About
{context.idea_context.get('readme', 'No context available')[:500]}

## Validation
After generating the code, it will be validated with:
```

{task.get('validation', {}).get('command', 'npx tsc --noEmit')}

```
Expected result: {task.get('validation', {}).get('expected', 'exit code 0')}

## Instructions
1. Generate ONLY the file content - no explanations
2. Follow all gotchas strictly
3. Use the code template as guidance
4. Ensure the validation command will pass
5. Include appropriate error handling
"""

    return prompt
```

---

## C.6 Execution Isolation

```python
# coding-loops/agents/build_agent.py (continued)

class ExecutionIsolation:
    """
    EXECUTION LANE ISOLATION

    Each Build Agent session is isolated by execution_id. This enables:
    1. Parallel builds without interference
    2. Clean rollback per execution
    3. Accurate attribution in logs
    4. Session-specific context loading
    """

    def __init__(self, execution_id: str, loop_id: str):
        self.execution_id = execution_id
        self.loop_id = loop_id

    async def load_tasks_for_execution(self, task_list_id: str) -> List[Dict]:
        """Load tasks scoped to this execution lane."""
        from shared.database import db

        return await db.query("""
            SELECT t.* FROM tasks t
            JOIN task_list_items tli ON t.id = tli.task_id
            WHERE tli.task_list_id = ?
            AND (t.assigned_execution_id IS NULL
                 OR t.assigned_execution_id = ?)
            ORDER BY tli.position
        """, [task_list_id, self.execution_id])

    async def log_task_attempt(self, task_id: str, result: TaskResult):
        """Log attempt to execution-specific lane."""
        from shared.database import db

        await db.insert("task_execution_log", {
            'task_id': task_id,
            'execution_id': self.execution_id,
            'loop_id': self.loop_id,
            'event_type': 'task_completed' if result.status == 'complete' else 'task_failed',
            'message': f"Task {result.status}",
            'context': json.dumps({
                'started_at': result.started_at.isoformat(),
                'completed_at': result.completed_at.isoformat() if result.completed_at else None,
                'error': result.error,
                'commit_sha': result.commit_sha
            })
        })

    async def get_handoff_context(self) -> str:
        """Get execution log for SIA or retry context."""
        from shared.database import db

        logs = await db.query("""
            SELECT tel.*, t.title, t.file as file_path
            FROM task_execution_log tel
            LEFT JOIN tasks t ON tel.task_id = t.id
            WHERE tel.execution_id = ?
            ORDER BY tel.timestamp DESC
            LIMIT 500
        """, [self.execution_id])

        return self._format_execution_log(logs)

    async def rollback_execution(self, checkpoint_id: str):
        """Rollback only changes made in this execution lane."""
        from shared.database import db

        checkpoint = await db.query_one(
            "SELECT * FROM checkpoints WHERE id = ? AND execution_id = ?",
            [checkpoint_id, self.execution_id]
        )

        if not checkpoint:
            raise ValueError(f"Checkpoint not in execution lane: {checkpoint_id}")

        from shared.git_manager import GitManager
        git = GitManager()
        await git.reset_to(checkpoint['git_ref'])

    def _format_execution_log(self, logs: List[Dict]) -> str:
        """Format logs for handoff context."""
        lines = []
        for log in reversed(logs):
            timestamp = log['timestamp']
            event = log['event_type']
            message = log['message']
            task_title = log.get('title', 'N/A')
            lines.append(f"[{timestamp}] {event}: {task_title} - {message}")
        return '\n'.join(lines)
```
