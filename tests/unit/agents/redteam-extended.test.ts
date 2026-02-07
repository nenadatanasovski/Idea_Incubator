/**
 * Tests for Phase 7: Extended Red Team Personas
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  CORE_PERSONAS,
  EXTENDED_PERSONAS,
  ALL_PERSONAS,
  PERSONAS,
  PERSONA_DEFINITIONS,
  getActivePersonas,
} from "../../../agents/redteam.js";
import { getConfig, updateConfig, resetConfig } from "../../../config/index.js";

describe("Extended Red Team Personas", () => {
  beforeEach(() => {
    resetConfig();
  });

  describe("Persona Types", () => {
    it("should have 3 core personas", () => {
      expect(CORE_PERSONAS).toHaveLength(3);
      expect(CORE_PERSONAS).toContain("skeptic");
      expect(CORE_PERSONAS).toContain("realist");
      expect(CORE_PERSONAS).toContain("first-principles");
    });

    it("should have 3 extended personas", () => {
      expect(EXTENDED_PERSONAS).toHaveLength(3);
      expect(EXTENDED_PERSONAS).toContain("competitor");
      expect(EXTENDED_PERSONAS).toContain("contrarian");
      expect(EXTENDED_PERSONAS).toContain("edge-case");
    });

    it("should have 6 total personas in ALL_PERSONAS", () => {
      expect(ALL_PERSONAS).toHaveLength(6);
    });

    it("should have PERSONAS equal to ALL_PERSONAS", () => {
      expect(PERSONAS).toEqual(ALL_PERSONAS);
    });
  });

  describe("Persona Definitions", () => {
    it("should have definitions for all 6 personas", () => {
      expect(Object.keys(PERSONA_DEFINITIONS)).toHaveLength(6);
    });

    it("should have definitions for core personas", () => {
      for (const persona of CORE_PERSONAS) {
        expect(PERSONA_DEFINITIONS[persona]).toBeDefined();
      }
    });

    it("should have definitions for extended personas", () => {
      for (const persona of EXTENDED_PERSONAS) {
        expect(PERSONA_DEFINITIONS[persona]).toBeDefined();
      }
    });

    it("should have required properties for each persona", () => {
      for (const [id, def] of Object.entries(PERSONA_DEFINITIONS)) {
        expect(def.id).toBe(id);
        expect(def.name).toBeDefined();
        expect(def.role).toBeDefined();
        expect(def.systemPrompt).toBeDefined();
        expect(def.challengeStyle).toBeDefined();
      }
    });
  });

  describe("Extended Persona: Competitor", () => {
    it("should have correct properties", () => {
      const competitor = PERSONA_DEFINITIONS["competitor"];
      expect(competitor.id).toBe("competitor");
      expect(competitor.name).toBe("The Competitor Analyst");
      expect(competitor.challengeStyle).toBe("competitive-analysis");
    });

    it("should focus on competitive threats", () => {
      const competitor = PERSONA_DEFINITIONS["competitor"];
      expect(competitor.systemPrompt).toContain("competitive");
      expect(competitor.systemPrompt).toContain("counter-moves");
    });
  });

  describe("Extended Persona: Contrarian", () => {
    it("should have correct properties", () => {
      const contrarian = PERSONA_DEFINITIONS["contrarian"];
      expect(contrarian.id).toBe("contrarian");
      expect(contrarian.name).toBe("The Contrarian");
      expect(contrarian.challengeStyle).toBe("inverse-thinking");
    });

    it("should take opposite viewpoints", () => {
      const contrarian = PERSONA_DEFINITIONS["contrarian"];
      expect(contrarian.systemPrompt).toContain("opposite");
      expect(contrarian.systemPrompt).toContain("agrees on");
    });
  });

  describe("Extended Persona: Edge-Case Finder", () => {
    it("should have correct properties", () => {
      const edgeCase = PERSONA_DEFINITIONS["edge-case"];
      expect(edgeCase.id).toBe("edge-case");
      expect(edgeCase.name).toBe("The Edge-Case Finder");
      expect(edgeCase.challengeStyle).toBe("stress-testing");
    });

    it("should focus on edge cases", () => {
      const edgeCase = PERSONA_DEFINITIONS["edge-case"];
      expect(edgeCase.systemPrompt).toContain("edge");
      expect(edgeCase.systemPrompt).toContain("scenarios");
    });
  });

  describe("getActivePersonas", () => {
    it("should return all 6 personas when mode is extended", () => {
      updateConfig({ redTeamMode: "extended" as const });
      const active = getActivePersonas();
      expect(active).toHaveLength(6);
      expect(active).toEqual(ALL_PERSONAS);
    });

    it("should return only 3 core personas when mode is core", () => {
      updateConfig({ redTeamMode: "core" as const });
      const active = getActivePersonas();
      expect(active).toHaveLength(3);
      expect(active).toEqual(CORE_PERSONAS);
    });
  });

  describe("Config Integration", () => {
    it("should default to extended mode", () => {
      const config = getConfig();
      expect(config.redTeamMode).toBe("extended");
    });

    it("should allow switching to core mode", () => {
      updateConfig({ redTeamMode: "core" as const });
      const config = getConfig();
      expect(config.redTeamMode).toBe("core");
    });
  });
});
