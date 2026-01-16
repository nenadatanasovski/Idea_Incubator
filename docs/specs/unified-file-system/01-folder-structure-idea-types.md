# Developer Spec 01: Folder Structure & Idea Types

**Feature**: Unified File System - Phase 1
**Version**: 1.0
**Ralph Loop Compatible**: Yes

---

## Overview

Implement user-scoped folder structure with idea type classification and relationship graph.

---

## Test State Schema

Add to `tests/e2e/test-state.json`:

```json
{
  "tests": [
    {
      "id": "TEST-FS-001",
      "status": "pending",
      "attempts": 0,
      "dependsOn": null
    },
    {
      "id": "TEST-FS-002",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-001"
    },
    {
      "id": "TEST-FS-003",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-002"
    },
    {
      "id": "TEST-FS-004",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-003"
    },
    {
      "id": "TEST-FS-005",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-001"
    },
    {
      "id": "TEST-FS-006",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-005"
    },
    {
      "id": "TEST-FS-007",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-006"
    },
    {
      "id": "TEST-FS-008",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-007"
    },
    {
      "id": "TEST-FS-009",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-004"
    },
    {
      "id": "TEST-FS-010",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-009"
    },
    {
      "id": "TEST-FS-011",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-010"
    },
    {
      "id": "TEST-FS-012",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-FS-011"
    }
  ]
}
```

---

## Task 1: Database Migration

### TEST-FS-001: Create idea_relationships Table

**Preconditions:**

- Database connection available via `getDb()`
- Migration system functional

**Implementation Steps:**

1. Create file: `database/migrations/021_idea_relationships.sql`
2. Define table schema with columns: id, from_user, from_idea, to_user, to_idea, to_external, relationship_type, metadata, created_at, created_by
3. Add indexes on from_user, from_idea, relationship_type
4. Run migration: `npm run migrate`

**Pass Criteria:**

- [ ] File `database/migrations/021_idea_relationships.sql` exists
- [ ] Running `npm run migrate` completes without errors
- [ ] Table `idea_relationships` exists in database
- [ ] Query `SELECT * FROM idea_relationships LIMIT 1` returns empty result (no error)
- [ ] Columns match spec: id (TEXT), from_user (TEXT), from_idea (TEXT), to_user (TEXT), to_idea (TEXT), to_external (TEXT), relationship_type (TEXT), metadata (TEXT/JSON), created_at (TIMESTAMP), created_by (TEXT)

**Fail Criteria:**

- Migration fails with SQL error
- Table doesn't exist after migration
- Missing columns
- Wrong column types

**Verification Command:**

```bash
sqlite3 database/ideas.db ".schema idea_relationships"
```

---

### TEST-FS-002: Add Columns to ideation_sessions

**Preconditions:**

- TEST-FS-001 passed
- `ideation_sessions` table exists

**Implementation Steps:**

1. Create file: `database/migrations/022_session_user_idea_columns.sql`
2. Add columns: user_slug (TEXT), idea_slug (TEXT)
3. Run migration

**Pass Criteria:**

- [ ] Migration file exists
- [ ] Migration completes without errors
- [ ] `ideation_sessions` table has `user_slug` column
- [ ] `ideation_sessions` table has `idea_slug` column
- [ ] Existing rows have NULL for new columns (backward compatible)

**Fail Criteria:**

- Migration fails
- Existing data corrupted
- Columns missing after migration

**Verification Command:**

```bash
sqlite3 database/ideas.db "PRAGMA table_info(ideation_sessions);"
```

---

### TEST-FS-003: Add Columns to ideation_artifacts

**Preconditions:**

- TEST-FS-002 passed
- `ideation_artifacts` table exists

**Implementation Steps:**

1. Create file: `database/migrations/023_artifact_user_idea_columns.sql`
2. Add columns: user_slug (TEXT), idea_slug (TEXT), file_path (TEXT)
3. Run migration

**Pass Criteria:**

- [ ] Migration file exists
- [ ] Migration completes without errors
- [ ] `ideation_artifacts` table has `user_slug`, `idea_slug`, `file_path` columns
- [ ] Existing rows have NULL for new columns

**Fail Criteria:**

- Migration fails
- Existing data corrupted

**Verification Command:**

```bash
sqlite3 database/ideas.db "PRAGMA table_info(ideation_artifacts);"
```

---

### TEST-FS-004: Verify All Migrations Applied

**Preconditions:**

- TEST-FS-003 passed

**Implementation Steps:**

1. Run full migration check
2. Verify all tables exist with correct schema

**Pass Criteria:**

- [ ] `npm run migrate:status` shows all migrations applied
- [ ] No pending migrations
- [ ] Database file size > 0
- [ ] All three new migrations (021, 022, 023) listed as applied

**Fail Criteria:**

- Pending migrations exist
- Migration status command fails

**Verification Command:**

```bash
npm run migrate:status
```

---

## Task 2: Folder Structure Utilities

### TEST-FS-005: Create users/ Directory Structure Utility

**Preconditions:**

- TEST-FS-001 passed

**Implementation Steps:**

1. Create file: `utils/folder-structure.ts`
2. Implement function: `createUserFolder(userSlug: string): Promise<string>`
3. Function creates: `users/[userSlug]/ideas/` directory
4. Function creates: `users/[userSlug]/profile.md` with template
5. Returns absolute path to user folder

**Pass Criteria:**

- [ ] File `utils/folder-structure.ts` exists
- [ ] Function `createUserFolder` is exported
- [ ] Calling `createUserFolder('test-user')` creates `users/test-user/` directory
- [ ] `users/test-user/ideas/` subdirectory exists
- [ ] `users/test-user/profile.md` file exists with valid frontmatter
- [ ] Function returns correct absolute path
- [ ] Calling twice doesn't throw error (idempotent)

**Fail Criteria:**

- Function throws on valid input
- Directory not created
- profile.md missing or invalid
- Non-idempotent (fails on second call)

**Verification Code:**

```typescript
import { createUserFolder } from "./utils/folder-structure";
const path = await createUserFolder("test-user");
assert(fs.existsSync(path));
assert(fs.existsSync(`${path}/ideas`));
assert(fs.existsSync(`${path}/profile.md`));
```

---

### TEST-FS-006: Create Draft Folder Utility

**Preconditions:**

- TEST-FS-005 passed

**Implementation Steps:**

1. Add to `utils/folder-structure.ts`:
2. Implement function: `createDraftFolder(userSlug: string): Promise<{ path: string, draftId: string }>`
3. Creates folder: `users/[userSlug]/ideas/draft_[yyyymmddhhmmss]/`
4. Returns path and draft ID

**Pass Criteria:**

- [ ] Function `createDraftFolder` is exported
- [ ] Calling `createDraftFolder('test-user')` creates timestamped draft folder
- [ ] Folder name matches pattern: `draft_\d{14}`
- [ ] Returned `draftId` matches folder name
- [ ] Returned `path` points to existing directory
- [ ] Two calls within 1 second create different folders

**Fail Criteria:**

- Function throws
- Folder name doesn't match pattern
- Path doesn't exist
- Duplicate folder names

**Verification Code:**

```typescript
const { path, draftId } = await createDraftFolder("test-user");
assert(/draft_\d{14}/.test(draftId));
assert(fs.existsSync(path));
```

---

### TEST-FS-007: Create Idea Folder with Templates

**Preconditions:**

- TEST-FS-006 passed
- Template files exist

**Implementation Steps:**

1. Add function: `createIdeaFolder(userSlug: string, ideaSlug: string, ideaType: IdeaType, parent?: ParentInfo): Promise<string>`
2. Creates folder: `users/[userSlug]/ideas/[ideaSlug]/`
3. Creates all subdirectories: research/, validation/, planning/, build/, marketing/, networking/, analysis/, assets/diagrams/, assets/images/, .metadata/
4. Copies all template files with frontmatter populated
5. Creates `.metadata/relationships.json` with parent info if provided

**Pass Criteria:**

- [ ] Function `createIdeaFolder` is exported
- [ ] Creates main idea folder
- [ ] Creates all 10 subdirectories
- [ ] Creates `README.md` with correct frontmatter (id, title, idea_type, etc.)
- [ ] Creates `development.md` with guided template
- [ ] Creates `target-users.md` with guided template
- [ ] Creates `problem-solution.md` with guided template
- [ ] Creates `business-model.md` with guided template
- [ ] Creates `team.md` with guided template
- [ ] Creates `research/market.md` with guided template
- [ ] Creates `research/competitive.md` with guided template
- [ ] Creates `validation/assumptions.md` with guided template
- [ ] Creates `planning/brief.md` with guided template
- [ ] Creates `planning/mvp-scope.md` with guided template
- [ ] Creates `planning/architecture.md` with guided template
- [ ] Creates `marketing/gtm.md` with guided template
- [ ] Creates `marketing/pitch.md` with guided template
- [ ] Creates `networking/contacts.md` with guided template
- [ ] Creates `build/spec.md` with guided template
- [ ] Creates `.metadata/index.json` (empty object)
- [ ] Creates `.metadata/relationships.json` with parent if provided
- [ ] Creates `.metadata/priority.json` with default values
- [ ] All frontmatter has correct `idea_type` value
- [ ] All frontmatter has correct `creator` value

**Fail Criteria:**

- Any directory missing
- Any template file missing
- Frontmatter malformed
- Parent relationship not recorded when provided

**Verification Code:**

```typescript
const path = await createIdeaFolder("test-user", "my-idea", "business");
assert(fs.existsSync(`${path}/README.md`));
assert(fs.existsSync(`${path}/research/market.md`));
assert(fs.existsSync(`${path}/.metadata/relationships.json`));
const readme = fs.readFileSync(`${path}/README.md`, "utf-8");
assert(readme.includes("idea_type: business"));
```

---

### TEST-FS-008: Rename Draft to Idea Folder

**Preconditions:**

- TEST-FS-007 passed

**Implementation Steps:**

1. Add function: `renameDraftToIdea(userSlug: string, draftId: string, ideaSlug: string, ideaType: IdeaType): Promise<string>`
2. Renames `users/[userSlug]/ideas/[draftId]/` to `users/[userSlug]/ideas/[ideaSlug]/`
3. Adds any missing template files
4. Updates database references (ideation_sessions, ideation_artifacts)
5. Returns new path

**Pass Criteria:**

- [ ] Draft folder renamed successfully
- [ ] Old draft folder no longer exists
- [ ] New idea folder exists at correct path
- [ ] Any files in draft folder preserved in new location
- [ ] Missing templates added
- [ ] Database rows updated: `ideation_sessions.idea_slug` changed from draft to new slug
- [ ] Database rows updated: `ideation_artifacts.idea_slug` changed from draft to new slug
- [ ] Returns correct new path

**Fail Criteria:**

- Draft folder still exists
- Files lost during rename
- Database not updated
- Error thrown for valid input

**Verification Code:**

```typescript
const { draftId } = await createDraftFolder("test-user");
fs.writeFileSync(`users/test-user/ideas/${draftId}/test.md`, "test");
const newPath = await renameDraftToIdea(
  "test-user",
  draftId,
  "my-new-idea",
  "business",
);
assert(!fs.existsSync(`users/test-user/ideas/${draftId}`));
assert(fs.existsSync(newPath));
assert(fs.existsSync(`${newPath}/test.md`));
assert(fs.existsSync(`${newPath}/README.md`));
```

---

## Task 3: Template Files

### TEST-FS-009: Create Core Templates

**Preconditions:**

- TEST-FS-004 passed

**Implementation Steps:**

1. Create `templates/unified/README.md` with guided sections
2. Create `templates/unified/development.md` with Q&A format
3. Create `templates/unified/target-users.md` with segment sections
4. Create `templates/unified/problem-solution.md` with problem/solution sections
5. Create `templates/unified/business-model.md` with revenue sections
6. Create `templates/unified/team.md` with team sections

**Pass Criteria:**

- [ ] All 6 core template files exist in `templates/unified/`
- [ ] Each template has valid YAML frontmatter with placeholder variables: `{{id}}`, `{{title}}`, `{{idea_type}}`, `{{creator}}`, `{{created}}`, `{{updated}}`
- [ ] Each template has section headers with `<!-- Agent fills after... -->` comments
- [ ] Each template has `- [ ] Defined: No` checkboxes for tracking
- [ ] README.md has sections: Overview, Problem Statement, Target Users, Solution, Key Features, Open Questions
- [ ] development.md has sections: Questions & Answers, Identified Gaps, Key Insights, Next Steps
- [ ] target-users.md has sections: Primary Segment, Demographics, Pain Points, Current Solutions
- [ ] problem-solution.md has sections: Problem Definition, Root Causes, Proposed Solution, Key Differentiators
- [ ] business-model.md has sections: Revenue Streams, Pricing Strategy, Cost Structure, Unit Economics
- [ ] team.md has sections: Founder Context, Skills & Gaps, Resources, Constraints

**Fail Criteria:**

- Template file missing
- Frontmatter invalid YAML
- Missing placeholder variables
- Missing sections

**Verification Command:**

```bash
for f in templates/unified/*.md; do echo "=== $f ==="; head -20 "$f"; done
```

---

### TEST-FS-010: Create Research & Validation Templates

**Preconditions:**

- TEST-FS-009 passed

**Implementation Steps:**

1. Create `templates/unified/research/market.md`
2. Create `templates/unified/research/competitive.md`
3. Create `templates/unified/research/user-personas.md`
4. Create `templates/unified/validation/assumptions.md`
5. Create `templates/unified/validation/results.md`

**Pass Criteria:**

- [ ] All 5 research/validation template files exist
- [ ] market.md has sections: Market Size, Trends, Timing, Geographic Focus
- [ ] competitive.md has sections: Direct Competitors, Indirect Competitors, Competitive Advantages, Market Positioning
- [ ] user-personas.md has sections: Persona 1, Persona 2, Persona 3 (each with Name, Demographics, Goals, Frustrations, Behaviors)
- [ ] assumptions.md has sections: Core Assumptions, Risk Level, Validation Method, Status
- [ ] results.md has sections: Assumption Tested, Method Used, Result, Implications, Next Steps
- [ ] All templates have valid frontmatter

**Fail Criteria:**

- Template file missing
- Missing sections
- Invalid frontmatter

---

### TEST-FS-011: Create Planning, Build, Marketing, Networking Templates

**Preconditions:**

- TEST-FS-010 passed

**Implementation Steps:**

1. Create `templates/unified/planning/brief.md`
2. Create `templates/unified/planning/mvp-scope.md`
3. Create `templates/unified/planning/architecture.md`
4. Create `templates/unified/planning/action-plan.md`
5. Create `templates/unified/build/spec.md`
6. Create `templates/unified/build/tasks.md`
7. Create `templates/unified/build/decisions.md`
8. Create `templates/unified/marketing/gtm.md`
9. Create `templates/unified/marketing/pitch.md`
10. Create `templates/unified/marketing/channels.md`
11. Create `templates/unified/marketing/launch-plan.md`
12. Create `templates/unified/networking/contacts.md`
13. Create `templates/unified/networking/collaborators.md`
14. Create `templates/unified/networking/opportunities.md`
15. Create `templates/unified/analysis/redteam.md`
16. Create `templates/unified/analysis/risk-mitigation.md`

**Pass Criteria:**

- [ ] All 16 template files exist
- [ ] brief.md has sections: What's Complete, What's Incomplete, Key Insights, AI Recommendation, Decision
- [ ] mvp-scope.md has sections: Core Features, Nice-to-Have, Out of Scope, Success Criteria
- [ ] architecture.md has sections: System Overview, Components, Data Flow, Technology Stack, Deployment
- [ ] action-plan.md has sections: 30-Day Goals, 60-Day Goals, 90-Day Goals, Dependencies, Milestones
- [ ] gtm.md has sections: Target Market, Channels, Messaging, Timeline, Budget
- [ ] pitch.md has sections: One-Liner, Problem, Solution, Market, Traction, Ask
- [ ] contacts.md has sections: Key Contacts, Domain Experts, Potential Partners, Investors
- [ ] All templates have valid frontmatter

**Fail Criteria:**

- Template file missing
- Missing sections

---

### TEST-FS-012: Create Metadata Templates

**Preconditions:**

- TEST-FS-011 passed

**Implementation Steps:**

1. Create `templates/unified/.metadata/index.json` (empty object template)
2. Create `templates/unified/.metadata/relationships.json` with structure
3. Create `templates/unified/.metadata/priority.json` with default priorities
4. Create `templates/unified/.metadata/timeline.json` with phase deadlines

**Pass Criteria:**

- [ ] All 4 metadata template files exist
- [ ] index.json is valid empty JSON object: `{}`
- [ ] relationships.json has structure: `{ "idea_type": null, "parent": null, "integrates_with": [], "evolved_from": null, "forked_from": null, "branched_from": null, "collaboration": { "contributors": [], "ai_suggested_partners": [] }, "ai_detected": { "competes_with": [], "shares_audience_with": [] } }`
- [ ] priority.json has structure: `{ "always_show": ["README.md", "development.md"], "by_phase": {...}, "recently_updated": [], "ai_recommended": [] }`
- [ ] timeline.json has structure: `{ "current_phase": "SPARK", "phase_started": null, "target_dates": {} }`
- [ ] All JSON files parse without error

**Fail Criteria:**

- JSON parse error
- Missing required fields
- Wrong structure

**Verification Command:**

```bash
for f in templates/unified/.metadata/*.json; do
  echo "=== $f ==="
  cat "$f" | jq .
done
```

---

## Task 4: Idea Type Classification in Orchestrator

### TEST-FS-013: Add Idea Type Question to Session Start

**Preconditions:**

- TEST-FS-012 passed
- Orchestrator functional

**Implementation Steps:**

1. Modify `agents/ideation/orchestrator.ts`
2. Add idea type classification flow at session start
3. Present 5 options: business, feature (internal), feature (external), service, pivot
4. Store selection in session state
5. Handle follow-up questions for parent selection

**Pass Criteria:**

- [ ] When new session starts, agent asks idea type question
- [ ] Question presents all 5 options
- [ ] User selection stored in session state
- [ ] If "feature (internal)" selected, agent asks which existing idea
- [ ] If "feature (external)" selected, agent asks for platform name
- [ ] If "pivot" selected, agent asks which idea is being pivoted
- [ ] Selection persists across session messages
- [ ] Idea type flows through to folder creation

**Fail Criteria:**

- Question not asked at session start
- Selection not stored
- Follow-up questions missing
- Selection lost after first message

**Verification Steps:**

1. Start new ideation session
2. Verify idea type question appears
3. Select option 2 (feature internal)
4. Verify follow-up question lists existing ideas
5. Select existing idea
6. Verify session state contains: ideaType="feature", parentType="internal", parentSlug="[selected]"

---

## Task 5: Relationship Graph

### TEST-FS-014: Store Relationship in Database

**Preconditions:**

- TEST-FS-013 passed
- idea_relationships table exists

**Implementation Steps:**

1. Create `utils/relationship-manager.ts`
2. Implement function: `addRelationship(fromUser, fromIdea, toUser, toIdea, type, metadata): Promise<void>`
3. Implement function: `getRelationships(userSlug, ideaSlug): Promise<Relationship[]>`
4. Implement function: `getChildren(userSlug, ideaSlug): Promise<Idea[]>`
5. Implement function: `getParent(userSlug, ideaSlug): Promise<Idea | null>`

**Pass Criteria:**

- [ ] `addRelationship` inserts row into `idea_relationships` table
- [ ] `getRelationships` returns all relationships for an idea
- [ ] `getChildren` returns ideas where this idea is parent
- [ ] `getParent` returns parent idea if exists, null otherwise
- [ ] Relationships correctly distinguish internal vs external
- [ ] Metadata stored as JSON

**Fail Criteria:**

- Database insert fails
- Queries return wrong results
- JSON metadata corrupted

**Verification Code:**

```typescript
await addRelationship(
  "user1",
  "feature-idea",
  "user1",
  "parent-app",
  "parent",
  {},
);
const parent = await getParent("user1", "feature-idea");
assert(parent?.slug === "parent-app");
```

---

### TEST-FS-015: Sync Relationships to Metadata File

**Preconditions:**

- TEST-FS-014 passed

**Implementation Steps:**

1. Add function: `syncRelationshipsToFile(userSlug, ideaSlug): Promise<void>`
2. Reads relationships from database
3. Writes to `.metadata/relationships.json`
4. Add function: `syncRelationshipsFromFile(userSlug, ideaSlug): Promise<void>`
5. Reads from `.metadata/relationships.json`
6. Updates database

**Pass Criteria:**

- [ ] `syncRelationshipsToFile` creates/updates relationships.json
- [ ] File contains all database relationships
- [ ] `syncRelationshipsFromFile` reads file and updates database
- [ ] Bidirectional sync is idempotent
- [ ] Handles missing file gracefully (creates it)
- [ ] Handles empty relationships

**Fail Criteria:**

- Sync corrupts data
- Missing relationships after sync
- Error on missing file

---

## Summary

| Test ID     | Description                               | Dependencies |
| ----------- | ----------------------------------------- | ------------ |
| TEST-FS-001 | Create idea_relationships table           | None         |
| TEST-FS-002 | Add columns to ideation_sessions          | TEST-FS-001  |
| TEST-FS-003 | Add columns to ideation_artifacts         | TEST-FS-002  |
| TEST-FS-004 | Verify all migrations applied             | TEST-FS-003  |
| TEST-FS-005 | Create users/ directory utility           | TEST-FS-001  |
| TEST-FS-006 | Create draft folder utility               | TEST-FS-005  |
| TEST-FS-007 | Create idea folder with templates         | TEST-FS-006  |
| TEST-FS-008 | Rename draft to idea folder               | TEST-FS-007  |
| TEST-FS-009 | Create core templates                     | TEST-FS-004  |
| TEST-FS-010 | Create research/validation templates      | TEST-FS-009  |
| TEST-FS-011 | Create planning/build/marketing templates | TEST-FS-010  |
| TEST-FS-012 | Create metadata templates                 | TEST-FS-011  |
| TEST-FS-013 | Add idea type question to orchestrator    | TEST-FS-012  |
| TEST-FS-014 | Store relationship in database            | TEST-FS-013  |
| TEST-FS-015 | Sync relationships to metadata file       | TEST-FS-014  |

---

## Execution Command

```bash
# Run the Ralph loop for this spec
python tests/e2e/ralph_loop.py --test-filter "TEST-FS-*"
```
