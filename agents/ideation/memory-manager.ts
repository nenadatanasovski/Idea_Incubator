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
 * Manages memory files for session context preservation across handoffs.
 * Each file type has a specific format and purpose.
 */

export interface MemoryState {
  selfDiscovery: SelfDiscoveryState;
  marketDiscovery: MarketDiscoveryState;
  narrowingState: NarrowingState;
  candidate: IdeaCandidate | null;
  viability: { total: number; risks: ViabilityRiskSummary[] };
}

export interface ViabilityRiskSummary {
  type: string;
  description: string;
  severity: string;
}

/**
 * Helper to convert db result to objects
 */
function resultsToObjects(result: { columns: string[]; values: unknown[][] }): Record<string, unknown>[] {
  const columns = result.columns;
  return result.values.map(values => {
    return columns.reduce((obj, col, i) => {
      obj[col] = values[i];
      return obj;
    }, {} as Record<string, unknown>);
  });
}

function rowToObject(result: { columns: string[]; values: unknown[][] }): Record<string, unknown> {
  if (result.values.length === 0) {
    return {};
  }
  return resultsToObjects(result)[0];
}

export class MemoryManager {
  /**
   * Generate markdown content for a memory file type.
   */
  private generateContent(fileType: MemoryFileType, state: MemoryState): string {
    switch (fileType) {
      case 'self_discovery':
        return this.generateSelfDiscoveryMarkdown(state.selfDiscovery);
      case 'market_discovery':
        return this.generateMarketDiscoveryMarkdown(state.marketDiscovery);
      case 'narrowing_state':
        return this.generateNarrowingMarkdown(state.narrowingState);
      case 'idea_candidate':
        return this.generateCandidateMarkdown(state.candidate);
      case 'viability_assessment':
        return this.generateViabilityMarkdown(state.viability);
      case 'conversation_summary':
        return '# Conversation Summary\n\nNo summary generated yet.';
      case 'handoff_notes':
        return '# Handoff Notes\n\nSeamless transition in progress.';
      default:
        return `# ${fileType}\n\nNo content.`;
    }
  }

  /**
   * Generate self-discovery markdown.
   */
  private generateSelfDiscoveryMarkdown(state: SelfDiscoveryState): string {
    if (!state) return '# Self-Discovery\n\nNo data yet.';

    const sections: string[] = ['# Self-Discovery\n'];

    // Impact Vision
    if (state.impactVision?.level) {
      sections.push(`## Impact Vision`);
      sections.push(`- Level: ${state.impactVision.level}`);
      if (state.impactVision.description) {
        sections.push(`- Description: ${state.impactVision.description}`);
      }
      const confidence = state.impactVision.confidence ?? 0;
      sections.push(`- Confidence: ${Math.round(confidence * 100)}%\n`);
    }

    // Frustrations
    if (state.frustrations && Array.isArray(state.frustrations) && state.frustrations.length > 0) {
      sections.push(`## Frustrations`);
      state.frustrations.forEach((f, i) => {
        const severity = f.severity ? f.severity.toUpperCase() : 'UNKNOWN';
        sections.push(`${i + 1}. **${severity}**: ${f.description || 'No description'}`);
        if (f.source) sections.push(`   - Source: ${f.source}`);
      });
      sections.push('');
    }

    // Expertise
    if (state.expertise && Array.isArray(state.expertise) && state.expertise.length > 0) {
      sections.push(`## Expertise Areas`);
      state.expertise.forEach(e => {
        sections.push(`- **${e.area || 'Unknown'}** (${e.depth || 'unknown'}): ${e.evidence || ''}`);
      });
      sections.push('');
    }

    // Interests
    if (state.interests && Array.isArray(state.interests) && state.interests.length > 0) {
      sections.push(`## Interests`);
      state.interests.forEach(i => {
        const genuineMarker = i.genuine ? '✓' : '?';
        sections.push(`- [${genuineMarker}] ${i.topic || 'Unknown'}: ${i.evidence || ''}`);
      });
      sections.push('');
    }

    // Skills
    if (state.skills?.identified && Array.isArray(state.skills.identified) && state.skills.identified.length > 0) {
      sections.push(`## Skills`);
      sections.push(`### Identified`);
      state.skills.identified.forEach(s => {
        sections.push(`- ${s.skill || 'Unknown'} (${s.level || 'unknown'}) - via ${s.testedVia || 'unknown'}`);
      });
      if (state.skills.strengths && Array.isArray(state.skills.strengths) && state.skills.strengths.length > 0) {
        sections.push(`### Strengths`);
        state.skills.strengths.forEach(s => sections.push(`- ${s}`));
      }
      if (state.skills.gaps && Array.isArray(state.skills.gaps) && state.skills.gaps.length > 0) {
        sections.push(`### Gaps`);
        state.skills.gaps.forEach(g => sections.push(`- ${g}`));
      }
      sections.push('');
    }

    // Constraints
    if (state.constraints) {
      sections.push(`## Constraints`);
      const loc = state.constraints.location;
      sections.push(`- Location: ${loc?.fixed ? 'Fixed' : 'Flexible'} - ${loc?.target || 'Not specified'}`);
      sections.push(`- Time: ${state.constraints.timeHoursPerWeek || 'Not specified'} hours/week`);
      sections.push(`- Capital: ${state.constraints.capital || 'Not specified'}`);
      sections.push(`- Risk Tolerance: ${state.constraints.riskTolerance || 'Not specified'}`);
    }

    return sections.join('\n');
  }

  /**
   * Generate market discovery markdown.
   */
  private generateMarketDiscoveryMarkdown(state: MarketDiscoveryState): string {
    if (!state) return '# Market Discovery\n\nNo data yet.';

    const sections: string[] = ['# Market Discovery\n'];

    // Competitors
    if (state.competitors && Array.isArray(state.competitors) && state.competitors.length > 0) {
      sections.push(`## Competitors`);
      state.competitors.forEach((c, i) => {
        sections.push(`### ${i + 1}. ${c.name || 'Unknown'}`);
        sections.push(`${c.description || ''}`);
        sections.push(`- Strengths: ${Array.isArray(c.strengths) ? c.strengths.join(', ') : 'None listed'}`);
        sections.push(`- Weaknesses: ${Array.isArray(c.weaknesses) ? c.weaknesses.join(', ') : 'None listed'}`);
        if (c.source) sections.push(`- Source: ${c.source}\n`);
      });
    }

    // Gaps
    if (state.gaps && Array.isArray(state.gaps) && state.gaps.length > 0) {
      sections.push(`## Market Gaps`);
      state.gaps.forEach((g, i) => {
        const relevance = g.relevance ? g.relevance.toUpperCase() : 'UNKNOWN';
        sections.push(`${i + 1}. **[${relevance}]** ${g.description || ''}`);
        if (g.evidence) sections.push(`   - Evidence: ${g.evidence}`);
      });
      sections.push('');
    }

    // Timing Signals
    if (state.timingSignals && Array.isArray(state.timingSignals) && state.timingSignals.length > 0) {
      sections.push(`## Timing Signals`);
      state.timingSignals.forEach(t => {
        sections.push(`- ${t.signal || 'Unknown signal'}`);
        if (t.implication) sections.push(`  - Implication: ${t.implication}`);
        if (t.source) sections.push(`  - Source: ${t.source}`);
      });
      sections.push('');
    }

    // Failed Attempts
    if (state.failedAttempts && state.failedAttempts.length > 0) {
      sections.push(`## Failed Attempts (Lessons)`);
      state.failedAttempts.forEach((f, i) => {
        sections.push(`${i + 1}. **${f.what || 'Unknown'}**`);
        if (f.why) sections.push(`   - Why it failed: ${f.why}`);
        if (f.lesson) sections.push(`   - Lesson: ${f.lesson}`);
        if (f.source) sections.push(`   - Source: ${f.source}`);
      });
      sections.push('');
    }

    // Location Context
    if (state.locationContext?.city) {
      sections.push(`## Location Context: ${state.locationContext.city}`);
      if (state.locationContext.jobMarketTrends) {
        sections.push(`- Job Market: ${state.locationContext.jobMarketTrends}`);
      }
      if (state.locationContext.localOpportunities && state.locationContext.localOpportunities.length > 0) {
        sections.push(`- Local Opportunities:`);
        state.locationContext.localOpportunities.forEach(o => sections.push(`  - ${o}`));
      }
      if (state.locationContext.marketPresence) {
        sections.push(`- Market Presence: ${state.locationContext.marketPresence}`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Generate narrowing state markdown.
   */
  private generateNarrowingMarkdown(state: NarrowingState): string {
    if (!state) return '# Narrowing State\n\nNo data yet.';

    const sections: string[] = ['# Narrowing State\n'];

    sections.push(`## Dimensions`);
    sections.push(`| Dimension | Value | Confidence |`);
    sections.push(`|-----------|-------|------------|`);
    const pt = state.productType || { value: null, confidence: 0 };
    const ct = state.customerType || { value: null, confidence: 0 };
    const geo = state.geography || { value: null, confidence: 0 };
    const sc = state.scale || { value: null, confidence: 0 };
    const td = state.technicalDepth || { value: null, confidence: 0 };
    sections.push(`| Product Type | ${pt.value || '-'} | ${Math.round((pt.confidence ?? 0) * 100)}% |`);
    sections.push(`| Customer Type | ${ct.value || '-'} | ${Math.round((ct.confidence ?? 0) * 100)}% |`);
    sections.push(`| Geography | ${geo.value || '-'} | ${Math.round((geo.confidence ?? 0) * 100)}% |`);
    sections.push(`| Scale | ${sc.value || '-'} | ${Math.round((sc.confidence ?? 0) * 100)}% |`);
    sections.push(`| Technical Depth | ${td.value || '-'} | ${Math.round((td.confidence ?? 0) * 100)}% |`);
    sections.push('');

    // Hypotheses
    if (state.hypotheses && state.hypotheses.length > 0) {
      sections.push(`## Working Hypotheses`);
      state.hypotheses.forEach((h, i) => {
        sections.push(`### Hypothesis ${i + 1}`);
        sections.push(`${h.description || ''}`);
        if (h.supporting && h.supporting.length > 0) {
          sections.push(`**Supporting:**`);
          h.supporting.forEach(s => sections.push(`- ${s}`));
        }
        if (h.contradicting && h.contradicting.length > 0) {
          sections.push(`**Contradicting:**`);
          h.contradicting.forEach(c => sections.push(`- ${c}`));
        }
        sections.push('');
      });
    }

    // Questions Needed
    if (state.questionsNeeded && state.questionsNeeded.length > 0) {
      sections.push(`## Questions to Ask`);
      state.questionsNeeded.forEach((q, i) => {
        sections.push(`${i + 1}. ${q.question || 'Unknown'}`);
        if (q.purpose) sections.push(`   - Purpose: ${q.purpose}`);
      });
    }

    return sections.join('\n');
  }

  /**
   * Generate candidate markdown.
   */
  private generateCandidateMarkdown(candidate: IdeaCandidate | null): string {
    if (!candidate) {
      return '# Idea Candidate\n\nNo candidate formed yet.';
    }

    return `# Idea Candidate

## ${candidate.title}

${candidate.summary || 'No summary yet.'}

**Status:** ${candidate.status}
**Confidence:** ${candidate.confidence}%
**Viability:** ${candidate.viability}%
**User Suggested:** ${candidate.userSuggested ? 'Yes' : 'No'}
**Version:** ${candidate.version}
`;
  }

  /**
   * Generate viability markdown.
   */
  private generateViabilityMarkdown(viability: { total: number; risks: ViabilityRiskSummary[] }): string {
    if (!viability) return '# Viability Assessment\n\nNo data yet.';

    const sections: string[] = [
      '# Viability Assessment\n',
      `**Overall Viability:** ${viability.total ?? 100}%\n`,
    ];

    if (viability.risks && viability.risks.length > 0) {
      sections.push('## Identified Risks\n');
      viability.risks.forEach((r, i) => {
        const severity = r.severity ? r.severity.toUpperCase() : 'UNKNOWN';
        sections.push(`${i + 1}. **[${severity}]** ${r.type || 'Unknown risk'}`);
        if (r.description) sections.push(`   ${r.description}\n`);
      });
    } else {
      sections.push('No significant risks identified yet.');
    }

    return sections.join('\n');
  }

  /**
   * Update or create a memory file.
   */
  async upsert(sessionId: string, fileType: MemoryFileType, content: string): Promise<MemoryFile> {
    const db = await getDb();
    const now = new Date().toISOString();

    // Check if file exists
    const existing = db.exec(`
      SELECT id, version FROM ideation_memory_files
      WHERE session_id = ? AND file_type = ?
    `, [sessionId, fileType]);

    if (existing.length > 0 && existing[0].values.length > 0) {
      // Update existing
      const existingId = existing[0].values[0][0] as string;
      const currentVersion = existing[0].values[0][1] as number;

      db.run(`
        UPDATE ideation_memory_files
        SET content = ?, version = ?, updated_at = ?
        WHERE id = ?
      `, [content, currentVersion + 1, now, existingId]);

      await saveDb();
      return this.get(existingId) as Promise<MemoryFile>;
    } else {
      // Create new
      const id = uuidv4();

      db.run(`
        INSERT INTO ideation_memory_files (
          id, session_id, file_type, content, version, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `, [id, sessionId, fileType, content, now, now]);

      await saveDb();
      return this.get(id) as Promise<MemoryFile>;
    }
  }

  /**
   * Get a memory file by ID.
   */
  async get(fileId: string): Promise<MemoryFile | null> {
    const db = await getDb();
    const results = db.exec(`
      SELECT * FROM ideation_memory_files WHERE id = ?
    `, [fileId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const row = rowToObject(results[0]) as MemoryFileRow;
    return mapMemoryRowToMemory(row);
  }

  /**
   * Get a specific memory file type for a session.
   */
  async getByType(sessionId: string, fileType: MemoryFileType): Promise<MemoryFile | null> {
    const db = await getDb();
    const results = db.exec(`
      SELECT * FROM ideation_memory_files
      WHERE session_id = ? AND file_type = ?
    `, [sessionId, fileType]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const row = rowToObject(results[0]) as MemoryFileRow;
    return mapMemoryRowToMemory(row);
  }

  /**
   * Get all memory files for a session.
   */
  async getAll(sessionId: string): Promise<MemoryFile[]> {
    const db = await getDb();
    const results = db.exec(`
      SELECT * FROM ideation_memory_files
      WHERE session_id = ?
      ORDER BY file_type
    `, [sessionId]);

    if (results.length === 0) return [];

    return resultsToObjects(results[0]).map(row =>
      mapMemoryRowToMemory(row as MemoryFileRow)
    );
  }

  /**
   * Update all memory files from current state.
   */
  async updateAll(sessionId: string, state: MemoryState): Promise<void> {
    const fileTypes: MemoryFileType[] = [
      'self_discovery',
      'market_discovery',
      'narrowing_state',
      'idea_candidate',
      'viability_assessment',
    ];

    for (const fileType of fileTypes) {
      const content = this.generateContent(fileType, state);
      await this.upsert(sessionId, fileType, content);
    }

    // Also store JSON state in conversation_summary for reliable loading
    const jsonState = {
      selfDiscovery: state.selfDiscovery,
      marketDiscovery: state.marketDiscovery,
      narrowingState: state.narrowingState,
      viability: state.viability,
    };
    const jsonContent = `<!-- STATE_JSON\n${JSON.stringify(jsonState)}\nSTATE_JSON -->\n\n# State Summary\n\nThis file contains structured state data.`;
    await this.upsert(sessionId, 'conversation_summary', jsonContent);
  }

  /**
   * Load current state from memory files.
   */
  async loadState(sessionId: string): Promise<MemoryState> {
    // Try to load JSON state from conversation_summary
    const summaryFile = await this.getByType(sessionId, 'conversation_summary');

    if (summaryFile?.content) {
      const jsonMatch = summaryFile.content.match(/<!-- STATE_JSON\n([\s\S]*?)\nSTATE_JSON -->/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          return {
            selfDiscovery: parsed.selfDiscovery || createDefaultSelfDiscoveryState(),
            marketDiscovery: parsed.marketDiscovery || createDefaultMarketDiscoveryState(),
            narrowingState: parsed.narrowingState || createDefaultNarrowingState(),
            candidate: null, // Candidate is loaded separately via candidateManager
            viability: parsed.viability || { total: 100, risks: [] },
          };
        } catch (e) {
          console.error('Failed to parse state JSON:', e);
        }
      }
    }

    // Fallback to default state if no JSON found
    return {
      selfDiscovery: createDefaultSelfDiscoveryState(),
      marketDiscovery: createDefaultMarketDiscoveryState(),
      narrowingState: createDefaultNarrowingState(),
      candidate: null,
      viability: { total: 100, risks: [] },
    };
  }

  /**
   * Create handoff summary.
   */
  async createHandoffSummary(sessionId: string, conversationSummary: string): Promise<void> {
    const now = new Date().toISOString();

    const handoffContent = `# Handoff Notes

## Summary
${conversationSummary}

## Handoff Time
${now}

## Instructions
Continue the conversation naturally. The user is unaware of the handoff.
Reference the memory files above for context.
`;

    await this.upsert(sessionId, 'handoff_notes', handoffContent);
    await this.upsert(sessionId, 'conversation_summary', `# Conversation Summary\n\n${conversationSummary}`);
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();
