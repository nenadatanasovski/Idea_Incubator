# Circular Dependency Resolution - Implementation Plan

## Overview

**Problem**: The circular dependency panel detects and displays cycles but provides no actionable way to resolve them. The `onBreakCycle` callback exists but is not wired up.

**Goal**: Enable users to resolve circular dependencies directly from the UI with multiple resolution strategies.

**Key Files Identified**:

- `frontend/src/components/graph/CycleIndicator.tsx` - UI component
- `frontend/src/components/graph/utils/cycleDetection.ts` - Detection algorithm
- `server/routes/ideation/graph-routes.ts` - API endpoints
- `server/websocket.ts` - Real-time broadcasts
- `schema/entities/memory-link.ts` - Edge data model

---

## Architecture Decision

### Resolution Strategies to Implement

| Strategy              | Description                           | Use Case                                     |
| --------------------- | ------------------------------------- | -------------------------------------------- |
| **Remove Edge**       | Delete the relationship entirely      | When the dependency is incorrect             |
| **Change Edge Type**  | Convert blocking → non-blocking type  | When relationship exists but shouldn't block |
| **Acknowledge Cycle** | Mark as intentional, suppress warning | When mutual dependency is by design          |
| **Reverse Edge**      | Flip A→B to B→A                       | When direction was wrong                     |

### Data Model Addition

New table `acknowledged_cycles` for tracking intentionally accepted cycles.

---

## Tasks

### Phase 1: Backend API Extensions

#### Task 1.1: Add Edge Type Update Endpoint

- [ ] Create `PATCH /session/:sessionId/graph/links/:linkId` endpoint
- [ ] Accept `{ linkType, degree, confidence, reason }` in body
- [ ] Emit `link_updated` WebSocket event
- [ ] Mark reports as stale

**File**: `server/routes/ideation/graph-routes.ts`

**Implementation**:

```typescript
// Add after DELETE endpoint (~line 180)
router.patch("/:sessionId/graph/links/:linkId", async (req, res) => {
  const { sessionId, linkId } = req.params;
  const { linkType, degree, confidence, reason } = req.body;

  // Validate linkType is valid
  // Update memory_links table
  // Emit link_updated event
  // Mark reports stale
});
```

**Test Script**:

```bash
# tests/api/link-update.test.ts
curl -X PATCH "http://localhost:3000/api/session/TEST_SESSION/graph/links/LINK_ID" \
  -H "Content-Type: application/json" \
  -d '{"linkType": "references", "reason": "Changed from requires to break cycle"}'
```

**Pass Criteria**:

- [ ] Returns 200 with updated link object
- [ ] WebSocket receives `link_updated` event
- [ ] Database reflects new linkType
- [ ] Reports marked stale

**Expected Outcome**: Edge types can be modified without delete/recreate, preserving edge ID and history.

---

#### Task 1.2: Add Cycle Acknowledgment Schema & Endpoints

- [ ] Create migration `122_acknowledged_cycles.sql`
- [ ] Add schema entity `schema/entities/acknowledged-cycle.ts`
- [ ] Create `POST /session/:sessionId/graph/cycles/acknowledge` endpoint
- [ ] Create `DELETE /session/:sessionId/graph/cycles/acknowledge/:cycleHash` endpoint
- [ ] Create `GET /session/:sessionId/graph/cycles/acknowledged` endpoint

**Migration File**: `database/migrations/122_acknowledged_cycles.sql`

```sql
CREATE TABLE acknowledged_cycles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  cycle_hash TEXT NOT NULL,  -- SHA256 of sorted node IDs
  node_ids TEXT NOT NULL,    -- JSON array of node IDs
  reason TEXT,
  acknowledged_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, cycle_hash)
);

CREATE INDEX idx_ack_cycles_session ON acknowledged_cycles(session_id);
```

**Schema Entity**: `schema/entities/acknowledged-cycle.ts`

```typescript
export interface AcknowledgedCycle {
  id: string;
  sessionId: string;
  cycleHash: string;
  nodeIds: string[];
  reason?: string;
  acknowledgedBy?: string;
  createdAt: string;
}
```

**Test Script**:

```bash
# Acknowledge a cycle
curl -X POST "http://localhost:3000/api/session/TEST_SESSION/graph/cycles/acknowledge" \
  -H "Content-Type: application/json" \
  -d '{"nodeIds": ["node1", "node2"], "reason": "Intentional mutual dependency"}'

# List acknowledged cycles
curl "http://localhost:3000/api/session/TEST_SESSION/graph/cycles/acknowledged"

# Remove acknowledgment
curl -X DELETE "http://localhost:3000/api/session/TEST_SESSION/graph/cycles/acknowledge/CYCLE_HASH"
```

**Pass Criteria**:

- [ ] Can acknowledge a cycle with reason
- [ ] Acknowledged cycles persist across page reloads
- [ ] Can remove acknowledgment
- [ ] Duplicate acknowledgment returns 409 Conflict

**Expected Outcome**: Users can mark cycles as intentional, and these acknowledgments persist.

---

#### Task 1.3: Add WebSocket Event for Link Updates

- [ ] Add `emitLinkUpdated` function to `server/websocket.ts`
- [ ] Add `LinkUpdatedPayload` type
- [ ] Wire up to PATCH endpoint

**File**: `server/websocket.ts`

**Implementation**:

```typescript
export interface LinkUpdatedPayload {
  id: string;
  linkType?: string;
  degree?: string;
  confidence?: number;
  reason?: string;
  updatedAt: string;
}

export function emitLinkUpdated(
  sessionId: string,
  payload: LinkUpdatedPayload,
) {
  broadcast(sessionId, { type: "link_updated", payload });
}
```

**Pass Criteria**:

- [ ] Event fires on link PATCH
- [ ] All connected clients receive event
- [ ] Payload contains updated fields only

**Expected Outcome**: Real-time sync when edge types change.

---

### Phase 2: Frontend Hook & State Updates

#### Task 2.1: Add `onLinkUpdated` to WebSocket Hook

- [ ] Add callback to `UseGraphWebSocketOptions`
- [ ] Handle `link_updated` message type
- [ ] Update `useGraphDataWithWebSocket` to process updates

**File**: `frontend/src/components/graph/hooks/useGraphWebSocket.ts`

**Implementation**:

```typescript
// Add to options interface
onLinkUpdated?: (payload: LinkUpdatedPayload) => void;

// Add to message handler switch
case "link_updated":
  options.onLinkUpdated?.(data.payload);
  break;
```

**File**: `frontend/src/components/graph/hooks/useGraphDataWithWebSocket.ts`

**Implementation**:

```typescript
// Add handler
const handleLinkUpdated = useCallback((payload: LinkUpdatedPayload) => {
  setEdges(prev => prev.map(edge =>
    edge.id === payload.id
      ? { ...edge, ...payload }
      : edge
  ));
}, []);

// Wire to WebSocket hook
useGraphWebSocket({
  ...
  onLinkUpdated: handleLinkUpdated,
});
```

**Test Script**:

```typescript
// tests/unit/graph/useGraphWebSocket.test.ts
it("handles link_updated events", () => {
  const onLinkUpdated = vi.fn();
  // ... setup hook with mock WebSocket
  // ... simulate link_updated message
  expect(onLinkUpdated).toHaveBeenCalledWith({
    id: "link1",
    linkType: "references",
  });
});
```

**Pass Criteria**:

- [ ] Hook receives and dispatches link_updated events
- [ ] Edge state updates without full refetch
- [ ] Cycle detection re-runs after edge update

**Expected Outcome**: UI reflects edge type changes in real-time.

---

#### Task 2.2: Create Cycle Resolution Hook

- [ ] Create `frontend/src/components/graph/hooks/useCycleResolution.ts`
- [ ] Implement `breakEdge`, `changeEdgeType`, `acknowledgeCycle`, `reverseEdge`
- [ ] Handle loading/error states
- [ ] Integrate with existing data hooks

**File**: `frontend/src/components/graph/hooks/useCycleResolution.ts`

```typescript
import { useState, useCallback } from "react";

export interface CycleResolutionActions {
  breakEdge: (edgeId: string) => Promise<void>;
  changeEdgeType: (
    edgeId: string,
    newType: LinkType,
    reason?: string,
  ) => Promise<void>;
  acknowledgeCycle: (nodeIds: string[], reason: string) => Promise<void>;
  unacknowledgeCycle: (cycleHash: string) => Promise<void>;
  reverseEdge: (edgeId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useCycleResolution(sessionId: string): CycleResolutionActions {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breakEdge = useCallback(
    async (edgeId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await fetch(`/api/session/${sessionId}/graph/links/${edgeId}`, {
          method: "DELETE",
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId],
  );

  const changeEdgeType = useCallback(
    async (edgeId: string, newType: LinkType, reason?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await fetch(`/api/session/${sessionId}/graph/links/${edgeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkType: newType, reason }),
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId],
  );

  const acknowledgeCycle = useCallback(
    async (nodeIds: string[], reason: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await fetch(`/api/session/${sessionId}/graph/cycles/acknowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeIds, reason }),
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId],
  );

  const reverseEdge = useCallback(
    async (edgeId: string) => {
      // Implemented as: get edge, delete, create new with swapped source/target
      setIsLoading(true);
      setError(null);
      try {
        // Fetch current edge details first
        const res = await fetch(
          `/api/session/${sessionId}/graph/links/${edgeId}`,
        );
        const edge = await res.json();

        // Delete original
        await fetch(`/api/session/${sessionId}/graph/links/${edgeId}`, {
          method: "DELETE",
        });

        // Create reversed
        await fetch(`/api/session/${sessionId}/graph/links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceBlockId: edge.targetBlockId,
            targetBlockId: edge.sourceBlockId,
            linkType: edge.linkType,
            degree: edge.degree,
            confidence: edge.confidence,
            reason: `Reversed from original: ${edge.reason || "No reason provided"}`,
          }),
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId],
  );

  const unacknowledgeCycle = useCallback(
    async (cycleHash: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await fetch(
          `/api/session/${sessionId}/graph/cycles/acknowledge/${cycleHash}`,
          {
            method: "DELETE",
          },
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId],
  );

  return {
    breakEdge,
    changeEdgeType,
    acknowledgeCycle,
    unacknowledgeCycle,
    reverseEdge,
    isLoading,
    error,
  };
}
```

**Test Script**:

```typescript
// tests/unit/graph/useCycleResolution.test.ts
describe("useCycleResolution", () => {
  it("breaks an edge via DELETE", async () => {
    const { result } = renderHook(() => useCycleResolution("session1"));
    await act(() => result.current.breakEdge("edge1"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/session/session1/graph/links/edge1",
      { method: "DELETE" },
    );
  });

  it("changes edge type via PATCH", async () => {
    const { result } = renderHook(() => useCycleResolution("session1"));
    await act(() =>
      result.current.changeEdgeType("edge1", "references", "Breaking cycle"),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/session/session1/graph/links/edge1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
```

**Pass Criteria**:

- [ ] All four resolution methods work
- [ ] Loading state managed correctly
- [ ] Errors captured and exposed
- [ ] No stale closure issues

**Expected Outcome**: Reusable hook for all cycle resolution UI components.

---

### Phase 3: UI Component Updates

#### Task 3.1: Wire Up `onBreakCycle` in Parent Components

- [ ] Find where `CycleIndicator` is rendered
- [ ] Pass `useCycleResolution` actions as props
- [ ] Handle loading/error states in UI

**Files to Update**:

- `frontend/src/components/graph/GraphContainer.tsx` (or wherever CycleIndicator is used)
- `frontend/src/components/ideation/GraphTabPanel.tsx`

**Implementation Pattern**:

```tsx
// In parent component
const { breakEdge, changeEdgeType, isLoading } = useCycleResolution(sessionId);

<CycleIndicator
  nodes={nodes}
  edges={edges}
  onBreakCycle={(cycleId, breakPointNodeId) => {
    // Find the edge from breakPointNodeId in the cycle
    const cycle = cycles.find((c) => c.id === cycleId);
    const edgeToBreak = findEdgeToBreak(cycle, breakPointNodeId);
    if (edgeToBreak) {
      breakEdge(edgeToBreak.id);
    }
  }}
  isResolvingCycle={isLoading}
/>;
```

**Pass Criteria**:

- [ ] "Break here" button triggers edge deletion
- [ ] UI shows loading state during resolution
- [ ] Cycle disappears from list after resolution
- [ ] Canvas updates immediately

**Expected Outcome**: Basic cycle breaking works end-to-end.

---

#### Task 3.2: Add Resolution Action Menu to CycleIndicator

- [ ] Replace single "Break here" with dropdown/menu
- [ ] Add options: Remove Edge, Change Type, Acknowledge, Reverse
- [ ] Show confirmation dialog for destructive actions

**File**: `frontend/src/components/graph/CycleIndicator.tsx`

**UI Design**:

```
┌─────────────────────────────────────────────────┐
│ ⚠ 2 nodes [blocking]                        ▼  │
│                                                 │
│ MVP uses static images                          │
│   ↓ requires                                    │
│   [▼ Resolve]                                   │
│     ├─ Remove this edge                         │
│     ├─ Change to "references"                   │
│     ├─ Change to "relates_to"                   │
│     ├─ Reverse direction                        │
│     └─ ──────────────                           │
│                                                 │
│ Stack: GPT-4 or Claude                          │
│   ↓ requires                                    │
│   [▼ Resolve]                                   │
│                                                 │
│ ─────────────────────────────────────────────── │
│ [Acknowledge this cycle]                        │
│ "Mark as intentional mutual dependency"         │
└─────────────────────────────────────────────────┘
```

**Implementation** (key parts):

```tsx
// New component for edge action menu
interface EdgeActionMenuProps {
  edge: GraphEdge;
  onRemove: () => void;
  onChangeType: (newType: LinkType) => void;
  onReverse: () => void;
  isLoading: boolean;
}

function EdgeActionMenu({
  edge,
  onRemove,
  onChangeType,
  onReverse,
  isLoading,
}: EdgeActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const nonBlockingTypes: LinkType[] = [
    "references",
    "supports",
    "relates_to",
    "elaborates",
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 rounded"
      >
        {isLoading ? "Resolving..." : "Resolve ▼"}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-48 bg-gray-800 rounded shadow-lg">
          <button
            onClick={onRemove}
            className="w-full px-3 py-2 text-left hover:bg-gray-700"
          >
            🗑️ Remove this edge
          </button>

          <div className="border-t border-gray-700 my-1" />

          <div className="px-3 py-1 text-xs text-gray-400">Change type to:</div>
          {nonBlockingTypes.map((type) => (
            <button
              key={type}
              onClick={() => onChangeType(type)}
              className="w-full px-3 py-2 text-left hover:bg-gray-700"
            >
              → {type}
            </button>
          ))}

          <div className="border-t border-gray-700 my-1" />

          <button
            onClick={onReverse}
            className="w-full px-3 py-2 text-left hover:bg-gray-700"
          >
            ↔️ Reverse direction
          </button>
        </div>
      )}
    </div>
  );
}
```

**Test Script**:

```typescript
// tests/unit/graph/CycleIndicator.test.tsx
describe('CycleIndicator resolution actions', () => {
  it('shows resolution menu on click', async () => {
    render(<CycleIndicator {...props} />);
    await userEvent.click(screen.getByText('Resolve ▼'));
    expect(screen.getByText('Remove this edge')).toBeInTheDocument();
  });

  it('calls onChangeType when type selected', async () => {
    const onChangeEdgeType = vi.fn();
    render(<CycleIndicator {...props} onChangeEdgeType={onChangeEdgeType} />);
    await userEvent.click(screen.getByText('Resolve ▼'));
    await userEvent.click(screen.getByText('→ references'));
    expect(onChangeEdgeType).toHaveBeenCalledWith('edge1', 'references');
  });
});
```

**Pass Criteria**:

- [ ] Menu opens on click
- [ ] All four actions visible
- [ ] Actions trigger correct callbacks
- [ ] Menu closes after selection
- [ ] Keyboard accessible (Escape to close)

**Expected Outcome**: Full resolution menu integrated into cycle indicator.

---

#### Task 3.3: Add Cycle Acknowledgment UI

- [ ] Add "Acknowledge cycle" button at cycle card footer
- [ ] Show modal/dialog for reason input
- [ ] Display acknowledged badge on acknowledged cycles
- [ ] Add "Unacknowledge" option for acknowledged cycles

**Implementation**:

```tsx
// Acknowledgment modal
function AcknowledgeCycleModal({
  cycle,
  onAcknowledge,
  onClose,
}: {
  cycle: DetectedCycle;
  onAcknowledge: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-4 w-96">
        <h3 className="text-lg font-semibold mb-2">Acknowledge Cycle</h3>
        <p className="text-sm text-gray-400 mb-4">
          This will mark the cycle as intentional and hide the warning.
        </p>

        <div className="mb-4">
          <label className="block text-sm mb-1">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Intentional mutual dependency for validation"
            className="w-full bg-gray-700 rounded p-2 text-sm"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => onAcknowledge(reason)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Pass Criteria**:

- [ ] Modal opens from cycle card
- [ ] Reason is optional but encouraged
- [ ] Acknowledged cycles show badge
- [ ] Acknowledged cycles can be filtered/hidden
- [ ] Unacknowledge removes from DB

**Expected Outcome**: Users can intentionally suppress warnings for valid mutual dependencies.

---

#### Task 3.4: Add Confirmation Dialogs for Destructive Actions

- [ ] Create reusable confirmation dialog component
- [ ] Require confirmation for "Remove edge"
- [ ] Show what will happen before confirming

**Implementation**:

```tsx
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isDestructive = false,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-4 w-80">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-300 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1 rounded ${
              isDestructive
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Pass Criteria**:

- [ ] Confirmation required before edge removal
- [ ] Dialog shows edge details (source → target)
- [ ] Cancel aborts the action
- [ ] Confirm proceeds with action

**Expected Outcome**: Users can't accidentally delete edges.

---

### Phase 4: Cycle Detection Enhancement

#### Task 4.1: Filter Acknowledged Cycles from Display

- [ ] Fetch acknowledged cycles on mount
- [ ] Add `acknowledgedCycles` to cycle detection context
- [ ] Filter acknowledged cycles from `detectCycles` output
- [ ] Add toggle to "Show acknowledged cycles"

**File**: `frontend/src/components/graph/utils/cycleDetection.ts`

**Implementation**:

```typescript
export function filterAcknowledgedCycles(
  cycles: DetectedCycle[],
  acknowledgedHashes: Set<string>,
): DetectedCycle[] {
  return cycles.filter((cycle) => !acknowledgedHashes.has(cycle.id));
}

export function computeCycleHash(nodeIds: string[]): string {
  // Sort for consistent hash regardless of starting point
  const sorted = [...nodeIds].sort();
  return sorted.join("|");
}
```

**Pass Criteria**:

- [ ] Acknowledged cycles not shown by default
- [ ] Toggle reveals acknowledged cycles (with badge)
- [ ] New cycles with same nodes auto-match acknowledgment
- [ ] Acknowledgment persists across sessions

**Expected Outcome**: Acknowledged cycles don't create noise in the UI.

---

#### Task 4.2: Add Edge-Level Break Point Suggestions

- [ ] Enhance `findBreakPoint` to return specific edge, not just node
- [ ] Consider edge age (newer edges more likely to be mistakes)
- [ ] Consider edge confidence (lower confidence = better break point)
- [ ] Return ranked list of break suggestions

**File**: `frontend/src/components/graph/utils/cycleDetection.ts`

**Implementation**:

```typescript
export interface BreakSuggestion {
  edgeId: string;
  sourceNode: string;
  targetNode: string;
  score: number; // Higher = better to break here
  reasons: string[];
}

export function suggestBreakPoints(
  cycle: DetectedCycle,
  edges: GraphEdge[],
  nodes: GraphNode[],
): BreakSuggestion[] {
  const suggestions: BreakSuggestion[] = [];

  for (const edge of cycle.edges) {
    let score = 0;
    const reasons: string[] = [];

    // Lower confidence = better break point
    if (edge.confidence !== undefined && edge.confidence < 0.7) {
      score += 30;
      reasons.push(`Low confidence (${Math.round(edge.confidence * 100)}%)`);
    }

    // Newer edges more likely to be mistakes (if we had createdAt)
    // score += recencyScore(edge.createdAt);

    // Partial/minimal degree = weaker relationship
    if (edge.degree === "partial") {
      score += 20;
      reasons.push("Partial relationship");
    } else if (edge.degree === "minimal") {
      score += 40;
      reasons.push("Minimal relationship");
    }

    // Edge from less connected node = less disruption
    const sourceConnections = edges.filter(
      (e) => e.source === edge.source || e.target === edge.source,
    ).length;
    if (sourceConnections <= 2) {
      score += 15;
      reasons.push("Source has few connections");
    }

    suggestions.push({
      edgeId: edge.id,
      sourceNode: edge.source,
      targetNode: edge.target,
      score,
      reasons,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score);
}
```

**Pass Criteria**:

- [ ] Returns ranked list of break suggestions
- [ ] Reasons are human-readable
- [ ] Highest score edge shown as "Recommended"
- [ ] All cycle edges included in suggestions

**Expected Outcome**: Users get intelligent recommendations for where to break cycles.

---

### Phase 5: Integration & Polish

#### Task 5.1: Add Keyboard Shortcuts

- [ ] `Escape` closes any open menu/modal
- [ ] `Enter` confirms default action
- [ ] Focus management for accessibility

**Pass Criteria**:

- [ ] All dialogs closeable with Escape
- [ ] Focus returns to trigger element on close
- [ ] Tab navigation works within menus

**Expected Outcome**: Keyboard users can fully operate the resolution UI.

---

#### Task 5.2: Add Undo Capability

- [ ] Track recent edge deletions in session storage
- [ ] Show "Undo" toast after edge removal
- [ ] Restore edge on undo (within 10 seconds)

**Implementation**:

```typescript
// Simple undo tracking
interface UndoAction {
  type: "edge_removed";
  edge: GraphEdge;
  timestamp: number;
}

const UNDO_TIMEOUT = 10000; // 10 seconds

function useUndoStack() {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  const pushUndo = (action: UndoAction) => {
    setUndoStack((prev) => [...prev, action]);
    // Auto-expire after timeout
    setTimeout(() => {
      setUndoStack((prev) =>
        prev.filter((a) => a.timestamp !== action.timestamp),
      );
    }, UNDO_TIMEOUT);
  };

  const popUndo = () => {
    const action = undoStack[undoStack.length - 1];
    if (action) {
      setUndoStack((prev) => prev.slice(0, -1));
      return action;
    }
    return null;
  };

  return { undoStack, pushUndo, popUndo, canUndo: undoStack.length > 0 };
}
```

**Pass Criteria**:

- [ ] Toast appears after edge removal
- [ ] Undo restores edge with same properties
- [ ] Toast auto-dismisses after 10 seconds
- [ ] Multiple undos stack correctly

**Expected Outcome**: Users can recover from accidental deletions.

---

#### Task 5.3: Add Analytics/Logging

- [ ] Log cycle resolution actions
- [ ] Track which resolution methods are most used
- [ ] Log time-to-resolution for cycles

**Pass Criteria**:

- [ ] Actions logged with cycle ID, method, and timestamp
- [ ] Logs available in server logs
- [ ] No PII in logs

**Expected Outcome**: Data to improve the feature over time.

---

### Phase 6: Testing

#### Task 6.1: Unit Tests

- [ ] `useCycleResolution` hook tests
- [ ] `cycleDetection` utility tests
- [ ] `CycleIndicator` component tests

**Test Files**:

- `tests/unit/graph/useCycleResolution.test.ts`
- `tests/unit/graph/cycleDetection.test.ts`
- `tests/unit/graph/CycleIndicator.test.tsx`

**Pass Criteria**:

- [ ] > 80% code coverage for new code
- [ ] All edge cases covered
- [ ] Mocks for API calls

---

#### Task 6.2: Integration Tests

- [ ] Full cycle resolution flow (detect → resolve → verify gone)
- [ ] WebSocket sync between clients
- [ ] Acknowledgment persistence

**Test File**: `tests/integration/cycle-resolution-flow.test.ts`

```typescript
describe("Cycle Resolution Flow", () => {
  it("removes cycle when edge is deleted", async () => {
    // Setup: Create graph with cycle
    const session = await createTestSession();
    const nodeA = await createBlock(session.id, { title: "Node A" });
    const nodeB = await createBlock(session.id, { title: "Node B" });
    const edgeAB = await createLink(session.id, nodeA.id, nodeB.id, "requires");
    const edgeBA = await createLink(session.id, nodeB.id, nodeA.id, "requires");

    // Verify cycle detected
    const cycles1 = await getCycles(session.id);
    expect(cycles1.length).toBe(1);

    // Action: Delete one edge
    await deleteLink(session.id, edgeAB.id);

    // Verify cycle resolved
    const cycles2 = await getCycles(session.id);
    expect(cycles2.length).toBe(0);
  });

  it("resolves cycle when edge type changed to non-blocking", async () => {
    // Similar setup...
    await updateLink(session.id, edgeAB.id, { linkType: "references" });

    const cycles = await getCycles(session.id);
    expect(cycles.filter((c) => c.type === "blocking").length).toBe(0);
  });

  it("hides acknowledged cycles", async () => {
    // Setup cycle...
    await acknowledgeCycle(session.id, [nodeA.id, nodeB.id], "Intentional");

    const cycles = await getCycles(session.id, { includeAcknowledged: false });
    expect(cycles.length).toBe(0);
  });
});
```

**Pass Criteria**:

- [ ] All flows pass
- [ ] Tests run in <30 seconds
- [ ] No flaky tests

---

#### Task 6.3: E2E Tests

- [ ] User can click through full resolution flow
- [ ] UI updates correctly after resolution
- [ ] Works with multiple simultaneous users

**Test File**: `tests/e2e/cycle-resolution.spec.ts` (Playwright)

```typescript
test("user can resolve a blocking cycle", async ({ page }) => {
  // Navigate to graph with known cycle
  await page.goto("/ideation/test-session");

  // Find and expand cycle indicator
  await page.click('[data-testid="cycle-indicator"]');

  // Click resolve on first edge
  await page.click('[data-testid="resolve-edge-menu"]');
  await page.click("text=Remove this edge");

  // Confirm deletion
  await page.click("text=Confirm");

  // Verify cycle is gone
  await expect(page.locator('[data-testid="cycle-indicator"]')).toContainText(
    "0 Circular",
  );
});
```

**Pass Criteria**:

- [ ] E2E test passes consistently
- [ ] Works in Chrome and Firefox
- [ ] Handles slow network gracefully

---

## Summary Checklist

### Phase 1: Backend (Est. effort: Medium)

- [ ] 1.1 Add PATCH endpoint for edge updates
- [ ] 1.2 Add cycle acknowledgment schema & endpoints
- [ ] 1.3 Add WebSocket event for link updates

### Phase 2: Frontend Hooks (Est. effort: Medium)

- [ ] 2.1 Add `onLinkUpdated` to WebSocket hook
- [ ] 2.2 Create `useCycleResolution` hook

### Phase 3: UI Components (Est. effort: Large)

- [ ] 3.1 Wire up `onBreakCycle` in parent components
- [ ] 3.2 Add resolution action menu to CycleIndicator
- [ ] 3.3 Add cycle acknowledgment UI
- [ ] 3.4 Add confirmation dialogs

### Phase 4: Detection Enhancement (Est. effort: Small)

- [ ] 4.1 Filter acknowledged cycles from display
- [ ] 4.2 Add edge-level break point suggestions

### Phase 5: Polish (Est. effort: Small)

- [ ] 5.1 Add keyboard shortcuts
- [ ] 5.2 Add undo capability
- [ ] 5.3 Add analytics/logging

### Phase 6: Testing (Est. effort: Medium)

- [ ] 6.1 Unit tests
- [ ] 6.2 Integration tests
- [ ] 6.3 E2E tests

---

## Definition of Done

- [ ] All tasks completed and checked off
- [ ] All tests passing (unit, integration, E2E)
- [ ] No TypeScript errors
- [ ] Code reviewed and approved
- [ ] Documentation updated (if needed)
- [ ] Feature flag ready for gradual rollout (optional)
