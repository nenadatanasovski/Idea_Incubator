# API Reference

**Version:** 1.0
**Location:** `coding-loops/shared/`

All components are Python modules with class-based APIs.

---

## MessageBus

**File:** `shared/message_bus.py`

```python
class MessageBus:
    def __init__(self, db_path: Path)

    # Publishing
    def publish(self, source: str, event_type: str, payload: dict,
                priority: int = 5, correlation_id: str = None) -> str
        """Publish event. Returns event ID."""

    # Subscriptions
    def subscribe(self, subscriber: str, event_types: list[str],
                  filter_sources: list[str] = None) -> str
        """Subscribe to events. Returns subscription ID."""

    def unsubscribe(self, subscription_id: str) -> None
        """Remove subscription."""

    # Polling
    def poll(self, subscriber: str, limit: int = 10) -> list[dict]
        """Get unacknowledged events for subscriber."""

    def acknowledge(self, event_id: str, subscriber: str) -> None
        """Mark event as acknowledged."""

    # Timeline
    def get_timeline(self, since: datetime = None, until: datetime = None,
                     sources: list[str] = None, types: list[str] = None,
                     limit: int = 100) -> list[dict]
        """Query event timeline."""

    # File Locking
    def lock_file(self, file_path: str, locked_by: str,
                  reason: str = None, ttl_seconds: int = 300) -> bool
        """Acquire lock. Returns True if acquired."""

    def unlock_file(self, file_path: str, locked_by: str) -> None
        """Release lock."""

    def check_lock(self, file_path: str) -> dict | None
        """Check lock status. Returns lock info or None."""

    def release_expired_locks(self) -> int
        """Release expired locks. Returns count."""

    def release_all_locks(self, loop_id: str) -> int
        """Release all locks for loop. Returns count."""
```

---

## VerificationGate

**File:** `shared/verification_gate.py`

```python
@dataclass
class VerificationResult:
    verified: bool
    checks: dict[str, bool]  # check_name -> passed
    errors: list[str]

class VerificationGate:
    def __init__(self, project_root: Path)

    def verify_test_passed(self, loop_id: str, test_id: str) -> VerificationResult
        """Run independent verification. Returns result."""

    def _run_tsc(self) -> bool
        """Run TypeScript compilation."""

    def _run_tests(self, test_id: str) -> bool
        """Run related test files."""

    def _run_build(self) -> bool
        """Run npm build."""

    def _run_lint(self, files: list[str] = None) -> bool
        """Run lint on changed files."""

    def _check_regressions(self) -> bool
        """Check previously passing tests."""
```

---

## GitManager

**File:** `shared/git_manager.py`

```python
@dataclass
class RebaseResult:
    success: bool
    conflicts: list[str]

class GitManager:
    def __init__(self, repo_path: Path)

    def ensure_branch(self, loop_id: str) -> str
        """Create branch if needed. Returns branch name."""

    def get_branch(self, loop_id: str) -> str
        """Get branch name for loop."""

    def checkout_branch(self, loop_id: str) -> None
        """Switch to loop's branch."""

    def rebase_from_main(self, loop_id: str) -> RebaseResult
        """Rebase loop branch from main."""

    def detect_conflicts(self, loop_id: str) -> list[str]
        """Detect files that would conflict."""

    def commit_changes(self, loop_id: str, message: str,
                       files: list[str] = None) -> str
        """Commit changes. Returns commit hash."""

    def get_current_commit(self) -> str
        """Get current commit hash."""
```

---

## CheckpointManager

**File:** `shared/checkpoint_manager.py`

```python
class CheckpointManager:
    def __init__(self, repo_path: Path, db_path: Path)

    def create_checkpoint(self, loop_id: str, test_id: str) -> str
        """Create checkpoint. Returns checkpoint ID."""

    def rollback(self, checkpoint_id: str) -> bool
        """Rollback to checkpoint. Returns success."""

    def rollback_if_exists(self, loop_id: str) -> bool
        """Rollback current if exists. Returns success."""

    def delete_checkpoint(self, checkpoint_id: str) -> None
        """Delete checkpoint."""

    def list_checkpoints(self, loop_id: str = None,
                         older_than: timedelta = None) -> list[dict]
        """List checkpoints with optional filters."""
```

---

## ResourceRegistry

**File:** `shared/resource_registry.py`

```python
class ResourceRegistry:
    def __init__(self, db_path: Path)

    def register_owner(self, path: str, loop_id: str,
                       resource_type: str, description: str = None) -> None
        """Register resource ownership."""

    def get_owner(self, path: str) -> str | None
        """Get owner of resource."""

    def request_change(self, path: str, requestor: str,
                       request_type: str, description: str) -> str
        """Request to modify. Returns request ID."""

    def approve_change(self, request_id: str, approved_by: str) -> None
        """Approve change request."""

    def reject_change(self, request_id: str, rejected_by: str,
                      reason: str = None) -> None
        """Reject change request."""

    def list_resources(self, owner: str = None,
                       resource_type: str = None) -> list[dict]
        """List registered resources."""
```

---

## KnowledgeBase

**File:** `shared/knowledge_base.py`

```python
@dataclass
class KnowledgeItem:
    id: str
    loop_id: str
    item_type: str
    topic: str
    content: str
    confidence: float
    created_at: datetime

class KnowledgeBase:
    def __init__(self, db_path: Path)

    def record_fact(self, loop_id: str, fact: str,
                    confidence: float = 1.0, evidence: str = None,
                    topic: str = None) -> str
        """Record fact. Returns ID."""

    def record_decision(self, loop_id: str, decision: str,
                        rationale: str, affected_areas: list[str],
                        topic: str = None) -> str
        """Record decision. Returns ID."""

    def record_pattern(self, loop_id: str, pattern_name: str,
                       description: str, example_file: str,
                       topic: str = None) -> str
        """Record pattern. Returns ID."""

    def query(self, topic: str = None, item_type: str = None,
              limit: int = 10) -> list[KnowledgeItem]
        """Query knowledge base."""

    def get_context_for_test(self, test_id: str) -> str
        """Generate context summary for test."""

    def supersede(self, old_id: str, new_id: str) -> None
        """Mark knowledge as superseded."""
```

---

## ErrorClassifier

**File:** `shared/error_classifier.py`

```python
class ErrorCategory(Enum):
    TRANSIENT = "transient"
    PERMANENT = "permanent"
    SYSTEM = "system"
    CODE = "code"
    SPEC = "spec"
    RESOURCE = "resource"
    DEPENDENCY = "dependency"
    HUMAN = "human"

@dataclass
class ErrorHandling:
    category: ErrorCategory
    should_retry: bool
    max_retries: int
    backoff_seconds: int
    escalate: bool
    message: str

class ErrorClassifier:
    def classify(self, error: Exception, context: dict = None) -> ErrorCategory
        """Classify error into category."""

    def get_handling(self, category: ErrorCategory) -> ErrorHandling
        """Get handling instructions."""
```

---

## DeadlockDetector

**File:** `shared/deadlock_detector.py`

```python
class DeadlockDetector:
    def __init__(self, bus: MessageBus)

    def record_wait(self, waiter: str, holder: str, resource: str) -> None
        """Record wait relationship."""

    def clear_wait(self, waiter: str, resource: str) -> None
        """Clear wait when lock acquired."""

    def check_deadlock(self) -> list[str] | None
        """Check for deadlock. Returns cycle if found."""

    def resolve_deadlock(self) -> str
        """Resolve deadlock. Returns victim loop ID."""
```

---

## TelegramNotifier

**File:** `shared/telegram_notifier.py`

```python
class TelegramNotifier:
    def __init__(self, bot_token: str, chat_id: str)

    async def send_alert(self, severity: str, message: str) -> None
        """Send alert notification."""

    async def send_decision_request(self, decision: dict) -> None
        """Send decision request with options."""

    async def send_summary(self, summary: str) -> None
        """Send status summary."""

    async def poll_responses(self) -> list[dict]
        """Poll for user responses."""
```

---

## CLI Commands

**File:** `cli.py`, `cli_commands/*.py`

```bash
# Status
cli.py status [loop-id]     # Overall or specific status
cli.py health               # Component health
cli.py timeline [--since]   # Event timeline

# Control
cli.py pause <loop-id|all>  # Pause loop(s)
cli.py resume <loop-id|all> # Resume loop(s)
cli.py skip <test-id>       # Skip test
cli.py reset <test-id>      # Reset test to pending
cli.py rollback <loop-id>   # Rollback loop
cli.py restart <loop-id>    # Restart loop

# Locks
cli.py locks                # Show all locks
cli.py force-unlock <loop>  # Force release
cli.py deadlocks            # Show deadlock status

# Decisions
cli.py decisions            # List pending
cli.py decide <id> <choice> # Make decision

# Analysis
cli.py summary              # AI summary
cli.py conflicts            # Recent conflicts
cli.py stuck                # Stuck tests
cli.py regressions          # Regressions
cli.py dump-state           # Human-readable state
```

---

## Agent APIs

### MonitorAgent

**File:** `agents/monitor_agent.py`

```python
class MonitorAgent:
    def __init__(self, bus: MessageBus, config: dict)

    async def run(self) -> None
        """Main monitoring loop."""

    async def check_health(self) -> dict
        """Check all loop health."""

    async def check_progress(self) -> dict
        """Check test progress."""

    async def check_conflicts(self) -> list[dict]
        """Check for file conflicts."""
```

### PMAgent

**File:** `agents/pm_agent.py`

```python
class PMAgent:
    def __init__(self, bus: MessageBus, config: dict)

    async def run(self) -> None
        """Main PM loop."""

    async def handle_conflict(self, conflict: dict) -> None
        """Handle file conflict."""

    async def escalate_decision(self, decision_type: str,
                                summary: str, options: list) -> str
        """Create decision request. Returns decision ID."""
```

### HumanAgent

**File:** `agents/human_agent.py`

```python
class HumanAgent:
    def __init__(self, bus: MessageBus, telegram: TelegramNotifier)

    async def run(self) -> None
        """Main human interface loop."""

    async def format_decision(self, decision: dict) -> str
        """Format decision for human."""

    async def generate_summary(self, since_hours: int = 24) -> str
        """Generate status summary."""
```

---

*For implementation details, see the source files.*
