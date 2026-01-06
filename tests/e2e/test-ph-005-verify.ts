/**
 * TEST-PH-005: Verification code from spec
 */

import { classifyAllDocuments } from '../../agents/ideation/document-classifier.js';
import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';

const USERS_ROOT = path.join(process.cwd(), 'users');
const TEST_USER = 'test-user';
const TEST_IDEA = 'test-idea';

async function setupTestData(): Promise<void> {
  const ideaFolder = path.join(USERS_ROOT, TEST_USER, 'ideas', TEST_IDEA);
  fs.mkdirSync(path.join(ideaFolder, 'research'), { recursive: true });
  fs.mkdirSync(path.join(ideaFolder, '.metadata'), { recursive: true });
  fs.writeFileSync(path.join(ideaFolder, 'README.md'), '# Test Idea\n');
  fs.writeFileSync(path.join(ideaFolder, 'development.md'), '# Development\n');
  fs.writeFileSync(path.join(ideaFolder, 'research', 'market.md'), '# Market\n');
}

async function cleanupTestData(): Promise<void> {
  const ideaFolder = path.join(USERS_ROOT, TEST_USER, 'ideas', TEST_IDEA);
  if (fs.existsSync(ideaFolder)) {
    fs.rmSync(ideaFolder, { recursive: true });
  }
  const userFolder = path.join(USERS_ROOT, TEST_USER);
  if (fs.existsSync(userFolder)) {
    const ideasFolder = path.join(userFolder, 'ideas');
    const ideas = fs.existsSync(ideasFolder) ? fs.readdirSync(ideasFolder) : [];
    if (ideas.length === 0) {
      fs.rmSync(userFolder, { recursive: true });
    }
  }
}

async function runVerification(): Promise<void> {
  console.log('Running spec verification code for TEST-PH-005...\n');

  try {
    await setupTestData();

    // Verification code from spec:
    const classifications = await classifyAllDocuments('test-user', 'test-idea', 'RESEARCH');
    assert(Array.isArray(classifications));
    assert(classifications.every(c => ['required', 'recommended', 'optional'].includes(c.classification)));

    // Check sorting
    const requiredIndex = classifications.findIndex(c => c.classification === 'required');
    const optionalIndex = classifications.findIndex(c => c.classification === 'optional');
    if (requiredIndex !== -1 && optionalIndex !== -1) {
      assert(requiredIndex < optionalIndex);
    }

    console.log('All assertions passed!');
    console.log('Spec verification: PASS');
  } finally {
    await cleanupTestData();
  }
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
