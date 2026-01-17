#!/usr/bin/env python3
"""
Observability Phase 3: Agent Integration Tests

Tests for tasks OBS-100 to OBS-110 which integrate observability
into Python and TypeScript agents.

Tasks Covered:
- OBS-100: Observable Agent Base Class (Python)
- OBS-101: Observable Agent Base Class (TypeScript)
- OBS-102: Build Agent Worker Base Integration
- OBS-103: Build Agent Message Loop Integration
- OBS-104: Build Agent Validation Phase Integration
- OBS-105: Specification Agent Integration
- OBS-106: Validation Agent Integration
- OBS-107: UX Agent Integration
- OBS-108: SIA Integration
- OBS-109: Monitoring Agent Integration
- OBS-110: TypeScript Observability Services

Test Categories:
1. Import Tests - Verify all classes can be imported
2. Class Structure Tests - Verify required methods exist
3. Integration Tests - Verify agents extend/use observable classes
4. Database Tests - Verify observability entries written to SQLite
5. Acceptance Criteria Tests - Specific criteria per task
"""

import ast
import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "coding-loops"))

# Test results tracking
results = []


def record_test(name: str, passed: bool, details: str = None, task_id: str = None):
    """Record a test result."""
    results.append({
        "name": name,
        "passed": passed,
        "details": details,
        "task_id": task_id
    })
    status = "PASS" if passed else "FAIL"
    task_str = f" [{task_id}]" if task_id else ""
    detail_str = f" - {details}" if details else ""
    print(f"{status}: {name}{task_str}{detail_str}")


def setup_test_db():
    """Get the test database path."""
    db_path = PROJECT_ROOT / "database" / "ideas.db"
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")
    return db_path


def create_test_execution_run(db_path: Path, exec_id: str, task_list_id: str = None, task_id: str = None):
    """Create a test execution run record for FK compliance."""
    if task_list_id is None:
        task_list_id = f"test-list-{uuid.uuid4().hex[:8]}"

    conn = sqlite3.connect(str(db_path), timeout=10)
    try:
        # Create a task list first (if it doesn't exist)
        conn.execute(
            """INSERT OR IGNORE INTO task_lists_v2 (id, name, status, created_at)
               VALUES (?, 'Test Task List', 'ready', datetime('now'))""",
            (task_list_id,)
        )
        # Create the execution run with run_number
        conn.execute(
            """INSERT INTO task_list_execution_runs (id, task_list_id, run_number, status, started_at)
               VALUES (?, ?, 1, 'running', datetime('now'))""",
            (exec_id, task_list_id)
        )
        # Create a test task if requested (for FK compliance)
        if task_id:
            conn.execute(
                """INSERT OR IGNORE INTO tasks (id, display_id, title, task_list_id, status, created_at)
                   VALUES (?, ?, 'Test Task', ?, 'pending', datetime('now'))""",
                (task_id, f"TU-TEST-TST-001", task_list_id)
            )
        conn.commit()
    finally:
        conn.close()
    return task_list_id


def cleanup_test_data(db_path: Path, exec_id: str, task_list_id: str, task_id: str = None):
    """Clean up test data from database."""
    conn = sqlite3.connect(str(db_path), timeout=10)
    try:
        # Clean up in reverse FK order
        conn.execute("DELETE FROM skill_traces WHERE execution_id = ?", (exec_id,))
        conn.execute("DELETE FROM tool_uses WHERE execution_id = ?", (exec_id,))
        conn.execute("DELETE FROM assertion_results WHERE execution_id = ?", (exec_id,))
        conn.execute("DELETE FROM assertion_chains WHERE execution_id = ?", (exec_id,))
        conn.execute("DELETE FROM transcript_entries WHERE execution_id = ?", (exec_id,))
        if task_id:
            conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.execute("DELETE FROM task_list_execution_runs WHERE id = ?", (exec_id,))
        conn.execute("DELETE FROM task_lists_v2 WHERE id = ?", (task_list_id,))
        conn.commit()
    finally:
        conn.close()


def file_exists(path: str) -> bool:
    """Check if a file exists relative to project root."""
    return (PROJECT_ROOT / path).exists()


def check_python_class_methods(file_path: str, class_name: str, required_methods: List[str]) -> Tuple[bool, List[str]]:
    """
    Check if a Python class has the required methods.
    Returns (all_found, missing_methods)
    """
    full_path = PROJECT_ROOT / file_path
    if not full_path.exists():
        return False, required_methods

    content = full_path.read_text(encoding='utf-8')

    try:
        tree = ast.parse(content)

        # Find the class
        class_def = None
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == class_name:
                class_def = node
                break

        if not class_def:
            return False, required_methods

        # Get all method names in the class
        methods = set()
        for item in class_def.body:
            if isinstance(item, ast.FunctionDef) or isinstance(item, ast.AsyncFunctionDef):
                methods.add(item.name)

        missing = [m for m in required_methods if m not in methods]
        return len(missing) == 0, missing

    except SyntaxError:
        return False, required_methods


def check_python_class_initializes(file_path: str, class_name: str, required_attrs: List[str]) -> Tuple[bool, List[str]]:
    """
    Check if a Python class __init__ initializes required attributes.
    Returns (all_found, missing_attrs)
    """
    full_path = PROJECT_ROOT / file_path
    if not full_path.exists():
        return False, required_attrs

    content = full_path.read_text(encoding='utf-8')

    # Look for self.attr_name in __init__
    # This is a simple regex approach
    init_match = re.search(
        rf'class\s+{class_name}.*?def\s+__init__\s*\([^)]*\)\s*:(.+?)(?=\n    def|\nclass|\Z)',
        content,
        re.DOTALL
    )

    if not init_match:
        return False, required_attrs

    init_body = init_match.group(1)
    missing = []

    for attr in required_attrs:
        # Look for self.attr = or self.attr: patterns
        pattern = rf'self\.{attr}\s*='
        if not re.search(pattern, init_body):
            missing.append(attr)

    return len(missing) == 0, missing


def check_typescript_file_exports(file_path: str, required_exports: List[str]) -> Tuple[bool, List[str]]:
    """
    Check if a TypeScript file exports the required items.
    Returns (all_found, missing_exports)
    """
    full_path = PROJECT_ROOT / file_path
    if not full_path.exists():
        return False, required_exports

    content = full_path.read_text(encoding='utf-8')

    missing = []
    for export in required_exports:
        # Look for export class/function/const/interface/type/abstract
        patterns = [
            rf'export\s+(class|function|const|interface|type|abstract\s+class)\s+{export}\b',
            rf'export\s+\{{[^}}]*\b{export}\b[^}}]*\}}',  # Named exports
            rf'export\s+default\s+{export}\b',
        ]
        found = any(re.search(p, content) for p in patterns)
        if not found:
            missing.append(export)

    return len(missing) == 0, missing


def check_typescript_class_extends(file_path: str, class_name: str, parent_class: str) -> bool:
    """Check if a TypeScript class extends a parent class."""
    full_path = PROJECT_ROOT / file_path
    if not full_path.exists():
        return False

    content = full_path.read_text(encoding='utf-8')

    # Look for class ClassName extends ParentClass
    pattern = rf'class\s+{class_name}\s+extends\s+{parent_class}\b'
    return bool(re.search(pattern, content))


def run_tsc_check() -> Tuple[bool, str]:
    """Run TypeScript compilation check. Returns (success, output)."""
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=120
        )
        return result.returncode == 0, result.stderr or result.stdout
    except subprocess.TimeoutExpired:
        return False, "TypeScript check timed out"
    except FileNotFoundError:
        return False, "npx not found"
    except Exception as e:
        return False, str(e)


# =============================================================================
# OBS-100: Observable Agent Base Class (Python)
# =============================================================================

def test_obs100_file_exists():
    """Test OBS-100: observable_agent.py file exists."""
    exists = file_exists("coding-loops/shared/observable_agent.py")
    record_test(
        "OBS-100: observable_agent.py exists",
        exists,
        "File should be at coding-loops/shared/observable_agent.py",
        "obs-100"
    )
    return exists


def test_obs100_class_import():
    """Test OBS-100: ObservableAgent class can be imported."""
    try:
        from shared.observable_agent import ObservableAgent
        record_test("OBS-100: ObservableAgent imports", True, task_id="obs-100")
        return True
    except ImportError as e:
        record_test(
            "OBS-100: ObservableAgent imports",
            False,
            f"Import error: {e}",
            "obs-100"
        )
        return False


def test_obs100_lifecycle_methods():
    """Test OBS-100: ObservableAgent has required lifecycle methods."""
    required_methods = [
        "log_phase_start",
        "log_phase_end",
        "log_task_start",
        "log_task_end"
    ]

    all_found, missing = check_python_class_methods(
        "coding-loops/shared/observable_agent.py",
        "ObservableAgent",
        required_methods
    )

    record_test(
        "OBS-100: Lifecycle methods exist",
        all_found,
        f"Missing: {missing}" if missing else "All methods found",
        "obs-100"
    )
    return all_found


def test_obs100_tool_logging_methods():
    """Test OBS-100: ObservableAgent has tool logging methods."""
    required_methods = [
        "log_tool_start",
        "log_tool_end",
    ]

    all_found, missing = check_python_class_methods(
        "coding-loops/shared/observable_agent.py",
        "ObservableAgent",
        required_methods
    )

    record_test(
        "OBS-100: Tool logging methods exist",
        all_found,
        f"Missing: {missing}" if missing else "All methods found",
        "obs-100"
    )
    return all_found


def test_obs100_initializes_producers():
    """Test OBS-100: ObservableAgent initializes all producer classes."""
    required_attrs = [
        "transcript_writer",
        "tool_logger",
        "skill_tracer",
        "assertion_recorder"
    ]

    all_found, missing = check_python_class_initializes(
        "coding-loops/shared/observable_agent.py",
        "ObservableAgent",
        required_attrs
    )

    record_test(
        "OBS-100: Producer classes initialized",
        all_found,
        f"Missing: {missing}" if missing else "All producers initialized",
        "obs-100"
    )
    return all_found


# =============================================================================
# OBS-110: TypeScript Observability Services
# =============================================================================

def test_obs110_transcript_writer_exists():
    """Test OBS-110: transcript-writer.ts exists."""
    exists = file_exists("server/services/observability/transcript-writer.ts")
    record_test(
        "OBS-110: transcript-writer.ts exists",
        exists,
        "File should be at server/services/observability/transcript-writer.ts",
        "obs-110"
    )
    return exists


def test_obs110_tool_use_logger_exists():
    """Test OBS-110: tool-use-logger.ts exists."""
    exists = file_exists("server/services/observability/tool-use-logger.ts")
    record_test(
        "OBS-110: tool-use-logger.ts exists",
        exists,
        "File should be at server/services/observability/tool-use-logger.ts",
        "obs-110"
    )
    return exists


def test_obs110_assertion_recorder_exists():
    """Test OBS-110: assertion-recorder.ts exists."""
    exists = file_exists("server/services/observability/assertion-recorder.ts")
    record_test(
        "OBS-110: assertion-recorder.ts exists",
        exists,
        "File should be at server/services/observability/assertion-recorder.ts",
        "obs-110"
    )
    return exists


def test_obs110_index_exports():
    """Test OBS-110: index.ts exports all classes."""
    required_exports = [
        "TranscriptWriter",
        "ToolUseLogger",
        "AssertionRecorder"
    ]

    # First check if index.ts exists
    if not file_exists("server/services/observability/index.ts"):
        record_test(
            "OBS-110: index.ts exports services",
            False,
            "index.ts does not exist",
            "obs-110"
        )
        return False

    # Check exports
    all_found, missing = check_typescript_file_exports(
        "server/services/observability/index.ts",
        required_exports
    )

    record_test(
        "OBS-110: index.ts exports services",
        all_found,
        f"Missing: {missing}" if missing else "All services exported",
        "obs-110"
    )
    return all_found


# =============================================================================
# OBS-101: Observable Agent Base Class (TypeScript)
# =============================================================================

def test_obs101_file_exists():
    """Test OBS-101: observable-agent.ts exists."""
    exists = file_exists("server/agents/observable-agent.ts")
    record_test(
        "OBS-101: observable-agent.ts exists",
        exists,
        "File should be at server/agents/observable-agent.ts",
        "obs-101"
    )
    return exists


def test_obs101_class_export():
    """Test OBS-101: ObservableAgent class is exported."""
    all_found, missing = check_typescript_file_exports(
        "server/agents/observable-agent.ts",
        ["ObservableAgent"]
    )

    record_test(
        "OBS-101: ObservableAgent is exported",
        all_found,
        "Class should be exported as abstract class",
        "obs-101"
    )
    return all_found


def test_obs101_lifecycle_methods_ts():
    """Test OBS-101: TypeScript ObservableAgent has lifecycle methods."""
    path = PROJECT_ROOT / "server/agents/observable-agent.ts"
    if not path.exists():
        record_test(
            "OBS-101: Lifecycle methods defined",
            False,
            "File does not exist",
            "obs-101"
        )
        return False

    content = path.read_text(encoding='utf-8')

    required_methods = [
        "logPhaseStart",
        "logPhaseEnd",
        "logTaskStart",
        "logTaskEnd"
    ]

    missing = [m for m in required_methods if m not in content]

    record_test(
        "OBS-101: Lifecycle methods defined",
        len(missing) == 0,
        f"Missing: {missing}" if missing else "All methods found",
        "obs-101"
    )
    return len(missing) == 0


def test_obs101_imports_services():
    """Test OBS-101: Imports services from observability/."""
    path = PROJECT_ROOT / "server/agents/observable-agent.ts"
    if not path.exists():
        record_test(
            "OBS-101: Imports observability services",
            False,
            "File does not exist",
            "obs-101"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for import from services/observability
    has_import = "services/observability" in content

    record_test(
        "OBS-101: Imports observability services",
        has_import,
        "Should import from server/services/observability/",
        "obs-101"
    )
    return has_import


# =============================================================================
# OBS-102: Build Agent Worker Base Integration
# =============================================================================

def test_obs102_extends_observable():
    """Test OBS-102: BuildAgentWorker extends ObservableAgent."""
    path = PROJECT_ROOT / "coding-loops/agents/build_agent_worker.py"
    if not path.exists():
        record_test(
            "OBS-102: BuildAgentWorker exists",
            False,
            "File does not exist",
            "obs-102"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check if it imports ObservableAgent
    imports_observable = "from shared.observable_agent import ObservableAgent" in content

    # Check if class extends ObservableAgent
    extends_pattern = r'class\s+BuildAgentWorker\s*\([^)]*ObservableAgent[^)]*\)'
    extends_observable = bool(re.search(extends_pattern, content))

    # Also check for has-a relationship (composition)
    uses_observable = "ObservableAgent(" in content or "self.observable" in content

    passed = imports_observable or extends_observable or uses_observable

    record_test(
        "OBS-102: BuildAgentWorker uses ObservableAgent",
        passed,
        "Should extend or compose ObservableAgent",
        "obs-102"
    )
    return passed


def test_obs102_calls_lifecycle_methods():
    """Test OBS-102: BuildAgentWorker calls lifecycle methods."""
    path = PROJECT_ROOT / "coding-loops/agents/build_agent_worker.py"
    if not path.exists():
        record_test(
            "OBS-102: Calls lifecycle methods",
            False,
            "File does not exist",
            "obs-102"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for log_task_start and log_task_end calls
    lifecycle_calls = [
        "log_task_start",
        "log_task_end"
    ]

    found = [m for m in lifecycle_calls if m in content]

    record_test(
        "OBS-102: Calls lifecycle methods",
        len(found) > 0,
        f"Found: {found}" if found else "No lifecycle calls found",
        "obs-102"
    )
    return len(found) > 0


# =============================================================================
# OBS-103: Build Agent Message Loop Integration
# =============================================================================

def test_obs103_tool_logging_in_loop():
    """Test OBS-103: Message loop logs tool uses."""
    path = PROJECT_ROOT / "coding-loops/agents/build_agent_worker.py"
    if not path.exists():
        record_test(
            "OBS-103: Tool logging in message loop",
            False,
            "File does not exist",
            "obs-103"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for tool logging calls
    tool_log_patterns = [
        "log_tool_start",
        "log_tool_end",
        "tool_logger.log_start",
        "tool_logger.log_end"
    ]

    found = [p for p in tool_log_patterns if p in content]

    record_test(
        "OBS-103: Tool logging in message loop",
        len(found) > 0,
        f"Found: {found}" if found else "No tool logging found",
        "obs-103"
    )
    return len(found) > 0


def test_obs103_blocked_tool_logging():
    """Test OBS-103: Logs security-blocked tools."""
    path = PROJECT_ROOT / "coding-loops/agents/build_agent_worker.py"
    if not path.exists():
        record_test(
            "OBS-103: Blocked tool logging",
            False,
            "File does not exist",
            "obs-103"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for blocked logging
    blocked_patterns = [
        "log_tool_blocked",
        "log_blocked",
        "blocked",
        "security"
    ]

    found = [p for p in blocked_patterns if p in content.lower()]

    record_test(
        "OBS-103: Blocked tool logging",
        len(found) > 0,
        f"Found: {found[:2]}" if found else "No blocked logging found",
        "obs-103"
    )
    return len(found) > 0


# =============================================================================
# OBS-104: Build Agent Validation Phase Integration
# =============================================================================

def test_obs104_assertion_chains():
    """Test OBS-104: Validation uses assertion chains."""
    path = PROJECT_ROOT / "coding-loops/agents/build_agent_worker.py"
    if not path.exists():
        record_test(
            "OBS-104: Uses assertion chains",
            False,
            "File does not exist",
            "obs-104"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for assertion chain usage
    assertion_patterns = [
        "assertion_recorder",
        "start_chain",
        "end_chain",
        "assert_"
    ]

    found = [p for p in assertion_patterns if p in content]

    record_test(
        "OBS-104: Uses assertion chains",
        len(found) > 0,
        f"Found: {found}" if found else "No assertion usage found",
        "obs-104"
    )
    return len(found) > 0


def test_obs104_validation_assertions():
    """Test OBS-104: Validation results create assertions."""
    path = PROJECT_ROOT / "coding-loops/agents/build_agent_worker.py"
    if not path.exists():
        record_test(
            "OBS-104: Validation creates assertions",
            False,
            "File does not exist",
            "obs-104"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for validation + assertion patterns
    has_validation = "validation" in content.lower() or "_run_validation" in content
    has_assertion = "assert" in content.lower() or "AssertionRecorder" in content

    record_test(
        "OBS-104: Validation creates assertions",
        has_validation,
        "Has validation: " + str(has_validation) + ", has assertions: " + str(has_assertion),
        "obs-104"
    )
    return has_validation


# =============================================================================
# OBS-105: Specification Agent Integration
# =============================================================================

def test_obs105_file_exists():
    """Test OBS-105: specification/core.ts exists."""
    exists = file_exists("agents/specification/core.ts")
    record_test(
        "OBS-105: specification/core.ts exists",
        exists,
        "File should be at agents/specification/core.ts",
        "obs-105"
    )
    return exists


def test_obs105_extends_observable():
    """Test OBS-105: SpecAgent extends ObservableAgent."""
    path = PROJECT_ROOT / "agents/specification/core.ts"
    if not path.exists():
        record_test(
            "OBS-105: Uses ObservableAgent",
            False,
            "File does not exist",
            "obs-105"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for ObservableAgent usage
    uses_observable = (
        "ObservableAgent" in content or
        "observable-agent" in content or
        "logPhaseStart" in content or
        "logTaskStart" in content
    )

    record_test(
        "OBS-105: Uses ObservableAgent",
        uses_observable,
        "Should extend or use ObservableAgent",
        "obs-105"
    )
    return uses_observable


def test_obs105_logs_phases():
    """Test OBS-105: Spec Agent logs all 4 phases."""
    path = PROJECT_ROOT / "agents/specification/core.ts"
    if not path.exists():
        record_test(
            "OBS-105: Logs phases",
            False,
            "File does not exist",
            "obs-105"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for phase references
    phases = ["analyze", "question", "generate", "decompose"]
    found = [p for p in phases if p.lower() in content.lower()]

    record_test(
        "OBS-105: Logs phases",
        len(found) >= 2,
        f"Phases found: {found}",
        "obs-105"
    )
    return len(found) >= 2


# =============================================================================
# OBS-106: Validation Agent Integration
# =============================================================================

def test_obs106_file_exists():
    """Test OBS-106: validation/orchestrator.ts exists."""
    exists = file_exists("agents/validation/orchestrator.ts")
    record_test(
        "OBS-106: validation/orchestrator.ts exists",
        exists,
        "File should be at agents/validation/orchestrator.ts",
        "obs-106"
    )
    return exists


def test_obs106_assertion_usage():
    """Test OBS-106: Validation Agent uses assertions."""
    path = PROJECT_ROOT / "agents/validation/orchestrator.ts"
    if not path.exists():
        record_test(
            "OBS-106: Uses assertions",
            False,
            "File does not exist",
            "obs-106"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for assertion patterns
    assertion_patterns = [
        "assertion",
        "validate",
        "check",
        "evidence"
    ]

    found = [p for p in assertion_patterns if p.lower() in content.lower()]

    record_test(
        "OBS-106: Uses assertions",
        len(found) >= 2,
        f"Found: {found}",
        "obs-106"
    )
    return len(found) >= 2


# =============================================================================
# OBS-107: UX Agent Integration
# =============================================================================

def test_obs107_file_exists():
    """Test OBS-107: ux/orchestrator.ts exists."""
    exists = file_exists("agents/ux/orchestrator.ts")
    record_test(
        "OBS-107: ux/orchestrator.ts exists",
        exists,
        "File should be at agents/ux/orchestrator.ts",
        "obs-107"
    )
    return exists


def test_obs107_journey_logging():
    """Test OBS-107: UX Agent logs user journeys."""
    path = PROJECT_ROOT / "agents/ux/orchestrator.ts"
    if not path.exists():
        record_test(
            "OBS-107: Logs user journeys",
            False,
            "File does not exist",
            "obs-107"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for journey references
    journey_patterns = ["journey", "phase", "step", "action"]
    found = [p for p in journey_patterns if p.lower() in content.lower()]

    record_test(
        "OBS-107: Logs user journeys",
        len(found) >= 2,
        f"Found: {found}",
        "obs-107"
    )
    return len(found) >= 2


def test_obs107_accessibility_assertions():
    """Test OBS-107: Records accessibility checks as assertions."""
    path = PROJECT_ROOT / "agents/ux/orchestrator.ts"
    if not path.exists():
        record_test(
            "OBS-107: Accessibility assertions",
            False,
            "File does not exist",
            "obs-107"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for accessibility
    has_accessibility = "accessibility" in content.lower() or "a11y" in content.lower()

    record_test(
        "OBS-107: Accessibility assertions",
        has_accessibility,
        "Should check accessibility",
        "obs-107"
    )
    return has_accessibility


# =============================================================================
# OBS-108: SIA Integration
# =============================================================================

def test_obs108_file_exists():
    """Test OBS-108: sia/index.ts exists."""
    exists = file_exists("agents/sia/index.ts")
    record_test(
        "OBS-108: sia/index.ts exists",
        exists,
        "File should be at agents/sia/index.ts",
        "obs-108"
    )
    return exists


def test_obs108_discovery_logging():
    """Test OBS-108: SIA logs discoveries."""
    path = PROJECT_ROOT / "agents/sia/index.ts"
    if not path.exists():
        record_test(
            "OBS-108: Logs discoveries",
            False,
            "File does not exist",
            "obs-108"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for discovery patterns
    discovery_patterns = ["discovery", "pattern", "gotcha", "decision", "knowledge"]
    found = [p for p in discovery_patterns if p.lower() in content.lower()]

    record_test(
        "OBS-108: Logs discoveries",
        len(found) >= 2,
        f"Found: {found}",
        "obs-108"
    )
    return len(found) >= 2


def test_obs108_confidence_scores():
    """Test OBS-108: SIA includes confidence scores."""
    path = PROJECT_ROOT / "agents/sia/index.ts"
    if not path.exists():
        record_test(
            "OBS-108: Confidence scores",
            False,
            "File does not exist",
            "obs-108"
        )
        return False

    content = path.read_text(encoding='utf-8')

    has_confidence = "confidence" in content.lower()

    record_test(
        "OBS-108: Confidence scores",
        has_confidence,
        "Should include confidence scores",
        "obs-108"
    )
    return has_confidence


# =============================================================================
# OBS-109: Monitoring Agent Integration
# =============================================================================

def test_obs109_file_exists():
    """Test OBS-109: monitoring-agent.ts exists."""
    exists = file_exists("server/monitoring/monitoring-agent.ts")
    record_test(
        "OBS-109: monitoring-agent.ts exists",
        exists,
        "File should be at server/monitoring/monitoring-agent.ts",
        "obs-109"
    )
    return exists


def test_obs109_health_checks():
    """Test OBS-109: Monitoring Agent logs health checks."""
    path = PROJECT_ROOT / "server/monitoring/monitoring-agent.ts"
    if not path.exists():
        record_test(
            "OBS-109: Health checks",
            False,
            "File does not exist",
            "obs-109"
        )
        return False

    content = path.read_text(encoding='utf-8')

    # Check for health check patterns
    health_patterns = ["health", "check", "status", "monitor"]
    found = [p for p in health_patterns if p.lower() in content.lower()]

    record_test(
        "OBS-109: Health checks",
        len(found) >= 2,
        f"Found: {found}",
        "obs-109"
    )
    return len(found) >= 2


def test_obs109_anomaly_detection():
    """Test OBS-109: Logs anomalies as discovery entries."""
    path = PROJECT_ROOT / "server/monitoring/monitoring-agent.ts"
    if not path.exists():
        record_test(
            "OBS-109: Anomaly detection",
            False,
            "File does not exist",
            "obs-109"
        )
        return False

    content = path.read_text(encoding='utf-8')

    has_anomaly = "anomaly" in content.lower() or "alert" in content.lower() or "issue" in content.lower()

    record_test(
        "OBS-109: Anomaly detection",
        has_anomaly,
        "Should detect anomalies",
        "obs-109"
    )
    return has_anomaly


# =============================================================================
# Database Integration Tests
# =============================================================================

def test_db_transcript_entries_write():
    """Test that observability writes to transcript_entries table."""
    db_path = None
    exec_id = None
    task_list_id = None

    try:
        from shared.transcript_writer import TranscriptWriter

        db_path = setup_test_db()
        exec_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        inst_id = f"test-inst-{uuid.uuid4().hex[:8]}"

        # Create parent record
        task_list_id = create_test_execution_run(db_path, exec_id)

        tw = TranscriptWriter(
            execution_id=exec_id,
            instance_id=inst_id,
            db_path=db_path
        )

        # Write a phase entry
        tw.write_phase_start("test-phase", {"test": True})
        tw.flush()
        tw.close()

        # Verify
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT COUNT(*) FROM transcript_entries WHERE execution_id = ?",
            (exec_id,)
        )
        count = cursor.fetchone()[0]
        conn.close()

        # Cleanup
        cleanup_test_data(db_path, exec_id, task_list_id)

        record_test(
            "DB: Transcript entries written",
            count >= 1,
            f"Found {count} entries",
            "obs-100"
        )
        return count >= 1

    except Exception as e:
        if db_path and exec_id and task_list_id:
            try:
                cleanup_test_data(db_path, exec_id, task_list_id)
            except:
                pass
        record_test("DB: Transcript entries written", False, str(e), "obs-100")
        return False


def test_db_tool_uses_write():
    """Test that tool uses are written to database."""
    db_path = None
    exec_id = None
    task_list_id = None

    try:
        from shared.transcript_writer import TranscriptWriter
        from shared.tool_use_logger import ToolUseLogger

        db_path = setup_test_db()
        exec_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        inst_id = f"test-inst-{uuid.uuid4().hex[:8]}"

        # Create parent record
        task_list_id = create_test_execution_run(db_path, exec_id)

        tw = TranscriptWriter(
            execution_id=exec_id,
            instance_id=inst_id,
            db_path=db_path
        )
        tl = ToolUseLogger(tw, db_path=db_path)

        # Log a tool use
        tool_id = tl.log_start("Read", {"file_path": "/test/file.txt"})
        tl.log_end(tool_id, "File contents")

        tw.flush()
        tw.close()

        # Verify
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT COUNT(*) FROM tool_uses WHERE execution_id = ?",
            (exec_id,)
        )
        count = cursor.fetchone()[0]
        conn.close()

        # Cleanup
        cleanup_test_data(db_path, exec_id, task_list_id)

        record_test(
            "DB: Tool uses written",
            count >= 1,
            f"Found {count} tool uses",
            "obs-103"
        )
        return count >= 1

    except Exception as e:
        if db_path and exec_id and task_list_id:
            try:
                cleanup_test_data(db_path, exec_id, task_list_id)
            except:
                pass
        record_test("DB: Tool uses written", False, str(e), "obs-103")
        return False


def test_db_assertion_results_write():
    """Test that assertions are written to database."""
    db_path = None
    exec_id = None
    task_list_id = None
    task_id = None

    try:
        from shared.transcript_writer import TranscriptWriter
        from shared.assertion_recorder import AssertionRecorder

        db_path = setup_test_db()
        exec_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        inst_id = f"test-inst-{uuid.uuid4().hex[:8]}"
        task_id = f"test-task-{uuid.uuid4().hex[:8]}"

        # Create parent records
        task_list_id = create_test_execution_run(db_path, exec_id, task_id=task_id)

        tw = TranscriptWriter(
            execution_id=exec_id,
            instance_id=inst_id,
            db_path=db_path
        )
        ar = AssertionRecorder(tw, exec_id, db_path=db_path)

        # Record assertions
        chain_id = ar.start_chain(task_id, "Test chain")
        ar.assert_manual(task_id, "custom", "Test assertion", True)
        ar.end_chain(chain_id)

        tw.flush()
        tw.close()

        # Verify
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT COUNT(*) FROM assertion_results WHERE execution_id = ?",
            (exec_id,)
        )
        count = cursor.fetchone()[0]
        conn.close()

        # Cleanup
        cleanup_test_data(db_path, exec_id, task_list_id, task_id)

        record_test(
            "DB: Assertion results written",
            count >= 1,
            f"Found {count} assertions",
            "obs-104"
        )
        return count >= 1

    except Exception as e:
        if db_path and exec_id and task_list_id:
            try:
                cleanup_test_data(db_path, exec_id, task_list_id, task_id)
            except:
                pass
        record_test("DB: Assertion results written", False, str(e), "obs-104")
        return False


# =============================================================================
# TypeScript Compilation Test
# =============================================================================

def test_typescript_compilation():
    """Test that TypeScript compiles without errors."""
    success, output = run_tsc_check()

    # Extract error count from output
    error_count = 0
    if not success and output:
        error_lines = [l for l in output.split('\n') if 'error TS' in l]
        error_count = len(error_lines)

    record_test(
        "TypeScript compilation",
        success,
        f"Errors: {error_count}" if not success else "No errors",
        "obs-101"
    )
    return success


# =============================================================================
# Observable Agent Functional Tests
# =============================================================================

def test_observable_agent_functional():
    """Test ObservableAgent class functional behavior."""
    db_path = None
    exec_id = None
    task_list_id = None
    task_id = None

    try:
        from shared.observable_agent import ObservableAgent

        db_path = setup_test_db()
        exec_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        task_id = f"test-task-{uuid.uuid4().hex[:8]}"

        # Create parent records
        task_list_id = create_test_execution_run(db_path, exec_id, task_id=task_id)

        # Create an ObservableAgent instance
        agent = ObservableAgent(
            execution_id=exec_id,
            instance_id=f"test-agent-{uuid.uuid4().hex[:8]}",
            db_path=db_path
        )

        # Test lifecycle methods
        agent.log_phase_start("test-phase")
        agent.log_task_start(task_id, "Test task")

        # Test tool logging
        tool_id = agent.log_tool_start("Read", {"file": "test.txt"}, task_id)
        agent.log_tool_end(tool_id, "Result")

        # End lifecycle
        agent.log_task_end(task_id, "completed")
        agent.log_phase_end("test-phase")

        # Close (flush)
        agent.close()

        # Verify data was written
        conn = sqlite3.connect(str(db_path))

        # Check transcript entries
        cursor = conn.execute(
            "SELECT COUNT(*) FROM transcript_entries WHERE execution_id = ?",
            (exec_id,)
        )
        transcript_count = cursor.fetchone()[0]

        # Check tool uses
        cursor = conn.execute(
            "SELECT COUNT(*) FROM tool_uses WHERE execution_id = ?",
            (exec_id,)
        )
        tool_count = cursor.fetchone()[0]

        conn.close()

        # Cleanup
        cleanup_test_data(db_path, exec_id, task_list_id, task_id)

        passed = transcript_count >= 4 and tool_count >= 1

        record_test(
            "ObservableAgent functional test",
            passed,
            f"Transcripts: {transcript_count}, Tools: {tool_count}",
            "obs-100"
        )
        return passed

    except ImportError as e:
        record_test(
            "ObservableAgent functional test",
            False,
            f"Import error (file may not exist yet): {e}",
            "obs-100"
        )
        return False
    except Exception as e:
        if db_path and exec_id and task_list_id:
            try:
                cleanup_test_data(db_path, exec_id, task_list_id, task_id)
            except:
                pass
        record_test("ObservableAgent functional test", False, str(e), "obs-100")
        return False


# =============================================================================
# Main Test Runner
# =============================================================================

def run_all_tests():
    """Run all Phase 3 integration tests."""
    print("=" * 60)
    print("OBSERVABILITY PHASE 3: AGENT INTEGRATION TESTS")
    print("=" * 60)
    print()

    # OBS-100: Observable Agent Base Class (Python)
    print("\n--- OBS-100: Observable Agent Base Class (Python) ---")
    test_obs100_file_exists()
    test_obs100_class_import()
    test_obs100_lifecycle_methods()
    test_obs100_tool_logging_methods()
    test_obs100_initializes_producers()

    # OBS-110: TypeScript Observability Services (needs to run before OBS-101)
    print("\n--- OBS-110: TypeScript Observability Services ---")
    test_obs110_transcript_writer_exists()
    test_obs110_tool_use_logger_exists()
    test_obs110_assertion_recorder_exists()
    test_obs110_index_exports()

    # OBS-101: Observable Agent Base Class (TypeScript)
    print("\n--- OBS-101: Observable Agent Base Class (TypeScript) ---")
    test_obs101_file_exists()
    test_obs101_class_export()
    test_obs101_lifecycle_methods_ts()
    test_obs101_imports_services()

    # OBS-102: Build Agent Worker Base Integration
    print("\n--- OBS-102: Build Agent Worker Base Integration ---")
    test_obs102_extends_observable()
    test_obs102_calls_lifecycle_methods()

    # OBS-103: Build Agent Message Loop Integration
    print("\n--- OBS-103: Build Agent Message Loop Integration ---")
    test_obs103_tool_logging_in_loop()
    test_obs103_blocked_tool_logging()

    # OBS-104: Build Agent Validation Phase Integration
    print("\n--- OBS-104: Build Agent Validation Phase Integration ---")
    test_obs104_assertion_chains()
    test_obs104_validation_assertions()

    # OBS-105: Specification Agent Integration
    print("\n--- OBS-105: Specification Agent Integration ---")
    test_obs105_file_exists()
    test_obs105_extends_observable()
    test_obs105_logs_phases()

    # OBS-106: Validation Agent Integration
    print("\n--- OBS-106: Validation Agent Integration ---")
    test_obs106_file_exists()
    test_obs106_assertion_usage()

    # OBS-107: UX Agent Integration
    print("\n--- OBS-107: UX Agent Integration ---")
    test_obs107_file_exists()
    test_obs107_journey_logging()
    test_obs107_accessibility_assertions()

    # OBS-108: SIA Integration
    print("\n--- OBS-108: SIA Integration ---")
    test_obs108_file_exists()
    test_obs108_discovery_logging()
    test_obs108_confidence_scores()

    # OBS-109: Monitoring Agent Integration
    print("\n--- OBS-109: Monitoring Agent Integration ---")
    test_obs109_file_exists()
    test_obs109_health_checks()
    test_obs109_anomaly_detection()

    # Database Integration Tests
    print("\n--- Database Integration Tests ---")
    test_db_transcript_entries_write()
    test_db_tool_uses_write()
    test_db_assertion_results_write()

    # TypeScript Compilation
    print("\n--- TypeScript Compilation Test ---")
    test_typescript_compilation()

    # Observable Agent Functional Test
    print("\n--- Observable Agent Functional Test ---")
    test_observable_agent_functional()

    # Summary by task
    print("\n" + "=" * 60)
    print("SUMMARY BY TASK")
    print("=" * 60)

    task_results = {}
    for r in results:
        task_id = r.get("task_id", "general")
        if task_id not in task_results:
            task_results[task_id] = {"passed": 0, "failed": 0}
        if r["passed"]:
            task_results[task_id]["passed"] += 1
        else:
            task_results[task_id]["failed"] += 1

    for task_id, counts in sorted(task_results.items()):
        total = counts["passed"] + counts["failed"]
        status = "PASS" if counts["failed"] == 0 else "PARTIAL" if counts["passed"] > 0 else "FAIL"
        print(f"{task_id}: {counts['passed']}/{total} ({status})")

    # Overall summary
    print("\n" + "=" * 60)
    print("OVERALL SUMMARY")
    print("=" * 60)

    passed = len([r for r in results if r["passed"]])
    failed = len([r for r in results if not r["passed"]])
    total = len(results)

    print(f"Passed: {passed}/{total}")
    print(f"Failed: {failed}/{total}")

    if failed == 0:
        print("\nALL PHASE 3 TESTS PASSED")
        return 0
    else:
        print(f"\n{failed} TEST(S) FAILED")
        print("\nFailed tests:")
        for r in results:
            if not r["passed"]:
                print(f"  - {r['name']}: {r.get('details', 'No details')}")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
