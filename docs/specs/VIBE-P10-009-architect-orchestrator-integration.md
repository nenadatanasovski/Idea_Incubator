# VIBE-P10-009: Integrate Architect Agent with Orchestrator

**Status**: Specification Complete
**Agent**: Spec Agent
**Created**: 2026-02-09
**Task ID**: VIBE-P10-009

## Overview

Register the Architect Agent in the orchestrator's task routing system to enable automatic dispatch of architecture-related tasks. This integration establishes the Architect Agent as a first-class worker agent alongside Build, QA, and Spec agents.

## Background

The Architect Agent has been implemented with full metadata registration (see `parent-harness/orchestrator/src/agents/metadata.ts:357-381`), but the orchestrator's task assignment logic does not recognize it as a worker agent. Tasks requiring architectural work cannot be automatically routed to the Architect Agent.

## Requirements

### P0 (Must Have)

1. **Agent Registry Integration**
   - Add `architect_agent` and `architect` to `TASK_WORKER_AGENTS` list in orchestrator
   - Ensure architect agent can be selected by `findSuitableAgent()` function

2. **Task Category Mapping**
   - Add category mappings in `categoryAgentMap`:
     - `architecture`: `['architect_agent', 'architect']`
     - `design`: `['architect_agent', 'architect']`
   - Tasks with these categories should route to Architect Agent first

3. **Task Type Routing** (if task.type field exists)
   - Map these task types to Architect Agent:
     - `architecture_design`
     - `tech_stack_selection`
     - `api_design`
     - `database_schema_design`
     - `infrastructure_design`

4. **Type Definitions**
   - Create `ArchitectTaskPayload` interface in orchestrator types
   - Include fields:
     - `requirements`: string - Project requirements
     - `constraints`: string[] - Technical constraints
     - `existingArchitecture?`: string - Path to existing architecture docs
     - `outputFormat`: 'full' | 'incremental' - Architecture document format

5. **Artifact Persistence**
   - Ensure architect outputs are saved to `artifacts/architecture/` directory
   - Store architecture documents as JSON with metadata:
     - `taskId`: string
     - `generatedAt`: ISO timestamp
     - `components`: Component[]
     - `techStack`: TechStack
     - `apiContracts`: APIContract[]
     - `databaseSchema`: Schema

6. **Handoff Protocol**
   - Define handoff from Architect to Build Agent (scaffold generation):
     - Architect Agent completes task → status = 'completed'
     - Orchestrator reads architect output from artifacts directory
     - Create follow-up task(s) for Build Agent with architecture as input
     - Build Agent receives architecture via task payload or file reference

### P1 (Should Have)

7. **Output Retrieval API**
   - Add endpoint: `GET /api/artifacts/architecture/:taskId`
   - Returns architecture document for given task

8. **Dashboard Visualization**
   - Display architect agent in agent list with 🏗️ emoji
   - Show architecture tasks in task pipeline

### P2 (Nice to Have)

9. **Architecture Validation**
   - Automatically trigger validation after architect completes
   - Use `ArchitectValidator` from validation system

10. **Progress Tracking**
    - Emit WebSocket events during architecture generation phases
    - Events: `architect:analyzing`, `architect:designing`, `architect:validating`

## Technical Design

### File Changes

**File**: `parent-harness/orchestrator/src/orchestrator/index.ts`

**Change 1**: Update `TASK_WORKER_AGENTS` constant (line 755)

```typescript
const TASK_WORKER_AGENTS = [
  "build_agent",
  "build",
  "qa_agent",
  "qa",
  "spec_agent",
  "spec",
  "architect_agent",
  "architect", // ADD THIS
];
```

**Change 2**: Update `categoryAgentMap` (line 772)

```typescript
const categoryAgentMap: Record<string, string[]> = {
  feature: ["build_agent", "build"],
  bug: ["build_agent", "build"],
  test: ["qa_agent", "qa"],
  documentation: ["spec_agent", "spec"],
  architecture: ["architect_agent", "architect"], // ADD THIS
  design: ["architect_agent", "architect"], // ADD THIS
};
```

**File**: `parent-harness/orchestrator/src/types.ts` (create if doesn't exist)

**Change 3**: Add ArchitectTaskPayload type

```typescript
export interface ArchitectTaskPayload {
  requirements: string;
  constraints: string[];
  existingArchitecture?: string;
  outputFormat: "full" | "incremental";
}

export interface ArchitectOutput {
  taskId: string;
  generatedAt: string;
  components: Component[];
  techStack: TechStack;
  apiContracts?: APIContract[];
  databaseSchema?: Schema;
}

export interface Component {
  name: string;
  type: "frontend" | "backend" | "database" | "infrastructure";
  description: string;
  dependencies: string[];
}

export interface TechStack {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  infrastructure?: string[];
}

export interface APIContract {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  request?: Schema;
  response?: Schema;
}

export interface Schema {
  [key: string]: any;
}
```

**File**: `parent-harness/orchestrator/src/spawner/index.ts`

**Change 4**: Add architecture output persistence (if not already handled)

```typescript
// After architect agent completes
if (agentType === "architect" || agentType === "architect_agent") {
  const artifactDir = path.join(process.cwd(), "artifacts", "architecture");
  await fs.promises.mkdir(artifactDir, { recursive: true });

  const outputPath = path.join(artifactDir, `${taskId}.json`);
  await fs.promises.writeFile(
    outputPath,
    JSON.stringify(architectOutput, null, 2),
  );

  console.log(`📦 Saved architecture output: ${outputPath}`);
}
```

### Handoff Protocol

1. **Architect Completion**:
   - Architect Agent completes architecture design
   - Saves output to `artifacts/architecture/{taskId}.json`
   - Updates task status to 'completed'
   - Emits `architect:complete` event

2. **Orchestrator Handoff**:
   - Orchestrator detects architect task completion
   - Reads architecture output from artifacts
   - Creates follow-up Build Agent task:
     - Title: "Scaffold {project} based on architecture"
     - Description: Reference to architecture artifact
     - Payload: `{ architectureFile: 'artifacts/architecture/{taskId}.json' }`

3. **Build Agent Scaffold**:
   - Build Agent reads architecture from artifact
   - Generates project scaffold (directories, files, boilerplate)
   - Implements basic structure according to architecture

### Database Schema

No changes needed - existing `tasks` table supports all required fields.

### API Endpoints

**Optional P1**: Add artifact retrieval endpoint

```typescript
// parent-harness/orchestrator/src/api/artifacts.ts
router.get("/architecture/:taskId", async (req, res) => {
  const { taskId } = req.params;
  const artifactPath = path.join(
    process.cwd(),
    "artifacts",
    "architecture",
    `${taskId}.json`,
  );

  if (!fs.existsSync(artifactPath)) {
    return res.status(404).json({ error: "Architecture not found" });
  }

  const architecture = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  res.json(architecture);
});
```

## Testing Strategy

### Unit Tests

1. **Agent Selection Tests**
   - Task with category='architecture' → selects architect_agent
   - Task with category='design' → selects architect_agent
   - Task with no category → falls back to build_agent (not architect)

2. **Type Tests**
   - ArchitectTaskPayload validates correctly
   - ArchitectOutput serializes/deserializes

### Integration Tests

1. **Task Routing**
   - Create architecture task → verify assigned to architect_agent
   - Architect completes → verify output saved to artifacts

2. **Handoff Protocol**
   - Architect completes → verify follow-up build task created
   - Build agent receives architecture reference

### E2E Tests

1. **Full Architecture Flow**
   - Create architecture task
   - Architect generates design
   - Output saved to artifacts
   - Build agent scaffolds project
   - QA validates scaffold structure

## Pass Criteria

- [ ] Architect agent registered in `TASK_WORKER_AGENTS` list
- [ ] Category mappings added for 'architecture' and 'design'
- [ ] `ArchitectTaskPayload` type exists in orchestrator types
- [ ] Architecture outputs saved to `artifacts/architecture/` directory
- [ ] Handoff protocol documented and implemented
- [ ] Test: Architecture task routes to architect_agent
- [ ] Test: Output persisted and retrievable

## Open Questions

1. Should we support task.type field for more granular routing (architecture_design, tech_stack_selection)?
2. Should handoff to Build Agent be automatic or require human approval?
3. Should we validate architecture before creating scaffold tasks?

## Dependencies

- Existing Architect Agent implementation (VIBE-P10-001 through VIBE-P10-008)
- Agent metadata registration (already complete)

## References

- Agent Metadata: `parent-harness/orchestrator/src/agents/metadata.ts:357-381`
- Orchestrator Task Assignment: `parent-harness/orchestrator/src/orchestrator/index.ts:750-791`
- Architect Agent Base: `agents/architect/index.ts`
