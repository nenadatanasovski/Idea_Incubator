import { getDb, exec, query, closeDb } from '../database/db.js';
void getDb;

async function testMigration() {
  try {
    await getDb();
    console.log('DB connected');
    
    // Check current table schema
    const schema = await query<{sql: string}>('SELECT sql FROM sqlite_master WHERE type="table" AND name="task_appendices"');
    console.log('Current schema:', schema[0]?.sql);
    
    // Try each step of migration 100
    console.log('\n--- Step 1: Rename table ---');
    try {
      await exec('ALTER TABLE task_appendices RENAME TO task_appendices_old');
      console.log('Step 1 SUCCESS');
    } catch (e) {
      console.log('Step 1 FAILED:', (e as Error).message);
    }
    
    console.log('\n--- Step 2: Drop indexes ---');
    try {
      await exec('DROP INDEX IF EXISTS idx_task_appendices_task_id');
      await exec('DROP INDEX IF EXISTS idx_task_appendices_type');
      console.log('Step 2 SUCCESS');
    } catch (e) {
      console.log('Step 2 FAILED:', (e as Error).message);
    }
    
    console.log('\n--- Step 3: Create new table ---');
    const createSql = `CREATE TABLE task_appendices (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      appendix_type TEXT NOT NULL CHECK (appendix_type IN (
        'prd_reference', 'code_context', 'gotcha_list', 'rollback_plan',
        'test_context', 'dependency_notes', 'architecture_decision',
        'user_story', 'acceptance_criteria', 'research_notes', 'api_contract',
        'test_commands'
      )),
      content_type TEXT NOT NULL CHECK (content_type IN ('inline', 'reference')),
      content TEXT,
      reference_id TEXT,
      reference_table TEXT,
      title TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`;
    try {
      await exec(createSql);
      console.log('Step 3 SUCCESS');
    } catch (e) {
      console.log('Step 3 FAILED:', (e as Error).message);
    }
    
    console.log('\n--- Step 4: Copy data ---');
    const copySql = `INSERT INTO task_appendices (
      id, task_id, appendix_type, content_type, content,
      reference_id, reference_table, title, position, created_at, updated_at
    )
    SELECT
      id, task_id, appendix_type, content_type, content,
      reference_id, reference_table, NULL, position, created_at, updated_at
    FROM task_appendices_old`;
    try {
      await exec(copySql);
      console.log('Step 4 SUCCESS');
    } catch (e) {
      console.log('Step 4 FAILED:', (e as Error).message);
    }
    
    await closeDb();
  } catch (e) {
    console.error('Error:', (e as Error).message);
  }
}

testMigration();
