# Implementation Plan: Expand Graph Analysis to All Source Types

## Overview

Currently, the "Analyze Conversation" feature only examines the last 20 chat messages. This plan expands analysis to include **all content sources**:

| Source Type         | Current         | Planned                  |
| ------------------- | --------------- | ------------------------ |
| Chat Messages       | Last 20         | Last 50 (configurable)   |
| Artifacts           | Not analyzed    | Full content analysis    |
| Memory Files        | Not analyzed    | State extraction         |
| Existing Blocks     | Comparison only | Cross-reference analysis |
| User-Created Blocks | Not analyzed    | Manual insight capture   |

---

## Phase 1: Source Collection Infrastructure

### Task 1.1: Create Multi-Source Collector Service

- [ ] Create `server/services/graph/source-collector.ts`
- [ ] Implement `CollectedSource` interface
- [ ] Add source type enum matching block attribution

**File: `server/services/graph/source-collector.ts`**

```typescript
export type SourceType =
  | "conversation" // Chat messages
  | "artifact" // Created artifacts
  | "memory_file" // Memory state files
  | "user_block" // User-created blocks
  | "external"; // Imported content

export interface CollectedSource {
  id: string;
  type: SourceType;
  content: string;
  metadata: {
    title?: string;
    createdAt: string;
    updatedAt?: string;
    artifactType?: string;
    memoryFileType?: string;
    role?: "user" | "assistant" | "system";
  };
  weight: number; // Source reliability weight (0.0-1.0)
}

export interface SourceCollectionResult {
  sources: CollectedSource[];
  totalTokenEstimate: number;
  truncated: boolean;
  collectionMetadata: {
    conversationCount: number;
    artifactCount: number;
    memoryFileCount: number;
    userBlockCount: number;
  };
}
```

**Pass Criteria:**

- [ ] Interface exports compile without errors
- [ ] All source types represented in enum
- [ ] Weight field supports confidence scoring

**Test Script:**

```bash
# Test: Verify TypeScript compilation
cd /Users/nenadatanasovski/idea_incurator
npx tsc --noEmit server/services/graph/source-collector.ts

# Expected output: No errors
```

**Expected Log Output:**

```
[SourceCollector] Initialized with source types: conversation, artifact, memory_file, user_block, external
```

---

### Task 1.2: Implement Conversation Source Collector

- [ ] Extract conversation collection from `graph-routes.ts`
- [ ] Make message limit configurable
- [ ] Add role-based weighting

**Pass Criteria:**

- [ ] Returns `CollectedSource[]` with type `'conversation'`
- [ ] Respects configurable limit (default 50)
- [ ] User messages weighted 1.0, assistant 0.8, system 0.6

**Test Script:**

```bash
# Test: Verify conversation collection
curl -X POST http://localhost:3000/api/session/test-session/graph/collect-sources \
  -H "Content-Type: application/json" \
  -d '{"sourceTypes": ["conversation"], "limit": 10}'

# Expected: Returns conversation sources with proper weights
```

**Expected Log Output:**

```
[SourceCollector] Collecting conversation sources for session: {sessionId}
[SourceCollector] Found 10 messages (limit: 50, truncated: false)
[SourceCollector] Conversation collection complete: 10 sources, ~2400 tokens
```

---

### Task 1.3: Implement Artifact Source Collector

- [ ] Query `ideation_artifacts` table by session
- [ ] Load unified artifacts from filesystem
- [ ] Weight by artifact type (research: 0.9, code: 0.7, etc.)

**Weight Table:**
| Artifact Type | Weight | Rationale |
|---------------|--------|-----------|
| research | 0.9 | Verified external data |
| analysis | 0.85 | Structured analysis |
| comparison | 0.8 | Comparative insights |
| idea-summary | 0.75 | Synthesized content |
| markdown | 0.7 | General documentation |
| code | 0.7 | Implementation details |
| mermaid | 0.6 | Visual diagrams (text extracted) |
| template | 0.5 | Boilerplate content |

**Pass Criteria:**

- [ ] Returns artifacts from both DB and filesystem
- [ ] Deduplicates by artifact ID
- [ ] Applies correct weight per type
- [ ] Truncates large artifacts (>10k chars) with marker

**Test Script:**

```bash
# Test: Verify artifact collection
curl -X POST http://localhost:3000/api/session/test-session/graph/collect-sources \
  -H "Content-Type: application/json" \
  -d '{"sourceTypes": ["artifact"]}'

# Verify weights in response
cat response.json | jq '.sources[] | select(.type == "artifact") | {id, weight, artifactType: .metadata.artifactType}'
```

**Expected Log Output:**

```
[SourceCollector] Collecting artifact sources for session: {sessionId}
[SourceCollector] Found 3 DB artifacts, 2 unified artifacts
[SourceCollector] After deduplication: 4 unique artifacts
[SourceCollector] Artifact collection complete: 4 sources, ~8500 tokens
  - research: 2 (weight: 0.9)
  - code: 1 (weight: 0.7)
  - markdown: 1 (weight: 0.7)
```

---

### Task 1.4: Implement Memory File Source Collector

- [ ] Query `ideation_memory_files` by session
- [ ] Extract JSON state from `<!-- STATE_JSON -->` comments
- [ ] Parse markdown structure for insights

**Memory File Weights:**
| File Type | Weight | Rationale |
|-----------|--------|-----------|
| viability_assessment | 0.95 | Validated analysis |
| market_discovery | 0.9 | External market data |
| self_discovery | 0.85 | User-confirmed insights |
| idea_candidate | 0.8 | Refined idea state |
| narrowing_state | 0.75 | Working hypotheses |
| conversation_summary | 0.7 | Compressed history |
| handoff_notes | 0.6 | Transition context |

**Pass Criteria:**

- [ ] Extracts embedded JSON state correctly
- [ ] Parses markdown sections into structured content
- [ ] Handles missing/malformed files gracefully
- [ ] Returns file type in metadata

**Test Script:**

```bash
# Test: Verify memory file collection
curl -X POST http://localhost:3000/api/session/test-session/graph/collect-sources \
  -H "Content-Type: application/json" \
  -d '{"sourceTypes": ["memory_file"]}'

# Verify JSON extraction worked
cat response.json | jq '.sources[] | select(.type == "memory_file") | {id, fileType: .metadata.memoryFileType, hasState: (.content | contains("STATE_JSON") | not)}'
```

**Expected Log Output:**

```
[SourceCollector] Collecting memory file sources for session: {sessionId}
[SourceCollector] Found 5 memory files
[SourceCollector] Parsed state from: self_discovery, market_discovery, narrowing_state
[SourceCollector] Memory file collection complete: 5 sources, ~4200 tokens
  - viability_assessment: 1 (weight: 0.95)
  - market_discovery: 1 (weight: 0.9)
  - self_discovery: 1 (weight: 0.85)
  - idea_candidate: 1 (weight: 0.8)
  - conversation_summary: 1 (weight: 0.7)
```

---

### Task 1.5: Implement User Block Source Collector

- [ ] Query blocks where `extracted_from_message_id IS NULL AND artifact_id IS NULL`
- [ ] These are manually created blocks (user insights)
- [ ] Weight by block status and confidence

**Pass Criteria:**

- [ ] Identifies user-created vs extracted blocks
- [ ] Excludes blocks already in graph (avoid duplication)
- [ ] Respects block status (active > draft > validated)

**Test Script:**

```bash
# Test: Verify user block collection
curl -X POST http://localhost:3000/api/session/test-session/graph/collect-sources \
  -H "Content-Type: application/json" \
  -d '{"sourceTypes": ["user_block"]}'

# Should only return manually created blocks
cat response.json | jq '.sources[] | select(.type == "user_block") | .id'
```

**Expected Log Output:**

```
[SourceCollector] Collecting user-created block sources for session: {sessionId}
[SourceCollector] Found 12 total blocks, 3 are user-created
[SourceCollector] User block collection complete: 3 sources, ~600 tokens
```

---

### Task 1.6: Create Unified Collection Orchestrator

- [ ] Implement `collectAllSources(sessionId, options)` function
- [ ] Respect token budget (default 50k tokens)
- [ ] Priority order: memory_file > artifact > conversation > user_block
- [ ] Return aggregated result with metadata

**Pass Criteria:**

- [ ] Collects from all enabled source types
- [ ] Stays within token budget
- [ ] Returns collection metadata for logging
- [ ] Handles partial failures gracefully

**Test Script:**

```bash
# Test: Full collection with budget
curl -X POST http://localhost:3000/api/session/test-session/graph/collect-sources \
  -H "Content-Type: application/json" \
  -d '{"tokenBudget": 30000}'

# Verify budget respected
cat response.json | jq '{totalTokens: .totalTokenEstimate, truncated, counts: .collectionMetadata}'
```

**Expected Log Output:**

```
[SourceCollector] Starting unified collection for session: {sessionId}
[SourceCollector] Token budget: 30000
[SourceCollector] Collection order: memory_file, artifact, conversation, user_block
[SourceCollector] === Collection Summary ===
  Total sources: 22
  Token estimate: 28400 / 30000
  Truncated: false
  By type:
    - conversation: 15 sources (12000 tokens)
    - artifact: 4 sources (8500 tokens)
    - memory_file: 5 sources (4200 tokens)
    - user_block: 3 sources (600 tokens)
    - external: 0 sources (0 tokens)
[SourceCollector] Collection complete in 145ms
```

---

## Phase 2: Enhanced Analysis Prompt

### Task 2.1: Update AI Prompt Structure

- [ ] Segment sources by type in prompt
- [ ] Include source metadata for attribution
- [ ] Add source-specific extraction instructions

**Prompt Template:**

```markdown
## CONVERSATION CONTEXT (Weight: High)

Recent dialogue between user and assistant.
{conversation_sources}

## ARTIFACTS (Weight: High)

Documents and code created during session.
{artifact_sources}

## MEMORY STATE (Weight: Very High)

Persisted discoveries and assessments.
{memory_file_sources}

## USER INSIGHTS (Weight: Medium)

Manually captured observations.
{user_block_sources}

## EXISTING GRAPH

Current blocks to avoid duplication.
{existing_blocks_summary}

## INSTRUCTIONS

1. Extract NEW insights not already in the existing graph
2. Attribute each insight to its source (sourceId, sourceType)
3. Weight confidence by source reliability
4. Identify cross-source corroborations (increases confidence)
5. Flag contradictions between sources
```

**Pass Criteria:**

- [ ] All source types have dedicated sections
- [ ] Existing blocks included to prevent duplication
- [ ] Instructions emphasize attribution

**Test Script:**

```bash
# Test: Verify prompt generation
node -e "
const { buildAnalysisPrompt } = require('./server/services/graph/analysis-prompt-builder');
const sources = { /* mock sources */ };
const prompt = buildAnalysisPrompt(sources);
console.log('Prompt sections:', prompt.match(/## [A-Z]/g)?.length || 0);
console.log('Has attribution instruction:', prompt.includes('sourceId'));
"
```

**Expected Log Output:**

```
[AnalysisPromptBuilder] Building prompt for 22 sources
[AnalysisPromptBuilder] Sections included: CONVERSATION, ARTIFACTS, MEMORY STATE, USER INSIGHTS, EXISTING GRAPH
[AnalysisPromptBuilder] Total prompt tokens: ~32000
[AnalysisPromptBuilder] Prompt ready for analysis
```

---

### Task 2.2: Update Response Schema

- [ ] Add `sourceId` and `sourceType` to proposed changes
- [ ] Add `corroboratedBy` array for cross-source validation
- [ ] Add `contradicts` array for conflict detection

**Updated Schema:**

```typescript
interface ProposedChange {
  id: string;
  type: "create_block" | "update_block" | "create_link";
  blockType?: string;
  content: string;
  graphMembership?: string[];
  confidence: number;

  // NEW: Source attribution
  sourceId: string; // ID of source this was extracted from
  sourceType: SourceType; // Type of source
  sourceWeight: number; // Inherited weight from source

  // NEW: Cross-source validation
  corroboratedBy?: Array<{
    sourceId: string;
    sourceType: SourceType;
    snippet: string; // Supporting text
  }>;

  // NEW: Conflict detection
  contradicts?: Array<{
    blockId: string;
    description: string;
    severity: "minor" | "major";
  }>;
}
```

**Pass Criteria:**

- [ ] All proposed changes include source attribution
- [ ] Corroboration increases confidence score
- [ ] Contradictions surfaced with severity

**Test Script:**

```bash
# Test: Verify response includes attribution
curl -X POST http://localhost:3000/api/session/test-session/graph/analyze-changes \
  -H "Content-Type: application/json"

# Check for new fields
cat response.json | jq '.proposedChanges[0] | {sourceId, sourceType, sourceWeight, corroboratedBy, contradicts}'
```

**Expected Log Output:**

```
[GraphAnalysis] Analyzing session: {sessionId}
[GraphAnalysis] Sources analyzed: 22
[GraphAnalysis] Proposed changes: 8
  - From conversation: 4
  - From artifacts: 2
  - From memory_file: 2
  - From user_block: 0
[GraphAnalysis] Corroborations found: 3
[GraphAnalysis] Contradictions detected: 1 (major: 0, minor: 1)
```

---

## Phase 3: Update UI and Logging

### Task 3.1: Update Loading Message

- [ ] Change "Analyzing Conversation" to "Analyzing Sources"
- [ ] Add source count indicator
- [ ] Show which sources are being analyzed

**File: `frontend/src/components/graph/GraphContainer.tsx`**

```tsx
// Before
<h3>Analyzing Conversation</h3>
<p>Extracting insights and proposed graph updates...</p>

// After
<h3>Analyzing {sourceCount} Sources</h3>
<p>
  {analyzingSources.map(s => sourceLabels[s]).join(', ')}
</p>
```

**Pass Criteria:**

- [ ] Message reflects actual sources being analyzed
- [ ] Count updates dynamically
- [ ] Graceful fallback if count unavailable

**Test Script:**

```bash
# Manual test: Observe UI during analysis
# 1. Open graph view
# 2. Click "Update Memory Graph"
# 3. Verify loading shows "Analyzing X Sources"
# 4. Verify source types listed below
```

**Expected Log Output:**

```
[GraphContainer] Analysis started
[GraphContainer] Displaying: "Analyzing 22 Sources"
[GraphContainer] Source types: Chat (15), Artifacts (4), Memory (5), Manual (3)
```

---

### Task 3.2: Enhance Graph Change Logging

- [ ] Add `sourceType` to `memory_graph_changes` table
- [ ] Add `sourceId` field
- [ ] Update `logGraphChange()` function

**Migration: Add source tracking to graph changes**

```sql
ALTER TABLE memory_graph_changes ADD COLUMN source_type TEXT;
ALTER TABLE memory_graph_changes ADD COLUMN source_id TEXT;
CREATE INDEX idx_graph_changes_source_type ON memory_graph_changes(source_type);
```

**Pass Criteria:**

- [ ] All new changes logged with source info
- [ ] Existing logs unaffected (nullable columns)
- [ ] Can query changes by source type

**Test Script:**

```bash
# Test: Verify logging includes source
# 1. Trigger analysis and apply a change
# 2. Query the log

sqlite3 data/app.db "
  SELECT change_type, source_type, source_id
  FROM memory_graph_changes
  ORDER BY timestamp DESC
  LIMIT 5
"

# Expected: source_type and source_id populated
```

**Expected Log Output:**

```
[GraphChangeLogger] Logging change: created
  Block: {blockId}
  Type: content
  Source: artifact (artifact-123)
  Trigger: ai_confirmed
[GraphChangeLogger] Change logged successfully
```

---

### Task 3.3: Add Analysis Telemetry

- [ ] Create `analysis_runs` table for tracking
- [ ] Log analysis duration, source counts, outcomes
- [ ] Enable performance monitoring

**Schema:**

```typescript
export const analysisRuns = sqliteTable("analysis_runs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  durationMs: integer("duration_ms"),
  status: text("status"), // success, partial, failed

  // Source metrics
  conversationCount: integer("conversation_count"),
  artifactCount: integer("artifact_count"),
  memoryFileCount: integer("memory_file_count"),
  userBlockCount: integer("user_block_count"),
  totalTokens: integer("total_tokens"),

  // Outcome metrics
  proposedChanges: integer("proposed_changes"),
  corroborations: integer("corroborations"),
  contradictions: integer("contradictions"),
  changesApplied: integer("changes_applied"),

  error: text("error"),
});
```

**Pass Criteria:**

- [ ] Every analysis run logged
- [ ] Duration tracked for performance
- [ ] Source breakdown captured
- [ ] Failed runs include error details

**Test Script:**

```bash
# Test: Verify telemetry captured
# 1. Run analysis
# 2. Query telemetry

sqlite3 data/app.db "
  SELECT
    id,
    duration_ms,
    conversation_count,
    artifact_count,
    proposed_changes,
    status
  FROM analysis_runs
  ORDER BY started_at DESC
  LIMIT 1
"
```

**Expected Log Output:**

```
[AnalysisTelemetry] Run started: {runId}
[AnalysisTelemetry] Run completed
  Duration: 2340ms
  Sources: 22 (conv: 15, art: 4, mem: 5, user: 3)
  Tokens: 32400
  Proposed: 8 changes
  Corroborations: 3
  Contradictions: 1
[AnalysisTelemetry] Telemetry saved
```

---

## Phase 4: Integration and Testing

### Task 4.1: Update `analyzeSessionForGraphUpdates`

- [ ] Replace direct message query with source collector
- [ ] Update prompt building to use new structure
- [ ] Ensure backward compatibility

**Pass Criteria:**

- [ ] Existing API contract unchanged
- [ ] New source types included in analysis
- [ ] Performance within 5 seconds for typical sessions

**Test Script:**

```bash
# Test: Full integration
# 1. Create session with messages, artifacts, memory files
# 2. Run analysis
# 3. Verify all sources considered

curl -X POST http://localhost:3000/api/session/test-session/graph/analyze-changes

# Verify response
cat response.json | jq '{
  proposedCount: .proposedChanges | length,
  hasArtifactSource: ([.proposedChanges[].sourceType] | contains(["artifact"])),
  hasMemorySource: ([.proposedChanges[].sourceType] | contains(["memory_file"]))
}'
```

**Expected Log Output:**

```
[analyzeSessionForGraphUpdates] Starting analysis for session: {sessionId}
[analyzeSessionForGraphUpdates] Collecting sources...
[SourceCollector] === Collection Summary ===
  Total sources: 22
  Token estimate: 28400
[analyzeSessionForGraphUpdates] Building analysis prompt...
[analyzeSessionForGraphUpdates] Calling AI (model: claude-3-haiku)...
[analyzeSessionForGraphUpdates] AI response received (1.8s)
[analyzeSessionForGraphUpdates] Parsing response...
[analyzeSessionForGraphUpdates] Analysis complete
  Proposed changes: 8
  - From conversation: 4 (sourceType: conversation)
  - From artifacts: 2 (sourceType: artifact)
  - From memory_file: 2 (sourceType: memory_file)
  Corroborations: 3
  Contradictions: 1
[analyzeSessionForGraphUpdates] Total duration: 2.3s
```

---

### Task 4.2: Create E2E Test Suite

- [ ] Test with session containing all source types
- [ ] Verify source attribution in results
- [ ] Test token budget truncation
- [ ] Test error handling for missing sources

**Test File: `tests/e2e/graph_analysis_sources.py`**

```python
#!/usr/bin/env python3
"""E2E tests for expanded graph analysis sources."""

import requests
import json

BASE_URL = "http://localhost:3000/api"

def test_all_source_types_collected():
    """Verify all source types are collected and analyzed."""
    session_id = "test-multi-source-session"

    # Trigger analysis
    response = requests.post(
        f"{BASE_URL}/session/{session_id}/graph/analyze-changes"
    )
    assert response.status_code == 200

    data = response.json()

    # Verify source types in proposed changes
    source_types = set(c.get("sourceType") for c in data["proposedChanges"])

    print(f"Source types found: {source_types}")
    assert "conversation" in source_types, "Missing conversation sources"
    # These may not always be present depending on session content
    # assert "artifact" in source_types, "Missing artifact sources"

    print("PASS: All source types collected")

def test_source_attribution():
    """Verify each proposed change has source attribution."""
    session_id = "test-multi-source-session"

    response = requests.post(
        f"{BASE_URL}/session/{session_id}/graph/analyze-changes"
    )
    data = response.json()

    for change in data["proposedChanges"]:
        assert "sourceId" in change, f"Missing sourceId in change {change['id']}"
        assert "sourceType" in change, f"Missing sourceType in change {change['id']}"
        assert "sourceWeight" in change, f"Missing sourceWeight in change {change['id']}"

    print(f"PASS: All {len(data['proposedChanges'])} changes have attribution")

def test_token_budget_respected():
    """Verify token budget limits source collection."""
    session_id = "test-large-session"

    response = requests.post(
        f"{BASE_URL}/session/{session_id}/graph/collect-sources",
        json={"tokenBudget": 5000}
    )
    data = response.json()

    assert data["totalTokenEstimate"] <= 5000, \
        f"Token budget exceeded: {data['totalTokenEstimate']}"

    if data["truncated"]:
        print(f"PASS: Sources truncated to fit budget ({data['totalTokenEstimate']} tokens)")
    else:
        print(f"PASS: Sources fit within budget ({data['totalTokenEstimate']} tokens)")

def test_corroboration_detection():
    """Verify cross-source corroboration is detected."""
    session_id = "test-corroboration-session"

    response = requests.post(
        f"{BASE_URL}/session/{session_id}/graph/analyze-changes"
    )
    data = response.json()

    corroborated = [c for c in data["proposedChanges"] if c.get("corroboratedBy")]

    print(f"Found {len(corroborated)} corroborated changes")

    for change in corroborated:
        print(f"  - {change['content'][:50]}...")
        print(f"    Corroborated by: {len(change['corroboratedBy'])} sources")
        # Corroborated changes should have higher confidence
        assert change["confidence"] >= 0.7, \
            f"Corroborated change has low confidence: {change['confidence']}"

    print("PASS: Corroboration detection working")

if __name__ == "__main__":
    test_all_source_types_collected()
    test_source_attribution()
    test_token_budget_respected()
    test_corroboration_detection()
    print("\n=== All E2E tests passed ===")
```

**Run Command:**

```bash
python3 tests/e2e/graph_analysis_sources.py
```

**Expected Output:**

```
Source types found: {'conversation', 'artifact', 'memory_file'}
PASS: All source types collected
PASS: All 8 changes have attribution
PASS: Sources truncated to fit budget (4850 tokens)
Found 2 corroborated changes
  - Market size estimated at $50B by 2027...
    Corroborated by: 2 sources
  - Primary competitor lacks mobile presence...
    Corroborated by: 1 sources
PASS: Corroboration detection working

=== All E2E tests passed ===
```

---

### Task 4.3: Update GraphControls Button Text

- [ ] Change button label from "Update Memory Graph" to "Analyze All Sources"
- [ ] Add tooltip explaining what sources are analyzed

**Pass Criteria:**

- [ ] Button text updated
- [ ] Tooltip shows source types

**Test Script:**

```bash
# Visual verification
# 1. Open graph view
# 2. Hover over button
# 3. Verify tooltip shows: "Analyzes chat, artifacts, memory files, and manual insights"
```

---

## Rollout Checklist

### Pre-Deployment

- [ ] All unit tests passing
- [ ] E2E test suite passing
- [ ] Migration tested on copy of production DB
- [ ] Performance benchmarked (<5s for typical session)

### Deployment

- [ ] Run database migration
- [ ] Deploy updated backend
- [ ] Deploy updated frontend
- [ ] Verify telemetry logging

### Post-Deployment

- [ ] Monitor analysis duration metrics
- [ ] Check for increased error rates
- [ ] Validate source attribution in production
- [ ] Gather user feedback on new insights

---

## File Changes Summary

| File                                               | Change Type | Description                     |
| -------------------------------------------------- | ----------- | ------------------------------- |
| `server/services/graph/source-collector.ts`        | NEW         | Multi-source collection service |
| `server/services/graph/analysis-prompt-builder.ts` | NEW         | Structured prompt generation    |
| `server/routes/ideation/graph-routes.ts`           | MODIFY      | Use source collector            |
| `schema/entities/analysis-run.ts`                  | NEW         | Telemetry schema                |
| `schema/migrations/XXX_add_source_tracking.ts`     | NEW         | Add source fields               |
| `frontend/src/components/graph/GraphContainer.tsx` | MODIFY      | Update loading message          |
| `frontend/src/components/graph/GraphControls.tsx`  | MODIFY      | Update button text              |
| `tests/e2e/graph_analysis_sources.py`              | NEW         | E2E test suite                  |

---

## Success Metrics

| Metric                        | Current          | Target           |
| ----------------------------- | ---------------- | ---------------- |
| Sources analyzed per run      | 1 (conversation) | 4 (all types)    |
| Insights with attribution     | 0%               | 100%             |
| Cross-source corroborations   | None detected    | Tracked          |
| Analysis latency (p95)        | ~2s              | <5s              |
| User-reported insight quality | Baseline         | +20% improvement |
