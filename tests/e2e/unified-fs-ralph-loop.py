#!/usr/bin/env python3
"""
Unified File System Ralph Loop
==============================

Dedicated Ralph loop for implementing the Unified Artifact & File System feature.
Runs through 75 test cases defined in docs/specs/unified-file-system/.

Usage:
    python tests/e2e/unified-fs-ralph-loop.py
    python tests/e2e/unified-fs-ralph-loop.py --max-iterations 10
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from claude_code_sdk import ClaudeSDKClient
from client import create_client


# Configuration
DEFAULT_MODEL = "claude-opus-4-5-20251101"
AUTO_CONTINUE_DELAY_SECONDS = 3

# Paths
PROJECT_DIR = Path("/Users/nenadatanasovski/idea_incurator")
SPECS_DIR = PROJECT_DIR / "docs" / "specs" / "unified-file-system"
TEST_STATE_FILE = SPECS_DIR / "test-state.json"
LOGS_DIR = PROJECT_DIR / "tests" / "e2e" / "logs"
TRANSCRIPT_DIR = LOGS_DIR / "unified-fs-transcripts"
GLOBAL_TRANSCRIPT_FILE = TRANSCRIPT_DIR / "global-transcript.log"
GLOBAL_TRANSCRIPT_TAIL_LINES = 100  # Last N lines to show each agent

# Spec file mapping
SPEC_FILES = {
    "TEST-FS": "01-folder-structure-idea-types.md",
    "TEST-AS": "02-unified-artifact-store.md",
    "TEST-SC": "03-session-context-management.md",
    "TEST-PH": "04-phase-transitions-handoffs.md",
    "TEST-UI": "05-ui-components.md",
}


def load_test_state() -> dict:
    """Load test state from JSON file."""
    if not TEST_STATE_FILE.exists():
        print(f"ERROR: Test state file not found: {TEST_STATE_FILE}")
        sys.exit(1)

    with open(TEST_STATE_FILE) as f:
        return json.load(f)


def save_test_state(state: dict) -> None:
    """Save test state to JSON file."""
    state["lastUpdated"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with open(TEST_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def get_next_pending_test(state: dict) -> dict | None:
    """Find the next pending test that has its dependencies met."""
    for test in state["tests"]:
        if test["status"] != "pending":
            continue

        # Check dependency
        if test["dependsOn"]:
            dep_test = next((t for t in state["tests"] if t["id"] == test["dependsOn"]), None)
            if dep_test and dep_test["status"] != "passed":
                continue

        return test

    return None


def get_spec_file(test_id: str) -> Path | None:
    """Get the spec file path for a test ID."""
    prefix = test_id.rsplit("-", 1)[0]  # TEST-FS-001 -> TEST-FS
    spec_file = SPEC_FILES.get(prefix)
    if spec_file:
        return SPECS_DIR / spec_file
    return None


def update_summary(state: dict) -> None:
    """Update the summary counts."""
    summary = state["summary"]
    summary["passed"] = sum(1 for t in state["tests"] if t["status"] == "passed")
    summary["failed"] = sum(1 for t in state["tests"] if t["status"] == "failed")
    summary["blocked"] = sum(1 for t in state["tests"] if t["status"] == "blocked")
    summary["pending"] = sum(1 for t in state["tests"] if t["status"] == "pending")


def print_progress(state: dict) -> None:
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


def get_transcript_path(test_id: str, attempt: int) -> Path:
    """Get the path to a transcript file for a specific test and attempt."""
    test_dir = TRANSCRIPT_DIR / test_id
    test_dir.mkdir(parents=True, exist_ok=True)
    return test_dir / f"attempt-{attempt}.log"


def save_transcript(test_id: str, attempt: int, transcript: str) -> None:
    """Save a transcript to disk."""
    path = get_transcript_path(test_id, attempt)
    path.write_text(transcript)
    print(f"Transcript saved to: {path}")


def load_previous_transcripts(test_id: str, current_attempt: int, max_chars: int = 50000) -> str:
    """Load all previous attempt transcripts for a test.

    Args:
        test_id: The test ID
        current_attempt: Current attempt number (loads 1 to current_attempt-1)
        max_chars: Maximum total characters to include (default 50k, ~12k tokens)
    """
    transcripts = []
    total_chars = 0

    # Load most recent attempts first (more relevant)
    for attempt in range(current_attempt - 1, 0, -1):
        path = get_transcript_path(test_id, attempt)
        if path.exists():
            content = path.read_text()

            # Check if we'd exceed the limit
            if total_chars + len(content) > max_chars:
                # Truncate this transcript to fit
                remaining = max_chars - total_chars
                if remaining > 1000:  # Only include if we can fit meaningful content
                    content = content[:remaining] + "\n\n[... truncated ...]"
                    transcripts.insert(0, f"## Previous Attempt {attempt} Transcript\n\n{content}")
                break

            total_chars += len(content)
            transcripts.insert(0, f"## Previous Attempt {attempt} Transcript\n\n{content}")

    if transcripts:
        return "\n\n---\n\n".join(transcripts)
    return ""


def clear_transcripts(test_id: str) -> None:
    """Clear all transcripts for a test (called when test passes)."""
    test_dir = TRANSCRIPT_DIR / test_id
    if test_dir.exists():
        for f in test_dir.glob("*.log"):
            f.unlink()
        print(f"Cleared transcripts for {test_id}")


def append_to_transcript(test_id: str, transcript: str) -> None:
    """Append to the global transcript file."""
    separator = f"\n\n{'='*60}\n=== {test_id} ===\n{'='*60}\n\n"
    with open(GLOBAL_TRANSCRIPT_FILE, "a") as f:
        f.write(separator + transcript)


def load_transcript_tail() -> str:
    """Load the last N lines from the global transcript."""
    if not GLOBAL_TRANSCRIPT_FILE.exists():
        return ""

    lines = GLOBAL_TRANSCRIPT_FILE.read_text().splitlines()
    if len(lines) <= GLOBAL_TRANSCRIPT_TAIL_LINES:
        return "\n".join(lines)

    return "\n".join(lines[-GLOBAL_TRANSCRIPT_TAIL_LINES:])


def build_prompt(test: dict, spec_file: Path, previous_transcripts: str = "", global_transcript: str = "") -> str:
    """Build the prompt for the agent."""
    spec_content = spec_file.read_text() if spec_file and spec_file.exists() else "Spec file not found"

    # Build the base prompt
    prompt = f"""# Unified File System Implementation Task

## Current Test: {test['id']}

**Description**: {test['notes']}
**Attempts**: {test['attempts']}
**Depends On**: {test['dependsOn'] or 'None'}
"""

    # Add recent transcript context
    if global_transcript:
        prompt += f"""
## Recent Activity

```
{global_transcript}
```

"""

    # Add previous transcripts if this is a retry of the SAME test
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

1. Read the spec file below to understand what needs to be implemented
2. Find the test section for {test['id']}
3. {"Check what was already implemented in previous attempts and continue from there" if previous_transcripts else "Implement the code following the Implementation Steps"}
4. Verify ALL pass criteria are met
5. If ALL pass criteria are met, the test passes
6. If any fail criteria are triggered, fix and retry

## Spec File: {spec_file.name if spec_file else 'Unknown'}

{spec_content}

## CRITICAL RULES - READ CAREFULLY

### File Reading Rules
- **File limit is 25000 tokens** - you WILL get an error if you try to read larger files
- For large files (routes, components, reducers), ALWAYS use Grep first to find line numbers
- Then use `offset` and `limit` parameters to read just that section:
  - `offset` = starting line number (1-based, NEVER use 0)
  - `limit` = number of lines to read (use 100-200 for most sections)
  - Example: Read(file_path="...", offset=450, limit=100) reads 100 lines starting at line 450
- Known large files (USE GREP FIRST):
  - `server/routes/ideation.ts` (~25k+ tokens)
  - `frontend/src/reducers/ideationReducer.ts` (~large)
  - `frontend/src/components/ideation/*.tsx` (various large files)

### File Path Rules
- The folder-structure utility is at `utils/folder-structure.ts` NOT `agents/ideation/folder-structure.ts`
- Always use Glob to find files if unsure of the exact path
- Common paths:
  - Routes: `server/routes/*.ts`
  - Utils: `utils/*.ts`
  - Agents: `agents/ideation/*.ts`
  - Frontend: `frontend/src/**/*.tsx`

### Implementation Rules
- Implement ONLY what is needed for {test['id']}
- Verify ALL pass criteria checkboxes
- Run verification commands to confirm

### ⚠️ MANDATORY: FINAL DECLARATION REQUIREMENT ⚠️

**YOU MUST ALWAYS END YOUR RESPONSE WITH ONE OF THESE TWO STATEMENTS:**

1. If ALL pass criteria are verified: `TEST PASSED: {test['id']}`
2. If you cannot complete after reasonable attempts: `TEST BLOCKED: {test['id']} - <reason>`

**Before declaring TEST PASSED, you MUST:**
1. List each pass criterion from the spec
2. Mark each as ✅ verified or ❌ failed
3. Only if ALL are ✅, then declare "TEST PASSED: {test['id']}"

**Example final verification:**
```
## Pass Criteria Verification for {test['id']}
- [ ] Criterion 1: ✅ Verified - <evidence>
- [ ] Criterion 2: ✅ Verified - <evidence>
- [ ] Criterion 3: ✅ Verified - <evidence>

All criteria verified. TEST PASSED: {test['id']}
```

**CRITICAL: If you run out of context or time without completing verification, declare TEST BLOCKED with the reason.**

### Avoid Common Mistakes
- Don't re-implement code that already exists - CHECK first with Grep
- Don't read entire large files - use Grep or offset/limit
- Don't guess file paths - use Glob to find them
- Don't forget to import new functions/types when adding code

### TypeScript Rules
- Run `npx tsc --noEmit` to check for type errors before saying TEST PASSED
- When adding new types/interfaces, export them from the file
- When using new types in other files, import them explicitly
- Check existing type definitions in the file before creating duplicates

## Current Test State

```json
{json.dumps(test, indent=2)}
```

Begin implementation.

**REMINDER: You MUST end with either "TEST PASSED: {test['id']}" or "TEST BLOCKED: {test['id']} - <reason>"**
"""
    return prompt


async def run_agent_session(client: ClaudeSDKClient, prompt: str) -> tuple[str, str, str]:
    """Run a single agent session.

    Returns:
        (status, response_text, full_transcript) where:
        - status: 'passed', 'blocked', 'continue', or 'error'
        - response_text: just the assistant's text responses
        - full_transcript: full log of what happened (for next attempt)
    """
    print("Sending prompt to Claude Agent SDK...\n")

    transcript_lines = []

    def log(text: str, end: str = "\n"):
        """Print and capture to transcript."""
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
                            # Truncate long inputs but keep enough context
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
                            # Capture error details for transcript
                            error_preview = result_str[:500] if len(result_str) > 500 else result_str
                            log(f"  [Error] {error_preview}")
                        else:
                            # Brief success with preview of result
                            if len(result_str) > 100:
                                log(f"  [Done] Preview: {result_str[:100]}...")
                            else:
                                log(f"  [Done]")

        log("\n" + "-" * 70 + "\n")

        full_transcript = "\n".join(transcript_lines)

        # Check if test passed or blocked
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


async def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Unified File System Ralph Loop")
    parser.add_argument("--max-iterations", type=int, default=None, help="Max iterations")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL, help="Claude model")
    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("  UNIFIED FILE SYSTEM RALPH LOOP")
    print("=" * 70)
    print(f"\nProject: {PROJECT_DIR}")
    print(f"Specs: {SPECS_DIR}")
    print(f"Model: {args.model}")
    print(f"Max iterations: {args.max_iterations or 'Unlimited'}")

    # Load test state
    state = load_test_state()
    print_progress(state)

    # Ensure directories exist
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)

    iteration = 0

    while True:
        iteration += 1

        if args.max_iterations and iteration > args.max_iterations:
            print(f"\nReached max iterations ({args.max_iterations})")
            break

        # Get next test
        test = get_next_pending_test(state)

        if not test:
            # Check if all done
            update_summary(state)
            if state["summary"]["pending"] == 0:
                print("\n" + "=" * 70)
                print("  ALL TESTS COMPLETE!")
                print("=" * 70)
                print_progress(state)
                break
            else:
                print("\nNo runnable tests (dependencies not met)")
                break

        print("\n" + "=" * 70)
        print(f"  ITERATION {iteration}: {test['id']}")
        print(f"  {test['notes']}")
        print("=" * 70)

        # Get spec file
        spec_file = get_spec_file(test["id"])
        if not spec_file or not spec_file.exists():
            print(f"ERROR: Spec file not found for {test['id']}")
            test["status"] = "blocked"
            test["lastResult"] = "blocked"
            test["notes"] += " - Spec file not found"
            save_test_state(state)
            continue

        # Increment attempts BEFORE loading transcripts (so attempt count is accurate)
        test["attempts"] += 1
        current_attempt = test["attempts"]
        save_test_state(state)

        # Load last 100 lines from transcript
        transcript_tail = load_transcript_tail()
        if transcript_tail:
            print(f"Loaded last {len(transcript_tail.splitlines())} lines from transcript")

        # Load previous transcripts for this test (if retrying same test)
        previous_transcripts = load_previous_transcripts(test["id"], current_attempt)
        if previous_transcripts:
            print(f"Loaded transcripts from {current_attempt - 1} previous attempt(s) of this test")

        # Build prompt with all context
        prompt = build_prompt(test, spec_file, previous_transcripts, transcript_tail)

        # Create fresh client
        client = create_client(PROJECT_DIR, args.model)

        # Run session with interrupt handling
        try:
            async with client:
                status, response, transcript = await run_agent_session(client, prompt)
        except KeyboardInterrupt:
            print("\n\n⚠️ Interrupted! Saving partial transcript...")
            partial = "[INTERRUPTED]\n\nPartial session - user pressed Ctrl+C"
            save_transcript(test["id"], current_attempt, partial)
            append_to_transcript(test["id"], partial)
            raise

        # Save transcripts
        save_transcript(test["id"], current_attempt, transcript)
        append_to_transcript(test["id"], transcript)

        # Update test status
        if status == "passed":
            test["status"] = "passed"
            test["lastResult"] = "pass"
            clear_transcripts(test["id"])  # Clean up transcripts on success
            print(f"\n✅ {test['id']} PASSED")
        elif status == "blocked":
            test["status"] = "blocked"
            test["lastResult"] = "blocked"
            print(f"\n🚫 {test['id']} BLOCKED")
        elif status == "error":
            test["lastResult"] = "error"
            if test["attempts"] >= 3:
                test["status"] = "blocked"
                print(f"\n🚫 {test['id']} BLOCKED (max attempts after error)")
            else:
                print(f"\n⚠️ {test['id']} errored, will retry (attempt {test['attempts']}/3)")
        elif test["attempts"] >= 3:
            test["status"] = "blocked"
            test["lastResult"] = "blocked"
            print(f"\n🚫 {test['id']} BLOCKED (max attempts)")
        else:
            test["lastResult"] = "continue"
            print(f"\n🔄 {test['id']} needs retry (attempt {test['attempts']}/3)")

        # Update summary and save
        update_summary(state)
        save_test_state(state)

        print_progress(state)

        if status in ("passed", "blocked"):
            print(f"\nContinuing in {AUTO_CONTINUE_DELAY_SECONDS}s...")
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)
        else:
            print(f"\nRetrying in {AUTO_CONTINUE_DELAY_SECONDS}s...")
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

    print("\n" + "=" * 70)
    print("  DONE")
    print("=" * 70)
    print_progress(state)

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
