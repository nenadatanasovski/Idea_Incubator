# PHASE6-TASK-04: Idea Workspace

**Task**: Idea workspace (README/development editor, linked profiles, Q&A interface)
**Phase**: 6 - Dashboard and User Experience Refinement
**Status**: 📝 Specification
**Created**: February 8, 2026
**Priority**: P1
**Estimated Effort**: Large (5-7 days)

---

## Overview

Create a comprehensive idea workspace interface that consolidates README editing, development.md Q&A management, profile linking, and artifact viewing into a unified development environment. This workspace serves as the primary interface for idea refinement before evaluation.

### Context

Currently, idea development is scattered across multiple interfaces:
- `IdeaDetail.tsx` provides overview and evaluation results
- `DevelopmentWizard` modal handles Q&A
- Profile linking is a separate card
- README/development.md editing requires external text editor
- No unified workspace for iterative idea refinement

This task creates a dedicated workspace page that brings all development activities into a cohesive, productive environment.

### Strategic Alignment

**Phase 6 Goal**: Full-featured dashboard for idea management, evaluation monitoring, and agent interaction

This workspace is the **primary idea development interface** where users spend 80% of their time refining ideas before evaluation. It directly supports:
- Faster iteration cycles (reduced context switching)
- Higher evaluation readiness (inline Q&A + content editing)
- Better profile utilization (visible profile context while editing)
- Artifact-driven development (linked documents guide refinement)

---

## Requirements

### Functional Requirements

#### FR-1: Dual-Pane Editor Layout
- **FR-1.1**: Left pane (60% width): Tabbed editor for README.md and development.md
- **FR-1.2**: Right pane (40% width): Context panel with tabs (Profile, Q&A, Artifacts, History)
- **FR-1.3**: Resizable split (minimum 30%, maximum 80% for either pane)
- **FR-1.4**: Mobile responsive: stacked layout (editor full-width, context below)

#### FR-2: README.md Editor
- **FR-2.1**: Markdown editor with live preview toggle
- **FR-2.2**: Auto-save after 3 seconds of inactivity
- **FR-2.3**: Save indicator (Saved / Saving... / Unsaved changes)
- **FR-2.4**: Character count and word count display
- **FR-2.5**: Markdown toolbar (headings, bold, italic, lists, links, code blocks)
- **FR-2.6**: Syntax highlighting for markdown in edit mode
- **FR-2.7**: Preview mode renders full markdown with styles

#### FR-3: development.md Q&A Interface
- **FR-3.1**: Q&A list showing answered questions (collapsed by default)
- **FR-3.2**: Expandable answers with edit/delete actions
- **FR-3.3**: "Add Answer" button opens inline question answering flow
- **FR-3.4**: Question suggestions based on missing coverage (PROBLEM, SOLUTION, MARKET, etc.)
- **FR-3.5**: Category badges on questions (e.g., "FEASIBILITY", "MARKET")
- **FR-3.6**: Readiness meter showing coverage percentage by category
- **FR-3.7**: Auto-sync to development.md file on answer submit/edit/delete

#### FR-4: Profile Integration
- **FR-4.1**: Profile status card (linked/unlinked) with quick link/unlink actions
- **FR-4.2**: When linked: display profile name, primary goals, constraints, preferences
- **FR-4.3**: Collapsible sections for profile attributes (goals, constraints, skills, context)
- **FR-4.4**: Profile selector modal (same as IdeaDetail.tsx implementation)
- **FR-4.5**: Real-time profile context: show relevant excerpts based on active editor content

#### FR-5: Artifacts Panel
- **FR-5.1**: List of session artifacts (research, code, documents)
- **FR-5.2**: Artifact preview on click (modal or inline expansion)
- **FR-5.3**: Copy artifact content button
- **FR-5.4**: Link artifact to README section (manual association)
- **FR-5.5**: Empty state: "No artifacts yet" with guidance

#### FR-6: Version History
- **FR-6.1**: README change history (last 10 versions)
- **FR-6.2**: Timestamp, character change delta (+120 / -45)
- **FR-6.3**: Restore previous version action
- **FR-6.4**: Diff view comparing current to selected version

#### FR-7: Navigation & State Management
- **FR-7.1**: Route: `/ideas/:slug/workspace`
- **FR-7.2**: Auto-load idea data, profile, Q&A answers, artifacts on mount
- **FR-7.3**: Unsaved changes warning on navigation away
- **FR-7.4**: Keyboard shortcuts: Cmd/Ctrl+S to save, Cmd/Ctrl+P to toggle preview
- **FR-7.5**: "Return to Overview" button → `/ideas/:slug`

### Non-Functional Requirements

#### NFR-1: Performance
- Initial workspace load: <1 second
- Auto-save debounce: 3 seconds
- Editor typing lag: <50ms
- Markdown preview render: <200ms

#### NFR-2: Usability
- Mobile-friendly: stacked layout, touch-friendly controls
- Accessibility: ARIA labels, keyboard navigation, screen reader support
- Visual consistency: Tailwind CSS design system from existing pages

#### NFR-3: Data Integrity
- Auto-save failure handling: retry 3 times, then show error banner
- Optimistic UI updates for Q&A actions
- File conflict detection (if README.md changed externally)

---

## Technical Design

### 1. Component Architecture

```
IdeaWorkspace.tsx (Page Component)
├── WorkspaceHeader.tsx
│   ├── IdeaContextBreadcrumb
│   ├── ReadinessMeter (compact)
│   └── ActionButtons (Save, Evaluate, Return)
├── ResizablePanes.tsx
│   ├── LEFT PANE (60%)
│   │   ├── EditorTabs.tsx
│   │   │   ├── READMETab
│   │   │   │   ├── MarkdownEditor.tsx
│   │   │   │   └── MarkdownPreview.tsx
│   │   │   └── DevelopmentTab
│   │   │       ├── QAList.tsx
│   │   │       ├── QuestionAnswerForm.tsx
│   │   │       └── CategoryCoverageCard.tsx
│   └── RIGHT PANE (40%)
│       ├── ContextTabs.tsx
│       │   ├── ProfileTab
│       │   │   ├── ProfileStatusCard
│       │   │   ├── ProfileDetailsSections
│       │   │   └── ProfileSelector (modal)
│       │   ├── ArtifactsTab
│       │   │   ├── SimpleArtifactList
│       │   │   └── ArtifactPreviewModal
│       │   ├── HistoryTab
│       │   │   ├── VersionList
│       │   │   └── DiffViewer
│       │   └── InsightsTab (future)
│       │       └── AIWritingSuggestions
```

### 2. Data Flow

#### 2.1 Workspace Initialization
```typescript
// On mount: /ideas/:slug/workspace
1. useIdea(slug) → fetch idea metadata
2. useIdeaProfile(slug) → fetch linked profile
3. useDevelopment(slug) → fetch Q&A answers, readiness
4. useSessionData(ideaId) → fetch artifacts (if session exists)
5. useVersionHistory(slug) → fetch README change history
```

#### 2.2 README Auto-Save Flow
```typescript
User types → debounce(3000ms) →
  PATCH /api/ideas/:slug { content: newMarkdown } →
  Update local state (optimistic) →
  On success: set saveStatus = 'saved' →
  On error: retry 3x, then show error banner
```

#### 2.3 Q&A Sync Flow
```typescript
User answers question →
  POST /api/ideas/:slug/development { questionId, answer } →
  Server writes to development.md (append Q&A block) →
  Server updates database (development_answers table) →
  Server recalculates readiness score →
  Return { readiness, coverage } →
  Client updates UI (optimistic Q&A list update + readiness meter)
```

#### 2.4 Profile Link Flow
```typescript
User clicks "Link Profile" →
  ProfileSelector modal opens →
  User selects profile →
  POST /api/ideas/:slug/profile { profileId } →
  Server creates idea_profiles link →
  Client refetches profile data →
  Context panel updates with profile details
```

### 3. API Endpoints

#### 3.1 Existing Endpoints (Reuse)
- `GET /api/ideas/:slug` - Fetch idea metadata
- `PATCH /api/ideas/:slug` - Update idea content (README.md)
- `GET /api/ideas/:slug/development` - Get Q&A answers
- `POST /api/ideas/:slug/development` - Submit Q&A answer
- `DELETE /api/ideas/:slug/development/:questionId` - Delete answer
- `GET /api/ideas/:slug/profile` - Get linked profile
- `POST /api/ideas/:slug/profile` - Link profile
- `DELETE /api/ideas/:slug/profile` - Unlink profile

#### 3.2 New Endpoints Required

**Version History**
```typescript
GET /api/ideas/:slug/history
Response: {
  versions: Array<{
    id: string
    timestamp: string
    contentHash: string
    characterDelta: number // +120, -45
    wordDelta: number
  }>
}
```

**Restore Version**
```typescript
POST /api/ideas/:slug/history/restore
Body: { versionId: string }
Response: { content: string, contentHash: string }
```

**Diff View**
```typescript
GET /api/ideas/:slug/history/diff?from=versionId&to=versionId
Response: {
  diffHtml: string // Unified diff format
  additions: number
  deletions: number
}
```

### 4. Database Schema

#### 4.1 Existing Tables (Reuse)
- `ideas` - Core idea data (id, slug, title, content, etc.)
- `development_answers` - Q&A data (question_id, idea_id, answer, category)
- `idea_profiles` - Profile links (idea_id, profile_id)
- `user_profiles` - Profile data (name, goals, constraints, etc.)

#### 4.2 New Table: idea_versions

```sql
CREATE TABLE idea_versions (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  character_delta INTEGER, -- vs previous version
  word_delta INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_idea_versions_idea_id (idea_id),
  INDEX idx_idea_versions_created (idea_id, created_at DESC)
);
```

**Versioning Strategy**:
- Auto-create version on every README save
- Keep last 50 versions per idea (prune older)
- Store full content (not diffs) for fast retrieval
- Delta calculated on insert (compare to previous version)

### 5. State Management

```typescript
interface WorkspaceState {
  // Editor state
  activeTab: 'readme' | 'development'
  readmeContent: string
  readmeMode: 'edit' | 'preview'
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'
  hasUnsavedChanges: boolean

  // Context state
  contextTab: 'profile' | 'artifacts' | 'history' | 'insights'
  selectedArtifactId: string | null
  selectedVersionId: string | null

  // Data
  idea: IdeaWithScores | null
  profile: UserProfileSummary | null
  answers: Answer[]
  readiness: ReadinessScore | null
  coverage: CriterionCoverage[]
  artifacts: Artifact[]
  versions: IdeaVersion[]

  // UI state
  showProfileSelector: boolean
  showArtifactModal: boolean
  showVersionDiff: boolean
  errorMessage: string | null
}
```

### 6. Custom Hooks

```typescript
// hooks/useWorkspace.ts
export function useWorkspace(slug: string) {
  const idea = useIdea(slug)
  const profile = useIdeaProfile(slug)
  const development = useDevelopment(slug)
  const artifacts = useSessionData(idea.data?.id)
  const versions = useVersionHistory(slug)

  return {
    // Consolidated state
    loading: idea.loading || profile.loading || development.loading,
    error: idea.error || profile.error || development.error,

    // Data
    idea: idea.data,
    profile: profile.data,
    answers: development.answers,
    readiness: development.readiness,
    coverage: development.coverage,
    artifacts: artifacts.data,
    versions: versions.data,

    // Actions
    saveReadme: async (content: string) => { ... },
    submitAnswer: async (questionId: string, answer: string) => { ... },
    deleteAnswer: async (questionId: string) => { ... },
    linkProfile: async (profileId: string) => { ... },
    unlinkProfile: async () => { ... },
    restoreVersion: async (versionId: string) => { ... },
  }
}
```

```typescript
// hooks/useAutoSave.ts
export function useAutoSave(
  content: string,
  onSave: (content: string) => Promise<void>,
  delay = 3000
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const debouncedSave = useMemo(
    () => debounce(async (val: string) => {
      setSaveStatus('saving')
      try {
        await onSave(val)
        setSaveStatus('saved')
      } catch (err) {
        setSaveStatus('error')
      }
    }, delay),
    [onSave, delay]
  )

  useEffect(() => {
    if (content) {
      setSaveStatus('unsaved')
      debouncedSave(content)
    }
  }, [content, debouncedSave])

  return saveStatus
}
```

### 7. Markdown Editor Implementation

**Option A: Textarea + Preview (Simple)**
- Controlled textarea for editing
- Separate ReactMarkdown preview pane
- Pros: Simple, lightweight, full control
- Cons: No syntax highlighting in edit mode

**Option B: BlockNote (Rich)**
- Already used in `ArtifactPanel.tsx` (`@blocknote/react`, `@blocknote/mantine`)
- WYSIWYG-style markdown editing
- Pros: Professional UX, built-in formatting
- Cons: Heavier bundle, learning curve

**Recommendation**: Start with **Option A** (textarea + preview) for MVP. Upgrade to BlockNote in Phase 7 if user feedback demands rich editing.

```typescript
// MarkdownEditor.tsx (Option A)
<div className="flex flex-col h-full">
  <MarkdownToolbar onInsert={handleInsert} />
  <textarea
    value={content}
    onChange={(e) => setContent(e.target.value)}
    className="flex-1 p-4 font-mono text-sm resize-none"
    placeholder="Write your idea description..."
  />
  <div className="flex justify-between p-2 text-xs text-gray-500 border-t">
    <span>{characterCount} characters · {wordCount} words</span>
    <span className={saveStatusColors[saveStatus]}>
      {saveStatusText[saveStatus]}
    </span>
  </div>
</div>
```

---

## Pass Criteria

### P0 (Blocking for Phase 6 completion)

1. **Workspace Page Renders**
   - Route `/ideas/:slug/workspace` loads without errors
   - Dual-pane layout renders on desktop (60/40 split)
   - Mobile: stacked layout with editor above context

2. **README Editor Functions**
   - User can type markdown in editor pane
   - Preview pane renders markdown correctly
   - Auto-save triggers after 3 seconds
   - PATCH /api/ideas/:slug updates README.md file
   - Save status indicator shows "Saved" / "Saving..." / "Unsaved"

3. **Q&A Interface Works**
   - Answered questions display in list
   - User can expand/collapse answers
   - "Add Answer" opens inline question form
   - Submitting answer updates database AND development.md
   - Readiness meter updates on answer submission

4. **Profile Integration**
   - ProfileStatusCard shows linked/unlinked state
   - "Link Profile" opens ProfileSelector modal
   - Selecting profile calls POST /api/ideas/:slug/profile
   - Profile details display in context panel after linking

5. **Navigation & State**
   - "Return to Overview" button navigates to `/ideas/:slug`
   - Unsaved changes warning on navigation (browser confirm)
   - Keyboard shortcuts work: Cmd/Ctrl+S saves

### P1 (Nice to have, defer to Phase 7 if time-constrained)

6. **Artifacts Panel**
   - Artifacts list displays session artifacts
   - Click artifact shows preview modal
   - Copy artifact content button works

7. **Version History**
   - GET /api/ideas/:slug/history returns version list
   - Version list displays last 10 versions with timestamps
   - Restore version action reverts README to selected version

8. **Advanced Features**
   - Diff view compares two versions
   - Resizable panes (drag divider)
   - Markdown toolbar (bold, italic, headings)

### Test Coverage

- **Unit Tests**: MarkdownEditor, QAList, ProfileStatusCard components
- **Integration Tests**: Auto-save flow, Q&A submission, profile linking
- **E2E Tests**: Full workspace flow (load → edit → save → add Q&A → link profile → return)

---

## Dependencies

### Internal Dependencies
- **Completed**:
  - `/api/ideas/:slug` endpoint (exists)
  - `useDevelopment` hook (exists)
  - `useIdeaProfile` hook (exists)
  - `ProfileStatusCard` component (exists)
  - `ProfileSelector` component (exists)

- **Requires Implementation**:
  - `GET /api/ideas/:slug/history` (version history)
  - `POST /api/ideas/:slug/history/restore` (restore version)
  - `idea_versions` table migration
  - `useVersionHistory` hook

### External Dependencies
- `react-markdown` (already in use)
- `@blocknote/react`, `@blocknote/mantine` (already in project, optional)
- `lodash.debounce` or custom debounce (auto-save)

---

## Implementation Plan

### Phase 1: Core Workspace Shell (Days 1-2)
1. Create `IdeaWorkspace.tsx` page component
2. Set up dual-pane layout (ResizablePanes component)
3. Implement EditorTabs with README/Development tabs
4. Build basic MarkdownEditor (textarea + preview toggle)
5. Add WorkspaceHeader with breadcrumb and actions
6. Route: `/ideas/:slug/workspace` in React Router

**Deliverable**: Empty workspace shell with tab navigation

### Phase 2: README Editor (Day 2-3)
7. Implement MarkdownEditor with auto-save
8. Add save status indicator
9. Wire up PATCH /api/ideas/:slug endpoint
10. Add character/word count display
11. Test auto-save debounce logic

**Deliverable**: Functional README editor with auto-save

### Phase 3: Q&A Interface (Day 3-4)
12. Build QAList component (reuse AnswerHistory patterns)
13. Implement QuestionAnswerForm (inline)
14. Wire up POST /api/ideas/:slug/development
15. Add CategoryCoverageCard (readiness meter)
16. Test Q&A submission → development.md sync

**Deliverable**: Working Q&A interface with readiness tracking

### Phase 4: Profile Integration (Day 4)
17. Add ProfileTab to context panel
18. Integrate ProfileStatusCard (reuse from IdeaDetail)
19. Add ProfileSelector modal trigger
20. Wire up link/unlink actions
21. Display profile details in context panel

**Deliverable**: Profile linking works in workspace

### Phase 5: Artifacts & History (Day 5-6)
22. Create `idea_versions` table migration
23. Implement GET /api/ideas/:slug/history endpoint
24. Build VersionList component
25. Add ArtifactsTab with SimpleArtifactList
26. Test version history display

**Deliverable**: Artifacts and version history visible

### Phase 6: Polish & Testing (Day 6-7)
27. Add unsaved changes warning
28. Implement keyboard shortcuts (Cmd/Ctrl+S, Cmd/Ctrl+P)
29. Mobile responsive layout testing
30. Write unit tests for components
31. Write E2E test for full workspace flow
32. Fix bugs, polish UI

**Deliverable**: Production-ready workspace

---

## Success Metrics

### User Engagement
- **Target**: 70% of idea edits happen in workspace (vs external editor)
- **Measure**: Track README saves via workspace vs. sync script

### Idea Quality
- **Target**: 85% readiness score before evaluation
- **Measure**: Average readiness score for ideas edited in workspace

### Time to Evaluation
- **Target**: 30% reduction in time from idea creation to first evaluation
- **Measure**: Median days between created_at and first evaluation run

### Feature Adoption
- **Target**: 60% of ideas have linked profiles
- **Target**: 80% of ideas have ≥5 Q&A answers
- **Measure**: Database statistics (idea_profiles count, development_answers count)

---

## Open Questions

1. **Markdown Editor Choice**: Textarea + preview (simple) or BlockNote (rich)?
   - **Recommendation**: Start simple, upgrade if users request rich editing

2. **Version History Retention**: Keep 50 versions per idea or time-based (30 days)?
   - **Recommendation**: 50 versions + auto-prune on each save

3. **Artifacts Association**: Manual linking or AI auto-suggestions?
   - **Recommendation**: Manual for MVP, AI suggestions in Phase 7

4. **Real-time Collaboration**: Multi-user editing support?
   - **Recommendation**: Defer to Phase 8 (out of scope for v1.0)

---

## Security Considerations

### Authentication
- All API endpoints require user authentication (session/JWT)
- User can only edit ideas they own (ownership check in middleware)

### Input Validation
- Markdown content sanitized before save (prevent XSS)
- Maximum content length: 50,000 characters (prevent DOS)
- Question ID validation (prevent SQL injection)

### Rate Limiting
- Auto-save rate limit: max 1 save per 3 seconds per user
- Q&A submission: max 10 answers per minute per user

---

## Future Enhancements (Phase 7+)

1. **AI Writing Assistant**
   - Inline suggestions for improving README clarity
   - Auto-generate Q&A answers based on README content
   - Grammar/spell check

2. **Collaborative Editing**
   - Real-time multi-user editing (WebSocket-based)
   - User presence indicators
   - Conflict resolution UI

3. **Rich Media Support**
   - Image upload to artifacts
   - Embed artifacts inline in README
   - Video/audio attachments

4. **Advanced Version Control**
   - Branch/merge workflow for ideas
   - Compare any two versions side-by-side
   - Annotated history (label versions with milestones)

---

## References

### Existing Components (Reuse)
- `frontend/src/pages/IdeaDetail.tsx` - Profile linking, Q&A patterns
- `frontend/src/components/ProfileStatusCard.tsx` - Profile display
- `frontend/src/components/ProfileSelector.tsx` - Profile selection modal
- `frontend/src/components/DevelopmentWizard.tsx` - Q&A wizard flow
- `frontend/src/components/AnswerHistory.tsx` - Q&A list display
- `frontend/src/components/ReadinessMeter.tsx` - Readiness visualization
- `frontend/src/components/SimpleArtifactList.tsx` - Artifact display
- `frontend/src/hooks/useQuestions.ts` - Q&A data fetching
- `frontend/src/hooks/useIdeaProfile.ts` - Profile data fetching

### API Routes (Reuse)
- `server/routes/ideas.ts` - README CRUD, idea metadata
- `server/routes/questions.ts` - Q&A submission, development.md sync
- `server/routes/profiles.ts` - Profile linking

### Database Schema
- `schema/entities/idea.ts` - Idea entity definition
- `database/migrations/` - Existing migration patterns

### Strategic Documents
- `STRATEGIC_PLAN.md` - Phase 6 goals
- `TASK_DECOMPOSITION.md` - Phase 6 task breakdown
- `docs/specs/PHASE6-TASK-01-VERIFICATION-COMPLETE.md` - Dashboard patterns

---

**End of Specification**
