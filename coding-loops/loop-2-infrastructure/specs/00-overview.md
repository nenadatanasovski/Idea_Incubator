# Loop 2: Infrastructure - Overview

**Purpose:** Build foundational infrastructure: Auth → Credits → Hosting
**Priority:** HIGH (blocks external launch)
**Estimated Duration:** 4-6 weeks
**Review Frequency:** Every 2-3 days

---

## Stream Overview

This loop builds the infrastructure required for external users and monetization.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Phase 1: Auth  │────▶│ Phase 2: Credits│────▶│ Phase 3: Hosting│
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     1-2 weeks              2-3 weeks              2-3 weeks
```

---

## Phase 1: Authentication & User Management

**Status:** NOT STARTED
**Priority:** CRITICAL - Blocks everything multi-user

### Current State Analysis

**What Exists:**
- `user_profiles` table (for Personal Fit evaluation context)
- `user_slug` columns in `ideation_sessions` and `ideation_artifacts`
- `users/` folder structure utilities
- File-based user identification (slug only, no auth)

**What's Missing:**
- No password authentication
- No session tokens
- No OAuth/SSO
- No login/logout endpoints
- No user registration
- No password reset
- No email verification

### Gap Analysis

#### Database (Gaps)

| Table | Status | Schema |
|-------|--------|--------|
| `users` | MISSING | Core user table |
| `user_sessions` | MISSING | Auth session tokens |
| `password_reset_tokens` | MISSING | Password reset |
| `oauth_connections` | MISSING | OAuth provider links |

**Proposed `users` table:**
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash TEXT,  -- NULL if OAuth only
    display_name TEXT,
    avatar_url TEXT,
    user_slug TEXT UNIQUE NOT NULL,  -- Links to folder structure
    profile_id TEXT REFERENCES user_profiles(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME
);

CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT
);
```

#### API Endpoints (Gaps)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/api/auth/register` | POST | Create account | P0 |
| `/api/auth/login` | POST | Email/password login | P0 |
| `/api/auth/logout` | POST | End session | P0 |
| `/api/auth/me` | GET | Get current user | P0 |
| `/api/auth/refresh` | POST | Refresh token | P1 |
| `/api/auth/forgot-password` | POST | Request reset | P1 |
| `/api/auth/reset-password` | POST | Execute reset | P1 |
| `/api/auth/verify-email` | POST | Verify email | P2 |
| `/api/auth/oauth/google` | GET | Google OAuth start | P2 |
| `/api/auth/oauth/google/callback` | GET | Google OAuth callback | P2 |

#### Backend Logic (Gaps)

| Component | Status | Purpose |
|-----------|--------|---------|
| `server/middleware/auth.ts` | MISSING | Auth middleware |
| `server/routes/auth.ts` | MISSING | Auth endpoints |
| `utils/password.ts` | MISSING | Password hashing (bcrypt/argon2) |
| `utils/jwt.ts` | MISSING | JWT token handling |
| `utils/email.ts` | MISSING | Email sending (Resend/SendGrid) |

#### Frontend (Gaps)

| Component | Status | Purpose |
|-----------|--------|---------|
| `pages/Login.tsx` | MISSING | Login form |
| `pages/Register.tsx` | MISSING | Registration form |
| `pages/ForgotPassword.tsx` | MISSING | Password reset request |
| `pages/ResetPassword.tsx` | MISSING | Password reset form |
| `components/AuthProvider.tsx` | MISSING | Auth context |
| `hooks/useAuth.ts` | MISSING | Auth hook |
| `components/ProtectedRoute.tsx` | MISSING | Route protection |

### Key Deliverables
1. User registration with email/password
2. Login/logout flow
3. Session management with tokens
4. Auth middleware for protected routes
5. User slug auto-creation on registration

---

## Phase 2: Credit System

**Status:** NOT STARTED
**Depends On:** Auth (users must exist)

### Current State Analysis

**What Exists:**
- `cost_log` table (tracks API costs per evaluation)
- Cost tracking utilities for Claude API calls
- Budget parameter for evaluations

**What's Missing:**
- User credit balance
- Credit purchase flow
- Credit consumption tracking per action
- Free tier management
- Stripe integration

### Gap Analysis

#### Database (Gaps)

| Table | Status | Schema |
|-------|--------|--------|
| `credit_balances` | MISSING | User credit balance |
| `credit_transactions` | MISSING | Credit history |
| `credit_packages` | MISSING | Purchasable packages |
| `subscriptions` | MISSING | Subscription tiers |

**Proposed `credit_balances` table:**
```sql
CREATE TABLE credit_balances (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    balance INTEGER NOT NULL DEFAULT 0,
    lifetime_purchased INTEGER DEFAULT 0,
    lifetime_consumed INTEGER DEFAULT 0,
    free_tier_used INTEGER DEFAULT 0,
    free_tier_limit INTEGER DEFAULT 100,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    amount INTEGER NOT NULL,  -- Positive = add, Negative = consume
    balance_after INTEGER NOT NULL,
    transaction_type TEXT CHECK(type IN (
        'purchase', 'consume', 'refund', 'bonus', 'free_tier'
    )),
    action_type TEXT,  -- 'ideation_message', 'web_search', 'build_iteration', etc.
    reference_id TEXT,  -- Session/build ID
    stripe_payment_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### API Endpoints (Gaps)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/api/credits/balance` | GET | Get user balance | P0 |
| `/api/credits/consume` | POST | Consume credits (internal) | P0 |
| `/api/credits/history` | GET | Transaction history | P1 |
| `/api/credits/packages` | GET | Available packages | P1 |
| `/api/credits/purchase` | POST | Create Stripe session | P1 |
| `/api/credits/webhook` | POST | Stripe webhook | P1 |
| `/api/subscription/status` | GET | Subscription status | P2 |
| `/api/subscription/upgrade` | POST | Change tier | P2 |

#### Backend Logic (Gaps)

| Component | Status | Purpose |
|-----------|--------|---------|
| `server/routes/credits.ts` | MISSING | Credit endpoints |
| `utils/stripe.ts` | MISSING | Stripe integration |
| `utils/credit-manager.ts` | MISSING | Credit operations |
| `server/middleware/credits.ts` | MISSING | Credit check middleware |

#### Frontend (Gaps)

| Component | Status | Purpose |
|-----------|--------|---------|
| `components/CreditBalance.tsx` | MISSING | Balance display |
| `pages/Credits.tsx` | MISSING | Purchase page |
| `components/CreditUsageAlert.tsx` | MISSING | Low balance warning |
| `components/PricingTable.tsx` | MISSING | Package options |

### Credit Costs (Proposed)

| Action | Credits | Notes |
|--------|---------|-------|
| Ideation message | 1 | Basic interaction |
| Web search | 2 | External API cost |
| Build iteration | 5-10 | Based on complexity |
| App hosting (daily) | 1 | Ongoing cost |
| SIA intervention | 3 | Meta-agent cost |

### Key Deliverables
1. Credit balance tracking per user
2. Credit consumption on each action
3. Stripe checkout for credit purchase
4. Free tier with limits
5. Low balance warnings

---

## Phase 3: Hosting Infrastructure

**Status:** NOT STARTED
**Depends On:** Build Agent (needs output format)

### Current State Analysis

**What Exists:**
- Nothing - no hosting infrastructure

**What's Missing:**
- Multi-tenant app hosting
- Per-user app deployment
- Database provisioning
- Domain management
- Deployment pipeline

### Gap Analysis

#### Database (Gaps)

| Table | Status | Schema |
|-------|--------|--------|
| `deployed_apps` | MISSING | App registry |
| `app_deployments` | MISSING | Deployment history |
| `app_configs` | MISSING | Environment configs |
| `app_domains` | MISSING | Custom domains |

**Proposed `deployed_apps` table:**
```sql
CREATE TABLE deployed_apps (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    idea_id TEXT REFERENCES ideas(id),
    app_slug TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN (
        'pending', 'building', 'deployed', 'stopped', 'failed'
    )),
    provider TEXT CHECK(provider IN ('railway', 'render', 'vercel')),
    provider_app_id TEXT,
    url TEXT,
    git_repo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_deployed_at DATETIME
);
```

#### API Endpoints (Gaps)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/api/apps` | GET | List user's apps | P0 |
| `/api/apps/:id` | GET | Get app details | P0 |
| `/api/apps/:id/deploy` | POST | Trigger deployment | P0 |
| `/api/apps/:id/stop` | POST | Stop app | P1 |
| `/api/apps/:id/restart` | POST | Restart app | P1 |
| `/api/apps/:id/logs` | GET | Get app logs | P1 |
| `/api/apps/:id/domains` | POST | Add custom domain | P2 |

#### Backend Logic (Gaps)

| Component | Status | Purpose |
|-----------|--------|---------|
| `server/routes/apps.ts` | MISSING | App management |
| `utils/hosting/railway.ts` | MISSING | Railway API |
| `utils/hosting/render.ts` | MISSING | Render API |
| `utils/hosting/vercel.ts` | MISSING | Vercel API |
| `utils/git-manager.ts` | MISSING | Git operations |

#### Frontend (Gaps)

| Component | Status | Purpose |
|-----------|--------|---------|
| `pages/Apps.tsx` | MISSING | App list |
| `pages/AppDetail.tsx` | MISSING | Single app view |
| `components/DeploymentStatus.tsx` | MISSING | Status indicator |
| `components/AppLogs.tsx` | MISSING | Log viewer |

### Key Deliverables
1. Hosting provider integration (Railway recommended)
2. Git repo creation per user/idea
3. Automatic deployment on build complete
4. App lifecycle management (start/stop/restart)
5. Basic logging and monitoring

---

## Test Structure

### Test ID Prefixes
- `INFRA-AUTH-*`: Authentication tests
- `INFRA-CRED-*`: Credit system tests
- `INFRA-HOST-*`: Hosting tests

### Dependencies
```
INFRA-AUTH-001 ──────────────────────────────▶ INFRA-AUTH-020
                                                     │
                                                     ▼
                                              INFRA-CRED-001
                                                     │
                                                     ▼
                                              INFRA-CRED-015
                                                     │
                                                     ▼
                                              INFRA-HOST-001
                                                     │
                                                     ▼
                                              INFRA-HOST-015
```

---

## Success Criteria

### Phase 1 (Auth) Complete When:
- [ ] User can register with email/password
- [ ] User can log in and get session token
- [ ] Protected routes require authentication
- [ ] Password reset flow works
- [ ] User slug auto-created and linked

### Phase 2 (Credits) Complete When:
- [ ] User balance tracked correctly
- [ ] Credits consumed on ideation actions
- [ ] Stripe checkout works
- [ ] Free tier enforced
- [ ] Low balance warnings shown

### Phase 3 (Hosting) Complete When:
- [ ] Apps can be deployed to provider
- [ ] Apps can be started/stopped
- [ ] Logs accessible
- [ ] Deployment status tracked
- [ ] One app fully deployed end-to-end

---

## Files in This Spec Directory

```
specs/
├── 00-overview.md          # This file
├── 01-authentication.md    # Auth system design
├── 02-credit-system.md     # Credit system design
├── 03-hosting.md           # Hosting design
└── test-state.json         # Test tracking
```

---

*Created: 2026-01-07*
*Last Updated: 2026-01-07*
