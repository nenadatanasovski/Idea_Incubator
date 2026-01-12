# Self-Building Bootstrap System

> **Purpose**: Define how the Vibe agent system bootstraps itself—using its own architecture to build its own components—proving the system works through self-construction.

---

## Table of Contents

1. [The Bootstrap Paradox](#the-bootstrap-paradox)
2. [Bootstrap Philosophy](#bootstrap-philosophy)
3. [Phase Model](#phase-model)
4. [What Gets Built First](#what-gets-built-first)
5. [Self-Building Architecture](#self-building-architecture)
6. [Safety Mechanisms](#safety-mechanisms)
7. [Considerations & Recommendations](#considerations--recommendations)
8. [Bootstrap Execution Plan](#bootstrap-execution-plan)
9. [Success Criteria](#success-criteria)

---

## The Bootstrap Paradox

### The Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE CIRCULAR DEPENDENCY                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    To build the system...     We need the system...              │
│                                                                  │
│    ┌──────────────┐           ┌──────────────┐                  │
│    │ Spec Agent   │◄─────────►│ Spec Agent   │                  │
│    └──────────────┘           └──────────────┘                  │
│           │                          │                           │
│           ▼                          ▼                           │
│    ┌──────────────┐           ┌──────────────┐                  │
│    │ Build Agent  │◄─────────►│ Build Agent  │                  │
│    └──────────────┘           └──────────────┘                  │
│           │                          │                           │
│           ▼                          ▼                           │
│    ┌──────────────┐           ┌──────────────┐                  │
│    │ Validation   │◄─────────►│ Validation   │                  │
│    └──────────────┘           └──────────────┘                  │
│                                                                  │
│    🐔 Chicken                  🥚 Egg                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The Solution: Incremental Self-Assembly

The system doesn't need to exist fully to build itself. It builds incrementally:

1. **Phase 0**: Human + Claude Code (no agents) builds minimal Spec Agent
2. **Phase 1**: Minimal Spec Agent helps build improved Spec Agent
3. **Phase 2**: Improved Spec Agent creates spec for Build Agent
4. **Phase 3**: Build Agent builds itself using its own spec
5. **Phase N**: Each new agent is built using all existing agents

This is analogous to:
- **Compilers**: The first C compiler was written in assembly; later C compilers were written in C
- **Operating Systems**: Bootstrap loaders are tiny programs that load the real OS
- **Life**: Simple replicators evolved into complex organisms

---

## Bootstrap Philosophy

### Core Principles

| Principle | Description | Rationale |
|-----------|-------------|-----------|
| **Minimal Viable First** | Build the smallest useful version first | Reduces risk, enables early validation |
| **Self-Improvement** | Each iteration uses existing tools to build better tools | Compounds capability gains |
| **Dogfooding** | The system must build itself | Proves the architecture works |
| **Incremental Trust** | Expand autonomy as confidence grows | Safety through gradual capability increase |
| **Rollback Safety** | Every change can be reversed | Enables aggressive iteration |

### The Trust Gradient

```
Trust Level    Autonomy                    Oversight
──────────────────────────────────────────────────────────
    1          Human writes all code       100% human review
    2          Agent suggests, human edits 100% human review
    3          Agent writes, human reviews  50% human review
    4          Agent writes, spot-checks    10% human review
    5          Agent writes, monitors        1% human review
    6          Agent writes, self-monitors   0% human review (logged)
```

**Recommendation**: Never go below Trust Level 4 for core system components. The self-building system should always have escape hatches.

---

## Phase Model

### Bootstrap Phases

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BOOTSTRAP PROGRESSION                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 0          PHASE 1           PHASE 2          PHASE 3            │
│  ───────          ───────           ───────          ───────            │
│  MANUAL           ASSISTED          SEMI-AUTO        AUTONOMOUS         │
│                                                                          │
│  ┌─────────┐     ┌─────────┐       ┌─────────┐      ┌─────────┐        │
│  │ Human   │     │ Human   │       │ Human   │      │ Human   │        │
│  │ + Claude│────▶│ + Spec  │──────▶│ Reviews │─────▶│ Monitors│        │
│  │ Code    │     │ Agent   │       │ Only    │      │ Only    │        │
│  └─────────┘     └─────────┘       └─────────┘      └─────────┘        │
│       │               │                 │                │              │
│       ▼               ▼                 ▼                ▼              │
│  Build Spec      Build Build       Build Valid      Build UX           │
│  Agent v0.1      Agent v0.1        Agent v0.1       Agent v0.1         │
│                                                                          │
│  ◄───────────── INCREASING AUTOMATION ────────────────────────▶         │
│  ◄───────────── INCREASING CONFIDENCE ────────────────────────▶         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 0: Manual (Human + Claude Code)

**Duration**: Sessions 1-5
**Builds**: Minimal Spec Agent

```yaml
What Exists:
  - CLAUDE.md with conventions
  - Spec templates (templates/unified/build/spec.md)
  - Task templates (templates/unified/build/tasks.md)
  - Database schema (migrations)
  - E2E scenarios documentation
  - Agent specifications documentation

Who Does What:
  Human:
    - Writes initial Spec Agent code
    - Defines context loading logic
    - Implements first-pass decision trees
    - Tests manually

  Claude Code:
    - Assists with code generation
    - Suggests patterns from documentation
    - Identifies gaps in specs
    - Runs validation commands

Output:
  - spec-agent/
      core.ts         # Main orchestration
      context.ts      # Context loading
      decisions.ts    # Decision logic
      templates.ts    # Template rendering

Validation:
  - Can generate a spec for a simple feature
  - Spec follows all template conventions
  - Spec references correct context files
```

### Phase 1: Assisted (Human + Spec Agent)

**Duration**: Sessions 6-12
**Builds**: Build Agent v0.1

```yaml
What Exists:
  - Everything from Phase 0
  - Minimal working Spec Agent

Who Does What:
  Spec Agent:
    - Generates spec for Build Agent
    - Identifies context requirements
    - Creates atomic tasks with templates
    - Injects gotchas from knowledge base

  Human:
    - Reviews and approves spec
    - Implements Build Agent based on spec
    - Adjusts spec as issues found
    - Feeds back gotchas to knowledge base

Dogfooding Test:
  "Can Spec Agent create a valid, actionable specification
   for the Build Agent that a human can implement efficiently?"

Output:
  - build-agent/
      core.ts         # Task execution
      context.ts      # Context loading (eager)
      executor.ts     # Command execution
      validator.ts    # Per-task validation

Validation:
  - Spec Agent produces complete Build Agent spec
  - Human can follow spec without confusion
  - Build Agent executes atomic tasks correctly
```

### Phase 2: Semi-Autonomous (Human Reviews Only)

**Duration**: Sessions 13-20
**Builds**: Validation Agent, SIA Agent

```yaml
What Exists:
  - Spec Agent v0.1
  - Build Agent v0.1
  - Growing knowledge base

Who Does What:
  Spec Agent:
    - Generates specs for Validation and SIA agents
    - Learns from feedback on previous specs

  Build Agent:
    - Implements agents from specs
    - Records execution patterns
    - Captures gotchas during implementation

  Human:
    - Reviews specs before Build Agent starts
    - Reviews completed code for quality
    - Approves knowledge base updates

Dogfooding Test:
  "Can Spec + Build agents together produce a working
   Validation Agent without human intervention during
   the build phase?"

Output:
  - validation-agent/
      core.ts
      test-generator.ts
      security-scanner.ts
      coverage-analyzer.ts
  - sia-agent/
      core.ts
      pattern-extractor.ts
      gotcha-collector.ts
      claude-md-manager.ts
```

### Phase 3: Autonomous (Human Monitors Only)

**Duration**: Sessions 21-30
**Builds**: UX Agent, PM Agent, Monitor Agent, Agent Improvements

```yaml
What Exists:
  - Complete agent pipeline (Spec → Build → Validate → SIA)
  - Mature knowledge base
  - Comprehensive test coverage

Who Does What:
  Full Pipeline:
    - Ideation Agent surfaces needed improvements
    - Spec Agent creates improvement specs
    - Build Agent implements changes
    - Validation Agent verifies correctness
    - SIA Agent updates knowledge base
    - Monitor Agent tracks system health

  Human:
    - Monitors dashboards
    - Intervenes only on alerts
    - Approves major architectural changes
    - Reviews weekly improvement summaries

Dogfooding Test:
  "Can the system identify its own weaknesses,
   propose improvements, implement them, validate them,
   and learn from the process—all autonomously?"

Output:
  - All remaining agents implemented
  - Self-improvement loop operational
  - Performance metrics trending upward
```

### Phase 4: Self-Improving (Continuous)

**Duration**: Ongoing
**Builds**: Everything, forever

```yaml
The Perpetual Loop:

  ┌──────────────────────────────────────────────────────────────┐
  │                                                               │
  │   ┌─────────┐     ┌─────────┐     ┌─────────┐               │
  │   │ Monitor │────▶│ Ideation│────▶│  Spec   │               │
  │   │  Agent  │     │  Agent  │     │  Agent  │               │
  │   └─────────┘     └─────────┘     └─────────┘               │
  │        ▲                               │                     │
  │        │                               ▼                     │
  │   ┌─────────┐     ┌─────────┐     ┌─────────┐               │
  │   │   SIA   │◀────│ Valid.  │◀────│  Build  │               │
  │   │  Agent  │     │  Agent  │     │  Agent  │               │
  │   └─────────┘     └─────────┘     └─────────┘               │
  │        │                               ▲                     │
  │        └───────────────────────────────┘                     │
  │                                                               │
  │   Improved knowledge flows back to improve future builds     │
  │                                                               │
  └──────────────────────────────────────────────────────────────┘
```

---

## What Gets Built First

### Build Order Rationale

| Order | Component | Rationale |
|-------|-----------|-----------|
| 1 | **Spec Agent** | Everything else needs specs. Can't build without knowing what to build. |
| 2 | **Build Agent** | Automates construction. High leverage for everything after. |
| 3 | **Validation Agent** | Ensures quality. Must exist before autonomous operation. |
| 4 | **SIA Agent** | Captures learning. Enables continuous improvement. |
| 5 | **UX Agent** | User experience. Important but not blocking. |
| 6 | **Monitor Agent** | System health. Needed for autonomous operation. |
| 7 | **PM Agent** | Coordination. Can be done manually until late. |

### Dependency Graph

```
                    ┌──────────────┐
                    │  Spec Agent  │ ◄── Built first (manually)
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Build Agent  │ ◄── Uses Spec Agent output
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │Validation│ │   SIA    │ │  UX      │
       │  Agent   │ │  Agent   │ │  Agent   │
       └────┬─────┘ └────┬─────┘ └────┬─────┘
            │            │            │
            └────────────┼────────────┘
                         ▼
                  ┌──────────────┐
                  │Monitor Agent │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   PM Agent   │ ◄── Built last (coordinates all)
                  └──────────────┘
```

### Why This Order?

**Spec Agent First**:
- Every other agent needs a specification
- Without it, Build Agent has nothing to build
- Can verify correctness of all other specs
- Relatively simple scope (template + context → spec)

**Build Agent Second**:
- Highest leverage multiplier
- Once working, builds everything else faster
- Clear success criteria (tasks complete or not)
- Self-validates through task execution

**Validation Agent Third**:
- Must exist before autonomous builds
- Gates quality before production
- Catches regressions as system evolves
- Required for Phase 3 autonomy

**SIA Agent Fourth**:
- Captures learning from all builds
- Enables improvement over time
- Can backfill knowledge from earlier phases
- Not blocking but compounds value

---

## Self-Building Architecture

### The Meta-Spec Pattern

Each agent has a spec that describes itself:

```
ideas/vibe/agents/
├── spec-agent/
│   ├── README.md           # What is Spec Agent
│   ├── spec.md             # Spec for Spec Agent (meta!)
│   ├── tasks.md            # Tasks to build Spec Agent
│   └── implementation/     # Actual code
├── build-agent/
│   ├── README.md
│   ├── spec.md             # Generated by Spec Agent
│   ├── tasks.md            # Generated by Spec Agent
│   └── implementation/
└── ...
```

### Self-Modification Rules

```yaml
Rule 1 - Version Branches:
  description: "Self-modifications happen in version branches"
  pattern: "agent/{name}/v{N+1}"
  rationale: "Original always preserved for rollback"

Rule 2 - Parallel Testing:
  description: "New version tested against old version"
  pattern: "Run both, compare outputs"
  rationale: "Regression detection before replacement"

Rule 3 - Gradual Rollout:
  description: "Traffic shifted incrementally"
  pattern: "10% → 50% → 100%"
  rationale: "Blast radius limitation"

Rule 4 - Canary Metrics:
  description: "Key metrics monitored during rollout"
  pattern: "Error rate, latency, success rate"
  rationale: "Automatic rollback triggers"

Rule 5 - Human Approval Gates:
  description: "Major changes require human sign-off"
  pattern: "Architectural changes, security changes, data schema"
  rationale: "Critical decisions stay with humans"
```

### The Improvement Loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SELF-IMPROVEMENT LOOP                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. OBSERVE                    2. ANALYZE                                │
│  ─────────                     ────────                                  │
│  Monitor Agent collects:       SIA Agent identifies:                     │
│  • Build success rates         • Common failure patterns                 │
│  • Task completion times       • Gotcha gaps                             │
│  • Error frequencies           • Missing knowledge                       │
│  • Coverage metrics            • Improvement opportunities               │
│                                                                          │
│         │                              │                                 │
│         ▼                              ▼                                 │
│                                                                          │
│  3. PROPOSE                    4. BUILD                                  │
│  ──────────                    ────────                                  │
│  Spec Agent creates:           Build Agent implements:                   │
│  • Improvement spec            • Code changes                            │
│  • Atomic tasks                • New tests                               │
│  • Success criteria            • Documentation                           │
│                                                                          │
│         │                              │                                 │
│         ▼                              ▼                                 │
│                                                                          │
│  5. VALIDATE                   6. DEPLOY                                 │
│  ───────────                   ────────                                  │
│  Validation Agent:             Monitor Agent:                            │
│  • Runs all tests              • Gradual rollout                         │
│  • Checks coverage             • Watches metrics                         │
│  • Verifies behavior           • Triggers rollback if needed             │
│                                                                          │
│         │                              │                                 │
│         └──────────────────────────────┘                                 │
│                        │                                                 │
│                        ▼                                                 │
│                   LOOP FOREVER                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Safety Mechanisms

### Circuit Breakers

```typescript
interface CircuitBreaker {
  name: string;
  condition: () => boolean;
  action: 'pause' | 'rollback' | 'alert_human';
  cooldown: Duration;
}

const CIRCUIT_BREAKERS: CircuitBreaker[] = [
  {
    name: 'build_failure_rate',
    condition: () => getFailureRate('build', '1h') > 0.3,
    action: 'pause',
    cooldown: '15m'
  },
  {
    name: 'test_regression',
    condition: () => getTestPassRate() < getPreviousTestPassRate() * 0.95,
    action: 'rollback',
    cooldown: '1h'
  },
  {
    name: 'core_modification',
    condition: () => isModifyingCoreAgent(),
    action: 'alert_human',
    cooldown: 'until_approved'
  },
  {
    name: 'runaway_builds',
    condition: () => getBuildCount('1h') > 50,
    action: 'pause',
    cooldown: '30m'
  },
  {
    name: 'cost_threshold',
    condition: () => getAPISpend('24h') > DAILY_BUDGET,
    action: 'pause',
    cooldown: 'until_tomorrow'
  }
];
```

### Immutable Safety Rules

```yaml
NEVER_MODIFY:
  - Authentication/authorization code
  - Database connection strings
  - API keys or secrets
  - Encryption implementations
  - Audit logging
  - Circuit breaker logic itself

ALWAYS_REQUIRE_HUMAN:
  - Schema migrations affecting production data
  - Changes to agent decision logic
  - New external API integrations
  - Changes to safety mechanisms
  - Major architectural refactors

AUTOMATIC_ROLLBACK_IF:
  - Test pass rate drops > 5%
  - Error rate increases > 100%
  - Response time increases > 50%
  - Memory usage spikes > 200%
  - Any security test fails
```

### Escape Hatches

```bash
# Emergency stop all agents
npm run agents:stop-all

# Rollback to last known good
npm run agents:rollback -- --to=<commit>

# Disable specific agent
npm run agents:disable -- --agent=build

# Force human mode
npm run agents:human-mode -- --duration=24h

# Audit last N operations
npm run agents:audit -- --last=100
```

---

## Considerations & Recommendations

### Consideration 1: When Does Self-Building Start?

**The Question**: At what point is the system "ready enough" to build itself?

**Options**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | After all documentation complete | Clear target | Delays learning |
| B | After minimal Spec Agent works | Early dogfooding | More manual work |
| C | Immediately, learn as we go | Maximum learning | High risk |

**Recommendation**: **Option B** - Start self-building after minimal Spec Agent works.

**Rationale**:
- Documentation is already comprehensive (you have E2E scenarios, agent specs, templates)
- Early dogfooding reveals gaps faster than planning
- Minimal Spec Agent is low-risk to build manually
- Every session after Phase 0 benefits from partial automation

### Consideration 2: How Much Human Oversight?

**The Question**: How quickly should human oversight decrease?

**Options**:

| Phase | Conservative | Moderate | Aggressive |
|-------|-------------|----------|------------|
| 1 | 100% review | 100% review | 100% review |
| 2 | 100% review | 80% review | 50% review |
| 3 | 80% review | 50% review | 20% review |
| 4 | 50% review | 20% review | 5% review |

**Recommendation**: **Moderate** path with phase gates.

**Rationale**:
- Conservative is too slow—defeats purpose of automation
- Aggressive is too risky—insufficient learning time
- Moderate balances speed with safety
- Phase gates ensure quality before reducing oversight

**Phase Gate Criteria**:
```yaml
Advance to Phase 2 if:
  - Spec Agent produces 5 valid specs in a row
  - Zero human interventions required during spec generation
  - All specs pass Build Agent without modification

Advance to Phase 3 if:
  - Build Agent completes 10 tasks in a row
  - Test pass rate > 95%
  - SIA Agent captures at least 20 gotchas

Advance to Phase 4 if:
  - Full pipeline runs 20 times successfully
  - No rollbacks in 1 week
  - Monitor Agent detects and recovers from 3 simulated failures
```

### Consideration 3: What If It Goes Wrong?

**The Question**: What's the blast radius of a self-building failure?

**Scenarios & Mitigations**:

| Failure Mode | Impact | Mitigation |
|-------------|--------|------------|
| Agent generates bad code | Broken feature | Validation Agent catches before deploy |
| Agent modifies itself badly | Agent broken | Version branches, parallel testing |
| Runaway builds | Resource exhaustion | Rate limiting, budget caps |
| Cascading failures | System down | Circuit breakers, automatic pause |
| Knowledge corruption | Wrong patterns learned | Human review of KB updates |

**Recommendation**: Accept Phase 1-2 failures as learning opportunities. Invest heavily in Phase 3 safeguards before reducing oversight.

### Consideration 4: How to Handle Circular Dependencies?

**The Question**: What if an agent needs a capability that doesn't exist yet?

**Example**: Build Agent needs Validation Agent to verify its output, but Validation Agent hasn't been built yet.

**Options**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Stub/mock missing agents | Unblocks progress | Fake confidence |
| B | Manual fallback for missing capability | Real feedback | Slower |
| C | Build in dependency order only | Clean but limiting | May miss learnings |

**Recommendation**: **Option B** - Manual fallback with explicit tracking.

**Implementation**:
```typescript
async function validate(task: AtomicTask): Promise<ValidationResult> {
  if (agents.validation.isAvailable()) {
    return agents.validation.validate(task);
  } else {
    // Track this for Phase 2 priority
    logMissingCapability('validation', task);

    // Manual fallback
    return manualValidation(task, {
      commands: ['npx tsc --noEmit', 'npm test'],
      humanReview: true
    });
  }
}
```

### Consideration 5: How to Measure Success?

**The Question**: How do we know the self-building system is working?

**Metrics Framework**:

```yaml
Efficiency Metrics:
  - time_to_build: "Time from spec to working code"
  - human_interventions: "Number of human corrections needed"
  - iteration_cycles: "Attempts before success"

Quality Metrics:
  - test_pass_rate: "Percentage of tests passing"
  - defect_escape_rate: "Bugs found after build vs during"
  - code_coverage: "Percentage of code tested"

Learning Metrics:
  - gotcha_discovery_rate: "New gotchas per session"
  - pattern_reuse: "Times a pattern is applied"
  - knowledge_base_growth: "KB entries over time"

Autonomy Metrics:
  - human_touch_ratio: "Human time / Total build time"
  - successful_autonomous_runs: "End-to-end without intervention"
  - rollback_frequency: "How often we need to undo"
```

**Recommendation**: Focus on **human_touch_ratio** as the north star metric. Goal: < 10% by Phase 4.

### Consideration 6: What About Meta-Stability?

**The Question**: Can the system improve its improvement process?

**The Meta Levels**:
```
Level 0: Build features
Level 1: Improve how we build features (better agents)
Level 2: Improve how we improve (better meta-processes)
Level 3: Improve how we improve how we improve (????)
```

**Recommendation**: Stop at Level 1 for now. Level 2+ requires careful thought about goal alignment.

**Rationale**:
- Level 1 (improving agents) is concrete and measurable
- Level 2 (improving the improvement process) risks goal drift
- Level 3+ is theoretical and premature

**Safeguard**: Any Level 2+ changes require explicit human design and approval.

### Consideration 7: What's the Minimal Bootstrap?

**The Question**: What's the absolute minimum to start self-building?

**Minimal Requirements**:
```yaml
Must Have:
  - CLAUDE.md with coding conventions ✅
  - Spec template with context refs ✅
  - Task template with atomic format ✅
  - At least 3 complete E2E scenarios ✅
  - Agent specifications document ✅

Nice to Have:
  - Knowledge Base with initial gotchas
  - Example specs from existing features
  - Database schema for tracking

Can Build As We Go:
  - PM Agent
  - Advanced monitoring
  - Complex self-improvement logic
```

**Recommendation**: You already have the "Must Have" items. Start Phase 0 in the next session.

---

## Bootstrap Execution Plan

### Session-by-Session Roadmap

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SESSION │ PHASE │ FOCUS                    │ DELIVERABLE                │
├─────────┼───────┼──────────────────────────┼────────────────────────────┤
│    1    │   0   │ Spec Agent core          │ spec-agent/core.ts         │
│    2    │   0   │ Spec Agent context       │ spec-agent/context.ts      │
│    3    │   0   │ Spec Agent decisions     │ spec-agent/decisions.ts    │
│    4    │   0   │ Spec Agent templates     │ spec-agent/templates.ts    │
│    5    │   0   │ Spec Agent integration   │ Working Spec Agent         │
├─────────┼───────┼──────────────────────────┼────────────────────────────┤
│    6    │   1   │ Spec for Build Agent     │ build-agent/spec.md        │
│    7    │   1   │ Build Agent core         │ build-agent/core.ts        │
│    8    │   1   │ Build Agent executor     │ build-agent/executor.ts    │
│    9    │   1   │ Build Agent validator    │ build-agent/validator.ts   │
│   10    │   1   │ Build Agent integration  │ Working Build Agent        │
│   11    │   1   │ Self-build test          │ Rebuild Spec Agent         │
│   12    │   1   │ Phase 1 retrospective    │ Learnings captured         │
├─────────┼───────┼──────────────────────────┼────────────────────────────┤
│   13    │   2   │ Spec for Validation      │ validation-agent/spec.md   │
│   14    │   2   │ Build Validation Agent   │ validation-agent/core.ts   │
│   15    │   2   │ Spec for SIA             │ sia-agent/spec.md          │
│   16    │   2   │ Build SIA Agent          │ sia-agent/core.ts          │
│   17    │   2   │ Integration testing      │ Full pipeline test         │
│   18    │   2   │ Knowledge Base seeding   │ Initial KB populated       │
│   19    │   2   │ Self-improvement test    │ Agents improve themselves  │
│   20    │   2   │ Phase 2 retrospective    │ Learnings captured         │
├─────────┼───────┼──────────────────────────┼────────────────────────────┤
│   21    │   3   │ Spec for UX Agent        │ ux-agent/spec.md           │
│   22    │   3   │ Build UX Agent           │ ux-agent/core.ts           │
│   23    │   3   │ Spec for Monitor Agent   │ monitor-agent/spec.md      │
│   24    │   3   │ Build Monitor Agent      │ monitor-agent/core.ts      │
│   25    │   3   │ Spec for PM Agent        │ pm-agent/spec.md           │
│   26    │   3   │ Build PM Agent           │ pm-agent/core.ts           │
│   27    │   3   │ Autonomous test week 1   │ Observation only           │
│   28    │   3   │ Autonomous test week 2   │ Intervention tracking      │
│   29    │   3   │ Autonomous test week 3   │ Confidence measurement     │
│   30    │   3   │ Phase 3 retrospective    │ System operational         │
└─────────────────────────────────────────────────────────────────────────┘
```

### First Session Action Plan

```yaml
Session 1 Goal: Minimal Spec Agent Core

Input:
  - templates/unified/build/spec.md
  - templates/unified/build/tasks.md
  - docs/specs/AGENT-SPECIFICATIONS.md
  - docs/specs/E2E-SCENARIOS.md

Tasks:
  1. Create spec-agent/ directory structure
  2. Implement context loading from idea folder
  3. Implement basic template rendering
  4. Add YAML frontmatter generation
  5. Test with simple feature spec

Output:
  - coding-loops/agents/spec-agent/core.ts
  - A generated spec for a simple feature

Validation:
  - Generated spec follows template format
  - All context references are valid
  - YAML frontmatter is parseable
```

---

## Success Criteria

### Phase Gate Criteria

```yaml
Phase 0 Complete:
  - [ ] Spec Agent generates valid specs
  - [ ] Specs follow template format
  - [ ] Context loading works
  - [ ] Human can implement from spec

Phase 1 Complete:
  - [ ] Build Agent executes atomic tasks
  - [ ] Tasks complete without human intervention
  - [ ] Validation commands pass
  - [ ] Spec Agent rebuilt by Build Agent

Phase 2 Complete:
  - [ ] Validation Agent catches defects
  - [ ] SIA Agent captures learnings
  - [ ] Knowledge Base has 50+ entries
  - [ ] Self-improvement demonstrated

Phase 3 Complete:
  - [ ] All agents operational
  - [ ] 7-day autonomous run successful
  - [ ] Human touch ratio < 20%
  - [ ] No critical failures
```

### Ultimate Success Test

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       THE ULTIMATE TEST                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Input: "Add user authentication to Vibe"                                │
│                                                                          │
│  Expected Output (no human intervention):                                │
│                                                                          │
│  1. Ideation Agent creates idea folder                                   │
│  2. Spec Agent generates auth specification                              │
│  3. Build Agent implements:                                              │
│     - Database migration for users table                                 │
│     - Auth routes (login, register, logout)                              │
│     - Session management                                                 │
│     - Password hashing                                                   │
│  4. Validation Agent:                                                    │
│     - Runs security tests (no SQLi, XSS)                                │
│     - Verifies password hashing                                          │
│     - Tests session expiry                                               │
│  5. UX Agent:                                                            │
│     - Tests login flow (< 30 seconds)                                    │
│     - Verifies error messages are helpful                                │
│     - Checks accessibility                                               │
│  6. SIA Agent:                                                           │
│     - Captures auth patterns                                             │
│     - Records security gotchas                                           │
│     - Updates CLAUDE.md if new convention                                │
│                                                                          │
│  Result: Working, tested, documented auth system                         │
│                                                                          │
│  Human time: 0 hours                                                     │
│  System time: ~4 hours                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Topic | Recommendation | Rationale |
|-------|---------------|-----------|
| **When to start** | After minimal Spec Agent | You have enough documentation |
| **Oversight reduction** | Moderate pace with gates | Balance speed and safety |
| **Failure handling** | Accept early failures, invest in Phase 3 safeguards | Learning is the point |
| **Circular deps** | Manual fallback with tracking | Real feedback > fake confidence |
| **Success metric** | Human touch ratio < 10% | Concrete, measurable goal |
| **Meta-improvement** | Stop at Level 1 for now | Level 2+ needs careful thought |
| **Minimal bootstrap** | Start now, you're ready | All "Must Have" items exist |

---

*The system proves it works by building itself. This document is the roadmap for that journey.*

---

## Appendix: Quick Reference

### Bootstrap Commands

```bash
# Initialize spec agent
npm run bootstrap:spec-agent

# Generate a spec using spec agent
npm run spec:generate -- --idea=<slug> --feature=<name>

# Execute tasks using build agent
npm run build:execute -- --spec=<path>

# Run validation
npm run validate -- --level=standard

# Check self-building progress
npm run bootstrap:status
```

### Key Files

| File | Purpose |
|------|---------|
| `coding-loops/agents/spec-agent/` | Spec Agent implementation |
| `coding-loops/agents/build-agent/` | Build Agent implementation |
| `ideas/vibe/agents/*/spec.md` | Meta-specs for each agent |
| `templates/unified/build/spec.md` | Spec template |
| `templates/unified/build/tasks.md` | Tasks template |
| `docs/specs/AGENT-SPECIFICATIONS.md` | Agent decision logic |
| `docs/specs/E2E-SCENARIOS.md` | Expected behaviors |

---

*Generated as part of Vibe self-building bootstrap documentation*
