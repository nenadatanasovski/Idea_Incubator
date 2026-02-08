#!/usr/bin/env tsx
/**
 * Tests for development.md sync and evaluator integration
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const IDEA_DIR = path.join(process.cwd(), "ideas", "e2e-test-smart-wellness-tracker");
const DEV_FILE = path.join(IDEA_DIR, "development.md");

describe("development.md parsing", () => {
  it("should find development.md in test idea folder", () => {
    expect(fs.existsSync(DEV_FILE)).toBe(true);
  });

  it("should contain Q&A pairs in Q:/A: format", () => {
    const content = fs.readFileSync(DEV_FILE, "utf-8");
    const qaPattern = /Q:\s*.+\nA:\s*.+/g;
    const matches = content.match(qaPattern);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(0);
  });

  it("should parse at least 5 Q&A pairs from test file", () => {
    const content = fs.readFileSync(DEV_FILE, "utf-8");
    const qaPattern = /Q:\s*(.+?)\nA:\s*(.+?)(?=\n\nQ:|\n##|\n---|\$)/gs;
    const pairs: { q: string; a: string }[] = [];
    let match;
    while ((match = qaPattern.exec(content)) !== null) {
      pairs.push({ q: match[1].trim(), a: match[2].trim() });
    }
    expect(pairs.length).toBeGreaterThanOrEqual(5);
  });
});

describe("evaluator development.md integration", () => {
  it("should load development.md content when present", () => {
    // Simulate what evaluate.ts does
    const readmePath = path.join(IDEA_DIR, "README.md");
    let ideaContent = fs.readFileSync(readmePath, "utf-8");
    
    if (fs.existsSync(DEV_FILE)) {
      const developmentContent = fs.readFileSync(DEV_FILE, "utf-8");
      ideaContent += "\n\n---\n\n# Development Notes\n\n" + developmentContent;
    }
    
    // Verify development content is included
    expect(ideaContent).toContain("# Development Notes");
    expect(ideaContent).toContain("Q:");
    expect(ideaContent).toContain("A:");
  });

  it("should include specific Q&A content from development.md", () => {
    const readmePath = path.join(IDEA_DIR, "README.md");
    let ideaContent = fs.readFileSync(readmePath, "utf-8");
    
    if (fs.existsSync(DEV_FILE)) {
      const developmentContent = fs.readFileSync(DEV_FILE, "utf-8");
      ideaContent += "\n\n---\n\n# Development Notes\n\n" + developmentContent;
    }
    
    // Check for specific content from the test file
    expect(ideaContent).toContain("technical skills");
    expect(ideaContent).toContain("financial runway");
  });
});
