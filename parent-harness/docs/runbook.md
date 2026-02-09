# Harness Recovery Runbook

Date: 2026-02-09
Scope: `parent-harness/orchestrator`, `parent-harness/database`, runtime DB in `parent-harness/data`

## Canonical Database Path
- Default runtime DB path: `parent-harness/data/harness.db`
- Override only via `HARNESS_DB_PATH`
- Safety guard: startup fails closed when `harness.db` is missing but `harness.db-wal`/`harness.db-shm` exists

## Mode Contract
- `HARNESS_RUNTIME_MODE=event` enables event system only
- `HARNESS_RUNTIME_MODE=legacy` enables legacy tick loop only
- `HARNESS_EVENT_SYSTEM=true/false` is still accepted as a compatibility fallback
- API pause/resume/trigger endpoints are now blocked in event mode to prevent dual authority

## Security Contract
- Telegram bot tokens are env-only; startup fails if required env vars are missing
- Required env vars:
  - `TELEGRAM_ADMIN_CHAT_ID`
  - `TELEGRAM_BOT_SYSTEM`
  - `TELEGRAM_BOT_MONITOR`
  - `TELEGRAM_BOT_ORCHESTRATOR`
  - `TELEGRAM_BOT_BUILD`
  - `TELEGRAM_BOT_SPEC`
  - `TELEGRAM_BOT_VALIDATION`
  - `TELEGRAM_BOT_SIA`
  - `TELEGRAM_BOT_PLANNING`
  - `TELEGRAM_BOT_CLARIFICATION`
  - `TELEGRAM_HUMAN_SIM_BOT_TOKEN`

## Integrity and Maintenance
- Startup executes `PRAGMA quick_check`
- On integrity failure:
  - sets `system_state.spawning_paused=true`
  - sets `system_state.db_integrity_error=<reason>`
  - startup aborts
- Periodic maintenance every 30 minutes:
  - `quick_check`
  - `wal_checkpoint(TRUNCATE)`
  - backup copy to `parent-harness/data/backups/`

## Validation Sequence
1. Snapshot current runtime data:
   - `parent-harness/scripts/snapshot-harness-data.sh`
2. Clone/recover DB snapshot into `parent-harness/data/harness.db`
3. Start server in target mode (`event` or `legacy`)
4. Execute run scenario
5. Run SQL pack:
   - `sqlite3 parent-harness/data/harness.db < parent-harness/docs/metrics.sql`
6. Capture evidence:
   - mode + PID
   - commit SHA
   - before/after metrics
   - pass/fail decisions
   - rollback decision if needed

## Key Runtime Flags
- `system_state.orchestrator_paused=true` pauses legacy tick loop
- `system_state.spawning_paused=true` pauses assignment/spawn paths in both modes
