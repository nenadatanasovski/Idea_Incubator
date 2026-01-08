"""
Database Query Functions

Common queries for the coordination system database.
Provides a clean API layer above raw SQL.

Usage:
    from database.queries import LoopQueries, TestQueries, EventQueries

    # Get all running loops
    loops = LoopQueries.get_running()

    # Get next pending test
    test = TestQueries.get_next_for_loop("loop-1")
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, List
import uuid
import json

from .init_db import get_connection, transaction, get_db_path
from .models import (
    Loop, Test, Event, Subscription, FileLock,
    Knowledge, Resource, ChangeRequest, Checkpoint,
    Decision, Usage, ComponentHealth, Alert, Migration,
    LoopStatus, TestStatus
)


def now_iso() -> str:
    """Get current UTC time in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def generate_id() -> str:
    """Generate a UUID for database records."""
    return str(uuid.uuid4())


class LoopQueries:
    """Queries for the loops table."""

    @staticmethod
    def get_all(db_path: Optional[Path] = None) -> List[Loop]:
        """Get all registered loops."""
        with get_connection(db_path) as conn:
            rows = conn.execute("SELECT * FROM loops ORDER BY priority").fetchall()
            return [Loop.from_row(dict(r)) for r in rows]

    @staticmethod
    def get_by_id(loop_id: str, db_path: Optional[Path] = None) -> Optional[Loop]:
        """Get a loop by ID."""
        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT * FROM loops WHERE id = ?", (loop_id,)
            ).fetchone()
            return Loop.from_row(dict(row)) if row else None

    @staticmethod
    def get_running(db_path: Optional[Path] = None) -> List[Loop]:
        """Get all running loops."""
        with get_connection(db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM loops WHERE status = ? ORDER BY priority",
                (LoopStatus.RUNNING.value,)
            ).fetchall()
            return [Loop.from_row(dict(r)) for r in rows]

    @staticmethod
    def register(loop: Loop, db_path: Optional[Path] = None) -> None:
        """Register a new loop."""
        with transaction(db_path) as conn:
            data = loop.to_dict()
            data["created_at"] = now_iso()
            data["updated_at"] = now_iso()
            columns = ", ".join(data.keys())
            placeholders = ", ".join("?" * len(data))
            conn.execute(
                f"INSERT OR REPLACE INTO loops ({columns}) VALUES ({placeholders})",
                tuple(data.values())
            )

    @staticmethod
    def update_status(
        loop_id: str,
        status: str,
        current_test_id: Optional[str] = None,
        pid: Optional[int] = None,
        db_path: Optional[Path] = None
    ) -> None:
        """Update loop status."""
        with transaction(db_path) as conn:
            conn.execute(
                """UPDATE loops
                   SET status = ?, current_test_id = ?, pid = ?, updated_at = ?
                   WHERE id = ?""",
                (status, current_test_id, pid, now_iso(), loop_id)
            )

    @staticmethod
    def set_branch(loop_id: str, branch: str, db_path: Optional[Path] = None) -> None:
        """Set the git branch for a loop."""
        with transaction(db_path) as conn:
            conn.execute(
                "UPDATE loops SET branch = ?, updated_at = ? WHERE id = ?",
                (branch, now_iso(), loop_id)
            )


class TestQueries:
    """Queries for the tests table."""

    @staticmethod
    def get_all_for_loop(loop_id: str, db_path: Optional[Path] = None) -> List[Test]:
        """Get all tests for a loop."""
        with get_connection(db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM tests WHERE loop_id = ? ORDER BY id",
                (loop_id,)
            ).fetchall()
            return [Test.from_row(dict(r)) for r in rows]

    @staticmethod
    def get_by_id(test_id: str, db_path: Optional[Path] = None) -> Optional[Test]:
        """Get a test by ID."""
        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT * FROM tests WHERE id = ?", (test_id,)
            ).fetchone()
            return Test.from_row(dict(row)) if row else None

    @staticmethod
    def get_next_for_loop(loop_id: str, db_path: Optional[Path] = None) -> Optional[Test]:
        """
        Get next pending test for a loop where dependencies are met.

        A test's dependencies are met if:
        - It has no depends_on, OR
        - The depends_on test has status 'passed'
        """
        with get_connection(db_path) as conn:
            row = conn.execute(
                """SELECT t.*
                   FROM tests t
                   LEFT JOIN tests dep ON t.depends_on = dep.id
                   WHERE t.loop_id = ?
                     AND t.status = 'pending'
                     AND (t.depends_on IS NULL OR dep.status = 'passed')
                   ORDER BY t.id
                   LIMIT 1""",
                (loop_id,)
            ).fetchone()
            return Test.from_row(dict(row)) if row else None

    @staticmethod
    def get_by_status(
        status: str,
        loop_id: Optional[str] = None,
        db_path: Optional[Path] = None
    ) -> List[Test]:
        """Get tests by status, optionally filtered by loop."""
        with get_connection(db_path) as conn:
            if loop_id:
                rows = conn.execute(
                    "SELECT * FROM tests WHERE status = ? AND loop_id = ?",
                    (status, loop_id)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM tests WHERE status = ?",
                    (status,)
                ).fetchall()
            return [Test.from_row(dict(r)) for r in rows]

    @staticmethod
    def register(test: Test, db_path: Optional[Path] = None) -> None:
        """Register a new test."""
        with transaction(db_path) as conn:
            data = test.to_dict()
            data["created_at"] = now_iso()
            columns = ", ".join(data.keys())
            placeholders = ", ".join("?" * len(data))
            conn.execute(
                f"INSERT OR REPLACE INTO tests ({columns}) VALUES ({placeholders})",
                tuple(data.values())
            )

    @staticmethod
    def update_status(
        test_id: str,
        status: str,
        last_result: Optional[str] = None,
        db_path: Optional[Path] = None
    ) -> None:
        """Update test status."""
        with transaction(db_path) as conn:
            updates = ["status = ?", "last_attempt_at = ?"]
            values = [status, now_iso()]

            if last_result:
                updates.append("last_result = ?")
                values.append(last_result)

            if status == TestStatus.PASSED.value:
                updates.append("passed_at = ?")
                values.append(now_iso())

            values.append(test_id)
            conn.execute(
                f"UPDATE tests SET {', '.join(updates)} WHERE id = ?",
                tuple(values)
            )

    @staticmethod
    def increment_attempts(test_id: str, db_path: Optional[Path] = None) -> int:
        """Increment attempt count and return new value."""
        with transaction(db_path) as conn:
            conn.execute(
                "UPDATE tests SET attempts = attempts + 1, last_attempt_at = ? WHERE id = ?",
                (now_iso(), test_id)
            )
            row = conn.execute(
                "SELECT attempts FROM tests WHERE id = ?", (test_id,)
            ).fetchone()
            return row[0] if row else 0

    @staticmethod
    def mark_verified(test_id: str, db_path: Optional[Path] = None) -> None:
        """Mark a test as verified by the verification gate."""
        with transaction(db_path) as conn:
            conn.execute(
                "UPDATE tests SET verified_at = ? WHERE id = ?",
                (now_iso(), test_id)
            )

    @staticmethod
    def get_summary(loop_id: Optional[str] = None, db_path: Optional[Path] = None) -> dict:
        """Get test summary counts."""
        with get_connection(db_path) as conn:
            base_query = "SELECT status, COUNT(*) as count FROM tests"
            if loop_id:
                rows = conn.execute(
                    f"{base_query} WHERE loop_id = ? GROUP BY status",
                    (loop_id,)
                ).fetchall()
            else:
                rows = conn.execute(f"{base_query} GROUP BY status").fetchall()

            summary = {r["status"]: r["count"] for r in rows}
            summary["total"] = sum(summary.values())
            return summary


class EventQueries:
    """Queries for the events table."""

    @staticmethod
    def publish(
        source: str,
        event_type: str,
        payload: dict,
        priority: int = 5,
        correlation_id: Optional[str] = None,
        db_path: Optional[Path] = None
    ) -> str:
        """Publish an event. Returns event ID."""
        event = Event(
            id=generate_id(),
            timestamp=now_iso(),
            source=source,
            event_type=event_type,
            payload=payload,
            priority=priority,
            correlation_id=correlation_id
        )
        with transaction(db_path) as conn:
            data = event.to_dict()
            columns = ", ".join(data.keys())
            placeholders = ", ".join("?" * len(data))
            conn.execute(
                f"INSERT INTO events ({columns}) VALUES ({placeholders})",
                tuple(data.values())
            )
        return event.id

    @staticmethod
    def poll(
        subscriber: str,
        limit: int = 10,
        db_path: Optional[Path] = None
    ) -> List[Event]:
        """Poll for unacknowledged events for a subscriber."""
        with get_connection(db_path) as conn:
            # First, get subscriber's subscriptions
            sub_rows = conn.execute(
                """SELECT event_types, filter_sources
                   FROM subscriptions
                   WHERE subscriber = ? AND active = 1""",
                (subscriber,)
            ).fetchall()

            if not sub_rows:
                return []

            # Build event type and source filters
            all_types = set()
            filter_sources = None
            for row in sub_rows:
                types = json.loads(row["event_types"])
                all_types.update(types)
                if row["filter_sources"]:
                    sources = json.loads(row["filter_sources"])
                    filter_sources = sources if filter_sources is None else filter_sources

            # Query events
            type_placeholders = ", ".join("?" * len(all_types))
            query = f"""SELECT * FROM events
                        WHERE event_type IN ({type_placeholders})
                          AND acknowledged = 0
                        ORDER BY priority, timestamp
                        LIMIT ?"""

            params = list(all_types) + [limit]
            rows = conn.execute(query, params).fetchall()

            # Update last_poll_at
            conn.execute(
                "UPDATE subscriptions SET last_poll_at = ? WHERE subscriber = ?",
                (now_iso(), subscriber)
            )

            return [Event.from_row(dict(r)) for r in rows]

    @staticmethod
    def acknowledge(event_id: str, subscriber: str, db_path: Optional[Path] = None) -> None:
        """Acknowledge an event."""
        with transaction(db_path) as conn:
            conn.execute(
                """UPDATE events
                   SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
                   WHERE id = ?""",
                (subscriber, now_iso(), event_id)
            )

    @staticmethod
    def get_timeline(
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        sources: Optional[List[str]] = None,
        types: Optional[List[str]] = None,
        limit: int = 100,
        db_path: Optional[Path] = None
    ) -> List[Event]:
        """Query event timeline."""
        with get_connection(db_path) as conn:
            query = "SELECT * FROM events WHERE 1=1"
            params = []

            if since:
                query += " AND timestamp >= ?"
                params.append(since.isoformat())

            if until:
                query += " AND timestamp <= ?"
                params.append(until.isoformat())

            if sources:
                placeholders = ", ".join("?" * len(sources))
                query += f" AND source IN ({placeholders})"
                params.extend(sources)

            if types:
                placeholders = ", ".join("?" * len(types))
                query += f" AND event_type IN ({placeholders})"
                params.extend(types)

            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)

            rows = conn.execute(query, params).fetchall()
            return [Event.from_row(dict(r)) for r in rows]


class SubscriptionQueries:
    """Queries for the subscriptions table."""

    @staticmethod
    def subscribe(
        subscriber: str,
        event_types: List[str],
        filter_sources: Optional[List[str]] = None,
        db_path: Optional[Path] = None
    ) -> str:
        """Create a subscription. Returns subscription ID."""
        sub_id = generate_id()
        sub = Subscription(
            id=sub_id,
            subscriber=subscriber,
            event_types=event_types,
            filter_sources=filter_sources
        )
        with transaction(db_path) as conn:
            data = sub.to_dict()
            columns = ", ".join(data.keys())
            placeholders = ", ".join("?" * len(data))
            conn.execute(
                f"INSERT INTO subscriptions ({columns}) VALUES ({placeholders})",
                tuple(data.values())
            )
        return sub_id

    @staticmethod
    def unsubscribe(subscription_id: str, db_path: Optional[Path] = None) -> None:
        """Deactivate a subscription."""
        with transaction(db_path) as conn:
            conn.execute(
                "UPDATE subscriptions SET active = 0 WHERE id = ?",
                (subscription_id,)
            )


class FileLockQueries:
    """Queries for the file_locks table."""

    @staticmethod
    def acquire(
        file_path: str,
        locked_by: str,
        reason: Optional[str] = None,
        ttl_seconds: int = 300,
        test_id: Optional[str] = None,
        db_path: Optional[Path] = None
    ) -> bool:
        """Attempt to acquire a lock. Returns True if acquired."""
        import sqlite3

        try:
            with transaction(db_path) as conn:
                # Check for existing lock
                row = conn.execute(
                    "SELECT * FROM file_locks WHERE file_path = ?",
                    (file_path,)
                ).fetchone()

                if row:
                    lock = FileLock.from_row(dict(row))
                    if not lock.is_expired() and lock.locked_by != locked_by:
                        return False
                    # Expired or same owner - delete and reacquire
                    conn.execute(
                        "DELETE FROM file_locks WHERE file_path = ?",
                        (file_path,)
                    )

                expires_at = (
                    datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
                ).isoformat()

                lock = FileLock(
                    file_path=file_path,
                    locked_by=locked_by,
                    locked_at=now_iso(),
                    lock_reason=reason,
                    expires_at=expires_at,
                    test_id=test_id
                )
                data = lock.to_dict()
                columns = ", ".join(data.keys())
                placeholders = ", ".join("?" * len(data))
                conn.execute(
                    f"INSERT INTO file_locks ({columns}) VALUES ({placeholders})",
                    tuple(data.values())
                )
                return True
        except sqlite3.IntegrityError:
            # Race condition - another thread acquired the lock
            return False

    @staticmethod
    def release(file_path: str, locked_by: str, db_path: Optional[Path] = None) -> bool:
        """Release a lock. Returns True if released."""
        with transaction(db_path) as conn:
            result = conn.execute(
                "DELETE FROM file_locks WHERE file_path = ? AND locked_by = ?",
                (file_path, locked_by)
            )
            return result.rowcount > 0

    @staticmethod
    def check(file_path: str, db_path: Optional[Path] = None) -> Optional[FileLock]:
        """Check lock status. Returns lock info or None."""
        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT * FROM file_locks WHERE file_path = ?",
                (file_path,)
            ).fetchone()

            if not row:
                return None

            lock = FileLock.from_row(dict(row))
            if lock.is_expired():
                # Clean up expired lock
                conn.execute(
                    "DELETE FROM file_locks WHERE file_path = ?",
                    (file_path,)
                )
                return None

            return lock

    @staticmethod
    def release_expired(db_path: Optional[Path] = None) -> int:
        """Release all expired locks. Returns count released."""
        with transaction(db_path) as conn:
            result = conn.execute(
                "DELETE FROM file_locks WHERE expires_at < ?",
                (now_iso(),)
            )
            return result.rowcount

    @staticmethod
    def release_all_for_owner(locked_by: str, db_path: Optional[Path] = None) -> int:
        """Release all locks for an owner. Returns count released."""
        with transaction(db_path) as conn:
            result = conn.execute(
                "DELETE FROM file_locks WHERE locked_by = ?",
                (locked_by,)
            )
            return result.rowcount


class KnowledgeQueries:
    """Queries for the knowledge table."""

    @staticmethod
    def record(knowledge: Knowledge, db_path: Optional[Path] = None) -> str:
        """Record a knowledge item. Returns ID."""
        with transaction(db_path) as conn:
            knowledge.id = knowledge.id or generate_id()
            data = knowledge.to_dict()
            data["created_at"] = now_iso()
            columns = ", ".join(data.keys())
            placeholders = ", ".join("?" * len(data))
            conn.execute(
                f"INSERT INTO knowledge ({columns}) VALUES ({placeholders})",
                tuple(data.values())
            )
        return knowledge.id

    @staticmethod
    def query(
        topic: Optional[str] = None,
        item_type: Optional[str] = None,
        loop_id: Optional[str] = None,
        limit: int = 10,
        db_path: Optional[Path] = None
    ) -> List[Knowledge]:
        """Query knowledge items."""
        with get_connection(db_path) as conn:
            query = "SELECT * FROM knowledge WHERE superseded_by IS NULL"
            params = []

            if topic:
                query += " AND topic = ?"
                params.append(topic)

            if item_type:
                query += " AND item_type = ?"
                params.append(item_type)

            if loop_id:
                query += " AND loop_id = ?"
                params.append(loop_id)

            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)

            rows = conn.execute(query, params).fetchall()
            return [Knowledge.from_row(dict(r)) for r in rows]


class DecisionQueries:
    """Queries for the decisions table."""

    @staticmethod
    def create(decision: Decision, db_path: Optional[Path] = None) -> str:
        """Create a decision request. Returns ID."""
        with transaction(db_path) as conn:
            decision.id = decision.id or generate_id()
            data = decision.to_dict()
            data["requested_at"] = now_iso()
            columns = ", ".join(data.keys())
            placeholders = ", ".join("?" * len(data))
            conn.execute(
                f"INSERT INTO decisions ({columns}) VALUES ({placeholders})",
                tuple(data.values())
            )
        return decision.id

    @staticmethod
    def get_pending(db_path: Optional[Path] = None) -> List[Decision]:
        """Get all pending decisions."""
        with get_connection(db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM decisions WHERE status = 'pending' ORDER BY requested_at"
            ).fetchall()
            return [Decision.from_row(dict(r)) for r in rows]

    @staticmethod
    def resolve(
        decision_id: str,
        choice: str,
        decided_by: str,
        comment: Optional[str] = None,
        db_path: Optional[Path] = None
    ) -> None:
        """Resolve a decision."""
        with transaction(db_path) as conn:
            conn.execute(
                """UPDATE decisions
                   SET status = 'decided', choice = ?, decided_by = ?,
                       decided_at = ?, comment = ?
                   WHERE id = ?""",
                (choice, decided_by, now_iso(), comment, decision_id)
            )


class ComponentHealthQueries:
    """Queries for the component_health table."""

    @staticmethod
    def heartbeat(
        component: str,
        status: str = "healthy",
        metadata: Optional[dict] = None,
        db_path: Optional[Path] = None
    ) -> None:
        """Record a heartbeat."""
        with transaction(db_path) as conn:
            conn.execute(
                """INSERT OR REPLACE INTO component_health
                   (component, last_heartbeat, status, metadata)
                   VALUES (?, ?, ?, ?)""",
                (component, now_iso(), status,
                 json.dumps(metadata) if metadata else None)
            )

    @staticmethod
    def get_all(db_path: Optional[Path] = None) -> List[ComponentHealth]:
        """Get all component health records."""
        with get_connection(db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM component_health ORDER BY component"
            ).fetchall()
            return [ComponentHealth.from_row(dict(r)) for r in rows]

    @staticmethod
    def get_stale(
        threshold_seconds: int = 120,
        db_path: Optional[Path] = None
    ) -> List[ComponentHealth]:
        """Get components with stale heartbeats."""
        threshold = (
            datetime.now(timezone.utc) - timedelta(seconds=threshold_seconds)
        ).isoformat()
        with get_connection(db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM component_health WHERE last_heartbeat < ?",
                (threshold,)
            ).fetchall()
            return [ComponentHealth.from_row(dict(r)) for r in rows]


class AlertQueries:
    """Queries for the alerts table."""

    @staticmethod
    def create(alert: Alert, db_path: Optional[Path] = None) -> str:
        """Create an alert. Returns ID."""
        with transaction(db_path) as conn:
            alert.id = alert.id or generate_id()
            data = alert.to_dict()
            data["created_at"] = now_iso()
            columns = ", ".join(data.keys())
            placeholders = ", ".join("?" * len(data))
            conn.execute(
                f"INSERT INTO alerts ({columns}) VALUES ({placeholders})",
                tuple(data.values())
            )
        return alert.id

    @staticmethod
    def get_unacknowledged(db_path: Optional[Path] = None) -> List[Alert]:
        """Get all unacknowledged alerts."""
        with get_connection(db_path) as conn:
            rows = conn.execute(
                """SELECT * FROM alerts
                   WHERE acknowledged = 0
                   ORDER BY severity DESC, created_at DESC"""
            ).fetchall()
            return [Alert.from_row(dict(r)) for r in rows]

    @staticmethod
    def acknowledge(
        alert_id: str,
        acknowledged_by: str,
        db_path: Optional[Path] = None
    ) -> None:
        """Acknowledge an alert."""
        with transaction(db_path) as conn:
            conn.execute(
                """UPDATE alerts
                   SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
                   WHERE id = ?""",
                (acknowledged_by, now_iso(), alert_id)
            )
