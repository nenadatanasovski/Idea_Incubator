import { setAiRecommended, getAiRecommended, loadPriorityRules } from '../../agents/ideation/priority-manager.js';
import * as fs from 'fs';
import * as path from 'path';

async function testAiRecommended() {
  const userSlug = 'test-user';
  const ideaSlug = 'test-idea';

  console.log('TEST-SC-014: AI-Recommended Documents\n');

  // Test 1: Set AI recommended docs
  console.log('Test 1: Setting AI recommended docs...');
  await setAiRecommended(userSlug, ideaSlug, ['validation/assumptions.md', 'research/competitive.md']);

  // Verify the file was updated
  const priorityPath = path.join('users', userSlug, 'ideas', ideaSlug, '.metadata', 'priority.json');
  const content = fs.readFileSync(priorityPath, 'utf-8');
  const priority = JSON.parse(content);

  console.log('  Priority file exists:', fs.existsSync(priorityPath));
  console.log('  ai_recommended:', priority.ai_recommended);

  if (priority.ai_recommended.length !== 2) {
    throw new Error(`Expected 2 items, got ${priority.ai_recommended.length}`);
  }
  if (!priority.ai_recommended.includes('validation/assumptions.md')) {
    throw new Error('Missing validation/assumptions.md');
  }
  console.log('  PASS: setAiRecommended works\n');

  // Test 2: Get AI recommended docs
  console.log('Test 2: Getting AI recommended docs...');
  const recommended = await getAiRecommended(userSlug, ideaSlug);
  console.log('  returned:', recommended);

  if (recommended.length !== 2) {
    throw new Error(`Expected 2 items, got ${recommended.length}`);
  }
  if (!recommended.includes('validation/assumptions.md')) {
    throw new Error('Missing validation/assumptions.md');
  }
  console.log('  PASS: getAiRecommended works\n');

  // Test 3: Replaces (not appends) the list
  console.log('Test 3: Testing replace behavior...');
  await setAiRecommended(userSlug, ideaSlug, ['new/doc.md']);
  const afterReplace = await getAiRecommended(userSlug, ideaSlug);
  console.log('  After replace:', afterReplace);

  if (afterReplace.length !== 1) {
    throw new Error(`Expected 1 item after replace, got ${afterReplace.length}`);
  }
  if (afterReplace[0] !== 'new/doc.md') {
    throw new Error(`Expected new/doc.md, got ${afterReplace[0]}`);
  }
  console.log('  PASS: setAiRecommended replaces (not appends)\n');

  // Test 4: Empty array clears recommendations
  console.log('Test 4: Testing empty array clears...');
  await setAiRecommended(userSlug, ideaSlug, []);
  const afterClear = await getAiRecommended(userSlug, ideaSlug);
  console.log('  After clear:', afterClear);

  if (afterClear.length !== 0) {
    throw new Error(`Expected 0 items after clear, got ${afterClear.length}`);
  }
  console.log('  PASS: Empty array clears recommendations\n');

  // Test 5: Changes are persisted
  console.log('Test 5: Testing persistence...');
  await setAiRecommended(userSlug, ideaSlug, ['persisted/doc.md']);
  const rules = loadPriorityRules(userSlug, ideaSlug);
  console.log('  From loadPriorityRules:', rules.ai_recommended);

  if (rules.ai_recommended.length !== 1 || rules.ai_recommended[0] !== 'persisted/doc.md') {
    throw new Error('Changes not persisted correctly');
  }
  console.log('  PASS: Changes persisted to priority.json\n');

  console.log('='.repeat(50));
  console.log('ALL TESTS PASSED for TEST-SC-014');
  console.log('='.repeat(50));
}

testAiRecommended().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
