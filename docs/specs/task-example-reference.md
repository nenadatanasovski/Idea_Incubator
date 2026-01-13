# Task Example Reference

**Created:** 2026-01-13
**Purpose:** Canonical task format with all required fields
**Status:** Reference Documentation

---

## Overview

This document defines the complete task format used throughout the Idea Incubator system. All tasks should follow this structure to ensure compatibility with:
- Task Agent validation
- Build Agent execution
- Parallelism analysis
- Auto-grouping algorithms
- UI rendering

---

## Task Format (Full)

### Task Header

```markdown
# Task: [DISPLAY_ID] - [TITLE]
```

---

### Metadata

| Field | Value |
|-------|-------|
| **ID** | `[UUID - system generated]` |
| **Display ID** | `[USER_INITIALS]-[PROJECT_CODE]-[CATEGORY_CODE]-[SEQUENCE]` |
| **Phase** | 1-Database / 2-Types / 3-API / 4-UI / 5-Tests |
| **Category** | See Category Reference below |
| **Status** | See Status Reference below |
| **Queue** | `evaluation` / `null` |
| **Task List** | Task List Name or NULL (if in Evaluation Queue) |
| **Priority** | P1-Critical / P2-Important / P3-Enhancement |
| **Effort** | trivial / small / medium / large / epic |
| **Owner** | Build Agent / Human / Task Agent |

---

### Relationships

| Type | Target | Notes |
|------|--------|-------|
| **Depends On** | Task IDs that must complete first | Blocks execution |
| **Blocks** | Task IDs waiting on this | Auto-calculated |
| **Related To** | Thematically connected tasks | Informational |
| **Duplicate Of** | Task ID if duplicate | Triggers merge flow |
| **Subtask Of** | Parent task ID | Hierarchical grouping |

---

### Summary

> 1-2 sentence description of what this task accomplishes and why it matters

---

### Context

#### Why This Task?

| Benefit | Description |
|---------|-------------|
| **Benefit 1** | How this helps the project |
| **Benefit 2** | Additional value provided |

#### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Technical choice made | Why this approach was selected |

---

### File Impacts

| File Path | Operation | Confidence | Source |
|-----------|-----------|------------|--------|
| `path/to/file.ts` | CREATE | 0.95 | ai_estimate |
| `path/to/other.ts` | UPDATE | 0.85 | pattern_match |

**Operations:** `CREATE`, `UPDATE`, `DELETE`, `READ`
**Sources:** `ai_estimate`, `pattern_match`, `user_declared`, `validated`
**Confidence:** 0.0 (guess) to 1.0 (certain)

---

### Requirements

1. **Requirement Group 1**:
   - Specific requirement a
   - Specific requirement b
   - Specific requirement c

2. **Requirement Group 2**:
   - Specific requirement d
   - Specific requirement e

---

### Pass Criteria

**PASS** when ALL of the following are true:

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | What must be true | Command or check to verify |
| 2 | What must be true | Command or check to verify |
| 3 | What must be true | Command or check to verify |

**FAIL** if any criterion is not met.

---

### Output Files

```
path/to/output/
├── directory/
│   ├── file1.ts
│   └── file2.ts
└── another-file.ts
```

---

### Code Template

```typescript
// Template code that guides implementation
// Build Agent uses this as a starting point

export class Example {
  // Key structure to follow
}
```

---

### Gotchas

- Common mistake to avoid #1
- Common mistake to avoid #2
- Environment-specific consideration

---

### Validation

```bash
# Commands to verify the task is complete
command_1
command_2
```

---

### Acceptance Criteria

- [ ] User-facing criterion 1
- [ ] User-facing criterion 2
- [ ] User-facing criterion 3

---

### API Test Cases

```json
[
  {
    "name": "Test case description",
    "method": "GET",
    "endpoint": "/api/example",
    "headers": { "Authorization": "Bearer token" },
    "body": null,
    "expectedStatus": 200,
    "expectedBody": { "success": true }
  }
]
```

---

### UI Test Cases

```json
[
  {
    "name": "Test case description",
    "preconditions": ["User is logged in"],
    "steps": [
      "Navigate to /page",
      "Click button X",
      "Fill form field Y"
    ],
    "expectedResult": "Success message appears"
  }
]
```

---

### Next Steps

> After completing: Description of what comes next and why

---

## Reference Tables

### Category Reference

| Category | Code | Description |
|----------|------|-------------|
| `feature` | FEA | New functionality |
| `bug` | BUG | Defect fix |
| `task` | TSK | General task |
| `story` | STY | User story |
| `epic` | EPC | Large feature set |
| `spike` | SPK | Research/exploration |
| `improvement` | IMP | Enhancement |
| `documentation` | DOC | Docs update |
| `test` | TST | Test creation |
| `devops` | OPS | CI/CD/infrastructure |
| `design` | DES | UI/UX design |
| `research` | RSH | Investigation |
| `infrastructure` | INF | System infrastructure |
| `security` | SEC | Security work |
| `performance` | PRF | Optimization |
| `other` | OTH | Uncategorized |

### Status Reference

| Status | Description | Transitions To |
|--------|-------------|----------------|
| `draft` | Being written | evaluating, pending |
| `evaluating` | In Evaluation Queue | pending, blocked |
| `pending` | Ready to execute | in_progress, blocked |
| `in_progress` | Being executed | completed, failed, blocked |
| `completed` | Successfully done | (terminal) |
| `failed` | Execution failed | pending (retry), blocked |
| `blocked` | Waiting on dependency | pending (when unblocked) |
| `skipped` | Intentionally skipped | (terminal) |

### Relationship Type Reference

| Type | Description | Creates Execution Dependency |
|------|-------------|------------------------------|
| `depends_on` | Must wait for target | YES |
| `blocks` | Target waits for this | YES (inverse) |
| `related_to` | Thematic connection | NO |
| `duplicate_of` | Same as target | NO (triggers merge) |
| `subtask_of` | Part of parent | NO |
| `supersedes` | Replaces target | NO |
| `implements` | Implements spec | NO |
| `conflicts_with` | Cannot run simultaneously | YES (parallel blocking) |
| `enables` | Unlocks target | YES |
| `inspired_by` | Idea source | NO |
| `tests` | Validates target | NO |

### File Operation Reference

| Operation | Description | Parallel Conflict Matrix |
|-----------|-------------|--------------------------|
| `CREATE` | New file | Conflicts with: CREATE (same file) |
| `UPDATE` | Modify existing | Conflicts with: UPDATE, DELETE |
| `DELETE` | Remove file | Conflicts with: CREATE, UPDATE, DELETE, READ |
| `READ` | Read only | No conflicts |

---

## Minimal Task Format

For quick task creation (e.g., via Telegram), only these fields are required:

```yaml
title: "Brief task description"
category: "feature"
```

All other fields will be:
- Auto-generated (ID, display_id, timestamps)
- Set to defaults (status: evaluating, queue: evaluation)
- Estimated by AI (file impacts)
- Calculated (priority, relationships)

---

## Example: Complete Task

### Task Header

```markdown
# Task: TU-PROJ-FEA-042 - Add user avatar upload
```

---

### Metadata

| Field | Value |
|-------|-------|
| **ID** | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| **Display ID** | `TU-PROJ-FEA-042` |
| **Phase** | 3 - API |
| **Category** | feature |
| **Status** | pending |
| **Queue** | null |
| **Task List** | User Profile Feature |
| **Priority** | P2 |
| **Effort** | medium |
| **Owner** | Build Agent |

---

### Relationships

| Type | Target | Notes |
|------|--------|-------|
| **Depends On** | TU-PROJ-FEA-040, TU-PROJ-FEA-041 | Requires user table and file storage |
| **Blocks** | TU-PROJ-FEA-043 | Profile display needs avatars |
| **Related To** | TU-PROJ-FEA-044 | Image resizing feature |

---

### Summary

> Create API endpoint for uploading user profile avatars with image validation and storage integration.

---

### Context

#### Why This Task?

| Benefit | Description |
|---------|-------------|
| **User Personalization** | Allows users to customize their profile appearance |
| **Social Features** | Enables avatar display in comments, mentions, etc. |

#### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Store in S3-compatible storage | Scalable, CDN-friendly |
| Max 5MB file size | Balance quality vs storage costs |
| Accept JPEG, PNG, WebP only | Common formats, good compression |

---

### File Impacts

| File Path | Operation | Confidence | Source |
|-----------|-----------|------------|--------|
| `server/routes/avatar.ts` | CREATE | 0.95 | ai_estimate |
| `server/services/image-processor.ts` | CREATE | 0.90 | ai_estimate |
| `types/user.ts` | UPDATE | 0.85 | pattern_match |
| `server/api.ts` | UPDATE | 0.95 | pattern_match |

---

### Requirements

1. **API Endpoint**:
   - POST /api/users/:id/avatar
   - Accept multipart/form-data
   - Validate file type (JPEG, PNG, WebP)
   - Validate file size (<5MB)

2. **Image Processing**:
   - Resize to 256x256 (thumbnail) and 512x512 (full)
   - Convert to WebP for storage
   - Generate unique filename

3. **Storage**:
   - Store in configured storage backend
   - Return public URL
   - Update user.avatarUrl in database

---

### Pass Criteria

**PASS** when ALL of the following are true:

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Route file exists | `test -f server/routes/avatar.ts` |
| 2 | TypeScript compiles | `npx tsc --noEmit` exits 0 |
| 3 | API returns 200 on valid upload | POST with valid image returns 200 |
| 4 | API returns 400 on invalid file | POST with PDF returns 400 |
| 5 | User record updated | avatarUrl field populated |

**FAIL** if any criterion is not met.

---

### Output Files

```
server/
├── routes/
│   └── avatar.ts
├── services/
│   └── image-processor.ts
types/
└── user.ts (modified)
```

---

### Code Template

```typescript
// server/routes/avatar.ts
import { Router } from 'express';
import multer from 'multer';
import { ImageProcessor } from '../services/image-processor';

const router = Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/:userId/avatar', upload.single('avatar'), async (req, res) => {
  // Validate file type
  // Process image
  // Store in backend
  // Update user record
  // Return URL
});

export default router;
```

---

### Gotchas

- Use multer memory storage, not disk (for serverless compatibility)
- Always validate MIME type server-side (don't trust Content-Type header)
- Generate unique filenames to prevent cache issues
- Handle concurrent uploads to same user gracefully

---

### Validation

```bash
npx tsc --noEmit
npm test -- --grep "avatar"
curl -X POST -F "avatar=@test.jpg" http://localhost:3001/api/users/test/avatar
```

---

### Acceptance Criteria

- [ ] User can upload JPEG, PNG, or WebP image
- [ ] Images over 5MB are rejected with clear error
- [ ] Invalid file types are rejected
- [ ] Avatar URL is returned immediately after upload
- [ ] Old avatar is replaced (not accumulated)

---

### API Test Cases

```json
[
  {
    "name": "Valid JPEG upload",
    "method": "POST",
    "endpoint": "/api/users/:userId/avatar",
    "headers": { "Content-Type": "multipart/form-data" },
    "body": { "avatar": "[binary JPEG data]" },
    "expectedStatus": 200,
    "expectedBody": { "avatarUrl": "https://..." }
  },
  {
    "name": "Invalid file type",
    "method": "POST",
    "endpoint": "/api/users/:userId/avatar",
    "body": { "avatar": "[binary PDF data]" },
    "expectedStatus": 400,
    "expectedBody": { "error": "Invalid file type" }
  },
  {
    "name": "File too large",
    "method": "POST",
    "endpoint": "/api/users/:userId/avatar",
    "body": { "avatar": "[6MB image]" },
    "expectedStatus": 400,
    "expectedBody": { "error": "File too large" }
  }
]
```

---

### UI Test Cases

```json
[
  {
    "name": "Upload avatar from profile settings",
    "preconditions": ["User is logged in", "On profile settings page"],
    "steps": [
      "Click 'Change Avatar' button",
      "Select valid image file",
      "Click 'Upload'"
    ],
    "expectedResult": "Avatar preview updates, success message shown"
  }
]
```

---

### Next Steps

> After completing: Implement profile display component (TU-PROJ-FEA-043) which will render the uploaded avatar.

---

## Validation Rules

The Task Agent validates tasks against these rules:

### Required Fields (Creation)

| Field | Required | Default |
|-------|----------|---------|
| title | YES | - |
| category | YES | 'task' |
| description | NO | '' |
| projectId | YES (via context) | - |

### Required Fields (Execution)

| Field | Required | Notes |
|-------|----------|-------|
| passsCriteria | YES | At least 1 criterion |
| fileImpacts | YES | At least estimated |
| requirements | RECOMMENDED | Improves Build Agent success |

### Validation Checks

1. **Title uniqueness**: No exact duplicate titles in same project
2. **Circular dependency**: Adding dependencies won't create cycle
3. **File conflict**: Identified conflicts flagged (not blocked)
4. **Category validity**: Must be one of 16 defined categories
5. **Status transitions**: Only valid transitions allowed

---

## Related Documents

- [PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md](./PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md) - Implementation details
- [task-data-model.md](../architecture/task-data-model.md) - Database schema
- [task-agent-arch.md](../architecture/task-agent-arch.md) - Task Agent architecture

---

*This reference document defines the canonical task format. All task-related code should conform to this specification.*
