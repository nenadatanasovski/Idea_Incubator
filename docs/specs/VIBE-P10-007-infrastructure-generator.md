# VIBE-P10-007: Infrastructure Requirements Generator

**Status:** SPECIFICATION COMPLETE
**Created:** 2026-02-09
**Priority:** P1 (Phase 10 - Architecture Agent Foundation)
**Effort:** Large (20-28 hours)
**Model:** Opus
**Agent Type:** build_agent

---

## Overview

Build a comprehensive infrastructure requirements generator that analyzes architecture documents and generates production-ready infrastructure-as-code templates, Docker configurations, CI/CD pipelines, and cost estimates. The generator transforms architecture decisions into deployable infrastructure across multiple cloud providers (AWS, Vercel, Railway, Cloudflare) with environment-specific configurations.

### Problem Statement

**Current State:**

- Architect Agent generates architecture documents with deployment strategies
- Architecture documents include high-level deployment considerations
- No automated generation of infrastructure-as-code templates
- No Docker/docker-compose configuration generation
- No CI/CD pipeline templates
- No cost estimation based on architecture
- Manual infrastructure setup required for each project
- Inconsistent infrastructure patterns across projects

**Desired State:**

- `InfrastructureGenerator` class at `agents/architect/infrastructure-generator.ts`
- Generates docker-compose.yml for local development
- Generates GitHub Actions workflow templates
- Generates Terraform/Pulumi configurations for AWS, Vercel, Railway
- Generates environment-specific configs (dev/staging/prod)
- Provides monthly cost estimates based on expected load
- Infrastructure templates reflect architecture best practices
- Type-safe infrastructure configuration interfaces

### Value Proposition

The Infrastructure Requirements Generator is the **"DevOps Automation Engine"** that:

1. **Eliminates Manual Infrastructure Setup** - Generate production-ready configs from architecture
2. **Ensures Best Practices** - Templates encode infrastructure security and reliability patterns
3. **Accelerates Deployment** - From architecture to deployed app in minutes, not hours
4. **Provides Cost Visibility** - Know infrastructure costs before deployment
5. **Enables Multi-Environment Workflows** - Consistent configs across dev/staging/prod
6. **Supports Multiple Providers** - Choose AWS, Vercel, Railway, or hybrid approaches
7. **Facilitates CI/CD** - Auto-generate GitHub Actions workflows

---

## Requirements

### Functional Requirements

#### FR-1: Infrastructure Generator Class

**FR-1.1: Class Structure**

- Create `InfrastructureGenerator` class at `agents/architect/infrastructure-generator.ts`
- Class accepts `ArchitectureDoc` as input
- Main method: `generate(options: GenerationOptions): Promise<InfrastructureOutput>`
- Support multiple output formats: docker-compose, Terraform, Pulumi, GitHub Actions
- Stateless generator (no instance state beyond constructor config)

**FR-1.2: Generator Configuration**

```typescript
interface GeneratorConfig {
  targetProvider?: "aws" | "vercel" | "railway" | "cloudflare" | "docker";
  environments?: ("dev" | "staging" | "prod")[];
  includeCI?: boolean;
  includeCostEstimate?: boolean;
  projectName: string;
}
```

**FR-1.3: Generation Options**

```typescript
interface GenerationOptions {
  outputFormat:
    | "terraform"
    | "pulumi"
    | "docker-compose"
    | "github-actions"
    | "all";
  targetEnvironment?: "dev" | "staging" | "prod";
  estimateLoad?: LoadProfile;
}
```

**FR-1.4: Infrastructure Output**

```typescript
interface InfrastructureOutput {
  dockerCompose?: string;
  dockerfile?: Record<string, string>; // componentId -> Dockerfile content
  githubActions?: string;
  terraform?: TerraformConfig;
  pulumi?: PulumiConfig;
  environmentConfigs: EnvironmentConfig[];
  costEstimate?: CostEstimate;
  metadata: {
    generatedAt: Date;
    generatorVersion: string;
    architectureVersion: string;
  };
}
```

#### FR-2: Docker Compose Generation

**FR-2.1: Docker Compose Structure**

- Generate valid `docker-compose.yml` (version 3.8+)
- Create service definitions for each backend component
- Create service definitions for databases
- Configure networks and volumes
- Set up environment variables
- Add health checks for all services
- Configure port mappings
- Add restart policies

**FR-2.2: Service Generation Logic**

- Analyze `ArchitectureDoc.components` array
- For each component with type 'backend' or 'service': create service
- For each component with type 'database': create database service
- For each component with type 'infrastructure': create infrastructure service
- Generate service names from component IDs (kebab-case)
- Set appropriate base images based on `techStack.backend.runtime`

**FR-2.3: Docker Compose Features**

```yaml
version: "3.8"

services:
  # Generated from backend components
  api-service:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ${PROJECT_NAME}-api
    ports:
      - "${API_PORT:-3000}:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=${DATABASE_URL}
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      database:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - app-network

  # Generated from database components
  database:
    image: postgres:16-alpine # From techStack.database.engine
    container_name: ${PROJECT_NAME}-db
    environment:
      - POSTGRES_DB=${DB_NAME:-appdb}
      - POSTGRES_USER=${DB_USER:-appuser}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  db-data:
```

**FR-2.4: Technology-Specific Base Images**

- Node.js: `node:20-alpine`, `node:20-slim`
- Python: `python:3.12-alpine`, `python:3.12-slim`
- Go: `golang:1.21-alpine`
- Rust: `rust:1.75-alpine`
- PostgreSQL: `postgres:16-alpine`
- MySQL: `mysql:8.0`
- MongoDB: `mongo:7.0`
- Redis: `redis:7.2-alpine`

#### FR-3: Dockerfile Generation

**FR-3.1: Multi-Stage Dockerfiles**

- Generate Dockerfiles with multi-stage builds (builder + production)
- Optimize layer caching for dependencies
- Minimize final image size
- Include security best practices (non-root user, minimal dependencies)

**FR-3.2: Node.js Dockerfile Template**

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript/application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache python3

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })" || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

**FR-3.3: Python Dockerfile Template**

```dockerfile
# Build stage
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.12-slim

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Update PATH
ENV PATH=/root/.local/bin:$PATH

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### FR-4: GitHub Actions CI/CD Pipeline

**FR-4.1: Workflow Generation**

- Generate `.github/workflows/deploy.yml`
- Support multiple deployment targets (AWS, Vercel, Railway)
- Include build, test, and deploy stages
- Environment-specific deployment jobs (staging vs prod)
- Automatic deployment on branch push (main/develop)
- Manual workflow dispatch option

**FR-4.2: GitHub Actions Template Structure**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: "20"
  # Add component-specific versions

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: dist/

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts
          path: dist/

      # Provider-specific deployment steps generated here
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: ${{ secrets.VERCEL_SCOPE }}

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts
          path: dist/

      # Provider-specific deployment steps
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to AWS ECS
        run: |
          # ECS deployment commands
```

**FR-4.3: Provider-Specific Deployment Steps**

- **Vercel**: Use `amondnet/vercel-action` or `vercel deploy`
- **Railway**: Use Railway CLI with `railway up`
- **AWS**: Configure credentials, build Docker image, push to ECR, update ECS service
- **Cloudflare Pages**: Use Wrangler CLI for deployment

#### FR-5: Environment Configuration

**FR-5.1: Multi-Environment Support**

- Generate separate configs for dev, staging, production
- Environment-specific resource sizing
- Environment-specific feature flags
- Environment-specific secrets management

**FR-5.2: Environment Config Structure**

```typescript
interface EnvironmentConfig {
  name: "dev" | "staging" | "prod";
  description: string;
  resources: ResourceConfig;
  scaling: ScalingConfig;
  secrets: SecretConfig[];
  features: FeatureFlags;
  monitoring: MonitoringConfig;
}

interface ResourceConfig {
  compute: {
    instanceType: string;
    instanceCount: number;
    memory: string;
    cpu: string;
  };
  storage: {
    type: "ssd" | "hdd" | "s3";
    size: string;
    backups: boolean;
  };
  network: {
    bandwidth: string;
    cdn: boolean;
  };
  caching: {
    enabled: boolean;
    engine?: "redis" | "memcached";
    size?: string;
  };
}

interface ScalingConfig {
  type: "manual" | "horizontal" | "vertical" | "auto";
  min: number;
  max: number;
  targetCPU?: number;
  targetMemory?: number;
}

interface SecretConfig {
  name: string;
  description: string;
  required: boolean;
  example?: string;
  provider?: "aws-secrets" | "github-secrets" | "env-file";
}
```

**FR-5.3: Environment-Specific Defaults**

**Development:**

- Compute: 1 instance, 512MB RAM, 0.5 vCPU
- Storage: 10GB SSD, no backups
- Network: Basic bandwidth, no CDN
- Caching: Disabled or local
- Cost target: < $10/month

**Staging:**

- Compute: 1-2 instances, 1GB RAM, 1 vCPU
- Storage: 20GB SSD, daily backups
- Network: Standard bandwidth, CDN enabled
- Caching: Redis 512MB
- Cost target: $20-50/month

**Production:**

- Compute: 2-5 instances, 2GB RAM, 2 vCPU
- Storage: 50GB SSD, hourly backups + point-in-time recovery
- Network: High bandwidth, global CDN
- Caching: Redis 2GB with replication
- Cost target: $100-500/month (varies by scale)

#### FR-6: Cost Estimation

**FR-6.1: Cost Estimation Function**

```typescript
interface CostEstimate {
  provider: string;
  currency: "USD";
  breakdown: CostBreakdown;
  total: {
    hourly: number;
    daily: number;
    monthly: number;
    yearly: number;
  };
  assumptions: string[];
  recommendations: string[];
}

interface CostBreakdown {
  compute: CostItem;
  storage: CostItem;
  network: CostItem;
  database: CostItem;
  caching?: CostItem;
  cdn?: CostItem;
  monitoring?: CostItem;
  other?: CostItem;
}

interface CostItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  monthlyTotal: number;
}
```

**FR-6.2: Cost Estimation Logic**

- Accept `LoadProfile` as input (expected requests/day, storage needs, users)
- Use provider pricing APIs when available
- Fall back to hardcoded pricing tables (updated quarterly)
- Calculate costs for each resource type
- Include data transfer costs
- Include backup/disaster recovery costs
- Provide cost optimization recommendations

**FR-6.3: Load Profile Input**

```typescript
interface LoadProfile {
  requestsPerDay: number;
  concurrentUsers: number;
  storageGrowthPerMonth: number; // GB
  dataTrasferPerMonth: number; // GB
  peakTrafficMultiplier: number; // e.g., 3x
  region?: string;
}
```

**FR-6.4: Provider Pricing Tables**

```typescript
// AWS EC2 pricing (us-east-1, as of 2026-01)
const AWS_PRICING = {
  compute: {
    "t3.micro": 0.0104, // per hour
    "t3.small": 0.0208,
    "t3.medium": 0.0416,
    "t3.large": 0.0832,
  },
  storage: {
    gp3: 0.08, // per GB-month
    io2: 0.125,
  },
  dataTransfer: {
    outbound: 0.09, // per GB (first 10TB)
  },
  rds: {
    "db.t3.micro": 0.017, // per hour
    "db.t3.small": 0.034,
  },
};

// Vercel pricing
const VERCEL_PRICING = {
  hobby: 0, // Free tier
  pro: 20, // per month base
  compute: 0, // Included in pro
  bandwidth: 0.15, // per GB over 1TB
};

// Railway pricing
const RAILWAY_PRICING = {
  starter: 5, // per month base
  compute: 0.000231, // per vCPU-hour
  memory: 0.000231, // per GB-hour
  storage: 0.25, // per GB-month
  bandwidth: 0.1, // per GB
};
```

**FR-6.5: Cost Calculation Example**

```typescript
function estimateMonthlyCost(
  architecture: ArchitectureDoc,
  environment: "dev" | "staging" | "prod",
  loadProfile: LoadProfile,
): CostEstimate {
  const config = getEnvironmentConfig(architecture, environment);

  // Calculate compute costs
  const computeCost = calculateComputeCost(config.resources.compute);

  // Calculate storage costs
  const storageCost = calculateStorageCost(
    config.resources.storage,
    loadProfile,
  );

  // Calculate network costs
  const networkCost = calculateNetworkCost(loadProfile.dataTrasferPerMonth);

  // Calculate database costs
  const databaseCost = calculateDatabaseCost(
    architecture.databaseSchema,
    config,
  );

  // Calculate caching costs
  const cachingCost = config.resources.caching.enabled
    ? calculateCachingCost(config.resources.caching)
    : 0;

  // Sum all costs
  const totalMonthly =
    computeCost + storageCost + networkCost + databaseCost + cachingCost;

  return {
    provider: "AWS",
    currency: "USD",
    breakdown: {
      compute: {
        description: "t3.medium instance",
        quantity: 2,
        unit: "instance",
        unitPrice: 30.05,
        monthlyTotal: 60.1,
      },
      storage: {
        description: "gp3 SSD",
        quantity: 50,
        unit: "GB",
        unitPrice: 0.08,
        monthlyTotal: 4.0,
      },
      network: {
        description: "Data transfer",
        quantity: 100,
        unit: "GB",
        unitPrice: 0.09,
        monthlyTotal: 9.0,
      },
      database: {
        description: "RDS db.t3.small",
        quantity: 1,
        unit: "instance",
        unitPrice: 24.82,
        monthlyTotal: 24.82,
      },
      caching: {
        description: "ElastiCache Redis",
        quantity: 1,
        unit: "node",
        unitPrice: 17.28,
        monthlyTotal: 17.28,
      },
    },
    total: {
      hourly: totalMonthly / 730,
      daily: totalMonthly / 30,
      monthly: totalMonthly,
      yearly: totalMonthly * 12,
    },
    assumptions: [
      "Assumes 730 hours per month",
      "Pricing based on us-east-1 region",
      "Does not include free tier benefits",
      "Includes 100GB data transfer per month",
    ],
    recommendations: [
      "Consider Reserved Instances for 30% savings on compute",
      "Enable auto-scaling to reduce costs during low traffic",
      "Use S3 for static assets instead of EBS",
      "Consider Aurora Serverless for variable workloads",
    ],
  };
}
```

#### FR-7: Terraform Configuration

**FR-7.1: Terraform Module Structure**

```
terraform/
├── main.tf           # Main configuration
├── variables.tf      # Input variables
├── outputs.tf        # Output values
├── providers.tf      # Provider configuration
├── modules/
│   ├── compute/      # EC2/ECS/Lambda modules
│   ├── database/     # RDS/DynamoDB modules
│   ├── network/      # VPC/subnet/security group modules
│   └── storage/      # S3/EBS modules
└── environments/
    ├── dev/
    ├── staging/
    └── prod/
```

**FR-7.2: Terraform Output Interface**

```typescript
interface TerraformConfig {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
  providersTf: string;
  modules: Record<string, string>;
  environmentOverrides: Record<string, string>;
}
```

**FR-7.3: Basic Terraform Template**

```hcl
# providers.tf
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "${var.project_name}-terraform-state"
    key    = "terraform.tfstate"
    region = var.aws_region
  }
}

provider "aws" {
  region = var.aws_region
}

# variables.tf
variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# main.tf
module "network" {
  source = "./modules/network"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr
}

module "compute" {
  source = "./modules/compute"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.network.vpc_id
  subnet_ids   = module.network.private_subnet_ids

  instance_type  = var.instance_type
  instance_count = var.instance_count
}

module "database" {
  source = "./modules/database"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.network.vpc_id
  subnet_ids   = module.network.database_subnet_ids

  engine          = var.db_engine
  instance_class  = var.db_instance_class
  allocated_storage = var.db_storage_gb
}

# outputs.tf
output "vpc_id" {
  value = module.network.vpc_id
}

output "load_balancer_dns" {
  value = module.compute.load_balancer_dns
}

output "database_endpoint" {
  value = module.database.endpoint
  sensitive = true
}
```

#### FR-8: Pulumi Configuration

**FR-8.1: Pulumi Output Interface**

```typescript
interface PulumiConfig {
  indexTs: string; // Pulumi program in TypeScript
  packageJson: string;
  pulumiYaml: string;
  stackConfigs: Record<string, string>; // dev.yaml, staging.yaml, prod.yaml
}
```

**FR-8.2: Pulumi Template**

```typescript
// index.ts
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const projectName = config.require("projectName");
const environment = config.require("environment");

// Create VPC
const vpc = new aws.ec2.Vpc(`${projectName}-vpc`, {
  cidrBlock: "10.0.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: `${projectName}-${environment}-vpc`,
    Environment: environment,
  },
});

// Create ECS cluster
const cluster = new aws.ecs.Cluster(`${projectName}-cluster`, {
  name: `${projectName}-${environment}`,
  tags: {
    Environment: environment,
  },
});

// Create RDS instance
const db = new aws.rds.Instance(`${projectName}-db`, {
  engine: "postgres",
  engineVersion: "16.1",
  instanceClass: "db.t3.small",
  allocatedStorage: 20,
  dbName: config.require("dbName"),
  username: config.requireSecret("dbUsername"),
  password: config.requireSecret("dbPassword"),
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  dbSubnetGroupName: dbSubnetGroup.name,
  skipFinalSnapshot: environment !== "prod",
  tags: {
    Environment: environment,
  },
});

// Export outputs
export const vpcId = vpc.id;
export const clusterName = cluster.name;
export const dbEndpoint = db.endpoint;
```

### Non-Functional Requirements

**NFR-1: Output Validity**

- All generated YAML/HCL must be syntactically valid
- Docker Compose must pass `docker-compose config` validation
- Terraform must pass `terraform validate`
- GitHub Actions must pass YAML schema validation

**NFR-2: Security Best Practices**

- Non-root Docker users
- Minimal base images (alpine where possible)
- No hardcoded secrets in configs
- Use secret management for sensitive values
- Security groups with least-privilege access
- HTTPS enforcement
- Regular security updates in Dockerfiles

**NFR-3: Performance**

- Infrastructure generation completes within 10 seconds
- Cost estimation completes within 2 seconds
- Minimal memory footprint (< 50MB)

**NFR-4: Extensibility**

- Easy to add new cloud providers
- Template system for custom infrastructure patterns
- Pluggable cost estimation sources
- Support for custom Dockerfile templates

**NFR-5: Documentation**

- Generated configs include inline comments
- README files generated for infrastructure setup
- Cost estimates include explanatory notes
- Deployment guides auto-generated

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│             InfrastructureGenerator                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   generate(options: GenerationOptions)                 │ │
│  │   - Orchestrates all generation phases                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│        ┌─────────────────┼─────────────────┐               │
│        ▼                  ▼                  ▼               │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐         │
│  │  Docker  │      │   CI/CD  │      │   IaC    │         │
│  │Generator │      │Generator │      │Generator │         │
│  └──────────┘      └──────────┘      └──────────┘         │
│        │                  │                  │               │
│        ├─ generateDockerCompose()           │               │
│        ├─ generateDockerfile()              │               │
│        │                  ├─ generateGitHubActions()        │
│        │                  │                  ├─ generateTerraform() │
│        │                  │                  └─ generatePulumi()    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   CostEstimator                                        │ │
│  │   - estimateCost(architecture, environment, load)      │ │
│  │   - Pricing tables for AWS, Vercel, Railway          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   EnvironmentConfigGenerator                          │ │
│  │   - generateEnvConfig(environment)                     │ │
│  │   - Resource sizing for dev/staging/prod              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Implementation

See Implementation section for:

- Type definitions
- InfrastructureGenerator class
- Docker generation functions
- CI/CD generation functions
- Cost estimation functions
- Helper utilities

### Integration Points

**1. Architect Agent Integration**

- Location: `agents/architect/architect-agent.ts`
- Usage: Call `InfrastructureGenerator.generate()` after architecture generation
- Pattern: Import generator, instantiate with architecture doc, generate configs

**2. Architecture Types**

- Location: `agents/architect/types.ts`
- Dependencies: `ArchitectureDoc`, `ComponentSpec`, `TechStackDecision`, `DatabaseSchema`
- Pattern: Generator reads architecture types and generates infrastructure

**3. File Output**

- Location: `ideas/{ideaId}/infrastructure/`
- Files: `docker-compose.yml`, `Dockerfile.*`, `.github/workflows/deploy.yml`, `terraform/`, `pulumi/`
- Pattern: Generate directory structure, write files with proper formatting

---

## Implementation

### 1. Type Definitions

**File:** `agents/architect/infrastructure-types.ts`

```typescript
/**
 * Infrastructure Generator Types
 */

import type { ArchitectureDoc } from "./types.js";

export interface GeneratorConfig {
  targetProvider?: "aws" | "vercel" | "railway" | "cloudflare" | "docker";
  environments?: ("dev" | "staging" | "prod")[];
  includeCI?: boolean;
  includeCostEstimate?: boolean;
  projectName: string;
}

export interface GenerationOptions {
  outputFormat:
    | "terraform"
    | "pulumi"
    | "docker-compose"
    | "github-actions"
    | "all";
  targetEnvironment?: "dev" | "staging" | "prod";
  estimateLoad?: LoadProfile;
}

export interface InfrastructureOutput {
  dockerCompose?: string;
  dockerfile?: Record<string, string>;
  githubActions?: string;
  terraform?: TerraformConfig;
  pulumi?: PulumiConfig;
  environmentConfigs: EnvironmentConfig[];
  costEstimate?: CostEstimate;
  metadata: {
    generatedAt: Date;
    generatorVersion: string;
    architectureVersion: string;
  };
}

export interface LoadProfile {
  requestsPerDay: number;
  concurrentUsers: number;
  storageGrowthPerMonth: number;
  dataTrasferPerMonth: number;
  peakTrafficMultiplier: number;
  region?: string;
}

export interface EnvironmentConfig {
  name: "dev" | "staging" | "prod";
  description: string;
  resources: ResourceConfig;
  scaling: ScalingConfig;
  secrets: SecretConfig[];
  features: FeatureFlags;
  monitoring: MonitoringConfig;
}

export interface ResourceConfig {
  compute: {
    instanceType: string;
    instanceCount: number;
    memory: string;
    cpu: string;
  };
  storage: {
    type: "ssd" | "hdd" | "s3";
    size: string;
    backups: boolean;
  };
  network: {
    bandwidth: string;
    cdn: boolean;
  };
  caching: {
    enabled: boolean;
    engine?: "redis" | "memcached";
    size?: string;
  };
}

export interface ScalingConfig {
  type: "manual" | "horizontal" | "vertical" | "auto";
  min: number;
  max: number;
  targetCPU?: number;
  targetMemory?: number;
}

export interface SecretConfig {
  name: string;
  description: string;
  required: boolean;
  example?: string;
  provider?: "aws-secrets" | "github-secrets" | "env-file";
}

export interface FeatureFlags {
  [key: string]: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsProvider?: string;
  loggingProvider?: string;
  tracingProvider?: string;
}

export interface CostEstimate {
  provider: string;
  currency: "USD";
  breakdown: CostBreakdown;
  total: {
    hourly: number;
    daily: number;
    monthly: number;
    yearly: number;
  };
  assumptions: string[];
  recommendations: string[];
}

export interface CostBreakdown {
  compute: CostItem;
  storage: CostItem;
  network: CostItem;
  database: CostItem;
  caching?: CostItem;
  cdn?: CostItem;
  monitoring?: CostItem;
  other?: CostItem;
}

export interface CostItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  monthlyTotal: number;
}

export interface TerraformConfig {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
  providersTf: string;
  modules: Record<string, string>;
  environmentOverrides: Record<string, string>;
}

export interface PulumiConfig {
  indexTs: string;
  packageJson: string;
  pulumiYaml: string;
  stackConfigs: Record<string, string>;
}
```

### 2. InfrastructureGenerator Class

**File:** `agents/architect/infrastructure-generator.ts`

```typescript
/**
 * Infrastructure Requirements Generator
 *
 * Generates infrastructure-as-code templates, Docker configurations,
 * CI/CD pipelines, and cost estimates from architecture documents.
 */

import type {
  ArchitectureDoc,
  ComponentSpec,
  TechStackDecision,
} from "./types.js";
import type {
  GeneratorConfig,
  GenerationOptions,
  InfrastructureOutput,
  EnvironmentConfig,
  CostEstimate,
  LoadProfile,
} from "./infrastructure-types.js";

export class InfrastructureGenerator {
  private architecture: ArchitectureDoc;
  private config: GeneratorConfig;

  constructor(architecture: ArchitectureDoc, config: GeneratorConfig) {
    this.architecture = architecture;
    this.config = {
      environments: ["dev", "staging", "prod"],
      includeCI: true,
      includeCostEstimate: true,
      ...config,
    };
  }

  /**
   * Main entry point: Generate infrastructure configurations
   */
  async generate(options: GenerationOptions): Promise<InfrastructureOutput> {
    const output: InfrastructureOutput = {
      environmentConfigs: [],
      metadata: {
        generatedAt: new Date(),
        generatorVersion: "1.0.0",
        architectureVersion: this.architecture.version,
      },
    };

    // Generate environment configs
    for (const env of this.config.environments || ["dev", "staging", "prod"]) {
      output.environmentConfigs.push(this.generateEnvironmentConfig(env));
    }

    // Generate Docker Compose
    if (
      options.outputFormat === "docker-compose" ||
      options.outputFormat === "all"
    ) {
      output.dockerCompose = this.generateDockerCompose();
      output.dockerfile = this.generateDockerfiles();
    }

    // Generate CI/CD pipeline
    if (
      this.config.includeCI &&
      (options.outputFormat === "github-actions" ||
        options.outputFormat === "all")
    ) {
      output.githubActions = this.generateGitHubActions();
    }

    // Generate Terraform
    if (
      options.outputFormat === "terraform" ||
      options.outputFormat === "all"
    ) {
      output.terraform = this.generateTerraform();
    }

    // Generate Pulumi
    if (options.outputFormat === "pulumi" || options.outputFormat === "all") {
      output.pulumi = this.generatePulumi();
    }

    // Generate cost estimate
    if (this.config.includeCostEstimate && options.estimateLoad) {
      const env = options.targetEnvironment || "prod";
      output.costEstimate = this.estimateCost(env, options.estimateLoad);
    }

    return output;
  }

  /**
   * Generate environment-specific configuration
   */
  private generateEnvironmentConfig(
    env: "dev" | "staging" | "prod",
  ): EnvironmentConfig {
    const baseConfig = this.getBaseResourceConfig(env);

    return {
      name: env,
      description: `${env.charAt(0).toUpperCase() + env.slice(1)} environment configuration`,
      resources: baseConfig,
      scaling: this.getScalingConfig(env),
      secrets: this.generateSecretsConfig(),
      features: this.getFeatureFlags(env),
      monitoring: this.getMonitoringConfig(env),
    };
  }

  /**
   * Generate docker-compose.yml
   */
  private generateDockerCompose(): string {
    const services: string[] = [];
    const volumes: string[] = [];
    const networks = ["app-network"];

    // Generate service definitions
    for (const component of this.architecture.components) {
      if (component.type === "backend" || component.type === "service") {
        services.push(this.generateServiceDefinition(component));
      } else if (component.type === "database") {
        services.push(this.generateDatabaseService(component));
        volumes.push(`${component.id}-data`);
      }
    }

    return `version: '3.8'

services:
${services.join("\n\n")}

networks:
  app-network:
    driver: bridge

volumes:
${volumes.map((v) => `  ${v}:`).join("\n")}
`;
  }

  /**
   * Generate service definition for docker-compose
   */
  private generateServiceDefinition(component: ComponentSpec): string {
    const serviceName = this.toKebabCase(component.id);
    const port = this.inferPort(component);

    return `  ${serviceName}:
    build:
      context: ./${component.id}
      dockerfile: Dockerfile
    container_name: \${PROJECT_NAME:-app}-${serviceName}
    ports:
      - "\${${serviceName.toUpperCase().replace(/-/g, "_")}_PORT:-${port}}:${port}"
    environment:
      - NODE_ENV=\${NODE_ENV:-development}
      - DATABASE_URL=\${DATABASE_URL}
    volumes:
      - ./${component.id}:/app
      - /app/node_modules
    depends_on:
      - database
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${port}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - app-network`;
  }

  /**
   * Generate database service definition
   */
  private generateDatabaseService(component: ComponentSpec): string {
    const dbEngine = this.architecture.databaseSchema?.engine || "postgres";
    const image = this.getDatabaseImage(dbEngine);
    const healthCheck = this.getDatabaseHealthCheck(dbEngine);

    return `  database:
    image: ${image}
    container_name: \${PROJECT_NAME:-app}-db
    environment:
      - POSTGRES_DB=\${DB_NAME:-appdb}
      - POSTGRES_USER=\${DB_USER:-appuser}
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      ${healthCheck}
    restart: unless-stopped
    networks:
      - app-network`;
  }

  /**
   * Generate Dockerfiles for each component
   */
  private generateDockerfiles(): Record<string, string> {
    const dockerfiles: Record<string, string> = {};

    for (const component of this.architecture.components) {
      if (
        component.type === "backend" ||
        component.type === "service" ||
        component.type === "frontend"
      ) {
        const runtime = this.inferRuntime(component);
        dockerfiles[component.id] = this.generateDockerfile(component, runtime);
      }
    }

    return dockerfiles;
  }

  /**
   * Generate Dockerfile for a component
   */
  private generateDockerfile(
    component: ComponentSpec,
    runtime: string,
  ): string {
    if (runtime.includes("node")) {
      return this.generateNodeDockerfile();
    } else if (runtime.includes("python")) {
      return this.generatePythonDockerfile();
    }

    // Default to Node.js
    return this.generateNodeDockerfile();
  }

  /**
   * Generate Node.js Dockerfile
   */
  private generateNodeDockerfile(): string {
    return `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript/application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache python3

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })" || exit 1

# Start application
CMD ["node", "dist/index.js"]
`;
  }

  /**
   * Generate Python Dockerfile
   */
  private generatePythonDockerfile(): string {
    return `# Build stage
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.12-slim

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1001 appuser && \\
    chown -R appuser:appuser /app

USER appuser

# Update PATH
ENV PATH=/root/.local/bin:$PATH

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
  }

  /**
   * Generate GitHub Actions workflow
   */
  private generateGitHubActions(): string {
    const provider = this.config.targetProvider || "docker";
    const deploySteps = this.generateDeploymentSteps(provider);

    return `name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '20'

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: dist/

${deploySteps}
`;
  }

  /**
   * Generate deployment steps for GitHub Actions
   */
  private generateDeploymentSteps(provider: string): string {
    if (provider === "vercel") {
      return `  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://\${{ secrets.VERCEL_DOMAIN }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'`;
    } else if (provider === "railway") {
      return `  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: \${{ secrets.RAILWAY_TOKEN }}`;
    }

    // Default: Docker build and push
    return `  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build and push Docker image
        run: |
          docker build -t \${IMAGE_NAME}:latest .
          docker push \${IMAGE_NAME}:latest`;
  }

  /**
   * Generate Terraform configuration
   */
  private generateTerraform(): any {
    // Placeholder for Terraform generation
    return {
      mainTf: "# Terraform main configuration\n",
      variablesTf: "# Terraform variables\n",
      outputsTf: "# Terraform outputs\n",
      providersTf: "# Terraform providers\n",
      modules: {},
      environmentOverrides: {},
    };
  }

  /**
   * Generate Pulumi configuration
   */
  private generatePulumi(): any {
    // Placeholder for Pulumi generation
    return {
      indexTs: "// Pulumi program\n",
      packageJson: "{}",
      pulumiYaml: "# Pulumi config\n",
      stackConfigs: {},
    };
  }

  /**
   * Estimate monthly cost
   */
  private estimateCost(
    environment: string,
    loadProfile: LoadProfile,
  ): CostEstimate {
    const config = this.generateEnvironmentConfig(environment as any);

    // Simple cost calculation
    const computeCost = this.calculateComputeCost(config.resources.compute);
    const storageCost = this.calculateStorageCost(
      config.resources.storage,
      loadProfile,
    );
    const networkCost = loadProfile.dataTrasferPerMonth * 0.09;

    const totalMonthly = computeCost + storageCost + networkCost;

    return {
      provider: this.config.targetProvider || "AWS",
      currency: "USD",
      breakdown: {
        compute: {
          description: `${config.resources.compute.instanceType} instance`,
          quantity: config.resources.compute.instanceCount,
          unit: "instance",
          unitPrice: computeCost / config.resources.compute.instanceCount,
          monthlyTotal: computeCost,
        },
        storage: {
          description: `${config.resources.storage.type.toUpperCase()} storage`,
          quantity: parseInt(config.resources.storage.size),
          unit: "GB",
          unitPrice: 0.08,
          monthlyTotal: storageCost,
        },
        network: {
          description: "Data transfer",
          quantity: loadProfile.dataTrasferPerMonth,
          unit: "GB",
          unitPrice: 0.09,
          monthlyTotal: networkCost,
        },
        database: {
          description: "Managed database",
          quantity: 1,
          unit: "instance",
          unitPrice: 25,
          monthlyTotal: 25,
        },
      },
      total: {
        hourly: totalMonthly / 730,
        daily: totalMonthly / 30,
        monthly: totalMonthly,
        yearly: totalMonthly * 12,
      },
      assumptions: [
        "Pricing based on us-east-1 region",
        "Assumes 730 hours per month",
        "Does not include free tier benefits",
      ],
      recommendations: [
        "Consider Reserved Instances for long-term savings",
        "Enable auto-scaling to optimize costs",
        "Use S3 for static asset storage",
      ],
    };
  }

  // Helper methods
  private getBaseResourceConfig(env: string): any {
    const configs = {
      dev: {
        compute: {
          instanceType: "t3.micro",
          instanceCount: 1,
          memory: "512MB",
          cpu: "0.5",
        },
        storage: { type: "ssd", size: "10GB", backups: false },
        network: { bandwidth: "basic", cdn: false },
        caching: { enabled: false },
      },
      staging: {
        compute: {
          instanceType: "t3.small",
          instanceCount: 1,
          memory: "1GB",
          cpu: "1",
        },
        storage: { type: "ssd", size: "20GB", backups: true },
        network: { bandwidth: "standard", cdn: true },
        caching: { enabled: true, engine: "redis", size: "512MB" },
      },
      prod: {
        compute: {
          instanceType: "t3.medium",
          instanceCount: 2,
          memory: "2GB",
          cpu: "2",
        },
        storage: { type: "ssd", size: "50GB", backups: true },
        network: { bandwidth: "high", cdn: true },
        caching: { enabled: true, engine: "redis", size: "2GB" },
      },
    };

    return configs[env as keyof typeof configs] || configs.dev;
  }

  private getScalingConfig(env: string): any {
    if (env === "prod") {
      return { type: "auto", min: 2, max: 10, targetCPU: 70, targetMemory: 80 };
    } else if (env === "staging") {
      return { type: "horizontal", min: 1, max: 3 };
    }
    return { type: "manual", min: 1, max: 1 };
  }

  private generateSecretsConfig(): any[] {
    return [
      {
        name: "DATABASE_URL",
        description: "Database connection string",
        required: true,
        example: "postgresql://user:pass@host:5432/dbname",
        provider: "env-file",
      },
      {
        name: "JWT_SECRET",
        description: "Secret for JWT token signing",
        required: true,
        provider: "aws-secrets",
      },
    ];
  }

  private getFeatureFlags(env: string): Record<string, boolean> {
    return {
      enableAnalytics: env === "prod",
      enableDebugLogging: env === "dev",
      enableRateLimiting: env !== "dev",
    };
  }

  private getMonitoringConfig(env: string): any {
    return {
      enabled: env !== "dev",
      metricsProvider: env === "prod" ? "Datadog" : undefined,
      loggingProvider: "CloudWatch",
      tracingProvider: env === "prod" ? "AWS X-Ray" : undefined,
    };
  }

  private calculateComputeCost(compute: any): number {
    const pricing: Record<string, number> = {
      "t3.micro": 7.59,
      "t3.small": 15.18,
      "t3.medium": 30.37,
      "t3.large": 60.74,
    };

    return (pricing[compute.instanceType] || 30) * compute.instanceCount;
  }

  private calculateStorageCost(storage: any, load: LoadProfile): number {
    const sizeGB = parseInt(storage.size);
    const costPerGB = storage.type === "ssd" ? 0.08 : 0.045;
    return sizeGB * costPerGB;
  }

  private toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  }

  private inferPort(component: ComponentSpec): number {
    if (component.name.toLowerCase().includes("api")) return 3000;
    if (component.name.toLowerCase().includes("web")) return 8080;
    return 3000;
  }

  private inferRuntime(component: ComponentSpec): string {
    const tech = this.architecture.techStack;
    if (tech?.backend?.runtime) return tech.backend.runtime;
    if (component.technologies.some((t) => t.toLowerCase().includes("node")))
      return "node";
    if (component.technologies.some((t) => t.toLowerCase().includes("python")))
      return "python";
    return "node";
  }

  private getDatabaseImage(engine: string): string {
    const images: Record<string, string> = {
      postgres: "postgres:16-alpine",
      postgresql: "postgres:16-alpine",
      mysql: "mysql:8.0",
      mongodb: "mongo:7.0",
      redis: "redis:7.2-alpine",
    };

    return images[engine.toLowerCase()] || "postgres:16-alpine";
  }

  private getDatabaseHealthCheck(engine: string): string {
    const checks: Record<string, string> = {
      postgres:
        'test: ["CMD-SHELL", "pg_isready -U appuser"]\n      interval: 10s\n      timeout: 5s\n      retries: 5',
      mysql:
        'test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]\n      interval: 10s\n      timeout: 5s\n      retries: 5',
      mongodb:
        'test: ["CMD", "mongo", "--eval", "db.adminCommand(\'ping\')"]\n      interval: 10s\n      timeout: 5s\n      retries: 5',
    };

    return checks[engine.toLowerCase()] || checks["postgres"];
  }
}

/**
 * Factory function to create infrastructure generator
 */
export function createInfrastructureGenerator(
  architecture: ArchitectureDoc,
  config: GeneratorConfig,
): InfrastructureGenerator {
  return new InfrastructureGenerator(architecture, config);
}
```

---

## Pass Criteria

### Must Pass (Critical for Completion)

1. **PC-1: InfrastructureGenerator Class Exists**
   - ✅ File exists at `agents/architect/infrastructure-generator.ts`
   - ✅ Exports `InfrastructureGenerator` class
   - ✅ Exports `createInfrastructureGenerator` factory function
   - ✅ TypeScript compilation succeeds with no errors

2. **PC-2: Docker Compose Generation**
   - ✅ `generateDockerCompose()` method returns valid YAML string
   - ✅ Output includes service definitions for backend components
   - ✅ Output includes database service with health check
   - ✅ Output includes networks and volumes
   - ✅ Can parse with `docker-compose config` without errors

3. **PC-3: Dockerfile Generation**
   - ✅ `generateDockerfiles()` method returns object with Dockerfile content
   - ✅ Generated Dockerfiles use multi-stage builds
   - ✅ Dockerfiles include health checks
   - ✅ Dockerfiles use non-root users
   - ✅ At least Node.js and Python templates implemented

4. **PC-4: GitHub Actions Workflow**
   - ✅ `generateGitHubActions()` method returns valid YAML
   - ✅ Workflow includes test, build, and deploy jobs
   - ✅ Workflow supports environment-based deployment (staging/prod)
   - ✅ YAML is syntactically valid

5. **PC-5: Environment Configuration**
   - ✅ `generateEnvironmentConfig()` creates configs for dev/staging/prod
   - ✅ Each environment has appropriate resource sizing
   - ✅ Each environment has scaling configuration
   - ✅ Each environment has secrets configuration

6. **PC-6: Cost Estimation**
   - ✅ `estimateCost()` method exists and returns `CostEstimate`
   - ✅ Returns monthly cost breakdown by resource type
   - ✅ Includes total hourly, daily, monthly, yearly costs
   - ✅ Includes assumptions and recommendations

7. **PC-7: Type Definitions Complete**
   - ✅ File exists at `agents/architect/infrastructure-types.ts`
   - ✅ All interfaces exported: `GeneratorConfig`, `GenerationOptions`, `InfrastructureOutput`, `CostEstimate`, etc.
   - ✅ All interfaces strongly typed (no `any` except where needed)

8. **PC-8: Integration with Architecture Types**
   - ✅ Generator accepts `ArchitectureDoc` as input
   - ✅ Generator reads `components`, `techStack`, `databaseSchema`
   - ✅ Generator produces output based on architecture decisions

### Should Pass (Important)

9. **PC-9: Security Best Practices**
   - ✅ Dockerfiles use non-root users
   - ✅ Dockerfiles use alpine/slim base images
   - ✅ No hardcoded secrets in generated configs
   - ✅ Health checks included

10. **PC-10: Output Validity**
    - ✅ Docker Compose YAML is valid
    - ✅ Dockerfiles build successfully
    - ✅ GitHub Actions YAML is valid
    - ✅ All generated files are syntactically correct

### Nice to Have

11. **PC-11: Terraform/Pulumi Support**
    - Basic Terraform config generation
    - Basic Pulumi config generation

12. **PC-12: Multiple Provider Support**
    - AWS deployment steps
    - Vercel deployment steps
    - Railway deployment steps

---

## Dependencies

### Required

- ✅ TypeScript compiler (exists in project)
- ✅ Architect Agent types (`agents/architect/types.ts`)
- ✅ Architecture document interface

### Optional

- Docker CLI (for testing generated configs)
- Terraform CLI (for validating Terraform)
- GitHub CLI (for validating workflows)

### Blocked By

- None (can be implemented independently)

---

## Implementation Notes

### File Creation Order

1. Create `infrastructure-types.ts` with all TypeScript interfaces
2. Create `infrastructure-generator.ts` with main class
3. Implement Docker generation methods first (most critical)
4. Implement GitHub Actions generation
5. Implement cost estimation
6. Implement Terraform/Pulumi (optional)
7. Test with sample architecture documents

### Testing Strategy

- Unit tests for each generation method
- Integration tests with real architecture documents
- Validation tests for generated configs (docker-compose config, YAML linting)
- Cost estimation accuracy tests

### Usage Example

```typescript
import { InfrastructureGenerator } from "./infrastructure-generator.js";
import type { ArchitectureDoc } from "./types.js";

const architecture: ArchitectureDoc = {
  /* ... */
};

const generator = new InfrastructureGenerator(architecture, {
  projectName: "my-app",
  targetProvider: "aws",
  includeCI: true,
  includeCostEstimate: true,
});

const output = await generator.generate({
  outputFormat: "all",
  targetEnvironment: "prod",
  estimateLoad: {
    requestsPerDay: 100000,
    concurrentUsers: 500,
    storageGrowthPerMonth: 10,
    dataTrasferPerMonth: 100,
    peakTrafficMultiplier: 3,
  },
});

console.log("Docker Compose:", output.dockerCompose);
console.log("Cost Estimate:", output.costEstimate);
```

---

## Future Enhancements

### Phase 2

- Kubernetes manifest generation
- Helm chart generation
- AWS CDK support
- Azure Bicep support
- Google Cloud Deployment Manager

### Advanced Features

- Infrastructure drift detection
- Cost optimization recommendations
- Security vulnerability scanning in generated Dockerfiles
- Multi-region deployment templates
- Disaster recovery configurations
- Auto-scaling policy generation

---

## Success Metrics

### Implementation Success

- ✅ All 8 "Must Pass" criteria verified
- ✅ TypeScript compilation clean
- ✅ Generated Docker Compose passes validation
- ✅ Generated Dockerfiles build successfully
- ✅ Cost estimates are reasonable and accurate

### Quality Metrics

- Generated configs follow best practices
- Security measures implemented (non-root users, minimal images)
- Cost estimates within 20% of actual costs
- Generated CI/CD pipelines deploy successfully

---

## References

### Related Tasks

- VIBE-P10-001: Architect Agent Base
- VIBE-P10-002: Architecture Template System
- VIBE-P10-003: Tech Stack Decision Tree

### External References

- Docker Compose specification: https://docs.docker.com/compose/compose-file/
- Dockerfile best practices: https://docs.docker.com/develop/develop-images/dockerfile_best-practices/
- GitHub Actions documentation: https://docs.github.com/en/actions
- Terraform documentation: https://www.terraform.io/docs
- AWS pricing: https://aws.amazon.com/pricing/

---

**End of Specification**
