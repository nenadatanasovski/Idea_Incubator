"""
Database Layer Tests

Tests for the coordination system database layer:
- Schema initialization
- Model serialization/deserialization
- Query functions
- Migration from test-state.json
"""

import pytest
import tempfile
import json
from pathlib import Path
from datetime import datetime, timedelta

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.init_db import (
    init_database,
    verify_schema,
    get_connection,
    transaction,
    DatabaseConnection,
    ensure_initialized
)
from database.models import (
    Loop, Test, Event, Subscription, FileLock,
    Knowledge, Resource, Decision, Alert,
    LoopStatus, TestStatus, DecisionStatus
)
from database.queries import (
    LoopQueries, TestQueries, EventQueries,
    SubscriptionQueries, FileLockQueries,
    KnowledgeQueries, DecisionQueries,
    ComponentHealthQueries, AlertQueries,
    generate_id, now_iso
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = Path(f.name)
    init_database(db_path)
    yield db_path
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def sample_loop():
    """Create a sample loop for testing."""
    return Loop(
        id="test-loop-1",
        name="Test Loop",
        priority=1,
        status=LoopStatus.STOPPED.value
    )


@pytest.fixture
def sample_test():
    """Create a sample test for testing."""
    return Test(
        id="TEST-001",
        loop_id="test-loop-1",
        category="unit",
        status=TestStatus.PENDING.value,
        notes="Sample test"
    )


# ============================================================================
# Schema Tests
# ============================================================================

class TestSchemaInitialization:
    """Tests for database schema initialization."""

    def test_init_database_creates_file(self, temp_db):
        """Verify database file is created."""
        assert temp_db.exists()

    def test_init_database_creates_all_tables(self, temp_db):
        """Verify all expected tables are created."""
        result = verify_schema(temp_db)
        assert result["valid"], f"Missing tables: {result.get('missing', [])}"
        assert "loops" in result["tables"]
        assert "tests" in result["tables"]
        assert "events" in result["tables"]
        assert "subscriptions" in result["tables"]
        assert "file_locks" in result["tables"]
        assert "knowledge" in result["tables"]
        assert "decisions" in result["tables"]

    def test_verify_schema_on_nonexistent_db(self):
        """Verify schema check handles nonexistent database."""
        result = verify_schema(Path("/nonexistent/db.sqlite"))
        assert not result["valid"]
        assert "error" in result

    def test_force_reinit_drops_tables(self, temp_db):
        """Verify force=True drops and recreates tables."""
        # Add some data
        with get_connection(temp_db) as conn:
            conn.execute(
                "INSERT INTO loops (id, name, priority) VALUES (?, ?, ?)",
                ("test", "Test", 1)
            )
            conn.commit()

        # Force reinit
        init_database(temp_db, force=True)

        # Verify data is gone
        with get_connection(temp_db) as conn:
            row = conn.execute("SELECT * FROM loops").fetchone()
            assert row is None


# ============================================================================
# Connection Tests
# ============================================================================

class TestConnections:
    """Tests for database connections."""

    def test_get_connection_returns_usable_connection(self, temp_db):
        """Verify connection can execute queries."""
        with get_connection(temp_db) as conn:
            cursor = conn.execute("SELECT 1")
            assert cursor.fetchone()[0] == 1

    def test_get_connection_row_factory(self, temp_db):
        """Verify row factory returns dict-like objects."""
        with get_connection(temp_db) as conn:
            conn.execute(
                "INSERT INTO loops (id, name, priority) VALUES (?, ?, ?)",
                ("test", "Test", 1)
            )
            conn.commit()
            row = conn.execute("SELECT * FROM loops").fetchone()
            assert row["id"] == "test"
            assert row["name"] == "Test"

    def test_transaction_commits_on_success(self, temp_db):
        """Verify transaction commits on success."""
        with transaction(temp_db) as conn:
            conn.execute(
                "INSERT INTO loops (id, name, priority) VALUES (?, ?, ?)",
                ("test", "Test", 1)
            )

        # Verify data persisted
        with get_connection(temp_db) as conn:
            row = conn.execute("SELECT * FROM loops WHERE id = ?", ("test",)).fetchone()
            assert row is not None

    def test_transaction_rollbacks_on_error(self, temp_db):
        """Verify transaction rolls back on exception."""
        try:
            with transaction(temp_db) as conn:
                conn.execute(
                    "INSERT INTO loops (id, name, priority) VALUES (?, ?, ?)",
                    ("test", "Test", 1)
                )
                raise ValueError("Intentional error")
        except ValueError:
            pass

        # Verify data was rolled back
        with get_connection(temp_db) as conn:
            row = conn.execute("SELECT * FROM loops WHERE id = ?", ("test",)).fetchone()
            assert row is None

    def test_database_connection_class(self, temp_db):
        """Test DatabaseConnection convenience class."""
        db = DatabaseConnection(temp_db)
        try:
            db.execute(
                "INSERT INTO loops (id, name, priority) VALUES (?, ?, ?)",
                ("test", "Test", 1)
            )
            loops = db.query("SELECT * FROM loops")
            assert len(loops) == 1
            assert loops[0]["id"] == "test"

            loop = db.query_one("SELECT * FROM loops WHERE id = ?", ("test",))
            assert loop["id"] == "test"
        finally:
            db.close()


# ============================================================================
# Model Tests
# ============================================================================

class TestModels:
    """Tests for dataclass models."""

    def test_loop_to_dict(self, sample_loop):
        """Verify Loop.to_dict() produces valid dict."""
        d = sample_loop.to_dict()
        assert d["id"] == "test-loop-1"
        assert d["name"] == "Test Loop"
        assert d["priority"] == 1

    def test_loop_from_row(self):
        """Verify Loop.from_row() creates valid object."""
        row = {
            "id": "loop-1",
            "name": "Loop 1",
            "priority": 2,
            "status": "running",
            "branch": "main"
        }
        loop = Loop.from_row(row)
        assert loop.id == "loop-1"
        assert loop.name == "Loop 1"
        assert loop.priority == 2

    def test_test_automatable_conversion(self):
        """Verify Test handles automatable boolean/int conversion."""
        test = Test(
            id="TEST-001",
            loop_id="loop-1",
            category="unit",
            automatable=True
        )
        d = test.to_dict()
        assert d["automatable"] == 1

        row = {"id": "TEST-001", "loop_id": "loop-1", "category": "unit", "automatable": 0}
        test2 = Test.from_row(row)
        assert test2.automatable is False

    def test_event_payload_serialization(self):
        """Verify Event handles JSON payload correctly."""
        event = Event(
            id="evt-1",
            timestamp=now_iso(),
            source="loop-1",
            event_type="test_started",
            payload={"test_id": "TEST-001", "attempt": 1}
        )
        d = event.to_dict()
        assert isinstance(d["payload"], str)
        assert json.loads(d["payload"]) == {"test_id": "TEST-001", "attempt": 1}

        row = {
            "id": "evt-1",
            "timestamp": now_iso(),
            "source": "loop-1",
            "event_type": "test_started",
            "payload": '{"test_id": "TEST-001"}',
            "acknowledged": 1
        }
        event2 = Event.from_row(row)
        assert event2.payload == {"test_id": "TEST-001"}
        assert event2.acknowledged is True

    def test_file_lock_expiry_check(self):
        """Verify FileLock.is_expired() works correctly."""
        # Not expired
        lock = FileLock(
            file_path="/test/file.ts",
            locked_by="loop-1",
            locked_at=now_iso(),
            expires_at=(datetime.utcnow() + timedelta(hours=1)).isoformat()
        )
        assert not lock.is_expired()

        # Expired
        lock_expired = FileLock(
            file_path="/test/file.ts",
            locked_by="loop-1",
            locked_at=now_iso(),
            expires_at=(datetime.utcnow() - timedelta(hours=1)).isoformat()
        )
        assert lock_expired.is_expired()


# ============================================================================
# Query Tests - Loops
# ============================================================================

class TestLoopQueries:
    """Tests for loop queries."""

    def test_register_and_get_loop(self, temp_db, sample_loop):
        """Verify loop registration and retrieval."""
        LoopQueries.register(sample_loop, temp_db)
        retrieved = LoopQueries.get_by_id(sample_loop.id, temp_db)
        assert retrieved is not None
        assert retrieved.id == sample_loop.id
        assert retrieved.name == sample_loop.name

    def test_get_all_loops(self, temp_db):
        """Verify getting all loops ordered by priority."""
        loop1 = Loop(id="loop-1", name="Loop 1", priority=2)
        loop2 = Loop(id="loop-2", name="Loop 2", priority=1)
        LoopQueries.register(loop1, temp_db)
        LoopQueries.register(loop2, temp_db)

        loops = LoopQueries.get_all(temp_db)
        assert len(loops) == 2
        assert loops[0].id == "loop-2"  # Higher priority first
        assert loops[1].id == "loop-1"

    def test_update_loop_status(self, temp_db, sample_loop):
        """Verify loop status update."""
        LoopQueries.register(sample_loop, temp_db)
        LoopQueries.update_status(
            sample_loop.id,
            LoopStatus.RUNNING.value,
            current_test_id="TEST-001",
            pid=12345,
            db_path=temp_db
        )

        updated = LoopQueries.get_by_id(sample_loop.id, temp_db)
        assert updated.status == LoopStatus.RUNNING.value
        assert updated.current_test_id == "TEST-001"
        assert updated.pid == 12345

    def test_get_running_loops(self, temp_db):
        """Verify getting only running loops."""
        loop1 = Loop(id="loop-1", name="Loop 1", priority=1, status=LoopStatus.RUNNING.value)
        loop2 = Loop(id="loop-2", name="Loop 2", priority=2, status=LoopStatus.STOPPED.value)
        LoopQueries.register(loop1, temp_db)
        LoopQueries.register(loop2, temp_db)

        running = LoopQueries.get_running(temp_db)
        assert len(running) == 1
        assert running[0].id == "loop-1"


# ============================================================================
# Query Tests - Tests
# ============================================================================

class TestTestQueries:
    """Tests for test queries."""

    def test_register_and_get_test(self, temp_db, sample_loop, sample_test):
        """Verify test registration and retrieval."""
        LoopQueries.register(sample_loop, temp_db)
        TestQueries.register(sample_test, temp_db)

        retrieved = TestQueries.get_by_id(sample_test.id, temp_db)
        assert retrieved is not None
        assert retrieved.id == sample_test.id
        assert retrieved.loop_id == sample_test.loop_id

    def test_get_next_for_loop_no_dependencies(self, temp_db, sample_loop):
        """Verify getting next test with no dependencies."""
        LoopQueries.register(sample_loop, temp_db)
        test = Test(id="TEST-001", loop_id=sample_loop.id, category="unit")
        TestQueries.register(test, temp_db)

        next_test = TestQueries.get_next_for_loop(sample_loop.id, temp_db)
        assert next_test is not None
        assert next_test.id == "TEST-001"

    def test_get_next_for_loop_with_dependencies(self, temp_db, sample_loop):
        """Verify test dependencies are respected."""
        LoopQueries.register(sample_loop, temp_db)

        test1 = Test(id="TEST-001", loop_id=sample_loop.id, category="unit")
        test2 = Test(id="TEST-002", loop_id=sample_loop.id, category="unit", depends_on="TEST-001")
        TestQueries.register(test1, temp_db)
        TestQueries.register(test2, temp_db)

        # TEST-002 depends on TEST-001, so only TEST-001 should be available
        next_test = TestQueries.get_next_for_loop(sample_loop.id, temp_db)
        assert next_test.id == "TEST-001"

        # Mark TEST-001 as passed
        TestQueries.update_status("TEST-001", TestStatus.PASSED.value, db_path=temp_db)

        # Now TEST-002 should be available
        next_test = TestQueries.get_next_for_loop(sample_loop.id, temp_db)
        assert next_test.id == "TEST-002"

    def test_increment_attempts(self, temp_db, sample_loop, sample_test):
        """Verify attempt incrementing."""
        LoopQueries.register(sample_loop, temp_db)
        TestQueries.register(sample_test, temp_db)

        count = TestQueries.increment_attempts(sample_test.id, temp_db)
        assert count == 1

        count = TestQueries.increment_attempts(sample_test.id, temp_db)
        assert count == 2

    def test_get_summary(self, temp_db, sample_loop):
        """Verify summary generation."""
        LoopQueries.register(sample_loop, temp_db)

        tests = [
            Test(id="TEST-001", loop_id=sample_loop.id, category="unit", status=TestStatus.PASSED.value),
            Test(id="TEST-002", loop_id=sample_loop.id, category="unit", status=TestStatus.PENDING.value),
            Test(id="TEST-003", loop_id=sample_loop.id, category="unit", status=TestStatus.PENDING.value),
        ]
        for test in tests:
            TestQueries.register(test, temp_db)

        summary = TestQueries.get_summary(sample_loop.id, temp_db)
        assert summary["total"] == 3
        assert summary.get("passed", 0) == 1
        assert summary.get("pending", 0) == 2


# ============================================================================
# Query Tests - Events
# ============================================================================

class TestEventQueries:
    """Tests for event queries."""

    def test_publish_event(self, temp_db):
        """Verify event publishing."""
        event_id = EventQueries.publish(
            source="loop-1",
            event_type="test_started",
            payload={"test_id": "TEST-001"},
            db_path=temp_db
        )
        assert event_id is not None

        with get_connection(temp_db) as conn:
            row = conn.execute(
                "SELECT * FROM events WHERE id = ?", (event_id,)
            ).fetchone()
            assert row is not None
            assert row["source"] == "loop-1"
            assert row["event_type"] == "test_started"

    def test_subscribe_and_poll(self, temp_db):
        """Verify subscription and polling."""
        # Subscribe
        sub_id = SubscriptionQueries.subscribe(
            subscriber="monitor",
            event_types=["test_started", "test_passed"],
            db_path=temp_db
        )
        assert sub_id is not None

        # Publish event
        EventQueries.publish(
            source="loop-1",
            event_type="test_started",
            payload={"test_id": "TEST-001"},
            db_path=temp_db
        )

        # Poll
        events = EventQueries.poll("monitor", db_path=temp_db)
        assert len(events) == 1
        assert events[0].event_type == "test_started"

    def test_acknowledge_event(self, temp_db):
        """Verify event acknowledgement."""
        # Subscribe and publish
        SubscriptionQueries.subscribe(
            subscriber="monitor",
            event_types=["test_started"],
            db_path=temp_db
        )
        event_id = EventQueries.publish(
            source="loop-1",
            event_type="test_started",
            payload={},
            db_path=temp_db
        )

        # Acknowledge
        EventQueries.acknowledge(event_id, "monitor", temp_db)

        # Verify not returned in poll
        events = EventQueries.poll("monitor", db_path=temp_db)
        assert len(events) == 0

    def test_get_timeline(self, temp_db):
        """Verify timeline query."""
        EventQueries.publish("loop-1", "test_started", {"id": 1}, db_path=temp_db)
        EventQueries.publish("loop-2", "test_passed", {"id": 2}, db_path=temp_db)
        EventQueries.publish("loop-1", "test_failed", {"id": 3}, db_path=temp_db)

        # All events
        timeline = EventQueries.get_timeline(db_path=temp_db)
        assert len(timeline) == 3

        # Filter by source
        timeline = EventQueries.get_timeline(sources=["loop-1"], db_path=temp_db)
        assert len(timeline) == 2

        # Filter by type
        timeline = EventQueries.get_timeline(types=["test_passed"], db_path=temp_db)
        assert len(timeline) == 1


# ============================================================================
# Query Tests - File Locks
# ============================================================================

class TestFileLockQueries:
    """Tests for file lock queries."""

    def test_acquire_lock(self, temp_db):
        """Verify lock acquisition."""
        acquired = FileLockQueries.acquire(
            file_path="/test/file.ts",
            locked_by="loop-1",
            reason="Testing",
            db_path=temp_db
        )
        assert acquired is True

    def test_acquire_lock_conflict(self, temp_db):
        """Verify lock conflict detection."""
        FileLockQueries.acquire("/test/file.ts", "loop-1", db_path=temp_db)

        # Second attempt by different owner should fail
        acquired = FileLockQueries.acquire("/test/file.ts", "loop-2", db_path=temp_db)
        assert acquired is False

    def test_acquire_lock_same_owner(self, temp_db):
        """Verify same owner can reacquire lock."""
        FileLockQueries.acquire("/test/file.ts", "loop-1", db_path=temp_db)

        # Same owner should succeed
        acquired = FileLockQueries.acquire("/test/file.ts", "loop-1", db_path=temp_db)
        assert acquired is True

    def test_release_lock(self, temp_db):
        """Verify lock release."""
        FileLockQueries.acquire("/test/file.ts", "loop-1", db_path=temp_db)
        released = FileLockQueries.release("/test/file.ts", "loop-1", temp_db)
        assert released is True

        # Now another owner can acquire
        acquired = FileLockQueries.acquire("/test/file.ts", "loop-2", db_path=temp_db)
        assert acquired is True

    def test_check_lock(self, temp_db):
        """Verify lock checking."""
        FileLockQueries.acquire("/test/file.ts", "loop-1", reason="Testing", db_path=temp_db)

        lock = FileLockQueries.check("/test/file.ts", temp_db)
        assert lock is not None
        assert lock.locked_by == "loop-1"
        assert lock.lock_reason == "Testing"

    def test_release_expired_locks(self, temp_db):
        """Verify expired lock cleanup."""
        # Create a lock with very short TTL
        with transaction(temp_db) as conn:
            expired_at = (datetime.utcnow() - timedelta(seconds=1)).isoformat()
            conn.execute(
                """INSERT INTO file_locks (file_path, locked_by, locked_at, expires_at)
                   VALUES (?, ?, ?, ?)""",
                ("/test/file.ts", "loop-1", now_iso(), expired_at)
            )

        count = FileLockQueries.release_expired(temp_db)
        assert count == 1

        lock = FileLockQueries.check("/test/file.ts", temp_db)
        assert lock is None


# ============================================================================
# Query Tests - Knowledge
# ============================================================================

class TestKnowledgeQueries:
    """Tests for knowledge base queries."""

    def test_record_and_query_knowledge(self, temp_db, sample_loop):
        """Verify knowledge recording and querying."""
        LoopQueries.register(sample_loop, temp_db)

        knowledge = Knowledge(
            id=generate_id(),
            loop_id=sample_loop.id,
            item_type="fact",
            topic="testing",
            content="This is a test fact"
        )
        KnowledgeQueries.record(knowledge, temp_db)

        results = KnowledgeQueries.query(topic="testing", db_path=temp_db)
        assert len(results) == 1
        assert results[0].content == "This is a test fact"


# ============================================================================
# Query Tests - Decisions
# ============================================================================

class TestDecisionQueries:
    """Tests for decision queries."""

    def test_create_and_get_pending_decisions(self, temp_db):
        """Verify decision creation and retrieval."""
        decision = Decision(
            id=generate_id(),
            decision_type="conflict",
            summary="File conflict on api.ts",
            options=["Keep loop-1", "Keep loop-2", "Merge"],
            requested_by="pm"
        )
        DecisionQueries.create(decision, temp_db)

        pending = DecisionQueries.get_pending(temp_db)
        assert len(pending) == 1
        assert pending[0].summary == "File conflict on api.ts"
        assert len(pending[0].options) == 3

    def test_resolve_decision(self, temp_db):
        """Verify decision resolution."""
        decision = Decision(
            id=generate_id(),
            decision_type="conflict",
            summary="Test decision",
            options=["A", "B"],
            requested_by="pm"
        )
        decision_id = DecisionQueries.create(decision, temp_db)

        DecisionQueries.resolve(
            decision_id,
            choice="A",
            decided_by="human",
            comment="Choosing option A",
            db_path=temp_db
        )

        pending = DecisionQueries.get_pending(temp_db)
        assert len(pending) == 0


# ============================================================================
# Query Tests - Component Health
# ============================================================================

class TestComponentHealthQueries:
    """Tests for component health queries."""

    def test_heartbeat(self, temp_db):
        """Verify heartbeat recording."""
        ComponentHealthQueries.heartbeat(
            component="monitor",
            status="healthy",
            metadata={"version": "1.0"},
            db_path=temp_db
        )

        health = ComponentHealthQueries.get_all(temp_db)
        assert len(health) == 1
        assert health[0].component == "monitor"
        assert health[0].status == "healthy"
        assert health[0].metadata == {"version": "1.0"}

    def test_get_stale_components(self, temp_db):
        """Verify stale component detection."""
        # Create a stale heartbeat
        with transaction(temp_db) as conn:
            stale_time = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
            conn.execute(
                """INSERT INTO component_health (component, last_heartbeat, status)
                   VALUES (?, ?, ?)""",
                ("stale-component", stale_time, "healthy")
            )

        stale = ComponentHealthQueries.get_stale(threshold_seconds=60, db_path=temp_db)
        assert len(stale) == 1
        assert stale[0].component == "stale-component"


# ============================================================================
# Query Tests - Alerts
# ============================================================================

class TestAlertQueries:
    """Tests for alert queries."""

    def test_create_and_get_alerts(self, temp_db):
        """Verify alert creation and retrieval."""
        alert = Alert(
            id=generate_id(),
            severity="warning",
            alert_type="stuck",
            source="monitor",
            message="Loop 1 is stuck on TEST-001"
        )
        AlertQueries.create(alert, temp_db)

        alerts = AlertQueries.get_unacknowledged(temp_db)
        assert len(alerts) == 1
        assert alerts[0].message == "Loop 1 is stuck on TEST-001"

    def test_acknowledge_alert(self, temp_db):
        """Verify alert acknowledgement."""
        alert = Alert(
            id=generate_id(),
            severity="warning",
            alert_type="stuck",
            source="monitor",
            message="Test alert"
        )
        alert_id = AlertQueries.create(alert, temp_db)

        AlertQueries.acknowledge(alert_id, "human", temp_db)

        alerts = AlertQueries.get_unacknowledged(temp_db)
        assert len(alerts) == 0


# ============================================================================
# Integration Tests
# ============================================================================

class TestIntegration:
    """Integration tests for database layer."""

    def test_full_loop_test_workflow(self, temp_db):
        """Test complete loop -> test -> event workflow."""
        # Register loop
        loop = Loop(id="loop-1", name="Test Loop", priority=1)
        LoopQueries.register(loop, temp_db)

        # Register tests
        test1 = Test(id="TEST-001", loop_id="loop-1", category="unit")
        test2 = Test(id="TEST-002", loop_id="loop-1", category="unit", depends_on="TEST-001")
        TestQueries.register(test1, temp_db)
        TestQueries.register(test2, temp_db)

        # Subscribe to events
        SubscriptionQueries.subscribe(
            subscriber="monitor",
            event_types=["test_started", "test_passed"],
            db_path=temp_db
        )

        # Start test
        LoopQueries.update_status("loop-1", LoopStatus.RUNNING.value, "TEST-001", 1234, temp_db)
        TestQueries.update_status("TEST-001", TestStatus.IN_PROGRESS.value, db_path=temp_db)
        EventQueries.publish("loop-1", "test_started", {"test_id": "TEST-001"}, db_path=temp_db)

        # Complete test
        TestQueries.update_status("TEST-001", TestStatus.PASSED.value, "pass", temp_db)
        EventQueries.publish("loop-1", "test_passed", {"test_id": "TEST-001"}, db_path=temp_db)

        # Verify workflow
        events = EventQueries.poll("monitor", db_path=temp_db)
        assert len(events) == 2

        # Next test should now be available
        next_test = TestQueries.get_next_for_loop("loop-1", temp_db)
        assert next_test.id == "TEST-002"

        # Summary should reflect progress
        summary = TestQueries.get_summary("loop-1", temp_db)
        assert summary.get("passed", 0) == 1
        assert summary.get("pending", 0) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
