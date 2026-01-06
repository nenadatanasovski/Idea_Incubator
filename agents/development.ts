import { client } from '../utils/anthropic-client.js';
import { CostTracker } from '../utils/cost-tracker.js';
// logDebug import removed - not currently used
import { getConfig } from '../config/index.js';
import { EvaluationParseError } from '../utils/errors.js';

const DEVELOPMENT_SYSTEM_PROMPT = `You are a Development Agent for idea incubation.

Your job is to ask probing questions that help flesh out raw ideas. You should:

1. Identify gaps in the idea description
2. Ask about target users, problems, and solutions
3. Probe assumptions
4. Suggest areas that need more research

Ask 3-5 focused questions at a time. Don't overwhelm the user.

After the user answers, record insights and identify next gaps.

Prioritize questions in this order:
1. CRITICAL - Must know before proceeding (target user, core problem)
2. IMPORTANT - Significant impact on viability (market size, competition)
3. NICE-TO-HAVE - Helpful for refinement (features, pricing)

Always respond with valid JSON.`;

export interface DevelopmentQuestion {
  category: 'user' | 'problem' | 'solution' | 'market' | 'execution';
  question: string;
  priority: 'critical' | 'important' | 'nice-to-have';
}

export interface DevelopmentResult {
  questions: DevelopmentQuestion[];
  gaps: string[];
  suggestions: string[];
}

export interface DevelopmentSession {
  ideaSlug: string;
  questions: DevelopmentQuestion[];
  answers: Array<{ question: string; answer: string; timestamp: string }>;
  insights: string[];
}

/**
 * Analyze idea content and identify gaps
 */
export async function analyzeIdeaGaps(
  ideaContent: string,
  costTracker: CostTracker
): Promise<DevelopmentResult> {
  const config = getConfig();

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: DEVELOPMENT_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyze this idea and identify gaps that need clarification:

${ideaContent}

Respond in JSON:
{
  "questions": [
    {"category": "user|problem|solution|market|execution", "question": "...", "priority": "critical|important|nice-to-have"}
  ],
  "gaps": ["List of missing information"],
  "suggestions": ["Suggestions for strengthening the idea"]
}`
    }]
  });

  costTracker.track(response.usage, 'development-analysis');

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response type from development agent');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse development response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError('Invalid JSON in development response');
  }
}

/**
 * Generate follow-up questions based on previous Q&A
 */
export async function generateFollowUpQuestions(
  ideaContent: string,
  previousQA: Array<{ question: string; answer: string }>,
  costTracker: CostTracker
): Promise<DevelopmentQuestion[]> {
  const config = getConfig();

  const qaHistory = previousQA
    .map(qa => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 512,
    system: DEVELOPMENT_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Idea:
${ideaContent}

Previous Q&A:
${qaHistory}

Based on the answers so far, what are the next 3 most important questions to ask?

Respond in JSON:
{
  "questions": [
    {"category": "...", "question": "...", "priority": "..."}
  ]
}`
    }]
  });

  costTracker.track(response.usage, 'development-followup');

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response type');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse follow-up response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.questions;
  } catch {
    throw new EvaluationParseError('Invalid JSON in follow-up response');
  }
}

/**
 * Summarize insights from development session
 */
export async function summarizeInsights(
  ideaContent: string,
  qaHistory: Array<{ question: string; answer: string }>,
  costTracker: CostTracker
): Promise<{
  keyInsights: string[];
  updatedSummary: string;
  recommendedNextSteps: string[];
  readinessScore: number;
}> {
  const config = getConfig();

  const qaText = qaHistory
    .map(qa => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: DEVELOPMENT_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Summarize the insights from this development session:

Original Idea:
${ideaContent}

Q&A Session:
${qaText}

Respond in JSON:
{
  "keyInsights": ["Key insight 1", "Key insight 2"],
  "updatedSummary": "Updated one-paragraph summary of the idea",
  "recommendedNextSteps": ["Next step 1", "Next step 2"],
  "readinessScore": 1-10 // How ready is this idea for evaluation?
}`
    }]
  });

  costTracker.track(response.usage, 'development-summary');

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response type');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse summary response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError('Invalid JSON in summary response');
  }
}

/**
 * Get question bank by category
 */
export function getQuestionBank(): Record<string, string[]> {
  return {
    user: [
      'Who specifically experiences this problem?',
      'How do they currently solve it?',
      'What would make them switch to your solution?',
      'How much would they pay?',
      'Where do they congregate (for marketing)?',
      'How often do they experience this problem?',
      'What is their technical sophistication?'
    ],
    problem: [
      'How often does this problem occur?',
      'What\'s the cost of the problem (time/money/frustration)?',
      'Is this a must-have or nice-to-have solution?',
      'Who else is trying to solve this?',
      'Why hasn\'t it been solved already?',
      'What happens if this problem isn\'t solved?',
      'Is this problem getting worse or better over time?'
    ],
    solution: [
      'What\'s the minimum viable version?',
      'What\'s technically hardest about this?',
      'What dependencies does this have?',
      'How will users discover this?',
      'What\'s the "aha moment" for users?',
      'What makes this different from alternatives?',
      'How long until a working prototype?'
    ],
    market: [
      'How big is the target market?',
      'Is the market growing or shrinking?',
      'Who are the main competitors?',
      'What\'s your unfair advantage?',
      'How will you reach customers?',
      'What would prevent market adoption?',
      'Are there regulatory barriers?'
    ],
    execution: [
      'What skills do you need to build this?',
      'What\'s the first thing you need to do?',
      'How long until you can test with real users?',
      'What\'s your budget for this?',
      'Who could help you with this?',
      'What are the biggest risks?',
      'What would make you abandon this idea?'
    ]
  };
}
