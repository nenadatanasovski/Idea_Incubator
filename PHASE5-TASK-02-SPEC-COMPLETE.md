# PHASE5-TASK-02 Specification Complete

**Task:** Evidence collection for Market/Competition criteria
**Specification File:** `docs/specs/PHASE5-TASK-02-evidence-collection.md`
**Created:** February 8, 2026
**Status:** ✅ SPECIFICATION COMPLETE

---

## Summary

Comprehensive technical specification created for PHASE5-TASK-02: Evidence Collection for Market/Competition Criteria. The specification addresses the critical gap in evidence persistence identified in the validation report (PHASE5-TASK-02-VALIDATION-REPORT.md).

### Specification Highlights

**Size:** 1,054 lines
**Sections:** 13 major sections with complete technical details

**Core Components:**

1. ✅ **Overview** - Current state (70% implemented), missing components (30%), and business value
2. ✅ **Requirements** - 4 functional requirements (FR-1 through FR-4) with detailed sub-requirements
3. ✅ **Technical Design** - Complete implementation details for:
   - Database schema changes (2 migrations)
   - Persistence logic modifications
   - API endpoints (evidence + research)
   - Frontend components (EvidenceTab + ResearchModal)
4. ✅ **Pass Criteria** - 7 testable criteria (PC-1 through PC-7) with validation commands
5. ✅ **Dependencies** - Internal and external dependencies documented
6. ✅ **Testing Strategy** - Unit, integration, and E2E test specifications with code examples
7. ✅ **Implementation Notes** - Performance, migration safety, future enhancements
8. ✅ **Files to Create/Modify** - Complete checklist (9 new files, 3 modifications)
9. ✅ **Risks and Mitigations** - 5 identified risks with likelihood/impact/mitigation
10. ✅ **Success Metrics** - 5 measurable success criteria
11. ✅ **References** - Links to validation report, source files, strategic plan

---

## Key Features Specified

### Database Schema

- **evaluations table**: Add `evidence_cited` and `gaps_identified` JSON columns
- **research_sessions table**: New table storing complete pre-evaluation research with:
  - Market size verification and sources
  - Competitor discovery and sources
  - Market trends and sources
  - Technology feasibility and sources
  - Geographic analysis (local + global markets)
  - Search metadata

### API Endpoints

- `GET /api/ideas/:slug/evaluations/:sessionId/evidence` - Returns all evidence cited and gaps identified
- `GET /api/ideas/:slug/research/:sessionId` - Returns complete research session with all external data

### Frontend Components

- **EvidenceTab**: New tab in EvaluationDashboard showing evidence by category
- **ResearchModal**: Modal dialog displaying all research sources with clickable links

### Persistence Logic

- Modified `scripts/evaluate.ts` to save evidence fields when persisting evaluations
- New `saveResearchSession()` function to persist pre-evaluation research

---

## Pass Criteria Summary

| ID   | Criterion              | Status     | Validation Method                   |
| ---- | ---------------------- | ---------- | ----------------------------------- |
| PC-1 | TypeScript Compilation | ✅ Ready   | `npx tsc --noEmit`                  |
| PC-2 | Database Schema        | Spec Ready | Migration files + schema validation |
| PC-3 | Evidence Persistence   | Spec Ready | Run evaluation + query database     |
| PC-4 | Evidence Retrieval API | Spec Ready | API endpoint tests with curl        |
| PC-5 | Frontend Display       | Spec Ready | Manual testing in browser           |
| PC-6 | Test Coverage          | Spec Ready | `npm test` (95%+ passing)           |
| PC-7 | Data Integrity         | Spec Ready | Migration + data validation queries |

---

## Implementation Roadmap

### Phase 1: Database Foundation (Est. 1 hour)

1. Create migration `XXX_evaluation_evidence.sql` (evidence columns)
2. Create migration `XXX_research_sessions.sql` (research table)
3. Apply migrations and verify schema
4. Test backwards compatibility

### Phase 2: Persistence Logic (Est. 2 hours)

1. Modify `scripts/evaluate.ts` evaluation save logic
2. Add `saveResearchSession()` function
3. Integrate research save into evaluation flow
4. Test evidence persistence with real evaluation

### Phase 3: API Endpoints (Est. 2 hours)

1. Create `server/routes/evidence.ts`
2. Create `server/routes/research.ts`
3. Register routes in `server/api.ts`
4. Test endpoints with curl/Postman

### Phase 4: Frontend Components (Est. 3 hours)

1. Create `EvidenceTab.tsx` component
2. Create `ResearchModal.tsx` component
3. Integrate into `EvaluationDashboard.tsx`
4. Style with Tailwind CSS
5. Test in browser

### Phase 5: Testing (Est. 1 hour)

1. Write unit tests (`tests/evidence/persistence.test.ts`)
2. Write API tests (`tests/api/evidence.test.ts`)
3. Write E2E tests (`tests/e2e/evidence-flow.test.ts`)
4. Run full test suite

**Total Estimated Effort:** 9 hours

---

## Technical Decisions

### JSON vs. Separate Tables

**Decision:** Store evidence arrays as JSON TEXT in SQLite
**Rationale:**

- Evidence arrays typically <10 items (small payload)
- SQLite handles JSON efficiently for small arrays
- Simpler schema (no junction tables)
- Easy to parse in API responses
- Future: Can migrate to JSONB if needed

### Research Table Structure

**Decision:** Flat structure with JSON columns vs. fully normalized
**Rationale:**

- Research data naturally hierarchical (geographic analysis)
- Flat structure with JSON balances queryability and simplicity
- Can query by `evaluation_session_id` or `idea_id` (indexed)
- Full research payload <5KB, acceptable for single-row queries

### API Endpoint Design

**Decision:** Two endpoints (evidence + research) vs. single combined endpoint
**Rationale:**

- Evidence needed frequently (lightweight, fast)
- Research needed occasionally (heavier payload)
- Separation allows targeted caching strategies
- Future: Can add combined endpoint if needed

---

## References to Existing Code

The specification was created by analyzing:

1. **Validation Report** (`PHASE5-TASK-02-VALIDATION-REPORT.md`)
   - Identified 70% complete (collection works, persistence missing)
   - Documented all gaps and missing features

2. **Research Agent** (`agents/research.ts`)
   - `ResearchResult` interface (lines 52-84)
   - `conductPreEvaluationResearch()` function (lines 95-123)
   - `formatResearchForCategory()` function (lines 483-587)

3. **Evaluator** (`agents/evaluator.ts`)
   - `EvaluationResult` interface with `evidenceCited` and `gapsIdentified`

4. **Evaluation Flow** (`scripts/evaluate.ts`)
   - Current save logic (lines 1217-1238)
   - Integration point for research persistence (line ~800)

5. **Database Schema** (`database/ideas.db`)
   - Current `evaluations` table structure
   - Migration system patterns

6. **Strategic Plan** (`STRATEGIC_PLAN.md`)
   - Phase 5 objectives and context

---

## Next Steps for Implementation Team

1. **Review Specification** - Technical lead reviews for completeness and feasibility
2. **Assign to Build Agent** - Create task in Parent Harness orchestrator
3. **Phase 1: Database** - Apply migrations first (safest, enables testing)
4. **Phase 2: Persistence** - Modify evaluation flow (core functionality)
5. **Phase 3: API** - Add endpoints (enables frontend development)
6. **Phase 4: Frontend** - Build components (user-facing feature)
7. **Phase 5: Testing** - Comprehensive test coverage
8. **Validation** - Run QA agent to verify all pass criteria met
9. **Documentation Update** - Update MEMORY.md and project docs

---

## Success Criteria for Spec Completion

✅ **Overview Section** - Explains current state, gaps, and business value
✅ **Requirements Section** - 4 functional requirements with detailed sub-requirements
✅ **Technical Design** - Complete implementation details with code examples
✅ **Pass Criteria** - 7 testable criteria with validation commands
✅ **Dependencies** - All dependencies documented
✅ **Testing Strategy** - Unit, integration, and E2E test specifications
✅ **Implementation Notes** - Performance, safety, future enhancements
✅ **Files List** - Complete checklist of files to create/modify
✅ **Risks** - Identified and mitigated
✅ **Success Metrics** - Measurable outcomes defined
✅ **References** - Links to source code and documentation

**All criteria met. Specification is complete and ready for implementation.**

---

**Specification File:** `docs/specs/PHASE5-TASK-02-evidence-collection.md`
**Status:** ✅ COMPLETE
**Ready for:** Build Agent implementation
**Estimated Implementation Time:** 9 hours
