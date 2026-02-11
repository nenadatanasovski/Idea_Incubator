# Proactive Loop Specification

> **Source of Truth** for the bidirectional proactive improvement loop.
>
> Related: `00-ARCHITECTURE-OVERVIEW.md` (ARCH-013, ARCH-017, ARCH-023, ARCH-027-030)

---

## Overview

The proactive loop is the self-evolution engine of Vibe. It's **bidirectional**:

1. **System → Human:** Proposals, decisions needing approval, status updates
2. **Human → System:** Answers when agents are stuck (arch clarifications, coding decisions)

---

## Vertical Slice First

Before building the full loop, get end-to-end working ugly:

```
1. Hardcode 1 gap: "Decision X has no evidence"
2. Generate 1 proposal: "Research evidence for X"
3. Log to console (not Telegram)
4. Hardcode approval
5. Mark proposal executed
6. THEN add Telegram, real gap analysis, debate, etc.
```

---

## Loop Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           PROACTIVE LOOP                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  TRIGGER ──▶ GAP ANALYSIS ──▶ PROPOSAL ──▶ DEBATE ──▶ NOTIFY ──▶ HUMAN  │
│     │              │              │            │          │         │     │
│     │              ▼              ▼            ▼          ▼         ▼     │
│     │          (fail: retry)  (fail: log)  (fail:     (fail:    APPROVE  │
│     │                                      escalate)  queue)    REJECT   │
│     │                                                              │      │
│     │◀─────────────────────────── EXECUTE ◀────────────────────────┘      │
│     │                                                                     │
│     │                         STUCK? ──────▶ ESCALATE ──▶ HUMAN          │
│     │                                                       │             │
│     │◀──────────────────────────────────────────────────────┘             │
│                                                              (answer)     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Triggers (ARCH-013)

### Event-Driven

| Event              | Action                          |
| ------------------ | ------------------------------- |
| Block created      | Gap analysis on related context |
| Task completed     | Re-evaluate dependencies        |
| Task failed        | Escalate to human               |
| Evidence added     | Re-score related assumptions    |
| Approval received  | Execute proposal                |
| Rejection received | Learn, don't re-propose similar |

### Scheduled

| Schedule    | Action                               |
| ----------- | ------------------------------------ |
| Daily       | Full gap analysis against North Star |
| Hourly      | Health check on all loops            |
| Every 15min | Check for stuck agents               |

### Implementation

```python
# coding-loops/cron/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('cron', hour=9)
async def daily_gap_analysis():
    await trigger_job('gap_analysis', {})

@scheduler.scheduled_job('interval', minutes=15)
async def check_stuck():
    stuck = await find_stuck_agents(threshold_minutes=15)
    for agent in stuck:
        await escalate_to_human(agent)
```

---

## 2. Gap Analysis

### MVP Query (ARCH-027)

Start with "decisions lacking evidence":

```cypher
MATCH (d:Block:Decision)
WHERE d.status = 'active'
AND NOT exists((d)<-[:SUPPORTS|EVIDENCE_FOR]-(:Block:Evidence))
RETURN d
ORDER BY d.createdAt ASC
LIMIT 5
```

### Gap Structure

```typescript
interface Gap {
  id: string;
  type:
    | "unvalidated_decision"
    | "missing_capability"
    | "blocked_task"
    | "unvalidated_assumption";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  relatedBlocks: string[];
  suggestedAction: string;
}
```

### Error Handling

| Failure                | Recovery                            |
| ---------------------- | ----------------------------------- |
| Neo4j connection fails | Retry 3x with backoff, then alert   |
| Query times out        | Reduce scope (LIMIT 3), log warning |
| No gaps found          | Log info, skip cycle (not an error) |

---

## 3. Proposal Generator

### Input

- Gap from analysis
- Context from graph
- Past rejections (avoid repeating)

### Output

- Proposal block stored in Neo4j

### Proposal Structure

```typescript
interface Proposal {
  id: string;
  type: "proposal";
  title: string;
  content: string;
  proposalType:
    | "feature"
    | "improvement"
    | "fix"
    | "architecture"
    | "knowledge";
  addressesGap: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  status: "draft" | "debating" | "ready" | "approved" | "rejected" | "executed";
  confidence: number;
}
```

### Status Lifecycle

```
draft → debating → ready → approved → executing → executed
                      ↘ rejected (with reason)
```

### Error Handling

| Failure             | Recovery                     |
| ------------------- | ---------------------------- |
| LLM call fails      | Retry 2x, then skip this gap |
| Proposal too vague  | Log for manual review        |
| Similar to rejected | Skip, log as "avoided"       |

---

## 4. Auto-Debate (ARCH-023)

Before human sees proposal, red team vets it.

### Flow

```
Proposer → Critic (challenges) → Arbiter (decides)
```

### Outcomes

| Outcome     | Action                     |
| ----------- | -------------------------- |
| Strong pass | Mark ready, send to human  |
| Weak pass   | Strengthen, re-debate once |
| Fail        | Reject, don't show human   |

### Error Handling

| Failure                | Recovery                                       |
| ---------------------- | ---------------------------------------------- |
| Debate loops >3 rounds | Escalate to human with both positions          |
| Critic always rejects  | Log pattern, review critic prompts             |
| Arbiter undecided      | Default to showing human with "uncertain" flag |

---

## 5. Notification (ARCH-020, ARCH-028)

### Batching Rules

- Group by theme (same gap type)
- Max 5 per notification
- Prioritize by impact
- Don't repeat recently rejected

### Telegram Format

```
🔔 *Vibe Proposals* (3 items)

*1. Add caching layer* [HIGH]
Gap: Performance below target
→ /approve_1 or /reject_1

*2. Update auth flow* [MEDIUM]
Gap: Security review finding
→ /approve_2 or /reject_2

Reply number for details. /reject_N [never|not_now|bad_approach]
```

### Complex Proposals → Web

```
🔔 *Architecture Proposal*

*Migrate to event sourcing*

This needs detailed review:
→ [View proposal](https://vibe.app/proposals/123)

Reply /approve or /reject after reviewing.
```

### Error Handling

| Failure            | Recovery                           |
| ------------------ | ---------------------------------- |
| Telegram API fails | Queue message, retry every 5min    |
| Rate limited       | Batch more aggressively, slow down |
| Message too long   | Split or link to web               |

---

## 6. Human Escalation (Questions)

### Escalation SLA

| Duration Stuck | Action                  |
| -------------- | ----------------------- |
| 5 min          | Log to debug            |
| 15 min         | Publish to message bus  |
| 30 min         | Send Telegram question  |
| 2 hours        | Re-send with 🔴 URGENT  |
| 8 hours        | Pause loop, await human |

### Question Format

```
❓ *[Build Agent] needs help*

**Task:** Implement user authentication
**Stuck on:** Which OAuth provider to use

**Question:**
Should we use Auth0, Firebase Auth, or roll our own?

**Options:**
A) Auth0 - managed, costs $$$
B) Firebase - Google lock-in
C) Custom - more control, more work

**Blocked:** 3 downstream tasks waiting

Reply A, B, or C with optional reasoning.
```

### Question Structure

```typescript
interface EscalationQuestion {
  id: string;
  agentName: string;
  taskId: string;
  question: string;
  options?: string[];
  context: string[];
  blockedTasks: string[];
  askedAt: Date;
  urgency: "normal" | "urgent" | "critical";
}
```

### Answer Flow

1. Human replies via Telegram
2. Parse answer (option letter or free text)
3. Store as Decision block in Neo4j
4. Notify agent via message bus
5. Agent resumes with decision as context

### Error Handling

| Failure                      | Recovery                         |
| ---------------------------- | -------------------------------- |
| Human gives unclear answer   | Ask clarifying follow-up         |
| Human ignores for 24h        | Re-escalate with higher urgency  |
| Answer doesn't match options | Accept free text, log for review |

---

## 7. Approval Flow

### Commands

| Command                  | Action                    |
| ------------------------ | ------------------------- |
| `/approve_N`             | Approve proposal N        |
| `/reject_N`              | Reject (default: not_now) |
| `/reject_N never`        | Never propose similar     |
| `/reject_N not_now`      | Try again later           |
| `/reject_N bad_approach` | Approach is wrong         |

### Rejection Learning (ARCH-029)

Store rejection to avoid repeating:

```cypher
MATCH (p:Proposal {id: $id})
SET p.status = 'rejected',
    p.rejectionType = $type,
    p.rejectionReason = $reason,
    p.rejectedAt = datetime()
```

Before generating similar:

```cypher
MATCH (p:Proposal)
WHERE p.status = 'rejected'
AND p.rejectionType = 'never'
RETURN p.title, p.content
```

---

## 8. Autonomy Tiers (ARCH-030)

| Block Type      | Autonomy         |
| --------------- | ---------------- |
| Knowledge       | Auto-create      |
| Evidence        | Auto-create      |
| Question        | Auto-create      |
| Assumption      | Auto-create      |
| Task (P3)       | Auto-approve     |
| Task (P0-P2)    | Require approval |
| Decision        | Require approval |
| Proposal        | Require approval |
| Artifact (code) | Require approval |
| North Star      | Require approval |

```typescript
function requiresApproval(block: Block): boolean {
  const autoCreate = ["knowledge", "evidence", "question", "assumption"];
  if (autoCreate.includes(block.type)) return false;

  if (block.type === "task" && block.priority === "P3") return false;

  return true;
}
```

---

## 9. Outcome Metrics

| Metric                     | Target | Meaning                       |
| -------------------------- | ------ | ----------------------------- |
| Proposal acceptance rate   | >50%   | System proposes useful things |
| Gap detection accuracy     | >80%   | Gaps are real, not noise      |
| Escalation resolution time | <4h    | Humans respond promptly       |
| Loop stuck rate            | <5%    | System rarely blocks          |

---

## 10. Exit Criteria (Phase 2)

- [ ] Gap analysis runs daily
- [ ] Finds "decisions lacking evidence" correctly
- [ ] Proposals stored in Neo4j
- [ ] Debate filters weak proposals (>30% filtered)
- [ ] Notifications sent to Telegram
- [ ] Human can approve/reject via reply
- [ ] Rejection reason stored
- [ ] Questions escalated when stuck
- [ ] Answers flow back to agents
- [ ] Full cycle works: gap → propose → debate → approve → execute

---

## Revision History

| Date       | Change                                                                | Author         |
| ---------- | --------------------------------------------------------------------- | -------------- |
| 2026-02-05 | Initial creation                                                      | AI Agent (Kai) |
| 2026-02-05 | Added error handling, escalation SLA, question format, vertical slice | AI Agent (Kai) |

---

_This is a source-truth document. Changes require founder review._
