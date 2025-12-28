# Idea Incubator - Claude Code Instructions

## Project Overview

This is an idea incubation system that uses AI agents to evaluate and red-team ideas. It captures ideas via markdown files, evaluates them through parallel Claude agents, and provides comprehensive visualization and analysis.

## Skills Available

- `/idea-capture` - Create a new idea folder with template
- `/idea-develop` - Flesh out an idea with questions
- `/idea-evaluate` - Score against 30 criteria
- `/idea-redteam` - Challenge assumptions
- `/idea-organize` - Help with file organization

## Behavior Guidelines

1. **Always confirm idea context** - If discussing an idea, confirm which one before making changes
2. **Reference taxonomy** - Use lifecycle stages and criteria from `taxonomy/` folder
3. **Proactive questioning** - After capturing an idea, ask 3 clarifying questions
4. **Update database** - Remind user to run `npm run sync` after file changes
5. **Cost awareness** - Warn user before running expensive evaluations

## File Locations

| Content Type | Location |
|--------------|----------|
| Ideas | `ideas/[slug]/README.md` |
| Evaluations | `ideas/[slug]/evaluation.md` |
| Development notes | `ideas/[slug]/development.md` |
| Red team challenges | `ideas/[slug]/redteam.md` |
| Research | `ideas/[slug]/research/*.md` |
| User profiles | `profiles/[slug].md` (exported) |
| Database | `database/ideas.db` |
| Templates | `templates/*.md` |
| Taxonomy | `taxonomy/*.md` |

## Common Commands

```bash
# Idea management
npm run cli capture         # Capture new idea
npm run cli list            # List all ideas
npm run cli show <slug>     # Show idea details

# User profiles (for Personal Fit evaluation)
npm run profile create      # Create a new user profile interactively
npm run profile list        # List all profiles
npm run profile show <slug> # Show profile details
npm run profile link <idea-slug> <profile-slug>  # Link profile to idea

# Database
npm run sync                # Sync markdown to database
npm run migrate             # Run database migrations

# Evaluation
npm run evaluate <slug>     # Run AI evaluation
npm run evaluate <slug> --budget=15  # With custom budget

# Testing
npm test                    # Run all tests
npm test:run                # Run tests once
```

## User Profiles (Personal Fit)

User profiles provide context for accurate Personal Fit (FT1-FT5) evaluation. Without a profile, Fit scores default to 5/10 with low confidence.

**Profile captures:**
- **Goals (FT1)**: income, impact, learning, portfolio, lifestyle, exit, passion, legacy
- **Passion (FT2)**: interests, motivations, domain connection
- **Skills (FT3)**: technical skills, experience, expertise, known gaps
- **Network (FT4)**: industry connections, professional network, communities
- **Life Stage (FT5)**: employment status, hours available, runway, risk tolerance

**Usage:**
1. Create profile once: `npm run profile create`
2. Link to each idea: `npm run profile link my-idea my-profile`
3. Run evaluation: `npm run evaluate my-idea` (profile auto-loaded)

## Lifecycle Stages

Ideas progress through these stages:
SPARK → CLARIFY → RESEARCH → IDEATE → EVALUATE → VALIDATE →
DESIGN → PROTOTYPE → TEST → REFINE → BUILD → LAUNCH →
GROW → MAINTAIN → PIVOT → PAUSE → SUNSET → ARCHIVE → ABANDONED

## Evaluation Criteria

30 criteria across 6 categories:
- **Problem** (5): Clarity, Severity, Target User, Validation, Uniqueness
- **Solution** (5): Clarity, Feasibility, Uniqueness, Scalability, Defensibility
- **Feasibility** (5): Technical, Resources, Skills, Time to Value, Dependencies
- **Fit** (5): Personal, Passion, Skills, Network, Life Stage
- **Market** (5): Size, Growth, Competition, Entry Barriers, Timing
- **Risk** (5): Execution, Market, Technical, Financial, Regulatory

## Budget Guidelines

Default evaluation budget: $10
- Initial evaluation: ~$2
- Red team challenges: ~$4
- Debate rounds: ~$3
- Synthesis: ~$1

## Agent Types

1. **Orchestrator** - Routes inputs, manages flow
2. **Classifier** - Auto-tags and detects relationships
3. **Evaluator** - Scores against 30 criteria
4. **Red Team** - Challenges assumptions (Skeptic, Realist, First Principles)
5. **Arbiter** - Judges debate rounds
6. **Synthesizer** - Creates final evaluation documents
7. **Development** - Asks clarifying questions
