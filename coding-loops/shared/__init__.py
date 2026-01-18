"""
Shared Infrastructure for Multi-Agent Coordination System

This module contains all shared components used by loops and agents.

Components (implemented):
- RalphLoopRunner: Base class for execution loops
- HealthCheck: Health heartbeat management
- load_config, validate_json: Configuration utilities
- MessageBus: Event bus for inter-agent communication
- ObservabilitySkills: 39 SQL tools for validation, troubleshooting, investigation, aggregation

Archive Modules (Phase 10):
- ArchiveConfig: Retention policies and configuration
- ArchiveWriter/ArchiveReader: JSONL archive file writer/reader
- DatabaseArchiver: SQLite to archive migration
- ArchiveCleanup: Warm -> cold consolidation and purging

Components (TODO - see TASKS.md):
- VerificationGate: Independent verification of agent claims
- GitManager: Branch-per-loop strategy
- CheckpointManager: Git-based checkpoints and rollback
- ResourceRegistry: Shared resource ownership
- MigrationAllocator: Database migration ordering
- BudgetManager: Usage tracking and reporting
- KnowledgeBase: Cross-agent context sharing
- ErrorClassifier: Error categorization
- DeadlockDetector: Deadlock detection and resolution
- SemanticAnalyzer: Semantic conflict detection
- RegressionMonitor: Regression detection
- DegradationManager: Graceful degradation
- OrphanCleaner: Orphan resource cleanup
- ContextManager: Context window management
- TelegramNotifier: Telegram notifications
"""

# Existing components
from .ralph_loop_base import (
    RalphLoopRunner,
    load_config,
    validate_json,
    load_schema,
    HealthCheck,
    DEFAULT_CONFIG,
)

# New components - uncomment as implemented
from .message_bus import MessageBus, get_message_bus

# Archive modules (Phase 10)
from .archive_config import (
    ArchiveConfig,
    RetentionPolicy,
    RETENTION_POLICIES,
    get_policy,
    is_exempt,
)
from .archive_writer import (
    ArchiveWriter,
    ArchiveReader,
    list_archives,
    get_archive_stats,
    get_cold_storage_stats,
)
from .database_archiver import DatabaseArchiver
from .archive_cleanup import ArchiveCleanup
from .observability_skills import (
    ObservabilitySkills,
    ValidationIssue,
    ErrorRecord,
    StuckOperation,
    ParallelHealthReport,
    AnomalyReport,
    obs_validate,
    obs_errors,
    obs_parallel_health,
    obs_anomalies,
    obs_summary,
)
from .observability_api import (
    create_execution_run,
    complete_execution_run,
    record_heartbeat,
    log_tool_start,
    log_tool_end,
    log_tool_simple,
    start_assertion_chain,
    record_assertion,
    end_assertion_chain,
    log_phase_start,
    log_phase_end,
    is_observable_available,
    check_observable,
    OBSERVABLE_AVAILABLE,
)
# from .verification_gate import VerificationGate, VerificationResult
# from .git_manager import GitManager, RebaseResult
# from .checkpoint_manager import CheckpointManager
# from .resource_registry import ResourceRegistry
# from .migration_allocator import MigrationAllocator
# from .budget_manager import BudgetManager
# from .knowledge_base import KnowledgeBase, KnowledgeItem
# from .error_classifier import ErrorClassifier, ErrorCategory, ErrorHandling
# from .deadlock_detector import DeadlockDetector
# from .semantic_analyzer import SemanticAnalyzer, SemanticReport
# from .regression_monitor import RegressionMonitor, Regression, BlameResult
# from .degradation_manager import DegradationManager, DegradedMode
# from .orphan_cleaner import OrphanCleaner, CleanupResult
# from .context_manager import ContextManager
# from .telegram_notifier import TelegramNotifier

__all__ = [
    # Existing
    "RalphLoopRunner",
    "load_config",
    "validate_json",
    "load_schema",
    "HealthCheck",
    "DEFAULT_CONFIG",
    # New - uncomment as implemented
    "MessageBus",
    "get_message_bus",
    # Archive modules (Phase 10)
    "ArchiveConfig",
    "RetentionPolicy",
    "RETENTION_POLICIES",
    "get_policy",
    "is_exempt",
    "ArchiveWriter",
    "ArchiveReader",
    "list_archives",
    "get_archive_stats",
    "get_cold_storage_stats",
    "DatabaseArchiver",
    "ArchiveCleanup",
    # Observability Skills
    "ObservabilitySkills",
    "ValidationIssue",
    "ErrorRecord",
    "StuckOperation",
    "ParallelHealthReport",
    "AnomalyReport",
    "obs_validate",
    "obs_errors",
    "obs_parallel_health",
    "obs_anomalies",
    "obs_summary",
    # Observability API client
    "create_execution_run",
    "complete_execution_run",
    "record_heartbeat",
    "log_tool_start",
    "log_tool_end",
    "log_tool_simple",
    "start_assertion_chain",
    "record_assertion",
    "end_assertion_chain",
    "log_phase_start",
    "log_phase_end",
    "is_observable_available",
    "check_observable",
    "OBSERVABLE_AVAILABLE",
    # "VerificationGate",
    # "VerificationResult",
    # "GitManager",
    # "RebaseResult",
    # "CheckpointManager",
    # "ResourceRegistry",
    # "MigrationAllocator",
    # "BudgetManager",
    # "KnowledgeBase",
    # "KnowledgeItem",
    # "ErrorClassifier",
    # "ErrorCategory",
    # "ErrorHandling",
    # "DeadlockDetector",
    # "SemanticAnalyzer",
    # "SemanticReport",
    # "RegressionMonitor",
    # "Regression",
    # "BlameResult",
    # "DegradationManager",
    # "DegradedMode",
    # "OrphanCleaner",
    # "CleanupResult",
    # "ContextManager",
    # "TelegramNotifier",
]
