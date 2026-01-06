"""
Database Initialization Module

Provides initialization and connection management for the coordination database.
Uses SQLite with WAL mode for better concurrency.

Usage:
    from database.init_db import get_connection, init_database

    # Initialize schema (run once)
    init_database()

    # Get a connection for queries
    with get_connection() as conn:
        cursor = conn.execute("SELECT * FROM loops")
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Optional
import threading
import logging

logger = logging.getLogger(__name__)

# Default database path
DEFAULT_DB_PATH = Path(__file__).parent.parent / "coordination.db"

# Thread-local storage for connections
_local = threading.local()

# Schema file path
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_db_path() -> Path:
    """Get the database path, respecting environment overrides."""
    import os

    env_path = os.environ.get("COORDINATION_DB_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH


def init_database(db_path: Optional[Path] = None, force: bool = False) -> None:
    """
    Initialize the database schema.

    Args:
        db_path: Path to the database file. If None, uses default.
        force: If True, drop and recreate all tables.
    """
    db_path = db_path or get_db_path()
    schema_path = SCHEMA_PATH

    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_path}")

    # Create parent directory if needed
    db_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Initializing database at {db_path}")

    conn = sqlite3.connect(str(db_path))
    try:
        # Enable WAL mode and foreign keys
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")

        if force:
            # Drop all tables (careful!)
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
            tables = [row[0] for row in cursor.fetchall()]
            for table in tables:
                logger.warning(f"Dropping table: {table}")
                conn.execute(f"DROP TABLE IF EXISTS {table}")
            conn.commit()

        # Read and execute schema
        schema_sql = schema_path.read_text()
        conn.executescript(schema_sql)
        conn.commit()

        # Verify tables exist
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        tables = [row[0] for row in cursor.fetchall()]
        logger.info(f"Database initialized with tables: {tables}")

    finally:
        conn.close()


def verify_schema(db_path: Optional[Path] = None) -> dict:
    """
    Verify the database schema is correct.

    Returns:
        dict with 'valid' boolean and 'tables' list
    """
    db_path = db_path or get_db_path()

    if not db_path.exists():
        return {"valid": False, "tables": [], "error": "Database file does not exist"}

    expected_tables = {
        "loops", "tests", "events", "subscriptions", "file_locks",
        "wait_graph", "knowledge", "resources", "change_requests",
        "migrations", "checkpoints", "passing_tests", "decisions",
        "usage", "component_health", "alerts", "transaction_log"
    }

    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        actual_tables = {row[0] for row in cursor.fetchall()}

        missing = expected_tables - actual_tables
        extra = actual_tables - expected_tables

        return {
            "valid": len(missing) == 0,
            "tables": list(actual_tables),
            "missing": list(missing),
            "extra": list(extra)
        }
    finally:
        conn.close()


@contextmanager
def get_connection(db_path: Optional[Path] = None, isolation_level: Optional[str] = None):
    """
    Get a database connection with proper configuration.

    Uses thread-local storage to reuse connections within the same thread.

    Args:
        db_path: Path to the database file. If None, uses default.
        isolation_level: SQLite isolation level. None for autocommit.

    Yields:
        sqlite3.Connection object

    Example:
        with get_connection() as conn:
            conn.execute("INSERT INTO loops ...")
            conn.commit()
    """
    db_path = db_path or get_db_path()

    # Create connection
    conn = sqlite3.connect(str(db_path), isolation_level=isolation_level)
    conn.row_factory = sqlite3.Row  # Return rows as dict-like objects

    # Configure connection
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def transaction(db_path: Optional[Path] = None):
    """
    Context manager for transactions with automatic commit/rollback.

    Example:
        with transaction() as conn:
            conn.execute("INSERT INTO loops ...")
            conn.execute("INSERT INTO tests ...")
            # Commits automatically on success
            # Rolls back on exception
    """
    db_path = db_path or get_db_path()

    conn = sqlite3.connect(str(db_path), isolation_level="IMMEDIATE")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def execute_with_retry(
    query: str,
    params: tuple = (),
    db_path: Optional[Path] = None,
    max_retries: int = 3,
    retry_delay: float = 0.1
) -> list:
    """
    Execute a query with retry logic for busy database.

    Args:
        query: SQL query to execute
        params: Query parameters
        db_path: Path to the database
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds

    Returns:
        List of rows (as dicts) for SELECT queries, or affected row count
    """
    import time

    db_path = db_path or get_db_path()
    last_error = None

    for attempt in range(max_retries):
        try:
            with get_connection(db_path) as conn:
                cursor = conn.execute(query, params)
                if query.strip().upper().startswith("SELECT"):
                    return [dict(row) for row in cursor.fetchall()]
                else:
                    conn.commit()
                    return cursor.rowcount
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                last_error = e
                time.sleep(retry_delay * (attempt + 1))
            else:
                raise

    raise last_error


class DatabaseConnection:
    """
    Reusable database connection wrapper with convenience methods.

    Example:
        db = DatabaseConnection()
        loops = db.query("SELECT * FROM loops WHERE status = ?", ("running",))
        db.execute("UPDATE loops SET status = ? WHERE id = ?", ("paused", "loop-1"))
    """

    def __init__(self, db_path: Optional[Path] = None):
        """Initialize with optional custom database path."""
        self.db_path = db_path or get_db_path()
        self._conn: Optional[sqlite3.Connection] = None

    def _get_conn(self) -> sqlite3.Connection:
        """Get or create connection."""
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA foreign_keys = ON")
        return self._conn

    def query(self, sql: str, params: tuple = ()) -> list:
        """Execute a SELECT query and return all rows as dicts."""
        cursor = self._get_conn().execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]

    def query_one(self, sql: str, params: tuple = ()) -> Optional[dict]:
        """Execute a SELECT query and return first row or None."""
        cursor = self._get_conn().execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else None

    def execute(self, sql: str, params: tuple = ()) -> int:
        """Execute a modification query and return affected row count."""
        cursor = self._get_conn().execute(sql, params)
        self._get_conn().commit()
        return cursor.rowcount

    def executemany(self, sql: str, params_list: list) -> int:
        """Execute a modification query for multiple parameter sets."""
        cursor = self._get_conn().executemany(sql, params_list)
        self._get_conn().commit()
        return cursor.rowcount

    def close(self):
        """Close the connection if open."""
        if self._conn:
            self._conn.close()
            self._conn = None

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit with rollback on exception."""
        if exc_type:
            if self._conn:
                self._conn.rollback()
        self.close()
        return False


# Module-level initialization check
def ensure_initialized(db_path: Optional[Path] = None) -> bool:
    """
    Ensure database is initialized, creating schema if needed.

    Returns:
        True if database was already initialized, False if it was created
    """
    db_path = db_path or get_db_path()

    if not db_path.exists():
        init_database(db_path)
        return False

    result = verify_schema(db_path)
    if not result["valid"]:
        logger.warning(f"Schema incomplete, missing: {result.get('missing', [])}")
        init_database(db_path)
        return False

    return True


if __name__ == "__main__":
    # CLI for database initialization
    import sys

    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) > 1 and sys.argv[1] == "--force":
        init_database(force=True)
        print("Database forcefully reinitialized")
    else:
        init_database()
        print("Database initialized")

    result = verify_schema()
    print(f"Schema valid: {result['valid']}")
    print(f"Tables: {result['tables']}")
