# VIBE-P14-004: E2E Test Generator - User Flow Tests from Acceptance Criteria

**Task ID:** VIBE-P14-004
**Created:** 2026-02-09
**Status:** ✅ SPECIFICATION COMPLETE
**Category:** Testing Infrastructure
**Priority:** High (P1 - Phase 14)
**Estimated Effort:** 12-16 hours
**Model:** Opus (for test generation logic)
**Dependencies:** VIBE-P14-003 (E2E Test Framework Setup)

---

## Overview

Build an intelligent E2E test generator that parses acceptance criteria from task descriptions and automatically generates executable Playwright test scripts. The generator understands Gherkin-style Given/When/Then syntax, maps common user actions to Playwright commands, creates reusable step definitions, and supports data-driven test scenarios.

### Problem Statement

**Current State:**

- ✅ Playwright E2E framework fully operational (VIBE-P14-003)
- ✅ Test utilities and fixtures available
- ✅ 4 manually-written test suites exist
- ❌ **BUT** writing E2E tests is manual, time-consuming, and error-prone
- ❌ Acceptance criteria buried in spec documents go untested
- ❌ No automated translation from requirements to executable tests
- ❌ Inconsistent test patterns across manually-written suites
- ❌ High barrier to test coverage for new features

**Desired State:**

- Task specifications with Gherkin-style acceptance criteria auto-generate Playwright tests
- Generator parses Given/When/Then clauses into test steps
- Common actions ("click", "fill", "navigate") map to correct Playwright commands
- Generated tests integrate with existing fixtures and utilities
- Tests are immediately executable without manual modification
- Data tables in acceptance criteria generate data-driven tests
- Step definitions reusable across multiple test scenarios

### Value Proposition

The E2E Test Generator is the **"Requirements-to-Tests Compiler"** that bridges specification and validation:

1. **Automated Test Coverage** - Every acceptance criterion becomes an executable test
2. **Specification Validation** - Tests generated from specs ensure requirements are testable
3. **Consistency** - Generated tests follow uniform patterns and best practices
4. **Developer Productivity** - Eliminates 80% of boilerplate test writing
5. **Living Documentation** - Acceptance criteria become executable specifications
6. **Regression Prevention** - New features automatically get test coverage
7. **Quality Gates** - Generated tests become automated pass criteria for tasks

---

## Requirements

### Functional Requirements

#### FR1: Gherkin Parser

**Description:** Parse Gherkin-style acceptance criteria from task specifications

**Input Format:**

```gherkin
Scenario: User creates a new idea
  Given the user is on the ideas list page
  And the user is logged in
  When the user clicks the "New Idea" button
  And the user fills in "title" with "My Test Idea"
  And the user fills in "description" with "A great idea"
  And the user clicks the "Create" button
  Then the user should see "Idea created successfully"
  And the idea "My Test Idea" should appear in the ideas list
```

**Parser Output:**

```typescript
interface ParsedScenario {
  name: string;
  steps: Step[];
  tags?: string[];
}

interface Step {
  keyword: "Given" | "When" | "Then" | "And" | "But";
  action: string;
  parameters: Record<string, string | number>;
  rawText: string;
}
```

**Acceptance Criteria:**

- ✅ Parses `Scenario:` and `Scenario Outline:` declarations
- ✅ Recognizes `Given`, `When`, `Then`, `And`, `But` keywords
- ✅ Extracts string parameters from quotes ("New Idea", 'My Test Idea')
- ✅ Extracts numeric parameters (42, 3.14)
- ✅ Supports multi-line step text with `"""`
- ✅ Parses scenario tags (`@smoke`, `@integration`)
- ✅ Handles data tables for Examples sections
- ✅ Ignores comments (lines starting with `#`)

---

#### FR2: Action Mapping Engine

**Description:** Map parsed steps to Playwright commands based on action verbs

**Action Categories:**

| Action Pattern                     | Playwright Command                                      | Example                                         |
| ---------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| **Navigation**                     |                                                         |                                                 |
| "goes to {url}"                    | `page.goto(url)`                                        | Given user goes to "/ideas"                     |
| "navigates to {page}"              | `page.goto(pathMap[page])`                              | When user navigates to ideas page               |
| "is on {page}"                     | `expect(page).toHaveURL(url)`                           | Given user is on dashboard                      |
| **Interaction**                    |                                                         |                                                 |
| "clicks {element}"                 | `page.click(selector)`                                  | When user clicks "Submit"                       |
| "fills {field} with {value}"       | `page.fill(selector, value)`                            | When user fills "email" with "test@example.com" |
| "selects {option} from {dropdown}" | `page.selectOption(selector, option)`                   | When user selects "Admin" from role dropdown    |
| "checks {checkbox}"                | `page.check(selector)`                                  | When user checks "Accept terms"                 |
| "uploads {file} to {field}"        | `page.setInputFiles(selector, file)`                    | When user uploads "photo.jpg" to avatar         |
| "presses {key}"                    | `page.press(selector, key)`                             | When user presses "Enter"                       |
| **Waiting**                        |                                                         |                                                 |
| "waits for {element}"              | `page.waitForSelector(selector)`                        | When user waits for loading spinner             |
| "waits {n} seconds"                | `page.waitForTimeout(n * 1000)`                         | And user waits 2 seconds                        |
| **Assertions**                     |                                                         |                                                 |
| "should see {text}"                | `expect(page.locator('text={text}')).toBeVisible()`     | Then user should see "Success"                  |
| "should not see {text}"            | `expect(page.locator('text={text}')).not.toBeVisible()` | Then user should not see "Error"                |
| "{element} should be visible"      | `expect(page.locator(selector)).toBeVisible()`          | Then submit button should be visible            |
| "{element} should be disabled"     | `expect(page.locator(selector)).toBeDisabled()`         | Then form should be disabled                    |
| "should have {count} {items}"      | `expect(page.locator(selector)).toHaveCount(count)`     | Then should have 5 ideas                        |
| **State**                          |                                                         |                                                 |
| "is logged in"                     | `await login(page)`                                     | Given user is logged in                         |
| "has {role} role"                  | `await setupRole(page, role)`                           | Given user has admin role                       |
| "database has {entity}"            | `await seedDatabase(entity)`                            | Given database has test idea                    |

**Acceptance Criteria:**

- ✅ Recognizes 20+ common action patterns
- ✅ Extracts element selectors from action text
- ✅ Generates appropriate Playwright command for each action
- ✅ Handles parameterized actions with string/number substitution
- ✅ Maps to existing test utilities when available (`sendChatMessage`, `waitForAIResponse`)
- ✅ Supports custom action mappings via configuration file
- ✅ Falls back to comment placeholder for unmapped actions

---

#### FR3: Selector Strategy

**Description:** Generate robust element selectors from natural language descriptions

**Selector Priority Order:**

1. **Data Test IDs** (highest priority) - `[data-testid="submit-button"]`
2. **ARIA Roles** - `page.getByRole('button', { name: 'Submit' })`
3. **Label Text** - `page.getByLabel('Email')`
4. **Placeholder** - `page.getByPlaceholder('Enter email...')`
5. **Text Content** - `page.getByText('Submit')`
6. **CSS Selectors** (fallback) - `button.submit`

**Selector Generation Rules:**

| Element Description | Generated Selector                                                   | Rationale               |
| ------------------- | -------------------------------------------------------------------- | ----------------------- |
| "Submit button"     | `page.getByRole('button', { name: /submit/i })`                      | Role + text match       |
| "email field"       | `page.getByLabel('Email')` or `[name="email"]`                       | Label or name attribute |
| "loading spinner"   | `[data-testid="loading-spinner"]`                                    | Data test ID            |
| "first idea card"   | `page.locator('[data-testid="idea-card"]').first()`                  | Positional selector     |
| "idea titled 'X'"   | `page.locator('[data-testid="idea-card"]').filter({ hasText: 'X' })` | Filter by content       |

**Acceptance Criteria:**

- ✅ Generates selectors using Playwright locator API (not CSS strings)
- ✅ Prefers accessibility-friendly selectors (roles, labels)
- ✅ Uses data-testid when available
- ✅ Handles positional selectors (first, last, nth)
- ✅ Supports filtering by text content
- ✅ Case-insensitive text matching with regex
- ✅ Generated selectors are resilient to minor UI changes

---

#### FR4: Test File Generation

**Description:** Generate complete Playwright test files from parsed scenarios

**Generated File Structure:**

```typescript
// Generated from: VIBE-P14-004-acceptance-criteria.md
// Scenario: User creates a new idea
// Generated: 2026-02-09T15:30:00Z

import { test, expect } from "./fixtures";
import {
  waitForLoadingComplete,
  sendChatMessage,
  navigateToIdea,
} from "./utils";

test.describe("User creates a new idea", () => {
  test.beforeEach(async ({ page, setupMocks }) => {
    await setupMocks(page);
  });

  test("should create new idea successfully", async ({ page }) => {
    // Given the user is on the ideas list page
    await page.goto("/ideas");
    await waitForLoadingComplete(page);

    // When the user clicks the "New Idea" button
    await page.getByRole("button", { name: /new idea/i }).click();

    // And the user fills in "title" with "My Test Idea"
    await page.getByLabel("Title").fill("My Test Idea");

    // And the user fills in "description" with "A great idea"
    await page.getByLabel("Description").fill("A great idea");

    // And the user clicks the "Create" button
    await page.getByRole("button", { name: /create/i }).click();

    // Then the user should see "Idea created successfully"
    await expect(page.getByText("Idea created successfully")).toBeVisible();

    // And the idea "My Test Idea" should appear in the ideas list
    await expect(
      page
        .locator('[data-testid="idea-card"]')
        .filter({ hasText: "My Test Idea" }),
    ).toBeVisible();
  });
});
```

**File Metadata:**

- Source spec file reference
- Generation timestamp
- Generator version
- Warning: "Auto-generated - do not edit manually"

**Acceptance Criteria:**

- ✅ Imports correct fixtures and utilities
- ✅ Uses `test.describe` for scenario grouping
- ✅ Includes `beforeEach` with mock setup
- ✅ Each step becomes a code comment + Playwright command
- ✅ Proper async/await usage
- ✅ Readable test names derived from scenario names
- ✅ Consistent indentation (2 spaces)
- ✅ TypeScript type-safe (passes `tsc --noEmit`)

---

#### FR5: Data-Driven Test Generation

**Description:** Generate parameterized tests from Scenario Outlines with data tables

**Input (Gherkin):**

```gherkin
Scenario Outline: User login with various credentials
  Given the user is on the login page
  When the user fills "email" with "<email>"
  And the user fills "password" with "<password>"
  And the user clicks the "Login" button
  Then the user should see "<message>"

  Examples:
    | email              | password    | message                      |
    | valid@example.com  | correct123  | Welcome back!                |
    | invalid@test.com   | wrong       | Invalid credentials          |
    | missing@test.com   |             | Password is required         |
    |                    | password123 | Email is required            |
```

**Output (Playwright):**

```typescript
test.describe("User login with various credentials", () => {
  const testCases = [
    {
      email: "valid@example.com",
      password: "correct123",
      message: "Welcome back!",
    },
    {
      email: "invalid@test.com",
      password: "wrong",
      message: "Invalid credentials",
    },
    {
      email: "missing@test.com",
      password: "",
      message: "Password is required",
    },
    { email: "", password: "password123", message: "Email is required" },
  ];

  testCases.forEach(({ email, password, message }) => {
    test(`should show "${message}" for email="${email}" password="${password}"`, async ({
      page,
    }) => {
      // Test implementation with parameter substitution
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: /login/i }).click();
      await expect(page.getByText(message)).toBeVisible();
    });
  });
});
```

**Acceptance Criteria:**

- ✅ Parses Examples tables into array of test cases
- ✅ Substitutes `<parameter>` placeholders with actual values
- ✅ Generates one test per table row
- ✅ Test names include parameter values for clarity
- ✅ Empty cells become empty strings
- ✅ Numeric cells auto-convert to numbers
- ✅ Supports multiple Examples tables per scenario

---

#### FR6: Page Object Integration

**Description:** Generate tests using existing page object methods when available

**Example Page Object:**

```typescript
// frontend/e2e/pages/ideas.page.ts
export class IdeasPage extends BasePage {
  async createIdea(title: string, description: string) {
    await this.page.getByRole("button", { name: /new idea/i }).click();
    await this.page.getByLabel("Title").fill(title);
    await this.page.getByLabel("Description").fill(description);
    await this.page.getByRole("button", { name: /create/i }).click();
  }

  async expectIdeaVisible(title: string) {
    await expect(
      this.page.locator('[data-testid="idea-card"]').filter({ hasText: title }),
    ).toBeVisible();
  }
}
```

**Generated Test (with POM):**

```typescript
test("should create new idea successfully", async ({ page }) => {
  const ideasPage = new IdeasPage(page);

  // Given the user is on the ideas list page
  await ideasPage.navigate("/ideas");

  // When the user creates a new idea
  await ideasPage.createIdea("My Test Idea", "A great idea");

  // Then the idea should be visible
  await expect(page.getByText("Idea created successfully")).toBeVisible();
  await ideasPage.expectIdeaVisible("My Test Idea");
});
```

**Page Object Detection:**

- Scan `frontend/e2e/pages/` for existing page objects
- Match step descriptions to page object method names
- Use page object methods when >80% action match
- Fall back to direct Playwright commands if no match

**Acceptance Criteria:**

- ✅ Detects available page objects in `frontend/e2e/pages/`
- ✅ Maps multi-step actions to single page object method when possible
- ✅ Imports and instantiates page objects correctly
- ✅ Falls back gracefully if no page object available
- ✅ Respects page object method signatures
- ✅ Uses POM for 60%+ of steps in generated tests

---

#### FR7: Fixture and Utility Integration

**Description:** Leverage existing test fixtures and utilities from VIBE-P14-003

**Available Fixtures:**

- `mockIdea`, `mockSession`, `mockBuildSession`
- `setupMocks(page)` - API route mocking

**Available Utilities:**

- `waitForElement()`, `waitForText()`, `waitForNetworkIdle()`
- `sendChatMessage()`, `waitForAIResponse()`
- `navigateToIdea()`, `getBuildTasks()`

**Integration Rules:**

| Gherkin Step               | Maps To Utility            | Generated Code                        |
| -------------------------- | -------------------------- | ------------------------------------- |
| "waits for AI response"    | `waitForAIResponse()`      | `await waitForAIResponse(page);`      |
| "sends message {text}"     | `sendChatMessage()`        | `await sendChatMessage(page, text);`  |
| "navigates to idea {slug}" | `navigateToIdea()`         | `await navigateToIdea(page, slug);`   |
| "waits for page ready"     | `waitForLoadingComplete()` | `await waitForLoadingComplete(page);` |

**Acceptance Criteria:**

- ✅ Automatically imports utilities when referenced
- ✅ Prefers utilities over raw Playwright for matched actions
- ✅ Uses `setupMocks` in `beforeEach` for all tests
- ✅ Leverages fixtures for test data
- ✅ No duplicate utility function generation

---

### Non-Functional Requirements

#### NFR1: Performance

- Generator processes 100-line spec in <5 seconds
- Generated test files compile with TypeScript in <2 seconds
- No memory leaks during batch generation (100+ specs)

#### NFR2: Code Quality

- Generated tests pass ESLint with zero warnings
- TypeScript strict mode compatible
- Consistent formatting (Prettier-compliant)
- No hardcoded delays (use waitFor patterns)

#### NFR3: Maintainability

- Generator code has 80%+ test coverage
- Action mappings configurable via JSON/YAML
- Clear error messages for unparseable specs
- Generated code includes source traceability comments

#### NFR4: Extensibility

- Plugin system for custom action mappings
- Hooks for pre/post generation transforms
- Support for custom Gherkin keywords
- Multiple output formats (Playwright, Cypress, TestCafe)

---

## Technical Design

### 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    E2E Test Generator                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Gherkin    │      │    Action    │      │   Selector   │  │
│  │    Parser    │─────▶│   Mapper     │─────▶│  Generator   │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│         │                      │                      │          │
│         │                      │                      │          │
│         ▼                      ▼                      ▼          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Code Generation Engine                       │  │
│  │  • Template rendering                                    │  │
│  │  • Import resolution                                     │  │
│  │  • Type inference                                        │  │
│  │  • Formatting                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Integration Layer                            │  │
│  │  • Page object detection                                 │  │
│  │  • Utility function matching                             │  │
│  │  • Fixture injection                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Output Writer                                │  │
│  │  • File generation                                       │  │
│  │  • TypeScript compilation check                          │  │
│  │  • Test execution validation                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Module Structure

```
parent-harness/orchestrator/src/
└── spawner/
    └── generators/
        └── e2e-test/
            ├── index.ts                    # Main generator entry point
            ├── parser/
            │   ├── gherkin-parser.ts      # FR1: Parse Gherkin syntax
            │   ├── scenario-extractor.ts   # Extract scenarios from specs
            │   └── data-table-parser.ts    # Parse Examples tables
            ├── mapping/
            │   ├── action-mapper.ts        # FR2: Map actions to Playwright
            │   ├── action-patterns.ts      # Action pattern definitions
            │   └── custom-actions.ts       # User-defined action mappings
            ├── selectors/
            │   ├── selector-generator.ts   # FR3: Generate element selectors
            │   ├── selector-strategies.ts  # Selector priority logic
            │   └── element-matcher.ts      # Match descriptions to elements
            ├── codegen/
            │   ├── test-generator.ts       # FR4: Generate test files
            │   ├── template-engine.ts      # Handlebars/EJS templates
            │   └── import-resolver.ts      # Auto-import management
            ├── integration/
            │   ├── page-object-detector.ts # FR6: Detect existing POMs
            │   ├── utility-matcher.ts      # FR7: Match utility functions
            │   └── fixture-injector.ts     # Inject test fixtures
            ├── validation/
            │   ├── typescript-validator.ts # Compile-check generated code
            │   └── test-runner.ts          # Execute generated tests
            ├── config/
            │   ├── action-mappings.json    # Default action patterns
            │   └── generator-config.ts     # Generator configuration
            └── types.ts                     # TypeScript interfaces
```

### 3. Core Interfaces

```typescript
// types.ts

export interface Scenario {
  name: string;
  description?: string;
  tags: string[];
  steps: Step[];
  examples?: DataTable;
  location: SourceLocation;
}

export interface Step {
  keyword: "Given" | "When" | "Then" | "And" | "But";
  text: string;
  action: ParsedAction;
  location: SourceLocation;
}

export interface ParsedAction {
  type: ActionType;
  verb: string;
  target?: string;
  parameters: Record<string, string | number>;
  rawText: string;
}

export type ActionType =
  | "navigation"
  | "interaction"
  | "assertion"
  | "wait"
  | "state"
  | "unknown";

export interface DataTable {
  headers: string[];
  rows: Record<string, string | number>[];
}

export interface GeneratedTest {
  filePath: string;
  sourceSpec: string;
  code: string;
  imports: string[];
  fixtures: string[];
  utilities: string[];
  pageObjects: string[];
  metadata: TestMetadata;
}

export interface TestMetadata {
  generatedAt: Date;
  generatorVersion: string;
  sourceScenario: string;
  tags: string[];
}

export interface PlaywrightCommand {
  method: string;
  args: any[];
  chainedMethod?: string;
  chainedArgs?: any[];
  comment: string;
  awaitRequired: boolean;
}

export interface ActionMapping {
  pattern: RegExp;
  type: ActionType;
  handler: (
    match: RegExpMatchArray,
    context: GeneratorContext,
  ) => PlaywrightCommand;
  examples?: string[];
}

export interface GeneratorContext {
  page: string;
  fixtures: string[];
  utilities: Record<string, string>;
  pageObjects: Record<string, any>;
  config: GeneratorConfig;
}

export interface GeneratorConfig {
  outputDir: string;
  selectorStrategy: "data-testid" | "role" | "label" | "mixed";
  usePageObjects: boolean;
  useUtilities: boolean;
  generateComments: boolean;
  customMappings?: ActionMapping[];
  pageUrls?: Record<string, string>;
}

interface SourceLocation {
  source: string;
  line: number;
}
```

### 4. Example: Gherkin Parser

```typescript
// parser/gherkin-parser.ts

export class GherkinParser {
  parse(text: string, source: string): Scenario[] {
    const lines = text.split("\n").map((line) => line.trimEnd());
    const scenarios: Scenario[] = [];
    let currentScenario: Scenario | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (this.isComment(line) || this.isEmpty(line)) continue;

      if (this.isScenarioDeclaration(line)) {
        if (currentScenario) scenarios.push(currentScenario);
        currentScenario = this.createScenario(line, i, source);
      } else if (this.isStep(line) && currentScenario) {
        currentScenario.steps.push(this.parseStep(line, i, source));
      }
    }

    if (currentScenario) scenarios.push(currentScenario);
    return scenarios;
  }

  private parseStep(line: string, lineNum: number, source: string): Step {
    const match = line.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/);
    if (!match) throw new Error(`Invalid step at line ${lineNum}`);

    const [, keyword, text] = match;
    return {
      keyword: keyword as Step["keyword"],
      text: text.trim(),
      action: this.parseAction(text.trim()),
      location: { source, line: lineNum },
    };
  }

  private parseAction(text: string): ParsedAction {
    const parameters: Record<string, string | number> = {};

    // Extract quoted strings
    const quotes = text.match(/"([^"]+)"|'([^']+)'/g) || [];
    quotes.forEach((q, i) => {
      parameters[`param${i}`] = q.slice(1, -1);
    });

    return {
      type: this.classifyAction(text),
      verb: text.split(" ")[0].toLowerCase(),
      target: this.extractTarget(text),
      parameters,
      rawText: text,
    };
  }

  private classifyAction(text: string): ActionType {
    const lower = text.toLowerCase();
    if (/^(navigates?|goes?|visits?|is on)/.test(lower)) return "navigation";
    if (/^(clicks?|fills?|selects?|checks?)/.test(lower)) return "interaction";
    if (/^(should|expects?|must)/.test(lower)) return "assertion";
    if (/^(waits?|pauses?)/.test(lower)) return "wait";
    return "unknown";
  }

  private isScenarioDeclaration(line: string): boolean {
    return /^\s*Scenario( Outline)?:/.test(line);
  }

  private isStep(line: string): boolean {
    return /^\s*(Given|When|Then|And|But)\s/.test(line);
  }

  private isComment(line: string): boolean {
    return line.trim().startsWith("#");
  }

  private isEmpty(line: string): boolean {
    return line.trim() === "";
  }

  private extractTarget(text: string): string | undefined {
    const match = text.match(
      /(button|field|link|checkbox|dropdown|form|input|page)/i,
    );
    return match ? match[1] : undefined;
  }

  private createScenario(
    line: string,
    lineNum: number,
    source: string,
  ): Scenario {
    const match = line.match(/Scenario( Outline)?:\s*(.+)/);
    return {
      name: match ? match[2].trim() : "Unnamed",
      tags: [],
      steps: [],
      location: { source, line: lineNum },
    };
  }
}
```

### 5. Example: Action Mapper

```typescript
// mapping/action-patterns.ts

export const defaultMappings: ActionMapping[] = [
  {
    pattern: /^(?:user )?goes to "([^"]+)"$/i,
    type: "navigation",
    handler: (match) => ({
      method: "page.goto",
      args: [match[1]],
      comment: `Navigate to ${match[1]}`,
      awaitRequired: true,
    }),
  },
  {
    pattern: /^(?:user )?clicks? (?:the )?"([^"]+)"$/i,
    type: "interaction",
    handler: (match) => ({
      method: "page.getByRole",
      args: ["button", { name: new RegExp(match[1], "i") }],
      chainedMethod: "click",
      comment: `Click "${match[1]}"`,
      awaitRequired: true,
    }),
  },
  {
    pattern: /^(?:user )?fills? (?:in )?"([^"]+)" with "([^"]+)"$/i,
    type: "interaction",
    handler: (match) => ({
      method: "page.getByLabel",
      args: [match[1]],
      chainedMethod: "fill",
      chainedArgs: [match[2]],
      comment: `Fill "${match[1]}" with "${match[2]}"`,
      awaitRequired: true,
    }),
  },
  {
    pattern: /^(?:user )?should see "([^"]+)"$/i,
    type: "assertion",
    handler: (match) => ({
      method: "expect",
      args: [`page.getByText('${match[1]}')`],
      chainedMethod: "toBeVisible",
      comment: `Verify "${match[1]}" visible`,
      awaitRequired: true,
    }),
  },
];
```

---

## Pass Criteria

### Critical Requirements

| #   | Criterion                                       | Validation Method                                                    | Priority |
| --- | ----------------------------------------------- | -------------------------------------------------------------------- | -------- |
| 1   | Parses Gherkin Given/When/Then syntax           | Parser unit tests pass for 20+ scenarios                             | P0       |
| 2   | Maps 20+ common actions to Playwright commands  | Action mapper covers navigation, interaction, assertion, wait, state | P0       |
| 3   | Generates executable test files                 | Generated tests run with `npx playwright test` without errors        | P0       |
| 4   | Uses page object methods when available         | 60%+ of steps use POM in generated tests                             | P1       |
| 5   | Integrates with existing fixtures/utilities     | `setupMocks`, `waitForAIResponse` used correctly                     | P0       |
| 6   | Supports data-driven tests from Examples tables | Scenario Outline generates parameterized tests                       | P1       |
| 7   | Generated code passes TypeScript compilation    | `tsc --noEmit` exits with code 0                                     | P0       |
| 8   | Handles unknown actions gracefully              | Unmapped steps generate TODO comments, not syntax errors             | P1       |

### Test Coverage Requirements

| Component          | Coverage Target  |
| ------------------ | ---------------- |
| Gherkin Parser     | 90%+             |
| Action Mapper      | 85%+             |
| Selector Generator | 80%+             |
| Test Generator     | 85%+             |
| Integration Tests  | 5+ E2E scenarios |

---

## Dependencies

### External Dependencies

| Dependency         | Version | Purpose                                |
| ------------------ | ------- | -------------------------------------- |
| `@playwright/test` | ^1.58.1 | E2E framework (already installed)      |
| `handlebars`       | ^4.7.8  | Template engine                        |
| `commander`        | ^11.1.0 | CLI interface                          |
| `zod`              | ^3.22.4 | Schema validation (already in project) |

### Internal Dependencies

| Module                     | Purpose        | Status       |
| -------------------------- | -------------- | ------------ |
| VIBE-P14-003               | E2E framework  | ✅ Complete  |
| `frontend/e2e/fixtures.ts` | Test fixtures  | ✅ Available |
| `frontend/e2e/utils.ts`    | Test utilities | ✅ Available |

---

## Implementation Plan

### Phase 1: Parser Foundation (4 hours)

- Implement `GherkinParser` class
- Parse Scenario/Scenario Outline
- Extract steps and data tables
- Write 20+ parser unit tests

### Phase 2: Action Mapping (4 hours)

- Implement `ActionMapper` class
- Create 20+ default action patterns
- Implement selector generation
- Write 30+ action mapping tests

### Phase 3: Code Generation (4 hours)

- Implement `TestGenerator` class
- Create test file templates
- Generate imports, fixtures, test body
- Write 15+ generation tests

### Phase 4: Integration Layer (3 hours)

- Implement page object detector
- Match utilities to actions
- Inject fixtures automatically
- Write integration tests

### Phase 5: CLI and Tooling (3 hours)

- Build `generate-e2e-tests` CLI
- Add validation command
- Write documentation

---

## Usage Examples

```bash
# Generate tests from spec file
npm run generate:e2e docs/specs/VIBE-P14-004.md

# Dry run (preview without writing)
npm run generate:e2e --dry-run docs/specs/TASK-029.md

# Validate generated test
npm run validate:e2e frontend/e2e/generated/user-login.spec.ts
```

---

## Success Metrics

- 80% of new features have auto-generated E2E tests
- 50% reduction in manual E2E test writing time
- 90% of generated tests pass without modification
- 95%+ pass rate for generated tests

---

## Conclusion

The E2E Test Generator (VIBE-P14-004) is a **critical productivity multiplier** that bridges the gap between specification and validation. By automatically translating Gherkin acceptance criteria into executable Playwright tests, the generator:

✅ **Eliminates 80% of manual test writing**
✅ **Ensures every requirement is testable**
✅ **Maintains consistent test quality**
✅ **Accelerates feature delivery**
✅ **Creates living documentation**

This specification provides a **comprehensive blueprint** for implementing a production-ready E2E test generator that integrates seamlessly with the existing Playwright infrastructure (VIBE-P14-003).

---

**Document Version:** 1.0
**Last Updated:** 2026-02-09
**Author:** Spec Agent (Autonomous)
**Status:** ✅ SPECIFICATION COMPLETE - READY FOR BUILD AGENT
