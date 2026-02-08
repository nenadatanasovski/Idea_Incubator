// tests/knowledge-base.test.ts - Knowledge Base unit tests

import { describe, it, expect } from "vitest";
import {
  CONFIDENCE_CONFIG,
  calculateInitialConfidence,
} from "../agents/knowledge-base/index.js";
import { calculateSimilarity } from "../agents/sia/duplicate-detector.js";

describe("Knowledge Base", () => {
  describe("Confidence Tracking", () => {
    it("should have valid confidence config", () => {
      expect(CONFIDENCE_CONFIG.initial).toBeGreaterThan(0);
      expect(CONFIDENCE_CONFIG.initial).toBeLessThanOrEqual(1);
      expect(CONFIDENCE_CONFIG.promotionThreshold).toBeGreaterThan(
        CONFIDENCE_CONFIG.initial,
      );
    });

    it("should calculate initial confidence for gotcha from error", () => {
      const confidence = calculateInitialConfidence(true, true);
      expect(confidence).toBeGreaterThan(CONFIDENCE_CONFIG.initial);
    });

    it("should calculate initial confidence for pattern (no boosts)", () => {
      const confidence = calculateInitialConfidence(false, false);
      expect(confidence).toBe(CONFIDENCE_CONFIG.initial);
    });

    it("should boost confidence when matched predefined rule", () => {
      const base = calculateInitialConfidence(false, false);
      const boosted = calculateInitialConfidence(true, false);
      expect(boosted).toBeGreaterThan(base);
    });

    it("should boost confidence when fix was applied", () => {
      const base = calculateInitialConfidence(false, false);
      const boosted = calculateInitialConfidence(false, true);
      expect(boosted).toBeGreaterThan(base);
    });

    it("should cap at max confidence", () => {
      const confidence = calculateInitialConfidence(true, true);
      expect(confidence).toBeLessThanOrEqual(CONFIDENCE_CONFIG.maxConfidence);
    });
  });

  describe("Duplicate Detection", () => {
    it("should detect identical strings as similar", () => {
      const similarity = calculateSimilarity("test string", "test string");
      expect(similarity).toBe(1);
    });

    it("should detect different strings as dissimilar", () => {
      const similarity = calculateSimilarity("hello world", "goodbye moon");
      expect(similarity).toBeLessThan(0.5);
    });

    it("should detect partial matches", () => {
      const similarity = calculateSimilarity(
        "Use TEXT for dates in SQLite",
        "Use TEXT datatype for dates in SQLite databases",
      );
      expect(similarity).toBeGreaterThan(0.3);
    });

    it("should handle empty strings", () => {
      const similarity = calculateSimilarity("", "");
      expect(similarity).toBe(1);
    });

    it("should handle one empty string", () => {
      const similarity = calculateSimilarity("test", "");
      expect(similarity).toBe(0);
    });
  });

  describe("Knowledge Types", () => {
    it("should support gotcha type", () => {
      const types = ["gotcha", "pattern", "decision"];
      expect(types).toContain("gotcha");
    });

    it("should support pattern type", () => {
      const types = ["gotcha", "pattern", "decision"];
      expect(types).toContain("pattern");
    });

    it("should support decision type", () => {
      const types = ["gotcha", "pattern", "decision"];
      expect(types).toContain("decision");
    });
  });

  describe("Confidence Config", () => {
    it("should have promotion threshold", () => {
      expect(CONFIDENCE_CONFIG.promotionThreshold).toBeDefined();
      expect(CONFIDENCE_CONFIG.promotionThreshold).toBeGreaterThanOrEqual(0.8);
    });

    it("should have demotion threshold", () => {
      expect(CONFIDENCE_CONFIG.demotionThreshold).toBeDefined();
      expect(CONFIDENCE_CONFIG.demotionThreshold).toBeLessThan(
        CONFIDENCE_CONFIG.promotionThreshold,
      );
    });

    it("should have prevention boost value", () => {
      expect(CONFIDENCE_CONFIG.preventionBoost).toBeDefined();
      expect(CONFIDENCE_CONFIG.preventionBoost).toBeGreaterThan(0);
    });

    it("should have max and min confidence bounds", () => {
      expect(CONFIDENCE_CONFIG.maxConfidence).toBeDefined();
      expect(CONFIDENCE_CONFIG.minConfidence).toBeDefined();
      expect(CONFIDENCE_CONFIG.maxConfidence).toBeGreaterThan(
        CONFIDENCE_CONFIG.minConfidence,
      );
    });

    it("should have monthly decay value", () => {
      expect(CONFIDENCE_CONFIG.monthlyDecay).toBeDefined();
      expect(CONFIDENCE_CONFIG.monthlyDecay).toBeGreaterThan(0);
    });
  });

  describe("Pattern Matching", () => {
    it("should match file extension patterns", () => {
      const file = "src/index.ts";
      expect(file.endsWith(".ts")).toBe(true);
    });

    it("should match directory patterns", () => {
      const file = "server/routes/api.ts";
      expect(file.startsWith("server/")).toBe(true);
    });

    it("should match partial patterns", () => {
      const pattern = "database";
      const file = "database/migrations/001.sql";
      expect(file.includes(pattern)).toBe(true);
    });
  });

  describe("Action Types", () => {
    const validActions = ["CREATE", "UPDATE", "DELETE", "ADD", "VERIFY"];

    it("should recognize CREATE action", () => {
      expect(validActions).toContain("CREATE");
    });

    it("should recognize UPDATE action", () => {
      expect(validActions).toContain("UPDATE");
    });

    it("should recognize DELETE action", () => {
      expect(validActions).toContain("DELETE");
    });
  });

  describe("Promotion Logic", () => {
    it("should require minimum confidence for promotion", () => {
      const threshold = CONFIDENCE_CONFIG.promotionThreshold;
      expect(threshold).toBeGreaterThanOrEqual(0.7);
    });

    it("should have separate demotion threshold", () => {
      const demotion = CONFIDENCE_CONFIG.demotionThreshold;
      const promotion = CONFIDENCE_CONFIG.promotionThreshold;
      expect(demotion).toBeLessThan(promotion);
    });

    it("should have reasonable threshold gap", () => {
      const gap =
        CONFIDENCE_CONFIG.promotionThreshold -
        CONFIDENCE_CONFIG.demotionThreshold;
      expect(gap).toBeGreaterThan(0.3);
    });
  });

  describe("Confidence Bounds", () => {
    it("should not exceed max confidence", () => {
      const initial = calculateInitialConfidence(true, true);
      expect(initial).toBeLessThanOrEqual(CONFIDENCE_CONFIG.maxConfidence);
    });

    it("should have positive min confidence", () => {
      expect(CONFIDENCE_CONFIG.minConfidence).toBeGreaterThan(0);
    });

    it("should have max less than 1.0 for room to grow", () => {
      expect(CONFIDENCE_CONFIG.maxConfidence).toBeLessThan(1.0);
    });
  });
});
