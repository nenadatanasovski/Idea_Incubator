# VIBE-P10-007: Infrastructure Requirements Generator

**Status:** SPECIFICATION COMPLETE
**Created:** 2026-02-09
**Priority:** P1 (Phase 10 - Architecture Agent Foundation)
**Effort:** Medium (12-16 hours)
**Model:** Opus
**Agent Type:** build_agent

---

## Overview

Build a comprehensive Infrastructure Requirements Generator that transforms architecture documents into deployable infrastructure configurations. This generator produces Docker/docker-compose configurations, CI/CD pipeline templates (GitHub Actions), infrastructure-as-code templates (Terraform/Pulumi), environment-specific configurations (dev/staging/prod), and cost estimations based on expected load.

### Problem Statement

**Current State:**
- Architect Agent exists and can generate architecture documents (`agents/architect/architect-agent.ts`)
- Architecture types defined but no infrastructure generation capability
- Docker/docker-compose examples exist in `parent-harness/` but not automated
- GitHub Actions workflow exists (`.github/workflows/e2e-tests.yml`) but not templated
- No automated cost estimation for infrastructure
- No infrastructure-as-code template generation
- Manual infrastructure setup required for each project

**Desired State:**
- `InfrastructureGenerator` class at `agents/architect/infrastructure-generator.ts`
- Generate valid `docker-compose.yml` for local development
- Generate GitHub Actions workflow YAML for CI/CD
- Generate Terraform/Pulumi templates for AWS, Vercel, Railway
- Environment-specific configs (dev/staging/prod) with appropriate scaling
- Cost estimation function that returns monthly cost based on inputs
- Integration with Architect Agent for seamless architecture-to-infrastructure flow

### Value Proposition

The Infrastructure Requirements Generator is the **"Infrastructure Automation Engine"** that provides:

1. **Instant Infrastructure Setup** - Convert architecture to deployment configs in seconds
2. **Best Practices Encoded** - Templates include production-ready configurations
3. **Multi-Environment Support** - Consistent configs across dev/staging/prod
4. **Cost Transparency** - Understand infrastructure costs before deployment
5. **Platform Flexibility** - Support for AWS, Vercel, Railway, and self-hosted
6. **CI/CD Ready** - GitHub Actions workflows generated automatically
7. **Reduced DevOps Burden** - Standardized infrastructure reduces setup time

---

## Requirements

### Functional Requirements

#### FR-1: InfrastructureGenerator Class

**FR-1.1: Class Structure**
- Create `InfrastructureGenerator` class at `agents/architect/infrastructure-generator.ts`
- Class should NOT extend ObservableAgent (it's a utility, not an agent)
- Export factory function `createInfrastructureGenerator()`
- Stateless design - all methods are pure functions of inputs

**FR-1.2: Core Method**
- `generate(architecture: ArchitectureDoc, options?: InfrastructureOptions): InfrastructureOutput`
  - Main entry point that orchestrates all generation
  - Takes architecture document as input
  - Returns complete infrastructure configuration package
  - Options include: target platform, environments, cost tier

**FR-1.3: Supporting Methods**
- `generateDockerCompose(architecture: ArchitectureDoc, env: Environment): string`
  - Generate docker-compose.yml for specified environment
  - Include all services from architecture components
  - Add appropriate networking, volumes, environment variables

- `generateDockerfile(component: ComponentSpec): string`
  - Generate Dockerfile for individual component
  - Support Node.js, Python, Go, static sites
  - Multi-stage builds for production

- `generateGitHubActionsWorkflow(architecture: ArchitectureDoc): string`
  - Generate `.github/workflows/ci-cd.yml`
  - Include: test, build, deploy stages
  - Support matrix builds for multiple environments

- `generateTerraformConfig(architecture: ArchitectureDoc, provider: 'aws' | 'vercel' | 'railway'): TerraformConfig`
  - Generate Terraform configurations for cloud provider
  - Include: compute, database, networking, storage resources
  - Parameterized for environment variables

- `generatePulumiConfig(architecture: ArchitectureDoc, provider: 'aws' | 'vercel' | 'railway'): PulumiConfig`
  - Generate Pulumi configurations (TypeScript-based)
  - Alternative to Terraform with type safety
  - Support same providers as Terraform

- `generateEnvironmentConfig(architecture: ArchitectureDoc, env: 'dev' | 'staging' | 'prod'): EnvironmentConfig`
  - Generate environment-specific configuration
  - Include: scaling parameters, resource limits, feature flags
  - Appropriate sizing for each environment

- `estimateMonthlyCost(architecture: ArchitectureDoc, load: LoadProfile): CostEstimate`
  - Calculate monthly infrastructure cost
  - Based on: component count, database size, traffic volume
  - Return breakdown by service and total cost

#### FR-2: Type Definitions

**FR-2.1: Input Types**
```typescript
interface InfrastructureOptions {
  targetPlatform?: 'aws' | 'vercel' | 'railway' | 'docker' | 'all';
  environments?: Array<'dev' | 'staging' | 'prod'>;
  costTier?: 'minimal' | 'standard' | 'premium';
  includeMonitoring?: boolean;
  includeLogging?: boolean;
  includeCaching?: boolean;
}

interface LoadProfile {
  dailyActiveUsers: number;
  requestsPerSecond: number;
  databaseSizeGB: number;
  storageGB: number;
  bandwidthGBPerMonth: number;
}

interface Environment {
  name: 'dev' | 'staging' | 'prod';
  replicas: number;
  resources: ResourceLimits;
}

interface ResourceLimits {
  cpu: string;  // e.g., "1000m" (1 CPU)
  memory: string;  // e.g., "2Gi"
  storage: string;  // e.g., "10Gi"
}
```

**FR-2.2: Output Types**
```typescript
interface InfrastructureOutput {
  dockerCompose: {
    dev: string;
    staging: string;
    prod: string;
  };
  dockerfiles: Record<string, string>;  // componentId -> Dockerfile
  githubActions: string;
  terraform?: TerraformConfig;
  pulumi?: PulumiConfig;
  environmentConfigs: {
    dev: EnvironmentConfig;
    staging: EnvironmentConfig;
    prod: EnvironmentConfig;
  };
  costEstimate: CostEstimate;
  setupInstructions: string;
}

interface TerraformConfig {
  main: string;  // main.tf
  variables: string;  // variables.tf
  outputs: string;  // outputs.tf
  provider: string;  // provider.tf
}

interface PulumiConfig {
  index: string;  // index.ts
  config: string;  // Pulumi.yaml
  stackConfigs: Record<string, string>;  // Pulumi.dev.yaml, etc.
}

interface EnvironmentConfig {
  name: string;
  services: ServiceConfig[];
  database: DatabaseConfig;
  caching?: CachingConfig;
  monitoring?: MonitoringConfig;
  scaling: ScalingConfig;
}

interface ServiceConfig {
  name: string;
  image: string;
  replicas: number;
  resources: ResourceLimits;
  environmentVariables: Record<string, string>;
  ports: number[];
  healthCheck?: HealthCheckConfig;
}

interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  version: string;
  size: string;  // e.g., "db.t3.micro"
  storage: string;
  backupRetention: number;  // days
}

interface CachingConfig {
  provider: 'redis' | 'memcached';
  size: string;
  evictionPolicy: string;
}

interface MonitoringConfig {
  metrics: boolean;
  logging: boolean;
  tracing: boolean;
  alerting: boolean;
}

interface ScalingConfig {
  minReplicas: number;
  maxReplicas: number;
  targetCPU: number;  // percentage
  targetMemory: number;  // percentage
}

interface HealthCheckConfig {
  path: string;
  interval: string;  // e.g., "30s"
  timeout: string;
  retries: number;
}

interface CostEstimate {
  monthly: {
    compute: number;
    database: number;
    storage: number;
    bandwidth: number;
    monitoring: number;
    other: number;
    total: number;
  };
  breakdown: CostBreakdownItem[];
  assumptions: string[];
  recommendations: string[];
}

interface CostBreakdownItem {
  service: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}
```

#### FR-3: Docker Compose Generation

**FR-3.1: Local Development docker-compose.yml**
- Generate multi-service compose file with:
  - All backend services from architecture.components
  - Database services (PostgreSQL, MongoDB, Redis as needed)
  - Frontend development server (if applicable)
  - Networking configuration (bridge network)
  - Volume mounts for hot-reload development
  - Environment variables for local development
  - Health checks for all services

**FR-3.2: Production docker-compose.yml**
- Similar structure but optimized for production:
  - No volume mounts (use built images)
  - Resource limits defined
  - Restart policies (unless-stopped)
  - Production environment variables
  - Logging drivers configured

**FR-3.3: Service Discovery**
- Services can reference each other by service name
- Example: backend connects to `postgresql://db:5432/myapp`
- Environment variables for inter-service communication

#### FR-4: Dockerfile Generation

**FR-4.1: Node.js/TypeScript Dockerfile**
```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s CMD node -e "..."
CMD ["node", "dist/index.js"]
```

**FR-4.2: Python Dockerfile**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
```

**FR-4.3: Static Site Dockerfile (nginx)**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### FR-5: GitHub Actions Workflow Generation

**FR-5.1: CI/CD Pipeline Structure**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t myapp .

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: # deployment commands

  deploy-prod:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: # deployment commands
```

**FR-5.2: Matrix Builds**
- Support testing across multiple Node.js versions
- Parallel execution for faster feedback
- Conditional deployment based on branch

#### FR-6: Terraform Configuration Generation

**FR-6.1: AWS Provider**
- ECS Fargate for containerized services
- RDS for relational databases
- ElastiCache for caching
- ALB for load balancing
- CloudWatch for monitoring
- S3 for static assets
- CloudFront CDN (optional)

**FR-6.2: Vercel Provider**
- Vercel project configuration
- Serverless functions
- Environment variables
- Domain configuration
- Analytics integration

**FR-6.3: Railway Provider**
- Railway service definitions
- Database add-ons
- Environment variables
- Auto-scaling configuration

**FR-6.4: Terraform Structure**
```hcl
# main.tf
provider "aws" {
  region = var.aws_region
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
}

resource "aws_ecs_task_definition" "app" {
  family = "${var.project_name}-app"
  # ... task definition
}

# variables.tf
variable "aws_region" {
  type = string
  default = "us-east-1"
}

# outputs.tf
output "load_balancer_dns" {
  value = aws_lb.main.dns_name
}
```

#### FR-7: Environment-Specific Configuration

**FR-7.1: Development Environment**
- Single replica per service
- Minimal resource limits (512MB RAM, 0.5 CPU)
- Hot-reload enabled
- Debug logging enabled
- No autoscaling
- Local database (not managed)

**FR-7.2: Staging Environment**
- 2 replicas per service
- Medium resource limits (1GB RAM, 1 CPU)
- Production-like setup
- Managed database (small instance)
- Basic monitoring
- Autoscaling 2-4 replicas

**FR-7.3: Production Environment**
- 3+ replicas per service
- Production resource limits (2GB+ RAM, 2+ CPU)
- Managed database (appropriate instance size)
- Full monitoring and alerting
- Autoscaling 3-10 replicas
- Backup and disaster recovery

#### FR-8: Cost Estimation

**FR-8.1: Compute Costs**
- Calculate based on instance type and hours
- Example: 3 × t3.medium × 730 hours = $90/month
- Include container/serverless costs

**FR-8.2: Database Costs**
- RDS/managed database pricing
- Storage costs (per GB)
- Backup storage costs
- Example: db.t3.small + 20GB = $25/month

**FR-8.3: Network/Bandwidth Costs**
- Data transfer out pricing
- CDN costs
- Load balancer costs
- Example: 100GB transfer = $9/month

**FR-8.4: Additional Services**
- Monitoring (CloudWatch, Datadog)
- Logging (CloudWatch Logs, Papertrail)
- Caching (ElastiCache, Redis)
- Object storage (S3)

**FR-8.5: Cost Recommendations**
- Suggest reserved instances for stable workloads
- Identify over-provisioned resources
- Suggest cheaper alternatives
- Highlight fixed vs variable costs

### Non-Functional Requirements

**NFR-1: Type Safety**
- All types strictly typed with TypeScript
- No `any` types in public interfaces
- Proper error types with descriptive messages

**NFR-2: Template Quality**
- Generated configs must be valid and deployable
- Follow platform best practices
- Include comments explaining key decisions
- Production-ready by default

**NFR-3: Extensibility**
- Easy to add new cloud providers
- Template system for customization
- Plugin architecture for cost providers

**NFR-4: Documentation**
- JSDoc comments on all public methods
- Generated configs include explanatory comments
- Setup instructions provided in output

**NFR-5: Validation**
- Validate architecture document before generation
- Check for required fields
- Warn about missing recommended configurations

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│         InfrastructureGenerator (Utility Class)         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  generate()                                        │ │
│  │  - Orchestrates all generation methods            │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Docker Generation                                 │ │
│  │  - generateDockerCompose()                         │ │
│  │  - generateDockerfile()                            │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  CI/CD Generation                                  │ │
│  │  - generateGitHubActionsWorkflow()                 │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  IaC Generation                                    │ │
│  │  - generateTerraformConfig()                       │ │
│  │  - generatePulumiConfig()                          │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Environment Configuration                         │ │
│  │  - generateEnvironmentConfig()                     │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Cost Estimation                                   │ │
│  │  - estimateMonthlyCost()                           │ │
│  │  - calculateComputeCost()                          │ │
│  │  - calculateDatabaseCost()                         │ │
│  │  - calculateNetworkCost()                          │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌────────────┐      ┌────────────┐      ┌────────────┐
  │Architecture│      │  Template  │      │    Cost    │
  │  Document  │      │  System    │      │  Database  │
  └────────────┘      └────────────┘      └────────────┘
```

### File Structure

```
agents/architect/
├── infrastructure-generator.ts    # Main generator class
├── infrastructure-types.ts        # Type definitions
├── templates/
│   ├── docker/
│   │   ├── node.dockerfile.ts     # Node.js Dockerfile template
│   │   ├── python.dockerfile.ts   # Python Dockerfile template
│   │   └── static.dockerfile.ts   # Static site Dockerfile template
│   ├── docker-compose/
│   │   ├── dev.compose.ts         # Dev docker-compose template
│   │   └── prod.compose.ts        # Prod docker-compose template
│   ├── github-actions/
│   │   └── ci-cd.workflow.ts      # GitHub Actions template
│   ├── terraform/
│   │   ├── aws.tf.ts              # AWS Terraform template
│   │   ├── vercel.tf.ts           # Vercel Terraform template
│   │   └── railway.tf.ts          # Railway Terraform template
│   └── pulumi/
│       └── aws.pulumi.ts          # AWS Pulumi template
├── cost-estimator.ts              # Cost estimation logic
└── index.ts                       # Public exports
```

### Implementation Outline

**File: agents/architect/infrastructure-generator.ts**

```typescript
import type {
  ArchitectureDoc,
  ComponentSpec,
} from './types.js';
import type {
  InfrastructureOptions,
  InfrastructureOutput,
  LoadProfile,
  CostEstimate,
  Environment,
  EnvironmentConfig,
  TerraformConfig,
  PulumiConfig,
} from './infrastructure-types.js';
import { estimateCost } from './cost-estimator.js';
import * as templates from './templates/index.js';

/**
 * Infrastructure Requirements Generator
 *
 * Transforms architecture documents into deployable infrastructure configurations.
 * Generates Docker, CI/CD, IaC templates, and cost estimates.
 */
export class InfrastructureGenerator {
  /**
   * Main generation method - orchestrates all infrastructure generation
   */
  generate(
    architecture: ArchitectureDoc,
    options: InfrastructureOptions = {}
  ): InfrastructureOutput {
    const opts = this.normalizeOptions(options);

    // Generate docker-compose for each environment
    const dockerCompose = {
      dev: this.generateDockerCompose(architecture, { name: 'dev', replicas: 1, resources: { cpu: '500m', memory: '512Mi', storage: '1Gi' } }),
      staging: this.generateDockerCompose(architecture, { name: 'staging', replicas: 2, resources: { cpu: '1000m', memory: '1Gi', storage: '5Gi' } }),
      prod: this.generateDockerCompose(architecture, { name: 'prod', replicas: 3, resources: { cpu: '2000m', memory: '2Gi', storage: '10Gi' } }),
    };

    // Generate Dockerfiles for each component
    const dockerfiles: Record<string, string> = {};
    for (const component of architecture.components) {
      if (component.type !== 'database') {
        dockerfiles[component.id] = this.generateDockerfile(component);
      }
    }

    // Generate CI/CD pipeline
    const githubActions = this.generateGitHubActionsWorkflow(architecture);

    // Generate IaC templates if requested
    let terraform: TerraformConfig | undefined;
    let pulumi: PulumiConfig | undefined;

    if (opts.targetPlatform === 'aws' || opts.targetPlatform === 'all') {
      terraform = this.generateTerraformConfig(architecture, 'aws');
      pulumi = this.generatePulumiConfig(architecture, 'aws');
    }

    // Generate environment configs
    const environmentConfigs = {
      dev: this.generateEnvironmentConfig(architecture, 'dev'),
      staging: this.generateEnvironmentConfig(architecture, 'staging'),
      prod: this.generateEnvironmentConfig(architecture, 'prod'),
    };

    // Estimate costs
    const defaultLoad: LoadProfile = {
      dailyActiveUsers: 1000,
      requestsPerSecond: 10,
      databaseSizeGB: 10,
      storageGB: 20,
      bandwidthGBPerMonth: 100,
    };
    const costEstimate = this.estimateMonthlyCost(architecture, defaultLoad);

    // Generate setup instructions
    const setupInstructions = this.generateSetupInstructions(architecture, opts);

    return {
      dockerCompose,
      dockerfiles,
      githubActions,
      terraform,
      pulumi,
      environmentConfigs,
      costEstimate,
      setupInstructions,
    };
  }

  /**
   * Generate docker-compose.yml for specified environment
   */
  generateDockerCompose(architecture: ArchitectureDoc, env: Environment): string {
    const isDev = env.name === 'dev';
    const services: string[] = [];

    // Generate service definitions
    for (const component of architecture.components) {
      if (component.type === 'backend' || component.type === 'frontend') {
        const service = templates.generateDockerComposeService(component, env, isDev);
        services.push(service);
      } else if (component.type === 'database') {
        const dbService = templates.generateDatabaseService(component, env);
        services.push(dbService);
      }
    }

    // Build complete docker-compose file
    return templates.dockerComposeTemplate(services, env.name);
  }

  /**
   * Generate Dockerfile for a component
   */
  generateDockerfile(component: ComponentSpec): string {
    // Determine technology/runtime
    const tech = component.technology.toLowerCase();

    if (tech.includes('node') || tech.includes('typescript')) {
      return templates.nodeDockerfile(component);
    } else if (tech.includes('python')) {
      return templates.pythonDockerfile(component);
    } else if (tech.includes('react') || tech.includes('vue') || tech.includes('static')) {
      return templates.staticDockerfile(component);
    }

    // Default to Node.js
    return templates.nodeDockerfile(component);
  }

  /**
   * Generate GitHub Actions CI/CD workflow
   */
  generateGitHubActionsWorkflow(architecture: ArchitectureDoc): string {
    return templates.githubActionsWorkflow(architecture);
  }

  /**
   * Generate Terraform configuration
   */
  generateTerraformConfig(architecture: ArchitectureDoc, provider: 'aws' | 'vercel' | 'railway'): TerraformConfig {
    if (provider === 'aws') {
      return templates.awsTerraform(architecture);
    } else if (provider === 'vercel') {
      return templates.vercelTerraform(architecture);
    } else {
      return templates.railwayTerraform(architecture);
    }
  }

  /**
   * Generate Pulumi configuration
   */
  generatePulumiConfig(architecture: ArchitectureDoc, provider: 'aws' | 'vercel' | 'railway'): PulumiConfig {
    return templates.awsPulumi(architecture);
  }

  /**
   * Generate environment-specific configuration
   */
  generateEnvironmentConfig(architecture: ArchitectureDoc, env: 'dev' | 'staging' | 'prod'): EnvironmentConfig {
    // Environment-specific parameters
    const envParams = this.getEnvironmentParameters(env);

    return {
      name: env,
      services: architecture.components
        .filter(c => c.type !== 'database')
        .map(c => templates.generateServiceConfig(c, envParams)),
      database: templates.generateDatabaseConfig(architecture, envParams),
      scaling: envParams.scaling,
      monitoring: envParams.monitoring,
    };
  }

  /**
   * Estimate monthly infrastructure cost
   */
  estimateMonthlyCost(architecture: ArchitectureDoc, load: LoadProfile): CostEstimate {
    return estimateCost(architecture, load);
  }

  // Helper methods
  private normalizeOptions(options: InfrastructureOptions): Required<InfrastructureOptions> {
    return {
      targetPlatform: options.targetPlatform || 'docker',
      environments: options.environments || ['dev', 'staging', 'prod'],
      costTier: options.costTier || 'standard',
      includeMonitoring: options.includeMonitoring ?? true,
      includeLogging: options.includeLogging ?? true,
      includeCaching: options.includeCaching ?? false,
    };
  }

  private getEnvironmentParameters(env: 'dev' | 'staging' | 'prod') {
    // Return environment-specific defaults
    // ... implementation
  }

  private generateSetupInstructions(architecture: ArchitectureDoc, options: InfrastructureOptions): string {
    // Generate markdown instructions
    // ... implementation
  }
}

/**
 * Factory function to create infrastructure generator
 */
export function createInfrastructureGenerator(): InfrastructureGenerator {
  return new InfrastructureGenerator();
}
```

---

## Pass Criteria

### Must Pass (Critical for Completion)

1. **PC-1: InfrastructureGenerator Class Exists**
   - ✅ File exists at `agents/architect/infrastructure-generator.ts`
   - ✅ Exports `InfrastructureGenerator` class
   - ✅ Exports `createInfrastructureGenerator` factory function
   - ✅ TypeScript compilation succeeds

2. **PC-2: Generate Method Exists**
   - ✅ `generate(architecture, options?)` method exists
   - ✅ Returns `InfrastructureOutput` object
   - ✅ Accepts `ArchitectureDoc` and optional `InfrastructureOptions`

3. **PC-3: Docker Compose Generation**
   - ✅ `generateDockerCompose(architecture, env)` method exists
   - ✅ Returns valid YAML string
   - ✅ Generated docker-compose.yml is syntactically valid
   - ✅ Includes services, networks, volumes
   - ✅ Dev environment includes hot-reload volumes
   - ✅ Prod environment includes resource limits

4. **PC-4: GitHub Actions Generation**
   - ✅ `generateGitHubActionsWorkflow(architecture)` method exists
   - ✅ Returns valid YAML string
   - ✅ Generated workflow includes: test, build, deploy jobs
   - ✅ Includes conditional deployment (staging vs prod)

5. **PC-5: Environment-Specific Configs**
   - ✅ `generateEnvironmentConfig(architecture, env)` method exists
   - ✅ Returns `EnvironmentConfig` object
   - ✅ Dev config has single replica, minimal resources
   - ✅ Staging config has 2 replicas, medium resources
   - ✅ Prod config has 3+ replicas, production resources

6. **PC-6: Cost Estimation**
   - ✅ `estimateMonthlyCost(architecture, load)` method exists
   - ✅ Returns `CostEstimate` object with monthly total
   - ✅ Includes breakdown by: compute, database, storage, bandwidth
   - ✅ Total cost is sum of component costs
   - ✅ Includes cost assumptions and recommendations

7. **PC-7: Type Safety**
   - ✅ All types defined in `infrastructure-types.ts`
   - ✅ Exports all required interfaces
   - ✅ No `any` types in public interfaces
   - ✅ TypeScript strict mode passes

8. **PC-8: Integration with Architect Agent**
   - ✅ Can import InfrastructureGenerator in architect-agent.ts
   - ✅ Architecture document from Architect Agent is valid input
   - ✅ No circular dependencies

### Should Pass (Important but not blocking)

9. **PC-9: Dockerfile Generation**
   - ✅ `generateDockerfile(component)` method exists
   - ✅ Supports Node.js/TypeScript components
   - ✅ Supports Python components
   - ✅ Supports static site components
   - ✅ Multi-stage builds for production

10. **PC-10: IaC Template Generation**
    - ✅ `generateTerraformConfig(architecture, provider)` exists
    - ✅ Returns valid Terraform configuration structure
    - ✅ Supports AWS provider
    - ✅ Supports Vercel provider (optional)
    - ✅ Supports Railway provider (optional)

11. **PC-11: Documentation**
    - ✅ All public methods have JSDoc comments
    - ✅ Generated configs include explanatory comments
    - ✅ Setup instructions are clear and actionable

### Nice to Have (Future enhancements)

12. **PC-12: Validation**
    - Validate architecture document before generation
    - Warn about missing recommended configurations
    - Suggest optimizations

13. **PC-13: Advanced Features**
    - Kubernetes manifests generation
    - Helm charts generation
    - Custom resource definitions

---

## Dependencies

### Required (Must exist before implementation)
- ✅ Architect Agent (`agents/architect/architect-agent.ts`) - EXISTS
- ✅ Architecture types (`agents/architect/types.ts`) - EXISTS
- ✅ TypeScript compiler - EXISTS

### Optional (Can be integrated later)
- Template System (VIBE-P10-002) - Can use for customization
- Cost database with current pricing - Can hardcode initial estimates

### Blocked By
- None (can be implemented independently)

---

## Implementation Steps

### Step 1: Create Type Definitions
1. Create `infrastructure-types.ts` with all interfaces
2. Verify TypeScript compilation

### Step 2: Create Template Functions
1. Create `templates/docker/` with Dockerfile templates
2. Create `templates/docker-compose/` with compose templates
3. Create `templates/github-actions/` with workflow template

### Step 3: Implement Core Generator Class
1. Create `infrastructure-generator.ts` with main class
2. Implement `generate()` method
3. Implement `generateDockerCompose()`
4. Implement `generateDockerfile()`
5. Implement `generateGitHubActionsWorkflow()`
6. Implement `generateEnvironmentConfig()`

### Step 4: Implement Cost Estimator
1. Create `cost-estimator.ts`
2. Implement `estimateCost()` function
3. Add cost breakdown logic
4. Add cost recommendations

### Step 5: IaC Templates (Optional for MVP)
1. Implement `generateTerraformConfig()` for AWS
2. Implement `generatePulumiConfig()` for AWS
3. Add Vercel/Railway support

### Step 6: Testing
1. Unit tests for each generation method
2. Integration test with sample architecture
3. Validate generated YAML/HCL syntax
4. Verify cost calculations

### Step 7: Documentation
1. Add JSDoc comments
2. Create usage examples
3. Document cost assumptions

---

## Success Metrics

### Implementation Success
- ✅ All 8 "Must Pass" criteria verified
- ✅ TypeScript compilation clean
- ✅ Generated docker-compose.yml is valid YAML
- ✅ Generated GitHub Actions workflow is valid YAML
- ✅ Cost estimate returns reasonable values
- ✅ Can generate infrastructure for sample architecture

### Quality Metrics
- Generated configs are production-ready
- Cost estimates within 20% of actual costs
- Setup instructions are actionable
- Dockerfile builds successfully

---

## References

### Related Specifications
- **VIBE-P10-001**: Architect Agent Base Implementation
- **VIBE-P10-002**: Architecture Template System
- **Existing code**: `parent-harness/docker-compose.yml` (reference implementation)
- **Existing code**: `.github/workflows/e2e-tests.yml` (workflow reference)
- **Existing code**: `parent-harness/orchestrator/Dockerfile` (Dockerfile reference)

### External References
- Docker Compose documentation: https://docs.docker.com/compose/
- GitHub Actions documentation: https://docs.github.com/actions
- Terraform AWS provider: https://registry.terraform.io/providers/hashicorp/aws
- Pulumi AWS: https://www.pulumi.com/docs/clouds/aws/
- AWS pricing calculator: https://calculator.aws/
- Multi-stage Docker builds: https://docs.docker.com/build/building/multi-stage/

---

**End of Specification**
