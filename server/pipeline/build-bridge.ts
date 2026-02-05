/**
 * Build Bridge
 * 
 * Connects the build agent to the pipeline orchestrator.
 * Manages build sessions and reports progress back to the orchestrator.
 */

import { EventEmitter } from 'events';
import { BuildAgent, createBuildAgent, BuildResult } from '../../agents/build/core.js';
import { getOrchestrator, BuildProgress } from './orchestrator.js';
import { getOne, query, run } from '../../database/db.js';
import * as fs from 'fs';
import * as path from 'path';

export interface BuildSession {
  sessionId: string;
  ideaId: string;
  buildId?: string;
  status: 'pending' | 'running' | 'complete' | 'failed' | 'human_needed';
  startedAt: Date;
  completedAt?: Date;
  tasksTotal: number;
  tasksComplete: number;
  tasksFailed: number;
  currentTask?: string;
  siaInterventions: number;
  error?: string;
}

/**
 * BuildBridge wraps the build agent and provides pipeline integration
 */
export class BuildBridge extends EventEmitter {
  private sessions: Map<string, BuildSession> = new Map();
  private agents: Map<string, BuildAgent> = new Map();
  private config: {
    projectRoot: string;
    autoCommit: boolean;
    maxRetries: number;
    humanInterventionThreshold: number; // Number of failures before requesting human help
  };
  
  constructor(config?: {
    projectRoot?: string;
    autoCommit?: boolean;
    maxRetries?: number;
    humanInterventionThreshold?: number;
  }) {
    super();
    this.config = {
      projectRoot: config?.projectRoot || process.cwd(),
      autoCommit: config?.autoCommit ?? true,
      maxRetries: config?.maxRetries ?? 3,
      humanInterventionThreshold: config?.humanInterventionThreshold ?? 3,
    };
  }
  
  /**
   * Start a build session for an idea
   * Called by the orchestrator when transitioning to building phase
   */
  async startBuild(ideaId: string): Promise<BuildSession> {
    const sessionId = `build-${ideaId}-${Date.now()}`;
    
    const session: BuildSession = {
      sessionId,
      ideaId,
      status: 'pending',
      startedAt: new Date(),
      tasksTotal: 0,
      tasksComplete: 0,
      tasksFailed: 0,
      siaInterventions: 0,
    };
    
    this.sessions.set(sessionId, session);
    
    // Update orchestrator with session info
    try {
      const orchestrator = getOrchestrator();
      await orchestrator.updateBuildProgress(ideaId, {
        sessionId,
        tasksComplete: 0,
        tasksTotal: 0,
        currentTask: null,
        failedTasks: 0,
        siaInterventions: 0,
      });
    } catch (error) {
      console.error('[BuildBridge] Error updating orchestrator:', error);
    }
    
    // Find the tasks file for this idea
    const tasksPath = await this.findTasksPath(ideaId);
    
    if (!tasksPath) {
      session.status = 'failed';
      session.error = 'No tasks file found for this idea';
      this.emit('buildFailed', { ideaId, sessionId, error: session.error });
      return session;
    }
    
    // Start build asynchronously
    this.runBuild(session, tasksPath).catch(error => {
      console.error('[BuildBridge] Build error:', error);
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('buildFailed', { ideaId, sessionId, error: session.error });
    });
    
    return session;
  }
  
  /**
   * Run the build process
   */
  private async runBuild(session: BuildSession, tasksPath: string): Promise<void> {
    session.status = 'running';
    
    // Create build agent with progress callbacks
    const agent = createBuildAgent({
      projectRoot: this.config.projectRoot,
      autoCommit: this.config.autoCommit,
      maxRetries: this.config.maxRetries,
      ideaId: session.ideaId,
      
      onProgress: async (progress) => {
        session.tasksTotal = progress.total;
        session.tasksComplete = progress.completed;
        session.currentTask = progress.current || undefined;
        
        await this.updateProgress(session);
        
        this.emit('buildProgress', {
          ideaId: session.ideaId,
          sessionId: session.sessionId,
          progress,
        });
      },
      
      onTaskComplete: async (result) => {
        if (result.state === 'done') {
          session.tasksComplete++;
        }
        await this.updateProgress(session);
      },
      
      onTaskFailed: async (taskId, error) => {
        session.tasksFailed++;
        
        // Check if we should request human intervention
        if (session.tasksFailed >= this.config.humanInterventionThreshold) {
          session.status = 'human_needed';
          this.emit('humanNeeded', {
            ideaId: session.ideaId,
            sessionId: session.sessionId,
            taskId,
            error: error.message,
            failedCount: session.tasksFailed,
          });
          
          await this.updateProgress(session);
        }
      },
    });
    
    this.agents.set(session.sessionId, agent);
    
    try {
      const result = await agent.run(tasksPath);
      
      session.buildId = result.buildId;
      session.tasksTotal = result.tasksTotal;
      session.tasksComplete = result.tasksCompleted;
      session.tasksFailed = result.tasksFailed;
      
      if (result.status === 'completed') {
        session.status = 'complete';
        session.completedAt = new Date();
        
        await this.updateProgress(session);
        
        // Emit completion event for orchestrator
        this.emit('buildComplete', {
          ideaId: session.ideaId,
          sessionId: session.sessionId,
          buildId: result.buildId,
          tasksCompleted: result.tasksCompleted,
        });
      } else {
        // Build failed but didn't hit human intervention threshold
        // (session.status may have been changed by onTaskFailed callback)
        if ((session.status as string) !== 'human_needed') {
          session.status = 'failed';
          session.error = result.error;
          
          await this.updateProgress(session);
          
          this.emit('buildFailed', {
            ideaId: session.ideaId,
            sessionId: session.sessionId,
            error: result.error,
          });
        }
      }
      
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      
      await this.updateProgress(session);
      
      this.emit('buildFailed', {
        ideaId: session.ideaId,
        sessionId: session.sessionId,
        error: session.error,
      });
      
      throw error;
    }
  }
  
  /**
   * Find the tasks.md file for an idea
   */
  private async findTasksPath(ideaId: string): Promise<string | null> {
    // Check common locations
    const possiblePaths = [
      path.join('output', 'specs', ideaId, 'tasks.md'),
      path.join('specs', ideaId, 'tasks.md'),
      path.join('briefs', ideaId, 'tasks.md'),
    ];
    
    for (const p of possiblePaths) {
      const fullPath = path.resolve(this.config.projectRoot, p);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // Check database for spec output
    const specOutput = await getOne<{ tasks_content: string }>(
      'SELECT tasks_content FROM spec_outputs WHERE idea_id = ?',
      [ideaId]
    );
    
    if (specOutput?.tasks_content) {
      // Write to a temp file
      const tempDir = path.join(this.config.projectRoot, 'output', 'specs', ideaId);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tasksPath = path.join(tempDir, 'tasks.md');
      fs.writeFileSync(tasksPath, specOutput.tasks_content, 'utf-8');
      return tasksPath;
    }
    
    return null;
  }
  
  /**
   * Update build progress in orchestrator
   */
  private async updateProgress(session: BuildSession): Promise<void> {
    try {
      const orchestrator = getOrchestrator();
      await orchestrator.updateBuildProgress(session.ideaId, {
        sessionId: session.sessionId,
        tasksComplete: session.tasksComplete,
        tasksTotal: session.tasksTotal,
        currentTask: session.currentTask || null,
        failedTasks: session.tasksFailed,
        siaInterventions: session.siaInterventions,
      });
    } catch (error) {
      console.error('[BuildBridge] Error updating progress:', error);
    }
  }
  
  /**
   * Record SIA (human) intervention
   */
  async recordSiaIntervention(
    sessionId: string,
    taskId: string,
    resolution: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    session.siaInterventions++;
    
    // Log the intervention
    try {
      await run(
        `INSERT INTO build_interventions (session_id, task_id, resolution, created_at)
         VALUES (?, ?, ?, ?)`,
        [sessionId, taskId, resolution, new Date().toISOString()]
      );
    } catch (error) {
      console.warn('[BuildBridge] Could not log intervention:', error);
    }
    
    await this.updateProgress(session);
    
    this.emit('siaIntervention', {
      ideaId: session.ideaId,
      sessionId,
      taskId,
      resolution,
    });
  }
  
  /**
   * Resume a build after human intervention
   */
  async resumeBuild(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.status !== 'human_needed') {
      throw new Error(`Session is not waiting for human intervention: ${session.status}`);
    }
    
    const agent = this.agents.get(sessionId);
    if (!agent || !session.buildId) {
      throw new Error('Cannot resume: no active agent or build ID');
    }
    
    session.status = 'running';
    session.tasksFailed = 0; // Reset failure count
    
    await this.updateProgress(session);
    
    // Find tasks path and resume
    const tasksPath = await this.findTasksPath(session.ideaId);
    if (!tasksPath) {
      throw new Error('Tasks file not found');
    }
    
    try {
      const result = await agent.resume(session.buildId, tasksPath);
      
      session.tasksComplete = result.tasksCompleted;
      session.tasksFailed = result.tasksFailed;
      
      if (result.status === 'completed') {
        session.status = 'complete';
        session.completedAt = new Date();
        
        this.emit('buildComplete', {
          ideaId: session.ideaId,
          sessionId: session.sessionId,
          buildId: result.buildId,
        });
      }
      
      await this.updateProgress(session);
      
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      await this.updateProgress(session);
      throw error;
    }
  }
  
  /**
   * Get session by ID
   */
  getSession(sessionId: string): BuildSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Get session for an idea
   */
  getSessionForIdea(ideaId: string): BuildSession | undefined {
    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      if (session.ideaId === ideaId) {
        return session;
      }
    }
    return undefined;
  }
  
  /**
   * List all active sessions
   */
  listSessions(): BuildSession[] {
    return Array.from(this.sessions.values());
  }
}

// Singleton instance
let bridgeInstance: BuildBridge | null = null;

export function getBuildBridge(): BuildBridge {
  if (!bridgeInstance) {
    bridgeInstance = new BuildBridge();
  }
  return bridgeInstance;
}

export function initializeBuildBridge(config?: {
  projectRoot?: string;
  autoCommit?: boolean;
  maxRetries?: number;
  humanInterventionThreshold?: number;
}): BuildBridge {
  bridgeInstance = new BuildBridge(config);
  return bridgeInstance;
}
