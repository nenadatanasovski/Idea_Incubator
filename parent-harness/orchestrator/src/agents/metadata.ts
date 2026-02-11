/**
 * Agent Metadata - Detailed information about each agent type
 *
 * Includes role descriptions, tools, telegram config, and capabilities.
 */

export interface AgentMetadata {
  id: string;
  name: string;
  type: string;
  emoji: string;
  description: string;
  role: string;
  responsibilities: string[];
  tools: string[];
  outputFormat?: string;
  triggerConditions?: string[];
  telegram: {
    channel: string;
    botEnvVar: string;
    webhookPath?: string;
  };
  defaultModel: string;
  recommendedModels: string[];
}

export const AGENT_METADATA: Record<string, AgentMetadata> = {
  build_agent: {
    id: "build_agent",
    name: "Build Agent",
    type: "build",
    emoji: "🔨",
    description: "Primary code implementer - writes features and fixes bugs",
    role: "IMPLEMENT features and FIX bugs. Primary code-writing agent.",
    responsibilities: [
      "Read and understand task requirements",
      "Explore relevant code and patterns",
      "Write/edit code to implement features or fixes",
      "Run tests and typecheck",
      "Create descriptive git commits",
    ],
    tools: ["Read", "Write", "Edit", "Bash"],
    outputFormat: "Verbose tool logs with timestamps",
    telegram: {
      channel: "@vibe-build",
      botEnvVar: "TELEGRAM_BOT_BUILD",
      webhookPath: "/webhook/build",
    },
    defaultModel: "opus",
    recommendedModels: ["opus", "sonnet"],
  },

  qa_agent: {
    id: "qa_agent",
    name: "QA Agent",
    type: "qa",
    emoji: "✅",
    description: "Validates completed work and verifies implementations",
    role: "VALIDATE completed work and VERIFY implementations meet requirements.",
    responsibilities: [
      "Check TypeScript compilation",
      "Run test suites",
      "Check for regressions",
      "Verify lint rules",
      "Validate pass criteria explicitly",
    ],
    tools: ["Read", "Bash"],
    outputFormat: "Checklist with ✅/❌ status per item",
    telegram: {
      channel: "@vibe-qa",
      botEnvVar: "TELEGRAM_BOT_VALIDATION",
      webhookPath: "/webhook/qa",
    },
    defaultModel: "opus",
    recommendedModels: ["opus", "sonnet"],
  },

  spec_agent: {
    id: "spec_agent",
    name: "Spec Agent",
    type: "spec",
    emoji: "📝",
    description: "Creates technical specifications and PRDs",
    role: "CREATE technical specifications and PRDs from requirements.",
    responsibilities: [
      "Write PRDs in docs/specs/",
      "Create technical design docs",
      "Define testable pass criteria",
      "Document dependencies",
      "List open questions",
    ],
    tools: ["Read", "Write", "Edit"],
    outputFormat:
      "Structured spec with Overview, Requirements, Technical Design, Pass Criteria",
    telegram: {
      channel: "@vibe-spec",
      botEnvVar: "TELEGRAM_BOT_SPEC",
      webhookPath: "/webhook/spec",
    },
    defaultModel: "opus",
    recommendedModels: ["opus", "sonnet"],
  },

  research_agent: {
    id: "research_agent",
    name: "Research Agent",
    type: "research",
    emoji: "🔍",
    description: "Investigates problems and gathers context",
    role: "INVESTIGATE problems, EXPLORE solutions, and GATHER context.",
    responsibilities: [
      "Search external documentation",
      "Find code examples and patterns",
      "Research libraries and tools",
      "Analyze codebase patterns",
      "Synthesize findings clearly",
    ],
    tools: ["Read", "Bash", "WebSearch"],
    outputFormat: "Findings + Recommendations + References",
    telegram: {
      channel: "@vibe-research",
      botEnvVar: "TELEGRAM_BOT_RESEARCH",
      webhookPath: "/webhook/research",
    },
    defaultModel: "sonnet",
    recommendedModels: ["sonnet", "opus"],
  },

  decomposition_agent: {
    id: "decomposition_agent",
    name: "Decomposition Agent",
    type: "decomposition",
    emoji: "🧩",
    description: "Breaks down large tasks into atomic subtasks",
    role: "BREAK DOWN large tasks into atomic subtasks.",
    responsibilities: [
      "Analyze large task scope",
      "Identify components and dependencies",
      "Create subtasks (5-15 min each)",
      "Assign wave numbers for parallelization",
      "Define clear pass criteria per subtask",
    ],
    tools: ["Read"],
    outputFormat:
      "Subtask list with Title, Description, Pass Criteria, Dependencies, Wave",
    telegram: {
      channel: "@vibe-decomposition",
      botEnvVar: "TELEGRAM_BOT_DECOMPOSITION",
      webhookPath: "/webhook/decomposition",
    },
    defaultModel: "sonnet",
    recommendedModels: ["sonnet", "opus"],
  },

  task_agent: {
    id: "task_agent",
    name: "Task Agent",
    type: "task",
    emoji: "📋",
    description: "Manages task queue and coordinates task flow",
    role: "MANAGE the task queue and coordinate task flow.",
    responsibilities: [
      "Prioritize work based on dependencies",
      "Track task status transitions",
      "Coordinate with other agents",
      "Update task metadata",
      "Identify blockers",
    ],
    tools: ["Read"],
    telegram: {
      channel: "@vibe-task",
      botEnvVar: "TELEGRAM_BOT_TASK",
      webhookPath: "/webhook/task",
    },
    defaultModel: "sonnet",
    recommendedModels: ["sonnet", "haiku"],
  },

  validation_agent: {
    id: "validation_agent",
    name: "Validation Agent",
    type: "validation",
    emoji: "🔐",
    description: "Performs final validation before merge",
    role: "Perform FINAL VALIDATION before code is considered complete.",
    responsibilities: [
      "Run full test suite",
      "Run typecheck",
      "Review code quality",
      "Check documentation",
      "Verify each pass criterion",
    ],
    tools: ["Read", "Bash"],
    outputFormat: "Detailed validation report with pass/fail per criterion",
    telegram: {
      channel: "@vibe-validation",
      botEnvVar: "TELEGRAM_BOT_VALIDATION",
      webhookPath: "/webhook/validation",
    },
    defaultModel: "sonnet",
    recommendedModels: ["sonnet", "opus"],
  },

  evaluator_agent: {
    id: "evaluator_agent",
    name: "Evaluator Agent",
    type: "evaluator",
    emoji: "⚖️",
    description: "Assesses task complexity and estimates effort",
    role: "EVALUATE task complexity and estimate effort.",
    responsibilities: [
      "Estimate lines of code changed",
      "Count files affected",
      "Assess test coverage needed",
      "Evaluate regression risk",
      "Recommend proceed/decompose/research",
    ],
    tools: ["Read"],
    outputFormat:
      "Complexity (LOW-VERY_HIGH), Effort (hours), Risk, Recommendation",
    telegram: {
      channel: "@vibe-evaluator",
      botEnvVar: "TELEGRAM_BOT_EVALUATOR",
      webhookPath: "/webhook/evaluator",
    },
    defaultModel: "opus",
    recommendedModels: ["opus", "sonnet"],
  },

  sia_agent: {
    id: "sia_agent",
    name: "SIA (Strategic Ideation Agent)",
    type: "sia",
    emoji: "🧠",
    description: "Strategic brain - ideates, arbitrates, maintains soul vision",
    role: "IDEATE, ARBITRATE disputes, and maintain the SOUL VISION.",
    responsibilities: [
      "Brainstorm solutions when agents are stuck",
      "Explore alternatives and challenge assumptions",
      "Generate creative ideas for hard problems",
      "Arbitrate when agents disagree",
      "Analyze failure patterns",
    ],
    tools: ["Read", "Bash"],
    triggerConditions: [
      "Evaluator identifies task needs exploration",
      "Multiple agents fail same task",
      "Crown agent detects persistent issues",
      "Human requests strategic input",
    ],
    outputFormat: "Analysis + Options Explored + Recommendation + Action Items",
    telegram: {
      channel: "@vibe-sia",
      botEnvVar: "TELEGRAM_BOT_SIA",
      webhookPath: "/webhook/sia",
    },
    defaultModel: "opus",
    recommendedModels: ["opus"],
  },

  planning_agent: {
    id: "planning_agent",
    name: "Planning Agent",
    type: "planning",
    emoji: "⭐",
    description:
      "Strategic brain - analyzes codebase and creates improvement tasks",
    role: 'ANALYZE the codebase and CREATE improvement tasks. Maintains the "soul vision".',
    responsibilities: [
      "Continuously evaluate project state",
      "Analyze CLI logs and past iterations",
      "Create feature/bug/improvement tasks",
      "Identify technical debt",
      "Align work with long-term vision",
    ],
    tools: ["Read", "Write", "Edit", "Bash"],
    outputFormat: "Project Assessment + Proposed Tasks with priorities",
    telegram: {
      channel: "@vibe-planning",
      botEnvVar: "TELEGRAM_BOT_PLANNING",
      webhookPath: "/webhook/planning",
    },
    defaultModel: "opus",
    recommendedModels: ["opus", "sonnet", "haiku"],
  },

  clarification_agent: {
    id: "clarification_agent",
    name: "Clarification Agent",
    type: "clarification",
    emoji: "❓",
    description: "Intercepts ambiguous tasks and asks clarifying questions",
    role: "INTERCEPT ambiguous tasks and ASK clarifying questions before execution.",
    responsibilities: [
      "Analyze task requirements",
      "Identify ambiguities or missing info",
      "Formulate targeted questions",
      "Wait for human response via Telegram",
      "Update task with complete specification",
    ],
    tools: ["Read"],
    outputFormat: "Numbered questions with options where possible",
    telegram: {
      channel: "@vibe-clarification",
      botEnvVar: "TELEGRAM_BOT_CLARIFICATION",
      webhookPath: "/webhook/clarification",
    },
    defaultModel: "sonnet",
    recommendedModels: ["sonnet", "haiku"],
  },

  human_sim_agent: {
    id: "human_sim_agent",
    name: "Human Sim Agent",
    type: "human_sim",
    emoji: "🎭",
    description: "Tests UI features as different user personas",
    role: "TEST completed UI features like a REAL USER with different personas.",
    responsibilities: [
      "Load and interact with UI features",
      "Adopt different persona mindsets",
      "Attempt tasks naturally",
      "Document pain points",
      "Suggest fixes",
    ],
    tools: ["Read", "Browser", "Screenshot"],
    outputFormat: "Journey steps with ✅/⚠️/❌ + Issues + Recommendations",
    telegram: {
      channel: "@vibe-human-sim",
      botEnvVar: "TELEGRAM_HUMAN_SIM_BOT_TOKEN",
      webhookPath: "/webhook/human-sim",
    },
    defaultModel: "sonnet",
    recommendedModels: ["sonnet", "opus"],
  },

  orchestrator: {
    id: "orchestrator",
    name: "Orchestrator",
    type: "orchestrator",
    emoji: "🎯",
    description: "Coordinates all agents and manages the work loop",
    role: "COORDINATE agents and MANAGE the orchestration loop.",
    responsibilities: [
      "Assign tasks to appropriate agents",
      "Monitor agent health and heartbeats",
      "Handle stuck/failed agents",
      "Trigger planning and QA cycles",
      "Manage budget and rate limits",
    ],
    tools: ["Internal APIs"],
    telegram: {
      channel: "@vibe-orchestrator",
      botEnvVar: "TELEGRAM_BOT_ORCHESTRATOR",
      webhookPath: "/webhook/orchestrator",
    },
    defaultModel: "haiku",
    recommendedModels: ["haiku", "sonnet"],
  },

  architect_agent: {
    id: "architect_agent",
    name: "Architect Agent",
    type: "architect",
    emoji: "🏗️",
    description: "Designs system architecture and technical solutions",
    role: "DESIGN system architecture and RECOMMEND technical solutions.",
    responsibilities: [
      "Analyze project requirements and constraints",
      "Design system architecture and component structure",
      "Make informed technology stack decisions",
      "Define API contracts and database schemas",
      "Identify quality attributes and risks",
      "Generate comprehensive architecture documentation",
    ],
    tools: ["Read", "Write", "Edit"],
    outputFormat:
      "Architecture document with components, tech stack, API contracts, and schemas",
    telegram: {
      channel: "@vibe-architect",
      botEnvVar: "TELEGRAM_BOT_ARCHITECT",
      webhookPath: "/webhook/architect",
    },
    defaultModel: "opus",
    recommendedModels: ["opus", "sonnet"],
  },
};

/**
 * Get metadata for an agent by ID or type
 */
export function getAgentMetadata(idOrType: string): AgentMetadata | undefined {
  // Try direct lookup
  if (AGENT_METADATA[idOrType]) {
    return AGENT_METADATA[idOrType];
  }

  // Try matching by type
  for (const meta of Object.values(AGENT_METADATA)) {
    if (meta.type === idOrType) {
      return meta;
    }
  }

  return undefined;
}

/**
 * Get all agent metadata
 */
export function getAllAgentMetadata(): AgentMetadata[] {
  return Object.values(AGENT_METADATA);
}

export default {
  AGENT_METADATA,
  getAgentMetadata,
  getAllAgentMetadata,
};
