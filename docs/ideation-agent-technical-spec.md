# Ideation Agent Technical Specification

## Document Purpose

This document provides **complete technical specifications** for developers implementing and testers validating the Ideation Agent system. It covers all systems, algorithms, data models, APIs, state machines, and comprehensive test cases with explicit pass/fail criteria.

**Prerequisites**: Read `guided-ideation-agent-design.md` first for conceptual understanding.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Data Models](#2-data-models)
3. [State Machines](#3-state-machines)
4. [Core Algorithms](#4-core-algorithms)
5. [API Specifications](#5-api-specifications)
6. [Agent System Prompt](#6-agent-system-prompt)
7. [Frontend Components](#7-frontend-components)
8. [Test Specifications](#8-test-specifications)
9. [Error Handling](#9-error-handling)
10. [Performance Requirements](#10-performance-requirements)
11. [Security Considerations](#11-security-considerations)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │  IdeationEntry  │  │ IdeationSession │  │     IdeaCandidate          │ │
│  │    Component    │──│    Component    │──│       Panel                │ │
│  │                 │  │                 │  │                             │ │
│  │ • Entry choice  │  │ • Chat UI       │  │ • Confidence meter         │ │
│  │ • Start guided  │  │ • Button render │  │ • Viability meter          │ │
│  └─────────────────┘  │ • Form render   │  │ • Action buttons           │ │
│                       │ • Message list  │  └─────────────────────────────┘ │
│                       └─────────────────┘                                   │
│                                │                                            │
└────────────────────────────────│────────────────────────────────────────────┘
                                 │ HTTP/WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Node.js)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      IDEATION API ROUTER                            │   │
│  │  /api/ideation/*                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                │                                            │
│         ┌──────────────────────┼──────────────────────┐                    │
│         ▼                      ▼                      ▼                    │
│  ┌─────────────┐    ┌─────────────────────┐   ┌─────────────────────┐     │
│  │  Session    │    │    Agent            │   │   Memory            │     │
│  │  Manager    │    │    Orchestrator     │   │   Manager           │     │
│  │             │    │                     │   │                     │     │
│  │ • Create    │    │ • LLM interaction   │   │ • Read/write MD     │     │
│  │ • Load      │    │ • Response parsing  │   │ • Handoff prep      │     │
│  │ • Update    │    │ • Token counting    │   │ • State restore     │     │
│  │ • Handoff   │    │ • Handoff trigger   │   │                     │     │
│  └─────────────┘    └─────────────────────┘   └─────────────────────┘     │
│         │                      │                      │                    │
│         │           ┌──────────┴──────────┐          │                    │
│         │           ▼                     ▼          │                    │
│         │    ┌─────────────┐     ┌─────────────┐    │                    │
│         │    │  Confidence │     │  Viability  │    │                    │
│         │    │  Calculator │     │  Calculator │    │                    │
│         │    └─────────────┘     └─────────────┘    │                    │
│         │                                            │                    │
│         └────────────────────┬───────────────────────┘                    │
│                              ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      WEB SEARCH SERVICE                             │   │
│  │  • Market research    • Competitor analysis   • Trend validation    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                             │
└──────────────────────────────│─────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   SQLite DB     │  │  Memory Files   │  │    External Services       │ │
│  │                 │  │   (Markdown)    │  │                             │ │
│  │ • Sessions      │  │                 │  │ • Claude Code CLI          │ │
│  │ • Candidates    │  │ • self_disc.md  │  │   (100k ctx, WebSearch)    │ │
│  │ • Risks         │  │ • market.md     │  │ • User Profile Service     │ │
│  │ • Searches      │  │ • handoff.md    │  │                             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility | Key Methods |
|-----------|----------------|-------------|
| **SessionManager** | CRUD for ideation sessions, state tracking | `create()`, `load()`, `update()`, `handoff()` |
| **AgentOrchestrator** | Claude Code CLI communication, response handling | `sendMessage()`, `parseResponse()`, `checkHandoff()` |
| **MemoryManager** | Markdown file operations for memory | `writeMemory()`, `readMemory()`, `prepareHandoff()` |
| **ConfidenceCalculator** | Compute confidence score from signals | `calculate()`, `extractSignals()` |
| **ViabilityCalculator** | Compute viability from evidence | `calculate()`, `detectRisks()`, `checkThreshold()` |
| **WebSearchService** | Web search via Claude Code CLI tools | `search()`, `parseResults()`, `cacheResults()` |

### 1.3 Claude Code CLI Integration

This system uses the existing Claude Code CLI integration pattern from `utils/anthropic-client.ts`.

```typescript
// Import the shared client (handles API key vs CLI auth automatically)
import { client, runClaudeCliWithPrompt } from '../utils/anthropic-client.js';
import { getConfig } from '../config/index.js';

// For standard agent conversations: use client.messages.create()
const response = await client.messages.create({
  model: getConfig().model,  // Uses config model (sonnet/opus/haiku)
  max_tokens: 4096,
  system: IDEATION_AGENT_SYSTEM_PROMPT,
  messages: conversationHistory,
});

// For web search: use runClaudeCliWithPrompt() with tools enabled
const searchResults = await runClaudeCliWithPrompt(
  `Search for market data on: ${query}\n\nReturn as JSON array.`,
  {
    model: 'sonnet',
    tools: ['WebSearch'],  // Enables Claude Code's WebSearch tool
    maxTokens: 2000,
  }
);

// Parse JSON from response (LLM may include preamble)
const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  // Handle text-only fallback
}
const parsed = JSON.parse(jsonMatch[0]);
```

**Key patterns from existing codebase:**
- `client.messages.create()` for structured conversations (see `agents/development.ts`)
- `runClaudeCliWithPrompt()` with `tools: ['WebSearch']` for market research (see `agents/research.ts`)
- JSON extraction via regex: `response.match(/\{[\s\S]*\}/)` for robust parsing
- Cost tracking via `CostTracker` class

### 1.4 Data Flow: User Message → Agent Response

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE PROCESSING FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

1. USER INPUT
   │
   ▼
2. POST /api/ideation/message
   │  Body: { sessionId, message }
   │
   ▼
3. SessionManager.load(sessionId)
   │  → Loads session state, memory files, conversation history
   │
   ▼
4. TokenCounter.check(session)
   │  → If tokens > 80k: trigger handoff preparation
   │
   ▼
5. AgentOrchestrator.buildContext()
   │  → Assembles: system prompt + profile + memory + conversation + message
   │
   ▼
6. Claude Code CLI Call (100k context)
   │  → Uses client.messages.create() or runClaudeCliWithPrompt()
   │  → Receives: { text, structured_output }
   │
   ▼
7. ResponseParser.parse(response)
   │  → Extracts: reply text, buttons, forms, signals
   │
   ▼
8. SignalExtractor.extract(response, conversation)
   │  → Identifies: self-discovery signals, market signals, narrowing signals
   │
   ▼
9. ConfidenceCalculator.calculate(signals)
   │  → Returns: confidence score (0-100)
   │
   ▼
10. ViabilityCalculator.calculate(signals, webSearchResults)
    │  → Returns: viability score (0-100), risks[]
    │
    ▼
11. IdeaCandidateManager.update()
    │  → If confidence > 30: create/update candidate
    │  → If viability < 50: flag intervention needed
    │
    ▼
12. MemoryManager.updateMemory()
    │  → Updates relevant memory files
    │
    ▼
13. SessionManager.save()
    │  → Persists updated state
    │
    ▼
14. Response to Frontend
    │  { reply, buttons?, formFields?, ideaCandidate?, intervention? }
    │
    ▼
15. UI UPDATE
```

---

## 2. Data Models

### 2.1 Database Schema (Complete)

```sql
-- ============================================================================
-- IDEATION SESSION TABLES
-- ============================================================================

-- Core session tracking
CREATE TABLE ideation_sessions (
  id TEXT PRIMARY KEY,                                    -- UUID
  profile_id TEXT REFERENCES user_profiles(id),           -- Link to user profile
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
CREATE TABLE ideation_messages (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  buttons_shown TEXT,                                     -- JSON array of buttons shown
  button_clicked TEXT,                                    -- Button ID if clicked
  form_shown TEXT,                                        -- JSON of form if shown
  form_response TEXT,                                     -- JSON of form response
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Memory file storage
CREATE TABLE ideation_memory (
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
CREATE TABLE ideation_candidates (
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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Viability risk tracking
CREATE TABLE ideation_viability_risks (
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
CREATE TABLE ideation_searches (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results TEXT NOT NULL,                                  -- JSON array of results
  result_count INTEGER NOT NULL DEFAULT 0,
  purpose TEXT,                                           -- Why search was performed
  searched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Signal extraction log (for debugging and improvement)
CREATE TABLE ideation_signals (
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
CREATE INDEX idx_ideation_sessions_profile ON ideation_sessions(profile_id);
CREATE INDEX idx_ideation_sessions_status ON ideation_sessions(status);
CREATE INDEX idx_ideation_messages_session ON ideation_messages(session_id);
CREATE INDEX idx_ideation_memory_session ON ideation_memory(session_id);
CREATE INDEX idx_ideation_candidates_session ON ideation_candidates(session_id);
CREATE INDEX idx_ideation_risks_candidate ON ideation_viability_risks(candidate_id);
CREATE INDEX idx_ideation_searches_session ON ideation_searches(session_id);
CREATE INDEX idx_ideation_signals_session ON ideation_signals(session_id);
```

### 2.2 TypeScript Interfaces (Complete)

```typescript
// ============================================================================
// CORE TYPES
// ============================================================================

export type SessionStatus = 'active' | 'completed' | 'abandoned';
export type SessionPhase = 'exploring' | 'narrowing' | 'validating' | 'refining';
export type CandidateStatus = 'forming' | 'active' | 'captured' | 'discarded' | 'saved';
export type RiskType =
  | 'impossible'
  | 'unrealistic'
  | 'too_complex'
  | 'too_vague'
  | 'saturated_market'
  | 'wrong_timing'
  | 'resource_mismatch';
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type MessageRole = 'user' | 'assistant' | 'system';
export type SignalType = 'self_discovery' | 'market_discovery' | 'narrowing' | 'confidence' | 'viability';
export type ButtonStyle = 'primary' | 'secondary' | 'outline' | 'danger';

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface IdeationSession {
  id: string;
  profileId: string;
  status: SessionStatus;
  startedAt: Date;
  completedAt: Date | null;
  lastActivityAt: Date;
  handoffCount: number;
  tokenCount: number;
  messageCount: number;
  currentPhase: SessionPhase;
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
  tokenCount: number;
  createdAt: Date;
}

// ============================================================================
// CANDIDATE & RISK TYPES
// ============================================================================

export interface IdeaCandidate {
  id: string;
  sessionId: string;
  title: string;
  summary: string | null;
  confidence: number;  // 0-100
  viability: number;   // 0-100
  userSuggested: boolean;
  status: CandidateStatus;
  capturedIdeaId: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'slider' | 'dropdown' | 'date';
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
// AGENT RESPONSE TYPES
// ============================================================================

export interface AgentResponse {
  text: string;
  buttons?: ButtonOption[];
  form?: FormDefinition;
  internalSignals?: ExtractedSignal[];
  webSearchTriggered?: boolean;
  webSearchQueries?: string[];
}

export interface ParsedAgentResponse {
  reply: string;
  buttons: ButtonOption[] | null;
  formFields: FormDefinition | null;
  ideaCandidate: IdeaCandidateUpdate | null;
  intervention: ViabilityIntervention | null;
  signals: ExtractedSignal[];
}

export interface IdeaCandidateUpdate {
  title: string;
  summary?: string;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  isNew: boolean;
}

export interface ViabilityIntervention {
  type: 'warning' | 'critical';
  message: string;
  risks: ViabilityRisk[];
  options: ButtonOption[];
}

// ============================================================================
// SIGNAL EXTRACTION TYPES
// ============================================================================

export interface ExtractedSignal {
  type: SignalType;
  key: string;
  value: string;
  confidence: number;  // 0.0-1.0
  source: 'user_message' | 'agent_inference' | 'web_search';
  messageId?: string;
}

export interface SelfDiscoveryState {
  impactVision: {
    level: 'world' | 'country' | 'city' | 'community' | null;
    description: string | null;
    confidence: number;
  };
  frustrations: Array<{
    description: string;
    source: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  expertise: Array<{
    area: string;
    depth: 'expert' | 'competent' | 'novice';
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
    capital: 'bootstrap' | 'seeking_funding' | null;
    riskTolerance: 'low' | 'medium' | 'high' | null;
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
    relevance: 'high' | 'medium' | 'low';
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
// MEMORY FILE TYPES
// ============================================================================

export type MemoryFileType =
  | 'self_discovery'
  | 'market_discovery'
  | 'narrowing_state'
  | 'conversation_summary'
  | 'idea_candidate'
  | 'viability_assessment'
  | 'handoff_notes';

export interface MemoryFile {
  id: string;
  sessionId: string;
  fileType: MemoryFileType;
  content: string;  // Markdown
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HandoffPackage {
  sessionSummary: string;
  currentState: {
    ideaCandidate: IdeaCandidate | null;
    confidence: number;
    viability: number;
    phase: SessionPhase;
  };
  immediateNextSteps: string[];
  userRapport: {
    communicationStyle: 'verbose' | 'terse' | 'analytical' | 'emotional';
    engagementLevel: 'high' | 'medium' | 'low';
    topicsThatEnergize: string[];
    topicsToAvoid: string[];
  };
  userSuggestedIdeas: Array<{
    idea: string;
    status: 'exploring' | 'validated' | 'flagged';
  }>;
  criticalContext: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// POST /api/ideation/start
export interface StartSessionRequest {
  profileId: string;
}

export interface StartSessionResponse {
  sessionId: string;
  greeting: string;
  buttons?: ButtonOption[];
}

// POST /api/ideation/message
export interface SendMessageRequest {
  sessionId: string;
  message: string;
}

export interface SendMessageResponse {
  reply: string;
  ideaCandidate: {
    id: string;
    title: string;
    confidence: number;
    viability: number;
    risks: ViabilityRisk[];
  } | null;
  buttons: ButtonOption[] | null;
  formFields: FormDefinition | null;
  intervention: ViabilityIntervention | null;
  handoffOccurred: boolean;
}

// POST /api/ideation/button
export interface ButtonClickRequest {
  sessionId: string;
  buttonId: string;
  buttonValue: string;
}

export interface ButtonClickResponse extends SendMessageResponse {}

// POST /api/ideation/form
export interface FormSubmitRequest {
  sessionId: string;
  formId: string;
  answers: Record<string, unknown>;
}

export interface FormSubmitResponse extends SendMessageResponse {}

// POST /api/ideation/capture
export interface CaptureIdeaRequest {
  sessionId: string;
}

export interface CaptureIdeaResponse {
  ideaId: string;
  ideaSlug: string;
  prePopulatedFields: {
    title: string;
    type: string;
    overview: string;
    problemStatement: string;
    targetUsers: string[];
    proposedSolution: string;
  };
  ideationMetadata: {
    sessionId: string;
    confidenceAtCapture: number;
    viabilityAtCapture: number;
    viabilityRisks: ViabilityRisk[];
  };
}

// POST /api/ideation/save
export interface SaveForLaterRequest {
  sessionId: string;
}

export interface SaveForLaterResponse {
  savedCandidateId: string;
  message: string;
}

// POST /api/ideation/discard
export interface DiscardAndRestartRequest {
  sessionId: string;
}

export interface DiscardAndRestartResponse {
  newSessionId: string;
  greeting: string;
}

// Internal: Web search
export interface WebSearchRequest {
  sessionId: string;
  query: string;
  purpose: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  resultCount: number;
}
```

---

## 3. State Machines

### 3.1 Session State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SESSION STATE MACHINE                               │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │   CREATED    │
                              │              │
                              │ Entry:       │
                              │ • Load profile│
                              │ • Init memory │
                              └──────┬───────┘
                                     │
                                     │ [Start session]
                                     ▼
                              ┌──────────────┐
                      ┌──────▶│   ACTIVE     │◀──────┐
                      │       │              │       │
                      │       │ Entry:       │       │
                      │       │ • Accept msg │       │
                      │       │ • Process    │       │
                      │       │ • Respond    │       │
                      │       └──────┬───────┘       │
                      │              │               │
          [Handoff]   │              │               │ [Continue after
          complete    │              │               │  intervention]
                      │    ┌─────────┼─────────┐     │
                      │    │         │         │     │
                      │    ▼         ▼         ▼     │
               ┌──────────────┐ ┌────────┐ ┌────────────┐
               │  HANDOFF_    │ │CAPTURE │ │ INTERVENTION│
               │  PREPARING   │ │PENDING │ │   ACTIVE   │
               │              │ │        │ │            │
               │ Entry:       │ │ User   │ │ Viability  │
               │ • Gen memory │ │ clicked│ │ < 50%      │
               │ • Prep notes │ │ capture│ │ Show risks │
               └──────┬───────┘ └───┬────┘ └─────┬──────┘
                      │             │            │
                      │             │            │ [User chooses]
                      ▼             │            │
               ┌──────────────┐     │    ┌───────┴───────┐
               │   HANDOFF    │     │    │               │
               │   COMPLETE   │     │ ┌──┴───┐    ┌──────┴─────┐
               │              │     │ │Pivot │    │ Continue   │
               │ New agent    │     │ │      │    │ anyway     │────┘
               │ takes over   │     │ └──┬───┘    └────────────┘
               └──────────────┘     │    │
                      │             │    │ [New direction]
                      └─────────────┤    │
                                    │    ▼
                              ┌─────┴────────┐
                              │  COMPLETED   │
                              │              │
                              │ Idea captured│
                              │ or saved     │
                              └──────────────┘
                                    │
                      ┌─────────────┤
                      │             │
                      ▼             ▼
               ┌──────────────┐ ┌──────────────┐
               │  ABANDONED   │ │   SAVED      │
               │              │ │              │
               │ User exited  │ │ Idea saved   │
               │ without      │ │ for later    │
               │ completing   │ │              │
               └──────────────┘ └──────────────┘
```

### 3.2 Candidate State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CANDIDATE STATE MACHINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │    NULL      │
                              │              │
                              │ No candidate │
                              │ exists yet   │
                              └──────┬───────┘
                                     │
                                     │ [Confidence > 30%]
                                     ▼
                              ┌──────────────┐
                              │   FORMING    │
                              │              │
                              │ Confidence:  │
                              │ 31-50%       │
                              │              │
                              │ UI: Shows    │
                              │ "brewing..." │
                              └──────┬───────┘
                                     │
                                     │ [Confidence > 50%]
                                     ▼
                              ┌──────────────┐
                      ┌──────▶│   ACTIVE     │◀──────┐
                      │       │              │       │
                      │       │ Confidence:  │       │
                      │       │ 51-100%      │       │
                      │       │              │       │
                      │       │ UI: Shows    │       │
                      │       │ title, meters│       │
                      │       │ action btns  │       │
                      │       └──────┬───────┘       │
                      │              │               │
        [Continue     │    ┌─────────┼─────────┐     │ [Pivot after
         refining]    │    │         │         │     │  intervention]
                      │    ▼         ▼         ▼     │
               ┌──────────────┐ ┌────────┐ ┌────────────┐
               │   CAPTURED   │ │ SAVED  │ │ DISCARDED  │
               │              │ │        │ │            │
               │ Exported to  │ │ In     │ │ User       │
               │ Ideas list   │ │ Ideas  │ │ rejected   │
               │ as new idea  │ │ list   │ │            │
               └──────────────┘ └────────┘ └────────────┘
                     │              │             │
                     │              │             │
                     ▼              ▼             └────────────┐
               [Session ends] [Session ends]                   │
                                                               │
                                              ┌────────────────▼───┐
                                              │   NEW CANDIDATE    │
                                              │                    │
                                              │ Start fresh with   │
                                              │ new exploration    │
                                              └────────────────────┘
```

### 3.3 Viability State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VIABILITY STATE MACHINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │   HEALTHY    │
                              │              │
                              │ Viability:   │
                              │ 75-100%      │
                              │              │
                              │ No UI alert  │
                              └──────┬───────┘
                                     │
                                     │ [Web search finds concerns]
                                     │ [OR resource mismatch detected]
                                     ▼
                              ┌──────────────┐
                              │   CAUTION    │
                              │              │
                              │ Viability:   │
                              │ 50-74%       │
                              │              │
                              │ Agent        │
                              │ mentions     │
                              │ concerns     │
                              └──────┬───────┘
                                     │
                                     │ [More risks found]
                                     │ [OR critical risk identified]
                                     ▼
                              ┌──────────────┐
                              │   WARNING    │
                              │              │
                              │ Viability:   │
                              │ 25-49%       │
                              │              │
                              │ Agent pauses │
                              │ for explicit │
                              │ intervention │
                              └──────┬───────┘
                                     │
                                     │ [Impossible/unrealistic detected]
                                     ▼
                              ┌──────────────┐
                              │   CRITICAL   │
                              │              │
                              │ Viability:   │
                              │ 0-24%        │
                              │              │
                              │ Must address │
                              │ before       │
                              │ continuing   │
                              └──────────────┘

TRANSITIONS BACK TO HEALTHY:
- User addresses concerns
- Pivot resolves issues
- Additional info changes assessment
```

---

## 4. Core Algorithms

### 4.1 Confidence Calculation Algorithm

```typescript
/**
 * CONFIDENCE CALCULATION
 *
 * Confidence measures how well-defined the idea is, not how good it is.
 * Range: 0-100
 * Threshold for display: 30%
 * Threshold for "ready": 75%
 */

interface ConfidenceInput {
  selfDiscovery: SelfDiscoveryState;
  marketDiscovery: MarketDiscoveryState;
  narrowingState: NarrowingState;
  candidate: Partial<IdeaCandidate>;
  userConfirmations: number;  // Times user expressed resonance
}

interface ConfidenceBreakdown {
  total: number;
  components: {
    problemDefinition: number;   // 0-25 points
    targetUser: number;          // 0-20 points
    solutionDirection: number;   // 0-20 points
    differentiation: number;     // 0-20 points
    userFit: number;             // 0-15 points
  };
  missingAreas: string[];
}

function calculateConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const breakdown: ConfidenceBreakdown = {
    total: 0,
    components: {
      problemDefinition: 0,
      targetUser: 0,
      solutionDirection: 0,
      differentiation: 0,
      userFit: 0,
    },
    missingAreas: [],
  };

  // ============================================================================
  // PROBLEM DEFINITION (0-25 points)
  // ============================================================================
  let problemScore = 0;

  // Has frustration with specifics? (+10)
  if (input.selfDiscovery.frustrations.length > 0) {
    const highSeverity = input.selfDiscovery.frustrations.filter(f => f.severity === 'high');
    if (highSeverity.length > 0) {
      problemScore += 10;
    } else {
      problemScore += 5;
    }
  } else {
    breakdown.missingAreas.push('specific problem or frustration');
  }

  // Market validates problem? (+10)
  if (input.marketDiscovery.gaps.length > 0) {
    const highRelevance = input.marketDiscovery.gaps.filter(g => g.relevance === 'high');
    if (highRelevance.length > 0) {
      problemScore += 10;
    } else {
      problemScore += 5;
    }
  } else {
    breakdown.missingAreas.push('market-validated problem');
  }

  // Clear problem statement in candidate? (+5)
  if (input.candidate.summary && input.candidate.summary.length > 50) {
    problemScore += 5;
  }

  breakdown.components.problemDefinition = Math.min(25, problemScore);

  // ============================================================================
  // TARGET USER (0-20 points)
  // ============================================================================
  let targetScore = 0;

  // Has narrowed customer type? (+10)
  if (input.narrowingState.customerType.value) {
    if (input.narrowingState.customerType.confidence > 0.7) {
      targetScore += 10;
    } else {
      targetScore += 5;
    }
  } else {
    breakdown.missingAreas.push('clear target customer type');
  }

  // Location context established? (+5)
  if (input.marketDiscovery.locationContext.city) {
    targetScore += 5;
  }

  // Geography narrowed? (+5)
  if (input.narrowingState.geography.value) {
    targetScore += 5;
  }

  breakdown.components.targetUser = Math.min(20, targetScore);

  // ============================================================================
  // SOLUTION DIRECTION (0-20 points)
  // ============================================================================
  let solutionScore = 0;

  // Has product type narrowed? (+7)
  if (input.narrowingState.productType.value) {
    solutionScore += 7;
  } else {
    breakdown.missingAreas.push('product type (digital/physical/service)');
  }

  // Has technical depth assessed? (+7)
  if (input.narrowingState.technicalDepth.value) {
    solutionScore += 7;
  }

  // Has title (indicates concrete direction)? (+6)
  if (input.candidate.title && input.candidate.title.length > 5) {
    solutionScore += 6;
  } else {
    breakdown.missingAreas.push('concrete solution direction');
  }

  breakdown.components.solutionDirection = Math.min(20, solutionScore);

  // ============================================================================
  // DIFFERENTIATION (0-20 points)
  // ============================================================================
  let diffScore = 0;

  // Competitors identified? (+8)
  if (input.marketDiscovery.competitors.length > 0) {
    diffScore += 8;
  } else {
    breakdown.missingAreas.push('competitor awareness');
  }

  // Gaps or weaknesses in competitors found? (+7)
  const hasCompetitorWeaknesses = input.marketDiscovery.competitors.some(c => c.weaknesses.length > 0);
  if (hasCompetitorWeaknesses) {
    diffScore += 7;
  }

  // User expertise aligns with gap? (+5)
  const expertiseAreas = input.selfDiscovery.expertise.map(e => e.area.toLowerCase());
  const hasExpertiseMatch = input.marketDiscovery.gaps.some(g =>
    expertiseAreas.some(e => g.description.toLowerCase().includes(e))
  );
  if (hasExpertiseMatch) {
    diffScore += 5;
  }

  breakdown.components.differentiation = Math.min(20, diffScore);

  // ============================================================================
  // USER FIT (0-15 points)
  // ============================================================================
  let fitScore = 0;

  // Skills match product type? (+5)
  if (input.selfDiscovery.skills.strengths.length > 0) {
    fitScore += 5;
  }

  // Constraints compatible? (+5)
  const hasConstraintsSet =
    input.selfDiscovery.constraints.location.target !== null ||
    input.selfDiscovery.constraints.timeHoursPerWeek !== null;
  if (hasConstraintsSet) {
    fitScore += 5;
  }

  // User confirmed resonance? (+5)
  if (input.userConfirmations > 0) {
    fitScore += Math.min(5, input.userConfirmations * 2);
  }

  breakdown.components.userFit = Math.min(15, fitScore);

  // ============================================================================
  // TOTAL
  // ============================================================================
  breakdown.total =
    breakdown.components.problemDefinition +
    breakdown.components.targetUser +
    breakdown.components.solutionDirection +
    breakdown.components.differentiation +
    breakdown.components.userFit;

  return breakdown;
}
```

### 4.2 Viability Calculation Algorithm

```typescript
/**
 * VIABILITY CALCULATION
 *
 * Viability measures whether the idea is realistic and achievable.
 * Based on HARD EVIDENCE from web search.
 * Range: 0-100
 * Healthy: 75-100%
 * Caution: 50-74%
 * Warning: 25-49%
 * Critical: 0-24%
 */

interface ViabilityInput {
  selfDiscovery: SelfDiscoveryState;
  marketDiscovery: MarketDiscoveryState;
  narrowingState: NarrowingState;
  webSearchResults: WebSearchResult[];
  candidate: Partial<IdeaCandidate>;
}

interface ViabilityBreakdown {
  total: number;
  components: {
    marketExists: number;           // 0-25 points
    technicalFeasibility: number;   // 0-20 points
    competitiveSpace: number;       // 0-20 points
    resourceReality: number;        // 0-20 points
    clarityScore: number;           // 0-15 points
  };
  risks: ViabilityRisk[];
  requiresIntervention: boolean;
}

function calculateViability(input: ViabilityInput): ViabilityBreakdown {
  const breakdown: ViabilityBreakdown = {
    total: 100,  // Start at 100, subtract for issues
    components: {
      marketExists: 25,
      technicalFeasibility: 20,
      competitiveSpace: 20,
      resourceReality: 20,
      clarityScore: 15,
    },
    risks: [],
    requiresIntervention: false,
  };

  // ============================================================================
  // MARKET EXISTS (0-25 points, start at 25)
  // ============================================================================

  // No market data found? (-15)
  if (input.marketDiscovery.competitors.length === 0 &&
      input.marketDiscovery.gaps.length === 0) {
    breakdown.components.marketExists -= 15;
    breakdown.risks.push({
      id: generateId(),
      candidateId: input.candidate.id || '',
      riskType: 'too_vague',
      description: 'No market data found - market may not exist or idea is too vague',
      evidenceUrl: null,
      evidenceText: 'Web search returned no relevant competitors or market gaps',
      severity: 'high',
      userAcknowledged: false,
      userResponse: null,
      createdAt: new Date(),
    });
  }

  // Failed attempts with no clear differentiation? (-10)
  const hasFailedAttempts = input.marketDiscovery.failedAttempts.length > 0;
  const hasClearDifferentiation = input.marketDiscovery.gaps.some(g => g.relevance === 'high');
  if (hasFailedAttempts && !hasClearDifferentiation) {
    breakdown.components.marketExists -= 10;
    breakdown.risks.push({
      id: generateId(),
      candidateId: input.candidate.id || '',
      riskType: 'wrong_timing',
      description: `Similar attempts have failed: ${input.marketDiscovery.failedAttempts[0].what}`,
      evidenceUrl: input.marketDiscovery.failedAttempts[0].source,
      evidenceText: input.marketDiscovery.failedAttempts[0].why,
      severity: 'medium',
      userAcknowledged: false,
      userResponse: null,
      createdAt: new Date(),
    });
  }

  // ============================================================================
  // TECHNICAL FEASIBILITY (0-20 points, start at 20)
  // ============================================================================

  // Check for impossible technology requirements
  const impossibleKeywords = [
    'does not exist',
    'impossible',
    'no solution',
    'years away',
    'not technically feasible',
  ];

  for (const result of input.webSearchResults) {
    const snippetLower = result.snippet.toLowerCase();
    if (impossibleKeywords.some(kw => snippetLower.includes(kw))) {
      breakdown.components.technicalFeasibility -= 15;
      breakdown.risks.push({
        id: generateId(),
        candidateId: input.candidate.id || '',
        riskType: 'impossible',
        description: 'Technology may not exist or be feasible',
        evidenceUrl: result.url,
        evidenceText: result.snippet,
        severity: 'critical',
        userAcknowledged: false,
        userResponse: null,
        createdAt: new Date(),
      });
      break;
    }
  }

  // Skills gap detected? (-10)
  if (input.selfDiscovery.skills.gaps.length > 2) {
    breakdown.components.technicalFeasibility -= 10;
    breakdown.risks.push({
      id: generateId(),
      candidateId: input.candidate.id || '',
      riskType: 'resource_mismatch',
      description: `Multiple skill gaps identified: ${input.selfDiscovery.skills.gaps.join(', ')}`,
      evidenceUrl: null,
      evidenceText: 'Based on skill assessment during conversation',
      severity: 'medium',
      userAcknowledged: false,
      userResponse: null,
      createdAt: new Date(),
    });
  }

  // ============================================================================
  // COMPETITIVE SPACE (0-20 points, start at 20)
  // ============================================================================

  // More than 10 well-funded competitors? (-15)
  if (input.marketDiscovery.competitors.length > 10) {
    breakdown.components.competitiveSpace -= 15;
    breakdown.risks.push({
      id: generateId(),
      candidateId: input.candidate.id || '',
      riskType: 'saturated_market',
      description: `Highly competitive market with ${input.marketDiscovery.competitors.length}+ competitors`,
      evidenceUrl: null,
      evidenceText: `Competitors include: ${input.marketDiscovery.competitors.slice(0, 5).map(c => c.name).join(', ')}`,
      severity: 'high',
      userAcknowledged: false,
      userResponse: null,
      createdAt: new Date(),
    });
  }
  // 5-10 competitors without clear gap? (-10)
  else if (input.marketDiscovery.competitors.length > 5 &&
           input.marketDiscovery.gaps.filter(g => g.relevance === 'high').length === 0) {
    breakdown.components.competitiveSpace -= 10;
  }

  // ============================================================================
  // RESOURCE REALITY (0-20 points, start at 20)
  // ============================================================================

  // Check for resource requirements in search results
  const highCapitalKeywords = ['million', 'funding required', 'venture capital', 'significant investment'];
  for (const result of input.webSearchResults) {
    const snippetLower = result.snippet.toLowerCase();
    if (highCapitalKeywords.some(kw => snippetLower.includes(kw))) {
      if (input.selfDiscovery.constraints.capital === 'bootstrap') {
        breakdown.components.resourceReality -= 15;
        breakdown.risks.push({
          id: generateId(),
          candidateId: input.candidate.id || '',
          riskType: 'unrealistic',
          description: 'Market typically requires significant capital investment',
          evidenceUrl: result.url,
          evidenceText: result.snippet,
          severity: 'high',
          userAcknowledged: false,
          userResponse: null,
          createdAt: new Date(),
        });
        break;
      }
    }
  }

  // Time constraints vs complexity mismatch? (-10)
  if (input.selfDiscovery.constraints.timeHoursPerWeek !== null &&
      input.selfDiscovery.constraints.timeHoursPerWeek < 10 &&
      input.narrowingState.technicalDepth.value === 'full_custom') {
    breakdown.components.resourceReality -= 10;
    breakdown.risks.push({
      id: generateId(),
      candidateId: input.candidate.id || '',
      riskType: 'resource_mismatch',
      description: 'Limited time availability vs complex technical requirements',
      evidenceUrl: null,
      evidenceText: `${input.selfDiscovery.constraints.timeHoursPerWeek} hours/week for custom development`,
      severity: 'medium',
      userAcknowledged: false,
      userResponse: null,
      createdAt: new Date(),
    });
  }

  // ============================================================================
  // CLARITY SCORE (0-15 points, start at 15)
  // ============================================================================

  // Can't define target user? (-10)
  if (!input.narrowingState.customerType.value) {
    breakdown.components.clarityScore -= 10;
    breakdown.risks.push({
      id: generateId(),
      candidateId: input.candidate.id || '',
      riskType: 'too_vague',
      description: 'Target customer not clearly defined',
      evidenceUrl: null,
      evidenceText: 'Cannot validate market without clear target user',
      severity: 'medium',
      userAcknowledged: false,
      userResponse: null,
      createdAt: new Date(),
    });
  }

  // Can't define solution direction? (-5)
  if (!input.narrowingState.productType.value) {
    breakdown.components.clarityScore -= 5;
  }

  // ============================================================================
  // TOTAL & INTERVENTION CHECK
  // ============================================================================

  breakdown.components.marketExists = Math.max(0, breakdown.components.marketExists);
  breakdown.components.technicalFeasibility = Math.max(0, breakdown.components.technicalFeasibility);
  breakdown.components.competitiveSpace = Math.max(0, breakdown.components.competitiveSpace);
  breakdown.components.resourceReality = Math.max(0, breakdown.components.resourceReality);
  breakdown.components.clarityScore = Math.max(0, breakdown.components.clarityScore);

  breakdown.total =
    breakdown.components.marketExists +
    breakdown.components.technicalFeasibility +
    breakdown.components.competitiveSpace +
    breakdown.components.resourceReality +
    breakdown.components.clarityScore;

  // Intervention required if any critical risk OR total < 50
  breakdown.requiresIntervention =
    breakdown.total < 50 ||
    breakdown.risks.some(r => r.severity === 'critical');

  return breakdown;
}

function generateId(): string {
  return `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

### 4.3 Token Counting & Handoff Algorithm

```typescript
/**
 * TOKEN COUNTING & HANDOFF
 *
 * Context limit: 100,000 tokens
 * Handoff trigger: 80,000 tokens (80%)
 */

const CONTEXT_LIMIT = 100_000;
const HANDOFF_THRESHOLD = 80_000;
const SYSTEM_PROMPT_ESTIMATE = 5_000;
const PROFILE_ESTIMATE = 2_000;
const MEMORY_FILES_ESTIMATE = 10_000;

interface TokenUsage {
  systemPrompt: number;
  profile: number;
  memoryFiles: number;
  conversation: number;
  currentMessage: number;
  total: number;
  percentUsed: number;
  shouldHandoff: boolean;
}

function calculateTokenUsage(
  conversationHistory: IdeationMessage[],
  currentMessage: string
): TokenUsage {
  // Simple estimation: ~4 chars per token for English
  const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

  const conversationTokens = conversationHistory.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );
  const currentMessageTokens = estimateTokens(currentMessage);

  const total =
    SYSTEM_PROMPT_ESTIMATE +
    PROFILE_ESTIMATE +
    MEMORY_FILES_ESTIMATE +
    conversationTokens +
    currentMessageTokens;

  return {
    systemPrompt: SYSTEM_PROMPT_ESTIMATE,
    profile: PROFILE_ESTIMATE,
    memoryFiles: MEMORY_FILES_ESTIMATE,
    conversation: conversationTokens,
    currentMessage: currentMessageTokens,
    total,
    percentUsed: (total / CONTEXT_LIMIT) * 100,
    shouldHandoff: total >= HANDOFF_THRESHOLD,
  };
}

interface HandoffPreparation {
  memoryFiles: {
    selfDiscovery: string;
    marketDiscovery: string;
    narrowingState: string;
    conversationSummary: string;
    ideaCandidate: string;
    viabilityAssessment: string;
    handoffNotes: string;
  };
  resumptionMessage: string;
}

async function prepareHandoff(
  session: IdeationSession,
  conversationHistory: IdeationMessage[],
  currentState: {
    selfDiscovery: SelfDiscoveryState;
    marketDiscovery: MarketDiscoveryState;
    narrowingState: NarrowingState;
    candidate: IdeaCandidate | null;
    confidence: number;
    viability: number;
  }
): Promise<HandoffPreparation> {
  // Generate conversation summary (use LLM for this)
  const conversationSummary = await generateConversationSummary(conversationHistory);

  // Generate memory files
  const memoryFiles = {
    selfDiscovery: formatSelfDiscoveryMarkdown(currentState.selfDiscovery),
    marketDiscovery: formatMarketDiscoveryMarkdown(currentState.marketDiscovery),
    narrowingState: formatNarrowingStateMarkdown(currentState.narrowingState),
    conversationSummary,
    ideaCandidate: currentState.candidate
      ? formatCandidateMarkdown(currentState.candidate)
      : '# No Candidate Yet\n\nNo idea candidate has formed.',
    viabilityAssessment: formatViabilityMarkdown(currentState.viability),
    handoffNotes: generateHandoffNotes(session, currentState, conversationHistory),
  };

  // Message to continue conversation naturally
  const lastUserMessage = conversationHistory
    .filter(m => m.role === 'user')
    .pop();

  const resumptionMessage = `Let me take a moment to organize my thoughts on everything we've discussed...

Alright, I've got it all mapped out. ${
  lastUserMessage
    ? `You were telling me about ${extractLastTopic(lastUserMessage.content)}...`
    : 'Where would you like to continue?'
}`;

  return { memoryFiles, resumptionMessage };
}

function generateHandoffNotes(
  session: IdeationSession,
  state: any,
  history: IdeationMessage[]
): string {
  const lastUserMessages = history
    .filter(m => m.role === 'user')
    .slice(-5)
    .map(m => m.content);

  return `# Agent Handoff Notes

## Session Summary
Session ${session.id} has been exploring ${state.candidate?.title || 'ideas'}
with the user. Current phase: ${session.currentPhase}.

${generateBriefSummary(history)}

## Current State
- Idea candidate: ${state.candidate ? 'Yes' : 'No'}
${state.candidate ? `- Title: ${state.candidate.title}` : ''}
- Confidence level: ${state.confidence}%
- Viability level: ${state.viability}%
- Conversation phase: ${session.currentPhase}

## Immediate Next Steps
1. Continue exploring ${getNextExplorationArea(state)}
2. ${state.viability < 75 ? 'Address viability concerns' : 'Validate with more market research'}
3. ${state.confidence < 75 ? 'Clarify remaining gaps' : 'Prepare for capture'}

## User Rapport Notes
- Communication style: ${detectCommunicationStyle(lastUserMessages)}
- Engagement level: ${detectEngagementLevel(lastUserMessages)}
- Topics that energize: ${extractEnergizingTopics(history)}
- Topics to avoid: none identified

## Critical Context
${extractCriticalContext(history)}
`;
}
```

### 4.4 Signal Extraction with Fallback

The system cannot rely solely on the LLM outputting perfect structured signals. This hybrid approach combines LLM-provided signals with rule-based extraction as fallback.

```typescript
/**
 * SIGNAL EXTRACTION SYSTEM
 *
 * Primary: Use signals from LLM's structured JSON output
 * Fallback: Rule-based pattern matching on conversation text
 * Merge: Combine both with LLM signals taking precedence
 */

interface ExtractedSignals {
  selfDiscovery: Partial<SelfDiscoveryState>;
  marketDiscovery: Partial<MarketDiscoveryState>;
  narrowing: Partial<NarrowingState>;
}

function extractSignals(
  userMessage: string,
  agentResponse: ParsedAgentResponse,
  existingState: SessionState
): ExtractedSignals {
  // Primary: LLM-provided signals (if agent returned them)
  const llmSignals = agentResponse.signals || {};

  // Fallback: Rule-based extraction from conversation text
  const textSignals = extractSignalsFromText(userMessage, agentResponse.reply);

  // Merge with LLM signals taking precedence
  return mergeSignals(llmSignals, textSignals, existingState);
}

// ============================================================================
// RULE-BASED SIGNAL EXTRACTION (Fallback)
// ============================================================================

function extractSignalsFromText(userMessage: string, agentReply: string): ExtractedSignals {
  const signals: ExtractedSignals = {
    selfDiscovery: {},
    marketDiscovery: {},
    narrowing: {},
  };

  const msgLower = userMessage.toLowerCase();

  // ---------------------------------------------------------------------------
  // FRUSTRATION DETECTION
  // ---------------------------------------------------------------------------
  const frustrationPatterns = [
    { pattern: /i('m| am) (so )?frustrat(ed|ing)/i, severity: 'high' as const },
    { pattern: /drives me (crazy|nuts|insane)/i, severity: 'high' as const },
    { pattern: /i hate (when|how|that)/i, severity: 'high' as const },
    { pattern: /annoy(s|ed|ing)/i, severity: 'medium' as const },
    { pattern: /wish (i|there was|someone would)/i, severity: 'medium' as const },
    { pattern: /pain(ful)? (to|when)/i, severity: 'medium' as const },
    { pattern: /takes (forever|too long|way too)/i, severity: 'medium' as const },
    { pattern: /hard(er)? than it should/i, severity: 'medium' as const },
    { pattern: /doesn't work (well|properly|right)/i, severity: 'low' as const },
    { pattern: /could be better/i, severity: 'low' as const },
  ];

  for (const { pattern, severity } of frustrationPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      const context = extractSurroundingContext(userMessage, match.index!, 100);
      signals.selfDiscovery.frustrations = signals.selfDiscovery.frustrations || [];
      signals.selfDiscovery.frustrations.push({
        description: context,
        source: 'user_message',
        severity,
      });
      break; // Only capture strongest frustration per message
    }
  }

  // ---------------------------------------------------------------------------
  // CUSTOMER TYPE DETECTION
  // ---------------------------------------------------------------------------
  const customerPatterns = [
    { pattern: /\b(B2B|business(es)?|enterprise|companies|corporate)\b/i, value: 'B2B' },
    { pattern: /\b(B2C|consumer|individual|people|everyone|person)\b/i, value: 'B2C' },
    { pattern: /\b(marketplace|platform|two[- ]sided)\b/i, value: 'Marketplace' },
    { pattern: /\b(small business|SMB|SME|startup)\b/i, value: 'B2B_SMB' },
  ];

  for (const { pattern, value } of customerPatterns) {
    if (pattern.test(userMessage)) {
      signals.narrowing.customerType = {
        value,
        confidence: 0.6, // Lower confidence for rule-based extraction
      };
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // PRODUCT TYPE DETECTION
  // ---------------------------------------------------------------------------
  const productPatterns = [
    { pattern: /\b(app|software|saas|platform|website|tool)\b/i, value: 'Digital' },
    { pattern: /\b(physical|hardware|device|gadget|product)\b/i, value: 'Physical' },
    { pattern: /\b(service|consulting|agency|freelance)\b/i, value: 'Service' },
    { pattern: /\b(marketplace|platform connecting)\b/i, value: 'Marketplace' },
  ];

  for (const { pattern, value } of productPatterns) {
    if (pattern.test(userMessage)) {
      signals.narrowing.productType = {
        value,
        confidence: 0.6,
      };
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // GEOGRAPHY DETECTION
  // ---------------------------------------------------------------------------
  const geoPatterns = [
    { pattern: /\b(local|my city|nearby|neighborhood)\b/i, value: 'Local' },
    { pattern: /\b(australia|australian|sydney|melbourne|brisbane)\b/i, value: 'Australia' },
    { pattern: /\b(global|worldwide|international|anywhere)\b/i, value: 'Global' },
    { pattern: /\b(us|usa|america|states)\b/i, value: 'USA' },
  ];

  for (const { pattern, value } of geoPatterns) {
    if (pattern.test(userMessage)) {
      signals.narrowing.geography = {
        value,
        confidence: 0.7,
      };
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // EXPERTISE INDICATORS
  // ---------------------------------------------------------------------------
  const expertiseIndicators = [
    /i('ve| have) (been |)working (in|on|with)/i,
    /i('ve| have) (spent )?(\d+) years/i,
    /i know (a lot )?about/i,
    /in my experience/i,
    /i('m| am) (a|an) (expert|specialist|professional)/i,
  ];

  for (const pattern of expertiseIndicators) {
    const match = userMessage.match(pattern);
    if (match) {
      const context = extractSurroundingContext(userMessage, match.index!, 150);
      signals.selfDiscovery.expertise = signals.selfDiscovery.expertise || [];
      signals.selfDiscovery.expertise.push({
        area: extractTopicFromContext(context),
        depth: 'competent', // Conservative estimate
        evidence: context,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // INTEREST/PASSION INDICATORS
  // ---------------------------------------------------------------------------
  const passionIndicators = [
    /i love/i,
    /i('m| am) passionate about/i,
    /i really (enjoy|like)/i,
    /i can('t| cannot) stop thinking about/i,
    /i lose track of time when/i,
    /fascinates me/i,
  ];

  for (const pattern of passionIndicators) {
    const match = userMessage.match(pattern);
    if (match) {
      const context = extractSurroundingContext(userMessage, match.index!, 100);
      signals.selfDiscovery.interests = signals.selfDiscovery.interests || [];
      signals.selfDiscovery.interests.push({
        topic: extractTopicFromContext(context),
        genuine: true,
        evidence: context,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // CONSTRAINT INDICATORS
  // ---------------------------------------------------------------------------
  // Time constraints
  const timeMatch = userMessage.match(/(\d+)\s*(hours?|hrs?)\s*(per|a|\/)\s*week/i);
  if (timeMatch) {
    signals.selfDiscovery.constraints = signals.selfDiscovery.constraints || {};
    signals.selfDiscovery.constraints.timeHoursPerWeek = parseInt(timeMatch[1]);
  }

  // Capital constraints
  if (/bootstrap|self[- ]fund|no (outside )?funding|own money/i.test(msgLower)) {
    signals.selfDiscovery.constraints = signals.selfDiscovery.constraints || {};
    signals.selfDiscovery.constraints.capital = 'bootstrap';
  } else if (/raise|funding|investors|vc|venture/i.test(msgLower)) {
    signals.selfDiscovery.constraints = signals.selfDiscovery.constraints || {};
    signals.selfDiscovery.constraints.capital = 'seeking_funding';
  }

  return signals;
}

// Helper: Extract surrounding context from a match
function extractSurroundingContext(text: string, matchIndex: number, radius: number): string {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + radius);
  let context = text.slice(start, end).trim();

  // Add ellipsis if truncated
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context;
}

// Helper: Extract likely topic from context
function extractTopicFromContext(context: string): string {
  // Remove common filler words and extract key phrase
  const cleaned = context
    .replace(/^.*?(about|with|in|on|for)\s+/i, '')
    .replace(/[.!?,;].*$/, '')
    .trim();

  return cleaned.slice(0, 50); // Limit length
}

// Merge LLM signals with rule-based signals
function mergeSignals(
  llmSignals: Partial<ExtractedSignals>,
  textSignals: ExtractedSignals,
  existingState: SessionState
): ExtractedSignals {
  // Deep merge with LLM signals taking precedence
  return {
    selfDiscovery: {
      ...existingState.selfDiscovery,
      ...textSignals.selfDiscovery,
      ...llmSignals.selfDiscovery,
      // Merge arrays (frustrations, expertise, interests)
      frustrations: [
        ...(existingState.selfDiscovery?.frustrations || []),
        ...(textSignals.selfDiscovery?.frustrations || []),
        ...(llmSignals.selfDiscovery?.frustrations || []),
      ].filter((v, i, a) => a.findIndex(t => t.description === v.description) === i), // Dedupe
    },
    marketDiscovery: {
      ...existingState.marketDiscovery,
      ...textSignals.marketDiscovery,
      ...llmSignals.marketDiscovery,
    },
    narrowing: {
      ...existingState.narrowing,
      // For narrowing, only update if new signal has higher confidence
      productType: selectHigherConfidence(
        existingState.narrowing?.productType,
        textSignals.narrowing?.productType,
        llmSignals.narrowing?.productType
      ),
      customerType: selectHigherConfidence(
        existingState.narrowing?.customerType,
        textSignals.narrowing?.customerType,
        llmSignals.narrowing?.customerType
      ),
      geography: selectHigherConfidence(
        existingState.narrowing?.geography,
        textSignals.narrowing?.geography,
        llmSignals.narrowing?.geography
      ),
    },
  };
}

function selectHigherConfidence<T extends { value: string | null; confidence: number }>(
  ...options: (T | undefined)[]
): T {
  const validOptions = options.filter(o => o && o.value !== null) as T[];
  if (validOptions.length === 0) {
    return { value: null, confidence: 0 } as T;
  }
  return validOptions.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
}
```

### 4.5 Vagueness Detection

Detects when an idea is too vague to validate, triggering intervention.

```typescript
/**
 * VAGUENESS DETECTION
 *
 * Flags ideas that are too abstract/undefined to validate with market research.
 * Returns specific issues and suggested clarifying questions.
 */

interface VaguenessAssessment {
  isVague: boolean;
  score: number;  // 0-100, higher = more vague
  issues: VaguenessIssue[];
  clarifyingQuestions: string[];
}

interface VaguenessIssue {
  type: 'abstract_problem' | 'undefined_user' | 'handwavy_solution' | 'no_scope' | 'buzzword_heavy';
  description: string;
  evidence: string;
}

function assessVagueness(
  candidate: IdeaCandidate | null,
  selfDiscovery: SelfDiscoveryState,
  narrowingState: NarrowingState,
  conversationHistory: IdeationMessage[]
): VaguenessAssessment {
  const issues: VaguenessIssue[] = [];
  const clarifyingQuestions: string[] = [];

  // Get recent user messages for analysis
  const recentUserMessages = conversationHistory
    .filter(m => m.role === 'user')
    .slice(-10)
    .map(m => m.content)
    .join(' ');

  // ---------------------------------------------------------------------------
  // VAGUENESS PATTERN DETECTION
  // ---------------------------------------------------------------------------

  // 1. Abstract problem statements
  const abstractProblemPatterns = [
    /make (things|it|the world) better/i,
    /improve (the |)(experience|situation|things)/i,
    /help people/i,  // Too broad without specifics
    /solve (a|the) problem/i,  // Meta - doesn't say which problem
  ];

  for (const pattern of abstractProblemPatterns) {
    if (pattern.test(recentUserMessages) && selfDiscovery.frustrations.length === 0) {
      issues.push({
        type: 'abstract_problem',
        description: 'Problem statement is too abstract to validate',
        evidence: recentUserMessages.match(pattern)?.[0] || '',
      });
      clarifyingQuestions.push(
        'Can you describe a specific moment when you experienced this problem? What exactly happened?'
      );
      break;
    }
  }

  // 2. Undefined target user ("everyone")
  const undefinedUserPatterns = [
    /for (everyone|anybody|anyone|all people)/i,
    /target (market|audience|users?).*everyone/i,
    /people (in general|broadly)/i,
  ];

  for (const pattern of undefinedUserPatterns) {
    if (pattern.test(recentUserMessages)) {
      issues.push({
        type: 'undefined_user',
        description: 'Target user is undefined - "everyone" means no one',
        evidence: recentUserMessages.match(pattern)?.[0] || '',
      });
      clarifyingQuestions.push(
        'Who would be desperate to use this? Not "nice to have" - who NEEDS it?'
      );
      break;
    }
  }

  // 3. Handwavy solution
  const handwavySolutionPatterns = [
    /use (AI|ML|blockchain|technology) to/i,  // Tech as magic wand
    /some (kind|sort|type) of/i,
    /something (like|similar to)/i,
    /basically (just |)a/i,
    /leverage.*to/i,  // Corporate speak
  ];

  if (!candidate?.summary || candidate.summary.length < 20) {
    for (const pattern of handwavySolutionPatterns) {
      if (pattern.test(recentUserMessages)) {
        issues.push({
          type: 'handwavy_solution',
          description: 'Solution is described in vague terms',
          evidence: recentUserMessages.match(pattern)?.[0] || '',
        });
        clarifyingQuestions.push(
          'Walk me through exactly what happens when someone uses this. They open it and then what?'
        );
        break;
      }
    }
  }

  // 4. No scope defined
  const hasScope =
    narrowingState.productType.value !== null ||
    narrowingState.customerType.value !== null ||
    narrowingState.geography.value !== null;

  if (!hasScope && conversationHistory.length > 10) {
    issues.push({
      type: 'no_scope',
      description: 'No clear scope defined after extended conversation',
      evidence: 'Product type, customer type, and geography all undefined',
    });
    clarifyingQuestions.push(
      'Let\'s narrow this down: Would this be software, a physical product, or a service?'
    );
  }

  // 5. Buzzword heavy
  const buzzwords = [
    'synergy', 'leverage', 'disrupt', 'revolutionize', 'paradigm',
    'ecosystem', 'holistic', 'scalable', 'robust', 'seamless',
    'cutting-edge', 'next-gen', 'innovative', 'game-changing',
  ];

  const buzzwordCount = buzzwords.filter(bw =>
    recentUserMessages.toLowerCase().includes(bw)
  ).length;

  if (buzzwordCount >= 3) {
    issues.push({
      type: 'buzzword_heavy',
      description: 'Description relies on buzzwords instead of specifics',
      evidence: `Found ${buzzwordCount} buzzwords: ${buzzwords.filter(bw =>
        recentUserMessages.toLowerCase().includes(bw)
      ).join(', ')}`,
    });
    clarifyingQuestions.push(
      'Let\'s get concrete: What does V1 actually DO? Not the vision - the minimum first version.'
    );
  }

  // ---------------------------------------------------------------------------
  // CALCULATE VAGUENESS SCORE
  // ---------------------------------------------------------------------------
  let score = 0;

  // Each issue type adds to score
  score += issues.filter(i => i.type === 'abstract_problem').length * 25;
  score += issues.filter(i => i.type === 'undefined_user').length * 25;
  score += issues.filter(i => i.type === 'handwavy_solution').length * 20;
  score += issues.filter(i => i.type === 'no_scope').length * 15;
  score += issues.filter(i => i.type === 'buzzword_heavy').length * 15;

  // Reduce score if we have concrete signals
  if (selfDiscovery.frustrations.length > 0) score -= 15;
  if (selfDiscovery.expertise.length > 0) score -= 10;
  if (narrowingState.customerType.value) score -= 10;
  if (candidate?.summary && candidate.summary.length > 50) score -= 15;

  score = Math.max(0, Math.min(100, score));

  return {
    isVague: score >= 50,
    score,
    issues,
    clarifyingQuestions: clarifyingQuestions.slice(0, 2), // Max 2 questions
  };
}
```

### 4.6 Greeting Generator

Creates personalized opening greeting based on user profile.

```typescript
/**
 * GREETING GENERATOR
 *
 * Creates a personalized opening message that:
 * 1. References user's background from profile
 * 2. Explains the process briefly
 * 3. Opens with a broad question
 */

function generateGreeting(profile: UserProfile): string {
  const parts: string[] = [];

  // Opening
  parts.push("Welcome! I'm here to help you discover a business idea that's genuinely right for you.");

  // Process explanation
  parts.push(`
Here's how this works: We'll have a conversation where I ask questions, you answer, and together we'll explore what excites you and what the market needs. As we go, I'll be looking for where those two things overlap.

When I spot a promising idea, it'll appear in the panel on the right. I'll also let you know if I see significant challenges — better to know early than waste time on something that won't work.

Feel free to suggest any ideas you've been thinking about — I'll help you explore and validate them.`);

  // Profile-based personalization
  const personalizations: string[] = [];

  // Technical skills
  const technicalSkills = profile.skills?.filter(s =>
    ['programming', 'software', 'development', 'engineering', 'data', 'design'].some(t =>
      s.toLowerCase().includes(t)
    )
  ) || [];

  if (technicalSkills.length > 0) {
    personalizations.push(`technical background in ${technicalSkills.slice(0, 2).join(' and ')}`);
  }

  // Domain experience
  if (profile.experience?.industries && profile.experience.industries.length > 0) {
    personalizations.push(`experience in ${profile.experience.industries.slice(0, 2).join(' and ')}`);
  }

  // Interests from profile
  if (profile.interests && profile.interests.length > 0) {
    personalizations.push(`interest in ${profile.interests.slice(0, 2).join(' and ')}`);
  }

  // Location
  if (profile.location?.city) {
    personalizations.push(`based in ${profile.location.city}`);
  }

  if (personalizations.length > 0) {
    parts.push(`\nI've loaded your profile, so I know you have ${personalizations.join(', ')}. Let's use that as our starting point.`);
  } else {
    parts.push(`\nI've loaded your profile. Let's use what I know about you as our starting point.`);
  }

  // Opening question
  parts.push(`
What's been occupying your mind lately? Any problems you've noticed, frustrations you've had, or opportunities you've wondered about?`);

  return parts.join('\n');
}

// Generate greeting with buttons for common starting points
function generateGreetingWithButtons(profile: UserProfile): {
  text: string;
  buttons: ButtonOption[];
} {
  return {
    text: generateGreeting(profile),
    buttons: [
      {
        id: 'btn_frustration',
        label: 'Something frustrates me',
        value: "There's something that frustrates me that I think could be better",
        style: 'secondary',
      },
      {
        id: 'btn_idea',
        label: 'I have a rough idea',
        value: "I have a rough idea I've been thinking about",
        style: 'secondary',
      },
      {
        id: 'btn_explore',
        label: 'Help me explore',
        value: "I don't have anything specific, help me explore",
        style: 'secondary',
      },
    ],
  };
}
```

### 4.7 Communication Style Classifier

Analyzes user's communication patterns for handoff context.

```typescript
/**
 * COMMUNICATION STYLE CLASSIFIER
 *
 * Analyzes user messages to determine communication preferences.
 * Used in handoff notes so new agent instance can maintain rapport.
 */

type CommunicationStyle = 'verbose' | 'terse' | 'analytical' | 'emotional';
type EngagementLevel = 'high' | 'medium' | 'low';

interface CommunicationProfile {
  style: CommunicationStyle;
  engagement: EngagementLevel;
  characteristics: string[];
  topicsThatEnergize: string[];
  responsePreference: 'detailed' | 'concise' | 'adaptive';
}

function classifyCommunicationStyle(
  userMessages: string[]
): CommunicationProfile {
  if (userMessages.length === 0) {
    return {
      style: 'terse',
      engagement: 'medium',
      characteristics: [],
      topicsThatEnergize: [],
      responsePreference: 'adaptive',
    };
  }

  // ---------------------------------------------------------------------------
  // MESSAGE LENGTH ANALYSIS
  // ---------------------------------------------------------------------------
  const avgLength = userMessages.reduce((sum, m) => sum + m.length, 0) / userMessages.length;
  const avgWords = userMessages.reduce((sum, m) => sum + m.split(/\s+/).length, 0) / userMessages.length;

  // ---------------------------------------------------------------------------
  // STYLE INDICATORS
  // ---------------------------------------------------------------------------
  const allText = userMessages.join(' ');

  // Emotional indicators
  const emotionalIndicators = {
    exclamations: (allText.match(/!/g) || []).length,
    emoticons: (allText.match(/[:;][-']?[)D(P]/g) || []).length,
    emotionalWords: (allText.match(/\b(love|hate|amazing|terrible|excited|frustrated|passionate)\b/gi) || []).length,
    allCaps: (allText.match(/\b[A-Z]{3,}\b/g) || []).length,
  };

  const emotionalScore =
    emotionalIndicators.exclamations * 2 +
    emotionalIndicators.emoticons * 3 +
    emotionalIndicators.emotionalWords * 2 +
    emotionalIndicators.allCaps * 1;

  // Analytical indicators
  const analyticalIndicators = {
    numbers: (allText.match(/\d+%?/g) || []).length,
    comparisons: (allText.match(/\b(compared|versus|vs|than|better|worse)\b/gi) || []).length,
    hedging: (allText.match(/\b(probably|might|could|perhaps|maybe|possibly)\b/gi) || []).length,
    structuredLists: (allText.match(/(\d\.|•|-)\s/g) || []).length,
  };

  const analyticalScore =
    analyticalIndicators.numbers * 2 +
    analyticalIndicators.comparisons * 2 +
    analyticalIndicators.hedging * 1 +
    analyticalIndicators.structuredLists * 3;

  // ---------------------------------------------------------------------------
  // DETERMINE PRIMARY STYLE
  // ---------------------------------------------------------------------------
  let style: CommunicationStyle;

  if (avgWords < 15) {
    style = 'terse';
  } else if (emotionalScore > analyticalScore && emotionalScore > 5) {
    style = 'emotional';
  } else if (analyticalScore > emotionalScore && analyticalScore > 5) {
    style = 'analytical';
  } else if (avgWords > 50) {
    style = 'verbose';
  } else {
    style = 'terse';
  }

  // ---------------------------------------------------------------------------
  // ENGAGEMENT LEVEL
  // ---------------------------------------------------------------------------
  let engagement: EngagementLevel;

  const questionsAsked = (allText.match(/\?/g) || []).length;
  const elaborations = userMessages.filter(m => m.length > 100).length;
  const quickResponses = userMessages.filter(m => m.split(/\s+/).length < 5).length;

  const engagementScore =
    (questionsAsked * 2) +
    (elaborations * 3) -
    (quickResponses * 1);

  if (engagementScore > userMessages.length * 2) {
    engagement = 'high';
  } else if (engagementScore < 0) {
    engagement = 'low';
  } else {
    engagement = 'medium';
  }

  // ---------------------------------------------------------------------------
  // CHARACTERISTICS
  // ---------------------------------------------------------------------------
  const characteristics: string[] = [];

  if (avgWords > 50) characteristics.push('gives detailed responses');
  if (avgWords < 15) characteristics.push('prefers brief responses');
  if (questionsAsked > 2) characteristics.push('asks clarifying questions');
  if (emotionalIndicators.exclamations > 3) characteristics.push('uses expressive punctuation');
  if (analyticalIndicators.numbers > 3) characteristics.push('thinks in numbers/metrics');
  if (analyticalIndicators.hedging > 5) characteristics.push('hedges statements carefully');

  // ---------------------------------------------------------------------------
  // TOPICS THAT ENERGIZE
  // ---------------------------------------------------------------------------
  const topicsThatEnergize: string[] = [];

  // Find messages with high engagement (longer, more punctuation)
  const energizedMessages = userMessages
    .filter(m => m.length > avgLength * 1.5 || m.includes('!'))
    .slice(0, 3);

  for (const msg of energizedMessages) {
    // Extract key nouns/topics (simplified - would use NLP in production)
    const topic = msg
      .replace(/[^a-zA-Z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 5)
      .slice(0, 2)
      .join(' ');

    if (topic) topicsThatEnergize.push(topic);
  }

  // ---------------------------------------------------------------------------
  // RESPONSE PREFERENCE
  // ---------------------------------------------------------------------------
  let responsePreference: 'detailed' | 'concise' | 'adaptive';

  if (style === 'verbose' || style === 'analytical') {
    responsePreference = 'detailed';
  } else if (style === 'terse') {
    responsePreference = 'concise';
  } else {
    responsePreference = 'adaptive';
  }

  return {
    style,
    engagement,
    characteristics,
    topicsThatEnergize,
    responsePreference,
  };
}

// Format for handoff notes
function formatCommunicationStyleForHandoff(profile: CommunicationProfile): string {
  return `- Communication style: ${profile.style}
- Engagement level: ${profile.engagement}
- Characteristics: ${profile.characteristics.join(', ') || 'none identified'}
- Topics that energize: ${profile.topicsThatEnergize.join(', ') || 'none identified yet'}
- Response preference: ${profile.responsePreference}`;
}
```

### 4.8 Pre-Answered Questions Mapping

Maps ideation signals to Development phase questions for pre-population.

```typescript
/**
 * PRE-ANSWERED QUESTIONS MAPPING
 *
 * Maps signals collected during ideation to Development phase questions.
 * Prevents re-asking questions that were already answered.
 */

interface PreAnsweredQuestion {
  questionId: string;
  category: 'user' | 'problem' | 'solution' | 'market' | 'execution';
  answer: string;
  source: 'ideation_agent';
  confidence: number;  // 0-1, how confident we are in this answer
}

// Development phase question IDs (from agents/development.ts categories)
const DEVELOPMENT_QUESTION_MAP: Record<string, {
  questionId: string;
  category: 'user' | 'problem' | 'solution' | 'market' | 'execution';
  signalPath: string;  // Path in ideation state to get answer
  transformer?: (value: any) => string;  // Transform signal to answer
}> = {
  // USER category
  'target_user_type': {
    questionId: 'U1',
    category: 'user',
    signalPath: 'narrowing.customerType.value',
    transformer: (v) => v === 'B2B' ? 'Businesses' : v === 'B2C' ? 'Individual consumers' : v,
  },
  'target_user_specifics': {
    questionId: 'U2',
    category: 'user',
    signalPath: 'selfDiscovery.frustrations',
    transformer: (frustrations) => {
      if (!frustrations?.length) return '';
      return `People who experience: ${frustrations.map((f: any) => f.description).join('; ')}`;
    },
  },
  'user_geography': {
    questionId: 'U3',
    category: 'user',
    signalPath: 'narrowing.geography.value',
  },

  // PROBLEM category
  'core_problem': {
    questionId: 'P1',
    category: 'problem',
    signalPath: 'selfDiscovery.frustrations',
    transformer: (frustrations) => {
      const highSeverity = frustrations?.filter((f: any) => f.severity === 'high') || [];
      return highSeverity.map((f: any) => f.description).join('. ') || '';
    },
  },
  'problem_severity': {
    questionId: 'P2',
    category: 'problem',
    signalPath: 'selfDiscovery.frustrations',
    transformer: (frustrations) => {
      if (!frustrations?.length) return '';
      const severities = frustrations.map((f: any) => f.severity);
      if (severities.includes('high')) return 'High - significant pain point';
      if (severities.includes('medium')) return 'Medium - noticeable inconvenience';
      return 'Low - minor annoyance';
    },
  },

  // SOLUTION category
  'solution_type': {
    questionId: 'S1',
    category: 'solution',
    signalPath: 'narrowing.productType.value',
  },
  'technical_approach': {
    questionId: 'S2',
    category: 'solution',
    signalPath: 'narrowing.technicalDepth.value',
    transformer: (v) => {
      const map: Record<string, string> = {
        'no_code': 'No-code tools (Bubble, Webflow, etc.)',
        'low_code': 'Low-code with some custom development',
        'full_custom': 'Fully custom development',
      };
      return map[v] || v;
    },
  },

  // MARKET category
  'market_size': {
    questionId: 'M1',
    category: 'market',
    signalPath: 'marketDiscovery.gaps',
    transformer: (gaps) => {
      if (!gaps?.length) return '';
      return `Identified market gaps: ${gaps.map((g: any) => g.description).join('; ')}`;
    },
  },
  'competitors': {
    questionId: 'M2',
    category: 'market',
    signalPath: 'marketDiscovery.competitors',
    transformer: (competitors) => {
      if (!competitors?.length) return 'No competitors identified yet';
      return competitors.map((c: any) => `${c.name}: ${c.description}`).join('\n');
    },
  },
  'timing': {
    questionId: 'M3',
    category: 'market',
    signalPath: 'marketDiscovery.timingSignals',
    transformer: (signals) => {
      if (!signals?.length) return '';
      return signals.map((s: any) => `${s.signal} (${s.implication})`).join('; ');
    },
  },

  // EXECUTION category
  'founder_skills': {
    questionId: 'E1',
    category: 'execution',
    signalPath: 'selfDiscovery.skills',
    transformer: (skills) => {
      if (!skills?.strengths?.length) return '';
      return `Strengths: ${skills.strengths.join(', ')}. Gaps: ${skills.gaps?.join(', ') || 'None identified'}`;
    },
  },
  'time_commitment': {
    questionId: 'E2',
    category: 'execution',
    signalPath: 'selfDiscovery.constraints.timeHoursPerWeek',
    transformer: (hours) => hours ? `${hours} hours per week` : '',
  },
  'funding_approach': {
    questionId: 'E3',
    category: 'execution',
    signalPath: 'selfDiscovery.constraints.capital',
    transformer: (v) => v === 'bootstrap' ? 'Self-funded / Bootstrap' : 'Seeking external funding',
  },
};

function generatePreAnsweredQuestions(
  selfDiscovery: SelfDiscoveryState,
  marketDiscovery: MarketDiscoveryState,
  narrowingState: NarrowingState
): PreAnsweredQuestion[] {
  const state = { selfDiscovery, marketDiscovery, narrowing: narrowingState };
  const preAnswered: PreAnsweredQuestion[] = [];

  for (const [key, mapping] of Object.entries(DEVELOPMENT_QUESTION_MAP)) {
    // Navigate to the signal value
    const pathParts = mapping.signalPath.split('.');
    let value: any = state;

    for (const part of pathParts) {
      value = value?.[part];
      if (value === undefined || value === null) break;
    }

    // Skip if no value
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;

    // Transform if needed
    const answer = mapping.transformer ? mapping.transformer(value) : String(value);

    // Skip empty answers
    if (!answer || answer.trim() === '') continue;

    // Calculate confidence based on signal source
    let confidence = 0.7; // Default
    if (typeof value === 'object' && 'confidence' in value) {
      confidence = value.confidence;
    }

    preAnswered.push({
      questionId: mapping.questionId,
      category: mapping.category,
      answer,
      source: 'ideation_agent',
      confidence,
    });
  }

  return preAnswered;
}
```

### 4.9 Web Search Integration Pattern

Clarifies when and how web search happens within the agent flow.

```typescript
/**
 * WEB SEARCH INTEGRATION
 *
 * Web search happens WITHIN the agent's tool-enabled call, not as a separate step.
 * Uses Claude Code CLI with WebSearch tool enabled.
 *
 * Flow:
 * 1. User sends message
 * 2. We call agent with tools: ['WebSearch'] enabled
 * 3. Agent decides internally whether to search
 * 4. Agent returns response (may include search results inline)
 * 5. We parse response and extract any market data
 */

interface WebSearchEnabledCall {
  sessionId: string;
  message: string;
  includeWebSearch: boolean;  // Enable search tool
  searchContext?: string;     // Additional context for searches
}

async function callAgentWithWebSearch(
  session: IdeationSession,
  userMessage: string,
  enableSearch: boolean = true
): Promise<ParsedAgentResponse> {

  // Build context
  const context = await buildAgentContext(session, userMessage);

  if (enableSearch) {
    // Use Claude Code CLI with WebSearch tool enabled
    // The agent will decide when to search based on conversation needs
    const response = await runClaudeCliWithPrompt(
      formatMessagesAsPrompt(context.messages),
      {
        model: 'sonnet',
        tools: ['WebSearch'],  // Agent can invoke search when needed
        maxTokens: 4096,
        systemPrompt: IDEATION_AGENT_SYSTEM_PROMPT,
      }
    );

    return parseAgentResponse(response);
  } else {
    // Standard call without search capability
    const response = await client.messages.create({
      model: getConfig().model,
      max_tokens: 4096,
      system: IDEATION_AGENT_SYSTEM_PROMPT,
      messages: context.messages,
    });

    return parseAgentResponse(response);
  }
}

// When to enable web search
function shouldEnableWebSearch(
  session: IdeationSession,
  userMessage: string,
  candidate: IdeaCandidate | null
): boolean {
  // Always enable if:
  // 1. User suggests a specific idea
  if (/what about|idea.*for|build.*a|create.*a/i.test(userMessage)) {
    return true;
  }

  // 2. We're validating viability
  if (candidate && candidate.confidence > 30) {
    return true;
  }

  // 3. User asks about market/competition
  if (/market|competitor|exist|already|someone|built/i.test(userMessage)) {
    return true;
  }

  // 4. Every 5th message (periodic validation)
  if (session.messageCount % 5 === 0 && session.messageCount > 0) {
    return true;
  }

  // Default: enable for comprehensive conversations
  return session.messageCount > 3;
}

// Extract market data from agent response that includes search results
function extractMarketDataFromResponse(
  response: ParsedAgentResponse
): Partial<MarketDiscoveryState> {
  const marketData: Partial<MarketDiscoveryState> = {};

  // Look for competitor mentions with URLs
  const competitorPattern = /(?:competitor|player|company|startup).*?([A-Z][a-zA-Z]+(?:\.com|\.io)?)/gi;
  const urlPattern = /https?:\/\/[^\s)]+/gi;

  const competitorMatches = response.reply.matchAll(competitorPattern);
  const urls = response.reply.match(urlPattern) || [];

  for (const match of competitorMatches) {
    if (!marketData.competitors) marketData.competitors = [];
    marketData.competitors.push({
      name: match[1],
      description: extractSurroundingContext(response.reply, match.index!, 100),
      strengths: [],
      weaknesses: [],
      source: urls[0] || 'agent_research',
    });
  }

  // Look for market gap mentions
  const gapPattern = /(?:gap|missing|opportunity|underserved|no one).*?([^.!?]+)/gi;
  const gapMatches = response.reply.matchAll(gapPattern);

  for (const match of gapMatches) {
    if (!marketData.gaps) marketData.gaps = [];
    marketData.gaps.push({
      description: match[1].trim(),
      evidence: urls[0] || 'agent_analysis',
      relevance: 'medium',
    });
  }

  return marketData;
}
```

### 4.10 Streaming Response Pattern

For real-time chat UX, responses should stream to the frontend.

```typescript
/**
 * STREAMING RESPONSE PATTERN
 *
 * For good chat UX, agent responses stream in real-time.
 * Uses Server-Sent Events (SSE) for streaming.
 */

import { Response } from 'express';

interface StreamChunk {
  type: 'text' | 'button' | 'form' | 'candidate_update' | 'done' | 'error';
  content: string | ButtonOption[] | FormDefinition | IdeaCandidateUpdate;
}

// Streaming endpoint
router.post('/message/stream', async (req: Request, res: Response) => {
  const { sessionId, message } = req.body as SendMessageRequest;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const session = await sessionManager.load(sessionId);
    if (!session) {
      sendStreamChunk(res, { type: 'error', content: 'Session not found' });
      res.end();
      return;
    }

    // Store user message
    await messageStore.create({
      sessionId,
      role: 'user',
      content: message,
      tokenCount: estimateTokens(message),
    });

    // Build context
    const context = await agentOrchestrator.buildContext(session, message);

    // Stream response from Claude
    const stream = await client.messages.stream({
      model: getConfig().model,
      max_tokens: 4096,
      system: IDEATION_AGENT_SYSTEM_PROMPT,
      messages: context.messages,
    });

    let fullResponse = '';

    // Stream text chunks as they arrive
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullResponse += event.delta.text;
        sendStreamChunk(res, { type: 'text', content: event.delta.text });
      }
    }

    // Parse complete response for structured elements
    const parsed = parseAgentResponse({ content: [{ type: 'text', text: fullResponse }] });

    // Send buttons if present
    if (parsed.buttons) {
      sendStreamChunk(res, { type: 'button', content: parsed.buttons });
    }

    // Send form if present
    if (parsed.formFields) {
      sendStreamChunk(res, { type: 'form', content: parsed.formFields });
    }

    // Process signals and update state (non-streaming)
    const signals = extractSignals(message, parsed, session.state);
    const updatedState = await updateSessionState(session.id, signals);

    // Calculate meters
    const confidence = confidenceCalculator.calculate(updatedState);
    const viability = viabilityCalculator.calculate(updatedState);

    // Send candidate update if changed
    if (confidence.total >= 30) {
      const candidate = await candidateManager.updateOrCreate(session.id, {
        title: parsed.candidateTitle || generateCandidateTitle(updatedState),
        confidence: confidence.total,
        viability: viability.total,
      });

      sendStreamChunk(res, {
        type: 'candidate_update',
        content: {
          id: candidate.id,
          title: candidate.title,
          confidence: confidence.total,
          viability: viability.total,
          isNew: candidate.createdAt === candidate.updatedAt,
        },
      });
    }

    // Store assistant message
    await messageStore.create({
      sessionId,
      role: 'assistant',
      content: parsed.reply,
      buttonsShown: parsed.buttons,
      formShown: parsed.formFields,
      tokenCount: estimateTokens(fullResponse),
    });

    // Signal completion
    sendStreamChunk(res, { type: 'done', content: 'complete' });

  } catch (error) {
    sendStreamChunk(res, { type: 'error', content: error.message });
  } finally {
    res.end();
  }
});

function sendStreamChunk(res: Response, chunk: StreamChunk): void {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

// Frontend usage example:
/*
const eventSource = new EventSource(`/api/ideation/message/stream?sessionId=${sessionId}`);

eventSource.onmessage = (event) => {
  const chunk = JSON.parse(event.data);

  switch (chunk.type) {
    case 'text':
      appendToMessage(chunk.content);
      break;
    case 'button':
      renderButtons(chunk.content);
      break;
    case 'candidate_update':
      updateCandidatePanel(chunk.content);
      break;
    case 'done':
      eventSource.close();
      break;
  }
};
*/
```

---

## 5. API Specifications

### 5.1 Endpoint Details

```typescript
// ============================================================================
// POST /api/ideation/start
// ============================================================================
// Starts a new ideation session

router.post('/start', async (req: Request, res: Response) => {
  const { profileId } = req.body as StartSessionRequest;

  // Validation
  if (!profileId) {
    return res.status(400).json({ error: 'profileId is required' });
  }

  // Load profile
  const profile = await profileService.load(profileId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  // Create session
  const session = await sessionManager.create(profileId);

  // Initialize memory files
  await memoryManager.initializeSession(session.id);

  // Generate personalized greeting
  const greeting = generateGreeting(profile);

  // Return response
  const response: StartSessionResponse = {
    sessionId: session.id,
    greeting,
    buttons: null,  // First message is open-ended
  };

  res.json(response);
});

// ============================================================================
// POST /api/ideation/message
// ============================================================================
// Handles user message and returns agent response

router.post('/message', async (req: Request, res: Response) => {
  const { sessionId, message } = req.body as SendMessageRequest;

  // Validation
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  // Load session
  const session = await sessionManager.load(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.status !== 'active') {
    return res.status(400).json({ error: 'Session is not active' });
  }

  // Check token usage
  const tokenUsage = calculateTokenUsage(session.messages, message);

  let handoffOccurred = false;
  if (tokenUsage.shouldHandoff) {
    await performHandoff(session);
    handoffOccurred = true;
  }

  // Store user message
  await messageStore.create({
    sessionId,
    role: 'user',
    content: message,
    tokenCount: tokenUsage.currentMessage,
  });

  // Build agent context
  const context = await agentOrchestrator.buildContext(session, message);

  // Call Claude via client (uses Claude Code CLI pattern from utils/anthropic-client.ts)
  const agentResponse = await client.messages.create({
    model: getConfig().model,
    max_tokens: 4096,
    system: IDEATION_AGENT_SYSTEM_PROMPT,
    messages: context.messages,
  });

  // Parse response (extract JSON from text, handle malformed responses)
  const parsed = responseParser.parse(agentResponse);

  // Extract signals
  const signals = signalExtractor.extract(message, agentResponse, session);

  // Update states
  const selfDiscovery = await updateSelfDiscovery(session.id, signals);
  const marketDiscovery = await updateMarketDiscovery(session.id, signals);
  const narrowingState = await updateNarrowingState(session.id, signals);

  // Calculate meters
  const confidence = confidenceCalculator.calculate({
    selfDiscovery,
    marketDiscovery,
    narrowingState,
    candidate: session.currentCandidate,
    userConfirmations: countUserConfirmations(session.messages),
  });

  const viability = viabilityCalculator.calculate({
    selfDiscovery,
    marketDiscovery,
    narrowingState,
    webSearchResults: session.webSearchCache,
    candidate: session.currentCandidate,
  });

  // Update or create candidate
  let ideaCandidate = null;
  if (confidence.total >= 30) {
    ideaCandidate = await candidateManager.updateOrCreate(session.id, {
      title: parsed.candidateTitle || generateCandidateTitle(selfDiscovery, narrowingState),
      confidence: confidence.total,
      viability: viability.total,
    });
  }

  // Check for intervention
  let intervention = null;
  if (viability.requiresIntervention) {
    intervention = {
      type: viability.total < 25 ? 'critical' : 'warning',
      message: generateInterventionMessage(viability.risks),
      risks: viability.risks,
      options: generateInterventionButtons(),
    };
  }

  // Store assistant message
  await messageStore.create({
    sessionId,
    role: 'assistant',
    content: parsed.reply,
    buttonsShown: parsed.buttons,
    formShown: parsed.formFields,
    tokenCount: estimateTokens(parsed.reply),
  });

  // Update session
  await sessionManager.update(session.id, {
    tokenCount: tokenUsage.total,
    messageCount: session.messageCount + 2,
    lastActivityAt: new Date(),
  });

  // Update memory files
  await memoryManager.updateAll(session.id, {
    selfDiscovery,
    marketDiscovery,
    narrowingState,
    candidate: ideaCandidate,
    viability,
  });

  // Return response
  const response: SendMessageResponse = {
    reply: parsed.reply,
    ideaCandidate: ideaCandidate ? {
      id: ideaCandidate.id,
      title: ideaCandidate.title,
      confidence: confidence.total,
      viability: viability.total,
      risks: viability.risks,
    } : null,
    buttons: parsed.buttons,
    formFields: parsed.formFields,
    intervention,
    handoffOccurred,
  };

  res.json(response);
});

// ============================================================================
// POST /api/ideation/button
// ============================================================================
// Handles button click as if it were a message

router.post('/button', async (req: Request, res: Response) => {
  const { sessionId, buttonId, buttonValue } = req.body as ButtonClickRequest;

  // Treat button click as a message with the button value
  // But also record which button was clicked

  const session = await sessionManager.load(sessionId);
  const lastMessage = await messageStore.getLastAssistant(sessionId);

  if (lastMessage) {
    await messageStore.update(lastMessage.id, {
      buttonClicked: buttonId,
    });
  }

  // Process as regular message
  req.body.message = buttonValue;
  return router.handle('/message', req, res);
});

// ============================================================================
// POST /api/ideation/capture
// ============================================================================
// Captures the current idea candidate to the Ideas system

router.post('/capture', async (req: Request, res: Response) => {
  const { sessionId } = req.body as CaptureIdeaRequest;

  const session = await sessionManager.load(sessionId);
  if (!session?.currentCandidate) {
    return res.status(400).json({ error: 'No idea candidate to capture' });
  }

  // Get all state
  const selfDiscovery = await memoryManager.read(sessionId, 'self_discovery');
  const marketDiscovery = await memoryManager.read(sessionId, 'market_discovery');
  const candidate = session.currentCandidate;

  // Create idea in Ideas system
  const idea = await ideaService.create({
    title: candidate.title,
    type: classifyIdeaType(selfDiscovery, marketDiscovery),
    stage: 'SPARK',
    summary: candidate.summary,
  });

  // Create README with pre-populated content
  const readme = generateIdeaReadme({
    title: candidate.title,
    overview: generateOverview(selfDiscovery, marketDiscovery, candidate),
    problemStatement: extractProblemStatement(selfDiscovery),
    targetUsers: extractTargetUsers(selfDiscovery, marketDiscovery),
    proposedSolution: extractSolutionDirection(marketDiscovery, candidate),
  });

  await fileSystem.write(`ideas/${idea.slug}/README.md`, readme);

  // Store ideation metadata
  await ideaService.setMetadata(idea.id, 'ideation', {
    sessionId,
    confidenceAtCapture: candidate.confidence,
    viabilityAtCapture: candidate.viability,
    viabilityRisks: await riskStore.getForCandidate(candidate.id),
    conversationSummary: await memoryManager.read(sessionId, 'conversation_summary'),
  });

  // Update candidate status
  await candidateManager.update(candidate.id, {
    status: 'captured',
    capturedIdeaId: idea.id,
  });

  // Complete session
  await sessionManager.complete(sessionId);

  const response: CaptureIdeaResponse = {
    ideaId: idea.id,
    ideaSlug: idea.slug,
    prePopulatedFields: {
      title: candidate.title,
      type: idea.type,
      overview: readme.overview,
      problemStatement: readme.problemStatement,
      targetUsers: readme.targetUsers,
      proposedSolution: readme.proposedSolution,
    },
    ideationMetadata: {
      sessionId,
      confidenceAtCapture: candidate.confidence,
      viabilityAtCapture: candidate.viability,
      viabilityRisks: await riskStore.getForCandidate(candidate.id),
    },
  };

  res.json(response);
});
```

---

## 6. Agent System Prompt

### 6.1 Complete System Prompt

```typescript
const IDEATION_AGENT_SYSTEM_PROMPT = `
You are the Ideation Agent — a sophisticated interviewer who helps users discover business ideas by exploring themselves and the market.

## YOUR GOAL
Help the user discover themselves (interests, expertise, impact vision) and the market (gaps, opportunities, timing), then identify realistic overlap to surface viable business ideas.

## CONTEXT LIMIT
You have 100,000 tokens of context. At ~80% usage, you will hand off to a new instance with preserved memory. The handoff will be seamless to the user.

## YOUR METHOD: DUAL-MODE QUESTIONING

### Mode 1: Covert Extraction (for testing, narrowing)
- Extract information without revealing assessment purpose
- Test knowledge/skills through natural conversation
- Narrow possibilities silently based on accumulated signals

### Mode 2: Transparent Inquiry (for context-building)
- Reveal why you're asking when referencing previous answers
- Explain the purpose when clarity helps the user
- Build trust through transparency

**When to reveal purpose:**
- Referencing previous answers → Explain the connection
- Need specific info → Explain why you need it
- User seems confused → Provide context

**Keep covert:**
- Testing domain knowledge
- Assessing skill level
- Internal narrowing decisions

## KEY AREAS TO POPULATE

### Self-Discovery
- Impact Vision (world/country/city/community)
- Frustrations (specific, personal)
- Expertise (what they know others don't)
- Interests (what energizes them)
- Skills (tested through conversation)
- Constraints (location, time, capital, risk)

### Market Discovery
- Competitors (who's playing)
- Gaps (what's missing)
- Timing (why now)
- Failed attempts (what didn't work)
- Location context (local opportunities)

### Narrowing Dimensions (track internally)
- Product type: Digital/Physical/Hybrid/Service
- Customer type: B2B/B2C/B2B2C/Marketplace
- Geography: Local/National/Global
- Scale: Lifestyle/Growth/Venture
- Technical depth: No-code/Low-code/Full custom

## USER-SUGGESTED IDEAS

Users can suggest ideas at any time. When they do:
1. Acknowledge positively but neutrally
2. Connect to prior conversation
3. Ask targeted follow-up questions
4. Run market validation
5. Continue naturally (don't restart)

Example:
USER: "What about a marketplace for vintage synthesizers?"
YOU: "That's a concrete idea — let's explore it. What drew you to this specifically? Personal experience with buying/selling, or something you observed?"

## DUAL METERING SYSTEM

### Confidence (how well-defined)
Track internally. When > 30%, an idea candidate appears in the UI.
Components: Problem definition, Target user, Solution direction, Differentiation, User fit

### Viability (how realistic)
Based on web search evidence. Monitor continuously.
- 75-100%: Healthy — continue
- 50-74%: Caution — mention concerns
- 25-49%: Warning — pause and discuss
- 0-24%: Critical — must address

Risk factors (flag these):
- Impossible: Technology doesn't exist
- Unrealistic: Beyond user's capacity
- Too Complex: Too many hard problems
- Too Vague: Can't be validated
- Saturated Market: Too many competitors
- Wrong Timing: Too early or late

## VIABILITY INTERVENTION

When viability drops below 50%, pause and explain:

"I want to pause here and share something important.

Based on what I'm finding, this direction has some significant challenges:

1. [Specific concern with source URL]
2. [Specific concern with source URL]

This doesn't mean the idea is bad — but these are real obstacles.

[Present options as buttons]"

Options to offer:
- Explore how to address these challenges
- Pivot to a related but more viable direction
- Continue anyway — I understand the risks
- Discard and start fresh

## BUTTON USAGE

Present multiple choice options as buttons. Format:

When asking about customer type:
BUTTONS: [Individual consumers] [Small businesses] [Enterprise] [I'm not sure]

For viability interventions:
BUTTONS: [Address challenges] [Pivot direction] [Continue anyway] [Start fresh]

Always include an "unsure" or "skip" option.

## FORM USAGE

For multi-question efficient collection:
FORM:
- field: geography, type: radio, options: [My city only, National, Global, Flexible]
- field: product_type, type: checkbox, options: [Digital, Physical, Service, Marketplace]
- field: hours_per_week, type: slider, min: 0, max: 40

## WEB SEARCH

Use web search to:
- Validate market exists
- Find competitors
- Check for failed attempts
- Verify timing signals
- Support viability assessment

Always cite sources when sharing findings.

If search returns no data:
"I searched for [query] but found limited data. This could mean:
1. Emerging opportunity (first-mover or premature)
2. Different terminology exists
3. Primary research needed

Sources checked: [list]
My reasoning: [analysis]"

## CONVERSATION RULES

1. One question or focused form at a time
2. Mix question types to maintain engagement
3. Reference previous answers when relevant (explain why)
4. Include occasional witty one-liner (~10% of responses)
5. Keep tone neutral and curious
6. Never over-praise or be effusive
7. Be honest about challenges

**Witty interjections (use sparingly):**
- "Ah, the classic 'surely someone's solved this' moment. Usually they haven't, or they've done it poorly."
- "That's either a terrible idea or a brilliant one. Often the same thing."
- "Most people say 'everyone' when asked who'd use their idea. You didn't. That's good."

## WHAT NOT TO DO

- Don't always hide question purpose (reveal when helpful)
- Don't over-structure ("Question 7 of 20...")
- Don't push toward specific ideas
- Don't ignore user-suggested ideas
- Don't skip viability warnings
- Don't make users type when buttons work
- Don't re-ask profile questions (already captured)
- Don't get into implementation details (for Development phase)

## OUTPUT FORMAT

Your response must be valid JSON in this structure:
{
  "text": "Your conversational reply",
  "buttons": [
    {"id": "btn_1", "label": "Option 1", "value": "option_1", "style": "primary"},
    {"id": "btn_2", "label": "Option 2", "value": "option_2", "style": "secondary"}
  ] | null,
  "form": { ... } | null,
  "webSearchNeeded": ["query 1", "query 2"] | null,
  "candidateUpdate": {
    "title": "Idea title",
    "summary": "Brief summary"
  } | null,
  "signals": {
    "selfDiscovery": { ... },
    "marketDiscovery": { ... },
    "narrowing": { ... }
  }
}

## USER PROFILE
${USER_PROFILE_PLACEHOLDER}

## MEMORY FILES (if handoff)
${MEMORY_FILES_PLACEHOLDER}
`;
```

---

## 7. Frontend Components

### 7.1 Component Tree

```
IdeationPage
├── IdeationEntryModal (entry point choice)
│   ├── EntryOption (I have an idea)
│   └── EntryOption (Help me discover)
│
└── IdeationSession (main container)
    ├── ConversationPanel (left side)
    │   ├── MessageList
    │   │   ├── AgentMessage
    │   │   │   ├── MessageText
    │   │   │   ├── ButtonGroup (if buttons)
    │   │   │   └── FormRenderer (if form)
    │   │   └── UserMessage
    │   │
    │   └── InputArea
    │       ├── TextInput
    │       └── SendButton
    │
    └── IdeaCandidatePanel (right side)
        ├── EmptyState
        ├── FormingState
        ├── ActiveState
        │   ├── CandidateTitle
        │   ├── ConfidenceMeter
        │   ├── ViabilityMeter
        │   └── ActionButtons
        └── WarningState
```

### 7.2 Key Component Interfaces

```typescript
// IdeationSession.tsx
interface IdeationSessionProps {
  sessionId: string;
  profileId: string;
  onComplete: (ideaId: string) => void;
  onExit: () => void;
}

// MessageList.tsx
interface MessageListProps {
  messages: IdeationMessage[];
  onButtonClick: (buttonId: string, buttonValue: string) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
  isLoading: boolean;
}

// ButtonGroup.tsx
interface ButtonGroupProps {
  buttons: ButtonOption[];
  onSelect: (buttonId: string, buttonValue: string) => void;
  disabled: boolean;
}

// FormRenderer.tsx
interface FormRendererProps {
  form: FormDefinition;
  onSubmit: (answers: Record<string, unknown>) => void;
  onCancel: () => void;
}

// IdeaCandidatePanel.tsx
interface IdeaCandidatePanelProps {
  candidate: IdeaCandidate | null;
  onCapture: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onContinue: () => void;
}

// ConfidenceMeter.tsx
interface ConfidenceMeterProps {
  value: number;  // 0-100
  showLabel: boolean;
}

// ViabilityMeter.tsx
interface ViabilityMeterProps {
  value: number;  // 0-100
  risks: ViabilityRisk[];
  showWarning: boolean;
}
```

---

## 8. Test Specifications

### 8.1 Unit Tests

#### 8.1.1 Confidence Calculator Tests

```typescript
describe('ConfidenceCalculator', () => {
  describe('calculateConfidence', () => {

    // =========================================================================
    // PROBLEM DEFINITION COMPONENT (0-25 points)
    // =========================================================================

    test('PASS: High-severity frustration adds 10 points', () => {
      const input = createBaseInput({
        selfDiscovery: {
          frustrations: [{ description: 'X', source: 'user', severity: 'high' }],
        },
      });
      const result = calculateConfidence(input);
      expect(result.components.problemDefinition).toBeGreaterThanOrEqual(10);
    });

    test('PASS: Low-severity frustration adds only 5 points', () => {
      const input = createBaseInput({
        selfDiscovery: {
          frustrations: [{ description: 'X', source: 'user', severity: 'low' }],
        },
      });
      const result = calculateConfidence(input);
      expect(result.components.problemDefinition).toBeLessThan(10);
      expect(result.components.problemDefinition).toBeGreaterThanOrEqual(5);
    });

    test('PASS: No frustrations = 0 points for that component', () => {
      const input = createBaseInput({
        selfDiscovery: { frustrations: [] },
        marketDiscovery: { gaps: [] },
      });
      const result = calculateConfidence(input);
      expect(result.components.problemDefinition).toBe(0);
      expect(result.missingAreas).toContain('specific problem or frustration');
    });

    test('PASS: Market gaps add to problem definition', () => {
      const input = createBaseInput({
        marketDiscovery: {
          gaps: [{ description: 'Gap', evidence: 'url', relevance: 'high' }],
        },
      });
      const result = calculateConfidence(input);
      expect(result.components.problemDefinition).toBeGreaterThanOrEqual(10);
    });

    // =========================================================================
    // TARGET USER COMPONENT (0-20 points)
    // =========================================================================

    test('PASS: Narrowed customer type with high confidence adds 10 points', () => {
      const input = createBaseInput({
        narrowingState: {
          customerType: { value: 'B2B', confidence: 0.8 },
        },
      });
      const result = calculateConfidence(input);
      expect(result.components.targetUser).toBeGreaterThanOrEqual(10);
    });

    test('PASS: No customer type = missing area flagged', () => {
      const input = createBaseInput({
        narrowingState: {
          customerType: { value: null, confidence: 0 },
        },
      });
      const result = calculateConfidence(input);
      expect(result.missingAreas).toContain('clear target customer type');
    });

    // =========================================================================
    // TOTAL SCORE
    // =========================================================================

    test('PASS: Empty input returns 0 total', () => {
      const input = createEmptyInput();
      const result = calculateConfidence(input);
      expect(result.total).toBe(0);
    });

    test('PASS: Full input returns near-100 total', () => {
      const input = createFullInput();
      const result = calculateConfidence(input);
      expect(result.total).toBeGreaterThanOrEqual(90);
    });

    test('PASS: Total never exceeds 100', () => {
      const input = createOverflowInput();  // Input that would exceed bounds
      const result = calculateConfidence(input);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    test('PASS: Missing areas are correctly identified', () => {
      const input = createPartialInput();
      const result = calculateConfidence(input);
      expect(result.missingAreas.length).toBeGreaterThan(0);
    });
  });
});
```

#### 8.1.2 Viability Calculator Tests

```typescript
describe('ViabilityCalculator', () => {
  describe('calculateViability', () => {

    // =========================================================================
    // MARKET EXISTS COMPONENT
    // =========================================================================

    test('PASS: No market data reduces score by 15', () => {
      const input = createBaseViabilityInput({
        marketDiscovery: { competitors: [], gaps: [] },
      });
      const result = calculateViability(input);
      expect(result.components.marketExists).toBe(10);  // 25 - 15
    });

    test('PASS: Failed attempts without differentiation creates risk', () => {
      const input = createBaseViabilityInput({
        marketDiscovery: {
          failedAttempts: [{ what: 'X', why: 'Y', lesson: 'Z', source: 'url' }],
          gaps: [],
        },
      });
      const result = calculateViability(input);
      expect(result.risks.some(r => r.riskType === 'wrong_timing')).toBe(true);
    });

    // =========================================================================
    // TECHNICAL FEASIBILITY COMPONENT
    // =========================================================================

    test('PASS: "impossible" in search results triggers critical risk', () => {
      const input = createBaseViabilityInput({
        webSearchResults: [{
          title: 'Article',
          url: 'http://example.com',
          snippet: 'This technology is impossible with current methods',
          source: 'TechSite',
        }],
      });
      const result = calculateViability(input);
      expect(result.risks.some(r => r.riskType === 'impossible')).toBe(true);
      expect(result.risks.some(r => r.severity === 'critical')).toBe(true);
    });

    test('PASS: Multiple skill gaps reduce feasibility', () => {
      const input = createBaseViabilityInput({
        selfDiscovery: {
          skills: {
            identified: [],
            gaps: ['gap1', 'gap2', 'gap3'],
            strengths: [],
          },
        },
      });
      const result = calculateViability(input);
      expect(result.components.technicalFeasibility).toBeLessThan(20);
    });

    // =========================================================================
    // COMPETITIVE SPACE COMPONENT
    // =========================================================================

    test('PASS: 10+ competitors triggers saturated_market risk', () => {
      const competitors = Array.from({ length: 12 }, (_, i) => ({
        name: `Competitor ${i}`,
        description: 'Desc',
        strengths: [],
        weaknesses: [],
        source: 'url',
      }));
      const input = createBaseViabilityInput({
        marketDiscovery: { competitors },
      });
      const result = calculateViability(input);
      expect(result.risks.some(r => r.riskType === 'saturated_market')).toBe(true);
    });

    // =========================================================================
    // RESOURCE REALITY COMPONENT
    // =========================================================================

    test('PASS: Bootstrap user with high capital requirements = risk', () => {
      const input = createBaseViabilityInput({
        selfDiscovery: {
          constraints: { capital: 'bootstrap' },
        },
        webSearchResults: [{
          title: 'Startup Guide',
          url: 'http://example.com',
          snippet: 'Typically requires $5 million in funding',
          source: 'VentureBeat',
        }],
      });
      const result = calculateViability(input);
      expect(result.risks.some(r => r.riskType === 'unrealistic')).toBe(true);
    });

    test('PASS: Low time + high complexity = resource_mismatch', () => {
      const input = createBaseViabilityInput({
        selfDiscovery: {
          constraints: { timeHoursPerWeek: 5 },
        },
        narrowingState: {
          technicalDepth: { value: 'full_custom', confidence: 0.9 },
        },
      });
      const result = calculateViability(input);
      expect(result.risks.some(r => r.riskType === 'resource_mismatch')).toBe(true);
    });

    // =========================================================================
    // INTERVENTION TRIGGERS
    // =========================================================================

    test('PASS: Viability < 50 requires intervention', () => {
      const input = createLowViabilityInput();
      const result = calculateViability(input);
      expect(result.total).toBeLessThan(50);
      expect(result.requiresIntervention).toBe(true);
    });

    test('PASS: Critical risk requires intervention regardless of score', () => {
      const input = createBaseViabilityInput({
        webSearchResults: [{
          title: 'Analysis',
          url: 'http://example.com',
          snippet: 'This is technically impossible',
          source: 'Expert',
        }],
      });
      const result = calculateViability(input);
      expect(result.requiresIntervention).toBe(true);
    });

    test('PASS: Healthy viability (>75) does not require intervention', () => {
      const input = createHealthyViabilityInput();
      const result = calculateViability(input);
      expect(result.total).toBeGreaterThanOrEqual(75);
      expect(result.requiresIntervention).toBe(false);
    });
  });
});
```

#### 8.1.3 Token Counter Tests

```typescript
describe('TokenCounter', () => {
  describe('calculateTokenUsage', () => {

    test('PASS: Empty conversation returns baseline tokens', () => {
      const result = calculateTokenUsage([], '');
      expect(result.total).toBe(
        SYSTEM_PROMPT_ESTIMATE + PROFILE_ESTIMATE + MEMORY_FILES_ESTIMATE
      );
    });

    test('PASS: Token estimation is approximately 4 chars per token', () => {
      const message = 'a'.repeat(400);  // Should be ~100 tokens
      const result = calculateTokenUsage([], message);
      expect(result.currentMessage).toBeGreaterThanOrEqual(90);
      expect(result.currentMessage).toBeLessThanOrEqual(110);
    });

    test('PASS: shouldHandoff is true at 80k tokens', () => {
      const longHistory = createLongConversationHistory(75000);  // ~75k tokens
      const result = calculateTokenUsage(longHistory, 'new message');
      expect(result.shouldHandoff).toBe(true);
    });

    test('PASS: shouldHandoff is false below threshold', () => {
      const shortHistory = createShortConversationHistory();  // ~10k tokens
      const result = calculateTokenUsage(shortHistory, 'new message');
      expect(result.shouldHandoff).toBe(false);
    });

    test('PASS: percentUsed is calculated correctly', () => {
      const result = calculateTokenUsage([], '');
      expect(result.percentUsed).toBeCloseTo(
        (result.total / CONTEXT_LIMIT) * 100,
        1
      );
    });
  });
});
```

### 8.2 Integration Tests

```typescript
describe('Ideation API Integration', () => {

  // ===========================================================================
  // SESSION LIFECYCLE
  // ===========================================================================

  describe('POST /api/ideation/start', () => {

    test('PASS: Creates session with valid profile', async () => {
      const profile = await createTestProfile();
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: profile.id });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.greeting).toContain('Welcome');
    });

    test('FAIL: Returns 404 for invalid profile', async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: 'nonexistent' });

      expect(res.status).toBe(404);
    });

    test('FAIL: Returns 400 for missing profileId', async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/ideation/message', () => {

    test('PASS: Processes message and returns response', async () => {
      const session = await createTestSession();
      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId: session.id, message: 'I want to solve healthcare problems' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBeDefined();
      expect(typeof res.body.reply).toBe('string');
    });

    test('PASS: Returns buttons when appropriate', async () => {
      const session = await createTestSession();
      // Send message that should trigger buttons
      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId: session.id, message: 'I want to build something for businesses' });

      expect(res.status).toBe(200);
      // Buttons may or may not be present depending on agent response
      if (res.body.buttons) {
        expect(Array.isArray(res.body.buttons)).toBe(true);
        expect(res.body.buttons[0]).toHaveProperty('id');
        expect(res.body.buttons[0]).toHaveProperty('label');
        expect(res.body.buttons[0]).toHaveProperty('value');
      }
    });

    test('PASS: Updates confidence when signals detected', async () => {
      const session = await createTestSession();
      // Send messages that build confidence
      await sendMessage(session.id, 'I work in healthcare IT');
      await sendMessage(session.id, 'The biggest problem is data interoperability');
      await sendMessage(session.id, 'Specifically in emergency departments');

      const candidate = await getCandidateForSession(session.id);
      expect(candidate).toBeDefined();
      expect(candidate.confidence).toBeGreaterThan(30);
    });

    test('PASS: Triggers viability warning when risks detected', async () => {
      const session = await createTestSession();
      // Send message describing unrealistic idea
      const res = await request(app)
        .post('/api/ideation/message')
        .send({
          sessionId: session.id,
          message: 'I want to build a quantum computer for personal use with no budget'
        });

      // After a few exchanges, viability should flag concerns
      // This may take multiple messages to accumulate evidence
      expect(res.status).toBe(200);
    });

    test('PASS: Handles user-suggested ideas', async () => {
      const session = await createTestSession();
      const res = await request(app)
        .post('/api/ideation/message')
        .send({
          sessionId: session.id,
          message: 'What about a marketplace for vintage synthesizers?'
        });

      expect(res.status).toBe(200);
      expect(res.body.reply.toLowerCase()).toContain('explore');
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId: 'nonexistent', message: 'Hello' });

      expect(res.status).toBe(404);
    });

    test('FAIL: Returns 400 for completed session', async () => {
      const session = await createCompletedSession();
      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId: session.id, message: 'Hello' });

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // BUTTON INTERACTIONS
  // ===========================================================================

  describe('POST /api/ideation/button', () => {

    test('PASS: Button click is processed as message', async () => {
      const session = await createTestSession();
      // First, get a response with buttons
      await sendMessage(session.id, 'I want to build something');

      const res = await request(app)
        .post('/api/ideation/button')
        .send({
          sessionId: session.id,
          buttonId: 'btn_b2b',
          buttonValue: 'B2B businesses'
        });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBeDefined();
    });

    test('PASS: Button click is recorded in message history', async () => {
      const session = await createTestSession();
      await sendMessage(session.id, 'I want to build something');

      await request(app)
        .post('/api/ideation/button')
        .send({
          sessionId: session.id,
          buttonId: 'btn_test',
          buttonValue: 'Test value'
        });

      const messages = await getSessionMessages(session.id);
      const lastAssistantMsg = messages
        .filter(m => m.role === 'assistant')
        .pop();

      // Button click should be recorded
      expect(lastAssistantMsg.buttonClicked).toBe('btn_test');
    });
  });

  // ===========================================================================
  // CAPTURE FLOW
  // ===========================================================================

  describe('POST /api/ideation/capture', () => {

    test('PASS: Captures idea with valid candidate', async () => {
      const session = await createSessionWithCandidate();

      const res = await request(app)
        .post('/api/ideation/capture')
        .send({ sessionId: session.id });

      expect(res.status).toBe(200);
      expect(res.body.ideaId).toBeDefined();
      expect(res.body.ideaSlug).toBeDefined();
      expect(res.body.prePopulatedFields.title).toBeDefined();
    });

    test('PASS: Creates README with correct content', async () => {
      const session = await createSessionWithCandidate();

      const res = await request(app)
        .post('/api/ideation/capture')
        .send({ sessionId: session.id });

      const readme = await readFile(`ideas/${res.body.ideaSlug}/README.md`);
      expect(readme).toContain(res.body.prePopulatedFields.title);
      expect(readme).toContain('## Problem Statement');
    });

    test('PASS: Stores ideation metadata', async () => {
      const session = await createSessionWithCandidate();

      const res = await request(app)
        .post('/api/ideation/capture')
        .send({ sessionId: session.id });

      const metadata = await getIdeaMetadata(res.body.ideaId, 'ideation');
      expect(metadata.sessionId).toBe(session.id);
      expect(metadata.confidenceAtCapture).toBeDefined();
      expect(metadata.viabilityAtCapture).toBeDefined();
    });

    test('PASS: Completes session after capture', async () => {
      const session = await createSessionWithCandidate();

      await request(app)
        .post('/api/ideation/capture')
        .send({ sessionId: session.id });

      const updatedSession = await getSession(session.id);
      expect(updatedSession.status).toBe('completed');
    });

    test('FAIL: Returns 400 if no candidate exists', async () => {
      const session = await createTestSession();  // No candidate yet

      const res = await request(app)
        .post('/api/ideation/capture')
        .send({ sessionId: session.id });

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // HANDOFF
  // ===========================================================================

  describe('Agent Handoff', () => {

    test('PASS: Handoff preserves state in memory files', async () => {
      const session = await createLongSession();  // Near 80k tokens

      // Send message to trigger handoff
      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId: session.id, message: 'Continue exploring' });

      expect(res.body.handoffOccurred).toBe(true);

      // Verify memory files exist
      const memory = await getSessionMemory(session.id);
      expect(memory.selfDiscovery).toBeDefined();
      expect(memory.marketDiscovery).toBeDefined();
      expect(memory.handoffNotes).toBeDefined();
    });

    test('PASS: Conversation continues naturally after handoff', async () => {
      const session = await createLongSession();

      // Trigger handoff
      await request(app)
        .post('/api/ideation/message')
        .send({ sessionId: session.id, message: 'Tell me more' });

      // Send another message
      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId: session.id, message: 'What about the market?' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBeDefined();
      // Reply should reference prior context
    });

    test('PASS: Handoff count is incremented', async () => {
      const session = await createLongSession();

      await request(app)
        .post('/api/ideation/message')
        .send({ sessionId: session.id, message: 'Continue' });

      const updatedSession = await getSession(session.id);
      expect(updatedSession.handoffCount).toBe(1);
    });
  });
});
```

### 8.3 E2E Tests

```typescript
describe('Ideation Agent E2E', () => {

  describe('Complete Flow: User with no idea discovers one', () => {

    test('PASS: Full journey from start to capture', async () => {
      // 1. Start session
      const profile = await createTestProfile({
        interests: ['technology', 'healthcare'],
        skills: ['software development'],
        location: 'Sydney',
      });

      const startRes = await startSession(profile.id);
      const sessionId = startRes.sessionId;

      // 2. Initial exploration
      let res = await sendMessage(sessionId,
        "I've been frustrated with how hard it is to find good doctors in Sydney"
      );
      expect(res.reply).toBeDefined();

      // 3. Answer follow-up questions
      res = await sendMessage(sessionId,
        "Specifically, finding specialists who bulk bill and have availability"
      );
      expect(res.reply).toBeDefined();

      // 4. Provide more context
      res = await sendMessage(sessionId,
        "I've worked in healthcare IT for 5 years, I understand how the systems work"
      );
      expect(res.reply).toBeDefined();

      // 5. Check that candidate has formed
      const candidate = await getCandidateForSession(sessionId);
      expect(candidate).toBeDefined();
      expect(candidate.confidence).toBeGreaterThan(30);

      // 6. Continue to build confidence
      res = await sendMessage(sessionId,
        "Yes, I think B2C targeting patients directly would work best"
      );

      // 7. Verify viability is being tracked
      expect(candidate.viability).toBeDefined();

      // 8. Capture the idea
      const captureRes = await captureIdea(sessionId);
      expect(captureRes.ideaId).toBeDefined();

      // 9. Verify idea was created correctly
      const idea = await getIdea(captureRes.ideaId);
      expect(idea.title).toBeDefined();
      expect(idea.stage).toBe('SPARK');
    });
  });

  describe('Complete Flow: User suggests their own idea', () => {

    test('PASS: User-suggested idea is explored and captured', async () => {
      const profile = await createTestProfile();
      const startRes = await startSession(profile.id);
      const sessionId = startRes.sessionId;

      // 1. User suggests idea immediately
      let res = await sendMessage(sessionId,
        "I've been thinking about building a marketplace for vintage synthesizers"
      );

      // Agent should acknowledge and explore
      expect(res.reply.toLowerCase()).toMatch(/explore|interesting|tell me/);

      // 2. Provide context
      res = await sendMessage(sessionId,
        "I've been buying and selling synths for 10 years, I know the community well"
      );

      // 3. Continue exploration
      res = await sendMessage(sessionId,
        "The main problem with Reverb is the fees and it's not specialized for synths"
      );

      // 4. Candidate should form with user_suggested flag
      const candidate = await getCandidateForSession(sessionId);
      expect(candidate).toBeDefined();
      expect(candidate.userSuggested).toBe(true);

      // 5. Capture
      const captureRes = await captureIdea(sessionId);
      expect(captureRes.ideaId).toBeDefined();
    });
  });

  describe('Complete Flow: Viability intervention', () => {

    test('PASS: User is warned about unviable idea', async () => {
      const profile = await createTestProfile({
        capital: 'bootstrap',
        hoursPerWeek: 10,
      });
      const startRes = await startSession(profile.id);
      const sessionId = startRes.sessionId;

      // 1. Propose difficult idea
      let res = await sendMessage(sessionId,
        "I want to build an autonomous vehicle company"
      );

      // 2. Continue with unrealistic parameters
      res = await sendMessage(sessionId,
        "I want to do this solo with no funding"
      );

      // 3. Check for intervention
      // Viability should trigger warning
      expect(res.intervention).toBeDefined();
      expect(res.intervention.type).toMatch(/warning|critical/);
      expect(res.intervention.risks.length).toBeGreaterThan(0);

      // 4. User acknowledges and pivots
      res = await clickButton(sessionId, 'btn_pivot');

      // 5. Conversation continues with new direction
      expect(res.reply).toBeDefined();
    });

    test('PASS: User can continue despite warnings', async () => {
      const profile = await createTestProfile();
      const startRes = await startSession(profile.id);
      const sessionId = startRes.sessionId;

      // Set up risky idea...
      await sendMessage(sessionId, "I want to compete with Google Search");

      // Get intervention
      const res = await sendMessage(sessionId, "I know it's hard but I want to try");

      if (res.intervention) {
        // Click "continue anyway"
        const continueRes = await clickButton(sessionId, 'btn_continue_anyway');

        // Conversation should continue
        expect(continueRes.reply).toBeDefined();

        // Viability is still tracked
        const candidate = await getCandidateForSession(sessionId);
        expect(candidate.viability).toBeLessThan(50);
      }
    });
  });

  describe('Complete Flow: Save for later', () => {

    test('PASS: Idea is saved to Ideas list', async () => {
      const profile = await createTestProfile();
      const startRes = await startSession(profile.id);
      const sessionId = startRes.sessionId;

      // Build up a candidate
      await sendMessage(sessionId, "Healthcare scheduling problems");
      await sendMessage(sessionId, "For small clinics specifically");
      await sendMessage(sessionId, "I have 10 years in healthcare IT");

      // Save for later
      const saveRes = await saveForLater(sessionId);
      expect(saveRes.savedCandidateId).toBeDefined();

      // Verify it's in Ideas list with saved status
      const candidate = await getCandidate(saveRes.savedCandidateId);
      expect(candidate.status).toBe('saved');
    });
  });
});
```

---

## 9. Error Handling

### 9.1 Error Categories

```typescript
// Custom error classes
class IdeationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IdeationError';
  }
}

// Specific errors
class SessionNotFoundError extends IdeationError {
  constructor(sessionId: string) {
    super(
      `Session not found: ${sessionId}`,
      'SESSION_NOT_FOUND',
      404,
      { sessionId }
    );
  }
}

class SessionNotActiveError extends IdeationError {
  constructor(sessionId: string, status: string) {
    super(
      `Session is not active: ${sessionId} (status: ${status})`,
      'SESSION_NOT_ACTIVE',
      400,
      { sessionId, status }
    );
  }
}

class NoCandidateError extends IdeationError {
  constructor(sessionId: string) {
    super(
      `No idea candidate exists for session: ${sessionId}`,
      'NO_CANDIDATE',
      400,
      { sessionId }
    );
  }
}

class ProfileNotFoundError extends IdeationError {
  constructor(profileId: string) {
    super(
      `Profile not found: ${profileId}`,
      'PROFILE_NOT_FOUND',
      404,
      { profileId }
    );
  }
}

class AgentResponseError extends IdeationError {
  constructor(message: string, rawResponse?: string) {
    super(
      `Agent response error: ${message}`,
      'AGENT_RESPONSE_ERROR',
      500,
      { rawResponse }
    );
  }
}

class WebSearchError extends IdeationError {
  constructor(query: string, originalError: Error) {
    super(
      `Web search failed for query: ${query}`,
      'WEB_SEARCH_ERROR',
      500,
      { query, originalError: originalError.message }
    );
  }
}

class HandoffError extends IdeationError {
  constructor(sessionId: string, step: string, originalError: Error) {
    super(
      `Handoff failed at step: ${step}`,
      'HANDOFF_ERROR',
      500,
      { sessionId, step, originalError: originalError.message }
    );
  }
}
```

### 9.2 Error Handling Middleware

```typescript
// Global error handler
function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Ideation API Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof IdeationError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        context: err.context,
      },
    });
  }

  // Unknown errors
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
```

---

## 10. Performance Requirements

### 10.1 Response Time Targets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Start session | 500ms | 2s |
| Send message (no search) | 3s | 10s |
| Send message (with search) | 5s | 15s |
| Button click | 3s | 10s |
| Capture idea | 1s | 3s |
| Handoff | 2s | 5s |

### 10.2 Throughput Requirements

| Metric | Target |
|--------|--------|
| Concurrent sessions | 100 |
| Messages per minute per session | 10 |
| Web searches per session | 20 |

### 10.3 Resource Limits

| Resource | Limit |
|----------|-------|
| Max session duration | 4 hours |
| Max messages per session | 500 |
| Max token count before handoff | 80,000 |
| Max web searches per message | 3 |
| Max candidates per session | 10 (historical) |
| Max risks per candidate | 20 |

---

## 11. Security Considerations

### 11.1 Input Validation

```typescript
// All inputs must be validated
const messageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(10000),
});

const buttonSchema = z.object({
  sessionId: z.string().uuid(),
  buttonId: z.string().min(1).max(100),
  buttonValue: z.string().min(1).max(1000),
});
```

### 11.2 Rate Limiting

```typescript
// Rate limits per session
const rateLimits = {
  messagesPerMinute: 10,
  webSearchesPerMinute: 5,
  capturesPerHour: 10,
};
```

### 11.3 Data Privacy

- User profile data is only used for personalization
- Conversation content is stored encrypted at rest
- Web search queries do not include PII
- Session data is deleted after 30 days of inactivity

---

*Document Version: 1.0*
*Created: 2025-12-30*
*Status: Implementation Ready*
