-- =============================================================================
-- Migration: 090_observability_phases_3_4_5_tasks.sql
-- Purpose: Insert Observability Phases 3, 4, 5 tasks with file impacts and dependencies
-- Created: 2026-01-17
-- =============================================================================

-- =============================================================================
-- TASK LISTS
-- =============================================================================

INSERT OR IGNORE INTO task_lists_v2 (id, name, description, status, max_parallel_agents, total_tasks)
VALUES
    ('obs-phase-3', 'Observability Phase 3: Agent Integration', 'P0 - Integrate observability into all 6 agent types', 'ready', 6, 11),
    ('obs-phase-4', 'Observability Phase 4: TypeScript Types', 'P1 - Create all TypeScript type definitions for observability', 'ready', 4, 13),
    ('obs-phase-5', 'Observability Phase 5: API Routes', 'P1 - Implement REST API endpoints for observability data', 'ready', 6, 10);

-- =============================================================================
-- PHASE 3 TASKS: Agent Integration (11 tasks)
-- =============================================================================

-- Wave 1: Base Infrastructure
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-100', 'TU-OBS-INF-100', 'Create Observable Agent Base Class (Python)',
     'Extend from object, initialize TranscriptWriter, ToolUseLogger, SkillTracer, AssertionRecorder. Provide lifecycle methods: log_phase_start, log_phase_end, log_task_start, log_task_end. Provide tool logging: log_tool_start, log_tool_end, log_tool_blocked. Provide assertion methods and error logging.',
     'infrastructure', 'P0', 'medium', 'obs-phase-3', 1, 'pending', 1, 'build_agent'),

    ('obs-110', 'TU-OBS-INF-110', 'Create TypeScript Observability Services',
     'Create TranscriptWriter, ToolUseLogger, AssertionRecorder classes that write to SQLite and JSONL. Use better-sqlite3 for database access. Export all classes from index.ts.',
     'infrastructure', 'P0', 'medium', 'obs-phase-3', 2, 'pending', 1, 'build_agent');

-- Wave 2: TypeScript Base Class
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-101', 'TU-OBS-INF-101', 'Create Observable Agent Base Class (TypeScript)',
     'Abstract class that mirrors Python ObservableAgent functionality. All lifecycle methods protected for subclass use. Async close() method for proper cleanup. Import services from server/services/observability/.',
     'infrastructure', 'P0', 'medium', 'obs-phase-3', 3, 'pending', 2, 'build_agent');

-- Wave 3: Agent Integrations (parallel)
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-102', 'TU-OBS-API-102', 'Integrate Build Agent Worker - Base',
     'Build Agent extends ObservableAgent. Initialize with execution_id and wave_id. Call log_task_start/end, log_lock_acquire/release, log_checkpoint, log_error. Call close() in finally block.',
     'api', 'P0', 'medium', 'obs-phase-3', 4, 'pending', 3, 'build_agent'),

    ('obs-105', 'TU-OBS-API-105', 'Integrate Specification Agent',
     'Spec Agent extends ObservableAgent. Log all 4 phases: analyze, question, generate, decompose. Use assertion chains to validate spec.md and tasks.md creation. Log errors with phase context.',
     'api', 'P0', 'small', 'obs-phase-3', 5, 'pending', 3, 'build_agent'),

    ('obs-106', 'TU-OBS-API-106', 'Integrate Validation Agent',
     'Validation Agent extends ObservableAgent. Each validation check creates an assertion entry. Evidence includes command output and exit codes. Chain aggregates all validation results.',
     'api', 'P0', 'small', 'obs-phase-3', 6, 'pending', 3, 'build_agent'),

    ('obs-107', 'TU-OBS-API-107', 'Integrate UX Agent',
     'UX Agent extends ObservableAgent. Log user journeys as phases. Log each Puppeteer interaction as tool_use. Record accessibility checks as assertions.',
     'api', 'P0', 'small', 'obs-phase-3', 7, 'pending', 3, 'build_agent'),

    ('obs-108', 'TU-OBS-API-108', 'Integrate Self-Improvement Agent (SIA)',
     'SIA extends ObservableAgent. Log every discovered pattern/gotcha/decision as discovery entry. Include confidence scores. Log KB updates and analysis failures.',
     'api', 'P0', 'small', 'obs-phase-3', 8, 'pending', 3, 'build_agent'),

    ('obs-109', 'TU-OBS-API-109', 'Integrate Monitoring Agent',
     'Monitoring Agent extends ObservableAgent. Log health checks as validation entries. Log anomalies as discovery entries. Log alerts as error with severity levels.',
     'api', 'P0', 'small', 'obs-phase-3', 9, 'pending', 3, 'build_agent');

-- Wave 4: Build Agent Extended
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-103', 'TU-OBS-API-103', 'Integrate Build Agent Message Loop',
     'Wrap Claude SDK message loop to capture all tool uses. Call log_tool_start BEFORE tool execution. Call log_tool_end AFTER. Call log_tool_blocked for security-blocked commands.',
     'api', 'P0', 'medium', 'obs-phase-3', 10, 'pending', 4, 'build_agent'),

    ('obs-104', 'TU-OBS-API-104', 'Integrate Build Agent Validation Phase',
     'Use AssertionRecorder for PIV Validate phase. Create assertion chains for each task validation. File assertions match task action type. TypeScript compilation checked for .ts/.tsx files.',
     'api', 'P0', 'medium', 'obs-phase-3', 11, 'pending', 4, 'build_agent');

-- =============================================================================
-- PHASE 4 TASKS: TypeScript Types (13 tasks)
-- =============================================================================

-- Wave 1: Foundational
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-200', 'TU-OBS-TYP-200', 'Create Core Transcript Types',
     'Define TranscriptEntryType enum with all 15 entry types. Define EntryCategory enum. Define TranscriptEntry interface. Define PaginatedResponse<T> generic.',
     'types', 'P1', 'small', 'obs-phase-4', 1, 'pending', 1, 'build_agent');

-- Wave 2: Core Entity Types
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-201', 'TU-OBS-TYP-201', 'Create Tool Use Types',
     'Define ToolCategory enum: file_read, file_write, file_edit, shell, search, web, mcp, agent. Define ToolResultStatus. Define ToolUse interface with all database fields.',
     'types', 'P1', 'small', 'obs-phase-4', 2, 'pending', 2, 'build_agent'),

    ('obs-204', 'TU-OBS-TYP-204', 'Create Assertion Types',
     'Define AssertionCategory enum with all 9 categories. Define AssertionResult interface with evidence. Define AssertionChain interface. Define AssertionEvidence interface.',
     'types', 'P1', 'small', 'obs-phase-4', 3, 'pending', 2, 'build_agent'),

    ('obs-205', 'TU-OBS-TYP-205', 'Create Message Bus Types',
     'Define MessageBusSeverity and MessageBusCategory enums. Define MessageBusLogEntry interface. Define MessageBusQuery interface. Include correlationId for related events.',
     'types', 'P1', 'small', 'obs-phase-4', 4, 'pending', 2, 'build_agent');

-- Wave 3: Derived Types
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-202', 'TU-OBS-TYP-202', 'Create Tool Input/Output Types',
     'Define specific input types: ReadInput, WriteInput, EditInput, BashInput. Define ToolInputUnion and ToolOutputUnion discriminated unions.',
     'types', 'P1', 'small', 'obs-phase-4', 5, 'pending', 3, 'build_agent'),

    ('obs-203', 'TU-OBS-TYP-203', 'Create Skill Trace Types',
     'Define SkillReference interface. Define SkillTrace interface with nested toolCalls and subSkills. Define SkillStatus enum and SkillsUsageSummary interface.',
     'types', 'P1', 'small', 'obs-phase-4', 6, 'pending', 3, 'build_agent'),

    ('obs-206', 'TU-OBS-TYP-206', 'Create WebSocket Event Types',
     'Define ObservabilityEventType enum. Define base ObservabilityEvent interface. Define specific event interfaces for transcript, tool use, assertion events.',
     'types', 'P1', 'small', 'obs-phase-4', 7, 'pending', 3, 'build_agent'),

    ('obs-211', 'TU-OBS-TYP-211', 'Create Security Types',
     'Define BlockedCommand interface with reason and suggestion. Define SecurityValidation interface. Define DangerousPattern enum.',
     'types', 'P1', 'small', 'obs-phase-4', 8, 'pending', 3, 'build_agent');

-- Wave 4: API Types
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-207', 'TU-OBS-TYP-207', 'Create API Request/Response Types',
     'Define ExecutionResponse with stats. Define TranscriptQuery, ToolUseQuery, AssertionQuery interfaces. Define ToolUsageSummaryResponse. Define ErrorResponse.',
     'types', 'P1', 'small', 'obs-phase-4', 9, 'pending', 4, 'build_agent'),

    ('obs-208', 'TU-OBS-TYP-208', 'Create Cross-Reference Types',
     'Define CrossRefEntityType enum. Define ToolUseCrossRefs, AssertionCrossRefs, SkillTraceCrossRefs interfaces. Define EntityCrossRefs discriminated union.',
     'types', 'P1', 'small', 'obs-phase-4', 10, 'pending', 4, 'build_agent');

-- Wave 5-7: UI Types
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-209', 'TU-OBS-TYP-209', 'Create UI Component Prop Types',
     'Define ExecutionListProps, TranscriptViewerProps, ToolUseCardProps, AssertionCardProps, SkillTraceCardProps, MessageBusLogProps, FilterPanelProps.',
     'types', 'P1', 'medium', 'obs-phase-4', 11, 'pending', 5, 'build_agent'),

    ('obs-210', 'TU-OBS-TYP-210', 'Create React Hook Types',
     'Define UseExecutionListResult, UseExecutionResult, UseTranscriptResult, UseToolUsesResult, UseAssertionsResult, UseObservabilityStreamResult, UseFiltersResult.',
     'types', 'P1', 'small', 'obs-phase-4', 12, 'pending', 6, 'build_agent'),

    ('obs-212', 'TU-OBS-TYP-212', 'Create Index Export File',
     'Export all types from all observability type files. Use export * from syntax. Order alphabetically.',
     'types', 'P1', 'small', 'obs-phase-4', 13, 'pending', 7, 'build_agent');

-- =============================================================================
-- PHASE 5 TASKS: API Routes (10 tasks)
-- =============================================================================

-- Wave 1: Independent Services (parallel)
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-300', 'TU-OBS-API-300', 'Create Execution Service',
     'listExecutions() returns paginated list with stats. getExecution() returns single execution. Stats include totalToolUses, totalAssertions, passRate, errorCount, durationMs.',
     'api', 'P1', 'medium', 'obs-phase-5', 1, 'pending', 1, 'build_agent'),

    ('obs-301', 'TU-OBS-API-301', 'Create Transcript Service',
     'getTranscript() returns paginated entries with filtering by entryTypes, categories, taskId, since, until. getEntry() returns single entry. Cursor-based pagination.',
     'api', 'P1', 'medium', 'obs-phase-5', 2, 'pending', 1, 'build_agent'),

    ('obs-302', 'TU-OBS-API-302', 'Create Tool Use Service',
     'getToolUses() returns paginated tool uses. getToolSummary() returns aggregated stats by tool and category. Filter by tools, categories, status, taskId.',
     'api', 'P1', 'medium', 'obs-phase-5', 3, 'pending', 1, 'build_agent'),

    ('obs-303', 'TU-OBS-API-303', 'Create Assertion Service',
     'getAssertions() returns paginated assertions. getAssertionSummary() returns aggregated stats. getChains() returns assertion chains. Filter by categories, result, taskId.',
     'api', 'P1', 'medium', 'obs-phase-5', 4, 'pending', 1, 'build_agent'),

    ('obs-304', 'TU-OBS-API-304', 'Create Skill Service',
     'getSkillTraces() returns paginated skill traces. getSkillTrace() returns single trace with nested tool calls. getSkillsSummary() returns aggregated stats.',
     'api', 'P1', 'medium', 'obs-phase-5', 5, 'pending', 1, 'build_agent'),

    ('obs-306', 'TU-OBS-API-306', 'Create Message Bus Service',
     'getLogs() returns paginated message bus entries. getCorrelatedEvents() returns all events with same correlationId. Filter by eventTypes, sources, severity.',
     'api', 'P1', 'medium', 'obs-phase-5', 6, 'pending', 1, 'build_agent');

-- Wave 2: Cross-Reference Service
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-305', 'TU-OBS-API-305', 'Create Cross-Reference Service',
     'getCrossReferences() returns cross-refs for toolUse, assertion, skillTrace, transcriptEntry. getRelatedEntities() returns fully loaded related entities.',
     'api', 'P1', 'medium', 'obs-phase-5', 7, 'pending', 2, 'build_agent');

-- Wave 3-5: Index, Routes, Registration
INSERT OR IGNORE INTO tasks (id, display_id, title, description, category, priority, effort, task_list_id, position, status, phase, owner)
VALUES
    ('obs-307', 'TU-OBS-API-307', 'Create Service Index',
     'Export all observability services from index.ts. Use named exports. Check if index.ts exists first.',
     'api', 'P1', 'small', 'obs-phase-5', 8, 'pending', 3, 'build_agent'),

    ('obs-308', 'TU-OBS-API-308', 'Create Observability Routes',
     'Implement all REST endpoints: GET /executions, /executions/:id, /executions/:id/transcript, /tool-uses, /tool-summary, /assertions, /assertion-summary, /skills, /cross-refs/:entityType/:entityId, /logs/message-bus.',
     'api', 'P1', 'large', 'obs-phase-5', 9, 'pending', 4, 'build_agent'),

    ('obs-309', 'TU-OBS-API-309', 'Register Routes in API',
     'Import observabilityRoutes. Mount at /api/observability for main routes. Mount at /api for logs/message-bus route.',
     'api', 'P1', 'small', 'obs-phase-5', 10, 'pending', 5, 'build_agent');

-- =============================================================================
-- FILE IMPACTS - Phase 3
-- =============================================================================

INSERT OR IGNORE INTO task_file_impacts (id, task_id, file_path, operation, confidence, source)
VALUES
    -- OBS-100
    ('fi-100-1', 'obs-100', 'coding-loops/shared/observable_agent.py', 'CREATE', 1.0, 'user_declared'),
    ('fi-100-2', 'obs-100', 'coding-loops/shared/transcript_writer.py', 'READ', 1.0, 'user_declared'),
    ('fi-100-3', 'obs-100', 'coding-loops/shared/tool_use_logger.py', 'READ', 1.0, 'user_declared'),
    ('fi-100-4', 'obs-100', 'coding-loops/shared/skill_tracer.py', 'READ', 1.0, 'user_declared'),
    ('fi-100-5', 'obs-100', 'coding-loops/shared/assertion_recorder.py', 'READ', 1.0, 'user_declared'),

    -- OBS-110
    ('fi-110-1', 'obs-110', 'server/services/observability/transcript-writer.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-110-2', 'obs-110', 'server/services/observability/tool-use-logger.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-110-3', 'obs-110', 'server/services/observability/assertion-recorder.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-110-4', 'obs-110', 'server/services/observability/index.ts', 'UPDATE', 1.0, 'user_declared'),

    -- OBS-101
    ('fi-101-1', 'obs-101', 'server/agents/observable-agent.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-101-2', 'obs-101', 'server/services/observability/transcript-writer.ts', 'READ', 1.0, 'user_declared'),
    ('fi-101-3', 'obs-101', 'server/services/observability/tool-use-logger.ts', 'READ', 1.0, 'user_declared'),
    ('fi-101-4', 'obs-101', 'server/services/observability/assertion-recorder.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-102
    ('fi-102-1', 'obs-102', 'coding-loops/agents/build_agent_worker.py', 'UPDATE', 1.0, 'user_declared'),
    ('fi-102-2', 'obs-102', 'coding-loops/shared/observable_agent.py', 'READ', 1.0, 'user_declared'),

    -- OBS-103
    ('fi-103-1', 'obs-103', 'coding-loops/agents/build_agent_worker.py', 'UPDATE', 1.0, 'user_declared'),

    -- OBS-104
    ('fi-104-1', 'obs-104', 'coding-loops/agents/build_agent_worker.py', 'UPDATE', 1.0, 'user_declared'),

    -- OBS-105
    ('fi-105-1', 'obs-105', 'agents/specification/core.ts', 'UPDATE', 1.0, 'user_declared'),
    ('fi-105-2', 'obs-105', 'server/agents/observable-agent.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-106
    ('fi-106-1', 'obs-106', 'agents/validation/orchestrator.ts', 'UPDATE', 1.0, 'user_declared'),
    ('fi-106-2', 'obs-106', 'server/agents/observable-agent.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-107
    ('fi-107-1', 'obs-107', 'agents/ux/orchestrator.ts', 'UPDATE', 1.0, 'user_declared'),
    ('fi-107-2', 'obs-107', 'server/agents/observable-agent.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-108
    ('fi-108-1', 'obs-108', 'agents/sia/index.ts', 'UPDATE', 1.0, 'user_declared'),
    ('fi-108-2', 'obs-108', 'server/agents/observable-agent.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-109
    ('fi-109-1', 'obs-109', 'server/monitoring/monitoring-agent.ts', 'UPDATE', 1.0, 'user_declared'),
    ('fi-109-2', 'obs-109', 'server/agents/observable-agent.ts', 'READ', 1.0, 'user_declared');

-- =============================================================================
-- FILE IMPACTS - Phase 4
-- =============================================================================

INSERT OR IGNORE INTO task_file_impacts (id, task_id, file_path, operation, confidence, source)
VALUES
    -- OBS-200
    ('fi-200-1', 'obs-200', 'frontend/src/types/observability/transcript.ts', 'CREATE', 1.0, 'user_declared'),

    -- OBS-201
    ('fi-201-1', 'obs-201', 'frontend/src/types/observability/tool-use.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-201-2', 'obs-201', 'frontend/src/types/observability/transcript.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-202
    ('fi-202-1', 'obs-202', 'frontend/src/types/observability/tool-io.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-202-2', 'obs-202', 'frontend/src/types/observability/tool-use.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-203
    ('fi-203-1', 'obs-203', 'frontend/src/types/observability/skill.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-203-2', 'obs-203', 'frontend/src/types/observability/tool-use.ts', 'READ', 1.0, 'user_declared'),
    ('fi-203-3', 'obs-203', 'frontend/src/types/observability/transcript.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-204
    ('fi-204-1', 'obs-204', 'frontend/src/types/observability/assertion.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-204-2', 'obs-204', 'frontend/src/types/observability/transcript.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-205
    ('fi-205-1', 'obs-205', 'frontend/src/types/observability/message-bus.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-205-2', 'obs-205', 'frontend/src/types/observability/transcript.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-206
    ('fi-206-1', 'obs-206', 'frontend/src/types/observability/websocket.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-206-2', 'obs-206', 'frontend/src/types/observability/transcript.ts', 'READ', 1.0, 'user_declared'),
    ('fi-206-3', 'obs-206', 'frontend/src/types/observability/tool-use.ts', 'READ', 1.0, 'user_declared'),
    ('fi-206-4', 'obs-206', 'frontend/src/types/observability/assertion.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-207
    ('fi-207-1', 'obs-207', 'frontend/src/types/observability/api.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-207-2', 'obs-207', 'frontend/src/types/observability/transcript.ts', 'READ', 1.0, 'user_declared'),
    ('fi-207-3', 'obs-207', 'frontend/src/types/observability/tool-use.ts', 'READ', 1.0, 'user_declared'),
    ('fi-207-4', 'obs-207', 'frontend/src/types/observability/assertion.ts', 'READ', 1.0, 'user_declared'),
    ('fi-207-5', 'obs-207', 'frontend/src/types/observability/skill.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-208
    ('fi-208-1', 'obs-208', 'frontend/src/types/observability/cross-refs.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-208-2', 'obs-208', 'frontend/src/types/observability/tool-use.ts', 'READ', 1.0, 'user_declared'),
    ('fi-208-3', 'obs-208', 'frontend/src/types/observability/assertion.ts', 'READ', 1.0, 'user_declared'),
    ('fi-208-4', 'obs-208', 'frontend/src/types/observability/skill.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-209
    ('fi-209-1', 'obs-209', 'frontend/src/types/observability/ui-props.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-209-2', 'obs-209', 'frontend/src/types/observability/transcript.ts', 'READ', 1.0, 'user_declared'),
    ('fi-209-3', 'obs-209', 'frontend/src/types/observability/tool-use.ts', 'READ', 1.0, 'user_declared'),
    ('fi-209-4', 'obs-209', 'frontend/src/types/observability/assertion.ts', 'READ', 1.0, 'user_declared'),
    ('fi-209-5', 'obs-209', 'frontend/src/types/observability/skill.ts', 'READ', 1.0, 'user_declared'),
    ('fi-209-6', 'obs-209', 'frontend/src/types/observability/message-bus.ts', 'READ', 1.0, 'user_declared'),
    ('fi-209-7', 'obs-209', 'frontend/src/types/observability/api.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-210
    ('fi-210-1', 'obs-210', 'frontend/src/types/observability/hooks.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-210-2', 'obs-210', 'frontend/src/types/observability/ui-props.ts', 'READ', 1.0, 'user_declared'),
    ('fi-210-3', 'obs-210', 'frontend/src/types/observability/api.ts', 'READ', 1.0, 'user_declared'),
    ('fi-210-4', 'obs-210', 'frontend/src/types/observability/websocket.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-211
    ('fi-211-1', 'obs-211', 'frontend/src/types/observability/security.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-211-2', 'obs-211', 'frontend/src/types/observability/tool-use.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-212
    ('fi-212-1', 'obs-212', 'frontend/src/types/observability/index.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-212-2', 'obs-212', 'frontend/src/types/observability/transcript.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-3', 'obs-212', 'frontend/src/types/observability/tool-use.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-4', 'obs-212', 'frontend/src/types/observability/tool-io.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-5', 'obs-212', 'frontend/src/types/observability/skill.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-6', 'obs-212', 'frontend/src/types/observability/assertion.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-7', 'obs-212', 'frontend/src/types/observability/message-bus.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-8', 'obs-212', 'frontend/src/types/observability/websocket.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-9', 'obs-212', 'frontend/src/types/observability/api.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-10', 'obs-212', 'frontend/src/types/observability/cross-refs.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-11', 'obs-212', 'frontend/src/types/observability/ui-props.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-12', 'obs-212', 'frontend/src/types/observability/hooks.ts', 'READ', 1.0, 'user_declared'),
    ('fi-212-13', 'obs-212', 'frontend/src/types/observability/security.ts', 'READ', 1.0, 'user_declared');

-- =============================================================================
-- FILE IMPACTS - Phase 5
-- =============================================================================

INSERT OR IGNORE INTO task_file_impacts (id, task_id, file_path, operation, confidence, source)
VALUES
    -- OBS-300
    ('fi-300-1', 'obs-300', 'server/services/observability/execution-service.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-300-2', 'obs-300', 'database/ideas.db', 'READ', 1.0, 'user_declared'),

    -- OBS-301
    ('fi-301-1', 'obs-301', 'server/services/observability/transcript-service.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-301-2', 'obs-301', 'database/ideas.db', 'READ', 1.0, 'user_declared'),

    -- OBS-302
    ('fi-302-1', 'obs-302', 'server/services/observability/tool-use-service.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-302-2', 'obs-302', 'database/ideas.db', 'READ', 1.0, 'user_declared'),

    -- OBS-303
    ('fi-303-1', 'obs-303', 'server/services/observability/assertion-service.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-303-2', 'obs-303', 'database/ideas.db', 'READ', 1.0, 'user_declared'),

    -- OBS-304
    ('fi-304-1', 'obs-304', 'server/services/observability/skill-service.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-304-2', 'obs-304', 'database/ideas.db', 'READ', 1.0, 'user_declared'),

    -- OBS-305
    ('fi-305-1', 'obs-305', 'server/services/observability/cross-reference-service.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-305-2', 'obs-305', 'database/ideas.db', 'READ', 1.0, 'user_declared'),

    -- OBS-306
    ('fi-306-1', 'obs-306', 'server/services/observability/message-bus-service.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-306-2', 'obs-306', 'database/ideas.db', 'READ', 1.0, 'user_declared'),

    -- OBS-307
    ('fi-307-1', 'obs-307', 'server/services/observability/index.ts', 'UPDATE', 1.0, 'user_declared'),
    ('fi-307-2', 'obs-307', 'server/services/observability/execution-service.ts', 'READ', 1.0, 'user_declared'),
    ('fi-307-3', 'obs-307', 'server/services/observability/transcript-service.ts', 'READ', 1.0, 'user_declared'),
    ('fi-307-4', 'obs-307', 'server/services/observability/tool-use-service.ts', 'READ', 1.0, 'user_declared'),
    ('fi-307-5', 'obs-307', 'server/services/observability/assertion-service.ts', 'READ', 1.0, 'user_declared'),
    ('fi-307-6', 'obs-307', 'server/services/observability/skill-service.ts', 'READ', 1.0, 'user_declared'),
    ('fi-307-7', 'obs-307', 'server/services/observability/cross-reference-service.ts', 'READ', 1.0, 'user_declared'),
    ('fi-307-8', 'obs-307', 'server/services/observability/message-bus-service.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-308
    ('fi-308-1', 'obs-308', 'server/routes/observability.ts', 'CREATE', 1.0, 'user_declared'),
    ('fi-308-2', 'obs-308', 'server/services/observability/index.ts', 'READ', 1.0, 'user_declared'),

    -- OBS-309
    ('fi-309-1', 'obs-309', 'server/api.ts', 'UPDATE', 1.0, 'user_declared'),
    ('fi-309-2', 'obs-309', 'server/routes/observability.ts', 'READ', 1.0, 'user_declared');

-- =============================================================================
-- TASK RELATIONSHIPS (Dependencies)
-- =============================================================================

-- Phase 3 Dependencies
INSERT OR IGNORE INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
VALUES
    -- OBS-101 depends on OBS-110
    ('rel-101-110', 'obs-101', 'obs-110', 'depends_on'),

    -- OBS-102 depends on OBS-100
    ('rel-102-100', 'obs-102', 'obs-100', 'depends_on'),

    -- OBS-103 depends on OBS-102
    ('rel-103-102', 'obs-103', 'obs-102', 'depends_on'),

    -- OBS-104 depends on OBS-102
    ('rel-104-102', 'obs-104', 'obs-102', 'depends_on'),

    -- OBS-105 depends on OBS-101
    ('rel-105-101', 'obs-105', 'obs-101', 'depends_on'),

    -- OBS-106 depends on OBS-101
    ('rel-106-101', 'obs-106', 'obs-101', 'depends_on'),

    -- OBS-107 depends on OBS-101
    ('rel-107-101', 'obs-107', 'obs-101', 'depends_on'),

    -- OBS-108 depends on OBS-101
    ('rel-108-101', 'obs-108', 'obs-101', 'depends_on'),

    -- OBS-109 depends on OBS-101
    ('rel-109-101', 'obs-109', 'obs-101', 'depends_on');

-- Phase 4 Dependencies
INSERT OR IGNORE INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
VALUES
    -- Wave 2 depends on Wave 1
    ('rel-201-200', 'obs-201', 'obs-200', 'depends_on'),
    ('rel-204-200', 'obs-204', 'obs-200', 'depends_on'),
    ('rel-205-200', 'obs-205', 'obs-200', 'depends_on'),

    -- Wave 3 depends on Wave 2
    ('rel-202-201', 'obs-202', 'obs-201', 'depends_on'),
    ('rel-203-200', 'obs-203', 'obs-200', 'depends_on'),
    ('rel-203-201', 'obs-203', 'obs-201', 'depends_on'),
    ('rel-206-200', 'obs-206', 'obs-200', 'depends_on'),
    ('rel-206-201', 'obs-206', 'obs-201', 'depends_on'),
    ('rel-206-204', 'obs-206', 'obs-204', 'depends_on'),
    ('rel-211-201', 'obs-211', 'obs-201', 'depends_on'),

    -- Wave 4 depends on Wave 3
    ('rel-207-200', 'obs-207', 'obs-200', 'depends_on'),
    ('rel-207-201', 'obs-207', 'obs-201', 'depends_on'),
    ('rel-207-203', 'obs-207', 'obs-203', 'depends_on'),
    ('rel-207-204', 'obs-207', 'obs-204', 'depends_on'),
    ('rel-208-201', 'obs-208', 'obs-201', 'depends_on'),
    ('rel-208-203', 'obs-208', 'obs-203', 'depends_on'),
    ('rel-208-204', 'obs-208', 'obs-204', 'depends_on'),

    -- Wave 5 depends on Wave 4
    ('rel-209-200', 'obs-209', 'obs-200', 'depends_on'),
    ('rel-209-201', 'obs-209', 'obs-201', 'depends_on'),
    ('rel-209-203', 'obs-209', 'obs-203', 'depends_on'),
    ('rel-209-204', 'obs-209', 'obs-204', 'depends_on'),
    ('rel-209-205', 'obs-209', 'obs-205', 'depends_on'),
    ('rel-209-207', 'obs-209', 'obs-207', 'depends_on'),

    -- Wave 6 depends on Wave 5
    ('rel-210-209', 'obs-210', 'obs-209', 'depends_on'),

    -- Wave 7 depends on all
    ('rel-212-200', 'obs-212', 'obs-200', 'depends_on'),
    ('rel-212-201', 'obs-212', 'obs-201', 'depends_on'),
    ('rel-212-202', 'obs-212', 'obs-202', 'depends_on'),
    ('rel-212-203', 'obs-212', 'obs-203', 'depends_on'),
    ('rel-212-204', 'obs-212', 'obs-204', 'depends_on'),
    ('rel-212-205', 'obs-212', 'obs-205', 'depends_on'),
    ('rel-212-206', 'obs-212', 'obs-206', 'depends_on'),
    ('rel-212-207', 'obs-212', 'obs-207', 'depends_on'),
    ('rel-212-208', 'obs-212', 'obs-208', 'depends_on'),
    ('rel-212-209', 'obs-212', 'obs-209', 'depends_on'),
    ('rel-212-210', 'obs-212', 'obs-210', 'depends_on'),
    ('rel-212-211', 'obs-212', 'obs-211', 'depends_on');

-- Phase 5 Dependencies
INSERT OR IGNORE INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
VALUES
    -- OBS-305 depends on all services
    ('rel-305-300', 'obs-305', 'obs-300', 'depends_on'),
    ('rel-305-301', 'obs-305', 'obs-301', 'depends_on'),
    ('rel-305-302', 'obs-305', 'obs-302', 'depends_on'),
    ('rel-305-303', 'obs-305', 'obs-303', 'depends_on'),
    ('rel-305-304', 'obs-305', 'obs-304', 'depends_on'),

    -- OBS-307 depends on all services
    ('rel-307-300', 'obs-307', 'obs-300', 'depends_on'),
    ('rel-307-301', 'obs-307', 'obs-301', 'depends_on'),
    ('rel-307-302', 'obs-307', 'obs-302', 'depends_on'),
    ('rel-307-303', 'obs-307', 'obs-303', 'depends_on'),
    ('rel-307-304', 'obs-307', 'obs-304', 'depends_on'),
    ('rel-307-305', 'obs-307', 'obs-305', 'depends_on'),
    ('rel-307-306', 'obs-307', 'obs-306', 'depends_on'),

    -- OBS-308 depends on OBS-307
    ('rel-308-307', 'obs-308', 'obs-307', 'depends_on'),

    -- OBS-309 depends on OBS-308
    ('rel-309-308', 'obs-309', 'obs-308', 'depends_on');

-- =============================================================================
-- Cross-Phase Dependencies
-- =============================================================================

-- Phase 4 depends on Phase 1 (schema must exist)
-- Phase 5 depends on Phase 1 and Phase 4

-- Phase 3 OBS-101 depends on Phase 2 producers (external)
-- Phase 5 services depend on Phase 4 types (conceptually)
