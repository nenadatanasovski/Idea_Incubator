# Loop 1: Critical Path - Overview

**Purpose:** Complete the core value chain: Ideation → Specification → Build
**Priority:** CRITICAL
**Estimated Duration:** 6-8 weeks
**Review Frequency:** Daily

---

## Stream Overview

This loop implements the primary user journey from validated idea to working application.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Phase 1: UFS   │────▶│ Phase 2: Spec   │────▶│ Phase 3: Build  │
│  (Complete)     │     │  Agent          │     │  Agent          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     2-3 weeks              2-3 weeks              4-6 weeks
```

---

## Phase 1: Unified File System (UFS) Completion

**Status:** In Progress (~70% complete)
**Remaining:** SC-*, PH-*, UI-* test categories

### What's Done
- FS-001 to FS-015: Folder structure utilities ✓
- AS-001 to AS-008: Artifact store basics ✓
- Database migrations for user_slug, idea_slug ✓

### What's Remaining
- SC-001 to SC-015: Session-Context Management
- PH-001 to PH-015: Phase Transitions & Handoffs
- UI-001 to UI-015: UI Components for artifact panel

### Key Deliverables
1. Session context builder that loads idea folder context
2. Phase transition logic (ideation → spec → build)
3. Artifact panel UI components

---

## Phase 2: Specification Agent

**Status:** Not Started
**Depends On:** UFS Phase 1 complete (specifically SC-* tests)

### What It Does
Extracts detailed requirements through conversation, preparing everything the Build Agent needs.

### Gap Analysis

#### Database (Gaps)
| Table | Status | Notes |
|-------|--------|-------|
| `ideation_sessions` | EXISTS | Add `phase` column if not present |
| `spec_requirements` | MISSING | Feature requirements extracted |
| `spec_features` | MISSING | Prioritized feature list |
| `spec_acceptance_criteria` | MISSING | Test criteria per feature |

#### API Endpoints (Gaps)
| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /api/ideation/message | EXISTS | Needs spec mode |
| GET /api/specification/session/:id | MISSING | Get spec session |
| POST /api/specification/complete | MISSING | Finalize spec |
| GET /api/specification/features | MISSING | List extracted features |

#### Backend Logic (Gaps)
| Component | Status | Notes |
|-----------|--------|-------|
| `agents/ideation/orchestrator.ts` | EXISTS | Needs spec mode prompts |
| `agents/specification/` | MISSING | Dedicated spec agent |
| `agents/specification/feature-extractor.ts` | MISSING | Extract features |
| `agents/specification/requirement-builder.ts` | MISSING | Build requirements |

#### Frontend (Gaps)
| Component | Status | Notes |
|-----------|--------|-------|
| `IdeationPage.tsx` | EXISTS | Needs phase indicator |
| `SpecificationPanel.tsx` | MISSING | Show extracted requirements |
| `FeatureList.tsx` | MISSING | Feature cards with priority |
| `AcceptanceCriteria.tsx` | MISSING | Test criteria display |

### Key Deliverables
1. Spec mode for ideation agent (or separate spec agent)
2. Feature extraction and prioritization
3. Acceptance criteria generation
4. Handoff document for build agent

---

## Phase 3: Build Agent

**Status:** Not Started
**Depends On:** Specification Agent complete

### What It Does
Generates application code via Ralph loop with human-in-the-loop validation.

### Gap Analysis

#### Database (Gaps)
| Table | Status | Notes |
|-------|--------|-------|
| `build_sessions` | MISSING | Track build sessions |
| `build_iterations` | MISSING | Each Ralph loop iteration |
| `build_artifacts` | MISSING | Generated code files |
| `build_errors` | MISSING | Error log for SIA |
| `build_checkpoints` | MISSING | Resumable state |

#### API Endpoints (Gaps)
| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /api/build/start | MISSING | Start build session |
| POST /api/build/iterate | MISSING | Run one iteration |
| GET /api/build/session/:id | MISSING | Get build status |
| POST /api/build/checkpoint | MISSING | Save checkpoint |
| POST /api/build/rollback | MISSING | Rollback to checkpoint |
| GET /api/build/errors | MISSING | Get error log |

#### Backend Logic (Gaps)
| Component | Status | Notes |
|-----------|--------|-------|
| `agents/build/` | MISSING | Build agent directory |
| `agents/build/orchestrator.ts` | MISSING | Build loop orchestrator |
| `agents/build/code-generator.ts` | MISSING | Generate code |
| `agents/build/validator.ts` | MISSING | Validate generated code |
| `agents/build/error-handler.ts` | MISSING | Handle and log errors |
| `utils/git-manager.ts` | MISSING | Git operations per user |

#### Frontend (Gaps)
| Component | Status | Notes |
|-----------|--------|-------|
| `BuildPage.tsx` | MISSING | Build progress view |
| `BuildProgress.tsx` | MISSING | Progress indicator |
| `IterationHistory.tsx` | MISSING | Show iterations |
| `ErrorDisplay.tsx` | MISSING | Error visualization |
| `BuildControls.tsx` | MISSING | Pause/resume/rollback |

### Key Deliverables
1. Ralph loop infrastructure for code generation
2. Git repo per user/idea
3. Checkpoint/resume capability
4. Error logging for SIA
5. Human-in-the-loop escalation

---

## Test Structure

### Test ID Prefixes
- `CP-UFS-*`: UFS completion tests (remaining)
- `CP-SPEC-*`: Specification agent tests
- `CP-BUILD-*`: Build agent tests

### Dependencies
```
CP-UFS-001 (SC tests) ──┐
                        ├──▶ CP-SPEC-001
CP-UFS-015 (PH tests) ──┘
                              │
                              ▼
                        CP-SPEC-015
                              │
                              ▼
                        CP-BUILD-001
                              │
                              ▼
                        CP-BUILD-030
```

---

## Success Criteria

### Phase 1 (UFS) Complete When:
- [ ] All SC-* tests passing
- [ ] All PH-* tests passing
- [ ] All UI-* tests passing
- [ ] Session can load idea folder context
- [ ] Phase transitions work correctly

### Phase 2 (Spec) Complete When:
- [ ] User can enter "spec mode" from ideation
- [ ] Features are extracted with priorities
- [ ] Acceptance criteria generated per feature
- [ ] Handoff document created for build agent
- [ ] 5+ ideas have been specified end-to-end

### Phase 3 (Build) Complete When:
- [ ] Ralph loop runs to completion for simple app
- [ ] Git repo created per user/idea
- [ ] Checkpoint/resume works
- [ ] Errors logged correctly
- [ ] Human escalation triggers work
- [ ] 3+ apps built end-to-end

---

## Files in This Spec Directory

```
specs/
├── 00-overview.md          # This file
├── 01-ufs-completion.md    # Remaining UFS work
├── 02-specification-agent.md # Spec agent design
├── 03-build-agent.md       # Build agent design
└── test-state.json         # Test tracking
```

---

*Created: 2026-01-07*
*Last Updated: 2026-01-07*
