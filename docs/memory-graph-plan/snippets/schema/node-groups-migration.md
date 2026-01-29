# Node Groups Migration

## SQL Migration

Create `database/migrations/XXX_node_groups.sql`:

```sql
-- Migration: Add node groups for graph clustering

CREATE TABLE IF NOT EXISTS memory_node_groups (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  session_id TEXT,
  name TEXT NOT NULL,
  summary TEXT,
  theme TEXT,
  block_count INTEGER DEFAULT 0,
  avg_confidence REAL,
  dominant_block_types TEXT,  -- JSON array of most common types
  key_insights TEXT,          -- JSON array of top 3 insight summaries
  primary_graph_membership TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_node_group_blocks (
  group_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  PRIMARY KEY (group_id, block_id),
  FOREIGN KEY (group_id) REFERENCES memory_node_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (block_id) REFERENCES memory_blocks(id) ON DELETE CASCADE
);

CREATE INDEX idx_node_groups_idea ON memory_node_groups(idea_id, version);
CREATE INDEX idx_node_group_blocks_block ON memory_node_group_blocks(block_id);
```

## Drizzle Schema Entity

Create `schema/entities/memory-node-group.ts`:

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { ideas } from "./idea";
import { memoryBlocks } from "./memory-block";

export const memoryNodeGroups = sqliteTable("memory_node_groups", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  sessionId: text("session_id"),
  name: text("name").notNull(),
  summary: text("summary"),
  theme: text("theme"),
  blockCount: integer("block_count").default(0),
  avgConfidence: real("avg_confidence"),
  dominantBlockTypes: text("dominant_block_types"), // JSON
  keyInsights: text("key_insights"), // JSON
  primaryGraphMembership: text("primary_graph_membership"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const memoryNodeGroupBlocks = sqliteTable("memory_node_group_blocks", {
  groupId: text("group_id")
    .notNull()
    .references(() => memoryNodeGroups.id, { onDelete: "cascade" }),
  blockId: text("block_id")
    .notNull()
    .references(() => memoryBlocks.id, { onDelete: "cascade" }),
  createdAt: text("created_at"),
});
```

## Export from Schema Index

```typescript
// In schema/index.ts or similar
export * from "./entities/memory-node-group";
```

## Apply Migration

```bash
npm run schema:migrate
npm run schema:generate
```
