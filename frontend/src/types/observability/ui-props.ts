/**
 * OBS-209: UI Component Prop Types
 *
 * React component prop types for observability UI.
 */

import type {
  TranscriptEntry,
  TranscriptEntryType,
  EntryCategory,
  ExecutionRun,
} from "./transcript";
import type {
  ToolUse,
  ToolCategory,
  ToolResultStatus,
  ToolUseSummary,
} from "./tool-use";
import type {
  AssertionResult,
  AssertionCategory,
  AssertionResultType,
  AssertionChain,
  AssertionSummary,
} from "./assertion";
import type { SkillTrace, SkillStatus, SkillsUsageSummary } from "./skill";
import type {
  MessageBusLogEntry,
  MessageBusSeverity,
  MessageBusCategory,
} from "./message-bus";
import type { ExecutionResponse } from "./api";
import type { CrossRefEntityType } from "./cross-refs";

// =============================================================================
// VIEW TYPES
// =============================================================================

/**
 * Available observability views.
 */
export type ObservabilityView =
  | "timeline"
  | "tool-uses"
  | "assertions"
  | "skills"
  | "logs"
  | "summary";

// =============================================================================
// EXECUTION COMPONENTS
// =============================================================================

/**
 * Props for ExecutionList component.
 */
export interface ExecutionListProps {
  taskListId?: string;
  onExecutionSelect?: (executionId: string) => void;
  showStatus?: boolean;
  limit?: number;
}

/**
 * Props for ExecutionCard component.
 */
export interface ExecutionCardProps {
  execution: ExecutionResponse;
  isSelected?: boolean;
  onClick?: () => void;
  showDetails?: boolean;
}

/**
 * Props for ExecutionSummary component.
 */
export interface ExecutionSummaryProps {
  executionId: string;
  showTimeline?: boolean;
  showStats?: boolean;
  compact?: boolean;
}

// =============================================================================
// TRANSCRIPT COMPONENTS
// =============================================================================

/**
 * Props for TranscriptViewer component.
 */
export interface TranscriptViewerProps {
  executionId: string;
  taskId?: string;
  filters?: {
    entryTypes?: TranscriptEntryType[];
    categories?: EntryCategory[];
  };
  autoScroll?: boolean;
  maxEntries?: number;
  onEntryClick?: (entry: TranscriptEntry) => void;
  highlightEntryId?: string;
}

/**
 * Props for TranscriptEntry component.
 */
export interface TranscriptEntryProps {
  entry: TranscriptEntry;
  isHighlighted?: boolean;
  showDetails?: boolean;
  showTimestamp?: boolean;
  onClick?: () => void;
  onRelatedClick?: (entityType: string, entityId: string) => void;
}

/**
 * Props for TranscriptFilter component.
 */
export interface TranscriptFilterProps {
  selectedEntryTypes: TranscriptEntryType[];
  selectedCategories: EntryCategory[];
  onEntryTypesChange: (types: TranscriptEntryType[]) => void;
  onCategoriesChange: (categories: EntryCategory[]) => void;
  onClear: () => void;
}

// =============================================================================
// TOOL USE COMPONENTS
// =============================================================================

/**
 * Props for ToolUseList component.
 */
export interface ToolUseListProps {
  executionId: string;
  taskId?: string;
  filters?: {
    tools?: string[];
    categories?: ToolCategory[];
    status?: ToolResultStatus[];
  };
  onToolUseClick?: (toolUse: ToolUse) => void;
  showInputOutput?: boolean;
}

/**
 * Props for ToolUseCard component.
 */
export interface ToolUseCardProps {
  toolUse: ToolUse;
  showInput?: boolean;
  showOutput?: boolean;
  compact?: boolean;
  onClick?: () => void;
  onRelatedClick?: (entityType: string, entityId: string) => void;
}

/**
 * Props for ToolUseSummary component.
 */
export interface ToolUseSummaryProps {
  summary: ToolUseSummary;
  showBreakdown?: boolean;
  showErrors?: boolean;
}

/**
 * Props for ToolUseFilter component.
 */
export interface ToolUseFilterProps {
  selectedTools: string[];
  selectedCategories: ToolCategory[];
  selectedStatus: ToolResultStatus[];
  onToolsChange: (tools: string[]) => void;
  onCategoriesChange: (categories: ToolCategory[]) => void;
  onStatusChange: (status: ToolResultStatus[]) => void;
  onClear: () => void;
}

// =============================================================================
// ASSERTION COMPONENTS
// =============================================================================

/**
 * Props for AssertionList component.
 */
export interface AssertionListProps {
  executionId: string;
  taskId?: string;
  chainId?: string;
  filters?: {
    categories?: AssertionCategory[];
    results?: AssertionResultType[];
  };
  onAssertionClick?: (assertion: AssertionResult) => void;
  showEvidence?: boolean;
}

/**
 * Props for AssertionCard component.
 */
export interface AssertionCardProps {
  assertion: AssertionResult;
  showEvidence?: boolean;
  compact?: boolean;
  onClick?: () => void;
  onChainNavigate?: (direction: "prev" | "next") => void;
}

/**
 * Props for AssertionChainViewer component.
 */
export interface AssertionChainViewerProps {
  chain: AssertionChain;
  assertions: AssertionResult[];
  onAssertionClick?: (assertionId: string) => void;
  highlightAssertionId?: string;
}

/**
 * Props for AssertionBadge component (small status indicator).
 */
export interface AssertionBadgeProps {
  result: AssertionResultType;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
}

/**
 * Props for AssertionSummary component.
 */
export interface AssertionSummaryProps {
  summary: AssertionSummary;
  showBreakdown?: boolean;
  showFailures?: boolean;
}

// =============================================================================
// SKILL COMPONENTS
// =============================================================================

/**
 * Props for SkillTraceList component.
 */
export interface SkillTraceListProps {
  executionId: string;
  taskId?: string;
  onSkillClick?: (skill: SkillTrace) => void;
  showNested?: boolean;
}

/**
 * Props for SkillTraceCard component.
 */
export interface SkillTraceCardProps {
  skill: SkillTrace;
  showDetails?: boolean;
  showToolCalls?: boolean;
  onClick?: () => void;
  onToolUseClick?: (toolUseId: string) => void;
}

/**
 * Props for SkillTreeViewer component.
 */
export interface SkillTreeViewerProps {
  taskId: string;
  executionId: string;
  onNodeClick?: (
    nodeType: "skill" | "tool" | "assertion",
    nodeId: string,
  ) => void;
  exportFormat?: "svg" | "mermaid" | "png";
}

/**
 * Props for SkillsSummary component.
 */
export interface SkillsSummaryProps {
  summary: SkillsUsageSummary;
  showFileReferences?: boolean;
}

// =============================================================================
// MESSAGE BUS COMPONENTS
// =============================================================================

/**
 * Props for MessageBusLog component.
 */
export interface MessageBusLogProps {
  executionId?: string;
  filters?: {
    severity?: MessageBusSeverity[];
    category?: MessageBusCategory[];
    source?: string;
  };
  autoScroll?: boolean;
  maxEntries?: number;
  onEntryClick?: (entry: MessageBusLogEntry) => void;
}

/**
 * Props for MessageBusEntry component.
 */
export interface MessageBusEntryProps {
  entry: MessageBusLogEntry;
  showPayload?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

/**
 * Props for MessageBusFilter component.
 */
export interface MessageBusFilterProps {
  selectedSeverity: MessageBusSeverity[];
  selectedCategory: MessageBusCategory[];
  selectedSource?: string;
  onSeverityChange: (severity: MessageBusSeverity[]) => void;
  onCategoryChange: (category: MessageBusCategory[]) => void;
  onSourceChange: (source: string | undefined) => void;
  onClear: () => void;
}

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

/**
 * Props for ViewSelector component.
 */
export interface ViewSelectorProps {
  currentView: ObservabilityView;
  onViewChange: (view: ObservabilityView) => void;
  availableViews?: ObservabilityView[];
}

/**
 * Props for StatusBadge component.
 */
export interface StatusBadgeProps {
  status:
    | ToolResultStatus
    | AssertionResultType
    | ExecutionRun["status"]
    | SkillStatus;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
}

/**
 * Props for QuickStats component.
 */
export interface QuickStatsProps {
  executionId?: string;
  refreshIntervalMs?: number;
}

/**
 * Data structure for QuickStats display.
 */
export interface QuickStatsData {
  activeExecutions: number;
  toolCallsPerMinute: number;
  passRate: number;
  errorCount: number;
  blockedCount: number;
  discoveriesCount: number;
}

/**
 * Props for Breadcrumbs component.
 */
export interface BreadcrumbsProps {
  segments: Array<{
    label: string;
    href?: string;
    entityType?: CrossRefEntityType;
    entityId?: string;
  }>;
  onNavigate?: (href: string) => void;
}

/**
 * Props for FilterPanel component (generic).
 */
export interface FilterPanelProps<T extends Record<string, unknown>> {
  filters: T;
  onFiltersChange: (filters: Partial<T>) => void;
  onClear: () => void;
  showSearch?: boolean;
}

/**
 * Props for DeepLinkPanel component.
 */
export interface DeepLinkPanelProps {
  entityType: CrossRefEntityType;
  entityId: string;
  executionId: string;
  onNavigate?: (path: string) => void;
}

/**
 * Props for Timeline component.
 */
export interface TimelineProps {
  executionId: string;
  showToolDensity?: boolean;
  showEventMarkers?: boolean;
  zoomLevel?: number;
  onTaskClick?: (taskId: string) => void;
  onEventClick?: (entryId: string) => void;
}

// =============================================================================
// STATUS CONFIGURATION
// =============================================================================

/**
 * Status type for styling.
 */
export type StatusType =
  | "success"
  | "error"
  | "blocked"
  | "skipped"
  | "warning"
  | "in-progress"
  | "pending";

/**
 * Status configuration for styling.
 */
export interface StatusConfig {
  color: string;
  bg: string;
  label: string;
  borderColor?: string;
}

/**
 * Status configuration map.
 */
export const statusConfig: Record<StatusType, StatusConfig> = {
  success: { color: "text-green-600", bg: "bg-green-100", label: "Success" },
  error: { color: "text-red-600", bg: "bg-red-100", label: "Error" },
  blocked: { color: "text-orange-600", bg: "bg-orange-100", label: "Blocked" },
  skipped: { color: "text-gray-500", bg: "bg-gray-100", label: "Skipped" },
  warning: { color: "text-yellow-600", bg: "bg-yellow-100", label: "Warning" },
  "in-progress": {
    color: "text-blue-600",
    bg: "bg-blue-100",
    label: "In Progress",
  },
  pending: { color: "text-gray-400", bg: "bg-gray-50", label: "Pending" },
};

/**
 * Severity configuration for styling.
 */
export const severityConfig: Record<
  MessageBusSeverity,
  { color: string; bg: string; borderColor: string }
> = {
  info: {
    color: "text-blue-600",
    bg: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  warning: {
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  error: {
    color: "text-red-600",
    bg: "bg-red-50",
    borderColor: "border-red-200",
  },
  critical: {
    color: "text-red-800",
    bg: "bg-red-100",
    borderColor: "border-red-400",
  },
};

/**
 * Tool category configuration for styling.
 */
export const toolCategoryConfig: Record<
  ToolCategory,
  { color: string; icon: string }
> = {
  file_read: { color: "text-blue-500", icon: "ReadFile" },
  file_write: { color: "text-green-500", icon: "WriteFile" },
  file_edit: { color: "text-yellow-500", icon: "EditFile" },
  search: { color: "text-purple-500", icon: "Search" },
  shell: { color: "text-gray-600", icon: "Terminal" },
  agent: { color: "text-indigo-500", icon: "Robot" },
  web: { color: "text-cyan-500", icon: "Globe" },
  mcp: { color: "text-pink-500", icon: "Browser" },
};

/**
 * Execution status configuration for styling.
 */
export const executionStatusConfig: Record<
  ExecutionRun["status"],
  StatusConfig
> = {
  pending: { color: "text-gray-500", bg: "bg-gray-100", label: "Pending" },
  running: { color: "text-blue-600", bg: "bg-blue-100", label: "Running" },
  completed: {
    color: "text-green-600",
    bg: "bg-green-100",
    label: "Completed",
  },
  failed: { color: "text-red-600", bg: "bg-red-100", label: "Failed" },
  cancelled: {
    color: "text-orange-600",
    bg: "bg-orange-100",
    label: "Cancelled",
  },
};
