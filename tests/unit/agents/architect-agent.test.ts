/**
 * Architect Agent - Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ArchitectAgent } from "../../../agents/architect/architect-agent.js";
import type { ArchitectInput } from "../../../agents/architect/types.js";

describe("ArchitectAgent", () => {
  let agent: ArchitectAgent;

  beforeEach(() => {
    agent = new ArchitectAgent({ verbose: false });
  });

  describe("initialization", () => {
    it("should instantiate successfully", () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(ArchitectAgent);
    });

    it("should have system prompts configured", () => {
      const capabilities = agent.getSupportedCapabilities();
      expect(capabilities).toContain("architecture");
      expect(capabilities).toContain("component");
      expect(capabilities).toContain("techstack");
      expect(capabilities).toContain("api");
      expect(capabilities).toContain("database");
      expect(capabilities).toContain("risk");
      expect(capabilities).toContain("deployment");
    });

    it("should return system prompts for each capability", () => {
      const archPrompt = agent.getSystemPrompt("architecture");
      expect(archPrompt).toBeDefined();
      expect(archPrompt.length).toBeGreaterThan(0);
      expect(archPrompt).toContain("architect");
    });
  });

  describe("generateArchitecture", () => {
    it("should respond to basic architecture request", async () => {
      const input: ArchitectInput = {
        projectName: "Test Project",
        requirements: "Build a simple web application with frontend and backend",
        constraints: ["Use TypeScript", "Deploy to cloud"],
      };

      const output = await agent.generateArchitecture(input);

      // Verify output structure
      expect(output).toBeDefined();
      expect(output.architecture).toBeDefined();
      expect(output.documentation).toBeDefined();
      expect(output.recommendations).toBeDefined();
      expect(output.nextSteps).toBeDefined();
      expect(output.metadata).toBeDefined();

      // Verify architecture content
      expect(output.architecture.projectName).toBe("Test Project");
      expect(output.architecture.components).toBeDefined();
      expect(output.architecture.components.length).toBeGreaterThan(0);
      expect(output.architecture.techStack).toBeDefined();
      expect(output.architecture.constraints).toEqual(input.constraints);

      // Verify metadata
      expect(output.metadata.generatedAt).toBeInstanceOf(Date);
      expect(output.metadata.confidence).toBeGreaterThan(0);
    });

    it("should identify components from requirements", async () => {
      const input: ArchitectInput = {
        projectName: "Full Stack App",
        requirements: "Build a web app with React frontend, Node.js backend API, and PostgreSQL database",
      };

      const output = await agent.generateArchitecture(input);

      // Should identify frontend, backend, and database components
      const componentNames = output.architecture.components.map(c => c.name.toLowerCase());
      expect(componentNames.some(name => name.includes("frontend"))).toBe(true);
      expect(componentNames.some(name => name.includes("backend"))).toBe(true);
      expect(componentNames.some(name => name.includes("database"))).toBe(true);
    });

    it("should identify quality attributes from requirements", async () => {
      const input: ArchitectInput = {
        projectName: "Secure App",
        requirements: "Build a secure application with high performance requirements",
      };

      const output = await agent.generateArchitecture(input);

      // Should identify security and performance as quality attributes
      const qaCategories = output.architecture.qualityAttributes.map(qa => qa.category);
      expect(qaCategories).toContain("security");
      expect(qaCategories).toContain("performance");
    });

    it("should generate recommendations", async () => {
      const input: ArchitectInput = {
        projectName: "MVP Project",
        requirements: "Build an MVP quickly",
      };

      const output = await agent.generateArchitecture(input);

      expect(output.recommendations).toBeDefined();
      expect(output.recommendations.length).toBeGreaterThan(0);
      expect(output.recommendations.some(r => r.toLowerCase().includes("mvp"))).toBe(true);
    });

    it("should generate next steps", async () => {
      const input: ArchitectInput = {
        projectName: "New Project",
        requirements: "Start a new project",
      };

      const output = await agent.generateArchitecture(input);

      expect(output.nextSteps).toBeDefined();
      expect(output.nextSteps.length).toBeGreaterThan(0);
    });

    it("should respect tech stack preferences", async () => {
      const input: ArchitectInput = {
        projectName: "React App",
        requirements: "Build a frontend application",
        preferences: {
          techStack: ["React", "TypeScript"],
        },
      };

      const output = await agent.generateArchitecture(input);

      // Frontend component should use React
      const frontendComponent = output.architecture.components.find(
        c => c.type === "frontend"
      );
      expect(frontendComponent).toBeDefined();
      expect(frontendComponent?.technology.toLowerCase()).toContain("react");
    });

    it("should identify architectural risks", async () => {
      const input: ArchitectInput = {
        projectName: "Complex System",
        requirements: "Build a complex multi-component system",
        constraints: ["Very tight timeline"],
      };

      const output = await agent.generateArchitecture(input);

      expect(output.architecture.risks).toBeDefined();
      expect(output.architecture.risks.length).toBeGreaterThan(0);

      // Should have risk with mitigation strategy
      const risk = output.architecture.risks[0];
      expect(risk.description).toBeDefined();
      expect(risk.impact).toBeDefined();
      expect(risk.probability).toBeDefined();
      expect(risk.mitigation).toBeDefined();
    });
  });
});
