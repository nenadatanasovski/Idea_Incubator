/**
 * Architect Agent
 *
 * Core implementation of the Architect Agent that extends ObservableAgent
 * to generate architecture documentation, component specifications, and
 * technical decisions based on requirements.
 */

import { ObservableAgent } from "../../server/agents/observable-agent.js";
import { v4 as uuid } from "uuid";
import {
  ArchitectInput,
  ArchitectOutput,
  ArchitectureDoc,
  ComponentSpec,
  TechStackDecision,
  APIContract,
  DatabaseSchema,
  QualityAttribute,
  ArchitectureRisk,
  TechChoice,
} from "./types.js";
import {
  ARCHITECTURE_ANALYSIS_PROMPT,
  COMPONENT_DESIGN_PROMPT,
  TECH_STACK_DECISION_PROMPT,
  API_CONTRACT_PROMPT,
  DATABASE_SCHEMA_PROMPT,
  RISK_ASSESSMENT_PROMPT,
  DEPLOYMENT_ARCHITECTURE_PROMPT,
  ARCHITECTURE_DOC_TEMPLATE,
  formatComponentAsMarkdown,
  formatTechChoiceAsMarkdown,
} from "./prompts.js";

export interface ArchitectAgentConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  verbose?: boolean;
}

/**
 * Architect Agent - Generates system architecture from requirements
 *
 * Capabilities:
 * - Architecture analysis and design
 * - Component specification
 * - Tech stack recommendations
 * - API contract design
 * - Database schema design
 * - Risk assessment
 * - Deployment architecture
 */
export class ArchitectAgent extends ObservableAgent {
  private systemPrompts: Map<string, string>;

  constructor(_config: ArchitectAgentConfig = {}) {
    const executionId = `architect-${uuid().slice(0, 8)}`;
    const instanceId = `architect-agent-${uuid().slice(0, 8)}`;

    super({
      executionId,
      instanceId,
      agentType: "architect-agent",
    });

    // Initialize system prompts
    this.systemPrompts = new Map([
      ["architecture", ARCHITECTURE_ANALYSIS_PROMPT],
      ["component", COMPONENT_DESIGN_PROMPT],
      ["techstack", TECH_STACK_DECISION_PROMPT],
      ["api", API_CONTRACT_PROMPT],
      ["database", DATABASE_SCHEMA_PROMPT],
      ["risk", RISK_ASSESSMENT_PROMPT],
      ["deployment", DEPLOYMENT_ARCHITECTURE_PROMPT],
    ]);
  }

  /**
   * Main method to generate architecture from requirements
   */
  async generateArchitecture(input: ArchitectInput): Promise<ArchitectOutput> {
    const taskId = `arch-gen-${input.projectName.toLowerCase().replace(/\s+/g, "-")}`;
    const startTime = Date.now();

    await this.logTaskStart(
      taskId,
      `Generate architecture for ${input.projectName}`,
    );

    try {
      // Phase 1: Requirements Analysis
      await this.logPhaseStart("requirements-analysis", {
        projectName: input.projectName,
      });

      const analyzedRequirements = await this.analyzeRequirements(input);

      await this.logPhaseEnd("requirements-analysis", {
        componentsIdentified: analyzedRequirements.components.length,
        constraintsCount: analyzedRequirements.constraints.length,
      });

      // Phase 2: Architecture Design
      await this.logPhaseStart("architecture-design");

      const architecture = await this.designArchitecture(
        input,
        analyzedRequirements,
      );

      await this.logPhaseEnd("architecture-design", {
        componentsDesigned: architecture.components.length,
        risksIdentified: architecture.risks.length,
      });

      // Phase 3: Documentation Generation
      await this.logPhaseStart("documentation-generation");

      const documentation = this.generateDocumentation(architecture);
      const recommendations = this.generateRecommendations(architecture);
      const nextSteps = this.generateNextSteps(architecture);

      await this.logPhaseEnd("documentation-generation");

      // Complete task
      const duration = Date.now() - startTime;
      await this.logTaskEnd(taskId, "complete", {
        durationMs: duration,
        componentsGenerated: architecture.components.length,
      });

      const output: ArchitectOutput = {
        architecture,
        documentation,
        recommendations,
        nextSteps,
        metadata: {
          tokensUsed: 0, // Would be populated by actual LLM calls
          generatedAt: new Date(),
          confidence: 0.85, // Default confidence
        },
      };

      return output;
    } catch (error) {
      await this.logError(
        `Architecture generation failed: ${error instanceof Error ? error.message : String(error)}`,
        taskId,
      );
      await this.logTaskEnd(taskId, "failed");
      throw error;
    } finally {
      await this.close();
    }
  }

  /**
   * Analyze requirements to extract key architectural elements
   */
  private async analyzeRequirements(input: ArchitectInput): Promise<{
    components: string[];
    qualityAttributes: QualityAttribute[];
    constraints: string[];
    techPreferences: string[];
  }> {
    // This would call an LLM to analyze requirements
    // For now, return a structured analysis based on input

    const components: string[] = [];
    const qualityAttributes: QualityAttribute[] = [];
    const constraints = input.constraints || [];
    const techPreferences = input.preferences?.techStack || [];

    // Parse requirements to identify components
    // (In production, this would use LLM analysis)
    if (input.requirements.toLowerCase().includes("frontend")) {
      components.push("frontend");
    }
    if (
      input.requirements.toLowerCase().includes("backend") ||
      input.requirements.toLowerCase().includes("api")
    ) {
      components.push("backend");
    }
    if (input.requirements.toLowerCase().includes("database")) {
      components.push("database");
    }

    // Identify quality attributes
    if (
      input.requirements.toLowerCase().includes("performance") ||
      input.requirements.toLowerCase().includes("fast")
    ) {
      qualityAttributes.push({
        name: "Performance",
        category: "performance",
        requirement: "System should respond quickly to user requests",
        measurement: "API response time < 200ms p95",
        priority: "must-have",
      });
    }

    if (
      input.requirements.toLowerCase().includes("secure") ||
      input.requirements.toLowerCase().includes("security")
    ) {
      qualityAttributes.push({
        name: "Security",
        category: "security",
        requirement:
          "System must protect user data and prevent unauthorized access",
        measurement: "Pass security audit, implement authentication",
        priority: "must-have",
      });
    }

    return {
      components,
      qualityAttributes,
      constraints,
      techPreferences,
    };
  }

  /**
   * Design system architecture
   */
  private async designArchitecture(
    input: ArchitectInput,
    analyzed: {
      components: string[];
      qualityAttributes: QualityAttribute[];
      constraints: string[];
    },
  ): Promise<ArchitectureDoc> {
    // Design components
    const components: ComponentSpec[] = analyzed.components.map(
      (name, idx) => ({
        id: `comp-${idx + 1}`,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        type: this.getComponentType(name),
        description: `${name.charAt(0).toUpperCase() + name.slice(1)} component`,
        responsibilities: [`Handle ${name} functionality`],
        dependencies: [],
        interfaces: [],
        technology: this.suggestTechnology(name, input.preferences?.techStack),
        designPatterns: [],
      }),
    );

    // Design tech stack
    const techStack: TechStackDecision = this.designTechStack(input, analyzed);

    // Design API contracts
    const apiContracts: APIContract[] = [];

    // Design database schema
    const databaseSchema: DatabaseSchema = {
      type: "sql",
      tables: [],
      relationships: [],
      indexes: [],
    };

    // Identify risks
    const risks: ArchitectureRisk[] = this.identifyRisks(
      components,
      analyzed.constraints,
    );

    const architecture: ArchitectureDoc = {
      projectName: input.projectName,
      version: "1.0.0",
      overview: `Architecture for ${input.projectName}`,
      systemContext: input.requirements,
      components,
      techStack,
      apiContracts,
      databaseSchema,
      qualityAttributes: analyzed.qualityAttributes,
      constraints: analyzed.constraints,
      risks,
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        author: "Architect Agent",
        version: "1.0.0",
      },
    };

    return architecture;
  }

  /**
   * Get component type from name
   */
  private getComponentType(name: string): ComponentSpec["type"] {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("frontend") || nameLower.includes("ui"))
      return "frontend";
    if (nameLower.includes("backend") || nameLower.includes("api"))
      return "backend";
    if (nameLower.includes("database") || nameLower.includes("db"))
      return "database";
    if (nameLower.includes("service")) return "service";
    return "library";
  }

  /**
   * Suggest technology for a component
   */
  private suggestTechnology(
    componentName: string,
    preferences?: string[],
  ): string {
    const nameLower = componentName.toLowerCase();

    // Check preferences first
    if (preferences && preferences.length > 0) {
      for (const pref of preferences) {
        if (nameLower.includes(pref.toLowerCase())) {
          return pref;
        }
      }
    }

    // Default suggestions
    if (nameLower.includes("frontend")) return "React + TypeScript";
    if (nameLower.includes("backend")) return "Node.js + TypeScript";
    if (nameLower.includes("database")) return "PostgreSQL";

    return "To be determined";
  }

  /**
   * Design tech stack
   */
  private designTechStack(
    input: ArchitectInput,
    analyzed: { components: string[] },
  ): TechStackDecision {
    const techStack: TechStackDecision = {};

    if (analyzed.components.includes("frontend")) {
      techStack.frontend = {
        name:
          input.preferences?.techStack?.find(
            (t) =>
              t.toLowerCase().includes("react") ||
              t.toLowerCase().includes("vue"),
          ) || "React",
        rationale: "Popular, well-supported, component-based framework",
        alternatives: ["Vue.js", "Angular", "Svelte"],
        tradeoffs: ["Learning curve", "Bundle size"],
      };
    }

    if (analyzed.components.includes("backend")) {
      techStack.backend = {
        name: "Node.js + Express",
        rationale: "JavaScript everywhere, large ecosystem, good performance",
        alternatives: ["Python + FastAPI", "Go", "Java + Spring"],
        tradeoffs: ["Single-threaded model", "Callback complexity"],
      };
    }

    if (analyzed.components.includes("database")) {
      techStack.database = {
        name: "PostgreSQL",
        rationale: "Robust, feature-rich, ACID compliant, good performance",
        alternatives: ["MySQL", "MongoDB", "DynamoDB"],
        tradeoffs: ["Setup complexity", "Scaling requires planning"],
      };
    }

    return techStack;
  }

  /**
   * Identify architectural risks
   */
  private identifyRisks(
    components: ComponentSpec[],
    constraints: string[],
  ): ArchitectureRisk[] {
    const risks: ArchitectureRisk[] = [];

    // Generic risks based on complexity
    if (components.length > 5) {
      risks.push({
        id: "risk-001",
        category: "technical",
        description: "High component count may increase integration complexity",
        impact: "medium",
        probability: "medium",
        mitigation: "Define clear interfaces and use API contracts",
      });
    }

    // Add more risk analysis based on constraints
    for (const constraint of constraints) {
      if (
        constraint.toLowerCase().includes("timeline") ||
        constraint.toLowerCase().includes("time")
      ) {
        risks.push({
          id: `risk-${risks.length + 1}`,
          category: "business",
          description: "Tight timeline constraint may impact quality",
          impact: "high",
          probability: "medium",
          mitigation: "Prioritize MVP features, plan technical debt paydown",
        });
      }
    }

    return risks;
  }

  /**
   * Generate documentation
   */
  private generateDocumentation(architecture: ArchitectureDoc): string {
    let doc = ARCHITECTURE_DOC_TEMPLATE;

    // Replace placeholders
    doc = doc.replace("{projectName}", architecture.projectName);
    doc = doc.replace("{version}", architecture.version);
    doc = doc.replace(
      "{lastModified}",
      architecture.metadata.lastModified.toISOString(),
    );
    doc = doc.replace("{overview}", architecture.overview);
    doc = doc.replace("{systemContext}", architecture.systemContext);

    // Components section
    const componentsSection = architecture.components
      .map((c) => formatComponentAsMarkdown(c))
      .join("\n\n");
    doc = doc.replace("{components}", componentsSection);

    // Tech stack section
    const techStackSection = Object.entries(architecture.techStack)
      .map(([key, value]) =>
        formatTechChoiceAsMarkdown(key, value as TechChoice),
      )
      .join("\n\n");
    doc = doc.replace("{techStack}", techStackSection);

    // Simplified placeholders
    doc = doc.replace(
      "{apiContracts}",
      architecture.apiContracts.length > 0
        ? JSON.stringify(architecture.apiContracts, null, 2)
        : "No API contracts defined yet",
    );
    doc = doc.replace(
      "{databaseSchema}",
      JSON.stringify(architecture.databaseSchema, null, 2),
    );
    doc = doc.replace(
      "{deploymentArchitecture}",
      architecture.deploymentArchitecture
        ? JSON.stringify(architecture.deploymentArchitecture, null, 2)
        : "To be defined",
    );
    doc = doc.replace(
      "{qualityAttributes}",
      architecture.qualityAttributes
        .map((qa) => `- **${qa.name}** (${qa.priority}): ${qa.requirement}`)
        .join("\n"),
    );
    doc = doc.replace(
      "{constraints}",
      architecture.constraints.map((c) => `- ${c}`).join("\n") ||
        "None specified",
    );
    doc = doc.replace(
      "{risks}",
      architecture.risks
        .map(
          (r) =>
            `- **${r.id}**: ${r.description} (${r.impact} impact, ${r.probability} probability)\n  - Mitigation: ${r.mitigation}`,
        )
        .join("\n\n"),
    );

    // Placeholders for recommendations and next steps
    doc = doc.replace("{recommendations}", "See recommendations section");
    doc = doc.replace("{nextSteps}", "See next steps section");

    return doc;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(architecture: ArchitectureDoc): string[] {
    const recommendations: string[] = [];

    recommendations.push("Start with MVP scope focusing on core features");
    recommendations.push(
      "Implement comprehensive testing strategy from the start",
    );
    recommendations.push("Set up CI/CD pipeline early");
    recommendations.push("Document API contracts before implementation");

    if (architecture.risks.length > 0) {
      recommendations.push(
        "Address high-priority risks before implementation begins",
      );
    }

    return recommendations;
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(_architecture: ArchitectureDoc): string[] {
    return [
      "Review and validate architecture with stakeholders",
      "Refine component specifications and interfaces",
      "Create detailed API contracts",
      "Design database schema in detail",
      "Set up development environment",
      "Begin MVP implementation",
    ];
  }

  /**
   * Get system prompt for a specific capability
   */
  getSystemPrompt(capability: string): string {
    return this.systemPrompts.get(capability) || ARCHITECTURE_ANALYSIS_PROMPT;
  }

  /**
   * List supported capabilities
   */
  getSupportedCapabilities(): string[] {
    return Array.from(this.systemPrompts.keys());
  }
}

export default ArchitectAgent;
