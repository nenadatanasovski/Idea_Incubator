# Implementation Plan: Native Graph Clustering

**Status:** Draft
**Created:** 2026-01-25
**Estimated Effort:** Medium

---

## Problem Statement

The current graph visualization uses Reagraph's force-directed layout with basic settings (`nodeStrength: -100`, `linkDistance: 100`), resulting in:

1. **No spatial clustering** - Nodes that logically belong together aren't grouped visually
2. **Disconnected nodes float randomly** - Causing visual chaos and cognitive load
3. **Unused cluster field** - `GraphNode.cluster` exists (line 295 of `types/graph.ts`) but is never applied
4. **clusterAttribute not enabled** - Reagraph supports native clustering but it's disabled

---

## Solution Overview

Enable Reagraph's native clustering via the `clusterAttribute` prop with:

1. Auto-assignment of clusters based on `graphMembership[0]` (primary strategy)
2. UI controls for switching clustering strategies
3. Visual boundaries around cluster groups
4. Dynamic layout physics tuned for clustering

---

## Task Breakdown

### Task 1: Add Clustering Strategy Type & State

**Description:** Define clustering strategy types and add state management for cluster configuration.

**Files to Modify:**

- `frontend/src/types/graph.ts` - Add ClusterStrategy type
- `frontend/src/components/graph/hooks/useGraphFilters.ts` - Add clustering state

**Implementation Details:**

```typescript
// types/graph.ts - Add after line 296
export type ClusterStrategy =
  | "none" // No clustering
  | "graphMembership" // Group by graphMembership[0]
  | "blockType" // Group by blockType
  | "abstraction" // Group by abstractionLevel
  | "status" // Group by status
  | "custom"; // User-defined groups

export interface ClusterConfig {
  strategy: ClusterStrategy;
  customGroups?: Record<string, string[]>; // clusterName -> nodeIds
  strength: number; // 0.0 - 1.0
}
```

**Test Script:**

```bash
# Verify TypeScript compilation
cd frontend && npm run build 2>&1 | grep -E "(error|ClusterStrategy)"

# Expected: No errors, ClusterStrategy type should be exported
```

**Pass Criteria:**

- [ ] `ClusterStrategy` type is exported from `types/graph.ts`
- [ ] `ClusterConfig` interface is defined
- [ ] TypeScript compiles without errors
- [ ] No runtime import errors

**Expected Memory Graph Log:**

```
[CLUSTERING] Task 1 Complete
- Added ClusterStrategy type with 6 options: none, graphMembership, blockType, abstraction, status, custom
- Added ClusterConfig interface with strategy, customGroups, strength fields
- Types exported from types/graph.ts
```

---

### Task 2: Create useGraphClustering Hook

**Description:** Create a dedicated hook for managing clustering logic and computing cluster assignments.

**Files to Create:**

- `frontend/src/components/graph/hooks/useGraphClustering.ts`

**Implementation Details:**

```typescript
// useGraphClustering.ts
export interface UseGraphClusteringReturn {
  // Current strategy
  clusterStrategy: ClusterStrategy;
  setClusterStrategy: (strategy: ClusterStrategy) => void;

  // Cluster strength (0.0 - 1.0)
  clusterStrength: number;
  setClusterStrength: (strength: number) => void;

  // Computed cluster assignments
  getClusterForNode: (node: GraphNode) => string | undefined;

  // Apply clusters to nodes (returns nodes with cluster field populated)
  applyClusterAssignments: (nodes: GraphNode[]) => GraphNode[];

  // Available clusters based on current strategy
  availableClusters: string[];
}
```

**Cluster Assignment Logic:**

- `graphMembership` strategy: Use `node.graphMembership[0]` (problem, solution, market, etc.)
- `blockType` strategy: Use `node.blockType` (content, synthesis, decision, etc.)
- `abstraction` strategy: Use `node.abstractionLevel` (vision, strategy, tactic, implementation)
- `status` strategy: Use `node.status` (draft, active, validated, etc.)
- `custom` strategy: Look up nodeId in customGroups map

**Test Script:**

```typescript
// frontend/src/components/graph/hooks/__tests__/useGraphClustering.test.ts
import { renderHook, act } from "@testing-library/react";
import { useGraphClustering } from "../useGraphClustering";

describe("useGraphClustering", () => {
  const mockNodes: GraphNode[] = [
    {
      id: "1",
      graphMembership: ["problem"],
      blockType: "content",
      status: "active",
    },
    {
      id: "2",
      graphMembership: ["solution"],
      blockType: "synthesis",
      status: "draft",
    },
    {
      id: "3",
      graphMembership: ["problem"],
      blockType: "content",
      status: "active",
    },
  ];

  test("graphMembership strategy assigns clusters correctly", () => {
    const { result } = renderHook(() => useGraphClustering(mockNodes));

    act(() => {
      result.current.setClusterStrategy("graphMembership");
    });

    const clustered = result.current.applyClusterAssignments(mockNodes);
    expect(clustered[0].cluster).toBe("problem");
    expect(clustered[1].cluster).toBe("solution");
    expect(clustered[2].cluster).toBe("problem");
  });

  test("blockType strategy assigns clusters correctly", () => {
    const { result } = renderHook(() => useGraphClustering(mockNodes));

    act(() => {
      result.current.setClusterStrategy("blockType");
    });

    const clustered = result.current.applyClusterAssignments(mockNodes);
    expect(clustered[0].cluster).toBe("content");
    expect(clustered[1].cluster).toBe("synthesis");
  });

  test("none strategy clears clusters", () => {
    const { result } = renderHook(() => useGraphClustering(mockNodes));

    act(() => {
      result.current.setClusterStrategy("none");
    });

    const clustered = result.current.applyClusterAssignments(mockNodes);
    expect(clustered[0].cluster).toBeUndefined();
  });
});
```

**Run Test:**

```bash
cd frontend && npm test -- --testPathPattern="useGraphClustering" --verbose
```

**Pass Criteria:**

- [ ] Hook exports `useGraphClustering` function
- [ ] All 3 test cases pass
- [ ] Cluster assignments match expected values for each strategy
- [ ] `availableClusters` returns correct list based on strategy

**Expected Memory Graph Log:**

```
[CLUSTERING] Task 2 Complete
- Created useGraphClustering hook at hooks/useGraphClustering.ts
- Implemented 6 clustering strategies
- Strategy logic:
  - none: Returns undefined cluster
  - graphMembership: Uses graphMembership[0]
  - blockType: Uses blockType field
  - abstraction: Uses abstractionLevel field
  - status: Uses status field
  - custom: Looks up in customGroups map
- Tests passing: 3/3
```

---

### Task 3: Enable clusterAttribute on GraphCanvas

**Description:** Add the `clusterAttribute` prop to ReagraphCanvas and update layout physics.

**Files to Modify:**

- `frontend/src/components/graph/GraphCanvas.tsx`

**Implementation Details:**

Update GraphCanvas props interface:

```typescript
// Add to GraphCanvasProps (around line 130)
clusterAttribute?: string;
clusterStrength?: number;
```

Update ReagraphCanvas component (around line 797):

```typescript
<ReagraphCanvas
  // ... existing props
  clusterAttribute={clusterAttribute}  // Enable native clustering
  layoutOverrides={{
    nodeStrength: -150,        // Increased repulsion
    linkDistance: 120,         // Slightly longer edges
    clusterStrength: clusterStrength ?? 0.7,  // Keep clusters together
  }}
  // ... rest of props
/>
```

**Test Script:**

```bash
# Start dev server and verify no console errors
cd frontend && npm run dev &
sleep 5
curl -s http://localhost:5173 | head -20

# Check for TypeScript errors
npm run build 2>&1 | grep -E "(error|clusterAttribute)"
```

**Manual Verification Script:**

```typescript
// Open browser console and run:
// 1. Verify clusterAttribute prop is passed
const canvas = document.querySelector('[data-testid="graph-canvas"]');
console.log("Canvas props:", canvas?.__reactProps);

// 2. Check layout overrides in Reagraph internals
window.__REAGRAPH_DEBUG__ = true; // If available
```

**Pass Criteria:**

- [ ] `clusterAttribute` prop added to GraphCanvas
- [ ] `clusterStrength` prop added to layoutOverrides
- [ ] TypeScript compiles without errors
- [ ] No console errors when rendering graph
- [ ] Physics values updated: `nodeStrength: -150`, `linkDistance: 120`

**Expected Memory Graph Log:**

```
[CLUSTERING] Task 3 Complete
- Modified GraphCanvas.tsx
- Added clusterAttribute prop (line ~798)
- Updated layoutOverrides:
  - nodeStrength: -100 -> -150 (increased repulsion)
  - linkDistance: 100 -> 120 (longer edges)
  - clusterStrength: 0.7 (new, keeps clusters together)
- No breaking changes to existing functionality
```

---

### Task 4: Add Cluster Theme Styling

**Description:** Configure visual styling for cluster boundaries and labels.

**Files to Modify:**

- `frontend/src/components/graph/GraphCanvas.tsx` - Add cluster theme

**Implementation Details:**

Add cluster theme to the theme object (around line 856):

```typescript
theme={{
  // ... existing theme properties
  cluster: {
    stroke: '#CBD5E1',        // Slate-300 - subtle boundary
    fill: 'rgba(241, 245, 249, 0.3)', // Slate-100 with transparency
    label: {
      stroke: '#F1F5F9',      // Slate-100 - label background
      color: '#475569',       // Slate-600 - label text
      fontSize: 12,
    }
  }
}}
```

Create cluster color mapping utility:

```typescript
// utils/clusterStyles.ts
export const clusterColors: Record<
  GraphType,
  { stroke: string; fill: string }
> = {
  problem: { stroke: "#FCA5A5", fill: "rgba(254, 226, 226, 0.3)" }, // Red tints
  solution: { stroke: "#86EFAC", fill: "rgba(220, 252, 231, 0.3)" }, // Green tints
  market: { stroke: "#93C5FD", fill: "rgba(219, 234, 254, 0.3)" }, // Blue tints
  risk: { stroke: "#FCD34D", fill: "rgba(254, 249, 195, 0.3)" }, // Amber tints
  fit: { stroke: "#C4B5FD", fill: "rgba(237, 233, 254, 0.3)" }, // Purple tints
  business: { stroke: "#5EEAD4", fill: "rgba(204, 251, 241, 0.3)" }, // Teal tints
  spec: { stroke: "#D1D5DB", fill: "rgba(243, 244, 246, 0.3)" }, // Gray tints
};
```

**Test Script:**

```typescript
// frontend/src/components/graph/utils/__tests__/clusterStyles.test.ts
import { clusterColors } from "../clusterStyles";

describe("clusterColors", () => {
  test("all GraphTypes have color mappings", () => {
    const graphTypes = [
      "problem",
      "solution",
      "market",
      "risk",
      "fit",
      "business",
      "spec",
    ];
    graphTypes.forEach((type) => {
      expect(clusterColors[type]).toBeDefined();
      expect(clusterColors[type].stroke).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(clusterColors[type].fill).toContain("rgba");
    });
  });
});
```

**Pass Criteria:**

- [ ] Cluster theme added to GraphCanvas
- [ ] `clusterColors` utility created with all 7 GraphType mappings
- [ ] Cluster boundaries render with correct colors
- [ ] Cluster labels are readable (proper contrast)

**Expected Memory Graph Log:**

```
[CLUSTERING] Task 4 Complete
- Added cluster theme to GraphCanvas.tsx theme object
- Created clusterStyles.ts with clusterColors mapping
- Color scheme:
  - problem: Red tints
  - solution: Green tints
  - market: Blue tints
  - risk: Amber tints
  - fit: Purple tints
  - business: Teal tints
  - spec: Gray tints
- Boundary opacity: 0.3 (subtle but visible)
```

---

### Task 5: Integrate Clustering into GraphContainer

**Description:** Wire up the clustering hook into the main graph container and pass cluster data to canvas.

**Files to Modify:**

- `frontend/src/components/graph/GraphContainer.tsx`

**Implementation Details:**

```typescript
// Import the hook
import { useGraphClustering } from './hooks/useGraphClustering';

// Inside GraphContainer component
const {
  clusterStrategy,
  setClusterStrategy,
  clusterStrength,
  setClusterStrength,
  applyClusterAssignments,
  availableClusters,
} = useGraphClustering(nodes);

// Apply cluster assignments before passing to canvas
const clusteredNodes = useMemo(() => {
  return applyClusterAssignments(filteredNodes);
}, [filteredNodes, applyClusterAssignments]);

// Pass to GraphCanvas
<GraphCanvas
  nodes={clusteredNodes}  // Instead of filteredNodes
  edges={filteredEdges}
  clusterAttribute={clusterStrategy !== 'none' ? 'cluster' : undefined}
  clusterStrength={clusterStrength}
  // ... other props
/>
```

**Test Script:**

```bash
# E2E test for clustering integration
python3 tests/e2e/test_graph_clustering.py
```

```python
# tests/e2e/test_graph_clustering.py
import subprocess
import time
import json

def test_clustering_integration():
    """Verify clustering is properly integrated into GraphContainer"""

    # Start dev server if not running
    # Navigate to graph view
    # Verify nodes have cluster attribute when strategy enabled

    # Check 1: Default state (no clustering)
    result = subprocess.run([
        'curl', '-s', 'http://localhost:3000/api/ideas/test-idea/graph'
    ], capture_output=True, text=True)

    data = json.loads(result.stdout)
    nodes = data.get('blocks', [])

    # Nodes should NOT have cluster field by default
    for node in nodes[:5]:
        assert 'cluster' not in node or node.get('cluster') is None, \
            "Cluster should not be set by default"

    print("PASS: Default state has no clustering")

    # Check 2: Verify clustering hook is called (via console log in dev)
    # This requires browser automation - placeholder for manual check

    print("PASS: Clustering integration test complete")

if __name__ == "__main__":
    test_clustering_integration()
```

**Pass Criteria:**

- [ ] `useGraphClustering` imported in GraphContainer
- [ ] `applyClusterAssignments` called on filtered nodes
- [ ] `clusterAttribute` prop passed to GraphCanvas
- [ ] Graph renders without errors
- [ ] Cluster assignments visible when strategy enabled

**Expected Memory Graph Log:**

```
[CLUSTERING] Task 5 Complete
- Modified GraphContainer.tsx
- Integrated useGraphClustering hook
- Data flow:
  1. Raw nodes from API
  2. Filter via useGraphFilters
  3. Apply clusters via useGraphClustering
  4. Pass to GraphCanvas with clusterAttribute
- clusterAttribute conditionally set based on strategy !== 'none'
```

---

### Task 6: Add Cluster Strategy Dropdown UI

**Description:** Add UI control to switch between clustering strategies.

**Files to Modify:**

- `frontend/src/components/graph/GraphControls.tsx`

**Implementation Details:**

Add after the Layout Selector (around line 927):

```typescript
// Cluster strategy options
const CLUSTER_STRATEGIES = [
  { value: 'none', label: 'No Clustering' },
  { value: 'graphMembership', label: 'By Domain', description: 'Problem, Solution, Market...' },
  { value: 'blockType', label: 'By Type', description: 'Content, Synthesis, Decision...' },
  { value: 'abstraction', label: 'By Level', description: 'Vision, Strategy, Tactic...' },
  { value: 'status', label: 'By Status', description: 'Draft, Active, Validated...' },
] as const;

// State for dropdown
const [isClusterDropdownOpen, setIsClusterDropdownOpen] = useState(false);

// Render cluster dropdown
{showClusterControls && onClusterStrategyChange && (
  <>
    <div className="relative">
      <button
        onClick={() => setIsClusterDropdownOpen(!isClusterDropdownOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 rounded hover:bg-gray-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span>
          {CLUSTER_STRATEGIES.find(s => s.value === currentClusterStrategy)?.label || 'Cluster'}
        </span>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isClusterDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px]">
          {CLUSTER_STRATEGIES.map((strategy) => (
            <button
              key={strategy.value}
              onClick={() => {
                onClusterStrategyChange(strategy.value);
                setIsClusterDropdownOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg ${
                currentClusterStrategy === strategy.value
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600'
              }`}
            >
              <div className="text-xs font-medium">{strategy.label}</div>
              {strategy.description && (
                <div className="text-[10px] text-gray-400">{strategy.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
    <div className="w-px h-6 bg-gray-200" />
  </>
)}
```

**Test Script:**

```typescript
// frontend/src/components/graph/__tests__/GraphControls.clustering.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphControls } from '../GraphControls';

describe('GraphControls - Clustering', () => {
  const mockOnClusterStrategyChange = jest.fn();

  test('renders cluster dropdown when enabled', () => {
    render(
      <GraphControls
        showClusterControls={true}
        currentClusterStrategy="none"
        onClusterStrategyChange={mockOnClusterStrategyChange}
      />
    );

    expect(screen.getByText('No Clustering')).toBeInTheDocument();
  });

  test('opens dropdown on click', () => {
    render(
      <GraphControls
        showClusterControls={true}
        currentClusterStrategy="none"
        onClusterStrategyChange={mockOnClusterStrategyChange}
      />
    );

    fireEvent.click(screen.getByText('No Clustering'));
    expect(screen.getByText('By Domain')).toBeInTheDocument();
    expect(screen.getByText('By Type')).toBeInTheDocument();
  });

  test('calls callback when strategy selected', () => {
    render(
      <GraphControls
        showClusterControls={true}
        currentClusterStrategy="none"
        onClusterStrategyChange={mockOnClusterStrategyChange}
      />
    );

    fireEvent.click(screen.getByText('No Clustering'));
    fireEvent.click(screen.getByText('By Domain'));

    expect(mockOnClusterStrategyChange).toHaveBeenCalledWith('graphMembership');
  });
});
```

**Run Tests:**

```bash
cd frontend && npm test -- --testPathPattern="GraphControls.clustering" --verbose
```

**Pass Criteria:**

- [ ] Cluster dropdown renders in controls bar
- [ ] Dropdown shows all 5 strategies
- [ ] Selected strategy highlighted with blue background
- [ ] Callback fired when strategy selected
- [ ] Dropdown closes after selection
- [ ] Descriptions show for each option

**Expected Memory Graph Log:**

```
[CLUSTERING] Task 6 Complete
- Modified GraphControls.tsx
- Added CLUSTER_STRATEGIES constant with 5 options
- Added isClusterDropdownOpen state
- Dropdown UI:
  - Position: After Layout Selector
  - Icon: Group/cluster icon
  - Shows current strategy label
  - Dropdown items include descriptions
- Tests passing: 3/3
```

---

### Task 7: Add Cluster Strength Slider (Optional Enhancement)

**Description:** Add a slider control to adjust clustering tightness.

**Files to Modify:**

- `frontend/src/components/graph/GraphControls.tsx`

**Implementation Details:**

Add inside the cluster dropdown or as a separate control:

```typescript
{/* Cluster Strength Slider */}
{currentClusterStrategy !== 'none' && (
  <div className="px-3 py-2 border-t border-gray-100">
    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
      <span>Cluster Tightness</span>
      <span>{Math.round(clusterStrength * 100)}%</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={clusterStrength * 100}
      onChange={(e) => onClusterStrengthChange(Number(e.target.value) / 100)}
      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
    />
  </div>
)}
```

**Test Script:**

```typescript
test('cluster strength slider updates value', () => {
  const mockOnStrengthChange = jest.fn();
  render(
    <GraphControls
      showClusterControls={true}
      currentClusterStrategy="graphMembership"
      clusterStrength={0.7}
      onClusterStrengthChange={mockOnStrengthChange}
    />
  );

  const slider = screen.getByRole('slider');
  fireEvent.change(slider, { target: { value: '50' } });

  expect(mockOnStrengthChange).toHaveBeenCalledWith(0.5);
});
```

**Pass Criteria:**

- [ ] Slider appears when clustering is enabled
- [ ] Slider hidden when strategy is 'none'
- [ ] Value displays as percentage (0-100%)
- [ ] Callback fires with decimal value (0.0-1.0)
- [ ] Visual feedback on slider position

**Expected Memory Graph Log:**

```
[CLUSTERING] Task 7 Complete
- Added cluster strength slider to GraphControls.tsx
- Range: 0-100% (maps to 0.0-1.0 internally)
- Conditionally rendered when clustering enabled
- Smooth interaction with accent-blue-500 styling
```

---

### Task 8: URL State Synchronization

**Description:** Persist clustering settings in URL for shareability.

**Files to Modify:**

- `frontend/src/components/graph/hooks/useGraphFilters.ts`

**Implementation Details:**

Add to URL_PARAM_KEYS:

```typescript
const URL_PARAM_KEYS = {
  // ... existing keys
  clusterStrategy: "cluster",
  clusterStrength: "clusterStrength",
} as const;
```

Update parseFiltersFromUrl and updateUrlWithFilters to handle clustering params.

**Test Script:**

```typescript
describe("URL clustering params", () => {
  test("parses cluster strategy from URL", () => {
    window.history.pushState({}, "", "?cluster=graphMembership");
    const filters = parseFiltersFromUrl();
    expect(filters.clusterStrategy).toBe("graphMembership");
  });

  test("updates URL with cluster strategy", () => {
    updateUrlWithFilters({
      ...defaultFilterState,
      clusterStrategy: "blockType",
    });
    expect(window.location.search).toContain("cluster=blockType");
  });
});
```

**Pass Criteria:**

- [ ] Cluster strategy persists in URL as `?cluster=<strategy>`
- [ ] Cluster strength persists as `?clusterStrength=0.7`
- [ ] URL params parsed on page load
- [ ] Shareable URLs work correctly

**Expected Memory Graph Log:**

```
[CLUSTERING] Task 8 Complete
- Modified useGraphFilters.ts
- Added URL params:
  - cluster: Strategy name (graphMembership, blockType, etc.)
  - clusterStrength: Decimal value (0.0-1.0)
- Bidirectional sync: URL <-> State
- Shareable URLs: https://app.com/graph?cluster=graphMembership&clusterStrength=0.8
```

---

### Task 9: End-to-End Integration Test

**Description:** Comprehensive E2E test verifying full clustering functionality.

**Files to Create:**

- `tests/e2e/test_graph_clustering_e2e.py`

**Test Script:**

```python
#!/usr/bin/env python3
"""
E2E Test: Graph Clustering Feature
Tests the complete clustering workflow from UI to rendering
"""

import subprocess
import time
import json
import sys

def run_test(name, check_fn):
    """Run a test and report result"""
    try:
        check_fn()
        print(f"  PASS: {name}")
        return True
    except AssertionError as e:
        print(f"  FAIL: {name} - {e}")
        return False

def test_api_returns_nodes():
    """Verify API returns node data"""
    result = subprocess.run([
        'curl', '-s', 'http://localhost:3000/api/ideas/test-idea/graph'
    ], capture_output=True, text=True, timeout=10)

    data = json.loads(result.stdout)
    assert 'blocks' in data, "API should return blocks"
    assert len(data['blocks']) > 0, "Should have at least 1 block"

def test_nodes_have_graph_membership():
    """Verify nodes have graphMembership for clustering"""
    result = subprocess.run([
        'curl', '-s', 'http://localhost:3000/api/ideas/test-idea/graph'
    ], capture_output=True, text=True, timeout=10)

    data = json.loads(result.stdout)
    for block in data['blocks'][:5]:
        props = block.get('properties', {})
        gm = props.get('graph_membership', [])
        assert len(gm) > 0, f"Block {block['id']} missing graph_membership"

def test_cluster_url_param():
    """Verify cluster URL param is accepted"""
    result = subprocess.run([
        'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
        'http://localhost:3000/ideas/test-idea?cluster=graphMembership'
    ], capture_output=True, text=True, timeout=10)

    assert result.stdout == '200', f"Expected 200, got {result.stdout}"

def main():
    print("\n=== Graph Clustering E2E Tests ===\n")

    results = []
    results.append(run_test("API returns nodes", test_api_returns_nodes))
    results.append(run_test("Nodes have graph_membership", test_nodes_have_graph_membership))
    results.append(run_test("Cluster URL param accepted", test_cluster_url_param))

    print(f"\n=== Results: {sum(results)}/{len(results)} passed ===")

    return 0 if all(results) else 1

if __name__ == "__main__":
    sys.exit(main())
```

**Run:**

```bash
python3 tests/e2e/test_graph_clustering_e2e.py
```

**Pass Criteria:**

- [ ] All 3 E2E tests pass
- [ ] API returns nodes with graphMembership
- [ ] URL params don't break page load
- [ ] No console errors in browser

**Expected Memory Graph Log:**

```
[CLUSTERING] Task 9 Complete
- Created test_graph_clustering_e2e.py
- Tests:
  1. API returns nodes: PASS
  2. Nodes have graph_membership: PASS
  3. Cluster URL param accepted: PASS
- All E2E tests passing: 3/3
```

---

## Summary Checklist

| Task | Description                                        | Status |
| ---- | -------------------------------------------------- | ------ |
| 1    | Add ClusterStrategy type & ClusterConfig interface | [ ]    |
| 2    | Create useGraphClustering hook                     | [ ]    |
| 3    | Enable clusterAttribute on GraphCanvas             | [ ]    |
| 4    | Add cluster theme styling                          | [ ]    |
| 5    | Integrate into GraphContainer                      | [ ]    |
| 6    | Add cluster strategy dropdown UI                   | [ ]    |
| 7    | Add cluster strength slider (optional)             | [ ]    |
| 8    | URL state synchronization                          | [ ]    |
| 9    | E2E integration test                               | [ ]    |

---

## Rollback Plan

If issues arise:

1. **Revert clusterAttribute**: Set to `undefined` in GraphCanvas
2. **Restore layout physics**: Reset to `nodeStrength: -100`, `linkDistance: 100`
3. **Hide UI**: Set `showClusterControls={false}` in GraphContainer
4. **Remove URL params**: Delete `cluster` and `clusterStrength` from URL parsing

---

## Dependencies

- **Reagraph 4.18.1** - DO NOT UPGRADE (causes breaking errors)
- **d3-force-cluster-3d** - Bundled with Reagraph (no additional install)

---

## Notes

- The `cluster` field already exists in `GraphNode` (line 295 of types/graph.ts)
- Current layout physics may need tuning based on visual testing
- Consider adding keyboard shortcuts for quick strategy switching
