# Monitoring & Question UI System

> **Purpose**: Define the web-based interface for monitoring agents and answering questions - accessible from anywhere, not limited to terminal/IDE.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [System Architecture](#system-architecture)
3. [Question Delivery Channels](#question-delivery-channels)
4. [Web Dashboard](#web-dashboard)
5. [Mobile Experience](#mobile-experience)
6. [Notification System](#notification-system)
7. [Question Queue Management](#question-queue-management)
8. [Real-Time Updates](#real-time-updates)
9. [Authentication & Security](#authentication--security)
10. [Implementation Tasks](#implementation-tasks)

---

## The Problem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHY TERMINAL/IDE ISN'T ENOUGH                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SCENARIO 1: Agent works overnight                                          │
│  ─────────────────────────────────────                                       │
│  • You start a build at 6pm                                                 │
│  • Agent has question at 6:15pm                                             │
│  • You close laptop at 6:30pm                                               │
│  • Agent is BLOCKED for 14 hours                                            │
│                                                                              │
│  SCENARIO 2: Multiple agents working                                        │
│  ─────────────────────────────────────                                       │
│  • Spec Agent generating spec A                                             │
│  • Build Agent executing spec B                                             │
│  • SIA reviewing spec C                                                     │
│  • 3 questions arrive in 5 minutes                                          │
│  • Terminal only shows latest                                               │
│                                                                              │
│  SCENARIO 3: Mobile access needed                                           │
│  ─────────────────────────────────────                                       │
│  • You're at lunch, phone buzzes                                            │
│  • "Build Agent needs architecture decision"                                │
│  • Can't answer from terminal                                               │
│  • Agent blocked until you're at computer                                   │
│                                                                              │
│  SOLUTION: Web-based dashboard + push notifications                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONITORING & QUESTION SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    MONITORING AGENT (System Soul)                     │   │
│  │                                                                       │   │
│  │   ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐   │   │
│  │   │  Event Bus      │    │  Puppeteer MCP  │    │   Detection    │   │   │
│  │   │  Listener       │    │  Observer       │    │   Engine       │   │   │
│  │   │  (Primary)      │    │  (UI Validate)  │    │                │   │   │
│  │   └────────┬────────┘    └────────┬────────┘    └────────────────┘   │   │
│  │            └──────────┬───────────┘                                   │   │
│  │                       ▼                                               │   │
│  │            ┌─────────────────┐    ┌─────────────────┐                │   │
│  │            │ State Reconciler│───▶│Response Escalator│               │   │
│  │            └─────────────────┘    └────────┬────────┘                │   │
│  │                                            ▼                          │   │
│  │            ┌─────────────────┐    ┌─────────────────┐                │   │
│  │            │Heartbeat Emitter│    │ Action Executor │                │   │
│  │            │ (Health Signal) │    │(Observe-Confirm)│                │   │
│  │            └─────────────────┘    └─────────────────┘                │   │
│  │                                                                       │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │ monitors                              │
│                                     ▼                                       │
│                              ┌─────────────┐                                │
│                              │Worker Agents│                                │
│                              │ (Spec/Build/│                                │
│                              │  Val/SIA)   │                                │
│                              └──────┬──────┘                                │
│                                     │                                        │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                      ORCHESTRATION SERVER                         │       │
│  │                                                                   │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │       │
│  │  │  Question   │  │   Agent     │  │    Notification         │  │       │
│  │  │   Queue     │  │   Status    │  │    Dispatcher           │  │       │
│  │  │   Manager   │  │   Tracker   │  │                         │  │       │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │       │
│  │         │                │                     │                 │       │
│  │         └────────────────┼─────────────────────┘                 │       │
│  │                          │                                        │       │
│  │                          ▼                                        │       │
│  │  ┌───────────────────────────────────────────────────────────┐   │       │
│  │  │                   WebSocket Server                         │   │       │
│  │  │              (Real-time updates to all clients)            │   │       │
│  │  └───────────────────────────────────────────────────────────┘   │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                     │                                        │
│           ┌─────────────────────────┼─────────────────────────┐              │
│           │                         │                         │              │
│           ▼                         ▼                         ▼              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   Web Browser   │    │  Mobile Browser │    │   Telegram Bot  │          │
│  │   (Dashboard)   │    │   (Responsive)  │    │   (Questions)   │          │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘          │
│           │                         │                         │              │
│           └─────────────────────────┼─────────────────────────┘              │
│                                     │                                        │
│                                     ▼                                        │
│                            ┌─────────────┐                                  │
│                            │    USER     │                                  │
│                            │  (answers)  │                                  │
│                            └─────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Monitoring Agent (Hybrid Architecture)

> The Monitoring Agent is the "soul" of the Vibe platform. It watches all other agents and the UI through two data sources.

### Data Sources

| Source | Role | Characteristics |
|--------|------|-----------------|
| **Event Bus** | Primary truth | Real-time (<10ms), typed, authoritative |
| **Puppeteer MCP** | UI validation | Validates user experience, catches UI bugs |

### How They Work Together

| Scenario | Event Bus Says | Puppeteer Says | Action |
|----------|----------------|----------------|--------|
| Normal | Agent working | Agent working | None |
| UI Bug | Agent working | Agent idle | Flag UI bug, trust Event Bus |
| Stale WebSocket | Agent idle | Agent working | Reconnect WebSocket |
| Both agree error | Agent errored | Error displayed | High confidence → take action |
| Conflict | Agent done | Agent stuck | Investigate, don't act hastily |

### Health States

| State | Meaning | System Behavior |
|-------|---------|-----------------|
| HEALTHY | Both sources connected | Normal operation |
| DEGRADED | One source down | Continue with caution, extra logging |
| UNHEALTHY | Both sources down | Pause all loops, wait for recovery |
| CRITICAL | Unhealthy > 5 min | Terminate sessions, alert human |

### Response Levels (Graduated)

| Level | Name | Reversible | Human Approval |
|-------|------|------------|----------------|
| 0 | OBSERVE | ✓ | No |
| 1 | LOG | ✓ | No |
| 2 | ALERT | ✓ | No |
| 3 | WARN | ✓ | No |
| 4 | PAUSE | ✓ | No |
| 5 | RESTART | ✗ | No (auto) |
| 6 | KILL | ✗ | **Yes** |
| 7 | EMERGENCY | ✗ | **Yes** |

---

## Question Delivery Channels

### Channel Matrix

| Channel | Blocking Qs | Clarifying Qs | Celebratory | Best For |
|---------|-------------|---------------|-------------|----------|
| **Web Dashboard** | ✓ Modal | ✓ Queue | ✓ Toast | Primary interface |
| **Telegram** | ✓ Immediate | ✓ Digest | ✓ Summary | Mobile, away from desk |
| **Email** | ✗ Too slow | ✓ Daily digest | ✓ Weekly | Async review |
| **Browser Push** | ✓ Immediate | ✓ Badge | ✗ Skip | Quick attention |
| **IDE Integration** | ✓ Inline | ✓ Sidebar | ✓ Popup | During development |

### Channel Selection Logic

```typescript
interface NotificationRouter {
  route(question: Question): Channel[] {
    const channels: Channel[] = [];

    // Blocking questions: ALL channels
    if (question.blocking) {
      channels.push('web_modal', 'telegram', 'browser_push');
      if (this.isWorkingHours()) {
        channels.push('ide');
      }
    }

    // Clarifying: queue + optional push
    else if (question.type === 'clarifying') {
      channels.push('web_queue');
      if (question.priority > 0.7) {
        channels.push('browser_push');
      }
    }

    // Educational: queue only
    else if (question.type === 'educational') {
      channels.push('web_queue');
    }

    // Celebratory: toast + telegram
    else if (question.type === 'celebratory') {
      channels.push('web_toast', 'telegram');
    }

    return channels;
  }
}
```

---

## Web Dashboard

### URL Structure

```
https://vibe.local/                    # Dashboard home
https://vibe.local/questions           # Question queue
https://vibe.local/questions/:id       # Single question (deep link)
https://vibe.local/agents              # Agent status
https://vibe.local/timeline            # Activity history
https://vibe.local/ideas/:slug         # Idea-specific view
https://vibe.local/settings            # Notification preferences
```

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VIBE DASHBOARD                         🔔 3   ⚙️   👤 User                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     BLOCKING QUESTION BANNER                         │    │
│  │                                                                      │    │
│  │  ⚠️ Spec Agent needs your input: "Which auth approach?"              │    │
│  │                                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │    │
│  │  │   JWT    │  │ Sessions │  │  Other   │                          │    │
│  │  └──────────┘  └──────────┘  └──────────┘                          │    │
│  │                                                                      │    │
│  │  Asked 5 minutes ago • Blocking build                               │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌───────────────────────────┐  ┌───────────────────────────────────────┐   │
│  │     AGENT STATUS          │  │        QUESTION QUEUE (3)             │   │
│  │                           │  │                                        │   │
│  │  ┌─────────────────────┐  │  │  ┌────────────────────────────────┐   │   │
│  │  │ 🔵 Spec Agent       │  │  │  │ 1. [BLOCKING] Auth approach    │   │   │
│  │  │   Working on: auth  │  │  │  │    Spec Agent • 5m ago        │   │   │
│  │  │   Progress: 67%     │  │  │  └────────────────────────────────┘   │   │
│  │  └─────────────────────┘  │  │  ┌────────────────────────────────┐   │   │
│  │  ┌─────────────────────┐  │  │  │ 2. Coverage threshold?         │   │   │
│  │  │ ⏸️ Build Agent       │  │  │  │    Val Agent • 12m ago        │   │   │
│  │  │   Waiting for spec  │  │  │  └────────────────────────────────┘   │   │
│  │  └─────────────────────┘  │  │  ┌────────────────────────────────┐   │   │
│  │  ┌─────────────────────┐  │  │  │ 3. Record this gotcha?         │   │   │
│  │  │ ✅ Val Agent        │  │  │  │    SIA • 45m ago               │   │   │
│  │  │   Idle              │  │  │  └────────────────────────────────┘   │   │
│  │  └─────────────────────┘  │  │                                        │   │
│  │  ┌─────────────────────┐  │  │  [Answer All with Defaults]           │   │
│  │  │ 📚 SIA              │  │  │                                        │   │
│  │  │   Learning...       │  │  │                                        │   │
│  │  └─────────────────────┘  │  └───────────────────────────────────────┘   │
│  │                           │                                               │
│  └───────────────────────────┘                                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        ACTIVITY TIMELINE                              │   │
│  │                                                                       │   │
│  │  • 10:45 Spec Agent started generating spec for "User Auth"          │   │
│  │  • 10:48 Spec Agent loaded context (CLAUDE.md, templates)            │   │
│  │  • 10:52 ⚠️ Spec Agent asked: "Which auth approach?"                  │   │
│  │  • 10:30 ✅ Build Agent completed 5 tasks for "API Counter"          │   │
│  │  • 10:15 📚 SIA recorded gotcha: "SQLite date format"                │   │
│  │                                                                       │   │
│  │  [Load More]                                                          │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Question Detail View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Queue                                    Question Q-2025-0142    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  🔨 Spec Agent asks:                                                  │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                                  │ │   │
│  │  │  I see two approaches for session management:                    │ │   │
│  │  │                                                                  │ │   │
│  │  │  **Option A: JWT Tokens**                                        │ │   │
│  │  │  • Stateless, scales easily                                      │ │   │
│  │  │  • Can't invalidate without blacklist                            │ │   │
│  │  │  • Tokens can be large                                           │ │   │
│  │  │                                                                  │ │   │
│  │  │  **Option B: Server Sessions**                                   │ │   │
│  │  │  • Easy invalidation                                             │ │   │
│  │  │  • Requires session store                                        │ │   │
│  │  │  • Stateful                                                      │ │   │
│  │  │                                                                  │ │   │
│  │  │  Which approach fits your needs?                                 │ │   │
│  │  │                                                                  │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  **Why I'm asking:**                                                  │   │
│  │  This decision affects the entire auth implementation. JWT is        │   │
│  │  more common in modern apps, but sessions are simpler.              │   │
│  │                                                                       │   │
│  │  **Context:**                                                         │   │
│  │  • Idea: User Authentication                                         │   │
│  │  • Phase: Specification                                               │   │
│  │  • Blocking: Yes (agent paused)                                       │   │
│  │  • Asked: 5 minutes ago                                               │   │
│  │                                                                       │   │
│  │  ─────────────────────────────────────────────────────────────────── │   │
│  │                                                                       │   │
│  │  ┌────────────────┐  ┌────────────────┐                              │   │
│  │  │   JWT Tokens   │  │    Sessions    │                              │   │
│  │  │  (Recommended) │  │                │                              │   │
│  │  └────────────────┘  └────────────────┘                              │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Other: ________________________________________________        │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ┌────────────────────┐                                              │   │
│  │  │    Submit Answer   │                                              │   │
│  │  └────────────────────┘                                              │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Experience

### Responsive Design

```
┌─────────────────────┐
│ VIBE          🔔 3  │
├─────────────────────┤
│                     │
│ ⚠️ BLOCKING         │
│                     │
│ Spec Agent needs    │
│ your input          │
│                     │
│ "Which auth         │
│ approach?"          │
│                     │
│ ┌─────────────────┐ │
│ │   JWT Tokens    │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │    Sessions     │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │     Other       │ │
│ └─────────────────┘ │
│                     │
├─────────────────────┤
│ 📊  📝  🔔  ⚙️     │
│ Dash Queue Notif Set│
└─────────────────────┘
```

### Mobile-First Features

1. **Quick Answer Buttons** - One tap to answer common questions
2. **Swipe Gestures** - Swipe to dismiss, swipe to answer
3. **Offline Queue** - Queue answers when offline, sync when connected
4. **Voice Input** - Speak answers for "Other" option
5. **Push Notifications** - Native push for blocking questions

---

## Notification System

### Telegram Multi-Bot Architecture

> Each agent type has its own Telegram bot for clear, separated communication.

| Bot | Username | Purpose |
|-----|----------|---------|
| Monitoring Agent | @vibe_monitor_bot | Alerts, approvals, escalations |
| Orchestrator | @vibe_orchestrator_bot | System status, coordination |
| Spec Agent | @vibe_spec_bot | Spec questions, decisions |
| Build Agent | @vibe_build_bot | Build questions, progress |
| Validation Agent | @vibe_validation_bot | Test results, coverage questions |
| SIA | @vibe_sia_bot | Learning confirmations, gotchas |
| System | @vibe_system_bot | Fallback for all agents |

### Why One Bot Per Agent?

| Benefit | Description |
|---------|-------------|
| **Clarity** | Know instantly which agent is messaging you |
| **Control** | Mute noisy agents without missing critical ones |
| **Threading** | Each bot has separate conversation history |
| **Debugging** | Isolate issues to specific agents |

### Fallback Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATION DELIVERY CHAIN                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Question Created                                                           │
│         │                                                                    │
│         ▼                                                                    │
│   ┌─────────────┐   success   ┌─────────────────────────────────────┐       │
│   │  TELEGRAM   │────────────▶│ Delivered. Wait for response.       │       │
│   │  (primary)  │             │ Inline buttons for quick answer.    │       │
│   └──────┬──────┘             └─────────────────────────────────────┘       │
│          │ fails                                                             │
│          ▼                                                                   │
│   ┌─────────────┐   success   ┌─────────────────────────────────────┐       │
│   │   EMAIL     │────────────▶│ Delivered to ned.python@gmail.com   │       │
│   │  (fallback) │             │ Reply with number or text.          │       │
│   └──────┬──────┘             └─────────────────────────────────────┘       │
│          │ fails                                                             │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │  FALLBACK BEHAVIOR (based on question type):                     │       │
│   │                                                                   │       │
│   │  APPROVAL/EMERGENCY → HARD HALT (wait indefinitely)             │       │
│   │  ESCALATION         → HALT + retry notification hourly          │       │
│   │  DECISION           → Timeout to safe default (30 min)          │       │
│   │  BLOCKING           → Timeout to default (15 min)               │       │
│   │  CLARIFYING         → Timeout to default (5 min)                │       │
│   │  ALERT              → Log only, no halt                          │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example Messages

**From @vibe_spec_bot (Blocking Question):**
```
🔴 *Blocking Question*

Which authentication approach should I use?

*Options:*
• JWT Tokens - _Stateless, scales easily_
• Server Sessions - _Easy invalidation_

⏸️ _Agent blocked: spec-agent-123_

[JWT Tokens] [Server Sessions]
[💬 Other (type reply)]
```

**From @vibe_monitor_bot (Approval Required):**
```
🚨 *Approval Required*

I want to *KILL* agent `build-agent-456`.

*Rationale:*
_Agent has failed 5 consecutive tasks with same error._

*Evidence:*
```
TypeError: Cannot read property 'id' of undefined
```

⛔ _This action requires your explicit approval_
⏸️ _Session halted: build-agent-456_

[Yes, kill it] [No, let it retry]
[Pause instead]
[💬 Other (type reply)]
```

**From @vibe_monitor_bot (Summary - /summary command):**
```
📊 *Vibe Platform Summary*
_last hour_

*Agents:*
🔵 `spec-agent-123`: working - Generating auth spec...
⚪ `build-agent-456`: idle
🟡 `validation-agent-789`: blocked
🔴 `sia-agent-012`: error

*Activity:* 24 events
• Spec agent started auth specification
• Build agent completed 3 tasks

*Pending Questions:* 2
_Oldest:_ 15m ago

⚠️ *Issues Detected:* 1
• repeated_error: Same TypeError 3 times

_Generated: 2:45:32 PM_
```

### Telegram Bot Commands

```
/start            - Link bot to your account (verification required)
/summary          - Get status summary from Monitoring Agent
/summary 2h       - Summary for last 2 hours
/status           - Current agent status
/help             - List available commands
```

### Browser Push Notifications

```javascript
// Notification payload structure
interface PushNotification {
  title: string;        // "Blocking Question"
  body: string;         // "Spec Agent: Which auth approach?"
  icon: string;         // Agent icon
  badge: string;        // Notification badge
  tag: string;          // Question ID (replaces previous)
  data: {
    questionId: string;
    type: 'blocking' | 'clarifying' | 'celebratory';
    url: string;        // Deep link to question
  };
  actions: [            // Action buttons (Chrome)
    { action: 'option_1', title: 'JWT' },
    { action: 'option_2', title: 'Sessions' },
  ];
}
```

---

## Question Queue Management

### Question Types

The system supports two categories of question types:

**Standard Types** (from worker agents):
| Type | Description | Blocking |
|------|-------------|----------|
| BLOCKING | Agent cannot proceed without answer | Yes |
| CLARIFYING | Agent wants clarity, can proceed with default | No |
| CONFIRMING | Agent wants validation of approach | No |
| PREFERENCE | Agent wants to know user preference | No |

**Monitoring Types** (from Monitoring Agent - MON-009):
| Type | Description | Timeout Action |
|------|-------------|----------------|
| ALERT | FYI notification, no action required | None |
| ESCALATION | Tried to fix, need human help | Pause (10 min) |
| APPROVAL | Want to take destructive action | Safe default (5 min) |
| DECISION | Multiple valid responses, human chooses | Wait (3 min) |

### Queue States

```typescript
enum QuestionState {
  PENDING = 'pending',           // Waiting for answer
  ANSWERED = 'answered',         // User answered
  EXPIRED = 'expired',           // Timed out, default applied
  SKIPPED = 'skipped',           // User skipped
  SUPERSEDED = 'superseded',     // New question replaced this
}

interface QueuedQuestion {
  id: string;
  question: Question;
  state: QuestionState;

  // Timing
  createdAt: Date;
  expiresAt?: Date;
  answeredAt?: Date;

  // Notifications sent
  notificationsSent: {
    channel: string;
    sentAt: Date;
  }[];

  // Answer
  answer?: string;
  answeredBy?: 'user' | 'default' | 'timeout';
}
```

### Queue Priorities

```typescript
class QuestionQueue {
  private queue: QueuedQuestion[] = [];

  add(question: Question): void {
    const priority = this.calculatePriority(question);

    const queued: QueuedQuestion = {
      id: generateId(),
      question,
      state: QuestionState.PENDING,
      createdAt: new Date(),
      expiresAt: question.blocking ? undefined : this.calculateExpiry(question),
      notificationsSent: [],
    };

    // Insert by priority
    const insertIndex = this.queue.findIndex(q =>
      this.calculatePriority(q.question) < priority
    );

    if (insertIndex === -1) {
      this.queue.push(queued);
    } else {
      this.queue.splice(insertIndex, 0, queued);
    }

    // Dispatch notifications
    this.dispatchNotifications(queued);
  }

  private calculatePriority(q: Question): number {
    let score = 0;

    if (q.blocking) score += 1000;
    if (q.type === 'clarifying') score += 100;
    if (q.type === 'confirming') score += 50;
    if (q.type === 'educational') score += 10;

    // Older questions get slight boost
    const ageMinutes = (Date.now() - q.createdAt.getTime()) / 60000;
    score += Math.min(ageMinutes, 60); // Cap at 60 points

    return score;
  }

  getNext(): QueuedQuestion | null {
    return this.queue.find(q => q.state === QuestionState.PENDING) || null;
  }

  getPending(): QueuedQuestion[] {
    return this.queue.filter(q => q.state === QuestionState.PENDING);
  }

  getBlocking(): QueuedQuestion[] {
    return this.queue.filter(q =>
      q.state === QuestionState.PENDING && q.question.blocking
    );
  }
}
```

### "Answer All" Feature

```typescript
async function answerAllWithDefaults(queue: QuestionQueue): Promise<void> {
  const pending = queue.getPending();

  for (const queued of pending) {
    if (!queued.question.blocking && queued.question.defaultOption) {
      await queue.answer(queued.id, queued.question.defaultOption, 'default');
    }
  }
}
```

---

## Real-Time Updates

### WebSocket Protocol

```typescript
// Client → Server
interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'answer' | 'ping';
  payload: any;
}

// Server → Client
interface ServerMessage {
  type:
    | 'question.new'
    | 'question.answered'
    | 'question.expired'
    | 'agent.status'
    | 'agent.progress'
    | 'timeline.event'
    | 'milestone'
    | 'pong';
  payload: any;
}

// Connection handling
class RealtimeClient {
  private ws: WebSocket;
  private reconnectAttempts = 0;

  connect() {
    this.ws = new WebSocket('wss://vibe.local/ws');

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.subscribe(['questions', 'agents', 'timeline']);
    };

    this.ws.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };
  }

  private handleMessage(message: ServerMessage) {
    switch (message.type) {
      case 'question.new':
        this.onNewQuestion(message.payload);
        break;
      case 'agent.status':
        this.onAgentStatus(message.payload);
        break;
      case 'milestone':
        this.onMilestone(message.payload);
        break;
      // ...
    }
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }
}
```

### Server-Side Event Broadcasting

```typescript
// server/websocket.ts

class WebSocketServer {
  private clients: Map<string, WebSocket> = new Map();

  broadcast(message: ServerMessage, filter?: (clientId: string) => boolean) {
    for (const [clientId, ws] of this.clients) {
      if (!filter || filter(clientId)) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      }
    }
  }

  // Called by Question Queue
  onQuestionCreated(question: QueuedQuestion) {
    this.broadcast({
      type: 'question.new',
      payload: {
        id: question.id,
        agent: question.question.agent,
        type: question.question.type,
        blocking: question.question.blocking,
        preview: question.question.text.substring(0, 100),
      }
    });
  }

  // Called by Agent Status Tracker
  onAgentStatusChanged(agent: string, status: AgentStatus) {
    this.broadcast({
      type: 'agent.status',
      payload: { agent, ...status }
    });
  }

  // Called by Progress Tracker
  onAgentProgress(agent: string, progress: number, task?: string) {
    this.broadcast({
      type: 'agent.progress',
      payload: { agent, progress, task }
    });
  }
}
```

---

## Authentication & Security

### Access Control

```typescript
// Only authenticated users can access dashboard
// Single user for now, multi-user later

interface User {
  id: string;
  email: string;
  telegramChatId?: string;
  preferences: NotificationPreferences;
}

interface NotificationPreferences {
  blocking: {
    channels: ('web' | 'telegram' | 'push' | 'email')[];
    quietHours?: { start: string; end: string };
  };
  clarifying: {
    channels: ('web' | 'telegram')[];
    digestFrequency: 'immediate' | 'hourly' | 'daily';
  };
  celebratory: {
    channels: ('web' | 'telegram')[];
    enabled: boolean;
  };
}
```

### Secure Deep Links

```typescript
// Question deep links include signed token
function generateQuestionLink(questionId: string): string {
  const token = jwt.sign(
    { questionId, exp: Date.now() + 24 * 60 * 60 * 1000 },
    SECRET_KEY
  );
  return `https://vibe.local/questions/${questionId}?token=${token}`;
}

// Telegram callback buttons use signed tokens
function generateTelegramCallback(questionId: string, option: string): string {
  const token = jwt.sign(
    { questionId, option, exp: Date.now() + 60 * 60 * 1000 },
    SECRET_KEY
  );
  return `answer:${token}`;
}
```

---

## Implementation Tasks

These tasks should be added to the main task list:

| ID | Task | Pri | Category |
|----|------|-----|----------|
| UI-001 | Web dashboard layout and routing | P1 | Frontend |
| UI-002 | Agent status component | P1 | Frontend |
| UI-003 | Question queue component | P1 | Frontend |
| UI-004 | Question detail view | P1 | Frontend |
| UI-005 | Activity timeline component | P2 | Frontend |
| UI-006 | Blocking question banner/modal | P1 | Frontend |
| UI-007 | Mobile responsive design | P2 | Frontend |
| UI-008 | Answer submission handler | P1 | Frontend |
| WS-001 | WebSocket server setup | P1 | Backend |
| WS-002 | Client connection management | P1 | Backend |
| WS-003 | Event broadcasting | P1 | Backend |
| WS-004 | Reconnection handling | P2 | Backend |
| NTF-001 | Telegram bot setup | P2 | Integration |
| NTF-002 | Telegram question delivery | P2 | Integration |
| NTF-003 | Telegram inline answers | P2 | Integration |
| NTF-004 | Browser push notifications | P3 | Integration |
| NTF-005 | Email digest system | P4 | Integration |
| QUE-001 | Question queue database schema | P1 | Backend |
| QUE-002 | Queue priority management | P1 | Backend |
| QUE-003 | Answer processing | P1 | Backend |
| QUE-004 | Expiry and timeout handling | P2 | Backend |
| QUE-005 | "Answer all defaults" feature | P2 | Backend |
| SEC-001 | Authentication system | P1 | Security |
| SEC-002 | Signed deep links | P2 | Security |
| SEC-003 | Rate limiting | P3 | Security |

---

## Summary

| Feature | MVP (P1) | Enhanced (P2-P3) | Future (P4) |
|---------|----------|------------------|-------------|
| Web Dashboard | ✓ Basic layout | ✓ Rich UI | Analytics |
| Question Queue | ✓ List + answer | ✓ Priorities | ML routing |
| Real-time | ✓ WebSocket | ✓ Reconnect | Offline sync |
| Telegram | | ✓ Questions | ✓ Full control |
| Push | | ✓ Blocking only | All types |
| Email | | | ✓ Digests |
| Mobile | ✓ Responsive | ✓ PWA | Native app |

---

*The question system is how users stay connected to their agents. It must work everywhere, all the time.*
