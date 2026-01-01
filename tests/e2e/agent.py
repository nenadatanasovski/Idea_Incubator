"""
Agent Session Logic for E2E Testing
====================================

Core agent interaction functions for running E2E test sessions.
Based on auto-build-agent patterns.
"""

import asyncio
import json
from pathlib import Path
from typing import Optional
from collections import deque

from claude_code_sdk import ClaudeSDKClient

from client import create_client


# Configuration
AUTO_CONTINUE_DELAY_SECONDS = 3
TRANSCRIPT_LINES = 100  # Keep last N lines for next session


class TranscriptWriter:
    """Captures output to both console and a rolling transcript file."""

    def __init__(self, transcript_path: Path, max_lines: int = TRANSCRIPT_LINES):
        self.transcript_path = transcript_path
        self.max_lines = max_lines
        self.lines: deque = deque(maxlen=max_lines)
        # Load existing lines if file exists
        if transcript_path.exists():
            try:
                with open(transcript_path) as f:
                    for line in f:
                        self.lines.append(line.rstrip('\n'))
            except IOError:
                pass

    def write(self, text: str, end: str = '\n', flush: bool = True):
        """Print to console and save to transcript."""
        print(text, end=end, flush=flush)
        # Split by newlines and add each line
        full_text = text + (end if end != '\n' else '')
        for line in full_text.split('\n'):
            if line:  # Skip empty lines from split
                self.lines.append(line)
        self._save()

    def _save(self):
        """Save current lines to file."""
        try:
            with open(self.transcript_path, 'w') as f:
                f.write('\n'.join(self.lines) + '\n')
        except IOError:
            pass


# Global transcript writer (set in run_e2e_agent)
_transcript: Optional[TranscriptWriter] = None


def log(text: str, end: str = '\n', flush: bool = True):
    """Log to console and transcript."""
    if _transcript:
        _transcript.write(text, end=end, flush=flush)
    else:
        print(text, end=end, flush=flush)


def get_prompt(prompts_dir: Path, e2e_dir: Path) -> str:
    """Load the E2E agent prompt."""
    prompt_file = prompts_dir / "E2E-AGENT.md"

    if prompt_file.exists():
        return prompt_file.read_text()
    else:
        return """
# E2E-AGENT

Read tests/e2e/progress.txt and tests/e2e/test-state.json.
Find the next pending test and FIX CODE to make it pass.
Commit after each test.
"""


def get_test_progress(e2e_dir: Path) -> tuple[int, int, int]:
    """
    Get test progress from test-state.json.

    Returns:
        (passed, blocked, pending)
    """
    state_file = e2e_dir / "test-state.json"
    if not state_file.exists():
        return 0, 0, 0

    try:
        with open(state_file) as f:
            state = json.load(f)
        summary = state.get("summary", {})
        return (
            summary.get("passed", 0),
            summary.get("blocked", 0),
            summary.get("pending", 0)
        )
    except (json.JSONDecodeError, IOError):
        return 0, 0, 0


def print_session_header(session_num: int, model: str) -> None:
    """Print formatted session header."""
    log("\n" + "=" * 70)
    log(f"  SESSION {session_num}: E2E-AGENT")
    log(f"  Model: {model}")
    log("=" * 70)
    log("")


def print_progress_summary(e2e_dir: Path) -> None:
    """Print current progress."""
    passed, blocked, pending = get_test_progress(e2e_dir)
    total = passed + blocked + pending

    if total > 0:
        percentage = (passed / total) * 100
        log(f"\nProgress: {passed}/{total} tests passing ({percentage:.1f}%)")
        log(f"  Blocked: {blocked} | Pending: {pending}")
    else:
        log("\nProgress: test-state.json not found")


async def run_agent_session(
    client: ClaudeSDKClient,
    message: str,
) -> tuple[str, str, dict]:
    """
    Run a single agent session with turn tracking.

    Returns:
        (status, response_text, stats) where stats contains turn and usage info
    """
    log("Sending prompt to Claude Agent SDK...\n")

    stats = {"tool_calls": 0, "num_turns": 0, "usage": None}

    try:
        await client.query(message)

        response_text = ""
        async for msg in client.receive_response():
            msg_type = type(msg).__name__

            # Track ResultMessage for final stats
            if msg_type == "ResultMessage":
                stats["num_turns"] = getattr(msg, "num_turns", 0)
                stats["usage"] = getattr(msg, "usage", None)
                log(f"\n[Session complete: {stats['num_turns']} turns, {stats['tool_calls']} tool calls]")

            elif msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__

                    if block_type == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text
                        log(block.text, end="")
                    elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                        stats["tool_calls"] += 1
                        # Log tool call
                        log(f"\n[Tool #{stats['tool_calls']}: {block.name}]")
                        if hasattr(block, "input"):
                            input_str = str(block.input)
                            if len(input_str) > 200:
                                log(f"  Input: {input_str[:200]}...")
                            else:
                                log(f"  Input: {input_str}")

            elif msg_type == "UserMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__

                    if block_type == "ToolResultBlock":
                        result_content = getattr(block, "content", "")
                        is_error = getattr(block, "is_error", False)

                        # Check for security hook blocking (specific format)
                        result_str = str(result_content)
                        is_security_blocked = (
                            "decision" in result_str and
                            "block" in result_str and
                            "reason" in result_str
                        )

                        if is_security_blocked:
                            log(f"  [SECURITY BLOCKED] {result_str[:200]}")
                        elif is_error:
                            error_str = result_str[:300]
                            log(f"  [Error] {error_str}")
                        else:
                            # Show preview of result for context
                            if result_str and len(result_str) > 10:
                                preview = result_str[:500].replace('\n', ' ')[:200]
                                log(f"  [Done] {preview}...")
                            else:
                                log("  [Done]")

        log("\n" + "-" * 70 + "\n")
        return "continue", response_text, stats

    except Exception as e:
        log(f"Error during agent session: {e}")
        return "error", str(e), stats


async def run_e2e_agent(
    project_dir: Path,
    model: str,
    max_iterations: Optional[int] = None,
) -> None:
    """
    Run the E2E testing agent loop.

    Each iteration creates a FRESH client (fresh context window).
    The agent reads progress.txt and test-state.json to understand previous work.
    The agent also reads transcript.log to see what the previous session was doing.
    Git commits after each test preserve progress across context boundaries.

    Args:
        project_dir: Project root directory
        model: Claude model to use
        max_iterations: Max iterations (None for unlimited)
    """
    global _transcript

    e2e_dir = project_dir / "tests" / "e2e"
    prompts_dir = e2e_dir / "prompts"
    logs_dir = e2e_dir / "logs"
    logs_dir.mkdir(exist_ok=True)

    # Initialize transcript writer
    _transcript = TranscriptWriter(logs_dir / "transcript.log")

    log("\n" + "=" * 70)
    log("  RALPH LOOP - E2E TESTING AGENT")
    log("=" * 70)
    log(f"\nProject: {project_dir}")
    log(f"Model: {model}")
    if max_iterations:
        log(f"Max iterations: {max_iterations}")
    else:
        log("Max iterations: Unlimited")
    log("")

    print_progress_summary(e2e_dir)

    iteration = 0

    while True:
        iteration += 1

        if max_iterations and iteration > max_iterations:
            log(f"\nReached max iterations ({max_iterations})")
            break

        # Check if all tests done
        passed, blocked, pending = get_test_progress(e2e_dir)
        if pending == 0:
            log("\n" + "=" * 70)
            log("  ALL TESTS COMPLETE!")
            log("=" * 70)
            log(f"\nPassed: {passed} | Blocked: {blocked}")
            break

        print_session_header(iteration, model)

        # Create fresh client (fresh context window)
        client = create_client(project_dir, model)

        # Load prompt - agent will read progress.txt in GET BEARINGS step
        prompt = get_prompt(prompts_dir, e2e_dir)

        # Run session with fresh context
        async with client:
            status, response, stats = await run_agent_session(client, prompt)

        # Log session stats
        log(f"\nSession {iteration} stats: {stats['num_turns']} turns, {stats['tool_calls']} tool calls")
        if stats.get('usage'):
            log(f"  Token usage: {stats['usage']}")

        print_progress_summary(e2e_dir)

        if status == "continue":
            log(f"\nAuto-continuing in {AUTO_CONTINUE_DELAY_SECONDS}s...")
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)
        elif status == "error":
            log("\nSession error - retrying...")
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        await asyncio.sleep(1)

    # Final summary
    log("\n" + "=" * 70)
    log("  SESSION COMPLETE")
    log("=" * 70)
    print_progress_summary(e2e_dir)
    log("\nDone!")
