/**
 * Evaluation criteria definitions
 * Source of truth: taxonomy/evaluation-criteria.md
 */

// Criterion definition with full metadata
export interface CriterionDefinition {
  id: string;
  name: string;
  category: Category;
  question: string;
  highScoreDescription: string;
  lowScoreDescription: string;
}

// Categories
export type Category = 'problem' | 'solution' | 'feasibility' | 'fit' | 'market' | 'risk';

// All criteria organized by category
export const EVALUATION_CRITERIA: Record<Category, CriterionDefinition[]> = {
  problem: [
    {
      id: 'P1',
      name: 'Problem Clarity',
      category: 'problem',
      question: 'Is the problem well-defined?',
      highScoreDescription: 'Crystal clear problem statement',
      lowScoreDescription: 'Vague or undefined problem'
    },
    {
      id: 'P2',
      name: 'Problem Severity',
      category: 'problem',
      question: 'How painful is the problem?',
      highScoreDescription: 'Unbearable pain point',
      lowScoreDescription: 'Trivial inconvenience'
    },
    {
      id: 'P3',
      name: 'Target User Clarity',
      category: 'problem',
      question: 'Who specifically is affected?',
      highScoreDescription: 'Precise persona identified',
      lowScoreDescription: 'Vague "everyone" audience'
    },
    {
      id: 'P4',
      name: 'Problem Validation',
      category: 'problem',
      question: 'Has it been validated with real users?',
      highScoreDescription: 'Extensive validation with users',
      lowScoreDescription: 'Pure assumption'
    },
    {
      id: 'P5',
      name: 'Problem Uniqueness',
      category: 'problem',
      question: 'Is this a novel problem?',
      highScoreDescription: 'Unaddressed problem',
      lowScoreDescription: 'Saturated with solutions'
    }
  ],
  solution: [
    {
      id: 'S1',
      name: 'Solution Clarity',
      category: 'solution',
      question: 'Is the solution well-articulated?',
      highScoreDescription: 'Detailed specification',
      lowScoreDescription: 'Vague concept'
    },
    {
      id: 'S2',
      name: 'Solution Feasibility',
      category: 'solution',
      question: 'Can it actually be built?',
      highScoreDescription: 'Proven technology exists',
      lowScoreDescription: 'Science fiction'
    },
    {
      id: 'S3',
      name: 'Solution Uniqueness',
      category: 'solution',
      question: 'How differentiated from alternatives?',
      highScoreDescription: 'First of its kind',
      lowScoreDescription: 'Me-too clone'
    },
    {
      id: 'S4',
      name: 'Solution Scalability',
      category: 'solution',
      question: 'Can it grow without proportional cost?',
      highScoreDescription: 'Infinite scale potential',
      lowScoreDescription: 'Linear cost scaling'
    },
    {
      id: 'S5',
      name: 'Solution Defensibility',
      category: 'solution',
      question: 'Can it be protected?',
      highScoreDescription: 'Strong competitive moat',
      lowScoreDescription: 'Easily copied'
    }
  ],
  feasibility: [
    {
      id: 'F1',
      name: 'Technical Complexity',
      category: 'feasibility',
      question: 'How hard to build?',
      highScoreDescription: 'Trivial to implement',
      lowScoreDescription: 'Nearly impossible'
    },
    {
      id: 'F2',
      name: 'Resource Requirements',
      category: 'feasibility',
      question: 'Cost in time/money/people?',
      highScoreDescription: 'Minimal resources needed',
      lowScoreDescription: 'Massive investment'
    },
    {
      id: 'F3',
      name: 'Skill Availability',
      category: 'feasibility',
      question: 'Do I have needed skills?',
      highScoreDescription: 'Expert in all areas',
      lowScoreDescription: 'No relevant skills'
    },
    {
      id: 'F4',
      name: 'Time to Value',
      category: 'feasibility',
      question: 'How long until first results?',
      highScoreDescription: 'Days to first value',
      lowScoreDescription: 'Years to any value'
    },
    {
      id: 'F5',
      name: 'Dependency Risk',
      category: 'feasibility',
      question: 'Reliance on external factors?',
      highScoreDescription: 'Fully independent',
      lowScoreDescription: 'Heavily dependent on others'
    }
  ],
  fit: [
    {
      id: 'FT1',
      name: 'Personal Fit',
      category: 'fit',
      question: 'Fits with personal goals?',
      highScoreDescription: 'Perfect alignment',
      lowScoreDescription: 'Direct conflict'
    },
    {
      id: 'FT2',
      name: 'Passion Alignment',
      category: 'fit',
      question: 'How excited am I?',
      highScoreDescription: 'Obsessively passionate',
      lowScoreDescription: 'Completely indifferent'
    },
    {
      id: 'FT3',
      name: 'Skill Match',
      category: 'fit',
      question: 'Leverages my skills?',
      highScoreDescription: 'Core strength area',
      lowScoreDescription: 'Major weakness'
    },
    {
      id: 'FT4',
      name: 'Network Leverage',
      category: 'fit',
      question: 'Can I use my network?',
      highScoreDescription: 'Strong connections available',
      lowScoreDescription: 'Complete cold start'
    },
    {
      id: 'FT5',
      name: 'Life Stage Fit',
      category: 'fit',
      question: 'Right moment in life?',
      highScoreDescription: 'Perfect timing',
      lowScoreDescription: 'Wrong life phase'
    }
  ],
  market: [
    {
      id: 'M1',
      name: 'Market Size',
      category: 'market',
      question: 'Total addressable market size?',
      highScoreDescription: 'Huge TAM potential',
      lowScoreDescription: 'Tiny niche market'
    },
    {
      id: 'M2',
      name: 'Market Growth',
      category: 'market',
      question: 'Is the market expanding?',
      highScoreDescription: 'Explosive growth trend',
      lowScoreDescription: 'Declining market'
    },
    {
      id: 'M3',
      name: 'Competition Intensity',
      category: 'market',
      question: 'How crowded is the space?',
      highScoreDescription: 'Blue ocean opportunity',
      lowScoreDescription: 'Bloody red ocean'
    },
    {
      id: 'M4',
      name: 'Entry Barriers',
      category: 'market',
      question: 'Barriers to market entry?',
      highScoreDescription: 'Easy to enter',
      lowScoreDescription: 'Fortress market'
    },
    {
      id: 'M5',
      name: 'Timing',
      category: 'market',
      question: 'Is the market ready?',
      highScoreDescription: 'Perfect market timing',
      lowScoreDescription: 'Too early or too late'
    }
  ],
  risk: [
    {
      id: 'R1',
      name: 'Execution Risk',
      category: 'risk',
      question: 'Risk of failing to build?',
      highScoreDescription: 'Low execution risk',
      lowScoreDescription: 'High execution risk'
    },
    {
      id: 'R2',
      name: 'Market Risk',
      category: 'risk',
      question: 'Risk of no market?',
      highScoreDescription: 'Proven market demand',
      lowScoreDescription: 'Unproven market'
    },
    {
      id: 'R3',
      name: 'Technical Risk',
      category: 'risk',
      question: 'Risk of technical failure?',
      highScoreDescription: 'Proven technology',
      lowScoreDescription: 'Bleeding edge tech'
    },
    {
      id: 'R4',
      name: 'Financial Risk',
      category: 'risk',
      question: 'Risk of running out of money?',
      highScoreDescription: 'Self-funded capability',
      lowScoreDescription: 'High burn rate risk'
    },
    {
      id: 'R5',
      name: 'Regulatory Risk',
      category: 'risk',
      question: 'Legal/compliance concerns?',
      highScoreDescription: 'Clear regulatory path',
      lowScoreDescription: 'Legal minefield'
    }
  ]
};

// Flatten all criteria into a single array
export const ALL_CRITERIA: CriterionDefinition[] = Object.values(EVALUATION_CRITERIA).flat();

// Verify we have exactly 30 criteria
if (ALL_CRITERIA.length !== 30) {
  throw new Error(`Expected 30 criteria, got ${ALL_CRITERIA.length}`);
}

// Get criterion by ID
export function getCriterionById(id: string): CriterionDefinition | undefined {
  return ALL_CRITERIA.find(c => c.id === id);
}

// Get criterion by name
export function getCriterionByName(name: string): CriterionDefinition | undefined {
  return ALL_CRITERIA.find(c => c.name === name);
}

// Get all criteria for a category
export function getCriteriaByCategory(category: Category): CriterionDefinition[] {
  return EVALUATION_CRITERIA[category];
}

// All categories
export const CATEGORIES: Category[] = ['problem', 'solution', 'feasibility', 'fit', 'market', 'risk'];

// Lifecycle stages
export const LIFECYCLE_STAGES = [
  'SPARK', 'CLARIFY', 'RESEARCH', 'IDEATE', 'EVALUATE', 'VALIDATE',
  'DESIGN', 'PROTOTYPE', 'TEST', 'REFINE', 'BUILD', 'LAUNCH',
  'GROW', 'MAINTAIN', 'PIVOT', 'PAUSE', 'SUNSET', 'ARCHIVE', 'ABANDONED'
] as const;

export type LifecycleStage = typeof LIFECYCLE_STAGES[number];

// Score interpretation
export interface ScoreInterpretation {
  range: [number, number];
  label: string;
  recommendation: 'PURSUE' | 'REFINE' | 'PAUSE' | 'ABANDON';
  description: string;
}

export const SCORE_INTERPRETATIONS: ScoreInterpretation[] = [
  { range: [8.0, 10.0], label: 'Excellent', recommendation: 'PURSUE', description: 'PURSUE aggressively' },
  { range: [7.0, 7.9], label: 'Strong', recommendation: 'PURSUE', description: 'PURSUE with focus' },
  { range: [6.0, 6.9], label: 'Promising', recommendation: 'REFINE', description: 'REFINE before proceeding' },
  { range: [5.0, 5.9], label: 'Uncertain', recommendation: 'REFINE', description: 'REFINE significantly' },
  { range: [4.0, 4.9], label: 'Weak', recommendation: 'PAUSE', description: 'PAUSE and reconsider' },
  { range: [1.0, 3.9], label: 'Poor', recommendation: 'ABANDON', description: 'ABANDON or pivot' }
];

export function interpretScore(score: number): ScoreInterpretation {
  for (const interp of SCORE_INTERPRETATIONS) {
    if (score >= interp.range[0] && score <= interp.range[1]) {
      return interp;
    }
  }
  return SCORE_INTERPRETATIONS[SCORE_INTERPRETATIONS.length - 1];
}

// Format criterion for prompt inclusion
export function formatCriterionForPrompt(criterion: CriterionDefinition): string {
  return `${criterion.id}. ${criterion.name}
  Question: ${criterion.question}
  10 = ${criterion.highScoreDescription}
  1 = ${criterion.lowScoreDescription}`;
}

// Format all criteria for prompt inclusion
export function formatAllCriteriaForPrompt(): string {
  return CATEGORIES.map(category => {
    const criteria = EVALUATION_CRITERIA[category];
    const formatted = criteria.map(formatCriterionForPrompt).join('\n\n');
    return `## ${category.toUpperCase()}\n\n${formatted}`;
  }).join('\n\n');
}
