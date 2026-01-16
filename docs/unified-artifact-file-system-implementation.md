# Unified Artifact & File System Implementation Plan

**Version**: 2.0
**Updated**: 2025-01-06
**Status**: Approved for Implementation

---

## Summary

Unify the artifact system (session-scoped, database-stored) with the file system (idea folders) so that artifacts ARE files. Implement idea type classification, user-scoped folder structure, relationship graphs, phase-based document management, and AI-driven context loading.

---

## Key Decisions

| Decision                         | Choice                                                               |
| -------------------------------- | -------------------------------------------------------------------- |
| **Folder hierarchy**             | `users/[user]/ideas/[slug]/`                                         |
| **Idea types**                   | business, feature, service, pivot, integration                       |
| **Parent relationships**         | Internal (existing idea) or External (outside platform)              |
| **Session naming**               | System auto-names; triggers folder rename                            |
| **Memory files**                 | Removed except for `.metadata/index.json` cache                      |
| **Canonical doc creation**       | Pre-create templates on capture (guided format)                      |
| **Template format**              | Section headers + bullet prompts (agents fill proactively)           |
| **Classification determination** | AI-inferred based on phase + content (not explicit user question)    |
| **Phase enforcement**            | Background with visibility (progress %, handoff brief)               |
| **Document versioning**          | None (only idea evolutions, forks, branches)                         |
| **Relationship structure**       | Hybrid: hierarchical for strong ownership + metadata for cross-links |
| **Asset export**                 | Auto-export visuals to assets/                                       |
| **File token limit**             | 15k tokens max                                                       |
| **Bloat detection**              | Proactive (similar filenames) + on-demand (pivotal decisions)        |

---

## Phase 1: Folder Structure & Idea Types

### 1.1 User-Scoped Folder Structure

```
users/
├── [user-slug]/
│   ├── profile.md                      # User profile (goals, skills, network, life stage)
│   └── ideas/
│       ├── draft_20250106123045/       # Unnamed session (auto-renamed when idea forms)
│       │   └── [artifacts created during exploration]
│       │
│       └── [idea-slug]/                # Named idea folder
│           ├── README.md                    # Core idea (pre-created, guided)
│           ├── development.md               # Q&A tracking (pre-created, guided)
│           ├── target-users.md              # User segments (pre-created, guided)
│           ├── problem-solution.md          # Problem/solution detail (pre-created, guided)
│           ├── business-model.md            # Revenue, pricing, monetization
│           ├── team.md                      # Founder context, resources, constraints
│           │
│           ├── research/
│           │   ├── market.md                # Market size, trends, timing
│           │   ├── competitive.md           # Competitors, positioning
│           │   └── user-personas.md         # Detailed personas
│           │
│           ├── validation/                  # Assumption testing
│           │   ├── assumptions.md           # What we're testing
│           │   └── results.md               # Test outcomes
│           │
│           ├── planning/
│           │   ├── brief.md                 # Auto-generated handoff doc
│           │   ├── mvp-scope.md             # MVP feature list
│           │   ├── architecture.md          # Technical architecture
│           │   └── action-plan.md           # 30/60/90 day roadmap
│           │
│           ├── build/
│           │   ├── spec.md                  # Detailed requirements
│           │   ├── tasks.md                 # Implementation breakdown
│           │   └── decisions.md             # ADRs
│           │
│           ├── marketing/                   # Marketing & Communications
│           │   ├── gtm.md                   # Go-to-market strategy
│           │   ├── channels.md              # Marketing channels
│           │   ├── pitch.md                 # Elevator pitch variants
│           │   ├── investor-pitch.md        # If seeking funding
│           │   └── launch-plan.md           # Launch checklist
│           │
│           ├── networking/                  # Networking & Collaboration
│           │   ├── contacts.md              # Key contacts, domain experts
│           │   ├── collaborators.md         # People contributing to idea
│           │   └── opportunities.md         # AI-surfaced collaboration opportunities
│           │
│           ├── analysis/
│           │   ├── evaluation.md            # 30-criteria scoring
│           │   ├── redteam.md               # Challenges and responses
│           │   └── risk-mitigation.md       # Trust, safety, legal considerations
│           │
│           ├── features/                    # Child features (if parent idea)
│           │   └── [feature-slug]/
│           │       └── README.md
│           │
│           ├── assets/
│           │   ├── diagrams/                # Auto-exported SVG/mermaid
│           │   └── images/
│           │
│           └── .metadata/
│               ├── index.json               # File index cache (regenerable)
│               ├── relationships.json       # Links to other ideas
│               ├── priority.json            # Document priority ranking
│               └── timeline.json            # Phase deadlines
```

### 1.2 Idea Type Classification

**Frontmatter Schema** (in README.md):

```yaml
---
id: uuid
title: "My Idea"
idea_type: feature # business | feature | service | pivot | integration
parent_type: internal # internal | external | none
parent_slug: my-saas-app # If internal: slug of parent idea
parent_external: "Shopify" # If external: name of external platform
lifecycle_stage: SPARK
created: 2025-01-06
updated: 2025-01-06
creator: user-slug
---
```

**Session Flow for Type Determination:**

Agent asks at session start:

```
"Is this idea a standalone business, or part of something else?"

[Options]
1. A brand new standalone business/app
2. A feature for an existing idea I'm working on
3. A feature/integration for an external platform (e.g., Shopify plugin)
4. A microservice/API that could serve multiple apps
5. A pivot/evolution of an existing idea
```

Follow-up based on selection:

- Option 2 → "Which of your existing ideas does this belong to?" [list user's ideas]
- Option 3 → "What's the external platform?" [free text]
- Option 4 → "Will this service be shared across your ideas or standalone?"
- Option 5 → "Which idea is this evolving from?" [list user's ideas]

### 1.3 Relationship Graph

**Per-Idea Relationships** (`.metadata/relationships.json`):

```json
{
  "idea_type": "feature",
  "parent": {
    "type": "internal",
    "slug": "my-saas-app",
    "user": "current-user"
  },
  "integrates_with": [
    { "type": "internal", "slug": "auth-service", "user": "current-user" },
    { "type": "external", "name": "Stripe", "purpose": "payments" }
  ],
  "evolved_from": null,
  "forked_from": null,
  "branched_from": null,
  "collaboration": {
    "contributors": ["user-jane", "user-bob"],
    "ai_suggested_partners": ["user-alice"]
  },
  "ai_detected": {
    "competes_with": ["competitor-app"],
    "shares_audience_with": ["similar-idea"]
  }
}
```

**Database Table** (for fast graph queries):

```sql
CREATE TABLE idea_relationships (
  id TEXT PRIMARY KEY,
  from_user TEXT NOT NULL,
  from_idea TEXT NOT NULL,
  to_user TEXT,
  to_idea TEXT,
  to_external TEXT,
  relationship_type TEXT NOT NULL,  -- parent, child, integrates, evolved_from, competes, shares_audience
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL  -- 'user' | 'ai'
);
```

### 1.4 Files to Modify

| File                              | Changes                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `scripts/capture.ts`              | Create `users/[user]/ideas/[slug]/` structure with all templates |
| `database/migrations/`            | Add `idea_relationships` table                                   |
| `agents/ideation/orchestrator.ts` | Add idea type classification flow at session start               |

### 1.5 Files to Create

| File                                  | Purpose                       |
| ------------------------------------- | ----------------------------- |
| `templates/README.md`                 | Core idea template (guided)   |
| `templates/development.md`            | Q&A template (guided)         |
| `templates/target-users.md`           | User segments template        |
| `templates/problem-solution.md`       | Problem/solution template     |
| `templates/business-model.md`         | Revenue/pricing template      |
| `templates/team.md`                   | Team/resources template       |
| `templates/research/market.md`        | Market analysis template      |
| `templates/research/competitive.md`   | Competitive analysis template |
| `templates/validation/assumptions.md` | Assumptions template          |
| `templates/planning/brief.md`         | Handoff brief template        |
| `templates/planning/mvp-scope.md`     | MVP scope template            |
| `templates/planning/architecture.md`  | Architecture template         |
| `templates/marketing/gtm.md`          | Go-to-market template         |
| `templates/marketing/pitch.md`        | Pitch template                |
| `templates/networking/contacts.md`    | Contacts template             |
| `templates/build/spec.md`             | Build spec template           |

---

## Phase 2: Unified Artifact Store

### 2.1 Architecture Change

**Current**: Artifacts stored in `ideation_artifacts` table with content
**New**: Artifacts ARE files in idea folder

**Source of truth**: The files themselves (with frontmatter metadata)
**Cache layer**: `.metadata/index.json` - purely for fast UI loading, can be deleted and regenerated from files anytime

### 2.2 UnifiedArtifact Interface

```typescript
interface UnifiedArtifact {
  id: string;
  userSlug: string;
  ideaSlug: string;
  sessionId?: string;
  type: ArtifactType;
  title: string;
  filePath: string; // Relative to users/[user]/ideas/[slug]/
  tokenCount: number;
  status: "ready" | "updating" | "error";
  createdAt: string;
  updatedAt: string;
}
```

### 2.3 Key Functions

| Function                                                | Description                                  |
| ------------------------------------------------------- | -------------------------------------------- |
| `saveArtifact(userSlug, ideaSlug, artifact)`            | Write to filesystem + update cache           |
| `loadArtifact(userSlug, ideaSlug, filePath)`            | Read from filesystem                         |
| `listArtifacts(userSlug, ideaSlug)`                     | Return from cache (or regenerate if missing) |
| `deleteArtifact(userSlug, ideaSlug, filePath)`          | Remove file + update cache                   |
| `deleteSessionArtifacts(userSlug, ideaSlug, sessionId)` | Bulk delete by session                       |
| `rebuildCache(userSlug, ideaSlug)`                      | Scan all files, regenerate index.json        |
| `renameIdeaFolder(userSlug, oldSlug, newSlug)`          | Rename folder + update all references        |

### 2.4 Database Changes

```sql
ALTER TABLE ideation_artifacts ADD COLUMN user_slug TEXT;
ALTER TABLE ideation_artifacts ADD COLUMN idea_slug TEXT;
ALTER TABLE ideation_artifacts ADD COLUMN file_path TEXT;
ALTER TABLE ideation_sessions ADD COLUMN user_slug TEXT;
ALTER TABLE ideation_sessions ADD COLUMN idea_slug TEXT;
-- Content column becomes NULL for file-backed artifacts
```

### 2.5 Files to Modify

| File                                | Changes                                         |
| ----------------------------------- | ----------------------------------------------- |
| `agents/ideation/artifact-store.ts` | Replace with unified filesystem store           |
| `server/routes/ideation.ts`         | Update artifact endpoints for user/idea scoping |
| `database/migrations/`              | Add columns to existing tables                  |

---

## Phase 3: Session & Context Management

### 3.1 Session → Idea Linking

**Flow:**

1. **New session (no idea selected)**:
   - Create draft folder: `users/[user]/ideas/draft_[yyyymmddhhmmss]/`
   - All artifacts saved there immediately
   - Session header shows: `[Working on: Draft session ▼]`

2. **System auto-names idea** (triggered by agent detecting idea formation):
   - Agent: "I'm going to call this idea '[suggested name]'. Sound good?"
   - On confirmation: Rename folder `draft_...` → `[slug]/`
   - Add canonical templates if missing
   - Update database references

3. **User selects existing idea**:
   - Session links to `users/[user]/ideas/[slug]/`
   - Future artifacts written there
   - Header updates: `[Working on: ai-fridge-scanner ▼]`

4. **Switch ideas mid-session**:
   - User can select different idea from dropdown
   - Future artifacts go to new idea folder
   - Previous artifacts stay in their original folder

### 3.2 Context Loading Strategy

**Layered Context Structure:**

```typescript
interface AgentContext {
  // Layer 1: Identity (always loaded, ~500 tokens)
  idea: {
    userSlug: string;
    ideaSlug: string;
    type: "business" | "feature" | "service" | "pivot" | "integration";
    parent?: { type: "internal" | "external"; ref: string };
    currentPhase: LifecycleStage;
  };

  // Layer 2: Progress State (always loaded, ~300 tokens)
  progress: {
    phase: LifecycleStage;
    completionPercent: number;
    documentsComplete: string[];
    documentsMissing: string[];
    lastActivity: string;
    blockers: string[];
    nextRecommendedAction: string;
  };

  // Layer 3: Relationships (always loaded, ~200 tokens)
  relationships: {
    parent?: { type: string; slug: string };
    children: string[];
    integrations: string[];
    collaborators: string[];
  };

  // Layer 4: Core Document Summaries (always loaded, ~1000 tokens)
  coreDocs: {
    readme: { summary: string; fullPath: string };
    development: { recentQA: string[]; gaps: string[] };
  };

  // Layer 5: Phase-Specific Documents (loaded based on phase, ~5000 tokens)
  phaseDocs: DocumentContent[];

  // Layer 6: On-Demand (loaded when referenced in conversation)
  availableDocuments: { path: string; summary: string; lastUpdated: Date }[];
}
```

**Token Budget Allocation:**

| Context Layer        | Tokens | Cumulative |
| -------------------- | ------ | ---------- |
| Identity + Progress  | 800    | 800        |
| Relationships        | 200    | 1,000      |
| Core Doc Summaries   | 1,000  | 2,000      |
| Phase Docs (full)    | 5,000  | 7,000      |
| Conversation History | 10,000 | 17,000     |
| On-demand Docs       | 5,000  | 22,000     |
| Buffer for Response  | 10,000 | 32,000     |

### 3.3 Priority Ranking File

`.metadata/priority.json`:

```json
{
  "always_show": ["README.md", "development.md"],
  "by_phase": {
    "RESEARCH": ["research/market.md", "research/competitive.md"],
    "EVALUATE": ["analysis/evaluation.md", "analysis/redteam.md"],
    "BUILD": ["build/tasks.md", "planning/architecture.md"],
    "LAUNCH": ["marketing/gtm.md", "marketing/launch-plan.md"]
  },
  "recently_updated": ["marketing/gtm.md", "target-users.md"],
  "ai_recommended": ["research/competitive.md"]
}
```

### 3.4 Files to Modify

| File                                                   | Changes                                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| `agents/ideation/system-prompt.ts`                     | Add `{{IDEA_CONTEXT}}` section with layered loading |
| `agents/ideation/orchestrator.ts`                      | Load idea context when session linked               |
| `frontend/src/components/ideation/SessionHeader.tsx`   | Add idea selector dropdown                          |
| `frontend/src/components/ideation/IdeationSession.tsx` | Track linked idea                                   |
| `server/routes/ideation.ts`                            | Add `PATCH /session/:id/link-idea`                  |

### 3.5 Files to Create

| File                                      | Purpose                           |
| ----------------------------------------- | --------------------------------- |
| `agents/ideation/idea-context-builder.ts` | Build layered context for agent   |
| `agents/ideation/priority-manager.ts`     | Manage document priority rankings |

---

## Phase 4: Phase Transitions & Handoffs

### 4.1 Phase-Document Mapping

| Lifecycle Stage | Required Documents                               | Recommended Documents     |
| --------------- | ------------------------------------------------ | ------------------------- |
| **SPARK**       | README.md                                        | -                         |
| **CLARIFY**     | README.md, development.md                        | target-users.md           |
| **RESEARCH**    | research/market.md, research/competitive.md      | research/user-personas.md |
| **IDEATE**      | target-users.md, problem-solution.md             | planning/mvp-scope.md     |
| **EVALUATE**    | analysis/evaluation.md                           | analysis/redteam.md       |
| **VALIDATE**    | validation/assumptions.md, validation/results.md | -                         |
| **DESIGN**      | planning/architecture.md, planning/mvp-scope.md  | planning/spec.md          |
| **PROTOTYPE**   | build/prototype-notes.md                         | -                         |
| **BUILD**       | build/tasks.md, build/decisions.md               | build/spec.md             |
| **LAUNCH**      | marketing/gtm.md, marketing/launch-plan.md       | marketing/channels.md     |
| **GROW**        | networking/contacts.md, marketing/growth.md      | marketing/partnerships.md |

### 4.2 AI-Driven Classification

Agent determines required vs optional based on:

1. **Phase Rules** (explicit configuration):

   ```typescript
   const PHASE_REQUIREMENTS = {
     EVALUATE: {
       required: ["analysis/evaluation.md"],
       recommended: ["research/market.md", "target-users.md"],
     },
   };
   ```

2. **Content Inference** (AI checks conversation):
   - If user mentioned competitors → `research/competitive.md` becomes recommended
   - If user mentioned "B2B" → `target-users.md` needs company segments
   - If asking for funding → `marketing/investor-pitch.md` becomes required

3. **Handoff Check** (at phase transitions):
   AI reviews what's needed for next phase and proactively fills gaps.

### 4.3 Auto-Generated Handoff Brief

At each phase transition, AI auto-generates `planning/brief.md`:

```markdown
# Handoff Brief: RESEARCH → EVALUATE

**Generated**: 2025-01-06
**Idea**: [idea-slug]
**Current Phase**: RESEARCH
**Next Phase**: EVALUATE

## What's Complete

- [x] Market analysis: $28B market, 32% CAGR
- [x] Competitive analysis: 4 competitors mapped
- [x] Target users: 3 personas defined

## What's Incomplete

- [ ] User interviews (0 conducted)
- [ ] Pricing validation (no data)

## Key Insights for Next Phase

1. Main competitor weakness: No ideation guidance
2. Target user priority: Corporate employees with side projects
3. Risk flag: Solo founder executing in competitive market

## AI Recommendation

- **Confidence for evaluation**: 72%
- **Missing context may affect**: Market scoring (MK1-MK5), Validation (PR4)
- **Suggested action**: Conduct 3-5 user interviews before full evaluation

## Decision

- [ ] Continue to EVALUATE
- [ ] Address gaps first
```

### 4.4 Files to Create

| File                                      | Purpose                  |
| ----------------------------------------- | ------------------------ |
| `agents/ideation/document-classifier.ts`  | Classification engine    |
| `agents/ideation/classification-rules.ts` | Rule definitions         |
| `agents/ideation/handoff-generator.ts`    | Generate handoff briefs  |
| `agents/ideation/phase-manager.ts`        | Manage phase transitions |

---

## Phase 5: Multi-User Collaboration

### 5.1 Collaboration Types

| Type                 | Description                                | Trigger                        |
| -------------------- | ------------------------------------------ | ------------------------------ |
| **Contributor**      | Invited to help on specific idea           | User invites via email         |
| **Tester**           | Paid testing of unreleased features        | User posts testing opportunity |
| **Domain Expert**    | Answers questions without seeing full idea | AI matches expertise           |
| **Cross-Pollinator** | Similar ideas, potential partnership       | AI detects overlap             |

### 5.2 AI Detection Logic

```typescript
async function detectCollaborationOpportunities(
  idea: Idea,
): Promise<Opportunity[]> {
  // Extract idea characteristics
  const targetUsers = extractTargetUsers(idea);
  const problemDomain = extractProblemDomain(idea);
  const techStack = extractTechStack(idea);

  // Compare against all discoverable ideas (with permission)
  const matches = await findMatchingIdeas({
    targetUsers,
    problemDomain,
    techStack,
    threshold: 0.6, // 60% overlap
  });

  return matches.map((m) => ({
    type: m.overlapType,
    idea: m.ideaSlug,
    user: m.userSlug,
    reason: m.matchReason,
  }));
}
```

### 5.3 Privacy Controls

`.metadata/sharing.json`:

```json
{
  "visibility": "discoverable",
  "share_with_ai_matching": true,
  "share_fields": ["problem_domain", "target_users", "tech_stack"],
  "hide_fields": ["business_model", "pricing", "revenue"],
  "collaborators": [
    { "user": "jane", "role": "contributor", "access": "full" },
    { "user": "bob", "role": "tester", "access": "limited" }
  ]
}
```

### 5.4 Files to Create

| File                                        | Purpose                        |
| ------------------------------------------- | ------------------------------ |
| `agents/ideation/collaboration-detector.ts` | AI-driven opportunity matching |
| `agents/ideation/sharing-manager.ts`        | Manage privacy controls        |

---

## Phase 6: Token Management & Bloat Detection

### 6.1 Token Enforcer

```typescript
const MAX_FILE_TOKENS = 15000;

function checkTokenLimit(content: string): TokenCheckResult {
  const tokens = estimateTokens(content);
  return {
    tokens,
    exceedsLimit: tokens > MAX_FILE_TOKENS,
    suggestedSplits:
      tokens > MAX_FILE_TOKENS ? suggestSplits(content) : undefined,
  };
}
```

### 6.2 Bloat Detection

**Proactive triggers** (agent notices and mentions immediately):

- Similar file names detected (e.g., `competitive-analysis.md`, `competitor-analysis.md`)
- Files with overlapping content
- Files exceeding 15k token limit

**On-demand triggers** (agent checks when pivotal decisions are made):

- After major direction change
- After target user refinement
- At phase transitions

**Agent behavior**:

```
"I notice you have 'competitive-analysis.md' and 'competitor-research.md'
with overlapping content. Should I consolidate them into one comprehensive
analysis, or are they serving different purposes?"
```

### 6.3 Files to Create

| File                                | Purpose                            |
| ----------------------------------- | ---------------------------------- |
| `agents/ideation/token-enforcer.ts` | 15k limit enforcement              |
| `agents/ideation/bloat-detector.ts` | Detect duplicate/overlapping files |

---

## Phase 7: Asset Management

### 7.1 Auto-Export Strategy

When agent creates visual artifacts (mermaid, SVG, diagrams):

1. Render to SVG/PNG
2. Save to `users/[user]/ideas/[slug]/assets/diagrams/[title].svg`
3. Insert markdown reference in relevant doc

### 7.2 Asset Manager

```typescript
async function saveAsset(
  userSlug: string,
  ideaSlug: string,
  content: Buffer,
  filename: string,
  category: "diagrams" | "images" | "exports",
): Promise<string> {
  const assetPath = `users/${userSlug}/ideas/${ideaSlug}/assets/${category}/${filename}`;
  await fs.promises.writeFile(assetPath, content);
  return `./assets/${category}/${filename}`;
}
```

### 7.3 Files to Create

| File                        | Purpose               |
| --------------------------- | --------------------- |
| `utils/asset-manager.ts`    | Binary asset handling |
| `utils/mermaid-renderer.ts` | Render mermaid to SVG |

---

## Phase 8: UI Components

### 8.1 Artifact Panel Redesign

**Layout: Table (20%) + Preview (80%)**

```
+------------------------------------------+
|  Artifacts (12)    [Files ▼] [Sessions]  |
+------------------------------------------+
| Name          | Date    | Type  | Status |  <- 20% height
|---------------|---------|-------|--------|
| README.md     | Jan 5   | md    | 🟡     |
| target-users  | Jan 5   | md    | 🔴     |  <- Scrollable table
| > research/   |         |       |        |  <- Collapsible folders
+------------------------------------------+
|                                          |  <- 80% height
|  # Target Users                          |
|  [Preview content...]                    |
|                                          |
+------------------------------------------+
| [Edit] [Delete] [Copy @ref]              |
+------------------------------------------+
```

**Classification Badges**:

- 🔴 Required (and missing)
- 🟡 Required (exists)
- 🔵 Recommended
- ⚪ Optional

### 8.2 Session View Toggle

When "Sessions" selected:

```
> Session Jan 5, 2:30 PM (5 artifacts)
  - personas.md
  - target-users.md
  [Delete Session]
```

### 8.3 Idea Selector

Add to session header:

```
[Working on: ai-powered-fridge-recipe-scanner ▼]
```

Dropdown shows:

- Recent ideas
- All ideas (grouped by type)
- "+ New idea"
- "Drafts (3)"

### 8.4 Files to Modify

| File                                                     | Changes                     |
| -------------------------------------------------------- | --------------------------- |
| `frontend/src/components/ideation/IdeaArtifactPanel.tsx` | Table+preview layout        |
| `frontend/src/components/ideation/SessionHeader.tsx`     | Idea selector dropdown      |
| `frontend/src/reducers/ideationReducer.ts`               | Add viewMode, sessionGroups |

---

## Phase 9: Internal Versioning

### 9.1 Strategy

On every file save:

1. Copy current version to `.versions/[filename].[timestamp].md`
2. Keep last 10 versions per file
3. Prune older versions automatically

User never sees this - for recovery only.

### 9.2 Idea Evolution/Fork/Branch

When user evolves/forks/branches:

- Create NEW idea folder with full context
- Add relationship in `.metadata/relationships.json`:
  - `evolved_from`, `forked_from`, or `branched_from`
- Link maintained in `idea_relationships` database table

### 9.3 Files to Create

| File                       | Purpose                                 |
| -------------------------- | --------------------------------------- |
| `utils/version-manager.ts` | Internal versioning (invisible to user) |
| `utils/idea-lineage.ts`    | Handle evolutions, forks, branches      |

---

## Implementation Order

| Phase                            | Priority | Effort | Dependencies |
| -------------------------------- | -------- | ------ | ------------ |
| 1. Folder Structure & Idea Types | High     | High   | None         |
| 2. Unified Artifact Store        | High     | High   | Phase 1      |
| 3. Session & Context Management  | High     | Medium | Phase 2      |
| 4. Phase Transitions & Handoffs  | High     | Medium | Phase 3      |
| 5. Multi-User Collaboration      | Medium   | Medium | Phase 2      |
| 6. Token Management              | Medium   | Low    | Phase 2      |
| 7. Asset Management              | Medium   | Low    | Phase 2      |
| 8. UI Components                 | High     | High   | Phase 2, 3   |
| 9. Internal Versioning           | Low      | Low    | Phase 2      |

**Recommended sequence**: 1 → 2 → 3 → 4 → 8

---

## Summary: All Files

### Files to Modify

| File                                                     | Changes                                     |
| -------------------------------------------------------- | ------------------------------------------- |
| `scripts/capture.ts`                                     | Create `users/[user]/ideas/` structure      |
| `agents/ideation/artifact-store.ts`                      | Replace with unified filesystem store       |
| `agents/ideation/system-prompt.ts`                       | Add `{{IDEA_CONTEXT}}` with layered loading |
| `agents/ideation/orchestrator.ts`                        | Add idea type flow, load idea context       |
| `frontend/src/components/ideation/IdeaArtifactPanel.tsx` | Table+preview layout                        |
| `frontend/src/components/ideation/SessionHeader.tsx`     | Idea selector dropdown                      |
| `frontend/src/components/ideation/IdeationSession.tsx`   | Track linked idea                           |
| `frontend/src/reducers/ideationReducer.ts`               | Add viewMode, sessionGroups                 |
| `server/routes/ideation.ts`                              | New endpoints for user/idea scoping         |
| `database/migrations/`                                   | Add tables and columns                      |

### Files to Create

| File                                        | Purpose                               |
| ------------------------------------------- | ------------------------------------- |
| `agents/ideation/unified-artifact-store.ts` | Filesystem-based artifact storage     |
| `agents/ideation/idea-context-builder.ts`   | Build layered context for agent       |
| `agents/ideation/priority-manager.ts`       | Manage document priority rankings     |
| `agents/ideation/document-classifier.ts`    | Dynamic required/recommended/optional |
| `agents/ideation/classification-rules.ts`   | Rule definitions                      |
| `agents/ideation/handoff-generator.ts`      | Generate handoff briefs               |
| `agents/ideation/phase-manager.ts`          | Manage phase transitions              |
| `agents/ideation/collaboration-detector.ts` | AI-driven opportunity matching        |
| `agents/ideation/sharing-manager.ts`        | Manage privacy controls               |
| `agents/ideation/token-enforcer.ts`         | 15k limit enforcement                 |
| `agents/ideation/bloat-detector.ts`         | Detect duplicate/overlapping files    |
| `utils/asset-manager.ts`                    | Binary asset handling                 |
| `utils/mermaid-renderer.ts`                 | Render mermaid to SVG                 |
| `utils/version-manager.ts`                  | Internal versioning                   |
| `utils/idea-lineage.ts`                     | Handle evolutions, forks, branches    |
| `templates/*`                               | All guided templates (see Phase 1.5)  |
