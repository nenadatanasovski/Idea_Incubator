import type {
  IdeaWithScores,
  Evaluation,
  CategoryScore,
  DebateRound,
  RedTeamChallenge,
  Synthesis,
  IdeaFilters,
  DevelopmentEntry,
  IdeaRelationship,
  CostEntry,
  ApiResponse,
  UserProfileSummary,
  Question,
  Answer,
  ReadinessScore,
  CriterionCoverage,
  DevelopmentSession,
  QuestionsResponse,
  AnswerSubmitResponse,
} from "../types";

const API_BASE = "/api";

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  const data: ApiResponse<T> = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Unknown error");
  }
  return data.data;
}

// Ideas
export async function getIdeas(
  filters?: IdeaFilters,
): Promise<IdeaWithScores[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.stage) params.set("stage", filters.stage);
  if (filters?.tag) params.set("tag", filters.tag);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.sortBy) params.set("sortBy", filters.sortBy);
  if (filters?.sortOrder) params.set("sortOrder", filters.sortOrder);

  const query = params.toString();
  return fetchApi<IdeaWithScores[]>(`/ideas${query ? `?${query}` : ""}`);
}

export async function getIdea(slug: string): Promise<IdeaWithScores> {
  return fetchApi<IdeaWithScores>(`/ideas/${slug}`);
}

// Evaluations
export async function getEvaluations(
  slug: string,
  runId?: string,
): Promise<Evaluation[]> {
  const query = runId ? `?runId=${runId}` : "";
  return fetchApi<Evaluation[]>(`/ideas/${slug}/evaluations${query}`);
}

export async function getCategoryScores(
  slug: string,
  runId?: string,
): Promise<CategoryScore[]> {
  const query = runId ? `?runId=${runId}` : "";
  return fetchApi<CategoryScore[]>(`/ideas/${slug}/category-scores${query}`);
}

export async function getEvaluationRuns(slug: string): Promise<string[]> {
  return fetchApi<string[]>(`/ideas/${slug}/evaluation-runs`);
}

// Debates
export async function getDebateRounds(
  slug: string,
  runId?: string,
): Promise<DebateRound[]> {
  const query = runId ? `?runId=${runId}` : "";
  return fetchApi<DebateRound[]>(`/ideas/${slug}/debates${query}`);
}

// Debate Sessions
export interface DebateSession {
  evaluation_run_id: string;
  idea_id: string;
  idea_slug: string;
  idea_title: string;
  round_count: number;
  criterion_count: number;
  rounds_per_criterion: number;
  started_at: string;
  latest_at: string;
  status?: "complete" | "in-progress" | "evaluation-only" | "data-loss";
}

export interface DebateSessionDetail extends DebateSession {
  rounds: DebateRound[];
  redteamChallenges: RedTeamChallenge[];
  apiCalls?: number;
  synthesis: {
    overall_score: number;
    recommendation: string;
    executive_summary: string;
    key_strengths: string[];
    key_weaknesses: string[];
  } | null;
}

export async function getDebateSessions(): Promise<DebateSession[]> {
  return fetchApi<DebateSession[]>("/debates");
}

export async function getDebateSession(
  runId: string,
): Promise<DebateSessionDetail> {
  return fetchApi<DebateSessionDetail>(`/debates/${runId}`);
}

// Red Team
export async function getRedTeamChallenges(
  slug: string,
  runId?: string,
): Promise<RedTeamChallenge[]> {
  const query = runId ? `?runId=${runId}` : "";
  return fetchApi<RedTeamChallenge[]>(`/ideas/${slug}/redteam${query}`);
}

// Synthesis
export async function getSynthesis(
  slug: string,
  runId?: string,
): Promise<Synthesis | null> {
  const query = runId ? `?runId=${runId}` : "";
  return fetchApi<Synthesis | null>(`/ideas/${slug}/synthesis${query}`);
}

// Development
export async function getDevelopmentLog(
  slug: string,
): Promise<DevelopmentEntry[]> {
  return fetchApi<DevelopmentEntry[]>(`/ideas/${slug}/development`);
}

// Relationships
export async function getRelationships(
  slug: string,
): Promise<IdeaRelationship[]> {
  return fetchApi<IdeaRelationship[]>(`/ideas/${slug}/relationships`);
}

// Costs
export async function getCosts(slug: string): Promise<CostEntry[]> {
  return fetchApi<CostEntry[]>(`/ideas/${slug}/costs`);
}

export async function getTotalCost(
  slug: string,
): Promise<{ total: number; byAgent: Record<string, number> }> {
  return fetchApi<{ total: number; byAgent: Record<string, number> }>(
    `/ideas/${slug}/costs/total`,
  );
}

// Stats
export async function getStats(): Promise<{
  totalIdeas: number;
  byType: Record<string, number>;
  byStage: Record<string, number>;
  avgScore: number;
  totalCost: number;
}> {
  return fetchApi(`/stats`);
}

// Export functions
export function getExportAllIdeasUrl(): string {
  return `${API_BASE}/export/ideas`;
}

export function getExportIdeaUrl(slug: string): string {
  return `${API_BASE}/export/ideas/${slug}`;
}

export function getExportCsvUrl(): string {
  return `${API_BASE}/export/csv`;
}

export function downloadExport(url: string): void {
  window.open(url, "_blank");
}

// Import functions
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importIdeas(data: {
  ideas: unknown[];
}): Promise<ImportResult> {
  const response = await fetch(`${API_BASE}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Import failed: ${response.statusText}`);
  }
  const result: ApiResponse<ImportResult> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Import failed");
  }
  return result.data;
}

// ==================== Idea CRUD ====================

export interface CreateIdeaInput {
  title: string;
  summary?: string;
  idea_type?: string;
  lifecycle_stage?: string;
  content?: string;
  tags?: string[];
}

export interface UpdateIdeaInput {
  title?: string;
  summary?: string;
  idea_type?: string;
  lifecycle_stage?: string;
  content?: string;
  tags?: string[];
}

export async function createIdea(
  data: CreateIdeaInput,
): Promise<{ id: string; slug: string }> {
  const response = await fetch(`${API_BASE}/ideas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to create idea");
  }
  const result: ApiResponse<{ id: string; slug: string }> =
    await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to create idea");
  }
  return result.data;
}

export async function updateIdea(
  slug: string,
  data: UpdateIdeaInput,
): Promise<void> {
  const response = await fetch(`${API_BASE}/ideas/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to update idea");
  }
  const result: ApiResponse<{ success: boolean }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to update idea");
  }
}

export async function deleteIdea(slug: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ideas/${slug}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to delete idea");
  }
  const result: ApiResponse<{ success: boolean }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to delete idea");
  }
}

export async function updateIdeaStage(
  slug: string,
  lifecycle_stage: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lifecycle_stage }),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to update stage");
  }
  const result: ApiResponse<{ success: boolean }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to update stage");
  }
}

// ==================== Evaluation ====================

export interface TriggerEvaluationInput {
  budget?: number;
  mode?: "v1" | "v2";
  skipDebate?: boolean;
  unlimited?: boolean;
  debateRounds?: number; // Number of debate rounds per criterion (1-3)
}

export interface TriggerEvaluationResult {
  message: string;
  runId: string;
  slug: string;
}

export async function triggerEvaluation(
  slug: string,
  options?: TriggerEvaluationInput,
): Promise<TriggerEvaluationResult> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options || {}),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to start evaluation");
  }
  const result: ApiResponse<TriggerEvaluationResult> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to start evaluation");
  }
  return result.data;
}

export interface EvaluationStatus {
  hasEvaluations: boolean;
  lastRunId: string | null;
  lastEvaluatedAt: string | null;
  activeViewers: number;
}

export async function getEvaluationStatus(
  slug: string,
): Promise<EvaluationStatus> {
  return fetchApi<EvaluationStatus>(`/ideas/${slug}/evaluate/status`);
}

// ==================== Profile ====================

// Get all profiles (for selector dropdown)
export async function getProfiles(): Promise<UserProfileSummary[]> {
  return fetchApi<UserProfileSummary[]>("/profiles");
}

// Get profile linked to an idea
export async function getIdeaProfile(
  slug: string,
): Promise<UserProfileSummary | null> {
  return fetchApi<UserProfileSummary | null>(`/ideas/${slug}/profile`);
}

// Link profile to idea
export async function linkProfileToIdea(
  profileId: string,
  ideaSlug: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/profiles/${profileId}/link/${ideaSlug}`,
    { method: "POST" },
  );
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to link profile");
  }
}

// Unlink profile from idea
export async function unlinkProfileFromIdea(
  profileId: string,
  ideaSlug: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/profiles/${profileId}/link/${ideaSlug}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to unlink profile");
  }
}

// ==================== Dynamic Questioning ====================

// Get questions for an idea
export async function getQuestions(
  slug: string,
  options?: {
    category?: string;
    criterion?: string;
    priority?: string;
    unansweredOnly?: boolean;
    limit?: number;
  },
): Promise<QuestionsResponse> {
  const params = new URLSearchParams();
  if (options?.category) params.set("category", options.category);
  if (options?.criterion) params.set("criterion", options.criterion);
  if (options?.priority) params.set("priority", options.priority);
  if (options?.unansweredOnly) params.set("unansweredOnly", "true");
  if (options?.limit) params.set("limit", options.limit.toString());

  const query = params.toString();
  return fetchApi<QuestionsResponse>(
    `/ideas/${slug}/questions${query ? `?${query}` : ""}`,
  );
}

// Get all questions (for reference)
export async function getAllQuestions(): Promise<Question[]> {
  return fetchApi<Question[]>("/questions");
}

// Get answers for an idea
export async function getAnswers(
  slug: string,
  questionId?: string,
): Promise<Answer[]> {
  const query = questionId ? `?questionId=${questionId}` : "";
  const result = await fetchApi<{
    answers: Answer[];
    coverage: CriterionCoverage[];
  }>(`/ideas/${slug}/answers${query}`);
  return result.answers;
}

// Submit an answer
export async function submitAnswer(
  slug: string,
  data: {
    questionId: string;
    answer: string;
    sessionId?: string;
  },
): Promise<AnswerSubmitResponse> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to submit answer");
  }
  const result: ApiResponse<AnswerSubmitResponse> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to submit answer");
  }
  return result.data;
}

// Delete an answer
export async function deleteAnswer(
  slug: string,
  questionId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/ideas/${slug}/answers/${questionId}`,
    {
      method: "DELETE",
    },
  );
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to delete answer");
  }
}

// Get readiness score for an idea
export async function getReadiness(slug: string): Promise<ReadinessScore> {
  return fetchApi<ReadinessScore>(`/ideas/${slug}/readiness`);
}

// Get criterion coverage for an idea
export async function getCriterionCoverage(
  slug: string,
): Promise<CriterionCoverage[]> {
  return fetchApi<CriterionCoverage[]>(`/ideas/${slug}/readiness/coverage`);
}

// Start a development session
export async function startDevelopmentSession(
  slug: string,
  options?: {
    focusCategory?: string;
    focusCriterion?: string;
    questionsPerSession?: number;
  },
): Promise<DevelopmentSession> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/develop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options || {}),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to start development session");
  }
  const result: ApiResponse<DevelopmentSession> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to start development session");
  }
  return result.data;
}

// Get active development session
export async function getDevelopmentSession(
  slug: string,
): Promise<DevelopmentSession | null> {
  return fetchApi<DevelopmentSession | null>(`/ideas/${slug}/develop`);
}

// ==================== Incubation Lifecycle ====================

// Types for incubation lifecycle
export type IdeaStatus =
  | "active"
  | "paused"
  | "abandoned"
  | "completed"
  | "archived";
export type IncubationPhase =
  | "capture"
  | "clarify"
  | "position"
  | "update"
  | "evaluate"
  | "iterate";

export interface IdeaVersion {
  id: string;
  ideaId: string;
  versionNumber: number;
  iterationNumber: number;
  contentSnapshot: string;
  evaluationSnapshot?: string;
  phase: IncubationPhase;
  changeType: string;
  changeSummary?: string;
  createdAt: string;
}

export interface VersionDiff {
  from: number;
  to: number;
  contentChanges: Array<{
    field: string;
    before: string;
    after: string;
  }>;
  scoreChanges?: Array<{
    criterion: string;
    before: number;
    after: number;
    delta: number;
  }>;
}

export interface StatusHistoryEntry {
  id: number;
  ideaId: string;
  fromStatus: IdeaStatus | null;
  toStatus: IdeaStatus;
  reason?: string;
  changedAt: string;
}

export interface IdeaSummary {
  id: string;
  slug: string;
  title: string;
  status: IdeaStatus;
  currentVersion: number;
  latestScore?: number;
  branchReason?: string;
}

export interface IdeaLineage {
  current: IdeaSummary;
  parent?: IdeaSummary;
  children: IdeaSummary[];
  ancestors: IdeaSummary[];
}

export interface IterationLog {
  id: string;
  ideaId: string;
  fromIteration: number;
  toIteration: number;
  triggerCriteria: string[];
  focusCategories: string[];
  userDirection: string;
  previousScore: number;
  createdAt: string;
}

export interface Assumption {
  id: string;
  assumption_text: string;
  category: string;
  risk_level: string;
  validated: boolean;
  validation_notes: string | null;
  created_at: string;
}

export interface GateDecision {
  id: string;
  gate_type: string;
  advisory_shown: string;
  user_choice: string;
  readiness_score: number | null;
  overall_score: number | null;
  decided_at: string;
}

// Version history
export async function getVersionHistory(slug: string): Promise<IdeaVersion[]> {
  return fetchApi<IdeaVersion[]>(`/ideas/${slug}/versions`);
}

// Get specific version
export async function getVersionSnapshot(
  slug: string,
  version: number,
): Promise<IdeaVersion> {
  return fetchApi<IdeaVersion>(`/ideas/${slug}/versions/${version}`);
}

// Compare two versions
export async function compareVersions(
  slug: string,
  v1: number,
  v2: number,
): Promise<VersionDiff> {
  return fetchApi<VersionDiff>(`/ideas/${slug}/versions/compare/${v1}/${v2}`);
}

// Create manual snapshot
export async function createSnapshot(
  slug: string,
  summary?: string,
): Promise<{ versionId: string }> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summary }),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to create snapshot");
  }
  const result: ApiResponse<{ versionId: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to create snapshot");
  }
  return result.data;
}

// Lineage
export async function getLineage(slug: string): Promise<IdeaLineage> {
  return fetchApi<IdeaLineage>(`/ideas/${slug}/lineage`);
}

// Create branch
export async function createBranch(
  slug: string,
  data: {
    title: string;
    reason: string;
    parentAction?: "keep_active" | "pause" | "abandon";
  },
): Promise<{ slug: string }> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/branch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to create branch");
  }
  const result: ApiResponse<{ slug: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to create branch");
  }
  return result.data;
}

// Status history
export async function getStatusHistory(
  slug: string,
): Promise<StatusHistoryEntry[]> {
  return fetchApi<StatusHistoryEntry[]>(`/ideas/${slug}/status-history`);
}

// Update status
export async function updateIdeaStatus(
  slug: string,
  status: IdeaStatus,
  reason?: string,
): Promise<{ previousStatus: string; newStatus: string }> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason }),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to update status");
  }
  const result: ApiResponse<{ previousStatus: string; newStatus: string }> =
    await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to update status");
  }
  return result.data;
}

// Iterations
export async function getIterations(slug: string): Promise<IterationLog[]> {
  return fetchApi<IterationLog[]>(`/ideas/${slug}/iterations`);
}

// Assumptions
export async function getAssumptions(slug: string): Promise<Assumption[]> {
  return fetchApi<Assumption[]>(`/ideas/${slug}/assumptions`);
}

// Gate decisions
export async function getGateDecisions(slug: string): Promise<GateDecision[]> {
  return fetchApi<GateDecision[]>(`/ideas/${slug}/gates`);
}

// Update incubation phase
export async function updateIncubationPhase(
  slug: string,
  phase: IncubationPhase,
): Promise<{ previousPhase: string; newPhase: string }> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/phase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase }),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to update phase");
  }
  const result: ApiResponse<{ previousPhase: string; newPhase: string }> =
    await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to update phase");
  }
  return result.data;
}

// Record gate decision
export async function recordGateDecision(
  slug: string,
  data: {
    gateType: "viability" | "evaluation";
    advisoryShown: string;
    userChoice: string;
    readinessScore?: number;
    overallScore?: number;
  },
): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/gates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to record gate decision");
  }
  const result: ApiResponse<{ id: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to record gate decision");
  }
  return result.data;
}

// ==================== Differentiation Analysis ====================

export interface FiveWH {
  what?: string;
  why?: string;
  how?: string;
  when?: string;
  where?: string;
  howMuch?: string;
}

export interface MarketOpportunity {
  id: string;
  segment: string;
  description: string;
  fit: "high" | "medium" | "low";
  confidence: number;
  reasons: string[];
  // Extended 5W+H fields
  why?: string;
  marketSize?: string;
  timing?: string;
}

export interface DifferentiationStrategy {
  id: string;
  approach: string;
  description: string;
  validated: boolean;
  validationNotes?: string;
  alignedWith: string[];
  risks: string[];
  fitScore?: number;
  fiveWH?: FiveWH;
}

export interface MarketTiming {
  currentWindow: string;
  urgency: "high" | "medium" | "low";
  keyTrends: string[];
  recommendation: string;
}

export interface CompetitiveRisk {
  id: string;
  competitor: string;
  threat: string;
  severity: "high" | "medium" | "low";
  mitigation?: string;
}

export interface DifferentiationAnalysisResult {
  opportunities: MarketOpportunity[];
  strategies: DifferentiationStrategy[];
  competitiveRisks: CompetitiveRisk[];
  summary: string;
  overallConfidence: number;
  marketTiming?: MarketTiming;
}

// Run differentiation analysis for an idea
export async function runDifferentiationAnalysis(
  slug: string,
): Promise<DifferentiationAnalysisResult> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/differentiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to run differentiation analysis");
  }
  const result: ApiResponse<DifferentiationAnalysisResult> =
    await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to run differentiation analysis");
  }
  return result.data;
}

// Extended result with metadata
export interface SavedDifferentiationResult extends DifferentiationAnalysisResult {
  id: string;
  runId: string;
  cost: number;
  apiCalls: number;
  createdAt: string;
}

// Get saved differentiation results for an idea
export async function getDifferentiationResults(
  slug: string,
): Promise<SavedDifferentiationResult | null> {
  return fetchApi<SavedDifferentiationResult | null>(
    `/ideas/${slug}/differentiation`,
  );
}

// ==================== Update Suggestions ====================

export interface UpdateSuggestion {
  id: string;
  suggestedTitle: string;
  suggestedSummary: string;
  suggestedContent: string;
  changeRationale: {
    title: string;
    summary: string;
    content: string;
    overall: string;
  };
  keyInsightsIncorporated?: string[];
  positioningStrategy?: string;
  targetSegment?: string;
  status?: string;
  createdAt?: string;
  cost?: number;
}

// Generate AI update suggestions based on differentiation analysis
export async function generateUpdateSuggestion(
  slug: string,
  selectedStrategyIndex?: number,
): Promise<UpdateSuggestion> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/generate-update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedStrategyIndex }),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to generate update suggestion");
  }
  const result: ApiResponse<UpdateSuggestion> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to generate update suggestion");
  }
  return result.data;
}

// Get saved update suggestion for an idea
export async function getUpdateSuggestion(
  slug: string,
): Promise<UpdateSuggestion | null> {
  return fetchApi<UpdateSuggestion | null>(`/ideas/${slug}/update-suggestion`);
}

// Apply an update suggestion to the idea
export async function applyUpdateSuggestion(
  slug: string,
  suggestionId: string,
  modified?: { title?: string; summary?: string; content?: string },
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/apply-update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suggestionId, modified }),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to apply update");
  }
  const result: ApiResponse<{ success: boolean; message: string }> =
    await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to apply update");
  }
  return result.data;
}

// ==========================================
// FINANCIAL ALLOCATION
// ==========================================

import type {
  IdeaFinancialAllocation,
  PositioningDecision,
  StrategicApproach,
} from "../types";

// Get financial allocation for an idea
export async function getFinancialAllocation(
  slug: string,
): Promise<IdeaFinancialAllocation> {
  return fetchApi<IdeaFinancialAllocation>(`/ideas/${slug}/allocation`);
}

// Save financial allocation for an idea
export async function saveFinancialAllocation(
  slug: string,
  allocation: Partial<IdeaFinancialAllocation>,
): Promise<{ id: string; updated?: boolean; created?: boolean }> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/allocation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(allocation),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to save allocation");
  }
  const result: ApiResponse<{
    id: string;
    updated?: boolean;
    created?: boolean;
  }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to save allocation");
  }
  return result.data;
}

// Delete financial allocation for an idea
export async function deleteFinancialAllocation(
  slug: string,
): Promise<{ deleted: boolean }> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/allocation`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to delete allocation");
  }
  const result: ApiResponse<{ deleted: boolean }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to delete allocation");
  }
  return result.data;
}

// ==========================================
// POSITIONING DECISIONS
// ==========================================

// Get the most recent positioning decision for an idea
export async function getPositioningDecision(
  slug: string,
): Promise<PositioningDecision & { exists: boolean }> {
  return fetchApi<PositioningDecision & { exists: boolean }>(
    `/ideas/${slug}/positioning-decision`,
  );
}

// Save a positioning decision for an idea
export async function savePositioningDecision(
  slug: string,
  decision: Partial<PositioningDecision>,
): Promise<{ id: string; created: boolean }> {
  const response = await fetch(
    `${API_BASE}/ideas/${slug}/positioning-decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(decision),
    },
  );
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to save decision");
  }
  const result: ApiResponse<{ id: string; created: boolean }> =
    await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to save decision");
  }
  return result.data;
}

// Get all positioning decisions for an idea (history)
export async function getPositioningDecisionHistory(
  slug: string,
): Promise<PositioningDecision[]> {
  return fetchApi<PositioningDecision[]>(
    `/ideas/${slug}/positioning-decisions`,
  );
}

// ==========================================
// IDEATION SESSIONS
// ==========================================

export interface IdeationSessionSummary {
  id: string;
  profileId: string;
  status: "active" | "completed" | "abandoned";
  entryMode: "have_idea" | "discover" | null;
  messageCount: number;
  tokenCount: number;
  startedAt: string;
  completedAt: string | null;
  candidateTitle: string | null;
  candidateSummary: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
}

export async function getIdeationSessions(
  profileId: string,
  options?: { status?: string; includeAll?: boolean },
): Promise<IdeationSessionSummary[]> {
  const params = new URLSearchParams({ profileId });
  if (options?.status) params.set("status", options.status);
  if (options?.includeAll) params.set("includeAll", "true");

  const response = await fetch(
    `${API_BASE}/ideation/sessions?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  const data = await response.json();
  // Handle both wrapped {success, data} format and direct {sessions} format
  if (data.success && data.data) {
    return data.data.sessions;
  }
  return data.sessions || [];
}

export async function deleteIdeationSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ideation/session/${sessionId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(err.error || "Failed to delete session");
  }
}

export async function getIdeationSession(sessionId: string): Promise<{
  session: {
    id: string;
    profileId: string;
    status: string;
    entryMode: string | null;
    startedAt: string;
  };
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    buttonsShown?: unknown[];
    formShown?: unknown;
    createdAt: string;
  }>;
  candidate: {
    id: string;
    title: string;
    summary: string | null;
    confidence: number;
    viability: number;
  } | null;
}> {
  return fetchApi(`/ideation/session/${sessionId}`);
}

// ==========================================
// POSITIONING ANALYSIS
// ==========================================

export interface PositioningAnalysisResult {
  id: string;
  approach: StrategicApproach;
  strategicSummary: {
    recommendedStrategy: {
      id: string;
      name: string;
      fitScore: number;
      reason: string;
    };
    primaryOpportunity: {
      id: string;
      segment: string;
      fit: "high" | "medium" | "low";
    };
    criticalRisk: {
      id: string;
      description: string;
      severity: "high" | "medium" | "low";
      mitigation: string;
    };
    timingAssessment: {
      urgency: "high" | "medium" | "low";
      window: string;
    };
    overallConfidence: number;
  };
  marketOpportunities: Array<{
    id: string;
    description: string;
    targetSegment: string;
    potentialImpact: "high" | "medium" | "low";
    feasibility: "high" | "medium" | "low";
    why?: string;
    marketSize?: string;
    timing?: string;
    validationConfidence?: number;
    validationWarnings?: string[];
  }>;
  competitiveRisks: Array<{
    id: string;
    description: string;
    likelihood: "high" | "medium" | "low";
    severity: "high" | "medium" | "low";
    mitigation?: string;
    competitors?: string[];
    timeframe?: string;
  }>;
  strategies: Array<{
    id: string;
    name: string;
    description: string;
    differentiators: string[];
    tradeoffs: string[];
    fitWithProfile: number;
    fiveWH?: {
      what?: string;
      why?: string;
      how?: string;
      when?: string;
      where?: string;
      howMuch?: string;
    };
    addressesOpportunities: string[];
    mitigatesRisks: string[];
    timingAlignment: "favorable" | "neutral" | "challenging";
    revenueEstimates?: {
      year1: { low: number; mid: number; high: number };
      year3: { low: number; mid: number; high: number };
      assumptions: string[];
    };
    goalAlignment?: {
      meetsIncomeTarget: boolean;
      gapToTarget: number | null;
      timelineAlignment: "faster" | "aligned" | "slower" | "unlikely";
      runwaySufficient: boolean;
      investmentFeasible: boolean;
    };
    profileFitBreakdown?: {
      score: number;
      strengths: string[];
      gaps: string[];
      suggestions: string[];
    };
  }>;
  marketTiming?: {
    currentWindow: string;
    urgency: "high" | "medium" | "low";
    keyTrends: string[];
    recommendation: string;
  };
  summary: string;
  overallConfidence: number;
  cost: {
    dollars: number;
    apiCalls: number;
  };
}

// Run positioning analysis with a strategic approach
export async function runPositioningAnalysis(
  slug: string,
  approach: StrategicApproach,
): Promise<PositioningAnalysisResult> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/position`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approach }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.error || `Positioning analysis failed: ${response.statusText}`,
    );
  }

  const result: ApiResponse<PositioningAnalysisResult> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Positioning analysis failed");
  }
  return result.data;
}

// Get saved positioning analysis results for an idea
export async function getPositioningResults(
  slug: string,
): Promise<PositioningAnalysisResult | null> {
  return fetchApi<PositioningAnalysisResult | null>(
    `/ideas/${slug}/positioning`,
  );
}
