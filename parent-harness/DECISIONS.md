# Design Decisions - Approved by Ned (2026-02-06)

## Core Concept

The Parent Harness runs **COPIES** of the Vibe platform agents on a separate server. These agent copies are used as a litmus test to build and verify the Vibe platform itself. They are NOT the same instances - they run independently.

---

## D1: Telegram Channels ✅ APPROVED (with additions)

**Decision:** Hybrid approach with per-agent channels

**Channels:**
```
@vibe-critical      → All agents: errors, blocks, completions, human-needed
@vibe-orchestrator  → Orchestrator: coordination, scheduling
@vibe-build         → Build Agent: file edits, commits, test results
@vibe-spec          → Spec Agent: PRD generation, requirements
@vibe-qa            → QA Agent: verification, 15-min audits
@vibe-task          → Task Agent: task creation, decomposition
@vibe-sia           → SIA Agent: ideation sessions, idea captures
@vibe-research      → Research Agent: web searches, findings
@vibe-evaluator     → Evaluator Agent: idea scoring, viability
@vibe-decomposition → Decomposition Agent: epic/story breakdown
@vibe-validation    → Validation Agent: spec validation
@vibe-agents        → All agents: verbose debug firehose
```

**Note from Ned:** "You are missing agents" - added evaluator, decomposition, validation channels.

---

## D2: Task Database ✅ APPROVED

**Decision:** Separate database, but use Vibe's task structure as starting point

**Implementation:**
- Copy `types/task-agent.ts` structure
- Copy database schema from Vibe
- Refine as needed during development
- Keep separate from Vibe's SQLite

**From Ned:** "Keep task db separate but utilise the same task db structure and system as vibe initially as a starting point and refine as needed"

---

## D3: Deployment ✅ APPROVED

**Decision:** Docker Compose on same machine, designed for VPS migration

**From Ned:** "Yes"

---

## D4: Folder Location ✅ APPROVED

**Decision:** Create `parent-harness/` folder in project root

**From Ned:** "Create new folder 'parent-harness'"

---

## D5: Inter-Agent Communication ✅ APPROVED

**Decision:** Message bus (SQLite events) + Orchestrator coordination

**From Ned:** "Correct"

---

## D6: Stuck Detection ✅ APPROVED (modified)

**Decision:** QA Agent audits every 15 minutes and decides if agents are stuck

**Key Change from Original:**
- ❌ No timeout pause
- ✅ QA Agent checks CLI output every 15 minutes
- ✅ If genuinely stuck → QA ends the agent session
- ✅ Agents MUST be verbose (list all tool calls and Claude skill uses)

**From Ned:** "No timeout pause - qa agent decides to end the agent's session every 15min and if the cli output shows its genuinely stuck - this is why its important the agents are verbose by listing the tool calls and claude skill uses"

---

## D7: Git Workflow ✅ APPROVED

**Decision:** Branch per task, auto-merge to `dev`, human review to `main`

**Branches:**
- `main` - protected, human review required
- `dev` - auto-merge target for QA-passed tasks
- `task/TASK-XXX-slug` - per-task branches

**From Ned:** "Yes - you will need to create a dev branch"

**Status:** `dev` branch created ✅

---

## D8: Budget & Rate Limits ✅ APPROVED (modified)

**Decision:** No budget limits

**From Ned:** "No budget"

**Implication:** Remove all token tracking and cost caps. Agents run without resource constraints.

---

## Summary

| # | Decision | Status |
|---|----------|--------|
| D1 | Telegram Channels | ✅ Approved (expanded) |
| D2 | Task Database | ✅ Approved (use Vibe structure) |
| D3 | Deployment | ✅ Approved |
| D4 | Folder Location | ✅ Approved (parent-harness/) |
| D5 | Agent Communication | ✅ Approved |
| D6 | Stuck Detection | ✅ Approved (QA every 15min) |
| D7 | Git Workflow | ✅ Approved (dev branch created) |
| D8 | Budget | ✅ Approved (no limits) |

---

*Approved: 2026-02-06 10:59 AEDT*
