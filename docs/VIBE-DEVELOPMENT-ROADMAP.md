# Vibe Platform Development Roadmap

**Created:** January 7, 2026
**Last Updated:** January 7, 2026
**Status:** Active Development
**Founder Constraint:** 15-20 hours/week

---

## Executive Summary

This document provides a comprehensive task list for the Vibe platform development. Vibe transforms ideas into AI-managed SaaS products through three pillars: **Ideation**, **Building**, and **Network**. The platform uses self-improving autonomous agents to guide non-technical users from a vague idea to a working product.

---

## Current State Summary

### Completed

| Component | Status | Notes |
|-----------|--------|-------|
| Ideation Agent - Phase 1 (Foundation) | Complete | Database, types, mappers, defaults |
| Ideation Agent - Phase 2 (Core Backend) | Complete | Session management, memory, signal extraction |
| Ideation Agent - Phase 3 (API Layer) | Complete | All endpoints implemented |
| Ideation Agent - Phase 4 (Frontend) | Complete | All components and state management |
| Documentation | Complete | Vision, architecture, SIA design, target customer |
| Basic Idea Incubator CLI | Complete | Capture, evaluate, profile commands |

### In Progress

| Component | Status | Notes |
|-----------|--------|-------|
| Ideation Agent - Phase 5 (Integration) | Partial | E2E tests pending |
| Unified File System | In Progress | Specs written, Ralph loop running |
| Unified Artifact Store | In Progress | Migrating from DB to filesystem |

### Not Started

| Component | Priority | Complexity |
|-----------|----------|------------|
| Specification Agent | Critical | High |
| Build Agent | Critical | Very High |
| Self-Improvement Agent (SIA) | High | Very High |
| Orchestrator Agent | High | High |
| Network/Collaboration | Medium | High |
| Hosting & Deployment | High | High |
| Testing Agent System | Medium | High |
| Credit System | Medium | Medium |

---

## Phase 1: Ideation Complete (Current Focus: Polish & E2E)

### 1.1 E2E Testing & Integration Polish

**Priority:** Critical
**Estimated Effort:** 1-2 weeks

- [ ] **TEST-E2E-001**: Complete ideation journey (discover mode)
- [ ] **TEST-E2E-002**: Complete ideation journey (have idea mode)
- [ ] **TEST-E2E-003**: Idea development with viability concerns
- [ ] **TEST-E2E-004**: Session abandonment and recovery
- [ ] Verify pre-answered questions flow to Development phase
- [ ] Test handoff at 80% token usage
- [ ] Test viability interventions
- [ ] Test SSE streaming in production build
- [ ] Performance testing with long conversations
- [ ] Error handling edge cases
- [ ] Mobile responsiveness testing

### 1.2 Unified File System Implementation

**Priority:** High
**Estimated Effort:** 2-3 weeks
**Ralph Loop:** `python3 tests/e2e/unified-fs-ralph-loop.py`

| Spec | Tests | Description | Status |
|------|-------|-------------|--------|
| 01-folder-structure-idea-types | FS-001 to FS-015 | User folders, templates, idea types | In Progress |
| 02-unified-artifact-store | AS-001 to AS-015 | Filesystem-based artifact storage | Pending |
| 03-session-context-management | SC-001 to SC-015 | Session linking, context loading | Pending |
| 04-phase-transitions-handoffs | PH-001 to PH-015 | Classification, phase management | Pending |
| 05-ui-components | UI-001 to UI-015 | Table, preview, idea selector | Pending |

**Key Files to Create:**
- [ ] `utils/folder-structure.ts` - User/idea folder utilities
- [ ] `agents/ideation/unified-artifact-store.ts` - Filesystem-based artifact storage
- [ ] `agents/ideation/idea-context-builder.ts` - Layered context builder
- [ ] `agents/ideation/priority-manager.ts` - Document priority management
- [ ] `scripts/migrate-artifacts-to-files.ts` - Migration script
- [ ] `templates/unified/*` - All guided templates
- [ ] Frontend components for new artifact panel layout

---

## Phase 2: Specification Agent

**Priority:** Critical
**Estimated Effort:** 3-4 weeks
**Depends On:** Ideation Agent complete

The Specification Agent extracts detailed requirements through conversation, preparing everything the Build Agent needs.

### 2.1 Core Implementation

- [ ] Design spec extraction conversation flow
- [ ] Create question sequences for different app types
- [ ] Implement requirement gathering logic
- [ ] Build spec agent system prompt
- [ ] Create `agents/specification/` directory structure

### 2.2 Requirement Categories

- [ ] Feature extraction with priorities (must-have, nice-to-have)
- [ ] User flow mapping and journey documentation
- [ ] Database schema requirements
- [ ] API needs identification
- [ ] Third-party integration requirements
- [ ] UI/UX preferences capture
- [ ] Business rules documentation

### 2.3 Handoff Integration

- [ ] Connect ideation -> spec handoff
- [ ] Preserve context from ideation
- [ ] Generate structured specification document
- [ ] Create acceptance criteria for each feature
- [ ] Define test cases upfront

### 2.4 Database & API

- [ ] Create `spec_sessions` table
- [ ] Create `spec_requirements` table
- [ ] Create `spec_features` table
- [ ] Implement API endpoints:
  - [ ] POST `/api/specification/start`
  - [ ] POST `/api/specification/message`
  - [ ] GET `/api/specification/session/:id`
  - [ ] POST `/api/specification/complete`

### 2.5 Frontend

- [ ] Create SpecificationPage component
- [ ] Create SpecificationSession component
- [ ] Create RequirementsList component
- [ ] Create FeaturePrioritization component
- [ ] Integrate with existing idea flow

---

## Phase 3: Build Agent & Ralph Loop

**Priority:** Critical
**Estimated Effort:** 6-8 weeks
**Depends On:** Specification Agent complete

The Build Agent generates application code via the Ralph loop with human-in-the-loop.

### 3.1 Ralph Loop Infrastructure

- [ ] Design Ralph loop structure for build agent
- [ ] Create loop iteration tracking
- [ ] Implement feedback/iteration mechanism
- [ ] Build human-in-the-loop escalation system
- [ ] Create build transcript logging
- [ ] Implement checkpoint/resume capability

### 3.2 Code Generation

- [ ] Template-based scaffold generation
- [ ] Component generation from specs
- [ ] Database migration generation
- [ ] API endpoint generation
- [ ] Frontend component generation
- [ ] Test file generation

### 3.3 Build Validation

- [ ] Automated test runner integration
- [ ] Lint/format checking
- [ ] Build verification
- [ ] Type checking for TypeScript projects
- [ ] Error detection and categorization

### 3.4 Version Control Integration

- [ ] Git repository per user app
- [ ] Automatic commit on successful iterations
- [ ] Branch management for features
- [ ] Commit message generation
- [ ] Rollback capability

### 3.5 Database & API

- [ ] Create `build_sessions` table
- [ ] Create `build_iterations` table
- [ ] Create `build_artifacts` table
- [ ] Create `build_errors` table
- [ ] Implement API endpoints

### 3.6 Frontend

- [ ] Create BuildPage component
- [ ] Create BuildProgress component
- [ ] Create IterationHistory component
- [ ] Create ErrorDisplay component
- [ ] Create CodePreview component (optional)
- [ ] Create "User doesn't see code" abstraction layer

---

## Phase 4: Self-Improvement Agent (SIA)

**Priority:** High
**Estimated Effort:** 4-6 weeks
**Depends On:** Build Agent operational

The SIA improves coding agent performance when tasks are repeatedly failed.

### 4.1 Core SIA Implementation

- [ ] Create `agents/sia/` directory structure
- [ ] Build SIA system prompt with techniques library
- [ ] Implement trigger detection (same task reworked)
- [ ] Create transcript analysis capability
- [ ] Build pattern recognition system

### 4.2 Techniques Library

Implement all 10 techniques from SIA architecture:

| # | Technique | Status |
|---|-----------|--------|
| 1 | Decomposition | [ ] |
| 2 | Tool Change | [ ] |
| 3 | Prompt Restructuring | [ ] |
| 4 | Context Pruning | [ ] |
| 5 | Example Injection | [ ] |
| 6 | Constraint Relaxation | [ ] |
| 7 | Dependency Reordering | [ ] |
| 8 | Abstraction Level Shift | [ ] |
| 9 | Error Pattern Recognition | [ ] |
| 10 | Fresh Start | [ ] |

### 4.3 SIA Memory

- [ ] Create per-task memory files (JSON/MD)
- [ ] Track attempt history with outcomes
- [ ] Log techniques applied and results
- [ ] Calculate improvement deltas
- [ ] Store prompts tried with success/fail

### 4.4 Validation System

- [ ] Implement deterministic pass/fail checking
- [ ] Compare outcomes against acceptance criteria
- [ ] Track technique effectiveness over time
- [ ] Build learning feedback loop

### 4.5 Failsafe Protocols

- [ ] Implement max attempts circuit breaker (5)
- [ ] Credit consumption cap
- [ ] Time limit per task (30 min)
- [ ] Impossible task detection
- [ ] Human escalation packaging

### 4.6 Metrics & Dashboard

- [ ] Track intervention success rate
- [ ] Track first-attempt resolution rate
- [ ] Track escalation rate
- [ ] Track average techniques tried
- [ ] Build SIA performance dashboard

---

## Phase 5: Orchestrator Agent

**Priority:** High
**Estimated Effort:** 3-4 weeks
**Depends On:** Multiple specialized agents exist

The Orchestrator routes requests and manages the agent ecosystem.

### 5.1 Agent Registry

- [ ] Design agent registry schema
- [ ] Create `agents/orchestrator/registry.ts`
- [ ] Implement agent registration system
- [ ] Track agent capabilities and status
- [ ] Implement agent versioning

### 5.2 Routing Logic

- [ ] Build request analysis system
- [ ] Implement capability matching
- [ ] Create routing decision engine
- [ ] Handle agent unavailability
- [ ] Implement load balancing (future)

### 5.3 Pipeline Generation

- [ ] Create dynamic pipeline builder
- [ ] Implement stage gates
- [ ] Track pipeline progress
- [ ] Handle pipeline failures
- [ ] Enable pipeline modification

### 5.4 Agent Lifecycle Management

- [ ] Implement agent spawning
- [ ] Handle agent termination
- [ ] Manage context handoffs
- [ ] Track agent health
- [ ] Implement agent versioning

### 5.5 Database & API

- [ ] Create `agent_registry` table
- [ ] Create `agent_sessions` table
- [ ] Create `pipelines` table
- [ ] Implement orchestrator API endpoints

---

## Phase 6: Hosting & Deployment

**Priority:** High
**Estimated Effort:** 4-6 weeks
**Depends On:** Build Agent produces deployable code

Enable generated apps to be deployed and run.

### 6.1 Hosting Infrastructure

- [ ] Choose hosting provider (Railway/Render/Vercel)
- [ ] Set up multi-tenant app hosting
- [ ] Implement container isolation
- [ ] Create per-app database provisioning
- [ ] Set up CDN for static assets

### 6.2 Deployment Pipeline

- [ ] Automated build on code changes
- [ ] Test execution before deploy
- [ ] Blue-green deployment support
- [ ] Rollback capability
- [ ] Deploy notifications

### 6.3 App Management

- [ ] App lifecycle management (start/stop/pause)
- [ ] Domain management (custom domains)
- [ ] SSL certificate provisioning
- [ ] Environment variable management
- [ ] App monitoring and logging

### 6.4 "Vibe Wrapper" Implementation

- [ ] Inject analytics code
- [ ] Add "Powered by Vibe" branding (optional)
- [ ] Cross-app discovery features (optional)
- [ ] Unified user analytics

### 6.5 Database & API

- [ ] Create `apps` table
- [ ] Create `deployments` table
- [ ] Create `app_configs` table
- [ ] Implement hosting API endpoints

---

## Phase 7: Collaboration & Network

**Priority:** Medium
**Estimated Effort:** 4-6 weeks
**Depends On:** Core ideation + build working

Enable collaboration during ideation and proactive networking post-launch.

### 7.1 Invite System

- [ ] Email invite for collaborators
- [ ] Invite link generation
- [ ] Collaborator onboarding flow
- [ ] Invite tracking and analytics

### 7.2 Permission System

- [ ] Granular sharing controls
- [ ] Role-based access (owner, collaborator, viewer)
- [ ] Control what collaborators can see
- [ ] Audit log for access

### 7.3 Collaboration Features

- [ ] Real-time co-ideation (optional MVP)
- [ ] Direct messaging between users
- [ ] Comment/reaction system
- [ ] Contribution tracking
- [ ] Expert consultation requests

### 7.4 Proactive Networking

- [ ] Idea overlap detection
- [ ] Audience overlap analysis
- [ ] Collaboration opportunity surfacing
- [ ] Integration point matching
- [ ] Notification system for opportunities

### 7.5 NDA/Confidentiality

- [ ] Platform-wide terms enforcement
- [ ] Violation detection and reporting
- [ ] Partial idea sharing (ask questions without revealing full idea)

### 7.6 Database & API

- [ ] Create `collaborators` table
- [ ] Create `invites` table
- [ ] Create `messages` table
- [ ] Create `connections` table
- [ ] Implement network API endpoints

---

## Phase 8: Testing Agent System

**Priority:** Medium
**Estimated Effort:** 4-6 weeks
**Depends On:** Apps can be deployed

Autonomous testing agents for continuous platform improvement.

### 8.1 Browser Automation

- [ ] Set up browser controller (Puppeteer/Playwright)
- [ ] Implement action simulation (clicks, inputs, navigation)
- [ ] Create metadata capture system
- [ ] Build transcript generation

### 8.2 User Journey Simulation

- [ ] Define standard user journeys
- [ ] Create journey execution engine
- [ ] Implement variability in paths
- [ ] Track completion rates

### 8.3 Analysis System

- [ ] Stuck point detection
- [ ] Friction point identification
- [ ] Gap detection
- [ ] Feature opportunity identification

### 8.4 Action System

- [ ] Auto-fix for simple issues
- [ ] Backlog creation for complex issues
- [ ] Agent registry updates
- [ ] Critical issue alerting

### 8.5 Test Environment

- [ ] Isolated test environments
- [ ] Mock external services
- [ ] Prevent real side effects
- [ ] Data cleanup after tests

### 8.6 Edge Case Discovery

- [ ] AI-generated test scenarios
- [ ] Pattern-based test expansion
- [ ] Regression test generation
- [ ] Coverage tracking

---

## Phase 9: Credit System & Monetization

**Priority:** Medium
**Estimated Effort:** 2-3 weeks
**Depends On:** Core platform functional

Enable revenue through credit-based usage.

### 9.1 Credit Tracking

- [ ] Implement credit balance per user
- [ ] Track credit consumption per action
- [ ] Credit usage analytics
- [ ] Usage alerts and limits

### 9.2 Credit Actions

Define credit costs for:

| Action | Credits | Notes |
|--------|---------|-------|
| Ideation message | 1 | Basic cost |
| Web search | 2 | Higher cost |
| Build iteration | 5-10 | Based on complexity |
| App hosting (daily) | 1 | Ongoing cost |
| SIA intervention | 3 | Meta-agent cost |

### 9.3 Free Tier

- [ ] Define free credit allocation
- [ ] Implement free tier limits
- [ ] Free tier expiration (if any)
- [ ] Upgrade prompts

### 9.4 Purchase Flow

- [ ] Stripe integration
- [ ] Credit package options
- [ ] Purchase confirmation
- [ ] Receipt generation

### 9.5 Subscription Tiers

- [ ] Define tier levels (Basic, Pro, etc.)
- [ ] Tier-specific features
- [ ] Tier-specific credit allowances
- [ ] Upgrade/downgrade flow

### 9.6 Database & API

- [ ] Create `credit_transactions` table
- [ ] Create `subscriptions` table
- [ ] Implement billing API endpoints

---

## Phase 10: Feature Wishlist (Future Enhancements)

Based on `docs/feature-wish-list/features-overview.md`:

### 10.1 Idea Classification & Context

- [ ] Distinguish new business vs. feature of existing business
- [ ] Idea folder context loading for agent orientation
- [ ] Parent/child idea relationships
- [ ] Micro-services and API-only ideas support

### 10.2 Business Intelligence

- [ ] AI domain expert profiles (auto-spawned sub-agents)
- [ ] "Scan for assumptions" button
- [ ] Differentiation opportunity discovery (Completed)
- [ ] Smart suggestions based on profile + web search (Completed)

### 10.3 Network Enhancements

- [ ] LinkedIn integration for network loading
- [ ] Feature licensing between users
- [ ] Cross-expand audiences through overlap detection
- [ ] AI-powered collaboration matching

### 10.4 Legal & Compliance

- [ ] Guided legal business setup
- [ ] App Store/Google Play submission guidance
- [ ] Regulatory compliance assistance

### 10.5 Project Management

- [ ] User-visible timeline tracker
- [ ] AI-generated milestone plans
- [ ] Progress tracking dashboard

---

## Technical Debt & Infrastructure

### 11.1 Backend Improvements

- [ ] Implement proper error handling across all endpoints
- [ ] Add request validation middleware
- [ ] Improve logging and observability
- [ ] Add rate limiting
- [ ] Implement caching (Redis)

### 11.2 Frontend Improvements

- [ ] Accessibility audit and fixes (WCAG 2.1 AA)
- [ ] Performance optimization
- [ ] PWA support for mobile
- [ ] Offline capability for basic browsing
- [ ] Improved loading states

### 11.3 Database Optimization

- [ ] Add proper indexes
- [ ] Query optimization
- [ ] Connection pooling
- [ ] Read replicas (at scale)
- [ ] Backup and recovery procedures

### 11.4 Security

- [ ] Security audit
- [ ] Input sanitization review
- [ ] XSS prevention verification
- [ ] CSRF protection
- [ ] API key encryption

### 11.5 DevOps

- [ ] CI/CD pipeline improvements
- [ ] Automated testing in pipeline
- [ ] Preview deployments per PR
- [ ] Blue-green deployment
- [ ] Monitoring and alerting (Sentry, Datadog)

---

## Metrics to Track

### User Engagement

| Metric | Target |
|--------|--------|
| DAU/MAU | >30% |
| Ideation completion rate | >50% |
| Time in ideation | 15-30 min average |
| Return after 7 days | >30% |

### Platform Health

| Metric | Target |
|--------|--------|
| API latency P95 | <500ms |
| Error rate | <1% |
| Agent success rate | >90% |
| SIA intervention success | >70% |

### Business

| Metric | Target |
|--------|--------|
| Signups | Growth trend |
| Free to paid conversion | >5% |
| Monthly revenue | Growth trend |
| Churn rate | <5% monthly |

---

## Timeline Overview

| Phase | Description | Estimated Duration | Priority |
|-------|-------------|-------------------|----------|
| 1.1 | E2E Testing & Integration | 1-2 weeks | Critical |
| 1.2 | Unified File System | 2-3 weeks | High |
| 2 | Specification Agent | 3-4 weeks | Critical |
| 3 | Build Agent & Ralph Loop | 6-8 weeks | Critical |
| 4 | Self-Improvement Agent | 4-6 weeks | High |
| 5 | Orchestrator Agent | 3-4 weeks | High |
| 6 | Hosting & Deployment | 4-6 weeks | High |
| 7 | Collaboration & Network | 4-6 weeks | Medium |
| 8 | Testing Agent System | 4-6 weeks | Medium |
| 9 | Credit System | 2-3 weeks | Medium |

**Note:** Times are rough estimates for focused development. With 15-20 hours/week, multiply by ~3-4x for calendar time.

---

## Next Immediate Actions

1. [ ] Complete E2E tests for ideation agent (TEST-E2E-001 through E2E-004)
2. [ ] Continue Unified File System Ralph loop
3. [ ] Design Specification Agent conversation flow
4. [ ] Set up basic hosting infrastructure for demo
5. [ ] Begin build-in-public on Twitter/X

---

## Success Criteria for MVP

The MVP is complete when:

- [ ] User can go from "What makes you tick?" to a validated idea
- [ ] User can go from validated idea to documented specification
- [ ] User can go from specification to a working deployed app
- [ ] At least 10 external users have completed the full journey
- [ ] Credit system is functional
- [ ] First paying customer acquired

---

*This document is a living roadmap. Update weekly during sprint planning.*

*Last Updated: January 7, 2026*
