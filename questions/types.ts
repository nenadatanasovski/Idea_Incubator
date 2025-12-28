import { z } from 'zod';

// Question types
export const QuestionTypeSchema = z.enum(['factual', 'analytical', 'reflective']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

// Priority levels
export const QuestionPrioritySchema = z.enum(['critical', 'important', 'nice-to-have']);
export type QuestionPriority = z.infer<typeof QuestionPrioritySchema>;

// Categories (matching evaluation categories)
export const QuestionCategorySchema = z.enum([
  'problem',
  'solution',
  'feasibility',
  'fit',
  'market',
  'risk',
  'business_model'
]);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

// Idea types for filtering
export const IdeaTypeFilterSchema = z.enum([
  'business',
  'creative',
  'technical',
  'personal',
  'research'
]);
export type IdeaTypeFilter = z.infer<typeof IdeaTypeFilterSchema>;

// Lifecycle stages for filtering
export const LifecycleStageFilterSchema = z.enum([
  'SPARK', 'CLARIFY', 'RESEARCH', 'IDEATE', 'EVALUATE', 'VALIDATE',
  'DESIGN', 'PROTOTYPE', 'TEST', 'REFINE', 'BUILD', 'LAUNCH',
  'GROW', 'MAINTAIN', 'PIVOT', 'PAUSE', 'SUNSET', 'ARCHIVE', 'ABANDONED'
]);
export type LifecycleStageFilter = z.infer<typeof LifecycleStageFilterSchema>;

// Single question from YAML
export const QuestionSchema = z.object({
  id: z.string(),
  criterion: z.string(),
  text: z.string(),
  type: QuestionTypeSchema,
  priority: QuestionPrioritySchema,
  idea_types: z.array(IdeaTypeFilterSchema).nullable().optional(),
  lifecycle_stages: z.array(LifecycleStageFilterSchema).nullable().optional(),
  depends_on: z.array(z.string()).nullable().optional(),
  follow_ups: z.array(z.string()).nullable().optional()
});

export type Question = z.infer<typeof QuestionSchema>;

// Question with category (after loading)
export interface QuestionWithCategory extends Question {
  category: QuestionCategory;
}

// YAML file structure
export const QuestionBankFileSchema = z.object({
  category: QuestionCategorySchema,
  questions: z.array(QuestionSchema)
});

export type QuestionBankFile = z.infer<typeof QuestionBankFileSchema>;

// Answer source types
export const AnswerSourceSchema = z.enum(['user', 'ai_extracted', 'ai_inferred']);
export type AnswerSource = z.infer<typeof AnswerSourceSchema>;

// Answer record
export const AnswerSchema = z.object({
  id: z.string(),
  ideaId: z.string(),
  questionId: z.string(),
  answer: z.string(),
  answerSource: AnswerSourceSchema,
  confidence: z.number().min(0).max(1),
  answeredAt: z.string(),
  updatedAt: z.string()
});

export type Answer = z.infer<typeof AnswerSchema>;

// Readiness score structure
export const ReadinessScoreSchema = z.object({
  overall: z.number().min(0).max(1),
  byCategory: z.object({
    problem: z.number().min(0).max(1),
    solution: z.number().min(0).max(1),
    feasibility: z.number().min(0).max(1),
    fit: z.number().min(0).max(1),
    market: z.number().min(0).max(1),
    risk: z.number().min(0).max(1),
    business_model: z.number().min(0).max(1).optional()
  }),
  readyForEvaluation: z.boolean(),
  readinessLevel: z.enum(['SPARK', 'CLARIFY', 'READY', 'CONFIDENT']),
  blockingGaps: z.array(z.string())
});

export type ReadinessScore = z.infer<typeof ReadinessScoreSchema>;

// Criterion coverage
export const CriterionCoverageSchema = z.object({
  criterion: z.string(),
  category: QuestionCategorySchema,
  answered: z.number(),
  total: z.number(),
  coverage: z.number().min(0).max(1)
});

export type CriterionCoverage = z.infer<typeof CriterionCoverageSchema>;

// Development session
export const DevelopmentSessionSchema = z.object({
  id: z.string(),
  ideaId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  questionsAsked: z.number(),
  questionsAnswered: z.number(),
  readinessBefore: z.number().nullable(),
  readinessAfter: z.number().nullable()
});

export type DevelopmentSession = z.infer<typeof DevelopmentSessionSchema>;

// Priority weights for readiness calculation
export const PRIORITY_WEIGHTS: Record<QuestionPriority, number> = {
  critical: 3,
  important: 2,
  'nice-to-have': 1
};

// Category weights for overall readiness
export const CATEGORY_WEIGHTS: Record<QuestionCategory, number> = {
  problem: 0.20,
  solution: 0.20,
  feasibility: 0.15,
  fit: 0.15,
  market: 0.15,
  risk: 0.15,
  business_model: 0.00  // Only applies to business ideas, handled separately
};

// Readiness thresholds
export const READINESS_THRESHOLDS = {
  SPARK: 0.3,
  CLARIFY: 0.6,
  READY: 0.8,
  CONFIDENT: 1.0
};
