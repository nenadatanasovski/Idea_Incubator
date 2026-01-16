---
id: text_1767515459116
title: Vibe Technical Architecture
type: markdown
userSlug: migration-drafts
ideaSlug: draft-afda70d2
sessionId: afda70d2-5ae0-497e-9ab2-8e7596c9da07
createdAt: 2026-01-04 08:30:59
updatedAt: 2026-01-04 08:30:59
---

# Vibe Technical Architecture — High-Level Overview

## System Overview

Vibe is a multi-layer platform that orchestrates AI agents to guide users from idea to live product. This document outlines the technical architecture at a high level.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│  Web App (React) │ Mobile (PWA) │ Notifications │ Email/Phone   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONVERSATION ENGINE                           │
│  Session Manager │ Context Handler │ UI State │ Real-time Sync  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AGENT ORCHESTRATION LAYER                      │
│  Orchestrator │ Agent Registry │ Pipeline Engine │ SIA System   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BUILD PIPELINE LAYER                         │
│  Code Generator │ Ralph Loop │ Testing │ QA │ Deployment        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HOSTING & RUNTIME LAYER                        │
│  App Hosting │ Database │ CDN │ Auto-scaling │ Monitoring       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  User Data │ Ideas │ Agent Memory │ Transcripts │ Analytics     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer Details

### 1. User Layer

| Component         | Purpose                                                          | Technology           |
| ----------------- | ---------------------------------------------------------------- | -------------------- |
| **Web App**       | Primary interface for ideation, build monitoring, app management | React, Next.js       |
| **PWA**           | Mobile access, offline capability                                | Service Workers      |
| **Notifications** | Proactive agent communications                                   | Push API, WebSockets |
| **Email/Phone**   | High-value touchpoints (opportunities, decisions)                | Twilio, SendGrid     |

### 2. Conversation Engine

| Component           | Purpose                                                   | Notes                 |
| ------------------- | --------------------------------------------------------- | --------------------- |
| **Session Manager** | Maintains conversation state across page refreshes        | Redis-backed sessions |
| **Context Handler** | Manages context window, prepares handoffs                 | Tracks token usage    |
| **UI State**        | Determines which UI mode (full chat vs. dashboard + chat) | Phase-aware rendering |
| **Real-time Sync**  | Keeps multiple tabs/devices synchronized                  | WebSocket connections |

### 3. Agent Orchestration Layer

| Component           | Purpose                                              | Notes                    |
| ------------------- | ---------------------------------------------------- | ------------------------ |
| **Orchestrator**    | Routes requests, spawns agents, manages pipelines    | Central brain            |
| **Agent Registry**  | Catalog of all agent types with configs              | JSON/DB backed           |
| **Pipeline Engine** | Creates and monitors task pipelines with stage gates | DAG-based workflows      |
| **SIA System**      | Self-Improvement Agents for build loop optimization  | See SIA Architecture doc |

### 4. Build Pipeline Layer

| Component          | Purpose                                       | Notes                |
| ------------------ | --------------------------------------------- | -------------------- |
| **Code Generator** | Produces application code from specifications | Claude API           |
| **Ralph Loop**     | Iterative build cycle with human-in-the-loop  | Core build mechanism |
| **Testing**        | Automated test generation and execution       | Jest, Playwright     |
| **QA**             | Validates against specifications              | Deterministic checks |
| **Deployment**     | Pushes to hosting, manages releases           | CI/CD pipeline       |

### 5. Hosting & Runtime Layer

| Component        | Purpose                      | Notes                  |
| ---------------- | ---------------------------- | ---------------------- |
| **App Hosting**  | Runs user-built applications | Containerized (Docker) |
| **Database**     | Per-app data storage         | PostgreSQL, managed    |
| **CDN**          | Static asset delivery        | CloudFront/Cloudflare  |
| **Auto-scaling** | Handles traffic spikes       | Kubernetes/ECS         |
| **Monitoring**   | Health checks, alerting      | Datadog/Prometheus     |

### 6. Data Layer

| Data Type        | Purpose                                 | Storage                |
| ---------------- | --------------------------------------- | ---------------------- |
| **User Data**    | Profiles, preferences, credentials      | PostgreSQL (encrypted) |
| **Ideas**        | Idea content, validation status, specs  | PostgreSQL + S3        |
| **Agent Memory** | Transcripts, track records, SIA history | S3 + search index      |
| **Transcripts**  | Complete conversation logs              | S3 (append-only)       |
| **Analytics**    | Aggregated insights, patterns           | ClickHouse/BigQuery    |

---

## Data Flow Diagrams

### Entry Flow (New User)

```
User visits Vibe
       │
       ▼
┌──────────────┐
│ "What makes  │
│ you tick?"   │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  Ideation    │────▶│   Session    │
│   Agent      │     │   Created    │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│  Passion     │
│  Profile     │
│  Building    │
└──────────────┘
```

### Agent Orchestration Flow

```
User Request
       │
       ▼
┌──────────────────────────────────────────┐
│              ORCHESTRATOR                 │
│                                          │
│  1. Parse request intent                 │
│  2. Check pipeline position              │
│  3. Query agent registry                 │
│  4. Route or spawn agent                 │
└──────────────────────────────────────────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Ideation │   │   Spec   │   │  Build   │
│  Agent   │   │  Agent   │   │  Agent   │
└──────────┘   └──────────┘   └──────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────────────────────────────────────┐
│           PIPELINE ENGINE                 │
│  Stage gates │ Pass/fail │ Next step     │
└──────────────────────────────────────────┘
```

### Build Pipeline Flow

```
Specifications Complete
       │
       ▼
┌──────────────┐
│ Build Agent  │◀─────────────────────────┐
│  (Initial)   │                          │
└──────┬───────┘                          │
       │                                   │
       ▼                                   │
┌──────────────┐     ┌──────────────┐     │
│ Code         │────▶│ Test Suite   │     │
│ Generation   │     │ Execution    │     │
└──────────────┘     └──────┬───────┘     │
                            │             │
                     PASS?  │             │
                    ┌───────┴───────┐     │
                    │               │     │
                   YES             NO     │
                    │               │     │
                    ▼               ▼     │
             ┌──────────┐   ┌──────────┐ │
             │ Deploy   │   │   SIA    │─┘
             │ Pipeline │   │ Analysis │
             └──────────┘   └──────────┘
                    │
                    ▼
             ┌──────────┐
             │ Live App │
             └──────────┘
```

---

## Database Schema (Core Tables)

### Users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  profile JSONB,  -- passions, skills, constraints
  credits_balance INTEGER DEFAULT 100,
  subscription_tier VARCHAR(50)
);
```

### Ideas

```sql
CREATE TABLE ideas (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR(255),
  status VARCHAR(50),  -- ideating, specifying, building, live
  created_at TIMESTAMP DEFAULT NOW(),
  content JSONB,  -- structured idea data
  specifications JSONB,
  collaborators UUID[]  -- array of user IDs
);
```

### Agent Sessions

```sql
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY,
  idea_id UUID REFERENCES ideas(id),
  agent_type VARCHAR(50),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  transcript_url VARCHAR(500),  -- S3 reference
  tokens_used INTEGER,
  outcome VARCHAR(50)  -- completed, escalated, handed_off
);
```

### Agent Registry

```sql
CREATE TABLE agent_registry (
  id UUID PRIMARY KEY,
  agent_type VARCHAR(50) UNIQUE NOT NULL,
  version VARCHAR(20),
  system_instructions TEXT,
  configuration JSONB,
  track_record JSONB,
  status VARCHAR(20) DEFAULT 'active'
);
```

### Apps (User-Built)

```sql
CREATE TABLE apps (
  id UUID PRIMARY KEY,
  idea_id UUID REFERENCES ideas(id),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  status VARCHAR(50),  -- building, staging, live, paused
  deployed_at TIMESTAMP,
  hosting_config JSONB,
  monthly_cost DECIMAL(10,2),
  revenue_this_month DECIMAL(10,2)
);
```

---

## API Architecture

### REST Endpoints

| Endpoint                     | Method           | Purpose                                   |
| ---------------------------- | ---------------- | ----------------------------------------- |
| `/api/auth/*`                | POST             | Authentication (login, register, refresh) |
| `/api/ideas`                 | GET, POST        | List/create ideas                         |
| `/api/ideas/:id`             | GET, PUT, DELETE | Manage specific idea                      |
| `/api/ideas/:id/collaborate` | POST             | Invite collaborator                       |
| `/api/chat`                  | POST             | Send message to current agent             |
| `/api/apps`                  | GET              | List user's apps                          |
| `/api/apps/:id/deploy`       | POST             | Trigger deployment                        |
| `/api/credits`               | GET, POST        | Check/purchase credits                    |

### WebSocket Events

| Event                 | Direction     | Purpose                  |
| --------------------- | ------------- | ------------------------ |
| `message`             | Bidirectional | Chat messages            |
| `agent_update`        | Server→Client | Agent status changes     |
| `build_progress`      | Server→Client | Build pipeline updates   |
| `notification`        | Server→Client | Proactive agent outreach |
| `collaborator_joined` | Server→Client | Real-time collaboration  |

---

## Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE                               │
│  DNS │ DDoS Protection │ CDN │ SSL Termination                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER (ALB)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
         ┌──────────┐    ┌──────────┐    ┌──────────┐
         │ Web App  │    │ Web App  │    │ Web App  │
         │ Instance │    │ Instance │    │ Instance │
         └──────────┘    └──────────┘    └──────────┘
                                │
                                ▼
         ┌──────────────────────────────────────────┐
         │           AGENT WORKER POOL              │
         │  (Auto-scaled based on queue depth)      │
         └──────────────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │  PostgreSQL  │    │    Redis     │    │      S3      │
  │  (Primary)   │    │  (Sessions)  │    │ (Transcripts)│
  └──────────────┘    └──────────────┘    └──────────────┘
         │
         ▼
  ┌──────────────┐
  │  PostgreSQL  │
  │  (Replica)   │
  └──────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    USER APP HOSTING                              │
│  Kubernetes Cluster │ Per-App Containers │ Isolated Databases   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Authentication

| Layer             | Method                                   |
| ----------------- | ---------------------------------------- |
| **User Auth**     | JWT tokens, refresh rotation             |
| **API Auth**      | API keys for external integrations       |
| **Agent Auth**    | Service accounts with scoped permissions |
| **Inter-service** | mTLS between internal services           |

### Data Protection

| Data Type            | Protection                         |
| -------------------- | ---------------------------------- |
| **User credentials** | bcrypt hashing, encrypted at rest  |
| **Idea content**     | Encrypted at rest (AES-256)        |
| **Transcripts**      | Encrypted at rest, append-only     |
| **API keys**         | Hashed, never stored in plain text |

### User App Isolation

| Concern               | Solution                              |
| --------------------- | ------------------------------------- |
| **Code isolation**    | Each app runs in isolated container   |
| **Data isolation**    | Separate database per app             |
| **Network isolation** | VPC segmentation, no cross-app access |
| **Resource limits**   | CPU/memory quotas per tier            |

---

## Integration Points

### AI Providers

| Provider               | Use Case                    | Fallback          |
| ---------------------- | --------------------------- | ----------------- |
| **Claude (Anthropic)** | Primary agent intelligence  | OpenAI GPT-4      |
| **OpenAI**             | Code generation, embeddings | Claude            |
| **Together AI**        | Cost-effective inference    | Primary providers |

### External Services

| Service      | Purpose                              |
| ------------ | ------------------------------------ |
| **Stripe**   | User subscriptions, credit purchases |
| **Twilio**   | Phone calls from agents              |
| **SendGrid** | Transactional email                  |
| **Sentry**   | Error tracking                       |
| **Datadog**  | Monitoring & observability           |

### Deployment Targets

| Target           | Method                           |
| ---------------- | -------------------------------- |
| **Vibe Hosting** | Default, managed containers      |
| **PWA**          | Built-in, no external deployment |
| **App Store**    | Automated submission (future)    |
| **Play Store**   | Automated submission (future)    |

---

## Technology Stack (Recommended)

| Layer          | Technology                | Rationale                         |
| -------------- | ------------------------- | --------------------------------- |
| **Frontend**   | Next.js 14+ (React)       | SSR, API routes, excellent DX     |
| **Mobile**     | PWA                       | No app store dependency initially |
| **API**        | Node.js (Express/Fastify) | JavaScript ecosystem, async I/O   |
| **Database**   | PostgreSQL                | Reliable, JSONB support           |
| **Cache**      | Redis                     | Sessions, rate limiting, queues   |
| **Queue**      | BullMQ (Redis-backed)     | Agent task queue                  |
| **Storage**    | S3-compatible             | Transcripts, assets               |
| **Hosting**    | AWS / Railway / Vercel    | Start simple, scale as needed     |
| **Containers** | Docker + Kubernetes       | User app isolation                |
| **CI/CD**      | GitHub Actions            | Integrated with codebase          |

---

## Scalability Considerations

### Horizontal Scaling

| Component         | Scaling Strategy                   |
| ----------------- | ---------------------------------- |
| **Web servers**   | Add instances behind load balancer |
| **Agent workers** | Auto-scale based on queue depth    |
| **Databases**     | Read replicas for queries          |
| **User apps**     | Container orchestration (K8s)      |

### Vertical Scaling

| Component         | When to Scale Up                   |
| ----------------- | ---------------------------------- |
| **Database**      | When write throughput limited      |
| **Agent workers** | When context windows need more RAM |
| **Cache**         | When session data exceeds memory   |

### Cost Optimization

| Strategy              | Implementation                         |
| --------------------- | -------------------------------------- |
| **Spot instances**    | Agent workers (tolerates interruption) |
| **Reserved capacity** | Database, core web servers             |
| **Tiered storage**    | Cold storage for old transcripts       |
| **CDN caching**       | Static assets, common responses        |

---

_This architecture is designed to start simple (single server capable) and scale horizontally as demand grows. Each layer can be evolved independently._

_Last updated: January 4, 2025_
