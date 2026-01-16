# Observability and Operability - Appendix C: Examples

> **Navigation:** [Documentation Index](../../DOCUMENTATION-INDEX.md) > [Observability Spec](../SPEC.md) > Appendix C: Examples
> **Location:** `docs/specs/observability/appendices/EXAMPLES.md`
> **Purpose:** JSON/JSONL examples for observability data structures
> **Related:** [Appendix A: Types](./TYPES.md) | [Appendix B: Database](./DATABASE.md)

---

## Table of Contents

1. [Unified Transcript Examples](#1-unified-transcript-examples)
2. [Tool Use Examples](#2-tool-use-examples)
3. [Skill Trace Examples](#3-skill-trace-examples)
4. [Assertion Examples](#4-assertion-examples)
5. [WebSocket Event Examples](#5-websocket-event-examples)

---

## 1. Unified Transcript Examples

### 1.1 Sample JSONL Transcript

Each line in a unified transcript file (`unified.jsonl`) is a self-contained JSON object:

```jsonl
{"id":"e001","timestamp":"2026-01-15T10:30:00.123Z","sequence":1,"executionId":"exec-123","instanceId":"ba-456","waveNumber":0,"entryType":"phase_start","category":"lifecycle","summary":"PRIME phase started - loading context","details":{"phase":"prime"},"durationMs":null}
{"id":"e002","timestamp":"2026-01-15T10:30:00.456Z","sequence":2,"executionId":"exec-123","instanceId":"ba-456","waveNumber":0,"entryType":"tool_use","category":"action","summary":"Read file: CLAUDE.md","details":{"tool":"read_file","path":"CLAUDE.md","bytesRead":15234},"toolCalls":[{"tool":"read_file","input":{"path":"CLAUDE.md"},"output":{"success":true}}],"durationMs":45}
{"id":"e003","timestamp":"2026-01-15T10:30:01.200Z","sequence":3,"executionId":"exec-123","taskId":"TU-IDEA-FEA-001","instanceId":"ba-456","waveNumber":0,"entryType":"task_start","category":"lifecycle","summary":"Starting task: Create user model type","details":{"taskId":"TU-IDEA-FEA-001","action":"CREATE","file":"types/user.ts"}}
{"id":"e004","timestamp":"2026-01-15T10:30:01.500Z","sequence":4,"executionId":"exec-123","taskId":"TU-IDEA-FEA-001","instanceId":"ba-456","waveNumber":0,"entryType":"skill_invoke","category":"action","summary":"Invoking skill: code-generation from SKILLS.md","details":{"skillName":"code-generation","skillFile":"skills/code-generation.md","section":"TypeScript Types"},"skillRef":{"skillName":"code-generation","skillFile":"skills/code-generation.md","lineNumber":45,"sectionTitle":"TypeScript Types"}}
{"id":"e005","timestamp":"2026-01-15T10:30:03.200Z","sequence":5,"executionId":"exec-123","taskId":"TU-IDEA-FEA-001","instanceId":"ba-456","waveNumber":0,"entryType":"tool_use","category":"action","summary":"Write file: types/user.ts (42 lines)","details":{"tool":"write_file","path":"types/user.ts","linesWritten":42},"toolCalls":[{"tool":"write_file","input":{"path":"types/user.ts","content":"..."},"output":{"success":true}}],"durationMs":23}
{"id":"e006","timestamp":"2026-01-15T10:30:03.500Z","sequence":6,"executionId":"exec-123","taskId":"TU-IDEA-FEA-001","instanceId":"ba-456","waveNumber":0,"entryType":"validation","category":"validation","summary":"Running validation: npx tsc --noEmit","details":{"command":"npx tsc --noEmit","expected":"exit 0"},"durationMs":2340}
{"id":"e007","timestamp":"2026-01-15T10:30:05.840Z","sequence":7,"executionId":"exec-123","taskId":"TU-IDEA-FEA-001","instanceId":"ba-456","waveNumber":0,"entryType":"assertion","category":"validation","summary":"PASS: TypeScript compilation succeeded","details":{"assertionId":"A001","result":"pass","exitCode":0},"assertions":[{"id":"A001","description":"TypeScript compiles without errors","result":"pass","evidence":{"exitCode":0,"stdout":"","stderr":""}}]}
{"id":"e008","timestamp":"2026-01-15T10:30:06.000Z","sequence":8,"executionId":"exec-123","taskId":"TU-IDEA-FEA-001","instanceId":"ba-456","waveNumber":0,"entryType":"task_end","category":"lifecycle","summary":"Task completed successfully","details":{"taskId":"TU-IDEA-FEA-001","status":"completed","filesModified":["types/user.ts"]},"durationMs":4800}
```

### 1.2 Transcript File Structure

```
coding-loops/
├── transcripts/
│   ├── {execution_id}/
│   │   ├── unified.jsonl           # Main transcript
│   │   ├── assertions.json         # All assertions with evidence
│   │   ├── skills-used.json        # Skill invocation summary
│   │   └── diffs/
│   │       ├── {task_id}.diff      # Unified diff per task
│   │       └── combined.diff       # All changes combined
│   └── index.json                  # Index of all executions
```

---

## 2. Tool Use Examples

### 2.1 Tool Use in Unified Transcript

Tool use entries include full ToolUse records:

```jsonl
{"id":"e002","timestamp":"2026-01-15T10:30:00.456Z","sequence":2,"executionId":"exec-123","instanceId":"ba-456","waveNumber":0,"entryType":"tool_use","category":"action","summary":"[Tool: Read] CLAUDE.md → [Done]","details":{"tool":"Read","resultStatus":"done"},"toolUse":{"id":"tu-001","tool":"Read","input":{"file_path":"CLAUDE.md"},"inputSummary":"Read file: CLAUDE.md","resultStatus":"done","output":{"success":true,"lineCount":450,"charCount":15234},"outputSummary":"450 lines, 15234 chars","isError":false,"isBlocked":false,"durationMs":45},"durationMs":45}
{"id":"e010","timestamp":"2026-01-15T10:30:22.456Z","sequence":10,"executionId":"exec-123","instanceId":"ba-456","waveNumber":0,"entryType":"tool_use","category":"action","summary":"[Tool: Bash] rm -rf node_modules → [BLOCKED]","details":{"tool":"Bash","resultStatus":"blocked"},"toolUse":{"id":"tu-032","tool":"Bash","input":{"command":"rm -rf node_modules"},"inputSummary":"rm -rf node_modules","resultStatus":"blocked","isError":false,"isBlocked":true,"blockReason":"Command 'rm' is not in the allowed commands list","durationMs":2},"durationMs":2}
{"id":"e015","timestamp":"2026-01-15T10:31:45.234Z","sequence":15,"executionId":"exec-123","instanceId":"ba-456","waveNumber":0,"entryType":"tool_use","category":"action","summary":"[Tool: Write] types/user.ts → [Error]","details":{"tool":"Write","resultStatus":"error"},"toolUse":{"id":"tu-045","tool":"Write","input":{"file_path":"types/user.ts","content":"..."},"inputSummary":"Write file: types/user.ts (42 lines)","resultStatus":"error","output":{"success":false},"outputSummary":"EACCES: permission denied","isError":true,"isBlocked":false,"errorMessage":"EACCES: permission denied, open 'types/user.ts'","durationMs":12},"durationMs":12}
```

### 2.2 Tool Usage Aggregation Summary

Generated after execution at `GET /api/executions/{id}/tool-summary`:

```json
{
  "executionId": "exec-123",
  "totalToolUses": 47,
  "byTool": {
    "Read": {
      "count": 15,
      "success": 15,
      "error": 0,
      "blocked": 0,
      "avgDurationMs": 23
    },
    "Write": {
      "count": 8,
      "success": 7,
      "error": 1,
      "blocked": 0,
      "avgDurationMs": 45
    },
    "Edit": {
      "count": 12,
      "success": 12,
      "error": 0,
      "blocked": 0,
      "avgDurationMs": 18
    },
    "Bash": {
      "count": 10,
      "success": 8,
      "error": 1,
      "blocked": 1,
      "avgDurationMs": 2340
    },
    "Glob": {
      "count": 2,
      "success": 2,
      "error": 0,
      "blocked": 0,
      "avgDurationMs": 56
    }
  },
  "byCategory": {
    "file_read": { "count": 17, "success": 17 },
    "file_write": { "count": 20, "success": 19 },
    "shell": { "count": 10, "success": 8, "blocked": 1 }
  },
  "errors": [
    {
      "toolUseId": "tu-045",
      "tool": "Write",
      "inputSummary": "Write file: types/user.ts",
      "errorMessage": "EACCES: permission denied",
      "timestamp": "2026-01-15T10:31:45.234Z"
    }
  ],
  "blocked": [
    {
      "toolUseId": "tu-032",
      "tool": "Bash",
      "inputSummary": "rm -rf node_modules",
      "blockReason": "Command 'rm' is not in the allowed commands list",
      "timestamp": "2026-01-15T10:30:22.456Z"
    }
  ],
  "timeline": {
    "firstToolUse": "2026-01-15T10:30:00.123Z",
    "lastToolUse": "2026-01-15T10:35:45.678Z",
    "totalDurationMs": 345555
  }
}
```

### 2.3 Console Output Pattern

From autonomous-coding reference implementation:

```
[Tool: Bash]
 Input: npm install express
 [Done]                        ← Success

[Tool: Read]
 Input: src/index.ts
 [Done]                        ← Success

[Tool: Bash]
 Input: rm -rf /
 [BLOCKED] Command 'rm' is not in the allowed commands list

[Tool: Bash]
 Input: npm run build
 [Error] Exit code 1: TypeScript error TS2339...
```

---

## 3. Skill Trace Examples

### 3.1 Skills Used Summary

Generated after execution at `skills-used.json`:

```json
{
  "executionId": "exec-123",
  "totalSkillInvocations": 7,
  "uniqueSkillsUsed": 3,
  "skills": [
    {
      "skillName": "code-generation",
      "skillFile": "skills/code-generation.md",
      "invocationCount": 4,
      "totalDurationMs": 12340,
      "successRate": 1.0,
      "sections": [
        { "section": "TypeScript Types", "count": 2 },
        { "section": "API Routes", "count": 2 }
      ]
    },
    {
      "skillName": "validation",
      "skillFile": "skills/validation.md",
      "invocationCount": 3,
      "totalDurationMs": 5600,
      "successRate": 0.67,
      "sections": [
        { "section": "TypeScript Check", "count": 2 },
        { "section": "Lint Check", "count": 1 }
      ]
    }
  ],
  "skillFileReferences": [
    {
      "file": "skills/code-generation.md",
      "linesReferenced": [45, 67, 89, 112],
      "sectionsUsed": ["TypeScript Types", "API Routes"]
    }
  ]
}
```

---

## 4. Assertion Examples

### 4.1 Assertions Summary

Generated after execution at `assertions.json`:

```json
{
  "executionId": "exec-123",
  "summary": {
    "totalAssertions": 24,
    "passed": 22,
    "failed": 1,
    "skipped": 1,
    "warnings": 0,
    "passRate": 0.917
  },
  "byCategory": {
    "typescript_compiles": { "total": 8, "passed": 8 },
    "lint_passes": { "total": 8, "passed": 7, "failed": 1 },
    "tests_pass": { "total": 4, "passed": 4 },
    "file_created": { "total": 4, "passed": 3, "skipped": 1 }
  },
  "failures": [
    {
      "assertionId": "A015",
      "taskId": "TU-IDEA-FEA-003",
      "category": "lint_passes",
      "description": "ESLint passes without errors",
      "evidence": {
        "command": "npx eslint types/user.ts",
        "exitCode": 1,
        "stderr": "1:1 error Missing semicolon semi"
      },
      "transcriptRef": "e045"
    }
  ],
  "chains": [
    {
      "taskId": "TU-IDEA-FEA-001",
      "chainId": "chain-001",
      "result": "pass",
      "assertions": ["A001", "A002", "A003"]
    }
  ]
}
```

### 4.2 Standard Assertion Chains by Task Type

| Task Action        | Required Assertions                                                    |
| ------------------ | ---------------------------------------------------------------------- |
| `CREATE` file      | `file_created` → `typescript_compiles` → `lint_passes`                 |
| `UPDATE` file      | `file_modified` → `typescript_compiles` → `lint_passes` → `tests_pass` |
| `DELETE` file      | `file_deleted` → `typescript_compiles` → `no_import_errors`            |
| `CREATE` migration | `schema_valid` → `migration_runs` → `rollback_works`                   |
| `CREATE` API route | `typescript_compiles` → `api_responds` → `tests_pass`                  |

---

## 5. WebSocket Event Examples

### 5.1 Subscription Message

Client sends to subscribe to topics:

```json
{
  "type": "subscribe",
  "topics": ["transcript:exec-123", "tooluse:exec-123", "assertion:*"]
}
```

### 5.2 TranscriptStreamEvent

```json
{
  "type": "transcript:entry",
  "executionId": "exec-123",
  "entry": {
    "id": "e015",
    "timestamp": "2026-01-15T10:31:45.234Z",
    "sequence": 15,
    "entryType": "tool_use",
    "category": "action",
    "summary": "[Tool: Write] types/user.ts → [Error]"
  },
  "isLatest": true
}
```

### 5.3 ToolUseStreamEvent - Start

```json
{
  "type": "tooluse:start",
  "executionId": "exec-123",
  "toolUseId": "tu-045",
  "timestamp": "2026-01-15T10:31:45.200Z",
  "tool": "Write",
  "inputSummary": "Write file: types/user.ts (42 lines)"
}
```

### 5.4 ToolUseStreamEvent - End

```json
{
  "type": "tooluse:end",
  "executionId": "exec-123",
  "toolUseId": "tu-045",
  "timestamp": "2026-01-15T10:31:45.234Z",
  "resultStatus": "error",
  "durationMs": 34
}
```

### 5.5 ToolUseStreamEvent - Output (Streaming)

For long-running bash commands:

```json
{
  "type": "tooluse:output",
  "executionId": "exec-123",
  "toolUseId": "tu-050",
  "chunk": "Compiling TypeScript...\n",
  "isStderr": false
}
```

### 5.6 AssertionStreamEvent

```json
{
  "type": "assertion:result",
  "executionId": "exec-123",
  "taskId": "TU-IDEA-FEA-003",
  "assertion": {
    "id": "A015",
    "category": "lint_passes",
    "description": "ESLint passes without errors",
    "result": "fail",
    "evidence": {
      "command": "npx eslint types/user.ts",
      "exitCode": 1,
      "stderr": "1:1 error Missing semicolon semi"
    }
  },
  "runningPassRate": 0.917
}
```

### 5.7 SkillStreamEvent - Start

```json
{
  "type": "skill:start",
  "executionId": "exec-123",
  "skillTraceId": "st-001",
  "skillName": "code-generation",
  "timestamp": "2026-01-15T10:30:01.500Z"
}
```

### 5.8 SkillStreamEvent - End

```json
{
  "type": "skill:end",
  "executionId": "exec-123",
  "skillTraceId": "st-001",
  "skillName": "code-generation",
  "status": "success",
  "timestamp": "2026-01-15T10:30:03.200Z"
}
```

### 5.9 MessageBusStreamEvent

```json
{
  "type": "messagebus:event",
  "entry": {
    "eventId": "evt-123",
    "timestamp": "2026-01-15T10:33:00.000Z",
    "source": "loop-2-infrastructure",
    "eventType": "stuck_detected",
    "humanSummary": "STUCK: Loop loop-2 failed 3x on INF-AUTH-001",
    "severity": "error",
    "category": "failure"
  },
  "requiresAction": true
}
```

---

## 6. API Response Examples

### 6.1 Message Bus Log Query Response

`GET /api/logs/message-bus?since=2026-01-15T10:30:00Z&severity=error`

```json
{
  "entries": [
    {
      "eventId": "evt-089",
      "timestamp": "2026-01-15T10:32:45.000Z",
      "source": "monitor",
      "eventType": "file_conflict",
      "humanSummary": "CONFLICT: Both loop-1 and loop-2 modified types/auth.ts",
      "severity": "error",
      "category": "coordination",
      "payload": {
        "loop_a": "loop-1-critical-path",
        "loop_b": "loop-2-infrastructure",
        "file_path": "types/auth.ts"
      }
    },
    {
      "eventId": "evt-102",
      "timestamp": "2026-01-15T10:33:00.000Z",
      "source": "loop-2-infrastructure",
      "eventType": "stuck_detected",
      "humanSummary": "STUCK: Loop loop-2 failed 3x on INF-AUTH-001",
      "severity": "error",
      "category": "failure",
      "payload": {
        "loop_id": "loop-2-infrastructure",
        "test_id": "INF-AUTH-001",
        "consecutive_failures": 3
      }
    }
  ],
  "hasMore": false,
  "nextCursor": null
}
```

### 6.2 Tool Use Query Response

`GET /api/executions/exec-123/tool-uses?tools=Bash&status=blocked`

```json
{
  "toolUses": [
    {
      "id": "tu-032",
      "executionId": "exec-123",
      "tool": "Bash",
      "toolCategory": "shell",
      "input": { "command": "rm -rf node_modules" },
      "inputSummary": "rm -rf node_modules",
      "resultStatus": "blocked",
      "isError": false,
      "isBlocked": true,
      "blockReason": "Command 'rm' is not in the allowed commands list",
      "startTime": "2026-01-15T10:30:22.454Z",
      "endTime": "2026-01-15T10:30:22.456Z",
      "durationMs": 2
    }
  ],
  "total": 1,
  "hasMore": false
}
```

---

## 7. Human-Readable Event Summaries

Map of event types to human summary templates:

| Event Type           | Human Summary Template                                                             |
| -------------------- | ---------------------------------------------------------------------------------- |
| `test_started`       | "Loop `{loop_id}` started working on test `{test_id}`"                             |
| `test_passed`        | "Test `{test_id}` PASSED (took {duration_seconds}s, modified {files_count} files)" |
| `test_failed`        | "Test `{test_id}` FAILED: {error_message} (attempt {attempt})"                     |
| `file_locked`        | "Loop `{loop_id}` locked `{file_path}` for task `{test_id}`"                       |
| `file_conflict`      | "CONFLICT: Both `{loop_a}` and `{loop_b}` modified `{file_path}`"                  |
| `stuck_detected`     | "STUCK: Loop `{loop_id}` failed {consecutive_failures}x on `{test_id}`"            |
| `decision_needed`    | "DECISION REQUIRED: {summary} (timeout: {timeout_minutes}min)"                     |
| `knowledge_recorded` | "LEARNED: New {item_type} - \"{content}\""                                         |

---

## 8. Archival Format

```
archives/
├── {year}/
│   ├── {month}/
│   │   ├── transcripts-{date}.jsonl.gz
│   │   ├── tool-uses-{date}.jsonl.gz
│   │   ├── assertions-{date}.json.gz
│   │   ├── skill-traces-{date}.json.gz
│   │   └── message-bus-{date}.log.gz
```

---

_See [Appendix A: Types](./TYPES.md) for TypeScript interfaces and [Appendix B: Database](./DATABASE.md) for SQL schema._
