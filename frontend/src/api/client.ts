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
} from '../types';

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  const data: ApiResponse<T> = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }
  return data.data;
}

// Ideas
export async function getIdeas(filters?: IdeaFilters): Promise<IdeaWithScores[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.stage) params.set('stage', filters.stage);
  if (filters?.tag) params.set('tag', filters.tag);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.sortBy) params.set('sortBy', filters.sortBy);
  if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);

  const query = params.toString();
  return fetchApi<IdeaWithScores[]>(`/ideas${query ? `?${query}` : ''}`);
}

export async function getIdea(slug: string): Promise<IdeaWithScores> {
  return fetchApi<IdeaWithScores>(`/ideas/${slug}`);
}

// Evaluations
export async function getEvaluations(slug: string, runId?: string): Promise<Evaluation[]> {
  const query = runId ? `?runId=${runId}` : '';
  return fetchApi<Evaluation[]>(`/ideas/${slug}/evaluations${query}`);
}

export async function getCategoryScores(slug: string, runId?: string): Promise<CategoryScore[]> {
  const query = runId ? `?runId=${runId}` : '';
  return fetchApi<CategoryScore[]>(`/ideas/${slug}/category-scores${query}`);
}

export async function getEvaluationRuns(slug: string): Promise<string[]> {
  return fetchApi<string[]>(`/ideas/${slug}/evaluation-runs`);
}

// Debates
export async function getDebateRounds(slug: string, runId?: string): Promise<DebateRound[]> {
  const query = runId ? `?runId=${runId}` : '';
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
  started_at: string;
  latest_at: string;
  status?: 'complete' | 'in-progress' | 'evaluation-only';
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
  return fetchApi<DebateSession[]>('/debates');
}

export async function getDebateSession(runId: string): Promise<DebateSessionDetail> {
  return fetchApi<DebateSessionDetail>(`/debates/${runId}`);
}

// Red Team
export async function getRedTeamChallenges(slug: string, runId?: string): Promise<RedTeamChallenge[]> {
  const query = runId ? `?runId=${runId}` : '';
  return fetchApi<RedTeamChallenge[]>(`/ideas/${slug}/redteam${query}`);
}

// Synthesis
export async function getSynthesis(slug: string, runId?: string): Promise<Synthesis | null> {
  const query = runId ? `?runId=${runId}` : '';
  return fetchApi<Synthesis | null>(`/ideas/${slug}/synthesis${query}`);
}

// Development
export async function getDevelopmentLog(slug: string): Promise<DevelopmentEntry[]> {
  return fetchApi<DevelopmentEntry[]>(`/ideas/${slug}/development`);
}

// Relationships
export async function getRelationships(slug: string): Promise<IdeaRelationship[]> {
  return fetchApi<IdeaRelationship[]>(`/ideas/${slug}/relationships`);
}

// Costs
export async function getCosts(slug: string): Promise<CostEntry[]> {
  return fetchApi<CostEntry[]>(`/ideas/${slug}/costs`);
}

export async function getTotalCost(slug: string): Promise<{ total: number; byAgent: Record<string, number> }> {
  return fetchApi<{ total: number; byAgent: Record<string, number> }>(`/ideas/${slug}/costs/total`);
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
  window.open(url, '_blank');
}

// Import functions
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importIdeas(data: { ideas: unknown[] }): Promise<ImportResult> {
  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Import failed: ${response.statusText}`);
  }
  const result: ApiResponse<ImportResult> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Import failed');
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

export async function createIdea(data: CreateIdeaInput): Promise<{ id: string; slug: string }> {
  const response = await fetch(`${API_BASE}/ideas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to create idea');
  }
  const result: ApiResponse<{ id: string; slug: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create idea');
  }
  return result.data;
}

export async function updateIdea(slug: string, data: UpdateIdeaInput): Promise<void> {
  const response = await fetch(`${API_BASE}/ideas/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to update idea');
  }
  const result: ApiResponse<{ success: boolean }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update idea');
  }
}

export async function deleteIdea(slug: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ideas/${slug}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to delete idea');
  }
  const result: ApiResponse<{ success: boolean }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete idea');
  }
}

export async function updateIdeaStage(slug: string, lifecycle_stage: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lifecycle_stage }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to update stage');
  }
  const result: ApiResponse<{ success: boolean }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update stage');
  }
}

// ==================== Evaluation ====================

export interface TriggerEvaluationInput {
  budget?: number;
  mode?: 'v1' | 'v2';
  skipDebate?: boolean;
  unlimited?: boolean;
}

export interface TriggerEvaluationResult {
  message: string;
  runId: string;
  slug: string;
}

export async function triggerEvaluation(
  slug: string,
  options?: TriggerEvaluationInput
): Promise<TriggerEvaluationResult> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to start evaluation');
  }
  const result: ApiResponse<TriggerEvaluationResult> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to start evaluation');
  }
  return result.data;
}

export interface EvaluationStatus {
  hasEvaluations: boolean;
  lastRunId: string | null;
  lastEvaluatedAt: string | null;
  activeViewers: number;
}

export async function getEvaluationStatus(slug: string): Promise<EvaluationStatus> {
  return fetchApi<EvaluationStatus>(`/ideas/${slug}/evaluate/status`);
}

// ==================== Profile ====================

// Get all profiles (for selector dropdown)
export async function getProfiles(): Promise<UserProfileSummary[]> {
  return fetchApi<UserProfileSummary[]>('/profiles');
}

// Get profile linked to an idea
export async function getIdeaProfile(slug: string): Promise<UserProfileSummary | null> {
  return fetchApi<UserProfileSummary | null>(`/ideas/${slug}/profile`);
}

// Link profile to idea
export async function linkProfileToIdea(profileId: string, ideaSlug: string): Promise<void> {
  const response = await fetch(`${API_BASE}/profiles/${profileId}/link/${ideaSlug}`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to link profile');
  }
}

// Unlink profile from idea
export async function unlinkProfileFromIdea(profileId: string, ideaSlug: string): Promise<void> {
  const response = await fetch(`${API_BASE}/profiles/${profileId}/link/${ideaSlug}`, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to unlink profile');
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
  }
): Promise<QuestionsResponse> {
  const params = new URLSearchParams();
  if (options?.category) params.set('category', options.category);
  if (options?.criterion) params.set('criterion', options.criterion);
  if (options?.priority) params.set('priority', options.priority);
  if (options?.unansweredOnly) params.set('unansweredOnly', 'true');
  if (options?.limit) params.set('limit', options.limit.toString());

  const query = params.toString();
  return fetchApi<QuestionsResponse>(`/ideas/${slug}/questions${query ? `?${query}` : ''}`);
}

// Get all questions (for reference)
export async function getAllQuestions(): Promise<Question[]> {
  return fetchApi<Question[]>('/questions');
}

// Get answers for an idea
export async function getAnswers(
  slug: string,
  questionId?: string
): Promise<Answer[]> {
  const query = questionId ? `?questionId=${questionId}` : '';
  const result = await fetchApi<{ answers: Answer[]; coverage: CriterionCoverage[] }>(`/ideas/${slug}/answers${query}`);
  return result.answers;
}

// Submit an answer
export async function submitAnswer(
  slug: string,
  data: {
    questionId: string;
    answer: string;
    sessionId?: string;
  }
): Promise<AnswerSubmitResponse> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to submit answer');
  }
  const result: ApiResponse<AnswerSubmitResponse> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to submit answer');
  }
  return result.data;
}

// Delete an answer
export async function deleteAnswer(slug: string, questionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/answers/${questionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to delete answer');
  }
}

// Get readiness score for an idea
export async function getReadiness(slug: string): Promise<ReadinessScore> {
  return fetchApi<ReadinessScore>(`/ideas/${slug}/readiness`);
}

// Get criterion coverage for an idea
export async function getCriterionCoverage(slug: string): Promise<CriterionCoverage[]> {
  return fetchApi<CriterionCoverage[]>(`/ideas/${slug}/readiness/coverage`);
}

// Start a development session
export async function startDevelopmentSession(
  slug: string,
  options?: {
    focusCategory?: string;
    focusCriterion?: string;
    questionsPerSession?: number;
  }
): Promise<DevelopmentSession> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/develop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Failed to start development session');
  }
  const result: ApiResponse<DevelopmentSession> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to start development session');
  }
  return result.data;
}

// Get active development session
export async function getDevelopmentSession(slug: string): Promise<DevelopmentSession | null> {
  return fetchApi<DevelopmentSession | null>(`/ideas/${slug}/develop`);
}
