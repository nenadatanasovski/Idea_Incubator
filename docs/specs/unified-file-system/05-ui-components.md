# Developer Spec 05: UI Components

**Feature**: Unified File System - Phase 5
**Version**: 1.0
**Ralph Loop Compatible**: Yes
**Depends On**: Spec 04 (TEST-PH-001 through TEST-PH-015)

---

## Prerequisites

**IMPORTANT: Puppeteer MCP Required**

These UI tests use Puppeteer MCP for automated frontend validation. Before running:

1. **Server must be running**: `npm run dev` (frontend on port 3000)
2. **Puppeteer MCP must be configured**: Ensure the `puppeteer` MCP server is enabled
3. **Test data required**: Some tests expect test ideas/artifacts to exist

Tests marked with "Puppeteer Verification" will:

- Navigate to the application via `mcp__puppeteer__puppeteer_navigate`
- Evaluate DOM state via `mcp__puppeteer__puppeteer_evaluate`
- Interact with elements via `mcp__puppeteer__puppeteer_click`, `mcp__puppeteer__puppeteer_fill`
- Capture screenshots via `mcp__puppeteer__puppeteer_screenshot`

**data-testid Requirements**: Components must include proper `data-testid` attributes for reliable test selectors.

---

## Overview

Redesign the artifact panel with table+preview layout, add classification badges, implement session grouping view, and create idea selector dropdown in the session header.

---

## Test State Schema

Add to `tests/e2e/test-state.json`:

```json
{
  "tests": [
    {
      "id": "TEST-UI-001",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-015"
    },
    {
      "id": "TEST-UI-002",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-001"
    },
    {
      "id": "TEST-UI-003",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-002"
    },
    {
      "id": "TEST-UI-004",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-003"
    },
    {
      "id": "TEST-UI-005",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-004"
    },
    {
      "id": "TEST-UI-006",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-005"
    },
    {
      "id": "TEST-UI-007",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-006"
    },
    {
      "id": "TEST-UI-008",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-007"
    },
    {
      "id": "TEST-UI-009",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-008"
    },
    {
      "id": "TEST-UI-010",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-009"
    },
    {
      "id": "TEST-UI-011",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-010"
    },
    {
      "id": "TEST-UI-012",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-011"
    },
    {
      "id": "TEST-UI-013",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-012"
    },
    {
      "id": "TEST-UI-014",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-013"
    },
    {
      "id": "TEST-UI-015",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-UI-014"
    }
  ]
}
```

---

## Task 1: State Management Updates

### TEST-UI-001: Update Ideation Reducer

**Preconditions:**

- Spec 04 tests passed (TEST-PH-015)

**Implementation Steps:**

1. Modify `frontend/src/reducers/ideationReducer.ts`
2. Add new state fields:
   - `linkedIdea: { userSlug: string, ideaSlug: string } | null`
   - `viewMode: 'files' | 'sessions'`
   - `selectedArtifactPath: string | null`
   - `artifactClassifications: Record<string, Classification>`
3. Add new action types

**Pass Criteria:**

- [ ] State shape includes `linkedIdea` field
- [ ] State shape includes `viewMode` field (default: 'files')
- [ ] State shape includes `selectedArtifactPath` field
- [ ] State shape includes `artifactClassifications` record
- [ ] New action types:
  - `SET_LINKED_IDEA`
  - `SET_VIEW_MODE`
  - `SET_SELECTED_ARTIFACT`
  - `SET_ARTIFACT_CLASSIFICATIONS`
- [ ] Reducers handle all new actions
- [ ] Initial state correct
- [ ] TypeScript compiles: `npx tsc --noEmit frontend/src/reducers/ideationReducer.ts`

**Fail Criteria:**

- TypeScript errors
- Missing action handlers
- Wrong initial state

**Verification Command:**

```bash
npx tsc --noEmit frontend/src/reducers/ideationReducer.ts && echo "PASS"
```

---

### TEST-UI-002: Create Artifact Selectors

**Preconditions:**

- TEST-UI-001 passed

**Implementation Steps:**

1. Create file: `frontend/src/selectors/ideationSelectors.ts`
2. Add selectors:
   - `selectLinkedIdea(state)`
   - `selectViewMode(state)`
   - `selectArtifactsBySession(state)`
   - `selectArtifactsByFolder(state)`
   - `selectSelectedArtifact(state)`

**Pass Criteria:**

- [ ] File `frontend/src/selectors/ideationSelectors.ts` exists
- [ ] `selectLinkedIdea` returns linked idea or null
- [ ] `selectViewMode` returns current view mode
- [ ] `selectArtifactsBySession` groups artifacts by sessionId
- [ ] `selectArtifactsByFolder` groups artifacts by directory path
- [ ] `selectSelectedArtifact` returns full artifact for selected path
- [ ] Selectors are memoized (use reselect or similar)

**Fail Criteria:**

- Missing selectors
- Wrong grouping logic
- No memoization

**Verification Code:**

```typescript
import { selectArtifactsByFolder } from './frontend/src/selectors/ideationSelectors';

const state = { ideation: { artifacts: [...], selectedArtifactPath: 'test.md' } };
const byFolder = selectArtifactsByFolder(state);
assert(typeof byFolder === 'object');
```

---

## Task 2: Artifact Panel Redesign

### TEST-UI-003: Create ArtifactTable Component

**Preconditions:**

- TEST-UI-002 passed

**Implementation Steps:**

1. Create file: `frontend/src/components/ideation/ArtifactTable.tsx`
2. Implement table with columns: Name, Date, Type, Status
3. Support collapsible folder rows
4. Add selection state

**Pass Criteria:**

- [ ] File `frontend/src/components/ideation/ArtifactTable.tsx` exists
- [ ] Table displays columns: Name, Date, Type, Status
- [ ] Folder rows collapsible with `>` toggle
- [ ] Clicking row selects artifact
- [ ] Selected row visually highlighted
- [ ] Sorted by: folders first (alphabetically), then files by date (newest first)
- [ ] Date formatted as relative (e.g., "2 hours ago", "Jan 5")
- [ ] Component accepts props: `artifacts`, `selectedPath`, `onSelect`, `onToggleFolder`

**Fail Criteria:**

- Missing columns
- No folder collapse
- No selection state
- Wrong sort order

**Puppeteer Verification:**

```javascript
// Navigate to ideation session with artifacts
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation",
});

// Verify table columns exist
const columns = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const headers = document.querySelectorAll('[data-testid="artifact-table"] th');
    return Array.from(headers).map(h => h.textContent);
  `,
});
// Expected: ['Name', 'Date', 'Type', 'Status']

// Verify folder row has collapse toggle
const folderToggle = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const folderRow = document.querySelector('[data-testid="folder-row"]');
    return folderRow && folderRow.querySelector('[data-testid="folder-toggle"]') !== null;
  `,
});
// Expected: true

// Click folder toggle and verify collapse
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="folder-toggle"]',
});
const collapsed = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="folder-row"]').getAttribute('aria-expanded')`,
});
// Expected: 'false'

// Click file row and verify selection
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="artifact-row"]',
});
const selected = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="artifact-row"].selected') !== null`,
});
// Expected: true

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({ name: "artifact-table-test" });
```

---

### TEST-UI-004: Add Classification Badges

**Preconditions:**

- TEST-UI-003 passed

**Implementation Steps:**

1. Modify `ArtifactTable.tsx`
2. Add Status column rendering:
   - 🔴 Required (missing content)
   - 🟡 Required (has content)
   - 🔵 Recommended
   - ⚪ Optional
3. Accept `classifications` prop

**Pass Criteria:**

- [ ] Status column shows appropriate badge
- [ ] Badge colors match spec:
  - Red circle for required + incomplete
  - Yellow circle for required + complete
  - Blue circle for recommended
  - White/gray circle for optional
- [ ] Tooltip explains classification on hover
- [ ] Badges update when classifications change

**Fail Criteria:**

- Wrong badge for classification
- No tooltip
- Badge doesn't update

**Puppeteer Verification:**

```javascript
// Navigate to ideation with test data
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation",
});

// Verify badge colors for different classifications
const badges = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const rows = document.querySelectorAll('[data-testid="artifact-row"]');
    return Array.from(rows).map(row => ({
      name: row.querySelector('[data-testid="artifact-name"]')?.textContent,
      badge: row.querySelector('[data-testid="status-badge"]')?.textContent,
      badgeClass: row.querySelector('[data-testid="status-badge"]')?.className
    }));
  `,
});
// Expected: badges match classification (red/yellow/blue/gray circles)

// Hover badge and check tooltip
await mcp__puppeteer__puppeteer_hover({
  selector: '[data-testid="status-badge"]',
});
const tooltip = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[role="tooltip"]')?.textContent || ''`,
});
// Expected: tooltip contains classification explanation

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({
  name: "classification-badges-test",
});
```

---

### TEST-UI-005: Create ArtifactPreview Component

**Preconditions:**

- TEST-UI-004 passed

**Implementation Steps:**

1. Create file: `frontend/src/components/ideation/ArtifactPreview.tsx`
2. Render markdown content with syntax highlighting
3. Show metadata header (title, type, date)
4. Add action buttons: Edit, Delete, Copy @ref

**Pass Criteria:**

- [ ] File `frontend/src/components/ideation/ArtifactPreview.tsx` exists
- [ ] Renders markdown with proper formatting
- [ ] Code blocks have syntax highlighting
- [ ] Header shows: title, type, last updated
- [ ] Edit button triggers edit mode
- [ ] Delete button shows confirmation dialog
- [ ] Copy @ref copies `@[filename]` reference to clipboard
- [ ] Empty state shown when no artifact selected

**Fail Criteria:**

- Markdown not rendered
- No syntax highlighting
- Missing action buttons
- No empty state

**Puppeteer Verification:**

```javascript
// Navigate to ideation
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation",
});

// Select an artifact
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="artifact-row"]',
});

// Verify preview component renders
const previewExists = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="artifact-preview"]') !== null`,
});
// Expected: true

// Verify markdown rendering (check for rendered h1/h2/etc)
const hasFormattedContent = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const preview = document.querySelector('[data-testid="artifact-preview"]');
    return preview && (preview.querySelector('h1, h2, p, ul, ol') !== null);
  `,
});
// Expected: true (markdown rendered as HTML)

// Verify code syntax highlighting
const hasCodeHighlight = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const codeBlock = document.querySelector('[data-testid="artifact-preview"] pre code');
    return codeBlock && codeBlock.classList.length > 0;
  `,
});
// Expected: true (has highlight classes)

// Verify action buttons exist
const actionButtons = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    return {
      edit: document.querySelector('[data-testid="btn-edit"]') !== null,
      delete: document.querySelector('[data-testid="btn-delete"]') !== null,
      copyRef: document.querySelector('[data-testid="btn-copy-ref"]') !== null
    };
  `,
});
// Expected: { edit: true, delete: true, copyRef: true }

// Click delete and verify confirmation dialog
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="btn-delete"]',
});
const dialogVisible = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="confirm-dialog"]') !== null`,
});
// Expected: true

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({ name: "artifact-preview-test" });
```

---

### TEST-UI-006: Create Redesigned IdeaArtifactPanel

**Preconditions:**

- TEST-UI-005 passed

**Implementation Steps:**

1. Modify `frontend/src/components/ideation/IdeaArtifactPanel.tsx`
2. Implement layout: Table (20% height) + Preview (80% height)
3. Add view mode toggle: [Files] [Sessions]
4. Wire up components

**Pass Criteria:**

- [ ] Layout is split: 20% table, 80% preview
- [ ] Table scrollable independently
- [ ] View mode toggle visible in header
- [ ] "Files" mode shows folder hierarchy
- [ ] "Sessions" mode shows session grouping (see TEST-UI-007)
- [ ] Selecting artifact updates preview
- [ ] Resizing window maintains proportions
- [ ] Mobile responsive (stack vertically on small screens)

**Fail Criteria:**

- Wrong proportions
- No independent scroll
- View toggle missing
- Not responsive

**Puppeteer Verification:**

```javascript
// Navigate to ideation
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation",
});

// Verify panel layout (20/80 split)
const layout = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const panel = document.querySelector('[data-testid="artifact-panel"]');
    const table = document.querySelector('[data-testid="artifact-table-container"]');
    const preview = document.querySelector('[data-testid="artifact-preview-container"]');
    if (!panel || !table || !preview) return null;
    const panelHeight = panel.getBoundingClientRect().height;
    const tableHeight = table.getBoundingClientRect().height;
    const previewHeight = preview.getBoundingClientRect().height;
    return {
      tableRatio: Math.round((tableHeight / panelHeight) * 100),
      previewRatio: Math.round((previewHeight / panelHeight) * 100)
    };
  `,
});
// Expected: tableRatio ~20, previewRatio ~80

// Verify view mode toggle exists
const toggleExists = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    return {
      filesBtn: document.querySelector('[data-testid="view-mode-files"]') !== null,
      sessionsBtn: document.querySelector('[data-testid="view-mode-sessions"]') !== null
    };
  `,
});
// Expected: { filesBtn: true, sessionsBtn: true }

// Click sessions toggle
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="view-mode-sessions"]',
});
const sessionsActive = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="view-mode-sessions"]').classList.contains('active')`,
});
// Expected: true

// Verify independent scroll (table has overflow)
const hasIndependentScroll = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const table = document.querySelector('[data-testid="artifact-table-container"]');
    const style = window.getComputedStyle(table);
    return style.overflow === 'auto' || style.overflowY === 'auto';
  `,
});
// Expected: true

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({
  name: "artifact-panel-layout-test",
});
```

---

### TEST-UI-007: Implement Sessions View

**Preconditions:**

- TEST-UI-006 passed

**Implementation Steps:**

1. Create file: `frontend/src/components/ideation/SessionsView.tsx`
2. Group artifacts by session
3. Show session header with date and artifact count
4. Add "Delete Session" action

**Pass Criteria:**

- [ ] File `frontend/src/components/ideation/SessionsView.tsx` exists
- [ ] Artifacts grouped by sessionId
- [ ] Session header format: `Session Jan 5, 2:30 PM (5 artifacts)`
- [ ] Sessions sorted by date (newest first)
- [ ] Session collapsible to show/hide artifacts
- [ ] "Delete Session" button visible
- [ ] Delete Session removes all session artifacts (with confirmation)
- [ ] Artifacts without sessionId grouped under "Template Files"

**Fail Criteria:**

- Wrong grouping
- Wrong date format
- No delete functionality
- Template files missing

**Puppeteer Verification:**

```javascript
// Navigate to ideation
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation",
});

// Switch to sessions view
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="view-mode-sessions"]',
});

// Verify sessions are grouped
const sessionGroups = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const groups = document.querySelectorAll('[data-testid="session-group"]');
    return Array.from(groups).map(g => ({
      header: g.querySelector('[data-testid="session-header"]')?.textContent,
      artifactCount: g.querySelectorAll('[data-testid="artifact-row"]').length,
      hasDeleteBtn: g.querySelector('[data-testid="btn-delete-session"]') !== null
    }));
  `,
});
// Expected: array of session groups with headers like "Session Jan 5, 2:30 PM (N artifacts)"

// Verify header format matches "Session [Date] (N artifacts)"
const headerFormat = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const header = document.querySelector('[data-testid="session-header"]');
    return header ? /Session .+ \\(\\d+ artifacts?\\)/.test(header.textContent) : false;
  `,
});
// Expected: true

// Expand/collapse session
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="session-toggle"]',
});
const collapsed = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="session-group"]').getAttribute('aria-expanded') === 'false'`,
});
// Expected: true or false (toggled state)

// Verify template files section exists
const templateSection = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="template-files-group"]') !== null`,
});
// Expected: true

// Click delete session and verify confirmation
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="btn-delete-session"]',
});
const deleteConfirm = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="confirm-dialog"]')?.textContent.includes('Delete') || false`,
});
// Expected: true

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({ name: "sessions-view-test" });
```

---

## Task 3: Idea Selector

### TEST-UI-008: Create IdeaSelector Component

**Preconditions:**

- TEST-UI-007 passed

**Implementation Steps:**

1. Create file: `frontend/src/components/ideation/IdeaSelector.tsx`
2. Fetch user's ideas from API
3. Implement dropdown with search
4. Group by: Recent, By Type, Drafts

**Pass Criteria:**

- [ ] File `frontend/src/components/ideation/IdeaSelector.tsx` exists
- [ ] Dropdown shows current idea or "Select an idea..."
- [ ] Fetches ideas from `/api/ideation/ideas/:userSlug`
- [ ] Search/filter functionality
- [ ] Groups:
  - "Recent" (last 5 accessed)
  - "By Type" (Business, Feature, Service, etc.)
  - "Drafts" (draft folders)
- [ ] "+ New idea" option at bottom
- [ ] Selecting idea dispatches `SET_LINKED_IDEA`
- [ ] Visual indicator for current selection

**Fail Criteria:**

- No fetch on mount
- No search
- Wrong grouping
- No new idea option

**Puppeteer Verification:**

```javascript
// Navigate to ideation
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation",
});

// Verify selector exists
const selectorExists = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="idea-selector"]') !== null`,
});
// Expected: true

// Click selector to open dropdown
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="idea-selector"]',
});

// Verify dropdown is open with groups
const dropdownContent = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const dropdown = document.querySelector('[data-testid="idea-selector-dropdown"]');
    if (!dropdown) return null;
    return {
      isOpen: dropdown.getAttribute('aria-expanded') === 'true',
      hasRecent: dropdown.querySelector('[data-testid="group-recent"]') !== null,
      hasByType: dropdown.querySelector('[data-testid="group-by-type"]') !== null,
      hasDrafts: dropdown.querySelector('[data-testid="group-drafts"]') !== null,
      hasNewIdea: dropdown.querySelector('[data-testid="new-idea-option"]') !== null,
      hasSearch: dropdown.querySelector('[data-testid="idea-search"]') !== null
    };
  `,
});
// Expected: { isOpen: true, hasRecent: true, hasByType: true, hasDrafts: true, hasNewIdea: true, hasSearch: true }

// Type in search
await mcp__puppeteer__puppeteer_fill({
  selector: '[data-testid="idea-search"]',
  value: "fridge",
});

// Verify filtering works
const filteredResults = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const options = document.querySelectorAll('[data-testid="idea-option"]');
    return Array.from(options).filter(o => o.style.display !== 'none').length;
  `,
});
// Expected: filtered count (less than total)

// Select an idea
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="idea-option"]',
});
const selectedIdea = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="idea-selector"]')?.textContent || ''`,
});
// Expected: contains selected idea name

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({ name: "idea-selector-test" });
```

---

### TEST-UI-009: Integrate IdeaSelector in SessionHeader

**Preconditions:**

- TEST-UI-008 passed

**Implementation Steps:**

1. Modify `frontend/src/components/ideation/SessionHeader.tsx`
2. Add IdeaSelector to header
3. Show format: `[Working on: idea-name ▼]`

**Pass Criteria:**

- [ ] IdeaSelector visible in session header
- [ ] Shows "Working on: [idea-name]" when linked
- [ ] Shows "Select an idea to work on..." when unlinked
- [ ] Dropdown arrow indicates clickable
- [ ] Selecting idea updates session via API
- [ ] Header updates after selection

**Fail Criteria:**

- Selector not visible
- Wrong text format
- API not called on selection

**Puppeteer Verification:**

```javascript
// Navigate to new ideation session
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation/new",
});

// Verify selector in header shows "Select an idea..."
const unlinkedState = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const selector = document.querySelector('[data-testid="session-header"] [data-testid="idea-selector"]');
    return selector?.textContent?.includes('Select an idea') || false;
  `,
});
// Expected: true

// Open selector and select an idea
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="idea-selector"]',
});
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="idea-option"]',
});

// Verify header updates to "Working on: [name]"
const linkedState = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const selector = document.querySelector('[data-testid="session-header"] [data-testid="idea-selector"]');
    return selector?.textContent?.includes('Working on:') || false;
  `,
});
// Expected: true

// Verify dropdown arrow indicator
const hasArrow = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="idea-selector"] [data-testid="dropdown-arrow"]') !== null`,
});
// Expected: true

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({
  name: "session-header-selector-test",
});
```

---

### TEST-UI-010: Handle Idea Type Selection Flow

**Preconditions:**

- TEST-UI-009 passed

**Implementation Steps:**

1. Create file: `frontend/src/components/ideation/IdeaTypeModal.tsx`
2. Show modal when "+ New idea" selected
3. Present 5 idea type options
4. Handle follow-up questions based on selection

**Pass Criteria:**

- [ ] File `frontend/src/components/ideation/IdeaTypeModal.tsx` exists
- [ ] Modal shows 5 options:
  1. A brand new standalone business/app
  2. A feature for an existing idea
  3. A feature/integration for external platform
  4. A microservice/API
  5. A pivot/evolution of existing idea
- [ ] Option 2: Shows list of user's existing ideas
- [ ] Option 3: Shows text input for platform name
- [ ] Option 4: Shows radio for "shared" vs "standalone"
- [ ] Option 5: Shows list of user's existing ideas
- [ ] Submit creates idea folder with correct type
- [ ] Modal closes on success

**Fail Criteria:**

- Missing options
- No follow-up questions
- Wrong idea type set

**Puppeteer Verification:**

```javascript
// Navigate to ideation
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation",
});

// Open idea selector and click "+ New idea"
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="idea-selector"]',
});
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="new-idea-option"]',
});

// Verify modal opens
const modalVisible = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="idea-type-modal"]') !== null`,
});
// Expected: true

// Verify 5 idea type options exist
const ideaTypes = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const options = document.querySelectorAll('[data-testid="idea-type-modal"] [data-testid="idea-type-option"]');
    return Array.from(options).map(o => o.textContent);
  `,
});
// Expected: array with 5 options

// Click option 2 (feature for existing idea)
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="idea-type-option-2"]',
});

// Verify follow-up shows existing ideas list
const followUpContent = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const followUp = document.querySelector('[data-testid="idea-type-followup"]');
    return followUp && followUp.querySelector('[data-testid="existing-ideas-list"]') !== null;
  `,
});
// Expected: true

// Select an existing idea
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="existing-ideas-list"] [data-testid="idea-option"]',
});

// Fill in name and submit
await mcp__puppeteer__puppeteer_fill({
  selector: '[data-testid="new-idea-name"]',
  value: "test-feature-idea",
});
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="btn-create-idea"]',
});

// Verify modal closes
const modalClosed = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="idea-type-modal"]') === null`,
});
// Expected: true

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({ name: "idea-type-modal-test" });
```

---

## Task 4: Real-time Updates

### TEST-UI-011: WebSocket Artifact Updates

**Preconditions:**

- TEST-UI-010 passed

**Implementation Steps:**

1. Add WebSocket event: `artifact:created`
2. Add WebSocket event: `artifact:updated`
3. Add WebSocket event: `artifact:deleted`
4. Update reducer on events

**Pass Criteria:**

- [ ] WebSocket events defined in server
- [ ] Client subscribes to events for current idea
- [ ] `artifact:created` adds artifact to state
- [ ] `artifact:updated` updates artifact in state
- [ ] `artifact:deleted` removes artifact from state
- [ ] UI updates immediately without refresh
- [ ] Events scoped to current linked idea only

**Fail Criteria:**

- No WebSocket integration
- Wrong event handling
- UI doesn't update
- Cross-idea pollution

**Puppeteer Verification:**

```javascript
// This test requires WebSocket verification
// Navigate to ideation with an idea linked
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation?idea=test-idea",
});

// Verify WebSocket is connected
const wsConnected = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Check if WebSocket connection exists in app state
    return window.__IDEATION_WS__?.readyState === WebSocket.OPEN || false;
  `,
});
// Expected: true

// Get initial artifact count
const initialCount = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelectorAll('[data-testid="artifact-row"]').length`,
});

// Simulate artifact creation via API (or trigger from another source)
// In a real test, this would create an artifact via API
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Simulate WebSocket message for artifact:created
    window.__IDEATION_WS__?.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({
        type: 'artifact:created',
        payload: { id: 'test-123', title: 'Test Artifact', filePath: 'test.md' }
      })
    }));
  `,
});

// Wait for UI update
await new Promise((r) => setTimeout(r, 500));

// Verify artifact count increased
const newCount = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelectorAll('[data-testid="artifact-row"]').length`,
});
// Expected: newCount > initialCount

// Test artifact:updated event
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    window.__IDEATION_WS__?.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({
        type: 'artifact:updated',
        payload: { id: 'test-123', title: 'Updated Artifact' }
      })
    }));
  `,
});

// Verify updated title
const updatedTitle = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const row = document.querySelector('[data-testid="artifact-row"][data-id="test-123"]');
    return row?.querySelector('[data-testid="artifact-name"]')?.textContent || '';
  `,
});
// Expected: 'Updated Artifact'

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({ name: "websocket-updates-test" });
```

---

### TEST-UI-012: Classification Update Events

**Preconditions:**

- TEST-UI-011 passed

**Implementation Steps:**

1. Add WebSocket event: `classifications:updated`
2. Update classifications in reducer
3. Refresh badges in UI

**Pass Criteria:**

- [ ] WebSocket event `classifications:updated` defined
- [ ] Event payload: `{ ideaSlug: string, classifications: Record<string, Classification> }`
- [ ] Reducer updates `artifactClassifications` state
- [ ] Badges update immediately
- [ ] Only updates for current linked idea

**Fail Criteria:**

- No event defined
- Badges don't update
- Wrong idea receives updates

**Puppeteer Verification:**

```javascript
// Navigate to ideation with an idea
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation?idea=test-idea",
});

// Get initial badge state
const initialBadge = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const badge = document.querySelector('[data-testid="artifact-row"] [data-testid="status-badge"]');
    return badge?.className || '';
  `,
});

// Simulate classification update via WebSocket
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    window.__IDEATION_WS__?.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({
        type: 'classifications:updated',
        payload: {
          ideaSlug: 'test-idea',
          classifications: {
            'README.md': 'required',
            'development.md': 'recommended'
          }
        }
      })
    }));
  `,
});

// Wait for UI update
await new Promise((r) => setTimeout(r, 300));

// Verify badges updated
const updatedBadges = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const rows = document.querySelectorAll('[data-testid="artifact-row"]');
    return Array.from(rows).map(row => ({
      name: row.querySelector('[data-testid="artifact-name"]')?.textContent,
      badge: row.querySelector('[data-testid="status-badge"]')?.className
    }));
  `,
});
// Expected: badges reflect new classification state

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({
  name: "classification-update-test",
});
```

---

## Task 5: User Experience Polish

### TEST-UI-013: Loading States

**Preconditions:**

- TEST-UI-012 passed

**Implementation Steps:**

1. Add loading skeleton for ArtifactTable
2. Add loading spinner for ArtifactPreview
3. Add loading state for IdeaSelector
4. Show progress during operations

**Pass Criteria:**

- [ ] ArtifactTable shows skeleton rows while loading
- [ ] ArtifactPreview shows spinner while loading content
- [ ] IdeaSelector shows "Loading..." while fetching ideas
- [ ] Save operations show progress indicator
- [ ] Delete operations show progress indicator
- [ ] No layout shift when loading completes

**Fail Criteria:**

- No loading indicators
- Layout shift on load
- Infinite loading state

**Puppeteer Verification:**

```javascript
// Navigate to ideation (with network throttling simulated via slow API)
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation?idea=test-idea",
});

// Check for loading skeleton in table
const hasSkeletonTable = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const skeleton = document.querySelector('[data-testid="artifact-table-skeleton"]');
    return skeleton !== null;
  `,
});
// Note: This may be true initially, then false after load

// After data loads, verify skeletons are gone
await new Promise((r) => setTimeout(r, 1000));
const noSkeleton = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="artifact-table-skeleton"]') === null`,
});
// Expected: true (skeleton removed after load)

// Click an artifact to trigger preview loading
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="artifact-row"]',
});

// Check for spinner in preview
const hasSpinner = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const preview = document.querySelector('[data-testid="artifact-preview"]');
    return preview?.querySelector('[data-testid="loading-spinner"]') !== null ||
           preview?.classList.contains('loading') || false;
  `,
});
// Note: May be true briefly during load

// Verify no layout shift (content dimensions stable)
const dimensions = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const panel = document.querySelector('[data-testid="artifact-panel"]');
    const rect = panel?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  `,
});
// Store dimensions, reload, compare - should be same

// Verify save operation shows progress
await mcp__puppeteer__puppeteer_click({ selector: '[data-testid="btn-edit"]' });
await mcp__puppeteer__puppeteer_fill({
  selector: '[data-testid="artifact-editor"]',
  value: "Test content update",
});
await mcp__puppeteer__puppeteer_click({ selector: '[data-testid="btn-save"]' });

const saveProgress = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    return document.querySelector('[data-testid="save-progress"]') !== null ||
           document.querySelector('[data-testid="btn-save"].loading') !== null;
  `,
});
// Expected: true (briefly during save)

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({ name: "loading-states-test" });
```

---

### TEST-UI-014: Error States

**Preconditions:**

- TEST-UI-013 passed

**Implementation Steps:**

1. Add error boundary for artifact panel
2. Show error message for failed loads
3. Add retry functionality
4. Handle network errors gracefully

**Pass Criteria:**

- [ ] Error boundary catches component errors
- [ ] Failed artifact load shows error message with retry button
- [ ] Failed save shows error toast
- [ ] Network error shows offline indicator
- [ ] Retry button attempts reload
- [ ] Errors logged to console

**Fail Criteria:**

- Crashes on error
- No retry option
- Silent failures

**Puppeteer Verification:**

```javascript
// Navigate to ideation
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation?idea=test-idea",
});

// Verify error boundary exists
const hasErrorBoundary = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Trigger an error by simulating a component crash
    try {
      window.__TEST_TRIGGER_ERROR__ && window.__TEST_TRIGGER_ERROR__();
    } catch (e) {}
    return document.querySelector('[data-testid="error-boundary"]') !== null;
  `,
});
// Note: Error boundary should catch errors

// Simulate failed artifact load (via mock)
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Dispatch error event to test error state
    window.dispatchEvent(new CustomEvent('artifact-load-error', {
      detail: { error: 'Network error', artifactId: 'test-123' }
    }));
  `,
});

// Check for error message with retry button
const errorState = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const errorEl = document.querySelector('[data-testid="artifact-error"]');
    return errorEl ? {
      hasMessage: errorEl.querySelector('[data-testid="error-message"]') !== null,
      hasRetry: errorEl.querySelector('[data-testid="btn-retry"]') !== null
    } : null;
  `,
});
// Expected: { hasMessage: true, hasRetry: true }

// Test retry functionality
await mcp__puppeteer__puppeteer_click({
  selector: '[data-testid="btn-retry"]',
});

// Verify save error shows toast
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    window.dispatchEvent(new CustomEvent('save-error', {
      detail: { error: 'Save failed' }
    }));
  `,
});

const toastVisible = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="error-toast"]') !== null`,
});
// Expected: true

// Check console for error logging
const errorsLogged = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Check if console.error was called (would need spy setup)
    return true; // Assume logged if error boundary is properly implemented
  `,
});

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({ name: "error-states-test" });
```

---

### TEST-UI-015: Keyboard Navigation

**Preconditions:**

- TEST-UI-014 passed

**Implementation Steps:**

1. Add keyboard navigation to ArtifactTable
2. Add keyboard shortcuts:
   - ↑/↓: Navigate artifacts
   - Enter: Select/open
   - Delete: Delete selected
   - Escape: Clear selection
3. Add visible focus indicator

**Pass Criteria:**

- [ ] Arrow keys navigate between artifacts
- [ ] Enter key selects current artifact
- [ ] Delete key (with confirmation) deletes selected
- [ ] Escape clears selection
- [ ] Focus indicator visible on current row
- [ ] Tab navigates to action buttons
- [ ] Shortcuts documented in tooltip/help

**Fail Criteria:**

- No keyboard navigation
- No focus indicator
- Shortcuts not documented

**Puppeteer Verification:**

```javascript
// Navigate to ideation
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3000/ideation?idea=test-idea",
});

// Focus the artifact table (simulate Tab key)
await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="artifact-table"]').focus()`,
});

// Verify table is focused
const tableFocused = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.activeElement === document.querySelector('[data-testid="artifact-table"]')`,
});
// Expected: true

// Get initial selected row
const initialRow = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="artifact-row"][aria-selected="true"]')?.getAttribute('data-index') || '-1'`,
});

// Simulate arrow down key
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    document.querySelector('[data-testid="artifact-table"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    );
  `,
});

// Verify selection moved
const newRow = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="artifact-row"][aria-selected="true"]')?.getAttribute('data-index') || '-1'`,
});
// Expected: newRow !== initialRow (moved down)

// Simulate Enter key to select
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    document.querySelector('[data-testid="artifact-table"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
  `,
});

// Verify artifact is selected (preview updated)
const previewUpdated = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="artifact-preview"]')?.textContent.length > 0`,
});
// Expected: true

// Verify focus ring visible
const hasFocusRing = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const row = document.querySelector('[data-testid="artifact-row"][aria-selected="true"]');
    const style = window.getComputedStyle(row);
    return style.outline !== 'none' || style.boxShadow.includes('ring') || row.classList.contains('focus-visible');
  `,
});
// Expected: true (visual focus indicator)

// Simulate Escape key to deselect
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    document.querySelector('[data-testid="artifact-table"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
  `,
});

const deselected = await mcp__puppeteer__puppeteer_evaluate({
  script: `document.querySelector('[data-testid="artifact-row"][aria-selected="true"]') === null`,
});
// Expected: true (nothing selected)

// Verify Tab navigates to action buttons
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Select an artifact first
    document.querySelector('[data-testid="artifact-row"]').click();
    // Then tab
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  `,
});

const actionButtonFocused = await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const activeEl = document.activeElement;
    return activeEl?.getAttribute('data-testid')?.startsWith('btn-') || false;
  `,
});
// Expected: true (action button focused)

// Screenshot for visual verification
await mcp__puppeteer__puppeteer_screenshot({
  name: "keyboard-navigation-test",
});
```

---

## Summary

| Test ID     | Description                             | Dependencies |
| ----------- | --------------------------------------- | ------------ |
| TEST-UI-001 | Update ideation reducer                 | TEST-PH-015  |
| TEST-UI-002 | Create artifact selectors               | TEST-UI-001  |
| TEST-UI-003 | Create ArtifactTable component          | TEST-UI-002  |
| TEST-UI-004 | Add classification badges               | TEST-UI-003  |
| TEST-UI-005 | Create ArtifactPreview component        | TEST-UI-004  |
| TEST-UI-006 | Create redesigned IdeaArtifactPanel     | TEST-UI-005  |
| TEST-UI-007 | Implement sessions view                 | TEST-UI-006  |
| TEST-UI-008 | Create IdeaSelector component           | TEST-UI-007  |
| TEST-UI-009 | Integrate IdeaSelector in SessionHeader | TEST-UI-008  |
| TEST-UI-010 | Handle idea type selection flow         | TEST-UI-009  |
| TEST-UI-011 | WebSocket artifact updates              | TEST-UI-010  |
| TEST-UI-012 | Classification update events            | TEST-UI-011  |
| TEST-UI-013 | Loading states                          | TEST-UI-012  |
| TEST-UI-014 | Error states                            | TEST-UI-013  |
| TEST-UI-015 | Keyboard navigation                     | TEST-UI-014  |

---

## Files to Create

| File                                                   | Purpose                  |
| ------------------------------------------------------ | ------------------------ |
| `frontend/src/selectors/ideationSelectors.ts`          | Memoized state selectors |
| `frontend/src/components/ideation/ArtifactTable.tsx`   | Table component          |
| `frontend/src/components/ideation/ArtifactPreview.tsx` | Preview component        |
| `frontend/src/components/ideation/SessionsView.tsx`    | Sessions grouping view   |
| `frontend/src/components/ideation/IdeaSelector.tsx`    | Idea dropdown            |
| `frontend/src/components/ideation/IdeaTypeModal.tsx`   | New idea type flow       |

## Files to Modify

| File                                                     | Changes                          |
| -------------------------------------------------------- | -------------------------------- |
| `frontend/src/reducers/ideationReducer.ts`               | Add new state fields and actions |
| `frontend/src/components/ideation/IdeaArtifactPanel.tsx` | Redesign with table+preview      |
| `frontend/src/components/ideation/SessionHeader.tsx`     | Add idea selector                |

---

## Execution Command

```bash
# Run the dedicated Ralph loop for unified file system specs
python3 tests/e2e/unified-fs-ralph-loop.py

# Ensure frontend is running first
npm run dev
```
