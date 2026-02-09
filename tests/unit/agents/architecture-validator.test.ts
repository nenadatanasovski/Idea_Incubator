/**
 * Architecture Validator Tests
 *
 * Tests for the ArchitectureValidator class including:
 * - Detection of anti-patterns (god components, circular dependencies)
 * - API design validation (authentication, rate limiting, naming conventions)
 * - Database design validation (primary keys, indexes, soft deletes)
 * - Security concern validation
 * - Caching strategy validation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ArchitectureValidator } from "../../../agents/architect/architecture-validator.js";
import { ArchitectureDoc } from "../../../agents/architect/types.js";

describe("ArchitectureValidator", () => {
  let validator: ArchitectureValidator;

  beforeEach(() => {
    validator = new ArchitectureValidator();
  });

  describe("validate() method exists and returns ValidationReport", () => {
    it("should have a validate method", () => {
      expect(validator.validate).toBeDefined();
      expect(typeof validator.validate).toBe("function");
    });

    it("should return a ValidationReport with required fields", () => {
      const minimalArch: ArchitectureDoc = {
        projectName: "Test Project",
        version: "1.0.0",
        overview: "Test",
        systemContext: "Test",
        components: [],
        techStack: {},
        apiContracts: [],
        databaseSchema: { type: "sql" },
        qualityAttributes: [],
        constraints: [],
        risks: [],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          author: "Test",
          version: "1.0.0",
        },
      };

      const report = validator.validate(minimalArch);

      expect(report).toBeDefined();
      expect(report.projectName).toBe("Test Project");
      expect(report.generatedAt).toBeDefined();
      expect(typeof report.isValid).toBe("boolean");
      expect(typeof report.totalIssues).toBe("number");
      expect(typeof report.errorCount).toBe("number");
      expect(typeof report.warningCount).toBe("number");
      expect(typeof report.infoCount).toBe("number");
      expect(Array.isArray(report.issues)).toBe(true);
      expect(typeof report.summary).toBe("string");
    });
  });

  describe("Anti-pattern detection", () => {
    describe("God Component detection", () => {
      it("should detect components with too many responsibilities", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [
            {
              id: "comp-1",
              name: "GodComponent",
              type: "backend",
              description: "A problematic component",
              responsibilities: [
                "Handle user auth",
                "Process payments",
                "Send emails",
                "Generate reports",
                "Manage database",
                "Handle caching",
                "Log events",
                "Validate input",
                "Transform data",
              ],
              dependencies: [],
              interfaces: [],
              technology: "Node.js",
              designPatterns: [],
            },
          ],
          techStack: {},
          apiContracts: [],
          databaseSchema: { type: "sql" },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const godComponentIssues = report.issues.filter(i => i.type === "god-component");

        expect(godComponentIssues.length).toBeGreaterThan(0);
        expect(godComponentIssues[0].severity).toBe("warning");
        expect(godComponentIssues[0].component).toBe("GodComponent");
        expect(godComponentIssues[0].remediation).toContain("Break down");
      });

      it("should not flag components with reasonable responsibilities", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [
            {
              id: "comp-1",
              name: "UserService",
              type: "backend",
              description: "Handles user management",
              responsibilities: [
                "Create users",
                "Update profiles",
                "Delete users",
              ],
              dependencies: [],
              interfaces: [],
              technology: "Node.js",
              designPatterns: [],
            },
          ],
          techStack: {},
          apiContracts: [],
          databaseSchema: { type: "sql" },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const godComponentIssues = report.issues.filter(i => i.type === "god-component");

        expect(godComponentIssues.length).toBe(0);
      });
    });

    describe("Circular dependency detection", () => {
      it("should detect circular dependencies between components", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [
            {
              id: "comp-1",
              name: "ComponentA",
              type: "backend",
              description: "Component A",
              responsibilities: [],
              dependencies: ["comp-2"], // A depends on B
              interfaces: [],
              technology: "Node.js",
              designPatterns: [],
            },
            {
              id: "comp-2",
              name: "ComponentB",
              type: "backend",
              description: "Component B",
              responsibilities: [],
              dependencies: ["comp-1"], // B depends on A (cycle!)
              interfaces: [],
              technology: "Node.js",
              designPatterns: [],
            },
          ],
          techStack: {},
          apiContracts: [],
          databaseSchema: { type: "sql" },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const circularIssues = report.issues.filter(i => i.type === "circular-dependency");

        expect(circularIssues.length).toBeGreaterThan(0);
        expect(circularIssues[0].severity).toBe("error");
        expect(report.errorCount).toBeGreaterThan(0);
      });

      it("should not flag acyclic dependencies", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [
            {
              id: "comp-1",
              name: "ComponentA",
              type: "backend",
              description: "Component A",
              responsibilities: [],
              dependencies: ["comp-2"],
              interfaces: [],
              technology: "Node.js",
              designPatterns: [],
            },
            {
              id: "comp-2",
              name: "ComponentB",
              type: "backend",
              description: "Component B",
              responsibilities: [],
              dependencies: [],
              interfaces: [],
              technology: "Node.js",
              designPatterns: [],
            },
          ],
          techStack: {},
          apiContracts: [],
          databaseSchema: { type: "sql" },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const circularIssues = report.issues.filter(i => i.type === "circular-dependency");

        expect(circularIssues.length).toBe(0);
      });
    });
  });

  describe("API design validation", () => {
    describe("Authentication validation", () => {
      it("should detect missing authentication", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [],
          techStack: {},
          apiContracts: [
            {
              id: "api-1",
              name: "PublicAPI",
              type: "rest",
              version: "1.0",
              endpoints: [],
              // No authentication specified
            },
          ],
          databaseSchema: { type: "sql" },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const authIssues = report.issues.filter(i => i.type === "missing-authentication");

        expect(authIssues.length).toBeGreaterThan(0);
        expect(authIssues[0].severity).toBe("error");
        expect(authIssues[0].remediation).toContain("JWT");
      });

      it("should not flag APIs with authentication specified", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [],
          techStack: {},
          apiContracts: [
            {
              id: "api-1",
              name: "SecureAPI",
              type: "rest",
              version: "1.0",
              endpoints: [],
              authentication: {
                type: "jwt",
                description: "JWT bearer tokens",
              },
            },
          ],
          databaseSchema: { type: "sql" },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const authIssues = report.issues.filter(i => i.type === "missing-authentication");

        expect(authIssues.length).toBe(0);
      });
    });

    describe("Rate limiting validation", () => {
      it("should detect missing rate limiting", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [],
          techStack: {},
          apiContracts: [
            {
              id: "api-1",
              name: "TestAPI",
              type: "rest",
              version: "1.0",
              endpoints: [],
              // No rate limit specified
            },
          ],
          databaseSchema: { type: "sql" },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const rateLimitIssues = report.issues.filter(i => i.type === "missing-rate-limiting");

        expect(rateLimitIssues.length).toBeGreaterThan(0);
        expect(rateLimitIssues[0].severity).toBe("warning");
      });
    });

    describe("Endpoint naming convention validation", () => {
      it("should detect camelCase in endpoint paths", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [],
          techStack: {},
          apiContracts: [
            {
              id: "api-1",
              name: "TestAPI",
              type: "rest",
              version: "1.0",
              endpoints: [
                {
                  path: "/userProfiles", // camelCase - bad!
                  method: "GET",
                  description: "Get user profiles",
                  responses: {
                    200: { description: "Success" },
                  },
                },
              ],
              authentication: {
                type: "jwt",
                description: "JWT bearer tokens",
              },
            },
          ],
          databaseSchema: { type: "sql" },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const namingIssues = report.issues.filter(i => i.type === "inconsistent-naming");

        expect(namingIssues.length).toBeGreaterThan(0);
        expect(namingIssues[0].severity).toBe("warning");
        expect(namingIssues[0].remediation).toContain("kebab-case");
      });
    });

    describe("Pagination validation", () => {
      it("should detect missing pagination on list endpoints", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [],
          techStack: {},
          apiContracts: [
            {
              id: "api-1",
              name: "TestAPI",
              type: "rest",
              version: "1.0",
              endpoints: [
                {
                  path: "/users/list", // looks like a list endpoint
                  method: "GET",
                  description: "Get users list",
                  responses: {
                    200: { description: "Success" },
                  },
                  // No pagination parameters!
                },
              ],
              authentication: {
                type: "jwt",
                description: "JWT bearer tokens",
              },
            },
          ],
          databaseSchema: { type: "sql" },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const paginationIssues = report.issues.filter(i => i.type === "missing-pagination");

        expect(paginationIssues.length).toBeGreaterThan(0);
        expect(paginationIssues[0].severity).toBe("warning");
      });
    });
  });

  describe("Database design validation", () => {
    describe("Primary key validation", () => {
      it("should detect tables without primary keys", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [],
          techStack: {},
          apiContracts: [],
          databaseSchema: {
            type: "sql",
            tables: [
              {
                name: "users",
                description: "User table",
                columns: [
                  { name: "email", type: "VARCHAR", nullable: false, description: "Email" },
                  { name: "name", type: "VARCHAR", nullable: false, description: "Name" },
                ],
                primaryKey: [], // Missing primary key!
              },
            ],
          },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const pkIssues = report.issues.filter(i => i.type === "missing-primary-key");

        expect(pkIssues.length).toBeGreaterThan(0);
        expect(pkIssues[0].severity).toBe("error");
      });
    });

    describe("Index validation (N+1 prevention)", () => {
      it("should detect missing indexes on foreign keys", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [],
          techStack: {},
          apiContracts: [],
          databaseSchema: {
            type: "sql",
            tables: [
              {
                name: "posts",
                description: "Posts table",
                columns: [
                  { name: "id", type: "INT", nullable: false, description: "ID" },
                  { name: "user_id", type: "INT", nullable: false, description: "User ID" }, // FK without index!
                  { name: "title", type: "VARCHAR", nullable: false, description: "Title" },
                ],
                primaryKey: ["id"],
              },
            ],
            indexes: [], // No indexes defined!
          },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const indexIssues = report.issues.filter(i => i.type === "missing-index");

        expect(indexIssues.length).toBeGreaterThan(0);
        expect(indexIssues[0].severity).toBe("warning");
        expect(indexIssues[0].remediation).toContain("index");
      });
    });

    describe("Soft delete validation", () => {
      it("should suggest soft delete columns", () => {
        const arch: ArchitectureDoc = {
          projectName: "Test",
          version: "1.0.0",
          overview: "Test",
          systemContext: "Test",
          components: [],
          techStack: {},
          apiContracts: [],
          databaseSchema: {
            type: "sql",
            tables: [
              {
                name: "users",
                description: "User table",
                columns: [
                  { name: "id", type: "INT", nullable: false, description: "ID" },
                  { name: "email", type: "VARCHAR", nullable: false, description: "Email" },
                  { name: "name", type: "VARCHAR", nullable: false, description: "Name" },
                ],
                primaryKey: ["id"],
                // No soft delete column!
              },
            ],
          },
          qualityAttributes: [],
          constraints: [],
          risks: [],
          metadata: {
            createdAt: new Date(),
            lastModified: new Date(),
            author: "Test",
            version: "1.0.0",
          },
        };

        const report = validator.validate(arch);
        const softDeleteIssues = report.issues.filter(i => i.type === "missing-soft-delete");

        expect(softDeleteIssues.length).toBeGreaterThan(0);
        expect(softDeleteIssues[0].severity).toBe("info");
      });
    });
  });

  describe("Security validation", () => {
    it("should detect missing authentication strategy", () => {
      const arch: ArchitectureDoc = {
        projectName: "Test",
        version: "1.0.0",
        overview: "Test",
        systemContext: "Test",
        components: [],
        techStack: {},
        apiContracts: [
          {
            id: "api-1",
            name: "TestAPI",
            type: "rest",
            version: "1.0",
            endpoints: [],
            // No authentication!
          },
        ],
        databaseSchema: { type: "sql" },
        qualityAttributes: [],
        constraints: [],
        risks: [],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          author: "Test",
          version: "1.0.0",
        },
      };

      const report = validator.validate(arch);
      const securityIssues = report.issues.filter(i => i.type === "missing-authentication-strategy");

      expect(securityIssues.length).toBeGreaterThan(0);
      expect(securityIssues[0].severity).toBe("error");
    });
  });

  describe("Caching strategy validation", () => {
    it("should detect missing caching strategy when no caching or performance patterns are mentioned", () => {
      const arch: ArchitectureDoc = {
        projectName: "Test",
        version: "1.0.0",
        overview: "Test",
        systemContext: "Test",
        components: [
          {
            id: "comp-1",
            name: "API",
            type: "backend",
            description: "API server",
            responsibilities: [],
            dependencies: [],
            interfaces: [],
            technology: "Node.js",
            designPatterns: [],
            // No caching design patterns
          },
        ],
        techStack: {},
        apiContracts: [],
        databaseSchema: { type: "sql" },
        qualityAttributes: [], // No quality attributes mentioning performance or caching
        constraints: [],
        risks: [],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          author: "Test",
          version: "1.0.0",
        },
      };

      const report = validator.validate(arch);
      const cachingIssues = report.issues.filter(i => i.type === "missing-caching-strategy");

      expect(cachingIssues.length).toBeGreaterThan(0);
      expect(cachingIssues[0].severity).toBe("warning");
    });
  });

  describe("Severity levels and categorization", () => {
    it("should correctly categorize error vs warning vs info", () => {
      const arch: ArchitectureDoc = {
        projectName: "Test",
        version: "1.0.0",
        overview: "Test",
        systemContext: "Test",
        components: [
          {
            id: "comp-1",
            name: "TestComp",
            type: "backend",
            description: "",
            responsibilities: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
            dependencies: [],
            interfaces: [],
            technology: "Node.js",
            designPatterns: [],
          },
        ],
        techStack: {},
        apiContracts: [
          {
            id: "api-1",
            name: "TestAPI",
            type: "rest",
            version: "1.0",
            endpoints: [],
            // Missing auth (error)
          },
        ],
        databaseSchema: {
          type: "sql",
          tables: [
            {
              name: "users",
              description: "Users",
              columns: [
                { name: "id", type: "INT", nullable: false, description: "ID" },
              ],
              primaryKey: [], // Error
            },
          ],
        },
        qualityAttributes: [],
        constraints: [],
        risks: [],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          author: "Test",
          version: "1.0.0",
        },
      };

      const report = validator.validate(arch);

      expect(report.errorCount).toBeGreaterThan(0);
      expect(report.warningCount).toBeGreaterThanOrEqual(0);
      expect(report.infoCount).toBeGreaterThanOrEqual(0);
      expect(report.isValid).toBe(false); // Has errors
    });

    it("should be valid when no errors exist", () => {
      const arch: ArchitectureDoc = {
        projectName: "Test",
        version: "1.0.0",
        overview: "Test",
        systemContext: "Test",
        components: [
          {
            id: "comp-1",
            name: "API",
            type: "backend",
            description: "The main API server",
            responsibilities: ["Handle requests"],
            dependencies: [],
            interfaces: [],
            technology: "Node.js",
            designPatterns: ["MVC", "Cache"],
          },
        ],
        techStack: {},
        apiContracts: [
          {
            id: "api-1",
            name: "MainAPI",
            type: "rest",
            version: "1.0",
            endpoints: [
              {
                path: "/health",
                method: "GET",
                description: "Health check",
                responses: { 200: { description: "OK" } },
                authentication: false,
              },
            ],
            authentication: {
              type: "jwt",
              description: "JWT auth",
            },
            rateLimit: {
              maxRequests: 1000,
              windowMs: 3600000,
              strategy: "token-bucket",
            },
          },
        ],
        databaseSchema: {
          type: "sql",
          tables: [
            {
              name: "users",
              description: "Users",
              columns: [
                { name: "id", type: "INT", nullable: false, description: "ID" },
                { name: "email", type: "VARCHAR", nullable: false, description: "Email" },
                { name: "created_at", type: "TIMESTAMP", nullable: false, description: "Created" },
                { name: "deleted_at", type: "TIMESTAMP", nullable: true, description: "Soft delete" },
              ],
              primaryKey: ["id"],
            },
          ],
        },
        qualityAttributes: [
          {
            name: "Security",
            category: "security",
            requirement: "Secure",
            measurement: "Audit",
            priority: "must-have",
          },
        ],
        constraints: [],
        risks: [],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          author: "Test",
          version: "1.0.0",
        },
      };

      const report = validator.validate(arch);

      // Log errors if any for debugging
      if (report.errorCount > 0) {
        console.log("Unexpected errors found:");
        console.log(report.issues.filter(i => i.severity === "error"));
      }

      expect(report.errorCount).toBe(0);
      expect(report.isValid).toBe(true);
    });
  });

  describe("At least 5 different anti-patterns detected", () => {
    it("should detect multiple different anti-patterns", () => {
      const arch: ArchitectureDoc = {
        projectName: "Test",
        version: "1.0.0",
        overview: "Test",
        systemContext: "Test",
        components: [
          {
            id: "comp-1",
            name: "God",
            type: "backend",
            description: "",
            responsibilities: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
            dependencies: ["comp-2"],
            interfaces: [],
            technology: "Node.js",
            designPatterns: [],
          },
          {
            id: "comp-2",
            name: "Bad",
            type: "backend",
            description: "desc",
            responsibilities: ["x"],
            dependencies: ["comp-1"],
            interfaces: [],
            technology: "Node.js",
            designPatterns: [],
          },
        ],
        techStack: {},
        apiContracts: [
          {
            id: "api-1",
            name: "API",
            type: "rest",
            version: "1.0",
            endpoints: [
              {
                path: "/userProfiles",
                method: "GET",
                description: "Get users",
                responses: { 200: { description: "OK" } },
              },
            ],
          },
        ],
        databaseSchema: {
          type: "sql",
          tables: [
            {
              name: "posts",
              description: "Posts",
              columns: [
                { name: "id", type: "INT", nullable: false, description: "ID" },
                { name: "user_id", type: "INT", nullable: false, description: "User" },
              ],
              primaryKey: [],
            },
          ],
        },
        qualityAttributes: [],
        constraints: [],
        risks: [],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          author: "Test",
          version: "1.0.0",
        },
      };

      const report = validator.validate(arch);

      // Get unique issue types
      const issueTypes = new Set(report.issues.map(i => i.type));

      expect(issueTypes.size).toBeGreaterThanOrEqual(5);
      expect(report.totalIssues).toBeGreaterThanOrEqual(5);
    });
  });

  describe("remediation suggestions", () => {
    it("should include remediation for each issue", () => {
      const arch: ArchitectureDoc = {
        projectName: "Test",
        version: "1.0.0",
        overview: "Test",
        systemContext: "Test",
        components: [
          {
            id: "comp-1",
            name: "God",
            type: "backend",
            description: "desc",
            responsibilities: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
            dependencies: [],
            interfaces: [],
            technology: "Node.js",
            designPatterns: [],
          },
        ],
        techStack: {},
        apiContracts: [],
        databaseSchema: { type: "sql" },
        qualityAttributes: [],
        constraints: [],
        risks: [],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          author: "Test",
          version: "1.0.0",
        },
      };

      const report = validator.validate(arch);

      for (const issue of report.issues) {
        expect(issue.remediation).toBeDefined();
        expect(issue.remediation.length).toBeGreaterThan(0);
      }
    });
  });
});
