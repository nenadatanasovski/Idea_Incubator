---
id: unknown
complexity: complex
total_tasks: 7
phases:
  database: 1
  types: 1
  queries: 1
  services: 1
  api: 2
  tests: 1
---

# Untitled - Implementation Tasks

## Task Summary

| Phase    | Count |
| -------- | ----- |
| database | 1     |
| types    | 1     |
| queries  | 1     |
| services | 1     |
| api      | 2     |
| tests    | 1     |

---

## Tasks

### T-001: database - CREATE 38_unknown.sql

```yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/38_unknown.sql"
status: pending
requirements:
  - "Create database migration file"
  - "Record specification runs in specifications table with metadata (tokens_used, task_count, status)"
  - "Store generated questions in questions table with agent_type='spec'"
gotchas:
  - "Use TEXT for SQLite timestamps, not DATETIME"
  - "Always include IF NOT EXISTS for CREATE TABLE statements"
  - "Foreign keys require PRAGMA foreign_keys = ON in SQLite"
  - "Add created_at and updated_at columns to all tables"
  - "Create indexes for foreign key columns and frequently queried fields"
validation:
  command: "sqlite3 :memory: < database/migrations/38_unknown.sql && echo 'OK'"
  expected: "OK"
code_template: |
  -- GOTCHA [SQL-001]: Always use parameterized queries to prevent SQL injection 

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
depends_on: []
```

### T-002: types - CREATE unknown.ts

```yaml
id: T-002
phase: types
action: CREATE
file: "types/unknown.ts"
status: pending
requirements:
  - "Define TypeScript interfaces"
  - "Export types for use by other modules"
gotchas:
  - "Use TEXT for SQLite timestamps, not DATETIME"
  - "Always include IF NOT EXISTS for CREATE TABLE statements"
  - "Foreign keys require PRAGMA foreign_keys = ON in SQLite"
  - "Export all interfaces and types for use by other modules"
  - "Use readonly for properties that should not be modified"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-001
```

### T-003: queries - UPDATE db.ts

```yaml
id: T-003
phase: queries
action: UPDATE
file: "database/db.ts"
status: pending
requirements:
  - "Add CRUD query functions"
  - "Use parameterized queries"
  - "Follow existing patterns in file"
gotchas:
  - "Use .js extension in import paths for ES modules"
  - "Always use parameterized queries to prevent SQL injection"
  - "Parse JSON columns when reading from SQLite, stringify when writing"
  - "Use db.prepare().run/get/all() pattern from better-sqlite3"
  - "Wrap multiple operations in transactions for consistency"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-002
  - T-001
```

### T-004: services - CREATE unknown-service.ts

```yaml
id: T-004
phase: services
action: CREATE
file: "server/services/unknown-service.ts"
status: pending
requirements:
  - "Implement business logic"
  - "Wrap database queries with validation"
  - "Follow existing service patterns"
gotchas:
  - "Use TEXT for SQLite timestamps, not DATETIME"
  - "Always include IF NOT EXISTS for CREATE TABLE statements"
  - "Foreign keys require PRAGMA foreign_keys = ON in SQLite"
  - "Services should be stateless - pass dependencies via constructor"
  - "Validate inputs at service layer before database operations"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-003
```

### T-005: api - CREATE unknown.ts

```yaml
id: T-005
phase: api
action: CREATE
file: "server/routes/unknown.ts"
status: pending
requirements:
  - "Create Express router"
  - "Implement CRUD endpoints"
  - "Add input validation"
  - "Return appropriate status codes"
gotchas:
  - "Use TEXT for SQLite timestamps, not DATETIME"
  - "Always include IF NOT EXISTS for CREATE TABLE statements"
  - "Foreign keys require PRAGMA foreign_keys = ON in SQLite"
  - "Use try-catch and proper error responses (400, 404, 500)"
  - "Mount routers in server/api.ts after creation"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-004
```

### T-006: api - UPDATE api.ts

```yaml
id: T-006
phase: api
action: UPDATE
file: "server/api.ts"
status: pending
requirements:
  - "Import new router"
  - "Mount at appropriate path"
gotchas:
  - "Use .js extension in import paths for ES modules"
  - "Always use parameterized queries to prevent SQL injection"
  - "Parse JSON columns when reading from SQLite, stringify when writing"
  - "Use try-catch and proper error responses (400, 404, 500)"
  - "Use .js extension in imports for ESM compatibility"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-005
```

### T-007: tests - CREATE unknown.test.ts

```yaml
id: T-007
phase: tests
action: CREATE
file: "tests/unknown.test.ts"
status: pending
requirements:
  - "Test CRUD operations"
  - "Test error cases"
  - "Follow vitest patterns"
gotchas:
  - "Use TEXT for SQLite timestamps, not DATETIME"
  - "Always include IF NOT EXISTS for CREATE TABLE statements"
  - "Foreign keys require PRAGMA foreign_keys = ON in SQLite"
  - "Use vitest describe/it/expect pattern for tests"
  - "Test both success cases and error/edge cases"
validation:
  command: "npm test -- --grep "unknown""
  expected: "all tests pass"
depends_on:
  - T-005
```
