# VIBE-P14-006: Security Scanning Integration - npm audit and SAST

**Task ID:** VIBE-P14-006
**Created:** 2026-02-09
**Status:** 📝 SPECIFICATION
**Category:** Testing Infrastructure - Security
**Priority:** High
**Effort:** Medium (6-8 hours)
**Dependencies:** PHASE2-TASK-03 (QA Agent), existing security-scanner.ts

---

## Overview

Integrate automated security scanning into the QA pipeline to detect vulnerabilities in dependencies (npm audit) and code-level security issues (SAST with Semgrep). This provides continuous security validation as part of the autonomous development workflow, ensuring that Build Agent implementations don't introduce security vulnerabilities.

### Context

The Vibe platform has:

1. **Existing Security Infrastructure** - Basic npm audit implementation in `agents/validation/validators/security-scanner.ts`
2. **QA Agent Validation Pipeline** - Runs validators after Build Agent completes (PHASE2-TASK-03)
3. **CI/CD Pipeline** - GitHub Actions workflows for E2E tests (`.github/workflows/e2e-tests.yml`)

**Current Gaps:**

- npm audit only checks dependencies, not code-level security issues
- No SAST (Static Application Security Testing) for code analysis
- No custom security rules for project-specific vulnerabilities
- No configurable severity thresholds
- Security reports are basic (JSON only, no HTML)
- No vulnerability ignore list with justifications
- CI pipeline doesn't fail on critical security issues

### Value Proposition

1. **Prevent Security Vulnerabilities** - Catch SQL injection, XSS, command injection before merge
2. **Dependency Safety** - Detect vulnerable npm packages automatically
3. **Compliance Ready** - Generate security reports for audits
4. **Developer Awareness** - Surface security issues during development
5. **Quality Gate** - Block merges when critical vulnerabilities exist

---

## Requirements

### Functional Requirements

#### FR1: npm Audit Integration

**Requirement:** Run `npm audit` on every test execution and parse results for vulnerabilities.

**Implementation:**

- Enhance existing `agents/validation/validators/security-scanner.ts`
- Execute `npm audit --json` in both root and `parent-harness/orchestrator` directories
- Parse JSON output to extract vulnerability counts by severity
- Run during QA Agent validation pipeline
- Generate structured results for reporting

**Example:**

```typescript
interface NpmAuditResult {
  runId: string;
  validatorName: "npm-audit";
  vulnerabilities: {
    info: number;
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
  packages: {
    name: string;
    version: string;
    severity: "info" | "low" | "moderate" | "high" | "critical";
    cve: string[];
    via: string[];
    fixAvailable: boolean;
  }[];
  passed: boolean;
  durationMs: number;
}
```

#### FR2: SAST Tool Integration (Semgrep)

**Requirement:** Configure Semgrep for static code analysis with security rules.

**Rationale:** Semgrep over CodeQL because:

- Lightweight, fast execution (< 30s vs minutes)
- No GitHub account requirement for CLI usage
- Easy custom rule creation
- Better TypeScript/JavaScript support
- Can run locally and in CI

**Implementation:**

- Install Semgrep CLI as dev dependency (`npm install -D @semgrep/cli`)
- Create Semgrep configuration at `.semgrep.yml`
- Use security-focused rulesets:
  - `p/security-audit` - General security issues
  - `p/owasp-top-ten` - OWASP vulnerabilities
  - `p/typescript` - TypeScript-specific security
  - `p/express` - Express.js security patterns
- Create new validator: `agents/validation/validators/semgrep-validator.ts`

**Example:**

```typescript
interface SemgrepResult {
  runId: string;
  validatorName: "semgrep";
  findings: {
    ruleId: string;
    severity: "ERROR" | "WARNING" | "INFO";
    message: string;
    file: string;
    line: number;
    column: number;
    category: "security" | "correctness" | "performance";
    cwe: string[]; // Common Weakness Enumeration
  }[];
  passed: boolean;
  durationMs: number;
}
```

#### FR3: Custom Security Rules

**Requirement:** Define project-specific security rules for common vulnerabilities.

**Custom Rules to Implement:**

1. **SQL Injection Prevention** - Detect raw SQL string concatenation
2. **Command Injection** - Flag unsanitized shell command execution
3. **Path Traversal** - Catch unsafe file path handling
4. **Hardcoded Secrets** - Detect API keys, passwords in code
5. **Unsafe Eval** - Prevent eval(), Function() constructor usage
6. **XSS Prevention** - Catch unsafe innerHTML assignments

**Storage:** `.semgrep/rules/custom-security.yml`

**Example Rule:**

```yaml
rules:
  - id: sql-injection-risk
    patterns:
      - pattern: |
          db.query($SQL + $VAR)
      - pattern: |
          db.execute(`... ${$VAR} ...`)
    message: Potential SQL injection - use parameterized queries
    severity: ERROR
    languages: [typescript, javascript]
    metadata:
      category: security
      cwe: CWE-89
      owasp: A03:2021-Injection
```

#### FR4: Severity Threshold Configuration

**Requirement:** Configurable thresholds to fail builds on high/critical issues.

**Configuration File:** `security-config.json`

```json
{
  "npm-audit": {
    "fail-on": ["high", "critical"],
    "warn-on": ["moderate"],
    "ignore-dev-dependencies": false
  },
  "semgrep": {
    "fail-on": ["ERROR"],
    "warn-on": ["WARNING"],
    "ignore-info": true
  },
  "thresholds": {
    "max-critical": 0,
    "max-high": 0,
    "max-moderate": 5
  }
}
```

**Behavior:**

- **Fail Build:** Any critical or high severity issues
- **Warn Only:** Moderate severity (logged but doesn't block)
- **Informational:** Low/info severity (included in reports only)

#### FR5: Security Report Generation

**Requirement:** Generate security reports in both JSON and HTML formats.

**Output Structure:**

```
security-reports/
├── {runId}/
│   ├── npm-audit.json           # Raw npm audit output
│   ├── semgrep.json             # Raw Semgrep output
│   ├── security-report.json     # Unified findings
│   └── security-report.html     # Human-readable report
```

**Unified Report Schema:**

```typescript
interface SecurityReport {
  runId: string;
  timestamp: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
  };
  findings: {
    source: "npm-audit" | "semgrep";
    severity: string;
    title: string;
    description: string;
    location?: {
      file: string;
      line: number;
      column?: number;
    };
    remediation?: string;
    cve?: string[];
    cwe?: string[];
  }[];
  passed: boolean;
  failureReasons: string[];
}
```

**HTML Report:** Use simple template with:

- Executive summary (pass/fail, counts by severity)
- Critical findings highlighted in red
- Expandable sections for each finding
- Links to CVE/CWE databases
- Remediation suggestions

#### FR6: CI Pipeline Integration

**Requirement:** Integrate security scanning into GitHub Actions workflow.

**New Workflow:** `.github/workflows/security-scan.yml`

```yaml
name: Security Scan

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: "0 2 * * *"
  workflow_dispatch:

jobs:
  security-scan:
    name: Security Vulnerability Scan
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Install Semgrep
        run: npm install -g @semgrep/cli

      - name: Run npm audit
        run: npm audit --json > npm-audit.json || true

      - name: Run Semgrep
        run: |
          semgrep scan \
            --config .semgrep.yml \
            --json \
            --output semgrep-results.json \
            --severity ERROR \
            --severity WARNING

      - name: Generate security report
        run: npm run security:report

      - name: Upload security report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-report
          path: security-reports/
          retention-days: 90

      - name: Check thresholds
        run: npm run security:check

      - name: Comment on PR
        if: github.event_name == 'pull_request' && failure()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('security-reports/latest/security-report.json'));

            const body = `## 🔒 Security Scan Failed

            | Severity | Count |
            |----------|-------|
            | 🔴 Critical | ${report.summary.critical} |
            | 🟠 High | ${report.summary.high} |
            | 🟡 Moderate | ${report.summary.moderate} |

            **Failure Reasons:**
            ${report.failureReasons.map(r => `- ${r}`).join('\n')}

            View [full report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}) for details.
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

**Behavior:**

- Run on push/PR to main/dev branches
- Daily scheduled scan for new vulnerabilities
- Fail CI if critical/high severity issues exist
- Upload artifacts for audit trail
- Post PR comment with summary

#### FR7: Vulnerability Ignore List

**Requirement:** Maintain an ignore list for false positives with justifications.

**File:** `.security-ignore.yml`

```yaml
# Security findings that are intentionally ignored
# Each entry MUST have a justification and expiration date

npm-audit:
  - package: "example-package"
    cve: "CVE-2024-12345"
    severity: "moderate"
    justification: "Not exploitable in our usage - only affects server-side rendering which we don't use"
    ignored-by: "ned-atanasovski"
    ignored-date: "2026-02-09"
    expires: "2026-05-09" # Re-evaluate in 3 months

semgrep:
  - rule-id: "typescript.express.security.audit.express-check-csurf-middleware-usage"
    file: "server/routes/public-api.ts"
    line: 42
    justification: "Public read-only API doesn't require CSRF protection"
    ignored-by: "ned-atanasovski"
    ignored-date: "2026-02-09"
    expires: "2026-08-09" # Re-evaluate in 6 months
```

**Enforcement:**

- Security validator reads ignore list
- Filters out ignored findings from results
- Logs warnings for expired ignores
- Fails build if expired ignore is still present

---

## Technical Design

### 1. Enhanced Security Scanner Architecture

**File Structure:**

```
agents/validation/validators/
├── security-scanner.ts              # Existing (enhance npm audit)
├── semgrep-validator.ts             # NEW - Semgrep integration
├── security-reporter.ts             # NEW - Report generation
└── security-ignore-list.ts          # NEW - Ignore list handling

.semgrep/
├── rules/
│   ├── custom-security.yml          # Custom security rules
│   ├── sql-injection.yml            # SQL injection detection
│   ├── command-injection.yml        # Command injection detection
│   └── secret-detection.yml         # Hardcoded secrets
└── .semgrep.yml                     # Main Semgrep config

security-reports/                     # Git-ignored
├── latest/                          # Symlink to most recent
└── {runId}/
    ├── npm-audit.json
    ├── semgrep.json
    ├── security-report.json
    └── security-report.html

.security-ignore.yml                  # Checked into git
security-config.json                  # Checked into git
```

### 2. Integration Points

#### QA Agent Integration

**File:** `agents/validation/qa-agent.ts` (or equivalent orchestrator)

```typescript
import { runSecurityScanner } from "./validators/security-scanner";
import { runSemgrepValidator } from "./validators/semgrep-validator";
import { generateSecurityReport } from "./validators/security-reporter";

async function runSecurityValidation(runId: string): Promise<ValidationResult> {
  // Run both validators in parallel
  const [npmAuditResult, semgrepResult] = await Promise.all([
    runSecurityScanner(runId),
    runSemgrepValidator(runId),
  ]);

  // Generate unified report
  const report = await generateSecurityReport(runId, [
    npmAuditResult,
    semgrepResult,
  ]);

  // Check against thresholds
  const passed = checkSecurityThresholds(report);

  return {
    validationId: uuid(),
    runId,
    status: passed ? "passed" : "failed",
    validators: [npmAuditResult, semgregResult],
    report,
    timestamp: new Date().toISOString(),
  };
}
```

#### Test Execution Integration

**Update:** `package.json` scripts

```json
{
  "scripts": {
    "test": "npm run security:check && vitest run",
    "test:security": "tsx agents/validation/validators/security-runner.ts",
    "security:audit": "npm audit --json",
    "security:semgrep": "semgrep scan --config .semgrep.yml",
    "security:report": "tsx agents/validation/validators/security-reporter.ts",
    "security:check": "tsx agents/validation/validators/security-threshold-checker.ts"
  }
}
```

### 3. Semgrep Configuration

**File:** `.semgrep.yml`

```yaml
rules:
  # Use community security rules
  - p/security-audit
  - p/owasp-top-ten
  - p/typescript
  - p/express
  - p/sql-injection
  - p/command-injection

  # Include custom rules
  - .semgrep/rules/

paths:
  include:
    - "server/"
    - "agents/"
    - "parent-harness/orchestrator/src/"
    - "database/"
  exclude:
    - "node_modules/"
    - "dist/"
    - "coverage/"
    - "*.test.ts"
    - "tests/"

severity:
  - ERROR
  - WARNING

output:
  format: json
  destination: security-reports/latest/semgrep.json
```

### 4. HTML Report Template

**File:** `agents/validation/validators/templates/security-report.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Security Scan Report - {{runId}}</title>
    <style>
      body {
        font-family: -apple-system, sans-serif;
        margin: 40px;
      }
      .summary {
        background: #f5f5f5;
        padding: 20px;
        border-radius: 8px;
      }
      .critical {
        color: #d73a49;
        font-weight: bold;
      }
      .high {
        color: #f66a0a;
        font-weight: bold;
      }
      .moderate {
        color: #ffc107;
      }
      .finding {
        border-left: 4px solid #ccc;
        padding: 16px;
        margin: 16px 0;
      }
      .finding.critical {
        border-left-color: #d73a49;
        background: #fff5f5;
      }
      .finding.high {
        border-left-color: #f66a0a;
        background: #fff8f0;
      }
      .code {
        background: #f6f8fa;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
      }
    </style>
  </head>
  <body>
    <h1>🔒 Security Scan Report</h1>
    <p>Run ID: <code>{{runId}}</code> | Generated: {{timestamp}}</p>

    <div class="summary">
      <h2>Summary</h2>
      <p><strong>Status:</strong> {{status}}</p>
      <ul>
        <li class="critical">Critical: {{summary.critical}}</li>
        <li class="high">High: {{summary.high}}</li>
        <li class="moderate">Moderate: {{summary.moderate}}</li>
        <li>Low: {{summary.low}}</li>
        <li>Info: {{summary.info}}</li>
      </ul>
    </div>

    <h2>Findings</h2>
    {{#each findings}}
    <div class="finding {{severity}}">
      <h3>{{title}} <span class="{{severity}}">{{severity}}</span></h3>
      <p>{{description}}</p>
      {{#if location}}
      <p>
        <strong>Location:</strong>
        <code>{{location.file}}:{{location.line}}</code>
      </p>
      {{/if}} {{#if cve}}
      <p><strong>CVE:</strong> {{cve}}</p>
      {{/if}} {{#if remediation}}
      <p><strong>Remediation:</strong> {{remediation}}</p>
      {{/if}}
    </div>
    {{/each}}
  </body>
</html>
```

### 5. Implementation Modules

#### Module 1: Enhanced npm Audit Scanner

**File:** `agents/validation/validators/security-scanner.ts` (update existing)

```typescript
import { spawn } from "child_process";
import { ValidatorResult } from "../../../types/validation";
import { loadIgnoreList } from "./security-ignore-list";
import { loadConfig } from "./security-config";

export async function runSecurityScanner(
  runId: string,
  workingDir: string = process.cwd(),
  timeoutMs: number = 60000,
): Promise<ValidatorResult> {
  const config = loadConfig();
  const ignoreList = loadIgnoreList();

  // Run npm audit
  const auditOutput = await execNpmAudit(workingDir, timeoutMs);

  // Parse and filter results
  const findings = parseAuditOutput(auditOutput);
  const filteredFindings = applyIgnoreList(findings, ignoreList.npmAudit);

  // Check thresholds
  const passed = checkAuditThresholds(filteredFindings, config.npmAudit);

  return {
    id: uuid(),
    runId,
    validatorName: "npm-audit",
    status: "completed",
    passed,
    output: JSON.stringify(filteredFindings, null, 2),
    metadata: {
      total: filteredFindings.length,
      critical: countBySeverity(filteredFindings, "critical"),
      high: countBySeverity(filteredFindings, "high"),
      moderate: countBySeverity(filteredFindings, "moderate"),
    },
    durationMs: Date.now() - startTime,
    createdAt: new Date().toISOString(),
  };
}

async function execNpmAudit(cwd: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const proc = spawn("npm", ["audit", "--json"], { cwd, shell: true });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("npm audit timeout"));
    }, timeout);

    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (output += data.toString()));

    proc.on("close", () => {
      clearTimeout(timer);
      resolve(output);
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
```

#### Module 2: Semgrep Validator

**File:** `agents/validation/validators/semgrep-validator.ts` (NEW)

```typescript
import { spawn } from "child_process";
import { ValidatorResult } from "../../../types/validation";
import { loadIgnoreList } from "./security-ignore-list";
import { loadConfig } from "./security-config";

export async function runSemgrepValidator(
  runId: string,
  workingDir: string = process.cwd(),
  timeoutMs: number = 120000,
): Promise<ValidatorResult> {
  const config = loadConfig();
  const ignoreList = loadIgnoreList();

  // Run Semgrep
  const semgrepOutput = await execSemgrep(workingDir, timeoutMs);

  // Parse and filter results
  const findings = parseSemgrepOutput(semgrepOutput);
  const filteredFindings = applyIgnoreList(findings, ignoreList.semgrep);

  // Check severity thresholds
  const passed = checkSemgrepThresholds(filteredFindings, config.semgrep);

  return {
    id: uuid(),
    runId,
    validatorName: "semgrep",
    status: "completed",
    passed,
    output: JSON.stringify(filteredFindings, null, 2),
    metadata: {
      total: filteredFindings.length,
      errors: countByLevel(filteredFindings, "ERROR"),
      warnings: countByLevel(filteredFindings, "WARNING"),
    },
    durationMs: Date.now() - startTime,
    createdAt: new Date().toISOString(),
  };
}

async function execSemgrep(cwd: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const proc = spawn(
      "semgrep",
      [
        "scan",
        "--config",
        ".semgrep.yml",
        "--json",
        "--no-git-ignore", // Scan all files
      ],
      { cwd, shell: true },
    );

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Semgrep timeout"));
    }, timeout);

    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (output += data.toString()));

    proc.on("close", () => {
      clearTimeout(timer);
      resolve(output);
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function parseSemgrepOutput(output: string): SemgrepFinding[] {
  const result = JSON.parse(output);
  return result.results.map((r: any) => ({
    ruleId: r.check_id,
    severity: r.extra.severity,
    message: r.extra.message,
    file: r.path,
    line: r.start.line,
    column: r.start.col,
    category: r.extra.metadata?.category || "security",
    cwe: r.extra.metadata?.cwe || [],
  }));
}
```

#### Module 3: Security Reporter

**File:** `agents/validation/validators/security-reporter.ts` (NEW)

```typescript
import fs from "fs/promises";
import path from "path";
import { ValidatorResult } from "../../../types/validation";

export async function generateSecurityReport(
  runId: string,
  validatorResults: ValidatorResult[],
): Promise<SecurityReport> {
  const reportDir = path.join("security-reports", runId);
  await fs.mkdir(reportDir, { recursive: true });

  // Aggregate findings
  const findings = aggregateFindings(validatorResults);
  const summary = calculateSummary(findings);

  const report: SecurityReport = {
    runId,
    timestamp: new Date().toISOString(),
    summary,
    findings,
    passed: summary.critical === 0 && summary.high === 0,
    failureReasons: generateFailureReasons(summary),
  };

  // Write JSON report
  await fs.writeFile(
    path.join(reportDir, "security-report.json"),
    JSON.stringify(report, null, 2),
  );

  // Write HTML report
  const html = generateHtmlReport(report);
  await fs.writeFile(path.join(reportDir, "security-report.html"), html);

  // Update "latest" symlink
  await updateLatestSymlink(runId);

  return report;
}

function generateHtmlReport(report: SecurityReport): string {
  // Simple template substitution
  const template = fs.readFileSync(
    path.join(__dirname, "templates/security-report.html"),
    "utf-8",
  );

  return template
    .replace(/{{runId}}/g, report.runId)
    .replace(/{{timestamp}}/g, report.timestamp)
    .replace(/{{status}}/g, report.passed ? "✅ PASSED" : "❌ FAILED")
    .replace(/{{summary.critical}}/g, String(report.summary.critical))
    .replace(/{{summary.high}}/g, String(report.summary.high))
    .replace(/{{summary.moderate}}/g, String(report.summary.moderate))
    .replace(/{{summary.low}}/g, String(report.summary.low))
    .replace(/{{summary.info}}/g, String(report.summary.info));
}
```

#### Module 4: Ignore List Handler

**File:** `agents/validation/validators/security-ignore-list.ts` (NEW)

```typescript
import fs from "fs";
import yaml from "yaml";

interface IgnoreEntry {
  justification: string;
  ignoredBy: string;
  ignoredDate: string;
  expires: string;
}

interface IgnoreList {
  npmAudit: Map<string, IgnoreEntry>;
  semgrep: Map<string, IgnoreEntry>;
}

export function loadIgnoreList(): IgnoreList {
  const content = fs.readFileSync(".security-ignore.yml", "utf-8");
  const data = yaml.parse(content);

  return {
    npmAudit: parseNpmAuditIgnores(data["npm-audit"] || []),
    semgrep: parseSemgrepIgnores(data["semgrep"] || []),
  };
}

export function applyIgnoreList<T extends { id: string }>(
  findings: T[],
  ignoreMap: Map<string, IgnoreEntry>,
): T[] {
  const now = new Date();

  return findings.filter((finding) => {
    const ignore = ignoreMap.get(finding.id);
    if (!ignore) return true; // Not ignored

    const expires = new Date(ignore.expires);
    if (now > expires) {
      console.warn(`⚠️  Ignore expired for ${finding.id} - re-evaluate`);
      return true; // Expired, include in findings
    }

    console.log(`ℹ️  Ignoring ${finding.id}: ${ignore.justification}`);
    return false; // Still valid, exclude
  });
}
```

---

## Pass Criteria

### Validation Criteria

| ID   | Criterion                                      | Validation Method                                                         |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| PC1  | npm audit runs on `npm test`                   | Manual: Run `npm test` and verify npm audit executes                      |
| PC2  | Semgrep configured with security rules         | Manual: Run `npm run security:semgrep` and verify output                  |
| PC3  | Custom security rules detect SQL injection     | Unit test: Create test file with SQL injection pattern, verify detection  |
| PC4  | Custom security rules detect command injection | Unit test: Create test file with command injection, verify detection      |
| PC5  | Custom security rules detect hardcoded secrets | Unit test: Add fake API key to test file, verify detection                |
| PC6  | Severity thresholds enforced                   | Unit test: Mock findings at each severity, verify fail/pass behavior      |
| PC7  | Security report generated in JSON format       | Integration test: Run security scan, verify `security-report.json` exists |
| PC8  | Security report generated in HTML format       | Integration test: Run security scan, verify `security-report.html` exists |
| PC9  | CI pipeline fails on critical vulnerabilities  | Manual: Create PR with critical vuln, verify CI fails                     |
| PC10 | Vulnerability ignore list works                | Unit test: Add entry to ignore list, verify finding excluded              |
| PC11 | Expired ignores trigger warnings               | Unit test: Create expired ignore, verify warning logged                   |
| PC12 | GitHub Actions workflow runs on push           | Manual: Push to dev branch, verify security-scan workflow executes        |
| PC13 | PR comment posted on security failure          | Manual: Create PR with security issue, verify comment appears             |
| PC14 | Security reports uploaded as artifacts         | Manual: Check GitHub Actions artifacts for security-reports/              |

### Acceptance Tests

**Test 1: npm audit detects vulnerable dependencies**

```bash
# Add vulnerable package temporarily
npm install lodash@4.17.19  # Known CVE
npm test
# Expected: npm audit reports critical vulnerability, build fails
npm uninstall lodash
```

**Test 2: Semgrep detects SQL injection**

```typescript
// Create test file: test-sql-injection.ts
const userId = req.query.id;
const query = `SELECT * FROM users WHERE id = ${userId}`; // UNSAFE
db.query(query);

// Run: npm run security:semgrep
// Expected: Semgrep detects sql-injection-risk rule violation
```

**Test 3: Security report generation**

```bash
npm run test:security
# Expected:
# - security-reports/{runId}/security-report.json exists
# - security-reports/{runId}/security-report.html exists
# - security-reports/latest/ symlink points to latest report
```

**Test 4: Ignore list functionality**

```yaml
# Add to .security-ignore.yml
semgrep:
  - rule-id: "test-rule"
    file: "test-file.ts"
    line: 10
    justification: "False positive - test code only"
    ignored-by: "developer"
    ignored-date: "2026-02-09"
    expires: "2026-05-09"
```

```bash
npm run test:security
# Expected: Finding for test-rule excluded from report
```

**Test 5: CI integration**

```bash
# Create PR with security issue
git checkout -b test-security
echo "const key = 'sk-1234567890abcdef';" > test-secret.ts
git add test-secret.ts
git commit -m "test: trigger security scan"
git push origin test-security

# Expected:
# - GitHub Actions security-scan workflow runs
# - Build fails due to hardcoded secret detection
# - PR comment posted with security summary
```

---

## Dependencies

### Required

- **PHASE2-TASK-03** (QA Agent v0.1) - Security validation integrates with QA pipeline
- **Existing:** `agents/validation/validators/security-scanner.ts` - npm audit foundation

### Optional

- **VIBE-P14-003** (E2E Test Framework) - Could add security E2E tests
- **VIBE-P14-008** (Test Coverage) - Could track security test coverage

### External Dependencies

**NPM Packages:**

- `@semgrep/cli` - SAST tool (will be installed as dev dependency)
- `yaml` - Already installed (parse ignore list)

**System Requirements:**

- Node.js 20+ (already required)
- Git (already required)
- ~500MB disk space for Semgrep rules cache

---

## Implementation Notes

### Semgrep vs CodeQL Decision

**Why Semgrep:**
✅ Lightweight (20-30s vs 5-10min for CodeQL)
✅ No GitHub account/GHAS license required
✅ Runs locally and in CI identically
✅ Easy custom rule creation (YAML)
✅ Better TypeScript/Express support
✅ Community rules immediately usable

**CodeQL Drawbacks:**
❌ Requires GitHub Advanced Security (paid)
❌ Slow (database build + analysis)
❌ Complex query language (QL)
❌ Limited local development workflow

### Custom Rules Priority

**Implement These First:**

1. SQL Injection (high impact, common)
2. Command Injection (critical severity)
3. Hardcoded Secrets (easy to detect, high value)
4. Path Traversal (common in file handling)
5. XSS Prevention (relevant for frontend)

**Defer to Community Rules:**

- Prototype pollution
- Regular expression DoS
- Insecure randomness

### Performance Considerations

**Execution Time Targets:**

- npm audit: < 10 seconds
- Semgrep scan: < 30 seconds
- Report generation: < 5 seconds
- **Total:** < 45 seconds overhead per test run

**Optimization Strategies:**

- Cache Semgrep rules (auto-cached in ~/.semgrep/)
- Run npm audit and Semgrep in parallel
- Skip security scan for unit tests (only integration/CI)
- Use `--skip-semgrep` flag for rapid development

### Integration with Existing Tests

**Option 1: Run on Every Test (Default)**

```json
{
  "scripts": {
    "test": "npm run security:check && vitest run"
  }
}
```

**Option 2: Separate Security Test Command**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:security": "npm run security:check && npm test"
  }
}
```

**Recommendation:** Option 2 for development speed, Option 1 for CI

### Handling False Positives

**Process:**

1. Developer encounters false positive
2. Investigates to confirm it's truly safe
3. Adds entry to `.security-ignore.yml` with:
   - Clear justification
   - Expiration date (3-6 months)
   - Name/date for accountability
4. Creates PR with ignore entry
5. Team reviews justification
6. On expiration, finding resurfaces for re-evaluation

**Review Cadence:**

- Weekly: Check for expired ignores
- Monthly: Review all active ignores
- Quarterly: Audit ignore list, remove obsolete entries

---

## Related Specifications

- **PHASE2-TASK-03** (QA Agent v0.1) - Validation framework foundation
- **VIBE-P14-003** (E2E Test Framework) - CI/CD integration patterns
- **VIBE-P14-004** (E2E Test Generator) - Test generation patterns
- **VIBE-P14-008** (Test Coverage) - Coverage reporting patterns

---

## Rollout Plan

### Phase 1: Foundation (2-3 hours)

- [ ] Install Semgrep CLI
- [ ] Create `.semgrep.yml` configuration
- [ ] Enhance `security-scanner.ts` for npm audit
- [ ] Create `semgrep-validator.ts`
- [ ] Add `security-config.json`

### Phase 2: Custom Rules (2 hours)

- [ ] Create `.semgrep/rules/` directory
- [ ] Implement SQL injection rule
- [ ] Implement command injection rule
- [ ] Implement secret detection rule
- [ ] Test rules against sample code

### Phase 3: Reporting (1-2 hours)

- [ ] Create `security-reporter.ts`
- [ ] Design HTML report template
- [ ] Implement unified report generation
- [ ] Test report output

### Phase 4: Ignore List (1 hour)

- [ ] Create `security-ignore-list.ts`
- [ ] Create `.security-ignore.yml` template
- [ ] Implement filtering logic
- [ ] Test ignore functionality

### Phase 5: CI Integration (1 hour)

- [ ] Create `.github/workflows/security-scan.yml`
- [ ] Add PR comment action
- [ ] Test workflow on dev branch
- [ ] Document workflow in README

### Phase 6: Validation (1 hour)

- [ ] Run all pass criteria tests
- [ ] Create test cases for custom rules
- [ ] Verify CI integration
- [ ] Document usage for developers

---

**Specification Complete** ✅
**Ready for:** Build Agent Implementation
**Estimated Effort:** 6-8 hours
**Priority:** High (Security is critical for production)
