# Developer Spec 03: Session & Context Management

**Feature**: Unified File System - Phase 3
**Version**: 1.0
**Ralph Loop Compatible**: Yes
**Depends On**: Spec 02 (TEST-AS-001 through TEST-AS-015)

---

## Overview

Implement session-to-idea linking, layered context loading for agents, and document priority management. Sessions can start as drafts and convert to named ideas, or link directly to existing ideas.

---

## Test State Schema

Add to `tests/e2e/test-state.json`:

```json
{
  "tests": [
    {
      "id": "TEST-SC-001",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-AS-015"
    },
    {
      "id": "TEST-SC-002",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-001"
    },
    {
      "id": "TEST-SC-003",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-002"
    },
    {
      "id": "TEST-SC-004",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-003"
    },
    {
      "id": "TEST-SC-005",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-004"
    },
    {
      "id": "TEST-SC-006",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-005"
    },
    {
      "id": "TEST-SC-007",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-006"
    },
    {
      "id": "TEST-SC-008",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-007"
    },
    {
      "id": "TEST-SC-009",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-008"
    },
    {
      "id": "TEST-SC-010",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-009"
    },
    {
      "id": "TEST-SC-011",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-010"
    },
    {
      "id": "TEST-SC-012",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-011"
    },
    {
      "id": "TEST-SC-013",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-012"
    },
    {
      "id": "TEST-SC-014",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-013"
    },
    {
      "id": "TEST-SC-015",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-014"
    }
  ]
}
```

---

## Task 1: Session-Idea Linking Data Model

### TEST-SC-001: Define AgentContext Interface

**Preconditions:**

- Spec 02 tests passed (TEST-AS-015)

**Implementation Steps:**

1. Create file: `agents/ideation/idea-context-builder.ts`
2. Define `AgentContext` interface with all layers
3. Define `IdeaIdentity`, `ProgressState`, `RelationshipInfo`, `CoreDocs`, `PhaseDoc` interfaces
4. Export all types

**Pass Criteria:**

- [ ] File `agents/ideation/idea-context-builder.ts` exists
- [ ] `AgentContext` interface exported with:
  ```typescript
  interface AgentContext {
    idea: IdeaIdentity;
    progress: ProgressState;
    relationships: RelationshipInfo;
    coreDocs: CoreDocs;
    phaseDocs: PhaseDoc[];
    availableDocuments: AvailableDoc[];
  }
  ```
- [ ] `IdeaIdentity` has: userSlug, ideaSlug, type, parent?, currentPhase
- [ ] `ProgressState` has: phase, completionPercent, documentsComplete, documentsMissing, lastActivity, blockers, nextRecommendedAction
- [ ] `RelationshipInfo` has: parent?, children, integrations, collaborators
- [ ] `CoreDocs` has: readme: { summary, fullPath }, development: { recentQA, gaps }
- [ ] `PhaseDoc` has: path, content, tokenCount
- [ ] `AvailableDoc` has: path, summary, lastUpdated
- [ ] File compiles: `npx tsc --noEmit agents/ideation/idea-context-builder.ts`

**Fail Criteria:**

- TypeScript errors
- Missing required fields
- Wrong type definitions

**Verification Command:**

```bash
npx tsc --noEmit agents/ideation/idea-context-builder.ts && echo "PASS"
```

---

### TEST-SC-002: Session Linking API

**Preconditions:**

- TEST-SC-001 passed

**Implementation Steps:**

1. Modify `server/routes/ideation.ts`
2. Add endpoint: `PATCH /session/:sessionId/link-idea`
3. Accept body: `{ userSlug: string, ideaSlug: string }`
4. Update session record in database
5. Return updated session

**Pass Criteria:**

- [ ] Endpoint `PATCH /api/ideation/session/:sessionId/link-idea` exists
- [ ] Updates `ideation_sessions.user_slug` column
- [ ] Updates `ideation_sessions.idea_slug` column
- [ ] Returns 200 with updated session object
- [ ] Returns 404 if session not found
- [ ] Returns 400 if ideaSlug points to non-existent folder
- [ ] Validates that idea folder exists before linking

**Fail Criteria:**

- Wrong HTTP method
- Database not updated
- Returns wrong status codes
- Links to non-existent idea

**Verification Command:**

```bash
curl -X PATCH http://localhost:3001/api/ideation/session/sess-123/link-idea \
  -H "Content-Type: application/json" \
  -d '{"userSlug":"test-user","ideaSlug":"test-idea"}'
```

---

### TEST-SC-003: Create Session with Draft Folder

**Preconditions:**

- TEST-SC-002 passed

**Implementation Steps:**

1. Modify session creation logic
2. When session created without ideaSlug:
   - Create draft folder: `users/[user]/ideas/draft_[timestamp]/`
   - Set session's idea_slug to draft folder name
3. Return session with draft folder reference

**Pass Criteria:**

- [ ] Creating session without ideaSlug creates draft folder
- [ ] Draft folder name format: `draft_yyyymmddhhmmss`
- [ ] Session's `idea_slug` set to draft folder name
- [ ] Draft folder created in correct location
- [ ] Draft folder is empty (no templates yet)
- [ ] Multiple sessions create different draft folders

**Fail Criteria:**

- No draft folder created
- Wrong folder location
- Wrong folder name format
- Session not linked to draft

**Verification Code:**

```typescript
// Create session without idea
const response = await fetch("http://localhost:3001/api/ideation/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userSlug: "test-user" }),
});
const session = await response.json();

// Check draft folder exists
assert(session.ideaSlug.startsWith("draft_"));
assert(fs.existsSync(`users/test-user/ideas/${session.ideaSlug}`));
```

---

### TEST-SC-004: Convert Draft to Named Idea

**Preconditions:**

- TEST-SC-003 passed

**Implementation Steps:**

1. Add endpoint: `POST /session/:sessionId/name-idea`
2. Accept body: `{ title: string, ideaType: IdeaType, parent?: ParentInfo }`
3. Generate slug from title
4. Use `renameDraftToIdea` from folder-structure utils
5. Return updated session with new ideaSlug

**Pass Criteria:**

- [ ] Endpoint `POST /api/ideation/session/:sessionId/name-idea` exists
- [ ] Renames draft folder to slugified title
- [ ] Adds all templates to the renamed folder
- [ ] Updates session's idea_slug in database
- [ ] Updates all artifacts' idea_slug in database
- [ ] Returns updated session with new ideaSlug
- [ ] Returns 400 if session not linked to draft
- [ ] Returns 409 if target slug already exists
- [ ] Handles special characters in title (slugifies correctly)

**Fail Criteria:**

- Draft folder still exists
- Templates not added
- Database not updated
- Wrong slug generation

**Verification Command:**

```bash
curl -X POST http://localhost:3001/api/ideation/session/sess-123/name-idea \
  -H "Content-Type: application/json" \
  -d '{"title":"My New Idea","ideaType":"business"}'
```

---

## Task 2: Context Loading

### TEST-SC-005: Build Identity Layer

**Preconditions:**

- TEST-SC-004 passed

**Implementation Steps:**

1. Add function: `buildIdentityLayer(userSlug: string, ideaSlug: string): Promise<IdeaIdentity>`
2. Read README.md frontmatter
3. Extract: type, parent, currentPhase
4. Return identity object

**Pass Criteria:**

- [ ] Function `buildIdentityLayer` is exported
- [ ] Returns `IdeaIdentity` with all fields
- [ ] Reads idea_type from README.md frontmatter
- [ ] Reads parent info from relationships.json
- [ ] Reads currentPhase from README.md frontmatter (lifecycle_stage)
- [ ] Returns default values for missing fields
- [ ] Total token estimate < 500 tokens

**Fail Criteria:**

- Missing required fields
- Wrong values parsed
- Exceeds token budget

**Verification Code:**

```typescript
import { buildIdentityLayer } from "./agents/ideation/idea-context-builder";

const identity = await buildIdentityLayer("test-user", "test-idea");
assert(identity.userSlug === "test-user");
assert(identity.ideaSlug === "test-idea");
assert(
  ["business", "feature", "service", "pivot", "integration"].includes(
    identity.type,
  ),
);
```

---

### TEST-SC-006: Build Progress Layer

**Preconditions:**

- TEST-SC-005 passed

**Implementation Steps:**

1. Add function: `buildProgressLayer(userSlug: string, ideaSlug: string): Promise<ProgressState>`
2. Calculate completion percentage based on filled templates
3. Identify complete vs missing required documents
4. Determine next recommended action
5. Return progress state

**Pass Criteria:**

- [ ] Function `buildProgressLayer` is exported
- [ ] Returns `ProgressState` with all fields
- [ ] `completionPercent` calculated: (filled sections / total sections) \* 100
- [ ] `documentsComplete` lists docs with all checkboxes marked
- [ ] `documentsMissing` lists required docs that are empty/template
- [ ] `lastActivity` is most recent file update timestamp
- [ ] `blockers` lists any identified blockers
- [ ] `nextRecommendedAction` suggests what to do next
- [ ] Total token estimate < 300 tokens

**Fail Criteria:**

- Wrong completion calculation
- Missing documents not identified
- Wrong action recommendation

**Verification Code:**

```typescript
import { buildProgressLayer } from "./agents/ideation/idea-context-builder";

const progress = await buildProgressLayer("test-user", "test-idea");
assert(typeof progress.completionPercent === "number");
assert(progress.completionPercent >= 0 && progress.completionPercent <= 100);
assert(Array.isArray(progress.documentsComplete));
assert(Array.isArray(progress.documentsMissing));
```

---

### TEST-SC-007: Build Relationships Layer

**Preconditions:**

- TEST-SC-006 passed

**Implementation Steps:**

1. Add function: `buildRelationshipsLayer(userSlug: string, ideaSlug: string): Promise<RelationshipInfo>`
2. Read `.metadata/relationships.json`
3. Query database for children (ideas with this as parent)
4. Return relationship summary

**Pass Criteria:**

- [ ] Function `buildRelationshipsLayer` is exported
- [ ] Returns `RelationshipInfo` with all fields
- [ ] `parent` populated from relationships.json
- [ ] `children` populated from database query
- [ ] `integrations` populated from relationships.json
- [ ] `collaborators` populated from relationships.json
- [ ] Handles missing relationships.json gracefully
- [ ] Total token estimate < 200 tokens

**Fail Criteria:**

- Error on missing relationships file
- Wrong parent/children returned
- Missing integrations

**Verification Code:**

```typescript
import { buildRelationshipsLayer } from "./agents/ideation/idea-context-builder";

const relationships = await buildRelationshipsLayer("test-user", "test-idea");
assert(Array.isArray(relationships.children));
assert(Array.isArray(relationships.integrations));
```

---

### TEST-SC-008: Build Core Docs Layer

**Preconditions:**

- TEST-SC-007 passed

**Implementation Steps:**

1. Add function: `buildCoreDocsLayer(userSlug: string, ideaSlug: string): Promise<CoreDocs>`
2. Read README.md and extract/generate summary
3. Read development.md and extract recent Q&A and gaps
4. Summarize if content exceeds token budget

**Pass Criteria:**

- [ ] Function `buildCoreDocsLayer` is exported
- [ ] Returns `CoreDocs` with readme and development summaries
- [ ] `readme.summary` is concise (< 500 tokens)
- [ ] `readme.fullPath` is correct path to file
- [ ] `development.recentQA` contains last 5 Q&A entries
- [ ] `development.gaps` lists identified gaps/todos
- [ ] Large content is summarized to fit budget
- [ ] Total token estimate < 1000 tokens

**Fail Criteria:**

- Exceeds token budget
- Wrong file paths
- Missing summaries

**Verification Code:**

```typescript
import {
  buildCoreDocsLayer,
  estimateTokens,
} from "./agents/ideation/idea-context-builder";

const coreDocs = await buildCoreDocsLayer("test-user", "test-idea");
assert(coreDocs.readme.summary.length > 0);
assert(coreDocs.readme.fullPath.endsWith("README.md"));
const tokens = estimateTokens(JSON.stringify(coreDocs));
assert(tokens < 1000);
```

---

### TEST-SC-009: Build Phase Docs Layer

**Preconditions:**

- TEST-SC-008 passed

**Implementation Steps:**

1. Add function: `buildPhaseDocsLayer(userSlug: string, ideaSlug: string, phase: LifecycleStage): Promise<PhaseDoc[]>`
2. Look up required/recommended docs for phase from classification rules
3. Load full content of required docs (up to budget)
4. Load summaries of recommended docs
5. Return phase docs array

**Pass Criteria:**

- [ ] Function `buildPhaseDocsLayer` is exported
- [ ] Returns array of `PhaseDoc` objects
- [ ] Required docs loaded with full content
- [ ] Recommended docs loaded with summaries only
- [ ] Documents prioritized by classification rules
- [ ] Total token budget: 5000 tokens
- [ ] If budget exceeded, lower-priority docs truncated
- [ ] Each PhaseDoc has: path, content, tokenCount

**Fail Criteria:**

- Exceeds 5000 token budget
- Required docs missing
- Wrong priority ordering

**Verification Code:**

```typescript
import {
  buildPhaseDocsLayer,
  estimateTokens,
} from "./agents/ideation/idea-context-builder";

const phaseDocs = await buildPhaseDocsLayer(
  "test-user",
  "test-idea",
  "RESEARCH",
);
assert(Array.isArray(phaseDocs));
const totalTokens = phaseDocs.reduce((sum, doc) => sum + doc.tokenCount, 0);
assert(totalTokens <= 5000);
```

---

### TEST-SC-010: Build Available Docs Index

**Preconditions:**

- TEST-SC-009 passed

**Implementation Steps:**

1. Add function: `buildAvailableDocsIndex(userSlug: string, ideaSlug: string): Promise<AvailableDoc[]>`
2. List all documents not loaded in phase docs
3. Generate brief summary (1-2 sentences) for each
4. Sort by lastUpdated descending

**Pass Criteria:**

- [ ] Function `buildAvailableDocsIndex` is exported
- [ ] Returns array of `AvailableDoc` objects
- [ ] Excludes docs already in phaseDocs
- [ ] Each doc has: path, summary, lastUpdated
- [ ] Summaries are brief (< 50 tokens each)
- [ ] Sorted by lastUpdated (most recent first)
- [ ] Includes docs from all subdirectories

**Fail Criteria:**

- Duplicate entries
- Missing documents
- Wrong sort order

**Verification Code:**

```typescript
import { buildAvailableDocsIndex } from "./agents/ideation/idea-context-builder";

const availableDocs = await buildAvailableDocsIndex("test-user", "test-idea");
assert(Array.isArray(availableDocs));
availableDocs.forEach((doc) => {
  assert(doc.path);
  assert(doc.summary);
  assert(doc.lastUpdated);
});
```

---

### TEST-SC-011: Full Context Builder

**Preconditions:**

- TEST-SC-010 passed

**Implementation Steps:**

1. Add function: `buildIdeaContext(userSlug: string, ideaSlug: string): Promise<AgentContext>`
2. Call all layer builders
3. Assemble into AgentContext
4. Log total token count
5. Return complete context

**Pass Criteria:**

- [ ] Function `buildIdeaContext` is exported
- [ ] Returns complete `AgentContext` object
- [ ] All layers populated
- [ ] Total context < 22000 tokens (leaves room for conversation)
- [ ] Performance: completes in < 2 seconds for typical idea
- [ ] Handles errors gracefully (returns partial context if layer fails)
- [ ] Logs token breakdown by layer

**Fail Criteria:**

- Exceeds token budget
- Slow performance
- Crashes on error

**Verification Code:**

```typescript
import {
  buildIdeaContext,
  estimateTokens,
} from "./agents/ideation/idea-context-builder";

const context = await buildIdeaContext("test-user", "test-idea");
assert(context.idea);
assert(context.progress);
assert(context.relationships);
assert(context.coreDocs);
assert(context.phaseDocs);
assert(context.availableDocuments);

const totalTokens = estimateTokens(JSON.stringify(context));
assert(totalTokens < 22000);
```

---

## Task 3: Priority Management

### TEST-SC-012: Create Priority Manager

**Preconditions:**

- TEST-SC-011 passed

**Implementation Steps:**

1. Create file: `agents/ideation/priority-manager.ts`
2. Define priority rules structure
3. Add function: `getPriorityDocs(userSlug: string, ideaSlug: string, phase: LifecycleStage): Promise<string[]>`
4. Return ordered list of document paths by priority

**Pass Criteria:**

- [ ] File `agents/ideation/priority-manager.ts` exists
- [ ] Function `getPriorityDocs` is exported
- [ ] Returns array of file paths in priority order
- [ ] Priority order: always_show > by_phase > recently_updated > ai_recommended
- [ ] Reads from `.metadata/priority.json`
- [ ] Falls back to default priorities if file missing
- [ ] Phase-specific docs included when matching current phase

**Fail Criteria:**

- Wrong priority order
- Crashes on missing file
- Ignores phase-specific docs

**Verification Code:**

```typescript
import { getPriorityDocs } from "./agents/ideation/priority-manager";

const docs = await getPriorityDocs("test-user", "test-idea", "RESEARCH");
assert(Array.isArray(docs));
// README.md should be in always_show, so first
assert(docs.indexOf("README.md") === 0);
```

---

### TEST-SC-013: Update Priority on Activity

**Preconditions:**

- TEST-SC-012 passed

**Implementation Steps:**

1. Add function: `updateRecentlyUpdated(userSlug: string, ideaSlug: string, filePath: string): Promise<void>`
2. Add file to recently_updated list (max 10 items)
3. Remove oldest if exceeds limit
4. Save to `.metadata/priority.json`

**Pass Criteria:**

- [ ] Function `updateRecentlyUpdated` is exported
- [ ] Adds file to recently_updated array
- [ ] Moves file to front if already in list
- [ ] Limits to 10 most recent
- [ ] Saves changes to priority.json
- [ ] Creates priority.json if missing

**Fail Criteria:**

- List exceeds 10 items
- Duplicate entries
- File not saved

**Verification Code:**

```typescript
import {
  updateRecentlyUpdated,
  getPriorityDocs,
} from "./agents/ideation/priority-manager";
import * as fs from "fs";

await updateRecentlyUpdated("test-user", "test-idea", "research/market.md");
const priority = JSON.parse(
  fs.readFileSync(
    "users/test-user/ideas/test-idea/.metadata/priority.json",
    "utf-8",
  ),
);
assert(priority.recently_updated.includes("research/market.md"));
```

---

### TEST-SC-014: AI-Recommended Documents

**Preconditions:**

- TEST-SC-013 passed

**Implementation Steps:**

1. Add function: `setAiRecommended(userSlug: string, ideaSlug: string, docs: string[]): Promise<void>`
2. Replace ai_recommended list in priority.json
3. Add function: `getAiRecommended(userSlug: string, ideaSlug: string): Promise<string[]>`

**Pass Criteria:**

- [ ] Function `setAiRecommended` is exported
- [ ] Replaces entire ai_recommended list
- [ ] `getAiRecommended` returns current list
- [ ] Changes persisted to priority.json
- [ ] Empty array clears recommendations

**Fail Criteria:**

- Appends instead of replaces
- Not persisted

**Verification Code:**

```typescript
import {
  setAiRecommended,
  getAiRecommended,
} from "./agents/ideation/priority-manager";

await setAiRecommended("test-user", "test-idea", [
  "validation/assumptions.md",
  "research/competitive.md",
]);
const recommended = await getAiRecommended("test-user", "test-idea");
assert(recommended.length === 2);
assert(recommended.includes("validation/assumptions.md"));
```

---

## Task 4: System Prompt Integration

### TEST-SC-015: Add IDEA_CONTEXT to System Prompt

**Preconditions:**

- TEST-SC-014 passed

**Implementation Steps:**

1. Modify `agents/ideation/system-prompt.ts`
2. Add `{{IDEA_CONTEXT}}` placeholder
3. Add function: `injectIdeaContext(systemPrompt: string, context: AgentContext): string`
4. Replace placeholder with formatted context

**Pass Criteria:**

- [ ] `{{IDEA_CONTEXT}}` placeholder defined in system prompt template
- [ ] Function `injectIdeaContext` is exported
- [ ] Context formatted as structured markdown:

  ```markdown
  ## Current Idea: {title}

  Type: {type} | Phase: {phase} | Completion: {percent}%

  ### Progress

  - Complete: {list}
  - Missing: {list}
  - Next action: {recommendation}

  ### Core Documents

  #### README Summary

  {summary}

  #### Recent Q&A

  {qa_list}

  ### Available Documents

  {doc_list_with_summaries}
  ```

- [ ] Placeholder replaced in output
- [ ] Empty context handled (placeholder replaced with minimal text)
- [ ] Output fits within token budget

**Fail Criteria:**

- Placeholder not replaced
- Exceeds token budget
- Format not readable

**Verification Code:**

```typescript
import { injectIdeaContext } from "./agents/ideation/system-prompt";
import { buildIdeaContext } from "./agents/ideation/idea-context-builder";

const context = await buildIdeaContext("test-user", "test-idea");
const template =
  "You are an AI assistant.\n\n{{IDEA_CONTEXT}}\n\nHelp the user.";
const result = injectIdeaContext(template, context);

assert(!result.includes("{{IDEA_CONTEXT}}"));
assert(result.includes("## Current Idea"));
```

---

## Summary

| Test ID     | Description                       | Dependencies |
| ----------- | --------------------------------- | ------------ |
| TEST-SC-001 | Define AgentContext interface     | TEST-AS-015  |
| TEST-SC-002 | Session linking API               | TEST-SC-001  |
| TEST-SC-003 | Create session with draft folder  | TEST-SC-002  |
| TEST-SC-004 | Convert draft to named idea       | TEST-SC-003  |
| TEST-SC-005 | Build identity layer              | TEST-SC-004  |
| TEST-SC-006 | Build progress layer              | TEST-SC-005  |
| TEST-SC-007 | Build relationships layer         | TEST-SC-006  |
| TEST-SC-008 | Build core docs layer             | TEST-SC-007  |
| TEST-SC-009 | Build phase docs layer            | TEST-SC-008  |
| TEST-SC-010 | Build available docs index        | TEST-SC-009  |
| TEST-SC-011 | Full context builder              | TEST-SC-010  |
| TEST-SC-012 | Create priority manager           | TEST-SC-011  |
| TEST-SC-013 | Update priority on activity       | TEST-SC-012  |
| TEST-SC-014 | AI-recommended documents          | TEST-SC-013  |
| TEST-SC-015 | Add IDEA_CONTEXT to system prompt | TEST-SC-014  |

---

## Files to Create

| File                                      | Purpose                           |
| ----------------------------------------- | --------------------------------- |
| `agents/ideation/idea-context-builder.ts` | Build layered context for agent   |
| `agents/ideation/priority-manager.ts`     | Manage document priority rankings |

## Files to Modify

| File                               | Changes                                    |
| ---------------------------------- | ------------------------------------------ |
| `server/routes/ideation.ts`        | Add session linking endpoints              |
| `agents/ideation/system-prompt.ts` | Add IDEA_CONTEXT placeholder and injection |

---

## Execution Command

```bash
# Run the Ralph loop for this spec
python tests/e2e/ralph_loop.py --test-filter "TEST-SC-*"
```
