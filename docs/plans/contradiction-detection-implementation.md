# Implementation Plan: Automatic Contradiction & Decision Evolution Detection

## Overview

**Goal**: Automatically detect when a user changes their mind during a conversation (e.g., "Let's use React" → "Actually, Vue is better") and create proper `supersedes` relationships in the knowledge graph.

**Current State**: Contradictions are detected via a separate `contradiction-scan` task, not inline during synthesis.

**Target State**: The conversation synthesizer and analysis pipeline automatically detect decision evolution and create `supersedes` links with the old decision marked as `superseded`.

---

## Task Breakdown

### Task 1: Enhance Conversation Synthesizer Prompt for Decision Evolution

**File**: `server/services/graph/conversation-synthesizer.ts`

**Changes**:

1. Update `SYNTHESIS_SYSTEM_PROMPT` to detect decision-changing language
2. Add output field for `supersedes` relationships
3. Track decision topics for conflict detection within same category

**Implementation**:

```typescript
// Add to SYNTHESIS_SYSTEM_PROMPT (around line 84)
const SYNTHESIS_SYSTEM_PROMPT = `You are a knowledge extraction specialist...

CRITICAL: DECISION EVOLUTION DETECTION
When extracting DECISIONS, you MUST detect when a later statement changes or reverses an earlier decision:

Decision-changing indicators:
- "actually", "on second thought", "instead", "let's change", "I've decided against"
- "rather than", "forget that", "scratch that", "new plan", "better idea"
- Direct contradiction of earlier stated preference

When you detect decision evolution:
1. Extract BOTH the original decision AND the new decision
2. Mark the relationship as "supersedes"
3. Include the reasoning for the change

Output format for superseded decisions:
{
  "id": "insight_xxx",
  "type": "decision",
  "content": "Use Vue.js for frontend",
  "supersedes": {
    "insightId": "insight_yyy",  // ID of the earlier decision being replaced
    "reason": "User reconsidered after discussing bundle size concerns"
  }
}
`;
```

**Test Script**: `tests/unit/conversation-synthesizer-supersession.test.ts`

```typescript
import { synthesizeConversation } from "../../../server/services/graph/conversation-synthesizer";

describe("Conversation Synthesizer - Decision Evolution", () => {
  // Mock the database and Anthropic client

  test('detects simple decision change with "actually"', async () => {
    const messages = [
      { role: "user", content: "Let's build the frontend with React" },
      {
        role: "assistant",
        content: "Great choice! React has a large ecosystem.",
      },
      {
        role: "user",
        content: "Actually, let's use Vue instead. It's simpler for our needs.",
      },
    ];

    const result = await synthesizeConversation("test-session", messages);

    // Should have 2 decisions
    const decisions = result.insights.filter((i) => i.type === "decision");
    expect(decisions.length).toBe(2);

    // The Vue decision should supersede the React decision
    const vueDecision = decisions.find((d) => d.content.includes("Vue"));
    expect(vueDecision.supersedes).toBeDefined();
    expect(vueDecision.supersedes.reason).toContain("simpler");
  });

  test('detects decision change with "on second thought"', async () => {
    const messages = [
      { role: "user", content: "We should use MongoDB for the database" },
      {
        role: "user",
        content:
          "On second thought, PostgreSQL would be better for our relational data",
      },
    ];

    const result = await synthesizeConversation("test-session", messages);

    const decisions = result.insights.filter((i) => i.type === "decision");
    const pgDecision = decisions.find((d) => d.content.includes("PostgreSQL"));
    expect(pgDecision.supersedes).toBeDefined();
  });

  test('detects decision change with "instead"', async () => {
    const messages = [
      { role: "user", content: "Let's charge $10/month for the subscription" },
      {
        role: "user",
        content: "Instead, let's do $15/month to cover infrastructure costs",
      },
    ];

    const result = await synthesizeConversation("test-session", messages);

    const decisions = result.insights.filter((i) => i.type === "decision");
    expect(decisions.some((d) => d.supersedes)).toBe(true);
  });

  test("does NOT flag unrelated decisions as superseding", async () => {
    const messages = [
      { role: "user", content: "Let's use React for frontend" },
      { role: "user", content: "For the backend, let's use Node.js" },
    ];

    const result = await synthesizeConversation("test-session", messages);

    const decisions = result.insights.filter((i) => i.type === "decision");
    // Neither should supersede the other - different topics
    expect(decisions.every((d) => !d.supersedes)).toBe(true);
  });

  test("handles multiple decision changes in sequence", async () => {
    const messages = [
      { role: "user", content: "Let's use AWS" },
      { role: "user", content: "Actually, GCP might be better" },
      {
        role: "user",
        content: "Wait, let's go back to AWS, they have better ML services",
      },
    ];

    const result = await synthesizeConversation("test-session", messages);

    const decisions = result.insights.filter((i) => i.type === "decision");
    // Should have chain: AWS -> GCP -> AWS (final)
    expect(decisions.length).toBe(3);
    // Final AWS decision should supersede GCP
    // GCP decision should supersede first AWS
  });
});
```

**Pass Criteria**:

- [ ] All 5 test cases pass
- [ ] Synthesis correctly identifies decision-changing language
- [ ] `supersedes` field is populated with insightId and reason
- [ ] Unrelated decisions are NOT linked

**Expected Outcome**:

- Synthesized insights include `supersedes` metadata when applicable
- Chain of decision evolution is captured (A → B → C)

---

### Task 2: Update Insight Type Definition

**File**: `server/services/graph/conversation-synthesizer.ts`

**Changes**:
Add `supersedes` field to the `ConversationInsight` interface.

```typescript
// Update interface (around line 40)
export interface ConversationInsight {
  id: string;
  type: InsightType;
  title: string;
  content: string;
  sourceContext: string;
  confidence: number;
  // NEW: Track decision evolution
  supersedes?: {
    insightId: string;
    reason: string;
  };
}
```

**Test Script**: Type checking via TypeScript compilation

```bash
npx tsc --noEmit server/services/graph/conversation-synthesizer.ts
```

**Pass Criteria**:

- [ ] TypeScript compiles without errors
- [ ] `supersedes` field is optional (doesn't break existing code)

**Expected Outcome**:

- Type system supports supersession tracking

---

### Task 3: Update Analysis Prompt Builder to Handle Supersession

**File**: `server/services/graph/analysis-prompt-builder.ts`

**Changes**:

1. When building the prompt, include supersession info from synthesized insights
2. Update output schema to include `supersedes` links
3. Instruct AI to create proper link type

```typescript
// Update buildAnalysisPrompt function
// Add to the source formatting section (around line 180)

function formatConversationInsightSource(source: CollectedSource): string {
  let formatted = `### Insight: ${source.metadata.title || source.id}
Type: ${source.metadata.insightType || 'unknown'}
Confidence: ${source.weight}
Content: ${source.content}`;

  // Include supersession info if present
  if (source.metadata.supersedes) {
    formatted += `
SUPERSEDES: ${source.metadata.supersedes.insightId}
REASON: ${source.metadata.supersedes.reason}`;
  }

  return formatted;
}

// Update instruction section to handle supersedes
const instructionSection = `## INSTRUCTIONS
...
7. When a source indicates it SUPERSEDES another insight:
   - Create the new block with status "active"
   - Create a "supersedes" link from new block to the superseded block
   - The superseded block should be marked for status change to "superseded"
...`;

// Update ProposedChange schema (around line 420)
export interface ProposedChange {
  ...
  // NEW: For supersession handling
  supersedesBlockId?: string;  // If this change supersedes an existing block
  statusChange?: {
    blockId: string;
    newStatus: 'superseded' | 'abandoned';
    reason: string;
  };
}
```

**Test Script**: `tests/unit/analysis-prompt-builder-supersession.test.ts`

```typescript
import {
  buildAnalysisPrompt,
  parseAnalysisResponse,
} from "../../../server/services/graph/analysis-prompt-builder";

describe("Analysis Prompt Builder - Supersession", () => {
  test("includes supersession info in formatted prompt", () => {
    const sources = [
      {
        id: "insight_vue",
        type: "conversation_insight",
        content: "Use Vue.js for frontend development",
        weight: 0.9,
        metadata: {
          insightType: "decision",
          supersedes: {
            insightId: "insight_react",
            reason: "Simpler learning curve for the team",
          },
        },
      },
    ];

    const prompt = buildAnalysisPrompt(
      {
        sources,
        totalTokenEstimate: 100,
        truncated: false,
        collectionMetadata: {},
      },
      [],
    );

    expect(prompt.userPrompt).toContain("SUPERSEDES: insight_react");
    expect(prompt.userPrompt).toContain("Simpler learning curve");
  });

  test("parses supersedes link from AI response", () => {
    const aiResponse = `{
      "context": { "who": "User", "what": "Tech decisions", "when": "now", "where": "chat", "why": "planning" },
      "proposedChanges": [
        {
          "id": "block_vue",
          "type": "create_block",
          "blockType": "decision",
          "content": "Use Vue.js for frontend",
          "confidence": 0.9,
          "supersedesBlockId": "block_react"
        },
        {
          "id": "link_supersedes",
          "type": "create_link",
          "sourceBlockId": "block_vue",
          "targetBlockId": "block_react",
          "linkType": "supersedes",
          "reason": "User changed preference"
        }
      ],
      "cascadeEffects": []
    }`;

    const parsed = parseAnalysisResponse(aiResponse);

    expect(parsed.proposedChanges).toHaveLength(2);
    const link = parsed.proposedChanges.find((c) => c.type === "create_link");
    expect(link.linkType).toBe("supersedes");
  });

  test("includes status change for superseded block", () => {
    const aiResponse = `{
      "context": { "who": "User", "what": "Tech", "when": "now", "where": "chat", "why": "plan" },
      "proposedChanges": [
        {
          "id": "change_status",
          "type": "update_block",
          "blockId": "block_react",
          "statusChange": {
            "newStatus": "superseded",
            "reason": "Replaced by Vue decision"
          }
        }
      ],
      "cascadeEffects": []
    }`;

    const parsed = parseAnalysisResponse(aiResponse);

    const statusChange = parsed.proposedChanges.find(
      (c) => c.type === "update_block",
    );
    expect(statusChange.statusChange.newStatus).toBe("superseded");
  });
});
```

**Pass Criteria**:

- [ ] Supersession info is included in formatted prompts
- [ ] AI response with supersedes links parses correctly
- [ ] Status changes for superseded blocks are captured

**Expected Outcome**:

- Analysis pipeline properly handles and outputs supersession relationships

---

### Task 4: Update Apply-Changes Endpoint for Supersession

**File**: `server/routes/ideation/graph-routes.ts`

**Changes**:

1. Handle `supersedesBlockId` in create_block changes
2. Create the supersedes link automatically
3. Update status of superseded blocks

```typescript
// Update apply-changes handler (around line 1107)

// After creating a block, check for supersession
if (change.type === "create_block") {
  const blockId = uuidv4();
  idMapping.set(change.id, blockId);

  // ... existing insert logic ...

  // NEW: Handle supersession
  if (change.supersedesBlockId) {
    const supersededId =
      idMapping.get(change.supersedesBlockId) || change.supersedesBlockId;

    // Create supersedes link
    const linkId = uuidv4();
    await run(
      `INSERT INTO memory_links (id, session_id, source_block_id, target_block_id, link_type, status, confidence, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'supersedes', 'active', 0.95, ?, ?, ?)`,
      [
        linkId,
        sessionId,
        blockId,
        supersededId,
        change.supersessionReason || "Decision changed",
        now,
        now,
      ],
    );
    linksCreated++;

    // Mark superseded block
    await run(
      `UPDATE memory_blocks SET status = 'superseded', updated_at = ? WHERE id = ?`,
      [now, supersededId],
    );

    // Emit WebSocket events
    emitLinkCreated(sessionId, {
      id: linkId,
      link_type: "supersedes",
      source: blockId,
      target: supersededId,
    });
    emitBlockUpdated(sessionId, { id: supersededId, status: "superseded" });
  }
}

// Also handle explicit status changes
if (change.type === "update_block" && change.statusChange) {
  await run(
    `UPDATE memory_blocks SET status = ?, updated_at = ? WHERE id = ?`,
    [change.statusChange.newStatus, now, change.blockId],
  );

  emitBlockUpdated(sessionId, {
    id: change.blockId,
    status: change.statusChange.newStatus,
  });
  blocksUpdated++;
}
```

**Test Script**: `tests/integration/apply-changes-supersession.test.ts`

```typescript
import request from "supertest";
import { app } from "../../../server/api";
import { query, run } from "../../../database/db";

describe("Apply Changes - Supersession", () => {
  const sessionId = "test-session-supersession";

  beforeEach(async () => {
    // Create test session and initial block
    await run(
      `INSERT INTO ideation_sessions (id, user_slug, status) VALUES (?, 'test', 'active')`,
      [sessionId],
    );
    await run(
      `INSERT INTO memory_blocks (id, session_id, type, content, status, created_at, updated_at)
               VALUES ('block_react', ?, 'decision', 'Use React', 'active', datetime('now'), datetime('now'))`,
      [sessionId],
    );
  });

  afterEach(async () => {
    await run(`DELETE FROM memory_links WHERE session_id = ?`, [sessionId]);
    await run(`DELETE FROM memory_blocks WHERE session_id = ?`, [sessionId]);
    await run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
  });

  test("creates supersedes link when supersedesBlockId is provided", async () => {
    const response = await request(app)
      .post(`/api/ideation/session/${sessionId}/graph/apply-changes`)
      .send({
        changeIds: ["new_vue_block"],
        changes: [
          {
            id: "new_vue_block",
            type: "create_block",
            blockType: "decision",
            content: "Use Vue.js instead of React",
            confidence: 0.9,
            supersedesBlockId: "block_react",
            supersessionReason: "Simpler for team",
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.blocksCreated).toBe(1);
    expect(response.body.linksCreated).toBeGreaterThanOrEqual(1);

    // Verify supersedes link was created
    const links = await query(
      `SELECT * FROM memory_links WHERE session_id = ? AND link_type = 'supersedes'`,
      [sessionId],
    );
    expect(links.length).toBe(1);
    expect(links[0].target_block_id).toBe("block_react");

    // Verify old block is marked superseded
    const oldBlock = await query(
      `SELECT status FROM memory_blocks WHERE id = 'block_react'`,
    );
    expect(oldBlock[0].status).toBe("superseded");
  });

  test("handles explicit status change to superseded", async () => {
    const response = await request(app)
      .post(`/api/ideation/session/${sessionId}/graph/apply-changes`)
      .send({
        changeIds: ["status_change"],
        changes: [
          {
            id: "status_change",
            type: "update_block",
            blockId: "block_react",
            statusChange: {
              newStatus: "superseded",
              reason: "Manually marked as replaced",
            },
          },
        ],
      });

    expect(response.status).toBe(200);

    const block = await query(
      `SELECT status FROM memory_blocks WHERE id = 'block_react'`,
    );
    expect(block[0].status).toBe("superseded");
  });

  test("creates proper ID mapping for chained supersession", async () => {
    // Scenario: A -> B -> C (C supersedes B, B supersedes A)
    const response = await request(app)
      .post(`/api/ideation/session/${sessionId}/graph/apply-changes`)
      .send({
        changeIds: ["block_b", "block_c"],
        changes: [
          {
            id: "block_b",
            type: "create_block",
            blockType: "decision",
            content: "Use GCP",
            supersedesBlockId: "block_react", // Note: reusing block_react as "A"
          },
          {
            id: "block_c",
            type: "create_block",
            blockType: "decision",
            content: "Use AWS",
            supersedesBlockId: "block_b", // Supersedes the block we just created
          },
        ],
      });

    expect(response.status).toBe(200);

    // Both B and A should be superseded
    const blocks = await query(
      `SELECT id, status FROM memory_blocks WHERE session_id = ? ORDER BY created_at`,
      [sessionId],
    );
    const supersededCount = blocks.filter(
      (b) => b.status === "superseded",
    ).length;
    expect(supersededCount).toBe(2); // A and B

    // Should have 2 supersedes links
    const links = await query(
      `SELECT * FROM memory_links WHERE session_id = ? AND link_type = 'supersedes'`,
      [sessionId],
    );
    expect(links.length).toBe(2);
  });
});
```

**Pass Criteria**:

- [ ] `supersedesBlockId` creates a supersedes link
- [ ] Superseded block status is updated to "superseded"
- [ ] Chained supersession (A → B → C) works correctly
- [ ] WebSocket events are emitted for both new links and status changes

**Expected Outcome**:

- Applying changes with supersession info automatically creates proper graph structure

---

### Task 5: Update Frontend Type Definitions

**File**: `frontend/src/types/ideation-state.ts`

**Changes**:
Add supersession fields to ProposedChange interface.

```typescript
export interface ProposedChange {
  id: string;
  type: "create_block" | "update_block" | "create_link";
  blockType?: string;
  title?: string;
  content?: string;
  graphMembership?: string[];
  confidence: number;
  sourceMessageId?: string;
  // Link-specific fields
  sourceBlockId?: string;
  targetBlockId?: string;
  linkType?: string;
  reason?: string;
  sourceType?: string;

  // NEW: Supersession fields
  supersedesBlockId?: string;
  supersessionReason?: string;
  statusChange?: {
    blockId: string;
    newStatus: "superseded" | "abandoned";
    reason: string;
  };
}
```

**Test Script**: TypeScript compilation check

```bash
cd frontend && npx tsc --noEmit
```

**Pass Criteria**:

- [ ] TypeScript compiles without errors
- [ ] New fields are optional (backward compatible)

**Expected Outcome**:

- Frontend type system supports supersession data

---

### Task 6: Update ProposedChangesReviewModal UI

**File**: `frontend/src/components/graph/ProposedChangesReviewModal.tsx`

**Changes**:

1. Show supersession indicator on blocks that supersede others
2. Show "will be superseded" warning on affected blocks
3. Visual connection between superseding/superseded pairs

```typescript
// Add visual indicator for supersession (in the change item rendering)

{change.supersedesBlockId && (
  <div className="mt-2 flex items-center gap-2 text-amber-600 text-xs">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    <span>
      Replaces: <code className="bg-amber-100 px-1 rounded">{change.supersedesBlockId.slice(0, 8)}...</code>
      {change.supersessionReason && ` - ${change.supersessionReason}`}
    </span>
  </div>
)}

// Add banner for status changes
{change.type === 'update_block' && change.statusChange && (
  <div className="mt-2 flex items-center gap-2 text-gray-500 text-xs bg-gray-100 px-2 py-1 rounded">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
    </svg>
    <span>Status will change to: <strong>{change.statusChange.newStatus}</strong></span>
  </div>
)}
```

**Test Script**: `tests/e2e/proposed-changes-supersession.spec.ts` (Playwright)

```typescript
import { test, expect } from "@playwright/test";

test.describe("ProposedChangesReviewModal - Supersession UI", () => {
  test("shows supersession indicator", async ({ page }) => {
    // Navigate to ideation session with pending changes
    await page.goto("/ideation/test-session");

    // Trigger graph analysis (mock the response to include supersession)
    await page.evaluate(() => {
      window.__mockProposedChanges = [
        {
          id: "block_new",
          type: "create_block",
          blockType: "decision",
          content: "Use Vue.js",
          confidence: 0.9,
          supersedesBlockId: "block_old",
          supersessionReason: "Better developer experience",
        },
      ];
    });

    // Open the review modal
    await page.click('[data-testid="update-memory-graph"]');
    await page.waitForSelector('[data-testid="proposed-changes-modal"]');

    // Check for supersession indicator
    const indicator = page.locator("text=Replaces:");
    await expect(indicator).toBeVisible();
    await expect(
      page.locator("text=Better developer experience"),
    ).toBeVisible();
  });

  test("shows status change banner", async ({ page }) => {
    await page.goto("/ideation/test-session");

    await page.evaluate(() => {
      window.__mockProposedChanges = [
        {
          id: "status_update",
          type: "update_block",
          blockId: "block_old",
          statusChange: {
            newStatus: "superseded",
            reason: "Replaced by newer decision",
          },
        },
      ];
    });

    await page.click('[data-testid="update-memory-graph"]');
    await page.waitForSelector('[data-testid="proposed-changes-modal"]');

    const banner = page.locator("text=Status will change to:");
    await expect(banner).toBeVisible();
    await expect(page.locator('strong:has-text("superseded")')).toBeVisible();
  });
});
```

**Pass Criteria**:

- [ ] Supersession indicator displays correctly
- [ ] Supersession reason is shown
- [ ] Status change banner is visible
- [ ] UI remains clean and readable

**Expected Outcome**:

- Users can clearly see which decisions are being superseded and why

---

### Task 7: Update GraphTabPanel to Pass Supersession Data

**File**: `frontend/src/components/ideation/GraphTabPanel.tsx`

**Changes**:
Include supersession fields when mapping changes to API format.

```typescript
// In handleApplyConfirmedChanges (around line 442)
selectedChanges.map((c) => ({
  id: c.id,
  type: c.type as "create_block" | "update_block" | "create_link",
  blockType: c.blockType,
  title: c.title,
  content: c.content,
  graphMembership: c.graphMembership,
  confidence: c.confidence,
  sourceBlockId: c.sourceBlockId,
  targetBlockId: c.targetBlockId,
  linkType: c.linkType,
  // NEW: Include supersession fields
  supersedesBlockId: c.supersedesBlockId,
  supersessionReason: c.supersessionReason,
  statusChange: c.statusChange,
}));
```

**Test Script**: Unit test for mapping

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphTabPanel } from "../GraphTabPanel";

describe("GraphTabPanel - Supersession Mapping", () => {
  test("includes supersession fields in API payload", async () => {
    const mockApplyGraphChanges = jest
      .fn()
      .mockResolvedValue({ blocksCreated: 1, linksCreated: 1 });

    // ... setup component with mocked API ...

    // Simulate applying changes with supersession
    const changes = [
      {
        id: "new_block",
        type: "create_block",
        content: "New decision",
        supersedesBlockId: "old_block",
        supersessionReason: "Updated requirement",
      },
    ];

    // Trigger apply
    // ...

    expect(mockApplyGraphChanges).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.arrayContaining([
        expect.objectContaining({
          supersedesBlockId: "old_block",
          supersessionReason: "Updated requirement",
        }),
      ]),
    );
  });
});
```

**Pass Criteria**:

- [ ] Supersession fields are included in API call
- [ ] Null/undefined fields don't break the call

**Expected Outcome**:

- Full supersession data flows from frontend to backend

---

### Task 8: Update useIdeationAPI Hook Type

**File**: `frontend/src/hooks/useIdeationAPI.ts`

**Changes**:
Add supersession fields to the changes type in applyGraphChanges.

```typescript
const applyGraphChanges = useCallback(
  async (
    sessionId: string,
    changeIds: string[],
    changes?: Array<{
      id: string;
      type: "create_block" | "update_block" | "create_link";
      blockType?: string;
      title?: string;
      content?: string;
      graphMembership?: string[];
      confidence?: number;
      sourceMessageId?: string;
      sourceBlockId?: string;
      targetBlockId?: string;
      linkType?: string;
      reason?: string;
      // NEW: Supersession fields
      supersedesBlockId?: string;
      supersessionReason?: string;
      statusChange?: {
        blockId: string;
        newStatus: 'superseded' | 'abandoned';
        reason: string;
      };
    }>,
  )
```

**Pass Criteria**:

- [ ] TypeScript compiles
- [ ] API calls work with new fields

---

### Task 9: Integration Test - Full Supersession Flow

**File**: `tests/integration/full-supersession-flow.test.ts`

**Test Script**:

```typescript
import { synthesizeConversation } from "../../server/services/graph/conversation-synthesizer";
import {
  buildAnalysisPrompt,
  parseAnalysisResponse,
} from "../../server/services/graph/analysis-prompt-builder";
import request from "supertest";
import { app } from "../../server/api";

describe("Full Supersession Flow - E2E", () => {
  const sessionId = "test-full-supersession";

  test("complete flow: synthesis → analysis → apply", async () => {
    // Step 1: Simulate conversation with decision change
    const messages = [
      {
        role: "user",
        content: "For our MVP, let's use Firebase for the backend",
      },
      {
        role: "assistant",
        content: "Firebase is great for rapid prototyping!",
      },
      {
        role: "user",
        content:
          "Actually, I'm worried about vendor lock-in. Let's use Supabase instead - it's open source.",
      },
    ];

    // Step 2: Synthesize conversation
    const synthesisResult = await synthesizeConversation(sessionId, messages);

    // Verify supersession was detected
    const decisions = synthesisResult.insights.filter(
      (i) => i.type === "decision",
    );
    expect(decisions.length).toBe(2);
    const supabaseDecision = decisions.find((d) =>
      d.content.includes("Supabase"),
    );
    expect(supabaseDecision.supersedes).toBeDefined();
    expect(supabaseDecision.supersedes.reason).toContain("vendor lock-in");

    // Step 3: Build analysis prompt
    const sources = synthesisResult.insights.map((i) => ({
      id: i.id,
      type: "conversation_insight",
      content: i.content,
      weight: i.confidence,
      metadata: {
        insightType: i.type,
        supersedes: i.supersedes,
      },
    }));

    const prompt = buildAnalysisPrompt(
      {
        sources,
        totalTokenEstimate: 500,
        truncated: false,
        collectionMetadata: {},
      },
      [], // No existing blocks
    );

    expect(prompt.userPrompt).toContain("SUPERSEDES");

    // Step 4: Mock AI response with proper supersession structure
    const mockAIResponse = {
      context: {
        who: "User",
        what: "Backend decision",
        when: "now",
        where: "chat",
        why: "MVP planning",
      },
      proposedChanges: [
        {
          id: "block_firebase",
          type: "create_block",
          blockType: "decision",
          content: "Use Firebase for backend",
          confidence: 0.8,
        },
        {
          id: "block_supabase",
          type: "create_block",
          blockType: "decision",
          content: "Use Supabase for backend (open source)",
          confidence: 0.9,
          supersedesBlockId: "block_firebase",
          supersessionReason: "Avoids vendor lock-in",
        },
        {
          id: "link_supersedes",
          type: "create_link",
          sourceBlockId: "block_supabase",
          targetBlockId: "block_firebase",
          linkType: "supersedes",
          reason: "User changed decision due to vendor lock-in concerns",
        },
      ],
      cascadeEffects: [],
    };

    const parsed = parseAnalysisResponse(JSON.stringify(mockAIResponse));
    expect(parsed.proposedChanges).toHaveLength(3);

    // Step 5: Apply changes
    const response = await request(app)
      .post(`/api/ideation/session/${sessionId}/graph/apply-changes`)
      .send({
        changeIds: parsed.proposedChanges.map((c) => c.id),
        changes: parsed.proposedChanges,
      });

    expect(response.status).toBe(200);
    expect(response.body.blocksCreated).toBe(2);
    expect(response.body.linksCreated).toBe(1);

    // Step 6: Verify final graph state
    const graphResponse = await request(app).get(
      `/api/ideation/session/${sessionId}/graph`,
    );

    const blocks = graphResponse.body.blocks;
    const links = graphResponse.body.links;

    // Firebase block should be superseded
    const firebaseBlock = blocks.find((b) => b.content.includes("Firebase"));
    expect(firebaseBlock.status).toBe("superseded");

    // Supabase block should be active
    const supabaseBlock = blocks.find((b) => b.content.includes("Supabase"));
    expect(supabaseBlock.status).toBe("active");

    // Supersedes link should exist
    const supersedesLink = links.find((l) => l.linkType === "supersedes");
    expect(supersedesLink).toBeDefined();
    expect(supersedesLink.sourceBlockId).toBe(supabaseBlock.id);
    expect(supersedesLink.targetBlockId).toBe(firebaseBlock.id);
  });
});
```

**Pass Criteria**:

- [ ] Complete flow executes without errors
- [ ] Superseded block has status "superseded"
- [ ] New block has status "active"
- [ ] Supersedes link connects them correctly
- [ ] Link has proper reason/metadata

**Expected Outcome**:

- End-to-end supersession handling works correctly

---

## Summary: Pass Criteria Checklist

| Task | Description                            | Tests Pass | Manual Verification |
| ---- | -------------------------------------- | ---------- | ------------------- |
| 1    | Synthesizer detects decision changes   | [ ]        | [ ]                 |
| 2    | Type definitions updated               | [ ]        | [ ]                 |
| 3    | Analysis prompt handles supersession   | [ ]        | [ ]                 |
| 4    | Apply-changes creates supersedes links | [ ]        | [ ]                 |
| 5    | Frontend types updated                 | [ ]        | [ ]                 |
| 6    | Review modal shows supersession UI     | [ ]        | [ ]                 |
| 7    | GraphTabPanel passes supersession data | [ ]        | [ ]                 |
| 8    | useIdeationAPI hook types updated      | [ ]        | [ ]                 |
| 9    | Full integration flow works            | [ ]        | [ ]                 |

---

## Estimated Complexity

| Task                        | Effort | Risk                      |
| --------------------------- | ------ | ------------------------- |
| 1 - Synthesizer Enhancement | High   | Medium (AI prompt tuning) |
| 2 - Type Definitions        | Low    | Low                       |
| 3 - Analysis Prompt Builder | Medium | Medium                    |
| 4 - Apply-Changes Endpoint  | Medium | Low                       |
| 5 - Frontend Types          | Low    | Low                       |
| 6 - Review Modal UI         | Medium | Low                       |
| 7 - GraphTabPanel           | Low    | Low                       |
| 8 - Hook Types              | Low    | Low                       |
| 9 - Integration Test        | Medium | Low                       |

**Total**: ~2-3 days of focused implementation

---

## Rollback Plan

If issues arise:

1. All changes are additive (new optional fields)
2. Existing flows continue to work without supersession data
3. Can disable AI supersession detection by reverting prompt changes
4. Database schema remains unchanged (uses existing link types and statuses)
