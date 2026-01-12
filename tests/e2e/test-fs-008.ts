/**
 * TEST-FS-008: Rename Draft to Idea Folder
 *
 * This test verifies that the renameDraftToIdea function:
 * 1. Renames the draft folder successfully
 * 2. Old draft folder no longer exists
 * 3. New idea folder exists at correct path
 * 4. Any files in draft folder preserved in new location
 * 5. Missing templates added
 * 6. Database rows updated
 * 7. Returns correct new path
 */

import * as fs from 'fs';
import * as path from 'path';
import { createDraftFolder, renameDraftToIdea, createUserFolder } from '../../utils/folder-structure.js';
import { run, query, saveDb, getDb } from '../../database/db.js';

async function runTest() {
  console.log('TEST-FS-008: Rename Draft to Idea Folder\n');

  const userSlug = 'test-user-fs008';
  const ideaSlug = 'my-new-idea';
  const ideaType = 'business' as const;

  let passed = true;
  const results: { criterion: string; passed: boolean; message: string }[] = [];

  try {
    // Setup: ensure user folder exists
    await createUserFolder(userSlug);

    // Create a draft folder
    console.log('Creating draft folder...');
    const { draftId, path: draftPath } = await createDraftFolder(userSlug);
    console.log(`Draft created: ${draftId} at ${draftPath}`);

    // Add a test file to the draft
    const testFilePath = path.join(draftPath, 'test.md');
    fs.writeFileSync(testFilePath, '# Test Content\n\nThis is a test file.');
    console.log('Added test.md to draft folder');

    // Insert test data into database
    const _db = await getDb();
    const sessionId = `test-session-${Date.now()}`;
    const artifactId = `test-artifact-${Date.now()}`;

    await run(
      `INSERT INTO ideation_sessions (id, user_slug, idea_slug, profile_id) VALUES (?, ?, ?, ?)`,
      [sessionId, userSlug, draftId, 'test-profile']
    );

    await run(
      `INSERT INTO ideation_artifacts (id, session_id, type, title, content, user_slug, idea_slug) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [artifactId, sessionId, 'markdown', 'Test Artifact', 'Test content', userSlug, draftId]
    );
    await saveDb();
    console.log('Inserted test database records');

    // Now rename the draft to an idea
    console.log('\nRenaming draft to idea...');
    const newPath = await renameDraftToIdea(userSlug, draftId, ideaSlug, ideaType);
    console.log(`Renamed to: ${newPath}`);

    // Verify pass criteria

    // 1. Draft folder renamed successfully (verified by checking old doesn't exist)
    const draftExists = fs.existsSync(draftPath);
    results.push({
      criterion: 'Draft folder no longer exists',
      passed: !draftExists,
      message: draftExists ? `Draft folder still exists at ${draftPath}` : 'Draft folder successfully removed'
    });

    // 2. New idea folder exists at correct path
    const newFolderExists = fs.existsSync(newPath);
    results.push({
      criterion: 'New idea folder exists',
      passed: newFolderExists,
      message: newFolderExists ? `Idea folder created at ${newPath}` : `Idea folder NOT found at ${newPath}`
    });

    // 3. Test file preserved in new location
    const testFileInNewLocation = fs.existsSync(path.join(newPath, 'test.md'));
    results.push({
      criterion: 'Files preserved in new location',
      passed: testFileInNewLocation,
      message: testFileInNewLocation ? 'test.md preserved' : 'test.md NOT found in new location'
    });

    // 4. Missing templates added - check README.md
    const readmeExists = fs.existsSync(path.join(newPath, 'README.md'));
    results.push({
      criterion: 'Missing templates added (README.md)',
      passed: readmeExists,
      message: readmeExists ? 'README.md created' : 'README.md NOT created'
    });

    // 5. Check subdirectories exist
    const subdirs = ['research', 'validation', 'planning', 'build', 'marketing', 'networking', 'analysis', '.metadata'];
    const allSubdirsExist = subdirs.every(dir => fs.existsSync(path.join(newPath, dir)));
    results.push({
      criterion: 'All subdirectories created',
      passed: allSubdirsExist,
      message: allSubdirsExist ? 'All subdirectories exist' : 'Some subdirectories missing'
    });

    // 6. Database sessions updated
    const sessions = await query<{ idea_slug: string }>(
      `SELECT idea_slug FROM ideation_sessions WHERE id = ?`,
      [sessionId]
    );
    const sessionUpdated = sessions.length > 0 && sessions[0].idea_slug === ideaSlug;
    results.push({
      criterion: 'Database ideation_sessions updated',
      passed: sessionUpdated,
      message: sessionUpdated ? `idea_slug changed to ${ideaSlug}` : `idea_slug is ${sessions[0]?.idea_slug || 'NULL'}`
    });

    // 7. Database artifacts updated
    const artifacts = await query<{ idea_slug: string }>(
      `SELECT idea_slug FROM ideation_artifacts WHERE id = ?`,
      [artifactId]
    );
    const artifactUpdated = artifacts.length > 0 && artifacts[0].idea_slug === ideaSlug;
    results.push({
      criterion: 'Database ideation_artifacts updated',
      passed: artifactUpdated,
      message: artifactUpdated ? `idea_slug changed to ${ideaSlug}` : `idea_slug is ${artifacts[0]?.idea_slug || 'NULL'}`
    });

    // 8. Returns correct path
    const expectedPath = path.resolve(process.cwd(), 'users', userSlug, 'ideas', ideaSlug);
    const pathCorrect = newPath === expectedPath;
    results.push({
      criterion: 'Returns correct new path',
      passed: pathCorrect,
      message: pathCorrect ? 'Path correct' : `Expected ${expectedPath}, got ${newPath}`
    });

    // Print results
    console.log('\n=== Test Results ===\n');
    for (const result of results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${result.criterion}`);
      console.log(`       ${result.message}\n`);
      if (!result.passed) passed = false;
    }

    // Cleanup
    console.log('Cleaning up...');
    await run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
    await run(`DELETE FROM ideation_artifacts WHERE id = ?`, [artifactId]);
    await saveDb();

    // Remove test folders
    if (fs.existsSync(newPath)) {
      fs.rmSync(newPath, { recursive: true });
    }
    const userFolder = path.resolve(process.cwd(), 'users', userSlug);
    if (fs.existsSync(userFolder)) {
      fs.rmSync(userFolder, { recursive: true });
    }
    console.log('Cleanup complete');

    if (passed) {
      console.log('\n✅ TEST PASSED: TEST-FS-008');
      process.exit(0);
    } else {
      console.log('\n❌ TEST FAILED: TEST-FS-008');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error);
    process.exit(1);
  }
}

runTest();
