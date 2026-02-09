# VIBE-P13-004: Database Migration Generator Module - Technical Specification

**Status:** SPECIFICATION COMPLETE
**Created:** 2026-02-09
**Priority:** P1 (Phase 13 - Multi-Layer Code Generation)
**Effort:** Medium (12-16 hours)
**Model:** Opus
**Agent Type:** build_agent

---

## Overview

Implement a specialized code generator module within the spawner system that transforms database schema specifications into production-ready migration files. The generator automatically detects existing tables, generates appropriate CREATE or ALTER statements, supports multiple database syntaxes (SQLite, PostgreSQL, MySQL), and generates corresponding TypeScript type definitions.

### Problem Statement

**Current State:**
- Spawner system exists at `parent-harness/orchestrator/src/spawner/`
- Backend generator module exists as reference pattern (`generators/backend.ts`)
- No database migration generator module
- Manual migration file creation is time-consuming and error-prone
- No automatic detection of existing schema state
- No automated TypeScript type generation from schema changes
- Database schema changes require manual coordination between SQL and TypeScript types

**Desired State:**
- `DatabaseMigrationGenerator` module at `parent-harness/orchestrator/src/spawner/generators/database.ts`
- Accept schema specifications (tables, columns, constraints, indexes)
- Auto-detect existing tables via schema introspection
- Generate CREATE TABLE for new tables, ALTER TABLE for existing
- Support SQLite, PostgreSQL, and MySQL syntax
- Generate numbered migration files matching codebase pattern (YYYYMMDDHHMMSS_description.sql)
- Generate corresponding TypeScript interfaces/types
- Reversible migrations with up() and down() methods
- Validate generated SQL syntax before output

### Value Proposition

The Database Migration Generator is the **"Schema Evolution Automator"** that:

1. **Accelerates Development** - Generate migrations from specifications in seconds
2. **Ensures Consistency** - Keep SQL schema and TypeScript types in sync automatically
3. **Prevents Errors** - Detect schema conflicts before migrations run
4. **Multi-Database Support** - Generate migrations for SQLite, PostgreSQL, MySQL from single spec
5. **Reversible Changes** - Auto-generate down() migrations for safe rollbacks
6. **Type Safety** - Generate TypeScript types matching database schema exactly
7. **Integrates Seamlessly** - Follows existing migration patterns and naming conventions

---

## Requirements

### Functional Requirements

#### FR-1: DatabaseMigrationGenerator Module

**FR-1.1: Module Structure**
- Create `DatabaseMigrationGenerator` module at `parent-harness/orchestrator/src/spawner/generators/database.ts`
- Export `generateMigration()` function matching spawner generator pattern
- Follow same structure as `backend.ts` generator
- Stateless function design for parallel execution
- All configuration passed via spec parameter

**FR-1.2: Core Method - generateMigration()**
```typescript
export function generateMigration(spec: MigrationSpec): GeneratedMigration {
  // 1. Validate specification
  // 2. Detect existing schema state
  // 3. Determine operation type (CREATE vs ALTER)
  // 4. Generate SQL migration (up)
  // 5. Generate reverse migration (down)
  // 6. Generate TypeScript types
  // 7. Format migration file
  // 8. Return complete output
}
```

**FR-1.3: Input Specification Interface**
```typescript
interface MigrationSpec {
  /** Migration description */
  description: string;

  /** Database type */
  databaseType: 'sqlite' | 'postgresql' | 'mysql';

  /** Tables to create or modify */
  tables: TableDefinition[];

  /** Optional: Path to existing database for introspection */
  existingDbPath?: string;

  /** Optional: Migration file naming format */
  fileFormat?: 'timestamp' | 'numbered';

  /** Optional: Generate TypeScript types */
  generateTypes?: boolean;
}

interface TableDefinition {
  /** Table name (snake_case) */
  name: string;

  /** Table description for comments */
  description?: string;

  /** Column definitions */
  columns: ColumnDefinition[];

  /** Primary key column(s) */
  primaryKey?: string[];

  /** Foreign key constraints */
  foreignKeys?: ForeignKeyDefinition[];

  /** Unique constraints */
  uniqueConstraints?: UniqueConstraintDefinition[];

  /** Check constraints */
  checkConstraints?: CheckConstraintDefinition[];

  /** Indexes */
  indexes?: IndexDefinition[];
}

interface ColumnDefinition {
  /** Column name */
  name: string;

  /** Data type */
  type: ColumnType;

  /** Nullable? */
  nullable: boolean;

  /** Default value */
  default?: string | number | boolean | null;

  /** Unique constraint */
  unique?: boolean;

  /** Auto-increment (for primary keys) */
  autoIncrement?: boolean;

  /** Column description */
  description?: string;
}

type ColumnType =
  | 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NUMERIC'  // SQLite
  | 'VARCHAR' | 'INT' | 'BIGINT' | 'DECIMAL' | 'BOOLEAN' | 'TIMESTAMP' | 'DATE' | 'UUID' | 'JSONB'  // PostgreSQL
  | 'CHAR' | 'TINYINT' | 'DATETIME' | 'JSON';  // MySQL

interface ForeignKeyDefinition {
  /** Local column(s) */
  columns: string[];

  /** Referenced table */
  referencedTable: string;

  /** Referenced column(s) */
  referencedColumns: string[];

  /** ON DELETE action */
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';

  /** ON UPDATE action */
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

interface UniqueConstraintDefinition {
  /** Constraint name */
  name: string;

  /** Columns in constraint */
  columns: string[];
}

interface CheckConstraintDefinition {
  /** Constraint name */
  name: string;

  /** SQL expression */
  expression: string;
}

interface IndexDefinition {
  /** Index name */
  name: string;

  /** Columns to index */
  columns: string[];

  /** Unique index? */
  unique: boolean;

  /** Index type (PostgreSQL-specific) */
  type?: 'btree' | 'hash' | 'gin' | 'gist';
}
```

**FR-1.4: Output Interface**
```typescript
interface GeneratedMigration {
  /** Migration file metadata */
  metadata: {
    filename: string;           // e.g., "20260209120000_create_users_table.sql"
    description: string;
    databaseType: string;
    operationType: 'CREATE' | 'ALTER' | 'MIXED';
    tablesAffected: string[];
    generatedAt: string;
  };

  /** SQL migration content (up) */
  upMigration: string;

  /** SQL migration content (down) */
  downMigration: string;

  /** TypeScript type definitions */
  typeDefinitions?: string;

  /** Validation results */
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}
```

#### FR-2: Schema Introspection

**FR-2.1: Detect Existing Tables**
- Read SQLite database file via `sql.js` (if path provided)
- Query `sqlite_master` table for existing tables
- Read table schema via `PRAGMA table_info(table_name)`
- Determine if CREATE or ALTER needed per table

**FR-2.2: Schema Comparison**
```typescript
interface SchemaIntrospection {
  /** Existing tables */
  existingTables: string[];

  /** Table schemas */
  tableSchemas: Map<string, ExistingTableSchema>;

  /** Detect operation needed */
  determineOperation(tableName: string): 'CREATE' | 'ALTER' | 'SKIP';
}

interface ExistingTableSchema {
  tableName: string;
  columns: ExistingColumn[];
  indexes: ExistingIndex[];
  foreignKeys: ExistingForeignKey[];
}

interface ExistingColumn {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}
```

**FR-2.3: Migration Strategy Selection**
- **CREATE TABLE**: Table doesn't exist in database
- **ALTER TABLE**: Table exists, add/modify columns
- **SKIP**: Table exists with identical schema
- Generate warnings for potentially destructive operations (DROP COLUMN)

#### FR-3: SQL Migration Generation

**FR-3.1: CREATE TABLE Statements**
```sql
-- SQLite format (matches existing migration patterns)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

**FR-3.2: ALTER TABLE Statements**
```sql
-- Add new columns
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
```

**FR-3.3: Foreign Key Constraints**
```sql
-- SQLite (inline with CREATE TABLE)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- PostgreSQL (separate ALTER TABLE)
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

**FR-3.4: Database-Specific Syntax**

**SQLite:**
- Data types: `TEXT`, `INTEGER`, `REAL`, `BLOB`
- Booleans: `INTEGER` (0/1)
- Timestamps: `TEXT` with `datetime('now')`
- Auto-increment: `INTEGER PRIMARY KEY` (automatic)
- Foreign keys: Inline `REFERENCES` clause
- Pattern: Match existing migrations in `database/migrations/`

**PostgreSQL:**
- Data types: `VARCHAR`, `INTEGER`, `BIGINT`, `DECIMAL`, `BOOLEAN`, `TIMESTAMP`, `UUID`, `JSONB`
- Auto-increment: `SERIAL` or `BIGSERIAL`
- Timestamps: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- Foreign keys: `ALTER TABLE ADD CONSTRAINT`
- Partial indexes: `CREATE INDEX WHERE condition`

**MySQL:**
- Data types: `VARCHAR`, `INT`, `BIGINT`, `DECIMAL`, `TINYINT(1)`, `DATETIME`, `JSON`, `CHAR(36)`
- Auto-increment: `AUTO_INCREMENT`
- Timestamps: `DATETIME DEFAULT CURRENT_TIMESTAMP`
- Engine: `ENGINE=InnoDB`
- Character set: `DEFAULT CHARSET=utf8mb4`

#### FR-4: Reverse Migration Generation

**FR-4.1: Down Migration Strategy**
- **CREATE TABLE** → **DROP TABLE IF EXISTS**
- **ALTER TABLE ADD COLUMN** → **ALTER TABLE DROP COLUMN** (if supported)
- **CREATE INDEX** → **DROP INDEX IF EXISTS**
- **ADD CONSTRAINT** → **DROP CONSTRAINT**

**FR-4.2: Down Migration Example**
```sql
-- Down migration for CREATE TABLE
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS users;

-- Down migration for ALTER TABLE
ALTER TABLE users DROP COLUMN phone;
ALTER TABLE users DROP COLUMN verified;
DROP INDEX IF EXISTS idx_users_phone;
```

**FR-4.3: Destructive Operation Warnings**
- Warn if down migration will drop columns with data
- Warn if foreign key constraints prevent table drops
- Suggest data backup before reversible migrations

#### FR-5: TypeScript Type Generation

**FR-5.1: Interface Generation**
```typescript
/**
 * User table row
 * Generated from migration: 20260209120000_create_users_table
 */
export interface User {
  id: string;
  email: string;
  name: string;
  age: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * User table insert input (omits auto-generated fields)
 */
export interface UserInsert {
  id: string;
  email: string;
  name: string;
  age?: number | null;
}
```

**FR-5.2: Type Mapping (SQL → TypeScript)**
```typescript
const typeMap: Record<string, string> = {
  // SQLite
  'TEXT': 'string',
  'INTEGER': 'number',
  'REAL': 'number',
  'BLOB': 'Buffer',
  'NUMERIC': 'number',

  // PostgreSQL
  'VARCHAR': 'string',
  'TEXT': 'string',
  'INT': 'number',
  'INTEGER': 'number',
  'BIGINT': 'number',
  'DECIMAL': 'number',
  'NUMERIC': 'number',
  'BOOLEAN': 'boolean',
  'TIMESTAMP': 'string',
  'DATE': 'string',
  'UUID': 'string',
  'JSONB': 'Record<string, unknown>',
  'JSON': 'Record<string, unknown>',

  // MySQL
  'CHAR': 'string',
  'TINYINT': 'number',
  'DATETIME': 'string',
};
```

**FR-5.3: Nullable Handling**
- Nullable columns: `field: type | null`
- Non-nullable columns: `field: type`
- Optional columns (for inserts): `field?: type`

**FR-5.4: Type File Output**
- Generate `.d.ts` file alongside migration
- Export all table interfaces
- Include JSDoc comments with schema metadata
- Reference migration file in comments

#### FR-6: Migration File Formatting

**FR-6.1: Timestamp Format**
- Format: `YYYYMMDDHHMMSS` (e.g., `20260209120000`)
- Generate from current date/time
- Ensures unique, sortable filenames

**FR-6.2: File Naming Convention**
```
{timestamp}_{description}.sql
```
Examples:
- `20260209120000_create_users_table.sql`
- `20260209120100_add_phone_to_users.sql`
- `20260209120200_create_orders_and_items.sql`

**FR-6.3: Migration File Header**
```sql
-- Migration: {timestamp}
-- Description: {description}
-- Database: {databaseType}
-- Tables: {table1, table2, ...}
-- Generated: {ISO timestamp}
-- Operation: {CREATE | ALTER | MIXED}

-- UP MIGRATION

{SQL statements}

-- DOWN MIGRATION

{SQL statements}
```

**FR-6.4: SQL Formatting**
- Indent: 2 spaces
- Line length: Max 120 characters
- Keywords: UPPERCASE (CREATE, TABLE, INDEX, etc.)
- Identifiers: lowercase (table_name, column_name)
- Comments: Inline for complex constraints
- Blank lines: Between tables, after indexes

#### FR-7: Validation and Error Handling

**FR-7.1: Input Validation**
- Validate table names: lowercase, snake_case, alphanumeric + underscore
- Validate column names: same rules as table names
- Check for reserved keywords (SELECT, WHERE, etc.)
- Validate foreign key references (target table exists)
- Ensure primary key defined for each table
- Check for duplicate column names
- Validate data types for selected database

**FR-7.2: Schema Conflict Detection**
- Detect if table already exists with different schema
- Warn about incompatible column type changes
- Detect missing referenced tables for foreign keys
- Warn about potential data loss (column type narrowing)

**FR-7.3: Error Messages**
```typescript
interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  table?: string;
  column?: string;
  suggestion?: string;
}
```

**FR-7.4: Common Validation Errors**
- `INVALID_TABLE_NAME`: Table name contains invalid characters
- `MISSING_PRIMARY_KEY`: Table has no primary key defined
- `DUPLICATE_COLUMN`: Column name appears twice in table
- `INVALID_FOREIGN_KEY`: Referenced table doesn't exist
- `RESERVED_KEYWORD`: Table/column name is SQL reserved word
- `TYPE_MISMATCH`: Column type incompatible with database type

#### FR-8: Integration with Spawner System

**FR-8.1: Generator Registration**
- Export generator function matching spawner pattern
- Register with spawner orchestrator
- Support parallel execution for multiple migrations
- Return standardized `GeneratedCode` interface

**FR-8.2: Spawner Interface Compliance**
```typescript
/**
 * Generate database migration from specification
 */
export function generateMigration(spec: MigrationSpec): GeneratedCode {
  const result = generateMigrationImpl(spec);

  return {
    // Migration file (SQL)
    routeHandler: result.upMigration,  // Reuse field for SQL content

    // Type definitions
    typeDefinitions: result.typeDefinitions || '',

    // Down migration (validation middleware field reused)
    validationMiddleware: result.downMigration,

    // Metadata (OpenAPI doc field reused)
    openApiDoc: JSON.stringify(result.metadata, null, 2),
  };
}
```

**FR-8.3: File Output Locations**
- SQL migrations: `database/migrations/{timestamp}_{description}.sql`
- Type definitions: `types/generated/db/{table_name}.d.ts`
- Follow existing codebase directory structure

### Non-Functional Requirements

**NFR-1: Code Quality**
- TypeScript strict mode enabled
- Comprehensive JSDoc comments for all exported functions
- No `any` types (use proper type definitions)
- Pure functions (no side effects in generation logic)
- Modular design (separate concerns: validation, generation, formatting)

**NFR-2: Performance**
- Generate migration for 10 tables in < 500ms
- Schema introspection for 100 tables in < 1 second
- Type generation for 20 tables in < 200ms
- Memory efficient (stream large outputs)

**NFR-3: Compatibility**
- SQLite 3.35+ (match existing codebase)
- PostgreSQL 12+ compatibility
- MySQL 8.0+ compatibility
- Prisma schema compatibility (future)
- Drizzle ORM compatibility (future)

**NFR-4: Maintainability**
- Clear separation of database-specific logic
- Easy to add new database types
- Template-based SQL generation
- Extensible type mapping system
- Well-documented code with examples

**NFR-5: Reliability**
- 100% of generated SQL passes syntax validation
- Reversible migrations (up/down always paired)
- Idempotent migrations (IF NOT EXISTS, IF EXISTS)
- Transaction safety (batch operations)

---

## Technical Design

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│           DatabaseMigrationGenerator                       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Specification Validation                            │ │
│  │  - Validate table/column names                       │ │
│  │  - Check data types for database                     │ │
│  │  - Validate foreign key references                   │ │
│  │  - Detect reserved keywords                          │ │
│  └──────────────────────────────────────────────────────┘ │
│                         │                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Schema Introspection (Optional)                     │ │
│  │  - Read existing database schema                     │ │
│  │  - Detect existing tables/columns                    │ │
│  │  - Determine CREATE vs ALTER operations              │ │
│  └──────────────────────────────────────────────────────┘ │
│                         │                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  SQL Generation Engine                               │ │
│  │  ┌────────────┬────────────┬───────────────┐         │ │
│  │  │ SQLite Gen │ Postgres   │ MySQL Gen     │         │ │
│  │  │            │ Gen        │               │         │ │
│  │  │ - CREATE   │ - CREATE   │ - CREATE      │         │ │
│  │  │ - ALTER    │ - ALTER    │ - ALTER       │         │ │
│  │  │ - Indexes  │ - Indexes  │ - Indexes     │         │ │
│  │  │ - FKs      │ - FKs      │ - FKs         │         │ │
│  │  └────────────┴────────────┴───────────────┘         │ │
│  └──────────────────────────────────────────────────────┘ │
│                         │                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Reverse Migration Generator                         │ │
│  │  - Generate DROP TABLE statements                    │ │
│  │  - Generate DROP INDEX statements                    │ │
│  │  - Generate DROP CONSTRAINT statements               │ │
│  └──────────────────────────────────────────────────────┘ │
│                         │                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  TypeScript Type Generator                           │ │
│  │  - Map SQL types → TypeScript types                  │ │
│  │  - Generate interfaces for tables                    │ │
│  │  - Generate insert/update types                      │ │
│  │  - Add JSDoc comments                                │ │
│  └──────────────────────────────────────────────────────┘ │
│                         │                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Migration File Formatter                            │ │
│  │  - Generate timestamp filename                       │ │
│  │  - Format SQL with proper indentation                │ │
│  │  - Add migration header comments                     │ │
│  │  - Combine up/down migrations                        │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Module Structure

```typescript
// ============================================================================
// MAIN GENERATOR MODULE
// ============================================================================

/**
 * Database Migration Generator Module (VIBE-P13-004)
 *
 * Generates database migrations from schema specifications.
 * Supports SQLite, PostgreSQL, and MySQL.
 * Auto-detects existing schema and generates appropriate CREATE or ALTER statements.
 */

export function generateMigration(spec: MigrationSpec): GeneratedMigration {
  // 1. Validate specification
  const validation = validateSpecification(spec);
  if (!validation.valid) {
    return {
      metadata: createErrorMetadata(spec),
      upMigration: '',
      downMigration: '',
      validation
    };
  }

  // 2. Introspect existing schema (if database path provided)
  const introspection = spec.existingDbPath
    ? introspectSchema(spec.existingDbPath)
    : null;

  // 3. Determine operation type for each table
  const operations = determineOperations(spec.tables, introspection);

  // 4. Generate up migration SQL
  const upMigration = generateUpMigration(spec, operations);

  // 5. Generate down migration SQL
  const downMigration = generateDownMigration(spec, operations);

  // 6. Generate TypeScript types (if requested)
  const typeDefinitions = spec.generateTypes
    ? generateTypeDefinitions(spec.tables)
    : undefined;

  // 7. Create metadata
  const metadata = createMetadata(spec, operations);

  // 8. Return complete migration
  return {
    metadata,
    upMigration,
    downMigration,
    typeDefinitions,
    validation: { valid: true, errors: [], warnings: validation.warnings }
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateSpecification(spec: MigrationSpec): ValidationResult { }
function introspectSchema(dbPath: string): SchemaIntrospection | null { }
function determineOperations(tables: TableDefinition[], introspection: SchemaIntrospection | null): OperationType[] { }
function generateUpMigration(spec: MigrationSpec, operations: OperationType[]): string { }
function generateDownMigration(spec: MigrationSpec, operations: OperationType[]): string { }
function generateTypeDefinitions(tables: TableDefinition[]): string { }
function createMetadata(spec: MigrationSpec, operations: OperationType[]): GeneratedMigration['metadata'] { }
```

### File Organization

```
parent-harness/orchestrator/src/spawner/generators/
├── database.ts                     # Main generator module
├── database-types.ts               # Type definitions
├── sql-generators/
│   ├── sqlite-generator.ts         # SQLite-specific SQL generation
│   ├── postgresql-generator.ts     # PostgreSQL-specific SQL generation
│   └── mysql-generator.ts          # MySQL-specific SQL generation
├── schema-introspector.ts          # Schema introspection logic
├── type-generator.ts               # TypeScript type generation
├── migration-formatter.ts          # Migration file formatting
└── sql-validator.ts                # SQL syntax validation
```

### Integration Points

**1. Spawner Orchestrator**
- Location: `parent-harness/orchestrator/src/spawner/index.ts`
- Register `generateMigration()` with spawner
- Support parallel migration generation

**2. Existing Migration System**
- Location: `database/migrations/`
- Pattern: Follow existing numbering/naming (001, 002, ..., 133)
- Format: Match existing SQLite migration syntax

**3. Database Module**
- Location: `database/db.ts`
- Use `getDb()` for schema introspection
- Use `query()` to read `sqlite_master` table

**4. Type System**
- Location: `types/generated/db/`
- Generate `.d.ts` files for each table
- Import in service layers for type safety

---

## Implementation Guide

### Phase 1: Core Foundation (4-5 hours)

**Step 1.1: Type Definitions**
- Create `database-types.ts` with all interfaces
- Define `MigrationSpec`, `TableDefinition`, `ColumnDefinition`
- Define `GeneratedMigration`, `ValidationResult`
- Export all types

**Step 1.2: Main Generator Module**
- Create `database.ts` with `generateMigration()` function
- Implement basic structure (validate → introspect → generate → format)
- Set up module exports

**Step 1.3: Input Validation**
- Create `sql-validator.ts`
- Implement `validateSpecification()` function
- Validate table names, column names, data types
- Check for reserved keywords, duplicate names

### Phase 2: Schema Introspection (3-4 hours)

**Step 2.1: SQLite Introspection**
- Create `schema-introspector.ts`
- Implement `introspectSchema()` function
- Query `sqlite_master` for existing tables
- Use `PRAGMA table_info()` for column details
- Return `SchemaIntrospection` object

**Step 2.2: Operation Determination**
- Implement `determineOperations()` function
- Compare spec tables with existing schema
- Return CREATE, ALTER, or SKIP for each table
- Detect column additions/changes

### Phase 3: SQL Generation (4-5 hours)

**Step 3.1: SQLite Generator**
- Create `sql-generators/sqlite-generator.ts`
- Implement `generateCreateTable()` function
- Implement `generateAlterTable()` function
- Generate indexes, foreign keys, constraints
- Follow existing migration pattern

**Step 3.2: PostgreSQL Generator**
- Create `sql-generators/postgresql-generator.ts`
- Implement PostgreSQL-specific syntax
- Map data types (UUID, JSONB, TIMESTAMP, etc.)
- Generate `SERIAL` for auto-increment
- Add `ALTER TABLE ADD CONSTRAINT` for foreign keys

**Step 3.3: MySQL Generator**
- Create `sql-generators/mysql-generator.ts`
- Implement MySQL-specific syntax
- Map data types (CHAR(36), JSON, DATETIME, etc.)
- Add `ENGINE=InnoDB` specification
- Use `AUTO_INCREMENT` for primary keys

**Step 3.4: Down Migration Generation**
- Implement `generateDownMigration()` function
- Generate `DROP TABLE`, `DROP INDEX`, `DROP CONSTRAINT`
- Add warnings for destructive operations
- Ensure reversibility

### Phase 4: TypeScript Type Generation (2-3 hours)

**Step 4.1: Type Mapper**
- Create `type-generator.ts`
- Implement SQL → TypeScript type mapping
- Handle nullable columns (`type | null`)
- Handle optional fields for inserts (`field?: type`)

**Step 4.2: Interface Generation**
- Implement `generateTypeDefinitions()` function
- Generate interface for each table
- Add JSDoc comments with schema metadata
- Generate insert/update variants

### Phase 5: Formatting & Integration (2-3 hours)

**Step 5.1: Migration File Formatting**
- Create `migration-formatter.ts`
- Generate timestamp-based filenames
- Format SQL with proper indentation
- Add migration header comments
- Combine up/down migrations

**Step 5.2: Spawner Integration**
- Update spawner orchestrator to register generator
- Map `MigrationSpec` to spawner input format
- Map `GeneratedMigration` to spawner output format
- Test parallel generation

**Step 5.3: Testing**
- Create unit tests for each generator function
- Test validation, introspection, SQL generation
- Test TypeScript type generation
- Integration test with spawner system

---

## Pass Criteria

### Must Pass (Critical)

1. **PC-1: Generator Module Exists**
   - ✅ File exists at `parent-harness/orchestrator/src/spawner/generators/database.ts`
   - ✅ Exports `generateMigration()` function
   - ✅ TypeScript compilation succeeds with no errors

2. **PC-2: SQLite Migration Generation**
   - ✅ Generates valid SQLite CREATE TABLE statements
   - ✅ Follows existing migration pattern (IF NOT EXISTS, datetime('now'), etc.)
   - ✅ Generates CREATE INDEX statements
   - ✅ Generates foreign key REFERENCES clauses
   - ✅ Matches format in `database/migrations/` directory

3. **PC-3: Reversible Migrations**
   - ✅ Down migration generated for CREATE TABLE (DROP TABLE)
   - ✅ Down migration generated for CREATE INDEX (DROP INDEX)
   - ✅ Down migration generated for ALTER TABLE (reverse operations)
   - ✅ Up and down migrations are paired correctly

4. **PC-4: Schema Introspection**
   - ✅ Detects existing tables from SQLite database
   - ✅ Reads column definitions via PRAGMA table_info
   - ✅ Determines CREATE vs ALTER operations correctly
   - ✅ Handles database file not found gracefully

5. **PC-5: TypeScript Type Generation**
   - ✅ Generates valid TypeScript interfaces for tables
   - ✅ Maps SQL types to TypeScript types correctly
   - ✅ Handles nullable columns (`type | null`)
   - ✅ Includes JSDoc comments with schema metadata

### Should Pass (Important)

6. **PC-6: Input Validation**
   - ✅ Validates table names (lowercase, snake_case)
   - ✅ Validates column names (same rules)
   - ✅ Detects reserved SQL keywords
   - ✅ Throws descriptive errors with table/column context

7. **PC-7: PostgreSQL Support**
   - ✅ Generates valid PostgreSQL CREATE TABLE statements
   - ✅ Maps PostgreSQL types (UUID, JSONB, TIMESTAMP)
   - ✅ Uses SERIAL for auto-increment
   - ✅ Generates ALTER TABLE ADD CONSTRAINT for foreign keys

8. **PC-8: MySQL Support**
   - ✅ Generates valid MySQL CREATE TABLE statements
   - ✅ Maps MySQL types (CHAR(36), JSON, DATETIME)
   - ✅ Uses AUTO_INCREMENT for primary keys
   - ✅ Includes ENGINE=InnoDB specification

9. **PC-9: Migration File Format**
   - ✅ Filename format: `{timestamp}_{description}.sql`
   - ✅ Timestamp format: `YYYYMMDDHHMMSS`
   - ✅ Includes header comment with metadata
   - ✅ Properly formatted SQL (indentation, line breaks)

10. **PC-10: Validation Error Messages**
    - ✅ Clear, actionable error messages
    - ✅ Include context (table, column, constraint)
    - ✅ Provide suggestions for fixing errors
    - ✅ Distinguish errors from warnings

### Nice to Have (Future)

11. **PC-11: Advanced ALTER TABLE**
    - Detect column type changes
    - Generate data migration scripts
    - Warn about data loss potential

12. **PC-12: Constraint Validation**
    - Validate CHECK constraint SQL expressions
    - Verify foreign key target tables exist in spec
    - Warn about circular foreign key dependencies

13. **PC-13: Performance Optimization**
    - Generate compound indexes for foreign keys
    - Suggest index optimizations
    - Detect missing indexes on frequently queried columns

---

## Dependencies

### Required (Must exist before implementation)
- ✅ Spawner system (`parent-harness/orchestrator/src/spawner/`) - EXISTS
- ✅ Backend generator (`generators/backend.ts`) - EXISTS as reference pattern
- ✅ Database module (`database/db.ts`) - EXISTS
- ✅ Migration directory (`database/migrations/`) - EXISTS

### Optional (Can be integrated later)
- Prisma CLI (for Prisma schema generation)
- SQL formatting library (for prettier SQL output)
- SQL parser (for validating generated SQL)

### Blocked By
- None (can be implemented independently)

---

## Testing Strategy

### Unit Tests

**Test File**: `tests/unit/generators/database-migration-generator.test.ts`

**Test Cases**:
1. **Specification Validation**
   - Valid specifications pass validation
   - Invalid table names throw errors
   - Reserved keywords detected
   - Duplicate column names detected

2. **Schema Introspection**
   - Existing tables detected correctly
   - Column definitions read via PRAGMA
   - CREATE vs ALTER determined correctly
   - Missing database handled gracefully

3. **SQLite SQL Generation**
   - CREATE TABLE with columns, constraints
   - ALTER TABLE ADD COLUMN
   - CREATE INDEX statements
   - Foreign key REFERENCES clauses
   - Matches existing migration pattern

4. **PostgreSQL SQL Generation**
   - Type mapping (UUID, JSONB, TIMESTAMP)
   - SERIAL primary keys
   - ALTER TABLE ADD CONSTRAINT for foreign keys
   - Valid PostgreSQL syntax

5. **MySQL SQL Generation**
   - Type mapping (CHAR(36), JSON, DATETIME)
   - AUTO_INCREMENT primary keys
   - ENGINE=InnoDB specification
   - Valid MySQL syntax

6. **Reverse Migration Generation**
   - DROP TABLE for CREATE TABLE
   - DROP INDEX for CREATE INDEX
   - Reverse ALTER TABLE operations

7. **TypeScript Type Generation**
   - SQL → TypeScript type mapping
   - Nullable columns (`type | null`)
   - JSDoc comments
   - Insert/update type variants

8. **Migration File Formatting**
   - Timestamp filename generation
   - Header comments
   - SQL formatting (indentation, line breaks)

### Integration Tests

**Test File**: `tests/integration/spawner-database-generator.test.ts`

**Test Cases**:
1. Full spawner integration with database generator
2. Generate migration, write to `database/migrations/`
3. Load migration file and verify SQL
4. Validate TypeScript types compile

### Manual Testing

1. Generate migration for sample schema (users, orders, products)
2. Run migration against SQLite database
3. Verify tables created correctly
4. Run down migration and verify tables dropped
5. Visual inspection of generated TypeScript types

---

## Examples

### Example 1: Simple Table Creation

```typescript
const spec: MigrationSpec = {
  description: 'create_users_table',
  databaseType: 'sqlite',
  generateTypes: true,
  tables: [
    {
      name: 'users',
      description: 'Application users',
      columns: [
        { name: 'id', type: 'TEXT', nullable: false, description: 'User ID' },
        { name: 'email', type: 'TEXT', nullable: false, unique: true, description: 'Email address' },
        { name: 'name', type: 'TEXT', nullable: false, description: 'Full name' },
        { name: 'age', type: 'INTEGER', nullable: true, description: 'User age' },
      ],
      primaryKey: ['id'],
      indexes: [
        { name: 'idx_users_email', columns: ['email'], unique: true }
      ],
      checkConstraints: [
        { name: 'chk_age_positive', expression: 'age >= 0 AND age <= 150' }
      ]
    }
  ]
};

const result = generateMigration(spec);

// result.upMigration:
// -- Migration: 20260209120000
// -- Description: create_users_table
// -- Database: sqlite
// -- Tables: users
//
// CREATE TABLE IF NOT EXISTS users (
//   id TEXT PRIMARY KEY,
//   email TEXT UNIQUE NOT NULL,
//   name TEXT NOT NULL,
//   age INTEGER CHECK(age >= 0 AND age <= 150),
//   created_at TEXT NOT NULL DEFAULT (datetime('now')),
//   updated_at TEXT NOT NULL DEFAULT (datetime('now'))
// );
//
// CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

// result.typeDefinitions:
// export interface User {
//   id: string;
//   email: string;
//   name: string;
//   age: number | null;
//   created_at: string;
//   updated_at: string;
// }
```

### Example 2: Foreign Key Relationships

```typescript
const spec: MigrationSpec = {
  description: 'create_orders_table',
  databaseType: 'sqlite',
  generateTypes: true,
  tables: [
    {
      name: 'orders',
      description: 'Customer orders',
      columns: [
        { name: 'id', type: 'TEXT', nullable: false },
        { name: 'user_id', type: 'TEXT', nullable: false },
        { name: 'total', type: 'REAL', nullable: false },
        { name: 'status', type: 'TEXT', nullable: false },
      ],
      primaryKey: ['id'],
      foreignKeys: [
        {
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
          onDelete: 'CASCADE'
        }
      ],
      indexes: [
        { name: 'idx_orders_user', columns: ['user_id'], unique: false },
        { name: 'idx_orders_status', columns: ['status'], unique: false }
      ],
      checkConstraints: [
        { name: 'chk_total_positive', expression: 'total >= 0' },
        { name: 'chk_status_valid', expression: "status IN ('pending', 'completed', 'cancelled')" }
      ]
    }
  ]
};

// Generated SQL includes foreign key constraint
```

### Example 3: ALTER TABLE (Existing Schema)

```typescript
const spec: MigrationSpec = {
  description: 'add_phone_to_users',
  databaseType: 'sqlite',
  existingDbPath: 'database/myapp.db',  // Schema introspection enabled
  tables: [
    {
      name: 'users',
      columns: [
        // ... existing columns ...
        { name: 'phone', type: 'TEXT', nullable: true, description: 'Phone number' },
        { name: 'verified', type: 'INTEGER', nullable: false, default: 0, description: 'Email verified flag' }
      ]
    }
  ]
};

// Generated SQL:
// ALTER TABLE users ADD COLUMN phone TEXT;
// ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0;
// CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
```

---

## Success Metrics

### Implementation Success
- ✅ All 10 "Must Pass" and "Should Pass" criteria verified
- ✅ TypeScript compilation clean with no errors
- ✅ Database generator callable from spawner
- ✅ Valid SQLite migrations generated
- ✅ TypeScript types generated correctly
- ✅ Reversible migrations (up/down paired)

### Usage Success (Post-Implementation)
- Spawner system generates migrations automatically
- Generated migrations run without SQL errors
- TypeScript types compile without errors
- Developers use generator for schema evolution
- Migration files follow codebase conventions

---

## References

### Related Tasks
- VIBE-P13-003: Backend Endpoint Generator (similar generator pattern)
- VIBE-P10-006: Database Schema Generator (Architect Agent version)
- VIBE-P13-005: Feature Orchestration System (multi-layer coordination)

### Similar Patterns in Codebase
- Migration files (`database/migrations/`) - SQL patterns
- Backend generator (`generators/backend.ts`) - Generator structure
- Database module (`database/db.ts`) - Schema introspection

### External References
- SQLite Documentation: https://www.sqlite.org/lang_createtable.html
- PostgreSQL Documentation: https://www.postgresql.org/docs/current/sql-createtable.html
- MySQL Documentation: https://dev.mysql.com/doc/refman/8.0/en/create-table.html
- sql.js Library: https://github.com/sql-js/sql.js

---

## Future Enhancements

### Phase 2 Additions
- **Schema Diffing** - Compare existing schema with target, generate minimal ALTER statements
- **Data Migration Scripts** - Generate data transformation SQL for type changes
- **Prisma Schema Generation** - Output Prisma schema files alongside SQL
- **Drizzle ORM Support** - Generate Drizzle schema definitions

### Advanced Features
- **Rollback Safety** - Detect destructive changes and require confirmation
- **Multi-Step Migrations** - Break complex migrations into smaller steps
- **Seed Data Generation** - Auto-generate seed data templates
- **Migration Testing** - Validate migrations against test database before commit
- **Performance Analysis** - Suggest optimal indexes based on query patterns
- **Schema Visualization** - Generate ERD diagrams from migrations

---

**END OF SPECIFICATION**
