-- Parent Harness Database Schema
-- Based on Vibe platform structure with full parallelism and loop validation
-- Created: 2026-02-06

-- ============================================
-- TASK MANAGEMENT (from Vibe)
-- ============================================

-- Display ID sequences (per-project)
CREATE TABLE IF NOT EXISTS display_id_sequences (
    project_id TEXT PRIMARY KEY,
    last_sequence INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Task Lists
CREATE TABLE IF NOT EXISTS task_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_id TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN (
        'draft', 'ready', 'in_progress', 'paused', 'completed', 'archived'
    )),
    max_parallel_agents INTEGER DEFAULT 3,
    auto_execute INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

-- Tasks (core table)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    display_id TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN (
        'feature', 'bug', 'task', 'story', 'epic', 'spike',
        'improvement', 'documentation', 'test', 'devops',
        'design', 'research', 'infrastructure', 'security',
        'performance', 'other'
    )) DEFAULT 'task',
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'draft', 'evaluating', 'pending', 'in_progress',
        'completed', 'failed', 'blocked', 'skipped',
        'pending_verification'
    )),
    retry_count INTEGER DEFAULT 0,
    queue TEXT CHECK(queue IS NULL OR queue = 'evaluation'),
    task_list_id TEXT REFERENCES task_lists(id) ON DELETE SET NULL,
    project_id TEXT,
    priority TEXT CHECK(priority IN ('P0', 'P1', 'P2', 'P3', 'P4')) DEFAULT 'P2',
    effort TEXT CHECK(effort IN ('trivial', 'small', 'medium', 'large', 'epic')) DEFAULT 'medium',
    phase INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,
    owner TEXT CHECK(owner IN ('build_agent', 'human', 'task_agent', 'spec_agent', 'qa_agent')) DEFAULT 'build_agent',
    assigned_agent_id TEXT,
    -- Decomposition tracking
    parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    is_decomposed INTEGER DEFAULT 0,
    decomposition_id TEXT,
    -- Wave/Lane assignment
    wave_number INTEGER,
    lane_id TEXT,
    -- Pass criteria (JSON array)
    pass_criteria TEXT,
    verification_status TEXT CHECK(verification_status IN (
        'pending', 'passed', 'failed', 'needs_revision'
    )),
    -- Links
    spec_link TEXT,
    pr_link TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

-- Task relationships (dependencies)
CREATE TABLE IF NOT EXISTS task_relationships (
    id TEXT PRIMARY KEY,
    source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN (
        'depends_on', 'blocks', 'related_to', 'duplicate_of', 'parent_of', 'child_of'
    )),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_task_id, target_task_id, relationship_type)
);

-- ============================================
-- PARALLELISM: WAVES & LANES
-- ============================================

-- Execution Runs (a single execution of a task list)
CREATE TABLE IF NOT EXISTS execution_runs (
    id TEXT PRIMARY KEY,
    task_list_id TEXT NOT NULL REFERENCES task_lists(id),
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
    )),
    total_waves INTEGER DEFAULT 0,
    current_wave INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Execution Waves (parallel task groups within a run)
CREATE TABLE IF NOT EXISTS execution_waves (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
    wave_number INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending', 'active', 'completed', 'failed'
    )),
    tasks_total INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_running INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    tasks_blocked INTEGER DEFAULT 0,
    max_parallelism INTEGER DEFAULT 0,
    actual_parallelism INTEGER DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(run_id, wave_number)
);

-- Execution Lanes (swimlanes by category)
CREATE TABLE IF NOT EXISTS execution_lanes (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN (
        'database', 'types', 'api', 'ui', 'tests', 'infrastructure', 'other'
    )),
    file_patterns TEXT,  -- JSON array of glob patterns
    status TEXT DEFAULT 'idle' CHECK(status IN (
        'idle', 'active', 'blocked', 'complete'
    )),
    block_reason TEXT,
    current_agent_id TEXT,
    tasks_total INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Lane-Task mapping (which task in which lane/wave)
CREATE TABLE IF NOT EXISTS lane_tasks (
    id TEXT PRIMARY KEY,
    lane_id TEXT NOT NULL REFERENCES execution_lanes(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    wave_number INTEGER NOT NULL,
    position_in_wave INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending', 'running', 'complete', 'failed', 'blocked', 'skipped'
    )),
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    block_reason TEXT,
    blocking_task_id TEXT,
    agent_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(lane_id, task_id)
);

-- Parallelism Analysis (can tasks run in parallel?)
CREATE TABLE IF NOT EXISTS parallelism_analysis (
    id TEXT PRIMARY KEY,
    task_a_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    task_b_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    can_parallel INTEGER NOT NULL DEFAULT 0,
    conflict_type TEXT CHECK(conflict_type IN (
        'dependency', 'file_conflict', 'resource_conflict'
    )),
    conflict_details TEXT,
    analyzed_at TEXT DEFAULT (datetime('now')),
    invalidated_at TEXT,
    UNIQUE(task_a_id, task_b_id),
    CHECK(task_a_id < task_b_id)
);

-- Task Conflicts (runtime conflicts detected)
CREATE TABLE IF NOT EXISTS task_conflicts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
    task_a_id TEXT NOT NULL REFERENCES tasks(id),
    task_b_id TEXT NOT NULL REFERENCES tasks(id),
    conflict_type TEXT NOT NULL CHECK(conflict_type IN (
        'file_conflict', 'dependency', 'resource_lock'
    )),
    details TEXT NOT NULL,
    file_path TEXT,
    operation_a TEXT,
    operation_b TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(run_id, task_a_id, task_b_id)
);

-- ============================================
-- AGENT MANAGEMENT
-- ============================================

-- Agent definitions
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    model TEXT NOT NULL,
    telegram_channel TEXT,
    status TEXT DEFAULT 'idle' CHECK(status IN ('idle', 'working', 'error', 'stuck', 'stopped')),
    current_task_id TEXT,
    current_session_id TEXT,
    last_heartbeat TEXT,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Agent Sessions (each execution run of an agent)
CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id),
    task_id TEXT REFERENCES tasks(id),
    run_id TEXT REFERENCES execution_runs(id),  -- Link to execution run
    wave_number INTEGER,  -- Which wave this session is part of
    lane_id TEXT REFERENCES execution_lanes(id),  -- Which lane
    status TEXT CHECK(status IN ('running', 'completed', 'failed', 'paused', 'terminated')),
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    current_iteration INTEGER DEFAULT 1,
    total_iterations INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    parent_session_id TEXT REFERENCES agent_sessions(id),
    metadata TEXT
);

-- ============================================
-- LOOP/ITERATION TRACKING WITH QA VALIDATION
-- ============================================

-- Iteration Logs (each loop of an agent session)
CREATE TABLE IF NOT EXISTS iteration_logs (
    id TEXT PRIMARY KEY,  -- Changed to TEXT for UUID
    session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT CHECK(status IN ('running', 'completed', 'failed', 'qa_pending', 'qa_passed', 'qa_failed')),
    -- Work done in this iteration
    tasks_attempted INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    files_modified TEXT,  -- JSON array of file paths
    commits TEXT,  -- JSON array of commit hashes
    -- CLI Output (critical for QA stuck detection)
    log_content TEXT,
    log_preview TEXT,  -- First 500 chars for quick view
    tool_calls TEXT,  -- JSON array of tool calls made
    skill_uses TEXT,  -- JSON array of Claude skills used
    -- Errors
    errors TEXT,  -- JSON array of errors
    -- Checkpoints for rollback
    checkpoints TEXT,  -- JSON array of checkpoint IDs
    -- QA Validation
    qa_validated_at TEXT,
    qa_session_id TEXT,  -- Which QA session validated this
    qa_result TEXT CHECK(qa_result IN ('pending', 'passed', 'failed', 'skipped')),
    qa_notes TEXT,
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(session_id, iteration_number)
);

-- QA Validation Results (per iteration)
CREATE TABLE IF NOT EXISTS iteration_qa_results (
    id TEXT PRIMARY KEY,
    iteration_log_id TEXT NOT NULL REFERENCES iteration_logs(id) ON DELETE CASCADE,
    qa_session_id TEXT NOT NULL REFERENCES agent_sessions(id),
    result TEXT NOT NULL CHECK(result IN ('passed', 'failed', 'needs_revision')),
    -- What was checked
    tests_run INTEGER DEFAULT 0,
    tests_passed INTEGER DEFAULT 0,
    tests_failed INTEGER DEFAULT 0,
    build_status TEXT CHECK(build_status IN ('success', 'failed', 'skipped')),
    lint_status TEXT CHECK(lint_status IN ('success', 'failed', 'skipped')),
    -- Findings
    findings TEXT,  -- JSON array
    recommendations TEXT,  -- JSON array
    -- Evidence
    verification_log TEXT,
    -- Timestamps
    validated_at TEXT DEFAULT (datetime('now'))
);

-- Agent Heartbeats (for stuck detection)
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES agent_sessions(id),
    iteration_number INTEGER,
    task_id TEXT,
    status TEXT NOT NULL,
    progress_percent INTEGER CHECK(progress_percent >= 0 AND progress_percent <= 100),
    current_step TEXT,
    last_tool_call TEXT,
    last_output TEXT,  -- Last CLI output line
    memory_mb INTEGER,
    cpu_percent REAL,
    recorded_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- MESSAGE BUS (inter-agent communication)
-- ============================================

CREATE TABLE IF NOT EXISTS message_bus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    source_agent TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL,
    target_agent TEXT,
    consumed_by TEXT DEFAULT '[]',
    expires_at TEXT
);

-- ============================================
-- RUNTIME SYSTEM STATE
-- ============================================

CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Retry attempt audit trail (single-source retry accounting)
CREATE TABLE IF NOT EXISTS task_retry_attempts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    session_id TEXT REFERENCES agent_sessions(id) ON DELETE SET NULL,
    error TEXT,
    analysis_prompt TEXT,
    fix_approach TEXT,
    result TEXT DEFAULT 'pending',
    completed_at TEXT,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(task_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_task_retry_attempts_task ON task_retry_attempts(task_id);

-- ============================================
-- OBSERVABILITY EVENTS
-- ============================================

-- Pipeline Events (real-time streaming)
CREATE TABLE IF NOT EXISTS pipeline_events (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES execution_runs(id),
    session_id TEXT REFERENCES agent_sessions(id),
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Observability Events (all events)
CREATE TABLE IF NOT EXISTS observability_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    event_type TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    task_id TEXT,
    session_id TEXT,
    iteration_number INTEGER,
    severity TEXT CHECK(severity IN ('debug', 'info', 'warning', 'error')),
    message TEXT NOT NULL,
    payload TEXT,
    telegram_message_id TEXT
);

-- Cron tick tracking
CREATE TABLE IF NOT EXISTS cron_ticks (
    tick_number INTEGER PRIMARY KEY,
    timestamp TEXT DEFAULT (datetime('now')),
    actions_taken TEXT,
    agents_working INTEGER DEFAULT 0,
    agents_idle INTEGER DEFAULT 0,
    tasks_assigned INTEGER DEFAULT 0,
    qa_cycle INTEGER DEFAULT 0,
    duration_ms INTEGER
);

-- QA Audits (every 15 minutes)
CREATE TABLE IF NOT EXISTS qa_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    tick_number INTEGER REFERENCES cron_ticks(tick_number),
    -- Sessions checked
    sessions_checked TEXT,  -- JSON array
    iterations_validated TEXT,  -- JSON array of iteration IDs validated
    -- Stuck detection
    stuck_sessions TEXT,  -- JSON array of stuck session IDs
    sessions_terminated TEXT,  -- JSON array of terminated session IDs
    -- Findings
    loops_passed INTEGER DEFAULT 0,
    loops_failed INTEGER DEFAULT 0,
    findings TEXT,
    recommendations TEXT
);

-- ============================================
-- TEST SYSTEM TABLES
-- ============================================

-- Test suite definitions
CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('unit', 'integration', 'e2e', 'verification', 'lint', 'typecheck')),
    source TEXT NOT NULL CHECK(source IN ('code', 'phases', 'task_agent', 'planning_agent')),
    file_path TEXT,
    phase INTEGER,
    enabled INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Test cases within suites
CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK(priority IN ('P0', 'P1', 'P2', 'P3', 'P4')) DEFAULT 'P2',
    timeout_ms INTEGER DEFAULT 30000,
    retry_limit INTEGER DEFAULT 5,
    depends_on TEXT,  -- JSON array of test_case IDs
    tags TEXT,  -- JSON array
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Steps within test cases
CREATE TABLE IF NOT EXISTS test_steps (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    name TEXT NOT NULL,
    command TEXT,
    expected_exit_code INTEGER DEFAULT 0,
    expected_output_contains TEXT,
    timeout_ms INTEGER DEFAULT 10000,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Assertions within steps
CREATE TABLE IF NOT EXISTS test_assertions (
    id TEXT PRIMARY KEY,
    step_id TEXT NOT NULL REFERENCES test_steps(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    assertion_type TEXT NOT NULL CHECK(assertion_type IN ('equals', 'contains', 'matches', 'exists', 'truthy')),
    target TEXT NOT NULL,
    expected_value TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Test run executions
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    trigger TEXT NOT NULL CHECK(trigger IN ('manual', 'cron', 'task_completion', 'phase_gate', 'ci')),
    triggered_by TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT CHECK(status IN ('running', 'passed', 'failed', 'partial')),
    suites_run INTEGER DEFAULT 0,
    suites_passed INTEGER DEFAULT 0,
    suites_failed INTEGER DEFAULT 0,
    total_duration_ms INTEGER,
    session_id TEXT
);

-- Suite results within runs
CREATE TABLE IF NOT EXISTS test_suite_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    suite_id TEXT NOT NULL REFERENCES test_suites(id),
    status TEXT CHECK(status IN ('running', 'passed', 'failed', 'skipped')),
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    cases_run INTEGER DEFAULT 0,
    cases_passed INTEGER DEFAULT 0,
    cases_failed INTEGER DEFAULT 0,
    duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    fix_attempts TEXT  -- JSON array of fix session IDs
);

-- Case results within suite results
CREATE TABLE IF NOT EXISTS test_case_results (
    id TEXT PRIMARY KEY,
    suite_result_id TEXT NOT NULL REFERENCES test_suite_results(id) ON DELETE CASCADE,
    case_id TEXT NOT NULL REFERENCES test_cases(id),
    status TEXT CHECK(status IN ('running', 'passed', 'failed', 'skipped', 'fixing')),
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    steps_run INTEGER DEFAULT 0,
    steps_passed INTEGER DEFAULT 0,
    steps_failed INTEGER DEFAULT 0,
    duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    stack_trace TEXT,
    fix_session_id TEXT
);

-- Step results within case results
CREATE TABLE IF NOT EXISTS test_step_results (
    id TEXT PRIMARY KEY,
    case_result_id TEXT NOT NULL REFERENCES test_case_results(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL REFERENCES test_steps(id),
    status TEXT CHECK(status IN ('running', 'passed', 'failed', 'skipped')),
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    actual_exit_code INTEGER,
    actual_output TEXT,
    full_output_path TEXT,
    duration_ms INTEGER,
    assertions_run INTEGER DEFAULT 0,
    assertions_passed INTEGER DEFAULT 0,
    assertions_failed INTEGER DEFAULT 0,
    screenshots TEXT  -- JSON array of paths
);

-- Assertion results within step results
CREATE TABLE IF NOT EXISTS test_assertion_results (
    id TEXT PRIMARY KEY,
    step_result_id TEXT NOT NULL REFERENCES test_step_results(id) ON DELETE CASCADE,
    assertion_id TEXT NOT NULL REFERENCES test_assertions(id),
    status TEXT CHECK(status IN ('passed', 'failed')),
    actual_value TEXT,
    expected_value TEXT,
    error_message TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- Task to test linking
CREATE TABLE IF NOT EXISTS task_test_links (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    test_case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL CHECK(link_type IN ('pass_criteria', 'acceptance', 'regression', 'smoke')),
    required_for_completion INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(task_id, test_case_id)
);

-- Test dependencies (test A depends on test B)
CREATE TABLE IF NOT EXISTS test_dependencies (
    id TEXT PRIMARY KEY,
    test_case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    depends_on_test_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL CHECK(dependency_type IN ('must_pass', 'should_pass', 'blocks')),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(test_case_id, depends_on_test_id)
);

-- Fix attempts for failing tests
CREATE TABLE IF NOT EXISTS test_fix_attempts (
    id TEXT PRIMARY KEY,
    case_result_id TEXT NOT NULL REFERENCES test_case_results(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    session_id TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT CHECK(status IN ('attempting', 'fixed', 'failed', 'escalated')),
    analysis TEXT,
    fix_description TEXT,
    files_modified TEXT,  -- JSON array
    commits TEXT,  -- JSON array
    retry_after_fix INTEGER DEFAULT 0
);

-- Indexes for test system
CREATE INDEX IF NOT EXISTS idx_test_suites_type ON test_suites(type);
CREATE INDEX IF NOT EXISTS idx_test_suites_source ON test_suites(source);
CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON test_cases(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_steps_case ON test_steps(case_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_trigger ON test_runs(trigger);
CREATE INDEX IF NOT EXISTS idx_suite_results_run ON test_suite_results(run_id);
CREATE INDEX IF NOT EXISTS idx_suite_results_status ON test_suite_results(status);
CREATE INDEX IF NOT EXISTS idx_case_results_status ON test_case_results(status);
CREATE INDEX IF NOT EXISTS idx_step_results_status ON test_step_results(status);
CREATE INDEX IF NOT EXISTS idx_task_test_links_task ON task_test_links(task_id);
CREATE INDEX IF NOT EXISTS idx_fix_attempts_status ON test_fix_attempts(status);

-- ============================================
-- INDEXES
-- ============================================

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_display_id ON tasks(display_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_queue ON tasks(queue);
CREATE INDEX IF NOT EXISTS idx_tasks_task_list_id ON tasks(task_list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_wave ON tasks(wave_number);
CREATE INDEX IF NOT EXISTS idx_tasks_lane ON tasks(lane_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);

-- Waves and Lanes
CREATE INDEX IF NOT EXISTS idx_waves_run ON execution_waves(run_id);
CREATE INDEX IF NOT EXISTS idx_waves_status ON execution_waves(status);
CREATE INDEX IF NOT EXISTS idx_lanes_run ON execution_lanes(run_id);
CREATE INDEX IF NOT EXISTS idx_lanes_status ON execution_lanes(status);
CREATE INDEX IF NOT EXISTS idx_lane_tasks_lane ON lane_tasks(lane_id);
CREATE INDEX IF NOT EXISTS idx_lane_tasks_wave ON lane_tasks(wave_number);

-- Sessions and Iterations
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_run ON agent_sessions(run_id);
CREATE INDEX IF NOT EXISTS idx_sessions_wave ON agent_sessions(wave_number);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_iterations_session ON iteration_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_iterations_qa_result ON iteration_logs(qa_result);

-- Events
CREATE INDEX IF NOT EXISTS idx_pipeline_events_run ON pipeline_events(run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_timestamp ON pipeline_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_obs_events_timestamp ON observability_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_obs_events_session ON observability_events(session_id);

-- ============================================
-- VIEWS
-- ============================================

-- Active agents with current work
CREATE VIEW IF NOT EXISTS v_active_agents AS
SELECT
    a.id,
    a.name,
    a.type,
    a.status,
    a.current_task_id,
    t.display_id AS task_display_id,
    t.title AS task_title,
    s.id AS session_id,
    s.current_iteration,
    s.wave_number,
    (julianday('now') - julianday(a.last_heartbeat)) * 86400 AS seconds_since_heartbeat
FROM agents a
LEFT JOIN tasks t ON a.current_task_id = t.id
LEFT JOIN agent_sessions s ON a.current_session_id = s.id
WHERE a.status != 'stopped';

-- Iteration validation status
CREATE VIEW IF NOT EXISTS v_iteration_qa_status AS
SELECT
    il.id AS iteration_id,
    il.session_id,
    il.iteration_number,
    il.status,
    il.qa_result,
    il.tasks_completed,
    il.tasks_failed,
    a.name AS agent_name,
    s.task_id,
    t.display_id AS task_display_id,
    il.qa_validated_at,
    CASE
        WHEN il.qa_result = 'pending' THEN 'Awaiting QA'
        WHEN il.qa_result = 'passed' THEN 'Verified'
        WHEN il.qa_result = 'failed' THEN 'Failed QA'
        ELSE 'Not Validated'
    END AS validation_status
FROM iteration_logs il
JOIN agent_sessions s ON il.session_id = s.id
JOIN agents a ON s.agent_id = a.id
LEFT JOIN tasks t ON s.task_id = t.id;

-- Wave progress summary
CREATE VIEW IF NOT EXISTS v_wave_progress AS
SELECT
    ew.run_id,
    ew.wave_number,
    ew.status,
    ew.tasks_total,
    ew.tasks_completed,
    ew.tasks_failed,
    ew.tasks_running,
    ROUND(ew.tasks_completed * 100.0 / NULLIF(ew.tasks_total, 0), 1) AS completion_pct,
    ew.max_parallelism,
    ew.actual_parallelism,
    ew.started_at,
    ew.completed_at,
    ew.duration_ms
FROM execution_waves ew;

-- ============================================
-- INITIAL DATA: Agent definitions
-- ============================================

INSERT OR IGNORE INTO agents (id, name, type, model, telegram_channel) VALUES
('orchestrator', 'Orchestrator', 'orchestrator', 'haiku', '@vibe-orchestrator'),
('build_agent', 'Build Agent', 'build', 'opus', '@vibe-build'),
('spec_agent', 'Spec Agent', 'spec', 'opus', '@vibe-spec'),
('qa_agent', 'QA Agent', 'qa', 'opus', '@vibe-qa'),
('task_agent', 'Task Agent', 'task', 'sonnet', '@vibe-task'),
('sia_agent', 'SIA (Ideation)', 'sia', 'opus', '@vibe-sia'),
('research_agent', 'Research Agent', 'research', 'sonnet', '@vibe-research'),
('evaluator_agent', 'Evaluator Agent', 'evaluator', 'opus', '@vibe-evaluator'),
('decomposition_agent', 'Decomposition Agent', 'decomposition', 'sonnet', '@vibe-decomposition'),
('validation_agent', 'Validation Agent', 'validation', 'sonnet', '@vibe-validation');
