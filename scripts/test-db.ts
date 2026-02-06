import { getDb, exec, query, closeDb } from '../database/db.js';

async function test() {
  try {
    const db = await getDb();
    console.log('DB connected');
    
    // Check if task_appendices exists
    const tables = await query<{name: string}>('SELECT name FROM sqlite_master WHERE type="table" AND name="task_appendices"');
    console.log('task_appendices exists:', tables.length > 0);
    
    // Check if tasks table exists  
    const taskTable = await query<{name: string}>('SELECT name FROM sqlite_master WHERE type="table" AND name="tasks"');
    console.log('tasks table exists:', taskTable.length > 0);
    
    // Check for foreign key constraints
    if (tables.length > 0) {
      const fk = await query<{sql: string}>('SELECT sql FROM sqlite_master WHERE type="table" AND name="task_appendices"');
      console.log('task_appendices schema:', fk[0]?.sql);
    }
    
    // Try to execute the problematic SQL manually
    try {
      await exec(`
        INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
        VALUES ('test-123', 'obs-200', 'test_context', 'Test', 'content', datetime('now'))
      `);
      console.log('INSERT succeeded');
    } catch (e) {
      console.log('INSERT failed:', (e as Error).message);
    }
    
    await closeDb();
  } catch (e) {
    console.error('Error:', (e as Error).message);
  }
}

test();
