# SIA Build Tasks

## Summary

| Phase     | Tasks  | Description                         |
| --------- | ------ | ----------------------------------- |
| database  | 1      | Migration for knowledge base tables |
| types     | 1      | TypeScript interfaces               |
| services  | 7      | Core SIA components                 |
| api       | 1      | API routes                          |
| tests     | 1      | Unit tests                          |
| **Total** | **11** |                                     |

---

## T-001: Database Migration

```yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/030_sia.sql"
status: pending

requirements:
  - Create knowledge_entries table with type, content, confidence
  - Create claude_md_proposals table for CLAUDE.md updates
  - Create gotcha_applications table for tracking usage
  - Add indexes for common queries
  - Use TEXT for dates, INTEGER for booleans

gotchas:
  - Use TEXT not DATETIME for date columns
  - Include IF NOT EXISTS for idempotency
  - Add CHECK constraints for enum columns

validation:
  command: "sqlite3 :memory: < database/migrations/030_sia.sql"
  expected: "exit code 0"

code_template: |
  -- SIA Knowledge Base tables
  CREATE TABLE IF NOT EXISTS knowledge_entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('gotcha', 'pattern', 'decision')),
      content TEXT NOT NULL,
      file_patterns_json TEXT DEFAULT '[]',
      action_types_json TEXT DEFAULT '[]',
      confidence REAL DEFAULT 0.5,
      occurrences INTEGER DEFAULT 0,
      source_execution_id TEXT,
      source_task_id TEXT,
      source_agent_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
  );

depends_on: []
```

---

## T-002: TypeScript Types

```yaml
id: T-002
phase: types
action: CREATE
file: "types/sia.ts"
status: pending

requirements:
  - Define KnowledgeEntry interface
  - Define ClaudeMdProposal interface
  - Define GotchaApplication interface
  - Define ExecutionAnalysis interface
  - Define ExtractedGotcha and ExtractedPattern
  - Export all types

gotchas:
  - Use string for dates (ISO format)
  - Use string for IDs (UUIDs)

validation:
  command: "npx tsc --noEmit types/sia.ts"
  expected: "exit code 0"

code_template: |
  export type KnowledgeType = 'gotcha' | 'pattern' | 'decision';
  export type ProposalStatus = 'pending' | 'approved' | 'rejected';

  export interface KnowledgeEntry {
    id: string;
    type: KnowledgeType;
    content: string;
    filePatterns: string[];
    actionTypes: string[];
    confidence: number;
    occurrences: number;
    source: {
      executionId: string;
      taskId: string;
      agentType: string;
    };
    createdAt: string;
    updatedAt: string;
  }

depends_on: ["T-001"]
```

---

## T-003: Extraction Rules

```yaml
id: T-003
phase: services
action: CREATE
file: "agents/sia/extraction-rules.ts"
status: pending

requirements:
  - Define ExtractionRule interface
  - Create predefined rules for common errors
  - Include rules for SQLite, TypeScript, ES modules
  - Export EXTRACTION_RULES array
  - Include matching function

gotchas:
  - Use regex patterns that work across platforms
  - Include enough context in fix descriptions

validation:
  command: "npx tsc --noEmit agents/sia/extraction-rules.ts"
  expected: "exit code 0"

code_template: |
  export interface ExtractionRule {
    name: string;
    errorPattern: RegExp;
    filePattern: string;
    actionType?: string;
    fix: string;
  }

  export const EXTRACTION_RULES: ExtractionRule[] = [
    {
      name: 'sqlite-date-type',
      errorPattern: /datetime|timestamp|date/i,
      filePattern: '*.sql',
      fix: 'Use TEXT for dates in SQLite, not DATETIME',
    },
    // ... more rules
  ];

depends_on: ["T-002"]
```

---

## T-004: Gotcha Extractor

```yaml
id: T-004
phase: services
action: CREATE
file: "agents/sia/gotcha-extractor.ts"
status: pending

requirements:
  - Extract gotchas from failure information
  - Match errors against extraction rules
  - Infer file patterns from file paths
  - Infer action types from task actions
  - Generate human-readable descriptions

gotchas:
  - Handle malformed error messages gracefully
  - Normalize file paths before pattern matching

validation:
  command: "npx tsc --noEmit agents/sia/gotcha-extractor.ts"
  expected: "exit code 0"

code_template: |
  import { EXTRACTION_RULES, ExtractionRule } from './extraction-rules.js';
  import { ExtractedGotcha, FailureInfo } from '../../types/sia.js';

  export function extractGotchas(failures: FailureInfo[]): ExtractedGotcha[] {
    const gotchas: ExtractedGotcha[] = [];
    for (const failure of failures) {
      const matched = matchRule(failure.errorMessage);
      if (matched) {
        gotchas.push(createGotcha(failure, matched));
      }
    }
    return gotchas;
  }

  function matchRule(error: string): ExtractionRule | null {
    for (const rule of EXTRACTION_RULES) {
      if (rule.errorPattern.test(error)) {
        return rule;
      }
    }
    return null;
  }

depends_on: ["T-003"]
```

---

## T-005: Pattern Extractor

```yaml
id: T-005
phase: services
action: CREATE
file: "agents/sia/pattern-extractor.ts"
status: pending

requirements:
  - Extract reusable patterns from successful tasks
  - Identify code templates
  - Tag with file patterns and action types
  - Generate pattern descriptions

gotchas:
  - Only extract patterns from genuinely reusable code
  - Avoid extracting project-specific patterns

validation:
  command: "npx tsc --noEmit agents/sia/pattern-extractor.ts"
  expected: "exit code 0"

code_template: |
  import { ExtractedPattern, TaskResult } from '../../types/sia.js';

  export function extractPatterns(successes: TaskResult[]): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];
    for (const success of successes) {
      const pattern = identifyPattern(success);
      if (pattern) {
        patterns.push(pattern);
      }
    }
    return patterns;
  }

depends_on: ["T-002"]
```

---

## T-006: Duplicate Detector

```yaml
id: T-006
phase: services
action: CREATE
file: "agents/sia/duplicate-detector.ts"
status: pending

requirements:
  - Find duplicates in knowledge base
  - Calculate text similarity (simple word overlap)
  - Determine if entries should merge
  - Merge similar entries

gotchas:
  - Use case-insensitive comparison
  - Set reasonable similarity threshold (0.7)

validation:
  command: "npx tsc --noEmit agents/sia/duplicate-detector.ts"
  expected: "exit code 0"

code_template: |
  import { KnowledgeEntry } from '../../types/sia.js';
  import { queryKnowledge } from './db.js';

  const SIMILARITY_THRESHOLD = 0.7;

  export async function findDuplicate(
    content: string,
    type: string
  ): Promise<KnowledgeEntry | null> {
    const existing = await queryKnowledge({ type });
    for (const entry of existing) {
      if (calculateSimilarity(content, entry.content) >= SIMILARITY_THRESHOLD) {
        return entry;
      }
    }
    return null;
  }

  export function calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.length / union.size;
  }

depends_on: ["T-002"]
```

---

## T-007: Confidence Tracker

```yaml
id: T-007
phase: services
action: CREATE
file: "agents/sia/confidence-tracker.ts"
status: pending

requirements:
  - Record when gotcha prevents an error
  - Update confidence scores
  - Apply monthly decay
  - Get promotion/demotion candidates
  - Define confidence config constants

gotchas:
  - Confidence should never exceed 0.95
  - Apply decay only to entries older than 30 days

validation:
  command: "npx tsc --noEmit agents/sia/confidence-tracker.ts"
  expected: "exit code 0"

code_template: |
  import { v4 as uuid } from 'uuid';
  import { getDb } from '../../database/db.js';

  export const CONFIDENCE_CONFIG = {
    initial: 0.5,
    preventionBoost: 0.15,
    maxConfidence: 0.95,
    monthlyDecay: 0.05,
    promotionThreshold: 0.8,
    demotionThreshold: 0.3,
  };

  export async function recordPrevention(
    entryId: string,
    executionId: string,
    taskId: string
  ): Promise<void> {
    const db = await getDb();
    db.run(`
      INSERT INTO gotcha_applications (id, knowledge_entry_id, execution_id, task_id, prevented_error)
      VALUES (?, ?, ?, ?, 1)
    `, [uuid(), entryId, executionId, taskId]);
    await updateConfidence(entryId);
  }

depends_on: ["T-002"]
```

---

## T-008: Knowledge Writer

```yaml
id: T-008
phase: services
action: CREATE
file: "agents/sia/knowledge-writer.ts"
status: pending

requirements:
  - Write gotchas to knowledge base
  - Write patterns to knowledge base
  - Check for duplicates before writing
  - Merge if duplicate found
  - Increment occurrences on merge

gotchas:
  - Always check for duplicates first
  - Use transactions for consistency

validation:
  command: "npx tsc --noEmit agents/sia/knowledge-writer.ts"
  expected: "exit code 0"

code_template: |
  import { v4 as uuid } from 'uuid';
  import { getDb } from '../../database/db.js';
  import { KnowledgeEntry, ExtractedGotcha, ExtractedPattern } from '../../types/sia.js';
  import { findDuplicate } from './duplicate-detector.js';
  import { CONFIDENCE_CONFIG } from './confidence-tracker.js';

  export async function writeGotcha(gotcha: ExtractedGotcha): Promise<KnowledgeEntry> {
    const duplicate = await findDuplicate(gotcha.fix, 'gotcha');
    if (duplicate) {
      await incrementOccurrences(duplicate.id);
      return duplicate;
    }
    return createEntry('gotcha', gotcha.fix, gotcha);
  }

depends_on: ["T-006", "T-007"]
```

---

## T-009: Database Operations

```yaml
id: T-009
phase: services
action: CREATE
file: "agents/sia/db.ts"
status: pending

requirements:
  - Save knowledge entries
  - Query knowledge by type, file pattern, confidence
  - Get proposals by status
  - Update proposal status
  - Use async/await with getDb()

gotchas:
  - getDb() returns a Promise, must await
  - Use sql.js API (db.run, db.prepare().bind().step())
  - JSON columns need parse/stringify

validation:
  command: "npx tsc --noEmit agents/sia/db.ts"
  expected: "exit code 0"

code_template: |
  import { getDb } from '../../database/db.js';
  import { KnowledgeEntry, ClaudeMdProposal, KnowledgeType } from '../../types/sia.js';

  export async function saveKnowledgeEntry(entry: KnowledgeEntry): Promise<void> {
    const db = await getDb();
    db.run(`
      INSERT INTO knowledge_entries (
        id, type, content, file_patterns_json, action_types_json,
        confidence, occurrences, source_execution_id, source_task_id, source_agent_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entry.id,
      entry.type,
      entry.content,
      JSON.stringify(entry.filePatterns),
      JSON.stringify(entry.actionTypes),
      entry.confidence,
      entry.occurrences,
      entry.source.executionId,
      entry.source.taskId,
      entry.source.agentType,
    ]);
  }

depends_on: ["T-001", "T-002"]
```

---

## T-010: API Routes

```yaml
id: T-010
phase: api
action: CREATE
file: "server/routes/sia.ts"
status: pending

requirements:
  - POST /api/sia/analyze endpoint
  - GET /api/sia/knowledge with filters
  - GET /api/sia/gotchas with filters
  - GET /api/sia/patterns with filters
  - GET /api/sia/proposals
  - POST /api/sia/proposals/:id/approve
  - POST /api/sia/proposals/:id/reject
  - Use async/await, return Promise<void>

gotchas:
  - Express handlers returning early need explicit return
  - Use Promise<void> return type annotation
  - Parse query params as strings, convert as needed

validation:
  command: "npx tsc --noEmit server/routes/sia.ts"
  expected: "exit code 0"

code_template: |
  import { Router, Request, Response } from 'express';
  import { queryKnowledge, getProposals, updateProposalStatus } from '../../agents/sia/db.js';

  const router = Router();

  router.get('/knowledge', async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, filePattern, minConfidence, limit, offset } = req.query;
      const entries = await queryKnowledge({
        type: type as string,
        filePattern: filePattern as string,
        minConfidence: minConfidence ? parseFloat(minConfidence as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      res.json({ entries, total: entries.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  export default router;

depends_on: ["T-009"]
```

---

## T-011: Unit Tests

```yaml
id: T-011
phase: tests
action: CREATE
file: "tests/sia.test.ts"
status: pending

requirements:
  - Test extraction rules matching
  - Test duplicate detection similarity
  - Test confidence calculations
  - Test knowledge query filters

gotchas:
  - Mock database for unit tests
  - Test edge cases (empty arrays, null values)

validation:
  command: "npm test -- tests/sia.test.ts"
  expected: "All tests pass"

code_template: |
  import { describe, it, expect } from 'vitest';
  import { EXTRACTION_RULES } from '../agents/sia/extraction-rules';
  import { calculateSimilarity } from '../agents/sia/duplicate-detector';
  import { CONFIDENCE_CONFIG } from '../agents/sia/confidence-tracker';

  describe('SIA', () => {
    describe('Extraction Rules', () => {
      it('should have predefined rules', () => {
        expect(EXTRACTION_RULES.length).toBeGreaterThan(0);
      });

      it('should match sqlite date errors', () => {
        const rule = EXTRACTION_RULES.find(r => r.name === 'sqlite-date-type');
        expect(rule).toBeDefined();
        expect(rule?.errorPattern.test('DATETIME not supported')).toBe(true);
      });
    });

    describe('Duplicate Detector', () => {
      it('should calculate similarity correctly', () => {
        expect(calculateSimilarity('hello world', 'hello world')).toBe(1);
        expect(calculateSimilarity('hello world', 'goodbye world')).toBeCloseTo(0.33, 1);
        expect(calculateSimilarity('a b c', 'x y z')).toBe(0);
      });
    });

    describe('Confidence Config', () => {
      it('should have valid thresholds', () => {
        expect(CONFIDENCE_CONFIG.promotionThreshold).toBeGreaterThan(CONFIDENCE_CONFIG.demotionThreshold);
        expect(CONFIDENCE_CONFIG.maxConfidence).toBeLessThanOrEqual(1);
      });
    });
  });

depends_on: ["T-003", "T-006", "T-007"]
```

---

## Execution Order

```
T-001 (database) ─┬─▶ T-002 (types) ─┬─▶ T-003 (rules) ─▶ T-004 (gotcha extractor)
                  │                   │
                  │                   ├─▶ T-005 (pattern extractor)
                  │                   │
                  │                   ├─▶ T-006 (duplicate detector) ─┬─▶ T-008 (writer)
                  │                   │                                │
                  │                   └─▶ T-007 (confidence) ──────────┘
                  │
                  └─▶ T-009 (db) ─▶ T-010 (routes)

T-003, T-006, T-007 ─▶ T-011 (tests)
```
