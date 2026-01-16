# Implementation Plan: Fixing the Three Core Issues

## Overview

This plan addresses the three issues identified in `ARCHITECTURE_ANALYSIS.md` with elegant, minimal-footprint solutions following first principles.

**Guiding Principles:**

1. **Unify, don't duplicate** - One source of truth for each data type
2. **Flow, don't pool** - Data should move through the system naturally
3. **Verify, don't assume** - External validation where possible
4. **Minimal changes** - Modify existing code paths, don't rebuild

---

## Design Decisions (Finalized)

| #   | Decision                | Choice                          | Rationale                                     |
| --- | ----------------------- | ------------------------------- | --------------------------------------------- |
| 1   | Q&A sync approach       | Extend `npm run sync`           | Follows existing patterns; skills stay simple |
| 2   | Profile granularity     | Category-relevant excerpts      | Token efficient; focused context              |
| 3   | Web search scope        | Market (M1-M5) + Solution (S2)  | Highest ROI; 7-15 searches                    |
| 4   | Search purpose          | Both verify + enrich            | Users have blind spots                        |
| 5   | Question bank authority | YAML is authoritative           | Database requires stable IDs                  |
| 6   | No-profile behavior     | Neutral scores + low confidence | Non-blocking; confidence signals              |
| 7   | Markdown parsing        | Flexible + LLM fallback         | Users are inconsistent                        |
| 8   | Development staleness   | Include in hash                 | Development should improve eval               |
| 9   | Search tool             | Claude WebSearch                | Already available; no new deps                |
| 10  | Default budget          | $15 (was $10)                   | Accommodates research phase                   |

---

## Phase 1: Q&A Sync Integration (Priority: Critical)

### Problem Summary

Development Q&A stored in markdown files (`development.md`) is never read by the evaluation pipeline, which expects data in the `idea_answers` table.

### Solution: Extend `npm run sync` to Parse development.md

Rather than dual-write (skill writes to both), we extend the existing sync command to parse markdown into the database. This keeps skills simple and follows established patterns.

### Step 1.1: Create Markdown Q&A Parser

**File:** `questions/parser.ts` (NEW)

```typescript
/**
 * Parse Q&A pairs from development.md files
 * Supports multiple formats with graceful fallback
 */
import { client } from "../utils/anthropic-client.js";
import { CostTracker } from "../utils/cost-tracker.js";

interface ParsedQA {
  question: string;
  answer: string;
  confidence: number;
}

/**
 * Parse Q&A from markdown with flexible pattern matching
 */
export function parseQAFromMarkdown(content: string): ParsedQA[] {
  const results: ParsedQA[] = [];

  // Pattern 1: **Q:** / **A:** format
  const qaPattern1 =
    /\*\*Q:\s*(.+?)\*\*\s*\n\s*(?:\*\*A:\*\*|A:)?\s*(.+?)(?=\n\*\*Q:|\n##|$)/gs;

  // Pattern 2: ### Question / Answer format
  const qaPattern2 = /###\s*(.+?)\n\s*(?:Answer:)?\s*(.+?)(?=\n###|\n##|$)/gs;

  // Pattern 3: Q: / A: simple format
  const qaPattern3 = /^Q:\s*(.+?)\nA:\s*(.+?)(?=\nQ:|\n##|$)/gms;

  for (const pattern of [qaPattern1, qaPattern2, qaPattern3]) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const question = match[1].trim();
      const answer = match[2].trim();

      // Skip if already found (dedup by question)
      if (!results.some((r) => r.question === question)) {
        results.push({
          question,
          answer,
          confidence: 0.9, // High confidence for user-provided answers
        });
      }
    }
  }

  return results;
}

/**
 * Extract Q&A using LLM when pattern matching yields few results
 * (Fallback for messy/inconsistent formats)
 */
export async function extractQAWithLLM(
  content: string,
  costTracker: CostTracker,
): Promise<ParsedQA[]> {
  const response = await client.messages.create({
    model: "claude-haiku-3-5-20240307", // Use Haiku for cost efficiency
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Extract all question-answer pairs from this development notes document.
Return as JSON array: [{"question": "...", "answer": "..."}]

Document:
${content.substring(0, 8000)}`, // Limit context
      },
    ],
  });

  costTracker.track(response.usage, "qa-extraction");

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((p: any) => ({
      question: p.question,
      answer: p.answer,
      confidence: 0.8, // Slightly lower for LLM extraction
    }));
  } catch {
    return [];
  }
}
```

### Step 1.2: Create Question Classifier

**File:** `questions/classifier.ts` (NEW)

```typescript
/**
 * Classify free-form questions to structured YAML question IDs
 */

interface ClassifiedQuestion {
  originalQuestion: string;
  questionId: string | null;
  confidence: number;
}

// Keyword patterns for each question ID
const QUESTION_PATTERNS: Record<string, RegExp[]> = {
  // Problem category
  P1_CORE: [
    /core problem/i,
    /main problem/i,
    /what problem/i,
    /problem.*solving/i,
  ],
  P1_SCOPE: [/scope/i, /how big.*problem/i, /widespread/i],
  P2_PAIN: [/pain.*sever/i, /how.*bad/i, /how.*painful/i, /frustrat/i],
  P2_COST: [/cost of.*problem/i, /how much.*cost/i, /price.*pay/i],
  P3_WHO: [
    /target user/i,
    /who.*experience/i,
    /customer.*who/i,
    /who.*problem/i,
  ],
  P3_SEGMENT: [/segment/i, /demographic/i, /type of user/i],
  P4_EVIDENCE: [/evidence/i, /validation/i, /proof/i, /research/i],
  P4_CONVERSATIONS: [/conversation/i, /talked to/i, /interview/i],
  P5_EXISTING: [/existing solution/i, /competitor/i, /alternative/i],
  P5_GAP: [/gap/i, /missing/i, /fail/i],

  // Solution category
  S1_WHAT: [/what.*solution/i, /solution.*description/i, /how.*work/i],
  S1_VALUE_PROP: [/value prop/i, /why.*buy/i, /benefit/i],
  S2_TECH: [/technology/i, /tech stack/i, /technical/i, /built with/i],
  S2_HARD: [/hard.*part/i, /difficult/i, /challenge/i],
  S3_DIFF: [/different/i, /differentiat/i, /unique/i, /better than/i],
  S4_SCALE: [/scale/i, /grow/i, /expand/i],
  S5_MOAT: [/moat/i, /defend/i, /barrier/i, /protect/i],

  // Market category
  M1_TAM: [/market size/i, /tam/i, /total.*market/i, /how big.*market/i],
  M1_SAM: [/sam/i, /serviceable/i],
  M2_TREND: [/trend/i, /grow.*market/i, /direction/i],
  M3_COMPETITORS: [/competitor/i, /competition/i, /who else/i],
  M4_BARRIERS: [/barrier/i, /entry/i, /hard to enter/i],
  M5_WHY_NOW: [/timing/i, /why now/i, /right time/i],

  // Feasibility
  F1_MVP: [/mvp/i, /minimum.*viable/i, /first version/i],
  F1_COMPONENTS: [/component/i, /pieces/i, /parts/i],
  F2_COST: [/cost/i, /budget/i, /how much.*build/i],
  F2_TEAM: [/team/i, /hire/i, /people/i],
  F3_GAP: [/skill.*gap/i, /skill.*need/i, /what.*learn/i],
  F4_FIRST_VALUE: [/first.*value/i, /time to/i, /how long/i],
  F5_DEPS: [/depend/i, /rely on/i, /third party/i],

  // Risk
  R_BIGGEST: [/biggest risk/i, /main risk/i, /what.*risk/i],
  R_MITIGATION: [/mitigat/i, /handle.*risk/i, /reduce.*risk/i],
  R_EXECUTION: [/execution risk/i, /fail.*build/i],
  R_MARKET: [/market risk/i, /demand/i],
  R_TECHNICAL: [/technical risk/i, /tech.*fail/i],
  R_FINANCIAL: [/financial risk/i, /money.*risk/i, /run out/i],

  // Fit
  FT1_GOALS: [/goal/i, /why.*this idea/i, /motivation/i, /align/i],
  FT2_PASSION: [/passion/i, /interest/i, /excited/i, /care about/i],
  FT3_SKILLS: [/skill/i, /experience/i, /background/i, /qualified/i],
  FT4_NETWORK: [/network/i, /connection/i, /know.*people/i],
  FT5_TIMING: [/life.*stage/i, /right time.*life/i, /capacity/i],
  FT5_RUNWAY: [/runway/i, /savings/i, /how long.*fund/i],
};

/**
 * Classify a question to its YAML question ID
 */
export function classifyQuestionToId(question: string): string | null {
  const lowerQ = question.toLowerCase();

  for (const [questionId, patterns] of Object.entries(QUESTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQ)) {
        return questionId;
      }
    }
  }

  return null; // No match found
}
```

### Step 1.3: Extend Sync Script

**File:** `scripts/sync.ts` (MODIFY)

Add development.md parsing to the existing sync flow:

```typescript
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { parseQAFromMarkdown, extractQAWithLLM } from "../questions/parser.js";
import { classifyQuestionToId } from "../questions/classifier.js";
import { saveAnswer } from "../questions/readiness.js";
import { logInfo, logDebug, logWarning } from "../utils/logger.js";

/**
 * Compute content hash including development.md
 */
function computeIdeaHash(ideaPath: string): string {
  const filesToHash = [
    path.join(ideaPath, "README.md"),
    path.join(ideaPath, "development.md"), // NEW: Include development
    ...glob.sync(path.join(ideaPath, "research", "*.md")),
  ];

  const contents = filesToHash
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, "utf-8"))
    .join("\n---\n");

  return createHash("md5").update(contents).digest("hex");
}

/**
 * Sync development.md answers to idea_answers table
 */
async function syncDevelopmentAnswers(
  ideaId: string,
  folderPath: string,
  costTracker?: CostTracker,
): Promise<{ synced: number; failed: number; skipped: number }> {
  const devPath = path.join(folderPath, "development.md");

  if (!fs.existsSync(devPath)) {
    return { synced: 0, failed: 0, skipped: 0 };
  }

  const content = fs.readFileSync(devPath, "utf-8");

  // Skip if file is too short (likely just template)
  if (content.length < 100) {
    return { synced: 0, failed: 0, skipped: 1 };
  }

  let qaPairs = parseQAFromMarkdown(content);

  // If pattern matching found few results but file has content, try LLM
  if (qaPairs.length < 3 && content.length > 500 && costTracker) {
    logDebug("Pattern matching yielded few results, trying LLM extraction...");
    const llmPairs = await extractQAWithLLM(content, costTracker);
    qaPairs.push(
      ...llmPairs.filter(
        (p) => !qaPairs.some((existing) => existing.question === p.question),
      ),
    );
  }

  let synced = 0;
  let failed = 0;

  for (const { question, answer, confidence } of qaPairs) {
    const questionId = classifyQuestionToId(question);

    if (questionId) {
      try {
        await saveAnswer(ideaId, questionId, answer, "user", confidence);
        synced++;
        logDebug(`  Mapped "${question.slice(0, 30)}..." → ${questionId}`);
      } catch (error) {
        logWarning(`Failed to save answer for ${questionId}: ${error}`);
        failed++;
      }
    } else {
      logDebug(`Could not classify: "${question.slice(0, 40)}..."`);
      failed++;
    }
  }

  return { synced, failed, skipped: 0 };
}

// Add to main sync function (syncIdea or similar):
async function syncIdea(
  ideaPath: string,
  costTracker?: CostTracker,
): Promise<SyncResult> {
  // ... existing sync logic for README.md ...

  // NEW: Sync development answers
  const devResult = await syncDevelopmentAnswers(
    idea.id,
    ideaPath,
    costTracker,
  );
  if (devResult.synced > 0) {
    logInfo(`  📝 Synced ${devResult.synced} development answers`);
  }
  if (devResult.failed > 0) {
    logWarning(`  ⚠️ Could not map ${devResult.failed} questions`);
  }

  // ... rest of sync logic ...
}
```

### Step 1.4: Update Package.json

```json
{
  "scripts": {
    "sync": "tsx scripts/sync.ts",
    "sync:verbose": "tsx scripts/sync.ts --verbose"
  }
}
```

### Test Specification

- MUST parse `**Q:** / **A:**` format correctly
- MUST parse `### Question` heading format correctly
- MUST classify questions to correct YAML IDs
- MUST handle missing development.md gracefully (return empty)
- MUST not duplicate answers on re-sync
- MUST include development.md in staleness hash calculation
- MUST use LLM fallback when pattern matching yields <3 results

---

## Phase 2: Profile Context for All Categories (Priority: High)

### Problem Summary

Profile data is only passed to the Fit evaluator, ignoring its relevance to Feasibility, Market, and Risk assessments.

### Solution: Category-Relevant Profile Excerpts

Create a function that provides focused, category-relevant profile excerpts to each evaluator (not full dump to avoid token waste).

### Step 2.1: Create Profile Context Formatter

**File:** `utils/profile-context.ts` (NEW)

```typescript
/**
 * Format profile context with category-relevant excerpts
 * Replaces the empty string for non-fit categories
 */
import { ProfileContext } from "./schemas.js";
import { Category } from "../agents/config.js";

/**
 * Extract a specific field from a context string
 */
function extractField(context: string, fieldName: string): string | null {
  const pattern = new RegExp(`${fieldName}[:\\s]+(.+?)(?:\\n|$)`, "i");
  const match = context.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Format profile context for a specific evaluator category
 */
export function formatProfileForCategory(
  profile: ProfileContext | null,
  category: Category,
): string {
  if (!profile) {
    return `## Creator Context
No user profile available. Where creator capabilities affect your assessment, note this uncertainty and apply lower confidence (0.4-0.5).`;
  }

  switch (category) {
    case "feasibility":
      return `## Creator Capabilities (for Feasibility Assessment)

**Technical Skills:**
${profile.skillsContext}

**Time Availability:**
${extractField(profile.lifeStageContext, "Hours Available") || "Not specified"}

**Known Skill Gaps:**
${extractField(profile.skillsContext, "Gaps") || "Not specified"}

**IMPORTANT**: Use this profile to assess whether the creator can realistically build this solution. Consider their skills, time, and gaps when evaluating F1-F5 criteria.`;

    case "market":
      return `## Creator Network (for Market Assessment)

**Industry Connections:**
${profile.networkContext}

**Community Access:**
${extractField(profile.networkContext, "Community") || "Not specified"}

**Professional Network:**
${extractField(profile.networkContext, "Network") || "Not specified"}

**IMPORTANT**: Use this profile to assess go-to-market feasibility. Consider whether the creator has connections that could help overcome entry barriers (M4) or provide distribution advantages.`;

    case "risk":
      return `## Creator Risk Profile (for Risk Assessment)

**Financial Runway:**
${extractField(profile.lifeStageContext, "Runway") || "Not specified"}

**Risk Tolerance:**
${extractField(profile.lifeStageContext, "Tolerance") || "Not specified"}

**Employment Status:**
${extractField(profile.lifeStageContext, "Status") || "Not specified"}

**Professional Experience:**
${extractField(profile.skillsContext, "Experience") || "Not specified"}

**IMPORTANT**: Use this profile to assess execution risk (R1), financial risk (R4), and overall risk exposure. A creator with 6 months runway has different risk capacity than one with 24 months.`;

    case "fit":
      // Full profile for Fit category (existing behavior)
      return formatFullProfileContext(profile);

    case "problem":
    case "solution":
      // These categories don't need profile context
      return "";

    default:
      return "";
  }
}

function formatFullProfileContext(profile: ProfileContext): string {
  return `## Creator Profile (REQUIRED for Personal Fit Evaluation)

### Personal Goals (FT1 - Personal Fit)
${profile.goalsContext}

### Passion & Motivation (FT2 - Passion Alignment)
${profile.passionContext}

### Skills & Experience (FT3 - Skill Match)
${profile.skillsContext}

### Network & Connections (FT4 - Network Leverage)
${profile.networkContext}

### Life Stage & Capacity (FT5 - Life Stage Fit)
${profile.lifeStageContext}

**IMPORTANT**: Use this detailed profile information to provide accurate assessments for all Personal Fit criteria (FT1-FT5). Reference specific profile details in your reasoning.`;
}
```

### Step 2.2: Update Specialized Evaluators

**File:** `agents/specialized-evaluators.ts` (MODIFY)

Replace the hard-coded conditional:

```typescript
import { formatProfileForCategory } from "../utils/profile-context.js";

// In runSpecializedEvaluator function, replace lines 306-309:

// OLD:
// const profileSection = category === 'fit'
//   ? formatProfileContextForFitEvaluator(profileContext ?? null)
//   : '';

// NEW:
const profileSection = formatProfileForCategory(
  profileContext ?? null,
  category,
);
```

This single-line change makes profile context available to all evaluators with category-appropriate formatting.

### Test Specification

- MUST include skills context for Feasibility evaluator
- MUST include network context for Market evaluator
- MUST include runway/risk context for Risk evaluator
- MUST return full profile for Fit evaluator
- MUST return empty string for Problem/Solution evaluators
- MUST handle null profile with appropriate message

---

## Phase 3: Pre-Evaluation Web Research (Priority: High)

### Problem Summary

Evaluators work in isolation without external information to verify claims about markets, competition, technology, and timing.

### Solution: Research Phase for Market + Solution (S2)

Add web search for Market (M1-M5) and Solution technical feasibility (S2), using Claude's built-in WebSearch tool.

**Scope**: 7-15 searches per evaluation
**Purpose**: Both verify user claims AND discover blind spots
**Budget**: Default increased from $10 to $15

### Step 3.1: Create Claims Extractor

**File:** `utils/claims-extractor.ts` (NEW)

```typescript
/**
 * Extract verifiable claims from idea content
 */
import { client } from "./anthropic-client.js";
import { CostTracker } from "./cost-tracker.js";

export interface ExtractedClaims {
  domain: string;
  technology: string[];
  competitors: string[];
  marketSize: string | null;
  targetMarket: string;
}

export async function extractClaimsFromContent(
  content: string,
  costTracker: CostTracker,
): Promise<ExtractedClaims> {
  const response = await client.messages.create({
    model: "claude-haiku-3-5-20240307",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Extract key claims from this idea description for research verification:

${content.substring(0, 6000)}

Return JSON:
{
  "domain": "primary industry/market domain",
  "technology": ["key technologies mentioned"],
  "competitors": ["competitors or alternatives mentioned"],
  "marketSize": "any market size claims or null",
  "targetMarket": "target customer description"
}`,
      },
    ],
  });

  costTracker.track(response.usage, "claims-extraction");

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      domain: "general",
      technology: [],
      competitors: [],
      marketSize: null,
      targetMarket: "general consumers",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      domain: parsed.domain || "general",
      technology: parsed.technology || [],
      competitors: parsed.competitors || [],
      marketSize: parsed.marketSize || null,
      targetMarket: parsed.targetMarket || "general consumers",
    };
  } catch {
    return {
      domain: "general",
      technology: [],
      competitors: [],
      marketSize: null,
      targetMarket: "general consumers",
    };
  }
}
```

### Step 3.2: Create Research Agent

**File:** `agents/research.ts` (NEW)

```typescript
/**
 * Pre-Evaluation Research Agent
 * Uses web search to verify claims and discover market intelligence
 */
import { client } from "../utils/anthropic-client.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logInfo, logDebug } from "../utils/logger.js";
import { ExtractedClaims } from "../utils/claims-extractor.js";

export interface ResearchResult {
  marketSize: {
    userClaim: string | null;
    verified: string | null;
    sources: string[];
  };
  competitors: {
    userMentioned: string[];
    discovered: string[];
    sources: string[];
  };
  trends: {
    direction: "growing" | "stable" | "declining" | "unknown";
    evidence: string;
    sources: string[];
  };
  techFeasibility: {
    assessment: "proven" | "emerging" | "experimental" | "unknown";
    examples: string[];
    sources: string[];
  };
  timestamp: string;
}

/**
 * Build targeted search queries based on extracted claims
 */
function buildSearchQueries(claims: ExtractedClaims): string[] {
  const year = new Date().getFullYear();
  const queries: string[] = [];

  // Market size verification
  if (claims.domain) {
    queries.push(`${claims.domain} market size ${year}`);
    queries.push(`${claims.domain} industry report ${year}`);
  }

  // Competitor discovery
  queries.push(`${claims.domain} companies startups ${year}`);
  if (claims.competitors.length > 0) {
    queries.push(`${claims.competitors.join(" ")} alternatives competitors`);
  }

  // Market trends
  queries.push(`${claims.domain} market trends growth ${year}`);

  // Technology feasibility (limit to 2)
  for (const tech of claims.technology.slice(0, 2)) {
    queries.push(`${tech} implementation production examples`);
  }

  return queries;
}

/**
 * Conduct pre-evaluation research using web search
 */
export async function conductPreEvaluationResearch(
  ideaContent: string,
  claims: ExtractedClaims,
  costTracker: CostTracker,
): Promise<ResearchResult> {
  logInfo("Starting pre-evaluation research phase...");

  const queries = buildSearchQueries(claims);
  logDebug(`Executing ${queries.length} research queries`);

  // Execute searches with tool use (using Claude's built-in WebSearch)
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514", // Use Sonnet for research (cost efficient)
    max_tokens: 4000,
    tools: [
      {
        type: "web_search" as any,
        name: "web_search",
      },
    ],
    messages: [
      {
        role: "user",
        content: `Research the following topics and summarize findings:

${queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

For each topic, provide:
- Key findings (2-3 bullet points)
- Source URLs when available
- Confidence level (high/medium/low)`,
      },
    ],
  });

  costTracker.track(response.usage, "research-search");

  // Extract text content
  let rawResults = "";
  for (const block of response.content) {
    if (block.type === "text") {
      rawResults = block.text;
    }
  }

  // Synthesize into structured format
  return synthesizeResearch(claims, rawResults, costTracker);
}

async function synthesizeResearch(
  claims: ExtractedClaims,
  rawResults: string,
  costTracker: CostTracker,
): Promise<ResearchResult> {
  const response = await client.messages.create({
    model: "claude-haiku-3-5-20240307", // Use Haiku for synthesis
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Given these research findings, extract structured data:

User's claimed market size: ${claims.marketSize || "Not specified"}
User's mentioned competitors: ${claims.competitors.join(", ") || "None"}
Technology stack: ${claims.technology.join(", ")}

Research findings:
${rawResults}

Return JSON:
{
  "marketSize": {
    "verified": "actual market size found or null",
    "sources": ["url1", "url2"]
  },
  "competitors": {
    "discovered": ["new competitor names not mentioned by user"],
    "sources": ["url1"]
  },
  "trends": {
    "direction": "growing|stable|declining|unknown",
    "evidence": "brief explanation"
  },
  "techFeasibility": {
    "assessment": "proven|emerging|experimental|unknown",
    "examples": ["example deployment 1", "example 2"]
  }
}`,
      },
    ],
  });

  costTracker.track(response.usage, "research-synthesis");

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return createEmptyResult(claims);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      marketSize: {
        userClaim: claims.marketSize,
        verified: parsed.marketSize?.verified || null,
        sources: parsed.marketSize?.sources || [],
      },
      competitors: {
        userMentioned: claims.competitors,
        discovered: parsed.competitors?.discovered || [],
        sources: parsed.competitors?.sources || [],
      },
      trends: {
        direction: parsed.trends?.direction || "unknown",
        evidence: parsed.trends?.evidence || "",
        sources: [],
      },
      techFeasibility: {
        assessment: parsed.techFeasibility?.assessment || "unknown",
        examples: parsed.techFeasibility?.examples || [],
        sources: [],
      },
      timestamp: new Date().toISOString(),
    };
  } catch {
    return createEmptyResult(claims);
  }
}

function createEmptyResult(claims: ExtractedClaims): ResearchResult {
  return {
    marketSize: { userClaim: claims.marketSize, verified: null, sources: [] },
    competitors: {
      userMentioned: claims.competitors,
      discovered: [],
      sources: [],
    },
    trends: { direction: "unknown", evidence: "", sources: [] },
    techFeasibility: { assessment: "unknown", examples: [], sources: [] },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format research for evaluator prompts
 */
export function formatResearchForCategory(
  research: ResearchResult | null,
  category: string,
): string {
  if (!research) return "";

  switch (category) {
    case "market":
      return `## External Research (Web Search Results)

**Market Size:**
- User claimed: ${research.marketSize.userClaim || "Not specified"}
- Verified: ${research.marketSize.verified || "Could not verify"}
- Sources: ${research.marketSize.sources.join(", ") || "None"}

**Competitors:**
- User mentioned: ${research.competitors.userMentioned.join(", ") || "None"}
- Discovered: ${research.competitors.discovered.join(", ") || "None additional"}

**Market Trends:**
- Direction: ${research.trends.direction}
- Evidence: ${research.trends.evidence}

**IMPORTANT**: Use this research to validate or challenge the user's market claims. Discovered competitors should factor into M3 (Competition) assessment.`;

    case "solution":
      return `## Technology Research (Web Search Results)

**Technical Feasibility Assessment:**
- Status: ${research.techFeasibility.assessment}
- Production Examples: ${research.techFeasibility.examples.join(", ") || "None found"}

**IMPORTANT**: Use this research when assessing S2 (Technical Feasibility). If the technology is "proven" with production examples, confidence should be higher.`;

    default:
      return "";
  }
}
```

### Step 3.3: Integrate into Evaluation Flow

**File:** `scripts/evaluate.ts` (MODIFY)

```typescript
import { extractClaimsFromContent } from "../utils/claims-extractor.js";
import {
  conductPreEvaluationResearch,
  ResearchResult,
  formatResearchForCategory,
} from "../agents/research.js";

// In the main evaluation action, after loading idea content:

// Pre-evaluation research phase
console.log("\n--- Starting Research Phase ---\n");
const userClaims = await extractClaimsFromContent(ideaContent, costTracker);
logInfo(
  `Extracted claims: ${userClaims.competitors.length} competitors, tech: ${userClaims.technology.join(", ")}`,
);

const research = await conductPreEvaluationResearch(
  ideaContent,
  userClaims,
  costTracker,
);
logInfo(
  `Research found ${research.competitors.discovered.length} additional competitors`,
);

// Pass research to evaluators
const result = await runAllSpecializedEvaluators(
  slug,
  ideaId,
  ideaContent,
  costTracker,
  broadcaster,
  profileContext,
  structuredContext,
  research, // NEW parameter
);
```

### Step 3.4: Update Specialized Evaluators

**File:** `agents/specialized-evaluators.ts` (MODIFY)

Update function signature and use research context:

```typescript
export async function runSpecializedEvaluator(
  category: Category,
  ideaContent: string,
  costTracker: CostTracker,
  broadcaster?: Broadcaster,
  roundNumber?: number,
  profileContext?: ProfileContext | null,
  structuredContext?: StructuredEvaluationContext | null,
  research?: ResearchResult | null  // NEW parameter
): Promise<EvaluationResult[]> {
  // ... existing code ...

  // Format research for this category
  const researchSection = formatResearchForCategory(research ?? null, category);

  // Include in prompt
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: evaluator.systemPrompt,
    messages: [{
      role: 'user',
      content: `Evaluate this idea for the **${category.toUpperCase()}** category:

${researchSection}

${structuredSection}

## Idea Content

${ideaContent}

${profileSection}

## Criteria to Evaluate

${criteriaPrompt}

Evaluate all ${criteria.length} criteria in the ${category} category.`
    }]
  });
```

### Step 3.5: Update Default Budget

**File:** `config/default.ts` (MODIFY)

```typescript
export const defaultConfig: Config = {
  // ... existing config ...
  budget: {
    default: 15, // Increased from 10 to accommodate research
    max: 50,
  },
  // ... rest of config ...
};
```

### Test Specification

- MUST extract domain, technology, and competitors from idea content
- MUST execute 7-15 web searches per evaluation
- MUST discover competitors not mentioned by user
- MUST verify market size claims when possible
- MUST assess technology feasibility with examples
- MUST pass research context to Market and Solution evaluators
- MUST track research costs separately in cost_log
- MUST gracefully handle search failures

---

## Summary of Changes

### New Files

| File                        | Purpose                           |
| --------------------------- | --------------------------------- |
| `questions/parser.ts`       | Parse Q&A from development.md     |
| `questions/classifier.ts`   | Map questions to YAML IDs         |
| `utils/profile-context.ts`  | Category-aware profile formatting |
| `utils/claims-extractor.ts` | Extract verifiable claims         |
| `agents/research.ts`        | Pre-evaluation web research       |

### Modified Files

| File                               | Changes                                     |
| ---------------------------------- | ------------------------------------------- |
| `scripts/sync.ts`                  | Add development.md parsing, include in hash |
| `agents/specialized-evaluators.ts` | Use formatProfileForCategory, add research  |
| `scripts/evaluate.ts`              | Add research phase                          |
| `config/default.ts`                | Increase default budget to $15              |

---

## Implementation Order

1. **Phase 2** (Profile) - Simplest change, immediate impact, ~30 mins
2. **Phase 1** (Q&A Sync) - Critical data fix, ~2-3 hours
3. **Phase 3** (Research) - High value, ~3-4 hours

**Total estimated effort**: 1 day

---

## Expected Impact

| Metric                | Before               | After                | Improvement           |
| --------------------- | -------------------- | -------------------- | --------------------- |
| Q&A utilization       | 0%                   | 90%+                 | Full context          |
| Profile utilization   | 17% (1/6 categories) | 67% (4/6 categories) | 4x more categories    |
| Claim verification    | 0%                   | Market + S2          | External research     |
| Evaluation confidence | Low                  | High                 | Evidence-based        |
| Cost per evaluation   | ~$8                  | ~$12                 | +$4 for research      |
| Default budget        | $10                  | $15                  | Accommodates research |
