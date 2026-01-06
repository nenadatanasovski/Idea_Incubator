/**
 * TEST-AS-015: Backward Compatibility Export
 *
 * Verification code from spec - tests that old imports still work
 */

// Old import should still work
import { saveArtifact, getArtifactsBySession, deleteArtifactsBySession, artifactStore } from '../../agents/ideation/artifact-store.js';

// Check if deprecation warning is logged
console.log('Testing backward compatibility...');

// Should log deprecation warning but work
async function test() {
  try {
    // We don't need to actually call the DB function, just verify it's callable
    console.log('saveArtifact is:', typeof saveArtifact);
    console.log('getArtifactsBySession is:', typeof getArtifactsBySession);
    console.log('deleteArtifactsBySession is:', typeof deleteArtifactsBySession);
    console.log('artifactStore.save is:', typeof artifactStore.save);
    console.log('artifactStore.getBySession is:', typeof artifactStore.getBySession);
    console.log('artifactStore.deleteBySession is:', typeof artifactStore.deleteBySession);
    console.log('artifactStore.updateStatus is:', typeof artifactStore.updateStatus);

    // Verify function types match expected signatures
    if (typeof saveArtifact !== 'function') throw new Error('saveArtifact is not a function');
    if (typeof getArtifactsBySession !== 'function') throw new Error('getArtifactsBySession is not a function');
    if (typeof deleteArtifactsBySession !== 'function') throw new Error('deleteArtifactsBySession is not a function');
    if (typeof artifactStore.save !== 'function') throw new Error('artifactStore.save is not a function');
    if (typeof artifactStore.getBySession !== 'function') throw new Error('artifactStore.getBySession is not a function');
    if (typeof artifactStore.deleteBySession !== 'function') throw new Error('artifactStore.deleteBySession is not a function');
    if (typeof artifactStore.updateStatus !== 'function') throw new Error('artifactStore.updateStatus is not a function');

    console.log('\nAll backward compatibility checks passed!');
    console.log('TEST-AS-015: PASS');
    process.exit(0);
  } catch (error) {
    console.error('TEST-AS-015: FAIL', error);
    process.exit(1);
  }
}

test();
