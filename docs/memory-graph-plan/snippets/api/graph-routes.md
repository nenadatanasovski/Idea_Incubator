# Graph Query API Routes

Add to `server/routes/ideation/graph-routes.ts`:

```typescript
import { graphQueryService } from "../../services/graph/graph-query-service";

// ============ AGENT QUERY ENDPOINTS ============

/**
 * POST /api/ideation/graph/query
 * Execute a graph query with full filtering options
 */
router.post("/graph/query", async (req, res) => {
  try {
    const query: GraphQuery = req.body;

    // Validate required fields
    if (!query.ideaId) {
      return res.status(400).json({ error: "ideaId is required" });
    }

    const result = await graphQueryService.query(query);
    res.json(result);
  } catch (error) {
    console.error("Graph query error:", error);
    res.status(500).json({ error: "Failed to execute graph query" });
  }
});

/**
 * GET /api/ideation/idea/:ideaId/graph/user-profile
 * Get user profile blocks for ideation agent
 */
router.get("/idea/:ideaId/graph/user-profile", async (req, res) => {
  try {
    const { ideaId } = req.params;
    const result = await graphQueryService.getUserProfile(ideaId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

/**
 * GET /api/ideation/idea/:ideaId/graph/spec-requirements
 * Get spec requirements for spec agent
 */
router.get("/idea/:ideaId/graph/spec-requirements", async (req, res) => {
  try {
    const { ideaId } = req.params;
    const result = await graphQueryService.getSpecRequirements(ideaId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch spec requirements" });
  }
});

/**
 * GET /api/ideation/idea/:ideaId/graph/task-context
 * Get task context for build agent
 */
router.get("/idea/:ideaId/graph/task-context", async (req, res) => {
  try {
    const { ideaId } = req.params;
    const result = await graphQueryService.getTaskContext(ideaId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch task context" });
  }
});

/**
 * GET /api/ideation/idea/:ideaId/graph/learnings
 * Get SIA learnings for build agent
 */
router.get("/idea/:ideaId/graph/learnings", async (req, res) => {
  try {
    const { ideaId } = req.params;
    const result = await graphQueryService.getLearnings(ideaId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch learnings" });
  }
});

/**
 * GET /api/ideation/idea/:ideaId/graph/readiness/spec
 * Check spec generation readiness
 */
router.get("/idea/:ideaId/graph/readiness/spec", async (req, res) => {
  try {
    const { ideaId } = req.params;
    const result = await graphQueryService.checkSpecReadiness(ideaId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to check spec readiness" });
  }
});

/**
 * GET /api/ideation/idea/:ideaId/graph/readiness/launch
 * Check marketing/launch readiness
 */
router.get("/idea/:ideaId/graph/readiness/launch", async (req, res) => {
  try {
    const { ideaId } = req.params;
    const result = await graphQueryService.checkLaunchReadiness(ideaId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to check launch readiness" });
  }
});

/**
 * GET /api/ideation/block/:blockId/sources
 * Get sources for a specific block
 */
router.get("/block/:blockId/sources", async (req, res) => {
  try {
    const { blockId } = req.params;
    const includeContent = req.query.includeContent === "true";
    const sources = await graphQueryService.getBlockSources(
      blockId,
      includeContent,
    );
    res.json({ sources });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch block sources" });
  }
});
```

## Test the Endpoints

```bash
# Start server
npm run dev

# Test query endpoint
curl -X POST http://localhost:3000/api/ideation/graph/query \
  -H "Content-Type: application/json" \
  -d '{"ideaId": "test-idea", "graphMemberships": ["problem"]}'
```
