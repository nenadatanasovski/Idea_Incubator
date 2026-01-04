# Self-Improvement Agent (SIA) Loop Architecture

**Version:** 1.0 (Draft)
**Date:** January 4, 2025
**Status:** Pre-implementation

---

## Overview

The Self-Improvement Agent (SIA) is a meta-agent that optimizes other agents' performance, specifically within the Build phase of Vibe. It represents a key differentiator: the platform doesn't just run AI agents — it uses AI agents to improve AI agents.

**Core Purpose:** When a coding agent gets stuck on the same task repeatedly, the SIA intervenes to analyze why and propose a new approach.

---

## The Problem SIA Solves

```
WITHOUT SIA:
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Task: "Build user authentication"                        │
│                                                            │
│  Attempt 1: ❌ Failed (password reset broken)             │
│  Attempt 2: ❌ Failed (password reset broken)             │
│  Attempt 3: ❌ Failed (password reset broken)             │
│  Attempt 4: ❌ Failed (password reset broken)             │
│  ... (credits burning, user frustrated)                   │
│                                                            │
│  Result: Human escalation after N failures                │
│                                                            │
└────────────────────────────────────────────────────────────┘

WITH SIA:
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Task: "Build user authentication"                        │
│                                                            │
│  Attempt 1: ❌ Failed (password reset broken)             │
│  ──► SIA TRIGGERS                                         │
│      • Analyzes: "Agent treating as single task"          │
│      • Diagnosis: "Interdependent components"             │
│      • Action: "Decompose into sub-tasks"                 │
│                                                            │
│  Attempt 2: ✅ Success (decomposed approach)              │
│                                                            │
│  Result: Self-corrected, user didn't notice               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Core Concept: The Ralph Loop + SIA Integration

The "Ralph Loop" is Vibe's AI-assisted development cycle with human-in-the-loop. SIA integrates into this loop to reduce human intervention.

```
                          RALPH LOOP WITH SIA

                    ┌─────────────────────────┐
                    │                         │
                    │    TASK ASSIGNED        │
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │                         │
                    │   CODING AGENT WORKS    │
                    │                         │
                    │   • Generates code      │
                    │   • Runs tests          │
                    │   • Leaves transcript   │
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │                         │
                    │    TASK COMPLETE?       │
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                   YES                        NO
                    │                         │
                    ▼                         ▼
           ┌───────────────┐      ┌───────────────────────┐
           │               │      │                       │
           │  MOVE TO      │      │  SAME TASK AS         │
           │  NEXT TASK    │      │  PREVIOUS LOOP?       │
           │               │      │                       │
           └───────────────┘      └───────────┬───────────┘
                                              │
                                 ┌────────────┴────────────┐
                                 │                         │
                                YES                        NO
                                 │                         │
                                 ▼                         ▼
                    ┌─────────────────────────┐  ┌─────────────────┐
                    │                         │  │                 │
                    │    SIA ACTIVATES        │  │  CONTINUE       │
                    │                         │  │  RALPH LOOP     │
                    │    • Analyze failure    │  │                 │
                    │    • Select technique   │  │                 │
                    │    • Modify approach    │  │                 │
                    │    • Spawn new agent    │  │                 │
                    │                         │  │                 │
                    └────────────┬────────────┘  └─────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │                         │
                    │  NEW CODING AGENT       │
                    │  (with updated prompt)  │
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 │
                    ─────────────┴────────► (back to top)
```

---

## SIA Trigger Conditions

The SIA activates when it detects a "stuck loop":

| Condition | Detection Method |
|-----------|------------------|
| **Same task reworked** | Task ID unchanged across consecutive loops |
| **Same error repeated** | Error signature matches previous attempt |
| **No progress on metrics** | Pass/fail criteria unchanged |
| **Output unchanged** | Generated code diff is minimal |

**Trigger Threshold:** By default, SIA activates after 1 repeated attempt (configurable).

---

## SIA Analysis Phase

When SIA activates, it performs structured analysis:

```
┌─────────────────────────────────────────────────────────────────┐
│                       SIA ANALYSIS PHASE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT:                                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Previous agent's transcript (every tool call, edit, etc.) ││
│  │ • Original task specification                                ││
│  │ • Pass/fail criteria for the task                           ││
│  │ • History of previous SIA interventions (if any)            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ANALYSIS QUESTIONS:                                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. What was the agent trying to do?                         ││
│  │ 2. At what point did it fail?                               ││
│  │ 3. What pattern of failure is this?                         ││
│  │ 4. Have we seen this pattern before?                        ││
│  │ 5. What techniques might address this pattern?              ││
│  │ 6. What hasn't been tried yet?                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  OUTPUT:                                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Diagnosis (what went wrong)                               ││
│  │ • Selected technique (from library)                         ││
│  │ • Modified system prompt for coding agent                   ││
│  │ • Expected improvement (hypothesis)                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## SIA Techniques Library

The SIA has a library of techniques it can apply. These are embedded in its system prompt:

| # | Technique | When to Use | What It Does |
|---|-----------|-------------|--------------|
| 1 | **Decomposition** | Task has interdependent components | Break into sub-tasks with own test cases |
| 2 | **Tool Change** | Wrong tool being used | Switch to more appropriate tool |
| 3 | **Prompt Restructuring** | Instructions unclear or verbose | Rewrite prompt for clarity |
| 4 | **Context Pruning** | Context window cluttered | Remove irrelevant context, focus on essentials |
| 5 | **Example Injection** | Agent lacks pattern reference | Add concrete examples of desired output |
| 6 | **Constraint Relaxation** | Task over-constrained | Temporarily relax constraints, re-add later |
| 7 | **Dependency Reordering** | Wrong sequence of operations | Change order of sub-tasks |
| 8 | **Abstraction Level Shift** | Working at wrong level of detail | Move up (high-level) or down (specific) |
| 9 | **Error Pattern Recognition** | Repeated specific error | Add explicit instruction to avoid known error |
| 10 | **Fresh Start** | Too much accumulated cruft | Reset with clean slate, minimal context |

### Technique Selection Logic

```
Analyze failure pattern
         │
         ▼
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  IF multiple components breaking each other:              │
│      → Technique 1: Decomposition                         │
│                                                           │
│  IF using file edit but should use creation:              │
│      → Technique 2: Tool Change                           │
│                                                           │
│  IF prompt is >2000 tokens with low signal:               │
│      → Technique 3: Prompt Restructuring                  │
│      → Technique 4: Context Pruning                       │
│                                                           │
│  IF agent seems confused about output format:             │
│      → Technique 5: Example Injection                     │
│                                                           │
│  IF all techniques for this pattern tried:                │
│      → Technique 10: Fresh Start                          │
│      → OR: Escalate to human                              │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## SIA Internal Memory

The SIA maintains persistent memory (stored as markdown file per task):

```markdown
# SIA Memory: Task [task-id]

## Task Details
- Task: Build user authentication
- Created: 2025-01-04 10:30:00
- Status: In Progress

## Attempt History

### Attempt 1
- Agent Version: coding-agent-v1.2
- System Prompt: [hash or excerpt]
- Outcome: FAIL
- Failure Point: Password reset endpoint throwing 500
- Duration: 15 minutes
- Credits Consumed: 12

### Attempt 2 (SIA Intervention)
- Technique Applied: Decomposition
- Modified Prompt: "Break auth into 4 phases: UI, validation, session, password reset"
- Agent Version: coding-agent-v1.2
- Outcome: PASS
- Duration: 22 minutes
- Credits Consumed: 18

## Learnings
- This task type benefits from decomposition
- Pattern: interdependent-components → decomposition
- Improvement Delta: 100% (was failing, now passing)

## Prompts Tried
1. Original prompt → FAIL
2. Decomposition prompt → PASS
```

### Memory Schema (JSON)

```json
{
  "task_id": "uuid",
  "task_description": "Build user authentication",
  "created_at": "2025-01-04T10:30:00Z",
  "status": "completed",

  "attempts": [
    {
      "attempt_number": 1,
      "agent_version": "coding-agent-v1.2",
      "system_prompt_hash": "abc123",
      "outcome": "fail",
      "failure_point": "Password reset endpoint throwing 500",
      "duration_minutes": 15,
      "credits_consumed": 12,
      "sia_intervention": false
    },
    {
      "attempt_number": 2,
      "agent_version": "coding-agent-v1.2",
      "system_prompt_hash": "def456",
      "outcome": "pass",
      "duration_minutes": 22,
      "credits_consumed": 18,
      "sia_intervention": true,
      "technique_applied": "decomposition",
      "prompt_modification": "Break auth into 4 phases..."
    }
  ],

  "learnings": [
    {
      "pattern": "interdependent-components",
      "effective_technique": "decomposition",
      "confidence": 0.9
    }
  ],

  "prompts_tried": [
    {"version": 1, "hash": "abc123", "outcome": "fail"},
    {"version": 2, "hash": "def456", "outcome": "pass"}
  ]
}
```

---

## SIA Validation: How We Know It Works

The SIA doesn't trust its own judgment. It uses deterministic validation:

```
SIA applies technique
         │
         ▼
New Coding Agent runs
         │
         ▼
┌─────────────────────────────────────┐
│         VALIDATION CHECK            │
│                                     │
│  Pass/Fail Criteria for Task:       │
│  ┌─────────────────────────────────┐│
│  │ ✓ Login endpoint returns 200   ││
│  │ ✓ Registration creates user    ││
│  │ ✓ Password reset sends email   ││
│  │ ✓ Session persists across      ││
│  │   page reloads                 ││
│  │ ✓ All tests pass               ││
│  └─────────────────────────────────┘│
│                                     │
│  If ALL criteria pass:              │
│      → SIA intervention: SUCCESS    │
│      → Log to memory                │
│      → Move to next task            │
│                                     │
│  If ANY criteria fail:              │
│      → SIA intervention: FAIL       │
│      → Try different technique      │
│      → OR escalate if exhausted     │
│                                     │
└─────────────────────────────────────┘
```

**Key Principle:** The SIA never declares success based on feeling. It only trusts deterministic test results.

---

## SIA Failsafe Protocols

### Circuit Breakers

| Failsafe | Threshold | Action |
|----------|-----------|--------|
| **Max SIA attempts** | 5 prompt variations | Escalate to human |
| **Max credits per task** | Configurable limit | Pause and notify user |
| **Time limit** | 30 minutes per task | Force checkpoint |
| **Impossible task detection** | All techniques exhausted | Return credits, explain limitation |

### Escalation Flow

```
SIA has tried 5 different approaches
         │
         ▼
┌─────────────────────────────────────┐
│      HUMAN ESCALATION PACKAGE      │
├─────────────────────────────────────┤
│                                     │
│  To: User (or Support)              │
│                                     │
│  Subject: Help needed with          │
│           "Build user auth"         │
│                                     │
│  Status: Stuck after 5 attempts     │
│                                     │
│  What I tried:                      │
│  1. Original approach → fail        │
│  2. Decomposition → fail            │
│  3. Example injection → fail        │
│  4. Context pruning → fail          │
│  5. Fresh start → fail              │
│                                     │
│  The specific blocker:              │
│  "OAuth provider config unclear.    │
│   Spec says 'social login' but      │
│   doesn't specify which providers." │
│                                     │
│  What I need:                       │
│  Which OAuth providers should I     │
│  implement?                         │
│  A) Google only (fastest)           │
│  B) Google + Apple                  │
│  C) Google + Facebook + Apple       │
│                                     │
│  [Link to full transcript]          │
│                                     │
└─────────────────────────────────────┘
```

---

## SIA Relationship to Other Agents

The SIA is **specific to the Build phase**. Here's how it fits in the broader system:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIBE AGENT ECOSYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  IDEATION PHASE          SPECIFICATION PHASE                    │
│  ┌────────────────┐      ┌────────────────┐                     │
│  │  Ideation      │──────│  Spec          │                     │
│  │  Agent         │      │  Agent         │                     │
│  └────────────────┘      └────────┬───────┘                     │
│         │                         │                              │
│         │    ┌────────────────────┘                              │
│         │    │                                                   │
│         ▼    ▼                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     BUILD PHASE                           │   │
│  │                                                           │   │
│  │  ┌────────────┐                   ┌────────────┐         │   │
│  │  │   Build    │◄──── optimizes ───│    SIA     │         │   │
│  │  │   Agent    │                   │            │         │   │
│  │  └────────────┘                   └────────────┘         │   │
│  │        │                                │                 │   │
│  │        │                                │                 │   │
│  │        ▼                                │                 │   │
│  │  ┌────────────┐                         │                 │   │
│  │  │  Testing   │ ◄─── informs ───────────┘                 │   │
│  │  │  Agent     │                                           │   │
│  │  └────────────┘                                           │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ▼                                                        │
│  RUNTIME PHASE                                                   │
│  ┌────────────────┐      ┌────────────────┐                     │
│  │  Support       │      │  Network       │                     │
│  │  Agent         │      │  Agent         │                     │
│  └────────────────┘      └────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

NOTES:
• SIA ONLY operates in Build Phase
• SIA does NOT modify Ideation or Spec agents
• SIA learnings CAN inform Testing Agent scenarios
• Future: SIA could evolve to improve other agent types
```

---

## Example Scenario: Full SIA Intervention

### Scenario: Building a Restaurant Booking App

**Task:** Create booking confirmation email functionality

**Attempt 1 (No SIA):**
```
Agent Transcript:
> Generating email template...
> Setting up SendGrid integration...
> ERROR: SendGrid API key not found in environment
> Attempting to create API key...
> ERROR: Cannot create API key without account credentials
> Retrying with fallback...
> ERROR: Same issue
> Task status: FAIL
```

**SIA Activation:**
```
SIA Analysis:
• Pattern detected: External dependency blocker
• Agent is trying to access external service without credentials
• This is an environment configuration issue, not a code issue

Technique selected: Abstraction Level Shift
• Move from "integrate SendGrid" to "create email sending interface"
• Allow email provider to be configured later

Modified Prompt:
"Create an email sending module with a clean interface.
Implement a MockEmailSender for development that logs emails to console.
Create an interface that can be swapped for SendGrid/Resend/etc later.
Do NOT attempt to connect to real email services in this task."
```

**Attempt 2 (With SIA Modification):**
```
Agent Transcript:
> Creating EmailSender interface...
> Implementing MockEmailSender for development...
> Creating BookingConfirmationEmail template...
> Testing with MockEmailSender...
> ✓ Email logged to console
> ✓ Template renders correctly
> ✓ All tests pass
> Task status: PASS
```

**SIA Memory Update:**
```json
{
  "learning": {
    "pattern": "external-dependency-blocker",
    "effective_technique": "abstraction-level-shift",
    "specific_insight": "When external service credentials missing, abstract the interface and mock for development",
    "confidence": 0.85
  }
}
```

---

## SIA Evolution Roadmap

### MVP (Current Design)
- SIA operates only in Build Phase
- Fixed techniques library (10 techniques)
- Simple pattern matching for technique selection
- Human escalation as fallback

### Post-MVP
- SIA learns new techniques from successful human interventions
- Cross-task learning (patterns from Task A help Task B)
- Confidence-weighted technique selection
- Reduced escalation rate (<5%)

### Scale Phase
- SIA improves other agent types (Ideation, Spec, Network)
- Federated learning across all Vibe instances
- Automatic technique discovery
- Predictive intervention (before agent gets stuck)

---

## Metrics & Monitoring

### SIA Performance Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| **Intervention Success Rate** | >70% | % of SIA interventions that resolve the stuck loop |
| **First-Attempt Resolution** | >50% | % resolved on first SIA technique |
| **Escalation Rate** | <30% | % that still require human after SIA |
| **Average Techniques Tried** | <3 | Mean techniques before resolution |
| **Credit Efficiency** | Improving | Credits per successful task (should decrease) |

### Dashboards

```
┌─────────────────────────────────────────────────────────────┐
│                    SIA PERFORMANCE DASHBOARD                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Today's Interventions: 47                                   │
│  Success Rate: 74% ▲                                         │
│  Average Techniques: 2.3                                     │
│                                                              │
│  Technique Effectiveness:                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Decomposition:        ████████████████████░░░░  78%     ││
│  │ Example Injection:    ███████████████░░░░░░░░░  62%     ││
│  │ Context Pruning:      ██████████████░░░░░░░░░░  58%     ││
│  │ Fresh Start:          ████████░░░░░░░░░░░░░░░░  33%     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Common Failure Patterns (This Week):                        │
│  1. External dependency issues (23 occurrences)              │
│  2. Interdependent component failures (19 occurrences)       │
│  3. Unclear specifications (12 occurrences)                  │
│                                                              │
│  Recent Escalations (Requires Attention):                    │
│  • Task #4521: OAuth provider unclear                        │
│  • Task #4518: Custom animation requirements                 │
│  • Task #4515: Third-party API undocumented                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Notes

### SIA System Prompt Structure

```
You are the Self-Improvement Agent (SIA) for Vibe.

Your purpose: When a coding agent fails to complete a task on repeated attempts, analyze why and propose a modified approach.

## Your Inputs
- Previous agent transcript (every action taken)
- Task specification with pass/fail criteria
- History of previous interventions for this task

## Your Techniques Library
[Full techniques from above table]

## Your Process
1. Identify the failure point in the transcript
2. Classify the failure pattern
3. Check what techniques have been tried
4. Select an untried technique that matches the pattern
5. Generate a modified system prompt for the coding agent
6. Explain your hypothesis for why this should work

## Your Constraints
- Never declare success without test results
- Never try the same technique twice
- After 5 attempts, escalate to human with clear summary
- Always log your decision rationale

## Output Format
{
  "diagnosis": "What went wrong",
  "pattern": "Failure pattern classification",
  "technique": "Selected technique name",
  "modified_prompt": "New system prompt for coding agent",
  "hypothesis": "Why this should work",
  "confidence": 0.0-1.0
}
```

### File Structure

```
/agents/
  /sia/
    system-prompt.md          # SIA's instructions
    techniques-library.md     # Full technique documentation
    memory/
      task-{uuid}.json        # Per-task memory files
    metrics/
      daily-summary.json      # Aggregated metrics
```

---

*This document defines the Self-Improvement Agent architecture. It is designed to be implemented incrementally, starting with the core loop and expanding to full technique library.*

*Last updated: January 4, 2025*
