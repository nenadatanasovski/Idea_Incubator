# Idea-to-App Flow: Unified Experience Specification

> **Version**: 2.0
> **Date**: 2026-01-20
> **Status**: Design Proposal

---

## Executive Summary

This specification merges the existing ideation system (orchestrator, signal extraction, dual meters, artifacts, sub-agents) with a new conversational interface that keeps users engaged while maximizing data capture.

**Core Innovation**: A tabbed interface that lets users choose their preferred mode—pure conversation, visual exploration, or both—while maintaining synchronized state across all views.

**Key Insight**: The existing system already captures rich signals and generates valuable artifacts. The new UI must surface this existing functionality in more engaging, interactive ways—not replace it.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Interface Modes](#interface-modes)
3. [The Interactive Knowledge Graph](#the-interactive-knowledge-graph)
4. [Conversation Flow Integration](#conversation-flow-integration)
5. [Existing System Integration](#existing-system-integration)
6. [Phase Progression](#phase-progression)
7. [Artifact System](#artifact-system)
8. [Data Architecture](#data-architecture)
9. [Component Specifications](#component-specifications)
10. [Implementation Plan](#implementation-plan)
11. [Success Metrics](#success-metrics)

---

## Design Principles

### 1. User Choice First

Users have different preferences:

- **Talkers** want conversation-first, minimal UI
- **Visual thinkers** want graphs, diagrams, spatial exploration
- **Hybrid users** want both simultaneously

**Solution**: Tab-based interface with three modes that sync in real-time.

### 2. Surface Existing Intelligence

The system already:

- Extracts 11+ signal types from every message
- Calculates confidence (how well-defined) and viability (how achievable)
- Generates artifacts via sub-agents
- Performs web research for validation
- Tracks session phases

**Make this visible and interactive**, don't hide it.

### 3. Evidence Over Abstraction

Replace vague progress indicators with concrete evidence:

- Not "Problem: 72%" → "Problem: 'Lawyers spend 40% of time on research'"
- Not "Market: Analyzing..." → "Found 3 competitors: Casetext, ROSS, Harvey"
- Not "Fit: Good" → "Skills match: React ✓, ML ✗, Law domain ✓"

### 4. Continuous Feedback Loop

Every user action triggers visible system response:

```
User Message → Signal Extraction → State Update → Visual Change → Next Question
```

The user sees their idea taking shape in real-time.

### 5. Seamless Phase Transitions

No jarring "You've completed Phase 1!" modals. Instead:

- Subtle visual cues (knowledge graph clusters complete)
- AI-suggested transitions ("I think we understand the problem. Ready to explore solutions?")
- User consent before any phase change

---

## Interface Modes

### Mode Selection

Users can switch between three modes at any time via tabs in the header:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌─ HEADER ────────────────────────────────────────────────────────────────┐ │
│ │ [← Back]  "Legal AI Research Tool"                                      │ │
│ │                                                                         │ │
│ │ ┌─ VIEW MODE ────────────────────────────────────────────────────────┐  │ │
│ │ │ [💬 Chat] [🕸️ Explore] [📊 Split View]                     [⚙️]  │  │ │
│ │ └─────────────────────────────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
```

### Mode 1: Chat Mode (Pure Conversation)

Full-screen conversation with minimal distractions. Floating indicators show progress.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ FLOATING METRICS (collapsible) ─────────────────────────────┐          │
│  │ Confidence: ████████░░ 78%  |  Viability: ██████░░░░ 62%     │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─ CONVERSATION ───────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  🤖 AI                                                               │  │
│  │  What's the most frustrating part of legal research today?           │  │
│  │                                                                       │  │
│  │  👤 You                                                              │  │
│  │  Lawyers bill $500/hr but spend 40% of time just searching for       │  │
│  │  relevant case law. It's insane.                                     │  │
│  │  ┌─ Evidence Captured ─────────────────────────────────────────────┐ │  │
│  │  │ 📌 Problem: Time waste on legal research                        │ │  │
│  │  │ 📌 Target: Lawyers billing $500+/hr                             │ │  │
│  │  │ 📌 Severity: "insane" (high frustration signal)                 │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  │  🤖 AI                                                               │  │
│  │  That's a significant pain point. Who specifically experiences this? │  │
│  │  Junior associates? Partners? Both?                                  │  │
│  │                                                                       │  │
│  │  [Junior Associates]  [Partners]  [Both]  [Other...]                 │  │
│  │                                                                       │  │
│  │ ─────────────────────────────────────────────────────────────────── │  │
│  │ [Type your response...]                                     [Send]  │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ QUICK ACCESS BAR ───────────────────────────────────────────────────┐  │
│  │ [📊 View Graph] [📄 Artifacts (3)] [🔍 Research] [⚡ Generate Spec]   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**

- Evidence captured badges appear inline after user messages
- Floating metrics bar (can be collapsed)
- Quick access bar for switching to other views
- Sub-agent status indicators when artifacts are generating

### Mode 2: Explore Mode (Visual-First)

Knowledge graph dominates. Conversation in sidebar. Click any node to drill down.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ KNOWLEDGE GRAPH (70%) ─────────────────────┐ ┌─ DETAIL PANEL (30%) ──┐ │
│  │                                             │ │                        │ │
│  │                    ┌─────┐                  │ │ 📌 PROBLEM             │ │
│  │                    │ YOU │                  │ │ (Click node to select) │ │
│  │                    └──┬──┘                  │ │                        │ │
│  │           ┌──────────┼──────────┐          │ │ ┌─ TABS ─────────────┐ │ │
│  │           │          │          │          │ │ │[Evidence][Questions]│ │ │
│  │      ┌────┴────┐ ┌───┴────┐ ┌───┴────┐     │ │ │[Artifacts][Related]│ │ │
│  │      │ PROBLEM │ │SOLUTION│ │  FIT   │     │ │ └────────────────────┘ │ │
│  │      │  ●●●○○  │ │ ●●○○○  │ │ ●●●●○  │     │ │                        │ │
│  │      └────┬────┘ └───┬────┘ └────────┘     │ │ 📄 Evidence:           │ │
│  │           │          │                     │ │ "Lawyers spend 40% of  │ │
│  │      ┌────┴────┐ ┌───┴────┐ ┌────────┐     │ │  time on research"     │ │
│  │      │ MARKET  │ │  RISK  │ │BUSINESS│     │ │  └─ 10:23am            │ │
│  │      │ ●○○○○   │ │ ●●○○○  │ │ ○○○○○  │     │ │                        │ │
│  │      └─────────┘ └────────┘ └────────┘     │ │ "Target: $500+/hr      │ │
│  │                                             │ │  corporate lawyers"    │ │
│  │  ○ = no data   ● = evidence captured        │ │  └─ 10:31am            │ │
│  │                                             │ │                        │ │
│  │  ┌─ MINI CHAT ────────────────────────────┐ │ │ ❓ Unanswered:         │ │
│  │  │ AI: Who experiences this most?          │ │ │ • How severe is the   │ │
│  │  │ [Junior] [Partners] [Both] [Other...]   │ │ │   pain? (1-10)        │ │
│  │  │ [Type response...]              [Send]  │ │ │ • Current workarounds?│ │
│  │  └─────────────────────────────────────────┘ │ │ • Validation attempts?│ │
│  └─────────────────────────────────────────────┘ └────────────────────────┘ │
│                                                                             │
│  ┌─ PHASE PROGRESS ─────────────────────────────────────────────────────┐  │
│  │ ◉ Exploring ─── ◐ Problem ─── ○ Solution ─── ○ Validation ─── ○ Spec │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**

- Click any node to see its detail panel (evidence, questions, artifacts, related items)
- Node fill indicates evidence strength (●●○○○ = 40% complete)
- Mini chat at bottom for quick interactions
- Drag nodes to reorganize
- Double-click empty space to ask AI "What should I explore next?"

### Mode 3: Split View (Hybrid)

Equal space for conversation and visual exploration. Best for power users.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ CONVERSATION (50%) ────────────────────┐ ┌─ VISUAL (50%) ────────────┐ │
│  │                                         │ │                            │ │
│  │  🤖 AI                                  │ │ ┌─ TABS ────────────────┐  │ │
│  │  What's the most frustrating part       │ │ │[Graph][Artifacts]      │  │ │
│  │  of legal research today?               │ │ │[Evidence][Forecast]    │  │ │
│  │                                         │ │ └────────────────────────┘  │ │
│  │  👤 You                                 │ │                            │ │
│  │  Lawyers bill $500/hr but spend 40%     │ │      ┌─────┐               │ │
│  │  of time just searching for case law.   │ │      │ YOU │               │ │
│  │                                         │ │      └──┬──┘               │ │
│  │  🤖 AI                                  │ │    ┌────┴────┐             │ │
│  │  That's significant. Who specifically   │ │    │ PROBLEM │             │ │
│  │  has this problem?                      │ │    │  ●●●○○  │             │ │
│  │                                         │ │    └─────────┘             │ │
│  │  [Junior Associates] [Partners]         │ │                            │ │
│  │  [Both] [Other...]                      │ │  ─────────────────────────  │ │
│  │                                         │ │  METRICS                   │ │
│  │ ─────────────────────────────────────── │ │  Confidence: ████████░░   │ │
│  │ [Type response...]             [Send]   │ │  Viability:  ██████░░░░   │ │
│  │                                         │ │                            │ │
│  └─────────────────────────────────────────┘ └────────────────────────────┘ │
│                                                                             │
│  ┌─ SUB-AGENTS (collapsible) ───────────────────────────────────────────┐  │
│  │ 🔄 Generating pitch... (45%)  │  ✅ Market research complete          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**

- Synchronized state between panels
- Click graph node → conversation context updates
- Sub-agent status bar shows parallel work
- Right panel has tabs: Graph, Artifacts, Evidence, Forecast

---

## The Interactive Knowledge Graph

The knowledge graph is the centerpiece of visual exploration. It must be deeply interactive.

### Node Types

| Node         | Color  | Data Source               | Click Action                               |
| ------------ | ------ | ------------------------- | ------------------------------------------ |
| **You**      | Blue   | User profile + signals    | Shows skills, goals, constraints           |
| **Problem**  | Red    | Problem signals           | Shows pain points, severity, validation    |
| **Solution** | Green  | Solution signals          | Shows features, tech, differentiation      |
| **Market**   | Purple | Market signals + research | Shows TAM, competitors, timing             |
| **Fit**      | Yellow | Fit signals               | Shows passion, skills, network, life stage |
| **Risk**     | Orange | Risk signals              | Shows identified risks, mitigations        |
| **Business** | Teal   | Business model signals    | Shows revenue, pricing, channels           |

### Node States

```
○ Empty     - No evidence captured yet
◔ Minimal   - 1-2 signals captured
◑ Partial   - 3-5 signals captured
◕ Strong    - 6-9 signals captured
● Complete  - All critical questions answered
```

### Node Interactions

#### Click: Open Detail Drawer

Clicking any node opens a detail drawer with four tabs:

**Tab 1: Evidence**

```
┌─ PROBLEM: Evidence ────────────────────────────────────────┐
│                                                            │
│ ✓ Core Problem Statement                                   │
│   "Lawyers spend 40% of billable time on case law          │
│    research that could be automated"                       │
│   └─ Captured from message at 10:23am                      │
│   └─ Confidence: High (direct statement)                   │
│                                                            │
│ ✓ Target User                                              │
│   "Corporate lawyers at firms billing $500+/hr"            │
│   └─ Captured from message at 10:31am                      │
│                                                            │
│ ◐ Severity (partial)                                       │
│   "insane" frustration signal detected                     │
│   └─ Missing: Quantified impact ($, hours, etc.)           │
│                                                            │
│ ○ Validation                                               │
│   └─ No user interviews recorded yet                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Tab 2: Questions**

```
┌─ PROBLEM: Questions ───────────────────────────────────────┐
│                                                            │
│ ✅ Answered (3)                                            │
│ ├─ P1_CORE: What problem are you solving?                  │
│ ├─ P3_WHO: Who has this problem?                           │
│ └─ P2_SEVERITY: How painful is it?                         │
│                                                            │
│ ❓ Unanswered Critical (2)                                 │
│ ├─ P4_VALIDATION: Have you talked to users?                │
│ │   [Ask this question]                                    │
│ └─ P5_WORKAROUND: What do they do today?                   │
│     [Ask this question]                                    │
│                                                            │
│ 📋 Optional (3)                                            │
│ └─ [Show optional questions...]                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Tab 3: Artifacts**

```
┌─ PROBLEM: Artifacts ───────────────────────────────────────┐
│                                                            │
│ 📄 User Persona (generated)                                │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Sarah Chen, Corporate Attorney                       │   │
│ │ • Bills $650/hour at BigLaw firm                     │   │
│ │ • Spends 15-20 hrs/week on case research             │   │
│ │ • Frustrated by inefficient search tools             │   │
│ └──────────────────────────────────────────────────────┘   │
│ [Edit] [Regenerate] [Delete]                               │
│                                                            │
│ 📊 Problem Severity Diagram (mermaid)                      │
│ [View] [Edit]                                              │
│                                                            │
│ [+ Generate Artifact...]                                   │
│   • Problem statement document                             │
│   • User interview guide                                   │
│   • Pain point matrix                                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Tab 4: Related**

```
┌─ PROBLEM: Related ─────────────────────────────────────────┐
│                                                            │
│ 🔗 Connected Nodes                                         │
│ ├─ → SOLUTION (defines what problem it solves)             │
│ ├─ → MARKET (problem exists within this market)            │
│ └─ → YOU (you experienced this problem)                    │
│                                                            │
│ 📁 Related Files                                           │
│ ├─ ideas/legal-ai/README.md (problem section)              │
│ ├─ ideas/legal-ai/development.md (Q&A history)             │
│ └─ ideas/legal-ai/research/market.md                       │
│                                                            │
│ 🔍 Web Research                                            │
│ ├─ "Legal tech market analysis 2026"                       │
│ │   └─ 3 sources found [View]                              │
│ └─ [Run new search...]                                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Hover: Quick Summary Tooltip

```
┌─────────────────────────────────────────┐
│ PROBLEM                                 │
│ ●●●○○ (60% complete)                    │
│                                         │
│ "Legal research time waste"             │
│                                         │
│ 3 questions answered, 2 critical remain │
│ 1 artifact generated                    │
│                                         │
│ Click to explore →                      │
└─────────────────────────────────────────┘
```

#### Right-Click: Context Menu

```
┌─────────────────────────┐
│ 🔍 Explore this area    │
│ ❓ Ask a question       │
│ 📄 Generate artifact    │
│ 🔗 Show connections     │
│ ───────────────────────  │
│ ⚡ Focus conversation    │
│ 📊 Run research         │
└─────────────────────────┘
```

#### Drag: Reorganize Layout

Users can drag nodes to create custom spatial arrangements. The system remembers layouts per session.

#### Double-Click Empty Space

Opens AI suggestion: "Based on your progress, I'd recommend exploring [MARKET] next. Want to discuss competitors?"

### Edge Visualization

Edges between nodes show relationships:

| Edge Type      | Style | Meaning                       |
| -------------- | ----- | ----------------------------- |
| Solid thick    | ━━━   | Strong evidence of connection |
| Solid thin     | ───   | Weak connection               |
| Dashed         | - - - | Inferred connection           |
| Animated pulse | ~~~→  | Recently updated              |

### Graph Animations

- **Node appearance**: Scale 0→1 over 300ms, ease-out
- **Edge formation**: Draw line over 500ms, pulse once
- **Evidence update**: Glow effect on node for 1s
- **Phase completion**: Celebratory burst on cluster

---

## Conversation Flow Integration

### Existing Orchestrator Integration

The conversation leverages the existing `AgentOrchestrator` which:

1. **Signal Extraction**: Every user message → 11+ signal types extracted
2. **State Merging**: Signals merged into `selfDiscovery`, `marketDiscovery`, `narrowing`
3. **Confidence Calculation**: How well-defined is the idea?
4. **Viability Calculation**: How achievable is the idea?
5. **Response Generation**: Claude generates contextual responses
6. **Sub-Agent Spawning**: Parallel artifact generation

### Message Types

The orchestrator already supports rich responses:

| Type        | Description         | UI Rendering      |
| ----------- | ------------------- | ----------------- |
| `reply`     | Plain text response | Text message      |
| `buttons`   | Quick reply options | Button group      |
| `form`      | Structured input    | Dynamic form      |
| `artifact`  | Generated content   | Artifact preview  |
| `research`  | Web search results  | Citation cards    |
| `challenge` | Red team pushback   | Challenge card    |
| `milestone` | Phase transition    | Celebration modal |

### Enhanced Message Display

```typescript
interface EnhancedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;

  // Extracted signals (shown as badges)
  signals?: {
    type: SignalType;
    value: string;
    confidence: number;
  }[];

  // Questions this message answered
  answeredQuestions?: QuestionCode[];

  // Related graph nodes affected
  affectedNodes?: NodeType[];

  // Sub-agent activity triggered
  triggeredAgents?: SubAgentTask[];
}
```

### Evidence Badges

After each user message, show captured evidence:

```
👤 You
Lawyers bill $500/hr but spend 40% of time on research.

┌─ Evidence Captured ─────────────────────────────────┐
│ 📌 Problem: Time waste on legal research            │
│ 📌 Target: Lawyers billing $500+/hr                 │
│ 📌 Severity: High frustration ("insane" detected)   │
│ 📈 Affected: PROBLEM node (+2 signals)              │
└─────────────────────────────────────────────────────┘
```

### Challenge Mode (Inline Red Team)

The existing red team system surfaces challenges inline:

```
┌─ ⚡ CHALLENGE ───────────────────────────────────────────────┐
│                                                             │
│ "You mentioned there's no competition, but I found          │
│  3 competitors doing AI legal research:                     │
│                                                             │
│  • Casetext (acquired by Thomson Reuters)                   │
│  • Harvey AI ($80M Series B)                                │
│  • Spellbook (contract-focused)                             │
│                                                             │
│  What makes your approach different?"                       │
│                                                             │
│ ┌─ OPTIONS ───────────────────────────────────────────────┐ │
│ │ [Differentiate] [Research More] [Pivot] [Dismiss]       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Challenge intensity: [○●○] Medium                           │
└─────────────────────────────────────────────────────────────┘
```

### Sub-Agent Status

When sub-agents spawn, show status:

```
┌─ 🤖 Background Work ────────────────────────────────────────┐
│                                                             │
│ 🔄 Generating pitch refinement... ████████░░░░ 67%          │
│ ✅ Market research complete (3 sources)         [View]      │
│ 🔄 Architecture exploration... ██░░░░░░░░░░░░░ 15%          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Existing System Integration

### Component Mapping

| Existing Component     | New UI Integration                |
| ---------------------- | --------------------------------- |
| `AgentOrchestrator`    | Powers all conversation responses |
| `SignalExtractor`      | Generates evidence badges         |
| `ConfidenceCalculator` | Floating confidence meter         |
| `ViabilityCalculator`  | Floating viability meter          |
| `SubAgentManager`      | Background work status bar        |
| `WebSearchService`     | Research tab + citations          |
| `ArtifactStore`        | Artifact panel + node artifacts   |
| `CandidateManager`     | Graph node data                   |
| `PhaseManager`         | Progress bar state                |
| `SpecGenerator`        | Spec panel integration            |

### Data Flow

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ AgentOrchestrator                                           │
│ ├─ SignalExtractor.extract(message)                         │
│ ├─ StateManager.merge(signals)                              │
│ ├─ ConfidenceCalculator.calculate(state)                    │
│ ├─ ViabilityCalculator.calculate(state)                     │
│ ├─ Claude.generate(context, question)                       │
│ └─ SubAgentManager.maybeSpawn(context)                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ WebSocket Events                                            │
│ ├─ message:new → ConversationPanel                          │
│ ├─ signals:extracted → EvidenceBadges, GraphNodes           │
│ ├─ metrics:updated → FloatingMeters                         │
│ ├─ subagent:status → BackgroundWorkBar                      │
│ ├─ artifact:created → ArtifactPanel, NodeArtifacts          │
│ └─ phase:changed → ProgressBar                              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
React State Updates (Redux-style via useIdeationReducer)
```

### API Endpoints Used

| Endpoint                                   | Purpose             | UI Trigger        |
| ------------------------------------------ | ------------------- | ----------------- |
| `POST /api/ideation/sessions`              | Start session       | Entry modal       |
| `POST /api/ideation/sessions/:id/messages` | Send message        | Send button       |
| `GET /api/ideation/sessions/:id/artifacts` | List artifacts      | Artifact panel    |
| `POST /api/ideation/sessions/:id/subagent` | Spawn sub-agent     | Generate artifact |
| `GET /api/ideation/sessions/:id/candidate` | Get candidate state | Graph data        |
| `POST /api/ideation/sessions/:id/spec`     | Generate spec       | Spec button       |

### WebSocket Events

| Event                | Payload                          | UI Update           |
| -------------------- | -------------------------------- | ------------------- |
| `message:assistant`  | `{content, buttons?, form?}`     | Add to conversation |
| `signals:extracted`  | `{signals: Signal[]}`            | Evidence badges     |
| `metrics:confidence` | `{value: number}`                | Confidence meter    |
| `metrics:viability`  | `{value: number, risks: Risk[]}` | Viability meter     |
| `subagent:spawn`     | `{id, type, status}`             | Background bar      |
| `subagent:progress`  | `{id, progress}`                 | Progress update     |
| `subagent:complete`  | `{id, artifact}`                 | Artifact panel      |
| `artifact:created`   | `{artifact: Artifact}`           | Artifact tab        |
| `phase:suggested`    | `{from, to, reason}`             | Transition modal    |
| `graph:nodeUpdate`   | `{node, signals}`                | Graph animation     |

---

## Phase Progression

### Session Phases

The existing system tracks four phases:

| Phase        | Focus                            | Exit Condition              |
| ------------ | -------------------------------- | --------------------------- |
| `exploring`  | Open discovery, signal gathering | Direction chosen            |
| `narrowing`  | Problem/solution refinement      | Core hypothesis formed      |
| `validating` | Assumption testing, research     | Critical assumptions tested |
| `refining`   | Detail addition, gap filling     | Spec-ready                  |

### Visual Phase Indicators

**Progress Bar (subtle)**

```
◉ Exploring ─── ◐ Narrowing ─── ○ Validating ─── ○ Refining ─── ○ Ready
```

**Graph Cluster Completion**

- Problem cluster nodes fill up → Problem phase complete
- Solution cluster nodes fill up → Solution phase complete
- All clusters adequately filled → Spec-ready

### Phase Transitions

AI suggests transitions when conditions are met:

```
┌─ 🎯 MILESTONE: Problem Clarity Achieved ─────────────────────┐
│                                                             │
│ You've clearly articulated:                                 │
│ ✓ The problem: Legal research time waste                    │
│ ✓ Who has it: Corporate lawyers at $500+/hr firms           │
│ ✓ How painful: 40% of billable time wasted                  │
│ ✓ Current workaround: Junior associates + manual search     │
│                                                             │
│ I think we understand the problem well. Ready to explore    │
│ how you'd solve it?                                         │
│                                                             │
│ [Yes, let's shape the solution]                             │
│ [I want to validate this problem first]                     │
│ [Keep exploring the problem space]                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**User always controls progression.** The system suggests, never forces.

---

## Artifact System

### Existing Artifact Types

| Type           | Generator        | Description                         |
| -------------- | ---------------- | ----------------------------------- |
| `markdown`     | Claude direct    | Notes, documents, summaries         |
| `mermaid`      | Claude direct    | Diagrams, flowcharts, architectures |
| `code`         | Claude direct    | Code samples, APIs, schemas         |
| `research`     | WebSearchService | Compiled web research               |
| `pitch`        | Sub-agent        | Elevator pitch refinement           |
| `architecture` | Sub-agent        | Technical architecture exploration  |
| `persona`      | Sub-agent        | User persona generation             |
| `competitive`  | Sub-agent        | Competitive analysis                |

### Artifact Panel

```
┌─ ARTIFACTS ─────────────────────────────────────────────────┐
│                                                             │
│ ┌─ FILTER ────────────────────────────────────────────────┐ │
│ │ [All] [📄 Docs] [📊 Diagrams] [💻 Code] [🔍 Research]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 📄 User Persona: Sarah Chen                                 │
│    Generated • Problem node • 2 min ago                     │
│    [Preview] [Edit] [Delete]                                │
│                                                             │
│ 📊 Problem Severity Matrix                                  │
│    Generated • Problem node • 5 min ago                     │
│    [Preview] [Edit] [Delete]                                │
│                                                             │
│ 🔍 Legal Tech Market Analysis                               │
│    Research • Market node • 10 min ago                      │
│    3 sources • [View Sources]                               │
│                                                             │
│ 📄 Competitive Landscape                                    │
│    Generated • Market node • 12 min ago                     │
│    [Preview] [Edit] [Delete]                                │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ [+ Generate New Artifact]                                   │
│   • Action plan                                             │
│   • Technical architecture                                  │
│   • Pitch deck outline                                      │
│   • User interview guide                                    │
│   • Custom prompt...                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Artifact Preview Modal

```
┌─ User Persona: Sarah Chen ───────────────────────────────────┐
│                                                              │
│ ┌─ TOOLBAR ────────────────────────────────────────────────┐ │
│ │ [Edit] [Regenerate] [Export] [Link to Node]       [✕]   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ## Sarah Chen, Corporate Attorney                            │
│                                                              │
│ **Demographics**                                             │
│ - Age: 34                                                    │
│ - Role: Senior Associate at Morrison & Foerster              │
│ - Billing rate: $650/hour                                    │
│                                                              │
│ **Pain Points**                                              │
│ - Spends 15-20 hours/week on case research                   │
│ - Feels inefficient using current tools (Westlaw, LexisNexis)│
│ - Junior associates make errors, requires double-checking    │
│                                                              │
│ **Goals**                                                    │
│ - Bill more hours on substantive work                        │
│ - Make partner within 3 years                                │
│ - Find tools that actually understand legal context          │
│                                                              │
│ **Quotes**                                                   │
│ > "I didn't go to law school to be a search engine operator" │
│                                                              │
│ ─────────────────────────────────────────────────────────────│
│ 📍 Linked to: PROBLEM node                                   │
│ 🕐 Generated: 10:45am • Source: Conversation + AI            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Architecture

### Signal Types (Existing)

| Signal           | Description              | Extracted From                |
| ---------------- | ------------------------ | ----------------------------- |
| `frustration`    | Pain points, complaints  | Negative sentiment patterns   |
| `expertise`      | Skills, knowledge areas  | Skill mentions, experience    |
| `interest`       | Topics of curiosity      | Repeated mentions, enthusiasm |
| `customerType`   | B2B/B2C/Marketplace      | Business context              |
| `productType`    | Digital/Physical/Service | Product descriptions          |
| `geography`      | Location scope           | Place mentions                |
| `impactVision`   | Scale of ambition        | World/country/city/community  |
| `competitor`     | Known competitors        | Company mentions, comparisons |
| `pricing`        | Price points mentioned   | Dollar amounts                |
| `timeConstraint` | Availability, urgency    | Time mentions                 |
| `riskTolerance`  | Risk appetite            | Language analysis             |

### Question Framework (86 Questions)

| Category    | Critical | Important | Nice-to-have | Total |
| ----------- | -------- | --------- | ------------ | ----- |
| Problem     | 5        | 8         | 5            | 18    |
| Solution    | 5        | 7         | 2            | 14    |
| Feasibility | 4        | 6         | 2            | 12    |
| Fit         | 5        | 9         | 3            | 17    |
| Market      | 3        | 8         | 4            | 15    |
| Risk        | 5        | 5         | 0            | 10    |

### Graph Data Structure

```typescript
interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: NodePosition[];
}

interface GraphNode {
  id: NodeType;
  label: string;
  signals: Signal[];
  questions: {
    answered: QuestionCode[];
    unanswered: QuestionCode[];
  };
  artifacts: Artifact[];
  completeness: number; // 0-100
  lastUpdated: Date;
}

interface GraphEdge {
  source: NodeType;
  target: NodeType;
  relationship: string;
  strength: number; // 0-1
  evidence: string[];
}

type NodeType =
  | "you"
  | "problem"
  | "solution"
  | "market"
  | "fit"
  | "risk"
  | "business";
```

### Readiness Calculation

```typescript
interface ReadinessScore {
  overall: number; // 0-100
  breakdown: {
    problem: { score: number; criticalAnswered: number; criticalTotal: number };
    solution: {
      score: number;
      criticalAnswered: number;
      criticalTotal: number;
    };
    market: { score: number; criticalAnswered: number; criticalTotal: number };
    fit: { score: number; criticalAnswered: number; criticalTotal: number };
    risk: { score: number; criticalAnswered: number; criticalTotal: number };
  };
  blockers: string[]; // "Missing: P4_VALIDATION"
  specReady: boolean; // true if overall >= 70 and all critical >= 60
}
```

---

## Component Specifications

### New Components to Build

| Component           | Description                               | Priority |
| ------------------- | ----------------------------------------- | -------- |
| `ViewModeSelector`  | Tab bar for Chat/Explore/Split modes      | High     |
| `KnowledgeGraph`    | D3 force-directed graph with interactions | High     |
| `NodeDetailDrawer`  | Slide-out panel for node exploration      | High     |
| `EvidenceBadges`    | Inline evidence capture display           | High     |
| `FloatingMetrics`   | Collapsible confidence/viability bar      | High     |
| `PhaseProgressBar`  | Subtle phase indicator                    | Medium   |
| `BackgroundWorkBar` | Sub-agent status display                  | Medium   |
| `ChallengeCard`     | Red team challenge inline display         | Medium   |
| `MilestoneModal`    | Phase transition celebration              | Medium   |
| `QuickAccessBar`    | Chat mode quick navigation                | Low      |

### Component: KnowledgeGraph

```typescript
interface KnowledgeGraphProps {
  data: KnowledgeGraph;
  selectedNode?: NodeType;
  onNodeClick: (node: NodeType) => void;
  onNodeHover: (node: NodeType | null) => void;
  onNodeRightClick: (node: NodeType, event: MouseEvent) => void;
  onEmptyDoubleClick: () => void;
  onEdgeClick: (edge: GraphEdge) => void;
  layout: "force" | "radial" | "hierarchical";
  animationsEnabled: boolean;
}

// D3 force simulation configuration
const simulation = d3
  .forceSimulation(nodes)
  .force("link", d3.forceLink(edges).distance(100))
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collision", d3.forceCollide().radius(50));
```

### Component: NodeDetailDrawer

```typescript
interface NodeDetailDrawerProps {
  node: GraphNode;
  isOpen: boolean;
  onClose: () => void;
  onQuestionClick: (question: QuestionCode) => void;
  onArtifactClick: (artifact: Artifact) => void;
  onGenerateArtifact: (type: ArtifactType) => void;
  onRunResearch: (query: string) => void;
}

// Tabs: Evidence | Questions | Artifacts | Related
```

### Component: EvidenceBadges

```typescript
interface EvidenceBadgesProps {
  signals: Signal[];
  affectedNodes: NodeType[];
  onBadgeClick: (signal: Signal) => void;
  collapsed?: boolean;
}

// Renders after user messages
// Shows captured signals with icons
// Expandable/collapsible
```

### Component: ViewModeSelector

```typescript
interface ViewModeSelectorProps {
  currentMode: "chat" | "explore" | "split";
  onModeChange: (mode: "chat" | "explore" | "split") => void;
}

// Tab bar: [💬 Chat] [🕸️ Explore] [📊 Split View]
// Persists preference in localStorage
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Goal**: Core infrastructure for multi-mode UI

- [ ] Add `ViewModeSelector` component to header
- [ ] Create layout containers for all three modes
- [ ] Add `EvidenceBadges` component to message display
- [ ] Add `FloatingMetrics` bar for Chat mode
- [ ] Ensure WebSocket events update all views synchronously

**Deliverable**: Users can switch between modes; evidence badges appear inline

### Phase 2: Knowledge Graph MVP (Week 3-4)

**Goal**: Interactive graph with basic drill-down

- [ ] Build `KnowledgeGraph` component with D3
- [ ] Implement node states (empty → complete)
- [ ] Add click → `NodeDetailDrawer` with Evidence tab
- [ ] Add hover tooltips
- [ ] Add edge visualization
- [ ] Connect graph to session state

**Deliverable**: Users can visually explore their idea via the graph

### Phase 3: Rich Node Interactions (Week 5-6)

**Goal**: Deep node exploration

- [ ] Add Questions tab to drawer (answered/unanswered)
- [ ] Add Artifacts tab with generation options
- [ ] Add Related tab (connections, files, research)
- [ ] Implement "Ask this question" from drawer
- [ ] Implement "Generate artifact" from drawer
- [ ] Add right-click context menu

**Deliverable**: Nodes become interactive portals to all idea data

### Phase 4: Challenge Integration (Week 7)

**Goal**: Inline red team experience

- [ ] Build `ChallengeCard` component
- [ ] Add challenge intensity selector to header
- [ ] Integrate with existing red team system
- [ ] Add challenge acknowledgment flow

**Deliverable**: Users receive and respond to challenges inline

### Phase 5: Phase Transitions (Week 8)

**Goal**: Smooth phase progression

- [ ] Build `MilestoneModal` for phase celebrations
- [ ] Add `PhaseProgressBar` (subtle)
- [ ] Implement AI-suggested transitions
- [ ] Add transition consent flow
- [ ] Graph cluster completion animations

**Deliverable**: Users experience satisfying phase progression

### Phase 6: Polish & Optimization (Week 9-10)

**Goal**: Production-ready experience

- [ ] Performance optimization (graph rendering)
- [ ] Responsive design for all modes
- [ ] Keyboard shortcuts
- [ ] Accessibility audit
- [ ] Animation polish
- [ ] User preference persistence

**Deliverable**: Polished, performant, accessible experience

---

## Success Metrics

### Engagement

| Metric                     | Current | Target  | Measurement    |
| -------------------------- | ------- | ------- | -------------- |
| Questions answered/session | ~15     | 40+     | Signal count   |
| Session duration           | ~10 min | 25+ min | Time tracking  |
| Mode switches/session      | N/A     | 3+      | Event tracking |
| Graph interactions/session | N/A     | 10+     | Click tracking |
| Return rate (7 days)       | ~30%    | 60%+    | User analytics |

### Data Quality

| Metric                      | Target        | Measurement       |
| --------------------------- | ------------- | ----------------- |
| Critical questions answered | 80%+          | Question tracking |
| Signals per message         | 2+            | Signal extraction |
| Artifacts generated/session | 3+            | Artifact count    |
| Spec readiness rate         | 50%+ sessions | Readiness score   |

### Conversion

| Metric                     | Target       | Measurement         |
| -------------------------- | ------------ | ------------------- |
| Ideas reaching spec        | 30%+ started | Spec generation     |
| Specs reaching build       | 50%+ specs   | Build initiation    |
| User satisfaction (survey) | 4.2+/5       | Post-session survey |

### User Feedback Targets

| Question                    | Target |
| --------------------------- | ------ |
| "This was enjoyable"        | 4.2+/5 |
| "I understood my progress"  | 4.5+/5 |
| "The graph helped me think" | 4.0+/5 |
| "Challenges were helpful"   | 4.0+/5 |

---

## Appendix A: Node-to-Question Mapping

| Node     | Question Codes | Critical Questions                                                 |
| -------- | -------------- | ------------------------------------------------------------------ |
| PROBLEM  | P1-P18         | P1_CORE, P2_SEVERITY, P3_WHO, P4_VALIDATION, P5_WORKAROUND         |
| SOLUTION | S1-S14         | S1_WHAT, S2_HOW, S3_DIFFERENT, S4_MUST_HAVE, S5_WONT_BUILD         |
| MARKET   | M1-M15         | M1_SIZE, M2_COMPETITORS, M3_TIMING                                 |
| FIT      | FT1-FT17       | FT1_GOALS, FT2_PASSION, FT3_SKILLS, FT4_NETWORK, FT5_LIFESTAGE     |
| RISK     | R1-R10         | R1_EXECUTION, R2_MARKET, R3_TECHNICAL, R4_FINANCIAL, R5_REGULATORY |
| BUSINESS | B1-B6          | B1_REVENUE, B2_PRICING                                             |

## Appendix B: Signal-to-Node Mapping

| Signal Type    | Primary Node | Secondary Nodes |
| -------------- | ------------ | --------------- |
| frustration    | PROBLEM      | FIT             |
| expertise      | FIT          | SOLUTION        |
| interest       | FIT          | PROBLEM         |
| customerType   | MARKET       | SOLUTION        |
| productType    | SOLUTION     | MARKET          |
| geography      | MARKET       | -               |
| impactVision   | FIT          | MARKET          |
| competitor     | MARKET       | RISK            |
| pricing        | BUSINESS     | MARKET          |
| timeConstraint | FIT          | RISK            |
| riskTolerance  | RISK         | FIT             |

## Appendix C: Keyboard Shortcuts

| Shortcut    | Action                   |
| ----------- | ------------------------ |
| `1`         | Switch to Chat mode      |
| `2`         | Switch to Explore mode   |
| `3`         | Switch to Split mode     |
| `G`         | Focus knowledge graph    |
| `C`         | Focus conversation input |
| `A`         | Open artifacts panel     |
| `Esc`       | Close drawer/modal       |
| `?`         | Show keyboard shortcuts  |
| `Cmd+Enter` | Send message             |
| `Cmd+K`     | Command palette          |

## Appendix D: Animation Specifications

### Graph Animations

| Animation    | Duration | Easing      | Trigger                   |
| ------------ | -------- | ----------- | ------------------------- |
| Node appear  | 300ms    | ease-out    | New node                  |
| Node pulse   | 600ms    | ease-in-out | Evidence added            |
| Edge draw    | 500ms    | linear      | Connection formed         |
| Edge pulse   | 400ms    | ease-out    | Relationship strengthened |
| Cluster glow | 1000ms   | ease-in-out | Phase complete            |

### UI Animations

| Animation       | Duration | Easing      | Trigger           |
| --------------- | -------- | ----------- | ----------------- |
| Mode transition | 300ms    | ease-in-out | Tab switch        |
| Drawer slide    | 250ms    | ease-out    | Node click        |
| Badge appear    | 200ms    | ease-out    | Evidence captured |
| Metric update   | 400ms    | ease-in-out | Score change      |
| Confetti burst  | 2000ms   | linear      | Milestone reached |

---

_End of Specification_
