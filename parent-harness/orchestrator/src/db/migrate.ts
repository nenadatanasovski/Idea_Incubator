import db from './index.js';

console.log('🔄 Running database migration...');

try {
  db.migrate();
  
  // Verify tables were created
  const tables = db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  
  console.log(`📊 Created ${tables.length} tables:`);
  tables.forEach((t) => console.log(`   - ${t.name}`));
  
  db.close();
  console.log('✅ Migration complete');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
