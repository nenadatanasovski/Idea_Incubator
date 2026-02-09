# PHASE7-TASK-01: Docker Containerization for Parent Harness Agents

**Phase**: 7 - Deploy and Iterate
**Priority**: P0
**Estimated Effort**: Medium (2-3 hours)
**Dependencies**: Phase 2 (Frontend & API Foundation)
**Created**: February 8, 2026
**Status**: Specification Complete

---

## Overview

This specification defines the Docker containerization strategy for the Parent Harness system, enabling production deployment with container orchestration, safe agent operation in isolated environments, and reproducible builds across development and production environments.

The Parent Harness orchestrates 12+ specialized AI agents (Planning, Build, Spec, QA, Task, SIA, Research, Clarification, Human Sim, etc.) through a React dashboard and Express/WebSocket backend. Containerization provides:

- **Isolation**: Each service runs in a dedicated container with controlled dependencies
- **Reproducibility**: Consistent builds across environments (dev, staging, production)
- **Portability**: Easy deployment to VPS, cloud platforms, or local development
- **Orchestration**: Docker Compose manages multi-service coordination
- **Safety**: Database persistence through volume mounts prevents data loss

### Current State

**Existing Infrastructure**:
- ✅ `docker-compose.yml` - Defines orchestrator + dashboard services with networking
- ✅ `.dockerignore` - Excludes unnecessary files from build context
- ✅ Both services build successfully (TypeScript compiles, React builds)
- ✅ Environment variable configuration via `.env.example`

**Missing Components** (this task):
- ❌ `parent-harness/orchestrator/Dockerfile` - Orchestrator container definition
- ❌ `parent-harness/dashboard/Dockerfile` - Dashboard container definition
- ❌ Health checks in Dockerfiles
- ❌ Production optimizations (multi-stage builds)
- ❌ Docker deployment documentation

---

## Requirements

### Functional Requirements

**FR-1: Orchestrator Container**
- Build Node.js 20-based container for the orchestrator service
- Compile TypeScript to JavaScript during build
- Support better-sqlite3 native bindings in Alpine Linux
- Run database migrations on container startup
- Expose port 3333 for API and WebSocket connections
- Mount workspace volume for accessing Vibe platform source code
- Persist database through volume mount

**FR-2: Dashboard Container**
- Build React 19 dashboard with multi-stage build pattern
- Compile TypeScript and bundle assets with Vite
- Serve static files efficiently (nginx or serve)
- Expose port 3333 for HTTP traffic
- Minimize final image size (<100MB)

**FR-3: Service Orchestration**
- Dashboard depends on orchestrator (dependency order)
- Services communicate via bridge network (`harness-net`)
- Environment variables passed from `.env` file
- Volume mounts for data persistence and workspace access
- Services restart automatically unless stopped manually

**FR-4: Health and Monitoring**
- Health checks verify service availability
- Orchestrator health check: HTTP GET /health endpoint
- Dashboard health check: HTTP GET / (homepage)
- Failed health checks trigger container restart
- Logs accessible via `docker-compose logs`

### Non-Functional Requirements

**NFR-1: Performance**
- Dashboard build completes in <60 seconds
- Orchestrator build completes in <90 seconds
- Container startup time <10 seconds (excluding migrations)
- Image sizes: Orchestrator <200MB, Dashboard <50MB

**NFR-2: Security**
- No secrets baked into images (use environment variables)
- `.dockerignore` prevents `.env` files from entering build context
- Containers run as non-root users where possible
- Volume mounts use read-write only where necessary

**NFR-3: Maintainability**
- Dockerfiles use multi-stage builds for clarity
- Comments explain non-obvious configurations
- Consistent base image across services (node:20-alpine)
- Version pinning for production stability

**NFR-4: Developer Experience**
- `docker-compose up` starts full system
- `docker-compose logs -f` provides real-time log streaming
- Volume mounts enable hot-reload for development (future enhancement)
- Clear error messages when containers fail to start

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Compose Stack                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────┐      ┌────────────────────┐   │
│  │   Dashboard         │      │   Orchestrator     │   │
│  │   (Frontend)        │─────▶│   (Backend)        │   │
│  │                     │      │                    │   │
│  │  - React 19         │      │  - Express API     │   │
│  │  - Vite build       │      │  - WebSocket       │   │
│  │  - Static serve     │      │  - Agent spawner   │   │
│  │  - Port 3333        │      │  - SQLite DB       │   │
│  └─────────────────────┘      └────────────────────┘   │
│         │                              │                 │
│         │                              │                 │
│         ├──────────────────────────────┤                │
│                   Network                                │
│              harness-net (bridge)                        │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Volume Mounts                       │   │
│  │  - ./data → /app/data (database persistence)    │   │
│  │  - ../ → /workspace (Vibe platform source)      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Orchestrator Dockerfile

**File**: `parent-harness/orchestrator/Dockerfile`

**Multi-Stage Build Strategy**:

**Stage 1: Builder**
- Base: `node:20-alpine`
- Install build dependencies: `python3`, `make`, `g++` (for better-sqlite3)
- Copy `package*.json` and install all dependencies with `npm ci`
- Copy source code
- Compile TypeScript with `npm run build`

**Stage 2: Production**
- Base: `node:20-alpine`
- Install runtime dependencies for better-sqlite3
- Copy `package*.json` and install production-only dependencies
- Copy compiled JavaScript from builder stage
- Create `/app/data` directory for database
- Set working directory to `/app`
- Expose port 3333
- Add health check (HTTP GET localhost:3333/health every 30s)
- Start command: Run migrations then start server

**Key Considerations**:
- **better-sqlite3**: Requires native compilation, needs `python3 make g++` in builder
- **Database migrations**: Run automatically on startup via `npm run migrate`
- **Volume mount**: `/app/data` directory mounted for SQLite persistence
- **Workspace access**: Parent directory mounted at `/workspace` for Vibe source access
- **Environment variables**: `DATABASE_PATH`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `VIBE_WORKSPACE`

#### 2. Dashboard Dockerfile

**File**: `parent-harness/dashboard/Dockerfile`

**Multi-Stage Build Strategy**:

**Stage 1: Builder**
- Base: `node:20-alpine`
- Copy `package*.json` and install all dependencies with `npm ci`
- Copy source code
- Build production bundle with `npm run build` (Vite)
- Output: `/app/dist` directory with static assets

**Stage 2: Production**
- Base: `node:20-alpine` (lightweight alternative to nginx)
- Install `serve` globally for static file serving
- Copy built assets from builder stage
- Expose port 3333
- Add health check (HTTP GET localhost:3333/ every 30s)
- Start command: `serve -s dist -l 3333`

**Rationale for `serve` over nginx**:
- Simpler configuration (no nginx.conf needed)
- Smaller final image size (Node alpine vs nginx)
- Consistent with orchestrator (both Node-based)
- SPA routing support with `-s` flag

**Alternative nginx approach** (commented in spec for future reference):
```dockerfile
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 3333
```

#### 3. Docker Compose Configuration

**File**: `parent-harness/docker-compose.yml` (already exists)

**Key Configuration**:

```yaml
version: '3.8'

services:
  orchestrator:
    build:
      context: .
      dockerfile: orchestrator/Dockerfile
    container_name: harness-orchestrator
    volumes:
      - ./data:/app/data              # Database persistence
      - ../:/workspace:rw             # Vibe platform source
    environment:
      - VIBE_WORKSPACE=/workspace
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - DATABASE_PATH=/app/data/harness.db
    depends_on:
      - dashboard
    restart: unless-stopped
    networks:
      - harness-net

  dashboard:
    build:
      context: .
      dockerfile: dashboard/Dockerfile
    container_name: harness-dashboard
    ports:
      - "3333:3333"                   # Expose to host
    volumes:
      - ./data:/app/data              # Shared data access
    environment:
      - DATABASE_PATH=/app/data/harness.db
      - NODE_ENV=production
    restart: unless-stopped
    networks:
      - harness-net

networks:
  harness-net:
    driver: bridge
```

**Design Decisions**:
- **Build context**: Parent directory (`.`) allows access to both `orchestrator/` and `dashboard/`
- **Volume strategy**: Named volume for data, bind mount for workspace
- **Networking**: Bridge network allows service-to-service communication
- **Restart policy**: `unless-stopped` ensures resilience
- **Port mapping**: Only dashboard exposes port 3333 to host (acts as gateway)

#### 4. .dockerignore

**File**: `parent-harness/.dockerignore` (already exists)

**Contents**:
```
# Node modules
**/node_modules
**/npm-debug.log
**/package-lock.json

# Build outputs
**/dist
**/.tsbuildinfo

# Development files
**/.env
**/.env.local
**/.env.*.local

# Version control
**/.git
**/.gitignore

# IDE
**/.vscode
**/.idea
**/*.swp
**/*.swo

# Test files
**/tests
**/*.test.ts
**/*.spec.ts
**/coverage

# Documentation
**/README.md
**/CLAUDE.md
**/docs

# OS files
**/.DS_Store
**/Thumbs.db

# Database files (will be in mounted volume)
**/data/*.db
**/data/*.db-shm
**/data/*.db-wal

# Temporary files
**/tmp
**/*.tmp
**/*.log
```

**Purpose**: Reduces build context size (faster builds), prevents secrets from entering images.

### Environment Variables

**Required Variables** (defined in `.env` file):

| Variable | Description | Example | Used By |
|----------|-------------|---------|---------|
| `ANTHROPIC_API_KEY` | Claude API key for agent execution | `sk-ant-...` | Orchestrator |
| `TELEGRAM_BOT_TOKEN` | Telegram bot for notifications | `123456:ABC...` | Orchestrator |
| `DATABASE_PATH` | SQLite database file path | `/app/data/harness.db` | Both |
| `VIBE_WORKSPACE` | Path to Vibe platform source | `/workspace` | Orchestrator |
| `NODE_ENV` | Node environment | `production` | Dashboard |

**Optional Variables**:

| Variable | Description | Default |
|----------|-------------|---------|
| `DASHBOARD_PORT` | Dashboard HTTP port | `3333` |
| `HARNESS_EVENT_SYSTEM` | Enable event-driven architecture | `false` |

### Build Process

**Build Command**:
```bash
docker-compose build
```

**Build Flow**:
1. Docker reads `docker-compose.yml`
2. For each service:
   - Sets build context to `parent-harness/`
   - Reads Dockerfile from specified path
   - Excludes files matching `.dockerignore`
   - Executes multi-stage build
   - Tags image as `parent-harness_orchestrator:latest` or `parent-harness_dashboard:latest`
3. Images stored in local Docker registry

**Optimization**: Layer caching
- `COPY package*.json` before `COPY .` enables dependency caching
- Dependencies only reinstall when `package.json` changes
- Source code changes don't invalidate dependency layer

### Runtime Process

**Start Command**:
```bash
docker-compose up -d
```

**Startup Sequence**:
1. Docker Compose creates network `harness-net`
2. Starts `dashboard` service:
   - Runs health check (HTTP GET /)
   - Serves static files on port 3333
3. Starts `orchestrator` service (depends on dashboard):
   - Runs database migrations (`npm run migrate`)
   - Starts Express server on port 3333 (internal)
   - Begins health checks (HTTP GET /health)
   - Connects to WebSocket clients
4. Both containers report healthy status
5. System ready for agent orchestration

**Stop Command**:
```bash
docker-compose down
```

**Shutdown Sequence**:
1. Sends SIGTERM to containers
2. Graceful shutdown (30s timeout)
3. Removes containers (preserves volumes)
4. Network `harness-net` removed

### Data Persistence

**Volume Mounts**:

1. **Database Volume**: `./data:/app/data`
   - **Type**: Bind mount (host directory)
   - **Purpose**: SQLite database persistence
   - **Files**: `harness.db`, `harness.db-shm`, `harness.db-wal`
   - **Lifecycle**: Persists across container restarts/rebuilds

2. **Workspace Volume**: `../:/workspace:rw`
   - **Type**: Bind mount (parent directory)
   - **Purpose**: Agent access to Vibe platform source code
   - **Permissions**: Read-write (agents modify code)
   - **Lifecycle**: Live link to host filesystem

**Database Migration Strategy**:
- Migrations run automatically on orchestrator startup
- Migration files: `parent-harness/orchestrator/database/migrations/*.sql`
- Migration tracking: `schema_migrations` table in SQLite
- Idempotent: Safe to run multiple times

### Health Checks

**Orchestrator Health Check**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })" || exit 1
```

- **Interval**: Check every 30 seconds
- **Timeout**: Fail if no response in 10 seconds
- **Start period**: Allow 40 seconds for startup (migrations)
- **Retries**: Mark unhealthy after 3 consecutive failures
- **Endpoint**: `GET /health` returns `{ status: 'ok', timestamp: ISO }`

**Dashboard Health Check**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/ || exit 1
```

- **Interval**: Check every 30 seconds
- **Timeout**: Fail if no response in 10 seconds
- **Start period**: Allow 10 seconds for startup
- **Retries**: Mark unhealthy after 3 consecutive failures
- **Endpoint**: `GET /` serves React app

### Logging

**Log Access**:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f orchestrator
docker-compose logs -f dashboard

# Last 100 lines
docker-compose logs --tail=100 orchestrator
```

**Log Format**:
- Orchestrator: Express request logs + agent execution logs
- Dashboard: `serve` access logs
- Both: Stdout/stderr captured by Docker

**Log Persistence** (future enhancement):
- Consider JSON logging for structured logs
- Integrate with log aggregation (ELK, Loki, CloudWatch)

---

## Implementation Plan

### Phase 1: Create Dockerfiles (1 hour)

**Task 1.1**: Implement Orchestrator Dockerfile
- Create `parent-harness/orchestrator/Dockerfile`
- Multi-stage build: builder + production
- Install better-sqlite3 build dependencies
- Add health check
- Test local build: `docker build -t test-orchestrator -f orchestrator/Dockerfile .`

**Task 1.2**: Implement Dashboard Dockerfile
- Create `parent-harness/dashboard/Dockerfile`
- Multi-stage build: builder + serve
- Add health check
- Test local build: `docker build -t test-dashboard -f dashboard/Dockerfile .`

### Phase 2: Integration Testing (45 minutes)

**Task 2.1**: Build with Docker Compose
```bash
cd parent-harness
docker-compose build
```
- Verify both images build without errors
- Check image sizes (orchestrator <200MB, dashboard <50MB)

**Task 2.2**: Test Startup
```bash
docker-compose up
```
- Verify database migrations run successfully
- Verify dashboard serves on http://localhost:3333
- Check health checks pass
- Verify WebSocket connection works

**Task 2.3**: Test Data Persistence
```bash
# Create some data
# Stop containers
docker-compose down

# Restart
docker-compose up -d

# Verify data still exists
```

**Task 2.4**: Test Environment Variables
- Verify `ANTHROPIC_API_KEY` accessible in orchestrator
- Verify `VIBE_WORKSPACE` mount works
- Test agent spawning with workspace access

### Phase 3: Documentation (30 minutes)

**Task 3.1**: Update README.md
- Add Docker deployment section
- Document environment variable setup
- Explain volume mount strategy
- Provide troubleshooting guide

**Task 3.2**: Create Docker Quick Start
- Copy `.env.example` to `.env`
- Fill in required values
- Run `docker-compose up -d`
- Access dashboard at http://localhost:3333

---

## Pass Criteria

### Functional Criteria

**FC-1: Dockerfiles Exist**
- ✅ `parent-harness/orchestrator/Dockerfile` created
- ✅ `parent-harness/dashboard/Dockerfile` created
- ✅ Both files use multi-stage builds
- ✅ Health checks defined in both

**FC-2: Build Success**
- ✅ `docker-compose build` completes without errors
- ✅ Orchestrator image size ≤ 200MB
- ✅ Dashboard image size ≤ 50MB
- ✅ Build time: Orchestrator ≤ 90s, Dashboard ≤ 60s

**FC-3: Service Startup**
- ✅ `docker-compose up -d` starts both containers
- ✅ Orchestrator container reaches healthy status within 60s
- ✅ Dashboard container reaches healthy status within 20s
- ✅ No error messages in startup logs

**FC-4: Database Operations**
- ✅ Database migrations run successfully on first startup
- ✅ SQLite file created at `./data/harness.db`
- ✅ Database persists after `docker-compose down && docker-compose up`
- ✅ No database lock errors during concurrent access

**FC-5: API Accessibility**
- ✅ Dashboard accessible at http://localhost:3333
- ✅ React app loads without errors
- ✅ WebSocket connection established (check browser console)
- ✅ API endpoints respond (e.g., `/api/agents`, `/api/tasks`)

**FC-6: Environment Variables**
- ✅ `ANTHROPIC_API_KEY` accessible in orchestrator
- ✅ `TELEGRAM_BOT_TOKEN` accessible in orchestrator
- ✅ `VIBE_WORKSPACE` points to correct path
- ✅ No hardcoded secrets in images

**FC-7: Volume Mounts**
- ✅ `./data` volume mounted and writable
- ✅ `../` workspace volume mounted and accessible
- ✅ Agents can read Vibe platform source files
- ✅ Data persists across container restarts

**FC-8: Health Checks**
- ✅ Orchestrator health check passes (`/health` returns 200)
- ✅ Dashboard health check passes (homepage loads)
- ✅ Unhealthy containers restart automatically
- ✅ `docker ps` shows "healthy" status for both

### Non-Functional Criteria

**NFC-1: Performance**
- ✅ Container startup time <10s (excluding migrations)
- ✅ No significant performance degradation vs native
- ✅ WebSocket latency <100ms

**NFC-2: Security**
- ✅ No `.env` files in images (verify with `docker history`)
- ✅ `.dockerignore` prevents sensitive files from build context
- ✅ Container runs with least privilege

**NFC-3: Maintainability**
- ✅ Dockerfiles have clear comments
- ✅ Consistent base images (node:20-alpine)
- ✅ Explicit version pinning for production stability

**NFC-4: Documentation**
- ✅ README.md updated with Docker instructions
- ✅ Environment variable documentation complete
- ✅ Troubleshooting section added
- ✅ Quick start guide provided

### Validation Tests

**Test Suite 1: Build Validation**
```bash
# Clean build
docker-compose build --no-cache

# Verify images created
docker images | grep parent-harness

# Check image sizes
docker images parent-harness_orchestrator --format "{{.Size}}"
docker images parent-harness_dashboard --format "{{.Size}}"
```

**Test Suite 2: Runtime Validation**
```bash
# Start services
docker-compose up -d

# Wait for health checks
sleep 30

# Verify health status
docker ps --filter "name=harness" --format "table {{.Names}}\t{{.Status}}"

# Test dashboard
curl http://localhost:3333

# Test orchestrator health
docker exec harness-orchestrator curl http://localhost:3333/health

# Check logs for errors
docker-compose logs | grep -i error
```

**Test Suite 3: Persistence Validation**
```bash
# Create test data via API
curl -X POST http://localhost:3333/api/tasks -d '{"title":"Test Task"}'

# Stop containers
docker-compose down

# Restart
docker-compose up -d

# Verify data persists
curl http://localhost:3333/api/tasks | grep "Test Task"
```

**Test Suite 4: Environment Validation**
```bash
# Verify environment variables
docker exec harness-orchestrator env | grep ANTHROPIC_API_KEY
docker exec harness-orchestrator env | grep VIBE_WORKSPACE

# Verify workspace mount
docker exec harness-orchestrator ls -la /workspace

# Verify database path
docker exec harness-orchestrator ls -la /app/data/harness.db
```

---

## Dependencies

### External Dependencies

**Docker**:
- Docker Engine 20.10+ or Docker Desktop
- Docker Compose 2.0+
- Platform: Linux, macOS, Windows (WSL2)

**Base Images**:
- `node:20-alpine` - Node.js 20 LTS on Alpine Linux
- Alternative: `nginx:alpine` (if switching dashboard to nginx)

**Build Dependencies** (in containers):
- `python3`, `make`, `g++` - Required for better-sqlite3 compilation
- `npm` - Package management
- `serve` - Static file serving for dashboard

### Internal Dependencies

**Existing Infrastructure**:
- ✅ `docker-compose.yml` - Already configured
- ✅ `.dockerignore` - Already created
- ✅ `.env.example` - Template for environment variables
- ✅ Database migrations - Already implemented
- ✅ Health endpoint - Already exists (`/health`)

**Codebase Requirements**:
- ✅ TypeScript compilation: `npm run build` succeeds
- ✅ React build: `npm run build` produces `/dist` folder
- ✅ Test suites pass: 1773 tests passing
- ✅ No critical bugs blocking containerization

### Phase Dependencies

**Must Complete Before**:
- Phase 2: Frontend & API Foundation (already complete)
- Database schema finalized (already complete)
- Express server with health endpoint (already complete)

**Enables**:
- Production deployment to VPS
- Multi-environment testing (dev, staging, prod)
- CI/CD pipeline integration
- Horizontal scaling (future)

---

## Risk Assessment

### Technical Risks

**Risk 1: better-sqlite3 Native Bindings**
- **Likelihood**: Medium
- **Impact**: High (orchestrator won't start)
- **Mitigation**: Install build dependencies (`python3 make g++`) in Alpine, test native module loading
- **Contingency**: Switch to Debian-based image if Alpine incompatible

**Risk 2: Database Lock Conflicts**
- **Likelihood**: Low
- **Impact**: Medium (concurrent access errors)
- **Mitigation**: SQLite WAL mode (already configured), proper connection pooling
- **Contingency**: Document lock error handling, add retry logic

**Risk 3: Volume Mount Permissions**
- **Likelihood**: Low
- **Impact**: Medium (agents can't write to workspace)
- **Mitigation**: Test write permissions, document user/group mapping
- **Contingency**: Use Docker volume ownership flags (`--user` flag)

**Risk 4: Health Check False Positives**
- **Likelihood**: Low
- **Impact**: Low (unnecessary restarts)
- **Mitigation**: Conservative thresholds (3 retries, 30s interval, 40s start period)
- **Contingency**: Adjust health check parameters based on monitoring

### Operational Risks

**Risk 5: Secrets Exposure**
- **Likelihood**: Medium (developer error)
- **Impact**: Critical (API keys leaked)
- **Mitigation**: `.dockerignore` prevents `.env` inclusion, documentation emphasizes this
- **Contingency**: Image scanning, never push images with secrets to public registries

**Risk 6: Resource Exhaustion**
- **Likelihood**: Low
- **Impact**: Medium (system slowdown)
- **Mitigation**: Monitor resource usage, add resource limits in docker-compose (future)
- **Contingency**: Document resource tuning, add `mem_limit` and `cpus`

---

## Future Enhancements

### Short-term (Phase 8)

**Production Hardening**:
- Add resource limits (CPU, memory) to docker-compose.yml
- Implement log rotation and structured logging
- Add Prometheus metrics endpoint
- Configure Docker logging drivers (json-file with rotation)

**Development Experience**:
- Create `docker-compose.dev.yml` for hot-reload development
- Add VS Code devcontainer configuration
- Document debugging containers with `docker exec`

### Long-term (Post-v1.0)

**Orchestration**:
- Kubernetes manifests for production deployment
- Helm charts for configurable deployments
- Horizontal scaling for orchestrator (multiple replicas)

**CI/CD**:
- GitHub Actions workflow for automated Docker builds
- Push images to container registry (Docker Hub, GHCR, ECR)
- Automated security scanning (Trivy, Snyk)

**Observability**:
- Integrate with log aggregation (ELK stack, Loki)
- Add distributed tracing (OpenTelemetry)
- Centralized metrics dashboard (Grafana)

**Security**:
- Non-root user execution
- Image signing and verification
- Runtime security scanning (Falco)
- Secrets management (Docker secrets, Vault)

---

## Appendix A: Dockerfile Templates

### Orchestrator Dockerfile (Full Implementation)

```dockerfile
# Parent Harness Orchestrator - Production Dockerfile
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY orchestrator/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY orchestrator/ ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY orchestrator/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Copy database migrations
COPY orchestrator/database ./database

# Create data directory
RUN mkdir -p /app/data

# Expose API port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })" || exit 1

# Run migrations and start server
CMD ["sh", "-c", "npm run migrate && npm start"]
```

### Dashboard Dockerfile (Full Implementation)

```dockerfile
# Parent Harness Dashboard - Production Dockerfile
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY dashboard/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY dashboard/ ./

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install serve to run the static files
RUN npm install -g serve

# Set working directory
WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/ || exit 1

# Serve the application
CMD ["serve", "-s", "dist", "-l", "3333"]
```

---

## Appendix B: Troubleshooting Guide

### Common Issues

**Issue 1: "Error: Cannot find module 'better-sqlite3'"**
- **Cause**: Native module not compiled for Alpine Linux
- **Solution**: Ensure `python3 make g++` installed in production stage
- **Verification**: `docker exec harness-orchestrator ldd /app/node_modules/better-sqlite3/build/Release/better_sqlite3.node`

**Issue 2: "database is locked"**
- **Cause**: Multiple processes accessing SQLite without WAL mode
- **Solution**: Verify WAL mode enabled in database connection
- **Verification**: `docker exec harness-orchestrator sqlite3 /app/data/harness.db "PRAGMA journal_mode;"`

**Issue 3: Dashboard returns 404 for routes**
- **Cause**: SPA routing not configured in serve
- **Solution**: Verify `-s` flag used: `serve -s dist -l 3333`
- **Verification**: Navigate to http://localhost:3333/tasks (should load, not 404)

**Issue 4: "Permission denied" on volume mount**
- **Cause**: User/group mismatch between host and container
- **Solution**: Check file ownership in `./data`, adjust container user if needed
- **Verification**: `ls -la parent-harness/data/` (should be writable)

**Issue 5: Container marked "unhealthy"**
- **Cause**: Health check failing (service not responding)
- **Solution**: Check logs (`docker-compose logs orchestrator`), verify service started
- **Verification**: `docker exec harness-orchestrator curl http://localhost:3333/health`

**Issue 6: "No such file or directory: /workspace"**
- **Cause**: Workspace volume not mounted or incorrect path
- **Solution**: Verify `../:/workspace` in docker-compose.yml, check relative path
- **Verification**: `docker exec harness-orchestrator ls -la /workspace`

---

## Appendix C: Quick Reference

### Essential Commands

```bash
# Build images
docker-compose build

# Build without cache
docker-compose build --no-cache

# Start services (detached)
docker-compose up -d

# Start services (foreground with logs)
docker-compose up

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f orchestrator

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Check service health
docker ps --filter "name=harness"

# Execute command in container
docker exec harness-orchestrator <command>

# Shell access
docker exec -it harness-orchestrator sh

# Restart single service
docker-compose restart orchestrator

# View resource usage
docker stats
```

### File Locations

```
parent-harness/
├── docker-compose.yml          # Service orchestration
├── .dockerignore               # Build exclusions
├── .env.example                # Environment template
├── orchestrator/
│   ├── Dockerfile              # Orchestrator container (TO CREATE)
│   ├── package.json
│   ├── src/
│   └── database/migrations/
└── dashboard/
    ├── Dockerfile              # Dashboard container (TO CREATE)
    ├── package.json
    └── src/
```

---

**Specification Complete**
**Ready for Implementation**: ✅
**Assigned To**: Build Agent
**Estimated Time**: 2-3 hours
