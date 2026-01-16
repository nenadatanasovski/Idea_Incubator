#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { v4 as uuidv4 } from "uuid";
import { getConfig } from "../config/index.js";
import { titleToSlug } from "../utils/parser.js";
import { logInfo, logSuccess, logError } from "../utils/logger.js";
import { IdeaType } from "../utils/schemas.js";

interface CaptureInput {
  title: string;
  type: IdeaType;
  summary?: string;
  content?: string;
}

/**
 * Create readline interface for user input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for idea type selection
 */
async function promptIdeaType(rl: readline.Interface): Promise<IdeaType> {
  console.log("\nIdea Types:");
  console.log("  1. business  - Revenue-generating ventures");
  console.log("  2. creative  - Art, content, design projects");
  console.log("  3. technical - Tools, systems, engineering");
  console.log("  4. personal  - Self-improvement, lifestyle");
  console.log("  5. research  - Knowledge exploration");

  const answer = await prompt(rl, "\nSelect type (1-5): ");

  const typeMap: Record<string, IdeaType> = {
    "1": "business",
    "2": "creative",
    "3": "technical",
    "4": "personal",
    "5": "research",
    business: "business",
    creative: "creative",
    technical: "technical",
    personal: "personal",
    research: "research",
  };

  return typeMap[answer.toLowerCase()] || "technical";
}

/**
 * Create idea folder structure
 */
function createIdeaFolder(slug: string): string {
  const config = getConfig();
  const ideaDir = path.join(config.paths.ideas, slug);

  if (fs.existsSync(ideaDir)) {
    throw new Error(`Idea folder already exists: ${slug}`);
  }

  // Create main folder and subdirectories
  fs.mkdirSync(ideaDir, { recursive: true });
  fs.mkdirSync(path.join(ideaDir, "research"), { recursive: true });
  fs.mkdirSync(path.join(ideaDir, "notes"), { recursive: true });
  fs.mkdirSync(path.join(ideaDir, "assets"), { recursive: true });

  return ideaDir;
}

/**
 * Generate idea README content
 */
function generateIdeaContent(input: CaptureInput, id: string): string {
  const now = new Date().toISOString().split("T")[0];

  return `---
id: ${id}
title: ${input.title}
type: ${input.type}
stage: SPARK
created: ${now}
updated: ${now}
tags: []
related: []
summary: "${input.summary || ""}"
---

# ${input.title}

## Overview

${input.content || "*Brief description of the idea.*"}

## Problem Statement

*What problem does this solve? Who experiences this problem?*

## Target Users

*Who specifically would benefit from this?*

- User type 1
- User type 2

## Proposed Solution

*How does this idea solve the problem?*

## Key Features

1. Feature 1
2. Feature 2
3. Feature 3

## Open Questions

- [ ] Who specifically would benefit from this?
- [ ] What's the core problem this solves?
- [ ] What's the simplest version that would be useful?

## Initial Notes

*Any other thoughts, inspirations, or context.*
`;
}

/**
 * Capture a new idea interactively
 */
export async function captureIdea(): Promise<string> {
  const rl = createReadlineInterface();

  try {
    console.log("\n=== Idea Capture ===\n");

    // Get title
    const title = await prompt(rl, "Idea title: ");
    if (!title) {
      throw new Error("Title is required");
    }

    // Get type
    const type = await promptIdeaType(rl);

    // Get optional summary
    const summary = await prompt(rl, "\nBrief summary (optional): ");

    // Get optional initial content
    console.log(
      "\nInitial description (optional, press Enter twice to finish):",
    );
    let content = "";
    let emptyLines = 0;

    const contentPromise = new Promise<string>((resolve) => {
      const contentHandler = (line: string) => {
        if (line === "") {
          emptyLines++;
          if (emptyLines >= 2) {
            rl.removeListener("line", contentHandler);
            resolve(content.trim());
            return;
          }
        } else {
          emptyLines = 0;
        }
        content += line + "\n";
      };
      rl.on("line", contentHandler);
    });

    await prompt(rl, ""); // Initial prompt to start content capture
    const finalContent = await Promise.race([
      contentPromise,
      new Promise<string>((resolve) =>
        setTimeout(() => resolve(content.trim()), 100),
      ),
    ]);

    // Generate slug and create folder
    const slug = titleToSlug(title);
    const id = uuidv4();

    logInfo(`Creating idea: ${slug}`);

    const ideaDir = createIdeaFolder(slug);
    const readmePath = path.join(ideaDir, "README.md");

    // Generate and write content
    const ideaContent = generateIdeaContent(
      {
        title,
        type,
        summary: summary || undefined,
        content: finalContent || undefined,
      },
      id,
    );

    fs.writeFileSync(readmePath, ideaContent, "utf-8");

    logSuccess(`Created: ${readmePath}`);

    // Show next steps
    console.log("\n=== Next Steps ===");
    console.log(`\n1. Edit the idea: ideas/${slug}/README.md`);
    console.log("2. Sync to database: npm run sync");
    console.log(
      '3. Develop the idea: Ask Claude to "develop" or "flesh out" the idea',
    );
    console.log("4. Evaluate when ready: npm run evaluate " + slug);

    // Ask clarifying questions
    console.log("\n=== Clarifying Questions ===\n");
    console.log("Consider answering these to strengthen your idea:\n");
    console.log("1. Who specifically would benefit from this?");
    console.log("2. What's the core problem this solves?");
    console.log("3. What's the simplest version that would be useful?");

    return slug;
  } finally {
    rl.close();
  }
}

/**
 * Capture idea from command line arguments
 */
export async function captureFromArgs(
  title: string,
  type: IdeaType,
  summary?: string,
): Promise<string> {
  const slug = titleToSlug(title);
  const id = uuidv4();

  logInfo(`Creating idea: ${slug}`);

  const ideaDir = createIdeaFolder(slug);
  const readmePath = path.join(ideaDir, "README.md");

  const ideaContent = generateIdeaContent(
    {
      title,
      type,
      summary,
    },
    id,
  );

  fs.writeFileSync(readmePath, ideaContent, "utf-8");

  logSuccess(`Created: ${readmePath}`);
  logInfo("Run `npm run sync` to update the database.");

  return slug;
}

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  try {
    if (args.length >= 2) {
      // Quick capture with args: npm run capture "Title" "type" ["summary"]
      const [title, type, summary] = args;
      await captureFromArgs(title, type as IdeaType, summary);
    } else {
      // Interactive capture
      await captureIdea();
    }
  } catch (error) {
    logError("Capture failed", error as Error);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("capture.ts") ||
    process.argv[1].endsWith("capture.js"));

if (isMainModule) {
  main();
}
