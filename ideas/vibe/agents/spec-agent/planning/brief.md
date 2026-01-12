# Specification Agent Brief

## Metadata

| Field | Value |
|-------|-------|
| **ID** | spec-agent |
| **Title** | Specification Agent |
| **Complexity** | complex |
| **Author** | Human (VER-001: Self-Spec) |
| **Created** | 2026-01-12 |

---

## Problem

After ideation and development sessions, ideas have rich context spread across multiple documents (README.md, development.md, target-users.md, research/*.md, planning/brief.md) but no structured implementation plan. Developers must:

1. Read all context documents manually
2. Synthesize requirements from scattered information
3. Design architecture without guidance
4. Create task lists from scratch
5. Guess at potential gotchas and pitfalls
6. Manually ensure consistency between documents

This manual specification process is time-consuming, inconsistent, and often misses important details hidden in the context files.

---

## Solution

Specification Agent is an AI-powered system that:

1. **Loads context** from the unified file system (all ideation artifacts)
2. **Parses briefs** to extract structured requirements
3. **Analyzes with Claude** to understand requirements deeply
4. **Generates specifications** following consistent templates
5. **Creates atomic tasks** with dependencies, gotchas, and validation
6. **Injects known gotchas** from the Knowledge Base
7. **Asks clarifying questions** when requirements are ambiguous

Spec Agent transforms messy ideation output into clean, actionable implementation specs that Build Agent can execute.

---

## MVP Scope

**In Scope:**
- Load context from idea folder (README, development, research, planning)
- Parse brief.md to extract structured fields
- Integrate with Claude API for requirement analysis
- Generate spec.md following standard template
- Generate tasks.md with atomic PIV-style tasks
- Inject gotchas from hardcoded list
- Query Knowledge Base for relevant gotchas
- Generate clarifying questions for ambiguous requirements
- Support multiple complexity levels (simple, medium, complex)

**Out of Scope:**
- Automatic architecture decisions (asks user)
- Complex multi-feature specs (one feature at a time)
- Integration with external APIs for research
- Automatic validation of generated specs
- Machine learning for requirement extraction
- Cross-idea dependency tracking

---

## Constraints

1. Must follow templates in templates/unified/build/
2. Must use existing CLAUDE.md conventions
3. Must support all idea folder structures
4. Must not modify source ideation documents
5. Must integrate with Communication Hub for questions
6. Must track token usage for cost awareness
7. Must generate valid YAML frontmatter

---

## Success Criteria

1. Given a simple brief, generates spec matching reference 80%+
2. Given a medium brief, generates spec matching reference 80%+
3. Generated specs pass schema validation
4. All YAML frontmatter is parseable
5. Task dependencies form valid DAG (no cycles)
6. Gotchas are injected for all relevant file types
7. Human can implement from generated spec without major questions

---

## Architecture Hints

```
Spec Agent Components:
├── core.ts              - Main orchestration and entry point
├── context-loader.ts    - Load files from idea folder
├── brief-parser.ts      - Extract structured data from brief.md
├── claude-client.ts     - Claude API integration
├── task-generator.ts    - Create atomic tasks with dependencies
├── gotcha-injector.ts   - Add gotchas from Knowledge Base
├── template-renderer.ts - Render spec.md and tasks.md
├── question-generator.ts - Create clarifying questions
└── prompts/
    ├── system.ts        - System prompt for Claude
    ├── analyze.ts       - Requirement analysis prompt
    └── tasks.ts         - Task generation prompt
```

**Execution Flow:**
```
1. Load brief from planning/brief.md
2. Parse brief into structured format
3. Load context (README, development, research, etc.)
4. Send to Claude for requirement analysis
5. Check for ambiguities - generate questions if needed
6. Wait for answers if blocking questions exist
7. Generate atomic tasks based on requirements
8. Inject gotchas from Knowledge Base
9. Render spec.md and tasks.md
10. Return output with metadata
```

---

## Database Schema

```sql
-- Specification runs (existing in specifications table)
CREATE TABLE IF NOT EXISTS specifications (
    id TEXT PRIMARY KEY,
    idea_slug TEXT NOT NULL,
    user_slug TEXT NOT NULL,
    spec_path TEXT NOT NULL,
    tasks_path TEXT NOT NULL,
    task_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    tokens_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    approved_at TEXT,
    completed_at TEXT
);

-- Spec Agent questions (uses existing questions table)
-- Questions generated during spec creation
-- stored with agent_type = 'spec'
```

---

## API Design

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/specs/generate | POST | Generate spec from brief |
| /api/specs/:id | GET | Get specification by ID |
| /api/specs/:id/tasks | GET | Get tasks for a spec |
| /api/specs/:id/approve | POST | Approve spec for building |
| /api/specs/:id/regenerate | POST | Regenerate with new parameters |
| /api/specs/validate | POST | Validate spec without saving |

---

## Integration Points

1. **Unified File System** - Read ideation artifacts from idea folders
2. **Knowledge Base** - Query for relevant gotchas and patterns
3. **Communication Hub** - Ask clarifying questions
4. **Build Agent** - Output consumed by Build Agent
5. **Claude API** - Requirement analysis and task generation

---

## Input/Output Contracts

**Input (brief.md):**
```yaml
---
id: feature-name
title: Feature Title
complexity: simple|medium|complex
---

## Problem
What problem are we solving?

## Solution
How we solve it.

## MVP Scope
What's in and out.

## Constraints
Technical and business constraints.

## Success Criteria
How we know it works.
```

**Output (spec.md):**
```yaml
---
id: feature-name
title: Feature Title
complexity: simple|medium|complex
status: draft
version: 1.0.0
generated: 2026-01-12
---

# Feature Title

## Overview
Problem and solution summary.

## Functional Requirements
- [FR-001] Requirement description (priority)

## Architecture
System design overview.

## API Design
Endpoint specifications.

## Data Models
TypeScript interfaces and SQL schemas.

## Known Gotchas
Relevant warnings from Knowledge Base.

## Validation Strategy
How to verify implementation.
```

**Output (tasks.md):**
```yaml
---
id: feature-name
complexity: medium
total_tasks: 12
phases:
  database: 2
  types: 1
  api: 4
  ui: 3
  tests: 2
---

# Feature Title - Implementation Tasks

## Tasks

### T-001: database - CREATE migration

```yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/XXX_feature.sql"
status: pending
requirements:
  - "Create table with proper columns"
gotchas:
  - "Use TEXT for dates in SQLite"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on: []
```
```

---

## Risk Mitigation

1. **Incomplete context**: Warn if key documents missing (README, brief)
2. **Claude failures**: Retry with exponential backoff, fallback to simpler prompts
3. **Invalid output**: Schema validation before returning
4. **Token limits**: Track usage, warn when approaching limits
5. **Circular dependencies**: DAG validation on generated tasks
6. **Missing gotchas**: Fallback to hardcoded list if Knowledge Base empty
