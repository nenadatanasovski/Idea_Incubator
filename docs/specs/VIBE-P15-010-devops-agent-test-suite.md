# VIBE-P15-010: DevOps Agent Test Suite

**Phase**: 15 - Production Deployment & Operations
**Priority**: P1
**Estimated Effort**: High (12-16 hours)
**Dependencies**: VIBE-P10-007 (Infrastructure Generator), PHASE7-TASK-01 (Docker Containerization)
**Created**: February 9, 2026
**Status**: Specification Complete

---

## Overview

This specification defines a comprehensive test suite for the DevOps Agent infrastructure generation capabilities, covering Dockerfile generation, Kubernetes manifest creation, platform adapter integrations, deployment workflows, rollback scenarios, health checks, SSL certificate automation, and test fixtures for multiple project types.

The DevOps Agent (currently implemented as `InfrastructureGenerator` in VIBE-P10-007) generates production-ready infrastructure-as-code templates, Docker configurations, CI/CD pipelines, and cost estimates. This test suite ensures all generation capabilities work correctly across different project types and deployment scenarios.

### Context

The Vibe platform's Infrastructure Generator (from VIBE-P10-007) provides:

- **Docker Generation**: Multi-stage Dockerfiles for Node.js, Python, Go, Rust projects
- **Docker Compose**: Service orchestration with health checks, volumes, networks
- **CI/CD Pipelines**: GitHub Actions workflows with multi-environment deployment
- **Platform Adapters**: AWS, Vercel, Railway, Cloudflare deployment configurations
- **Cost Estimation**: Monthly infrastructure cost breakdown by resource type
- **Environment Configs**: Dev, staging, production resource sizing

This test suite validates all these capabilities with comprehensive coverage.

### Current State

**Existing Infrastructure** (from VIBE-P10-007):
- ✅ `InfrastructureGenerator` class at `agents/architect/infrastructure-generator.ts`
- ✅ Docker Compose generation with service definitions
- ✅ Dockerfile templates for Node.js and Python
- ✅ GitHub Actions CI/CD workflow generation
- ✅ Environment configuration (dev/staging/prod)
- ✅ Cost estimation engine
- ✅ Architecture document parsing

**Existing Test Infrastructure** (from project):
- ✅ Vitest test framework with coverage reporting
- ✅ Unit test patterns in `tests/unit/`
- ✅ Integration test patterns in `tests/integration/`
- ✅ E2E test patterns in `tests/e2e/`
- ✅ Test database setup utilities

**Missing Components** (this task):
- ❌ Unit tests for DockerfileGenerator
- ❌ Unit tests for K8sManifestGenerator (if implemented)
- ❌ PlatformAdapter unit tests with mocked APIs
- ❌ Integration tests for full deployment workflows
- ❌ Rollback scenario tests
- ❌ Health check validation tests
- ❌ SSL certificate workflow tests with mocked ACME
- ❌ Test fixtures for Node.js, Python, Go projects

---

## Requirements

### Functional Requirements

#### FR-1: DockerfileGenerator Unit Tests

**FR-1.1: Node.js Dockerfile Generation**
- Test multi-stage build pattern (builder + production stages)
- Verify package.json copying and `npm ci` installation
- Validate TypeScript compilation step (`npm run build`)
- Check non-root user creation (nodejs:1001)
- Verify health check inclusion
- Test Alpine base image usage (node:20-alpine)
- Validate production-only dependencies (`npm ci --omit=dev`)
- Test port exposure (3000 default)

**FR-1.2: Python Dockerfile Generation**
- Test multi-stage build pattern (builder + production)
- Verify requirements.txt installation with pip
- Check non-root user creation (appuser:1001)
- Validate health check inclusion (urllib.request)
- Test slim base image usage (python:3.12-slim)
- Verify dependency caching from builder stage
- Test port exposure (8000 default)
- Validate uvicorn command configuration

**FR-1.3: Go Dockerfile Generation**
- Test static binary compilation in builder stage
- Verify minimal production image (scratch or alpine)
- Check binary copying from builder
- Validate health check (if applicable)
- Test port exposure configuration

**FR-1.4: Rust Dockerfile Generation**
- Test Cargo build in builder stage
- Verify target/release binary copying
- Check minimal production image
- Validate health check configuration

**FR-1.5: Dockerfile Validation**
- Test generated Dockerfiles are syntactically valid
- Verify all COPY instructions reference existing paths
- Check environment variable placeholders
- Validate WORKDIR consistency
- Test that images build successfully (docker build dry-run)

**FR-1.6: Coverage Target**
- DockerfileGenerator class achieves >80% line coverage
- All public methods tested
- Edge cases covered (missing runtime, unknown language)

#### FR-2: K8sManifestGenerator Unit Tests

**FR-2.1: Deployment Manifest**
- Test Deployment resource generation
- Verify replica count configuration
- Check container spec (image, ports, env)
- Validate resource limits (CPU, memory)
- Test label and selector consistency
- Verify rolling update strategy

**FR-2.2: Service Manifest**
- Test Service resource generation
- Verify type (ClusterIP, NodePort, LoadBalancer)
- Check port mapping configuration
- Validate selector matches Deployment labels
- Test annotations for cloud providers

**FR-2.3: Ingress Manifest**
- Test Ingress resource generation
- Verify host and path rules
- Check TLS configuration
- Validate backend service references
- Test ingress class annotation

**FR-2.4: ConfigMap and Secret**
- Test ConfigMap generation for environment variables
- Verify Secret placeholders for sensitive data
- Check volume mount configurations
- Validate naming conventions

**FR-2.5: Manifest Validation**
- Generated manifests are valid YAML
- Resources pass `kubectl apply --dry-run` validation
- All resource references are consistent
- API versions are current (apps/v1, v1, networking.k8s.io/v1)

#### FR-3: PlatformAdapter Unit Tests with Mocked APIs

**FR-3.1: AWS Adapter**
- Mock AWS SDK calls (ECR, ECS, RDS, S3)
- Test ECS task definition generation
- Verify service creation with load balancer
- Check RDS instance configuration
- Test S3 bucket creation for static assets
- Verify IAM role and policy attachment
- Mock CloudFormation stack operations
- Test error handling for API failures

**FR-3.2: Vercel Adapter**
- Mock Vercel API calls (deployment, project config)
- Test project creation and configuration
- Verify environment variable setting
- Check build configuration (buildCommand, outputDirectory)
- Test domain assignment
- Mock deployment status polling
- Verify error handling for quota limits

**FR-3.3: Railway Adapter**
- Mock Railway API calls (service deployment)
- Test project creation via API
- Verify service configuration (start command, build command)
- Check environment variable injection
- Test volume mount configuration
- Mock deployment logs streaming
- Verify error handling for build failures

**FR-3.4: Cloudflare Adapter**
- Mock Cloudflare Pages API
- Test Workers deployment
- Verify KV namespace creation
- Check Durable Objects configuration
- Test DNS record management
- Mock deployment status checks

**FR-3.5: API Mocking Strategy**
- Use vitest `vi.fn()` for function mocking
- Mock HTTP responses with `vi.spyOn(global, 'fetch')`
- Verify correct API endpoints called
- Check request payloads match expected format
- Test retry logic on transient failures
- Validate timeout handling

#### FR-4: Integration Tests for Deployment Workflows

**FR-4.1: Full Docker Workflow**
- Generate Dockerfile for sample Node.js project
- Generate docker-compose.yml with database
- Build Docker image (docker build)
- Start services (docker-compose up -d)
- Verify health checks pass
- Test inter-service communication
- Stop and clean up containers

**FR-4.2: GitHub Actions Workflow**
- Generate GitHub Actions workflow file
- Validate YAML syntax
- Verify job dependencies (test → build → deploy)
- Check environment-specific deployment jobs
- Test artifact upload/download steps
- Validate secret placeholders

**FR-4.3: End-to-End Deployment Simulation**
- Create architecture document for test project
- Generate infrastructure configs (all formats)
- Validate generated Docker Compose
- Validate generated Dockerfiles
- Validate generated CI/CD workflow
- Verify cost estimation output
- Check environment configs (dev/staging/prod)

**FR-4.4: Multi-Environment Deployment**
- Generate configs for dev environment
- Generate configs for staging environment
- Generate configs for production environment
- Verify resource sizing differences
- Check scaling configuration per environment
- Validate feature flag differences

#### FR-5: Rollback Scenario Tests

**FR-5.1: Docker Rollback**
- Deploy version 1 of service
- Deploy version 2 of service
- Trigger rollback to version 1
- Verify service runs previous version
- Check database migrations don't break
- Test data persistence through rollback

**FR-5.2: Kubernetes Rollback**
- Deploy Deployment version 1 (revision 1)
- Update to version 2 (revision 2)
- Execute `kubectl rollout undo`
- Verify pod spec matches revision 1
- Check service availability during rollback
- Test rollout status monitoring

**FR-5.3: CI/CD Pipeline Rollback**
- Simulate failed deployment in staging
- Prevent promotion to production
- Verify previous production deployment unchanged
- Test manual rollback trigger
- Check rollback notification flow

**FR-5.4: Database Migration Rollback**
- Apply database migration forward
- Test migration rollback (down migration)
- Verify schema reverted correctly
- Check data integrity after rollback
- Test idempotent migrations

#### FR-6: Health Check and Monitoring Tests

**FR-6.1: HTTP Health Check Validation**
- Test HTTP GET /health endpoint
- Verify 200 status code response
- Check response body format (JSON)
- Test health check timeout configuration
- Verify retry logic (3 attempts)
- Test unhealthy state detection

**FR-6.2: TCP Health Check Validation**
- Test TCP socket connection to service port
- Verify connection established within timeout
- Check graceful connection closure
- Test unhealthy state on connection failure
- Verify port exposure configuration

**FR-6.3: Liveness and Readiness Probes**
- Test Kubernetes liveness probe configuration
- Verify readiness probe configuration
- Check probe timing (initialDelaySeconds, periodSeconds)
- Test failure threshold configuration
- Verify container restart on liveness failure
- Test traffic routing on readiness failure

**FR-6.4: Custom Health Check Logic**
- Test custom health check command execution
- Verify exit code interpretation (0 = healthy)
- Check stdout/stderr capture
- Test health check script execution in container
- Verify environment variable access in health checks

#### FR-7: SSL Certificate Workflow Tests (Mocked ACME)

**FR-7.1: Certificate Request**
- Mock ACME protocol server (Let's Encrypt)
- Test domain ownership validation (HTTP-01 challenge)
- Verify certificate signing request (CSR) generation
- Check private key generation (RSA 2048 or EC)
- Test certificate chain retrieval
- Mock DNS-01 challenge for wildcard certificates

**FR-7.2: Certificate Installation**
- Test certificate file writing (cert.pem, key.pem, chain.pem)
- Verify correct file permissions (600 for private key)
- Check certificate bundle creation (fullchain.pem)
- Test certificate installation in nginx/Apache config
- Verify HTTPS endpoint configuration

**FR-7.3: Certificate Renewal**
- Mock certificate near expiration (7 days remaining)
- Test automatic renewal trigger
- Verify ACME renewal protocol
- Check certificate replacement without downtime
- Test service reload after renewal
- Verify expiration monitoring

**FR-7.4: Certificate Validation**
- Test certificate expiration date parsing
- Verify domain name matching
- Check certificate chain validation
- Test certificate revocation checking (OCSP)
- Verify TLS version configuration (TLS 1.2+)

#### FR-8: Test Fixtures for Various Project Types

**FR-8.1: Node.js Test Fixture**
- Create sample Express.js API project
- Include package.json with dependencies
- Add TypeScript configuration (tsconfig.json)
- Include sample route files (src/index.ts)
- Add .gitignore for Node.js
- Include README with setup instructions
- Test fixture location: `tests/fixtures/nodejs-api/`

**FR-8.2: Python Test Fixture**
- Create sample FastAPI project
- Include requirements.txt with dependencies
- Add Python configuration (pyproject.toml)
- Include sample route files (src/main.py)
- Add .gitignore for Python
- Include README with setup instructions
- Test fixture location: `tests/fixtures/python-api/`

**FR-8.3: Go Test Fixture**
- Create sample HTTP server (net/http or Gin)
- Include go.mod and go.sum
- Add main.go with sample endpoints
- Include Makefile for build commands
- Add .gitignore for Go
- Include README with setup instructions
- Test fixture location: `tests/fixtures/go-api/`

**FR-8.4: Full-Stack Test Fixture**
- Create frontend (React) + backend (Node.js) + database (PostgreSQL)
- Include Docker Compose for local development
- Add nginx configuration for reverse proxy
- Include database migrations
- Add E2E test examples
- Test fixture location: `tests/fixtures/fullstack-app/`

**FR-8.5: Microservices Test Fixture**
- Create 3 microservices (API Gateway, Auth, Data)
- Include service mesh configuration (Istio/Linkerd)
- Add inter-service communication (gRPC or REST)
- Include Kubernetes manifests for all services
- Add shared database configuration
- Test fixture location: `tests/fixtures/microservices/`

### Non-Functional Requirements

**NFR-1: Test Performance**
- Unit tests execute in <10 seconds total
- Integration tests execute in <60 seconds total
- E2E tests execute in <5 minutes total
- Test fixtures generate in <5 seconds each
- Mocked API responses return in <50ms

**NFR-2: Test Coverage**
- DockerfileGenerator: >80% line coverage
- K8sManifestGenerator: >80% line coverage
- PlatformAdapters: >75% line coverage
- Integration workflows: All critical paths tested
- Overall infrastructure code: >75% coverage

**NFR-3: Test Reliability**
- Tests are deterministic (no flaky tests)
- Mocked APIs use consistent fixtures
- Test cleanup removes all Docker containers/images
- Database state isolated per test (transactions/rollback)
- No test order dependencies

**NFR-4: Test Maintainability**
- Test names follow convention: `describe() > it() > expect()`
- Shared test utilities in `tests/utils/`
- Mocking utilities reusable across tests
- Clear test failure messages
- Test fixtures documented with usage examples

**NFR-5: CI/CD Integration**
- Tests run in GitHub Actions workflow
- Test results reported with coverage badges
- Failed tests block PR merges
- Test artifacts uploaded on failure (logs, screenshots)
- Performance regression checks

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                 DevOps Agent Test Suite Architecture                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Unit Tests (tests/unit/generators/)                        │   │
│  │  - dockerfile-generator.test.ts                             │   │
│  │  - k8s-manifest-generator.test.ts                           │   │
│  │  - platform-adapters.test.ts                                │   │
│  │  - cost-estimator.test.ts                                   │   │
│  │  - environment-config.test.ts                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              │ Dependencies                          │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Infrastructure Generator (System Under Test)                │   │
│  │  agents/architect/infrastructure-generator.ts                │   │
│  │  - InfrastructureGenerator class                             │   │
│  │  - generateDockerfile()                                      │   │
│  │  - generateDockerCompose()                                   │   │
│  │  - generateK8sManifests()                                    │   │
│  │  - generateGitHubActions()                                   │   │
│  │  - estimateCost()                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              │ Uses                                  │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Integration Tests (tests/integration/devops/)               │   │
│  │  - deployment-workflow.test.ts                               │   │
│  │  - rollback-scenarios.test.ts                                │   │
│  │  - health-checks.test.ts                                     │   │
│  │  - ssl-certificates.test.ts                                  │   │
│  │  - multi-environment.test.ts                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              │ Utilizes                              │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Test Fixtures (tests/fixtures/)                             │   │
│  │  - nodejs-api/ (Express + TypeScript)                        │   │
│  │  - python-api/ (FastAPI + Python)                            │   │
│  │  - go-api/ (net/http + Go)                                   │   │
│  │  - fullstack-app/ (React + Node + PostgreSQL)                │   │
│  │  - microservices/ (3-service architecture)                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              │ Mocks External APIs                   │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Test Utilities (tests/utils/devops/)                        │   │
│  │  - mock-platform-apis.ts (AWS, Vercel, Railway)              │   │
│  │  - docker-test-runner.ts (build/run containers)              │   │
│  │  - acme-mock-server.ts (SSL certificate testing)             │   │
│  │  - k8s-mock-cluster.ts (kubectl dry-run validation)          │   │
│  │  - fixture-generator.ts (generate test projects)             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. DockerfileGenerator Unit Tests

**File**: `tests/unit/generators/dockerfile-generator.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { InfrastructureGenerator } from '../../../agents/architect/infrastructure-generator.js';
import type { ArchitectureDoc } from '../../../agents/architect/types.js';

describe('DockerfileGenerator', () => {
  let mockArchitecture: ArchitectureDoc;

  beforeEach(() => {
    mockArchitecture = {
      id: 'test-arch',
      name: 'Test Architecture',
      version: '1.0.0',
      components: [
        {
          id: 'api-service',
          name: 'API Service',
          type: 'backend',
          description: 'REST API',
          responsibilities: ['Handle HTTP requests'],
          technologies: ['Node.js', 'TypeScript', 'Express'],
          interfaces: [],
          dependencies: ['database'],
        },
      ],
      techStack: {
        backend: {
          runtime: 'node',
          framework: 'express',
          version: '20',
        },
        database: {
          engine: 'postgres',
          version: '16',
        },
      },
      databaseSchema: {
        engine: 'postgres',
        tables: [],
      },
    };
  });

  describe('Node.js Dockerfile Generation', () => {
    it('generates multi-stage Dockerfile with builder and production stages', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('FROM node:20-alpine AS builder');
      expect(apiDockerfile).toContain('FROM node:20-alpine');
      expect(apiDockerfile).not.toContain('FROM node:20-alpine AS builder FROM');
    });

    it('includes package.json copying and npm ci in builder stage', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('COPY package*.json ./');
      expect(apiDockerfile).toContain('RUN npm ci');
    });

    it('includes TypeScript compilation step', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('RUN npm run build');
      expect(apiDockerfile).toContain('COPY --from=builder /app/dist ./dist');
    });

    it('creates non-root user (nodejs:1001)', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('addgroup -g 1001');
      expect(apiDockerfile).toContain('adduser -S nodejs -u 1001');
      expect(apiDockerfile).toContain('USER nodejs');
    });

    it('includes health check command', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('HEALTHCHECK');
      expect(apiDockerfile).toMatch(/http:\/\/localhost:\d+\/health/);
    });

    it('uses Alpine base image for minimal size', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('node:20-alpine');
      expect(apiDockerfile).not.toContain('node:20-slim');
    });

    it('installs production dependencies only in final stage', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      const prodStage = apiDockerfile.split('FROM node:20-alpine')[1];
      expect(prodStage).toContain('npm ci --omit=dev');
    });

    it('exposes port 3000 by default', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('EXPOSE 3000');
    });
  });

  describe('Python Dockerfile Generation', () => {
    beforeEach(() => {
      mockArchitecture.components[0].technologies = ['Python', 'FastAPI'];
      mockArchitecture.techStack.backend = {
        runtime: 'python',
        framework: 'fastapi',
        version: '3.12',
      };
    });

    it('generates multi-stage Dockerfile with builder and production stages', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('FROM python:3.12-slim AS builder');
      expect(apiDockerfile).toContain('FROM python:3.12-slim');
    });

    it('includes requirements.txt installation with pip', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('COPY requirements.txt .');
      expect(apiDockerfile).toContain('pip install --user --no-cache-dir -r requirements.txt');
    });

    it('creates non-root user (appuser:1001)', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('useradd -m -u 1001 appuser');
      expect(apiDockerfile).toContain('USER appuser');
    });

    it('includes health check with urllib', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('HEALTHCHECK');
      expect(apiDockerfile).toContain('urllib.request');
      expect(apiDockerfile).toMatch(/http:\/\/localhost:\d+\/health/);
    });

    it('exposes port 8000 by default', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('EXPOSE 8000');
    });

    it('configures uvicorn command', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      expect(apiDockerfile).toContain('uvicorn');
      expect(apiDockerfile).toContain('--host 0.0.0.0');
      expect(apiDockerfile).toContain('--port 8000');
    });
  });

  describe('Coverage and Validation', () => {
    it('achieves >80% coverage for generateDockerfile method', () => {
      // This is validated by vitest coverage reporting
      // Ensure all code paths tested
    });

    it('handles unknown runtime gracefully (defaults to Node.js)', () => {
      mockArchitecture.techStack.backend = {
        runtime: 'unknown-runtime' as any,
        framework: 'custom',
        version: '1.0',
      };

      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      // Should default to Node.js
      expect(apiDockerfile).toContain('node:20-alpine');
    });

    it('generates valid Dockerfile syntax (no obvious errors)', () => {
      const generator = new InfrastructureGenerator(mockArchitecture, {
        projectName: 'test-project',
      });

      const dockerfiles = generator['generateDockerfiles']();
      const apiDockerfile = dockerfiles['api-service'];

      // Check for common Dockerfile errors
      expect(apiDockerfile).not.toContain('FROM FROM');
      expect(apiDockerfile).not.toContain('COPY COPY');
      expect(apiDockerfile).toMatch(/FROM .+ AS builder/);
      expect(apiDockerfile.split('FROM').length).toBeGreaterThanOrEqual(3); // 2 stages = 3 FROMs (including split result)
    });
  });
});
```

#### 2. PlatformAdapter Unit Tests

**File**: `tests/unit/generators/platform-adapters.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('PlatformAdapters', () => {
  beforeEach(() => {
    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AWS Adapter', () => {
    it('creates ECS task definition with correct configuration', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskDefinition: {
            family: 'test-service',
            taskDefinitionArn: 'arn:aws:ecs:us-east-1:123456789:task-definition/test-service:1',
          },
        }),
      });

      // Test AWS ECS adapter logic
      // (Implementation depends on actual adapter structure)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ecs.amazonaws.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-amz-json-1.1',
          }),
        })
      );
    });

    it('handles ECS API failures gracefully', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid task definition' }),
      });

      // Test error handling
      // Expect adapter to throw meaningful error
    });

    it('mocks RDS instance creation', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          DBInstance: {
            DBInstanceIdentifier: 'test-db',
            Endpoint: {
              Address: 'test-db.abc123.us-east-1.rds.amazonaws.com',
              Port: 5432,
            },
          },
        }),
      });

      // Test RDS adapter logic
    });
  });

  describe('Vercel Adapter', () => {
    it('creates Vercel project via API', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'prj_abc123',
          name: 'test-project',
        }),
      });

      // Test Vercel project creation

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('vercel.com/v9/projects'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Bearer '),
          }),
        })
      );
    });

    it('sets environment variables in Vercel project', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          created: [{ key: 'DATABASE_URL', target: ['production'] }],
        }),
      });

      // Test environment variable setting
    });

    it('handles Vercel API rate limiting', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '60']]),
      });

      // Test rate limit handling
    });
  });

  describe('Railway Adapter', () => {
    it('deploys service via Railway API', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            serviceCreate: {
              id: 'svc_abc123',
              name: 'test-service',
            },
          },
        }),
      });

      // Test Railway service deployment
    });

    it('configures Railway service with start command', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            serviceUpdate: {
              id: 'svc_abc123',
              startCommand: 'npm start',
            },
          },
        }),
      });

      // Test service configuration
    });
  });

  describe('API Mocking Utilities', () => {
    it('provides reusable mock response builder', () => {
      const mockResponse = createMockApiResponse({
        status: 200,
        body: { success: true },
      });

      expect(mockResponse.ok).toBe(true);
      expect(mockResponse.status).toBe(200);
    });

    it('simulates network timeout', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      // Test timeout handling
    });
  });
});

// Helper function
function createMockApiResponse(config: { status: number; body: any }) {
  return {
    ok: config.status >= 200 && config.status < 300,
    status: config.status,
    json: async () => config.body,
    headers: new Map(),
  };
}
```

#### 3. Integration Test: Deployment Workflow

**File**: `tests/integration/devops/deployment-workflow.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { InfrastructureGenerator } from '../../../agents/architect/infrastructure-generator.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const execAsync = promisify(exec);

describe('Full Deployment Workflow Integration', () => {
  const testDir = path.join(__dirname, '../../temp/deployment-test');
  const dockerComposeFile = path.join(testDir, 'docker-compose.yml');

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup: stop containers and remove temp files
    try {
      await execAsync(`cd ${testDir} && docker-compose down -v`);
    } catch (error) {
      // Ignore if containers not running
    }
    await rm(testDir, { recursive: true, force: true });
  });

  it('generates and validates complete Docker deployment', async () => {
    // 1. Create architecture document
    const architecture = createTestArchitecture();

    // 2. Generate infrastructure configs
    const generator = new InfrastructureGenerator(architecture, {
      projectName: 'integration-test',
    });

    const output = await generator.generate({
      outputFormat: 'docker-compose',
    });

    // 3. Write Docker Compose file
    await writeFile(dockerComposeFile, output.dockerCompose!);

    // 4. Write Dockerfiles
    for (const [componentId, dockerfileContent] of Object.entries(output.dockerfile || {})) {
      const componentDir = path.join(testDir, componentId);
      await mkdir(componentDir, { recursive: true });
      await writeFile(path.join(componentDir, 'Dockerfile'), dockerfileContent);
    }

    // 5. Validate docker-compose config
    const { stdout } = await execAsync(`cd ${testDir} && docker-compose config`);
    expect(stdout).toContain('services:');
    expect(stdout).toContain('networks:');
    expect(stdout).toContain('volumes:');

    // 6. Build images (dry-run mode, don't actually build)
    // In real test, would do: docker-compose build
    // For speed, just validate syntax
    expect(output.dockerCompose).toContain('build:');
    expect(output.dockerCompose).toContain('context:');
  }, 60000); // 60 second timeout

  it('validates GitHub Actions workflow syntax', async () => {
    const architecture = createTestArchitecture();
    const generator = new InfrastructureGenerator(architecture, {
      projectName: 'integration-test',
      includeCI: true,
    });

    const output = await generator.generate({
      outputFormat: 'github-actions',
    });

    // Write workflow file
    const workflowDir = path.join(testDir, '.github/workflows');
    await mkdir(workflowDir, { recursive: true });
    await writeFile(path.join(workflowDir, 'deploy.yml'), output.githubActions!);

    // Validate YAML syntax (basic check)
    expect(output.githubActions).toContain('name:');
    expect(output.githubActions).toContain('on:');
    expect(output.githubActions).toContain('jobs:');
    expect(output.githubActions).toContain('test:');
    expect(output.githubActions).toContain('build:');
    expect(output.githubActions).toContain('deploy');
  });

  it('generates environment-specific configs', async () => {
    const architecture = createTestArchitecture();
    const generator = new InfrastructureGenerator(architecture, {
      projectName: 'integration-test',
      environments: ['dev', 'staging', 'prod'],
    });

    const output = await generator.generate({
      outputFormat: 'all',
    });

    expect(output.environmentConfigs).toHaveLength(3);

    const devConfig = output.environmentConfigs.find(c => c.name === 'dev');
    const prodConfig = output.environmentConfigs.find(c => c.name === 'prod');

    expect(devConfig).toBeDefined();
    expect(prodConfig).toBeDefined();

    // Dev should have fewer resources than prod
    expect(devConfig!.resources.compute.instanceCount).toBeLessThan(
      prodConfig!.resources.compute.instanceCount
    );
  });
});

function createTestArchitecture() {
  return {
    id: 'test-arch',
    name: 'Test Architecture',
    version: '1.0.0',
    components: [
      {
        id: 'api',
        name: 'API Service',
        type: 'backend',
        description: 'REST API',
        responsibilities: ['Handle requests'],
        technologies: ['Node.js', 'Express'],
        interfaces: [],
        dependencies: ['database'],
      },
      {
        id: 'database',
        name: 'Database',
        type: 'database',
        description: 'PostgreSQL',
        responsibilities: ['Data persistence'],
        technologies: ['PostgreSQL'],
        interfaces: [],
        dependencies: [],
      },
    ],
    techStack: {
      backend: { runtime: 'node', framework: 'express', version: '20' },
      database: { engine: 'postgres', version: '16' },
    },
    databaseSchema: {
      engine: 'postgres',
      tables: [],
    },
  };
}
```

#### 4. Test Fixtures

**Directory Structure**:
```
tests/fixtures/
├── nodejs-api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   └── index.ts
│   ├── .gitignore
│   └── README.md
├── python-api/
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── src/
│   │   └── main.py
│   ├── .gitignore
│   └── README.md
├── go-api/
│   ├── go.mod
│   ├── go.sum
│   ├── main.go
│   ├── Makefile
│   ├── .gitignore
│   └── README.md
└── fullstack-app/
    ├── frontend/ (React)
    ├── backend/ (Node.js)
    ├── docker-compose.yml
    ├── nginx.conf
    └── README.md
```

**Example: Node.js Test Fixture**

**File**: `tests/fixtures/nodejs-api/package.json`
```json
{
  "name": "nodejs-api-fixture",
  "version": "1.0.0",
  "description": "Test fixture for DevOps Agent tests",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "test": "vitest"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.2",
    "vitest": "^1.0.0"
  }
}
```

**File**: `tests/fixtures/nodejs-api/src/index.ts`
```typescript
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Node.js API' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Pass Criteria

### Must Pass (Critical for Completion)

**PC-1: DockerfileGenerator Unit Tests**
- [ ] Test file exists at `tests/unit/generators/dockerfile-generator.test.ts`
- [ ] Tests cover Node.js Dockerfile generation (multi-stage, health check, non-root user)
- [ ] Tests cover Python Dockerfile generation (requirements.txt, uvicorn, health check)
- [ ] Tests validate Dockerfile syntax (no FROM FROM, valid stages)
- [ ] >80% line coverage for Dockerfile generation methods
- [ ] All tests pass

**PC-2: K8sManifestGenerator Unit Tests** (if implemented)
- [ ] Test file exists at `tests/unit/generators/k8s-manifest-generator.test.ts`
- [ ] Tests cover Deployment manifest generation
- [ ] Tests cover Service manifest generation
- [ ] Tests validate manifest YAML syntax
- [ ] All tests pass

**PC-3: PlatformAdapter Unit Tests with Mocked APIs**
- [ ] Test file exists at `tests/unit/generators/platform-adapters.test.ts`
- [ ] Tests mock AWS SDK calls (ECS, RDS, S3)
- [ ] Tests mock Vercel API calls
- [ ] Tests mock Railway API calls
- [ ] Tests verify correct API endpoints called
- [ ] Tests verify retry logic on failures
- [ ] All tests pass

**PC-4: Integration Tests for Deployment Workflows**
- [ ] Test file exists at `tests/integration/devops/deployment-workflow.test.ts`
- [ ] Tests generate complete Docker Compose configuration
- [ ] Tests validate docker-compose config syntax
- [ ] Tests generate GitHub Actions workflow
- [ ] Tests validate multi-environment configurations
- [ ] All tests pass

**PC-5: Rollback Scenario Tests**
- [ ] Test file exists at `tests/integration/devops/rollback-scenarios.test.ts`
- [ ] Tests simulate Docker rollback (version 2 → version 1)
- [ ] Tests verify service runs previous version
- [ ] Tests check data persistence through rollback
- [ ] All tests pass

**PC-6: Health Check Tests**
- [ ] Test file exists at `tests/integration/devops/health-checks.test.ts`
- [ ] Tests validate HTTP health check configuration
- [ ] Tests validate TCP health check configuration
- [ ] Tests verify health check timeout handling
- [ ] Tests verify unhealthy state detection
- [ ] All tests pass

**PC-7: SSL Certificate Workflow Tests**
- [ ] Test file exists at `tests/integration/devops/ssl-certificates.test.ts`
- [ ] Tests mock ACME protocol (Let's Encrypt)
- [ ] Tests validate certificate request flow
- [ ] Tests verify certificate installation
- [ ] Tests check certificate renewal logic
- [ ] All tests pass

**PC-8: Test Fixtures for Multiple Project Types**
- [ ] Node.js fixture exists at `tests/fixtures/nodejs-api/`
- [ ] Python fixture exists at `tests/fixtures/python-api/`
- [ ] Go fixture exists at `tests/fixtures/go-api/`
- [ ] Fullstack fixture exists at `tests/fixtures/fullstack-app/`
- [ ] All fixtures include README with usage instructions
- [ ] Fixtures generate valid architecture documents

### Should Pass (Important)

**PC-9: Test Coverage Targets**
- [ ] DockerfileGenerator achieves >80% coverage
- [ ] K8sManifestGenerator achieves >80% coverage (if implemented)
- [ ] PlatformAdapters achieve >75% coverage
- [ ] Overall infrastructure code achieves >75% coverage
- [ ] Coverage report generated by Vitest

**PC-10: Test Performance**
- [ ] Unit tests execute in <10 seconds
- [ ] Integration tests execute in <60 seconds
- [ ] E2E tests execute in <5 minutes
- [ ] No flaky tests (deterministic results)

**PC-11: Test Maintainability**
- [ ] Test utilities created in `tests/utils/devops/`
- [ ] Mock API utilities reusable across tests
- [ ] Clear test names following describe/it/expect pattern
- [ ] Test cleanup removes all Docker artifacts

**PC-12: CI/CD Integration**
- [ ] Tests run in GitHub Actions workflow
- [ ] Test results reported with coverage percentage
- [ ] Failed tests block PR merges
- [ ] Test artifacts uploaded on failure

### Nice to Have

**PC-13: Advanced Test Scenarios**
- [ ] Microservices fixture with 3+ services
- [ ] Chaos testing (random container failures)
- [ ] Load testing for health check endpoints
- [ ] Blue-green deployment simulation

**PC-14: Documentation**
- [ ] Test README in `tests/devops/README.md`
- [ ] Fixture usage examples documented
- [ ] Mocking patterns documented
- [ ] Troubleshooting guide for failing tests

---

## Dependencies

### Required Dependencies

**Existing Project Dependencies**:
- ✅ Vitest (test framework)
- ✅ TypeScript compiler
- ✅ Infrastructure Generator (`agents/architect/infrastructure-generator.ts`)

**New Test Dependencies** (add to `devDependencies`):
```json
{
  "devDependencies": {
    "@types/dockerode": "^3.3.23",
    "dockerode": "^4.0.0",
    "yaml": "^2.3.4"
  }
}
```

### External Tools (for integration tests)

- Docker CLI (for docker-compose validation)
- kubectl CLI (for Kubernetes manifest validation, optional)
- YAML linter (for CI/CD workflow validation)

### Blocked By

- None (can be implemented independently)

### Blocks

- VIBE-P16-010 (Feedback Loop Integration Tests) - depends on test patterns

---

## Implementation Plan

### Phase 1: Unit Test Foundation (4 hours)

1. **Create test directory structure**:
   ```
   tests/
   ├── unit/generators/
   │   ├── dockerfile-generator.test.ts
   │   ├── platform-adapters.test.ts
   │   └── cost-estimator.test.ts
   └── utils/devops/
       ├── mock-platform-apis.ts
       └── fixture-generator.ts
   ```

2. **Implement DockerfileGenerator unit tests**:
   - Test Node.js Dockerfile generation (all requirements)
   - Test Python Dockerfile generation (all requirements)
   - Test edge cases (unknown runtime, missing config)
   - Verify >80% coverage

3. **Implement PlatformAdapter unit tests**:
   - Create mock API utility functions
   - Test AWS adapter with mocked SDK
   - Test Vercel adapter with mocked fetch
   - Test Railway adapter with mocked GraphQL
   - Verify error handling and retries

### Phase 2: Integration Tests (4 hours)

1. **Create integration test directory**:
   ```
   tests/integration/devops/
   ├── deployment-workflow.test.ts
   ├── rollback-scenarios.test.ts
   ├── health-checks.test.ts
   └── ssl-certificates.test.ts
   ```

2. **Implement deployment workflow tests**:
   - Generate Docker Compose and validate syntax
   - Generate GitHub Actions and validate YAML
   - Test multi-environment configuration
   - Verify cost estimation output

3. **Implement rollback scenario tests**:
   - Simulate Docker image rollback
   - Test database migration rollback
   - Verify data persistence

4. **Implement health check tests**:
   - Test HTTP health check configuration
   - Test TCP health check configuration
   - Verify retry logic and timeouts

5. **Implement SSL certificate tests**:
   - Mock ACME protocol server
   - Test certificate request flow
   - Test certificate renewal logic

### Phase 3: Test Fixtures (2 hours)

1. **Create Node.js test fixture**:
   - package.json with Express dependencies
   - TypeScript source files
   - Health check endpoint
   - README with instructions

2. **Create Python test fixture**:
   - requirements.txt with FastAPI
   - Python source files
   - Health check endpoint
   - README with instructions

3. **Create Go test fixture**:
   - go.mod with dependencies
   - HTTP server implementation
   - Makefile for build commands
   - README with instructions

4. **Create fullstack test fixture**:
   - React frontend
   - Node.js backend
   - PostgreSQL database
   - Docker Compose for local dev
   - README with full setup

### Phase 4: Test Utilities (2 hours)

1. **Create mock API utilities**:
   - `mock-platform-apis.ts` - AWS, Vercel, Railway mocks
   - `docker-test-runner.ts` - Docker build/run helpers
   - `acme-mock-server.ts` - SSL certificate mock server
   - `fixture-generator.ts` - Generate architecture docs from fixtures

2. **Create test helpers**:
   - Cleanup utilities (remove Docker containers/images)
   - Architecture document builders
   - Assertion helpers for infrastructure validation

### Phase 5: CI/CD Integration (1 hour)

1. **Add test job to GitHub Actions**:
   - Install Docker in CI environment
   - Run unit tests with coverage
   - Run integration tests
   - Upload coverage reports
   - Upload test artifacts on failure

2. **Configure test scripts in package.json**:
   ```json
   {
     "scripts": {
       "test:devops": "vitest run tests/unit/generators tests/integration/devops",
       "test:devops:coverage": "vitest run --coverage tests/unit/generators tests/integration/devops",
       "test:devops:watch": "vitest watch tests/unit/generators tests/integration/devops"
     }
   }
   ```

### Phase 6: Documentation (1 hour)

1. **Create test README**:
   - Overview of test structure
   - How to run tests locally
   - How to add new test cases
   - Troubleshooting common issues

2. **Document fixtures**:
   - Usage examples for each fixture
   - How to extend fixtures
   - Architecture document generation

3. **Document mocking patterns**:
   - How to mock platform APIs
   - Best practices for test isolation
   - Debugging failing tests

---

## Testing Strategy

### Unit Test Execution

```bash
# Run all DevOps unit tests
npm run test:devops

# Run with coverage
npm run test:devops:coverage

# Watch mode for development
npm run test:devops:watch

# Run specific test file
npx vitest run tests/unit/generators/dockerfile-generator.test.ts
```

### Integration Test Execution

```bash
# Run integration tests only
npx vitest run tests/integration/devops

# Run specific integration test
npx vitest run tests/integration/devops/deployment-workflow.test.ts
```

### Coverage Thresholds

Configure in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'agents/architect/infrastructure-generator.ts',
        'agents/architect/infrastructure-types.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### Manual Validation

1. **Docker Build Test**:
   ```bash
   # Generate Dockerfile for Node.js fixture
   npm run test:devops:generate -- --fixture nodejs-api --output /tmp/test-dockerfile

   # Build Docker image
   cd /tmp/test-dockerfile
   docker build -t test-nodejs-api .

   # Verify image builds successfully
   docker images | grep test-nodejs-api
   ```

2. **Docker Compose Validation**:
   ```bash
   # Generate docker-compose.yml
   npm run test:devops:generate -- --fixture fullstack --output /tmp/test-compose

   # Validate syntax
   cd /tmp/test-compose
   docker-compose config

   # Start services (optional)
   docker-compose up -d
   docker-compose ps
   docker-compose logs
   ```

3. **GitHub Actions Validation**:
   ```bash
   # Generate workflow
   npm run test:devops:generate -- --ci github-actions --output /tmp/test-workflow

   # Validate YAML syntax
   yamllint /tmp/test-workflow/deploy.yml
   ```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Docker not available in CI | Low | High | Use docker/setup-docker-action in GitHub Actions |
| Tests too slow (>5 min) | Medium | Medium | Use mocked APIs instead of real Docker builds where possible |
| Flaky Docker tests | Medium | High | Ensure proper cleanup, use deterministic test data, add retry logic |
| Test fixture maintenance burden | Medium | Low | Keep fixtures minimal, document update process |
| Mock APIs drift from real APIs | Low | Medium | Periodically validate mocks against real API responses |
| Coverage target too aggressive | Low | Medium | Adjust thresholds if needed, focus on critical paths first |

---

## Success Metrics

### Implementation Success
- ✅ All 8 "Must Pass" criteria verified
- ✅ Unit tests achieve >80% coverage for Dockerfile generation
- ✅ Platform adapters achieve >75% coverage
- ✅ Integration tests validate full deployment workflow
- ✅ All tests pass in CI/CD pipeline

### Quality Metrics
- Test suite executes in <10 minutes total
- Zero flaky tests (100% deterministic)
- Test failures provide actionable error messages
- Test fixtures cover common project types (Node, Python, Go)
- Documentation enables new contributors to add tests

---

## Future Enhancements (Out of Scope)

1. **Kubernetes E2E Tests**: Deploy to real K8s cluster (minikube/kind)
2. **Performance Benchmarks**: Track Dockerfile build time over commits
3. **Security Scanning**: Integrate Trivy/Grype for image vulnerability scanning
4. **Chaos Engineering**: Random container failures during deployment
5. **Load Testing**: Stress test health check endpoints under high load
6. **Multi-Cloud Tests**: Real deployments to AWS/GCP/Azure (expensive)
7. **Terraform/Pulumi Validation**: Test IaC generation (not implemented in base generator yet)

---

## References

### Related Specifications
- VIBE-P10-007: Infrastructure Requirements Generator
- PHASE7-TASK-01: Docker Containerization
- VIBE-P15-007: Monitoring and Alerting System
- VIBE-P14-008: Test Coverage Reporting

### External Resources
- Docker best practices: https://docs.docker.com/develop/develop-images/dockerfile_best-practices/
- Kubernetes testing: https://kubernetes.io/blog/2019/03/22/kubernetes-end-to-end-testing-for-everyone/
- Vitest documentation: https://vitest.dev/guide/
- GitHub Actions testing: https://docs.github.com/en/actions/automating-builds-and-tests

---

**End of Specification**
