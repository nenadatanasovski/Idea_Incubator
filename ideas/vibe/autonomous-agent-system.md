# Vibe Autonomous Agent System

## Overview

Vibe's core differentiator is its self-evolving autonomous agent architecture. Unlike traditional AI tools that execute single tasks, Vibe employs a dynamic ecosystem of specialized agents that learn, adapt, and improve continuously.

---

## Core Principles

| Principle                    | Description                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Agents as Vehicles**       | Each agent is a "husk" — a containerized instance with specific skills and instructions that can be replicated as needed |
| **Self-Learning**            | Every agent maintains a track record (transcript/CLI output) that informs future behavior                                |
| **Continuous Handoff**       | Agents prepare handoffs before reaching context limits, ensuring continuity                                              |
| **Self-Correction**          | Agents detect when stuck and can modify their own instructions to break loops                                            |
| **Dynamic Creation**         | New agent types are spawned on-demand when existing types don't fit the task                                             |
| **Deterministic Validation** | Each task has pass/fail criteria — no "vibes-based" assessment                                                           |

---

## The Orchestrator Agent

The Orchestrator is the master coordinator of the system.

### Responsibilities

| Function                | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| **Routing**             | Directs incoming requests to appropriate specialized agents     |
| **Agent Creation**      | Spins up new agent types when none in the registry fit the task |
| **Registry Management** | Maintains catalog of all agent types with their capabilities    |
| **Pipeline Creation**   | Dynamically generates task pipelines with steps and stage gates |
| **Load Balancing**      | Manages multiple instances of the same agent type               |

### How It Works

```
User Request
    ↓
[Orchestrator]
    ↓
┌───────────────────────────────────────┐
│ 1. Analyze request                    │
│ 2. Search agent registry              │
│ 3. If match found → Route to agent    │
│ 4. If no match → Create new agent     │
│ 5. Add new agent to registry          │
│ 6. Generate pipeline with stage gates │
└───────────────────────────────────────┘
    ↓
[Specialized Agent(s)]
    ↓
Task Execution
```

### Orchestrator Scope

**Important distinction:** The Orchestrator handles the Ideation and Support aspects of Vibe. The Build aspect has its own specialized loop (see Self-Improvement Agent below).

---

## The Self-Improvement Agent (SIA)

The SIA is a critical meta-agent specifically for the Build aspect of Vibe.

### Purpose

When the coding agent is working in a Ralph loop and the same task keeps being reworked, the SIA triggers to improve the approach.

### How SIA Works

```
Coding Agent Loop
    ↓
[Task attempted]
    ↓
┌─────────────────────────────────────────────────┐
│ Trigger Check:                                  │
│ Is this the same task as the previous loop?    │
│                                                 │
│ YES → Spin up SIA between loops               │
│ NO  → Continue normal loop                     │
└─────────────────────────────────────────────────┘
    ↓
[SIA Activated]
    ↓
┌─────────────────────────────────────────────────┐
│ 1. Analyze transcript/footprints from previous │
│    agent attempt                                │
│ 2. Review techniques library in SIA prompt     │
│ 3. Determine if/how to change approach         │
│ 4. Generate new system prompt for coding agent │
│ 5. Log attempt in internal memory              │
│ 6. Spawn new coding agent with updated prompt  │
└─────────────────────────────────────────────────┘
    ↓
[New Coding Agent Instance]
    ↓
Continue Ralph Loop
```

### SIA Internal Memory

The SIA maintains an internal memory file (markdown) that tracks:

| Data Point               | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| **System prompts tried** | History of all prompt variations attempted for this task |
| **Outcomes**             | Pass/fail result for each attempt                        |
| **Performance delta**    | Whether each change improved or degraded performance     |
| **Techniques applied**   | Which techniques from the library were used              |

### Determining Better vs. Worse

**Ground truth validation:**

- Each task has deterministic pass/fail criteria
- Task NOT completed = bad system prompt = change needed
- SIA compares against the track record to avoid repeating failed approaches
- Clear metrics, not subjective assessment

### SIA Failsafe

After X failed attempts (configurable threshold):

1. SIA stops iterating
2. Human-in-the-loop triggered
3. Request sent for help debugging or clarifying acceptance criteria

---

## Agent Lifecycle

### 1. Instantiation

```
Orchestrator creates agent with:
├── System instructions (task-specific)
├── Skill definitions (tools available)
├── Context window allocation
├── Pipeline position (which step in workflow)
└── Test cases (acceptance criteria for stage gate)
```

### 2. Execution

```
Agent operates in cycle:
├── Receive task/context
├── Execute actions (tool calls)
├── Generate transcript (track record)
├── Print every action (edit, tool call, etc.)
├── Monitor own progress
├── Check for stuck loops
└── Prepare handoff if approaching context limit
```

### 3. Self-Learning

```
After each session:
├── Transcript saved to agent's track record
├── Success/failure patterns identified
├── Instructions refined if needed (via SIA for build agents)
└── Registry updated with learnings
```

### 4. Handoff

```
When context limit approaches:
├── Summarize current state
├── Document progress and blockers
├── Package context for next instance
├── Reference git commit history for code state
├── Spawn new instance with handoff package
└── Terminate gracefully
```

### Preventing Information Loss in Handoffs

| Mechanism              | What It Preserves                                 |
| ---------------------- | ------------------------------------------------- |
| **Git commit history** | Complete code state and evolution                 |
| **Agent transcript**   | Every action taken, tool called, output generated |
| **Pipeline state**     | Position in workflow, completed gates             |
| **Internal memory**    | Task-specific learnings and attempts              |
| **Summary document**   | Distilled context for quick orientation           |

---

## Agent Types (Initial Registry)

### User-Facing Agents

| Agent Type              | Purpose                                                    | Triggers                        |
| ----------------------- | ---------------------------------------------------------- | ------------------------------- |
| **Ideation Agent**      | Guides users from "What makes you tick?" to validated idea | User starts new idea journey    |
| **Specification Agent** | Extracts detailed requirements through conversation        | Idea validated, ready for build |
| **Build Agent**         | Generates application code via Ralph loop                  | Specifications complete         |
| **Support Agent**       | Handles user questions, troubleshooting                    | User requests help              |
| **Network Agent**       | Proactively surfaces collaboration opportunities           | Post-launch, ongoing            |
| **Analytics Agent**     | Generates insights from app data                           | User enables analytics          |

### System Agents

| Agent Type                       | Purpose                                           | Triggers                         |
| -------------------------------- | ------------------------------------------------- | -------------------------------- |
| **Testing Agent**                | Simulates user behavior, captures friction points | Continuous (autonomous)          |
| **QA Agent**                     | Validates built apps against specifications       | Build complete                   |
| **Optimization Agent**           | Identifies performance improvements               | Periodic analysis                |
| **Security Agent**               | Scans for vulnerabilities                         | Pre-deployment, ongoing          |
| **Deployment Agent**             | Manages hosting, scaling, updates                 | Deployment events                |
| **Self-Improvement Agent (SIA)** | Improves coding agent approaches                  | Same task reworked in build loop |
| **Legal Agent**                  | Prepares users for professional legal counsel     | Regulatory questions arise       |

### Meta Agents

| Agent Type         | Purpose                               | Triggers                     |
| ------------------ | ------------------------------------- | ---------------------------- |
| **Orchestrator**   | Routes, creates, manages all agents   | Always running               |
| **Registry Agent** | Maintains and optimizes agent catalog | Agent creation/update events |
| **Pipeline Agent** | Generates and monitors task workflows | New task received            |

---

## The Testing Agent System (Self-Optimization)

This is Vibe's autonomous improvement engine.

### Components

```
┌─────────────────────────────────────────────────────┐
│                 TESTING AGENT SYSTEM                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐    ┌─────────────┐                │
│  │  Browser    │    │  Metadata   │                │
│  │  Controller │───→│  Capture    │                │
│  └─────────────┘    └──────┬──────┘                │
│                            │                        │
│                            ↓                        │
│                   ┌─────────────┐                   │
│                   │ Transcript  │                   │
│                   │  Analysis   │                   │
│                   └──────┬──────┘                   │
│                          │                          │
│            ┌─────────────┼─────────────┐           │
│            ↓             ↓             ↓           │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│     │   Gap    │  │  Friction│  │  Feature │      │
│     │ Detection│  │  Points  │  │  Ideas   │      │
│     └──────────┘  └──────────┘  └──────────┘      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### How It Works

**Step 1: Simulation**
Testing agents with browser control simulate real user journeys:

- "Start ideation as first-time user"
- "Build a simple task tracking app"
- "Invite a collaborator"
- "Navigate from build to launch"

**Step 2: Capture**
Every action generates metadata:

- Page/component visited
- Time spent on each step
- Actions taken (clicks, inputs, navigation)
- Errors encountered
- Abandonment points

**Step 3: Analysis**
Transcripts are analyzed for:

- **Stuck points**: Where did the simulated user loop or fail?
- **Friction**: What took longer than expected?
- **Gaps**: What functionality was missing?
- **Opportunities**: What new features would improve the journey?

**Step 4: Action**
Findings are routed to:

- **Auto-fix**: Simple issues resolved automatically
- **Backlog**: Complex issues queued for human review
- **Agent updates**: Registry agents updated with new patterns
- **Alerts**: Critical issues flagged immediately

### Test Environment Isolation

**Critical safeguard:** All testing runs in lower/test environments to prevent:

- Sending real emails
- Creating real user data
- Triggering real payment flows
- Any production side effects

Users never initiate automated comms — all communications are user-initiated or user-automated activities.

### Edge Case Discovery

The testing agent system has a **deterministic self-suggesting nature**:

- AI proactively generates test scenarios covering edge cases
- Not limited to predefined test suites
- Continuously expanding coverage based on new patterns discovered

### Compute Cost Management

Testing agent compute costs are covered by:

- Platform operational budget
- Eventually passed to users as part of hosting costs + margin

### Example Flow

```
Testing Agent: "Simulate building a restaurant booking app"
    ↓
Browser Controller: Navigates to Vibe, starts ideation
    ↓
Metadata: "User spent 3 minutes on question about target customer"
    ↓
Transcript: "Agent attempted to select 'restaurants' but option not available"
    ↓
Analysis: "Missing industry-specific options in target customer selection"
    ↓
Output: {
  type: "gap",
  severity: "medium",
  suggestion: "Add industry selector with restaurant/hospitality option",
  evidence: [transcript_id, session_id]
}
    ↓
Backlog: New feature request created with evidence
```

---

## Pipeline Architecture

Tasks flow through dynamically generated pipelines with stage gates.

### Pipeline Structure

```
┌────────────────────────────────────────────────────────────┐
│                      TASK PIPELINE                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [Step 1]──→[Gate 1]──→[Step 2]──→[Gate 2]──→[Step N]     │
│                                                            │
│  Step: Action performed by agent                           │
│  Gate: Test cases that must pass before proceeding         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Impossible Task Prevention

Before tasks enter the pipeline:

1. AI vets the task for feasibility
2. Impossible or poorly-specified tasks flagged
3. Human clarification requested before assignment
4. Prevents credit burn on unachievable goals

### Example: Ideation → Build Pipeline

| Step                      | Agent               | Stage Gate (Test Cases)                             |
| ------------------------- | ------------------- | --------------------------------------------------- |
| 1. Passion exploration    | Ideation Agent      | User profile populated with interests, skills       |
| 2. Problem identification | Ideation Agent      | Problem statement validated, target user defined    |
| 3. Solution direction     | Ideation Agent      | Solution hypothesis documented with differentiation |
| 4. Feasibility check      | Ideation Agent      | Constraints identified, resources assessed          |
| **GATE: Idea validated**  | —                   | All ideation criteria met, user confirms readiness  |
| 5. Feature extraction     | Specification Agent | Core features listed with priorities                |
| 6. User flow mapping      | Specification Agent | User journeys documented                            |
| 7. Technical requirements | Specification Agent | Database schema, API needs, integrations identified |
| **GATE: Spec complete**   | —                   | All specs documented, test cases defined            |
| 8. Initial build          | Build Agent         | Scaffold generated, core functionality implemented  |
| 9. Iteration loop         | Build Agent + SIA   | User feedback incorporated, tests passing           |
| **GATE: Build complete**  | —                   | All test cases pass, user approves                  |
| 10. Deployment            | Deployment Agent    | App live, monitoring active                         |

---

## Human-in-the-Loop Protocol

### When Agents Escalate

| Trigger                        | Threshold                                                   | Escalation Type            |
| ------------------------------ | ----------------------------------------------------------- | -------------------------- |
| **Stuck loop**                 | Same task attempted 3+ times without progress               | Request for clarification  |
| **Ambiguous criteria**         | Acceptance criteria unclear after 2 interpretation attempts | Request for specification  |
| **Technical blocker**          | External dependency or limitation                           | Request for guidance       |
| **Confidence below threshold** | Agent unsure of correct approach (<60% confidence)          | Request for decision       |
| **Security/safety concern**    | Potential harmful content or action detected                | Mandatory human review     |
| **SIA exhaustion**             | X failed system prompt variations                           | Request for debugging help |
| **Credit limit approaching**   | Consumption threshold reached                               | Approval to continue       |

### Escalation Flow

```
Agent detects trigger condition
    ↓
Prepare escalation package:
├── Current context summary
├── Specific question/blocker
├── Options considered (if applicable)
├── Transcript excerpt showing stuck point
    ↓
Route to appropriate human:
├── User (for requirements/preferences)
├── Support (for technical issues)
├── Admin (for safety/policy)
    ↓
Human responds
    ↓
Agent incorporates response and continues
```

### Escalation Message Format

```
[AGENT ESCALATION - Build Agent]

Status: Stuck on task "Implement user authentication"
Attempts: 3
Last attempt result: "OAuth provider configuration unclear"

Question: The specification mentions "social login" but doesn't
specify which providers. Should I implement:
  A) Google only (fastest)
  B) Google + Apple (iOS requirement)
  C) Google + Facebook + Apple (maximum coverage)

Context: [link to transcript]

Waiting for your input to continue.
```

---

## Circuit Breakers

### Credit Protection

| Mechanism                     | Purpose                          |
| ----------------------------- | -------------------------------- |
| **Attempt threshold**         | Max iterations before escalation |
| **Credit consumption cap**    | Prevents runaway spending        |
| **Impossible task detection** | Stops before wasting resources   |
| **Time-based limits**         | Prevents infinite loops          |

### Example Circuit Breaker Flow

```
Task assigned to Build Agent
    ↓
Attempt 1: Fails
Attempt 2: Fails
Attempt 3: Fails
    ↓
[Circuit breaker triggers]
    ↓
Options:
├── Escalate to SIA for approach change
├── Escalate to human for clarification
├── Flag as potentially impossible
└── Return credits if task was ill-specified
```

---

## Agent Registry Schema

```json
{
  "agent_id": "uuid",
  "agent_type": "ideation | specification | build | testing | sia | ...",
  "version": "1.0.0",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "status": "active | deprecated | testing",

  "configuration": {
    "system_instructions": "string (the agent's core prompt)",
    "tools_available": ["tool_1", "tool_2"],
    "context_limit": 128000,
    "handoff_threshold": 0.8,
    "stuck_loop_threshold": 3,
    "confidence_threshold": 0.6,
    "max_attempts_before_escalation": 5
  },

  "track_record": {
    "total_sessions": 1000,
    "success_rate": 0.94,
    "average_duration": "15 minutes",
    "common_failure_modes": ["pattern_1", "pattern_2"],
    "recent_transcripts": ["transcript_id_1", "transcript_id_2"]
  },

  "lineage": {
    "parent_agent": "uuid (if spawned from another)",
    "child_agents": ["uuid_1", "uuid_2"],
    "instruction_history": ["version_1", "version_2"]
  },

  "sia_memory": {
    "prompts_tried": [
      { "prompt_version": "v1", "outcome": "fail", "task_id": "xyz" },
      { "prompt_version": "v2", "outcome": "pass", "task_id": "xyz" }
    ],
    "techniques_applied": ["decomposition", "tool_change"],
    "improvement_delta": 0.15
  }
}
```

---

## Self-Correction Mechanism

When an agent detects it's stuck:

### Detection

```
Loop detected:
├── Same error 3+ times
├── No progress on task metrics
├── Output unchanged across attempts
```

### Analysis

```
Agent analyzes own situation:
├── What was the original instruction?
├── What approaches have I tried?
├── Why did each approach fail?
├── What's different about this task vs. similar successful tasks?
```

### Correction Options

| Option                     | When Applied                               |
| -------------------------- | ------------------------------------------ |
| **Instruction refinement** | Current instructions don't cover edge case |
| **Tool change**            | Wrong tool being used for task             |
| **Decomposition**          | Task too complex, needs to be broken down  |
| **Escalation**             | Beyond agent's capability                  |

### Example Self-Correction

```
Original instruction: "Build a login page with email authentication"

Attempt 1: Generated login form, but password reset failed
Attempt 2: Fixed password reset, but email validation broke
Attempt 3: Email validation fixed, but session management inconsistent

Self-analysis:
- I'm treating this as one task, but it has interdependent components
- Each fix is breaking something else

Correction:
- Decompose into: (1) Form UI, (2) Validation, (3) Session, (4) Password reset
- Handle each as separate sub-task with own test cases
- Integration test at the end

Updated instruction: "Build login system in four phases: UI, validation,
session management, password reset. Complete each phase fully before
proceeding. Run integration tests after each phase."
```

---

## Metrics & Monitoring

### Agent Performance Metrics

| Metric                   | Description                               | Target               |
| ------------------------ | ----------------------------------------- | -------------------- |
| **Success rate**         | Tasks completed without escalation        | >90%                 |
| **Average duration**     | Time to complete standard tasks           | Decreasing over time |
| **Escalation rate**      | % of tasks requiring human input          | <10%                 |
| **Self-correction rate** | % of stuck loops resolved autonomously    | >70%                 |
| **User satisfaction**    | Post-interaction ratings                  | >4.5/5               |
| **SIA effectiveness**    | % of prompt changes that improve outcomes | >60%                 |

### System Health Metrics

| Metric                      | Description                                | Alert Threshold            |
| --------------------------- | ------------------------------------------ | -------------------------- |
| **Active agents**           | Number of agents running concurrently      | Capacity warning at 80%    |
| **Queue depth**             | Tasks waiting for agents                   | >100 triggers scaling      |
| **Handoff failures**        | Failed context transfers between instances | >1% triggers investigation |
| **Registry staleness**      | Time since agent definitions updated       | >7 days triggers review    |
| **Credit consumption rate** | Burn rate per user                         | Unusual spikes flagged     |

---

## Future Evolution

### Short-term (MVP)

- Ideation, Specification, Build agents operational
- Basic testing agent running nightly
- Simple orchestrator with manual agent creation
- Human-in-the-loop for all escalations
- SIA for build loop improvements

### Medium-term (Post-MVP)

- Full autonomous testing agent system
- Self-correction mechanisms active
- Network/matchmaking agents
- Reduced human escalation (<10%)
- SIA improving all agent types

### Long-term (Scale)

- Agents creating and optimizing other agents
- Cross-platform agent deployment
- Agent marketplace (third-party agents)
- Federated learning across all Vibe instances
- Predictive escalation (flag issues before they occur)

---

_This document describes the autonomous agent architecture that powers Vibe's self-improving platform. It is a living document that will evolve as the system matures._

_Last updated: January 4, 2025_
