# VIBE-P14-008: Test Coverage Reporting and Enforcement

**Task ID:** VIBE-P14-008
**Created:** 2026-02-09
**Status:** 📝 SPECIFICATION COMPLETE
**Category:** Testing Infrastructure - Quality Gates
**Priority:** High (P1 - Phase 14)
**Estimated Effort:** 4-6 hours
**Model:** Sonnet (configuration and CI setup)
**Dependencies:** Existing vitest configuration, @vitest/coverage-v8 package

---

## Overview

Establish comprehensive test coverage reporting with enforcement thresholds, trend tracking, and CI integration to ensure code quality gates are met. This system provides visibility into test coverage through HTML/LCOV reports, enforces minimum thresholds to prevent coverage regression, integrates with PR workflows for coverage diffs, and tracks coverage trends over time.

### Context

The Vibe platform currently has:
1. **Existing Coverage Infrastructure** - @vitest/coverage-v8 installed in root and orchestrator
2. **Basic Configuration** - V8 provider configured with text/json/html reporters
3. **Test Scripts** - `npm run test:coverage` available
4. **Partial Success** - Orchestrator generates complete HTML reports (parent-harness/orchestrator/coverage/)
5. **Root Project Issues** - Only intermediate JSON files generated, no final reports

**Current Gaps:**
- ❌ No coverage thresholds enforced (lines: 80%, branches: 75%, functions: 80%)
- ❌ LCOV format not configured (needed for external integrations)
- ❌ No PR comment with coverage diff
- ❌ No coverage badge in README
- ⚠️ Root project HTML reports broken (only .tmp/*.json files)
- ❌ No coverage trend tracking over time

### Value Proposition

1. **Quality Gates** - Enforce minimum coverage thresholds to prevent regression
2. **Developer Visibility** - HTML reports show uncovered lines for targeted improvement
3. **PR Review Context** - Coverage diffs surface quality impact during code review
4. **External Integration** - LCOV format enables Codecov/Coveralls integration
5. **Trend Analysis** - Track coverage improvements/regressions over time
6. **Project Health Indicator** - Coverage badge provides at-a-glance quality signal

---

## Requirements

### Functional Requirements

#### FR1: Coverage Thresholds Configuration

**Requirement:** Configure minimum coverage thresholds that fail tests if not met.

**Thresholds:**
- Lines: 80%
- Branches: 75%
- Functions: 80%
- Statements: 80%

**Implementation:**
```typescript
// vitest.config.ts and parent-harness/orchestrator/vitest.config.ts
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html", "lcov"],
  exclude: ["tests/**", "spikes/**", "node_modules/**", "dist/**"],
  thresholds: {
    lines: 80,
    branches: 75,
    functions: 80,
    statements: 80
  },
  reportsDirectory: './coverage',
  all: true,  // Include all files, not just those with tests
  clean: true // Clean coverage directory before each run
}
```

**Behavior:**
- Tests fail if any threshold not met
- Terminal output shows which thresholds failed
- Exit code 1 on threshold failure (fails CI)

**Acceptance Criteria:**
- ✅ Thresholds configured in both root and orchestrator vitest configs
- ✅ `npm run test:coverage` fails when coverage below thresholds
- ✅ Clear error message indicates which threshold(s) failed
- ✅ Per-file and aggregate thresholds both enforced

---

#### FR2: LCOV Report Format

**Requirement:** Generate coverage reports in LCOV format for external tool integration.

**File:** `coverage/lcov.info`

**Format Example:**
```
TN:
SF:/home/user/project/src/index.ts
FN:5,myFunction
FNF:1
FNH:1
FNDA:3,myFunction
DA:1,1
DA:5,3
DA:10,0
LF:3
LH:2
BRF:2
BRH:1
end_of_record
```

**Implementation:**
- Add `"lcov"` to reporter array in vitest.config.ts
- Verify lcov.info generated after `npm run test:coverage`
- LCOV file should be gitignored (already in .gitignore via coverage/)

**Acceptance Criteria:**
- ✅ `coverage/lcov.info` generated for both root and orchestrator
- ✅ LCOV file contains all tested source files
- ✅ LCOV format parseable by standard tools (lcov-reporter-action, Codecov)
- ✅ File size reasonable (<10MB for typical project)

---

#### FR3: HTML Coverage Reports

**Requirement:** Generate browsable HTML reports with uncovered line highlighting.

**Current State:**
- ✅ Orchestrator: Working HTML reports at `parent-harness/orchestrator/coverage/index.html`
- ❌ Root project: Only .tmp/*.json files, no index.html

**Output Files:**
```
coverage/
├── index.html              # Entry point with overall stats
├── coverage-final.json     # Aggregated coverage data
├── lcov.info              # LCOV format
├── base.css               # Report styling
├── prettify.js            # Code syntax highlighting
└── [source-file-paths]    # Per-file HTML reports
```

**Features:**
- Overall coverage percentages (lines, branches, functions, statements)
- File-by-file breakdown with drill-down navigation
- Uncovered lines highlighted in red
- Partially covered branches highlighted in yellow
- Search/filter by file name
- Sort by coverage percentage

**Implementation Fix:**
The root project coverage is partially working. Likely issues:
1. Reporter configuration incomplete
2. Need explicit `reportsDirectory` setting
3. May need `all: true` to include untested files

**Acceptance Criteria:**
- ✅ `npm run test:coverage` generates `coverage/index.html` for root project
- ✅ HTML report opens in browser and displays correctly
- ✅ Uncovered lines clearly highlighted in red
- ✅ Partially covered branches shown in yellow
- ✅ File navigation works (click file → see source with coverage)
- ✅ Coverage percentages match terminal output

---

#### FR4: GitHub Actions Coverage Workflow

**Requirement:** Create CI workflow that runs coverage and comments on PRs with coverage diff.

**File:** `.github/workflows/coverage.yml`

**Workflow Triggers:**
- `pull_request` targeting `main` or `dev` branches
- `push` to `main` or `dev` (for baseline tracking)

**Jobs:**

##### Job 1: Generate Coverage Report
```yaml
name: Coverage Report

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]

jobs:
  coverage:
    name: Test Coverage
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout PR head
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run coverage (root)
        run: npm run test:coverage
        continue-on-error: true  # Don't fail if coverage below threshold

      - name: Run coverage (orchestrator)
        working-directory: parent-harness/orchestrator
        run: npm run test:coverage || npm test -- --coverage
        continue-on-error: true

      - name: Upload coverage artifacts
        uses: actions/upload-artifact@v4
        with:
          name: coverage-reports
          path: |
            coverage/
            parent-harness/orchestrator/coverage/
          retention-days: 30

      # Generate coverage for base branch (PR only)
      - name: Checkout base branch
        if: github.event_name == 'pull_request'
        uses: actions/checkout@v4
        with:
          ref: ${{ github.base_ref }}
          path: base-branch

      - name: Install dependencies (base)
        if: github.event_name == 'pull_request'
        working-directory: base-branch
        run: npm ci

      - name: Run coverage on base
        if: github.event_name == 'pull_request'
        working-directory: base-branch
        run: npm run test:coverage
        continue-on-error: true

      - name: Upload base coverage
        if: github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: base-coverage
          path: base-branch/coverage/lcov.info
          retention-days: 7
```

##### Job 2: PR Comment with Coverage Diff
```yaml
  coverage-comment:
    name: PR Coverage Comment
    needs: coverage
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read

    steps:
      - name: Download coverage artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: '*coverage*'
          path: coverage-data
          merge-multiple: true

      - name: Coverage diff comment
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: coverage-data/coverage/lcov.info
          lcov-base: coverage-data/base-branch/coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}
          delete-old-comments: true
```

**PR Comment Format:**
```markdown
## 📊 Coverage Report

| Metric | Base | Head | Δ |
|--------|------|------|---|
| Lines | 78.5% | 82.3% | +3.8% 📈 |
| Branches | 71.2% | 74.1% | +2.9% 📈 |
| Functions | 79.1% | 81.6% | +2.5% 📈 |
| Statements | 78.5% | 82.3% | +3.8% 📈 |

### Coverage by File
| File | Coverage | Lines | Δ |
|------|----------|-------|---|
| src/orchestrator/index.ts | 85.2% | 234/275 | +2.1% 📈 |
| src/agents/build.ts | 72.1% | 156/216 | -1.5% 📉 |
...

🎯 Overall coverage: **82.3%** (+3.8%)
✅ All thresholds met
```

**Acceptance Criteria:**
- ✅ Workflow file exists and is valid YAML
- ✅ Workflow runs on PR creation and updates
- ✅ Coverage generated for both PR head and base branch
- ✅ PR comment posted with coverage diff table
- ✅ Emoji indicators (📈 increase, 📉 decrease, ➖ unchanged)
- ✅ Old coverage comments deleted (only one comment per PR)
- ✅ Comment includes per-file breakdown for changed files
- ✅ Workflow completes in <10 minutes

---

#### FR5: Coverage Badge

**Requirement:** Add coverage badge to project README showing current coverage percentage.

**Implementation Options:**

**Option A: Manual Badge (shields.io)**
```markdown
[![Coverage](https://img.shields.io/badge/coverage-82.3%25-brightgreen.svg)](./coverage/index.html)
```
- Manual update required
- No external service dependency
- Simple, fast

**Option B: Dynamic Badge (Codecov)**
```markdown
[![codecov](https://codecov.io/gh/your-org/vibe/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/vibe)
```
- Auto-updates on each push
- Requires Codecov integration
- More accurate, no manual updates

**Option C: GitHub Actions Badge Script**
Create workflow step that updates badge JSON:
```yaml
- name: Update coverage badge
  run: |
    COVERAGE=$(jq '.total.lines.pct' coverage/coverage-final.json)
    COLOR=$(awk -v cov="$COVERAGE" 'BEGIN {
      if (cov >= 90) print "brightgreen"
      else if (cov >= 80) print "green"
      else if (cov >= 70) print "yellow"
      else print "red"
    }')
    echo "{\"schemaVersion\":1,\"label\":\"coverage\",\"message\":\"${COVERAGE}%\",\"color\":\"${COLOR}\"}" > coverage-badge.json

- name: Upload badge data
  uses: actions/upload-artifact@v4
  with:
    name: coverage-badge
    path: coverage-badge.json
```

**Recommended:** Start with Option A (manual), upgrade to Option B (Codecov) during PHASE16 analytics integration.

**README Structure:**
```markdown
# Vibe Platform

[![Coverage](https://img.shields.io/badge/coverage-82.3%25-brightgreen.svg)](./coverage/index.html)
[![Tests](https://github.com/your-org/vibe/workflows/Tests/badge.svg)](https://github.com/your-org/vibe/actions)

AI-powered autonomous agent orchestration platform...
```

**Acceptance Criteria:**
- ✅ README.md exists in project root
- ✅ Coverage badge displayed at top of README
- ✅ Badge color reflects coverage level (red <70%, yellow 70-79%, green 80-89%, brightgreen 90%+)
- ✅ Badge links to coverage report (local or hosted)
- ✅ Badge shows approximate coverage percentage

---

#### FR6: Coverage Trend Tracking

**Requirement:** Store and visualize coverage trends over time to track improvements/regressions.

**Storage Options:**

**Option A: Git-based (Simple)**
Store coverage metrics in git history:
```bash
coverage-history/
├── 2026-02-09-abc1234.json
├── 2026-02-10-def5678.json
└── 2026-02-11-ghi9012.json
```

Each file contains:
```json
{
  "date": "2026-02-09T03:25:00Z",
  "commit": "abc1234",
  "branch": "main",
  "coverage": {
    "lines": { "total": 1200, "covered": 987, "pct": 82.25 },
    "branches": { "total": 450, "covered": 334, "pct": 74.22 },
    "functions": { "total": 156, "covered": 127, "pct": 81.41 },
    "statements": { "total": 1300, "covered": 1070, "pct": 82.31 }
  }
}
```

**Option B: Database (Comprehensive)**
Add table to parent-harness/orchestrator database:
```sql
CREATE TABLE coverage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  lines_pct REAL NOT NULL,
  branches_pct REAL NOT NULL,
  functions_pct REAL NOT NULL,
  statements_pct REAL NOT NULL,
  lines_covered INTEGER NOT NULL,
  lines_total INTEGER NOT NULL,
  branches_covered INTEGER NOT NULL,
  branches_total INTEGER NOT NULL,
  functions_covered INTEGER NOT NULL,
  functions_total INTEGER NOT NULL,
  statements_covered INTEGER NOT NULL,
  statements_total INTEGER NOT NULL,
  project TEXT NOT NULL DEFAULT 'root',  -- 'root' or 'orchestrator'
  UNIQUE(commit_sha, project)
);

CREATE INDEX idx_coverage_timestamp ON coverage_history(timestamp);
CREATE INDEX idx_coverage_branch ON coverage_history(branch);
```

**Option C: External Service (Codecov)**
Codecov automatically tracks trends with:
- Historical graphs
- Commit-by-commit coverage changes
- Branch comparisons
- Sunburst visualizations

**Recommended:** Option B (database) for PHASE 14, integrate with dashboard visualization.

**Data Collection Script:**
```typescript
// scripts/record-coverage.ts
import { readFileSync } from 'fs';
import Database from 'better-sqlite3';

interface CoverageData {
  total: {
    lines: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
  };
}

export async function recordCoverage(
  project: 'root' | 'orchestrator',
  coverageFile: string,
  commitSha: string,
  branch: string
) {
  const data: CoverageData = JSON.parse(readFileSync(coverageFile, 'utf-8'));
  const db = new Database('parent-harness/data/harness.db');

  db.prepare(`
    INSERT OR REPLACE INTO coverage_history (
      timestamp, commit_sha, branch, project,
      lines_pct, branches_pct, functions_pct, statements_pct,
      lines_covered, lines_total,
      branches_covered, branches_total,
      functions_covered, functions_total,
      statements_covered, statements_total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    new Date().toISOString(),
    commitSha,
    branch,
    project,
    data.total.lines.pct,
    data.total.branches.pct,
    data.total.functions.pct,
    data.total.statements.pct,
    data.total.lines.covered,
    data.total.lines.total,
    data.total.branches.covered,
    data.total.branches.total,
    data.total.functions.covered,
    data.total.functions.total,
    data.total.statements.covered,
    data.total.statements.total
  );

  db.close();
}
```

**GitHub Actions Integration:**
```yaml
- name: Record coverage history
  if: github.ref == 'refs/heads/main'
  run: |
    npx tsx scripts/record-coverage.ts root coverage/coverage-final.json ${{ github.sha }} main
    npx tsx scripts/record-coverage.ts orchestrator parent-harness/orchestrator/coverage/coverage-final.json ${{ github.sha }} main
```

**Dashboard Visualization (Future - PHASE16):**
- Line chart showing coverage % over time (last 30 days)
- Separate lines for lines/branches/functions
- Annotations for major commits/releases
- Dropdown to filter by project (root vs orchestrator)

**Acceptance Criteria:**
- ✅ Database migration creates coverage_history table
- ✅ Script `scripts/record-coverage.ts` exists and works
- ✅ Coverage recorded after main branch tests
- ✅ Historical data queryable via SQL
- ✅ Data includes both root and orchestrator projects
- ✅ Trend data persists across runs

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Execution                          │
│  npm test / npm run test:coverage                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Vitest + V8 Coverage                       │
│  - Runs tests with coverage instrumentation                │
│  - Collects line/branch/function coverage data             │
│  - Applies thresholds (fails if < 80% lines, etc.)         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Coverage Report Generation                     │
│  ├─ Text (terminal output)                                 │
│  ├─ JSON (coverage/coverage-final.json)                    │
│  ├─ HTML (coverage/index.html + per-file pages)            │
│  └─ LCOV (coverage/lcov.info)                              │
└─────┬───────────────────────────────────┬───────────────────┘
      │                                   │
      ▼                                   ▼
┌─────────────────────┐     ┌─────────────────────────────────┐
│  Local Development  │     │      GitHub Actions CI          │
│  - View HTML report │     │  - Run on PR/push              │
│  - Check thresholds │     │  - Generate base vs head diff  │
│  - Fix uncovered    │     │  - Post PR comment             │
│    lines            │     │  - Upload artifacts            │
└─────────────────────┘     └───────────┬─────────────────────┘
                                        │
                                        ▼
                            ┌─────────────────────────────────┐
                            │   Coverage History Storage      │
                            │  - Database table (harness.db) │
                            │  - Record after main merges    │
                            │  - Query for trend analysis    │
                            └─────────────────────────────────┘
```

### Data Flow

1. **Test Execution** → Vitest runs tests with V8 coverage instrumentation
2. **Coverage Collection** → V8 tracks line/branch/function execution
3. **Threshold Enforcement** → Vitest checks thresholds, fails if not met
4. **Report Generation** → V8 generates text/json/html/lcov outputs
5. **CI Upload** → GitHub Actions uploads coverage artifacts
6. **PR Comment** → lcov-reporter-action posts diff on PR
7. **History Recording** → script saves metrics to database (main branch only)

### File Structure

```
project-root/
├── .github/
│   └── workflows/
│       ├── coverage.yml                  # NEW: Coverage CI workflow
│       └── e2e-tests.yml                # EXISTING
├── coverage/                             # GITIGNORED
│   ├── index.html                       # FIXED: Now generated
│   ├── coverage-final.json              # Aggregated data
│   ├── lcov.info                        # NEW: LCOV format
│   └── [source-files].html             # Per-file reports
├── scripts/
│   └── record-coverage.ts               # NEW: Save coverage to DB
├── parent-harness/
│   ├── data/
│   │   └── harness.db                   # UPDATED: Add coverage_history table
│   └── orchestrator/
│       ├── coverage/                    # EXISTING: Already works
│       │   ├── index.html
│       │   ├── coverage-final.json
│       │   └── lcov.info                # NEW
│       └── vitest.config.ts             # UPDATED: Add thresholds + lcov
├── vitest.config.ts                     # UPDATED: Fix config, add thresholds
├── README.md                            # NEW: Add with coverage badge
└── package.json                         # EXISTING: test:coverage script
```

### Configuration Changes

#### Root vitest.config.ts
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [
      "tests/integration/**",
      "tests/e2e/**",
      "node_modules/**",
      "dist/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],  // ADD: lcov
      exclude: ["tests/**", "spikes/**", "node_modules/**", "dist/**"],
      reportsDirectory: './coverage',               // ADD: explicit path
      all: true,                                    // ADD: include all files
      clean: true,                                  // ADD: clean before run
      thresholds: {                                 // ADD: enforcement
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80
      }
    },
    globalSetup: ["tests/globalSetup.ts"],
    setupFiles: ["tests/setup.ts"],
    poolOptions: {
      threads: {
        singleThread: true,
      },
      forks: {
        singleFork: true,
      },
    },
  },
  server: {
    watch: {
      ignored: ["**/.venv/**", "**/node_modules/**", "**/.git/**"],
    },
  },
});
```

#### Orchestrator vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],  // ADD: lcov
      include: ['src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/node_modules/**', '**/dist/**'],
      reportsDirectory: './coverage',               // ADD: explicit
      all: true,                                    // ADD: all files
      clean: true,                                  // ADD: clean
      thresholds: {                                 // ADD: thresholds
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80
      }
    },
  },
});
```

### Database Schema

```sql
-- parent-harness/orchestrator/database/migrations/XXX_coverage_history.sql
CREATE TABLE IF NOT EXISTS coverage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT 'root',
  lines_pct REAL NOT NULL,
  branches_pct REAL NOT NULL,
  functions_pct REAL NOT NULL,
  statements_pct REAL NOT NULL,
  lines_covered INTEGER NOT NULL,
  lines_total INTEGER NOT NULL,
  branches_covered INTEGER NOT NULL,
  branches_total INTEGER NOT NULL,
  functions_covered INTEGER NOT NULL,
  functions_total INTEGER NOT NULL,
  statements_covered INTEGER NOT NULL,
  statements_total INTEGER NOT NULL,
  UNIQUE(commit_sha, project)
);

CREATE INDEX IF NOT EXISTS idx_coverage_timestamp ON coverage_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_coverage_branch ON coverage_history(branch);
CREATE INDEX IF NOT EXISTS idx_coverage_project ON coverage_history(project);
```

---

## Pass Criteria

### 1. ✅ Coverage tool (c8/Istanbul) configured for all test types
**Verification:**
```bash
# Check package installed
npm list @vitest/coverage-v8

# Run coverage
npm run test:coverage

# Verify output formats
ls coverage/coverage-final.json
ls coverage/index.html
ls coverage/lcov.info
```

**Success:** All three formats generated without errors.

---

### 2. ✅ Minimum coverage thresholds set (lines: 80%, branches: 75%, functions: 80%)
**Verification:**
```bash
# Temporarily lower coverage to test thresholds
# Remove a test, run coverage
npm run test:coverage

# Should fail with:
# ERROR: Coverage for lines (78%) does not meet threshold (80%)
```

**Success:** Tests fail when coverage below thresholds, exit code 1.

---

### 3. ✅ Coverage report in HTML and LCOV format
**Verification:**
```bash
npm run test:coverage

# HTML report
test -f coverage/index.html && echo "HTML: ✅" || echo "HTML: ❌"
open coverage/index.html  # Opens in browser, shows files

# LCOV report
test -f coverage/lcov.info && echo "LCOV: ✅" || echo "LCOV: ❌"
head -20 coverage/lcov.info  # Shows LCOV format

# Orchestrator
test -f parent-harness/orchestrator/coverage/index.html && echo "Orch HTML: ✅"
test -f parent-harness/orchestrator/coverage/lcov.info && echo "Orch LCOV: ✅"
```

**Success:** All 4 files exist and contain valid data.

---

### 4. ✅ PR comment with coverage diff
**Verification:**
```bash
# Create test PR
git checkout -b test-coverage-pr
# Make trivial change
echo "// test" >> src/index.ts
git add . && git commit -m "test: coverage PR"
git push origin test-coverage-pr

# Open PR on GitHub
gh pr create --title "Test Coverage PR" --body "Testing coverage diff comment"

# Wait for workflow to complete (~3-5 minutes)
# Check PR for coverage comment

# Should see:
# - Table with Base / Head / Δ columns
# - Lines, Branches, Functions, Statements rows
# - Per-file breakdown
# - Emoji indicators (📈📉➖)
```

**Success:** PR comment appears with coverage diff within 5 minutes.

---

### 5. ✅ Coverage badge in README
**Verification:**
```bash
# Check README exists
test -f README.md && echo "README: ✅" || echo "README: ❌"

# Check badge syntax
grep -E "!\[Coverage\].*badge.*coverage" README.md

# Badge should be near top of file (within first 10 lines)
head -10 README.md | grep -i coverage
```

**Success:** README.md exists with coverage badge in header section.

---

### 6. ✅ Uncovered lines highlighted in reports
**Verification:**
```bash
npm run test:coverage
open coverage/index.html

# Manually verify in browser:
# 1. Click a file with <100% coverage
# 2. See source code with line numbers
# 3. Uncovered lines have red/pink background
# 4. Partially covered branches have yellow indicator
# 5. Line coverage counts visible (e.g., "3x" next to line)
```

**Success:** HTML report visually highlights uncovered lines in red.

---

### 7. ✅ Coverage trend tracking over time
**Verification:**
```bash
# Run initial coverage
npm run test:coverage

# Record to database
npx tsx scripts/record-coverage.ts root coverage/coverage-final.json abc1234 main

# Query database
sqlite3 parent-harness/data/harness.db "SELECT * FROM coverage_history ORDER BY timestamp DESC LIMIT 5"

# Should show:
# timestamp | commit_sha | branch | lines_pct | ...
# 2026-02-09... | abc1234 | main | 82.3 | ...

# Make changes, run again, verify multiple records
# Wait 1 day, run again, verify trend over time
```

**Success:** Database contains coverage history, queryable by timestamp/commit/branch.

---

## Dependencies

### Required Packages
- ✅ `@vitest/coverage-v8` - Already installed (root & orchestrator)
- ✅ `vitest` - Already installed
- ❌ `tsx` - Already installed (for scripts)

### GitHub Actions
- `actions/checkout@v4` - Already used
- `actions/setup-node@v4` - Already used
- `actions/upload-artifact@v4` - Already used
- `actions/download-artifact@v4` - Already used
- `romeovs/lcov-reporter-action@v0.3.1` - NEW (for PR comments)

### Existing Infrastructure
- ✅ Vitest test framework
- ✅ Coverage provider (V8)
- ✅ GitHub Actions workflows directory
- ✅ SQLite database (harness.db)
- ✅ Test scripts in package.json

---

## Implementation Plan

### Phase 1: Configuration Fixes (1 hour)
1. ✅ Update root `vitest.config.ts` with thresholds, lcov reporter
2. ✅ Update orchestrator `vitest.config.ts` with same changes
3. ✅ Test coverage generation locally
4. ✅ Verify HTML report fixed (index.html generated)
5. ✅ Verify LCOV files generated

### Phase 2: CI Integration (1.5 hours)
1. ✅ Create `.github/workflows/coverage.yml`
2. ✅ Add job to run coverage on PR head
3. ✅ Add job to run coverage on base branch
4. ✅ Add job to post PR comment with diff
5. ✅ Test with draft PR

### Phase 3: Coverage History (1 hour)
1. ✅ Create database migration for coverage_history table
2. ✅ Create `scripts/record-coverage.ts`
3. ✅ Add history recording to CI workflow (main branch only)
4. ✅ Test recording after merge

### Phase 4: Documentation (30 minutes)
1. ✅ Create README.md
2. ✅ Add coverage badge
3. ✅ Add shields for tests, build status
4. ✅ Write basic project description

### Phase 5: Validation (30 minutes)
1. ✅ Run all 7 pass criteria tests
2. ✅ Create test PR to verify comment
3. ✅ Check HTML reports open correctly
4. ✅ Query coverage_history table
5. ✅ Document any issues

**Total Estimated Time:** 4-6 hours

---

## Testing Strategy

### Unit Tests
Coverage infrastructure itself doesn't need tests (it's configuration), but validate:
- ✅ `scripts/record-coverage.ts` has error handling
- ✅ Script validates input file exists
- ✅ Script handles malformed JSON gracefully

### Integration Tests
- ✅ Run `npm run test:coverage` in CI
- ✅ Verify exit code 1 when thresholds not met
- ✅ Verify exit code 0 when thresholds met

### E2E Tests
- ✅ Create PR, wait for coverage comment
- ✅ Verify comment format matches spec
- ✅ Merge PR, verify history recorded

---

## Rollout Plan

### Step 1: Enable Locally (Day 1)
- Update vitest configs with thresholds + lcov
- Test coverage generation
- Fix any issues with HTML reports

### Step 2: Add CI Workflow (Day 2)
- Create coverage.yml workflow
- Test on draft PR
- Iterate on comment format

### Step 3: Enable History Tracking (Day 3)
- Add database migration
- Create recording script
- Add to CI workflow

### Step 4: Documentation (Day 3)
- Create README with badge
- Update CLAUDE.md if needed

### Step 5: Announce (Day 4)
- Document in STRATEGIC_PLAN.md
- Update phase tracking

---

## Risks and Mitigations

### Risk 1: Thresholds Too Strict
**Impact:** Builds fail frequently, developers frustrated
**Probability:** Medium
**Mitigation:**
- Start with lower thresholds (lines: 70%, branches: 65%)
- Gradually increase over 4 weeks
- Provide clear documentation on improving coverage
- Add `SKIP_COVERAGE_CHECK=1` env var for emergency bypasses

### Risk 2: Large Coverage Reports
**Impact:** CI artifacts too large, slow downloads
**Probability:** Low
**Mitigation:**
- Set artifact retention to 7 days (not 30)
- Only upload LCOV for PR comments (not full HTML)
- Add .gitignore for coverage/ directory

### Risk 3: PR Comment Noise
**Impact:** Too many comments clutter PRs
**Probability:** Low
**Mitigation:**
- Use `delete-old-comments: true` in lcov-reporter-action
- Only comment if coverage changes significantly (±1%)
- Collapse comment after initial review

### Risk 4: History Database Growth
**Impact:** harness.db grows too large
**Probability:** Low
**Mitigation:**
- Only record on main branch merges (not every commit)
- Add cleanup script to delete records >90 days old
- Monitor database size (should be <100KB for 1 year)

---

## Future Enhancements

### PHASE 16: Analytics Dashboard Integration
- Visualize coverage trends in parent-harness dashboard
- Line chart showing coverage over last 30 days
- Per-agent coverage breakdown
- Coverage alerts when drops >5%

### PHASE 18: Codecov Integration
- Replace manual badge with Codecov badge
- Automatic PR comments from Codecov
- Sunburst visualization of coverage by directory
- Compare coverage across branches

### PHASE 20: Coverage-Driven Test Generation
- Use Build Agent to generate tests for uncovered code
- Target files with <80% coverage first
- Auto-create test stubs with TODOs
- Integrate with clarification agent for edge cases

---

## References

### Documentation
- [Vitest Coverage Documentation](https://vitest.dev/guide/coverage.html)
- [V8 Coverage Provider](https://vitest.dev/guide/coverage.html#coverage-providers)
- [LCOV Format Specification](http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php)
- [shields.io Badge Documentation](https://shields.io/)

### Related Tasks
- VIBE-P14-003: E2E Test Framework Setup (dependency)
- VIBE-P14-004: E2E Test Generator (related testing infrastructure)
- VIBE-P14-006: Security Scanning Integration (similar CI pattern)
- PHASE2-TASK-03: QA Agent v0.1 (validation pipeline)

### GitHub Actions
- [romeovs/lcov-reporter-action](https://github.com/romeovs/lcov-reporter-action)
- [actions/upload-artifact](https://github.com/actions/upload-artifact)

---

**Specification Complete:** 2026-02-09
**Ready for Implementation:** ✅
**Estimated Effort:** 4-6 hours
**Complexity:** Medium (configuration + CI + storage)
