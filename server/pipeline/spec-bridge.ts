/**
 * Spec Bridge
 * 
 * Connects the spec agent to the pipeline orchestrator.
 * Wraps the spec agent with the interface expected by the orchestrator.
 */

import { EventEmitter } from 'events';
import { createSpecAgent, SpecOutput } from '../../agents/specification/core.js';
import { getOrchestrator, SpecProgress } from './orchestrator.js';
import { run } from '../../database/db.js';
import * as fs from 'fs';
import * as path from 'path';

export interface SpecSession {
  sessionId: string;
  ideaId: string;
  status: 'pending' | 'running' | 'questions' | 'complete' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  output?: SpecOutput;
  error?: string;
}

export interface IdeationHandoff {
  ideaId: string;
  problemStatement: string;
  solutionDescription: string;
  targetUsers: string;
  artifacts: { type: string; content: string }[];
  conversationSummary: string;
}

/**
 * SpecBridge wraps the spec agent and provides pipeline integration
 */
export class SpecBridge extends EventEmitter {
  private sessions: Map<string, SpecSession> = new Map();
  private config: {
    outputDir: string;
    briefsDir: string;
  };
  
  constructor(config?: { outputDir?: string; briefsDir?: string }) {
    super();
    this.config = {
      outputDir: config?.outputDir || 'output/specs',
      briefsDir: config?.briefsDir || 'briefs',
    };
  }
  
  /**
   * Start a spec generation session for an idea
   * Called by the orchestrator when transitioning to specification phase
   */
  async startSession(ideaId: string, handoff: IdeationHandoff): Promise<SpecSession> {
    const sessionId = `spec-${ideaId}-${Date.now()}`;
    
    const session: SpecSession = {
      sessionId,
      ideaId,
      status: 'pending',
      startedAt: new Date(),
    };
    
    this.sessions.set(sessionId, session);
    
    // Update orchestrator with session info
    try {
      const orchestrator = getOrchestrator();
      await orchestrator.updateSpecProgress(ideaId, {
        sessionId,
        sectionsComplete: 0,
        sectionsTotal: 5, // Typical spec sections
        pendingQuestions: [],
        generatedTasks: 0,
      });
    } catch (error) {
      console.error('[SpecBridge] Error updating orchestrator:', error);
    }
    
    // Start spec generation asynchronously
    this.runSpecGeneration(session, handoff).catch(error => {
      console.error('[SpecBridge] Spec generation error:', error);
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('specFailed', { ideaId, sessionId, error: session.error });
    });
    
    return session;
  }
  
  /**
   * Run the spec generation process
   */
  private async runSpecGeneration(session: SpecSession, handoff: IdeationHandoff): Promise<void> {
    session.status = 'running';
    
    try {
      // Generate brief from handoff
      const briefPath = await this.generateBrief(session.ideaId, handoff);
      
      // Create and run spec agent
      const agent = createSpecAgent();
      
      const output = await agent.generateSpec({
        ideaSlug: session.ideaId,
        briefPath,
        skipQuestions: false,
        useDefaults: false,
      });
      
      session.output = output;
      
      // Check if we have blocking questions
      const blockingQuestions = output.questions.filter(q => q.type === 'BLOCKING');
      
      if (blockingQuestions.length > 0 && output.spec === '') {
        // Blocked by questions
        session.status = 'questions';
        
        await this.updateProgress(session.ideaId, {
          sessionId: session.sessionId,
          sectionsComplete: 0,
          sectionsTotal: 5,
          pendingQuestions: blockingQuestions.map(q => q.content),
          generatedTasks: 0,
        });
        
        this.emit('questionsRequired', {
          ideaId: session.ideaId,
          sessionId: session.sessionId,
          questions: blockingQuestions,
        });
        
        return;
      }
      
      // Spec generated successfully
      await this.saveSpecOutput(session.ideaId, output);
      
      session.status = 'complete';
      session.completedAt = new Date();
      
      // Update progress
      await this.updateProgress(session.ideaId, {
        sessionId: session.sessionId,
        sectionsComplete: 5,
        sectionsTotal: 5,
        pendingQuestions: [],
        generatedTasks: output.metadata.taskCount,
      });
      
      // Emit completion event for orchestrator
      this.emit('specComplete', {
        ideaId: session.ideaId,
        sessionId: session.sessionId,
        taskCount: output.metadata.taskCount,
      });
      
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('specFailed', {
        ideaId: session.ideaId,
        sessionId: session.sessionId,
        error: session.error,
      });
      
      throw error;
    }
  }
  
  /**
   * Generate a brief file from ideation handoff data
   */
  private async generateBrief(ideaId: string, handoff: IdeationHandoff): Promise<string> {
    // Ensure briefs directory exists
    const briefsDir = path.resolve(this.config.briefsDir);
    if (!fs.existsSync(briefsDir)) {
      fs.mkdirSync(briefsDir, { recursive: true });
    }
    
    const briefPath = path.join(briefsDir, `${ideaId}.md`);
    
    // Generate brief content from handoff
    const briefContent = `---
id: ${ideaId}
title: ${this.extractTitle(handoff)}
complexity: medium
status: pending
---

# ${this.extractTitle(handoff)}

## Problem Statement

${handoff.problemStatement || 'Problem not yet defined.'}

## Proposed Solution

${handoff.solutionDescription || 'Solution not yet defined.'}

## Target Users

${handoff.targetUsers || 'Target users not yet defined.'}

## Key Requirements

${this.extractRequirements(handoff)}

## Technical Considerations

${this.extractTechnical(handoff)}

## Database Schema (if applicable)

\`\`\`sql
-- Auto-generated schema placeholder
-- Will be replaced by spec agent
\`\`\`

---

*Generated from ideation session*
`;
    
    fs.writeFileSync(briefPath, briefContent, 'utf-8');
    
    return briefPath;
  }
  
  /**
   * Extract title from handoff data
   */
  private extractTitle(handoff: IdeationHandoff): string {
    // Try to find a title artifact
    const titleArtifact = handoff.artifacts.find(a => 
      a.type === 'title' || a.type === 'name'
    );
    
    if (titleArtifact) {
      return titleArtifact.content;
    }
    
    // Generate from problem statement
    if (handoff.problemStatement) {
      const firstSentence = handoff.problemStatement.split('.')[0];
      return firstSentence.length < 60 ? firstSentence : `${firstSentence.slice(0, 57)}...`;
    }
    
    return `Idea ${handoff.ideaId}`;
  }
  
  /**
   * Extract requirements from handoff artifacts
   */
  private extractRequirements(handoff: IdeationHandoff): string {
    const reqArtifacts = handoff.artifacts.filter(a => 
      a.type.includes('requirement') || 
      a.type.includes('feature') ||
      a.type === 'mvp'
    );
    
    if (reqArtifacts.length > 0) {
      return reqArtifacts.map(a => `- ${a.content}`).join('\n');
    }
    
    return '- Core requirements to be determined during specification';
  }
  
  /**
   * Extract technical considerations from handoff
   */
  private extractTechnical(handoff: IdeationHandoff): string {
    const techArtifacts = handoff.artifacts.filter(a => 
      a.type.includes('technical') || 
      a.type.includes('architecture') ||
      a.type.includes('tech')
    );
    
    if (techArtifacts.length > 0) {
      return techArtifacts.map(a => a.content).join('\n\n');
    }
    
    return 'Technical approach to be determined during specification.';
  }
  
  /**
   * Save spec output to files and database
   */
  private async saveSpecOutput(ideaId: string, output: SpecOutput): Promise<void> {
    // Ensure output directory exists
    const outputDir = path.resolve(this.config.outputDir, ideaId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write spec.md
    fs.writeFileSync(
      path.join(outputDir, 'spec.md'),
      output.spec,
      'utf-8'
    );
    
    // Write tasks.md
    fs.writeFileSync(
      path.join(outputDir, 'tasks.md'),
      output.tasks,
      'utf-8'
    );
    
    // Store in database
    try {
      await run(
        `INSERT OR REPLACE INTO spec_outputs (idea_id, spec_content, tasks_content, task_count, generated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [ideaId, output.spec, output.tasks, output.metadata.taskCount, new Date().toISOString()]
      );
    } catch (error) {
      // Table might not exist yet - that's okay
      console.warn('[SpecBridge] Could not save to database:', error);
    }
  }
  
  /**
   * Update spec progress in orchestrator
   */
  private async updateProgress(ideaId: string, progress: Partial<SpecProgress>): Promise<void> {
    try {
      const orchestrator = getOrchestrator();
      await orchestrator.updateSpecProgress(ideaId, progress as SpecProgress);
    } catch (error) {
      console.error('[SpecBridge] Error updating progress:', error);
    }
  }
  
  /**
   * Answer questions and resume spec generation
   */
  async answerQuestions(
    sessionId: string,
    answers: Map<string, string>
  ): Promise<SpecSession> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.status !== 'questions') {
      throw new Error(`Session is not waiting for questions: ${session.status}`);
    }
    
    // Re-run spec generation with answers
    session.status = 'running';
    
    try {
      const briefPath = path.join(this.config.briefsDir, `${session.ideaId}.md`);
      
      const agent = createSpecAgent();
      
      const output = await agent.generateSpec({
        ideaSlug: session.ideaId,
        briefPath,
        skipQuestions: false,
        useDefaults: false,
        answers,
      });
      
      session.output = output;
      
      // Check for more questions
      const blockingQuestions = output.questions.filter(q => q.type === 'BLOCKING');
      
      if (blockingQuestions.length > 0 && output.spec === '') {
        session.status = 'questions';
        
        this.emit('questionsRequired', {
          ideaId: session.ideaId,
          sessionId: session.sessionId,
          questions: blockingQuestions,
        });
        
        return session;
      }
      
      // Complete
      await this.saveSpecOutput(session.ideaId, output);
      
      session.status = 'complete';
      session.completedAt = new Date();
      
      await this.updateProgress(session.ideaId, {
        sessionId: session.sessionId,
        sectionsComplete: 5,
        sectionsTotal: 5,
        pendingQuestions: [],
        generatedTasks: output.metadata.taskCount,
      });
      
      this.emit('specComplete', {
        ideaId: session.ideaId,
        sessionId: session.sessionId,
        taskCount: output.metadata.taskCount,
      });
      
      return session;
      
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }
  
  /**
   * Get session by ID
   */
  getSession(sessionId: string): SpecSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Get session for an idea
   */
  getSessionForIdea(ideaId: string): SpecSession | undefined {
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
  listSessions(): SpecSession[] {
    return Array.from(this.sessions.values());
  }
}

// Singleton instance
let bridgeInstance: SpecBridge | null = null;

export function getSpecBridge(): SpecBridge {
  if (!bridgeInstance) {
    bridgeInstance = new SpecBridge();
  }
  return bridgeInstance;
}

export function initializeSpecBridge(config?: {
  outputDir?: string;
  briefsDir?: string;
}): SpecBridge {
  bridgeInstance = new SpecBridge(config);
  return bridgeInstance;
}
