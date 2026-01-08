"""
Message Bus for Inter-Agent Communication

Provides a SQLite-backed event bus for coordination between loops and agents.
Supports publish/subscribe pattern, file locking, and timeline queries.

Usage:
    from shared.message_bus import MessageBus

    bus = MessageBus()

    # Subscribe to events
    sub_id = bus.subscribe("monitor", ["test_started", "test_passed"])

    # Publish events
    event_id = bus.publish("loop-1", "test_started", {"test_id": "TEST-001"})

    # Poll for events
    events = bus.poll("monitor")
    for event in events:
        process(event)
        bus.acknowledge(event.id, "monitor")

    # File locking
    if bus.lock_file("/path/to/file.ts", "loop-1"):
        # Do work
        bus.unlock_file("/path/to/file.ts", "loop-1")
"""

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any
import threading

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.init_db import (
    get_db_path,
    ensure_initialized,
    get_connection,
    transaction,
)
from database.models import Event, Subscription, FileLock
from database.queries import (
    EventQueries,
    SubscriptionQueries,
    FileLockQueries,
    generate_id,
    now_iso,
)

logger = logging.getLogger(__name__)


class MessageBus:
    """
    Event bus for inter-agent communication.

    Thread-safe implementation backed by SQLite.
    Provides publish/subscribe, file locking, and timeline queries.
    """

    def __init__(self, db_path: Optional[Path] = None):
        """
        Initialize the message bus.

        Args:
            db_path: Path to the SQLite database. If None, uses default.
        """
        self.db_path = db_path or get_db_path()
        self._lock = threading.Lock()

        # Ensure database is initialized
        ensure_initialized(self.db_path)

        logger.debug(f"MessageBus initialized with database: {self.db_path}")

    # =========================================================================
    # Publishing
    # =========================================================================

    def publish(
        self,
        source: str,
        event_type: str,
        payload: Dict[str, Any],
        priority: int = 5,
        correlation_id: Optional[str] = None
    ) -> str:
        """
        Publish an event to the bus.

        Args:
            source: Source of the event (e.g., "loop-1", "monitor", "pm")
            event_type: Type of event (e.g., "test_started", "file_locked")
            payload: Event data as a dictionary
            priority: Priority level (1 = highest, 10 = lowest). Default 5.
            correlation_id: Optional ID to correlate related events

        Returns:
            The event ID

        Example:
            event_id = bus.publish(
                source="loop-1",
                event_type="test_started",
                payload={"test_id": "TEST-001", "attempt": 1}
            )
        """
        event_id = EventQueries.publish(
            source=source,
            event_type=event_type,
            payload=payload,
            priority=priority,
            correlation_id=correlation_id,
            db_path=self.db_path
        )

        logger.debug(f"Published event {event_id}: {event_type} from {source}")
        return event_id

    def publish_batch(
        self,
        events: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Publish multiple events atomically.

        Args:
            events: List of event dicts with keys: source, event_type, payload,
                   and optional: priority, correlation_id

        Returns:
            List of event IDs
        """
        event_ids = []
        with transaction(self.db_path) as conn:
            for event_data in events:
                event = Event(
                    id=generate_id(),
                    timestamp=now_iso(),
                    source=event_data["source"],
                    event_type=event_data["event_type"],
                    payload=event_data["payload"],
                    priority=event_data.get("priority", 5),
                    correlation_id=event_data.get("correlation_id")
                )
                data = event.to_dict()
                columns = ", ".join(data.keys())
                placeholders = ", ".join("?" * len(data))
                conn.execute(
                    f"INSERT INTO events ({columns}) VALUES ({placeholders})",
                    tuple(data.values())
                )
                event_ids.append(event.id)

        logger.debug(f"Published batch of {len(event_ids)} events")
        return event_ids

    # =========================================================================
    # Subscriptions
    # =========================================================================

    def subscribe(
        self,
        subscriber: str,
        event_types: List[str],
        filter_sources: Optional[List[str]] = None
    ) -> str:
        """
        Subscribe to event types.

        Args:
            subscriber: Name of the subscribing agent (e.g., "monitor", "pm")
            event_types: List of event types to subscribe to
            filter_sources: Optional list of sources to filter (None = all)

        Returns:
            Subscription ID

        Example:
            sub_id = bus.subscribe(
                subscriber="monitor",
                event_types=["test_started", "test_passed", "test_failed"]
            )
        """
        sub_id = SubscriptionQueries.subscribe(
            subscriber=subscriber,
            event_types=event_types,
            filter_sources=filter_sources,
            db_path=self.db_path
        )

        logger.debug(f"Created subscription {sub_id} for {subscriber}: {event_types}")
        return sub_id

    def unsubscribe(self, subscription_id: str) -> None:
        """
        Remove a subscription.

        Args:
            subscription_id: The subscription ID to remove
        """
        SubscriptionQueries.unsubscribe(subscription_id, self.db_path)
        logger.debug(f"Removed subscription {subscription_id}")

    def get_subscriptions(self, subscriber: str) -> List[Subscription]:
        """
        Get all active subscriptions for a subscriber.

        Args:
            subscriber: Name of the subscriber

        Returns:
            List of Subscription objects
        """
        with get_connection(self.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM subscriptions WHERE subscriber = ? AND active = 1",
                (subscriber,)
            ).fetchall()
            return [Subscription.from_row(dict(r)) for r in rows]

    # =========================================================================
    # Polling
    # =========================================================================

    def poll(
        self,
        subscriber: str,
        limit: int = 10,
        event_types: Optional[List[str]] = None
    ) -> List[Event]:
        """
        Poll for unacknowledged events.

        Args:
            subscriber: Name of the subscriber
            limit: Maximum number of events to return
            event_types: Optional filter for specific event types

        Returns:
            List of Event objects, ordered by priority then timestamp

        Example:
            events = bus.poll("monitor", limit=5)
            for event in events:
                handle(event)
                bus.acknowledge(event.id, "monitor")
        """
        events = EventQueries.poll(
            subscriber=subscriber,
            limit=limit,
            db_path=self.db_path
        )

        # Filter by event types if specified
        if event_types:
            events = [e for e in events if e.event_type in event_types]

        logger.debug(f"Polled {len(events)} events for {subscriber}")
        return events

    def acknowledge(self, event_id: str, subscriber: str) -> None:
        """
        Acknowledge an event as processed.

        Args:
            event_id: The event ID to acknowledge
            subscriber: Name of the subscriber acknowledging
        """
        EventQueries.acknowledge(event_id, subscriber, self.db_path)
        logger.debug(f"Acknowledged event {event_id} by {subscriber}")

    def acknowledge_batch(self, event_ids: List[str], subscriber: str) -> None:
        """
        Acknowledge multiple events atomically.

        Args:
            event_ids: List of event IDs to acknowledge
            subscriber: Name of the subscriber acknowledging
        """
        with transaction(self.db_path) as conn:
            for event_id in event_ids:
                conn.execute(
                    """UPDATE events
                       SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
                       WHERE id = ?""",
                    (subscriber, now_iso(), event_id)
                )
        logger.debug(f"Acknowledged {len(event_ids)} events by {subscriber}")

    # =========================================================================
    # Timeline
    # =========================================================================

    def get_timeline(
        self,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        sources: Optional[List[str]] = None,
        types: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Event]:
        """
        Query event timeline.

        Args:
            since: Only events after this time
            until: Only events before this time
            sources: Filter by these sources
            types: Filter by these event types
            limit: Maximum events to return

        Returns:
            List of Event objects in reverse chronological order

        Example:
            # Get last hour of events from loop-1
            from datetime import datetime, timedelta
            events = bus.get_timeline(
                since=datetime.now() - timedelta(hours=1),
                sources=["loop-1"]
            )
        """
        return EventQueries.get_timeline(
            since=since,
            until=until,
            sources=sources,
            types=types,
            limit=limit,
            db_path=self.db_path
        )

    def get_event(self, event_id: str) -> Optional[Event]:
        """
        Get a specific event by ID.

        Args:
            event_id: The event ID

        Returns:
            Event object or None if not found
        """
        with get_connection(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM events WHERE id = ?",
                (event_id,)
            ).fetchone()
            return Event.from_row(dict(row)) if row else None

    def get_correlated_events(self, correlation_id: str) -> List[Event]:
        """
        Get all events with a specific correlation ID.

        Args:
            correlation_id: The correlation ID to search for

        Returns:
            List of Event objects
        """
        with get_connection(self.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM events WHERE correlation_id = ? ORDER BY timestamp",
                (correlation_id,)
            ).fetchall()
            return [Event.from_row(dict(r)) for r in rows]

    # =========================================================================
    # File Locking
    # =========================================================================

    def lock_file(
        self,
        file_path: str,
        locked_by: str,
        reason: Optional[str] = None,
        ttl_seconds: int = 300,
        test_id: Optional[str] = None
    ) -> bool:
        """
        Attempt to acquire a lock on a file.

        Args:
            file_path: Path to the file to lock
            locked_by: ID of the loop/agent acquiring the lock
            reason: Optional reason for the lock
            ttl_seconds: Time-to-live in seconds (default 5 minutes)
            test_id: Optional test ID associated with the lock

        Returns:
            True if lock was acquired, False if already locked by another

        Example:
            if bus.lock_file("/path/to/file.ts", "loop-1", reason="Modifying API"):
                try:
                    # Do work
                finally:
                    bus.unlock_file("/path/to/file.ts", "loop-1")
        """
        acquired = FileLockQueries.acquire(
            file_path=file_path,
            locked_by=locked_by,
            reason=reason,
            ttl_seconds=ttl_seconds,
            test_id=test_id,
            db_path=self.db_path
        )

        if acquired:
            logger.debug(f"Lock acquired on {file_path} by {locked_by}")
            # Publish lock event
            self.publish(
                source=locked_by,
                event_type="file_locked",
                payload={
                    "file_path": file_path,
                    "reason": reason,
                    "ttl_seconds": ttl_seconds,
                    "test_id": test_id
                }
            )
        else:
            logger.debug(f"Lock denied on {file_path} for {locked_by}")

        return acquired

    def unlock_file(self, file_path: str, locked_by: str) -> bool:
        """
        Release a lock on a file.

        Args:
            file_path: Path to the file to unlock
            locked_by: ID of the loop/agent releasing the lock

        Returns:
            True if lock was released, False if not owned by this agent
        """
        released = FileLockQueries.release(file_path, locked_by, self.db_path)

        if released:
            logger.debug(f"Lock released on {file_path} by {locked_by}")
            # Publish unlock event
            self.publish(
                source=locked_by,
                event_type="file_unlocked",
                payload={"file_path": file_path}
            )

        return released

    def check_lock(self, file_path: str) -> Optional[FileLock]:
        """
        Check the lock status of a file.

        Args:
            file_path: Path to the file to check

        Returns:
            FileLock object if locked, None if unlocked
        """
        return FileLockQueries.check(file_path, self.db_path)

    def get_locks(self, locked_by: Optional[str] = None) -> List[FileLock]:
        """
        Get all active locks, optionally filtered by owner.

        Args:
            locked_by: Optional filter by lock owner

        Returns:
            List of FileLock objects
        """
        with get_connection(self.db_path) as conn:
            if locked_by:
                rows = conn.execute(
                    "SELECT * FROM file_locks WHERE locked_by = ?",
                    (locked_by,)
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM file_locks").fetchall()

            locks = []
            for row in rows:
                lock = FileLock.from_row(dict(row))
                if not lock.is_expired():
                    locks.append(lock)

            return locks

    def release_expired_locks(self) -> int:
        """
        Release all expired locks.

        Returns:
            Number of locks released
        """
        count = FileLockQueries.release_expired(self.db_path)
        if count > 0:
            logger.info(f"Released {count} expired locks")
        return count

    def release_all_locks(self, locked_by: str) -> int:
        """
        Release all locks held by a specific owner.

        Args:
            locked_by: ID of the loop/agent

        Returns:
            Number of locks released
        """
        count = FileLockQueries.release_all_for_owner(locked_by, self.db_path)
        if count > 0:
            logger.info(f"Released {count} locks for {locked_by}")
            # Publish event
            self.publish(
                source=locked_by,
                event_type="all_locks_released",
                payload={"count": count}
            )
        return count

    # =========================================================================
    # Wait Graph (for deadlock detection)
    # =========================================================================

    def record_wait(self, waiter: str, holder: str, resource: str) -> None:
        """
        Record that a loop is waiting for another loop's resource.

        Args:
            waiter: ID of the waiting loop
            holder: ID of the loop holding the resource
            resource: The resource being waited for (file path, etc.)
        """
        with transaction(self.db_path) as conn:
            conn.execute(
                """INSERT OR REPLACE INTO wait_graph
                   (waiter, holder, resource, waiting_since)
                   VALUES (?, ?, ?, ?)""",
                (waiter, holder, resource, now_iso())
            )
        logger.debug(f"Recorded wait: {waiter} waiting for {holder} on {resource}")

    def clear_wait(self, waiter: str, resource: str) -> None:
        """
        Clear a wait record when lock is acquired or abandoned.

        Args:
            waiter: ID of the loop that was waiting
            resource: The resource that was being waited for
        """
        with transaction(self.db_path) as conn:
            conn.execute(
                "DELETE FROM wait_graph WHERE waiter = ? AND resource = ?",
                (waiter, resource)
            )

    def get_wait_graph(self) -> List[Dict[str, Any]]:
        """
        Get the current wait graph for deadlock analysis.

        Returns:
            List of wait records with waiter, holder, resource, waiting_since
        """
        with get_connection(self.db_path) as conn:
            rows = conn.execute("SELECT * FROM wait_graph").fetchall()
            return [dict(row) for row in rows]

    # =========================================================================
    # Utilities
    # =========================================================================

    def cleanup(self, older_than_hours: int = 24) -> Dict[str, int]:
        """
        Clean up old acknowledged events and expired locks.

        Args:
            older_than_hours: Remove acknowledged events older than this

        Returns:
            Dict with cleanup counts
        """
        cutoff = (
            datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
        ).isoformat()

        with transaction(self.db_path) as conn:
            # Remove old acknowledged events
            result = conn.execute(
                """DELETE FROM events
                   WHERE acknowledged = 1 AND timestamp < ?""",
                (cutoff,)
            )
            events_removed = result.rowcount

            # Remove expired locks
            locks_removed = FileLockQueries.release_expired(self.db_path)

        logger.info(f"Cleanup: {events_removed} events, {locks_removed} locks removed")

        return {
            "events_removed": events_removed,
            "locks_removed": locks_removed
        }

    def get_stats(self) -> Dict[str, Any]:
        """
        Get message bus statistics.

        Returns:
            Dict with event counts, subscription counts, lock counts
        """
        with get_connection(self.db_path) as conn:
            stats = {}

            # Event counts
            row = conn.execute(
                "SELECT COUNT(*) as total, SUM(acknowledged) as acknowledged FROM events"
            ).fetchone()
            stats["events"] = {
                "total": row["total"],
                "acknowledged": row["acknowledged"] or 0,
                "pending": row["total"] - (row["acknowledged"] or 0)
            }

            # Subscription counts
            row = conn.execute(
                "SELECT COUNT(*) as total FROM subscriptions WHERE active = 1"
            ).fetchone()
            stats["subscriptions"] = {"active": row["total"]}

            # Lock counts
            row = conn.execute("SELECT COUNT(*) as total FROM file_locks").fetchone()
            stats["locks"] = {"active": row["total"]}

            # Wait graph size
            row = conn.execute("SELECT COUNT(*) as total FROM wait_graph").fetchone()
            stats["wait_graph"] = {"entries": row["total"]}

            return stats


# Singleton instance for shared use
_default_bus: Optional[MessageBus] = None
_bus_lock = threading.Lock()


def get_message_bus(db_path: Optional[Path] = None) -> MessageBus:
    """
    Get the default message bus instance.

    Creates a new instance if none exists, or if a different db_path is specified.

    Args:
        db_path: Optional custom database path

    Returns:
        MessageBus instance
    """
    global _default_bus

    with _bus_lock:
        if _default_bus is None or (db_path and db_path != _default_bus.db_path):
            _default_bus = MessageBus(db_path)
        return _default_bus
