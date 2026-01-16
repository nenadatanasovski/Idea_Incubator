/**
 * Tests for Phase 7: Config Additions
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getConfig,
  updateConfig,
  resetConfig,
  defaultConfig,
} from "../../../config/index.js";

describe("Phase 7 Config", () => {
  beforeEach(() => {
    resetConfig();
  });

  describe("Evaluator Mode", () => {
    it("should have evaluatorMode in default config", () => {
      expect(defaultConfig.evaluatorMode).toBeDefined();
    });

    it("should default to v2 (parallel specialists)", () => {
      const config = getConfig();
      expect(config.evaluatorMode).toBe("v2");
    });

    it("should allow switching to v1 (sequential generalist)", () => {
      updateConfig({ evaluatorMode: "v1" as const });
      const config = getConfig();
      expect(config.evaluatorMode).toBe("v1");
    });

    it("should persist mode changes", () => {
      updateConfig({ evaluatorMode: "v1" as const });
      expect(getConfig().evaluatorMode).toBe("v1");

      updateConfig({ evaluatorMode: "v2" as const });
      expect(getConfig().evaluatorMode).toBe("v2");
    });
  });

  describe("Red Team Mode", () => {
    it("should have redTeamMode in default config", () => {
      expect(defaultConfig.redTeamMode).toBeDefined();
    });

    it("should default to extended (6 personas)", () => {
      const config = getConfig();
      expect(config.redTeamMode).toBe("extended");
    });

    it("should allow switching to core (3 personas)", () => {
      updateConfig({ redTeamMode: "core" as const });
      const config = getConfig();
      expect(config.redTeamMode).toBe("core");
    });

    it("should persist mode changes", () => {
      updateConfig({ redTeamMode: "core" as const });
      expect(getConfig().redTeamMode).toBe("core");

      updateConfig({ redTeamMode: "extended" as const });
      expect(getConfig().redTeamMode).toBe("extended");
    });
  });

  describe("Config Reset", () => {
    it("should reset evaluatorMode to v2", () => {
      updateConfig({ evaluatorMode: "v1" as const });
      resetConfig();
      expect(getConfig().evaluatorMode).toBe("v2");
    });

    it("should reset redTeamMode to extended", () => {
      updateConfig({ redTeamMode: "core" as const });
      resetConfig();
      expect(getConfig().redTeamMode).toBe("extended");
    });
  });

  describe("Combined Mode Updates", () => {
    it("should allow updating both modes at once", () => {
      updateConfig({
        evaluatorMode: "v1" as const,
        redTeamMode: "core" as const,
      });

      const config = getConfig();
      expect(config.evaluatorMode).toBe("v1");
      expect(config.redTeamMode).toBe("core");
    });

    it("should preserve other config when updating modes", () => {
      const originalBudget = getConfig().budget;

      updateConfig({
        evaluatorMode: "v1" as const,
        redTeamMode: "core" as const,
      });

      const config = getConfig();
      expect(config.budget).toEqual(originalBudget);
    });
  });
});
