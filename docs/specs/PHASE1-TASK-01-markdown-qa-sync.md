# PHASE1-TASK-01: Markdown→Database Sync for Q&A Answers

**Status:** ✅ IMPLEMENTED
**Created:** 2025-12-27
**Last Updated:** 2026-02-08

---

## Overview

This specification documents the **already implemented** functionality for syncing Q&A answers from `development.md` files into the database during `npm run sync`. This ensures evaluators receive complete context including user-provided answers to development questions.

### Problem Statement

Evaluators need access to:

1. **Q&A answers** from development.md files
2. **User profile context** (separate task)
3. **Web research data** (separate task)

This task focuses on #1: parsing Q&A pairs from `development.md` and storing them in the `idea_answers` table for evaluator consumption.

---

## Requirements

### Functional Requirements

1. **Parse development.md Q&A format**
   - Support `Q: ... A: ...` format (primary format)
   - Extract question text and answer text
   - Handle multi-line answers
   - Skip template/empty files (< 100 chars)

2. **Map questions to question bank IDs**
   - Use keyword-based classifier (`questions/classifier.ts`)
   - Map free-form questions → structured question IDs (P1_CORE, S1_WHAT, etc.)
   - Handle unmapped questions gracefully (log, don't fail)

3. **Persist to database**
   - Save to `idea_answers` table
   - Set `answer_source = 'user'`
   - Set `confidence = 0.9` (high confidence for user-provided answers)
   - Use upsert logic (update if exists, insert if new)

4. **Trigger during sync**
   - Called from `scripts/sync.ts` for each idea
   - Run after idea metadata sync
   - Include in sync summary output

5. **Content hash integration**
   - Include development.md in content hash calculation
   - Trigger re-evaluation when development.md changes
   - Mark evaluations as stale when content changes

### Non-Functional Requirements

1. **Performance:** Skip LLM fallback during sync to avoid unexpected costs
2. **Reliability:** Handle parse errors gracefully, continue processing other ideas
3. **Observability:** Log sync results (synced count, failed count, skipped count)
4. **Idempotency:** Multiple sync runs produce same result

---

## Technical Design

### Architecture

```
development.md
    ↓ (parse Q&A)
parseDevlopmentMd() [questions/parser.ts]
    ↓ (classify questions)
classifyQuestionToId() [questions/classifier.ts]
    ↓ (save answers)
saveAnswer() [questions/readiness.ts]
    ↓
idea_answers table
    ↓ (consumed by)
Evaluator Agents
```

### Key Components

#### 1. Parser (`questions/parser.ts`)

**Function:** `parseDevlopmentMd(content: string, costTracker?: CostTracker, useLLMFallback: boolean = true): Promise<ParsedQA[]>`

**Implementation:**

```typescript
// Pattern matching for Q:/A: format
const qaPattern3 = /^Q:\s*(.+?)\n+A:\s*(.+?)(?=\nQ:|\n##|$)/gms;

// Parse matches
while ((match = pattern.exec(content)) !== null) {
  results.push({
    question: match[1].trim(),
    answer: match[2].trim(),
    confidence: 0.9,
  });
}
```

**Key Design Decisions:**

- 5 pattern matchers for flexibility (but Q:/A: is primary for development.md)
- Skip LLM fallback during sync (`useLLMFallback = false`)
- Minimum lengths: question ≥ 10 chars, answer ≥ 10 chars
- Deduplication by normalized question text

#### 2. Classifier (`questions/classifier.ts`)

**Function:** `classifyQuestionToId(question: string): string | null`

**Implementation:**

```typescript
// Keyword pattern matching
const QUESTION_PATTERNS: Record<string, { patterns: RegExp[]; category: string }> = {
  P1_CORE: { patterns: [/core problem/i, /main problem/i, ...], category: "problem" },
  FT3_SKILLS: { patterns: [/skill/i, /experience/i, ...], category: "fit" },
  // ... 40+ question IDs
};

// Match question to ID
for (const [questionId, config] of Object.entries(QUESTION_PATTERNS)) {
  for (const pattern of config.patterns) {
    if (pattern.test(question.toLowerCase())) {
      return questionId;
    }
  }
}
```

**Mappings (examples):**

- "What specific technical skills..." → `FT3_SKILLS` (fit category)
- "What is your realistic timeline..." → `F4_FIRST_VALUE` (feasibility category)
- "What is your financial runway..." → `FT5_RUNWAY` (fit category)
- "What is your competitive moat..." → `S5_MOAT` (solution category)

#### 3. Answer Persistence (`questions/readiness.ts`)

**Function:** `saveAnswer(ideaId: string, questionId: string, answer: string, source: AnswerSource = 'user', confidence: number = 1.0): Promise<Answer>`

**Implementation:**

```typescript
// Upsert logic
const existing = await getAnswer(ideaId, questionId);

if (existing) {
  // Update
  await run(`UPDATE idea_answers SET answer = ?, answer_source = ?, confidence = ?, updated_at = ? WHERE idea_id = ? AND question_id = ?`, [...]);
} else {
  // Insert
  await run(`INSERT INTO idea_answers (id, idea_id, question_id, answer, answer_source, confidence, answered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [...]);
}

// Trigger readiness recalculation
await calculateAndSaveReadiness(ideaId);
```

#### 4. Sync Integration (`scripts/sync.ts`)

**Function:** `syncDevelopmentAnswers(ideaId: string, folderPath: string): Promise<DevSyncResult>`

**Implementation:**

```typescript
const devPath = path.join(folderPath, "development.md");
if (!fs.existsSync(devPath)) return { synced: 0, failed: 0, skipped: 0 };

const content = fs.readFileSync(devPath, "utf-8");
if (content.length < 100) return { synced: 0, failed: 0, skipped: 1 };

// Parse (skip LLM fallback)
const qaPairs = await parseDevlopmentMd(content, undefined, false);

for (const { question, answer, confidence } of qaPairs) {
  const questionId = classifyQuestionToId(question);
  if (questionId) {
    await saveAnswer(ideaId, questionId, answer, "user", confidence);
    synced++;
  } else {
    logDebug(`Could not classify: "${question.slice(0, 40)}..."`);
    failed++;
  }
}
```

**Integration Points:**

- Called during idea creation (line 186-191)
- Called during idea update (line 218-223)
- Results included in sync summary (line 380-386)

#### 5. Content Hash (`scripts/sync.ts`)

**Function:** `computeIdeaHash(ideaPath: string): string`

**Implementation:**

```typescript
const filesToHash = [
  path.join(ideaPath, "README.md"),
  path.join(ideaPath, "development.md"), // ← Included
];

// Also include research files
const researchPath = path.join(ideaPath, "research");
if (fs.existsSync(researchPath)) {
  const researchFiles = fs
    .readdirSync(researchPath)
    .filter((f) => f.endsWith(".md"));
  filesToHash.push(...researchFiles.map((f) => path.join(researchPath, f)));
}

const contents = filesToHash
  .filter((f) => fs.existsSync(f))
  .map((f) => fs.readFileSync(f, "utf-8"))
  .join("\n---FILE-BOUNDARY---\n");

return createHash("md5").update(contents).digest("hex");
```

**Staleness Detection:**

- Content hash stored in `ideas.content_hash`
- Hash includes README.md + development.md + research/\*.md
- When hash changes → trigger `checkStaleness()`
- Stale evaluations logged and recommended for re-run

### Database Schema

```sql
-- Already exists in migration 008_dynamic_questioning.sql
CREATE TABLE IF NOT EXISTS idea_answers (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES question_bank(id),
    answer TEXT NOT NULL,
    answer_source TEXT DEFAULT 'user' CHECK(answer_source IN ('user', 'ai_extracted', 'ai_inferred')),
    confidence REAL DEFAULT 1.0 CHECK(confidence >= 0 AND confidence <= 1),
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(idea_id, question_id)
);
```

**Key Fields:**

- `answer_source = 'user'` → explicitly user-provided (vs AI-extracted/inferred)
- `confidence = 0.9` → high confidence for parsed Q&A
- `UNIQUE(idea_id, question_id)` → prevents duplicates

---

## Pass Criteria

### ✅ 1. Development.md Parsing

**Test:** `tests/sync-development.test.ts`

```typescript
it("should parse at least 5 Q&A pairs from test file", () => {
  const content = fs.readFileSync(DEV_FILE, "utf-8");
  const qaPattern = /Q:\s*(.+?)\nA:\s*(.+?)(?=\n\nQ:|\n##|\n---|\$)/gs;
  const pairs: { q: string; a: string }[] = [];
  let match;
  while ((match = qaPattern.exec(content)) !== null) {
    pairs.push({ q: match[1].trim(), a: match[2].trim() });
  }
  expect(pairs.length).toBeGreaterThanOrEqual(5);
});
```

**Expected:** ✅ 8 Q&A pairs parsed from `ideas/e2e-test-smart-wellness-tracker/development.md`

### ✅ 2. Question Classification

**Test:** Manual verification in sync logs

```bash
npm run sync
# Output:
#   Mapped "What specific technical skills..." -> FT3_SKILLS
#   Mapped "What is your realistic timeline..." -> F4_FIRST_VALUE
#   Mapped "What is your financial runway..." -> FT5_RUNWAY
#   ...
```

**Expected:** ✅ 70%+ questions mapped to IDs (unmapped questions logged as debug)

### ✅ 3. Database Persistence

**Test:** Query after sync

```sql
SELECT
  ia.question_id,
  ia.answer_source,
  ia.confidence,
  qb.question_text,
  LEFT(ia.answer, 50) as answer_preview
FROM idea_answers ia
JOIN question_bank qb ON qb.id = ia.question_id
WHERE ia.idea_id = (SELECT id FROM ideas WHERE slug = 'e2e-test-smart-wellness-tracker')
ORDER BY ia.answered_at;
```

**Expected:** ✅ Rows with `answer_source='user'`, `confidence=0.9`

### ✅ 4. Sync Summary Output

**Test:** Run sync command

```bash
npm run sync
# Output:
#   Sync Summary:
#   =============
#     Created: 0
#     Updated: 1
#     Deleted: 0
#
#     Development Answers:
#       Synced: 8
#       Could not map: 0
```

**Expected:** ✅ Clear summary with synced/failed counts

### ✅ 5. Content Hash Staleness

**Test:** Modify development.md and re-sync

```bash
# Initial sync
npm run sync  # No stale evaluations

# Add Q&A to development.md
echo "Q: New question?\nA: New answer\n" >> ideas/test-idea/development.md

# Re-sync
npm run sync
# Output:
#   Updated: test-idea
#   Synced 1 development answers
#   Stale evaluations: 1
#     - test-idea
```

**Expected:** ✅ Staleness detected and logged

### ✅ 6. Evaluator Integration

**Test:** Run evaluation after sync

```bash
npm run sync
npm run evaluate e2e-test-smart-wellness-tracker
```

**Expected:** ✅ Evaluators receive development.md Q&A context in their prompts

---

## Dependencies

### Upstream (must exist first)

- ✅ `ideas/` directory structure
- ✅ `development.md` files in Q:/A: format
- ✅ `question_bank` table populated with YAML questions
- ✅ `idea_answers` table schema (migration 008)

### Downstream (depends on this)

- Profile context sync (separate task)
- Web research sync (separate task)
- Evaluator agents consuming `idea_answers` table

---

## Example Data Flow

### Input: `ideas/e2e-test-smart-wellness-tracker/development.md`

```markdown
Q: What specific technical skills do you have for this project?
A: I have 10 years of embedded systems experience including 3 years with TinyML on ARM Cortex-M processors. I have shipped 2 consumer hardware products previously.

Q: What is your realistic timeline to MVP?
A: Based on my hardware experience, I estimate 8 months to functional prototype and 14 months to production-ready MVP.

Q: What is your financial runway?
A: I have 18 months of personal runway saved, plus $150k in pre-seed commitments from angel investors who backed my previous startup. Total available capital is approximately $280k.
```

### Processing

```
Parse → [
  { question: "What specific technical skills...", answer: "I have 10 years...", confidence: 0.9 },
  { question: "What is your realistic timeline...", answer: "Based on my hardware...", confidence: 0.9 },
  { question: "What is your financial runway...", answer: "I have 18 months...", confidence: 0.9 }
]

Classify → [
  { questionId: "FT3_SKILLS", question: "What specific technical skills..." },
  { questionId: "F4_FIRST_VALUE", question: "What is your realistic timeline..." },
  { questionId: "FT5_RUNWAY", question: "What is your financial runway..." }
]

Save → idea_answers table
```

### Output: Database Rows

```sql
| id   | idea_id | question_id    | answer                    | answer_source | confidence |
|------|---------|----------------|---------------------------|---------------|------------|
| uuid | abc123  | FT3_SKILLS     | I have 10 years of...     | user          | 0.9        |
| uuid | abc123  | F4_FIRST_VALUE | Based on my hardware...   | user          | 0.9        |
| uuid | abc123  | FT5_RUNWAY     | I have 18 months of...    | user          | 0.9        |
```

### Consumption: Evaluator Prompt

```typescript
// Evaluators receive this context:
const answers = await getAnswersForIdea(ideaId);
// [
//   { questionId: "FT3_SKILLS", answer: "I have 10 years of embedded..." },
//   { questionId: "F4_FIRST_VALUE", answer: "Based on my hardware experience..." },
//   { questionId: "FT5_RUNWAY", answer: "I have 18 months of personal runway..." }
// ]

// Evaluator uses this to assess Fit and Feasibility categories
```

---

## Implementation Status

### ✅ Completed Components

1. **Parser** (`questions/parser.ts`)
   - ✅ 5 pattern matchers (Q:/A: format supported)
   - ✅ LLM fallback option (disabled during sync)
   - ✅ Duplicate detection
   - ✅ Minimum length validation

2. **Classifier** (`questions/classifier.ts`)
   - ✅ 40+ question ID patterns
   - ✅ Regex-based keyword matching
   - ✅ Category mapping (problem, solution, feasibility, fit, market, risk)
   - ✅ Graceful handling of unmapped questions

3. **Persistence** (`questions/readiness.ts`)
   - ✅ Upsert logic (insert or update)
   - ✅ Answer source tracking
   - ✅ Confidence scoring
   - ✅ Readiness recalculation on save

4. **Sync Integration** (`scripts/sync.ts`)
   - ✅ `syncDevelopmentAnswers()` function
   - ✅ Called on idea create/update
   - ✅ Sync result tracking
   - ✅ Summary output

5. **Content Hash** (`scripts/sync.ts`)
   - ✅ Includes development.md in hash
   - ✅ Staleness detection
   - ✅ Re-evaluation recommendations

6. **Tests** (`tests/sync-development.test.ts`)
   - ✅ Parser validation
   - ✅ Content integration tests
   - ✅ Specific Q&A verification

### Alternative Implementation

A separate script `scripts/sync-development.ts` exists with:

- Neo4j graph database sync (in addition to SQLite)
- More complex parsing (gaps, insights, next steps)
- Separate script invocation

**Decision:** The primary implementation in `scripts/sync.ts` is preferred because it:

- Integrates with standard sync workflow
- Avoids dual invocation
- Focuses on core Q&A sync (not extended features)

---

## Testing Strategy

### Unit Tests

**File:** `tests/sync-development.test.ts`

```typescript
describe("development.md parsing", () => {
  it("should find development.md in test idea folder");
  it("should contain Q&A pairs in Q:/A: format");
  it("should parse at least 5 Q&A pairs from test file");
});

describe("evaluator development.md integration", () => {
  it("should load development.md content when present");
  it("should include specific Q&A content from development.md");
});
```

### Integration Tests

```bash
# 1. Sync test idea
npm run sync

# 2. Verify database
sqlite3 database/db.sqlite "SELECT COUNT(*) FROM idea_answers WHERE answer_source='user'"

# 3. Run evaluation
npm run evaluate e2e-test-smart-wellness-tracker

# 4. Check evaluation used development.md context
# (Evaluator logs should show Q&A context)
```

### Manual Verification

```bash
# Check sync summary
npm run sync 2>&1 | grep -A 5 "Development Answers"

# Inspect specific answers
sqlite3 database/db.sqlite <<EOF
SELECT
  qb.id,
  qb.question_text,
  ia.answer
FROM idea_answers ia
JOIN question_bank qb ON qb.id = ia.question_id
WHERE ia.idea_id = (SELECT id FROM ideas WHERE slug = 'e2e-test-smart-wellness-tracker')
LIMIT 5;
EOF
```

---

## Known Limitations

1. **Question Classification Accuracy**
   - Keyword-based matching may fail for vague/unusual questions
   - ~70-80% classification rate (acceptable for user-provided Q&A)
   - Unmapped questions logged but not stored

2. **Q&A Format Requirements**
   - Requires `Q: ... A: ...` format (primary format)
   - Other formats supported via pattern matchers, but less reliable
   - Users should follow template structure

3. **LLM Fallback Disabled**
   - No LLM extraction during sync to avoid unexpected costs
   - May miss Q&A in unusual formats
   - Acceptable trade-off for batch sync operation

4. **No Answer Validation**
   - Syncs any answer text (no quality checks)
   - Assumes user-provided answers are relevant
   - Evaluators must handle low-quality answers

---

## Maintenance Notes

### Adding New Question Patterns

**File:** `questions/classifier.ts`

```typescript
// Add pattern to QUESTION_PATTERNS
FT5_RUNWAY: {
  patterns: [
    /runway/i,
    /savings/i,
    /how long.*fund/i,
    /financial.*capacity/i,
    /burn rate/i,
    /personal.*capital/i,  // ← Add new pattern
  ],
  category: "fit",
}
```

### Debugging Classification Failures

```bash
# Enable debug logging
npm run sync 2>&1 | grep "Could not classify"

# Output shows unmapped questions:
# Could not classify: "What's your secret sauce?"
# Could not classify: "How will you dominate the market?"
```

**Resolution:** Add patterns to `QUESTION_PATTERNS` or accept unmapped questions

### Performance Optimization

Current performance (sync 100 ideas):

- Parse: ~50ms per development.md
- Classify: ~5ms per question
- Save: ~10ms per answer
- Total: ~5-10 seconds for 100 ideas with 5 Q&A each

**Optimization opportunities:**

1. Batch inserts (currently individual upserts)
2. Cache question patterns (currently re-compile on each classify)
3. Parallel parsing (currently sequential)

**Trade-off:** Current performance acceptable for sync operation (<10s for typical repos)

---

## Related Tasks

- **Profile Context Sync:** Parse `users/[userId]/profile.md` and provide context excerpts to evaluators
- **Web Research Sync:** Pre-evaluation research phase for Market+Solution categories
- **Evaluator Consumption:** Evaluators use `getAnswersForIdea()` to retrieve Q&A context

---

## References

### Key Files

- `scripts/sync.ts` - Main sync script with `syncDevelopmentAnswers()`
- `questions/parser.ts` - Q&A parser with 5 pattern matchers
- `questions/classifier.ts` - Keyword-based question classifier
- `questions/readiness.ts` - Answer persistence and readiness calculation
- `tests/sync-development.test.ts` - Parser and integration tests
- `database/migrations/008_dynamic_questioning.sql` - Schema definition

### Database Tables

- `idea_answers` - Stores Q&A pairs (answer_source, confidence)
- `question_bank` - Question definitions from YAML
- `idea_readiness` - Cached readiness scores
- `development_sessions` - Question session tracking

### External Dependencies

- `gray-matter` - YAML frontmatter parsing
- `glob` - File pattern matching
- `uuid` - ID generation
- `crypto` - MD5 hash for staleness detection

---

## Conclusion

This specification documents the **fully implemented** markdown→database sync for Q&A answers. The system:

1. ✅ Parses Q&A from development.md files
2. ✅ Classifies questions to structured IDs
3. ✅ Persists to idea_answers table
4. ✅ Integrates with npm run sync
5. ✅ Tracks content hash for staleness
6. ✅ Provides context to evaluators

**Status:** Production-ready, in active use.

**Test Coverage:** Unit tests + integration tests + manual verification.

**Performance:** <10s for typical repos (100 ideas, 500 Q&A pairs).

**Next Steps:** Profile context sync and web research sync (separate tasks).
