# Ideation Agent Design Document

## Executive Summary

The **Ideation Agent** is an AI-guided experience for users who enter the Capture phase without a fully-formed idea. Using sophisticated interviewer techniques, the agent helps users discover themselves (interests, expertise, impact vision) and the market (gaps, opportunities, timing), then identifies realistic overlap to surface viable business ideas.

The agent operates like a skilled detective — extracting information through natural conversation, strategically revealing question purposes when building on context, testing user knowledge, and narrowing possibilities based on accumulated signals.

---

## 1. Core Mechanism

### The Fundamental Equation

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     SELF-DISCOVERY              MARKET-DISCOVERY                │
│     ─────────────              ────────────────                 │
│     • Frustrations             • Competitor landscape           │
│     • Expertise                • Market gaps                    │
│     • Impact vision            • Timing signals                 │
│     • What makes them tick     • Failed attempts                │
│     • Skills (tested covertly) • Location-specific data         │
│                                                                 │
│              │                         │                        │
│              └───────────┬─────────────┘                        │
│                          │                                      │
│                          ▼                                      │
│         ┌────────────────────────────────────┐                  │
│         │         DUAL METERING SYSTEM       │                  │
│         ├────────────────────────────────────┤                  │
│         │  CONFIDENCE ↑        VIABILITY ↓   │                  │
│         │  (idea clarity)    (reality check) │                  │
│         └────────────────────────────────────┘                  │
│                          │                                      │
│                          ▼                                      │
│                   IDEA CANDIDATE                                │
│           (only if viable AND confident)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Agent's North Star

The Ideation Agent's singular purpose: **Help the user discover themselves and the market, then find where those two things realistically overlap.**

This is NOT about:

- Asking evaluation questions (handled later)
- Detailed business planning (handled later)
- Profile data collection (already captured)

This IS about:

- Understanding what makes this specific user tick
- Understanding what the market needs in their context
- Finding the intersection grounded in real data
- **Protecting the user from pursuing unviable ideas**

---

## 2. The Detective/Interviewer Methodology

### 2.1 Core Principle: Strategic Information Extraction

The agent employs a **dual-mode questioning strategy**:

**Mode 1: Covert Extraction** (default for skill testing, narrowing)

- Extract information without revealing assessment purpose
- Test knowledge/skills through natural conversation
- Narrow possibilities silently based on accumulated signals

**Mode 2: Transparent Inquiry** (for context-building, clarity)

- **Reveal why you're asking** when referencing previous answers
- Explain the purpose when clarity helps the user give better answers
- Build trust through transparency about the process

### 2.2 When to Reveal Question Purpose

| Situation                        | Approach             | Example                                                                                                                            |
| -------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Referencing previous answers** | ✅ Reveal connection | "Earlier you mentioned [X]. I'm asking about [Y] because I want to understand if they connect..."                                  |
| **Need specific/precise info**   | ✅ Explain why       | "I need to understand your time constraints specifically because this affects whether we explore side-project or full-time ideas." |
| **User seems confused**          | ✅ Provide context   | "Let me explain why I'm asking this — it helps me understand..."                                                                   |
| **Testing domain knowledge**     | ❌ Keep covert       | Just ask the scenario question naturally                                                                                           |
| **Assessing skill level**        | ❌ Keep covert       | Frame as hypothetical, not as test                                                                                                 |
| **Narrowing options**            | ❌ Keep covert       | Don't announce "I'm narrowing down"                                                                                                |

### 2.3 The Information Extraction Framework

```
┌─────────────────────────────────────────────────────────────────┐
│              DETECTIVE METHODOLOGY FRAMEWORK                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ESTABLISH RAPPORT                                           │
│     └─ Warm greeting, explain process simply                    │
│     └─ Reference profile to show personalization                │
│                                                                 │
│  2. OPEN-ENDED EXPLORATION                                      │
│     └─ Broad questions that reveal values and frustrations      │
│     └─ Let user talk, extract multiple signals per response     │
│     └─ ACCEPT USER-SUGGESTED IDEAS naturally                    │
│                                                                 │
│  3. STRATEGIC PROBING                                           │
│     └─ Test domain knowledge covertly when assessing            │
│     └─ Reveal purpose when building on prior context            │
│     └─ Identify gaps vs strengths for later targeting           │
│                                                                 │
│  4. STRATEGIC NARROWING                                         │
│     └─ Introduce constraints naturally                          │
│     └─ Reference previous answers WITH explanation              │
│     └─ Keep the narrowing decision itself silent                │
│                                                                 │
│  5. VALIDATION LOOPS                                            │
│     └─ Cross-reference claims with market data                  │
│     └─ Test assumptions through hypothetical scenarios          │
│     └─ Monitor VIABILITY METER continuously                     │
│                                                                 │
│  6. SYNTHESIS & PRESENTATION                                    │
│     └─ Connect dots the user may not have seen                  │
│     └─ Present overlap as discovery, not prescription           │
│     └─ Flag viability concerns honestly                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Transparent Questioning Examples

**Revealing purpose (good):**

```
AGENT: "You mentioned earlier that you lose track of time when coding.
I'm asking about this specifically because I want to understand if
building a technical product would genuinely energize you long-term,
or if it's just familiar. Does coding feel like flow or like work?"
```

**Building on context (good):**

```
AGENT: "Earlier you said the healthcare system frustrates you. Now
I need to understand something important: is this frustration from
the outside looking in, or do you have insider knowledge? The reason
I ask is that insider knowledge often creates real competitive advantage."
```

**Still covert when testing (appropriate):**

```
AGENT: "If you had to explain HIPAA compliance to a hospital CEO in
30 seconds, what would you say?"
[Internally: Testing regulatory knowledge depth — not announced]
```

### 2.5 Handling User-Suggested Ideas

Users can suggest ideas at any point during the conversation. The agent must adapt naturally:

```
USER: "Actually, I've been thinking about building a platform that
connects freelance nurses with rural hospitals."

AGENT: "That's a concrete idea — let's explore it. I'm going to ask
some questions to understand how this connects to what we've discussed
and validate it against the market.

First, what made you think of this specifically? Is this from personal
experience, something you observed, or research you've done?"
```

**When user suggests an idea, the agent:**

1. Acknowledges the idea positively but neutrally
2. Connects it to prior conversation context
3. Begins targeted follow-up questions for that specific idea
4. Runs market validation via web search
5. Updates both Confidence and Viability meters
6. Continues naturally without forcing a restart

---

## 3. The Dual Metering System

The agent tracks TWO independent metrics:

### 3.1 Confidence Meter (How well-defined is the idea?)

| Level  | Meaning            | Trigger                                |
| ------ | ------------------ | -------------------------------------- |
| 0-30%  | Vague exploration  | Just started, no clear direction       |
| 31-50% | Direction emerging | Some areas populated                   |
| 51-75% | Idea forming       | Most key areas have signals            |
| 76-99% | Idea crystallized  | Clear problem/solution/market fit      |
| 100%   | Fully defined      | All key areas complete with validation |

### 3.2 Viability Meter (Is this idea realistic?)

**CRITICAL**: This meter protects users from pursuing impossible, unrealistic, overly complex, or too vague ideas. It is based on **hard evidence from web search**.

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIABILITY METER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HEALTHY ████████████████████░░░░░░░░ 65%                      │
│                                                                 │
│  Components:                                                    │
│  ├─ Market Exists:        ████████████████ 80% (web validated) │
│  ├─ Technical Feasibility: ███████████░░░░ 70% (skill match)   │
│  ├─ Competitive Space:     ████████░░░░░░░ 50% (crowded)       │
│  ├─ Resource Reality:      ██████████████░ 75% (user can do)   │
│  └─ Clarity Score:         ████████████░░░ 60% (not too vague) │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Viability Risk Factors (Web-Search Validated)

| Risk Factor          | Trigger                                                | Evidence Required                                        |
| -------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| **Impossible**       | Technology doesn't exist, violates physics/regulations | Web search shows no precedent, regulatory blocks         |
| **Unrealistic**      | Requires resources far beyond user's capacity          | Market data shows capital requirements, user constraints |
| **Too Complex**      | Requires solving 5+ hard problems simultaneously       | Competitor analysis shows why others failed              |
| **Too Vague**        | Can't be validated because it's undefined              | User can't answer basic what/who/how questions           |
| **Market Saturated** | 10+ well-funded competitors, no clear differentiation  | Web search shows crowded landscape                       |
| **Timing Wrong**     | Too early (tech not ready) or too late (market closed) | Trend data, market maturity signals                      |

### 3.4 Viability Threshold Behavior

| Viability Level | Agent Behavior                                 |
| --------------- | ---------------------------------------------- |
| **75-100%**     | Healthy — continue building confidence         |
| **50-74%**      | Caution — mention concerns, suggest pivots     |
| **25-49%**      | Warning — have honest conversation about risks |
| **0-24%**       | Critical — must address before continuing      |

### 3.5 Viability Intervention Protocol

When viability drops below threshold, the agent intervenes calmly:

```
VIABILITY < 50% INTERVENTION:

AGENT: "I want to pause here and share something important.

Based on what I'm finding, this direction has some significant
challenges:

1. [Specific concern with source]
2. [Specific concern with source]

This doesn't mean the idea is bad — but these are real obstacles
that would need solutions. Let me show you what I found:
[cite web search sources]

We have a few options:
[Button: Explore how to address these challenges]
[Button: Pivot to a related but more viable direction]
[Button: Continue anyway — I understand the risks]
[Button: Discard and start fresh]

What would you like to do?"
```

### 3.6 Vagueness Detection

The agent detects when ideas are too vague to validate:

```
VAGUENESS SIGNALS:
- User says "something with AI" without specifics
- Can't describe target user beyond "everyone"
- Problem statement is abstract ("make things better")
- Solution is hand-wavy ("use technology to fix it")
- Can't answer "what would v1 look like?"

INTERVENTION:

AGENT: "I'm having trouble getting a clear picture of this idea.
Let me ask more specifically — I need this clarity to do useful
market research:

What would someone actually DO with this product on day one?
Not the vision, just: they open it, and then what happens?"
```

---

## 4. Key Areas to Populate

### 4.1 Self-Discovery Areas

The agent works to fill these internal "slots" about the user:

| Area                | What Agent Captures                                                      | How It's Extracted                                           |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **Impact Vision**   | What change do they want to make? World, country, city, community level? | "If you could fix one thing..." / "What legacy..."           |
| **Frustrations**    | Personal pain points they've experienced                                 | "What feels harder than it should..." / "Walk me through..." |
| **Expertise**       | What they know that others don't                                         | "What do outsiders get wrong about..." / Technical scenarios |
| **Interests**       | What genuinely energizes them                                            | "What do you read/watch/think about voluntarily?"            |
| **Tick Factors**    | What makes them come alive                                               | "When do you lose track of time?" / "What makes you angry?"  |
| **Skills (Tested)** | Actual capability level                                                  | Covert probing, scenario questions                           |
| **Constraints**     | Location, time, capital, risk tolerance                                  | Natural conversation, profile data                           |

### 4.2 Market-Discovery Areas

These are populated through web search + user input:

| Area                     | What Agent Captures                   | Data Sources                           |
| ------------------------ | ------------------------------------- | -------------------------------------- |
| **Competitor Landscape** | Who's playing in relevant spaces      | Web search, user knowledge             |
| **Market Gaps**          | What's missing or underserved         | Web search analysis, user frustrations |
| **Timing Signals**       | Why now? What's changed?              | Web search for trends, news            |
| **Failed Attempts**      | What's been tried and failed          | Web search, startup post-mortems       |
| **Location Context**     | Market presence in user's city/region | Web search for local data              |
| **Job Market**           | What skills are in demand where       | Web search for job postings, trends    |

### 4.3 Narrowing Dimensions

The agent silently narrows across these dimensions:

| Dimension           | Options                               | How Determined                                   |
| ------------------- | ------------------------------------- | ------------------------------------------------ |
| **Product Type**    | Digital / Physical / Hybrid / Service | Inferred from skills, interests, constraints     |
| **Customer Type**   | B2B / B2C / B2B2C / Marketplace       | Inferred from frustrations, network, expertise   |
| **Geography**       | Local / National / Global             | Asked early, profile data, web validation        |
| **Scale Ambition**  | Lifestyle / Growth / Venture          | Inferred from goals, risk tolerance, constraints |
| **Technical Depth** | No-code / Low-code / Full custom      | Tested through covert skill assessment           |

---

## 5. Agent Memory & Handoff System

### 5.1 Context Limit: 100,000 Tokens

The agent has a context window of **100k tokens**. This allows for extended conversations, but handoff is still needed for very long sessions.

### 5.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT SESSION SYSTEM                         │
│                    (100k token context)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 ACTIVE AGENT INSTANCE                    │   │
│  │                                                          │   │
│  │  Context Window (100k tokens)                            │   │
│  │  ├─ System prompt (~5k tokens)                           │   │
│  │  ├─ User profile (~2k tokens)                            │   │
│  │  ├─ Conversation history (~80k tokens max)               │   │
│  │  ├─ Web search results cache (~10k tokens)               │   │
│  │  └─ Current state (idea, meters)                         │   │
│  │                                                          │   │
│  │  At ~80k tokens used → Initiate proactive handoff        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                    │            │
│                                                    ▼            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              TEMPORARY MEMORY FILES (Markdown)           │   │
│  │                                                          │   │
│  │  ideation-session-{id}/                                  │   │
│  │  ├─ self-discovery.md      # Populated key areas         │   │
│  │  ├─ market-discovery.md    # Market findings + sources   │   │
│  │  ├─ narrowing-state.md     # Current constraint state    │   │
│  │  ├─ conversation-summary.md # Key points, flow           │   │
│  │  ├─ idea-candidate.md      # Current idea if any         │   │
│  │  ├─ viability-assessment.md # Risk factors, evidence     │   │
│  │  └─ handoff-notes.md       # Instructions for next agent │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                    │            │
│                                                    ▼            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 NEW AGENT INSTANCE                       │   │
│  │                                                          │   │
│  │  Loads:                                                  │   │
│  │  ├─ Same system prompt                                   │   │
│  │  ├─ User profile                                         │   │
│  │  ├─ All temporary memory files                           │   │
│  │  └─ Handoff notes for context                            │   │
│  │                                                          │   │
│  │  Continues conversation seamlessly                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Memory File Structures

**self-discovery.md:**

```markdown
# Self-Discovery State

## Impact Vision

- Level: [world/country/city/community]
- Description: [what user wants to change]
- Confidence: [high/medium/low]

## Frustrations Identified

1. [Frustration] - Source: [quote/inference] - Severity: [high/med/low]
2. ...

## Expertise Areas

- [Area]: [depth: expert/competent/novice] - Evidence: [how tested]
- ...

## Interests & Passions

- [Interest] - Genuine: [yes/no] - Evidence: [engagement level]
- ...

## Skills Assessment

- [Skill]: [level] - Tested via: [method]
- Gaps identified: [list]
- Strengths identified: [list]

## Constraints

- Location: [fixed/flexible] - Target: [city/country]
- Time: [hours/week]
- Capital: [bootstrap/seeking funding]
- Risk tolerance: [low/medium/high]
```

**viability-assessment.md:**

```markdown
# Viability Assessment

## Current Score: [X]%

## Risk Factors Identified

### Market Risks

- [Risk]: [severity] - Evidence: [URL source]
- ...

### Technical Risks

- [Risk]: [severity] - Evidence: [assessment method]
- ...

### Resource Risks

- [Risk]: [severity] - Evidence: [user constraint vs requirement]
- ...

### Complexity Risks

- [Risk]: [severity] - Evidence: [why this is hard]
- ...

## Web Search Evidence

| Query | Finding | Source URL | Implication |
| ----- | ------- | ---------- | ----------- |
| ...   | ...     | ...        | ...         |

## Interventions Made

- [Timestamp]: [What was flagged] - User response: [choice made]
- ...
```

**handoff-notes.md:**

```markdown
# Agent Handoff Notes

## Session Summary

[2-3 paragraph summary of conversation so far]

## Current State

- Idea candidate: [yes/no] - If yes, see idea-candidate.md
- Confidence level: [%]
- Viability level: [%]
- Conversation phase: [exploring/narrowing/validating/refining]

## Immediate Next Steps

1. [What to ask/do next]
2. [Follow-up needed on X]
3. [Validate Y with web search]

## User Rapport Notes

- Communication style: [verbose/terse/analytical/emotional]
- Engagement level: [high/medium/low]
- Topics that energize: [list]
- Topics to avoid: [list]

## User-Suggested Ideas

- [Idea user brought up] - Status: [exploring/validated/flagged]
- ...

## Critical Context

[Anything the next agent MUST know to continue naturally]
```

### 5.4 Proactive Handoff Trigger

The agent proactively initiates handoff **before** hitting limits:

```
HANDOFF PROTOCOL:

1. Monitor token usage continuously
2. At ~80% capacity (80k tokens), begin handoff preparation
3. Complete current conversational exchange naturally
4. Generate all memory files with current state
5. Seamless transition message:

   AGENT: "Let me take a moment to organize my thoughts on
   everything we've discussed..."
   [Brief pause — memory files generated]
   "Alright, I've got it all mapped out. Now, where were we?
   You were telling me about [last topic]..."

6. New agent instance loads memory files and continues
```

---

## 6. User Interface Design

### 6.1 Entry Point

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATE NEW IDEA                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  How would you like to start?                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📝 I HAVE AN IDEA                                       │   │
│  │  I know what I want to build and can describe it         │   │
│  │                                         [Start Capture →] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  💡 HELP ME DISCOVER AN IDEA                             │   │
│  │  Let the Ideation Agent guide you through discovery      │   │
│  │                                                          │   │
│  │  • Explores your interests, expertise, and vision        │   │
│  │  • Analyzes market opportunities in real-time            │   │
│  │  • Surfaces ideas where you and the market align         │   │
│  │                                                          │   │
│  │                                          [Start Guide →]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Guided Session Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Ideation Agent                                      [Exit]      │
├───────────────────────────────────┬─────────────────────────────┤
│                                   │                             │
│  CONVERSATION                     │  IDEA CANDIDATE             │
│  ─────────────                    │  ──────────────             │
│                                   │                             │
│  ┌─────────────────────────────┐  │  ┌───────────────────────┐ │
│  │ Agent: Welcome! I'm here    │  │  │                       │ │
│  │ to help you discover an     │  │  │  [Empty state]        │ │
│  │ idea that's right for you.  │  │  │                       │ │
│  │                             │  │  │  Your idea will       │ │
│  │ I've loaded your profile... │  │  │  appear here as we    │ │
│  └─────────────────────────────┘  │  │  explore together.    │ │
│                                   │  │                       │ │
│  ┌─────────────────────────────┐  │  └───────────────────────┘ │
│  │ User: [response]            │  │                             │
│  └─────────────────────────────┘  │                             │
│                                   │                             │
│  ┌─────────────────────────────┐  │                             │
│  │ Agent: [response with       │  │                             │
│  │ occasional witty joke]      │  │                             │
│  │                             │  │                             │
│  │ [Button] [Button] [Button]  │  │                             │
│  └─────────────────────────────┘  │                             │
│                                   │                             │
│  ...                              │                             │
│                                   │                             │
├───────────────────────────────────┤                             │
│                                   │                             │
│  [Text input field]      [Send]   │                             │
│                                   │                             │
└───────────────────────────────────┴─────────────────────────────┘
```

### 6.3 Button-Based Multiple Choice (In-Chat)

When the agent presents options, they appear as **clickable buttons** in the chat:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  AGENT: "That's an interesting direction. Let me ask:           │
│  Would you prefer to build something that serves..."            │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Individual      │  │ Small           │  │ Enterprise      │ │
│  │ consumers       │  │ businesses      │  │ companies       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ I'm not sure yet — help me figure it out                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Button behavior:**

- Clicking a button sends that option as the user's response
- User can still type a custom response instead
- Buttons are styled distinctly from regular text
- "Not sure" or "Skip" is always an option

### 6.4 Idea Card with Dual Meters

When idea candidate surfaces:

```
┌───────────────────────────────────┐
│                                   │
│  AI Writing Coach for             │
│  Non-Native Speakers              │
│                                   │
│  ─────────────────────────────    │
│                                   │
│  Confidence: 73%                  │
│  ████████████████░░░░░░           │
│                                   │
│  Viability: 82%                   │
│  ██████████████████░░░░ ✓         │
│                                   │
│  ─────────────────────────────    │
│                                   │
│  [Continue refining]              │
│  [Capture this idea]              │
│  [Discard & restart]              │
│  [Save for later]                 │
│                                   │
└───────────────────────────────────┘
```

### 6.5 Viability Warning State

When viability drops:

```
┌───────────────────────────────────┐
│                                   │
│  Quantum Computing for            │
│  Small Business Accounting        │
│                                   │
│  ─────────────────────────────    │
│                                   │
│  Confidence: 65%                  │
│  ██████████████░░░░░░░░           │
│                                   │
│  Viability: 28% ⚠️                │
│  ██████░░░░░░░░░░░░░░░░           │
│                                   │
│  ─────────────────────────────    │
│                                   │
│  ⚠️ Significant challenges        │
│  detected. See conversation.      │
│                                   │
│  [Address challenges]             │
│  [Pivot direction]                │
│  [Discard & restart]              │
│                                   │
└───────────────────────────────────┘
```

### 6.6 One Idea at a Time Constraint

When user wants to explore a new direction with an existing idea:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  You already have an idea in progress:                          │
│                                                                 │
│  "AI Writing Coach for Non-Native Speakers"                     │
│  Confidence: 73% | Viability: 82%                               │
│                                                                 │
│  To start exploring a new direction, please:                    │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │  💾 Save for      │  │  🗑️ Discard       │                  │
│  │     Later         │  │                   │                  │
│  └───────────────────┘  └───────────────────┘                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Cancel — Keep exploring current idea                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.7 Form-Based Questions

The agent can present multi-question forms when efficient:

```
┌─────────────────────────────────────────────────────────────────┐
│ Agent: Let me understand your constraints better.               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Where do you want to operate?                                  │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ My city    │ │ Australia  │ │ English-     │ │ Global     │ │
│  │ (Sydney)   │ │ wide       │ │ speaking     │ │ anywhere   │ │
│  └────────────┘ └────────────┘ └──────────────┘ └────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ I'm flexible — depends on the idea                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  What type of product appeals to you? (select all that apply)  │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐      │
│  │ ☐ Digital      │ │ ☐ Physical     │ │ ☐ Service      │      │
│  │   product      │ │   product      │ │   business     │      │
│  └────────────────┘ └────────────────┘ └────────────────┘      │
│  ┌────────────────┐ ┌────────────────┐                         │
│  │ ☐ Marketplace  │ │ ☐ Open to      │                         │
│  │   / platform   │ │   anything     │                         │
│  └────────────────┘ └────────────────┘                         │
│                                                                 │
│  Hours per week you could dedicate initially?                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [slider: 0 ──────●────────────────── 40+]  15 hrs       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                         [Submit Answers] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Supported Input Types:**

- **Buttons** (single select — primary method for quick choices)
- **Button groups** (multi-select with checkboxes)
- **Text** (single line, multi-line)
- **Sliders** (numeric ranges)
- **Dropdowns** (long option lists)
- **Date pickers** (if relevant)
- **"I don't know" / "Skip"** always available as button

---

## 7. Conversation Design

### 7.1 Opening Greeting

```
IDEATION AGENT:

"Welcome! I'm here to help you discover a business idea that's
genuinely right for you.

Here's how this works: We'll have a conversation where I ask
questions, you answer, and together we'll explore what excites
you and what the market needs. As we go, I'll be looking for
where those two things overlap.

When I spot a promising idea, it'll appear in the panel to your
right. I'll also let you know if I see significant challenges —
better to know early than waste time on something that won't work.

Feel free to suggest any ideas you've been thinking about — I'll
help you explore and validate them.

I've loaded your profile, so I know you have background in
[domains from profile] and are interested in [interests from
profile]. Let's use that as our starting point.

What's been occupying your mind lately? Any problems you've
noticed, frustrations you've had, or opportunities you've
wondered about?"
```

### 7.2 Conversation Patterns

**Transparent context-building:**

```
AGENT: "Earlier you mentioned you lose track of time when coding.
I'm asking about this specifically because I want to understand if
building a technical product would genuinely energize you long-term.
Does coding feel like play or like work?"

[Purpose revealed: connecting to earlier answer for clarity]
```

**Accepting user-suggested ideas:**

```
USER: "Actually, I've had this idea for a while — what about a
marketplace for vintage synthesizers?"

AGENT: "Let's explore that! I'm going to ask some questions to
understand how this connects to what we've discussed.

What drew you to this specific idea? Is it personal experience
with buying/selling synths, or more of an observation?"

[Naturally pivots to explore user's idea]
```

**Introducing market data:**

```
AGENT: "I did a quick search on vintage synth marketplaces.
Found a few players: Reverb.com dominates, there's also Vintage
Synth Explorer and some Facebook groups.

Interestingly, I'm seeing complaints about [specific gap found].
Does that match what you've experienced?"

[Always cites what was searched]
```

**Viability concern (calm, evidence-based):**

```
AGENT: "I need to share something important here.

I searched for 'AI-powered real-time language translation hardware'
and found some significant challenges:

1. The major players (Google, Apple) have spent billions and still
   have latency issues [source: TechCrunch 2024]
2. Custom hardware requires $2M+ in development [source: hardware
   startup analysis]
3. Three well-funded startups in this space failed in 2023
   [source: startup post-mortems]

This doesn't mean the idea is bad, but these are real obstacles.

[Button: Explore how to address these]
[Button: Pivot to a related direction]
[Button: Continue anyway — I understand the risks]
[Button: Discard and start fresh]"
```

### 7.3 Tone Guidelines

| Attribute        | Guideline                                       |
| ---------------- | ----------------------------------------------- |
| **Base tone**    | Neutral, professional, curious                  |
| **Warmth**       | Friendly but not effusive                       |
| **Humor**        | Occasional witty one-liner (random, not forced) |
| **Honesty**      | Direct about challenges, cites evidence         |
| **Transparency** | Explains "why I'm asking" when helpful          |
| **Pacing**       | Mix of single questions and button choices      |

**Witty interjections (random, ~10% of responses):**

- "Ah, the classic 'surely someone's solved this' moment. Usually they haven't, or they've done it poorly."
- "That's either a terrible idea or a brilliant one. Often the same thing."
- "Noted. I'm adding 'has strong opinions about X' to my mental file."
- "Most people say 'everyone' when asked who'd use their idea. You didn't. That's good."

### 7.4 Handling Edge Cases

**User gives very short answers:**

```
AGENT: "Got it. Let me dig a bit deeper — when you say [short answer],
what's behind that? I'm trying to understand the 'why' not just the 'what'."
```

**User suggests an idea mid-conversation:**

```
AGENT: "That's a concrete idea — let's explore it. I'll connect this
to what we've discussed and run some market validation.

[Continues with targeted questions for that idea]"
```

**Viability drops critically:**

```
AGENT: "I want to pause here. Based on my research, this direction
has some fundamental challenges we should discuss before going further.

[Explains concerns with sources, offers options as buttons]"
```

**User ignores viability warnings:**

```
AGENT: "Understood — you want to proceed despite the challenges.
I'll note that the viability score is [X]% and continue. We can
revisit this later.

[Continues but keeps tracking viability]"
```

---

## 8. Idea Capture Handoff

### 8.1 When User Captures

When user clicks "Capture this idea" (at any confidence level):

```typescript
interface CaptureHandoff {
  // Pre-populated in README.md
  title: string;
  type: "business" | "creative" | "technical" | "personal" | "research";
  overview: string;
  problemStatement: string;
  targetUsers: string[];
  proposedSolution: string;
  keyFeatures: string[];

  // Stored in ideation-session metadata
  ideationMetadata: {
    sessionId: string;
    confidenceAtCapture: number;
    viabilityAtCapture: number;
    viabilityRisks: ViabilityRisk[];
    conversationSummary: string;
    selfDiscoveryFindings: object;
    marketDiscoveryFindings: object;
    webSearchSources: string[];
    narrowingDecisions: string[];
    userSuggestedIdea: boolean; // Did user bring this idea?
  };

  // Pre-answered for Development phase
  preAnsweredQuestions: {
    questionId: string;
    answer: string;
    source: "ideation_agent";
    confidence: number;
  }[];
}
```

### 8.2 Development Phase Integration

Questions answered during ideation are pre-populated in Development:

```
DEVELOPMENT WIZARD:

"Welcome to development! I see you came from guided ideation.

I've pre-filled some answers based on your ideation session:
• Target user: [pre-filled]
• Core problem: [pre-filled]
• Your unfair advantage: [pre-filled]

Note: This idea had a viability score of [X]% at capture.
Known risks: [list from viability assessment]

Let's focus on the areas we haven't covered yet..."
```

---

## 9. What to Avoid

### 9.1 Overlap with Other Phases

| Phase           | What It Handles                                   | Ideation Agent MUST NOT         |
| --------------- | ------------------------------------------------- | ------------------------------- |
| **Profile**     | Goals, passions, skills, network, life stage      | Re-ask profile questions        |
| **Development** | Detailed user personas, business model, execution | Get into implementation details |
| **Evaluation**  | 30 criteria scoring                               | Ask evaluation questions        |
| **Red Team**    | Assumption challenges                             | Play devil's advocate           |

### 9.2 Anti-Patterns

**DON'T: Always hide purpose**

```
❌ Never explaining why you're asking anything
✓ Reveal purpose when it helps user answer better
```

**DON'T: Over-structure the conversation**

```
❌ "Let's go through 5 categories: first, your frustrations..."
❌ "Question 7 of 20: What is your..."
```

**DON'T: Push toward specific ideas**

```
❌ "I think you should build X because..."
❌ "The best idea here is clearly..."
```

**DON'T: Ignore user-suggested ideas**

```
❌ "Let's continue with my questions instead."
✓ "That's interesting — let's explore that."
```

**DON'T: Skip viability warnings**

```
❌ Presenting idea without checking feasibility
❌ Ignoring red flags from web search
```

**DON'T: Make users type when buttons work**

```
❌ "Type A, B, or C to select..."
✓ [Button A] [Button B] [Button C]
```

---

## 10. Implementation Phases

### Phase 1: Foundation (MVP)

- [ ] Basic conversational agent with core methodology
- [ ] Profile loading and gap identification
- [ ] Simple confidence tracking
- [ ] **Button-based multiple choice in chat**
- [ ] Single idea candidate display
- [ ] Basic web search integration
- [ ] Basic UI (conversation + idea panel)

### Phase 2: Intelligence

- [ ] Strategic questioning (covert vs transparent)
- [ ] Automated narrowing logic
- [ ] **Viability meter with web-search validation**
- [ ] **User-suggested idea handling**
- [ ] Form-based multi-question capability
- [ ] Agent handoff with memory files (100k context)
- [ ] Confidence calculation refinement

### Phase 3: Polish

- [ ] Witty interjection system
- [ ] **Viability intervention UI flows**
- [ ] Development phase pre-population
- [ ] Save for later → Ideas list integration
- [ ] Session analytics and improvement
- [ ] Edge case handling refinement

---

## 11. Technical Specifications

### 11.1 Database Schema Additions

```sql
-- Ideation sessions
CREATE TABLE ideation_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES user_profiles(id),
  status TEXT CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  handoff_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0
);

-- Ideation memory files
CREATE TABLE ideation_memory (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES ideation_sessions(id),
  file_type TEXT CHECK (file_type IN (
    'self_discovery', 'market_discovery', 'narrowing_state',
    'conversation_summary', 'idea_candidate', 'viability_assessment',
    'handoff_notes'
  )),
  content TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Idea candidates (during session)
CREATE TABLE ideation_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES ideation_sessions(id),
  title TEXT,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  viability INTEGER CHECK (viability >= 0 AND viability <= 100),
  user_suggested BOOLEAN DEFAULT FALSE,
  status TEXT CHECK (status IN ('forming', 'active', 'captured', 'discarded', 'saved')),
  idea_id TEXT REFERENCES ideas(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Viability risks
CREATE TABLE ideation_viability_risks (
  id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES ideation_candidates(id),
  risk_type TEXT CHECK (risk_type IN (
    'impossible', 'unrealistic', 'too_complex', 'too_vague',
    'saturated_market', 'wrong_timing', 'resource_mismatch'
  )),
  description TEXT,
  evidence_url TEXT,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Web search results cache
CREATE TABLE ideation_searches (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES ideation_sessions(id),
  query TEXT,
  results TEXT,
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 11.2 API Endpoints

```typescript
// Start ideation session
POST /api/ideation/start
Body: { profileId: string }
Response: { sessionId: string, greeting: string }

// Send message
POST /api/ideation/message
Body: { sessionId: string, message: string }
Response: {
  reply: string,
  ideaCandidate: {
    title: string,
    confidence: number,
    viability: number,
    risks: ViabilityRisk[]
  } | null,
  buttons: ButtonOption[] | null,  // For multiple choice
  formFields: FormField[] | null
}

// Button click
POST /api/ideation/button
Body: { sessionId: string, buttonId: string, buttonValue: string }
Response: { reply: string, ... }

// Submit form
POST /api/ideation/form
Body: { sessionId: string, answers: Record<string, any> }
Response: { reply: string, ... }

// Capture idea
POST /api/ideation/capture
Body: { sessionId: string }
Response: { ideaId: string, ideaSlug: string }

// Save for later
POST /api/ideation/save
Body: { sessionId: string }
Response: { savedIdeaId: string }

// Discard and restart
POST /api/ideation/discard
Body: { sessionId: string }
Response: { newSessionId: string, greeting: string }

// Web search (internal)
POST /api/ideation/search
Body: { sessionId: string, query: string }
Response: { results: SearchResult[] }
```

### 11.3 Button Response Schema

```typescript
interface ButtonOption {
  id: string;
  label: string;
  value: string;
  style: "primary" | "secondary" | "outline";
  fullWidth?: boolean; // For "I'm not sure" type options
}

interface AgentResponse {
  text: string;
  buttons?: ButtonOption[];
  // Either buttons OR formFields, not both
  formFields?: FormField[];
}
```

---

## 12. Success Metrics

| Metric                           | Target          | Measurement                          |
| -------------------------------- | --------------- | ------------------------------------ |
| Session start rate               | 30% of captures | % who choose guided vs direct        |
| Completion rate                  | 60%             | % reaching idea capture              |
| Average confidence at capture    | 85%             | Mean confidence level                |
| **Average viability at capture** | **70%**         | Mean viability level                 |
| Time to first idea candidate     | < 10 min        | Time until idea appears              |
| User satisfaction                | 4.0/5           | Post-session rating                  |
| Downstream conversion            | > 50%           | % completing Development             |
| Evaluation score delta           | +0.5            | Guided vs direct capture scores      |
| **Viability intervention rate**  | **< 20%**       | % of sessions with critical warnings |

---

_Document Version: 3.0_
_Created: 2025-12-30_
_Last Updated: 2025-12-30_
_Status: Ready for Technical Specification_
