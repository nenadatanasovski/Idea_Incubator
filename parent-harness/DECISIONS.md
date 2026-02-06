# Decisions

Approved architecture decisions for Parent Harness.

## D1: Telegram Channels
- `@vibe-critical` - Errors and human-needed alerts
- `@vibe-orchestrator` - Orchestrator status
- `@vibe-build` - Build Agent activity
- `@vibe-spec` - Spec Agent activity
- `@vibe-qa` - QA Agent activity
- `@vibe-task` - Task Agent activity
- `@vibe-sia` - SIA/Ideation activity
- `@vibe-research` - Research Agent activity
- `@vibe-evaluator` - Evaluator Agent activity
- `@vibe-decomposition` - Decomposition Agent activity
- `@vibe-validation` - Validation Agent activity

## D2: Task Database
- Database is single source of truth
- Agents can create/modify tasks
- Use Vibe's existing task schema as starting point

## D3: Deployment
- Docker Compose
- Designed for VPS migration later

## D4: Folder Location
- `parent-harness/` in project root

## D5: Inter-Agent Communication
- SQLite message bus
- Orchestrator coordinates (agents don't talk directly)

## D6: Human Approval Gates
- **Needs Human:** Database migrations, API changes, deployments
- **Auto-Approved:** Everything else (QA validates)

## D7: Git Workflow
- `dev` branch for all agent work
- Human reviews and merges to `main`

## D8: Budget
- No limits
- Agents run until work is done

## D9: Stuck Detection
- QA Agent checks every 15 minutes
- Analyzes CLI output for progress
- No automatic timeout pause
- QA decides if genuinely stuck
