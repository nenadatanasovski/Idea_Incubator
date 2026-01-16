import { describe, it, expect, beforeEach, afterEach } from "vitest";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";

describe("SQLite Database", () => {
  let db: SqlJsDatabase;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run(`
      CREATE TABLE ideas (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        idea_type TEXT CHECK(idea_type IN ('business', 'creative', 'technical', 'personal', 'research')),
        lifecycle_stage TEXT DEFAULT 'SPARK',
        score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterEach(() => {
    db.close();
  });

  it("should create table and insert data", () => {
    db.run("INSERT INTO ideas (id, slug, title, score) VALUES (?, ?, ?, ?)", [
      "idea-1",
      "solar-charger",
      "Solar Charger",
      7.5,
    ]);

    const result = db.exec("SELECT * FROM ideas WHERE id = ?", ["idea-1"]);
    expect(result.length).toBeGreaterThan(0);

    const columns = result[0].columns;
    const values = result[0].values[0];
    const row = Object.fromEntries(columns.map((col, i) => [col, values[i]]));

    expect(row.title).toBe("Solar Charger");
    expect(row.score).toBe(7.5);
  });

  it("should enforce unique slug constraint", () => {
    db.run("INSERT INTO ideas (id, slug, title, score) VALUES (?, ?, ?, ?)", [
      "idea-1",
      "solar-charger",
      "Solar Charger",
      7.5,
    ]);

    expect(() => {
      db.run("INSERT INTO ideas (id, slug, title, score) VALUES (?, ?, ?, ?)", [
        "idea-2",
        "solar-charger",
        "Another Solar Charger",
        8.0,
      ]);
    }).toThrow();
  });

  it("should validate idea_type enum", () => {
    // Valid type should work
    expect(() => {
      db.run(
        "INSERT INTO ideas (id, slug, title, idea_type) VALUES (?, ?, ?, ?)",
        ["idea-1", "test-1", "Test", "technical"],
      );
    }).not.toThrow();

    // Invalid type should fail
    expect(() => {
      db.run(
        "INSERT INTO ideas (id, slug, title, idea_type) VALUES (?, ?, ?, ?)",
        ["idea-2", "test-2", "Test", "invalid"],
      );
    }).toThrow();
  });

  it("should set default lifecycle_stage to SPARK", () => {
    db.run("INSERT INTO ideas (id, slug, title) VALUES (?, ?, ?)", [
      "idea-1",
      "test",
      "Test Idea",
    ]);

    const result = db.exec("SELECT lifecycle_stage FROM ideas WHERE id = ?", [
      "idea-1",
    ]);
    const stage = result[0].values[0][0];
    expect(stage).toBe("SPARK");
  });

  it("should support NULL scores for unevaluated ideas", () => {
    db.run("INSERT INTO ideas (id, slug, title) VALUES (?, ?, ?)", [
      "idea-1",
      "test",
      "Test Idea",
    ]);

    const result = db.exec("SELECT score FROM ideas WHERE id = ?", ["idea-1"]);
    const score = result[0].values[0][0];
    expect(score).toBeNull();
  });

  it("should query ideas by lifecycle stage", () => {
    db.run(
      "INSERT INTO ideas (id, slug, title, lifecycle_stage) VALUES (?, ?, ?, ?)",
      ["idea-1", "idea-1", "Idea 1", "SPARK"],
    );
    db.run(
      "INSERT INTO ideas (id, slug, title, lifecycle_stage) VALUES (?, ?, ?, ?)",
      ["idea-2", "idea-2", "Idea 2", "EVALUATE"],
    );
    db.run(
      "INSERT INTO ideas (id, slug, title, lifecycle_stage) VALUES (?, ?, ?, ?)",
      ["idea-3", "idea-3", "Idea 3", "SPARK"],
    );

    const result = db.exec("SELECT * FROM ideas WHERE lifecycle_stage = ?", [
      "SPARK",
    ]);
    expect(result[0].values.length).toBe(2);
  });
});
