/**
 * Ideation Bridge
 * 
 * Connects the ideation agent to the pipeline orchestrator.
 * Updates pipeline state based on ideation progress.
 */

import { getOrchestrator, IdeationProgress } from './orchestrator.js';
import { query, getOne } from '../../database/db.js';

/**
 * Update pipeline state after ideation activity
 * Called after each message in an ideation session
 */
export async function updateIdeationProgress(
  ideaId: string,
  sessionId: string
): Promise<void> {
  try {
    const orchestrator = getOrchestrator();
    const state = await orchestrator.getState(ideaId);
    
    // Only update if we're in ideation phase
    if (state.currentPhase !== 'ideation' && state.currentPhase !== 'ideation_ready') {
      return;
    }
    
    // Calculate progress from artifacts and conversation
    const progress = await calculateIdeationProgress(ideaId, sessionId);
    
    // Update orchestrator
    await orchestrator.updateIdeationProgress(ideaId, progress);
  } catch (error) {
    console.error('[IdeationBridge] Error updating progress:', error);
    // Don't throw - this is a background update
  }
}

/**
 * Calculate ideation progress from database state
 */
async function calculateIdeationProgress(
  ideaId: string,
  sessionId: string
): Promise<IdeationProgress> {
  // Check for key artifacts
  const artifacts = await query<{ type: string; content: string }>(
    'SELECT type, content FROM ideation_artifacts WHERE idea_id = ? OR session_id = ?',
    [ideaId, sessionId]
  );
  
  // Calculate milestones
  const milestones = {
    problemDefined: artifacts.some(a => 
      a.type === 'problem_statement' || 
      a.type === 'problem' ||
      (a.type === 'brief' && a.content?.toLowerCase().includes('problem'))
    ),
    solutionClear: artifacts.some(a => 
      a.type === 'solution_description' || 
      a.type === 'solution' ||
      a.type === 'pitch'
    ),
    targetUserKnown: artifacts.some(a => 
      a.type === 'target_user' || 
      a.type === 'target_audience' ||
      a.type === 'user_persona'
    ),
    differentiationIdentified: artifacts.some(a => 
      a.type === 'differentiation' || 
      a.type === 'competitive_advantage' ||
      a.type === 'unique_value'
    ),
    technicalApproachClear: artifacts.some(a => 
      a.type === 'technical_approach' || 
      a.type === 'architecture' ||
      a.type === 'tech_stack'
    ),
  };
  
  // Calculate completion score (0-1)
  const milestoneCount = Object.values(milestones).filter(Boolean).length;
  const completionScore = milestoneCount / 5;
  
  // Count pending questions/blockers
  const pendingQuestions = await query<{ id: string }>(
    `SELECT id FROM ideation_messages 
     WHERE session_id = ? AND role = 'assistant' 
     AND content LIKE '%?' 
     AND NOT EXISTS (
       SELECT 1 FROM ideation_messages m2 
       WHERE m2.session_id = ideation_messages.session_id 
       AND m2.role = 'user'
       AND m2.created_at > ideation_messages.created_at
     )`,
    [sessionId]
  );
  const blockerCount = Math.min(pendingQuestions.length, 5);
  
  // Calculate confidence score based on conversation quality
  const messageCount = await getOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM ideation_messages WHERE session_id = ?',
    [sessionId]
  );
  
  // More messages + more milestones = higher confidence
  const conversationDepth = Math.min((messageCount?.count || 0) / 20, 1);
  const confidenceScore = (completionScore * 0.7) + (conversationDepth * 0.3);
  
  return {
    completionScore,
    blockerCount,
    confidenceScore,
    milestones,
  };
}

/**
 * Check if ideation is ready for spec and optionally trigger transition
 */
export async function checkSpecReadiness(ideaId: string): Promise<{
  ready: boolean;
  completionScore: number;
  confidenceScore: number;
  missingMilestones: string[];
}> {
  try {
    const orchestrator = getOrchestrator();
    const state = await orchestrator.getState(ideaId);
    
    const { completionScore, confidenceScore, milestones } = state.ideationProgress;
    
    const missingMilestones: string[] = [];
    if (!milestones.problemDefined) missingMilestones.push('Problem statement');
    if (!milestones.solutionClear) missingMilestones.push('Solution description');
    if (!milestones.targetUserKnown) missingMilestones.push('Target user');
    
    const ready = completionScore >= 0.6 && confidenceScore >= 0.5;
    
    return {
      ready,
      completionScore,
      confidenceScore,
      missingMilestones,
    };
  } catch (error) {
    console.error('[IdeationBridge] Error checking readiness:', error);
    return {
      ready: false,
      completionScore: 0,
      confidenceScore: 0,
      missingMilestones: ['Error calculating readiness'],
    };
  }
}

/**
 * Manually trigger transition to spec phase
 */
export async function triggerSpecTransition(
  ideaId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const orchestrator = getOrchestrator();
    
    // First check if ideation is ready
    const readiness = await checkSpecReadiness(ideaId);
    
    if (!readiness.ready) {
      return {
        success: false,
        error: `Not ready for spec. Missing: ${readiness.missingMilestones.join(', ')}`,
      };
    }
    
    // Transition to ideation_ready first if needed
    const state = await orchestrator.getState(ideaId);
    
    if (state.currentPhase === 'ideation') {
      const toReady = await orchestrator.requestTransition(
        ideaId,
        'ideation_ready',
        reason || 'Ideation milestones met',
        'system'
      );
      
      if (!toReady.success) {
        return toReady;
      }
    }
    
    // Then transition to specification
    return orchestrator.requestTransition(
      ideaId,
      'specification',
      reason || 'User requested spec generation',
      'user'
    );
  } catch (error) {
    console.error('[IdeationBridge] Error triggering spec transition:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
