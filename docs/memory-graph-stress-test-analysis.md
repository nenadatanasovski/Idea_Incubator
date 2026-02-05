# Memory Graph: Stress Test Analysis

## Critical Review of the Final Approach

---

## Executive Summary

The Memory Graph Final Approach presents an ambitious architecture with solid theoretical grounding. However, stress testing reveals **12 critical gaps**, **8 architectural blind spots**, and **6 future bottlenecks** that could undermine the system's effectiveness. This analysis provides specific recommendations for each concern.

---

## Part 1: The "No Vectors" Decision

### 1.1 Gap: Synonym System is Brittle

**The Assumption:** A manually-maintained synonym table with AI suggestions will capture vocabulary relationships.

**The Problem:**

```typescript
// The proposed approach
const synonyms: Record<string, string[]> = {
  pricing: ["price", "cost", "fee", "monetization", "revenue model"],
};
```

This fails to capture:

| User Query                       | Expected Match            | Why Synonyms Miss It           |
| -------------------------------- | ------------------------- | ------------------------------ |
| "recurring revenue"              | Blocks about SaaS pricing | Not a synonym of "pricing"     |
| "how we make money"              | Monetization decisions    | Colloquial phrasing            |
| "unit economics"                 | Pricing + cost structure  | Domain-specific compound       |
| "what kills us if wrong"         | High-risk assumptions     | Intent-based, no keyword match |
| "the thing we debated last week" | Recent contested decision | Temporal + contextual          |

**Recommendation:**

1. **Add a query intent layer** that translates natural language to structured queries before keyword expansion
2. **Implement query rewriting** where the LLM first rewrites ambiguous queries into concrete graph queries
3. **Plan for hybrid retrieval** from day one—design the API to allow multiple retrieval strategies even if only one is implemented initially

```typescript
// Better abstraction
interface RetrievalStrategy {
  name: string;
  retrieve(query: ParsedQuery, budget: number): Promise<Block[]>;
}

// Start with keywords, add vectors later without architectural change
const strategies: RetrievalStrategy[] = [
  new KeywordStrategy(),
  // new VectorStrategy(), // Easy to add
];
```

### 1.2 Gap: The "< 1000 Blocks" Threshold is Arbitrary

**The Assumption:** A solo founder will have < 1000 blocks per idea, making brute-force approaches viable.

**The Problem:**

- No measurement plan to validate this assumption
- Ideas with extensive research (market analysis, competitor teardowns) easily exceed this
- If the threshold is crossed, the architecture doesn't degrade gracefully—it fails

**Recommendation:**

1. **Instrument block counts from day one**
2. **Define performance SLAs** (e.g., retrieval < 200ms at any scale)
3. **Build with scale-agnostic patterns**—pagination, streaming, lazy loading

### 1.3 Gap: FTS5 Query Complexity Limits

**The Assumption:** SQLite FTS5 handles search well enough.

**The Problem:**

FTS5 struggles with:

- Compound queries across multiple columns
- Weighted term matching
- Phrase proximity
- Negation in complex expressions

```sql
-- This gets ugly fast
SELECT * FROM memory_blocks_fts
WHERE keywords MATCH 'pricing OR cost OR fee'
  AND dimension = 'market'
  AND type IN ('decision', 'belief')
ORDER BY rank -- but rank doesn't consider recency
```

**Recommendation:**

1. **Abstract search behind a dedicated service** that can be reimplemented
2. **Define query patterns upfront** and ensure FTS5 can handle them
3. **Have a migration path to Meilisearch/Typesense** if FTS5 hits limits

---

## Part 2: Graph-Only Memory Risks

### 2.1 Critical Gap: Session State is Underspecified

**The Proposed Model:**

```typescript
interface SessionState {
  lastInteraction: string; // 1-2 sentence summary
  currentFocus: string[]; // Active topics
  activeEntities: string[]; // Recently referenced
  emotionalContext?: string; // "frustrated", "exploring"
}
```

**What This Misses:**

| Conversational Need          | How Chat History Handles It    | Session State Gap                    |
| ---------------------------- | ------------------------------ | ------------------------------------ |
| "No, the OTHER one"          | Scan history for alternatives  | Can't distinguish between candidates |
| "Why did you suggest X?"     | History shows the reasoning    | No explanation trail                 |
| "Let me rethink that"        | User can see their progression | No thought history                   |
| Tone shifts mid-conversation | Visible in message flow        | `emotionalContext` is too coarse     |
| "What did I say about..."    | Full text searchable           | Only summaries stored                |

**Recommendation:**

1. **Keep a rolling window** of last 3-5 messages as raw text (not as "chat history" but as "immediate context")
2. **Add explanation provenance** to session state—why each `currentFocus` was set
3. **Track entity resolution history**—what "that one" resolved to in recent turns

```typescript
interface SessionState {
  // ... existing fields

  // ADD: Immediate context window (not persistent history)
  recentExchanges: Array<{
    userSummary: string;
    agentSummary: string;
    resolvedEntities: Record<string, string>; // "that one" → block_id
    timestamp: Date;
  }>; // Max 5, FIFO

  // ADD: Focus provenance
  focusHistory: Array<{
    focus: string;
    reason: string;
    setAt: Date;
  }>;
}
```

### 2.2 Critical Gap: Reasoning Chain Recovery

**The Problem:**

```typescript
interface ReasoningChain {
  steps: ReasoningStep[]; // Grows unbounded
  status: "active" | "concluded" | "abandoned";
}
```

What happens when:

- User says "wait, let's go back to step 2"?
- User abandons mid-chain and returns a week later?
- Steps reference blocks that were since deleted/modified?
- The chain itself needs correction (step 3's summary was wrong)?

**Recommendation:**

1. **Add chain branching support**—allow forking from any step
2. **Version individual steps**—track edits to summaries
3. **Soft-delete with grace period** for referenced blocks
4. **Chain expiry and archival policy**

```typescript
interface ReasoningChain {
  // ... existing

  branches: Array<{
    forkFromStep: number;
    branchId: string;
    reason: string;
  }>;

  archiveAfter?: Date; // Auto-archive if abandoned
}

interface ReasoningStep {
  // ... existing

  version: number;
  referencedBlockVersions: Record<string, number>; // block_id → version at time of reference
}
```

### 2.3 Gap: Extraction Quality Has No Feedback Loop

**The Assumption:** LLM extraction "just works" or we'll notice via user feedback.

**The Problem:**

- No automated quality metrics for extraction
- User feedback is lagging and imprecise ("it didn't find something" doesn't tell you what failed)
- < 5% info loss target has no measurement methodology

**Recommendation:**

1. **Sample-based validation pipeline**—extract, then ask a separate LLM to score completeness
2. **Track retrieval precision/recall** on synthetic queries
3. **User correction signals**—when user re-states something, it may indicate extraction failure

```typescript
interface ExtractionQuality {
  blockId: string;
  extractedFrom: string;

  // Automated scoring
  completenessScore?: number; // Did extraction capture all entities?
  coherenceScore?: number; // Does the block make sense standalone?

  // User signals
  userRephrasedWithin: number; // Turns until user restated similar content
  userExplicitlyEdited: boolean;
}
```

---

## Part 3: Schema Simplification Risks

### 3.1 Critical Gap: Over-Consolidation Loses Semantic Precision

**The Proposal:** 21 types → 7 types, 17 dimensions → 6 dimensions

**Problematic Consolidations:**

| Original     | Becomes     | Information Lost                          |
| ------------ | ----------- | ----------------------------------------- |
| `pattern`    | `knowledge` | Meta-level insight vs specific fact       |
| `option`     | `decision`  | Unchosen alternatives vs final choice     |
| `hypothesis` | `belief`    | Testable prediction vs general assumption |
| `constraint` | `decision`  | External limit vs internal choice         |
| `risk`       | `market`    | Risks exist across ALL dimensions         |
| `validation` | `execution` | Learning intent vs building intent        |

**Why This Matters:**

Query: "What assumptions might invalidate our pricing?"

With fine types: `SELECT * WHERE type = 'assumption' AND dimension = 'market'`

With consolidated types: `SELECT * WHERE type = 'belief' AND dimension = 'market'`

But now "belief" includes hypotheses (which are tested, not invalidating) and the distinction is lost.

**Recommendation:**

1. **Use 7 primary types** but add **subtypes** for semantic precision
2. **Keep risk as a cross-cutting concern**, not a dimension

```typescript
const blockTypes = {
  knowledge: ["fact", "pattern", "synthesis", "research"],
  belief: ["assumption", "hypothesis", "intuition"],
  decision: ["choice", "option_selected", "option_rejected", "constraint"],
  // ...
} as const;

// Risk as a property, not a dimension
interface Block {
  type: BlockType;
  subtype?: string;
  dimension: Dimension;
  riskLevel?: "low" | "medium" | "high" | "critical";
  riskNature?: string; // "invalidating assumption", "execution risk", etc.
}
```

### 3.2 Gap: Migration Has No Rollback

**The Proposed Migration:**

```sql
UPDATE memory_blocks SET type = 'knowledge'
  WHERE type IN ('content', 'synthesis', 'pattern', 'meta', 'topic');
```

**The Problems:**

- Destructive operation with no rollback
- No validation that consolidation is correct
- "Pick primary dimension" for multi-dimension blocks is unspecified
- Junction table data is lost forever

**Recommendation:**

1. **Preserve original values** in a `legacy_type` column for 6 months
2. **Migration validation script** that samples and verifies consolidations
3. **Explicit algorithm for primary dimension selection**
4. **Keep junction tables read-only** during transition

```sql
-- Safer migration
ALTER TABLE memory_blocks ADD COLUMN legacy_type TEXT;
ALTER TABLE memory_blocks ADD COLUMN legacy_dimensions TEXT; -- JSON array

UPDATE memory_blocks
SET legacy_type = type,
    type = CASE
      WHEN type IN ('content', 'synthesis', 'pattern', 'meta', 'topic') THEN 'knowledge'
      -- ...
    END;

-- Validate before dropping legacy columns
SELECT legacy_type, type, COUNT(*)
FROM memory_blocks
GROUP BY legacy_type, type;
```

---

## Part 4: Code-Graph Sync is Underspecified

### 4.1 Critical Gap: Line Number Staleness

**The Proposal:**

```typescript
interface CodeReference {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  commitHash?: string;
  lastVerified: Date;
}
```

**The Problem:**

Even small edits make line numbers stale. A single insertion above referenced code invalidates all line numbers below.

**Real Scenario:**

1. Block links to `pricing.ts:45-60`
2. Developer adds import statement at line 2
3. Link now points to wrong code (lines 46-61)
4. `lastVerified` shows it was verified yesterday—false confidence

**Recommendation:**

1. **Content-based anchoring** instead of line numbers
2. **AST node references** for code (function name, class.method)
3. **Fuzzy matching with confidence scores**

```typescript
interface CodeReference {
  filePath: string;

  // Primary: semantic anchor
  anchor: {
    type: "function" | "class" | "method" | "block" | "line_content";
    identifier?: string; // "calculatePricing", "PricingService.apply"
    contentHash?: string; // Hash of the referenced content
    contentSnippet?: string; // First/last 50 chars for fuzzy match
  };

  // Secondary: line numbers (hints, not authoritative)
  lineHint?: { start: number; end: number };

  // Verification
  lastVerified: Date;
  verificationConfidence: number; // 0-1, decreases over time/edits
}
```

### 4.2 Gap: No Trigger for Phase Advancement

**The Proposed Phases:**

| Phase             | Scope               | Trigger                     |
| ----------------- | ------------------- | --------------------------- |
| 1: Manual linking | User/agent links    | MVP                         |
| 2: One-way sync   | Git hooks → graph   | "When Phase 1 validated"    |
| 3: Bidirectional  | Graph → code tasks  | "When Phase 2 stable"       |
| 4: Automated      | CI checks alignment | "When confident in linking" |

**The Problem:** "Validated", "stable", and "confident" are undefined.

**Recommendation:**

Define explicit thresholds:

| Phase | Advancement Criteria                                                         |
| ----- | ---------------------------------------------------------------------------- |
| 1 → 2 | > 20 manual links created AND > 70% verified still valid after 2 weeks       |
| 2 → 3 | > 50 automatic detections AND < 10% false positive rate on "affected blocks" |
| 3 → 4 | > 30 days stable AND user confirms value of graph→code notifications         |

---

## Part 5: Missing Critical Considerations

### 5.1 Error Handling & Recovery

**Not Addressed:**

| Failure Mode                             | Impact                             | Needed Recovery                                     |
| ---------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Extraction fails mid-conversation        | Lost context, confused agent       | Retry queue, fallback to raw storage                |
| Session state corrupted                  | Agent loses all context            | Session state snapshots, rebuild from recent blocks |
| Reasoning chain references deleted block | Broken chain, confusing references | Soft delete with grace period, chain repair tool    |
| Graph query times out                    | User sees error, context missing   | Query timeout + degraded mode (less context)        |
| Keyword extraction produces garbage      | Search fails, nothing found        | Validation layer, human review queue                |

**Recommendation:**

Add explicit error handling to the architecture:

```typescript
interface GraphOperationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
    suggestedAction?: string;
  };
  degradedMode?: {
    reason: string;
    dataCompleteness: number; // 0-1
  };
}
```

### 5.2 Observability & Debugging

**Not Addressed:**

- How do you know if retrieval quality is degrading?
- How do you debug "it didn't find X"?
- What metrics should trigger alerts?

**Recommendation:**

Define an observability layer:

```typescript
interface RetrievalMetrics {
  // Per-query metrics
  queryId: string;
  queryText: string;
  parsedIntent: string;
  keywordsExpanded: string[];

  ftsResultCount: number;
  graphTraversalNodeCount: number;
  finalResultCount: number;
  tokenBudgetUsed: number;

  latencyMs: {
    intentDetection: number;
    ftsSearch: number;
    graphTraversal: number;
    ranking: number;
    total: number;
  };

  // Quality signals (collected later)
  userFeedback?: "helpful" | "not_helpful";
  followupQueryWithin60s?: boolean; // Suggests first query failed
}

// Alerting thresholds
const alerts = {
  avgLatencyMs: { warn: 500, critical: 2000 },
  ftsResultCount: { warn: { gt: 100 }, critical: { gt: 500 } },
  followupQueryRate: { warn: 0.4, critical: 0.6 },
};
```

### 5.3 Multi-User & Collaboration (Future-Proofing)

**The Document Says:** "For a solo founder... vectors are unnecessary."

**The Problem:** The architecture actively prevents future collaboration:

- Session state is per-user (implicit)
- No access control layer
- No conflict resolution for concurrent edits
- Synonym tables are global (whose vocabulary?)

**Recommendation:**

Even for MVP, add basic multi-tenancy hooks:

```typescript
interface Block {
  // ... existing

  // Future-proofing (nullable for now)
  createdBy?: string; // user_id
  visibility?: "private" | "idea_members" | "public";

  // Don't store—but design for—concurrent access
  version: number; // Optimistic locking
}

// Synonym tables: scope to idea, not global
interface SynonymSet {
  ideaId: string; // Not global
  term: string;
  synonyms: string[];
  createdBy?: string;
}
```

### 5.4 Privacy & Data Handling

**Not Addressed:**

- What happens to extracted data when user deletes source?
- PII in blocks (user discusses their company, competitors, etc.)
- Data retention policies
- Export/portability

**Recommendation:**

Add data governance layer:

```typescript
interface DataGovernance {
  // Retention
  retentionPolicy: "indefinite" | "1y" | "2y" | "custom";

  // Source tracking
  extractedFrom: Array<{
    type: "message" | "document" | "code";
    sourceId: string;
    deleted: boolean;
    deletedAt?: Date;
  }>;

  // PII flags (for future compliance)
  containsPII: boolean;
  piiTypes?: string[]; // 'company_name', 'revenue_figure', etc.
}
```

---

## Part 6: Future Bottlenecks

### 6.1 Bottleneck: Context Assembly Becomes the Critical Path

**Current Design:** Query → Filter → Rank → Fill Token Budget → Context String

**At Scale:**

- Ranking 500 blocks by recency + relevance is expensive
- Token counting each block adds latency
- No caching of common context patterns

**Recommendation:**

1. **Pre-compute "context bundles"** for common queries (overview of dimension, recent activity)
2. **Cache token counts** as blocks rarely change
3. **Index blocks by token count** for faster budget filling

```typescript
// Pre-computed bundles
interface ContextBundle {
  id: string;
  ideaId: string;
  type: "dimension_overview" | "recent_activity" | "active_reasoning";

  blockIds: string[];
  totalTokens: number;

  validUntil: Date; // Invalidate on relevant block changes
}
```

### 6.2 Bottleneck: Extraction Latency Compounds

**Current Design:** "Sync extraction of essentials; async for full detail"

**The Problem:**

- Sync extraction adds ~100ms per turn (per document)
- Multiple extractions per turn = linear latency growth
- Async extraction can fall behind if queue grows

**Recommendation:**

1. **Batch sync extractions** when multiple sources in one message
2. **Prioritize async queue** by recency and user activity
3. **Track extraction backlog** as a health metric

### 6.3 Bottleneck: Graph Traversal Without Indexes

**Current Design:** `getRelated(nodeId, relationTypes, direction, maxHops)`

**The Problem:**

- Multi-hop traversal without proper indexes is O(n^hops)
- No materialized paths for common traversals
- Link table will grow faster than block table

**Recommendation:**

1. **Create compound indexes** on link table
2. **Consider materialized paths** for common traversal patterns
3. **Set hard limits** on maxHops (2-3 max) and enforce in code

```sql
-- Essential indexes for link traversal
CREATE INDEX idx_links_source_type ON memory_block_links(source_id, link_type);
CREATE INDEX idx_links_target_type ON memory_block_links(target_id, link_type);

-- For bidirectional traversal
CREATE INDEX idx_links_bidirectional ON memory_block_links(source_id, target_id, link_type);
```

---

## Part 7: Missing Validation Strategy

### 7.1 No Test Corpus Defined

**The Problem:**

| Metric in Document   | How to Measure               | Currently Undefined |
| -------------------- | ---------------------------- | ------------------- |
| "> 80% useful"       | Precision on test queries    | No test query set   |
| "< 5% info loss"     | Compare extraction to source | No gold standard    |
| "References resolve" | Multi-turn test scenarios    | No test scripts     |

**Recommendation:**

Create a validation corpus BEFORE implementing:

```typescript
interface ValidationCorpus {
  // Retrieval validation
  retrievalTests: Array<{
    query: string;
    expectedBlockIds: string[]; // At minimum
    acceptableBlockIds: string[]; // Also okay
    unacceptableBlockIds: string[]; // Must NOT return
  }>;

  // Extraction validation
  extractionTests: Array<{
    sourceContent: string;
    expectedBlocks: Partial<Block>[]; // What should be extracted
    mustCapture: string[]; // Key facts that must appear
  }>;

  // Multi-turn validation
  conversationTests: Array<{
    turns: Array<{
      user: string;
      expectedContext: string[]; // What should be in context
      entityResolutions: Record<string, string>; // "that" → block_id
    }>;
  }>;
}
```

### 7.2 No Performance Benchmarks

**The Problem:** No baseline performance requirements defined.

**Recommendation:**

Define SLAs:

| Operation                | Target  | Degraded | Failure  |
| ------------------------ | ------- | -------- | -------- |
| Intent detection         | < 50ms  | < 200ms  | > 500ms  |
| FTS5 search              | < 100ms | < 300ms  | > 1000ms |
| Graph traversal (2 hops) | < 150ms | < 400ms  | > 1000ms |
| Context assembly         | < 200ms | < 500ms  | > 1500ms |
| Sync extraction          | < 150ms | < 300ms  | > 500ms  |
| End-to-end retrieval     | < 500ms | < 1000ms | > 2000ms |

---

## Part 8: Recommendations Summary

### Immediate (Before Implementation)

1. **Define validation corpus** with test queries, extraction samples, and multi-turn scenarios
2. **Add subtype layer** to preserve semantic precision during type consolidation
3. **Design retrieval abstraction** that allows multiple strategies
4. **Add rolling context window** to session state (last 3-5 exchanges)
5. **Create migration rollback plan** with preserved legacy columns

### Short-Term (During Phase 1)

6. **Implement observability** from day one—metrics, logging, alerting
7. **Add content-based code anchoring** instead of line numbers
8. **Define explicit phase advancement criteria** for code-graph sync
9. **Add error handling layer** with degraded mode support
10. **Create extraction quality scoring** pipeline

### Medium-Term (Phase 2+)

11. **Build query rewriting layer** for natural language → structured queries
12. **Implement context caching** for common retrieval patterns
13. **Add basic multi-tenancy hooks** even if not used
14. **Create data governance layer** for retention and PII

### Watch Carefully

15. **Monitor FTS5 result counts**—if consistently > 50, vector ranking may be needed
16. **Track extraction backlog**—if growing, async pipeline needs scaling
17. **Measure "follow-up query within 60s" rate**—proxy for retrieval failure
18. **Watch context assembly latency**—will become critical path at scale

---

## Conclusion

The Memory Graph Final Approach is **architecturally sound** in its core thesis: graph traversal + keyword search can work for a bounded, single-user context. The schema simplification is **directionally correct** but needs refinement to preserve semantic precision.

The main risks are:

1. **Brittle synonym system** that will fail on natural language queries
2. **Session state too thin** to maintain conversational coherence
3. **No validation methodology** to know if the system is working
4. **Code-graph sync underspecified** to a degree that makes implementation risky

The recommendations above address these gaps while preserving the document's core philosophy of "structured > semantic" and "explicit > fuzzy."

**The document is ~70% ready for implementation.** The missing 30% is validation strategy, error handling, and the semantic precision layers that prevent the simplification from becoming oversimplification.

---

_Analysis Version: 1.0_
_Created: 2026-02-04_
_Methodology: Architectural stress testing, failure mode analysis, scale projection_
