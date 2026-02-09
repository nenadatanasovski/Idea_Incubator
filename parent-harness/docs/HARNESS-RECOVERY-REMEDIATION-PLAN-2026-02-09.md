# Parent Harness Recovery + Stabilization Plan

Date: 2026-02-09  
Scope: `parent-harness/orchestrator` + `parent-harness/database` + runtime data path `parent-harness/data`

## Current Ground Truth (Baseline from recovered snapshot)
This plan is based on `parent-harness/data/recovery.sql` loaded into a clean SQLite snapshot. The live DB in `parent-harness/data` is currently not a valid base DB (WAL/SHM present without healthy `harness.db`), so all baseline metrics below come from the recovered snapshot.

- Sessions/tasks desync:
  - `agent_sessions`: 433 total, 140 `running`
  - `tasks`: 0 `in_progress`
  - 140/140 running sessions attached to tasks not in progress
- Retry amplification:
  - 21 tasks with `retry_count >= 5`
  - max `retry_count = 7`
  - `task_retry_attempts`: 338 rows, 338 with `error = 'Unknown error'`
- Assignment storm:
  - `task:assigned` events: 747
  - distinct assigned tasks: 92
  - avg assignments/task: 8.12
  - peak assignment rate: 24/minute
- Test-task saturation:
  - test-like tasks: 110/145
  - test-task assignment events: 471/747 (63.05%)
- Observability coverage gaps:
  - `cron_ticks`: 0
  - `pipeline_events`: 0
  - `iteration_logs`: 0
  - observability payload coverage: 24/2453 (~0.98%)
- Telegram linkage gap:
  - `telegram_messages`: 75 total
  - `task_id IS NULL`: 75
  - `session_id IS NULL`: 75
- DB integrity incidents:
  - repeated `system:error` entries for `database disk image is malformed` on 2026-02-07 02:21:37 through 02:26:37

## Constraints and Honest Assumptions
- The baseline is reliable only for 2026-02-06 to 2026-02-07 (recovered event window).
- Some findings indicate schema/code drift, not only runtime bugs.
- Event-driven and legacy paths both exist in code; logs indicate legacy `cron:tick` was active during the recovered period. Split-brain is plausible but not yet proven without process-level runtime evidence.
- We can stop runaway behavior quickly, but historical data fidelity (especially from malformed windows) cannot be fully reconstructed.

## Success Criteria (Program-Level)
- No persistent session/task state divergence after 60-minute soak.
- Retry increments become single-source and bounded by one policy.
- Assignment churn drops from baseline (8.12/task) to <= 1.5/task for active non-test tasks.
- Test-like tasks no longer consume production orchestration by default.
- One orchestration authority active at a time (event OR legacy, not both).
- Database corruption incidents stop under normal workload.
- Telegram records become joinable to tasks/sessions for new traffic.

## Handoff Readiness Verdict
The plan is implementation-sound and comprehensive for engineering execution, with one condition: it should be executed under strict sequencing and evidence capture. The sections below make this explicit so handoff is unambiguous.

## Execution Protocol (Mandatory)
- [ ] Use one branch per workstream (`A`, `B`, `C`, `D`) to reduce merge contention.
- [ ] Keep schema changes isolated in dedicated migration commits.
- [ ] Before each run, clone from the same recovered baseline snapshot DB.
- [ ] Do not combine runtime mode changes and retry-policy changes in one PR.
- [ ] Require SQL evidence attachment for every pass criterion (query + output).
- [ ] Fail closed on DB-integrity uncertainty (pause spawn, no silent continue).

## Recommended PR Sequence (Critical Path)
1. PR-1: Phase 0 + Phase 1 (state correctness baseline).
2. PR-2: Phase 2 (retry unification) after PR-1 passes Run 1.
3. PR-3: Phase 3 + Phase 4 (single authority + test-task gating).
4. PR-4: Phase 5 (schema/command reliability).
5. PR-5: Phase 6 (integrity hardening).
6. PR-6: Phase 7 + Phase 8 (observability/security cleanup).

## AI Agent Personas and Effort (Planning-Level)
- Workstream A (State + Retry Core): Senior backend engineer, 2-3 days.
- Workstream B (Runtime + Spawn Control): Senior backend/platform engineer, 1-2 days.
- Workstream C (Schema + Command Reliability): Backend engineer, 1-2 days.
- Workstream D (Integrity + Observability + Security): Platform/security engineer, 2-3 days.
- QA/Validation: 1 engineer for run matrix execution and evidence collection, 1-2 days.

## Phase Plan (Ordered by rate-limit and runaway impact)

### Phase 0: Stabilize + Freeze Blast Radius
- [ ] Gate new spawns while patching (`spawning_paused` or equivalent runtime flag).
- [ ] Snapshot current `parent-harness/data` and `parent-harness/orchestrator/data` before changes.
- [ ] Establish one canonical DB file path and document it.

Pass criteria:
- [ ] No new assignment spikes during remediation window.
- [ ] Restorable backup exists for both data directories.

### Phase 1: Fix Session Finalization and State Reconciliation
Files implicated: `parent-harness/orchestrator/src/db/sessions.ts`, `parent-harness/database/schema.sql`, state reconciliation/scanner paths.

- [ ] Remove writes to non-existent `agent_sessions.output` column.
- [ ] Standardize session terminal data storage into `metadata` (or add explicit columns via migration if preferred).
- [ ] Add/verify reconciliation logic to close orphan `running` sessions when task/agent terminal state is reached.
- [ ] Add idempotent migration guard to ensure schema + code alignment.

Pass criteria:
- [ ] Session status updates do not throw SQL errors on complete/fail/terminate.
- [ ] Reconciliation run produces zero long-lived orphan `running` sessions (>2 ticks without agent/task alignment).

### Phase 2: Unify Retry Policy and Remove Multi-Path Increments
Files implicated: `parent-harness/orchestrator/src/db/tasks.ts`, `parent-harness/orchestrator/src/orchestrator/index.ts`, `parent-harness/orchestrator/src/events/stuck-agent-handler.ts`, `parent-harness/orchestrator/src/telegram/commands.ts`, retry/state-machine modules.

- [ ] Define one retry authority (recommended: task state machine transition helper).
- [ ] Remove direct SQL increment from stuck handler.
- [ ] Remove `/retry` command increment side effect; retries should transition state only.
- [ ] Ensure spawn failure pre-session does not increment retries.
- [ ] Capture structured failure reason instead of default `Unknown error` where possible.

Pass criteria:
- [ ] Each failed attempt increments retry count exactly once.
- [ ] No task exceeds configured max retries by bypass path.
- [ ] `Unknown error` share falls materially (target <20% of new retry rows).

### Phase 3: Enforce Single Runtime Authority (No Split-Brain)
Files implicated: `parent-harness/orchestrator/src/server.ts`, `parent-harness/orchestrator/src/api/orchestrator.ts`, `parent-harness/orchestrator/ecosystem.config.cjs`, `parent-harness/orchestrator/scripts/start-production.sh`.

- [ ] Make mode explicit and mutually exclusive at startup (`event` or `legacy`).
- [ ] Prevent API endpoints from starting legacy tick loop when event system mode is active.
- [ ] Align PM2 process name and startup script cleanup target (currently mismatch between `harness` and `orchestrator`).
- [ ] Add startup log/event proving active mode and PID ownership.

Pass criteria:
- [ ] Exactly one orchestrator mode active per process.
- [ ] Process control commands target the real PM2 app consistently.
- [ ] No overlapping assign/retry flows from competing loops.

### Phase 4: Gate Test Tasks in All Assignment Paths
Files implicated: `parent-harness/orchestrator/src/orchestrator/index.ts`, `parent-harness/orchestrator/src/events/spawn-service.ts`, scanners.

- [ ] Implement a shared `isRunnableProductionTask()` predicate.
- [ ] Apply predicate to both legacy assignment loop and event-driven spawn service.
- [ ] Optionally route test tasks to dedicated queue/flag (`test_only`) to prevent accidental production execution.

Pass criteria:
- [ ] Production assignment paths skip test-like tasks by default.
- [ ] Non-test queue latency improves under mixed workload.

### Phase 5: Schema Completeness and Command/Control Reliability
Files implicated: `parent-harness/database/schema.sql`, modules that read/write `system_state` and `agent_outputs`.

- [ ] Add missing `system_state` table definition (or remove dependence if feature is retired).
- [ ] Add missing `agent_outputs` table or migrate `/logs` command to supported source (`iteration_logs`/session metadata).
- [ ] Audit Telegram command SQL against real schema (status values, column names like `wave` vs `wave_number`, `agent_type` vs `type`).

Pass criteria:
- [ ] Telegram control commands execute without schema errors.
- [ ] `/logs`, `/stop`, `/start`, `/retry` are functional and consistent with orchestrator state model.

### Phase 6: Database Integrity Hardening
Files implicated: DB init/migration/recovery scripts and runtime PRAGMAs.

- [ ] Add startup integrity check (`PRAGMA quick_check` and escalation path to full check offline).
- [ ] Add safe recovery bootstrap when base DB missing but WAL/SHM exists (fail closed, do not run blind).
- [ ] Introduce periodic checkpoint + backup policy.
- [ ] Add explicit corruption alarm and automatic spawn pause.

Pass criteria:
- [ ] Startup blocks or degrades safely on malformed DB.
- [ ] No repeated malformed-disk-image loops under soak.

### Phase 7: Observability + Correlation Improvements
Files implicated: event emission and logging modules.

- [ ] Emit structured payload for key lifecycle events (`task:assigned`, `task:failed`, retry, reconciliation actions).
- [ ] Start writing `cron_ticks` and/or equivalent mode-specific health table.
- [ ] Ensure `iteration_logs` are created for real executions or remove dead table expectations.
- [ ] Propagate `taskId`/`sessionId` into Telegram logging context for all outbound notifications.

Pass criteria:
- [ ] Payload coverage for new observability events >= 80%.
- [ ] New Telegram records have non-null linkage for task/session-scoped messages.

### Phase 8: Security Cleanup (Immediate)
Files implicated: `parent-harness/orchestrator/src/telegram/direct-telegram.ts`.

- [ ] Remove hardcoded bot tokens from source.
- [ ] Force env-only token loading; fail startup if required tokens missing.
- [ ] Rotate all exposed bot tokens and document incident response completion.

Pass criteria:
- [ ] No secrets in repository code.
- [ ] Bot connectivity validated with rotated credentials.

## Implementation Task Board (Execution Checklist)

### Workstream A: State and Retry Core
- [ ] A1. Session update SQL/schema alignment patch
- [ ] A2. Reconciliation hardening for orphan sessions/tasks
- [ ] A3. Single retry increment authority abstraction
- [ ] A4. Remove duplicate retry increments in stuck handler + Telegram retry command
- [ ] A5. Structured failure reason plumbing (`Unknown error` reduction)

### Workstream B: Runtime Mode and Spawn Control
- [ ] B1. One-mode startup contract (`HARNESS_EVENT_SYSTEM` enforcement)
- [ ] B2. API guardrails for pause/resume/trigger per mode
- [ ] B3. PM2 naming/start script consistency
- [ ] B4. Shared task-gating predicate used by both assignment engines

### Workstream C: Schema/Command Reliability
- [ ] C1. Add missing tables (`system_state`, `agent_outputs`) or retire dependencies
- [ ] C2. Fix command SQL drift (`wave`/`wave_number`, `agent_type`/`type`, invalid statuses)
- [ ] C3. Migration idempotency and startup schema verification

### Workstream D: Integrity/Observability/Security
- [ ] D1. DB integrity checks + fail-safe behavior
- [ ] D2. Observability payload enrichment and tick/iteration visibility
- [ ] D3. Telegram task/session correlation
- [ ] D4. Token de-hardcoding + credential rotation

## Dependency Rules (Do Not Violate)
- [ ] Do not start B/C/D before A1 and A2 are complete (state must be trustworthy first).
- [ ] Do not run Run 2 before Run 1 is green (retry metrics are invalid on broken session state).
- [ ] Do not run Run 3 before retry policy is unified (otherwise attribution is noisy).
- [ ] Do not run soak (Run 6) until schema reliability checks (Run 5) are green.
- [ ] Do not declare completion until security verification (Run 7) is green.

## Test Runs With Expected DB Outcomes
Each run is incremental and should be executed on a fresh test DB cloned from the recovered snapshot unless noted.

### Run 0: Baseline Reproduction (Control)
- [ ] Execute baseline SQL metrics script.
- [ ] Confirm baseline metrics match known snapshot values.

Pass criteria:
- [ ] Baseline report generated and versioned.

Expected DB outcome:
- `running_sessions = 140`
- `in_progress_tasks = 0`
- `running_sessions_with_non_in_progress_task = 140`
- `task_assigned_events = 747`, `distinct_assigned_tasks = 92`
- `test_task_assign_events = 471`

### Run 1: Session/State Fix Validation
- [ ] Replay a controlled batch of task complete/fail/terminate flows.
- [ ] Run reconciliation scanner once, then after 10 minutes.

Pass criteria:
- [ ] No SQL error from session terminal updates.
- [ ] No orphan running sessions after reconciliation window.

Expected DB outcome (new rows only):
- `new_running_sessions_with_non_in_progress_task = 0`
- Terminal sessions have populated terminal metadata (or explicit output/error columns if migration chosen).

### Run 2: Retry Unification Validation
- [ ] Inject failures through each known path (spawn fail early, stuck handler, Telegram retry, explicit fail API).
- [ ] Verify single increment per real attempt.

Pass criteria:
- [ ] Retry count changes exactly once per failed attempt.
- [ ] No task exceeds max retry policy unless manually overridden by explicit admin action.

Expected DB outcome (new rows only):
- `MAX(retry_count)` does not grow beyond policy ceiling from duplicate increments.
- Share of `task_retry_attempts.error='Unknown error'` drops below 20% for new attempts.

### Run 3: Single-Authority Runtime Validation
- [ ] Start in event mode and assert legacy tick loop not started.
- [ ] Start in legacy mode and assert event scanners/services not started.
- [ ] Exercise API pause/resume/trigger in both modes.

Pass criteria:
- [ ] Only one mode emits scheduler lifecycle events for a given process.
- [ ] No dual assignment stream under load.

Expected DB outcome:
- Event stream reflects one active authority path only.
- Assignment event rate normalizes (no repeated 24/min burst pattern under equivalent load).

### Run 4: Test-Task Gating Validation
- [ ] Seed mixed workload (test + non-test pending tasks).
- [ ] Run assignment for 15 minutes in both modes.

Pass criteria:
- [ ] Production assignment ignores test-like tasks unless explicitly enabled.

Expected DB outcome:
- `new_test_task_assign_events = 0` (default mode)
- Non-test task throughput increases vs baseline scenario.

### Run 5: Schema/Command Reliability Validation
- [ ] Execute Telegram commands touching `system_state`, logs, wave, retry, stop/start.
- [ ] Verify no command-level SQL runtime errors.

Pass criteria:
- [ ] All targeted commands return successful responses and produce expected state transitions.

Expected DB outcome:
- `system_state` rows created/removed as commanded.
- log retrieval reads from valid source table.

### Run 6: Integrity + Soak (60-120 minutes)
- [ ] Run orchestrator continuously with moderate load.
- [ ] Periodically run `PRAGMA quick_check` and key health queries.

Pass criteria:
- [ ] No `database disk image is malformed` events.
- [ ] No uncontrolled retry/assignment amplification.

Expected DB outcome:
- `new_system_error_malformed = 0`
- `new_system_recovery` events only for legitimate recoveries, not repetitive loops.
- Session/task consistency remains stable over soak window.

### Run 7: Security Verification
- [ ] Confirm source tree contains no Telegram token literals.
- [ ] Validate bots with rotated credentials from environment.

Pass criteria:
- [ ] Secret scan clean for bot token patterns.
- [ ] Notifications still functional.

Expected DB outcome:
- Telegram messages continue to be inserted with valid linkage context where applicable.

## SQL Metrics Pack (for every run)
Use this pack after each run to produce comparable metrics:

- Session/task sync:
  - running sessions
  - in-progress tasks
  - running sessions attached to non-in-progress tasks
- Retry behavior:
  - max retry count
  - count of tasks retry_count >= policy
  - retry attempt error quality (`Unknown error` ratio)
- Assignment churn:
  - total `task:assigned`
  - distinct assigned tasks
  - assignments per task
  - peak assignments per minute
- Test-task pressure:
  - assignment events targeting test-like tasks
- Observability quality:
  - payload coverage ratio
  - cron/scanner health records present
- Telegram correlation:
  - null rates for `task_id`, `session_id`

### Metrics SQL (copy/paste)
```sql
SELECT COUNT(*) AS running_sessions FROM agent_sessions WHERE status='running';
SELECT COUNT(*) AS in_progress_tasks FROM tasks WHERE status='in_progress';
SELECT COUNT(*) AS running_sessions_with_non_in_progress_task
FROM agent_sessions s
JOIN tasks t ON t.id=s.task_id
WHERE s.status='running' AND COALESCE(t.status,'')<>'in_progress';

SELECT MAX(retry_count) AS max_retry_count FROM tasks;
SELECT COUNT(*) AS tasks_retry_ge_policy FROM tasks WHERE retry_count>=5;
SELECT
  COUNT(*) AS retry_rows,
  SUM(CASE WHEN error='Unknown error' THEN 1 ELSE 0 END) AS unknown_error_rows
FROM task_retry_attempts;

SELECT COUNT(*) AS assigned_events
FROM observability_events
WHERE event_type='task:assigned';
SELECT COUNT(DISTINCT task_id) AS distinct_assigned_tasks
FROM observability_events
WHERE event_type='task:assigned';
SELECT
  strftime('%Y-%m-%d %H:%M', timestamp) AS minute_bucket,
  COUNT(*) AS assigned_per_minute
FROM observability_events
WHERE event_type='task:assigned'
GROUP BY minute_bucket
ORDER BY assigned_per_minute DESC
LIMIT 1;

SELECT COUNT(*) AS test_task_assign_events
FROM observability_events e
JOIN tasks t ON t.id=e.task_id
WHERE e.event_type='task:assigned'
  AND (
    t.category='test'
    OR lower(COALESCE(t.display_id,'')) LIKE 'test_%'
    OR lower(COALESCE(t.display_id,'')) LIKE 'concurrent_%'
  );

SELECT
  SUM(CASE WHEN payload IS NOT NULL AND trim(payload)<>'' THEN 1 ELSE 0 END) AS events_with_payload,
  COUNT(*) AS total_events
FROM observability_events;
SELECT COUNT(*) AS cron_ticks_count FROM cron_ticks;
SELECT COUNT(*) AS pipeline_events_count FROM pipeline_events;
SELECT COUNT(*) AS iteration_logs_count FROM iteration_logs;

SELECT
  COUNT(*) AS telegram_total,
  SUM(CASE WHEN task_id IS NULL THEN 1 ELSE 0 END) AS telegram_task_null,
  SUM(CASE WHEN session_id IS NULL THEN 1 ELSE 0 END) AS telegram_session_null
FROM telegram_messages;
```

## Evidence Template Per Run (Required)
- [ ] Run ID/date/time.
- [ ] Git commit SHA(s).
- [ ] Runtime mode (`event` or `legacy`) and process identifier.
- [ ] SQL metric results (before/after).
- [ ] Pass/fail by criteria.
- [ ] Regressions found + rollback decision.

## Rollout Strategy
- [ ] Stage in local snapshot clone first.
- [ ] Promote to canary runtime (single process only).
- [ ] Monitor 1-2 hour soak.
- [ ] Promote to full runtime after green soak.

Rollback triggers:
- New malformed DB errors.
- Assignment bursts >= baseline peak pattern.
- Retry count runaway reappears.
- Telegram control path regressions affecting stop/start safety.

## Deliverables
- [ ] Code patches for phases above.
- [ ] Migration(s) for schema drift and missing tables.
- [ ] `metrics.sql` and `runbook.md` for repeatable validation.
- [ ] Post-fix report comparing Run 0 baseline to Run 6 soak outcomes.

## Non-Goals (To Avoid Scope Creep)
- Reconstructing perfect historical data from malformed periods.
- Full architecture rewrite from dual-mode to single-mode runtime design.
- Reworking unrelated agent behavior not tied to retry/state/assignment integrity.
