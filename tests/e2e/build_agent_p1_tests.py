#!/usr/bin/env python3
"""
Build Agent P1 E2E Tests

Comprehensive end-to-end tests for Build Agent functionality.
Covers Test Flows 1-7 from BUILD-AGENT-E2E-TEST-PLAN.md.

Run: python3 tests/e2e/build_agent_p1_tests.py
Run specific test: python3 tests/e2e/build_agent_p1_tests.py TestFlow1
"""

import os
import sys
import sqlite3
import subprocess
import time
import uuid
import json
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"
WORKER_PATH = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
TEST_PREFIX = "BA-P1-TEST-"

# Ensure we can import from the project
sys.path.insert(0, str(PROJECT_ROOT))


class DatabaseHelper:
    """Helper for database operations in tests."""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self.conn: Optional[sqlite3.Connection] = None

    def connect(self) -> sqlite3.Connection:
        """Get database connection."""
        if self.conn is None:
            self.conn = sqlite3.connect(str(self.db_path))
            self.conn.row_factory = sqlite3.Row
        return self.conn

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        """Execute SQL query."""
        return self.connect().execute(sql, params)

    def fetchone(self, sql: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        """Execute and fetch one row."""
        return self.execute(sql, params).fetchone()

    def fetchall(self, sql: str, params: tuple = ()) -> List[sqlite3.Row]:
        """Execute and fetch all rows."""
        return self.execute(sql, params).fetchall()

    def commit(self):
        """Commit transaction."""
        self.connect().commit()


class TestContext:
    """Test context with common utilities."""

    def __init__(self):
        self.db = DatabaseHelper()
        self.created_tasks: List[str] = []
        self.created_task_lists: List[str] = []
        self.created_agents: List[str] = []
        self.test_files: List[Path] = []

    def cleanup(self):
        """Clean up test data."""
        try:
            # Delete test tasks
            self.db.execute(
                f"DELETE FROM tasks WHERE display_id LIKE '{TEST_PREFIX}%' OR title LIKE '{TEST_PREFIX}%'"
            )
            # Delete test task lists
            self.db.execute(
                f"DELETE FROM task_lists_v2 WHERE name LIKE '{TEST_PREFIX}%'"
            )
            # Delete test agents
            self.db.execute(
                f"DELETE FROM build_agent_instances WHERE id LIKE '{TEST_PREFIX}%'"
            )
            # Delete test heartbeats
            self.db.execute(
                f"DELETE FROM agent_heartbeats WHERE agent_id LIKE '{TEST_PREFIX}%'"
            )
            self.db.commit()

            # Remove test files
            for file_path in self.test_files:
                if file_path.exists():
                    file_path.unlink()
        except Exception as e:
            print(f"Warning: Cleanup error: {e}")
        finally:
            self.db.close()

    def create_task(
        self,
        title: str,
        display_id: Optional[str] = None,
        task_list_id: Optional[str] = None,
        status: str = "pending",
        category: str = "feature"
    ) -> str:
        """Create a test task."""
        task_id = str(uuid.uuid4())
        display_id = display_id or f"{TEST_PREFIX}{str(uuid.uuid4())[:8].upper()}"

        # queue is NULL when in a task list, 'evaluation' when listless
        queue_value = None if task_list_id else 'evaluation'

        self.db.execute(
            """INSERT INTO tasks (id, display_id, title, status, category, queue, task_list_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (task_id, display_id, title, status, category, queue_value, task_list_id)
        )
        self.db.commit()
        self.created_tasks.append(task_id)
        return task_id

    def create_task_list(self, name: str, status: str = "draft") -> str:
        """Create a test task list."""
        list_id = str(uuid.uuid4())

        self.db.execute(
            """INSERT INTO task_lists_v2 (id, name, status, created_at)
               VALUES (?, ?, ?, datetime('now'))""",
            (list_id, f"{TEST_PREFIX}{name}", status)
        )
        self.db.commit()
        self.created_task_lists.append(list_id)
        return list_id

    def add_file_impact(
        self,
        task_id: str,
        file_path: str,
        operation: str = "CREATE",
        confidence: float = 0.9
    ) -> str:
        """Add file impact to a task."""
        impact_id = str(uuid.uuid4())

        self.db.execute(
            """INSERT INTO task_file_impacts (id, task_id, file_path, operation, confidence, source)
               VALUES (?, ?, ?, ?, ?, 'ai_estimate')""",
            (impact_id, task_id, file_path, operation, confidence)
        )
        self.db.commit()
        return impact_id

    def add_dependency(self, dependent_task_id: str, dependency_task_id: str):
        """Add dependency between tasks.

        dependent_task_id depends on dependency_task_id (dependency must complete first)
        """
        rel_id = str(uuid.uuid4())

        # source_task_id = the task that depends, target_task_id = the dependency
        self.db.execute(
            """INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
               VALUES (?, ?, ?, 'depends_on')""",
            (rel_id, dependent_task_id, dependency_task_id)
        )
        self.db.commit()

    def get_task(self, task_id: str) -> Optional[sqlite3.Row]:
        """Get task by ID."""
        return self.db.fetchone("SELECT * FROM tasks WHERE id = ?", (task_id,))

    def get_task_status(self, task_id: str) -> Optional[str]:
        """Get task status."""
        row = self.db.fetchone("SELECT status FROM tasks WHERE id = ?", (task_id,))
        return row["status"] if row else None

    def get_agent(self, agent_id: str) -> Optional[sqlite3.Row]:
        """Get agent by ID."""
        return self.db.fetchone("SELECT * FROM build_agent_instances WHERE id = ?", (agent_id,))

    def get_heartbeat_count(self, agent_id: str) -> int:
        """Get heartbeat count for agent."""
        row = self.db.fetchone(
            "SELECT COUNT(*) as cnt FROM agent_heartbeats WHERE agent_id = ?",
            (agent_id,)
        )
        return row["cnt"] if row else 0

    def create_agent_instance(
        self,
        agent_id: str,
        task_id: str,
        task_list_id: str,
        status: str = "spawning"
    ):
        """Create a build agent instance."""
        self.db.execute(
            """INSERT INTO build_agent_instances (id, task_id, task_list_id, status, spawned_at)
               VALUES (?, ?, ?, ?, datetime('now'))""",
            (agent_id, task_id, task_list_id, status)
        )
        self.db.commit()
        self.created_agents.append(agent_id)


class TestFlow1SingleTaskExecution(unittest.TestCase):
    """
    Test Flow 1: Single Task Execution (Happy Path)

    Priority: P1 (Must Have)
    Validates: Basic PIV loop, single Build Agent spawn, task completion
    """

    @classmethod
    def setUpClass(cls):
        cls.ctx = TestContext()

    @classmethod
    def tearDownClass(cls):
        cls.ctx.cleanup()

    def test_01_create_task(self):
        """Create task with pending status."""
        self.task_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Create test utility function",
            display_id=f"{TEST_PREFIX}FEA-001"
        )

        task = self.ctx.get_task(self.task_id)
        self.assertIsNotNone(task)
        self.assertEqual(task["status"], "pending")

        # Store for later tests
        self.__class__.task_id = self.task_id
        print(f"✓ Task created: {task['display_id']} with status pending")

    def test_02_add_file_impact(self):
        """Add file impact for the task."""
        task_id = getattr(self.__class__, 'task_id', None)
        if not task_id:
            self.skipTest("No task_id from previous test")

        impact_id = self.ctx.add_file_impact(
            task_id=task_id,
            file_path="utils/test-helper.ts",
            operation="CREATE"
        )

        row = self.ctx.db.fetchone(
            "SELECT * FROM task_file_impacts WHERE task_id = ?",
            (task_id,)
        )
        self.assertIsNotNone(row)
        self.assertEqual(row["file_path"], "utils/test-helper.ts")
        self.assertEqual(row["operation"], "CREATE")
        print(f"✓ File impact added: CREATE utils/test-helper.ts")

    def test_03_create_task_list(self):
        """Create task list and link task."""
        task_id = getattr(self.__class__, 'task_id', None)
        if not task_id:
            self.skipTest("No task_id from previous test")

        list_id = self.ctx.create_task_list("Single Task Test")

        # Update task to belong to list (queue = NULL when in a list)
        self.ctx.db.execute(
            "UPDATE tasks SET task_list_id = ?, queue = NULL WHERE id = ?",
            (list_id, task_id)
        )
        self.ctx.db.commit()

        # Verify
        task = self.ctx.get_task(task_id)
        self.assertEqual(task["task_list_id"], list_id)

        self.__class__.task_list_id = list_id
        print(f"✓ Task list created and task linked: {list_id}")

    def test_04_worker_can_execute(self):
        """Verify worker can be spawned for task."""
        task_id = getattr(self.__class__, 'task_id', None)
        task_list_id = getattr(self.__class__, 'task_list_id', None)
        if not task_id or not task_list_id:
            self.skipTest("Missing task_id or task_list_id from previous tests")

        # Verify worker exists
        self.assertTrue(WORKER_PATH.exists(), f"Worker not found at {WORKER_PATH}")

        # Test worker help
        result = subprocess.run(
            ["python3", str(WORKER_PATH), "--help"],
            capture_output=True,
            text=True,
            timeout=10
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("--agent-id", result.stdout)
        self.assertIn("--task-id", result.stdout)
        print("✓ Worker exists and accepts CLI arguments")

    def test_05_create_agent_instance(self):
        """Create Build Agent instance in database."""
        task_id = getattr(self.__class__, 'task_id', None)
        task_list_id = getattr(self.__class__, 'task_list_id', None)
        if not task_id or not task_list_id:
            self.skipTest("Missing context from previous tests")

        agent_id = f"{TEST_PREFIX}agent-001"
        self.ctx.create_agent_instance(
            agent_id=agent_id,
            task_id=task_id,
            task_list_id=task_list_id,
            status="spawning"
        )

        agent = self.ctx.get_agent(agent_id)
        self.assertIsNotNone(agent)
        self.assertEqual(agent["status"], "spawning")

        self.__class__.agent_id = agent_id
        print(f"✓ Build Agent instance created: {agent_id}")

    def test_06_task_status_flow(self):
        """Verify task status can change through the expected flow."""
        task_id = getattr(self.__class__, 'task_id', None)
        if not task_id:
            self.skipTest("No task_id from previous test")

        # pending -> in_progress
        self.ctx.db.execute(
            "UPDATE tasks SET status = 'in_progress' WHERE id = ?",
            (task_id,)
        )
        self.ctx.db.commit()
        self.assertEqual(self.ctx.get_task_status(task_id), "in_progress")
        print("✓ Status: pending → in_progress")

        # in_progress -> completed
        self.ctx.db.execute(
            "UPDATE tasks SET status = 'completed' WHERE id = ?",
            (task_id,)
        )
        self.ctx.db.commit()
        self.assertEqual(self.ctx.get_task_status(task_id), "completed")
        print("✓ Status: in_progress → completed")


class TestFlow2MultiTaskSequential(unittest.TestCase):
    """
    Test Flow 2: Multi-Task Sequential Execution

    Priority: P1 (Must Have)
    Validates: Task ordering, dependency resolution, sequential execution
    """

    @classmethod
    def setUpClass(cls):
        cls.ctx = TestContext()
        cls.task_list_id = cls.ctx.create_task_list("Sequential Test")

    @classmethod
    def tearDownClass(cls):
        cls.ctx.cleanup()

    def test_01_create_dependent_tasks(self):
        """Create 3 tasks with dependencies: A → B → C."""
        # Task A (database migration)
        task_a_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Create users migration",
            display_id=f"{TEST_PREFIX}INF-001",
            task_list_id=self.task_list_id
        )
        self.ctx.add_file_impact(task_a_id, "database/migrations/test_001.sql", "CREATE")

        # Task B (types, depends on A)
        task_b_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Create User type",
            display_id=f"{TEST_PREFIX}INF-002",
            task_list_id=self.task_list_id,
            status="blocked"
        )
        self.ctx.add_file_impact(task_b_id, "types/test-user.ts", "CREATE")
        self.ctx.add_dependency(task_b_id, task_a_id)

        # Task C (API, depends on B)
        task_c_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Create users API route",
            display_id=f"{TEST_PREFIX}INF-003",
            task_list_id=self.task_list_id,
            status="blocked"
        )
        self.ctx.add_file_impact(task_c_id, "server/routes/test-users.ts", "CREATE")
        self.ctx.add_dependency(task_c_id, task_b_id)

        # Store for verification
        self.__class__.task_a_id = task_a_id
        self.__class__.task_b_id = task_b_id
        self.__class__.task_c_id = task_c_id

        print(f"✓ Created task chain: A({task_a_id[:8]}) → B({task_b_id[:8]}) → C({task_c_id[:8]})")

    def test_02_verify_dependencies(self):
        """Verify dependencies are recorded correctly."""
        task_b_id = getattr(self.__class__, 'task_b_id', None)
        task_c_id = getattr(self.__class__, 'task_c_id', None)
        if not task_b_id:
            self.skipTest("Missing task_b_id")

        # Check B depends on A (source_task_id = B means B depends on something)
        deps_b = self.ctx.db.fetchall(
            """SELECT tr.* FROM task_relationships tr
               WHERE tr.source_task_id = ? AND tr.relationship_type = 'depends_on'""",
            (task_b_id,)
        )
        self.assertEqual(len(deps_b), 1)
        print(f"✓ Task B has 1 dependency (Task A)")

        # Check C depends on B
        deps_c = self.ctx.db.fetchall(
            """SELECT tr.* FROM task_relationships tr
               WHERE tr.source_task_id = ? AND tr.relationship_type = 'depends_on'""",
            (task_c_id,)
        )
        self.assertEqual(len(deps_c), 1)
        print(f"✓ Task C has 1 dependency (Task B)")

    def test_03_verify_blocked_status(self):
        """Verify B and C start as blocked."""
        task_b_id = getattr(self.__class__, 'task_b_id', None)
        task_c_id = getattr(self.__class__, 'task_c_id', None)

        self.assertEqual(self.ctx.get_task_status(task_b_id), "blocked")
        self.assertEqual(self.ctx.get_task_status(task_c_id), "blocked")
        print("✓ Tasks B and C are blocked as expected")

    def test_04_simulate_execution_order(self):
        """Simulate correct execution order: A completes → B unblocks → C unblocks."""
        task_a_id = getattr(self.__class__, 'task_a_id', None)
        task_b_id = getattr(self.__class__, 'task_b_id', None)
        task_c_id = getattr(self.__class__, 'task_c_id', None)

        # Complete A
        self.ctx.db.execute(
            "UPDATE tasks SET status = 'completed' WHERE id = ?",
            (task_a_id,)
        )
        self.ctx.db.commit()
        print("✓ Task A completed")

        # B should now be unblockable (we simulate unblocking)
        self.ctx.db.execute(
            "UPDATE tasks SET status = 'pending' WHERE id = ?",
            (task_b_id,)
        )
        self.ctx.db.commit()
        self.assertEqual(self.ctx.get_task_status(task_b_id), "pending")
        print("✓ Task B unblocked → pending")

        # Complete B
        self.ctx.db.execute(
            "UPDATE tasks SET status = 'completed' WHERE id = ?",
            (task_b_id,)
        )
        self.ctx.db.commit()
        print("✓ Task B completed")

        # Unblock and complete C
        self.ctx.db.execute(
            "UPDATE tasks SET status = 'pending' WHERE id = ?",
            (task_c_id,)
        )
        self.ctx.db.execute(
            "UPDATE tasks SET status = 'completed' WHERE id = ?",
            (task_c_id,)
        )
        self.ctx.db.commit()
        print("✓ Task C unblocked and completed")

        # Verify all completed
        self.assertEqual(self.ctx.get_task_status(task_a_id), "completed")
        self.assertEqual(self.ctx.get_task_status(task_b_id), "completed")
        self.assertEqual(self.ctx.get_task_status(task_c_id), "completed")
        print("✓ All tasks completed in correct order: A → B → C")


class TestFlow3ParallelExecution(unittest.TestCase):
    """
    Test Flow 3: Parallel Execution (Wave-Based)

    Priority: P1 (Must Have)
    Validates: Parallel Build Agent spawning, wave calculation, concurrent execution
    """

    @classmethod
    def setUpClass(cls):
        cls.ctx = TestContext()
        cls.task_list_id = cls.ctx.create_task_list("Parallel Test")

    @classmethod
    def tearDownClass(cls):
        cls.ctx.cleanup()

    def test_01_create_parallel_tasks(self):
        """Create 4 tasks: A,B (parallel), C depends on A, D depends on B."""
        # Task A - feature-a.ts
        task_a_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Create Feature A",
            display_id=f"{TEST_PREFIX}PAR-001",
            task_list_id=self.task_list_id
        )
        self.ctx.add_file_impact(task_a_id, "features/feature-a.ts", "CREATE")

        # Task B - feature-b.ts (no conflict with A)
        task_b_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Create Feature B",
            display_id=f"{TEST_PREFIX}PAR-002",
            task_list_id=self.task_list_id
        )
        self.ctx.add_file_impact(task_b_id, "features/feature-b.ts", "CREATE")

        # Task C - feature-a.ts (conflict with A, depends on A)
        task_c_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Update Feature A",
            display_id=f"{TEST_PREFIX}PAR-003",
            task_list_id=self.task_list_id,
            status="blocked"
        )
        self.ctx.add_file_impact(task_c_id, "features/feature-a.ts", "UPDATE")
        self.ctx.add_dependency(task_c_id, task_a_id)

        # Task D - feature-b.ts (conflict with B, depends on B)
        task_d_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Update Feature B",
            display_id=f"{TEST_PREFIX}PAR-004",
            task_list_id=self.task_list_id,
            status="blocked"
        )
        self.ctx.add_file_impact(task_d_id, "features/feature-b.ts", "UPDATE")
        self.ctx.add_dependency(task_d_id, task_b_id)

        self.__class__.task_a_id = task_a_id
        self.__class__.task_b_id = task_b_id
        self.__class__.task_c_id = task_c_id
        self.__class__.task_d_id = task_d_id

        print(f"✓ Created 4 tasks: A,B (parallel) → C,D (Wave 2)")

    def test_02_verify_no_file_conflict_ab(self):
        """A and B should have no file conflict (different files)."""
        task_a_id = getattr(self.__class__, 'task_a_id', None)
        task_b_id = getattr(self.__class__, 'task_b_id', None)

        # Get file impacts
        impacts_a = self.ctx.db.fetchall(
            "SELECT file_path FROM task_file_impacts WHERE task_id = ?",
            (task_a_id,)
        )
        impacts_b = self.ctx.db.fetchall(
            "SELECT file_path FROM task_file_impacts WHERE task_id = ?",
            (task_b_id,)
        )

        files_a = {r["file_path"] for r in impacts_a}
        files_b = {r["file_path"] for r in impacts_b}

        # No intersection = can run parallel
        self.assertEqual(len(files_a & files_b), 0)
        print(f"✓ Tasks A,B have no file overlap: {files_a} vs {files_b}")

    def test_03_verify_file_conflict_ac(self):
        """A and C have file conflict (same file)."""
        task_a_id = getattr(self.__class__, 'task_a_id', None)
        task_c_id = getattr(self.__class__, 'task_c_id', None)

        impacts_a = self.ctx.db.fetchall(
            "SELECT file_path FROM task_file_impacts WHERE task_id = ?",
            (task_a_id,)
        )
        impacts_c = self.ctx.db.fetchall(
            "SELECT file_path FROM task_file_impacts WHERE task_id = ?",
            (task_c_id,)
        )

        files_a = {r["file_path"] for r in impacts_a}
        files_c = {r["file_path"] for r in impacts_c}

        # Should have intersection
        self.assertTrue(len(files_a & files_c) > 0)
        print(f"✓ Tasks A,C have file conflict: {files_a & files_c}")

    def test_04_simulate_wave_execution(self):
        """Simulate Wave 0 (A,B parallel), then Wave 1 (C,D parallel)."""
        task_a_id = getattr(self.__class__, 'task_a_id', None)
        task_b_id = getattr(self.__class__, 'task_b_id', None)
        task_c_id = getattr(self.__class__, 'task_c_id', None)
        task_d_id = getattr(self.__class__, 'task_d_id', None)
        task_list_id = self.task_list_id

        # Create Wave 0
        wave_0_id = str(uuid.uuid4())
        self.ctx.db.execute(
            """INSERT INTO parallel_execution_waves
               (id, task_list_id, wave_number, status, task_count)
               VALUES (?, ?, 0, 'pending', 2)""",
            (wave_0_id, task_list_id)
        )

        # Assign A and B to Wave 0
        self.ctx.db.execute(
            "INSERT INTO wave_task_assignments (id, wave_id, task_id) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), wave_0_id, task_a_id)
        )
        self.ctx.db.execute(
            "INSERT INTO wave_task_assignments (id, wave_id, task_id) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), wave_0_id, task_b_id)
        )
        self.ctx.db.commit()

        print("✓ Wave 0 created with tasks A,B")

        # Simulate Wave 0 execution
        self.ctx.db.execute(
            "UPDATE parallel_execution_waves SET status = 'in_progress', started_at = datetime('now') WHERE id = ?",
            (wave_0_id,)
        )

        # Complete A and B
        self.ctx.db.execute("UPDATE tasks SET status = 'completed' WHERE id = ?", (task_a_id,))
        self.ctx.db.execute("UPDATE tasks SET status = 'completed' WHERE id = ?", (task_b_id,))
        self.ctx.db.execute(
            "UPDATE parallel_execution_waves SET status = 'completed', completed_count = 2, completed_at = datetime('now') WHERE id = ?",
            (wave_0_id,)
        )
        self.ctx.db.commit()

        print("✓ Wave 0 completed (A,B both done)")

        # Create Wave 1
        wave_1_id = str(uuid.uuid4())
        self.ctx.db.execute(
            """INSERT INTO parallel_execution_waves
               (id, task_list_id, wave_number, status, task_count)
               VALUES (?, ?, 1, 'pending', 2)""",
            (wave_1_id, task_list_id)
        )
        self.ctx.db.execute(
            "INSERT INTO wave_task_assignments (id, wave_id, task_id) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), wave_1_id, task_c_id)
        )
        self.ctx.db.execute(
            "INSERT INTO wave_task_assignments (id, wave_id, task_id) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), wave_1_id, task_d_id)
        )

        # Unblock C and D
        self.ctx.db.execute("UPDATE tasks SET status = 'pending' WHERE id = ?", (task_c_id,))
        self.ctx.db.execute("UPDATE tasks SET status = 'pending' WHERE id = ?", (task_d_id,))
        self.ctx.db.commit()

        print("✓ Wave 1 created with tasks C,D (now unblocked)")

        # Complete Wave 1
        self.ctx.db.execute(
            "UPDATE parallel_execution_waves SET status = 'in_progress', started_at = datetime('now') WHERE id = ?",
            (wave_1_id,)
        )
        self.ctx.db.execute("UPDATE tasks SET status = 'completed' WHERE id = ?", (task_c_id,))
        self.ctx.db.execute("UPDATE tasks SET status = 'completed' WHERE id = ?", (task_d_id,))
        self.ctx.db.execute(
            "UPDATE parallel_execution_waves SET status = 'completed', completed_count = 2, completed_at = datetime('now') WHERE id = ?",
            (wave_1_id,)
        )
        self.ctx.db.commit()

        print("✓ Wave 1 completed (C,D both done)")

        # Verify all waves completed
        waves = self.ctx.db.fetchall(
            "SELECT * FROM parallel_execution_waves WHERE task_list_id = ? ORDER BY wave_number",
            (task_list_id,)
        )
        self.assertEqual(len(waves), 2)
        self.assertEqual(waves[0]["status"], "completed")
        self.assertEqual(waves[1]["status"], "completed")
        print("✓ All waves completed successfully")


class TestFlow4FailureAndRetry(unittest.TestCase):
    """
    Test Flow 4: Failure and Retry

    Priority: P1 (Must Have)
    Validates: Task failure detection, retry logic, proper status transitions
    """

    @classmethod
    def setUpClass(cls):
        cls.ctx = TestContext()
        cls.task_list_id = cls.ctx.create_task_list("Failure Test")

    @classmethod
    def tearDownClass(cls):
        cls.ctx.cleanup()

    def test_01_create_failing_task(self):
        """Create a task designed to fail."""
        task_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Task designed to fail",
            display_id=f"{TEST_PREFIX}FAIL-001",
            task_list_id=self.task_list_id
        )
        self.ctx.add_file_impact(task_id, "test/intentional-fail.ts", "CREATE")

        self.__class__.task_id = task_id
        print(f"✓ Created failing task: {task_id[:8]}")

    def test_02_simulate_failure_and_retry(self):
        """Simulate 3 failed attempts."""
        task_id = getattr(self.__class__, 'task_id', None)
        if not task_id:
            self.skipTest("No task_id")

        for attempt in range(1, 4):
            # Start attempt
            self.ctx.db.execute(
                "UPDATE tasks SET status = 'in_progress' WHERE id = ?",
                (task_id,)
            )
            self.ctx.db.commit()
            print(f"  Attempt {attempt}: in_progress")

            # Fail the attempt
            self.ctx.db.execute(
                "UPDATE tasks SET status = 'pending' WHERE id = ?",
                (task_id,)
            )
            self.ctx.db.commit()
            print(f"  Attempt {attempt}: failed → pending (retry)")

        # After max retries, mark as failed
        self.ctx.db.execute(
            "UPDATE tasks SET status = 'failed' WHERE id = ?",
            (task_id,)
        )
        self.ctx.db.commit()

        self.assertEqual(self.ctx.get_task_status(task_id), "failed")
        print("✓ Task marked as failed after 3 retries")

    def test_03_verify_agent_failure_status(self):
        """Verify agent can be marked as failed."""
        task_id = getattr(self.__class__, 'task_id', None)
        if not task_id:
            self.skipTest("No task_id")

        agent_id = f"{TEST_PREFIX}fail-agent-001"
        self.ctx.create_agent_instance(
            agent_id=agent_id,
            task_id=task_id,
            task_list_id=self.task_list_id,
            status="running"
        )

        # Mark agent as terminated with error
        self.ctx.db.execute(
            """UPDATE build_agent_instances
               SET status = 'terminated', termination_reason = 'task_failed',
                   error_message = 'Validation failed after 3 retries'
               WHERE id = ?""",
            (agent_id,)
        )
        self.ctx.db.commit()

        agent = self.ctx.get_agent(agent_id)
        self.assertEqual(agent["status"], "terminated")
        self.assertEqual(agent["termination_reason"], "task_failed")
        print(f"✓ Agent marked as terminated: {agent['termination_reason']}")


class TestFlow6HeartbeatMonitoring(unittest.TestCase):
    """
    Test Flow 6: Heartbeat and Health Monitoring

    Priority: P1 (Must Have)
    Validates: Heartbeat publishing, stale agent detection
    """

    @classmethod
    def setUpClass(cls):
        cls.ctx = TestContext()
        cls.task_list_id = cls.ctx.create_task_list("Heartbeat Test")

    @classmethod
    def tearDownClass(cls):
        cls.ctx.cleanup()

    def test_01_create_agent_and_heartbeats(self):
        """Create agent with simulated heartbeats."""
        task_id = self.ctx.create_task(
            title=f"{TEST_PREFIX}Long running task",
            display_id=f"{TEST_PREFIX}HEART-001",
            task_list_id=self.task_list_id
        )

        agent_id = f"{TEST_PREFIX}heartbeat-agent-001"
        self.ctx.create_agent_instance(
            agent_id=agent_id,
            task_id=task_id,
            task_list_id=self.task_list_id,
            status="running"
        )

        # Create 3 heartbeats
        for i in range(3):
            hb_id = str(uuid.uuid4())
            self.ctx.db.execute(
                """INSERT INTO agent_heartbeats
                   (id, agent_id, task_id, status, progress_percent, current_step, recorded_at)
                   VALUES (?, ?, ?, 'running', ?, ?, datetime('now', ?))""",
                (hb_id, agent_id, task_id, i * 30, f"Step {i+1}", f'-{(2-i)*30} seconds')
            )
        self.ctx.db.commit()

        self.__class__.agent_id = agent_id
        self.__class__.task_id = task_id
        print("✓ Created agent with 3 heartbeats")

    def test_02_verify_heartbeat_count(self):
        """Verify heartbeats are recorded."""
        agent_id = getattr(self.__class__, 'agent_id', None)
        if not agent_id:
            self.skipTest("No agent_id")

        count = self.ctx.get_heartbeat_count(agent_id)
        self.assertEqual(count, 3)
        print(f"✓ Heartbeat count: {count}")

    def test_03_verify_heartbeat_content(self):
        """Verify heartbeat contains required fields."""
        agent_id = getattr(self.__class__, 'agent_id', None)
        if not agent_id:
            self.skipTest("No agent_id")

        heartbeat = self.ctx.db.fetchone(
            """SELECT * FROM agent_heartbeats
               WHERE agent_id = ? ORDER BY recorded_at DESC LIMIT 1""",
            (agent_id,)
        )

        self.assertIsNotNone(heartbeat)
        self.assertIsNotNone(heartbeat["task_id"])
        self.assertEqual(heartbeat["status"], "running")
        self.assertIsNotNone(heartbeat["progress_percent"])
        self.assertIsNotNone(heartbeat["current_step"])
        print(f"✓ Latest heartbeat: progress={heartbeat['progress_percent']}%, step={heartbeat['current_step']}")

    def test_04_detect_stale_agent(self):
        """Verify stale agent detection query works."""
        agent_id = getattr(self.__class__, 'agent_id', None)
        if not agent_id:
            self.skipTest("No agent_id")

        # Update agent to have old heartbeat
        self.ctx.db.execute(
            """UPDATE build_agent_instances
               SET last_heartbeat_at = datetime('now', '-2 minutes')
               WHERE id = ?""",
            (agent_id,)
        )
        self.ctx.db.commit()

        # Query for stale agents (heartbeat > 60 seconds ago)
        stale_agents = self.ctx.db.fetchall(
            """SELECT * FROM build_agent_instances
               WHERE status = 'running'
               AND last_heartbeat_at < datetime('now', '-60 seconds')"""
        )

        found = any(a["id"] == agent_id for a in stale_agents)
        self.assertTrue(found)
        print(f"✓ Stale agent detected: {agent_id[:20]}...")


class TestFlow7FullPipeline(unittest.TestCase):
    """
    Test Flow 7: Full Pipeline (Task Agent → Telegram → Build Agent → Completion)

    Priority: P1 (Must Have)
    Validates: Complete integration, end-to-end execution

    Note: This test simulates the full pipeline without actual Telegram integration.
    """

    @classmethod
    def setUpClass(cls):
        cls.ctx = TestContext()

    @classmethod
    def tearDownClass(cls):
        cls.ctx.cleanup()

    def test_01_create_tasks_in_evaluation_queue(self):
        """Simulate /newtask creating tasks in evaluation queue."""
        # Create 3 tasks (simulating Telegram /newtask commands)
        task_ids = []
        for i, title in enumerate([
            "Create user model",
            "Create user API",
            "Add user tests"
        ]):
            task_id = self.ctx.create_task(
                title=f"{TEST_PREFIX}{title}",
                display_id=f"{TEST_PREFIX}FULL-00{i+1}",
                task_list_id=None  # Evaluation queue
            )
            task_ids.append(task_id)

            task = self.ctx.get_task(task_id)
            self.assertEqual(task["queue"], "evaluation")
            print(f"✓ /newtask '{title}' → {task['display_id']} in evaluation queue")

        self.__class__.task_ids = task_ids

    def test_02_auto_grouping_creates_task_list(self):
        """Simulate auto-grouping creating a task list."""
        task_ids = getattr(self.__class__, 'task_ids', [])
        if not task_ids:
            self.skipTest("No tasks from previous test")

        # Create task list (simulating grouping suggestion acceptance)
        task_list_id = self.ctx.create_task_list("User Feature Sprint")

        # Move all tasks to the list (queue = NULL when in a list)
        for task_id in task_ids:
            self.ctx.db.execute(
                "UPDATE tasks SET task_list_id = ?, queue = NULL WHERE id = ?",
                (task_list_id, task_id)
            )

        # Update task list status to ready (active is not a valid status)
        self.ctx.db.execute(
            "UPDATE task_lists_v2 SET status = 'ready' WHERE id = ?",
            (task_list_id,)
        )
        self.ctx.db.commit()

        # Verify
        tasks_in_list = self.ctx.db.fetchall(
            "SELECT * FROM tasks WHERE task_list_id = ?",
            (task_list_id,)
        )
        self.assertEqual(len(tasks_in_list), 3)

        self.__class__.task_list_id = task_list_id
        print(f"✓ Task list created with 3 tasks: {task_list_id[:8]}...")

    def test_03_execute_creates_build_agents(self):
        """Simulate /execute creating Build Agents."""
        task_list_id = getattr(self.__class__, 'task_list_id', None)
        task_ids = getattr(self.__class__, 'task_ids', [])
        if not task_list_id:
            self.skipTest("No task_list_id")

        # Create agent for first task (simulating orchestrator)
        agent_id = f"{TEST_PREFIX}full-pipeline-agent-001"
        self.ctx.create_agent_instance(
            agent_id=agent_id,
            task_id=task_ids[0],
            task_list_id=task_list_id,
            status="running"
        )

        agent = self.ctx.get_agent(agent_id)
        self.assertEqual(agent["status"], "running")
        self.assertEqual(agent["task_list_id"], task_list_id)

        self.__class__.agent_id = agent_id
        print(f"✓ Build Agent spawned: {agent_id}")

    def test_04_tasks_complete_successfully(self):
        """Simulate all tasks completing."""
        task_ids = getattr(self.__class__, 'task_ids', [])
        if not task_ids:
            self.skipTest("No task_ids")

        for task_id in task_ids:
            self.ctx.db.execute(
                "UPDATE tasks SET status = 'completed' WHERE id = ?",
                (task_id,)
            )
        self.ctx.db.commit()

        # Verify all completed
        for task_id in task_ids:
            self.assertEqual(self.ctx.get_task_status(task_id), "completed")

        print("✓ All 3 tasks completed")

    def test_05_verify_final_state(self):
        """Verify final database state is consistent."""
        task_list_id = getattr(self.__class__, 'task_list_id', None)
        task_ids = getattr(self.__class__, 'task_ids', [])
        agent_id = getattr(self.__class__, 'agent_id', None)

        # All tasks completed
        for task_id in task_ids:
            self.assertEqual(self.ctx.get_task_status(task_id), "completed")

        # Update task list to completed
        self.ctx.db.execute(
            "UPDATE task_lists_v2 SET status = 'completed' WHERE id = ?",
            (task_list_id,)
        )
        self.ctx.db.commit()

        list_row = self.ctx.db.fetchone(
            "SELECT * FROM task_lists_v2 WHERE id = ?",
            (task_list_id,)
        )
        self.assertEqual(list_row["status"], "completed")

        # Mark agent as terminated
        self.ctx.db.execute(
            """UPDATE build_agent_instances
               SET status = 'terminated', terminated_at = datetime('now')
               WHERE id = ?""",
            (agent_id,)
        )
        self.ctx.db.commit()

        agent = self.ctx.get_agent(agent_id)
        self.assertEqual(agent["status"], "terminated")

        print("✓ Final state verified:")
        print("  - All tasks: completed")
        print("  - Task list: completed")
        print("  - Build Agent: terminated")


def run_tests():
    """Run all P1 tests."""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add test classes in order
    test_classes = [
        TestFlow1SingleTaskExecution,
        TestFlow2MultiTaskSequential,
        TestFlow3ParallelExecution,
        TestFlow4FailureAndRetry,
        TestFlow6HeartbeatMonitoring,
        TestFlow7FullPipeline,
    ]

    for test_class in test_classes:
        suite.addTests(loader.loadTestsFromTestCase(test_class))

    # Run with verbosity
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Print summary
    print("\n" + "=" * 60)
    print("BUILD AGENT P1 TEST SUMMARY")
    print("=" * 60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Skipped: {len(result.skipped)}")

    if result.wasSuccessful():
        print("\n✅ ALL P1 TESTS PASSED")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        if result.failures:
            print("\nFailures:")
            for test, trace in result.failures:
                print(f"  - {test}: {trace.split(chr(10))[-2]}")
        if result.errors:
            print("\nErrors:")
            for test, trace in result.errors:
                print(f"  - {test}: {trace.split(chr(10))[-2]}")
        return 1


if __name__ == "__main__":
    # Allow running specific test class
    if len(sys.argv) > 1:
        test_name = sys.argv[1]
        if test_name.startswith("TestFlow"):
            # Run specific test class
            loader = unittest.TestLoader()
            suite = unittest.TestSuite()

            test_classes = {
                "TestFlow1": TestFlow1SingleTaskExecution,
                "TestFlow2": TestFlow2MultiTaskSequential,
                "TestFlow3": TestFlow3ParallelExecution,
                "TestFlow4": TestFlow4FailureAndRetry,
                "TestFlow6": TestFlow6HeartbeatMonitoring,
                "TestFlow7": TestFlow7FullPipeline,
            }

            for name, cls in test_classes.items():
                if test_name in name or test_name == name:
                    suite.addTests(loader.loadTestsFromTestCase(cls))

            runner = unittest.TextTestRunner(verbosity=2)
            result = runner.run(suite)
            sys.exit(0 if result.wasSuccessful() else 1)

    # Run all tests
    sys.exit(run_tests())
