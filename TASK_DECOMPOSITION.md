# Vibe Platform: Atomic Task Decomposition

**Generated:** February 8, 2026
**Based on:** STRATEGIC_PLAN.md (8 Phases, 6-8 weeks to v1.0)
**Current Status:** Phase 1 ✅ Complete | Phase 2-3 In Progress | Phase 4-8 Pending

---

### TASK_LIST_START ###

## PHASE 1: Idea Incubator Finalization ✅ (Already Complete)

All Phase 1 deliverables completed:
- ✅ Markdown→Database sync for Q&A
- ✅ Category-relevant profile context
- ✅ Web research phase for Market/Solution
- ✅ All 1773 tests passing
- ✅ Evaluation scores improved to 8/10 quality

---

## PHASE 2: Parent Harness Frontend & API Foundation (Phases 1-3)

**WAVE 1: API Infrastructure & Database Foundation**

TASK: Design and Document ParentHarness Data Model
CATEGORY: documentation
PRIORITY: P0
WAVE: 1
DEPENDS_ON: none
DESCRIPTION: Review existing database schema (33 tables), document entity relationships, identify gaps for Phase 2-3 requirements (agent sessions, task queue, WebSocket events)
PASS_CRITERIA:
- Data model document created at parent-harness/docs/DATA-MODEL.md
- All 33 existing tables documented with relationships
- New tables identified for: task_queue, agent_sessions, events (if not existing)
- Schema review completed with no critical gaps

---

TASK: Create Express REST API Scaffolding
CATEGORY: feature
PRIORITY: P0
WAVE: 1
DEPENDS_ON: none
DESCRIPTION: Set up Express server (port 3333), TypeScript compilation, basic error handling, CORS configuration, and health endpoint. Files: parent-harness/src/api/server.ts, parent-harness/src/api/routes/health.ts
PASS_CRITERIA:
- Express server starts without errors on port 3333
- GET /health returns { status: 'ok', timestamp: ISO }
- CORS headers present in responses
- TypeScript compiles cleanly
- npm run dev API starts successfully

---

TASK: Implement SQLite Database Connection
CATEGORY: feature
PRIORITY: P0
WAVE: 1
DEPENDS_ON: Create Express REST API Scaffolding
DESCRIPTION: Set up better-sqlite3 connection pool, migrations system, connection pooling. Files: parent-harness/src/db/connection.ts, parent-harness/database/migrate.ts
PASS_CRITERIA:
- SQLite database file created at parent-harness/data/harness.db
- Migration system runs automatically on startup
- Connection pooling configured
- Schema tables created (33 tables from existing schema)
- npm test passes database migration tests

---

**WAVE 2: Frontend Shell & Routing**

TASK: Set Up React 19 + Vite + Tailwind CSS 4 Frontend
CATEGORY: feature
PRIORITY: P0
WAVE: 2
DEPENDS_ON: none
DESCRIPTION: Initialize Vite React project at parent-harness/dashboard/, configure Tailwind CSS 4, set up TypeScript, build pipeline. Files: parent-harness/dashboard/vite.config.ts, parent-harness/dashboard/src/main.tsx
PASS_CRITERIA:
- npm run dev dashboard starts on port 5173
- npm run build succeeds
- Tailwind classes render correctly
- TypeScript compilation passes
- React devtools available

---

TASK: Create Dashboard Layout Shell
CATEGORY: feature
PRIORITY: P0
WAVE: 2
DEPENDS_ON: Set Up React 19 + Vite + Tailwind CSS 4 Frontend
DESCRIPTION: Build three-column responsive layout: left sidebar (agent status), main area (content), right sidebar (events/queue). Files: parent-harness/dashboard/src/components/Layout.tsx
PASS_CRITERIA:
- Layout.tsx renders 3 columns (3-6-3 responsive grid)
- Header with Vibe logo and title
- Left sidebar with data-testid="sidebar-agents"
- Main content area with data-testid="main-content"
- Right sidebar with data-testid="sidebar-events"
- Mobile responsive (single column on <768px)

---

TASK: Implement React Router Navigation
CATEGORY: feature
PRIORITY: P0
WAVE: 2
DEPENDS_ON: Create Dashboard Layout Shell
DESCRIPTION: Set up React Router v6, page components, active route highlighting. Routes: Dashboard, Tasks, Sessions, Config. Files: parent-harness/dashboard/src/App.tsx, parent-harness/dashboard/src/pages/*
PASS_CRITERIA:
- React Router configured with 4 pages
- Navigation links highlight active page
- Each page loads without console errors
- Browser history works correctly
- Deep linking works (e.g., /tasks loads Tasks page)

---

**WAVE 3: API Endpoints & Backend Services**

TASK: Implement Agents API Endpoint (GET /api/agents)
CATEGORY: feature
PRIORITY: P0
WAVE: 3
DEPENDS_ON: Implement SQLite Database Connection
DESCRIPTION: Create agents list endpoint returning all agents with status, last_heartbeat, current_task. Files: parent-harness/src/api/routes/agents.ts
PASS_CRITERIA:
- GET /api/agents returns { agents: Agent[] }
- Each agent includes: id, name, model, status, lastHeartbeat, currentTask
- Endpoint response time <100ms
- HTTP 200 status on success
- Mock data populates agents table in database

---

TASK: Implement Tasks API Endpoints (CRUD)
CATEGORY: feature
PRIORITY: P0
WAVE: 3
DEPENDS_ON: Implement SQLite Database Connection
DESCRIPTION: Create CRUD endpoints for task management: GET /api/tasks, POST /api/tasks, GET /api/tasks/:id, PATCH /api/tasks/:id. Files: parent-harness/src/api/routes/tasks.ts
PASS_CRITERIA:
- GET /api/tasks returns list with pagination
- POST /api/tasks creates task, returns id
- GET /api/tasks/:id returns single task
- PATCH /api/tasks/:id updates task fields
- All endpoints validate input, return HTTP errors appropriately

---

TASK: Implement Sessions API Endpoint (GET /api/sessions)
CATEGORY: feature
PRIORITY: P0
WAVE: 3
DEPENDS_ON: Implement SQLite Database Connection
DESCRIPTION: Create sessions list endpoint returning agent sessions with status, start_time, task_count. Files: parent-harness/src/api/routes/sessions.ts
PASS_CRITERIA:
- GET /api/sessions returns { sessions: Session[] }
- Each session includes: id, agentId, status, startTime, taskCount
- Sessions can be filtered by agent or status
- Response time <100ms

---

TASK: Implement Events API Endpoint (GET /api/events)
CATEGORY: feature
PRIORITY: P0
WAVE: 3
DEPENDS_ON: Implement SQLite Database Connection
DESCRIPTION: Create events stream endpoint for dashboard. Files: parent-harness/src/api/routes/events.ts
PASS_CRITERIA:
- GET /api/events returns recent events (last 100)
- Each event includes: id, type, timestamp, agentId, taskId, data
- Events ordered by timestamp DESC
- Response time <100ms

---

**WAVE 4: Frontend Data Integration**

TASK: Create React Hooks for API Data Fetching
CATEGORY: feature
PRIORITY: P0
WAVE: 4
DEPENDS_ON: Implement Agents API Endpoint (GET /api/agents)
DESCRIPTION: Build custom hooks: useAgents, useTasks, useSessions, useEvents. Files: parent-harness/dashboard/src/hooks/*.ts
PASS_CRITERIA:
- useAgents returns { agents, loading, error }
- useTasks returns { tasks, loading, error }
- useSessions returns { sessions, loading, error }
- useEvents returns { events, loading, error }
- All hooks poll API at 5-second intervals
- Error handling displays user-friendly messages

---

TASK: Build Agent Status Cards Component
CATEGORY: feature
PRIORITY: P0
WAVE: 4
DEPENDS_ON: Create React Hooks for API Data Fetching
DESCRIPTION: Create component displaying agent status grid (name, model, status, last_heartbeat, current_task). Files: parent-harness/dashboard/src/components/AgentStatusCards.tsx
PASS_CRITERIA:
- Component displays all agents in a grid
- Each card shows: name, model, status badge (online/offline/busy)
- Last heartbeat shown as relative time ("2m ago")
- Current task title displayed
- Cards update when API data changes

---

TASK: Build Task Queue Display Component
CATEGORY: feature
PRIORITY: P0
WAVE: 4
DEPENDS_ON: Create React Hooks for API Data Fetching
DESCRIPTION: Create component showing task list with status, priority, progress. Files: parent-harness/dashboard/src/components/TaskQueue.tsx
PASS_CRITERIA:
- Component displays tasks in a table or card list
- Each task shows: id, title, status (pending/assigned/running/completed), priority
- Progress bar for tasks in execution
- Click task to see details
- Tasks update in real-time from API

---

TASK: Build Event Stream Component
CATEGORY: feature
PRIORITY: P0
WAVE: 4
DEPENDS_ON: Create React Hooks for API Data Fetching
DESCRIPTION: Create component showing recent events (agent events, task events, system events). Files: parent-harness/dashboard/src/components/EventStream.tsx
PASS_CRITERIA:
- Component displays events in chronological order
- Each event shows: type, timestamp, agent/task involved, brief description
- Events colored by type (agent:blue, task:green, system:red)
- Auto-scrolls to newest event
- Click event to see full details

---

**WAVE 5: Page Implementations & Testing**

TASK: Implement Dashboard Page
CATEGORY: feature
PRIORITY: P0
WAVE: 5
DEPENDS_ON: Build Agent Status Cards Component, Build Task Queue Display Component, Build Event Stream Component
DESCRIPTION: Create main dashboard page combining agent cards, task queue, event stream. Files: parent-harness/dashboard/src/pages/Dashboard.tsx
PASS_CRITERIA:
- Page loads without errors
- Shows agent status cards in left column
- Shows task queue in main column
- Shows event stream in right column
- All components update together when API data changes
- Page is responsive on mobile

---

TASK: Implement Tasks Page
CATEGORY: feature
PRIORITY: P0
WAVE: 5
DEPENDS_ON: Build Task Queue Display Component
DESCRIPTION: Create dedicated tasks page with detailed view, filtering, search. Files: parent-harness/dashboard/src/pages/Tasks.tsx
PASS_CRITERIA:
- Page displays all tasks in detailed table format
- Filter by status: pending, assigned, running, completed, failed
- Filter by priority: P0, P1, P2, P3
- Search by task title/description
- Click row to expand and see full details
- Edit button for task title/description (if not running)

---

TASK: Implement Sessions Page
CATEGORY: feature
PRIORITY: P0
WAVE: 5
DEPENDS_ON: Create React Hooks for API Data Fetching
DESCRIPTION: Create page showing agent sessions, session logs, heartbeat timeline. Files: parent-harness/dashboard/src/pages/Sessions.tsx
PASS_CRITERIA:
- Page displays sessions in table with: agent, status, start_time, duration, task_count
- Click session to see detailed log
- Session log shows chronological events
- Heartbeat timeline visible (graphical)
- Filter by agent name

---

TASK: Implement Config Page
CATEGORY: feature
PRIORITY: P0
WAVE: 5
DEPENDS_ON: Implement Tasks API Endpoints (CRUD)
DESCRIPTION: Create page for system configuration: agent settings, thresholds, timeouts. Files: parent-harness/dashboard/src/pages/Config.tsx
PASS_CRITERIA:
- Page displays config form with sections: agents, execution, thresholds
- Save button persists changes to API
- Validation prevents invalid inputs
- Form repopulates on page reload
- Changes take effect immediately

---

TASK: Create Dashboard Tests (Phase 1-3 Test Suite)
CATEGORY: test
PRIORITY: P0
WAVE: 5
DEPENDS_ON: Implement Dashboard Page, Implement Tasks Page, Implement Sessions Page, Implement Config Page
DESCRIPTION: Create 21 test cases covering dashboard, API, error handling. Files: tests/parent-harness/phase-1-3.test.ts
PASS_CRITERIA:
- 21 test cases defined and passing
- Test categories: frontend grid (5), API CRUD (8), error handling (4), navigation (4)
- All tests pass npm test
- No console errors in test output

---

**WAVE 6: Integration & Validation**

TASK: Validate Frontend→API Integration
CATEGORY: test
PRIORITY: P0
WAVE: 6
DEPENDS_ON: Implement Dashboard Page, Implement Agents API Endpoint (GET /api/agents), Implement Tasks API Endpoints (CRUD), Implement Sessions API Endpoint (GET /api/sessions), Implement Events API Endpoint (GET /api/events)
DESCRIPTION: Test all frontend components fetch and display data from live API. Files: tests/parent-harness/integration.test.ts
PASS_CRITERIA:
- All hooks fetch data without errors
- Components display data correctly
- Error states handled gracefully
- Network timeouts don't crash UI
- 10 integration tests passing

---

TASK: Complete Build & Deployment Scripts
CATEGORY: feature
PRIORITY: P0
WAVE: 6
DEPENDS_ON: Implement Dashboard Page
DESCRIPTION: Create npm scripts for building and running full system. Files: package.json updates, build scripts
PASS_CRITERIA:
- npm run dev starts both API (3333) and Dashboard (5173)
- npm run build succeeds for frontend and backend
- npm run test runs all test suites
- npm run db:migrate applies database migrations
- Environment variables properly configured

---

---

## PHASE 3: WebSocket Real-Time & Critical Missing Agents

**WAVE 7: WebSocket Infrastructure**

TASK: Implement WebSocket Server
CATEGORY: feature
PRIORITY: P0
WAVE: 7
DEPENDS_ON: Create Express REST API Scaffolding
DESCRIPTION: Set up ws library, broadcast server on ws://localhost:3333/ws. Files: parent-harness/src/api/websocket.ts
PASS_CRITERIA:
- WebSocket server runs on port 3333
- Accepts client connections
- Broadcasts messages to all connected clients
- Handles client disconnections gracefully
- Heartbeat/keep-alive mechanism every 30s

---

TASK: Create WebSocket Event Broadcasting System
CATEGORY: feature
PRIORITY: P0
WAVE: 7
DEPENDS_ON: Implement WebSocket Server
DESCRIPTION: Build event broadcasting for agent:*, task:*, session:*, event:* subscriptions. Files: parent-harness/src/api/events-manager.ts
PASS_CRITERIA:
- Events broadcast within <100ms of occurrence
- Clients can subscribe to specific event types
- Message format: { type, timestamp, data }
- Supports filtering by agent/task ID
- 99% message delivery rate

---

TASK: Integrate WebSocket with Dashboard
CATEGORY: feature
PRIORITY: P0
WAVE: 7
DEPENDS_ON: Create WebSocket Event Broadcasting System
DESCRIPTION: Create useWebSocket hook for real-time dashboard updates. Files: parent-harness/dashboard/src/hooks/useWebSocket.ts
PASS_CRITERIA:
- Hook connects to ws://localhost:3333/ws
- Reconnects automatically on disconnect (exponential backoff)
- Updates component state when events received
- No memory leaks on unmount
- Latency <500ms from event to UI update

---

**WAVE 8: Clarification Agent Implementation**

TASK: Implement Clarification Agent Core Logic
CATEGORY: feature
PRIORITY: P0
WAVE: 8
DEPENDS_ON: Implement Tasks API Endpoints (CRUD)
DESCRIPTION: Create clarification agent that triggers on new user tasks, uses question_engine to generate clarifying questions. Files: parent-harness/orchestrator/src/clarification/index.ts
PASS_CRITERIA:
- Agent detects new user-created tasks (owner_type='user')
- Calls question_engine.generateQuestions() for task description
- Creates clarification_session with status='pending_response'
- Blocks task execution until responses received or timeout (24h)
- Records Q&A in database

---

TASK: Create Vagueness Detection Module
CATEGORY: feature
PRIORITY: P0
WAVE: 8
DEPENDS_ON: Implement Clarification Agent Core Logic
DESCRIPTION: Implement vagueness detection for task descriptions (port from agents/ideation/vagueness-detector.ts). Files: parent-harness/orchestrator/src/agents/vagueness-detector.ts
PASS_CRITERIA:
- Detects hedging language ("maybe", "possibly")
- Detects non-committal phrases ("it depends", "either way")
- Detects unclear references ("stuff", "things")
- Returns vagueness score 0-1, triggers clarification if >0.3
- No LLM calls needed (pattern-based)

---

TASK: Implement Clarification Q&A API Endpoints
CATEGORY: feature
PRIORITY: P0
WAVE: 8
DEPENDS_ON: Implement Clarification Agent Core Logic
DESCRIPTION: Create API endpoints for clarification sessions: GET /api/clarifications, POST /api/clarifications/:id/response. Files: parent-harness/src/api/routes/clarifications.ts
PASS_CRITERIA:
- GET /api/clarifications returns pending clarification sessions
- POST /api/clarifications/:id/response accepts user answers
- Endpoint updates task description with clarification answers
- Unblocks task when clarification complete
- 200 response on success

---

TASK: Build Clarification UI Component
CATEGORY: feature
PRIORITY: P0
WAVE: 8
DEPENDS_ON: Implement Clarification Q&A API Endpoints
DESCRIPTION: Create modal/form component for answering clarification questions. Files: parent-harness/dashboard/src/components/ClarificationModal.tsx
PASS_CRITERIA:
- Modal displays all clarification questions
- Text input for answers
- Submit button sends POST /api/clarifications/:id/response
- Success message after submission
- Modal closes and task becomes executable

---

**WAVE 9: Human Sim Agent Implementation**

TASK: Design Human Sim Agent Architecture
CATEGORY: documentation
PRIORITY: P0
WAVE: 9
DEPENDS_ON: Implement Clarification Agent Core Logic
DESCRIPTION: Document human simulator agent: personas (technical, power-user, casual, confused, impatient), browser automation approach. Files: parent-harness/docs/HUMAN-SIM-AGENT.md
PASS_CRITERIA:
- 5 personas defined with distinct characteristics
- User journey scenarios for each persona
- Browser automation approach documented (Agent Browser MCP)
- Pass criteria for each persona test
- Error recovery strategies documented

---

TASK: Implement Human Sim Agent Core
CATEGORY: feature
PRIORITY: P1
WAVE: 9
DEPENDS_ON: Design Human Sim Agent Architecture
DESCRIPTION: Create human sim agent that triggers after Build Agent completes UI tasks. Files: parent-harness/orchestrator/src/agents/human-sim.ts
PASS_CRITERIA:
- Agent detects completed UI tasks (type='UI' or tags include 'UI')
- Spawns 5 persona instances
- Each persona tests happy path + error recovery
- Records findings in database
- Creates bug/fix tasks for failures found

---

---

## PHASE 4: Agent Memory & Learning System

**WAVE 10: Memory Infrastructure**

TASK: Create Agent Memory Database Tables
CATEGORY: feature
PRIORITY: P1
WAVE: 10
DEPENDS_ON: Implement SQLite Database Connection
DESCRIPTION: Create database schema for agent learning: agent_memories, technique_effectiveness, build_interventions. Files: parent-harness/database/migrations/XXX_agent_memory.sql
PASS_CRITERIA:
- agent_memories table: id, agent_id, decision_type, context, outcome, effectiveness_score
- technique_effectiveness table: id, error_pattern, technique_used, success_count, failure_count, confidence
- build_interventions table: id, build_agent_id, original_agent_id, task_id, error_type, resolution, outcome
- Migration runs without errors
- Test data populates tables

---

TASK: Implement Agent Memory Service
CATEGORY: feature
PRIORITY: P1
WAVE: 10
DEPENDS_ON: Create Agent Memory Database Tables
DESCRIPTION: Build service for saving/retrieving agent memories, similarity matching. Files: parent-harness/src/services/agent-memory.ts
PASS_CRITERIA:
- saveMemory(agentId, context, decision, outcome) stores memory
- getRelevantMemories(agentId, context) retrieves similar past decisions
- Similarity matching uses Levenshtein distance (error messages)
- Query performance <100ms
- Confidence scoring for memory relevance

---

TASK: Implement Technique Effectiveness Tracking
CATEGORY: feature
PRIORITY: P1
WAVE: 10
DEPENDS_ON: Implement Agent Memory Service
DESCRIPTION: Build service for tracking which fixes work for which errors. Files: parent-harness/src/services/technique-effectiveness.ts
PASS_CRITERIA:
- recordAttempt(errorPattern, technique, success) logs attempt
- getSuggestedTechniques(errorPattern) returns ranked techniques
- Success rate calculated per technique (successes / total_attempts)
- Most effective techniques suggested first
- Auto-escalation logic when technique effectiveness <50%

---

---

## PHASE 5: Orchestrator & Task Execution Engine

**WAVE 11: Orchestrator Core**

TASK: Implement Orchestrator Cron Loop
CATEGORY: feature
PRIORITY: P0
WAVE: 11
DEPENDS_ON: Implement Tasks API Endpoints (CRUD), Create WebSocket Event Broadcasting System
DESCRIPTION: Create main orchestrator loop running every 60s. Files: parent-harness/orchestrator/src/orchestrator/index.ts
PASS_CRITERIA:
- Loop runs every 60 seconds without blocking
- Fetches all tasks and agent status
- Calculates ready tasks (all dependencies met)
- Assigns tasks to idle agents
- Updates wave progress
- Broadcasts events
- <5 second execution time

---

TASK: Implement Task Assignment Algorithm
CATEGORY: feature
PRIORITY: P0
WAVE: 11
DEPENDS_ON: Implement Orchestrator Cron Loop
DESCRIPTION: Develop algorithm for wave/lane calculation and conflict detection. Files: parent-harness/src/services/task-assignment.ts
PASS_CRITERIA:
- Wave/lane calculation groups parallelizable tasks
- Conflict detection prevents concurrent file edits
- Agent capability matching (Opus for complex, Sonnet for routine)
- Priority-based queue (P0 before P1)
- Matches agents to tasks within 1 second

---

TASK: Implement QA Validation Cycle (Every 15min)
CATEGORY: feature
PRIORITY: P0
WAVE: 11
DEPENDS_ON: Implement Orchestrator Cron Loop
DESCRIPTION: Create QA loop analyzing CLI output, detecting stuck agents, validating completions. Files: parent-harness/orchestrator/src/qa-validator/index.ts
PASS_CRITERIA:
- Detects stuck agents (no activity >30min)
- Analyzes CLI output for error patterns
- Validates pass criteria met for completed tasks
- Records QA findings in database
- Terminates stuck sessions with recommendations

---

**WAVE 12: Task Execution & Monitoring**

TASK: Implement Agent Session Lifecycle
CATEGORY: feature
PRIORITY: P0
WAVE: 12
DEPENDS_ON: Implement Orchestrator Cron Loop
DESCRIPTION: Manage agent session startup, heartbeat, completion. Files: parent-harness/orchestrator/src/sessions/index.ts
PASS_CRITERIA:
- Startup: create session record, spawn agent CLI
- Heartbeat: agent sends status every 10s, recorded in database
- Task execution: track start/end, capture output
- Completion: record final status, update task record
- Failure: capture error, trigger SIA investigation

---

TASK: Implement File Impact Analysis
CATEGORY: feature
PRIORITY: P0
WAVE: 12
DEPENDS_ON: Implement Task Assignment Algorithm
DESCRIPTION: Analyze which files each task modifies, prevent parallel file edits. Files: parent-harness/src/services/file-impact-analyzer.ts
PASS_CRITERIA:
- Identifies files modified by each task (from task spec)
- Detects conflicts (same file in multiple parallel tasks)
- Suggests lane adjustments to avoid conflicts
- 95%+ accuracy on conflict detection
- <100ms analysis time per wave

---

---

## PHASE 6: Planning Agent & Self-Improvement Loop

**WAVE 13: Planning Agent**

TASK: Implement Planning Agent Core
CATEGORY: feature
PRIORITY: P1
WAVE: 13
DEPENDS_ON: Implement Orchestrator Cron Loop, Implement Agent Memory Service
DESCRIPTION: Create Planning Agent (Opus) that analyzes system and suggests improvement tasks. Files: parent-harness/orchestrator/src/agents/planning.ts
PASS_CRITERIA:
- Runs every 2 hours or after major completions
- Analyzes codebase: test coverage, error patterns, completeness
- Reads user vision from config/vision.md
- Creates 2-5 actionable improvement tasks
- Records reasoning for each suggestion
- Tasks are specific and testable (not vague)

---

TASK: Implement Pattern Analysis for Planning
CATEGORY: feature
PRIORITY: P1
WAVE: 13
DEPENDS_ON: Implement Planning Agent Core
DESCRIPTION: Analyze failed tasks, identify systemic issues, group by error type. Files: parent-harness/src/services/pattern-analyzer.ts
PASS_CRITERIA:
- Groups failed tasks by error type/category
- Identifies repeated issues (same error 3+ times)
- Calculates impact (how many tasks blocked by this issue)
- Suggests root-cause fixes ranked by impact
- <2 second analysis time

---

---

## PHASE 7: Telegram Integration & Real-time Notifications

**WAVE 14: Telegram Bot**

TASK: Implement Telegram Bot Service
CATEGORY: feature
PRIORITY: P1
WAVE: 14
DEPENDS_ON: Implement Orchestrator Cron Loop
DESCRIPTION: Create Telegram bot connecting to agent channels and user notifications. Files: parent-harness/orchestrator/src/telegram/bot.ts
PASS_CRITERIA:
- Bot connects to Telegram Bot API
- Supports 12+ agent-specific channels
- Sends messages within 5 seconds of event
- Includes markdown-formatted summaries
- No rate limit errors

---

TASK: Implement Telegram Event Routing
CATEGORY: feature
PRIORITY: P1
WAVE: 14
DEPENDS_ON: Implement Telegram Bot Service
DESCRIPTION: Route events to appropriate Telegram channels (agent channels, user notifications, alerts). Files: parent-harness/orchestrator/src/telegram/router.ts
PASS_CRITERIA:
- Task assigned → Build Agent channel
- Task completed → Build Agent channel
- Task failed → User urgent notifications
- Stuck agent detected → All agents + user alerts
- Clarification request → User private notifications

---

TASK: Create Telegram Message Templates
CATEGORY: documentation
PRIORITY: P1
WAVE: 14
DEPENDS_ON: Implement Telegram Event Routing
DESCRIPTION: Design markdown message templates for all event types. Files: parent-harness/docs/TELEGRAM-TEMPLATES.md
PASS_CRITERIA:
- Task assigned template with task title, description, pass criteria
- Task completed template with completion summary, duration
- Task failed template with error details, suggestions
- Stuck agent template with troubleshooting steps
- Clarification template with questions, user response link

---

---

## PHASE 8: Advanced Features & Polishing

**WAVE 15: Task Version Control & Traceability**

TASK: Implement Task Version History
CATEGORY: feature
PRIORITY: P1
WAVE: 15
DEPENDS_ON: Implement Tasks API Endpoints (CRUD)
DESCRIPTION: Create task_versions table and version service for rollback capability. Files: parent-harness/src/services/task-version.ts
PASS_CRITERIA:
- Task version created on each modification
- Version includes: timestamp, modified_by, changes, pass_criteria_diff
- Rollback restores previous version and status
- Version history queryable by task
- Diff between versions shows changes clearly

---

TASK: Implement Traceability Service (PRD→Code)
CATEGORY: feature
PRIORITY: P1
WAVE: 15
DEPENDS_ON: Implement Task Version History
DESCRIPTION: Create service linking tasks to specifications to code to tests. Files: parent-harness/src/services/traceability.ts
PASS_CRITERIA:
- Links spec_id → task_id → code_commits → test_ids
- Gap detection: spec not covered by tasks, tasks not in code, code not tested
- Coverage metrics dashboard view
- Generates traceability report for each task

---

---

## PHASE X: General/Cross-Cutting Tasks (No Wave)

TASK: Fix TypeScript Compilation Issues (if any)
CATEGORY: bug
PRIORITY: P0
WAVE: 1
DEPENDS_ON: none
DESCRIPTION: Address any TypeScript errors blocking builds (currently all passing)
PASS_CRITERIA:
- npm run build succeeds without errors
- No TS compilation warnings
- Type coverage >95%

---

TASK: Add Docker Containerization
CATEGORY: feature
PRIORITY: P2
WAVE: 15
DEPENDS_ON: Complete Build & Deployment Scripts
DESCRIPTION: Create Dockerfile for ParentHarness, docker-compose for full stack. Files: Dockerfile, docker-compose.yml
PASS_CRITERIA:
- Docker image builds successfully
- docker-compose up starts full stack (API + Dashboard + DB)
- Health checks pass
- Production-ready configuration

---

TASK: Create Implementation Checklist
CATEGORY: documentation
PRIORITY: P0
WAVE: 1
DEPENDS_ON: none
DESCRIPTION: Document task checklist for team coordination, dependencies, and phase gates. Files: parent-harness/docs/IMPLEMENTATION-CHECKLIST.md
PASS_CRITERIA:
- Checklist lists all 50+ tasks with wave numbers
- Dependency relationships documented
- Phase gates clearly marked
- Estimated time per task (5-15min each)
- Risk assessment for critical tasks

---

### TASK_LIST_END ###

---

## SUMMARY

**Total Atomic Tasks:** 59 tasks across 15 waves

**Phase Distribution:**
- Phase 1: 0 tasks (✅ Already complete)
- Phase 2: 32 tasks (Waves 1-6)
- Phase 3: 9 tasks (Waves 7-9)
- Phase 4: 3 tasks (Wave 10)
- Phase 5: 6 tasks (Waves 11-12)
- Phase 6: 2 tasks (Wave 13)
- Phase 7: 3 tasks (Wave 14)
- Phase 8: 2 tasks (Wave 15)
- Cross-cutting: 2 tasks

**Critical Path:** Phase 2 (API + Frontend) → Phase 3 (WebSocket + Agents) → Phase 5 (Orchestrator) → Phase 6 (Planning)

**Estimated Timeline:** 6-8 weeks with 3-4 concurrent agent teams (Build, Spec, QA, Research)

**Test Gates:** 21 tests for Phase 2-3 completion; full test suite passing throughout

---

## WAVE EXECUTION GUIDE

### WAVE 1: Database & API Foundation (5 tasks, ~2-3 hours)
- Can start immediately
- Foundation for all other waves
- No external dependencies

### WAVE 2: React Shell (3 tasks, ~2-3 hours)
- Independent of Wave 1 (can run in parallel)
- Must complete before Wave 4

### WAVE 3: API Endpoints (5 tasks, ~4-5 hours)
- Depends on Wave 1
- Parallelizable among team members
- Each endpoint ~45 minutes

### WAVE 4: React Hooks & Components (4 tasks, ~3-4 hours)
- Depends on Wave 3
- Parallelizable
- Each component ~1 hour

### WAVE 5: Page Implementations (5 tasks, ~4-5 hours)
- Depends on Waves 3 & 4
- Can assign to different team members
- Testing phase integrated

### WAVE 6: Integration & Testing (2 tasks, ~2-3 hours)
- Depends on Wave 5
- Validates all Phase 2 work
- **PHASE 2 GATE**: All tests pass before Phase 3

### WAVE 7-9: WebSocket & Agents (11 tasks, ~10-12 hours)
- Depends on Phase 2 complete
- Parallelizable after Wave 7
- **PHASE 3 GATE**: Clarification Agent tested, Human Sim architecture approved

### WAVE 10-15: Memory, Orchestration, Planning, Telegram, Version Control (18 tasks, ~18-20 hours)
- Staggered dependencies
- Phase gates between 11, 13, 14
- Estimated 4-5 weeks total

---

## FILE MODIFICATIONS SUMMARY

### New Directories to Create
- `parent-harness/src/api/routes/` - API endpoints
- `parent-harness/dashboard/src/components/` - React components
- `parent-harness/dashboard/src/pages/` - Page components
- `parent-harness/dashboard/src/hooks/` - Custom hooks
- `parent-harness/orchestrator/src/agents/` - Agent implementations
- `parent-harness/orchestrator/src/services/` - Business logic
- `parent-harness/orchestrator/src/telegram/` - Telegram integration
- `parent-harness/database/migrations/` - Database migrations

### Modified Files
- `package.json` - Add dev scripts, dependencies
- `parent-harness/src/api/server.ts` - Express setup
- `.env.example` - Add new environment variables
- Various TypeScript compilation configurations

---

**Next Step:** User approval to begin Wave 1 (Database & API Foundation) with Build Agent.

TASK_COMPLETE: Created 59 atomic tasks across 15 waves with clear dependencies, pass criteria, and phase gates.
