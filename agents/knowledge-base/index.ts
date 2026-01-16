// agents/knowledge-base/index.ts - Central Knowledge Base module
// Re-exports SIA knowledge functionality for use by all agents

// Types
export {
  KnowledgeEntry,
  KnowledgeType,
  KnowledgeQuery,
  ExtractedGotcha,
  ExtractedPattern,
  ClaudeMdProposal,
  ProposalStatus,
} from "../../types/sia.js";

// Database operations
export {
  saveKnowledgeEntry,
  updateKnowledgeEntry,
  queryKnowledge,
  getKnowledgeEntry,
  getGotchasForFile,
  getPatternsForFile,
  saveProposal,
  getProposals,
  getProposal,
  updateProposalStatus,
} from "../sia/db.js";

// Writing operations
export {
  writeGotcha,
  writePattern,
  writeDecision,
  writeGotchas,
  writePatterns,
  incrementOccurrences,
} from "../sia/knowledge-writer.js";

// Confidence tracking
export {
  CONFIDENCE_CONFIG,
  calculateInitialConfidence,
  getPromotionCandidates,
  getDemotionCandidates,
  recordPrevention,
  updateConfidence,
  applyDecay,
} from "../sia/confidence-tracker.js";

// Duplicate detection
export {
  findDuplicate,
  calculateSimilarity,
  mergeEntries,
} from "../sia/duplicate-detector.js";

// CLAUDE.md updates
export {
  createProposal,
  applyProposal,
  rejectProposal,
  generatePendingProposals,
  isEligibleForPromotion,
} from "../sia/claude-md-updater.js";
