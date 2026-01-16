# Idea Incubator - System Architecture

## Overview

The Idea Incubator is a single-user system for capturing, developing, evaluating, and visualizing ideas across all domains (business, creative, technical, personal, research). The system automates file organization, proactively guides idea development through structured questioning, and provides comprehensive visualization of ideas against evaluation criteria and lifecycle stages.

---

## Core Design Principles

| Principle                    | Description                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **Zero-Friction Capture**    | Ideas can be captured via markdown from any device without specifying where files go |
| **Auto-Organization**        | System determines correct file placement based on content and context                |
| **Proactive Guidance**       | Claude skills ask questions and red-team angles without user prompting               |
| **Comprehensive Evaluation** | Extensive criteria matrix identifies gaps and surfaces best ideas                    |
| **Flexible Visualization**   | Multiple views adapt to different idea types and analysis needs                      |
| **Plugin-Ready**             | Skill-based architecture allows future capability expansion                          |

---

## System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IDEA INCUBATOR SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   CAPTURE   │───▶│   SKILLS    │───▶│  DATABASE   │───▶│  FRONTEND   │  │
│  │   LAYER     │    │   ENGINE    │    │   LAYER     │    │   (VITE)    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                  │                  │                  │          │
│        ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     MARKDOWN FILE SYSTEM                            │   │
│  │  ideas/[idea-slug]/  ─  Organized idea folders with structured MD   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Folder Structure

```
idea_incubator/
│
├── .claude/
│   └── skills/                    # Claude Code skill definitions (directories, not files!)
│       ├── idea-capture/          # Quick idea capture
│       │   ├── SKILL.md
│       │   └── templates/
│       ├── idea-develop/          # Flesh out ideas with questions
│       │   ├── SKILL.md
│       │   └── question-bank.md
│       ├── idea-evaluate/         # Score against criteria matrix
│       │   ├── SKILL.md
│       │   └── criteria-guide.md
│       ├── idea-redteam/          # Devil's advocate stress-testing
│       │   ├── SKILL.md
│       │   └── challenge-patterns.md
│       └── idea-organize/         # File organization guidance
│           └── SKILL.md
│
├── ideas/                         # All idea content lives here
│   ├── _index.md                  # Master index of all ideas
│   └── [idea-slug]/               # One folder per idea
│       ├── README.md              # Main idea document
│       ├── evaluation.md          # Criteria scores and notes
│       ├── development.md         # Fleshing-out notes, Q&A
│       ├── redteam.md             # Challenges and counterarguments
│       ├── research/              # Research notes and findings
│       │   └── *.md
│       ├── notes/                 # Freeform notes and thoughts
│       │   └── *.md
│       └── assets/                # Images, diagrams, attachments
│           └── *.*
│
├── templates/                     # Markdown templates
│   ├── idea.md                    # New idea template
│   ├── evaluation.md              # Evaluation criteria template
│   ├── development.md             # Development questions template
│   ├── redteam.md                 # Red team template
│   └── research.md                # Research note template
│
├── taxonomy/                      # Classification definitions
│   ├── lifecycle-stages.md        # All lifecycle stages
│   ├── evaluation-criteria.md     # All evaluation dimensions
│   ├── idea-types.md              # Domain categories
│   └── tags.md                    # Controlled vocabulary tags
│
├── frontend/                      # Vite + React application
│   ├── src/
│   │   ├── components/
│   │   ├── views/
│   │   ├── hooks/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
│
├── database/
│   ├── ideas.db                   # SQLite database
│   └── schema.sql                 # Database schema definition
│
├── scripts/                       # Automation scripts
│   ├── sync-db.ts                 # Sync markdown ↔ database
│   └── generate-index.ts          # Regenerate _index.md
│
├── docs/
│   ├── ARCHITECTURE.md            # This document
│   └── SKILLS-GUIDE.md            # How to use each skill
│
├── CLAUDE.md                      # Claude Code project instructions
└── README.md                      # Project overview
```

---

## 2. Lifecycle Stages

Extensive stages to cover full idea journey without future additions:

| Stage         | Code        | Description                            |
| ------------- | ----------- | -------------------------------------- |
| **Spark**     | `SPARK`     | Initial raw capture, unrefined thought |
| **Clarify**   | `CLARIFY`   | Define problem/opportunity clearly     |
| **Research**  | `RESEARCH`  | Gather information, prior art, context |
| **Ideate**    | `IDEATE`    | Brainstorm approaches and solutions    |
| **Evaluate**  | `EVALUATE`  | Score against criteria matrix          |
| **Validate**  | `VALIDATE`  | Test core assumptions                  |
| **Design**    | `DESIGN`    | Architecture and detailed planning     |
| **Prototype** | `PROTOTYPE` | Build minimum viable version           |
| **Test**      | `TEST`      | User testing and feedback              |
| **Refine**    | `REFINE`    | Iterate based on learnings             |
| **Build**     | `BUILD`     | Full implementation                    |
| **Launch**    | `LAUNCH`    | Release to target audience             |
| **Grow**      | `GROW`      | Scale and optimize                     |
| **Maintain**  | `MAINTAIN`  | Ongoing operation                      |
| **Pivot**     | `PIVOT`     | Major direction change                 |
| **Pause**     | `PAUSE`     | Intentionally on hold                  |
| **Sunset**    | `SUNSET`    | Winding down                           |
| **Archive**   | `ARCHIVE`   | Historical reference only              |
| **Abandoned** | `ABANDONED` | Decided not to pursue                  |

---

## 3. Evaluation Criteria Matrix

Comprehensive scoring dimensions organized by category:

### 3.1 Problem/Opportunity Quality

| Criterion          | Description                              | Score Range |
| ------------------ | ---------------------------------------- | ----------- |
| Problem Severity   | How painful is the problem being solved? | 1-10        |
| Problem Frequency  | How often does the problem occur?        | 1-10        |
| Audience Size      | How many people/entities affected?       | 1-10        |
| Willingness to Pay | Would people pay to solve this?          | 1-10        |
| Urgency            | How time-sensitive is the need?          | 1-10        |

### 3.2 Solution Quality

| Criterion     | Description                                 | Score Range |
| ------------- | ------------------------------------------- | ----------- |
| Uniqueness    | How differentiated from alternatives?       | 1-10        |
| Elegance      | How simple and clean is the solution?       | 1-10        |
| Completeness  | Does it fully address the problem?          | 1-10        |
| Defensibility | Can it be protected or is it easily copied? | 1-10        |
| Scalability   | Can it grow without proportional cost?      | 1-10        |

### 3.3 Feasibility

| Criterion             | Description                        | Score Range           |
| --------------------- | ---------------------------------- | --------------------- |
| Technical Complexity  | How hard to build?                 | 1-10 (10=easy)        |
| Resource Requirements | Cost in time/money/people          | 1-10 (10=low)         |
| Skill Availability    | Do I have/can I get needed skills? | 1-10                  |
| Dependency Risk       | Reliance on external factors       | 1-10 (10=independent) |
| Time to Value         | How long until first results?      | 1-10 (10=fast)        |

### 3.4 Strategic Fit

| Criterion      | Description                            | Score Range |
| -------------- | -------------------------------------- | ----------- |
| Goal Alignment | Fits with personal/business goals?     | 1-10        |
| Passion Level  | How excited am I about this?           | 1-10        |
| Learning Value | Will I gain valuable skills/knowledge? | 1-10        |
| Portfolio Fit  | Complements other work/ideas?          | 1-10        |
| Timing Fit     | Right moment in my life/career?        | 1-10        |

### 3.5 Market/External Factors

| Criterion             | Description                               | Score Range           |
| --------------------- | ----------------------------------------- | --------------------- |
| Market Timing         | Is the market ready?                      | 1-10                  |
| Competitive Intensity | How crowded is the space?                 | 1-10 (10=open)        |
| Trend Alignment       | Riding or fighting macro trends?          | 1-10                  |
| Regulatory Risk       | Legal/compliance concerns?                | 1-10 (10=clear)       |
| Platform Risk         | Dependent on platforms that could change? | 1-10 (10=independent) |

### 3.6 Risk Assessment

| Criterion         | Description                        | Score Range        |
| ----------------- | ---------------------------------- | ------------------ |
| Reversibility     | Can I undo if it fails?            | 1-10               |
| Downside Exposure | Worst case impact                  | 1-10 (10=limited)  |
| Upside Potential  | Best case outcome                  | 1-10               |
| Confidence Level  | How certain am I in my assessment? | 1-10               |
| Information Gaps  | Do I know enough to decide?        | 1-10 (10=complete) |

### Composite Scores

| Score                 | Calculation                             |
| --------------------- | --------------------------------------- |
| **Problem Score**     | Average of Problem/Opportunity Quality  |
| **Solution Score**    | Average of Solution Quality             |
| **Feasibility Score** | Average of Feasibility                  |
| **Fit Score**         | Average of Strategic Fit                |
| **Market Score**      | Average of Market/External Factors      |
| **Risk Score**        | Average of Risk Assessment              |
| **Overall Score**     | Weighted average (configurable weights) |

---

## 4. Skills Engine (Claude Code Skills)

### 4.1 How Skills Actually Work

> **CORRECTION**: Skills are NOT simple markdown files. They are **directories** containing a required `SKILL.md` file with **YAML frontmatter**.

**Key Facts:**

- Skills are **model-invoked**, not user-invoked
- Claude autonomously decides when to use them based on the `description` field matching conversation context
- The `description` must include BOTH what the skill does AND trigger keywords/phrases
- Skills can include supporting files (docs, scripts, templates) that Claude reads progressively

### 4.2 Correct Skill File Structure

```
.claude/skills/
├── idea-capture/
│   ├── SKILL.md              # Required - main skill definition
│   └── templates/            # Optional - supporting files
│       └── new-idea.md
├── idea-develop/
│   ├── SKILL.md
│   └── question-bank.md      # Optional - reference questions
├── idea-evaluate/
│   ├── SKILL.md
│   └── criteria-guide.md     # Optional - scoring guidance
├── idea-redteam/
│   ├── SKILL.md
│   └── challenge-patterns.md # Optional - attack patterns
└── idea-organize/
    └── SKILL.md
```

### 4.3 SKILL.md Format (YAML Frontmatter Required)

```yaml
---
name: idea-capture
description: Creates structured folders for new ideas. Use when user says "I have an idea", "new idea", "what if we", or describes a concept, opportunity, or problem to solve.
---

# Idea Capture

## Instructions

1. Create a new folder under `ideas/` with a kebab-case slug
2. Copy template from `templates/idea.md` to `ideas/[slug]/README.md`
3. Populate frontmatter with extracted metadata
4. Ask 3 clarifying questions to flesh out the initial concept

## Template Location

See [templates/new-idea.md](templates/new-idea.md) for the standard template.
```

### 4.4 Skill Definitions

| Skill Directory  | Description (for activation)                                           | Purpose                                                 |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `idea-capture/`  | "...new idea, I have an idea, what if, concept for, opportunity..."    | Create folder, populate template, ask initial questions |
| `idea-develop/`  | "...work on [idea], flesh out, develop, expand, detail..."             | Ask clarifying questions, probe assumptions             |
| `idea-evaluate/` | "...evaluate, score, assess, rate, how good is..."                     | Walk through criteria, calculate scores                 |
| `idea-redteam/`  | "...red team, challenge, stress test, devil's advocate, poke holes..." | Challenge assumptions, find weaknesses                  |
| `idea-organize/` | "...organize, clean up, file, sort, where should..."                   | Determine correct location, update index                |

### 4.5 File Placement (Instructed via Skills, Not Automatic)

> **CORRECTION**: There is no background daemon watching files. File placement happens when Claude is in conversation and activates the relevant skill.

The `idea-organize` skill instructs Claude on placement rules:

| Content Type      | Destination                            | Trigger Context                          |
| ----------------- | -------------------------------------- | ---------------------------------------- |
| New idea capture  | `ideas/[new-slug]/README.md`           | User describes new idea                  |
| Research findings | `ideas/[slug]/research/[topic].md`     | User shares research about existing idea |
| Q&A development   | `ideas/[slug]/development.md`          | User answers development questions       |
| Challenges/risks  | `ideas/[slug]/redteam.md`              | User discusses concerns or risks         |
| Evaluation scores | `ideas/[slug]/evaluation.md`           | User provides scores or assessments      |
| Freeform notes    | `ideas/[slug]/notes/[date]-[topic].md` | User adds misc notes                     |
| Assets            | `ideas/[slug]/assets/[filename]`       | User provides images/files               |

### 4.6 Proactive Questioning (How It Really Works)

> **CORRECTION**: Skills don't randomly ping users. They provide instructions that Claude follows when the skill is activated during conversation.

When a skill activates, Claude reads the instructions and any supporting files (like question banks) to guide the conversation. The "proactive" behavior comes from:

1. **Skill instructions** telling Claude to ask questions after certain actions
2. **Gap detection** - Claude checks what's missing and asks about it
3. **CLAUDE.md instructions** reinforcing proactive behavior

**Example Flow:**

```
User: "I have an idea for a meal planning app"

Claude (with idea-capture skill active):
  1. Reads SKILL.md instructions
  2. Creates ideas/meal-planning-app/ folder
  3. Populates README.md from template
  4. Per instructions, asks 3 clarifying questions:
     - "Who specifically would use this?"
     - "What problem does this solve that existing apps don't?"
     - "What's the simplest version that would be useful?"
```

---

## 5. Database Schema (SQLite)

```sql
-- Core idea record
CREATE TABLE ideas (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    idea_type TEXT,                    -- business, creative, technical, personal, research
    lifecycle_stage TEXT DEFAULT 'SPARK',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    folder_path TEXT NOT NULL
);

-- Evaluation scores
CREATE TABLE evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id),
    criterion TEXT NOT NULL,
    category TEXT NOT NULL,
    score INTEGER CHECK(score >= 1 AND score <= 10),
    notes TEXT,
    evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT                       -- controlled vocab category or NULL for free tags
);

CREATE TABLE idea_tags (
    idea_id TEXT REFERENCES ideas(id),
    tag_id INTEGER REFERENCES tags(id),
    PRIMARY KEY (idea_id, tag_id)
);

-- Relationships between ideas
CREATE TABLE idea_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_idea_id TEXT REFERENCES ideas(id),
    target_idea_id TEXT REFERENCES ideas(id),
    relationship_type TEXT,            -- parent, child, related, combines, conflicts, inspired_by
    notes TEXT
);

-- Development log (Q&A history)
CREATE TABLE development_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id),
    question TEXT,
    answer TEXT,
    source TEXT,                        -- user, ai, research
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Red team log
CREATE TABLE redteam_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id),
    challenge TEXT,
    response TEXT,
    severity TEXT,                      -- critical, major, minor, addressed
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Views for common queries
CREATE VIEW idea_scores AS
SELECT
    i.id,
    i.slug,
    i.title,
    i.lifecycle_stage,
    AVG(CASE WHEN e.category = 'problem' THEN e.score END) as problem_score,
    AVG(CASE WHEN e.category = 'solution' THEN e.score END) as solution_score,
    AVG(CASE WHEN e.category = 'feasibility' THEN e.score END) as feasibility_score,
    AVG(CASE WHEN e.category = 'fit' THEN e.score END) as fit_score,
    AVG(CASE WHEN e.category = 'market' THEN e.score END) as market_score,
    AVG(CASE WHEN e.category = 'risk' THEN e.score END) as risk_score,
    AVG(e.score) as overall_score
FROM ideas i
LEFT JOIN evaluations e ON i.id = e.idea_id
GROUP BY i.id;
```

---

## 6. Frontend Architecture (Vite + React)

### 6.1 Core Views

| View                   | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| **Dashboard**          | Overview of all ideas with key metrics                  |
| **Idea Detail**        | Full view of single idea with all data                  |
| **Evaluation Matrix**  | Heatmap of all ideas vs all criteria                    |
| **Lifecycle Pipeline** | Kanban-style view of ideas by stage                     |
| **Relationship Graph** | Network visualization of idea connections               |
| **Gap Analysis**       | Highlights missing evaluations and unanswered questions |
| **Comparison**         | Side-by-side comparison of selected ideas               |

### 6.2 Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Markdown   │────▶│   Sync      │────▶│   SQLite    │
│   Files     │     │   Script    │     │   Database  │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │   Vite      │
                                        │   Frontend  │
                                        └─────────────┘
```

### 6.3 Tech Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Framework       | React 18 + TypeScript            |
| Build           | Vite                             |
| Styling         | Tailwind CSS                     |
| State           | Zustand or React Query           |
| Charts          | Recharts or D3                   |
| Graph           | React Force Graph or Cytoscape   |
| Database Access | better-sqlite3 (via Express API) |

---

## 7. Sync Mechanism

### 7.1 Markdown → Database Sync

The sync script (`scripts/sync-db.ts`) performs:

1. **Parse Markdown Frontmatter**
   - Extract metadata (title, tags, stage, type)
   - Parse evaluation scores from evaluation.md

2. **Detect Changes**
   - Compare file modified times with last sync
   - Identify new, updated, deleted ideas

3. **Update Database**
   - Insert/update/delete records
   - Maintain referential integrity

### 7.2 Trigger Points

| Trigger                 | Action                          |
| ----------------------- | ------------------------------- |
| Git commit hook         | Run sync before commit          |
| Claude skill completion | Trigger sync after file changes |
| Frontend load           | Check for updates               |
| Manual command          | `npm run sync`                  |

---

## 8. CLAUDE.md Configuration

The root CLAUDE.md file instructs Claude to:

1. **Auto-detect active idea context** from conversation
2. **Route content to correct files** using organize skill
3. **Proactively ask development/redteam questions** when working on ideas
4. **Update evaluation scores** when assessments are discussed
5. **Maintain database sync** after file operations
6. **Reference skill files** for structured workflows

---

## 9. Interaction Patterns

### 9.1 New Idea Capture

```
User: "I have an idea for an app that..."
Claude:
  1. Activates capture skill
  2. Creates ideas/[slug]/ folder
  3. Populates README.md from template
  4. Auto-tags based on content analysis
  5. Asks initial clarifying questions
  6. Updates database
```

### 9.2 Idea Development Session

```
User: "Let's work on the [idea-name] idea"
Claude:
  1. Loads idea context from folder
  2. Activates develop skill
  3. Reviews current state (lifecycle, scores, gaps)
  4. Asks probing questions based on gaps
  5. Updates development.md with Q&A
  6. Syncs database
```

### 9.3 Evaluation Session

```
User: "I want to evaluate [idea-name]"
Claude:
  1. Activates evaluate skill
  2. Walks through each criterion category
  3. Records scores and notes in evaluation.md
  4. Calculates composite scores
  5. Highlights strengths and gaps
  6. Updates database
```

### 9.4 Red Team Session

```
User: "Red team [idea-name]"
Claude:
  1. Activates redteam skill
  2. Poses devil's advocate questions
  3. Records challenges and responses
  4. Assesses severity of unaddressed concerns
  5. Updates redteam.md
  6. Syncs database
```

---

## 10. Future Extensibility

The plugin-ready architecture supports future additions:

| Extension               | How to Add                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- |
| New evaluation criteria | Add to taxonomy/evaluation-criteria.md, update template                       |
| New lifecycle stage     | Add to taxonomy/lifecycle-stages.md                                           |
| New skill               | Create `.claude/skills/[skill-name]/SKILL.md` directory with YAML frontmatter |
| New visualization       | Add React component to frontend/src/views/                                    |
| External integration    | Create new skill that calls external API                                      |
| AI-powered features     | Add to existing skills or create new ones                                     |

---

## 11. AUTONOMOUS AGENT SYSTEM (v2 Architecture)

> **MAJOR UPDATE**: The user requires a truly autonomous system that self-orchestrates, runs parallel evaluations, and red-teams itself. This requires moving beyond Claude Code skills to a **Claude Agent SDK** implementation.

### 11.1 The Core Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AUTONOMOUS IDEA PROCESSING LOOP                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │ USER INPUT  │  "I have an idea for..."                                   │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ORCHESTRATOR AGENT                                │   │
│  │  1. Classify: Is this NEW / EXISTING / OLD idea?                     │   │
│  │  2. If ambiguous → Ask user: "Does this relate to [X], [Y], or new?" │   │
│  │  3. Route to appropriate workflow                                    │   │
│  └──────┬──────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DEVELOPMENT AGENT                                 │   │
│  │  • Asks clarifying questions (who, what, why, how)                   │   │
│  │  • Probes assumptions                                                │   │
│  │  • Populates idea README with answers                                │   │
│  │  • Triggers when gaps detected                                       │   │
│  └──────┬──────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              PARALLEL EVALUATION AGENTS (Agent SDK)                  │   │
│  │                                                                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Problem  │ │ Solution │ │Feasibil- │ │Strategic │ │  Market  │   │   │
│  │  │ Quality  │ │ Quality  │ │   ity    │ │   Fit    │ │ Factors  │   │   │
│  │  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │   │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │   │
│  │       │            │            │            │            │         │   │
│  │       └────────────┴────────────┴────────────┴────────────┘         │   │
│  │                              │                                       │   │
│  │                              ▼                                       │   │
│  │                    SCORE AGGREGATION                                 │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    RED TEAM AGENT                                    │   │
│  │  • Automatically runs AFTER evaluation                               │   │
│  │  • Challenges highest-scored criteria                                │   │
│  │  • Attacks weakest assumptions                                       │   │
│  │  • Generates counter-arguments                                       │   │
│  │  • May trigger re-evaluation                                         │   │
│  └──────┬──────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CLASSIFICATION AGENT                              │   │
│  │  • Auto-assigns: domain, type, tags                                  │   │
│  │  • Detects relationships to other ideas                              │   │
│  │  • Calculates composite scores                                       │   │
│  │  • Updates leaderboard position                                      │   │
│  └──────┬──────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PERSIST & SYNC                                    │   │
│  │  • Write to markdown files                                           │   │
│  │  • Sync to SQLite                                                    │   │
│  │  • Update relationship graph                                         │   │
│  │  • Trigger frontend refresh                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Why Claude Agent SDK (Not Just Skills)

| Requirement                               | Skills Can Do?                      | Agent SDK Can Do?                |
| ----------------------------------------- | ----------------------------------- | -------------------------------- |
| Chain multiple operations automatically   | Partially (within one conversation) | Yes (programmatic loop)          |
| Run parallel evaluations                  | No                                  | Yes (spawn concurrent agents)    |
| Self-trigger red-teaming after evaluation | No (needs user prompt)              | Yes (code-controlled sequencing) |
| Autonomous classification and sorting     | No                                  | Yes                              |
| Long-running background processing        | No                                  | Yes                              |
| Retry on failure                          | No                                  | Yes (error handling in code)     |

### 11.3 Agent SDK Implementation Structure

```
idea_incubator/
│
├── agents/                        # Claude Agent SDK implementations
│   ├── orchestrator.ts            # Main routing agent
│   ├── development.ts             # Question-asking agent
│   ├── evaluators/                # Parallel evaluation agents
│   │   ├── problem-quality.ts
│   │   ├── solution-quality.ts
│   │   ├── feasibility.ts
│   │   ├── strategic-fit.ts
│   │   ├── market-factors.ts
│   │   └── risk-assessment.ts
│   ├── redteam.ts                 # Devil's advocate agent
│   ├── classifier.ts              # Auto-tagging and relationship detection
│   └── utils/
│       ├── prompts.ts             # Shared prompt templates
│       ├── schema.ts              # Zod schemas for structured output
│       └── db.ts                  # Database operations
│
├── .claude/
│   └── skills/                    # Still useful for manual Claude Code sessions
│       └── ...
```

### 11.4 Orchestrator Agent Logic

```typescript
// Pseudocode for orchestrator.ts
import { Agent } from "@anthropic-ai/agent-sdk";

const orchestrator = new Agent({
  name: "idea-orchestrator",
  systemPrompt: `You are the Idea Incubator orchestrator. Your job is to:
    1. Determine if user input is a NEW idea, relates to an EXISTING idea, or references an OLD/archived idea
    2. If ambiguous, ask the user to clarify
    3. Route to the appropriate workflow
    4. Ensure all downstream agents complete their work
    5. Never let an idea pass without full evaluation and red-teaming`,
});

async function processInput(userInput: string) {
  // Step 1: Classify the input
  const classification = await orchestrator.run({
    prompt: `Classify this input: "${userInput}"
             Existing ideas: ${await listIdeas()}
             Is this: NEW, EXISTING (which one?), or AMBIGUOUS?`,
    schema: ClassificationSchema,
  });

  // Step 2: If ambiguous, ask user
  if (classification.type === "AMBIGUOUS") {
    return await askUser(classification.candidates);
  }

  // Step 3: Run development agent
  const developedIdea = await developmentAgent.run(userInput, classification);

  // Step 4: Run parallel evaluations
  const evaluations = await Promise.all([
    problemQualityAgent.evaluate(developedIdea),
    solutionQualityAgent.evaluate(developedIdea),
    feasibilityAgent.evaluate(developedIdea),
    strategicFitAgent.evaluate(developedIdea),
    marketFactorsAgent.evaluate(developedIdea),
    riskAssessmentAgent.evaluate(developedIdea),
  ]);

  // Step 5: Aggregate scores
  const scores = aggregateScores(evaluations);

  // Step 6: Automatic red-teaming (self-triggered, not user-prompted)
  const redteamResults = await redteamAgent.challenge(developedIdea, scores);

  // Step 7: Re-evaluate if red-team found critical issues
  if (redteamResults.criticalIssues.length > 0) {
    // Ask user about critical issues, potentially re-score
  }

  // Step 8: Classify and persist
  const finalIdea = await classifierAgent.process(
    developedIdea,
    scores,
    redteamResults,
  );
  await persistToMarkdown(finalIdea);
  await syncToDatabase(finalIdea);

  return finalIdea;
}
```

### 11.5 Parallel Evaluation Agent Example

```typescript
// evaluators/problem-quality.ts
const problemQualityAgent = new Agent({
  name: "problem-quality-evaluator",
  systemPrompt: `You evaluate ideas on Problem/Opportunity Quality.
    Score each criterion 1-10 with reasoning.
    Be skeptical. Don't inflate scores.

    Criteria:
    - Problem Severity: How painful is this problem?
    - Problem Frequency: How often does it occur?
    - Audience Size: How many people affected?
    - Willingness to Pay: Would people pay to solve this?
    - Urgency: How time-sensitive is the need?`,
});

async function evaluate(idea: Idea): Promise<ProblemQualityScores> {
  const result = await problemQualityAgent.run({
    prompt: `Evaluate this idea on Problem Quality:\n${idea.description}`,
    schema: ProblemQualitySchema,
  });
  return result;
}
```

### 11.6 Self Red-Teaming Mechanism

```typescript
// redteam.ts
const redteamAgent = new Agent({
  name: "red-team",
  systemPrompt: `You are a ruthless critic. Your job is to find fatal flaws.

    Attack patterns:
    1. Challenge the highest scores - are they inflated?
    2. Find the weakest assumption and attack it
    3. Identify competitor blind spots
    4. Surface hidden dependencies
    5. Question the "why now" timing
    6. Look for second-order effects
    7. Find the "what if you're wrong" scenarios

    Severity levels:
    - CRITICAL: Would kill the idea entirely
    - MAJOR: Requires significant rethink
    - MINOR: Addressable with effort
    - NOTE: Worth considering`,
});

async function challenge(idea: Idea, scores: Scores): Promise<RedTeamResults> {
  // Target highest scores for deflation
  const highScores = findHighestScores(scores);

  // Target lowest confidence areas
  const weakPoints = findWeakPoints(idea);

  const challenges = await redteamAgent.run({
    prompt: `Red-team this idea:
      ${idea.description}

      Scores to challenge: ${highScores}
      Weak points to attack: ${weakPoints}

      Generate 5-7 critical challenges.`,
    schema: RedTeamSchema,
  });

  return challenges;
}
```

### 11.7 Classification and Auto-Sorting

```typescript
// classifier.ts
const classifierAgent = new Agent({
  name: "classifier",
  systemPrompt: `You classify ideas for visualization and discovery.

    Assign:
    - Primary domain: business, creative, technical, personal, research
    - Secondary domains: (if applicable)
    - Tags: from controlled vocabulary + free tags
    - Relationships to other ideas: parent, child, related, combines, conflicts

    Determine leaderboard position based on:
    - Overall score (weighted average)
    - Red-team survival rate
    - Completeness of evaluation`,
});
```

### 11.8 Idea Relationship Detection

```typescript
// Part of classifier.ts
async function detectRelationships(
  newIdea: Idea,
  existingIdeas: Idea[],
): Promise<Relationship[]> {
  const relationships = await classifierAgent.run({
    prompt: `Analyze relationships between this new idea and existing ones:

      New idea: ${newIdea.summary}

      Existing ideas:
      ${existingIdeas.map((i) => `- ${i.slug}: ${i.summary}`).join("\n")}

      For each relationship found, specify:
      - Target idea slug
      - Relationship type: parent, child, related, combines, conflicts, inspired_by
      - Strength: strong, medium, weak
      - Reasoning`,
    schema: RelationshipsSchema,
  });

  return relationships;
}
```

### 11.9 Leaderboard and Graph Data Generation

The classification agent outputs structured data for:

**Leaderboard View:**

```json
{
  "ideas": [
    {
      "rank": 1,
      "slug": "ai-powered-garden",
      "title": "AI-Powered Garden Monitor",
      "overallScore": 7.8,
      "problemScore": 8.2,
      "solutionScore": 7.5,
      "feasibilityScore": 8.0,
      "fitScore": 7.2,
      "marketScore": 7.8,
      "riskScore": 7.0,
      "redteamSurvivalRate": 0.85,
      "lifecycle": "EVALUATE",
      "domain": "technical",
      "tags": ["iot", "sustainability", "consumer"]
    }
  ]
}
```

**Relationship Graph:**

```json
{
  "nodes": [
    {
      "id": "ai-garden",
      "label": "AI Garden",
      "domain": "technical",
      "score": 7.8
    },
    {
      "id": "smart-home",
      "label": "Smart Home Hub",
      "domain": "technical",
      "score": 6.5
    }
  ],
  "edges": [
    {
      "source": "ai-garden",
      "target": "smart-home",
      "type": "combines",
      "strength": "strong"
    }
  ]
}
```

---

## 12. AGENT DEBATE SYSTEM (Adversarial Evaluation)

> **KEY MECHANISM**: Instead of simple sequential scoring, evaluations happen through **structured adversarial debates** between Evaluator Agents and Red Team Agents. This produces more robust, defensible assessments.

### 12.1 Why Debates Instead of Simple Scoring?

| Simple Scoring                  | Debate-Based Evaluation               |
| ------------------------------- | ------------------------------------- |
| Agent scores in isolation       | Scores must survive cross-examination |
| No accountability for reasoning | Must defend every claim               |
| Bias goes unchallenged          | Adversary actively seeks flaws        |
| Single perspective              | Multiple competing viewpoints         |
| Scores feel arbitrary           | Scores reflect survived arguments     |

### 12.2 Debate Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT DEBATE ARENA                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EVALUATOR PANEL                          RED TEAM PANEL                    │
│  (Claude Opus 4.5)                        (Claude Opus 4.5)                 │
│                                                                             │
│  ┌─────────────────┐                      ┌─────────────────┐               │
│  │ Problem Quality │◄────── DEBATE ──────►│ Red Team Alpha  │               │
│  │   Evaluator     │         ↕            │   (Skeptic)     │               │
│  └─────────────────┘         │            └─────────────────┘               │
│                              │                                              │
│  ┌─────────────────┐         │            ┌─────────────────┐               │
│  │ Solution Quality│◄────────┼───────────►│ Red Team Beta   │               │
│  │   Evaluator     │         │            │  (Competitor)   │               │
│  └─────────────────┘         │            └─────────────────┘               │
│                              │                                              │
│  ┌─────────────────┐         │            ┌─────────────────┐               │
│  │  Feasibility    │◄────────┼───────────►│ Red Team Gamma  │               │
│  │   Evaluator     │         │            │   (Realist)     │               │
│  └─────────────────┘         │            └─────────────────┘               │
│                              │                                              │
│         ...                  │                   ...                        │
│                              │                                              │
│                              ▼                                              │
│                    ┌─────────────────┐                                      │
│                    │     ARBITER     │                                      │
│                    │  (Judge Agent)  │                                      │
│                    │                 │                                      │
│                    │ • Scores debate │                                      │
│                    │ • Determines    │                                      │
│                    │   point winners │                                      │
│                    │ • Adjusts final │                                      │
│                    │   scores        │                                      │
│                    └─────────────────┘                                      │
│                              │                                              │
│                              ▼                                              │
│                    ┌─────────────────┐                                      │
│                    │  LIVE TRANSCRIPT│                                      │
│                    │   (Real-time)   │                                      │
│                    └─────────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.3 Agent Roles and Personas

#### Evaluator Agents (Defenders)

| Agent                     | Role                                      | First Principles Focus                                                    |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| **Problem Evaluator**     | Defends problem severity/frequency scores | "Does this problem exist from first principles? What's the root cause?"   |
| **Solution Evaluator**    | Defends solution quality scores           | "Does this solution address root causes? What's the simplest version?"    |
| **Feasibility Evaluator** | Defends feasibility scores                | "What are the irreducible requirements? What must be true?"               |
| **Fit Evaluator**         | Defends strategic fit scores              | "What are the user's actual constraints? What optimizes for their goals?" |
| **Market Evaluator**      | Defends market/timing scores              | "What are the fundamental market dynamics? What's the forcing function?"  |
| **Risk Evaluator**        | Defends risk assessment                   | "What are the true unknowns? What assumptions are load-bearing?"          |

#### Red Team Agents (Challengers)

| Agent                            | Persona                     | Attack Pattern                                                                 |
| -------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| **Red Team Alpha**               | The Skeptic                 | "I don't believe your numbers. Prove it." Questions all quantitative claims.   |
| **Red Team Beta**                | The Competitor              | "I'm a well-funded incumbent. Here's how I'd crush you." Competitive threats.  |
| **Red Team Gamma**               | The Realist                 | "You're being optimistic. Here's what actually happens." Execution reality.    |
| **Red Team Delta** _(v2 only)_   | The Contrarian              | "What if the opposite is true?" Inverts core assumptions.                      |
| **Red Team Epsilon** _(v2 only)_ | The Edge-Case Finder        | "What about when X happens?" Finds failure modes.                              |
| **Red Team Zeta** _(v2 only)_    | The First Principles Purist | "You're reasoning from analogy, not first principles." Challenges methodology. |

#### Arbiter Agent (Judge)

```typescript
const arbiterAgent = new Agent({
  name: "debate-arbiter",
  model: "claude-opus-4-5-20251101",
  systemPrompt: `You are an impartial judge evaluating debates about idea quality.

    Your job:
    1. Determine who won each exchange (Evaluator or Red Team)
    2. Track which arguments were successfully defended
    3. Track which attacks landed and weren't rebutted
    4. Adjust scores based on debate outcomes
    5. Flag when evaluators used weak reasoning (appeals to authority, ad hoc explanations)
    6. Reward first principles reasoning on both sides

    Scoring rubric:
    - POINT TO EVALUATOR: Claim defended with evidence and reasoning
    - POINT TO RED TEAM: Claim challenged successfully, no adequate defense
    - DRAW: Neither side conclusively won the exchange
    - FIRST PRINCIPLES BONUS: +1 when reasoning from fundamentals

    Be ruthless. Bad ideas should lose debates.`,
});
```

### 12.4 Debate Protocol

#### Phase 1: Opening (Parallel)

All evaluator agents run simultaneously, producing initial scores and reasoning.

```
┌──────────────────────────────────────────────────────────────────┐
│ ROUND 0: OPENING STATEMENTS (Parallel)                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Problem Evaluator]: "I score Problem Severity at 8/10 because..."│
│ [Solution Evaluator]: "I score Uniqueness at 7/10 because..."    │
│ [Feasibility Evaluator]: "I score Technical Complexity at 6/10..."│
│ ...                                                              │
│                                                                  │
│ All 6 evaluators present simultaneously                          │
└──────────────────────────────────────────────────────────────────┘
```

#### Phase 2: Cross-Examination (Sequential Rounds)

Each evaluator faces challenges from red team agents.

```
┌──────────────────────────────────────────────────────────────────┐
│ ROUND 1: CROSS-EXAMINATION                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Red Team Alpha → Problem Evaluator]:                            │
│   "You claim the problem is severe. But only 12% of your target  │
│    audience has ever complained about this. Where's the pain?"   │
│                                                                  │
│ [Problem Evaluator]:                                             │
│   "The 12% figure represents vocal complainers. From first       │
│    principles, the underlying friction affects 100% of users who │
│    perform this task. Most suffer silently. The severity is in   │
│    the frequency × friction, not complaint volume."              │
│                                                                  │
│ [ARBITER]: Point to Evaluator. First principles reasoning        │
│            applied. Score defended.                              │
│                                                                  │
│ [Red Team Beta → Problem Evaluator]:                             │
│   "Incumbents have existed for 10 years without solving this.    │
│    If it were truly severe, wouldn't they have addressed it?"    │
│                                                                  │
│ [Problem Evaluator]:                                             │
│   "Incumbents optimize for different metrics. Their business     │
│    model depends on the friction existing. This is a feature,    │
│    not a bug, for them."                                         │
│                                                                  │
│ [ARBITER]: Point to Evaluator. Structural explanation provided.  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Phase 3: Deep Dive (Targeted Attacks)

Red team focuses on weakest scores and highest-value targets.

```
┌──────────────────────────────────────────────────────────────────┐
│ ROUND 2: DEEP DIVE ON WEAK POINTS                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Red Team Gamma → Feasibility Evaluator]:                        │
│   "You scored Technical Complexity at 6/10, claiming it's        │
│    'moderately complex.' But you're assuming access to APIs that │
│    don't exist yet. Without them, this is a 2/10."               │
│                                                                  │
│ [Feasibility Evaluator]:                                         │
│   "The APIs are announced for Q2. The score assumes they ship."  │
│                                                                  │
│ [Red Team Gamma]:                                                │
│   "Assuming announced features ship on time is not first         │
│    principles reasoning. What's the historical ship rate for     │
│    this vendor's announced features?"                            │
│                                                                  │
│ [Feasibility Evaluator]:                                         │
│   "...I don't have that data."                                   │
│                                                                  │
│ [ARBITER]: Point to Red Team. Critical dependency unvalidated.   │
│            Technical Complexity score adjusted: 6 → 4            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Phase 4: Final Arguments

Last chance for evaluators to shore up weak points.

#### Phase 5: Verdict

Arbiter produces final adjusted scores and confidence levels.

### 12.5 Debate Configuration Options

| Parameter                        | Options                                    | Default  |
| -------------------------------- | ------------------------------------------ | -------- |
| **Rounds per evaluation**        | 1-5                                        | 3        |
| **Red teamers per evaluator**    | 1-3                                        | 2        |
| **Challenge depth**              | Quick (surface), Standard, Thorough (deep) | Standard |
| **First principles strictness**  | Lenient, Moderate, Strict                  | Moderate |
| **Arbiter intervention**         | Passive (end only), Active (per exchange)  | Active   |
| **Score adjustment range**       | ±1, ±2, ±3 per round                       | ±2       |
| **Minimum confidence threshold** | 0.5-0.9                                    | 0.7      |

### 12.6 Real-Time Transcript Structure

```typescript
interface DebateTranscript {
  ideaId: string;
  startTime: Date;
  endTime: Date;
  rounds: Round[];
  participants: {
    evaluators: Agent[];
    redTeam: Agent[];
    arbiter: Agent;
  };
  finalScores: AdjustedScores;
  summary: DebateSummary;
}

interface Round {
  roundNumber: number;
  exchanges: Exchange[];
}

interface Exchange {
  timestamp: Date;
  challenger: Agent;
  defender: Agent;
  challenge: string;
  defense: string;
  arbiterVerdict: "EVALUATOR" | "RED_TEAM" | "DRAW";
  scoreAdjustment: number;
  reasoning: string;
  firstPrinciplesBonus: boolean;
}

interface DebateSummary {
  pointsWon: { evaluators: number; redTeam: number };
  criticalChallengesLanded: Challenge[];
  successfulDefenses: Defense[];
  scoreAdjustments: Record<
    string,
    { original: number; final: number; delta: number }
  >;
  overallConfidence: number;
  keyInsights: string[];
}
```

### 12.7 Frontend Debate Viewer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DEBATE: AI-Powered Garden Monitor                           LIVE 🔴         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EVALUATORS                │  TRANSCRIPT               │  RED TEAM          │
│  ─────────────             │  ──────────               │  ────────          │
│                            │                           │                    │
│  ┌─────────────┐           │  Round 2 of 3             │  ┌─────────────┐   │
│  │ Problem     │  ██████   │                           │  │ Alpha       │   │
│  │ Score: 8→7  │  WON: 3   │  [13:42:01]               │  │ (Skeptic)   │   │
│  └─────────────┘  LOST: 1  │  Red Team Beta:           │  │ Points: 2   │   │
│                            │  "Your TAM calculation    │  └─────────────┘   │
│  ┌─────────────┐           │   assumes 100% of         │                    │
│  │ Solution    │  ██████   │   gardeners want smart    │  ┌─────────────┐   │
│  │ Score: 7    │  WON: 4   │   devices. Prove it."     │  │ Beta        │   │
│  └─────────────┘  LOST: 0  │                           │  │ (Competitor)│   │
│                            │  [13:42:15]               │  │ Points: 1   │   │
│  ┌─────────────┐           │  Market Evaluator:        │  └─────────────┘   │
│  │ Feasibility │  ████     │  "I'm not assuming 100%.  │                    │
│  │ Score: 6→4  │  WON: 2   │   The 15% early adopter   │  ┌─────────────┐   │
│  └─────────────┘  LOST: 2  │   segment is sufficient   │  │ Gamma       │   │
│                            │   for initial traction."  │  │ (Realist)   │   │
│  ┌─────────────┐           │                           │  │ Points: 3   │   │
│  │ Fit         │  ███████  │  [13:42:22]               │  └─────────────┘   │
│  │ Score: 8    │  WON: 5   │  ARBITER: Point to        │                    │
│  └─────────────┘  LOST: 0  │  Evaluator. Reasonable    │                    │
│                            │  segmentation applied.    │                    │
│  ...                       │                           │                    │
│                            │  ─────────────────────    │                    │
│                            │                           │                    │
│                            │  [TYPING...]              │                    │
│                            │  Red Team Gamma is        │                    │
│                            │  formulating challenge... │                    │
│                            │                           │                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ SCORE TRACKER                                                               │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │ Problem: 8→7  Solution: 7  Feasibility: 6→4  Fit: 8  Market: 7  Risk: 6│  │
│ │ OVERALL: 6.5 (was 7.0)   CONFIDENCE: 0.78   RED TEAM SURVIVAL: 72%    │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.8 First Principles Enforcement

All agents are instructed to reason from first principles. The Arbiter specifically penalizes:

| Fallacy                    | Example                                    | Penalty                     |
| -------------------------- | ------------------------------------------ | --------------------------- |
| **Appeal to Authority**    | "Experts say this market will grow"        | -1 point                    |
| **Reasoning from Analogy** | "It worked for Uber so it'll work here"    | -1 point                    |
| **Circular Logic**         | "It's a good idea because it's innovative" | -1 point                    |
| **Unexamined Assumptions** | "Users want this" (without evidence)       | Challenge must be addressed |
| **Survivorship Bias**      | "Successful companies did X, so X works"   | -1 point                    |

And rewards:

| Good Reasoning                | Example                                               | Bonus    |
| ----------------------------- | ----------------------------------------------------- | -------- |
| **Derived from Fundamentals** | "The physics of the situation require..."             | +1 point |
| **Falsifiable Claims**        | "If X is true, we'd expect to see Y"                  | +1 point |
| **Quantified Uncertainty**    | "I'm 70% confident because..."                        | +1 point |
| **Steel-Manning**             | "The strongest version of the counter-argument is..." | +1 point |

### 12.9 Debate Modes

| Mode                | Use Case          | Depth                                              | Cost    |
| ------------------- | ----------------- | -------------------------------------------------- | ------- |
| **Quick Debate**    | Initial screening | 1 round, 2 red teamers                             | Low     |
| **Standard Debate** | Normal evaluation | 3 rounds, 3 red teamers                            | Medium  |
| **Deep Debate**     | High-stakes ideas | 5 rounds, 6 red teamers, multi-criteria challenges | High    |
| **Tournament**      | Comparing ideas   | Ideas debate each other directly                   | Highest |

### 12.10 Implementation: Debate Orchestrator

```typescript
// debate/orchestrator.ts
import { Agent, ParallelExecutor } from "@anthropic-ai/agent-sdk";

interface DebateConfig {
  rounds: number;
  redTeamersPerEvaluator: number;
  firstPrinciplesStrictness: "lenient" | "moderate" | "strict";
  scoreAdjustmentRange: number;
}

async function runDebate(
  idea: Idea,
  config: DebateConfig,
): Promise<DebateResult> {
  const transcript: DebateTranscript = initializeTranscript(idea);

  // Phase 1: Opening statements (parallel)
  const openingStatements = await ParallelExecutor.run([
    problemEvaluator.evaluate(idea),
    solutionEvaluator.evaluate(idea),
    feasibilityEvaluator.evaluate(idea),
    fitEvaluator.evaluate(idea),
    marketEvaluator.evaluate(idea),
    riskEvaluator.evaluate(idea),
  ]);

  transcript.addRound(0, openingStatements);
  broadcastUpdate(transcript); // Real-time update to frontend

  // Phase 2-4: Cross-examination rounds
  for (let round = 1; round <= config.rounds; round++) {
    const exchanges = await runCrossExamination(
      openingStatements,
      selectRedTeamers(config.redTeamersPerEvaluator),
      config,
    );

    for (const exchange of exchanges) {
      // Run exchange
      const challenge = await exchange.redTeamer.challenge(
        exchange.evaluator.lastStatement,
      );
      broadcastUpdate({ type: "challenge", ...challenge });

      const defense = await exchange.evaluator.defend(challenge);
      broadcastUpdate({ type: "defense", ...defense });

      const verdict = await arbiter.judge(exchange, config);
      broadcastUpdate({ type: "verdict", ...verdict });

      transcript.addExchange(round, exchange, verdict);

      // Adjust scores in real-time
      if (verdict.scoreAdjustment !== 0) {
        adjustScore(exchange.criterion, verdict.scoreAdjustment);
        broadcastUpdate({ type: "scoreChange", ...verdict });
      }
    }
  }

  // Phase 5: Final verdict
  const finalVerdict = await arbiter.summarize(transcript);
  transcript.setFinalVerdict(finalVerdict);
  broadcastUpdate({ type: "complete", ...finalVerdict });

  // Persist
  await persistDebateTranscript(transcript);
  await updateIdeaScores(idea, finalVerdict.adjustedScores);

  return {
    transcript,
    finalScores: finalVerdict.adjustedScores,
    confidence: finalVerdict.confidence,
    keyInsights: finalVerdict.insights,
  };
}
```

### 12.11 Real-Time Updates (WebSocket)

```typescript
// debate/realtime.ts
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

function broadcastUpdate(update: DebateUpdate) {
  const message = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...update,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Frontend connects and receives real-time debate updates
// Each exchange, verdict, and score adjustment is pushed immediately
```

### 12.12 Debate Outcomes

After a debate, the system produces:

1. **Adjusted Scores**: Original scores modified by debate outcomes
2. **Confidence Level**: How well scores survived challenges (0-1)
3. **Red Team Survival Rate**: % of challenges successfully defended
4. **Key Insights**: Critical challenges that revealed important considerations
5. **Debate Transcript**: Full record of all exchanges
6. **Weak Points Identified**: Specific areas that need more investigation
7. **Strong Points Confirmed**: Claims that withstood rigorous challenge

### 12.13 Cost Considerations

| Debate Type | Agents Involved            | Estimated API Calls | Approximate Cost |
| ----------- | -------------------------- | ------------------- | ---------------- |
| Quick       | 6 eval + 2 red + 1 arbiter | ~20                 | $0.50-1.00       |
| Standard    | 6 eval + 3 red + 1 arbiter | ~50-80              | $2-4             |
| Deep        | 6 eval + 6 red + 1 arbiter | ~150-200            | $8-15            |
| Tournament  | 2 ideas × full debate      | ~300-400            | $15-30           |

_Costs assume Claude Opus 4.5 at current pricing. Actual costs depend on response lengths._

---

## 12A. FINITE SYNTHESIS PROTOCOL (Crystallization)

> **CRITICAL MECHANISM**: This section defines how the system reaches a **final, stable, irreversible state** through a structured multi-round synthesis process. Without this, evaluations could oscillate indefinitely.

### 12A.1 The Core Problem

| Issue                                       | Risk                                    |
| ------------------------------------------- | --------------------------------------- |
| Debates have no natural endpoint            | Infinite loops, wasted compute          |
| Multiple agents produce conflicting signals | No clear "truth" emerges                |
| Scores can oscillate between rounds         | Never converges                         |
| "Done" is undefined                         | User doesn't know when to trust results |
| Contradictions are averaged, not resolved   | Weak synthesis, mushy conclusions       |

### 12A.2 The Crystallization Metaphor

Ideas undergo a phase transition from **fluid** (uncertain, unstable) to **crystalline** (certain, stable):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IDEA CRYSTALLIZATION PROTOCOL                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: NUCLEATION                                                        │
│  ─────────────────────                                                      │
│  Initial structure forms. Evaluators produce first scores.                  │
│  State: FLUID (high uncertainty, scores provisional)                        │
│                                                                             │
│         ┌─────────────────────────────────────────┐                         │
│         │  ○ ○ ○ ○ ○ ○  Unstructured particles    │                         │
│         │    ○ ○ ○ ○ ○  (raw evaluations)         │                         │
│         └─────────────────────────────────────────┘                         │
│                           │                                                 │
│                           ▼                                                 │
│  PHASE 2: PERTURBATION                                                      │
│  ─────────────────────────                                                  │
│  Red team applies energy. Challenges shake weak structures.                 │
│  State: TURBULENT (scores adjust, contradictions surface)                   │
│                                                                             │
│         ┌─────────────────────────────────────────┐                         │
│         │  ≋≋≋≋≋≋≋≋≋≋  Waves of challenge         │                         │
│         │  ○→○←○→○←○  Particles reorganizing      │                         │
│         └─────────────────────────────────────────┘                         │
│                           │                                                 │
│                           ▼                                                 │
│  PHASE 3: ANNEALING                                                         │
│  ─────────────────────                                                      │
│  System cools. Synthesis agent resolves contradictions.                     │
│  State: COOLING (uncertainty decreasing, structure emerging)                │
│                                                                             │
│         ┌─────────────────────────────────────────┐                         │
│         │  ◇─◇─◇─◇     Bonds forming              │                         │
│         │    ◇─◇─◇     Structure stabilizing      │                         │
│         └─────────────────────────────────────────┘                         │
│                           │                                                 │
│                           ▼                                                 │
│  PHASE 4: CRYSTALLIZATION                                                   │
│  ─────────────────────────                                                  │
│  Convergence detected. Scores stable. Structure solid.                      │
│  State: SOLID (high confidence, minimal delta)                              │
│                                                                             │
│         ┌─────────────────────────────────────────┐                         │
│         │  ◆═◆═◆═◆     Rigid crystal lattice      │                         │
│         │  ║ ║ ║ ║     (stable evaluation)        │                         │
│         │  ◆═◆═◆═◆                                │                         │
│         └─────────────────────────────────────────┘                         │
│                           │                                                 │
│                           ▼                                                 │
│  PHASE 5: LOCKDOWN                                                          │
│  ─────────────────────                                                      │
│  Final state sealed. Immutable without new external input.                  │
│  State: LOCKED (evaluation complete, archived)                              │
│                                                                             │
│         ┌─────────────────────────────────────────┐                         │
│         │  🔒 FINAL EVALUATION                    │                         │
│         │  Score: 7.2 | Confidence: 0.89          │                         │
│         │  Status: CRYSTALLIZED                   │                         │
│         └─────────────────────────────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12A.3 Round Structure: The Convergence Loop

Each round follows a strict protocol. The system exits when termination conditions are met.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROUND STRUCTURE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ROUND N                                                              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  STEP 1: POSITION STATEMENT                                          │   │
│  │  ├─ Evaluators state current scores + reasoning                      │   │
│  │  └─ Explicit confidence level per criterion                          │   │
│  │                                                                      │   │
│  │  STEP 2: CHALLENGE PHASE                                             │   │
│  │  ├─ Red team selects targets (lowest confidence, highest scores)     │   │
│  │  ├─ Each challenge must be specific, falsifiable                     │   │
│  │  └─ Evaluator must respond to each challenge                         │   │
│  │                                                                      │   │
│  │  STEP 3: ARBITER VERDICT                                             │   │
│  │  ├─ Judge each exchange: EVALUATOR | RED_TEAM | DRAW                 │   │
│  │  ├─ Apply score adjustments                                          │   │
│  │  └─ Flag unresolved contradictions                                   │   │
│  │                                                                      │   │
│  │  STEP 4: SYNTHESIS                                                   │   │
│  │  ├─ Synthesis Agent consolidates round results                       │   │
│  │  ├─ Resolves contradictions (not averages them)                      │   │
│  │  ├─ Produces unified position statement                              │   │
│  │  └─ Updates confidence levels                                        │   │
│  │                                                                      │   │
│  │  STEP 5: CONVERGENCE CHECK                                           │   │
│  │  ├─ Calculate Δ (score delta from previous round)                    │   │
│  │  ├─ Check termination conditions                                     │   │
│  │  └─ If not converged → ROUND N+1                                     │   │
│  │      If converged → FINALIZATION                                     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12A.4 Termination Conditions (Convergence Criteria)

> **Implementation Note**: The authoritative confidence calculation formula is in `agents/convergence.ts` (see IMPLEMENTATION-PLAN.md Appendix H.3).
>
> **Formula**: `confidence = survivalComponent×0.4 + rigorComponent×0.2 + stabilityComponent×0.2 + completenessComponent×0.2`

The system reaches final state when **ALL** of these conditions are met:

```typescript
interface ConvergenceCriteria {
  // 1. Score Stability
  scoreStability: {
    maxDelta: 0.5;           // Max score change per criterion
    consecutiveRounds: 2;    // Must be stable for N rounds
    aggregateDelta: 1.0;     // Max total change across all criteria
  };

  // 2. Confidence Threshold
  confidenceThreshold: {
    minimum: 0.7;            // Each criterion must have ≥70% confidence
    criticalMinimum: 0.8;    // Critical criteria need higher bar
  };

  // 3. Challenge Resolution
  challengeResolution: {
    criticalResolved: true;  // All CRITICAL challenges must be addressed
    majorResolved: 0.8;      // 80% of MAJOR challenges addressed
    openBlockers: 0;         // No "blocking" questions remaining
  };

  // 4. Information Saturation
  informationSaturation: {
    newInsightsPerRound: 2;  // If <2 new insights, approaching saturation
    repeatChallenges: 0.5;   // If >50% challenges are repeats, saturated
  };

  // 5. Hard Limits (failsafe)
  hardLimits: {
    maxRounds: 5;            // Never exceed N rounds
    maxDuration: 300000;     // 5 minute timeout
    maxCost: 20.00;          // Dollar limit per evaluation
  };
}

function checkConvergence(state: EvaluationState): ConvergenceResult {
  const stability = calculateStability(state.scoreHistory);
  const confidence = calculateConfidence(state.currentScores);
  const resolution = calculateResolution(state.challenges);
  const saturation = calculateSaturation(state.insights);

  const converged =
    stability.met &&
    confidence.met &&
    resolution.met &&
    (saturation.met || state.roundNumber >= hardLimits.maxRounds);

  return {
    converged,
    reason: converged ? determineConvergenceReason(...) : null,
    blockers: converged ? [] : identifyBlockers(...),
    recommendation: converged ? 'FINALIZE' : 'CONTINUE',
  };
}
```

### 12A.5 The Synthesis Agent

Unlike evaluators (who score) and red team (who challenge), the **Synthesis Agent** has one job: **resolve contradictions and produce unified truth**.

```typescript
const synthesisAgent = new Agent({
  name: "synthesis",
  model: "claude-opus-4-5-20251101",
  systemPrompt: `You are the Synthesis Agent. Your job is to resolve contradictions
    and produce a unified, coherent evaluation. You do NOT average or compromise.

    RULES:
    1. When evaluators disagree, determine who is RIGHT, not what the middle is
    2. When evidence conflicts, weigh quality, not quantity
    3. Explicitly state which position prevailed and WHY
    4. Produce a single coherent narrative, not a list of perspectives
    5. Flag remaining uncertainties honestly
    6. Your synthesis becomes the new ground truth for the next round

    OUTPUT STRUCTURE:
    - Unified score per criterion (not a range)
    - Confidence level (0-1)
    - Resolution statement for each conflict
    - Remaining open questions (if any)
    - Synthesis narrative (3-5 sentences)`,
});

interface SynthesisOutput {
  criterion: string;
  unifiedScore: number; // Single number, not range
  confidence: number; // 0-1
  prevailingPosition: string; // Which side won
  resolutionReasoning: string; // WHY that side won
  openQuestions: string[]; // What remains unknown
  narrative: string; // Human-readable summary
}
```

### 12A.6 Conflict Resolution Protocol

When evaluators or rounds produce contradictory information:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONFLICT RESOLUTION DECISION TREE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONFLICT DETECTED                                                          │
│  (Score A ≠ Score B, or Claim A contradicts Claim B)                        │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────┐                                │
│  │ Is one position based on first          │                                │
│  │ principles and the other on analogy?    │                                │
│  └────────────────┬────────────────────────┘                                │
│         │                    │                                              │
│        YES                  NO                                              │
│         │                    │                                              │
│         ▼                    ▼                                              │
│  ┌──────────────┐   ┌─────────────────────────────────┐                     │
│  │ First        │   │ Is one position supported by    │                     │
│  │ principles   │   │ falsifiable evidence?           │                     │
│  │ WINS         │   └────────────────┬────────────────┘                     │
│  └──────────────┘          │                    │                           │
│                           YES                  NO                           │
│                            │                    │                           │
│                            ▼                    ▼                           │
│                   ┌──────────────┐   ┌─────────────────────────────────┐    │
│                   │ Evidence-    │   │ Is one position more specific   │    │
│                   │ backed       │   │ (narrow claim) vs general?      │    │
│                   │ WINS         │   └────────────────┬────────────────┘    │
│                   └──────────────┘          │                    │          │
│                                            YES                  NO          │
│                                             │                    │          │
│                                             ▼                    ▼          │
│                                    ┌──────────────┐   ┌──────────────┐      │
│                                    │ Specific     │   │ FLAG as      │      │
│                                    │ claim        │   │ UNRESOLVED   │      │
│                                    │ WINS         │   │ (lower       │      │
│                                    └──────────────┘   │ confidence)  │      │
│                                                       └──────────────┘      │
│                                                                             │
│  RESOLUTION OUTPUT:                                                         │
│  ├─ Winner: [Position A or B]                                               │
│  ├─ Loser acknowledged: "Position B was rejected because..."                │
│  ├─ Unified score: [Winner's score, possibly adjusted]                      │
│  └─ Confidence: [Higher if clear winner, lower if forced choice]            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12A.7 Multi-Round State Machine

The evaluation process is a finite state machine with clear transitions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVALUATION STATE MACHINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        ┌─────────────┐                                      │
│                        │   START     │                                      │
│                        └──────┬──────┘                                      │
│                               │                                             │
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │    NUCLEATION       │                                  │
│                    │  (Initial Scoring)  │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                             │
│                               ▼                                             │
│      ┌───────────────────────────────────────────────────┐                  │
│      │                                                   │                  │
│      │    ┌─────────────────────┐                        │                  │
│      │    │   PERTURBATION      │◄───────────────────┐   │                  │
│      │    │   (Debate Round)    │                    │   │                  │
│      │    └──────────┬──────────┘                    │   │                  │
│      │               │                               │   │                  │
│      │               ▼                               │   │                  │
│      │    ┌─────────────────────┐                    │   │                  │
│      │    │     ANNEALING       │                    │   │                  │
│      │    │    (Synthesis)      │                    │   │                  │
│      │    └──────────┬──────────┘                    │   │                  │
│      │               │                               │   │                  │
│      │               ▼                               │   │                  │
│      │    ┌─────────────────────┐    NOT CONVERGED   │   │                  │
│      │    │  CONVERGENCE CHECK  │────────────────────┘   │                  │
│      │    └──────────┬──────────┘                        │                  │
│      │               │                                   │                  │
│      │           CONVERGED                               │                  │
│      │               │                                   │                  │
│      └───────────────┼───────────────────────────────────┘                  │
│                      │                                                      │
│                      ▼                                                      │
│           ┌─────────────────────┐                                           │
│           │  CRYSTALLIZATION    │                                           │
│           │ (Final Synthesis)   │                                           │
│           └──────────┬──────────┘                                           │
│                      │                                                      │
│                      ▼                                                      │
│           ┌─────────────────────┐                                           │
│           │     LOCKDOWN        │                                           │
│           │  (Seal & Archive)   │                                           │
│           └──────────┬──────────┘                                           │
│                      │                                                      │
│                      ▼                                                      │
│                ┌──────────┐                                                 │
│                │   END    │                                                 │
│                └──────────┘                                                 │
│                                                                             │
│  TRANSITIONS:                                                               │
│  ├─ NUCLEATION → PERTURBATION: Always (initial scores exist)                │
│  ├─ PERTURBATION → ANNEALING: Always (round complete)                       │
│  ├─ ANNEALING → CONVERGENCE CHECK: Always (synthesis complete)              │
│  ├─ CONVERGENCE CHECK → PERTURBATION: If NOT converged                      │
│  ├─ CONVERGENCE CHECK → CRYSTALLIZATION: If converged                       │
│  ├─ CRYSTALLIZATION → LOCKDOWN: Always (final synthesis complete)           │
│  └─ LOCKDOWN → END: Always (state sealed)                                   │
│                                                                             │
│  INVARIANTS:                                                                │
│  ├─ Max rounds enforced (hard limit prevents infinite loops)                │
│  ├─ Each state has explicit entry/exit conditions                           │
│  ├─ No state can transition to itself without passing through others        │
│  └─ END is terminal and irreversible                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12A.8 The Final Synthesis Document

When crystallization completes, the system produces an immutable **Final Synthesis Document**:

```typescript
interface FinalSynthesisDocument {
  // Metadata
  ideaId: string;
  ideaTitle: string;
  evaluationId: string;
  completedAt: Date;
  totalRounds: number;
  totalDuration: number;

  // Final Scores (immutable)
  scores: {
    criterion: string;
    finalScore: number; // Crystallized score
    initialScore: number; // What it started as
    delta: number; // How much it changed
    confidence: number; // Final confidence
    defenseRecord: {
      // How well it survived challenges
      challenged: number;
      defended: number;
      survivalRate: number;
    };
  }[];

  // Composite Metrics
  composites: {
    overallScore: number;
    overallConfidence: number;
    redTeamSurvivalRate: number;
    convergenceRound: number; // Which round achieved convergence
    stabilityIndex: number; // How stable the final state is
  };

  // Synthesis Narrative
  narrative: {
    executiveSummary: string; // 2-3 sentences
    keyStrengths: string[]; // What survived challenge
    keyWeaknesses: string[]; // What didn't survive
    criticalAssumptions: string[]; // Must be true for idea to work
    unresolvedQuestions: string[]; // What remains unknown
    recommendation: "PURSUE" | "REFINE" | "PAUSE" | "ABANDON";
    recommendationReasoning: string;
  };

  // Audit Trail
  auditTrail: {
    roundSummaries: RoundSummary[];
    majorConflicts: ConflictResolution[];
    scoreTrajectory: ScoreTimeline[];
  };

  // Lock Status
  locked: true;
  lockReason: "CONVERGENCE" | "MAX_ROUNDS" | "USER_APPROVED" | "TIMEOUT";
  reopenConditions: string[]; // What new info would justify reopening
}
```

### 12A.9 Reopening a Crystallized Evaluation

Once locked, an evaluation can only be reopened under specific conditions:

| Trigger                      | Action                                     | Scope          |
| ---------------------------- | ------------------------------------------ | -------------- |
| **New Material Information** | Full re-evaluation from nucleation         | Complete reset |
| **User Disputes Score**      | Targeted review of disputed criterion only | Partial reopen |
| **Related Idea Changes**     | Update relationship graph, not scores      | Metadata only  |
| **Time-Based Decay**         | Optional confidence decay over time        | Soft reopen    |

```typescript
function canReopenEvaluation(
  evaluation: FinalSynthesisDocument,
  trigger: ReopenTrigger,
): ReopenDecision {
  // Check if trigger is valid
  if (trigger.type === "NEW_INFORMATION") {
    // New info must be material (would have changed scores by >1)
    const estimatedImpact = estimateImpact(trigger.newInfo, evaluation);
    if (estimatedImpact.scoreDelta < 1) {
      return { allowed: false, reason: "Information not material enough" };
    }
    return {
      allowed: true,
      scope: "FULL",
      action: "RE_NUCLEATE",
    };
  }

  if (trigger.type === "USER_DISPUTE") {
    // User can dispute, but must provide reasoning
    if (!trigger.reasoning || trigger.reasoning.length < 50) {
      return {
        allowed: false,
        reason: "Dispute requires substantive reasoning",
      };
    }
    return {
      allowed: true,
      scope: "TARGETED",
      affectedCriteria: [trigger.disputedCriterion],
      action: "PARTIAL_REVIEW",
    };
  }

  return { allowed: false, reason: "Invalid trigger type" };
}
```

### 12A.10 Convergence Visualization

The frontend shows real-time convergence progress:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONVERGENCE STATUS: AI-Powered Garden Monitor                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE: ANNEALING (Round 3 of max 5)                                        │
│  ═══════════════════════════════════════════════════════════════════        │
│                                                                             │
│  SCORE TRAJECTORY                                                           │
│  ────────────────                                                           │
│                                                                             │
│  10│                                                                        │
│   9│      ┌─○                                                               │
│   8│  ○───┘   ╲___○────○  ← Problem Quality (converged ✓)                   │
│   7│              ╲                                                         │
│   6│  ○─────○──────○───○  ← Feasibility (converged ✓)                       │
│   5│        ╲                                                               │
│   4│         ╲                                                              │
│   3│  ○───────○───○────?  ← Solution Quality (still moving)                 │
│   2│                                                                        │
│   1│                                                                        │
│   0└──────────────────────                                                  │
│     R0    R1    R2    R3                                                    │
│                                                                             │
│  CONVERGENCE CHECKLIST                                                      │
│  ─────────────────────                                                      │
│  [✓] Score stability (Δ < 0.5)      : 4/6 criteria stable                   │
│  [✓] Confidence threshold (≥0.7)    : 5/6 criteria met                      │
│  [✓] Critical challenges resolved   : 3/3 addressed                         │
│  [○] Major challenges resolved      : 7/9 (78%, need 80%)                   │
│  [✓] No blocking questions          : 0 blockers                            │
│                                                                             │
│  PREDICTION: 1 more round to convergence                                    │
│  BLOCKERS: Solution Quality score still volatile (challenged twice)         │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ [Force Convergence]  [Add Round]  [Pause Evaluation]  [Abort]         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12A.11 Implementation: Finite Synthesis Loop

```typescript
// synthesis/convergence-loop.ts

async function runFiniteSynthesis(
  idea: Idea,
  config: ConvergenceConfig,
): Promise<FinalSynthesisDocument> {
  // Initialize state
  let state: EvaluationState = {
    phase: "NUCLEATION",
    roundNumber: 0,
    scoreHistory: [],
    challenges: [],
    insights: [],
    conflicts: [],
  };

  // PHASE 1: NUCLEATION
  state = await nucleate(idea, state);
  broadcastState(state);

  // MAIN CONVERGENCE LOOP
  while (state.phase !== "LOCKED") {
    // Check hard limits
    if (state.roundNumber >= config.hardLimits.maxRounds) {
      state.phase = "CRYSTALLIZATION";
      state.lockReason = "MAX_ROUNDS";
      break;
    }

    // PHASE 2: PERTURBATION (Debate)
    state.phase = "PERTURBATION";
    state = await runDebateRound(idea, state, config);
    broadcastState(state);

    // PHASE 3: ANNEALING (Synthesis)
    state.phase = "ANNEALING";
    state = await synthesize(state);
    broadcastState(state);

    // PHASE 4: CONVERGENCE CHECK
    const convergence = checkConvergence(state, config.convergenceCriteria);

    if (convergence.converged) {
      state.phase = "CRYSTALLIZATION";
      state.lockReason = "CONVERGENCE";
    } else {
      state.roundNumber++;
      // Continue loop → back to PERTURBATION
    }

    broadcastState(state);
  }

  // PHASE 5: CRYSTALLIZATION (Final Synthesis)
  const finalSynthesis = await crystallize(idea, state);

  // PHASE 6: LOCKDOWN
  const lockedDocument = await lockdown(finalSynthesis);

  // Persist
  await persistFinalSynthesis(lockedDocument);
  await updateIdeaWithFinalScores(idea, lockedDocument);

  return lockedDocument;
}

async function synthesize(state: EvaluationState): Promise<EvaluationState> {
  // Identify conflicts from this round
  const conflicts = identifyConflicts(state.currentRound);

  // Resolve each conflict
  const resolutions = await Promise.all(
    conflicts.map((conflict) => synthesisAgent.resolve(conflict)),
  );

  // Update scores based on resolutions
  const newScores = applyResolutions(state.scores, resolutions);

  // Update confidence based on resolution quality
  const newConfidence = calculateConfidence(newScores, resolutions);

  return {
    ...state,
    scores: newScores,
    confidence: newConfidence,
    conflicts: [...state.conflicts, ...resolutions],
    scoreHistory: [...state.scoreHistory, newScores],
  };
}
```

### 12A.12 Elegance Principles

The synthesis protocol follows these design principles:

| Principle                     | Implementation                                                          |
| ----------------------------- | ----------------------------------------------------------------------- |
| **Deterministic Termination** | Hard limits + convergence criteria guarantee end state                  |
| **Monotonic Confidence**      | Confidence can only increase or plateau, never decrease in final rounds |
| **Explicit Resolution**       | Every conflict has a winner, not a compromise                           |
| **Audit Trail**               | Complete history of how final scores were derived                       |
| **Immutable Final State**     | Once locked, evaluation is read-only                                    |
| **Clear Reopening Criteria**  | Only new material information can restart                               |

---

## 13. Honest Feedback: What's Hard About This

### 13.1 Technical Challenges

| Challenge                                     | Difficulty  | Why It's Hard                                       |
| --------------------------------------------- | ----------- | --------------------------------------------------- |
| **Agent SDK learning curve**                  | Medium-High | New paradigm; different from Claude Code skills     |
| **Parallel agent coordination**               | High        | Race conditions, result aggregation, error handling |
| **Consistent scoring**                        | High        | LLMs can be inconsistent; need calibration          |
| **Relationship detection accuracy**           | Medium      | Semantic similarity is fuzzy; may need embeddings   |
| **Self red-teaming that's actually critical** | High        | LLMs tend to be agreeable; need strong prompting    |
| **State management across agents**            | Medium      | Passing context between agents without bloat        |

### 13.2 Conceptual Challenges

| Challenge                      | Issue                                                  |
| ------------------------------ | ------------------------------------------------------ |
| **When is an idea "done"?**    | Evaluation loop could run forever. Need exit criteria. |
| **Score calibration**          | First ideas have no baseline. Need anchor examples.    |
| **Red-team depth vs. speed**   | Deep red-teaming is slow; shallow is useless. Balance? |
| **User interruption handling** | What if user wants to jump in mid-evaluation?          |
| **Idea identity**              | When does a pivoted idea become a new idea?            |

### 13.3 What Could Go Wrong

| Risk                      | Consequence                    | Mitigation                                              |
| ------------------------- | ------------------------------ | ------------------------------------------------------- |
| Agents disagree on scores | Inconsistent evaluations       | Aggregation with confidence weighting                   |
| Red-team is too soft      | False confidence in weak ideas | Strong adversarial prompts; examples of harsh critiques |
| Red-team is too harsh     | Good ideas get killed          | Require user review of CRITICAL issues                  |
| Classification is wrong   | Ideas miscategorized           | User override capability; re-classification option      |
| Infinite loops            | System never completes         | Hard limits on iterations; timeouts                     |
| Cost explosion            | Many parallel agents = $$$     | Budget limits; prioritize expensive evals               |

---

## 13. Questions I Need You to Answer

| #   | Question                                                                                       | Why It Matters                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Should evaluation require user input or be fully autonomous?**                               | If fully autonomous, scores are AI-generated guesses. If user-involved, the system asks "On a scale of 1-10, how painful is this problem?" |
| 2   | **How should ambiguous idea matching work?**                                                   | Present top 3 matches? Semantic similarity threshold? Always ask?                                                                          |
| 3   | **What's the red-team depth vs. speed tradeoff?**                                              | Quick (3 challenges) vs. Thorough (10 challenges with rebuttals)?                                                                          |
| 4   | **Should the system run synchronously (wait for each step) or async (background processing)?** | Affects UX and architecture significantly                                                                                                  |
| 5   | **What's the trigger for running the full pipeline?**                                          | Every new input? Only when user says "evaluate"? On schedule?                                                                              |
| 6   | **How should the system handle "I changed my mind" moments?**                                  | User provides new info that invalidates prior scoring                                                                                      |
| 7   | **What's the minimum viable version?**                                                         | All 6 parallel evaluators from day 1? Or start with single-pass?                                                                           |
| 8   | **Cost sensitivity?**                                                                          | Agent SDK with parallel calls isn't cheap. Budget constraints?                                                                             |

---

## 14. Revised Implementation Phases

> **⚠️ DEPRECATED**: This phase structure is superseded by IMPLEMENTATION-PLAN.md Section 3.
> See Implementation Plan for authoritative phase definitions. The phases below are retained for historical context only.

### Phase 0: Spike / Proof of Concept

| Component                                                  | Purpose                     |
| ---------------------------------------------------------- | --------------------------- |
| Single hardcoded idea                                      | Test the full loop manually |
| One evaluation agent                                       | Prove Agent SDK works       |
| Basic markdown output                                      | Verify persistence          |
| **Goal**: Validate architecture before building everything |

### Phase 1: Foundation

| Component                      | Purpose                          |
| ------------------------------ | -------------------------------- |
| Folder structure               | Organized file system            |
| Templates                      | Consistent idea format           |
| Taxonomy files                 | Lifecycle, criteria, domains     |
| CLAUDE.md                      | Project-wide Claude instructions |
| SQLite schema                  | Database structure               |
| Basic sync script              | Markdown → DB                    |
| **Goal**: Scaffolding in place |

### Phase 2: Core Agent Loop

| Component                                     | Purpose                               |
| --------------------------------------------- | ------------------------------------- |
| Orchestrator agent                            | Route and coordinate                  |
| Development agent                             | Ask questions, populate ideas         |
| Single evaluation agent                       | Score all criteria (not parallel yet) |
| Classification agent                          | Auto-tag, assign domain               |
| Persist to markdown                           | Write results                         |
| **Goal**: End-to-end flow works, not parallel |

### Phase 3: Parallel Evaluation

| Component                                  | Purpose                                           |
| ------------------------------------------ | ------------------------------------------------- |
| 6 specialized evaluator agents             | Problem, Solution, Feasibility, Fit, Market, Risk |
| Parallel execution                         | Run all 6 concurrently                            |
| Score aggregation                          | Combine results, calculate composites             |
| **Goal**: Faster, more thorough evaluation |

### Phase 4: Self Red-Teaming

| Component                         | Purpose                  |
| --------------------------------- | ------------------------ |
| Red-team agent                    | Challenge assumptions    |
| Auto-trigger after evaluation     | No user prompt needed    |
| Re-evaluation loop                | If critical issues found |
| User review gate                  | For CRITICAL challenges  |
| **Goal**: System critiques itself |

### Phase 5: Relationship Detection

| Component                              | Purpose                            |
| -------------------------------------- | ---------------------------------- |
| Idea comparison                        | Detect similar/related ideas       |
| Relationship types                     | Parent, child, combines, conflicts |
| Graph data structure                   | For visualization                  |
| **Goal**: Ideas form a connected graph |

### Phase 6: Frontend Visualization

| Component                                      | Purpose                          |
| ---------------------------------------------- | -------------------------------- |
| Vite + React scaffold                          | Basic app structure              |
| Leaderboard view                               | Ranked ideas by score            |
| Relationship graph                             | D3/Cytoscape visualization       |
| Evaluation matrix                              | Heatmap of all ideas vs criteria |
| Idea detail view                               | Full info on single idea         |
| **Goal**: Visual exploration of idea portfolio |

### Phase 7: Polish and Scale

| Component                         | Purpose              |
| --------------------------------- | -------------------- |
| Error handling                    | Graceful failures    |
| Cost monitoring                   | Track API usage      |
| Performance optimization          | Caching, batching    |
| Mobile capture                    | Phone-friendly input |
| **Goal**: Production-ready system |

---

## 15. Recommended Starting Point

Given the complexity, I recommend:

1. **Start with Phase 0 (Spike)**: Build the smallest possible loop that works
2. **Validate Agent SDK works for your use case** before investing in full architecture
3. **Get one idea through the full pipeline** before parallelizing
4. **Test red-team prompts extensively** - this is where most LLM-based systems fail

---

## Summary (Updated)

This architecture creates a **truly autonomous** idea incubation system where:

- **Ideas flow in** via simple input (conversation or frontend)
- **Orchestrator agent** classifies and routes (new vs. existing vs. ambiguous)
- **Development agent** asks probing questions and populates structured files
- **Parallel evaluation agents** score across 6 dimensions simultaneously
- **Red-team agent** automatically challenges evaluations without prompting
- **Classification agent** auto-sorts, tags, and detects relationships
- **Leaderboard + Graph** visualize the idea portfolio
- **Everything persists** to markdown (source of truth) and SQLite (query layer)

**Key architectural shift**: This is no longer just Claude Code + Skills. It's a **Claude Agent SDK application** with programmatic orchestration, parallel execution, and self-triggering workflows.

The system minimizes user overhead—share an idea, answer questions when asked, and let the agents handle evaluation, red-teaming, classification, and visualization.

---

## Appendix A: Corrections, Gaps, and Honest Assessment

This section documents errors, omissions, and gaps in the original architecture thinking. Added for transparency and to prevent implementation issues.

### A.1 What I Got Wrong

| #   | Error                      | What I Said                                    | Reality                                                               |
| --- | -------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Skill file format**      | Skills are `.md` files in `.claude/skills/`    | Skills are **directories** with `SKILL.md` + YAML frontmatter         |
| 2   | **Skill triggering**       | Skills are explicitly invoked or auto-detected | Skills are **model-invoked** based on description matching            |
| 3   | **"Auto-organization"**    | System automatically routes files              | Claude only organizes when in conversation; no background daemon      |
| 4   | **"Proactive questions"**  | Skills randomly ping users                     | Skills provide instructions; proactivity requires active conversation |
| 5   | **Database sync triggers** | "Claude skill completion triggers sync"        | Claude Code has no built-in hook for post-skill database operations   |

### A.2 What I Forgot / Didn't Think Through

| #   | Gap                          | Issue                                                      | Resolution Needed                                                                |
| --- | ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | **Frontend database access** | Browsers can't directly access SQLite files                | **RESOLVED**: Use Express API with better-sqlite3 on server (see Decision A.4.1) |
| 2   | **Mobile capture mechanism** | "Capture from phone via frontend" requires deployment      | Vite app needs hosting + API endpoint to create markdown files                   |
| 3   | **Index maintenance**        | `ideas/_index.md` was mentioned but no mechanism defined   | Needs manual update, script, or skill instruction to maintain                    |
| 4   | **Template usage**           | Templates listed but not integrated into skills            | Skills must explicitly reference and use templates                               |
| 5   | **Taxonomy enforcement**     | Taxonomy files are just documentation                      | Must be referenced in skills/CLAUDE.md to be enforced                            |
| 6   | **Git hooks**                | Mentioned "git commit hook for sync" but no implementation | Need actual hook scripts in `.git/hooks/` or husky config                        |
| 7   | **Evaluation UX**            | 30 criteria = tedious to score                             | Should offer quick-score (key criteria only) vs full evaluation modes            |
| 8   | **Sync script runtime**      | Listed `sync-db.ts` but no execution context               | Needs Node.js setup, package.json scripts, dependencies                          |

### A.3 Architectural Assumptions That Need Validation

| #   | Assumption                                                   | Risk                                        | Mitigation                                                  |
| --- | ------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------- |
| 1   | Claude will correctly identify which idea is being discussed | Ambiguity with multiple similar ideas       | CLAUDE.md should instruct Claude to confirm idea context    |
| 2   | Skill descriptions will reliably trigger on intended phrases | May activate incorrectly or not at all      | Test extensively; refine descriptions based on actual usage |
| 3   | Markdown frontmatter parsing will work consistently          | YAML edge cases, malformed input            | Validate with schema; handle parse errors gracefully        |
| 4   | Single sync direction (MD → DB) is sufficient                | Could cause data loss if DB edited directly | Enforce MD as source of truth; DB is read-only cache        |

### A.4 Design Decisions

| #   | Question                                    | Decision                      | Rationale                                                                                                                     |
| --- | ------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | How should the Vite frontend access data?   | **Local Express API**         | Enables WebSocket for real-time debate streaming. More flexible than sql.js. Server can handle complex queries.               |
| 2   | How will you capture ideas from your phone? | **Notes app + manual import** | Simplest for v1. No hosting/auth complexity. Paste into CLI or Claude Code. Can upgrade to PWA in v2.                         |
| 3   | Should evaluation support "quick mode"?     | **Always full 30 criteria**   | Consistent results. Simpler implementation. Cost is acceptable (~$10/eval). Quick mode adds complexity without clear benefit. |
| 4   | How should the index be maintained?         | **Auto-generated script**     | `npm run sync` regenerates `ideas/_index.md`. Reliable, no manual effort, no AI hallucination risk.                           |

#### Implementation Details

**Express API Backend**

```
server/
├── index.ts           # Express server entry
├── routes/
│   ├── ideas.ts       # CRUD endpoints for ideas
│   ├── evaluations.ts # Evaluation data endpoints
│   └── debates.ts     # Debate transcript endpoints
└── websocket.ts       # Real-time debate streaming
```

**Mobile Workflow (Decision #2)**

```
Phone (Notes app) → Desktop (paste) → CLI capture → Markdown → Database
```

**Evaluation Mode (Decision #3)**

- Single mode: `npm run evaluate <slug>` always runs full 30 criteria
- No `--quick` flag needed
- Consistent evaluation depth

**Index Generation (Decision #4)**

- `npm run sync` includes index regeneration
- Template: `ideas/_index.md` with table of all ideas

### A.5 Complexity I Underestimated

| Area                             | What I Implied                         | Actual Complexity                                                                  |
| -------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| **Markdown ↔ DB sync**           | "Simple sync script"                   | Requires: frontmatter parser, change detection, conflict handling, error recovery  |
| **Skill activation reliability** | "Claude detects context and activates" | Requires: careful description tuning, testing, potential false positives/negatives |
| **Frontend visualizations**      | Listed 7 views casually                | Each view (especially graph/matrix) requires significant implementation effort     |
| **Mobile capture**               | "Phone using frontend portal"          | Requires: hosting, possibly authentication, API endpoints, offline handling        |

---

## Appendix B: System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IDEA INCUBATOR SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     USER CONVERSATION                                │   │
│  │  "I have an idea..."  "Let's evaluate..."  "Red team this..."       │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CLAUDE + SKILLS                                  │   │
│  │  • Matches conversation to skill descriptions                        │   │
│  │  • Reads SKILL.md instructions                                       │   │
│  │  • Follows instructions (create files, ask questions, etc.)          │   │
│  │  • References CLAUDE.md for project-wide behavior                    │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     MARKDOWN FILES (Source of Truth)                 │   │
│  │  ideas/[slug]/README.md, evaluation.md, development.md, etc.         │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  │                                          │
│                    ┌─────────────┴─────────────┐                            │
│                    ▼                           ▼                            │
│  ┌─────────────────────────┐     ┌─────────────────────────┐               │
│  │      GIT (History)      │     │   SYNC SCRIPT (Manual)  │               │
│  │  • Version control      │     │   • npm run sync        │               │
│  │  • Commit history       │     │   • Parses MD → SQLite  │               │
│  └─────────────────────────┘     └────────────┬────────────┘               │
│                                               │                             │
│                                               ▼                             │
│                                  ┌─────────────────────────┐               │
│                                  │   SQLITE (Read Cache)   │               │
│                                  │   • For frontend queries│               │
│                                  └────────────┬────────────┘               │
│                                               │                             │
│                                               ▼                             │
│                                  ┌─────────────────────────┐               │
│                                  │   VITE FRONTEND         │               │
│                                  │   • Visualizations      │               │
│                                  │   • Gap analysis        │               │
│                                  └─────────────────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Legend:
  ───▶  Active data flow (happens during use)
  - - ▶  Manual trigger required
```

---

## Appendix C: Formulas & Definitions

### C.1 Evaluation Criteria

The canonical source for criteria is `taxonomy/evaluation-criteria.md`.

| Category          | Criteria (5 each)                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| **Problem**       | Problem Clarity, Problem Severity, Target User Clarity, Problem Validation, Problem Uniqueness            |
| **Solution**      | Solution Clarity, Solution Feasibility, Solution Uniqueness, Solution Scalability, Solution Defensibility |
| **Feasibility**   | Technical Complexity, Resource Requirements, Skill Availability, Time to Value, Dependency Risk           |
| **Strategic Fit** | Personal Fit, Passion Alignment, Skill Match, Network Leverage, Life Stage Fit                            |
| **Market**        | Market Size, Market Growth, Competition Intensity, Entry Barriers, Timing                                 |
| **Risk**          | Execution Risk, Market Risk, Technical Risk, Financial Risk, Regulatory Risk                              |

### C.2 Score Aggregation Formula

```
Overall Score = Σ (CategoryScore × CategoryWeight)

Where:
  CategoryScore = AVG(criterion scores in category)
  CategoryWeight = { problem: 0.20, solution: 0.20, feasibility: 0.15, fit: 0.15, market: 0.15, risk: 0.15 }
```

### C.3 Confidence Calculation Formula

```
Confidence = (
  (challenges_defended / total_challenges) × 0.4 +
  (first_principles_bonuses / total_exchanges) × 0.2 +
  (1 - score_volatility) × 0.2 +
  information_completeness × 0.2
)

Where:
  score_volatility = (max_score - min_score) / 10 over last N rounds
  information_completeness = answered_questions / total_questions
```

### C.4 Idea Identity Formula

```
Idea Identity = hash(problem_statement + target_user)
```

When problem or target user changes fundamentally, the system suggests creating a new idea linked via `inspired_by`.

### C.5 Re-evaluation Staleness Detection

```
is_stale = (current_content_hash != last_evaluation_content_hash)
```

When staleness is detected, user is notified but decides whether to re-evaluate.

---

## Appendix D: v1 vs v2 Scope

| Item                   | v1 (Prototype)                              | v2 (Enhancement)                             |
| ---------------------- | ------------------------------------------- | -------------------------------------------- |
| Evaluator Agents       | 1 generalist                                | 6 specialized (parallel)                     |
| Red Team Personas      | 3 core (Skeptic, Realist, First Principles) | 6 full (+ Competitor, Contrarian, Edge-Case) |
| Relationship Detection | Keyword/tag matching                        | Semantic embeddings                          |
| Frontend Views         | 6 views                                     | 7 views (+ Comparison)                       |
| Mobile Capture         | Notes app + paste                           | PWA with offline                             |

---

## Appendix E: Design Principles

| Principle                  | Implementation                                         |
| -------------------------- | ------------------------------------------------------ |
| **Single Source of Truth** | `taxonomy/evaluation-criteria.md` defines all criteria |
| **Fail Fast**              | Zod schemas validate all agent responses               |
| **Observability**          | `utils/cost-tracker.ts` tracks every API call          |
| **Testability**            | Vitest + mocks before implementation                   |
| **Immutable History**      | Evaluations never modified, only superseded            |
| **User Control**           | Explicit triggers, user overrides, cost confirmation   |

---

## Appendix F: Document Structure

| Document                          | Purpose                                      |
| --------------------------------- | -------------------------------------------- |
| ARCHITECTURE.md                   | System design, agent architecture, data flow |
| IMPLEMENTATION-PLAN.md            | Phase-by-phase build plan with code specs    |
| `taxonomy/evaluation-criteria.md` | Authoritative criteria definitions           |
| `CLAUDE.md`                       | Project-wide Claude Code instructions        |

---

## Appendix G: Agent Orchestration Framework

> **CRITICAL CORRECTION**: The earlier sections reference `@anthropic-ai/agent-sdk` with `Agent` and `ParallelExecutor` classes. This package **does not exist** as described. This appendix defines the actual orchestration layer that must be built using `@anthropic-ai/sdk` (the raw Anthropic client).

### G.1 The Problem

The architecture describes:

```typescript
// FICTIONAL - This API does not exist
import { Agent, ParallelExecutor } from "@anthropic-ai/agent-sdk";

const evaluator = new Agent({
  name: "evaluator",
  systemPrompt: "...",
});
```

**Reality**: Anthropic provides `@anthropic-ai/sdk` which is a raw HTTP client for the Messages API. There is no agent abstraction layer.

### G.2 Custom Agent Framework Design

We must build `lib/agent-framework/` to provide the abstractions described in the architecture.

#### G.2.1 Core Interfaces

```typescript
// lib/agent-framework/types.ts

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  model?: string; // defaults to claude-opus-4-5-20251101
  maxTokens?: number;
  temperature?: number;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  parsed?: unknown; // Zod-validated response
}

export interface AgentRunOptions<T> {
  prompt: string;
  schema?: ZodType<T>; // If provided, response is validated and parsed
  conversationHistory?: AgentMessage[];
}
```

#### G.2.2 BaseAgent Class

````typescript
// lib/agent-framework/base-agent.ts

import Anthropic from "@anthropic-ai/sdk";
import { z, ZodType } from "zod";
import { CostTracker } from "../utils/cost-tracker.js";
import { AgentConfig, AgentResponse, AgentRunOptions } from "./types.js";
import { AgentResponseParseError, AgentAPIError } from "../utils/errors.js";

export class BaseAgent {
  protected client: Anthropic;
  protected config: AgentConfig;
  protected costTracker: CostTracker;

  constructor(config: AgentConfig, costTracker: CostTracker) {
    this.client = new Anthropic();
    this.config = {
      model: "claude-opus-4-5-20251101",
      maxTokens: 4096,
      temperature: 0.7,
      ...config,
    };
    this.costTracker = costTracker;
  }

  async run<T = string>(
    options: AgentRunOptions<T>,
  ): Promise<AgentResponse & { parsed: T }> {
    const messages = [
      ...(options.conversationHistory || []),
      { role: "user" as const, content: options.prompt },
    ];

    const response = await this.executeWithRetry(messages);

    this.costTracker.track(response.usage);
    this.costTracker.checkBudget();

    const content = response.content[0];
    if (content.type !== "text") {
      throw new AgentResponseParseError("Expected text response");
    }

    let parsed: T;
    if (options.schema) {
      parsed = this.parseAndValidate(content.text, options.schema);
    } else {
      parsed = content.text as unknown as T;
    }

    return {
      content: content.text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      parsed,
    };
  }

  protected async executeWithRetry(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    maxRetries = 3,
  ): Promise<Anthropic.Message> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.client.messages.create({
          model: this.config.model!,
          max_tokens: this.config.maxTokens!,
          system: this.config.systemPrompt,
          messages,
        });
      } catch (error) {
        lastError = error as Error;

        if (this.isRetryable(error)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await this.sleep(delay);
          continue;
        }

        throw new AgentAPIError(
          `Agent ${this.config.name} failed: ${lastError.message}`,
          lastError,
        );
      }
    }

    throw new AgentAPIError(
      `Agent ${this.config.name} failed after ${maxRetries} retries`,
      lastError,
    );
  }

  protected parseAndValidate<T>(text: string, schema: ZodType<T>): T {
    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch =
      text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      throw new AgentResponseParseError(
        `Agent ${this.config.name}: Could not extract JSON from response`,
      );
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return schema.parse(parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AgentResponseParseError(
          `Agent ${this.config.name}: Schema validation failed - ${error.errors.map((e) => e.message).join(", ")}`,
        );
      }
      throw new AgentResponseParseError(
        `Agent ${this.config.name}: JSON parse failed - ${(error as Error).message}`,
      );
    }
  }

  protected isRetryable(error: unknown): boolean {
    if (error instanceof Anthropic.RateLimitError) return true;
    if (error instanceof Anthropic.InternalServerError) return true;
    if (error instanceof Anthropic.APIConnectionError) return true;
    return false;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
````

#### G.2.3 ParallelExecutor

```typescript
// lib/agent-framework/parallel-executor.ts

import { BaseAgent } from "./base-agent.js";
import { AgentRunOptions, AgentResponse } from "./types.js";

export interface ParallelTask<T> {
  agent: BaseAgent;
  options: AgentRunOptions<T>;
  id: string;
}

export interface ParallelResult<T> {
  id: string;
  success: boolean;
  result?: AgentResponse & { parsed: T };
  error?: Error;
}

export class ParallelExecutor {
  /**
   * Execute multiple agent tasks in parallel with error isolation
   * If one task fails, others continue
   */
  static async run<T>(
    tasks: ParallelTask<T>[],
    options?: { maxConcurrency?: number },
  ): Promise<ParallelResult<T>[]> {
    const maxConcurrency = options?.maxConcurrency || tasks.length;
    const results: ParallelResult<T>[] = [];

    // Process in batches if concurrency is limited
    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      const batch = tasks.slice(i, i + maxConcurrency);

      const batchResults = await Promise.all(
        batch.map(async (task) => {
          try {
            const result = await task.agent.run(task.options);
            return {
              id: task.id,
              success: true,
              result,
            } as ParallelResult<T>;
          } catch (error) {
            return {
              id: task.id,
              success: false,
              error: error as Error,
            } as ParallelResult<T>;
          }
        }),
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute and require all to succeed
   * Throws if any task fails
   */
  static async runAll<T>(
    tasks: ParallelTask<T>[],
  ): Promise<Map<string, AgentResponse & { parsed: T }>> {
    const results = await this.run(tasks);

    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      const errorMessages = failures
        .map((f) => `${f.id}: ${f.error?.message}`)
        .join("; ");
      throw new Error(`Parallel execution failed: ${errorMessages}`);
    }

    const resultMap = new Map<string, AgentResponse & { parsed: T }>();
    for (const r of results) {
      if (r.result) {
        resultMap.set(r.id, r.result);
      }
    }

    return resultMap;
  }
}
```

#### G.2.4 Agent State Machine

```typescript
// lib/agent-framework/state-machine.ts

export type EvaluationPhase =
  | "PENDING"
  | "EVALUATING"
  | "DEBATING"
  | "SYNTHESIZING"
  | "REVIEWING"
  | "LOCKED"
  | "FAILED";

export interface EvaluationState {
  runId: string;
  ideaId: string;
  phase: EvaluationPhase;
  startedAt: Date;
  updatedAt: Date;

  // Progress tracking
  completedCriteria: string[];
  pendingCriteria: string[];

  // Debate state
  currentRound: number;
  debateHistory: DebateExchange[];

  // Checkpointing
  checkpoint: EvaluationCheckpoint | null;

  // Cost tracking
  costSoFar: number;
  budgetLimit: number;

  // Error state
  lastError?: string;
  retryCount: number;
}

export interface EvaluationCheckpoint {
  phase: EvaluationPhase;
  completedCriteria: string[];
  partialScores: Map<string, number>;
  debateRound: number;
  savedAt: Date;
}

export interface DebateExchange {
  criterion: string;
  round: number;
  evaluatorClaim: string;
  redTeamChallenge: string;
  evaluatorDefense: string;
  arbiterVerdict: "EVALUATOR" | "RED_TEAM" | "DRAW";
  scoreAdjustment: number;
}

// Valid state transitions
const VALID_TRANSITIONS: Record<EvaluationPhase, EvaluationPhase[]> = {
  PENDING: ["EVALUATING", "FAILED"],
  EVALUATING: ["DEBATING", "FAILED"],
  DEBATING: ["SYNTHESIZING", "EVALUATING", "FAILED"], // Can loop back for re-evaluation
  SYNTHESIZING: ["REVIEWING", "FAILED"],
  REVIEWING: ["LOCKED", "DEBATING", "FAILED"], // Can loop back if user disputes
  LOCKED: [], // Terminal state
  FAILED: ["PENDING"], // Can retry from beginning
};

export class EvaluationStateMachine {
  private state: EvaluationState;

  constructor(runId: string, ideaId: string, budgetLimit: number) {
    this.state = {
      runId,
      ideaId,
      phase: "PENDING",
      startedAt: new Date(),
      updatedAt: new Date(),
      completedCriteria: [],
      pendingCriteria: [],
      currentRound: 0,
      debateHistory: [],
      checkpoint: null,
      costSoFar: 0,
      budgetLimit,
      retryCount: 0,
    };
  }

  transition(newPhase: EvaluationPhase): void {
    const validNextPhases = VALID_TRANSITIONS[this.state.phase];

    if (!validNextPhases.includes(newPhase)) {
      throw new Error(
        `Invalid state transition: ${this.state.phase} → ${newPhase}. ` +
          `Valid transitions: ${validNextPhases.join(", ")}`,
      );
    }

    this.state.phase = newPhase;
    this.state.updatedAt = new Date();
  }

  checkpoint(): void {
    this.state.checkpoint = {
      phase: this.state.phase,
      completedCriteria: [...this.state.completedCriteria],
      partialScores: new Map(), // Would be populated with actual scores
      debateRound: this.state.currentRound,
      savedAt: new Date(),
    };
  }

  restore(checkpoint: EvaluationCheckpoint): void {
    this.state.phase = checkpoint.phase;
    this.state.completedCriteria = checkpoint.completedCriteria;
    this.state.currentRound = checkpoint.debateRound;
    this.state.updatedAt = new Date();
  }

  getState(): Readonly<EvaluationState> {
    return { ...this.state };
  }

  isTerminal(): boolean {
    return this.state.phase === "LOCKED" || this.state.phase === "FAILED";
  }

  canRetry(): boolean {
    return this.state.phase === "FAILED" && this.state.retryCount < 3;
  }
}
```

### G.3 File Structure

```
lib/
└── agent-framework/
    ├── index.ts                 # Public exports
    ├── types.ts                 # Interfaces and types
    ├── base-agent.ts            # BaseAgent class with retry logic
    ├── parallel-executor.ts     # ParallelExecutor for concurrent agents
    ├── state-machine.ts         # EvaluationStateMachine
    └── agents/                  # Specialized agent implementations
        ├── evaluator-agent.ts
        ├── redteam-agent.ts
        ├── arbiter-agent.ts
        ├── synthesis-agent.ts
        ├── orchestrator-agent.ts
        ├── classifier-agent.ts
        └── development-agent.ts
```

### G.4 Migration from Fictional SDK

All code in ARCHITECTURE.md that references:

```typescript
import { Agent } from "@anthropic-ai/agent-sdk";
```

Should be read as:

```typescript
import { BaseAgent } from "../lib/agent-framework/base-agent.js";
```

And all references to:

```typescript
await ParallelExecutor.run([...])
```

Use the implementation from:

```typescript
import { ParallelExecutor } from "../lib/agent-framework/parallel-executor.js";
```

---

## Appendix H: Content Hash Staleness Detection

### H.1 Purpose

Detect when an idea's content has changed since its last evaluation, making that evaluation potentially stale.

### H.2 What Gets Hashed

| File             | Included | Rationale                                 |
| ---------------- | -------- | ----------------------------------------- |
| `README.md`      | ✓        | Core idea definition                      |
| `development.md` | ✓        | Clarifying information affects evaluation |
| `research/*.md`  | ✓        | Research findings affect scores           |
| `evaluation.md`  | ✗        | Output of evaluation, not input           |
| `redteam.md`     | ✗        | Output of red-teaming, not input          |
| `notes/*.md`     | ✗        | Freeform, not structured                  |
| `assets/*`       | ✗        | Binary files, not relevant to scoring     |

### H.3 Hash Calculation

```typescript
// utils/content-hash.ts

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

export interface ContentHashResult {
  hash: string;
  files: string[];
  calculatedAt: Date;
}

export async function calculateIdeaContentHash(
  ideaPath: string,
): Promise<ContentHashResult> {
  const filesToHash = [
    path.join(ideaPath, "README.md"),
    path.join(ideaPath, "development.md"),
    ...(await glob(path.join(ideaPath, "research", "*.md"))),
  ];

  const existingFiles = filesToHash.filter((f) => fs.existsSync(f));

  // Sort for deterministic ordering
  existingFiles.sort();

  const hasher = crypto.createHash("sha256");

  for (const file of existingFiles) {
    const content = fs.readFileSync(file, "utf-8");
    // Include filename in hash so renames are detected
    hasher.update(`${path.basename(file)}:${content}`);
  }

  return {
    hash: hasher.digest("hex"),
    files: existingFiles,
    calculatedAt: new Date(),
  };
}

export function isEvaluationStale(
  currentHash: string,
  evaluationHash: string,
): boolean {
  return currentHash !== evaluationHash;
}
```

### H.4 Database Schema Addition

```sql
-- 003_add_content_hash.sql

-- Add content hash tracking to ideas table
ALTER TABLE ideas ADD COLUMN content_hash TEXT;
ALTER TABLE ideas ADD COLUMN content_hash_updated_at DATETIME;

-- Add the hash that was current when evaluation was performed
ALTER TABLE final_syntheses ADD COLUMN content_hash_at_evaluation TEXT NOT NULL DEFAULT '';

-- Add staleness flag (computed on sync, not stored)
-- Query: SELECT * FROM ideas i
--        JOIN final_syntheses fs ON i.id = fs.idea_id
--        WHERE i.content_hash != fs.content_hash_at_evaluation
--        AND fs.status = 'CURRENT';

-- Index for staleness queries
CREATE INDEX idx_ideas_content_hash ON ideas(content_hash);
CREATE INDEX idx_syntheses_content_hash ON final_syntheses(content_hash_at_evaluation);
```

### H.5 Sync Integration

```typescript
// In scripts/sync.ts

async function syncIdea(ideaPath: string): Promise<SyncResult> {
  // ... existing sync logic ...

  // Calculate and store content hash
  const hashResult = await calculateIdeaContentHash(ideaPath);

  db.prepare(
    `
    UPDATE ideas
    SET content_hash = ?, content_hash_updated_at = ?
    WHERE folder_path = ?
  `,
  ).run(hashResult.hash, hashResult.calculatedAt.toISOString(), ideaPath);

  // Check for stale evaluations
  const currentEval = db
    .prepare(
      `
    SELECT fs.content_hash_at_evaluation, fs.overall_score, fs.completed_at
    FROM final_syntheses fs
    JOIN ideas i ON fs.idea_id = i.id
    WHERE i.folder_path = ? AND fs.status = 'CURRENT'
  `,
    )
    .get(ideaPath) as any;

  if (
    currentEval &&
    isEvaluationStale(hashResult.hash, currentEval.content_hash_at_evaluation)
  ) {
    return {
      status: "STALE_EVALUATION",
      message: `Evaluation from ${currentEval.completed_at} is stale (score was ${currentEval.overall_score})`,
      ideaPath,
    };
  }

  return { status: "SYNCED", ideaPath };
}
```

### H.6 CLI Output

```bash
$ npm run sync

Syncing ideas...
  ✓ solar-charger (hash: a1b2c3...)
  ✓ plant-tracker (hash: d4e5f6...)
  ⚠ meal-planner (STALE: modified since Dec 15 evaluation)
    - README.md changed
    - development.md changed
    Previous score: 7.2 | Run `npm run evaluate meal-planner` to update

Sync complete: 3 ideas, 1 stale evaluation
```

---

## Appendix I: Test-Driven Development Contract Tests

> **PRINCIPLE**: Every agent and core component must have its behavioral contract defined as tests BEFORE implementation. Tests are written to fail first, then implementation makes them pass.

### I.1 Contract Test Philosophy

Contract tests define **what a component must do**, not **how it does it**. They are:

- Written before implementation
- Based on the interfaces defined in this architecture
- Focused on inputs, outputs, and error conditions
- Independent of implementation details

### I.2 Agent Contract Test Structure

Each agent has a contract test file that defines its behavioral requirements:

```typescript
// tests/contracts/evaluator.contract.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { EvaluatorAgent } from "../../lib/agent-framework/agents/evaluator-agent.js";
import { ALL_CRITERIA } from "../../agents/config.js";
import { EvaluationResponseSchema } from "../../utils/schemas.js";

describe("Evaluator Agent Contract", () => {
  // These tests define WHAT the evaluator must do
  // They are written BEFORE the evaluator is implemented

  describe("Response Structure", () => {
    it("must return exactly 30 criterion evaluations", async () => {
      // ARRANGE: Set up with mock or real API
      // ACT: Run evaluation
      // ASSERT: Response has 30 evaluations
    });

    it("must include all criteria from taxonomy", async () => {
      // ASSERT: Every criterion in ALL_CRITERIA is present in response
    });

    it("must return scores in range 1-10 for each criterion", async () => {
      // ASSERT: All scores are integers 1-10
    });

    it("must return confidence in range 0-1 for each criterion", async () => {
      // ASSERT: All confidence values are 0 ≤ c ≤ 1
    });

    it("must provide non-empty reasoning for each score", async () => {
      // ASSERT: All reasoning strings have length > 0
    });

    it("must pass Zod schema validation", async () => {
      // ASSERT: EvaluationResponseSchema.parse(response) succeeds
    });
  });

  describe("Error Handling", () => {
    it("must throw EvaluationParseError for malformed idea content", async () => {
      // ASSERT: Throws specific error type
    });

    it("must throw BudgetExceededError when budget is exhausted", async () => {
      // ASSERT: Throws before making API call if budget is 0
    });

    it("must retry on rate limit errors", async () => {
      // ASSERT: Retries up to 3 times with exponential backoff
    });
  });

  describe("Cost Tracking", () => {
    it("must report token usage for each API call", async () => {
      // ASSERT: CostTracker.track() called with usage
    });

    it("must check budget before each API call", async () => {
      // ASSERT: CostTracker.checkBudget() called
    });
  });
});
```

### I.3 Required Contract Test Files

| File                             | Component         | Key Contracts                                           |
| -------------------------------- | ----------------- | ------------------------------------------------------- |
| `evaluator.contract.test.ts`     | Evaluator Agent   | 30 evaluations, valid scores, taxonomy coverage         |
| `redteam.contract.test.ts`       | Red Team Agent    | Valid challenges, persona consistency, severity ratings |
| `arbiter.contract.test.ts`       | Arbiter Agent     | Valid verdicts, score adjustments in range, reasoning   |
| `synthesis.contract.test.ts`     | Synthesis Agent   | Complete document, all required fields, recommendations |
| `convergence.contract.test.ts`   | Convergence Logic | Correct termination, all criteria checked               |
| `state-machine.contract.test.ts` | State Machine     | Valid transitions, checkpoint/restore                   |
| `cost-tracker.contract.test.ts`  | Cost Tracker      | Accurate calculation, budget enforcement                |
| `content-hash.contract.test.ts`  | Content Hash      | Deterministic, includes correct files                   |

### I.4 Boundary Test Specifications

```typescript
// tests/boundaries/score-validation.test.ts

describe("Score Boundaries", () => {
  describe("Criterion Scores", () => {
    it("rejects score < 1", () => {});
    it("rejects score > 10", () => {});
    it("rejects non-integer scores", () => {});
    it("accepts score = 1 (minimum)", () => {});
    it("accepts score = 10 (maximum)", () => {});
    it("accepts score = 5 (midpoint)", () => {});
  });

  describe("Confidence Values", () => {
    it("rejects confidence < 0", () => {});
    it("rejects confidence > 1", () => {});
    it("accepts confidence = 0 (minimum)", () => {});
    it("accepts confidence = 1 (maximum)", () => {});
    it("accepts confidence = 0.5 (midpoint)", () => {});
  });

  describe("Budget Limits", () => {
    it("enforces $0 budget (no API calls allowed)", () => {});
    it("enforces exact budget boundary", () => {});
    it("allows operations under budget", () => {});
  });

  describe("Round Limits", () => {
    it("enforces max rounds = 5", () => {});
    it("allows rounds 1-5", () => {});
    it("triggers forced synthesis at max rounds", () => {});
  });
});
```

### I.5 State Machine Test Specifications

```typescript
// tests/state-machine/evaluation-states.test.ts

describe("Evaluation State Machine", () => {
  describe("Valid Transitions", () => {
    it("PENDING → EVALUATING", () => {});
    it("EVALUATING → DEBATING", () => {});
    it("DEBATING → SYNTHESIZING", () => {});
    it("SYNTHESIZING → REVIEWING", () => {});
    it("REVIEWING → LOCKED", () => {});
    it("DEBATING → EVALUATING (re-evaluation loop)", () => {});
    it("REVIEWING → DEBATING (user dispute)", () => {});
    it("* → FAILED (any state can fail)", () => {});
    it("FAILED → PENDING (retry)", () => {});
  });

  describe("Invalid Transitions", () => {
    it("rejects PENDING → LOCKED", () => {});
    it("rejects LOCKED → * (terminal state)", () => {});
    it("rejects EVALUATING → REVIEWING (skip debate)", () => {});
  });

  describe("Checkpoint/Restore", () => {
    it("creates checkpoint with current state", () => {});
    it("restores from checkpoint accurately", () => {});
    it("preserves completed criteria on restore", () => {});
    it("preserves cost tracking on restore", () => {});
  });
});
```

### I.6 End-to-End Test Specification

```typescript
// tests/e2e/full-lifecycle.test.ts

describe("Full Idea Lifecycle", () => {
  it("captures idea and creates folder structure", async () => {
    // 1. Capture idea via CLI
    // 2. Verify folder created: ideas/[slug]/
    // 3. Verify README.md has correct frontmatter
    // 4. Verify database entry created
  });

  it("evaluates idea and produces scores", async () => {
    // 1. Run evaluation on captured idea
    // 2. Verify 30 criteria scored
    // 3. Verify evaluation.md created
    // 4. Verify database records
  });

  it("debates evaluation and adjusts scores", async () => {
    // 1. Run debate on evaluated idea
    // 2. Verify challenges generated
    // 3. Verify defenses recorded
    // 4. Verify score adjustments applied
  });

  it("synthesizes debate into final document", async () => {
    // 1. Run synthesis
    // 2. Verify convergence detected
    // 3. Verify FinalSynthesisDocument structure
    // 4. Verify locked state
  });

  it("detects stale evaluation after content change", async () => {
    // 1. Modify idea README.md
    // 2. Run sync
    // 3. Verify staleness warning
    // 4. Verify hash mismatch detected
  });

  it("respects budget limit across full lifecycle", async () => {
    // 1. Set low budget ($1)
    // 2. Run evaluation
    // 3. Verify BudgetExceededError thrown
    // 4. Verify partial results saved (checkpoint)
  });
});
```

---

## Appendix J: Corrections to Earlier Sections

This appendix documents specific corrections to earlier architecture sections based on the gap analysis.

### J.1 Section 11-12: Agent SDK References

**All references to `@anthropic-ai/agent-sdk` should be read as using the custom agent framework defined in Appendix G.**

Specifically:

- `import { Agent } from '@anthropic-ai/agent-sdk'` → `import { BaseAgent } from '../lib/agent-framework/base-agent.js'`
- `new Agent({...})` → Extend `BaseAgent` for specific agent types
- `ParallelExecutor.run([...])` → Use implementation from Appendix G.2.3

### J.2 Section 12.3: Red Team Persona Alignment

**v1 Scope (3 personas):**
| Persona | Code Name | Role |
|---------|-----------|------|
| Skeptic | `skeptic` | Questions assumptions, demands evidence |
| Realist | `realist` | Identifies practical obstacles |
| First Principles Purist | `first-principles` | Attacks logical foundations |

**v2 Scope (additional 3 personas):**
| Persona | Code Name | Role |
|---------|-----------|------|
| Competitor | `competitor` | Competitive threat analysis |
| Contrarian | `contrarian` | Inverts core assumptions |
| Edge-Case Finder | `edge-case` | Finds failure modes |

### J.3 Section 3 vs Taxonomy: Criteria Naming

**The canonical criteria names are defined in `taxonomy/evaluation-criteria.md`.**

Any discrepancy between Section 3 criteria names and the taxonomy should be resolved in favor of the taxonomy. The Section 3 criteria matrix is illustrative; the taxonomy is authoritative.

### J.4 Debate Configuration Clarification

**Correct interpretation:**

- 5 challenges **per idea** (not per criterion)
- Each of the 3 personas generates challenges targeting different criteria
- Total: ~5 challenges × 3 rounds = 15 debate exchanges per evaluation
- NOT: 5 × 30 × 3 = 450 exchanges (this would be prohibitively expensive)

---

**Document Status**: Updated with agent orchestration framework (Appendix G), content hash mechanism (Appendix H), TDD contract specifications (Appendix I), and corrections (Appendix J).

**Cross-Reference**: See IMPLEMENTATION-PLAN.md Appendices G-K for:

- G: Gap remediation specifications (retry, checkpoint, rate limiting, concurrency, observability)
- H: Schema reconciliation (authoritative Zod schemas)
- I: Phase reconciliation (authoritative phase structure)
- J: Contradictions removed
- K: Missing test files specification

Ready for TDD implementation.
