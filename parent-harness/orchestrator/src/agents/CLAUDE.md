# Agent Introspection Capability

As an autonomous agent in the Vibe platform, you have the ability to review your own past sessions to learn from previous work and avoid repeating mistakes.

## Automatic Context

When you are spawned with a task, relevant historical context is **automatically injected** into your system prompt. This includes:

- Top 5 most relevant past sessions (ranked by task similarity, recency, and success)
- Known error patterns from your memory
- Successful approaches you've used before

You don't need to query the introspection API manually unless you need more detailed information during task execution.

## Introspection API

Query your past sessions using the introspection API:

### Endpoint

```
GET /api/introspection/:agentId?taskSignature=<hash>&limit=10&minRelevance=0.3
```

### Parameters

- `taskSignature` (optional): Hash of task characteristics for similarity matching
- `limit` (optional, default: 10): Maximum sessions to return
- `minRelevance` (optional, default: 0.3): Minimum relevance score (0.0-1.0)
- `includeIterations` (optional, default: false): Include detailed iteration logs
- `includeFailures` (optional, default: false): Include failed sessions

### Example Request

```bash
curl http://localhost:3333/api/introspection/build_agent?limit=5&minRelevance=0.5
```

### Example Response

```json
{
  "agent_id": "build_agent",
  "query": { "taskSignature": null, "limit": 5, "minRelevance": 0.5 },
  "count": 2,
  "sessions": [
    {
      "session_id": "71b696ae-c79b-4f4b-a6d3-36f03d5f7913",
      "task_id": "5dfac93e-1a57-4f73-a319-9df56e50bed5",
      "status": "completed",
      "started_at": "2026-02-08 06:06:04",
      "completed_at": "2026-02-08 06:08:47",
      "relevance_score": 0.85,
      "summary": "Successfully implemented feature X using approach Y..."
    }
  ]
}
```

### Summary Endpoint

```
GET /api/introspection/:agentId/summary
```

Returns performance metrics: total sessions, success rate, average duration.

## When to Use Introspection

Use introspection when:

1. **Starting a similar task** - Check if you've done something similar before
2. **Encountering an error** - See if you've solved this error previously
3. **Making architectural decisions** - Review past decisions and their outcomes
4. **Stuck on a problem** - Look for patterns in how you've solved similar problems

## Memory Integration

Your introspection capability is integrated with the agent memory system:

- Error patterns are stored when you encounter and solve errors
- Success patterns are stored when you complete tasks successfully
- These patterns automatically appear in future prompts for similar tasks

## Privacy

You can ONLY access your own sessions. The API enforces agent_id filtering on all queries.

<claude-mem-context>
# Recent Activity

### Feb 8, 2026

| ID    | Time    | T   | Title                                                             | Read |
| ----- | ------- | --- | ----------------------------------------------------------------- | ---- |
| #5344 | 4:11 PM | 🔵  | Agent Metadata Registry Defines Clarification Agent Configuration | ~408 |

</claude-mem-context>
