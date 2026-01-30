# Ideation Agent Browser Test Plan

## Overview

This test plan validates the frontend and memory graph changes for the ideation agent using browser automation.

## Test Environment

- Base URL: http://localhost:5001 (or configured port)
- Test User: test-user
- Test Idea: test-idea (or existing idea)

---

## Test Suite 1: Session Management

### TEST-SM-001: Create New Session

**Steps:**

1. Navigate to ideation page
2. Create a new session with a user
3. Verify session is created and active
4. Verify chat interface is displayed

**Expected:** Session created successfully, chat interface visible

### TEST-SM-002: List Sessions

**Steps:**

1. Navigate to sessions list
2. Verify sessions are displayed
3. Check session metadata (status, date, title)

**Expected:** Sessions listed with correct metadata

### TEST-SM-003: Resume Existing Session

**Steps:**

1. Select an existing session from list
2. Verify session loads with previous messages
3. Verify artifacts and blocks are loaded

**Expected:** Session resumes with all data intact

---

## Test Suite 2: Memory Database Panel

### TEST-MDP-001: Navigate to Memory Database Tab

**Steps:**

1. Open an active session
2. Click on "Memory" tab
3. Verify MemoryDatabasePanel loads

**Expected:** Memory Database panel displays with tabs

### TEST-MDP-002: View Blocks Tab

**Steps:**

1. In Memory Database panel, click "Blocks" tab
2. Verify blocks table displays
3. Check block properties (type, status, confidence, content)

**Expected:** Blocks displayed with correct properties

### TEST-MDP-003: View Links Tab

**Steps:**

1. Click "Links" tab
2. Verify links table displays
3. Check link properties (type, source, target, confidence)

**Expected:** Links displayed with correct properties

### TEST-MDP-004: View Memory Files Tab

**Steps:**

1. Click "Memory Files" tab
2. Verify memory files display
3. Check source indicator (Legacy vs Graph)
4. Verify confidence is shown for graph-based entries

**Expected:** Memory files shown with source indicators

### TEST-MDP-005: View Reports Tab

**Steps:**

1. Click "Reports" tab
2. Verify group reports display
3. Expand a report to see details (overview, themes, story)

**Expected:** Reports displayed with expandable details

### TEST-MDP-006: Filter Blocks by Type

**Steps:**

1. In Blocks tab, click on a type filter tag
2. Verify blocks are filtered
3. Click "Clear all" to reset filters

**Expected:** Filtering works correctly

### TEST-MDP-007: Search in Memory Database

**Steps:**

1. Enter search term in search box
2. Verify results are filtered
3. Clear search and verify all items return

**Expected:** Search functionality works

---

## Test Suite 3: Graph Visualization

### TEST-GV-001: Navigate to Graph Tab

**Steps:**

1. Open an active session
2. Click on "Graph" tab
3. Verify graph canvas loads

**Expected:** Graph visualization displays

### TEST-GV-002: Graph Controls

**Steps:**

1. Verify zoom controls are present
2. Test zoom in/out
3. Test fit-to-view
4. Test refresh button

**Expected:** All graph controls functional

### TEST-GV-003: Graph Filters

**Steps:**

1. Open graph filters panel
2. Filter by graph membership
3. Filter by block type
4. Verify nodes are filtered

**Expected:** Graph filtering works

### TEST-GV-004: Node Selection

**Steps:**

1. Click on a node in the graph
2. Verify NodeInspector panel opens
3. Check node details are displayed

**Expected:** Node selection and inspection works

---

## Test Suite 4: Readiness Dashboard

### TEST-RD-001: View Readiness Dashboard

**Steps:**

1. Navigate to a session with an idea
2. Find or navigate to readiness dashboard
3. Verify three phases are displayed (Spec, Build, Launch)

**Expected:** Readiness dashboard shows all phases

### TEST-RD-002: Check Readiness Scores

**Steps:**

1. View readiness percentages for each phase
2. Verify progress bars match percentages
3. Check color coding (green/yellow/orange/red)

**Expected:** Scores and colors displayed correctly

### TEST-RD-003: View Missing Items

**Steps:**

1. Expand a phase card
2. Verify missing items are listed
3. Check importance indicators (critical, important, nice-to-have)

**Expected:** Missing items displayed with importance

### TEST-RD-004: View Recommendations

**Steps:**

1. Expand a phase card
2. Verify recommendations are listed
3. Check next steps section

**Expected:** Recommendations displayed

---

## Test Suite 5: API Integration

### TEST-API-001: Blocks API

**Steps:**

1. Call GET /api/ideation/session/:sessionId/blocks
2. Verify response structure
3. Check block data integrity

**Expected:** Blocks API returns valid data

### TEST-API-002: Links API

**Steps:**

1. Call GET /api/ideation/session/:sessionId/links
2. Verify response structure
3. Check link data integrity

**Expected:** Links API returns valid data

### TEST-API-003: Memory Files API

**Steps:**

1. Call GET /api/ideation/session/:sessionId/memory-files
2. Verify response includes both legacy and graph data
3. Check deprecation notice in response

**Expected:** Memory files API returns combined data

### TEST-API-004: Readiness API

**Steps:**

1. Call GET /api/ideation/idea/:ideaId/graph/readiness
2. Verify spec, build, launch readiness data
3. Check scores and missing items

**Expected:** Readiness API returns complete data

### TEST-API-005: Reports API

**Steps:**

1. Call GET /api/ideation/session/:sessionId/reports
2. Verify reports structure
3. Check report content

**Expected:** Reports API returns valid data

---

## Test Suite 6: Data Flow Verification

### TEST-DF-001: Block Creation Flow

**Steps:**

1. Send a chat message that should create blocks
2. Verify blocks appear in Memory Database panel
3. Check blocks appear in graph visualization

**Expected:** Blocks created and visible in all views

### TEST-DF-002: Source Mapping

**Steps:**

1. Trigger source mapping
2. Verify status updates
3. Check blocks have source attributions

**Expected:** Source mapping completes successfully

### TEST-DF-003: Report Generation

**Steps:**

1. Trigger report regeneration
2. Verify status updates
3. Check reports are generated

**Expected:** Reports generated successfully

---

## Pass Criteria Summary

| Suite                 | Tests  | Must Pass |
| --------------------- | ------ | --------- |
| Session Management    | 3      | 3         |
| Memory Database Panel | 7      | 6         |
| Graph Visualization   | 4      | 3         |
| Readiness Dashboard   | 4      | 4         |
| API Integration       | 5      | 5         |
| Data Flow             | 3      | 2         |
| **TOTAL**             | **26** | **23**    |

---

## Notes

- Tests assume server is running on localhost:5001
- Some tests require existing session data
- Graph tests may fail if no blocks exist
- Report tests depend on having connected node groups
