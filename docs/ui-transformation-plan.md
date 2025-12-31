# UI Transformation Plan: First Principles Analysis and Implementation Guide

## Executive Summary

This document provides a comprehensive analysis of the Idea Incubator UI issues and a structured implementation plan to address them. The analysis applies first principles reasoning to identify root causes and proposes solutions that improve usability, reduce cognitive load, and maximize information density without sacrificing clarity.

---

## Part 1: First Principles Analysis

### The Core Problem

The UI fails to answer three fundamental questions that users have at any moment:

1. **Where am I?** - Navigation context is lost on scroll
2. **What am I working on?** - Idea context disappears after initial view
3. **What should I do next?** - Actions are buried in long scrolling pages

### Root Cause Analysis

| Symptom | Root Cause | First Principle Violated |
|---------|-----------|-------------------------|
| Dead space | Components designed in isolation without considering context | **Information Density** - Screen real estate is valuable |
| Non-fixed navigation | Traditional page-scroll paradigm vs. app-like experience | **Spatial Consistency** - UI landmarks should remain constant |
| Excessive scrolling | Flat content structure instead of progressive disclosure | **Cognitive Load** - Users can only process ~7 items at once |
| Full-width containers | One-size-fits-all layout approach | **Content-Form Fit** - Container size should match content |
| Lost idea context | Content hierarchy not reflecting importance | **Context Persistence** - Critical info should always be visible |

---

## Part 2: Detailed Issue Analysis

### Issue 1: Non-Fixed Navigation

**Current State:**
- [Layout.tsx:22-67](frontend/src/components/Layout.tsx#L22-L67): Header uses static positioning (`<header className="bg-white border-b...">`)
- No sticky/fixed positioning on main navigation
- [IncubationStepper.tsx](frontend/src/components/IncubationStepper.tsx): Left sidebar scrolls with page

**Impact:**
- Users lose context about which section/phase they're in
- Navigation requires scrolling back to top
- Disorienting on long pages like Evaluate

**Additional Examples Found:**
- [ClarifyPhaseContent.tsx:471-472](frontend/src/components/ClarifyPhaseContent.tsx#L471-L472): ReadinessMeter sidebar has `sticky top-4` but parent container isn't properly configured for this to work across the full page height
- [IdeaDetailPhased.tsx:576](frontend/src/pages/IdeaDetailPhased.tsx#L576): Main grid doesn't support sticky sidebar behavior properly

---

### Issue 2: Dead Space (Horizontal & Vertical)

**Current State:**

**Example 1: EvaluatePhaseContent**
- [PhaseContainer.tsx:147-179](frontend/src/components/PhaseContainer.tsx#L147-L179): "Evaluation Complete" card uses full width with centered content
- 96px (w-24 h-24) circle with just score inside
- Large padding and margins create excessive whitespace

**Example 2: Dashboard Stats**
- [Dashboard.tsx:68-124](frontend/src/pages/Dashboard.tsx#L68-L124): Stats cards have minimal content but take 1/4 of viewport width each
- Each stat is just an icon + 2 lines of text but gets its own card

**Example 3: EvaluationDashboard**
- [EvaluationDashboard.tsx:102-123](frontend/src/components/EvaluationDashboard.tsx#L102-L123): Overall Score card takes full width for what could be a compact header
- [EvaluationDashboard.tsx:131-154](frontend/src/components/EvaluationDashboard.tsx#L131-L154): Radar chart has fixed h-80 (320px) height regardless of content

**Example 4: Empty States**
- [EvaluationScorecard.tsx:350-363](frontend/src/components/EvaluationScorecard.tsx#L350-L363): "No Evaluation Yet" uses `py-12` padding
- [SynthesisView.tsx:57-67](frontend/src/components/SynthesisView.tsx#L57-L67): Same pattern with excessive vertical padding

**Example 5: RedTeamView Stats**
- [RedTeamView.tsx:126-156](frontend/src/components/RedTeamView.tsx#L126-L156): Three stat cards (`grid-cols-3`) that could be a compact inline row

---

### Issue 3: Full-Width Containers

**Current State:**

**Example 1: ProfileStatusCard**
- [IdeaDetailPhased.tsx:568-573](frontend/src/pages/IdeaDetailPhased.tsx#L568-L573): ProfileStatusCard placed as standalone full-width element
- [ProfileStatusCard.tsx](frontend/src/components/ProfileStatusCard.tsx): Already compact design but forced into full-width placement

**Example 2: EvaluatePhaseContent**
- [PhaseContainer.tsx:149-177](frontend/src/components/PhaseContainer.tsx#L149-L177): Entire evaluation result inside a card that spans 3 columns

**Example 3: PhaseContainer Header**
- [PhaseContainer.tsx:29-50](frontend/src/components/PhaseContainer.tsx#L29-L50): Phase header takes full width when it could be integrated into a more compact header section

**Example 4: Lifecycle Distribution**
- [Dashboard.tsx:237-261](frontend/src/pages/Dashboard.tsx#L237-L261): Uses `lg:col-span-2` for what is essentially a flex-wrap list of badges

**Example 5: Data Management**
- [Dashboard.tsx:264-307](frontend/src/pages/Dashboard.tsx#L264-L307): Export/Import buttons in a full-width card when they could be a toolbar

---

### Issue 4: Excessive Scrolling (Evaluate Section)

**Current State:**

The Evaluate phase in [IdeaDetailPhased.tsx:652-717](frontend/src/pages/IdeaDetailPhased.tsx#L652-L717) creates a deeply nested structure:

1. PhaseContainer header (takes ~100px)
2. EvaluatePhaseContent (takes ~300px with the circle and buttons)
3. RiskResponseSummary (variable, ~200px)
4. Secondary views tabs (when expanded, can be 1000px+)
   - EvaluationScorecard: ~2000px of content
   - EvaluationDashboard: ~1500px of content
   - RedTeamView: ~1500px of content
   - SynthesisView: ~1000px of content

**Components Contributing to Scroll Depth:**

1. **EvaluationScorecard.tsx**
   - [Line 427-493](frontend/src/components/EvaluationScorecard.tsx#L427-L493): Header section with gauge (~200px)
   - [Line 496-541](frontend/src/components/EvaluationScorecard.tsx#L496-L541): Red Team Debate Results grid (~200px)
   - [Line 544-569](frontend/src/components/EvaluationScorecard.tsx#L544-L569): Category Breakdown (~400px when collapsed, ~1200px expanded)
   - [Line 572-599](frontend/src/components/EvaluationScorecard.tsx#L572-L599): Key Insights (~250px)
   - [Line 602-616](frontend/src/components/EvaluationScorecard.tsx#L602-L616): Executive Summary (~150px)
   - [Line 619-637](frontend/src/components/EvaluationScorecard.tsx#L619-L637): Quick Stats Footer (~100px)

2. **EvaluationDashboard.tsx**
   - [Line 102-123](frontend/src/components/EvaluationDashboard.tsx#L102-L123): Overall Score card (~100px)
   - [Line 125-199](frontend/src/components/EvaluationDashboard.tsx#L125-L199): Two-column grid with radar and category cards (~400px)
   - [Line 202-235](frontend/src/components/EvaluationDashboard.tsx#L202-L235): All Criteria Bar Chart with h-96 (384px)
   - [Line 238-332](frontend/src/components/EvaluationDashboard.tsx#L238-L332): Detailed Reasoning (variable, ~500px+)

3. **RedTeamView.tsx**
   - [Line 126-156](frontend/src/components/RedTeamView.tsx#L126-L156): Stats grid (~100px)
   - [Line 159-236](frontend/src/components/RedTeamView.tsx#L159-L236): Challenges by Persona (~600px+)
   - [Line 239-294](frontend/src/components/RedTeamView.tsx#L239-L294): Debate Rounds (~400px+)

4. **SynthesisView.tsx**
   - [Line 91-122](frontend/src/components/SynthesisView.tsx#L91-L122): Main Recommendation card (~150px)
   - [Line 124-134](frontend/src/components/SynthesisView.tsx#L124-L134): Executive Summary (~120px)
   - [Line 137-169](frontend/src/components/SynthesisView.tsx#L137-L169): Strengths/Weaknesses grid (~300px)
   - [Line 172-185](frontend/src/components/SynthesisView.tsx#L172-L185): Critical Assumptions (~150px)
   - [Line 188-201](frontend/src/components/SynthesisView.tsx#L188-L201): Unresolved Questions (~150px)

---

### Issue 5: Lost Idea Context

**Current State:**

- [IdeaDetailPhased.tsx:477-552](frontend/src/pages/IdeaDetailPhased.tsx#L477-L552): Idea header with title, summary, dates, tags is only visible at the top
- Once user scrolls into phase content, no reminder of what idea they're working on
- No quick way to reference the full idea description without scrolling back or navigating away

**Additional Context Loss Examples:**

1. **During Evaluation:** Users reviewing scores can't quickly reference what the idea actually is
2. **In Clarify Phase:** Questions are grouped by category but there's no visible idea context
3. **In Position Phase:** Strategic decisions are made without visible idea summary

---

### Issue 6: Poor Content Nesting

**Current State:**

- [EvaluationScorecard.tsx](frontend/src/components/EvaluationScorecard.tsx): Single accordion pattern for categories, but other sections are always visible
- [RedTeamView.tsx](frontend/src/components/RedTeamView.tsx): Persona sections always expanded
- [ClarifyPhaseContent.tsx:343-461](frontend/src/components/ClarifyPhaseContent.tsx#L343-L461): Questions use collapsible categories (good) but expansion state isn't persistent

**Missing Nesting Opportunities:**

1. **EvaluationDashboard:** Charts could be tabs instead of vertical stack
2. **SynthesisView:** Strengths/Weaknesses/Assumptions could be tabs or accordion
3. **Category breakdown:** Could default to summary row with expand-on-click for details

---

### Issue 7: Evaluate Section Score Display

**Current State:**
- [PhaseContainer.tsx:148-179](frontend/src/components/PhaseContainer.tsx#L148-L179): EvaluatePhaseContent returns a centered card layout

```tsx
<div className="space-y-6">
  <div className="card text-center">
    <h3>Evaluation Complete</h3>
    <div className="inline-flex... w-24 h-24 rounded-full"> // Large circle
      <span className="text-3xl">3.04</span>
    </div>
    <p>86% confidence</p>
    <div className="flex justify-center gap-3">
      <button>View Full Results</button>
      <button>Re-evaluate</button>
    </div>
  </div>
</div>
```

This takes approximately 280px of vertical space for information that could fit in 60px.

---

## Part 3: Implementation Plan

### Phase 1: Layout Infrastructure (Foundation)

#### 1.1 Fixed Header Navigation

**File:** [frontend/src/components/Layout.tsx](frontend/src/components/Layout.tsx)

**Changes:**
```tsx
// Current (line 24):
<header className="bg-white border-b border-gray-200">

// Change to:
<header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
```

**Additional Changes:**
- Add `pt-16` (or appropriate value) to main content to account for fixed header height
- Update z-index hierarchy documentation

---

#### 1.2 Sticky Sidebar Infrastructure

**File:** [frontend/src/pages/IdeaDetailPhased.tsx](frontend/src/pages/IdeaDetailPhased.tsx)

**Changes:**

```tsx
// Current (line 576):
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  <div className="lg:col-span-1">
    <IncubationStepper ... />
  </div>

// Change to:
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  <div className="lg:col-span-1">
    <div className="sticky top-20"> {/* Accounts for fixed header */}
      <IncubationStepper ... />
    </div>
  </div>
```

**File:** [frontend/src/components/ClarifyPhaseContent.tsx](frontend/src/components/ClarifyPhaseContent.tsx)

**Changes:**
```tsx
// Current (line 471):
<div className="lg:col-span-1">
  <div className="sticky top-4 space-y-4">

// Change to:
<div className="lg:col-span-1">
  <div className="sticky top-20 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
```

---

#### 1.3 Create Idea Context Header Component

**New File:** `frontend/src/components/IdeaContextHeader.tsx`

**Purpose:** Persistent mini-header showing idea title, type, score that appears when main header scrolls out of view.

**Implementation:**
```tsx
interface IdeaContextHeaderProps {
  title: string
  type: IdeaType
  score: number | null
  confidence: number | null
  onShowDescription: () => void
  visible: boolean
}

export default function IdeaContextHeader({
  title,
  type,
  score,
  confidence,
  onShowDescription,
  visible
}: IdeaContextHeaderProps) {
  return (
    <div className={clsx(
      'fixed top-16 left-0 right-0 z-40 bg-white border-b border-gray-100 shadow-sm transition-transform duration-200',
      visible ? 'translate-y-0' : '-translate-y-full'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`badge ${ideaTypeColors[type]}`}>{type}</span>
            <h2 className="font-semibold text-gray-900 truncate max-w-md">{title}</h2>
            <button
              onClick={onShowDescription}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              View Description
            </button>
          </div>
          {score !== null && (
            <div className="flex items-center gap-2">
              <span className={clsx('text-xl font-bold', scoreInterpretation.getColor(score))}>
                {score.toFixed(2)}
              </span>
              {confidence !== null && (
                <span className="text-xs text-gray-400">
                  {Math.round(confidence * 100)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Integration:**
- Add to [IdeaDetailPhased.tsx](frontend/src/pages/IdeaDetailPhased.tsx)
- Use Intersection Observer to detect when main header scrolls out of view
- Pass `onShowDescription` handler to open `IdeaDescriptionModal`

---

### Phase 2: Space Optimization

#### 2.1 Compact Stats Row Component

**New File:** `frontend/src/components/CompactStatsRow.tsx`

**Purpose:** Replace full-width stat cards with inline stats.

**Implementation:**
```tsx
interface Stat {
  label: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
  color?: string
}

interface CompactStatsRowProps {
  stats: Stat[]
  className?: string
}

export default function CompactStatsRow({ stats, className }: CompactStatsRowProps) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-4 py-2', className)}>
      {stats.map((stat, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {stat.icon && <stat.icon className={clsx('h-4 w-4', stat.color || 'text-gray-400')} />}
          <span className="text-sm text-gray-500">{stat.label}:</span>
          <span className="font-semibold text-gray-900">{stat.value}</span>
        </div>
      ))}
    </div>
  )
}
```

**Usage Locations:**
- [Dashboard.tsx:68-124](frontend/src/pages/Dashboard.tsx#L68-L124): Replace stat cards grid
- [RedTeamView.tsx:126-156](frontend/src/components/RedTeamView.tsx#L126-L156): Replace stat cards
- [EvaluationScorecard.tsx:619-637](frontend/src/components/EvaluationScorecard.tsx#L619-L637): Replace Quick Stats Footer

---

#### 2.2 Integrate ProfileStatusCard into Header

**File:** [frontend/src/pages/IdeaDetailPhased.tsx](frontend/src/pages/IdeaDetailPhased.tsx)

**Current (lines 568-573):**
```tsx
{/* Profile Status */}
<ProfileStatusCard
  profile={profile}
  loading={profileLoading}
  onLink={() => setShowProfileSelector(true)}
  onUnlink={unlinkProfile}
/>
```

**Change:** Move into the header section next to the score display.

**New structure (conceptual):**
```tsx
<div className="flex items-start justify-between">
  <div> {/* Left: badges, title, summary, dates */} </div>
  <div className="flex flex-col items-end gap-2">
    {/* Score display */}
    {idea.avg_final_score !== null && (
      <div className="text-right">...</div>
    )}
    {/* Profile status - compact inline version */}
    <ProfileStatusCard
      profile={profile}
      loading={profileLoading}
      onLink={() => setShowProfileSelector(true)}
      onUnlink={unlinkProfile}
      compact={true}  // New prop for inline display
    />
  </div>
</div>
```

**File:** [frontend/src/components/ProfileStatusCard.tsx](frontend/src/components/ProfileStatusCard.tsx)

Add `compact` prop to render as inline badge instead of full-width bar.

---

#### 2.3 Compact Evaluate Phase Content

**File:** [frontend/src/components/PhaseContainer.tsx](frontend/src/components/PhaseContainer.tsx)

**Current EvaluatePhaseContent (lines 139-218):** Takes ~300px with centered layout.

**New Design:** Integrate into PhaseContainer border similar to stepper.

```tsx
export function EvaluatePhaseContent({
  hasEvaluation,
  score,
  confidence,
  isEvaluating,
  onEvaluate,
  onViewResults
}: EvaluatePhaseContentProps) {
  if (hasEvaluation && score !== null && score !== undefined) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-4">
          <div className={clsx(
            'flex items-center justify-center w-14 h-14 rounded-full',
            score >= 7 ? 'bg-green-100' : score >= 5 ? 'bg-yellow-100' : 'bg-red-100'
          )}>
            <span className={clsx(
              'text-xl font-bold',
              score >= 7 ? 'text-green-600' : score >= 5 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {score.toFixed(1)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Evaluation Complete</h3>
            <p className="text-sm text-gray-500">
              {confidence !== null ? `${Math.round(confidence * 100)}% confidence` : 'Score available'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onViewResults} className="btn btn-primary btn-sm">
            View Results
          </button>
          <button onClick={onEvaluate} className="btn btn-secondary btn-sm">
            Re-evaluate
          </button>
        </div>
      </div>
    )
  }
  // ... "Ready for Evaluation" state (also compacted)
}
```

This reduces the evaluation summary from ~300px to ~80px.

---

### Phase 3: Content Organization

#### 3.1 Tabbed Evaluation Views

**File:** [frontend/src/pages/IdeaDetailPhased.tsx](frontend/src/pages/IdeaDetailPhased.tsx)

**Current (lines 676-715):** Secondary views use basic button tabs inside a card.

**Improved Implementation:**

Create a dedicated component for tabbed evaluation views with proper tab styling:

**New File:** `frontend/src/components/EvaluationTabs.tsx`

```tsx
import { useState } from 'react'
import clsx from 'clsx'
import EvaluationScorecard from './EvaluationScorecard'
import EvaluationDashboard from './EvaluationDashboard'
import RedTeamView from './RedTeamView'
import SynthesisView from './SynthesisView'

type TabId = 'scorecard' | 'dashboard' | 'redteam' | 'synthesis'

const tabs: { id: TabId; label: string }[] = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'dashboard', label: 'Charts' },
  { id: 'redteam', label: 'Red Team' },
  { id: 'synthesis', label: 'Synthesis' },
]

interface EvaluationTabsProps {
  slug: string
  runId?: string
  synthesis: Synthesis | null
  profile?: UserProfileSummary | null
  defaultTab?: TabId
}

export default function EvaluationTabs({
  slug,
  runId,
  synthesis,
  profile,
  defaultTab = 'scorecard'
}: EvaluationTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)

  return (
    <div className="card p-0 overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'text-primary-600 border-b-2 border-primary-600 bg-white -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {activeTab === 'scorecard' && (
          <EvaluationScorecard slug={slug} runId={runId} profile={profile} />
        )}
        {activeTab === 'dashboard' && (
          <EvaluationDashboard slug={slug} runId={runId} />
        )}
        {activeTab === 'redteam' && (
          <RedTeamView slug={slug} runId={runId} />
        )}
        {activeTab === 'synthesis' && (
          <SynthesisView synthesis={synthesis} />
        )}
      </div>
    </div>
  )
}
```

Key improvements:
- Proper tab UI with bottom border indicator
- Max-height with overflow for contained scrolling
- Single unified component

---

#### 3.2 Collapsible Sections in EvaluationScorecard

**File:** [frontend/src/components/EvaluationScorecard.tsx](frontend/src/components/EvaluationScorecard.tsx)

**Changes:**

1. **Make Debate Summary collapsible** (lines 496-541):
```tsx
const [showDebateSummary, setShowDebateSummary] = useState(false)

// Replace the card with:
{hasDebate && (
  <div className="card bg-gradient-to-r from-purple-50 to-blue-50 p-0 overflow-hidden">
    <button
      onClick={() => setShowDebateSummary(!showDebateSummary)}
      className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/30 transition"
    >
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-purple-600" />
        <span className="font-semibold text-gray-900">Red Team Results</span>
        <span className="text-sm text-gray-500">
          {survivalRate.toFixed(0)}% survival rate
        </span>
      </div>
      {showDebateSummary ? <ChevronUp /> : <ChevronDown />}
    </button>
    {showDebateSummary && (
      <div className="p-6 pt-0">
        {/* Existing grid content */}
      </div>
    )}
  </div>
)}
```

2. **Collapse Key Insights by default** (lines 572-599):
```tsx
const [showInsights, setShowInsights] = useState(false)
```

3. **Keep Category Breakdown expanded (primary content)**

---

#### 3.3 Summary-First Pattern for All Sections

**Design Principle:** Every section should show summary info in header, expand for details.

**Apply to:**

1. **SynthesisView:** Make sections collapsible
   - Show counts in headers: "Key Strengths (4)"
   - Default collapsed except Executive Summary

2. **RedTeamView:** Persona sections default collapsed
   - Show badge with challenge count
   - Critical items always visible

3. **EvaluationDashboard:** Charts in tabs, not stacked
   - Tab 1: Radar Chart + Category Cards
   - Tab 2: All Criteria Bar Chart
   - Tab 3: Detailed Reasoning

---

### Phase 4: Component Consolidation

#### 4.1 Unified Score Display Component

**New File:** `frontend/src/components/ScoreDisplay.tsx`

**Purpose:** Single component for all score displays with variants.

```tsx
type ScoreDisplayVariant = 'large' | 'medium' | 'compact' | 'inline'

interface ScoreDisplayProps {
  score: number
  confidence?: number
  label?: string
  variant?: ScoreDisplayVariant
  showChange?: { from: number }
}

export default function ScoreDisplay({
  score,
  confidence,
  label,
  variant = 'medium',
  showChange
}: ScoreDisplayProps) {
  // Render based on variant
}
```

**Replace usages in:**
- [EvaluationScorecard.tsx](frontend/src/components/EvaluationScorecard.tsx): ScoreGauge
- [PhaseContainer.tsx](frontend/src/components/PhaseContainer.tsx): EvaluatePhaseContent score
- [IdeaDetailPhased.tsx](frontend/src/pages/IdeaDetailPhased.tsx): Header score
- [SynthesisView.tsx](frontend/src/components/SynthesisView.tsx): Recommendation score

---

#### 4.2 Section Header Component

**New File:** `frontend/src/components/SectionHeader.tsx`

```tsx
interface SectionHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  iconColor?: string
  action?: React.ReactNode
  collapsible?: boolean
  expanded?: boolean
  onToggle?: () => void
}

export default function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-gray-400',
  action,
  collapsible,
  expanded,
  onToggle
}: SectionHeaderProps) {
  const Wrapper = collapsible ? 'button' : 'div'

  return (
    <Wrapper
      className={clsx(
        'flex items-center justify-between',
        collapsible && 'w-full hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition'
      )}
      onClick={collapsible ? onToggle : undefined}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className={clsx('w-5 h-5', iconColor)} />}
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {action}
        {collapsible && (
          expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </div>
    </Wrapper>
  )
}
```

---

### Phase 5: Responsive Refinements

#### 5.1 Breakpoint-Aware Layouts

**File:** [frontend/src/components/EvaluationDashboard.tsx](frontend/src/components/EvaluationDashboard.tsx)

**Current (lines 125-199):** Fixed two-column grid for radar + categories.

**Change:**
```tsx
// Make radar chart smaller on desktop when alongside categories
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-1">
    {/* Radar chart - smaller */}
    <div className="h-64">
      <ResponsiveContainer>...</ResponsiveContainer>
    </div>
  </div>
  <div className="lg:col-span-2">
    {/* Category cards - more prominence */}
  </div>
</div>
```

#### 5.2 Mobile-First Adjustments

Add responsive classes for better mobile experience:

```css
/* In index.css */
@layer utilities {
  .compact-mobile {
    @apply text-sm py-2 px-3;
  }

  @screen sm {
    .compact-mobile {
      @apply text-base py-3 px-4;
    }
  }
}
```

---

## Part 4: Implementation Priority

### High Priority (Week 1)

| Task | Files Affected | Impact |
|------|---------------|--------|
| 1.1 Fixed Header | Layout.tsx | High - Context retention |
| 1.2 Sticky Sidebar | IdeaDetailPhased.tsx | High - Navigation |
| 2.3 Compact Evaluate | PhaseContainer.tsx | High - Reduces scroll depth by ~220px |
| 3.1 Tabbed Evaluation | New + IdeaDetailPhased.tsx | High - Contains infinite scroll |

### Medium Priority (Week 2)

| Task | Files Affected | Impact |
|------|---------------|--------|
| 1.3 Idea Context Header | New + IdeaDetailPhased.tsx | Medium - Context persistence |
| 2.1 Compact Stats | New + Dashboard.tsx, RedTeamView.tsx | Medium - Space efficiency |
| 2.2 ProfileStatusCard integration | IdeaDetailPhased.tsx, ProfileStatusCard.tsx | Medium - Header consolidation |
| 3.2 Collapsible Sections | EvaluationScorecard.tsx | Medium - Reduces scroll |

### Lower Priority (Week 3)

| Task | Files Affected | Impact |
|------|---------------|--------|
| 3.3 Summary-First Pattern | SynthesisView.tsx, RedTeamView.tsx | Lower - Polish |
| 4.1 ScoreDisplay Component | New + Multiple | Lower - Code quality |
| 4.2 SectionHeader Component | New + Multiple | Lower - Code quality |
| 5.1/5.2 Responsive Refinements | Multiple CSS | Lower - Edge cases |

---

## Part 5: Testing Checklist

### Layout Changes
- [ ] Header remains visible while scrolling on all pages
- [ ] Sidebar remains visible while scrolling in IdeaDetailPhased
- [ ] ReadinessMeter sidebar sticky in ClarifyPhaseContent
- [ ] No z-index conflicts with modals and dropdowns
- [ ] Mobile menu still functional with fixed header

### Space Optimization
- [ ] ProfileStatusCard displays inline in header correctly
- [ ] Compact stats row displays properly on all screen sizes
- [ ] EvaluatePhaseContent reduced height verified
- [ ] No content overlap after changes

### Content Organization
- [ ] Evaluation tabs switch correctly and maintain scroll position
- [ ] Collapsible sections animate smoothly
- [ ] Default expanded/collapsed states are correct
- [ ] Tab state persists during same-page navigation

### Accessibility
- [ ] All collapsible sections keyboard accessible
- [ ] Tab navigation works for new tab component
- [ ] Focus management correct after collapse/expand
- [ ] Aria labels updated for new patterns

### Performance
- [ ] No layout shift on scroll (CLS)
- [ ] Smooth sticky positioning without jank
- [ ] Tab content lazy-loaded appropriately

---

## Part 6: CSS Variable System (Optional Enhancement)

Consider introducing CSS variables for consistent spacing:

```css
:root {
  --header-height: 4rem;
  --context-header-height: 2.5rem;
  --sidebar-width: 280px;
  --content-max-width: 1280px;
  --spacing-compact: 0.5rem;
  --spacing-normal: 1rem;
  --spacing-relaxed: 1.5rem;
}

.sticky-below-header {
  top: calc(var(--header-height) + var(--spacing-normal));
}

.sticky-below-context {
  top: calc(var(--header-height) + var(--context-header-height) + var(--spacing-normal));
}
```

This enables easy global adjustments to spacing and header sizes.

---

## Appendix: File Change Summary

| File | Type | Changes |
|------|------|---------|
| `frontend/src/components/Layout.tsx` | Modify | Fixed header positioning |
| `frontend/src/pages/IdeaDetailPhased.tsx` | Modify | Sticky sidebar, context header, compact profile |
| `frontend/src/components/PhaseContainer.tsx` | Modify | Compact EvaluatePhaseContent |
| `frontend/src/components/EvaluationScorecard.tsx` | Modify | Collapsible sections |
| `frontend/src/components/EvaluationDashboard.tsx` | Modify | Smaller charts, better grid |
| `frontend/src/components/SynthesisView.tsx` | Modify | Collapsible sections |
| `frontend/src/components/RedTeamView.tsx` | Modify | Compact stats, collapsible personas |
| `frontend/src/components/ProfileStatusCard.tsx` | Modify | Add compact variant |
| `frontend/src/components/ClarifyPhaseContent.tsx` | Modify | Fix sticky sidebar |
| `frontend/src/pages/Dashboard.tsx` | Modify | Compact stats row |
| `frontend/src/components/IdeaContextHeader.tsx` | New | Context persistence header |
| `frontend/src/components/EvaluationTabs.tsx` | New | Tabbed evaluation views |
| `frontend/src/components/CompactStatsRow.tsx` | New | Inline stats display |
| `frontend/src/components/ScoreDisplay.tsx` | New (optional) | Unified score component |
| `frontend/src/components/SectionHeader.tsx` | New (optional) | Unified section headers |
| `frontend/src/styles/index.css` | Modify | CSS variables, utility classes |

---

## Conclusion

This plan addresses the core UI issues through:

1. **Structural changes** (fixed navigation, sticky sidebars) that maintain context
2. **Space optimization** (compact components, integrated elements) that reduce scroll
3. **Content organization** (tabs, collapsibles) that enable progressive disclosure
4. **Component consolidation** (unified patterns) that ensure consistency

The implementation is prioritized to deliver the highest-impact changes first, with a focus on maintainability and progressive enhancement.
