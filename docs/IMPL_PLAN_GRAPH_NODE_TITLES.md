# Implementation Plan: Add Title Field to Memory Graph Nodes

## Overview

Add a short 3-5 word `title` field to memory graph nodes, distinct from the existing longer `content` field (description). This improves readability in both the graph visualization and table views.

**Current State:**

- Nodes have `content` field containing full description text
- No dedicated short title for quick identification
- UI displays full content which can be verbose

**Target State:**

- New `title` field: concise 3-5 word summary
- `content` field: detailed description (unchanged)
- UI prioritizes title for display, content for details
- Existing nodes populated via AI migration

---

## Phase 1: Database Schema

### 1.1 Create Migration File

**File:** `database/migrations/XXX_add_memory_block_title.sql`

```sql
-- Add title column to memory_blocks
ALTER TABLE memory_blocks ADD COLUMN title TEXT;

-- Create index for title searches
CREATE INDEX idx_memory_blocks_title ON memory_blocks(title);

-- Add comment documenting the field
COMMENT ON COLUMN memory_blocks.title IS 'Short 3-5 word summary for display; content field holds full description';
```

### 1.2 Update TypeScript Schema

**File:** `schema/entities/memory-block.ts`

Add to MemoryBlock interface:

```typescript
title?: string  // Short 3-5 word summary for quick identification
```

### 1.3 Run Migration

```bash
npm run schema:migrate
```

---

## Phase 2: Backend/API Changes

### 2.1 Update Graph Routes

**File:** `server/routes/ideation/graph-routes.ts`

#### 2.1.1 Update Block Creation (POST)

Add `title` to the Zod validation schema:

```typescript
const createBlockSchema = z.object({
  type: z.enum([
    /* existing types */
  ]),
  title: z.string().max(100).optional(), // NEW: short title
  content: z.string(),
  // ... rest of existing fields
});
```

Update INSERT query to include title:

```sql
INSERT INTO memory_blocks (id, session_id, type, title, content, ...)
VALUES (?, ?, ?, ?, ?, ...)
```

#### 2.1.2 Update Block Update (PATCH)

Add `title` to allowed update fields:

```typescript
const updateBlockSchema = z.object({
  type: z
    .enum([
      /* existing types */
    ])
    .optional(),
  title: z.string().max(100).optional(), // NEW
  content: z.string().optional(),
  // ... rest of existing fields
});
```

#### 2.1.3 Update Block Fetch (GET)

Ensure SELECT queries include the title column:

```sql
SELECT id, session_id, type, title, content, ... FROM memory_blocks
```

### 2.2 Update Block Service Layer

**File:** `server/services/graph/memory-block-service.ts` (if exists, or create)

Add helper to validate title format:

```typescript
function validateTitle(title: string): boolean {
  const wordCount = title.trim().split(/\s+/).length;
  return wordCount >= 1 && wordCount <= 7; // Allow 1-7 words for flexibility
}
```

### 2.3 Update WebSocket Events

Ensure `block_created` and `block_updated` events include the title field in their payloads.

---

## Phase 3: Frontend Changes

### 3.1 Update Type Definitions

**File:** `frontend/src/types/graph.ts`

```typescript
interface GraphNode {
  id: string;
  title?: string; // NEW: short 3-5 word title
  label: string; // Display label (derived from title or content)
  content: string; // Full description
  // ... rest of existing fields
}
```

### 3.2 Update GraphCanvas Component

**File:** `frontend/src/components/graph/GraphCanvas.tsx`

#### 3.2.1 Update `toReagraphNode` Function (Lines 239-249)

**Current code:**

```typescript
// Use full content for label
// Show full text for highlighted/selected/hovered/temporarily visible nodes, truncate others
const fullLabel = node.content || node.label;
const showFullText =
  isHighlighted || isSelected || isHovered || isTemporarilyVisible;
const maxLabelLength = 50;
const displayLabel = showFullText
  ? fullLabel
  : fullLabel.length > maxLabelLength
    ? fullLabel.substring(0, maxLabelLength - 3) + "..."
    : fullLabel;
```

**Updated code:**

```typescript
// Use title for display label, fall back to truncated content
// Title is short (3-5 words), so no truncation needed
// On hover/select, show full content instead of title
const title = node.title;
const fullContent = node.content || node.label;
const showFullText =
  isHighlighted || isSelected || isHovered || isTemporarilyVisible;

let displayLabel: string;
if (showFullText) {
  // When focused, show full content for context
  displayLabel = fullContent;
} else if (title) {
  // Default: show short title
  displayLabel = title;
} else {
  // Fallback: truncate content to first 5 words
  const words = fullContent.split(" ");
  displayLabel =
    words.length > 5 ? words.slice(0, 5).join(" ") + "..." : fullContent;
}
```

#### 3.2.2 Behavior Summary

| State                        | Label Shown                      |
| ---------------------------- | -------------------------------- |
| Default (has title)          | Short title (3-5 words)          |
| Default (no title)           | First 5 words of content + "..." |
| Hovered/Selected/Highlighted | Full content                     |

This ensures:

- Clean, readable graph by default (short titles)
- Full context on demand (hover/click)
- Backwards compatible fallback for nodes without titles

### 3.3 Update MemoryDatabasePanel Component

**File:** `frontend/src/components/ideation/MemoryDatabasePanel.tsx`

#### 3.3.1 Add Title Column to Blocks Table

```tsx
<Table.Th>Title</Table.Th>
<Table.Th>Content</Table.Th>  {/* Keep existing content column */}
```

```tsx
<Table.Td>
  {block.title || <Text c="dimmed" size="xs">No title</Text>}
</Table.Td>
<Table.Td>
  <Text size="xs" lineClamp={2}>{block.content}</Text>
</Table.Td>
```

#### 3.3.2 Update Block Detail Panel

Show both title and content in the expandable detail view:

```tsx
<Stack gap="xs">
  <Group>
    <Text fw={600}>Title:</Text>
    <Text>{block.title || "Not set"}</Text>
  </Group>
  <Group align="flex-start">
    <Text fw={600}>Content:</Text>
    <Text>{block.content}</Text>
  </Group>
</Stack>
```

#### 3.3.3 Add Inline Title Editing

Allow users to add/edit titles directly from the table:

```tsx
<TextInput
  value={block.title || ""}
  placeholder="Add short title..."
  size="xs"
  onBlur={(e) => updateBlockTitle(block.id, e.target.value)}
/>
```

### 3.4 Update Search/Filter

Include title in search queries:

```typescript
const searchBlocks = (query: string) => {
  return blocks.filter(
    (b) =>
      b.title?.toLowerCase().includes(query.toLowerCase()) ||
      b.content.toLowerCase().includes(query.toLowerCase()),
  );
};
```

---

## Phase 4: AI Migration for Existing Nodes

### 4.1 Create Migration Script

**File:** `scripts/migrate-block-titles.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../server/db";

const anthropic = new Anthropic();

interface MemoryBlock {
  id: string;
  content: string;
  type: string;
  title: string | null;
}

async function generateTitle(block: MemoryBlock): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 50,
    messages: [
      {
        role: "user",
        content: `Generate a concise 3-5 word title for this ${block.type} memory block. Return ONLY the title, no explanation.

Content: "${block.content}"

Title:`,
      },
    ],
  });

  const title = (response.content[0] as { text: string }).text.trim();

  // Validate word count
  const wordCount = title.split(/\s+/).length;
  if (wordCount > 7) {
    return title.split(/\s+/).slice(0, 5).join(" ");
  }

  return title;
}

async function migrateBlockTitles() {
  console.log("Fetching blocks without titles...");

  const blocks = db
    .prepare(
      `
    SELECT id, content, type, title
    FROM memory_blocks
    WHERE title IS NULL AND content IS NOT NULL AND content != ''
  `,
    )
    .all() as MemoryBlock[];

  console.log(`Found ${blocks.length} blocks to process`);

  let processed = 0;
  let errors = 0;

  for (const block of blocks) {
    try {
      const title = await generateTitle(block);

      db.prepare(
        `
        UPDATE memory_blocks
        SET title = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(title, block.id);

      processed++;
      console.log(`[${processed}/${blocks.length}] ${block.id}: "${title}"`);

      // Rate limiting: 50ms between requests
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      errors++;
      console.error(`Error processing block ${block.id}:`, error);
    }
  }

  console.log(`\nMigration complete: ${processed} processed, ${errors} errors`);
}

migrateBlockTitles().catch(console.error);
```

### 4.2 Add npm Script

**File:** `package.json`

```json
{
  "scripts": {
    "migrate:block-titles": "npx tsx scripts/migrate-block-titles.ts"
  }
}
```

### 4.3 Run Migration

```bash
npm run migrate:block-titles
```

**Cost Estimate:** ~$0.002 per block (Sonnet 4 with small input/output)

- 100 blocks ≈ $0.20
- 1000 blocks ≈ $2.00

---

## Phase 5: Future AI Integration

### 5.1 Auto-Generate Title on Block Creation

When a new block is created without a title, optionally generate one:

```typescript
// In graph-routes.ts POST handler
if (!body.title && body.content) {
  body.title = await generateTitleFromContent(body.content, body.type);
}
```

### 5.2 Suggest Title Improvements

Add UI button to regenerate/improve existing titles:

```tsx
<ActionIcon onClick={() => suggestTitle(block.id)}>
  <IconSparkles size={14} />
</ActionIcon>
```

---

## Implementation Checklist

### Database

- [ ] Create migration file `XXX_add_memory_block_title.sql`
- [ ] Update `schema/entities/memory-block.ts`
- [ ] Run migration

### Backend

- [ ] Update Zod schemas in graph-routes.ts (create/update)
- [ ] Update SELECT queries to include title
- [ ] Update INSERT/UPDATE queries for title
- [ ] Update WebSocket event payloads

### Frontend

- [ ] Update `GraphNode` type definition
- [ ] Update GraphCanvas node label rendering
- [ ] Add title column to MemoryDatabasePanel blocks table
- [ ] Update block detail panel
- [ ] Add inline title editing
- [ ] Update search to include title

### AI Migration

- [ ] Create `scripts/migrate-block-titles.ts`
- [ ] Add npm script
- [ ] Run migration for existing blocks
- [ ] Verify migration results

### Testing

- [ ] Test block creation with/without title
- [ ] Test block update with title
- [ ] Test title display in graph visualization
- [ ] Test title display in table view
- [ ] Test search/filter with titles
- [ ] Test AI title generation accuracy

---

## File Summary

| File                                                       | Changes                         |
| ---------------------------------------------------------- | ------------------------------- |
| `database/migrations/XXX_add_memory_block_title.sql`       | NEW: Add title column           |
| `schema/entities/memory-block.ts`                          | Add title field                 |
| `server/routes/ideation/graph-routes.ts`                   | Update CRUD for title           |
| `frontend/src/types/graph.ts`                              | Add title to GraphNode          |
| `frontend/src/components/graph/GraphCanvas.tsx`            | Use title for labels            |
| `frontend/src/components/ideation/MemoryDatabasePanel.tsx` | Add title column, editing       |
| `scripts/migrate-block-titles.ts`                          | NEW: AI migration script        |
| `package.json`                                             | Add migrate:block-titles script |

---

## Rollback Plan

If issues arise:

1. **Database:** Title column is nullable, so no breaking changes
2. **API:** Title is optional in all schemas
3. **Frontend:** Falls back to content if no title
4. **Migration:** Can be re-run safely (idempotent)

To remove titles entirely:

```sql
ALTER TABLE memory_blocks DROP COLUMN title;
```
