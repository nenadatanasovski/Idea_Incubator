import { extractKeyInsights } from '../../agents/ideation/handoff-generator.js';

async function main() {
  const insights = await extractKeyInsights('test-user', 'test-idea');

  // Check if array
  if (!Array.isArray(insights)) {
    process.stderr.write('FAIL: insights is not an array\n');
    process.exit(1);
  }

  // Check each insight
  const validCategories = ['market', 'competition', 'users', 'risk', 'technical', 'other'];
  for (const i of insights) {
    if (!validCategories.includes(i.category)) {
      process.stderr.write('FAIL: invalid category ' + i.category + '\n');
      process.exit(1);
    }
    if (i.summary.length === 0) {
      process.stderr.write('FAIL: empty summary\n');
      process.exit(1);
    }
  }

  process.stdout.write('PASS\n');
}

main().catch((err) => {
  process.stderr.write('FAIL: ' + String(err) + '\n');
  process.exit(1);
});
