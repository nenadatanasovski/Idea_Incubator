# Data Model

SQLite database schema for Parent Harness.

## Entity Relationships

```
task_lists
    └── tasks
            ├── task_relationships
            └── lane_tasks
                    └── execution_lanes
                            └── execution_runs
                                    └── execution_waves

agents
    └── agent_sessions
            └── iteration_logs
                    └── iteration_qa_results
```

## Core Tables

### tasks
Main task table (from Vibe schema).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| display_id | TEXT UNIQUE | Human-readable (TASK-001) |
| title | TEXT | Task title |
| description | TEXT | Full description |
| category | TEXT | feature/bug/task/etc |
| status | TEXT | draft/pending/in_progress/completed/failed/blocked |
| priority | TEXT | P0-P4 |
| effort | TEXT | trivial/small/medium/large/epic |
| owner | TEXT | build_agent/human/task_agent/etc |
| assigned_agent_id | TEXT | FK to agents |
| wave_number | INTEGER | Which wave |
| lane_id | TEXT | FK to execution_lanes |
| pass_criteria | TEXT | JSON array |
| verification_status | TEXT | pending/passed/failed |
| parent_task_id | TEXT | FK to tasks (decomposition) |
| is_decomposed | INTEGER | Boolean |

### task_lists
Groups of related tasks.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| name | TEXT | List name |
| status | TEXT | draft/ready/in_progress/completed |
| max_parallel_agents | INTEGER | Concurrency limit |
| total_tasks | INTEGER | Count |
| completed_tasks | INTEGER | Count |

### task_relationships
Dependencies between tasks.

| Column | Type | Description |
|--------|------|-------------|
| source_task_id | TEXT | FK to tasks |
| target_task_id | TEXT | FK to tasks |
| relationship_type | TEXT | depends_on/blocks/related_to |

## Parallelism Tables

### execution_runs
One execution of a task list.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| task_list_id | TEXT | FK to task_lists |
| status | TEXT | pending/running/completed/failed |
| current_wave | INTEGER | Active wave number |
| total_waves | INTEGER | Total waves calculated |

### execution_waves
Parallel task groups.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| run_id | TEXT | FK to execution_runs |
| wave_number | INTEGER | 1, 2, 3... |
| status | TEXT | pending/active/completed |
| tasks_total | INTEGER | Count |
| tasks_completed | INTEGER | Count |
| max_parallelism | INTEGER | Possible concurrent |
| actual_parallelism | INTEGER | Achieved concurrent |

### execution_lanes
Swimlane categories.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| run_id | TEXT | FK to execution_runs |
| name | TEXT | Lane name |
| category | TEXT | database/types/api/ui/tests/infrastructure |
| file_patterns | TEXT | JSON array of globs |
| status | TEXT | idle/active/blocked/complete |

### lane_tasks
Task-to-lane mapping.

| Column | Type | Description |
|--------|------|-------------|
| lane_id | TEXT | FK to execution_lanes |
| task_id | TEXT | FK to tasks |
| wave_number | INTEGER | Which wave |
| status | TEXT | pending/running/complete/failed |

### parallelism_analysis
Pre-computed conflict analysis.

| Column | Type | Description |
|--------|------|-------------|
| task_a_id | TEXT | FK to tasks |
| task_b_id | TEXT | FK to tasks |
| can_parallel | INTEGER | Boolean |
| conflict_type | TEXT | dependency/file_conflict/resource |

## Agent Tables

### agents
Agent definitions.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | orchestrator/build_agent/etc |
| name | TEXT | Display name |
| type | TEXT | orchestrator/build/spec/qa/task/sia |
| model | TEXT | haiku/sonnet/opus |
| telegram_channel | TEXT | @vibe-xxx |
| status | TEXT | idle/working/error/stuck |
| current_task_id | TEXT | FK to tasks |
| current_session_id | TEXT | FK to agent_sessions |
| last_heartbeat | TEXT | ISO timestamp |

### agent_sessions
One execution run of an agent.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| agent_id | TEXT | FK to agents |
| task_id | TEXT | FK to tasks |
| run_id | TEXT | FK to execution_runs |
| wave_number | INTEGER | Which wave |
| lane_id | TEXT | FK to execution_lanes |
| status | TEXT | running/completed/failed/paused |
| current_iteration | INTEGER | Current loop |
| total_iterations | INTEGER | Total loops |

### iteration_logs
Each loop within a session. **Critical for QA validation.**

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| session_id | TEXT | FK to agent_sessions |
| iteration_number | INTEGER | 1, 2, 3... |
| status | TEXT | running/completed/failed/qa_pending/qa_passed/qa_failed |
| tasks_completed | INTEGER | Count |
| tasks_failed | INTEGER | Count |
| files_modified | TEXT | JSON array of paths |
| commits | TEXT | JSON array of hashes |
| log_content | TEXT | Full CLI output |
| log_preview | TEXT | First 500 chars |
| tool_calls | TEXT | JSON array |
| skill_uses | TEXT | JSON array |
| errors | TEXT | JSON array |
| checkpoints | TEXT | JSON array |
| qa_result | TEXT | pending/passed/failed/skipped |
| qa_validated_at | TEXT | ISO timestamp |
| qa_session_id | TEXT | FK to agent_sessions |

### iteration_qa_results
Detailed QA validation per iteration.

| Column | Type | Description |
|--------|------|-------------|
| iteration_log_id | TEXT | FK to iteration_logs |
| qa_session_id | TEXT | FK to agent_sessions |
| result | TEXT | passed/failed/needs_revision |
| tests_run | INTEGER | Count |
| tests_passed | INTEGER | Count |
| build_status | TEXT | success/failed/skipped |
| lint_status | TEXT | success/failed/skipped |
| findings | TEXT | JSON array |
| recommendations | TEXT | JSON array |

## Gap Solution Tables

### agent_memories
Per-agent long-term memory.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| agent_id | TEXT | Which agent |
| memory_type | TEXT | decision/failure/preference/pattern/success |
| content | TEXT | Memory content |
| task_signature | TEXT | Hash for similar task matching |
| relevance_score | REAL | 0.0-1.0, decays over time |
| created_at | TEXT | ISO timestamp |
| last_accessed | TEXT | ISO timestamp |
| access_count | INTEGER | Usage count |

### technique_effectiveness
Track which techniques work for which errors.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| technique | TEXT | decomposition/prompt_restructure/fresh_start/etc |
| error_pattern | TEXT | Regex or signature |
| success_count | INTEGER | Times it worked |
| failure_count | INTEGER | Times it failed |
| success_rate | REAL | Calculated |
| last_used | TEXT | ISO timestamp |

### sia_task_memory
Per-task technique history (from Vibe).

| Column | Type | Description |
|--------|------|-------------|
| task_id | TEXT PK | Task ID |
| task_signature | TEXT | Hash for matching similar tasks |
| attempts | TEXT | JSON array of {technique, result, timestamp} |
| techniques_tried | TEXT | JSON array of technique names |
| successful_technique | TEXT | What worked (if any) |
| total_interventions | INTEGER | Count |

### transcript_entries
Detailed action logging (from Vibe).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| timestamp | TEXT | ISO with milliseconds |
| sequence | INTEGER | Order within session |
| session_id | TEXT | FK to agent_sessions |
| iteration_number | INTEGER | Which iteration |
| entry_type | TEXT | tool_start/tool_end/skill_use/file_op/etc |
| category | TEXT | tool/file/git/test/etc |
| summary | TEXT | Human-readable (max 200 chars) |
| details | TEXT | JSON structured details |
| tool_calls | TEXT | JSON array |
| duration_ms | INTEGER | Time for operation |

### task_versions
Task change history with rollback support.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| task_id | TEXT | FK to tasks |
| version_number | INTEGER | Auto-increment per task |
| snapshot | TEXT | JSON of full task state |
| changed_fields | TEXT | JSON array of field names |
| changed_by | TEXT | user/agent_id |
| change_reason | TEXT | Why changed |
| created_at | TEXT | ISO timestamp |

### build_interventions
Track when agents fix each other's work.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| session_id | TEXT | FK to agent_sessions |
| task_id | TEXT | FK to tasks |
| original_agent_id | TEXT | Who failed |
| intervening_agent_id | TEXT | Who fixed it |
| intervention_type | TEXT | fix/decompose/escalate |
| resolution | TEXT | What was done |
| created_at | TEXT | ISO timestamp |

### human_sim_results
Usability test results per persona.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| task_id | TEXT | FK to tasks |
| session_id | TEXT | FK to agent_sessions |
| persona | TEXT | technical/power-user/casual/confused/impatient |
| test_type | TEXT | happy_path/error_recovery/workflow/etc |
| started_at | TEXT | ISO timestamp |
| completed_at | TEXT | ISO timestamp |
| passed | INTEGER | Boolean |
| completion_time_ms | INTEGER | How long to complete |
| frustration_score | REAL | 0.0-1.0 |
| findings | TEXT | JSON array of issues |
| recommendations | TEXT | JSON array |
| screenshots | TEXT | JSON array of paths |
| fix_tasks_created | TEXT | JSON array of task IDs |

### clarification_sessions
Track clarification conversations.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| task_id | TEXT | FK to tasks |
| status | TEXT | pending/in_progress/complete/timeout |
| questions_asked | TEXT | JSON array |
| answers_received | TEXT | JSON array |
| original_description | TEXT | Before clarification |
| enriched_description | TEXT | After clarification |
| pass_criteria_added | TEXT | JSON array |
| started_at | TEXT | ISO timestamp |
| completed_at | TEXT | ISO timestamp |
| timeout_at | TEXT | When to proceed with assumptions |

## Observability Tables

### observability_events
All system events.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| timestamp | TEXT | ISO timestamp |
| event_type | TEXT | task:assigned, tool:completed, etc |
| agent_id | TEXT | Which agent |
| session_id | TEXT | FK to agent_sessions |
| iteration_number | INTEGER | Which loop |
| severity | TEXT | debug/info/warning/error |
| message | TEXT | Event message |
| payload | TEXT | JSON |

### message_bus
Inter-agent communication.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| timestamp | TEXT | ISO timestamp |
| source_agent | TEXT | Sender |
| event_type | TEXT | Message type |
| event_data | TEXT | JSON payload |
| target_agent | TEXT | Recipient (NULL=broadcast) |
| consumed_by | TEXT | JSON array |

### cron_ticks
Orchestrator tick tracking.

| Column | Type | Description |
|--------|------|-------------|
| tick_number | INTEGER PK | Tick ID |
| timestamp | TEXT | ISO timestamp |
| agents_working | INTEGER | Count |
| agents_idle | INTEGER | Count |
| tasks_assigned | INTEGER | Count |
| qa_cycle | INTEGER | 1 if QA ran |

### qa_audits
15-minute QA audit results.

| Column | Type | Description |
|--------|------|-------------|
| tick_number | INTEGER | FK to cron_ticks |
| sessions_checked | TEXT | JSON array |
| iterations_validated | TEXT | JSON array |
| stuck_sessions | TEXT | JSON array |
| sessions_terminated | TEXT | JSON array |
| loops_passed | INTEGER | Count |
| loops_failed | INTEGER | Count |

## Views

### v_active_agents
Active agents with current work.

### v_iteration_qa_status
Iteration validation status with agent/task info.

### v_wave_progress
Wave completion percentages.

## Indexes

All foreign keys are indexed. Additional indexes on:
- `tasks.status`
- `tasks.wave_number`
- `iteration_logs.qa_result`
- `observability_events.timestamp`
- `observability_events.session_id`
