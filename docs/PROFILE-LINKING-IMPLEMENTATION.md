# Profile Linking UI Implementation Plan

> Comprehensive plan for adding user profile linking to the idea evaluation flow in the UI.

## First Principles Analysis

### The Core Problem

The evaluation system scores ideas against 30 criteria. Five of these (FT1-FT5) are **Personal Fit** criteria that measure how well an idea aligns with the *specific person* pursuing it:

| ID | Criterion | What It Measures |
|----|-----------|------------------|
| FT1 | Personal Fit | Alignment with personal goals |
| FT2 | Passion | Genuine excitement and motivation |
| FT3 | Skills Match | Leverage of existing capabilities |
| FT4 | Network | Ability to use connections |
| FT5 | Life Stage | Timing relative to life circumstances |

**Without profile context, these scores are meaningless** - the evaluator has no information about who is being evaluated, so scores default to 5/10 with low confidence.

### The Ideal User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     IDEAL FLOW                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CREATE PROFILE (once)                                        │
│     └── /profile page                                            │
│         └── Goals, skills, network, life stage                   │
│                                                                  │
│  2. CREATE/VIEW IDEA                                             │
│     └── /ideas/:slug page                                        │
│                                                                  │
│  3. LINK PROFILE TO IDEA  ◄─── THIS IS MISSING IN UI            │
│     └── Select profile before evaluation                         │
│                                                                  │
│  4. RUN EVALUATION                                               │
│     └── Profile context automatically used                       │
│     └── FT1-FT5 scores are personalized                          │
│                                                                  │
│  5. VIEW RESULTS                                                 │
│     └── Clear indication that FT scores reflect YOUR profile     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Gap Analysis

### Current State Inventory

| Layer | Component | Status |
|-------|-----------|--------|
| **Database** | `user_profiles` table | Exists |
| **Database** | `idea_profiles` linking table | Exists |
| **Backend** | `POST /api/profiles/:id/link/:ideaSlug` | Exists |
| **Backend** | `DELETE /api/profiles/:id/link/:ideaSlug` | Exists |
| **Backend** | `GET /api/profiles/:id/ideas` | Exists |
| **Backend** | `GET /api/ideas/:slug/profile` | **MISSING** |
| **CLI** | `npm run profile link` | Exists |
| **Frontend** | Profile page (create/edit) | Exists |
| **Frontend** | Profile page shows linked ideas | Exists |
| **Frontend** | API client profile functions | **MISSING** |
| **Frontend** | IdeaDetail profile display | **MISSING** |
| **Frontend** | IdeaDetail profile selector | **MISSING** |
| **Frontend** | Pre-evaluation warning | **MISSING** |
| **Frontend** | FT score confidence indicators | **MISSING** |

### Identified Gaps

#### Gap 1: Missing Backend Endpoint
**Location:** `server/api.ts`

Currently you can get ideas linked to a profile, but NOT the profile linked to an idea:
```
GET /api/profiles/:id/ideas     ✅ Exists
GET /api/ideas/:slug/profile    ❌ Missing
```

#### Gap 2: No Frontend API Client Functions
**Location:** `frontend/src/api/client.ts`

Zero profile-related functions exist in the frontend API client.

#### Gap 3: No Profile Context in IdeaDetail
**Location:** `frontend/src/pages/IdeaDetail.tsx`

The page shows idea details and has "Run Evaluation" button but:
- No display of linked profile
- No warning if no profile linked
- No way to link/change profile

#### Gap 4: No Pre-Evaluation UX
**Location:** `frontend/src/pages/IdeaDetail.tsx`

User can trigger evaluation without knowing:
- Whether a profile is linked
- What profile will be used
- Impact on FT1-FT5 scoring confidence

#### Gap 5: No Profile Context in Results
**Location:** `frontend/src/components/EvaluationScorecard.tsx`

Evaluation results don't indicate:
- Whether profile was used
- Which profile was used
- Confidence difference for FT scores

---

## Implementation Plan

### Phase 1: Backend Foundation

#### Task 1.1: Add Idea Profile Endpoint
**File:** `server/api.ts`
**Priority:** Critical (blocker for frontend)

Add new endpoint:
```typescript
// GET /api/ideas/:slug/profile - Get profile linked to an idea
app.get('/api/ideas/:slug/profile', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Get idea
  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    return res.status(404).json({ success: false, error: 'Idea not found' });
  }

  // Get linked profile
  const profile = await getOne<UserProfile>(`
    SELECT p.* FROM user_profiles p
    JOIN idea_profiles ip ON p.id = ip.profile_id
    WHERE ip.idea_id = ?
  `, [idea.id]);

  respond(res, profile || null);
}));
```

#### Task 1.2: Add Profile Used Flag to Evaluation Runs
**File:** `database/migrations/` (new migration)
**Priority:** Medium

Add column to track if profile was used during evaluation:
```sql
ALTER TABLE evaluation_runs ADD COLUMN profile_id TEXT REFERENCES user_profiles(id);
ALTER TABLE evaluation_runs ADD COLUMN profile_name TEXT;
```

This allows showing "Evaluated with profile: John Doe" in results.

### Phase 2: Frontend API Layer

#### Task 2.1: Add Profile Types
**File:** `frontend/src/types/index.ts`
**Priority:** Critical

Add TypeScript interfaces:
```typescript
export interface UserProfileSummary {
  id: string;
  name: string;
  slug: string;
  primary_goals: string; // JSON string
  updated_at: string;
}

export interface IdeaProfileLink {
  profile: UserProfileSummary | null;
  linked_at: string | null;
}
```

#### Task 2.2: Add Profile API Functions
**File:** `frontend/src/api/client.ts`
**Priority:** Critical

Add functions:
```typescript
// Get all profiles (for selector dropdown)
export async function getProfiles(): Promise<UserProfileSummary[]> {
  return fetchApi<UserProfileSummary[]>('/profiles');
}

// Get profile linked to an idea
export async function getIdeaProfile(slug: string): Promise<UserProfileSummary | null> {
  return fetchApi<UserProfileSummary | null>(`/ideas/${slug}/profile`);
}

// Link profile to idea
export async function linkProfileToIdea(profileId: string, ideaSlug: string): Promise<void> {
  await fetch(`${API_BASE}/profiles/${profileId}/link/${ideaSlug}`, { method: 'POST' });
}

// Unlink profile from idea
export async function unlinkProfileFromIdea(profileId: string, ideaSlug: string): Promise<void> {
  await fetch(`${API_BASE}/profiles/${profileId}/link/${ideaSlug}`, { method: 'DELETE' });
}
```

#### Task 2.3: Add Profile Hook
**File:** `frontend/src/hooks/useProfiles.ts` (new file)
**Priority:** Critical

Create hook for profile data:
```typescript
export function useIdeaProfile(slug: string | undefined) {
  const [profile, setProfile] = useState<UserProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch profile on mount and when slug changes
  // Return { profile, loading, error, refetch, link, unlink }
}

export function useProfiles() {
  // Return { profiles, loading, error }
}
```

### Phase 3: IdeaDetail Page Enhancement

#### Task 3.1: Profile Status Display
**File:** `frontend/src/pages/IdeaDetail.tsx`
**Priority:** Critical

Add profile status section above action bar:
```
┌─────────────────────────────────────────────────┐
│ 👤 Profile: John Doe                    [Change]│
│    Goals: income, learning                      │
│    Linked: Dec 15, 2025                         │
└─────────────────────────────────────────────────┘
```

Or if no profile:
```
┌─────────────────────────────────────────────────┐
│ ⚠️ No profile linked                    [Link] │
│    FT1-FT5 scores will have low confidence      │
└─────────────────────────────────────────────────┘
```

#### Task 3.2: Profile Selector Modal/Dropdown
**File:** `frontend/src/components/ProfileSelector.tsx` (new file)
**Priority:** Critical

Create reusable profile selector:
- Dropdown showing all available profiles
- Preview of profile goals/skills on hover
- Quick link to create new profile
- Confirmation when changing linked profile

#### Task 3.3: Pre-Evaluation Check
**File:** `frontend/src/pages/IdeaDetail.tsx`
**Priority:** High

Modify `handleEvaluate` to:
1. Check if profile is linked
2. If not, show modal: "No profile linked. FT1-FT5 scores will default to 5/10 with low confidence."
3. Options: "Link Profile" | "Evaluate Anyway" | "Cancel"

### Phase 4: Evaluation Results Enhancement

#### Task 4.1: Profile Badge in Scorecard
**File:** `frontend/src/components/EvaluationScorecard.tsx`
**Priority:** Medium

Add indicator showing which profile was used:
```
┌────────────────────────────────────────┐
│ Evaluation Results                     │
│ 📊 Run: abc123...                      │
│ 👤 Profile: John Doe  ← NEW            │
└────────────────────────────────────────┘
```

#### Task 4.2: FT Category Confidence Indicator
**File:** `frontend/src/components/EvaluationScorecard.tsx`
**Priority:** Medium

For the "Fit" category, show confidence source:
- If profile was used: "🟢 Personalized to your profile"
- If no profile: "🟡 Generic scores (no profile linked)"

#### Task 4.3: Synthesis Profile Context
**File:** `frontend/src/components/SynthesisView.tsx`
**Priority:** Low

Show profile context in synthesis view if available.

### Phase 5: Profile Page Enhancement (Nice-to-Have)

#### Task 5.1: Add Ideas to Profile Page
**File:** `frontend/src/pages/Profile.tsx`
**Priority:** Low

Currently shows linked ideas but no way to add new links. Add:
- "Link to Idea" button
- Idea selector modal
- Quick unlink action

---

## Implementation Order

```
Phase 1: Backend (Day 1)
├── 1.1 Add GET /api/ideas/:slug/profile endpoint
└── 1.2 Add profile_id to evaluation_runs (optional, can defer)

Phase 2: Frontend API (Day 1)
├── 2.1 Add TypeScript types
├── 2.2 Add API client functions
└── 2.3 Create useProfiles hook

Phase 3: IdeaDetail (Day 2-3)
├── 3.1 Profile status display
├── 3.2 ProfileSelector component
└── 3.3 Pre-evaluation check

Phase 4: Results (Day 3-4)
├── 4.1 Profile badge in scorecard
├── 4.2 FT confidence indicator
└── 4.3 Synthesis profile context

Phase 5: Profile Page (Future)
└── 5.1 Add idea linking from profile page
```

---

## Component Architecture

```
IdeaDetail.tsx
├── ProfileStatusCard (new)
│   ├── Displays linked profile or warning
│   └── [Change] / [Link] button
├── ProfileSelectorModal (new)
│   ├── Profile list with search
│   ├── Profile preview on select
│   └── Confirm/Cancel actions
├── EvaluationScorecard
│   ├── ProfileBadge (new) - shows which profile was used
│   └── FitCategoryIndicator (new) - shows confidence source
└── SynthesisView
    └── ProfileContext (new) - optional profile summary
```

---

## API Contracts

### New Endpoint: GET /api/ideas/:slug/profile

**Request:**
```
GET /api/ideas/my-great-idea/profile
```

**Response (profile linked):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "name": "John Doe",
    "slug": "john-doe",
    "primary_goals": "[\"income\", \"learning\"]",
    "employment_status": "employed",
    "weekly_hours_available": 20,
    "updated_at": "2025-12-20T10:00:00Z"
  }
}
```

**Response (no profile):**
```json
{
  "success": true,
  "data": null
}
```

---

## UI Mockups

### Profile Status Card (Linked)
```
┌─────────────────────────────────────────────────────────────┐
│ 👤 Evaluating as: John Doe                         [Change] │
│                                                             │
│ Goals: Income, Learning  •  Skills: TypeScript, React       │
│ 20 hrs/week available  •  Medium risk tolerance             │
│                                                             │
│ ℹ️ FT1-FT5 scores will be personalized to this profile      │
└─────────────────────────────────────────────────────────────┘
```

### Profile Status Card (Not Linked)
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ No profile linked                                [Link]  │
│                                                             │
│ Personal Fit scores (FT1-FT5) will default to 5/10 with    │
│ low confidence. Link a profile for accurate evaluation.    │
│                                                             │
│ [Create Profile]  or  [Link Existing]                       │
└─────────────────────────────────────────────────────────────┘
```

### Pre-Evaluation Warning Modal
```
┌─────────────────────────────────────────────────────────────┐
│                    ⚠️ No Profile Linked                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ This idea has no user profile linked.                       │
│                                                             │
│ The evaluation will run, but Personal Fit scores            │
│ (FT1-FT5) will default to 5/10 with low confidence:         │
│                                                             │
│   • FT1: Personal Fit → 5/10                                │
│   • FT2: Passion → 5/10                                     │
│   • FT3: Skills Match → 5/10                                │
│   • FT4: Network → 5/10                                     │
│   • FT5: Life Stage → 5/10                                  │
│                                                             │
│ For accurate scoring, link your profile first.              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Link Profile]    [Evaluate Anyway]         [Cancel]        │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

### Backend Tests
- [ ] GET /api/ideas/:slug/profile returns profile when linked
- [ ] GET /api/ideas/:slug/profile returns null when not linked
- [ ] GET /api/ideas/:slug/profile returns 404 for non-existent idea

### Frontend Tests
- [ ] Profile status displays correctly when linked
- [ ] Profile status shows warning when not linked
- [ ] Profile selector shows all available profiles
- [ ] Linking profile updates UI immediately
- [ ] Unlinking profile updates UI immediately
- [ ] Pre-evaluation warning appears when no profile
- [ ] "Evaluate Anyway" proceeds without profile
- [ ] "Link Profile" opens selector
- [ ] Scorecard shows profile badge when profile was used
- [ ] Scorecard shows warning when no profile was used

### Integration Tests
- [ ] Full flow: Create profile → Link to idea → Evaluate → See personalized FT scores
- [ ] Full flow: Evaluate without profile → See default FT scores with warning

---

## Risk Considerations

### Breaking Changes
- None expected; all changes are additive

### Performance
- Additional API call per idea page load (profile fetch)
- Consider caching profile data in React Query

### Migration
- Existing evaluations run without profile will show "No profile used"
- No data migration required

---

## Success Criteria

1. **Discoverability**: User naturally finds profile linking before evaluation
2. **Clarity**: User understands impact of profile on FT scores
3. **Confidence**: User can verify which profile was used in results
4. **Simplicity**: Linking takes < 3 clicks from idea page
5. **Persistence**: Once linked, profile persists across sessions

---

## Appendix: Related Files

| File | Purpose |
|------|---------|
| `server/api.ts` | Backend API endpoints |
| `scripts/profile.ts` | CLI profile management |
| `scripts/evaluate.ts` | Evaluation orchestration |
| `frontend/src/api/client.ts` | Frontend API client |
| `frontend/src/pages/IdeaDetail.tsx` | Idea detail page |
| `frontend/src/pages/Profile.tsx` | Profile management page |
| `frontend/src/components/EvaluationScorecard.tsx` | Evaluation results |
| `taxonomy/evaluation-criteria.md` | FT1-FT5 definitions |
