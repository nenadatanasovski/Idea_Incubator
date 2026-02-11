#!/usr/bin/env tsx
/**
 * Neo4j Verification Script
 * Tests: 100 blocks insertion + query performance (<50ms)
 */

import neo4j from "neo4j-driver";

const driver = neo4j.driver(
  process.env.NEO4J_URI || "bolt://localhost:7687",
  neo4j.auth.basic(
    process.env.NEO4J_USER || "neo4j",
    process.env.NEO4J_PASSWORD || "vibedevpassword",
  ),
);

async function main() {
  console.log("🔧 Neo4j Performance Verification\n");
  console.log("============================================================\n");

  const session = driver.session();

  try {
    // Clean up any existing test blocks
    console.log("🧹 Cleaning up previous test data...");
    await session.run(
      'MATCH (b:Block) WHERE b.id STARTS WITH "test-perf-" DELETE b',
    );

    // Insert 100 test blocks
    console.log("📦 Inserting 100 test blocks...");
    const insertStart = performance.now();

    const blocks = Array.from({ length: 100 }, (_, i) => ({
      id: `test-perf-${i}`,
      type: [
        "CONTEXT",
        "KNOWLEDGE",
        "GOAL",
        "TASK",
        "DECISION",
        "QUESTION",
        "OBSERVATION",
        "ARTIFACT",
        "ARCHIVE",
      ][i % 9],
      title: `Test Block ${i}`,
      content: `This is test content for block ${i}. It contains some searchable text about testing and performance verification.`,
      sessionId: `test-session-${Math.floor(i / 10)}`,
      status: ["active", "archived", "deleted"][i % 3],
      confidence: Math.random(),
      abstractionLevel: Math.floor(Math.random() * 5) + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    for (const block of blocks) {
      await session.run(
        `CREATE (b:Block {
          id: $id,
          type: $type,
          title: $title,
          content: $content,
          sessionId: $sessionId,
          status: $status,
          confidence: $confidence,
          abstractionLevel: $abstractionLevel,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })`,
        block,
      );
    }

    const insertEnd = performance.now();
    const insertTime = insertEnd - insertStart;
    console.log(
      `  ✅ Inserted 100 blocks in ${insertTime.toFixed(2)}ms (${(insertTime / 100).toFixed(2)}ms/block)\n`,
    );

    // Test queries
    console.log("🔍 Testing query performance...\n");

    const queries = [
      {
        name: "Count all blocks",
        query: "MATCH (b:Block) RETURN count(b) as count",
      },
      {
        name: "Find by type (TASK)",
        query: 'MATCH (b:Block {type: "TASK"}) RETURN b LIMIT 10',
      },
      {
        name: "Find by sessionId",
        query: 'MATCH (b:Block {sessionId: "test-session-5"}) RETURN b',
      },
      {
        name: "Find active blocks",
        query: 'MATCH (b:Block {status: "active"}) RETURN b LIMIT 20',
      },
      {
        name: "Full-text search",
        query:
          'CALL db.index.fulltext.queryNodes("block_content_search", "testing") YIELD node RETURN node LIMIT 10',
      },
      {
        name: "Complex filter (type + status + confidence)",
        query:
          'MATCH (b:Block) WHERE b.type = "KNOWLEDGE" AND b.status = "active" AND b.confidence > 0.5 RETURN b LIMIT 10',
      },
    ];

    let allPassed = true;
    const THRESHOLD_MS = 50;

    for (const { name, query } of queries) {
      const times: number[] = [];

      // Run 5 times and average
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await session.run(query);
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const passed = avgTime < THRESHOLD_MS;

      if (!passed) allPassed = false;

      console.log(
        `  ${passed ? "✅" : "❌"} ${name}: ${avgTime.toFixed(2)}ms (avg of 5) ${passed ? "" : `> ${THRESHOLD_MS}ms threshold`}`,
      );
    }

    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await session.run(
      'MATCH (b:Block) WHERE b.id STARTS WITH "test-perf-" DELETE b',
    );
    console.log("  ✅ Test data removed");

    console.log(
      "\n============================================================",
    );
    if (allPassed) {
      console.log("✅ All performance tests PASSED (<50ms per query)");
    } else {
      console.log("❌ Some performance tests FAILED (>50ms)");
      process.exitCode = 1;
    }
  } finally {
    await session.close();
    await driver.close();
    console.log("\n[Neo4j] Connection closed");
  }
}

main().catch(console.error);
