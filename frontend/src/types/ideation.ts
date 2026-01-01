// =============================================================================
// FILE: frontend/src/types/ideation.ts
// Frontend-specific types for Ideation Agent UI
// =============================================================================

import type {
  IdeaCandidate,
  ViabilityRisk,
  ButtonOption,
  FormDefinition,
  WebSearchResult,
} from './index';

// Re-export base types
export type { IdeaCandidate, ViabilityRisk, ButtonOption, FormDefinition, WebSearchResult };

// -----------------------------------------------------------------------------
// Page Level
// -----------------------------------------------------------------------------

export interface IdeationPageProps {
  profileId: string;
  onComplete: (ideaId: string) => void;
  onExit: () => void;
}

export type EntryMode = 'have_idea' | 'discover' | null;

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

export interface SessionHeaderProps {
  sessionId: string;
  tokenUsage: TokenUsageInfo;
  onAbandon: () => void;
  onMinimize: () => void;
}

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
  role: 'user' | 'assistant';
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
  error?: string | null;
  onSendMessage: (message: string) => void;
  onButtonClick: (buttonId: string, buttonValue: string, buttonLabel: string) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
  onRetry?: () => void;
}

export interface MessageListProps {
  messages: IdeationMessage[];
  onButtonClick: (buttonId: string, buttonValue: string, buttonLabel: string) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
  isLoading: boolean;
}

export interface AgentMessageProps {
  message: IdeationMessage;
  onButtonClick: (buttonId: string, buttonValue: string, buttonLabel: string) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
  isLatest: boolean;
}

export interface UserMessageProps {
  message: IdeationMessage;
}

export interface MessageTextProps {
  content: string;
  isStreaming?: boolean;
}

export interface TypingIndicatorProps {
  isVisible: boolean;
}

// -----------------------------------------------------------------------------
// Interactive Elements
// -----------------------------------------------------------------------------

export interface ButtonGroupProps {
  buttons: ButtonOption[];
  onSelect: (buttonId: string, buttonValue: string, buttonLabel: string) => void;
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
  type: 'text' | 'radio' | 'checkbox' | 'slider' | 'select' | 'textarea' | 'dropdown' | 'date';
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
// Input Area
// -----------------------------------------------------------------------------

export interface InputAreaProps {
  onSend: (message: string) => void;
  disabled: boolean;
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
  value: number;  // 0-100
  showLabel: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export interface ViabilityMeterProps {
  value: number;  // 0-100
  risks: ViabilityRisk[];
  showWarning: boolean;
  size?: 'sm' | 'md' | 'lg';
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
