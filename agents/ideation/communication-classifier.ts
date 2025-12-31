// =============================================================================
// FILE: agents/ideation/communication-classifier.ts
// =============================================================================

export type CommunicationStyle = 'verbose' | 'terse' | 'analytical' | 'emotional';

export interface StyleClassification {
  primary: CommunicationStyle;
  confidence: number;  // 0.0-1.0
  scores: Record<CommunicationStyle, number>;
  evidence: string[];
}

export interface MessageAnalysis {
  wordCount: number;
  averageSentenceLength: number;
  questionRatio: number;
  exclamationRatio: number;
  technicalTermRatio: number;
  emotionalWordRatio: number;
  dataReferences: number;
}

// Emotional word patterns
const EMOTIONAL_PATTERNS = [
  /\b(love|hate|excited|frustrated|amazing|terrible|wonderful|awful)\b/gi,
  /\b(feel|feeling|felt)\b/gi,
  /!{2,}/g,  // Multiple exclamation marks
  /\b(honestly|personally|truly)\b/gi,
];

// Technical/analytical patterns
const ANALYTICAL_PATTERNS = [
  /\b(data|metrics|analysis|percentage|ratio|statistics)\b/gi,
  /\b(therefore|consequently|because|thus|hence)\b/gi,
  /\b(specifically|precisely|exactly|technically)\b/gi,
  /\d+%|\d+\.\d+/g,  // Numbers and percentages
];

/**
 * Classifies the user's communication style based on message history
 */
export function classifyCommunicationStyle(
  messages: Array<{ role: string; content: string }>
): StyleClassification {
  // Filter to user messages only
  const userMessages = messages.filter(m => m.role === 'user');

  if (userMessages.length === 0) {
    return {
      primary: 'verbose',
      confidence: 0,
      scores: { verbose: 0.25, terse: 0.25, analytical: 0.25, emotional: 0.25 },
      evidence: ['No user messages to analyze'],
    };
  }

  // Analyze all user messages
  const analyses = userMessages.map(m => analyzeMessage(m.content));
  const aggregated = aggregateAnalyses(analyses);

  // Calculate style scores
  const scores = calculateStyleScores(aggregated);

  // Determine primary style
  const primary = Object.entries(scores).reduce((a, b) =>
    scores[a[0] as CommunicationStyle] > scores[b[0] as CommunicationStyle] ? a : b
  )[0] as CommunicationStyle;

  // Calculate confidence (difference between top 2 scores)
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const confidence = sortedScores[0] - sortedScores[1];

  return {
    primary,
    confidence: Math.min(confidence * 2, 1),  // Scale to 0-1
    scores,
    evidence: generateEvidence(aggregated, primary),
  };
}

function analyzeMessage(content: string): MessageAnalysis {
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

  const emotionalMatches = EMOTIONAL_PATTERNS.reduce(
    (count, pattern) => count + (content.match(pattern)?.length || 0), 0
  );

  const analyticalMatches = ANALYTICAL_PATTERNS.reduce(
    (count, pattern) => count + (content.match(pattern)?.length || 0), 0
  );

  return {
    wordCount: words.length,
    averageSentenceLength: words.length / Math.max(sentences.length, 1),
    questionRatio: (content.match(/\?/g)?.length || 0) / Math.max(sentences.length, 1),
    exclamationRatio: (content.match(/!/g)?.length || 0) / Math.max(sentences.length, 1),
    technicalTermRatio: analyticalMatches / Math.max(words.length, 1),
    emotionalWordRatio: emotionalMatches / Math.max(words.length, 1),
    dataReferences: (content.match(/\d+/g)?.length || 0),
  };
}

function aggregateAnalyses(analyses: MessageAnalysis[]): MessageAnalysis {
  const count = analyses.length;
  return {
    wordCount: analyses.reduce((s, a) => s + a.wordCount, 0) / count,
    averageSentenceLength: analyses.reduce((s, a) => s + a.averageSentenceLength, 0) / count,
    questionRatio: analyses.reduce((s, a) => s + a.questionRatio, 0) / count,
    exclamationRatio: analyses.reduce((s, a) => s + a.exclamationRatio, 0) / count,
    technicalTermRatio: analyses.reduce((s, a) => s + a.technicalTermRatio, 0) / count,
    emotionalWordRatio: analyses.reduce((s, a) => s + a.emotionalWordRatio, 0) / count,
    dataReferences: analyses.reduce((s, a) => s + a.dataReferences, 0) / count,
  };
}

function calculateStyleScores(analysis: MessageAnalysis): Record<CommunicationStyle, number> {
  const scores: Record<CommunicationStyle, number> = {
    verbose: 0,
    terse: 0,
    analytical: 0,
    emotional: 0,
  };

  // Verbose: long messages, detailed explanations
  if (analysis.wordCount > 50) scores.verbose += 0.3;
  if (analysis.averageSentenceLength > 15) scores.verbose += 0.2;
  scores.verbose += Math.min(analysis.wordCount / 200, 0.5);

  // Terse: short, direct messages
  if (analysis.wordCount < 20) scores.terse += 0.3;
  if (analysis.averageSentenceLength < 8) scores.terse += 0.2;
  scores.terse += Math.max(0, 0.5 - (analysis.wordCount / 100));

  // Analytical: data-driven, logical
  scores.analytical += analysis.technicalTermRatio * 10;
  scores.analytical += Math.min(analysis.dataReferences / 5, 0.3);
  if (analysis.questionRatio < 0.2) scores.analytical += 0.1;

  // Emotional: feeling-based, expressive
  scores.emotional += analysis.emotionalWordRatio * 15;
  scores.emotional += analysis.exclamationRatio * 2;

  // Normalize scores to sum to 1
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const key of Object.keys(scores) as CommunicationStyle[]) {
      scores[key] /= total;
    }
  } else {
    // Default distribution
    scores.verbose = 0.25;
    scores.terse = 0.25;
    scores.analytical = 0.25;
    scores.emotional = 0.25;
  }

  return scores;
}

function generateEvidence(analysis: MessageAnalysis, style: CommunicationStyle): string[] {
  const evidence: string[] = [];

  switch (style) {
    case 'verbose':
      evidence.push(`Average message length: ${Math.round(analysis.wordCount)} words`);
      evidence.push(`Average sentence length: ${Math.round(analysis.averageSentenceLength)} words`);
      break;
    case 'terse':
      evidence.push(`Short, direct messages averaging ${Math.round(analysis.wordCount)} words`);
      break;
    case 'analytical':
      evidence.push(`Uses data and technical terms frequently`);
      evidence.push(`References numbers/statistics ${Math.round(analysis.dataReferences)} times per message`);
      break;
    case 'emotional':
      evidence.push(`Uses emotional language and exclamations`);
      evidence.push(`Expressive communication style`);
      break;
  }

  return evidence;
}
