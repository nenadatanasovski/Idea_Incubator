---
id: subagent_task_1767649551152_1
title: "**sia-loop-architecture.md** - Self-Improvement Agent detailed design"
type: markdown
userSlug: migration-drafts
ideaSlug: draft-afda70d2
sessionId: afda70d2-5ae0-497e-9ab2-8e7596c9da07
createdAt: 2026-01-05 21:49:57
updatedAt: 2026-01-05 21:49:57
---

Now I have a comprehensive understanding of the Vibe platform. Let me create a detailed architecture exploration document that synthesizes and extends what exists, focusing on practical trade-offs and decisions.

---

# Technical Architecture Exploration: Vibe Platform

## System Overview

Vibe is an AI-native platform designed to transform ideas into AI-managed SaaS products through three pillars: **Ideation** (guided exploration), **Building** (AI code generation with Ralph loops), and **Networking** (proactive opportunity matching).

The existing architecture documentation is comprehensive and well-thought-out. This exploration focuses on **practical implementation decisions**, **build vs. buy trade-offs**, and **simplification opportunities** given the founder constraints (15-20 hrs/week, solo + AI, $100K runway).

---

## Core Components Analysis

### 1. Conversation Engine

**Current Design:** Context Manager → Session State → Memory → UI State Controller

**Simplified MVP Approach:**

| Component               | MVP Implementation                       | Why                              |
| ----------------------- | ---------------------------------------- | -------------------------------- |
| **Context Manager**     | Store conversation as JSON in PostgreSQL | Avoid vector DB complexity early |
| **Session State**       | Redis (Upstash) or even localStorage     | Fast, simple, cheap              |
| **Memory**              | PostgreSQL JSONB column on `users` table | One database to manage           |
| **UI State Controller** | React Context/Zustand                    | Client-side state is sufficient  |

**Trade-off:** The existing design shows Vector Store (Pinecone) for semantic search. **Recommendation: Defer until network features are built.** For MVP, keyword matching and structured data queries are sufficient.

---

### 2. Agent Orchestration

**The Current Design is Sophisticated** — Orchestrator, Registry, Pipeline Manager, SIA. This is the core differentiator but also the highest complexity risk.

**Phased Implementation:**

| Phase        | What to Build                                                     | What to Skip                          |
| ------------ | ----------------------------------------------------------------- | ------------------------------------- |
| **MVP**      | Single orchestrator function that routes to hardcoded agent types | Dynamic agent creation, full registry |
| **Post-MVP** | Agent registry in database, versioned prompts                     | Dynamic spawning                      |
| **Scale**    | Full autonomous agent creation, SIA improving all agents          | —                                     |

**Practical Orchestrator (MVP):**

```typescript
// Simplified orchestrator - no registry, just routing
async function orchestrate(request: UserRequest): Promise<AgentResponse> {
  const agentType = classifyRequest(request); // Simple classifier

  switch (agentType) {
    case "ideation":
      return await ideationAgent(request);
    case "specification":
      return await specAgent(request);
    case "build":
      return await buildAgent(request);
    default:
      return await fallbackAgent(request);
  }
}
```

**Why This Works:** You don't need dynamic agent spawning until you've validated the core experience. Hard-coded agents with good prompts will serve 95% of use cases initially.

---

### 3. Build Pipeline

**Current Design:** Code Generator → Test Runner → Deployment Engine → App Manager

**This is the highest-risk component.** AI code generation is improving rapidly, but reliability varies.

**Build Strategy:**

| Approach                   | Pros                        | Cons          | Recommendation  |
| -------------------------- | --------------------------- | ------------- | --------------- |
| **Claude Code / Aider**    | Proven, actively maintained | Less control  | **Use for MVP** |
| **Custom with Claude API** | Full control, integrated    | Time to build | Post-MVP        |
| **Bolt.new approach**      | Fast, open source           | Inconsistent  | Don't reinvent  |

**Recommended Build Flow (MVP):**

```
User Spec → Claude Code Session → Git Repo → Vercel/Railway Auto-Deploy
```

**Key Insight:** Don't build a code generator — **orchestrate existing tools**. Claude Code + Git + Vercel gives you 80% of the functionality with 10% of the effort.

---

### 4. Hosting & Runtime

**Current Design:** Docker containers on Kubernetes with per-app databases

**This is over-engineered for MVP.** A solo founder shouldn't be managing Kubernetes.

**MVP Hosting Options:**

| Provider    | Complexity | Cost (10 apps) | Auto-Scale | Best For       |
| ----------- | ---------- | -------------- | ---------- | -------------- |
| **Railway** | Low        | ~$50/mo        | Yes        | Container apps |
| **Render**  | Low        | ~$70/mo        | Yes        | Full-stack     |
| **Fly.io**  | Medium     | ~$30/mo        | Yes        | Global edge    |
| **Vercel**  | Very Low   | Free-$40/mo    | Yes        | Next.js apps   |

**Recommendation: Start with Railway or Render.** They handle:

- Per-app isolation
- Database provisioning
- Auto-scaling
- SSL/domains
- Zero DevOps required

**Defer Kubernetes until:** >100 apps and specific scaling/cost needs.

---

## Data Flow Analysis

### Ideation → Build Flow (Simplified)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. ENTRY                                                            │
│     User: "What makes you tick?" conversation                        │
│     Data: Stored as conversation_log in ideas table                  │
│                                                                      │
│  2. IDEATION                                                         │
│     AI: Extracts passions, skills, frustrations, constraints         │
│     Data: Structured JSON in ideas.full_context                      │
│                                                                      │
│  3. SPECIFICATION                                                    │
│     AI: "Let's define what we're building"                           │
│     Data: ideas.specifications (features, user flows, requirements)  │
│                                                                      │
│  4. BUILD                                                            │
│     AI: Generate code via Claude Code session                        │
│     Data: Git repo URL, deployment URL in apps table                 │
│                                                                      │
│  5. ITERATE (Ralph Loop)                                             │
│     Human: Reviews, provides feedback                                │
│     AI: Incorporates changes, re-deploys                             │
│     Data: Conversation + git commits preserve history                │
│                                                                      │
│  6. LIVE                                                             │
│     App running on managed hosting                                   │
│     Data: App metrics, user data in per-app database                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Persistence Strategy

| Data Type             | Storage                | Retention     | Why                            |
| --------------------- | ---------------------- | ------------- | ------------------------------ |
| **Conversations**     | PostgreSQL (JSONB)     | Forever       | Core asset, enables resumption |
| **User Profiles**     | PostgreSQL             | Forever       | Personalization                |
| **Specifications**    | PostgreSQL (JSONB)     | Forever       | Build instructions             |
| **Generated Code**    | GitHub (private repos) | Forever       | Version control is free        |
| **App Runtime Data**  | Per-app Postgres       | User controls | Tenant isolation               |
| **Agent Transcripts** | PostgreSQL             | 90 days       | Debugging, SIA learning        |
| **Analytics Events**  | PostHog                | 12 months     | Product insights               |

---

## Technology Considerations

### Recommended Stack (MVP)

| Layer                   | Technology                | Why                                   | Monthly Cost |
| ----------------------- | ------------------------- | ------------------------------------- | ------------ |
| **Frontend**            | Next.js 15 + TailwindCSS  | Fast, good DX, Vercel native          | $0-20        |
| **API**                 | Next.js API Routes + tRPC | Type-safe, minimal setup              | Included     |
| **Database**            | Supabase (Postgres)       | Managed, has auth, generous free tier | $0-25        |
| **Cache**               | Upstash Redis             | Serverless Redis, simple              | $0-10        |
| **AI**                  | Anthropic Claude API      | Best for coding tasks                 | $50-150      |
| **Hosting (Platform)**  | Vercel                    | Zero-config for Next.js               | $0-20        |
| **Hosting (User Apps)** | Railway                   | Simple container deployment           | $5-50        |
| **Email**               | Resend                    | Modern, good DX                       | $0-20        |
| **Payments**            | Stripe                    | Industry standard                     | % of revenue |
| **Analytics**           | PostHog                   | Self-hostable, feature flags          | $0           |
| **Error Tracking**      | Sentry                    | Standard, good Next.js support        | $0-29        |

**Estimated MVP Monthly Cost: $55-350 AUD** depending on usage

### Build vs. Buy Decisions

| Capability           | Build           | Buy/Use                          | Recommendation                            |
| -------------------- | --------------- | -------------------------------- | ----------------------------------------- |
| **Auth**             | Custom JWT      | Supabase Auth, Clerk, or Auth.js | **Buy** — Auth is solved                  |
| **AI Orchestration** | Custom function | LangChain, Vercel AI SDK         | **Build simple** — Over-abstraction hurts |
| **Code Generation**  | Custom prompts  | Claude Code, Cursor, Aider       | **Buy/Wrap** — Use Claude Code            |
| **App Hosting**      | Kubernetes      | Railway, Render                  | **Buy** — Zero DevOps burden              |
| **Payments**         | —               | Stripe                           | **Buy** — Never build payments            |
| **Real-time**        | WebSockets      | Supabase Realtime, Pusher        | **Buy** — Managed is easier               |
| **Vector Search**    | Build           | Pinecone, Supabase pgvector      | **Defer** — Not needed MVP                |

---

## Integration Points

### External Systems

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VIBE INTEGRATION MAP                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  AI PROVIDERS                                                        │
│  ┌─────────────┐  ┌─────────────┐                                   │
│  │  Anthropic  │  │   OpenAI    │  ← Fallback provider               │
│  │  (Primary)  │  │             │                                    │
│  └─────────────┘  └─────────────┘                                   │
│                                                                      │
│  INFRASTRUCTURE                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  Supabase   │  │   Railway   │  │   GitHub    │                  │
│  │  (DB/Auth)  │  │  (Apps)     │  │  (Code)     │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                      │
│  SERVICES                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Stripe    │  │   Resend    │  │  PostHog    │                  │
│  │  (Payments) │  │  (Email)    │  │ (Analytics) │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                      │
│  FUTURE (Post-MVP)                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Twilio    │  │  Pinecone   │  │ Cloudflare  │                  │
│  │  (Comms)    │  │  (Vector)   │  │  (CDN/WAF)  │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### API Design (MVP)

Keep it simple. REST for basic CRUD, WebSocket for real-time agent responses.

| Endpoint                | Method     | Purpose               |
| ----------------------- | ---------- | --------------------- |
| `/api/auth/*`           | Various    | Supabase handles this |
| `/api/ideas`            | GET, POST  | List/create ideas     |
| `/api/ideas/[id]`       | GET, PATCH | Get/update idea       |
| `/api/ideas/[id]/chat`  | POST       | Send message to agent |
| `/api/apps`             | GET        | List user's apps      |
| `/api/apps/[id]/deploy` | POST       | Trigger deployment    |
| `/api/credits`          | GET        | Check credit balance  |

**WebSocket:** Single connection for all real-time updates (agent messages, build progress, notifications).

---

## Security Considerations

### Authentication & Authorization

| Concern                | MVP Solution                       | Why                       |
| ---------------------- | ---------------------------------- | ------------------------- |
| **User Auth**          | Supabase Auth (magic link + OAuth) | Handled, secure, easy     |
| **API Auth**           | Supabase JWT validation            | Built-in                  |
| **Row-Level Security** | Supabase RLS policies              | Users only see their data |
| **App Isolation**      | Separate Railway projects per app  | Physical separation       |

### Data Protection Checklist

- [ ] All connections over HTTPS
- [ ] API keys in environment variables (never in code)
- [ ] User data encrypted at rest (Supabase default)
- [ ] No secrets in git history
- [ ] Rate limiting on AI endpoints (prevent abuse)
- [ ] Credit limits prevent runaway costs

### User App Isolation

```
User A's App                    User B's App
    │                               │
    ▼                               ▼
┌───────────┐                 ┌───────────┐
│ Railway   │    NO ACCESS    │ Railway   │
│ Project A │ ◄────────────► │ Project B │
├───────────┤                 ├───────────┤
│ App A     │                 │ App B     │
│ DB A      │                 │ DB B      │
│ Env A     │                 │ Env B     │
└───────────┘                 └───────────┘
```

Railway projects are completely isolated by default. This is simpler and more secure than trying to share infrastructure.

---

## Evolution Path

### Phase 1: MVP (Days 1-90)

**Architecture: Monolith**

```
┌─────────────────────────────────────────┐
│            NEXT.JS APPLICATION           │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Pages   │  │  API     │  │ Agent  │ │
│  │  (UI)    │  │ Routes   │  │ Logic  │ │
│  └──────────┘  └──────────┘  └────────┘ │
│                                          │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│             SUPABASE                     │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Postgres │  │   Auth   │  │ Storage│ │
│  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────┘
```

**What's included:**

- Single Next.js app (UI + API)
- Supabase for data + auth
- Hardcoded agents (Ideation, Spec, Build)
- Manual deployment to Railway
- Basic credit tracking

**What's deferred:**

- Agent registry
- SIA
- Testing agents
- Network features
- Vector search

### Phase 2: Post-MVP (Days 91-180)

**Architecture: Monolith + Background Jobs**

```
┌────────────────────────────────────────────────────────────────┐
│                     NEXT.JS APPLICATION                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │   Pages    │  │    API     │  │   Agent    │  │  Admin   │  │
│  │   (UI)     │  │  Routes    │  │   Logic    │  │  Panel   │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
└────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────────┐   ┌──────────┐
    │ Supabase │    │   Inngest    │   │ Railway  │
    │          │    │ (Background  │   │ (User    │
    │          │    │    Jobs)     │   │   Apps)  │
    └──────────┘    └──────────────┘   └──────────┘
```

**New capabilities:**

- Agent registry in database
- Background job processing (builds, notifications)
- SIA v1 (build loop only)
- Automated deployment pipeline
- Credit purchase flow
- Basic admin dashboard

### Phase 3: Scale (6-12 months)

**Architecture: Services where needed**

```
┌──────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE                               │
│     CDN  │  WAF  │  DNS  │  DDoS Protection                          │
└────────────────────────────────────────────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
      ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
      │   PLATFORM   │    │    AGENT     │    │   NETWORK    │
      │   SERVICE    │    │   SERVICE    │    │   SERVICE    │
      │ (Next.js)    │    │  (Separate)  │    │  (Matching)  │
      └──────────────┘    └──────────────┘    └──────────────┘
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   ▼
                          ┌──────────────┐
                          │   SUPABASE   │
                          │  + Pinecone  │
                          └──────────────┘
```

**New capabilities:**

- Agent service extracted (for scale/isolation)
- Network matching with vector search
- Testing agent system running continuously
- Full SIA across all agent types
- Multi-region if needed
- Self-serve admin for users

---

## Critical Implementation Decisions

### Decision 1: Tech Stack Coherence

**Recommendation: Go all-in on the Supabase ecosystem for MVP.**

- **Auth:** Supabase Auth
- **Database:** Supabase Postgres
- **Real-time:** Supabase Realtime (instead of separate WebSocket server)
- **Storage:** Supabase Storage (for generated assets)
- **Edge Functions:** If needed for custom logic

**Why:** One SDK, one dashboard, coherent mental model. Reduces cognitive overhead for a solo founder.

### Decision 2: Code Generation Approach

**Recommendation: Don't build a code generator. Orchestrate Claude Code.**

```
User Spec Document
       │
       ▼
┌─────────────────────────────────────────────┐
│  VIBE BUILD ORCHESTRATOR                     │
│                                              │
│  1. Create private GitHub repo               │
│  2. Initialize with template (Next.js/etc)  │
│  3. Generate CLAUDE.md with spec context    │
│  4. Spin up Claude Code session             │
│  5. Issue build commands via CLI            │
│  6. Monitor progress, handle errors         │
│  7. On success, trigger Railway deployment  │
│                                              │
└─────────────────────────────────────────────┘
       │
       ▼
Running App on Railway
```

**Why:** Claude Code is actively improved by Anthropic. Fighting that is a losing battle. Wrap and orchestrate instead.

### Decision 3: User App Database Strategy

**Option A: Shared multi-tenant database**

- Pros: Cheaper, easier to manage
- Cons: Risk of data leaks, complex RLS, scaling issues

**Option B: Per-app database (Railway default)**

- Pros: Complete isolation, simple mental model, can offer to users
- Cons: More expensive at scale, more to manage

**Recommendation: Option B (per-app database) via Railway.**

Railway automatically provisions a database per project. The isolation is worth the cost. If a user's app gets hacked, only their data is at risk.

### Decision 4: Credit System Architecture

**Simple approach for MVP:**

```sql
-- In users table
credits_balance INTEGER DEFAULT 100  -- New users get 100 free credits

-- Credit transactions table
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  amount INTEGER,  -- Positive = add, Negative = consume
  reason TEXT,     -- 'ideation_session', 'build_minute', 'purchase'
  session_id UUID, -- Link to what consumed it
  created_at TIMESTAMP DEFAULT NOW()
);

-- Simple function to check balance
CREATE FUNCTION get_credit_balance(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM credit_transactions
  WHERE user_id = user_uuid;
$$ LANGUAGE SQL;
```

**Credit costs (MVP estimate):**
| Action | Credits |
|--------|---------|
| Ideation message | 1 |
| Spec extraction | 5 |
| Build minute | 10 |
| Deployment | 5 |

**Pricing (example):**

- Free tier: 100 credits
- $10 pack: 500 credits
- $25 pack: 1500 credits

---

## Risk Mitigation

### Technical Risks

| Risk                     | Likelihood | Impact | Mitigation                                           |
| ------------------------ | ---------- | ------ | ---------------------------------------------------- |
| **AI API costs explode** | Medium     | High   | Credit limits, caching, fallback to smaller models   |
| **Claude Code breaks**   | Low        | High   | Maintain ability to switch to manual prompts         |
| **Supabase outage**      | Low        | High   | Regular backups, can migrate to self-hosted Postgres |
| **Railway limits hit**   | Medium     | Medium | Have Render as backup, user apps are portable        |

### Business Risks

| Risk                            | Likelihood | Impact   | Mitigation                                  |
| ------------------------------- | ---------- | -------- | ------------------------------------------- |
| **No users come**               | Medium     | Critical | Build in public, get feedback early         |
| **Users can't complete builds** | High       | High     | Start simple (CRUD apps), expand capability |
| **Credit system confusing**     | Medium     | Medium   | Clear pricing page, usage dashboard         |

---

## Immediate Next Steps

Based on the action plan and this architecture exploration:

### Week 1-2 Actions

1. **Set up Supabase project**
   - Create database schema (users, ideas, apps, credit_transactions)
   - Configure Auth (magic link + Google OAuth)
   - Set up RLS policies

2. **Initialize Next.js project**
   - TypeScript + TailwindCSS
   - tRPC for type-safe API
   - Supabase client integration

3. **Build ideation agent (v1)**
   - Single prompt-based agent
   - Conversation stored in `ideas.conversation_log`
   - Basic UI: full-screen chat

4. **No infrastructure yet**
   - Run locally
   - Deploy to Vercel for testing
   - Skip Railway until build phase

### What NOT to Build Yet

- Agent registry
- SIA
- Vector search
- Background jobs
- Admin panel
- Mobile app

---

## Summary

The existing architecture documentation is thoughtful and ambitious. This exploration argues for **aggressive simplification for MVP** while maintaining the path to the full vision:

1. **Use managed services** — Supabase, Railway, Vercel. Zero DevOps.
2. **Wrap, don't build** — Claude Code for generation, Railway for hosting.
3. **Monolith first** — Extract services only when proven necessary.
4. **Defer complexity** — SIA, agent registry, vector search are post-MVP.
5. **Validate fast** — Get to "idea → working app" in 90 days.

The technical architecture should serve the business goal: **prove that non-technical users can go from idea to app through AI-guided conversation.** Everything else is optimization.
