// =============================================================================
// FILE: frontend/src/types/ideation.ts
// Frontend-specific types for Ideation Agent UI
// =============================================================================

import type React from "react";
import type {
  IdeaCandidate,
  ViabilityRisk,
  ButtonOption,
  FormDefinition,
  WebSearchResult,
} from "./index";

// Re-export base types
export type {
  IdeaCandidate,
  ViabilityRisk,
  ButtonOption,
  FormDefinition,
  WebSearchResult,
};

// -----------------------------------------------------------------------------
// Page Level
// -----------------------------------------------------------------------------

export interface IdeationPageProps {
  profileId: string;
  onComplete: (ideaId: string) => void;
  onExit: () => void;
}

export type EntryMode = "have_idea" | "discover" | null;

export interface IdeationEntryModalProps {
  isOpen: boolean;
  onSelect: (mode: EntryMode) => void;
  onClose: () => void;
}

export interface EntryOptionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  mode: EntryMode;
  onSelect: (mode: EntryMode) => void;
}

// -----------------------------------------------------------------------------
// Session Level
// -----------------------------------------------------------------------------

export interface IdeationSessionProps {
  sessionId: string;
  profileId: string;
  entryMode: EntryMode;
  isResuming?: boolean;
  onComplete: (ideaId: string) => void;
  onExit: () => void;
}

// SessionHeaderProps is now defined in SessionHeader.tsx with extended props

export interface TokenUsageInfo {
  total: number;
  limit: number;
  percentUsed: number;
  shouldHandoff: boolean;
}

export interface TokenUsageIndicatorProps {
  usage: TokenUsageInfo;
}

// -----------------------------------------------------------------------------
// Message Types for Frontend
// -----------------------------------------------------------------------------

export interface IdeationMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  buttons: ButtonOption[] | null;
  form: FormDefinition | null;
  buttonClicked?: string;
  webSearchResults?: WebSearchResult[];
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Conversation Panel
// -----------------------------------------------------------------------------

export interface ConversationPanelProps {
  messages: IdeationMessage[];
  isLoading: boolean;
  streamingContent?: string;
  error?: string | null;
  subAgents?: SubAgent[];
  onSendMessage: (message: string) => void;
  onStopGeneration?: () => void;
  onButtonClick: (
    buttonId: string,
    buttonValue: string,
    buttonLabel: string,
  ) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onArtifactClick?: (artifactId: string) => void;
  onConvertToArtifact?: (content: string, title?: string) => void;
  onRetry?: () => void;
}

export interface MessageListProps {
  messages: IdeationMessage[];
  onButtonClick: (
    buttonId: string,
    buttonValue: string,
    buttonLabel: string,
  ) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onArtifactClick?: (artifactId: string) => void;
  onConvertToArtifact?: (content: string, title?: string) => void;
  isLoading: boolean;
}

export interface AgentMessageProps {
  message: IdeationMessage;
  onButtonClick: (
    buttonId: string,
    buttonValue: string,
    buttonLabel: string,
  ) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
  isLatest: boolean;
  onArtifactClick?: (artifactId: string) => void;
  onConvertToArtifact?: (content: string, title?: string) => void;
}

export interface UserMessageProps {
  message: IdeationMessage;
  onEdit?: (messageId: string, newContent: string) => void;
  isEditable?: boolean;
  onConvertToArtifact?: (content: string, title?: string) => void;
}

export interface MessageTextProps {
  content: string;
  isStreaming?: boolean;
  onArtifactClick?: (artifactId: string) => void;
}

export interface TypingIndicatorProps {
  isVisible: boolean;
  streamingContent?: string;
}

// -----------------------------------------------------------------------------
// Sub-Agents
// -----------------------------------------------------------------------------

export type SubAgentStatus = "spawning" | "running" | "completed" | "failed";

export type SubAgentType =
  | "research" // Web research agent
  | "evaluator" // Idea evaluation agent
  | "redteam" // Red team challenge agent
  | "development" // Idea development agent
  | "synthesis" // Synthesis agent
  | "custom"; // Custom/fallback type for race condition handling

export interface SubAgent {
  id: string;
  type: SubAgentType;
  name: string;
  status: SubAgentStatus;
  startedAt: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export interface SubAgentIndicatorProps {
  agents: SubAgent[];
}

export interface SubAgentsPanelProps {
  subAgents: SubAgent[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// -----------------------------------------------------------------------------
// Interactive Elements
// -----------------------------------------------------------------------------

export interface ButtonGroupProps {
  buttons: ButtonOption[];
  onSelect: (
    buttonId: string,
    buttonValue: string,
    buttonLabel: string,
  ) => void;
  disabled: boolean;
  selectedId?: string;
}

export interface FormRendererProps {
  form: FormDefinition;
  onSubmit: (answers: Record<string, unknown>) => void;
  onCancel: () => void;
  disabled: boolean;
}

export interface FormFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}

export interface FormField {
  id?: string;
  name: string;
  type:
    | "text"
    | "radio"
    | "checkbox"
    | "slider"
    | "select"
    | "textarea"
    | "dropdown"
    | "date";
  label: string;
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
}

export interface SourceCitationsProps {
  sources: WebSearchResult[];
}

// -----------------------------------------------------------------------------
// Artifacts
// -----------------------------------------------------------------------------

export type ArtifactType =
  | "code"
  | "html"
  | "svg"
  | "mermaid"
  | "react"
  | "text"
  | "markdown"
  | "research"
  | "idea-summary"
  | "analysis"
  | "comparison";

export type ArtifactStatus =
  | "pending"
  | "loading"
  | "ready"
  | "error"
  | "updating";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string | object; // string for code/text, object for structured data
  language?: string; // For code artifacts
  status: ArtifactStatus;
  error?: string;
  createdAt: string;
  updatedAt?: string;
  // For research artifacts
  queries?: string[];
  // For referenceability
  identifier?: string; // Auto-generated name for agent reference
}

export interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  query: string;
}

// Synthesized research content structure
export interface SynthesizedResearch {
  synthesis: string; // The full markdown synthesis from Claude
  sources: ResearchResult[];
  queries: string[];
}

export interface ArtifactPanelProps {
  artifacts: Artifact[];
  currentArtifact: Artifact | null;
  onSelectArtifact: (artifact: Artifact) => void;
  onCloseArtifact: () => void;
  onExpandArtifact: () => void;
  onDeleteArtifact?: (artifactId: string) => void;
  onEditArtifact?: (artifactId: string, content: string) => Promise<void>;
  onRenameArtifact?: (artifactId: string, newTitle: string) => Promise<void>;
  isLoading?: boolean;
  isMinimized?: boolean;
}

export interface ArtifactTabsProps {
  artifacts: Artifact[];
  currentArtifactId: string | null;
  onSelect: (id: string) => void;
}

export interface ArtifactRendererProps {
  artifact: Artifact;
  isFullscreen?: boolean;
}

export interface CodeArtifactProps {
  content: string;
  language?: string;
}

export interface ResearchArtifactProps {
  results: ResearchResult[];
  queries: string[];
}

export interface MermaidArtifactProps {
  content: string;
}

export interface MarkdownArtifactProps {
  content: string;
}

// -----------------------------------------------------------------------------
// Input Area
// -----------------------------------------------------------------------------

export interface InputAreaProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled: boolean;
  isLoading?: boolean;
  placeholder?: string;
}

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder?: string;
}

export interface SendButtonProps {
  onClick: () => void;
  disabled: boolean;
}

// -----------------------------------------------------------------------------
// Idea Candidate Panel
// -----------------------------------------------------------------------------

export interface IdeaCandidatePanelProps {
  candidate: IdeaCandidate | null;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  onCapture: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onContinue: () => void;
  showIntervention: boolean;
}

export interface EmptyStateProps {
  message?: string;
}

export interface FormingStateProps {
  confidence: number;
  threshold: number;
}

export interface ActiveStateProps {
  candidate: IdeaCandidate;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  onCapture: () => void;
  onSave: () => void;
}

export interface WarningStateProps {
  candidate: IdeaCandidate;
  viability: number;
  risks: ViabilityRisk[];
  onAddressRisks: () => void;
  onPivot: () => void;
  onContinueAnyway: () => void;
  onDiscard: () => void;
}

// -----------------------------------------------------------------------------
// Meters
// -----------------------------------------------------------------------------

export interface ConfidenceMeterProps {
  value: number; // 0-100
  showLabel: boolean;
  size?: "sm" | "md" | "lg";
}

export interface ViabilityMeterProps {
  value: number; // 0-100
  risks: ViabilityRisk[];
  showWarning: boolean;
  size?: "sm" | "md" | "lg";
}

export interface RisksListProps {
  risks: ViabilityRisk[];
  maxDisplay?: number;
  onViewAll?: () => void;
}

export interface RiskItemProps {
  risk: ViabilityRisk;
}

// -----------------------------------------------------------------------------
// Action Buttons
// -----------------------------------------------------------------------------

export interface CandidateActionButtonsProps {
  onCapture: () => void;
  onSave: () => void;
  captureEnabled: boolean;
  saveEnabled: boolean;
}

export interface InterventionOptionsProps {
  onAddressRisks: () => void;
  onPivot: () => void;
  onContinueAnyway: () => void;
  onDiscard: () => void;
}
