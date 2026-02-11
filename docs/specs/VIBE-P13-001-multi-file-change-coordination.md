# VIBE-P13-001: Multi-File Change Coordination System

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-02-09
**Priority:** P0 (Critical Path - Phase 13)
**Effort:** Medium (12-16 hours)
**Model:** Opus
**Agent Type:** spec_agent

---

## Overview

Upgrade the Build Agent to analyze feature requirements, identify all files needing changes, create a dependency-ordered change plan, and execute changes with transaction-like semantics that enable rollback on failure. This coordination system prevents partial implementations that break the codebase by ensuring either all changes succeed or none are applied.

### Problem Statement

**Current State:**

- Build Agent modifies files sequentially without upfront planning
- No visibility into which files need changes before execution starts
- Changes applied immediately without dependency ordering
- Failed changes leave codebase in inconsistent state (some files changed, others not)
- No rollback mechanism for partial failures
- Circular dependencies or missing files only discovered during execution

**Desired State:**

- Build Agent analyzes requirements and identifies all target files upfront
- Creates change plan with file dependencies (types before implementations)
- Validates plan before executing any changes (circular deps, missing files)
- Executes changes in correct dependency order
- Tracks git state before each change for rollback capability
- Rolls back all changes if any step fails (transaction semantics)
- Provides audit log of planned vs. executed changes

### Value Proposition

The Multi-File Change Coordination System is the **"All-or-Nothing Implementation Guarantee"** that prevents broken builds:

1. **Prevents Broken Builds** - Atomic changes or complete rollback
2. **Dependency Awareness** - Types defined before used
3. **Early Failure Detection** - Validate plan before modifying files
4. **Predictable Execution** - Clear audit trail of what will change
5. **Safe Experimentation** - Rollback enables retry with different approach
6. **Better Error Messages** - Clear indication of which file/step failed

---

## Requirements

### Functional Requirements

#### 1. Feature Analysis & File Identification

The Build Agent must analyze feature requirements and identify all files requiring changes:

**Input:** Feature specification with requirements

```typescript
interface FeatureRequirement {
  id: string;
  description: string;
  passCriteria: string[];
  affectedAreas: string[]; // e.g., ['database', 'api', 'ui']
}
```

**Output:** List of files needing changes with metadata

```typescript
interface FileChange {
  path: string; // e.g., 'server/types/user.ts'
  operation: "create" | "modify" | "delete";
  reason: string; // Why this file needs to change
  dependencies: string[]; // Paths of files that must change first
  priority: number; // Lower = earlier in execution order
}
```

**Analysis Strategy:**

- Parse feature description for entity names (e.g., "User authentication" → User type)
- Map requirements to layers (database → migrations, API → routes, UI → components)
- Identify type definition files (must change before implementations)
- Detect cross-file references (imports, type annotations)
- Check existing files vs. new files needed

#### 2. Dependency Graph Construction

Build a directed acyclic graph (DAG) of file dependencies:

**Dependency Rules:**

```typescript
interface DependencyRule {
  condition: (file: FileChange) => boolean;
  dependsOn: (file: FileChange) => string[]; // File paths
}

const DEPENDENCY_RULES: DependencyRule[] = [
  {
    // Type definitions must exist before implementations
    condition: (file) => file.path.includes("/types/"),
    dependsOn: () => [], // No dependencies
  },
  {
    // Implementations depend on types
    condition: (file) => !file.path.includes("/types/"),
    dependsOn: (file) => {
      // Extract imported types from file analysis
      return findTypeImports(file.path);
    },
  },
  {
    // Database migrations must run before API routes
    condition: (file) => file.path.includes("/migrations/"),
    dependsOn: () => [],
  },
  {
    // API routes depend on migrations (for schema)
    condition: (file) => file.path.includes("/routes/"),
    dependsOn: (file) => findMigrationDependencies(file.path),
  },
];
```

**Validation:**

- Detect circular dependencies (types.ts depends on utils.ts depends on types.ts)
- Ensure all dependencies reference files in the change plan
- Verify no missing files (dependency not in plan and doesn't exist)

#### 3. Change Plan Creation

Generate an ordered execution plan with phases:

**Plan Structure:**

```typescript
interface ChangePlan {
  id: string; // Unique plan ID
  featureId: string;
  createdAt: string;
  phases: ChangePhase[]; // Ordered execution phases
  totalFiles: number;
  estimatedDuration: number; // Seconds
  validationResult: PlanValidation;
}

interface ChangePhase {
  phase: number; // 0 = no deps, 1 = depends on phase 0, etc.
  files: FileChange[];
  canRunInParallel: boolean; // If files don't depend on each other
}

interface PlanValidation {
  valid: boolean;
  errors: string[]; // Blocking issues
  warnings: string[]; // Non-blocking issues
}
```

**Example Plan:**

```typescript
const examplePlan: ChangePlan = {
  id: 'plan-123',
  featureId: 'VIBE-AUTH-001',
  phases: [
    {
      phase: 0,
      files: [
        { path: 'server/types/user.ts', operation: 'create', dependencies: [], ... },
        { path: 'database/migrations/134_add_users.sql', operation: 'create', dependencies: [], ... },
      ],
      canRunInParallel: true,
    },
    {
      phase: 1,
      files: [
        { path: 'server/routes/auth.ts', operation: 'create', dependencies: ['server/types/user.ts'], ... },
      ],
      canRunInParallel: false,
    },
    {
      phase: 2,
      files: [
        { path: 'frontend/src/components/LoginForm.tsx', operation: 'create', dependencies: ['server/routes/auth.ts'], ... },
      ],
      canRunInParallel: false,
    },
  ],
  totalFiles: 4,
  estimatedDuration: 180, // 3 minutes
  validationResult: { valid: true, errors: [], warnings: [] },
};
```

#### 4. Transaction-Like Execution

Execute the plan with atomicity guarantees:

**Execution Strategy:**

```typescript
interface ExecutionResult {
  planId: string;
  status: "completed" | "failed" | "rolled_back";
  phasesCompleted: number;
  filesChanged: string[]; // Successfully modified files
  failedAt?: {
    phase: number;
    file: string;
    error: string;
  };
  rollbackLog?: RollbackAction[];
}

interface RollbackAction {
  file: string;
  action: "restore_from_git" | "delete_file" | "unstage";
  gitRef: string; // Commit hash before change
  success: boolean;
  timestamp: string;
}
```

**Execution Flow:**

1. **Pre-execution checkpoint** - Record current git state

   ```typescript
   const checkpoint = await git.getStatus();
   const headCommit = await git.getLastCommitHash();
   ```

2. **Phase-by-phase execution** - Execute phases in order

   ```typescript
   for (const phase of plan.phases) {
     for (const file of phase.files) {
       // Record git state before this file change
       const beforeState = await git.getFileState(file.path);

       // Apply change
       const result = await applyChange(file);

       if (!result.success) {
         // ROLLBACK ALL PREVIOUS CHANGES
         await rollbackToPlan(plan, phase.phase - 1);
         return { status: 'rolled_back', failedAt: { ... } };
       }

       // Track for potential rollback
       rollbackActions.push({
         file: file.path,
         action: 'restore_from_git',
         gitRef: beforeState.commitHash,
       });
     }
   }
   ```

3. **Success** - Commit all changes together
   ```typescript
   await git.stageAll(plan.filesChanged);
   await git.commit(`feat: ${plan.featureId}
   ```

All changes:
${plan.filesChanged.map(f => `- ${f}`).join('\n')}

Change plan: ${plan.id}`);

````

4. **Failure** - Rollback to initial state
```typescript
for (const action of rollbackActions.reverse()) {
  if (action.action === 'restore_from_git') {
    await git.checkoutFile(action.file, action.gitRef);
  } else if (action.action === 'delete_file') {
    await fs.unlink(action.file);
  }
}
````

#### 5. Git-Based Rollback

Use git operations for safe rollback:

**Rollback Strategy:**

```typescript
interface RollbackStrategy {
  // For modified existing files: restore from git
  restoreModified: async (filePath: string, commitHash: string) => {
    await execAsync(`git checkout ${commitHash} -- "${filePath}"`);
  };

  // For newly created files: delete and unstage
  removeCreated: async (filePath: string) => {
    if (await fs.exists(filePath)) {
      await fs.unlink(filePath);
    }
    await execAsync(`git rm --cached "${filePath}"`).catch(() => {});
  };

  // For deleted files: restore from git
  restoreDeleted: async (filePath: string, commitHash: string) => {
    await execAsync(`git checkout ${commitHash} -- "${filePath}"`);
  };

  // Nuclear option: reset entire working directory
  hardReset: async (commitHash: string) => {
    await execAsync(`git reset --hard ${commitHash}`);
  };
}
```

**Verification:**
After rollback, verify working directory matches pre-execution state:

```typescript
const postRollbackStatus = await git.getStatus();
assert.deepEqual(postRollbackStatus, preExecutionStatus);
```

#### 6. Plan Logging & Auditability

Log the plan before execution for debugging and audit:

**Log Entry:**

```typescript
interface PlanLog {
  planId: string;
  featureId: string;
  createdAt: string;
  planContent: ChangePlan; // Full plan serialized as JSON
  executionStartedAt?: string;
  executionCompletedAt?: string;
  status: "planned" | "executing" | "completed" | "failed" | "rolled_back";
  failureReason?: string;
}
```

**Database Storage:**

```sql
CREATE TABLE IF NOT EXISTS change_plans (
  id TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL,
  plan_content TEXT NOT NULL, -- JSON serialized ChangePlan
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT DEFAULT (datetime('now')),
  execution_started_at TEXT,
  execution_completed_at TEXT,
  failure_reason TEXT,
  rollback_log TEXT -- JSON serialized RollbackAction[]
);

CREATE INDEX idx_plans_feature ON change_plans(feature_id);
CREATE INDEX idx_plans_status ON change_plans(status);
```

### Non-Functional Requirements

#### Performance

- Change plan generation: < 5 seconds for features affecting < 20 files
- Dependency graph construction: < 2 seconds for < 50 file dependency graph
- Rollback execution: < 10 seconds for < 20 files
- Total overhead: < 10% of actual code generation time

#### Quality

- Dependency graph must be acyclic (no circular dependencies)
- Rollback must restore exact pre-execution state (verified by git diff)
- All file operations must succeed or be rolled back (no partial state)
- Plan validation must catch 100% of circular dependencies

#### Reliability

- Rollback succeeds even if individual file operations fail
- Git state tracked before every file operation
- Execution state persisted to database for crash recovery
- Rollback can be re-attempted if interrupted

#### Observability

- Change plan logged to database before execution
- Each file change logged with timestamp
- Rollback actions logged with success/failure
- WebSocket events emitted for plan creation, execution, and rollback

---

## Technical Design

### Architecture

```
Feature Requirement
    ↓
FileAnalyzer.identifyChanges(requirement)
    ↓
┌─────────────────────────────────────────────────────────┐
│             Multi-File Change Coordinator               │
│                                                          │
│  1. File Identification                                 │
│     → Parse requirement for entities, layers            │
│     → Map to file paths (types, migrations, routes)     │
│     → Determine operations (create/modify/delete)       │
│                                                          │
│  2. Dependency Analysis                                 │
│     → Extract imports from existing files               │
│     → Apply dependency rules (types → impl)             │
│     → Build dependency graph (DAG)                      │
│     → Validate for circular deps                        │
│                                                          │
│  3. Plan Creation                                       │
│     → Topological sort (dependency order)               │
│     → Group into phases (0 = no deps, 1 = deps on 0)    │
│     → Validate plan (missing files, conflicts)          │
│     → Log plan to database                              │
│                                                          │
│  4. Execution with Rollback Tracking                    │
│     → Record git state (commit hash)                    │
│     → For each phase in order:                          │
│       → For each file in phase:                         │
│         → Record file state (git ref)                   │
│         → Apply change (generate code, write file)      │
│         → If FAILS → rollback all previous changes      │
│         → Track rollback action                         │
│     → If all succeed → commit all changes together      │
│                                                          │
│  5. Rollback on Failure                                 │
│     → Reverse order through rollback actions            │
│     → For each action:                                  │
│       → restore_from_git: git checkout <ref> -- <file>  │
│       → delete_file: rm <file> && git rm --cached       │
│     → Verify: git status matches pre-execution state    │
│                                                          │
└─────────────────────────────────────────────────────────┘
    ↓
ExecutionResult: { completed | failed | rolled_back }
```

### Key Components

#### 1. FileAnalyzer (NEW)

**File:** `parent-harness/orchestrator/src/spawner/file-analyzer.ts`

```typescript
/**
 * Analyze feature requirements and identify files needing changes
 */
export class FileAnalyzer {
  /**
   * Identify all files that need to change for this feature
   */
  identifyChanges(requirement: FeatureRequirement): FileChange[] {
    const files: FileChange[] = [];

    // Extract entities from description (e.g., "User authentication" → User)
    const entities = this.extractEntities(requirement.description);

    for (const entity of entities) {
      // Add type definition file
      files.push({
        path: `server/types/${entity.toLowerCase()}.ts`,
        operation: "create",
        reason: `Define ${entity} type for type safety`,
        dependencies: [],
        priority: 0, // Types first
      });

      // Add migration if database affected
      if (requirement.affectedAreas.includes("database")) {
        files.push({
          path: `database/migrations/${this.getNextMigrationNumber()}_add_${entity.toLowerCase()}s.sql`,
          operation: "create",
          reason: `Create ${entity} table in database`,
          dependencies: [],
          priority: 0, // Migrations run early
        });
      }

      // Add API route if API affected
      if (requirement.affectedAreas.includes("api")) {
        files.push({
          path: `server/routes/${entity.toLowerCase()}s.ts`,
          operation: "create",
          reason: `Create API endpoints for ${entity}`,
          dependencies: [`server/types/${entity.toLowerCase()}.ts`],
          priority: 1, // After types
        });
      }

      // Add UI component if UI affected
      if (requirement.affectedAreas.includes("ui")) {
        files.push({
          path: `frontend/src/components/${entity}Form.tsx`,
          operation: "create",
          reason: `Create UI form for ${entity}`,
          dependencies: [`server/routes/${entity.toLowerCase()}s.ts`],
          priority: 2, // After API
        });
      }
    }

    return files;
  }

  /**
   * Extract entity names from requirement description
   * Example: "User authentication with OAuth" → ["User", "OAuth"]
   */
  private extractEntities(description: string): string[] {
    // Simple heuristic: capitalized words that look like entity names
    const words = description.split(/\s+/);
    const entities = words.filter((word) => {
      // Starts with capital, not common words like "The", "A", "An"
      return (
        /^[A-Z][a-z]+/.test(word) &&
        !["The", "A", "An", "This", "That"].includes(word)
      );
    });

    // Remove duplicates
    return [...new Set(entities)];
  }

  /**
   * Get next migration number by reading migrations directory
   */
  private getNextMigrationNumber(): string {
    // Read database/migrations/*.sql files
    // Find highest number, add 1, pad to 3 digits
    // e.g., 134 if highest is 133
    return "134"; // Simplified for spec
  }
}
```

#### 2. DependencyGraphBuilder (NEW)

**File:** `parent-harness/orchestrator/src/spawner/dependency-graph.ts`

```typescript
/**
 * Build dependency graph from file changes
 */
export class DependencyGraphBuilder {
  /**
   * Build directed acyclic graph (DAG) of file dependencies
   */
  buildGraph(files: FileChange[]): DependencyGraph {
    const nodes = new Map<string, GraphNode>();

    // Create nodes
    for (const file of files) {
      nodes.set(file.path, {
        file,
        dependencies: new Set(file.dependencies),
        dependents: new Set(),
      });
    }

    // Create edges (dependency → dependent relationships)
    for (const node of nodes.values()) {
      for (const depPath of node.dependencies) {
        const depNode = nodes.get(depPath);
        if (depNode) {
          depNode.dependents.add(node.file.path);
        }
      }
    }

    return { nodes, files };
  }

  /**
   * Validate graph for circular dependencies
   */
  validate(graph: DependencyGraph): PlanValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for circular dependencies using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (path: string, stack: string[]): boolean => {
      if (recursionStack.has(path)) {
        errors.push(`Circular dependency: ${[...stack, path].join(" → ")}`);
        return true;
      }

      if (visited.has(path)) {
        return false;
      }

      visited.add(path);
      recursionStack.add(path);
      stack.push(path);

      const node = graph.nodes.get(path);
      if (node) {
        for (const dep of node.dependencies) {
          if (detectCycle(dep, [...stack])) {
            return true;
          }
        }
      }

      recursionStack.delete(path);
      return false;
    };

    for (const path of graph.nodes.keys()) {
      if (!visited.has(path)) {
        detectCycle(path, []);
      }
    }

    // Check for missing dependencies
    for (const [path, node] of graph.nodes) {
      for (const dep of node.dependencies) {
        if (!graph.nodes.has(dep) && !fileExists(dep)) {
          errors.push(
            `File "${path}" depends on "${dep}" which doesn't exist and isn't in the change plan`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Topological sort to determine execution order
   */
  topologicalSort(graph: DependencyGraph): ChangePhase[] {
    const phases: ChangePhase[] = [];
    const phaseMap = new Map<string, number>();

    // Assign phase numbers (longest path from any root)
    const assignPhase = (path: string, visited: Set<string>): number => {
      if (phaseMap.has(path)) {
        return phaseMap.get(path)!;
      }

      if (visited.has(path)) {
        return 0; // Break cycles
      }

      visited.add(path);
      const node = graph.nodes.get(path);
      if (!node || node.dependencies.size === 0) {
        phaseMap.set(path, 0);
        return 0;
      }

      // Phase = max(dependency phases) + 1
      const depPhases = Array.from(node.dependencies).map((dep) =>
        assignPhase(dep, new Set(visited)),
      );
      const phase = Math.max(...depPhases, 0) + 1;
      phaseMap.set(path, phase);
      return phase;
    };

    // Assign all files to phases
    for (const path of graph.nodes.keys()) {
      assignPhase(path, new Set());
    }

    // Group files by phase
    const filesByPhase = new Map<number, FileChange[]>();
    for (const [path, phase] of phaseMap) {
      if (!filesByPhase.has(phase)) {
        filesByPhase.set(phase, []);
      }
      const node = graph.nodes.get(path);
      if (node) {
        filesByPhase.get(phase)!.push(node.file);
      }
    }

    // Create phase objects
    const phaseNumbers = Array.from(filesByPhase.keys()).sort((a, b) => a - b);
    for (const phaseNum of phaseNumbers) {
      const files = filesByPhase.get(phaseNum)!;
      phases.push({
        phase: phaseNum,
        files,
        canRunInParallel: files.every((f) =>
          files.every(
            (other) => f === other || !f.dependencies.includes(other.path),
          ),
        ),
      });
    }

    return phases;
  }
}

interface GraphNode {
  file: FileChange;
  dependencies: Set<string>;
  dependents: Set<string>;
}

interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  files: FileChange[];
}
```

#### 3. ChangePlanExecutor (NEW)

**File:** `parent-harness/orchestrator/src/spawner/change-plan-executor.ts`

```typescript
/**
 * Execute change plan with transaction-like atomicity
 */
export class ChangePlanExecutor {
  private git: GitIntegration;
  private codebaseRoot: string;

  constructor(codebaseRoot: string) {
    this.codebaseRoot = codebaseRoot;
    this.git = new GitIntegration({ cwd: codebaseRoot });
  }

  /**
   * Execute change plan with rollback on failure
   */
  async execute(plan: ChangePlan): Promise<ExecutionResult> {
    // Pre-execution: record git state
    const preExecutionCommit = await this.git.getLastCommitHash();
    const preExecutionStatus = await this.git.getStatus();
    const rollbackActions: RollbackAction[] = [];
    const filesChanged: string[] = [];

    try {
      // Execute phases in order
      for (let phaseNum = 0; phaseNum < plan.phases.length; phaseNum++) {
        const phase = plan.phases[phaseNum];

        for (const file of phase.files) {
          // Record state before this change
          const beforeState = await this.captureFileState(file.path);

          // Apply the change
          try {
            await this.applyFileChange(file);
            filesChanged.push(file.path);

            // Track rollback action
            rollbackActions.push({
              file: file.path,
              action:
                file.operation === "create"
                  ? "delete_file"
                  : "restore_from_git",
              gitRef: beforeState.commitHash || preExecutionCommit!,
              success: false, // Will be marked true after rollback succeeds
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            // FAILURE - rollback all previous changes
            console.error(`Failed to apply change to ${file.path}:`, error);

            const rollbackResult = await this.rollbackChanges(
              rollbackActions,
              preExecutionCommit!,
              preExecutionStatus,
            );

            return {
              planId: plan.id,
              status: "rolled_back",
              phasesCompleted: phaseNum,
              filesChanged,
              failedAt: {
                phase: phaseNum,
                file: file.path,
                error: error instanceof Error ? error.message : String(error),
              },
              rollbackLog: rollbackResult,
            };
          }
        }
      }

      // SUCCESS - commit all changes together
      await this.commitAllChanges(plan, filesChanged);

      return {
        planId: plan.id,
        status: "completed",
        phasesCompleted: plan.phases.length,
        filesChanged,
      };
    } catch (error) {
      // Unexpected error during execution
      const rollbackResult = await this.rollbackChanges(
        rollbackActions,
        preExecutionCommit!,
        preExecutionStatus,
      );

      return {
        planId: plan.id,
        status: "rolled_back",
        phasesCompleted: 0,
        filesChanged,
        failedAt: {
          phase: -1,
          file: "",
          error: error instanceof Error ? error.message : String(error),
        },
        rollbackLog: rollbackResult,
      };
    }
  }

  /**
   * Capture current state of a file for potential rollback
   */
  private async captureFileState(filePath: string): Promise<{
    exists: boolean;
    commitHash: string | null;
    content?: string;
  }> {
    const absolutePath = join(this.codebaseRoot, filePath);
    const exists = await fs.pathExists(absolutePath);

    if (exists) {
      // Get git commit that last modified this file
      try {
        const { stdout } = await execAsync(
          `git log -1 --format="%H" -- "${filePath}"`,
          { cwd: this.codebaseRoot },
        );
        return {
          exists: true,
          commitHash: stdout.trim() || (await this.git.getLastCommitHash()),
        };
      } catch {
        return {
          exists: true,
          commitHash: await this.git.getLastCommitHash(),
        };
      }
    } else {
      return {
        exists: false,
        commitHash: null,
      };
    }
  }

  /**
   * Apply a change to a file (generate code and write)
   */
  private async applyFileChange(file: FileChange): Promise<void> {
    const absolutePath = join(this.codebaseRoot, file.path);

    if (file.operation === "create") {
      // Ensure directory exists
      await fs.ensureDir(dirname(absolutePath));

      // Generate code (delegate to code generator)
      const code = await this.generateCode(file);

      // Write file
      await fs.writeFile(absolutePath, code, "utf-8");
    } else if (file.operation === "modify") {
      // Read existing file
      const existing = await fs.readFile(absolutePath, "utf-8");

      // Generate modifications
      const modified = await this.modifyCode(file, existing);

      // Write modified file
      await fs.writeFile(absolutePath, modified, "utf-8");
    } else if (file.operation === "delete") {
      // Delete file
      await fs.unlink(absolutePath);
    }
  }

  /**
   * Rollback all changes to pre-execution state
   */
  private async rollbackChanges(
    actions: RollbackAction[],
    preExecutionCommit: string,
    preExecutionStatus: GitStatusResult,
  ): Promise<RollbackAction[]> {
    console.log(`Rolling back ${actions.length} changes...`);

    // Execute rollback actions in reverse order
    for (const action of actions.reverse()) {
      try {
        if (action.action === "restore_from_git") {
          // Restore file from git
          await execAsync(`git checkout ${action.gitRef} -- "${action.file}"`, {
            cwd: this.codebaseRoot,
          });
        } else if (action.action === "delete_file") {
          // Delete newly created file
          const absolutePath = join(this.codebaseRoot, action.file);
          if (await fs.pathExists(absolutePath)) {
            await fs.unlink(absolutePath);
          }
          // Unstage if was staged
          await execAsync(`git rm --cached "${action.file}"`, {
            cwd: this.codebaseRoot,
          }).catch(() => {}); // Ignore errors (file may not be staged)
        }

        action.success = true;
      } catch (error) {
        console.error(`Rollback failed for ${action.file}:`, error);
        action.success = false;
      }
    }

    // Verify rollback succeeded
    const postRollbackStatus = await this.git.getStatus();
    if (
      JSON.stringify(postRollbackStatus) !== JSON.stringify(preExecutionStatus)
    ) {
      console.warn(
        "Rollback verification failed: git status differs from pre-execution state",
      );
    }

    return actions;
  }

  /**
   * Commit all changes together
   */
  private async commitAllChanges(
    plan: ChangePlan,
    filesChanged: string[],
  ): Promise<void> {
    // Stage all files
    for (const file of filesChanged) {
      await this.git.stageFile(file);
    }

    // Create commit message
    const message = `feat: ${plan.featureId}

Multi-file change coordination (plan ${plan.id})

Files changed:
${filesChanged.map((f) => `- ${f}`).join("\n")}

Total: ${filesChanged.length} files across ${plan.phases.length} phases`;

    // Commit
    await execAsync(`git commit -m "${this.escapeQuotes(message)}"`, {
      cwd: this.codebaseRoot,
    });
  }

  // Placeholder methods (implemented by other components)
  private async generateCode(file: FileChange): Promise<string> {
    // Delegate to CodeGenerator
    return "// Generated code placeholder";
  }

  private async modifyCode(
    file: FileChange,
    existing: string,
  ): Promise<string> {
    // Delegate to CodeGenerator
    return existing + "\n// Modified code placeholder";
  }

  private escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"');
  }
}
```

### Database Schema

```sql
-- Change plan storage
CREATE TABLE IF NOT EXISTS change_plans (
  id TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL,
  plan_content TEXT NOT NULL, -- JSON serialized ChangePlan
  status TEXT NOT NULL DEFAULT 'planned', -- 'planned' | 'executing' | 'completed' | 'failed' | 'rolled_back'
  created_at TEXT DEFAULT (datetime('now')),
  execution_started_at TEXT,
  execution_completed_at TEXT,
  failure_reason TEXT,
  rollback_log TEXT, -- JSON serialized RollbackAction[]
  CONSTRAINT valid_status CHECK (status IN ('planned', 'executing', 'completed', 'failed', 'rolled_back'))
);

CREATE INDEX idx_plans_feature ON change_plans(feature_id);
CREATE INDEX idx_plans_status ON change_plans(status);
CREATE INDEX idx_plans_created ON change_plans(created_at DESC);

-- File changes (denormalized for quick queries)
CREATE TABLE IF NOT EXISTS change_plan_files (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'create' | 'modify' | 'delete'
  phase_number INTEGER NOT NULL,
  dependencies TEXT, -- JSON array of file paths
  reason TEXT,
  executed INTEGER DEFAULT 0,
  rolled_back INTEGER DEFAULT 0,
  FOREIGN KEY (plan_id) REFERENCES change_plans(id),
  CONSTRAINT valid_operation CHECK (operation IN ('create', 'modify', 'delete'))
);

CREATE INDEX idx_plan_files_plan ON change_plan_files(plan_id);
CREATE INDEX idx_plan_files_phase ON change_plan_files(plan_id, phase_number);
```

### Integration Points

#### 1. Build Agent Integration

The Multi-File Change Coordinator integrates into the existing Build Agent execution flow:

**File:** `agents/build/task-executor.ts`

```typescript
import { FileAnalyzer } from "./file-analyzer.js";
import { DependencyGraphBuilder } from "./dependency-graph.js";
import { ChangePlanExecutor } from "./change-plan-executor.js";

export class TaskExecutor {
  private fileAnalyzer: FileAnalyzer;
  private graphBuilder: DependencyGraphBuilder;
  private planExecutor: ChangePlanExecutor;

  constructor(options: TaskExecutorOptions = {}) {
    // ... existing initialization
    this.fileAnalyzer = new FileAnalyzer();
    this.graphBuilder = new DependencyGraphBuilder();
    this.planExecutor = new ChangePlanExecutor(
      options.codebaseRoot || process.cwd(),
    );
  }

  /**
   * Execute task with multi-file change coordination
   */
  async executeOne(
    task: AtomicTask,
    context: TaskContext,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Step 1: Analyze task and identify file changes
      const fileChanges = this.fileAnalyzer.identifyChanges({
        id: task.id,
        description: task.action,
        passCriteria: task.validation ? [task.validation.expected] : [],
        affectedAreas: this.inferAffectedAreas(task),
      });

      // Step 2: Build dependency graph
      const graph = this.graphBuilder.buildGraph(fileChanges);

      // Step 3: Validate graph
      const validation = this.graphBuilder.validate(graph);
      if (!validation.valid) {
        throw new Error(
          `Change plan validation failed: ${validation.errors.join("; ")}`,
        );
      }

      // Step 4: Create execution plan
      const phases = this.graphBuilder.topologicalSort(graph);
      const plan: ChangePlan = {
        id: uuidv4(),
        featureId: task.id,
        createdAt: new Date().toISOString(),
        phases,
        totalFiles: fileChanges.length,
        estimatedDuration: fileChanges.length * 10, // 10 seconds per file estimate
        validationResult: validation,
      };

      // Step 5: Log plan to database
      await this.logPlan(plan);

      // Step 6: Execute plan with rollback capability
      const executionResult = await this.planExecutor.execute(plan);

      if (executionResult.status === "completed") {
        return {
          taskId: task.id,
          state: "done",
          output: `Successfully changed ${executionResult.filesChanged.length} files`,
          duration: Date.now() - startTime,
          attempt: 1,
        };
      } else {
        throw new Error(
          `Change plan failed at ${executionResult.failedAt?.file}: ${executionResult.failedAt?.error}`,
        );
      }
    } catch (error) {
      return {
        taskId: task.id,
        state: "failed",
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        attempt: 1,
      };
    }
  }

  private inferAffectedAreas(task: AtomicTask): string[] {
    const areas: string[] = [];
    if (task.file.includes("migrations/")) areas.push("database");
    if (task.file.includes("routes/")) areas.push("api");
    if (task.file.includes("components/")) areas.push("ui");
    return areas;
  }

  private async logPlan(plan: ChangePlan): Promise<void> {
    run(
      `INSERT INTO change_plans (id, feature_id, plan_content, status) VALUES (?, ?, ?, ?)`,
      [plan.id, plan.featureId, JSON.stringify(plan), "planned"],
    );
  }
}
```

#### 2. Spawner Integration

The spawner can expose change plan management endpoints:

**File:** `parent-harness/orchestrator/src/spawner/index.ts`

```typescript
export { FileAnalyzer } from "./file-analyzer.js";
export { DependencyGraphBuilder } from "./dependency-graph.js";
export { ChangePlanExecutor } from "./change-plan-executor.js";

/**
 * Create a change plan without executing it (for preview)
 */
export async function createChangePlan(
  requirement: FeatureRequirement,
): Promise<ChangePlan> {
  const analyzer = new FileAnalyzer();
  const graphBuilder = new DependencyGraphBuilder();

  const files = analyzer.identifyChanges(requirement);
  const graph = graphBuilder.buildGraph(files);
  const validation = graphBuilder.validate(graph);
  const phases = graphBuilder.topologicalSort(graph);

  return {
    id: uuidv4(),
    featureId: requirement.id,
    createdAt: new Date().toISOString(),
    phases,
    totalFiles: files.length,
    estimatedDuration: files.length * 10,
    validationResult: validation,
  };
}

/**
 * Execute a pre-created change plan
 */
export async function executeChangePlan(
  planId: string,
): Promise<ExecutionResult> {
  const executor = new ChangePlanExecutor(CODEBASE_ROOT);

  // Load plan from database
  const row = getOne<{ plan_content: string }>(
    "SELECT plan_content FROM change_plans WHERE id = ?",
    [planId],
  );

  if (!row) {
    throw new Error(`Change plan ${planId} not found`);
  }

  const plan = JSON.parse(row.plan_content) as ChangePlan;
  return await executor.execute(plan);
}
```

---

## Pass Criteria

### 1. ✅ Build Agent Identifies 3+ Files for Feature

**Test:**

```typescript
const requirement: FeatureRequirement = {
  id: "TEST-001",
  description: "User authentication with JWT tokens",
  passCriteria: ["Users can register", "Users can login", "JWT tokens issued"],
  affectedAreas: ["database", "api", "ui"],
};

const analyzer = new FileAnalyzer();
const files = analyzer.identifyChanges(requirement);

assert(files.length >= 3, "Should identify at least 3 files");
assert(
  files.some((f) => f.path.includes("/types/")),
  "Should include type definition",
);
assert(
  files.some((f) => f.path.includes("/migrations/")),
  "Should include database migration",
);
assert(
  files.some((f) => f.path.includes("/routes/")),
  "Should include API route",
);
```

**Expected:** Analyzer identifies type file, migration, route, and component files.

### 2. ✅ Changes Execute in Dependency Order

**Test:**

```typescript
const files: FileChange[] = [
  { path: 'server/routes/users.ts', operation: 'create', dependencies: ['server/types/user.ts'], ... },
  { path: 'server/types/user.ts', operation: 'create', dependencies: [], ... },
];

const graphBuilder = new DependencyGraphBuilder();
const graph = graphBuilder.buildGraph(files);
const phases = graphBuilder.topologicalSort(graph);

assert(phases.length === 2, 'Should create 2 phases');
assert(phases[0].files[0].path === 'server/types/user.ts', 'Types should be in phase 0');
assert(phases[1].files[0].path === 'server/routes/users.ts', 'Routes should be in phase 1');
```

**Expected:** Types defined before implementations that depend on them.

### 3. ✅ Failed Change Triggers Rollback

**Test:**

```typescript
const mockExecutor = new ChangePlanExecutor('/tmp/test-repo');

// Simulate failure on second file
mockExecutor['applyFileChange'] = async (file: FileChange) => {
  if (file.path.includes('routes')) {
    throw new Error('Simulated failure');
  }
};

const plan: ChangePlan = {
  id: 'test-plan',
  featureId: 'TEST-001',
  phases: [
    { phase: 0, files: [{ path: 'server/types/user.ts', operation: 'create', dependencies: [], ... }], ... },
    { phase: 1, files: [{ path: 'server/routes/users.ts', operation: 'create', dependencies: ['server/types/user.ts'], ... }], ... },
  ],
  ...
};

const result = await mockExecutor.execute(plan);

assert(result.status === 'rolled_back', 'Should rollback on failure');
assert(result.phasesCompleted === 1, 'Should have completed phase 0 before failing');
assert(result.failedAt?.file === 'server/routes/users.ts', 'Should identify failed file');
assert(!fs.existsSync('/tmp/test-repo/server/types/user.ts'), 'Should rollback created files');
```

**Expected:** First file created, second file fails, first file rolled back.

### 4. ✅ Change Plan Logged Before Execution

**Test:**

```typescript
const plan: ChangePlan = {
  id: 'log-test',
  featureId: 'TEST-002',
  phases: [...],
  ...
};

// Log plan
run(
  `INSERT INTO change_plans (id, feature_id, plan_content, status) VALUES (?, ?, ?, ?)`,
  [plan.id, plan.featureId, JSON.stringify(plan), 'planned']
);

// Verify logged
const logged = getOne<{ id: string; plan_content: string }>(
  'SELECT id, plan_content FROM change_plans WHERE id = ?',
  [plan.id]
);

assert(logged !== undefined, 'Plan should be logged');
assert(logged.id === plan.id, 'Plan ID should match');

const deserialized = JSON.parse(logged.plan_content);
assert(deserialized.featureId === 'TEST-002', 'Plan content should be preserved');
```

**Expected:** Plan persisted to database with full details before execution starts.

---

## Dependencies

### Upstream (must exist first)

- ✅ Build Agent (`agents/build/task-executor.ts`) - Will be extended
- ✅ Git Integration (`agents/build/git-integration.ts`) - Provides rollback primitives
- ✅ Code Generator (`agents/build/code-generator.ts`) - Generates file content
- ✅ File Writer (`agents/build/file-writer.ts`) - Writes files to disk
- ✅ Task system (`parent-harness/orchestrator/src/db/tasks.ts`) - Task tracking

### Downstream (depends on this)

- VIBE-P13-005: Feature Orchestration Layer (will use this for layer coordination)
- Future: Parallel file execution within phases (currently serial)

### External Dependencies

- Git (for rollback: `git checkout`, `git rm --cached`)
- Node.js fs-extra (for file operations with atomic writes)
- TypeScript AST parser (for extracting imports and dependencies)

---

## Implementation Plan

### Phase 1: File Analyzer (3-4 hours)

**Tasks:**

1. Create `file-analyzer.ts` in spawner directory
2. Implement `FileAnalyzer` class
3. Add entity extraction from requirement descriptions
4. Add layer-to-file mapping (database → migrations, api → routes, ui → components)
5. Add migration number auto-increment logic
6. Write unit tests for file identification

**Deliverables:**

- `FileAnalyzer.identifyChanges()` returns list of files with dependencies
- Handles database, API, and UI layers
- Infers file paths from entity names

### Phase 2: Dependency Graph Builder (4-5 hours)

**Tasks:**

1. Create `dependency-graph.ts`
2. Implement `DependencyGraphBuilder` class
3. Add DAG construction from file changes
4. Add circular dependency detection (DFS)
5. Add missing dependency validation
6. Add topological sort for execution order
7. Write unit tests for graph operations

**Deliverables:**

- `DependencyGraphBuilder.buildGraph()` constructs DAG
- `DependencyGraphBuilder.validate()` catches circular dependencies
- `DependencyGraphBuilder.topologicalSort()` returns execution phases

### Phase 3: Change Plan Executor (5-6 hours)

**Tasks:**

1. Create `change-plan-executor.ts`
2. Implement `ChangePlanExecutor` class
3. Add git state capture before execution
4. Add phase-by-phase execution with rollback tracking
5. Add rollback logic (restore from git, delete created files)
6. Add commit logic (stage all, commit with message)
7. Add rollback verification (git diff check)
8. Write integration tests for execution

**Deliverables:**

- `ChangePlanExecutor.execute()` runs plan with atomicity
- Rollback restores exact pre-execution state
- All changes committed together on success

### Phase 4: Database Schema & Persistence (2-3 hours)

**Tasks:**

1. Create migration for change_plans table
2. Create migration for change_plan_files table
3. Add indexes for query performance
4. Add plan logging helper functions
5. Add plan retrieval helper functions
6. Write tests for persistence

**Deliverables:**

- Database tables created
- Plan logging before execution
- Plan querying for audit and debugging

### Phase 5: Build Agent Integration (2-3 hours)

**Tasks:**

1. Import new components into `task-executor.ts`
2. Add change plan creation in `executeOne()`
3. Add plan validation before execution
4. Add plan logging to database
5. Add execution delegation to `ChangePlanExecutor`
6. Update error handling to include rollback info
7. Write integration tests

**Deliverables:**

- `TaskExecutor.executeOne()` uses change coordination
- Tasks execute with rollback on failure
- Plans logged to database

### Phase 6: End-to-End Testing (2-3 hours)

**Tasks:**

1. Create test fixture: multi-file feature
2. Test success path (all files created, committed)
3. Test failure path (partial execution, rollback)
4. Test circular dependency detection
5. Test missing dependency detection
6. Test rollback verification
7. Test plan logging and retrieval

**Deliverables:**

- 6+ end-to-end test scenarios
- All pass criteria validated
- Integration with full build agent confirmed

**Total Estimated Time:** 12-16 hours (2-3 days)

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/spawner/file-analyzer.test.ts`

```typescript
describe("FileAnalyzer", () => {
  it("should identify type, migration, route, and component files", () => {
    const analyzer = new FileAnalyzer();
    const requirement: FeatureRequirement = {
      id: "TEST-001",
      description: "User authentication system",
      passCriteria: ["Users can register"],
      affectedAreas: ["database", "api", "ui"],
    };

    const files = analyzer.identifyChanges(requirement);

    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files.find((f) => f.path.includes("types/user.ts"))).toBeDefined();
    expect(files.find((f) => f.path.includes("migrations/"))).toBeDefined();
    expect(files.find((f) => f.path.includes("routes/users.ts"))).toBeDefined();
    expect(
      files.find((f) => f.path.includes("components/UserForm.tsx")),
    ).toBeDefined();
  });
});
```

**File:** `tests/unit/spawner/dependency-graph.test.ts`

```typescript
describe('DependencyGraphBuilder', () => {
  it('should detect circular dependencies', () => {
    const graphBuilder = new DependencyGraphBuilder();
    const files: FileChange[] = [
      { path: 'a.ts', operation: 'create', dependencies: ['b.ts'], ... },
      { path: 'b.ts', operation: 'create', dependencies: ['c.ts'], ... },
      { path: 'c.ts', operation: 'create', dependencies: ['a.ts'], ... },
    ];

    const graph = graphBuilder.buildGraph(files);
    const validation = graphBuilder.validate(graph);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(expect.stringMatching(/circular dependency/i));
  });

  it('should create phases in dependency order', () => {
    const graphBuilder = new DependencyGraphBuilder();
    const files: FileChange[] = [
      { path: 'impl.ts', operation: 'create', dependencies: ['types.ts'], ... },
      { path: 'types.ts', operation: 'create', dependencies: [], ... },
    ];

    const graph = graphBuilder.buildGraph(files);
    const phases = graphBuilder.topologicalSort(graph);

    expect(phases.length).toBe(2);
    expect(phases[0].files[0].path).toBe('types.ts');
    expect(phases[1].files[0].path).toBe('impl.ts');
  });
});
```

### Integration Tests

**File:** `tests/integration/spawner/change-plan-execution.test.ts`

```typescript
describe("ChangePlanExecutor", () => {
  it("should rollback on failure", async () => {
    const testDir = "/tmp/test-change-plan";
    await fs.ensureDir(testDir);

    // Initialize git repo
    await execAsync("git init", { cwd: testDir });
    await execAsync('git config user.name "Test"', { cwd: testDir });
    await execAsync('git config user.email "test@test.com"', { cwd: testDir });

    const executor = new ChangePlanExecutor(testDir);

    // Create plan with intentional failure
    const plan: ChangePlan = {
      id: "rollback-test",
      featureId: "TEST-ROLLBACK",
      phases: [
        {
          phase: 0,
          files: [
            {
              path: "success.ts",
              operation: "create",
              dependencies: [],
              reason: "Test",
              priority: 0,
            },
          ],
          canRunInParallel: false,
        },
        {
          phase: 1,
          files: [
            {
              path: "/invalid/path/fail.ts",
              operation: "create",
              dependencies: ["success.ts"],
              reason: "Test",
              priority: 1,
            },
          ],
          canRunInParallel: false,
        },
      ],
      totalFiles: 2,
      estimatedDuration: 20,
      validationResult: { valid: true, errors: [], warnings: [] },
    };

    const result = await executor.execute(plan);

    expect(result.status).toBe("rolled_back");
    expect(result.filesChanged).toContain("success.ts");
    expect(await fs.pathExists(join(testDir, "success.ts"))).toBe(false);
  });
});
```

### Manual Testing Checklist

- [ ] File analyzer identifies all affected files for a multi-layer feature
- [ ] Dependency graph builder creates correct execution phases
- [ ] Circular dependency detection catches type ↔ impl cycles
- [ ] Missing dependency detection catches references to non-existent files
- [ ] Execution applies changes in dependency order (types before impl)
- [ ] Failed change triggers rollback of all previous changes
- [ ] Rollback restores exact pre-execution git state
- [ ] Successful execution commits all changes together
- [ ] Change plan logged to database before execution
- [ ] WebSocket events emitted for plan creation and execution

---

## Success Metrics

### Short-term (1 week)

1. **Plan Creation Success**: 90% of features generate valid change plans
2. **Dependency Detection**: 100% of circular dependencies caught before execution
3. **Rollback Success**: 100% of failed executions rollback cleanly
4. **Execution Atomicity**: 0% partial implementations (all files or none)

### Medium-term (2 weeks)

1. **Build Stability**: <1% broken builds due to partial implementations
2. **Developer Confidence**: Positive feedback on rollback safety
3. **Execution Speed**: <5% overhead from change coordination
4. **Audit Trail**: 100% of change plans logged and queryable

### Long-term (1 month)

1. **Zero Broken Builds**: No partial implementations escape to codebase
2. **Pattern Learning**: Analyzer identifies 95% of affected files correctly
3. **Parallel Execution**: Phases with independent files run in parallel
4. **Self-Healing**: Failed tasks retry with adjusted change plans

---

## Open Questions

### 1. Granularity of Rollback?

**Question:** Should rollback be file-by-file or all-at-once?

**Options:**

- **A:** File-by-file (granular, slower, easier to debug)
- **B:** All-at-once (fast, harder to debug, uses `git reset --hard`)

**Recommendation:** **A** for Phase 13 (safer, easier debugging). Optimize to **B** later.

### 2. Plan Validation Depth?

**Question:** How deep should pre-execution validation go?

**Options:**

- **A:** Light (check circular deps only)
- **B:** Medium (check circular deps + missing files)
- **C:** Deep (check circular deps + missing files + TypeScript type compatibility)

**Recommendation:** **B** for Phase 13. Add **C** in future enhancement.

### 3. Parallelization Strategy?

**Question:** Should files in the same phase execute in parallel or serial?

**Options:**

- **A:** Always serial (simple, predictable)
- **B:** Parallel if `canRunInParallel` is true (faster, more complex)

**Recommendation:** **A** for Phase 13. Add **B** in future optimization phase.

---

## References

### Existing Specifications

- **VIBE-P13-005**: Feature Orchestration Layer (depends on this)
- **PHASE2-TASK-02**: Build Agent Task Executor (extended by this)

### Code References

- **agents/build/task-executor.ts**: Task execution (will be extended)
- **agents/build/git-integration.ts**: Git operations for rollback
- **parent-harness/orchestrator/src/spawner/feature-orchestrator.ts**: Similar coordination pattern

---

## Conclusion

VIBE-P13-001 adds multi-file change coordination to the Build Agent, preventing broken builds by ensuring atomic changes across multiple files. By analyzing requirements upfront, constructing dependency graphs, validating plans before execution, and enabling complete rollback on failure, this system provides the foundation for reliable autonomous code generation.

**Key Success Factors:**

1. **Dependency Awareness** - Correct execution order prevents missing type errors
2. **Transaction Semantics** - All changes succeed or all are rolled back
3. **Early Validation** - Catch circular dependencies before modifying files
4. **Audit Trail** - Plans logged for debugging and analysis

**Next Steps:**

1. **Approval** - Review and approve this specification
2. **Implementation** - Assign to Build Agent (6 phases, 12-16 hours)
3. **Validation** - QA Agent verifies against 4 pass criteria
4. **Integration** - Test with multi-layer feature implementations

**Status:** Ready for implementation.

TASK_COMPLETE: Created comprehensive technical specification for Multi-File Change Coordination System (VIBE-P13-001) covering file analysis, dependency graph construction, change plan creation, transaction-like execution with rollback, and git-based state restoration. Specification includes 4 testable pass criteria, detailed technical design with 3 key components, 6-phase implementation plan (12-16 hours), and integration with existing Build Agent infrastructure.
