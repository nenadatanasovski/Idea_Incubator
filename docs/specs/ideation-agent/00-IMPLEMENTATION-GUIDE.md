# Ideation Agent Implementation Guide

> A First-Principles Developer Reference for Building the Conversational Idea Discovery System

## Table of Contents

1. [System Overview](#system-overview)
2. [First Principles Analysis](#first-principles-analysis)
3. [Architectural Flow](#architectural-flow)
4. [Implementation Phases](#implementation-phases)
5. [Spec-by-Spec Breakdown](#spec-by-spec-breakdown)
6. [Cross-Spec Dependencies](#cross-spec-dependencies)
7. [Master Implementation Checklist](#master-implementation-checklist)
8. [Testing Strategy](#testing-strategy)

---

## System Overview

The Ideation Agent is a conversational AI system that guides users from vague interests to well-defined, validated business ideas. It replaces the static "capture" CLI with an interactive, intelligent discovery experience.

### Core Value Proposition

**Problem**: Users often know they want to build something but can't articulate what. The current capture process assumes users already have a formed idea.

**Solution**: A conversational agent that:
- Discovers user interests, skills, and constraints through natural dialogue
- Searches the web for market validation in real-time
- Builds idea candidates progressively as confidence grows
- Intervenes when viability risks are detected
- Outputs capture-ready ideas with pre-answered development questions

### Key Metrics (Dual Metering System)

| Metric | Purpose | Range | Threshold |
|--------|---------|-------|-----------|
| **Confidence** | How well-defined is the idea? | 0-100 | Display at 30%, Ready at 75% |
| **Viability** | How realistic/achievable is it? | 0-100 | Healthy 75+, Caution 50-74, Warning 25-49, Critical <25 |

---

## First Principles Analysis

### Why This Architecture?

**Principle 1: Conversation is Discovery**
- Ideas don't emerge fully formed; they crystallize through dialogue
- Each user message reveals signals about interests, expertise, and constraints
- The agent must extract meaning covertly (not interrogate)

**Principle 2: Evidence Over Opinion**
- Viability must be grounded in real market data
- Web search provides external validation/invalidation
- Risks must cite sources, not just assert problems

**Principle 3: Progressive Revelation**
- Don't show candidates until they're meaningful (30% threshold)
- Don't alarm about risks until they're significant
- Intervention should feel helpful, not gatekeeping

**Principle 4: Preserve Context, Survive Limits**
- 100K token context window will eventually fill
- Memory files persist insights across handoffs
- Handoff should feel seamless to the user

**Principle 5: Integration, Not Isolation**
- Ideas captured here feed directly into the Development phase
- Pre-answered questions reduce redundant questioning
- Metadata (confidence, viability, risks) travels with the idea

---

## Architectural Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React)                                                        │
│  ┌───────────────────────────┐  ┌─────────────────────────────────────┐ │
│  │   Conversation Panel      │  │     Idea Candidate Panel            │ │
│  │   - Message list          │  │     - Empty/Forming/Active/Warning  │ │
│  │   - Button/Form rendering │  │     - Confidence & Viability meters │ │
│  │   - Streaming text        │  │     - Risks list                    │ │
│  │   - Input area            │  │     - Action buttons                │ │
│  └───────────────────────────┘  └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ REST API + SSE
┌─────────────────────────────────────────────────────────────────────────┐
│  BACKEND (Express + WebSocket)                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Routes    │  │  Orchestrator│  │ Calculators  │  │ Signal        │ │
│  │   /start    │──│  processMsg  │──│ Confidence   │  │ Extraction    │ │
│  │   /message  │  │  webSearch   │  │ Viability    │  │ (LLM+Rules)   │ │
│  │   /capture  │  │  streaming   │  │ Tokens       │  │               │ │
│  └─────────────┘  └─────────────┘  └──────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  DATA LAYER (SQLite)                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Sessions   │  │   Messages   │  │  Candidates  │  │   Memory    │ │
│  │   (tracking) │  │  (history)   │  │  (forming)   │  │   Files     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Specs 01-03)
**Goal**: Establish data structures and core algorithms

| Component | Spec | Priority | Complexity |
|-----------|------|----------|------------|
| Database Migration | 01 | Critical | Low |
| TypeScript Types | 01 | Critical | Low |
| Row Mappers | 01 | Critical | Low |
| Confidence Calculator | 02 | Critical | Medium |
| Viability Calculator | 02 | Critical | Medium |
| Token Counter | 02 | High | Low |
| Communication Classifier | 03 | Medium | Medium |
| Pre-Answered Mapper | 03 | Medium | Medium |

### Phase 2: Core Backend (Specs 04-06)
**Goal**: Build session management and agent orchestration

| Component | Spec | Priority | Complexity |
|-----------|------|----------|------------|
| SessionManager | 04 | Critical | Medium |
| MessageStore | 04 | Critical | Low |
| MemoryManager | 04 | Critical | Medium |
| Signal Extraction | 05 | Critical | High |
| AgentOrchestrator | 06 | Critical | High |
| GreetingGenerator | 06 | High | Low |
| StreamingHandler | 06 | High | Medium |
| WebSearchService | 06 | High | Medium |

### Phase 3: API Layer (Spec 07)
**Goal**: Expose functionality via REST endpoints

| Component | Spec | Priority | Complexity |
|-----------|------|----------|------------|
| Route Registration | 07 | Critical | Low |
| /start endpoint | 07 | Critical | Medium |
| /message endpoint | 07 | Critical | High |
| /button endpoint | 07 | High | Low |
| /form endpoint | 07 | High | Medium |
| /capture endpoint | 07 | Critical | Medium |
| /save endpoint | 07 | Medium | Low |
| /discard endpoint | 07 | Medium | Low |
| Error Classes | 07 | High | Low |
| CandidateManager | 07 | Critical | Medium |

### Phase 4: Frontend (Specs 08-09)
**Goal**: Build the interactive UI

| Component | Spec | Priority | Complexity |
|-----------|------|----------|------------|
| TypeScript Types | 08 | Critical | Low |
| IdeationPage | 08 | Critical | Low |
| IdeationEntryModal | 08 | Critical | Low |
| IdeationSession | 08 | Critical | High |
| ConversationPanel | 08 | Critical | Medium |
| MessageList/Components | 08 | Critical | Medium |
| ButtonGroup | 08 | Critical | Low |
| FormRenderer | 08 | High | Medium |
| IdeaCandidatePanel | 08 | Critical | Medium |
| ConfidenceMeter | 08 | High | Low |
| ViabilityMeter | 08 | High | Low |
| RisksList | 08 | High | Low |
| InputArea | 08 | Critical | Low |
| ideationReducer | 09 | Critical | Medium |
| useIdeationAPI | 09 | Critical | Medium |
| useSSEStream | 09 | Medium | Medium |

---

## Spec-by-Spec Breakdown

### Spec 01: Database & Data Models
> **Spec File**: [`01-database-data-models.md`](./01-database-data-models.md)

**Purpose**: Foundation for all data persistence

**Key Deliverables**:
- Migration `018_ideation_agent.sql`
- Types file `types/ideation.ts`
- Mappers `utils/ideation-mappers.ts`
- Defaults `utils/ideation-defaults.ts`

**Core Tables**:
| Table | Purpose |
|-------|---------|
| `ideation_sessions` | Session lifecycle tracking |
| `ideation_messages` | Conversation history |
| `ideation_memory` | Memory files (self_discovery, market_discovery, etc.) |
| `ideation_candidates` | Idea candidates with confidence/viability |
| `ideation_viability_risks` | Risk tracking with evidence |
| `ideation_searches` | Web search cache |
| `ideation_signals` | Extracted signal log |

**Test Count**: 18 pass, 4 expected fail (constraint violations)

---

### Spec 02: Core Calculators
> **Spec File**: [`02-core-calculators.md`](./02-core-calculators.md)

**Purpose**: The dual metering system algorithms

**Confidence Calculator** (0-100):
| Component | Max Points |
|-----------|------------|
| Problem Definition | 25 |
| Target User | 20 |
| Solution Direction | 20 |
| Differentiation | 20 |
| User Fit | 15 |

**Viability Calculator** (starts at 100, subtracts):
| Component | Max Points |
|-----------|------------|
| Market Exists | 25 |
| Technical Feasibility | 20 |
| Competitive Space | 20 |
| Resource Reality | 20 |
| Clarity Score | 15 |

**Token Counter**:
- Context limit: 100,000 tokens
- Handoff threshold: 80,000 tokens (80%)
- Estimation: ~4 chars per token

**Test Count**: 70+ tests

---

### Spec 03: Core Utilities
> **Spec File**: [`03-core-utilities.md`](./03-core-utilities.md)

**Purpose**: Supporting utilities for personalization and handoff

**Communication Classifier**:
- Analyzes user message patterns
- Outputs: `verbose` | `terse` | `analytical` | `emotional`
- Used for agent tone adaptation

**Pre-Answered Questions Mapper**:
- Maps ideation signals → Development questions
- Example: `narrowingState.customerType` → `DEV_TARGET_USER`
- Includes confidence thresholds and evidence quotes

**Context Helpers**:
- `extractSurroundingContext()` - Get conversation window
- `extractTopicFromContext()` - Identify current topic
- `generateBriefSummary()` - Create handoff summaries

---

### Spec 04: Session Management & Memory
> **Spec File**: [`04-session-management.md`](./04-session-management.md)

**Purpose**: Persistent session state and handoff preparation

**SessionManager**:
- `create(profileId)` → new session
- `load(sessionId)` → restore session
- `update(sessionId, changes)` → modify state
- `complete(sessionId)` → mark done
- `abandon(sessionId)` → mark abandoned

**MessageStore**:
- CRUD for conversation messages
- Token counting per message
- Button/form tracking

**MemoryManager**:
Memory file types:
| Type | Purpose |
|------|---------|
| `self_discovery` | User interests, skills, constraints |
| `market_discovery` | Competitors, gaps, timing |
| `narrowing_state` | Product/customer type narrowing |
| `conversation_summary` | High-level progress |
| `idea_candidate` | Current candidate details |
| `viability_assessment` | Risk analysis |
| `handoff_notes` | Context for new agent |

**Handoff Preparation**:
- Triggered at 80% token usage
- Compresses context into memory files
- Creates handoff notes with communication style

---

### Spec 05: Signal Extraction
> **Spec File**: [`05-signal-extraction.md`](./05-signal-extraction.md)

**Purpose**: Extract meaning from user messages

**Extraction Approach**: Hybrid LLM + Rule-based

**Signal Categories**:
| Category | Examples |
|----------|----------|
| Frustrations | Problems, pain points, complaints |
| Customer Type | B2B, B2C, Marketplace, SMB |
| Product Type | Digital, Physical, Service, Marketplace |
| Geography | Local, National, Global |
| Expertise | Domain knowledge with depth levels |
| Interests | Topics with genuine engagement signals |
| Constraints | Time, capital, location, risk tolerance |
| Impact Vision | World/Country/City/Community/Individual |

**Rule-Based Patterns**:
```javascript
// Frustration detection
/I hate|I can't stand|It frustrates me|Why isn't there/i

// Customer type
/sell to (businesses|companies)/i → B2B
/consumers|individuals|people/i → B2C
```

---

### Spec 06: Agent Orchestration & LLM Integration
> **Spec File**: [`06-agent-orchestration.md`](./06-agent-orchestration.md)

**Purpose**: The conversational AI core

**System Prompt Key Points**:
- Dual-mode questioning (covert vs transparent)
- Signal extraction in parallel
- Web search triggering rules
- Intervention protocols
- Handoff preparation

**AgentOrchestrator**:
```typescript
interface ProcessResult {
  reply: string;
  buttons?: ButtonOption[];
  form?: FormDefinition;
  candidateUpdate?: CandidateUpdate;
  confidence: number;
  viability: number;
  requiresIntervention: boolean;
  handoffOccurred: boolean;
}
```

**GreetingGenerator**:
- Personalized based on profile
- Entry mode variants (have_idea vs discover)
- Initial button options

**StreamingResponseHandler**:
- SSE implementation
- Chunk-by-chunk delivery
- Error handling

**WebSearchService**:
- Query construction from context
- Result parsing
- Market data extraction

---

### Spec 07: API Endpoints
> **Spec File**: [`07-api-endpoints.md`](./07-api-endpoints.md)

**Purpose**: RESTful interface to backend

**Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/ideation/start` | Create session, get greeting |
| POST | `/api/ideation/message` | Send message, get response |
| POST | `/api/ideation/message/stream` | SSE streaming version |
| POST | `/api/ideation/button` | Handle button click |
| POST | `/api/ideation/form` | Handle form submission |
| POST | `/api/ideation/capture` | Capture idea to system |
| POST | `/api/ideation/save` | Save for later |
| POST | `/api/ideation/discard` | Discard and restart |
| GET | `/api/ideation/session/:id` | Get session details |
| POST | `/api/ideation/session/:id/abandon` | Abandon session |
| GET | `/api/ideation/sessions` | List profile's sessions |

**CandidateManager**:
- `create()`, `getById()`, `getActiveForSession()`
- `getOrCreateForSession()` - upsert pattern
- `update()`, `discard()`, `save()`

**Error Classes**:
- `SessionNotFoundError` (404)
- `SessionNotActiveError` (400)
- `ValidationError` (400)
- `ContextLimitError` (400)
- `AgentProcessingError` (500)

**Test Count**: 46 tests

---

### Spec 08: Frontend Components
> **Spec File**: [`08-frontend-components.md`](./08-frontend-components.md)

**Purpose**: React component implementations

**Component Tree**:
```
IdeationPage
├── IdeationEntryModal
│   └── EntryOption
└── IdeationSession
    ├── SessionHeader
    │   └── TokenUsageIndicator
    ├── ConversationPanel
    │   ├── MessageList
    │   │   ├── AgentMessage
    │   │   │   ├── MessageText
    │   │   │   ├── ButtonGroup
    │   │   │   ├── FormRenderer
    │   │   │   └── SourceCitations
    │   │   └── UserMessage
    │   ├── TypingIndicator
    │   └── InputArea
    └── IdeaCandidatePanel
        ├── EmptyState
        ├── FormingState
        ├── ActiveState
        └── WarningState
```

**Key Thresholds**:
- Candidate appears: 30% confidence
- Capture enabled: 60% confidence

---

### Spec 09: Frontend State & Hooks
> **Spec File**: [`09-frontend-state-hooks.md`](./09-frontend-state-hooks.md)

**Purpose**: State management and API integration

**State Structure** (IdeationStore):
```typescript
{
  session: { sessionId, profileId, status, entryMode, error },
  conversation: { messages, isLoading, isStreaming, streamingContent, error },
  candidate: { candidate, confidence, viability, risks, showIntervention },
  tokens: { usage, handoffPending, handoffCount }
}
```

**Actions**:
- Session: `START`, `CREATED`, `ERROR`, `COMPLETE`, `ABANDON`
- Message: `SEND`, `STREAM_START`, `STREAM_CHUNK`, `STREAM_END`, `RECEIVED`, `ERROR`
- Candidate: `UPDATE`, `CLEAR`, `CONFIDENCE_UPDATE`, `VIABILITY_UPDATE`
- Intervention: `SHOW`, `DISMISS`
- Tokens: `UPDATE`, `HANDOFF_PENDING`, `HANDOFF_COMPLETE`

**Hooks**:
- `useIdeationAPI()` - API client methods
- `useSSEStream()` - SSE connection management

**Test Count**: 95 tests

---

## Cross-Spec Dependencies

```
Spec 01 ──────────────────────────────────────┐
   │                                          │
   ▼                                          ▼
Spec 02 ─────────────────────────────────> Spec 03
   │                                          │
   ▼                                          ▼
Spec 04 <─────────────────────────────────────┤
   │                                          │
   ▼                                          ▼
Spec 05 ──────────────────────────────────────┤
   │                                          │
   ▼                                          │
Spec 06 <─────────────────────────────────────┘
   │
   ▼
Spec 07
   │
   ▼
Spec 08 ─────────────> Spec 09
```

**Critical Path**: 01 → 02 → 04 → 06 → 07 → 08

---

## Master Implementation Checklist

### Phase 1: Foundation ✅ COMPLETE

#### Spec 01: Database & Data Models
- [x] Create migration `database/migrations/018_ideation_agent.sql`
- [x] Create types file `types/ideation.ts`
- [x] Create mappers file `utils/ideation-mappers.ts`
- [x] Create defaults file `utils/ideation-defaults.ts`
- [x] Create test file `tests/ideation/data-models.test.ts`
- [x] Run migration: `npm run migrate`
- [x] Run tests and verify 23 pass (all schema and mapper tests)

#### Spec 02: Core Calculators
- [x] Create `agents/ideation/` directory
- [x] Create `agents/ideation/confidence-calculator.ts`
- [x] Create `agents/ideation/viability-calculator.ts`
- [x] Create `agents/ideation/token-counter.ts`
- [x] Create `tests/ideation/confidence-calculator.test.ts`
- [x] Create `tests/ideation/viability-calculator.test.ts`
- [x] Create `tests/ideation/token-counter.test.ts`
- [x] Run tests and verify 90 pass (34 confidence + 32 viability + 24 token)

#### Spec 03: Core Utilities
- [x] Create `agents/ideation/communication-classifier.ts`
- [x] Create `agents/ideation/pre-answered-mapper.ts`
- [x] Create `agents/ideation/context-helpers.ts`
- [x] Create tests for communication classifier (10 tests)
- [x] Create tests for pre-answered mapper (19 tests)

### Phase 2: Core Backend ✅ COMPLETE

#### Spec 04: Session Management
- [x] Create `agents/ideation/session-manager.ts`
- [x] Create `agents/ideation/message-store.ts`
- [x] Create `agents/ideation/memory-manager.ts`
- [x] Create `agents/ideation/handoff.ts`
- [x] Create `agents/ideation/greeting-generator.ts`
- [x] Implement handoff preparation logic
- [x] Create tests for all managers (37 tests: 13 session + 13 message + 12 memory)

#### Spec 05: Signal Extraction
- [x] Create `agents/ideation/signal-extractor.ts`
- [x] Create `agents/ideation/vagueness-detector.ts`
- [x] Implement LLM extraction prompts
- [x] Implement rule-based fallback patterns
- [x] Create frustration detection patterns
- [x] Create customer/product type extraction
- [x] Create geography/expertise extraction
- [x] Create interest/passion detection
- [x] Create impact vision extraction
- [x] Create market data extraction from web search
- [x] Create comprehensive tests (71 tests: 34 signal + 37 vagueness)

#### Spec 06: Agent Orchestration
- [x] Create `agents/ideation/orchestrator.ts`
- [x] Create `agents/ideation/greeting-generator.ts`
- [x] Create `agents/ideation/streaming.ts`
- [x] Create `agents/ideation/web-search-service.ts`
- [x] Create `agents/ideation/system-prompt.ts`
- [x] Create `agents/ideation/witty-interjections.ts`
- [x] Implement system prompt
- [x] Implement processMessage flow
- [x] Create tests for orchestration (70 tests: 19 orchestrator + 12 streaming + 20 web-search + 19 witty)

### Phase 3: API Layer ✅ COMPLETE

#### Spec 07: API Endpoints
- [x] Add ideation route registration to `server/api.ts`
- [x] Create `server/routes/ideation.ts`
- [x] Implement POST `/start` endpoint
- [x] Implement POST `/message` endpoint
- [x] Implement POST `/message/stream` endpoint
- [x] Implement POST `/button` endpoint
- [x] Implement POST `/form` endpoint
- [x] Implement POST `/capture` endpoint
- [x] Implement POST `/save` endpoint
- [x] Implement POST `/discard` endpoint
- [x] Implement GET `/session/:id` endpoint
- [x] Implement POST `/session/:id/abandon` endpoint
- [x] Implement GET `/sessions` endpoint
- [x] Create `server/errors/ideation-errors.ts`
- [x] Create `agents/ideation/candidate-manager.ts`
- [x] Create `tests/ideation/api-endpoints.test.ts`
- [x] Create `tests/ideation/error-classes.test.ts`
- [x] Run tests and verify 47 pass (exceeds expected 46)

### Phase 4: Frontend ✅ COMPLETE

#### Spec 08: Frontend Components
- [x] Create `frontend/src/types/ideation.ts`
- [x] Create `frontend/src/types/ideation-state.ts`
- [x] Create `frontend/src/pages/IdeationPage.tsx`
- [x] Create `frontend/src/components/ideation/IdeationEntryModal.tsx`
- [x] Create `frontend/src/components/ideation/IdeationSession.tsx`
- [x] Create `frontend/src/components/ideation/SessionHeader.tsx`
- [x] Create `frontend/src/components/ideation/TokenUsageIndicator.tsx`
- [x] Create `frontend/src/components/ideation/ConversationPanel.tsx`
- [x] Create `frontend/src/components/ideation/MessageList.tsx`
- [x] Create `frontend/src/components/ideation/AgentMessage.tsx`
- [x] Create `frontend/src/components/ideation/UserMessage.tsx`
- [x] Create `frontend/src/components/ideation/MessageText.tsx`
- [x] Create `frontend/src/components/ideation/ButtonGroup.tsx`
- [x] Create `frontend/src/components/ideation/FormRenderer.tsx`
- [x] Create `frontend/src/components/ideation/SourceCitations.tsx`
- [x] Create `frontend/src/components/ideation/InputArea.tsx`
- [x] Create `frontend/src/components/ideation/TypingIndicator.tsx`
- [x] Create `frontend/src/components/ideation/IdeaCandidatePanel.tsx`
- [x] Create `frontend/src/components/ideation/ConfidenceMeter.tsx`
- [x] Create `frontend/src/components/ideation/ViabilityMeter.tsx`
- [x] Create `frontend/src/components/ideation/RisksList.tsx`
- [x] Create `frontend/src/components/ideation/StreamingText.tsx`
- [x] Create `frontend/src/components/ideation/ExistingIdeaModal.tsx`

#### Spec 09: Frontend State & Hooks
- [x] Create `frontend/src/reducers/ideationReducer.ts`
- [x] Create `frontend/src/hooks/useIdeationAPI.ts`
- [x] Create `frontend/src/hooks/useSSEStream.ts`
- [x] Create component unit tests (all 14 files)
- [x] Create reducer tests
- [x] Create integration tests
- [x] Run tests and verify 35 pass (21 reducer + 14 integration)

### Phase 5: Integration & Polish

- [ ] End-to-end test: Start session → Send messages → Capture idea
- [ ] Verify pre-answered questions flow to Development phase
- [ ] Test handoff at 80% token usage
- [ ] Test viability interventions
- [ ] Test SSE streaming in production build
- [ ] Performance testing with long conversations
- [ ] Error handling edge cases
- [ ] Mobile responsiveness

---

## Testing Strategy

### Unit Tests by Spec

| Spec | Test File(s) | Expected Pass | Expected Fail |
|------|--------------|---------------|---------------|
| 01 | data-models.test.ts | 18 | 4 |
| 02 | confidence-calculator.test.ts, viability-calculator.test.ts, token-counter.test.ts | 70+ | 0 |
| 03 | communication-classifier.test.ts, pre-answered-mapper.test.ts | ~20 | 0 |
| 04 | session-manager.test.ts, message-store.test.ts, memory-manager.test.ts | ~30 | 0 |
| 05 | signal-extraction.test.ts | ~40 | 0 |
| 06 | orchestrator.test.ts, greeting.test.ts, streaming.test.ts | ~30 | 0 |
| 07 | api-endpoints.test.ts, error-classes.test.ts | 46 | 0 |
| 08-09 | Frontend component tests | 95 | 0 |

### Integration Test Scenarios

1. **Happy Path Discovery**
   - User selects "Help me discover"
   - Engages in conversation about interests
   - Idea candidate forms at 30%
   - Confidence grows to 75%
   - User captures idea

2. **Happy Path Existing Idea**
   - User selects "I have an idea"
   - Describes existing concept
   - Agent validates and expands
   - Captures with high confidence

3. **Viability Warning**
   - User describes idea
   - Web search finds saturated market
   - Viability drops to "Warning"
   - Intervention options shown
   - User pivots direction

4. **Critical Viability**
   - User describes impossible technology
   - Web search confirms infeasibility
   - Viability drops to "Critical"
   - Must address before continuing

5. **Session Handoff**
   - Long conversation approaching 80% tokens
   - Handoff triggered
   - Memory files preserved
   - New agent continues seamlessly

6. **Save and Resume**
   - User saves session mid-conversation
   - Returns later
   - Continues from where left off

7. **Discard and Restart**
   - User decides to start fresh
   - Previous session abandoned
   - New session begins with clean slate

---

## Quick Reference

### File Locations

| Content | Location |
|---------|----------|
| Migration | `database/migrations/018_ideation_agent.sql` |
| Types | `types/ideation.ts` |
| Calculators | `agents/ideation/*-calculator.ts` |
| Managers | `agents/ideation/*-manager.ts` |
| Orchestrator | `agents/ideation/orchestrator.ts` |
| API Routes | `server/routes/ideation.ts` |
| Frontend Components | `frontend/src/components/ideation/` |
| Frontend State | `frontend/src/reducers/ideationReducer.ts` |
| Backend Tests | `tests/ideation/` |
| Frontend Tests | `frontend/src/__tests__/ideation/` |

### Key Thresholds

| Threshold | Value | Purpose |
|-----------|-------|---------|
| Candidate Display | 30% confidence | Show in right panel |
| Capture Enabled | 60% confidence | Enable capture button |
| Idea Ready | 75% confidence | Full confidence |
| Viability Healthy | 75%+ | Green status |
| Viability Caution | 50-74% | Yellow status |
| Viability Warning | 25-49% | Orange status |
| Viability Critical | <25% | Red status, intervention |
| Handoff Threshold | 80% of 100K tokens | Trigger handoff |

### Risk Types

| Type | Description | Severity Range |
|------|-------------|----------------|
| `impossible` | Technology doesn't exist | Critical |
| `unrealistic` | Beyond user's capacity | High |
| `too_complex` | Too many hard problems | Medium-High |
| `too_vague` | Can't be validated | Medium |
| `saturated_market` | Too many competitors | Medium-High |
| `wrong_timing` | Too early or too late | Medium |
| `resource_mismatch` | User lacks resources | Medium |

---

*Document Version: 1.0*
*Created: Auto-generated from Specs 01-09*
*Last Updated: Session creation date*
*Status: Ready for Implementation*
