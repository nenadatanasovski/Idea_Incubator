// agents/sia/claude-md-updater.ts - Propose and apply CLAUDE.md updates

import { v4 as uuid } from 'uuid';
import { readFile, writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import { KnowledgeEntry, ClaudeMdProposal } from '../../types/sia.js';
import { saveProposal, getProposal, updateProposalStatus } from './db.js';
import { getPromotionCandidates, CONFIDENCE_CONFIG } from './confidence-tracker.js';

const CLAUDE_MD_PATH = 'CLAUDE.md';

/**
 * Section mapping based on gotcha file patterns
 */
const SECTION_MAPPING: Record<string, string> = {
  '*.sql': '## Database Conventions',
  'database/': '## Database Conventions',
  'server/routes/': '## API Conventions',
  '*.ts': '## Coding Loops Infrastructure',
  'tests/': '## Common Commands',
  'agents/': '## Agent Types',
  'types/': '## Coding Loops Infrastructure',
};

/**
 * Default section for gotchas that don't match any pattern
 */
const DEFAULT_SECTION = '## Database Conventions';

/**
 * Create a CLAUDE.md update proposal for a knowledge entry
 */
export async function createProposal(
  entry: KnowledgeEntry
): Promise<ClaudeMdProposal> {
  const section = determineSection(entry);
  const content = formatProposalContent(entry);

  const proposal: ClaudeMdProposal = {
    id: uuid(),
    knowledgeEntryId: entry.id,
    proposedSection: section,
    proposedContent: content,
    status: 'pending',
    reviewedAt: null,
    reviewerNotes: null,
    createdAt: new Date().toISOString(),
  };

  await saveProposal(proposal);
  return proposal;
}

/**
 * Determine which CLAUDE.md section a gotcha belongs to
 */
export function determineSection(entry: KnowledgeEntry): string {
  for (const pattern of entry.filePatterns) {
    for (const [key, section] of Object.entries(SECTION_MAPPING)) {
      if (pattern.includes(key) || key.includes(pattern.replace('*', ''))) {
        return section;
      }
    }
  }
  return DEFAULT_SECTION;
}

/**
 * Format the gotcha content for CLAUDE.md
 */
export function formatProposalContent(entry: KnowledgeEntry): string {
  const patterns = entry.filePatterns.join(', ') || 'general';
  const actions = entry.actionTypes.join(', ') || 'all actions';

  return `- **${patterns}** (${actions}): ${entry.content}`;
}

/**
 * Apply an approved proposal to CLAUDE.md
 */
export async function applyProposal(proposalId: string): Promise<string> {
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  if (proposal.status !== 'approved') {
    throw new Error(`Proposal ${proposalId} is not approved`);
  }

  // Read current CLAUDE.md
  const content = await readFile(CLAUDE_MD_PATH, 'utf-8');

  // Find the target section
  const sectionIndex = content.indexOf(proposal.proposedSection);
  if (sectionIndex === -1) {
    throw new Error(`Section ${proposal.proposedSection} not found in CLAUDE.md`);
  }

  // Find the end of the section (next ## or end of file)
  const nextSectionMatch = content.slice(sectionIndex + 1).match(/\n## /);
  const sectionEnd = nextSectionMatch
    ? sectionIndex + 1 + nextSectionMatch.index!
    : content.length;

  // Insert the new content before the section end
  // Find the last non-empty line before the next section
  const sectionContent = content.slice(sectionIndex, sectionEnd);
  const lastContentIndex = sectionContent.lastIndexOf('\n');

  const insertPosition = sectionIndex + lastContentIndex;
  const newContent =
    content.slice(0, insertPosition) +
    '\n' +
    proposal.proposedContent +
    content.slice(insertPosition);

  // Write updated CLAUDE.md
  await writeFile(CLAUDE_MD_PATH, newContent);

  // Commit the change
  try {
    execSync(`git add ${CLAUDE_MD_PATH}`);
    execSync(
      `git commit -m "docs: Add gotcha from SIA\n\nKnowledge entry: ${proposal.knowledgeEntryId}\nProposal: ${proposal.id}"`
    );
  } catch (error) {
    // Git commit may fail if nothing changed or git not available
    console.warn('Git commit failed:', error);
  }

  return newContent;
}

/**
 * Generate proposals for all high-confidence gotchas that haven't been proposed yet
 */
export async function generatePendingProposals(): Promise<ClaudeMdProposal[]> {
  const candidates = await getPromotionCandidates();
  const proposals: ClaudeMdProposal[] = [];

  for (const entry of candidates) {
    // Check if this entry already has a proposal
    // (would need to add a query for this, skip for now)
    const proposal = await createProposal(entry);
    proposals.push(proposal);
  }

  return proposals;
}

/**
 * Check if an entry is eligible for CLAUDE.md promotion
 */
export function isEligibleForPromotion(entry: KnowledgeEntry): boolean {
  return (
    entry.type === 'gotcha' &&
    entry.confidence >= CONFIDENCE_CONFIG.promotionThreshold &&
    entry.occurrences >= 2
  );
}

/**
 * Get a summary of what changes would be made to CLAUDE.md
 */
export function previewProposal(entry: KnowledgeEntry): {
  section: string;
  content: string;
  preview: string;
} {
  const section = determineSection(entry);
  const content = formatProposalContent(entry);

  return {
    section,
    content,
    preview: `Would add to "${section}":\n${content}`,
  };
}

/**
 * Reject a proposal with notes
 */
export async function rejectProposal(
  proposalId: string,
  notes: string
): Promise<void> {
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  await updateProposalStatus(proposalId, 'rejected', notes);
}

/**
 * Get all pending proposals that need review
 */
export async function getPendingReviews(): Promise<ClaudeMdProposal[]> {
  // This would query proposals with status='pending'
  // Already implemented in db.ts via getProposals('pending')
  const { getProposals } = await import('./db.js');
  return getProposals('pending');
}
