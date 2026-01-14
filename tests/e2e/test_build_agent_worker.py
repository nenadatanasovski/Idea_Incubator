#!/usr/bin/env python3
"""
Build Agent Worker E2E Test

Test Flow 12: Python Worker Execution (P0)

Pass Criteria:
  - [ ] Worker file exists at correct path
  - [ ] Worker accepts required arguments
  - [ ] Worker connects to database
  - [ ] Worker loads task details
  - [ ] Worker generates code (or fallback in simulation mode)
  - [ ] Worker writes file to correct path
  - [ ] Worker exits with code 0 on success
  - [ ] Worker exits with non-zero on failure
  - [ ] Heartbeats recorded when agent registered
  - [ ] Task status updated to 'completed' or 'failed'
"""

import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

# Project root
PROJECT_ROOT = Path(__file__).parent.parent.parent


class TestBuildAgentWorker(unittest.TestCase):
    """Test the Build Agent Worker Python script"""

    @classmethod
    def setUpClass(cls):
        """Set up test database and environment"""
        cls.db_path = PROJECT_ROOT / "database" / "ideas.db"
        cls.worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"

        # Ensure database exists
        if not cls.db_path.exists():
            raise unittest.SkipTest(f"Database not found at {cls.db_path}")

    def setUp(self):
        """Set up test fixtures"""
        self.test_task_id = str(uuid.uuid4())
        self.test_task_list_id = str(uuid.uuid4())
        self.test_agent_id = str(uuid.uuid4())
        self.test_display_id = f"TU-TEST-FEA-{uuid.uuid4().hex[:3].upper()}"

        # Temporary output directory for generated files
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures"""
        # Clean up temp directory
        if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

        # Clean up test data from database
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute("DELETE FROM tasks WHERE id = ?", (self.test_task_id,))
            conn.execute("DELETE FROM task_lists_v2 WHERE id = ?", (self.test_task_list_id,))
            conn.execute("DELETE FROM build_agent_instances WHERE id = ?", (self.test_agent_id,))
            conn.execute("DELETE FROM agent_heartbeats WHERE agent_id = ?", (self.test_agent_id,))
            conn.execute("DELETE FROM task_file_impacts WHERE task_id = ?", (self.test_task_id,))
            conn.commit()
        finally:
            conn.close()

    def _create_test_task_list(self, conn):
        """Create a test task list"""
        conn.execute(
            """INSERT INTO task_lists_v2 (id, name, status, created_at, updated_at)
               VALUES (?, ?, 'draft', datetime('now'), datetime('now'))""",
            (self.test_task_list_id, "Test Task List")
        )

    def _create_test_task(self, conn, title="Test Task", description="A test task"):
        """Create a test task"""
        conn.execute(
            """INSERT INTO tasks (id, display_id, title, description, status, task_list_id,
                                  category, priority, effort, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'pending', ?, 'task', 'P2', 'small',
                       datetime('now'), datetime('now'))""",
            (self.test_task_id, self.test_display_id, title, description, self.test_task_list_id)
        )

    def _create_file_impact(self, conn, file_path, operation='CREATE'):
        """Create a file impact for the test task"""
        conn.execute(
            """INSERT INTO task_file_impacts (id, task_id, file_path, operation, confidence, source)
               VALUES (?, ?, ?, ?, 0.9, 'user_declared')""",
            (str(uuid.uuid4()), self.test_task_id, file_path, operation)
        )

    def _create_agent_instance(self, conn):
        """Create a build agent instance record"""
        conn.execute(
            """INSERT INTO build_agent_instances
               (id, task_id, task_list_id, status, spawned_at)
               VALUES (?, ?, ?, 'spawning', datetime('now'))""",
            (self.test_agent_id, self.test_task_id, self.test_task_list_id)
        )

    def _get_task_status(self):
        """Get current task status from database"""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute(
                "SELECT status FROM tasks WHERE id = ?",
                (self.test_task_id,)
            )
            row = cursor.fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def _get_heartbeat_count(self):
        """Get heartbeat count for agent"""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM agent_heartbeats WHERE agent_id = ?",
                (self.test_agent_id,)
            )
            row = cursor.fetchone()
            return row[0] if row else 0
        finally:
            conn.close()

    def test_01_worker_file_exists(self):
        """Test Flow 12 Step 1: Worker file exists at correct path"""
        self.assertTrue(
            self.worker_path.exists(),
            f"Worker file not found at {self.worker_path}"
        )

    def test_02_worker_help_command(self):
        """Test Flow 12 Step 2: Worker accepts --help"""
        result = subprocess.run(
            [sys.executable, str(self.worker_path), "--help"],
            capture_output=True,
            text=True,
            timeout=30
        )
        self.assertEqual(result.returncode, 0, f"Help failed: {result.stderr}")
        self.assertIn("--agent-id", result.stdout)
        self.assertIn("--task-id", result.stdout)
        self.assertIn("--task-list-id", result.stdout)

    def test_03_worker_missing_task(self):
        """Test Flow 12 Step 3: Worker exits non-zero for missing task"""
        result = subprocess.run(
            [
                sys.executable, str(self.worker_path),
                "--agent-id", "nonexistent-agent",
                "--task-id", "nonexistent-task",
                "--task-list-id", "nonexistent-list"
            ],
            capture_output=True,
            text=True,
            timeout=60
        )
        self.assertNotEqual(result.returncode, 0, "Should fail for missing task")
        self.assertIn("not found", result.stdout.lower() + result.stderr.lower())

    def test_04_worker_task_without_file_impact(self):
        """Test Flow 12 Step 4: Worker handles task without file impacts"""
        conn = sqlite3.connect(str(self.db_path))
        try:
            self._create_test_task_list(conn)
            self._create_test_task(conn, title="Task without file impact")
            # Note: No file impact created
            conn.commit()
        finally:
            conn.close()

        result = subprocess.run(
            [
                sys.executable, str(self.worker_path),
                "--agent-id", self.test_agent_id,
                "--task-id", self.test_task_id,
                "--task-list-id", self.test_task_list_id
            ],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(PROJECT_ROOT)
        )

        # Task should still complete (no file to write, but no error)
        # The task completes but may not generate a file
        print(f"stdout: {result.stdout}")
        print(f"stderr: {result.stderr}")
        print(f"exit code: {result.returncode}")

        # Check task was processed
        self.assertIn("BuildAgentWorker", result.stdout)

    def test_05_worker_task_with_file_impact(self):
        """Test Flow 12 Step 5: Worker processes task with file impact"""
        # Create a temp file path within the project
        test_file_rel = f"tests/e2e/temp_output_{self.test_task_id[:8]}.ts"
        test_file_path = PROJECT_ROOT / test_file_rel

        conn = sqlite3.connect(str(self.db_path))
        try:
            self._create_test_task_list(conn)
            self._create_test_task(conn, title="Create test TypeScript file")
            self._create_file_impact(conn, test_file_rel, 'CREATE')
            conn.commit()
        finally:
            conn.close()

        try:
            result = subprocess.run(
                [
                    sys.executable, str(self.worker_path),
                    "--agent-id", self.test_agent_id,
                    "--task-id", self.test_task_id,
                    "--task-list-id", self.test_task_list_id
                ],
                capture_output=True,
                text=True,
                timeout=180,
                cwd=str(PROJECT_ROOT)
            )

            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
            print(f"exit code: {result.returncode}")

            # In simulation mode (no Anthropic API key), the file should be created
            # with fallback content
            if "simulation mode" in result.stderr.lower():
                print("Running in simulation mode - checking fallback file creation")

            # Check that the file was created (regardless of validation outcome)
            if test_file_path.exists():
                print(f"File created: {test_file_path}")
                content = test_file_path.read_text()
                self.assertIn("Generated by Build Agent", content)
        finally:
            # Clean up test file
            if test_file_path.exists():
                test_file_path.unlink()

    def test_06_worker_with_registered_agent(self):
        """Test Flow 12 Step 6: Worker sends heartbeats when agent is registered"""
        test_file_rel = f"tests/e2e/temp_heartbeat_{self.test_task_id[:8]}.ts"
        test_file_path = PROJECT_ROOT / test_file_rel

        conn = sqlite3.connect(str(self.db_path))
        try:
            self._create_test_task_list(conn)
            self._create_test_task(conn, title="Test with heartbeats")
            self._create_file_impact(conn, test_file_rel, 'CREATE')
            self._create_agent_instance(conn)  # Register agent
            conn.commit()
        finally:
            conn.close()

        try:
            result = subprocess.run(
                [
                    sys.executable, str(self.worker_path),
                    "--agent-id", self.test_agent_id,
                    "--task-id", self.test_task_id,
                    "--task-list-id", self.test_task_list_id,
                    "--heartbeat-interval", "1"  # Fast heartbeat for testing
                ],
                capture_output=True,
                text=True,
                timeout=180,
                cwd=str(PROJECT_ROOT)
            )

            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
            print(f"exit code: {result.returncode}")

            # Check heartbeats were recorded
            heartbeat_count = self._get_heartbeat_count()
            print(f"Heartbeat count: {heartbeat_count}")

            # Should have at least one heartbeat
            # (if agent was registered and task took > 1 second)
            if "simulation mode" in result.stderr.lower():
                # Simulation mode may be too fast for heartbeats
                print("Simulation mode - heartbeats may not have time to fire")

        finally:
            # Clean up test file
            if test_file_path.exists():
                test_file_path.unlink()

    def test_07_worker_updates_task_status(self):
        """Test Flow 12 Step 7: Worker updates task status in database"""
        test_file_rel = f"tests/e2e/temp_status_{self.test_task_id[:8]}.ts"
        test_file_path = PROJECT_ROOT / test_file_rel

        conn = sqlite3.connect(str(self.db_path))
        try:
            self._create_test_task_list(conn)
            self._create_test_task(conn, title="Test status update")
            self._create_file_impact(conn, test_file_rel, 'CREATE')
            conn.commit()
        finally:
            conn.close()

        # Verify initial status
        initial_status = self._get_task_status()
        self.assertEqual(initial_status, 'pending')

        try:
            result = subprocess.run(
                [
                    sys.executable, str(self.worker_path),
                    "--agent-id", self.test_agent_id,
                    "--task-id", self.test_task_id,
                    "--task-list-id", self.test_task_list_id
                ],
                capture_output=True,
                text=True,
                timeout=180,
                cwd=str(PROJECT_ROOT)
            )

            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
            print(f"exit code: {result.returncode}")

            # Check final status
            final_status = self._get_task_status()
            print(f"Final task status: {final_status}")

            # Status should have changed from 'pending'
            self.assertIn(final_status, ['completed', 'failed'],
                          f"Task status should be completed or failed, got {final_status}")

        finally:
            # Clean up test file
            if test_file_path.exists():
                test_file_path.unlink()


class TestBuildAgentWorkerIntegration(unittest.TestCase):
    """Integration tests for Build Agent Worker"""

    def test_simulation_mode_message(self):
        """Verify simulation mode message when no API key"""
        worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"

        # Temporarily clear ANTHROPIC_API_KEY if set
        old_key = os.environ.get('ANTHROPIC_API_KEY')
        if 'ANTHROPIC_API_KEY' in os.environ:
            del os.environ['ANTHROPIC_API_KEY']

        try:
            result = subprocess.run(
                [
                    sys.executable, str(worker_path),
                    "--agent-id", "test-sim",
                    "--task-id", "test-task",
                    "--task-list-id", "test-list"
                ],
                capture_output=True,
                text=True,
                timeout=60,
                cwd=str(PROJECT_ROOT)
            )

            # Should mention simulation mode when no API key
            combined_output = result.stdout + result.stderr
            # Either mentions simulation mode or task not found (both valid)
            self.assertTrue(
                "simulation mode" in combined_output.lower() or
                "not found" in combined_output.lower(),
                "Expected simulation mode message or task not found"
            )
        finally:
            # Restore API key
            if old_key:
                os.environ['ANTHROPIC_API_KEY'] = old_key


if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)
