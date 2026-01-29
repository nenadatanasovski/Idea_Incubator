/**
 * Folder Structure Utilities
 *
 * Utilities for creating and managing user-scoped folder structures
 * in the unified file system.
 */
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/index.js";

/**
 * Supported idea types for classification
 */
export type IdeaType =
  | "business"
  | "feature_internal"
  | "feature_external"
  | "service"
  | "pivot";

/**
 * Parent information for idea relationships
 */
export interface ParentInfo {
  type: "internal" | "external";
  slug?: string; // For internal parents (existing idea slug)
  name?: string; // For external parents (platform name)
}

/**
 * Get the root directory for users
 */
function getUsersRoot(): string {
  const config = getConfig();
  // Users directory is at the same level as ideas directory
  const projectRoot = path.dirname(config.paths.ideas);
  return path.join(projectRoot, "users");
}

/**
 * Create a user folder with the standard directory structure.
 *
 * Creates:
 * - users/[userSlug]/
 * - users/[userSlug]/ideas/
 * - users/[userSlug]/profile.md (with frontmatter template)
 *
 * This function is idempotent - calling it multiple times with the same
 * userSlug will not throw an error.
 *
 * @param userSlug - The slug identifier for the user (e.g., 'john-doe')
 * @returns The absolute path to the created user folder
 */
export async function createUserFolder(userSlug: string): Promise<string> {
  const usersRoot = getUsersRoot();
  const userFolder = path.resolve(usersRoot, userSlug);
  const ideasFolder = path.join(userFolder, "ideas");
  const profilePath = path.join(userFolder, "profile.md");

  // Create the user folder (recursive creates parent 'users/' if needed)
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
  }

  // Create the ideas subdirectory
  if (!fs.existsSync(ideasFolder)) {
    fs.mkdirSync(ideasFolder, { recursive: true });
  }

  // Create profile.md with template if it doesn't exist
  if (!fs.existsSync(profilePath)) {
    const now = new Date().toISOString();
    const profileContent = generateProfileTemplate(userSlug, now);
    fs.writeFileSync(profilePath, profileContent, "utf-8");
  }

  return userFolder;
}

/**
 * Create a draft folder for capturing initial idea content.
 *
 * Creates:
 * - users/[userSlug]/ideas/draft_[yyyymmddhhmmss]/
 *
 * The draft ID format is exactly 14 digits (yyyymmddhhmmss) to match the
 * pattern `draft_\d{14}`. Milliseconds are incorporated into the seconds
 * portion to ensure uniqueness when called multiple times rapidly.
 *
 * @param userSlug - The slug identifier for the user
 * @returns Object with path (absolute path to draft folder) and draftId (folder name)
 */
export async function createDraftFolder(
  userSlug: string,
): Promise<{ path: string; draftId: string }> {
  // Ensure user folder exists first
  await createUserFolder(userSlug);

  const usersRoot = getUsersRoot();
  const ideasFolder = path.join(usersRoot, userSlug, "ideas");

  // Generate timestamp-based draft ID (exactly yyyymmddhhmmss - 14 digits)
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const ms = now.getMilliseconds();

  // Create base timestamp (14 digits: yyyymmddhhmmss)
  const baseTimestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
  let draftId = `draft_${baseTimestamp}`;
  let draftPath = path.join(ideasFolder, draftId);

  // If folder already exists (same-second call), create unique 14-digit timestamp
  // Format: yyyymmddhhmm + ss where ss is modified to include counter
  // This replaces the last 2 digits (seconds) with a unique counter value
  if (fs.existsSync(draftPath)) {
    // Start counter from: seconds * 100 + centiseconds (0-5999 range, but we use mod 100)
    let counter = Math.floor(ms / 10); // 0-99 based on milliseconds
    const basePrefix = `${year}${month}${day}${hours}${minutes}`; // 12 digits
    let attempts = 0;
    do {
      // Replace seconds with counter (2 digits)
      const counterStr = counter.toString().padStart(2, "0").slice(-2);
      draftId = `draft_${basePrefix}${counterStr}`; // 12 + 2 = 14 digits
      draftPath = path.join(ideasFolder, draftId);
      counter = (counter + 1) % 100;
      attempts++;
    } while (fs.existsSync(draftPath) && attempts < 100);
  }

  // Create the draft folder
  fs.mkdirSync(draftPath, { recursive: true });

  return {
    path: path.resolve(draftPath),
    draftId,
  };
}

/**
 * Generate the profile.md template content with valid frontmatter
 */
function generateProfileTemplate(userSlug: string, created: string): string {
  return `---
slug: ${userSlug}
name: ""
created: ${created}
updated: ${created}
---

# User Profile

## Personal Goals (FT1)

**Primary Goals:**
<!-- Select from: income, impact, learning, portfolio, lifestyle, exit, passion, legacy -->

**Success Definition:**

## Passion & Motivation (FT2)

**Areas of Interest:**

**Motivations:**

**Domain Connection:**

## Skills & Experience (FT3)

**Technical Skills:**

**Professional Experience:**

**Domain Expertise:**

**Known Gaps:**

## Network & Connections (FT4)

**Industry Connections:**

**Professional Network:**

**Community Access:**

**Partnership Potential:**

## Life Stage & Capacity (FT5)

**Employment Status:**
<!-- Select from: employed, self-employed, unemployed, student, retired -->

**Weekly Hours Available:**

**Financial Runway:**

**Risk Tolerance:**
<!-- Select from: low, medium, high, very_high -->

**Other Commitments:**
`;
}

/**
 * Create an idea folder with the full directory structure and template files.
 *
 * Creates:
 * - users/[userSlug]/ideas/[ideaSlug]/
 * - All subdirectories: research/, validation/, planning/, build/, marketing/, networking/, analysis/, assets/diagrams/, assets/images/, .metadata/
 * - All template files with populated frontmatter
 * - .metadata/relationships.json with parent info if provided
 *
 * @param userSlug - The slug identifier for the user
 * @param ideaSlug - The slug identifier for the idea
 * @param ideaType - The type classification of the idea
 * @param parent - Optional parent relationship information
 * @returns The absolute path to the created idea folder
 */
export async function createIdeaFolder(
  userSlug: string,
  ideaSlug: string,
  ideaType: IdeaType,
  parent?: ParentInfo,
): Promise<string> {
  // Ensure user folder exists first
  await createUserFolder(userSlug);

  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, "ideas", ideaSlug);
  const now = new Date().toISOString();

  // Create main idea folder
  if (!fs.existsSync(ideaFolder)) {
    fs.mkdirSync(ideaFolder, { recursive: true });
  }

  // Create all subdirectories
  const subdirectories = [
    "research",
    "validation",
    "planning",
    "build",
    "marketing",
    "networking",
    "analysis",
    "assets/diagrams",
    "assets/images",
    ".metadata",
  ];

  for (const subdir of subdirectories) {
    const subdirPath = path.join(ideaFolder, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
    }
  }

  // Template variables
  const templateVars = {
    id: ideaSlug,
    title: ideaSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    idea_type: ideaType,
    creator: userSlug,
    created: now,
    updated: now,
  };

  // Create all template files
  createTemplateFile(
    ideaFolder,
    "README.md",
    generateReadmeTemplate(templateVars),
  );
  createTemplateFile(
    ideaFolder,
    "development.md",
    generateDevelopmentTemplate(templateVars),
  );
  createTemplateFile(
    ideaFolder,
    "target-users.md",
    generateTargetUsersTemplate(templateVars),
  );
  createTemplateFile(
    ideaFolder,
    "problem-solution.md",
    generateProblemSolutionTemplate(templateVars),
  );
  createTemplateFile(
    ideaFolder,
    "business-model.md",
    generateBusinessModelTemplate(templateVars),
  );
  createTemplateFile(ideaFolder, "team.md", generateTeamTemplate(templateVars));

  // Research templates
  createTemplateFile(
    ideaFolder,
    "research/market.md",
    generateMarketTemplate(templateVars),
  );
  createTemplateFile(
    ideaFolder,
    "research/competitive.md",
    generateCompetitiveTemplate(templateVars),
  );

  // Validation templates
  createTemplateFile(
    ideaFolder,
    "validation/assumptions.md",
    generateAssumptionsTemplate(templateVars),
  );

  // Planning templates
  createTemplateFile(
    ideaFolder,
    "planning/brief.md",
    generateBriefTemplate(templateVars),
  );
  createTemplateFile(
    ideaFolder,
    "planning/mvp-scope.md",
    generateMvpScopeTemplate(templateVars),
  );
  createTemplateFile(
    ideaFolder,
    "planning/architecture.md",
    generateArchitectureTemplate(templateVars),
  );

  // Marketing templates
  createTemplateFile(
    ideaFolder,
    "marketing/gtm.md",
    generateGtmTemplate(templateVars),
  );
  createTemplateFile(
    ideaFolder,
    "marketing/pitch.md",
    generatePitchTemplate(templateVars),
  );

  // Networking templates
  createTemplateFile(
    ideaFolder,
    "networking/contacts.md",
    generateContactsTemplate(templateVars),
  );

  // Build templates
  createTemplateFile(
    ideaFolder,
    "build/spec.md",
    generateSpecTemplate(templateVars),
  );

  // Create metadata files
  createMetadataFiles(ideaFolder, templateVars, parent);

  return ideaFolder;
}

/**
 * Helper function to create a template file if it doesn't exist
 */
function createTemplateFile(
  ideaFolder: string,
  relativePath: string,
  content: string,
): void {
  const filePath = path.join(ideaFolder, relativePath);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf-8");
  }
}

/**
 * Create .metadata JSON files
 */
function createMetadataFiles(
  ideaFolder: string,
  templateVars: { id: string; idea_type: IdeaType; creator: string },
  parent?: ParentInfo,
): void {
  const metadataFolder = path.join(ideaFolder, ".metadata");

  // index.json - empty object
  const indexPath = path.join(metadataFolder, "index.json");
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, "{}", "utf-8");
  }

  // relationships.json
  const relationshipsPath = path.join(metadataFolder, "relationships.json");
  if (!fs.existsSync(relationshipsPath)) {
    const relationships = {
      idea_type: templateVars.idea_type,
      parent: parent
        ? {
            type: parent.type,
            slug: parent.slug || null,
            name: parent.name || null,
          }
        : null,
      integrates_with: [],
      evolved_from: null,
      forked_from: null,
      branched_from: null,
      collaboration: {
        contributors: [],
        ai_suggested_partners: [],
      },
      ai_detected: {
        competes_with: [],
        shares_audience_with: [],
      },
    };
    fs.writeFileSync(
      relationshipsPath,
      JSON.stringify(relationships, null, 2),
      "utf-8",
    );
  }

  // priority.json
  const priorityPath = path.join(metadataFolder, "priority.json");
  if (!fs.existsSync(priorityPath)) {
    const priority = {
      always_show: ["README.md", "development.md"],
      by_phase: {
        SPARK: ["README.md", "development.md", "target-users.md"],
        CLARIFY: ["problem-solution.md", "target-users.md", "development.md"],
        RESEARCH: ["research/market.md", "research/competitive.md"],
        EVALUATE: ["validation/assumptions.md", "analysis/redteam.md"],
        VALIDATE: ["validation/assumptions.md"],
        DESIGN: [
          "planning/brief.md",
          "planning/mvp-scope.md",
          "planning/architecture.md",
        ],
        PROTOTYPE: ["build/spec.md", "planning/mvp-scope.md"],
        BUILD: ["build/spec.md", "planning/architecture.md"],
        LAUNCH: ["marketing/gtm.md", "marketing/pitch.md"],
      },
      recently_updated: [],
      ai_recommended: [],
    };
    fs.writeFileSync(priorityPath, JSON.stringify(priority, null, 2), "utf-8");
  }
}

interface TemplateVars {
  id: string;
  title: string;
  idea_type: IdeaType;
  creator: string;
  created: string;
  updated: string;
}

/**
 * Generate README.md template
 */
function generateReadmeTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
stage: SPARK
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
tags: []
related: []
summary: ""
---

# ${vars.title}

- [ ] Defined: No

## Overview
<!-- Agent fills after initial capture -->

## Problem Statement
<!-- Agent fills after problem clarification -->

## Target Users
<!-- Agent fills after target user discussion -->

## Solution
<!-- Agent fills after solution discussion -->

## Key Features
<!-- Agent fills after feature brainstorming -->

1. Feature 1
2. Feature 2
3. Feature 3

## Open Questions

- [ ] Question 1?
- [ ] Question 2?
- [ ] Question 3?
`;
}

/**
 * Generate development.md template
 */
function generateDevelopmentTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Development Notes: ${vars.title}

- [ ] Defined: No

## Questions & Answers
<!-- Agent fills after Q&A sessions -->

### Target Users

| Question | Answer | Source | Date |
|----------|--------|--------|------|
| | | | |

### Problem Definition

| Question | Answer | Source | Date |
|----------|--------|--------|------|
| | | | |

### Solution Details

| Question | Answer | Source | Date |
|----------|--------|--------|------|
| | | | |

## Identified Gaps
<!-- Agent fills after analysis -->

- [ ] Gap 1
- [ ] Gap 2

## Key Insights
<!-- Agent fills after development sessions -->

## Next Steps
<!-- Agent fills after each session -->

1. Step 1
2. Step 2
`;
}

/**
 * Generate target-users.md template
 */
function generateTargetUsersTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Target Users: ${vars.title}

- [ ] Defined: No

## Primary Segment
<!-- Agent fills after user segment discussion -->

## Demographics
<!-- Agent fills after target market analysis -->

- Age Range:
- Location:
- Income Level:
- Occupation:

## Pain Points
<!-- Agent fills after problem discovery -->

1. Pain point 1
2. Pain point 2
3. Pain point 3

## Current Solutions
<!-- Agent fills after competitive analysis -->

1. Current solution 1
2. Current solution 2
`;
}

/**
 * Generate problem-solution.md template
 */
function generateProblemSolutionTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Problem & Solution: ${vars.title}

- [ ] Defined: No

## Problem Definition
<!-- Agent fills after problem clarification -->

## Root Causes
<!-- Agent fills after root cause analysis -->

1. Root cause 1
2. Root cause 2
3. Root cause 3

## Proposed Solution
<!-- Agent fills after solution brainstorming -->

## Key Differentiators
<!-- Agent fills after competitive positioning -->

1. Differentiator 1
2. Differentiator 2
3. Differentiator 3
`;
}

/**
 * Generate business-model.md template
 */
function generateBusinessModelTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Business Model: ${vars.title}

- [ ] Defined: No

## Revenue Streams
<!-- Agent fills after monetization discussion -->

1. Revenue stream 1
2. Revenue stream 2

## Pricing Strategy
<!-- Agent fills after pricing analysis -->

## Cost Structure
<!-- Agent fills after cost analysis -->

- Fixed Costs:
- Variable Costs:

## Unit Economics
<!-- Agent fills after financial modeling -->

- Customer Acquisition Cost (CAC):
- Lifetime Value (LTV):
- LTV:CAC Ratio:
`;
}

/**
 * Generate team.md template
 */
function generateTeamTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Team: ${vars.title}

- [ ] Defined: No

## Founder Context
<!-- Agent fills after creator profile discussion -->

## Skills & Gaps
<!-- Agent fills after skills assessment -->

### Available Skills

- Skill 1
- Skill 2

### Skill Gaps

- Gap 1
- Gap 2

## Resources
<!-- Agent fills after resource assessment -->

### Time Available

### Financial Resources

### Tools & Technology

## Constraints
<!-- Agent fills after constraint identification -->

- Constraint 1
- Constraint 2
`;
}

/**
 * Generate research/market.md template
 */
function generateMarketTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Market Research: ${vars.title}

- [ ] Defined: No

## Market Size
<!-- Agent fills after market sizing analysis -->

- TAM (Total Addressable Market):
- SAM (Serviceable Addressable Market):
- SOM (Serviceable Obtainable Market):

## Trends
<!-- Agent fills after trend analysis -->

1. Trend 1
2. Trend 2

## Timing
<!-- Agent fills after timing assessment -->

## Geographic Focus
<!-- Agent fills after geographic analysis -->
`;
}

/**
 * Generate research/competitive.md template
 */
function generateCompetitiveTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Competitive Analysis: ${vars.title}

- [ ] Defined: No

## Direct Competitors
<!-- Agent fills after competitive research -->

| Competitor | Strengths | Weaknesses | Market Position |
|------------|-----------|------------|-----------------|
| | | | |

## Indirect Competitors
<!-- Agent fills after broader market analysis -->

## Competitive Advantages
<!-- Agent fills after positioning analysis -->

1. Advantage 1
2. Advantage 2

## Market Positioning
<!-- Agent fills after positioning discussion -->
`;
}

/**
 * Generate validation/assumptions.md template
 */
function generateAssumptionsTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Assumptions: ${vars.title}

- [ ] Defined: No

## Core Assumptions
<!-- Agent fills after assumption identification -->

| Assumption | Risk Level | Validation Method | Status |
|------------|------------|-------------------|--------|
| | | | |

## Risk Level
<!-- Agent fills after risk assessment -->

## Validation Method
<!-- Agent fills after validation planning -->

## Status
<!-- Agent fills after validation execution -->
`;
}

/**
 * Generate planning/brief.md template
 */
function generateBriefTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Project Brief: ${vars.title}

- [ ] Defined: No

## What's Complete
<!-- Agent fills after progress review -->

- [ ] Item 1
- [ ] Item 2

## What's Incomplete
<!-- Agent fills after gap analysis -->

- [ ] Item 1
- [ ] Item 2

## Key Insights
<!-- Agent fills after synthesis -->

## AI Recommendation
<!-- Agent fills after analysis -->

## Decision
<!-- Creator fills after review -->
`;
}

/**
 * Generate planning/mvp-scope.md template
 */
function generateMvpScopeTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# MVP Scope: ${vars.title}

- [ ] Defined: No

## Core Features
<!-- Agent fills after feature prioritization -->

1. Core feature 1
2. Core feature 2
3. Core feature 3

## Nice-to-Have
<!-- Agent fills after feature triage -->

1. Nice-to-have 1
2. Nice-to-have 2

## Out of Scope
<!-- Agent fills after scope definition -->

1. Out of scope 1
2. Out of scope 2

## Success Criteria
<!-- Agent fills after goal setting -->

1. Success metric 1
2. Success metric 2
`;
}

/**
 * Generate planning/architecture.md template
 */
function generateArchitectureTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Architecture: ${vars.title}

- [ ] Defined: No

## System Overview
<!-- Agent fills after technical discussion -->

## Components
<!-- Agent fills after component breakdown -->

1. Component 1
2. Component 2
3. Component 3

## Data Flow
<!-- Agent fills after data modeling -->

## Technology Stack
<!-- Agent fills after tech selection -->

- Frontend:
- Backend:
- Database:
- Infrastructure:

## Deployment
<!-- Agent fills after deployment planning -->
`;
}

/**
 * Generate marketing/gtm.md template
 */
function generateGtmTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Go-to-Market Strategy: ${vars.title}

- [ ] Defined: No

## Target Market
<!-- Agent fills after market segmentation -->

## Channels
<!-- Agent fills after channel analysis -->

1. Channel 1
2. Channel 2
3. Channel 3

## Messaging
<!-- Agent fills after messaging workshop -->

### Value Proposition

### Key Messages

## Timeline
<!-- Agent fills after planning -->

## Budget
<!-- Agent fills after resource planning -->
`;
}

/**
 * Generate marketing/pitch.md template
 */
function generatePitchTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Pitch: ${vars.title}

- [ ] Defined: No

## One-Liner
<!-- Agent fills after elevator pitch workshop -->

## Problem
<!-- Agent fills after problem framing -->

## Solution
<!-- Agent fills after solution positioning -->

## Market
<!-- Agent fills after market sizing -->

## Traction
<!-- Agent fills after traction review -->

## Ask
<!-- Creator fills based on needs -->
`;
}

/**
 * Generate networking/contacts.md template
 */
function generateContactsTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Contacts: ${vars.title}

- [ ] Defined: No

## Key Contacts
<!-- Agent fills after stakeholder mapping -->

| Name | Role | Relevance | Status |
|------|------|-----------|--------|
| | | | |

## Domain Experts
<!-- Agent fills after expert identification -->

## Potential Partners
<!-- Agent fills after partnership analysis -->

## Investors
<!-- Agent fills after investor research -->
`;
}

/**
 * Generate build/spec.md template
 */
function generateSpecTemplate(vars: TemplateVars): string {
  return `---
id: ${vars.id}
title: ${vars.title}
idea_type: ${vars.idea_type}
creator: ${vars.creator}
created: ${vars.created}
updated: ${vars.updated}
---

# Technical Specification: ${vars.title}

- [ ] Defined: No

## Overview
<!-- Agent fills after technical planning -->

## Requirements
<!-- Agent fills after requirements gathering -->

### Functional Requirements

1. Requirement 1
2. Requirement 2

### Non-Functional Requirements

1. Performance:
2. Security:
3. Scalability:

## API Design
<!-- Agent fills after API planning -->

## Data Model
<!-- Agent fills after data modeling -->

## Implementation Notes
<!-- Agent fills after technical discussion -->
`;
}

/**
 * Rename a draft folder to an idea folder.
 *
 * This function:
 * 1. Renames users/[userSlug]/ideas/[draftId]/ to users/[userSlug]/ideas/[ideaSlug]/
 * 2. Preserves any existing files in the draft folder
 * 3. Adds any missing template files
 * 4. Updates database references in ideation_sessions and ideation_artifacts
 *
 * @param userSlug - The slug identifier for the user
 * @param draftId - The draft folder ID (e.g., 'draft_20240101120000')
 * @param ideaSlug - The new idea slug to rename to
 * @param ideaType - The type classification of the idea
 * @returns The absolute path to the renamed idea folder
 */
export async function renameDraftToIdea(
  userSlug: string,
  draftId: string,
  ideaSlug: string,
  ideaType: IdeaType,
): Promise<string> {
  const usersRoot = getUsersRoot();
  const draftPath = path.resolve(usersRoot, userSlug, "ideas", draftId);
  const ideaPath = path.resolve(usersRoot, userSlug, "ideas", ideaSlug);

  // Verify draft folder exists
  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft folder does not exist: ${draftPath}`);
  }

  // Verify target doesn't already exist
  if (fs.existsSync(ideaPath)) {
    throw new Error(`Idea folder already exists: ${ideaPath}`);
  }

  // Rename the folder
  fs.renameSync(draftPath, ideaPath);

  // Now add any missing template files using createIdeaFolder logic
  // We'll create the templates manually since the folder already exists
  const now = new Date().toISOString();

  // Create all subdirectories if they don't exist
  const subdirectories = [
    "research",
    "validation",
    "planning",
    "build",
    "marketing",
    "networking",
    "analysis",
    "assets/diagrams",
    "assets/images",
    ".metadata",
  ];

  for (const subdir of subdirectories) {
    const subdirPath = path.join(ideaPath, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
    }
  }

  // Template variables
  const templateVars = {
    id: ideaSlug,
    title: ideaSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    idea_type: ideaType,
    creator: userSlug,
    created: now,
    updated: now,
  };

  // Create all template files if they don't exist
  createTemplateFile(
    ideaPath,
    "README.md",
    generateReadmeTemplate(templateVars),
  );
  createTemplateFile(
    ideaPath,
    "development.md",
    generateDevelopmentTemplate(templateVars),
  );
  createTemplateFile(
    ideaPath,
    "target-users.md",
    generateTargetUsersTemplate(templateVars),
  );
  createTemplateFile(
    ideaPath,
    "problem-solution.md",
    generateProblemSolutionTemplate(templateVars),
  );
  createTemplateFile(
    ideaPath,
    "business-model.md",
    generateBusinessModelTemplate(templateVars),
  );
  createTemplateFile(ideaPath, "team.md", generateTeamTemplate(templateVars));

  // Research templates
  createTemplateFile(
    ideaPath,
    "research/market.md",
    generateMarketTemplate(templateVars),
  );
  createTemplateFile(
    ideaPath,
    "research/competitive.md",
    generateCompetitiveTemplate(templateVars),
  );

  // Validation templates
  createTemplateFile(
    ideaPath,
    "validation/assumptions.md",
    generateAssumptionsTemplate(templateVars),
  );

  // Planning templates
  createTemplateFile(
    ideaPath,
    "planning/brief.md",
    generateBriefTemplate(templateVars),
  );
  createTemplateFile(
    ideaPath,
    "planning/mvp-scope.md",
    generateMvpScopeTemplate(templateVars),
  );
  createTemplateFile(
    ideaPath,
    "planning/architecture.md",
    generateArchitectureTemplate(templateVars),
  );

  // Marketing templates
  createTemplateFile(
    ideaPath,
    "marketing/gtm.md",
    generateGtmTemplate(templateVars),
  );
  createTemplateFile(
    ideaPath,
    "marketing/pitch.md",
    generatePitchTemplate(templateVars),
  );

  // Networking templates
  createTemplateFile(
    ideaPath,
    "networking/contacts.md",
    generateContactsTemplate(templateVars),
  );

  // Build templates
  createTemplateFile(
    ideaPath,
    "build/spec.md",
    generateSpecTemplate(templateVars),
  );

  // Create metadata files
  createMetadataFiles(ideaPath, templateVars, undefined);

  // Update database references
  await updateDatabaseReferences(userSlug, draftId, ideaSlug);

  return ideaPath;
}

/**
 * Check if an idea folder exists for a given user and idea slug.
 *
 * Checks the user-scoped ideas folder (users/[userSlug]/ideas/).
 *
 * @param userSlug - The slug identifier for the user
 * @param ideaSlug - The slug identifier for the idea
 * @returns True if the idea folder exists, false otherwise
 */
export function ideaFolderExists(userSlug: string, ideaSlug: string): boolean {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, "ideas", ideaSlug);
  return fs.existsSync(ideaFolder);
}

/**
 * Get the absolute path to an idea folder.
 *
 * Returns path in user-scoped ideas folder (users/[userSlug]/ideas/).
 *
 * @param userSlug - The slug identifier for the user
 * @param ideaSlug - The slug identifier for the idea
 * @returns The absolute path to the idea folder
 */
export function getIdeaFolderPath(userSlug: string, ideaSlug: string): string {
  const usersRoot = getUsersRoot();
  return path.resolve(usersRoot, userSlug, "ideas", ideaSlug);
}

/**
 * Update database references when renaming a draft to an idea.
 * Updates idea_slug in ideation_sessions and ideation_artifacts tables.
 */
async function updateDatabaseReferences(
  userSlug: string,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { run, saveDb } = await import("../database/db.js");

  // Update ideation_sessions
  await run(
    `UPDATE ideation_sessions SET idea_slug = ? WHERE user_slug = ? AND idea_slug = ?`,
    [newSlug, userSlug, oldSlug],
  );

  // Update ideation_artifacts
  await run(
    `UPDATE ideation_artifacts SET idea_slug = ? WHERE user_slug = ? AND idea_slug = ?`,
    [newSlug, userSlug, oldSlug],
  );

  // Save changes to disk
  await saveDb();
}

/**
 * Idea info structure returned by listUserIdeas
 */
export interface IdeaInfo {
  slug: string;
  title: string;
  ideaType: IdeaType;
  stage: string;
  created: string;
  updated: string;
  isDraft: boolean;
}

/**
 * List all ideas for a user.
 * Reads each idea's README.md to extract frontmatter metadata.
 *
 * Reads from user-scoped ideas folder (users/[userSlug]/ideas/).
 *
 * @param userSlug - The slug identifier for the user
 * @returns Array of idea info objects
 */
export async function listUserIdeas(userSlug: string): Promise<IdeaInfo[]> {
  const usersRoot = getUsersRoot();
  const ideasFolder = path.resolve(usersRoot, userSlug, "ideas");

  // Check if ideas folder exists
  if (!fs.existsSync(ideasFolder)) {
    return [];
  }

  const ideas: IdeaInfo[] = [];
  const entries = fs.readdirSync(ideasFolder, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const ideaSlug = entry.name;
    const ideaFolder = path.join(ideasFolder, ideaSlug);
    const readmePath = path.join(ideaFolder, "README.md");

    // Check if this is a draft folder
    const isDraft = /^draft_\d{14}$/.test(ideaSlug);

    // Default values
    let title = ideaSlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    let ideaType: IdeaType = "business";
    let stage = "SPARK";
    let created = "";
    let updated = "";

    // Try to read README.md for metadata
    if (fs.existsSync(readmePath)) {
      try {
        const content = fs.readFileSync(readmePath, "utf-8");

        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];

          // Parse title
          const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
          if (titleMatch) title = titleMatch[1].trim();

          // Parse idea_type
          const typeMatch = frontmatter.match(/^idea_type:\s*(.+)$/m);
          if (typeMatch) ideaType = typeMatch[1].trim() as IdeaType;

          // Parse stage
          const stageMatch = frontmatter.match(/^stage:\s*(.+)$/m);
          if (stageMatch) stage = stageMatch[1].trim();

          // Parse created
          const createdMatch = frontmatter.match(/^created:\s*(.+)$/m);
          if (createdMatch) created = createdMatch[1].trim();

          // Parse updated
          const updatedMatch = frontmatter.match(/^updated:\s*(.+)$/m);
          if (updatedMatch) updated = updatedMatch[1].trim();
        }
      } catch (e) {
        // If reading fails, use defaults
        console.warn(`Could not read README.md for idea ${ideaSlug}:`, e);
      }
    }

    // If no dates from frontmatter, use folder stats
    if (!created || !updated) {
      try {
        const stats = fs.statSync(ideaFolder);
        if (!created) created = stats.birthtime.toISOString();
        if (!updated) updated = stats.mtime.toISOString();
      } catch (e) {
        const now = new Date().toISOString();
        if (!created) created = now;
        if (!updated) updated = now;
      }
    }

    ideas.push({
      slug: ideaSlug,
      title,
      ideaType,
      stage,
      created,
      updated,
      isDraft,
    });
  }

  // Sort by updated date (newest first)
  ideas.sort(
    (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
  );

  return ideas;
}
