# Vibe Platform Task List

> Compact reference for all platform tasks. Details in `tasks/{id}.md`.

---

## Legend
- **Status**: `[ ]` pending, `[~]` in progress, `[x]` done
- **Priority**: `P1` critical, `P2` high, `P3` medium, `P4` low

---

## 0. Communication Core (Phase 0 - Foundation)

> **CRITICAL**: Communication must be online before any agents start. This enables human-agent interaction from day one.

### Multi-Bot Architecture

Each agent type has its own Telegram bot for clear communication:
- @vibeai_monitor_bot (Monitoring Agent) ✅
- @vibeai_orchestrator_bot (Orchestrator) ✅
- @vibeai_spec_bot (Spec Agent) ✅
- @vibeai_build_bot (Build Agent) ✅
- @vibeai_validation_bot (Validation Agent) ✅
- @vibeai_sia_bot (SIA) ✅
- @vibeai_system_bot (System fallback) ✅

### Fallback Chain

```
Telegram → Email (your-email@example.com) → Halt Behavior
```

| ID | Task | Pri | Status |
|----|------|-----|--------|
| COM-001 | Multi-bot setup (BotFather, 7 bots) | P1 | [x] |
| COM-002 | Bot registry and token management | P1 | [x] |
| COM-003 | Chat ID linking (user verification) | P1 | [x] |
| COM-004 | Telegram message sender | P1 | [x] |
| COM-005 | Telegram multi-bot receiver (polling) | P1 | [x] |
| COM-006 | Question delivery with inline buttons | P1 | [x] |
| COM-007 | Answer processing and routing | P1 | [x] |
| COM-008 | Gmail SMTP email sender | P1 | [x] |
| COM-009 | Email question delivery (fallback) | P1 | [x] |
| COM-010 | Notification dispatcher (routing & fallback) | P1 | [x] |
| COM-011 | Question-gated execution (halt mechanism) | P1 | [x] |
| COM-012 | /summary command handler | P2 | [x] |
| COM-013 | Message templates (per question type) | P2 | [x] |
| COM-014 | Agent communication handshake | P1 | [x] |
| COM-015 | Communication Hub (single entry point) | P1 | [x] |
| COM-016 | Database migrations (communication tables) | P1 | [x] |

### Test Results (2026-01-10)

**Bot Verification Test** (`tests/e2e/test-com-bots.ts`):
- Monitor Bot: PASS (verified via getMe API) ✅
- Orchestrator Bot: PASS (verified via getMe API) ✅
- Spec Bot: PASS (verified via getMe API) ✅
- Build Bot: PASS (verified via getMe API) ✅
- Validation Bot: PASS (verified via getMe API) ✅
- SIA Bot: PASS (verified via getMe API) ✅
- System Bot: PASS (verified via getMe API) ✅

**All 7 bots created and configured with descriptions (2026-01-12)**

**Message Send Test**:
- Monitor Bot: PASS (Message ID: 6 sent to chat 8397599412)
- Orchestrator Bot: PENDING (need to /start chat)
- Spec Bot: PENDING (need to /start chat)
- Build Bot: PENDING (need to /start chat)
- Validation Bot: PENDING (need to /start chat)

**Chat ID Linked**: `TELEGRAM_TEST_CHAT_ID=8397599412` (Ned Atanasovski)

**Next Steps**: User to send /start to remaining 4 bots to enable full message testing.

---

## 1. Foundation

| ID | Task | Pri | Status |
|----|------|-----|--------|
| FND-001 | Database schema review and cleanup | P2 | [x] |
| FND-002 | Complete pending migrations (021-024) | P1 | [x] |
| FND-003 | API error handling standardization | P2 | [x] |
| FND-004 | TypeScript strict mode compliance | P3 | [ ] |
| FND-005 | Test infrastructure setup | P2 | [x] |

---

## 2. Unified File System

| ID | Task | Pri | Status |
|----|------|-----|--------|
| UFS-001 | Implement folder structure utility | P1 | [x] |
| UFS-002 | Migrate artifacts to file-based storage | P1 | [x] |
| UFS-003 | Update artifact store to use files | P1 | [x] |
| UFS-004 | Template system for idea folders | P2 | [x] |
| UFS-005 | File watcher for sync | P3 | [ ] |
| UFS-006 | Deprecate database artifact storage | P2 | [x] |

---

## 3. Ideation System

| ID | Task | Pri | Status |
|----|------|-----|--------|
| IDE-001 | Session persistence improvements | P2 | [x] |
| IDE-002 | Phase transition logic refinement | P2 | [x] |
| IDE-003 | Signal extraction enhancement | P2 | [x] |
| IDE-004 | Web search integration | P3 | [ ] |
| IDE-005 | Handoff document generation | P1 | [x] |
| IDE-006 | Confidence calculation tuning | P3 | [ ] |
| IDE-007 | Multi-idea session support | P4 | [ ] |

---

## 4. Evaluation System

| ID | Task | Pri | Status |
|----|------|-----|--------|
| EVL-001 | 30-criteria scoring implementation | P2 | [x] |
| EVL-002 | Red team agent integration | P2 | [x] |
| EVL-003 | Debate round orchestration | P3 | [x] |
| EVL-004 | Synthesis document generation | P2 | [x] |
| EVL-005 | User profile integration for Fit scores | P2 | [x] |
| EVL-006 | Evaluation caching | P4 | [ ] |

> **Note**: EVL-001 to EVL-005 implemented. agents/evaluator.ts, agents/redteam.ts, agents/debate.ts, agents/synthesis.ts, profile integration via ProfileContext.

---

## 5. Agent Bootstrap

| ID | Task | Pri | Status |
|----|------|-----|--------|
| AGT-001 | Create 3 reference briefs | P1 | [x] |
| AGT-002 | Hand-write 3 reference specs | P1 | [x] |
| AGT-003 | Define Spec Agent v0.1 scope | P1 | [x] |
| AGT-004 | Write Spec Agent acceptance tests | P1 | [x] |
| AGT-005 | Document escape hatch procedures | P1 | [x] |
| AGT-006 | Document triple-build verification | P2 | [x] |

---

## 6. Spec Agent

| ID | Task | Pri | Status |
|----|------|-----|--------|
| SPC-001 | Context loader implementation | P1 | [x] |
| SPC-002 | Template renderer | P1 | [x] |
| SPC-003 | Brief parser | P1 | [x] |
| SPC-004 | Claude integration | P1 | [x] |
| SPC-005 | Task generator | P1 | [x] |
| SPC-006 | Gotcha injector (hardcoded) | P2 | [x] |
| SPC-007 | Question generator | P2 | [x] |
| SPC-008 | Pass acceptance tests | P1 | [x] |

---

## 7. Build Agent

| ID | Task | Pri | Status |
|----|------|-----|--------|
| BLD-001 | Generate Build Agent spec (using Spec Agent) | P1 | [x] |
| BLD-002 | Context primer implementation | P1 | [x] |
| BLD-003 | Task executor | P1 | [x] |
| BLD-004 | Claude code generator | P1 | [x] |
| BLD-005 | File writer with locking | P1 | [x] |
| BLD-006 | Validation runner | P1 | [x] |
| BLD-007 | Checkpoint manager | P2 | [x] |
| BLD-008 | Retry logic | P2 | [x] |
| BLD-009 | Git integration | P2 | [x] |

---

## 8. Validation Agent

| ID | Task | Pri | Status |
|----|------|-----|--------|
| VAL-001 | Generate spec (using Spec Agent) | P1 | [x] |
| VAL-002 | Build using Build Agent | P1 | [x] |
| VAL-003 | Validation levels (QUICK to RELEASE) | P1 | [x] |
| VAL-004 | Test runner integration | P1 | [x] |
| VAL-005 | Coverage analyzer | P2 | [x] |
| VAL-006 | Security scanner | P2 | [x] |

> **Note**: VAL-001 to VAL-006 all completed. Implementation:
> - `agents/validation/orchestrator.ts` - Core validation orchestrator
> - `agents/validation/level-configs.ts` - 4 validation levels (QUICK, STANDARD, THOROUGH, RELEASE)
> - `agents/validation/validators/typescript-validator.ts` - TypeScript compilation validator
> - `agents/validation/validators/test-runner.ts` - Vitest test runner integration
> - `agents/validation/validators/security-scanner.ts` - Security scanning validator
> - `agents/validation/result-aggregator.ts` - Aggregates validator results
> - `agents/validation/db.ts` - Database operations for validation runs
> - `server/routes/validation.ts` - API routes mounted at /api/validation
> - `database/migrations/029_validation_agent.sql` - Schema for validation_runs and validator_results
> - `types/validation.ts` - TypeScript types and interfaces
> - `agents/validation/validators/coverage-analyzer.ts` - Coverage analysis validator (VAL-005)
> - `tests/validation-agent.test.ts` - 24 unit tests (all passing)

---

## 9. SIA (Self-Improvement Agent)

| ID | Task | Pri | Status |
|----|------|-----|--------|
| SIA-001 | Generate spec (using Spec Agent) | P1 | [x] |
| SIA-002 | Build using Build Agent | P1 | [x] |
| SIA-003 | Execution analyzer | P1 | [x] |
| SIA-004 | Gotcha extractor | P1 | [x] |
| SIA-005 | Pattern extractor | P2 | [x] |
| SIA-006 | Knowledge Base writer | P2 | [x] |
| SIA-007 | CLAUDE.md updater | P3 | [x] |

> **Note**: SIA complete! All 7 tasks done. Implementation:
> - `agents/sia/extraction-rules.ts` - 14 predefined extraction rules
> - `agents/sia/gotcha-extractor.ts` - Extract gotchas from failures (SIA-004)
> - `agents/sia/pattern-extractor.ts` - Extract patterns from successes (SIA-005)
> - `agents/sia/duplicate-detector.ts` - Prevent knowledge bloat
> - `agents/sia/execution-analyzer.ts` - Analyze Build Agent executions (SIA-003)
> - `agents/sia/claude-md-updater.ts` - Propose CLAUDE.md updates (SIA-007)
> - `agents/sia/confidence-tracker.ts` - Manage confidence scores
> - `agents/sia/knowledge-writer.ts` - Write to Knowledge Base (SIA-006)
> - `agents/sia/db.ts` - Database operations
> - `server/routes/sia.ts` - API routes at /api/sia
> - `database/migrations/031_sia.sql` - Schema for knowledge_entries, claude_md_proposals
> - `types/sia.ts` - TypeScript interfaces
> - `tests/sia.test.ts` - 38 unit tests (all passing)

---

## 10. UX Agent

| ID | Task | Pri | Status |
|----|------|-----|--------|
| UXA-001 | Generate spec (using Spec Agent) | P2 | [x] |
| UXA-002 | Build using Build Agent | P2 | [x] |
| UXA-003 | Puppeteer MCP integration | P2 | [x] |
| UXA-004 | Journey runner | P2 | [x] |
| UXA-005 | Accessibility checker | P2 | [x] |

> **Note**: UXA-001 to UXA-005 all completed. Implementation:
> - `agents/ux/orchestrator.ts` - Main entry point, coordinates all components
> - `agents/ux/mcp-bridge.ts` - Puppeteer MCP wrapper (UXA-003)
> - `agents/ux/journey-runner.ts` - Execute multi-step journeys (UXA-004)
> - `agents/ux/journey-definitions.ts` - Standard journey definitions
> - `agents/ux/accessibility-checker.ts` - axe-core integration (UXA-005)
> - `agents/ux/screenshot-manager.ts` - Screenshot capture and storage
> - `agents/ux/db.ts` - Database operations
> - `server/routes/ux.ts` - API routes at /api/ux
> - `database/migrations/032_ux_agent.sql` - Schema for ux_runs, ux_step_results, ux_accessibility_issues
> - `types/ux.ts` - TypeScript interfaces
> - `tests/ux-agent.test.ts` - 29 unit tests (all passing)

---

## 11. Orchestration & UI

| ID | Task | Pri | Status |
|----|------|-----|--------|
| ORC-001 | Message bus implementation | P1 | [x] |
| ORC-002 | Agent status tracking | P1 | [x] |
| ORC-003 | Question queue system | P1 | [x] |
| ORC-004 | Pipeline visualization component | P2 | [x] |
| ORC-005 | Activity timeline component | P2 | [x] |
| ORC-006 | Question panel component | P2 | [x] |
| ORC-007 | WebSocket real-time updates | P2 | [x] |
| ORC-008 | Celebration/milestone modals | P3 | [x] |

> **Note**: ORC-004 via KanbanBoard.tsx. ORC-005, ORC-006, ORC-008 via Web Dashboard (WEB-*) tasks.

---

## 12. Knowledge Base

| ID | Task | Pri | Status |
|----|------|-----|--------|
| KNW-001 | Gotcha storage schema | P2 | [x] |
| KNW-002 | Pattern storage schema | P2 | [x] |
| KNW-003 | Query interface for agents | P2 | [x] |
| KNW-004 | Confidence scoring | P3 | [x] |
| KNW-005 | CLAUDE.md promotion logic | P3 | [x] |

> **Note**: KNW-001 to KNW-005 all completed. Implementation leverages SIA infrastructure:
> - `database/migrations/031_sia.sql` - Schema for knowledge_entries, claude_md_proposals, gotcha_applications
> - `agents/knowledge-base/index.ts` - Central exports for all agents to use
> - `agents/knowledge-base/queries.ts` - High-level query functions (getRelevantGotchas, getRelevantPatterns, etc.)
> - `agents/sia/confidence-tracker.ts` - Confidence scoring with prevention boosts, decay, thresholds
> - `agents/sia/claude-md-updater.ts` - CLAUDE.md proposal generation and application
> - `agents/sia/knowledge-writer.ts` - Write gotchas, patterns, decisions
> - `agents/sia/duplicate-detector.ts` - Prevent duplicate entries
> - `server/routes/knowledge.ts` - API routes at /api/knowledge
> - `tests/knowledge-base.test.ts` - 31 unit tests (all passing)

---

## 13. Verification & Autonomy

| ID | Task | Pri | Status |
|----|------|-----|--------|
| VER-001 | Spec Agent self-specs | P2 | [x] |
| VER-002 | Triple-build verification | P2 | [x] |
| VER-003 | Monitoring dashboard | P2 | [x] |
| VER-004 | Alert thresholds | P2 | [x] |
| VER-005 | 7-day autonomous test | P3 | [ ] |

> **Note**: VER-003 implemented via AgentDashboard at /agents. VER-004 implemented in MonitoringAgent with configurable thresholds.

---

## 14. Monitoring Agent (System Soul)

> **CRITICAL**: Monitoring Agent is foundational. Build immediately after basic infrastructure.

| ID | Task | Pri | Status |
|----|------|-----|--------|
| MON-001 | Monitoring Agent core architecture | P1 | [x] |
| MON-002 | Event bus listener (primary data source) | P1 | [x] |
| MON-003 | Puppeteer MCP observer (UI validation) | P1 | [x] |
| MON-004 | State reconciler (compare sources, detect drift) | P1 | [x] |
| MON-005 | Detection engine (rules, thresholds, patterns) | P1 | [x] |
| MON-006 | Response escalator (graduated responses) | P1 | [x] |
| MON-007 | Action executor (observe-confirm-act pattern) | P1 | [x] |
| MON-008 | Heartbeat emitter (system health dependency) | P1 | [x] |
| MON-009 | Question integration (ALERT/ESCALATION/APPROVAL types) | P1 | [x] |
| MON-010 | Historical baseline learning | P2 | [x] |

> **Note**:
> - `server/monitoring/monitoring-agent.ts` - Core architecture with health checks, issue detection
> - `server/monitoring/hub-integration.ts` - Event bus listener, CommunicationHub integration
> - `server/monitoring/response-escalator.ts` - Graduated response system (LOG → NOTIFY → ALERT → ESCALATE → HALT)
> - `server/monitoring/puppeteer-observer.ts` - UI validation via MCP browser automation
> - `server/monitoring/state-reconciler.ts` - Compare data sources, detect state drift
> - `server/monitoring/action-executor.ts` - Observe-Confirm-Act pattern for corrective actions
> - `server/monitoring/baseline-learner.ts` - Learn normal patterns, detect anomalies

### Test Results (2026-01-10)

**Monitoring Module Structure Test** (`tests/e2e/test-mon-structure.ts`):
- MON-001.1: MonitoringAgent class exported ✅
- MON-001.2: start() method ✅
- MON-001.3: stop() method ✅
- MON-001.4: registerAgent() method ✅
- MON-001.5: updateAgentStatus() method ✅
- MON-001.6: getAgentState() method ✅
- MON-001.7: getSystemMetrics() method ✅
- MON-001.8: detectIssue() method ✅
- MON-002.1: integrateMonitoringWithHub function ✅
- MON-002.2: createIntegratedMonitoring function ✅
- MON-006.1: ResponseEscalator class exported ✅
- MON-006.2: ResponseLevel enum (LOG, NOTIFY, ALERT, ESCALATE, HALT) ✅
- MON-006.3: handleIssue() method ✅
- MON-006.4: resolveIssue() method ✅
- MON-006.5: stopAll() method ✅
- MON-003.1: PuppeteerObserver class exported ✅
- MON-003.2: setMCPTools() method ✅
- MON-003.3: start()/stop() methods ✅
- MON-003.4: runRule()/runAllRules() methods ✅
- MON-003.5: getObservations()/getLatestObservations() methods ✅
- MON-003.6: addRule()/removeRule()/getRules() methods ✅
- MON-003.7: getStatus() method ✅
- MON-004.1: StateReconciler class exported ✅
- MON-004.2: createDefaultDomains function ✅
- MON-004.3: registerDomain()/unregisterDomain() methods ✅
- MON-004.4: start()/stop() methods ✅
- MON-004.5: reconcileDomain()/reconcileAll() methods ✅
- MON-004.6: getResults()/getLatestResults() methods ✅
- MON-004.7: getDomains()/getStatus() methods ✅
- MON-007.1: ActionExecutor class exported ✅
- MON-007.2: createDefaultActions function ✅
- MON-007.3: setCommunicationHub() method ✅
- MON-007.4: registerAction()/unregisterAction()/getActions() methods ✅
- MON-007.5: createObservation()/createPlan() methods ✅
- MON-007.6: requestConfirmation()/executePlan() methods ✅
- MON-007.7: observeConfirmAct() method ✅
- MON-007.8: cancelPlan()/getPlan()/getPlans()/getPlansByStatus() methods ✅
- MON-007.9: getStatus()/cleanup() methods ✅
- MON-010.1: BaselineLearner class exported ✅
- MON-010.2: VIBE_METRICS constant ✅
- MON-010.3: start()/stop() methods ✅
- MON-010.4: recordMetric()/recordMetrics() methods ✅
- MON-010.5: getBaseline()/getMetricBaselines()/getAllBaselines() methods ✅
- MON-010.6: getAnomalies()/getRecentAnomalies() methods ✅
- MON-010.7: getTrackedMetrics()/getDataPoints() methods ✅
- MON-010.8: clearMetric()/clearAll()/importData()/exportData() methods ✅
- MON-010.9: getStatus() method ✅
- Index exports: All 12 runtime exports verified ✅

**Total: 93/93 tests passed**

---

## 15. PM Agent

| ID | Task | Pri | Status |
|----|------|-----|--------|
| PMA-001 | Generate spec (using Spec Agent) | P4 | [ ] |
| PMA-002 | Build using Build Agent | P4 | [ ] |
| PMA-003 | Conflict resolution | P4 | [ ] |
| PMA-004 | Work redistribution | P4 | [ ] |

---

## 16. Web Dashboard

| ID | Task | Pri | Status |
|----|------|-----|--------|
| WEB-001 | Dashboard layout and routing | P1 | [x] |
| WEB-002 | Agent status component | P1 | [x] |
| WEB-003 | Question queue component | P1 | [x] |
| WEB-004 | Question detail view | P1 | [x] |
| WEB-005 | Blocking question modal | P1 | [x] |
| WEB-006 | Activity timeline component | P2 | [x] |
| WEB-007 | Mobile responsive design | P2 | [x] |
| WEB-008 | Celebration/milestone modals | P3 | [x] |

> **Note**: WEB-001 to WEB-008 all completed. Implementation:
> - `frontend/src/pages/AgentDashboard.tsx` - Main agent monitoring dashboard (WEB-001)
> - `frontend/src/components/agents/AgentStatusCard.tsx` - Agent status cards (WEB-002)
> - `frontend/src/components/agents/QuestionQueue.tsx` - Question queue with quick actions (WEB-003)
> - `frontend/src/components/agents/AgentActivityFeed.tsx` - Activity timeline (WEB-005, WEB-006)
> - `frontend/src/components/agents/CelebrationModal.tsx` - Milestone celebration modals (WEB-008)
> - `frontend/src/types/agent.ts` - Shared TypeScript types for agent components
> - Mobile responsive via Tailwind classes (grid-cols-1 lg:grid-cols-3, etc.) (WEB-007)
> - Route at `/agents` in App.tsx with nav link in Layout.tsx

---

## 17. Real-Time & WebSocket

| ID | Task | Pri | Status |
|----|------|-----|--------|
| WSK-001 | WebSocket server setup | P1 | [x] |
| WSK-002 | Client connection management | P1 | [x] |
| WSK-003 | Event broadcasting | P1 | [x] |
| WSK-004 | Reconnection handling | P2 | [x] |
| WSK-005 | Connection heartbeat | P2 | [x] |

> **Note**: Extended `server/websocket.ts` with agent monitoring support. Connect via `/ws?monitor=agents`

---

## 18. Notifications

| ID | Task | Pri | Status |
|----|------|-----|--------|
| NTF-001 | Telegram bot setup | P2 | [x] |
| NTF-002 | Telegram question delivery | P2 | [x] |
| NTF-003 | Telegram inline answers | P2 | [x] |
| NTF-004 | Browser push notifications | P3 | [ ] |
| NTF-005 | Email digest system | P4 | [ ] |
| NTF-006 | Notification preferences UI | P2 | [x] |

> **Note**: NTF-001 to NTF-003 covered by COM-004, COM-005, COM-006, COM-007

---

## 19. Question Queue System

| ID | Task | Pri | Status |
|----|------|-----|--------|
| QUE-001 | Question queue database schema | P1 | [x] |
| QUE-002 | Queue priority management | P1 | [x] |
| QUE-003 | Answer processing and agent resume | P1 | [x] |
| QUE-004 | Expiry and timeout handling | P2 | [x] |
| QUE-005 | "Answer all defaults" feature | P2 | [x] |
| QUE-006 | Question history and analytics | P3 | [ ] |

> **Note**: QUE-001 to QUE-003 covered by COM-006, COM-007, COM-016

---

## 20. Authentication & Security

| ID | Task | Pri | Status |
|----|------|-----|--------|
| SEC-001 | User authentication system | P1 | [x] |
| SEC-002 | Session management | P1 | [x] |
| SEC-003 | Signed deep links for questions | P2 | [x] |
| SEC-004 | Rate limiting | P3 | [x] |
| SEC-005 | Telegram auth integration | P2 | [x] |

---

## 21. Documentation & Operations

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DOC-001 | Update CLAUDE.md with new conventions | P2 | [x] |
| DOC-002 | Operational runbook | P3 | [ ] |
| DOC-003 | API documentation | P3 | [ ] |
| DOC-004 | User guide | P4 | [ ] |

---

## Summary

| Category | Tasks | P1 | P2 | P3 | P4 |
|----------|-------|----|----|----|----|
| **Communication Core** | **16** | **14** | **2** | **0** | **0** |
| Foundation | 5 | 1 | 3 | 1 | 0 |
| Unified FS | 6 | 3 | 2 | 1 | 0 |
| Ideation | 7 | 1 | 4 | 2 | 0 |
| Evaluation | 6 | 0 | 4 | 1 | 1 |
| Agent Bootstrap | 6 | 5 | 1 | 0 | 0 |
| Spec Agent | 8 | 6 | 2 | 0 | 0 |
| Build Agent | 9 | 5 | 4 | 0 | 0 |
| Validation | 6 | 4 | 2 | 0 | 0 |
| SIA | 7 | 4 | 2 | 1 | 0 |
| UX Agent | 5 | 0 | 5 | 0 | 0 |
| Orchestration | 8 | 3 | 4 | 1 | 0 |
| Knowledge Base | 5 | 0 | 3 | 2 | 0 |
| Verification | 5 | 0 | 4 | 1 | 0 |
| **Monitoring Agent** | **10** | **9** | **1** | **0** | **0** |
| PM Agent | 4 | 0 | 0 | 0 | 4 |
| Web Dashboard | 8 | 5 | 2 | 1 | 0 |
| WebSocket | 5 | 3 | 2 | 0 | 0 |
| Notifications | 6 | 0 | 4 | 1 | 1 |
| Question Queue | 6 | 3 | 2 | 1 | 0 |
| Auth/Security | 5 | 2 | 2 | 1 | 0 |
| Documentation | 4 | 0 | 1 | 2 | 1 |
| **Total** | **147** | **68** | **54** | **17** | **8** |

---

## Dependency Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMMUNICATION CORE (COM-*)                                │
│            Telegram (7 bots) → Email → Halt Behavior                        │
│                   (Must be online FIRST)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ enables
                                         ▼
                    ┌─────────────────────────────────────────────┐
                    │           MONITORING AGENT (MON-*)          │
                    │     (Watches ALL agents, uses COM-*)        │
                    └─────────────────────────────────────────────┘
                                         ▲
                                         │ monitors
    ┌────────────────────────────────────┼────────────────────────────────────┐
    │                                    │                                    │
    ▼                                    ▼                                    ▼
┌─────────┐                        ┌─────────┐                          ┌─────────┐
│ FND-*   │                        │ WSK-*   │                          │ QUE-*   │
│ (infra) │                        │ (WS)    │                          │ (Queue) │
└────┬────┘                        └────┬────┘                          └────┬────┘
     │                                  │                                    │
     ▼                                  ▼                                    ▼
┌─────────┐     ┌─────────┐       ┌─────────┐      ┌─────────┐        ┌─────────┐
│ UFS-*   │────▶│ IDE-*   │       │ ORC-*   │◀─────│ WEB-*   │        │ NTF-*   │
└────┬────┘     └─────────┘       └────┬────┘      └─────────┘        └─────────┘
     │                                 │
     │         ┌───────────────────────┘
     │         │
     ▼         ▼
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ AGT-*   │──▶│ SPC-*   │──▶│ BLD-*   │──▶│ VAL-*   │──▶│ SIA-*   │
│(bootstr)│   │(spec)   │   │(build)  │   │(valid)  │   │(learn)  │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └────┬────┘
                                                              │
                                          ┌───────────────────┘
                                          ▼
                                    ┌─────────┐   ┌─────────┐
                                    │ UXA-*   │   │ KNW-*   │
                                    │(ux test)│   │(knowldg)│
                                    └─────────┘   └─────────┘
```

### Build Order (Critical Path)

```
Phase 0 (Communication):

  STEP 0: MANUAL (YOU must do this in Telegram)
  ┌─────────────────────────────────────────────────────────────┐
  │  COM-001: Create 7 bots via @BotFather                      │
  │           Copy tokens to .env                               │
  │           (Instructions in tasks/COM-001.md)                │
  └─────────────────────────────────────────────────────────────┘
         │
  STEP 1: Database (automated)
         │
         └── COM-016 (DB migrations - creates all COM tables)
         │
  STEP 2: Core Infrastructure (automated)
         │
         ├── COM-002 (Bot registry) → COM-003 (Chat ID linking)
         │
         ├── COM-004 (Telegram sender) → COM-005 (Receiver/polling)
         │
         └── COM-008 (Email sender) → COM-009 (Email questions)
         │
  STEP 3: Question System (automated)
         │
         ├── COM-006 (Question delivery) → COM-007 (Answer processing)
         │
         ├── COM-010 (Dispatcher) → COM-011 (Execution gate/halt)
         │
         └── COM-013 (Message templates) → COM-012 (/summary handler)
         │
  STEP 4: Agent Integration (automated)
         │
         ├── COM-014 (Agent handshake - hello + ack)
         │
         └── COM-015 (Communication Hub - single entry point)
         │
  ═══════════════════════════════════════════════════════════
  COMMUNICATION ONLINE - All agents can now ask questions
  ═══════════════════════════════════════════════════════════

Phase 1 (Infrastructure):
  FND-002 → QUE-001 → SEC-001/002
         │
Phase 2 (Real-time):
  WSK-001/002/003 → ORC-001/002 → WEB-001/002
         │
Phase 3 (Monitoring):
  MON-001 through MON-010 (MONITORING AGENT ONLINE)
         │
Phase 4 (Workers):
  AGT-* → SPC-* (Spec Agent, monitored + can ask questions)
         │
Phase 5 (Build Pipeline):
  BLD-* → VAL-* → SIA-* (All monitored, all can ask questions)
```

---

## Usage

Agents load this file, find task by ID, then load `tasks/{id}.md` for full details.
