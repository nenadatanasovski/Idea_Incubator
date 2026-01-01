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

from claude_code_sdk import ClaudeSDKClient

from client import create_client


# Configuration
AUTO_CONTINUE_DELAY_SECONDS = 3


def get_prompt(prompts_dir: Path, e2e_dir: Path) -> str:
    """Load the E2E agent prompt."""
    prompt_file = prompts_dir / "E2E-AGENT.md"

    if prompt_file.exists():
        return prompt_file.read_text()
    else:
        return """
# E2E-AGENT

Read tests/e2e/HANDOFF.md and tests/e2e/test-state.json.
Find the next pending test and FIX CODE to make it pass.
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
    print("\n" + "=" * 70)
    print(f"  SESSION {session_num}: E2E-AGENT")
    print(f"  Model: {model}")
    print("=" * 70)
    print()


def print_progress_summary(e2e_dir: Path) -> None:
    """Print current progress."""
    passed, blocked, pending = get_test_progress(e2e_dir)
    total = passed + blocked + pending

    if total > 0:
        percentage = (passed / total) * 100
        print(f"\nProgress: {passed}/{total} tests passing ({percentage:.1f}%)")
        print(f"  Blocked: {blocked} | Pending: {pending}")
    else:
        print("\nProgress: test-state.json not found")


WRAP_UP_THRESHOLD = 30  # Tool calls before we remind agent to wrap up


async def run_agent_session(
    client: ClaudeSDKClient,
    message: str,
) -> tuple[str, str, dict]:
    """
    Run a single agent session with turn tracking.

    Returns:
        (status, response_text, stats) where stats contains turn and usage info
    """
    print("Sending prompt to Claude Agent SDK...\n")

    stats = {"tool_calls": 0, "num_turns": 0, "usage": None, "wrap_up_reminded": False}

    try:
        await client.query(message)

        response_text = ""
        async for msg in client.receive_response():
            msg_type = type(msg).__name__

            # Track ResultMessage for final stats
            if msg_type == "ResultMessage":
                stats["num_turns"] = getattr(msg, "num_turns", 0)
                stats["usage"] = getattr(msg, "usage", None)
                print(f"\n[Session complete: {stats['num_turns']} turns, {stats['tool_calls']} tool calls]", flush=True)

            elif msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__

                    if block_type == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text
                        print(block.text, end="", flush=True)
                    elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                        stats["tool_calls"] += 1
                        # Print tool call count
                        print(f"\n[Tool #{stats['tool_calls']}: {block.name}]", flush=True)
                        if hasattr(block, "input"):
                            input_str = str(block.input)
                            if len(input_str) > 200:
                                print(f"  Input: {input_str[:200]}...", flush=True)
                            else:
                                print(f"  Input: {input_str}", flush=True)

                        # Wrap-up reminder at threshold
                        if stats["tool_calls"] == WRAP_UP_THRESHOLD and not stats["wrap_up_reminded"]:
                            stats["wrap_up_reminded"] = True
                            print(f"\n{'='*60}", flush=True)
                            print(f"⏰ TOOL CALL {WRAP_UP_THRESHOLD} REACHED - TIME TO WRAP UP!", flush=True)
                            print("You MUST now:", flush=True)
                            print("1. Finish current action", flush=True)
                            print("2. Update test-state.json", flush=True)
                            print("3. Commit changes (git add -A && git commit)", flush=True)
                            print("4. Write HANDOFF.md for next session", flush=True)
                            print("5. Say 'Session complete - handoff written'", flush=True)
                            print(f"{'='*60}\n", flush=True)

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
                            print(f"  [SECURITY BLOCKED] {result_str[:200]}", flush=True)
                        elif is_error:
                            error_str = result_str[:300]
                            print(f"  [Error] {error_str}", flush=True)
                        else:
                            print("  [Done]", flush=True)

        print("\n" + "-" * 70 + "\n")
        return "continue", response_text, stats

    except Exception as e:
        print(f"Error during agent session: {e}")
        return "error", str(e), stats


async def run_e2e_agent(
    project_dir: Path,
    model: str,
    max_iterations: Optional[int] = None,
) -> None:
    """
    Run the E2E testing agent loop.

    Each iteration creates a FRESH client (fresh context window).
    The agent reads HANDOFF.md to understand previous session's work.
    The agent writes HANDOFF.md before context fills to pass context to next session.

    Args:
        project_dir: Project root directory
        model: Claude model to use
        max_iterations: Max iterations (None for unlimited)
    """
    e2e_dir = project_dir / "tests" / "e2e"
    prompts_dir = e2e_dir / "prompts"

    print("\n" + "=" * 70)
    print("  RALPH LOOP - E2E TESTING AGENT")
    print("=" * 70)
    print(f"\nProject: {project_dir}")
    print(f"Model: {model}")
    if max_iterations:
        print(f"Max iterations: {max_iterations}")
    else:
        print("Max iterations: Unlimited")
    print()

    print_progress_summary(e2e_dir)

    iteration = 0

    while True:
        iteration += 1

        if max_iterations and iteration > max_iterations:
            print(f"\nReached max iterations ({max_iterations})")
            break

        # Check if all tests done
        passed, blocked, pending = get_test_progress(e2e_dir)
        if pending == 0:
            print("\n" + "=" * 70)
            print("  ALL TESTS COMPLETE!")
            print("=" * 70)
            print(f"\nPassed: {passed} | Blocked: {blocked}")
            break

        print_session_header(iteration, model)

        # Create fresh client (fresh context window)
        client = create_client(project_dir, model)

        # Load prompt - agent will read HANDOFF.md in GET BEARINGS step
        prompt = get_prompt(prompts_dir, e2e_dir)

        # Run session with fresh context
        async with client:
            status, response, stats = await run_agent_session(client, prompt)

        # Log session stats
        print(f"\nSession {iteration} stats: {stats['num_turns']} turns, {stats['tool_calls']} tool calls")
        if stats.get('usage'):
            print(f"  Token usage: {stats['usage']}")

        print_progress_summary(e2e_dir)

        if status == "continue":
            print(f"\nAuto-continuing in {AUTO_CONTINUE_DELAY_SECONDS}s...")
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)
        elif status == "error":
            print("\nSession error - retrying...")
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        await asyncio.sleep(1)

    # Final summary
    print("\n" + "=" * 70)
    print("  SESSION COMPLETE")
    print("=" * 70)
    print_progress_summary(e2e_dir)
    print("\nDone!")
