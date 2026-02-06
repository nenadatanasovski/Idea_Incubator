# Critical Gaps Analysis

Missing capabilities required for the harness to operate autonomously.

---

## Gap 1: User Task Clarification Agent

**Problem:** Vague tasks like "make it faster" lead to wrong implementations.

**Solution:** Agent that proactively asks clarifying questions (like SIA does for ideation).

**Flow:**
```
User: "Add authentication"
    ↓
Clarification Agent asks:
  - OAuth or username/password?
  - Which routes need protection?
  - JWT or session-based?
    ↓
User answers
    ↓
Well-defined task enters queue
```

**Implementation:**
- New agent: `clarification_agent`
- Model: Sonnet
- Triggers: All new tasks from users (bypass for agent-created tasks)

---

## Gap 2: Human Simulation Agent (Usability Testing)

**Problem:** Agents verify code works but can't test usability like a human would.

**Solution:** Simulated users with different technical levels testing the UI.

**User Personas:**
| Persona | Description | Tests |
|---------|-------------|-------|
| `technical` | Developer user | CLI, API endpoints, error messages |
| `power-user` | Advanced non-dev | Complex workflows, edge cases |
| `casual` | Basic user | Happy path, discoverability |
| `confused` | Low-tech user | Error recovery, help text |
| `impatient` | Fast user | Loading states, feedback |

**Multiple instances can run in parallel** to get different angles on the same feature.

**Flow:**
```
Build Agent completes "Add login page"
    ↓
Spawn 3 Human Sim instances:
  - technical persona
  - casual persona  
  - confused persona
    ↓
Each tests the feature independently
    ↓
Findings aggregated → fix tasks created
```

**Capabilities:**
- Browser automation (Agent Browser)
- Screenshot analysis
- Persona-based expectations
- Frustration detection
- Task completion tracking

**Implementation:**
- New agent: `human_sim_agent`
- Model: Sonnet
- Config: `persona`, `patience_level`, `tech_level`
- Triggers: After Build Agent completes UI tasks

---

## Gap 3: Agent Memory System

**Vibe Already Has This!** The harness should use the same approach.

### Vibe's Existing Memory Solutions:

**1. SIA Task Memory (`sia_task_memory` table):**
```sql
CREATE TABLE sia_task_memory (
    task_id TEXT PRIMARY KEY,
    task_signature TEXT,           -- Hash for similar task matching
    attempts TEXT,                 -- JSON array of {technique, result}
    techniques_tried TEXT,         -- What didn't work
    successful_technique TEXT,     -- What worked
    total_interventions INTEGER
);
```
- Tracks which techniques work for which failures
- Avoids repeating failed approaches
- Matches similar tasks by signature

**2. Memory Graph (`memory_blocks` + `memory_links`):**
```sql
memory_blocks (
    id, session_id, type, content, properties,
    status, confidence, abstraction_level
)

memory_links (
    source_block_id, target_block_id, 
    link_type, degree, confidence
)
```
- Structured knowledge storage
- Relationship tracking between concepts
- Graph traversal for context retrieval

**3. Agent States (`agent_states` table):**
```sql
agent_states (
    agent_id, agent_type, status, session_id,
    current_task, last_activity
)
```
- Current work tracking
- Session persistence

### Harness Should Add:

**Per-agent long-term memory:**
```sql
CREATE TABLE agent_memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    memory_type TEXT,  -- decision/failure/preference/pattern
    content TEXT,
    task_signature TEXT,  -- For similar task matching
    relevance_score REAL,
    created_at TEXT,
    last_accessed TEXT,
    access_count INTEGER
);
```

**Cross-agent pattern learning:**
```sql
CREATE TABLE technique_effectiveness (
    id TEXT PRIMARY KEY,
    technique TEXT,
    error_pattern TEXT,  -- Regex or signature
    success_count INTEGER,
    failure_count INTEGER,
    success_rate REAL,
    last_used TEXT
);
```

---

## Gap 4: Features Vibe Has That Harness Is Missing

### A. Transcript & Tool Tracking

**Vibe has:**
- `transcript_entries` - Every action logged with timing
- `skill_traces` - Skill file usage tracked
- `tool_uses` - Atomic tool call records

**Harness needs:** Same level of granularity in `iteration_logs`.

### B. Task Version History & Checkpoints

**Vibe has:**
- `task_versions` - Full change history
- `TaskVersionService` - Checkpoint/rollback support
- Diff tracking between versions

**Harness needs:** Task version tracking for rollback scenarios.

### C. Spec Workflow State Machine

**Vibe has:**
- `workflow_state_machine.ts` - Formal state transitions
- Spec approval workflow
- Spec → Task List conversion

**Harness needs:** Spec approval flow before task creation.

### D. SIA Intervention System

**Vibe has:**
- `sia_attempts` - Each intervention tracked
- `sia_task_memory` - Per-task technique history  
- Technique effectiveness metrics
- Auto-escalation after N failures

**Harness needs:** Same intervention tracking for self-improvement.

### E. Build Interventions

**Vibe has:**
- `build_interventions` - Human/SIA fixes during build
- Links intervention to specific task/session

**Harness needs:** Record when agents fix each other's work.

### F. Traceability Service

**Vibe has:**
- PRD → Spec → Task → Code linking
- Gap detection between layers
- Coverage metrics

**Harness needs:** Traceability from requirement to implementation.

### G. File Impact Analysis

**Vibe has:**
- `file_impact_analyzer.ts` - Predicts which files a task touches
- `file_conflict_detector.ts` - Detects parallel conflicts
- Used for lane assignment

**Harness has schema but needs:** Implementation of analysis logic.

### H. Parallelism Calculator

**Vibe has:**
- `parallelism_calculator.ts` - Determines safe parallelism
- `parallelism_queries.ts` - Wave calculation
- Conflict resolution

**Harness has schema but needs:** Implementation.

### I. Question Engine

**Vibe has:**
- `question_engine.ts` - Dynamic clarifying questions
- Context-aware question generation
- Used by multiple agents

**Harness needs:** Shared question engine for Clarification Agent.

### J. PRD Service

**Vibe has:**
- `prd_service.ts` - PRD generation and management
- `prd_coverage_service.ts` - Tracks what's implemented
- `prd_link_service.ts` - Links PRDs to tasks

**Harness needs:** PRD tracking for requirements.

### K. Acceptance Criteria Results

**Vibe has:**
- `acceptance_criteria_results` table
- Tracks pass/fail for each criterion
- Used for task completion verification

**Harness needs:** Per-criterion tracking beyond just pass_criteria JSON.

### L. Execution Sessions & Pipelines

**Vibe has:**
- `task_list_execution_runs` - Execution tracking
- `pipeline_state` - Current pipeline state
- `concurrent_execution_sessions` - Parallel session management

**Harness has basic version but needs:** Full pipeline state machine.

### M. Graph Snapshots

**Vibe has:**
- `graph_snapshots` table
- Point-in-time graph state capture
- Used for debugging and rollback

**Harness needs:** State snapshots for debugging.

---

## Summary: What to Implement

### Priority 1 (Critical for Operation)
| Feature | Vibe Source | Effort |
|---------|-------------|--------|
| Clarification Agent | `question_engine.ts` | Medium |
| Human Sim Agent (multi-persona) | New | High |
| SIA Task Memory | `sia_task_memory` | Low |
| Transcript/Tool Tracking | `transcript_entries` | Medium |

### Priority 2 (Needed for Self-Improvement)
| Feature | Vibe Source | Effort |
|---------|-------------|--------|
| Technique Effectiveness | `sia_attempts` | Low |
| Build Interventions | `build_interventions` | Low |
| Agent Memory System | New (using Vibe patterns) | Medium |

### Priority 3 (Polish)
| Feature | Vibe Source | Effort |
|---------|-------------|--------|
| Task Versions | `task_versions` | Medium |
| Traceability | `traceability_service.ts` | High |
| PRD Coverage | `prd_coverage_service.ts` | Medium |
| Acceptance Criteria Results | Table exists | Low |

### Can Skip (Already in Schema or Not Critical)
- File Impact Analysis (schema exists, implement later)
- Parallelism Calculator (schema exists, implement later)
- Graph Snapshots (nice to have)
- Spec Workflow (can simplify for harness)

---

## Decision Points for Ned

1. **Clarification Agent behavior:**
   - Block execution until user responds?
   - OR timeout (e.g., 24h) and proceed with best guess?

2. **Human Sim Agent scope:**
   - Basic click-testing per persona?
   - OR full user journey simulation?
   - OR both depending on task type?

3. **Memory system:**
   - Use Vibe's existing tables directly?
   - OR create harness-specific tables?
   - OR both with sync?

4. **Which Priority 3 features to include in Phase 1?**
