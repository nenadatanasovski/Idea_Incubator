"""
Coordination System Database Layer

This module provides the SQLite database layer for the coordination system:
- Schema management and migrations
- Query functions for common operations
- Data models (dataclasses) for rows
- Database initialization and connection management

Database: coding-loops/coordination.db (SQLite)

Tables:
- loops: Loop registration and status
- tests: Test progress (migrated from JSON)
- events: Event bus messages
- subscriptions: Event subscriptions
- file_locks: File locking for conflict prevention
- wait_graph: Deadlock detection graph
- knowledge: Cross-agent knowledge base
- resources: Resource ownership registry
- change_requests: Non-owner modification requests
- migrations: Migration ordering
- checkpoints: Git checkpoint tracking
- passing_tests: Regression detection baseline
- decisions: Pending human decisions
- usage: API/resource usage tracking
- component_health: Agent heartbeats
- alerts: System alerts
- transaction_log: Atomic operation logging
"""

# Database initialization and connections
from .init_db import (
    init_database,
    verify_schema,
    get_connection,
    transaction,
    execute_with_retry,
    DatabaseConnection,
    ensure_initialized,
    get_db_path,
    DEFAULT_DB_PATH,
)

# Data models
from .models import (
    # Enums
    LoopStatus,
    TestStatus,
    DecisionStatus,
    ChangeRequestStatus,
    MigrationStatus,
    ComponentStatus,
    AlertSeverity,
    KnowledgeType,
    ResourceType,
    # Dataclasses
    Loop,
    Test,
    Event,
    Subscription,
    FileLock,
    Knowledge,
    Resource,
    ChangeRequest,
    Checkpoint,
    Decision,
    Usage,
    ComponentHealth,
    Alert,
    Migration,
)

# Query functions
from .queries import (
    generate_id,
    now_iso,
    LoopQueries,
    TestQueries,
    EventQueries,
    SubscriptionQueries,
    FileLockQueries,
    KnowledgeQueries,
    DecisionQueries,
    ComponentHealthQueries,
    AlertQueries,
)

__all__ = [
    # Initialization
    "init_database",
    "verify_schema",
    "get_connection",
    "transaction",
    "execute_with_retry",
    "DatabaseConnection",
    "ensure_initialized",
    "get_db_path",
    "DEFAULT_DB_PATH",
    # Enums
    "LoopStatus",
    "TestStatus",
    "DecisionStatus",
    "ChangeRequestStatus",
    "MigrationStatus",
    "ComponentStatus",
    "AlertSeverity",
    "KnowledgeType",
    "ResourceType",
    # Models
    "Loop",
    "Test",
    "Event",
    "Subscription",
    "FileLock",
    "Knowledge",
    "Resource",
    "ChangeRequest",
    "Checkpoint",
    "Decision",
    "Usage",
    "ComponentHealth",
    "Alert",
    "Migration",
    # Queries
    "generate_id",
    "now_iso",
    "LoopQueries",
    "TestQueries",
    "EventQueries",
    "SubscriptionQueries",
    "FileLockQueries",
    "KnowledgeQueries",
    "DecisionQueries",
    "ComponentHealthQueries",
    "AlertQueries",
]
