/**
 * Question Generator for Spec Agent
 *
 * Generates clarifying questions when brief is ambiguous
 * or when architecture decisions need user input.
 */

import { ParsedBrief } from './brief-parser.js';
import { AnalyzedRequirements, Ambiguity } from './prompts/tasks.js';

export type QuestionType = 'BLOCKING' | 'CLARIFYING' | 'CONFIRMING' | 'PREFERENCE';

export interface Question {
  id: string;
  type: QuestionType;
  content: string;
  context: string;
  options?: string[];
  default?: string;
  defaultRationale?: string;
}

export interface QuestionResult {
  questions: Question[];
  blockingCount: number;
  canProceedWithDefaults: boolean;
}

/**
 * Common patterns that indicate ambiguity
 */
const AMBIGUITY_PATTERNS = [
  { pattern: /should|could|might|may/i, reason: 'uncertain language' },
  { pattern: /etc\.?$/i, reason: 'incomplete list' },
  { pattern: /some|various|multiple/i, reason: 'vague quantity' },
  { pattern: /as needed|when necessary|if required/i, reason: 'undefined condition' },
  { pattern: /appropriate|suitable|proper/i, reason: 'subjective criteria' },
  { pattern: /\?(?:\s|$)/m, reason: 'embedded question' },
  { pattern: /tbd|todo|fixme/i, reason: 'placeholder content' }
];

/**
 * Common architecture decision points
 */
const ARCHITECTURE_CHOICES = [
  {
    trigger: /auth|login|security/i,
    question: 'Which authentication approach should be used?',
    options: ['JWT tokens', 'Session-based', 'API keys', 'OAuth 2.0'],
    default: 'JWT tokens',
    defaultRationale: 'JWT is stateless and works well with REST APIs'
  },
  {
    trigger: /cache|performance|speed/i,
    question: 'Should caching be implemented?',
    options: ['In-memory cache', 'Redis', 'No caching', 'HTTP cache headers'],
    default: 'In-memory cache',
    defaultRationale: 'Simple to implement, suitable for single-server deployments'
  },
  {
    trigger: /realtime|live|websocket/i,
    question: 'How should real-time updates be delivered?',
    options: ['WebSocket', 'Server-Sent Events', 'Polling', 'No real-time needed'],
    default: 'Server-Sent Events',
    defaultRationale: 'Simpler than WebSocket for server-to-client updates'
  },
  {
    trigger: /file|upload|storage/i,
    question: 'Where should uploaded files be stored?',
    options: ['Local filesystem', 'S3/cloud storage', 'Database BLOB', 'No file storage'],
    default: 'Local filesystem',
    defaultRationale: 'Simplest for MVP, can migrate to cloud later'
  },
  {
    trigger: /queue|job|background/i,
    question: 'How should background tasks be handled?',
    options: ['In-process queue', 'External queue (Redis/Bull)', 'Cron jobs', 'No background tasks'],
    default: 'In-process queue',
    defaultRationale: 'Simple for MVP, no external dependencies'
  }
];

export interface QuestionGeneratorOptions {
  strictMode?: boolean;  // Generate more questions in strict mode
}

export class QuestionGenerator {
  private questionCounter: number = 0;
  private strictMode: boolean;

  constructor(options: QuestionGeneratorOptions = {}) {
    this.strictMode = options.strictMode ?? false;
  }

  /**
   * Generate questions from brief and requirements analysis
   */
  generate(brief: ParsedBrief, requirements: AnalyzedRequirements): QuestionResult {
    this.questionCounter = 0;
    const questions: Question[] = [];

    // Check for ambiguities in the brief
    const ambiguityQuestions = this.detectAmbiguity(brief);
    questions.push(...ambiguityQuestions);

    // Check for missing critical information
    const missingInfoQuestions = this.checkMissingInformation(brief);
    questions.push(...missingInfoQuestions);

    // Check for architecture choices
    const archQuestions = this.identifyArchitectureChoices(brief, requirements);
    questions.push(...archQuestions);

    // Include questions from requirements analysis
    if (requirements.ambiguities && requirements.ambiguities.length > 0) {
      const reqQuestions = this.convertAmbiguities(requirements.ambiguities);
      questions.push(...reqQuestions);
    }

    // Calculate blocking count
    const blockingCount = questions.filter(q => q.type === 'BLOCKING').length;

    // Can proceed if no blocking questions OR all have defaults
    const canProceedWithDefaults = questions.every(q =>
      q.type !== 'BLOCKING' || q.default !== undefined
    );

    return {
      questions,
      blockingCount,
      canProceedWithDefaults
    };
  }

  /**
   * Generate unique question ID
   */
  private nextQuestionId(): string {
    this.questionCounter++;
    return `Q-${String(this.questionCounter).padStart(3, '0')}`;
  }

  /**
   * Detect ambiguity in brief content
   */
  private detectAmbiguity(brief: ParsedBrief): Question[] {
    const questions: Question[] = [];
    const content = `${brief.problem} ${brief.solution}`;

    for (const { pattern, reason } of AMBIGUITY_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        // Extract the sentence containing the match for context
        let contextSentence = '';

        if (reason === 'embedded question') {
          // For embedded questions, find the clause ending with ?
          const questionMatch = content.match(/[^.!]*\?/);
          contextSentence = questionMatch ? questionMatch[0].trim() : match[0];
        } else {
          // For other patterns, split on sentence boundaries
          const sentences = content.split(/[.!?]+/);
          contextSentence = sentences.find(s =>
            pattern.test(s)
          )?.trim() || match[0];
        }

        if (contextSentence && !this.strictMode) {
          // In non-strict mode, only flag critical ambiguities
          if (reason === 'placeholder content' || reason === 'embedded question') {
            questions.push({
              id: this.nextQuestionId(),
              type: 'CLARIFYING',
              content: `Please clarify: "${contextSentence}"`,
              context: `Found ${reason} that may affect implementation`,
              default: 'Proceed with best judgment',
              defaultRationale: 'Common interpretation will be applied'
            });
          }
        } else if (this.strictMode) {
          questions.push({
            id: this.nextQuestionId(),
            type: 'CLARIFYING',
            content: `Please clarify: "${contextSentence}"`,
            context: `Found ${reason} that may affect implementation`,
            default: 'Proceed with best judgment',
            defaultRationale: 'Common interpretation will be applied'
          });
        }
      }
    }

    return questions;
  }

  /**
   * Check for missing critical information
   */
  private checkMissingInformation(brief: ParsedBrief): Question[] {
    const questions: Question[] = [];

    // Check for missing success criteria
    if (!brief.successCriteria || brief.successCriteria.length === 0) {
      questions.push({
        id: this.nextQuestionId(),
        type: 'CLARIFYING',
        content: 'What are the success criteria for this feature?',
        context: 'No success criteria defined in brief',
        default: 'Feature works as described without errors',
        defaultRationale: 'Basic functionality is the minimum success criteria'
      });
    }

    // Check for empty MVP scope
    if (!brief.mvpScope.inScope || brief.mvpScope.inScope.length === 0) {
      questions.push({
        id: this.nextQuestionId(),
        type: 'BLOCKING',
        content: 'What should be included in the MVP scope?',
        context: 'MVP scope not defined - cannot determine what to build',
        default: 'Implement core functionality only',
        defaultRationale: 'Without scope, only essential features will be built'
      });
    }

    // Check for missing database schema hints
    if (brief.solution.toLowerCase().includes('store') ||
        brief.solution.toLowerCase().includes('save') ||
        brief.solution.toLowerCase().includes('database')) {
      if (!brief.databaseSchema) {
        questions.push({
          id: this.nextQuestionId(),
          type: 'CONFIRMING',
          content: 'Should a new database table be created for this feature?',
          context: 'Solution mentions data storage but no schema provided',
          options: ['Yes, create new table', 'No, use existing tables', 'Needs discussion'],
          default: 'Yes, create new table',
          defaultRationale: 'New features typically need their own storage'
        });
      }
    }

    // Check for vague problem statement
    if (brief.problem.split(' ').length < 10) {
      questions.push({
        id: this.nextQuestionId(),
        type: 'CLARIFYING',
        content: 'Can you elaborate on the problem this feature solves?',
        context: 'Problem statement is very brief',
        default: 'Proceed with stated problem',
        defaultRationale: 'Will implement based on available information'
      });
    }

    return questions;
  }

  /**
   * Identify architecture choices that need user input
   */
  private identifyArchitectureChoices(
    brief: ParsedBrief,
    _requirements: AnalyzedRequirements
  ): Question[] {
    const questions: Question[] = [];
    const fullContent = `${brief.problem} ${brief.solution} ${brief.architecture || ''}`;

    for (const choice of ARCHITECTURE_CHOICES) {
      if (choice.trigger.test(fullContent)) {
        // Check if architecture already specifies this
        if (brief.architecture && choice.options.some(opt =>
          brief.architecture?.toLowerCase().includes(opt.toLowerCase())
        )) {
          continue; // Already specified
        }

        questions.push({
          id: this.nextQuestionId(),
          type: 'PREFERENCE',
          content: choice.question,
          context: `Architecture decision needed for: ${choice.trigger.source}`,
          options: choice.options,
          default: choice.default,
          defaultRationale: choice.defaultRationale
        });
      }
    }

    return questions;
  }

  /**
   * Convert analyzed ambiguities to questions
   */
  private convertAmbiguities(ambiguities: Ambiguity[]): Question[] {
    return ambiguities.map(amb => ({
      id: this.nextQuestionId(),
      type: 'CLARIFYING' as QuestionType,
      content: amb.question,
      context: `Area: ${amb.area}`,
      default: 'Proceed with best judgment',
      defaultRationale: 'Will use common patterns for this area'
    }));
  }

  /**
   * Apply default answers to all questions
   */
  applyDefaults(result: QuestionResult): QuestionResult {
    const answeredQuestions = result.questions.map(q => ({
      ...q,
      answered: true,
      answer: q.default
    }));

    return {
      ...result,
      questions: answeredQuestions,
      canProceedWithDefaults: true
    };
  }

  /**
   * Check if all blocking questions are answered
   */
  canProceed(result: QuestionResult, answers: Map<string, string>): boolean {
    const blockingQuestions = result.questions.filter(q => q.type === 'BLOCKING');

    for (const q of blockingQuestions) {
      if (!answers.has(q.id) && !q.default) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get only blocking questions
   */
  getBlockingQuestions(result: QuestionResult): Question[] {
    return result.questions.filter(q => q.type === 'BLOCKING');
  }

  /**
   * Get questions by type
   */
  getQuestionsByType(result: QuestionResult, type: QuestionType): Question[] {
    return result.questions.filter(q => q.type === type);
  }
}

/**
 * Create a default question generator instance
 */
export function createQuestionGenerator(options?: QuestionGeneratorOptions): QuestionGenerator {
  return new QuestionGenerator(options);
}
