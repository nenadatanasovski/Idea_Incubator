/**
 * Spec Session Manager
 * 
 * Manages persistent spec sessions in the database.
 * Provides CRUD operations for spec_sessions table.
 */

import { v4 as uuid } from 'uuid';

export interface SpecSession {
  id: string;
  ideaId: string;
  status: 'active' | 'pending_input' | 'complete' | 'failed';
  
  // Specification content
  currentDraft: Specification | null;
  draftVersion: number;
  
  // Questions and refinement
  pendingQuestions: SpecQuestion[];
  answeredQuestions: SpecAnswer[];
  
  // Generated output
  tasks: TaskDefinition[];
  
  // Handoff data
  handoffData: IdeationToSpecHandoff | null;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface Specification {
  version: string;
  
  // Overview
  overview: {
    name: string;
    description: string;
    problemStatement: string;
    targetUsers: string[];
  };
  
  // Features
  features: Feature[];
  
  // Technical
  dataModel?: DataModel;
  apiEndpoints?: APIEndpoint[];
  uiComponents?: UIComponent[];
  
  // Non-functional
  constraints: Constraint[];
  assumptions: string[];
  
  // Metadata
  generatedFrom?: string;
  confidence: number;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  acceptanceCriteria: string[];
  technicalNotes?: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface SpecQuestion {
  id: string;
  question: string;
  context?: string;
  category: 'feature' | 'technical' | 'scope' | 'clarification';
  priority: 'blocking' | 'important' | 'optional';
  createdAt: Date;
}

export interface SpecAnswer extends SpecQuestion {
  answer: string;
  answeredAt: Date;
}

export interface TaskDefinition {
  id: string;
  specId: string;
  featureId: string;
  
  name: string;
  description: string;
  type: 'setup' | 'database' | 'api' | 'ui' | 'integration' | 'test';
  
  dependencies: string[];
  estimatedMinutes: number;
  
  technicalDetails: string;
  testCriteria: string[];
}

export interface IdeationToSpecHandoff {
  ideaId: string;
  problemStatement: string;
  solutionDescription: string;
  targetUsers: string;
  artifacts: { type: string; content: string }[];
  conversationSummary: string;
}

// Simplified types for spec generation
export interface DataModel {
  entities: { name: string; fields: { name: string; type: string }[] }[];
}

export interface APIEndpoint {
  path: string;
  method: string;
  description: string;
}

export interface UIComponent {
  name: string;
  type: string;
  description: string;
}

export interface Constraint {
  type: 'technical' | 'business' | 'legal';
  description: string;
}

// Database row type
interface SpecSessionRow {
  id: string;
  idea_id: string;
  status: string;
  current_draft: string | null;
  draft_version: number;
  pending_questions: string | null;
  answered_questions: string | null;
  tasks: string | null;
  handoff_data: string | null;
  created_at: string;
  updated_at: string;
}

// Database interface
interface Database {
  run(sql: string, params?: (string | number | null | boolean)[]): Promise<void>;
  query<T>(sql: string, params?: (string | number | null | boolean)[]): Promise<T[]>;
  getOne<T>(sql: string, params?: (string | number | null | boolean)[]): Promise<T | null>;
}

export class SpecSessionManager {
  constructor(private db: Database) {}
  
  /**
   * Create a new spec session
   */
  async createSession(
    ideaId: string, 
    handoffData?: IdeationToSpecHandoff
  ): Promise<SpecSession> {
    const id = `spec-${uuid()}`;
    const now = new Date().toISOString();
    
    await this.db.run(
      `INSERT INTO spec_sessions (
        id, idea_id, status, current_draft, draft_version, 
        pending_questions, answered_questions, tasks, handoff_data,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ideaId,
        'active',
        null,
        0,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        handoffData ? JSON.stringify(handoffData) : null,
        now,
        now
      ]
    );
    
    return {
      id,
      ideaId,
      status: 'active',
      currentDraft: null,
      draftVersion: 0,
      pendingQuestions: [],
      answeredQuestions: [],
      tasks: [],
      handoffData: handoffData || null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }
  
  /**
   * Load a session by ID
   */
  async loadSession(sessionId: string): Promise<SpecSession | null> {
    const row = await this.db.getOne<SpecSessionRow>(
      `SELECT * FROM spec_sessions WHERE id = ?`,
      [sessionId]
    );
    
    if (!row) return null;
    
    return this.rowToSession(row);
  }
  
  /**
   * Load session by idea ID (most recent)
   */
  async loadByIdeaId(ideaId: string): Promise<SpecSession | null> {
    const row = await this.db.getOne<SpecSessionRow>(
      `SELECT * FROM spec_sessions WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1`,
      [ideaId]
    );
    
    return row ? this.rowToSession(row) : null;
  }
  
  /**
   * Save session state
   */
  async saveSession(session: SpecSession): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.run(
      `UPDATE spec_sessions SET
        status = ?,
        current_draft = ?,
        draft_version = ?,
        pending_questions = ?,
        answered_questions = ?,
        tasks = ?,
        handoff_data = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        session.status,
        session.currentDraft ? JSON.stringify(session.currentDraft) : null,
        session.draftVersion,
        JSON.stringify(session.pendingQuestions),
        JSON.stringify(session.answeredQuestions),
        JSON.stringify(session.tasks),
        session.handoffData ? JSON.stringify(session.handoffData) : null,
        now,
        session.id
      ]
    );
  }
  
  /**
   * Update session status
   */
  async updateStatus(
    sessionId: string, 
    status: SpecSession['status']
  ): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.run(
      `UPDATE spec_sessions SET status = ?, updated_at = ? WHERE id = ?`,
      [status, now, sessionId]
    );
  }
  
  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.db.run(
      `DELETE FROM spec_sessions WHERE id = ?`,
      [sessionId]
    );
  }
  
  /**
   * List all sessions for an idea
   */
  async listSessionsForIdea(ideaId: string): Promise<SpecSession[]> {
    const rows = await this.db.query<SpecSessionRow>(
      `SELECT * FROM spec_sessions WHERE idea_id = ? ORDER BY created_at DESC`,
      [ideaId]
    );
    
    return rows.map(row => this.rowToSession(row));
  }
  
  /**
   * Convert database row to session object
   */
  private rowToSession(row: SpecSessionRow): SpecSession {
    return {
      id: row.id,
      ideaId: row.idea_id,
      status: row.status as SpecSession['status'],
      currentDraft: row.current_draft ? JSON.parse(row.current_draft) : null,
      draftVersion: row.draft_version,
      pendingQuestions: row.pending_questions ? JSON.parse(row.pending_questions) : [],
      answeredQuestions: row.answered_questions ? JSON.parse(row.answered_questions) : [],
      tasks: row.tasks ? JSON.parse(row.tasks) : [],
      handoffData: row.handoff_data ? JSON.parse(row.handoff_data) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Create session manager with default database
let sessionManagerInstance: SpecSessionManager | null = null;

export async function getSessionManager(): Promise<SpecSessionManager> {
  if (!sessionManagerInstance) {
    const { run, query, getOne } = await import('../../database/db.js');
    sessionManagerInstance = new SpecSessionManager({ run, query, getOne });
  }
  return sessionManagerInstance;
}

export function createSessionManager(db: Database): SpecSessionManager {
  return new SpecSessionManager(db);
}
