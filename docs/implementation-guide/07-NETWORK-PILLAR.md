# Network Pillar: Collaboration Features

> **Status:** 🔴 0% — Not started
> **Priority:** Deferred — Focus on core E2E first
> **Estimated Effort:** 4-6 weeks (when prioritized)

---

## Why Deferred

The Network pillar is 1/3 of the Vibe vision, but:

1. **Core flow isn't complete** — Can't collaborate on something that doesn't work
2. **Single-user MVP first** — Prove value before adding complexity
3. **Lower risk** — Collaboration can be added later without major refactoring

**Recommendation:** Complete E2E flow for single user, then revisit Network pillar.

---

## Part 1: Vision

### What Network Enables

```
┌─────────────────────────────────────────────────────────────┐
│                     VIBE NETWORK                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐              │
│   │  Idea A │     │  Idea B │     │  Idea C │              │
│   │ (User 1)│     │ (User 2)│     │ (User 3)│              │
│   └────┬────┘     └────┬────┘     └────┬────┘              │
│        │               │               │                    │
│        └───────────────┼───────────────┘                    │
│                        │                                    │
│              ┌─────────▼─────────┐                         │
│              │  Overlap Detection │                         │
│              │  - Similar ideas   │                         │
│              │  - Shared audience │                         │
│              │  - Integration pts │                         │
│              └─────────┬─────────┘                         │
│                        │                                    │
│              ┌─────────▼─────────┐                         │
│              │  Collaboration     │                         │
│              │  Opportunities     │                         │
│              └───────────────────┘                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Features (Future)

1. **Idea Overlap Detection** — Find similar ideas for potential collaboration
2. **Audience Overlap** — Discover shared target users
3. **Integration Matching** — Find APIs/features that complement each other
4. **Collaboration Invites** — Bring others into your idea development
5. **Expert Consultation** — Request feedback from domain experts
6. **Feature Licensing** — License features between users

---

## Part 2: Architecture Preview

### Database Schema (Future)

```sql
-- User connections
CREATE TABLE user_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  connected_user_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending' | 'accepted' | 'blocked'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Idea collaborators
CREATE TABLE idea_collaborators (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'owner' | 'collaborator' | 'viewer'
  permissions TEXT, -- JSON array of permissions
  invited_by TEXT,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collaboration invites
CREATE TABLE collaboration_invites (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  inviter_id TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT UNIQUE,
  expires_at TIMESTAMP,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Idea similarity index (for overlap detection)
CREATE TABLE idea_similarities (
  id TEXT PRIMARY KEY,
  idea_a_id TEXT NOT NULL REFERENCES ideas(id),
  idea_b_id TEXT NOT NULL REFERENCES ideas(id),
  similarity_score REAL NOT NULL,
  similarity_type TEXT NOT NULL, -- 'problem' | 'solution' | 'audience' | 'tech'
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(idea_a_id, idea_b_id, similarity_type)
);

-- Messages between users
CREATE TABLE user_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  idea_id TEXT REFERENCES ideas(id), -- Optional context
  content TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints (Future)

```typescript
// Collaboration
POST   /api/ideas/:id/collaborators          // Invite collaborator
GET    /api/ideas/:id/collaborators          // List collaborators
DELETE /api/ideas/:id/collaborators/:userId  // Remove collaborator
PATCH  /api/ideas/:id/collaborators/:userId  // Update permissions

// Invites
POST   /api/invites                          // Create invite
GET    /api/invites                          // List my invites
POST   /api/invites/:token/accept            // Accept invite
DELETE /api/invites/:id                      // Cancel invite

// Discovery
GET    /api/discover/similar                 // Find similar ideas
GET    /api/discover/audience-overlap        // Find audience overlap
GET    /api/discover/integration-matches     // Find integration opportunities

// Messaging
GET    /api/messages                         // List conversations
POST   /api/messages                         // Send message
GET    /api/messages/:conversationId         // Get conversation
```

---

## Part 3: Feature Breakdown

### 3.1 Collaboration Invites

**User Story:** As an idea owner, I want to invite collaborators so we can develop the idea together.

**Flow:**

1. Owner clicks "Invite Collaborator"
2. Enter email and select role (collaborator/viewer)
3. System sends email with secure link
4. Invitee clicks link, creates account (if needed)
5. Invitee sees idea in their dashboard

**Permissions:**
| Role | View | Comment | Edit | Evaluate | Delete |
|------|------|---------|------|----------|--------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Collaborator | ✅ | ✅ | ✅ | ✅ | ❌ |
| Viewer | ✅ | ✅ | ❌ | ❌ | ❌ |

### 3.2 Idea Overlap Detection

**User Story:** As a user, I want to discover ideas similar to mine so I can find potential collaborators or competitors.

**Algorithm:**

1. Extract key features from each idea:
   - Problem domain (healthcare, fintech, etc.)
   - Target user segments
   - Core technologies
   - Geographic focus
2. Compute similarity scores using embeddings
3. Surface high-similarity pairs to users

**Privacy:**

- Users must opt-in to discovery
- Can specify what's visible to others
- Can block specific users/ideas

### 3.3 Integration Matching

**User Story:** As a user building an app, I want to find complementary apps so we can integrate and cross-promote.

**Example:**

- User A building: "Habit tracker app"
- User B building: "Fitness workout app"
- System detects: Both target "health-conscious professionals"
- Suggestion: "Integrate habit tracking into workout completion"

### 3.4 Expert Consultation

**User Story:** As a user with a technical idea, I want to get feedback from domain experts.

**Flow:**

1. User requests expert review
2. System matches with relevant experts (based on skills/experience)
3. Expert reviews and provides feedback
4. User optionally tips expert (credit transfer)

---

## Part 4: Security Considerations

### Data Isolation

```typescript
// Middleware to enforce access control
async function requireIdeaAccess(req, res, next) {
  const { ideaId } = req.params;
  const userId = req.user.id;

  const access = await checkIdeaAccess(ideaId, userId);

  if (!access.canView) {
    return res.status(403).json({ error: "Access denied" });
  }

  req.ideaAccess = access;
  next();
}

async function checkIdeaAccess(ideaId: string, userId: string) {
  const idea = await db.ideas.findUnique({ where: { id: ideaId } });

  // Owner has full access
  if (idea.ownerId === userId) {
    return { canView: true, canEdit: true, canDelete: true, role: "owner" };
  }

  // Check collaborator
  const collab = await db.ideaCollaborators.findFirst({
    where: { ideaId, userId, acceptedAt: { not: null } },
  });

  if (collab) {
    return {
      canView: true,
      canEdit: collab.role === "collaborator",
      canDelete: false,
      role: collab.role,
    };
  }

  return { canView: false, canEdit: false, canDelete: false, role: null };
}
```

### NDA/Confidentiality

- Platform-wide terms require confidentiality
- Ideas not in "discovery" mode are completely private
- Violation reporting mechanism
- Audit log for all access

---

## Part 5: Implementation Plan (When Prioritized)

### Phase N1: Basic Collaboration (2 weeks)

1. Database schema for collaborators/invites
2. Invite flow (email, accept/decline)
3. Permission enforcement
4. Collaborator management UI

### Phase N2: Real-time Collaboration (2 weeks)

1. WebSocket infrastructure for live updates
2. Presence indicators (who's online)
3. Live cursor/editing (if applicable)
4. Comment system

### Phase N3: Discovery (2 weeks)

1. Similarity computation pipeline
2. Opt-in discovery settings
3. Discovery UI (similar ideas, matches)
4. Privacy controls

### Phase N4: Advanced Features (2 weeks)

1. Expert consultation marketplace
2. Feature licensing system
3. Cross-app integration suggestions
4. Analytics on collaboration success

---

## Part 6: Metrics to Track (Future)

| Metric                  | Description                            | Target |
| ----------------------- | -------------------------------------- | ------ |
| Collaboration rate      | % of ideas with >1 collaborator        | >20%   |
| Invite acceptance rate  | % of invites accepted                  | >50%   |
| Discovery engagement    | % of users using discovery             | >30%   |
| Cross-idea integrations | # of integrations suggested & accepted | Growth |
| Expert consultations    | # of consultations completed           | Growth |

---

## Summary

The Network pillar is important but deferred until:

1. ✅ Core E2E flow works (ideation → spec → build → deploy)
2. ✅ Single-user MVP is validated
3. ✅ Basic hosting/deployment works

**When to start Network:**

- After first 10 users complete E2E journey
- When users request collaboration features
- When core flow is stable

**Quick win (if needed earlier):**

- Simple view-only sharing via link
- No accounts, no permissions complexity
- Can be built in 1-2 days

---

_This document is a placeholder. Revisit when Network pillar is prioritized._
