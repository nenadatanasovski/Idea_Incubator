# Node Group Reports - Implementation Plan

## Overview

AI-synthesized reports for connected node groups in the memory graph, generated as a background async activity following the source mapping pattern.

---

## Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   BACKGROUND JOB CHAIN                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [User clicks "Analyze Sources"]                                │
│            ↓                                                    │
│  [Apply Changes] → creates nodes/edges                          │
│            ↓                                                    │
│  [Source Mapping Job] (existing)                                │
│            ↓ (WebSocket: source_mapping_complete)               │
│  [Report Synthesis Job] (NEW - auto-triggered)                  │
│            ↓ (WebSocket: report_synthesis_*)                    │
│  [Reports Stored in DB]                                         │
│            ↓                                                    │
│  [UI Updates: NodeInspector + MemoryDB tabs]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Node Group Definition

A **node group** is a connected component in the graph - nodes that are reachable from each other via edges (treated as undirected for grouping purposes).

Uses existing: `frontend/src/components/graph/utils/connectedComponents.ts`

---

## Database Schema

### New Table: `node_group_reports`

```sql
CREATE TABLE node_group_reports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL,

  -- Group identification
  node_ids TEXT NOT NULL,           -- JSON array of node IDs in this group
  group_hash TEXT NOT NULL,         -- SHA256 of sorted node_ids for quick lookup
  group_name TEXT,                  -- AI-generated name for the group

  -- Report sections (AI-generated)
  overview TEXT,                    -- 1-2 paragraph summary
  key_themes TEXT,                  -- JSON array of theme bullets
  story TEXT,                       -- Multi-paragraph narrative with node references
  relationships_to_groups TEXT,     -- JSON: [{groupHash, groupName, relationship}]
  open_questions TEXT,              -- JSON array of gaps/tensions detected
  nodes_summary TEXT,               -- JSON: [{nodeId, title, oneLiner}]

  -- Metadata
  status TEXT NOT NULL DEFAULT 'current',  -- 'current' | 'stale'
  node_count INTEGER NOT NULL,
  edge_count INTEGER NOT NULL,
  generated_at TEXT DEFAULT (datetime('now')),
  generation_duration_ms INTEGER,
  model_used TEXT,

  -- Constraints
  FOREIGN KEY (session_id) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  UNIQUE(session_id, group_hash)
);

CREATE INDEX idx_node_group_reports_session ON node_group_reports(session_id);
CREATE INDEX idx_node_group_reports_status ON node_group_reports(status);
CREATE INDEX idx_node_group_reports_hash ON node_group_reports(group_hash);
```

---

## Task Breakdown

### Task 1: Database Migration

**File**: `database/migrations/XXX_node_group_reports.sql`

**Implementation**:

- Create the `node_group_reports` table as specified above
- Add indexes for session_id, status, and group_hash

**Test Script**:

```bash
# Run migration
npm run schema:migrate

# Verify table exists
sqlite3 database/ideation.db ".schema node_group_reports"

# Verify indexes
sqlite3 database/ideation.db ".indexes node_group_reports"
```

**Pass Criteria**:

- [ ] Table `node_group_reports` exists with all columns
- [ ] All three indexes are created
- [ ] Foreign key constraint to `ideation_sessions` works
- [ ] Unique constraint on `(session_id, group_hash)` works

**Expected Outcome**:

```
CREATE TABLE node_group_reports (
  id TEXT PRIMARY KEY...
  ...
);
idx_node_group_reports_hash
idx_node_group_reports_session
idx_node_group_reports_status
```

---

### Task 2: Drizzle Schema Entity

**File**: `schema/entities/node-group-report.ts`

**Implementation**:

```typescript
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { ideationSessions } from "./ideation-session";

export const nodeGroupReports = sqliteTable(
  "node_group_reports",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => ideationSessions.id, { onDelete: "cascade" }),

    // Group identification
    nodeIds: text("node_ids").notNull(), // JSON array
    groupHash: text("group_hash").notNull(),
    groupName: text("group_name"),

    // Report sections
    overview: text("overview"),
    keyThemes: text("key_themes"), // JSON array
    story: text("story"),
    relationshipsToGroups: text("relationships_to_groups"), // JSON
    openQuestions: text("open_questions"), // JSON array
    nodesSummary: text("nodes_summary"), // JSON array

    // Metadata
    status: text("status").notNull().default("current"),
    nodeCount: integer("node_count").notNull(),
    edgeCount: integer("edge_count").notNull(),
    generatedAt: text("generated_at"),
    generationDurationMs: integer("generation_duration_ms"),
    modelUsed: text("model_used"),
  },
  (table) => ({
    sessionIdx: index("idx_node_group_reports_session").on(table.sessionId),
    statusIdx: index("idx_node_group_reports_status").on(table.status),
    hashIdx: index("idx_node_group_reports_hash").on(table.groupHash),
    uniqueSessionHash: uniqueIndex("idx_node_group_reports_unique").on(
      table.sessionId,
      table.groupHash,
    ),
  }),
);

export type NodeGroupReport = typeof nodeGroupReports.$inferSelect;
export type NewNodeGroupReport = typeof nodeGroupReports.$inferInsert;
```

**Test Script**:

```bash
# Generate schema
npm run schema:generate

# Check for type errors
npx tsc --noEmit schema/entities/node-group-report.ts
```

**Pass Criteria**:

- [ ] No TypeScript errors
- [ ] Schema generates migration matching Task 1
- [ ] Types `NodeGroupReport` and `NewNodeGroupReport` are exported

**Expected Outcome**:

- Clean TypeScript compilation
- Drizzle schema matches SQL migration

---

### Task 3: Report Synthesis Tracker Service

**File**: `server/services/graph/report-synthesis-tracker.ts`

**Implementation**:
Follow the pattern from `source-mapping-tracker.ts`:

```typescript
export type ReportSynthesisStatus =
  | "pending"
  | "detecting_groups"
  | "generating"
  | "complete"
  | "failed"
  | "cancelled";

export interface ReportSynthesisJob {
  jobId: string;
  sessionId: string;
  status: ReportSynthesisStatus;
  totalGroups: number;
  completedGroups: number;
  currentGroupName?: string;
  reportsCreated: number;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  abortController: AbortController;
}

export class ReportSynthesisTracker {
  private activeJobs: Map<string, ReportSynthesisJob>;
  private recentJobs: Map<string, ReportSynthesisJob>;

  createJob(sessionId: string): ReportSynthesisJob;
  updateDetectingGroups(sessionId: string): void;
  updateGenerating(
    sessionId: string,
    totalGroups: number,
    completedGroups: number,
    currentGroupName: string,
  ): void;
  completeJob(sessionId: string, reportsCreated: number): void;
  failJob(sessionId: string, error: string): void;
  cancelJob(sessionId: string, reason: string): boolean;
  getJobStatus(sessionId: string): ReportSynthesisJob | null;
  hasActiveJob(sessionId: string): boolean;
  isCancelled(sessionId: string): boolean;
}
```

**Test Script**:

```typescript
// tests/unit/report-synthesis-tracker.test.ts
import { ReportSynthesisTracker } from "../../server/services/graph/report-synthesis-tracker";

describe("ReportSynthesisTracker", () => {
  let tracker: ReportSynthesisTracker;

  beforeEach(() => {
    tracker = new ReportSynthesisTracker();
  });

  test("creates job with pending status", () => {
    const job = tracker.createJob("session-1");
    expect(job.status).toBe("pending");
    expect(job.sessionId).toBe("session-1");
    expect(tracker.hasActiveJob("session-1")).toBe(true);
  });

  test("updates progress through generating phase", () => {
    tracker.createJob("session-1");
    tracker.updateDetectingGroups("session-1");
    expect(tracker.getJobStatus("session-1")?.status).toBe("detecting_groups");

    tracker.updateGenerating("session-1", 5, 2, "Problem Group");
    const job = tracker.getJobStatus("session-1");
    expect(job?.status).toBe("generating");
    expect(job?.totalGroups).toBe(5);
    expect(job?.completedGroups).toBe(2);
    expect(job?.currentGroupName).toBe("Problem Group");
  });

  test("completes job and moves to recent", () => {
    tracker.createJob("session-1");
    tracker.completeJob("session-1", 5);

    expect(tracker.hasActiveJob("session-1")).toBe(false);
    const job = tracker.getJobStatus("session-1");
    expect(job?.status).toBe("complete");
    expect(job?.reportsCreated).toBe(5);
  });

  test("cancellation aborts controller", () => {
    const job = tracker.createJob("session-1");
    const abortSpy = jest.spyOn(job.abortController, "abort");

    tracker.cancelJob("session-1", "User cancelled");

    expect(abortSpy).toHaveBeenCalled();
    expect(tracker.isCancelled("session-1")).toBe(true);
  });
});
```

**Pass Criteria**:

- [ ] All unit tests pass
- [ ] Job lifecycle works: pending → detecting_groups → generating → complete
- [ ] Cancellation properly aborts and sets status
- [ ] Recent jobs are cleaned up after 5 minutes

**Expected Outcome**:

```
PASS tests/unit/report-synthesis-tracker.test.ts
  ReportSynthesisTracker
    ✓ creates job with pending status
    ✓ updates progress through generating phase
    ✓ completes job and moves to recent
    ✓ cancellation aborts controller
```

---

### Task 4: Report Generator AI Service

**File**: `server/services/graph/report-generator.ts`

**Implementation**:

```typescript
export interface ReportGenerationInput {
  sessionId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  componentNodeIds: string[];
  otherGroupSummaries?: Array<{
    groupHash: string;
    groupName: string;
    overview: string;
  }>;
}

export interface GeneratedReport {
  groupName: string;
  overview: string;
  keyThemes: string[];
  story: string;
  relationshipsToGroups: Array<{
    groupHash: string;
    groupName: string;
    relationship: string;
  }>;
  openQuestions: string[];
  nodesSummary: Array<{ nodeId: string; title: string; oneLiner: string }>;
}

export async function generateGroupReport(
  input: ReportGenerationInput,
  abortSignal?: AbortSignal,
): Promise<GeneratedReport>;

export function buildReportPrompt(
  nodes: GraphNode[],
  edges: GraphEdge[],
  otherGroupSummaries?: Array<{
    groupHash: string;
    groupName: string;
    overview: string;
  }>,
): { system: string; user: string };

export function parseReportResponse(response: string): GeneratedReport;
```

**AI Prompt Design**:

```typescript
const systemPrompt = `You are a strategic analyst synthesizing insights from a connected group of knowledge nodes.

Your task is to create a comprehensive report that:
1. Names the group based on its dominant theme
2. Provides an overview of what this group represents
3. Identifies key themes across the nodes
4. Weaves a coherent story connecting the ideas
5. Notes relationships to other groups (if provided)
6. Highlights open questions or tensions

IMPORTANT: When referencing specific nodes, use their exact titles in quotes.
Example: The insight "Market size validation" suggests...

Output JSON matching this structure:
{
  "groupName": "string - descriptive name for this group",
  "overview": "string - 1-2 paragraphs summarizing what this group represents",
  "keyThemes": ["array", "of", "theme", "bullets"],
  "story": "string - multi-paragraph narrative connecting the ideas, referencing node titles in quotes",
  "relationshipsToGroups": [{"groupHash": "string", "groupName": "string", "relationship": "string"}],
  "openQuestions": ["array", "of", "gaps", "or", "tensions"],
  "nodesSummary": [{"nodeId": "string", "title": "string", "oneLiner": "string"}]
}`;
```

**Test Script**:

```typescript
// tests/unit/report-generator.test.ts
import {
  buildReportPrompt,
  parseReportResponse,
} from "../../server/services/graph/report-generator";

describe("Report Generator", () => {
  const mockNodes = [
    {
      id: "n1",
      title: "Market validation needed",
      content: "We need to validate market size",
      blockType: "problem",
    },
    {
      id: "n2",
      title: "Survey approach",
      content: "Use surveys to validate",
      blockType: "solution",
    },
    {
      id: "n3",
      title: "Cost concerns",
      content: "Surveys are expensive",
      blockType: "risk",
    },
  ];

  const mockEdges = [
    { id: "e1", source: "n2", target: "n1", linkType: "addresses" },
    { id: "e2", source: "n3", target: "n2", linkType: "contradicts" },
  ];

  test("buildReportPrompt includes all nodes", () => {
    const { user } = buildReportPrompt(mockNodes, mockEdges);
    expect(user).toContain("Market validation needed");
    expect(user).toContain("Survey approach");
    expect(user).toContain("Cost concerns");
  });

  test("buildReportPrompt includes relationships", () => {
    const { user } = buildReportPrompt(mockNodes, mockEdges);
    expect(user).toContain("addresses");
    expect(user).toContain("contradicts");
  });

  test("parseReportResponse extracts all sections", () => {
    const mockResponse = JSON.stringify({
      groupName: "Market Validation",
      overview: "This group focuses on market validation approaches.",
      keyThemes: ["validation", "cost", "surveys"],
      story:
        'The "Market validation needed" problem is addressed by "Survey approach".',
      relationshipsToGroups: [],
      openQuestions: ["How to reduce survey costs?"],
      nodesSummary: [
        {
          nodeId: "n1",
          title: "Market validation needed",
          oneLiner: "Core problem",
        },
      ],
    });

    const report = parseReportResponse(mockResponse);
    expect(report.groupName).toBe("Market Validation");
    expect(report.keyThemes).toHaveLength(3);
    expect(report.story).toContain('"Market validation needed"');
  });
});
```

**Pass Criteria**:

- [ ] Prompt includes all node titles, content, and types
- [ ] Prompt includes edge relationships
- [ ] Response parsing extracts all sections
- [ ] Node titles in story are preserved for clickable links
- [ ] Handles JSON parsing errors gracefully

**Expected Outcome**:

```
PASS tests/unit/report-generator.test.ts
  Report Generator
    ✓ buildReportPrompt includes all nodes
    ✓ buildReportPrompt includes relationships
    ✓ parseReportResponse extracts all sections
```

---

### Task 5: WebSocket Events for Report Synthesis

**File**: `server/websocket.ts` (modify)

**Implementation**:
Add new emit functions following the source mapping pattern:

```typescript
// Types (add to existing types)
export interface ReportSynthesisPayload {
  jobId: string;
  totalGroups: number;
  completedGroups: number;
  currentGroupName?: string;
  reportsCreated?: number;
  progress: number; // 0-100
  status:
    | "started"
    | "detecting"
    | "generating"
    | "complete"
    | "failed"
    | "cancelled";
  error?: string;
}

// Emit functions (add near source mapping functions ~line 1197)
export function emitReportSynthesisStarted(
  sessionId: string,
  payload: ReportSynthesisPayload,
): void;
export function emitReportSynthesisProgress(
  sessionId: string,
  payload: ReportSynthesisPayload,
): void;
export function emitReportSynthesisComplete(
  sessionId: string,
  payload: ReportSynthesisPayload,
): void;
export function emitReportSynthesisFailed(
  sessionId: string,
  payload: ReportSynthesisPayload,
): void;
export function emitReportSynthesisCancelled(
  sessionId: string,
  payload: ReportSynthesisPayload,
): void;
```

**Test Script**:

```typescript
// tests/integration/websocket-report-synthesis.test.ts
import WebSocket from "ws";
import { emitReportSynthesisStarted } from "../../server/websocket";

describe("WebSocket Report Synthesis Events", () => {
  let ws: WebSocket;
  const sessionId = "test-session";

  beforeAll(async () => {
    // Connect WebSocket to test session
    ws = new WebSocket(`ws://localhost:3000/ws?sessionId=${sessionId}`);
    await new Promise((resolve) => ws.on("open", resolve));
  });

  afterAll(() => {
    ws.close();
  });

  test("emits report_synthesis_started event", (done) => {
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "report_synthesis_started") {
        expect(message.data.status).toBe("started");
        expect(message.data.totalGroups).toBe(5);
        done();
      }
    });

    emitReportSynthesisStarted(sessionId, {
      jobId: "job-1",
      totalGroups: 5,
      completedGroups: 0,
      progress: 0,
      status: "started",
    });
  });
});
```

**Pass Criteria**:

- [ ] All 5 emit functions implemented
- [ ] Events broadcast to correct session room
- [ ] Payload structure matches `ReportSynthesisPayload`
- [ ] Events are received by WebSocket clients

**Expected Outcome**:

```
PASS tests/integration/websocket-report-synthesis.test.ts
  WebSocket Report Synthesis Events
    ✓ emits report_synthesis_started event
    ✓ emits report_synthesis_progress event
    ✓ emits report_synthesis_complete event
    ✓ emits report_synthesis_failed event
    ✓ emits report_synthesis_cancelled event
```

---

### Task 6: useReportSynthesisStatus Hook

**File**: `frontend/src/components/graph/hooks/useReportSynthesisStatus.ts`

**Implementation**:
Follow pattern from `useSourceMappingStatus.ts`:

```typescript
export interface ReportSynthesisStatusState {
  jobId: string | null;
  status:
    | "idle"
    | "started"
    | "detecting"
    | "generating"
    | "complete"
    | "failed"
    | "cancelled";
  totalGroups: number;
  completedGroups: number;
  currentGroupName: string | null;
  reportsCreated: number;
  progress: number;
  error: string | null;
  isActive: boolean;
}

export interface UseReportSynthesisStatusOptions {
  sessionId: string;
  autoDismissDelay?: number;
}

export interface UseReportSynthesisStatusResult {
  status: ReportSynthesisStatusState;
  cancel: () => Promise<boolean>;
  dismiss: () => void;
  handlers: {
    onReportSynthesisStarted: (payload: ReportSynthesisPayload) => void;
    onReportSynthesisProgress: (payload: ReportSynthesisPayload) => void;
    onReportSynthesisComplete: (payload: ReportSynthesisPayload) => void;
    onReportSynthesisFailed: (payload: ReportSynthesisPayload) => void;
    onReportSynthesisCancelled: (payload: ReportSynthesisPayload) => void;
  };
}

export function useReportSynthesisStatus(
  options: UseReportSynthesisStatusOptions,
): UseReportSynthesisStatusResult;
```

**Test Script**:

```typescript
// tests/unit/useReportSynthesisStatus.test.tsx
import { renderHook, act } from "@testing-library/react";
import { useReportSynthesisStatus } from "../../frontend/src/components/graph/hooks/useReportSynthesisStatus";

describe("useReportSynthesisStatus", () => {
  test("initializes with idle status", () => {
    const { result } = renderHook(() =>
      useReportSynthesisStatus({ sessionId: "test-session" }),
    );

    expect(result.current.status.status).toBe("idle");
    expect(result.current.status.isActive).toBe(false);
  });

  test("handles started event", () => {
    const { result } = renderHook(() =>
      useReportSynthesisStatus({ sessionId: "test-session" }),
    );

    act(() => {
      result.current.handlers.onReportSynthesisStarted({
        jobId: "job-1",
        totalGroups: 5,
        completedGroups: 0,
        progress: 0,
        status: "started",
      });
    });

    expect(result.current.status.status).toBe("started");
    expect(result.current.status.isActive).toBe(true);
    expect(result.current.status.totalGroups).toBe(5);
  });

  test("handles progress event", () => {
    const { result } = renderHook(() =>
      useReportSynthesisStatus({ sessionId: "test-session" }),
    );

    act(() => {
      result.current.handlers.onReportSynthesisProgress({
        jobId: "job-1",
        totalGroups: 5,
        completedGroups: 2,
        currentGroupName: "Risk Analysis",
        progress: 40,
        status: "generating",
      });
    });

    expect(result.current.status.completedGroups).toBe(2);
    expect(result.current.status.currentGroupName).toBe("Risk Analysis");
    expect(result.current.status.progress).toBe(40);
  });

  test("auto-dismisses after completion", async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() =>
      useReportSynthesisStatus({
        sessionId: "test-session",
        autoDismissDelay: 5000,
      }),
    );

    act(() => {
      result.current.handlers.onReportSynthesisComplete({
        jobId: "job-1",
        totalGroups: 5,
        completedGroups: 5,
        reportsCreated: 5,
        progress: 100,
        status: "complete",
      });
    });

    expect(result.current.status.status).toBe("complete");

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.status.status).toBe("idle");

    jest.useRealTimers();
  });
});
```

**Pass Criteria**:

- [ ] Initializes with idle state
- [ ] Handles all 5 event types
- [ ] Updates progress state correctly
- [ ] Auto-dismisses after completion
- [ ] Cancel function calls API endpoint

**Expected Outcome**:

```
PASS tests/unit/useReportSynthesisStatus.test.tsx
  useReportSynthesisStatus
    ✓ initializes with idle status
    ✓ handles started event
    ✓ handles progress event
    ✓ auto-dismisses after completion
```

---

### Task 7: ReportSynthesisStatusPill Component

**File**: `frontend/src/components/graph/ReportSynthesisStatusPill.tsx`

**Implementation**:
Follow pattern from `SourceMappingStatusPill.tsx`:

```tsx
interface ReportSynthesisStatusPillProps {
  status: ReportSynthesisStatusState;
  onCancel: () => void;
  onDismiss: () => void;
}

export function ReportSynthesisStatusPill({
  status,
  onCancel,
  onDismiss,
}: ReportSynthesisStatusPillProps) {
  // Display states:
  // - Active: Purple bg, spinner, "Generating reports... (2/5)"
  // - Complete: Green bg, check, "5 reports generated"
  // - Failed: Red bg, alert, "Report generation failed"
  // - Cancelled: Gray bg, x-circle, "Generation cancelled"

  const progressLabel =
    status.status === "detecting"
      ? "Detecting node groups..."
      : status.status === "generating"
        ? `Generating reports... (${status.completedGroups}/${status.totalGroups})`
        : status.status === "complete"
          ? `${status.reportsCreated} reports generated`
          : status.status === "failed"
            ? "Report generation failed"
            : "Generation cancelled";

  return (
    <div className="...">
      {/* Icon based on status */}
      {/* Progress bar for active states */}
      {/* Label */}
      {/* Cancel button (active) or Dismiss button (complete/failed/cancelled) */}
    </div>
  );
}
```

**Test Script**:

```typescript
// tests/unit/ReportSynthesisStatusPill.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ReportSynthesisStatusPill } from "../../frontend/src/components/graph/ReportSynthesisStatusPill";

describe("ReportSynthesisStatusPill", () => {
  const mockCancel = jest.fn();
  const mockDismiss = jest.fn();

  test("shows progress during generation", () => {
    render(
      <ReportSynthesisStatusPill
        status={{
          jobId: "job-1",
          status: "generating",
          totalGroups: 5,
          completedGroups: 2,
          currentGroupName: "Risk Group",
          reportsCreated: 2,
          progress: 40,
          error: null,
          isActive: true
        }}
        onCancel={mockCancel}
        onDismiss={mockDismiss}
      />
    );

    expect(screen.getByText(/Generating reports.*2\/5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  test("shows completion state", () => {
    render(
      <ReportSynthesisStatusPill
        status={{
          jobId: "job-1",
          status: "complete",
          totalGroups: 5,
          completedGroups: 5,
          currentGroupName: null,
          reportsCreated: 5,
          progress: 100,
          error: null,
          isActive: false
        }}
        onCancel={mockCancel}
        onDismiss={mockDismiss}
      />
    );

    expect(screen.getByText("5 reports generated")).toBeInTheDocument();
  });

  test("cancel button calls onCancel", () => {
    render(
      <ReportSynthesisStatusPill
        status={{ /* active state */ }}
        onCancel={mockCancel}
        onDismiss={mockDismiss}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockCancel).toHaveBeenCalled();
  });
});
```

**Pass Criteria**:

- [ ] Shows correct icon for each status
- [ ] Progress bar reflects completedGroups/totalGroups
- [ ] Labels are accurate for each state
- [ ] Cancel button visible and functional during active states
- [ ] Dismiss button visible after completion/failure

**Expected Outcome**:

```
PASS tests/unit/ReportSynthesisStatusPill.test.tsx
  ReportSynthesisStatusPill
    ✓ shows progress during generation
    ✓ shows completion state
    ✓ cancel button calls onCancel
```

---

### Task 8: Hook Report Synthesis into Source Mapping Completion

**File**: `server/routes/ideation/graph-routes.ts` (modify)

**Implementation**:
After source mapping completes, trigger report synthesis:

```typescript
// In the source mapping completion block (~line 1630-1640)
// After: tracker.completeJob(sessionId, mappingsCreated);
// After: emitSourceMappingComplete(...);

// NEW: Trigger report synthesis
if (mappingsCreated > 0) {
  // Fire-and-forget report synthesis
  (async () => {
    try {
      await generateReportsForSession(sessionId, db, { abortSignal: ... });
    } catch (error) {
      console.error("Report synthesis failed:", error);
    }
  })();
}
```

**New function**: `generateReportsForSession()`

```typescript
async function generateReportsForSession(
  sessionId: string,
  db: Database,
  options: { abortSignal?: AbortSignal }
) {
  const job = reportSynthesisTracker.createJob(sessionId);
  emitReportSynthesisStarted(sessionId, { ... });

  try {
    // 1. Fetch all nodes and edges for session
    const { nodes, edges } = await fetchGraphData(sessionId, db);

    // 2. Detect connected components
    reportSynthesisTracker.updateDetectingGroups(sessionId);
    emitReportSynthesisProgress(sessionId, { status: "detecting", progress: 10 });

    const components = findConnectedComponents(nodes, edges);

    // 3. Generate report for each component
    const totalGroups = components.length;
    let completedGroups = 0;
    let reportsCreated = 0;

    for (const component of components) {
      if (reportSynthesisTracker.isCancelled(sessionId)) {
        emitReportSynthesisCancelled(sessionId, { ... });
        return;
      }

      // Get nodes in this component
      const componentNodes = nodes.filter(n => component.nodeIds.includes(n.id));
      const componentEdges = edges.filter(e =>
        component.nodeIds.includes(e.source) && component.nodeIds.includes(e.target)
      );

      // Generate report via AI
      const report = await generateGroupReport({
        sessionId,
        nodes: componentNodes,
        edges: componentEdges,
        componentNodeIds: component.nodeIds,
      }, job.abortController.signal);

      // Store in database
      await storeReport(sessionId, component.nodeIds, report, db);

      completedGroups++;
      reportsCreated++;

      const progress = 10 + (completedGroups / totalGroups) * 90;
      reportSynthesisTracker.updateGenerating(sessionId, totalGroups, completedGroups, report.groupName);
      emitReportSynthesisProgress(sessionId, {
        status: "generating",
        progress,
        totalGroups,
        completedGroups,
        currentGroupName: report.groupName
      });
    }

    // 4. Complete
    reportSynthesisTracker.completeJob(sessionId, reportsCreated);
    emitReportSynthesisComplete(sessionId, {
      status: "complete",
      progress: 100,
      reportsCreated
    });

  } catch (error) {
    reportSynthesisTracker.failJob(sessionId, error.message);
    emitReportSynthesisFailed(sessionId, { status: "failed", error: error.message });
  }
}
```

**Test Script**:

```typescript
// tests/integration/report-synthesis-flow.test.ts
describe("Report Synthesis Flow", () => {
  test("triggers report synthesis after source mapping completes", async () => {
    // 1. Create test session with nodes
    const sessionId = await createTestSession();
    await createTestNodes(sessionId, 5);
    await createTestEdges(sessionId, 4); // Creates 2 connected components

    // 2. Trigger source mapping (which should trigger report synthesis)
    const response = await fetch(`/api/ideation/session/${sessionId}/graph/apply-changes`, {
      method: "POST",
      body: JSON.stringify({ changes: [...], sources: [...] })
    });

    // 3. Wait for report synthesis to complete (poll status)
    await waitFor(async () => {
      const status = await fetch(`/api/ideation/session/${sessionId}/report-synthesis/status`);
      const data = await status.json();
      return data.status === "complete";
    }, { timeout: 30000 });

    // 4. Verify reports were created
    const reports = await fetch(`/api/ideation/session/${sessionId}/reports`);
    const reportsData = await reports.json();

    expect(reportsData.reports).toHaveLength(2); // 2 connected components
    expect(reportsData.reports[0].overview).toBeTruthy();
    expect(reportsData.reports[0].story).toBeTruthy();
  });
});
```

**Pass Criteria**:

- [ ] Report synthesis starts automatically after source mapping completes
- [ ] Connected components are correctly detected
- [ ] Report generated for each component
- [ ] Reports stored in database
- [ ] WebSocket events emitted at each stage
- [ ] Cancellation stops the process

**Expected Outcome**:

- Source mapping completes → report synthesis auto-starts
- Progress events: detecting → generating (1/N) → generating (2/N) → ... → complete
- Database contains N reports where N = number of connected components

---

### Task 9: Report Tab in NodeInspector

**File**: `frontend/src/components/graph/NodeInspector.tsx` (modify)

**Implementation**:
Add a new "Report" tab that shows the group report for the selected node's connected component:

```tsx
// Add to imports
import { GroupReportPanel } from "./GroupReportPanel";

// Add state for active tab (~line 420)
const [activeTab, setActiveTab] = useState<
  "details" | "relationships" | "report"
>("details");

// Add tab headers in the panel (~line 1167)
<div className="flex border-b border-gray-200">
  <button
    className={`px-4 py-2 ${activeTab === "details" ? "border-b-2 border-cyan-500" : ""}`}
    onClick={() => setActiveTab("details")}
  >
    Details
  </button>
  <button
    className={`px-4 py-2 ${activeTab === "relationships" ? "border-b-2 border-cyan-500" : ""}`}
    onClick={() => setActiveTab("relationships")}
  >
    Relationships
  </button>
  <button
    className={`px-4 py-2 ${activeTab === "report" ? "border-b-2 border-cyan-500" : ""}`}
    onClick={() => setActiveTab("report")}
  >
    Report
  </button>
</div>;

// Add report tab content
{
  activeTab === "report" && (
    <GroupReportPanel
      sessionId={sessionId}
      currentNodeId={node.id}
      nodes={nodes}
      edges={edges}
      onNodeClick={onNodeClick}
    />
  );
}
```

**New Component**: `GroupReportPanel.tsx`

```tsx
interface GroupReportPanelProps {
  sessionId: string;
  currentNodeId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
}

export function GroupReportPanel({
  sessionId,
  currentNodeId,
  nodes,
  edges,
  onNodeClick,
}: GroupReportPanelProps) {
  // 1. Find connected component containing currentNodeId
  // 2. Fetch report for that component from API
  // 3. Render report with clickable node titles
  // 4. Show stale indicator + regenerate button

  const { report, isLoading, isStale, regenerate } = useGroupReport(
    sessionId,
    currentNodeId,
  );

  if (isLoading) return <Skeleton />;
  if (!report)
    return (
      <EmptyState message="No report available. Generate reports by analyzing sources." />
    );

  return (
    <div className="p-4 space-y-6">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{report.groupName}</h3>
        <div className="flex items-center gap-2">
          {isStale && <Badge variant="warning">Stale</Badge>}
          <Button size="sm" onClick={regenerate}>
            Regenerate
          </Button>
        </div>
      </div>

      {/* Overview */}
      <section>
        <h4 className="font-medium text-gray-700 mb-2">Overview</h4>
        <div className="prose prose-sm">
          <MarkdownWithNodeLinks
            content={report.overview}
            nodes={nodes}
            onNodeClick={onNodeClick}
          />
        </div>
      </section>

      {/* Key Themes */}
      <section>
        <h4 className="font-medium text-gray-700 mb-2">Key Themes</h4>
        <ul className="list-disc list-inside space-y-1">
          {report.keyThemes.map((theme, i) => (
            <li key={i}>{theme}</li>
          ))}
        </ul>
      </section>

      {/* The Story */}
      <section>
        <h4 className="font-medium text-gray-700 mb-2">The Story</h4>
        <div className="prose prose-sm">
          <MarkdownWithNodeLinks
            content={report.story}
            nodes={nodes}
            onNodeClick={onNodeClick}
          />
        </div>
      </section>

      {/* Open Questions */}
      <section>
        <h4 className="font-medium text-gray-700 mb-2">Open Questions</h4>
        <ul className="list-disc list-inside space-y-1">
          {report.openQuestions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </section>

      {/* Nodes in Group */}
      <section>
        <h4 className="font-medium text-gray-700 mb-2">
          Nodes in This Group ({report.nodesSummary.length})
        </h4>
        <ul className="space-y-2">
          {report.nodesSummary.map((node) => (
            <li key={node.nodeId}>
              <button
                onClick={() => onNodeClick?.(node.nodeId)}
                className="text-cyan-600 hover:underline"
              >
                {node.title}
              </button>
              <span className="text-gray-500 ml-2">- {node.oneLiner}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

**Test Script**:

```typescript
// tests/e2e/node-inspector-report-tab.test.ts
describe("NodeInspector Report Tab", () => {
  test("shows report tab and displays group report", async () => {
    // Navigate to graph with existing reports
    await page.goto(`/ideation/${sessionId}`);

    // Click a node to open inspector
    await page.click('[data-testid="graph-node-n1"]');

    // Click Report tab
    await page.click('button:has-text("Report")');

    // Verify report content is shown
    await expect(page.locator("h3")).toContainText(/group/i);
    await expect(page.locator('h4:has-text("Overview")')).toBeVisible();
    await expect(page.locator('h4:has-text("Key Themes")')).toBeVisible();
    await expect(page.locator('h4:has-text("The Story")')).toBeVisible();
  });

  test("clicking node title in report navigates to that node", async () => {
    await page.click('button:has-text("Report")');

    // Click a node title in the report
    await page.click('[data-testid="report-node-link-n2"]');

    // Verify inspector now shows that node
    await expect(page.locator('[data-testid="inspector-title"]')).toContainText(
      "Node 2 Title",
    );
  });

  test("shows stale indicator when report is outdated", async () => {
    // Modify a node in the group
    await modifyNode(sessionId, "n1", { content: "Updated content" });

    // Refresh and check report tab
    await page.reload();
    await page.click('[data-testid="graph-node-n1"]');
    await page.click('button:has-text("Report")');

    // Verify stale badge
    await expect(page.locator('text="Stale"')).toBeVisible();
    await expect(page.locator('button:has-text("Regenerate")')).toBeVisible();
  });
});
```

**Pass Criteria**:

- [ ] Report tab appears in NodeInspector
- [ ] Clicking tab shows the report for current node's group
- [ ] All report sections render correctly
- [ ] Node titles in report are clickable and navigate to that node
- [ ] Stale indicator shows when report is outdated
- [ ] Regenerate button triggers regeneration for that group

**Expected Outcome**:

- User clicks node → opens inspector → clicks Report tab → sees group report
- Clicking quoted node titles navigates to that node
- Stale reports show warning badge and regenerate button

---

### Task 10: Reports Tab in MemoryDatabasePanel

**File**: `frontend/src/components/ideation/MemoryDatabasePanel.tsx` (modify)

**Implementation**:
Add "Reports" as the first tab:

```typescript
// Update type (~line 24)
export type MemoryTableName =
  | "reports"     // NEW - first tab
  | "blocks"
  | "links"
  | "graphs"
  | "sessions"
  | "files";

// Update default (~line 312)
const [activeTable, setActiveTable] = useState<MemoryTableName>(
  highlightTable || "reports",  // Changed from "files"
);

// Add Reports tab button (insert at ~line 705, before files tab)
<TableTab
  name="Reports"
  icon={FileBarChart}
  isActive={activeTable === "reports"}
  count={reportsCount}
  onClick={() => setActiveTable("reports")}
/>

// Add Reports tab content (insert at ~line 823, before files content)
{!isLoading && !error && activeTable === "reports" && (
  <ReportsTable
    sessionId={sessionId}
    reports={reports}
    onReportClick={(reportId) => {/* Navigate to first node in group */}}
    onRegenerateAll={handleRegenerateAllReports}
  />
)}
```

**New Component**: `ReportsTable.tsx`

```tsx
interface ReportsTableProps {
  sessionId: string;
  reports: NodeGroupReport[];
  onReportClick: (reportId: string, firstNodeId: string) => void;
  onRegenerateAll: () => void;
}

export function ReportsTable({
  sessionId,
  reports,
  onReportClick,
  onRegenerateAll,
}: ReportsTableProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Group Reports ({reports.length})</h3>
        <Button size="sm" onClick={onRegenerateAll}>
          Regenerate All
        </Button>
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th>Group Name</th>
            <th>Nodes</th>
            <th>Status</th>
            <th>Generated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>
                <button
                  onClick={() => onReportClick(report.id, report.nodeIds[0])}
                >
                  {report.groupName}
                </button>
              </td>
              <td>{report.nodeCount}</td>
              <td>
                <Badge
                  variant={report.status === "stale" ? "warning" : "success"}
                >
                  {report.status}
                </Badge>
              </td>
              <td>{formatDate(report.generatedAt)}</td>
              <td>
                <Button size="xs" onClick={() => regenerateReport(report.id)}>
                  Regenerate
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Test Script**:

```typescript
// tests/e2e/memory-db-reports-tab.test.ts
describe("MemoryDatabasePanel Reports Tab", () => {
  test("Reports tab is first and default", async () => {
    await page.goto(`/ideation/${sessionId}`);
    await page.click('[data-testid="memory-db-panel-toggle"]');

    // Verify Reports tab is active by default
    const activeTab = await page.locator('[role="tab"][aria-selected="true"]');
    await expect(activeTab).toContainText("Reports");
  });

  test("shows all group reports with status", async () => {
    await page.goto(`/ideation/${sessionId}`);
    await page.click('[data-testid="memory-db-panel-toggle"]');

    // Verify reports table
    const rows = await page.locator("tbody tr").count();
    expect(rows).toBeGreaterThan(0);

    // Each row has group name, node count, status
    await expect(page.locator("tbody tr").first()).toContainText(
      /current|stale/,
    );
  });

  test("clicking report navigates to node in graph", async () => {
    await page.click('button:has-text("Market Validation")');

    // Verify graph navigated to a node in that group
    await expect(page.locator('[data-testid="inspector-title"]')).toBeVisible();
  });

  test("regenerate button triggers report regeneration", async () => {
    await page.click('tbody tr:first-child button:has-text("Regenerate")');

    // Verify status pill appears
    await expect(
      page.locator('[data-testid="report-synthesis-status"]'),
    ).toBeVisible();
  });
});
```

**Pass Criteria**:

- [ ] Reports tab appears as first tab
- [ ] Reports tab is default when opening Memory DB panel
- [ ] All group reports listed with name, count, status, date
- [ ] Clicking report name navigates to graph/node
- [ ] Status badges show current/stale correctly
- [ ] Regenerate button works for individual reports
- [ ] Regenerate All button works

**Expected Outcome**:

- Memory DB panel opens with Reports tab active
- Table shows all group reports with their status
- Stale reports have warning badge
- Click report → navigate to graph → show that group's first node

---

### Task 11: Stale Detection and Regenerate Functionality

**Files**:

- `server/routes/ideation/graph-routes.ts` (modify)
- `server/services/graph/report-staleness.ts` (new)

**Implementation**:

**Stale Detection Service**:

```typescript
// server/services/graph/report-staleness.ts
import crypto from "crypto";

export function computeGroupHash(nodeIds: string[]): string {
  const sorted = [...nodeIds].sort();
  return crypto.createHash("sha256").update(sorted.join(",")).digest("hex");
}

export async function checkReportStaleness(
  sessionId: string,
  changedNodeIds: string[],
  db: Database,
): Promise<string[]> {
  // Returns list of report IDs that should be marked stale

  const reports = await db
    .select()
    .from(nodeGroupReports)
    .where(eq(nodeGroupReports.sessionId, sessionId))
    .where(eq(nodeGroupReports.status, "current"));

  const staleReportIds: string[] = [];

  for (const report of reports) {
    const reportNodeIds = JSON.parse(report.nodeIds);
    const hasOverlap = changedNodeIds.some((id) => reportNodeIds.includes(id));

    if (hasOverlap) {
      staleReportIds.push(report.id);
    }
  }

  return staleReportIds;
}

export async function markReportsStale(
  reportIds: string[],
  db: Database,
): Promise<void> {
  if (reportIds.length === 0) return;

  await db
    .update(nodeGroupReports)
    .set({ status: "stale" })
    .where(inArray(nodeGroupReports.id, reportIds));
}
```

**Hook into node changes**:

```typescript
// In graph-routes.ts, after any node/edge modification
// Add to: create node, update node, delete node, create edge, delete edge handlers

// After successful modification:
const staleReportIds = await checkReportStaleness(sessionId, [nodeId], db);
await markReportsStale(staleReportIds, db);

// Optionally emit WebSocket event for UI to refresh
if (staleReportIds.length > 0) {
  emitReportsStaleStatusChanged(sessionId, staleReportIds);
}
```

**Regenerate Endpoint**:

```typescript
// POST /api/ideation/session/:sessionId/reports/:reportId/regenerate
router.post(
  "/session/:sessionId/reports/:reportId/regenerate",
  async (req, res) => {
    const { sessionId, reportId } = req.params;

    // Get the report to find its node IDs
    const report = await db
      .select()
      .from(nodeGroupReports)
      .where(eq(nodeGroupReports.id, reportId))
      .get();

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Regenerate just this group
    const nodeIds = JSON.parse(report.nodeIds);
    await regenerateSingleGroupReport(sessionId, nodeIds, db);

    res.json({ success: true });
  },
);

// POST /api/ideation/session/:sessionId/reports/regenerate-all
router.post("/session/:sessionId/reports/regenerate-all", async (req, res) => {
  const { sessionId } = req.params;

  // Trigger full report synthesis (like after source mapping)
  generateReportsForSession(sessionId, db, {});

  res.json({ success: true, message: "Report synthesis started" });
});
```

**Test Script**:

```typescript
// tests/integration/report-staleness.test.ts
describe("Report Staleness Detection", () => {
  test("modifying a node marks its group report as stale", async () => {
    // Setup: Create session with nodes and generate reports
    const sessionId = await createTestSession();
    await createTestNodes(sessionId, 3);
    await generateReportsForSession(sessionId);

    // Verify initial status is current
    const reportsBefore = await getReports(sessionId);
    expect(reportsBefore[0].status).toBe("current");

    // Modify a node
    await updateNode(sessionId, "n1", { content: "Updated" });

    // Verify report is now stale
    const reportsAfter = await getReports(sessionId);
    expect(reportsAfter[0].status).toBe("stale");
  });

  test("adding a node to a group marks report as stale", async () => {
    // Setup
    const sessionId = await createTestSession();
    await createTestNodes(sessionId, 3);
    await generateReportsForSession(sessionId);

    // Add edge connecting new node to existing group
    await createEdge(sessionId, {
      source: "n4",
      target: "n1",
      linkType: "addresses",
    });

    // Report should be stale (group membership changed)
    const reports = await getReports(sessionId);
    expect(reports[0].status).toBe("stale");
  });

  test("regenerate endpoint creates fresh report", async () => {
    const sessionId = await createTestSession();
    await createTestNodes(sessionId, 3);
    await generateReportsForSession(sessionId);

    // Mark as stale
    await updateNode(sessionId, "n1", { content: "Updated" });

    // Regenerate
    const report = await getReports(sessionId)[0];
    await fetch(
      `/api/ideation/session/${sessionId}/reports/${report.id}/regenerate`,
      {
        method: "POST",
      },
    );

    // Wait for completion
    await waitForReportSynthesis(sessionId);

    // Verify status is current again
    const updatedReport = await getReport(sessionId, report.id);
    expect(updatedReport.status).toBe("current");
  });
});
```

**Pass Criteria**:

- [ ] Modifying node content marks group report as stale
- [ ] Adding/removing nodes from group marks report as stale
- [ ] Adding/removing edges within group marks report as stale
- [ ] Regenerate single report endpoint works
- [ ] Regenerate all reports endpoint works
- [ ] Regeneration updates status to "current"

**Expected Outcome**:

- Any graph modification touching a node in a reported group → report becomes stale
- UI shows stale badge
- Clicking regenerate → report synthesis for that group → status becomes current

---

### Task 12: Integration Tests

**File**: `tests/e2e/report-synthesis-full-flow.test.ts`

**Implementation**:

```typescript
describe("Report Synthesis Full Flow", () => {
  let sessionId: string;

  beforeAll(async () => {
    sessionId = await createTestSession();
  });

  test("end-to-end: analyze sources → source mapping → report synthesis", async () => {
    // 1. Navigate to graph
    await page.goto(`/ideation/${sessionId}`);

    // 2. Open source selection modal
    await page.click('[data-testid="update-memory-graph-button"]');

    // 3. Select sources
    await page.click('[data-testid="source-select-all"]');

    // 4. Click Analyze Sources
    await page.click('button:has-text("Analyze Sources")');

    // 5. Wait for proposed changes modal
    await expect(
      page.locator('[data-testid="proposed-changes-modal"]'),
    ).toBeVisible();

    // 6. Apply changes
    await page.click('button:has-text("Apply Changes")');

    // 7. Verify source mapping status pill appears
    await expect(
      page.locator('[data-testid="source-mapping-status"]'),
    ).toBeVisible();

    // 8. Wait for source mapping to complete
    await expect(page.locator('text="sources mapped"')).toBeVisible({
      timeout: 30000,
    });

    // 9. Verify report synthesis status pill appears
    await expect(
      page.locator('[data-testid="report-synthesis-status"]'),
    ).toBeVisible();

    // 10. Wait for report synthesis to complete
    await expect(page.locator('text="reports generated"')).toBeVisible({
      timeout: 60000,
    });

    // 11. Open Memory DB panel and verify Reports tab
    await page.click('[data-testid="memory-db-panel-toggle"]');
    await expect(page.locator("tbody tr")).toHaveCount.greaterThan(0);

    // 12. Click a node and verify Report tab shows content
    await page.click('[data-testid="close-memory-db"]');
    await page.click('[data-testid^="graph-node-"]').first();
    await page.click('button:has-text("Report")');
    await expect(page.locator('h4:has-text("Overview")')).toBeVisible();
  });

  test("regenerate flow after modification", async () => {
    // 1. Verify report is current
    await page.goto(`/ideation/${sessionId}`);
    await page.click('[data-testid^="graph-node-"]').first();
    await page.click('button:has-text("Report")');
    await expect(page.locator('text="Stale"')).not.toBeVisible();

    // 2. Modify the node
    await page.click('button:has-text("Edit")');
    await page.fill('[data-testid="node-content-input"]', "Modified content");
    await page.click('button:has-text("Save")');

    // 3. Verify report shows stale
    await page.click('button:has-text("Report")');
    await expect(page.locator('text="Stale"')).toBeVisible();

    // 4. Click regenerate
    await page.click('button:has-text("Regenerate")');

    // 5. Wait for completion
    await expect(
      page.locator('[data-testid="report-synthesis-status"]'),
    ).toBeVisible();
    await expect(page.locator('text="reports generated"')).toBeVisible({
      timeout: 30000,
    });

    // 6. Verify report is current again
    await expect(page.locator('text="Stale"')).not.toBeVisible();
  });
});
```

**Pass Criteria**:

- [ ] Full flow works: analyze → source mapping → report synthesis
- [ ] Reports appear in Memory DB panel
- [ ] Reports appear in NodeInspector Report tab
- [ ] Node modifications trigger stale status
- [ ] Regenerate fixes stale status
- [ ] Clickable node titles work

**Expected Outcome**:

```
PASS tests/e2e/report-synthesis-full-flow.test.ts
  Report Synthesis Full Flow
    ✓ end-to-end: analyze sources → source mapping → report synthesis (65432 ms)
    ✓ regenerate flow after modification (12345 ms)
```

---

## File Summary

| Action | File                                                               | Description                 |
| ------ | ------------------------------------------------------------------ | --------------------------- |
| CREATE | `database/migrations/XXX_node_group_reports.sql`                   | Database schema             |
| CREATE | `schema/entities/node-group-report.ts`                             | Drizzle entity              |
| CREATE | `server/services/graph/report-synthesis-tracker.ts`                | Job tracking                |
| CREATE | `server/services/graph/report-generator.ts`                        | AI synthesis                |
| CREATE | `server/services/graph/report-staleness.ts`                        | Stale detection             |
| CREATE | `frontend/src/components/graph/hooks/useReportSynthesisStatus.ts`  | Status hook                 |
| CREATE | `frontend/src/components/graph/hooks/useGroupReport.ts`            | Report data hook            |
| CREATE | `frontend/src/components/graph/ReportSynthesisStatusPill.tsx`      | Status indicator            |
| CREATE | `frontend/src/components/graph/GroupReportPanel.tsx`               | Report display              |
| CREATE | `frontend/src/components/ideation/ReportsTable.tsx`                | Reports list                |
| MODIFY | `server/websocket.ts`                                              | Add report synthesis events |
| MODIFY | `server/routes/ideation/graph-routes.ts`                           | Hook synthesis + endpoints  |
| MODIFY | `frontend/src/components/graph/NodeInspector.tsx`                  | Add Report tab              |
| MODIFY | `frontend/src/components/ideation/MemoryDatabasePanel.tsx`         | Add Reports tab             |
| MODIFY | `frontend/src/components/graph/hooks/useGraphWebSocket.ts`         | Handle new events           |
| MODIFY | `frontend/src/components/graph/hooks/useGraphDataWithWebSocket.ts` | Wire up hooks               |

---

## Estimated Complexity

| Task                        | Complexity | Dependencies  |
| --------------------------- | ---------- | ------------- |
| 1. DB Migration             | Low        | None          |
| 2. Drizzle Schema           | Low        | Task 1        |
| 3. Synthesis Tracker        | Medium     | None          |
| 4. Report Generator         | High       | None          |
| 5. WebSocket Events         | Medium     | Task 3        |
| 6. Status Hook              | Medium     | Task 5        |
| 7. Status Pill              | Low        | Task 6        |
| 8. Hook into Source Mapping | Medium     | Tasks 3, 4, 5 |
| 9. NodeInspector Tab        | Medium     | Tasks 6, 8    |
| 10. MemoryDB Tab            | Medium     | Task 8        |
| 11. Stale Detection         | Medium     | Task 2        |
| 12. Integration Tests       | Medium     | All above     |

---

## Open Questions Resolved

| Question               | Answer                                                  |
| ---------------------- | ------------------------------------------------------- |
| Group naming           | AI-generated based on dominant theme                    |
| Single-node groups     | Yes, generate report (useful for isolated insights)     |
| Cross-group navigation | Click group name → navigate to first node in that group |
| Regenerate scope       | Per-group button + "Regenerate All" option              |
