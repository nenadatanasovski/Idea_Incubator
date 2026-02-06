# Implementation Phases

Build order designed for incremental testing. Updated with gap solutions.

## Phase 1: Frontend Shell (Days 1-2)

**Goal:** Static dashboard that can be tested independently.

**Tasks:**
1. Vite + React + TypeScript setup
2. Tailwind CSS config
3. Three-column layout (header, main grid)
4. AgentStatusCard component (hardcoded data)
5. EventStream component (mock events)
6. TaskCard component (mock tasks)
7. Basic routing (/, /tasks, /sessions)

**Test:** Can view dashboard with fake data.

**Deliverable:** `dashboard/` folder with working static UI.

---

## Phase 2: Data Model (Days 3-4)

**Goal:** Database ready with schema and seed data.

**Tasks:**
1. SQLite database setup
2. Run schema.sql (core tables)
3. Add gap solution tables:
   ```sql
   -- Agent memory (from Gap 3)
   agent_memories (id, agent_id, memory_type, content, task_signature, relevance_score)
   
   -- Technique effectiveness (from Gap 3)
   technique_effectiveness (id, technique, error_pattern, success_count, failure_count)
   
   -- SIA task memory (copy from Vibe)
   sia_task_memory (task_id, task_signature, attempts, techniques_tried, successful_technique)
   
   -- Transcript entries (from Gap 4A)
   transcript_entries (id, timestamp, session_id, entry_type, summary, details, tool_calls)
   
   -- Task versions (from Gap 4B)
   task_versions (id, task_id, version_number, snapshot, changed_by, change_reason)
   
   -- Build interventions (from Gap 4E)
   build_interventions (id, session_id, task_id, intervening_agent, resolution)
   
   -- Human sim results (from Gap 2)
   human_sim_results (id, task_id, persona, test_type, passed, findings, screenshots)
   ```
4. Seed agents table (12 agents now including Clarification + Human Sim)
5. Create views
6. Basic query functions

**Test:** Can query all tables via Node REPL.

**Deliverable:** `data/harness.db` with full schema.

---

## Phase 3: Backend API (Days 5-7)

**Goal:** REST API serving real data.

**Tasks:**
1. Express server setup
2. Core endpoints:
   - `/api/agents` - CRUD
   - `/api/tasks` - CRUD
   - `/api/sessions` - CRUD
   - `/api/iterations` - CRUD
   - `/api/events` - List/filter
3. Gap solution endpoints:
   - `/api/transcripts` - Transcript entries
   - `/api/memories` - Agent memories
   - `/api/techniques` - Technique effectiveness
   - `/api/interventions` - Build interventions
   - `/api/human-sim` - Human sim results
4. Error handling middleware
5. CORS config

**Test:** curl commands return real data.

**Deliverable:** API at `localhost:3333/api`.

---

## Phase 4: Frontend + API (Days 8-9)

**Goal:** Dashboard shows real data.

**Tasks:**
1. useApi hook for data fetching
2. Connect all components to API
3. Add new views:
   - Transcript viewer
   - Memory browser
   - Technique stats
   - Intervention log

**Test:** Dashboard shows database data.

---

## Phase 5: WebSocket (Days 10-11)

**Goal:** Real-time updates.

**Tasks:**
1. WebSocket server setup
2. useHarnessWebSocket hook
3. Event types:
   - Agent status changes
   - Task updates
   - Iteration progress
   - Transcript entries (live)
   - Human sim results (live)
4. Auto-reconnect logic

**Test:** Changes in DB appear in UI instantly.

---

## Phase 6: Telegram Bot (Days 12-13)

**Goal:** Messages to Telegram channels.

**Tasks:**
1. Create Telegram bot via @BotFather
2. Create channels (12 total):
   - @vibe-critical
   - @vibe-orchestrator
   - @vibe-build
   - @vibe-spec
   - @vibe-qa
   - @vibe-task
   - @vibe-sia
   - @vibe-research
   - @vibe-evaluator
   - @vibe-decomposition
   - @vibe-validation
   - @vibe-clarification
   - @vibe-human-sim
3. Bot connection logic
4. Message formatting with emojis

**Test:** API call triggers Telegram message.

---

## Phase 7: Orchestrator Loop (Days 14-16)

**Goal:** Automated task assignment with clarification gate.

**Tasks:**
1. Cron loop (60s interval)
2. **Clarification gate (Gap 1):**
   ```
   New user task → Check clarification_status
   If 'pending' → Spawn Clarification Agent
   If 'complete' → Continue to assignment
   ```
3. Check idle agents
4. Get ready tasks (dependencies met + clarified)
5. Assignment logic
6. Create sessions + iterations
7. Emit events
8. Telegram notifications

**Test:** User task → clarification → assignment → Telegram.

---

## Phase 8: Clarification Agent (Days 17-18)

**Goal:** Proactive question-asking for vague tasks.

**Tasks:**
1. Clarification Agent system prompt
2. Question generation logic (port from Vibe's `question_engine.ts`)
3. Telegram interaction:
   - Bot asks questions in @vibe-clarification
   - User replies
   - Agent processes answers
4. Task enrichment:
   - Update task description
   - Add pass criteria
   - Set clarification_status = 'complete'
5. Timeout handling (24h → proceed with assumptions)

**Test:** Vague task → questions asked → detailed task created.

---

## Phase 9: Agent Spawner (Days 19-21)

**Goal:** Actually run Claude Code instances.

**Tasks:**
1. Claude Code CLI integration
2. Process spawning with config:
   ```typescript
   {
     agentId: string,
     taskId: string,
     model: 'haiku' | 'sonnet' | 'opus',
     systemPrompt: string,
     workingDir: string,
     memory: AgentMemory[]  // Inject relevant memories
   }
   ```
3. **Transcript capture (Gap 4A):**
   - Pipe all output to transcript_entries
   - Parse tool calls
   - Extract skill uses
4. Heartbeat monitoring
5. Graceful termination
6. Error handling

**Test:** Task assigned → Claude Code runs → transcript captured.

---

## Phase 10: Agent Memory System (Days 22-23)

**Goal:** Agents remember and learn from experience.

**Tasks:**
1. Memory creation on task completion:
   ```typescript
   await createMemory({
     agentId: 'build_agent',
     memoryType: 'success_pattern',
     content: 'For migration tasks, always run typecheck before commit',
     taskSignature: hashTask(task)
   });
   ```
2. Memory retrieval before task start:
   ```typescript
   const memories = await getRelevantMemories(agentId, task);
   // Inject into system prompt
   ```
3. Memory decay (reduce relevance over time)
4. **SIA task memory (Gap 3):**
   - Track techniques tried per task
   - Match similar tasks by signature
   - Avoid repeating failed techniques
5. **Technique effectiveness (Gap 3):**
   - Record success/failure per technique
   - Calculate success rates
   - Inform agent choices

**Test:** Agent fails with technique A → tries technique B next time.

---

## Phase 11: QA Validation (Days 24-26)

**Goal:** Every iteration validated + stuck detection.

**Tasks:**
1. QA Agent system prompt
2. Per-iteration validation:
   - TypeScript compiles?
   - Tests pass?
   - No regressions?
   - Lint clean?
   - Pass criteria met?
3. 15-minute audit cycle:
   - Check all active iterations
   - Analyze transcripts for stuck signs
   - Terminate stuck sessions
4. **Build interventions (Gap 4E):**
   - Record when QA/SIA fixes agent's work
   - Track intervening agent
   - Store resolution

**Test:** Agent completes iteration → QA validates → result recorded.

---

## Phase 12: Human Simulation Agent (Days 27-30)

**Goal:** Usability testing with multiple personas.

**Tasks:**
1. Human Sim Agent system prompt
2. **Persona system (Gap 2):**
   ```typescript
   const personas = {
     technical: { techLevel: 'high', patience: 'high', tests: ['cli', 'api', 'errors'] },
     'power-user': { techLevel: 'medium-high', patience: 'medium', tests: ['workflows', 'edge-cases'] },
     casual: { techLevel: 'medium', patience: 'medium', tests: ['happy-path', 'discoverability'] },
     confused: { techLevel: 'low', patience: 'low', tests: ['error-recovery', 'help-text'] },
     impatient: { techLevel: 'any', patience: 'very-low', tests: ['loading', 'feedback'] }
   };
   ```
3. Playwright integration:
   - Navigate UI
   - Click/type simulation
   - Screenshot capture
   - Error detection
4. **Multi-instance spawning:**
   ```typescript
   // Spawn 3 personas in parallel
   await Promise.all([
     spawnHumanSim(taskId, 'technical'),
     spawnHumanSim(taskId, 'casual'),
     spawnHumanSim(taskId, 'confused')
   ]);
   ```
5. Results aggregation:
   - Merge findings from all personas
   - Create fix tasks for issues
   - Update human_sim_results table
6. Telegram reporting to @vibe-human-sim

**Test:** UI task complete → 3 personas test → findings → fix tasks created.

---

## Phase 13: Wave Execution (Days 31-33)

**Goal:** Parallel task execution in waves.

**Tasks:**
1. Wave calculation from dependencies
2. Lane assignment by file patterns
3. Wave lifecycle management
4. Parallel agent spawning (respecting max_parallel)
5. Wave progress tracking
6. UI wave visualization
7. **File impact analysis (Gap 4G):**
   - Predict files touched by task
   - Detect conflicts between parallel tasks

**Test:** Task list → waves calculated → parallel execution → correct order.

---

## Phase 14: Planning Agent (Days 34-36)

**Goal:** Strategic brain that creates improvement tasks.

**Tasks:**
1. Planning Agent system prompt with "soul vision"
2. Project state analyzer:
   - Codebase structure analysis
   - Test coverage metrics
   - Recent failure patterns
   - Completed task history
3. Task creation logic:
   ```typescript
   // Planning Agent creates tasks proactively
   await createTask({
     title: 'Add unit tests for task-agent services',
     description: 'Test coverage dropped below 80%',
     category: 'improvement',
     priority: 'P2',
     created_by: 'planning_agent'
   });
   ```
4. Vision alignment check:
   - Compare current state to user's stated goals
   - Identify gaps between vision and reality
   - Create epics for missing capabilities
5. Cron schedule (every 2 hours)
6. Telegram reporting to @vibe-planning

**Test:** Planning Agent runs → analyzes project → creates improvement tasks.

---

## Phase 15: Self-Improvement Loop (Days 37-39)

**Goal:** System improves from failures.

**Tasks:**
1. Failure pattern detection:
   ```typescript
   // When same error occurs 3+ times
   if (errorCount >= 3) {
     await triggerLearningAnalysis(errorPattern, failedTasks);
   }
   ```
2. Learning analysis:
   - What went wrong?
   - Which technique would help?
   - Should prompt be updated?
3. Technique recommendation:
   - Query technique_effectiveness
   - Suggest highest success-rate technique
4. Prompt improvement proposals:
   - Generate suggested change
   - Log to harness_modifications table
   - Can auto-apply (G7 = C)
5. Harness self-modification:
   - Agents can modify harness code
   - All changes logged for audit
   - Autonomous but traceable

**Test:** Repeated failure → learning triggers → harness improves itself.

---

## Phase 16: Polish (Days 40-43)

**Goal:** Production ready.

**Tasks:**
1. Error boundary components
2. Loading/empty states
3. Full log viewer modal
4. Task/session detail views
5. Filters and search
6. Docker optimization
7. Documentation
8. **Priority escalation:**
   - P0 tasks preempt lower work
   - Critical alerts to @vibe-critical
9. **Acceptance criteria tracking (Gap 4K):**
   - Per-criterion pass/fail
   - Visual progress in UI

---

## Summary

| Phase | Focus | Days | Key Gap Solutions |
|-------|-------|------|-------------------|
| 1 | Frontend Shell | 1-2 | - |
| 2 | Data Model | 3-4 | Memory tables, Transcripts, Interventions |
| 3 | Backend API | 5-7 | Gap solution endpoints |
| 4 | Frontend + API | 8-9 | New views, notification center |
| 5 | WebSocket | 10-11 | Live transcripts |
| 6 | Telegram Bot | 12-13 | 14 channels |
| 7 | Orchestrator | 14-16 | Clarification gate |
| 8 | Clarification Agent | 17-18 | **Gap 1** |
| 9 | Agent Spawner | 19-21 | Transcript capture, multi-instance |
| 10 | Agent Memory | 22-23 | **Gap 3** |
| 11 | QA Validation | 24-26 | Build interventions, SIA arbitration |
| 12 | Human Sim Agent | 27-30 | **Gap 2** (5 personas) |
| 13 | Wave Execution | 31-33 | File impact, unlimited agents |
| 14 | Planning Agent | 34-36 | **Strategic brain** ⭐ NEW |
| 15 | Self-Improvement | 37-39 | Learning loop, harness self-mod |
| 16 | Polish | 40-43 | Priority, Criteria |

**Total:** ~43 days

---

## Build Dependencies

```
Phase 1 (Frontend) ──┐
                     ├──► Phase 4 (Connect)
Phase 2 (Data) ──────┤
                     │
Phase 3 (API) ───────┘
                     │
                     ▼
              Phase 5 (WebSocket)
                     │
                     ▼
              Phase 6 (Telegram)
                     │
                     ▼
              Phase 7 (Orchestrator)
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
    Phase 8 (Clarification)   Phase 9 (Spawner)
           │                   │
           └─────────┬─────────┘
                     ▼
              Phase 10 (Memory)
                     │
                     ▼
              Phase 11 (QA)
                     │
                     ▼
              Phase 12 (Human Sim)
                     │
                     ▼
              Phase 13 (Waves)
                     │
                     ▼
              Phase 14 (Self-Improve)
                     │
                     ▼
              Phase 15 (Polish)
```

---

## New Agents Added

| Agent | Phase | Purpose |
|-------|-------|---------|
| Clarification Agent | 8 | Ask users clarifying questions |
| Human Sim Agent | 12 | Usability testing with 5 personas |
| Planning Agent | 14 | Strategic brain, creates improvement tasks |

**Total agents:** 13

## Key Design Decisions (from Ned's answers)

| Decision | Answer | Impact |
|----------|--------|--------|
| Agent instances | Unlimited (classes with N instances) | Can spawn multiple Build Agents |
| Harness self-mod | Autonomous + logged | Agents can improve harness code |
| Agent disputes | SIA arbitrates → escalate to human | Clear resolution path |
| Human involvement | Only when stuck or need permissions | Minimal interruptions |
| Task sources | All (Telegram, Dashboard, API, queues) | Multiple entry points |
| Database | Separate from Vibe | Independent operation |
| Retention | 2 weeks logs, 30 days memory | Manageable storage |
