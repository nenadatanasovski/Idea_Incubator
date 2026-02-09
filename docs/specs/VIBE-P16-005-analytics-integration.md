# VIBE-P16-005: Analytics Integration

**Task ID:** VIBE-P16-005
**Created:** 2026-02-09
**Updated:** 2026-02-09
**Status:** Specification Complete
**Category:** Observability - Phase 16
**Priority:** High
**Agent Type:** spec_agent
**Model:** Claude Sonnet 4.5

---

## Executive Summary

**What:** Comprehensive user analytics system for tracking user behavior, feature adoption, and product metrics.

**Why:** Enable data-driven product decisions by measuring DAU/WAU/MAU, feature usage, error rates, and user retention.

**Status:**
- ✅ **Observability analytics** (agent behavior tracking) - Already implemented and tested
- ❌ **User analytics** (page views, sessions, feature adoption) - Needs implementation
- ✅ **Specification** - Complete and ready for Build Agent

**Implementation Effort:** ~17 hours (2 days)

**Test Coverage:** Backend observability analytics has 16 passing tests. User analytics needs new test coverage.

---

## Overview

Implement comprehensive usage analytics to track user behavior patterns, feature adoption, error rates, and performance metrics across the Vibe platform (Idea Incubator + Parent Harness). The analytics system captures user interactions, agent activities, and system events, storing structured data for trend analysis, bug reporting enrichment, and data-driven product decisions.

### Context

The Vibe platform consists of two subsystems:
1. **Idea Incubator** - Idea evaluation with multi-category AI assessments
2. **Parent Harness** - Autonomous agent orchestration (12+ specialized agents)

Currently, the platform has **observability infrastructure** (agent heartbeats, session tracking, health monitoring) but lacks **user-facing analytics** to answer questions like:
- Which features are users adopting? (DAU/WAU/MAU)
- Where do errors occur most frequently?
- How do users navigate the dashboard?
- What tasks are most common? What's the success rate?
- How long do evaluation cycles take?

### Problem Statement

Without analytics:
- Product decisions are intuition-based, not data-driven
- Feature adoption is invisible (can't prioritize improvements)
- Error hotspots go undetected until users complain
- Performance regressions slip through (slow pages, API timeouts)
- Bug reports lack context (what did the user do before the crash?)
- User retention is unknown (are users coming back?)

### Solution

Create a lightweight, privacy-compliant analytics system that:
1. **Captures Events**: Track page views, feature usage, button clicks, errors
2. **Identifies Users**: Anonymized session IDs (no PII)
3. **Measures Adoption**: First use, frequency, retention by feature
4. **Detects Errors**: Error type, stack trace, user context, frequency
5. **Monitors Performance**: Page load time, API response times, client errors
6. **Enriches Bug Reports**: Auto-attach session data, recent actions, error logs
7. **Provides Dashboards**: DAU/WAU/MAU, top features, error hotspots
8. **Respects Privacy**: No PII, user opt-out, data retention policies

---

## Requirements

### Functional Requirements

#### FR-1: Event Tracking SDK
**Priority:** P0 (Critical)

MUST implement event tracking for:
- **Page Views**: Track navigation events (Dashboard → Tasks → Sessions)
- **Feature Usage**: Track interactions (create idea, spawn agent, create task)
- **Button Clicks**: Track UI actions (submit, cancel, retry, terminate)
- **Errors**: Track client-side errors (React errors, API failures, network timeouts)

**Acceptance Criteria:**
- Event SDK captures: event_type, event_name, user_id (anonymized), timestamp, properties (JSON)
- Events batched and sent to backend every 10 seconds or 50 events (whichever comes first)
- Offline queue: Store events in localStorage if backend unavailable
- Event validation: Required fields checked before sending
- TypeScript types for all event schemas

#### FR-2: User Session Tracking
**Priority:** P0 (Critical)

MUST track user sessions with:
- **Anonymized User IDs**: Generate stable session IDs (no cookies, use browser fingerprint)
- **Session Metadata**: Browser, OS, screen resolution, viewport size
- **Session Duration**: Track session start/end times
- **Page Sequence**: Track navigation path through the app
- **Feature Flags**: Track which features are enabled for the user

**Acceptance Criteria:**
- User IDs anonymized (hash of IP + user agent)
- Session IDs persist across page reloads (sessionStorage)
- No personally identifiable information (PII) collected
- Session metadata captured on first page view
- Session end detected (window close, 30min inactivity)

#### FR-3: Feature Adoption Metrics
**Priority:** P1 (High)

MUST calculate feature adoption metrics:
- **First Use**: Track timestamp of first feature interaction
- **Frequency**: Track usage count per feature per user
- **Retention**: Track N-day retention (users who return after first use)
- **Feature Segmentation**: Track usage by feature category (evaluation, orchestration, admin)

**Acceptance Criteria:**
- Metrics calculated for all major features: idea creation, idea evaluation, task creation, agent spawning, session monitoring
- First use stored in `feature_adoption` table
- Frequency calculated from event aggregation
- Retention metrics: 1-day, 7-day, 30-day retention rates
- Minimum sample size: 10 users before displaying metrics

#### FR-4: Error Tracking System
**Priority:** P0 (Critical)

MUST capture error details:
- **Error Type**: JavaScript error, API error, network error, validation error
- **Stack Trace**: Full stack trace with source maps
- **User Context**: User ID, session ID, current page, recent actions (last 10 events)
- **Frequency**: Error count, unique users affected, first seen, last seen
- **Environment**: Browser version, OS, screen size

**Acceptance Criteria:**
- React error boundary captures unhandled exceptions
- API errors captured from fetch/axios interceptors
- Network errors detected (timeout, connection refused, CORS)
- Stack traces source-mapped to original TypeScript files
- Errors stored in `analytics_errors` table
- Duplicate errors grouped (same error type + message + stack)

#### FR-5: Performance Metrics
**Priority:** P1 (High)

MUST track performance metrics:
- **Page Load Time**: Time to first byte (TTFB), DOM content loaded, fully loaded
- **API Response Times**: P50, P95, P99 latency for each endpoint
- **Client-Side Errors**: React rendering errors, hydration errors
- **Resource Loading**: Slow images, CSS, JavaScript bundles

**Acceptance Criteria:**
- Performance metrics captured using Navigation Timing API
- API response times logged for all requests
- Slow page threshold: >2 seconds triggers warning
- Slow API threshold: >500ms triggers warning
- Metrics aggregated per page/endpoint
- Performance budget alerts if thresholds exceeded

#### FR-6: Analytics Dashboard
**Priority:** P1 (High)

MUST provide analytics dashboard showing:
- **User Metrics**: DAU (Daily Active Users), WAU (Weekly), MAU (Monthly)
- **Top Features**: Most used features by event count
- **Error Hotspots**: Top errors by frequency, affected users
- **Performance Trends**: Average page load time, API response time over 7 days
- **Retention Cohorts**: User retention heatmap (Day 0, 1, 7, 30)

**Acceptance Criteria:**
- Dashboard page at `/analytics` (admin-only access)
- Charts render using Chart.js or Recharts
- Data refreshes every 60 seconds (WebSocket updates)
- Date range filter: Last 24h, 7d, 30d, All time
- Export to CSV button for all metrics
- Loading states and error handling

#### FR-7: Bug Report Enrichment
**Priority:** P0 (Critical)

MUST auto-enrich bug reports with:
- **User Session Data**: Session ID, duration, page sequence
- **Recent Actions**: Last 10 events before error
- **Error Logs**: Stack trace, console logs, network errors
- **Environment**: Browser, OS, screen size, feature flags

**Acceptance Criteria:**
- Bug report form pre-populates with analytics data
- Session replay URL attached (if session recording enabled)
- Recent actions formatted as timeline (timestamp, event, properties)
- Error logs sanitized (no sensitive data)
- Enriched data stored in `feedback_submissions.metadata` (JSON)
- Feedback API endpoint accepts analytics context

#### FR-8: Data Retention Policy
**Priority:** P1 (High)

MUST implement data retention:
- **Raw Events**: Retain for 30 days, then delete
- **Aggregated Metrics**: Retain for 1 year (daily rollups)
- **Error Logs**: Retain for 90 days
- **User Sessions**: Retain for 7 days

**Acceptance Criteria:**
- Cleanup job runs daily at midnight
- `analytics_events` table: DELETE WHERE recorded_at < NOW() - INTERVAL '30 days'
- `analytics_errors` table: DELETE WHERE first_seen < NOW() - INTERVAL '90 days'
- `analytics_aggregates` table: Retain indefinitely (compact storage)
- Manual cleanup endpoint: `POST /api/analytics/cleanup`

#### FR-9: Privacy Compliance
**Priority:** P0 (Critical)

MUST ensure privacy compliance:
- **No PII**: No names, emails, IP addresses stored
- **User Opt-Out**: Users can disable analytics (setting persists in localStorage)
- **Anonymization**: User IDs hashed, cannot reverse to real identity
- **Data Minimization**: Collect only necessary data
- **Consent Banner**: Show on first visit (GDPR/CCPA compliance)

**Acceptance Criteria:**
- No PII fields in analytics tables
- Opt-out setting: `analytics_enabled: false` in localStorage
- Consent banner component with "Accept" / "Decline" buttons
- Declined users: No events tracked, no session data collected
- Privacy policy link in footer and consent banner

#### FR-10: Export API
**Priority:** P2 (Medium)

MUST provide export API for analytics data:
- **CSV Export**: Download metrics as CSV files
- **JSON Export**: Download raw event data as JSON
- **Date Range**: Export data for specified time range
- **Format Options**: Include/exclude fields, custom delimiters

**Acceptance Criteria:**
- Export endpoint: `GET /api/analytics/export?format=csv&start=2026-01-01&end=2026-02-01&type=events`
- CSV format: Headers in first row, comma-delimited
- JSON format: Array of objects, pretty-printed
- Large exports: Stream data (don't load all into memory)
- Rate limiting: Max 10 exports per hour per user
- Export history logged to `analytics_exports` table

### Non-Functional Requirements

#### NFR-1: Performance
- Event capture: <10ms overhead per event
- Event batching: Send max 1 batch per 10 seconds
- Dashboard load: <2 seconds for 30-day metrics
- Export performance: Stream 100k events in <30 seconds
- Database queries: Use indexes for time-range filters

#### NFR-2: Reliability
- Event queue: Persist to localStorage if backend unavailable
- Retry logic: Exponential backoff for failed event sends
- Error boundary: Analytics failures don't crash the app
- Graceful degradation: App works even if analytics disabled
- Idempotent events: Duplicate sends don't create duplicate records

#### NFR-3: Scalability
- Support 1000 DAU (Daily Active Users)
- Handle 100k events per day
- Store 1M+ events (with 30-day retention)
- Aggregation queries: <1 second for 7-day windows
- Event batching: Max 50 events per batch

#### NFR-4: Security
- No sensitive data in events (sanitize before sending)
- API endpoints require authentication
- Export API: Admin-only access
- Rate limiting on event ingestion (max 1000 events/min per user)
- SQL injection protection (parameterized queries)

#### NFR-5: Maintainability
- Event schemas versioned (v1, v2, etc.)
- TypeScript types for all events
- Unit tests for event validation and aggregation logic
- Integration tests for end-to-end event flow
- Documentation for adding new event types

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Vibe Platform                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Frontend (React)                                       │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐│ │
│  │  │  Analytics SDK                                      ││ │
│  │  │  - trackPageView()                                  ││ │
│  │  │  - trackEvent()                                     ││ │
│  │  │  - trackError()                                     ││ │
│  │  │  - setUser()                                        ││ │
│  │  └────────────────────────────────────────────────────┘│ │
│  │                ▼                                         │ │
│  │  ┌────────────────────────────────────────────────────┐│ │
│  │  │  Event Queue (localStorage)                        ││ │
│  │  │  - Batch events (max 50)                           ││ │
│  │  │  - Flush every 10s                                 ││ │
│  │  │  - Retry on failure                                ││ │
│  │  └────────────────────────────────────────────────────┘│ │
│  └──────────────────────────┬───────────────────────────────┘ │
│                             │ POST /api/analytics/events     │
│                             ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Backend (Express API)                                  │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐│ │
│  │  │  Analytics Service                                  ││ │
│  │  │  - validateEvent()                                  ││ │
│  │  │  - storeEvent()                                     ││ │
│  │  │  - aggregateMetrics()                               ││ │
│  │  │  - enrichBugReport()                                ││ │
│  │  └────────────────────────────────────────────────────┘│ │
│  │                ▼                                         │ │
│  │  ┌────────────────────────────────────────────────────┐│ │
│  │  │  Database (SQLite)                                  ││ │
│  │  │  - analytics_events (30d)                          ││ │
│  │  │  - analytics_errors (90d)                          ││ │
│  │  │  - analytics_aggregates (∞)                        ││ │
│  │  │  - feature_adoption                                ││ │
│  │  │  - user_sessions (7d)                              ││ │
│  │  └────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Cleanup Job (cron)                                     │ │
│  │  - Runs daily at midnight                               │ │
│  │  - Deletes old events (>30d)                            │ │
│  │  - Aggregates daily metrics                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

#### analytics_events Table

```sql
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'page_view', 'feature_usage', 'button_click', 'error', 'api_call'
  )),
  event_name TEXT NOT NULL, -- e.g., 'dashboard_viewed', 'idea_created', 'agent_spawned'
  user_id TEXT NOT NULL, -- Anonymized hash
  session_id TEXT NOT NULL,
  properties TEXT, -- JSON: event-specific data
  page_url TEXT,
  referrer TEXT,
  recorded_at TEXT DEFAULT (datetime('now')),

  INDEX idx_events_user (user_id, recorded_at DESC),
  INDEX idx_events_type (event_type, recorded_at DESC),
  INDEX idx_events_name (event_name, recorded_at DESC),
  INDEX idx_events_session (session_id, recorded_at DESC)
);
```

#### analytics_errors Table

```sql
CREATE TABLE IF NOT EXISTS analytics_errors (
  id TEXT PRIMARY KEY,
  error_type TEXT NOT NULL CHECK(error_type IN (
    'javascript', 'api', 'network', 'validation'
  )),
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  page_url TEXT,
  user_context TEXT, -- JSON: recent actions, environment
  first_seen TEXT DEFAULT (datetime('now')),
  last_seen TEXT DEFAULT (datetime('now')),
  occurrence_count INTEGER DEFAULT 1,
  affected_users INTEGER DEFAULT 1,

  INDEX idx_errors_type (error_type, last_seen DESC),
  INDEX idx_errors_message (error_message, last_seen DESC),
  INDEX idx_errors_user (user_id, first_seen DESC)
);
```

#### analytics_aggregates Table

```sql
CREATE TABLE IF NOT EXISTS analytics_aggregates (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL CHECK(metric_type IN (
    'dau', 'wau', 'mau', 'feature_usage', 'error_rate',
    'page_load_time', 'api_response_time'
  )),
  metric_key TEXT, -- Feature name, endpoint, etc.
  time_window TEXT NOT NULL CHECK(time_window IN ('1h', '24h', '7d', '30d')),
  value REAL NOT NULL,
  sample_size INTEGER,
  recorded_at TEXT DEFAULT (datetime('now')),

  INDEX idx_aggregates_type (metric_type, time_window, recorded_at DESC),
  INDEX idx_aggregates_key (metric_key, metric_type, recorded_at DESC)
);
```

#### feature_adoption Table

```sql
CREATE TABLE IF NOT EXISTS feature_adoption (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  first_used_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT DEFAULT (datetime('now')),
  usage_count INTEGER DEFAULT 1,

  UNIQUE(user_id, feature_name),
  INDEX idx_adoption_feature (feature_name, first_used_at DESC),
  INDEX idx_adoption_user (user_id, first_used_at DESC)
);
```

#### user_sessions Table

```sql
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT,
  duration_seconds INTEGER,
  page_count INTEGER DEFAULT 1,
  event_count INTEGER DEFAULT 0,
  browser TEXT,
  os TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  feature_flags TEXT, -- JSON

  INDEX idx_sessions_user (user_id, started_at DESC),
  INDEX idx_sessions_started (started_at DESC)
);
```

### Frontend Analytics SDK

**File:** `parent-harness/dashboard/src/analytics/index.ts`

```typescript
/**
 * Analytics SDK for event tracking
 */

export interface AnalyticsConfig {
  enabled: boolean;
  batchSize: number;
  flushInterval: number; // milliseconds
  endpoint: string;
}

export interface AnalyticsEvent {
  event_type: 'page_view' | 'feature_usage' | 'button_click' | 'error' | 'api_call';
  event_name: string;
  properties?: Record<string, unknown>;
}

class AnalyticsSDK {
  private config: AnalyticsConfig;
  private queue: AnalyticsEvent[] = [];
  private userId: string;
  private sessionId: string;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enabled: this.isEnabled(),
      batchSize: 50,
      flushInterval: 10000, // 10 seconds
      endpoint: '/api/analytics/events',
      ...config,
    };

    this.userId = this.getOrCreateUserId();
    this.sessionId = this.getOrCreateSessionId();

    if (this.config.enabled) {
      this.startFlushTimer();
      this.captureSession();
    }
  }

  /**
   * Track page view
   */
  trackPageView(pageName: string): void {
    this.track({
      event_type: 'page_view',
      event_name: `page_viewed_${pageName}`,
      properties: {
        page_url: window.location.href,
        referrer: document.referrer,
      },
    });
  }

  /**
   * Track feature usage
   */
  trackEvent(eventName: string, properties?: Record<string, unknown>): void {
    this.track({
      event_type: 'feature_usage',
      event_name: eventName,
      properties,
    });
  }

  /**
   * Track button click
   */
  trackClick(buttonName: string, properties?: Record<string, unknown>): void {
    this.track({
      event_type: 'button_click',
      event_name: `button_clicked_${buttonName}`,
      properties,
    });
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, unknown>): void {
    this.track({
      event_type: 'error',
      event_name: 'error_occurred',
      properties: {
        error_message: error.message,
        stack_trace: error.stack,
        error_type: error.name,
        ...context,
      },
    });
  }

  /**
   * Set user ID (for authenticated users)
   */
  setUser(userId: string): void {
    this.userId = this.hashUserId(userId);
    localStorage.setItem('analytics_user_id', this.userId);
  }

  /**
   * Opt out of analytics
   */
  optOut(): void {
    localStorage.setItem('analytics_enabled', 'false');
    this.config.enabled = false;
    this.stopFlushTimer();
  }

  /**
   * Internal: Track event
   */
  private track(event: AnalyticsEvent): void {
    if (!this.config.enabled) return;

    const enrichedEvent = {
      ...event,
      user_id: this.userId,
      session_id: this.sessionId,
      page_url: window.location.href,
      recorded_at: new Date().toISOString(),
    };

    this.queue.push(enrichedEvent);

    // Flush if batch size reached
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush event queue to backend
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('[Analytics] Failed to send events:', error);
      // Store in localStorage for retry
      this.storeFailedEvents(events);
    }
  }

  /**
   * Store failed events to localStorage
   */
  private storeFailedEvents(events: AnalyticsEvent[]): void {
    const stored = localStorage.getItem('analytics_failed_events');
    const failedEvents = stored ? JSON.parse(stored) : [];
    failedEvents.push(...events);
    localStorage.setItem('analytics_failed_events', JSON.stringify(failedEvents));
  }

  /**
   * Get or create anonymized user ID
   */
  private getOrCreateUserId(): string {
    const stored = localStorage.getItem('analytics_user_id');
    if (stored) return stored;

    const userId = this.hashUserId(navigator.userAgent + navigator.language);
    localStorage.setItem('analytics_user_id', userId);
    return userId;
  }

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    const stored = sessionStorage.getItem('analytics_session_id');
    if (stored) return stored;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
    return sessionId;
  }

  /**
   * Hash user ID for anonymization
   */
  private hashUserId(input: string): string {
    // Simple hash (use crypto.subtle.digest in production)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash = hash & hash;
    }
    return `user_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Check if analytics enabled
   */
  private isEnabled(): boolean {
    const setting = localStorage.getItem('analytics_enabled');
    return setting !== 'false'; // Enabled by default
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Capture session metadata
   */
  private captureSession(): void {
    this.track({
      event_type: 'page_view',
      event_name: 'session_started',
      properties: {
        browser: navigator.userAgent,
        os: navigator.platform,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        language: navigator.language,
      },
    });
  }
}

// Export singleton instance
export const analytics = new AnalyticsSDK();

// React hook
export function useAnalytics() {
  return {
    trackPageView: analytics.trackPageView.bind(analytics),
    trackEvent: analytics.trackEvent.bind(analytics),
    trackClick: analytics.trackClick.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
  };
}
```

### Backend Analytics Service

**File:** `parent-harness/orchestrator/src/analytics/index.ts`

```typescript
/**
 * Analytics Service
 */

import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface AnalyticsEvent {
  event_type: 'page_view' | 'feature_usage' | 'button_click' | 'error' | 'api_call';
  event_name: string;
  user_id: string;
  session_id: string;
  properties?: Record<string, unknown>;
  page_url?: string;
  referrer?: string;
  recorded_at?: string;
}

export class AnalyticsService {
  constructor(private db: Database) {}

  /**
   * Store analytics events
   */
  async storeEvents(events: AnalyticsEvent[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO analytics_events (
        id, event_type, event_name, user_id, session_id,
        properties, page_url, referrer, recorded_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((events: AnalyticsEvent[]) => {
      for (const event of events) {
        stmt.run(
          uuidv4(),
          event.event_type,
          event.event_name,
          event.user_id,
          event.session_id,
          event.properties ? JSON.stringify(event.properties) : null,
          event.page_url || null,
          event.referrer || null,
          event.recorded_at || new Date().toISOString()
        );

        // Update feature adoption
        if (event.event_type === 'feature_usage') {
          this.updateFeatureAdoption(event.user_id, event.event_name);
        }
      }
    });

    insertMany(events);
  }

  /**
   * Update feature adoption metrics
   */
  private updateFeatureAdoption(userId: string, featureName: string): void {
    this.db.prepare(`
      INSERT INTO feature_adoption (id, user_id, feature_name, usage_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(user_id, feature_name) DO UPDATE SET
        last_used_at = datetime('now'),
        usage_count = usage_count + 1
    `).run(uuidv4(), userId, featureName);
  }

  /**
   * Get Daily Active Users (DAU)
   */
  async getDAU(date?: string): Promise<number> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const result = this.db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE DATE(recorded_at) = ?
    `).get(targetDate) as { count: number };

    return result.count;
  }

  /**
   * Get Weekly Active Users (WAU)
   */
  async getWAU(): Promise<number> {
    const result = this.db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE recorded_at >= datetime('now', '-7 days')
    `).get() as { count: number };

    return result.count;
  }

  /**
   * Get Monthly Active Users (MAU)
   */
  async getMAU(): Promise<number> {
    const result = this.db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE recorded_at >= datetime('now', '-30 days')
    `).get() as { count: number };

    return result.count;
  }

  /**
   * Get top features by usage
   */
  async getTopFeatures(limit = 10): Promise<Array<{ feature: string; count: number }>> {
    return this.db.prepare(`
      SELECT event_name as feature, COUNT(*) as count
      FROM analytics_events
      WHERE event_type = 'feature_usage'
        AND recorded_at >= datetime('now', '-7 days')
      GROUP BY event_name
      ORDER BY count DESC
      LIMIT ?
    `).all(limit) as Array<{ feature: string; count: number }>;
  }

  /**
   * Get error hotspots
   */
  async getErrorHotspots(limit = 10): Promise<Array<{
    error_message: string;
    count: number;
    affected_users: number;
  }>> {
    return this.db.prepare(`
      SELECT
        error_message,
        occurrence_count as count,
        affected_users
      FROM analytics_errors
      WHERE last_seen >= datetime('now', '-7 days')
      ORDER BY occurrence_count DESC
      LIMIT ?
    `).all(limit) as Array<{ error_message: string; count: number; affected_users: number }>;
  }

  /**
   * Enrich bug report with analytics context
   */
  async enrichBugReport(userId: string, sessionId: string): Promise<{
    recent_actions: Array<{ event_name: string; timestamp: string; properties: unknown }>;
    session_data: { browser: string; os: string; duration: number };
    error_history: Array<{ error_message: string; timestamp: string }>;
  }> {
    // Get recent actions (last 10 events)
    const recentActions = this.db.prepare(`
      SELECT event_name, recorded_at as timestamp, properties
      FROM analytics_events
      WHERE session_id = ?
      ORDER BY recorded_at DESC
      LIMIT 10
    `).all(sessionId) as Array<{ event_name: string; timestamp: string; properties: string }>;

    // Get session data
    const sessionData = this.db.prepare(`
      SELECT browser, os, duration_seconds
      FROM user_sessions
      WHERE session_id = ?
    `).get(sessionId) as { browser: string; os: string; duration_seconds: number } | undefined;

    // Get error history
    const errorHistory = this.db.prepare(`
      SELECT error_message, first_seen as timestamp
      FROM analytics_errors
      WHERE session_id = ?
      ORDER BY first_seen DESC
      LIMIT 5
    `).all(sessionId) as Array<{ error_message: string; timestamp: string }>;

    return {
      recent_actions: recentActions.map(a => ({
        ...a,
        properties: a.properties ? JSON.parse(a.properties) : null,
      })),
      session_data: sessionData ? {
        browser: sessionData.browser,
        os: sessionData.os,
        duration: sessionData.duration_seconds,
      } : { browser: 'unknown', os: 'unknown', duration: 0 },
      error_history: errorHistory,
    };
  }

  /**
   * Cleanup old events (retention policy)
   */
  async cleanup(): Promise<{ events_deleted: number; errors_deleted: number; sessions_deleted: number }> {
    // Delete events older than 30 days
    const eventsResult = this.db.prepare(`
      DELETE FROM analytics_events
      WHERE recorded_at < datetime('now', '-30 days')
    `).run();

    // Delete errors older than 90 days
    const errorsResult = this.db.prepare(`
      DELETE FROM analytics_errors
      WHERE first_seen < datetime('now', '-90 days')
    `).run();

    // Delete sessions older than 7 days
    const sessionsResult = this.db.prepare(`
      DELETE FROM user_sessions
      WHERE started_at < datetime('now', '-7 days')
    `).run();

    return {
      events_deleted: eventsResult.changes,
      errors_deleted: errorsResult.changes,
      sessions_deleted: sessionsResult.changes,
    };
  }
}
```

### API Endpoints

**File:** `parent-harness/orchestrator/src/api/analytics.ts`

```typescript
/**
 * Analytics API Endpoints
 */

import { Router } from 'express';
import { AnalyticsService } from '../analytics/index.js';
import { getDb } from '../db/index.js';

const router = Router();
const analyticsService = new AnalyticsService(getDb());

/**
 * POST /api/analytics/events
 * Store analytics events
 */
router.post('/events', async (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Events must be an array' });
    }

    // Validate events
    for (const event of events) {
      if (!event.event_type || !event.event_name || !event.user_id || !event.session_id) {
        return res.status(400).json({ error: 'Missing required event fields' });
      }
    }

    await analyticsService.storeEvents(events);

    res.json({ success: true, count: events.length });
  } catch (error) {
    console.error('[Analytics API] Error storing events:', error);
    res.status(500).json({ error: 'Failed to store events' });
  }
});

/**
 * GET /api/analytics/metrics
 * Get aggregated metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const [dau, wau, mau, topFeatures, errorHotspots] = await Promise.all([
      analyticsService.getDAU(),
      analyticsService.getWAU(),
      analyticsService.getMAU(),
      analyticsService.getTopFeatures(10),
      analyticsService.getErrorHotspots(10),
    ]);

    res.json({
      user_metrics: { dau, wau, mau },
      top_features: topFeatures,
      error_hotspots: errorHotspots,
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/analytics/enrich/:sessionId
 * Get enrichment data for bug reports
 */
router.get('/enrich/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.query.userId as string;

    const enrichment = await analyticsService.enrichBugReport(userId, sessionId);

    res.json(enrichment);
  } catch (error) {
    console.error('[Analytics API] Error enriching bug report:', error);
    res.status(500).json({ error: 'Failed to enrich bug report' });
  }
});

/**
 * POST /api/analytics/cleanup
 * Manually trigger cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    const result = await analyticsService.cleanup();

    res.json({
      success: true,
      deleted: result,
    });
  } catch (error) {
    console.error('[Analytics API] Error during cleanup:', error);
    res.status(500).json({ error: 'Failed to cleanup analytics data' });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data
 */
router.get('/export', async (req, res) => {
  try {
    const { format = 'json', type = 'events', start, end } = req.query;

    // TODO: Implement export logic with streaming
    res.status(501).json({ error: 'Export not yet implemented' });
  } catch (error) {
    console.error('[Analytics API] Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;
```

---

## Pass Criteria

### Functional Validation

| # | Criterion | Validation Method | Target |
|---|-----------|-------------------|--------|
| 1 | Event tracking SDK integrated | Frontend SDK captures page views, clicks, errors | All event types working |
| 2 | User session tracking | Session IDs generated, metadata captured | Sessions stored in DB |
| 3 | Feature adoption metrics | First use, frequency, retention calculated | Metrics accurate |
| 4 | Error tracking captures errors | React errors, API errors logged with stack traces | Errors stored in DB |
| 5 | Performance metrics tracked | Page load time, API response times measured | Metrics within thresholds |
| 6 | Analytics dashboard shows metrics | DAU/WAU/MAU, top features, error hotspots rendered | Dashboard loads <2s |
| 7 | Bug reports enriched | Session data, recent actions, error logs attached | Enrichment API works |
| 8 | Data retention policy enforced | Cleanup job deletes old events, errors, sessions | Retention enforced |
| 9 | Privacy compliance | No PII collected, user opt-out supported | Privacy requirements met |
| 10 | Export API works | CSV/JSON export for analytics data | Exports succeed |

### Performance Validation

| # | Criterion | Validation Method | Target |
|---|-----------|-------------------|--------|
| 11 | Event capture overhead | Measure event tracking latency | <10ms per event |
| 12 | Dashboard load time | Measure analytics dashboard page load | <2 seconds |
| 13 | Export performance | Stream 100k events to CSV | <30 seconds |
| 14 | Database query performance | Verify indexes used, measure query times | <1s for 7d windows |

### Security Validation

| # | Criterion | Validation Method | Target |
|---|-----------|-------------------|--------|
| 15 | No PII in database | Audit analytics tables for PII | Zero PII fields |
| 16 | User anonymization | Verify user IDs hashed, cannot reverse | IDs anonymized |
| 17 | API authentication | Test endpoints without auth | 401 Unauthorized |
| 18 | Rate limiting enforced | Send 2000 events/min, verify throttling | 429 Too Many Requests |

### Reliability Validation

| # | Criterion | Validation Method | Target |
|---|-----------|-------------------|--------|
| 19 | Offline event queue | Disconnect network, verify localStorage queue | Events queued offline |
| 20 | Retry logic | Fail event send, verify exponential backoff | Retries succeed |
| 21 | Graceful degradation | Disable analytics, verify app still works | App functional |

---

## Dependencies

### Upstream Dependencies (Must Exist First)

| Dependency | Description | Status |
|------------|-------------|--------|
| Parent Harness Dashboard | React frontend for analytics dashboard | ✅ Exists |
| Express API | Backend API for event ingestion | ✅ Exists |
| Database (SQLite) | Storage for analytics data | ✅ Exists |
| WebSocket System | Real-time dashboard updates | ✅ Exists |

### Downstream Dependencies (Enabled By This)

| Component | How It Benefits |
|-----------|----------------|
| Feedback System (VIBE-P16-006) | Bug reports enriched with analytics context |
| Product Roadmap | Data-driven feature prioritization |
| Performance Monitoring | Detect regressions, slow pages |
| User Retention Analysis | Understand why users leave |

---

## Implementation Plan

### Phase 1: Database Schema (1 hour)
1. Create migration for analytics tables
2. Add indexes for performance
3. Test migration on dev database

### Phase 2: Frontend SDK (3 hours)
4. Implement AnalyticsSDK class
5. Add event queue and batching
6. Add offline support (localStorage)
7. Create React hook (useAnalytics)
8. Add error boundary for tracking errors

### Phase 3: Backend Service (3 hours)
9. Implement AnalyticsService class
10. Add event storage, validation
11. Add metrics calculations (DAU, WAU, MAU)
12. Add bug report enrichment

### Phase 4: API Endpoints (2 hours)
13. Create analytics API router
14. Implement POST /events endpoint
15. Implement GET /metrics endpoint
16. Implement GET /enrich endpoint
17. Add rate limiting, authentication

### Phase 5: Analytics Dashboard (4 hours)
18. Create Analytics page component
19. Add metrics cards (DAU, WAU, MAU)
20. Add top features chart
21. Add error hotspots table
22. Add date range filter
23. Add CSV export button

### Phase 6: Privacy & Consent (2 hours)
24. Create consent banner component
25. Add opt-out toggle in settings
26. Implement privacy policy page
27. Add "Do Not Track" support

### Phase 7: Testing (2 hours)
28. Unit tests for SDK, service
29. Integration tests for event flow
30. Manual testing of dashboard
31. Privacy compliance audit

**Total Estimated Effort:** 17 hours (~2 days)

---

## Testing Strategy

### Unit Tests

```typescript
describe('AnalyticsSDK', () => {
  test('tracks page view event', () => {
    analytics.trackPageView('dashboard');
    expect(queue).toContainEvent({ event_type: 'page_view', event_name: 'page_viewed_dashboard' });
  });

  test('batches events before sending', async () => {
    for (let i = 0; i < 60; i++) {
      analytics.trackEvent('test_event');
    }
    // Should send 2 batches (50 + 10)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('stores failed events to localStorage', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));
    analytics.trackEvent('test_event');
    await analytics.flush();
    expect(localStorage.getItem('analytics_failed_events')).toBeTruthy();
  });
});

describe('AnalyticsService', () => {
  test('calculates DAU correctly', async () => {
    // Seed 5 events from 3 unique users today
    const dau = await analyticsService.getDAU();
    expect(dau).toBe(3);
  });

  test('enriches bug report with context', async () => {
    const enrichment = await analyticsService.enrichBugReport('user123', 'session456');
    expect(enrichment.recent_actions).toHaveLength(10);
    expect(enrichment.session_data.browser).toBeTruthy();
  });
});
```

### Integration Tests

```typescript
describe('Analytics Integration', () => {
  test('event flow: SDK → API → Database', async () => {
    // Track event
    analytics.trackEvent('test_feature_used', { feature_id: 'xyz' });
    await analytics.flush();

    // Verify stored in database
    const events = db.prepare('SELECT * FROM analytics_events WHERE event_name = ?').all('test_feature_used');
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].properties).feature_id).toBe('xyz');
  });

  test('cleanup job removes old events', async () => {
    // Insert event 31 days old
    db.prepare(`
      INSERT INTO analytics_events (id, event_type, event_name, user_id, session_id, recorded_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-31 days'))
    `).run(uuidv4(), 'page_view', 'test', 'user1', 'session1');

    await analyticsService.cleanup();

    const oldEvents = db.prepare('SELECT * FROM analytics_events WHERE recorded_at < datetime("now", "-30 days")').all();
    expect(oldEvents).toHaveLength(0);
  });
});
```

---

## Success Metrics

### Operational Metrics
- Event capture rate: >95% of user interactions
- Event delivery success: >99% (after retries)
- Dashboard load time: <2 seconds (p95)
- Data retention compliance: 100% (old data cleaned)

### Business Metrics
- DAU/WAU/MAU tracked accurately
- Feature adoption measured for top 10 features
- Error detection: 100% of client errors captured
- Bug report quality: 80% include analytics context

---

## Rollback Plan

If analytics causes issues:

1. **Disable event capture:**
   - Set `ANALYTICS_ENABLED=false` in environment
   - SDK respects setting, stops tracking
   - App continues working normally

2. **Remove analytics tables:**
   - Analytics tables are separate, safe to drop
   - No impact on core functionality

3. **Revert frontend changes:**
   - Remove AnalyticsSDK imports
   - Remove analytics hooks
   - Dashboard still functions without analytics page

---

## Future Enhancements (Out of Scope)

1. **Session Replay**: Record user sessions for debugging (rrweb integration)
2. **A/B Testing**: Experiment framework for feature testing
3. **Funnel Analysis**: Track conversion funnels (signup → activation → retention)
4. **Heatmaps**: Click heatmaps for UI optimization
5. **Real-Time Alerts**: Alert on error spike, performance degradation
6. **User Segmentation**: Cohort analysis, user personas
7. **Predictive Analytics**: Churn prediction, lifetime value

---

## Related Documentation

- **PHASE3-TASK-03**: Agent Session Tracking (session heartbeat pattern)
- **PHASE7-TASK-02**: Health Checks and Monitoring (metrics aggregation pattern)
- **VIBE-P16-010**: Feedback Loop Integration Tests (test infrastructure reference)
- **VIBE-P16-006**: User Satisfaction Metrics (surveys complement analytics)
- **STRATEGIC_PLAN.md**: Phase 6 (Dashboard & Observability requirements)

---

## Implementation Status

### ✅ Already Implemented (Observability System)

The platform already has **observability analytics endpoints** that track:
- **Tool Usage Analytics**: `/api/observability/analytics/tool-usage` (✅ Implemented + Tested)
- **Assertion Trends**: `/api/observability/analytics/assertions` (✅ Implemented + Tested)
- **Duration Statistics**: `/api/observability/analytics/durations` (✅ Implemented + Tested)
- **Error Hotspots**: `/api/observability/analytics/errors` (✅ Implemented + Tested)

These endpoints track **agent behavior** (tool usage, assertions, execution times, errors) but **NOT user behavior** (page views, feature adoption, user sessions).

**Test Coverage:** `tests/api/observability/analytics.test.ts` - 16 passing tests ✅

### 🔄 Needs Implementation (User Analytics)

This specification adds **user-facing analytics** for product metrics:
- ❌ Frontend Analytics SDK (event tracking, batching, offline queue)
- ❌ User Session Tracking (anonymized IDs, session metadata)
- ❌ Feature Adoption Metrics (first use, frequency, retention)
- ❌ Analytics Dashboard Page (DAU/WAU/MAU charts, top features)
- ❌ Bug Report Enrichment (session data, recent actions)
- ❌ Privacy Controls (consent banner, opt-out toggle)
- ❌ Database Schema (analytics_events, user_sessions, feature_adoption tables)
- ❌ Export API (CSV/JSON downloads)

### Architecture Decision

**Option A: Extend Observability System**
- Add user analytics to existing `/api/observability/analytics/*` endpoints
- Reuse observability database tables
- Add frontend SDK to track user events

**Option B: Separate Analytics System**
- Create new `/api/analytics/*` endpoints
- Separate database tables for user vs. system analytics
- Keep observability focused on agent behavior

**Recommendation:** Option A (extend observability) for simplicity and code reuse.

---

## Conclusion

This specification defines a comprehensive analytics integration for the Vibe platform. The system captures user behavior, feature adoption, errors, and performance metrics while respecting user privacy and maintaining data retention policies.

**Key Features:**
✅ Observability analytics (tool usage, assertions, durations, errors) - **ALREADY IMPLEMENTED**
❌ Event tracking SDK (page views, feature usage, clicks, errors) - **NEEDS IMPLEMENTATION**
❌ User session tracking (anonymized IDs, no PII) - **NEEDS IMPLEMENTATION**
❌ Feature adoption metrics (first use, frequency, retention) - **NEEDS IMPLEMENTATION**
❌ Performance monitoring (page load, API response times) - **NEEDS IMPLEMENTATION**
❌ Analytics dashboard (DAU/WAU/MAU, top features, error hotspots) - **NEEDS IMPLEMENTATION**
❌ Bug report enrichment (session data, recent actions, error logs) - **NEEDS IMPLEMENTATION**
❌ Data retention policy (30d events, 90d errors, 1y aggregates) - **NEEDS IMPLEMENTATION**
❌ Privacy compliance (no PII, user opt-out, anonymization) - **NEEDS IMPLEMENTATION**
❌ Export API (CSV/JSON format) - **NEEDS IMPLEMENTATION**

**Implementation Effort:** 17 hours (~2 days)
**Dependencies:** Parent Harness Dashboard ✅, Express API ✅, SQLite ✅
**Test Coverage:** Unit tests + integration tests + manual testing
**Privacy:** GDPR/CCPA compliant, no PII, user opt-out

**Status:** ✅ Specification Complete - Ready for Build Agent
**Next Steps:**
1. Create database migration for user analytics tables
2. Implement frontend Analytics SDK
3. Implement backend AnalyticsService
4. Extend `/api/observability/analytics/*` endpoints for user events
5. Create Analytics dashboard page component
6. Add privacy controls (consent banner, opt-out)
7. Write tests for new functionality

---

**Document Version:** 1.1
**Created:** 2026-02-09
**Updated:** 2026-02-09 (added implementation status)
**Author:** Spec Agent (Autonomous)
**Specification Duration:** Comprehensive analysis and design
