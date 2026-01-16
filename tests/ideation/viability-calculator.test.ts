import { describe, test, expect } from "vitest";
import {
  calculateViability,
  getViabilityStatus,
  needsIntervention,
  ViabilityInput,
  VIABILITY_WEIGHTS,
  VIABILITY_THRESHOLDS,
} from "../../agents/ideation/viability-calculator.js";
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from "../../utils/ideation-defaults.js";
import { WebSearchResult } from "../../types/ideation.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createBaseViabilityInput(
  overrides: Partial<ViabilityInput> = {},
): ViabilityInput {
  return {
    selfDiscovery: createDefaultSelfDiscoveryState(),
    marketDiscovery: createDefaultMarketDiscoveryState(),
    narrowingState: createDefaultNarrowingState(),
    webSearchResults: [],
    candidate: { id: "test_candidate" },
    ...overrides,
  };
}

function createHealthyViabilityInput(): ViabilityInput {
  const marketDiscovery = createDefaultMarketDiscoveryState();
  marketDiscovery.competitors = [
    {
      name: "Comp1",
      description: "d",
      strengths: [],
      weaknesses: ["slow"],
      source: "url",
    },
  ];
  marketDiscovery.gaps = [
    { description: "Clear gap", evidence: "research", relevance: "high" },
  ];

  const narrowingState = createDefaultNarrowingState();
  narrowingState.customerType = { value: "B2B", confidence: 0.9 };
  narrowingState.productType = { value: "Digital", confidence: 0.8 };

  return createBaseViabilityInput({ marketDiscovery, narrowingState });
}

function createLowViabilityInput(): ViabilityInput {
  const selfDiscovery = createDefaultSelfDiscoveryState();
  selfDiscovery.skills.gaps = ["skill1", "skill2", "skill3"];
  selfDiscovery.constraints.capital = "bootstrap";
  selfDiscovery.constraints.timeHoursPerWeek = 5; // Low time

  const narrowingState = createDefaultNarrowingState();
  narrowingState.technicalDepth = { value: "full_custom", confidence: 0.9 }; // High complexity

  const webSearchResults: WebSearchResult[] = [
    {
      title: "Industry Analysis",
      url: "http://example.com",
      snippet:
        "This technology is impossible with current methods and years away from reality. Requires million dollar funding.",
      source: "TechSite",
    },
  ];

  return createBaseViabilityInput({
    selfDiscovery,
    narrowingState,
    webSearchResults,
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe("ViabilityCalculator", () => {
  describe("calculateViability", () => {
    // =========================================================================
    // MARKET EXISTS COMPONENT
    // =========================================================================

    test("PASS: No market data reduces score by 15", () => {
      const input = createBaseViabilityInput({
        marketDiscovery: createDefaultMarketDiscoveryState(), // empty
      });
      const result = calculateViability(input);

      expect(result.components.marketExists).toBe(
        VIABILITY_WEIGHTS.marketExists - 15,
      );
    });

    test("PASS: No market data creates too_vague risk", () => {
      const input = createBaseViabilityInput();
      const result = calculateViability(input);

      expect(result.risks.some((r) => r.riskType === "too_vague")).toBe(true);
    });

    test("PASS: Failed attempts without differentiation creates wrong_timing risk", () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.failedAttempts = [
        {
          what: "Similar startup",
          why: "No market fit",
          lesson: "Timing was wrong",
          source: "postmortem.com",
        },
      ];
      marketDiscovery.gaps = []; // No differentiation

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      expect(result.risks.some((r) => r.riskType === "wrong_timing")).toBe(
        true,
      );
    });

    test("PASS: Failed attempts WITH differentiation does not create risk", () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.failedAttempts = [
        {
          what: "Similar startup",
          why: "No market fit",
          lesson: "Timing was wrong",
          source: "url",
        },
      ];
      marketDiscovery.gaps = [
        {
          description: "Clear differentiation",
          evidence: "research",
          relevance: "high",
        },
      ];

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      expect(
        result.risks.filter((r) => r.riskType === "wrong_timing").length,
      ).toBe(0);
    });

    // =========================================================================
    // TECHNICAL FEASIBILITY COMPONENT
    // =========================================================================

    test('PASS: "impossible" in search results triggers critical risk', () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: "Analysis",
          url: "http://example.com",
          snippet: "This technology is impossible with current methods",
          source: "Expert",
        },
      ];

      const input = createBaseViabilityInput({ webSearchResults });
      const result = calculateViability(input);

      expect(result.risks.some((r) => r.riskType === "impossible")).toBe(true);
      expect(result.risks.some((r) => r.severity === "critical")).toBe(true);
    });

    test('PASS: "does not exist" triggers impossible risk', () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: "Tech Review",
          url: "http://example.com",
          snippet: "The required technology does not exist yet",
          source: "TechReview",
        },
      ];

      const input = createBaseViabilityInput({ webSearchResults });
      const result = calculateViability(input);

      expect(result.risks.some((r) => r.riskType === "impossible")).toBe(true);
    });

    test('PASS: "years away" triggers impossible risk', () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: "Future Tech",
          url: "http://example.com",
          snippet: "This capability is still years away from being practical",
          source: "FutureTech",
        },
      ];

      const input = createBaseViabilityInput({ webSearchResults });
      const result = calculateViability(input);

      expect(result.risks.some((r) => r.riskType === "impossible")).toBe(true);
    });

    test("PASS: Multiple skill gaps (>2) reduce feasibility and create risk", () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.skills.gaps = ["gap1", "gap2", "gap3"];

      const input = createBaseViabilityInput({ selfDiscovery });
      const result = calculateViability(input);

      expect(result.components.technicalFeasibility).toBeLessThan(
        VIABILITY_WEIGHTS.technicalFeasibility,
      );
      expect(result.risks.some((r) => r.riskType === "resource_mismatch")).toBe(
        true,
      );
    });

    test("PASS: Two or fewer skill gaps does not reduce feasibility", () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.skills.gaps = ["gap1", "gap2"];

      const input = createBaseViabilityInput({ selfDiscovery });
      const result = calculateViability(input);

      // Should not have resource_mismatch from skills
      const skillRisks = result.risks.filter(
        (r) =>
          r.riskType === "resource_mismatch" &&
          r.description.includes("skill gaps"),
      );
      expect(skillRisks.length).toBe(0);
    });

    // =========================================================================
    // COMPETITIVE SPACE COMPONENT
    // =========================================================================

    test("PASS: 10+ competitors triggers saturated_market risk with high severity", () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = Array.from({ length: 12 }, (_, i) => ({
        name: `Competitor ${i}`,
        description: "Desc",
        strengths: [],
        weaknesses: [],
        source: "url",
      }));

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      expect(
        result.risks.some(
          (r) => r.riskType === "saturated_market" && r.severity === "high",
        ),
      ).toBe(true);
    });

    test("PASS: 5-10 competitors without gaps triggers medium severity risk", () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = Array.from({ length: 7 }, (_, i) => ({
        name: `Competitor ${i}`,
        description: "Desc",
        strengths: [],
        weaknesses: [],
        source: "url",
      }));
      marketDiscovery.gaps = []; // No gaps

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      expect(
        result.risks.some(
          (r) => r.riskType === "saturated_market" && r.severity === "medium",
        ),
      ).toBe(true);
    });

    test("PASS: 5-10 competitors WITH high-relevance gaps does not trigger risk", () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = Array.from({ length: 7 }, (_, i) => ({
        name: `Competitor ${i}`,
        description: "Desc",
        strengths: [],
        weaknesses: [],
        source: "url",
      }));
      marketDiscovery.gaps = [
        {
          description: "Clear differentiation",
          evidence: "research",
          relevance: "high",
        },
      ];

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      // Should not have saturated_market risk
      expect(
        result.risks.filter((r) => r.riskType === "saturated_market").length,
      ).toBe(0);
    });

    // =========================================================================
    // RESOURCE REALITY COMPONENT
    // =========================================================================

    test("PASS: Bootstrap user with high capital requirements = unrealistic risk", () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.constraints.capital = "bootstrap";

      const webSearchResults: WebSearchResult[] = [
        {
          title: "Startup Guide",
          url: "http://example.com",
          snippet: "Typically requires $5 million in funding to compete",
          source: "VentureBeat",
        },
      ];

      const input = createBaseViabilityInput({
        selfDiscovery,
        webSearchResults,
      });
      const result = calculateViability(input);

      expect(result.risks.some((r) => r.riskType === "unrealistic")).toBe(true);
    });

    test("PASS: Seeking funding with high capital requirements does NOT trigger risk", () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.constraints.capital = "seeking_funding";

      const webSearchResults: WebSearchResult[] = [
        {
          title: "Startup Guide",
          url: "http://example.com",
          snippet: "Typically requires million dollar funding rounds",
          source: "VentureBeat",
        },
      ];

      const input = createBaseViabilityInput({
        selfDiscovery,
        webSearchResults,
      });
      const result = calculateViability(input);

      expect(
        result.risks.filter((r) => r.riskType === "unrealistic").length,
      ).toBe(0);
    });

    test("PASS: Low time + high complexity = resource_mismatch", () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.constraints.timeHoursPerWeek = 5;

      const narrowingState = createDefaultNarrowingState();
      narrowingState.technicalDepth = { value: "full_custom", confidence: 0.9 };

      const input = createBaseViabilityInput({ selfDiscovery, narrowingState });
      const result = calculateViability(input);

      expect(
        result.risks.some(
          (r) =>
            r.riskType === "resource_mismatch" &&
            r.description.includes("time"),
        ),
      ).toBe(true);
    });

    test("PASS: Adequate time + high complexity does NOT trigger time risk", () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.constraints.timeHoursPerWeek = 30;

      const narrowingState = createDefaultNarrowingState();
      narrowingState.technicalDepth = { value: "full_custom", confidence: 0.9 };

      const input = createBaseViabilityInput({ selfDiscovery, narrowingState });
      const result = calculateViability(input);

      expect(
        result.risks.filter(
          (r) =>
            r.riskType === "resource_mismatch" &&
            r.description.includes("time"),
        ).length,
      ).toBe(0);
    });

    // =========================================================================
    // CLARITY SCORE COMPONENT
    // =========================================================================

    test("PASS: No customer type reduces clarity and creates too_vague risk", () => {
      const input = createBaseViabilityInput();
      const result = calculateViability(input);

      expect(result.components.clarityScore).toBeLessThan(
        VIABILITY_WEIGHTS.clarityScore,
      );
      expect(
        result.risks.some(
          (r) =>
            r.riskType === "too_vague" && r.description.includes("customer"),
        ),
      ).toBe(true);
    });

    test("PASS: No product type reduces clarity by 5", () => {
      const narrowingState = createDefaultNarrowingState();
      narrowingState.customerType = { value: "B2B", confidence: 0.8 }; // Set customer
      // productType still null

      const input = createBaseViabilityInput({ narrowingState });
      const result = calculateViability(input);

      expect(result.components.clarityScore).toBe(
        VIABILITY_WEIGHTS.clarityScore - 5,
      );
    });

    // =========================================================================
    // INTERVENTION TRIGGERS
    // =========================================================================

    test("PASS: Viability < 50 requires intervention", () => {
      const input = createLowViabilityInput();
      const result = calculateViability(input);

      expect(result.total).toBeLessThan(50);
      expect(result.requiresIntervention).toBe(true);
    });

    test("PASS: Critical risk requires intervention regardless of score", () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: "Analysis",
          url: "http://example.com",
          snippet: "This is technically impossible today",
          source: "Expert",
        },
      ];

      // Add some positive signals to boost score
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = [
        {
          name: "A",
          description: "d",
          strengths: [],
          weaknesses: [],
          source: "url",
        },
      ];
      marketDiscovery.gaps = [
        { description: "gap", evidence: "e", relevance: "high" },
      ];

      const narrowingState = createDefaultNarrowingState();
      narrowingState.customerType = { value: "B2B", confidence: 0.9 };
      narrowingState.productType = { value: "Digital", confidence: 0.8 };

      const input = createBaseViabilityInput({
        webSearchResults,
        marketDiscovery,
        narrowingState,
      });
      const result = calculateViability(input);

      expect(result.requiresIntervention).toBe(true);
    });

    test("PASS: Healthy viability (>=75) does not require intervention", () => {
      const input = createHealthyViabilityInput();
      const result = calculateViability(input);

      expect(result.total).toBeGreaterThanOrEqual(75);
      expect(result.requiresIntervention).toBe(false);
    });

    // =========================================================================
    // TOTAL SCORE
    // =========================================================================

    test("PASS: Healthy input starts at 100 and stays high", () => {
      const input = createHealthyViabilityInput();
      const result = calculateViability(input);

      expect(result.total).toBeGreaterThanOrEqual(VIABILITY_THRESHOLDS.healthy);
    });

    test("PASS: Components never go below 0", () => {
      const input = createLowViabilityInput();
      const result = calculateViability(input);

      expect(result.components.marketExists).toBeGreaterThanOrEqual(0);
      expect(result.components.technicalFeasibility).toBeGreaterThanOrEqual(0);
      expect(result.components.competitiveSpace).toBeGreaterThanOrEqual(0);
      expect(result.components.resourceReality).toBeGreaterThanOrEqual(0);
      expect(result.components.clarityScore).toBeGreaterThanOrEqual(0);
    });

    test("PASS: Total is sum of all components", () => {
      const input = createBaseViabilityInput();
      const result = calculateViability(input);

      const sum =
        result.components.marketExists +
        result.components.technicalFeasibility +
        result.components.competitiveSpace +
        result.components.resourceReality +
        result.components.clarityScore;

      expect(result.total).toBe(sum);
    });

    test("PASS: Risks include evidence URLs when available", () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: "Analysis",
          url: "http://example.com/evidence",
          snippet: "This is impossible",
          source: "Expert",
        },
      ];

      const input = createBaseViabilityInput({ webSearchResults });
      const result = calculateViability(input);

      const riskWithUrl = result.risks.find((r) => r.evidenceUrl !== null);
      expect(riskWithUrl).toBeDefined();
      expect(riskWithUrl?.evidenceUrl).toBe("http://example.com/evidence");
    });
  });

  describe("getViabilityStatus", () => {
    test("PASS: Returns healthy for >= 75", () => {
      expect(getViabilityStatus(75)).toBe("healthy");
      expect(getViabilityStatus(100)).toBe("healthy");
    });

    test("PASS: Returns caution for 50-74", () => {
      expect(getViabilityStatus(50)).toBe("caution");
      expect(getViabilityStatus(74)).toBe("caution");
    });

    test("PASS: Returns warning for 25-49", () => {
      expect(getViabilityStatus(25)).toBe("warning");
      expect(getViabilityStatus(49)).toBe("warning");
    });

    test("PASS: Returns critical for 0-24", () => {
      expect(getViabilityStatus(0)).toBe("critical");
      expect(getViabilityStatus(24)).toBe("critical");
    });
  });

  describe("needsIntervention", () => {
    test("PASS: Returns true for viability < 50", () => {
      expect(needsIntervention(49, [])).toBe(true);
      expect(needsIntervention(25, [])).toBe(true);
    });

    test("PASS: Returns true for critical risk", () => {
      const criticalRisk = {
        id: "r1",
        candidateId: "c1",
        riskType: "impossible" as const,
        description: "test",
        evidenceUrl: null,
        evidenceText: null,
        severity: "critical" as const,
        userAcknowledged: false,
        userResponse: null,
        createdAt: new Date(),
      };

      expect(needsIntervention(80, [criticalRisk])).toBe(true);
    });

    test("PASS: Returns false for healthy viability with no critical risks", () => {
      const mediumRisk = {
        id: "r1",
        candidateId: "c1",
        riskType: "too_vague" as const,
        description: "test",
        evidenceUrl: null,
        evidenceText: null,
        severity: "medium" as const,
        userAcknowledged: false,
        userResponse: null,
        createdAt: new Date(),
      };

      expect(needsIntervention(80, [mediumRisk])).toBe(false);
    });
  });
});
