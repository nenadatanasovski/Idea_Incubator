# North Star Schema

> **Source of Truth** for how Vibe's vision, capabilities, and constraints are stored.
> 
> Related: `00-ARCHITECTURE-OVERVIEW.md` (ARCH-021), `02-NEO4J-SCHEMA.md`

---

## Overview

The North Star is what Vibe is trying to become. Gap Analysis compares current state against North Star to find what's missing.

Per ARCH-021, North Star is stored as a **Neo4j subgraph** using the existing 9 block types — not a separate schema.

---

## North Star Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NORTH STAR                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  VISION (Knowledge blocks, topic: "north_star_vision")                      │
│  ├── "Vibe transforms ideas into AI-managed SaaS products"                  │
│  └── "Self-evolving platform that improves itself"                          │
│                                                                              │
│  CAPABILITIES (Knowledge blocks, topic: "north_star_capability")            │
│  ├── "Can analyze gaps against vision"                                      │
│  ├── "Can generate proposals for improvements"                              │
│  ├── "Can execute approved proposals autonomously"                          │
│  └── "Can ask humans when stuck"                                            │
│                                                                              │
│  CONSTRAINTS (Requirement blocks, topic: "north_star_constraint")           │
│  ├── "Human approves all code changes"                                      │
│  ├── "Deterministic by default, AI only where needed"                       │
│  └── "Never exfiltrate private data"                                        │
│                                                                              │
│  PRIORITIES (Decision blocks, topic: "north_star_priority")                 │
│  ├── "P0: Foundation (storage, core loop)"                                  │
│  ├── "P1: Self-evolution (proactive loop)"                                  │
│  └── "P2: User ideas (after self-evolution works)"                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Block Types for North Star

| Concept | Block Type | Topic Tag |
|---------|------------|-----------|
| Vision | Knowledge | `north_star_vision` |
| Capability | Knowledge | `north_star_capability` |
| Constraint | Requirement | `north_star_constraint` |
| Priority | Decision | `north_star_priority` |

All North Star blocks share:
- `sessionId: "north_star"` (special session)
- `status: "active"`
- `abstractionLevel: "vision"` or `"strategy"`

---

## Neo4j Queries

### Get All North Star Content

```cypher
MATCH (b:Block)
WHERE b.sessionId = 'north_star'
AND b.status = 'active'
RETURN b
ORDER BY b.topic, b.createdAt
```

### Get Vision

```cypher
MATCH (b:Block:Knowledge)
WHERE b.sessionId = 'north_star'
AND b.topic = 'north_star_vision'
AND b.status = 'active'
RETURN b
```

### Get Capabilities

```cypher
MATCH (b:Block:Knowledge)
WHERE b.sessionId = 'north_star'
AND b.topic = 'north_star_capability'
AND b.status = 'active'
RETURN b
```

### Get Constraints

```cypher
MATCH (b:Block:Requirement)
WHERE b.sessionId = 'north_star'
AND b.topic = 'north_star_constraint'
AND b.status = 'active'
RETURN b
```

### Get Priorities

```cypher
MATCH (b:Block:Decision)
WHERE b.sessionId = 'north_star'
AND b.topic = 'north_star_priority'
AND b.status = 'active'
RETURN b
ORDER BY b.title  // P0, P1, P2 sort naturally
```

---

## Gap Analysis Against North Star

### Check: Capability Implemented?

```cypher
// For each capability, check if there's evidence of implementation
MATCH (cap:Block:Knowledge {sessionId: 'north_star', topic: 'north_star_capability'})
WHERE cap.status = 'active'
OPTIONAL MATCH (cap)<-[:SUPPORTS|EVIDENCE_FOR]-(evidence:Block:Evidence)
WHERE evidence.status = 'active'
RETURN cap.title as capability, 
       count(evidence) as evidence_count,
       CASE WHEN count(evidence) > 0 THEN 'implemented' ELSE 'gap' END as status
```

### Check: Constraint Violated?

```cypher
// Constraints that have violations
MATCH (constraint:Block:Requirement {sessionId: 'north_star', topic: 'north_star_constraint'})
WHERE constraint.status = 'active'
OPTIONAL MATCH (constraint)<-[:CONFLICTS_WITH]-(violation:Block)
WHERE violation.status = 'active'
RETURN constraint.title, collect(violation.title) as violations
```

### Check: Priority Progress

```cypher
// Tasks related to each priority
MATCH (priority:Block:Decision {sessionId: 'north_star', topic: 'north_star_priority'})
WHERE priority.status = 'active'
OPTIONAL MATCH (priority)<-[:DEPENDS_ON|SUPPORTS]-(task:Block:Task)
RETURN priority.title,
       count(CASE WHEN task.status = 'completed' THEN 1 END) as completed,
       count(CASE WHEN task.status = 'active' THEN 1 END) as in_progress,
       count(CASE WHEN task.status = 'blocked' THEN 1 END) as blocked
```

---

## Initial Seed: Vibe as Idea #0

When seeding the North Star, create these blocks:

### Vision Blocks

```cypher
CREATE (v1:Block:Knowledge {
  id: 'ns-vision-001',
  sessionId: 'north_star',
  topic: 'north_star_vision',
  title: 'Self-evolving AI platform',
  content: 'Vibe is a platform that transforms ideas into AI-managed SaaS products. The platform uses the same system to evolve itself (idea #0).',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'vision',
  createdAt: datetime()
})

CREATE (v2:Block:Knowledge {
  id: 'ns-vision-002',
  sessionId: 'north_star',
  topic: 'north_star_vision',
  title: 'Deterministic by default',
  content: 'The system operates deterministically wherever possible. AI is used only for intent detection, gap analysis, proposal generation, and task execution.',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'vision',
  createdAt: datetime()
})
```

### Capability Blocks

```cypher
CREATE (c1:Block:Knowledge {
  id: 'ns-cap-001',
  sessionId: 'north_star',
  topic: 'north_star_capability',
  title: 'Gap detection',
  content: 'System can compare current state against North Star and identify what is missing or misaligned.',
  status: 'active',
  confidence: 0.5,  // Not yet implemented
  abstractionLevel: 'strategy',
  createdAt: datetime()
})

CREATE (c2:Block:Knowledge {
  id: 'ns-cap-002',
  sessionId: 'north_star',
  topic: 'north_star_capability',
  title: 'Proposal generation',
  content: 'System can generate proposals to address identified gaps, with impact and effort estimates.',
  status: 'active',
  confidence: 0.5,
  abstractionLevel: 'strategy',
  createdAt: datetime()
})

CREATE (c3:Block:Knowledge {
  id: 'ns-cap-003',
  sessionId: 'north_star',
  topic: 'north_star_capability',
  title: 'Autonomous execution',
  content: 'System can execute approved proposals through coding loops without human intervention.',
  status: 'active',
  confidence: 0.7,  // Partially built
  abstractionLevel: 'strategy',
  createdAt: datetime()
})

CREATE (c4:Block:Knowledge {
  id: 'ns-cap-004',
  sessionId: 'north_star',
  topic: 'north_star_capability',
  title: 'Human escalation',
  content: 'System can identify when it is stuck and ask humans specific questions to unblock.',
  status: 'active',
  confidence: 0.3,
  abstractionLevel: 'strategy',
  createdAt: datetime()
})

CREATE (c5:Block:Knowledge {
  id: 'ns-cap-005',
  sessionId: 'north_star',
  topic: 'north_star_capability',
  title: 'Parallel execution',
  content: 'Multiple coding loops can run in parallel with coordination via message bus.',
  status: 'active',
  confidence: 0.6,
  abstractionLevel: 'strategy',
  createdAt: datetime()
})
```

### Constraint Blocks

```cypher
CREATE (r1:Block:Requirement {
  id: 'ns-constraint-001',
  sessionId: 'north_star',
  topic: 'north_star_constraint',
  title: 'Human approves code changes',
  content: 'All code changes, architectural decisions, and North Star modifications require explicit human approval.',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'strategy',
  createdAt: datetime()
})

CREATE (r2:Block:Requirement {
  id: 'ns-constraint-002',
  sessionId: 'north_star',
  topic: 'north_star_constraint',
  title: 'No silent failures',
  content: 'System must never stay stuck silently. Escalate to human if blocked for more than 30 minutes.',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'strategy',
  createdAt: datetime()
})

CREATE (r3:Block:Requirement {
  id: 'ns-constraint-003',
  sessionId: 'north_star',
  topic: 'north_star_constraint',
  title: 'Cost cap',
  content: 'Daily LLM spend must not exceed $30 without human approval.',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'tactic',
  createdAt: datetime()
})
```

### Priority Blocks

```cypher
CREATE (p0:Block:Decision {
  id: 'ns-priority-p0',
  sessionId: 'north_star',
  topic: 'north_star_priority',
  title: 'P0: Foundation',
  content: 'Establish solid storage layer (Neo4j, Prisma, FastAPI) and audit existing code.',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'strategy',
  createdAt: datetime()
})

CREATE (p1:Block:Decision {
  id: 'ns-priority-p1',
  sessionId: 'north_star',
  topic: 'north_star_priority',
  title: 'P1: Self-evolution',
  content: 'Build proactive loop so Vibe can improve itself. Gap analysis, proposals, approvals, execution.',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'strategy',
  createdAt: datetime()
})

CREATE (p2:Block:Decision {
  id: 'ns-priority-p2',
  sessionId: 'north_star',
  topic: 'north_star_priority',
  title: 'P2: User ideas',
  content: 'Once self-evolution works, apply same system to user ideas. Vibe becomes a product.',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'strategy',
  createdAt: datetime()
})
```

---

## Updating North Star

North Star changes require human approval (ARCH-030).

### Propose Change

1. System identifies potential North Star improvement
2. Creates Proposal block with `proposalType: "architecture"`
3. Debate validates
4. Human approves
5. Execute: Create/modify North Star block
6. Mark proposal executed

### Example: Adding New Capability

```cypher
// Proposal approved, now add capability
CREATE (c:Block:Knowledge {
  id: 'ns-cap-006',
  sessionId: 'north_star',
  topic: 'north_star_capability',
  title: 'Multi-tenant support',
  content: 'System can manage multiple user ideas in isolation.',
  status: 'active',
  confidence: 0.3,  // Not yet implemented
  abstractionLevel: 'strategy',
  createdAt: datetime()
})

// Link to proposal that created it
MATCH (p:Proposal {id: $proposalId})
CREATE (p)-[:CREATES]->(c)
```

---

## Exit Criteria (Phase 2)

- [ ] North Star session exists in Neo4j
- [ ] At least 10 blocks seeded (vision, capabilities, constraints, priorities)
- [ ] Gap Analysis queries work
- [ ] Capability confidence reflects implementation status
- [ ] North Star changes require approval

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Initial creation | AI Agent (Kai) |

---

*This is a source-truth document. Changes require founder review.*
