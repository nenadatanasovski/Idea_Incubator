# Phase 1: Foundation Implementation

> **Source of Truth** for Neo4j + Prisma migration and FastAPI setup.
> 
> Related: `02-NEO4J-SCHEMA.md`, `03-CONSOLIDATED-PLAN.md`, `04-CODE-AUDIT-CHECKLIST.md`

---

## Overview

Phase 1 establishes the solid storage foundation everything else builds on:

1. **Neo4j** — Graph database for knowledge (blocks, relationships)
2. **Prisma** — Postgres ORM for operational state (tasks, sessions, users)
3. **FastAPI** — Python coordination layer for fast agent-to-agent communication

**Branch:** `foundation/neo4j-prisma`

---

## Vertical Slice First

Before building each component fully, get end-to-end working ugly:

```
1. Create 1 Knowledge block in Neo4j manually
2. Query it back via TypeScript
3. Store related Task in Prisma
4. Trigger a job via FastAPI endpoint
5. Verify the chain works
```

Then expand each piece.

---

## 1. Neo4j Setup

### 1.1 Local Development

```yaml
# docker-compose.neo4j.yml
version: '3.8'
services:
  neo4j:
    image: neo4j:5.15-community
    ports:
      - "7474:7474"  # Browser
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/localdevpassword
      - NEO4J_PLUGINS=["apoc"]
    volumes:
      - neo4j_data:/data

volumes:
  neo4j_data:
```

```bash
docker-compose -f docker-compose.neo4j.yml up -d
```

### 1.2 Schema Application

Apply schema from `02-NEO4J-SCHEMA.md`:

```bash
npm run neo4j:schema
```

**Acceptance Criteria:**
- [ ] Constraints created (Block id unique)
- [ ] All indexes created
- [ ] Full-text search index works
- [ ] Test query returns in <50ms

### 1.3 Connection Config

```typescript
// config/neo4j.ts
import neo4j from 'neo4j-driver';

export const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'localdevpassword'
  )
);
```

### 1.4 Verification

```cypher
// Create test block
CREATE (b:Block:Knowledge {
  id: 'test-001',
  sessionId: 'test-session',
  title: 'Test block',
  content: 'Test content',
  status: 'active',
  createdAt: datetime()
})
RETURN b;

// Query it back
MATCH (b:Block {id: 'test-001'}) RETURN b;

// Cleanup
MATCH (b:Block {id: 'test-001'}) DELETE b;
```

---

## 2. Prisma Setup

### 2.1 Generate From Existing Drizzle

**Do not design from scratch.** Introspect existing schema:

```bash
# Step 1: Export existing Drizzle schema
npm run drizzle:introspect > existing-schema.sql

# Step 2: Initialize Prisma
npm install prisma @prisma/client
npx prisma init

# Step 3: Point Prisma at existing DB and introspect
npx prisma db pull
```

This generates `prisma/schema.prisma` matching existing data.

### 2.2 Refine Schema

After introspection, add Prisma features:

```prisma
// prisma/schema.prisma (refined from introspection)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Keep existing tables, add relations
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  sessions  Session[]
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  channel   String
  kind      String
  createdAt DateTime @default(now())
  
  tasks     Task[]
}

model Task {
  id          String   @id @default(uuid())
  sessionId   String?
  session     Session? @relation(fields: [sessionId], references: [id])
  title       String
  status      String   @default("pending")
  priority    String   @default("P2")
  createdAt   DateTime @default(now())
  
  // Subtasks
  parentId    String?
  parent      Task?    @relation("Subtasks", fields: [parentId], references: [id])
  subtasks    Task[]   @relation("Subtasks")
}

model ApprovalRequest {
  id          String   @id @default(uuid())
  proposalId  String   // References Neo4j Proposal block
  status      String   @default("pending")
  requestedAt DateTime @default(now())
  decidedAt   DateTime?
  reason      String?
}

model AgentHealth {
  id          String   @id @default(uuid())
  agentName   String   @unique
  status      String
  lastPing    DateTime @default(now())
  errorCount  Int      @default(0)
}
```

### 2.3 Generate Client

```bash
npx prisma generate
```

### 2.4 Verification

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Test nested create
const task = await prisma.task.create({
  data: {
    title: 'Test task',
    subtasks: {
      create: [
        { title: 'Subtask 1' },
        { title: 'Subtask 2' },
      ]
    }
  },
  include: { subtasks: true }
});

console.log(task); // Should show task with 2 subtasks
```

**Acceptance Criteria:**
- [ ] Schema generated from existing DB
- [ ] All existing data accessible via Prisma
- [ ] Nested creates work
- [ ] No data loss

---

## 3. FastAPI Setup

### 3.1 Why FastAPI?

Per ARCH-032, FastAPI for agent coordination because:
- **Faster** than Flask/Django for async operations
- **Better for AI agents** — async-native, handles concurrent requests well
- **Auto-docs** — OpenAPI generated automatically
- **Pydantic** — Already using for agent framework (ARCH-008)

### 3.2 Project Structure

```
coding-loops/
├── api/
│   ├── __init__.py
│   ├── main.py
│   ├── routes/
│   │   ├── health.py
│   │   ├── jobs.py
│   │   └── agents.py
│   └── models/
│       └── schemas.py
└── requirements.txt
```

### 3.3 Main App

```python
# coding-loops/api/main.py
from fastapi import FastAPI
from api.routes import health, jobs, agents

app = FastAPI(
    title="Vibe Agent Coordination API",
    description="Fast internal API for agent-to-agent communication",
    version="1.0.0"
)

app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
app.include_router(agents.router, prefix="/agents", tags=["Agents"])
```

### 3.4 Health Routes

```python
# coding-loops/api/routes/health.py
from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    latency_ms: float

@router.get("/", response_model=HealthResponse)
async def health_check():
    start = datetime.utcnow()
    # Quick DB ping here
    latency = (datetime.utcnow() - start).total_seconds() * 1000
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        latency_ms=latency
    )
```

### 3.5 Job Routes

```python
# coding-loops/api/routes/jobs.py
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter()

class JobTrigger(BaseModel):
    job_type: str  # gap_analysis, build, proposal, etc.
    target_id: Optional[str] = None
    params: Optional[dict] = None

class JobResponse(BaseModel):
    job_id: str
    status: str

@router.post("/trigger", response_model=JobResponse)
async def trigger_job(trigger: JobTrigger, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    background_tasks.add_task(execute_job, job_id, trigger)
    return JobResponse(job_id=job_id, status="queued")

@router.get("/{job_id}")
async def get_job_status(job_id: str):
    # Query job status from DB
    pass
```

### 3.6 Agent Status Routes

```python
# coding-loops/api/routes/agents.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from datetime import datetime

router = APIRouter()

class AgentStatus(BaseModel):
    name: str
    status: str
    last_ping: datetime
    current_task: Optional[str]

@router.get("/", response_model=List[AgentStatus])
async def list_agents():
    # Query from AgentHealth table
    pass

@router.post("/{agent_name}/ping")
async def agent_ping(agent_name: str):
    # Update last_ping
    pass

@router.post("/{agent_name}/stuck")
async def report_stuck(agent_name: str, reason: str):
    # Trigger escalation
    pass
```

### 3.7 Run

```bash
cd coding-loops
pip install fastapi uvicorn pydantic
uvicorn api.main:app --reload --port 8001
```

**Acceptance Criteria:**
- [ ] Health endpoint returns in <10ms
- [ ] Job trigger queues successfully
- [ ] OpenAPI docs at `/docs`
- [ ] Agent ping updates health table

---

## 4. Migration Scripts

### 4.1 SQLite Blocks → Neo4j

```typescript
// scripts/migrate-blocks-to-neo4j.ts
import { db } from '../database';
import { driver } from '../config/neo4j';

const TYPE_MAPPING: Record<string, string> = {
  'content': 'Knowledge',
  'synthesis': 'Knowledge',
  'pattern': 'Knowledge',
  'decision': 'Decision',
  'option': 'Decision',
  'assumption': 'Assumption',
  'action': 'Task',
  'external': 'Evidence',
  // Add all mappings from 02-NEO4J-SCHEMA.md
};

async function migrateBlocks() {
  const session = driver.session();
  const blocks = await db.query.memoryBlocks.findMany();
  
  console.log(`Migrating ${blocks.length} blocks...`);
  
  let migrated = 0;
  let errors = 0;
  
  for (const block of blocks) {
    try {
      const newType = TYPE_MAPPING[block.type] || 'Knowledge';
      
      await session.run(`
        CREATE (b:Block:${newType} {
          id: $id,
          sessionId: $sessionId,
          ideaId: $ideaId,
          title: $title,
          content: $content,
          status: $status,
          confidence: $confidence,
          properties: $properties,
          createdAt: datetime($createdAt),
          updatedAt: datetime($updatedAt)
        })
      `, {
        id: block.id,
        sessionId: block.sessionId || 'default',
        ideaId: block.ideaId,
        title: block.title || '',
        content: block.content || '',
        status: block.status || 'active',
        confidence: block.confidence || 0.5,
        properties: JSON.stringify({ migratedFrom: block.type }),
        createdAt: block.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: block.updatedAt?.toISOString() || new Date().toISOString(),
      });
      
      migrated++;
    } catch (err) {
      console.error(`Failed to migrate block ${block.id}:`, err);
      errors++;
    }
  }
  
  console.log(`Migration complete: ${migrated} migrated, ${errors} errors`);
  await session.close();
}
```

### 4.2 Validation

```typescript
// scripts/validate-migration.ts
async function validate() {
  const sqliteCount = await db.query.memoryBlocks.findMany().then(b => b.length);
  
  const session = driver.session();
  const neo4jResult = await session.run('MATCH (b:Block) RETURN count(b) as count');
  const neo4jCount = neo4jResult.records[0].get('count').toNumber();
  
  console.log(`SQLite: ${sqliteCount}, Neo4j: ${neo4jCount}`);
  
  if (sqliteCount !== neo4jCount) {
    console.error('❌ Count mismatch!');
    process.exit(1);
  }
  
  // Spot check 10 random blocks
  const randomBlocks = await db.query.memoryBlocks.findMany({ limit: 10 });
  for (const block of randomBlocks) {
    const result = await session.run(
      'MATCH (b:Block {id: $id}) RETURN b',
      { id: block.id }
    );
    if (result.records.length === 0) {
      console.error(`❌ Block ${block.id} not found in Neo4j`);
      process.exit(1);
    }
    console.log(`✅ Block ${block.id} verified`);
  }
  
  console.log('✅ Migration validated');
  await session.close();
}
```

---

## 5. Exit Criteria

### Neo4j
- [ ] Docker container running
- [ ] Schema applied, all indexes created
- [ ] 100 test blocks created
- [ ] Queries return in <50ms
- [ ] TypeScript connection works

### Prisma
- [ ] Schema generated from existing Drizzle
- [ ] All existing data accessible
- [ ] Nested relations work
- [ ] No data loss

### FastAPI
- [ ] App starts on port 8001
- [ ] Health returns in <10ms
- [ ] Job trigger works
- [ ] Agent ping works
- [ ] Docs at `/docs`

### Migration
- [ ] All blocks migrated
- [ ] Count matches
- [ ] 10 random blocks spot-checked
- [ ] Type mapping correct

### Code Audit
- [ ] P0 components audited
- [ ] Issues documented
- [ ] Blockers have fix plan

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Initial creation | AI Agent (Kai) |
| 2026-02-05 | Simplified migration, clarified FastAPI purpose, generate Prisma from existing | AI Agent (Kai) |

---

*This is a source-truth document. Changes require founder review.*
