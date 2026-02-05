# Phase 1: Foundation Implementation

> **Source of Truth** for Neo4j + Prisma migration and FastAPI setup.
> 
> Related: `02-NEO4J-SCHEMA.md`, `03-CONSOLIDATED-PLAN.md`, `04-CODE-AUDIT-CHECKLIST.md`

---

## Overview

Phase 1 establishes the solid storage foundation everything else builds on:

1. **Neo4j** — Graph database for knowledge (blocks, relationships)
2. **Prisma** — Postgres ORM for operational state (tasks, sessions, users)
3. **FastAPI** — Python coordination layer for agent communication
4. **Code Audit** — Align existing code with ARCH decisions

**Branch:** `foundation/neo4j-prisma`

**Duration:** Weeks 1-3

---

## 1. Neo4j Setup

### 1.1 Local Development

```bash
# Docker Compose for local dev
docker-compose -f docker-compose.neo4j.yml up -d
```

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
      - neo4j_logs:/logs

volumes:
  neo4j_data:
  neo4j_logs:
```

### 1.2 Schema Application

Apply schema from `02-NEO4J-SCHEMA.md`:

```bash
# Run schema setup script
npm run neo4j:schema
```

Script should:
1. Create constraints (Block id unique)
2. Create indexes (session, status, title, etc.)
3. Create full-text search index
4. Verify with test queries

### 1.3 Connection Configuration

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

export async function getSession() {
  return driver.session();
}
```

### 1.4 Verification Queries

```cypher
// Verify schema
SHOW CONSTRAINTS;
SHOW INDEXES;

// Test block creation
CREATE (b:Block:Knowledge {
  id: 'test-001',
  sessionId: 'test-session',
  title: 'Test block',
  content: 'Test content',
  status: 'active',
  createdAt: datetime(),
  updatedAt: datetime()
})
RETURN b;

// Cleanup
MATCH (b:Block {id: 'test-001'}) DELETE b;
```

---

## 2. Prisma Setup

### 2.1 Installation

```bash
npm install prisma @prisma/client
npx prisma init
```

### 2.2 Schema Definition

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// === Operational State ===

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  sessions  Session[]
  ideas     Idea[]
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  channel   String   // telegram, web, cli
  kind      String   // main, isolated, sub-agent
  createdAt DateTime @default(now())
  lastActivityAt DateTime @updatedAt
  
  messages  Message[]
  tasks     Task[]
}

model Message {
  id        String   @id @default(uuid())
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id])
  role      String   // user, assistant, system, tool
  content   String
  timestamp DateTime @default(now())
  
  // Tool-specific
  toolCallId String?
  toolName   String?
  toolResult Json?
}

model Idea {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  description String?
  status      String   @default("draft") // draft, active, validated, archived
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tasks       Task[]
}

model Task {
  id          String   @id @default(uuid())
  sessionId   String?
  session     Session? @relation(fields: [sessionId], references: [id])
  ideaId      String?
  idea        Idea?    @relation(fields: [ideaId], references: [id])
  
  title       String
  description String?
  status      String   @default("pending") // pending, in_progress, completed, blocked, failed
  priority    String   @default("P2") // P0, P1, P2, P3
  
  // Execution tracking
  assignedTo  String?  // agent or loop name
  startedAt   DateTime?
  completedAt DateTime?
  error       String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Self-referential for subtasks
  parentId    String?
  parent      Task?    @relation("TaskSubtasks", fields: [parentId], references: [id])
  subtasks    Task[]   @relation("TaskSubtasks")
}

// === Coordination State ===

model AgentHealth {
  id          String   @id @default(uuid())
  agentName   String   @unique
  status      String   // healthy, degraded, unhealthy
  lastPing    DateTime @default(now())
  errorCount  Int      @default(0)
  lastError   String?
}

model ApprovalRequest {
  id          String   @id @default(uuid())
  proposalId  String   // References Neo4j Proposal block
  status      String   @default("pending") // pending, approved, rejected
  requestedAt DateTime @default(now())
  decidedAt   DateTime?
  decidedBy   String?
  reason      String?  // Rejection reason
}
```

### 2.3 Migration

```bash
# Generate migration
npx prisma migrate dev --name init

# Generate client
npx prisma generate
```

### 2.4 Client Usage

```typescript
// utils/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Example: Create task with subtasks
const task = await prisma.task.create({
  data: {
    title: 'Implement feature X',
    status: 'pending',
    subtasks: {
      create: [
        { title: 'Design API', status: 'pending' },
        { title: 'Write tests', status: 'pending' },
        { title: 'Implement', status: 'pending' },
      ]
    }
  },
  include: { subtasks: true }
});
```

---

## 3. FastAPI Setup

### 3.1 Project Structure

```
coding-loops/
├── api/
│   ├── __init__.py
│   ├── main.py           # FastAPI app
│   ├── routes/
│   │   ├── health.py     # Health checks
│   │   ├── jobs.py       # Job triggers
│   │   └── status.py     # Agent status
│   └── models/
│       └── schemas.py    # Pydantic models
├── shared/
│   └── ... (existing)
└── requirements.txt      # Add fastapi, uvicorn
```

### 3.2 Main App

```python
# coding-loops/api/main.py
from fastapi import FastAPI
from api.routes import health, jobs, status

app = FastAPI(
    title="Vibe Agent Coordination API",
    description="Internal API for agent-to-agent communication",
    version="1.0.0"
)

app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
app.include_router(status.router, prefix="/status", tags=["Status"])

@app.get("/")
async def root():
    return {"service": "vibe-coordination", "status": "running"}
```

### 3.3 Health Routes

```python
# coding-loops/api/routes/health.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime

router = APIRouter()

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    components: Dict[str, Any]

@router.get("/", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        components={
            "neo4j": await check_neo4j(),
            "postgres": await check_postgres(),
            "message_bus": await check_message_bus(),
        }
    )

@router.get("/agent/{agent_name}")
async def agent_health(agent_name: str):
    # Query agent health from DB
    pass
```

### 3.4 Job Routes

```python
# coding-loops/api/routes/jobs.py
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class JobTrigger(BaseModel):
    job_type: str  # gap_analysis, build, etc.
    target_id: Optional[str] = None
    params: Optional[dict] = None

class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str

@router.post("/trigger", response_model=JobResponse)
async def trigger_job(trigger: JobTrigger, background_tasks: BackgroundTasks):
    job_id = generate_job_id()
    background_tasks.add_task(execute_job, job_id, trigger)
    return JobResponse(
        job_id=job_id,
        status="queued",
        message=f"Job {trigger.job_type} queued"
    )

@router.get("/{job_id}/status")
async def job_status(job_id: str):
    # Query job status
    pass
```

### 3.5 Running the API

```bash
# Add to requirements.txt
fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.0.0

# Run
cd coding-loops
uvicorn api.main:app --reload --port 8001
```

---

## 4. Migration Scripts

### 4.1 SQLite → Neo4j (Blocks)

```typescript
// scripts/migrate-blocks-to-neo4j.ts
import { db } from '../database';
import { getSession } from '../config/neo4j';

async function migrateBlocks() {
  const session = await getSession();
  
  // Get all blocks from SQLite
  const blocks = await db.query.memoryBlocks.findMany();
  
  console.log(`Migrating ${blocks.length} blocks...`);
  
  for (const block of blocks) {
    // Map old type to new 9 types
    const newType = mapBlockType(block.type);
    
    await session.run(`
      CREATE (b:Block:${newType} {
        id: $id,
        sessionId: $sessionId,
        ideaId: $ideaId,
        title: $title,
        content: $content,
        status: $status,
        confidence: $confidence,
        createdAt: datetime($createdAt),
        updatedAt: datetime($updatedAt)
      })
    `, {
      id: block.id,
      sessionId: block.sessionId,
      ideaId: block.ideaId,
      title: block.title,
      content: block.content,
      status: block.status || 'active',
      confidence: block.confidence || 0.5,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    });
  }
  
  console.log('Block migration complete');
  await session.close();
}

function mapBlockType(oldType: string): string {
  const mapping: Record<string, string> = {
    'content': 'Knowledge',
    'synthesis': 'Knowledge',
    'pattern': 'Knowledge',
    'decision': 'Decision',
    'option': 'Decision',
    'assumption': 'Assumption',
    'action': 'Task',
    'external': 'Evidence',
    // ... etc from 02-NEO4J-SCHEMA.md
  };
  return mapping[oldType] || 'Knowledge';
}
```

### 4.2 Drizzle → Prisma (Operational)

```typescript
// scripts/migrate-drizzle-to-prisma.ts
import { db as drizzleDb } from '../database';
import { prisma } from '../utils/prisma';

async function migrateOperational() {
  // Migrate users
  const users = await drizzleDb.query.users.findMany();
  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      }
    });
  }
  
  // Migrate sessions
  const sessions = await drizzleDb.query.sessions.findMany();
  for (const session of sessions) {
    await prisma.session.create({
      data: {
        id: session.id,
        userId: session.userId,
        channel: session.channel || 'web',
        kind: session.kind || 'main',
        createdAt: session.createdAt,
      }
    });
  }
  
  // Migrate tasks
  const tasks = await drizzleDb.query.tasks.findMany();
  for (const task of tasks) {
    await prisma.task.create({
      data: {
        id: task.id,
        sessionId: task.sessionId,
        ideaId: task.ideaId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority || 'P2',
        createdAt: task.createdAt,
      }
    });
  }
  
  console.log('Operational data migration complete');
}
```

### 4.3 Migration Validation

```typescript
// scripts/validate-migration.ts
async function validateMigration() {
  // Count comparison
  const sqliteBlockCount = await db.query.memoryBlocks.findMany().then(b => b.length);
  const neo4jBlockCount = await neo4jSession.run('MATCH (b:Block) RETURN count(b) as count')
    .then(r => r.records[0].get('count').toNumber());
  
  console.log(`SQLite blocks: ${sqliteBlockCount}`);
  console.log(`Neo4j blocks: ${neo4jBlockCount}`);
  
  if (sqliteBlockCount !== neo4jBlockCount) {
    throw new Error('Block count mismatch!');
  }
  
  // Relationship validation
  // ... similar checks for links
  
  console.log('✅ Migration validated');
}
```

---

## 5. Exit Criteria Checklist

### Neo4j
- [ ] Docker container running
- [ ] Schema applied (constraints + indexes)
- [ ] Test block creation works
- [ ] Full-text search works
- [ ] Connection from TypeScript works

### Prisma
- [ ] Schema defined
- [ ] Migrations applied
- [ ] Client generated
- [ ] CRUD operations work
- [ ] Nested creates work

### FastAPI
- [ ] App starts on port 8001
- [ ] Health endpoint responds
- [ ] Job trigger endpoint works
- [ ] OpenAPI docs at `/docs`

### Migration
- [ ] Block migration script works
- [ ] Operational data migrated
- [ ] Validation passes
- [ ] No data loss

### Code Audit
- [ ] All components audited
- [ ] Issues documented
- [ ] Blockers resolved
- [ ] Major issues have tasks

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Initial creation | AI Agent (Kai) |

---

*This is a source-truth document. Changes require founder review.*
