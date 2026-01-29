// ============================================================================
// CORE TYPES
// ============================================================================

export type SessionStatus = "active" | "completed" | "abandoned";
export type SessionPhase =
  | "exploring"
  | "narrowing"
  | "validating"
  | "refining";
export type EntryMode = "have_idea" | "discover";
export type CandidateStatus =
  | "forming"
  | "active"
  | "captured"
  | "discarded"
  | "saved";
export type RiskType =
  | "impossible"
  | "unrealistic"
  | "too_complex"
  | "too_vague"
  | "saturated_market"
  | "wrong_timing"
  | "resource_mismatch";
export type RiskSeverity = "critical" | "high" | "medium" | "low";
export type MessageRole = "user" | "assistant" | "system";
export type SignalType =
  | "self_discovery"
  | "market_discovery"
  | "narrowing"
  | "confidence"
  | "viability";
export type ButtonStyle = "primary" | "secondary" | "outline" | "danger";
export type MemoryFileType =
  | "self_discovery"
  | "market_discovery"
  | "narrowing_state"
  | "conversation_summary"
  | "idea_candidate"
  | "viability_assessment"
  | "handoff_notes";

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface IdeationSession {
  id: string;
  profileId: string;
  entryMode: EntryMode;
  status: SessionStatus;
  startedAt: Date;
  completedAt: Date | null;
  lastActivityAt: Date;
  handoffCount: number;
  tokenCount: number;
  messageCount: number;
  currentPhase: SessionPhase;
  // Session title (editable, auto-populated by AI)
  title: string | null;
  // Linked idea info (optional)
  userSlug: string | null;
  ideaSlug: string | null;
}

export interface IdeationSessionRow {
  id: string;
  profile_id: string;
  entry_mode: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
  handoff_count: number;
  token_count: number;
  message_count: number;
  current_phase: string;
  title: string | null;
  [key: string]: unknown;
}

export interface IdeationMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  buttonsShown: ButtonOption[] | null;
  buttonClicked: string | null;
  formShown: FormDefinition | null;
  formResponse: Record<string, unknown> | null;
  webSearchResults: WebSearchResult[] | null;
  tokenCount: number;
  createdAt: Date;
}

export interface IdeationMessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  buttons_shown: string | null;
  button_clicked: string | null;
  form_shown: string | null;
  form_response: string | null;
  web_search_results: string | null;
  token_count: number;
  created_at: string;
  [key: string]: unknown;
}

// ============================================================================
// CANDIDATE & RISK TYPES
// ============================================================================

export interface IdeaCandidate {
  id: string;
  sessionId: string;
  title: string;
  summary: string | null;
  confidence: number; // 0-100
  viability: number; // 0-100
  userSuggested: boolean;
  status: CandidateStatus;
  capturedIdeaId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdeaCandidateRow {
  id: string;
  session_id: string;
  title: string;
  summary: string | null;
  confidence: number;
  viability: number;
  user_suggested: number; // SQLite boolean
  status: string;
  captured_idea_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ViabilityRisk {
  id: string;
  candidateId: string;
  riskType: RiskType;
  description: string;
  evidenceUrl: string | null;
  evidenceText: string | null;
  severity: RiskSeverity;
  userAcknowledged: boolean;
  userResponse: string | null;
  createdAt: Date;
}

export interface ViabilityRiskRow {
  id: string;
  candidate_id: string;
  risk_type: string;
  description: string;
  evidence_url: string | null;
  evidence_text: string | null;
  severity: string;
  user_acknowledged: number;
  user_response: string | null;
  created_at: string;
  [key: string]: unknown;
}

// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export interface ButtonOption {
  id: string;
  label: string;
  value: string;
  style: ButtonStyle;
  fullWidth?: boolean;
  icon?: string;
  disabled?: boolean;
}

export interface FormField {
  id: string;
  type:
    | "text"
    | "textarea"
    | "radio"
    | "checkbox"
    | "slider"
    | "dropdown"
    | "date";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: FormFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: unknown;
}

export interface FormFieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface FormDefinition {
  id: string;
  title?: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  [key: string]: unknown;
}

// ============================================================================
// MEMORY FILE TYPES
// ============================================================================

export interface MemoryFile {
  id: string;
  sessionId: string;
  fileType: MemoryFileType;
  content: string; // Markdown
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryFileRow {
  id: string;
  session_id: string;
  file_type: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ============================================================================
// STATE TYPES
// ============================================================================

export interface SelfDiscoveryState {
  impactVision: {
    level: "world" | "country" | "city" | "community" | null;
    description: string | null;
    confidence: number;
  };
  frustrations: Array<{
    description: string;
    source: string;
    severity: "high" | "medium" | "low";
  }>;
  expertise: Array<{
    area: string;
    depth: "expert" | "competent" | "novice";
    evidence: string;
  }>;
  interests: Array<{
    topic: string;
    genuine: boolean;
    evidence: string;
  }>;
  skills: {
    identified: Array<{ skill: string; level: string; testedVia: string }>;
    gaps: string[];
    strengths: string[];
  };
  constraints: {
    location: { fixed: boolean; target: string | null };
    timeHoursPerWeek: number | null;
    capital: "bootstrap" | "seeking_funding" | "have_funding" | null;
    riskTolerance: "low" | "medium" | "high" | null;
  };
  [key: string]: unknown;
}

export interface MarketDiscoveryState {
  competitors: Array<{
    name: string;
    description: string;
    strengths: string[];
    weaknesses: string[];
    source: string;
  }>;
  gaps: Array<{
    description: string;
    evidence: string;
    relevance: "high" | "medium" | "low";
  }>;
  timingSignals: Array<{
    signal: string;
    source: string;
    implication: string;
  }>;
  failedAttempts: Array<{
    what: string;
    why: string;
    lesson: string;
    source: string;
  }>;
  locationContext: {
    city: string | null;
    jobMarketTrends: string | null;
    localOpportunities: string[];
    marketPresence: string | null;
  };
  [key: string]: unknown;
}

export interface NarrowingState {
  productType: { value: string | null; confidence: number };
  customerType: { value: string | null; confidence: number };
  geography: { value: string | null; confidence: number };
  scale: { value: string | null; confidence: number };
  technicalDepth: { value: string | null; confidence: number };
  hypotheses: Array<{
    description: string;
    supporting: string[];
    contradicting: string[];
  }>;
  questionsNeeded: Array<{
    question: string;
    purpose: string;
  }>;
  [key: string]: unknown;
}

// ============================================================================
// WEB SEARCH TYPES
// ============================================================================

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}

export interface WebSearchCache {
  id: string;
  sessionId: string;
  query: string;
  results: WebSearchResult[];
  resultCount: number;
  purpose: string | null;
  searchedAt: Date;
}

// ============================================================================
// SIGNAL TYPES
// ============================================================================

export interface ExtractedSignal {
  type: SignalType;
  key: string;
  value: string;
  confidence: number; // 0.0-1.0
  source: "user_message" | "agent_inference" | "web_search";
  messageId?: string;
}

export interface SignalRow {
  id: string;
  session_id: string;
  message_id: string | null;
  signal_type: string;
  signal_key: string;
  signal_value: string;
  confidence: number;
  created_at: string;
  [key: string]: unknown;
}

// ============================================================================
// IDEA TYPE SELECTION TYPES
// ============================================================================

/**
 * Supported idea types for classification in the unified file system.
 */
export type IdeaTypeSelection =
  | "business"
  | "feature_internal"
  | "feature_external"
  | "service"
  | "pivot";

/**
 * Parent type for feature and pivot ideas.
 */
export type ParentType = "internal" | "external";

/**
 * State for tracking idea type selection during session.
 * This is persisted in session memory to track the classification flow.
 */
export interface IdeaTypeSelectionState {
  /** Whether the idea type has been selected */
  ideaTypeSelected: boolean;
  /** The selected idea type */
  ideaType: IdeaTypeSelection | null;
  /** Whether parent selection is needed (for feature_internal, feature_external, pivot) */
  parentSelectionNeeded: boolean;
  /** Whether parent has been selected */
  parentSelected: boolean;
  /** Parent type (internal = existing idea, external = platform name) */
  parentType: ParentType | null;
  /** Parent slug (for internal parents - existing idea slug) */
  parentSlug: string | null;
  /** Parent name (for external parents - platform name) */
  parentName: string | null;
}
