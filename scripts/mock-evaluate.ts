/**
 * Mock Evaluation Script
 * Simulates a full evaluation with broadcast events for UI testing
 * Usage: npx tsx scripts/mock-evaluate.ts <idea-slug>
 */

import { createBroadcaster } from '../utils/broadcast.js';

const CATEGORIES = ['problem', 'solution', 'feasibility', 'fit', 'market', 'risk'] as const;

const CRITERIA: Record<string, string[]> = {
  problem: ['Problem Clarity', 'Problem Severity', 'Target User Clarity', 'Problem Validation', 'Problem Uniqueness'],
  solution: ['Solution Clarity', 'Solution Feasibility', 'Solution Uniqueness', 'Solution Scalability', 'Solution Defensibility'],
  feasibility: ['Technical Feasibility', 'Resource Requirements', 'Skills Availability', 'Time to Value', 'Dependencies'],
  fit: ['Personal Fit', 'Passion Alignment', 'Skills Match', 'Network Leverage', 'Life Stage Fit'],
  market: ['Market Size', 'Market Growth', 'Competition Intensity', 'Entry Barriers', 'Market Timing'],
  risk: ['Execution Risk', 'Market Risk', 'Technical Risk', 'Financial Risk', 'Regulatory Risk'],
};

const RED_TEAM_PERSONAS = ['The Skeptic', 'The Realist', 'First Principles Thinker'];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomScore(): number {
  return Math.round((4 + Math.random() * 5) * 10) / 10; // 4.0 - 9.0
}

function randomAdjustment(): number {
  const adjustments = [-1, -0.5, 0, 0, 0, 0.5, 1];
  return adjustments[Math.floor(Math.random() * adjustments.length)];
}

async function runMockEvaluation(ideaSlug: string) {
  const runId = `mock-${Date.now()}`;
  const broadcaster = createBroadcaster(ideaSlug, runId);

  console.log(`\n🎭 Starting mock evaluation for: ${ideaSlug}`);
  console.log(`📡 Run ID: ${runId}`);
  console.log(`🌐 Watch at: http://localhost:3000/debate/live/${ideaSlug}\n`);

  // Broadcast start
  await broadcaster.started('Mock evaluation started');
  await sleep(500);

  const scores: Record<string, { initial: number; final: number }> = {};

  for (const category of CATEGORIES) {
    console.log(`\n📂 Category: ${category.toUpperCase()}`);

    const criteria = CRITERIA[category];

    for (const criterion of criteria) {
      const initialScore = randomScore();
      scores[criterion] = { initial: initialScore, final: initialScore };

      console.log(`  📝 ${criterion}: ${initialScore}`);

      // Evaluator speaks
      await broadcaster.evaluatorSpeaking(
        criterion,
        category,
        `This criterion evaluates ${criterion.toLowerCase()}. Based on the idea description, I assess this at ${initialScore}/10. The idea shows ${initialScore > 6 ? 'promising' : 'limited'} evidence for ${criterion.toLowerCase()}.`,
        initialScore
      );
      await sleep(300);

      // Red team challenges (2-3 per criterion)
      const numChallenges = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < numChallenges; i++) {
        const persona = RED_TEAM_PERSONAS[i % RED_TEAM_PERSONAS.length];
        await broadcaster.redteamChallenge(
          criterion,
          category,
          persona,
          `[${persona}] I challenge this assessment. Have you considered that ${criterion.toLowerCase()} may be overestimated? What evidence supports a score of ${initialScore}?`
        );
        await sleep(200);
      }

      // Evaluator defends
      await broadcaster.evaluatorSpeaking(
        criterion,
        category,
        `In response to the challenges, I maintain that the score of ${initialScore} is justified. However, I acknowledge some valid points raised by the red team.`,
        initialScore
      );
      await sleep(200);

      // Arbiter verdict
      const adjustment = randomAdjustment();
      const finalScore = Math.max(1, Math.min(10, initialScore + adjustment));
      scores[criterion].final = finalScore;

      await broadcaster.arbiterVerdict(
        criterion,
        category,
        `After reviewing the debate, I ${adjustment === 0 ? 'uphold the original score' : adjustment > 0 ? 'slightly increase the score' : 'slightly decrease the score'}. The ${adjustment === 0 ? 'evaluator\'s assessment stands' : 'red team raised valid concerns'}.`,
        adjustment
      );
      await sleep(200);

      // Round complete
      await broadcaster.roundComplete(criterion, category, finalScore);
      console.log(`    ✅ Final: ${finalScore} (${adjustment >= 0 ? '+' : ''}${adjustment})`);
      await sleep(100);
    }
  }

  // Calculate overall scores
  const categoryScores: Record<string, number> = {};
  for (const category of CATEGORIES) {
    const criteriaScores = CRITERIA[category].map(c => scores[c].final);
    categoryScores[category] = criteriaScores.reduce((a, b) => a + b, 0) / criteriaScores.length;
  }

  const overallScore = Object.values(categoryScores).reduce((a, b) => a + b, 0) / CATEGORIES.length;

  // Synthesis
  await broadcaster.synthesisStarted();
  await sleep(1000);

  await broadcaster.synthesisComplete(
    overallScore,
    `The idea received an overall score of ${overallScore.toFixed(1)}/10. ${overallScore >= 7 ? 'This is a promising idea worth pursuing.' : overallScore >= 5 ? 'This idea has potential but needs refinement.' : 'This idea faces significant challenges.'}`
  );
  await sleep(500);

  // Complete
  await broadcaster.complete(overallScore);

  console.log(`\n\n========================================`);
  console.log(`📊 MOCK EVALUATION COMPLETE`);
  console.log(`========================================`);
  console.log(`\n📈 Category Scores:`);
  for (const category of CATEGORIES) {
    console.log(`   ${category.padEnd(12)}: ${categoryScores[category].toFixed(1)}/10`);
  }
  console.log(`\n🎯 Overall Score: ${overallScore.toFixed(1)}/10`);
  console.log(`\n✅ Check the UI at: http://localhost:3000/debate/live/${ideaSlug}`);
}

// Main
const ideaSlug = process.argv[2] || 'solar-phone-charger';
runMockEvaluation(ideaSlug).catch(console.error);
