# VIBE-P13-005: Feature Implementation Orchestration Layer

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-02-08
**Priority:** P0 (Critical Path - Phase 13)
**Effort:** Large (20-24 hours)
**Model:** Opus
**Agent Type:** spec_agent

---

## Overview

Implement a feature orchestration layer that coordinates end-to-end feature implementation across database, backend API, and frontend UI layers. The orchestrator parses feature specifications, determines optimal execution order (DB→API→UI), delegates generation to specialized layer generators, validates cross-layer type consistency, and runs integration checks to ensure all components work together cohesively.

### Problem Statement

**Current State:**

- Individual layer generators exist (VIBE-P13-001 DB, VIBE-P13-002 API, VIBE-P13-003 UI, VIBE-P13-004 validators)
- Each generator can create code for its layer independently
- **BUT** no coordinated orchestration across layers
- No automatic sequencing of DB→API→UI dependency chain
- No cross-layer type consistency validation
- No integration testing after multi-layer code generation
- Features requiring all three layers need manual coordination

**Desired State:**

- Single orchestrator coordinates full-stack feature implementation
- Parses feature spec into layer-specific requirements (DB schema, API routes, UI components)
- Executes generators in correct dependency order (migrations first, then API, then UI)
- Validates cross-layer type consistency (API matches DB schema, UI calls correct API endpoints)
- Runs integration tests after all layers generated
- Handles partial failures with appropriate rollback strategies
- Provides unified observability across all layer generation phases

### Value Proposition

The Feature Orchestration Layer is the **"Full-Stack Implementation Coordinator"** that enables true autonomous feature delivery:

1. **Enables Full-Stack Autonomy** - Complete features from spec to working application
2. **Prevents Integration Bugs** - Cross-layer validation catches type mismatches early
3. **Optimal Execution Order** - Respects dependencies (DB schema before API, API before UI)
4. **Intelligent Rollback** - Partial failures don't leave codebase in broken state
5. **Developer Experience** - Single task creates entire feature stack
6. **Cost Efficiency** - Parallel execution where possible, serial where required

---

## Requirements

### Functional Requirements

#### 1. Feature Spec Parsing

**Input:** Feature specification in structured format

```markdown
# Feature: User Authentication

## Database Layer

### Tables

- users
  - id: UUID PRIMARY KEY
  - email: TEXT UNIQUE NOT NULL
  - password_hash: TEXT NOT NULL
  - created_at: TIMESTAMP DEFAULT NOW()

### Indexes

- idx_users_email ON users(email)

## API Layer

### Endpoints

- POST /api/auth/register
  - Body: { email: string, password: string }
  - Response: { user: User, token: string }
  - Status: 201 on success, 400 on validation error, 409 if email exists

- POST /api/auth/login
  - Body: { email: string, password: string }
  - Response: { user: User, token: string }
  - Status: 200 on success, 401 on invalid credentials

### Middleware

- auth.ts: JWT verification middleware

## UI Layer

### Components

- LoginForm.tsx: Email/password form with validation
- RegisterForm.tsx: Registration form with password confirmation
- AuthContext.tsx: React context for auth state

### Pages

- /login: Login page with LoginForm
- /register: Registration page with RegisterForm

## Integration Tests

- User can register with valid email/password
- User cannot register with duplicate email
- User can login with correct credentials
- User cannot login with wrong password
- Protected routes redirect to /login when not authenticated
```

**Processing:**

- Extract database layer requirements (tables, columns, indexes, migrations)
- Extract API layer requirements (endpoints, request/response schemas, middleware)
- Extract UI layer requirements (components, pages, routing, state management)
- Identify cross-layer dependencies (API depends on DB schema, UI depends on API contracts)
- Build execution graph with proper ordering

#### 2. Execution Order Determination

The orchestrator must sequence layer generation respecting dependencies:

**Dependency Rules:**

```typescript
interface LayerDependency {
  layer: "database" | "api" | "ui";
  dependsOn: Array<"database" | "api" | "ui">;
  canRunInParallel: boolean;
}

const DEPENDENCY_GRAPH: LayerDependency[] = [
  {
    layer: "database",
    dependsOn: [],
    canRunInParallel: false, // DB migrations must run serially
  },
  {
    layer: "api",
    dependsOn: ["database"], // API needs DB schema
    canRunInParallel: true, // Multiple API generators can run parallel
  },
  {
    layer: "ui",
    dependsOn: ["api"], // UI needs API contracts
    canRunInParallel: true, // Multiple UI generators can run parallel
  },
];
```

**Execution Sequence:**

1. **Phase 1: Database Layer** (serial)
   - Generate migration SQL
   - Apply migration to development database
   - Verify schema changes applied correctly

2. **Phase 2: API Layer** (parallel where possible)
   - Generate API route handlers
   - Generate middleware (auth, validation)
   - Generate TypeScript types matching DB schema
   - Update API documentation

3. **Phase 3: UI Layer** (parallel where possible)
   - Generate React components
   - Generate state management (contexts, hooks)
   - Generate page components
   - Update routing configuration

4. **Phase 4: Integration Validation** (serial)
   - Run type checker across all layers
   - Execute integration tests
   - Validate API→DB communication
   - Validate UI→API communication

#### 3. Layer Generator Coordination

The orchestrator delegates to specialized generators:

**Database Generator (VIBE-P13-001):**

```typescript
interface DatabaseGeneratorInput {
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; constraints: string[] }>;
    indexes: Array<{ name: string; columns: string[]; unique: boolean }>;
  }>;
  relationships: Array<{
    from: { table: string; column: string };
    to: { table: string; column: string };
    type: "one-to-one" | "one-to-many" | "many-to-many";
  }>;
}

interface DatabaseGeneratorOutput {
  migrationFile: string; // Path to generated migration
  migrationNumber: number; // e.g., 134
  sqlContent: string; // Generated SQL
  appliedSuccessfully: boolean;
  schemaSnapshot: Record<string, TableDefinition>; // For type generation
}
```

**API Generator (VIBE-P13-002):**

```typescript
interface APIGeneratorInput {
  endpoints: Array<{
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    path: string;
    requestSchema?: object; // JSON schema for request body
    responseSchema: object; // JSON schema for response
    authentication?: "required" | "optional" | "none";
    authorization?: string[]; // Required permissions/roles
  }>;
  middleware: Array<{
    name: string;
    purpose: string;
    applyTo: "all" | string[]; // Apply to all routes or specific ones
  }>;
  dbSchema: Record<string, TableDefinition>; // From DB generator output
}

interface APIGeneratorOutput {
  routeFiles: Array<{ path: string; content: string }>;
  middlewareFiles: Array<{ path: string; content: string }>;
  typeFiles: Array<{ path: string; content: string }>; // TypeScript types
  testFiles: Array<{ path: string; content: string }>;
  apiContracts: Record<string, EndpointContract>; // For UI generator
}
```

**UI Generator (VIBE-P13-003):**

```typescript
interface UIGeneratorInput {
  components: Array<{
    name: string;
    type: "form" | "display" | "layout" | "page";
    props?: Record<string, string>; // TypeScript type annotations
    apiCalls?: string[]; // Which API endpoints it uses
  }>;
  pages: Array<{
    route: string;
    component: string;
    authentication?: "required" | "optional";
  }>;
  stateManagement: Array<{
    name: string; // e.g., 'AuthContext'
    type: "context" | "hook" | "store";
    provides: string[]; // What state/functions it exposes
  }>;
  apiContracts: Record<string, EndpointContract>; // From API generator output
}

interface UIGeneratorOutput {
  componentFiles: Array<{ path: string; content: string }>;
  pageFiles: Array<{ path: string; content: string }>;
  hookFiles: Array<{ path: string; content: string }>;
  routingUpdates: Array<{ file: string; changes: string }>;
  testFiles: Array<{ path: string; content: string }>;
}
```

#### 4. Cross-Layer Type Consistency Validation

After each layer is generated, validate types match across boundaries:

**DB→API Type Consistency:**

```typescript
interface TypeConsistencyCheck {
  checkDbToApiTypes(
    dbSchema: Record<string, TableDefinition>,
    apiTypes: Record<string, TypeDefinition>,
  ): ValidationResult;
}

// Example check:
// DB: users table has column 'email' type TEXT
// API: User interface has field 'email' type string ✅
// API: User interface missing field 'created_at' ❌ (exists in DB)
```

**API→UI Type Consistency:**

```typescript
interface ApiUiTypeCheck {
  checkApiToUiTypes(
    apiContracts: Record<string, EndpointContract>,
    uiApiCalls: Array<{ endpoint: string; expectedResponse: TypeDefinition }>,
  ): ValidationResult;
}

// Example check:
// API: POST /api/auth/login returns { user: User, token: string }
// UI: LoginForm expects response type { user: User, token: string } ✅
// UI: LoginForm expects response type { userId: string } ❌ (wrong shape)
```

**Cross-Layer Integration Check:**

```typescript
interface IntegrationCheck {
  // Verify API routes exist for all UI API calls
  checkUiApiCallsExist(
    uiApiCalls: string[],
    apiRoutes: string[],
  ): ValidationResult;

  // Verify DB tables exist for all API data access
  checkApiDbAccessExists(
    apiQueries: Array<{ table: string; operation: string }>,
    dbSchema: Record<string, TableDefinition>,
  ): ValidationResult;
}
```

#### 5. Integration Testing

Run integration tests after all layers are generated:

**Test Levels:**

```typescript
interface IntegrationTestSuite {
  // Level 1: Type checking
  typeCheck: {
    command: "npx tsc --noEmit";
    mustPass: true;
    timeout: 60_000; // 60 seconds
  };

  // Level 2: Unit tests (each layer independently)
  unitTests: {
    database: "npm test -- tests/database/migrations/*.test.ts";
    api: "npm test -- tests/api/**/*.test.ts";
    ui: "npm test -- tests/ui/**/*.test.tsx";
  };

  // Level 3: Integration tests (cross-layer)
  integrationTests: {
    command: "npm run test:integration";
    mustPass: true;
    timeout: 120_000; // 2 minutes
  };

  // Level 4: E2E tests (full user flow)
  e2eTests: {
    command: "npm run test:e2e";
    mustPass: false; // Warning only (expensive to run)
    timeout: 300_000; // 5 minutes
  };
}
```

**Test Execution Strategy:**

- Run type check first (fastest, catches most issues)
- Run unit tests in parallel (isolated, can run concurrently)
- Run integration tests after units pass (requires all layers working)
- Run E2E tests optionally (expensive, manual trigger recommended)

#### 6. Rollback on Partial Failure

Handle failures gracefully with layer-specific rollback strategies:

**Database Layer Failure:**

```typescript
// If migration fails to apply:
async function rollbackDatabase(migrationNumber: number): Promise<void> {
  // Run migration down() function
  await runMigration("down", migrationNumber);

  // Verify rollback succeeded
  const schemaAfterRollback = await getSchemaSnapshot();
  const schemaBeforeFeature = await getSnapshotFromGit("HEAD~1");

  if (!deepEqual(schemaAfterRollback, schemaBeforeFeature)) {
    throw new RollbackError("Database rollback incomplete");
  }
}
```

**API Layer Failure:**

```typescript
// If API generation fails:
async function rollbackApi(generatedFiles: string[]): Promise<void> {
  // Delete generated files
  for (const file of generatedFiles) {
    if (await fileExists(file)) {
      await fs.unlink(file);
    }
  }

  // Restore modified files from git
  await exec("git checkout -- server/routes/ server/middleware/");

  // Verify no orphaned imports or references
  await checkForOrphanedReferences();
}
```

**UI Layer Failure:**

```typescript
// If UI generation fails:
async function rollbackUi(generatedFiles: string[]): Promise<void> {
  // Delete generated components/pages
  for (const file of generatedFiles) {
    if (await fileExists(file)) {
      await fs.unlink(file);
    }
  }

  // Restore routing configuration
  await exec("git checkout -- src/App.tsx src/routes/");

  // Remove unused imports
  await runESLintFix();
}
```

**Rollback Decision Tree:**

```typescript
interface RollbackStrategy {
  onDatabaseFailure: "rollback-db" | "manual-intervention";
  onApiFailure: "rollback-api-and-db" | "rollback-api-only" | "continue";
  onUiFailure: "rollback-ui-only" | "rollback-all" | "continue";
  onIntegrationTestFailure: "rollback-all" | "mark-needs-review";
}

const DEFAULT_ROLLBACK_STRATEGY: RollbackStrategy = {
  onDatabaseFailure: "manual-intervention", // DB changes are risky
  onApiFailure: "rollback-api-only", // Keep DB changes, rollback API
  onUiFailure: "rollback-ui-only", // Keep DB+API, rollback UI
  onIntegrationTestFailure: "mark-needs-review", // Don't auto-rollback, escalate
};
```

### Non-Functional Requirements

#### Performance

- Feature spec parsing: < 10 seconds
- Layer generator coordination: < 5 seconds overhead per layer
- Type consistency validation: < 30 seconds
- Integration test execution: < 3 minutes
- Total feature implementation: < 15 minutes for typical 3-layer feature

#### Quality

- Generated code must compile (TypeScript validation)
- Generated code must pass layer-specific tests
- Cross-layer types must be consistent (no type mismatches)
- Integration tests must pass (full stack working together)

#### Reliability

- Graceful handling of generator failures (rollback cleanly)
- Graceful handling of partial successes (DB works, API fails → rollback API)
- No orphaned code (all generated files tracked for cleanup)
- No broken references (imports, API calls validated)

#### Observability

- Each layer generation logged with phase, duration, files created
- Cross-layer validation results captured
- Integration test results detailed (which tests passed/failed)
- Rollback actions logged for audit trail

---

## Technical Design

### Architecture

```
Feature Spec (Markdown/JSON)
    ↓
FeatureOrchestrator.parse(spec)
    ↓
┌─────────────────────────────────────────────────────────┐
│             Feature Orchestrator                        │
│                                                          │
│  1. Parse Spec                                          │
│     - Extract DB requirements                           │
│     - Extract API requirements                          │
│     - Extract UI requirements                           │
│     - Build dependency graph                            │
│                                                          │
│  2. Execute Database Layer (Serial)                     │
│     → Call DatabaseGenerator (VIBE-P13-001)            │
│     → Apply migration to dev DB                        │
│     → Capture schema snapshot                          │
│     → Validate schema changes                          │
│                                                          │
│  3. Execute API Layer (Parallel where possible)        │
│     → Call APIGenerator (VIBE-P13-002)                 │
│     → Pass DB schema from Phase 2                      │
│     → Generate routes, middleware, types               │
│     → Capture API contracts                            │
│                                                          │
│  4. Validate DB→API Type Consistency                   │
│     → Compare DB schema types to API types             │
│     → Flag mismatches (missing fields, wrong types)    │
│     → FAIL if critical mismatches found                │
│                                                          │
│  5. Execute UI Layer (Parallel where possible)         │
│     → Call UIGenerator (VIBE-P13-003)                  │
│     → Pass API contracts from Phase 3                  │
│     → Generate components, pages, hooks                │
│     → Update routing                                    │
│                                                          │
│  6. Validate API→UI Type Consistency                   │
│     → Compare API contracts to UI API calls            │
│     → Flag mismatches (wrong endpoints, wrong types)   │
│     → FAIL if critical mismatches found                │
│                                                          │
│  7. Run Integration Tests                              │
│     → npx tsc --noEmit (type check)                    │
│     → npm test (unit tests)                            │
│     → npm run test:integration (e2e)                   │
│     → Capture test results                             │
│                                                          │
│  8. Handle Success/Failure                             │
│     - Success: Mark task complete, commit changes      │
│     - Failure: Rollback according to strategy          │
│                                                          │
└─────────────────────────────────────────────────────────┘
    ↓
Result: { success: boolean, filesGenerated: string[], testResults: TestReport }
```

### Key Components

#### 1. Feature Spec Parser (NEW)

**File:** `parent-harness/orchestrator/src/spawner/feature-orchestrator.ts`

```typescript
/**
 * Parse feature specification into layer-specific requirements
 */
export class FeatureSpecParser {
  parse(specContent: string): ParsedFeatureSpec {
    const sections = this.extractSections(specContent);

    return {
      database: this.parseDatabaseLayer(sections["Database Layer"]),
      api: this.parseApiLayer(sections["API Layer"]),
      ui: this.parseUiLayer(sections["UI Layer"]),
      integrationTests: this.parseIntegrationTests(
        sections["Integration Tests"],
      ),
      metadata: this.parseMetadata(sections),
    };
  }

  private parseDatabaseLayer(content: string): DatabaseLayerSpec {
    // Extract table definitions
    const tables = this.extractTables(content);

    // Extract indexes
    const indexes = this.extractIndexes(content);

    // Extract foreign keys
    const foreignKeys = this.extractForeignKeys(content);

    return { tables, indexes, foreignKeys };
  }

  private parseApiLayer(content: string): ApiLayerSpec {
    // Extract endpoint definitions
    const endpoints = this.extractEndpoints(content);

    // Extract middleware requirements
    const middleware = this.extractMiddleware(content);

    // Extract validation schemas
    const schemas = this.extractSchemas(content);

    return { endpoints, middleware, schemas };
  }

  private parseUiLayer(content: string): UiLayerSpec {
    // Extract component specifications
    const components = this.extractComponents(content);

    // Extract page definitions
    const pages = this.extractPages(content);

    // Extract state management needs
    const stateManagement = this.extractStateManagement(content);

    return { components, pages, stateManagement };
  }

  private extractTables(content: string): TableDefinition[] {
    // Pattern: ### Tables\n- users\n  - id: UUID PRIMARY KEY
    const tables: TableDefinition[] = [];
    const tablePattern = /^-\s+(\w+)\s*$/gm;
    const columnPattern = /^\s+-\s+(\w+):\s+(.+)$/gm;

    // Parse each table and its columns
    // Return structured table definitions

    return tables;
  }
}
```

#### 2. Execution Coordinator (NEW)

**File:** `parent-harness/orchestrator/src/spawner/feature-orchestrator.ts`

```typescript
/**
 * Coordinate execution of layer generators in correct order
 */
export class FeatureExecutionCoordinator {
  constructor(
    private dbGenerator: DatabaseGenerator,
    private apiGenerator: ApiGenerator,
    private uiGenerator: UiGenerator,
    private validator: CrossLayerValidator,
  ) {}

  async executeFeature(
    spec: ParsedFeatureSpec,
  ): Promise<FeatureExecutionResult> {
    const context: ExecutionContext = {
      spec,
      results: {},
      rollbackActions: [],
    };

    try {
      // Phase 1: Database Layer (Serial)
      await this.executePhase("database", async () => {
        const dbResult = await this.dbGenerator.generate(spec.database);
        context.results.database = dbResult;

        // Register rollback action
        context.rollbackActions.push(() => this.rollbackDatabase(dbResult));

        return dbResult;
      });

      // Phase 2: API Layer (Parallel-capable)
      await this.executePhase("api", async () => {
        const apiResult = await this.apiGenerator.generate({
          ...spec.api,
          dbSchema: context.results.database.schemaSnapshot,
        });
        context.results.api = apiResult;

        // Register rollback action
        context.rollbackActions.push(() => this.rollbackApi(apiResult));

        return apiResult;
      });

      // Phase 3: Validate DB→API Types
      await this.executePhase("validate-db-api", async () => {
        const validation = await this.validator.validateDbToApi(
          context.results.database.schemaSnapshot,
          context.results.api.typeFiles,
        );

        if (!validation.passed) {
          throw new ValidationError("DB→API type mismatch", validation.errors);
        }

        return validation;
      });

      // Phase 4: UI Layer (Parallel-capable)
      await this.executePhase("ui", async () => {
        const uiResult = await this.uiGenerator.generate({
          ...spec.ui,
          apiContracts: context.results.api.apiContracts,
        });
        context.results.ui = uiResult;

        // Register rollback action
        context.rollbackActions.push(() => this.rollbackUi(uiResult));

        return uiResult;
      });

      // Phase 5: Validate API→UI Types
      await this.executePhase("validate-api-ui", async () => {
        const validation = await this.validator.validateApiToUi(
          context.results.api.apiContracts,
          context.results.ui.componentFiles,
        );

        if (!validation.passed) {
          throw new ValidationError("API→UI type mismatch", validation.errors);
        }

        return validation;
      });

      // Phase 6: Integration Tests
      await this.executePhase("integration-tests", async () => {
        const testResult = await this.runIntegrationTests(
          spec.integrationTests,
        );

        if (!testResult.allPassed) {
          throw new TestFailureError("Integration tests failed", testResult);
        }

        return testResult;
      });

      // Success!
      return {
        success: true,
        filesGenerated: this.collectGeneratedFiles(context),
        testResults: context.results["integration-tests"],
      };
    } catch (error) {
      // Failure - rollback
      await this.rollbackAll(context, error);

      return {
        success: false,
        error: error.message,
        partialResults: context.results,
      };
    }
  }

  private async executePhase<T>(
    phaseName: string,
    executor: () => Promise<T>,
  ): Promise<T> {
    console.log(`[FeatureOrchestrator] Starting phase: ${phaseName}`);
    const startTime = Date.now();

    try {
      const result = await executor();
      const duration = Date.now() - startTime;

      console.log(
        `[FeatureOrchestrator] ✅ ${phaseName} completed in ${duration}ms`,
      );

      // Log to observability
      await this.logPhase(phaseName, "completed", duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(
        `[FeatureOrchestrator] ❌ ${phaseName} failed after ${duration}ms:`,
        error,
      );

      // Log to observability
      await this.logPhase(phaseName, "failed", duration, error);

      throw error;
    }
  }

  private async rollbackAll(
    context: ExecutionContext,
    originalError: Error,
  ): Promise<void> {
    console.warn(
      "[FeatureOrchestrator] Rolling back due to error:",
      originalError.message,
    );

    // Execute rollback actions in reverse order
    for (const action of context.rollbackActions.reverse()) {
      try {
        await action();
      } catch (rollbackError) {
        console.error(
          "[FeatureOrchestrator] Rollback action failed:",
          rollbackError,
        );
        // Continue with other rollbacks even if one fails
      }
    }
  }
}
```

#### 3. Cross-Layer Type Validator (NEW)

**File:** `parent-harness/orchestrator/src/spawner/cross-layer-validator.ts`

```typescript
/**
 * Validate type consistency across database, API, and UI layers
 */
export class CrossLayerValidator {
  /**
   * Validate DB schema types match API TypeScript types
   */
  async validateDbToApi(
    dbSchema: Record<string, TableDefinition>,
    apiTypeFiles: Array<{ path: string; content: string }>,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Parse TypeScript types from API files
    const apiTypes = this.parseTypeScriptTypes(apiTypeFiles);

    // For each DB table, check matching API type exists
    for (const [tableName, tableDefinition] of Object.entries(dbSchema)) {
      const typeName = this.tableNameToTypeName(tableName); // users → User
      const apiType = apiTypes[typeName];

      if (!apiType) {
        errors.push({
          level: "error",
          message: `No API type found for DB table '${tableName}'`,
          suggestion: `Create interface ${typeName} in API types`,
        });
        continue;
      }

      // Check each column has corresponding field
      for (const column of tableDefinition.columns) {
        const field = apiType.fields[column.name];

        if (!field) {
          errors.push({
            level: "error",
            message: `API type ${typeName} missing field '${column.name}' from DB`,
            suggestion: `Add '${column.name}: ${this.sqlTypeToTsType(column.type)}' to ${typeName}`,
          });
          continue;
        }

        // Check type compatibility
        const expectedTsType = this.sqlTypeToTsType(column.type);
        if (field.type !== expectedTsType) {
          errors.push({
            level: "error",
            message: `Type mismatch: DB column '${tableName}.${column.name}' is ${column.type}, API field is ${field.type}`,
            suggestion: `Change API field type to ${expectedTsType}`,
          });
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate API contracts match UI API call expectations
   */
  async validateApiToUi(
    apiContracts: Record<string, EndpointContract>,
    uiComponentFiles: Array<{ path: string; content: string }>,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Extract API calls from UI components
    const uiApiCalls = this.extractApiCalls(uiComponentFiles);

    // Check each UI API call matches an API endpoint
    for (const apiCall of uiApiCalls) {
      const endpoint = apiContracts[apiCall.endpoint];

      if (!endpoint) {
        errors.push({
          level: "error",
          message: `UI calls non-existent API endpoint: ${apiCall.endpoint}`,
          location: `${apiCall.file}:${apiCall.line}`,
          suggestion: `Either create API endpoint ${apiCall.endpoint} or remove this call`,
        });
        continue;
      }

      // Check request type matches
      if (apiCall.requestBody && endpoint.requestSchema) {
        const typeMatch = this.compareTypes(
          apiCall.requestBody,
          endpoint.requestSchema,
        );

        if (!typeMatch.compatible) {
          errors.push({
            level: "error",
            message: `Request type mismatch for ${apiCall.endpoint}`,
            details: typeMatch.differences,
            location: `${apiCall.file}:${apiCall.line}`,
          });
        }
      }

      // Check response type matches
      if (apiCall.expectedResponse && endpoint.responseSchema) {
        const typeMatch = this.compareTypes(
          apiCall.expectedResponse,
          endpoint.responseSchema,
        );

        if (!typeMatch.compatible) {
          errors.push({
            level: "error",
            message: `Response type mismatch for ${apiCall.endpoint}`,
            details: typeMatch.differences,
            location: `${apiCall.file}:${apiCall.line}`,
          });
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  private sqlTypeToTsType(sqlType: string): string {
    const typeMap: Record<string, string> = {
      TEXT: "string",
      VARCHAR: "string",
      INTEGER: "number",
      BIGINT: "number",
      REAL: "number",
      BOOLEAN: "boolean",
      TIMESTAMP: "Date",
      UUID: "string",
      JSON: "object",
      JSONB: "object",
    };

    const upperType = sqlType.toUpperCase().split("(")[0]; // VARCHAR(255) → VARCHAR
    return typeMap[upperType] || "unknown";
  }
}
```

#### 4. Integration Test Runner (NEW)

**File:** `parent-harness/orchestrator/src/spawner/integration-test-runner.ts`

```typescript
/**
 * Run integration tests across all generated layers
 */
export class IntegrationTestRunner {
  async runTests(testSpecs: IntegrationTestSpec[]): Promise<TestResult> {
    const results: TestCaseResult[] = [];
    let allPassed = true;

    // Run type check first (fastest)
    const typeCheckResult = await this.runCommand({
      name: "TypeScript Compilation",
      command: "npx tsc --noEmit",
      timeout: 60_000,
    });
    results.push(typeCheckResult);

    if (!typeCheckResult.passed) {
      allPassed = false;
      // Stop here - no point running other tests if types don't compile
      return { allPassed: false, results };
    }

    // Run unit tests (parallel)
    const unitTestResults = await Promise.all([
      this.runCommand({
        name: "Database Unit Tests",
        command: "npm test -- tests/database/**/*.test.ts",
        timeout: 60_000,
      }),
      this.runCommand({
        name: "API Unit Tests",
        command: "npm test -- tests/api/**/*.test.ts",
        timeout: 60_000,
      }),
      this.runCommand({
        name: "UI Unit Tests",
        command: "npm test -- tests/ui/**/*.test.tsx",
        timeout: 60_000,
      }),
    ]);

    results.push(...unitTestResults);

    if (unitTestResults.some((r) => !r.passed)) {
      allPassed = false;
      // Continue to integration tests anyway (for comprehensive report)
    }

    // Run integration tests (serial)
    const integrationResult = await this.runCommand({
      name: "Integration Tests",
      command: "npm run test:integration",
      timeout: 120_000,
    });
    results.push(integrationResult);

    if (!integrationResult.passed) {
      allPassed = false;
    }

    return {
      allPassed,
      results,
      summary: this.generateSummary(results),
    };
  }

  private async runCommand(spec: CommandSpec): Promise<TestCaseResult> {
    const startTime = Date.now();

    try {
      const { stdout, stderr, exitCode } = await this.exec(spec.command, {
        timeout: spec.timeout,
        cwd: this.projectRoot,
      });

      const duration = Date.now() - startTime;
      const passed = exitCode === 0;

      return {
        name: spec.name,
        passed,
        duration,
        output: stdout + stderr,
        exitCode,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        name: spec.name,
        passed: false,
        duration,
        output: error.message,
        exitCode: -1,
        error: error,
      };
    }
  }
}
```

### Database Schema

**No new database tables required** - Feature orchestrator uses existing infrastructure:

- `tasks` - Feature implementation tasks with `spec_content` containing feature spec
- `task_executions` - Execution attempts with generated file tracking
- `task_execution_log` - Phase logs (db-layer, api-layer, ui-layer, validation, tests)
- `agent_heartbeats` - Health monitoring during long feature implementations

**Potential Future Enhancement:**

```sql
-- Table to track layer generation history (for rollback reference)
CREATE TABLE IF NOT EXISTS feature_layer_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  layer TEXT NOT NULL, -- 'database' | 'api' | 'ui'
  generated_files TEXT NOT NULL, -- JSON array of file paths
  schema_snapshot TEXT, -- DB schema after this layer (for DB layer)
  api_contracts TEXT, -- API contracts after this layer (for API layer)
  status TEXT NOT NULL, -- 'completed' | 'rolled_back' | 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

### Integration Points

#### 1. Spawner Integration

**File:** `parent-harness/orchestrator/src/spawner/index.ts`

```typescript
// Add feature orchestrator to spawner exports
import { FeatureOrchestrator } from "./feature-orchestrator.js";

/**
 * Spawn feature implementation (all layers)
 */
export async function spawnFeatureImplementation(
  taskId: string,
  featureSpec: string,
): Promise<FeatureExecutionResult> {
  const orchestrator = new FeatureOrchestrator({
    dbGenerator: new DatabaseGenerator(config.dbGeneratorConfig),
    apiGenerator: new ApiGenerator(config.apiGeneratorConfig),
    uiGenerator: new UiGenerator(config.uiGeneratorConfig),
    validator: new CrossLayerValidator(),
    testRunner: new IntegrationTestRunner(),
  });

  return await orchestrator.executeFeature(featureSpec);
}
```

#### 2. Task System Integration

Feature orchestrator integrates with existing task workflow:

```typescript
// When task assigned_agent_id === 'feature_orchestrator_agent'
const task = tasks.getTask(taskId);
if (task.spec_content) {
  // Feature spec provided in task.spec_content
  const result = await spawnFeatureImplementation(taskId, task.spec_content);

  if (result.success) {
    tasks.updateTask(taskId, { status: "pending_verification" });
  } else {
    tasks.updateTask(taskId, {
      status: "failed",
      last_error_message: result.error,
    });
  }
}
```

---

## Pass Criteria

### 1. ✅ Feature Spec Parser Extracts All Layers

**Test:**

```typescript
const spec = `
# Feature: User Profile

## Database Layer
### Tables
- user_profiles
  - id: UUID PRIMARY KEY
  - user_id: UUID REFERENCES users(id)
  - bio: TEXT

## API Layer
### Endpoints
- GET /api/profiles/:id

## UI Layer
### Components
- ProfileCard.tsx
`;

const parsed = new FeatureSpecParser().parse(spec);

assert(parsed.database.tables.length === 1);
assert(parsed.database.tables[0].name === "user_profiles");
assert(parsed.api.endpoints.length === 1);
assert(parsed.api.endpoints[0].path === "/api/profiles/:id");
assert(parsed.ui.components.length === 1);
assert(parsed.ui.components[0].name === "ProfileCard.tsx");
```

**Expected:** Parser correctly extracts DB tables, API endpoints, and UI components.

### 2. ✅ Execution Coordinator Sequences DB→API→UI

**Test:**

```typescript
const executionOrder: string[] = [];

const mockCoordinator = new FeatureExecutionCoordinator({
  dbGenerator: {
    generate: async () => {
      executionOrder.push("db");
      return mockDbResult;
    },
  },
  apiGenerator: {
    generate: async () => {
      executionOrder.push("api");
      return mockApiResult;
    },
  },
  uiGenerator: {
    generate: async () => {
      executionOrder.push("ui");
      return mockUiResult;
    },
  },
});

await mockCoordinator.executeFeature(mockSpec);

assert.deepEqual(executionOrder, ["db", "api", "ui"]);
```

**Expected:** Layers execute in correct dependency order.

### 3. ✅ Cross-Layer Type Validation Catches Mismatches

**Test:**

```typescript
const dbSchema = {
  users: {
    columns: [
      { name: "id", type: "UUID" },
      { name: "email", type: "TEXT" },
      { name: "created_at", type: "TIMESTAMP" },
    ],
  },
};

const apiTypes = {
  User: {
    fields: {
      id: { type: "string" },
      email: { type: "string" },
      // Missing created_at field
    },
  },
};

const validator = new CrossLayerValidator();
const result = await validator.validateDbToApi(dbSchema, apiTypes);

assert(!result.passed);
assert(
  result.errors.some((e) => e.message.includes("missing field 'created_at'")),
);
```

**Expected:** Validator detects missing field in API type.

### 4. ✅ Integration Tests Run After All Layers Generated

**Test:**

```typescript
const testRunner = new IntegrationTestRunner();
const result = await testRunner.runTests([
  { name: "Type Check", command: "npx tsc --noEmit" },
  { name: "Unit Tests", command: "npm test" },
  { name: "Integration Tests", command: "npm run test:integration" },
]);

assert(result.results.length === 3);
assert(result.results[0].name === "Type Check");
assert(result.results.every((r) => r.duration > 0));
```

**Expected:** All test types executed and results captured.

### 5. ✅ Database Layer Failure Triggers Rollback

**Test:**

```typescript
const mockDbGenerator = {
  generate: async () => {
    throw new Error("Migration failed to apply");
  },
};

const coordinator = new FeatureExecutionCoordinator({
  dbGenerator: mockDbGenerator,
  apiGenerator: mockApiGenerator,
  uiGenerator: mockUiGenerator,
});

const result = await coordinator.executeFeature(mockSpec);

assert(!result.success);
assert(result.error.includes("Migration failed"));
// Verify API and UI generators were NOT called
assert(apiGeneratorCallCount === 0);
assert(uiGeneratorCallCount === 0);
```

**Expected:** DB failure prevents API/UI generation, returns error result.

### 6. ✅ API Layer Failure Rolls Back API Only (Keeps DB)

**Test:**

```typescript
const mockApiGenerator = {
  generate: async () => {
    throw new Error("API generation failed");
  },
};

const coordinator = new FeatureExecutionCoordinator({
  dbGenerator: successfulDbGenerator,
  apiGenerator: mockApiGenerator,
  uiGenerator: mockUiGenerator,
});

const result = await coordinator.executeFeature(mockSpec);

assert(!result.success);
assert(result.partialResults.database); // DB succeeded
assert(!result.partialResults.api); // API failed
// Verify DB migration NOT rolled back
const currentSchema = await getDbSchema();
assert(currentSchema.tables.includes("new_table_from_feature"));
```

**Expected:** DB changes preserved, API rollback executed, UI not attempted.

### 7. ✅ UI Layer Failure Rolls Back UI Only (Keeps DB+API)

**Test:**

```typescript
const mockUiGenerator = {
  generate: async () => {
    throw new Error("UI generation failed");
  },
};

const coordinator = new FeatureExecutionCoordinator({
  dbGenerator: successfulDbGenerator,
  apiGenerator: successfulApiGenerator,
  uiGenerator: mockUiGenerator,
});

const result = await coordinator.executeFeature(mockSpec);

assert(!result.success);
assert(result.partialResults.database); // DB succeeded
assert(result.partialResults.api); // API succeeded
assert(!result.partialResults.ui); // UI failed
// Verify API files still exist
assert(fs.existsSync("server/routes/new-route.ts"));
```

**Expected:** DB and API changes preserved, UI rollback executed.

### 8. ✅ Integration Test Failure Marks Task for Review

**Test:**

```typescript
const mockTestRunner = {
  runTests: async () => ({
    allPassed: false,
    results: [
      { name: "Type Check", passed: true },
      { name: "Unit Tests", passed: true },
      {
        name: "Integration Tests",
        passed: false,
        output: "Expected 200, got 500",
      },
    ],
  }),
};

const coordinator = new FeatureExecutionCoordinator({
  testRunner: mockTestRunner,
  // ... other generators
});

const result = await coordinator.executeFeature(mockSpec);

assert(!result.success);
assert(result.error.includes("Integration tests failed"));
// Verify code NOT rolled back (marked for review instead)
assert(fs.existsSync("server/routes/new-route.ts"));
assert(fs.existsSync("src/components/NewComponent.tsx"));
```

**Expected:** All code preserved, task status set to 'needs_review', test output captured.

### 9. ✅ Success Path Generates All Layers + Passes Tests

**Test:**

```typescript
const coordinator = new FeatureExecutionCoordinator({
  dbGenerator: successfulDbGenerator,
  apiGenerator: successfulApiGenerator,
  uiGenerator: successfulUiGenerator,
  validator: passingValidator,
  testRunner: passingTestRunner,
});

const result = await coordinator.executeFeature(validFeatureSpec);

assert(result.success);
assert(result.filesGenerated.length > 0);
assert(result.testResults.allPassed);
// Verify all layers generated
assert(fs.existsSync("database/migrations/134_add_feature.sql"));
assert(fs.existsSync("server/routes/feature.ts"));
assert(fs.existsSync("src/components/FeatureComponent.tsx"));
```

**Expected:** All layers generated, all tests pass, task marked completed.

### 10. ✅ Observability Logs Each Phase

**Test:**

```sql
-- After feature execution
SELECT phase, status, duration_ms
FROM task_execution_log
WHERE execution_id = '...'
ORDER BY created_at;

-- Expected output:
-- parse          | completed | 150
-- database       | completed | 2300
-- api            | completed | 4500
-- validate-db-api| completed | 500
-- ui             | completed | 3200
-- validate-api-ui| completed | 450
-- integration-tests | completed | 8000
```

**Expected:** All phases logged with status and duration.

---

## Dependencies

### Upstream (must exist first)

- ✅ VIBE-P13-001: Database Layer Code Generator (generates migrations)
- ✅ VIBE-P13-002: API Layer Code Generator (generates routes, middleware)
- ✅ VIBE-P13-003: Frontend Layer Code Generator (generates React components)
- ✅ VIBE-P13-004: Multi-Layer Validation Framework (type checking, integration tests)
- ✅ Spawner infrastructure (`parent-harness/orchestrator/src/spawner/`)
- ✅ Task system (`parent-harness/orchestrator/src/db/tasks.ts`)

### Downstream (depends on this)

- Future enhancement: Parallel feature execution (multiple features simultaneously)
- Future enhancement: Feature rollback from production (undo deployed features)
- Future enhancement: Feature branch integration (generate on separate branch)

### External Dependencies

- TypeScript compiler (`tsc`) for type checking
- Test runner (`npm test`) for validation
- Git for rollback operations (`git checkout`, `git reset`)

---

## Implementation Plan

### Phase 1: Feature Spec Parser (3-4 hours)

**Tasks:**

1. Create `feature-orchestrator.ts` in spawner directory
2. Implement `FeatureSpecParser` class
3. Add markdown section extraction (DB Layer, API Layer, UI Layer)
4. Add database layer parsing (tables, columns, indexes)
5. Add API layer parsing (endpoints, middleware, schemas)
6. Add UI layer parsing (components, pages, state management)
7. Write unit tests for parser

**Deliverables:**

- `FeatureSpecParser.parse()` returns `ParsedFeatureSpec`
- Handles all three layers correctly
- Graceful error handling for malformed specs

### Phase 2: Execution Coordinator (5-6 hours)

**Tasks:**

1. Implement `FeatureExecutionCoordinator` class
2. Add phase execution framework (`executePhase()`)
3. Add DB layer execution with schema capture
4. Add API layer execution with contract capture
5. Add UI layer execution with component tracking
6. Add rollback action registration
7. Add error handling and rollback orchestration

**Deliverables:**

- `FeatureExecutionCoordinator.executeFeature()` orchestrates all layers
- Executes in correct dependency order (DB→API→UI)
- Registers and executes rollback actions on failure

### Phase 3: Cross-Layer Type Validator (4-5 hours)

**Tasks:**

1. Create `cross-layer-validator.ts`
2. Implement `CrossLayerValidator` class
3. Add DB→API type validation (schema to TypeScript types)
4. Add API→UI type validation (contracts to component props)
5. Add SQL-to-TypeScript type mapping
6. Add TypeScript type parsing utilities
7. Write unit tests for validator

**Deliverables:**

- `CrossLayerValidator.validateDbToApi()` catches DB/API mismatches
- `CrossLayerValidator.validateApiToUi()` catches API/UI mismatches
- Detailed error messages with suggestions

### Phase 4: Integration Test Runner (3-4 hours)

**Tasks:**

1. Create `integration-test-runner.ts`
2. Implement `IntegrationTestRunner` class
3. Add command execution utility (with timeout)
4. Add type check test (TypeScript compilation)
5. Add unit test execution (parallel)
6. Add integration test execution (serial)
7. Add result aggregation and summary generation

**Deliverables:**

- `IntegrationTestRunner.runTests()` executes all test levels
- Captures exit codes, stdout, stderr
- Generates comprehensive test report

### Phase 5: Rollback Strategies (3-4 hours)

**Tasks:**

1. Implement database rollback (migration down)
2. Implement API rollback (delete generated files, restore from git)
3. Implement UI rollback (delete components, restore routing)
4. Add rollback verification (ensure clean state)
5. Add rollback logging (audit trail)
6. Write integration tests for rollback

**Deliverables:**

- Rollback functions for each layer
- Verification that rollback restores original state
- Audit logging of all rollback actions

### Phase 6: Spawner Integration (2-3 hours)

**Tasks:**

1. Export `FeatureOrchestrator` from spawner index
2. Add `spawnFeatureImplementation()` function
3. Integrate with task system (detect feature tasks)
4. Update orchestrator to call feature orchestrator for feature tasks
5. Add observability logging (phase logs to database)

**Deliverables:**

- Feature orchestrator callable from main orchestrator
- Task system recognizes and routes feature implementation tasks
- Observability integrated

### Phase 7: End-to-End Testing (3-4 hours)

**Tasks:**

1. Create test fixture: complete feature spec (DB+API+UI)
2. Test success path (all layers generated, tests pass)
3. Test DB failure path (migration fails → rollback → error)
4. Test API failure path (API gen fails → rollback API → keep DB)
5. Test UI failure path (UI gen fails → rollback UI → keep DB+API)
6. Test integration test failure (mark for review, no rollback)
7. Test type validation failure (halt before next layer)
8. Verify observability logs for each scenario

**Deliverables:**

- 7+ end-to-end test scenarios
- All pass criteria validated
- Integration with full orchestrator confirmed

**Total Estimated Time:** 20-24 hours (3-4 days)

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/feature-orchestrator/spec-parser.test.ts`

```typescript
describe("FeatureSpecParser", () => {
  it("should parse database layer with tables and columns", () => {
    const spec = `
## Database Layer
### Tables
- users
  - id: UUID PRIMARY KEY
  - email: TEXT UNIQUE NOT NULL
`;

    const parser = new FeatureSpecParser();
    const parsed = parser.parse(spec);

    expect(parsed.database.tables).toHaveLength(1);
    expect(parsed.database.tables[0].name).toBe("users");
    expect(parsed.database.tables[0].columns).toHaveLength(2);
    expect(parsed.database.tables[0].columns[0].name).toBe("id");
    expect(parsed.database.tables[0].columns[0].type).toBe("UUID");
  });

  it("should parse API layer with endpoints", () => {
    const spec = `
## API Layer
### Endpoints
- POST /api/auth/login
  - Body: { email: string, password: string }
  - Response: { token: string }
`;

    const parser = new FeatureSpecParser();
    const parsed = parser.parse(spec);

    expect(parsed.api.endpoints).toHaveLength(1);
    expect(parsed.api.endpoints[0].method).toBe("POST");
    expect(parsed.api.endpoints[0].path).toBe("/api/auth/login");
  });
});
```

### Integration Tests

**File:** `tests/integration/feature-orchestrator/execution.test.ts`

```typescript
describe("FeatureExecutionCoordinator", () => {
  it("should execute all layers in correct order", async () => {
    const executionLog: string[] = [];

    const coordinator = new FeatureExecutionCoordinator({
      dbGenerator: {
        generate: async () => {
          executionLog.push("db");
          return mockDbResult;
        },
      },
      apiGenerator: {
        generate: async () => {
          executionLog.push("api");
          return mockApiResult;
        },
      },
      uiGenerator: {
        generate: async () => {
          executionLog.push("ui");
          return mockUiResult;
        },
      },
      validator: passingValidator,
      testRunner: passingTestRunner,
    });

    await coordinator.executeFeature(validFeatureSpec);

    expect(executionLog).toEqual(["db", "api", "ui"]);
  });

  it("should rollback API on API failure", async () => {
    const rollbackLog: string[] = [];

    const coordinator = new FeatureExecutionCoordinator({
      dbGenerator: successfulDbGenerator,
      apiGenerator: {
        generate: async () => {
          throw new Error("API generation failed");
        },
      },
      uiGenerator: mockUiGenerator,
      rollbackApi: async () => {
        rollbackLog.push("api-rollback");
      },
    });

    const result = await coordinator.executeFeature(validFeatureSpec);

    expect(result.success).toBe(false);
    expect(rollbackLog).toContain("api-rollback");
  });
});
```

### Manual Testing Checklist

- [ ] Feature orchestrator parses all three layers correctly
- [ ] Database layer executes first and captures schema
- [ ] API layer receives DB schema and generates types
- [ ] UI layer receives API contracts and generates components
- [ ] DB→API type validation catches mismatches
- [ ] API→UI type validation catches mismatches
- [ ] Integration tests run after all layers generated
- [ ] DB failure prevents API/UI generation
- [ ] API failure rolls back API but keeps DB
- [ ] UI failure rolls back UI but keeps DB+API
- [ ] Integration test failure marks task for review
- [ ] Success path generates all files and passes tests
- [ ] Observability logs all phases to database

---

## Open Questions

### 1. Parallel Execution Strategy?

**Question:** Should API and UI layer generation run in parallel (independent work) or serial (one after another)?

**Options:**

- **A:** Serial (simpler, easier debugging, predictable resource usage)
- **B:** Parallel (faster, but more complex coordination)
- **C:** Configurable (default serial, opt-in parallel)

**Recommendation:** **A** for Phase 13, upgrade to **C** in future enhancement (parallel execution optimization phase)

### 2. Rollback Depth on Integration Test Failure?

**Question:** When integration tests fail but all layers generated successfully, should we rollback all code or mark for review?

**Options:**

- **A:** Rollback all (safe but wasteful, generated code might be 95% correct)
- **B:** Mark for review (pragmatic, human reviews and fixes minor issues)
- **C:** Retry with test feedback (autonomous, but may not fix integration issues)

**Recommendation:** **B** (mark for review, escalate to QA Agent or human)

### 3. Feature Spec Format?

**Question:** Should feature specs be markdown (readable) or JSON (structured)?

**Options:**

- **A:** Markdown (human-friendly, easy to write, requires parsing)
- **B:** JSON (machine-friendly, schema-validated, harder for humans)
- **C:** Both (markdown as input, parsed to JSON for processing)

**Recommendation:** **C** (accept markdown, convert to JSON internally)

---

## Success Metrics

### Short-term (2 weeks)

1. **Feature Completion Rate**: 60% of multi-layer features complete successfully
2. **Type Consistency**: 90% of generated code has consistent types across layers
3. **Integration Test Pass Rate**: 70% of generated features pass integration tests
4. **Rollback Success**: 100% of failed attempts rollback cleanly

### Medium-term (1 month)

1. **Autonomous Feature Delivery**: 50% of feature specs result in working, tested code without human intervention
2. **Cross-Layer Bug Rate**: <5% of generated features have integration bugs
3. **Developer Satisfaction**: Positive feedback on full-stack code quality
4. **Time Savings**: 80% reduction in time to implement full-stack features

### Long-term (3 months)

1. **Full Autonomy**: 70% of feature specs complete end-to-end autonomously
2. **Zero Integration Bugs**: <1% of generated features fail integration tests
3. **Cost Efficiency**: Average feature implementation cost <$2 (all Claude API calls)
4. **Pattern Learning**: Orchestrator references existing patterns for all layers

---

## References

### Existing Specifications

- **VIBE-P13-001**: Database Layer Code Generator
- **VIBE-P13-002**: API Layer Code Generator
- **VIBE-P13-003**: Frontend Layer Code Generator
- **VIBE-P13-004**: Multi-Layer Validation Framework
- **PHASE2-TASK-02**: Build Agent Task Executor (similar orchestration pattern)

### Architecture Documents

- **STRATEGIC_PLAN.md**: Phase 13 roadmap (autonomous code generation)
- **parent-harness/docs/AGENTS.md**: Agent coordination patterns

### Code References

- **parent-harness/orchestrator/src/spawner/index.ts**: Existing spawner infrastructure
- **parent-harness/orchestrator/src/db/tasks.ts**: Task system integration points
- **agents/build/code-generator.ts**: Code generation patterns to reference

---

## Conclusion

VIBE-P13-005 completes the autonomous full-stack feature implementation pipeline by orchestrating database, API, and frontend layer generators into a cohesive, coordinated workflow. By parsing feature specifications, sequencing layer generation correctly, validating cross-layer type consistency, and handling failures gracefully with appropriate rollback strategies, the Feature Orchestration Layer enables true end-to-end autonomous feature delivery.

**Key Success Factors:**

1. **Correct Dependency Sequencing** - DB before API, API before UI
2. **Robust Type Validation** - Catch cross-layer mismatches early
3. **Intelligent Rollback** - Partial failures don't corrupt codebase
4. **Comprehensive Testing** - Integration tests validate full stack

**Next Steps:**

1. **Approval** - Review and approve this specification
2. **Implementation** - Assign to Build Agent
3. **Validation** - QA Agent verifies against pass criteria
4. **Integration** - Test with VIBE-P13-001, VIBE-P13-002, VIBE-P13-003, VIBE-P13-004

**Status:** Ready for implementation.

TASK_COMPLETE: Created comprehensive technical specification for Feature Implementation Orchestration Layer (VIBE-P13-005) covering feature spec parsing, execution coordination, cross-layer type validation, integration testing, and rollback strategies. Specification includes 10 testable pass criteria, detailed technical design with 4 key components, 7-phase implementation plan (20-24 hours), and integration with existing spawner infrastructure.
