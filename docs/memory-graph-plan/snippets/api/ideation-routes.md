# Ideation Routes Updates

Modify `server/routes/ideation.ts`:

## Context Management Endpoints

```typescript
import { contextManager } from "../../agents/ideation/context-manager";

/**
 * GET /api/ideation/session/:sessionId/context-status
 * Check if context limit is approaching
 */
router.get("/session/:sessionId/context-status", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tokensUsed, tokenLimit } = req.query;

    const status = contextManager.checkContextStatus(
      Number(tokensUsed) || 0,
      Number(tokenLimit) || 100000,
    );

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to check context status" });
  }
});

/**
 * POST /api/ideation/session/:sessionId/save-to-graph
 * Save conversation insights to memory graph
 */
router.post("/session/:sessionId/save-to-graph", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { ideaId } = req.body;

    if (!ideaId) {
      return res.status(400).json({ error: "ideaId is required" });
    }

    const result = await contextManager.saveConversationToGraph(
      sessionId,
      ideaId,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to save to graph" });
  }
});

/**
 * GET /api/ideation/idea/:ideaId/session-context
 * Get context from graph for new session
 */
router.get("/idea/:ideaId/session-context", async (req, res) => {
  try {
    const { ideaId } = req.params;
    const context = await contextManager.prepareNewSessionContext(ideaId);
    res.json({ context });
  } catch (error) {
    res.status(500).json({ error: "Failed to prepare session context" });
  }
});
```

## Update Sub-Agent Context Building

```typescript
// In routes where sub-agents are spawned, replace:
// const memoryFiles = await memoryManager.getAll(sessionId);

// With:
const graphContext = await graphQueryService.query({
  ideaId,
  statuses: ["active"],
  limit: 30,
});
```

## Remove Deprecated Endpoints

```typescript
// Remove or mark as deprecated:
// - GET /session/:sessionId/memory-files
// - POST /session/:sessionId/memory-files
```
