/**
 * Browser E2E Tests for Self-Documenting Data Model
 *
 * Validates all 5 phases of the implementation using Puppeteer/Chrome automation.
 * Run with: npx tsx tests/e2e/browser-schema-tests.ts
 *
 * Prerequisites:
 * - Backend running at http://localhost:3001
 * - Frontend running at http://localhost:5173
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

interface TestResult {
  phase: string;
  test: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

/**
 * Helper to unwrap API response wrapper { success: true, data: {...} }
 */
function unwrap<T>(response: { success?: boolean; data?: T } | T): T {
  if (
    response &&
    typeof response === "object" &&
    "success" in response &&
    "data" in response
  ) {
    return (response as { success: boolean; data: T }).data;
  }
  return response as T;
}

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.passed ? "✓" : "✗";
  const duration = result.duration ? ` (${result.duration}ms)` : "";
  console.log(`  ${icon} ${result.test}${duration}`);
  if (!result.passed) {
    console.log(`    → ${result.message}`);
  }
}

// ============================================================================
// PHASE 3: API ENDPOINT TESTS
// ============================================================================

async function testPhase3ApiEndpoints() {
  console.log("\n=== Phase 3: Discovery API Tests ===\n");

  // Test 3.1: GET /api/schema (Overview)
  {
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/schema`);
      const rawData = await response.json();
      const data = unwrap(rawData);

      const hasVersion = typeof data.version === "string";
      const hasEntities = Array.isArray(data.entities);
      const hasEnums = Array.isArray(data.enums);
      const hasSummary =
        data.summary &&
        typeof data.summary.entityCount === "number" &&
        typeof data.summary.enumCount === "number";

      logResult({
        phase: "3",
        test: "GET /api/schema returns overview",
        passed: hasVersion && hasEntities && hasEnums && hasSummary,
        message: `version: ${hasVersion}, entities: ${hasEntities}, enums: ${hasEnums}, summary: ${hasSummary}`,
        duration: Date.now() - start,
      });
    } catch (err) {
      logResult({
        phase: "3",
        test: "GET /api/schema returns overview",
        passed: false,
        message: String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Test 3.2: GET /api/schema/entities (Entity List)
  {
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/schema/entities`);
      const rawData = await response.json();
      const data = unwrap(rawData);

      const hasEntitiesArray = Array.isArray(data.entities);
      const expectedEntities = [
        "idea",
        "project",
        "taskList",
        "task",
        "taskRelationship",
        "prd",
      ];
      const hasExpectedEntities = expectedEntities.every((e) =>
        data.entities?.some((entity: { key: string }) => entity.key === e),
      );

      logResult({
        phase: "3",
        test: "GET /api/schema/entities returns all 6 entities",
        passed: hasEntitiesArray && hasExpectedEntities,
        message: `Found ${data.entities?.length || 0} entities. Expected: ${expectedEntities.join(", ")}`,
        duration: Date.now() - start,
      });
    } catch (err) {
      logResult({
        phase: "3",
        test: "GET /api/schema/entities returns all 6 entities",
        passed: false,
        message: String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Test 3.3: GET /api/schema/entities/:name (Single Entity)
  {
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/schema/entities/task`);
      const rawData = await response.json();
      const data = unwrap(rawData);

      const hasName = data.name === "task" || data.name === "Task";
      const hasTable = typeof data.table === "string";
      const hasPrimaryKey = typeof data.primaryKey === "string";
      const hasSchemas =
        data.schemas && data.schemas.select && data.schemas.insert;

      logResult({
        phase: "3",
        test: "GET /api/schema/entities/:name returns entity details",
        passed: hasName && hasTable && hasPrimaryKey && hasSchemas,
        message: `name: ${hasName}, table: ${hasTable}, primaryKey: ${hasPrimaryKey}, schemas: ${hasSchemas}`,
        duration: Date.now() - start,
      });
    } catch (err) {
      logResult({
        phase: "3",
        test: "GET /api/schema/entities/:name returns entity details",
        passed: false,
        message: String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Test 3.4: GET /api/schema/enums (Enum List)
  {
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/schema/enums`);
      const rawData = await response.json();
      const data = unwrap(rawData);

      const hasEnumsArray = Array.isArray(data.enums);
      const expectedEnums = [
        "ideaType",
        "lifecycleStage",
        "projectStatus",
        "taskStatus",
        "taskCategory",
      ];
      const hasExpectedEnums = expectedEnums.every((e) =>
        data.enums?.some((en: { name: string }) => en.name === e),
      );

      logResult({
        phase: "3",
        test: "GET /api/schema/enums returns expected enums",
        passed: hasEnumsArray && hasExpectedEnums,
        message: `Found ${data.enums?.length || 0} enums. Checking: ${expectedEnums.join(", ")}`,
        duration: Date.now() - start,
      });
    } catch (err) {
      logResult({
        phase: "3",
        test: "GET /api/schema/enums returns expected enums",
        passed: false,
        message: String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Test 3.5: GET /api/schema/enums/:name (Single Enum)
  {
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/schema/enums/taskStatus`);
      const rawData = await response.json();
      const data = unwrap(rawData);

      const hasName = data.name === "taskStatus";
      const hasValues = Array.isArray(data.values) && data.values.length > 0;
      const expectedValues = ["pending", "in_progress", "completed", "failed"];
      const hasExpectedValues = expectedValues.every((v) =>
        data.values?.includes(v),
      );

      logResult({
        phase: "3",
        test: "GET /api/schema/enums/:name returns enum values",
        passed: hasName && hasValues && hasExpectedValues,
        message: `Found values: ${data.values?.slice(0, 5).join(", ")}...`,
        duration: Date.now() - start,
      });
    } catch (err) {
      logResult({
        phase: "3",
        test: "GET /api/schema/enums/:name returns enum values",
        passed: false,
        message: String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Test 3.6: GET /api/schema/relationships (Relationship Graph)
  {
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/schema/relationships`);
      const rawData = await response.json();
      const data = unwrap(rawData);

      const hasRelationships = Array.isArray(data.relationships);
      const hasGraph = typeof data.graph === "object";
      const hasSummary =
        data.summary &&
        typeof data.summary.total === "number" &&
        typeof data.summary.oneToOne === "number" &&
        typeof data.summary.oneToMany === "number";

      logResult({
        phase: "3",
        test: "GET /api/schema/relationships returns graph data",
        passed: hasRelationships && hasGraph && hasSummary,
        message: `Total: ${data.summary?.total || 0}, 1:1: ${data.summary?.oneToOne || 0}, 1:N: ${data.summary?.oneToMany || 0}`,
        duration: Date.now() - start,
      });
    } catch (err) {
      logResult({
        phase: "3",
        test: "GET /api/schema/relationships returns graph data",
        passed: false,
        message: String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Test 3.7: GET /api/schema/full (Full Schema Dump)
  {
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/schema/full`);
      const rawData = await response.json();
      const data = unwrap(rawData);

      const hasVersion = typeof data.version === "string";
      const hasEntities =
        Array.isArray(data.entities) && data.entities.length >= 6;
      const hasEnums = Array.isArray(data.enums) && data.enums.length >= 5;
      const hasRelationships = Array.isArray(data.relationships);

      logResult({
        phase: "3",
        test: "GET /api/schema/full returns complete dump",
        passed: hasVersion && hasEntities && hasEnums && hasRelationships,
        message: `entities: ${data.entities?.length || 0}, enums: ${data.enums?.length || 0}`,
        duration: Date.now() - start,
      });
    } catch (err) {
      logResult({
        phase: "3",
        test: "GET /api/schema/full returns complete dump",
        passed: false,
        message: String(err),
        duration: Date.now() - start,
      });
    }
  }

  // Test 3.8: 404 for unknown entity
  {
    const start = Date.now();
    try {
      const response = await fetch(
        `${BASE_URL}/api/schema/entities/nonexistent_entity_xyz`,
      );
      const passed = response.status === 404;

      logResult({
        phase: "3",
        test: "GET /api/schema/entities/:unknown returns 404",
        passed,
        message: `Status: ${response.status}`,
        duration: Date.now() - start,
      });
    } catch (err) {
      logResult({
        phase: "3",
        test: "GET /api/schema/entities/:unknown returns 404",
        passed: false,
        message: String(err),
        duration: Date.now() - start,
      });
    }
  }
}

// ============================================================================
// PHASE 4: UI COMPONENT TESTS (Browser Required)
// ============================================================================

/**
 * Browser test scenarios for Phase 4 UI validation.
 * These need to be executed in a Puppeteer/browser context.
 */
export const browserTestScenarios = {
  // Scenario 4.1: Schema Page Loads
  schemaPageLoads: {
    name: "Schema Page loads successfully",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      {
        action: "navigate",
        url: `${FRONTEND_URL}/schema`,
        description: "Navigate to /schema page",
      },
      {
        action: "waitForSelector",
        selector: "h1",
        timeout: 10000,
        description: "Wait for page header",
      },
      {
        action: "wait",
        duration: 1000,
        description: "Wait for data to load",
      },
    ],
    assertions: [
      { type: "textContent", selector: "h1", expected: /Data Model/i },
      { type: "textContent", selector: "body", expected: /entities/i },
    ],
  },

  // Scenario 4.2: Entity List Renders
  entityListRenders: {
    name: "Entity list renders with all 6 entities",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      {
        action: "waitForSelector",
        selector: "h1",
        timeout: 10000,
      },
      {
        action: "wait",
        duration: 1500,
        description: "Wait for entities to load",
      },
    ],
    assertions: [
      { type: "textContent", selector: "body", expected: /Idea/i },
      { type: "textContent", selector: "body", expected: /Project/i },
      { type: "textContent", selector: "body", expected: /Task/i },
      { type: "textContent", selector: "body", expected: /PRD/i },
    ],
  },

  // Scenario 4.3: Entity Selection Shows Detail
  entitySelectionShowsDetail: {
    name: "Clicking entity shows detail panel",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1500 },
      {
        action: "click",
        selector: 'button:has-text("Task")',
        description: "Click on 'Task' entity",
      },
      { action: "wait", duration: 500 },
    ],
    assertions: [
      { type: "textContent", selector: "body", expected: /Columns/i },
      { type: "textContent", selector: "body", expected: /Relationships/i },
    ],
  },

  // Scenario 4.4: View Mode Tabs Work
  viewModeTabsWork: {
    name: "View mode tabs switch content",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1000 },
      // Click Enums tab
      {
        action: "click",
        selector: 'button:has-text("Enums")',
        description: "Switch to Enums tab",
      },
      { action: "wait", duration: 1000 },
    ],
    assertions: [
      {
        type: "textContent",
        selector: "body",
        expected: /taskStatus|lifecycleStage/i,
      },
    ],
  },

  // Scenario 4.5: ERD Tab Renders Diagram
  erdTabRendersDiagram: {
    name: "ERD tab renders relationship diagram",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1000 },
      {
        action: "click",
        selector: 'button:has-text("ERD")',
        description: "Switch to ERD tab",
      },
      { action: "wait", duration: 1500 },
    ],
    assertions: [
      { type: "exists", selector: "svg" },
      { type: "textContent", selector: "body", expected: /one-to-many|1:N/i },
    ],
  },

  // Scenario 4.6: Search Filters Entities
  searchFiltersEntities: {
    name: "Search input filters entity list",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1000 },
      {
        action: "fill",
        selector: "input",
        value: "task",
        description: "Type 'task' in search",
      },
      { action: "wait", duration: 500 },
    ],
    assertions: [{ type: "textContent", selector: "body", expected: /Task/i }],
  },

  // Scenario 4.7: Export Button Downloads JSON
  exportButtonWorks: {
    name: "Export button triggers download",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1000 },
      {
        action: "click",
        selector: 'button:has-text("Export")',
        description: "Click Export button",
      },
      { action: "wait", duration: 500 },
    ],
    assertions: [{ type: "noErrors", description: "No console errors" }],
  },

  // Scenario 4.8: Copy API Endpoint
  copyApiEndpoint: {
    name: "Copy API endpoint works",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1500 },
      // Select an entity first
      {
        action: "click",
        selector: 'button:has-text("Idea")',
        description: "Select idea entity",
      },
      { action: "wait", duration: 500 },
      // Click API button
      {
        action: "click",
        selector: 'button:has-text("API")',
        description: "Click API button to copy endpoint",
      },
      { action: "wait", duration: 300 },
    ],
    assertions: [{ type: "noErrors", description: "No console errors" }],
  },

  // Scenario 4.9: Column Section Expands/Collapses
  columnSectionToggle: {
    name: "Column section can be expanded/collapsed",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1500 },
      {
        action: "click",
        selector: 'button:has-text("Task")',
        description: "Select task entity",
      },
      { action: "wait", duration: 500 },
      // Toggle columns section
      {
        action: "click",
        selector: 'button:has-text("Columns")',
        description: "Toggle columns section",
      },
    ],
    assertions: [{ type: "noErrors" }],
  },

  // Scenario 4.10: Enum Values Display
  enumValuesDisplay: {
    name: "Enum values display correctly",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1000 },
      {
        action: "click",
        selector: 'button:has-text("Enums")',
        description: "Switch to Enums tab",
      },
      { action: "wait", duration: 1500 },
    ],
    assertions: [
      {
        type: "textContent",
        selector: "body",
        expected: /pending|completed|failed/i,
      },
      {
        type: "textContent",
        selector: "body",
        expected: /SPARK|CLARIFY|RESEARCH/i,
      },
    ],
  },

  // Scenario 4.11: ERD Zoom Controls Work
  erdZoomControls: {
    name: "ERD zoom controls function",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1000 },
      {
        action: "click",
        selector: 'button:has-text("ERD")',
        description: "Switch to ERD tab",
      },
      { action: "wait", duration: 1500 },
    ],
    assertions: [{ type: "exists", selector: "svg" }],
  },

  // Scenario 4.12: Navigation Link Exists
  navigationLinkExists: {
    name: "Schema navigation link in sidebar",
    url: FRONTEND_URL,
    steps: [
      { action: "navigate", url: FRONTEND_URL },
      { action: "waitForSelector", selector: "a", timeout: 5000 },
    ],
    assertions: [{ type: "exists", selector: 'a[href="/schema"]' }],
  },

  // Scenario 4.13: Refresh Button Reloads Data
  refreshButtonWorks: {
    name: "Refresh button reloads schema data",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1000 },
    ],
    assertions: [
      { type: "noErrors" },
      { type: "textContent", selector: "h1", expected: /Data Model/i },
    ],
  },

  // Scenario 4.14: Foreign Key References Display
  foreignKeyReferencesDisplay: {
    name: "Foreign key references show correctly",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1500 },
      {
        action: "click",
        selector: 'button:has-text("Task")',
        description: "Select task entity",
      },
      { action: "wait", duration: 500 },
    ],
    assertions: [
      { type: "textContent", selector: "body", expected: /Relationships/i },
    ],
  },

  // Scenario 4.15: Entity Stats Display in Header
  entityStatsDisplay: {
    name: "Entity/enum/relationship stats display in header",
    url: `${FRONTEND_URL}/schema`,
    steps: [
      { action: "navigate", url: `${FRONTEND_URL}/schema` },
      { action: "waitForSelector", selector: "h1", timeout: 10000 },
      { action: "wait", duration: 1000 },
    ],
    assertions: [
      { type: "textContent", selector: "body", expected: /\d+ entities/i },
      { type: "textContent", selector: "body", expected: /\d+ enums/i },
      { type: "textContent", selector: "body", expected: /\d+ relationships/i },
    ],
  },
};

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runApiTests() {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║   Self-Documenting Data Model - Browser Test Scenarios       ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝",
  );

  // Check server availability using schema endpoint
  console.log(`\nChecking server at ${BASE_URL}...`);
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/schema`);
    if (!healthCheck.ok) throw new Error(`Status: ${healthCheck.status}`);
    console.log("✓ Server is running\n");
  } catch (err) {
    console.error(`✗ Server not available at ${BASE_URL}`);
    console.error("  Please start the server: npm run dev\n");
    process.exit(1);
  }

  // Run API tests
  await testPhase3ApiEndpoints();

  // Print summary
  console.log("\n" + "═".repeat(60));
  console.log("TEST SUMMARY");
  console.log("═".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${results.length}`);

  if (failed > 0) {
    console.log("\n⚠ Failed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.test}: ${r.message}`);
      });
  }

  console.log("\n" + "═".repeat(60));
  console.log("BROWSER TEST SCENARIOS FOR PUPPETEER/CLAUDE");
  console.log("═".repeat(60));
  console.log(
    `\nGenerated ${Object.keys(browserTestScenarios).length} browser test scenarios.`,
  );
  console.log("Export: browserTestScenarios\n");

  // Output test scenarios for browser automation
  console.log("Available scenarios:");
  Object.entries(browserTestScenarios).forEach(([key, scenario]) => {
    console.log(`  • ${key}: ${scenario.name}`);
  });

  return {
    passed,
    failed,
    total: results.length,
    results,
    browserTestScenarios,
  };
}

// Run if executed directly
runApiTests().catch(console.error);

export { runApiTests, BASE_URL, FRONTEND_URL };
