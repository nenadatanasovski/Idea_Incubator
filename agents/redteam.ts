/**
 * Red Team Agent
 * Challenges evaluations with adversarial personas
 * v1: 3 personas (Skeptic, Realist, First Principles Purist)
 */
import { client } from '../utils/anthropic-client.js';
import { CostTracker } from '../utils/cost-tracker.js';
import { EvaluationParseError } from '../utils/errors.js';
import { logDebug, logInfo } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { type CriterionDefinition } from './config.js';

// v1 Personas (3 core)
export type CorePersona = 'skeptic' | 'realist' | 'first-principles';

// v2 Extended Personas (3 additional)
export type ExtendedPersona = 'competitor' | 'contrarian' | 'edge-case';

// All personas (v2)
export type RedTeamPersona = CorePersona | ExtendedPersona;

// Core personas (v1 compatibility)
export const CORE_PERSONAS: CorePersona[] = ['skeptic', 'realist', 'first-principles'];

// Extended personas (v2)
export const EXTENDED_PERSONAS: ExtendedPersona[] = ['competitor', 'contrarian', 'edge-case'];

// All personas (v2)
export const ALL_PERSONAS: RedTeamPersona[] = [...CORE_PERSONAS, ...EXTENDED_PERSONAS];

// Default export for backward compatibility (now includes all 6)
export const PERSONAS: RedTeamPersona[] = ALL_PERSONAS;

/**
 * Get personas based on config mode
 * @returns Core personas (3) if mode is 'core', all personas (6) if mode is 'extended'
 */
export function getActivePersonas(): RedTeamPersona[] {
  const config = getConfig();
  return config.redTeamMode === 'extended' ? ALL_PERSONAS : CORE_PERSONAS;
}

export interface PersonaDefinition {
  id: RedTeamPersona;
  name: string;
  role: string;
  systemPrompt: string;
  challengeStyle: string;
}

export const PERSONA_DEFINITIONS: Record<RedTeamPersona, PersonaDefinition> = {
  'skeptic': {
    id: 'skeptic',
    name: 'The Skeptic',
    role: 'Questions assumptions, demands evidence',
    systemPrompt: `You are The Skeptic, a red team challenger.

Your approach:
- Question every assumption, especially ones taken for granted
- Demand concrete evidence for claims
- Challenge optimistic projections
- Ask "How do you know?" and "What's your source?"
- Point out when correlation is mistaken for causation
- Identify confirmation bias

You are not hostile, but rigorously skeptical. You believe extraordinary claims require extraordinary evidence.

When challenging, be specific and cite the exact claim you're questioning.`,
    challengeStyle: 'evidence-demanding'
  },

  'realist': {
    id: 'realist',
    name: 'The Realist',
    role: 'Identifies practical obstacles, execution gaps',
    systemPrompt: `You are The Realist, a red team challenger.

Your approach:
- Focus on practical execution challenges
- Identify resource constraints (time, money, people)
- Point out market timing issues
- Question whether the team can actually build this
- Highlight competitive responses
- Consider regulatory and legal obstacles
- Ask "Who's going to do this work?"

You've seen many ideas fail in execution. You want to surface the hard truths about what it takes to succeed.

When challenging, be specific about the practical obstacle and why it matters.`,
    challengeStyle: 'execution-focused'
  },

  'first-principles': {
    id: 'first-principles',
    name: 'The First Principles Purist',
    role: 'Attacks logical foundations, rewards rigor',
    systemPrompt: `You are The First Principles Purist, a red team challenger.

Your approach:
- Break arguments down to fundamental truths
- Challenge reasoning that relies on analogy alone
- Ask "Why is this true?" repeatedly
- Identify circular reasoning
- Question whether the problem is real or manufactured
- Test if the solution follows logically from the problem
- Reward clear, rigorous thinking

You believe most ideas fail because they're built on shaky foundations. You want to stress-test the logical structure.

When challenging, identify the specific logical flaw or unsupported leap.`,
    challengeStyle: 'logic-testing'
  },

  // v2 Extended Personas

  'competitor': {
    id: 'competitor',
    name: 'The Competitor Analyst',
    role: 'Analyzes competitive threats, market positioning',
    systemPrompt: `You are The Competitor Analyst, a red team challenger.

Your approach:
- Think like existing players would respond
- Identify who would be threatened by this idea
- Predict competitive counter-moves
- Question sustainable differentiation
- Analyze switching costs and lock-in
- Consider "what if Google/Amazon/incumbent does this?"
- Evaluate barriers to entry from both sides

You've studied countless competitive battles. You know that most ideas underestimate competitive response.

When challenging, name specific competitor actions that could neutralize this advantage.`,
    challengeStyle: 'competitive-analysis'
  },

  'contrarian': {
    id: 'contrarian',
    name: 'The Contrarian',
    role: 'Takes opposite viewpoint, challenges consensus',
    systemPrompt: `You are The Contrarian, a red team challenger.

Your approach:
- Deliberately take the opposite stance
- Challenge assumptions everyone agrees on
- Ask "What if the opposite is true?"
- Question industry "best practices"
- Explore scenarios where the idea backfires
- Challenge the timing - too early or too late?
- Consider second-order effects that reverse first-order benefits

You believe the crowd is often wrong. The best ideas are often initially rejected.

When challenging, articulate a coherent opposite thesis and explain why it might be right.`,
    challengeStyle: 'inverse-thinking'
  },

  'edge-case': {
    id: 'edge-case',
    name: 'The Edge-Case Finder',
    role: 'Identifies corner cases, stress scenarios',
    systemPrompt: `You are The Edge-Case Finder, a red team challenger.

Your approach:
- Find scenarios where the solution breaks down
- Test extreme scale (10x, 100x users/load)
- Consider unusual user behaviors
- Identify edge cases in user personas
- Explore failure modes and cascading effects
- Question what happens at boundaries
- Find the "1% of cases that take 99% of effort"

You've seen systems fail in unexpected ways. You hunt for the scenarios that weren't planned for.

When challenging, describe a specific edge case scenario and its consequences.`,
    challengeStyle: 'stress-testing'
  }
};

export interface Challenge {
  id: string;
  persona: RedTeamPersona;
  criterion: CriterionDefinition;
  originalClaim: string;
  originalScore: number;
  challenge: string;
  severity: 'critical' | 'significant' | 'minor';
  requiredEvidence: string[];
}

export interface ChallengeResponse {
  challenges: Challenge[];
  tokensUsed: {
    input: number;
    output: number;
  };
}

/**
 * Generate challenges from a single persona for a criterion
 */
export async function generateChallenges(
  persona: RedTeamPersona,
  criterion: CriterionDefinition,
  claim: string,
  score: number,
  reasoning: string,
  costTracker: CostTracker
): Promise<Challenge[]> {
  const config = getConfig();
  const personaDef = PERSONA_DEFINITIONS[persona];

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: personaDef.systemPrompt,
    messages: [{
      role: 'user',
      content: `Challenge this evaluation:

## Criterion
${criterion.name}: ${criterion.question}

## Evaluator's Claim
Score: ${score}/10
Reasoning: ${reasoning}

## Your Task
Generate 1-3 challenges to this evaluation from your ${personaDef.name} perspective.

For each challenge:
1. Identify the specific weakness in the claim
2. Explain why this matters
3. State what evidence would resolve this
4. Rate severity: critical (score should drop 2+), significant (1-2 points), minor (<1 point)

Respond in JSON:
{
  "challenges": [
    {
      "challenge": "The specific challenge text",
      "severity": "critical|significant|minor",
      "requiredEvidence": ["Evidence needed to resolve this"]
    }
  ]
}`
    }]
  });

  costTracker.track(response.usage, `redteam-${persona}`);
  logDebug(`Generated challenges from ${persona} for ${criterion.name}`);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response from red team');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse red team response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.challenges || []).map((c: any, i: number) => ({
      id: `${persona}-${criterion.id}-${i}`,
      persona,
      criterion,
      originalClaim: claim,
      originalScore: score,
      challenge: c.challenge,
      severity: validateSeverity(c.severity),
      requiredEvidence: c.requiredEvidence || []
    }));
  } catch {
    throw new EvaluationParseError('Invalid JSON in red team response');
  }
}

/**
 * Validate severity value
 */
function validateSeverity(severity: string): 'critical' | 'significant' | 'minor' {
  const valid = ['critical', 'significant', 'minor'];
  return valid.includes(severity) ? severity as 'critical' | 'significant' | 'minor' : 'minor';
}

/**
 * Generate challenges from all active personas in parallel
 * Uses config.redTeamMode to determine which personas to use
 */
export async function generateAllChallenges(
  criterion: CriterionDefinition,
  claim: string,
  score: number,
  reasoning: string,
  costTracker: CostTracker
): Promise<Challenge[]> {
  const activePersonas = getActivePersonas();
  logInfo(`Generating red team challenges for: ${criterion.name} (${activePersonas.length} personas)`);

  // Run all active personas in parallel
  const challengePromises = activePersonas.map(persona =>
    generateChallenges(persona, criterion, claim, score, reasoning, costTracker)
  );

  const results = await Promise.all(challengePromises);
  const allChallenges = results.flat();

  // Sort by severity (critical first)
  const severityOrder: Record<string, number> = { critical: 0, significant: 1, minor: 2 };
  allChallenges.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  logDebug(`Generated ${allChallenges.length} challenges for ${criterion.name}`);
  return allChallenges;
}

/**
 * Evaluator defense against a challenge
 */
export interface Defense {
  challengeId: string;
  defense: string;
  evidenceProvided: string[];
  concedes: boolean;
  adjustedScore?: number;
  adjustmentReason?: string;
}

/**
 * Generate evaluator defense against challenges
 */
export async function generateDefense(
  challenges: Challenge[],
  ideaContent: string,
  costTracker: CostTracker
): Promise<Defense[]> {
  const config = getConfig();

  const challengeList = challenges.map(c =>
    `[${c.id}] ${c.persona.toUpperCase()}: ${c.challenge}\n  Severity: ${c.severity}`
  ).join('\n\n');

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: `You are the Evaluator defending your assessment.

You must respond to each challenge honestly:
- If the challenge is valid, concede the point and adjust your score
- If you can refute it with evidence from the idea, defend your position
- Cite specific evidence from the idea content
- Be intellectually honest - don't defend weak positions`,
    messages: [{
      role: 'user',
      content: `Defend your evaluation against these challenges:

## Original Idea Content
${ideaContent}

## Challenges to Address
${challengeList}

For each challenge, respond in JSON:
{
  "defenses": [
    {
      "challengeId": "the challenge id",
      "defense": "Your defense or concession",
      "evidenceProvided": ["Evidence from the idea"],
      "concedes": true/false,
      "adjustedScore": 1-10 (only if conceding),
      "adjustmentReason": "Why score changed (only if conceding)"
    }
  ]
}`
    }]
  });

  costTracker.track(response.usage, 'evaluator-defense');

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response from evaluator defense');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse defense response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.defenses || [];
  } catch {
    throw new EvaluationParseError('Invalid JSON in defense response');
  }
}

/**
 * Format challenges for display
 */
export function formatChallenges(challenges: Challenge[]): string {
  const lines: string[] = ['# Red Team Challenges\n'];

  const byPersona: Record<string, Challenge[]> = {};
  for (const c of challenges) {
    if (!byPersona[c.persona]) byPersona[c.persona] = [];
    byPersona[c.persona].push(c);
  }

  for (const [persona, personaChallenges] of Object.entries(byPersona)) {
    const def = PERSONA_DEFINITIONS[persona as RedTeamPersona];
    lines.push(`## ${def.name}`);
    lines.push(`*${def.role}*\n`);

    for (const c of personaChallenges) {
      const severityEmoji = c.severity === 'critical' ? '🔴' :
                           c.severity === 'significant' ? '🟡' : '🟢';
      lines.push(`### ${severityEmoji} ${c.criterion.name}`);
      lines.push(`> ${c.challenge}\n`);
      if (c.requiredEvidence.length > 0) {
        lines.push('**Required Evidence:**');
        c.requiredEvidence.forEach(e => lines.push(`- ${e}`));
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
