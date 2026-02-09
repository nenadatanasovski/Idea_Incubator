# PHASE5-TASK-02: Evidence Collection for Market/Competition Criteria

**Phase:** Phase 5 - Expand Evaluation Capabilities and Debate
**Status:** SPECIFICATION
**Created:** February 8, 2026
**Dependencies:** PHASE1 (Pre-evaluation research agent)

---

## Overview

Implement comprehensive evidence collection and persistence for Market and Competition criteria evaluations. The system currently collects rich external evidence through web research but loses this data immediately after evaluation runs. This specification addresses the critical gap in evidence persistence, retrieval, and display.

### Current State

**Implemented (70%):**
- ✅ Pre-evaluation research agent (`agents/research.ts`)
- ✅ Web search integration via Claude's native WebSearch tool
- ✅ Evidence collection with source attribution
- ✅ Geographic market analysis (local + global)
- ✅ Competitor discovery beyond user claims
- ✅ Evidence formatting for evaluator context
- ✅ In-memory `EvaluationResult` includes `evidenceCited` and `gapsIdentified`

**Missing (30%):**
- ❌ Database schema for evidence persistence
- ❌ Evidence save logic in evaluation flow
- ❌ Evidence retrieval API endpoints
- ❌ Frontend evidence display components
- ❌ Evidence quality metrics

### Why This Matters

Without evidence persistence:
- **No Auditability**: Can't trace why evaluators scored ideas a certain way
- **No Historical Analysis**: Can't track how market evidence changes over time
- **No Quality Improvement**: Can't identify weak evidence sources or improve research quality
- **No User Transparency**: Users can't see what external data informed their evaluation

---

## Requirements

### FR-1: Evidence Data Collection

The system SHALL collect and structure evidence in the following formats:

**FR-1.1: Evaluation Evidence**
- `evidenceCited`: Array of strings containing quotes/references from the idea that support the evaluation
- `gapsIdentified`: Array of strings describing missing information or uncertainties
- Both fields already collected in `EvaluationResult` interface but not persisted

**FR-1.2: Research Evidence**
- Market size verification with sources
- Competitor discovery (user-mentioned + discovered)
- Market trends with direction and CAGR
- Technology feasibility assessment
- Geographic breakdown (local + global markets)
- All evidence MUST include source URLs

**FR-1.3: Source Attribution**
- Every piece of external evidence MUST cite source URLs
- Sources MUST be web-accessible for verification
- Source type SHOULD be inferred (e.g., "Statista", "McKinsey Report", "Crunchbase")

### FR-2: Evidence Persistence

**FR-2.1: Evaluations Table Enhancement**
The `evaluations` table SHALL be extended with:
- `evidence_cited` (TEXT/JSON): Array of cited evidence from the idea
- `gaps_identified` (TEXT/JSON): Array of identified information gaps
- Both columns SHALL default to empty arrays for existing rows

**FR-2.2: Research Sessions Table**
A new `research_sessions` table SHALL store complete pre-evaluation research:
- Link to `evaluation_sessions` and `ideas`
- Market size data (verified, sources)
- Competitor data (discovered, sources)
- Trend analysis (direction, evidence, sources)
- Technology feasibility (assessment, examples, sources)
- Geographic analysis (full JSON structure)
- Search metadata (queries performed, searches count, timestamp)

**FR-2.3: Evidence Types Table** (Optional Enhancement)
A `evidence_types` reference table MAY be created to classify evidence:
- `market_data`: Market size, growth rates, TAM/SAM/SOM
- `competitor_intel`: Competitor names, market share, positioning
- `trend_analysis`: Market direction, catalysts, timing
- `technical_validation`: Technology feasibility, production examples
- `regulatory_info`: Entry barriers, compliance requirements

### FR-3: Evidence Retrieval API

**FR-3.1: Evaluation Evidence Endpoint**
```
GET /api/ideas/:slug/evaluations/:sessionId/evidence
```

Response:
```json
{
  "evaluations": [
    {
      "criterion": "M1: Market Size",
      "category": "market",
      "score": 8,
      "evidenceCited": [
        "\"$500M TAM in Australia alone\"",
        "\"3 major competitors already operational\""
      ],
      "gapsIdentified": [
        "No SOM calculation provided",
        "Unclear on international expansion plans"
      ],
      "reasoning": "..."
    }
  ]
}
```

**FR-3.2: Research Data Endpoint**
```
GET /api/ideas/:slug/research/:sessionId
```

Response:
```json
{
  "researchSession": {
    "id": "res_123",
    "evaluationSessionId": "eval_456",
    "ideaId": "idea-789",
    "marketSize": {
      "userClaim": "$500M TAM Australia",
      "verified": "$3.2B AUD (food delivery Australia, 2026)",
      "sources": ["https://ibisworld.com/...", "https://deloitte.com/..."]
    },
    "competitors": {
      "userMentioned": ["UberEats", "DoorDash"],
      "discovered": ["Deliveroo", "Menulog", "GrubHub"],
      "sources": ["https://crunchbase.com/...", "https://techcrunch.com/..."]
    },
    "trends": {
      "direction": "growing",
      "evidence": "15% CAGR 2024-2028",
      "sources": ["https://statista.com/..."]
    },
    "techFeasibility": {
      "assessment": "proven",
      "examples": ["DoorDash (React Native)", "UberEats (Flutter)"],
      "sources": ["https://stackshare.io/..."]
    },
    "geographicAnalysis": {
      "creatorLocation": { "city": "Sydney", "country": "Australia" },
      "localMarket": { "region": "Australia", "marketSize": {...}, "competitors": {...} },
      "globalMarket": { "region": "Global", "marketSize": {...}, "competitors": {...} }
    },
    "metadata": {
      "searchesPerformed": 8,
      "createdAt": "2026-02-08T10:30:00Z"
    }
  }
}
```

**FR-3.3: Evidence History Endpoint** (Future Enhancement)
```
GET /api/ideas/:slug/evidence/history
```
Returns timeline of evidence collection across all evaluation sessions, enabling:
- Evidence evolution tracking
- Market trend analysis over time
- Source reliability assessment

### FR-4: Frontend Evidence Display

**FR-4.1: Evidence Tab in Evaluation Dashboard**
Location: `frontend/src/components/EvaluationDashboard.tsx`

Add new tab "Evidence" alongside existing category tabs:
- Display evidence cited per criterion in expandable cards
- Show gaps identified with warning styling
- Provide source links as clickable references
- Filter by category (Market, Competition, Solution, etc.)

**FR-4.2: Research Sources Modal**
Trigger: "View Research" button in evaluation header

Display:
- Market size verification (claimed vs. verified)
- Competitor discovery table (user-mentioned vs. discovered)
- Market trends summary with sources
- Technology feasibility assessment
- Geographic analysis comparison (local vs. global)
- All sources as clickable hyperlinks

**FR-4.3: Evidence Quality Indicators** (Future Enhancement)
Visual indicators for evidence strength:
- 🟢 High: Multiple authoritative sources (Gartner, McKinsey, government data)
- 🟡 Medium: Single source or industry publications
- 🔴 Low: No sources or unverified claims
- ⚪ None: Missing evidence

---

## Technical Design

### 1. Database Schema Changes

#### 1.1 Migration: `database/migrations/XXX_evaluation_evidence.sql`

```sql
-- Add evidence columns to evaluations table
ALTER TABLE evaluations ADD COLUMN evidence_cited TEXT;
ALTER TABLE evaluations ADD COLUMN gaps_identified TEXT;

-- Set defaults for existing rows
UPDATE evaluations SET evidence_cited = '[]' WHERE evidence_cited IS NULL;
UPDATE evaluations SET gaps_identified = '[]' WHERE gaps_identified IS NULL;

-- Add comment for future reference
-- evidence_cited: JSON array of strings - direct quotes/references from idea content
-- gaps_identified: JSON array of strings - missing information noted by evaluator
```

#### 1.2 Migration: `database/migrations/XXX_research_sessions.sql`

```sql
CREATE TABLE IF NOT EXISTS research_sessions (
    id TEXT PRIMARY KEY,
    evaluation_session_id TEXT NOT NULL REFERENCES evaluation_sessions(id) ON DELETE CASCADE,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,

    -- Market Size Evidence
    market_size_user_claim TEXT,
    market_size_verified TEXT,
    market_size_sources TEXT, -- JSON array of URLs

    -- Competitor Evidence
    competitors_user_mentioned TEXT, -- JSON array
    competitors_discovered TEXT, -- JSON array
    competitor_sources TEXT, -- JSON array of URLs

    -- Trend Evidence
    trends_direction TEXT CHECK(trends_direction IN ('growing', 'stable', 'declining', 'unknown')),
    trends_evidence TEXT,
    trends_sources TEXT, -- JSON array of URLs

    -- Tech Feasibility Evidence
    tech_feasibility_assessment TEXT CHECK(tech_feasibility_assessment IN ('proven', 'emerging', 'experimental', 'unknown')),
    tech_feasibility_examples TEXT, -- JSON array
    tech_feasibility_sources TEXT, -- JSON array of URLs

    -- Geographic Analysis (full structure as JSON)
    geographic_analysis TEXT, -- JSON object containing local/global breakdown

    -- Metadata
    searches_performed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(evaluation_session_id) -- One research session per evaluation
);

CREATE INDEX idx_research_sessions_idea ON research_sessions(idea_id);
CREATE INDEX idx_research_sessions_eval ON research_sessions(evaluation_session_id);
```

### 2. Persistence Logic Changes

#### 2.1 Update Evaluation Save Logic

**File:** `scripts/evaluate.ts`
**Function:** Line ~1217 (evaluation insert)

```typescript
// BEFORE (current):
await run(
  `INSERT INTO evaluations
   (idea_id, evaluation_run_id, criterion, category, agent_score, final_score,
    confidence, reasoning, session_id, criterion_id, criterion_name, initial_score, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [/* 13 values, no evidence fields */]
);

// AFTER (enhanced):
await run(
  `INSERT INTO evaluations
   (idea_id, evaluation_run_id, criterion, category, agent_score, final_score,
    confidence, reasoning, session_id, criterion_id, criterion_name, initial_score, created_at,
    evidence_cited, gaps_identified)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    ideaId,
    sessionId,
    eval_.criterion.name,
    eval_.criterion.category,
    eval_.score,
    eval_.score,
    eval_.confidence,
    eval_.reasoning,
    sessionId,
    eval_.criterion.id,
    eval_.criterion.name,
    eval_.score,
    result.timestamp,
    JSON.stringify(eval_.evidenceCited || []),  // NEW
    JSON.stringify(eval_.gapsIdentified || []), // NEW
  ]
);
```

#### 2.2 Add Research Session Save Logic

**File:** `scripts/evaluate.ts`
**New Function:** `saveResearchSession()`

```typescript
/**
 * Save pre-evaluation research results to database
 */
async function saveResearchSession(
  ideaId: string,
  sessionId: string,
  research: ResearchResult,
): Promise<void> {
  const researchId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await run(
    `INSERT INTO research_sessions
     (id, evaluation_session_id, idea_id,
      market_size_user_claim, market_size_verified, market_size_sources,
      competitors_user_mentioned, competitors_discovered, competitor_sources,
      trends_direction, trends_evidence, trends_sources,
      tech_feasibility_assessment, tech_feasibility_examples, tech_feasibility_sources,
      geographic_analysis, searches_performed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      researchId,
      sessionId,
      ideaId,
      research.marketSize.userClaim,
      research.marketSize.verified,
      JSON.stringify(research.marketSize.sources),
      JSON.stringify(research.competitors.userMentioned),
      JSON.stringify(research.competitors.discovered),
      JSON.stringify(research.competitors.sources),
      research.trends.direction,
      research.trends.evidence,
      JSON.stringify(research.trends.sources),
      research.techFeasibility.assessment,
      JSON.stringify(research.techFeasibility.examples),
      JSON.stringify(research.techFeasibility.sources),
      JSON.stringify(research.geographicAnalysis || null),
      research.searchesPerformed,
      research.timestamp,
    ]
  );

  logDebug(`Research session saved: ${researchId}`);
}
```

**Integration Point:** Call after research completes, before evaluation begins (line ~800 in `evaluate.ts`):

```typescript
// After: const research = await conductPreEvaluationResearch(...)
if (research) {
  await saveResearchSession(idea.slug, sessionId, research);
}
```

### 3. API Endpoints

#### 3.1 Evidence Retrieval Endpoint

**File:** `server/routes/evidence.ts` (NEW)

```typescript
import express from "express";
import { db } from "../db";

const router = express.Router();

/**
 * GET /api/ideas/:slug/evaluations/:sessionId/evidence
 * Returns evidence cited and gaps identified for all criteria in an evaluation session
 */
router.get("/ideas/:slug/evaluations/:sessionId/evidence", async (req, res) => {
  try {
    const { slug, sessionId } = req.params;

    // Get idea ID from slug
    const idea = await db.get("SELECT id FROM ideas WHERE slug = ?", [slug]);
    if (!idea) {
      return res.status(404).json({ error: "Idea not found" });
    }

    // Get all evaluations with evidence
    const evaluations = await db.all(
      `SELECT
        criterion_name as criterion,
        category,
        final_score as score,
        confidence,
        reasoning,
        evidence_cited,
        gaps_identified
       FROM evaluations
       WHERE idea_id = ? AND session_id = ?
       ORDER BY category, criterion_name`,
      [idea.id, sessionId]
    );

    // Parse JSON fields
    const parsedEvaluations = evaluations.map(e => ({
      ...e,
      evidenceCited: JSON.parse(e.evidence_cited || "[]"),
      gapsIdentified: JSON.parse(e.gaps_identified || "[]"),
    }));

    res.json({ evaluations: parsedEvaluations });
  } catch (error) {
    console.error("Error fetching evidence:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

#### 3.2 Research Data Endpoint

**File:** `server/routes/research.ts` (NEW)

```typescript
import express from "express";
import { db } from "../db";

const router = express.Router();

/**
 * GET /api/ideas/:slug/research/:sessionId
 * Returns complete pre-evaluation research data
 */
router.get("/ideas/:slug/research/:sessionId", async (req, res) => {
  try {
    const { slug, sessionId } = req.params;

    // Get idea ID
    const idea = await db.get("SELECT id FROM ideas WHERE slug = ?", [slug]);
    if (!idea) {
      return res.status(404).json({ error: "Idea not found" });
    }

    // Get research session
    const research = await db.get(
      `SELECT * FROM research_sessions WHERE evaluation_session_id = ?`,
      [sessionId]
    );

    if (!research) {
      return res.status(404).json({ error: "Research session not found" });
    }

    // Parse JSON fields and structure response
    const researchSession = {
      id: research.id,
      evaluationSessionId: research.evaluation_session_id,
      ideaId: research.idea_id,
      marketSize: {
        userClaim: research.market_size_user_claim,
        verified: research.market_size_verified,
        sources: JSON.parse(research.market_size_sources || "[]"),
      },
      competitors: {
        userMentioned: JSON.parse(research.competitors_user_mentioned || "[]"),
        discovered: JSON.parse(research.competitors_discovered || "[]"),
        sources: JSON.parse(research.competitor_sources || "[]"),
      },
      trends: {
        direction: research.trends_direction,
        evidence: research.trends_evidence,
        sources: JSON.parse(research.trends_sources || "[]"),
      },
      techFeasibility: {
        assessment: research.tech_feasibility_assessment,
        examples: JSON.parse(research.tech_feasibility_examples || "[]"),
        sources: JSON.parse(research.tech_feasibility_sources || "[]"),
      },
      geographicAnalysis: JSON.parse(research.geographic_analysis || "null"),
      metadata: {
        searchesPerformed: research.searches_performed,
        createdAt: research.created_at,
      },
    };

    res.json({ researchSession });
  } catch (error) {
    console.error("Error fetching research:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

**Integration:** Add to `server/api.ts`:

```typescript
import evidenceRoutes from "./routes/evidence";
import researchRoutes from "./routes/research";

app.use("/api", evidenceRoutes);
app.use("/api", researchRoutes);
```

### 4. Frontend Components

#### 4.1 Evidence Tab Component

**File:** `frontend/src/components/EvidenceTab.tsx` (NEW)

```typescript
import React from "react";

interface Evidence {
  criterion: string;
  category: string;
  score: number;
  evidenceCited: string[];
  gapsIdentified: string[];
  reasoning: string;
}

interface EvidenceTabProps {
  ideaSlug: string;
  sessionId: string;
}

export function EvidenceTab({ ideaSlug, sessionId }: EvidenceTabProps) {
  const [evidence, setEvidence] = React.useState<Evidence[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/ideas/${ideaSlug}/evaluations/${sessionId}/evidence`)
      .then(res => res.json())
      .then(data => {
        setEvidence(data.evaluations);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load evidence:", err);
        setLoading(false);
      });
  }, [ideaSlug, sessionId]);

  if (loading) return <div>Loading evidence...</div>;

  // Group by category
  const categories = ["problem", "solution", "market", "feasibility", "risk", "fit"];

  return (
    <div className="evidence-tab">
      {categories.map(category => {
        const categoryEvidence = evidence.filter(e => e.category === category);
        if (categoryEvidence.length === 0) return null;

        return (
          <div key={category} className="category-section">
            <h3>{category.toUpperCase()}</h3>
            {categoryEvidence.map(e => (
              <div key={e.criterion} className="criterion-evidence">
                <h4>{e.criterion} (Score: {e.score}/10)</h4>

                {e.evidenceCited.length > 0 && (
                  <div className="evidence-cited">
                    <strong>Evidence Cited:</strong>
                    <ul>
                      {e.evidenceCited.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {e.gapsIdentified.length > 0 && (
                  <div className="gaps-identified warning">
                    <strong>⚠️ Gaps Identified:</strong>
                    <ul>
                      {e.gapsIdentified.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

#### 4.2 Research Sources Modal

**File:** `frontend/src/components/ResearchModal.tsx` (NEW)

```typescript
import React from "react";

interface ResearchModalProps {
  ideaSlug: string;
  sessionId: string;
  onClose: () => void;
}

export function ResearchModal({ ideaSlug, sessionId, onClose }: ResearchModalProps) {
  const [research, setResearch] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/ideas/${ideaSlug}/research/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        setResearch(data.researchSession);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load research:", err);
        setLoading(false);
      });
  }, [ideaSlug, sessionId]);

  if (loading) return <div className="modal">Loading research...</div>;
  if (!research) return <div className="modal">No research data found</div>;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>

        <h2>External Research Data</h2>

        <section>
          <h3>Market Size</h3>
          <p><strong>User Claim:</strong> {research.marketSize.userClaim || "Not specified"}</p>
          <p><strong>Verified:</strong> {research.marketSize.verified || "Could not verify"}</p>
          {research.marketSize.sources.length > 0 && (
            <div>
              <strong>Sources:</strong>
              <ul>
                {research.marketSize.sources.map((url: string, i: number) => (
                  <li key={i}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h3>Competitors</h3>
          <p><strong>User Mentioned:</strong> {research.competitors.userMentioned.join(", ") || "None"}</p>
          <p><strong>Discovered:</strong> {research.competitors.discovered.join(", ") || "None"}</p>
          {research.competitors.sources.length > 0 && (
            <div>
              <strong>Sources:</strong>
              <ul>
                {research.competitors.sources.map((url: string, i: number) => (
                  <li key={i}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h3>Market Trends</h3>
          <p><strong>Direction:</strong> {research.trends.direction}</p>
          <p><strong>Evidence:</strong> {research.trends.evidence || "No specific evidence found"}</p>
        </section>

        <section>
          <h3>Technology Feasibility</h3>
          <p><strong>Assessment:</strong> {research.techFeasibility.assessment}</p>
          {research.techFeasibility.examples.length > 0 && (
            <p><strong>Examples:</strong> {research.techFeasibility.examples.join(", ")}</p>
          )}
        </section>

        {research.geographicAnalysis && (
          <section>
            <h3>Geographic Analysis</h3>
            <p><strong>Creator Location:</strong> {research.geographicAnalysis.creatorLocation?.city}, {research.geographicAnalysis.creatorLocation?.country}</p>
            {/* Add local vs global market comparison */}
          </section>
        )}
      </div>
    </div>
  );
}
```

#### 4.3 Integration with EvaluationDashboard

**File:** `frontend/src/components/EvaluationDashboard.tsx`

Add new tab and modal trigger:

```typescript
import { EvidenceTab } from "./EvidenceTab";
import { ResearchModal } from "./ResearchModal";

// In component:
const [showResearch, setShowResearch] = useState(false);

// Add tab:
<Tab label="Evidence" value="evidence">
  <EvidenceTab ideaSlug={ideaSlug} sessionId={sessionId} />
</Tab>

// Add modal trigger button in header:
<button onClick={() => setShowResearch(true)}>View Research</button>

// Add modal:
{showResearch && (
  <ResearchModal
    ideaSlug={ideaSlug}
    sessionId={sessionId}
    onClose={() => setShowResearch(false)}
  />
)}
```

---

## Pass Criteria

### PC-1: TypeScript Compilation
**Status:** MUST PASS
```bash
npx tsc --noEmit
```
No compilation errors allowed.

### PC-2: Database Schema
**Status:** MUST PASS
- Migration `XXX_evaluation_evidence.sql` creates `evidence_cited` and `gaps_identified` columns
- Migration `XXX_research_sessions.sql` creates `research_sessions` table with all required fields
- Migrations apply cleanly to existing database without data loss

**Validation:**
```bash
npm run schema:migrate
sqlite3 database/ideas.db ".schema evaluations" | grep evidence
sqlite3 database/ideas.db ".schema research_sessions"
```

### PC-3: Evidence Persistence
**Status:** MUST PASS
- Running evaluation saves `evidenceCited` and `gapsIdentified` to database
- Pre-evaluation research saves to `research_sessions` table
- Existing evaluations without evidence show empty arrays (not null)

**Validation:**
```bash
npm run evaluate test-idea-slug
sqlite3 database/ideas.db "SELECT evidence_cited, gaps_identified FROM evaluations ORDER BY id DESC LIMIT 1;"
sqlite3 database/ideas.db "SELECT id, searches_performed FROM research_sessions ORDER BY created_at DESC LIMIT 1;"
```

### PC-4: Evidence Retrieval API
**Status:** MUST PASS
- `GET /api/ideas/:slug/evaluations/:sessionId/evidence` returns evaluations with evidence
- `GET /api/ideas/:slug/research/:sessionId` returns complete research session
- Both endpoints return 404 for non-existent ideas/sessions
- JSON parsing handles empty arrays gracefully

**Validation:**
```bash
# Start server
npm run dev

# Test evidence endpoint
curl http://localhost:3000/api/ideas/test-idea/evaluations/eval_123/evidence | jq

# Test research endpoint
curl http://localhost:3000/api/ideas/test-idea/research/eval_123 | jq
```

### PC-5: Frontend Evidence Display
**Status:** MUST PASS
- EvidenceTab component loads and displays evidence by category
- Evidence cited shown as bulleted lists under each criterion
- Gaps identified shown with warning styling
- ResearchModal displays all research sections with clickable source links

**Validation:**
1. Navigate to evaluation dashboard for an idea with completed evaluation
2. Click "Evidence" tab - should see evidence grouped by category
3. Click "View Research" button - modal opens with market size, competitors, trends
4. Click source links - should open in new tab to actual URLs

### PC-6: Test Coverage
**Status:** SHOULD PASS (95%+ tests passing)
```bash
npm test
```
- Existing tests continue to pass
- New tests for evidence persistence added
- API endpoint tests added

**New Test Files:**
- `tests/evidence/persistence.test.ts` - Tests evidence save/load
- `tests/api/evidence.test.ts` - Tests API endpoints
- `tests/api/research.test.ts` - Tests research endpoint

### PC-7: Data Integrity
**Status:** MUST PASS
- Evidence JSON fields parse without errors
- Empty evidence arrays handled gracefully
- Research sources always stored as arrays
- No data loss for existing evaluations after migration

---

## Dependencies

### Internal Dependencies
- **PHASE1-TASK-03**: Pre-evaluation web research (COMPLETE)
- **Database**: SQLite with migration system
- **Evaluation Flow**: `scripts/evaluate.ts` orchestration

### External Dependencies
- Claude WebSearch tool (already integrated)
- React 18+ for frontend components
- Express router for API endpoints

---

## Testing Strategy

### Unit Tests

**Test:** `tests/evidence/persistence.test.ts`
```typescript
describe("Evidence Persistence", () => {
  it("should save evidenceCited to database", async () => {
    const evaluation = {
      criterion: { id: "M1", name: "Market Size", category: "market" },
      score: 8,
      confidence: 0.85,
      reasoning: "Strong market...",
      evidenceCited: ["Quote 1", "Quote 2"],
      gapsIdentified: ["Gap 1"],
    };

    await saveEvaluation(ideaId, sessionId, evaluation);

    const saved = await db.get(
      "SELECT evidence_cited FROM evaluations WHERE session_id = ?",
      [sessionId]
    );

    expect(JSON.parse(saved.evidence_cited)).toEqual(["Quote 1", "Quote 2"]);
  });

  it("should save research session with all fields", async () => {
    const research: ResearchResult = {
      marketSize: {
        userClaim: "$10M",
        verified: "$15M verified",
        sources: ["https://example.com"],
      },
      competitors: { /* ... */ },
      trends: { /* ... */ },
      techFeasibility: { /* ... */ },
      geographicAnalysis: null,
      timestamp: new Date().toISOString(),
      searchesPerformed: 5,
    };

    await saveResearchSession(ideaId, sessionId, research);

    const saved = await db.get(
      "SELECT * FROM research_sessions WHERE evaluation_session_id = ?",
      [sessionId]
    );

    expect(saved.market_size_verified).toBe("$15M verified");
    expect(saved.searches_performed).toBe(5);
  });
});
```

### Integration Tests

**Test:** `tests/api/evidence.test.ts`
```typescript
describe("Evidence API", () => {
  it("GET /api/ideas/:slug/evaluations/:sessionId/evidence returns evidence", async () => {
    const response = await request(app)
      .get("/api/ideas/test-idea/evaluations/eval_123/evidence")
      .expect(200);

    expect(response.body.evaluations).toBeInstanceOf(Array);
    expect(response.body.evaluations[0]).toHaveProperty("evidenceCited");
    expect(response.body.evaluations[0]).toHaveProperty("gapsIdentified");
  });

  it("GET /api/ideas/:slug/research/:sessionId returns research data", async () => {
    const response = await request(app)
      .get("/api/ideas/test-idea/research/eval_123")
      .expect(200);

    expect(response.body.researchSession).toHaveProperty("marketSize");
    expect(response.body.researchSession).toHaveProperty("competitors");
    expect(response.body.researchSession.marketSize).toHaveProperty("sources");
  });
});
```

### E2E Tests

**Test:** `tests/e2e/evidence-flow.test.ts`
```typescript
describe("Evidence Flow E2E", () => {
  it("should persist evidence throughout evaluation lifecycle", async () => {
    // 1. Run evaluation
    const result = await runEvaluation("test-idea");

    // 2. Verify research saved
    const research = await db.get(
      "SELECT * FROM research_sessions WHERE evaluation_session_id = ?",
      [result.sessionId]
    );
    expect(research).toBeDefined();

    // 3. Verify evidence saved
    const evaluations = await db.all(
      "SELECT evidence_cited FROM evaluations WHERE session_id = ?",
      [result.sessionId]
    );
    expect(evaluations.length).toBeGreaterThan(0);

    // 4. Verify API retrieval
    const apiResponse = await fetch(
      `/api/ideas/test-idea/evaluations/${result.sessionId}/evidence`
    );
    const data = await apiResponse.json();
    expect(data.evaluations).toHaveLength(evaluations.length);
  });
});
```

---

## Implementation Notes

### Performance Considerations

1. **JSON Column Performance**: SQLite handles JSON TEXT columns efficiently for arrays <100 items. Evidence arrays typically <10 items, so no performance concerns.

2. **API Response Size**: Research sessions can be large (~2-5KB with geographic analysis). Consider:
   - Pagination for evidence history endpoint (future)
   - Lazy loading of research modal content
   - Client-side caching of research data

3. **Database Indexes**: Add indexes on `research_sessions.evaluation_session_id` and `research_sessions.idea_id` for fast lookups.

### Migration Safety

The migrations are **backwards compatible**:
- Adding columns with defaults doesn't break existing code
- New table doesn't affect existing queries
- Frontend gracefully handles missing evidence (empty arrays)

Rollback strategy:
```sql
-- If needed, remove columns (SQLite requires table recreation):
ALTER TABLE evaluations RENAME TO evaluations_old;
CREATE TABLE evaluations (/* original schema */);
INSERT INTO evaluations SELECT /* original columns */ FROM evaluations_old;
DROP TABLE evaluations_old;

-- Remove research table:
DROP TABLE research_sessions;
```

### Future Enhancements

1. **Evidence Quality Scoring**: Analyze source authority (Gartner = high, blog = low)
2. **Evidence History**: Track how market evidence changes over time
3. **Evidence Search**: Full-text search across all evidence
4. **Evidence Export**: Download research as PDF/Word report
5. **Evidence Validation**: Automated link checking for dead sources
6. **Evidence Aggregation**: Cross-idea market intelligence

---

## Files to Create/Modify

### Create (9 files)
1. `database/migrations/XXX_evaluation_evidence.sql` - Evidence columns
2. `database/migrations/XXX_research_sessions.sql` - Research table
3. `server/routes/evidence.ts` - Evidence API endpoint
4. `server/routes/research.ts` - Research API endpoint
5. `frontend/src/components/EvidenceTab.tsx` - Evidence display
6. `frontend/src/components/ResearchModal.tsx` - Research modal
7. `tests/evidence/persistence.test.ts` - Evidence tests
8. `tests/api/evidence.test.ts` - API tests
9. `tests/e2e/evidence-flow.test.ts` - E2E tests

### Modify (3 files)
1. `scripts/evaluate.ts` - Add evidence persistence
2. `server/api.ts` - Register new routes
3. `frontend/src/components/EvaluationDashboard.tsx` - Add Evidence tab

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| JSON parsing errors | Low | Medium | Add try-catch blocks, default to empty arrays |
| Migration fails on production | Low | High | Test migrations on copy of production DB first |
| Research data too large | Medium | Low | Add character limits, pagination for history |
| Source URLs go dead | High | Low | Store source text snapshot (future enhancement) |
| Performance degradation | Low | Medium | Add database indexes, monitor query times |

---

## Success Metrics

1. **Evidence Coverage**: 95%+ of evaluations have at least 1 cited evidence
2. **Research Coverage**: 100% of Market evaluations have associated research session
3. **API Latency**: Evidence/research endpoints respond in <200ms (P95)
4. **Data Quality**: 90%+ of research sources are valid URLs
5. **User Engagement**: 50%+ of users click "View Research" at least once

---

## References

- Validation Report: `PHASE5-TASK-02-VALIDATION-REPORT.md`
- Research Agent: `agents/research.ts`
- Evaluation Flow: `scripts/evaluate.ts`
- Database Schema: `database/ideas.db`
- Strategic Plan: `STRATEGIC_PLAN.md`

---

**END OF SPECIFICATION**
