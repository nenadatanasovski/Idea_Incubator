# Critical Gaps Analysis

Missing pieces required for the harness to operate autonomously and self-improve.

## Gap 1: User Task Clarification Agent

**Problem:** When a user submits a vague task like "make it faster" or "fix the bug", current agents would either:
- Guess (often wrong)
- Fail immediately
- Build the wrong thing

**Solution: Clarification Agent**

Similar to the Ideation Agent (SIA) that proactively asks clarifying questions.

**Responsibilities:**
- Intercept new user tasks before execution
- Identify ambiguous requirements
- Ask targeted clarifying questions
- Build complete task specification
- Only release task when sufficiently defined

**Flow:**
```
User: "Add authentication"
            ↓
    Clarification Agent
            ↓
    "To implement authentication, I need to know:
     1. OAuth (Google/GitHub) or username/password?
     2. Which routes need protection?
     3. Session-based or JWT tokens?
     4. Any existing auth code to integrate with?"
            ↓
    User answers
            ↓
    Clarification Agent creates detailed task
            ↓
    Task enters normal queue
```

**Implementation:**
- New agent: `clarification_agent`
- Model: Sonnet (good at questions)
- Telegram: @vibe-clarification
- Triggers: All new tasks from users
- Bypass: Tasks from other agents (already well-defined)

**Database:**
```sql
ALTER TABLE tasks ADD COLUMN clarification_status TEXT 
  CHECK(clarification_status IN ('pending', 'in_progress', 'complete', 'bypassed'));
ALTER TABLE tasks ADD COLUMN clarification_session_id TEXT;
```

## Gap 2: Human Simulation Agent (Usability Testing)

**Problem:** Agents build features but can't test them like a human would. They verify code works, but not that it's usable.

**Solution: Human Simulation Agent**

An agent that mimics human user behavior to test the built features.

**Responsibilities:**
- Navigate the UI like a human
- Test user flows end-to-end
- Report usability issues
- Generate test scenarios
- Feed findings to Task Agent for fix tasks

**Capabilities needed:**
- Browser automation (Playwright)
- Screenshot analysis
- Click/type simulation
- Form filling
- Error detection
- Flow completion verification

**Flow:**
```
Build Agent completes "Add login page"
            ↓
    Human Sim Agent spawns
            ↓
    Opens browser, navigates to /login
            ↓
    Tests:
    - Can see login form?
    - Can type email/password?
    - Submit works?
    - Error messages show?
    - Redirect after login?
            ↓
    Reports: "Login works but error message
             is white on white background"
            ↓
    Task Agent creates: "Fix login error visibility"
```

**Implementation:**
- New agent: `human_sim_agent`
- Model: Sonnet (good at testing)
- Telegram: @vibe-human-sim
- Tools: Playwright, screenshot analysis
- Triggers: After Build Agent completes UI tasks

**Test Scenarios:**
```typescript
interface UsabilityTest {
  id: string;
  feature: string;
  steps: string[];
  expectedOutcome: string;
  actualOutcome?: string;
  issues?: string[];
  screenshots?: string[];
}
```

## Gap 3: Regression Detection

**Problem:** Agents fix one thing, break another. Current QA validates the specific task but may miss regressions elsewhere.

**Solution: Regression Monitor**

Continuous monitoring of all tests, not just changed areas.

**Responsibilities:**
- Run full test suite periodically
- Track test results over time
- Detect new failures
- Correlate failures with recent changes
- Create regression fix tasks

**Implementation:**
- Part of QA Agent responsibilities
- Extended cron cycle: Full test run every hour
- Database: `test_results` table tracking history

```sql
CREATE TABLE test_results (
    id TEXT PRIMARY KEY,
    run_id TEXT,
    test_name TEXT,
    test_file TEXT,
    status TEXT,  -- passed/failed/skipped
    error_message TEXT,
    duration_ms INTEGER,
    recorded_at TEXT
);

CREATE TABLE regression_detections (
    id TEXT PRIMARY KEY,
    test_name TEXT,
    first_failed_at TEXT,
    last_passed_at TEXT,
    suspected_commit TEXT,
    task_created_id TEXT,
    status TEXT  -- detected/investigating/fixed
);
```

## Gap 4: Self-Improvement Loop

**Problem:** Agents make mistakes but don't learn from them.

**Solution: Learning Agent**

Analyzes failures and improves system prompts/procedures.

**Responsibilities:**
- Analyze failed iterations
- Identify patterns in failures
- Suggest prompt improvements
- Track improvement effectiveness
- Update agent instructions

**Flow:**
```
Build Agent fails 3 times on similar task
            ↓
    Learning Agent analyzes
            ↓
    "Build Agent keeps forgetting to run
     typecheck before committing"
            ↓
    Proposes prompt update:
    "Always run npm run typecheck BEFORE git commit"
            ↓
    Human approves change
            ↓
    System prompt updated
            ↓
    Track: Did failures decrease?
```

**Implementation:**
- New agent: `learning_agent` (or extend Evaluator)
- Triggers: When same error type occurs 3+ times
- Output: Prompt improvement proposals
- Requires: Human approval before changes

## Gap 5: Priority Escalation

**Problem:** Critical bugs sit in queue while agents work on P3 features.

**Solution: Priority Monitor**

Actively manages priority and preemption.

**Responsibilities:**
- Monitor for P0/P1 tasks
- Preempt lower-priority work
- Notify humans of critical issues
- Track SLA on critical tasks

**Rules:**
- P0: Immediately preempt any agent
- P1: Preempt P3/P4 work
- P2: Normal queue
- P3/P4: Background work

## Gap 6: Context Persistence

**Problem:** Agents lose context between sessions. Previous decisions, failed approaches, and learned preferences are forgotten.

**Solution: Agent Memory System**

Persistent memory per agent.

**Responsibilities:**
- Store important decisions
- Remember failed approaches
- Track user preferences
- Maintain project knowledge

**Implementation:**
```sql
CREATE TABLE agent_memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    memory_type TEXT,  -- decision/failure/preference/knowledge
    content TEXT,
    relevance_score REAL,
    created_at TEXT,
    last_accessed TEXT,
    access_count INTEGER
);
```

**Usage:**
- Before starting task, query relevant memories
- After completing task, store learnings
- Decay old memories (reduce relevance over time)

## Gap 7: External Integration Testing

**Problem:** Agents can't test integrations with external services (APIs, databases, third-party services).

**Solution: Integration Test Environment**

Sandbox environment with mocked external services.

**Components:**
- Mock API server
- Test database
- Fake payment processor
- Simulated email service
- etc.

**Implementation:**
- Docker containers for mocks
- Wiremock for API mocking
- Test database per run
- Environment switching

## Summary: Recommended New Agents

| Agent | Priority | Purpose |
|-------|----------|---------|
| Clarification Agent | **HIGH** | Ask users clarifying questions |
| Human Sim Agent | **HIGH** | Usability testing |
| Learning Agent | MEDIUM | Improve from failures |
| Priority Monitor | MEDIUM | Critical task escalation |

## Implementation Order

1. **Clarification Agent** (Week 1)
   - Most impactful for task quality
   - Prevents building wrong things

2. **Human Sim Agent** (Week 2)
   - Catches usability issues early
   - Generates fix tasks automatically

3. **Regression Monitor** (Week 3)
   - Extension of existing QA
   - Catches breakages

4. **Learning Agent** (Week 4+)
   - Requires failure data first
   - Incremental improvements

## Questions for Ned

1. Should Clarification Agent block task execution until user responds, or timeout and proceed with assumptions?

2. How sophisticated should Human Sim Agent be? Basic click-testing or full user journey simulation?

3. Should Learning Agent be able to auto-update prompts (with logging), or always require human approval?

4. Any other gaps you see that aren't covered here?
