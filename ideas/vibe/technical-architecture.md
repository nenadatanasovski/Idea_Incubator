# Vibe Technical Architecture

**Version:** 1.0 (Draft)
**Date:** January 4, 2025
**Status:** Pre-implementation

---

## Overview

This document describes the high-level technical architecture for Vibe — the AI platform that transforms ideas into AI-managed SaaS products. The architecture is designed to be:

- **Scalable** — Handle thousands of concurrent users and apps
- **AI-Native** — Built around agent orchestration, not retrofitted
- **Self-Improving** — Autonomous testing and optimization built-in
- **User-Invisible** — All complexity hidden from non-technical users

---

## System Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE LAYER                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Web App    │ │  Mobile     │ │  Embed      │ │  API (future partners)  ││
│  │  (React)    │ │  (PWA)      │ │  Widget     │ │                         ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONVERSATION ENGINE LAYER                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Context Manager │ Session State │ Memory │ UI State Controller        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AGENT ORCHESTRATION LAYER                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐│
│  │  Orchestrator │  │    Agent      │  │   Pipeline    │  │     SIA        ││
│  │               │──│   Registry    │──│   Manager     │──│   (Self-       ││
│  │               │  │               │  │               │  │   Improvement) ││
│  └───────────────┘  └───────────────┘  └───────────────┘  └────────────────┘│
│         │                  │                  │                    │         │
│  ┌──────┴──────────────────┴──────────────────┴────────────────────┴───────┐│
│  │ Specialized Agents: Ideation │ Spec │ Build │ Test │ Network │ Support ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BUILD PIPELINE LAYER                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Code Generator │ Test Runner │ Deployment Engine │ App Manager          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       HOSTING & RUNTIME LAYER                                │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐│
│  │   App Host    │  │   Database    │  │   CDN         │  │  Vibe Wrapper  ││
│  │   (per-app)   │  │   (per-app)   │  │   (shared)    │  │  (injected)    ││
│  └───────────────┘  └───────────────┘  └───────────────┘  └────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐│
│  │   User DB     │  │   Idea DB     │  │   Agent DB    │  │   App Data DB  ││
│  │   (Postgres)  │  │   (Postgres)  │  │   (Postgres)  │  │   (per-tenant) ││
│  └───────────────┘  └───────────────┘  └───────────────┘  └────────────────┘│
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────────────┐│
│  │  Vector Store │  │  File Storage │  │  Analytics Warehouse (ClickHouse) ││
│  │  (Pinecone)   │  │  (S3/R2)      │  │                                   ││
│  └───────────────┘  └───────────────┘  └───────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Details

### 1. User Interface Layer

**Purpose:** All user touchpoints

| Component        | Technology                | Purpose                                           |
| ---------------- | ------------------------- | ------------------------------------------------- |
| **Web App**      | React + TypeScript        | Primary interface for ideation, build, management |
| **Mobile (PWA)** | Same codebase, responsive | Access on mobile devices                          |
| **Embed Widget** | Lightweight JS            | Embeddable ideation widget for partners (future)  |
| **API**          | REST + WebSocket          | Third-party integrations (future)                 |

**Key Features:**

- Adaptive UI that evolves with user journey (full-screen chat → dashboard)
- Real-time updates via WebSocket
- Offline-capable for basic browsing
- Accessibility (WCAG 2.1 AA)

---

### 2. Conversation Engine Layer

**Purpose:** Manage all conversational state and context

| Component               | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| **Context Manager**     | Tracks conversation history, extracts key information    |
| **Session State**       | Maintains current session data across page refreshes     |
| **Memory**              | Long-term storage of user preferences, past interactions |
| **UI State Controller** | Coordinates UI changes based on conversation phase       |

**Data Flow:**

```
User Input
    │
    ▼
┌──────────────────┐
│ Context Manager  │◄──── Previous context, user profile
│                  │
│ • Parse input    │
│ • Enrich context │
│ • Route to agent │
└────────┬─────────┘
         │
         ▼
    Agent Layer
```

---

### 3. Agent Orchestration Layer

**Purpose:** Coordinate all AI agent activities

See [autonomous-agent-system.md](./autonomous-agent-system.md) for detailed documentation.

| Component            | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| **Orchestrator**     | Routes requests, creates agents, manages flow        |
| **Agent Registry**   | Catalog of all agent types and their capabilities    |
| **Pipeline Manager** | Creates and monitors task workflows with stage gates |
| **SIA**              | Self-Improvement Agent for build loop optimization   |

**Agent Communication:**

```
                    ┌─────────────────┐
                    │   Orchestrator  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   ┌───────────┐      ┌───────────┐       ┌───────────┐
   │ Ideation  │      │   Build   │       │  Network  │
   │   Agent   │      │   Agent   │       │   Agent   │
   └─────┬─────┘      └─────┬─────┘       └───────────┘
         │                  │
         ▼                  ▼
   ┌───────────┐      ┌───────────┐
   │   Spec    │      │    SIA    │
   │   Agent   │      │           │
   └───────────┘      └───────────┘
```

**Key Design Decisions:**

- Agents don't communicate directly; they work off shared pipelines
- Each agent leaves transcripts for handoff continuity
- Orchestrator is the only component that spawns new agents

---

### 4. Build Pipeline Layer

**Purpose:** Transform specifications into running apps

| Component             | Purpose                               |
| --------------------- | ------------------------------------- |
| **Code Generator**    | AI-powered code synthesis from specs  |
| **Test Runner**       | Automated testing of generated code   |
| **Deployment Engine** | Package and deploy apps to hosting    |
| **App Manager**       | Lifecycle management of deployed apps |

**Build Flow:**

```
Specification
     │
     ▼
┌────────────────┐
│ Code Generator │
│                │──► Generated Code (Git repo)
│ • Template     │
│ • Generate     │
│ • Iterate      │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  Test Runner   │
│                │──► Test Results
│ • Unit tests   │
│ • E2E tests    │
│ • Lint/format  │
└───────┬────────┘
        │
        ▼ (if tests pass)
┌────────────────┐
│   Deployment   │
│    Engine      │──► Running App
│                │
│ • Build        │
│ • Deploy       │
│ • Configure    │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  App Manager   │
│                │
│ • Monitor      │
│ • Scale        │
│ • Update       │
└────────────────┘
```

---

### 5. Hosting & Runtime Layer

**Purpose:** Run user apps in isolated, managed environments

| Component        | Technology                      | Purpose                                 |
| ---------------- | ------------------------------- | --------------------------------------- |
| **App Host**     | Docker containers on Kubernetes | Isolated app runtime                    |
| **Database**     | Managed Postgres (per-app)      | App data storage                        |
| **CDN**          | Cloudflare                      | Static asset delivery                   |
| **Vibe Wrapper** | Injected JS                     | Analytics, branding, cross-app features |

**Isolation Model:**

```
┌─────────────────────────────────────────────────┐
│              Vibe Platform Cluster               │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  App A   │  │  App B   │  │  App C   │     │
│  │          │  │          │  │          │     │
│  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │     │
│  │ │ DB A │ │  │ │ DB B │ │  │ │ DB C │ │     │
│  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │           Shared Infrastructure          │   │
│  │  • CDN  • Load Balancer  • Monitoring   │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Per-App Resources:**

- Dedicated container
- Dedicated database
- Configurable CPU/memory limits
- Custom domain support

---

### 6. Data Layer

**Purpose:** Persistent storage for all platform data

| Database                | Technology                | Purpose                                   |
| ----------------------- | ------------------------- | ----------------------------------------- |
| **User DB**             | PostgreSQL                | User accounts, profiles, preferences      |
| **Idea DB**             | PostgreSQL                | Ideas, specifications, collaboration data |
| **Agent DB**            | PostgreSQL                | Agent registry, transcripts, SIA memory   |
| **App Data DB**         | PostgreSQL (multi-tenant) | User app data (isolated per app)          |
| **Vector Store**        | Pinecone/Qdrant           | Semantic search for network matching      |
| **File Storage**        | S3/Cloudflare R2          | User uploads, generated assets            |
| **Analytics Warehouse** | ClickHouse                | Event data, metrics, analytics            |

---

## Database Schema (Core Tables)

### Users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    profile JSONB,  -- passions, skills, constraints
    credits_balance INTEGER DEFAULT 0,
    subscription_tier VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Ideas

```sql
CREATE TABLE ideas (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(255),
    status VARCHAR(50),  -- ideation, specification, building, live
    summary TEXT,
    full_context JSONB,  -- all ideation data
    specifications JSONB,
    visibility VARCHAR(50),  -- private, collaborators, public
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE idea_collaborators (
    idea_id UUID REFERENCES ideas(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(50),  -- owner, collaborator, viewer
    permissions JSONB,
    invited_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (idea_id, user_id)
);
```

### Agent Sessions

```sql
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    idea_id UUID REFERENCES ideas(id),
    agent_type VARCHAR(100),
    status VARCHAR(50),
    transcript JSONB,
    credits_consumed INTEGER,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

CREATE TABLE agent_registry (
    id UUID PRIMARY KEY,
    agent_type VARCHAR(100) UNIQUE,
    version VARCHAR(20),
    system_instructions TEXT,
    configuration JSONB,
    track_record JSONB,
    status VARCHAR(50),  -- active, deprecated, testing
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Apps

```sql
CREATE TABLE apps (
    id UUID PRIMARY KEY,
    idea_id UUID REFERENCES ideas(id),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255),
    status VARCHAR(50),  -- building, deployed, paused
    url VARCHAR(255),
    hosting_config JSONB,
    features_enabled JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    deployed_at TIMESTAMP
);
```

---

## API Architecture

### REST Endpoints

| Endpoint                     | Method             | Purpose                                |
| ---------------------------- | ------------------ | -------------------------------------- |
| `/api/auth/*`                | POST               | Authentication (signup, login, logout) |
| `/api/users/me`              | GET, PATCH         | User profile                           |
| `/api/ideas`                 | GET, POST          | List/create ideas                      |
| `/api/ideas/:id`             | GET, PATCH, DELETE | Idea CRUD                              |
| `/api/ideas/:id/collaborate` | POST               | Invite collaborators                   |
| `/api/sessions`              | POST               | Start agent session                    |
| `/api/sessions/:id/message`  | POST               | Send message to agent                  |
| `/api/apps`                  | GET                | List user's apps                       |
| `/api/apps/:id`              | GET, PATCH         | App management                         |
| `/api/credits`               | GET, POST          | Credit balance, purchase               |

### WebSocket Events

| Event             | Direction       | Purpose                       |
| ----------------- | --------------- | ----------------------------- |
| `agent:message`   | Server → Client | Agent response                |
| `agent:thinking`  | Server → Client | Agent is processing           |
| `agent:tool_call` | Server → Client | Agent using a tool            |
| `build:progress`  | Server → Client | Build status updates          |
| `app:status`      | Server → Client | App runtime status            |
| `notification`    | Server → Client | Network opportunities, alerts |

---

## Infrastructure

### Production Environment

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐  │
│  │   CDN    │  │   WAF    │  │      DNS + Load Balancing    │  │
│  └──────────┘  └──────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Primary Region (Sydney)                       │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Kubernetes Cluster                         │  │
│  │                                                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│  │
│  │  │  Platform   │  │   Agent     │  │   User App Pods     ││  │
│  │  │  Services   │  │  Workers    │  │   (auto-scaled)     ││  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘│  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Postgres   │  │   Redis     │  │      Blob Storage       │  │
│  │  (RDS)      │  │  (Cache)    │  │      (S3/R2)            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Recommendations

| Component               | Recommended Technology    | Why                             |
| ----------------------- | ------------------------- | ------------------------------- |
| **Frontend**            | Next.js (React)           | SSR, great DX, Vercel ecosystem |
| **API**                 | Node.js + Hono or tRPC    | Type safety, fast               |
| **Database**            | Supabase or PlanetScale   | Managed Postgres, scales well   |
| **Cache**               | Upstash Redis             | Serverless-friendly             |
| **Queue**               | Inngest or Trigger.dev    | Background jobs for agents      |
| **AI**                  | Anthropic Claude + OpenAI | Best models, fallback options   |
| **Hosting (Platform)**  | Vercel                    | Great for Next.js               |
| **Hosting (User Apps)** | Railway or Render         | Container-based, scales per-app |
| **Vector DB**           | Pinecone                  | Mature, reliable                |
| **Analytics**           | PostHog                   | Self-hostable, full-featured    |
| **Monitoring**          | Sentry + Datadog          | Error tracking + metrics        |

---

## Security Architecture

### Authentication & Authorization

```
┌─────────────────────────────────────────┐
│           Authentication Flow           │
│                                         │
│  User ──► Magic Link / OAuth ──► JWT   │
│                │                        │
│                ▼                        │
│  ┌─────────────────────────────────────┐│
│  │  JWT contains:                      ││
│  │  • user_id                          ││
│  │  • subscription_tier                ││
│  │  • permissions                      ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### Data Protection

| Data Type             | Protection                                |
| --------------------- | ----------------------------------------- |
| **User credentials**  | bcrypt hashing, secure session management |
| **API keys**          | Encrypted at rest, never logged           |
| **User ideas**        | Encrypted at rest, access-controlled      |
| **App data**          | Tenant isolation, encrypted connections   |
| **Agent transcripts** | Encrypted, auto-deleted after 90 days     |

### App Isolation

```
User App A                    User App B
    │                             │
    │ (isolated network)          │ (isolated network)
    │                             │
    ▼                             ▼
┌───────────┐                ┌───────────┐
│ Container │                │ Container │
│ + DB      │   NO ACCESS    │ + DB      │
│           │ ◄──────────►   │           │
└───────────┘                └───────────┘
```

---

## Scalability Considerations

### Horizontal Scaling

| Component         | Scaling Strategy                          |
| ----------------- | ----------------------------------------- |
| **Platform API**  | Auto-scale pods based on CPU/memory       |
| **Agent Workers** | Queue-based; scale based on queue depth   |
| **User Apps**     | Per-app auto-scaling based on traffic     |
| **Database**      | Read replicas; vertical scaling as needed |

### Vertical Scaling

| Threshold                | Action                                |
| ------------------------ | ------------------------------------- |
| **API latency > 200ms**  | Add pods, optimize queries            |
| **Queue depth > 100**    | Add agent workers                     |
| **DB connections > 80%** | Connection pooling, read replicas     |
| **Storage > 70%**        | Increase allocation, archive old data |

### Cost Optimization

| Strategy               | Implementation                           |
| ---------------------- | ---------------------------------------- |
| **Spot instances**     | Non-critical workers on spot/preemptible |
| **Reserved capacity**  | Reserve baseline infrastructure          |
| **Tiered storage**     | Archive old transcripts to cold storage  |
| **Cache aggressively** | Redis for session data, API responses    |

---

## Integration Points

### AI Providers

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Provider Layer                        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Anthropic  │  │   OpenAI    │  │   Custom Models     │  │
│  │  (Primary)  │  │  (Fallback) │  │   (Fine-tuned)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Unified AI Gateway:                                    ││
│  │  • Load balancing                                       ││
│  │  • Fallback routing                                     ││
│  │  • Cost tracking                                        ││
│  │  • Rate limiting                                        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Payment Processing

| Provider           | Purpose                           |
| ------------------ | --------------------------------- |
| **Stripe**         | Credit purchases, subscriptions   |
| **Stripe Connect** | User app payments (Vibe Payments) |

### External Services

| Service             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| **Resend/Postmark** | Transactional email (invites, notifications) |
| **Twilio**          | Phone notifications (proactive AI calls)     |
| **GitHub**          | Code storage for generated apps              |
| **Sentry**          | Error tracking                               |
| **PostHog**         | Product analytics                            |

---

## Development & Deployment

### Environments

| Environment    | Purpose                    |
| -------------- | -------------------------- |
| **Local**      | Developer machines         |
| **Preview**    | Per-PR preview deployments |
| **Staging**    | Pre-production testing     |
| **Production** | Live user traffic          |

### CI/CD Pipeline

```
Push to GitHub
     │
     ▼
┌──────────────┐
│   CI Tests   │
│  • Unit      │
│  • E2E       │
│  • Lint      │
└──────┬───────┘
       │ (if pass)
       ▼
┌──────────────┐
│ Preview Build│
│              │
│ • Deploy to  │
│   preview    │
│   environment│
└──────┬───────┘
       │ (on merge to main)
       ▼
┌──────────────┐
│ Staging      │
│ Deploy       │
└──────┬───────┘
       │ (manual approval)
       ▼
┌──────────────┐
│ Production   │
│ Deploy       │
│              │
│ • Blue-green │
│ • Rollback   │
│   ready      │
└──────────────┘
```

---

## Monitoring & Observability

### Metrics to Track

| Category     | Metrics                                              |
| ------------ | ---------------------------------------------------- |
| **Business** | DAU, ideas created, apps deployed, revenue           |
| **Platform** | API latency, error rate, uptime                      |
| **Agents**   | Completion rate, escalation rate, credit consumption |
| **Apps**     | Request count, error rate, resource usage per app    |
| **Cost**     | AI API spend, infrastructure cost, revenue per user  |

### Alerting

| Condition                    | Action                  |
| ---------------------------- | ----------------------- |
| **Error rate > 1%**          | Page on-call            |
| **Latency P95 > 1s**         | Alert Slack             |
| **Agent stuck > 10 min**     | Auto-escalate + alert   |
| **Credit consumption spike** | Alert user + admin      |
| **App down > 5 min**         | Alert app owner + admin |

---

## Future Architecture Considerations

### Phase 1 (MVP)

- Monolith for simplicity
- Single region (Sydney)
- Basic agent infrastructure
- Manual deployment

### Phase 2 (Post-MVP)

- Extract critical services (agent orchestration)
- Add Redis caching
- Automated scaling
- Second region (US)

### Phase 3 (Scale)

- Full microservices where needed
- Global edge presence
- Advanced ML pipeline for agent optimization
- Real-time collaboration infrastructure

---

_This architecture is a living document. It will evolve as requirements become clearer and the platform scales._

_Last updated: January 4, 2025_
