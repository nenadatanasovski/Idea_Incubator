"""
Database Models

Dataclasses representing database rows for the coordination system.
Provides type safety and convenience methods for serialization.

Usage:
    from database.models import Loop, Test, Event

    loop = Loop(id="loop-1", name="Critical Path", priority=1)
    row_dict = loop.to_dict()
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List
from enum import Enum
import json


class LoopStatus(str, Enum):
    """Valid statuses for a loop."""
    RUNNING = "running"
    STOPPED = "stopped"
    PAUSED = "paused"
    ERROR = "error"


class TestStatus(str, Enum):
    """Valid statuses for a test."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"


class DecisionStatus(str, Enum):
    """Valid statuses for a decision."""
    PENDING = "pending"
    DECIDED = "decided"
    AUTO_RESOLVED = "auto_resolved"
    EXPIRED = "expired"


class ChangeRequestStatus(str, Enum):
    """Valid statuses for a change request."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    APPLIED = "applied"


class MigrationStatus(str, Enum):
    """Valid statuses for a migration."""
    PENDING = "pending"
    APPLIED = "applied"
    FAILED = "failed"


class ComponentStatus(str, Enum):
    """Valid statuses for a component."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DEAD = "dead"
    UNKNOWN = "unknown"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class KnowledgeType(str, Enum):
    """Types of knowledge items."""
    FACT = "fact"
    DECISION = "decision"
    PATTERN = "pattern"
    WARNING = "warning"


class ResourceType(str, Enum):
    """Types of resources in the registry."""
    FILE = "file"
    TYPE = "type"
    INTERFACE = "interface"
    ENDPOINT = "endpoint"
    MIGRATION = "migration"


@dataclass
class Loop:
    """Represents a coding loop in the system."""
    id: str
    name: str
    priority: int = 5
    branch: Optional[str] = None
    status: str = LoopStatus.STOPPED.value
    current_test_id: Optional[str] = None
    pid: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Loop":
        """Create from database row."""
        return cls(**{k: v for k, v in row.items() if k in cls.__dataclass_fields__})


@dataclass
class Test:
    """Represents a test in the system."""
    id: str
    loop_id: str
    category: str
    status: str = TestStatus.PENDING.value
    attempts: int = 0
    max_attempts: int = 3
    last_result: Optional[str] = None
    depends_on: Optional[str] = None
    automatable: bool = True
    notes: Optional[str] = None
    spec_content: Optional[str] = None
    last_attempt_at: Optional[str] = None
    passed_at: Optional[str] = None
    verified_at: Optional[str] = None
    created_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        d = asdict(self)
        d["automatable"] = 1 if self.automatable else 0
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Test":
        """Create from database row."""
        row_copy = dict(row)
        if "automatable" in row_copy:
            row_copy["automatable"] = bool(row_copy["automatable"])
        return cls(**{k: v for k, v in row_copy.items() if k in cls.__dataclass_fields__})


@dataclass
class Event:
    """Represents an event in the message bus."""
    id: str
    timestamp: str
    source: str
    event_type: str
    payload: dict = field(default_factory=dict)
    correlation_id: Optional[str] = None
    priority: int = 5
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        d = asdict(self)
        d["payload"] = json.dumps(self.payload)
        d["acknowledged"] = 1 if self.acknowledged else 0
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Event":
        """Create from database row."""
        row_copy = dict(row)
        if "payload" in row_copy and isinstance(row_copy["payload"], str):
            row_copy["payload"] = json.loads(row_copy["payload"])
        if "acknowledged" in row_copy:
            row_copy["acknowledged"] = bool(row_copy["acknowledged"])
        return cls(**{k: v for k, v in row_copy.items() if k in cls.__dataclass_fields__})


@dataclass
class Subscription:
    """Represents an event subscription."""
    id: str
    subscriber: str
    event_types: List[str] = field(default_factory=list)
    filter_sources: Optional[List[str]] = None
    last_poll_at: Optional[str] = None
    active: bool = True

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        d = {
            "id": self.id,
            "subscriber": self.subscriber,
            "event_types": json.dumps(self.event_types),
            "filter_sources": json.dumps(self.filter_sources) if self.filter_sources else None,
            "active": 1 if self.active else 0
        }
        if self.last_poll_at:
            d["last_poll_at"] = self.last_poll_at
        return d

    @classmethod
    def from_row(cls, row: dict) -> "Subscription":
        """Create from database row."""
        row_copy = dict(row)
        if "event_types" in row_copy and isinstance(row_copy["event_types"], str):
            row_copy["event_types"] = json.loads(row_copy["event_types"])
        if "filter_sources" in row_copy and row_copy["filter_sources"]:
            row_copy["filter_sources"] = json.loads(row_copy["filter_sources"])
        if "active" in row_copy:
            row_copy["active"] = bool(row_copy["active"])
        return cls(**{k: v for k, v in row_copy.items() if k in cls.__dataclass_fields__})


@dataclass
class FileLock:
    """Represents a file lock."""
    file_path: str
    locked_by: str
    locked_at: str
    lock_reason: Optional[str] = None
    expires_at: Optional[str] = None
    test_id: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "FileLock":
        """Create from database row."""
        return cls(**{k: v for k, v in row.items() if k in cls.__dataclass_fields__})

    def is_expired(self) -> bool:
        """Check if lock has expired."""
        if not self.expires_at:
            return False
        return datetime.fromisoformat(self.expires_at) < datetime.utcnow()


@dataclass
class Knowledge:
    """Represents a knowledge item."""
    id: str
    loop_id: str
    item_type: str
    content: str
    topic: Optional[str] = None
    confidence: float = 1.0
    evidence: Optional[str] = None
    affected_areas: Optional[List[str]] = None
    superseded_by: Optional[str] = None
    created_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        d = asdict(self)
        if self.affected_areas:
            d["affected_areas"] = json.dumps(self.affected_areas)
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Knowledge":
        """Create from database row."""
        row_copy = dict(row)
        if "affected_areas" in row_copy and row_copy["affected_areas"]:
            row_copy["affected_areas"] = json.loads(row_copy["affected_areas"])
        return cls(**{k: v for k, v in row_copy.items() if k in cls.__dataclass_fields__})


@dataclass
class Resource:
    """Represents a registered resource with ownership."""
    path: str
    owner_loop: str
    resource_type: str
    description: Optional[str] = None
    created_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Resource":
        """Create from database row."""
        return cls(**{k: v for k, v in row.items() if k in cls.__dataclass_fields__})


@dataclass
class ChangeRequest:
    """Represents a request to modify a resource by non-owner."""
    id: str
    resource_path: str
    requestor_loop: str
    owner_loop: str
    request_type: str
    description: str
    status: str = ChangeRequestStatus.PENDING.value
    requested_at: Optional[str] = None
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "ChangeRequest":
        """Create from database row."""
        return cls(**{k: v for k, v in row.items() if k in cls.__dataclass_fields__})


@dataclass
class Checkpoint:
    """Represents a git checkpoint for rollback."""
    id: str
    loop_id: str
    test_id: str
    git_ref: str
    checkpoint_type: str
    created_at: Optional[str] = None
    deleted_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Checkpoint":
        """Create from database row."""
        return cls(**{k: v for k, v in row.items() if k in cls.__dataclass_fields__})


@dataclass
class Decision:
    """Represents a decision request for human review."""
    id: str
    decision_type: str
    summary: str
    options: List[str] = field(default_factory=list)
    default_option: Optional[str] = None
    context: Optional[dict] = None
    timeout_minutes: int = 60
    status: str = DecisionStatus.PENDING.value
    requested_at: Optional[str] = None
    requested_by: Optional[str] = None
    decided_at: Optional[str] = None
    decided_by: Optional[str] = None
    choice: Optional[str] = None
    comment: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        d = asdict(self)
        d["options"] = json.dumps(self.options)
        if self.context:
            d["context"] = json.dumps(self.context)
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Decision":
        """Create from database row."""
        row_copy = dict(row)
        if "options" in row_copy and isinstance(row_copy["options"], str):
            row_copy["options"] = json.loads(row_copy["options"])
        if "context" in row_copy and row_copy["context"]:
            row_copy["context"] = json.loads(row_copy["context"])
        return cls(**{k: v for k, v in row_copy.items() if k in cls.__dataclass_fields__})


@dataclass
class Usage:
    """Represents usage tracking for a test attempt."""
    id: str
    loop_id: str
    test_id: Optional[str] = None
    tokens_estimated: Optional[int] = None
    duration_seconds: Optional[int] = None
    files_modified: Optional[List[str]] = None
    recorded_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        d = asdict(self)
        if self.files_modified:
            d["files_modified"] = json.dumps(self.files_modified)
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Usage":
        """Create from database row."""
        row_copy = dict(row)
        if "files_modified" in row_copy and row_copy["files_modified"]:
            row_copy["files_modified"] = json.loads(row_copy["files_modified"])
        return cls(**{k: v for k, v in row_copy.items() if k in cls.__dataclass_fields__})


@dataclass
class ComponentHealth:
    """Represents health status of a component."""
    component: str
    last_heartbeat: str
    status: str = ComponentStatus.UNKNOWN.value
    metadata: Optional[dict] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        d = asdict(self)
        if self.metadata:
            d["metadata"] = json.dumps(self.metadata)
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "ComponentHealth":
        """Create from database row."""
        row_copy = dict(row)
        if "metadata" in row_copy and row_copy["metadata"]:
            row_copy["metadata"] = json.loads(row_copy["metadata"])
        return cls(**{k: v for k, v in row_copy.items() if k in cls.__dataclass_fields__})


@dataclass
class Alert:
    """Represents an alert for human attention."""
    id: str
    severity: str
    alert_type: str
    source: str
    message: str
    context: Optional[dict] = None
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[str] = None
    created_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        d = asdict(self)
        if self.context:
            d["context"] = json.dumps(self.context)
        d["acknowledged"] = 1 if self.acknowledged else 0
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Alert":
        """Create from database row."""
        row_copy = dict(row)
        if "context" in row_copy and row_copy["context"]:
            row_copy["context"] = json.loads(row_copy["context"])
        if "acknowledged" in row_copy:
            row_copy["acknowledged"] = bool(row_copy["acknowledged"])
        return cls(**{k: v for k, v in row_copy.items() if k in cls.__dataclass_fields__})


@dataclass
class Migration:
    """Represents a database migration."""
    number: int
    name: str
    loop_id: str
    file_path: str
    status: str = MigrationStatus.PENDING.value
    allocated_at: Optional[str] = None
    applied_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for database insertion."""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_row(cls, row: dict) -> "Migration":
        """Create from database row."""
        return cls(**{k: v for k, v in row.items() if k in cls.__dataclass_fields__})
