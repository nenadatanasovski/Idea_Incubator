/**
 * Template Renderer Tests
 */

import { describe, it, expect, beforeAll as _beforeAll } from "vitest";
import { TemplateRenderer } from "../../agents/specification/template-renderer.js";
import * as path from "path";

describe("template-renderer", () => {
  describe("render", () => {
    it("should render simple placeholders", () => {
      const template = `---
id: "{{id}}"
title: "{{title}}"
---

# {{title}}

## Overview

This is {{description}}.
`;

      const renderer = new TemplateRenderer(template);
      const result = renderer.render({
        id: "test-id",
        title: "Test Title",
        description: "a test feature",
      });

      expect(result.content).toContain('id: "test-id"');
      expect(result.content).toContain('title: "Test Title"');
      expect(result.content).toContain("# Test Title");
      expect(result.content).toContain("This is a test feature.");
    });

    it("should render nested placeholders", () => {
      const template = `---
id: "{{meta.id}}"
---

Author: {{author.name}}
`;

      const renderer = new TemplateRenderer(template);
      const result = renderer.render({
        meta: { id: "nested-id" },
        author: { name: "John Doe" },
      });

      expect(result.content).toContain('id: "nested-id"');
      expect(result.content).toContain("Author: John Doe");
    });

    it("should keep unfilled placeholders", () => {
      const template = `Hello {{name}}, welcome to {{place}}!`;

      const renderer = new TemplateRenderer(template);
      const result = renderer.render({ name: "World" });

      expect(result.content).toContain("Hello World");
      expect(result.content).toContain("{{place}}");
      expect(result.warnings).toContain("Unfilled placeholder: {{place}}");
    });

    it("should handle arrays as newline-separated values", () => {
      const template = `Items:\n{{items}}`;

      const renderer = new TemplateRenderer(template);
      const result = renderer.render({
        items: ["one", "two", "three"],
      });

      expect(result.content).toContain("one\ntwo\nthree");
    });
  });

  describe("validate", () => {
    it("should validate spec with all required sections", () => {
      const specContent = `---
id: "test"
title: "Test"
---

# Test

## Overview

Test overview.

## Functional Requirements

Requirements here.

## Architecture

Architecture here.

## API Design

API here.

## Data Models

Models here.

## Known Gotchas

Gotchas here.

## Validation Strategy

Validation here.
`;

      const renderer = new TemplateRenderer(specContent);
      const result = renderer.validate(specContent);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should report missing required sections", () => {
      const incompleteSpec = `---
id: "test"
title: "Test"
---

# Test

## Overview

Just an overview.
`;

      const renderer = new TemplateRenderer(incompleteSpec);
      const result = renderer.validate(incompleteSpec);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.includes("Functional Requirements")),
      ).toBe(true);
    });

    it("should report invalid YAML frontmatter", () => {
      const invalidYaml = `---
id: "test
title: broken
---

# Test
`;

      const renderer = new TemplateRenderer(invalidYaml);
      const result = renderer.validate(invalidYaml);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid YAML"))).toBe(true);
    });

    it("should report missing frontmatter fields", () => {
      const missingFields = `---
status: "draft"
---

# Test

## Overview

Test.
`;

      const renderer = new TemplateRenderer(missingFields);
      const result = renderer.validate(missingFields);

      expect(result.errors.some((e) => e.includes("id"))).toBe(true);
      expect(result.errors.some((e) => e.includes("title"))).toBe(true);
    });
  });

  describe("loadTemplate", () => {
    it("should load spec template from file", async () => {
      const renderer = new TemplateRenderer();
      const templatePath = path.join(
        process.cwd(),
        "templates",
        "unified",
        "build",
        "spec.md",
      );

      await renderer.loadTemplate(templatePath);
      expect(renderer.getTemplateType()).toBe("spec");
    });

    it("should load tasks template from file", async () => {
      const renderer = new TemplateRenderer();
      const templatePath = path.join(
        process.cwd(),
        "templates",
        "unified",
        "build",
        "tasks.md",
      );

      await renderer.loadTemplate(templatePath);
      expect(renderer.getTemplateType()).toBe("tasks");
    });

    it("should throw for missing template", async () => {
      const renderer = new TemplateRenderer();
      await expect(
        renderer.loadTemplate("/nonexistent/path.md"),
      ).rejects.toThrow("Template not found");
    });
  });

  describe("detectTemplateType", () => {
    it("should detect spec template", () => {
      const specTemplate = `---
id: "test"
---

## Overview

## Architecture
`;
      const renderer = new TemplateRenderer(specTemplate);
      expect(renderer.getTemplateType()).toBe("spec");
    });

    it("should detect tasks template", () => {
      const tasksTemplate = `---
id: "test"
total_tasks: 5
---

## Phase 1: Database
`;
      const renderer = new TemplateRenderer(tasksTemplate);
      expect(renderer.getTemplateType()).toBe("tasks");
    });
  });

  describe("isValidYaml", () => {
    it("should return true for valid YAML", () => {
      const renderer = new TemplateRenderer();
      expect(renderer.isValidYaml("key: value\narray:\n  - one\n  - two")).toBe(
        true,
      );
    });

    it("should return false for invalid YAML", () => {
      const renderer = new TemplateRenderer();
      expect(renderer.isValidYaml('key: "unclosed')).toBe(false);
    });
  });
});
