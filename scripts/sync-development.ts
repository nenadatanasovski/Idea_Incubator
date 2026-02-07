#!/usr/bin/env tsx
/**
 * Development Markdown Sync Service
 * 
 * FIXES CRITICAL GAP: development.md content not being picked up by evaluators
 * 
 * This script:
 * 1. Parses development.md files for each idea
 * 2. Extracts Q&A pairs
 * 3. Syncs to Memory Graph (Neo4j) as knowledge blocks
 * 4. Syncs to SQLite idea_answers table for evaluator compatibility
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { query, run, saveDb, closeDb } from "../database/db.js";
import { logInfo, logSuccess, logError, logWarning } from "../utils/logger.js";
import neo4j, { Driver } from "neo4j-driver";
import { randomUUID } from "crypto";

// ============================================
// Types
// ============================================

interface QAPair {
  question: string;
  answer: string;
  category?: string;
  date?: string;
}

interface DevelopmentData {
  ideaSlug: string;
  ideaId?: string;
  lastUpdated?: string;
  qaPairs: QAPair[];
  gaps: string[];
  insights: string[];
  nextSteps: string[];
}

interface SyncResult {
  ideaSlug: string;
  qaPairsFound: number;
  blocksCreated: number;
  answersInserted: number;
  errors: string[];
}

// ============================================
// Parser
// ============================================

function parseQAPairs(content: string): QAPair[] {
  const pairs: QAPair[] = [];
  
  // Pattern 1: Q: ... A: ... format
  const qaPattern = /Q:\s*(.+?)\nA:\s*(.+?)(?=\n\nQ:|\n##|\n---|\$)/gs;
  let match;
  
  while ((match = qaPattern.exec(content)) !== null) {
    pairs.push({
      question: match[1].trim(),
      answer: match[2].trim(),
    });
  }
  
  // Pattern 2: Table format | Question | Answer | ... |
  const _tablePattern = /\|\s*(.+?)\s*\|\s*(.+?)\s*\|(?:\s*(.+?)\s*\|)?(?:\s*(.+?)\s*\|)?/g;
  const lines = content.split("\n");
  let inTable = false;
  let isHeaderRow = true;
  
  for (const line of lines) {
    if (line.includes("|") && !line.includes("---")) {
      if (isHeaderRow && (line.toLowerCase().includes("question") || line.toLowerCase().includes("answer"))) {
        inTable = true;
        isHeaderRow = false;
        continue;
      }
      
      if (inTable) {
        const cells = line.split("|").map(c => c.trim()).filter(c => c);
        if (cells.length >= 2 && cells[0] && cells[1]) {
          // Skip header rows
          if (cells[0].toLowerCase() === "question") continue;
          
          pairs.push({
            question: cells[0],
            answer: cells[1],
            category: cells[2] || undefined,
            date: cells[3] || undefined,
          });
        }
      }
    } else if (line.startsWith("##") || line.startsWith("---")) {
      inTable = false;
      isHeaderRow = true;
    }
  }
  
  return pairs;
}

function parseBulletList(content: string, sectionName: string): string[] {
  const items: string[] = [];
  const sectionPattern = new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=\\n##|$)`, "i");
  const match = content.match(sectionPattern);
  
  if (match) {
    const bulletPattern = /^[\-\*]\s*(?:\[.\])?\s*(.+)$/gm;
    let bulletMatch;
    while ((bulletMatch = bulletPattern.exec(match[0])) !== null) {
      const item = bulletMatch[1].trim();
      if (item && !item.startsWith("Defined:")) {
        items.push(item);
      }
    }
  }
  
  return items;
}

function parseDevelopmentMd(filePath: string, ideaSlug: string): DevelopmentData {
  const content = fs.readFileSync(filePath, "utf-8");
  
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let lastUpdated: string | undefined;
  let ideaId: string | undefined;
  
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const dateMatch = frontmatter.match(/last_updated:\s*(.+)/);
    if (dateMatch) lastUpdated = dateMatch[1].trim();
    const idMatch = frontmatter.match(/id:\s*["']?(.+?)["']?$/m);
    if (idMatch) ideaId = idMatch[1].trim();
  }
  
  return {
    ideaSlug,
    ideaId,
    lastUpdated,
    qaPairs: parseQAPairs(content),
    gaps: parseBulletList(content, "Identified Gaps"),
    insights: parseBulletList(content, "Key Insights"),
    nextSteps: parseBulletList(content, "Next Steps"),
  };
}

// ============================================
// Neo4j Sync
// ============================================

async function syncToNeo4j(driver: Driver, data: DevelopmentData): Promise<number> {
  const session = driver.session();
  let blocksCreated = 0;
  
  try {
    const sessionId = `dev-sync-${data.ideaSlug}-${Date.now()}`;
    
    // Create knowledge blocks for Q&A pairs
    for (const qa of data.qaPairs) {
      const blockId = randomUUID();
      await session.run(`
        CREATE (b:Block {
          id: $id,
          type: 'knowledge',
          title: $title,
          content: $content,
          sessionId: $sessionId,
          ideaId: $ideaId,
          status: 'active',
          source: 'development.md',
          createdAt: datetime(),
          updatedAt: datetime()
        })
      `, {
        id: blockId,
        title: qa.question.substring(0, 100),
        content: `Q: ${qa.question}\nA: ${qa.answer}`,
        sessionId,
        ideaId: data.ideaId || data.ideaSlug,
      });
      blocksCreated++;
    }
    
    // Create assumption blocks for gaps
    for (const gap of data.gaps) {
      const blockId = randomUUID();
      await session.run(`
        CREATE (b:Block {
          id: $id,
          type: 'question',
          title: 'Identified Gap',
          content: $content,
          sessionId: $sessionId,
          ideaId: $ideaId,
          status: 'active',
          source: 'development.md',
          createdAt: datetime(),
          updatedAt: datetime()
        })
      `, {
        id: blockId,
        content: gap,
        sessionId,
        ideaId: data.ideaId || data.ideaSlug,
      });
      blocksCreated++;
    }
    
    // Create knowledge blocks for insights
    for (const insight of data.insights) {
      const blockId = randomUUID();
      await session.run(`
        CREATE (b:Block {
          id: $id,
          type: 'knowledge',
          title: 'Key Insight',
          content: $content,
          sessionId: $sessionId,
          ideaId: $ideaId,
          status: 'validated',
          source: 'development.md',
          createdAt: datetime(),
          updatedAt: datetime()
        })
      `, {
        id: blockId,
        content: insight,
        sessionId,
        ideaId: data.ideaId || data.ideaSlug,
      });
      blocksCreated++;
    }
    
  } finally {
    await session.close();
  }
  
  return blocksCreated;
}

// ============================================
// SQLite Sync (for evaluator compatibility)
// ============================================

async function syncToSQLite(data: DevelopmentData): Promise<number> {
  let answersInserted = 0;
  
  // Get idea ID from database if not in frontmatter
  let ideaId = data.ideaId;
  if (!ideaId) {
    const ideas = await query<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [data.ideaSlug]
    );
    if (ideas.length > 0) {
      ideaId = ideas[0].id;
    }
  }
  
  if (!ideaId) {
    return 0; // Can't sync without idea ID
  }
  
  // Ensure idea_answers table exists
  run(`
    CREATE TABLE IF NOT EXISTS idea_answers (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL,
      question_id TEXT,
      question_text TEXT NOT NULL,
      answer_text TEXT NOT NULL,
      category TEXT,
      source TEXT DEFAULT 'development.md',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (idea_id) REFERENCES ideas(id)
    )
  `);
  
  // Clear existing answers from this source
  run(
    "DELETE FROM idea_answers WHERE idea_id = ? AND source = 'development.md'",
    [ideaId]
  );
  
  // Insert Q&A pairs
  for (const qa of data.qaPairs) {
    const answerId = randomUUID();
    run(`
      INSERT INTO idea_answers (id, idea_id, question_text, answer_text, category, source)
      VALUES (?, ?, ?, ?, ?, 'development.md')
    `, [answerId, ideaId, qa.question, qa.answer, qa.category || "general"]);
    answersInserted++;
  }
  
  return answersInserted;
}

// ============================================
// Main
// ============================================

async function findDevelopmentFiles(): Promise<{ filePath: string; slug: string }[]> {
  const ideasDir = path.join(process.cwd(), "ideas");
  const files: { filePath: string; slug: string }[] = [];
  
  if (!fs.existsSync(ideasDir)) {
    logWarning("No ideas directory found");
    return files;
  }
  
  const slugs = fs.readdirSync(ideasDir).filter(f => 
    fs.statSync(path.join(ideasDir, f)).isDirectory()
  );
  
  for (const slug of slugs) {
    const devFile = path.join(ideasDir, slug, "development.md");
    if (fs.existsSync(devFile)) {
      files.push({ filePath: devFile, slug });
    }
  }
  
  return files;
}

async function main() {
  logInfo("Starting development.md sync...");
  
  // Connect to Neo4j
  const neo4jUri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const neo4jUser = process.env.NEO4J_USER || "neo4j";
  const neo4jPassword = process.env.NEO4J_PASSWORD || "vibedevpassword";
  
  let driver: Driver | null = null;
  
  try {
    driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
    await driver.verifyConnectivity();
    logSuccess("Connected to Neo4j");
  } catch (error) {
    logWarning("Neo4j not available, will sync to SQLite only");
    driver = null;
  }
  
  // Find all development.md files
  const files = await findDevelopmentFiles();
  logInfo(`Found ${files.length} development.md files`);
  
  const results: SyncResult[] = [];
  
  for (const { filePath, slug } of files) {
    const result: SyncResult = {
      ideaSlug: slug,
      qaPairsFound: 0,
      blocksCreated: 0,
      answersInserted: 0,
      errors: [],
    };
    
    try {
      // Parse the file
      const data = parseDevelopmentMd(filePath, slug);
      result.qaPairsFound = data.qaPairs.length;
      
      if (data.qaPairs.length === 0) {
        logWarning(`${slug}: No Q&A pairs found`);
        continue;
      }
      
      // Sync to Neo4j
      if (driver) {
        result.blocksCreated = await syncToNeo4j(driver, data);
      }
      
      // Sync to SQLite
      result.answersInserted = await syncToSQLite(data);
      
      logSuccess(`${slug}: ${result.qaPairsFound} Q&A → ${result.blocksCreated} blocks, ${result.answersInserted} answers`);
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(msg);
      logError(`${slug}: ${msg}`);
    }
    
    results.push(result);
  }
  
  // Summary
  const totalQA = results.reduce((sum, r) => sum + r.qaPairsFound, 0);
  const totalBlocks = results.reduce((sum, r) => sum + r.blocksCreated, 0);
  const totalAnswers = results.reduce((sum, r) => sum + r.answersInserted, 0);
  
  logInfo("\n=== Sync Summary ===");
  logInfo(`Ideas processed: ${results.length}`);
  logInfo(`Total Q&A pairs: ${totalQA}`);
  logInfo(`Neo4j blocks created: ${totalBlocks}`);
  logInfo(`SQLite answers inserted: ${totalAnswers}`);
  
  // Cleanup
  saveDb();
  closeDb();
  if (driver) {
    await driver.close();
  }
  
  process.exit(0);
}

main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
