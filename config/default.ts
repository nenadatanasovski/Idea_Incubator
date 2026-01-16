/**
 * Default configuration for Idea Incubator
 */
export const config = {
  // Model settings
  model: "claude-opus-4-5-20251101",
  maxTokens: 4096,

  // Budget (increased from $10 to $15 to accommodate research phase)
  budget: {
    default: 15.0,
    max: 50.0,
  },

  // Evaluator mode: 'v1' (sequential generalist) or 'v2' (parallel specialists)
  evaluatorMode: "v2" as const,

  // Red team mode: 'core' (3 personas) or 'extended' (6 personas)
  redTeamMode: "extended" as "core" | "extended",

  // Debate configuration
  debate: {
    challengesPerCriterion: 3, // Reduced from 5 for faster debates
    roundsPerChallenge: 3, // 3 rounds per topic
    maxRounds: 3, // Cap total rounds
    maxDuration: 300000, // 5 minutes timeout
  },

  // Convergence criteria
  convergence: {
    scoreStability: {
      maxDelta: 0.5,
      consecutiveRounds: 2,
    },
    confidenceThreshold: {
      minimum: 0.7,
      critical: 0.8,
    },
  },

  // Score aggregation weights
  categoryWeights: {
    problem: 0.2,
    solution: 0.2,
    feasibility: 0.15,
    fit: 0.15,
    market: 0.15,
    risk: 0.15,
  },

  // Logging
  logging: {
    level: "info" as "debug" | "info" | "warn" | "error",
    transport: "console" as "console" | "websocket",
  },

  // Paths
  paths: {
    ideas: "./ideas",
    database: "./database/ideas.db",
    templates: "./templates",
    taxonomy: "./taxonomy",
  },

  // Staleness detection
  staleness: {
    evaluationAgeDays: 30,
  },
};

export type Config = typeof config;
export type LogLevel = "debug" | "info" | "warn" | "error";
export type Transport = "console" | "websocket";
export type EvaluatorMode = "v1" | "v2";
export type RedTeamMode = "core" | "extended";
