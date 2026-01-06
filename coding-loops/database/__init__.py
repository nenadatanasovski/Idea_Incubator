"""
Coordination System Database Layer

This module provides the SQLite database layer for the coordination system:
- Schema management and migrations
- Query functions for common operations
- Data models (dataclasses) for rows
- Database initialization and connection management

Database: coding-loops/coordination.db (SQLite)

Tables:
- events: Event bus messages
- subscriptions: Event subscriptions
- file_locks: File locking for conflict prevention
- knowledge: Cross-agent knowledge base
- checkpoints: Git checkpoint tracking
- test_state: Test progress (migrated from JSON)
- loops: Loop registration and status
- decisions: Pending human decisions
- usage: API/resource usage tracking
"""

# Database components imported when implemented
# from .init_db import init_database, get_connection
# from .queries import EventQueries, LockQueries, KnowledgeQueries
# from .models import Event, Subscription, FileLock, KnowledgeItem

__all__ = [
    # 'init_database',
    # 'get_connection',
    # 'EventQueries',
    # 'LockQueries',
    # 'KnowledgeQueries',
]
