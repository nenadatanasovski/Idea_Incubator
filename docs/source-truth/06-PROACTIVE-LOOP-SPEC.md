# Proactive Loop Specification

> **Source of Truth** for the bidirectional proactive improvement loop.
> 
> Related: `00-ARCHITECTURE-OVERVIEW.md` (ARCH-013, ARCH-017, ARCH-023, ARCH-027-030)

---

## Overview

The proactive loop is the self-evolution engine of Vibe. It's **bidirectional**:

1. **System → Human:** Proposals, decisions needing approval, status updates
2. **Human → System:** Answers when agents are stuck (arch clarifications, coding decisions)

This ensures the system never stays stuck silently.

---

## Loop Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROACTIVE LOOP                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  │ Trigger  │────▶│   Gap    │────▶│ Proposal │────▶│  Debate  │           │
│  │          │     │ Analysis │     │Generator │     │ (Red Tm) │           │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘           │
│       │                                                   │                  │
│       │ (event/cron)                                      ▼                  │
│       │                                            ┌──────────┐             │
│       │                                            │  Batch   │             │
│       │                                            │ & Notify │             │
│       │                                            └──────────┘             │
│       │                                                   │                  │
│       │                                                   ▼                  │
│       │                                            ┌──────────┐             │
│       │            ┌─────────────────────────────▶│  Human   │             │
│       │            │  Questions when stuck        │          │             │
│       │            │                              └──────────┘             │
│       │            │                                    │                   │
│       │      ┌──────────┐                               │ approve/reject    │
│       │      │ Escalate │                               │ + answers         │
│       │      │  Agent   │◀──────────────────────────────┘                   │
│       │      └──────────┘                               │                   │
│       │            │                                    ▼                   │
│       │            │ (when stuck)               ┌──────────┐               │
│       │            │                            │ Execute  │               │
│       │            ▼                            │          │               │
│       │      ┌──────────┐                       └──────────┘               │
│       └─────▶│ Coding   │                             │                    │
│              │  Loops   │◀────────────────────────────┘                    │
│              └──────────┘                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Triggers (ARCH-013)

### Event-Driven Triggers

| Event | Triggers |
|-------|----------|
| New block created | Gap analysis on related context |
| Task completed | Re-evaluate dependencies |
| Task failed | Escalation to human |
| Evidence added | Re-score related assumptions |
| Approval received | Execute approved proposal |
| Rejection received | Learn from rejection (ARCH-029) |

### Scheduled Triggers

| Schedule | Action |
|----------|--------|
| Daily (9am) | Full gap analysis against North Star |
| Hourly | Health check on all loops |
| Every 15min | Check for stuck agents |

### Implementation

```python
# coding-loops/cron/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from api.routes.jobs import trigger_job

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('cron', hour=9, minute=0)
async def daily_gap_analysis():
    await trigger_job(JobTrigger(job_type='gap_analysis'))

@scheduler.scheduled_job('interval', minutes=15)
async def check_stuck_agents():
    stuck = await find_stuck_agents()
    for agent in stuck:
        await escalate_to_human(agent)
```

---

## 2. Gap Analysis Agent

### Input
- North Star (vision, capabilities, constraints)
- Current state (all active blocks)
- Recent changes

### Output
- List of gaps (what's missing vs North Star)
- Prioritized by impact
- Evidence for each gap

### Query Pattern

```cypher
// Get North Star vision
MATCH (ns:Block:Knowledge {topic: 'north_star'})
WHERE ns.status = 'active'
RETURN ns

// Get current capabilities
MATCH (c:Block:Knowledge {topic: 'capability'})
WHERE c.status = 'active'
RETURN c

// Find decisions without evidence (ARCH-027 MVP)
MATCH (d:Block:Decision)
WHERE d.status = 'active'
AND NOT exists((d)<-[:SUPPORTS|EVIDENCE_FOR]-(:Block:Evidence))
RETURN d
ORDER BY d.createdAt DESC
```

### Gap Structure

```typescript
interface Gap {
  id: string;
  type: 'missing_capability' | 'unvalidated_assumption' | 'unsupported_decision' | 'blocked_task';
  description: string;
  impact: 'critical' | 'significant' | 'minor';
  relatedBlocks: string[];  // Block IDs
  suggestedAction: string;
}
```

---

## 3. Proposal Generator

### Input
- Gaps from analysis
- Context from graph
- Past rejections (to avoid repeating)

### Output
- Proposals (block type: `proposal`)

### Proposal Structure

```typescript
interface Proposal {
  id: string;
  type: 'proposal';
  title: string;
  content: string;
  proposalType: 'feature' | 'improvement' | 'fix' | 'architecture' | 'knowledge';
  addressesGap: string;  // Gap ID
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  status: 'draft' | 'debating' | 'ready' | 'approved' | 'rejected' | 'executed';
  confidence: number;
  properties: {
    debateStatus?: string;
    debateOutcome?: string;
    approvalStatus?: string;
    rejectionReason?: string;
  };
}
```

### Neo4j Storage

```cypher
CREATE (p:Block:Proposal {
  id: $id,
  sessionId: $sessionId,
  title: $title,
  content: $content,
  status: 'draft',
  confidence: 0.7,
  properties: $propertiesJson,
  createdAt: datetime()
})

// Link to gap
MATCH (g:Gap {id: $gapId})
CREATE (p)-[:ADDRESSES]->(g)
```

---

## 4. Auto-Debate (ARCH-023)

Before presenting to human, proposals go through red-team debate.

### Debate Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Proposer │────▶│ Critic   │────▶│ Arbiter  │
│          │     │ (Red Tm) │     │          │
└──────────┘     └──────────┘     └──────────┘
     │                │                │
     │                │                ▼
     │                │         Strengthened
     │                │         Proposal or
     │                │         Rejected
     │                │
     ▼                ▼
   Original      Challenges
   Proposal
```

### Debate Outcome

| Outcome | Action |
|---------|--------|
| Passes debate | Mark ready, send to human |
| Fails debate (weak) | Strengthen and re-debate |
| Fails debate (fundamentally flawed) | Reject, don't send to human |

### Existing Code

`agents/debate.ts` already implements debate patterns. Integrate with proposal flow.

---

## 5. Batching & Notification (ARCH-028, ARCH-020)

### Batching Rules

- Group proposals by theme (same gap type or related blocks)
- Maximum 5 proposals per notification
- Prioritize by impact
- Don't repeat recently rejected proposals

### Notification Format (Telegram)

```
🔔 *Vibe Proposals* (3 items)

*1. Add caching layer* (HIGH impact)
Gap: Performance below target
→ /approve_1 or /reject_1

*2. Update auth flow* (MEDIUM impact)
Gap: Security review finding
→ /approve_2 or /reject_2

*3. Add error tracking* (LOW impact)
Gap: Missing observability
→ /approve_3 or /reject_3

Reply with number to see details.
View all: [web link]
```

### Complex Proposals → Web

When proposal needs more context (architecture changes, multiple options), link to web view:

```
🔔 *Architecture Proposal*

*Migrate to event sourcing*

This is a significant change. Review details:
→ [View full proposal](https://vibe.app/proposals/arch-001)

Reply /approve or /reject after reviewing.
```

---

## 6. Human Escalation (Questions)

When agents get stuck, they escalate to human.

### Escalation Triggers

| Trigger | Example |
|---------|---------|
| Coding loop blocked | "Test fails, can't figure out why" |
| Architecture unclear | "Should this be sync or async?" |
| Priority conflict | "Task A and B both need same file" |
| External dependency | "Need API key for service X" |

### Question Format

```
❓ *Agent needs help*

*Build Agent* is stuck on:
Task: Implement user auth

Question:
"Should password reset use email or SMS verification?"

Context:
- No decision exists in graph
- Both options have tradeoffs
- Blocking 2 downstream tasks

Reply with your decision or type /details for more context.
```

### Question Structure

```typescript
interface EscalationQuestion {
  id: string;
  agentName: string;
  taskId: string;
  question: string;
  context: string[];  // Relevant block IDs
  options?: string[];  // If multiple choice
  blockedTasks: string[];
  askedAt: Date;
  answeredAt?: Date;
  answer?: string;
}
```

### Answer Flow

1. Human answers via Telegram
2. Answer stored as Decision block
3. Agent notified via message bus
4. Agent resumes with answer as context

---

## 7. Approval Flow

### Approval States

```
draft → debating → ready → approved → executing → executed
                       ↘ rejected
```

### Approval Commands

| Command | Action |
|---------|--------|
| `/approve_N` | Approve proposal N |
| `/reject_N` | Reject proposal N |
| `/reject_N never` | Reject + never propose similar (ARCH-029) |
| `/reject_N not_now` | Reject + try again later |
| `/reject_N bad_approach` | Reject + approach is wrong |

### Rejection Learning (ARCH-029)

Store rejection reason to improve future proposals:

```cypher
MATCH (p:Proposal {id: $proposalId})
SET p.status = 'rejected',
    p.properties = apoc.convert.toJson(
      apoc.convert.fromJsonMap(p.properties) + {
        rejectionType: $rejectionType,
        rejectionReason: $reason,
        rejectedAt: datetime()
      }
    )
```

Query past rejections before generating similar proposals:

```cypher
MATCH (p:Proposal)
WHERE p.status = 'rejected'
AND p.properties CONTAINS 'never'
RETURN p.title, p.content
```

---

## 8. Autonomy Tiers (ARCH-030)

| Block Type | Autonomy |
|------------|----------|
| Knowledge | Auto-approve (low risk) |
| Evidence | Auto-approve |
| Question | Auto-create |
| Assumption | Auto-create, human validates |
| Task | Require approval if > P2 |
| Decision | Require approval |
| Proposal | Require approval |
| Artifact (code) | Require approval |
| North Star | Require approval |

### Implementation

```typescript
function requiresApproval(block: Block): boolean {
  const autoApprove = ['knowledge', 'evidence', 'question'];
  if (autoApprove.includes(block.type)) return false;
  
  if (block.type === 'task' && block.priority === 'P3') return false;
  
  return true;
}
```

---

## 9. MVP Loop: Decisions Lacking Evidence (ARCH-027)

First test of full pipeline:

### Query
```cypher
MATCH (d:Block:Decision)
WHERE d.status = 'active'
AND NOT exists((d)<-[:SUPPORTS|EVIDENCE_FOR]-(:Block:Evidence))
RETURN d
ORDER BY d.createdAt ASC
LIMIT 5
```

### Gap
"Decision X has no supporting evidence"

### Proposal
"Research evidence for decision X" or "Mark decision X as assumption"

### Execution
- Research agent gathers evidence
- Or human provides evidence
- Or decision downgraded to assumption

---

## 10. Exit Criteria

### Phase 2 Complete When:

- [ ] Gap Analysis runs daily
- [ ] Proposals created and stored in Neo4j
- [ ] Debate runs before human sees proposals
- [ ] Notifications sent to Telegram
- [ ] Approval/rejection works via chat
- [ ] Rejection reasons stored
- [ ] Questions escalated when agents stuck
- [ ] Answers flow back to agents
- [ ] MVP loop "decisions lacking evidence" runs

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Initial creation | AI Agent (Kai) |

---

*This is a source-truth document. Changes require founder review.*
