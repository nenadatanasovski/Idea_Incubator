// =============================================================================
// FILE: frontend/src/types/ideation-state.ts
// State management types for Ideation Agent
// =============================================================================

import type { IdeaCandidate, ViabilityRisk } from "./index";
import type {
  TokenUsageInfo,
  EntryMode,
  IdeationMessage,
  Artifact,
  SubAgent,
  SubAgentType,
  SubAgentStatus,
} from "./ideation";
import type {
  Spec,
  SpecSection,
  SpecWorkflowState,
  ReadinessScore,
} from "./spec";

// Re-export for convenience
export type {
  TokenUsageInfo,
  EntryMode,
  IdeationMessage,
  Artifact,
  SubAgent,
  SubAgentType,
  SubAgentStatus,
};

// -----------------------------------------------------------------------------
// Classification Types
// -----------------------------------------------------------------------------

export type Classification = "required" | "recommended" | "optional";

export interface ClassificationInfo {
  classification: Classification;
  isComplete: boolean;
}

// -----------------------------------------------------------------------------
// Memory Graph State (for Update Memory Graph button)
// -----------------------------------------------------------------------------

export interface ProposedChange {
  id: string;
  type: "create_block" | "update_block" | "create_link";
  blockType?: string;
  title?: string; // Short 3-5 word summary for the node
  content?: string; // Optional for create_link types which don't have content
  graphMembership?: string[];
  confidence: number;
  sourceMessageId?: string; // Legacy field
  // Link-specific fields (for create_link type)
  sourceBlockId?: string;
  targetBlockId?: string;
  linkType?: string;
  reason?: string; // Explanation of why these blocks are connected
  // Source attribution for traceability - CRITICAL for tracking where insights came from
  sourceId?: string; // ID of the source (message ID, artifact ID, etc.)
  sourceType?: string; // e.g., "conversation_insight", "artifact", "memory_file"
  sourceWeight?: number; // Reliability weight 0-1
  corroboratedBy?: Array<{
    sourceId: string;
    sourceType: string;
    snippet?: string;
  }>;
  // All sources that contributed to this insight (with original content)
  allSources?: Array<{
    id: string;
    type: string;
    title: string | null;
    weight: number | null;
    contentSnippet: string | null;
  }>;
  // Supersession handling
  supersedesBlockId?: string; // If this block supersedes an existing block
  supersessionReason?: string; // Reason for superseding
  // For update_block status changes
  blockId?: string; // Target block for updates
  statusChange?: {
    blockId?: string;
    newStatus: "superseded" | "abandoned";
    reason?: string;
  };
}

export interface CascadeEffect {
  id: string;
  affectedBlockId: string;
  affectedBlockContent: string;
  effectType: "confidence_change" | "status_change" | "link_invalidation";
  description: string;
  severity: "low" | "medium" | "high";
}

export interface GraphNode {
  id: string;
  type: string;
  content: string;
  isNew?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  linkType: string;
  isNew?: boolean;
}

// Source info for lineage tracking - passed from analysis to apply-changes
export interface SourceLineageInfo {
  id: string;
  type:
    | "conversation"
    | "conversation_insight"
    | "artifact"
    | "memory_file"
    | "user_block"
    | "external";
  title: string | null;
  artifactType?: string | null;
  memoryFileType?: string | null;
  weight?: number | null;
  // Content snippet for display - truncated to 500 chars
  contentSnippet?: string | null;
}

export interface GraphUpdateAnalysis {
  context: {
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
  };
  proposedChanges: ProposedChange[];
  cascadeEffects: CascadeEffect[];
  previewNodes: GraphNode[];
  previewEdges: GraphEdge[];
  // Sources used in the analysis - for lineage tracking
  sources?: SourceLineageInfo[];
}

export interface GraphSnapshotSummary {
  id: string;
  sessionId: string;
  name: string;
  description: string | null;
  blockCount: number;
  linkCount: number;
  createdAt: string;
}

export interface MemoryGraphState {
  pendingChangesCount: number;
  isAnalyzing: boolean;
  isModalOpen: boolean;
  analysis: GraphUpdateAnalysis | null;
  selectedChangeIds: string[];
  isApplying: boolean;
  error: string | null;
  // Timestamp tracking for incremental analysis
  lastAnalyzedAt: string | null;
  // Applied insights - persisted after changes are applied to the graph
  appliedInsights: ProposedChange[];
  // Snapshot/versioning state
  snapshots: GraphSnapshotSummary[];
  isLoadingSnapshots: boolean;
  isSavingSnapshot: boolean;
  isRestoringSnapshot: boolean;
  snapshotError: string | null;
}

// -----------------------------------------------------------------------------
// Session State
// -----------------------------------------------------------------------------

export interface IdeationSessionState {
  sessionId: string | null;
  profileId: string;
  status: "idle" | "loading" | "active" | "completed" | "abandoned" | "error";
  entryMode: EntryMode;
  error: string | null;
  title: string | null;
}

export interface ConversationState {
  messages: IdeationMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  followUpPending: boolean; // True when async follow-up question is being generated
}

export interface CandidateState {
  candidate: IdeaCandidate | null;
  risks: ViabilityRisk[];
  showIntervention: boolean;
  interventionType: "warning" | "critical" | null;
}

export interface TokenState {
  usage: TokenUsageInfo;
  handoffPending: boolean;
  handoffCount: number;
}

export interface ArtifactState {
  artifacts: Artifact[];
  currentArtifact: Artifact | null;
  isLoading: boolean;
  isPanelOpen: boolean;
  // UI state for unified file system
  linkedIdea: { userSlug: string; ideaSlug: string } | null;
  viewMode: "files" | "sessions";
  selectedArtifactPath: string | null;
  artifactClassifications: Record<string, ClassificationInfo>;
}

export interface SubAgentsState {
  subAgents: SubAgent[];
  activeCount: number;
  triggerMessageId: string | null; // The message that triggered the sub-agents
}

// -----------------------------------------------------------------------------
// Spec State
// -----------------------------------------------------------------------------

export interface SpecState {
  spec: Spec | null;
  sections: SpecSection[];
  readiness: ReadinessScore | null;
  isGenerating: boolean;
  isEditing: boolean;
  isSaving: boolean;
  error: string | null;
}

// -----------------------------------------------------------------------------
// Combined Store State
// -----------------------------------------------------------------------------

export interface IdeationStore {
  session: IdeationSessionState;
  conversation: ConversationState;
  candidate: CandidateState;
  tokens: TokenState;
  artifacts: ArtifactState;
  subAgents: SubAgentsState;
  spec: SpecState;
  memoryGraph: MemoryGraphState;
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

export type IdeationAction =
  | {
      type: "SESSION_START";
      payload: { profileId: string; entryMode: EntryMode };
    }
  | {
      type: "SESSION_CREATED";
      payload: { sessionId: string; greeting: string };
    }
  | { type: "SESSION_ERROR"; payload: { error: string } }
  | { type: "SESSION_COMPLETE"; payload: { ideaId: string } }
  | { type: "SESSION_ABANDON" }
  | { type: "SESSION_TITLE_UPDATE"; payload: { title: string } }
  | { type: "MESSAGE_SEND"; payload: { content: string } }
  | { type: "MESSAGE_STREAM_START" }
  | { type: "MESSAGE_STREAM_CHUNK"; payload: { chunk: string } }
  | { type: "MESSAGE_STREAM_END"; payload: { message: IdeationMessage } }
  | { type: "MESSAGE_RECEIVED"; payload: { message: IdeationMessage } }
  | { type: "MESSAGE_ERROR"; payload: { error: string } }
  | { type: "FOLLOWUP_PENDING_START" } // Async follow-up question being generated
  | { type: "FOLLOWUP_PENDING_END" } // Follow-up generation complete (success or failure)
  | { type: "BUTTON_CLICK"; payload: { buttonId: string; buttonValue: string } }
  | {
      type: "FORM_SUBMIT";
      payload: { formId: string; answers: Record<string, unknown> };
    }
  | { type: "CANDIDATE_UPDATE"; payload: { candidate: IdeaCandidate } }
  | { type: "CANDIDATE_CLEAR" }
  | { type: "CONFIDENCE_UPDATE"; payload: { confidence: number } }
  | {
      type: "VIABILITY_UPDATE";
      payload: { viability: number; risks: ViabilityRisk[] };
    }
  | { type: "INTERVENTION_SHOW"; payload: { type: "warning" | "critical" } }
  | { type: "INTERVENTION_DISMISS" }
  | { type: "TOKEN_UPDATE"; payload: { usage: TokenUsageInfo } }
  | { type: "HANDOFF_PENDING" }
  | { type: "HANDOFF_COMPLETE" }
  | { type: "MESSAGES_TRUNCATE"; payload: { messageId: string } }
  | { type: "MESSAGE_UPDATE_ID"; payload: { oldId: string; newId: string } }
  | {
      type: "MESSAGE_CONTENT_UPDATE";
      payload: { messageId: string; content: string };
    }
  // Artifact actions
  | { type: "ARTIFACT_ADD"; payload: { artifact: Artifact } }
  | {
      type: "ARTIFACT_UPDATE";
      payload: { id: string; updates: Partial<Artifact> };
    }
  | { type: "ARTIFACT_REMOVE"; payload: { id: string } }
  | { type: "ARTIFACT_SELECT"; payload: { artifact: Artifact | null } }
  | { type: "ARTIFACT_LOADING_START"; payload: { id: string } }
  | { type: "ARTIFACT_LOADING_END"; payload: { id: string; error?: string } }
  | { type: "ARTIFACT_PANEL_TOGGLE"; payload: { isOpen: boolean } }
  | { type: "ARTIFACTS_CLEAR" }
  // Unified file system actions
  | {
      type: "SET_LINKED_IDEA";
      payload: { userSlug: string; ideaSlug: string } | null;
    }
  | { type: "SET_VIEW_MODE"; payload: { viewMode: "files" | "sessions" } }
  | { type: "SET_SELECTED_ARTIFACT"; payload: { path: string | null } }
  | {
      type: "SET_ARTIFACT_CLASSIFICATIONS";
      payload: { classifications: Record<string, ClassificationInfo> };
    }
  // Sub-agent actions
  | {
      type: "SUBAGENT_SPAWN";
      payload: {
        id: string;
        type: SubAgentType;
        name: string;
        triggerMessageId?: string;
      };
    }
  | {
      type: "SUBAGENT_STATUS";
      payload: { id: string; status: SubAgentStatus; error?: string };
    }
  | { type: "SUBAGENT_RESULT"; payload: { id: string; result: unknown } }
  | { type: "SUBAGENT_CLEAR" }
  // Spec actions
  | { type: "SPEC_READINESS_UPDATE"; payload: { readiness: ReadinessScore } }
  | { type: "SPEC_GENERATE_START" }
  | {
      type: "SPEC_GENERATE_COMPLETE";
      payload: { spec: Spec; sections: SpecSection[] };
    }
  | { type: "SPEC_GENERATE_ERROR"; payload: { error: string } }
  | { type: "SPEC_LOAD"; payload: { spec: Spec; sections: SpecSection[] } }
  | { type: "SPEC_UPDATE"; payload: { updates: Partial<Spec> } }
  | {
      type: "SPEC_SECTION_UPDATE";
      payload: { sectionId: string; content: string };
    }
  | { type: "SPEC_EDIT_START" }
  | { type: "SPEC_EDIT_CANCEL" }
  | { type: "SPEC_SAVE_START" }
  | { type: "SPEC_SAVE_COMPLETE"; payload: { spec: Spec } }
  | { type: "SPEC_SAVE_ERROR"; payload: { error: string } }
  | {
      type: "SPEC_WORKFLOW_TRANSITION";
      payload: { newState: SpecWorkflowState };
    }
  | { type: "SPEC_CLEAR" }
  // Memory Graph actions
  | { type: "MEMORY_GRAPH_ANALYSIS_START" }
  | {
      type: "MEMORY_GRAPH_ANALYSIS_COMPLETE";
      payload: { analysis: GraphUpdateAnalysis };
    }
  | { type: "MEMORY_GRAPH_ANALYSIS_ERROR"; payload: { error: string } }
  | { type: "MEMORY_GRAPH_MODAL_OPEN" }
  | { type: "MEMORY_GRAPH_MODAL_CLOSE" }
  | {
      type: "MEMORY_GRAPH_CHANGES_SELECT";
      payload: { changeIds: string[] };
    }
  | { type: "MEMORY_GRAPH_APPLY_START" }
  | { type: "MEMORY_GRAPH_APPLY_COMPLETE" }
  | { type: "MEMORY_GRAPH_APPLY_ERROR"; payload: { error: string } }
  | {
      type: "MEMORY_GRAPH_PENDING_COUNT_UPDATE";
      payload: { count: number };
    }
  // Proposed change management actions (for insights panel)
  | {
      type: "MEMORY_GRAPH_CHANGE_DELETE";
      payload: { changeId: string };
    }
  | {
      type: "MEMORY_GRAPH_CHANGE_EDIT";
      payload: { changeId: string; updates: Partial<ProposedChange> };
    }
  | {
      type: "MEMORY_GRAPH_LAST_ANALYZED_UPDATE";
      payload: { timestamp: string };
    }
  // Real-time insight addition (via WebSocket)
  | {
      type: "MEMORY_GRAPH_INSIGHT_ADD";
      payload: { insight: ProposedChange };
    }
  // Load applied insights from backend (session resume)
  | {
      type: "MEMORY_GRAPH_INSIGHTS_LOAD";
      payload: { insights: ProposedChange[] };
    }
  // Graph Snapshot actions
  | { type: "GRAPH_SNAPSHOTS_LOAD_START" }
  | {
      type: "GRAPH_SNAPSHOTS_LOAD_COMPLETE";
      payload: { snapshots: GraphSnapshotSummary[] };
    }
  | { type: "GRAPH_SNAPSHOTS_LOAD_ERROR"; payload: { error: string } }
  | { type: "GRAPH_SNAPSHOT_SAVE_START" }
  | {
      type: "GRAPH_SNAPSHOT_SAVE_COMPLETE";
      payload: { snapshot: GraphSnapshotSummary };
    }
  | { type: "GRAPH_SNAPSHOT_SAVE_ERROR"; payload: { error: string } }
  | { type: "GRAPH_SNAPSHOT_RESTORE_START" }
  | { type: "GRAPH_SNAPSHOT_RESTORE_COMPLETE" }
  | { type: "GRAPH_SNAPSHOT_RESTORE_ERROR"; payload: { error: string } }
  | { type: "GRAPH_SNAPSHOT_DELETE"; payload: { snapshotId: string } };
