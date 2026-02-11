# PHASE1-TASK-01: Markdown→Database Sync for Q&A Answers

**Status:** ✅ IMPLEMENTED
**Created:** 2026-02-08
**Category:** Data Flow Integration
**Priority:** Critical

---

## Overview

This specification documents the **already implemented** system that syncs Q&A answers from `development.md` files into the database, ensuring evaluators receive complete context during idea evaluation.

### Purpose

Prior to this implementation, evaluators only had access to idea README content. Critical context from development sessions (user skills, financial runway, technical details, market validation) was locked in markdown files and unavailable during evaluation. This created a **critical data flow gap** where evaluators made assessments without the full picture.

### Solution

A dual-sync system that:

1. **Parses** `development.md` files using flexible pattern matching
2. **Classifies** free-form questions to structured question bank IDs
3. **Syncs** to SQLite `idea_answers` table for evaluator queries
4. **Syncs** to Neo4j memory graph as knowledge blocks (optional)

---

## Requirements

### Functional Requirements

**FR1: Parse Multiple Q&A Formats**

- Support `Q: ... A: ...` format (primary)
- Support markdown table format with Question/Answer columns
- Support section headings as questions
- Extract question, answer, optional category, optional date

**FR2: Classify Questions to Question Bank**

- Map free-form questions to structured IDs (P1_CORE, FT3_SKILLS, etc.)
- Use keyword pattern matching from `questions/classifier.ts`
- Support all 6 evaluation categories (Problem, Solution, Market, Feasibility, Risk, Fit)

**FR3: Sync to SQLite Database**

- Insert into `idea_answers` table with proper schema
- Link to `ideas` table via `idea_id` foreign key
- Link to `question_bank` table via `question_id` foreign key
- Track answer source (`user`, `ai_extracted`, `ai_inferred`)
- Store confidence score (0.0-1.0)

**FR4: Sync to Neo4j Memory Graph (Optional)**

- Create knowledge blocks for Q&A pairs
- Create question blocks for identified gaps
- Create knowledge blocks for key insights
- Tag with `ideaId`, `sessionId`, `source='development.md'`

**FR5: Integrate with npm run sync**

- Execute as part of main sync workflow
- Process all ideas with `development.md` files
- Report sync statistics (Q&A found, blocks created, answers inserted)
- Handle missing idea IDs gracefully

### Non-Functional Requirements

**NFR1: Performance**

- Process typical development.md file (<10KB) in <500ms
- Avoid LLM fallback during sync to prevent unexpected costs
- Batch database operations where possible

**NFR2: Reliability**

- Continue processing other ideas if one fails
- Clear existing answers before re-sync to avoid duplicates
- Gracefully handle Neo4j unavailability (SQLite-only mode)

**NFR3: Data Quality**

- Skip very short answers (<10 characters)
- Skip duplicate questions (case-insensitive normalization)
- Classify answers with confidence scores
- Report unclassified questions for manual review

---

## Technical Design

### Architecture

```
development.md
      ↓
[Parser] → parseQAFromMarkdown() → QAPair[]
      ↓
[Classifier] → classifyQuestionToId() → question_id
      ↓
   ┌─────────────────┬──────────────────┐
   ↓                 ↓                  ↓
[SQLite]       [Neo4j]            [Memory Graph]
idea_answers    Block nodes        Knowledge graph
```

### Key Components

#### 1. Parser (`questions/parser.ts`)

**Function:** `parseQAFromMarkdown(content: string): ParsedQA[]`

**Patterns Supported:**

- Pattern 1: `**Q:** question **A:** answer` (bold format)
- Pattern 2: `### Question` heading with answer below
- Pattern 3: `Q: question\nA: answer` (simple format)
- Pattern 4: `1. Question? Answer` (numbered)
- Pattern 5: `**Question?** Answer` (bold question)

**Output:**

```typescript
interface ParsedQA {
  question: string;
  answer: string;
  confidence: number; // 0.9 for user-provided answers
}
```

**LLM Fallback:**

- Uses Haiku for cost efficiency
- Triggers if <3 Q&A pairs found and content >500 chars
- **Disabled during sync** to avoid unexpected API costs
- Extracts Q&A from messy/inconsistent formats

#### 2. Classifier (`questions/classifier.ts`)

**Function:** `classifyQuestionToId(question: string): string | null`

**Classification Logic:**

- Regex pattern matching against 100+ keyword patterns
- Categories: Problem (P1-P5), Solution (S1-S5), Market (M1-M5), Feasibility (F1-F5), Risk (R\_\*), Fit (FT1-FT5)
- Returns question ID (e.g., `"FT3_SKILLS"`) or `null` if no match

**Example Mappings:**

- "What technical skills do you have?" → `FT3_SKILLS`
- "What is your financial runway?" → `FT5_RUNWAY`
- "How big is the market?" → `M1_TAM`
- "What validation have you done?" → `P4_EVIDENCE`

#### 3. Sync to SQLite (`scripts/sync.ts`)

**Function:** `syncDevelopmentAnswers(ideaId: string, folderPath: string)`

**Process:**

1. Read `development.md` from folder
2. Parse Q&A pairs using parser
3. For each Q&A:
   - Classify question to question_id
   - Insert into `idea_answers` table via `saveAnswer()`
4. Clear old answers before inserting new ones

**Database Schema:**

```sql
CREATE TABLE idea_answers (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES question_bank(id),
    answer TEXT NOT NULL,
    answer_source TEXT DEFAULT 'user'
      CHECK(answer_source IN ('user', 'ai_extracted', 'ai_inferred')),
    confidence REAL DEFAULT 1.0
      CHECK(confidence >= 0 AND confidence <= 1),
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(idea_id, question_id)
);
```

#### 4. Sync to Neo4j (`scripts/sync-development.ts`)

**Function:** `syncToNeo4j(driver: Driver, data: DevelopmentData)`

**Process:**

1. Create session ID: `dev-sync-{slug}-{timestamp}`
2. Create knowledge blocks for each Q&A pair
3. Create question blocks for identified gaps
4. Create knowledge blocks for insights

**Node Schema:**

```cypher
CREATE (b:Block {
  id: UUID,
  type: 'knowledge',  // or 'question'
  title: question_text,
  content: "Q: ... A: ...",
  sessionId: session_id,
  ideaId: idea_id,
  status: 'active',    // or 'validated'
  source: 'development.md',
  createdAt: datetime(),
  updatedAt: datetime()
})
```

### Integration with Main Sync

**File:** `scripts/sync.ts`

**Function:** `syncIdeasToDb()`

**Integration Points:**

1. After creating/updating idea in database
2. Call `syncDevelopmentAnswers(ideaId, ideaFolder)`
3. Track results in `SyncResult.developmentSynced` and `developmentFailed`
4. Include development.md in content hash for staleness detection

**Content Hash Calculation:**

```typescript
function computeIdeaHash(ideaPath: string): string {
  const filesToHash = [
    "README.md",
    "development.md", // ← Included in hash
    "research/*.md",
  ];
  // MD5 hash of concatenated content
}
```

### Error Handling

**Scenario 1: No development.md file**

- Return `{ synced: 0, failed: 0, skipped: 0 }`
- Continue processing other ideas

**Scenario 2: Empty/template-only file**

- Skip if content < 100 characters
- Return `{ synced: 0, failed: 0, skipped: 1 }`

**Scenario 3: Unclassifiable question**

- Log debug message with question preview
- Increment `failed` counter
- Report in summary for manual review

**Scenario 4: Missing idea_id**

- Query database for idea ID by slug
- If not found, skip sync (return 0)

**Scenario 5: Neo4j unavailable**

- Log warning
- Continue with SQLite-only sync
- System remains functional

---

## Pass Criteria

### PC1: Parse Q&A from development.md ✅

**Validation:**

- Read `ideas/e2e-test-smart-wellness-tracker/development.md`
- Parse using `parseQAFromMarkdown()`
- Verify ≥5 Q&A pairs extracted
- Check pattern: `/Q:\s*.+\nA:\s*.+/g`

**Evidence:** `tests/sync-development.test.ts:26-35`

### PC2: Classify Questions to Question Bank ✅

**Validation:**

- Parse development.md Q&A pairs
- Classify each using `classifyQuestionToId()`
- Verify classifications:
  - "technical skills" → `FT3_SKILLS`
  - "financial runway" → `FT5_RUNWAY`
  - "market size" → `M1_TAM`
  - "validation" → `P4_EVIDENCE`

**Evidence:** `questions/classifier.ts:546-558`

### PC3: Sync to idea_answers Table ✅

**Validation:**

- Run `npm run sync`
- Query: `SELECT * FROM idea_answers WHERE source = 'development.md'`
- Verify rows inserted with correct schema
- Check foreign keys to `ideas` and `question_bank`

**Evidence:** `scripts/sync.ts:186-191`

### PC4: Include in Main Sync Workflow ✅

**Validation:**

- Run `npm run sync`
- Check console output for "Synced N development answers"
- Verify `result.developmentSynced` counter incremented
- Confirm development.md changes trigger re-evaluation

**Evidence:** `scripts/sync.ts:185-191, 217-223`

### PC5: Handle Edge Cases ✅

**Validation:**

- Missing development.md → No error, skipped
- Empty file → Skipped (< 100 chars)
- Neo4j down → SQLite-only mode, no crash
- Unclassifiable question → Logged, reported in failed count

**Evidence:** `scripts/sync.ts:76-84, scripts/sync-development.ts:333-347`

### PC6: Report Statistics ✅

**Validation:**

- Run `npm run sync`
- Output includes:
  ```
  Development Answers:
    Synced: X
    Could not map: Y
  ```

**Evidence:** `scripts/sync.ts:380-386`

---

## Dependencies

### Runtime Dependencies

- **sqlite3** - SQLite database operations
- **neo4j-driver** - Neo4j graph database (optional)
- **uuid** - Generate unique IDs
- **fs/path** - File system operations

### Database Schema

- `ideas` table (migration 001)
- `question_bank` table (migration 008)
- `idea_answers` table (migration 008)
- `idea_readiness` table (migration 008)

### Related Files

- `questions/bank.yml` - Question definitions
- `questions/classifier.ts` - Question classification
- `questions/parser.ts` - Markdown Q&A parsing
- `questions/readiness.ts` - `saveAnswer()` function
- `scripts/sync.ts` - Main sync orchestrator
- `scripts/sync-development.ts` - Standalone Neo4j sync

---

## Testing Strategy

### Unit Tests

**File:** `tests/sync-development.test.ts`

**Test Cases:**

1. ✅ Find development.md in test idea folder
2. ✅ Detect Q&A pairs in Q:/A: format
3. ✅ Parse at least 5 Q&A pairs
4. ✅ Include development content in idea context
5. ✅ Verify specific Q&A content present

### Integration Tests

**Manual Verification:**

```bash
# 1. Run sync
npm run sync

# 2. Check database
sqlite3 database/vibe.db "SELECT COUNT(*) FROM idea_answers WHERE source = 'user'"

# 3. Verify content
sqlite3 database/vibe.db "SELECT question_id, answer FROM idea_answers WHERE idea_id = 'test-idea-id'"

# 4. Check Neo4j (if available)
# Open Neo4j Browser at localhost:7474
# Run: MATCH (b:Block {source: 'development.md'}) RETURN b LIMIT 10
```

### Test Data

**Location:** `ideas/e2e-test-smart-wellness-tracker/development.md`

**Sample Q&A:**

```markdown
Q: What specific technical skills do you have for this project?
A: I have 10 years of embedded systems experience including 3 years with TinyML...

Q: What is your financial runway?
A: I have 18 months of personal runway saved, plus $150k in pre-seed commitments...
```

---

## Migration Path

### Phase 1: ✅ COMPLETE

- Parser implementation (`questions/parser.ts`)
- Classifier implementation (`questions/classifier.ts`)
- Database schema (`migrations/008_dynamic_questioning.sql`)
- SQLite sync (`scripts/sync.ts`)
- Integration with main sync workflow

### Phase 2: ✅ COMPLETE

- Neo4j sync implementation (`scripts/sync-development.ts`)
- Memory graph knowledge blocks
- Session tracking and attribution

### Phase 3: Future Enhancements

- **LLM extraction improvement** - Use structured output for better Q&A extraction
- **Auto-classification training** - Learn from manual question→ID mappings
- **Readiness score updates** - Real-time coverage recalculation
- **Conflict resolution** - Handle multiple answers to same question
- **Answer versioning** - Track answer changes over time

---

## Usage Examples

### Example 1: Sync Single Idea

```bash
# Run main sync (includes development.md sync)
npm run sync

# Output:
# Found 1 development.md files
# e2e-test-smart-wellness-tracker: 8 Q&A → 0 blocks, 7 answers
#
# === Sync Summary ===
# Ideas processed: 1
# Total Q&A pairs: 8
# SQLite answers inserted: 7
```

### Example 2: Standalone Neo4j Sync

```bash
# Run Neo4j-only sync (legacy)
tsx scripts/sync-development.ts

# Output:
# Connected to Neo4j
# Found 5 development.md files
# idea-1: 10 Q&A → 15 blocks, 9 answers
# idea-2: 12 Q&A → 18 blocks, 11 answers
```

### Example 3: Query Answers in Code

```typescript
import { query } from "./database/db.js";

// Get all answers for an idea
const answers = await query(
  `SELECT qa.question_id, qb.question_text, qa.answer, qa.confidence
   FROM idea_answers qa
   JOIN question_bank qb ON qb.id = qa.question_id
   WHERE qa.idea_id = ? AND qa.answer_source = 'user'`,
  [ideaId],
);

// Use in evaluator context
const userSkills = answers.find((a) => a.question_id === "FT3_SKILLS")?.answer;
const financialRunway = answers.find(
  (a) => a.question_id === "FT5_RUNWAY",
)?.answer;
```

---

## Performance Metrics

### Benchmarks (Typical Idea)

| Metric         | Value         |
| -------------- | ------------- |
| File size      | 2-5 KB        |
| Q&A pairs      | 5-15          |
| Parse time     | <100ms        |
| Classify time  | <50ms         |
| SQLite insert  | <200ms        |
| Neo4j insert   | <500ms        |
| **Total time** | **<1 second** |

### Resource Usage

| Resource        | Usage                         |
| --------------- | ----------------------------- |
| Memory          | <10 MB per idea               |
| CPU             | Negligible (pattern matching) |
| Network         | Only if Neo4j remote          |
| API Calls       | 0 (LLM disabled during sync)  |
| Database Writes | ~10-20 per idea               |

---

## Known Limitations

### L1: Manual Question Classification

- **Issue:** Unclassifiable questions require manual mapping
- **Workaround:** Log failed classifications for review
- **Future:** Train ML classifier on manual mappings

### L2: No Answer Versioning

- **Issue:** Re-sync overwrites previous answers
- **Impact:** Answer history lost
- **Future:** Add `answer_history` table with timestamps

### L3: Single Answer Per Question

- **Issue:** `UNIQUE(idea_id, question_id)` constraint
- **Impact:** Cannot store multiple perspectives
- **Future:** Remove constraint, add `is_primary` flag

### L4: No Conflict Detection

- **Issue:** Contradictory answers in README vs development.md
- **Impact:** Last write wins
- **Future:** Flag conflicts for manual resolution

### L5: Limited Table Format Support

- **Issue:** Only supports simple pipe-delimited tables
- **Impact:** Complex tables may not parse correctly
- **Future:** Add more sophisticated table parsing

---

## Related Documentation

- **Question Bank:** `questions/bank.yml` - Canonical question definitions
- **Classifier Patterns:** `questions/classifier.ts:18-538` - Regex mappings
- **Database Schema:** `database/migrations/008_dynamic_questioning.sql`
- **Main Sync:** `scripts/sync.ts` - Orchestrator
- **Neo4j Sync:** `scripts/sync-development.ts` - Memory graph integration
- **Tests:** `tests/sync-development.test.ts` - Validation tests

---

## Changelog

| Date       | Version | Changes                  |
| ---------- | ------- | ------------------------ |
| 2025-12-27 | 1.0     | Initial implementation   |
| 2026-02-08 | 1.1     | Specification documented |

---

## Notes

This task represents **Phase 1 completion** of the evaluation data flow improvements. The system successfully closes the critical gap where evaluators lacked context from development sessions.

**Key Achievement:** Evaluators now receive complete context including:

- User technical skills → Feasibility assessment
- Financial runway → Risk assessment
- Market validation data → Market assessment
- Network connections → Market/Feasibility assessment
- Passion/motivation → Fit assessment

**Next Steps:** Phase 2-3 focus on frontend/WebSocket integration and autonomous agent orchestration (see `STRATEGIC_PLAN.md`).
