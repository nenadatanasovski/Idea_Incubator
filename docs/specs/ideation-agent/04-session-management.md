# Spec 4: Session Management & Memory

## Overview

This specification covers session lifecycle management, memory file handling, and handoff preparation for the Ideation Agent system.

## Dependencies

- Spec 1: Database & Data Models
- Spec 2-3: Core Algorithms (token-counter.ts)

---

## 1. Session Manager

Create file: `agents/ideation/session-manager.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../../database/db.js';
import {
  IdeationSession,
  IdeationSessionRow,
  SessionStatus,
  SessionPhase,
  IdeaCandidate,
} from '../../types/ideation.js';
import { mapSessionRowToSession, mapSessionToRow } from '../../utils/ideation-mappers.js';

/**
 * SESSION MANAGER
 *
 * Handles session lifecycle: create, load, update, complete, abandon.
 */

export interface CreateSessionParams {
  profileId: string;
}

export interface UpdateSessionParams {
  status?: SessionStatus;
  currentPhase?: SessionPhase;
  tokenCount?: number;
  messageCount?: number;
  handoffCount?: number;
}

export class SessionManager {
  /**
   * Create a new ideation session.
   */
  async create(params: CreateSessionParams): Promise<IdeationSession> {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(`
      INSERT INTO ideation_sessions (
        id, profile_id, status, current_phase,
        started_at, last_activity_at,
        handoff_count, token_count, message_count
      )
      VALUES (?, ?, 'active', 'exploring', ?, ?, 0, 0, 0)
    `, [id, params.profileId, now, now]);

    await saveDb();

    return this.load(id) as Promise<IdeationSession>;
  }

  /**
   * Load a session by ID.
   */
  async load(sessionId: string): Promise<IdeationSession | null> {
    const db = getDb();
    const results = db.exec(`
      SELECT * FROM ideation_sessions WHERE id = ?
    `, [sessionId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const columns = results[0].columns;
    const values = results[0].values[0];
    const row = columns.reduce((obj, col, i) => {
      obj[col] = values[i];
      return obj;
    }, {} as Record<string, unknown>) as IdeationSessionRow;

    return mapSessionRowToSession(row);
  }

  /**
   * Update session fields.
   */
  async update(sessionId: string, params: UpdateSessionParams): Promise<IdeationSession | null> {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (params.status !== undefined) {
      updates.push('status = ?');
      values.push(params.status);
    }
    if (params.currentPhase !== undefined) {
      updates.push('current_phase = ?');
      values.push(params.currentPhase);
    }
    if (params.tokenCount !== undefined) {
      updates.push('token_count = ?');
      values.push(params.tokenCount);
    }
    if (params.messageCount !== undefined) {
      updates.push('message_count = ?');
      values.push(params.messageCount);
    }
    if (params.handoffCount !== undefined) {
      updates.push('handoff_count = ?');
      values.push(params.handoffCount);
    }

    updates.push('last_activity_at = ?');
    values.push(new Date().toISOString());

    values.push(sessionId);

    db.run(`
      UPDATE ideation_sessions
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    await saveDb();

    return this.load(sessionId);
  }

  /**
   * Mark session as completed.
   */
  async complete(sessionId: string): Promise<IdeationSession | null> {
    const db = getDb();
    const now = new Date().toISOString();

    db.run(`
      UPDATE ideation_sessions
      SET status = 'completed', completed_at = ?, last_activity_at = ?
      WHERE id = ?
    `, [now, now, sessionId]);

    await saveDb();

    return this.load(sessionId);
  }

  /**
   * Mark session as abandoned.
   */
  async abandon(sessionId: string): Promise<IdeationSession | null> {
    const db = getDb();
    const now = new Date().toISOString();

    db.run(`
      UPDATE ideation_sessions
      SET status = 'abandoned', completed_at = ?, last_activity_at = ?
      WHERE id = ?
    `, [now, now, sessionId]);

    await saveDb();

    return this.load(sessionId);
  }

  /**
   * Get active sessions for a profile.
   */
  async getActiveByProfile(profileId: string): Promise<IdeationSession[]> {
    const db = getDb();
    const results = db.exec(`
      SELECT * FROM ideation_sessions
      WHERE profile_id = ? AND status = 'active'
      ORDER BY last_activity_at DESC
    `, [profileId]);

    if (results.length === 0) return [];

    const columns = results[0].columns;
    return results[0].values.map(values => {
      const row = columns.reduce((obj, col, i) => {
        obj[col] = values[i];
        return obj;
      }, {} as Record<string, unknown>) as IdeationSessionRow;
      return mapSessionRowToSession(row);
    });
  }

  /**
   * Increment handoff count for session.
   */
  async incrementHandoff(sessionId: string): Promise<void> {
    const db = getDb();

    db.run(`
      UPDATE ideation_sessions
      SET handoff_count = handoff_count + 1, last_activity_at = ?
      WHERE id = ?
    `, [new Date().toISOString(), sessionId]);

    await saveDb();
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
```

---

## 2. Message Store

Create file: `agents/ideation/message-store.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../../database/db.js';
import {
  IdeationMessage,
  IdeationMessageRow,
  MessageRole,
  ButtonOption,
  FormDefinition,
} from '../../types/ideation.js';
import { mapMessageRowToMessage, mapMessageToRow } from '../../utils/ideation-mappers.js';
import { estimateTokens } from './token-counter.js';

/**
 * MESSAGE STORE
 *
 * Handles message persistence and retrieval for ideation sessions.
 */

export interface CreateMessageParams {
  sessionId: string;
  role: MessageRole;
  content: string;
  buttonsShown?: ButtonOption[];
  formShown?: FormDefinition;
  tokenCount?: number;
}

export interface UpdateMessageParams {
  buttonClicked?: string;
  formResponse?: Record<string, unknown>;
}

export class MessageStore {
  /**
   * Create a new message.
   */
  async create(params: CreateMessageParams): Promise<IdeationMessage> {
    const db = getDb();
    const id = uuidv4();
    const tokenCount = params.tokenCount ?? estimateTokens(params.content);

    db.run(`
      INSERT INTO ideation_messages (
        id, session_id, role, content,
        buttons_shown, form_shown, token_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      params.sessionId,
      params.role,
      params.content,
      params.buttonsShown ? JSON.stringify(params.buttonsShown) : null,
      params.formShown ? JSON.stringify(params.formShown) : null,
      tokenCount,
      new Date().toISOString(),
    ]);

    await saveDb();

    return this.getById(id) as Promise<IdeationMessage>;
  }

  /**
   * Get message by ID.
   */
  async getById(messageId: string): Promise<IdeationMessage | null> {
    const db = getDb();
    const results = db.exec(`
      SELECT * FROM ideation_messages WHERE id = ?
    `, [messageId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const columns = results[0].columns;
    const values = results[0].values[0];
    const row = columns.reduce((obj, col, i) => {
      obj[col] = values[i];
      return obj;
    }, {} as Record<string, unknown>) as IdeationMessageRow;

    return mapMessageRowToMessage(row);
  }

  /**
   * Get all messages for a session.
   */
  async getBySession(sessionId: string): Promise<IdeationMessage[]> {
    const db = getDb();
    const results = db.exec(`
      SELECT * FROM ideation_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `, [sessionId]);

    if (results.length === 0) return [];

    const columns = results[0].columns;
    return results[0].values.map(values => {
      const row = columns.reduce((obj, col, i) => {
        obj[col] = values[i];
        return obj;
      }, {} as Record<string, unknown>) as IdeationMessageRow;
      return mapMessageRowToMessage(row);
    });
  }

  /**
   * Get last assistant message for a session.
   */
  async getLastAssistant(sessionId: string): Promise<IdeationMessage | null> {
    const db = getDb();
    const results = db.exec(`
      SELECT * FROM ideation_messages
      WHERE session_id = ? AND role = 'assistant'
      ORDER BY created_at DESC
      LIMIT 1
    `, [sessionId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const columns = results[0].columns;
    const values = results[0].values[0];
    const row = columns.reduce((obj, col, i) => {
      obj[col] = values[i];
      return obj;
    }, {} as Record<string, unknown>) as IdeationMessageRow;

    return mapMessageRowToMessage(row);
  }

  /**
   * Update message (e.g., when button clicked).
   */
  async update(messageId: string, params: UpdateMessageParams): Promise<IdeationMessage | null> {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (params.buttonClicked !== undefined) {
      updates.push('button_clicked = ?');
      values.push(params.buttonClicked);
    }
    if (params.formResponse !== undefined) {
      updates.push('form_response = ?');
      values.push(JSON.stringify(params.formResponse));
    }

    if (updates.length === 0) return this.getById(messageId);

    values.push(messageId);

    db.run(`
      UPDATE ideation_messages
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    await saveDb();

    return this.getById(messageId);
  }

  /**
   * Get total token count for session.
   */
  async getTotalTokens(sessionId: string): Promise<number> {
    const db = getDb();
    const results = db.exec(`
      SELECT SUM(token_count) as total FROM ideation_messages
      WHERE session_id = ?
    `, [sessionId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return 0;
    }

    return (results[0].values[0][0] as number) || 0;
  }

  /**
   * Get message count for session.
   */
  async getMessageCount(sessionId: string): Promise<number> {
    const db = getDb();
    const results = db.exec(`
      SELECT COUNT(*) as count FROM ideation_messages
      WHERE session_id = ?
    `, [sessionId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return 0;
    }

    return (results[0].values[0][0] as number) || 0;
  }

  /**
   * Get recent user messages for context.
   */
  async getRecentUserMessages(sessionId: string, limit: number = 10): Promise<string[]> {
    const db = getDb();
    const results = db.exec(`
      SELECT content FROM ideation_messages
      WHERE session_id = ? AND role = 'user'
      ORDER BY created_at DESC
      LIMIT ?
    `, [sessionId, limit]);

    if (results.length === 0) return [];

    return results[0].values.map(v => v[0] as string);
  }
}

// Singleton instance
export const messageStore = new MessageStore();
```

---

## 3. Memory Manager

Create file: `agents/ideation/memory-manager.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../../database/db.js';
import {
  MemoryFile,
  MemoryFileRow,
  MemoryFileType,
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
  IdeaCandidate,
  ViabilityRisk,
} from '../../types/ideation.js';
import { mapMemoryRowToMemory } from '../../utils/ideation-mappers.js';
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from '../../utils/ideation-defaults.js';

/**
 * MEMORY MANAGER
 *
 * Handles memory file storage for session state persistence and handoff.
 * Memory files are markdown documents stored in the database.
 */

export class MemoryManager {
  /**
   * Initialize memory files for a new session.
   */
  async initializeSession(sessionId: string): Promise<void> {
    const fileTypes: MemoryFileType[] = [
      'self_discovery',
      'market_discovery',
      'narrowing_state',
      'conversation_summary',
      'idea_candidate',
      'viability_assessment',
    ];

    for (const fileType of fileTypes) {
      await this.create(sessionId, fileType, this.getDefaultContent(fileType));
    }
  }

  /**
   * Create a memory file.
   */
  async create(sessionId: string, fileType: MemoryFileType, content: string): Promise<MemoryFile> {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(`
      INSERT INTO ideation_memory (id, session_id, file_type, content, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `, [id, sessionId, fileType, content, now, now]);

    await saveDb();

    return this.read(sessionId, fileType) as Promise<MemoryFile>;
  }

  /**
   * Read a memory file.
   */
  async read(sessionId: string, fileType: MemoryFileType): Promise<MemoryFile | null> {
    const db = getDb();
    const results = db.exec(`
      SELECT * FROM ideation_memory
      WHERE session_id = ? AND file_type = ?
    `, [sessionId, fileType]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const columns = results[0].columns;
    const values = results[0].values[0];
    const row = columns.reduce((obj, col, i) => {
      obj[col] = values[i];
      return obj;
    }, {} as Record<string, unknown>) as MemoryFileRow;

    return mapMemoryRowToMemory(row);
  }

  /**
   * Update a memory file (increment version).
   */
  async update(sessionId: string, fileType: MemoryFileType, content: string): Promise<MemoryFile | null> {
    const db = getDb();

    db.run(`
      UPDATE ideation_memory
      SET content = ?, version = version + 1, updated_at = ?
      WHERE session_id = ? AND file_type = ?
    `, [content, new Date().toISOString(), sessionId, fileType]);

    await saveDb();

    return this.read(sessionId, fileType);
  }

  /**
   * Get all memory files for a session.
   */
  async getAll(sessionId: string): Promise<MemoryFile[]> {
    const db = getDb();
    const results = db.exec(`
      SELECT * FROM ideation_memory
      WHERE session_id = ?
      ORDER BY file_type
    `, [sessionId]);

    if (results.length === 0) return [];

    const columns = results[0].columns;
    return results[0].values.map(values => {
      const row = columns.reduce((obj, col, i) => {
        obj[col] = values[i];
        return obj;
      }, {} as Record<string, unknown>) as MemoryFileRow;
      return mapMemoryRowToMemory(row);
    });
  }

  /**
   * Update all state-related memory files.
   */
  async updateAll(sessionId: string, state: {
    selfDiscovery: SelfDiscoveryState;
    marketDiscovery: MarketDiscoveryState;
    narrowingState: NarrowingState;
    candidate: IdeaCandidate | null;
    viability: { total: number; risks: ViabilityRisk[] };
  }): Promise<void> {
    await this.update(sessionId, 'self_discovery', this.formatSelfDiscoveryMarkdown(state.selfDiscovery));
    await this.update(sessionId, 'market_discovery', this.formatMarketDiscoveryMarkdown(state.marketDiscovery));
    await this.update(sessionId, 'narrowing_state', this.formatNarrowingStateMarkdown(state.narrowingState));

    if (state.candidate) {
      await this.update(sessionId, 'idea_candidate', this.formatCandidateMarkdown(state.candidate));
    }

    await this.update(sessionId, 'viability_assessment', this.formatViabilityMarkdown(state.viability.total, state.viability.risks));
  }

  /**
   * Get default content for a memory file type.
   */
  private getDefaultContent(fileType: MemoryFileType): string {
    switch (fileType) {
      case 'self_discovery':
        return this.formatSelfDiscoveryMarkdown(createDefaultSelfDiscoveryState());
      case 'market_discovery':
        return this.formatMarketDiscoveryMarkdown(createDefaultMarketDiscoveryState());
      case 'narrowing_state':
        return this.formatNarrowingStateMarkdown(createDefaultNarrowingState());
      case 'conversation_summary':
        return '# Conversation Summary\n\nNo conversation yet.';
      case 'idea_candidate':
        return '# Idea Candidate\n\nNo candidate formed yet.';
      case 'viability_assessment':
        return '# Viability Assessment\n\n**Score:** 100% (no issues detected)\n\n## Risks\n\nNone identified.';
      case 'handoff_notes':
        return '# Handoff Notes\n\nNo handoff occurred.';
      default:
        return '';
    }
  }

  /**
   * Format Self-Discovery state as markdown.
   */
  formatSelfDiscoveryMarkdown(state: SelfDiscoveryState): string {
    const lines: string[] = ['# Self-Discovery State', ''];

    // Impact Vision
    lines.push('## Impact Vision');
    if (state.impactVision.level) {
      lines.push(`- **Level:** ${state.impactVision.level}`);
      lines.push(`- **Description:** ${state.impactVision.description || 'Not specified'}`);
      lines.push(`- **Confidence:** ${Math.round(state.impactVision.confidence * 100)}%`);
    } else {
      lines.push('_Not yet determined_');
    }
    lines.push('');

    // Frustrations
    lines.push('## Frustrations');
    if (state.frustrations.length > 0) {
      for (const f of state.frustrations) {
        lines.push(`- **[${f.severity}]** ${f.description} _(${f.source})_`);
      }
    } else {
      lines.push('_None identified_');
    }
    lines.push('');

    // Expertise
    lines.push('## Expertise');
    if (state.expertise.length > 0) {
      for (const e of state.expertise) {
        lines.push(`- **${e.area}** (${e.depth}): ${e.evidence}`);
      }
    } else {
      lines.push('_None identified_');
    }
    lines.push('');

    // Interests
    lines.push('## Interests');
    if (state.interests.length > 0) {
      for (const i of state.interests) {
        lines.push(`- ${i.topic}${i.genuine ? ' (genuine)' : ''}`);
      }
    } else {
      lines.push('_None identified_');
    }
    lines.push('');

    // Skills
    lines.push('## Skills');
    lines.push('### Strengths');
    if (state.skills.strengths.length > 0) {
      lines.push(state.skills.strengths.map(s => `- ${s}`).join('\n'));
    } else {
      lines.push('_None identified_');
    }
    lines.push('### Gaps');
    if (state.skills.gaps.length > 0) {
      lines.push(state.skills.gaps.map(g => `- ${g}`).join('\n'));
    } else {
      lines.push('_None identified_');
    }
    lines.push('');

    // Constraints
    lines.push('## Constraints');
    lines.push(`- **Location:** ${state.constraints.location.target || 'Flexible'}${state.constraints.location.fixed ? ' (fixed)' : ''}`);
    lines.push(`- **Time:** ${state.constraints.timeHoursPerWeek !== null ? `${state.constraints.timeHoursPerWeek} hours/week` : 'Not specified'}`);
    lines.push(`- **Capital:** ${state.constraints.capital || 'Not specified'}`);
    lines.push(`- **Risk Tolerance:** ${state.constraints.riskTolerance || 'Not specified'}`);

    return lines.join('\n');
  }

  /**
   * Format Market-Discovery state as markdown.
   */
  formatMarketDiscoveryMarkdown(state: MarketDiscoveryState): string {
    const lines: string[] = ['# Market Discovery State', ''];

    // Competitors
    lines.push('## Competitors');
    if (state.competitors.length > 0) {
      for (const c of state.competitors) {
        lines.push(`### ${c.name}`);
        lines.push(`${c.description}`);
        if (c.strengths.length > 0) {
          lines.push(`- **Strengths:** ${c.strengths.join(', ')}`);
        }
        if (c.weaknesses.length > 0) {
          lines.push(`- **Weaknesses:** ${c.weaknesses.join(', ')}`);
        }
        lines.push(`- _Source: ${c.source}_`);
        lines.push('');
      }
    } else {
      lines.push('_None identified_');
    }
    lines.push('');

    // Gaps
    lines.push('## Market Gaps');
    if (state.gaps.length > 0) {
      for (const g of state.gaps) {
        lines.push(`- **[${g.relevance}]** ${g.description}`);
        lines.push(`  - Evidence: ${g.evidence}`);
      }
    } else {
      lines.push('_None identified_');
    }
    lines.push('');

    // Timing Signals
    lines.push('## Timing Signals');
    if (state.timingSignals.length > 0) {
      for (const t of state.timingSignals) {
        lines.push(`- ${t.signal} (${t.source})`);
        lines.push(`  - Implication: ${t.implication}`);
      }
    } else {
      lines.push('_None identified_');
    }
    lines.push('');

    // Failed Attempts
    lines.push('## Failed Attempts');
    if (state.failedAttempts.length > 0) {
      for (const f of state.failedAttempts) {
        lines.push(`- **${f.what}**`);
        lines.push(`  - Why: ${f.why}`);
        lines.push(`  - Lesson: ${f.lesson}`);
        lines.push(`  - Source: ${f.source}`);
      }
    } else {
      lines.push('_None identified_');
    }
    lines.push('');

    // Location Context
    lines.push('## Location Context');
    lines.push(`- **City:** ${state.locationContext.city || 'Not specified'}`);
    if (state.locationContext.localOpportunities.length > 0) {
      lines.push('- **Local Opportunities:**');
      for (const o of state.locationContext.localOpportunities) {
        lines.push(`  - ${o}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format Narrowing state as markdown.
   */
  formatNarrowingStateMarkdown(state: NarrowingState): string {
    const lines: string[] = ['# Narrowing State', ''];

    lines.push('## Dimensions');
    lines.push(`- **Product Type:** ${state.productType.value || 'Not determined'} (${Math.round(state.productType.confidence * 100)}% confidence)`);
    lines.push(`- **Customer Type:** ${state.customerType.value || 'Not determined'} (${Math.round(state.customerType.confidence * 100)}% confidence)`);
    lines.push(`- **Geography:** ${state.geography.value || 'Not determined'} (${Math.round(state.geography.confidence * 100)}% confidence)`);
    lines.push(`- **Scale:** ${state.scale.value || 'Not determined'} (${Math.round(state.scale.confidence * 100)}% confidence)`);
    lines.push(`- **Technical Depth:** ${state.technicalDepth.value || 'Not determined'} (${Math.round(state.technicalDepth.confidence * 100)}% confidence)`);
    lines.push('');

    lines.push('## Hypotheses');
    if (state.hypotheses.length > 0) {
      for (const h of state.hypotheses) {
        lines.push(`- ${h.description}`);
        if (h.supporting.length > 0) {
          lines.push(`  - Supporting: ${h.supporting.join(', ')}`);
        }
        if (h.contradicting.length > 0) {
          lines.push(`  - Contradicting: ${h.contradicting.join(', ')}`);
        }
      }
    } else {
      lines.push('_None formed_');
    }
    lines.push('');

    lines.push('## Questions Needed');
    if (state.questionsNeeded.length > 0) {
      for (const q of state.questionsNeeded) {
        lines.push(`- ${q.question}`);
        lines.push(`  - Purpose: ${q.purpose}`);
      }
    } else {
      lines.push('_None pending_');
    }

    return lines.join('\n');
  }

  /**
   * Format candidate as markdown.
   */
  formatCandidateMarkdown(candidate: IdeaCandidate): string {
    const lines: string[] = ['# Idea Candidate', ''];

    lines.push(`## ${candidate.title}`);
    lines.push('');
    lines.push(`**Status:** ${candidate.status}`);
    lines.push(`**Confidence:** ${candidate.confidence}%`);
    lines.push(`**Viability:** ${candidate.viability}%`);
    lines.push(`**User Suggested:** ${candidate.userSuggested ? 'Yes' : 'No'}`);
    lines.push('');

    if (candidate.summary) {
      lines.push('## Summary');
      lines.push(candidate.summary);
    }

    return lines.join('\n');
  }

  /**
   * Format viability assessment as markdown.
   */
  formatViabilityMarkdown(viability: number, risks: ViabilityRisk[]): string {
    const lines: string[] = ['# Viability Assessment', ''];

    const status = viability >= 75 ? 'Healthy' : viability >= 50 ? 'Caution' : viability >= 25 ? 'Warning' : 'Critical';
    lines.push(`**Overall Score:** ${viability}% (${status})`);
    lines.push('');

    lines.push('## Risks');
    if (risks.length > 0) {
      for (const r of risks) {
        lines.push(`### ${r.riskType.replace('_', ' ').toUpperCase()} [${r.severity}]`);
        lines.push(r.description);
        if (r.evidenceUrl) {
          lines.push(`- Source: ${r.evidenceUrl}`);
        }
        if (r.evidenceText) {
          lines.push(`- Evidence: "${r.evidenceText}"`);
        }
        lines.push(`- Acknowledged: ${r.userAcknowledged ? 'Yes' : 'No'}`);
        if (r.userResponse) {
          lines.push(`- User Response: ${r.userResponse}`);
        }
        lines.push('');
      }
    } else {
      lines.push('_No risks identified_');
    }

    return lines.join('\n');
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();
```

---

## 4. Handoff Preparation

Create file: `agents/ideation/handoff.ts`

```typescript
import { IdeationSession, IdeationMessage, SelfDiscoveryState, MarketDiscoveryState, NarrowingState, IdeaCandidate, ViabilityRisk } from '../../types/ideation.js';
import { memoryManager } from './memory-manager.js';
import { messageStore } from './message-store.js';
import { sessionManager } from './session-manager.js';

/**
 * HANDOFF PREPARATION
 *
 * Prepares memory files and resumption context for agent handoff.
 */

export interface HandoffPreparation {
  memoryFiles: {
    selfDiscovery: string;
    marketDiscovery: string;
    narrowingState: string;
    conversationSummary: string;
    ideaCandidate: string;
    viabilityAssessment: string;
    handoffNotes: string;
  };
  resumptionMessage: string;
}

export interface HandoffState {
  selfDiscovery: SelfDiscoveryState;
  marketDiscovery: MarketDiscoveryState;
  narrowingState: NarrowingState;
  candidate: IdeaCandidate | null;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
}

/**
 * Prepare for handoff when approaching token limit.
 */
export async function prepareHandoff(
  session: IdeationSession,
  currentState: HandoffState
): Promise<HandoffPreparation> {
  // Get conversation history
  const messages = await messageStore.getBySession(session.id);

  // Generate conversation summary
  const conversationSummary = generateConversationSummary(messages);

  // Get the last topic from user messages
  const lastUserMessage = messages
    .filter(m => m.role === 'user')
    .pop();

  // Generate handoff notes
  const handoffNotes = generateHandoffNotes(session, currentState, messages);

  // Format all memory files
  const memoryFiles = {
    selfDiscovery: memoryManager.formatSelfDiscoveryMarkdown(currentState.selfDiscovery),
    marketDiscovery: memoryManager.formatMarketDiscoveryMarkdown(currentState.marketDiscovery),
    narrowingState: memoryManager.formatNarrowingStateMarkdown(currentState.narrowingState),
    conversationSummary,
    ideaCandidate: currentState.candidate
      ? memoryManager.formatCandidateMarkdown(currentState.candidate)
      : '# No Candidate Yet\n\nNo idea candidate has formed.',
    viabilityAssessment: memoryManager.formatViabilityMarkdown(currentState.viability, currentState.risks),
    handoffNotes,
  };

  // Store handoff notes in database
  await memoryManager.update(session.id, 'handoff_notes', handoffNotes);
  await memoryManager.update(session.id, 'conversation_summary', conversationSummary);

  // Generate resumption message
  const resumptionMessage = generateResumptionMessage(lastUserMessage?.content);

  // Increment handoff count
  await sessionManager.incrementHandoff(session.id);

  return { memoryFiles, resumptionMessage };
}

/**
 * Generate a summary of the conversation for context.
 */
function generateConversationSummary(messages: IdeationMessage[]): string {
  const lines: string[] = ['# Conversation Summary', ''];

  lines.push(`**Total Messages:** ${messages.length}`);
  lines.push(`**Duration:** ${getConversationDuration(messages)}`);
  lines.push('');

  // Key topics discussed
  lines.push('## Key Topics Discussed');
  const topics = extractKeyTopics(messages);
  for (const topic of topics) {
    lines.push(`- ${topic}`);
  }
  lines.push('');

  // Recent context (last 5 exchanges)
  lines.push('## Recent Context');
  const recentMessages = messages.slice(-10);
  for (const msg of recentMessages) {
    const role = msg.role === 'user' ? 'USER' : 'AGENT';
    const content = msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '');
    lines.push(`**${role}:** ${content}`);
    lines.push('');
  }

  // Button/form interactions
  const interactions = messages.filter(m => m.buttonClicked || m.formResponse);
  if (interactions.length > 0) {
    lines.push('## User Interactions');
    for (const i of interactions) {
      if (i.buttonClicked) {
        lines.push(`- Clicked button: ${i.buttonClicked}`);
      }
      if (i.formResponse) {
        lines.push(`- Submitted form with ${Object.keys(i.formResponse).length} fields`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate handoff notes for the new agent instance.
 */
function generateHandoffNotes(
  session: IdeationSession,
  state: HandoffState,
  messages: IdeationMessage[]
): string {
  const lastUserMessages = messages
    .filter(m => m.role === 'user')
    .slice(-5)
    .map(m => m.content);

  const commStyle = classifyCommunicationStyle(lastUserMessages);

  const lines: string[] = [
    '# Agent Handoff Notes',
    '',
    '## Session Summary',
    `Session ${session.id} has been exploring ${state.candidate?.title || 'ideas'}`,
    `with the user. Current phase: ${session.currentPhase}.`,
    '',
    generateBriefSummary(messages),
    '',
    '## Current State',
    `- Idea candidate: ${state.candidate ? 'Yes' : 'No'}`,
  ];

  if (state.candidate) {
    lines.push(`- Title: ${state.candidate.title}`);
  }

  lines.push(`- Confidence level: ${state.confidence}%`);
  lines.push(`- Viability level: ${state.viability}%`);
  lines.push(`- Conversation phase: ${session.currentPhase}`);
  lines.push('');
  lines.push('## Immediate Next Steps');
  lines.push(`1. Continue exploring ${getNextExplorationArea(state)}`);
  lines.push(`2. ${state.viability < 75 ? 'Address viability concerns' : 'Validate with more market research'}`);
  lines.push(`3. ${state.confidence < 75 ? 'Clarify remaining gaps' : 'Prepare for capture'}`);
  lines.push('');
  lines.push('## User Rapport Notes');
  lines.push(`- Communication style: ${commStyle.style}`);
  lines.push(`- Engagement level: ${commStyle.engagement}`);
  lines.push(`- Topics that energize: ${commStyle.topicsThatEnergize.join(', ') || 'none identified'}`);
  lines.push(`- Response preference: ${commStyle.responsePreference}`);
  lines.push('');
  lines.push('## Critical Context');
  lines.push(extractCriticalContext(messages));

  return lines.join('\n');
}

/**
 * Generate resumption message for seamless handoff.
 */
function generateResumptionMessage(lastUserContent?: string): string {
  const opener = "Let me take a moment to organize my thoughts on everything we've discussed...";

  if (lastUserContent) {
    const topic = extractLastTopic(lastUserContent);
    return `${opener}\n\nAlright, I've got it all mapped out. You were telling me about ${topic}...`;
  }

  return `${opener}\n\nAlright, I've got it all mapped out. Where would you like to continue?`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getConversationDuration(messages: IdeationMessage[]): string {
  if (messages.length < 2) return 'Just started';

  const first = messages[0].createdAt;
  const last = messages[messages.length - 1].createdAt;
  const diffMs = last.getTime() - first.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 1) return 'Less than a minute';
  if (diffMins < 60) return `${diffMins} minutes`;
  const hours = Math.round(diffMins / 60);
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}

function extractKeyTopics(messages: IdeationMessage[]): string[] {
  const topics: Set<string> = new Set();
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);

  // Simple keyword extraction (could be enhanced with NLP)
  const keywords = ['problem', 'idea', 'business', 'market', 'competitor', 'customer', 'solution', 'skill', 'time', 'budget'];

  for (const msg of userMessages) {
    const msgLower = msg.toLowerCase();
    for (const kw of keywords) {
      if (msgLower.includes(kw)) {
        topics.add(kw);
      }
    }
  }

  return Array.from(topics).slice(0, 5);
}

function generateBriefSummary(messages: IdeationMessage[]): string {
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  const agentMsgCount = messages.filter(m => m.role === 'assistant').length;

  return `The conversation has ${userMsgCount} user messages and ${agentMsgCount} agent responses.`;
}

function getNextExplorationArea(state: HandoffState): string {
  if (!state.narrowingState.customerType.value) return 'target customer definition';
  if (!state.narrowingState.productType.value) return 'solution type';
  if (state.marketDiscovery.competitors.length === 0) return 'market landscape';
  if (state.selfDiscovery.frustrations.length === 0) return 'problem validation';
  return 'refining the concept';
}

function extractLastTopic(content: string): string {
  // Extract key phrase from last message
  const cleaned = content
    .replace(/[.!?]/g, '')
    .split(' ')
    .slice(-5)
    .join(' ');

  return cleaned || 'your idea';
}

function extractCriticalContext(messages: IdeationMessage[]): string {
  // Find any messages with high-impact content
  const userMessages = messages.filter(m => m.role === 'user');
  const criticalPhrases = ['important', 'must', 'critical', 'key', 'main', 'primary'];

  for (const msg of userMessages.slice().reverse()) {
    if (criticalPhrases.some(p => msg.content.toLowerCase().includes(p))) {
      return `User emphasized: "${msg.content.slice(0, 150)}..."`;
    }
  }

  return 'No critical context flagged.';
}

interface CommunicationProfile {
  style: 'verbose' | 'terse' | 'analytical' | 'emotional';
  engagement: 'high' | 'medium' | 'low';
  topicsThatEnergize: string[];
  responsePreference: 'detailed' | 'concise' | 'adaptive';
}

function classifyCommunicationStyle(messages: string[]): CommunicationProfile {
  if (messages.length === 0) {
    return {
      style: 'terse',
      engagement: 'medium',
      topicsThatEnergize: [],
      responsePreference: 'adaptive',
    };
  }

  const avgLength = messages.reduce((sum, m) => sum + m.length, 0) / messages.length;
  const avgWords = messages.reduce((sum, m) => sum + m.split(/\s+/).length, 0) / messages.length;

  // Determine style
  let style: 'verbose' | 'terse' | 'analytical' | 'emotional' = 'terse';
  if (avgWords > 50) style = 'verbose';
  else if (avgWords < 15) style = 'terse';

  // Determine engagement
  const totalExclamations = messages.join(' ').match(/!/g)?.length || 0;
  let engagement: 'high' | 'medium' | 'low' = 'medium';
  if (avgWords > 30 || totalExclamations > 2) engagement = 'high';
  else if (avgWords < 10) engagement = 'low';

  // Topics that energize (longer messages)
  const topicsThatEnergize = messages
    .filter(m => m.length > avgLength * 1.5)
    .flatMap(m => m.split(/\s+/).filter(w => w.length > 5))
    .slice(0, 3);

  // Response preference
  const responsePreference = style === 'verbose' ? 'detailed' : style === 'terse' ? 'concise' : 'adaptive';

  return { style, engagement, topicsThatEnergize, responsePreference };
}
```

---

## 4.7 Get Active Session by Profile

Add method to SessionManager to check for existing active sessions:

```typescript
// Add to SessionManager class in session-manager.ts

/**
 * Gets the active session for a profile, if one exists.
 * Used to enforce "one idea at a time" constraint.
 */
async getActiveByProfile(profileId: string): Promise<IdeationSession | null> {
  const db = getDb();
  const row = db.exec(`
    SELECT *
    FROM ideation_sessions
    WHERE profile_id = ?
      AND status = 'active'
    ORDER BY last_activity_at DESC
    LIMIT 1
  `, [profileId])[0];

  if (!row || row.values.length === 0) {
    return null;
  }

  return mapSessionRowToSession(rowToObject(row) as IdeationSessionRow);
}

/**
 * Checks if a profile has an active session with an idea candidate.
 * Returns the candidate if one exists.
 */
async getActiveSessionWithCandidate(profileId: string): Promise<{
  session: IdeationSession;
  candidate: IdeaCandidate;
} | null> {
  const activeSession = await this.getActiveByProfile(profileId);
  if (!activeSession) return null;

  const db = getDb();
  const candidateRow = db.exec(`
    SELECT *
    FROM ideation_candidates
    WHERE session_id = ?
      AND status IN ('forming', 'active')
    ORDER BY updated_at DESC
    LIMIT 1
  `, [activeSession.id])[0];

  if (!candidateRow || candidateRow.values.length === 0) {
    return null;
  }

  const candidate = mapCandidateRowToCandidate(
    rowToObject(candidateRow) as IdeaCandidateRow
  );

  return { session: activeSession, candidate };
}
```

---

## 4.8 Greeting Generator

The Greeting Generator creates personalized opening messages based on user profile and entry mode.

### 4.8.1 Implementation

```typescript
// =============================================================================
// FILE: agents/ideation/greeting-generator.ts
// =============================================================================

import type { UserProfile } from '../../types/index';
import type { EntryMode, ButtonOption } from '../../types/ideation';

export interface GreetingResult {
  text: string;
  buttons: ButtonOption[];
}

/**
 * Generates a personalized greeting based on profile and entry mode
 */
export function generateGreeting(
  profile: UserProfile,
  entryMode: EntryMode
): GreetingResult {
  if (entryMode === 'have_idea') {
    return generateHaveIdeaGreeting(profile);
  } else {
    return generateDiscoverGreeting(profile);
  }
}

function generateHaveIdeaGreeting(profile: UserProfile): GreetingResult {
  const profileContext = buildProfileContext(profile);

  const text = `Great! You have an idea you want to explore.

${profileContext}

Tell me about your idea. What problem are you trying to solve, and for whom?

Feel free to share as much or as little detail as you'd like — we can explore it together.`;

  const buttons: ButtonOption[] = [
    {
      id: 'btn_describe_idea',
      label: 'I\'ll describe my idea',
      value: 'describe_idea',
      style: 'primary',
    },
    {
      id: 'btn_have_name',
      label: 'I have a name for it',
      value: 'have_name',
      style: 'secondary',
    },
    {
      id: 'btn_rough_concept',
      label: 'It\'s still rough',
      value: 'rough_concept',
      style: 'secondary',
    },
  ];

  return { text, buttons };
}

function generateDiscoverGreeting(profile: UserProfile): GreetingResult {
  const profileContext = buildProfileContext(profile);

  const text = `Welcome! I'm here to help you discover a business idea that's genuinely right for you.

Here's how this works: We'll have a conversation where I ask questions, you answer, and together we'll explore what excites you and what the market needs. As we go, I'll be looking for where those two things overlap.

When I spot a promising idea, it'll appear in the panel to your right. I'll also let you know if I see significant challenges — better to know early than waste time on something that won't work.

${profileContext}

What's been occupying your mind lately? Any problems you've noticed, frustrations you've had, or opportunities you've wondered about?`;

  const buttons: ButtonOption[] = [
    {
      id: 'btn_frustration',
      label: 'Something frustrates me',
      value: 'frustration',
      style: 'primary',
    },
    {
      id: 'btn_opportunity',
      label: 'I spotted an opportunity',
      value: 'opportunity',
      style: 'secondary',
    },
    {
      id: 'btn_explore',
      label: 'Help me explore',
      value: 'explore',
      style: 'secondary',
    },
    {
      id: 'btn_unsure',
      label: 'Not sure where to start',
      value: 'unsure',
      style: 'outline',
      fullWidth: true,
    },
  ];

  return { text, buttons };
}

function buildProfileContext(profile: UserProfile): string {
  const parts: string[] = [];

  // Acknowledge profile was loaded
  parts.push("I've loaded your profile, so I know a bit about your background.");

  // Expertise areas
  if (profile.skills && profile.skills.length > 0) {
    const topSkills = profile.skills.slice(0, 3).map(s =>
      typeof s === 'string' ? s : s.name
    );
    parts.push(`You have experience in ${topSkills.join(', ')}.`);
  }

  // Interests
  if (profile.interests && profile.interests.length > 0) {
    const topInterests = profile.interests.slice(0, 3);
    parts.push(`You're interested in ${topInterests.join(', ')}.`);
  }

  // Location context
  if (profile.location) {
    parts.push(`You're based in ${profile.location}.`);
  }

  // Time constraints
  if (profile.hoursPerWeek) {
    if (profile.hoursPerWeek >= 40) {
      parts.push(`You're looking at this full-time.`);
    } else if (profile.hoursPerWeek >= 20) {
      parts.push(`You have about ${profile.hoursPerWeek} hours per week to dedicate to this.`);
    } else {
      parts.push(`This would be a side project with ${profile.hoursPerWeek} hours per week.`);
    }
  }

  return parts.join(' ');
}

/**
 * Generates follow-up for button clicks on greeting
 */
export function generateGreetingFollowUp(
  buttonValue: string,
  profile: UserProfile
): GreetingResult {
  switch (buttonValue) {
    case 'frustration':
      return {
        text: `Good starting point. Frustrations often reveal real problems worth solving.

Walk me through it — what's the frustration, and when do you encounter it most often?`,
        buttons: [],
      };

    case 'opportunity':
      return {
        text: `Interesting! Tell me more about this opportunity.

What did you observe, and what made you think "there's something here"?`,
        buttons: [],
      };

    case 'explore':
      return {
        text: `Let's explore together. I'll ask some questions to understand what makes you tick.

First question: What's something in your work or life that feels harder than it should be? Something where you think "surely there's a better way"?`,
        buttons: [],
      };

    case 'unsure':
      return {
        text: `No problem — that's what I'm here for.

Let's start simple: In the past week, what's something that annoyed you or made you wish things worked differently?

It doesn't have to be business-related. Sometimes the best ideas come from everyday frustrations.`,
        buttons: [
          {
            id: 'btn_work_related',
            label: 'Something at work',
            value: 'work_frustration',
            style: 'secondary',
          },
          {
            id: 'btn_personal',
            label: 'Something personal',
            value: 'personal_frustration',
            style: 'secondary',
          },
          {
            id: 'btn_nothing',
            label: 'Can\'t think of anything',
            value: 'nothing_specific',
            style: 'outline',
          },
        ],
      };

    case 'describe_idea':
      return {
        text: `Perfect. Go ahead and describe your idea.

What problem does it solve, and who experiences that problem?`,
        buttons: [],
      };

    case 'have_name':
      return {
        text: `Great! What's the name, and give me a one-sentence description of what it does.`,
        buttons: [],
      };

    case 'rough_concept':
      return {
        text: `That's fine — most ideas start rough.

What's the kernel of the idea? Even if it's just a hunch or a question, that's a good starting point.`,
        buttons: [],
      };

    default:
      return {
        text: `Tell me more about that.`,
        buttons: [],
      };
  }
}
```

### 4.8.2 Tests

```typescript
describe('GreetingGenerator', () => {
  describe('generateGreeting', () => {

    test('PASS: Generates discover greeting with profile context', () => {
      const profile = {
        id: 'profile_1',
        skills: ['JavaScript', 'Python', 'Machine Learning'],
        interests: ['healthcare', 'education'],
        location: 'Sydney',
        hoursPerWeek: 20,
      };

      const result = generateGreeting(profile, 'discover');

      expect(result.text).toContain('Welcome');
      expect(result.text).toContain('JavaScript');
      expect(result.text).toContain('healthcare');
      expect(result.text).toContain('Sydney');
      expect(result.buttons.length).toBe(4);
    });

    test('PASS: Generates have_idea greeting', () => {
      const profile = { id: 'profile_1' };

      const result = generateGreeting(profile, 'have_idea');

      expect(result.text).toContain('You have an idea');
      expect(result.text).toContain('Tell me about your idea');
      expect(result.buttons.length).toBe(3);
    });

    test('PASS: Includes correct button IDs', () => {
      const profile = { id: 'profile_1' };

      const result = generateGreeting(profile, 'discover');

      expect(result.buttons.find(b => b.id === 'btn_frustration')).toBeDefined();
      expect(result.buttons.find(b => b.id === 'btn_opportunity')).toBeDefined();
      expect(result.buttons.find(b => b.id === 'btn_explore')).toBeDefined();
      expect(result.buttons.find(b => b.id === 'btn_unsure')).toBeDefined();
    });

    test('PASS: Handles empty profile gracefully', () => {
      const profile = { id: 'profile_1' };

      const result = generateGreeting(profile, 'discover');

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(100);
    });

    test('PASS: Describes time commitment correctly', () => {
      const fullTimeProfile = { id: 'p1', hoursPerWeek: 45 };
      const partTimeProfile = { id: 'p2', hoursPerWeek: 25 };
      const sideProfile = { id: 'p3', hoursPerWeek: 10 };

      expect(generateGreeting(fullTimeProfile, 'discover').text).toContain('full-time');
      expect(generateGreeting(partTimeProfile, 'discover').text).toContain('25 hours');
      expect(generateGreeting(sideProfile, 'discover').text).toContain('side project');
    });
  });

  describe('generateGreetingFollowUp', () => {

    test('PASS: Frustration follow-up asks for details', () => {
      const result = generateGreetingFollowUp('frustration', {});

      expect(result.text).toContain('Frustrations');
      expect(result.text).toContain('Walk me through');
      expect(result.buttons.length).toBe(0);
    });

    test('PASS: Unsure follow-up provides options', () => {
      const result = generateGreetingFollowUp('unsure', {});

      expect(result.text).toContain('simple');
      expect(result.buttons.length).toBe(3);
    });

    test('PASS: Opportunity follow-up asks what was observed', () => {
      const result = generateGreetingFollowUp('opportunity', {});

      expect(result.text).toContain('observe');
    });

    test('PASS: Have_name asks for description', () => {
      const result = generateGreetingFollowUp('have_name', {});

      expect(result.text).toContain('name');
      expect(result.text).toContain('one-sentence');
    });

    test('PASS: Unknown button gets generic response', () => {
      const result = generateGreetingFollowUp('unknown_button', {});

      expect(result.text).toContain('Tell me more');
    });
  });
});
```

---

## 5. Test Plan

### 5.1 Session Manager Tests

Create file: `tests/ideation/session-manager.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, closeDb, getDb } from '../../database/db.js';
import { sessionManager } from '../../agents/ideation/session-manager.js';

describe('SessionManager', () => {
  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    // Clean up test data
    const db = getDb();
    db.run(`DELETE FROM ideation_sessions WHERE profile_id LIKE 'test_%'`);
  });

  describe('create', () => {
    test('PASS: Creates session with valid profile', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_1' });

      expect(session.id).toBeDefined();
      expect(session.profileId).toBe('test_profile_1');
      expect(session.status).toBe('active');
      expect(session.currentPhase).toBe('exploring');
      expect(session.handoffCount).toBe(0);
      expect(session.tokenCount).toBe(0);
      expect(session.messageCount).toBe(0);
    });

    test('PASS: Creates session with correct timestamps', async () => {
      const before = new Date();
      const session = await sessionManager.create({ profileId: 'test_profile_2' });
      const after = new Date();

      expect(session.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session.startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(session.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session.completedAt).toBeNull();
    });

    test('PASS: Creates unique session IDs', async () => {
      const session1 = await sessionManager.create({ profileId: 'test_profile_3' });
      const session2 = await sessionManager.create({ profileId: 'test_profile_3' });

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('load', () => {
    test('PASS: Loads existing session', async () => {
      const created = await sessionManager.create({ profileId: 'test_profile_load' });
      const loaded = await sessionManager.load(created.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(created.id);
      expect(loaded!.profileId).toBe(created.profileId);
    });

    test('PASS: Returns null for nonexistent session', async () => {
      const loaded = await sessionManager.load('nonexistent_session_id');

      expect(loaded).toBeNull();
    });
  });

  describe('update', () => {
    test('PASS: Updates status', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_update' });

      await sessionManager.update(session.id, { status: 'abandoned' });
      const updated = await sessionManager.load(session.id);

      expect(updated!.status).toBe('abandoned');
    });

    test('PASS: Updates phase', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_phase' });

      await sessionManager.update(session.id, { currentPhase: 'narrowing' });
      const updated = await sessionManager.load(session.id);

      expect(updated!.currentPhase).toBe('narrowing');
    });

    test('PASS: Updates token count', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_tokens' });

      await sessionManager.update(session.id, { tokenCount: 5000 });
      const updated = await sessionManager.load(session.id);

      expect(updated!.tokenCount).toBe(5000);
    });

    test('PASS: Updates message count', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_msgs' });

      await sessionManager.update(session.id, { messageCount: 10 });
      const updated = await sessionManager.load(session.id);

      expect(updated!.messageCount).toBe(10);
    });

    test('PASS: Updates lastActivityAt automatically', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_activity' });
      const originalActivity = session.lastActivityAt;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await sessionManager.update(session.id, { tokenCount: 100 });
      const updated = await sessionManager.load(session.id);

      expect(updated!.lastActivityAt.getTime()).toBeGreaterThanOrEqual(originalActivity.getTime());
    });
  });

  describe('complete', () => {
    test('PASS: Sets status to completed', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_complete' });

      await sessionManager.complete(session.id);
      const completed = await sessionManager.load(session.id);

      expect(completed!.status).toBe('completed');
    });

    test('PASS: Sets completedAt timestamp', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_complete_ts' });

      const before = new Date();
      await sessionManager.complete(session.id);
      const after = new Date();

      const completed = await sessionManager.load(session.id);

      expect(completed!.completedAt).not.toBeNull();
      expect(completed!.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(completed!.completedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('abandon', () => {
    test('PASS: Sets status to abandoned', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_abandon' });

      await sessionManager.abandon(session.id);
      const abandoned = await sessionManager.load(session.id);

      expect(abandoned!.status).toBe('abandoned');
    });

    test('PASS: Sets completedAt timestamp', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_abandon_ts' });

      await sessionManager.abandon(session.id);
      const abandoned = await sessionManager.load(session.id);

      expect(abandoned!.completedAt).not.toBeNull();
    });
  });

  describe('getActiveByProfile', () => {
    test('PASS: Returns active sessions for profile', async () => {
      await sessionManager.create({ profileId: 'test_profile_active' });
      await sessionManager.create({ profileId: 'test_profile_active' });

      const sessions = await sessionManager.getActiveByProfile('test_profile_active');

      expect(sessions.length).toBe(2);
      expect(sessions.every(s => s.status === 'active')).toBe(true);
    });

    test('PASS: Does not return completed sessions', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_completed' });
      await sessionManager.complete(session.id);

      const sessions = await sessionManager.getActiveByProfile('test_profile_completed');

      expect(sessions.length).toBe(0);
    });

    test('PASS: Returns empty array for profile with no sessions', async () => {
      const sessions = await sessionManager.getActiveByProfile('nonexistent_profile');

      expect(sessions).toEqual([]);
    });
  });

  describe('incrementHandoff', () => {
    test('PASS: Increments handoff count', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_handoff' });
      expect(session.handoffCount).toBe(0);

      await sessionManager.incrementHandoff(session.id);
      const updated = await sessionManager.load(session.id);

      expect(updated!.handoffCount).toBe(1);
    });

    test('PASS: Increments multiple times', async () => {
      const session = await sessionManager.create({ profileId: 'test_profile_multi_handoff' });

      await sessionManager.incrementHandoff(session.id);
      await sessionManager.incrementHandoff(session.id);
      await sessionManager.incrementHandoff(session.id);

      const updated = await sessionManager.load(session.id);

      expect(updated!.handoffCount).toBe(3);
    });
  });
});
```

### 5.2 Message Store Tests

Create file: `tests/ideation/message-store.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, closeDb, getDb } from '../../database/db.js';
import { messageStore } from '../../agents/ideation/message-store.js';
import { sessionManager } from '../../agents/ideation/session-manager.js';

describe('MessageStore', () => {
  let testSessionId: string;

  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    // Create a fresh session for each test
    const session = await sessionManager.create({ profileId: 'test_profile_msg' });
    testSessionId = session.id;
  });

  describe('create', () => {
    test('PASS: Creates message with required fields', async () => {
      const message = await messageStore.create({
        sessionId: testSessionId,
        role: 'user',
        content: 'Hello, world!',
      });

      expect(message.id).toBeDefined();
      expect(message.sessionId).toBe(testSessionId);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
      expect(message.tokenCount).toBeGreaterThan(0);
    });

    test('PASS: Creates message with buttons', async () => {
      const buttons = [
        { id: 'btn1', label: 'Option 1', value: 'opt1', style: 'primary' as const },
        { id: 'btn2', label: 'Option 2', value: 'opt2', style: 'secondary' as const },
      ];

      const message = await messageStore.create({
        sessionId: testSessionId,
        role: 'assistant',
        content: 'Choose an option',
        buttonsShown: buttons,
      });

      expect(message.buttonsShown).toEqual(buttons);
    });

    test('PASS: Creates message with form', async () => {
      const form = {
        id: 'form1',
        title: 'Quick Survey',
        fields: [
          { id: 'name', type: 'text' as const, label: 'Your name' },
        ],
      };

      const message = await messageStore.create({
        sessionId: testSessionId,
        role: 'assistant',
        content: 'Fill out this form',
        formShown: form,
      });

      expect(message.formShown).toEqual(form);
    });

    test('PASS: Auto-calculates token count', async () => {
      const content = 'a'.repeat(400); // ~100 tokens

      const message = await messageStore.create({
        sessionId: testSessionId,
        role: 'user',
        content,
      });

      expect(message.tokenCount).toBeGreaterThanOrEqual(90);
      expect(message.tokenCount).toBeLessThanOrEqual(110);
    });

    test('PASS: Accepts manual token count', async () => {
      const message = await messageStore.create({
        sessionId: testSessionId,
        role: 'user',
        content: 'Test',
        tokenCount: 42,
      });

      expect(message.tokenCount).toBe(42);
    });
  });

  describe('getById', () => {
    test('PASS: Returns existing message', async () => {
      const created = await messageStore.create({
        sessionId: testSessionId,
        role: 'user',
        content: 'Test message',
      });

      const retrieved = await messageStore.getById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.content).toBe('Test message');
    });

    test('PASS: Returns null for nonexistent message', async () => {
      const retrieved = await messageStore.getById('nonexistent_id');

      expect(retrieved).toBeNull();
    });
  });

  describe('getBySession', () => {
    test('PASS: Returns all messages for session in order', async () => {
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'First' });
      await messageStore.create({ sessionId: testSessionId, role: 'assistant', content: 'Second' });
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'Third' });

      const messages = await messageStore.getBySession(testSessionId);

      expect(messages.length).toBe(3);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });

    test('PASS: Returns empty array for session with no messages', async () => {
      const messages = await messageStore.getBySession('empty_session');

      expect(messages).toEqual([]);
    });
  });

  describe('getLastAssistant', () => {
    test('PASS: Returns last assistant message', async () => {
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'User 1' });
      await messageStore.create({ sessionId: testSessionId, role: 'assistant', content: 'Assistant 1' });
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'User 2' });
      await messageStore.create({ sessionId: testSessionId, role: 'assistant', content: 'Assistant 2' });
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'User 3' });

      const lastAssistant = await messageStore.getLastAssistant(testSessionId);

      expect(lastAssistant).not.toBeNull();
      expect(lastAssistant!.content).toBe('Assistant 2');
    });

    test('PASS: Returns null if no assistant messages', async () => {
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'User only' });

      const lastAssistant = await messageStore.getLastAssistant(testSessionId);

      expect(lastAssistant).toBeNull();
    });
  });

  describe('update', () => {
    test('PASS: Updates buttonClicked', async () => {
      const message = await messageStore.create({
        sessionId: testSessionId,
        role: 'assistant',
        content: 'Choose',
        buttonsShown: [{ id: 'btn1', label: 'Click', value: 'clicked', style: 'primary' }],
      });

      await messageStore.update(message.id, { buttonClicked: 'btn1' });
      const updated = await messageStore.getById(message.id);

      expect(updated!.buttonClicked).toBe('btn1');
    });

    test('PASS: Updates formResponse', async () => {
      const message = await messageStore.create({
        sessionId: testSessionId,
        role: 'assistant',
        content: 'Form',
        formShown: { id: 'form1', fields: [] },
      });

      await messageStore.update(message.id, { formResponse: { name: 'John' } });
      const updated = await messageStore.getById(message.id);

      expect(updated!.formResponse).toEqual({ name: 'John' });
    });
  });

  describe('getTotalTokens', () => {
    test('PASS: Sums token counts for session', async () => {
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'Test', tokenCount: 100 });
      await messageStore.create({ sessionId: testSessionId, role: 'assistant', content: 'Response', tokenCount: 200 });
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'Follow up', tokenCount: 50 });

      const total = await messageStore.getTotalTokens(testSessionId);

      expect(total).toBe(350);
    });

    test('PASS: Returns 0 for empty session', async () => {
      const total = await messageStore.getTotalTokens('empty_session');

      expect(total).toBe(0);
    });
  });

  describe('getMessageCount', () => {
    test('PASS: Counts messages correctly', async () => {
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'One' });
      await messageStore.create({ sessionId: testSessionId, role: 'assistant', content: 'Two' });
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'Three' });

      const count = await messageStore.getMessageCount(testSessionId);

      expect(count).toBe(3);
    });
  });

  describe('getRecentUserMessages', () => {
    test('PASS: Returns recent user messages only', async () => {
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'User 1' });
      await messageStore.create({ sessionId: testSessionId, role: 'assistant', content: 'Assistant 1' });
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'User 2' });
      await messageStore.create({ sessionId: testSessionId, role: 'assistant', content: 'Assistant 2' });
      await messageStore.create({ sessionId: testSessionId, role: 'user', content: 'User 3' });

      const recent = await messageStore.getRecentUserMessages(testSessionId, 10);

      expect(recent).toEqual(['User 3', 'User 2', 'User 1']);
    });

    test('PASS: Respects limit parameter', async () => {
      for (let i = 1; i <= 5; i++) {
        await messageStore.create({ sessionId: testSessionId, role: 'user', content: `User ${i}` });
      }

      const recent = await messageStore.getRecentUserMessages(testSessionId, 2);

      expect(recent.length).toBe(2);
    });
  });
});
```

### 5.3 Memory Manager Tests

Create file: `tests/ideation/memory-manager.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, closeDb, getDb } from '../../database/db.js';
import { memoryManager } from '../../agents/ideation/memory-manager.js';
import { sessionManager } from '../../agents/ideation/session-manager.js';
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from '../../utils/ideation-defaults.js';

describe('MemoryManager', () => {
  let testSessionId: string;

  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    const session = await sessionManager.create({ profileId: 'test_profile_mem' });
    testSessionId = session.id;
  });

  describe('initializeSession', () => {
    test('PASS: Creates all required memory files', async () => {
      await memoryManager.initializeSession(testSessionId);

      const files = await memoryManager.getAll(testSessionId);

      expect(files.length).toBe(6); // All types except handoff_notes
      const fileTypes = files.map(f => f.fileType);
      expect(fileTypes).toContain('self_discovery');
      expect(fileTypes).toContain('market_discovery');
      expect(fileTypes).toContain('narrowing_state');
      expect(fileTypes).toContain('conversation_summary');
      expect(fileTypes).toContain('idea_candidate');
      expect(fileTypes).toContain('viability_assessment');
    });

    test('PASS: Memory files have default content', async () => {
      await memoryManager.initializeSession(testSessionId);

      const selfDiscovery = await memoryManager.read(testSessionId, 'self_discovery');

      expect(selfDiscovery).not.toBeNull();
      expect(selfDiscovery!.content).toContain('# Self-Discovery State');
    });
  });

  describe('create', () => {
    test('PASS: Creates memory file with content', async () => {
      const file = await memoryManager.create(testSessionId, 'self_discovery', '# Test Content');

      expect(file.id).toBeDefined();
      expect(file.sessionId).toBe(testSessionId);
      expect(file.fileType).toBe('self_discovery');
      expect(file.content).toBe('# Test Content');
      expect(file.version).toBe(1);
    });

    test('FAIL: Rejects duplicate file type for same session', async () => {
      await memoryManager.create(testSessionId, 'self_discovery', 'First');

      await expect(
        memoryManager.create(testSessionId, 'self_discovery', 'Second')
      ).rejects.toThrow();
    });
  });

  describe('read', () => {
    test('PASS: Reads existing memory file', async () => {
      await memoryManager.create(testSessionId, 'market_discovery', 'Market content');

      const file = await memoryManager.read(testSessionId, 'market_discovery');

      expect(file).not.toBeNull();
      expect(file!.content).toBe('Market content');
    });

    test('PASS: Returns null for nonexistent file', async () => {
      const file = await memoryManager.read(testSessionId, 'handoff_notes');

      expect(file).toBeNull();
    });
  });

  describe('update', () => {
    test('PASS: Updates content and increments version', async () => {
      await memoryManager.create(testSessionId, 'narrowing_state', 'Version 1');

      await memoryManager.update(testSessionId, 'narrowing_state', 'Version 2');
      const updated = await memoryManager.read(testSessionId, 'narrowing_state');

      expect(updated!.content).toBe('Version 2');
      expect(updated!.version).toBe(2);
    });

    test('PASS: Updates updatedAt timestamp', async () => {
      await memoryManager.create(testSessionId, 'conversation_summary', 'Initial');
      const initial = await memoryManager.read(testSessionId, 'conversation_summary');

      await new Promise(resolve => setTimeout(resolve, 10));

      await memoryManager.update(testSessionId, 'conversation_summary', 'Updated');
      const updated = await memoryManager.read(testSessionId, 'conversation_summary');

      expect(updated!.updatedAt.getTime()).toBeGreaterThan(initial!.updatedAt.getTime());
    });
  });

  describe('getAll', () => {
    test('PASS: Returns all memory files for session', async () => {
      await memoryManager.create(testSessionId, 'self_discovery', 'SD');
      await memoryManager.create(testSessionId, 'market_discovery', 'MD');

      const files = await memoryManager.getAll(testSessionId);

      expect(files.length).toBe(2);
    });

    test('PASS: Returns empty array for session with no files', async () => {
      const files = await memoryManager.getAll('empty_session_id');

      expect(files).toEqual([]);
    });
  });

  describe('formatSelfDiscoveryMarkdown', () => {
    test('PASS: Formats empty state correctly', () => {
      const state = createDefaultSelfDiscoveryState();
      const markdown = memoryManager.formatSelfDiscoveryMarkdown(state);

      expect(markdown).toContain('# Self-Discovery State');
      expect(markdown).toContain('## Impact Vision');
      expect(markdown).toContain('_Not yet determined_');
      expect(markdown).toContain('## Frustrations');
      expect(markdown).toContain('_None identified_');
    });

    test('PASS: Formats populated state correctly', () => {
      const state = createDefaultSelfDiscoveryState();
      state.frustrations = [
        { description: 'App is slow', source: 'user', severity: 'high' }
      ];
      state.expertise = [
        { area: 'React', depth: 'expert', evidence: '5 years experience' }
      ];
      state.constraints.timeHoursPerWeek = 20;

      const markdown = memoryManager.formatSelfDiscoveryMarkdown(state);

      expect(markdown).toContain('**[high]** App is slow');
      expect(markdown).toContain('**React** (expert)');
      expect(markdown).toContain('20 hours/week');
    });
  });

  describe('formatMarketDiscoveryMarkdown', () => {
    test('PASS: Formats competitors correctly', () => {
      const state = createDefaultMarketDiscoveryState();
      state.competitors = [
        {
          name: 'Competitor A',
          description: 'Big player',
          strengths: ['market share'],
          weaknesses: ['slow'],
          source: 'research.com'
        }
      ];

      const markdown = memoryManager.formatMarketDiscoveryMarkdown(state);

      expect(markdown).toContain('### Competitor A');
      expect(markdown).toContain('Big player');
      expect(markdown).toContain('**Strengths:** market share');
      expect(markdown).toContain('**Weaknesses:** slow');
    });

    test('PASS: Formats gaps with relevance', () => {
      const state = createDefaultMarketDiscoveryState();
      state.gaps = [
        { description: 'No mobile app', evidence: 'analysis', relevance: 'high' }
      ];

      const markdown = memoryManager.formatMarketDiscoveryMarkdown(state);

      expect(markdown).toContain('**[high]** No mobile app');
    });
  });

  describe('formatNarrowingStateMarkdown', () => {
    test('PASS: Shows confidence percentages', () => {
      const state = createDefaultNarrowingState();
      state.productType = { value: 'Digital', confidence: 0.85 };
      state.customerType = { value: 'B2B', confidence: 0.7 };

      const markdown = memoryManager.formatNarrowingStateMarkdown(state);

      expect(markdown).toContain('Digital (85% confidence)');
      expect(markdown).toContain('B2B (70% confidence)');
    });

    test('PASS: Shows "Not determined" for null values', () => {
      const state = createDefaultNarrowingState();

      const markdown = memoryManager.formatNarrowingStateMarkdown(state);

      expect(markdown).toContain('Not determined');
    });
  });

  describe('updateAll', () => {
    test('PASS: Updates all state files', async () => {
      await memoryManager.initializeSession(testSessionId);

      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.frustrations = [{ description: 'Test frustration', source: 'user', severity: 'high' }];

      const marketDiscovery = createDefaultMarketDiscoveryState();
      const narrowingState = createDefaultNarrowingState();

      await memoryManager.updateAll(testSessionId, {
        selfDiscovery,
        marketDiscovery,
        narrowingState,
        candidate: null,
        viability: { total: 80, risks: [] },
      });

      const updatedSD = await memoryManager.read(testSessionId, 'self_discovery');
      expect(updatedSD!.content).toContain('Test frustration');

      const updatedViability = await memoryManager.read(testSessionId, 'viability_assessment');
      expect(updatedViability!.content).toContain('80%');
    });
  });
});
```

---

## 6. Implementation Checklist

- [ ] Create `agents/ideation/` directory (if not exists)
- [ ] Create `agents/ideation/session-manager.ts`
- [ ] Create `agents/ideation/message-store.ts`
- [ ] Create `agents/ideation/memory-manager.ts`
- [ ] Create `agents/ideation/handoff.ts`
- [ ] Create `tests/ideation/session-manager.test.ts`
- [ ] Create `tests/ideation/message-store.test.ts`
- [ ] Create `tests/ideation/memory-manager.test.ts`
- [ ] Run all tests: `npm test -- tests/ideation/session-manager.test.ts tests/ideation/message-store.test.ts tests/ideation/memory-manager.test.ts`
- [ ] Verify all tests pass

---

## 7. Success Criteria

| Test Category | Expected Pass |
|---------------|---------------|
| Session Manager - create | 3 |
| Session Manager - load | 2 |
| Session Manager - update | 5 |
| Session Manager - complete | 2 |
| Session Manager - abandon | 2 |
| Session Manager - getActiveByProfile | 3 |
| Session Manager - incrementHandoff | 2 |
| Message Store - create | 5 |
| Message Store - getById | 2 |
| Message Store - getBySession | 2 |
| Message Store - getLastAssistant | 2 |
| Message Store - update | 2 |
| Message Store - getTotalTokens | 2 |
| Message Store - getMessageCount | 1 |
| Message Store - getRecentUserMessages | 2 |
| Memory Manager - initializeSession | 2 |
| Memory Manager - create | 2 |
| Memory Manager - read | 2 |
| Memory Manager - update | 2 |
| Memory Manager - getAll | 2 |
| Memory Manager - formatters | 6 |
| Memory Manager - updateAll | 1 |
| **Total** | **54** |
