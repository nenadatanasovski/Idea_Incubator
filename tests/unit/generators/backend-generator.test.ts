/**
 * Unit tests for Backend Endpoint Generator (VIBE-P13-003)
 */

import { describe, it, expect } from 'vitest';
import {
  generateBackendEndpoint,
  integrateRoute,
  type ApiSpec,
} from '../../../parent-harness/orchestrator/src/spawner/generators/backend.js';

describe('Backend Endpoint Generator', () => {
  describe('Pass Criterion 1: Generator creates valid Express route handler', () => {
    it('should generate a basic GET route handler', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'get',
        description: 'Get all ideas',
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      // Check route handler contains essential components
      expect(result.routeHandler).toContain('router.get');
      expect(result.routeHandler).toContain('/api/ideas');
      expect(result.routeHandler).toContain('asyncHandler');
      expect(result.routeHandler).toContain('respond(res, result)');
    });

    it('should generate a POST route handler with request body', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        description: 'Create a new idea',
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            title: { type: 'string', required: true },
            description: { type: 'string', required: false },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.routeHandler).toContain('router.post');
      expect(result.routeHandler).toContain('/api/ideas');
      expect(result.routeHandler).toContain('const data: CreateIdeaRequest = req.body');
    });

    it('should generate route handler with path parameters', () => {
      const spec: ApiSpec = {
        path: '/api/ideas/:slug',
        method: 'get',
        pathParams: {
          slug: { type: 'string', required: true, description: 'Idea slug' },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
            slug: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.routeHandler).toContain('/api/ideas/:slug');
      expect(result.routeHandler).toContain('const { slug } = req.params');
    });

    it('should generate route handler with query parameters', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'get',
        queryParams: {
          search: { type: 'string', required: false, description: 'Search term' },
          limit: { type: 'number', required: false, description: 'Results limit' },
        },
        responseBody: {
          typeName: 'IdeaList',
          fields: {
            ideas: { type: 'Idea[]', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.routeHandler).toContain('const { search, limit } = req.query');
    });

    it('should include auth middleware when requiresAuth is true', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        requiresAuth: true,
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            title: { type: 'string', required: true },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.routeHandler).toContain('authMiddleware');
    });
  });

  describe('Pass Criterion 2: Request validation middleware is included', () => {
    it('should generate validation middleware for required fields', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            title: { type: 'string', required: true },
            description: { type: 'string', required: false },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.validationMiddleware).toContain('title is required');
      expect(result.validationMiddleware).toContain('errors.push');
      expect(result.validationMiddleware).toContain('res.status(400)');
    });

    it('should generate validation for minLength rule', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            title: {
              type: 'string',
              required: true,
              validation: [
                { type: 'minLength', value: 5, message: 'Title must be at least 5 characters' },
              ],
            },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.validationMiddleware).toContain('title.length < 5');
      expect(result.validationMiddleware).toContain('Title must be at least 5 characters');
    });

    it('should generate validation for email rule', () => {
      const spec: ApiSpec = {
        path: '/api/users',
        method: 'post',
        requestBody: {
          typeName: 'CreateUserRequest',
          fields: {
            email: {
              type: 'string',
              required: true,
              validation: [
                { type: 'email' },
              ],
            },
          },
        },
        responseBody: {
          typeName: 'User',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.validationMiddleware).toContain('email must be a valid email');
      expect(result.validationMiddleware).toContain('@');
    });

    it('should generate validation for path parameters', () => {
      const spec: ApiSpec = {
        path: '/api/ideas/:id',
        method: 'get',
        pathParams: {
          id: { type: 'number', required: true, description: 'Idea ID' },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.validationMiddleware).toContain('id is required');
      expect(result.validationMiddleware).toContain('id must be a number');
    });

    it('should generate validation for query parameters', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'get',
        queryParams: {
          limit: { type: 'number', required: true },
        },
        responseBody: {
          typeName: 'IdeaList',
          fields: {
            ideas: { type: 'Idea[]', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.validationMiddleware).toContain('limit is required');
      expect(result.validationMiddleware).toContain('limit must be a number');
    });
  });

  describe('Pass Criterion 3: TypeScript types for request/response bodies are generated', () => {
    it('should generate interface for request body', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            title: { type: 'string', required: true, description: 'Idea title' },
            description: { type: 'string', required: false, description: 'Idea description' },
            tags: { type: 'string[]', required: false },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.typeDefinitions).toContain('export interface CreateIdeaRequest');
      expect(result.typeDefinitions).toContain('title: string');
      expect(result.typeDefinitions).toContain('description?: string');
      expect(result.typeDefinitions).toContain('tags?: string[]');
      expect(result.typeDefinitions).toContain('/** Idea title */');
    });

    it('should generate interface for response body', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'get',
        responseBody: {
          typeName: 'IdeaListResponse',
          fields: {
            ideas: { type: 'Idea[]', required: true, description: 'List of ideas' },
            total: { type: 'number', required: true, description: 'Total count' },
            page: { type: 'number', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.typeDefinitions).toContain('export interface IdeaListResponse');
      expect(result.typeDefinitions).toContain('ideas: Idea[]');
      expect(result.typeDefinitions).toContain('total: number');
      expect(result.typeDefinitions).toContain('page: number');
      expect(result.typeDefinitions).toContain('/** List of ideas */');
    });

    it('should generate query params interface', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'get',
        queryParams: {
          search: { type: 'string', required: false, description: 'Search term' },
          limit: { type: 'number', required: false, description: 'Results limit' },
          offset: { type: 'number', required: false },
        },
        responseBody: {
          typeName: 'IdeaList',
          fields: {
            ideas: { type: 'Idea[]', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.typeDefinitions).toContain('export interface QueryParams');
      expect(result.typeDefinitions).toContain('search?: string');
      expect(result.typeDefinitions).toContain('limit?: number');
      expect(result.typeDefinitions).toContain('/** Search term */');
    });

    it('should handle optional vs required fields correctly', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            title: { type: 'string', required: true },
            description: { type: 'string', required: false },
            tags: { type: 'string[]', required: true },
            metadata: { type: 'Record<string, any>', required: false },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      // Required fields (no ?)
      expect(result.typeDefinitions).toMatch(/title:\s*string/);
      expect(result.typeDefinitions).toMatch(/tags:\s*string\[\]/);

      // Optional fields (with ?)
      expect(result.typeDefinitions).toMatch(/description\?:\s*string/);
      expect(result.typeDefinitions).toMatch(/metadata\?:\s*Record<string,\s*any>/);
    });
  });

  describe('Pass Criterion 4: Route integrates with existing router patterns', () => {
    it('should use asyncHandler wrapper', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'get',
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.routeHandler).toContain('asyncHandler(async (req, res) =>');
    });

    it('should use respond() helper for success responses', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'get',
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.routeHandler).toContain('respond(res, result)');
    });

    it('should integrate with existing router file', () => {
      const existingCode = `import { Router } from "express";
import { asyncHandler, respond } from "./shared.js";

const router = Router();

// Existing routes here

export default router;
`;

      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'get',
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const generated = generateBackendEndpoint(spec);
      const integrated = integrateRoute(existingCode, generated, spec);

      expect(integrated).toContain('// ============ Generated Types ============');
      expect(integrated).toContain('// ============ Generated Validation ============');
      expect(integrated).toContain('// ============ Generated Route ============');
      expect(integrated).toContain('export default router');
    });

    it('should generate OpenAPI documentation', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        description: 'Create a new idea',
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            title: { type: 'string', required: true },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
        statusCodes: {
          201: 'Idea created successfully',
          400: 'Validation error',
          409: 'Idea already exists',
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.openApiDoc).toContain('@openapi');
      expect(result.openApiDoc).toContain('/api/ideas');
      expect(result.openApiDoc).toContain('post:');
      expect(result.openApiDoc).toContain('Create a new idea');
      expect(result.openApiDoc).toContain('201');
      expect(result.openApiDoc).toContain('400');
      expect(result.openApiDoc).toContain('409');
    });
  });

  describe('Additional Validation Rules', () => {
    it('should generate validation for maxLength rule', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            title: {
              type: 'string',
              required: true,
              validation: [
                { type: 'maxLength', value: 100 },
              ],
            },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.validationMiddleware).toContain('title.length > 100');
    });

    it('should generate validation for pattern rule', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            slug: {
              type: 'string',
              required: true,
              validation: [
                { type: 'pattern', value: '^[a-z0-9-]+$', message: 'Invalid slug format' },
              ],
            },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.validationMiddleware).toContain('Invalid slug format');
    });

    it('should generate validation for min/max numeric rules', () => {
      const spec: ApiSpec = {
        path: '/api/ideas',
        method: 'post',
        requestBody: {
          typeName: 'CreateIdeaRequest',
          fields: {
            priority: {
              type: 'number',
              required: true,
              validation: [
                { type: 'min', value: 1 },
                { type: 'max', value: 10 },
              ],
            },
          },
        },
        responseBody: {
          typeName: 'Idea',
          fields: {
            id: { type: 'string', required: true },
          },
        },
      };

      const result = generateBackendEndpoint(spec);

      expect(result.validationMiddleware).toContain('priority');
      expect(result.validationMiddleware).toContain('must be at least 1');
      expect(result.validationMiddleware).toContain('must be at most 10');
    });
  });
});
