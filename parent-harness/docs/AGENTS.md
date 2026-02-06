# Agent Definitions

Each agent is a Claude Code instance with a specific role.

## Overview

| Agent | Model | Purpose |
|-------|-------|---------|
| Orchestrator | Haiku | Coordinate agents, assign tasks |
| **Planning Agent** | Opus | Strategic vision, create improvement tasks |
| Build Agent | Opus | Write code, implement features |
| Spec Agent | Opus | Write PRDs, technical specs |
| QA Agent | Opus | Validate work, detect stuck agents |
| Task Agent | Sonnet | Manage task queue, decompose work |
| SIA | Opus | Ideation, arbitrate disputes |
| Research Agent | Sonnet | External research, documentation |
| Evaluator Agent | Opus | Evaluate task complexity |
| Decomposition Agent | Sonnet | Break down large tasks |
| Validation Agent | Sonnet | Validate completed work |
| Clarification Agent | Sonnet | Ask users clarifying questions |
| Human Sim Agent | Sonnet | Usability testing with personas |

## Agent Details

### 1. Orchestrator
**Model:** Haiku (fast, cheap)  
**Telegram:** @vibe-orchestrator

**Responsibilities:**
- Run every cron tick (60s)
- Check agent status
- Assign ready tasks to idle agents
- Detect stuck agents (QA cycle)
- Emit events to dashboard

**Does NOT:**
- Write code
- Make architectural decisions
- Interact with users directly

### 2. Planning Agent ⭐ NEW
**Model:** Opus (strategic thinking)  
**Telegram:** @vibe-planning

**The Strategic Brain of the Harness**

**Responsibilities:**
- Maintain "soul vision" for the Vibe platform
- Continuously evaluate project state
- Analyze CLI logs and past iterations
- Create new tasks/features/bugs to improve platform
- Identify technical debt and improvement opportunities
- Align work with user's long-term vision

**Runs on cron schedule** (every 2 hours or after major completions)

**Inputs:**
- Current project state (codebase analysis)
- Recent CLI logs and transcripts
- Completed task history
- Failed task patterns
- User's stated vision (from config)

**Outputs:**
- New feature tasks
- Bug reports
- Improvement suggestions
- Technical debt tickets
- Architecture recommendations

**Example evaluations:**
```
"Noticed 3 tasks failed due to missing type exports.
 Creating task: 'Add barrel exports to all modules'"

"Test coverage dropped below 80% in server/services/.
 Creating task: 'Add unit tests for task-agent services'"

"User's vision mentions 'real-time collaboration'.
 No tasks exist for this. Creating epic: 'WebSocket collaboration layer'"
```

**Does NOT:**
- Execute tasks (creates them for other agents)
- Override human decisions
- Change core architecture without approval

### 3. Build Agent
**Model:** Opus (powerful)  
**Telegram:** @vibe-build

**Responsibilities:**
- Implement features
- Fix bugs
- Write tests
- Create git commits
- Run verification scripts

**Verbose Output Required:**
```
10:42:15 ▶ Starting iteration 2
10:42:16 🔧 tool:read_file → server/routes/api.ts
10:42:18 🔧 tool:edit_file → server/routes/api.ts (+15 lines)
10:42:20 🔧 tool:exec → npm test
10:42:45 ✅ All tests passed
10:42:46 🔧 tool:exec → git commit -m "feat: add endpoint"
```

### 3. Spec Agent
**Model:** Opus (powerful)  
**Telegram:** @vibe-spec

**Responsibilities:**
- Write PRDs from user requests
- Create technical specifications
- Define pass criteria for tasks
- Document architectural decisions

**Output:**
- Markdown specs in `docs/specs/`
- Clear pass criteria (testable)

### 4. QA Agent
**Model:** Opus (powerful)  
**Telegram:** @vibe-qa

**Responsibilities:**
- Validate every completed iteration
- Run tests, lint, typecheck
- Detect stuck agents (every 15 min)
- Terminate stuck sessions
- Record findings

**Validation Checks:**
1. TypeScript compiles?
2. Tests pass?
3. No regressions?
4. Lint clean?
5. Pass criteria met?

**Stuck Detection:**
- No tool calls in 5 min
- Same error 3+ times
- No output for 10 min
- Error loop

### 5. Task Agent
**Model:** Sonnet (balanced)  
**Telegram:** @vibe-task

**Responsibilities:**
- Manage task queue
- Prioritize work
- Track dependencies
- Update task status
- Coordinate with other agents

### 6. SIA (Ideation Agent)
**Model:** Opus (powerful)  
**Telegram:** @vibe-sia

**Responsibilities:**
- Brainstorm solutions
- Explore alternatives
- Challenge assumptions
- Generate ideas

**Triggered by:** Evaluator when task needs exploration

### 7. Research Agent
**Model:** Sonnet (balanced)  
**Telegram:** @vibe-research

**Responsibilities:**
- Search external docs
- Find code examples
- Research libraries
- Summarize findings

### 8. Evaluator Agent
**Model:** Opus (powerful)  
**Telegram:** @vibe-evaluator

**Responsibilities:**
- Evaluate task complexity
- Estimate effort
- Identify risks
- Recommend decomposition

### 9. Decomposition Agent
**Model:** Sonnet (balanced)  
**Telegram:** @vibe-decomposition

**Responsibilities:**
- Break large tasks into subtasks
- Define dependencies
- Create task hierarchy
- Assign wave numbers

### 10. Validation Agent
**Model:** Sonnet (balanced)  
**Telegram:** @vibe-validation

**Responsibilities:**
- Final validation before merge
- Integration testing
- Documentation check
- Ready-for-human-review

### 11. Clarification Agent
**Model:** Sonnet (balanced)  
**Telegram:** @vibe-clarification

**Responsibilities:**
- Intercept new user tasks before execution
- Identify ambiguous requirements
- Ask targeted clarifying questions via Telegram
- Build complete task specification
- Only release task when sufficiently defined

**Flow:**
```
User: "Add authentication"
    ↓
Clarification Agent:
  "To implement authentication, I need to know:
   1. OAuth (Google/GitHub) or username/password?
   2. Which routes need protection?
   3. Session-based or JWT tokens?"
    ↓
User answers
    ↓
Agent updates task with full spec
    ↓
Task enters normal queue
```

**Bypass conditions:**
- Tasks created by other agents (already well-defined)
- Tasks with complete pass_criteria
- Tasks marked `skip_clarification = true`

**Timeout:** If no response in 24h, proceed with documented assumptions.

### 12. Human Simulation Agent
**Model:** Sonnet (balanced)  
**Telegram:** @vibe-human-sim

**Responsibilities:**
- Test completed UI features like a real user
- Run multiple personas in parallel
- Report usability issues
- Create fix tasks automatically

**Personas:**
| Persona | Tech Level | Patience | Focus Areas |
|---------|------------|----------|-------------|
| `technical` | High | High | CLI, API endpoints, error messages, dev tools |
| `power-user` | Medium-high | Medium | Complex workflows, edge cases, shortcuts |
| `casual` | Medium | Medium | Happy path, discoverability, intuitive UX |
| `confused` | Low | Low | Error recovery, help text, clear messaging |
| `impatient` | Any | Very low | Loading states, feedback, responsiveness |

**Multi-instance execution:**
```typescript
// Spawn 3 personas in parallel for different angles
await Promise.all([
  spawnHumanSim(taskId, 'technical'),
  spawnHumanSim(taskId, 'casual'),
  spawnHumanSim(taskId, 'confused')
]);
```

**Capabilities:**
- Browser automation (Agent Browser - Claude Code skill)
- Fallback: Puppeteer MCP
- Screenshot capture and analysis
- Form filling and navigation
- Error state detection
- Task completion verification
- Frustration indicators (repeated clicks, back navigation)

**Output:**
- `human_sim_results` table entries
- Aggregated findings across personas
- Auto-generated fix tasks for issues
- Telegram summary to @vibe-human-sim

## Agent Communication

Agents communicate via **message bus** only:

```
Build Agent → message_bus → Orchestrator → message_bus → QA Agent
```

**No direct agent-to-agent communication.**

Events written to message_bus:
- `task:completed` - Agent finished a task
- `task:failed` - Agent failed a task
- `help:needed` - Agent needs human input
- `qa:requested` - Request QA validation
- `stuck:detected` - Agent appears stuck

## System Prompts

Each agent gets a tailored system prompt. Key elements:

1. **Role definition** - What this agent does
2. **Tools available** - Which Claude tools to use
3. **Output requirements** - Must be verbose
4. **Logging format** - Consistent event format
5. **When to ask for help** - Escalation rules

**Critical instruction for all agents:**
```
You MUST log every action:
- Every tool call with parameters
- Every file read/write
- Every command execution  
- Progress on pass criteria

Your output is analyzed to detect if you're stuck.
Silent agents get terminated.
```

## Spawning Agents

```typescript
const session = await spawnAgent({
  agentId: 'build_agent',
  taskId: 'task-042',
  model: 'opus',
  systemPrompt: buildAgentPrompt(task),
  workingDir: '/home/user/Idea_Incubator/Idea_Incubator'
});
```

The spawner:
1. Creates agent_session record
2. Creates iteration_log (iteration 1)
3. Launches Claude Code CLI
4. Pipes output to iteration_logs.log_content
5. Monitors for completion/failure
6. Updates status on exit
