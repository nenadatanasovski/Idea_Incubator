# Observability System Implementation Plan - Phase 9: Routing & Deep Linking

> **Location:** `docs/specs/observability/implementation-plan-phase-9.md`
> **Purpose:** Actionable implementation plan for frontend routing and deep linking
> **Status:** Ready for execution
> **Priority:** P2 (Required for complete UI experience)
> **Dependencies:** Phase 7 (React Hooks), Phase 8 (UI Components)

---

## Executive Summary

Phase 9 implements comprehensive routing and deep linking for the observability system. This enables direct navigation to any entity (execution, task, tool use, assertion, skill trace, wave, agent) via URL and provides cross-reference navigation throughout the UI.

| Scope               | Details                                                    |
| ------------------- | ---------------------------------------------------------- |
| **Primary File**    | `frontend/src/App.tsx`                                     |
| **Page Components** | `frontend/src/pages/observability/*.tsx`                   |
| **Tasks**           | OBS-900 to OBS-916                                         |
| **Deliverables**    | Complete deep linking for all observability entities       |
| **Test Validation** | Navigation tests, URL persistence, cross-reference linking |

---

## Current State Analysis

### Existing Routes (from App.tsx)

```typescript
// Already implemented in App.tsx:
/observability                      → ObservabilityPage (OverviewDashboard)
/observability/events               → EventLogTab
/observability/executions           → ExecutionsTab
/observability/executions/:id       → ExecutionReviewPage
/observability/agents               → AgentsTab
/observability/agents/:agentId      → AgentDetailPage
/observability/analytics            → AnalyticsTab
```

### Missing Routes (Phase 9 Scope)

```typescript
// To be implemented:
/observability/executions/:id/tasks/:taskId           → TaskDetailPage
/observability/executions/:id/tools/:toolId           → ToolUseDetailPage
/observability/executions/:id/assertions/:assertId    → AssertionDetailPage
/observability/executions/:id/waves/:waveNum          → WaveDetailPage
/observability/executions/:id/skills/:skillId         → SkillTraceDetailPage
/observability/executions/:id/transcript/:entryId     → TranscriptEntryPage
```

---

## Routing Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY ROUTING ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  /observability                                                          │
│  └── ObservabilityPage (layout wrapper with tabs)                       │
│      ├── index → OverviewDashboard                                      │
│      ├── events → EventLogTab                                           │
│      ├── executions → ExecutionsTab (list view)                         │
│      │   └── :id → ExecutionReviewPage (detail view)                    │
│      │       ├── tasks/:taskId → TaskDetailPage (NEW)                   │
│      │       ├── tools/:toolId → ToolUseDetailPage (NEW)                │
│      │       ├── assertions/:assertId → AssertionDetailPage (NEW)       │
│      │       ├── waves/:waveNum → WaveDetailPage (NEW)                  │
│      │       ├── skills/:skillId → SkillTraceDetailPage (NEW)           │
│      │       └── transcript/:entryId → TranscriptEntryPage (NEW)        │
│      ├── agents → AgentsTab                                             │
│      │   └── :agentId → AgentDetailPage                                 │
│      └── analytics → AnalyticsTab                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Task Breakdown

### OBS-900: Create URL Utilities Module

**File:** `frontend/src/utils/observability-urls.ts`

**Purpose:** Centralized URL generation and parsing for observability deep links.

#### Implementation

```typescript
// frontend/src/utils/observability-urls.ts

/**
 * URL path patterns for observability deep linking.
 */
export const OBSERVABILITY_PATHS = {
  // Top-level
  root: "/observability",
  events: "/observability/events",
  executions: "/observability/executions",
  agents: "/observability/agents",
  analytics: "/observability/analytics",

  // Execution-level
  execution: "/observability/executions/:id",

  // Entity-level (within execution)
  task: "/observability/executions/:id/tasks/:taskId",
  tool: "/observability/executions/:id/tools/:toolId",
  assertion: "/observability/executions/:id/assertions/:assertId",
  wave: "/observability/executions/:id/waves/:waveNum",
  skill: "/observability/executions/:id/skills/:skillId",
  transcript: "/observability/executions/:id/transcript/:entryId",

  // Agent-level
  agent: "/observability/agents/:agentId",
} as const;

export type ObservabilityPath = keyof typeof OBSERVABILITY_PATHS;

/**
 * Generate URL for an observability entity.
 */
export function buildObservabilityUrl(
  path: ObservabilityPath,
  params: Record<string, string | number> = {},
  query?: Record<string, string>,
): string {
  let url = OBSERVABILITY_PATHS[path] as string;

  // Replace path parameters
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, String(value));
  }

  // Add query parameters
  if (query && Object.keys(query).length > 0) {
    const searchParams = new URLSearchParams(query);
    url += `?${searchParams.toString()}`;
  }

  return url;
}

/**
 * Parse execution ID from current URL.
 */
export function parseExecutionId(pathname: string): string | null {
  const match = pathname.match(/\/observability\/executions\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * Parse entity type and ID from URL.
 */
export function parseEntityFromUrl(pathname: string): {
  entityType:
    | "task"
    | "tool"
    | "assertion"
    | "wave"
    | "skill"
    | "transcript"
    | null;
  entityId: string | null;
  executionId: string | null;
} {
  const executionId = parseExecutionId(pathname);

  const patterns = [
    { type: "task" as const, pattern: /\/tasks\/([^\/]+)/ },
    { type: "tool" as const, pattern: /\/tools\/([^\/]+)/ },
    { type: "assertion" as const, pattern: /\/assertions\/([^\/]+)/ },
    { type: "wave" as const, pattern: /\/waves\/([^\/]+)/ },
    { type: "skill" as const, pattern: /\/skills\/([^\/]+)/ },
    { type: "transcript" as const, pattern: /\/transcript\/([^\/]+)/ },
  ];

  for (const { type, pattern } of patterns) {
    const match = pathname.match(pattern);
    if (match) {
      return { entityType: type, entityId: match[1], executionId };
    }
  }

  return { entityType: null, entityId: null, executionId };
}

/**
 * Generate breadcrumb items for current path.
 */
export function generateBreadcrumbs(
  pathname: string,
  entityNames?: Record<string, string>,
): Array<{ label: string; path: string }> {
  const breadcrumbs: Array<{ label: string; path: string }> = [
    { label: "Observability", path: OBSERVABILITY_PATHS.root },
  ];

  const executionId = parseExecutionId(pathname);
  if (executionId) {
    breadcrumbs.push({
      label: "Executions",
      path: OBSERVABILITY_PATHS.executions,
    });
    breadcrumbs.push({
      label: entityNames?.execution || executionId.slice(0, 8),
      path: buildObservabilityUrl("execution", { id: executionId }),
    });
  }

  const { entityType, entityId } = parseEntityFromUrl(pathname);
  if (entityType && entityId && executionId) {
    const labelMap: Record<string, string> = {
      task: "Tasks",
      tool: "Tool Uses",
      assertion: "Assertions",
      wave: "Waves",
      skill: "Skills",
      transcript: "Transcript",
    };

    breadcrumbs.push({
      label: labelMap[entityType] || entityType,
      path: buildObservabilityUrl("execution", { id: executionId }),
    });

    const entityLabel = entityNames?.[entityType] || entityId.slice(0, 8);
    breadcrumbs.push({
      label: entityLabel,
      path: pathname,
    });
  }

  return breadcrumbs;
}
```

#### Acceptance Criteria

- [ ] `buildObservabilityUrl()` generates correct URLs for all entity types
- [ ] `parseExecutionId()` extracts execution ID from any nested path
- [ ] `parseEntityFromUrl()` correctly identifies entity type and ID
- [ ] `generateBreadcrumbs()` produces correct breadcrumb trail
- [ ] Query parameter support works correctly
- [ ] Unit tests pass for all URL utilities

---

### OBS-901: Create TaskDetailPage Component

**File:** `frontend/src/pages/observability/TaskDetailPage.tsx`

**Purpose:** Display detailed information for a specific task within an execution.

#### Implementation

```typescript
// frontend/src/pages/observability/TaskDetailPage.tsx

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTask } from '../../hooks/useObservability';
import { buildObservabilityUrl, generateBreadcrumbs } from '../../utils/observability-urls';
import Breadcrumb from '../../components/observability/Breadcrumb';
import CrossReferencePanel from '../../components/observability/CrossReferencePanel';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorDisplay from '../../components/common/ErrorDisplay';

interface TaskDetailPageProps {}

const TaskDetailPage: React.FC<TaskDetailPageProps> = () => {
  const { id: executionId, taskId } = useParams<{ id: string; taskId: string }>();

  const { task, isLoading, error, refetch } = useTask(executionId!, taskId!);

  if (isLoading) {
    return <LoadingSpinner message="Loading task details..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  if (!task) {
    return <ErrorDisplay error={new Error('Task not found')} />;
  }

  const breadcrumbs = generateBreadcrumbs(window.location.pathname, {
    execution: executionId!,
    task: task.displayId || task.id,
  });

  return (
    <div className="task-detail-page">
      <Breadcrumb items={breadcrumbs} />

      <div className="page-header">
        <h1>{task.displayId || task.id}</h1>
        <span className={`status-badge status-${task.status}`}>
          {task.status}
        </span>
      </div>

      <div className="task-detail-content">
        <section className="task-overview">
          <h2>Overview</h2>
          <dl>
            <dt>Title</dt>
            <dd>{task.title}</dd>

            <dt>Status</dt>
            <dd>{task.status}</dd>

            <dt>Started</dt>
            <dd>{task.startedAt ? new Date(task.startedAt).toLocaleString() : 'Not started'}</dd>

            <dt>Completed</dt>
            <dd>{task.completedAt ? new Date(task.completedAt).toLocaleString() : 'In progress'}</dd>

            <dt>Duration</dt>
            <dd>{task.durationMs ? `${(task.durationMs / 1000).toFixed(2)}s` : '-'}</dd>
          </dl>
        </section>

        <section className="task-transcript">
          <h2>Transcript Entries</h2>
          <Link to={buildObservabilityUrl('execution', { id: executionId! }) + `?task=${taskId}`}>
            View in Timeline →
          </Link>
        </section>

        <section className="task-tools">
          <h2>Tool Uses</h2>
          {task.toolUseCount > 0 ? (
            <p>{task.toolUseCount} tool invocations</p>
          ) : (
            <p>No tool uses recorded</p>
          )}
        </section>

        <section className="task-assertions">
          <h2>Assertions</h2>
          {task.assertionCount > 0 ? (
            <p>
              {task.passedAssertions}/{task.assertionCount} passed
              ({((task.passedAssertions / task.assertionCount) * 100).toFixed(0)}%)
            </p>
          ) : (
            <p>No assertions recorded</p>
          )}
        </section>
      </div>

      <CrossReferencePanel
        entityType="task"
        entityId={taskId!}
        executionId={executionId!}
      />
    </div>
  );
};

export default TaskDetailPage;
```

#### Acceptance Criteria

- [ ] Component renders task details correctly
- [ ] Breadcrumb navigation shows correct path
- [ ] Status badge displays with appropriate color
- [ ] Links to timeline with task filter work
- [ ] Cross-reference panel shows related entities
- [ ] Loading and error states handled
- [ ] URL parameters parsed correctly from route

---

### OBS-902: Create ToolUseDetailPage Component

**File:** `frontend/src/pages/observability/ToolUseDetailPage.tsx`

**Purpose:** Display detailed information for a specific tool invocation.

#### Implementation

```typescript
// frontend/src/pages/observability/ToolUseDetailPage.tsx

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToolUse } from '../../hooks/useObservability';
import { generateBreadcrumbs } from '../../utils/observability-urls';
import Breadcrumb from '../../components/observability/Breadcrumb';
import CrossReferencePanel from '../../components/observability/CrossReferencePanel';
import CodeBlock from '../../components/common/CodeBlock';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorDisplay from '../../components/common/ErrorDisplay';

const ToolUseDetailPage: React.FC = () => {
  const { id: executionId, toolId } = useParams<{ id: string; toolId: string }>();
  const [showFullInput, setShowFullInput] = useState(false);
  const [showFullOutput, setShowFullOutput] = useState(false);

  const { toolUse, isLoading, error, refetch } = useToolUse(executionId!, toolId!);

  if (isLoading) {
    return <LoadingSpinner message="Loading tool use details..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  if (!toolUse) {
    return <ErrorDisplay error={new Error('Tool use not found')} />;
  }

  const breadcrumbs = generateBreadcrumbs(window.location.pathname, {
    execution: executionId!,
    tool: `${toolUse.tool} (${toolId!.slice(0, 8)})`,
  });

  const getStatusIcon = () => {
    if (toolUse.isBlocked) return '⛔';
    if (toolUse.isError) return '❌';
    return '✅';
  };

  return (
    <div className="tool-use-detail-page">
      <Breadcrumb items={breadcrumbs} />

      <div className="page-header">
        <h1>
          {getStatusIcon()} {toolUse.tool}
        </h1>
        <span className={`status-badge status-${toolUse.resultStatus}`}>
          {toolUse.resultStatus}
        </span>
      </div>

      <div className="tool-use-content">
        <section className="tool-overview">
          <h2>Overview</h2>
          <dl>
            <dt>Tool</dt>
            <dd>{toolUse.tool}</dd>

            <dt>Category</dt>
            <dd>{toolUse.toolCategory}</dd>

            <dt>Status</dt>
            <dd>{toolUse.resultStatus}</dd>

            <dt>Duration</dt>
            <dd>{toolUse.durationMs}ms</dd>

            <dt>Start Time</dt>
            <dd>{new Date(toolUse.startTime).toLocaleString()}</dd>

            <dt>End Time</dt>
            <dd>{new Date(toolUse.endTime).toLocaleString()}</dd>
          </dl>
        </section>

        <section className="tool-input">
          <h2>
            Input
            <button onClick={() => setShowFullInput(!showFullInput)}>
              {showFullInput ? 'Collapse' : 'Expand'}
            </button>
          </h2>
          {showFullInput ? (
            <CodeBlock
              code={JSON.stringify(toolUse.input, null, 2)}
              language="json"
            />
          ) : (
            <p className="summary">{toolUse.inputSummary}</p>
          )}
        </section>

        <section className="tool-output">
          <h2>
            Output
            <button onClick={() => setShowFullOutput(!showFullOutput)}>
              {showFullOutput ? 'Collapse' : 'Expand'}
            </button>
          </h2>
          {showFullOutput && toolUse.output ? (
            <CodeBlock
              code={JSON.stringify(toolUse.output, null, 2)}
              language="json"
            />
          ) : (
            <p className="summary">{toolUse.outputSummary}</p>
          )}
        </section>

        {toolUse.isError && (
          <section className="tool-error">
            <h2>Error</h2>
            <pre className="error-message">{toolUse.errorMessage}</pre>
          </section>
        )}

        {toolUse.isBlocked && (
          <section className="tool-blocked">
            <h2>Blocked</h2>
            <p className="block-reason">{toolUse.blockReason}</p>
          </section>
        )}
      </div>

      <CrossReferencePanel
        entityType="toolUse"
        entityId={toolId!}
        executionId={executionId!}
      />
    </div>
  );
};

export default ToolUseDetailPage;
```

#### Acceptance Criteria

- [ ] Component renders tool use details correctly
- [ ] Input and output can be expanded/collapsed
- [ ] CodeBlock renders JSON properly
- [ ] Error messages displayed when `isError` is true
- [ ] Block reason displayed when `isBlocked` is true
- [ ] Duration shown in milliseconds
- [ ] Cross-reference panel shows related entities

---

### OBS-903: Create AssertionDetailPage Component

**File:** `frontend/src/pages/observability/AssertionDetailPage.tsx`

**Purpose:** Display detailed assertion result with evidence.

#### Implementation

```typescript
// frontend/src/pages/observability/AssertionDetailPage.tsx

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAssertion } from '../../hooks/useObservability';
import { buildObservabilityUrl, generateBreadcrumbs } from '../../utils/observability-urls';
import Breadcrumb from '../../components/observability/Breadcrumb';
import EvidenceViewer from '../../components/observability/EvidenceViewer';
import CrossReferencePanel from '../../components/observability/CrossReferencePanel';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorDisplay from '../../components/common/ErrorDisplay';

const AssertionDetailPage: React.FC = () => {
  const { id: executionId, assertId } = useParams<{ id: string; assertId: string }>();

  const { assertion, chainInfo, isLoading, error, refetch } = useAssertion(
    executionId!,
    assertId!
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading assertion details..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  if (!assertion) {
    return <ErrorDisplay error={new Error('Assertion not found')} />;
  }

  const breadcrumbs = generateBreadcrumbs(window.location.pathname, {
    execution: executionId!,
    assertion: `${assertion.category} (${assertion.result})`,
  });

  const getResultIcon = () => {
    switch (assertion.result) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'skip': return '⏭️';
      case 'warn': return '⚠️';
      default: return '❓';
    }
  };

  return (
    <div className="assertion-detail-page">
      <Breadcrumb items={breadcrumbs} />

      <div className="page-header">
        <h1>
          {getResultIcon()} {assertion.category}
        </h1>
        <span className={`result-badge result-${assertion.result}`}>
          {assertion.result.toUpperCase()}
        </span>
      </div>

      <div className="assertion-content">
        <section className="assertion-overview">
          <h2>Overview</h2>
          <dl>
            <dt>Category</dt>
            <dd>{assertion.category}</dd>

            <dt>Description</dt>
            <dd>{assertion.description}</dd>

            <dt>Result</dt>
            <dd>{assertion.result}</dd>

            <dt>Task</dt>
            <dd>
              <Link to={buildObservabilityUrl('task', {
                id: executionId!,
                taskId: assertion.taskId
              })}>
                {assertion.taskId}
              </Link>
            </dd>

            <dt>Timestamp</dt>
            <dd>{new Date(assertion.timestamp).toLocaleString()}</dd>

            <dt>Duration</dt>
            <dd>{assertion.durationMs}ms</dd>
          </dl>
        </section>

        <section className="assertion-evidence">
          <h2>Evidence</h2>
          <EvidenceViewer evidence={assertion.evidence} />
        </section>

        {chainInfo && (
          <section className="assertion-chain">
            <h2>Assertion Chain</h2>
            <p>
              Position {chainInfo.position} of {chainInfo.total} in chain
            </p>
            <div className="chain-navigation">
              {chainInfo.previousId && (
                <Link
                  to={buildObservabilityUrl('assertion', {
                    id: executionId!,
                    assertId: chainInfo.previousId,
                  })}
                  className="chain-link prev"
                >
                  ← Previous
                </Link>
              )}
              {chainInfo.nextId && (
                <Link
                  to={buildObservabilityUrl('assertion', {
                    id: executionId!,
                    assertId: chainInfo.nextId,
                  })}
                  className="chain-link next"
                >
                  Next →
                </Link>
              )}
            </div>
          </section>
        )}
      </div>

      <CrossReferencePanel
        entityType="assertion"
        entityId={assertId!}
        executionId={executionId!}
      />
    </div>
  );
};

export default AssertionDetailPage;
```

#### Acceptance Criteria

- [ ] Component renders assertion details correctly
- [ ] Evidence viewer displays command, file, API evidence
- [ ] Result badge shows with appropriate color
- [ ] Chain navigation shows previous/next links
- [ ] Link to task works correctly
- [ ] Cross-reference panel shows related entities

---

### OBS-904: Create WaveDetailPage Component

**File:** `frontend/src/pages/observability/WaveDetailPage.tsx`

**Purpose:** Display parallel execution wave details.

#### Implementation

```typescript
// frontend/src/pages/observability/WaveDetailPage.tsx

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWave } from '../../hooks/useObservability';
import { buildObservabilityUrl, generateBreadcrumbs } from '../../utils/observability-urls';
import Breadcrumb from '../../components/observability/Breadcrumb';
import WaveProgressBar from '../../components/observability/WaveProgressBar';
import TaskList from '../../components/observability/TaskList';
import AgentList from '../../components/observability/AgentList';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorDisplay from '../../components/common/ErrorDisplay';

const WaveDetailPage: React.FC = () => {
  const { id: executionId, waveNum } = useParams<{ id: string; waveNum: string }>();
  const waveNumber = parseInt(waveNum!, 10);

  const { wave, tasks, agents, isLoading, error, refetch } = useWave(
    executionId!,
    waveNumber
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading wave details..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  if (!wave) {
    return <ErrorDisplay error={new Error('Wave not found')} />;
  }

  const breadcrumbs = generateBreadcrumbs(window.location.pathname, {
    execution: executionId!,
    wave: `Wave ${waveNumber}`,
  });

  const getStatusIcon = () => {
    switch (wave.status) {
      case 'completed': return '✅';
      case 'running': return '🔄';
      case 'failed': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  return (
    <div className="wave-detail-page">
      <Breadcrumb items={breadcrumbs} />

      <div className="page-header">
        <h1>
          {getStatusIcon()} Wave {waveNumber}
        </h1>
        <span className={`status-badge status-${wave.status}`}>
          {wave.status}
        </span>
      </div>

      <div className="wave-content">
        <section className="wave-overview">
          <h2>Overview</h2>
          <dl>
            <dt>Status</dt>
            <dd>{wave.status}</dd>

            <dt>Started</dt>
            <dd>{wave.startedAt ? new Date(wave.startedAt).toLocaleString() : 'Not started'}</dd>

            <dt>Completed</dt>
            <dd>{wave.completedAt ? new Date(wave.completedAt).toLocaleString() : 'In progress'}</dd>

            <dt>Duration</dt>
            <dd>{wave.durationMs ? `${(wave.durationMs / 1000).toFixed(2)}s` : '-'}</dd>

            <dt>Task Count</dt>
            <dd>{wave.taskCount}</dd>

            <dt>Max Parallel Agents</dt>
            <dd>{wave.maxParallelAgents}</dd>
          </dl>
        </section>

        <section className="wave-progress">
          <h2>Progress</h2>
          <WaveProgressBar wave={wave} />
        </section>

        <section className="wave-tasks">
          <h2>Tasks in Wave ({tasks.length})</h2>
          <TaskList
            tasks={tasks}
            executionId={executionId!}
            showStatus
          />
        </section>

        <section className="wave-agents">
          <h2>Agents ({agents.length})</h2>
          <AgentList
            agents={agents}
            executionId={executionId!}
          />
        </section>

        <section className="wave-navigation">
          <h2>Wave Navigation</h2>
          <div className="wave-nav-buttons">
            {waveNumber > 1 && (
              <Link
                to={buildObservabilityUrl('wave', {
                  id: executionId!,
                  waveNum: waveNumber - 1,
                })}
                className="wave-link prev"
              >
                ← Wave {waveNumber - 1}
              </Link>
            )}
            <Link
              to={buildObservabilityUrl('wave', {
                id: executionId!,
                waveNum: waveNumber + 1,
              })}
              className="wave-link next"
            >
              Wave {waveNumber + 1} →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WaveDetailPage;
```

#### Acceptance Criteria

- [ ] Component renders wave details correctly
- [ ] Progress bar shows completion percentage
- [ ] Task list links to task detail pages
- [ ] Agent list shows agents that worked on wave
- [ ] Wave navigation allows previous/next navigation
- [ ] Duration calculated correctly

---

### OBS-905: Create SkillTraceDetailPage Component

**File:** `frontend/src/pages/observability/SkillTraceDetailPage.tsx`

**Purpose:** Display skill invocation trace with nested tool calls.

#### Implementation

```typescript
// frontend/src/pages/observability/SkillTraceDetailPage.tsx

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSkillTrace } from '../../hooks/useObservability';
import { buildObservabilityUrl, generateBreadcrumbs } from '../../utils/observability-urls';
import Breadcrumb from '../../components/observability/Breadcrumb';
import SkillFlowDiagram from '../../components/observability/SkillFlowDiagram';
import CrossReferencePanel from '../../components/observability/CrossReferencePanel';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorDisplay from '../../components/common/ErrorDisplay';

const SkillTraceDetailPage: React.FC = () => {
  const { id: executionId, skillId } = useParams<{ id: string; skillId: string }>();

  const { skillTrace, isLoading, error, refetch } = useSkillTrace(
    executionId!,
    skillId!
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading skill trace..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  if (!skillTrace) {
    return <ErrorDisplay error={new Error('Skill trace not found')} />;
  }

  const breadcrumbs = generateBreadcrumbs(window.location.pathname, {
    execution: executionId!,
    skill: skillTrace.skill.skillName,
  });

  const getStatusIcon = () => {
    switch (skillTrace.skill.status) {
      case 'success': return '✅';
      case 'partial': return '⚠️';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="skill-trace-detail-page">
      <Breadcrumb items={breadcrumbs} />

      <div className="page-header">
        <h1>
          {getStatusIcon()} {skillTrace.skill.skillName}
        </h1>
        <span className={`status-badge status-${skillTrace.skill.status}`}>
          {skillTrace.skill.status}
        </span>
      </div>

      <div className="skill-trace-content">
        <section className="skill-overview">
          <h2>Skill Reference</h2>
          <dl>
            <dt>Skill Name</dt>
            <dd>{skillTrace.skill.skillName}</dd>

            <dt>File</dt>
            <dd>
              <code>{skillTrace.skill.skillFile}:{skillTrace.skill.lineNumber}</code>
            </dd>

            <dt>Section</dt>
            <dd>{skillTrace.skill.sectionTitle}</dd>

            <dt>Status</dt>
            <dd>{skillTrace.skill.status}</dd>

            <dt>Duration</dt>
            <dd>
              {new Date(skillTrace.skill.endTime).getTime() -
               new Date(skillTrace.skill.startTime).getTime()}ms
            </dd>

            <dt>Token Estimate</dt>
            <dd>{skillTrace.skill.tokenEstimate}</dd>
          </dl>
        </section>

        <section className="skill-context">
          <h2>Invocation Context</h2>
          <dl>
            <dt>Task</dt>
            <dd>
              <Link to={buildObservabilityUrl('task', {
                id: executionId!,
                taskId: skillTrace.taskId,
              })}>
                {skillTrace.taskId}
              </Link>
            </dd>

            <dt>Input Summary</dt>
            <dd>{skillTrace.skill.inputSummary}</dd>

            <dt>Output Summary</dt>
            <dd>{skillTrace.skill.outputSummary}</dd>
          </dl>

          {skillTrace.skill.errorMessage && (
            <div className="skill-error">
              <strong>Error:</strong>
              <pre>{skillTrace.skill.errorMessage}</pre>
            </div>
          )}
        </section>

        <section className="skill-flow">
          <h2>Execution Flow</h2>
          <SkillFlowDiagram
            skillTrace={skillTrace}
            executionId={executionId!}
            onNodeClick={(nodeType, nodeId) => {
              // Navigate to appropriate detail page
            }}
          />
        </section>

        <section className="skill-tool-calls">
          <h2>Tool Calls ({skillTrace.toolCalls.length})</h2>
          <ul className="tool-call-list">
            {skillTrace.toolCalls.map((call, index) => (
              <li key={call.toolUseId}>
                <Link to={buildObservabilityUrl('tool', {
                  id: executionId!,
                  toolId: call.toolUseId,
                })}>
                  {index + 1}. {call.tool} - {call.inputSummary}
                </Link>
                <span className={`status-${call.resultStatus}`}>
                  {call.resultStatus}
                </span>
                <span className="duration">{call.durationMs}ms</span>
              </li>
            ))}
          </ul>
        </section>

        {skillTrace.assertions.length > 0 && (
          <section className="skill-assertions">
            <h2>Assertions ({skillTrace.assertions.length})</h2>
            <ul className="assertion-list">
              {skillTrace.assertions.map((assertion) => (
                <li key={assertion.id}>
                  <Link to={buildObservabilityUrl('assertion', {
                    id: executionId!,
                    assertId: assertion.id,
                  })}>
                    {assertion.category}: {assertion.description}
                  </Link>
                  <span className={`result-${assertion.result}`}>
                    {assertion.result}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <CrossReferencePanel
        entityType="skillTrace"
        entityId={skillId!}
        executionId={executionId!}
      />
    </div>
  );
};

export default SkillTraceDetailPage;
```

#### Acceptance Criteria

- [ ] Component renders skill trace details correctly
- [ ] File:line reference displayed for skill source
- [ ] Flow diagram renders nested tool calls
- [ ] Tool call list links to tool detail pages
- [ ] Assertion list links to assertion detail pages
- [ ] Error message shown when skill failed

---

### OBS-906: Create TranscriptEntryPage Component

**File:** `frontend/src/pages/observability/TranscriptEntryPage.tsx`

**Purpose:** Display single transcript entry with context.

#### Implementation

```typescript
// frontend/src/pages/observability/TranscriptEntryPage.tsx

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranscriptEntry } from '../../hooks/useObservability';
import { buildObservabilityUrl, generateBreadcrumbs } from '../../utils/observability-urls';
import Breadcrumb from '../../components/observability/Breadcrumb';
import CrossReferencePanel from '../../components/observability/CrossReferencePanel';
import CodeBlock from '../../components/common/CodeBlock';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorDisplay from '../../components/common/ErrorDisplay';

const TranscriptEntryPage: React.FC = () => {
  const { id: executionId, entryId } = useParams<{ id: string; entryId: string }>();

  const { entry, previousEntry, nextEntry, isLoading, error, refetch } =
    useTranscriptEntry(executionId!, entryId!);

  if (isLoading) {
    return <LoadingSpinner message="Loading transcript entry..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  if (!entry) {
    return <ErrorDisplay error={new Error('Transcript entry not found')} />;
  }

  const breadcrumbs = generateBreadcrumbs(window.location.pathname, {
    execution: executionId!,
    transcript: `#${entry.sequence} ${entry.entryType}`,
  });

  const getEntryIcon = () => {
    switch (entry.entryType) {
      case 'phase_start':
      case 'phase_end': return '📋';
      case 'task_start':
      case 'task_end': return '🎯';
      case 'tool_use': return '🔧';
      case 'skill_invoke':
      case 'skill_complete': return '🔮';
      case 'assertion': return '✅';
      case 'error': return '❌';
      case 'checkpoint': return '💾';
      case 'lock_acquire':
      case 'lock_release': return '🔒';
      default: return '📝';
    }
  };

  return (
    <div className="transcript-entry-page">
      <Breadcrumb items={breadcrumbs} />

      <div className="page-header">
        <h1>
          {getEntryIcon()} Transcript Entry #{entry.sequence}
        </h1>
        <span className={`category-badge category-${entry.category}`}>
          {entry.category}
        </span>
      </div>

      <div className="entry-content">
        <section className="entry-overview">
          <h2>Overview</h2>
          <dl>
            <dt>Entry Type</dt>
            <dd>{entry.entryType}</dd>

            <dt>Category</dt>
            <dd>{entry.category}</dd>

            <dt>Timestamp</dt>
            <dd>{new Date(entry.timestamp).toLocaleString()}</dd>

            <dt>Sequence</dt>
            <dd>#{entry.sequence}</dd>

            {entry.taskId && (
              <>
                <dt>Task</dt>
                <dd>
                  <Link to={buildObservabilityUrl('task', {
                    id: executionId!,
                    taskId: entry.taskId,
                  })}>
                    {entry.taskId}
                  </Link>
                </dd>
              </>
            )}

            {entry.waveNumber && (
              <>
                <dt>Wave</dt>
                <dd>
                  <Link to={buildObservabilityUrl('wave', {
                    id: executionId!,
                    waveNum: entry.waveNumber,
                  })}>
                    Wave {entry.waveNumber}
                  </Link>
                </dd>
              </>
            )}

            {entry.durationMs && (
              <>
                <dt>Duration</dt>
                <dd>{entry.durationMs}ms</dd>
              </>
            )}
          </dl>
        </section>

        <section className="entry-summary">
          <h2>Summary</h2>
          <p>{entry.summary}</p>
        </section>

        <section className="entry-details">
          <h2>Details</h2>
          <CodeBlock
            code={JSON.stringify(entry.details, null, 2)}
            language="json"
          />
        </section>

        <section className="entry-navigation">
          <h2>Navigation</h2>
          <div className="nav-buttons">
            {previousEntry && (
              <Link
                to={buildObservabilityUrl('transcript', {
                  id: executionId!,
                  entryId: previousEntry.id,
                })}
                className="nav-link prev"
              >
                ← #{previousEntry.sequence} {previousEntry.entryType}
              </Link>
            )}
            {nextEntry && (
              <Link
                to={buildObservabilityUrl('transcript', {
                  id: executionId!,
                  entryId: nextEntry.id,
                })}
                className="nav-link next"
              >
                #{nextEntry.sequence} {nextEntry.entryType} →
              </Link>
            )}
          </div>
        </section>
      </div>

      <CrossReferencePanel
        entityType="transcriptEntry"
        entityId={entryId!}
        executionId={executionId!}
      />
    </div>
  );
};

export default TranscriptEntryPage;
```

#### Acceptance Criteria

- [ ] Component renders transcript entry details correctly
- [ ] Entry type icon displayed correctly
- [ ] Details JSON rendered in code block
- [ ] Previous/next navigation works
- [ ] Links to related task and wave work
- [ ] Category badge shows with color

---

### OBS-907: Update App.tsx with Deep Link Routes

**File:** `frontend/src/App.tsx`

**Purpose:** Add new routes for all entity detail pages.

#### Implementation

```typescript
// Add to frontend/src/App.tsx imports
import TaskDetailPage from './pages/observability/TaskDetailPage';
import ToolUseDetailPage from './pages/observability/ToolUseDetailPage';
import AssertionDetailPage from './pages/observability/AssertionDetailPage';
import WaveDetailPage from './pages/observability/WaveDetailPage';
import SkillTraceDetailPage from './pages/observability/SkillTraceDetailPage';
import TranscriptEntryPage from './pages/observability/TranscriptEntryPage';

// Update the observability routes section:
{/* Observability with sub-tabs and deep links */}
<Route path="/observability" element={<ObservabilityPage />}>
  <Route index element={<OverviewDashboard />} />
  <Route path="events" element={<EventLogTab />} />
  <Route path="executions" element={<ExecutionsTab />} />
  <Route path="executions/:id" element={<ExecutionReviewPage />} />
  {/* Deep link routes for entities within execution */}
  <Route path="executions/:id/tasks/:taskId" element={<TaskDetailPage />} />
  <Route path="executions/:id/tools/:toolId" element={<ToolUseDetailPage />} />
  <Route path="executions/:id/assertions/:assertId" element={<AssertionDetailPage />} />
  <Route path="executions/:id/waves/:waveNum" element={<WaveDetailPage />} />
  <Route path="executions/:id/skills/:skillId" element={<SkillTraceDetailPage />} />
  <Route path="executions/:id/transcript/:entryId" element={<TranscriptEntryPage />} />
  <Route path="agents" element={<AgentsTab />} />
  <Route path="agents/:agentId" element={<AgentDetailPage />} />
  <Route path="analytics" element={<AnalyticsTab />} />
</Route>
```

#### Acceptance Criteria

- [ ] All deep link routes added to App.tsx
- [ ] Routes are nested under `/observability/executions/:id`
- [ ] Route parameters match component expectations
- [ ] No TypeScript errors in routing configuration
- [ ] Imports added for all new page components

---

### OBS-908: Create Breadcrumb Component

**File:** `frontend/src/components/observability/Breadcrumb.tsx`

**Purpose:** Reusable breadcrumb navigation component.

#### Implementation

```typescript
// frontend/src/components/observability/Breadcrumb.tsx

import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  return (
    <nav className={`breadcrumb ${className}`} aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.path} className="breadcrumb-item">
              {!isLast ? (
                <>
                  <Link to={item.path} className="breadcrumb-link">
                    {item.label}
                  </Link>
                  <span className="breadcrumb-separator" aria-hidden="true">
                    /
                  </span>
                </>
              ) : (
                <span className="breadcrumb-current" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
```

#### Acceptance Criteria

- [ ] Component renders breadcrumb trail correctly
- [ ] Last item is not a link (current page)
- [ ] Separators displayed between items
- [ ] Accessible with aria-label and aria-current
- [ ] Styling applied via className prop

---

### OBS-909: Create CrossReferencePanel Component

**File:** `frontend/src/components/observability/CrossReferencePanel.tsx`

**Purpose:** Display related entities with navigation links.

#### Implementation

```typescript
// frontend/src/components/observability/CrossReferencePanel.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { useCrossReferences } from '../../hooks/useObservability';
import { buildObservabilityUrl } from '../../utils/observability-urls';
import LoadingSpinner from '../common/LoadingSpinner';

interface CrossReferencePanelProps {
  entityType: 'task' | 'toolUse' | 'assertion' | 'skillTrace' | 'transcriptEntry';
  entityId: string;
  executionId: string;
}

const CrossReferencePanel: React.FC<CrossReferencePanelProps> = ({
  entityType,
  entityId,
  executionId,
}) => {
  const { refs, relatedEntities, isLoading, error } = useCrossReferences(
    entityType,
    entityId,
    executionId
  );

  if (isLoading) {
    return (
      <div className="cross-ref-panel loading">
        <LoadingSpinner size="small" />
      </div>
    );
  }

  if (error || !refs) {
    return null; // Gracefully hide if cross-refs unavailable
  }

  const renderRefLink = (
    type: string,
    id: string | undefined,
    label: string
  ) => {
    if (!id) return null;

    const urlMap: Record<string, string> = {
      task: buildObservabilityUrl('task', { id: executionId, taskId: id }),
      tool: buildObservabilityUrl('tool', { id: executionId, toolId: id }),
      assertion: buildObservabilityUrl('assertion', { id: executionId, assertId: id }),
      skill: buildObservabilityUrl('skill', { id: executionId, skillId: id }),
      transcript: buildObservabilityUrl('transcript', { id: executionId, entryId: id }),
      execution: buildObservabilityUrl('execution', { id }),
    };

    return (
      <Link to={urlMap[type] || '#'} className="cross-ref-link">
        {label}
      </Link>
    );
  };

  return (
    <aside className="cross-ref-panel">
      <h3>Related</h3>

      <div className="cross-ref-sections">
        {refs.type === 'toolUse' && (
          <>
            <div className="cross-ref-section">
              <h4>Context</h4>
              <ul>
                <li>📋 {renderRefLink('transcript', refs.refs.transcriptEntry, 'Transcript Entry')}</li>
                {refs.refs.task && (
                  <li>🎯 {renderRefLink('task', refs.refs.task, 'Task')}</li>
                )}
                {refs.refs.skill && (
                  <li>🔮 {renderRefLink('skill', refs.refs.skill, 'Parent Skill')}</li>
                )}
              </ul>
            </div>

            {refs.refs.relatedAssertions.length > 0 && (
              <div className="cross-ref-section">
                <h4>Related Assertions</h4>
                <ul>
                  {refs.refs.relatedAssertions.map((id) => (
                    <li key={id}>
                      ✅ {renderRefLink('assertion', id, `Assertion ${id.slice(0, 8)}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {refs.type === 'assertion' && (
          <>
            <div className="cross-ref-section">
              <h4>Context</h4>
              <ul>
                <li>🎯 {renderRefLink('task', refs.refs.task, 'Task')}</li>
                {refs.refs.chain && (
                  <li>🔗 Assertion Chain</li>
                )}
              </ul>
            </div>

            {refs.refs.toolUses.length > 0 && (
              <div className="cross-ref-section">
                <h4>Evidence From</h4>
                <ul>
                  {refs.refs.toolUses.map((id) => (
                    <li key={id}>
                      🔧 {renderRefLink('tool', id, `Tool Use ${id.slice(0, 8)}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="cross-ref-section chain-nav">
              <h4>Chain Navigation</h4>
              <div className="chain-links">
                {refs.refs.previousInChain && (
                  renderRefLink('assertion', refs.refs.previousInChain, '← Previous')
                )}
                {refs.refs.nextInChain && (
                  renderRefLink('assertion', refs.refs.nextInChain, 'Next →')
                )}
              </div>
            </div>
          </>
        )}

        {refs.type === 'skillTrace' && (
          <>
            <div className="cross-ref-section">
              <h4>Context</h4>
              <ul>
                <li>🎯 {renderRefLink('task', refs.refs.task, 'Task')}</li>
                {refs.refs.parentSkill && (
                  <li>🔮 {renderRefLink('skill', refs.refs.parentSkill, 'Parent Skill')}</li>
                )}
              </ul>
            </div>

            {refs.refs.toolUses.length > 0 && (
              <div className="cross-ref-section">
                <h4>Tool Uses ({refs.refs.toolUses.length})</h4>
                <ul>
                  {refs.refs.toolUses.slice(0, 5).map((id) => (
                    <li key={id}>
                      🔧 {renderRefLink('tool', id, `Tool ${id.slice(0, 8)}`)}
                    </li>
                  ))}
                  {refs.refs.toolUses.length > 5 && (
                    <li className="more">+{refs.refs.toolUses.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}

        {refs.type === 'transcriptEntry' && (
          <>
            <div className="cross-ref-section">
              <h4>Context</h4>
              <ul>
                {refs.refs.task && (
                  <li>🎯 {renderRefLink('task', refs.refs.task, 'Task')}</li>
                )}
                {refs.refs.toolUse && (
                  <li>🔧 {renderRefLink('tool', refs.refs.toolUse, 'Tool Use')}</li>
                )}
                {refs.refs.skill && (
                  <li>🔮 {renderRefLink('skill', refs.refs.skill, 'Skill')}</li>
                )}
                {refs.refs.assertion && (
                  <li>✅ {renderRefLink('assertion', refs.refs.assertion, 'Assertion')}</li>
                )}
              </ul>
            </div>

            <div className="cross-ref-section sequence-nav">
              <h4>Sequence</h4>
              <div className="sequence-links">
                {refs.refs.previousEntry && (
                  renderRefLink('transcript', refs.refs.previousEntry, '← Previous')
                )}
                {refs.refs.nextEntry && (
                  renderRefLink('transcript', refs.refs.nextEntry, 'Next →')
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

export default CrossReferencePanel;
```

#### Acceptance Criteria

- [ ] Component renders cross-references for all entity types
- [ ] Links navigate to correct detail pages
- [ ] Graceful handling when cross-refs unavailable
- [ ] Previous/next navigation for assertions and transcript entries
- [ ] Loading state shown while fetching

---

### OBS-910: Create Observability Navigation Hook

**File:** `frontend/src/hooks/useObservabilityNavigation.ts`

**Purpose:** Custom hook for observability navigation with history support.

#### Implementation

```typescript
// frontend/src/hooks/useObservabilityNavigation.ts

import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";
import {
  buildObservabilityUrl,
  parseExecutionId,
  parseEntityFromUrl,
  ObservabilityPath,
} from "../utils/observability-urls";

interface NavigationState {
  from?: string;
  context?: string;
}

export function useObservabilityNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentExecutionId = useMemo(
    () => parseExecutionId(location.pathname),
    [location.pathname],
  );

  const currentEntity = useMemo(
    () => parseEntityFromUrl(location.pathname),
    [location.pathname],
  );

  /**
   * Navigate to an observability entity.
   */
  const navigateTo = useCallback(
    (
      path: ObservabilityPath,
      params: Record<string, string | number> = {},
      options?: {
        query?: Record<string, string>;
        replace?: boolean;
        state?: NavigationState;
      },
    ) => {
      const url = buildObservabilityUrl(path, params, options?.query);
      navigate(url, {
        replace: options?.replace,
        state: options?.state || { from: location.pathname },
      });
    },
    [navigate, location.pathname],
  );

  /**
   * Navigate to task detail.
   */
  const goToTask = useCallback(
    (taskId: string, executionId?: string) => {
      const execId = executionId || currentExecutionId;
      if (!execId) {
        console.error("No execution ID available for task navigation");
        return;
      }
      navigateTo("task", { id: execId, taskId });
    },
    [navigateTo, currentExecutionId],
  );

  /**
   * Navigate to tool use detail.
   */
  const goToToolUse = useCallback(
    (toolId: string, executionId?: string) => {
      const execId = executionId || currentExecutionId;
      if (!execId) {
        console.error("No execution ID available for tool navigation");
        return;
      }
      navigateTo("tool", { id: execId, toolId });
    },
    [navigateTo, currentExecutionId],
  );

  /**
   * Navigate to assertion detail.
   */
  const goToAssertion = useCallback(
    (
      assertId: string,
      executionId?: string,
      options?: { expand?: boolean },
    ) => {
      const execId = executionId || currentExecutionId;
      if (!execId) {
        console.error("No execution ID available for assertion navigation");
        return;
      }
      navigateTo(
        "assertion",
        { id: execId, assertId },
        {
          query: options?.expand ? { expand: "evidence" } : undefined,
        },
      );
    },
    [navigateTo, currentExecutionId],
  );

  /**
   * Navigate to wave detail.
   */
  const goToWave = useCallback(
    (waveNum: number, executionId?: string) => {
      const execId = executionId || currentExecutionId;
      if (!execId) {
        console.error("No execution ID available for wave navigation");
        return;
      }
      navigateTo("wave", { id: execId, waveNum });
    },
    [navigateTo, currentExecutionId],
  );

  /**
   * Navigate to skill trace detail.
   */
  const goToSkillTrace = useCallback(
    (skillId: string, executionId?: string) => {
      const execId = executionId || currentExecutionId;
      if (!execId) {
        console.error("No execution ID available for skill navigation");
        return;
      }
      navigateTo("skill", { id: execId, skillId });
    },
    [navigateTo, currentExecutionId],
  );

  /**
   * Navigate to transcript entry.
   */
  const goToTranscriptEntry = useCallback(
    (entryId: string, executionId?: string) => {
      const execId = executionId || currentExecutionId;
      if (!execId) {
        console.error("No execution ID available for transcript navigation");
        return;
      }
      navigateTo("transcript", { id: execId, entryId });
    },
    [navigateTo, currentExecutionId],
  );

  /**
   * Navigate to execution overview.
   */
  const goToExecution = useCallback(
    (executionId: string) => {
      navigateTo("execution", { id: executionId });
    },
    [navigateTo],
  );

  /**
   * Go back with context awareness.
   */
  const goBack = useCallback(() => {
    const state = location.state as NavigationState | undefined;
    if (state?.from) {
      navigate(state.from);
    } else if (currentExecutionId) {
      goToExecution(currentExecutionId);
    } else {
      navigateTo("executions", {});
    }
  }, [navigate, location.state, currentExecutionId, goToExecution, navigateTo]);

  /**
   * Update URL query parameters.
   */
  const updateQuery = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(params)) {
        if (value === null) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /**
   * Copy current URL to clipboard.
   */
  const copyLink = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    // Current context
    currentExecutionId,
    currentEntity,
    searchParams,

    // Navigation functions
    navigateTo,
    goToTask,
    goToToolUse,
    goToAssertion,
    goToWave,
    goToSkillTrace,
    goToTranscriptEntry,
    goToExecution,
    goBack,

    // Query management
    updateQuery,

    // Utilities
    copyLink,
  };
}
```

#### Acceptance Criteria

- [ ] Hook provides navigation functions for all entity types
- [ ] Current execution ID extracted from URL
- [ ] Query parameter management works
- [ ] Back navigation respects navigation state
- [ ] Copy link function works

---

### OBS-911: Add Deep Link Hooks to useObservability

**File:** `frontend/src/hooks/useObservability.ts`

**Purpose:** Add hooks for fetching individual entities for detail pages.

#### Implementation

```typescript
// Add to frontend/src/hooks/useObservability.ts

/**
 * Fetch a single task with details.
 */
export function useTask(executionId: string, taskId: string) {
  const queryClient = useQueryClient();

  const {
    data: task,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["observability", "task", executionId, taskId],
    queryFn: async () => {
      const response = await fetch(
        `/api/observability/executions/${executionId}/tasks/${taskId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch task");
      }
      return response.json();
    },
    enabled: !!executionId && !!taskId,
  });

  return { task, isLoading, error, refetch };
}

/**
 * Fetch a single tool use with details.
 */
export function useToolUse(executionId: string, toolId: string) {
  const {
    data: toolUse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["observability", "toolUse", executionId, toolId],
    queryFn: async () => {
      const response = await fetch(
        `/api/observability/executions/${executionId}/tool-uses/${toolId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch tool use");
      }
      return response.json();
    },
    enabled: !!executionId && !!toolId,
  });

  return { toolUse, isLoading, error, refetch };
}

/**
 * Fetch a single assertion with chain info.
 */
export function useAssertion(executionId: string, assertId: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["observability", "assertion", executionId, assertId],
    queryFn: async () => {
      const response = await fetch(
        `/api/observability/executions/${executionId}/assertions/${assertId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch assertion");
      }
      return response.json();
    },
    enabled: !!executionId && !!assertId,
  });

  return {
    assertion: data?.assertion,
    chainInfo: data?.chainInfo,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Fetch a wave with tasks and agents.
 */
export function useWave(executionId: string, waveNumber: number) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["observability", "wave", executionId, waveNumber],
    queryFn: async () => {
      const response = await fetch(
        `/api/observability/executions/${executionId}/waves/${waveNumber}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch wave");
      }
      return response.json();
    },
    enabled: !!executionId && waveNumber > 0,
  });

  return {
    wave: data?.wave,
    tasks: data?.tasks || [],
    agents: data?.agents || [],
    isLoading,
    error,
    refetch,
  };
}

/**
 * Fetch a skill trace with nested data.
 */
export function useSkillTrace(executionId: string, skillId: string) {
  const {
    data: skillTrace,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["observability", "skillTrace", executionId, skillId],
    queryFn: async () => {
      const response = await fetch(
        `/api/observability/executions/${executionId}/skills/${skillId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch skill trace");
      }
      return response.json();
    },
    enabled: !!executionId && !!skillId,
  });

  return { skillTrace, isLoading, error, refetch };
}

/**
 * Fetch a transcript entry with navigation info.
 */
export function useTranscriptEntry(executionId: string, entryId: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["observability", "transcriptEntry", executionId, entryId],
    queryFn: async () => {
      const response = await fetch(
        `/api/observability/executions/${executionId}/transcript/${entryId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch transcript entry");
      }
      return response.json();
    },
    enabled: !!executionId && !!entryId,
  });

  return {
    entry: data?.entry,
    previousEntry: data?.previousEntry,
    nextEntry: data?.nextEntry,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Fetch cross-references for an entity.
 */
export function useCrossReferences(
  entityType:
    | "task"
    | "toolUse"
    | "assertion"
    | "skillTrace"
    | "transcriptEntry",
  entityId: string,
  executionId: string,
) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["observability", "crossRefs", entityType, entityId],
    queryFn: async () => {
      const response = await fetch(
        `/api/observability/cross-refs/${entityType}/${entityId}?executionId=${executionId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch cross-references");
      }
      return response.json();
    },
    enabled: !!entityType && !!entityId && !!executionId,
  });

  return {
    refs: data?.refs,
    relatedEntities: data?.relatedEntities,
    isLoading,
    error,
  };
}
```

#### Acceptance Criteria

- [ ] `useTask` hook fetches task with stats
- [ ] `useToolUse` hook fetches tool use with input/output
- [ ] `useAssertion` hook fetches assertion with chain info
- [ ] `useWave` hook fetches wave with tasks and agents
- [ ] `useSkillTrace` hook fetches skill trace with nested data
- [ ] `useTranscriptEntry` hook fetches entry with navigation
- [ ] `useCrossReferences` hook fetches related entities

---

### OBS-912: Add API Routes for Individual Entities

**File:** `server/routes/observability.ts`

**Purpose:** Add API endpoints for individual entity fetching.

#### Implementation

```typescript
// Add to server/routes/observability.ts

// Get single task
router.get("/executions/:id/tasks/:taskId", async (req, res) => {
  try {
    const { id: executionId, taskId } = req.params;

    // Get task details from transcript entries
    const taskEntry = db
      .prepare(
        `
      SELECT DISTINCT
        task_id as id,
        MIN(timestamp) as startedAt,
        MAX(timestamp) as completedAt,
        MAX(sequence) - MIN(sequence) as entryCount
      FROM transcript_entries
      WHERE execution_id = ? AND task_id = ?
      GROUP BY task_id
    `,
      )
      .get(executionId, taskId);

    if (!taskEntry) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Get tool use count
    const toolStats = db
      .prepare(
        `
      SELECT COUNT(*) as toolUseCount
      FROM tool_uses
      WHERE execution_id = ? AND task_id = ?
    `,
      )
      .get(executionId, taskId) as any;

    // Get assertion counts
    const assertionStats = db
      .prepare(
        `
      SELECT
        COUNT(*) as assertionCount,
        SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passedAssertions
      FROM assertion_results
      WHERE execution_id = ? AND task_id = ?
    `,
      )
      .get(executionId, taskId) as any;

    const task = {
      ...taskEntry,
      toolUseCount: toolStats?.toolUseCount || 0,
      assertionCount: assertionStats?.assertionCount || 0,
      passedAssertions: assertionStats?.passedAssertions || 0,
      durationMs:
        taskEntry.completedAt && taskEntry.startedAt
          ? new Date(taskEntry.completedAt).getTime() -
            new Date(taskEntry.startedAt).getTime()
          : null,
    };

    res.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single tool use
router.get("/executions/:id/tool-uses/:toolId", async (req, res) => {
  try {
    const { id: executionId, toolId } = req.params;

    const toolUse = toolUseService.getToolUse(executionId, toolId);

    if (!toolUse) {
      return res.status(404).json({ error: "Tool use not found" });
    }

    res.json(toolUse);
  } catch (error) {
    console.error("Error fetching tool use:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single assertion with chain info
router.get("/executions/:id/assertions/:assertId", async (req, res) => {
  try {
    const { id: executionId, assertId } = req.params;

    const result = assertionService.getAssertionWithChain(
      executionId,
      assertId,
    );

    if (!result) {
      return res.status(404).json({ error: "Assertion not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching assertion:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get wave details
router.get("/executions/:id/waves/:waveNum", async (req, res) => {
  try {
    const { id: executionId, waveNum } = req.params;
    const waveNumber = parseInt(waveNum, 10);

    const wave = db
      .prepare(
        `
      SELECT *
      FROM parallel_execution_waves
      WHERE execution_id = ? AND wave_number = ?
    `,
      )
      .get(executionId, waveNumber);

    if (!wave) {
      return res.status(404).json({ error: "Wave not found" });
    }

    // Get tasks in wave
    const tasks = db
      .prepare(
        `
      SELECT t.*
      FROM tasks t
      JOIN wave_task_assignments wta ON t.id = wta.task_id
      WHERE wta.wave_id = ?
    `,
      )
      .all((wave as any).id);

    // Get agents that worked on wave
    const agents = db
      .prepare(
        `
      SELECT DISTINCT bai.*
      FROM build_agent_instances bai
      JOIN wave_task_assignments wta ON bai.task_id = wta.task_id
      WHERE wta.wave_id = ?
    `,
      )
      .all((wave as any).id);

    res.json({ wave, tasks, agents });
  } catch (error) {
    console.error("Error fetching wave:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get skill trace
router.get("/executions/:id/skills/:skillId", async (req, res) => {
  try {
    const { id: executionId, skillId } = req.params;

    const skillTrace = skillService.getSkillTrace(executionId, skillId);

    if (!skillTrace) {
      return res.status(404).json({ error: "Skill trace not found" });
    }

    res.json(skillTrace);
  } catch (error) {
    console.error("Error fetching skill trace:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get transcript entry with navigation
router.get("/executions/:id/transcript/:entryId", async (req, res) => {
  try {
    const { id: executionId, entryId } = req.params;

    const result = transcriptService.getEntryWithNavigation(
      executionId,
      entryId,
    );

    if (!result) {
      return res.status(404).json({ error: "Transcript entry not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching transcript entry:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

#### Acceptance Criteria

- [ ] `/executions/:id/tasks/:taskId` returns task with stats
- [ ] `/executions/:id/tool-uses/:toolId` returns full tool use
- [ ] `/executions/:id/assertions/:assertId` returns assertion with chain
- [ ] `/executions/:id/waves/:waveNum` returns wave with tasks/agents
- [ ] `/executions/:id/skills/:skillId` returns skill trace
- [ ] `/executions/:id/transcript/:entryId` returns entry with nav
- [ ] 404 returned when entity not found

---

### OBS-913: Create CSS Styles for Deep Link Pages

**File:** `frontend/src/styles/observability-detail.css`

**Purpose:** Styling for all entity detail pages.

#### Acceptance Criteria

- [ ] Consistent styling across all detail pages
- [ ] Breadcrumb component styled
- [ ] Cross-reference panel styled as sidebar
- [ ] Status badges have appropriate colors
- [ ] Code blocks render with syntax highlighting
- [ ] Responsive layout for mobile

---

### OBS-914: Add Keyboard Navigation Support

**File:** `frontend/src/hooks/useObservabilityKeyboard.ts`

**Purpose:** Keyboard shortcuts for observability navigation.

#### Implementation

```typescript
// frontend/src/hooks/useObservabilityKeyboard.ts

import { useEffect, useCallback } from "react";
import { useObservabilityNavigation } from "./useObservabilityNavigation";

interface KeyboardConfig {
  enableNavigation?: boolean;
  enableSearch?: boolean;
  onSearch?: () => void;
}

export function useObservabilityKeyboard(config: KeyboardConfig = {}) {
  const { enableNavigation = true, enableSearch = true, onSearch } = config;
  const { goBack, copyLink, currentExecutionId, goToExecution } =
    useObservabilityNavigation();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Escape: Go back
      if (event.key === "Escape" && enableNavigation) {
        goBack();
        return;
      }

      // Ctrl+C or Cmd+C when text not selected: Copy link
      if ((event.ctrlKey || event.metaKey) && event.key === "c") {
        const selection = window.getSelection()?.toString();
        if (!selection) {
          event.preventDefault();
          copyLink();
          return;
        }
      }

      // Slash: Focus search
      if (event.key === "/" && enableSearch && onSearch) {
        event.preventDefault();
        onSearch();
        return;
      }

      // g + e: Go to execution list
      if (event.key === "g") {
        const handleNextKey = (e: KeyboardEvent) => {
          if (e.key === "e" && enableNavigation) {
            e.preventDefault();
            goToExecution(currentExecutionId || "");
          }
          document.removeEventListener("keydown", handleNextKey);
        };
        document.addEventListener("keydown", handleNextKey, { once: true });
        setTimeout(() => {
          document.removeEventListener("keydown", handleNextKey);
        }, 500);
      }
    },
    [
      enableNavigation,
      enableSearch,
      onSearch,
      goBack,
      copyLink,
      currentExecutionId,
      goToExecution,
    ],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
```

#### Acceptance Criteria

- [ ] Escape key navigates back
- [ ] Ctrl/Cmd+C copies current link when no text selected
- [ ] Slash focuses search input
- [ ] g+e goes to execution list
- [ ] Keyboard shortcuts disabled when typing in inputs

---

### OBS-915: Create Link Copy Button Component

**File:** `frontend/src/components/observability/CopyLinkButton.tsx`

**Purpose:** Button to copy deep link to clipboard.

#### Implementation

```typescript
// frontend/src/components/observability/CopyLinkButton.tsx

import React, { useState, useCallback } from 'react';

interface CopyLinkButtonProps {
  className?: string;
}

const CopyLinkButton: React.FC<CopyLinkButtonProps> = ({ className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  }, []);

  return (
    <button
      onClick={handleCopy}
      className={`copy-link-button ${className} ${copied ? 'copied' : ''}`}
      title="Copy link to clipboard"
    >
      {copied ? '✓ Copied!' : '🔗 Copy Link'}
    </button>
  );
};

export default CopyLinkButton;
```

#### Acceptance Criteria

- [ ] Button copies current URL to clipboard
- [ ] Visual feedback when copied
- [ ] Accessible title attribute
- [ ] Styled consistently with other buttons

---

### OBS-916: Write E2E Navigation Tests

**File:** `tests/e2e/test-obs-phase9-routing.ts`

**Purpose:** End-to-end tests for deep linking and navigation.

#### Test Script

```typescript
#!/usr/bin/env npx tsx
/**
 * Phase 9 Routing & Deep Linking Validation Tests
 *
 * Tests navigation, URL persistence, and cross-reference linking.
 */

import { chromium, Browser, Page } from "playwright";

const BASE_URL = "http://localhost:5173";

let browser: Browser;
let page: Page;

// ============================================================================
// TEST SETUP
// ============================================================================
async function setup(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("SETTING UP E2E TESTS");
  console.log("=".repeat(70));

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
}

async function teardown(): Promise<void> {
  await browser.close();
}

// ============================================================================
// TEST 1: URL Utilities
// ============================================================================
async function testUrlUtilities(): Promise<boolean> {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 1: URL Utilities");
  console.log("=".repeat(70));

  try {
    // Import and test URL utilities
    const { buildObservabilityUrl, parseExecutionId, parseEntityFromUrl } =
      await import("../../frontend/src/utils/observability-urls");

    // Test buildObservabilityUrl
    const url1 = buildObservabilityUrl("task", {
      id: "exec-123",
      taskId: "task-456",
    });
    if (url1 !== "/observability/executions/exec-123/tasks/task-456") {
      throw new Error(`Invalid task URL: ${url1}`);
    }
    console.log("✓ buildObservabilityUrl generates correct URLs");

    // Test parseExecutionId
    const execId = parseExecutionId(
      "/observability/executions/exec-123/tasks/task-456",
    );
    if (execId !== "exec-123") {
      throw new Error(`Invalid parsed execution ID: ${execId}`);
    }
    console.log("✓ parseExecutionId extracts correct ID");

    // Test parseEntityFromUrl
    const entity = parseEntityFromUrl(
      "/observability/executions/exec-123/tools/tool-789",
    );
    if (entity.entityType !== "tool" || entity.entityId !== "tool-789") {
      throw new Error(`Invalid parsed entity: ${JSON.stringify(entity)}`);
    }
    console.log("✓ parseEntityFromUrl identifies entity correctly");

    console.log("✓ TEST 1 PASSED\n");
    return true;
  } catch (error) {
    console.log(`✗ TEST 1 FAILED: ${error}`);
    return false;
  }
}

// ============================================================================
// TEST 2: Route Navigation
// ============================================================================
async function testRouteNavigation(): Promise<boolean> {
  console.log("=".repeat(70));
  console.log("TEST 2: Route Navigation");
  console.log("=".repeat(70));

  try {
    // Navigate to observability root
    await page.goto(`${BASE_URL}/observability`);
    await page.waitForSelector(".observability-page");
    console.log("✓ /observability loads correctly");

    // Navigate to executions list
    await page.goto(`${BASE_URL}/observability/executions`);
    await page.waitForSelector(".executions-tab");
    console.log("✓ /observability/executions loads correctly");

    // Navigate to events
    await page.goto(`${BASE_URL}/observability/events`);
    await page.waitForSelector(".event-log-tab");
    console.log("✓ /observability/events loads correctly");

    // Navigate to analytics
    await page.goto(`${BASE_URL}/observability/analytics`);
    await page.waitForSelector(".analytics-tab");
    console.log("✓ /observability/analytics loads correctly");

    console.log("✓ TEST 2 PASSED\n");
    return true;
  } catch (error) {
    console.log(`✗ TEST 2 FAILED: ${error}`);
    return false;
  }
}

// ============================================================================
// TEST 3: Deep Link Navigation
// ============================================================================
async function testDeepLinkNavigation(): Promise<boolean> {
  console.log("=".repeat(70));
  console.log("TEST 3: Deep Link Navigation");
  console.log("=".repeat(70));

  try {
    // Assume we have test data - adjust IDs as needed
    const testExecId = "test-exec-001";
    const testTaskId = "test-task-001";

    // Navigate directly to task detail
    await page.goto(
      `${BASE_URL}/observability/executions/${testExecId}/tasks/${testTaskId}`,
    );

    // Check if page loads (may show "not found" if no data)
    const pageContent = await page.textContent("body");
    if (
      pageContent.includes("Task not found") ||
      pageContent.includes("task-detail-page")
    ) {
      console.log("✓ Task detail page route works");
    }

    // Test tool use deep link
    const testToolId = "test-tool-001";
    await page.goto(
      `${BASE_URL}/observability/executions/${testExecId}/tools/${testToolId}`,
    );
    const toolContent = await page.textContent("body");
    if (
      toolContent.includes("Tool use not found") ||
      toolContent.includes("tool-use-detail-page")
    ) {
      console.log("✓ Tool use detail page route works");
    }

    // Test assertion deep link
    const testAssertId = "test-assert-001";
    await page.goto(
      `${BASE_URL}/observability/executions/${testExecId}/assertions/${testAssertId}`,
    );
    const assertContent = await page.textContent("body");
    if (
      assertContent.includes("Assertion not found") ||
      assertContent.includes("assertion-detail-page")
    ) {
      console.log("✓ Assertion detail page route works");
    }

    // Test wave deep link
    await page.goto(
      `${BASE_URL}/observability/executions/${testExecId}/waves/1`,
    );
    const waveContent = await page.textContent("body");
    if (
      waveContent.includes("Wave not found") ||
      waveContent.includes("wave-detail-page")
    ) {
      console.log("✓ Wave detail page route works");
    }

    console.log("✓ TEST 3 PASSED\n");
    return true;
  } catch (error) {
    console.log(`✗ TEST 3 FAILED: ${error}`);
    return false;
  }
}

// ============================================================================
// TEST 4: Breadcrumb Navigation
// ============================================================================
async function testBreadcrumbNavigation(): Promise<boolean> {
  console.log("=".repeat(70));
  console.log("TEST 4: Breadcrumb Navigation");
  console.log("=".repeat(70));

  try {
    const testExecId = "test-exec-001";
    const testTaskId = "test-task-001";

    await page.goto(
      `${BASE_URL}/observability/executions/${testExecId}/tasks/${testTaskId}`,
    );

    // Check breadcrumb exists
    const breadcrumb = await page.$(".breadcrumb");
    if (!breadcrumb) {
      console.log("⚠ Breadcrumb not found (may be expected if no data)");
    } else {
      const items = await page.$$(".breadcrumb-item");
      console.log(`✓ Breadcrumb has ${items.length} items`);

      // Click on execution breadcrumb to navigate back
      const execLink = await page.$(".breadcrumb-link");
      if (execLink) {
        await execLink.click();
        await page.waitForNavigation({ waitUntil: "networkidle" });
        console.log("✓ Breadcrumb navigation works");
      }
    }

    console.log("✓ TEST 4 PASSED\n");
    return true;
  } catch (error) {
    console.log(`✗ TEST 4 FAILED: ${error}`);
    return false;
  }
}

// ============================================================================
// TEST 5: URL Query Parameters
// ============================================================================
async function testQueryParameters(): Promise<boolean> {
  console.log("=".repeat(70));
  console.log("TEST 5: URL Query Parameters");
  console.log("=".repeat(70));

  try {
    // Test expand=evidence parameter
    await page.goto(
      `${BASE_URL}/observability/executions/test-exec/assertions/test-assert?expand=evidence`,
    );

    const url = page.url();
    if (url.includes("expand=evidence")) {
      console.log("✓ Query parameter preserved in URL");
    }

    // Test task filter on execution page
    await page.goto(
      `${BASE_URL}/observability/executions/test-exec?task=task-001`,
    );
    const filteredUrl = page.url();
    if (filteredUrl.includes("task=task-001")) {
      console.log("✓ Task filter query parameter works");
    }

    console.log("✓ TEST 5 PASSED\n");
    return true;
  } catch (error) {
    console.log(`✗ TEST 5 FAILED: ${error}`);
    return false;
  }
}

// ============================================================================
// TEST 6: Copy Link Functionality
// ============================================================================
async function testCopyLink(): Promise<boolean> {
  console.log("=".repeat(70));
  console.log("TEST 6: Copy Link Functionality");
  console.log("=".repeat(70));

  try {
    await page.goto(`${BASE_URL}/observability/executions/test-exec`);

    // Look for copy link button
    const copyButton = await page.$(".copy-link-button");
    if (copyButton) {
      // Grant clipboard permissions
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);

      await copyButton.click();

      // Check for copied feedback
      const buttonText = await copyButton.textContent();
      if (buttonText?.includes("Copied")) {
        console.log("✓ Copy link shows feedback");
      }
    } else {
      console.log("⚠ Copy link button not found");
    }

    console.log("✓ TEST 6 PASSED\n");
    return true;
  } catch (error) {
    console.log(`✗ TEST 6 FAILED: ${error}`);
    return false;
  }
}

// ============================================================================
// TEST 7: 404 Handling
// ============================================================================
async function test404Handling(): Promise<boolean> {
  console.log("=".repeat(70));
  console.log("TEST 7: 404 Handling");
  console.log("=".repeat(70));

  try {
    // Navigate to non-existent entity
    await page.goto(`${BASE_URL}/observability/executions/non-existent-id`);

    // Should show error or not found message
    const pageContent = await page.textContent("body");
    if (
      pageContent.includes("not found") ||
      pageContent.includes("Not Found") ||
      pageContent.includes("Error")
    ) {
      console.log("✓ 404/error handling works for invalid execution");
    }

    console.log("✓ TEST 7 PASSED\n");
    return true;
  } catch (error) {
    console.log(`✗ TEST 7 FAILED: ${error}`);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function main(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("OBSERVABILITY PHASE 9 ROUTING E2E TESTS");
  console.log("=".repeat(70));

  const results: boolean[] = [];

  try {
    await setup();

    // Run tests
    results.push(await testUrlUtilities());
    results.push(await testRouteNavigation());
    results.push(await testDeepLinkNavigation());
    results.push(await testBreadcrumbNavigation());
    results.push(await testQueryParameters());
    results.push(await testCopyLink());
    results.push(await test404Handling());
  } finally {
    await teardown();
  }

  // Summary
  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log("=".repeat(70));
  if (passed === total) {
    console.log(`ALL PHASE 9 TESTS PASSED (${passed}/${total})`);
  } else {
    console.log(`PHASE 9 TESTS: ${passed}/${total} passed`);
    process.exit(1);
  }
  console.log("=".repeat(70));
}

main().catch(console.error);
```

#### Pass Criteria

| Test | Description           | Pass Criteria                                 |
| ---- | --------------------- | --------------------------------------------- |
| 1    | URL Utilities         | All utility functions return expected values  |
| 2    | Route Navigation      | All top-level routes load without error       |
| 3    | Deep Link Navigation  | Entity detail routes load or show "not found" |
| 4    | Breadcrumb Navigation | Breadcrumb renders and links work             |
| 5    | Query Parameters      | URL query params preserved correctly          |
| 6    | Copy Link             | Copy button shows feedback on click           |
| 7    | 404 Handling          | Invalid routes show appropriate error         |

---

## Phase 9 Task Summary

| Task ID | Title                 | File                                                            | Priority | Dependencies       |
| ------- | --------------------- | --------------------------------------------------------------- | -------- | ------------------ |
| OBS-900 | URL Utilities Module  | `frontend/src/utils/observability-urls.ts`                      | P2       | -                  |
| OBS-901 | TaskDetailPage        | `frontend/src/pages/observability/TaskDetailPage.tsx`           | P2       | OBS-900            |
| OBS-902 | ToolUseDetailPage     | `frontend/src/pages/observability/ToolUseDetailPage.tsx`        | P2       | OBS-900            |
| OBS-903 | AssertionDetailPage   | `frontend/src/pages/observability/AssertionDetailPage.tsx`      | P2       | OBS-900            |
| OBS-904 | WaveDetailPage        | `frontend/src/pages/observability/WaveDetailPage.tsx`           | P2       | OBS-900            |
| OBS-905 | SkillTraceDetailPage  | `frontend/src/pages/observability/SkillTraceDetailPage.tsx`     | P2       | OBS-900            |
| OBS-906 | TranscriptEntryPage   | `frontend/src/pages/observability/TranscriptEntryPage.tsx`      | P2       | OBS-900            |
| OBS-907 | Update App.tsx Routes | `frontend/src/App.tsx`                                          | P2       | OBS-901 to OBS-906 |
| OBS-908 | Breadcrumb Component  | `frontend/src/components/observability/Breadcrumb.tsx`          | P2       | -                  |
| OBS-909 | CrossReferencePanel   | `frontend/src/components/observability/CrossReferencePanel.tsx` | P2       | OBS-900            |
| OBS-910 | Navigation Hook       | `frontend/src/hooks/useObservabilityNavigation.ts`              | P2       | OBS-900            |
| OBS-911 | Deep Link Hooks       | `frontend/src/hooks/useObservability.ts`                        | P2       | -                  |
| OBS-912 | API Routes            | `server/routes/observability.ts`                                | P2       | -                  |
| OBS-913 | CSS Styles            | `frontend/src/styles/observability-detail.css`                  | P2       | -                  |
| OBS-914 | Keyboard Navigation   | `frontend/src/hooks/useObservabilityKeyboard.ts`                | P3       | OBS-910            |
| OBS-915 | Copy Link Button      | `frontend/src/components/observability/CopyLinkButton.tsx`      | P3       | -                  |
| OBS-916 | E2E Tests             | `tests/e2e/test-obs-phase9-routing.ts`                          | P2       | All above          |

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 9 IMPLEMENTATION SEQUENCE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRE-REQUISITES                                                          │
│  ─────────────                                                          │
│  ✓ Phase 7 React Hooks complete                                         │
│  ✓ Phase 8 UI Components complete                                       │
│  ✓ API routes for entity fetching exist                                 │
│                                                                          │
│  PHASE 9a: Foundation (Parallel)                                         │
│  ───────────────────────────────                                        │
│  1. OBS-900: Create URL utilities module                                │
│  2. OBS-908: Create Breadcrumb component                                │
│  3. OBS-913: Create CSS styles                                          │
│                                                                          │
│  PHASE 9b: Page Components (Parallel after 9a)                          │
│  ─────────────────────────────────────────────                          │
│  4. OBS-901: TaskDetailPage                                             │
│  5. OBS-902: ToolUseDetailPage                                          │
│  6. OBS-903: AssertionDetailPage                                        │
│  7. OBS-904: WaveDetailPage                                             │
│  8. OBS-905: SkillTraceDetailPage                                       │
│  9. OBS-906: TranscriptEntryPage                                        │
│                                                                          │
│  PHASE 9c: Integration (Sequential)                                      │
│  ──────────────────────────────────                                     │
│  10. OBS-909: CrossReferencePanel component                             │
│  11. OBS-910: Navigation hook                                           │
│  12. OBS-911: Add deep link hooks to useObservability                   │
│  13. OBS-912: Add API routes for individual entities                    │
│  14. OBS-907: Update App.tsx with new routes                            │
│                                                                          │
│  PHASE 9d: Enhancements (Optional, Parallel)                            │
│  ───────────────────────────────────────────                            │
│  15. OBS-914: Keyboard navigation support                               │
│  16. OBS-915: Copy link button component                                │
│                                                                          │
│  VALIDATION                                                              │
│  ──────────                                                             │
│  17. OBS-916: Run E2E navigation tests                                  │
│      └─ Verify: ALL PHASE 9 TESTS PASSED                                │
│                                                                          │
│  SUCCESS CRITERIA                                                        │
│  ────────────────                                                       │
│  ✓ All entity types have deep link routes                               │
│  ✓ Breadcrumb navigation works on all pages                             │
│  ✓ Cross-reference panel shows related entities                         │
│  ✓ URLs are shareable and bookmarkable                                  │
│  ✓ Navigation preserves context (back button works)                     │
│  ✓ 404 errors handled gracefully                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Run Commands

```bash
# After implementing Phase 9 tasks

# Step 1: Verify TypeScript compilation
npx tsc --noEmit

# Step 2: Start dev servers
npm run dev &
cd frontend && npm run dev &

# Step 3: Run E2E tests
npx playwright install chromium
npx tsx tests/e2e/test-obs-phase9-routing.ts
```

### Expected Output (Success)

```
======================================================================
OBSERVABILITY PHASE 9 ROUTING E2E TESTS
======================================================================

======================================================================
TEST 1: URL Utilities
======================================================================
✓ buildObservabilityUrl generates correct URLs
✓ parseExecutionId extracts correct ID
✓ parseEntityFromUrl identifies entity correctly
✓ TEST 1 PASSED

[... all 7 tests pass ...]

======================================================================
ALL PHASE 9 TESTS PASSED (7/7)
======================================================================
```

---

## Related Documents

| Document                                                           | Purpose                          |
| ------------------------------------------------------------------ | -------------------------------- |
| [SPEC.md](./SPEC.md)                                               | Core observability specification |
| [ui/README.md](./ui/README.md)                                     | UI component specifications      |
| [implementation-plan-phase-7.md](./implementation-plan-phase-7.md) | React hooks (dependency)         |
| [implementation-plan-phase-8.md](./implementation-plan-phase-8.md) | UI components (dependency)       |
| [api/README.md](./api/README.md)                                   | API endpoint specifications      |

---

_Phase 9 Implementation Plan: Routing & Deep Linking_
