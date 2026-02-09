# PHASE6-TASK-04: Idea Workspace Technical Specification

**Task ID**: PHASE6-TASK-04
**Title**: Idea workspace (README/development editor, linked profiles, Q&A interface)
**Phase**: 6 - Dashboard and User Experience Refinement
**Priority**: P1 (High)
**Estimated Effort**: Medium (3-4 days)
**Created**: February 8, 2026
**Status**: Specification

---

## 1. Overview

### 1.1 Purpose

Create a comprehensive idea workspace that consolidates all idea development activities into a single, cohesive interface. This workspace enables users to:
- View and edit idea documentation (README content)
- Manage development notes through Q&A sessions
- Link user profiles for personalized evaluations
- Track evaluation readiness in real-time
- Navigate idea lifecycle and evaluation history

### 1.2 Context

The Idea Incubator system currently has most workspace components implemented across multiple pages and modals. This specification consolidates existing implementations and identifies the remaining gaps to complete a unified workspace experience.

**Current Implementation Status**: 85% complete (verified by PHASE6-TASK-04-VALIDATION-REPORT.md)

### 1.3 Scope

**In Scope:**
- Inline README content editing within workspace (PRIMARY GAP)
- Q&A interface via modal (EXISTING - verified working)
- Profile linking/unlinking (EXISTING - verified working)
- Development notes display (EXISTING - via Q&A answers)
- Evaluation readiness tracking (EXISTING - verified working)
- Workspace layout and navigation (EXISTING - verified working)

**Out of Scope:**
- Real-time collaborative editing
- Version comparison and diff views
- External integrations (GitHub, Notion, etc.)
- Advanced markdown editor features (WYSIWYG, toolbar)
- Automated content generation beyond Q&A

---

## 2. Requirements

### 2.1 Functional Requirements

#### FR-1: Idea Workspace Page
**Status**: ✅ IMPLEMENTED (`frontend/src/pages/IdeaDetail.tsx`)

The workspace MUST provide:
- Multi-tab interface for different views (Overview, Develop, Lifecycle, Scorecard, etc.)
- Comprehensive idea metadata display (title, type, status, tags, lifecycle stage)
- Quick actions (Edit, Delete, Evaluate, Branch, History)
- Real-time evaluation score display
- Navigation between related ideas

**Implementation**: IdeaDetail.tsx (818 lines) - COMPLETE

#### FR-2: Q&A Development Interface
**Status**: ✅ IMPLEMENTED (`frontend/src/components/DevelopmentWizard.tsx`)

The Q&A interface MUST provide:
- Modal-based wizard overlaying the workspace
- Two-tab interface:
  - **Session Tab**: Guided step-by-step questioning (5-10 questions)
  - **All Questions Tab**: Browse all questions by category (50+)
- Dynamic question generation based on idea type and answered questions
- Category grouping (Problem, Solution, Market, Feasibility, Risk, Fit)
- Priority indicators (P0 critical, P1 important, P2 nice-to-have, P3 optional)
- Answer persistence to database (immediate save)
- Real-time readiness score updates
- Progress tracking (answered/total per category)
- Answer history display in Develop tab

**Implementation**: DevelopmentWizard.tsx (815 lines) - COMPLETE

**Data Flow**:
```
User clicks "Develop Idea" button
  ↓
DevelopmentWizard modal opens
  ↓
POST /api/ideas/:slug/develop (start session)
  ↓
Receive 5-10 initial questions
  ↓
User answers via QuestionCard component
  ↓
POST /api/ideas/:slug/answers (save answer)
  ↓
Readiness score recalculated
  ↓
Next questions generated based on answers
  ↓
User closes modal → AnswerHistory displays in Develop tab
```

#### FR-3: Profile Linking
**Status**: ✅ IMPLEMENTED (`frontend/src/components/ProfileSelector.tsx`)

The profile system MUST provide:
- One-click profile linking from workspace
- Profile selector modal with search functionality
- Display of currently linked profile
- Profile unlinking capability
- Profile context integration in evaluations (Feasibility, Market, Risk, Fit)
- Visual indicator when no profile linked (impacts Fit score accuracy)

**Implementation**: ProfileSelector.tsx (185 lines), ProfileStatusCard.tsx (131 lines) - COMPLETE

**Data Flow**:
```
User clicks "Link Profile" button
  ↓
ProfileSelector modal opens
  ↓
Display all user profiles with search
  ↓
User selects profile
  ↓
PUT /api/ideas/:slug/profile (link profile to idea)
  ↓
Profile context extracted for evaluations
  ↓
ProfileStatusCard displays linked profile
```

#### FR-4: README Content Editing (INLINE)
**Status**: ❌ NOT IMPLEMENTED (GAP)

The README editor MUST provide:
- **Inline editing mode** within Overview tab (no navigation to separate page)
- Toggle between view and edit modes with clear UI affordance
- Markdown text editor (textarea or Monaco-based)
- Optional: Side-by-side markdown preview
- Save/Cancel actions with confirmation on unsaved changes
- Auto-save or save-on-blur option (configurable)
- Markdown syntax support indication
- Content validation (max length, required fields)

**Current Limitation**: Content editing requires navigation to `/ideas/:slug/edit` page (IdeaForm.tsx)

**Required Changes**:
1. Add edit mode state to IdeaDetail.tsx Overview tab
2. Create ContentEditor component (inline textarea with preview)
3. Add Edit/Save/Cancel buttons to Overview tab header
4. Implement auto-save or save confirmation
5. Handle tab switching with unsaved changes

#### FR-5: Development Notes Display
**Status**: ⚠️ PARTIAL (via Q&A only)

The development notes MUST:
- Display Q&A answers in chronological order (IMPLEMENTED via AnswerHistory)
- Show development.md content (synced from Q&A answers) (IMPLEMENTED via sync)
- Optionally: Allow manual editing of development.md (NOT IMPLEMENTED)
- Group answers by category (IMPLEMENTED)
- Show answer timestamps and edit history (IMPLEMENTED)

**Implementation**: AnswerHistory.tsx (144 lines) - MOSTLY COMPLETE

#### FR-6: Evaluation Readiness Tracking
**Status**: ✅ IMPLEMENTED (`frontend/src/components/ReadinessMeter.tsx`)

The readiness system MUST:
- Calculate overall readiness score (0-100%)
- Break down coverage by category (Problem, Solution, Market, etc.)
- Identify blocking gaps (critical unanswered questions)
- Display visual progress bars per category
- Indicate when idea is ready for evaluation (threshold: 70%)
- Update in real-time as answers are submitted

**Implementation**: ReadinessMeter.tsx (234 lines) - COMPLETE

### 2.2 Non-Functional Requirements

#### NFR-1: Performance
- Workspace page load time: < 2 seconds
- Q&A modal open time: < 500ms
- Answer submission response: < 1 second
- Real-time readiness updates: < 300ms
- Inline editor mode toggle: < 100ms (instantaneous feel)

#### NFR-2: Usability
- Single-click access to all workspace features (no deep navigation)
- Clear visual hierarchy (primary actions prominent)
- Consistent UI patterns with Parent Harness dashboard
- Mobile-responsive layout (works on tablets)
- Keyboard shortcuts for common actions (Edit: E, Save: Ctrl+S)

#### NFR-3: Data Integrity
- Auto-save prevents data loss on network failure
- Optimistic UI updates with rollback on error
- Conflict detection for concurrent edits (same idea, multiple tabs)
- Markdown sync: development.md ↔ database bidirectional
- Profile context always reflects latest profile data

#### NFR-4: Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation for all features
- Screen reader support for modal dialogs
- Clear focus indicators
- Color contrast ratios meet standards

---

## 3. Technical Design

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     IdeaDetail.tsx                          │
│                  (Workspace Container)                       │
├─────────────────────────────────────────────────────────────┤
│  Header: Title, Type, Status, Score, Profile Badge          │
├─────────────────────────────────────────────────────────────┤
│  Actions: Develop | Evaluate | Edit | Branch | Delete       │
├─────────────────────────────────────────────────────────────┤
│  Profile: ProfileStatusCard (Link/Unlink)                   │
├─────────────────────────────────────────────────────────────┤
│  Lifecycle: LifecycleTimeline (visual progress)             │
├─────────────────────────────────────────────────────────────┤
│  Tabs: [Overview] [Develop] [Lifecycle] [Scorecard] ...    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Overview Tab:                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ README Content                    [Edit Icon]      │    │
│  │                                                     │    │
│  │ [View Mode: ReactMarkdown rendering]               │    │
│  │                                                     │    │
│  │ OR                                                  │    │
│  │                                                     │    │
│  │ [Edit Mode: ContentEditor component]               │    │
│  │  ┌──────────────────┬──────────────────┐          │    │
│  │  │ Textarea         │ Live Preview     │          │    │
│  │  │ (markdown input) │ (ReactMarkdown)  │          │    │
│  │  └──────────────────┴──────────────────┘          │    │
│  │  [Save] [Cancel]                                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Develop Tab:                                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ReadinessMeter (progress bars by category)         │    │
│  │ [Develop Idea Button] → Opens DevelopmentWizard    │    │
│  │ AnswerHistory (list of Q&A responses)              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Modals (Overlays):
┌─────────────────────────────────────────────────────────────┐
│  DevelopmentWizard                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Session Tab] [All Questions Tab]                    │   │
│  │ QuestionCard (dynamic questions)                     │   │
│  │ ReadinessMeter (sidebar)                             │   │
│  │ [Save & Close] [Proceed to Evaluation]              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  ProfileSelector                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Search: [___________]                                │   │
│  │ Profile List (name, goals, role)                     │   │
│  │ [Cancel] [Link Profile]                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Component Structure

#### Existing Components (Verified Working)

```typescript
// Main workspace container
IdeaDetail.tsx (818 lines)
  ├── ProfileStatusCard.tsx (131 lines) - Profile display/link/unlink
  ├── LifecycleTimeline.tsx - Stage visualization
  ├── ReadinessMeter.tsx (234 lines) - Readiness tracking
  ├── DevelopmentWizard.tsx (815 lines) - Q&A modal
  │   ├── QuestionCard.tsx (296 lines) - Individual question UI
  │   └── ReadinessMeter.tsx (sidebar variant)
  ├── AnswerHistory.tsx (144 lines) - Q&A response list
  ├── ProfileSelector.tsx (185 lines) - Profile picker modal
  ├── EvaluationScorecard.tsx - Detailed scores
  ├── EvaluationDashboard.tsx - Visual analytics
  ├── RedTeamView.tsx - Adversarial analysis
  └── SynthesisView.tsx - Recommendations

// Edit page (separate navigation)
EditIdea.tsx (73 lines)
  └── IdeaForm.tsx (268 lines) - Content editor (textarea)
```

#### New Component Required

```typescript
// frontend/src/components/ContentEditor.tsx (NEW)
interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  preview?: boolean; // Toggle side-by-side preview
}

export default function ContentEditor({
  value,
  onChange,
  onSave,
  onCancel,
  saving = false,
  preview = false,
}: ContentEditorProps) {
  const [showPreview, setShowPreview] = useState(preview);

  return (
    <div className="content-editor">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className={`grid gap-4 ${showPreview ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Markdown Input */}
        <div>
          <label className="text-sm text-gray-500 mb-1">Markdown Editor</label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={20}
            className="w-full font-mono text-sm border rounded p-3"
            placeholder="Write your idea description in markdown..."
          />
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div>
            <label className="text-sm text-gray-500 mb-1">Preview</label>
            <div className="border rounded p-3 markdown-content">
              <ReactMarkdown>{value}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Markdown formatting supported. Changes are saved manually.
      </p>
    </div>
  );
}
```

### 3.3 Data Flow

#### Content Editing Flow

```
User views idea in Overview tab (IdeaDetail.tsx)
  ↓
[View Mode: ReactMarkdown displays idea.content]
  ↓
User clicks Edit icon
  ↓
setIsEditingContent(true)
  ↓
[Edit Mode: ContentEditor component renders]
  ↓
User edits markdown in textarea
  ↓
onChange updates local state (editedContent)
  ↓
User clicks "Save Changes"
  ↓
PUT /api/ideas/:slug { content: editedContent }
  ↓
API validates and updates database
  ↓
Success: setIsEditingContent(false), refetch()
  ↓
[View Mode: Updated content displayed]
```

#### Unsaved Changes Handling

```
User editing content in Overview tab
  ↓
User clicks different tab (e.g., "Develop")
  ↓
Check: hasUnsavedChanges = editedContent !== idea.content
  ↓
IF hasUnsavedChanges:
  ↓
  Show confirmation dialog:
  "You have unsaved changes. Save before switching tabs?"
  [Save & Switch] [Discard & Switch] [Cancel]
  ↓
  User choice:
    - Save & Switch: Save content, then switch tab
    - Discard & Switch: Reset content, switch tab
    - Cancel: Stay on current tab
ELSE:
  ↓
  Switch tab immediately
```

### 3.4 API Endpoints

#### Existing Endpoints (Verified Working)

```typescript
// Idea Management
GET    /api/ideas/:slug              // Get idea details
PUT    /api/ideas/:slug              // Update idea (including content)
DELETE /api/ideas/:slug              // Delete idea
PATCH  /api/ideas/:slug/stage        // Update lifecycle stage

// Q&A Development
POST   /api/ideas/:slug/develop      // Start development session
POST   /api/ideas/:slug/answers      // Save answer
GET    /api/ideas/:slug/answers      // Get all answers
GET    /api/ideas/:slug/questions    // Get readiness + questions
GET    /api/ideas/:slug/questions/all // Get all questions grouped
GET    /api/ideas/:slug/questions/smart // Smart question selection
DELETE /api/ideas/:slug/answers/:id  // Delete answer

// Profile Management
PUT    /api/ideas/:slug/profile      // Link profile to idea
DELETE /api/ideas/:slug/profile      // Unlink profile
GET    /api/profiles                 // List user profiles
GET    /api/profiles/:id             // Get profile details

// Evaluation
POST   /api/ideas/:slug/evaluate     // Trigger evaluation
GET    /api/ideas/:slug/evaluations  // Get evaluation runs
GET    /api/ideas/:slug/synthesis    // Get synthesis results
```

#### Update Endpoint Enhancement

```typescript
// PUT /api/ideas/:slug
// Enhanced to support partial updates for inline editing

interface UpdateIdeaRequest {
  title?: string;
  summary?: string;
  content?: string;        // ← Inline content editing
  idea_type?: IdeaType;
  lifecycle_stage?: LifecycleStage;
  tags?: string[];
  partial?: boolean;       // ← Flag for partial update
}

// Implementation in server/routes/ideas.ts
router.put('/:slug', async (req, res) => {
  const { slug } = req.params;
  const updates = req.body;

  // Validate partial update
  if (updates.partial) {
    // Only update provided fields
    const allowedFields = ['title', 'summary', 'content', 'tags'];
    const updateData = pick(updates, allowedFields);

    // Update database
    await db.query(
      `UPDATE ideas SET ${buildUpdateQuery(updateData)} WHERE slug = ?`,
      [...Object.values(updateData), slug]
    );
  } else {
    // Full update (existing behavior)
    // ...
  }

  // Return updated idea
  const idea = await getIdea(slug);
  res.json({ success: true, data: idea });
});
```

### 3.5 State Management

#### IdeaDetail Component State

```typescript
// frontend/src/pages/IdeaDetail.tsx

export default function IdeaDetail() {
  // Existing state
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showDevelopWizard, setShowDevelopWizard] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);

  // NEW: Inline editing state
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize edited content when entering edit mode
  const handleStartEdit = () => {
    setEditedContent(idea?.content || "");
    setIsEditingContent(true);
  };

  // Save content
  const handleSaveContent = async () => {
    if (!slug) return;
    setIsSavingContent(true);
    try {
      await updateIdea(slug, { content: editedContent, partial: true });
      setIsEditingContent(false);
      setHasUnsavedChanges(false);
      refetch(); // Reload idea data
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsSavingContent(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (confirm("Discard unsaved changes?")) {
        setIsEditingContent(false);
        setHasUnsavedChanges(false);
      }
    } else {
      setIsEditingContent(false);
    }
  };

  // Track unsaved changes
  useEffect(() => {
    if (isEditingContent) {
      setHasUnsavedChanges(editedContent !== (idea?.content || ""));
    }
  }, [editedContent, idea?.content, isEditingContent]);

  // Warn on tab switch with unsaved changes
  const handleTabChange = (newTab: TabId) => {
    if (hasUnsavedChanges) {
      const choice = confirm(
        "You have unsaved changes. Save before switching tabs?\n\n" +
        "OK = Save & Switch | Cancel = Stay on current tab"
      );
      if (choice) {
        handleSaveContent().then(() => setActiveTab(newTab));
      }
      // If user cancels, stay on current tab
    } else {
      setActiveTab(newTab);
    }
  };

  // Warn on navigation away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
```

### 3.6 Database Schema

#### Existing Tables (No Changes Required)

```sql
-- Ideas table (stores README content)
CREATE TABLE ideas (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,              -- ← README markdown content
  idea_type TEXT NOT NULL,
  lifecycle_stage TEXT NOT NULL,
  tags TEXT,                 -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- ... other fields
);

-- Question answers (development notes)
CREATE TABLE question_answers (
  id TEXT PRIMARY KEY,
  idea_slug TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (idea_slug) REFERENCES ideas(slug) ON DELETE CASCADE
);

-- Profile linking
CREATE TABLE idea_profiles (
  id TEXT PRIMARY KEY,
  idea_slug TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  FOREIGN KEY (idea_slug) REFERENCES ideas(slug) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  UNIQUE(idea_slug) -- One profile per idea
);

-- User profiles
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  primary_goals TEXT,        -- JSON array
  employment_status TEXT,
  weekly_hours_available INTEGER,
  -- ... other profile fields
);
```

---

## 4. Implementation Plan

### 4.1 Task Breakdown

#### Task 1: Create ContentEditor Component (2 hours)
- Create `frontend/src/components/ContentEditor.tsx`
- Implement textarea with markdown input
- Add optional side-by-side preview mode
- Add Save/Cancel buttons with loading states
- Add keyboard shortcuts (Ctrl+S to save, Esc to cancel)
- Style with Tailwind CSS matching workspace theme

**Files to Create:**
- `frontend/src/components/ContentEditor.tsx` (~150 lines)

**Tests to Add:**
- `frontend/src/components/ContentEditor.test.tsx` (render, onChange, onSave, keyboard shortcuts)

#### Task 2: Integrate ContentEditor into IdeaDetail Overview Tab (3 hours)
- Add edit mode state to IdeaDetail.tsx
- Add Edit icon/button to Overview tab header
- Implement edit mode toggle (view ↔ edit)
- Handle Save/Cancel actions
- Track unsaved changes state
- Implement tab switch confirmation with unsaved changes
- Add beforeunload warning for unsaved changes

**Files to Modify:**
- `frontend/src/pages/IdeaDetail.tsx` (~50 lines added)

**Tests to Update:**
- `frontend/src/pages/IdeaDetail.test.tsx` (edit mode, unsaved changes)

#### Task 3: Update API for Partial Content Updates (1 hour)
- Enhance `PUT /api/ideas/:slug` to support partial updates
- Add validation for partial update fields
- Return updated idea with new content
- Add error handling for concurrent edits (optional: optimistic locking)

**Files to Modify:**
- `server/routes/ideas.ts` (~30 lines modified)
- `frontend/src/api/client.ts` (add partial flag to updateIdea)

**Tests to Add:**
- `tests/api/ideas-partial-update.test.ts` (partial content update)

#### Task 4: Testing & Documentation (2 hours)
- Manual testing: edit flow, unsaved changes, errors
- E2E test: navigate to idea, edit content, save, verify
- Update user documentation with inline editing workflow
- Update PHASE6-TASK-04-VALIDATION-REPORT.md to 100% complete

**Files to Create/Update:**
- `tests/e2e/idea-workspace-editing.test.ts` (new E2E test)
- `docs/user-guide/idea-workspace.md` (update with inline editing)
- `PHASE6-TASK-04-VALIDATION-REPORT.md` (update status to 100%)

### 4.2 Implementation Order

1. **Day 1 (Morning)**: Task 1 - Create ContentEditor component
2. **Day 1 (Afternoon)**: Task 2 - Integrate into IdeaDetail
3. **Day 2 (Morning)**: Task 3 - Update API endpoints
4. **Day 2 (Afternoon)**: Task 4 - Testing & documentation

**Total Estimated Time**: 8 hours (1 day of focused development)

### 4.3 Verification Steps

#### Manual Testing Checklist

```
□ Navigate to /ideas/:slug
□ Verify Overview tab displays README content (view mode)
□ Click Edit icon → verify editor appears
□ Edit markdown content in textarea
□ Toggle preview → verify live rendering
□ Click Cancel → verify content reverts
□ Edit again → modify content
□ Click Save → verify success message
□ Verify content updates in view mode
□ Edit content → switch tabs without saving
□ Verify confirmation dialog appears
□ Choose "Save & Switch" → verify content saved
□ Edit content → navigate away (browser back)
□ Verify beforeunload warning appears
□ Edit content → save → verify in database
□ Reload page → verify changes persisted
```

#### Automated Tests

```bash
# Unit tests
npm test -- ContentEditor.test.tsx
npm test -- IdeaDetail.test.tsx

# API tests
npm test -- ideas-partial-update.test.ts

# E2E tests
npm run test:e2e -- idea-workspace-editing.test.ts

# Full test suite
npm test
```

---

## 5. Pass Criteria

### 5.1 Functional Pass Criteria

✅ **PC-1**: User can toggle between view and edit modes in Overview tab with single click

✅ **PC-2**: Markdown editor supports inline editing with textarea (minimum viable)

✅ **PC-3**: Side-by-side preview mode available (optional toggle)

✅ **PC-4**: Save button persists changes to database via PUT /api/ideas/:slug

✅ **PC-5**: Cancel button discards changes and returns to view mode

✅ **PC-6**: Unsaved changes trigger confirmation on tab switch

✅ **PC-7**: Unsaved changes trigger browser beforeunload warning

✅ **PC-8**: Q&A interface opens via "Develop Idea" button (existing)

✅ **PC-9**: Profile linking works via ProfileSelector modal (existing)

✅ **PC-10**: Answer history displays in Develop tab (existing)

✅ **PC-11**: Readiness score updates in real-time (existing)

### 5.2 Non-Functional Pass Criteria

✅ **PC-12**: Edit mode toggle happens in < 100ms (instantaneous feel)

✅ **PC-13**: Content save request completes in < 2 seconds

✅ **PC-14**: Workspace remains responsive during save (optimistic UI)

✅ **PC-15**: No data loss on network failure (retry mechanism)

✅ **PC-16**: TypeScript compilation passes with no errors

✅ **PC-17**: All existing tests continue to pass (1773+ tests)

✅ **PC-18**: New tests added for ContentEditor component

✅ **PC-19**: E2E test covers complete editing workflow

### 5.3 Integration Pass Criteria

✅ **PC-20**: Inline editing integrates seamlessly with existing workspace UI

✅ **PC-21**: Edit mode respects lifecycle stage restrictions (e.g., locked ideas)

✅ **PC-22**: Content changes trigger re-evaluation staleness check

✅ **PC-23**: Markdown sync: database → filesystem (for evaluation cache)

✅ **PC-24**: All workspace features accessible from single page (no deep navigation)

---

## 6. Dependencies

### 6.1 Internal Dependencies

- ✅ IdeaDetail.tsx workspace page (COMPLETE)
- ✅ DevelopmentWizard.tsx Q&A modal (COMPLETE)
- ✅ ProfileSelector.tsx profile linking (COMPLETE)
- ✅ API endpoints for ideas, answers, profiles (COMPLETE)
- ✅ Database schema with ideas, question_answers, idea_profiles (COMPLETE)
- ✅ Markdown sync script (COMPLETE)

### 6.2 External Dependencies

- React 19 (installed)
- ReactMarkdown library (installed)
- Tailwind CSS 4 (installed)
- TypeScript 5.x (installed)
- Vite build system (installed)

### 6.3 Blocking Issues

**None** - All dependencies are satisfied. Implementation can proceed immediately.

---

## 7. Risks & Mitigations

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Concurrent edits overwrite changes | Low | Medium | Add optimistic locking (version field) or last-write-wins with warning |
| Large content causes performance issues | Low | Low | Add content length validation (max 50KB) |
| Markdown rendering XSS vulnerability | Low | High | Use react-markdown with default sanitization (already implemented) |
| Unsaved changes lost on browser crash | Medium | Low | Consider localStorage auto-save backup (future enhancement) |

### 7.2 UX Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users forget to save changes | Medium | Low | Clear visual indicator (unsaved badge), beforeunload warning |
| Edit mode confuses users | Low | Low | Clear UI affordance (Edit icon, mode indicator) |
| Preview mode clutters UI | Low | Low | Make preview optional, default to textarea-only |

### 7.3 Integration Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing IdeaForm.tsx edit page | Low | Medium | Keep edit page functional, deprecate gradually |
| Conflicts with evaluation staleness | Low | Medium | Content change updates `updated_at`, triggers re-eval check |

---

## 8. Future Enhancements

### 8.1 Short-term (Phase 7-8)

1. **Rich Markdown Toolbar**
   - Formatting buttons (bold, italic, heading, link, image)
   - Insert code blocks, lists, tables
   - Keyboard shortcuts overlay

2. **Auto-save with Debouncing**
   - Save draft every 30 seconds
   - Visual indicator: "Last saved 2 minutes ago"
   - localStorage backup on network failure

3. **Manual development.md Editing**
   - Add "Development Notes" section to Develop tab
   - Display raw development.md markdown
   - Inline editor for manual edits
   - Sync back to filesystem

### 8.2 Long-term (Phase 9+)

1. **Collaborative Editing**
   - WebSocket-based real-time editing
   - Presence indicators (who's viewing/editing)
   - Operational transformation for conflict resolution
   - Comment threads on sections

2. **Version Comparison**
   - Diff view between versions
   - Rollback to previous version
   - Timeline scrubber

3. **AI-Powered Suggestions**
   - Auto-generate sections from Q&A answers
   - Suggest improvements based on evaluation feedback
   - Template insertion (problem statement, solution, etc.)

4. **Advanced Editor Features**
   - Monaco editor (VS Code-style)
   - Syntax highlighting for code blocks
   - Spell check and grammar suggestions
   - Image upload and management

---

## 9. Success Metrics

### 9.1 Development Metrics

- Implementation time: 8 hours (target) vs. actual
- Code coverage: 80%+ for new components
- Test pass rate: 100% (all 1773+ tests)
- TypeScript errors: 0

### 9.2 User Metrics (Post-Deployment)

- Time to edit README: < 3 clicks (vs. 5 clicks via separate page)
- Edit success rate: > 95% (successful saves)
- User satisfaction: Inline editing preferred over separate page
- Feature usage: 70%+ of users edit inline vs. separate page

### 9.3 Quality Metrics

- Bug reports: < 2 bugs per 100 edits
- Data loss incidents: 0 (prevent with auto-save/warnings)
- Performance: 95th percentile save time < 2 seconds

---

## 10. References

### 10.1 Related Documents

- `PHASE6-TASK-04-VALIDATION-REPORT.md` - Current implementation status (85% complete)
- `STRATEGIC_PLAN.md` - Phase 6 overview and objectives
- `docs/specs/PHASE6-TASK-01-VERIFICATION-COMPLETE.md` - Task tracking dashboard spec
- `frontend/src/pages/IdeaDetail.tsx` - Existing workspace implementation
- `frontend/src/components/DevelopmentWizard.tsx` - Q&A interface implementation

### 10.2 API Documentation

- `server/routes/ideas.ts` - Ideas API endpoints
- `server/routes/questions.ts` - Q&A API endpoints
- `server/routes/profiles.ts` - Profile API endpoints

### 10.3 Design Patterns

- Parent Harness dashboard UI patterns (Tailwind CSS 4)
- React 19 concurrent features (useTransition for optimistic updates)
- Form state management (controlled components)
- Modal overlay patterns (DevelopmentWizard, ProfileSelector)

---

## 11. Appendix

### 11.1 Code Examples

#### Example: IdeaDetail Overview Tab with Inline Editing

```typescript
// frontend/src/pages/IdeaDetail.tsx (Overview tab section)

{activeTab === "overview" && (
  <div className="space-y-6">
    {/* Evaluation Readiness Mini-Indicator */}
    {readiness && !developmentLoading && (
      <div className="card">
        <h3 className="text-sm font-medium text-gray-500 mb-2">
          Evaluation Readiness
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className={clsx(
                "h-2 rounded-full transition-all duration-300",
                readiness.overall >= 0.7
                  ? "bg-green-500"
                  : readiness.overall >= 0.4
                    ? "bg-yellow-500"
                    : "bg-red-400"
              )}
              style={{ width: `${Math.round(readiness.overall * 100)}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700 min-w-[3rem]">
            {Math.round(readiness.overall * 100)}%
          </span>
        </div>
      </div>
    )}

    {/* README Content Section */}
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">README</h3>
        {!isEditingContent ? (
          <button
            onClick={handleStartEdit}
            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 hover:underline"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-xs text-amber-600 font-medium">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleCancelEdit}
              disabled={isSavingContent}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveContent}
              disabled={isSavingContent || !hasUnsavedChanges}
              className="btn btn-primary text-sm"
            >
              {isSavingContent ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* View or Edit Mode */}
      {!isEditingContent ? (
        <div className="markdown-content">
          {idea.content ? (
            <ReactMarkdown>{idea.content}</ReactMarkdown>
          ) : (
            <p className="text-gray-500 italic">
              No content available. Click Edit to add a description.
            </p>
          )}
        </div>
      ) : (
        <ContentEditor
          value={editedContent}
          onChange={setEditedContent}
          onSave={handleSaveContent}
          onCancel={handleCancelEdit}
          saving={isSavingContent}
          preview={true}
        />
      )}
    </div>
  </div>
)}
```

### 11.2 Testing Examples

#### Example: ContentEditor Unit Test

```typescript
// frontend/src/components/ContentEditor.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ContentEditor from './ContentEditor';

describe('ContentEditor', () => {
  it('renders textarea with initial value', () => {
    render(
      <ContentEditor
        value="# Test Content"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('# Test Content');
  });

  it('calls onChange when text is edited', () => {
    const onChange = vi.fn();
    render(
      <ContentEditor
        value=""
        onChange={onChange}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'New content' } });

    expect(onChange).toHaveBeenCalledWith('New content');
  });

  it('calls onSave when Save button clicked', () => {
    const onSave = vi.fn();
    render(
      <ContentEditor
        value="Content"
        onChange={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalled();
  });

  it('shows preview when toggle clicked', () => {
    render(
      <ContentEditor
        value="# Heading"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const toggleButton = screen.getByText('Show Preview');
    fireEvent.click(toggleButton);

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument();
  });

  it('disables buttons when saving', () => {
    render(
      <ContentEditor
        value="Content"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        saving={true}
      />
    );

    expect(screen.getByText('Saving...')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });
});
```

---

## 12. Sign-off

**Specification Author**: Spec Agent (Autonomous)
**Specification Date**: February 8, 2026
**Specification Version**: 1.0

**Review Required From**:
- [ ] Development Lead (implementation feasibility)
- [ ] UX Designer (UI/UX patterns)
- [ ] QA Lead (test coverage)
- [ ] Product Owner (feature completeness)

**Approval Status**: PENDING REVIEW

**Implementation Status**: NOT STARTED (awaiting approval)

---

**END OF SPECIFICATION**
