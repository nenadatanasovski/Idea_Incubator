/**
 * Brief Parser Tests
 */

import { describe, it, expect } from "vitest";
import { BriefParser as _BriefParser } from "../../agents/specification/brief-parser.js";
import * as fs from "fs";
import * as path from "path";

describe("brief-parser", () => {
  const parser = new BriefParser();

  describe("parse", () => {
    it("should parse brief with all sections", () => {
      const content = `---
id: test-feature
title: Test Feature
complexity: simple
---

# Brief: Test Feature

## Problem

Users cannot do X. This causes Y.

## Solution

Implement Z that allows users to do X.

### Architecture

\`\`\`
User -> API -> Database
\`\`\`

## MVP Scope

**In Scope:**
- Feature A
- Feature B

**Out of Scope:**
- Feature C
- Feature D

## Success Criteria

- [ ] Users can do X
- [ ] Performance < 100ms
`;

      const result = parser.parse(content);

      expect(result.valid).toBe(true);
      expect(result.brief.id).toBe("test-feature");
      expect(result.brief.title).toBe("Test Feature");
      expect(result.brief.complexity).toBe("simple");
      expect(result.brief.problem).toContain("Users cannot do X");
      expect(result.brief.solution).toContain("Implement Z");
      expect(result.brief.mvpScope.inScope).toContain("Feature A");
      expect(result.brief.mvpScope.outOfScope).toContain("Feature C");
      expect(result.brief.successCriteria.length).toBe(2);
    });

    it("should report missing required sections", () => {
      const content = `---
id: incomplete
title: Incomplete Brief
---

# Brief

Just some text without proper sections.
`;

      const result = parser.parse(content);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain("Problem section");
      expect(result.missing).toContain("Solution section");
    });

    it("should report missing frontmatter fields", () => {
      const content = `---
creator: someone
---

## Problem

A problem.

## Solution

A solution.
`;

      const result = parser.parse(content);

      expect(result.missing).toContain("id (in frontmatter)");
      expect(result.missing).toContain("title (in frontmatter)");
    });

    it("should generate questions for ambiguity", () => {
      const content = `---
id: vague
title: Vague Feature
---

## Problem

Problem.

## Solution

Solution.
`;

      const result = parser.parse(content);

      expect(result.questions.length).toBeGreaterThan(0);
      // Should ask about complexity
      expect(
        result.questions.some((q) => q.toLowerCase().includes("complexity")),
      ).toBe(true);
    });

    it("should extract SQL code blocks", () => {
      const content = `---
id: db-feature
title: Database Feature
complexity: medium
---

## Problem

Need data storage.

## Solution

Create database table.

\`\`\`sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
\`\`\`
`;

      const result = parser.parse(content);

      expect(result.brief.databaseSchema).toBeDefined();
      expect(result.brief.databaseSchema).toContain("CREATE TABLE");
    });
  });

  describe("parse real briefs", () => {
    it("should parse simple-counter brief", () => {
      const briefPath = path.join(
        process.cwd(),
        "ideas/vibe/reference/simple-counter/planning/brief.md",
      );

      if (fs.existsSync(briefPath)) {
        const content = fs.readFileSync(briefPath, "utf-8");
        const result = parser.parse(content);

        expect(result.brief.id).toBe("simple-counter");
        expect(result.brief.problem).toBeTruthy();
        expect(result.brief.solution).toBeTruthy();
      }
    });

    it("should parse user-profiles brief", () => {
      const briefPath = path.join(
        process.cwd(),
        "ideas/vibe/reference/user-profiles/planning/brief.md",
      );

      if (fs.existsSync(briefPath)) {
        const content = fs.readFileSync(briefPath, "utf-8");
        const result = parser.parse(content);

        expect(result.brief.id).toBe("user-profiles");
        expect(result.brief.complexity).toBe("medium");
      }
    });

    it("should parse notifications brief", () => {
      const briefPath = path.join(
        process.cwd(),
        "ideas/vibe/reference/notifications/planning/brief.md",
      );

      if (fs.existsSync(briefPath)) {
        const content = fs.readFileSync(briefPath, "utf-8");
        const result = parser.parse(content);

        expect(result.brief.id).toBe("notifications");
        expect(result.brief.complexity).toBe("complex");
      }
    });
  });

  describe("inferComplexity", () => {
    it("should infer simple for small scope", () => {
      const content = `---
id: tiny
title: Tiny Feature
---

## Problem

Small problem.

## Solution

Small solution.

## MVP Scope

### In Scope

- One thing
- Two things
`;

      const result = parser.parse(content);
      expect(result.brief.complexity).toBe("simple");
    });
  });

  describe("validateBrief", () => {
    it("should validate complete brief", () => {
      const brief = {
        id: "test",
        title: "Test",
        complexity: "simple" as const,
        problem: "A problem",
        solution: "A solution",
        mvpScope: { inScope: [], outOfScope: [] },
        constraints: [],
        successCriteria: [],
        rawContent: "",
      };

      const result = parser.validateBrief(brief);
      expect(result.valid).toBe(true);
    });

    it("should reject incomplete brief", () => {
      const brief = {
        id: "unknown",
        title: "Untitled",
        complexity: "simple" as const,
        problem: "",
        solution: "",
        mvpScope: { inScope: [], outOfScope: [] },
        constraints: [],
        successCriteria: [],
        rawContent: "",
      };

      const result = parser.validateBrief(brief);
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });

  describe("getExpectedTaskCount", () => {
    it("should return correct ranges", () => {
      expect(parser.getExpectedTaskCount("simple")).toEqual({ min: 5, max: 8 });
      expect(parser.getExpectedTaskCount("medium")).toEqual({
        min: 10,
        max: 15,
      });
      expect(parser.getExpectedTaskCount("complex")).toEqual({
        min: 20,
        max: 30,
      });
    });
  });
});
