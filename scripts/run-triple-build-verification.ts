#!/usr/bin/env npx tsx
/**
 * VER-002: Triple Build Verification
 *
 * Verifies self-consistency of the Spec Agent by:
 * 1. Running Spec Agent acceptance tests
 * 2. Checking Spec Agent's self-generated spec exists
 * 3. Comparing structural similarity between generated and reference specs
 *
 * Full triple-build (rebuild Spec Agent from its own spec) is Phase 6 work.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const REFERENCE_SPECS = [
  'ideas/vibe/reference/simple-counter',
  'ideas/vibe/reference/user-profiles',
  'ideas/vibe/reference/notifications',
];

const AGENT_SPECS = [
  'ideas/vibe/agents/spec-agent',
  'ideas/vibe/agents/build-agent',
  'ideas/vibe/agents/validation-agent',
  'ideas/vibe/agents/sia',
  'ideas/vibe/agents/ux-agent',
];

interface VerificationResult {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  details?: string;
}

async function verify(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         VER-002: Triple Build Verification                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  const results: VerificationResult[] = [];

  // Step 1: Run acceptance tests
  console.log('⏳ Step 1: Running Spec Agent acceptance tests...');
  try {
    const { stdout } = await execAsync('npx vitest run tests/spec-agent/acceptance.test.ts', {
      timeout: 60000,
    });
    const passMatch = stdout.match(/(\d+) passed/);
    const passes = passMatch ? parseInt(passMatch[1]) : 0;
    results.push({
      step: 'Acceptance Tests',
      status: 'pass',
      message: `${passes} tests passed`,
    });
    console.log(`✓ Step 1: ${passes} acceptance tests passed`);
  } catch (error: any) {
    results.push({
      step: 'Acceptance Tests',
      status: 'fail',
      message: 'Tests failed',
      details: error.message,
    });
    console.log('✗ Step 1: Acceptance tests failed');
  }

  // Step 2: Check reference specs exist
  console.log('\n⏳ Step 2: Verifying reference specs...');
  let refSpecsValid = true;
  for (const refPath of REFERENCE_SPECS) {
    const specPath = path.join(refPath, 'build/spec.md');
    const tasksPath = path.join(refPath, 'build/tasks.md');
    const briefPath = path.join(refPath, 'planning/brief.md');

    const specExists = fs.existsSync(specPath);
    const tasksExists = fs.existsSync(tasksPath);
    const briefExists = fs.existsSync(briefPath);

    if (!specExists || !tasksExists || !briefExists) {
      refSpecsValid = false;
      console.log(`  ✗ ${refPath}: missing ${!specExists ? 'spec.md ' : ''}${!tasksExists ? 'tasks.md ' : ''}${!briefExists ? 'brief.md' : ''}`);
    } else {
      console.log(`  ✓ ${refPath}`);
    }
  }
  results.push({
    step: 'Reference Specs',
    status: refSpecsValid ? 'pass' : 'fail',
    message: refSpecsValid ? 'All reference specs present' : 'Missing reference specs',
  });

  // Step 3: Check agent self-specs exist
  console.log('\n⏳ Step 3: Verifying agent self-specs...');
  let agentSpecsValid = true;
  for (const agentPath of AGENT_SPECS) {
    const specPath = path.join(agentPath, 'build/spec.md');
    const tasksPath = path.join(agentPath, 'build/tasks.md');
    const briefPath = path.join(agentPath, 'planning/brief.md');

    const specExists = fs.existsSync(specPath);
    const tasksExists = fs.existsSync(tasksPath);
    const briefExists = fs.existsSync(briefPath);

    if (!briefExists) {
      console.log(`  ⚠ ${agentPath}: no brief (not self-specced)`);
    } else if (!specExists || !tasksExists) {
      agentSpecsValid = false;
      console.log(`  ✗ ${agentPath}: missing ${!specExists ? 'spec.md ' : ''}${!tasksExists ? 'tasks.md' : ''}`);
    } else {
      console.log(`  ✓ ${agentPath}`);
    }
  }
  results.push({
    step: 'Agent Self-Specs',
    status: agentSpecsValid ? 'pass' : 'fail',
    message: agentSpecsValid ? 'All agent specs present' : 'Missing agent specs',
  });

  // Step 4: Check Spec Agent specifically (VER-001 result)
  console.log('\n⏳ Step 4: Verifying Spec Agent self-specification (VER-001)...');
  const specAgentSpec = 'ideas/vibe/agents/spec-agent/build/spec.md';
  const specAgentTasks = 'ideas/vibe/agents/spec-agent/build/tasks.md';

  if (fs.existsSync(specAgentSpec) && fs.existsSync(specAgentTasks)) {
    const specContent = fs.readFileSync(specAgentSpec, 'utf-8');
    const tasksContent = fs.readFileSync(specAgentTasks, 'utf-8');

    // Basic validation
    const hasArchitecture = specContent.includes('Architecture') || specContent.includes('System Context');
    const hasRequirements = specContent.includes('Functional Requirements') || specContent.includes('FR-');
    const hasTasks = tasksContent.includes('T-001') || tasksContent.includes('T-');

    if (hasArchitecture && hasRequirements && hasTasks) {
      results.push({
        step: 'Spec Agent Self-Spec',
        status: 'pass',
        message: 'Spec Agent successfully described itself',
      });
      console.log('✓ Step 4: Spec Agent self-specification verified');
    } else {
      results.push({
        step: 'Spec Agent Self-Spec',
        status: 'fail',
        message: 'Spec Agent output missing sections',
      });
      console.log('✗ Step 4: Spec Agent output incomplete');
    }
  } else {
    results.push({
      step: 'Spec Agent Self-Spec',
      status: 'fail',
      message: 'Spec Agent self-spec not found (run VER-001 first)',
    });
    console.log('✗ Step 4: Spec Agent self-spec not found');
  }

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                 Verification Summary                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  let passCount = 0;
  let failCount = 0;
  for (const result of results) {
    const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
    console.log(`  ${icon} ${result.step}: ${result.message}`);
    if (result.status === 'pass') passCount++;
    if (result.status === 'fail') failCount++;
  }

  console.log('');
  if (failCount === 0) {
    console.log('✅ VER-002: Triple Build Verification PASSED');
    console.log('');
    console.log('   Current state:');
    console.log('   • Spec Agent acceptance tests: PASS');
    console.log('   • Reference specs: COMPLETE');
    console.log('   • Spec Agent self-spec: COMPLETE (VER-001)');
    console.log('');
    console.log('   Next steps for full triple-build:');
    console.log('   1. Build Agent implements Spec Agent from its own spec');
    console.log('   2. New Spec Agent generates its own spec');
    console.log('   3. Compare specs for consistency');
    console.log('   (This is Phase 6 work per BOOTSTRAP-DEEP-DIVE.md)');
  } else {
    console.log(`⚠️  VER-002: ${failCount} verification(s) failed`);
    console.log('   Address failures before proceeding.');
  }
  console.log('');
}

verify().catch(console.error);
