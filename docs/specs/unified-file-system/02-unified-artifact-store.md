# Developer Spec 02: Unified Artifact Store

**Feature**: Unified File System - Phase 2
**Version**: 1.0
**Ralph Loop Compatible**: Yes
**Depends On**: Spec 01 (TEST-FS-001 through TEST-FS-015)

---

## Overview

Replace the database-centric artifact storage with a filesystem-based approach where artifacts ARE files. The database becomes a lightweight index, and `.metadata/index.json` serves as a regenerable cache for fast UI loading.

---

## Test State Schema

Add to `tests/e2e/test-state.json`:

```json
{
  "tests": [
    {
      "id": "TEST-AS-001",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-015"
    },
    {
      "id": "TEST-AS-002",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-001"
    },
    {
      "id": "TEST-AS-003",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-002"
    },
    {
      "id": "TEST-AS-004",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-003"
    },
    {
      "id": "TEST-AS-005",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-004"
    },
    {
      "id": "TEST-AS-006",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-005"
    },
    {
      "id": "TEST-AS-007",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-006"
    },
    {
      "id": "TEST-AS-008",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-007"
    },
    {
      "id": "TEST-AS-009",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-008"
    },
    {
      "id": "TEST-AS-010",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-009"
    },
    {
      "id": "TEST-AS-011",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-010"
    },
    {
      "id": "TEST-AS-012",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-011"
    },
    {
      "id": "TEST-AS-013",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-012"
    },
    {
      "id": "TEST-AS-014",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-013"
    },
    {
      "id": "TEST-AS-015",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-014"
    }
  ]
}
```

---

## Task 1: Core Interface & Types

### TEST-AS-001: Define UnifiedArtifact Interface

**Preconditions:**

- Spec 01 tests passed (TEST-FS-015)
- TypeScript configured

**Implementation Steps:**

1. Create file: `agents/ideation/unified-artifact-store.ts`
2. Define `UnifiedArtifact` interface
3. Define `ArtifactType` union type
4. Define `ArtifactMetadata` interface for frontmatter
5. Export all types

**Pass Criteria:**

- [ ] File `agents/ideation/unified-artifact-store.ts` exists
- [ ] `UnifiedArtifact` interface exported with fields:
  - `id: string`
  - `userSlug: string`
  - `ideaSlug: string`
  - `sessionId?: string`
  - `type: ArtifactType`
  - `title: string`
  - `filePath: string`
  - `tokenCount: number`
  - `status: 'ready' | 'updating' | 'error'`
  - `createdAt: string`
  - `updatedAt: string`
- [ ] `ArtifactType` exported: `'research' | 'mermaid' | 'markdown' | 'code' | 'analysis' | 'comparison' | 'idea-summary' | 'template'`
- [ ] `ArtifactMetadata` interface exported for YAML frontmatter fields
- [ ] File compiles without TypeScript errors: `npx tsc --noEmit agents/ideation/unified-artifact-store.ts`

**Fail Criteria:**

- TypeScript compilation errors
- Missing required fields
- Wrong type definitions

**Verification Command:**

```bash
npx tsc --noEmit agents/ideation/unified-artifact-store.ts && echo "PASS"
```

---

### TEST-AS-002: Implement Frontmatter Parser

**Preconditions:**

- TEST-AS-001 passed

**Implementation Steps:**

1. Add function: `parseFrontmatter(content: string): { metadata: ArtifactMetadata; body: string }`
2. Handle YAML frontmatter delimited by `---`
3. Parse YAML to object
4. Return separated metadata and body content
5. Handle files without frontmatter gracefully

**Pass Criteria:**

- [ ] Function `parseFrontmatter` is exported
- [ ] Input with frontmatter returns parsed metadata:
  ```typescript
  const { metadata, body } = parseFrontmatter(`---
  id: abc123
  title: Test
  ---
  Body content`);
  assert(metadata.id === "abc123");
  assert(body === "Body content");
  ```
- [ ] Input without frontmatter returns empty metadata and full body
- [ ] Invalid YAML throws descriptive error
- [ ] Empty file returns empty metadata and empty body
- [ ] Handles multiline body content correctly

**Fail Criteria:**

- Throws on valid input
- Returns wrong metadata values
- Corrupts body content
- Crashes on edge cases

**Verification Code:**

```typescript
import { parseFrontmatter } from "./agents/ideation/unified-artifact-store";
const result = parseFrontmatter(`---
id: test-123
title: "My Title"
type: markdown
---
# Heading
Content here`);
assert(result.metadata.id === "test-123");
assert(result.body.startsWith("# Heading"));
```

---

### TEST-AS-003: Implement Frontmatter Generator

**Preconditions:**

- TEST-AS-002 passed

**Implementation Steps:**

1. Add function: `generateFrontmatter(metadata: ArtifactMetadata): string`
2. Convert metadata object to YAML string
3. Wrap with `---` delimiters
4. Handle special characters in values

**Pass Criteria:**

- [ ] Function `generateFrontmatter` is exported
- [ ] Output format:
  ```
  ---
  id: abc123
  title: "Test"
  type: markdown
  ---
  ```
- [ ] Handles strings with special characters (quotes, colons)
- [ ] Handles arrays and nested objects
- [ ] Empty metadata returns minimal valid frontmatter
- [ ] Round-trip: `parseFrontmatter(generateFrontmatter(meta) + body)` returns original meta

**Fail Criteria:**

- Invalid YAML output
- Special characters cause parse errors
- Missing delimiter

**Verification Code:**

```typescript
import {
  generateFrontmatter,
  parseFrontmatter,
} from "./agents/ideation/unified-artifact-store";
const meta = { id: "test", title: 'My "Quoted" Title', type: "markdown" };
const yaml = generateFrontmatter(meta);
const parsed = parseFrontmatter(yaml + "body");
assert(parsed.metadata.title === meta.title);
```

---

## Task 2: Token Management

### TEST-AS-004: Implement Token Counting

**Preconditions:**

- TEST-AS-003 passed

**Implementation Steps:**

1. Add function: `estimateTokens(content: string): number`
2. Use tiktoken or cl100k_base approximation
3. Add function: `checkTokenLimit(content: string): TokenCheckResult`
4. Return tokens count and whether it exceeds 15k limit

**Pass Criteria:**

- [ ] Function `estimateTokens` is exported
- [ ] Returns reasonable token count (within 10% of actual for standard text)
- [ ] Empty string returns 0
- [ ] `checkTokenLimit` returns `{ tokens: number, exceedsLimit: boolean, suggestedSplits?: string[] }`
- [ ] `exceedsLimit` is true when tokens > 15000
- [ ] `suggestedSplits` provided when exceeds limit (splits by heading)
- [ ] Handles markdown, code, and mixed content

**Fail Criteria:**

- Token count wildly inaccurate (>50% off)
- Crashes on large content
- Wrong exceedsLimit value

**Verification Code:**

```typescript
import {
  estimateTokens,
  checkTokenLimit,
} from "./agents/ideation/unified-artifact-store";
const shortText = "Hello world";
const longText = "x ".repeat(20000);
assert(estimateTokens(shortText) < 100);
assert(checkTokenLimit(shortText).exceedsLimit === false);
assert(checkTokenLimit(longText).exceedsLimit === true);
```

---

## Task 3: Core CRUD Operations

### TEST-AS-005: Implement saveArtifact

**Preconditions:**

- TEST-AS-004 passed
- Folder structure utilities from Spec 01 available

**Implementation Steps:**

1. Add function: `saveArtifact(userSlug: string, ideaSlug: string, artifact: CreateArtifactInput): Promise<UnifiedArtifact>`
2. Generate frontmatter with metadata
3. Write file to `users/[user]/ideas/[idea]/[filePath]`
4. Calculate token count
5. Update `.metadata/index.json` cache
6. Return created artifact

**Pass Criteria:**

- [ ] Function `saveArtifact` is exported
- [ ] Creates file at correct path
- [ ] File has valid frontmatter with: id, title, type, sessionId, createdAt, updatedAt
- [ ] Body content matches input
- [ ] `.metadata/index.json` updated with new artifact entry
- [ ] Returns `UnifiedArtifact` with all fields populated
- [ ] Handles nested paths (e.g., `research/market.md`)
- [ ] Creates parent directories if needed
- [ ] Idempotent: calling twice with same id updates existing file

**Fail Criteria:**

- File not created
- Wrong path
- Frontmatter invalid
- Cache not updated
- Error on nested paths

**Verification Code:**

```typescript
import { saveArtifact } from "./agents/ideation/unified-artifact-store";
import * as fs from "fs";

const artifact = await saveArtifact("test-user", "test-idea", {
  type: "markdown",
  title: "Test Doc",
  content: "# Test\nContent here",
  sessionId: "session-123",
});

assert(fs.existsSync(`users/test-user/ideas/test-idea/${artifact.filePath}`));
const content = fs.readFileSync(
  `users/test-user/ideas/test-idea/${artifact.filePath}`,
  "utf-8",
);
assert(content.includes("id: " + artifact.id));
assert(content.includes("# Test"));
```

---

### TEST-AS-006: Implement loadArtifact

**Preconditions:**

- TEST-AS-005 passed

**Implementation Steps:**

1. Add function: `loadArtifact(userSlug: string, ideaSlug: string, filePath: string): Promise<UnifiedArtifact | null>`
2. Read file from filesystem
3. Parse frontmatter
4. Calculate token count
5. Return populated artifact or null if not found

**Pass Criteria:**

- [ ] Function `loadArtifact` is exported
- [ ] Returns artifact with all metadata from frontmatter
- [ ] Returns artifact with body content
- [ ] Returns `null` for non-existent file (no throw)
- [ ] Handles files without frontmatter (generates default metadata)
- [ ] Token count calculated correctly
- [ ] File path normalized (handles leading slash, .md extension)

**Fail Criteria:**

- Throws on missing file
- Wrong metadata parsed
- Body content corrupted
- Token count wrong

**Verification Code:**

```typescript
import {
  saveArtifact,
  loadArtifact,
} from "./agents/ideation/unified-artifact-store";

await saveArtifact("test-user", "test-idea", {
  type: "markdown",
  title: "Load Test",
  content: "# Load Test\nBody",
  filePath: "load-test.md",
});

const loaded = await loadArtifact("test-user", "test-idea", "load-test.md");
assert(loaded !== null);
assert(loaded.title === "Load Test");
assert(loaded.tokenCount > 0);
```

---

### TEST-AS-007: Implement listArtifacts

**Preconditions:**

- TEST-AS-006 passed

**Implementation Steps:**

1. Add function: `listArtifacts(userSlug: string, ideaSlug: string): Promise<UnifiedArtifact[]>`
2. Check if `.metadata/index.json` exists and is valid
3. If valid, return from cache
4. If missing/invalid, call `rebuildCache` and return
5. Include all markdown files recursively

**Pass Criteria:**

- [ ] Function `listArtifacts` is exported
- [ ] Returns array of all artifacts in idea folder
- [ ] Uses cache when available and valid
- [ ] Rebuilds cache when missing
- [ ] Includes files in subdirectories (research/, planning/, etc.)
- [ ] Excludes files in `.metadata/` and `.versions/`
- [ ] Returns empty array for empty folder (no throw)
- [ ] Sorted by updatedAt descending (most recent first)

**Fail Criteria:**

- Throws on missing cache
- Missing files in subdirectories
- Includes metadata files
- Wrong sort order

**Verification Code:**

```typescript
import {
  saveArtifact,
  listArtifacts,
} from "./agents/ideation/unified-artifact-store";

await saveArtifact("test-user", "test-idea", {
  type: "markdown",
  title: "Doc 1",
  content: "a",
  filePath: "doc1.md",
});
await saveArtifact("test-user", "test-idea", {
  type: "markdown",
  title: "Doc 2",
  content: "b",
  filePath: "research/doc2.md",
});

const artifacts = await listArtifacts("test-user", "test-idea");
assert(artifacts.length >= 2);
assert(artifacts.some((a) => a.filePath === "doc1.md"));
assert(artifacts.some((a) => a.filePath === "research/doc2.md"));
```

---

### TEST-AS-008: Implement deleteArtifact

**Preconditions:**

- TEST-AS-007 passed

**Implementation Steps:**

1. Add function: `deleteArtifact(userSlug: string, ideaSlug: string, filePath: string): Promise<boolean>`
2. Delete file from filesystem
3. Update `.metadata/index.json` cache
4. Return true if deleted, false if not found

**Pass Criteria:**

- [ ] Function `deleteArtifact` is exported
- [ ] Deletes file from filesystem
- [ ] Returns `true` when file deleted
- [ ] Returns `false` when file not found (no throw)
- [ ] Updates cache to remove entry
- [ ] Does not delete directory (only files)
- [ ] Handles nested paths

**Fail Criteria:**

- Throws on missing file
- File still exists after delete
- Cache not updated

**Verification Code:**

```typescript
import {
  saveArtifact,
  deleteArtifact,
  loadArtifact,
} from "./agents/ideation/unified-artifact-store";

await saveArtifact("test-user", "test-idea", {
  type: "markdown",
  title: "Delete Test",
  content: "x",
  filePath: "delete-me.md",
});
const deleted = await deleteArtifact("test-user", "test-idea", "delete-me.md");
assert(deleted === true);
const loaded = await loadArtifact("test-user", "test-idea", "delete-me.md");
assert(loaded === null);
```

---

### TEST-AS-009: Implement deleteSessionArtifacts

**Preconditions:**

- TEST-AS-008 passed

**Implementation Steps:**

1. Add function: `deleteSessionArtifacts(userSlug: string, ideaSlug: string, sessionId: string): Promise<number>`
2. Find all artifacts with matching sessionId in frontmatter
3. Delete each file
4. Update cache
5. Return count of deleted files

**Pass Criteria:**

- [ ] Function `deleteSessionArtifacts` is exported
- [ ] Deletes all files with matching sessionId
- [ ] Does not delete files from other sessions
- [ ] Does not delete template files (no sessionId)
- [ ] Returns correct count of deleted files
- [ ] Cache updated to remove all deleted entries
- [ ] Returns 0 if no matching files (no throw)

**Fail Criteria:**

- Deletes wrong files
- Wrong count returned
- Template files deleted
- Cache inconsistent

**Verification Code:**

```typescript
import {
  saveArtifact,
  deleteSessionArtifacts,
  listArtifacts,
} from "./agents/ideation/unified-artifact-store";

await saveArtifact("test-user", "test-idea", {
  type: "markdown",
  title: "S1 Doc",
  content: "a",
  sessionId: "session-1",
});
await saveArtifact("test-user", "test-idea", {
  type: "markdown",
  title: "S1 Doc 2",
  content: "b",
  sessionId: "session-1",
});
await saveArtifact("test-user", "test-idea", {
  type: "markdown",
  title: "S2 Doc",
  content: "c",
  sessionId: "session-2",
});

const deleted = await deleteSessionArtifacts(
  "test-user",
  "test-idea",
  "session-1",
);
assert(deleted === 2);

const remaining = await listArtifacts("test-user", "test-idea");
assert(remaining.some((a) => a.sessionId === "session-2"));
assert(!remaining.some((a) => a.sessionId === "session-1"));
```

---

## Task 4: Cache Management

### TEST-AS-010: Implement rebuildCache

**Preconditions:**

- TEST-AS-009 passed

**Implementation Steps:**

1. Add function: `rebuildCache(userSlug: string, ideaSlug: string): Promise<void>`
2. Scan all .md files in idea folder recursively
3. Parse frontmatter from each file
4. Build index with: id, title, type, filePath, sessionId, tokenCount, updatedAt
5. Write to `.metadata/index.json`

**Pass Criteria:**

- [ ] Function `rebuildCache` is exported
- [ ] Creates `.metadata/index.json` if missing
- [ ] Overwrites existing cache
- [ ] Includes all .md files recursively
- [ ] Excludes `.metadata/` and `.versions/` directories
- [ ] Each entry has: id, title, type, filePath, sessionId (if present), tokenCount, updatedAt
- [ ] Cache is valid JSON
- [ ] Handles files without frontmatter (generates entry with inferred data)

**Fail Criteria:**

- Cache not created
- Missing files in cache
- Invalid JSON
- Wrong file paths

**Verification Command:**

```bash
# After running rebuildCache
cat users/test-user/ideas/test-idea/.metadata/index.json | jq .
```

**Verification Code:**

```typescript
import {
  rebuildCache,
  saveArtifact,
} from "./agents/ideation/unified-artifact-store";
import * as fs from "fs";

await saveArtifact("test-user", "test-idea", {
  type: "markdown",
  title: "Rebuild Test",
  content: "x",
});
fs.unlinkSync("users/test-user/ideas/test-idea/.metadata/index.json"); // Delete cache

await rebuildCache("test-user", "test-idea");
assert(fs.existsSync("users/test-user/ideas/test-idea/.metadata/index.json"));

const cache = JSON.parse(
  fs.readFileSync(
    "users/test-user/ideas/test-idea/.metadata/index.json",
    "utf-8",
  ),
);
assert(Object.keys(cache.artifacts).length > 0);
```

---

### TEST-AS-011: Cache Invalidation on File Changes

**Preconditions:**

- TEST-AS-010 passed

**Implementation Steps:**

1. Add function: `updateCacheEntry(userSlug: string, ideaSlug: string, artifact: UnifiedArtifact): Promise<void>`
2. Add function: `removeCacheEntry(userSlug: string, ideaSlug: string, filePath: string): Promise<void>`
3. Add function: `isCacheValid(userSlug: string, ideaSlug: string): Promise<boolean>`
4. Check cache validity by comparing file mtimes with cache timestamp

**Pass Criteria:**

- [ ] `updateCacheEntry` updates single entry without full rebuild
- [ ] `removeCacheEntry` removes single entry without full rebuild
- [ ] `isCacheValid` returns false if any file modified after cache timestamp
- [ ] `isCacheValid` returns false if cache file missing
- [ ] `isCacheValid` returns true for fresh cache
- [ ] Cache operations are atomic (partial writes don't corrupt)

**Fail Criteria:**

- Full rebuild on every change
- Cache corruption on concurrent access
- Wrong validity check

**Verification Code:**

```typescript
import {
  saveArtifact,
  isCacheValid,
  rebuildCache,
} from "./agents/ideation/unified-artifact-store";
import * as fs from "fs";

await rebuildCache("test-user", "test-idea");
assert((await isCacheValid("test-user", "test-idea")) === true);

// Modify a file directly
fs.writeFileSync(
  "users/test-user/ideas/test-idea/README.md",
  "# Modified",
  "utf-8",
);
assert((await isCacheValid("test-user", "test-idea")) === false);
```

---

## Task 5: Rename & Migration

### TEST-AS-012: Implement renameIdeaFolder

**Preconditions:**

- TEST-AS-011 passed

**Implementation Steps:**

1. Add function: `renameIdeaFolder(userSlug: string, oldSlug: string, newSlug: string): Promise<void>`
2. Rename folder on filesystem
3. Update frontmatter in all files (ideaSlug field)
4. Update database references (ideation_sessions, ideation_artifacts)
5. Update relationships in `.metadata/relationships.json`
6. Rebuild cache

**Pass Criteria:**

- [ ] Function `renameIdeaFolder` is exported
- [ ] Old folder no longer exists
- [ ] New folder exists with all files
- [ ] All files have updated ideaSlug in frontmatter
- [ ] Database `ideation_sessions.idea_slug` updated
- [ ] Database `ideation_artifacts.idea_slug` updated
- [ ] Relationships JSON updated
- [ ] Cache rebuilt
- [ ] Throws if new slug already exists

**Fail Criteria:**

- Files lost during rename
- Frontmatter not updated
- Database not updated
- Old folder still exists

**Verification Code:**

```typescript
import {
  createIdeaFolder,
  renameIdeaFolder,
  loadArtifact,
} from "./agents/ideation/unified-artifact-store";
import * as fs from "fs";

await createIdeaFolder("test-user", "old-name", "business");
await renameIdeaFolder("test-user", "old-name", "new-name");

assert(!fs.existsSync("users/test-user/ideas/old-name"));
assert(fs.existsSync("users/test-user/ideas/new-name"));
```

---

### TEST-AS-013: Migrate Existing Database Artifacts

**Preconditions:**

- TEST-AS-012 passed

**Implementation Steps:**

1. Create migration script: `scripts/migrate-artifacts-to-files.ts`
2. Read all artifacts from `ideation_artifacts` table
3. For each artifact with content:
   - Determine target idea folder (from session or create draft)
   - Write to file with frontmatter
   - Update database row with file_path
   - Set content to NULL (file-backed)
4. Run as: `npx tsx scripts/migrate-artifacts-to-files.ts`

**Pass Criteria:**

- [ ] Script exists at `scripts/migrate-artifacts-to-files.ts`
- [ ] Script can be run: `npx tsx scripts/migrate-artifacts-to-files.ts`
- [ ] All artifacts with content migrated to files
- [ ] Database rows updated with `file_path`
- [ ] Database `content` set to NULL for migrated artifacts
- [ ] Artifacts without idea association go to draft folders
- [ ] Migration is idempotent (running twice is safe)
- [ ] Migration logs progress

**Fail Criteria:**

- Script crashes
- Data loss
- Duplicate migrations
- Wrong file locations

**Verification Command:**

```bash
npx tsx scripts/migrate-artifacts-to-files.ts
sqlite3 database/ideas.db "SELECT COUNT(*) FROM ideation_artifacts WHERE content IS NOT NULL AND file_path IS NOT NULL"
# Should return 0 (no artifacts have both content and file_path)
```

---

## Task 6: API Compatibility Layer

### TEST-AS-014: Update Server Routes

**Preconditions:**

- TEST-AS-013 passed

**Implementation Steps:**

1. Modify `server/routes/ideation.ts`
2. Update `POST /artifacts` to use `saveArtifact`
3. Update `GET /artifacts/:sessionId` to use `listArtifacts` filtered by session
4. Update `DELETE /artifacts/:id` to use `deleteArtifact`
5. Add `GET /ideas/:userSlug/:ideaSlug/artifacts` endpoint
6. Add `POST /ideas/:userSlug/:ideaSlug/artifacts` endpoint

**Pass Criteria:**

- [ ] `POST /artifacts` creates file and returns artifact
- [ ] `GET /artifacts/:sessionId` returns artifacts for session
- [ ] `DELETE /artifacts/:id` deletes file
- [ ] `GET /ideas/:userSlug/:ideaSlug/artifacts` returns all idea artifacts
- [ ] `POST /ideas/:userSlug/:ideaSlug/artifacts` creates artifact in idea folder
- [ ] All endpoints return consistent response format
- [ ] Error responses include descriptive messages
- [ ] Backward compatible with existing frontend calls

**Fail Criteria:**

- Endpoints return errors for valid requests
- Response format breaks frontend
- Missing required endpoints

**Verification Command:**

```bash
# Test artifact creation
curl -X POST http://localhost:3001/api/ideation/ideas/test-user/test-idea/artifacts \
  -H "Content-Type: application/json" \
  -d '{"type":"markdown","title":"API Test","content":"# Test"}'

# Test artifact listing
curl http://localhost:3001/api/ideation/ideas/test-user/test-idea/artifacts
```

---

### TEST-AS-015: Backward Compatibility Export

**Preconditions:**

- TEST-AS-014 passed

**Implementation Steps:**

1. Export legacy interface from `artifact-store.ts`:
   ```typescript
   export { saveArtifact, getArtifactsBySession, deleteArtifactsBySession };
   ```
2. Wrap new functions to match old signatures
3. Mark old functions as deprecated
4. Ensure all existing imports continue to work

**Pass Criteria:**

- [ ] Importing from `artifact-store.ts` still works
- [ ] Old function signatures preserved
- [ ] Deprecated warnings in console when using old functions
- [ ] All existing tests pass without modification
- [ ] New functions available via `unified-artifact-store.ts`

**Fail Criteria:**

- Import errors
- Changed signatures break callers
- Tests fail

**Verification Code:**

```typescript
// Old import should still work
import {
  saveArtifact,
  getArtifactsBySession,
} from "./agents/ideation/artifact-store";

// Should log deprecation warning but work
await saveArtifact({
  id: "test",
  sessionId: "sess",
  type: "markdown",
  title: "Test",
  content: "x",
});
```

---

## Summary

| Test ID     | Description                         | Dependencies |
| ----------- | ----------------------------------- | ------------ |
| TEST-AS-001 | Define UnifiedArtifact interface    | TEST-FS-015  |
| TEST-AS-002 | Implement frontmatter parser        | TEST-AS-001  |
| TEST-AS-003 | Implement frontmatter generator     | TEST-AS-002  |
| TEST-AS-004 | Implement token counting            | TEST-AS-003  |
| TEST-AS-005 | Implement saveArtifact              | TEST-AS-004  |
| TEST-AS-006 | Implement loadArtifact              | TEST-AS-005  |
| TEST-AS-007 | Implement listArtifacts             | TEST-AS-006  |
| TEST-AS-008 | Implement deleteArtifact            | TEST-AS-007  |
| TEST-AS-009 | Implement deleteSessionArtifacts    | TEST-AS-008  |
| TEST-AS-010 | Implement rebuildCache              | TEST-AS-009  |
| TEST-AS-011 | Cache invalidation on file changes  | TEST-AS-010  |
| TEST-AS-012 | Implement renameIdeaFolder          | TEST-AS-011  |
| TEST-AS-013 | Migrate existing database artifacts | TEST-AS-012  |
| TEST-AS-014 | Update server routes                | TEST-AS-013  |
| TEST-AS-015 | Backward compatibility export       | TEST-AS-014  |

---

## Files to Create

| File                                        | Purpose                               |
| ------------------------------------------- | ------------------------------------- |
| `agents/ideation/unified-artifact-store.ts` | New filesystem-based artifact storage |
| `scripts/migrate-artifacts-to-files.ts`     | Migration script for existing data    |

## Files to Modify

| File                                | Changes                                |
| ----------------------------------- | -------------------------------------- |
| `agents/ideation/artifact-store.ts` | Deprecate and wrap new functions       |
| `server/routes/ideation.ts`         | Update endpoints for user/idea scoping |

---

## Execution Command

```bash
# Run the Ralph loop for this spec
python tests/e2e/ralph_loop.py --test-filter "TEST-AS-*"
```
