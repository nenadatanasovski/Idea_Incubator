# Engagement & Orchestration UI System

> **Purpose**: Define proactive questioning throughout the lifecycle, question types per agent, and the visual orchestration display that keeps users engaged, informed, and in control.

---

## Table of Contents

1. [The Engagement Philosophy](#the-engagement-philosophy)
2. [Proactive Questioning Framework](#proactive-questioning-framework)
3. [Question Types by Agent](#question-types-by-agent)
4. [Question Prioritization & Timing](#question-prioritization--timing)
5. [Visual Orchestration Display](#visual-orchestration-display)
6. [UI Components](#ui-components)
7. [Interaction Patterns](#interaction-patterns)
8. [Implementation Specifications](#implementation-specifications)

---

## The Engagement Philosophy

### Why Proactive Questioning Matters

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    THE ENGAGEMENT SPECTRUM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   PASSIVE AUTOMATION              ACTIVE PARTNERSHIP                     │
│   ──────────────────              ──────────────────                     │
│                                                                          │
│   "System did stuff"    vs.     "System helped me think"                │
│                                                                          │
│   ┌──────────────────┐          ┌──────────────────┐                    │
│   │ User submits     │          │ User submits     │                    │
│   │ idea             │          │ idea             │                    │
│   └────────┬─────────┘          └────────┬─────────┘                    │
│            │                             │                               │
│            ▼                             ▼                               │
│   ┌──────────────────┐          ┌──────────────────┐                    │
│   │ ...silence...    │          │ "Great idea! Let │                    │
│   │                  │          │  me ask: Who's   │                    │
│   │                  │          │  your ideal      │                    │
│   │                  │          │  first user?"    │                    │
│   └────────┬─────────┘          └────────┬─────────┘                    │
│            │                             │                               │
│            ▼                             ▼                               │
│   ┌──────────────────┐          ┌──────────────────┐                    │
│   │ "Here's your     │          │ "Based on that,  │                    │
│   │  evaluation"     │          │  I'm thinking    │                    │
│   │                  │          │  about X. Does   │                    │
│   │ (User: "huh?")   │          │  that align?"    │                    │
│   └──────────────────┘          └────────┬─────────┘                    │
│                                          │                               │
│   User disengages                        ▼                               │
│                                 ┌──────────────────┐                    │
│                                 │ User feels       │                    │
│                                 │ ownership and    │                    │
│                                 │ excitement       │                    │
│                                 └──────────────────┘                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Principles

| Principle | Description | Example |
|-----------|-------------|---------|
| **Curiosity Over Assumption** | Ask rather than assume | "What budget are you comfortable with?" not assuming $10K |
| **Forward Thinking** | Help users anticipate | "Have you considered what happens when this scales?" |
| **Ownership Building** | User decides, system advises | "I see 3 options. Which feels right to you?" |
| **Excitement Maintenance** | Celebrate progress, validate effort | "This is a solid foundation. Ready for the next step?" |
| **Transparent Reasoning** | Explain why we're asking | "I'm asking because this affects the tech stack choice..." |

### When NOT to Ask

```yaml
Don't Ask When:
  - Answer is in existing context (CLAUDE.md, idea files)
  - Question is trivial (can default safely)
  - User is in "flow" mode (explicit preference)
  - Same question asked recently (< 24h)
  - Question doesn't affect outcome materially

Do Ask When:
  - Decision has significant downstream impact
  - Multiple valid approaches exist
  - User expertise could improve outcome
  - Risk/cost trade-off requires user values
  - Ambiguity could lead to wasted work
```

---

## Proactive Questioning Framework

### The Question Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      QUESTION LIFECYCLE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. TRIGGER          2. FORMULATE         3. PRIORITIZE                │
│   ─────────           ───────────          ───────────                  │
│   Agent detects       Create clear         Rank by:                     │
│   need for input      question with        • Blocking?                  │
│                       options              • Time-sensitive?            │
│                                            • Impact level               │
│                                                                          │
│        │                   │                    │                        │
│        ▼                   ▼                    ▼                        │
│                                                                          │
│   4. QUEUE            5. PRESENT           6. PROCESS                   │
│   ───────             ──────────           ──────────                   │
│   Add to question     Show at right        Record answer,               │
│   queue with          moment in UI         apply to context             │
│   metadata                                                               │
│                                                                          │
│        │                   │                    │                        │
│        ▼                   ▼                    ▼                        │
│                                                                          │
│   7. LEARN            8. ADAPT             9. REDUCE                    │
│   ────────            ────────             ────────                     │
│   Store preference    Apply to similar     Don't ask again              │
│   patterns            future situations    if pattern clear             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Question Types

```typescript
enum QuestionType {
  // Blocking - agent cannot proceed without answer
  BLOCKING = 'blocking',

  // Clarifying - improves quality but has safe default
  CLARIFYING = 'clarifying',

  // Confirming - validates agent's assumption
  CONFIRMING = 'confirming',

  // Educational - helps user think ahead
  EDUCATIONAL = 'educational',

  // Celebratory - marks progress, builds excitement
  CELEBRATORY = 'celebratory',

  // Preference - learns user style for future
  PREFERENCE = 'preference'
}

interface Question {
  id: string;
  type: QuestionType;
  agent: AgentType;
  phase: LifecyclePhase;

  // The question itself
  text: string;
  context: string;  // Why we're asking

  // Response options
  options?: QuestionOption[];
  allowFreeText: boolean;
  defaultOption?: string;

  // Timing
  blocking: boolean;
  expiresAt?: Date;
  reminderAfter?: Duration;

  // Metadata
  ideaId: string;
  sessionId: string;
  createdAt: Date;
  answeredAt?: Date;
  answer?: string;

  // Learning
  tags: string[];  // For pattern matching
  learnFromAnswer: boolean;
}

interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
  implications?: string;  // "Choosing this means..."
}
```

### Question Queue Management

```typescript
class QuestionQueue {
  private questions: Question[] = [];

  async add(question: Question): Promise<void> {
    // Check if similar question answered recently
    const similar = await this.findSimilar(question);
    if (similar && this.canReuse(similar)) {
      await this.applyPreviousAnswer(question, similar);
      return;
    }

    // Prioritize
    const priority = this.calculatePriority(question);
    this.questions.push({ ...question, priority });
    this.sortByPriority();

    // Notify UI if blocking
    if (question.blocking) {
      await this.notifyUrgent(question);
    }
  }

  private calculatePriority(q: Question): number {
    let score = 0;

    // Blocking questions highest priority
    if (q.blocking) score += 1000;

    // Time-sensitive questions
    if (q.expiresAt) {
      const hoursLeft = (q.expiresAt - Date.now()) / 3600000;
      score += Math.max(0, 100 - hoursLeft * 10);
    }

    // Phase-appropriate questions
    if (q.phase === this.currentPhase) score += 50;

    // Educational questions lower (but not hidden)
    if (q.type === QuestionType.EDUCATIONAL) score -= 20;

    return score;
  }

  getNextQuestion(): Question | null {
    return this.questions.find(q => !q.answeredAt) || null;
  }

  getPendingCount(): { blocking: number; total: number } {
    const pending = this.questions.filter(q => !q.answeredAt);
    return {
      blocking: pending.filter(q => q.blocking).length,
      total: pending.length
    };
  }
}
```

---

## Question Types by Agent

### Ideation Agent Questions

```yaml
Phase: SPARK → CLARIFY → RESEARCH

Trigger Points:
  - After initial idea capture
  - When problem statement is vague
  - When target user is undefined
  - After research reveals new angles
  - Before evaluation begins

Question Templates:

  # Core Understanding
  - type: BLOCKING
    trigger: "Problem statement < 50 words"
    template: |
      I want to make sure I understand the core problem.

      You mentioned: "{problem_snippet}"

      Could you tell me more about:
      • Who experiences this problem most acutely?
      • What happens when they can't solve it?
      • How are they solving it today?
    options:
      - "Let me clarify..." (free text)
      - "Actually, let me rethink the problem"
      - "The problem is clear, move forward"

  # Target User
  - type: CLARIFYING
    trigger: "No target user defined"
    template: |
      Who is the ideal first user for this?

      Knowing this helps me evaluate market fit and prioritize features.
    options:
      - "Myself / indie developers"
      - "Small business owners"
      - "Enterprise teams"
      - "Let me describe them..." (free text)

  # Scope Check
  - type: EDUCATIONAL
    trigger: "Idea complexity score > 7"
    template: |
      This idea has a lot of moving parts!

      Before we go further, have you thought about which part
      you'd build first to validate the core assumption?

      I'm asking because starting with an MVP helps test
      whether the fundamental problem-solution fit exists.
    options:
      - "Yes, I'd start with: {free text}"
      - "Help me think through this"
      - "I want to build the full thing"

  # Excitement Check
  - type: CELEBRATORY
    trigger: "After successful clarification round"
    template: |
      Great progress! You've now defined:
      ✓ A clear problem
      ✓ A specific target user
      ✓ An initial solution approach

      Ready to dive deeper into research and evaluation?
    options:
      - "Yes, let's continue!"
      - "Actually, I want to refine something"
      - "Save progress, continue later"

  # Research Direction
  - type: CONFIRMING
    trigger: "Before starting research phase"
    template: |
      I'm about to research these areas for your idea:

      1. Market size and trends
      2. Existing solutions and competitors
      3. Technical feasibility considerations

      Is there anything specific you want me to dig into?
    options:
      - "Those areas look good"
      - "Also look into: {free text}"
      - "Skip research, I know the market"
```

### Specification Agent Questions

```yaml
Phase: DESIGN → PROTOTYPE

Trigger Points:
  - When requirements are ambiguous
  - When multiple architectures are viable
  - When trade-offs need user input
  - Before finalizing spec
  - When scope creep detected

Question Templates:

  # Requirements Clarification
  - type: BLOCKING
    trigger: "Requirement has ambiguous terms"
    template: |
      I need to clarify a requirement before writing the spec.

      You mentioned: "{requirement}"

      What does "{ambiguous_term}" mean specifically?
      For example, does "fast" mean:
    options:
      - "< 100ms response time"
      - "< 1 second response time"
      - "Faster than current solution"
      - "Let me specify: {free text}"

  # Architecture Choice
  - type: BLOCKING
    trigger: "Multiple valid architectures exist"
    template: |
      I see two good approaches for {feature}:

      **Option A: {approach_a}**
      • Pros: {pros_a}
      • Cons: {cons_a}
      • Effort: {effort_a}

      **Option B: {approach_b}**
      • Pros: {pros_b}
      • Cons: {cons_b}
      • Effort: {effort_b}

      Which direction feels right?
    options:
      - "Option A"
      - "Option B"
      - "Tell me more about trade-offs"
      - "I have a different approach"

  # Scope Validation
  - type: CONFIRMING
    trigger: "Before finalizing specification"
    template: |
      Here's the scope I've captured for this feature:

      **In Scope:**
      {in_scope_list}

      **Explicitly Out of Scope:**
      {out_scope_list}

      Does this match your expectations?
    options:
      - "Yes, proceed with spec"
      - "Add to scope: {free text}"
      - "Remove from scope: {free text}"
      - "Let's discuss"

  # Dependency Alert
  - type: EDUCATIONAL
    trigger: "Spec has external dependencies"
    template: |
      This feature depends on:
      {dependency_list}

      Have you verified these are available/compatible?

      I'm flagging this because dependency issues are
      a common source of project delays.
    options:
      - "Yes, I've verified"
      - "Help me check"
      - "Let's design around them"

  # Progress Update
  - type: CELEBRATORY
    trigger: "Spec draft complete"
    template: |
      Specification complete!

      📋 {task_count} atomic tasks identified
      ⏱️ Estimated complexity: {complexity}
      🎯 Key risk areas: {risks}

      Ready for me to hand this to the Build Agent?
    options:
      - "Yes, start building!"
      - "Let me review the spec first"
      - "I have questions about {free text}"
```

### Build Agent Questions

```yaml
Phase: BUILD

Trigger Points:
  - When task is ambiguous
  - When implementation choice needed
  - When blocked on missing context
  - When unexpected complexity found
  - On significant milestones

Question Templates:

  # Implementation Choice
  - type: CLARIFYING
    trigger: "Multiple valid implementations"
    template: |
      Working on task: {task_id}

      I can implement this using:

      1. **{approach_1}** - {description_1}
      2. **{approach_2}** - {description_2}

      Based on your codebase patterns, I'd recommend #{recommendation}.
      Should I proceed with that?
    options:
      - "Yes, use your recommendation"
      - "Use approach 1"
      - "Use approach 2"
      - "Let me think about it"
    default: "Yes, use your recommendation"

  # Missing Context
  - type: BLOCKING
    trigger: "Required context not found"
    template: |
      I'm stuck on task: {task_id}

      I need to know: {missing_info}

      This isn't in the spec or existing codebase.
      Can you help me understand?
    options:
      - "Here's the answer: {free text}"
      - "Check this file: {file path}"
      - "Skip this task for now"
      - "Let's redesign this part"

  # Complexity Warning
  - type: EDUCATIONAL
    trigger: "Task taking 3x longer than estimated"
    template: |
      Task {task_id} is more complex than expected.

      **Original estimate:** {estimate}
      **Actual so far:** {actual}
      **Remaining work:** {remaining}

      This often happens when {common_reason}.

      Should I continue, or do you want to reconsider the approach?
    options:
      - "Continue, it's worth it"
      - "Simplify the approach"
      - "Pause and let's discuss"
      - "Skip for now"

  # Milestone Celebration
  - type: CELEBRATORY
    trigger: "Phase complete or 50% tasks done"
    template: |
      Milestone reached! 🎉

      **Completed:** {completed_count} / {total_count} tasks
      **Time elapsed:** {time}
      **Tests passing:** {test_status}

      {encouragement_message}

      Ready to continue?
    options:
      - "Keep going!"
      - "Show me what's done so far"
      - "Take a break, save progress"

  # Error Recovery
  - type: BLOCKING
    trigger: "Task failed after 3 attempts"
    template: |
      I've tried 3 times and can't complete task: {task_id}

      **Error:** {error_message}

      **What I've tried:**
      {attempts_list}

      I need your input to proceed.
    options:
      - "Try this: {free text}"
      - "Skip this task"
      - "Rethink the approach with me"
      - "I'll fix this manually"
```

### Validation Agent Questions

```yaml
Phase: TEST → REFINE

Trigger Points:
  - When validation level ambiguous
  - When failures found
  - When coverage is low
  - When security issues detected
  - Before sign-off

Question Templates:

  # Validation Level
  - type: CLARIFYING
    trigger: "Validation level not specified"
    template: |
      How thoroughly should I validate this build?

      • **Quick** (30s): Syntax, types, lint
      • **Standard** (2m): + Unit tests
      • **Thorough** (10m): + Integration, edge cases
      • **Comprehensive** (30m): + Performance, security
      • **Release** (2h): Full regression

      Based on the changes, I'd suggest: {recommendation}
    options:
      - "Quick"
      - "Standard"
      - "Thorough"
      - "Comprehensive"
      - "Release"
    default: recommendation

  # Failure Prioritization
  - type: BLOCKING
    trigger: "Multiple test failures"
    template: |
      Found {count} issues during validation:

      **Critical ({critical_count}):**
      {critical_list}

      **Warning ({warning_count}):**
      {warning_list}

      How should I prioritize fixes?
    options:
      - "Fix all critical first, then warnings"
      - "Fix all before proceeding"
      - "Show me each one to decide"
      - "Skip warnings, fix critical only"

  # Security Alert
  - type: BLOCKING
    trigger: "Security vulnerability detected"
    template: |
      ⚠️ Security issue detected!

      **Type:** {vuln_type}
      **Severity:** {severity}
      **Location:** {file}:{line}
      **Details:** {description}

      This needs immediate attention.
    options:
      - "Fix it now"
      - "Show me more details"
      - "I'll handle manually"
      - "Accept the risk (not recommended)"

  # Coverage Report
  - type: EDUCATIONAL
    trigger: "Coverage below threshold"
    template: |
      Test coverage is {coverage}%, below the {threshold}% target.

      **Uncovered areas:**
      {uncovered_list}

      Should I generate additional tests for these areas?

      Note: Higher coverage helps catch regressions but adds maintenance.
    options:
      - "Yes, generate more tests"
      - "Coverage is acceptable"
      - "Let's discuss which areas matter"

  # Sign-off Request
  - type: CONFIRMING
    trigger: "All validation passed"
    template: |
      ✅ Validation complete!

      **Results:**
      • Tests: {test_count} passing
      • Coverage: {coverage}%
      • Lint: {lint_status}
      • Security: {security_status}

      Ready to approve for deployment?
    options:
      - "Approved! Deploy it"
      - "Run one more check on {area}"
      - "Show me the details first"
```

### UX Agent Questions

```yaml
Phase: TEST (UX)

Trigger Points:
  - Before starting UX tests
  - When persona needed
  - When usability issue found
  - When accessibility issue found
  - After UX review complete

Question Templates:

  # Persona Selection
  - type: CLARIFYING
    trigger: "No persona specified for testing"
    template: |
      Who should I simulate for UX testing?

      I can test as:
      • **First-time user**: Never seen the app before
      • **Power user**: Knows shortcuts, efficient workflows
      • **Accessibility user**: Uses screen reader, keyboard-only
      • **Mobile user**: Touch-first, limited screen

      Or describe a specific persona.
    options:
      - "First-time user"
      - "Power user"
      - "Accessibility user"
      - "Mobile user"
      - "Test as: {free text}"
    default: "First-time user"

  # Usability Concern
  - type: EDUCATIONAL
    trigger: "Task took > 2x expected time"
    template: |
      I noticed this interaction took longer than expected:

      **Action:** {action}
      **Expected:** {expected_time}
      **Actual:** {actual_time}

      **Friction points:**
      {friction_list}

      Should I log this as a UX issue?
    options:
      - "Yes, log as issue"
      - "It's acceptable for now"
      - "Tell me more about the friction"
      - "Create a spec to fix it"

  # Accessibility Issue
  - type: BLOCKING
    trigger: "WCAG violation found"
    template: |
      Accessibility issue detected:

      **Violation:** {violation}
      **WCAG Level:** {level}
      **Impact:** {impact}
      **Element:** {element}

      This affects users with: {affected_users}

      How should we handle this?
    options:
      - "Fix immediately"
      - "Add to backlog"
      - "Show me the element"
      - "I'll review manually"

  # UX Summary
  - type: CELEBRATORY
    trigger: "UX testing complete"
    template: |
      UX Testing Complete!

      **Overall Score:** {score}/100

      **Highlights:**
      • {highlight_1}
      • {highlight_2}

      **Areas for Improvement:**
      • {improvement_1}
      • {improvement_2}

      Would you like me to create improvement specs?
    options:
      - "Yes, spec the improvements"
      - "Good enough for now"
      - "Let's discuss the results"
```

### SIA Agent Questions

```yaml
Phase: LEARN (Continuous)

Trigger Points:
  - When new pattern discovered
  - When gotcha could help others
  - Before updating CLAUDE.md
  - When confidence is low

Question Templates:

  # Pattern Confirmation
  - type: CONFIRMING
    trigger: "Pattern detected with high confidence"
    template: |
      I noticed a pattern across recent builds:

      **Pattern:** {pattern_description}
      **Occurrences:** {count} times
      **Context:** {contexts}

      Should I add this to the Knowledge Base?
    options:
      - "Yes, add it"
      - "Not a real pattern"
      - "Refine it first: {free text}"
      - "Show me examples"

  # Gotcha Validation
  - type: CONFIRMING
    trigger: "New gotcha candidate"
    template: |
      I want to capture this gotcha to prevent future issues:

      **Gotcha:** {gotcha}
      **Context:** {context}
      **Why it matters:** {impact}

      Agree to add it?
    options:
      - "Yes, add to Knowledge Base"
      - "It's project-specific, don't generalize"
      - "Reword it: {free text}"

  # CLAUDE.md Update
  - type: BLOCKING
    trigger: "Pattern ready for CLAUDE.md promotion"
    template: |
      This pattern has been useful across {count} builds:

      **Pattern:** {pattern}
      **Current location:** Knowledge Base
      **Proposed CLAUDE.md addition:**

      ```
      {proposed_addition}
      ```

      Should I add this to CLAUDE.md?
    options:
      - "Yes, promote it"
      - "Not yet, needs more validation"
      - "Modify it: {free text}"
      - "Keep it in Knowledge Base only"

  # Learning Summary
  - type: CELEBRATORY
    trigger: "Weekly summary time"
    template: |
      📚 Weekly Knowledge Growth

      **New patterns:** {pattern_count}
      **New gotchas:** {gotcha_count}
      **Knowledge Base entries:** {total_entries}
      **CLAUDE.md updates:** {claude_updates}

      Top learning: {top_learning}

      Would you like to review any of these?
    options:
      - "Show me the new patterns"
      - "Review gotchas"
      - "Looks good, continue"
```

---

## Question Prioritization & Timing

### Priority Matrix

```
                      URGENCY
                 Low    Medium    High
              ┌────────┬────────┬────────┐
         High │   2    │   1    │   1    │  ← BLOCKING questions
   IMPACT     ├────────┼────────┼────────┤
       Medium │   3    │   2    │   1    │  ← CLARIFYING questions
              ├────────┼────────┼────────┤
         Low  │   4    │   3    │   2    │  ← EDUCATIONAL questions
              └────────┴────────┴────────┘
                                              Numbers = Display order
```

### Timing Rules

```yaml
Blocking Questions:
  display: "Immediately, interrupting current view"
  notification: "Push + sound"
  timeout: "None - must be answered"
  reminder: "Every 5 minutes if unanswered"

Clarifying Questions:
  display: "In question queue, badge on header"
  notification: "Badge only"
  timeout: "4 hours, then use default"
  reminder: "Once after 30 minutes"

Confirming Questions:
  display: "In question queue"
  notification: "None"
  timeout: "24 hours, then assume yes"
  reminder: "None"

Educational Questions:
  display: "In 'Insights' panel"
  notification: "None"
  timeout: "1 week, then dismiss"
  reminder: "None"

Celebratory Questions:
  display: "Modal overlay with celebration"
  notification: "Push"
  timeout: "None - just acknowledgment"
  reminder: "None"
```

### Batching Logic

```typescript
class QuestionBatcher {
  // Group related questions together
  shouldBatch(q1: Question, q2: Question): boolean {
    // Same agent, same phase, within 5 minutes
    return (
      q1.agent === q2.agent &&
      q1.phase === q2.phase &&
      Math.abs(q1.createdAt - q2.createdAt) < 300000
    );
  }

  createBatch(questions: Question[]): QuestionBatch {
    return {
      id: generateId(),
      questions: questions,
      header: `${questions[0].agent} has ${questions.length} questions`,
      canAnswerAll: this.hasDefaultsForAll(questions)
    };
  }

  // "Answer all with defaults" option
  private hasDefaultsForAll(questions: Question[]): boolean {
    return questions.every(q => q.defaultOption !== undefined);
  }
}
```

---

## Visual Orchestration Display

### Main Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VIBE                                    [?] [⚙️] [👤 User]                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────────┐   │
│  │                 │  │                                                  │   │
│  │   IDEA LIST     │  │              MAIN CONTENT AREA                  │   │
│  │                 │  │                                                  │   │
│  │  ┌───────────┐  │  │  ┌────────────────────────────────────────────┐ │   │
│  │  │ 🌟 Vibe   │◄─┼──┼──│         ORCHESTRATION PANEL                │ │   │
│  │  │   ▸ Active│  │  │  │                                            │ │   │
│  │  └───────────┘  │  │  │  See detailed layout below                 │ │   │
│  │  ┌───────────┐  │  │  │                                            │ │   │
│  │  │ 💡 App 2  │  │  │  └────────────────────────────────────────────┘ │   │
│  │  └───────────┘  │  │                                                  │   │
│  │  ┌───────────┐  │  │  ┌────────────────────────────────────────────┐ │   │
│  │  │ 💡 App 3  │  │  │  │         QUESTION PANEL (if any)            │ │   │
│  │  └───────────┘  │  │  │                                            │ │   │
│  │                 │  │  │  Current questions waiting for input       │ │   │
│  │  + New Idea     │  │  │                                            │ │   │
│  │                 │  │  └────────────────────────────────────────────┘ │   │
│  └─────────────────┘  └─────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        ACTIVITY TIMELINE                              │   │
│  │  ← Older                                                    Now →    │   │
│  │  ═══════════════════════════════════════════════════════════════      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Orchestration Panel Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATION PANEL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PIPELINE STATUS                                         [Pause All] [▶️]    │
│  ──────────────                                                              │
│                                                                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐       │
│  │ IDEATION│──▶│  SPEC   │──▶│  BUILD  │──▶│ VALIDATE│──▶│   UX    │       │
│  │         │   │         │   │         │   │         │   │         │       │
│  │  ✓ Done │   │ ● Active│   │ ◯ Queue │   │ ◯ Queue │   │ ◯ Queue │       │
│  │         │   │ Task 3/7│   │         │   │         │   │         │       │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘       │
│                     │                                                        │
│                     ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ CURRENT ACTIVITY                                                      │   │
│  │                                                                       │   │
│  │  🔨 Spec Agent: Creating specification for "User Authentication"     │   │
│  │     ├── Loaded context: CLAUDE.md (auth section)                     │   │
│  │     ├── Loaded context: existing auth patterns                       │   │
│  │     └── Progress: Defining API routes (3/7 sections)                 │   │
│  │                                                                       │   │
│  │  ⏳ Estimated completion: ~4 minutes                                  │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ AGENT ACTIVITY                                            [Expand ▼] │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Ideation │ ████████████████████████████████ │ Idle (completed)  │ │   │
│  │  │ Spec     │ ███████████████░░░░░░░░░░░░░░░░░ │ 47% - Writing...  │ │   │
│  │  │ Build    │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ Waiting for spec  │ │   │
│  │  │ Validate │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ Waiting for build │ │   │
│  │  │ UX       │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ Waiting           │ │   │
│  │  │ SIA      │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ Listening...      │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Question Panel Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUESTION PANEL                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ⚠️ BLOCKING (1)                                              [Answer All]   │
│  ──────────────                                                              │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  🔨 Spec Agent asks:                                        2m ago   │   │
│  │                                                                       │   │
│  │  "I see two approaches for session management:                       │   │
│  │                                                                       │   │
│  │   **Option A: JWT Tokens**                                           │   │
│  │   • Stateless, scalable                                              │   │
│  │   • Can't invalidate easily                                          │   │
│  │                                                                       │   │
│  │   **Option B: Server Sessions**                                      │   │
│  │   • Easy invalidation                                                │   │
│  │   • Requires session store                                           │   │
│  │                                                                       │   │
│  │   Which approach fits your needs?"                                   │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐   │   │
│  │  │  Option A   │  │  Option B   │  │  Other: ________________    │   │   │
│  │  │ (Recommend) │  │             │  │                             │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘   │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  💡 CLARIFYING (3)                                                           │
│  ───────────────                                                             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  🔍 Build Agent asks:                                       15m ago  │   │
│  │  "Should I use the existing error handler pattern or create new?"    │   │
│  │  [Use Existing ✓] [Create New] [Show me both]                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  🧪 Validation Agent asks:                                  20m ago  │   │
│  │  "Coverage is 72%, below 80% target. Generate more tests?"           │   │
│  │  [Yes] [Acceptable] [Discuss]                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  📚 INSIGHTS (2)                                          [View Insights]    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Activity Timeline Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ACTIVITY TIMELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Today                                                                       │
│  ─────                                                                       │
│                                                                              │
│  ● 10:45  Ideation Agent                                                    │
│  │        ✓ Completed: Idea clarification for "User Auth"                   │
│  │        → 5 questions answered, target user defined                       │
│  │                                                                          │
│  ● 10:48  Spec Agent                                                        │
│  │        ▸ Started: Creating specification                                 │
│  │        → Loading context from CLAUDE.md, existing patterns               │
│  │                                                                          │
│  ● 10:52  Spec Agent                                                        │
│  │        ? Question: Architecture choice needed                            │
│  │        → Waiting for user input                                          │
│  │                                                                          │
│  ○ ──── Waiting ────                                                        │
│                                                                              │
│  Yesterday                                                                   │
│  ─────────                                                                   │
│                                                                              │
│  ● 16:30  Build Agent                                                       │
│  │        ✓ Completed: 12 tasks for "Dashboard Feature"                     │
│  │        → All tests passing, 87% coverage                                 │
│  │                                                                          │
│  ● 16:45  SIA Agent                                                         │
│           📚 Learned: New gotcha for SQLite date handling                   │
│           → Added to Knowledge Base                                         │
│                                                                              │
│  [Load More History...]                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Celebration Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                            ✨ 🎉 ✨                                          │
│                                                                              │
│                    MILESTONE ACHIEVED!                                       │
│                                                                              │
│         ┌───────────────────────────────────────────────────┐               │
│         │                                                    │               │
│         │        User Authentication Feature                 │               │
│         │                                                    │               │
│         │        ████████████████████████████  100%          │               │
│         │                                                    │               │
│         │        ✓ 12 tasks completed                        │               │
│         │        ✓ 47 tests passing                          │               │
│         │        ✓ 89% code coverage                         │               │
│         │        ✓ No security issues                        │               │
│         │        ✓ Accessibility check passed                │               │
│         │                                                    │               │
│         └───────────────────────────────────────────────────┘               │
│                                                                              │
│         Time to complete: 2h 34m                                            │
│         Your input: 4 decisions                                             │
│         System autonomy: 94%                                                │
│                                                                              │
│         "Great work! This is your most efficient build yet."                │
│                                                                              │
│         ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │
│         │  View Details  │  │  Start Next    │  │     Done       │          │
│         └────────────────┘  └────────────────┘  └────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## UI Components

### Agent Status Indicator

```typescript
interface AgentStatusIndicator {
  agent: AgentType;
  status: 'idle' | 'working' | 'waiting' | 'blocked' | 'error';
  progress?: number;  // 0-100
  currentTask?: string;
  waitingFor?: string;
  hasQuestions: boolean;
  questionCount: number;
}

// Visual states:
// ✓ Done    - Green check, filled
// ● Active  - Blue, pulsing
// ◐ Waiting - Yellow, half-filled
// ⚠ Blocked - Orange, with !
// ✗ Error   - Red X
// ◯ Queue   - Gray outline
```

### Question Card

```typescript
interface QuestionCard {
  question: Question;

  // Display
  agentIcon: string;
  agentName: string;
  timeAgo: string;

  // Interaction
  options: QuestionOption[];
  selectedOption?: string;
  customInput?: string;

  // Actions
  onAnswer: (answer: string) => void;
  onSkip?: () => void;
  onRemindLater?: () => void;
}
```

### Progress Bar

```typescript
interface ProgressBar {
  current: number;
  total: number;
  label: string;

  // Visual
  color: 'blue' | 'green' | 'yellow' | 'red';
  showPercentage: boolean;
  animated: boolean;

  // Sub-progress
  subTasks?: {
    label: string;
    status: 'pending' | 'active' | 'done' | 'error';
  }[];
}
```

### Timeline Event

```typescript
interface TimelineEvent {
  id: string;
  timestamp: Date;
  agent: AgentType;
  type: 'start' | 'complete' | 'question' | 'error' | 'learn' | 'milestone';

  // Content
  title: string;
  description?: string;
  details?: string[];

  // Interaction
  expandable: boolean;
  expanded: boolean;
  actionable: boolean;
  action?: () => void;
}
```

---

## Interaction Patterns

### Notification Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NOTIFICATION HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Level 1: MODAL INTERRUPT                                                   │
│  ────────────────────────                                                   │
│  • Security issues                                                          │
│  • System errors                                                            │
│  • Milestones/celebrations                                                  │
│                                                                              │
│  Level 2: INLINE BLOCKING                                                   │
│  ────────────────────────                                                   │
│  • Blocking questions                                                       │
│  • Validation failures                                                      │
│  • Agent stuck                                                              │
│                                                                              │
│  Level 3: BADGE + QUEUE                                                     │
│  ──────────────────────                                                     │
│  • Clarifying questions                                                     │
│  • Confirming questions                                                     │
│  • Non-urgent updates                                                       │
│                                                                              │
│  Level 4: PASSIVE DISPLAY                                                   │
│  ────────────────────────                                                   │
│  • Educational insights                                                     │
│  • Learning updates                                                         │
│  • Progress changes                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

```yaml
Global:
  "?": Show keyboard shortcuts
  "Escape": Close modal/panel
  "Space": Pause/resume current agent

Question Navigation:
  "j/k": Next/previous question
  "1-4": Select option 1-4
  "Enter": Confirm selection
  "Tab": Move to next option
  "o": Open "Other" text input

Dashboard:
  "a": Toggle agent details
  "t": Toggle timeline
  "q": Focus question panel
  "r": Refresh status

Idea Navigation:
  "n": New idea
  "s": Search ideas
  "←/→": Previous/next idea
```

### Responsive Behavior

```yaml
Desktop (> 1200px):
  layout: "Three-column: sidebar + main + panel"
  questions: "Side panel, always visible"
  timeline: "Bottom bar, expandable"

Tablet (768px - 1200px):
  layout: "Two-column: sidebar + main"
  questions: "Overlay panel, slide in"
  timeline: "Hidden, icon to expand"

Mobile (< 768px):
  layout: "Single column"
  questions: "Full screen modal"
  timeline: "Separate tab/view"
  agents: "Collapsed status bar"
```

---

## Implementation Specifications

### Database Schema

```sql
-- Question storage
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL,
    session_id TEXT,
    agent TEXT NOT NULL,
    phase TEXT NOT NULL,
    type TEXT NOT NULL,  -- blocking, clarifying, etc.

    text TEXT NOT NULL,
    context TEXT,
    options TEXT,  -- JSON array
    default_option TEXT,
    allow_free_text INTEGER DEFAULT 1,

    blocking INTEGER DEFAULT 0,
    expires_at TEXT,
    reminder_after_minutes INTEGER,

    created_at TEXT DEFAULT (datetime('now')),
    answered_at TEXT,
    answer TEXT,
    answer_source TEXT,  -- user, default, timeout, similar

    tags TEXT,  -- JSON array for pattern matching
    learn_from_answer INTEGER DEFAULT 1,

    FOREIGN KEY (idea_id) REFERENCES ideas(id)
);

-- Question patterns for learning
CREATE TABLE question_patterns (
    id TEXT PRIMARY KEY,
    question_type TEXT NOT NULL,
    trigger_pattern TEXT NOT NULL,
    answer_pattern TEXT,
    confidence REAL DEFAULT 0.5,
    usage_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Orchestration events
CREATE TABLE orchestration_events (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL,
    agent TEXT NOT NULL,
    event_type TEXT NOT NULL,  -- start, complete, question, error, milestone

    title TEXT NOT NULL,
    description TEXT,
    details TEXT,  -- JSON

    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (idea_id) REFERENCES ideas(id)
);

-- Agent status
CREATE TABLE agent_status (
    agent TEXT PRIMARY KEY,
    status TEXT NOT NULL,  -- idle, working, waiting, blocked, error
    current_task TEXT,
    progress INTEGER,
    waiting_for TEXT,
    question_count INTEGER DEFAULT 0,
    last_activity_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_questions_idea ON questions(idea_id);
CREATE INDEX idx_questions_pending ON questions(answered_at) WHERE answered_at IS NULL;
CREATE INDEX idx_questions_blocking ON questions(blocking) WHERE blocking = 1;
CREATE INDEX idx_events_idea ON orchestration_events(idea_id);
CREATE INDEX idx_events_recent ON orchestration_events(created_at DESC);
```

### API Endpoints

```typescript
// Question endpoints
router.get('/api/questions', getQuestions);
router.get('/api/questions/pending', getPendingQuestions);
router.get('/api/questions/:id', getQuestion);
router.post('/api/questions/:id/answer', answerQuestion);
router.post('/api/questions/:id/skip', skipQuestion);
router.post('/api/questions/:id/remind', remindLater);

// Orchestration endpoints
router.get('/api/orchestration/status', getOrchestratorStatus);
router.get('/api/orchestration/agents', getAgentStatuses);
router.get('/api/orchestration/timeline', getTimeline);
router.post('/api/orchestration/pause', pauseOrchestrator);
router.post('/api/orchestration/resume', resumeOrchestrator);
router.post('/api/orchestration/agents/:agent/pause', pauseAgent);

// WebSocket for real-time updates
wss.on('connection', (ws) => {
  // Subscribe to events
  ws.on('subscribe', (channels) => {
    // channels: ['questions', 'agents', 'timeline', 'milestones']
  });

  // Push updates
  eventBus.on('question.created', (q) => ws.send({ type: 'question', data: q }));
  eventBus.on('agent.status', (s) => ws.send({ type: 'agent', data: s }));
  eventBus.on('event.created', (e) => ws.send({ type: 'event', data: e }));
  eventBus.on('milestone', (m) => ws.send({ type: 'milestone', data: m }));
});
```

### Component Structure

```
src/components/
├── orchestration/
│   ├── OrchestrationPanel.tsx      # Main orchestration view
│   ├── PipelineStatus.tsx          # Agent pipeline visualization
│   ├── AgentCard.tsx               # Individual agent status
│   ├── CurrentActivity.tsx         # What's happening now
│   └── AgentProgressBar.tsx        # Progress indicator
├── questions/
│   ├── QuestionPanel.tsx           # Question list container
│   ├── QuestionCard.tsx            # Individual question
│   ├── QuestionOptions.tsx         # Option buttons
│   ├── BlockingQuestion.tsx        # Urgent question modal
│   └── CelebrationModal.tsx        # Milestone celebration
├── timeline/
│   ├── ActivityTimeline.tsx        # Timeline container
│   ├── TimelineEvent.tsx           # Individual event
│   └── TimelineFilters.tsx         # Filter by agent/type
└── shared/
    ├── Badge.tsx                   # Notification badge
    ├── ProgressBar.tsx             # Progress indicator
    └── Tooltip.tsx                 # Hover explanations
```

### Agent System Prompt Addition

Each agent's system prompt should include:

```typescript
const QUESTIONING_PROMPT = `
## Proactive Questioning

You are expected to ask questions proactively throughout your work. This keeps the user engaged and ensures alignment.

### When to Ask Questions

1. **BLOCKING** - You cannot proceed without an answer:
   - Multiple valid approaches with different trade-offs
   - Missing critical requirements
   - Security or architectural decisions

2. **CLARIFYING** - Would improve quality (but you have a safe default):
   - Preference between equivalent options
   - Scope boundaries are fuzzy
   - Performance vs simplicity trade-offs

3. **CONFIRMING** - Validate your assumption before proceeding:
   - You're about to make a significant choice
   - Your interpretation might differ from intent
   - Scope has grown/changed

4. **EDUCATIONAL** - Help user think ahead:
   - You see potential issues they might not
   - There are implications they should know
   - Best practices they could learn

5. **CELEBRATORY** - Mark progress and build excitement:
   - Milestones reached
   - Significant progress made
   - Quality metrics achieved

### Question Format

Always structure questions as:
{
  "type": "blocking|clarifying|confirming|educational|celebratory",
  "question": "Clear, specific question",
  "context": "Why you're asking (1-2 sentences)",
  "options": [
    { "label": "Option A", "description": "What this means", "recommended": true/false },
    { "label": "Option B", "description": "What this means" }
  ],
  "default": "Safe default if no answer (for non-blocking)",
  "allowFreeText": true/false
}

### Don't Ask When

- Answer is already in context (CLAUDE.md, idea files)
- Question is trivial (can safely default)
- Same question asked recently (check history)
- User explicitly said "just do it" / "use your judgment"
`;
```

---

## Summary

| Component | Purpose | Status |
|-----------|---------|--------|
| **Questioning Framework** | Cross-cutting concern for all agents | New |
| **Question Types by Agent** | Specific templates per agent | New (add to AGENT-SPECIFICATIONS-PIPELINE.md) |
| **Question Queue** | Priority management, batching | New |
| **Orchestration Panel** | Real-time agent visibility | New |
| **Question Panel** | User input interface | New |
| **Activity Timeline** | Historical view | New |
| **Celebration System** | Engagement and motivation | New |
| **WebSocket Updates** | Real-time UI sync | New |

This system ensures users stay engaged, informed, and in control throughout the entire lifecycle—from idea spark to running application.

---

*The best automation includes the human, not excludes them.*
