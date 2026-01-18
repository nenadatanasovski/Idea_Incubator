# Project Traceability Implementation Plan

**Status**: Draft
**Created**: 2026-01-18
**Author**: Claude
**Priority**: High

---

## Problem Statement

The Project > Item section has a **broken traceability chain** between PRDs/Specs and Tasks:

1. **Spec tab** shows PRD content (problem, criteria, constraints) with **no connection to tasks**
2. **Build tab** shows tasks in Kanban format with **no connection back to specs**
3. Rich metadata exists (`prd_tasks`, `requirement_ref`, `task_relationships`, `spec_sections`) but is **completely unused in UI**
4. Downstream task execution creates **drift** from upstream specs with no visibility
5. No mechanism to **sync upstream summaries** when implementation reveals new learnings

### Data Available But Not Displayed

| Table                         | Key Fields                                                   | Current UI Usage     |
| ----------------------------- | ------------------------------------------------------------ | -------------------- |
| `prd_tasks`                   | `requirement_ref` (e.g., "success_criteria[0]"), `link_type` | None                 |
| `prd_task_lists`              | `prd_id`, `task_list_id`, `position`                         | None                 |
| `spec_sections`               | `section_type`, `confidence_score`, `needs_review`           | None                 |
| `acceptance_criteria_results` | `criterion_index`, `met`, `verified_by`                      | None                 |
| `task_relationships`          | 12 types including `implements`, `tests`                     | None in Project view |
| Task fields                   | `category`, `phase`, `parentTaskId`, `decompositionId`       | Partial              |

---

## Track 1: API Layer - Traceability Endpoints

### Task 1.1: Create Traceability Service

**Files**: `server/services/project/traceability-service.ts` (NEW)

**Checklist**:

- [ ] Create new file with service class `TraceabilityService`
- [ ] Implement `getSpecCoverage(projectId: string)` method:
  - Query all PRDs for project
  - Query `spec_sections` for each PRD
  - Query `prd_tasks` to get linked tasks per section
  - Calculate coverage percentage per section
- [ ] Implement `getTaskSpecLinks(taskId: string)` method:
  - Query `prd_tasks` for this task
  - Return linked PRD requirements with `requirement_ref`
- [ ] Implement `getOrphanTasks(projectId: string)` method:
  - Find tasks with no `prd_tasks` entries
- [ ] Implement `getCoverageGaps(projectId: string)` method:
  - Find spec sections with zero linked tasks
- [ ] Export service instance

**Test Script**:

```bash
# Check file exists and exports correctly
test -f server/services/project/traceability-service.ts && echo "PASS: File exists"
grep -q "export.*TraceabilityService\|export default" server/services/project/traceability-service.ts && echo "PASS: Service exported"
grep -q "getSpecCoverage" server/services/project/traceability-service.ts && echo "PASS: getSpecCoverage implemented"
grep -q "getTaskSpecLinks" server/services/project/traceability-service.ts && echo "PASS: getTaskSpecLinks implemented"
grep -q "getOrphanTasks" server/services/project/traceability-service.ts && echo "PASS: getOrphanTasks implemented"
```

**Pass Criteria**:

- [ ] File exists at specified path
- [ ] All 4 methods implemented with proper TypeScript types
- [ ] Service queries correct tables (`prd_tasks`, `spec_sections`, `tasks`)
- [ ] Coverage calculation returns percentage 0-100

---

### Task 1.2: Create Traceability Types

**Files**: `types/traceability.ts` (NEW)

**Checklist**:

- [ ] Define `SpecSectionCoverage` interface:
  ```typescript
  interface SpecSectionCoverage {
    sectionType: string;
    sectionTitle: string;
    totalItems: number;
    coveredItems: number;
    coveragePercentage: number;
    items: SpecItemCoverage[];
  }
  ```
- [ ] Define `SpecItemCoverage` interface:
  ```typescript
  interface SpecItemCoverage {
    index: number;
    content: string;
    linkedTasks: LinkedTask[];
    isCovered: boolean;
  }
  ```
- [ ] Define `LinkedTask` interface:
  ```typescript
  interface LinkedTask {
    id: string;
    displayId: string;
    title: string;
    status: TaskStatus;
    linkType: "implements" | "tests" | "related";
  }
  ```
- [ ] Define `ProjectTraceability` interface:
  ```typescript
  interface ProjectTraceability {
    projectId: string;
    prdId: string;
    prdTitle: string;
    sections: SpecSectionCoverage[];
    overallCoverage: number;
    orphanTaskCount: number;
    gapCount: number;
  }
  ```
- [ ] Define `OrphanTask` interface
- [ ] Define `CoverageGap` interface
- [ ] Export all types

**Test Script**:

```bash
cd /Users/nenadatanasovski/idea_incurator
npx tsc --noEmit 2>&1 | grep -E "traceability" || echo "PASS: No type errors in traceability.ts"
grep -c "export interface" types/traceability.ts | xargs -I {} test {} -ge 5 && echo "PASS: At least 5 interfaces exported"
```

**Pass Criteria**:

- [ ] File compiles without TypeScript errors
- [ ] All 6 interfaces defined and exported
- [ ] Types are consistent with database schema

---

### Task 1.3: Add Traceability API Routes

**Files**: `server/routes/traceability.ts` (NEW)

**Checklist**:

- [ ] Create Express router
- [ ] Implement `GET /api/projects/:id/traceability`:
  - Call `TraceabilityService.getSpecCoverage()`
  - Return `ProjectTraceability` object
- [ ] Implement `GET /api/projects/:id/coverage-gaps`:
  - Call `TraceabilityService.getCoverageGaps()`
  - Return array of `CoverageGap`
- [ ] Implement `GET /api/projects/:id/orphan-tasks`:
  - Call `TraceabilityService.getOrphanTasks()`
  - Return array of `OrphanTask`
- [ ] Implement `GET /api/tasks/:id/spec-links`:
  - Call `TraceabilityService.getTaskSpecLinks()`
  - Return linked PRD requirements
- [ ] Implement `POST /api/prd-tasks`:
  - Create link between task and PRD requirement
  - Validate `requirement_ref` format
- [ ] Implement `DELETE /api/prd-tasks/:id`:
  - Remove task-to-spec link
- [ ] Add error handling with appropriate HTTP status codes
- [ ] Export router

**Test Script**:

```bash
# Check routes are defined
grep -c "router\.\(get\|post\|delete\)" server/routes/traceability.ts | xargs -I {} test {} -ge 5 && echo "PASS: 5+ routes defined"

# Check router is exported
grep -q "export default router\|module.exports" server/routes/traceability.ts && echo "PASS: Router exported"

# TypeScript compilation
npx tsc --noEmit 2>&1 | grep -E "traceability" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] All 6 routes implemented
- [ ] Routes return correct HTTP status codes (200, 201, 404, 400)
- [ ] POST route validates `requirement_ref` format
- [ ] TypeScript compiles without errors

---

### Task 1.4: Register Traceability Routes in Server

**Files**: `server/index.ts`

**Checklist**:

- [ ] Import traceability router at top of file
- [ ] Register routes: `app.use('/api', traceabilityRouter)`
- [ ] Ensure routes are registered before error handlers

**Test Script**:

```bash
grep -q "traceability" server/index.ts && echo "PASS: Traceability router imported"
grep -q "app.use.*traceability\|traceabilityRouter" server/index.ts && echo "PASS: Routes registered"

# Integration test - start server and check endpoint
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/projects/test/traceability 2>/dev/null | grep -E "200|404" && echo "PASS: Endpoint responds"
```

**Pass Criteria**:

- [ ] Router imported and registered
- [ ] Endpoint accessible (returns 200 or 404, not 500)
- [ ] No startup errors

---

### Task 1.5: Add Coverage Stats to Project API

**Files**: `server/routes/projects.ts`

**Checklist**:

- [ ] Modify `GET /api/projects/:ref` to optionally include coverage stats
- [ ] Add query parameter `?withCoverage=true`
- [ ] When enabled, include:
  ```typescript
  {
    ...project,
    coverageStats: {
      overallCoverage: number,
      coveredRequirements: number,
      totalRequirements: number,
      orphanTaskCount: number,
      gapCount: number
    }
  }
  ```
- [ ] Update `ProjectWithStats` type to include optional `coverageStats`

**Test Script**:

```bash
# Check query parameter handling
grep -q "withCoverage" server/routes/projects.ts && echo "PASS: withCoverage param handled"

# Check type update
grep -q "coverageStats" types/project.ts && echo "PASS: coverageStats in type"

# Integration test
curl -s "http://localhost:3001/api/projects/test?withCoverage=true" 2>/dev/null | grep -q "coverageStats\|error" && echo "PASS: Endpoint handles param"
```

**Pass Criteria**:

- [ ] Query parameter `withCoverage` is processed
- [ ] Coverage stats returned when requested
- [ ] Backward compatible (works without param)

---

## Track 2: Frontend - Traceability Tab

### Task 2.1: Create Traceability Hook

**Files**: `frontend/src/hooks/useTraceability.ts` (NEW)

**Checklist**:

- [ ] Create custom hook `useTraceability(projectId: string)`
- [ ] Fetch from `/api/projects/:id/traceability`
- [ ] Return `{ traceability, isLoading, error, refetch }`
- [ ] Handle loading and error states
- [ ] Add TypeScript types for return value
- [ ] Export hook

**Test Script**:

```bash
test -f frontend/src/hooks/useTraceability.ts && echo "PASS: Hook file exists"
grep -q "useTraceability" frontend/src/hooks/useTraceability.ts && echo "PASS: Hook defined"
grep -q "useState\|useEffect\|useCallback" frontend/src/hooks/useTraceability.ts && echo "PASS: React hooks used"
grep -q "export" frontend/src/hooks/useTraceability.ts && echo "PASS: Hook exported"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "useTraceability" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Hook fetches data correctly
- [ ] Loading state managed
- [ ] Error handling implemented
- [ ] TypeScript compiles

---

### Task 2.2: Create SpecSectionCard Component

**Files**: `frontend/src/components/projects/SpecSectionCard.tsx` (NEW)

**Checklist**:

- [ ] Create component accepting `SpecSectionCoverage` props
- [ ] Display section header with coverage percentage bar
- [ ] Show coverage as colored bar: green (100%), yellow (50-99%), red (<50%)
- [ ] List individual items with coverage indicators:
  - ✓ green check for covered items
  - ⚠️ warning for uncovered items
- [ ] Make items expandable to show linked tasks
- [ ] Display linked task chips with status colors
- [ ] Add click handler to filter/navigate to tasks
- [ ] Style with Tailwind CSS

**Test Script**:

```bash
test -f frontend/src/components/projects/SpecSectionCard.tsx && echo "PASS: Component file exists"
grep -q "SpecSectionCoverage" frontend/src/components/projects/SpecSectionCard.tsx && echo "PASS: Props typed"
grep -q "coveragePercentage" frontend/src/components/projects/SpecSectionCard.tsx && echo "PASS: Coverage displayed"
grep -c "className=" frontend/src/components/projects/SpecSectionCard.tsx | xargs -I {} test {} -ge 5 && echo "PASS: Tailwind styling"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "SpecSectionCard" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Component renders section with coverage bar
- [ ] Items show covered/uncovered status
- [ ] Linked tasks displayed with status
- [ ] TypeScript compiles

---

### Task 2.3: Create LinkedTaskChip Component

**Files**: `frontend/src/components/projects/LinkedTaskChip.tsx` (NEW)

**Checklist**:

- [ ] Create component accepting `LinkedTask` props
- [ ] Display task `displayId` in monospace font
- [ ] Show status indicator (icon + color):
  - completed: green check
  - in_progress: blue spinner/clock
  - pending: gray circle
  - failed: red X
  - blocked: yellow pause
- [ ] Show `linkType` as small badge (implements/tests/related)
- [ ] Add hover tooltip with full task title
- [ ] Make clickable to navigate to task detail
- [ ] Style compact for inline display

**Test Script**:

```bash
test -f frontend/src/components/projects/LinkedTaskChip.tsx && echo "PASS: Component file exists"
grep -q "LinkedTask" frontend/src/components/projects/LinkedTaskChip.tsx && echo "PASS: Props typed"
grep -q "displayId" frontend/src/components/projects/LinkedTaskChip.tsx && echo "PASS: DisplayId shown"
grep -E "completed|in_progress|pending|failed|blocked" frontend/src/components/projects/LinkedTaskChip.tsx && echo "PASS: Status handling"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "LinkedTaskChip" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Component displays task ID and status
- [ ] Status colors are correct
- [ ] Link type badge shown
- [ ] Clickable navigation works

---

### Task 2.4: Create TraceabilityView Component

**Files**: `frontend/src/components/projects/TraceabilityView.tsx` (NEW)

**Checklist**:

- [ ] Create main traceability view component
- [ ] Accept `projectId` prop
- [ ] Use `useTraceability` hook to fetch data
- [ ] Implement two-panel layout:
  - Left panel (1/3): Spec sections list with coverage bars
  - Right panel (2/3): Selected section details with linked tasks
- [ ] Add section selector (click left panel item to show details in right)
- [ ] Show overall coverage summary at top
- [ ] Display gap count and orphan task count as warnings
- [ ] Handle loading state with skeleton
- [ ] Handle error state with retry button
- [ ] Handle empty state (no PRDs)

**Test Script**:

```bash
test -f frontend/src/components/projects/TraceabilityView.tsx && echo "PASS: Component file exists"
grep -q "useTraceability" frontend/src/components/projects/TraceabilityView.tsx && echo "PASS: Hook used"
grep -q "SpecSectionCard" frontend/src/components/projects/TraceabilityView.tsx && echo "PASS: Section cards used"
grep -E "grid|flex" frontend/src/components/projects/TraceabilityView.tsx && echo "PASS: Layout implemented"
grep -q "isLoading" frontend/src/components/projects/TraceabilityView.tsx && echo "PASS: Loading state handled"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "TraceabilityView" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Two-panel layout renders correctly
- [ ] Sections clickable to show details
- [ ] Coverage percentages display
- [ ] Loading/error/empty states handled
- [ ] TypeScript compiles

---

### Task 2.5: Add Traceability Tab to ProjectsSubTabs

**Files**: `frontend/src/components/projects/ProjectsSubTabs.tsx`

**Checklist**:

- [ ] Import `GitBranch` or `Link2` icon from lucide-react
- [ ] Add new tab object to tabs array:
  ```typescript
  { id: "traceability", label: "Traceability", icon: GitBranch, path: "traceability" }
  ```
- [ ] Ensure tab order is: Overview, Spec, Traceability, Build
- [ ] Update any tab count/index references

**Test Script**:

```bash
grep -q "traceability" frontend/src/components/projects/ProjectsSubTabs.tsx && echo "PASS: Tab added"
grep -c "id:" frontend/src/components/projects/ProjectsSubTabs.tsx | xargs -I {} test {} -ge 4 && echo "PASS: 4+ tabs defined"
grep -E "GitBranch|Link2" frontend/src/components/projects/ProjectsSubTabs.tsx && echo "PASS: Icon imported"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "ProjectsSubTabs" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Traceability tab visible in navigation
- [ ] Icon displays correctly
- [ ] Tab order is correct
- [ ] No TypeScript errors

---

### Task 2.6: Add Traceability Route

**Files**: `frontend/src/App.tsx` (or router configuration file)

**Checklist**:

- [ ] Import `TraceabilityView` component
- [ ] Add route: `/projects/:slug/traceability` → `TraceabilityView`
- [ ] Ensure route is nested under project layout
- [ ] Pass `projectId` to component via outlet context or params

**Test Script**:

```bash
grep -q "traceability" frontend/src/App.tsx && echo "PASS: Route defined"
grep -q "TraceabilityView" frontend/src/App.tsx && echo "PASS: Component imported"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "App.tsx" || echo "PASS: No type errors"

# Manual verification needed: Navigate to /projects/test/traceability
```

**Pass Criteria**:

- [ ] Route accessible at `/projects/:slug/traceability`
- [ ] Component renders without errors
- [ ] Navigation from tabs works

---

### Task 2.7: Export New Components from Index

**Files**: `frontend/src/components/projects/index.ts`

**Checklist**:

- [ ] Export `TraceabilityView`
- [ ] Export `SpecSectionCard`
- [ ] Export `LinkedTaskChip`

**Test Script**:

```bash
grep -q "TraceabilityView" frontend/src/components/projects/index.ts && echo "PASS: TraceabilityView exported"
grep -q "SpecSectionCard" frontend/src/components/projects/index.ts && echo "PASS: SpecSectionCard exported"
grep -q "LinkedTaskChip" frontend/src/components/projects/index.ts && echo "PASS: LinkedTaskChip exported"
```

**Pass Criteria**:

- [ ] All new components exported
- [ ] Imports work from index

---

## Track 3: Enhanced Spec Tab with Coverage

### Task 3.1: Create SpecCoverageColumn Component

**Files**: `frontend/src/components/projects/SpecCoverageColumn.tsx` (NEW)

**Checklist**:

- [ ] Create component for success criteria table coverage column
- [ ] Accept props: `criterionIndex: number`, `prdId: string`
- [ ] Fetch linked tasks for this specific criterion
- [ ] Display:
  - ✓ with count if covered (e.g., "✓ 2 tasks")
  - ⚠️ "0 tasks" if not covered
- [ ] Make clickable to show task list popover
- [ ] Style as table cell

**Test Script**:

```bash
test -f frontend/src/components/projects/SpecCoverageColumn.tsx && echo "PASS: Component exists"
grep -q "criterionIndex" frontend/src/components/projects/SpecCoverageColumn.tsx && echo "PASS: Props defined"
grep -E "✓|⚠️|check|warning" frontend/src/components/projects/SpecCoverageColumn.tsx && echo "PASS: Status indicators"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "SpecCoverageColumn" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Component renders coverage status
- [ ] Shows task count
- [ ] Clickable interaction works

---

### Task 3.2: Enhance ProjectSpec Success Criteria Table

**Files**: `frontend/src/components/projects/ProjectSpec.tsx`

**Checklist**:

- [ ] Import `SpecCoverageColumn` component
- [ ] Add "Coverage" column header to success criteria table
- [ ] Render `SpecCoverageColumn` for each criterion row
- [ ] Pass `criterionIndex` and `prdId` to component
- [ ] Maintain backward compatibility (works if no coverage data)

**Test Script**:

```bash
grep -q "SpecCoverageColumn" frontend/src/components/projects/ProjectSpec.tsx && echo "PASS: Component imported"
grep -q "Coverage" frontend/src/components/projects/ProjectSpec.tsx && echo "PASS: Column header added"
grep -q "criterionIndex" frontend/src/components/projects/ProjectSpec.tsx && echo "PASS: Index passed to component"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "ProjectSpec" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Coverage column visible in table
- [ ] Each row shows coverage status
- [ ] Table still works without coverage data

---

### Task 3.3: Add Section Coverage Headers to ProjectSpec

**Files**: `frontend/src/components/projects/ProjectSpec.tsx`

**Checklist**:

- [ ] Fetch section coverage data for expanded PRD
- [ ] Add coverage percentage badge next to each section header:
  - Problem Statement: N/A (no coverage tracking)
  - Target Users: N/A
  - Success Criteria: Show coverage %
  - Constraints: Show coverage %
  - Out of Scope: N/A
- [ ] Color-code percentage: green (100%), yellow (50-99%), red (<50%)
- [ ] Add small progress bar under section title

**Test Script**:

```bash
grep -E "coveragePercentage|coverage" frontend/src/components/projects/ProjectSpec.tsx && echo "PASS: Coverage displayed"
grep -E "bg-green|bg-yellow|bg-red" frontend/src/components/projects/ProjectSpec.tsx && echo "PASS: Color coding"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "ProjectSpec" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Coverage percentage shown for applicable sections
- [ ] Color coding reflects coverage level
- [ ] Non-tracked sections show N/A or nothing

---

## Track 4: Enhanced Overview with Coverage Stats

### Task 4.1: Create CoverageStatsCard Component

**Files**: `frontend/src/components/projects/CoverageStatsCard.tsx` (NEW)

**Checklist**:

- [ ] Create sidebar card component for coverage stats
- [ ] Accept `coverageStats` from `ProjectWithStats`
- [ ] Display:
  - Overall coverage percentage with progress bar
  - "Covered: X/Y requirements" text
  - Orphan tasks count with warning icon if > 0
  - Coverage gaps count with warning icon if > 0
- [ ] Add "View Details" link to Traceability tab
- [ ] Style consistent with other sidebar cards

**Test Script**:

```bash
test -f frontend/src/components/projects/CoverageStatsCard.tsx && echo "PASS: Component exists"
grep -q "coverageStats" frontend/src/components/projects/CoverageStatsCard.tsx && echo "PASS: Props typed"
grep -q "orphan" frontend/src/components/projects/CoverageStatsCard.tsx && echo "PASS: Orphan count shown"
grep -q "traceability" frontend/src/components/projects/CoverageStatsCard.tsx && echo "PASS: Link to tab"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "CoverageStatsCard" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Card displays all coverage stats
- [ ] Warning indicators for issues
- [ ] Link to traceability tab works

---

### Task 4.2: Add CoverageStatsCard to ProjectOverview

**Files**: `frontend/src/components/projects/ProjectOverview.tsx`

**Checklist**:

- [ ] Import `CoverageStatsCard` component
- [ ] Fetch project with `?withCoverage=true` or use existing data
- [ ] Add `CoverageStatsCard` to sidebar (after Quick Stats)
- [ ] Conditionally render only if coverage data exists
- [ ] Handle loading state for coverage data

**Test Script**:

```bash
grep -q "CoverageStatsCard" frontend/src/components/projects/ProjectOverview.tsx && echo "PASS: Component imported"
grep -q "coverageStats" frontend/src/components/projects/ProjectOverview.tsx && echo "PASS: Data used"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "ProjectOverview" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Coverage card appears in sidebar
- [ ] Stats display correctly
- [ ] Graceful handling when no coverage data

---

## Track 5: Task Grouping by Spec Section

### Task 5.1: Create TaskGroupSelector Component

**Files**: `frontend/src/components/projects/TaskGroupSelector.tsx` (NEW)

**Checklist**:

- [ ] Create dropdown/button group component
- [ ] Options: "None", "Category", "Phase", "Spec Section", "Parent Task"
- [ ] Accept `value` and `onChange` props
- [ ] Style as segmented control or dropdown
- [ ] Include icons for each option

**Test Script**:

```bash
test -f frontend/src/components/projects/TaskGroupSelector.tsx && echo "PASS: Component exists"
grep -E "Category|Phase|Spec Section|Parent" frontend/src/components/projects/TaskGroupSelector.tsx && echo "PASS: Options defined"
grep -q "onChange" frontend/src/components/projects/TaskGroupSelector.tsx && echo "PASS: onChange prop"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "TaskGroupSelector" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] All grouping options available
- [ ] Selection changes value
- [ ] Styling is consistent

---

### Task 5.2: Create useGroupedTasks Hook

**Files**: `frontend/src/hooks/useGroupedTasks.ts` (NEW)

**Checklist**:

- [ ] Create hook `useGroupedTasks(tasks: Task[], groupBy: string)`
- [ ] Implement grouping logic for each option:
  - "none": Return flat list
  - "category": Group by `task.category`
  - "phase": Group by `task.phase` (1-5)
  - "spec_section": Group by PRD section from `prd_tasks`
  - "parent": Group by `task.parentTaskId`
- [ ] Return `{ groups: TaskGroup[], ungrouped: Task[] }`
- [ ] Define `TaskGroup` type: `{ key: string, label: string, tasks: Task[] }`

**Test Script**:

```bash
test -f frontend/src/hooks/useGroupedTasks.ts && echo "PASS: Hook file exists"
grep -q "useGroupedTasks" frontend/src/hooks/useGroupedTasks.ts && echo "PASS: Hook defined"
grep -E "category|phase|spec_section|parent" frontend/src/hooks/useGroupedTasks.ts && echo "PASS: Grouping options"
grep -q "TaskGroup" frontend/src/hooks/useGroupedTasks.ts && echo "PASS: Type defined"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "useGroupedTasks" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Hook returns grouped tasks
- [ ] All grouping modes work
- [ ] Ungrouped tasks handled

---

### Task 5.3: Create TaskGroupCard Component

**Files**: `frontend/src/components/projects/TaskGroupCard.tsx` (NEW)

**Checklist**:

- [ ] Create collapsible card for task group
- [ ] Accept `TaskGroup` props
- [ ] Display group label with task count
- [ ] Show mini progress bar (completed/total)
- [ ] Expandable to show task list
- [ ] Task list shows `displayId`, title, status
- [ ] Style with border color matching group type

**Test Script**:

```bash
test -f frontend/src/components/projects/TaskGroupCard.tsx && echo "PASS: Component exists"
grep -q "TaskGroup" frontend/src/components/projects/TaskGroupCard.tsx && echo "PASS: Props typed"
grep -E "expand|collapse|Chevron" frontend/src/components/projects/TaskGroupCard.tsx && echo "PASS: Collapsible"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "TaskGroupCard" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Group displays with label and count
- [ ] Collapsible behavior works
- [ ] Tasks listed inside group

---

### Task 5.4: Enhance ProjectBuild with Grouping

**Files**: `frontend/src/components/projects/ProjectBuild.tsx`

**Checklist**:

- [ ] Import `TaskGroupSelector` and `TaskGroupCard`
- [ ] Import `useGroupedTasks` hook
- [ ] Add state for selected grouping: `const [groupBy, setGroupBy] = useState('none')`
- [ ] Add `TaskGroupSelector` above task display
- [ ] When groupBy !== 'none', render `TaskGroupCard` components instead of flat list
- [ ] Show "Ungrouped" section for orphan tasks
- [ ] Maintain mini-kanban as option (groupBy = 'none')

**Test Script**:

```bash
grep -q "TaskGroupSelector" frontend/src/components/projects/ProjectBuild.tsx && echo "PASS: Selector added"
grep -q "useGroupedTasks" frontend/src/components/projects/ProjectBuild.tsx && echo "PASS: Hook used"
grep -q "TaskGroupCard" frontend/src/components/projects/ProjectBuild.tsx && echo "PASS: Group cards used"
grep -q "groupBy" frontend/src/components/projects/ProjectBuild.tsx && echo "PASS: State managed"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "ProjectBuild" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Grouping selector visible
- [ ] Grouped view renders correctly
- [ ] Ungrouped tasks shown
- [ ] Mini-kanban still works

---

## Track 6: AI Sync Functionality

### Task 6.1: Create AI Sync Service

**Files**: `server/services/project/ai-sync-service.ts` (NEW)

**Checklist**:

- [ ] Create service class `AISyncService`
- [ ] Implement `generateSpecSectionUpdate(prdId: string, sectionType: string)`:
  - Fetch linked tasks and their status
  - Fetch acceptance criteria results
  - Generate prompt for Claude to suggest spec updates
  - Return suggested changes as diff
- [ ] Implement `regenerateProjectSummary(projectId: string)`:
  - Fetch all tasks with status
  - Fetch completed acceptance criteria
  - Generate prompt for Claude to create summary
  - Return new summary text
- [ ] Implement `suggestTaskSpecLinks(taskId: string)`:
  - Analyze task title/description
  - Find matching PRD requirements
  - Return suggested links with confidence scores
- [ ] Add rate limiting for AI calls
- [ ] Export service

**Test Script**:

```bash
test -f server/services/project/ai-sync-service.ts && echo "PASS: Service file exists"
grep -q "generateSpecSectionUpdate" server/services/project/ai-sync-service.ts && echo "PASS: Method 1"
grep -q "regenerateProjectSummary" server/services/project/ai-sync-service.ts && echo "PASS: Method 2"
grep -q "suggestTaskSpecLinks" server/services/project/ai-sync-service.ts && echo "PASS: Method 3"
grep -E "anthropic|claude|openai" server/services/project/ai-sync-service.ts && echo "PASS: AI integration"
```

**Pass Criteria**:

- [ ] All 3 methods implemented
- [ ] AI prompts are well-structured
- [ ] Rate limiting prevents abuse
- [ ] Returns actionable suggestions

---

### Task 6.2: Create AI Sync API Routes

**Files**: `server/routes/ai-sync.ts` (NEW)

**Checklist**:

- [ ] Create Express router
- [ ] Implement `POST /api/ai/sync-spec-section`:
  - Body: `{ prdId, sectionType }`
  - Call `AISyncService.generateSpecSectionUpdate()`
  - Return suggested changes
- [ ] Implement `POST /api/ai/regenerate-summary`:
  - Body: `{ projectId }`
  - Call `AISyncService.regenerateProjectSummary()`
  - Return new summary
- [ ] Implement `POST /api/ai/suggest-task-links`:
  - Body: `{ taskId }`
  - Call `AISyncService.suggestTaskSpecLinks()`
  - Return suggestions
- [ ] Implement `POST /api/ai/apply-spec-update`:
  - Body: `{ prdId, sectionType, content }`
  - Update spec section in database
  - Create history entry
- [ ] Add authentication middleware
- [ ] Export router

**Test Script**:

```bash
test -f server/routes/ai-sync.ts && echo "PASS: Routes file exists"
grep -c "router.post" server/routes/ai-sync.ts | xargs -I {} test {} -ge 4 && echo "PASS: 4+ routes"
grep -q "export default router" server/routes/ai-sync.ts && echo "PASS: Router exported"
```

**Pass Criteria**:

- [ ] All 4 routes implemented
- [ ] Authentication enforced
- [ ] Error handling for AI failures

---

### Task 6.3: Register AI Sync Routes

**Files**: `server/index.ts`

**Checklist**:

- [ ] Import AI sync router
- [ ] Register: `app.use('/api/ai', aiSyncRouter)`

**Test Script**:

```bash
grep -q "ai-sync\|aiSync" server/index.ts && echo "PASS: Router imported"
grep -q "app.use.*ai" server/index.ts && echo "PASS: Routes registered"
```

**Pass Criteria**:

- [ ] Routes accessible at `/api/ai/*`
- [ ] No startup errors

---

### Task 6.4: Create AISyncButton Component

**Files**: `frontend/src/components/projects/AISyncButton.tsx` (NEW)

**Checklist**:

- [ ] Create button component with AI icon (sparkles/wand)
- [ ] Accept props: `endpoint`, `payload`, `onSuccess`, `buttonText`
- [ ] Show loading spinner during API call
- [ ] Handle errors with toast notification
- [ ] Confirm before applying changes
- [ ] Style as secondary button with AI indicator

**Test Script**:

```bash
test -f frontend/src/components/projects/AISyncButton.tsx && echo "PASS: Component exists"
grep -E "Sparkles|Wand|Bot" frontend/src/components/projects/AISyncButton.tsx && echo "PASS: AI icon used"
grep -q "isLoading" frontend/src/components/projects/AISyncButton.tsx && echo "PASS: Loading state"
grep -q "onSuccess" frontend/src/components/projects/AISyncButton.tsx && echo "PASS: Callback prop"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "AISyncButton" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Button renders with AI icon
- [ ] Loading state shows spinner
- [ ] Calls API and handles response

---

### Task 6.5: Add AI Sync Buttons to ProjectSpec

**Files**: `frontend/src/components/projects/ProjectSpec.tsx`

**Checklist**:

- [ ] Import `AISyncButton` component
- [ ] Add "🤖 Sync from Tasks" button next to Success Criteria header
- [ ] Add "🤖 Sync from Tasks" button next to Constraints header
- [ ] On click, call `/api/ai/sync-spec-section` with prdId and sectionType
- [ ] Show diff modal with suggested changes
- [ ] Allow user to accept or reject changes

**Test Script**:

```bash
grep -q "AISyncButton" frontend/src/components/projects/ProjectSpec.tsx && echo "PASS: Button imported"
grep -c "AISyncButton" frontend/src/components/projects/ProjectSpec.tsx | xargs -I {} test {} -ge 2 && echo "PASS: Multiple buttons added"
grep -q "sync-spec-section" frontend/src/components/projects/ProjectSpec.tsx && echo "PASS: API endpoint used"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "ProjectSpec" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Sync buttons visible on section headers
- [ ] Clicking triggers AI call
- [ ] Changes can be previewed and applied

---

### Task 6.6: Add AI Sync Button to ProjectOverview

**Files**: `frontend/src/components/projects/ProjectOverview.tsx`

**Checklist**:

- [ ] Import `AISyncButton`
- [ ] Add "🤖 Regenerate Summary" button to Quick Actions card
- [ ] On click, call `/api/ai/regenerate-summary`
- [ ] Show modal with generated summary
- [ ] Allow user to save or discard

**Test Script**:

```bash
grep -q "AISyncButton" frontend/src/components/projects/ProjectOverview.tsx && echo "PASS: Button imported"
grep -q "regenerate-summary" frontend/src/components/projects/ProjectOverview.tsx && echo "PASS: API endpoint used"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "ProjectOverview" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Button visible in Quick Actions
- [ ] AI generates summary on click
- [ ] User can save result

---

## Track 7: Task Decomposition Visualization

### Task 7.1: Create DecompositionTree Component

**Files**: `frontend/src/components/projects/DecompositionTree.tsx` (NEW)

**Checklist**:

- [ ] Create tree component for hierarchical tasks
- [ ] Accept array of tasks with `parentTaskId`
- [ ] Build tree structure from flat task array
- [ ] Render as indented tree with:
  - Expand/collapse arrows
  - Task displayId and title
  - Status indicator
  - "(decomposed)" badge for parent tasks
- [ ] Clickable to navigate to task detail
- [ ] Show child count on collapsed parents

**Test Script**:

```bash
test -f frontend/src/components/projects/DecompositionTree.tsx && echo "PASS: Component exists"
grep -q "parentTaskId" frontend/src/components/projects/DecompositionTree.tsx && echo "PASS: Parent ID handled"
grep -E "tree|children|expand|collapse" frontend/src/components/projects/DecompositionTree.tsx && echo "PASS: Tree structure"
grep -q "isDecomposed" frontend/src/components/projects/DecompositionTree.tsx && echo "PASS: Decomposed badge"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "DecompositionTree" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Tree renders hierarchical structure
- [ ] Expand/collapse works
- [ ] Status colors correct

---

### Task 7.2: Add Decomposition View to ProjectBuild

**Files**: `frontend/src/components/projects/ProjectBuild.tsx`

**Checklist**:

- [ ] Import `DecompositionTree` component
- [ ] Add "Parent Task" option to `TaskGroupSelector`
- [ ] When "Parent Task" grouping selected:
  - Filter tasks that have `parentTaskId` or `isDecomposed`
  - Render `DecompositionTree` instead of flat groups
- [ ] Add toggle to show/hide non-decomposed tasks

**Test Script**:

```bash
grep -q "DecompositionTree" frontend/src/components/projects/ProjectBuild.tsx && echo "PASS: Tree imported"
grep -q "Parent Task\|parent_task\|parentTaskId" frontend/src/components/projects/ProjectBuild.tsx && echo "PASS: Option added"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "ProjectBuild" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Parent Task grouping option available
- [ ] Tree view renders when selected
- [ ] Non-decomposed tasks visible

---

## Track 8: Linking Tasks to Specs (Creation Flow)

### Task 8.1: Create TaskSpecLinkModal Component

**Files**: `frontend/src/components/projects/TaskSpecLinkModal.tsx` (NEW)

**Checklist**:

- [ ] Create modal for linking task to spec requirement
- [ ] Accept `taskId` prop
- [ ] Fetch PRDs for project
- [ ] Display PRD sections with individual requirements
- [ ] Allow selecting multiple requirements
- [ ] Select link type: implements, tests, related
- [ ] Add "🤖 Suggest Links" button using AI endpoint
- [ ] Save creates `prd_tasks` entries
- [ ] Show success toast on save

**Test Script**:

```bash
test -f frontend/src/components/projects/TaskSpecLinkModal.tsx && echo "PASS: Component exists"
grep -q "prd_tasks\|prdTasks" frontend/src/components/projects/TaskSpecLinkModal.tsx && echo "PASS: Junction table used"
grep -E "implements|tests|related" frontend/src/components/projects/TaskSpecLinkModal.tsx && echo "PASS: Link types"
grep -q "suggest-task-links" frontend/src/components/projects/TaskSpecLinkModal.tsx && echo "PASS: AI suggestions"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "TaskSpecLinkModal" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Modal shows PRD requirements
- [ ] Multiple selection works
- [ ] AI suggestions display
- [ ] Links saved to database

---

### Task 8.2: Add Link Button to Task Detail Modal

**Files**: `frontend/src/components/pipeline/TaskDetailModal.tsx`

**Checklist**:

- [ ] Import `TaskSpecLinkModal`
- [ ] Add state for link modal visibility
- [ ] Add "Link to Spec" button in task actions
- [ ] Open `TaskSpecLinkModal` on click
- [ ] Refresh task data after linking
- [ ] Show existing links in task detail view

**Test Script**:

```bash
grep -q "TaskSpecLinkModal" frontend/src/components/pipeline/TaskDetailModal.tsx && echo "PASS: Modal imported"
grep -q "Link to Spec\|linkToSpec" frontend/src/components/pipeline/TaskDetailModal.tsx && echo "PASS: Button added"
grep -q "specLinks\|prdTasks" frontend/src/components/pipeline/TaskDetailModal.tsx && echo "PASS: Links displayed"
cd frontend && npx tsc --noEmit 2>&1 | grep -E "TaskDetailModal" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] Button visible in task detail
- [ ] Modal opens on click
- [ ] Existing links shown

---

## Verification Tests

### V1: API Integration Test

```bash
# Start server
npm run dev &
sleep 5

# Test traceability endpoint
curl -s "http://localhost:3001/api/projects/test/traceability" | jq '.sections | length' | xargs -I {} test {} -ge 0 && echo "PASS: Traceability API works"

# Test coverage endpoint
curl -s "http://localhost:3001/api/projects/test/coverage-gaps" | jq '. | type' | grep -q "array" && echo "PASS: Coverage gaps API works"

# Test orphan tasks endpoint
curl -s "http://localhost:3001/api/projects/test/orphan-tasks" | jq '. | type' | grep -q "array" && echo "PASS: Orphan tasks API works"

# Test task spec links
curl -s "http://localhost:3001/api/tasks/test/spec-links" | jq '. | type' | grep -q "array\|object" && echo "PASS: Task spec links API works"
```

**Pass Criteria**:

- [ ] All API endpoints respond without 500 errors
- [ ] Response format matches expected types

---

### V2: Frontend Build Test

```bash
cd frontend

# Type checking
npx tsc --noEmit 2>&1 | tee /tmp/tsc-output.txt
test $(wc -l < /tmp/tsc-output.txt) -eq 0 && echo "PASS: No TypeScript errors"

# Build
npm run build 2>&1 | tail -5
test -d dist && echo "PASS: Build succeeded"

# Check new components in build
grep -r "TraceabilityView" dist/ && echo "PASS: TraceabilityView in build"
```

**Pass Criteria**:

- [ ] TypeScript compiles without errors
- [ ] Build completes successfully
- [ ] New components included in build

---

### V3: Navigation Test (Manual)

```markdown
1. Navigate to /projects
2. Click on a project
3. Verify 4 tabs visible: Overview, Spec, Traceability, Build
4. Click Traceability tab
5. Verify two-panel layout renders
6. Click a spec section on left
7. Verify details show on right with linked tasks
8. Click Build tab
9. Verify grouping selector visible
10. Change grouping to "Spec Section"
11. Verify tasks grouped by section
12. Click a sync button
13. Verify AI loading and result display
```

**Pass Criteria**:

- [ ] All 4 tabs accessible
- [ ] Traceability view renders correctly
- [ ] Grouping options work
- [ ] AI sync buttons functional

---

### V4: Data Flow Test

```bash
# Create test data
sqlite3 database/ideas.db "INSERT INTO prd_tasks (id, prd_id, task_id, requirement_ref, link_type, created_at) VALUES ('test-link-1', 'test-prd', 'test-task', 'success_criteria[0]', 'implements', datetime('now'));"

# Verify traceability reflects it
curl -s "http://localhost:3001/api/projects/test/traceability" | grep -q "success_criteria" && echo "PASS: Link reflected in API"

# Clean up
sqlite3 database/ideas.db "DELETE FROM prd_tasks WHERE id = 'test-link-1';"
```

**Pass Criteria**:

- [ ] Junction table entries reflect in traceability API
- [ ] Coverage calculation updates with new links

---

## Implementation Order

| Priority | Task ID | Description                       | Dependencies | Effort  |
| -------- | ------- | --------------------------------- | ------------ | ------- |
| 1        | 1.2     | Create traceability types         | None         | Small   |
| 2        | 1.1     | Create traceability service       | 1.2          | Medium  |
| 3        | 1.3     | Add traceability API routes       | 1.1, 1.2     | Medium  |
| 4        | 1.4     | Register routes in server         | 1.3          | Trivial |
| 5        | 2.1     | Create useTraceability hook       | 1.4          | Small   |
| 6        | 2.3     | Create LinkedTaskChip component   | 1.2          | Small   |
| 7        | 2.2     | Create SpecSectionCard component  | 2.3          | Medium  |
| 8        | 2.4     | Create TraceabilityView component | 2.1, 2.2     | Large   |
| 9        | 2.5     | Add Traceability tab              | 2.4          | Trivial |
| 10       | 2.6     | Add Traceability route            | 2.5          | Trivial |
| 11       | 2.7     | Export new components             | 2.4          | Trivial |
| 12       | 1.5     | Add coverage to project API       | 1.1          | Small   |
| 13       | 4.1     | Create CoverageStatsCard          | 1.5          | Small   |
| 14       | 4.2     | Add coverage to Overview          | 4.1          | Small   |
| 15       | 3.1     | Create SpecCoverageColumn         | 1.4          | Small   |
| 16       | 3.2     | Enhance Spec criteria table       | 3.1          | Medium  |
| 17       | 3.3     | Add section coverage headers      | 3.2          | Small   |
| 18       | 5.1     | Create TaskGroupSelector          | None         | Small   |
| 19       | 5.2     | Create useGroupedTasks hook       | 1.4          | Medium  |
| 20       | 5.3     | Create TaskGroupCard              | 5.2          | Small   |
| 21       | 5.4     | Enhance Build with grouping       | 5.1, 5.3     | Medium  |
| 22       | 6.1     | Create AI sync service            | None         | Large   |
| 23       | 6.2     | Create AI sync routes             | 6.1          | Medium  |
| 24       | 6.3     | Register AI sync routes           | 6.2          | Trivial |
| 25       | 6.4     | Create AISyncButton component     | 6.3          | Small   |
| 26       | 6.5     | Add sync to Spec                  | 6.4          | Small   |
| 27       | 6.6     | Add sync to Overview              | 6.4          | Small   |
| 28       | 7.1     | Create DecompositionTree          | None         | Medium  |
| 29       | 7.2     | Add decomposition to Build        | 5.4, 7.1     | Small   |
| 30       | 8.1     | Create TaskSpecLinkModal          | 1.3          | Medium  |
| 31       | 8.2     | Add link to TaskDetailModal       | 8.1          | Small   |

---

## Summary

| Track                      | Tasks  | Files Created | Files Modified |
| -------------------------- | ------ | ------------- | -------------- |
| Track 1: API Layer         | 5      | 3             | 2              |
| Track 2: Traceability Tab  | 7      | 5             | 2              |
| Track 3: Enhanced Spec     | 3      | 1             | 1              |
| Track 4: Enhanced Overview | 2      | 1             | 1              |
| Track 5: Task Grouping     | 4      | 3             | 1              |
| Track 6: AI Sync           | 6      | 3             | 3              |
| Track 7: Decomposition     | 2      | 1             | 1              |
| Track 8: Task Linking      | 2      | 1             | 1              |
| **Total**                  | **31** | **18**        | **12**         |

---

## Risk Mitigation

| Risk                            | Mitigation                                                                 |
| ------------------------------- | -------------------------------------------------------------------------- |
| AI sync costs                   | Add rate limiting, require confirmation before AI calls                    |
| Empty state confusion           | Show clear CTAs when no data (e.g., "Link tasks to specs to see coverage") |
| Performance with large projects | Paginate traceability API, lazy load sections                              |
| Breaking existing views         | All changes are additive; existing tabs/views unchanged                    |
| Junction table population       | Provide migration script to link existing tasks based on title matching    |

---

## Migration Script (Optional)

For existing projects, auto-link tasks to specs based on title/keyword matching:

```sql
-- Find tasks that mention success criteria keywords and link them
INSERT INTO prd_tasks (id, prd_id, task_id, requirement_ref, link_type, created_at)
SELECT
  lower(hex(randomblob(16))),
  p.id,
  t.id,
  'success_criteria[' || sc.idx || ']',
  'implements',
  datetime('now')
FROM tasks t
JOIN prds p ON t.project_id = p.project_id
CROSS JOIN (
  SELECT 0 as idx UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
) sc
WHERE t.title LIKE '%' || json_extract(p.success_criteria, '$[' || sc.idx || '].criterion') || '%'
AND NOT EXISTS (
  SELECT 1 FROM prd_tasks pt WHERE pt.task_id = t.id AND pt.prd_id = p.id
);
```

---

## Appendix: Component Hierarchy

```
ProjectsContainer
├── ProjectsSubTabs
│   ├── Overview (existing)
│   ├── Spec (existing)
│   ├── Traceability (NEW)
│   └── Build (existing)
│
├── ProjectOverview (enhanced)
│   └── CoverageStatsCard (NEW)
│       └── AISyncButton (NEW)
│
├── ProjectSpec (enhanced)
│   ├── SpecCoverageColumn (NEW)
│   └── AISyncButton (NEW)
│
├── TraceabilityView (NEW)
│   ├── SpecSectionCard (NEW)
│   │   └── LinkedTaskChip (NEW)
│   └── useTraceability hook (NEW)
│
└── ProjectBuild (enhanced)
    ├── TaskGroupSelector (NEW)
    ├── TaskGroupCard (NEW)
    │   └── useGroupedTasks hook (NEW)
    └── DecompositionTree (NEW)
```
