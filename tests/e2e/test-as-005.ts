/**
 * TEST-AS-005: Implement saveArtifact
 *
 * Verification script for the saveArtifact function implementation
 */

import { saveArtifact, parseFrontmatter } from '../../agents/ideation/unified-artifact-store.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_USER = 'test-user';
const TEST_IDEA = 'test-idea';

// Helper function to clean up test directories
function cleanupTestDir(): void {
  const usersRoot = path.resolve(process.cwd(), 'users');
  const testUserDir = path.join(usersRoot, TEST_USER);
  if (fs.existsSync(testUserDir)) {
    fs.rmSync(testUserDir, { recursive: true, force: true });
  }
}

// Helper function to get the idea folder path
function getIdeaFolder(): string {
  return path.resolve(process.cwd(), 'users', TEST_USER, 'ideas', TEST_IDEA);
}

async function runTests(): Promise<void> {
  console.log('=== TEST-AS-005: Implement saveArtifact ===\n');

  let passed = 0;
  let failed = 0;

  // Clean up before tests
  cleanupTestDir();

  // Test 1: Function is exported
  try {
    if (typeof saveArtifact === 'function') {
      console.log('✓ PASS: Function saveArtifact is exported');
      passed++;
    } else {
      throw new Error('saveArtifact is not a function');
    }
  } catch (error) {
    console.log('✗ FAIL: Function saveArtifact is exported - ' + error);
    failed++;
  }

  // Test 2: Creates file at correct path
  try {
    const _artifact = await saveArtifact(TEST_USER, TEST_IDEA, {
      type: 'markdown',
      title: 'Test Doc',
      content: '# Test\nContent here',
      sessionId: 'session-123'
    });

    const ideaFolder = getIdeaFolder();
    const filePath = path.join(ideaFolder, artifact.filePath);

    if (fs.existsSync(filePath)) {
      console.log(`✓ PASS: Creates file at correct path (${artifact.filePath})`);
      passed++;
    } else {
      throw new Error(`File not found at ${filePath}`);
    }
  } catch (error) {
    console.log(`✗ FAIL: Creates file at correct path - ${error}`);
    failed++;
  }

  // Test 3: File has valid frontmatter with required fields
  try {
    const ideaFolder = getIdeaFolder();
    const files = fs.readdirSync(ideaFolder).filter(f => f.endsWith('.md'));
    const testFile = files[0];
    const content = fs.readFileSync(path.join(ideaFolder, testFile), 'utf-8');
    const { metadata } = parseFrontmatter(content);

    const requiredFields = ['id', 'title', 'type', 'sessionId', 'createdAt', 'updatedAt'];
    const missingFields = requiredFields.filter(f => !metadata[f]);

    if (missingFields.length === 0) {
      console.log('✓ PASS: File has valid frontmatter with: id, title, type, sessionId, createdAt, updatedAt');
      passed++;
    } else {
      throw new Error(`Missing fields in frontmatter: ${missingFields.join(', ')}`);
    }
  } catch (error) {
    console.log(`✗ FAIL: File has valid frontmatter - ${error}`);
    failed++;
  }

  // Test 4: Body content matches input
  try {
    const ideaFolder = getIdeaFolder();
    const files = fs.readdirSync(ideaFolder).filter(f => f.endsWith('.md'));
    const testFile = files[0];
    const content = fs.readFileSync(path.join(ideaFolder, testFile), 'utf-8');
    const { body } = parseFrontmatter(content);

    if (body.includes('# Test') && body.includes('Content here')) {
      console.log('✓ PASS: Body content matches input');
      passed++;
    } else {
      throw new Error(`Body content mismatch. Got: ${body}`);
    }
  } catch (error) {
    console.log(`✗ FAIL: Body content matches input - ${error}`);
    failed++;
  }

  // Test 5: .metadata/index.json updated with new artifact entry
  try {
    const ideaFolder = getIdeaFolder();
    const indexPath = path.join(ideaFolder, '.metadata', 'index.json');

    if (fs.existsSync(indexPath)) {
      const cache = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      const _artifactCount = Object.keys(cache.artifacts || {}).length;

      if (artifactCount > 0) {
        console.log('✓ PASS: .metadata/index.json updated with new artifact entry');
        passed++;
      } else {
        throw new Error('No artifacts in cache');
      }
    } else {
      throw new Error('index.json not found');
    }
  } catch (error) {
    console.log(`✗ FAIL: .metadata/index.json updated - ${error}`);
    failed++;
  }

  // Test 6: Returns UnifiedArtifact with all fields populated
  try {
    cleanupTestDir();
    const _artifact = await saveArtifact(TEST_USER, TEST_IDEA, {
      type: 'research',
      title: 'Market Analysis',
      content: '## Market Research',
      sessionId: 'session-456'
    });

    const requiredFields = [
      'id', 'userSlug', 'ideaSlug', 'type', 'title',
      'filePath', 'tokenCount', 'status', 'createdAt', 'updatedAt'
    ];

    const missingFields = requiredFields.filter(f => artifact[f as keyof typeof artifact] === undefined);

    if (missingFields.length === 0 && artifact.status === 'ready') {
      console.log('✓ PASS: Returns UnifiedArtifact with all fields populated');
      passed++;
    } else {
      throw new Error(`Missing fields: ${missingFields.join(', ')}`);
    }
  } catch (error) {
    console.log(`✗ FAIL: Returns UnifiedArtifact with all fields - ${error}`);
    failed++;
  }

  // Test 7: Handles nested paths (e.g., research/market.md)
  try {
    const _artifact = await saveArtifact(TEST_USER, TEST_IDEA, {
      type: 'research',
      title: 'Nested Test',
      content: '# Nested Content',
      filePath: 'research/nested-test.md'
    });

    const ideaFolder = getIdeaFolder();
    const nestedPath = path.join(ideaFolder, 'research', 'nested-test.md');

    if (fs.existsSync(nestedPath)) {
      console.log('✓ PASS: Handles nested paths (research/nested-test.md)');
      passed++;
    } else {
      throw new Error(`Nested file not found at ${nestedPath}`);
    }
  } catch (error) {
    console.log(`✗ FAIL: Handles nested paths - ${error}`);
    failed++;
  }

  // Test 8: Creates parent directories if needed
  try {
    const _artifact = await saveArtifact(TEST_USER, TEST_IDEA, {
      type: 'markdown',
      title: 'Deep Nested',
      content: '# Deep Content',
      filePath: 'deep/nested/folder/test.md'
    });

    const ideaFolder = getIdeaFolder();
    const deepPath = path.join(ideaFolder, 'deep', 'nested', 'folder', 'test.md');

    if (fs.existsSync(deepPath)) {
      console.log('✓ PASS: Creates parent directories if needed');
      passed++;
    } else {
      throw new Error(`Deep nested file not found at ${deepPath}`);
    }
  } catch (error) {
    console.log(`✗ FAIL: Creates parent directories - ${error}`);
    failed++;
  }

  // Test 9: Idempotent - calling twice with same id updates existing file
  try {
    const filePath = 'idempotent-test.md';

    // First call
    const _artifact1 = await saveArtifact(TEST_USER, TEST_IDEA, {
      type: 'markdown',
      title: 'Idempotent Test',
      content: '# Original Content',
      filePath
    });

    // Second call with same file path
    const _artifact2 = await saveArtifact(TEST_USER, TEST_IDEA, {
      type: 'markdown',
      title: 'Idempotent Test Updated',
      content: '# Updated Content',
      filePath
    });

    // Check that IDs are the same (preserved from first save)
    const ideaFolder = getIdeaFolder();
    const actualPath = path.join(ideaFolder, filePath);
    const content = fs.readFileSync(actualPath, 'utf-8');

    if (artifact1.id === artifact2.id &&
        content.includes('# Updated Content') &&
        !content.includes('# Original Content')) {
      console.log('✓ PASS: Idempotent: calling twice with same path updates existing file');
      passed++;
    } else {
      throw new Error(`Expected same ID (${artifact1.id} vs ${artifact2.id}) and updated content`);
    }
  } catch (error) {
    console.log(`✗ FAIL: Idempotent behavior - ${error}`);
    failed++;
  }

  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  // Clean up after tests
  cleanupTestDir();

  if (failed === 0) {
    console.log('\n✓✓✓ TEST PASSED: TEST-AS-005 ✓✓✓');
    process.exit(0);
  } else {
    console.log('\n✗✗✗ TEST FAILED: TEST-AS-005 ✗✗✗');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
