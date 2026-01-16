# Agent Specifications: Infrastructure & Cross-cutting

> 📍 **Navigation:** [Documentation Index](./DOCUMENTATION-INDEX.md) → Infrastructure Agents

**Created:** 2026-01-10
**Updated:** 2026-01-12
**Purpose:** Definitive reference for support agents (SIA, Monitor, PM) and cross-cutting concerns
**Status:** Implementation Guide

---

## Table of Contents

1. [Self-Improvement Agent (SIA)](#1-self-improvement-agent-sia)
2. [Monitor Agent](#2-monitor-agent)
3. [PM Agent](#3-pm-agent)
4. [Context Loading Strategies](#4-context-loading-strategies)
5. [Knowledge Base Integration](#5-knowledge-base-integration)
6. [Proactive Questioning](#6-proactive-questioning)

**See Also:** [AGENT-SPECIFICATIONS-PIPELINE.md](./AGENT-SPECIFICATIONS-PIPELINE.md) for Ideation, Task, Build agents.

---

## 1. Self-Improvement Agent (SIA)

### 1.1 Trigger

```
TRIGGER: Spawned by Task Agent when:
         - Task has 3+ failed execution attempts AND
         - No progress detected between attempts

SPAWN CRITERIA ("No Progress" Definition):
  - Same error message repeating
  - No new Git commits between attempts
  - No files modified
  - Validation score not improving

SECONDARY TRIGGERS (for learning, not failure recovery):
  - Event "build.completed" (learn from successful builds)
  - Event "ideation.completed" (learn from ideation patterns)

NOTE: SIA is NOT a background service. It is spawned ON-DEMAND by Task Agent
      specifically to analyze repeated failures and propose fixes.
```

### 1.1.1 SIA Spawn Flow

```
Task Agent monitors task_execution_log
    ↓
IF (task.attempts >= 3) AND (no_progress_detected):
    ↓
Task Agent spawns SIA Agent
    ↓
SIA analyzes: execution logs, error patterns, code state
    ↓
SIA proposes: fix approach OR task decomposition
    ↓
Task Agent creates follow-up tasks from SIA output
    ↓
Task Agent re-queues task list for Build Agent
```

### 1.2 Context Loading

```python
# coding-loops/agents/sia_agent.py

class SIAAgent:

    async def load_review_context(self, execution_id: str) -> ReviewContext:
        """Load context for analyzing a build execution.

        NOTE: Execution records now link to task_list_id (not spec_id).
        SIA loads spec/tasks files from idea folder path.
        """

        # 1. LOAD EXECUTION RECORD
        execution = await db.query(
            "SELECT * FROM build_executions WHERE id = ?",
            [execution_id]
        )

        # 2. LOAD ALL TASK RESULTS FROM EXECUTION LOG
        task_results = await db.query("""
            SELECT tel.* FROM task_execution_log tel
            JOIN task_list_items tli ON tel.task_id = tli.task_id
            WHERE tli.task_list_id = ?
            AND tel.execution_id = ?
            ORDER BY tel.started_at
        """, [execution.task_list_id, execution_id])

        # 3. LOAD TASK LIST (what was queued)
        task_list = await db.query(
            "SELECT * FROM task_lists WHERE id = ?",
            [execution.task_list_id]
        )

        # 4. LOAD SPEC & TASKS FILES (what was planned)
        base_path = f"users/{execution.user_slug}/ideas/{execution.idea_slug}/build"
        spec_content = await read_file(f"{base_path}/spec.md") if await file_exists(f"{base_path}/spec.md") else None
        tasks_content = await read_file(f"{base_path}/tasks.md") if await file_exists(f"{base_path}/tasks.md") else None

        # 5. LOAD GIT DIFF (what actually changed)
        git_diff = None
        if execution.git_commits:
            git_diff = await self.git.diff(
                from_ref=execution.git_commits[0] + "^",  # Before first commit
                to_ref=execution.git_commits[-1]          # After last commit
            )

        # 6. LOAD TEST RESULTS
        test_results = json.loads(execution.final_validation) if execution.final_validation else None

        # 7. LOAD PREVIOUS SIMILAR REVIEWS (for pattern matching)
        similar_reviews = await db.query("""
            SELECT * FROM system_reviews
            WHERE agent_type = 'build'
            AND outcome = ?
            ORDER BY reviewed_at DESC
            LIMIT 10
        """, [execution.status])

        return ReviewContext(
            execution=execution,
            task_list=task_list,
            task_results=task_results,
            spec_content=spec_content,
            tasks_content=tasks_content,
            git_diff=git_diff,
            test_results=test_results,
            similar_reviews=similar_reviews
        )
```

### 1.3 Decision Logic

```python
# coding-loops/agents/sia_agent.py

class SIAAgent:

    # DECISION: What type of divergence is this?
    def classify_divergence(self, divergence: Divergence) -> str:
        """
        GOOD divergences (keep):
        - Enhancement: Added something beneficial not in spec
        - Optimization: Made code more efficient
        - Best practice: Applied known good pattern

        BAD divergences (learn from):
        - Shortcut: Skipped required step
        - Mistake: Introduced bug
        - Deviation: Strayed from spec without reason
        """

        if divergence.type == 'addition':
            # Added something not in spec
            if self.is_beneficial(divergence):
                return 'GOOD:enhancement'
            else:
                return 'BAD:scope_creep'

        elif divergence.type == 'omission':
            # Skipped something in spec
            if divergence.was_intentional:
                return 'NEUTRAL:intentional_skip'
            else:
                return 'BAD:missed_requirement'

        elif divergence.type == 'modification':
            # Changed approach from spec
            if self.is_improvement(divergence):
                return 'GOOD:optimization'
            else:
                return 'BAD:deviation'

        return 'UNKNOWN'

    # DECISION: Should we record this as a gotcha?
    def should_record_gotcha(self, failure: TaskFailure) -> bool:

        # Yes if: Task failed and we learned something
        if failure.was_self_corrected:
            return True

        # Yes if: Same mistake was made before
        if self.seen_similar_failure(failure):
            return True

        # No if: One-off environmental issue
        if failure.error_type in ['NETWORK', 'TIMEOUT', 'RESOURCE']:
            return False

        return failure.is_reproducible

    # DECISION: Should we update CLAUDE.md?
    def should_update_claude_md(self, pattern: Pattern) -> bool:

        # Threshold for CLAUDE.md inclusion
        return (
            pattern.confidence >= 0.9 and
            pattern.occurrences >= 3 and
            pattern.is_universal and  # Applies across ideas, not just one
            not self.already_in_claude_md(pattern)
        )

    # DECISION: What metrics to track?
    def extract_metrics(self, context: ReviewContext) -> List[Metric]:

        metrics = []

        # First-pass success rate
        total_tasks = len(context.tasks)
        first_pass = sum(1 for t in context.tasks if t.attempts == 1 and t.status == 'complete')
        metrics.append(Metric(
            type='first_pass_success',
            value=first_pass / total_tasks if total_tasks > 0 else 0
        ))

        # Gotcha effectiveness
        tasks_with_gotchas = [t for t in context.tasks if t.gotchas]
        gotcha_helped = sum(1 for t in tasks_with_gotchas if t.status == 'complete' and t.attempts == 1)
        metrics.append(Metric(
            type='gotcha_effectiveness',
            value=gotcha_helped / len(tasks_with_gotchas) if tasks_with_gotchas else 0
        ))

        # Duration
        metrics.append(Metric(
            type='build_duration_minutes',
            value=(context.execution.completed_at - context.execution.started_at).total_seconds() / 60
        ))

        return metrics
```

### 1.4 Skills & Tools

```python
SIA_SKILLS = {

    'capture': {
        'description': 'Gather all session data for review',
        'uses': ['Database', 'Git', 'File system'],
        'inputs': ['execution_id']
    },

    'analyze': {
        'description': 'Compare planned vs actual',
        'uses': ['Diff analysis', 'Claude for interpretation'],
        'outputs': ['divergences', 'classifications']
    },

    'extract_patterns': {
        'description': 'Identify reusable patterns from success',
        'uses': ['Claude API'],
        'outputs': ['patterns with confidence scores']
    },

    'extract_gotchas': {
        'description': 'Identify mistakes to avoid from failures',
        'uses': ['Claude API'],
        'outputs': ['gotchas with file patterns']
    },

    'update_knowledge_base': {
        'description': 'Record patterns and gotchas',
        'uses': ['Knowledge Base'],
        'triggers': 'After extraction'
    },

    'update_claude_md': {
        'description': 'Add universal patterns to CLAUDE.md',
        'uses': ['File system', 'Git'],
        'triggers': 'High-confidence universal pattern',
        'requires': 'Pattern seen 3+ times'
    },

    'update_templates': {
        'description': 'Improve spec/tasks templates',
        'uses': ['File system'],
        'triggers': 'Structural improvement identified'
    },

    'track_metrics': {
        'description': 'Record improvement metrics',
        'uses': ['Database'],
        'outputs': ['improvement_metrics records']
    }
}
```

---

## 2. Monitor Agent

### 2.1 Trigger

```
TRIGGER: Timer-based (every 2 minutes)

NOT event-driven - continuously polls system state
```

### 2.2 Context Loading

```python
# coding-loops/agents/monitor_agent.py

class MonitorAgent:

    async def load_monitoring_context(self) -> MonitorContext:

        # 1. ACTIVE LOOPS
        loops = await db.query("""
            SELECT * FROM loops WHERE status = 'running'
        """)

        # 2. IN-PROGRESS TASKS
        active_tasks = await db.query("""
            SELECT t.*, l.name as loop_name
            FROM tasks t
            JOIN build_executions e ON t.execution_id = e.id
            JOIN loops l ON e.loop_id = l.id
            WHERE t.status = 'in_progress'
        """)

        # 3. COMPONENT HEALTH
        health = await db.query("""
            SELECT * FROM component_health
            WHERE last_heartbeat > datetime('now', '-5 minutes')
        """)

        # 4. CURRENT LOCKS
        locks = await db.query("""
            SELECT * FROM file_locks
            WHERE expires_at > datetime('now')
        """)

        # 5. WAIT GRAPH (for deadlock detection)
        waits = await db.query("""
            SELECT * FROM wait_graph
        """)

        # 6. RECENT ALERTS (to avoid duplicates)
        recent_alerts = await db.query("""
            SELECT * FROM alerts
            WHERE created_at > datetime('now', '-30 minutes')
            AND acknowledged = 0
        """)

        return MonitorContext(
            loops=loops,
            active_tasks=active_tasks,
            health=health,
            locks=locks,
            waits=waits,
            recent_alerts=recent_alerts
        )
```

### 2.3 Decision Logic

```python
# coding-loops/agents/monitor_agent.py

class MonitorAgent:

    # CHECK: Is any loop stuck?
    async def check_stuck_tasks(self, context: MonitorContext) -> List[Alert]:

        alerts = []
        now = datetime.now(timezone.utc)

        for task in context.active_tasks:
            duration = now - task.started_at

            # Different thresholds by task type
            if task.phase == 'database':
                threshold = timedelta(minutes=5)
            elif task.phase == 'tests':
                threshold = timedelta(minutes=15)
            else:
                threshold = timedelta(minutes=10)

            if duration > threshold:
                # Check if we already alerted
                existing = self.find_alert(context.recent_alerts, task.id)
                if not existing:
                    alerts.append(Alert(
                        type='stuck_task',
                        severity='warning',
                        source=task.loop_name,
                        message=f"Task {task.id} stuck for {duration.minutes} min",
                        context={'task_id': task.id, 'duration': duration}
                    ))

        return alerts

    # CHECK: Is there a deadlock?
    async def check_deadlocks(self, context: MonitorContext) -> List[Alert]:

        # Build wait graph
        graph = {}
        for wait in context.waits:
            if wait.waiter not in graph:
                graph[wait.waiter] = []
            graph[wait.waiter].append(wait.waiting_for)

        # Detect cycles using DFS
        cycles = self.find_cycles(graph)

        alerts = []
        for cycle in cycles:
            alerts.append(Alert(
                type='deadlock',
                severity='critical',
                source='monitor',
                message=f"Deadlock detected: {' -> '.join(cycle)}",
                context={'cycle': cycle}
            ))

        return alerts

    # CHECK: Is any component unhealthy?
    async def check_component_health(self, context: MonitorContext) -> List[Alert]:

        alerts = []
        expected_components = ['loop-1', 'loop-2', 'loop-3', 'pm-agent']

        healthy_components = {h.component for h in context.health}

        for component in expected_components:
            if component not in healthy_components:
                alerts.append(Alert(
                    type='component_down',
                    severity='error',
                    source='monitor',
                    message=f"Component {component} not responding"
                ))

        return alerts
```

---

## 3. PM Agent

### 3.1 Trigger

```
TRIGGER: Event "alert.*" (any alert from Monitor)
         Event "conflict.detected"
         Event "decision.requested"
```

### 3.2 Decision Logic

```python
# coding-loops/agents/pm_agent.py

class PMAgent:

    # DECISION: How to handle stuck task?
    async def handle_stuck_task(self, alert: Alert) -> PMDecision:

        task_id = alert.context['task_id']
        duration = alert.context['duration']

        # Get more context
        task = await self.get_task(task_id)
        loop = await self.get_loop(task.loop_id)

        if duration > timedelta(minutes=30):
            # Too long - interrupt
            return PMDecision(
                action='INTERRUPT',
                target=loop.id,
                reason='Task exceeded 30 minute timeout',
                follow_up='SKIP_AND_CONTINUE'
            )

        elif duration > timedelta(minutes=20):
            # Getting long - escalate to human
            return PMDecision(
                action='ESCALATE',
                target='human',
                message=f"Task {task_id} stuck for {duration.minutes} min. Skip or wait?",
                options=['wait', 'skip', 'retry']
            )

        else:
            # Monitor but don't act yet
            return PMDecision(
                action='WATCH',
                check_again_in=timedelta(minutes=5)
            )

    # DECISION: How to resolve conflict?
    async def handle_conflict(self, conflict: Conflict) -> PMDecision:

        # Who owns the file?
        owner = await self.resource_registry.get_owner(conflict.file)
        requestor = conflict.requesting_loop

        if owner is None:
            # Unowned file - first requestor gets it
            return PMDecision(
                action='GRANT',
                target=requestor,
                reason='File unowned - granting to first requestor'
            )

        elif self.is_higher_priority(requestor, owner):
            # Higher priority work needs the file
            return PMDecision(
                action='PREEMPT',
                target=owner,
                message=f'{requestor} needs {conflict.file} for higher priority work',
                follow_up='PAUSE_AND_YIELD'
            )

        else:
            # Owner keeps it
            return PMDecision(
                action='DENY',
                target=requestor,
                reason=f'File owned by {owner}',
                suggestion='Wait or request change'
            )

    # DECISION: How to redistribute work?
    async def redistribute_work(self, failed_loop: str) -> List[WorkAssignment]:

        # Get pending tasks for failed loop
        pending_tasks = await db.query("""
            SELECT * FROM tasks
            WHERE assigned_to = ? AND status IN ('pending', 'in_progress')
        """, [failed_loop])

        # Get available loops
        available_loops = await db.query("""
            SELECT * FROM loops
            WHERE status = 'running' AND id != ?
            ORDER BY current_load ASC
        """, [failed_loop])

        assignments = []
        for task in pending_tasks:
            # Find least loaded loop
            target_loop = available_loops[0] if available_loops else None

            if target_loop:
                assignments.append(WorkAssignment(
                    task_id=task.id,
                    from_loop=failed_loop,
                    to_loop=target_loop.id
                ))

        return assignments
```

---

## 4. Context Loading Strategies

### 4.1 Lazy Loading vs Eager Loading

```python
# When to use each strategy

CONTEXT_LOADING_STRATEGIES = {

    'ideation_agent': {
        'strategy': 'LAZY',
        'reason': 'Context grows during conversation',
        'approach': '''
            - Load session state immediately
            - Load memory on-demand (last N messages)
            - Load idea artifacts only when candidate created
            - Web search results loaded only when requested
        '''
    },

    # NOTE: specification_agent is DEPRECATED - now Task Agent Phase 1
    'task_agent_phase_1': {
        'strategy': 'EAGER',
        'reason': 'Need full context for complete spec (replaces specification_agent)',
        'approach': '''
            - Load ALL idea documents upfront
            - Query Knowledge Base for ALL relevant gotchas
            - Analyze entire codebase for patterns
            - Cache for duration of spec generation
        '''
    },

    'build_agent': {
        'strategy': 'PHASED',
        'reason': 'Balance between completeness and efficiency',
        'approach': '''
            - PRIME phase: Load spec, tasks, conventions
            - PER-TASK: Load task-specific gotchas
            - ON-DEMAND: Load referenced files only when needed
        '''
    },

    'sia_agent': {
        'strategy': 'EAGER',
        'reason': 'Need complete picture for accurate analysis',
        'approach': '''
            - Load full execution history
            - Load complete git diff
            - Load all task results
            - Load similar past reviews for comparison
        '''
    }
}
```

### 4.2 Context Prioritization

```python
# When context exceeds budget, what to keep?

def prioritize_context(context: dict, budget: int) -> dict:
    """
    Priority order (highest first):
    1. Current task definition
    2. Relevant gotchas
    3. Code template
    4. Conventions (from CLAUDE.md)
    5. Recent memory (last 5 messages)
    6. Idea summary (README)
    7. Full memory (older messages)
    8. Research documents
    """

    priority_order = [
        ('task', context.get('task'), 1.0),           # Always include
        ('gotchas', context.get('gotchas'), 0.95),    # Almost always
        ('template', context.get('template'), 0.90),   # Very important
        ('conventions', context.get('conventions'), 0.85),
        ('recent_memory', context.get('memory')[-5:], 0.80),
        ('readme', context.get('readme'), 0.70),
        ('full_memory', context.get('memory'), 0.50),
        ('research', context.get('research'), 0.30),
    ]

    result = {}
    current_size = 0

    for key, value, priority in priority_order:
        if value is None:
            continue

        value_size = estimate_tokens(value)

        if current_size + value_size <= budget:
            result[key] = value
            current_size += value_size
        elif priority > 0.8:
            # High priority - truncate to fit
            truncated = truncate_to_fit(value, budget - current_size)
            result[key] = truncated
            break

    return result
```

---

## 5. Knowledge Base Integration

### 5.1 How Agents Query Knowledge Base

```python
# Unified Knowledge Base interface

class KnowledgeBase:

    # SPEC AGENT uses this to inject gotchas
    async def get_gotchas_for_task(
        self,
        file_path: str,
        action: str
    ) -> List[Gotcha]:
        """
        Query logic:
        1. Match by file pattern (*.sql, server/routes/*, etc.)
        2. Match by action type (CREATE, UPDATE, etc.)
        3. Sort by confidence descending
        4. Return top 5
        """

        pattern = self.get_file_pattern(file_path)
        # "database/migrations/001.sql" -> "*.sql"

        return await self.db.query("""
            SELECT * FROM knowledge
            WHERE item_type = 'gotcha'
              AND superseded_by IS NULL
              AND (file_pattern = ? OR file_pattern IS NULL)
              AND (action_type = ? OR action_type IS NULL)
              AND confidence >= 0.6
            ORDER BY
              CASE WHEN file_pattern = ? THEN 1 ELSE 2 END,
              confidence DESC
            LIMIT 5
        """, [pattern, action, pattern])

    # BUILD AGENT uses this to record discoveries
    async def record_gotcha(
        self,
        content: str,
        file_path: str,
        action: str,
        confidence: float,
        discovered_by: str
    ) -> str:
        """
        Recording logic:
        1. Check for duplicates
        2. If similar exists with lower confidence, supersede it
        3. If similar exists with higher confidence, don't record
        4. Otherwise, create new entry
        """

        # Check for similar
        similar = await self.find_similar(content)

        if similar and similar.confidence >= confidence:
            return None  # Don't record - we have better

        if similar:
            # Supersede the old one
            await self.supersede(similar.id, new_id)

        return await self.db.insert('knowledge', {
            'id': generate_id(),
            'item_type': 'gotcha',
            'content': content,
            'file_pattern': self.get_file_pattern(file_path),
            'action_type': action,
            'confidence': confidence,
            'discovered_by': discovered_by
        })

    # SIA uses this to find patterns
    async def get_patterns_for_domain(
        self,
        topics: List[str]
    ) -> List[Pattern]:
        """
        Query for reusable patterns by topic.
        Used when generating new specs to apply learned approaches.
        """

        return await self.db.query("""
            SELECT * FROM knowledge
            WHERE item_type = 'pattern'
              AND superseded_by IS NULL
              AND topic IN (?)
              AND confidence >= 0.7
            ORDER BY confidence DESC
        """, [topics])
```

### 5.2 Knowledge Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KNOWLEDGE LIFECYCLE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. DISCOVERY (Build Agent)                                                  │
│     Task fails → Agent self-corrects → Records gotcha with confidence 0.7   │
│                                                                              │
│  2. VALIDATION (SIA)                                                         │
│     Reviews discovery → Confirms or adjusts confidence                       │
│     If seen 2+ times → Boost confidence to 0.85                              │
│                                                                              │
│  3. USAGE (Spec Agent)                                                       │
│     Queries for relevant gotchas → Injects into task definitions            │
│                                                                              │
│  4. REINFORCEMENT                                                            │
│     If injected gotcha prevents failure → Boost confidence to 0.95          │
│     If injected gotcha didn't help → Lower confidence                        │
│                                                                              │
│  5. PROMOTION (SIA)                                                          │
│     Confidence >= 0.9 AND seen 3+ times → Add to CLAUDE.md                  │
│     Now universal knowledge, not just in database                           │
│                                                                              │
│  6. DEPRECATION                                                              │
│     If pattern no longer relevant (e.g., library updated)                    │
│     → Mark as superseded, won't appear in queries                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Agent Decision Matrix

> **Note:** "Task (P1)" = Task Agent Phase 1 (spec generation), "Task (P2)" = Task Agent Phase 2 (orchestration)

| Scenario           | Ideation  | Task (P1) | Build      | Task (P2)  | SIA       | Monitor   | PM         |
| ------------------ | --------- | --------- | ---------- | ---------- | --------- | --------- | ---------- |
| User sends message | ✓ Process |           |            |            |           |           |            |
| Ideation complete  |           | ✓ Trigger |            |            | Reviews   |           |            |
| Generate spec      |           | ✓ Execute |            |            |           |           |            |
| Spec/tasks created |           |           |            | ✓ Suggest  |           |           |            |
| Task list approved |           |           | ✓ Execute  | ✓ Dispatch |           | Watches   |            |
| Task starts        |           |           | ✓ Execute  | ✓ Track    |           | Watches   |            |
| Task fails         |           |           | Retry/skip | ✓ Escalate | Gotcha    |           |            |
| Task stuck         |           |           |            | ✓ Notify   |           | ✓ Detects | Resolves   |
| Build complete     |           |           |            | ✓ Report   | ✓ Reviews |           |            |
| Telegram command   |           |           |            | ✓ Handle   |           |           |            |
| Stale task         |           |           |            | ✓ Detect   |           |           |            |
| Duplicate detected |           |           |            | ✓ Merge    |           |           |            |
| Conflict detected  |           |           | Waits      |            |           |           | ✓ Resolves |
| Deadlock detected  |           |           |            |            |           | ✓ Detects | ✓ Resolves |
| Component down     |           |           |            |            |           | ✓ Alerts  | Restarts   |

---

## 6. Proactive Questioning

> **See Also:** `ENGAGEMENT-AND-ORCHESTRATION-UI.md` for full UI/UX specifications

### 6.1 Why Agents Ask Questions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      QUESTIONING PHILOSOPHY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   GOAL: Keep users engaged, excited, and thinking ahead while              │
│         ensuring alignment and preventing wasted work.                       │
│                                                                              │
│   QUESTION TYPES:                                                           │
│   ┌─────────────┬────────────────────────────────────────────────────┐     │
│   │ BLOCKING    │ Cannot proceed without answer                       │     │
│   │ CLARIFYING  │ Would improve quality (but has safe default)        │     │
│   │ CONFIRMING  │ Validates agent's assumption before proceeding      │     │
│   │ EDUCATIONAL │ Helps user think ahead (optional to answer)         │     │
│   │ CELEBRATORY │ Marks progress and builds excitement                │     │
│   │ PREFERENCE  │ Learns user style for future interactions           │     │
│   └─────────────┴────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Question Interface

```typescript
interface AgentQuestion {
  id: string;
  type:
    | "blocking"
    | "clarifying"
    | "confirming"
    | "educational"
    | "celebratory"
    | "preference";
  agent: string;
  phase: string;

  // Content
  text: string;
  context: string; // Why we're asking

  // Options
  options: Array<{
    label: string;
    description?: string;
    recommended?: boolean;
    implications?: string;
  }>;
  allowFreeText: boolean;
  defaultOption?: string;

  // Behavior
  blocking: boolean;
  expiresAfter?: Duration;
  reminderAfter?: Duration;

  // Metadata
  ideaId: string;
  sessionId: string;
  tags: string[]; // For pattern matching
}
```

### 6.3 Ideation Agent Questions

```yaml
# agents/ideation/questions.yaml

triggers:
  - event: "idea_created"
    questions:
      - type: blocking
        text: "Who is the ideal first user for this idea?"
        context: "Knowing your target user helps me ask better questions and evaluate market fit accurately."
        options:
          - label: "Myself / indie developers"
            description: "Building for people like you"
          - label: "Small business owners"
            description: "SMBs with limited resources"
          - label: "Enterprise teams"
            description: "Large organizations"
        allowFreeText: true

  - event: "problem_statement_vague"
    condition: "problem_description.length < 50"
    questions:
      - type: blocking
        text: |
          I want to make sure I understand the core problem.

          You mentioned: "{problem_snippet}"

          Could you tell me more about:
          • Who experiences this problem most acutely?
          • What happens when they can't solve it?
          • How are they solving it today?
        context: "Clear problem definition is the foundation of a strong idea."
        allowFreeText: true

  - event: "phase_complete"
    phase: "EXPLORING"
    questions:
      - type: celebratory
        text: |
          Great progress! You've now defined:
          ✓ A clear problem
          ✓ A specific target user
          ✓ An initial solution approach

          Ready to dive deeper into scoping and validation?
        options:
          - label: "Yes, let's continue!"
            recommended: true
          - label: "Actually, I want to refine something"
          - label: "Save progress, continue later"

  - event: "idea_complexity_high"
    condition: "complexity_score > 7"
    questions:
      - type: educational
        text: |
          This idea has a lot of moving parts!

          Before we go further, have you thought about which part
          you'd build first to validate the core assumption?

          I'm asking because starting with an MVP helps test
          whether the fundamental problem-solution fit exists.
        options:
          - label: "Yes, I'd start with..."
            description: "Tell me your MVP focus"
          - label: "Help me think through this"
          - label: "I want to build the full thing"

  - event: "before_research"
    questions:
      - type: confirming
        text: |
          I'm about to research these areas for your idea:

          1. Market size and trends
          2. Existing solutions and competitors
          3. Technical feasibility considerations

          Is there anything specific you want me to dig into?
        options:
          - label: "Those areas look good"
            recommended: true
          - label: "Also look into..."
            description: "Add specific focus areas"
          - label: "Skip research, I know the market"
```

### 6.4 Task Agent Phase 1 Questions (Specification)

> **Note:** These questions were previously "Specification Agent Questions". Now handled by Task Agent Phase 1.

```yaml
# server/services/task-agent/phase1-questions.yaml

triggers:
  - event: "requirement_ambiguous"
    questions:
      - type: blocking
        text: |
          I need to clarify a requirement before writing the spec.

          You mentioned: "{requirement}"

          What does "{ambiguous_term}" mean specifically?
        options:
          - label: "< 100ms response time"
          - label: "< 1 second response time"
          - label: "Faster than current solution"
        allowFreeText: true
        context: "Precise requirements lead to better specifications."

  - event: "multiple_architectures"
    questions:
      - type: blocking
        text: |
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
          - label: "Option A"
            implications: "You'll get {pros_a} but deal with {cons_a}"
          - label: "Option B"
            implications: "You'll get {pros_b} but deal with {cons_b}"
          - label: "Tell me more about trade-offs"
          - label: "I have a different approach"
        allowFreeText: true
        context: "This decision affects the entire implementation."

  - event: "before_finalize_spec"
    questions:
      - type: confirming
        text: |
          Here's the scope I've captured for this feature:

          **In Scope:**
          {in_scope_list}

          **Explicitly Out of Scope:**
          {out_scope_list}

          Does this match your expectations?
        options:
          - label: "Yes, proceed with spec"
            recommended: true
          - label: "Add to scope..."
          - label: "Remove from scope..."
          - label: "Let's discuss"
        context: "Confirming scope prevents rework later."

  - event: "external_dependencies"
    questions:
      - type: educational
        text: |
          This feature depends on:
          {dependency_list}

          Have you verified these are available/compatible?

          I'm flagging this because dependency issues are
          a common source of project delays.
        options:
          - label: "Yes, I've verified"
          - label: "Help me check"
          - label: "Let's design around them"
        blocking: false

  - event: "spec_complete"
    questions:
      - type: celebratory
        text: |
          Specification complete!

          📋 {task_count} atomic tasks identified
          ⏱️ Estimated complexity: {complexity}
          🎯 Key risk areas: {risks}

          Ready for me to hand this to the Build Agent?
        options:
          - label: "Yes, start building!"
            recommended: true
          - label: "Let me review the spec first"
          - label: "I have questions..."
```

### 6.5 Build Agent Questions

```yaml
# agents/build/questions.yaml

triggers:
  - event: "multiple_implementations"
    questions:
      - type: clarifying
        text: |
          Working on task: {task_id}

          I can implement this using:

          1. **{approach_1}** - {description_1}
          2. **{approach_2}** - {description_2}

          Based on your codebase patterns, I'd recommend #{recommendation}.
          Should I proceed with that?
        options:
          - label: "Yes, use your recommendation"
            recommended: true
          - label: "Use approach 1"
          - label: "Use approach 2"
          - label: "Let me think about it"
        default: "Yes, use your recommendation"
        blocking: false

  - event: "missing_context"
    questions:
      - type: blocking
        text: |
          I'm stuck on task: {task_id}

          I need to know: {missing_info}

          This isn't in the spec or existing codebase.
          Can you help me understand?
        options:
          - label: "Here's the answer..."
            description: "Provide the missing information"
          - label: "Check this file..."
            description: "Point me to an existing reference"
          - label: "Skip this task for now"
          - label: "Let's redesign this part"
        allowFreeText: true

  - event: "task_complexity_exceeded"
    condition: "actual_time > estimated_time * 3"
    questions:
      - type: educational
        text: |
          Task {task_id} is more complex than expected.

          **Original estimate:** {estimate}
          **Actual so far:** {actual}
          **Remaining work:** {remaining}

          This often happens when {common_reason}.

          Should I continue, or do you want to reconsider the approach?
        options:
          - label: "Continue, it's worth it"
          - label: "Simplify the approach"
          - label: "Pause and let's discuss"
          - label: "Skip for now"
        blocking: false

  - event: "milestone_reached"
    condition: "completed_tasks >= total_tasks * 0.5"
    questions:
      - type: celebratory
        text: |
          Milestone reached! 🎉

          **Completed:** {completed_count} / {total_count} tasks
          **Time elapsed:** {time}
          **Tests passing:** {test_status}

          {encouragement_message}

          Ready to continue?
        options:
          - label: "Keep going!"
            recommended: true
          - label: "Show me what's done so far"
          - label: "Take a break, save progress"

  - event: "task_failed_repeatedly"
    condition: "attempts >= 3"
    questions:
      - type: blocking
        text: |
          I've tried 3 times and can't complete task: {task_id}

          **Error:** {error_message}

          **What I've tried:**
          {attempts_list}

          I need your input to proceed.
        options:
          - label: "Try this..."
            description: "Give me guidance"
          - label: "Skip this task"
          - label: "Rethink the approach with me"
          - label: "I'll fix this manually"
        allowFreeText: true
```

### 6.6 Validation Agent Questions

```yaml
# agents/validation/questions.yaml

triggers:
  - event: "validation_level_needed"
    questions:
      - type: clarifying
        text: |
          How thoroughly should I validate this build?

          • **Quick** (30s): Syntax, types, lint
          • **Standard** (2m): + Unit tests
          • **Thorough** (10m): + Integration, edge cases
          • **Comprehensive** (30m): + Performance, security
          • **Release** (2h): Full regression

          Based on the changes, I'd suggest: {recommendation}
        options:
          - label: "Quick"
          - label: "Standard"
          - label: "Thorough"
          - label: "Comprehensive"
          - label: "Release"
        default: "{recommendation}"

  - event: "multiple_failures"
    questions:
      - type: blocking
        text: |
          Found {count} issues during validation:

          **Critical ({critical_count}):**
          {critical_list}

          **Warning ({warning_count}):**
          {warning_list}

          How should I prioritize fixes?
        options:
          - label: "Fix all critical first, then warnings"
            recommended: true
          - label: "Fix all before proceeding"
          - label: "Show me each one to decide"
          - label: "Skip warnings, fix critical only"

  - event: "security_vulnerability"
    questions:
      - type: blocking
        text: |
          ⚠️ Security issue detected!

          **Type:** {vuln_type}
          **Severity:** {severity}
          **Location:** {file}:{line}
          **Details:** {description}

          This needs immediate attention.
        options:
          - label: "Fix it now"
            recommended: true
          - label: "Show me more details"
          - label: "I'll handle manually"
          - label: "Accept the risk (not recommended)"
            implications: "This could expose your application to {risk_description}"

  - event: "coverage_below_threshold"
    questions:
      - type: educational
        text: |
          Test coverage is {coverage}%, below the {threshold}% target.

          **Uncovered areas:**
          {uncovered_list}

          Should I generate additional tests for these areas?

          Note: Higher coverage helps catch regressions but adds maintenance.
        options:
          - label: "Yes, generate more tests"
          - label: "Coverage is acceptable"
          - label: "Let's discuss which areas matter"
        blocking: false

  - event: "validation_passed"
    questions:
      - type: celebratory
        text: |
          ✅ Validation complete!

          **Results:**
          • Tests: {test_count} passing
          • Coverage: {coverage}%
          • Lint: {lint_status}
          • Security: {security_status}

          Ready to approve for deployment?
        options:
          - label: "Approved! Deploy it"
            recommended: true
          - label: "Run one more check on..."
          - label: "Show me the details first"
```

### 6.7 UX Agent Questions

```yaml
# agents/ux/questions.yaml

triggers:
  - event: "before_ux_testing"
    questions:
      - type: clarifying
        text: |
          Who should I simulate for UX testing?

          I can test as:
          • **First-time user**: Never seen the app before
          • **Power user**: Knows shortcuts, efficient workflows
          • **Accessibility user**: Uses screen reader, keyboard-only
          • **Mobile user**: Touch-first, limited screen

          Or describe a specific persona.
        options:
          - label: "First-time user"
            recommended: true
          - label: "Power user"
          - label: "Accessibility user"
          - label: "Mobile user"
        allowFreeText: true
        default: "First-time user"

  - event: "usability_concern"
    condition: "task_time > expected_time * 2"
    questions:
      - type: educational
        text: |
          I noticed this interaction took longer than expected:

          **Action:** {action}
          **Expected:** {expected_time}
          **Actual:** {actual_time}

          **Friction points:**
          {friction_list}

          Should I log this as a UX issue?
        options:
          - label: "Yes, log as issue"
          - label: "It's acceptable for now"
          - label: "Tell me more about the friction"
          - label: "Create a spec to fix it"
        blocking: false

  - event: "accessibility_violation"
    questions:
      - type: blocking
        text: |
          Accessibility issue detected:

          **Violation:** {violation}
          **WCAG Level:** {level}
          **Impact:** {impact}
          **Element:** {element}

          This affects users with: {affected_users}

          How should we handle this?
        options:
          - label: "Fix immediately"
            recommended: true
          - label: "Add to backlog"
          - label: "Show me the element"
          - label: "I'll review manually"

  - event: "ux_testing_complete"
    questions:
      - type: celebratory
        text: |
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
          - label: "Yes, spec the improvements"
          - label: "Good enough for now"
          - label: "Let's discuss the results"
```

### 6.8 SIA Agent Questions

````yaml
# agents/sia/questions.yaml

triggers:
  - event: "pattern_detected"
    condition: "pattern.confidence > 0.8"
    questions:
      - type: confirming
        text: |
          I noticed a pattern across recent builds:

          **Pattern:** {pattern_description}
          **Occurrences:** {count} times
          **Context:** {contexts}

          Should I add this to the Knowledge Base?
        options:
          - label: "Yes, add it"
            recommended: true
          - label: "Not a real pattern"
          - label: "Refine it first..."
          - label: "Show me examples"
        allowFreeText: true

  - event: "gotcha_candidate"
    questions:
      - type: confirming
        text: |
          I want to capture this gotcha to prevent future issues:

          **Gotcha:** {gotcha}
          **Context:** {context}
          **Why it matters:** {impact}

          Agree to add it?
        options:
          - label: "Yes, add to Knowledge Base"
            recommended: true
          - label: "It's project-specific, don't generalize"
          - label: "Reword it..."
        allowFreeText: true

  - event: "claude_md_promotion"
    condition: "pattern.confidence >= 0.9 AND pattern.occurrences >= 3"
    questions:
      - type: blocking
        text: |
          This pattern has been useful across {count} builds:

          **Pattern:** {pattern}
          **Current location:** Knowledge Base
          **Proposed CLAUDE.md addition:**

          ```
          {proposed_addition}
          ```

          Should I add this to CLAUDE.md?
        options:
          - label: "Yes, promote it"
          - label: "Not yet, needs more validation"
          - label: "Modify it..."
          - label: "Keep it in Knowledge Base only"
        allowFreeText: true

  - event: "weekly_summary"
    questions:
      - type: celebratory
        text: |
          📚 Weekly Knowledge Growth

          **New patterns:** {pattern_count}
          **New gotchas:** {gotcha_count}
          **Knowledge Base entries:** {total_entries}
          **CLAUDE.md updates:** {claude_updates}

          Top learning: {top_learning}

          Would you like to review any of these?
        options:
          - label: "Show me the new patterns"
          - label: "Review gotchas"
          - label: "Looks good, continue"
````

### 6.9 System Prompt Addition for All Agents

Every agent's system prompt should include this questioning module:

```typescript
// Shared questioning system prompt (added to all agents)

const QUESTIONING_SYSTEM_PROMPT = `
## Proactive Questioning

You are expected to ask questions proactively throughout your work. This keeps the user engaged, ensures alignment, and prevents wasted work.

### When to Ask Questions

| Type | When | Blocking? |
|------|------|-----------|
| BLOCKING | Cannot proceed without answer | Yes |
| CLARIFYING | Would improve quality (has safe default) | No |
| CONFIRMING | Validating assumption before proceeding | No |
| EDUCATIONAL | Helping user think ahead | No |
| CELEBRATORY | Marking progress, building excitement | No |
| PREFERENCE | Learning user style for future | No |

### Question Format

Structure questions as JSON in your response:

\`\`\`json
{
  "question": {
    "type": "blocking|clarifying|confirming|educational|celebratory|preference",
    "text": "Clear, specific question",
    "context": "Why you're asking (1-2 sentences)",
    "options": [
      { "label": "Option A", "description": "What this means", "recommended": true },
      { "label": "Option B", "description": "What this means" }
    ],
    "default": "Safe default if no answer (for non-blocking)",
    "allowFreeText": true
  }
}
\`\`\`

### When NOT to Ask

- Answer is already in context (CLAUDE.md, idea files)
- Question is trivial (can safely default)
- Same question asked recently (check session history)
- User explicitly said "just do it" / "use your judgment"

### Engagement Principles

1. **Curiosity Over Assumption** - Ask rather than assume
2. **Forward Thinking** - Help users anticipate issues
3. **Ownership Building** - User decides, you advise
4. **Excitement Maintenance** - Celebrate progress
5. **Transparent Reasoning** - Explain why you're asking
`;
```

### 6.10 Question Flow in Orchestration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      QUESTION FLOW IN ORCHESTRATION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Agent generates question                                                   │
│       │                                                                      │
│       ▼                                                                      │
│  Question Service receives                                                  │
│       │                                                                      │
│       ├─ Is BLOCKING?                                                       │
│       │      │                                                               │
│       │      ├─ YES → Pause agent, show prominently in UI                   │
│       │      │        Push notification to user                             │
│       │      │        Wait for answer (no timeout)                          │
│       │      │                                                               │
│       │      └─ NO  → Add to question queue                                 │
│       │               Continue agent work                                    │
│       │               Apply default after timeout                           │
│       │                                                                      │
│       ▼                                                                      │
│  User answers (or timeout applies default)                                  │
│       │                                                                      │
│       ▼                                                                      │
│  Answer recorded in session                                                 │
│       │                                                                      │
│       ├─ Learn from answer? (if preference or repeated)                     │
│       │      └─ Store pattern for future auto-answers                       │
│       │                                                                      │
│       ▼                                                                      │
│  Resume agent with answer context                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

_This document is the definitive reference for understanding agent internals. For E2E flows, see E2E-SCENARIOS.md. For implementation, see IMPLEMENTATION-PLAN.md. For UI/UX of questioning and orchestration, see ENGAGEMENT-AND-ORCHESTRATION-UI.md._

---

_This document covers infrastructure agents and cross-cutting concerns. For pipeline agents (Ideation, Task, Build), see [AGENT-SPECIFICATIONS-PIPELINE.md](./AGENT-SPECIFICATIONS-PIPELINE.md)._
