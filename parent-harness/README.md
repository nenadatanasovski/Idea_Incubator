# Parent Harness

External orchestration system for Vibe's AI agents. Runs OUTSIDE the Vibe platform to test and build it.

## What Is This?

Copies of Vibe's agents (Build, Spec, QA, etc.) running on a separate server. They work on Vibe itself — like a mechanic using their own tools to fix their own workshop.

## Quick Start

```bash
cd parent-harness
docker-compose up -d
open http://localhost:3333
```

## Documentation

| Doc | Description |
|-----|-------------|
| [DECISIONS.md](./DECISIONS.md) | Approved architecture decisions |
| [docs/FRONTEND.md](./docs/FRONTEND.md) | Dashboard UI specification |
| [docs/BACKEND.md](./docs/BACKEND.md) | API and orchestrator spec |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Database schema |
| [docs/AGENTS.md](./docs/AGENTS.md) | Agent definitions |
| [docs/PHASES.md](./docs/PHASES.md) | Build order and phases |
| [docs/CRITICAL_GAPS.md](./docs/CRITICAL_GAPS.md) | Missing pieces analysis |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PARENT HARNESS SERVER                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Orchestrator │  │   REST API   │  │  WebSocket   │          │
│  │  (60s cron)  │  │  :3333/api   │  │  :3333/ws    │          │
│  └──────┬───────┘  └──────────────┘  └──────────────┘          │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   SQLite DB  │  │ Telegram Bot │  │Agent Spawner │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        VIBE CODEBASE                            │
│                /home/user/Documents/Idea_Incubator              │
│                                                                 │
│  Agents read/write files, run tests, make commits               │
└─────────────────────────────────────────────────────────────────┘
```

## Key Concepts

- **Wave:** Group of tasks that can run in parallel
- **Lane:** Category swimlane (database, api, ui, tests)
- **Session:** One agent working on one task
- **Iteration:** One loop/attempt within a session
- **QA Validation:** Every iteration must be validated

## Agents

| Agent | Model | Channel |
|-------|-------|---------|
| Orchestrator | Haiku | @vibe-orchestrator |
| Build Agent | Opus | @vibe-build |
| Spec Agent | Opus | @vibe-spec |
| QA Agent | Opus | @vibe-qa |
| Task Agent | Sonnet | @vibe-task |
| SIA | Opus | @vibe-sia |
| Clarification Agent | Sonnet | @vibe-clarification |
| Human Sim Agent | Sonnet | @vibe-human-sim |

## Files

```
parent-harness/
├── README.md              # This file
├── DECISIONS.md           # Architecture decisions
├── docker-compose.yml     # Container config
├── .env.example           # Environment template
├── docs/
│   ├── FRONTEND.md        # UI spec
│   ├── BACKEND.md         # API spec
│   ├── DATA_MODEL.md      # Database spec
│   ├── AGENTS.md          # Agent definitions
│   ├── PHASES.md          # Build phases
│   └── CRITICAL_GAPS.md   # Missing pieces
├── database/
│   └── schema.sql         # Full DB schema
├── snippets/
│   └── websocket-events.ts
├── orchestrator/          # Backend (to build)
├── dashboard/             # Frontend (to build)
└── data/                  # Runtime data
```

## Build Order

1. Frontend Shell (static UI)
2. Data Model (database)
3. Backend API
4. Connect Frontend ↔ API
5. WebSocket
6. Telegram Bot
7. Orchestrator Loop
8. Agent Spawner
9. QA Validation
10. Wave Execution

See [docs/PHASES.md](./docs/PHASES.md) for details.
