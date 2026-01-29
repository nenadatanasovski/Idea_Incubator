# Frontend Constants

Update `frontend/src/components/graph/constants.ts`:

## Graph Dimensions

```typescript
export const GRAPH_DIMENSIONS = [
  // Existing
  "problem",
  "solution",
  "market",
  "risk",
  "fit",
  "business",
  "spec",
  "distribution",
  "marketing",
  "manufacturing",
  // New
  "user",
  "competition",
  "validation",
  "tasks",
  "timeline",
  "customer",
  "product",
] as const;

export const GRAPH_DIMENSION_LABELS: Record<string, string> = {
  problem: "Problem",
  solution: "Solution",
  market: "Market",
  risk: "Risk",
  fit: "Product-Market Fit",
  business: "Business Model",
  spec: "Specification (Future)",
  distribution: "Distribution",
  marketing: "Marketing",
  manufacturing: "Manufacturing",
  user: "User Profile",
  competition: "Competition",
  validation: "Validation",
  tasks: "Tasks",
  timeline: "Timeline",
  customer: "Customer Personas",
  product: "Product (Current)",
};
```

## Block Types

```typescript
export const BLOCK_TYPES = [
  // Existing
  "insight",
  "fact",
  "assumption",
  "question",
  "decision",
  "action",
  "requirement",
  "option",
  "pattern",
  "synthesis",
  "meta",
  // New
  "constraint",
  "blocker",
  "epic",
  "story",
  "task",
  "bug",
  "persona",
  "milestone",
  "evaluation",
  "learning",
] as const;
```

## Block Type Colors

```typescript
export const BLOCK_TYPE_COLORS: Record<string, string> = {
  // Existing (keep current colors)
  insight: "#4CAF50", // Green
  fact: "#2196F3", // Blue
  assumption: "#FF9800", // Orange
  question: "#9C27B0", // Purple
  decision: "#F44336", // Red
  action: "#00BCD4", // Cyan
  requirement: "#3F51B5", // Indigo
  option: "#FFEB3B", // Yellow
  pattern: "#795548", // Brown
  synthesis: "#E91E63", // Pink
  meta: "#607D8B", // Blue Grey

  // New types
  constraint: "#FF5722", // Deep Orange
  blocker: "#D32F2F", // Dark Red
  epic: "#7B1FA2", // Dark Purple
  story: "#512DA8", // Deep Purple
  task: "#1976D2", // Dark Blue
  bug: "#C62828", // Red 800
  persona: "#00796B", // Teal
  milestone: "#FFA000", // Amber
  evaluation: "#388E3C", // Green 700
  learning: "#5D4037", // Brown 700
};
```

## Block Type Icons

```typescript
export const BLOCK_TYPE_ICONS: Record<string, string> = {
  // ... existing ...
  constraint: "block",
  blocker: "error",
  epic: "rocket",
  story: "book",
  task: "check_box",
  bug: "bug_report",
  persona: "person",
  milestone: "flag",
  evaluation: "assessment",
  learning: "school",
};
```

## Filter Presets

```typescript
export const FILTER_PRESETS = {
  userProfile: {
    name: "User Profile",
    graphMemberships: ["user"],
    blockTypes: ["fact", "constraint", "insight"],
  },
  taskManagement: {
    name: "Tasks",
    graphMemberships: ["tasks"],
    blockTypes: ["epic", "story", "task", "bug"],
  },
  marketAnalysis: {
    name: "Market Analysis",
    graphMemberships: ["market", "competition", "customer"],
  },
  specRequirements: {
    name: "Spec & Requirements",
    graphMemberships: ["spec"],
    blockTypes: ["requirement", "constraint", "decision"],
  },
};
```

## Legend Groups

```typescript
const LEGEND_GROUPS = {
  Knowledge: ["insight", "fact", "assumption", "pattern", "synthesis"],
  Decisions: ["question", "decision", "option"],
  Actions: ["action", "requirement"],
  Tasks: ["epic", "story", "task", "bug", "blocker"],
  People: ["persona"],
  Planning: ["milestone", "constraint"],
  Learning: ["evaluation", "learning"],
  Meta: ["meta"],
};
```
