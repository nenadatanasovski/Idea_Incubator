# Orchestrator Stability Layer

## Overview

The stability layer provides crash resilience, logging, and self-healing capabilities for the orchestrator.

## Components

### 1. Crash Protection (`src/stability/index.ts`)

- **Error Handlers**: Catches uncaught exceptions and unhandled promise rejections
- **Crash Logging**: Persists all crashes to `~/.harness/crash.log` with full context
- **State Persistence**: Tracks uptime, tick count, and crash history
- **Self-Monitoring**: Detects if orchestrator is stuck (no ticks for 5+ minutes)
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT

### 2. PM2 Process Manager (`ecosystem.config.cjs`)

- **Auto-Restart**: Restarts on crash with exponential backoff
- **Memory Limits**: Restarts if memory exceeds 1GB
- **Log Rotation**: Separate error and output logs
- **Graceful Shutdown**: 10 second timeout for cleanup

### 3. Stability API (`src/api/stability.ts`)

```
GET /api/stability         - Current stability stats
GET /api/stability/crashes - Recent crash history
GET /api/stability/health  - Health check with issues
```

## Usage

### Development Mode

```bash
cd parent-harness/orchestrator
npm run build
node dist/server.js
```

### Production Mode

```bash
./scripts/start-production.sh
# or
pm2 start ecosystem.config.cjs
```

### Monitoring

```bash
# View logs
pm2 logs orchestrator

# Real-time monitor
pm2 monit

# Check stability API
curl http://localhost:3333/api/stability/health
```

## Files

| Path                                 | Purpose                                   |
| ------------------------------------ | ----------------------------------------- |
| `~/.harness/stability.json`          | Runtime state (deleted on clean shutdown) |
| `~/.harness/crash.log`               | Crash history (JSON lines)                |
| `~/.harness/logs/orchestrator-*.log` | PM2 logs                                  |

## Self-Healing Behavior

1. **On Crash**: Error logged, crash count incremented, process continues
2. **On Stuck**: Self-monitor detects no ticks, logs warning, forces GC
3. **On Restart**: Detects if previous instance crashed, logs recovery
4. **On Memory Pressure**: PM2 restarts if heap exceeds 1GB

## API Response Examples

### GET /api/stability

```json
{
  "startedAt": "2026-02-07T01:30:00.000Z",
  "lastHeartbeat": "2026-02-07T01:35:00.000Z",
  "tickCount": 10,
  "crashCount": 0,
  "lastCrashAt": null,
  "lastCrashReason": null,
  "pid": 12345,
  "uptime": "0h 5m",
  "uptimeMs": 300000,
  "memoryUsage": {
    "heapUsed": 50000000,
    "heapTotal": 100000000
  }
}
```

### GET /api/stability/health

```json
{
  "status": "healthy",
  "issues": [],
  "tickCount": 10,
  "crashCount": 0,
  "memory": "47/95MB (49.5%)",
  "uptime": "2026-02-07T01:30:00.000Z"
}
```

## Crash Log Format

Each line in `~/.harness/crash.log` is a JSON object:

```json
{
  "timestamp": "2026-02-07T01:30:00.000Z",
  "reason": "Uncaught exception: Cannot read property 'x' of undefined",
  "context": {
    "name": "TypeError",
    "message": "Cannot read property 'x' of undefined",
    "stack": "..."
  },
  "pid": 12345,
  "nodeVersion": "v22.22.0",
  "memory": { "heapUsed": 50000000 },
  "uptime": 300
}
```
