#!/usr/bin/env tsx
/**
 * Verification script for TEST-FS-005: Create users/ directory structure utility
 */
import * as fs from 'fs';
import * as path from 'path';
import { createUserFolder } from '../../utils/folder-structure.js';
import matter from 'gray-matter';

const TEST_USER = 'test-user';

async function verify(): Promise<void> {
  console.log('=== TEST-FS-005 Verification ===\n');

  const results: { criterion: string; passed: boolean; detail: string }[] = [];

  // Clean up any existing test folder first
  const usersRoot = path.resolve('./users');
  const testUserPath = path.join(usersRoot, TEST_USER);
  if (fs.existsSync(testUserPath)) {
    fs.rmSync(testUserPath, { recursive: true });
    console.log('Cleaned up existing test-user folder\n');
  }

  // 1. Check that file exists
  console.log('1. Checking file utils/folder-structure.ts exists...');
  const filePath = path.resolve('./utils/folder-structure.ts');
  const fileExists = fs.existsSync(filePath);
  results.push({
    criterion: 'File utils/folder-structure.ts exists',
    passed: fileExists,
    detail: fileExists ? 'File exists' : 'File not found'
  });

  // 2. Check that function createUserFolder is exported
  console.log('2. Checking createUserFolder function is exported...');
  const functionExported = typeof createUserFolder === 'function';
  results.push({
    criterion: 'Function createUserFolder is exported',
    passed: functionExported,
    detail: functionExported ? 'Function exported correctly' : 'Function not found'
  });

  if (!functionExported) {
    printResults(results);
    process.exit(1);
  }

  // 3. Call createUserFolder and check it creates the directory
  console.log('3. Calling createUserFolder(\'test-user\')...');
  let userFolderPath: string | null = null;
  try {
    userFolderPath = await createUserFolder(TEST_USER);
    const dirExists = fs.existsSync(userFolderPath);
    results.push({
      criterion: 'createUserFolder creates users/test-user/ directory',
      passed: dirExists,
      detail: dirExists ? `Directory created at ${userFolderPath}` : 'Directory not created'
    });
  } catch (error) {
    results.push({
      criterion: 'createUserFolder creates users/test-user/ directory',
      passed: false,
      detail: `Error: ${(error as Error).message}`
    });
  }

  // 4. Check ideas subdirectory exists
  console.log('4. Checking users/test-user/ideas/ subdirectory exists...');
  const ideasPath = userFolderPath ? path.join(userFolderPath, 'ideas') : null;
  const ideasExists = ideasPath ? fs.existsSync(ideasPath) : false;
  results.push({
    criterion: 'users/test-user/ideas/ subdirectory exists',
    passed: ideasExists,
    detail: ideasExists ? 'Ideas subdirectory exists' : 'Ideas subdirectory not found'
  });

  // 5. Check profile.md exists with valid frontmatter
  console.log('5. Checking users/test-user/profile.md exists with valid frontmatter...');
  const profilePath = userFolderPath ? path.join(userFolderPath, 'profile.md') : null;
  let profileValid = false;
  let profileDetail = 'Profile not found';

  if (profilePath && fs.existsSync(profilePath)) {
    try {
      const content = fs.readFileSync(profilePath, 'utf-8');
      const { data } = matter(content);

      // Check for required frontmatter fields
      // Note: gray-matter automatically parses ISO date strings to Date objects
      const hasSlug = typeof data.slug === 'string' && data.slug.length > 0;
      const hasCreated = data.created instanceof Date || (typeof data.created === 'string' && data.created.length > 0);
      const hasUpdated = data.updated instanceof Date || (typeof data.updated === 'string' && data.updated.length > 0);

      profileValid = hasSlug && hasCreated && hasUpdated;
      profileDetail = profileValid
        ? `Valid frontmatter: slug=${data.slug}, created=${data.created}`
        : `Invalid frontmatter: hasSlug=${hasSlug}, hasCreated=${hasCreated}, hasUpdated=${hasUpdated}`;
    } catch (error) {
      profileDetail = `Error parsing profile: ${(error as Error).message}`;
    }
  }
  results.push({
    criterion: 'users/test-user/profile.md file exists with valid frontmatter',
    passed: profileValid,
    detail: profileDetail
  });

  // 6. Check function returns correct absolute path
  console.log('6. Checking function returns correct absolute path...');
  const isAbsolutePath = userFolderPath ? path.isAbsolute(userFolderPath) : false;
  const pathCorrect = isAbsolutePath && userFolderPath?.endsWith(`users/${TEST_USER}`);
  results.push({
    criterion: 'Function returns correct absolute path',
    passed: !!pathCorrect,
    detail: pathCorrect ? `Absolute path: ${userFolderPath}` : `Path issue: ${userFolderPath}`
  });

  // 7. Check idempotency - calling twice should not throw
  console.log('7. Checking idempotency (calling twice)...');
  let idempotent = false;
  let idempotentDetail = '';
  try {
    const secondPath = await createUserFolder(TEST_USER);
    idempotent = secondPath === userFolderPath;
    idempotentDetail = idempotent
      ? 'Second call returned same path without error'
      : `Path mismatch: ${secondPath} vs ${userFolderPath}`;
  } catch (error) {
    idempotentDetail = `Error on second call: ${(error as Error).message}`;
  }
  results.push({
    criterion: 'Calling twice does not throw error (idempotent)',
    passed: idempotent,
    detail: idempotentDetail
  });

  // Print results
  printResults(results);

  // Clean up test folder
  if (fs.existsSync(testUserPath)) {
    fs.rmSync(testUserPath, { recursive: true });
    console.log('\nCleaned up test-user folder');
  }

  // Exit with appropriate code
  const allPassed = results.every(r => r.passed);
  if (allPassed) {
    console.log('\n✅ TEST PASSED: TEST-FS-005');
    process.exit(0);
  } else {
    console.log('\n❌ TEST FAILED: TEST-FS-005');
    process.exit(1);
  }
}

function printResults(results: { criterion: string; passed: boolean; detail: string }[]): void {
  console.log('\n=== Results ===\n');
  for (const r of results) {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${r.criterion}`);
    console.log(`   ${r.detail}\n`);
  }
}

verify().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
