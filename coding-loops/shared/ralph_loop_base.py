#!/usr/bin/env python3
"""
Ralph Loop Base Module
======================

Shared infrastructure for all coding loop harnesses.
Provides common functionality for test state management, transcript logging,
Claude SDK integration, configuration loading, and health checks.

Features:
- Config-based paths (no hardcoded paths)
- JSON Schema validation for test-state.json
- Health check heartbeat files
- Environment variable overrides

Usage:
    from shared.ralph_loop_base import RalphLoopRunner, load_config
"""

import asyncio
import json
import os
import sys
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tests" / "e2e"))

from claude_code_sdk import ClaudeSDKClient
from client import create_client

# Observability API client for HTTP-based logging
try:
    from observability_api import (
        create_execution_run,
        complete_execution_run,
        record_heartbeat,
        log_phase_start,
        log_phase_end,
        check_observable,
    )
    OBS_API_AVAILABLE = check_observable()
except ImportError:
    OBS_API_AVAILABLE = False


# =========================================================================
# Default Configuration
# =========================================================================

DEFAULT_CONFIG = {
    "model": "claude-opus-4-5-20251101",
    "max_attempts": 3,
    "auto_continue_delay": 3,
    "priority": 5,
    "health_check": {
        "enabled": True,
        "interval_seconds": 30,
        "file": "health.json"
    },
    "logging": {
        "transcript_tail_lines": 100,
        "max_transcript_chars": 50000
    }
}


# =========================================================================
# Schema Validation
# =========================================================================

def load_schema(schema_name: str) -> Optional[dict]:
    """Load a JSON schema from the shared directory."""
    schema_path = Path(__file__).parent / schema_name
    if schema_path.exists():
        with open(schema_path) as f:
            return json.load(f)
    return None


def validate_json(data: dict, schema: dict, name: str = "data") -> list[str]:
    """
    Validate JSON data against a schema.

    Returns list of validation errors (empty if valid).
    Falls back to basic validation if jsonschema not installed.
    """
    errors = []

    try:
        import jsonschema
        validator = jsonschema.Draft7Validator(schema)
        for error in validator.iter_errors(data):
            path = ".".join(str(p) for p in error.absolute_path) or "root"
            errors.append(f"{name}[{path}]: {error.message}")
    except ImportError:
        # Fallback: basic required field validation
        required = schema.get("required", [])
        for field in required:
            if field not in data:
                errors.append(f"{name}: missing required field '{field}'")

        # Validate test array structure if present
        if "tests" in data and isinstance(data["tests"], list):
            test_schema = schema.get("properties", {}).get("tests", {}).get("items", {})
            test_required = test_schema.get("required", [])
            for i, test in enumerate(data["tests"]):
                for field in test_required:
                    if field not in test:
                        errors.append(f"{name}.tests[{i}]: missing required field '{field}'")

    return errors


# =========================================================================
# Configuration Loading
# =========================================================================

def resolve_project_dir(config_dir: Path) -> Path:
    """
    Resolve the project directory.

    Priority:
    1. CODING_LOOP_PROJECT_DIR environment variable
    2. Go up from config_dir until we find package.json or .git
    3. Default to parent of coding-loops directory
    """
    # Check environment variable first
    env_dir = os.environ.get("CODING_LOOP_PROJECT_DIR")
    if env_dir:
        return Path(env_dir)

    # Walk up looking for project markers
    current = config_dir
    for _ in range(10):  # Max 10 levels up
        if (current / "package.json").exists() or (current / ".git").exists():
            return current
        parent = current.parent
        if parent == current:
            break
        current = parent

    # Default: assume coding-loops is in project root
    return config_dir.parent.parent


def load_config(config_path: Path) -> dict:
    """
    Load and validate a loop configuration file.

    Args:
        config_path: Path to config.json

    Returns:
        Validated configuration dictionary with resolved paths

    Raises:
        ValueError: If config is invalid
        FileNotFoundError: If config file doesn't exist
    """
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path) as f:
        config = json.load(f)

    # Merge with defaults
    merged = {**DEFAULT_CONFIG, **config}
    merged["health_check"] = {**DEFAULT_CONFIG["health_check"], **config.get("health_check", {})}
    merged["logging"] = {**DEFAULT_CONFIG["logging"], **config.get("logging", {})}

    # Validate against schema
    schema = load_schema("config_schema.json")
    if schema:
        errors = validate_json(config, schema, "config")
        if errors:
            raise ValueError(f"Config validation errors:\n" + "\n".join(errors))

    # Resolve paths
    config_dir = config_path.parent
    project_dir = resolve_project_dir(config_dir)

    # specs_dir can be relative to project or absolute
    specs_dir_str = merged["specs_dir"]
    if Path(specs_dir_str).is_absolute():
        specs_dir = Path(specs_dir_str)
    else:
        specs_dir = project_dir / specs_dir_str

    # test_state_file is relative to specs_dir or absolute
    test_state_str = merged.get("test_state_file", "test-state.json")
    if Path(test_state_str).is_absolute():
        test_state_file = Path(test_state_str)
    else:
        test_state_file = specs_dir / test_state_str

    # Add resolved paths to config
    merged["_resolved"] = {
        "project_dir": project_dir,
        "specs_dir": specs_dir,
        "test_state_file": test_state_file,
        "config_dir": config_dir
    }

    return merged


# =========================================================================
# Health Check
# =========================================================================

class HealthCheck:
    """Manages health check heartbeat files."""

    def __init__(self, loop_name: str, specs_dir: Path, config: dict):
        self.loop_name = loop_name
        self.enabled = config.get("enabled", True)
        self.interval = config.get("interval_seconds", 30)
        self.file_name = config.get("file", "health.json")
        self.health_file = specs_dir / self.file_name
        self.last_update = datetime.min.replace(tzinfo=timezone.utc)
        self._current_test = None
        self._status = "starting"
        self._progress = {"passed": 0, "total": 0}

    def update(
        self,
        status: str = "running",
        current_test: Optional[str] = None,
        progress: Optional[dict] = None
    ) -> None:
        """Update health check file if interval has passed."""
        if not self.enabled:
            return

        now = datetime.now(timezone.utc)

        # Update internal state
        self._status = status
        if current_test is not None:
            self._current_test = current_test
        if progress is not None:
            self._progress = progress

        # Only write to file if interval has passed
        elapsed = (now - self.last_update).total_seconds()
        if elapsed >= self.interval or status in ("starting", "stopped", "error"):
            self._write_health_file(now)
            self.last_update = now

    def _write_health_file(self, now: datetime) -> None:
        """Write the health check file."""
        health_data = {
            "loop_name": self.loop_name,
            "status": self._status,
            "current_test": self._current_test,
            "progress": self._progress,
            "last_heartbeat": now.isoformat().replace("+00:00", "Z"),
            "pid": os.getpid()
        }

        try:
            with open(self.health_file, "w") as f:
                json.dump(health_data, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not write health file: {e}")

    def stop(self) -> None:
        """Mark the loop as stopped."""
        self.update(status="stopped")


# =========================================================================
# Ralph Loop Base Class
# =========================================================================

class RalphLoopRunner(ABC):
    """
    Abstract base class for Ralph loop runners.

    Subclasses must implement:
    - get_spec_content(test_id: str) -> str
    - build_system_prompt() -> str

    Can be initialized with explicit paths or a config file:

        # Explicit paths (legacy)
        runner = MyLoop(
            name="My Loop",
            project_dir=Path("/path/to/project"),
            specs_dir=Path("/path/to/specs"),
            test_state_file=Path("/path/to/test-state.json"),
            model="claude-opus-4-5-20251101"
        )

        # Config-based (preferred)
        config = load_config(Path("./config.json"))
        runner = MyLoop.from_config(config)
    """

    def __init__(
        self,
        name: str,
        project_dir: Path,
        specs_dir: Path,
        test_state_file: Path,
        model: str = DEFAULT_CONFIG["model"],
        max_iterations: Optional[int] = None,
        max_attempts: int = DEFAULT_CONFIG["max_attempts"],
        auto_continue_delay: int = DEFAULT_CONFIG["auto_continue_delay"],
        health_check_config: Optional[dict] = None,
        logging_config: Optional[dict] = None,
    ):
        self.name = name
        self.project_dir = project_dir
        self.specs_dir = specs_dir
        self.test_state_file = test_state_file
        self.model = model
        self.max_iterations = max_iterations
        self.max_attempts = max_attempts
        self.auto_continue_delay = auto_continue_delay

        # Logging config
        log_config = logging_config or DEFAULT_CONFIG["logging"]
        self.transcript_tail_lines = log_config.get("transcript_tail_lines", 100)
        self.max_transcript_chars = log_config.get("max_transcript_chars", 50000)

        # Derived paths
        self.logs_dir = specs_dir / "logs"
        self.transcript_dir = self.logs_dir / "transcripts"
        self.global_transcript_file = self.transcript_dir / "global-transcript.log"

        # Ensure directories exist
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.transcript_dir.mkdir(parents=True, exist_ok=True)

        # Health check
        hc_config = health_check_config or DEFAULT_CONFIG["health_check"]
        self.health = HealthCheck(name, specs_dir, hc_config)

        # Observability tracking
        self._obs_execution_id: Optional[str] = None

    @classmethod
    def from_config(cls, config: dict, max_iterations: Optional[int] = None) -> "RalphLoopRunner":
        """
        Create a runner from a loaded config dictionary.

        Args:
            config: Config dict from load_config()
            max_iterations: Override max iterations

        Returns:
            Configured runner instance
        """
        resolved = config["_resolved"]
        return cls(
            name=config["name"],
            project_dir=resolved["project_dir"],
            specs_dir=resolved["specs_dir"],
            test_state_file=resolved["test_state_file"],
            model=config.get("model", DEFAULT_CONFIG["model"]),
            max_iterations=max_iterations,
            max_attempts=config.get("max_attempts", DEFAULT_CONFIG["max_attempts"]),
            auto_continue_delay=config.get("auto_continue_delay", DEFAULT_CONFIG["auto_continue_delay"]),
            health_check_config=config.get("health_check"),
            logging_config=config.get("logging"),
        )

    # =========================================================================
    # Abstract methods - must be implemented by subclasses
    # =========================================================================

    @abstractmethod
    def get_spec_content(self, test_id: str) -> str:
        """Get the spec content for a given test ID."""
        pass

    @abstractmethod
    def build_system_prompt(self) -> str:
        """Build the system prompt for this loop."""
        pass

    # =========================================================================
    # Test state management
    # =========================================================================

    def load_test_state(self) -> dict:
        """Load and validate test state from JSON file."""
        if not self.test_state_file.exists():
            print(f"ERROR: Test state file not found: {self.test_state_file}")
            sys.exit(1)

        with open(self.test_state_file) as f:
            state = json.load(f)

        # Validate against schema
        schema = load_schema("test_state_schema.json")
        if schema:
            errors = validate_json(state, schema, "test-state")
            if errors:
                print("WARNING: Test state validation errors:")
                for error in errors[:5]:  # Show first 5 errors
                    print(f"  - {error}")
                if len(errors) > 5:
                    print(f"  ... and {len(errors) - 5} more")

        return state

    def save_test_state(self, state: dict) -> None:
        """Save test state to JSON file."""
        state["lastUpdated"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        with open(self.test_state_file, "w") as f:
            json.dump(state, f, indent=2)

    def get_next_pending_test(self, state: dict) -> Optional[dict]:
        """Find the next pending test that has its dependencies met."""
        for test in state["tests"]:
            if test["status"] != "pending":
                continue

            # Check dependency
            if test.get("dependsOn"):
                dep_test = next(
                    (t for t in state["tests"] if t["id"] == test["dependsOn"]),
                    None
                )
                if dep_test and dep_test["status"] != "passed":
                    continue

            return test

        return None

    def update_summary(self, state: dict) -> None:
        """Update the summary counts."""
        summary = state["summary"]
        summary["passed"] = sum(1 for t in state["tests"] if t["status"] == "passed")
        summary["failed"] = sum(1 for t in state["tests"] if t["status"] == "failed")
        summary["blocked"] = sum(1 for t in state["tests"] if t["status"] == "blocked")
        summary["pending"] = sum(1 for t in state["tests"] if t["status"] == "pending")

    def print_progress(self, state: dict) -> None:
        """Print current progress."""
        summary = state["summary"]
        total = summary["total"]
        passed = summary["passed"]
        blocked = summary["blocked"]
        pending = summary["pending"]

        if total > 0:
            percentage = (passed / total) * 100
            print(f"\nProgress: {passed}/{total} tests passing ({percentage:.1f}%)")
            print(f"  Blocked: {blocked} | Pending: {pending}")
        else:
            print("\nProgress: No tests defined")

    # =========================================================================
    # Transcript management
    # =========================================================================

    def get_transcript_path(self, test_id: str, attempt: int) -> Path:
        """Get the path to a transcript file for a specific test and attempt."""
        test_dir = self.transcript_dir / test_id
        test_dir.mkdir(parents=True, exist_ok=True)
        return test_dir / f"attempt-{attempt}.log"

    def save_transcript(self, test_id: str, attempt: int, transcript: str) -> None:
        """Save a transcript to disk."""
        path = self.get_transcript_path(test_id, attempt)
        path.write_text(transcript)
        print(f"Transcript saved to: {path}")

    def load_previous_transcripts(
        self,
        test_id: str,
        current_attempt: int,
    ) -> str:
        """Load all previous attempt transcripts for a test."""
        transcripts = []
        total_chars = 0

        for attempt in range(current_attempt - 1, 0, -1):
            path = self.get_transcript_path(test_id, attempt)
            if path.exists():
                content = path.read_text()

                if total_chars + len(content) > self.max_transcript_chars:
                    remaining = self.max_transcript_chars - total_chars
                    if remaining > 1000:
                        content = content[:remaining] + "\n\n[... truncated ...]"
                        transcripts.insert(0, f"## Previous Attempt {attempt}\n\n{content}")
                    break

                total_chars += len(content)
                transcripts.insert(0, f"## Previous Attempt {attempt}\n\n{content}")

        if transcripts:
            return "\n\n---\n\n".join(transcripts)
        return ""

    def clear_transcripts(self, test_id: str) -> None:
        """Clear all transcripts for a test (called when test passes)."""
        test_dir = self.transcript_dir / test_id
        if test_dir.exists():
            for f in test_dir.glob("*.log"):
                f.unlink()
            print(f"Cleared transcripts for {test_id}")

    def append_to_global_transcript(self, test_id: str, transcript: str) -> None:
        """Append to the global transcript file."""
        separator = f"\n\n{'='*60}\n=== {test_id} ===\n{'='*60}\n\n"
        with open(self.global_transcript_file, "a") as f:
            f.write(separator + transcript)

    def load_transcript_tail(self) -> str:
        """Load the last N lines from the global transcript."""
        if not self.global_transcript_file.exists():
            return ""

        lines = self.global_transcript_file.read_text().splitlines()
        if len(lines) <= self.transcript_tail_lines:
            return "\n".join(lines)

        return "\n".join(lines[-self.transcript_tail_lines:])

    # =========================================================================
    # Prompt building
    # =========================================================================

    def build_prompt(
        self,
        test: dict,
        previous_transcripts: str = "",
        global_transcript: str = ""
    ) -> str:
        """Build the prompt for the agent."""
        spec_content = self.get_spec_content(test["id"])

        prompt = f"""# {self.name} Implementation Task

## Current Test: {test['id']}

**Description**: {test['notes']}
**Category**: {test.get('category', 'unknown')}
**Attempts**: {test['attempts']}
**Depends On**: {test.get('dependsOn') or 'None'}
"""

        if global_transcript:
            prompt += f"""
## Recent Activity

```
{global_transcript}
```

"""

        if previous_transcripts:
            prompt += f"""
## IMPORTANT: Previous Attempts of THIS Test

This specific test ({test['id']}) has been attempted before. Review what happened:

{previous_transcripts}

## Key Instructions for This Retry

1. **DO NOT** re-implement code that was already successfully added
2. **CHECK** if the endpoint/function/component already exists before creating it
3. **FOCUS** on what's still failing or missing
4. Review errors from previous attempts and fix them
5. If code exists but tests fail, debug the existing code instead of rewriting

"""

        prompt += f"""## Your Task

1. Read the spec content below to understand what needs to be implemented
2. Find the section relevant to {test['id']}
3. {"Check what was already implemented in previous attempts and continue" if previous_transcripts else "Implement the code following the requirements"}
4. Verify ALL pass criteria are met
5. If ALL criteria are met, say "TEST PASSED: {test['id']}"
6. If any criteria fail, try to fix them
7. After {self.max_attempts} failed attempts, say "TEST BLOCKED: {test['id']}" with reason

## Spec Content

{spec_content}

## CRITICAL RULES

### File Reading Rules
- **File limit is 25000 tokens** - use Grep first for large files
- For large files, use `offset` and `limit` parameters
- Known large files: server/routes/ideation.ts, frontend reducers

### Implementation Rules
- Implement ONLY what is needed for {test['id']}
- Verify ALL pass criteria
- Run verification commands to confirm
- If the test passes, say "TEST PASSED: {test['id']}"
- If the test fails, explain what failed and try to fix it

### TypeScript Rules
- Run `npx tsc --noEmit` to check for type errors
- Export new types/interfaces from files
- Import types explicitly when using in other files

## Current Test State

```json
{json.dumps(test, indent=2)}
```

Begin implementation.
"""
        return prompt

    # =========================================================================
    # Agent session
    # =========================================================================

    async def run_agent_session(
        self,
        client: ClaudeSDKClient,
        prompt: str
    ) -> tuple[str, str, str]:
        """
        Run a single agent session.

        Returns:
            (status, response_text, full_transcript) where:
            - status: 'passed', 'blocked', 'continue', or 'error'
            - response_text: just the assistant's text responses
            - full_transcript: full log of what happened
        """
        print("Sending prompt to Claude Agent SDK...\n")

        transcript_lines = []

        def log(text: str, end: str = "\n"):
            print(text, end=end)
            transcript_lines.append(text)

        try:
            await client.query(prompt)

            response_text = ""
            tool_calls = 0

            async for msg in client.receive_response():
                msg_type = type(msg).__name__

                if msg_type == "ResultMessage":
                    num_turns = getattr(msg, "num_turns", 0)
                    log(f"\n[Session complete: {num_turns} turns, {tool_calls} tool calls]")

                elif msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__

                        if block_type == "TextBlock" and hasattr(block, "text"):
                            response_text += block.text
                            log(block.text, end="")
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            tool_calls += 1
                            tool_input = ""
                            if hasattr(block, "input"):
                                input_str = str(block.input)
                                if len(input_str) > 500:
                                    tool_input = f"\n  Input: {input_str[:500]}..."
                                else:
                                    tool_input = f"\n  Input: {input_str}"
                            log(f"\n[Tool #{tool_calls}: {block.name}]{tool_input}")

                elif msg_type == "UserMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        if type(block).__name__ == "ToolResultBlock":
                            is_error = getattr(block, "is_error", False)
                            result_content = getattr(block, "content", "")
                            result_str = str(result_content)

                            if is_error:
                                error_preview = result_str[:500] if len(result_str) > 500 else result_str
                                log(f"  [Error] {error_preview}")
                            else:
                                if len(result_str) > 100:
                                    log(f"  [Done] Preview: {result_str[:100]}...")
                                else:
                                    log(f"  [Done]")

            log("\n" + "-" * 70 + "\n")

            full_transcript = "\n".join(transcript_lines)

            if "TEST PASSED:" in response_text:
                return "passed", response_text, full_transcript
            elif "TEST BLOCKED:" in response_text:
                return "blocked", response_text, full_transcript
            else:
                return "continue", response_text, full_transcript

        except Exception as e:
            error_msg = f"Error during session: {e}"
            print(error_msg)
            transcript_lines.append(error_msg)
            return "error", str(e), "\n".join(transcript_lines)

    # =========================================================================
    # Main loop
    # =========================================================================

    async def run(self) -> int:
        """Main entry point for the loop."""
        print("\n" + "=" * 70)
        print(f"  {self.name.upper()}")
        print("=" * 70)
        print(f"\nProject: {self.project_dir}")
        print(f"Specs: {self.specs_dir}")
        print(f"Model: {self.model}")
        print(f"Max iterations: {self.max_iterations or 'Unlimited'}")
        print(f"Max attempts per test: {self.max_attempts}")

        # Update health check
        self.health.update(status="starting")

        state = self.load_test_state()
        self.print_progress(state)

        # Update health with progress
        self.health.update(
            status="running",
            progress={"passed": state["summary"]["passed"], "total": state["summary"]["total"]}
        )

        # Create observability execution run if API is available
        if OBS_API_AVAILABLE:
            try:
                # Use a task list ID based on the loop name and test state
                task_list_id = f"ralph-loop-{self.name.lower().replace(' ', '-')}"
                self._obs_execution_id = create_execution_run(
                    task_list_id=task_list_id,
                    source="ralph-loop"
                )
                print(f"Created observability execution: {self._obs_execution_id}")
            except Exception as e:
                print(f"Warning: Could not create observability execution: {e}")

        iteration = 0

        try:
            while True:
                iteration += 1

                if self.max_iterations and iteration > self.max_iterations:
                    print(f"\nReached max iterations ({self.max_iterations})")
                    break

                test = self.get_next_pending_test(state)

                if not test:
                    self.update_summary(state)
                    if state["summary"]["pending"] == 0:
                        print("\n" + "=" * 70)
                        print("  ALL TESTS COMPLETE!")
                        print("=" * 70)
                        self.print_progress(state)
                        break
                    else:
                        print("\nNo runnable tests (dependencies not met)")
                        break

                print("\n" + "=" * 70)
                print(f"  ITERATION {iteration}: {test['id']}")
                print(f"  {test['notes']}")
                print("=" * 70)

                # Log phase start for this test iteration
                phase_id = None
                if OBS_API_AVAILABLE and self._obs_execution_id:
                    try:
                        phase_id = log_phase_start(
                            execution_id=self._obs_execution_id,
                            phase_name=f"Test: {test['id']}",
                            metadata={"iteration": iteration, "attempt": test.get("attempts", 0) + 1}
                        )
                    except Exception as e:
                        print(f"Warning: Could not log phase start: {e}")

                # Update health check
                self.health.update(
                    current_test=test['id'],
                    progress={"passed": state["summary"]["passed"], "total": state["summary"]["total"]}
                )

                # Increment attempts
                test["attempts"] += 1
                test["lastAttemptAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                current_attempt = test["attempts"]
                self.save_test_state(state)

                # Load context
                transcript_tail = self.load_transcript_tail()
                previous_transcripts = self.load_previous_transcripts(test["id"], current_attempt)

                if transcript_tail:
                    print(f"Loaded last {len(transcript_tail.splitlines())} lines from transcript")
                if previous_transcripts:
                    print(f"Loaded transcripts from {current_attempt - 1} previous attempt(s)")

                # Build prompt
                prompt = self.build_prompt(test, previous_transcripts, transcript_tail)

                # Create client
                client = create_client(self.project_dir, self.model)

                # Run session
                try:
                    async with client:
                        status, response, transcript = await self.run_agent_session(client, prompt)
                except KeyboardInterrupt:
                    print("\n\nInterrupted! Saving partial transcript...")
                    partial = "[INTERRUPTED]\n\nPartial session - user pressed Ctrl+C"
                    self.save_transcript(test["id"], current_attempt, partial)
                    self.append_to_global_transcript(test["id"], partial)
                    raise

                # Save transcripts
                self.save_transcript(test["id"], current_attempt, transcript)
                self.append_to_global_transcript(test["id"], transcript)

                # Update test status
                if status == "passed":
                    test["status"] = "passed"
                    test["lastResult"] = "pass"
                    test["passedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                    self.clear_transcripts(test["id"])
                    print(f"\n{test['id']} PASSED")
                elif status == "blocked":
                    test["status"] = "blocked"
                    test["lastResult"] = "blocked"
                    print(f"\n{test['id']} BLOCKED")
                elif status == "error":
                    test["lastResult"] = "error"
                    if test["attempts"] >= self.max_attempts:
                        test["status"] = "blocked"
                        print(f"\n{test['id']} BLOCKED (max attempts after error)")
                    else:
                        print(f"\n{test['id']} errored, will retry (attempt {test['attempts']}/{self.max_attempts})")
                elif test["attempts"] >= self.max_attempts:
                    test["status"] = "blocked"
                    test["lastResult"] = "blocked"
                    print(f"\n{test['id']} BLOCKED (max attempts)")
                else:
                    test["lastResult"] = "continue"
                    print(f"\n{test['id']} needs retry (attempt {test['attempts']}/{self.max_attempts})")

                # Update and save
                self.update_summary(state)
                self.save_test_state(state)

                self.print_progress(state)

                # Update health
                self.health.update(
                    progress={"passed": state["summary"]["passed"], "total": state["summary"]["total"]}
                )

                # Log phase end for this test iteration
                if OBS_API_AVAILABLE and phase_id:
                    try:
                        log_phase_end(
                            phase_id=phase_id,
                            status=test.get("lastResult", "continue"),
                            summary=f"Test {test['id']}: {test.get('lastResult', 'continue')}"
                        )
                    except Exception as e:
                        print(f"Warning: Could not log phase end: {e}")

                print(f"\nContinuing in {self.auto_continue_delay}s...")
                await asyncio.sleep(self.auto_continue_delay)

        finally:
            # Always update health on exit
            self.health.stop()

            # Complete observability execution run
            if OBS_API_AVAILABLE and self._obs_execution_id:
                try:
                    # Determine status based on summary
                    final_status = "completed" if state["summary"]["pending"] == 0 else "failed"
                    complete_execution_run(self._obs_execution_id, status=final_status)
                    print(f"Completed observability execution: {self._obs_execution_id}")
                except Exception as e:
                    print(f"Warning: Could not complete observability execution: {e}")

        print("\n" + "=" * 70)
        print("  DONE")
        print("=" * 70)
        self.print_progress(state)

        return 0
