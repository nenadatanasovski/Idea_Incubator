/**
 * AgentSessionsView - View for tracking agent sessions, lineage, and log files
 * Table-based layout with horizontal loop iteration display
 */

import { useState, useMemo } from "react";
import {
  GitBranch,
  GitCommit,
  GitMerge,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  PauseCircle,
  Bot,
  Filter,
  Search,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import LogFileModal from "./LogFileModal";

// Types for agent sessions and lineage
export type AgentSessionStatus =
  | "running"
  | "completed"
  | "failed"
  | "paused"
  | "cancelled";

export type LoopIteration = {
  iteration: number;
  startedAt: string;
  completedAt?: string;
  status: AgentSessionStatus;
  tasksCompleted: number;
  tasksFailed: number;
  duration?: number;
  logFileId: string;
  logFilePreview?: string;
  errors?: string[];
  checkpoints?: {
    id: string;
    name: string;
    timestamp: string;
  }[];
};

export interface AgentSession {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  projectId?: string;
  projectName?: string;
  taskListId?: string;
  taskListName?: string;
  status: AgentSessionStatus;
  startedAt: string;
  completedAt?: string;
  parentSessionId?: string;
  childSessionIds?: string[];
  loopCount: number;
  currentIteration: number;
  iterations: LoopIteration[];
  totalTasksCompleted: number;
  totalTasksFailed: number;
  metadata?: Record<string, unknown>;
}

// Generate fake data for demonstration
function generateFakeAgentSessions(): AgentSession[] {
  const now = new Date();
  const sessions: AgentSession[] = [];

  // Session 1: Running loop with multiple iterations
  sessions.push({
    id: "session-001-abc123",
    agentId: "build-agent-01",
    agentName: "Build Agent Alpha",
    agentType: "build-agent",
    projectId: "proj-vibe-check",
    projectName: "Vibe Check App",
    taskListId: "tl-001",
    taskListName: "API Implementation Tasks",
    status: "running",
    startedAt: new Date(now.getTime() - 3600000).toISOString(),
    loopCount: 5,
    currentIteration: 3,
    totalTasksCompleted: 12,
    totalTasksFailed: 2,
    iterations: [
      {
        iteration: 1,
        startedAt: new Date(now.getTime() - 3600000).toISOString(),
        completedAt: new Date(now.getTime() - 3000000).toISOString(),
        status: "completed",
        tasksCompleted: 5,
        tasksFailed: 0,
        duration: 600000,
        logFileId: "log-001-iter-1",
        logFilePreview:
          "✓ Created endpoint /api/users\n✓ Added validation middleware\n✓ Generated types\n✓ Updated routes\n✓ Verified compilation",
        checkpoints: [
          {
            id: "cp-001",
            name: "Post-validation checkpoint",
            timestamp: new Date(now.getTime() - 3200000).toISOString(),
          },
        ],
      },
      {
        iteration: 2,
        startedAt: new Date(now.getTime() - 3000000).toISOString(),
        completedAt: new Date(now.getTime() - 2200000).toISOString(),
        status: "failed",
        tasksCompleted: 3,
        tasksFailed: 2,
        duration: 800000,
        logFileId: "log-001-iter-2",
        logFilePreview:
          "✓ Updated database schema\n✓ Created migration\n✓ Applied migration\n✗ Test suite failed\n✗ TypeScript errors in auth.ts",
        errors: [
          "TypeError: Cannot read property 'id' of undefined at auth.ts:42",
          "Test assertion failed: Expected 200, got 401",
        ],
        checkpoints: [
          {
            id: "cp-002",
            name: "Pre-test checkpoint",
            timestamp: new Date(now.getTime() - 2500000).toISOString(),
          },
        ],
      },
      {
        iteration: 3,
        startedAt: new Date(now.getTime() - 2200000).toISOString(),
        status: "running",
        tasksCompleted: 4,
        tasksFailed: 0,
        logFileId: "log-001-iter-3",
        logFilePreview:
          "✓ Fixed auth.ts type error\n✓ Updated test mocks\n✓ Re-ran test suite\n▶ Running integration tests...",
      },
    ],
  });

  // Session 2: Completed with children
  sessions.push({
    id: "session-002-def456",
    agentId: "build-agent-02",
    agentName: "Build Agent Beta",
    agentType: "build-agent",
    projectId: "proj-vibe-check",
    projectName: "Vibe Check App",
    taskListId: "tl-002",
    taskListName: "UI Component Tasks",
    status: "completed",
    startedAt: new Date(now.getTime() - 7200000).toISOString(),
    completedAt: new Date(now.getTime() - 5400000).toISOString(),
    childSessionIds: ["session-003-ghi789"],
    loopCount: 2,
    currentIteration: 2,
    totalTasksCompleted: 8,
    totalTasksFailed: 0,
    iterations: [
      {
        iteration: 1,
        startedAt: new Date(now.getTime() - 7200000).toISOString(),
        completedAt: new Date(now.getTime() - 6600000).toISOString(),
        status: "completed",
        tasksCompleted: 4,
        tasksFailed: 0,
        duration: 600000,
        logFileId: "log-002-iter-1",
        logFilePreview:
          "✓ Created Button component\n✓ Created Card component\n✓ Added Storybook stories\n✓ Generated component types",
      },
      {
        iteration: 2,
        startedAt: new Date(now.getTime() - 6600000).toISOString(),
        completedAt: new Date(now.getTime() - 5400000).toISOString(),
        status: "completed",
        tasksCompleted: 4,
        tasksFailed: 0,
        duration: 1200000,
        logFileId: "log-002-iter-2",
        logFilePreview:
          "✓ Added accessibility props\n✓ Implemented dark mode support\n✓ Added unit tests\n✓ Updated documentation",
        checkpoints: [
          {
            id: "cp-003",
            name: "Component completion",
            timestamp: new Date(now.getTime() - 5500000).toISOString(),
          },
        ],
      },
    ],
  });

  // Session 3: Child session (spawned from session 2)
  sessions.push({
    id: "session-003-ghi789",
    agentId: "build-agent-03",
    agentName: "Build Agent Gamma",
    agentType: "build-agent",
    projectId: "proj-vibe-check",
    projectName: "Vibe Check App",
    taskListId: "tl-003",
    taskListName: "Test Coverage Tasks",
    status: "completed",
    startedAt: new Date(now.getTime() - 6000000).toISOString(),
    completedAt: new Date(now.getTime() - 4800000).toISOString(),
    parentSessionId: "session-002-def456",
    loopCount: 1,
    currentIteration: 1,
    totalTasksCompleted: 6,
    totalTasksFailed: 0,
    iterations: [
      {
        iteration: 1,
        startedAt: new Date(now.getTime() - 6000000).toISOString(),
        completedAt: new Date(now.getTime() - 4800000).toISOString(),
        status: "completed",
        tasksCompleted: 6,
        tasksFailed: 0,
        duration: 1200000,
        logFileId: "log-003-iter-1",
        logFilePreview:
          "✓ Added Button.test.tsx\n✓ Added Card.test.tsx\n✓ Coverage: 94%\n✓ All assertions passed\n✓ Generated coverage report\n✓ Updated CI config",
      },
    ],
  });

  // Session 4: Failed session
  sessions.push({
    id: "session-004-jkl012",
    agentId: "build-agent-04",
    agentName: "Build Agent Delta",
    agentType: "build-agent",
    projectId: "proj-task-agent",
    projectName: "Task Agent System",
    taskListId: "tl-004",
    taskListName: "Database Migration",
    status: "failed",
    startedAt: new Date(now.getTime() - 10800000).toISOString(),
    completedAt: new Date(now.getTime() - 9000000).toISOString(),
    loopCount: 3,
    currentIteration: 3,
    totalTasksCompleted: 2,
    totalTasksFailed: 5,
    iterations: [
      {
        iteration: 1,
        startedAt: new Date(now.getTime() - 10800000).toISOString(),
        completedAt: new Date(now.getTime() - 10200000).toISOString(),
        status: "failed",
        tasksCompleted: 1,
        tasksFailed: 2,
        duration: 600000,
        logFileId: "log-004-iter-1",
        logFilePreview:
          "✓ Generated migration file\n✗ Foreign key constraint error\n✗ Rollback initiated",
        errors: ["SQLITE_CONSTRAINT: FOREIGN KEY constraint failed"],
      },
      {
        iteration: 2,
        startedAt: new Date(now.getTime() - 10200000).toISOString(),
        completedAt: new Date(now.getTime() - 9600000).toISOString(),
        status: "failed",
        tasksCompleted: 1,
        tasksFailed: 2,
        duration: 600000,
        logFileId: "log-004-iter-2",
        logFilePreview:
          "✓ Fixed foreign key order\n✗ Unique constraint violation\n✗ Data integrity check failed",
        errors: [
          "UNIQUE constraint failed: tasks.display_id",
          "Existing records conflict with new schema",
        ],
      },
      {
        iteration: 3,
        startedAt: new Date(now.getTime() - 9600000).toISOString(),
        completedAt: new Date(now.getTime() - 9000000).toISOString(),
        status: "failed",
        tasksCompleted: 0,
        tasksFailed: 1,
        duration: 600000,
        logFileId: "log-004-iter-3",
        logFilePreview:
          "✗ Max retry limit reached\n✗ Session terminated\n⚠ Manual intervention required",
        errors: [
          "MaxRetriesExceeded: Unable to complete migration after 3 attempts",
        ],
        checkpoints: [
          {
            id: "cp-004",
            name: "Pre-migration state",
            timestamp: new Date(now.getTime() - 10800000).toISOString(),
          },
        ],
      },
    ],
  });

  // Session 5: Paused session
  sessions.push({
    id: "session-005-mno345",
    agentId: "build-agent-05",
    agentName: "Build Agent Epsilon",
    agentType: "build-agent",
    projectId: "proj-task-agent",
    projectName: "Task Agent System",
    taskListId: "tl-005",
    taskListName: "API Endpoints",
    status: "paused",
    startedAt: new Date(now.getTime() - 1800000).toISOString(),
    loopCount: 2,
    currentIteration: 2,
    totalTasksCompleted: 3,
    totalTasksFailed: 0,
    iterations: [
      {
        iteration: 1,
        startedAt: new Date(now.getTime() - 1800000).toISOString(),
        completedAt: new Date(now.getTime() - 1200000).toISOString(),
        status: "completed",
        tasksCompleted: 2,
        tasksFailed: 0,
        duration: 600000,
        logFileId: "log-005-iter-1",
        logFilePreview: "✓ Created GET /api/tasks\n✓ Created POST /api/tasks",
      },
      {
        iteration: 2,
        startedAt: new Date(now.getTime() - 1200000).toISOString(),
        status: "paused",
        tasksCompleted: 1,
        tasksFailed: 0,
        logFileId: "log-005-iter-2",
        logFilePreview: "✓ Created PUT /api/tasks/:id\n⏸ Paused by user",
      },
    ],
  });

  return sessions;
}

// Fake log file contents
const FAKE_LOG_CONTENTS: Record<string, string> = {
  "log-001-iter-1": `[2025-01-18T10:00:00.000Z] [INFO] Build Agent Alpha starting iteration 1
[2025-01-18T10:00:01.000Z] [INFO] Loading task list: API Implementation Tasks
[2025-01-18T10:00:02.000Z] [INFO] Found 5 pending tasks
[2025-01-18T10:00:05.000Z] [TASK] Starting: Create /api/users endpoint
[2025-01-18T10:01:30.000Z] [SUCCESS] ✓ Created endpoint /api/users
[2025-01-18T10:01:35.000Z] [TASK] Starting: Add validation middleware
[2025-01-18T10:02:45.000Z] [SUCCESS] ✓ Added validation middleware
[2025-01-18T10:02:50.000Z] [TASK] Starting: Generate TypeScript types
[2025-01-18T10:03:30.000Z] [SUCCESS] ✓ Generated types for User entity
[2025-01-18T10:03:35.000Z] [TASK] Starting: Update route configuration
[2025-01-18T10:04:15.000Z] [SUCCESS] ✓ Updated routes in server/routes/index.ts
[2025-01-18T10:04:20.000Z] [TASK] Starting: Verify TypeScript compilation
[2025-01-18T10:05:00.000Z] [SUCCESS] ✓ No TypeScript errors found
[2025-01-18T10:05:01.000Z] [INFO] Iteration 1 completed successfully
[2025-01-18T10:05:02.000Z] [CHECKPOINT] Created checkpoint: Post-validation checkpoint`,
  "log-001-iter-2": `[2025-01-18T10:10:00.000Z] [INFO] Build Agent Alpha starting iteration 2
[2025-01-18T10:10:01.000Z] [INFO] Loading remaining tasks
[2025-01-18T10:10:02.000Z] [INFO] Found 5 tasks for this iteration
[2025-01-18T10:10:05.000Z] [TASK] Starting: Update database schema
[2025-01-18T10:11:30.000Z] [SUCCESS] ✓ Updated database schema
[2025-01-18T10:11:35.000Z] [TASK] Starting: Create migration file
[2025-01-18T10:12:15.000Z] [SUCCESS] ✓ Created migration 088_add_user_profile.sql
[2025-01-18T10:12:20.000Z] [TASK] Starting: Apply migration
[2025-01-18T10:12:45.000Z] [SUCCESS] ✓ Migration applied successfully
[2025-01-18T10:12:50.000Z] [TASK] Starting: Run test suite
[2025-01-18T10:15:30.000Z] [ERROR] ✗ Test suite failed
  - auth.test.ts: FAILED
    TypeError: Cannot read property 'id' of undefined
    at AuthService.validateToken (auth.ts:42:15)
[2025-01-18T10:15:35.000Z] [TASK] Starting: Verify TypeScript compilation
[2025-01-18T10:16:00.000Z] [ERROR] ✗ TypeScript compilation failed
  src/auth.ts(42,10): error TS2532: Object is possibly 'undefined'
[2025-01-18T10:16:01.000Z] [WARN] Iteration 2 completed with errors
[2025-01-18T10:16:02.000Z] [INFO] Will retry failed tasks in next iteration`,
  "log-001-iter-3": `[2025-01-18T10:23:00.000Z] [INFO] Build Agent Alpha starting iteration 3
[2025-01-18T10:23:01.000Z] [INFO] Addressing failures from iteration 2
[2025-01-18T10:23:05.000Z] [TASK] Starting: Fix auth.ts type error
[2025-01-18T10:24:30.000Z] [SUCCESS] ✓ Fixed type error with optional chaining
[2025-01-18T10:24:35.000Z] [TASK] Starting: Update test mocks
[2025-01-18T10:25:45.000Z] [SUCCESS] ✓ Updated mock data in auth.test.ts
[2025-01-18T10:25:50.000Z] [TASK] Starting: Re-run test suite
[2025-01-18T10:28:00.000Z] [SUCCESS] ✓ All unit tests passing
[2025-01-18T10:28:05.000Z] [TASK] Starting: Run integration tests
[2025-01-18T10:28:06.000Z] [INFO] ▶ Running integration tests...
[2025-01-18T10:28:10.000Z] [INFO] Integration test 1/5: User registration
[2025-01-18T10:28:30.000Z] [INFO] Integration test 2/5: User login`,
  "log-002-iter-1": `[2025-01-18T09:00:00.000Z] [INFO] Build Agent Beta starting iteration 1
[2025-01-18T09:00:01.000Z] [INFO] Loading task list: UI Component Tasks
[2025-01-18T09:00:02.000Z] [INFO] Found 4 pending tasks
[2025-01-18T09:00:05.000Z] [TASK] Starting: Create Button component
[2025-01-18T09:02:00.000Z] [SUCCESS] ✓ Created Button component
[2025-01-18T09:02:05.000Z] [TASK] Starting: Create Card component
[2025-01-18T09:04:00.000Z] [SUCCESS] ✓ Created Card component
[2025-01-18T09:04:05.000Z] [TASK] Starting: Add Storybook stories
[2025-01-18T09:06:00.000Z] [SUCCESS] ✓ Added Storybook stories for Button and Card
[2025-01-18T09:06:05.000Z] [TASK] Starting: Generate component types
[2025-01-18T09:07:00.000Z] [SUCCESS] ✓ Generated TypeScript types
[2025-01-18T09:07:01.000Z] [INFO] Iteration 1 completed successfully`,
  "log-002-iter-2": `[2025-01-18T09:10:00.000Z] [INFO] Build Agent Beta starting iteration 2
[2025-01-18T09:10:01.000Z] [INFO] Loading remaining tasks
[2025-01-18T09:10:02.000Z] [INFO] Found 4 enhancement tasks
[2025-01-18T09:10:05.000Z] [TASK] Starting: Add accessibility props
[2025-01-18T09:15:00.000Z] [SUCCESS] ✓ Added aria-label, role, tabIndex props
[2025-01-18T09:15:05.000Z] [TASK] Starting: Implement dark mode support
[2025-01-18T09:20:00.000Z] [SUCCESS] ✓ Added useTheme hook integration
[2025-01-18T09:20:05.000Z] [TASK] Starting: Add unit tests
[2025-01-18T09:25:00.000Z] [SUCCESS] ✓ Created Button.test.tsx and Card.test.tsx
[2025-01-18T09:25:05.000Z] [TASK] Starting: Update documentation
[2025-01-18T09:28:00.000Z] [SUCCESS] ✓ Updated README and JSDoc comments
[2025-01-18T09:28:01.000Z] [INFO] Iteration 2 completed successfully
[2025-01-18T09:28:02.000Z] [INFO] All tasks completed. Session finished.
[2025-01-18T09:28:03.000Z] [CHECKPOINT] Created checkpoint: Component completion`,
  "log-003-iter-1": `[2025-01-18T09:20:00.000Z] [INFO] Build Agent Gamma starting (spawned from session-002)
[2025-01-18T09:20:01.000Z] [INFO] Loading task list: Test Coverage Tasks
[2025-01-18T09:20:02.000Z] [INFO] Found 6 testing tasks
[2025-01-18T09:20:05.000Z] [TASK] Starting: Create Button.test.tsx
[2025-01-18T09:22:00.000Z] [SUCCESS] ✓ Created comprehensive Button tests
[2025-01-18T09:22:05.000Z] [TASK] Starting: Create Card.test.tsx
[2025-01-18T09:24:00.000Z] [SUCCESS] ✓ Created comprehensive Card tests
[2025-01-18T09:24:05.000Z] [TASK] Starting: Run coverage report
[2025-01-18T09:26:00.000Z] [SUCCESS] ✓ Coverage: 94% (target: 80%)
[2025-01-18T09:26:05.000Z] [TASK] Starting: Run all assertions
[2025-01-18T09:28:00.000Z] [SUCCESS] ✓ All 47 assertions passed
[2025-01-18T09:28:05.000Z] [TASK] Starting: Generate coverage report
[2025-01-18T09:29:00.000Z] [SUCCESS] ✓ Report generated at coverage/lcov-report/index.html
[2025-01-18T09:29:05.000Z] [TASK] Starting: Update CI config
[2025-01-18T09:30:00.000Z] [SUCCESS] ✓ Added coverage thresholds to jest.config.js
[2025-01-18T09:30:01.000Z] [INFO] Session completed. Returning to parent.`,
  "log-004-iter-1": `[2025-01-18T08:00:00.000Z] [INFO] Build Agent Delta starting iteration 1
[2025-01-18T08:00:01.000Z] [INFO] Loading task list: Database Migration
[2025-01-18T08:00:02.000Z] [INFO] Found 3 migration tasks
[2025-01-18T08:00:05.000Z] [TASK] Starting: Generate migration file
[2025-01-18T08:02:00.000Z] [SUCCESS] ✓ Generated 089_add_relationships.sql
[2025-01-18T08:02:05.000Z] [TASK] Starting: Apply migration
[2025-01-18T08:02:30.000Z] [ERROR] ✗ Migration failed
  SQLITE_CONSTRAINT: FOREIGN KEY constraint failed
  at migration line 15: REFERENCES tasks(id)
[2025-01-18T08:02:35.000Z] [TASK] Starting: Rollback changes
[2025-01-18T08:03:00.000Z] [ERROR] ✗ Rollback initiated
[2025-01-18T08:03:01.000Z] [WARN] Iteration 1 failed. Will retry.`,
  "log-004-iter-2": `[2025-01-18T08:10:00.000Z] [INFO] Build Agent Delta starting iteration 2
[2025-01-18T08:10:01.000Z] [INFO] Attempting to fix foreign key order
[2025-01-18T08:10:05.000Z] [TASK] Starting: Reorder foreign key declarations
[2025-01-18T08:12:00.000Z] [SUCCESS] ✓ Updated migration file
[2025-01-18T08:12:05.000Z] [TASK] Starting: Apply migration
[2025-01-18T08:12:45.000Z] [ERROR] ✗ Migration failed
  UNIQUE constraint failed: tasks.display_id
  Duplicate value 'TU-PROJ-FEA-001' in existing data
[2025-01-18T08:12:50.000Z] [TASK] Starting: Data integrity check
[2025-01-18T08:13:00.000Z] [ERROR] ✗ Data integrity check failed
  Found 15 records with conflicting display_ids
[2025-01-18T08:13:01.000Z] [WARN] Iteration 2 failed. Will retry.`,
  "log-004-iter-3": `[2025-01-18T08:20:00.000Z] [INFO] Build Agent Delta starting iteration 3
[2025-01-18T08:20:01.000Z] [WARN] This is attempt 3 of 3
[2025-01-18T08:20:05.000Z] [TASK] Analyzing data conflicts
[2025-01-18T08:22:00.000Z] [INFO] Conflicts require manual review:
  - 15 duplicate display_ids need resolution
  - Cannot auto-merge without data loss risk
[2025-01-18T08:22:05.000Z] [ERROR] ✗ Max retry limit reached
[2025-01-18T08:22:06.000Z] [ERROR] ✗ Session terminated
[2025-01-18T08:22:07.000Z] [WARN] ⚠ Manual intervention required
[2025-01-18T08:22:08.000Z] [INFO] Checkpoint 'Pre-migration state' available for recovery`,
  "log-005-iter-1": `[2025-01-18T10:30:00.000Z] [INFO] Build Agent Epsilon starting iteration 1
[2025-01-18T10:30:01.000Z] [INFO] Loading task list: API Endpoints
[2025-01-18T10:30:05.000Z] [TASK] Starting: Create GET /api/tasks
[2025-01-18T10:32:00.000Z] [SUCCESS] ✓ Created GET /api/tasks endpoint
[2025-01-18T10:32:05.000Z] [TASK] Starting: Create POST /api/tasks
[2025-01-18T10:34:00.000Z] [SUCCESS] ✓ Created POST /api/tasks endpoint
[2025-01-18T10:34:01.000Z] [INFO] Iteration 1 completed successfully`,
  "log-005-iter-2": `[2025-01-18T10:40:00.000Z] [INFO] Build Agent Epsilon starting iteration 2
[2025-01-18T10:40:05.000Z] [TASK] Starting: Create PUT /api/tasks/:id
[2025-01-18T10:42:00.000Z] [SUCCESS] ✓ Created PUT /api/tasks/:id endpoint
[2025-01-18T10:42:05.000Z] [PAUSE] ⏸ Paused by user
[2025-01-18T10:42:06.000Z] [INFO] Session state saved. Can be resumed.`,
};

// Props
interface AgentSessionsViewProps {
  className?: string;
}

export default function AgentSessionsView({
  className,
}: AgentSessionsViewProps) {
  const [sessions] = useState<AgentSession[]>(generateFakeAgentSessions);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    new Set(["session-001-abc123"]),
  );
  const [selectedLogFile, setSelectedLogFile] = useState<{
    id: string;
    sessionName: string;
    iteration: number;
    allIterations: LoopIteration[];
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgentSessionStatus | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Build lineage map
  const sessionLineageMap = useMemo(() => {
    const map = new Map<string, AgentSession[]>();
    sessions.forEach((session) => {
      if (session.parentSessionId) {
        const children = map.get(session.parentSessionId) || [];
        children.push(session);
        map.set(session.parentSessionId, children);
      }
    });
    return map;
  }, [sessions]);

  // Filter sessions (only root sessions)
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (session.parentSessionId) return false;
      if (statusFilter !== "all" && session.status !== statusFilter)
        return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          session.agentName.toLowerCase().includes(query) ||
          session.projectName?.toLowerCase().includes(query) ||
          session.taskListName?.toLowerCase().includes(query) ||
          session.id.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [sessions, statusFilter, searchQuery]);

  const toggleRow = (sessionId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedRows(newExpanded);
  };

  const statusCounts = useMemo(() => {
    return {
      running: sessions.filter((s) => s.status === "running").length,
      completed: sessions.filter((s) => s.status === "completed").length,
      failed: sessions.filter((s) => s.status === "failed").length,
      paused: sessions.filter((s) => s.status === "paused").length,
    };
  }, [sessions]);

  const openLogModal = (
    logFileId: string,
    sessionName: string,
    iteration: number,
    allIterations: LoopIteration[],
  ) => {
    setSelectedLogFile({
      id: logFileId,
      sessionName,
      iteration,
      allIterations,
    });
  };

  return (
    <div className={clsx("flex flex-col", className)}>
      {/* Single table container */}
      <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col min-h-0">
        {/* Sticky header area - Stats, Search, Filters + Column Headers */}
        <div className="flex-shrink-0">
          {/* Stats, Search, and Filters row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-200">
            {/* Compact stats inline */}
            <div className="flex items-center gap-3">
              <StatBadge
                label="Running"
                value={statusCounts.running}
                color="blue"
                icon={PlayCircle}
              />
              <StatBadge
                label="Completed"
                value={statusCounts.completed}
                color="green"
                icon={CheckCircle}
              />
              <StatBadge
                label="Failed"
                value={statusCounts.failed}
                color="red"
                icon={XCircle}
              />
              <StatBadge
                label="Paused"
                value={statusCounts.paused}
                color="orange"
                icon={PauseCircle}
              />
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200" />

            {/* Filter dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as AgentSessionStatus | "all")
                }
                className="text-sm border-gray-300 rounded-md py-1"
              >
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="paused">Paused</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 text-sm border-gray-300 rounded-md py-1"
              />
            </div>
          </div>

          {/* Column headers - part of sticky area */}
          <div className="bg-gray-50 border-b border-gray-200 grid grid-cols-[40px_1fr_150px_180px_100px_100px_100px_100px] px-0">
            <div className="px-3 py-3"></div>
            <div className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Agent
            </div>
            <div className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Project
            </div>
            <div className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Task List
            </div>
            <div className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </div>
            <div className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Loop
            </div>
            <div className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tasks
            </div>
            <div className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Started
            </div>
          </div>
        </div>

        {/* Scrollable table body only */}
        <div className="overflow-y-auto max-h-[calc(100vh-380px)]">
          <table className="w-full table-fixed">
            <thead className="sr-only">
              <tr>
                <th className="w-8 px-3 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task List
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loop Progress
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <GitBranch className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No agent sessions found</p>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    childSessions={sessionLineageMap.get(session.id) || []}
                    isExpanded={expandedRows.has(session.id)}
                    onToggle={() => toggleRow(session.id)}
                    onViewLog={(logFileId, iteration) =>
                      openLogModal(
                        logFileId,
                        session.agentName,
                        iteration,
                        session.iterations,
                      )
                    }
                    expandedRows={expandedRows}
                    onToggleChild={(id) => toggleRow(id)}
                    sessionLineageMap={sessionLineageMap}
                    depth={0}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log file modal */}
      {selectedLogFile && (
        <LogFileModal
          logFileId={selectedLogFile.id}
          sessionName={selectedLogFile.sessionName}
          iteration={selectedLogFile.iteration}
          content={
            FAKE_LOG_CONTENTS[selectedLogFile.id] || "Log file not found"
          }
          allIterations={selectedLogFile.allIterations}
          onClose={() => setSelectedLogFile(null)}
          onNavigateIteration={(newLogFileId, newIteration) =>
            setSelectedLogFile((prev) =>
              prev
                ? { ...prev, id: newLogFileId, iteration: newIteration }
                : null,
            )
          }
        />
      )}
    </div>
  );
}

// Compact inline stat badge for header row
interface StatBadgeProps {
  label: string;
  value: number;
  color: "blue" | "green" | "red" | "orange";
  icon: typeof PlayCircle;
}

function StatBadge({ label, value, color, icon: Icon }: StatBadgeProps) {
  const colors = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    orange: "text-orange-600",
  };

  return (
    <div className={clsx("flex items-center gap-1.5", colors[color])}>
      <Icon className="h-4 w-4" />
      <span className="font-semibold">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

// Session Row component
interface SessionRowProps {
  session: AgentSession;
  childSessions: AgentSession[];
  isExpanded: boolean;
  onToggle: () => void;
  onViewLog: (logFileId: string, iteration: number) => void;
  expandedRows: Set<string>;
  onToggleChild: (id: string) => void;
  sessionLineageMap: Map<string, AgentSession[]>;
  depth: number;
}

function SessionRow({
  session,
  childSessions,
  isExpanded,
  onToggle,
  onViewLog,
  expandedRows,
  onToggleChild,
  sessionLineageMap,
  depth,
}: SessionRowProps) {
  const statusConfig = {
    running: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      icon: PlayCircle,
      badge: "bg-blue-100 text-blue-700",
    },
    completed: {
      bg: "bg-green-50",
      text: "text-green-700",
      icon: CheckCircle,
      badge: "bg-green-100 text-green-700",
    },
    failed: {
      bg: "bg-red-50",
      text: "text-red-700",
      icon: XCircle,
      badge: "bg-red-100 text-red-700",
    },
    paused: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      icon: PauseCircle,
      badge: "bg-orange-100 text-orange-700",
    },
    cancelled: {
      bg: "bg-gray-50",
      text: "text-gray-700",
      icon: XCircle,
      badge: "bg-gray-100 text-gray-700",
    },
  };

  const config = statusConfig[session.status];
  const StatusIcon = config.icon;

  return (
    <>
      {/* Main row */}
      <tr
        className={clsx(
          "hover:bg-gray-50 cursor-pointer transition-colors",
          isExpanded && config.bg,
        )}
        onClick={onToggle}
      >
        <td className="px-3 py-3">
          <button className="p-1 hover:bg-gray-200 rounded">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: depth * 20 }}
          >
            {depth > 0 && (
              <GitMerge className="h-4 w-4 text-indigo-400 flex-shrink-0" />
            )}
            <Bot className={clsx("h-4 w-4 flex-shrink-0", config.text)} />
            <span className="font-medium text-gray-900 truncate">
              {session.agentName}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[150px]">
          {session.projectName || "-"}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[180px]">
          {session.taskListName || "-"}
        </td>
        <td className="px-4 py-3">
          <span
            className={clsx(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
              config.badge,
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {session.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <span className="font-medium">{session.currentIteration}</span>
            <span className="text-gray-400">/</span>
            <span>{session.loopCount}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-3 w-3" />
              {session.totalTasksCompleted}
            </span>
            {session.totalTasksFailed > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" />
                {session.totalTasksFailed}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {new Date(session.startedAt).toLocaleTimeString()}
        </td>
      </tr>

      {/* Expanded row with horizontal loops */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-4 py-4 bg-gray-50 max-w-0">
            <div className="space-y-4">
              {/* Session ID */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="font-mono">ID: {session.id}</span>
                {session.parentSessionId && (
                  <span className="flex items-center gap-1">
                    <GitMerge className="h-3 w-3" />
                    Parent: {session.parentSessionId}
                  </span>
                )}
              </div>

              {/* Horizontal loop iterations */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <GitCommit className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Loop Iterations
                  </span>
                </div>
                <div className="w-full">
                  <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    <div className="flex gap-3 w-max">
                      {session.iterations.map((iteration) => (
                        <IterationCard
                          key={iteration.iteration}
                          iteration={iteration}
                          isLatest={
                            iteration.iteration === session.currentIteration
                          }
                          onViewLog={() =>
                            onViewLog(iteration.logFileId, iteration.iteration)
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Child sessions */}
              {childSessions.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <GitMerge className="h-4 w-4 text-indigo-400" />
                    <span className="text-sm font-medium text-gray-700">
                      Spawned Sessions ({childSessions.length})
                    </span>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <tbody className="divide-y divide-gray-200">
                        {childSessions.map((child) => (
                          <SessionRow
                            key={child.id}
                            session={child}
                            childSessions={
                              sessionLineageMap.get(child.id) || []
                            }
                            isExpanded={expandedRows.has(child.id)}
                            onToggle={() => onToggleChild(child.id)}
                            onViewLog={onViewLog}
                            expandedRows={expandedRows}
                            onToggleChild={onToggleChild}
                            sessionLineageMap={sessionLineageMap}
                            depth={depth + 1}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Iteration Card component (horizontal)
interface IterationCardProps {
  iteration: LoopIteration;
  isLatest: boolean;
  onViewLog: () => void;
}

function IterationCard({ iteration, isLatest, onViewLog }: IterationCardProps) {
  const statusColors = {
    running: {
      border: "border-blue-300",
      bg: "bg-blue-50",
      header: "bg-blue-100",
      text: "text-blue-700",
    },
    completed: {
      border: "border-green-300",
      bg: "bg-green-50",
      header: "bg-green-100",
      text: "text-green-700",
    },
    failed: {
      border: "border-red-300",
      bg: "bg-red-50",
      header: "bg-red-100",
      text: "text-red-700",
    },
    paused: {
      border: "border-orange-300",
      bg: "bg-orange-50",
      header: "bg-orange-100",
      text: "text-orange-700",
    },
    cancelled: {
      border: "border-gray-300",
      bg: "bg-gray-50",
      header: "bg-gray-100",
      text: "text-gray-700",
    },
  };

  const colors = statusColors[iteration.status];

  return (
    <div
      className={clsx(
        "flex-shrink-0 w-64 rounded-lg border-2 overflow-hidden",
        colors.border,
        isLatest && "ring-2 ring-blue-400 ring-offset-2",
      )}
    >
      {/* Header */}
      <div
        className={clsx(
          "px-3 py-2 flex items-center justify-between",
          colors.header,
        )}
      >
        <div className="flex items-center gap-2">
          <span className={clsx("font-bold text-sm", colors.text)}>
            #{iteration.iteration}
          </span>
          {iteration.status === "running" && (
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
        </div>
        <span className={clsx("text-xs font-medium", colors.text)}>
          {iteration.status}
        </span>
      </div>

      {/* Body */}
      <div className={clsx("px-3 py-2 space-y-2", colors.bg)}>
        {/* Time and duration */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(iteration.startedAt).toLocaleTimeString()}
          </span>
          {iteration.duration && (
            <span>{Math.round(iteration.duration / 1000)}s</span>
          )}
        </div>

        {/* Task counts */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            {iteration.tasksCompleted} done
          </span>
          {iteration.tasksFailed > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-3 w-3" />
              {iteration.tasksFailed} failed
            </span>
          )}
        </div>

        {/* Preview */}
        {iteration.logFilePreview && (
          <div className="text-xs font-mono bg-gray-900 text-gray-300 rounded p-2 max-h-16 overflow-hidden">
            {iteration.logFilePreview.split("\n").slice(0, 2).join("\n")}
            {iteration.logFilePreview.split("\n").length > 2 && "..."}
          </div>
        )}

        {/* Errors badge */}
        {iteration.errors && iteration.errors.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="h-3 w-3" />
            {iteration.errors.length} error(s)
          </div>
        )}

        {/* Checkpoints */}
        {iteration.checkpoints && iteration.checkpoints.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-indigo-600">
            <GitCommit className="h-3 w-3" />
            {iteration.checkpoints.length} checkpoint(s)
          </div>
        )}

        {/* View log button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewLog();
          }}
          className="w-full flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded py-1 transition-colors"
        >
          <FileText className="h-3 w-3" />
          <span className="font-mono">{iteration.logFileId}</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
