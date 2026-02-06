# Agent Definitions

Each agent is a Claude Code instance with a specific role.

## Overview

| Agent | Model | Purpose |
|-------|-------|---------|
| Orchestrator | Haiku | Coordinate agents, assign tasks |
| Build Agent | Opus | Write code, implement features |
| Spec Agent | Opus | Write PRDs, technical specs |
| QA Agent | Opus | Validate work, detect stuck agents |
| Task Agent | Sonnet | Manage task queue, decompose work |
| SIA | Opus | Ideation, brainstorming |
| Research Agent | Sonnet | External research, documentation |
| Evaluator Agent | Opus | Evaluate task complexity |
| Decomposition Agent | Sonnet | Break down large tasks |
| Validation Agent | Sonnet | Validate completed work |

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

### 2. Build Agent
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
