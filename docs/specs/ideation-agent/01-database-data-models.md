# Spec 1: Database & Data Models

## Overview

This specification covers the database schema and TypeScript interfaces for the Ideation Agent system. It must be implemented first as all other specs depend on these data structures.

## Dependencies

- Existing `database/db.ts` module
- Existing migration system in `database/migrations/`

---

## 1. Database Migration

Create migration file: `database/migrations/018_ideation_agent.sql`

```sql
-- ============================================================================
-- IDEATION SESSION TABLES
-- ============================================================================

-- Core session tracking
CREATE TABLE IF NOT EXISTS ideation_sessions (
  id TEXT PRIMARY KEY,                                    -- UUID
  profile_id TEXT REFERENCES user_profiles(id),           -- Link to user profile
  entry_mode TEXT NOT NULL DEFAULT 'discover'             -- have_idea|discover (how user started)
    CHECK (entry_mode IN ('have_idea', 'discover')),
  status TEXT NOT NULL DEFAULT 'active'                   -- active|completed|abandoned
    CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handoff_count INTEGER NOT NULL DEFAULT 0,               -- Number of agent handoffs
  token_count INTEGER NOT NULL DEFAULT 0,                 -- Current token usage
  message_count INTEGER NOT NULL DEFAULT 0,               -- Total messages exchanged
  current_phase TEXT NOT NULL DEFAULT 'exploring'         -- exploring|narrowing|validating|refining
    CHECK (current_phase IN ('exploring', 'narrowing', 'validating', 'refining'))
);

-- Conversation messages
CREATE TABLE IF NOT EXISTS ideation_messages (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  buttons_shown TEXT,                                     -- JSON array of buttons shown
  button_clicked TEXT,                                    -- Button ID if clicked
  form_shown TEXT,                                        -- JSON of form if shown
  form_response TEXT,                                     -- JSON of form response
  web_search_results TEXT,                                -- JSON array of search results cited
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Memory file storage
CREATE TABLE IF NOT EXISTS ideation_memory (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN (
    'self_discovery',
    'market_discovery',
    'narrowing_state',
    'conversation_summary',
    'idea_candidate',
    'viability_assessment',
    'handoff_notes'
  )),
  content TEXT NOT NULL,                                  -- Markdown content
  version INTEGER NOT NULL DEFAULT 1,                     -- For tracking changes
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, file_type)                          -- One of each type per session
);

-- Idea candidates (during and after session)
CREATE TABLE IF NOT EXISTS ideation_candidates (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,                                           -- 1-2 sentence summary
  confidence INTEGER NOT NULL DEFAULT 0                   -- 0-100
    CHECK (confidence >= 0 AND confidence <= 100),
  viability INTEGER NOT NULL DEFAULT 100                  -- 0-100
    CHECK (viability >= 0 AND viability <= 100),
  user_suggested BOOLEAN NOT NULL DEFAULT FALSE,          -- Did user suggest this?
  status TEXT NOT NULL DEFAULT 'forming'                  -- forming|active|captured|discarded|saved
    CHECK (status IN ('forming', 'active', 'captured', 'discarded', 'saved')),
  captured_idea_id TEXT REFERENCES ideas(id),             -- Link if captured
  version INTEGER NOT NULL DEFAULT 1,                     -- For tracking refinements
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Viability risk tracking
CREATE TABLE IF NOT EXISTS ideation_viability_risks (
  id TEXT PRIMARY KEY,                                    -- UUID
  candidate_id TEXT NOT NULL REFERENCES ideation_candidates(id) ON DELETE CASCADE,
  risk_type TEXT NOT NULL CHECK (risk_type IN (
    'impossible',        -- Technology doesn't exist
    'unrealistic',       -- Beyond user's capacity
    'too_complex',       -- Too many hard problems
    'too_vague',         -- Can't be validated
    'saturated_market',  -- Too many competitors
    'wrong_timing',      -- Too early or too late
    'resource_mismatch'  -- User lacks required resources
  )),
  description TEXT NOT NULL,                              -- Human-readable description
  evidence_url TEXT,                                      -- Source URL if from web search
  evidence_text TEXT,                                     -- Key quote or finding
  severity TEXT NOT NULL DEFAULT 'medium'                 -- critical|high|medium|low
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  user_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,       -- Has user seen this?
  user_response TEXT,                                     -- What user chose to do
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Web search cache
CREATE TABLE IF NOT EXISTS ideation_searches (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results TEXT NOT NULL,                                  -- JSON array of results
  result_count INTEGER NOT NULL DEFAULT 0,
  purpose TEXT,                                           -- Why search was performed
  searched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Signal extraction log (for debugging and improvement)
CREATE TABLE IF NOT EXISTS ideation_signals (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES ideation_messages(id),
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'self_discovery',
    'market_discovery',
    'narrowing',
    'confidence',
    'viability'
  )),
  signal_key TEXT NOT NULL,                               -- e.g., 'frustration', 'expertise'
  signal_value TEXT NOT NULL,                             -- The extracted value
  confidence REAL NOT NULL DEFAULT 0.5                    -- 0.0-1.0 extraction confidence
    CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ideation_sessions_profile ON ideation_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_ideation_sessions_status ON ideation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ideation_messages_session ON ideation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_memory_session ON ideation_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_candidates_session ON ideation_candidates(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_risks_candidate ON ideation_viability_risks(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ideation_searches_session ON ideation_searches(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_signals_session ON ideation_signals(session_id);
```

---

## 2. TypeScript Interfaces

Create file: `types/ideation.ts`

```typescript
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
    capital: "bootstrap" | "seeking_funding" | null;
    riskTolerance: "low" | "medium" | "high" | null;
  };
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
}
```

---

## 3. Row Mapper Utilities

Create file: `utils/ideation-mappers.ts`

```typescript
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
    status: row.status as SessionStatus,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    lastActivityAt: new Date(row.last_activity_at),
    handoffCount: row.handoff_count,
    tokenCount: row.token_count,
    messageCount: row.message_count,
    currentPhase: row.current_phase as SessionPhase,
  };
}

export function mapSessionToRow(
  session: Partial<IdeationSession>,
): Partial<IdeationSessionRow> {
  const row: Partial<IdeationSessionRow> = {};

  if (session.id !== undefined) row.id = session.id;
  if (session.profileId !== undefined) row.profile_id = session.profileId;
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
```

---

## 4. Default State Factories

Create file: `utils/ideation-defaults.ts`

```typescript
import {
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
} from "../types/ideation.js";

export function createDefaultSelfDiscoveryState(): SelfDiscoveryState {
  return {
    impactVision: {
      level: null,
      description: null,
      confidence: 0,
    },
    frustrations: [],
    expertise: [],
    interests: [],
    skills: {
      identified: [],
      gaps: [],
      strengths: [],
    },
    constraints: {
      location: { fixed: false, target: null },
      timeHoursPerWeek: null,
      capital: null,
      riskTolerance: null,
    },
  };
}

export function createDefaultMarketDiscoveryState(): MarketDiscoveryState {
  return {
    competitors: [],
    gaps: [],
    timingSignals: [],
    failedAttempts: [],
    locationContext: {
      city: null,
      jobMarketTrends: null,
      localOpportunities: [],
      marketPresence: null,
    },
  };
}

export function createDefaultNarrowingState(): NarrowingState {
  return {
    productType: { value: null, confidence: 0 },
    customerType: { value: null, confidence: 0 },
    geography: { value: null, confidence: 0 },
    scale: { value: null, confidence: 0 },
    technicalDepth: { value: null, confidence: 0 },
    hypotheses: [],
    questionsNeeded: [],
  };
}
```

---

## 5. Test Plan

### 5.1 Unit Tests

Create file: `tests/ideation/data-models.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { getDb, initDb, closeDb } from "../../database/db.js";
import {
  mapSessionRowToSession,
  mapSessionToRow,
  mapMessageRowToMessage,
  mapCandidateRowToCandidate,
  mapRiskRowToRisk,
} from "../../utils/ideation-mappers.js";
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from "../../utils/ideation-defaults.js";

describe("Database Schema", () => {
  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  describe("ideation_sessions table", () => {
    test("PASS: Table exists after migration", async () => {
      const db = getDb();
      const result = db.exec(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='ideation_sessions'
      `);
      expect(result.length).toBe(1);
      expect(result[0].values[0][0]).toBe("ideation_sessions");
    });

    test("PASS: Can insert valid session", async () => {
      const db = getDb();
      const id = `test_session_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, ?, 'active', 'exploring')
      `,
        [id, "test_profile"],
      );

      const result = db.exec(`SELECT * FROM ideation_sessions WHERE id = ?`, [
        id,
      ]);
      expect(result.length).toBe(1);
    });

    test("FAIL: Rejects invalid status", async () => {
      const db = getDb();
      const id = `test_session_invalid_${Date.now()}`;

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
          VALUES (?, ?, 'invalid_status', 'exploring')
        `,
          [id, "test_profile"],
        );
      }).toThrow();
    });

    test("FAIL: Rejects invalid phase", async () => {
      const db = getDb();
      const id = `test_session_invalid_phase_${Date.now()}`;

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
          VALUES (?, ?, 'active', 'invalid_phase')
        `,
          [id, "test_profile"],
        );
      }).toThrow();
    });
  });

  describe("ideation_messages table", () => {
    test("PASS: Table exists after migration", async () => {
      const db = getDb();
      const result = db.exec(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='ideation_messages'
      `);
      expect(result.length).toBe(1);
    });

    test("PASS: Can insert valid message with JSON fields", async () => {
      const db = getDb();
      const sessionId = `test_session_msg_${Date.now()}`;
      const messageId = `test_message_${Date.now()}`;

      // Create session first
      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, ?, 'active', 'exploring')
      `,
        [sessionId, "test_profile"],
      );

      // Insert message with JSON
      const buttons = JSON.stringify([{ id: "btn1", label: "Option 1" }]);
      db.run(
        `
        INSERT INTO ideation_messages (id, session_id, role, content, buttons_shown)
        VALUES (?, ?, 'assistant', 'Hello', ?)
      `,
        [messageId, sessionId, buttons],
      );

      const result = db.exec(
        `SELECT buttons_shown FROM ideation_messages WHERE id = ?`,
        [messageId],
      );
      expect(JSON.parse(result[0].values[0][0] as string)).toEqual([
        { id: "btn1", label: "Option 1" },
      ]);
    });

    test("PASS: Cascade delete removes messages when session deleted", async () => {
      const db = getDb();
      const sessionId = `test_cascade_${Date.now()}`;
      const messageId = `test_cascade_msg_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, ?, 'active', 'exploring')
      `,
        [sessionId, "test_profile"],
      );

      db.run(
        `
        INSERT INTO ideation_messages (id, session_id, role, content)
        VALUES (?, ?, 'user', 'Test')
      `,
        [messageId, sessionId],
      );

      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);

      const result = db.exec(`SELECT * FROM ideation_messages WHERE id = ?`, [
        messageId,
      ]);
      expect(result.length).toBe(0);
    });
  });

  describe("ideation_candidates table", () => {
    test("PASS: Confidence must be 0-100", async () => {
      const db = getDb();
      const sessionId = `test_session_cand_${Date.now()}`;
      const candidateId = `test_candidate_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, ?, 'active', 'exploring')
      `,
        [sessionId, "test_profile"],
      );

      // Valid confidence
      db.run(
        `
        INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
        VALUES (?, ?, 'Test Idea', 75, 80, 'active')
      `,
        [candidateId, sessionId],
      );

      const result = db.exec(
        `SELECT confidence FROM ideation_candidates WHERE id = ?`,
        [candidateId],
      );
      expect(result[0].values[0][0]).toBe(75);
    });

    test("FAIL: Rejects confidence > 100", async () => {
      const db = getDb();
      const sessionId = `test_session_cand_invalid_${Date.now()}`;
      const candidateId = `test_candidate_invalid_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, ?, 'active', 'exploring')
      `,
        [sessionId, "test_profile"],
      );

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
          VALUES (?, ?, 'Test Idea', 150, 80, 'active')
        `,
          [candidateId, sessionId],
        );
      }).toThrow();
    });

    test("FAIL: Rejects confidence < 0", async () => {
      const db = getDb();
      const sessionId = `test_session_cand_neg_${Date.now()}`;
      const candidateId = `test_candidate_neg_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, ?, 'active', 'exploring')
      `,
        [sessionId, "test_profile"],
      );

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
          VALUES (?, ?, 'Test Idea', -10, 80, 'active')
        `,
          [candidateId, sessionId],
        );
      }).toThrow();
    });
  });

  describe("ideation_viability_risks table", () => {
    test("PASS: Valid risk types accepted", async () => {
      const validTypes = [
        "impossible",
        "unrealistic",
        "too_complex",
        "too_vague",
        "saturated_market",
        "wrong_timing",
        "resource_mismatch",
      ];

      const db = getDb();
      const sessionId = `test_session_risk_${Date.now()}`;
      const candidateId = `test_candidate_risk_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, ?, 'active', 'exploring')
      `,
        [sessionId, "test_profile"],
      );

      db.run(
        `
        INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
        VALUES (?, ?, 'Test', 50, 50, 'active')
      `,
        [candidateId, sessionId],
      );

      for (const riskType of validTypes) {
        const riskId = `risk_${riskType}_${Date.now()}`;
        db.run(
          `
          INSERT INTO ideation_viability_risks (id, candidate_id, risk_type, description, severity)
          VALUES (?, ?, ?, 'Test description', 'medium')
        `,
          [riskId, candidateId, riskType],
        );

        const result = db.exec(
          `SELECT risk_type FROM ideation_viability_risks WHERE id = ?`,
          [riskId],
        );
        expect(result[0].values[0][0]).toBe(riskType);
      }
    });

    test("FAIL: Invalid risk type rejected", async () => {
      const db = getDb();
      const sessionId = `test_session_risk_invalid_${Date.now()}`;
      const candidateId = `test_candidate_risk_invalid_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, ?, 'active', 'exploring')
      `,
        [sessionId, "test_profile"],
      );

      db.run(
        `
        INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
        VALUES (?, ?, 'Test', 50, 50, 'active')
      `,
        [candidateId, sessionId],
      );

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_viability_risks (id, candidate_id, risk_type, description, severity)
          VALUES (?, ?, 'invalid_type', 'Test', 'medium')
        `,
          [`risk_invalid_${Date.now()}`, candidateId],
        );
      }).toThrow();
    });
  });

  describe("ideation_memory table", () => {
    test("PASS: Unique constraint on session_id + file_type", async () => {
      const db = getDb();
      const sessionId = `test_session_mem_${Date.now()}`;
      const memoryId1 = `memory_1_${Date.now()}`;
      const memoryId2 = `memory_2_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, ?, 'active', 'exploring')
      `,
        [sessionId, "test_profile"],
      );

      db.run(
        `
        INSERT INTO ideation_memory (id, session_id, file_type, content)
        VALUES (?, ?, 'self_discovery', '# Self Discovery')
      `,
        [memoryId1, sessionId],
      );

      // Second insert with same file_type should fail
      expect(() => {
        db.run(
          `
          INSERT INTO ideation_memory (id, session_id, file_type, content)
          VALUES (?, ?, 'self_discovery', '# Updated')
        `,
          [memoryId2, sessionId],
        );
      }).toThrow();
    });
  });
});

describe("Row Mappers", () => {
  describe("mapSessionRowToSession", () => {
    test("PASS: Maps all fields correctly", () => {
      const row = {
        id: "session_123",
        profile_id: "profile_456",
        status: "active",
        started_at: "2024-01-01T00:00:00.000Z",
        completed_at: null,
        last_activity_at: "2024-01-01T01:00:00.000Z",
        handoff_count: 0,
        token_count: 1000,
        message_count: 5,
        current_phase: "exploring",
      };

      const session = mapSessionRowToSession(row);

      expect(session.id).toBe("session_123");
      expect(session.profileId).toBe("profile_456");
      expect(session.status).toBe("active");
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.completedAt).toBeNull();
      expect(session.handoffCount).toBe(0);
      expect(session.tokenCount).toBe(1000);
      expect(session.messageCount).toBe(5);
      expect(session.currentPhase).toBe("exploring");
    });

    test("PASS: Handles completed_at when present", () => {
      const row = {
        id: "session_123",
        profile_id: "profile_456",
        status: "completed",
        started_at: "2024-01-01T00:00:00.000Z",
        completed_at: "2024-01-01T02:00:00.000Z",
        last_activity_at: "2024-01-01T02:00:00.000Z",
        handoff_count: 1,
        token_count: 5000,
        message_count: 20,
        current_phase: "refining",
      };

      const session = mapSessionRowToSession(row);

      expect(session.completedAt).toBeInstanceOf(Date);
      expect(session.completedAt?.toISOString()).toBe(
        "2024-01-01T02:00:00.000Z",
      );
    });
  });

  describe("mapMessageRowToMessage", () => {
    test("PASS: Parses JSON fields correctly", () => {
      const row = {
        id: "msg_123",
        session_id: "session_456",
        role: "assistant",
        content: "Hello there",
        buttons_shown: JSON.stringify([
          { id: "btn1", label: "Click me", value: "clicked", style: "primary" },
        ]),
        button_clicked: null,
        form_shown: null,
        form_response: null,
        token_count: 50,
        created_at: "2024-01-01T00:00:00.000Z",
      };

      const message = mapMessageRowToMessage(row);

      expect(message.buttonsShown).toHaveLength(1);
      expect(message.buttonsShown![0].id).toBe("btn1");
      expect(message.formShown).toBeNull();
    });

    test("PASS: Handles null JSON fields", () => {
      const row = {
        id: "msg_123",
        session_id: "session_456",
        role: "user",
        content: "Hello",
        buttons_shown: null,
        button_clicked: null,
        form_shown: null,
        form_response: null,
        token_count: 10,
        created_at: "2024-01-01T00:00:00.000Z",
      };

      const message = mapMessageRowToMessage(row);

      expect(message.buttonsShown).toBeNull();
      expect(message.formShown).toBeNull();
      expect(message.formResponse).toBeNull();
    });
  });

  describe("mapCandidateRowToCandidate", () => {
    test("PASS: Converts SQLite boolean to JavaScript boolean", () => {
      const row = {
        id: "cand_123",
        session_id: "session_456",
        title: "Test Idea",
        summary: "A test idea",
        confidence: 75,
        viability: 80,
        user_suggested: 1, // SQLite true
        status: "active",
        captured_idea_id: null,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T01:00:00.000Z",
      };

      const candidate = mapCandidateRowToCandidate(row);

      expect(candidate.userSuggested).toBe(true);
      expect(typeof candidate.userSuggested).toBe("boolean");
    });

    test("PASS: Handles user_suggested = 0 as false", () => {
      const row = {
        id: "cand_123",
        session_id: "session_456",
        title: "Test Idea",
        summary: null,
        confidence: 50,
        viability: 60,
        user_suggested: 0, // SQLite false
        status: "forming",
        captured_idea_id: null,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      };

      const candidate = mapCandidateRowToCandidate(row);

      expect(candidate.userSuggested).toBe(false);
    });
  });
});

describe("Default State Factories", () => {
  describe("createDefaultSelfDiscoveryState", () => {
    test("PASS: Returns valid empty state", () => {
      const state = createDefaultSelfDiscoveryState();

      expect(state.impactVision.level).toBeNull();
      expect(state.frustrations).toEqual([]);
      expect(state.expertise).toEqual([]);
      expect(state.interests).toEqual([]);
      expect(state.skills.identified).toEqual([]);
      expect(state.skills.gaps).toEqual([]);
      expect(state.skills.strengths).toEqual([]);
      expect(state.constraints.location.fixed).toBe(false);
      expect(state.constraints.timeHoursPerWeek).toBeNull();
    });

    test("PASS: Each call returns new object", () => {
      const state1 = createDefaultSelfDiscoveryState();
      const state2 = createDefaultSelfDiscoveryState();

      expect(state1).not.toBe(state2);
      state1.frustrations.push({
        description: "test",
        source: "user",
        severity: "high",
      });
      expect(state2.frustrations).toHaveLength(0);
    });
  });

  describe("createDefaultMarketDiscoveryState", () => {
    test("PASS: Returns valid empty state", () => {
      const state = createDefaultMarketDiscoveryState();

      expect(state.competitors).toEqual([]);
      expect(state.gaps).toEqual([]);
      expect(state.timingSignals).toEqual([]);
      expect(state.failedAttempts).toEqual([]);
      expect(state.locationContext.city).toBeNull();
    });
  });

  describe("createDefaultNarrowingState", () => {
    test("PASS: Returns valid empty state with zero confidence", () => {
      const state = createDefaultNarrowingState();

      expect(state.productType.value).toBeNull();
      expect(state.productType.confidence).toBe(0);
      expect(state.customerType.value).toBeNull();
      expect(state.geography.value).toBeNull();
      expect(state.hypotheses).toEqual([]);
    });
  });
});
```

---

## 6. Implementation Checklist

- [ ] Create migration file `database/migrations/018_ideation_agent.sql`
- [ ] Create types file `types/ideation.ts`
- [ ] Create mappers file `utils/ideation-mappers.ts`
- [ ] Create defaults file `utils/ideation-defaults.ts`
- [ ] Create test file `tests/ideation/data-models.test.ts`
- [ ] Run migration: `npm run migrate`
- [ ] Run tests: `npm test -- tests/ideation/data-models.test.ts`
- [ ] Verify all tests pass

---

## 7. Success Criteria

| Test Category     | Expected Pass | Expected Fail |
| ----------------- | ------------- | ------------- |
| Schema validation | 8             | 4             |
| Row mappers       | 6             | 0             |
| Default factories | 4             | 0             |
| **Total**         | **18**        | **4**         |

All FAIL tests should fail with appropriate constraint violation errors.
