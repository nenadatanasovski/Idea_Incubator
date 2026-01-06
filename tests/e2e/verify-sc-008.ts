import { buildCoreDocsLayer, estimateTokens } from '../../agents/ideation/idea-context-builder.js';

async function verify() {
  // Use the test user that exists
  const coreDocs = await buildCoreDocsLayer('test-user-fs007', 'child-idea');

  // Check basic assertions
  if (coreDocs.readme.summary.length === 0) {
    throw new Error('readme.summary should have content');
  }
  if (!coreDocs.readme.fullPath.endsWith('README.md')) {
    throw new Error('fullPath should end with README.md');
  }

  const tokens = estimateTokens(JSON.stringify(coreDocs));
  if (tokens >= 1000) {
    throw new Error(`tokens should be < 1000, got ${tokens}`);
  }

  console.log('Verification passed!');
  console.log(`- readme.summary length: ${coreDocs.readme.summary.length} chars`);
  console.log(`- readme.fullPath: ${coreDocs.readme.fullPath}`);
  console.log(`- recentQA count: ${coreDocs.development.recentQA.length}`);
  console.log(`- gaps count: ${coreDocs.development.gaps.length}`);
  console.log(`- Total tokens: ${tokens}`);
}

verify().catch(e => {
  console.error('Verification failed:', e.message);
  process.exit(1);
});
