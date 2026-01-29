import {
  IdeationSession,
  IdeationSessionRow,
  IdeationMessage,
  IdeationMessageRow,
  IdeaCandidate,
  IdeaCandidateRow,
  ViabilityRisk,
  ViabilityRiskRow,
  MemoryFile,
  MemoryFileRow,
  ButtonOption,
  FormDefinition,
  SessionStatus,
  SessionPhase,
  CandidateStatus,
  RiskType,
  RiskSeverity,
  MessageRole,
  MemoryFileType,
  WebSearchResult,
  EntryMode,
} from "../types/ideation.js";

// ============================================================================
// SESSION MAPPERS
// ============================================================================

export function mapSessionRowToSession(
  row: IdeationSessionRow,
): IdeationSession {
  return {
    id: row.id,
    profileId: row.profile_id,
    entryMode: row.entry_mode as EntryMode,
    status: row.status as SessionStatus,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    lastActivityAt: new Date(row.last_activity_at),
    handoffCount: row.handoff_count,
    tokenCount: row.token_count,
    messageCount: row.message_count,
    currentPhase: row.current_phase as SessionPhase,
    // Session title
    title: row.title || null,
    // Include linked idea info if present
    userSlug: (row.user_slug as string) || null,
    ideaSlug: (row.idea_slug as string) || null,
  };
}

export function mapSessionToRow(
  session: Partial<IdeationSession>,
): Partial<IdeationSessionRow> {
  const row: Partial<IdeationSessionRow> = {};

  if (session.id !== undefined) row.id = session.id;
  if (session.profileId !== undefined) row.profile_id = session.profileId;
  if (session.entryMode !== undefined) row.entry_mode = session.entryMode;
  if (session.status !== undefined) row.status = session.status;
  if (session.startedAt !== undefined)
    row.started_at = session.startedAt.toISOString();
  if (session.completedAt !== undefined)
    row.completed_at = session.completedAt?.toISOString() ?? null;
  if (session.lastActivityAt !== undefined)
    row.last_activity_at = session.lastActivityAt.toISOString();
  if (session.handoffCount !== undefined)
    row.handoff_count = session.handoffCount;
  if (session.tokenCount !== undefined) row.token_count = session.tokenCount;
  if (session.messageCount !== undefined)
    row.message_count = session.messageCount;
  if (session.currentPhase !== undefined)
    row.current_phase = session.currentPhase;
  if (session.title !== undefined) row.title = session.title;

  return row;
}

// ============================================================================
// MESSAGE MAPPERS
// ============================================================================

export function mapMessageRowToMessage(
  row: IdeationMessageRow,
): IdeationMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as MessageRole,
    content: row.content,
    buttonsShown: row.buttons_shown
      ? (JSON.parse(row.buttons_shown) as ButtonOption[])
      : null,
    buttonClicked: row.button_clicked,
    formShown: row.form_shown
      ? (JSON.parse(row.form_shown) as FormDefinition)
      : null,
    formResponse: row.form_response ? JSON.parse(row.form_response) : null,
    webSearchResults: row.web_search_results
      ? (JSON.parse(row.web_search_results) as WebSearchResult[])
      : null,
    tokenCount: row.token_count,
    createdAt: new Date(row.created_at),
  };
}

export function mapMessageToRow(
  message: Partial<IdeationMessage>,
): Partial<IdeationMessageRow> {
  const row: Partial<IdeationMessageRow> = {};

  if (message.id !== undefined) row.id = message.id;
  if (message.sessionId !== undefined) row.session_id = message.sessionId;
  if (message.role !== undefined) row.role = message.role;
  if (message.content !== undefined) row.content = message.content;
  if (message.buttonsShown !== undefined)
    row.buttons_shown = message.buttonsShown
      ? JSON.stringify(message.buttonsShown)
      : null;
  if (message.buttonClicked !== undefined)
    row.button_clicked = message.buttonClicked;
  if (message.formShown !== undefined)
    row.form_shown = message.formShown
      ? JSON.stringify(message.formShown)
      : null;
  if (message.formResponse !== undefined)
    row.form_response = message.formResponse
      ? JSON.stringify(message.formResponse)
      : null;
  if (message.webSearchResults !== undefined)
    row.web_search_results = message.webSearchResults
      ? JSON.stringify(message.webSearchResults)
      : null;
  if (message.tokenCount !== undefined) row.token_count = message.tokenCount;
  if (message.createdAt !== undefined)
    row.created_at = message.createdAt.toISOString();

  return row;
}

// ============================================================================
// CANDIDATE MAPPERS
// ============================================================================

export function mapCandidateRowToCandidate(
  row: IdeaCandidateRow,
): IdeaCandidate {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    summary: row.summary,
    confidence: row.confidence,
    viability: row.viability,
    userSuggested: Boolean(row.user_suggested),
    status: row.status as CandidateStatus,
    capturedIdeaId: row.captured_idea_id,
    version: row.version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapCandidateToRow(
  candidate: Partial<IdeaCandidate>,
): Partial<IdeaCandidateRow> {
  const row: Partial<IdeaCandidateRow> = {};

  if (candidate.id !== undefined) row.id = candidate.id;
  if (candidate.sessionId !== undefined) row.session_id = candidate.sessionId;
  if (candidate.title !== undefined) row.title = candidate.title;
  if (candidate.summary !== undefined) row.summary = candidate.summary;
  if (candidate.confidence !== undefined) row.confidence = candidate.confidence;
  if (candidate.viability !== undefined) row.viability = candidate.viability;
  if (candidate.userSuggested !== undefined)
    row.user_suggested = candidate.userSuggested ? 1 : 0;
  if (candidate.status !== undefined) row.status = candidate.status;
  if (candidate.capturedIdeaId !== undefined)
    row.captured_idea_id = candidate.capturedIdeaId;
  if (candidate.version !== undefined) row.version = candidate.version;
  if (candidate.createdAt !== undefined)
    row.created_at = candidate.createdAt.toISOString();
  if (candidate.updatedAt !== undefined)
    row.updated_at = candidate.updatedAt.toISOString();

  return row;
}

// ============================================================================
// RISK MAPPERS
// ============================================================================

export function mapRiskRowToRisk(row: ViabilityRiskRow): ViabilityRisk {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    riskType: row.risk_type as RiskType,
    description: row.description,
    evidenceUrl: row.evidence_url,
    evidenceText: row.evidence_text,
    severity: row.severity as RiskSeverity,
    userAcknowledged: Boolean(row.user_acknowledged),
    userResponse: row.user_response,
    createdAt: new Date(row.created_at),
  };
}

export function mapRiskToRow(
  risk: Partial<ViabilityRisk>,
): Partial<ViabilityRiskRow> {
  const row: Partial<ViabilityRiskRow> = {};

  if (risk.id !== undefined) row.id = risk.id;
  if (risk.candidateId !== undefined) row.candidate_id = risk.candidateId;
  if (risk.riskType !== undefined) row.risk_type = risk.riskType;
  if (risk.description !== undefined) row.description = risk.description;
  if (risk.evidenceUrl !== undefined) row.evidence_url = risk.evidenceUrl;
  if (risk.evidenceText !== undefined) row.evidence_text = risk.evidenceText;
  if (risk.severity !== undefined) row.severity = risk.severity;
  if (risk.userAcknowledged !== undefined)
    row.user_acknowledged = risk.userAcknowledged ? 1 : 0;
  if (risk.userResponse !== undefined) row.user_response = risk.userResponse;
  if (risk.createdAt !== undefined)
    row.created_at = risk.createdAt.toISOString();

  return row;
}

// ============================================================================
// MEMORY FILE MAPPERS
// ============================================================================

export function mapMemoryRowToMemory(row: MemoryFileRow): MemoryFile {
  return {
    id: row.id,
    sessionId: row.session_id,
    fileType: row.file_type as MemoryFileType,
    content: row.content,
    version: row.version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapMemoryToRow(
  memory: Partial<MemoryFile>,
): Partial<MemoryFileRow> {
  const row: Partial<MemoryFileRow> = {};

  if (memory.id !== undefined) row.id = memory.id;
  if (memory.sessionId !== undefined) row.session_id = memory.sessionId;
  if (memory.fileType !== undefined) row.file_type = memory.fileType;
  if (memory.content !== undefined) row.content = memory.content;
  if (memory.version !== undefined) row.version = memory.version;
  if (memory.createdAt !== undefined)
    row.created_at = memory.createdAt.toISOString();
  if (memory.updatedAt !== undefined)
    row.updated_at = memory.updatedAt.toISOString();

  return row;
}
