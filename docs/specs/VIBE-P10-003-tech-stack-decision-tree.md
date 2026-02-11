# VIBE-P10-003: Tech Stack Decision Tree

**Status:** Specification
**Priority:** P2 (Medium - Architect Agent Foundation)
**Effort:** Medium (6-8 hours)
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Implement a rule-based decision engine that analyzes project requirements and recommends optimal technology choices across frontend frameworks, backend frameworks, databases, and hosting platforms. This system enables the Architect Agent to make informed, consistent technology decisions based on project constraints, team capabilities, and scalability requirements.

### Problem Statement

**Current State:**

- Technology selection is ad-hoc or based on developer preferences
- No systematic evaluation of tradeoffs (performance vs ease-of-use, cost vs scalability)
- Inconsistent recommendations across similar projects
- Architect Agent lacks decision-making framework for tech stack choices

**Desired State:**

- Rule-based decision engine evaluates requirements and outputs recommendations
- Each technology choice includes rationale explaining why it's optimal
- Consistent, reproducible decisions for similar project profiles
- Extensible framework that supports adding new technologies and decision rules

### Value Proposition

The Tech Stack Decision Tree serves as the **"Technology Advisor"** for the Architect Agent:

1. **Reduces Decision Paralysis** - Clear rules eliminate endless option comparison
2. **Ensures Consistency** - Similar projects get similar technology recommendations
3. **Captures Rationale** - Each decision includes "why" for transparency and learning
4. **Enables Optimization** - Rules can evolve based on performance data and feedback
5. **Accelerates Onboarding** - New developers see explicit reasoning for technology choices

---

## Requirements

### Functional Requirements

#### FR-1: Technology Stack Recommendation Interface

**Input:** Project requirements object

```typescript
interface ProjectRequirements {
  // Team & Experience
  teamSize: "solo" | "small" | "medium" | "large"; // 1, 2-5, 6-15, 16+
  teamExperience: "junior" | "mixed" | "senior";

  // Application Characteristics
  complexity: "simple" | "moderate" | "complex";
  expectedUsers: "few" | "moderate" | "high" | "enterprise"; // <100, 100-10k, 10k-100k, 100k+
  performanceNeeds: "standard" | "high" | "realtime";

  // Data & Architecture
  dataStructure: "simple" | "relational" | "document" | "mixed";
  dataScale: "small" | "medium" | "large"; // <1GB, 1-100GB, >100GB
  needsRelationships: boolean;

  // Deployment & Operations
  budget: "minimal" | "moderate" | "flexible";
  deploymentComplexity: "simple" | "moderate" | "advanced";
  scalabilityNeeds: "none" | "horizontal" | "vertical" | "both";

  // Optional Constraints
  existingInfrastructure?: string; // e.g., "AWS", "Vercel"
  mustUse?: string[]; // e.g., ["PostgreSQL", "React"]
  mustAvoid?: string[]; // e.g., ["MongoDB"]
}
```

**Output:** Comprehensive technology recommendation

```typescript
interface TechStackRecommendation {
  frontend: TechnologyChoice;
  backend: TechnologyChoice;
  database: TechnologyChoice;
  hosting: TechnologyChoice;
  confidence: number; // 0.0-1.0 based on rule match quality
  alternativeStacks?: TechStackRecommendation[]; // Other valid options
}

interface TechnologyChoice {
  name: string; // e.g., "React", "PostgreSQL"
  category: "frontend" | "backend" | "database" | "hosting";
  rationale: string; // Why this choice is optimal
  tradeoffs: string[]; // What you gain vs. what you lose
  learningCurve: "easy" | "moderate" | "steep";
  ecosystem: "mature" | "growing" | "niche";
  alternatives: string[]; // Other options considered
}
```

#### FR-2: Frontend Framework Decision Rules

**Rule Set for Frontend Selection:**

1. **React** ✅
   - **When:** Team size ≥ medium OR complexity ≥ moderate OR ecosystem maturity critical
   - **Rationale:** Largest ecosystem, most hiring pool, battle-tested at scale
   - **Tradeoffs:** Heavier bundle size, more boilerplate than alternatives
   - **Learning Curve:** Moderate (hooks, state management)

2. **Vue** ✅
   - **When:** Team size = small AND (complexity = simple OR teamExperience = junior)
   - **Rationale:** Gentle learning curve, excellent documentation, progressive adoption
   - **Tradeoffs:** Smaller ecosystem than React, fewer senior developers available
   - **Learning Curve:** Easy (intuitive API)

3. **Svelte** ✅
   - **When:** performanceNeeds = high OR complexity = simple AND budget = minimal
   - **Rationale:** No virtual DOM = faster runtime, smaller bundle, less code
   - **Tradeoffs:** Smaller ecosystem, fewer libraries, less enterprise adoption
   - **Learning Curve:** Easy (minimal boilerplate)

4. **Next.js (React framework)** ✅
   - **When:** React selected AND (needsSSR OR needsSEO OR complexity ≥ moderate)
   - **Rationale:** SSR, routing, API routes, optimal DX for full-stack React apps
   - **Tradeoffs:** Vendor lock-in to Vercel patterns, learning curve for server components
   - **Learning Curve:** Moderate (requires React knowledge + framework concepts)

#### FR-3: Backend Framework Decision Rules

**Rule Set for Backend Selection:**

1. **Express.js** ✅
   - **When:** Complexity = simple OR team prefers minimal abstractions
   - **Rationale:** Minimal, flexible, unopinionated, massive ecosystem
   - **Tradeoffs:** Manual setup for validation, security, structure
   - **Learning Curve:** Easy (JavaScript/TypeScript only)

2. **Fastify** ✅
   - **When:** performanceNeeds = high OR expectedUsers = high/enterprise
   - **Rationale:** 2x faster than Express, built-in schema validation, async-first
   - **Tradeoffs:** Smaller ecosystem, fewer middleware options
   - **Learning Curve:** Moderate (plugins system, schemas)

3. **NestJS** ✅
   - **When:** (teamSize ≥ medium AND teamExperience = senior) OR complexity = complex
   - **Rationale:** Enterprise architecture (DI, modules), TypeScript-first, scalable structure
   - **Tradeoffs:** Heavy framework, steep learning curve, over-engineered for small apps
   - **Learning Curve:** Steep (Angular patterns, decorators, DI)

4. **Hono** ✅
   - **When:** budget = minimal AND deploymentComplexity = simple AND dataScale = small
   - **Rationale:** Edge-first, ultra-lightweight, Cloudflare Workers compatible
   - **Tradeoffs:** Young ecosystem, limited enterprise adoption
   - **Learning Curve:** Easy (Express-like API)

#### FR-4: Database Decision Rules

**Rule Set for Database Selection:**

1. **PostgreSQL** ✅
   - **When:** needsRelationships = true OR dataStructure = relational/mixed OR dataScale ≥ medium
   - **Rationale:** ACID guarantees, JSON support, extensions (PostGIS, full-text search), battle-tested
   - **Tradeoffs:** More setup than SQLite, schema migrations required
   - **Learning Curve:** Moderate (SQL, indexes, transactions)

2. **SQLite** ✅
   - **When:** (dataScale = small AND expectedUsers = few) OR deploymentComplexity = simple
   - **Rationale:** Zero-config, file-based, perfect for prototypes/MVPs, Litestream for replication
   - **Tradeoffs:** Limited concurrency, no built-in replication, not for high-write workloads
   - **Learning Curve:** Easy (SQL, no server setup)

3. **MongoDB** ✅
   - **When:** dataStructure = document AND needsRelationships = false AND flexibility > consistency
   - **Rationale:** Flexible schema, horizontal scaling, JSON-native, fast for read-heavy apps
   - **Tradeoffs:** No ACID across documents, easy to create schema debt, harder queries than SQL
   - **Learning Curve:** Moderate (document model, aggregation pipeline)

4. **Redis** ✅
   - **When:** performanceNeeds = realtime OR (dataScale = small AND needsCaching = true)
   - **Rationale:** In-memory speed, pub/sub, caching layer, session storage
   - **Tradeoffs:** Not a primary database (no complex queries), persistence optional
   - **Learning Curve:** Easy (key-value, basic commands)

5. **Supabase (PostgreSQL + Realtime)** ✅
   - **When:** budget = moderate AND needsAuth = true AND wantsBackendAsService = true
   - **Rationale:** PostgreSQL + Auth + Storage + Realtime in one, fast development
   - **Tradeoffs:** Vendor lock-in, costs scale with usage, less control than self-hosted
   - **Learning Curve:** Easy (PostgreSQL + SDK)

#### FR-5: Hosting Platform Decision Rules

**Rule Set for Hosting Selection:**

1. **Vercel** ✅
   - **When:** frontend = (React OR Next.js) AND budget ≥ moderate AND wantsManagedDeployment = true
   - **Rationale:** Zero-config deploys, edge functions, preview environments, optimal for Next.js
   - **Tradeoffs:** Expensive at scale, serverless cold starts, vendor lock-in
   - **Learning Curve:** Easy (git push deploys)

2. **Railway** ✅
   - **When:** budget = minimal/moderate AND wantsSimplicity = true AND (needsDatabase OR needsBackend)
   - **Rationale:** Simple pricing, built-in databases, Docker support, excellent DX
   - **Tradeoffs:** Smaller network than AWS/GCP, limited regions
   - **Learning Curve:** Easy (similar to Heroku)

3. **AWS (ECS/Lambda)** ✅
   - **When:** scalabilityNeeds = both OR expectedUsers = enterprise OR existingInfrastructure = AWS
   - **Rationale:** Unlimited scale, every service imaginable, enterprise support
   - **Tradeoffs:** Complex setup, steep learning curve, costs can spiral
   - **Learning Curve:** Steep (IAM, VPC, networking)

4. **Fly.io** ✅
   - **When:** performanceNeeds = realtime AND wantsEdgeDeployment = true OR budget = moderate
   - **Rationale:** Global edge deployment, low latency, Docker-native, good pricing
   - **Tradeoffs:** Smaller ecosystem, fewer integrations than big clouds
   - **Learning Curve:** Moderate (Docker required)

5. **DigitalOcean App Platform** ✅
   - **When:** budget = moderate AND teamExperience ≠ senior AND wantsSimplicity = true
   - **Rationale:** Middle ground between PaaS simplicity and IaaS control, predictable pricing
   - **Tradeoffs:** Less feature-rich than AWS, manual scaling
   - **Learning Curve:** Easy (PaaS abstractions)

#### FR-6: Decision Tree Evaluation Method

**Core Method:**

```typescript
class TechStackDecisionTree {
  /**
   * Evaluate requirements and return technology recommendations
   */
  evaluate(requirements: ProjectRequirements): TechStackRecommendation;

  /**
   * Get decision rationale for a specific choice
   */
  explainChoice(
    category: "frontend" | "backend" | "database" | "hosting",
    choice: string,
    requirements: ProjectRequirements,
  ): string;

  /**
   * Test if requirements satisfy a specific rule
   */
  private evaluateRule(
    rule: DecisionRule,
    requirements: ProjectRequirements,
  ): boolean;

  /**
   * Rank technologies by match score
   */
  private rankChoices(
    category: string,
    requirements: ProjectRequirements,
  ): TechnologyChoice[];
}
```

#### FR-7: Alternative Recommendations

When multiple technologies score similarly (within 10% match score):

- **MUST** return `alternativeStacks` array with 2nd and 3rd best options
- **MUST** include comparative rationale: "React scored 0.85, Vue scored 0.82 due to..."
- **SHOULD** highlight when alternatives are "equally good" vs. "clearly worse"

#### FR-8: Constraint Validation

**MUST validate requirements:**

```typescript
// Hard constraints
if (requirements.mustUse) {
  // Ensure recommended stack includes all mustUse technologies
  // Or return error if impossible
}

if (requirements.mustAvoid) {
  // Filter out mustAvoid technologies from candidates
}

if (requirements.existingInfrastructure === "AWS") {
  // Boost AWS hosting score, consider AWS-native services
}
```

### Non-Functional Requirements

#### NFR-1: Performance

- Decision evaluation MUST complete in <100ms for typical requirements
- Rule evaluation MUST be deterministic (same input → same output)
- SHOULD support batch evaluation (multiple requirement profiles)

#### NFR-2: Extensibility

- Adding a new technology MUST NOT require modifying core decision logic
- New decision rules SHOULD be definable in declarative format (JSON/YAML)
- Rule priority MUST be configurable (allow overriding defaults)

#### NFR-3: Testability

- Every decision rule MUST have at least one test case
- Edge cases MUST be covered: conflicting requirements, missing fields, extreme values
- Rationale text MUST be verified for clarity and accuracy

#### NFR-4: Maintainability

- Rules SHOULD be documented with source references (blog posts, benchmarks, case studies)
- Decision confidence MUST be calculated transparently (rule weight × match score)
- SHOULD support dry-run mode (explain decisions without committing)

---

## Technical Design

### Architecture

```
ProjectRequirements (input)
    ↓
TechStackDecisionTree.evaluate()
    ↓
┌─────────────────────────────────────────────────────┐
│  1. Validate Requirements                           │
│     - Check for conflicts                           │
│     - Apply hard constraints (mustUse, mustAvoid)   │
│     - Fill in defaults for missing fields           │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  2. Evaluate Each Category                          │
│     - Frontend: rankChoices('frontend', reqs)       │
│     - Backend: rankChoices('backend', reqs)         │
│     - Database: rankChoices('database', reqs)       │
│     - Hosting: rankChoices('hosting', reqs)         │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  3. Score Technologies                              │
│     For each tech in category:                      │
│       - Evaluate all decision rules                 │
│       - Calculate match score (0-100)               │
│       - Weight by rule priority                     │
│       - Adjust for constraints                      │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  4. Select Winners                                  │
│     - Top score = primary recommendation            │
│     - Within 10% = alternatives                     │
│     - Generate rationale for each                   │
└─────────────────────────────────────────────────────┘
    ↓
TechStackRecommendation (output with rationale)
```

### Key Components

#### 1. Core Decision Tree Class

**File:** `src/agents/architect/decision-tree.ts` (NEW)

```typescript
import {
  ProjectRequirements,
  TechStackRecommendation,
  TechnologyChoice,
} from "./types";
import { DECISION_RULES, DecisionRule } from "./rules";

export class TechStackDecisionTree {
  /**
   * Main evaluation method
   */
  evaluate(requirements: ProjectRequirements): TechStackRecommendation {
    // Validate and normalize requirements
    const normalizedReqs = this.validateRequirements(requirements);

    // Evaluate each category
    const frontend = this.selectBest("frontend", normalizedReqs);
    const backend = this.selectBest("backend", normalizedReqs);
    const database = this.selectBest("database", normalizedReqs);
    const hosting = this.selectBest("hosting", normalizedReqs);

    // Calculate overall confidence (average of category confidences)
    const confidence =
      (frontend.confidence +
        backend.confidence +
        database.confidence +
        hosting.confidence) /
      4;

    // Find alternative complete stacks
    const alternativeStacks = this.findAlternativeStacks(normalizedReqs);

    return {
      frontend,
      backend,
      database,
      hosting,
      confidence,
      alternativeStacks,
    };
  }

  /**
   * Select best technology for a category
   */
  private selectBest(
    category: string,
    requirements: ProjectRequirements,
  ): TechnologyChoice {
    const ranked = this.rankChoices(category, requirements);
    const winner = ranked[0];

    // Enhance with metadata
    return {
      ...winner,
      alternatives: ranked.slice(1, 4).map((t) => t.name),
    };
  }

  /**
   * Rank all technologies in a category
   */
  private rankChoices(
    category: string,
    requirements: ProjectRequirements,
  ): TechnologyChoice[] {
    const rules = DECISION_RULES[category];
    const scores: Map<string, number> = new Map();
    const rationales: Map<string, string[]> = new Map();

    // Evaluate each rule
    for (const rule of rules) {
      const matches = this.evaluateRule(rule, requirements);

      if (matches) {
        const currentScore = scores.get(rule.technology) || 0;
        scores.set(rule.technology, currentScore + rule.weight);

        const reasons = rationales.get(rule.technology) || [];
        reasons.push(rule.rationale);
        rationales.set(rule.technology, reasons);
      }
    }

    // Convert to TechnologyChoice objects
    const choices: TechnologyChoice[] = [];
    for (const [name, score] of scores.entries()) {
      const tech = rules.find((r) => r.technology === name);
      if (!tech) continue;

      choices.push({
        name,
        category: category as any,
        rationale: rationales.get(name)![0], // Primary reason
        tradeoffs: tech.tradeoffs,
        learningCurve: tech.learningCurve,
        ecosystem: tech.ecosystem,
        alternatives: [],
        confidence: score / 100, // Normalize to 0-1
      });
    }

    // Sort by score descending
    return choices.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Evaluate a single decision rule
   */
  private evaluateRule(
    rule: DecisionRule,
    requirements: ProjectRequirements,
  ): boolean {
    // Check hard constraints first
    if (requirements.mustAvoid?.includes(rule.technology)) {
      return false;
    }

    if (requirements.mustUse?.includes(rule.technology)) {
      return true;
    }

    // Evaluate rule conditions
    for (const condition of rule.conditions) {
      const reqValue =
        requirements[condition.field as keyof ProjectRequirements];

      switch (condition.operator) {
        case "equals":
          if (reqValue !== condition.value) return false;
          break;
        case "in":
          if (!condition.value.includes(reqValue)) return false;
          break;
        case "greaterThan":
          if (reqValue <= condition.value) return false;
          break;
        case "lessThan":
          if (reqValue >= condition.value) return false;
          break;
      }
    }

    return true; // All conditions met
  }

  /**
   * Validate requirements and apply defaults
   */
  private validateRequirements(
    requirements: ProjectRequirements,
  ): ProjectRequirements {
    return {
      teamSize: requirements.teamSize || "small",
      teamExperience: requirements.teamExperience || "mixed",
      complexity: requirements.complexity || "moderate",
      expectedUsers: requirements.expectedUsers || "moderate",
      performanceNeeds: requirements.performanceNeeds || "standard",
      dataStructure: requirements.dataStructure || "relational",
      dataScale: requirements.dataScale || "small",
      needsRelationships: requirements.needsRelationships ?? true,
      budget: requirements.budget || "moderate",
      deploymentComplexity: requirements.deploymentComplexity || "simple",
      scalabilityNeeds: requirements.scalabilityNeeds || "none",
      ...requirements,
    };
  }

  /**
   * Find alternative complete stacks
   */
  private findAlternativeStacks(
    requirements: ProjectRequirements,
  ): TechStackRecommendation[] {
    // Simplified: return top 2 alternatives
    // Full implementation would generate complete alternative stacks
    return [];
  }
}
```

#### 2. Decision Rules Definition

**File:** `src/agents/architect/rules.ts` (NEW)

```typescript
export interface DecisionRule {
  technology: string;
  category: "frontend" | "backend" | "database" | "hosting";
  weight: number; // 0-100 (rule priority)
  conditions: RuleCondition[];
  rationale: string;
  tradeoffs: string[];
  learningCurve: "easy" | "moderate" | "steep";
  ecosystem: "mature" | "growing" | "niche";
}

export interface RuleCondition {
  field: string; // Key from ProjectRequirements
  operator: "equals" | "in" | "greaterThan" | "lessThan";
  value: any;
}

export const DECISION_RULES: Record<string, DecisionRule[]> = {
  frontend: [
    {
      technology: "React",
      category: "frontend",
      weight: 90,
      conditions: [
        { field: "teamSize", operator: "in", value: ["medium", "large"] },
      ],
      rationale:
        "Largest ecosystem and hiring pool, battle-tested at enterprise scale",
      tradeoffs: ["Heavier bundle size", "More boilerplate than alternatives"],
      learningCurve: "moderate",
      ecosystem: "mature",
    },
    {
      technology: "React",
      category: "frontend",
      weight: 85,
      conditions: [
        { field: "complexity", operator: "in", value: ["moderate", "complex"] },
      ],
      rationale: "Rich component ecosystem handles complex UI requirements",
      tradeoffs: ["State management complexity", "Performance tuning needed"],
      learningCurve: "moderate",
      ecosystem: "mature",
    },
    {
      technology: "Vue",
      category: "frontend",
      weight: 80,
      conditions: [
        { field: "teamSize", operator: "equals", value: "small" },
        { field: "teamExperience", operator: "in", value: ["junior", "mixed"] },
      ],
      rationale:
        "Gentle learning curve with excellent documentation, perfect for small teams",
      tradeoffs: ["Smaller ecosystem than React", "Fewer senior developers"],
      learningCurve: "easy",
      ecosystem: "mature",
    },
    {
      technology: "Svelte",
      category: "frontend",
      weight: 85,
      conditions: [
        { field: "performanceNeeds", operator: "equals", value: "high" },
      ],
      rationale: "No virtual DOM means faster runtime and smaller bundle sizes",
      tradeoffs: ["Smaller ecosystem", "Less enterprise adoption"],
      learningCurve: "easy",
      ecosystem: "growing",
    },
    // Add more frontend rules...
  ],

  backend: [
    {
      technology: "Express",
      category: "backend",
      weight: 75,
      conditions: [
        { field: "complexity", operator: "equals", value: "simple" },
      ],
      rationale:
        "Minimal and flexible, perfect for simple APIs with minimal overhead",
      tradeoffs: ["Manual validation setup", "No built-in structure"],
      learningCurve: "easy",
      ecosystem: "mature",
    },
    {
      technology: "Fastify",
      category: "backend",
      weight: 90,
      conditions: [
        {
          field: "performanceNeeds",
          operator: "in",
          value: ["high", "realtime"],
        },
      ],
      rationale: "2x faster than Express with built-in schema validation",
      tradeoffs: [
        "Smaller middleware ecosystem",
        "Less Stack Overflow answers",
      ],
      learningCurve: "moderate",
      ecosystem: "growing",
    },
    {
      technology: "NestJS",
      category: "backend",
      weight: 95,
      conditions: [
        { field: "teamSize", operator: "in", value: ["medium", "large"] },
        { field: "complexity", operator: "equals", value: "complex" },
      ],
      rationale:
        "Enterprise-ready architecture with dependency injection and modules",
      tradeoffs: ["Steep learning curve", "Over-engineered for small apps"],
      learningCurve: "steep",
      ecosystem: "mature",
    },
    // Add more backend rules...
  ],

  database: [
    {
      technology: "PostgreSQL",
      category: "database",
      weight: 95,
      conditions: [
        { field: "needsRelationships", operator: "equals", value: true },
      ],
      rationale:
        "ACID guarantees with JSON support, best of both SQL and NoSQL worlds",
      tradeoffs: ["More setup than SQLite", "Schema migrations required"],
      learningCurve: "moderate",
      ecosystem: "mature",
    },
    {
      technology: "SQLite",
      category: "database",
      weight: 85,
      conditions: [
        { field: "dataScale", operator: "equals", value: "small" },
        { field: "expectedUsers", operator: "equals", value: "few" },
      ],
      rationale:
        "Zero-config file-based database, perfect for MVPs and prototypes",
      tradeoffs: ["Limited concurrency", "No built-in replication"],
      learningCurve: "easy",
      ecosystem: "mature",
    },
    {
      technology: "MongoDB",
      category: "database",
      weight: 80,
      conditions: [
        { field: "dataStructure", operator: "equals", value: "document" },
        { field: "needsRelationships", operator: "equals", value: false },
      ],
      rationale:
        "Flexible schema with native JSON, fast for read-heavy applications",
      tradeoffs: ["No multi-document ACID", "Easy to create schema debt"],
      learningCurve: "moderate",
      ecosystem: "mature",
    },
    // Add more database rules...
  ],

  hosting: [
    {
      technology: "Vercel",
      category: "hosting",
      weight: 90,
      conditions: [
        { field: "frontend", operator: "in", value: ["React", "Next.js"] },
        { field: "budget", operator: "in", value: ["moderate", "flexible"] },
      ],
      rationale:
        "Zero-config deploys with edge functions, optimal for Next.js apps",
      tradeoffs: ["Expensive at scale", "Serverless cold starts"],
      learningCurve: "easy",
      ecosystem: "mature",
    },
    {
      technology: "Railway",
      category: "hosting",
      weight: 85,
      conditions: [
        { field: "budget", operator: "in", value: ["minimal", "moderate"] },
      ],
      rationale:
        "Simple pricing with built-in databases, excellent developer experience",
      tradeoffs: ["Limited global network", "Fewer regions than AWS"],
      learningCurve: "easy",
      ecosystem: "growing",
    },
    {
      technology: "AWS",
      category: "hosting",
      weight: 95,
      conditions: [
        { field: "scalabilityNeeds", operator: "equals", value: "both" },
        { field: "expectedUsers", operator: "equals", value: "enterprise" },
      ],
      rationale:
        "Unlimited scale with every service imaginable, enterprise-grade",
      tradeoffs: ["Complex setup", "Steep learning curve", "Cost management"],
      learningCurve: "steep",
      ecosystem: "mature",
    },
    // Add more hosting rules...
  ],
};
```

#### 3. Types Definition

**File:** `src/agents/architect/types.ts` (MODIFY EXISTING)

Add the interfaces defined in FR-1 to this file.

#### 4. Integration with Architect Agent

**File:** `src/agents/architect-agent.ts` (MODIFY EXISTING)

```typescript
import { TechStackDecisionTree } from "./architect/decision-tree";

export class ArchitectAgent {
  private decisionTree: TechStackDecisionTree;

  constructor() {
    this.decisionTree = new TechStackDecisionTree();
  }

  /**
   * Generate architecture recommendations for a project
   */
  generateArchitecture(projectBrief: string): ArchitectureProposal {
    // Parse project brief to extract requirements
    const requirements = this.parseRequirements(projectBrief);

    // Get tech stack recommendations
    const techStack = this.decisionTree.evaluate(requirements);

    // Generate complete architecture proposal
    return {
      techStack,
      componentDiagram: this.generateComponentDiagram(techStack),
      deploymentStrategy: this.generateDeploymentStrategy(techStack),
      scalabilityPlan: this.generateScalabilityPlan(techStack, requirements),
    };
  }
}
```

### Database Schema

**No database changes required** - Decision tree operates in-memory with statically defined rules.

Future enhancement could add:

- `architecture_decisions` table to log recommendations
- `rule_effectiveness` table to track which recommendations succeeded

### Integration Points

#### 1. Architect Agent Workflow

```
Project Brief (text)
    ↓
parseRequirements() → ProjectRequirements
    ↓
TechStackDecisionTree.evaluate() → TechStackRecommendation
    ↓
generateArchitectureProposal() → Complete Architecture Document
```

#### 2. Rule Customization (Future)

Allow users to override default rules:

```typescript
// Load custom rules from config file
const customRules = loadCustomRules("./architect-rules.yaml");
const tree = new TechStackDecisionTree(customRules);
```

#### 3. Telemetry (Future)

Track recommendation outcomes:

```typescript
// After project is built, record outcome
trackRecommendationOutcome({
  recommendationId: 'abc123',
  actualStack: { frontend: 'React', backend: 'Fastify', ... },
  success: true,
  performanceMetrics: { ... },
});
```

### Error Handling

#### 1. Invalid Requirements

**Scenario:** Missing required fields or invalid values

**Recovery:**

```typescript
try {
  const recommendation = tree.evaluate(requirements);
} catch (error) {
  if (error instanceof ValidationError) {
    return {
      error: "Invalid requirements",
      details: error.validationErrors,
      suggestion: "Provide teamSize, complexity, and dataStructure",
    };
  }
}
```

#### 2. No Matching Rules

**Scenario:** Requirements don't match any rules (impossible constraints)

**Recovery:**

```typescript
if (recommendation.confidence < 0.3) {
  console.warn(
    "Low confidence recommendation - requirements may be contradictory",
  );
  return recommendation; // Still return best effort
}
```

#### 3. Conflicting Constraints

**Scenario:** mustUse includes "MongoDB" but dataStructure = "relational"

**Recovery:**

```typescript
// Prioritize hard constraints (mustUse) over recommendations
// Include warning in rationale: "Note: MongoDB not ideal for relational data"
```

---

## Pass Criteria

### Core Functionality

1. ✅ **TechStackDecisionTree class exists** - Located at `src/agents/architect/decision-tree.ts`
2. ✅ **evaluate() method works** - Returns TechStackRecommendation with all 4 categories
3. ✅ **Decision rules cover all categories** - Frontend, backend, database, hosting
4. ✅ **Rationale included for each choice** - Every TechnologyChoice has rationale string
5. ✅ **TechStackRecommendation interface followed** - Output matches spec exactly

### Decision Quality

6. ✅ **3+ scenarios handled correctly** - Test cases pass for small team/simple, enterprise/complex, performance-critical
7. ✅ **Confidence scores calculated** - Each choice has confidence 0.0-1.0
8. ✅ **Tradeoffs documented** - Every technology includes what you gain vs. lose
9. ✅ **Learning curve assessed** - Each choice includes easy/moderate/steep
10. ✅ **Alternatives provided** - Each TechnologyChoice includes 2-3 alternatives

### Rule Coverage

11. ✅ **Frontend rules: 3+ frameworks** - React, Vue, Svelte covered
12. ✅ **Backend rules: 3+ frameworks** - Express, Fastify, NestJS covered
13. ✅ **Database rules: 3+ options** - PostgreSQL, SQLite, MongoDB covered
14. ✅ **Hosting rules: 3+ platforms** - Vercel, Railway, AWS covered
15. ✅ **Each rule has rationale** - All rules include why recommendation applies

### Integration

16. ✅ **TypeScript compilation passes** - No type errors in decision-tree.ts
17. ✅ **Types defined correctly** - ProjectRequirements and TechStackRecommendation interfaces exist
18. ✅ **Integration with Architect Agent** - architect-agent.ts imports and uses decision tree
19. ✅ **Constraint validation works** - mustUse and mustAvoid honored

### Testing

20. ✅ **Unit tests pass** - All decision rules tested individually
21. ✅ **Integration test passes** - End-to-end evaluation produces valid recommendations
22. ✅ **Edge case handling** - Missing fields, conflicting constraints, extreme values tested
23. ✅ **Deterministic results** - Same input always produces same output

---

## Dependencies

### Upstream (Must Complete First)

- ✅ TypeScript compilation environment
- ✅ Project structure (`src/agents/architect/` directory)
- 🔄 VIBE-P10-002: Architecture Template System (in progress - complements this task)

### Downstream (Depends on This)

- VIBE-P10-004: Architecture Proposal Generator (uses tech stack recommendations)
- VIBE-P10-005: Component Diagram Generator (visualizes architecture)
- VIBE-P11-001: Architect Agent Orchestration (full agent workflow)

### External Dependencies

- None (pure TypeScript, no external libraries required)

---

## Implementation Plan

### Phase 1: Foundation (2 hours)

1. Create `src/agents/architect/types.ts` with interfaces
2. Create `src/agents/architect/decision-tree.ts` with class skeleton
3. Create `src/agents/architect/rules.ts` with empty rule sets
4. Set up test file: `src/agents/architect/__tests__/decision-tree.test.ts`

### Phase 2: Core Rules (2 hours)

5. Implement frontend decision rules (React, Vue, Svelte, Next.js)
6. Implement backend decision rules (Express, Fastify, NestJS, Hono)
7. Implement database decision rules (PostgreSQL, SQLite, MongoDB, Redis, Supabase)
8. Implement hosting decision rules (Vercel, Railway, AWS, Fly.io, DigitalOcean)

### Phase 3: Evaluation Logic (2 hours)

9. Implement `evaluateRule()` method with condition checking
10. Implement `rankChoices()` method with scoring
11. Implement `selectBest()` method with confidence calculation
12. Implement `validateRequirements()` with defaults and validation

### Phase 4: Testing & Integration (2 hours)

13. Write unit tests for each rule category
14. Write integration test for complete evaluation
15. Test edge cases (missing fields, conflicts, extremes)
16. Integrate with architect-agent.ts
17. Document usage in README

**Total Estimated Effort:** 8 hours (1 day)

---

## Testing Strategy

### Unit Tests

```typescript
// decision-tree.test.ts
describe("TechStackDecisionTree", () => {
  let tree: TechStackDecisionTree;

  beforeEach(() => {
    tree = new TechStackDecisionTree();
  });

  describe("Frontend Decisions", () => {
    it("recommends React for large teams", () => {
      const reqs: ProjectRequirements = {
        teamSize: "large",
        teamExperience: "mixed",
        complexity: "moderate",
        expectedUsers: "moderate",
        performanceNeeds: "standard",
        dataStructure: "relational",
        dataScale: "medium",
        needsRelationships: true,
        budget: "moderate",
        deploymentComplexity: "simple",
        scalabilityNeeds: "horizontal",
      };

      const result = tree.evaluate(reqs);
      expect(result.frontend.name).toBe("React");
      expect(result.frontend.rationale).toContain("ecosystem");
    });

    it("recommends Vue for small junior teams", () => {
      const reqs: ProjectRequirements = {
        teamSize: "small",
        teamExperience: "junior",
        complexity: "simple",
        // ... rest of required fields
      };

      const result = tree.evaluate(reqs);
      expect(result.frontend.name).toBe("Vue");
      expect(result.frontend.learningCurve).toBe("easy");
    });

    it("recommends Svelte for high performance needs", () => {
      const reqs: ProjectRequirements = {
        performanceNeeds: "high",
        complexity: "simple",
        // ... rest of required fields
      };

      const result = tree.evaluate(reqs);
      expect(result.frontend.name).toBe("Svelte");
      expect(result.frontend.rationale).toContain("faster runtime");
    });
  });

  describe("Backend Decisions", () => {
    it("recommends Fastify for high performance", () => {
      const reqs: ProjectRequirements = {
        performanceNeeds: "realtime",
        expectedUsers: "high",
        // ...
      };

      const result = tree.evaluate(reqs);
      expect(result.backend.name).toBe("Fastify");
    });

    it("recommends NestJS for complex enterprise apps", () => {
      const reqs: ProjectRequirements = {
        teamSize: "large",
        teamExperience: "senior",
        complexity: "complex",
        // ...
      };

      const result = tree.evaluate(reqs);
      expect(result.backend.name).toBe("NestJS");
    });
  });

  describe("Database Decisions", () => {
    it("recommends PostgreSQL for relational data", () => {
      const reqs: ProjectRequirements = {
        dataStructure: "relational",
        needsRelationships: true,
        dataScale: "medium",
        // ...
      };

      const result = tree.evaluate(reqs);
      expect(result.database.name).toBe("PostgreSQL");
    });

    it("recommends SQLite for small MVP projects", () => {
      const reqs: ProjectRequirements = {
        dataScale: "small",
        expectedUsers: "few",
        deploymentComplexity: "simple",
        // ...
      };

      const result = tree.evaluate(reqs);
      expect(result.database.name).toBe("SQLite");
    });
  });

  describe("Constraint Handling", () => {
    it("honors mustUse constraints", () => {
      const reqs: ProjectRequirements = {
        teamSize: "small",
        mustUse: ["MongoDB"],
        dataStructure: "relational", // Would normally suggest PostgreSQL
        // ...
      };

      const result = tree.evaluate(reqs);
      expect(result.database.name).toBe("MongoDB");
    });

    it("respects mustAvoid constraints", () => {
      const reqs: ProjectRequirements = {
        teamSize: "large",
        mustAvoid: ["React"],
        complexity: "complex", // Would normally suggest React
        // ...
      };

      const result = tree.evaluate(reqs);
      expect(result.frontend.name).not.toBe("React");
    });
  });

  describe("Edge Cases", () => {
    it("handles missing optional fields with defaults", () => {
      const reqs: ProjectRequirements = {
        teamSize: "small",
        complexity: "simple",
        dataStructure: "relational",
        // Missing many optional fields
      } as any;

      const result = tree.evaluate(reqs);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("returns low confidence for contradictory requirements", () => {
      const reqs: ProjectRequirements = {
        budget: "minimal",
        scalabilityNeeds: "both",
        expectedUsers: "enterprise",
        deploymentComplexity: "simple",
        // Contradictory: minimal budget but enterprise scale
        // ...
      };

      const result = tree.evaluate(reqs);
      expect(result.confidence).toBeLessThan(0.6);
    });
  });
});
```

### Integration Tests

```typescript
// integration.test.ts
describe("Decision Tree Integration", () => {
  it("generates complete tech stack for startup MVP", () => {
    const tree = new TechStackDecisionTree();
    const reqs: ProjectRequirements = {
      teamSize: "solo",
      teamExperience: "mixed",
      complexity: "simple",
      expectedUsers: "few",
      performanceNeeds: "standard",
      dataStructure: "relational",
      dataScale: "small",
      needsRelationships: true,
      budget: "minimal",
      deploymentComplexity: "simple",
      scalabilityNeeds: "none",
    };

    const result = tree.evaluate(reqs);

    // Expect lightweight stack for MVP
    expect(result.frontend.name).toBe("Vue"); // Easy learning
    expect(result.backend.name).toBe("Express"); // Simple
    expect(result.database.name).toBe("SQLite"); // Zero config
    expect(result.hosting.name).toBe("Railway"); // Budget-friendly
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("generates enterprise-grade stack", () => {
    const tree = new TechStackDecisionTree();
    const reqs: ProjectRequirements = {
      teamSize: "large",
      teamExperience: "senior",
      complexity: "complex",
      expectedUsers: "enterprise",
      performanceNeeds: "realtime",
      dataStructure: "relational",
      dataScale: "large",
      needsRelationships: true,
      budget: "flexible",
      deploymentComplexity: "advanced",
      scalabilityNeeds: "both",
    };

    const result = tree.evaluate(reqs);

    // Expect enterprise stack
    expect(result.frontend.name).toBe("React"); // Ecosystem
    expect(result.backend.name).toBe("NestJS"); // Architecture
    expect(result.database.name).toBe("PostgreSQL"); // ACID + scale
    expect(result.hosting.name).toBe("AWS"); // Unlimited scale
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
```

### Manual Testing Checklist

- [ ] Create requirements for 5 different project types
- [ ] Verify rationale makes sense for each recommendation
- [ ] Check that alternatives are reasonable
- [ ] Validate tradeoffs are accurate
- [ ] Ensure learning curve assessment is realistic
- [ ] Confirm confidence scores correlate with rule match quality
- [ ] Test with conflicting requirements (low confidence expected)
- [ ] Test with explicit mustUse/mustAvoid constraints

---

## Success Metrics

### Operational

- Decision tree evaluates requirements in <50ms (target: 20-30ms)
- 100% of test cases pass (20+ test cases covering all categories)
- Zero TypeScript compilation errors

### Quality

- Rationale text is clear and actionable (peer review validation)
- Confidence scores >0.7 for well-defined requirements
- Confidence scores 0.3-0.6 for ambiguous/conflicting requirements
- Alternatives are genuinely viable (not just filler options)

### Future (Post-MVP)

- Track recommendation outcomes in production
- Measure correlation between confidence score and project success
- Collect feedback: "Was this recommendation helpful?" (thumbs up/down)

---

## References

### Technology Documentation

- React: https://react.dev
- Vue: https://vuejs.org
- Svelte: https://svelte.dev
- Fastify: https://fastify.dev
- NestJS: https://nestjs.com
- PostgreSQL: https://postgresql.org
- Vercel: https://vercel.com/docs

### Architecture Resources

- `src/agents/architect/templates/` - Template system (parallel work)
- `docs/specs/VIBE-P10-002-architecture-template-system.md` - Related spec
- STRATEGIC_PLAN.md - Overall platform vision

---

## Conclusion

The Tech Stack Decision Tree provides a systematic, transparent, and extensible framework for technology selection. By encoding decision logic as explicit rules with rationale, the Architect Agent can make consistent recommendations while remaining explainable and auditable.

**Key Design Principles:**

1. **Transparency** - Every decision includes "why" explanation
2. **Extensibility** - New technologies and rules easily added
3. **Testability** - Deterministic evaluation enables comprehensive testing
4. **Pragmatism** - Rules reflect real-world tradeoffs, not ivory tower ideals

**Next Steps:**

1. **Implementation** - Build according to this specification (8 hours)
2. **Validation** - Test with 10+ diverse project scenarios
3. **Integration** - Connect to Architect Agent workflow (VIBE-P10-005)
4. **Iteration** - Refine rules based on real project outcomes

**Status:** Ready for implementation.
