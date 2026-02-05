/**
 * E2E Test Suite for Multi-Source Graph Analysis
 *
 * Tests the expanded graph analysis feature that collects from multiple sources:
 * - Conversation messages
 * - Artifacts (research, code, etc.)
 * - Memory files (state documents)
 * - User-created blocks
 *
 * Run with: npx tsx tests/e2e/multi-source-analysis.test.ts
 */

const BASE_URL = "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

interface CollectionMetadata {
  conversationCount: number;
  artifactCount: number;
  memoryFileCount: number;
  userBlockCount: number;
}

interface SourceCollectionResult {
  sources: Array<{
    id: string;
    type: string;
    content: string;
    weight: number;
    metadata: Record<string, unknown>;
  }>;
  totalTokenEstimate: number;
  truncated: boolean;
  collectionMetadata: CollectionMetadata;
}

interface ProposedChange {
  id: string;
  type: string;
  content: string;
  sourceId: string;
  sourceType: string;
  sourceWeight: number;
  corroboratedBy?: Array<{
    sourceId: string;
    sourceType: string;
    snippet: string;
  }>;
}

interface AnalysisResult {
  context: {
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
  };
  proposedChanges: ProposedChange[];
  collectionMetadata?: CollectionMetadata & {
    totalTokens: number;
    truncated: boolean;
  };
}

// Test session ID with data (update with a session that has conversations, artifacts, etc.)
const TEST_SESSION_ID = "afda70d2-5ae0-497e-9ab2-8e7596c9da07";

async function makeRequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// Test: Source Collection
// ============================================================================

async function testConversationCollection(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await makeRequest<SourceCollectionResult>(
      `/api/ideation/session/${TEST_SESSION_ID}/graph/collect-sources`,
      "POST",
      { sourceTypes: ["conversation"], limit: 10 },
    );

    // Verify structure
    if (!Array.isArray(result.sources)) {
      throw new Error("sources is not an array");
    }

    // Verify weights (user=1.0, assistant=0.8)
    const weights = new Set(result.sources.map((s) => s.weight));
    const hasCorrectWeights = weights.has(1.0) || weights.has(0.8);
    if (!hasCorrectWeights && result.sources.length > 0) {
      throw new Error(`Unexpected weights: ${[...weights]}`);
    }

    return {
      name: "Conversation Collection",
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "Conversation Collection",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

async function testArtifactCollection(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await makeRequest<SourceCollectionResult>(
      `/api/ideation/session/${TEST_SESSION_ID}/graph/collect-sources`,
      "POST",
      { sourceTypes: ["artifact"] },
    );

    // Verify structure
    if (!Array.isArray(result.sources)) {
      throw new Error("sources is not an array");
    }

    // Verify artifact metadata
    result.sources.forEach((source) => {
      if (source.type !== "artifact") {
        throw new Error(`Expected artifact type, got ${source.type}`);
      }
    });

    return {
      name: "Artifact Collection",
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "Artifact Collection",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

async function testMemoryFileCollection(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await makeRequest<SourceCollectionResult>(
      `/api/ideation/session/${TEST_SESSION_ID}/graph/collect-sources`,
      "POST",
      { sourceTypes: ["memory_file"] },
    );

    // Verify structure
    if (!Array.isArray(result.sources)) {
      throw new Error("sources is not an array");
    }

    // Verify memory file metadata
    result.sources.forEach((source) => {
      if (source.type !== "memory_file") {
        throw new Error(`Expected memory_file type, got ${source.type}`);
      }
    });

    return {
      name: "Memory File Collection",
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "Memory File Collection",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

async function testUserBlockCollection(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await makeRequest<SourceCollectionResult>(
      `/api/ideation/session/${TEST_SESSION_ID}/graph/collect-sources`,
      "POST",
      { sourceTypes: ["user_block"] },
    );

    // This may return empty if no user blocks exist, which is valid
    if (!Array.isArray(result.sources)) {
      throw new Error("sources is not an array");
    }

    return {
      name: "User Block Collection",
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "User Block Collection",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

async function testUnifiedCollection(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await makeRequest<SourceCollectionResult>(
      `/api/ideation/session/${TEST_SESSION_ID}/graph/collect-sources`,
      "POST",
      { tokenBudget: 30000 },
    );

    // Verify metadata
    if (!result.collectionMetadata) {
      throw new Error("Missing collection metadata");
    }

    const {
      conversationCount,
      artifactCount,
      memoryFileCount,
      userBlockCount,
    } = result.collectionMetadata;

    // At least one source type should have data
    const totalSources =
      conversationCount + artifactCount + memoryFileCount + userBlockCount;
    if (totalSources === 0) {
      throw new Error("No sources collected");
    }

    return {
      name: "Unified Collection",
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "Unified Collection",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// Test: Analysis with Source Attribution
// ============================================================================

async function testAnalysisWithAttribution(): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await makeRequest<AnalysisResult>(
      `/api/ideation/session/${TEST_SESSION_ID}/graph/analyze-changes`,
      "POST",
      {},
    );

    // Verify context structure
    if (!result.context) {
      throw new Error("Missing context in response");
    }
    if (!result.context.who || !result.context.what) {
      throw new Error("Context missing required fields");
    }

    // Verify proposed changes have source attribution
    if (result.proposedChanges && result.proposedChanges.length > 0) {
      const firstChange = result.proposedChanges[0];
      if (!firstChange.sourceId) {
        throw new Error("Proposed change missing sourceId");
      }
      if (!firstChange.sourceType) {
        throw new Error("Proposed change missing sourceType");
      }
      if (typeof firstChange.sourceWeight !== "number") {
        throw new Error("Proposed change missing sourceWeight");
      }
    }

    // Verify collection metadata
    if (!result.collectionMetadata) {
      throw new Error("Missing collection metadata");
    }

    return {
      name: "Analysis with Source Attribution",
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "Analysis with Source Attribution",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// Test: Token Budget Handling
// ============================================================================

async function testTokenBudgetTruncation(): Promise<TestResult> {
  const start = Date.now();
  try {
    // Request with very small token budget to trigger truncation
    const result = await makeRequest<SourceCollectionResult>(
      `/api/ideation/session/${TEST_SESSION_ID}/graph/collect-sources`,
      "POST",
      { tokenBudget: 2000 },
    );

    // Verify truncation flag is set when appropriate
    if (result.totalTokenEstimate > 2000 && !result.truncated) {
      throw new Error(
        "Expected truncated=true when token estimate exceeds budget",
      );
    }

    return {
      name: "Token Budget Handling",
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "Token Budget Handling",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Multi-Source Analysis E2E Tests");
  console.log("=".repeat(60));
  console.log(`Test Session ID: ${TEST_SESSION_ID}`);
  console.log("");

  const results: TestResult[] = [];

  // Run all tests
  const tests = [
    testConversationCollection,
    testArtifactCollection,
    testMemoryFileCollection,
    testUserBlockCollection,
    testUnifiedCollection,
    testAnalysisWithAttribution,
    testTokenBudgetTruncation,
  ];

  for (const test of tests) {
    const result = await test();
    results.push(result);

    const status = result.passed ? "PASS" : "FAIL";
    const duration = result.duration ? `(${result.duration}ms)` : "";
    console.log(`[${status}] ${result.name} ${duration}`);
    if (result.error) {
      console.log(`       Error: ${result.error}`);
    }
  }

  // Summary
  console.log("");
  console.log("=".repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  }

  console.log("\nAll tests passed!");
}

// Run tests
runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
