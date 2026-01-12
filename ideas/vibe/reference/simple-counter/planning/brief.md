---
id: simple-counter
title: API Call Counter
complexity: simple
creator: system
created: 2026-01-10
updated: 2026-01-10
---

# Brief: API Call Counter

## Problem

The Vibe platform needs to track API usage for monitoring and billing purposes. Currently there is no way to know:
- How many API calls each user makes
- Which endpoints are most frequently used
- When usage spikes occur

Without this data, we cannot:
- Implement usage-based billing
- Identify performance bottlenecks
- Detect abuse patterns

## Solution

Implement a lightweight API call counter that:
1. Records every API call with timestamp and endpoint
2. Provides aggregated statistics via API
3. Supports filtering by user, endpoint, and time range

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Middleware │────▶│   Handler   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  api_calls  │
                   │   (table)   │
                   └─────────────┘
```

### Database Schema

Single table:
```sql
CREATE TABLE api_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_calls_user ON api_calls(user_id);
CREATE INDEX idx_api_calls_endpoint ON api_calls(endpoint);
CREATE INDEX idx_api_calls_created ON api_calls(created_at);
```

## MVP Scope

### In Scope

1. **Middleware** (`server/middleware/api-counter.ts`)
   - Intercepts all API requests
   - Records call details to database
   - Non-blocking (fire-and-forget)

2. **API Endpoints**
   - `GET /api/stats/calls` - Get call counts with filters
   - `GET /api/stats/summary` - Get aggregated statistics

3. **Database Migration**
   - Create `api_calls` table

### Out of Scope

- Real-time streaming of call data
- Historical data retention policies
- Rate limiting based on call counts
- Dashboard UI components
- Export functionality

### Success Criteria

- [ ] Every API call is recorded in database
- [ ] Statistics endpoint returns accurate counts
- [ ] Response time overhead < 5ms per request
- [ ] No impact on API functionality if counter fails

### Estimated Effort

- Database migration: 15 minutes
- Middleware: 1 hour
- API endpoints: 1 hour
- Testing: 30 minutes

**Total: ~3 hours**
