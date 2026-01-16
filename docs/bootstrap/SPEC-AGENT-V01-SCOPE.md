# Spec Agent v0.1 Scope Definition

---

## Overview

Spec Agent v0.1 is a focused, minimal implementation that transforms feature briefs into technical specifications and task breakdowns. This document defines the exact boundaries of what v0.1 can and cannot do.

**Version:** 0.1
**Status:** In Development
**Last Updated:** 2026-01-10

---

## What Spec Agent v0.1 CAN Do

### Input Processing

| #   | Capability               | Description                                         |
| --- | ------------------------ | --------------------------------------------------- |
| ✓ 1 | Read brief.md            | Parse planning/brief.md from idea folder            |
| ✓ 2 | Read README.md           | Extract idea overview from README.md                |
| ✓ 3 | Read problem-solution.md | Use problem framing for context                     |
| ✓ 4 | Parse YAML frontmatter   | Extract metadata from brief (id, title, complexity) |
| ✓ 5 | Detect complexity level  | Use complexity field or infer from scope            |

### Claude Integration

| #    | Capability               | Description                                |
| ---- | ------------------------ | ------------------------------------------ |
| ✓ 6  | Single prompt generation | Generate spec from one Claude call         |
| ✓ 7  | Template-guided output   | Use spec.md template to structure response |
| ✓ 8  | Context injection        | Include CLAUDE.md patterns in prompt       |
| ✓ 9  | Reference existing code  | Read existing files mentioned in brief     |
| ✓ 10 | Structured JSON output   | Request JSON for YAML task blocks          |

### Output Generation

| #    | Capability             | Description                                |
| ---- | ---------------------- | ------------------------------------------ |
| ✓ 11 | Generate spec.md       | Create full technical specification        |
| ✓ 12 | Generate tasks.md      | Create phased task breakdown               |
| ✓ 13 | Valid YAML frontmatter | Generate parseable frontmatter             |
| ✓ 14 | Valid YAML task blocks | Generate parseable task definitions        |
| ✓ 15 | Correct task counts    | Simple: 5-8, Medium: 10-15, Complex: 20-30 |

### Gotcha Handling

| #    | Capability                | Description                                  |
| ---- | ------------------------- | -------------------------------------------- |
| ✓ 16 | Include common gotchas    | Add known patterns (SQLite TEXT dates, etc.) |
| ✓ 17 | Per-task gotchas          | Include relevant gotchas in each task block  |
| ✓ 18 | Gotcha source attribution | Mark gotchas as Knowledge Base or Experience |

### Template Compliance

| #    | Capability                  | Description                                         |
| ---- | --------------------------- | --------------------------------------------------- |
| ✓ 19 | Follow spec.md template     | Match all required sections                         |
| ✓ 20 | Follow tasks.md template    | Match task block structure                          |
| ✓ 21 | Use correct phases          | database → types → queries → services → api → tests |
| ✓ 22 | Include validation commands | Add npx tsc, test commands                          |

---

## What Spec Agent v0.1 CANNOT Do

### Knowledge Base Integration

| #   | Limitation                             | Deferred To |
| --- | -------------------------------------- | ----------- |
| ✗ 1 | Query Knowledge Base dynamically       | v0.2        |
| ✗ 2 | Learn new gotchas from execution       | v0.2        |
| ✗ 3 | Pattern matching across projects       | v0.2        |
| ✗ 4 | Update Knowledge Base with discoveries | v0.2        |

### Complex Analysis

| #   | Limitation                       | Deferred To |
| --- | -------------------------------- | ----------- |
| ✗ 5 | Multi-file dependency analysis   | v0.2        |
| ✗ 6 | Impact analysis on existing code | v0.3        |
| ✗ 7 | Performance prediction           | v0.3        |
| ✗ 8 | Security vulnerability detection | v0.3        |

### Advanced Features

| #    | Limitation                       | Deferred To |
| ---- | -------------------------------- | ----------- |
| ✗ 9  | Interactive refinement with user | v0.2        |
| ✗ 10 | Multiple spec variants           | v0.2        |
| ✗ 11 | Automatic brief clarification    | v0.2        |
| ✗ 12 | Cross-idea dependency detection  | v0.3        |
| ✗ 13 | Resource estimation              | v0.3        |

### Self-Improvement

| #    | Limitation                          | Deferred To |
| ---- | ----------------------------------- | ----------- |
| ✗ 14 | Learn from Build Agent feedback     | v0.2        |
| ✗ 15 | Improve templates based on outcomes | v0.3        |
| ✗ 16 | Self-evaluate spec quality          | v0.2        |

---

## Quality Bar

| Metric              | Target | Measurement                                                     |
| ------------------- | ------ | --------------------------------------------------------------- |
| Template compliance | 100%   | All required sections present                                   |
| YAML validity       | 100%   | All YAML blocks parse without error                             |
| Task atomicity      | 100%   | Each task is single-file, single-action                         |
| Gotcha relevance    | 80%    | 4 out of 5 gotchas apply to the task                            |
| Implementability    | 80%    | Build Agent can complete 4 out of 5 tasks without clarification |
| Task count accuracy | 100%   | Matches complexity level requirements                           |

---

## Success Looks Like

### For a Simple Feature (like API Call Counter)

**Input:** A brief.md with:

- Problem statement
- Solution overview
- MVP scope

**Output:**

1. `build/spec.md` with:
   - Functional requirements table
   - Single architecture diagram
   - 1-2 API endpoints documented
   - 1 database table schema
   - 2-3 gotchas

2. `build/tasks.md` with:
   - 5-8 atomic tasks
   - Each task has: id, phase, action, file, requirements, gotchas, validation, code_template
   - Correct dependency ordering
   - All YAML blocks valid

### For a Medium Feature (like User Profiles)

**Input:** Same structure, larger scope

**Output:**

1. `build/spec.md` with:
   - Multiple functional requirements
   - Architecture diagram with 3-4 components
   - 4-6 API endpoints documented
   - 2-3 database tables
   - 4-5 gotchas

2. `build/tasks.md` with:
   - 10-15 atomic tasks
   - Multiple phases represented
   - Service layer tasks included
   - Test tasks included

### For a Complex Feature (like Notification System)

**Input:** Same structure, system-level scope

**Output:**

1. `build/spec.md` with:
   - Comprehensive requirements table
   - Multi-component architecture diagram
   - 6+ API endpoints + WebSocket events
   - 4+ database tables
   - 6+ gotchas with confidence levels

2. `build/tasks.md` with:
   - 20-30 atomic tasks
   - All phases represented
   - Integration tasks included
   - Comprehensive test coverage tasks

---

## Boundaries

### Spec Agent v0.1 Starts When

- Brief exists at `planning/brief.md`
- Brief has valid YAML frontmatter
- Brief has Problem, Solution, MVP Scope sections

### Spec Agent v0.1 Ends When

- `build/spec.md` written
- `build/tasks.md` written
- Both files have valid YAML
- Task count matches complexity

### Spec Agent v0.1 Does NOT

- Execute any tasks
- Modify any existing code
- Create the brief
- Validate the brief content
- Wait for approval (that's human's job)

---

## Error Handling

| Error                    | Response                                      |
| ------------------------ | --------------------------------------------- |
| Brief not found          | Exit with error, suggest running idea-capture |
| Invalid YAML in brief    | Exit with error, show parsing issue           |
| Missing required section | Exit with error, list missing sections        |
| Unknown complexity       | Default to "medium", log warning              |
| Template not found       | Exit with error, cannot proceed               |

---

## Version History

| Version        | Changes                                            |
| -------------- | -------------------------------------------------- |
| v0.1           | Initial release - basic brief→spec transformation  |
| v0.2 (planned) | Knowledge Base integration, interactive refinement |
| v0.3 (planned) | Cross-idea analysis, self-improvement              |

---

_This scope document is the authoritative reference for Spec Agent v0.1 capabilities._
