# Loop 3: Polish - Overview

**Purpose:** Quality infrastructure: Analytics → E2E Tests → Mobile
**Priority:** MEDIUM (improves quality, not blocking)
**Estimated Duration:** 3-4 weeks
**Review Frequency:** Weekly

---

## Stream Overview

This loop builds quality and observability infrastructure.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Phase 1: Error  │────▶│ Phase 2: E2E    │────▶│ Phase 3: Mobile │
│ Monitoring      │     │ Testing         │     │ & PWA           │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     1 week                 1-2 weeks              1 week
```

---

## Phase 1: Error Monitoring & Analytics

**Status:** NOT STARTED
**Priority:** HIGH (needed for production debugging)

### Current State Analysis

**What Exists:**
- Basic console logging
- Cost tracking for API calls
- Event logging for evaluations

**What's Missing:**
- Error tracking (Sentry)
- User analytics (Mixpanel/Amplitude/PostHog)
- Performance monitoring
- Funnel tracking
- Session recording

### Gap Analysis

#### Error Monitoring (Sentry)

| Component | Status | Purpose |
|-----------|--------|---------|
| Sentry SDK integration | MISSING | Capture errors |
| Source maps upload | MISSING | Readable stack traces |
| Error boundary | MISSING | React error handling |
| Backend error capture | MISSING | API error tracking |
| Release tracking | MISSING | Version correlation |

**Implementation Steps:**
```typescript
// 1. Install: npm install @sentry/react @sentry/node
// 2. Frontend init (main.tsx)
Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// 3. Backend init (api.ts)
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

#### User Analytics

| Component | Status | Purpose |
|-----------|--------|---------|
| Event tracking service | MISSING | Track user actions |
| Funnel definitions | MISSING | Conversion tracking |
| User identification | MISSING | Link sessions to users |
| Dashboard setup | MISSING | Visualization |

**Key Events to Track:**
| Event | Properties | Purpose |
|-------|------------|---------|
| `page_view` | path, referrer | Navigation |
| `ideation_started` | mode, source | Entry point |
| `ideation_message_sent` | phase, messageCount | Engagement |
| `idea_captured` | ideaType, viabilityScore | Conversion |
| `build_started` | ideaSlug | Deep engagement |
| `build_completed` | iterationCount, duration | Success |
| `credit_purchased` | amount, package | Revenue |

#### Database (Gaps)

| Table | Status | Purpose |
|-------|--------|---------|
| `analytics_events` | MISSING | Event log (optional, use external) |
| `error_log` | MISSING | Error history |

#### Backend Logic (Gaps)

| Component | Status | Purpose |
|-----------|--------|---------|
| `utils/analytics.ts` | MISSING | Analytics wrapper |
| `utils/error-tracker.ts` | MISSING | Error handling |
| `server/middleware/error-handler.ts` | MISSING | Global error handler |

#### Frontend (Gaps)

| Component | Status | Purpose |
|-----------|--------|---------|
| `utils/analytics.ts` | MISSING | Frontend analytics |
| `components/ErrorBoundary.tsx` | MISSING | Error boundary |
| `hooks/useAnalytics.ts` | MISSING | Analytics hook |

### Key Deliverables
1. Sentry error tracking (frontend + backend)
2. Basic event tracking setup
3. Error boundary component
4. Key event definitions

---

## Phase 2: E2E Testing Infrastructure

**Status:** PARTIAL (Ralph loop exists, needs expansion)
**Priority:** MEDIUM

### Current State Analysis

**What Exists:**
- Ralph loop infrastructure (Python + Claude SDK)
- UFS test suite (75 tests)
- Security hooks for safe bash execution
- Transcript logging

**What's Missing:**
- Ideation journey tests (full flow)
- API integration tests
- Frontend component tests
- Performance tests
- CI/CD integration

### Gap Analysis

#### Test Coverage Needed

| Test Type | Status | Count Needed |
|-----------|--------|--------------|
| UFS Tests | EXISTS | 75 (in progress) |
| Ideation Journey | MISSING | 10-15 |
| Specification Flow | MISSING | 10-15 |
| API Integration | MISSING | 30-40 |
| Frontend Unit | MISSING | 50+ |
| Performance | MISSING | 5-10 |

#### Ideation Journey Tests

| Test ID | Description |
|---------|-------------|
| E2E-IDEA-001 | Complete discovery mode journey |
| E2E-IDEA-002 | Complete "have idea" mode journey |
| E2E-IDEA-003 | Viability intervention triggers |
| E2E-IDEA-004 | Session abandonment and recovery |
| E2E-IDEA-005 | Pre-answered questions flow |
| E2E-IDEA-006 | Web search integration |
| E2E-IDEA-007 | Artifact creation and editing |
| E2E-IDEA-008 | Idea capture flow |
| E2E-IDEA-009 | Handoff at token limit |
| E2E-IDEA-010 | Multi-session continuity |

#### API Integration Tests

| Category | Test Count | Priority |
|----------|------------|----------|
| Auth endpoints | 8 | P0 |
| Ideation endpoints | 15 | P0 |
| Credit endpoints | 6 | P1 |
| Build endpoints | 10 | P1 |
| Hosting endpoints | 6 | P2 |

#### CI/CD Integration

| Component | Status | Purpose |
|-----------|--------|---------|
| GitHub Actions workflow | MISSING | Run tests on PR |
| Test parallelization | MISSING | Speed up runs |
| Coverage reporting | MISSING | Track coverage |
| Performance benchmarks | MISSING | Regression detection |

### Key Deliverables
1. Ideation journey test suite
2. API integration test framework
3. CI/CD pipeline for tests
4. Coverage reporting

---

## Phase 3: Mobile & PWA

**Status:** NOT STARTED
**Priority:** LOW (nice to have for target customer)

### Current State Analysis

**What Exists:**
- Responsive CSS (basic)
- React SPA

**What's Missing:**
- PWA manifest
- Service worker
- Offline capability
- Mobile-optimized components
- Touch interactions

### Gap Analysis

#### PWA Setup

| Component | Status | Purpose |
|-----------|--------|---------|
| `manifest.json` | MISSING | App metadata |
| Service worker | MISSING | Offline/caching |
| Icons (various sizes) | MISSING | App icons |
| iOS meta tags | MISSING | iOS support |

**Manifest.json:**
```json
{
  "name": "Vibe - Turn Ideas Into Apps",
  "short_name": "Vibe",
  "description": "AI-powered idea to app platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366f1",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

#### Mobile Optimizations

| Component | Status | Purpose |
|-----------|--------|---------|
| Touch-friendly buttons | NEEDS CHECK | Larger tap targets |
| Mobile navigation | NEEDS CHECK | Hamburger menu |
| Swipe gestures | MISSING | Natural mobile UX |
| Virtual keyboard handling | MISSING | Chat input behavior |
| Pull-to-refresh | MISSING | Session refresh |

#### Offline Capability

| Feature | Priority | Complexity |
|---------|----------|------------|
| Cached UI shell | P0 | Low |
| Read cached artifacts | P1 | Medium |
| Queue messages offline | P2 | High |
| Sync when online | P2 | High |

### Key Deliverables
1. PWA manifest and icons
2. Service worker for basic caching
3. Mobile-responsive testing
4. Touch interaction improvements

---

## Test Structure

### Test ID Prefixes
- `POLISH-MON-*`: Monitoring tests
- `POLISH-E2E-*`: E2E testing tests
- `POLISH-PWA-*`: PWA tests

### Dependencies
```
POLISH-MON-001 ──▶ POLISH-MON-010
        │
        ├─────────────────▶ POLISH-E2E-001
        │                         │
        │                         ▼
        │                   POLISH-E2E-020
        │                         │
        └─────────────────────────┼──▶ POLISH-PWA-001
                                  │           │
                                  │           ▼
                                  │     POLISH-PWA-010
                                  │
                                  ▼
                            (Parallel OK)
```

---

## Success Criteria

### Phase 1 (Monitoring) Complete When:
- [ ] Sentry capturing frontend errors
- [ ] Sentry capturing backend errors
- [ ] Key events tracked
- [ ] Error boundary prevents crashes
- [ ] Alerts configured for critical errors

### Phase 2 (E2E) Complete When:
- [ ] Ideation journey tests passing
- [ ] API integration tests written
- [ ] CI runs tests on PR
- [ ] Coverage > 60%

### Phase 3 (PWA) Complete When:
- [ ] PWA installable on mobile
- [ ] Basic offline shell works
- [ ] Mobile responsive verified
- [ ] Touch targets appropriate

---

## Files in This Spec Directory

```
specs/
├── 00-overview.md          # This file
├── 01-error-monitoring.md  # Sentry/analytics setup
├── 02-e2e-testing.md       # Test infrastructure
├── 03-pwa-mobile.md        # PWA setup
└── test-state.json         # Test tracking
```

---

*Created: 2026-01-07*
*Last Updated: 2026-01-07*
