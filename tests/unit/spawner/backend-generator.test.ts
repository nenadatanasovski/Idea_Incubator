/**
 * Test Backend Endpoint Generator (VIBE-P13-003)
 */

import { describe, it, expect } from "vitest";
import {
  generateBackendEndpoint,
  type ApiSpec,
  type GeneratedCode,
} from "../../../parent-harness/orchestrator/src/spawner/generators/backend";

describe("Backend Endpoint Generator (VIBE-P13-003)", () => {
  const testSpec: ApiSpec = {
    path: "/api/ideas/:slug",
    method: "get",
    description: "Get idea by slug",
    pathParams: {
      slug: {
        type: "string",
        required: true,
        description: "Idea slug identifier",
      },
    },
    queryParams: {
      includeMetadata: {
        type: "boolean",
        required: false,
        description: "Include metadata",
      },
    },
    responseBody: {
      typeName: "IdeaResponse",
      fields: {
        id: { type: "string", required: true, description: "Idea ID" },
        title: { type: "string", required: true, description: "Idea title" },
        description: {
          type: "string",
          required: false,
          description: "Idea description",
        },
      },
    },
    requiresAuth: true,
    statusCodes: {
      200: "Success",
      404: "Idea not found",
      401: "Unauthorized",
    },
  };

  describe("Pass Criterion 1: Generator creates valid Express route handler from API spec", () => {
    it("should generate route handler with correct HTTP method", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toContain("router.get");
    });

    it("should include asyncHandler wrapper", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toContain("asyncHandler");
    });

    it("should include correct path", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toContain("/api/ideas/:slug");
    });

    it("should include parameter extraction", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toContain("req.params");
      expect(generated.routeHandler).toContain("slug");
    });

    it("should include response handling", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toContain("respond(res");
    });
  });

  describe("Pass Criterion 2: Request validation middleware is included", () => {
    it("should generate validation middleware function", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.validationMiddleware).toContain("export const validate");
    });

    it("should include error collection", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.validationMiddleware).toContain("errors: string[]");
    });

    it("should validate path parameters", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.validationMiddleware).toContain("req.params.slug");
      expect(generated.validationMiddleware).toContain("slug is required");
    });

    it("should validate query parameters", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.validationMiddleware).toContain(
        "req.query.includeMetadata",
      );
    });

    it("should return 400 on validation failure", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.validationMiddleware).toContain("res.status(400)");
    });
  });

  describe("Pass Criterion 3: TypeScript types for request/response bodies are generated", () => {
    it("should generate response type interface", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.typeDefinitions).toContain(
        "export interface IdeaResponse",
      );
    });

    it("should include all response fields with correct types", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.typeDefinitions).toContain("id: string");
      expect(generated.typeDefinitions).toContain("title: string");
      expect(generated.typeDefinitions).toContain("description?: string"); // Optional field
    });

    it("should include field descriptions as JSDoc comments", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.typeDefinitions).toContain("/** Idea ID */");
      expect(generated.typeDefinitions).toContain("/** Idea title */");
    });
  });

  describe("Pass Criterion 4: Route integrates with existing router patterns in codebase", () => {
    it("should use router object", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toMatch(/^.*router\./m);
    });

    it("should use asyncHandler pattern", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toContain("asyncHandler(async (req, res)");
    });

    it("should include auth middleware when requiresAuth is true", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toContain("authMiddleware");
    });

    it("should use respond() helper pattern", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toContain("respond(res");
    });

    it("should include JSDoc comments", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.routeHandler).toMatch(/^\/\*\*/m);
    });
  });

  describe("Additional validation", () => {
    it("should generate OpenAPI documentation", () => {
      const generated: GeneratedCode = generateBackendEndpoint(testSpec);
      expect(generated.openApiDoc).toContain("@openapi");
      expect(generated.openApiDoc).toContain("/api/ideas/:slug");
    });

    it("should handle POST request with request body", () => {
      const postSpec: ApiSpec = {
        path: "/api/ideas",
        method: "post",
        requestBody: {
          typeName: "CreateIdeaRequest",
          fields: {
            title: { type: "string", required: true },
            description: { type: "string", required: false },
          },
        },
        responseBody: {
          typeName: "IdeaResponse",
          fields: {
            id: { type: "string", required: true },
          },
        },
      };

      const generated: GeneratedCode = generateBackendEndpoint(postSpec);
      expect(generated.routeHandler).toContain("router.post");
      expect(generated.typeDefinitions).toContain(
        "export interface CreateIdeaRequest",
      );
      expect(generated.validationMiddleware).toContain("req.body");
    });
  });
});
