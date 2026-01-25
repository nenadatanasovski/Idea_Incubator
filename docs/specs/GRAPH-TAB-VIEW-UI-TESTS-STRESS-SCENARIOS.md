# Property Model Stress Test Scenarios

> **Parent Document**: [GRAPH-TAB-VIEW-UI-TESTS.md](GRAPH-TAB-VIEW-UI-TESTS.md)
> **Source**: [PROPERTY-MODEL-STRESS-TEST.md](idea-to-app-flow/PROPERTY-MODEL-STRESS-TEST.md)
> **SQL Validation Queries**: [Appendix A: SQL Validation Queries](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md)
> **Last Updated**: 2026-01-24

---

These 27 scenarios stress-test the property-based knowledge model. Each scenario requires specific UI behavior to be validated. SQL validation queries for each test are documented in Appendix A.

## Table of Contents

1. [Scenario Summary Reference Table](#scenario-summary-reference-table)
2. [Input Complexity Scenarios](#input-complexity-scenarios-1-4-16-21-23)
3. [Meta & Subjective Scenarios](#meta--subjective-scenarios-5-6-12-13-17-20-24-25)
4. [Relationship Nuance Scenarios](#relationship-nuance-scenarios-7-10-11-18-22)
5. [Temporal & Evolution Scenarios](#temporal--evolution-scenarios-8-9-19-26)
6. [Scale & Aggregation Scenarios](#scale--aggregation-scenarios-14-15-27)
7. [Test Execution Summary](#test-execution-summary)

---

## Scenario Summary Reference Table

| #   | Scenario                  | Category             | Challenge                                             | UI Test Focus                                        |
| --- | ------------------------- | -------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| 1   | Compound Statement        | Input Complexity     | Single sentence contains 7+ insights across 5 domains | Verify multiple blocks extracted and displayed       |
| 2   | Contradiction             | Input Complexity     | User contradicts previous statement                   | Supersedes link visible, old node marked superseded  |
| 3   | Refinement vs Replacement | Input Complexity     | Distinguishing evolution from pivot                   | AI confirmation dialog, refines vs replaces link     |
| 4   | Hypotheticals             | Input Complexity     | Conditional statements that aren't facts              | Hypothetical badge/indicator on node                 |
| 5   | Meta-Statements           | Meta & Subjective    | Statements about the idea, not of the idea            | Meta block type display, "about" link visible        |
| 6   | Questions as Content      | Meta & Subjective    | Questions contain potential directions                | Question status indicator, exploring/considering     |
| 7   | Nuanced Relationships     | Relationship Nuance  | Simple links lack degree/severity                     | Edge metadata visible (degree, confidence)           |
| 8   | Temporal Information      | Temporal & Evolution | When things happened, will happen                     | Temporal properties in inspector (when, duration)    |
| 9   | Quantification Spectrum   | Temporal & Evolution | Same concept at varying specificity                   | Refines chain visible, confidence auto-calculated    |
| 10  | Negations                 | Relationship Nuance  | Negative information is valuable                      | Excludes link type distinct styling                  |
| 11  | Dependency Chains         | Relationship Nuance  | Transitive dependencies across blocks                 | Blocks/unblocks edges, dependency traversal          |
| 12  | Source Attribution        | Meta & Subjective    | Varying credibility of sources                        | Source type badge, credibility indicator             |
| 13  | Subjective vs Objective   | Meta & Subjective    | Facts vs opinions need differentiation                | Objectivity indicator on node                        |
| 14  | Scale and Aggregation     | Scale & Aggregation  | 47+ blocks need coherent synthesis                    | Synthesis blocks display, cluster visualization      |
| 15  | Cross-Idea Patterns       | Scale & Aggregation  | Patterns across multiple ideas                        | Global scope indicator, instance_of links            |
| 16  | Branching Alternatives    | Input Complexity     | Mutually exclusive options being explored             | Decision/option blocks, selection status             |
| 17  | Ranges and Bounds         | Meta & Subjective    | Values with uncertainty bounds, not point estimates   | Range visualization (min/max/estimate)               |
| 18  | Conditional Truth         | Relationship Nuance  | Same property differs by context                      | Context-qualified property display                   |
| 19  | Derived Values            | Temporal & Evolution | Calculated properties that can become stale           | Stale indicator, formula display, recalculate button |
| 20  | Evidence Chains           | Meta & Subjective    | Confidence should propagate through citations         | Evidence chain panel, derived confidence display     |
| 21  | Implicit Assumptions      | Input Complexity     | Unstated assumptions that should be surfaced          | Assumption block panel, criticality badge            |
| 22  | Cyclic Relationships      | Relationship Nuance  | Feedback loops and circular dependencies              | Cycle indicator, break-point selection               |
| 23  | Incomplete Information    | Input Complexity     | Known existence without details                       | Placeholder block styling, research query display    |
| 24  | Stakeholder Conflict      | Meta & Subjective    | Multiple views from different people                  | Stakeholder view panel, resolution status            |
| 25  | External Resources        | Meta & Subjective    | URL references that may change or disappear           | External block panel, URL health check               |
| 26  | Action Items              | Temporal & Evolution | Research and validation tasks with progress           | Action block panel, progress bar, due date           |
| 27  | Abstraction Levels        | Scale & Aggregation  | Strategy vs tactics at different zoom levels          | Abstraction filter, hierarchical layout              |

---

## Test Suite S: Stress Test Scenario UI Tests

> **Note**: Each test includes SQL validation queries documented in [Appendix A](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md).

### Input Complexity Scenarios (1-4, 16, 21, 23)

- [ ] **S.1.1**: Compound Statement Extraction Display
  - **Pre-conditions**: User sends compound message with 5+ insights
  - **Steps**:
    1. Send: "Our AI tool saves lawyers 10 hours/week at $500/hr, validated with 15 interviews, but 3 competitors entered this year"
    2. View graph
  - **Expected Result**: 5+ separate nodes created
  - **Pass Criteria**: Each insight is a distinct node with correct graph membership (Solution, Market, Risk)
  - **SQL Validation**: See [Appendix A - S.1.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s11-compound-statement-extraction-display)

- [ ] **S.2.1**: Contradiction Handling - Supersedes Display
  - **Pre-conditions**: Block "Target: Enterprise" exists
  - **Steps**:
    1. Send: "Actually, we're focusing on SMBs"
    2. View graph
  - **Expected Result**: New node with supersedes edge to old node
  - **Pass Criteria**: Old node shows "superseded" status (faded styling), supersedes edge visible
  - **SQL Validation**: See [Appendix A - S.2.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s21-contradiction-handling---supersedes-display)

- [ ] **S.2.2**: Superseded Node Inspector
  - **Pre-conditions**: Superseded block exists
  - **Steps**:
    1. Click superseded node
    2. View inspector
  - **Expected Result**: Shows "Superseded by: [new block]" with link
  - **Pass Criteria**: Clickable link to superseding block
  - **SQL Validation**: See [Appendix A - S.2.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s22-superseded-node-inspector)

- [ ] **S.3.1**: Refinement vs Replacement Confirmation
  - **Pre-conditions**: Block "Problem: Research takes too long" exists
  - **Steps**:
    1. Send: "Actually the problem is research quality, not time"
    2. Observe confirmation dialog
  - **Expected Result**: AI asks "Is this a refinement or replacement?"
  - **Pass Criteria**: Two options presented: "Refines (evolution)" and "Replaces (pivot)"
  - **SQL Validation**: See [Appendix A - S.3.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s31-refinement-vs-replacement-confirmation)

- [ ] **S.3.2**: Refines Link Display
  - **Pre-conditions**: User confirmed "refines" relationship
  - **Steps**:
    1. View edge between blocks
  - **Expected Result**: Dashed blue line labeled "refines"
  - **Pass Criteria**: Both blocks active, refines edge visible
  - **SQL Validation**: See [Appendix A - S.3.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s32-refines-link-display)

- [ ] **S.3.3**: Replaces Link Display
  - **Pre-conditions**: User confirmed "replaces" relationship
  - **Steps**:
    1. View edge between blocks
  - **Expected Result**: Dashed red line labeled "replaces", old block abandoned
  - **Pass Criteria**: Old block shows "abandoned" status
  - **SQL Validation**: See [Appendix A - S.3.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s33-replaces-link-display)

- [ ] **S.4.1**: Hypothetical Block Indicator
  - **Pre-conditions**: Hypothetical statement captured
  - **Steps**:
    1. Send: "If we had ML expertise, we could build a better solution"
    2. View resulting block
  - **Expected Result**: Block marked with hypothetical indicator
  - **Pass Criteria**: Visual badge "IF" or dotted border, condition visible in inspector
  - **SQL Validation**: See [Appendix A - S.4.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s41-hypothetical-block-indicator)

- [ ] **S.16.1**: Decision Block Display
  - **Pre-conditions**: Decision with alternatives exists
  - **Steps**:
    1. View decision block node
  - **Expected Result**: Decision block with connected option blocks
  - **Pass Criteria**: Red diamond for decision, orange nodes for options, alternative_to edges
  - **SQL Validation**: See [Appendix A - S.16.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s161-decision-block-display)

- [ ] **S.16.2**: Option Selection Status
  - **Pre-conditions**: Decision with 3 options
  - **Steps**:
    1. Select one option as "selected"
    2. View all option nodes
  - **Expected Result**: Selected option highlighted, others show "rejected" or "exploring"
  - **Pass Criteria**: Visual distinction between selected/rejected/exploring states
  - **SQL Validation**: See [Appendix A - S.16.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s162-option-selection-status)

- [ ] **S.21.1**: Assumption Surfacing
  - **Pre-conditions**: AI detects implicit assumption
  - **Steps**:
    1. View surfaced assumption block
  - **Expected Result**: Yellow assumption node with "AI surfaced" indicator
  - **Pass Criteria**: Shows implied_by link, criticality badge, surfaced_by: AI
  - **SQL Validation**: See [Appendix A - S.21.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s211-assumption-surfacing)

- [ ] **S.21.2**: Assumption Validation Flow
  - **Pre-conditions**: Unvalidated critical assumption
  - **Steps**:
    1. Click assumption node
    2. Click "Mark Validated"
    3. Enter validation method
  - **Expected Result**: Status changes to validated
  - **Pass Criteria**: Styling changes, validated_at timestamp shown
  - **SQL Validation**: See [Appendix A - S.21.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s212-assumption-validation-flow)

- [ ] **S.23.1**: Placeholder Block Display
  - **Pre-conditions**: Placeholder for unknown competitor
  - **Steps**:
    1. View placeholder node
  - **Expected Result**: Gray node with "?" indicator
  - **Pass Criteria**: Shows "Details unknown", research_query visible, placeholder_for label
  - **SQL Validation**: See [Appendix A - S.23.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s231-placeholder-block-display)

- [ ] **S.23.2**: Placeholder Research Action
  - **Pre-conditions**: Placeholder node selected
  - **Steps**:
    1. View inspector
    2. Click "Research" button
  - **Expected Result**: Research query sent to AI
  - **Pass Criteria**: Action triggered, placeholder marked for research
  - **SQL Validation**: See [Appendix A - S.23.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s232-placeholder-research-action)

---

### Meta & Subjective Scenarios (5-6, 12-13, 17, 20, 24-25)

- [ ] **S.5.1**: Meta Block Display
  - **Pre-conditions**: Meta block "Uncertainty about market size" exists
  - **Steps**:
    1. View meta block node
  - **Expected Result**: Amber-colored node with "about" link to domain block
  - **Pass Criteria**: Dotted edge to referenced block, meta_type visible
  - **SQL Validation**: See [Appendix A - S.5.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s51-meta-block-display)

- [ ] **S.5.2**: Meta Block Inspector
  - **Pre-conditions**: Meta block selected
  - **Steps**:
    1. View inspector panel
  - **Expected Result**: Shows meta_type, about reference, resolved status
  - **Pass Criteria**: "About: [block link]" clickable, resolve button if unresolved
  - **SQL Validation**: See [Appendix A - S.5.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s52-meta-block-inspector)

- [ ] **S.6.1**: Question Block Display
  - **Pre-conditions**: Question "What if we pivoted to B2B?" captured
  - **Steps**:
    1. View question block
  - **Expected Result**: Block with question indicator, exploring property
  - **Pass Criteria**: "?" badge or question mark styling, shows current vs exploring values
  - **SQL Validation**: See [Appendix A - S.6.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s61-question-block-display)

- [ ] **S.12.1**: Source Attribution Display
  - **Pre-conditions**: Block with source_type: research_firm
  - **Steps**:
    1. Select block
    2. View inspector
  - **Expected Result**: Source attribution section visible
  - **Pass Criteria**: Shows source_type badge, source_name, source_date, verifiable indicator
  - **SQL Validation**: See [Appendix A - S.12.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s121-source-attribution-display)

- [ ] **S.12.2**: Source Credibility Mapping
  - **Pre-conditions**: Blocks from different source types
  - **Steps**:
    1. Compare node confidence indicators
  - **Expected Result**: Higher confidence for research_firm than anecdote
  - **Pass Criteria**: Visual confidence (border opacity) matches source credibility
  - **SQL Validation**: See [Appendix A - S.12.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s122-source-credibility-mapping)

- [ ] **S.13.1**: Objectivity Indicator
  - **Pre-conditions**: Blocks with different objectivity values
  - **Steps**:
    1. View objective vs subjective blocks
  - **Expected Result**: Visual distinction between objective/subjective/mixed
  - **Pass Criteria**: Icon or badge indicating objectivity type
  - **SQL Validation**: See [Appendix A - S.13.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s131-objectivity-indicator)

- [ ] **S.17.1**: Range Property Display
  - **Pre-conditions**: Block with market_size_min: 30B, market_size_max: 70B
  - **Steps**:
    1. Select block
    2. View properties
  - **Expected Result**: Range displayed as "$30B - $70B"
  - **Pass Criteria**: Single range visualization, not separate fields
  - **SQL Validation**: See [Appendix A - S.17.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s171-range-property-display)

- [ ] **S.17.2**: High Uncertainty Warning
  - **Pre-conditions**: Block where max/min ratio > 3
  - **Steps**:
    1. View property display
  - **Expected Result**: Warning indicator
  - **Pass Criteria**: "Warning: High uncertainty (3.5x range)" message
  - **SQL Validation**: See [Appendix A - S.17.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s172-high-uncertainty-warning)

- [ ] **S.20.1**: Evidence Chain Traversal
  - **Pre-conditions**: Block with evidence_for links
  - **Steps**:
    1. Select block
    2. Click "View Evidence Chain"
  - **Expected Result**: Evidence chain panel opens
  - **Pass Criteria**: Shows path from sources to claim
  - **SQL Validation**: See [Appendix A - S.20.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s201-evidence-chain-traversal)

- [ ] **S.20.2**: Derived Confidence Display
  - **Pre-conditions**: Evidence chain with 3 nodes
  - **Steps**:
    1. View chain calculation
  - **Expected Result**: Each node shows base and derived confidence
  - **Pass Criteria**: Formula: "0.9 x 0.7 x 0.8 = 0.50"
  - **SQL Validation**: See [Appendix A - S.20.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s202-derived-confidence-display)

- [ ] **S.20.3**: Source Invalidation Warning
  - **Pre-conditions**: Source block in chain invalidated
  - **Steps**:
    1. View dependent blocks
  - **Expected Result**: Warning on all downstream blocks
  - **Pass Criteria**: "Warning: Source invalidated" indicator, evidence_status shown
  - **SQL Validation**: See [Appendix A - S.20.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s203-source-invalidation-warning)

- [ ] **S.24.1**: Stakeholder View Display
  - **Pre-conditions**: Multiple stakeholder views on same topic
  - **Steps**:
    1. View stakeholder view blocks
  - **Expected Result**: Cyan nodes with stakeholder attribution
  - **Pass Criteria**: Shows stakeholder name, role badge
  - **SQL Validation**: See [Appendix A - S.24.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s241-stakeholder-view-display)

- [ ] **S.24.2**: Stakeholder Conflict Resolution
  - **Pre-conditions**: Conflicting views exist
  - **Steps**:
    1. Select Topic block
    2. View stakeholder views list
  - **Expected Result**: All views shown with resolution status
  - **Pass Criteria**: Active/Adopted/Overruled/Withdrawn status for each
  - **SQL Validation**: See [Appendix A - S.24.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s242-stakeholder-conflict-resolution)

- [ ] **S.24.3**: View Resolution Display
  - **Pre-conditions**: Overruled stakeholder view
  - **Steps**:
    1. Select overruled view
  - **Expected Result**: Shows why overruled, incorporated_into link
  - **Pass Criteria**: overruled_reason visible, link to adopting view
  - **SQL Validation**: See [Appendix A - S.24.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s243-view-resolution-display)

- [ ] **S.25.1**: External Resource Display
  - **Pre-conditions**: External block with URL
  - **Steps**:
    1. View external block node
  - **Expected Result**: Lime-colored node with link icon
  - **Pass Criteria**: URL domain visible in label
  - **SQL Validation**: See [Appendix A - S.25.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s251-external-resource-display)

- [ ] **S.25.2**: URL Health Check
  - **Pre-conditions**: External block selected
  - **Steps**:
    1. Click "Check URL"
  - **Expected Result**: Health status updated
  - **Pass Criteria**: Shows Alive / Redirected / Dead / Changed status
  - **SQL Validation**: See [Appendix A - S.25.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s252-url-health-check)

- [ ] **S.25.3**: Domain Credibility Display
  - **Pre-conditions**: Externals from different domains
  - **Steps**:
    1. Compare domain credibility badges
  - **Expected Result**: Credibility level visible
  - **Pass Criteria**: High (green) / Medium (yellow) / Low (orange) / Very Low (red)
  - **SQL Validation**: See [Appendix A - S.25.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s253-domain-credibility-display)

- [ ] **S.25.4**: Content Change Detection
  - **Pre-conditions**: External with snapshot, content changed
  - **Steps**:
    1. View external block after URL check
  - **Expected Result**: "Content changed since snapshot" warning
  - **Pass Criteria**: Warning badge, option to update snapshot
  - **SQL Validation**: See [Appendix A - S.25.4](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s254-content-change-detection)

---

### Relationship Nuance Scenarios (7, 10-11, 18, 22)

- [ ] **S.7.1**: Link Degree Display
  - **Pre-conditions**: "addresses" link with degree: partial
  - **Steps**:
    1. View edge between blocks
  - **Expected Result**: Edge shows degree indicator
  - **Pass Criteria**: Label or visual (thickness/style) indicates partial
  - **SQL Validation**: See [Appendix A - S.7.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s71-link-degree-display)

- [ ] **S.7.2**: Link Confidence Display
  - **Pre-conditions**: Link with confidence: 0.6
  - **Steps**:
    1. View edge
  - **Expected Result**: Edge opacity or style reflects confidence
  - **Pass Criteria**: Lower confidence = more transparent or dashed
  - **SQL Validation**: See [Appendix A - S.7.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s72-link-confidence-display)

- [ ] **S.7.3**: Link Metadata in Inspector
  - **Pre-conditions**: Complex link selected
  - **Steps**:
    1. Click on edge
    2. View inspector
  - **Expected Result**: All link properties shown
  - **Pass Criteria**: Shows: type, degree, confidence, reason, status
  - **SQL Validation**: See [Appendix A - S.7.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s73-link-metadata-in-inspector)

- [ ] **S.10.1**: Excludes Link Display
  - **Pre-conditions**: "excludes" relationship exists
  - **Steps**:
    1. View excludes edge
  - **Expected Result**: Red dashed line with X indicator
  - **Pass Criteria**: Distinct from "includes" link styling
  - **SQL Validation**: See [Appendix A - S.10.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s101-excludes-link-display)

- [ ] **S.10.2**: Negative Information Filtering
  - **Pre-conditions**: Mix of includes and excludes links
  - **Steps**:
    1. Filter by "excludes" relationship type
  - **Expected Result**: Only exclusion relationships shown
  - **Pass Criteria**: Filter applies correctly
  - **SQL Validation**: See [Appendix A - S.10.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s102-negative-information-filtering)

- [ ] **S.11.1**: Blocks/Unblocks Edge Display
  - **Pre-conditions**: Dependency chain with blocks relationships
  - **Steps**:
    1. View blocking edges
  - **Expected Result**: Red solid edges for "blocks"
  - **Pass Criteria**: Distinct from "requires" styling
  - **SQL Validation**: See [Appendix A - S.11.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s111-blocksunblocks-edge-display)

- [ ] **S.11.2**: Dependency Traversal
  - **Pre-conditions**: Chain: A blocks B blocks C
  - **Steps**:
    1. Select node A
    2. Ask "What does this block?"
  - **Expected Result**: B and C highlighted
  - **Pass Criteria**: Transitive dependencies shown
  - **SQL Validation**: See [Appendix A - S.11.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s112-dependency-traversal)

- [ ] **S.18.1**: Context-Qualified Value Display
  - **Pre-conditions**: Property with varies_by: customer_segment
  - **Steps**:
    1. Select block
    2. View properties
  - **Expected Result**: Values shown by context
  - **Pass Criteria**: "Enterprise: $500/mo, SMB: $50/mo" format
  - **SQL Validation**: See [Appendix A - S.18.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s181-context-qualified-value-display)

- [ ] **S.18.2**: Varies By Indicator
  - **Pre-conditions**: Block with context-qualified properties
  - **Steps**:
    1. View node
  - **Expected Result**: Indicator that values vary by context
  - **Pass Criteria**: Badge or icon showing "varies by: segment"
  - **SQL Validation**: See [Appendix A - S.18.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s182-varies-by-indicator)

- [ ] **S.22.1**: Cycle Detection Display
  - **Pre-conditions**: Circular dependency: A requires B requires A
  - **Steps**:
    1. Create the cycle
    2. View affected nodes
  - **Expected Result**: Cycle indicator on involved nodes
  - **Pass Criteria**: Red cycle badge, nodes highlighted
  - **SQL Validation**: See [Appendix A - S.22.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s221-cycle-detection-display)

- [ ] **S.22.2**: Cycle Type Classification
  - **Pre-conditions**: Blocking and reinforcing cycles
  - **Steps**:
    1. View each cycle
  - **Expected Result**: Correct type indicator
  - **Pass Criteria**: Blocking indicator vs Reinforcing indicator
  - **SQL Validation**: See [Appendix A - S.22.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s222-cycle-type-classification)

- [ ] **S.22.3**: Break Point Selection UI
  - **Pre-conditions**: Cycle panel open
  - **Steps**:
    1. Click suggested break point
    2. Confirm selection
  - **Expected Result**: Break point marked
  - **Pass Criteria**: Visual indicator on break node, strategy input enabled
  - **SQL Validation**: See [Appendix A - S.22.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s223-break-point-selection-ui)

- [ ] **S.22.4**: Cycle Resolution Flow
  - **Pre-conditions**: Break point selected
  - **Steps**:
    1. Enter break strategy
    2. Click "Mark Resolved"
  - **Expected Result**: Cycle marked as resolved
  - **Pass Criteria**: Green checkmark, reduced visual prominence
  - **SQL Validation**: See [Appendix A - S.22.4](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s224-cycle-resolution-flow)

---

### Temporal & Evolution Scenarios (8-9, 19, 26)

- [ ] **S.8.1**: Temporal Property Display
  - **Pre-conditions**: Block with when, duration properties
  - **Steps**:
    1. Select block
    2. View temporal section
  - **Expected Result**: Timeline or date display
  - **Pass Criteria**: Shows: when (date), duration, planned_for if applicable
  - **SQL Validation**: See [Appendix A - S.8.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s81-temporal-property-display)

- [ ] **S.8.2**: Relative Time Display
  - **Pre-conditions**: Block with when: -6_months
  - **Steps**:
    1. View temporal display
  - **Expected Result**: "6 months ago" or calculated date
  - **Pass Criteria**: Human-readable format
  - **SQL Validation**: See [Appendix A - S.8.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s82-relative-time-display)

- [ ] **S.8.3**: Future Planning Display
  - **Pre-conditions**: Block with planned_for: Q3_2026
  - **Steps**:
    1. View planning info
  - **Expected Result**: "Planned for Q3 2026" visible
  - **Pass Criteria**: Clear future indicator, days until
  - **SQL Validation**: See [Appendix A - S.8.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s83-future-planning-display)

- [ ] **S.9.1**: Quantification Refinement Chain
  - **Pre-conditions**: "Market size" refined 3 times with increasing precision
  - **Steps**:
    1. View refines chain
  - **Expected Result**: Chain from vague to precise estimates
  - **Pass Criteria**: Confidence increases along chain
  - **SQL Validation**: See [Appendix A - S.9.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s91-quantification-refinement-chain)

- [ ] **S.19.1**: Derived Block Display
  - **Pre-conditions**: Derived block with formula
  - **Steps**:
    1. Select derived block
    2. View inspector
  - **Expected Result**: Formula and computed value shown
  - **Pass Criteria**: "Formula: TAM x rate", "Computed: $5B"
  - **SQL Validation**: See [Appendix A - S.19.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s191-derived-block-display)

- [ ] **S.19.2**: Stale Derived Block Indicator
  - **Pre-conditions**: Source block modified after derivation
  - **Steps**:
    1. View derived block
  - **Expected Result**: Stale warning displayed
  - **Pass Criteria**: STALE badge, shows which source changed
  - **SQL Validation**: See [Appendix A - S.19.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s192-stale-derived-block-indicator)

- [ ] **S.19.3**: Recalculate Derived Value
  - **Pre-conditions**: Stale derived block
  - **Steps**:
    1. Click "Recalculate"
  - **Expected Result**: New value computed, stale removed
  - **Pass Criteria**: Updated value, computed_at timestamp refreshed
  - **SQL Validation**: See [Appendix A - S.19.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s193-recalculate-derived-value)

- [ ] **S.19.4**: Override Derived Value
  - **Pre-conditions**: Derived block selected
  - **Steps**:
    1. Click "Override Value"
    2. Enter value: "$6B"
    3. Enter reason: "CEO directive"
  - **Expected Result**: Override applied
  - **Pass Criteria**: Shows original vs override, reason displayed
  - **SQL Validation**: See [Appendix A - S.19.4](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s194-override-derived-value)

- [ ] **S.26.1**: Action Block Display
  - **Pre-conditions**: Action block with progress
  - **Steps**:
    1. View action node
  - **Expected Result**: Green node with progress indicator
  - **Pass Criteria**: Action type icon (validate, research, build)
  - **SQL Validation**: See [Appendix A - S.26.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s261-action-block-display)

- [ ] **S.26.2**: Action Progress Bar
  - **Pre-conditions**: Action with 8/10 completed
  - **Steps**:
    1. Select action block
    2. View inspector
  - **Expected Result**: Progress bar at 80%
  - **Pass Criteria**: Visual progress indicator "8/10"
  - **SQL Validation**: See [Appendix A - S.26.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s262-action-progress-bar)

- [ ] **S.26.3**: Action Due Date Warning
  - **Pre-conditions**: Action due in 2 days
  - **Steps**:
    1. View action block
  - **Expected Result**: Due date with urgency indicator
  - **Pass Criteria**: Yellow/red warning if approaching/overdue
  - **SQL Validation**: See [Appendix A - S.26.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s263-action-due-date-warning)

- [ ] **S.26.4**: Action Completion Flow
  - **Pre-conditions**: All evidence collected
  - **Steps**:
    1. Click "Mark Complete"
    2. Select outcome (validated/invalidated/inconclusive)
  - **Expected Result**: Action completed with outcome
  - **Pass Criteria**: Status updated, validates_claim link result updated
  - **SQL Validation**: See [Appendix A - S.26.4](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s264-action-completion-flow)

---

### Scale & Aggregation Scenarios (14-15, 27)

- [ ] **S.14.1**: Synthesis Block Display
  - **Pre-conditions**: AI-generated synthesis of 10+ blocks
  - **Steps**:
    1. View synthesis node
  - **Expected Result**: Purple synthesis node with connections to source blocks
  - **Pass Criteria**: Synthesizes edges visible, cluster_theme label
  - **SQL Validation**: See [Appendix A - S.14.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s141-synthesis-block-display)

- [ ] **S.14.2**: Synthesis Expansion
  - **Pre-conditions**: Synthesis block selected
  - **Steps**:
    1. Click "Expand Synthesis"
  - **Expected Result**: Source blocks highlighted/expanded
  - **Pass Criteria**: All synthesized blocks shown with their contributions
  - **SQL Validation**: See [Appendix A - S.14.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s142-synthesis-expansion)

- [ ] **S.14.3**: Synthesis Regeneration
  - **Pre-conditions**: Source blocks modified
  - **Steps**:
    1. Click "Regenerate Synthesis"
  - **Expected Result**: AI regenerates summary
  - **Pass Criteria**: Updated content, previous version preserved
  - **SQL Validation**: See [Appendix A - S.14.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s143-synthesis-regeneration)

- [ ] **S.15.1**: Global Pattern Display
  - **Pre-conditions**: Pattern block with scope: global
  - **Steps**:
    1. View pattern node
  - **Expected Result**: Pink node with global indicator
  - **Pass Criteria**: Global badge or special border indicating cross-idea
  - **SQL Validation**: See [Appendix A - S.15.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s151-global-pattern-display)

- [ ] **S.15.2**: Pattern Instances Display
  - **Pre-conditions**: Pattern with 3 instances across ideas
  - **Steps**:
    1. Select pattern block
    2. View instances
  - **Expected Result**: List of instance blocks with idea attribution
  - **Pass Criteria**: Each instance shows idea name, instance_of links visible
  - **SQL Validation**: See [Appendix A - S.15.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s152-pattern-instances-display)

- [ ] **S.15.3**: Portfolio Tag Grouping
  - **Pre-conditions**: Multiple ideas with same portfolio_tag
  - **Steps**:
    1. Filter by portfolio tag
  - **Expected Result**: Cross-idea view of related blocks
  - **Pass Criteria**: Blocks from different ideas visible together
  - **SQL Validation**: See [Appendix A - S.15.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s153-portfolio-tag-grouping)

- [ ] **S.27.1**: Abstraction Level Filter
  - **Pre-conditions**: Blocks at all 4 abstraction levels
  - **Steps**:
    1. Select "Vision" filter
  - **Expected Result**: Only vision-level blocks shown
  - **Pass Criteria**: Strategy, tactic, implementation hidden
  - **SQL Validation**: See [Appendix A - S.27.1](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s271-abstraction-level-filter)

- [ ] **S.27.2**: Hierarchical Layout by Abstraction
  - **Pre-conditions**: Implements chain: vision -> strategy -> tactic -> implementation
  - **Steps**:
    1. Select "Hierarchical" layout
  - **Expected Result**: Vertical arrangement by abstraction
  - **Pass Criteria**: Vision at top, implementation at bottom
  - **SQL Validation**: See [Appendix A - S.27.2](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s272-hierarchical-layout-by-abstraction)

- [ ] **S.27.3**: "Why is this here?" Abstraction Query
  - **Pre-conditions**: Implementation block selected
  - **Steps**:
    1. Ask "Why is this here?"
  - **Expected Result**: Chain highlighted to vision
  - **Pass Criteria**: Full implements path visible with explanation
  - **SQL Validation**: See [Appendix A - S.27.3](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s273-why-is-this-here-abstraction-query)

- [ ] **S.27.4**: Abstraction Level Navigation
  - **Pre-conditions**: Block at tactic level
  - **Steps**:
    1. Click "View Strategy" in inspector
    2. Click "View Vision"
  - **Expected Result**: Navigation up abstraction chain
  - **Pass Criteria**: Smooth transitions, selection updates
  - **SQL Validation**: See [Appendix A - S.27.4](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md#s274-abstraction-level-navigation)

---

## Test Execution Summary

### Stress Test Scenario Breakdown

| Category             | Scenarios                 | Tests  |
| -------------------- | ------------------------- | ------ |
| Input Complexity     | 1-4, 16, 21, 23           | 14     |
| Meta & Subjective    | 5-6, 12-13, 17, 20, 24-25 | 18     |
| Relationship Nuance  | 7, 10-11, 18, 22          | 13     |
| Temporal & Evolution | 8-9, 19, 26               | 12     |
| Scale & Aggregation  | 14-15, 27                 | 10     |
| **Total**            | **27 scenarios**          | **63** |

---

## Appendices

- [Appendix A: SQL Validation Queries](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-A-SQL-QUERIES.md) - All SQL queries for validating test scenarios
- [Appendix B: Test Data Templates](GRAPH-TAB-VIEW-UI-TESTS-APPENDIX-B-TEST-DATA.md) - Sample JSON data for testing

---

**Document Version**: 1.0
**Created**: 2026-01-24
**Extracted From**: [GRAPH-TAB-VIEW-UI-TESTS.md](GRAPH-TAB-VIEW-UI-TESTS.md)
**Author**: Claude Code
