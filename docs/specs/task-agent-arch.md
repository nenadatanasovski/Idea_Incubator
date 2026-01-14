# Task Agent Architecture

**Part of:** Parallel Task Execution System
**Updated:** 2026-01-13

---

## Overview

The Task Agent is the orchestration layer that manages task lifecycle, automatic grouping, parallelism analysis, and Build Agent coordination. It operates as a stateless service processing events from multiple sources.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TASK AGENT ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ENTRY POINTS                                                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │   Web UI    │    │  Telegram   │    │    API      │                      │
│  │ Quick Add   │    │ /newtask    │    │ POST /tasks │                      │
│  │ Kanban      │    │ NLP Parse   │    │             │                      │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                      │
│         │                  │                  │                              │
│         └──────────────────┼──────────────────┘                              │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         TASK AGENT CORE                              │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │    │
│  │  │ Task Creation   │  │  Evaluation     │  │  Auto-Grouping  │      │    │
│  │  │    Service      │  │    Queue        │  │     Engine      │      │    │
│  │  │                 │  │   Manager       │  │                 │      │    │
│  │  │ • createTask()  │  │                 │  │ • analyzeTasks()│      │    │
│  │  │ • generateId()  │  │ • addToQueue()  │  │ • scoreGroups() │      │    │
│  │  │ • validate()    │  │ • getQueued()   │  │ • suggest()     │      │    │
│  │  └────────┬────────┘  │ • moveToList()  │  │ • accept()      │      │    │
│  │           │           └────────┬────────┘  └────────┬────────┘      │    │
│  │           │                    │                    │               │    │
│  │           ▼                    ▼                    ▼               │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │    │
│  │  │ Task Analysis   │  │   Circular      │  │  File Impact    │      │    │
│  │  │    Pipeline     │  │  Dependency     │  │   Analyzer      │      │    │
│  │  │                 │  │  Prevention     │  │                 │      │    │
│  │  │ • analyze()     │  │                 │  │ • estimate()    │      │    │
│  │  │ • findRelated() │  │ • wouldCycle()  │  │ • matchPatterns │      │    │
│  │  │ • duplicates()  │  │ • detectCycles()│  │ • validate()    │      │    │
│  │  └────────┬────────┘  │ • resolve()     │  └────────┬────────┘      │    │
│  │           │           └────────┬────────┘           │               │    │
│  │           │                    │                    │               │    │
│  │           ▼                    ▼                    ▼               │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │    │
│  │  │   Parallelism   │  │ File Conflict   │  │   Parallelism   │      │    │
│  │  │   Calculator    │  │   Detector      │  │    Queries      │      │    │
│  │  │                 │  │                 │  │                 │      │    │
│  │  │ • calcWaves()   │  │ • canParallel() │  │ • findOpps()    │      │    │
│  │  │ • maxParallel() │  │ • getConflicts()│  │ • getDeps()     │      │    │
│  │  │ • invalidate()  │  │ • conflictType()│  │ • invalidate()  │      │    │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │    │
│  │           │                    │                    │               │    │
│  │           └────────────────────┼────────────────────┘               │    │
│  │                                │                                    │    │
│  └────────────────────────────────┼────────────────────────────────────┘    │
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    BUILD AGENT ORCHESTRATOR                          │    │
│  │                                                                      │    │
│  │   • spawnBuildAgent()      • handleCompletion()                     │    │
│  │   • assignTask()           • handleFailure()                        │    │
│  │   • monitorAgents()        • getBlockedTasks()                      │    │
│  │   • terminateAgent()       • recordHeartbeat()                      │    │
│  │                                                                      │    │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │    │
│  │   │ Agent 1 │ │ Agent 2 │ │ Agent 3 │ │ Agent 4 │ │ Agent N │      │    │
│  │   │ Task A  │ │ Task B  │ │ Task C  │ │ Task D  │ │ Task X  │      │    │
│  │   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Task Creation Service

**Location:** `server/services/task-agent/task-creation-service.ts`

**Responsibilities:**
- Create tasks with or without task list assignment
- Generate human-readable display IDs
- Trigger analysis pipeline on creation
- Handle bulk task creation

**Key Functions:**
```typescript
createListlessTask(input: CreateTaskInput): Promise<CreateTaskResponse>
createTaskInList(input: CreateTaskInput & { taskListId: string }): Promise<CreateTaskResponse>
createTask(input: CreateTaskInput): Promise<CreateTaskResponse>
updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task | null>
```

### 2. Evaluation Queue Manager

**Location:** `server/services/task-agent/evaluation-queue-manager.ts`

**Responsibilities:**
- Manage the Evaluation Queue (tasks without a list)
- Track queue statistics and stale tasks
- Move tasks from queue to task lists

**Key Functions:**
```typescript
addToQueue(taskId: string): Promise<void>
getQueuedTasks(): Promise<EvaluationQueueTask[]>
moveToTaskList(taskId: string, taskListId: string): Promise<void>
getQueueStats(): Promise<QueueStats>
getStaleQueuedTasks(): Promise<EvaluationQueueTask[]>
```

### 3. Task Analysis Pipeline

**Location:** `server/services/task-agent/task-analysis-pipeline.ts`

**Responsibilities:**
- Analyze tasks for relationships and duplicates
- Detect circular dependencies
- Suggest groupings based on analysis

**Key Functions:**
```typescript
analyzeTask(taskId: string): Promise<TaskAnalysisResult>
findRelatedTasks(taskId: string): Promise<TaskIdentity[]>
detectDuplicates(taskId: string): Promise<DuplicateCandidate[]>
suggestGrouping(triggerTaskId: string, relatedTaskIds: string[]): Promise<GroupingSuggestion | null>
validateDependencies(taskId: string): Promise<{ hasCircle: boolean; circlePath?: string[] }>
```

### 4. Auto-Grouping Engine

**Location:** `server/services/task-agent/auto-grouping-engine.ts`

**Responsibilities:**
- Score task groupings based on multiple criteria
- Generate grouping suggestions
- Handle suggestion acceptance/rejection
- Manage suggestion lifecycle (expiration)

**Key Functions:**
```typescript
analyzeTasks(): Promise<GroupingSuggestion[]>
calculateGroupingScore(taskIds: string[]): Promise<number>
generateSuggestion(taskIds: string[], reason: string): Promise<GroupingSuggestion>
acceptSuggestion(suggestionId: string): Promise<void>
rejectSuggestion(suggestionId: string): Promise<void>
```

### 5. File Impact Analyzer

**Location:** `server/services/task-agent/file-impact-analyzer.ts`

**Responsibilities:**
- Estimate file impacts using AI and patterns
- Merge estimates from multiple sources
- Validate predictions after execution
- Record actual file changes

**Key Functions:**
```typescript
estimateFileImpacts(taskId: string): Promise<FileImpact[]>
matchHistoricalPatterns(taskTitle: string, category: TaskCategory): Promise<FileImpact[]>
mergeEstimates(aiEstimates: FileImpact[], patternEstimates: FileImpact[]): FileImpact[]
validateFileImpacts(taskId: string, actualFiles: string[]): Promise<void>
recordActualImpact(taskId: string, filePath: string, operation: FileOperation): Promise<void>
```

### 6. File Conflict Detector

**Location:** `server/services/task-agent/file-conflict-detector.ts`

**Responsibilities:**
- Detect file conflicts between tasks
- Determine conflict types (write-write, write-delete, etc.)
- Check if two tasks can run in parallel

**Key Functions:**
```typescript
canRunParallel(taskAId: string, taskBId: string): Promise<boolean>
detectConflicts(taskAId: string, taskBId: string): Promise<FileConflict[]>
getConflictDetails(taskAId: string, taskBId: string): Promise<ConflictDetails>
getConflictType(opA: FileOperation, opB: FileOperation): ConflictType | null
```

### 7. Parallelism Calculator

**Location:** `server/services/task-agent/parallelism-calculator.ts`

**Responsibilities:**
- Calculate execution waves for a task list
- Determine maximum parallelism
- Cache and invalidate analysis results

**Key Functions:**
```typescript
calculateWaves(taskListId: string): Promise<ExecutionWave[]>
getMaxParallelism(taskListId: string): Promise<number>
getTaskListParallelism(taskListId: string): Promise<TaskListParallelism>
invalidateAnalysis(taskListId: string): Promise<void>
```

### 8. Circular Dependency Prevention

**Location:** `server/services/task-agent/circular-dependency-prevention.ts`

**Responsibilities:**
- Detect potential cycles before dependency creation
- Find existing cycles in the dependency graph
- Generate and apply resolutions
- Warn about near-cycle situations

**Key Functions:**
```typescript
wouldCreateCycle(sourceTaskId: string, targetTaskId: string): Promise<CycleDetectionResult>
detectExistingCycles(taskListId?: string): Promise<CycleInfo[]>
generateResolution(cycle: CycleInfo): Promise<CycleResolution>
applyResolution(resolution: CycleResolution): Promise<void>
safeAddDependency(sourceTaskId: string, targetTaskId: string): Promise<SafeAddResult>
```

### 9. Build Agent Orchestrator

**Location:** `server/services/task-agent/build-agent-orchestrator.ts`

**Responsibilities:**
- Spawn and manage Build Agent instances
- Assign tasks to agents (1:1 mapping)
- Monitor agent health via heartbeats
- Handle completion and failure events
- Coordinate wave-based execution

**Key Functions:**
```typescript
spawnBuildAgent(taskId: string, waveId: string): Promise<BuildAgentInstance>
assignTaskToAgent(agentId: string, taskId: string): Promise<void>
monitorAgents(): Promise<AgentHealthReport>
terminateAgent(agentId: string): Promise<void>
handleAgentCompletion(agentId: string): Promise<void>
handleAgentFailure(agentId: string, error: string): Promise<void>
getBlockedTasks(failedTaskId: string): Promise<Task[]>
recordHeartbeat(agentId: string): Promise<void>
startExecution(taskListId: string): Promise<void>
pauseExecution(taskListId: string): Promise<void>
```

---

## Data Flow

### Task Creation Flow

```
User Input → Task Creation Service → Generate Display ID
                                   → Create Task Record
                                   → Add to Evaluation Queue (if listless)
                                   → Trigger Analysis Pipeline
                                   → Estimate File Impacts
                                   → Check for Related Tasks
                                   → Generate Grouping Suggestion (if applicable)
                                   → Send Telegram Notification
```

### Execution Flow

```
Start Execution → Load Task List
               → Calculate Parallelism Waves
               → For each Wave:
                   → Spawn Build Agents (one per task)
                   → Monitor Heartbeats
                   → On Completion: Spawn next wave agents
                   → On Failure: Block dependent tasks only
               → Mark Task List Complete
```

### Grouping Flow

```
Task Created → Analysis Pipeline
            → Find Related Tasks (similarity search)
            → Score Grouping (weighted criteria)
            → If score > threshold:
                → Generate Suggestion
                → Send to Telegram with Accept/Reject buttons
            → On Accept:
                → Create Task List
                → Move tasks from Evaluation Queue
                → Calculate Parallelism
            → On Reject:
                → Mark suggestion rejected
                → Keep tasks in queue
```

---

## Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE DEPENDENCY GRAPH                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Task Creation Service                                                       │
│  ├── Display ID Generator                                                    │
│  ├── Evaluation Queue Manager                                                │
│  └── Task Analysis Pipeline                                                  │
│      ├── File Impact Analyzer                                                │
│      ├── Circular Dependency Prevention                                      │
│      └── Auto-Grouping Engine                                                │
│                                                                              │
│  Build Agent Orchestrator                                                    │
│  ├── Parallelism Calculator                                                  │
│  │   ├── File Conflict Detector                                              │
│  │   └── Parallelism Queries                                                 │
│  └── Circular Dependency Prevention                                          │
│                                                                              │
│  Telegram Commands                                                           │
│  ├── Task Creation Service                                                   │
│  ├── Evaluation Queue Manager                                                │
│  ├── Auto-Grouping Engine                                                    │
│  ├── Natural Language Parser                                                 │
│  ├── Parallelism Calculator                                                  │
│  └── Build Agent Orchestrator                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Task Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/task-agent/tasks` | Create a task |
| GET | `/api/task-agent/tasks/:id` | Get task by ID |
| PUT | `/api/task-agent/tasks/:id` | Update task |
| DELETE | `/api/task-agent/tasks/:id` | Delete task |

### Evaluation Queue

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/task-agent/queue` | Get queued tasks |
| GET | `/api/task-agent/queue/stats` | Get queue statistics |
| POST | `/api/task-agent/queue/:taskId/move` | Move task to list |

### Grouping

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/task-agent/suggestions` | Get pending suggestions |
| POST | `/api/task-agent/suggestions/:id/accept` | Accept suggestion |
| POST | `/api/task-agent/suggestions/:id/reject` | Reject suggestion |

### Parallelism

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/task-agent/parallelism/:taskListId` | Get parallelism info |
| GET | `/api/task-agent/parallelism/:taskListId/waves` | Get execution waves |

### Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/task-agent/execution/:taskListId/start` | Start execution |
| POST | `/api/task-agent/execution/:taskListId/pause` | Pause execution |
| POST | `/api/task-agent/execution/:taskListId/resume` | Resume execution |
| GET | `/api/task-agent/agents` | Get active agents |

---

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/newtask <description>` | Create a new task |
| `/queue` | Show Evaluation Queue status |
| `/suggest` | Get grouping suggestions |
| `/parallel [taskListId]` | Show parallelism status |
| `/agents` | Show active Build Agents |

---

## Related Documents

- [Task Data Model](./task-data-model.md) - Database schema and types
- [Task Example Reference](./task-example-reference.md) - Canonical task format
- [E2E Scenarios](./PTE-e2e-scenarios.md) - End-to-end test scenarios
- [Implementation Plan](./PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md) - Full plan
