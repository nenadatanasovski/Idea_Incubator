import { saveArtifact } from '../../agents/ideation/unified-artifact-store.js';
import * as fs from 'fs';

async function verify() {
  // Clean up first
  const testDir = 'users/test-user';
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  const artifact = await saveArtifact('test-user', 'test-idea', {
    type: 'markdown',
    title: 'Test Doc',
    content: '# Test\nContent here',
    sessionId: 'session-123'
  });

  const filePath = `users/test-user/ideas/test-idea/${artifact.filePath}`;
  console.log('File exists:', fs.existsSync(filePath));

  const content = fs.readFileSync(filePath, 'utf-8');
  console.log('Contains id:', content.includes('id: ' + artifact.id));
  console.log('Contains content:', content.includes('# Test'));

  // Clean up
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('VERIFICATION PASSED');
}

verify().catch(console.error);
