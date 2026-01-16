/**
 * Context Loader Tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  ContextLoader,
  LoadedContext,
  Gotcha as _Gotcha,
} from "../../agents/specification/context-loader.js";
import * as path from "path";

describe("context-loader", () => {
  let loader: ContextLoader;
  const projectRoot = process.cwd();

  beforeAll(() => {
    loader = new ContextLoader(projectRoot);
  });

  describe("loadClaude", () => {
    it("should load CLAUDE.md from project root", async () => {
      const claude = await loader.loadClaude();
      expect(claude).toBeDefined();
      expect(claude.length).toBeGreaterThan(0);
      expect(claude).toContain("Idea Incubator");
    });
  });

  describe("loadTemplates", () => {
    it("should load spec.md and tasks.md templates", async () => {
      const templates = await loader.loadTemplates();
      expect(templates).toBeDefined();
      expect(templates["spec.md"]).toBeDefined();
      expect(templates["tasks.md"]).toBeDefined();
    });

    it("should contain template markers", async () => {
      const templates = await loader.loadTemplates();
      expect(templates["spec.md"]).toContain("{{");
      expect(templates["tasks.md"]).toContain("{{");
    });
  });

  describe("loadGotchas", () => {
    it("should return hardcoded gotchas", async () => {
      const gotchas = await loader.loadGotchas();
      expect(gotchas).toBeDefined();
      expect(gotchas.length).toBeGreaterThan(0);
    });

    it("should have required gotcha fields", async () => {
      const gotchas = await loader.loadGotchas();
      for (const gotcha of gotchas) {
        expect(gotcha.id).toBeDefined();
        expect(gotcha.content).toBeDefined();
        expect(gotcha.filePattern).toBeDefined();
        expect(gotcha.actionType).toBeDefined();
        expect(gotcha.confidence).toMatch(/^(high|medium|low)$/);
        expect(gotcha.source).toMatch(/^(knowledge_base|experience)$/);
      }
    });

    it("should include SQLite timestamp gotcha", async () => {
      const gotchas = await loader.loadGotchas();
      const sqliteGotcha = gotchas.find(
        (g) => g.content.includes("TEXT") && g.content.includes("timestamp"),
      );
      expect(sqliteGotcha).toBeDefined();
    });
  });

  describe("getRelevantGotchas", () => {
    it("should filter gotchas by file pattern", () => {
      const sqlGotchas = loader.getRelevantGotchas(
        "migrations/001.sql",
        "CREATE",
      );
      expect(sqlGotchas.length).toBeGreaterThan(0);
      expect(sqlGotchas.every((g) => g.filePattern.includes("sql"))).toBe(true);
    });

    it("should filter gotchas by action type", () => {
      const createGotchas = loader.getRelevantGotchas("test.sql", "CREATE");
      const updateGotchas = loader.getRelevantGotchas(
        "database/db.ts",
        "UPDATE",
      );
      expect(createGotchas.length).toBeGreaterThan(0);
      expect(updateGotchas.length).toBeGreaterThan(0);
    });
  });

  describe("load", () => {
    it("should load complete context", async () => {
      const context = await loader.load();
      expect(context.claude).toBeDefined();
      expect(context.templates).toBeDefined();
      expect(context.gotchas).toBeDefined();
      expect(context.tokenEstimate).toBeGreaterThan(0);
    });

    it("should load idea context when slug provided", async () => {
      // Use one of the reference ideas we created
      const context = await loader.load("vibe/reference/simple-counter");
      expect(context.ideaBrief).toBeDefined();
    });

    it("should estimate tokens correctly", async () => {
      const context = await loader.load();
      // Token estimate should be roughly content length / 4
      const totalLength =
        context.claude.length +
        Object.values(context.templates).join("").length +
        context.gotchas.map((g) => g.content).join("").length;
      const expectedEstimate = Math.ceil(totalLength / 4);
      expect(context.tokenEstimate).toBeCloseTo(expectedEstimate, -2); // Within 100
    });
  });

  describe("isWithinLimits", () => {
    it("should return true for normal context", async () => {
      const context = await loader.load();
      expect(loader.isWithinLimits(context)).toBe(true);
    });

    it("should return false for oversized context", () => {
      const oversizedContext: LoadedContext = {
        claude: "x".repeat(200000),
        templates: {},
        gotchas: [],
        tokenEstimate: 60000, // Over 50k limit
      };
      expect(loader.isWithinLimits(oversizedContext)).toBe(false);
    });
  });

  describe("assembleContext", () => {
    it("should create formatted context string", async () => {
      const context = await loader.load();
      const assembled = loader.assembleContext(context);

      expect(assembled).toContain("## Project Conventions");
      expect(assembled).toContain("## Known Gotchas");
      expect(assembled).toContain("---");
    });

    it("should include idea context when available", async () => {
      const context = await loader.load("vibe/reference/simple-counter");
      const assembled = loader.assembleContext(context);

      if (context.ideaBrief) {
        expect(assembled).toContain("## Feature Brief");
      }
    });
  });
});
