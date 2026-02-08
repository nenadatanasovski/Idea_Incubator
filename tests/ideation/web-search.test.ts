import { describe, test, expect } from "vitest";
import {
  determineSearchStrategy,
  parseSearchResults,
  buildSearchPrompt,
  analyzeSearchResults,
} from "../../agents/ideation/web-search-service.js";

describe("WebSearchService", () => {
  describe("determineSearchStrategy", () => {
    test("PASS: Always includes competitor check", () => {
      const strategy = determineSearchStrategy("AI writing assistant", {});

      expect(strategy.queries.some((q) => q.includes("competitors"))).toBe(
        true,
      );
      expect(strategy.purposes.some((p) => p.type === "competitor_check")).toBe(
        true,
      );
    });

    test("PASS: Always includes market validation", () => {
      const strategy = determineSearchStrategy("AI writing assistant", {});

      expect(strategy.queries.some((q) => q.includes("market size"))).toBe(
        true,
      );
      expect(
        strategy.purposes.some((p) => p.type === "market_validation"),
      ).toBe(true);
    });

    test("PASS: Adds failed attempts for B2C", () => {
      const strategy = determineSearchStrategy("Consumer app", {
        customerType: "B2C",
      });

      expect(strategy.queries.some((q) => q.includes("failed"))).toBe(true);
      expect(strategy.purposes.some((p) => p.type === "failed_attempts")).toBe(
        true,
      );
    });

    test("PASS: Does not add failed attempts for B2B", () => {
      const strategy = determineSearchStrategy("Enterprise tool", {
        customerType: "B2B",
      });

      expect(strategy.purposes.some((p) => p.type === "failed_attempts")).toBe(
        false,
      );
    });

    test("PASS: Adds geography-specific search for local", () => {
      const strategy = determineSearchStrategy("Local service", {
        geography: "local",
      });

      expect(strategy.queries.some((q) => q.includes("australia"))).toBe(true);
    });
  });

  describe("parseSearchResults", () => {
    test("PASS: Extracts markdown links", () => {
      const output =
        "Check out [Example Site](https://example.com) for more info.";
      const results = parseSearchResults(output);

      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Example Site");
      expect(results[0].url).toBe("https://example.com");
    });

    test("PASS: Extracts bare URLs", () => {
      const output = "Visit https://example.com for details.";
      const results = parseSearchResults(output);

      expect(results.length).toBe(1);
      expect(results[0].url).toBe("https://example.com");
    });

    test("PASS: Deduplicates URLs", () => {
      const output =
        "[Site](https://example.com) and https://example.com again";
      const results = parseSearchResults(output);

      expect(results.length).toBe(1);
    });

    test("PASS: Limits to 10 results", () => {
      const output = Array(15)
        .fill(null)
        .map((_, i) => `[Site${i}](https://example${i}.com)`)
        .join(" ");
      const results = parseSearchResults(output);

      expect(results.length).toBeLessThanOrEqual(10);
    });

    test("PASS: Extracts source hostname", () => {
      const output = "[Article](https://www.techcrunch.com/article)";
      const results = parseSearchResults(output);

      expect(results[0].source).toBe("www.techcrunch.com");
    });
  });

  describe("buildSearchPrompt", () => {
    test("PASS: Includes query in prompt", () => {
      const prompt = buildSearchPrompt("AI startups", {
        type: "competitor_check",
        context: "Test context",
      });

      expect(prompt).toContain("AI startups");
    });

    test("PASS: Includes purpose-specific instructions", () => {
      const prompt = buildSearchPrompt("test", {
        type: "competitor_check",
        context: "Test",
      });

      expect(prompt).toContain("competitors");
      expect(prompt).toContain("alternatives");
    });

    test("PASS: Includes context", () => {
      const prompt = buildSearchPrompt("test", {
        type: "general",
        context: "Specific context for this search",
      });

      expect(prompt).toContain("Specific context for this search");
    });

    test("PASS: Market validation includes market size", () => {
      const prompt = buildSearchPrompt("test", {
        type: "market_validation",
        context: "Test",
      });

      expect(prompt).toContain("market");
    });

    test("PASS: Timing signal includes trends", () => {
      const prompt = buildSearchPrompt("test", {
        type: "timing_signal",
        context: "Test",
      });

      expect(prompt).toContain("timing");
    });

    test("PASS: Failed attempts includes post-mortems", () => {
      const prompt = buildSearchPrompt("test", {
        type: "failed_attempts",
        context: "Test",
      });

      expect(prompt).toContain("failed");
    });
  });

  describe("analyzeSearchResults", () => {
    test("PASS: Counts competitors", () => {
      const result = analyzeSearchResults([
        {
          query: "test",
          results: [
            {
              title: "A",
              url: "a.com",
              snippet: "Competitor",
              source: "a.com",
            },
          ],
          synthesis: "",
          timestamp: "",
        },
        {
          query: "test",
          results: [
            {
              title: "B",
              url: "b.com",
              snippet: "Also competitor",
              source: "b.com",
            },
          ],
          synthesis: "",
          timestamp: "",
        },
      ]);

      expect(result.competitors).toBe(2);
    });

    test("PASS: Identifies concerns from failed attempts", () => {
      const result = analyzeSearchResults([
        {
          query: "test",
          results: [
            {
              title: "Failed Startup",
              url: "a.com",
              snippet: "Company X failed and shutdown due to",
              source: "a.com",
            },
          ],
          synthesis: "",
          timestamp: "",
        },
      ]);

      expect(result.concerns.length).toBeGreaterThan(0);
    });

    test("PASS: Identifies opportunities from growth signals", () => {
      const result = analyzeSearchResults([
        {
          query: "test",
          results: [
            {
              title: "Growth",
              url: "a.com",
              snippet: "emerging market with opportunity",
              source: "a.com",
            },
          ],
          synthesis: "",
          timestamp: "",
        },
      ]);

      expect(result.opportunities.length).toBeGreaterThan(0);
    });

    test("PASS: Returns empty arrays for no signals", () => {
      const result = analyzeSearchResults([
        {
          query: "test",
          results: [
            {
              title: "Neutral",
              url: "a.com",
              snippet: "Just some text",
              source: "a.com",
            },
          ],
          synthesis: "",
          timestamp: "",
        },
      ]);

      expect(result.concerns.length).toBe(0);
      expect(result.opportunities.length).toBe(0);
    });
  });
});
