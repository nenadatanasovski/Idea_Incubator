/**
 * Plan Cache - Persists approved strategic plans to disk
 * 
 * Prevents re-running expensive planning on every restart.
 * Plans are cached for 24 hours by default.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CACHE_DIR = join(homedir(), '.harness');
const CACHE_FILE = join(CACHE_DIR, 'approved-plan.json');
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedPlan {
  // Strategic plan data
  visionSummary: string;
  currentState: string;
  approach: string;
  phases: Array<{
    name: string;
    goal: string;
    priority: string;
    effort: string;
    dependencies: string;
    deliverables: string[];
  }>;
  
  // Metadata
  createdAt: string;
  approvedAt: string;
  expiresAt: string;
  taskListId: string;
  
  // Execution state
  tacticalTasksCreated: boolean;
  waveRunId?: string;
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`📁 Created cache directory: ${CACHE_DIR}`);
  }
}

/**
 * Save approved plan to cache
 */
export function savePlanToCache(
  plan: {
    visionSummary: string;
    currentState: string;
    approach: string;
    phases: CachedPlan['phases'];
  },
  taskListId: string,
  ttlMs: number = DEFAULT_TTL_MS
): CachedPlan {
  ensureCacheDir();
  
  const now = new Date();
  const cached: CachedPlan = {
    ...plan,
    createdAt: now.toISOString(),
    approvedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    taskListId,
    tacticalTasksCreated: false,
  };
  
  writeFileSync(CACHE_FILE, JSON.stringify(cached, null, 2));
  console.log(`💾 Cached approved plan (expires: ${cached.expiresAt})`);
  
  return cached;
}

/**
 * Load plan from cache
 * Returns null if no cache, expired, or corrupt
 */
export function loadPlanFromCache(): CachedPlan | null {
  if (!existsSync(CACHE_FILE)) {
    console.log('📭 No cached plan found');
    return null;
  }
  
  try {
    const data = readFileSync(CACHE_FILE, 'utf-8');
    const cached: CachedPlan = JSON.parse(data);
    
    // Check expiry
    const expiresAt = new Date(cached.expiresAt);
    if (expiresAt < new Date()) {
      console.log(`⏰ Cached plan expired at ${cached.expiresAt}`);
      clearPlanCache();
      return null;
    }
    
    // Validate required fields
    if (!cached.visionSummary || !cached.phases || cached.phases.length === 0) {
      console.log('⚠️ Cached plan is incomplete');
      clearPlanCache();
      return null;
    }
    
    console.log(`✅ Loaded cached plan (${cached.phases.length} phases, expires: ${cached.expiresAt})`);
    return cached;
  } catch (err) {
    console.error('⚠️ Failed to load cached plan:', err);
    clearPlanCache();
    return null;
  }
}

/**
 * Check if we have a valid cached plan
 */
export function hasCachedPlan(): boolean {
  return loadPlanFromCache() !== null;
}

/**
 * Update cache with execution state
 */
export function updatePlanCache(updates: Partial<CachedPlan>): CachedPlan | null {
  const cached = loadPlanFromCache();
  if (!cached) return null;
  
  const updated: CachedPlan = { ...cached, ...updates };
  writeFileSync(CACHE_FILE, JSON.stringify(updated, null, 2));
  console.log(`📝 Updated cached plan`);
  
  return updated;
}

/**
 * Mark tactical tasks as created
 */
export function markTacticalTasksCreated(waveRunId?: string): CachedPlan | null {
  return updatePlanCache({
    tacticalTasksCreated: true,
    waveRunId,
  });
}

/**
 * Clear the plan cache
 */
export function clearPlanCache(): void {
  if (existsSync(CACHE_FILE)) {
    unlinkSync(CACHE_FILE);
    console.log('🗑️ Cleared plan cache');
  }
}

/**
 * Get cache file path (for debugging)
 */
export function getCachePath(): string {
  return CACHE_FILE;
}

export default {
  savePlanToCache,
  loadPlanFromCache,
  hasCachedPlan,
  updatePlanCache,
  markTacticalTasksCreated,
  clearPlanCache,
  getCachePath,
};
