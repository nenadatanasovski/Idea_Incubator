# Ideation Agent E2E Test Plan

## Overview

This document defines comprehensive end-to-end tests for the Ideation Agent system (Phases 1-4). Tests are designed for browser automation using Claude in Chrome and follow strict pass/fail criteria.

**Test Environment:**
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Browser: Chrome with Claude in Chrome extension

---

## Test Categories

| Category | Tests | Priority |
|----------|-------|----------|
| Session Lifecycle | 8 | Critical |
| Conversation Flow | 10 | Critical |
| Button Interactions | 6 | High |
| Form Handling | 4 | High |
| Candidate Management | 8 | High |
| Confidence & Viability | 6 | Medium |
| Memory Persistence | 4 | Medium |
| Error Handling | 6 | Medium |
| UI Components | 8 | Low |
| **Full Journey E2E** | **4** | **Critical** |

**Total: 64 tests** (60 feature tests + 4 journey tests)

---

## Test Dependencies & Automation Notes

### Critical Path (Must Execute First)
These tests form the foundation. If any fail, dependent tests should be skipped:

```
TEST-SL-001 (Navigate)
    └── TEST-SL-002 (Start Session - Discover)
        └── TEST-CF-001 (Send First Message)
            └── TEST-CF-002 (Multi-Turn)
                └── TEST-BI-001 (Button Click)
                    └── TEST-CM-001 (Candidate Panel)
                        └── TEST-CM-006 (Capture Idea)
                            └── TEST-E2E-001 (Full Journey - Ultimate Validation)
```

**Note:** TEST-E2E-001 is the ultimate validation test. If all feature tests pass but TEST-E2E-001 fails, there's a systemic issue with the end-to-end flow.

### Test Dependencies Map

| Test | Requires | Notes |
|------|----------|-------|
| TEST-SL-002 | TEST-SL-001 | Must navigate to /ideate first |
| TEST-SL-003 | TEST-SL-001 | Must navigate to /ideate first |
| TEST-SL-005 | TEST-SL-002 | Needs active session to abandon |
| TEST-CF-001 | TEST-SL-002 | Needs session with greeting |
| TEST-CF-002 to CF-010 | TEST-CF-001 | Needs messaging to work |
| TEST-BI-001 to BI-006 | TEST-CF-007 | Needs buttons in conversation |
| TEST-CM-001 to CM-005 | TEST-CF-001 | Needs conversation for confidence |
| TEST-CM-006 | TEST-CM-004 | Needs 60%+ confidence |
| TEST-CV-* | TEST-CF-001 | Needs conversation flow |
| TEST-MP-* | TEST-CF-002 | Needs multi-turn data |

### Tests Difficult to Automate via Browser

These tests require special handling or may need manual verification:

| Test | Difficulty | Recommendation |
|------|------------|----------------|
| TEST-EH-001 (API Timeout) | Hard | Use browser DevTools throttling if possible, or mark as manual |
| TEST-EH-002 (Network Disconnection) | Hard | Requires network manipulation, mark as manual |
| TEST-EH-004 (Database Error) | Hard | Requires DB manipulation, mark as manual |
| TEST-EH-005 (Malformed Response) | Hard | Requires API mocking, mark as manual |
| TEST-UI-005 (Responsive) | Medium | Test at 3 viewport sizes: 1920x1080, 1024x768, 375x667 |
| TEST-UI-008 (Accessibility) | Medium | Focus on keyboard navigation, skip screen reader |

### Tests That Need Fresh State

These tests should start with a clean session (no prior session active):
- All TEST-SL-* (Session Lifecycle)
- TEST-CF-002, CF-003, CF-005, CF-006, CF-008

### Pass/Fail Verification Checklist Template

For each test, verify:
- [ ] All steps completed without browser errors
- [ ] Console has no unexpected errors (check with `read_console_messages`)
- [ ] Network requests returned expected status codes
- [ ] UI displays expected elements
- [ ] Screenshot shows correct state

---

## 1. Session Lifecycle Tests

### TEST-SL-001: Navigate to Ideation Page
**Steps:**
1. Navigate to `http://localhost:3000`
2. Click on "Ideate" in navigation or navigate to `/ideate`

**Pass Criteria:**
- Page loads without errors
- "Start Ideation" or similar entry point is visible
- Profile selector is displayed if profiles exist

**Fail Criteria:**
- 404 error
- JavaScript console errors
- Blank page

---

### TEST-SL-002: Start Session with Profile (Discover Mode)
**Preconditions:** At least one profile exists in the system

**Steps:**
1. Navigate to `/ideate`
2. Select a profile from dropdown
3. Click "Start with guided discovery" or equivalent discover mode button

**Pass Criteria:**
- Loading spinner appears briefly
- Session initializes with greeting message from assistant
- Greeting message asks exploratory question about user's interests/frustrations
- No duplicate messages appear
- Session ID is generated (visible in header or URL)

**Fail Criteria:**
- 404 or 500 error on `/api/ideation/start`
- Duplicate greeting messages
- Console errors about missing keys
- "Something went wrong" error state

---

### TEST-SL-003: Start Session with Existing Idea (Have Idea Mode)
**Preconditions:** At least one profile exists

**Steps:**
1. Navigate to `/ideate`
2. Select a profile
3. Click "I have an idea" or equivalent have_idea mode button

**Pass Criteria:**
- Session starts with different greeting than discover mode
- Greeting asks user to describe their idea
- Entry mode is recorded correctly

**Fail Criteria:**
- Same greeting as discover mode
- API errors

---

### TEST-SL-004: Start Session Without Profile
**Steps:**
1. Navigate to `/ideate`
2. Attempt to start session without selecting profile (if allowed)
3. OR verify profile selection is required

**Pass Criteria:**
- Either session starts with null profile_id
- OR UI enforces profile selection with clear message

**Fail Criteria:**
- Crash or unhandled error
- Session starts but fails on first message

---

### TEST-SL-005: Session Abandonment
**Preconditions:** Active session exists

**Steps:**
1. Start a new ideation session
2. Exchange at least 2 messages
3. Click "Abandon" or exit button
4. Confirm abandonment if prompted

**Pass Criteria:**
- Session status changes to 'abandoned' in database
- User returns to ideation entry page
- No orphaned state remains

**Fail Criteria:**
- Session remains 'active' in database
- Error on abandonment
- User stuck in session

---

### TEST-SL-006: Session Recovery After Browser Refresh
**Preconditions:** Active session with messages

**Steps:**
1. Start session and exchange 3+ messages
2. Note the session ID
3. Refresh browser (F5)
4. Check if session can be resumed

**Pass Criteria:**
- Session data persists in database
- (If implemented) Session resumes with previous messages
- OR new session can be started cleanly

**Fail Criteria:**
- Database corruption
- Orphaned session prevents new session

---

### TEST-SL-007: Concurrent Session Prevention
**Steps:**
1. Start session in browser tab 1
2. Open new tab, navigate to `/ideate`
3. Attempt to start another session with same profile

**Pass Criteria:**
- Either second session is prevented with clear message
- OR system handles multiple sessions gracefully

**Fail Criteria:**
- Both sessions corrupt each other
- Database constraint violations

---

### TEST-SL-008: Session Timeout Behavior
**Steps:**
1. Start session
2. Wait for timeout period (or simulate via API)
3. Attempt to send message

**Pass Criteria:**
- Clear timeout message displayed
- Option to start new session
- Old session marked appropriately in database

**Fail Criteria:**
- Silent failure
- Corrupted state

---

## 2. Conversation Flow Tests

### TEST-CF-001: Send First Message
**Preconditions:** Session started, greeting displayed

**Steps:**
1. Type message in input field: "I'm frustrated with how hard it is to find good coffee shops while traveling"
2. Press Enter or click Send

**Pass Criteria:**
- User message appears in conversation immediately
- Loading indicator shows while waiting for response
- Assistant response appears within 30 seconds
- Response is contextually relevant (acknowledges frustration about coffee/travel)
- No duplicate messages
- Each message has unique key (no React warnings)

**Fail Criteria:**
- 500 error on `/api/ideation/message`
- Message doesn't appear
- Duplicate messages
- Console key warnings

---

### TEST-CF-002: Multi-Turn Conversation
**Steps:**
1. Start session
2. Send: "I want to build something in the education space"
3. Wait for response
4. Send: "Specifically for high school students"
5. Wait for response
6. Send: "They struggle with math homework"

**Pass Criteria:**
- Each message/response pair displays correctly
- Conversation maintains context (references education, high school, math)
- Messages appear in chronological order
- Scroll follows new messages

**Fail Criteria:**
- Context lost between messages
- Messages out of order
- Scroll doesn't follow

---

### TEST-CF-003: Long Message Handling
**Steps:**
1. Start session
2. Send a message with 500+ characters describing a complex idea

**Pass Criteria:**
- Full message is sent and displayed
- Response addresses the full content
- No truncation errors

**Fail Criteria:**
- Message truncated
- API error due to length

---

### TEST-CF-004: Empty Message Prevention
**Steps:**
1. Start session
2. Click Send with empty input
3. Try pressing Enter with empty input

**Pass Criteria:**
- Send button is disabled when input empty
- No empty messages sent
- No API calls made

**Fail Criteria:**
- Empty message sent to API
- API error

---

### TEST-CF-005: Special Characters in Messages
**Steps:**
1. Send message with: `<script>alert('xss')</script>`
2. Send message with: `"quotes" and 'apostrophes'`
3. Send message with emojis: `Great idea! 🚀💡`

**Pass Criteria:**
- All characters display correctly (escaped if needed)
- No XSS execution
- Messages stored and retrieved correctly

**Fail Criteria:**
- XSS vulnerability
- Characters corrupted
- Database errors

---

### TEST-CF-006: Rapid Message Sending
**Steps:**
1. Start session
2. Send 3 messages in quick succession (within 2 seconds)

**Pass Criteria:**
- Messages are queued or rate-limited gracefully
- All messages eventually process
- Clear feedback to user about processing state

**Fail Criteria:**
- Race conditions cause duplicates
- Messages lost
- UI becomes unresponsive

---

### TEST-CF-007: Message with Buttons Response
**Steps:**
1. Start session with discover mode
2. Send message that should trigger button options

**Pass Criteria:**
- Assistant response includes clickable buttons
- Buttons are visually distinct from text
- Button labels are clear

**Fail Criteria:**
- Buttons not rendered
- Buttons appear as raw JSON

---

### TEST-CF-008: Message Ordering Consistency
**Steps:**
1. Send 5 messages in a session
2. Refresh page or re-fetch conversation

**Pass Criteria:**
- Messages appear in exact same order
- Timestamps are consistent
- No phantom messages appear

**Fail Criteria:**
- Order changes
- Messages missing or duplicated

---

### TEST-CF-009: Assistant Streaming (if implemented)
**Steps:**
1. Send a message that triggers a long response

**Pass Criteria:**
- Response appears progressively (if streaming enabled)
- OR response appears all at once after loading
- No partial/corrupted responses

**Fail Criteria:**
- Partial response shown as final
- Stream interruption causes corruption

---

### TEST-CF-010: Token Usage Display
**Steps:**
1. Start session
2. Send several messages
3. Check token usage display in header

**Pass Criteria:**
- Token count increases with each exchange
- Display is accurate (within reasonable margin)
- Format is human-readable

**Fail Criteria:**
- Token count doesn't update
- Shows NaN or undefined

---

## 3. Button Interaction Tests

### TEST-BI-001: Single Button Click
**Preconditions:** Message with buttons is displayed

**Steps:**
1. Click on one of the displayed buttons

**Pass Criteria:**
- Button click registers immediately
- User's selection appears as a message in conversation
- Loading state shows while processing
- Assistant responds to the button selection
- Buttons disappear or become disabled after selection

**Fail Criteria:**
- Click doesn't register
- Selection not shown in conversation
- Multiple selections possible
- 500 error on button click API

---

### TEST-BI-002: Button with Custom Value
**Steps:**
1. When presented with buttons, type custom response instead
2. Send the custom message

**Pass Criteria:**
- Custom message is accepted
- System processes it appropriately
- Not forced to use buttons

**Fail Criteria:**
- Custom input blocked
- System crashes without button selection

---

### TEST-BI-003: Button Keyboard Navigation
**Steps:**
1. When buttons displayed, use Tab to navigate
2. Press Enter/Space to select

**Pass Criteria:**
- Buttons are focusable
- Keyboard selection works
- Visual focus indicator visible

**Fail Criteria:**
- Buttons not keyboard accessible

---

### TEST-BI-004: Multiple Button Sets in Conversation
**Steps:**
1. Progress through conversation until multiple button-response pairs exist
2. Scroll up to view previous button selections

**Pass Criteria:**
- Previous selections are visible
- Old buttons show selected state
- Current buttons are clearly distinguished

**Fail Criteria:**
- Previous buttons still clickable
- UI confusion about current vs past

---

### TEST-BI-005: Button Click During Loading
**Steps:**
1. Click a button
2. Immediately try to click another button while loading

**Pass Criteria:**
- Second click is prevented
- Clear loading indicator
- No double submissions

**Fail Criteria:**
- Multiple API calls
- Race condition errors

---

### TEST-BI-006: Button Response Updates Candidate
**Steps:**
1. Answer buttons that narrow down the idea (e.g., product type, target customer)
2. Observe candidate panel

**Pass Criteria:**
- Candidate panel updates with new information
- Confidence score may change
- Changes are persisted to database

**Fail Criteria:**
- Candidate panel doesn't update
- Data lost on refresh

---

## 4. Form Handling Tests

### TEST-FH-001: Form Display
**Preconditions:** Conversation reaches point where form is presented

**Steps:**
1. Progress through conversation until a form is displayed

**Pass Criteria:**
- Form renders correctly with all fields
- Field labels are clear
- Required fields are marked
- Submit button is visible

**Fail Criteria:**
- Form doesn't render
- JSON shown instead of form

---

### TEST-FH-002: Form Validation
**Steps:**
1. When form is displayed, submit with empty required fields
2. Fill with invalid data types where applicable

**Pass Criteria:**
- Validation errors shown
- Form doesn't submit until valid
- Errors are specific and helpful

**Fail Criteria:**
- Invalid data accepted
- Generic/unclear errors

---

### TEST-FH-003: Form Submission
**Steps:**
1. Fill all form fields with valid data
2. Click Submit

**Pass Criteria:**
- Form data sent to API
- Confirmation or next step shown
- Data correctly stored
- Form cleared or hidden after submission

**Fail Criteria:**
- 500 error on form submit
- Data lost
- Form stuck in loading

---

### TEST-FH-004: Form Field Types
**Steps:**
1. Interact with different field types: text, number, dropdown, checkbox, radio

**Pass Criteria:**
- Each field type works correctly
- Values are captured accurately
- UI feedback for selections

**Fail Criteria:**
- Field type doesn't function
- Wrong value captured

---

## 5. Candidate Management Tests

### TEST-CM-001: Candidate Panel Visibility
**Steps:**
1. Start session and progress until confidence threshold met (30%+)
2. Observe right panel

**Pass Criteria:**
- Candidate panel becomes visible when confidence >= 30%
- Shows title (even if placeholder)
- Shows confidence percentage
- Shows viability percentage

**Fail Criteria:**
- Panel doesn't appear at threshold
- Panel appears too early
- Missing metrics

---

### TEST-CM-002: Candidate Title Generation
**Steps:**
1. Provide enough information for idea title generation

**Pass Criteria:**
- Title appears in candidate panel
- Title is descriptive and relevant
- Title updates as idea evolves

**Fail Criteria:**
- No title generated
- Generic/irrelevant title

---

### TEST-CM-003: Candidate Summary Generation
**Steps:**
1. Develop idea until summary is generated

**Pass Criteria:**
- 1-2 sentence summary appears
- Summary captures essence of idea
- Summary is coherent

**Fail Criteria:**
- No summary
- Incoherent summary

---

### TEST-CM-004: Confidence Score Updates
**Steps:**
1. Track confidence score through conversation
2. Provide information that should increase confidence (specific problem, target user, etc.)

**Pass Criteria:**
- Confidence increases as more information provided
- Increases are reasonable (not jumping erratically)
- Score reflects confidence breakdown components

**Fail Criteria:**
- Score doesn't change
- Score decreases when it shouldn't
- Score shows NaN or errors

---

### TEST-CM-005: Viability Score and Risks
**Steps:**
1. Propose an idea with potential viability concerns
2. Observe viability score and risk list

**Pass Criteria:**
- Viability score shown (0-100)
- Risk items listed with descriptions
- Risks are relevant to the idea

**Fail Criteria:**
- No viability shown
- Risks don't match idea
- Always shows 100% viability

---

### TEST-CM-006: Capture Idea Button
**Preconditions:** Confidence >= 60% (capture threshold)

**Steps:**
1. Develop idea to capture threshold
2. Click "Capture" or equivalent button

**Pass Criteria:**
- Capture button is enabled at threshold
- Clicking creates new idea in system
- User redirected to idea detail page
- Session marked as completed
- Candidate linked to new idea

**Fail Criteria:**
- Button disabled at threshold
- Capture fails
- No idea created
- Session status incorrect

---

### TEST-CM-007: Save for Later
**Steps:**
1. Develop idea partially
2. Click "Save for Later" button

**Pass Criteria:**
- Session preserved with current state
- Confirmation shown
- Can resume later (if implemented)

**Fail Criteria:**
- Data lost
- Error on save

---

### TEST-CM-008: Discard Candidate
**Steps:**
1. Develop candidate
2. Click "Discard" or "Start Over"

**Pass Criteria:**
- Candidate cleared from panel
- Can continue conversation
- Old candidate data cleared

**Fail Criteria:**
- Candidate persists
- Session corrupted

---

## 6. Confidence & Viability Calculation Tests

### TEST-CV-001: Problem Definition Score
**Steps:**
1. Start session
2. Describe a frustration with high severity
3. Observe confidence breakdown

**Pass Criteria:**
- Problem Definition component increases (up to 25 points)
- Higher severity = higher score
- Market validation adds more points

**Fail Criteria:**
- No change despite input
- Score calculation error (NaN)

---

### TEST-CV-002: Target User Score
**Steps:**
1. Specify customer type (B2B/B2C)
2. Specify location/geography

**Pass Criteria:**
- Target User component increases (up to 20 points)
- Specific target = higher score

**Fail Criteria:**
- No change
- Wrong component updated

---

### TEST-CV-003: Solution Direction Score
**Steps:**
1. Specify product type (digital/physical/service)
2. Specify technical depth

**Pass Criteria:**
- Solution Direction component increases (up to 20 points)
- Concrete direction = higher score

**Fail Criteria:**
- No change
- Calculation error

---

### TEST-CV-004: Differentiation Score
**Steps:**
1. Discuss competitors
2. Identify gaps in competitor offerings

**Pass Criteria:**
- Differentiation component increases (up to 20 points)
- Competitor awareness adds points
- Gap identification adds points

**Fail Criteria:**
- No change
- Score doesn't reflect differentiation

---

### TEST-CV-005: User Fit Score
**Steps:**
1. Discuss skills relevant to the idea
2. Express resonance/excitement about the idea

**Pass Criteria:**
- User Fit component increases (up to 15 points)
- Skills match adds points
- User confirmations add points

**Fail Criteria:**
- No change
- Profile not considered

---

### TEST-CV-006: Null Data Handling
**Steps:**
1. Start session
2. Check initial confidence calculation
3. Progress with minimal/no structured data

**Pass Criteria:**
- No crashes due to null/undefined
- Confidence starts at 0 or low value
- Missing areas are listed

**Fail Criteria:**
- TypeError: Cannot read properties of undefined
- NaN in scores
- 500 errors

---

## 7. Memory Persistence Tests

### TEST-MP-001: Self-Discovery Memory
**Steps:**
1. Share frustrations, expertise, skills, constraints
2. Check database for self_discovery memory file

**Pass Criteria:**
- Data persisted in ideation_memory_files table
- Markdown format is valid
- All shared information captured

**Fail Criteria:**
- Data not saved
- Data corrupted

---

### TEST-MP-002: Market Discovery Memory
**Steps:**
1. Discuss competitors, gaps, location context
2. Verify market_discovery memory file

**Pass Criteria:**
- Competitors, gaps stored correctly
- Location context captured

**Fail Criteria:**
- Data missing or corrupted

---

### TEST-MP-003: Narrowing State Memory
**Steps:**
1. Make decisions about customer type, geography, product type
2. Verify narrowing_state memory file

**Pass Criteria:**
- Decisions captured with confidence levels
- State progresses logically

**Fail Criteria:**
- Decisions lost
- State inconsistent

---

### TEST-MP-004: Memory Retrieval on Handoff
**Steps:**
1. Progress session to point where handoff might occur
2. Verify handoff notes are generated

**Pass Criteria:**
- Handoff notes summarize session state
- Next agent can understand context

**Fail Criteria:**
- Notes missing
- Notes incomplete

---

## 8. Error Handling Tests

### TEST-EH-001: API Timeout
**Steps:**
1. Simulate slow API response (network throttling)
2. Send message and wait

**Pass Criteria:**
- Loading indicator persists
- Eventually shows timeout error
- Can retry or refresh

**Fail Criteria:**
- Hangs indefinitely
- Crashes

---

### TEST-EH-002: Network Disconnection
**Steps:**
1. Start session
2. Disable network
3. Try to send message
4. Re-enable network

**Pass Criteria:**
- Clear offline error shown
- Message not lost
- Recovers when online

**Fail Criteria:**
- Message lost
- Session corrupted
- No recovery

---

### TEST-EH-003: Invalid Session ID
**Steps:**
1. Manually call API with invalid session ID

**Pass Criteria:**
- 404 error returned
- Clear error message
- No crash

**Fail Criteria:**
- 500 error
- Unclear error

---

### TEST-EH-004: Database Error Recovery
**Steps:**
1. Simulate database unavailability
2. Attempt operations

**Pass Criteria:**
- Graceful error messages
- System recovers when DB returns

**Fail Criteria:**
- Crash
- Data corruption

---

### TEST-EH-005: Malformed API Response
**Steps:**
1. Test system resilience to malformed responses (via mocking if possible)

**Pass Criteria:**
- Errors caught and handled
- User sees friendly error

**Fail Criteria:**
- Raw error shown
- UI breaks

---

### TEST-EH-006: Rate Limiting
**Steps:**
1. Send many requests rapidly

**Pass Criteria:**
- Rate limited gracefully
- Clear feedback to user
- No data loss

**Fail Criteria:**
- System crashes
- Requests lost without feedback

---

## 9. UI Component Tests

### TEST-UI-001: Message List Rendering
**Steps:**
1. Load conversation with 10+ messages
2. Scroll through messages

**Pass Criteria:**
- All messages rendered
- Scroll is smooth
- User/assistant messages visually distinct

**Fail Criteria:**
- Messages missing
- Scroll broken
- No visual distinction

---

### TEST-UI-002: Input Field Behavior
**Steps:**
1. Type in input field
2. Test multiline input (Shift+Enter)
3. Submit with Enter

**Pass Criteria:**
- Input accepts text
- Multiline works
- Submit clears input

**Fail Criteria:**
- Input unresponsive
- Submit doesn't clear

---

### TEST-UI-003: Loading States
**Steps:**
1. Observe loading states during session start
2. Observe loading during message send

**Pass Criteria:**
- Clear loading indicators
- UI not frozen during load
- Smooth transitions

**Fail Criteria:**
- No loading feedback
- UI freezes

---

### TEST-UI-004: Error State Display
**Steps:**
1. Trigger an error condition

**Pass Criteria:**
- Error message is visible
- Error is descriptive
- Recovery option available

**Fail Criteria:**
- Silent failure
- Unhelpful error message

---

### TEST-UI-005: Responsive Layout
**Steps:**
1. Test on different viewport sizes
2. Test mobile dimensions

**Pass Criteria:**
- Layout adapts
- No horizontal scroll
- All features accessible

**Fail Criteria:**
- Broken layout
- Features inaccessible

---

### TEST-UI-006: Candidate Panel Layout
**Steps:**
1. View candidate panel with all data populated

**Pass Criteria:**
- All metrics visible
- Actions buttons accessible
- No overflow issues

**Fail Criteria:**
- Content cut off
- Buttons hidden

---

### TEST-UI-007: Session Header
**Steps:**
1. View session header during active session

**Pass Criteria:**
- Session ID displayed
- Token usage shown
- Action buttons (abandon, minimize) visible

**Fail Criteria:**
- Missing information
- Buttons not working

---

### TEST-UI-008: Accessibility
**Steps:**
1. Navigate using only keyboard
2. Check color contrast
3. Test with screen reader (if possible)

**Pass Criteria:**
- All interactive elements focusable
- Focus visible
- Adequate contrast

**Fail Criteria:**
- Elements unreachable by keyboard
- Poor contrast

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Server running on port 3001 (`npm run server`)
- [ ] Frontend running on port 3000 (`npm run dev`)
- [ ] Database migrated (`npm run migrate`)
- [ ] At least one profile exists (`npm run profile create`)
- [ ] Chrome with Claude in Chrome extension active

### Critical Path (Must Pass)
1. TEST-SL-001: Navigate to Ideation Page
2. TEST-SL-002: Start Session with Profile
3. TEST-CF-001: Send First Message
4. TEST-CF-002: Multi-Turn Conversation
5. TEST-BI-001: Single Button Click
6. TEST-CM-001: Candidate Panel Visibility
7. TEST-CM-006: Capture Idea Button

### Regression Tests (After Code Changes)
- All tests in category matching changed code
- Critical Path tests
- TEST-CV-006: Null Data Handling

---

## Appendix: Test Data

### Sample Messages for Testing

**Discover Mode Opening:**
- "I'm frustrated with how hard it is to find parking in the city"
- "I've been thinking about problems in the healthcare space"
- "I have experience in machine learning and want to build something useful"

**Narrowing Responses:**
- Customer type: "I think B2B would be better because businesses have budget"
- Geography: "I want to focus on Sydney, Australia"
- Product type: "A mobile app would be most accessible"

**Validation Triggers:**
- "Is this a good idea?"
- "What are the risks?"
- "How do I know if this will work?"

### Expected API Responses

**Start Session (POST /api/ideation/start):**
```json
{
  "sessionId": "uuid-here",
  "greeting": "Welcome message...",
  "buttons": [{"id": "opt1", "label": "Option 1"}, ...]
}
```

**Send Message (POST /api/ideation/message):**
```json
{
  "reply": "Assistant response...",
  "messageId": "uuid-here",
  "buttons": null,
  "form": null,
  "confidence": 35,
  "viability": 100,
  "risks": [],
  "candidateUpdate": {...}
}
```

---

---

## 10. Full Journey E2E Tests

These tests simulate a complete user journey through the ideation process, from no idea to captured idea.

### TEST-E2E-001: Complete Ideation Journey (Discover Mode)
**Priority:** Critical
**Duration:** 10-15 minutes
**Goal:** Start with no idea, develop one through conversation, reach capture threshold

**Persona:** "Alex" - A software developer who is frustrated with existing tools but doesn't have a specific idea yet.

**Steps:**
1. Navigate to `/ideate`
2. Select a profile
3. Click "Guided Discovery" mode
4. Respond to ideation agent's questions following the conversation script below
5. Continue until confidence reaches 60%+
6. Click "Capture" to save the idea
7. Verify idea appears in idea list

**Conversation Script (Testing Agent Responses):**
```
PHASE 1: Opening (Agent asks about frustrations/interests)
- Respond: "I'm really frustrated with how hard it is to find good documentation for open source projects. I spend hours searching through outdated wikis and scattered README files."

PHASE 2: Exploration (Agent asks follow-up questions)
- If asked about who has this problem: "Other developers like me, especially those new to a project or junior developers joining teams"
- If asked about current solutions: "There's official docs, Stack Overflow, GitHub issues, but they're all fragmented and often outdated"
- If asked about severity: "It's a daily frustration - probably wastes 2-3 hours per week"

PHASE 3: Narrowing (Agent presents options or asks specifics)
- If asked B2B vs B2C: "B2B would be better - companies pay for developer tools"
- If asked about geography: "Start with English-speaking markets, so US/UK/Australia"
- If asked about product type: "A browser extension or web app that aggregates and organizes documentation"

PHASE 4: Validation (Agent may challenge or ask about differentiation)
- If asked about competitors: "There's DevDocs and Dash, but they just aggregate official docs without adding context or community knowledge"
- If asked about your skills: "I can build web apps, I know JavaScript and Python well"
- If asked about commitment: "I could spend 10-15 hours per week on this"

PHASE 5: Refinement (Agent helps polish the idea)
- Respond positively to suggestions that align with the idea
- Express enthusiasm when the idea crystallizes
```

**Pass Criteria:**
- Session starts successfully
- Conversation progresses through multiple phases
- Confidence score increases throughout (track: 0% → 30% → 50% → 60%+)
- Candidate panel shows meaningful title and summary
- Capture button becomes enabled
- Idea is successfully captured and appears in system
- No errors throughout the journey

**Fail Criteria:**
- Session fails to start
- Conversation gets stuck or loops
- Confidence doesn't increase despite providing information
- Capture fails
- Any 500 errors or console errors

---

### TEST-E2E-002: Complete Ideation Journey (Have Idea Mode)
**Priority:** Critical
**Duration:** 8-12 minutes
**Goal:** Start with a rough idea, refine it through conversation, reach capture threshold

**Persona:** "Jordan" - Has a vague idea about a fitness app but needs help refining it.

**Steps:**
1. Navigate to `/ideate`
2. Select a profile
3. Click "I Have an Idea" mode
4. Present initial idea and respond to refinement questions
5. Continue until confidence reaches 60%+
6. Capture the idea

**Conversation Script:**
```
OPENING:
- "I want to build a fitness app that helps people who hate going to the gym find alternative ways to exercise"

REFINEMENT:
- Target user: "People aged 25-40 who want to be fit but find gyms intimidating or boring"
- Problem validation: "Gym memberships have high dropout rates, people feel judged, and traditional fitness apps assume you have equipment"
- Solution direction: "A mobile app that suggests exercises you can do anywhere - parks, home, office - with no equipment"
- Differentiation: "Unlike Nike Training Club or Peloton, this is specifically for gym-avoiders and focuses on outdoor/anywhere exercises"
- Business model: "Freemium - basic exercises free, premium for personalized plans"
```

**Pass Criteria:**
- Same as TEST-E2E-001
- Initial idea is acknowledged and built upon
- Refinement questions are relevant to the presented idea

---

### TEST-E2E-003: Idea Development with Viability Concerns
**Priority:** High
**Duration:** 10-15 minutes
**Goal:** Test that viability warnings appear and can be addressed

**Persona:** "Sam" - Has an ambitious idea that may trigger viability concerns.

**Conversation Script:**
```
OPENING:
- "I want to build an AI that can replace all doctors and provide free healthcare to everyone"

EXPECTED VIABILITY CONCERNS:
- Technical complexity (AI diagnosis is extremely hard)
- Regulatory issues (medical devices require FDA approval)
- Resource mismatch (needs massive funding and expertise)

PIVOT/REFINEMENT:
- When concerns raised: "Okay, maybe I should narrow it down. What if it just helped with initial symptom checking before seeing a doctor?"
- Continue narrowing until idea becomes viable
```

**Pass Criteria:**
- Viability score drops when unrealistic idea presented
- Risk items appear with relevant concerns
- Agent guides toward more realistic version
- Confidence can still reach threshold after pivoting

---

### TEST-E2E-004: Session Abandonment and Recovery
**Priority:** Medium
**Duration:** 5-8 minutes
**Goal:** Test partial progress, abandonment, and starting fresh

**Steps:**
1. Start session, exchange 3-4 messages
2. Note the confidence level reached
3. Click Abandon
4. Start new session
5. Verify new session is clean (no carryover from abandoned session)

**Pass Criteria:**
- Abandonment works without errors
- New session starts fresh
- No data leakage between sessions

---

## Testing Agent Interaction Guide

### How to Respond to the Ideation Agent

The ideation agent asks dynamic questions. The testing agent must respond appropriately to drive toward the test goal.

#### Response Strategy by Question Type

**1. Open-ended exploration questions**
```
Agent: "What frustrates you in your daily work or life?"
Agent: "What problems do you see that need solving?"
Agent: "What are you passionate about?"

Strategy: Give specific, detailed answers with concrete examples.
Example: "I'm frustrated that [specific problem] because [impact]. For example, [concrete situation]."
```

**2. Clarification questions**
```
Agent: "Can you tell me more about that?"
Agent: "What do you mean by [X]?"
Agent: "Who specifically experiences this problem?"

Strategy: Expand with more detail, narrow the scope.
Example: "Specifically, I mean [narrower definition]. The people who have this most are [specific demographic]."
```

**3. Multiple choice / Button options**
```
Agent: [Presents buttons: "B2B", "B2C", "Both"]
Agent: [Presents buttons: "Digital Product", "Physical Product", "Service"]

Strategy: Choose the option that best fits the test persona's goal.
Click the button rather than typing (tests button functionality).
```

**4. Validation questions**
```
Agent: "How do you know this is a real problem?"
Agent: "Have you talked to potential users?"
Agent: "What evidence do you have?"

Strategy: Provide reasonable validation evidence (personal experience, observed behavior, industry stats).
Example: "I've experienced this myself, and I've seen 3 colleagues struggle with the same issue. Also, [relevant statistic if known]."
```

**5. Competitive landscape questions**
```
Agent: "What solutions already exist?"
Agent: "How is this different from [competitor]?"

Strategy: Acknowledge competitors, highlight gaps.
Example: "Yes, [Competitor] exists, but they [limitation]. My approach would [differentiation]."
```

**6. Skills/Fit questions**
```
Agent: "Do you have the skills to build this?"
Agent: "How much time can you commit?"

Strategy: Be honest but positive. Match the profile's skills.
Example: "I can build [relevant skill]. I have [X] hours per week. I'd need help with [gap]."
```

**7. Challenge/Pushback questions**
```
Agent: "This seems very competitive. Are you sure?"
Agent: "This might be too complex. Have you considered..."

Strategy: Either defend with reasoning OR accept the feedback and pivot.
Example (defend): "I understand, but I think [differentiation] gives me an edge."
Example (pivot): "You're right, maybe I should focus on [narrower scope] instead."
```

#### Conversation Flow Patterns

```
TYPICAL SUCCESSFUL FLOW:
1. [Agent] Greeting + open question
2. [User] Share frustration/idea (be specific)
3. [Agent] Follow-up question
4. [User] Provide more detail
5. [Agent] Present narrowing options (buttons)
6. [User] Click button OR type choice
7. [Agent] Ask about target user
8. [User] Define target user specifically
9. [Agent] Ask about differentiation/competitors
10. [User] Explain competitive advantage
11. [Agent] May challenge or validate
12. [User] Respond to challenge
13. [Agent] Summarize emerging idea
14. [User] Confirm or refine
15. Repeat 13-14 until confidence threshold reached
16. [User] Click Capture when enabled
```

#### Handling Unexpected Agent Responses

```
IF agent asks something unexpected:
- Stay in character with your persona
- Provide a reasonable answer that moves toward your goal
- If completely stuck, give a generic positive response and see if agent redirects

IF agent seems to loop or repeat:
- Try a different type of response
- Provide new information not yet shared
- If still looping, this may indicate a bug - log it

IF agent goes off-topic:
- Gently redirect: "That's interesting, but I'm more focused on [original topic]"
- This tests the agent's ability to stay on track

IF agent presents form instead of conversation:
- Fill out the form fields appropriately for your persona
- Submit and continue conversation
```

#### Test-Specific Goals

| Test | Goal | Target Confidence | Key Milestones |
|------|------|-------------------|----------------|
| E2E-001 | Full journey from frustration to idea | 60%+ | Problem defined, user identified, solution direction, differentiation |
| E2E-002 | Refine existing idea | 60%+ | Idea clarified, validated, refined |
| E2E-003 | Handle viability concerns | 60%+ | Concerns raised, addressed, idea pivoted |
| E2E-004 | Test abandonment | N/A | Session properly abandoned |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-31 | Initial test plan |
| 1.1 | 2025-12-31 | Added dependencies, automation notes |
| 1.2 | 2025-12-31 | Added full journey E2E tests and interaction guide |
