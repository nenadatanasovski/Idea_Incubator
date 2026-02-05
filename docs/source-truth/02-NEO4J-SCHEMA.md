# Neo4j Schema Design

> **Source of Truth** for the Idea Incubator memory graph Neo4j implementation.
> 
> Related: `00-ARCHITECTURE-OVERVIEW.md` (system architecture, 9 block types)

---

## 1. Overview

This document defines the Neo4j graph database schema for the Vibe platform. The schema implements the **9 consolidated block types** (ARCH-001) and 21 relationship types, optimized for AI agent queries.

### Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Multi-label nodes** | Each block gets a base `Block` label + type-specific label for efficient filtering |
| **Typed relationships** | Direct mapping from link types to Neo4j relationship types (SCREAMING_SNAKE_CASE) |
| **Property indexing** | Indexes on properties AI agents query most frequently |
| **Session isolation** | All nodes/edges scoped by `sessionId` for multi-tenant queries |

### Scale Assumptions

- ~100K nodes (small team)
- ~500K relationships (5:1 edge-to-node ratio)
- Single Neo4j instance (no sharding needed)

---

## 2. Node Labels

### 2.1 Base Label

All memory blocks have the `Block` label with common properties:

```cypher
(:Block {
  id: STRING,           // UUID primary key
  sessionId: STRING,    // Required - session scope
  ideaId: STRING,       // Optional - idea scope
  title: STRING,        // Short 3-5 word summary
  content: STRING,      // Full content text
  properties: STRING,   // JSON blob for extensibility
  status: STRING,       // draft|active|validated|superseded|abandoned
  confidence: FLOAT,    // 0.0 - 1.0
  abstractionLevel: STRING, // vision|strategy|tactic|implementation
  topic: STRING,        // problem|solution|market|etc (dimension tag)
  createdAt: DATETIME,
  updatedAt: DATETIME,
  extractedFromMessageId: STRING,
  artifactId: STRING
})
```

### 2.2 Type-Specific Labels (9 Types)

Per ARCH-001, the system uses 9 consolidated block types. Each block gets an additional label based on its type.

| # | Block Type | Neo4j Label | Purpose | Question Answered |
|---|------------|-------------|---------|-------------------|
| 1 | `knowledge` | `:Knowledge` | Verified facts, patterns, insights | "What do we know?" |
| 2 | `decision` | `:Decision` | Choices made with rationale | "What did we choose?" |
| 3 | `assumption` | `:Assumption` | Unverified beliefs to test | "What do we assume?" |
| 4 | `question` | `:Question` | Open unknowns, things to investigate | "What don't we know?" |
| 5 | `requirement` | `:Requirement` | Constraints, must-haves, acceptance criteria | "What must be true?" |
| 6 | `task` | `:Task` | Work items, actions to take | "What do we need to do?" |
| 7 | `proposal` | `:Proposal` | Suggested changes awaiting approval | "What might we do?" |
| 8 | `artifact` | `:Artifact` | Outputs (code, docs, specs) | "What did we produce?" |
| 9 | `evidence` | `:Evidence` | Validation data, proof, measurements | "How do we verify?" |

### 2.3 Node Creation Examples

```cypher
// Knowledge block (verified insight)
CREATE (k:Block:Knowledge {
  id: 'know-001',
  sessionId: 'sess-abc',
  ideaId: 'idea-xyz',
  title: 'Users prefer mobile checkout',
  content: 'Analytics show 78% of completed purchases happen on mobile devices...',
  status: 'validated',
  confidence: 0.92,
  abstractionLevel: 'tactic',
  topic: 'market',
  createdAt: datetime(),
  updatedAt: datetime()
})

// Decision block
CREATE (d:Block:Decision {
  id: 'dec-001',
  sessionId: 'sess-abc',
  ideaId: 'idea-xyz',
  title: 'Choose PostgreSQL over MongoDB',
  content: 'After evaluating both options, selected PostgreSQL for...',
  status: 'active',
  confidence: 0.9,
  abstractionLevel: 'tactic',
  createdAt: datetime(),
  updatedAt: datetime()
})

// Assumption block
CREATE (a:Block:Assumption {
  id: 'asm-001',
  sessionId: 'sess-abc',
  ideaId: 'idea-xyz',
  title: 'Users prefer mobile',
  content: 'Assuming 80% of users will access via mobile devices...',
  status: 'active',
  confidence: 0.6,
  abstractionLevel: 'strategy',
  createdAt: datetime(),
  updatedAt: datetime()
})

// Question block (open unknown)
CREATE (q:Block:Question {
  id: 'qst-001',
  sessionId: 'sess-abc',
  ideaId: 'idea-xyz',
  title: 'What is our pricing model?',
  content: 'Need to determine whether freemium, subscription, or usage-based...',
  status: 'active',
  confidence: 0.0,
  abstractionLevel: 'strategy',
  topic: 'solution',
  createdAt: datetime(),
  updatedAt: datetime()
})

// Requirement block
CREATE (r:Block:Requirement {
  id: 'req-001',
  sessionId: 'sess-abc',
  ideaId: 'idea-xyz',
  title: 'Support GDPR compliance',
  content: 'Must allow users to export and delete their data on request...',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'tactic',
  createdAt: datetime(),
  updatedAt: datetime()
})

// Task block (work item)
CREATE (t:Block:Task {
  id: 'task-001',
  sessionId: 'sess-abc',
  ideaId: 'idea-xyz',
  title: 'Implement user auth flow',
  content: 'Build login, signup, password reset using OAuth2...',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'implementation',
  createdAt: datetime(),
  updatedAt: datetime()
})

// Proposal block (suggested change)
CREATE (p:Block:Proposal {
  id: 'prop-001',
  sessionId: 'sess-abc',
  ideaId: 'idea-xyz',
  title: 'Add Stripe for payments',
  content: 'Proposing to integrate Stripe checkout for subscription handling...',
  status: 'draft',
  confidence: 0.75,
  abstractionLevel: 'tactic',
  createdAt: datetime(),
  updatedAt: datetime()
})

// Artifact block (output)
CREATE (art:Block:Artifact {
  id: 'art-001',
  sessionId: 'sess-abc',
  ideaId: 'idea-xyz',
  title: 'User service module',
  content: 'Path: src/services/user.py\nGenerated user authentication service...',
  status: 'active',
  confidence: 1.0,
  abstractionLevel: 'implementation',
  artifactId: 'file:src/services/user.py',
  createdAt: datetime(),
  updatedAt: datetime()
})

// Evidence block (validation data)
CREATE (e:Block:Evidence {
  id: 'evd-001',
  sessionId: 'sess-abc',
  ideaId: 'idea-xyz',
  title: 'User survey results Q1',
  content: 'Survey of 500 users showed 72% want mobile-first experience...',
  status: 'validated',
  confidence: 0.88,
  abstractionLevel: 'tactic',
  topic: 'market',
  createdAt: datetime(),
  updatedAt: datetime()
})
```

---

## 3. Relationship Types

### 3.1 Complete Relationship Mapping (21 Types)

All relationships include common properties:

```cypher
[rel {
  id: STRING,           // UUID
  sessionId: STRING,    // Required
  degree: STRING,       // full|partial|minimal
  confidence: FLOAT,    // 0.0 - 1.0
  reason: STRING,       // Why this link exists
  status: STRING,       // active|superseded|removed
  createdAt: DATETIME,
  updatedAt: DATETIME
}]
```

| Link Type | Neo4j Relationship | Semantic Direction |
|-----------|-------------------|-------------------|
| `addresses` | `ADDRESSES` | Source addresses Target problem |
| `creates` | `CREATES` | Source creates Target output |
| `requires` | `REQUIRES` | Source requires Target to proceed |
| `conflicts` | `CONFLICTS_WITH` | Source conflicts with Target |
| `supports` | `SUPPORTS` | Source provides evidence for Target |
| `depends_on` | `DEPENDS_ON` | Source depends on Target |
| `enables` | `ENABLES` | Source enables Target |
| `suggests` | `SUGGESTS` | Source suggests Target action |
| `supersedes` | `SUPERSEDES` | Source replaces Target |
| `validates` | `VALIDATES` | Source confirms Target |
| `invalidates` | `INVALIDATES` | Source disproves Target |
| `references` | `REFERENCES` | Source mentions Target |
| `evidence_for` | `EVIDENCE_FOR` | Source is evidence for Target |
| `elaborates` | `ELABORATES` | Source expands on Target |
| `refines` | `REFINES` | Source is a refined version of Target |
| `specializes` | `SPECIALIZES` | Source is a special case of Target |
| `alternative_to` | `ALTERNATIVE_TO` | Source is an alternative to Target |
| `instance_of` | `INSTANCE_OF` | Source is an instance of Target |
| `constrained_by` | `CONSTRAINED_BY` | Source is limited by Target |
| `derived_from` | `DERIVED_FROM` | Source was derived from Target |
| `measured_by` | `MEASURED_BY` | Source is measured by Target metric |

### 3.2 Relationship Creation Examples

```cypher
// Decision supported by evidence
MATCH (d:Decision {id: 'dec-001'})
MATCH (e:Evidence {id: 'evd-001'})
CREATE (e)-[:SUPPORTS {
  id: 'link-001',
  sessionId: 'sess-abc',
  degree: 'full',
  confidence: 0.85,
  reason: 'Survey data directly supports mobile-first decision',
  status: 'active',
  createdAt: datetime(),
  updatedAt: datetime()
}]->(d)

// Proposal addresses a question
MATCH (p:Proposal {id: 'prop-001'})
MATCH (q:Question {id: 'qst-001'})
CREATE (p)-[:ADDRESSES {
  id: 'link-002',
  sessionId: 'sess-abc',
  status: 'active',
  createdAt: datetime(),
  updatedAt: datetime()
}]->(q)

// Task creates artifact
MATCH (t:Task {id: 'task-001'})
MATCH (a:Artifact {id: 'art-001'})
CREATE (t)-[:CREATES {
  id: 'link-003',
  sessionId: 'sess-abc',
  status: 'active',
  createdAt: datetime(),
  updatedAt: datetime()
}]->(a)

// Evidence validates assumption
MATCH (e:Evidence {id: 'evd-001'})
MATCH (a:Assumption {id: 'asm-001'})
CREATE (e)-[:VALIDATES {
  id: 'link-004',
  sessionId: 'sess-abc',
  degree: 'partial',
  confidence: 0.72,
  reason: 'Survey confirms mobile preference assumption',
  status: 'active',
  createdAt: datetime(),
  updatedAt: datetime()
}]->(a)
```

---

## 4. Indexes and Constraints

### 4.1 Uniqueness Constraints

```cypher
// Primary key constraint on Block id
CREATE CONSTRAINT block_id_unique IF NOT EXISTS
FOR (b:Block) REQUIRE b.id IS UNIQUE;
```

### 4.2 Property Indexes (AI Agent Queries)

These indexes optimize the most common AI agent query patterns:

```cypher
// === Session/Idea Scoping (Required for ALL queries) ===
CREATE INDEX idx_block_session IF NOT EXISTS
FOR (b:Block) ON (b.sessionId);

CREATE INDEX idx_block_idea IF NOT EXISTS
FOR (b:Block) ON (b.ideaId);

// === Status Filtering (Active content queries) ===
CREATE INDEX idx_block_status IF NOT EXISTS
FOR (b:Block) ON (b.status);

// Composite: Session + Status (most common pattern)
CREATE INDEX idx_block_session_status IF NOT EXISTS
FOR (b:Block) ON (b.sessionId, b.status);

// === Title Search (Quick lookup by name) ===
CREATE INDEX idx_block_title IF NOT EXISTS
FOR (b:Block) ON (b.title);

// === Artifact Linking ===
CREATE INDEX idx_block_artifact IF NOT EXISTS
FOR (b:Block) ON (b.artifactId);

// === Temporal Queries ===
CREATE INDEX idx_block_created IF NOT EXISTS
FOR (b:Block) ON (b.createdAt);

CREATE INDEX idx_block_updated IF NOT EXISTS
FOR (b:Block) ON (b.updatedAt);

// === Confidence-based Filtering ===
CREATE INDEX idx_block_confidence IF NOT EXISTS
FOR (b:Block) ON (b.confidence);

// === Abstraction Level Queries ===
CREATE INDEX idx_block_abstraction IF NOT EXISTS
FOR (b:Block) ON (b.abstractionLevel);

// === Topic Dimension Queries ===
CREATE INDEX idx_block_topic IF NOT EXISTS
FOR (b:Block) ON (b.topic);
```

### 4.3 Full-Text Search Index

For keyword-based content search:

```cypher
// Full-text index on content and title
CREATE FULLTEXT INDEX block_content_search IF NOT EXISTS
FOR (b:Block) ON EACH [b.title, b.content];
```

### 4.4 Relationship Indexes

```cypher
// Index on relationship status for filtering active links
CREATE INDEX idx_rel_status IF NOT EXISTS
FOR ()-[r]-() ON (r.status);

// Index on relationship session for scoping
CREATE INDEX idx_rel_session IF NOT EXISTS
FOR ()-[r]-() ON (r.sessionId);
```

---

## 5. AI Agent Query Patterns

### 5.1 Session-Scoped Queries

All AI agent queries MUST include session scoping:

```cypher
// Get all active blocks in a session
MATCH (b:Block {sessionId: $sessionId, status: 'active'})
RETURN b
ORDER BY b.updatedAt DESC
LIMIT 100
```

### 5.2 Type-Specific Queries

```cypher
// Get all decisions for an idea
MATCH (d:Block:Decision {ideaId: $ideaId, status: 'active'})
RETURN d
ORDER BY d.createdAt DESC

// Get all unvalidated assumptions
MATCH (a:Block:Assumption {sessionId: $sessionId})
WHERE a.status IN ['draft', 'active']
RETURN a
ORDER BY a.confidence ASC  // Lowest confidence first

// Get all open questions
MATCH (q:Block:Question {sessionId: $sessionId, status: 'active'})
RETURN q
ORDER BY q.createdAt DESC

// Get all pending tasks
MATCH (t:Block:Task {ideaId: $ideaId})
WHERE t.status IN ['draft', 'active']
RETURN t
ORDER BY t.createdAt ASC

// Get all proposals awaiting approval
MATCH (p:Block:Proposal {sessionId: $sessionId, status: 'draft'})
RETURN p
ORDER BY p.createdAt DESC

// Get all validated knowledge
MATCH (k:Block:Knowledge {ideaId: $ideaId, status: 'validated'})
RETURN k
ORDER BY k.confidence DESC
```

### 5.3 Relationship Traversal

```cypher
// What supports a decision?
MATCH (support)-[r:SUPPORTS|EVIDENCE_FOR]->(d:Decision {id: $decisionId})
WHERE r.status = 'active'
RETURN support, r.confidence, r.reason
ORDER BY r.confidence DESC

// What does this task depend on?
MATCH (t:Task {id: $taskId})-[r:DEPENDS_ON|REQUIRES|CONSTRAINED_BY]->(dep)
WHERE r.status = 'active'
RETURN dep, type(r) as relType, r.degree

// What evidence validates this assumption?
MATCH (e:Evidence)-[r:VALIDATES]->(a:Assumption {id: $assumptionId})
WHERE r.status = 'active'
RETURN e, r.confidence, r.reason
```

### 5.4 Multi-Hop Traversal

```cypher
// Get full dependency tree (up to 3 hops)
MATCH path = (root:Block {id: $blockId})-[:DEPENDS_ON|REQUIRES*1..3]->(dep)
WHERE ALL(r IN relationships(path) WHERE r.status = 'active')
RETURN path

// Find all blocks connected to a requirement
MATCH (req:Requirement {id: $requirementId})<-[*1..2]-(related:Block)
WHERE related.status = 'active'
RETURN DISTINCT related
```

### 5.5 Full-Text Search

```cypher
// Search for blocks mentioning "pricing"
CALL db.index.fulltext.queryNodes('block_content_search', 'pricing')
YIELD node, score
WHERE node.sessionId = $sessionId AND node.status = 'active'
RETURN node, score
ORDER BY score DESC
LIMIT 20
```

### 5.6 Common Agent Workflows

#### Get Context for a Decision
```cypher
// Returns: decision + supporting evidence + constraints + requirements
MATCH (d:Decision {id: $decisionId})
OPTIONAL MATCH (support)-[r1:SUPPORTS|EVIDENCE_FOR]->(d)
  WHERE r1.status = 'active'
OPTIONAL MATCH (d)-[r2:CONSTRAINED_BY]->(constraint)
  WHERE r2.status = 'active'
OPTIONAL MATCH (d)-[r3:REQUIRES]->(req:Requirement)
  WHERE r3.status = 'active'
RETURN d,
       collect(DISTINCT support) as supporting,
       collect(DISTINCT constraint) as constraints,
       collect(DISTINCT req) as requirements
```

#### Trace Assumption Impact
```cypher
// What decisions/tasks depend on this assumption?
MATCH (a:Assumption {id: $assumptionId})
MATCH path = (a)<-[:SUPPORTS|EVIDENCE_FOR|DEPENDS_ON*1..3]-(dependent)
WHERE dependent.status = 'active'
  AND ALL(r IN relationships(path) WHERE r.status = 'active')
RETURN dependent, length(path) as distance
ORDER BY distance ASC
```

#### Find Unanswered Questions
```cypher
// Questions with no addressing proposals
MATCH (q:Question {ideaId: $ideaId, status: 'active'})
WHERE NOT exists((q)<-[:ADDRESSES]-(:Proposal))
RETURN q
ORDER BY q.createdAt ASC
```

#### Get Task Artifacts
```cypher
// All artifacts created by tasks in an idea
MATCH (t:Task {ideaId: $ideaId})-[:CREATES]->(a:Artifact)
WHERE t.status = 'validated' AND a.status = 'active'
RETURN t.title as task, a.title as artifact, a.artifactId
ORDER BY a.createdAt DESC
```

#### Find Conflicting Information
```cypher
// Get all active conflicts in an idea
MATCH (a:Block {ideaId: $ideaId})-[r:CONFLICTS_WITH]->(b:Block)
WHERE r.status = 'active'
  AND a.status = 'active'
  AND b.status = 'active'
RETURN a, r, b
```

---

## 6. Property Details by Node Type

### 6.1 Extended Properties (JSON)

The `properties` field stores type-specific extended data as JSON:

| Node Type | Common Extended Properties |
|-----------|---------------------------|
| `Knowledge` | `{ "sources": string[], "synthesizedFrom": string[], "category": string }` |
| `Decision` | `{ "reversible": bool, "deadline": datetime, "stakeholders": string[], "alternatives": string[] }` |
| `Assumption` | `{ "testable": bool, "validationMethod": string, "riskLevel": string }` |
| `Question` | `{ "priority": string, "investigationStatus": string, "blockedBy": string[] }` |
| `Requirement` | `{ "type": string, "priority": string, "acceptanceCriteria": string[] }` |
| `Task` | `{ "assignee": string, "dueDate": datetime, "priority": string, "completed": bool, "effort": string }` |
| `Proposal` | `{ "proposalType": string, "impact": string, "debateStatus": string, "approvalStatus": string }` |
| `Artifact` | `{ "artifactType": string, "path": string, "version": string, "generatedBy": string }` |
| `Evidence` | `{ "evidenceType": string, "source": string, "collectedAt": datetime, "methodology": string }` |

### 6.2 Confidence Guidelines

| Confidence Range | Meaning |
|-----------------|---------|
| 0.0 - 0.3 | Low confidence, speculation |
| 0.3 - 0.6 | Moderate confidence, some evidence |
| 0.6 - 0.8 | High confidence, good evidence |
| 0.8 - 1.0 | Very high confidence, validated |

### 6.3 Abstraction Level Guidelines

| Level | Scope | Example |
|-------|-------|---------|
| `vision` | Why we exist | "Democratize legal services" |
| `strategy` | How we win | "Target SMB market first" |
| `tactic` | What we do | "Build self-service portal" |
| `implementation` | How we build | "Use React for frontend" |

---

## 7. Migration: 15 Types → 9 Types

### 7.1 Type Migration Mapping

This migration consolidates the original 15 block types into 9 cleaner types per ARCH-001.

| Old Type (15) | New Type (9) | Migration Notes |
|---------------|--------------|-----------------|
| `content` | `knowledge` | Raw content → verified knowledge |
| `synthesis` | `knowledge` | Preserve `synthesizedFrom` in properties |
| `pattern` | `knowledge` | Store pattern details in properties |
| `decision` | `decision` | Direct mapping |
| `option` | `decision` | Convert to decision with `alternatives` in properties |
| `assumption` | `assumption` | Direct mapping |
| `action` | `task` | Rename only |
| `external` | `evidence` | External data becomes evidence |
| `meta` | — | Convert to graph edges or `properties` on related blocks |
| `link` | — | Convert to `REFERENCES` relationship |
| `derived` | `knowledge` | Mark `derived: true` in properties |
| `cycle` | `knowledge` | Store cycle info in properties |
| `placeholder` | — | Remove or convert to `question` if appropriate |
| `stakeholder_view` | `knowledge` | Store stakeholder in properties |
| `topic` | — | Convert to `topic` dimension tag on related blocks |

### 7.2 Migration Cypher Script

```cypher
// === STEP 1: Migrate content → knowledge ===
MATCH (n:Block:Content)
REMOVE n:Content
SET n:Knowledge
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'content'})
  ELSE '{"migratedFrom": "content"}'
END;

// === STEP 2: Migrate synthesis → knowledge ===
MATCH (n:Block:Synthesis)
REMOVE n:Synthesis
SET n:Knowledge
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'synthesis'})
  ELSE '{"migratedFrom": "synthesis"}'
END;

// === STEP 3: Migrate pattern → knowledge ===
MATCH (n:Block:Pattern)
REMOVE n:Pattern
SET n:Knowledge
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'pattern'})
  ELSE '{"migratedFrom": "pattern"}'
END;

// === STEP 4: Migrate option → decision ===
MATCH (n:Block:Option)
REMOVE n:Option
SET n:Decision
SET n.status = 'superseded'  // Options are typically not-chosen decisions
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'option', wasOption: true})
  ELSE '{"migratedFrom": "option", "wasOption": true}'
END;

// === STEP 5: Migrate action → task ===
MATCH (n:Block:Action)
REMOVE n:Action
SET n:Task;

// === STEP 6: Migrate external → evidence ===
MATCH (n:Block:External)
REMOVE n:External
SET n:Evidence
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'external'})
  ELSE '{"migratedFrom": "external"}'
END;

// === STEP 7: Migrate derived → knowledge ===
MATCH (n:Block:Derived)
REMOVE n:Derived
SET n:Knowledge
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'derived', derived: true})
  ELSE '{"migratedFrom": "derived", "derived": true}'
END;

// === STEP 8: Migrate cycle → knowledge ===
MATCH (n:Block:Cycle)
REMOVE n:Cycle
SET n:Knowledge
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'cycle', isCycle: true})
  ELSE '{"migratedFrom": "cycle", "isCycle": true}'
END;

// === STEP 9: Migrate stakeholder_view → knowledge ===
MATCH (n:Block:StakeholderView)
REMOVE n:StakeholderView
SET n:Knowledge
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'stakeholder_view'})
  ELSE '{"migratedFrom": "stakeholder_view"}'
END;

// === STEP 10: Convert Link blocks to REFERENCES relationships ===
// (Manual review required - links become edges, not nodes)
MATCH (n:Block:Link)
SET n.status = 'superseded'
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'link', requiresManualReview: true})
  ELSE '{"migratedFrom": "link", "requiresManualReview": true}'
END;

// === STEP 11: Handle Meta blocks ===
// (Convert to properties on related blocks - manual review)
MATCH (n:Block:Meta)
SET n.status = 'superseded'
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'meta', requiresManualReview: true})
  ELSE '{"migratedFrom": "meta", "requiresManualReview": true}'
END;

// === STEP 12: Handle Topic blocks ===
// (Convert to topic dimension on related blocks)
MATCH (n:Block:Topic)
SET n.status = 'superseded'
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'topic', requiresManualReview: true})
  ELSE '{"migratedFrom": "topic", "requiresManualReview": true}'
END;

// === STEP 13: Handle Placeholder blocks ===
// (Convert to question or remove)
MATCH (n:Block:Placeholder)
REMOVE n:Placeholder
SET n:Question
SET n.properties = CASE 
  WHEN n.properties IS NOT NULL 
  THEN apoc.convert.toJson(apoc.convert.fromJsonMap(n.properties) + {migratedFrom: 'placeholder'})
  ELSE '{"migratedFrom": "placeholder"}'
END;
```

### 7.3 Post-Migration Validation

```cypher
// Verify no old labels remain (except superseded)
MATCH (b:Block)
WHERE b:Content OR b:Synthesis OR b:Pattern OR b:Option OR b:Action 
   OR b:External OR b:Derived OR b:Cycle OR b:StakeholderView
RETURN count(b) as remainingOldTypes;  // Should be 0

// Verify new type distribution
MATCH (b:Block)
WHERE b.status <> 'superseded'
RETURN labels(b) as labels, count(*) as count
ORDER BY count DESC;

// Find blocks requiring manual review
MATCH (b:Block)
WHERE b.properties CONTAINS 'requiresManualReview'
RETURN b.id, labels(b), b.title
LIMIT 100;

// Verify relationship counts unchanged
MATCH ()-[r]->()
RETURN type(r) as relType, count(*) as count
ORDER BY count DESC;
```

---

## 8. Operational Considerations

### 8.1 Backup Strategy

```bash
# Daily backup
neo4j-admin database dump neo4j --to-path=/backups/daily/

# Point-in-time recovery via transaction logs
```

### 8.2 Performance Tuning

For ~100K nodes:
- Default heap (1GB) is sufficient
- Page cache: 512MB recommended
- No need for clustering

### 8.3 Query Timeout

Set query timeout to prevent runaway traversals:

```
dbms.transaction.timeout=30s
```

### 8.4 Connection Pooling

Application should use connection pooling (Neo4j driver default is fine for small team).

---

## 9. Quick Reference

### 9.1 All Node Labels (9 Types)

```
:Block (base)
:Knowledge, :Decision, :Assumption
:Question, :Requirement, :Task
:Proposal, :Artifact, :Evidence
```

### 9.2 All Relationship Types (21 Types)

```
ADDRESSES, CREATES, REQUIRES, CONFLICTS_WITH, SUPPORTS
DEPENDS_ON, ENABLES, SUGGESTS, SUPERSEDES, VALIDATES
INVALIDATES, REFERENCES, EVIDENCE_FOR, ELABORATES, REFINES
SPECIALIZES, ALTERNATIVE_TO, INSTANCE_OF, CONSTRAINED_BY
DERIVED_FROM, MEASURED_BY
```

### 9.3 Required Query Pattern

```cypher
// ALWAYS include session scoping
MATCH (b:Block {sessionId: $sessionId})
WHERE b.status = 'active'
// ... rest of query
```

---

## 10. Future Considerations

### 10.1 Schema Evolution

When modifying block types:
1. Update this document first (source of truth)
2. Create migration script
3. Update application validation
4. Run migration with rollback plan

### 10.2 Potential Optimizations (Not Needed Yet)

| Optimization | Trigger | Implementation |
|--------------|---------|----------------|
| Graph Data Science library | Pattern detection at scale | Install GDS plugin |
| Vector index | Semantic search needs | Neo4j 5.x vector index |
| Read replicas | > 100 concurrent queries | Clustering |

---

## Revision History

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2025-02-05 | 1.0 | Initial creation with 15 block types | AI Agent |
| 2026-02-05 | 2.0 | Consolidated to 9 block types per ARCH-001; added migration section | AI Agent (Kai) |

---

*This is a source-truth document. Changes require founder review.*
*Cross-reference: `00-ARCHITECTURE-OVERVIEW.md` for system context and ARCH-001 decision.*
