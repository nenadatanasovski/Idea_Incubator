# Parent Harness - Docker Deployment

This document describes how to run the Parent Harness system using Docker containers.

## Prerequisites

- Docker (version 29.0 or later)
- Docker Compose (included with modern Docker installations)
- Environment variables configured (see below)

## Quick Start

1. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

2. **Build and start services**:
   ```bash
   docker compose up -d
   ```

3. **Access the services**:
   - **API**: http://localhost:3333
   - **Dashboard**: http://localhost:3334
   - **Health Check**: http://localhost:3333/health
   - **WebSocket**: ws://localhost:3333/ws

## Services

### Orchestrator
- **Image**: Built from `orchestrator/Dockerfile`
- **Port**: 3333 (API and WebSocket)
- **Purpose**: Main orchestration engine, agent coordination, API endpoints
- **Health Check**: `http://localhost:3333/health`

### Dashboard
- **Image**: Built from `dashboard/Dockerfile`
- **Port**: 3334 (mapped from container port 3333)
- **Purpose**: Web UI for monitoring agents, tasks, and sessions
- **Technology**: React 19 + Vite + Tailwind CSS 4

## Environment Variables

Required variables (set in `.env` file):

```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_AUTH_TOKEN=sk-ant-oat01-...

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your-bot-token
```

## Data Persistence

- **Volume**: `./data:/app/data`
- **Database**: `./data/harness.db` (SQLite)
- **Database WAL files**: `./data/harness.db-shm`, `./data/harness.db-wal`

Data persists across container restarts via bind mount to `./data` directory.

## Workspace Access

The orchestrator container has read/write access to the Vibe platform source code:
- **Volume**: `../:/workspace:rw`
- **Environment**: `VIBE_WORKSPACE=/workspace`

This allows agents to read and modify code files during task execution.

## Docker Commands

### Build images
```bash
docker compose build
```

### Start services (detached)
```bash
docker compose up -d
```

### View logs
```bash
docker compose logs -f
docker compose logs -f orchestrator
docker compose logs -f dashboard
```

### Stop services
```bash
docker compose down
```

### Rebuild and restart
```bash
docker compose down
docker compose build
docker compose up -d
```

### Clean rebuild (remove volumes)
```bash
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

## Health Checks

Both services include health checks:

**Orchestrator**:
- Interval: 30s
- Timeout: 10s
- Start period: 40s (allows for migrations)
- Retries: 3
- Check: HTTP GET to `/health` endpoint

**Dashboard**:
- Interval: 30s
- Timeout: 10s
- Start period: 10s
- Retries: 3
- Check: HTTP GET to root path

View health status:
```bash
docker compose ps
```

## Troubleshooting

### Port already in use
If ports 3333 or 3334 are already in use, modify `docker-compose.yml`:
```yaml
ports:
  - "3335:3333"  # Change host port
```

### Database locked
If you see "database is locked" errors:
```bash
docker compose down
rm ./data/harness.db-shm ./data/harness.db-wal
docker compose up -d
```

### Build failures
Check build context includes all necessary files:
```bash
docker compose build --no-cache --progress=plain
```

### Missing migrations
Migrations run automatically on container startup. Check logs:
```bash
docker compose logs orchestrator | grep -i migration
```

## Production Considerations

### Security
- **Never commit** `.env` file with real API keys
- Use secrets management (Docker Swarm secrets, Kubernetes secrets)
- Configure CORS properly for production domains
- Consider adding nginx reverse proxy for SSL/TLS

### Scalability
- Current setup: Single-machine deployment
- For multi-machine: Consider PostgreSQL instead of SQLite
- For high availability: Use orchestration (Kubernetes, Docker Swarm)

### Monitoring
- Health endpoints: `/health`, `/observability/stats`
- Logs: Use centralized logging (ELK, Loki, etc.)
- Metrics: Consider adding Prometheus exporters

### Backups
Backup the database regularly:
```bash
docker compose exec orchestrator sqlite3 /app/data/harness.db ".backup /app/data/backup.db"
```

## Development vs Production

### Development (current setup)
- Source code mounted as volume
- Hot reload available for orchestrator (`npm run dev`)
- Development build for dashboard

### Production recommendations
- Remove source volume mount (security)
- Use optimized production builds
- Add nginx for reverse proxy + SSL
- Use Docker secrets for sensitive data
- Enable rate limiting on API
- Configure log rotation

## Architecture

```
┌─────────────────────────────────────┐
│  Host Machine (Linux)               │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐  │
│  │ harness-orchestrator:3333    │  │
│  │ - Express API                │  │
│  │ - WebSocket Server           │  │
│  │ - Agent Coordination         │  │
│  │ - Database Migrations        │  │
│  └──────────────────────────────┘  │
│             │                       │
│             │ (network: harness-net)│
│             │                       │
│  ┌──────────────────────────────┐  │
│  │ harness-dashboard:3333       │  │
│  │ - React SPA (built)          │  │
│  │ - Served via 'serve'         │  │
│  │ - Connects to API @ 3333     │  │
│  └──────────────────────────────┘  │
│                                     │
│  Ports:                             │
│  - 3333 → orchestrator (API/WS)    │
│  - 3334 → dashboard (UI)           │
│                                     │
│  Volumes:                           │
│  - ./data → /app/data (shared)     │
│  - ../ → /workspace (orchestrator) │
└─────────────────────────────────────┘
```

## Testing

Test the full stack:
```bash
# Start services
docker compose up -d

# Wait for health checks
sleep 30

# Test API
curl http://localhost:3333/health

# Test dashboard
curl http://localhost:3334/

# Test WebSocket (requires wscat)
wscat -c ws://localhost:3333/ws
```

## Next Steps

After successful deployment:
1. Monitor logs for errors
2. Test agent spawning and task execution
3. Verify WebSocket connections in dashboard
4. Check database migrations completed
5. Test Telegram notifications (if configured)
