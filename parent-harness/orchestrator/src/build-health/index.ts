/**
 * Build Health Gate
 * 
 * Monitors TypeScript build health and gates task spawning
 * when the codebase is in a broken state.
 * 
 * First Principles:
 * 1. Green Build Invariant: Never work on broken builds
 * 2. Fix Forward: Prioritize build fixes over new features
 * 3. Gate Deployment: Block non-fix tasks when errors are high
 * 4. Fast Feedback: Check build health regularly
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { events } from '../db/events.js';

const execAsync = promisify(exec);

// Configuration
const BUILD_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ERROR_THRESHOLD_CRITICAL = 100; // Block all non-fix tasks
const ERROR_THRESHOLD_WARNING = 50;   // Prioritize fix tasks
const ERROR_THRESHOLD_HEALTHY = 10;   // Normal operation

// State file for persistence across restarts
const STATE_FILE = path.join(process.env.HOME || '/tmp', '.harness', 'build-health.json');

interface BuildHealthState {
  lastCheck: string;
  errorCount: number;
  warningCount: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  topErrors: string[];
  projectPath: string;
}

let currentState: BuildHealthState = {
  lastCheck: '',
  errorCount: -1,
  warningCount: 0,
  status: 'unknown',
  topErrors: [],
  projectPath: '',
};

/**
 * Initialize build health monitoring
 */
export function initBuildHealth(projectPath: string): void {
  currentState.projectPath = projectPath;
  
  // Load previous state if exists
  if (fs.existsSync(STATE_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      currentState = { ...currentState, ...saved };
      console.log(`📊 Build health loaded: ${currentState.status} (${currentState.errorCount} errors)`);
    } catch {
      // Ignore corrupted state
    }
  }

  // Run initial check
  checkBuildHealth().catch(console.error);

  // Schedule periodic checks
  setInterval(() => {
    checkBuildHealth().catch(console.error);
  }, BUILD_CHECK_INTERVAL_MS);

  console.log('🏗️ Build health monitoring initialized');
}

/**
 * Check TypeScript build health
 */
export async function checkBuildHealth(): Promise<BuildHealthState> {
  if (!currentState.projectPath) {
    console.warn('⚠️ Build health: project path not set');
    return currentState;
  }

  try {
    // Run tsc --noEmit to check for errors
    const { stdout, stderr } = await execAsync(
      'npx tsc --noEmit 2>&1 || true',
      { 
        cwd: currentState.projectPath,
        timeout: 120000, // 2 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );

    const output = stdout + stderr;
    
    // Count errors
    const errorMatches = output.match(/error TS\d+/g) || [];
    const errorCount = errorMatches.length;
    
    // Extract top errors (unique)
    const errorLines = output.split('\n')
      .filter(line => line.includes('error TS'))
      .slice(0, 10);
    
    // Determine status
    let status: BuildHealthState['status'];
    if (errorCount === 0) {
      status = 'healthy';
    } else if (errorCount <= ERROR_THRESHOLD_HEALTHY) {
      status = 'healthy';
    } else if (errorCount <= ERROR_THRESHOLD_WARNING) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    // Log status change
    if (status !== currentState.status) {
      console.log(`🏗️ Build health: ${currentState.status} → ${status} (${errorCount} errors)`);
      
      // Emit events for significant changes
      if (status === 'critical') {
        events.systemError?.('build-health', `Critical: ${errorCount} TypeScript errors`);
      } else if (status === 'healthy' && currentState.status !== 'unknown') {
        events.systemRecovery?.('build-health', 'Build is now healthy');
      }
    }

    // Update state
    currentState = {
      lastCheck: new Date().toISOString(),
      errorCount,
      warningCount: 0,
      status,
      topErrors: errorLines,
      projectPath: currentState.projectPath,
    };

    // Persist state
    saveState();

    return currentState;

  } catch (error) {
    console.error('❌ Build health check failed:', error);
    currentState.status = 'unknown';
    return currentState;
  }
}

/**
 * Get current build health state
 */
export function getBuildHealth(): BuildHealthState {
  return { ...currentState };
}

/**
 * Check if task spawning should be allowed
 * Returns: { allowed: boolean, reason?: string }
 */
export function shouldAllowSpawn(taskCategory?: string, taskPriority?: string): { allowed: boolean; reason?: string } {
  // If we haven't checked yet, allow (don't block on first run)
  if (currentState.status === 'unknown') {
    return { allowed: true };
  }

  // Critical: Only allow fix tasks and P0 priority
  if (currentState.status === 'critical') {
    const isFixTask = taskCategory === 'fix' || taskCategory === 'bug';
    const isP0 = taskPriority === 'P0' || taskPriority === 'p0';
    
    if (isFixTask || isP0) {
      return { allowed: true };
    }
    
    return { 
      allowed: false, 
      reason: `Build critical (${currentState.errorCount} errors) - only fix/P0 tasks allowed` 
    };
  }

  // Warning: Allow all but log a warning
  if (currentState.status === 'warning') {
    console.warn(`⚠️ Build has ${currentState.errorCount} errors - consider prioritizing fixes`);
  }

  return { allowed: true };
}

/**
 * Get recommended fix tasks based on current errors
 */
export function getRecommendedFixes(): string[] {
  // Extract file paths from error messages
  const files = new Set<string>();
  
  for (const error of currentState.topErrors) {
    // Extract file path from error like "src/foo.ts(10,5): error TS..."
    const match = error.match(/^([^(]+)\(/);
    if (match) {
      files.add(match[1]);
    }
  }

  return Array.from(files);
}

/**
 * Save state to file
 */
function saveState(): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2));
  } catch (err) {
    console.error('Failed to save build health state:', err);
  }
}

export default {
  initBuildHealth,
  checkBuildHealth,
  getBuildHealth,
  shouldAllowSpawn,
  getRecommendedFixes,
};
