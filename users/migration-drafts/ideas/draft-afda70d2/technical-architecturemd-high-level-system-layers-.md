---
id: subagent_task_1767649551151_0
title: "**technical-architecture.md** - High-level system layers, databases, APIs, infrastructure"
type: markdown
userSlug: migration-drafts
ideaSlug: draft-afda70d2
sessionId: afda70d2-5ae0-497e-9ab2-8e7596c9da07
createdAt: 2026-01-05 21:47:49
updatedAt: 2026-01-05 21:47:49
---
Now I have a comprehensive understanding. Let me create a detailed technical architecture exploration document.

---

# Technical Architecture Exploration: Vibe Platform

## System Overview

Vibe is an ambitious AI-powered platform with three pillars: **Ideation** (idea → validated concept), **Building** (concept → working app), and **Networking** (proactive collaboration). The architecture must support:

1. **Conversational AI** — Multi-turn dialogue with context preservation
2. **Agent Orchestration** — Self-improving agents that learn from failures
3. **App Generation** — AI that writes, tests, and deploys full applications
4. **Multi-tenant Hosting** — Running thousands of user-generated apps
5. **Network Matching** — Semantic similarity for collaboration opportunities

**Key Constraint:** Solo founder with 15-20 hours/week, $100K AUD budget, TypeScript/AI experience.

---

## Core Components

### 1. Conversation Engine
**Responsibility:** Manages all user-AI dialogue, context preservation, and UI state transitions.

| Sub-component | Purpose |
|---------------|---------|
| **Session Manager** | Tracks conversation state across browser sessions |
| **Context Assembler** | Builds rich context for each AI call (user profile, idea state, history) |
| **Memory Store** | Long-term storage of user preferences, extracted insights |
| **UI State Controller** | Coordinates UI transitions (full-screen chat → dashboard) |

**Interfaces:**
- Receives: User messages, UI events
- Sends: Enriched prompts to Agent Layer, UI state updates to Frontend

---

### 2. Agent Orchestration Layer
**Responsibility:** Routes tasks, manages agent lifecycle, implements self-improvement loops.

| Sub-component | Purpose |
|---------------|---------|
| **Orchestrator** | Master router — decides which agent handles each request |
| **Agent Registry** | Catalog of agent types, their capabilities, and track records |
| **Pipeline Manager** | Creates task workflows with stage gates |
| **SIA (Self-Improvement Agent)** | Meta-agent that improves coding agents when stuck |

**Interfaces:**
- Receives: Enriched prompts from Conversation Engine
- Sends: Responses back to user, code artifacts to Build Pipeline

---

### 3. Build Pipeline
**Responsibility:** Transforms specifications into running applications.

| Sub-component | Purpose |
|---------------|---------|
| **Code Generator** | AI-powered code synthesis |
| **Test Runner** | Automated testing of generated code |
| **Deployment Engine** | Packages and deploys to hosting |
| **App Manager** | Lifecycle management (scale, update, pause) |

**Interfaces:**
- Receives: Specifications from Spec Agent
- Sends: Build artifacts to Hosting Layer, status updates to Frontend

---

### 4. Hosting & Runtime Layer
**Responsibility:** Runs user-generated apps in isolated environments.

| Sub-component | Purpose |
|---------------|---------|
| **Container Orchestrator** | Manages per-app containers |
| **Database Provisioner** | Creates isolated databases per app |
| **Vibe Wrapper** | Injected JS for analytics, cross-app features |
| **Custom Domain Manager** | SSL and routing for user domains |

**Interfaces:**
- Receives: Build artifacts from Pipeline
- Sends: App status to Platform, metrics to Analytics

---

### 5. Data Layer
**Responsibility:** Persistent storage for all platform data.

| Store | Technology Options | Purpose |
|-------|-------------------|---------|
| **Platform DB** | Supabase (Postgres) | Users, ideas, agents, sessions |
| **Vector Store** | Pinecone / Qdrant | Semantic search for networking |
| **File Storage** | Cloudflare R2 / S3 | User uploads, generated assets |
| **Analytics** | PostHog | Product analytics, feature flags |
| **App Data** | Turso (SQLite) per app | User app databases |

---

## Data Flow

### Ideation Flow
```
User Input
    │
    ▼
┌───────────────────┐
│ Conversation      │
│ Engine            │──► Context assembled (profile, history, idea state)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Orchestrator      │──► Routes to Ideation Agent
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Ideation Agent    │──► AI response (Claude API)
│                   │──► Extract insights → Idea DB
│                   │──► Stage gate check → Pipeline update
└─────────┬─────────┘
          │
          ▼
Response to User + UI State Update
```

### Build Flow (Ralph Loop + SIA)
```
Specification Complete
    │
    ▼
┌───────────────────┐
│ Build Agent       │──► Generate code → Git repo
│                   │──► Run tests
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Tests Pass?       │
│                   │
│ YES → Deploy      │
│ NO  → Same task?  │──► YES → SIA Activation
│                   │──► NO  → Continue loop
└───────────────────┘
          │
          ▼ (SIA Path)
┌───────────────────┐
│ SIA               │──► Analyze transcript
│                   │──► Select technique
│                   │──► Generate new prompt
│                   │──► Spawn new Build Agent
└───────────────────┘
```

---

## Technology Considerations

### Architecture Pattern: Modular Monolith → Services

**MVP (Months 1-4):** Start as a modular monolith for speed.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Framework** | Next.js 14 (App Router) | SSR, API routes, great DX, founder familiar with React ecosystem |
| **Backend** | Next.js API Routes + tRPC | Type-safe end-to-end, no separate backend deployment |
| **Database** | Supabase (Postgres) | Managed, real-time subscriptions, auth built-in |
| **AI Provider** | Anthropic Claude | Best reasoning, founder already using Anthropic SDK |
| **Queue** | Inngest | Background jobs for agents, built for serverless |
| **Hosting (Platform)** | Vercel | Zero-config for Next.js, scales automatically |
| **Hosting (User Apps)** | Railway or Fly.io | Container-based, per-app isolation |

### Trade-offs Analysis

| Decision | Pros | Cons | Mitigation |
|----------|------|------|------------|
| **Next.js Monolith** | Fast to build, single deployment, type safety | Can become unwieldy at scale | Modular structure, extract services later |
| **Supabase** | Fast setup, real-time, row-level security | Lock-in, limits on free tier | Abstract DB layer, plan for migration |
| **Inngest** | Serverless-native queues, great DX | Newer product, less proven | Fallback to BullMQ if needed |
| **Railway for user apps** | Per-container billing, easy Docker | Less mature than AWS/GCP | Accept tradeoff for speed to market |

### Alternative Considered: Microservices from Start

**Rejected because:**
- Solo founder cannot maintain multiple services
- Adds deployment complexity
- Premature optimization before product-market fit
- Can extract services later when pain is clear

---

## Build vs. Buy Decisions

| Capability | Build | Buy | Recommendation |
|------------|-------|-----|----------------|
| **Authentication** | Custom | Supabase Auth / Clerk | **Buy** — Not differentiating, Supabase Auth included |
| **Agent Framework** | Custom | LangChain / CrewAI | **Build** — SIA is unique, existing frameworks too rigid |
| **Code Generation** | Custom prompts | Existing builders (Bolt, v0) | **Build** — Competitive differentiator, need full control |
| **Testing** | Custom | Playwright + Vitest | **Buy** — Standard tooling, no need to reinvent |
| **Payments** | Custom | Stripe | **Buy** — Standard, Stripe Connect for user payments |
| **Email** | Custom | Resend / Postmark | **Buy** — Commodity, focus elsewhere |
| **Vector Search** | Custom | Pinecone / Qdrant | **Buy** — Specialized infra, not core value |
| **Hosting User Apps** | Custom Kubernetes | Railway / Render | **Buy (initially)** — Focus on building, not ops |

---

## Scalability Requirements

### MVP Scale (Months 1-6)
- **Users:** 50-100 active
- **Apps:** 10-50 deployed
- **Agent Sessions:** 100/day
- **Concurrent Users:** 10

**Architecture needs:** Single region, basic auto-scaling, shared infrastructure.

### Growth Scale (Months 6-18)
- **Users:** 1,000-5,000 active
- **Apps:** 500-2,000 deployed
- **Agent Sessions:** 1,000/day
- **Concurrent Users:** 100

**Architecture needs:** Multi-region option, dedicated agent workers, per-app resource limits.

### Full Scale (18+ months)
- **Users:** 50,000+
- **Apps:** 10,000+
- **Agent Sessions:** 10,000+/day

**Architecture needs:** Microservices extraction, global edge presence, dedicated infrastructure.

---

## Integration Points

### AI Providers
```
┌─────────────────────────────────────────────────────────┐
│                   AI Gateway Layer                       │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Anthropic  │  │   OpenAI    │  │  Open-source    │ │
│  │  (Primary)  │  │  (Fallback) │  │  (Cost optimize)│ │
│  │  Claude 4   │  │  GPT-4o     │  │  Llama/Mistral  │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                                                          │
│  Responsibilities:                                       │
│  • Load balancing across providers                      │
│  • Automatic fallback on failures                       │
│  • Cost tracking per call                               │
│  • Rate limiting                                        │
│  • Response caching (where appropriate)                 │
└─────────────────────────────────────────────────────────┘
```

### External Services

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| **Stripe** | Platform payments, credit purchases | Stripe SDK, webhooks |
| **Stripe Connect** | User app payments (Vibe Payments) | Connected accounts |
| **Resend** | Transactional email | REST API |
| **GitHub** | Store generated app code | GitHub API |
| **Sentry** | Error tracking | SDK integration |
| **PostHog** | Product analytics | SDK integration |
| **Cloudflare** | CDN, WAF, DNS | Infrastructure level |

### API Design

**User-facing API:** tRPC for type safety
```typescript
// Example tRPC router
const appRouter = router({
  ideas: router({
    list: publicProcedure.query(...),
    create: protectedProcedure.input(z.object({...})).mutation(...),
    get: protectedProcedure.input(z.string()).query(...),
  }),
  sessions: router({
    start: protectedProcedure.input(z.object({...})).mutation(...),
    message: protectedProcedure.input(z.object({...})).mutation(...),
  }),
});
```

**WebSocket Events:** Real-time agent communication
```typescript
// Event types
type AgentEvent = 
  | { type: 'thinking'; agentType: string }
  | { type: 'message'; content: string }
  | { type: 'tool_call'; tool: string; args: unknown }
  | { type: 'build_progress'; stage: string; percent: number }
  | { type: 'error'; message: string };
```

---

## Security Considerations

### Authentication & Authorization

| Layer | Mechanism |
|-------|-----------|
| **User Auth** | Supabase Auth (magic link + OAuth) |
| **Session Management** | JWT in httpOnly cookies |
| **API Authorization** | Row-level security in Supabase |
| **App Isolation** | Container network isolation |
| **Agent Actions** | Sandboxed execution, no direct DB access |

### Data Protection

| Data Type | Protection Level |
|-----------|-----------------|
| **User credentials** | Managed by Supabase (bcrypt) |
| **API keys** | Encrypted at rest (Vault or Supabase secrets) |
| **User ideas** | Encrypted at rest, RLS policies |
| **Generated code** | Private GitHub repos per user |
| **Agent transcripts** | Encrypted, auto-deleted after 90 days |

### User App Isolation Model
```
┌─────────────────────────────────────────┐
│           Platform Network               │
│                                          │
│  ┌──────────┐    ┌──────────┐           │
│  │  App A   │    │  App B   │           │
│  │ ┌──────┐ │    │ ┌──────┐ │           │
│  │ │ DB A │ │ NO │ │ DB B │ │           │
│  │ └──────┘ │◄──►│ └──────┘ │           │
│  │ Network A│    │ Network B│           │
│  └──────────┘    └──────────┘           │
│         │              │                 │
│         ▼              ▼                 │
│  ┌──────────────────────────────────────┐│
│  │     Shared Ingress (Cloudflare)     ││
│  └──────────────────────────────────────┘│
└─────────────────────────────────────────┘

• Each app in isolated network namespace
• No cross-app DB access
• Traffic routed through shared ingress
• Resource limits per container
```

### Compliance Considerations

| Requirement | Approach |
|-------------|----------|
| **GDPR** | Data export, deletion APIs, consent tracking |
| **Content moderation** | AI content filtering, human review queue |
| **Harmful apps** | Detection pipeline, app review before public launch |
| **Payment compliance** | Stripe handles PCI DSS |

---

## Evolution Path

### Phase 1: MVP (Months 1-4)
**Goal:** Ideation + Build working end-to-end

```
┌─────────────────────────────────────────────────────────┐
│                    MVP ARCHITECTURE                       │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                   Next.js App                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│  │
│  │  │ Frontend │  │ API      │  │ Agent Workers    ││  │
│  │  │ (React)  │  │ (tRPC)   │  │ (Inngest)        ││  │
│  │  └──────────┘  └──────────┘  └──────────────────┘│  │
│  └───────────────────────────────────────────────────┘  │
│                           │                              │
│              ┌────────────┴────────────┐                │
│              ▼                         ▼                │
│        ┌──────────┐              ┌──────────┐          │
│        │ Supabase │              │ Anthropic │          │
│        │ (DB+Auth)│              │ Claude    │          │
│        └──────────┘              └──────────┘          │
│                                                          │
│  User Apps: Manual deployment to Railway                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Key deliverables:**
- Full-screen chat → dashboard UI
- Ideation agent with context preservation
- Spec agent extracting requirements
- Build agent generating code
- Manual deployment to Railway
- Basic SIA loop (3-5 techniques)

---

### Phase 2: Post-MVP (Months 5-8)
**Goal:** Automated deployment, testing agents, reduced friction

```
┌─────────────────────────────────────────────────────────┐
│               POST-MVP ARCHITECTURE                       │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                Next.js App + Extracted Services    │  │
│  │                                                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│  │
│  │  │ Frontend │  │ API      │  │ Agent Service    ││  │
│  │  │          │  │          │  │ (extracted)      ││  │
│  │  └──────────┘  └──────────┘  └──────────────────┘│  │
│  └───────────────────────────────────────────────────┘  │
│                           │                              │
│              ┌────────────┼────────────┐                │
│              ▼            ▼            ▼                │
│        ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│        │ Supabase │ │ Anthropic│ │ Railway  │          │
│        │          │ │          │ │ (auto)   │          │
│        └──────────┘ └──────────┘ └──────────┘          │
│                                                          │
│  + Redis cache                                          │
│  + Vector DB for network matching                       │
│  + Automated deployment pipeline                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Key additions:**
- Automated app deployment (no manual steps)
- Testing agents running nightly
- Full SIA technique library
- Redis caching for sessions
- Pinecone for network matching
- Collaboration/invite flow

---

### Phase 3: Scale (Months 9-18)
**Goal:** Multi-region, advanced features, reduced costs

```
┌─────────────────────────────────────────────────────────┐
│                 SCALE ARCHITECTURE                        │
│                                                          │
│              ┌─────────────────────────┐                │
│              │      Cloudflare         │                │
│              │  CDN + WAF + LB         │                │
│              └───────────┬─────────────┘                │
│                          │                               │
│         ┌────────────────┼────────────────┐             │
│         ▼                ▼                ▼             │
│    ┌─────────┐     ┌─────────┐     ┌─────────┐        │
│    │ Sydney  │     │ US-West │     │ EU-West │        │
│    │ Region  │     │ Region  │     │ Region  │        │
│    └─────────┘     └─────────┘     └─────────┘        │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          ▼                               │
│              ┌─────────────────────────┐                │
│              │  Extracted Services     │                │
│              │  • Agent Orchestrator   │                │
│              │  • Build Pipeline       │                │
│              │  • Network Matching     │                │
│              └─────────────────────────┘                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Key additions:**
- Multi-region deployment
- Microservices for high-load components
- Advanced ML for agent optimization
- Self-hosted alternatives for cost (Qdrant, etc.)
- Network/matchmaking agents active

---

## Recommended MVP Technology Stack Summary

| Layer | Technology | Cost Estimate (Monthly) |
|-------|------------|------------------------|
| **Frontend** | Next.js 14 + TypeScript | $0 (Vercel free tier) |
| **Backend** | Next.js API + tRPC | Included above |
| **Database** | Supabase Pro | $25 |
| **Auth** | Supabase Auth | Included |
| **Background Jobs** | Inngest | $0-50 |
| **AI** | Claude API | $200-500 (variable) |
| **User App Hosting** | Railway | $5/app |
| **File Storage** | Cloudflare R2 | $5 |
| **Email** | Resend | $20 |
| **Analytics** | PostHog | $0 (self-hosted or free tier) |
| **Monitoring** | Sentry | $0 (free tier) |
| **Domain/CDN** | Cloudflare | $0 (free tier) |

**Total MVP Infrastructure:** ~$250-600/month (excluding AI costs which scale with usage)

---

## Critical Success Factors

1. **Start simple** — Monolith first, extract services when pain is clear
2. **Lean on managed services** — Solo founder cannot maintain infra
3. **Type safety everywhere** — TypeScript + tRPC + Zod prevents bugs
4. **AI costs are variable** — Build credit system early to track and control
5. **Agent architecture is the moat** — Invest in SIA, don't shortcut
6. **User app isolation is mandatory** — Security breach = game over

---

## Open Questions for Further Exploration

1. **Code storage:** GitHub (external) vs. self-hosted Git (Gitea)?
2. **Testing framework for generated apps:** How to standardize across diverse apps?
3. **Offline-first:** Should platform work offline? Adds significant complexity.
4. **Mobile apps:** PWA sufficient or need native for app store submission?
5. **AI provider costs:** At what scale does fine-tuning become cost-effective?

---

*This architecture exploration is designed for Vibe's specific constraints: solo founder, limited time, emphasis on speed to market while maintaining a strong technical foundation for scale.*