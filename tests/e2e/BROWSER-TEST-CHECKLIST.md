# Self-Documenting Data Model - Browser Test Checklist

This checklist validates all 5 phases of the self-documenting data model implementation using browser-based testing.

**URLs:**

- Backend API: `http://localhost:3001`
- Frontend: `http://localhost:5173`
- Schema Page: `http://localhost:5173/schema`

---

## Phase 1: Foundation Tests

### P1.1 - Dependencies Installed

**How to verify:** Check `package.json` for these dependencies:

- [ ] `drizzle-orm` is in dependencies
- [ ] `drizzle-zod` is in dependencies
- [ ] `zod-to-json-schema` is in dependencies
- [ ] `drizzle-kit` is in devDependencies

### P1.2 - Directory Structure Created

**How to verify:** Check file system:

- [ ] `schema/` directory exists
- [ ] `schema/entities/` directory exists
- [ ] `schema/enums/` directory exists (if separate from entities)

### P1.3 - Core Schema Files Exist

**How to verify:** Check these files exist:

- [ ] `schema/db.ts` - Database connection
- [ ] `schema/registry.ts` - Entity registry
- [ ] `schema/index.ts` - Main exports

### P1.4 - NPM Scripts Added

**How to verify:** Check `package.json` scripts section:

- [ ] `schema:generate` script exists
- [ ] `schema:migrate` script exists
- [ ] `schema:validate` script exists

---

## Phase 2: Core Entity Migration Tests

### P2.1 - Entity Files Created

**How to verify:** Check `schema/entities/` for these files:

- [ ] `idea.ts` exists
- [ ] `project.ts` exists
- [ ] `task-list.ts` exists
- [ ] `task.ts` exists
- [ ] `task-relationship.ts` exists
- [ ] `prd.ts` exists

### P2.2 - Enums Defined

**How to verify:** Open each entity file and verify enums:

**In `idea.ts`:**

- [ ] `ideaTypes` enum defined
- [ ] `lifecycleStages` enum defined

**In `project.ts`:**

- [ ] `projectStatuses` enum defined

**In `task-list.ts`:**

- [ ] `taskListStatuses` enum defined

**In `task.ts`:**

- [ ] `taskStatuses` enum defined
- [ ] `taskCategories` enum defined
- [ ] `taskPriorities` enum defined
- [ ] `taskEfforts` enum defined
- [ ] `taskOwners` enum defined
- [ ] `taskQueues` enum defined

**In `task-relationship.ts`:**

- [ ] `relationshipTypes` enum defined

**In `prd.ts`:**

- [ ] `prdStatuses` enum defined

---

## Phase 3: Discovery API Tests

**Prerequisites:** Backend must be running at `http://localhost:3001`

### P3.1 - Schema Overview Endpoint

**URL:** `GET http://localhost:3001/api/schema`

**Test steps:**

1. Open browser DevTools Network tab
2. Navigate to the URL or use `fetch()` in console
3. Verify response contains:
   - [ ] `version` (string)
   - [ ] `generatedAt` (timestamp)
   - [ ] `summary.entityCount` (number >= 6)
   - [ ] `summary.enumCount` (number >= 5)
   - [ ] `summary.relationshipCount` (number)
   - [ ] `entities` (array of strings)
   - [ ] `enums` (array of strings)
   - [ ] `endpoints` (object with endpoint descriptions)

### P3.2 - Entities List Endpoint

**URL:** `GET http://localhost:3001/api/schema/entities`

**Test steps:**

1. Fetch the URL
2. Verify response contains `entities` array with:
   - [ ] Entity with key `idea`
   - [ ] Entity with key `project`
   - [ ] Entity with key `task_list`
   - [ ] Entity with key `task`
   - [ ] Entity with key `task_relationship`
   - [ ] Entity with key `prd`

Each entity should have:

- [ ] `key` (string)
- [ ] `name` (string)
- [ ] `table` (string)
- [ ] `description` (string, may be empty)
- [ ] `file` (string, file path)
- [ ] `primaryKey` (string)
- [ ] `foreignKeyCount` (number)

### P3.3 - Single Entity Endpoint

**URL:** `GET http://localhost:3001/api/schema/entities/task`

**Test steps:**

1. Fetch the URL for `task` entity
2. Verify response contains:
   - [ ] `name` equals "task" or "Task"
   - [ ] `table` (string, e.g., "tasks")
   - [ ] `description` (string)
   - [ ] `file` (string, path)
   - [ ] `primaryKey` (string, e.g., "id")
   - [ ] `foreignKeys` (array)
   - [ ] `relationships` (array)
   - [ ] `schemas.select` (JSON Schema object)
   - [ ] `schemas.insert` (JSON Schema object)

### P3.4 - Unknown Entity Returns 404

**URL:** `GET http://localhost:3001/api/schema/entities/nonexistent_xyz`

**Test steps:**

1. Fetch URL with unknown entity name
2. Verify:
   - [ ] HTTP status is 404
   - [ ] Error message indicates entity not found

### P3.5 - Enums List Endpoint

**URL:** `GET http://localhost:3001/api/schema/enums`

**Test steps:**

1. Fetch the URL
2. Verify response contains `enums` array with:
   - [ ] Enum named `ideaTypes`
   - [ ] Enum named `lifecycleStages`
   - [ ] Enum named `projectStatuses`
   - [ ] Enum named `taskStatuses`
   - [ ] Enum named `taskCategories`
   - [ ] Enum named `taskPriorities`
   - [ ] Enum named `taskListStatuses`
   - [ ] Enum named `relationshipTypes`
   - [ ] Enum named `prdStatuses`

Each enum should have:

- [ ] `name` (string)
- [ ] `valueCount` (number)
- [ ] `values` (array of strings)

### P3.6 - Single Enum Endpoint

**URL:** `GET http://localhost:3001/api/schema/enums/taskStatuses`

**Test steps:**

1. Fetch the URL for `taskStatuses`
2. Verify response contains:
   - [ ] `name` equals "taskStatuses"
   - [ ] `values` is an array
   - [ ] Values include: `pending`, `in_progress`, `completed`, `failed`

### P3.7 - Relationships Endpoint

**URL:** `GET http://localhost:3001/api/schema/relationships`

**Test steps:**

1. Fetch the URL
2. Verify response contains:
   - [ ] `relationships` (array of relationship objects)
   - [ ] `graph` (object mapping entity -> connections)
   - [ ] `summary.total` (number)
   - [ ] `summary.oneToOne` (number)
   - [ ] `summary.oneToMany` (number)
   - [ ] `summary.manyToMany` (number)

### P3.8 - Full Schema Dump Endpoint

**URL:** `GET http://localhost:3001/api/schema/full`

**Test steps:**

1. Fetch the URL
2. Verify response contains:
   - [ ] `version` (string)
   - [ ] `generatedAt` (timestamp)
   - [ ] `entities` (object with 6+ entities)
   - [ ] `enums` (object with 5+ enums)
   - [ ] `relationships` (array)

---

## Phase 4: Schema Viewer UI Tests

**Prerequisites:** Frontend must be running at `http://localhost:5173`

### P4.1 - Schema Page Loads

**URL:** `http://localhost:5173/schema`

**Test steps:**

1. Navigate to `/schema`
2. Verify:
   - [ ] Page loads without errors
   - [ ] "Data Model" heading appears
   - [ ] Version number displays (e.g., "v1.0.0")
   - [ ] Stats show in header (X entities, Y enums, Z relationships)
   - [ ] Loading spinner disappears after data loads

### P4.2 - Entity List Component

**Test steps:**

1. On Schema page, look at left panel
2. Verify:
   - [ ] Entity list panel is visible
   - [ ] Shows "Entities (N)" header with count
   - [ ] List includes: idea, project, task_list, task, task_relationship, prd
   - [ ] Each entity shows primary key info
   - [ ] Each entity shows foreign key count (if any)

### P4.3 - Entity Selection

**Test steps:**

1. Click on "task" entity in the list
2. Verify right panel shows:
   - [ ] Entity name "task" in header
   - [ ] Table name (e.g., "tasks")
   - [ ] Primary key indicator
   - [ ] File path shown
   - [ ] "Columns" section present
   - [ ] "Foreign Keys" section present (if any)
   - [ ] "Relationships" section present (if any)

### P4.4 - Column Details Display

**Test steps:**

1. With an entity selected, expand "Columns" section
2. Verify:
   - [ ] Column names are listed
   - [ ] Types are shown with color-coded badges
   - [ ] Primary key column has key icon
   - [ ] Foreign key columns have link icon
   - [ ] Optional fields marked as "(optional)"
   - [ ] Enum columns show "enum[N]" badge

### P4.5 - View Mode Tabs

**Test steps:**

1. Click "Entities" tab → verify entity list shows
2. Click "Enums" tab → verify enum cards show
3. Click "ERD" tab → verify diagram shows

### P4.6 - Enum List Component

**Test steps:**

1. Click "Enums" tab
2. Verify:
   - [ ] Grid of enum cards displays
   - [ ] Each card shows enum name
   - [ ] Each card shows value count badge
   - [ ] Clicking card expands/collapses values
   - [ ] Values are listed with index numbers
   - [ ] "Copy as TypeScript" button works

### P4.7 - ERD Diagram Component

**Test steps:**

1. Click "ERD" tab
2. Verify:
   - [ ] SVG diagram renders
   - [ ] Entity nodes displayed as rectangles
   - [ ] Relationship lines connect nodes
   - [ ] Legend shows relationship types (1:1, 1:N, N:M)
   - [ ] Zoom controls work (zoom in, zoom out, reset)
   - [ ] Hovering a node highlights connected relationships
   - [ ] "Copy Mermaid" button works
   - [ ] "Export SVG" button works

### P4.8 - Search Functionality

**Test steps:**

1. On "Entities" tab, type "task" in search box
2. Verify:
   - [ ] Entity list filters to show matching entities
   - [ ] "task" related entities appear
   - [ ] Non-matching entities hidden

3. On "Enums" tab, type "status" in search box
4. Verify:
   - [ ] Enum list filters to show matching enums
   - [ ] Status-related enums highlighted

### P4.9 - Export Button

**Test steps:**

1. Click "Export" button in header
2. Verify:
   - [ ] JSON file downloads
   - [ ] File named `schema-{version}.json`
   - [ ] File contains full schema data

### P4.10 - Refresh Button

**Test steps:**

1. Click refresh button (circular arrow icon)
2. Verify:
   - [ ] Loading state briefly appears
   - [ ] Data reloads
   - [ ] No errors

### P4.11 - Copy API Endpoint

**Test steps:**

1. Select an entity
2. Click "API" button in entity detail header
3. Verify:
   - [ ] Button shows checkmark briefly
   - [ ] Clipboard contains API URL

### P4.12 - Collapsible Sections

**Test steps:**

1. In entity detail, click section headers:
   - [ ] "Columns" toggles expand/collapse
   - [ ] "Foreign Keys" toggles expand/collapse
   - [ ] "Relationships" toggles expand/collapse
   - [ ] "Insert Schema" toggles expand/collapse

### P4.13 - Navigation Link

**Test steps:**

1. From any page, check sidebar/navigation
2. Verify:
   - [ ] "Schema" or "Data Model" link exists
   - [ ] Link navigates to `/schema`

### P4.14 - Error Handling

**Test steps:**

1. Stop the backend server
2. Refresh the Schema page
3. Verify:
   - [ ] Error message displays
   - [ ] Retry button appears
   - [ ] Clicking Retry attempts to reload

### P4.15 - Mobile Responsiveness

**Test steps:**

1. Resize browser to mobile width (~375px)
2. Verify:
   - [ ] Layout adapts (single column)
   - [ ] Navigation still accessible
   - [ ] All functionality works

---

## Phase 5: Backwards Compatibility Tests

### P5.1 - Migration Helper Script

**How to verify:** Check file exists:

- [ ] `scripts/migrate-types-to-schema.ts` exists
- [ ] Script can be run: `npx tsx scripts/migrate-types-to-schema.ts --help`

### P5.2 - Old Imports Still Work

**How to verify:** Check that existing code in `types/` still works:

- [ ] TypeScript compilation passes: `npx tsc --noEmit`
- [ ] No import errors in server code
- [ ] No import errors in frontend code

### P5.3 - New Imports Available

**How to verify:** Check that new imports from `@/schema` work:

```typescript
// This should compile without errors:
import { Task, NewTask, insertTaskSchema } from "@/schema";
```

### P5.4 - Schema Validation Script

**How to verify:**

- [ ] `npx tsx scripts/validate-schema.ts` runs successfully
- [ ] Reports any schema inconsistencies
- [ ] Exit code 0 if valid

---

## Quick API Test Commands

Copy these to browser console to test API endpoints:

```javascript
// Test schema overview
fetch("/api/schema")
  .then((r) => r.json())
  .then(console.log);

// Test entities list
fetch("/api/schema/entities")
  .then((r) => r.json())
  .then(console.log);

// Test single entity
fetch("/api/schema/entities/task")
  .then((r) => r.json())
  .then(console.log);

// Test enums list
fetch("/api/schema/enums")
  .then((r) => r.json())
  .then(console.log);

// Test single enum
fetch("/api/schema/enums/taskStatuses")
  .then((r) => r.json())
  .then(console.log);

// Test relationships
fetch("/api/schema/relationships")
  .then((r) => r.json())
  .then(console.log);

// Test full schema
fetch("/api/schema/full")
  .then((r) => r.json())
  .then(console.log);

// Test 404
fetch("/api/schema/entities/nonexistent").then((r) =>
  console.log("Status:", r.status),
);
```

---

## Test Execution Log

| Phase | Test ID | Result | Notes |
| ----- | ------- | ------ | ----- |
| 1     | P1.1    | [ ]    |       |
| 1     | P1.2    | [ ]    |       |
| 1     | P1.3    | [ ]    |       |
| 1     | P1.4    | [ ]    |       |
| 2     | P2.1    | [ ]    |       |
| 2     | P2.2    | [ ]    |       |
| 3     | P3.1    | [ ]    |       |
| 3     | P3.2    | [ ]    |       |
| 3     | P3.3    | [ ]    |       |
| 3     | P3.4    | [ ]    |       |
| 3     | P3.5    | [ ]    |       |
| 3     | P3.6    | [ ]    |       |
| 3     | P3.7    | [ ]    |       |
| 3     | P3.8    | [ ]    |       |
| 4     | P4.1    | [ ]    |       |
| 4     | P4.2    | [ ]    |       |
| 4     | P4.3    | [ ]    |       |
| 4     | P4.4    | [ ]    |       |
| 4     | P4.5    | [ ]    |       |
| 4     | P4.6    | [ ]    |       |
| 4     | P4.7    | [ ]    |       |
| 4     | P4.8    | [ ]    |       |
| 4     | P4.9    | [ ]    |       |
| 4     | P4.10   | [ ]    |       |
| 4     | P4.11   | [ ]    |       |
| 4     | P4.12   | [ ]    |       |
| 4     | P4.13   | [ ]    |       |
| 4     | P4.14   | [ ]    |       |
| 4     | P4.15   | [ ]    |       |
| 5     | P5.1    | [ ]    |       |
| 5     | P5.2    | [ ]    |       |
| 5     | P5.3    | [ ]    |       |
| 5     | P5.4    | [ ]    |       |

---

**Total Tests:** 31
**Date Tested:** **\*\***\_\_\_**\*\***
**Tested By:** **\*\***\_\_\_**\*\***
**Overall Result:** **\*\***\_\_\_**\*\***
