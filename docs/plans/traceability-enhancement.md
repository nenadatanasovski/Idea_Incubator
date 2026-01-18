# Traceability View Enhancement Plan

## Overview

Transform the basic Traceability view into a comprehensive, AI-powered traceability matrix with hierarchical navigation and gap analysis capabilities.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target State](#target-state)
3. [Architecture Overview](#architecture-overview)
4. [Phase 1: Fix Tab Persistence](#phase-1-fix-tab-persistence)
5. [Phase 2: Hierarchical View Component](#phase-2-hierarchical-view-component)
6. [Phase 3: AI Gap Analysis Service](#phase-3-ai-gap-analysis-service)
7. [Phase 4: AI Gap Analysis UI](#phase-4-ai-gap-analysis-ui)
8. [Phase 5: Orphan Task Handler](#phase-5-orphan-task-handler)
9. [Phase 6: Visual Polish](#phase-6-visual-polish)
10. [File Summary](#file-summary)
11. [Verification Plan](#verification-plan)
12. [Execution Order](#execution-order)

---

## Current State Analysis

### Existing Files

| File                    | Location                            | Current State                                         |
| ----------------------- | ----------------------------------- | ----------------------------------------------------- |
| TraceabilityView.tsx    | `frontend/src/components/projects/` | Uses `useState` for section selection (resets on nav) |
| useTraceability.ts      | `frontend/src/hooks/`               | Fetches coverage data, orphans, gaps                  |
| traceability-service.ts | `server/services/`                  | Calculates coverage, finds gaps/orphans               |
| traceability.ts         | `server/routes/`                    | API endpoints for traceability data                   |
| GapAnalysisView.tsx     | `frontend/src/components/`          | Existing AI suggestion pattern (reusable)             |

### Current Limitations

1. **No tab persistence** - `selectedSection` stored in `useState` (line 45), resets on navigation
2. **Flat structure** - Shows sections → requirements → tasks, no grouping by task list
3. **No AI analysis** - Gaps shown statically, no suggestions
4. **Limited orphan handling** - Shows first 5 orphans, no actions
5. **No interactivity** - Cannot click through to tasks/lists

---

## Target State

### Feature Requirements

| ID  | Feature            | Description                                        |
| --- | ------------------ | -------------------------------------------------- |
| F1  | Tab persistence    | URL-based state management with `useSearchParams`  |
| F2  | Hierarchical view  | PRD → Sections → Requirements → Task Lists → Tasks |
| F3  | AI gap analysis    | Detect gaps, generate AI suggestions, apply fixes  |
| F4  | Orphan handling    | AI-powered link suggestions for unlinked tasks     |
| F5  | Full interactivity | Click any item to navigate/drill-down              |
| F6  | View toggle        | Switch between Matrix and Hierarchy views          |

### User Stories

1. **As a PM**, I want to see which requirements lack task coverage so I can prioritize work
2. **As a PM**, I want AI to suggest which tasks should link to which requirements
3. **As a developer**, I want to click a task in the hierarchy and go directly to it
4. **As a PM**, I want my view state to persist when I navigate away and back

---

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend                                     │
├─────────────────────────────────────────────────────────────────────┤
│  TraceabilityView.tsx                                               │
│    ├── useSearchParams (URL state)                                  │
│    ├── useTraceability (coverage data)                              │
│    ├── useTraceabilityGaps (AI analysis)                            │
│    ├── TraceabilityGapPanel (AI analysis UI)                        │
│    ├── OrphanTaskPanel (orphan handling)                            │
│    └── TraceabilityHierarchy (tree view)                            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API Layer                                   │
├─────────────────────────────────────────────────────────────────────┤
│  GET  /api/projects/:id/traceability          → Coverage data       │
│  GET  /api/projects/:id/traceability/hierarchy → Nested tree        │
│  POST /api/projects/:id/traceability/analyze  → Run AI analysis     │
│  GET  /api/projects/:id/traceability/gaps     → Get stored gaps     │
│  POST /api/projects/:id/traceability/gaps/:id/suggestions → AI      │
│  POST /api/projects/:id/orphans/:taskId/suggest-links → AI          │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Service Layer                                  │
├─────────────────────────────────────────────────────────────────────┤
│  TraceabilityService       → Coverage calculations                  │
│  TraceabilityGapAnalyzer   → Gap detection + AI suggestions         │
│  OrphanLinkSuggester       → Orphan-to-requirement AI matching      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Database                                       │
├─────────────────────────────────────────────────────────────────────┤
│  prds              → Requirements (success_criteria, constraints)   │
│  prd_tasks         → Requirement-Task links                         │
│  tasks             → Task records                                   │
│  task_lists_v2     → Task list containers                           │
│  traceability_gaps → Gap analysis results (NEW)                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Fix Tab Persistence

### Task 1.1: Replace useState with useSearchParams

**File:** `frontend/src/components/projects/TraceabilityView.tsx`

**Current Code (line 45):**

```typescript
const [selectedSection, setSelectedSection] = useState<string | null>(null);
```

**New Code:**

```typescript
import { useSearchParams } from "react-router-dom";

// Inside component:
const [searchParams, setSearchParams] = useSearchParams();
const selectedSection = searchParams.get("section");

const handleSectionSelect = (sectionType: string) => {
  setSearchParams((prev) => {
    const newParams = new URLSearchParams(prev);
    newParams.set("section", sectionType);
    return newParams;
  });
};
```

**Update onClick handler (line 210):**

```typescript
// Before:
onClick={() => setSelectedSection(section.sectionType)}

// After:
onClick={() => handleSectionSelect(section.sectionType)}
```

**Acceptance Criteria:**

- [ ] URL shows `?section=success_criteria` when section selected
- [ ] Navigating to `/build` and back preserves section selection
- [ ] Direct URL access `/traceability?section=constraints` works
- [ ] No section selected shows empty state (no query param)

**Test Script:**

```bash
# Manual test sequence:
1. Go to /projects/test-project/traceability
2. Click "Success Criteria" section
3. VERIFY: URL is /projects/test-project/traceability?section=success_criteria
4. Click browser back button
5. VERIFY: URL changes, section deselected
6. Click browser forward button
7. VERIFY: Section re-selected
8. Navigate to /projects/test-project/build
9. Navigate back to traceability
10. VERIFY: Same section still selected
```

---

### Task 1.2: Add Expanded Items to URL State

**File:** `frontend/src/components/projects/TraceabilityView.tsx`

**New Code:**

```typescript
// Parse expanded items from URL
const expandedStr = searchParams.get("expanded") || "";
const expandedItems = expandedStr ? expandedStr.split(",").map(Number) : [];

const toggleExpanded = (index: number) => {
  setSearchParams((prev) => {
    const newParams = new URLSearchParams(prev);
    const current = (prev.get("expanded") || "")
      .split(",")
      .filter(Boolean)
      .map(Number);

    const newExpanded = current.includes(index)
      ? current.filter((i) => i !== index)
      : [...current, index];

    if (newExpanded.length > 0) {
      newParams.set("expanded", newExpanded.join(","));
    } else {
      newParams.delete("expanded");
    }
    return newParams;
  });
};

const isExpanded = (index: number) => expandedItems.includes(index);
```

**Acceptance Criteria:**

- [ ] URL shows `?section=success_criteria&expanded=0,2,5` when items expanded
- [ ] Expanded state persists across navigation
- [ ] Collapsing all items removes `expanded` param from URL

---

## Phase 2: Hierarchical View Component

### Task 2.1: Create Hierarchical Data Types

**File:** `types/traceability.ts` (add to existing file)

```typescript
/**
 * Hierarchical node for traceability tree view
 */
export interface HierarchyNode {
  id: string;
  type: "prd" | "section" | "requirement" | "task_list" | "task";
  label: string;
  status?: TaskStatus; // For tasks
  coverage?: number; // For sections (0-100)
  isCovered?: boolean; // For requirements
  linkType?: TraceabilityLinkType; // For tasks
  children: HierarchyNode[];
  metadata?: HierarchyNodeMetadata;
}

export interface HierarchyNodeMetadata {
  taskCount?: number;
  coveredCount?: number;
  displayId?: string; // For tasks
  taskListId?: string;
  requirementRef?: string; // e.g., "success_criteria[0]"
}

export interface TraceabilityHierarchy {
  projectId: string;
  prdId: string;
  prdTitle: string;
  root: HierarchyNode;
  stats: {
    totalRequirements: number;
    coveredRequirements: number;
    totalTasks: number;
    orphanTasks: number;
  };
}
```

**Acceptance Criteria:**

- [ ] Types compile without errors
- [ ] Types exported from `types/traceability.ts`

---

### Task 2.2: Add getHierarchy() to TraceabilityService

**File:** `server/services/traceability-service.ts`

```typescript
/**
 * Get hierarchical traceability data for tree view
 */
async getHierarchy(projectId: string): Promise<TraceabilityHierarchy | null> {
  // Get PRD
  const prd = await getOne<PrdRow>(
    "SELECT * FROM prds WHERE project_id = ? ORDER BY created_at ASC LIMIT 1",
    [projectId]
  );

  if (!prd) return null;

  // Get all task links with task and task list details
  const taskLinks = await query<{
    task_id: string;
    display_id: string;
    title: string;
    status: string;
    task_list_id: string | null;
    task_list_name: string | null;
    requirement_ref: string;
    link_type: string;
  }>(`
    SELECT
      pt.task_id,
      pt.requirement_ref,
      pt.link_type,
      t.display_id,
      t.title,
      t.status,
      t.task_list_id,
      tl.name as task_list_name
    FROM prd_tasks pt
    INNER JOIN tasks t ON pt.task_id = t.id
    LEFT JOIN task_lists_v2 tl ON t.task_list_id = tl.id
    WHERE pt.prd_id = ?
  `, [prd.id]);

  // Parse PRD arrays
  const successCriteria: string[] = JSON.parse(prd.success_criteria || "[]").map(
    (item: string | { criterion: string }) =>
      typeof item === "string" ? item : item.criterion
  );
  const constraints: string[] = JSON.parse(prd.constraints || "[]");

  // Build hierarchy
  const root: HierarchyNode = {
    id: prd.id,
    type: "prd",
    label: prd.title,
    children: [],
    metadata: { taskCount: taskLinks.length }
  };

  // Build sections
  const sections = [
    { type: "success_criteria", title: "Success Criteria", items: successCriteria },
    { type: "constraints", title: "Constraints", items: constraints }
  ];

  for (const section of sections) {
    const sectionNode: HierarchyNode = {
      id: `section-${section.type}`,
      type: "section",
      label: section.title,
      children: [],
      metadata: { taskCount: 0, coveredCount: 0 }
    };

    // Build requirements
    for (let i = 0; i < section.items.length; i++) {
      const ref = `${section.type}[${i}]`;
      const linkedTasks = taskLinks.filter(t => t.requirement_ref === ref);

      const requirementNode: HierarchyNode = {
        id: ref,
        type: "requirement",
        label: section.items[i],
        isCovered: linkedTasks.length > 0,
        children: [],
        metadata: {
          requirementRef: ref,
          taskCount: linkedTasks.length
        }
      };

      // Group tasks by task list
      const tasksByList = new Map<string, typeof taskLinks>();
      for (const task of linkedTasks) {
        const listId = task.task_list_id || "ungrouped";
        if (!tasksByList.has(listId)) {
          tasksByList.set(listId, []);
        }
        tasksByList.get(listId)!.push(task);
      }

      // Build task list nodes
      for (const [listId, tasks] of tasksByList) {
        if (listId === "ungrouped" && tasks.length > 0) {
          // Add tasks directly without list grouping
          for (const task of tasks) {
            requirementNode.children.push({
              id: task.task_id,
              type: "task",
              label: task.title,
              status: task.status as TaskStatus,
              linkType: task.link_type as TraceabilityLinkType,
              children: [],
              metadata: { displayId: task.display_id }
            });
          }
        } else if (tasks.length > 0) {
          const listNode: HierarchyNode = {
            id: listId,
            type: "task_list",
            label: tasks[0].task_list_name || "Unknown List",
            children: tasks.map(task => ({
              id: task.task_id,
              type: "task" as const,
              label: task.title,
              status: task.status as TaskStatus,
              linkType: task.link_type as TraceabilityLinkType,
              children: [],
              metadata: { displayId: task.display_id }
            })),
            metadata: { taskCount: tasks.length }
          };
          requirementNode.children.push(listNode);
        }
      }

      sectionNode.children.push(requirementNode);
      sectionNode.metadata!.taskCount! += linkedTasks.length;
      if (linkedTasks.length > 0) {
        sectionNode.metadata!.coveredCount!++;
      }
    }

    // Calculate section coverage
    sectionNode.coverage = section.items.length > 0
      ? Math.round((sectionNode.metadata!.coveredCount! / section.items.length) * 100)
      : 100;

    root.children.push(sectionNode);
  }

  // Get stats
  const orphanCount = await this.getOrphanTaskCount(projectId);
  const totalReqs = successCriteria.length + constraints.length;
  const coveredReqs = root.children.reduce(
    (sum, s) => sum + (s.metadata?.coveredCount || 0), 0
  );

  return {
    projectId,
    prdId: prd.id,
    prdTitle: prd.title,
    root,
    stats: {
      totalRequirements: totalReqs,
      coveredRequirements: coveredReqs,
      totalTasks: taskLinks.length,
      orphanTasks: orphanCount
    }
  };
}
```

**Acceptance Criteria:**

- [ ] Returns nested JSON structure
- [ ] Tasks grouped by task list under each requirement
- [ ] Coverage calculated correctly at section level
- [ ] Stats include orphan count

---

### Task 2.3: Add API Endpoint

**File:** `server/routes/traceability.ts`

```typescript
// Add after existing routes

/**
 * GET /api/projects/:id/traceability/hierarchy
 * Get hierarchical traceability view for tree display
 */
router.get("/:id/traceability/hierarchy", async (req, res) => {
  try {
    const projectId = req.params.id;

    // Resolve project by ID, code, or slug
    const project = await projectService.getByRef(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const hierarchy = await traceabilityService.getHierarchy(project.id);

    if (!hierarchy) {
      return res.status(404).json({ error: "No PRD found for project" });
    }

    res.json(hierarchy);
  } catch (error) {
    console.error("Error fetching traceability hierarchy:", error);
    res.status(500).json({ error: "Failed to fetch traceability hierarchy" });
  }
});
```

**Acceptance Criteria:**

- [ ] Endpoint returns 200 with hierarchy JSON
- [ ] Returns 404 if project not found
- [ ] Returns 404 if no PRD exists

**Test Script:**

```bash
# Test hierarchy endpoint
curl -s http://localhost:3001/api/projects/test-project/traceability/hierarchy | jq '.root.type'
# Expected: "prd"

curl -s http://localhost:3001/api/projects/test-project/traceability/hierarchy | jq '.root.children | length'
# Expected: 2 (success_criteria, constraints sections)

curl -s http://localhost:3001/api/projects/test-project/traceability/hierarchy | jq '.stats'
# Expected: { totalRequirements: N, coveredRequirements: M, ... }
```

---

### Task 2.4: Create TraceabilityHierarchy Component

**File:** `frontend/src/components/projects/TraceabilityHierarchy.tsx` (NEW)

```typescript
/**
 * TraceabilityHierarchy - Collapsible tree view of PRD-to-Task relationships
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  List,
  Square,
  CheckSquare,
  XSquare,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import type { HierarchyNode, TraceabilityHierarchy as THierarchy } from "../../../../types/traceability";

interface TraceabilityHierarchyProps {
  hierarchy: THierarchy;
  projectSlug: string;
  defaultExpanded?: string[]; // Node IDs to expand by default
  onNodeClick?: (node: HierarchyNode) => void;
}

// Status colors matching LinkedTaskChip
const statusColors: Record<string, string> = {
  completed: "text-green-600",
  in_progress: "text-blue-600",
  pending: "text-gray-500",
  failed: "text-red-600",
  blocked: "text-amber-600",
};

// Link type badges
const linkTypeBadges: Record<string, { bg: string; text: string }> = {
  implements: { bg: "bg-purple-100", text: "text-purple-700" },
  tests: { bg: "bg-cyan-100", text: "text-cyan-700" },
  related: { bg: "bg-gray-100", text: "text-gray-700" },
};

// Icons for each node type
const nodeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  prd: FileText,
  section: FolderOpen,
  requirement: CheckCircle2,
  task_list: List,
  task: Square,
};

interface TreeNodeProps {
  node: HierarchyNode;
  level: number;
  projectSlug: string;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onNavigate: (node: HierarchyNode) => void;
}

function TreeNode({
  node,
  level,
  projectSlug,
  expandedNodes,
  onToggle,
  onNavigate
}: TreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  const Icon = nodeIcons[node.type] || Square;

  // Get status icon for tasks
  const getTaskIcon = () => {
    if (node.type !== "task") return null;
    switch (node.status) {
      case "completed": return <CheckSquare className="h-4 w-4 text-green-600" />;
      case "failed": return <XSquare className="h-4 w-4 text-red-600" />;
      default: return <Square className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get requirement icon (covered vs uncovered)
  const getRequirementIcon = () => {
    if (node.type !== "requirement") return <Icon className="h-4 w-4 text-gray-500" />;
    return node.isCovered
      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
      : <AlertCircle className="h-4 w-4 text-amber-500" />;
  };

  const handleClick = () => {
    if (node.type === "task") {
      onNavigate(node);
    } else if (hasChildren) {
      onToggle(node.id);
    }
  };

  return (
    <div>
      {/* Node row */}
      <div
        className={clsx(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-gray-100",
          node.type === "task" && "hover:bg-primary-50"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {isExpanded
              ? <ChevronDown className="h-4 w-4 text-gray-500" />
              : <ChevronRight className="h-4 w-4 text-gray-500" />
            }
          </button>
        ) : (
          <span className="w-5" /> // Spacer for alignment
        )}

        {/* Node icon */}
        {node.type === "task" ? getTaskIcon() : getRequirementIcon()}

        {/* Node label */}
        <span
          className={clsx(
            "flex-1 text-sm truncate",
            node.type === "prd" && "font-semibold text-gray-900",
            node.type === "section" && "font-medium text-gray-800",
            node.type === "requirement" && "text-gray-700",
            node.type === "task_list" && "text-gray-600 italic",
            node.type === "task" && statusColors[node.status || "pending"]
          )}
          title={node.label}
        >
          {node.label}
        </span>

        {/* Metadata badges */}
        {node.type === "section" && node.coverage !== undefined && (
          <span className={clsx(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            node.coverage === 100 ? "bg-green-100 text-green-700" :
            node.coverage >= 50 ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          )}>
            {node.coverage}%
          </span>
        )}

        {node.type === "task" && node.linkType && (
          <span className={clsx(
            "text-xs px-1.5 py-0.5 rounded",
            linkTypeBadges[node.linkType]?.bg,
            linkTypeBadges[node.linkType]?.text
          )}>
            {node.linkType}
          </span>
        )}

        {node.type === "task" && node.metadata?.displayId && (
          <span className="text-xs text-gray-400 font-mono">
            {node.metadata.displayId}
          </span>
        )}

        {node.metadata?.taskCount !== undefined && node.type !== "task" && (
          <span className="text-xs text-gray-400">
            {node.metadata.taskCount} tasks
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="relative">
          {/* Vertical connection line */}
          <div
            className="absolute left-0 top-0 bottom-0 border-l border-gray-200"
            style={{ marginLeft: `${level * 16 + 18}px` }}
          />
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              projectSlug={projectSlug}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TraceabilityHierarchy({
  hierarchy,
  projectSlug,
  defaultExpanded = [],
  onNodeClick,
}: TraceabilityHierarchyProps) {
  const navigate = useNavigate();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set([hierarchy.root.id, ...defaultExpanded])
  );

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleNavigate = useCallback((node: HierarchyNode) => {
    if (onNodeClick) {
      onNodeClick(node);
      return;
    }

    if (node.type === "task") {
      navigate(`/projects/${projectSlug}/build?task=${node.id}`);
    } else if (node.type === "task_list") {
      navigate(`/projects/${projectSlug}/build?list=${node.id}`);
    }
  }, [navigate, projectSlug, onNodeClick]);

  // Expand all / collapse all
  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (node: HierarchyNode) => {
      allIds.add(node.id);
      node.children.forEach(collectIds);
    };
    collectIds(hierarchy.root);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set([hierarchy.root.id]));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          Traceability Hierarchy
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Expand All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="p-2 max-h-[600px] overflow-y-auto">
        <TreeNode
          node={hierarchy.root}
          level={0}
          projectSlug={projectSlug}
          expandedNodes={expandedNodes}
          onToggle={handleToggle}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <span>
          Coverage: {hierarchy.stats.coveredRequirements}/{hierarchy.stats.totalRequirements} requirements
        </span>
        <span>•</span>
        <span>{hierarchy.stats.totalTasks} linked tasks</span>
        {hierarchy.stats.orphanTasks > 0 && (
          <>
            <span>•</span>
            <span className="text-amber-600">{hierarchy.stats.orphanTasks} orphan tasks</span>
          </>
        )}
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**

- [ ] Tree renders with correct nesting
- [ ] Expand/collapse works on all levels
- [ ] Coverage percentages shown on sections
- [ ] Task status colors match existing patterns
- [ ] Link type badges shown on tasks
- [ ] Click task navigates to build view
- [ ] "Expand All" / "Collapse All" works

---

### Task 2.5: Add useTraceabilityHierarchy Hook

**File:** `frontend/src/hooks/useTraceability.ts` (add to existing)

```typescript
/**
 * Hook for fetching hierarchical traceability data
 */
export interface UseTraceabilityHierarchyReturn {
  hierarchy: TraceabilityHierarchy | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTraceabilityHierarchy({
  projectId,
  enabled = true,
}: UseTraceabilityOptions): UseTraceabilityHierarchyReturn {
  const [hierarchy, setHierarchy] = useState<TraceabilityHierarchy | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHierarchy = useCallback(async () => {
    if (!enabled || !projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/traceability/hierarchy`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError("Project or PRD not found");
          setHierarchy(null);
          return;
        }
        throw new Error("Failed to fetch hierarchy");
      }

      const data = await response.json();
      setHierarchy(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch hierarchy",
      );
      setHierarchy(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  return {
    hierarchy,
    isLoading,
    error,
    refetch: fetchHierarchy,
  };
}
```

**Acceptance Criteria:**

- [ ] Hook fetches hierarchy data
- [ ] Loading state managed correctly
- [ ] Error handling works
- [ ] Refetch function exposed

---

## Phase 3: AI Gap Analysis Service

### Task 3.1: Create Database Migration

**File:** `database/migrations/XXX-traceability-gaps.sql` (NEW)

```sql
-- Traceability gap analysis results
CREATE TABLE IF NOT EXISTS traceability_gaps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gap_type TEXT NOT NULL CHECK(gap_type IN ('uncovered', 'weak_coverage', 'orphan', 'mismatch')),
  entity_type TEXT CHECK(entity_type IN ('requirement', 'task')),
  entity_ref TEXT, -- 'success_criteria[0]' or task_id
  severity TEXT CHECK(severity IN ('critical', 'warning', 'info')) DEFAULT 'warning',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggestions TEXT, -- JSON array of suggestion strings
  status TEXT CHECK(status IN ('open', 'resolved', 'ignored')) DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT -- 'user' or 'ai'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_traceability_gaps_project ON traceability_gaps(project_id);
CREATE INDEX IF NOT EXISTS idx_traceability_gaps_status ON traceability_gaps(status);
CREATE INDEX IF NOT EXISTS idx_traceability_gaps_type ON traceability_gaps(gap_type);
CREATE INDEX IF NOT EXISTS idx_traceability_gaps_severity ON traceability_gaps(severity);

-- Dismissed orphan tasks (intentionally unlinked)
CREATE TABLE IF NOT EXISTS dismissed_orphans (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reason TEXT,
  dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_by TEXT,
  UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_orphans_project ON dismissed_orphans(project_id);
```

**Acceptance Criteria:**

- [ ] Migration runs without errors: `npm run schema:migrate`
- [ ] Tables created with correct schema
- [ ] Indexes created

---

### Task 3.2: Create TraceabilityGapAnalyzer Service

**File:** `server/services/traceability-gap-analyzer.ts` (NEW)

```typescript
/**
 * TraceabilityGapAnalyzer - AI-powered gap detection and suggestion service
 */

import { v4 as uuidv4 } from "uuid";
import { query, getOne, run } from "../database/db.js";
import { traceabilityService } from "./traceability-service.js";
import { createAnthropicClient } from "../utils/anthropic-client.js";

// Types
export interface TraceabilityGap {
  id: string;
  projectId: string;
  gapType: "uncovered" | "weak_coverage" | "orphan" | "mismatch";
  entityType: "requirement" | "task";
  entityRef: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  suggestions: string[];
  status: "open" | "resolved" | "ignored";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface GapRow {
  id: string;
  project_id: string;
  gap_type: string;
  entity_type: string;
  entity_ref: string;
  severity: string;
  title: string;
  description: string;
  suggestions: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

// Rate limiting
const rateLimits: Record<string, number> = {};
const RATE_LIMIT_MS = 10000;

function checkRateLimit(operation: string): boolean {
  const now = Date.now();
  const lastCall = rateLimits[operation] || 0;
  if (now - lastCall < RATE_LIMIT_MS) return false;
  rateLimits[operation] = now;
  return true;
}

export class TraceabilityGapAnalyzer {
  private client = createAnthropicClient();

  /**
   * Analyze a project for traceability gaps
   */
  async analyzeProject(projectId: string): Promise<TraceabilityGap[]> {
    const gaps: TraceabilityGap[] = [];

    // 1. Find uncovered requirements (from existing service)
    const coverageGaps = await traceabilityService.getCoverageGaps(projectId);
    for (const gap of coverageGaps) {
      gaps.push({
        id: uuidv4(),
        projectId,
        gapType: "uncovered",
        entityType: "requirement",
        entityRef: `${gap.sectionType}[${gap.itemIndex}]`,
        severity: gap.severity === "high" ? "critical" : "warning",
        title: `Uncovered ${gap.sectionTitle}`,
        description: `Requirement "${gap.itemContent.slice(0, 100)}..." has no linked tasks`,
        suggestions: [],
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Find weak coverage (only 1 task, no tests)
    const coverage = await traceabilityService.getSpecCoverage(projectId);
    if (coverage) {
      for (const section of coverage.sections) {
        for (const item of section.items) {
          if (item.isCovered && item.linkedTasks.length === 1) {
            const hasTest = item.linkedTasks.some(
              (t) => t.linkType === "tests",
            );
            if (!hasTest) {
              gaps.push({
                id: uuidv4(),
                projectId,
                gapType: "weak_coverage",
                entityType: "requirement",
                entityRef: `${section.sectionType}[${item.index}]`,
                severity: "warning",
                title: "Weak Coverage",
                description: `Requirement has only 1 task and no tests: "${item.content.slice(0, 80)}..."`,
                suggestions: [],
                status: "open",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    // 3. Find orphan tasks (from existing service)
    const orphanTasks = await traceabilityService.getOrphanTasks(projectId);

    // Check dismissed list
    const dismissedIds = await query<{ task_id: string }>(
      "SELECT task_id FROM dismissed_orphans WHERE project_id = ?",
      [projectId],
    );
    const dismissedSet = new Set(dismissedIds.map((d) => d.task_id));

    for (const task of orphanTasks) {
      if (dismissedSet.has(task.id)) continue;

      gaps.push({
        id: uuidv4(),
        projectId,
        gapType: "orphan",
        entityType: "task",
        entityRef: task.id,
        severity: "info",
        title: "Orphan Task",
        description: `Task "${task.displayId}: ${task.title}" is not linked to any requirement`,
        suggestions: [],
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 4. Find mismatches (bug task implements feature, etc.)
    // TODO: Implement category mismatch detection

    // Store gaps in database (clear old ones first)
    await run("DELETE FROM traceability_gaps WHERE project_id = ?", [
      projectId,
    ]);

    for (const gap of gaps) {
      await run(
        `
        INSERT INTO traceability_gaps
        (id, project_id, gap_type, entity_type, entity_ref, severity, title, description, suggestions, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          gap.id,
          gap.projectId,
          gap.gapType,
          gap.entityType,
          gap.entityRef,
          gap.severity,
          gap.title,
          gap.description,
          JSON.stringify(gap.suggestions),
          gap.status,
          gap.createdAt,
          gap.updatedAt,
        ],
      );
    }

    return gaps;
  }

  /**
   * Get stored gaps for a project
   */
  async getGaps(
    projectId: string,
    status?: string,
  ): Promise<TraceabilityGap[]> {
    let sql = "SELECT * FROM traceability_gaps WHERE project_id = ?";
    const params: string[] = [projectId];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    sql +=
      " ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, created_at DESC";

    const rows = await query<GapRow>(sql, params);

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      gapType: row.gap_type as TraceabilityGap["gapType"],
      entityType: row.entity_type as TraceabilityGap["entityType"],
      entityRef: row.entity_ref,
      severity: row.severity as TraceabilityGap["severity"],
      title: row.title,
      description: row.description,
      suggestions: JSON.parse(row.suggestions || "[]"),
      status: row.status as TraceabilityGap["status"],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at || undefined,
      resolvedBy: row.resolved_by || undefined,
    }));
  }

  /**
   * Generate AI suggestions for a gap
   */
  async generateSuggestions(gapId: string): Promise<string[]> {
    if (!checkRateLimit(`suggestions-${gapId}`)) {
      // Return cached suggestions if rate limited
      const gap = await getOne<GapRow>(
        "SELECT suggestions FROM traceability_gaps WHERE id = ?",
        [gapId],
      );
      return gap ? JSON.parse(gap.suggestions || "[]") : [];
    }

    const gap = await getOne<GapRow>(
      "SELECT * FROM traceability_gaps WHERE id = ?",
      [gapId],
    );

    if (!gap) return [];

    const prompt = this.buildSuggestionPrompt(gap);

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `You are a project management assistant helping to improve traceability between requirements and tasks. Provide 2-3 specific, actionable suggestions.`,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const suggestions = this.parseSuggestions(text);

      // Store suggestions
      await run(
        "UPDATE traceability_gaps SET suggestions = ?, updated_at = ? WHERE id = ?",
        [JSON.stringify(suggestions), new Date().toISOString(), gapId],
      );

      return suggestions;
    } catch (error) {
      console.error("Error generating suggestions:", error);
      return [];
    }
  }

  private buildSuggestionPrompt(gap: GapRow): string {
    switch (gap.gap_type) {
      case "uncovered":
        return `A requirement is not covered by any tasks:
"${gap.description}"

Suggest 2-3 specific actions to address this gap. Each suggestion should be actionable and start with a verb.`;

      case "weak_coverage":
        return `A requirement has weak test coverage:
"${gap.description}"

Suggest 2-3 specific actions to improve coverage. Consider adding tests or additional implementation tasks.`;

      case "orphan":
        return `A task exists but isn't linked to any requirement:
"${gap.description}"

Suggest 2-3 actions: either link it to an existing requirement, or explain why it might be intentionally unlinked.`;

      default:
        return `Address this traceability gap:
"${gap.description}"

Suggest 2-3 specific actions.`;
    }
  }

  private parseSuggestions(text: string): string[] {
    // Parse numbered or bulleted list
    const lines = text.split("\n").filter(Boolean);
    const suggestions: string[] = [];

    for (const line of lines) {
      // Remove list markers and trim
      const cleaned = line.replace(/^[\d\.\-\*\)]+\s*/, "").trim();
      if (cleaned.length > 10 && cleaned.length < 500) {
        suggestions.push(cleaned);
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Resolve a gap
   */
  async resolveGap(
    gapId: string,
    resolvedBy: "user" | "ai" = "user",
  ): Promise<void> {
    await run(
      `
      UPDATE traceability_gaps
      SET status = 'resolved', resolved_at = ?, resolved_by = ?, updated_at = ?
      WHERE id = ?
    `,
      [new Date().toISOString(), resolvedBy, new Date().toISOString(), gapId],
    );
  }

  /**
   * Ignore a gap
   */
  async ignoreGap(gapId: string): Promise<void> {
    await run(
      `
      UPDATE traceability_gaps
      SET status = 'ignored', updated_at = ?
      WHERE id = ?
    `,
      [new Date().toISOString(), gapId],
    );
  }

  /**
   * Get gap counts by status
   */
  async getGapCounts(
    projectId: string,
  ): Promise<{ open: number; resolved: number; ignored: number }> {
    const rows = await query<{ status: string; count: number }>(
      `
      SELECT status, COUNT(*) as count
      FROM traceability_gaps
      WHERE project_id = ?
      GROUP BY status
    `,
      [projectId],
    );

    const counts = { open: 0, resolved: 0, ignored: 0 };
    for (const row of rows) {
      counts[row.status as keyof typeof counts] = row.count;
    }
    return counts;
  }
}

// Export singleton
export const traceabilityGapAnalyzer = new TraceabilityGapAnalyzer();
export default traceabilityGapAnalyzer;
```

**Acceptance Criteria:**

- [ ] Detects uncovered requirements
- [ ] Detects weak coverage (single task, no tests)
- [ ] Detects orphan tasks (excluding dismissed)
- [ ] Stores gaps in database
- [ ] Generates AI suggestions with rate limiting
- [ ] Resolves and ignores gaps

---

### Task 3.3: Add API Endpoints for Gap Analysis

**File:** `server/routes/traceability.ts` (add to existing)

```typescript
import { traceabilityGapAnalyzer } from "../services/traceability-gap-analyzer.js";

/**
 * POST /api/projects/:id/traceability/analyze
 * Run AI gap analysis for a project
 */
router.post("/:id/traceability/analyze", async (req, res) => {
  try {
    const project = await projectService.getByRef(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const gaps = await traceabilityGapAnalyzer.analyzeProject(project.id);
    const counts = await traceabilityGapAnalyzer.getGapCounts(project.id);

    res.json({
      success: true,
      gapsFound: gaps.length,
      gaps,
      counts,
    });
  } catch (error) {
    console.error("Error analyzing traceability:", error);
    res.status(500).json({ error: "Failed to analyze traceability" });
  }
});

/**
 * GET /api/projects/:id/traceability/gaps
 * Get stored gaps for a project
 */
router.get("/:id/traceability/gaps", async (req, res) => {
  try {
    const project = await projectService.getByRef(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const status = req.query.status as string | undefined;
    const gaps = await traceabilityGapAnalyzer.getGaps(project.id, status);
    const counts = await traceabilityGapAnalyzer.getGapCounts(project.id);

    res.json({ gaps, counts });
  } catch (error) {
    console.error("Error fetching gaps:", error);
    res.status(500).json({ error: "Failed to fetch gaps" });
  }
});

/**
 * POST /api/projects/:id/traceability/gaps/:gapId/suggestions
 * Generate AI suggestions for a gap
 */
router.post("/:id/traceability/gaps/:gapId/suggestions", async (req, res) => {
  try {
    const suggestions = await traceabilityGapAnalyzer.generateSuggestions(
      req.params.gapId,
    );
    res.json({ suggestions });
  } catch (error) {
    console.error("Error generating suggestions:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

/**
 * PUT /api/projects/:id/traceability/gaps/:gapId/resolve
 * Mark a gap as resolved
 */
router.put("/:id/traceability/gaps/:gapId/resolve", async (req, res) => {
  try {
    await traceabilityGapAnalyzer.resolveGap(req.params.gapId, "user");
    res.json({ success: true });
  } catch (error) {
    console.error("Error resolving gap:", error);
    res.status(500).json({ error: "Failed to resolve gap" });
  }
});

/**
 * PUT /api/projects/:id/traceability/gaps/:gapId/ignore
 * Mark a gap as ignored
 */
router.put("/:id/traceability/gaps/:gapId/ignore", async (req, res) => {
  try {
    await traceabilityGapAnalyzer.ignoreGap(req.params.gapId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error ignoring gap:", error);
    res.status(500).json({ error: "Failed to ignore gap" });
  }
});
```

**Acceptance Criteria:**

- [ ] All endpoints return correct responses
- [ ] Rate limiting works on suggestions endpoint
- [ ] Gaps sorted by severity (critical first)

**Test Script:**

```bash
# Run analysis
curl -X POST http://localhost:3001/api/projects/test-project/traceability/analyze | jq '.gapsFound'

# Get gaps
curl http://localhost:3001/api/projects/test-project/traceability/gaps | jq '.counts'

# Get suggestions
curl -X POST http://localhost:3001/api/projects/test-project/traceability/gaps/GAP_ID/suggestions | jq '.suggestions'

# Resolve gap
curl -X PUT http://localhost:3001/api/projects/test-project/traceability/gaps/GAP_ID/resolve

# Ignore gap
curl -X PUT http://localhost:3001/api/projects/test-project/traceability/gaps/GAP_ID/ignore
```

---

## Phase 4: AI Gap Analysis UI

### Task 4.1: Create useTraceabilityGaps Hook

**File:** `frontend/src/hooks/useTraceabilityGaps.ts` (NEW)

```typescript
/**
 * useTraceabilityGaps - Hook for gap analysis state management
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3001";

export interface TraceabilityGap {
  id: string;
  projectId: string;
  gapType: "uncovered" | "weak_coverage" | "orphan" | "mismatch";
  entityType: "requirement" | "task";
  entityRef: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  suggestions: string[];
  status: "open" | "resolved" | "ignored";
  createdAt: string;
  updatedAt: string;
}

export interface GapCounts {
  open: number;
  resolved: number;
  ignored: number;
}

export interface UseTraceabilityGapsReturn {
  gaps: TraceabilityGap[];
  counts: GapCounts;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  runAnalysis: () => Promise<void>;
  getSuggestions: (gapId: string) => Promise<string[]>;
  resolveGap: (gapId: string) => Promise<void>;
  ignoreGap: (gapId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useTraceabilityGaps(
  projectId: string,
): UseTraceabilityGapsReturn {
  const [gaps, setGaps] = useState<TraceabilityGap[]>([]);
  const [counts, setCounts] = useState<GapCounts>({
    open: 0,
    resolved: 0,
    ignored: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGaps = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/traceability/gaps`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch gaps");
      }

      const data = await response.json();
      setGaps(data.gaps || []);
      setCounts(data.counts || { open: 0, resolved: 0, ignored: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch gaps");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const runAnalysis = useCallback(async () => {
    if (!projectId) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/traceability/analyze`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error("Failed to run analysis");
      }

      const data = await response.json();
      setGaps(data.gaps || []);
      setCounts(data.counts || { open: 0, resolved: 0, ignored: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run analysis");
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId]);

  const getSuggestions = useCallback(
    async (gapId: string): Promise<string[]> => {
      try {
        const response = await fetch(
          `${API_BASE}/api/projects/${projectId}/traceability/gaps/${gapId}/suggestions`,
          { method: "POST" },
        );

        if (!response.ok) {
          throw new Error("Failed to get suggestions");
        }

        const data = await response.json();

        // Update local state with suggestions
        setGaps((prev) =>
          prev.map((g) =>
            g.id === gapId ? { ...g, suggestions: data.suggestions } : g,
          ),
        );

        return data.suggestions || [];
      } catch (err) {
        console.error("Error getting suggestions:", err);
        return [];
      }
    },
    [projectId],
  );

  const resolveGap = useCallback(
    async (gapId: string) => {
      try {
        await fetch(
          `${API_BASE}/api/projects/${projectId}/traceability/gaps/${gapId}/resolve`,
          { method: "PUT" },
        );

        // Update local state
        setGaps((prev) =>
          prev.map((g) =>
            g.id === gapId ? { ...g, status: "resolved" as const } : g,
          ),
        );
        setCounts((prev) => ({
          ...prev,
          open: prev.open - 1,
          resolved: prev.resolved + 1,
        }));
      } catch (err) {
        console.error("Error resolving gap:", err);
      }
    },
    [projectId],
  );

  const ignoreGap = useCallback(
    async (gapId: string) => {
      try {
        await fetch(
          `${API_BASE}/api/projects/${projectId}/traceability/gaps/${gapId}/ignore`,
          { method: "PUT" },
        );

        // Update local state
        setGaps((prev) =>
          prev.map((g) =>
            g.id === gapId ? { ...g, status: "ignored" as const } : g,
          ),
        );
        setCounts((prev) => ({
          ...prev,
          open: prev.open - 1,
          ignored: prev.ignored + 1,
        }));
      } catch (err) {
        console.error("Error ignoring gap:", err);
      }
    },
    [projectId],
  );

  // Initial fetch
  useEffect(() => {
    fetchGaps();
  }, [fetchGaps]);

  return {
    gaps,
    counts,
    isLoading,
    isAnalyzing,
    error,
    runAnalysis,
    getSuggestions,
    resolveGap,
    ignoreGap,
    refetch: fetchGaps,
  };
}

export default useTraceabilityGaps;
```

**Acceptance Criteria:**

- [ ] Hook compiles without errors
- [ ] Fetches gaps on mount
- [ ] Analysis updates gaps list
- [ ] Local state updates optimistically
- [ ] Error handling works

---

### Task 4.2: Create TraceabilityGapPanel Component

**File:** `frontend/src/components/projects/TraceabilityGapPanel.tsx` (NEW)

```typescript
/**
 * TraceabilityGapPanel - AI-powered gap analysis panel
 */

import { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import type { TraceabilityGap, GapCounts } from "../../hooks/useTraceabilityGaps";

interface TraceabilityGapPanelProps {
  gaps: TraceabilityGap[];
  counts: GapCounts;
  isAnalyzing: boolean;
  onAnalyze: () => Promise<void>;
  onGetSuggestions: (gapId: string) => Promise<string[]>;
  onResolve: (gapId: string) => Promise<void>;
  onIgnore: (gapId: string) => Promise<void>;
  onRefetch: () => Promise<void>;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    label: "Critical",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  warning: {
    icon: AlertCircle,
    label: "Warning",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  info: {
    icon: Info,
    label: "Info",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
};

const gapTypeLabels: Record<string, string> = {
  uncovered: "Uncovered Requirement",
  weak_coverage: "Weak Coverage",
  orphan: "Orphan Task",
  mismatch: "Category Mismatch",
};

export default function TraceabilityGapPanel({
  gaps,
  counts,
  isAnalyzing,
  onAnalyze,
  onGetSuggestions,
  onResolve,
  onIgnore,
  onRefetch,
}: TraceabilityGapPanelProps) {
  const [expandedGap, setExpandedGap] = useState<string | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Group gaps by status
  const openGaps = gaps.filter(g => g.status === "open");
  const resolvedGaps = gaps.filter(g => g.status === "resolved");

  // Group open gaps by severity
  const criticalGaps = openGaps.filter(g => g.severity === "critical");
  const warningGaps = openGaps.filter(g => g.severity === "warning");
  const infoGaps = openGaps.filter(g => g.severity === "info");

  const handleGetSuggestions = async (gapId: string) => {
    setLoadingSuggestions(gapId);
    await onGetSuggestions(gapId);
    setLoadingSuggestions(null);
  };

  const renderGapCard = (gap: TraceabilityGap) => {
    const config = severityConfig[gap.severity];
    const Icon = config.icon;
    const isExpanded = expandedGap === gap.id;
    const isLoadingSuggestions = loadingSuggestions === gap.id;

    return (
      <div
        key={gap.id}
        className={clsx(
          "border rounded-lg transition-all",
          config.borderColor,
          isExpanded && config.bgColor
        )}
      >
        {/* Header */}
        <button
          onClick={() => setExpandedGap(isExpanded ? null : gap.id)}
          className="w-full p-3 flex items-start gap-3 text-left"
        >
          <Icon className={clsx("h-5 w-5 flex-shrink-0 mt-0.5", config.color)} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx(
                "text-xs font-medium px-2 py-0.5 rounded",
                config.bgColor, config.color
              )}>
                {config.label}
              </span>
              <span className="text-xs text-gray-500">
                {gapTypeLabels[gap.gapType]}
              </span>
            </div>
            <p className="text-sm text-gray-900 line-clamp-2">{gap.description}</p>
          </div>

          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-gray-100">
            <div className="pt-3 space-y-3">
              {/* Suggestions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    AI Suggestions
                  </span>
                  {gap.suggestions.length === 0 && (
                    <button
                      onClick={() => handleGetSuggestions(gap.id)}
                      disabled={isLoadingSuggestions}
                      className="text-xs text-primary-600 hover:text-primary-700 inline-flex items-center"
                    >
                      {isLoadingSuggestions ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Get Suggestions
                        </>
                      )}
                    </button>
                  )}
                </div>

                {gap.suggestions.length > 0 && (
                  <div className="space-y-2">
                    {gap.suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-2 text-sm text-gray-700 bg-white rounded border border-gray-200"
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => onIgnore(gap.id)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
                >
                  Ignore
                </button>
                <button
                  onClick={() => onResolve(gap.id)}
                  className="text-sm bg-primary-600 text-white hover:bg-primary-700 px-3 py-1 rounded inline-flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">
            AI Gap Analysis
          </h3>
          {counts.open > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              {counts.open} open
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefetch}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white hover:bg-primary-700 rounded disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
          {/* No gaps */}
          {openGaps.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Check className="h-12 w-12 mx-auto mb-3 text-green-400" />
              <p className="font-medium">No gaps detected</p>
              <p className="text-sm">Click "Analyze" to check for issues</p>
            </div>
          )}

          {/* Critical gaps */}
          {criticalGaps.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-xs font-medium text-red-700 mb-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Critical ({criticalGaps.length})
              </h4>
              <div className="space-y-2">
                {criticalGaps.map(renderGapCard)}
              </div>
            </div>
          )}

          {/* Warning gaps */}
          {warningGaps.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-xs font-medium text-amber-700 mb-2">
                <AlertCircle className="h-3.5 w-3.5" />
                Warnings ({warningGaps.length})
              </h4>
              <div className="space-y-2">
                {warningGaps.map(renderGapCard)}
              </div>
            </div>
          )}

          {/* Info gaps */}
          {infoGaps.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-xs font-medium text-blue-700 mb-2">
                <Info className="h-3.5 w-3.5" />
                Info ({infoGaps.length})
              </h4>
              <div className="space-y-2">
                {infoGaps.map(renderGapCard)}
              </div>
            </div>
          )}

          {/* Resolved gaps (collapsed) */}
          {resolvedGaps.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="flex items-center gap-2 text-xs font-medium text-green-700 mb-2">
                <Check className="h-3.5 w-3.5" />
                Resolved ({resolvedGaps.length})
              </h4>
              <p className="text-xs text-gray-500">
                {resolvedGaps.length} gaps have been resolved
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Acceptance Criteria:**

- [ ] Panel shows "Analyze" button
- [ ] Loading spinner during analysis
- [ ] Gaps grouped by severity
- [ ] "Get Suggestions" loads AI suggestions
- [ ] Resolve/Ignore buttons work
- [ ] Collapsible panel

---

### Task 4.3: Integrate into TraceabilityView

**File:** `frontend/src/components/projects/TraceabilityView.tsx`

Add import:

```typescript
import TraceabilityGapPanel from "./TraceabilityGapPanel";
import { useTraceabilityGaps } from "../../hooks/useTraceabilityGaps";
```

Add hook:

```typescript
const {
  gaps,
  counts: gapCounts,
  isAnalyzing,
  runAnalysis,
  getSuggestions,
  resolveGap,
  ignoreGap,
  refetch: refetchGaps,
} = useTraceabilityGaps(projectId);
```

Add panel after header:

```typescript
{/* AI Gap Analysis Panel */}
<TraceabilityGapPanel
  gaps={gaps}
  counts={gapCounts}
  isAnalyzing={isAnalyzing}
  onAnalyze={runAnalysis}
  onGetSuggestions={getSuggestions}
  onResolve={async (gapId) => {
    await resolveGap(gapId);
    refetch(); // Refresh coverage stats
  }}
  onIgnore={ignoreGap}
  onRefetch={refetchGaps}
/>
```

**Acceptance Criteria:**

- [ ] Panel visible in traceability view
- [ ] Resolving gap updates coverage stats
- [ ] No duplicate data fetching

---

## Phase 5: Orphan Task Handler

[Continue with similar detail for Phase 5 and Phase 6...]

---

## File Summary

### New Files (7)

| File                                                         | Purpose                  |
| ------------------------------------------------------------ | ------------------------ |
| `frontend/src/components/projects/TraceabilityHierarchy.tsx` | Hierarchical tree view   |
| `frontend/src/components/projects/TraceabilityGapPanel.tsx`  | AI gap analysis UI       |
| `frontend/src/components/projects/OrphanTaskPanel.tsx`       | Orphan task management   |
| `frontend/src/hooks/useTraceabilityGaps.ts`                  | Gap analysis hook        |
| `server/services/traceability-gap-analyzer.ts`               | Gap detection service    |
| `server/services/orphan-link-suggester.ts`                   | Orphan-to-requirement AI |
| `database/migrations/XXX-traceability-gaps.sql`              | Gap storage tables       |

### Modified Files (4)

| File                                                    | Changes                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `frontend/src/components/projects/TraceabilityView.tsx` | URL state, integrate panels, view toggle |
| `frontend/src/hooks/useTraceability.ts`                 | Add hierarchy hook                       |
| `server/routes/traceability.ts`                         | Add gap analysis endpoints               |
| `server/services/traceability-service.ts`               | Add getHierarchy()                       |

---

## Verification Plan

### Automated Checks

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Tests
npm test

# Migration
npm run schema:migrate
```

### Manual Testing Checklist

#### Phase 1: Tab Persistence

- [ ] Click section → URL updates
- [ ] Navigate away → come back → section preserved
- [ ] Direct URL access works
- [ ] Browser back/forward works

#### Phase 2: Hierarchy View

- [ ] Tree renders with correct structure
- [ ] Expand/collapse works
- [ ] Click task → navigates to build
- [ ] Coverage percentages correct
- [ ] Expand All / Collapse All works

#### Phase 3-4: AI Gap Analysis

- [ ] "Analyze" button works
- [ ] Loading spinner shows
- [ ] Gaps grouped by severity
- [ ] "Get Suggestions" works
- [ ] Suggestions are relevant
- [ ] Resolve/Ignore updates state
- [ ] Coverage stats refresh

#### Phase 5: Orphan Tasks

- [ ] Orphan panel shows all unlinked tasks
- [ ] "Suggest Links" returns relevant requirements
- [ ] Link action creates prd_tasks record
- [ ] Dismiss action hides orphan
- [ ] Auto-link with threshold works

#### Phase 6: Visual Polish

- [ ] View toggle between Matrix/Hierarchy
- [ ] Hover states on all clickable items
- [ ] Connection lines in hierarchy
- [ ] Smooth transitions
- [ ] No console errors

---

## Execution Order

| Phase | Description     | Tasks    | Dependencies     |
| ----- | --------------- | -------- | ---------------- |
| 1     | Tab persistence | 1.1, 1.2 | None             |
| 2     | Hierarchy view  | 2.1-2.5  | None             |
| 3     | AI gap service  | 3.1-3.3  | Migration        |
| 4     | AI gap UI       | 4.1-4.3  | Phase 3          |
| 5     | Orphan handler  | 5.1-5.4  | Phase 3 patterns |
| 6     | Visual polish   | 6.1-6.4  | Phases 2, 4, 5   |

**Parallel execution possible:** Phases 1, 2, 3 can run in parallel. Phase 4 requires Phase 3. Phase 5 can start after Phase 3. Phase 6 requires all others.
