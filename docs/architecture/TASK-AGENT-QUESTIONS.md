# Task Agent Design Questions

**Created:** 2026-01-12
**Purpose:** Clarify ambiguous design decisions for Task Agent
**Status:** Awaiting Your Input

---

## Instructions

For each question:

1. Review the options and pros/cons
2. See my recommendation and reasoning
3. **Write your answer** in the `YOUR ANSWER` section
4. Add any additional context or requirements

---

## Section 1: Relationships & Data Model

### Q1: Task vs Task List Hierarchy

**Question:** What is the relationship between a Task and a Task List?

| Option | Description                                                                    |
| ------ | ------------------------------------------------------------------------------ |
| A      | Task List is a container of Tasks (1:many, like a folder)                      |
| B      | Task List is an ordered execution plan (sequence of tasks with order)          |
| C      | Tasks can belong to multiple Task Lists (many:many)                            |
| D      | Hybrid: Task Lists are ordered execution plans, tasks can be in multiple lists |

| Option | Pros                                              | Cons                                                                    |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------------- |
| A      | Simple model, easy to understand, clear ownership | No execution order, can't reuse tasks across lists                      |
| B      | Clear execution sequence, supports dependencies   | Tasks locked to one list, duplication if same task needed elsewhere     |
| C      | Maximum flexibility, no duplication               | Complex queries, unclear which list "owns" the task, ordering ambiguous |
| D      | Best of both worlds, flexible and ordered         | Most complex schema, need junction table with position                  |

**My Recommendation:** **Option D (Hybrid)**

**Why:** In practice, you'll want to:

- Reuse common tasks (e.g., "Run tests", "Update docs") across multiple task lists
- Have clear execution order within each list
- Track which list a task was executed under

This requires a `task_list_items` junction table with `position` field, but provides maximum flexibility.

```
YOUR ANSWER: D

Additional context: ________________________________________
```

---

### Q2: Task List Scope

**Question:** Can a single Task List span multiple ideas/projects, or is each Task List scoped to one idea?

| Option | Description                                                         |
| ------ | ------------------------------------------------------------------- |
| A      | Strictly scoped: One Task List → One Idea/Project                   |
| B      | Flexible: Task List can span multiple ideas (cross-project)         |
| C      | Hierarchical: Task Lists belong to Projects, Projects contain Ideas |

| Option | Pros                                                            | Cons                                                                      |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A      | Simple queries, clear ownership, easy visualization             | Can't coordinate cross-project work, need separate lists for shared infra |
| B      | Supports platform-wide initiatives, shared infrastructure tasks | Complex ownership, harder to visualize, "which project is this for?"      |
| C      | Best organization, natural hierarchy                            | More tables, deeper nesting, query complexity                             |

**My Recommendation:** **Option C (Hierarchical)**

**Why:** The Vibe platform likely has:

- **Projects** (e.g., "Vibe Platform", "Mobile App")
- **Ideas** within projects (e.g., "Task Agent", "Habit Tracker")
- **Task Lists** that can be scoped to an Idea OR a Project (for cross-cutting concerns)

This allows infrastructure task lists at the Project level while feature task lists stay at the Idea level.

```
YOUR ANSWER: C

Additional context: ________________________________________
```

---

### Q3: Relationship Types

**Question:** Beyond `depends_on`, `blocks`, `related_to`, `duplicate_of`, what other relationship types should exist?

| Relationship Type | Description                             | Use Case                  |
| ----------------- | --------------------------------------- | ------------------------- |
| `subtask_of`      | Parent-child hierarchy                  | Breaking down large tasks |
| `supersedes`      | This task replaces an older one         | Version evolution         |
| `conflicts_with`  | These tasks can't run together          | Resource conflicts        |
| `enables`         | Soft dependency (nice to have first)    | Optimization order        |
| `inspired_by`     | Conceptual link                         | Knowledge graph           |
| `tests`           | This task tests another task            | Test coverage             |
| `implements`      | This task implements a spec/requirement | Traceability              |

| Option                | Pros                                | Cons                                 |
| --------------------- | ----------------------------------- | ------------------------------------ |
| Minimal (current 4)   | Simple, less confusion              | Missing important relationships      |
| Add `subtask_of` only | Enables hierarchy, most common need | Still missing versioning/conflicts   |
| Add all 7             | Maximum expressiveness              | Complexity, users must learn types   |
| Configurable          | User-defined types                  | Schema complexity, validation harder |

**My Recommendation:** **Add 3 more: `subtask_of`, `supersedes`, `implements`**

**Why:**

- `subtask_of` - Essential for breaking down epics
- `supersedes` - Important for task evolution without losing history
- `implements` - Critical for traceability from spec → task → code

The others (`conflicts_with`, `enables`, `inspired_by`, `tests`) can be added later if needed.

```
YOUR ANSWER: Add all 7

Additional context: ________________________________________
```

---

### Q4: Graph Visualization Depth

**Question:** For the relational graph, what entities should be nodes?

| Option | Nodes Included                        | Visual Complexity |
| ------ | ------------------------------------- | ----------------- |
| A      | Tasks only                            | Low               |
| B      | Tasks + Task Lists                    | Medium            |
| C      | Tasks + Task Lists + Ideas            | Medium-High       |
| D      | Tasks + Task Lists + Ideas + Projects | High              |
| E      | All above + Agents + Users            | Very High         |

| Option | Pros                                    | Cons                                  |
| ------ | --------------------------------------- | ------------------------------------- |
| A      | Clean, focused on execution             | Loses context of what tasks belong to |
| B      | Shows grouping, execution plans visible | Still missing idea context            |
| C      | Full context within a project           | Can get busy with many ideas          |
| D      | Complete picture                        | Visual overload, need good filtering  |
| E      | Shows who's doing what                  | Too much, better as separate view     |

**My Recommendation:** **Option D with filtering**

**Why:** Start with the full graph but provide:

- Filter by Project (show only one project)
- Filter by Idea (show only one idea's tasks)
- Filter by Status (show only active/blocked)
- Filter by Depth (show only direct relationships)

This gives maximum insight while managing complexity through UI controls.

```
YOUR ANSWER: D

Additional context: ________________________________________
```

---

## Section 2: Evaluation & Decision Making

### Q5: Task "Ready" Definition

**Question:** What conditions must ALL be true for the Task Agent to consider a task "ready to execute"?

| Condition                              | Always Required? | Optional? |
| -------------------------------------- | ---------------- | --------- |
| Validation passed (no blocking issues) | ✓                |           |
| All `depends_on` tasks completed       | ✓                |           |
| At least 1 test case defined           | ?                | ?         |
| User approved task for execution       | ?                | ?         |
| No `conflicts_with` task running       | ?                | ?         |
| Agent capacity available               | ?                | ?         |
| Within working hours                   | ?                | ?         |

| Strictness Level | Conditions                           | Pros                          | Cons                     |
| ---------------- | ------------------------------------ | ----------------------------- | ------------------------ |
| Minimal          | Validation + Dependencies            | Fast execution, less friction | May run unprepared tasks |
| Standard         | + Test cases required                | Quality gate, catches issues  | Slows down simple tasks  |
| Strict           | + User approval required             | Maximum control               | Bottleneck on human      |
| Autonomous       | Minimal + auto-approval for low-risk | Balance of speed and safety   | Need risk classification |

**My Recommendation:** **Autonomous with risk-based approval**

**Why:**

- **Low-risk tasks** (docs, tests, small fixes): Auto-execute after validation
- **Medium-risk tasks** (features, improvements): Notify, execute unless rejected in 5 min
- **High-risk tasks** (migrations, security, infrastructure): Require explicit approval

This keeps momentum while protecting against costly mistakes.

```
YOUR ANSWER: I like the conditions you mentioned in the table, except for the agent capability avaialble and within working hours section as im unclear how thsese will work (i could be convinced by you if you feel these are important). The test cases ALWAYS need to be required and will be broken down into 3 sections: code base level, api functional level, UI functional level.

The Task Agent will only execute low risk (high clarity tasks). There nees to be a toggle on 'user approval required' for each task list. In the beginning, I will set this to 'required' for the first few task list executions. The task manager auto-runs, what the next atsk is and passes it onto the Coding Agent. This measn you nee dto update the agent-spedifications.md, agent-architecture.md, and task-agent.md and e2-scenarios.md (break this md down in two mds because its larger than 25k tokens).

Additional context: ________________________________________
```

---

### Q6: Success Evaluation Evidence

**Question:** When asking "is this correct? ... and these tests validate a pass?", what evidence should the Task Agent present?

| Evidence Type                                         | Always Include? | On Request? |
| ----------------------------------------------------- | --------------- | ----------- |
| Test results summary (X passed, Y failed)             | ✓               |             |
| Git diff summary (files changed, lines added/removed) | ✓               |             |
| Acceptance criteria checklist                         | ✓               |             |
| Full test output logs                                 |                 | ✓           |
| Before/after screenshots (UI tasks)                   | ?               | ?           |
| Code snippets of key changes                          |                 | ✓           |
| Performance metrics (if applicable)                   |                 | ✓           |

| Detail Level                            | Pros                                | Cons                                 |
| --------------------------------------- | ----------------------------------- | ------------------------------------ |
| Minimal (results + checklist)           | Quick to review, mobile-friendly    | May miss important details           |
| Standard (+ diff summary + screenshots) | Good balance, catches visual issues | Longer messages                      |
| Comprehensive (everything)              | Nothing missed                      | Information overload, slow to review |

**My Recommendation:** **Standard with expand option**

**Why:** Telegram messages should be scannable. Include:

1. ✅/❌ Test results summary
2. 📝 Acceptance criteria checklist (checked/unchecked)
3. 📊 Diff summary (3 files changed, +150, -20)
4. 🖼️ Screenshot thumbnail (for UI tasks)

Add inline buttons: `[Show Full Diff]` `[Show Logs]` `[Show Screenshots]`

```
YOUR ANSWER: Standard with expand option.

Additional context: ________________________________________
```

---

### Q7: Failure Handling

**Question:** When a task fails validation or tests fail, should the Task Agent:

| Option | Description                                   |
| ------ | --------------------------------------------- |
| A      | Auto-retry with adjustments (AI attempts fix) |
| B      | Always escalate to human immediately          |
| C      | Try once with AI fix, then escalate           |
| D      | Configurable per task category/risk level     |

| Option | Pros                              | Cons                                  |
| ------ | --------------------------------- | ------------------------------------- |
| A      | Maximum autonomy, fast resolution | May make things worse, loops possible |
| B      | Human always in control           | Slow, bottleneck, simple fixes wait   |
| C      | Balance of autonomy and safety    | Still may make wrong fix attempt      |
| D      | Right approach for each situation | More complex rules to maintain        |

**My Recommendation:** **Option D (Configurable)**

**Why:** Different failures need different handling:

| Failure Type        | Recommended Action                      |
| ------------------- | --------------------------------------- |
| Lint/format errors  | Auto-fix, no escalation                 |
| Type errors         | Auto-fix once, then escalate            |
| Test failures       | Escalate immediately (likely logic bug) |
| Validation failures | Block and notify, don't retry           |
| Timeout             | Retry once, then escalate               |
| Unknown errors      | Escalate immediately                    |

```
YOUR ANSWER: There needs to be a clearer deliniation between the different agent types. The Coding AGent for example already covers some of the above things. Analyse the agent specs and arch files, and ask qustions about those mds. Then re-ask this question as well based on that analysis.

Additional context: ________________________________________
```

---

## Section 3: Telegram Interaction Flow

### Q8: Question Timeout

**Question:** When you don't respond to a Telegram question, what should happen?

| Timeout Duration | Action After Timeout |
| ---------------- | -------------------- |
| 5 minutes        | Use default / Skip   |
| 30 minutes       | Use default / Skip   |
| 2 hours          | Use default / Skip   |
| 24 hours         | Use default / Skip   |
| Indefinite       | Block until answered |

| Option             | Pros                             | Cons                                   |
| ------------------ | -------------------------------- | -------------------------------------- |
| Short (5-30 min)   | Keeps momentum, doesn't block    | May make wrong decision if you're busy |
| Medium (2-4 hours) | Reasonable wait, covers meetings | Slower overall progress                |
| Long (24 hours)    | Maximum time to respond          | Significant delays                     |
| Indefinite         | Never wrong decision             | Complete blockage possible             |

**My Recommendation:** **Tiered by priority**

| Question Priority             | Timeout  | Action                           |
| ----------------------------- | -------- | -------------------------------- |
| Critical (blocking execution) | 2 hours  | Escalate to secondary channel    |
| High (approval needed)        | 4 hours  | Use safe default (don't execute) |
| Medium (merge decision)       | 24 hours | Use AI recommendation            |
| Low (informational)           | 48 hours | Auto-resolve with default        |

**Why:** Critical questions shouldn't block forever, but you need reasonable time to respond. Tiered approach balances progress with control.

```
YOUR ANSWER: Critical and High priority should always be asked, for medium and low there needs to be a toggle set on a task list level. Initially the default is to turn off auto-answer.

Additional context: ________________________________________
```

---

### Q9: Question Batching

**Question:** If the Task Agent has 5 questions pending, how should it send them?

| Option | Description                                             |
| ------ | ------------------------------------------------------- |
| A      | Send all 5 at once in one message                       |
| B      | Send one, wait for answer, then next                    |
| C      | Batch related questions together                        |
| D      | Prioritize and send most important first, others queued |
| E      | Daily digest with all pending questions                 |

| Option | Pros                                 | Cons                                       |
| ------ | ------------------------------------ | ------------------------------------------ |
| A      | One notification, see everything     | Overwhelming, hard to track which answered |
| B      | Clear flow, one at a time            | Slow, many notifications, blocks on first  |
| C      | Logical grouping, context preserved  | Complexity in determining "related"        |
| D      | Important things first, natural flow | May never get to low-priority questions    |
| E      | Predictable, non-intrusive           | Delays urgent decisions                    |

**My Recommendation:** **Option D with batching for same-task questions**

**Why:**

1. Send questions in priority order
2. If multiple questions about the SAME task, batch them together
3. Don't send more than 3 questions before waiting for at least 1 answer
4. Provide "Show all pending (5)" button to see queue

This prevents notification spam while ensuring important decisions happen first.

```
YOUR ANSWER: Why can't every question be a new session in telegram? that way every answer is clearly linked to 1 question only.

Additional context: ________________________________________
```

---

### Q10: Deferred Decisions

**Question:** Should users be able to respond with "later" or "defer"?

| Option | Description                                      |
| ------ | ------------------------------------------------ |
| A      | No defer option - must answer or timeout         |
| B      | Defer for fixed time (1 hour, 4 hours, tomorrow) |
| C      | Defer indefinitely until user triggers review    |
| D      | Defer with snooze options + max defer count      |

| Option | Pros                                      | Cons                        |
| ------ | ----------------------------------------- | --------------------------- |
| A      | Forces decisions, keeps momentum          | Annoying if genuinely busy  |
| B      | Flexibility with limit                    | May keep deferring          |
| C      | Maximum flexibility                       | Questions forgotten forever |
| D      | Balance of flexibility and accountability | More complex UX             |

**My Recommendation:** **Option D (Defer with limits)**

**Why:**

- Allow defer with options: `[1 hour]` `[4 hours]` `[Tomorrow]` `[Next week]`
- Maximum 3 defers per question
- After 3 defers, force decision or use AI recommendation
- Show "deferred questions" count in daily summary

```
YOUR ANSWER: The Task Agent should already have prioritised the roder in which the questions are asked, so the user can safely assume they are important. There should be an option 'reprioritise' with a free text to specify how/why/when in addition to option B. Rememeber that if tasks don't meet 'readiness' criteria such as clearing dependency tasks first, they an't get executed anyway.

Additional context: ________________________________________
```

---

## Section 4: Proactive Behavior

### Q11: Proactive Triggers

**Question:** What should trigger the Task Agent to proactively message you?

| Trigger                                   | Send Immediately? | Batch in Summary? | Don't Send? |
| ----------------------------------------- | ----------------- | ----------------- | ----------- |
| Task ready for execution (needs approval) | ?                 | ?                 | ?           |
| Potential duplicate detected              | ?                 | ?                 | ?           |
| Task became stale (X days no activity)    | ?                 | ?                 | ?           |
| Dependency resolved (blocked → ready)     | ?                 | ?                 | ?           |
| All tests passed (ready to mark complete) | ?                 | ?                 | ?           |
| Task failed                               | ?                 | ?                 | ?           |
| Daily summary                             | N/A               | ✓                 | ?           |
| Weekly report                             | N/A               | ✓                 | ?           |
| Milestone reached (10 tasks done)         | ?                 | ?                 | ?           |

**My Recommendation:**

| Trigger              | Action        | Why                           |
| -------------------- | ------------- | ----------------------------- |
| Task needs approval  | Immediate     | Blocking progress             |
| Duplicate detected   | Immediate     | Prevents wasted work          |
| Task stale (7+ days) | Daily summary | Not urgent                    |
| Dependency resolved  | Immediate     | Unblocks work                 |
| Tests passed         | Immediate     | Needs completion confirmation |
| Task failed          | Immediate     | Needs attention               |
| Daily summary        | 9 AM          | Predictable review time       |
| Weekly report        | Monday 9 AM   | Planning cadence              |
| Milestone            | Immediate     | Motivation/awareness          |

```
YOUR ANSWER: The most important proactive behaviour is to suggest to the user what the task agent should do next based on the current state of the task list and priorities. once the user confirms, te task agent will execute the action. this is a continuous loop.

I agree on the recommendations table but just make sure to incorporate the questioning/suggesting part as thats the key driver.

Stale threshold (days): ____________________________________

Daily summary time: ________________________________________

Additional triggers: _______________________________________
```

---

### Q12: Autonomous vs Approval Actions

**Question:** Which actions can the Task Agent take autonomously?

| Action                          | Fully Autonomous | Notify + Auto-proceed | Requires Approval |
| ------------------------------- | ---------------- | --------------------- | ----------------- |
| Create task from spec           | ?                | ?                     | ?                 |
| Mark task complete (tests pass) | ?                | ?                     | ?                 |
| Merge duplicate tasks           | ?                | ?                     | ?                 |
| Start task list execution       | ?                | ?                     | ?                 |
| Skip blocked task               | ?                | ?                     | ?                 |
| Auto-assign to agent            | ?                | ?                     | ?                 |
| Create subtasks                 | ?                | ?                     | ?                 |
| Update task priority            | ?                | ?                     | ?                 |
| Archive stale tasks             | ?                | ?                     | ?                 |

**My Recommendation:**

| Action                    | Level                    | Why                                   |
| ------------------------- | ------------------------ | ------------------------------------- |
| Create task from spec     | Notify + Auto            | Tasks need review but shouldn't block |
| Mark task complete        | Requires Approval        | Human should verify completion        |
| Merge duplicates          | Requires Approval        | Destructive, needs confirmation       |
| Start task list execution | Requires Approval        | Resource commitment                   |
| Skip blocked task         | Notify + Auto            | Keep momentum, can undo               |
| Auto-assign to agent      | Fully Autonomous         | Optimization, low risk                |
| Create subtasks           | Notify + Auto            | Helpful, non-destructive              |
| Update priority           | Requires Approval        | Changes execution order               |
| Archive stale tasks       | Notify + Auto (30+ days) | Cleanup, recoverable                  |

```
YOUR ANSWER: We need to talk about task naming conventions. Task can have task mds, sub-task mds and other files associated to them. The Task AGent needs to be able to grasp the context of the task and its associated files by using the naming convention to understand the relationship between tasks and their associated files. Also, marking tasks as complete should be based on passing the tests that are defined in the task id md.

Additional context: ________________________________________
```

---

## Section 5: Testing & Validation

### Q13: Human-in-Loop Test Coverage

**Question:** Which flows should be tested with you in the loop for the litmus test?

| Test Flow                                                         | Include? | Priority |
| ----------------------------------------------------------------- | -------- | -------- |
| 1. Task creation → validation → approval → execution → completion | ?        | ?        |
| 2. Duplicate detection → merge decision                           | ?        | ?        |
| 3. Task list approval → execution → results review                | ?        | ?        |
| 4. Dependency chain resolution                                    | ?        | ?        |
| 5. Failure → retry → escalation                                   | ?        | ?        |
| 6. Stale task notification → action                               | ?        | ?        |
| 7. Cross-project dependency                                       | ?        | ?        |
| 8. Task decomposition suggestion                                  | ?        | ?        |
| 9. Telegram command flow (all commands)                           | ?        | ?        |
| 10. Daily summary review                                          | ?        | ?        |

**My Recommendation:** Test flows 1-6 as **P1 (Must Have)**, 7-10 as **P2 (Should Have)**

**Why:** Flows 1-6 cover the core Task Agent loop:

- Creating and validating tasks
- Detecting issues (duplicates, staleness)
- Executing and completing work
- Handling failures

Flows 7-10 are valuable but can be tested after core is solid.

```
YOUR ANSWER: All 10.

Additional test flows: _____________________________________
```

---

### Q14: Test Confidence Threshold

**Question:** When should the Task Agent consider tests "passing"?

| Threshold | Description                          |
| --------- | ------------------------------------ |
| A         | 100% tests pass (strict)             |
| B         | All critical tests pass, warnings OK |
| C         | 90%+ pass rate                       |
| D         | Configurable per task/category       |

| Option | Pros                                  | Cons                                      |
| ------ | ------------------------------------- | ----------------------------------------- |
| A      | No ambiguity, quality guarantee       | Flaky tests block everything              |
| B      | Pragmatic, focuses on important tests | Need to classify critical vs non-critical |
| C      | Allows some failures                  | Which 10% failed matters                  |
| D      | Flexible for different contexts       | Complexity, inconsistency                 |

**My Recommendation:** **Option B (Critical tests must pass)**

**Why:**

- Mark tests as `critical` or `non-critical` when creating them
- All `critical` tests must pass
- `non-critical` failures are warnings, shown but don't block
- Prevents flaky UI tests from blocking backend work

```
YOUR ANSWER: A - with the important option to create a new task focussed on the remaining test taht needs to pass.

Additional context: ________________________________________
```

---

### Q15: Evaluation Criteria Weighting

**Question:** How should tasks be prioritized for execution?

| Factor                                | Weight (1-10)? |
| ------------------------------------- | -------------- |
| Priority level (P1-P4)                | ?              |
| Age (days since created)              | ?              |
| Dependencies (is it blocking others?) | ?              |
| Effort estimate (quick wins)          | ?              |
| Category (bugs > features?)           | ?              |
| User-specified urgency                | ?              |
| Deadline proximity                    | ?              |

**My Recommendation:**

| Factor                                 | Weight     | Reasoning               |
| -------------------------------------- | ---------- | ----------------------- |
| Priority (P1=40, P2=30, P3=20, P4=10)  | Base score | User-defined importance |
| Blocking others (+20 per blocked task) | High       | Multiplier effect       |
| Age (+1 per day, max +15)              | Medium     | Prevent staleness       |
| Quick win (<1 hour, +10)               | Medium     | Momentum                |
| Has deadline (+30 if within 3 days)    | High       | Time sensitivity        |
| Category (bug +10, security +15)       | Medium     | Risk mitigation         |

**Formula:**

```
Score = Priority + (BlockedTasks × 20) + min(Age, 15) + QuickWinBonus + DeadlineBonus + CategoryBonus
```

```
YOUR ANSWER: Priority based on use priority creates too much mental burden for the user. This is a tough one, I like blocking others, Quick win, and deadline. I'd use those + Task Agent advice based on their understanding on best practice.

Custom weighting: __________________________________________
```

---

## Section 6: Additional Considerations

### Q16 (Bonus): Agent Persona

**Question:** Should the Task Agent have a distinct personality/name?

| Option | Example                 |
| ------ | ----------------------- | -------------------------------------------------- |
| A      | Functional (no persona) | "Task TAK-001 is ready for execution"              |
| B      | Named bot               | "TaskMaster: TAK-001 is ready!"                    |
| C      | Friendly assistant      | "Hey! 👋 Your task is ready to go"                 |
| D      | Professional assistant  | "Good morning. Task TAK-001 awaits your approval." |

| Option | Pros                         | Cons                     |
| ------ | ---------------------------- | ------------------------ |
| A      | Clear, no confusion          | Robotic, less engaging   |
| B      | Memorable, distinct identity | Need to maintain persona |
| C      | Approachable, fun            | May feel unprofessional  |
| D      | Professional, clear          | Somewhat formal          |

**My Recommendation:** **Option D (Professional assistant)**

**Why:** For a productivity tool, professional but warm feels right. Not robotic, not overly casual.

```
YOUR ANSWER: Approachable, fun with occassional witty remarks based on context. But above all else, helpful, insightful and pro-active. The bot name should be plain and simple: Task Agent.

Preferred name (if any): ___________________________________
```

---

---

# Questions 17-31: Deep Dive Based on Your Answers

Based on your responses to Q1-Q16, I've identified critical gaps that need clarification. These questions focus on:

- **Agent boundaries** (Task Agent vs Build Agent vs Coding Agent)
- **Task naming and file structure**
- **The continuous suggestion loop**
- **Test framework details**
- **Source of truth and state management**

---

## Section 7: Agent Delineation & Handoffs

### Q17: Task Agent vs Build Agent vs Coding Agent

**Context:** You mentioned the Task Agent "passes tasks to the Coding Agent." The existing system has a **Build Agent** that executes code tasks. I need to understand the relationship.

| Agent        | Current Role (from specs)                   | Your Intent |
| ------------ | ------------------------------------------- | ----------- |
| Build Agent  | Executes atomic tasks from spec.md/tasks.md | ?           |
| Task Agent   | NEW - manages task lifecycle                | ?           |
| Coding Agent | ? (not in current specs)                    | ?           |

**Question:** What is the relationship between these three?

| Option | Description                                                          |
| ------ | -------------------------------------------------------------------- |
| A      | **Coding Agent = Build Agent** (same thing, different name)          |
| B      | **Coding Agent is NEW**, replaces Build Agent                        |
| C      | **Coding Agent is NEW**, Build Agent still exists for different work |
| D      | **Task Agent orchestrates**, Coding Agent/Build Agent executes       |

| Option | Pros                                    | Cons                           |
| ------ | --------------------------------------- | ------------------------------ |
| A      | No new agent needed, just clarification | May confuse documentation      |
| B      | Clean slate, optimized for new flow     | Lose existing Build Agent work |
| C      | Specialized agents for different work   | More agents to manage          |
| D      | Clear separation of concerns            | Handoff complexity             |

**My Recommendation:** **Option D (Task Agent orchestrates, Build Agent executes)**

**Why:** Based on your answers:

- Task Agent decides WHAT to do next (proactive suggestion loop)
- Task Agent validates readiness (tests, dependencies)
- Build Agent (or Coding Agent) actually writes the code

This aligns with the existing spec where Build Agent subscribes to `spec.approved` events.

```
YOUR ANSWER: Maybe the coding agent is called the build agent. its in the mds i referenced earlier. It think its option D.

If Coding Agent is different from Build Agent, describe the difference:
_______________________________________________
```

---

### Q18: Task Agent Responsibilities Boundary

**Context:** You said Task Agent "only executes low risk tasks." I need to clarify what "execute" means vs what Build Agent does.

**Question:** What does Task Agent actually DO vs delegate?

| Action                      | Task Agent Does | Task Agent Delegates |
| --------------------------- | --------------- | -------------------- |
| Decide next task to work on | ?               | ?                    |
| Validate task readiness     | ?               | ?                    |
| Generate/update task MDs    | ?               | ?                    |
| Write actual code           | ?               | ?                    |
| Run tests                   | ?               | ?                    |
| Mark task complete          | ?               | ?                    |
| Merge duplicates            | ?               | ?                    |
| Create subtasks             | ?               | ?                    |

**My Recommendation:**

| Action                   | Owner                                          | Why                      |
| ------------------------ | ---------------------------------------------- | ------------------------ |
| Decide next task         | Task Agent                                     | Core orchestration role  |
| Validate readiness       | Task Agent                                     | Quality gate             |
| Generate/update task MDs | Task Agent                                     | Task lifecycle ownership |
| Write actual code        | Build Agent                                    | Specialized skill        |
| Run tests                | Task Agent (triggers) → Test Runner (executes) | Separation of concerns   |
| Mark task complete       | Task Agent (after validation)                  | Lifecycle ownership      |
| Merge duplicates         | Task Agent                                     | Task management          |
| Create subtasks          | Task Agent                                     | Task breakdown           |

```
YOUR ANSWER: I partially agree with your recommendations. The build agent runs the tests which is why the build agent loops when it needs to iterate and refine. The task agent starts the task list set or sets if there are multiple that can kick off at the same time. What i mean is allow the build agents to execute low risk task lists. the task agent gives the build agent the task list to execute and the build agent works through the task list, task per task automatically without needing the task agent to tell the build agent to go to the next task.

I repeat, the task agent also needs to identify parallel tasklist runs as needed so muliptle build agents can be spawned.

Additional responsibilities: _______________________________________________
```

---

### Q19: Handoff Protocol Between Agents

**Context:** From AGENT-SPECIFICATIONS.md, agents communicate via events:

- `spec.approved` → Build Agent
- `build.completed` → SIA

**Question:** What events should trigger Task Agent, and what events should Task Agent emit?

| Event                      | Who Emits           | Who Receives        |
| -------------------------- | ------------------- | ------------------- |
| `task.ready_for_execution` | Task Agent          | Build Agent         |
| `task.completed`           | Build Agent         | Task Agent          |
| `task.failed`              | Build Agent         | Task Agent          |
| `tasklist.approved`        | User (via Telegram) | Task Agent          |
| `task.suggestion`          | Task Agent          | User (via Telegram) |

**Question:** Does this event flow make sense?

| Option | Description                                                  |
| ------ | ------------------------------------------------------------ |
| A      | Yes, this event flow is correct                              |
| B      | Task Agent should directly call Build Agent (not via events) |
| C      | Need different events (specify below)                        |
| D      | Task Agent and Build Agent should be merged                  |

| Option | Pros                                                     | Cons                            |
| ------ | -------------------------------------------------------- | ------------------------------- |
| A      | Loose coupling, auditable, aligns with existing patterns | Latency in handoffs             |
| B      | Faster, simpler                                          | Tight coupling, harder to debug |
| C      | Custom fit                                               | More events to maintain         |
| D      | Simpler system                                           | Loses specialization            |

**My Recommendation:** **Option A (Event-based)**

**Why:** Aligns with existing MessageBus pattern, allows SIA to observe all events for learning.

```
YOUR ANSWER: The Task agent is always on. So long as the Vibe platform is running on a server, the task agent is always running. The task failed event should go to the Build Agent (it actually is part of the build agent transcipt so the build agent can iterate and refine). So option A + the above mentioned text.

Custom events needed: _______________________________________________
```

---

## Section 8: Task Naming & File Structure

### Q20: Task Naming Convention

**Context:** You emphasized task naming conventions are important for understanding relationships.

**Question:** What naming convention should tasks follow?

| Convention        | Example                              | Use Case               |
| ----------------- | ------------------------------------ | ---------------------- |
| Sequential IDs    | `TAK-001`, `TAK-002`                 | Simple, auto-increment |
| Hierarchical      | `TAK-001`, `TAK-001-A`, `TAK-001-B`  | Parent-subtask         |
| Prefix by type    | `FEA-001` (feature), `BUG-002` (bug) | Category visible in ID |
| Prefix by project | `VIBE-TAK-001`, `HABIT-TAK-001`      | Cross-project clarity  |
| Compound          | `VIBE-FEA-001-A`                     | Maximum information    |

| Option            | Pros                      | Cons                         |
| ----------------- | ------------------------- | ---------------------------- |
| Sequential        | Simple, no parsing needed | No context in ID             |
| Hierarchical      | Shows relationships       | IDs get long                 |
| Prefix by type    | Category at a glance      | Need to maintain prefix list |
| Prefix by project | Cross-project clarity     | Verbose                      |
| Compound          | Maximum info              | Complex, long IDs            |

**My Recommendation:** **Hierarchical with type prefix**

Format: `{TYPE}-{NUMBER}[-{SUBTASK}]`

Examples:

- `FEA-001` - Feature task
- `FEA-001-A` - First subtask of FEA-001
- `BUG-042` - Bug fix
- `INF-003-B` - Second subtask of infrastructure task

```
YOUR ANSWER: {User id}-{Project/Idea Id}-{TYPE}-{NUMBER}[-{SUBTASK}-{Version number (001) (incase there are multiple versions later on)}]

Preferred format: _______________________________________________
```

---

### Q21: Task File Structure

**Context:** You said tasks have MDs, sub-task MDs, and associated files. I need to understand the directory structure.

**Question:** Where should task files live?

| Option | Structure              |
| ------ | ---------------------- | -------------------------------------------------------- |
| A      | Flat in `tasks/`       | `tasks/TAK-001.md`, `tasks/TAK-002.md`                   |
| B      | By project/idea        | `ideas/{slug}/tasks/TAK-001.md`                          |
| C      | By task list           | `task-lists/{list-id}/TAK-001.md`                        |
| D      | Hierarchical by parent | `tasks/TAK-001/TAK-001.md`, `tasks/TAK-001/TAK-001-A.md` |
| E      | By category            | `tasks/features/FEA-001.md`, `tasks/bugs/BUG-001.md`     |

| Option | Pros                   | Cons                        |
| ------ | ---------------------- | --------------------------- |
| A      | Simple, easy to find   | No context, cluttered       |
| B      | Tasks with their ideas | Cross-project tasks awkward |
| C      | Task list grouping     | Task lists can change       |
| D      | Clear hierarchy        | Deep nesting                |
| E      | Category organization  | Tasks may change category   |

**My Recommendation:** **Option B (By idea) with cross-reference support**

```
users/{user}/ideas/{idea}/
├── tasks/
│   ├── FEA-001.md
│   ├── FEA-001-A.md
│   ├── FEA-001-B.md
│   └── BUG-001.md
├── task-lists/
│   ├── sprint-1.md        # References task IDs
│   └── backlog.md
```

Cross-project tasks live in `users/{user}/tasks/` (not under an idea).

```
YOUR ANSWER: Tasks should live on a db and have their own data model as such. Reuseable tasks should be treated as task template rather than tasks and can be stored outisde of user and project/idea groupings.

This change means we need to also update the front end and migrate the Md files into a database. Propose the data model in a separate md.

Preferred structure: _______________________________________________
```

---

### Q22: Task MD Content Structure

**Context:** Tasks need test cases, dependencies, and acceptance criteria. What should a task MD contain?

**Question:** What sections should every task MD have?

| Section               | Required? | Description                          |
| --------------------- | --------- | ------------------------------------ |
| YAML frontmatter      | ?         | id, status, category, priority       |
| Description           | ?         | What needs to be done                |
| Acceptance Criteria   | ?         | How to know it's done                |
| Test Cases (Codebase) | ?         | Unit tests, type checks              |
| Test Cases (API)      | ?         | HTTP endpoint tests                  |
| Test Cases (UI)       | ?         | Puppeteer/browser tests              |
| Dependencies          | ?         | Other tasks that must complete first |
| Affected Files        | ?         | Files this task will create/modify   |
| Notes                 | ?         | Free-form context                    |
| Execution Log         | ?         | History of attempts                  |

**My Recommendation:** All sections, but some auto-populated.

```yaml
---
id: FEA-001
title: Add user authentication
status: pending
category: feature
priority: 50
parent_id: null
depends_on: []
blocks: []
created_at: 2026-01-12
updated_at: 2026-01-12
---

## Description
[What needs to be done - REQUIRED]

## Acceptance Criteria
- [ ] Criterion 1 - REQUIRED (at least 1)
- [ ] Criterion 2

## Test Cases

### Codebase Level (REQUIRED for all)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes

### API Level (REQUIRED if affects backend)
- [ ] POST /api/auth/login returns 200 with valid credentials
- [ ] POST /api/auth/login returns 401 with invalid credentials

### UI Level (REQUIRED if affects frontend)
- [ ] Login form submits successfully
- [ ] Error message displays on failure

## Affected Files
- `server/routes/auth.ts` (CREATE)
- `types/auth.ts` (CREATE)

## Execution Log
| Attempt | Agent | Status | Notes |
|---------|-------|--------|-------|
| 1 | build-agent | failed | Type error on line 42 |
| 2 | build-agent | passed | Fixed type error |
```

```
YOUR ANSWER: I like the fields and examples, but these will be ina database and not in md files.

Additional sections: _______________________________________________
```

---

## Section 9: The Continuous Suggestion Loop

### Q23: Suggestion Loop Mechanics

**Context:** You said "the most important proactive behaviour is to suggest to the user what the task agent should do next."

**Question:** How should this loop work?

```
┌─────────────────────────────────────────────────────────────┐
│                  SUGGESTION LOOP                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Task Agent analyzes current state                        │
│       │                                                      │
│       ▼                                                      │
│  2. Task Agent formulates suggestion                         │
│       │                                                      │
│       ▼                                                      │
│  3. Task Agent sends suggestion via Telegram                 │
│       │                                                      │
│       ▼                                                      │
│  4. User responds (approve/modify/reject)                    │
│       │                                                      │
│       ▼                                                      │
│  5. Task Agent executes (or adjusts and re-suggests)         │
│       │                                                      │
│       ▼                                                      │
│  6. Task Agent reports result                                │
│       │                                                      │
│       ▼                                                      │
│  7. Back to step 1                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Question:** What triggers the loop to continue?

| Option | Description                                                       |
| ------ | ----------------------------------------------------------------- |
| A      | **Continuous**: Loop runs immediately after each action completes |
| B      | **Batched**: Loop runs every X minutes with batch of suggestions  |
| C      | **On-demand**: Loop runs when user asks "what's next?"            |
| D      | **Event-driven**: Loop runs when significant events occur         |
| E      | **Hybrid**: Continuous during active sessions, batched otherwise  |

| Option | Pros                    | Cons                            |
| ------ | ----------------------- | ------------------------------- |
| A      | Maximum velocity        | Can overwhelm user              |
| B      | Predictable, manageable | Delays in progress              |
| C      | User controls pace      | User must remember to ask       |
| D      | Smart triggering        | Complex logic                   |
| E      | Best of both worlds     | Need to define "active session" |

**My Recommendation:** **Option E (Hybrid)**

- During active session (user responded within 30 min): Continuous
- Otherwise: Daily summary with top 3 suggestions
- Always: Immediate notification for blockers/failures

```
YOUR ANSWER: Yes. But what current state is means analysing potential parralel runs for build agents + merge potential + any other task sthe task agent has that needs approval. The TAsk Agent is free to send the user mesasages and keep conversations with the user via different channels to help it manage, build and maintain the project.

Active session timeout: _______________________________________________

Batch frequency when inactive: _______________________________________________
```

---

### Q24: Suggestion Content

**Question:** What should a suggestion message contain?

| Component             | Always Include? | Example                                 |
| --------------------- | --------------- | --------------------------------------- |
| Recommended action    | ?               | "Execute task FEA-001"                  |
| Why this action       | ?               | "It's the highest priority ready task"  |
| Task summary          | ?               | "Add user authentication"               |
| Risk assessment       | ?               | "Low risk - only creates new files"     |
| Alternative actions   | ?               | "Or: BUG-002, FEA-003"                  |
| Current state summary | ?               | "5 pending, 2 in progress, 12 complete" |
| Quick action buttons  | ?               | [Approve] [Skip] [Details]              |

**My Recommendation:**

```
📋 SUGGESTED NEXT ACTION

I recommend: Execute **FEA-001**
"Add user authentication"

📊 Why: Highest priority (P1) + no blockers + all tests defined
⚠️ Risk: Low (creates new files only)

📈 Current state: 5 pending | 2 in progress | 12 complete

[✅ Approve] [⏭️ Skip] [🔄 Alternatives] [📄 Details]
```

```
YOUR ANSWER: Never individual tasks, always task lists. The focus for the TAsk Agent is to help the user finalise task lists and pro-actively refine them and then hand over to the build agent once ready. The task agent ensures that the build agent has all the info it needs to build the task list out, think spec driven and test driven development framework thinking, questioning and suggestions in terms of task lists.

Additional components: _______________________________________________
```

---

### Q25: One Question = One Telegram Session

**Context:** You asked "Why can't every question be a new session in telegram?"

**Question:** By "session" do you mean:

| Option | Description                                                                        |
| ------ | ---------------------------------------------------------------------------------- |
| A      | **Separate message thread** - Each question is a reply to a different message      |
| B      | **Separate chat** - Each question goes to a different Telegram chat/group          |
| C      | **Inline reply tracking** - Use Telegram's reply-to feature to link Q&A            |
| D      | **Unique callback data** - Buttons have unique IDs that link to specific questions |

| Option | Pros                    | Cons                               |
| ------ | ----------------------- | ---------------------------------- |
| A      | Clear separation        | Hard to implement in Telegram's UI |
| B      | Maximum isolation       | User manages multiple chats        |
| C      | Native Telegram feature | Works well for threading           |
| D      | Already implemented     | Relies on button interactions      |

**My Recommendation:** **Option C + D combined**

Every question:

1. Sent as a new message (not editing previous)
2. Has unique ID in callback data
3. User replies via button OR by replying to the specific message
4. Answer linked to question via message ID or callback data

```
YOUR ANSWER: C + D - but remember each telegram session is linked to exactly one task list. So if mulitple task lists are running in parallel, we need to make sure that the user can switch between different chats to answer questions deriving from different task lists.

Clarification: _______________________________________________
```

---

## Section 10: Test Framework Deep Dive

### Q26: Three-Level Test Structure

**Context:** You said tests are "broken down into 3 sections: codebase level, API functional level, UI functional level."

**Question:** What does each level test?

| Level    | What It Tests | Tools | When Required |
| -------- | ------------- | ----- | ------------- |
| Codebase | ?             | ?     | ?             |
| API      | ?             | ?     | ?             |
| UI       | ?             | ?     | ?             |

**My Recommendation:**

| Level    | What It Tests                             | Tools                       | When Required              |
| -------- | ----------------------------------------- | --------------------------- | -------------------------- |
| Codebase | Syntax, types, lint, unit tests           | `tsc`, `eslint`, `vitest`   | ALL tasks                  |
| API      | HTTP endpoints, responses, errors         | `supertest`, `curl`, custom | Tasks touching `server/`   |
| UI       | User flows, visual elements, interactions | Puppeteer (MCP), Playwright | Tasks touching `frontend/` |

```
YOUR ANSWER: Yes, you are right about all of the above. We use Pupeteer mcp.

Codebase tests include: _______________________________________________

API tests include: _______________________________________________

UI tests include: _______________________________________________
```

---

### Q27: Test Definition vs Test Execution

**Question:** Who defines tests vs who runs them?

| Actor              | Defines Tests | Runs Tests | Evaluates Results |
| ------------------ | ------------- | ---------- | ----------------- |
| User               | ?             | ?          | ?                 |
| Task Agent         | ?             | ?          | ?                 |
| Build Agent        | ?             | ?          | ?                 |
| Test Runner (new?) | ?             | ?          | ?                 |

**My Recommendation:**

| Actor                   | Defines Tests                           | Runs Tests          | Evaluates Results    |
| ----------------------- | --------------------------------------- | ------------------- | -------------------- |
| User                    | Can add custom tests                    | No                  | Reviews failures     |
| Task Agent              | Auto-generates from acceptance criteria | Triggers execution  | Determines pass/fail |
| Build Agent             | No                                      | No (code only)      | No                   |
| Test Executor (service) | No                                      | Executes all levels | Returns raw results  |

```
YOUR ANSWER: Agreed. Except: the build agent determines pass/fail per task, not the task agent. While the task agent determines task list completion/fail and takes next best action off of that info.

Who owns test generation: _______________________________________________

Who owns test execution: _______________________________________________
```

---

### Q28: Test Pass = Task Complete?

**Context:** You said "marking tasks as complete should be based on passing the tests."

**Question:** What exactly must pass for a task to be marked complete?

| Condition                          | Must Pass? |
| ---------------------------------- | ---------- |
| All codebase tests pass            | ?          |
| All API tests pass (if applicable) | ?          |
| All UI tests pass (if applicable)  | ?          |
| Manual user approval               | ?          |
| Acceptance criteria checked off    | ?          |
| No new lint warnings               | ?          |
| Test coverage threshold met        | ?          |

**My Recommendation:**

| Condition                  | Must Pass                     | Can Override  |
| -------------------------- | ----------------------------- | ------------- |
| All codebase tests         | Yes                           | No            |
| All API tests (if defined) | Yes                           | No            |
| All UI tests (if defined)  | Yes                           | No            |
| User approval              | Configurable per task list    | Yes           |
| Acceptance criteria        | Auto-checked via tests        | If tests pass |
| Lint warnings              | No (warnings OK)              | N/A           |
| Coverage threshold         | No (tracked but not blocking) | N/A           |

```
YOUR ANSWER: Agreed.

Override conditions: _______________________________________________
```

---

## Section 11: Source of Truth & State

### Q29: Source of Truth

**Context:** Tasks exist in both MD files and SQLite database.

**Question:** Which is the source of truth?

| Option | Description                                              |
| ------ | -------------------------------------------------------- |
| A      | **MD files are source of truth** - DB is derived/cached  |
| B      | **DB is source of truth** - MD files are generated views |
| C      | **Both are sources** - Sync bidirectionally              |
| D      | **DB for state, MD for content** - Different purposes    |

| Option | Pros                                    | Cons                                   |
| ------ | --------------------------------------- | -------------------------------------- |
| A      | Human-readable, git-trackable, portable | Parsing overhead, sync complexity      |
| B      | Fast queries, relational integrity      | Less portable, harder to edit manually |
| C      | Flexibility                             | Sync conflicts, complexity             |
| D      | Best of both                            | Clear separation needed                |

**My Recommendation:** **Option D (DB for state, MD for content)**

- **MD files**: Task description, acceptance criteria, test definitions (human-authored content)
- **Database**: Status, timestamps, relationships, execution history (system-managed state)

On task creation:

1. Create MD file with content
2. Create DB record with state + reference to MD path

On status change:

1. Update DB record
2. Optionally update frontmatter in MD (for readability)

```
YOUR ANSWER: DB will be the only thing remaining as mds will be migrated to db.

Sync strategy: _______________________________________________
```

---

### Q30: Recovery from Failures

**Question:** What happens when things go wrong?

| Failure Scenario                 | How to Recover |
| -------------------------------- | -------------- |
| Task Agent crashes mid-execution | ?              |
| Build Agent fails a task         | ?              |
| Telegram bot disconnects         | ?              |
| Database corrupted               | ?              |
| MD file accidentally deleted     | ?              |
| User doesn't respond for days    | ?              |

**My Recommendation:**

| Failure                | Recovery Strategy                                       |
| ---------------------- | ------------------------------------------------------- |
| Task Agent crash       | Restart, resume from last checkpoint, DB has state      |
| Build Agent fails task | Task marked failed, create follow-up task for fix       |
| Telegram disconnects   | Auto-reconnect, queue messages, retry delivery          |
| DB corrupted           | Rebuild from MD files (they have frontmatter)           |
| MD deleted             | Recreate from DB record (basic skeleton)                |
| User unresponsive      | Daily reminder → weekly reminder → auto-pause task list |

```
YOUR ANSWER: Agreed.

Additional failure scenarios: _______________________________________________
```

---

### Q31: Task List as First-Class Entity

**Context:** You said task lists need to be in SQL with relationships and visualized as a graph.

**Question:** What attributes should a Task List have?

| Attribute              | Required? | Description                      |
| ---------------------- | --------- | -------------------------------- |
| id                     | Yes       | Unique identifier                |
| name                   | Yes       | Human-readable name              |
| description            | ?         | What this list is for            |
| project_id             | ?         | Parent project                   |
| idea_slug              | ?         | Associated idea (if any)         |
| status                 | Yes       | draft, active, paused, completed |
| user_approval_required | Yes       | Toggle you mentioned             |
| auto_execute_low_risk  | ?         | Your "low risk auto" setting     |
| auto_answer_medium_low | ?         | Toggle for medium/low questions  |
| created_by             | ?         | Who created it                   |
| created_at             | Yes       | When                             |
| priority               | ?         | For ordering multiple lists      |

**My Recommendation:** All of the above, plus:

```sql
CREATE TABLE task_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Scope
  project_id TEXT,
  idea_slug TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',

  -- Settings (your toggles)
  user_approval_required INTEGER NOT NULL DEFAULT 1,
  auto_execute_low_risk INTEGER NOT NULL DEFAULT 0,
  auto_answer_medium_low INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Progress
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0
);

-- Junction table for tasks in lists
CREATE TABLE task_list_items (
  id TEXT PRIMARY KEY,
  task_list_id TEXT NOT NULL REFERENCES task_lists(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  position INTEGER NOT NULL,  -- Order in list
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_list_id, task_id)
);
```

```
YOUR ANSWER: Agreed. Although consider the answers above to make sure you haven't missed anything.

Additional attributes: _______________________________________________
```

---

## Summary Section

After answering all questions, please confirm:

```
CONFIRMATION:

[ x] I have answered all 31 questions
[x ] My answers are final (or mark which need more thought)
[ x] Ready for updated architecture docs

Additional notes or requirements not covered above:
_______________________________________________
_______________________________________________
_______________________________________________

Priority order for implementation (if different from recommended):
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
```

---

## Next Steps

Once you complete this questionnaire, I will:

1. **Update Architecture Doc** (`task-agent-arch.md`)
   - Add task_lists table and relationships
   - Define evaluation scoring formula
   - Document Telegram Q&A flow

2. **Update Task Breakdown** (`TAK-TASK-AGENT.md`)
   - Add tasks for task_lists schema
   - Add tasks for relationship graph visualization
   - Add tasks for Telegram Q&A handlers

3. **Create Test Plan** (`task-agent-test-plan.md`)
   - Human-in-loop test scenarios
   - Expected Telegram interactions
   - Success criteria for litmus test

4. **Create E2E Test Script** (`tests/e2e/task-agent-litmus.ts`)
   - Automated setup
   - Checkpoints for human validation
   - Result recording
