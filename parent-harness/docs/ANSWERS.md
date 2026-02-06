# Validation Answers

Ned's answers to the 35 validation questions (2026-02-06).

## Frontend

| Q | Answer | Implication |
|---|--------|-------------|
| F1 | All 3 (monitoring, intervention, debugging) | Need versatile dashboard with multiple views |
| F2 | No mobile (agent handles via Telegram) | Desktop-optimized, no responsive needed |
| F3 | Just Ned | Skip auth, simpler state management |
| F4 | Notification tab at top left | Add notification center component |
| F5 | Last 2 weeks | Prune older data, optimize for 2-week window |

## Backend

| Q | Answer | Implication |
|---|--------|-------------|
| B1 | A - Same machine as harness | Direct process spawning, shared filesystem |
| B2 | A - Direct filesystem | No git clone overhead, fast file access |
| B3 | No limit | Spawn as many agents as needed |
| B4 | Best for continuous ops | Resume in-progress if process alive, else reassign |
| B5 | Trust Anthropic | No local rate limiting needed |
| B6 | All tests, use Vibe's logic | Port test execution logic from Vibe |

## Data Model

| Q | Answer | Implication |
|---|--------|-------------|
| D1 | A - Own SQLite | Isolated database in parent-harness/ |
| D2 | Completely separate | No sync needed, independent task pools |
| D3 | A - Keep everything | Full transcript retention |
| D4 | 30 days | Prune memories older than 30 days |
| D5 | No sensitive data | Store as-is, no redaction |
| D6 | Best for continuous ops | Auto-migrate on startup |

## Use Cases

| Q | Answer | Implication |
|---|--------|-------------|
| U1 | E - All entry points | Telegram bot, dashboard UI, API, pull from queues |
| U2 | Only when agents stuck or need permissions | Minimal human involvement |
| U3 | C - Both Telegram and Dashboard | Dual-channel clarification |
| U4 | C + D - Configurable + nightly batch | Per-task config, plus nightly full run |
| U5 | A - Auto-run CI, notify | CI integration with Telegram notification |
| U6 | Best for continuous ops | Auto-revert on CI failure, manual for complex |

## Critical Gaps

| Q | Answer | Implication |
|---|--------|-------------|
| G1 | Best for continuous ops | Detect cycles, break with topological sort |
| G2 | C then B - SIA arbitrates, escalate if not fixed | SIA as first responder, then human |
| G3 | C - Human approval after N subtasks | Limit subtask depth, require approval |
| G4 | A + B - Mark blocked + research tries | Research Agent attempts, blocks if fails |
| G5 | All - CI + QA + Human Sim | Multiple safety nets for breaking changes |
| G6 | Agents are classes with N instances | Can spawn multiple Build Agents, etc. |
| G7 | C + log changes | Autonomous harness modification with audit log |

## Operations

| Q | Answer | Implication |
|---|--------|-------------|
| O1 | A - Local machine first | Start development locally |
| O2 | A - 24/7 | Need process manager, auto-restart |
| O3 | A - SQLite file backup | Simple backup strategy |
| O4 | Two weeks | Rotate logs every 2 weeks |
| O5 | D - Telegram is enough | No external monitoring needed |
| O6 | Best for continuous ops | Git pull + graceful restart |

## Integration

| Q | Answer | Implication |
|---|--------|-------------|
| I1 | No - only browser UI agents | Human Sim uses browser, others use CLI |
| I2 | D - Harness CONTROLS Vibe's agents | Meta-level orchestration |
| I3 | Task-level via browser/DB | Agents create test data as needed |
| I4 | A - Always update docs | Doc updates required with code changes |
| I5 | All criteria | Full autonomous loop as success |

## NEW: Planning Agent

**Critical addition missed in original plan!**

The Planning Agent:
- Runs on cron schedule
- Evaluates project state continuously
- Creates new tasks/features/bugs to improve Vibe
- Has "soul vision" for the platform
- Analyzes CLI logs and user's vision
- Proactively identifies improvements

This is the **strategic brain** of the harness.
