// agents/validation/level-configs.ts

import { LevelConfig, ValidationLevel } from "../../types/validation.js";

export const LEVEL_CONFIGS: Record<ValidationLevel, LevelConfig> = {
  QUICK: {
    level: "QUICK",
    timeBudgetMs: 30000,
    validators: [
      {
        name: "typescript",
        command: "npx",
        args: ["tsc", "--noEmit"],
        required: true,
        timeoutMs: 25000,
      },
    ],
  },
  STANDARD: {
    level: "STANDARD",
    timeBudgetMs: 120000,
    validators: [
      {
        name: "typescript",
        command: "npx",
        args: ["tsc", "--noEmit"],
        required: true,
        timeoutMs: 30000,
      },
      {
        name: "vitest",
        command: "npx",
        args: ["vitest", "run"],
        required: true,
        timeoutMs: 90000,
      },
    ],
  },
  THOROUGH: {
    level: "THOROUGH",
    timeBudgetMs: 600000,
    validators: [
      {
        name: "typescript",
        command: "npx",
        args: ["tsc", "--noEmit", "--strict"],
        required: true,
        timeoutMs: 60000,
      },
      {
        name: "vitest",
        command: "npx",
        args: ["vitest", "run"],
        required: true,
        timeoutMs: 300000,
      },
      {
        name: "security",
        command: "npm",
        args: ["audit", "--json"],
        required: false,
        timeoutMs: 60000,
      },
      {
        name: "coverage",
        command: "npm",
        args: ["run", "test:coverage", "--", "--lines=50"],
        required: false,
        timeoutMs: 300000,
      },
    ],
  },
  RELEASE: {
    level: "RELEASE",
    timeBudgetMs: 0, // No limit
    validators: [
      {
        name: "typescript",
        command: "npx",
        args: ["tsc", "--noEmit", "--strict"],
        required: true,
        timeoutMs: 120000,
      },
      {
        name: "vitest",
        command: "npx",
        args: ["vitest", "run"],
        required: true,
        timeoutMs: 600000,
      },
      {
        name: "security",
        command: "npm",
        args: ["audit", "--json"],
        required: true,
        timeoutMs: 120000,
      },
      {
        name: "coverage",
        command: "npm",
        args: ["run", "test:coverage", "--", "--lines=70", "--functions=70"],
        required: true,
        timeoutMs: 600000,
      },
    ],
  },
};

export function getLevelConfig(level: ValidationLevel): LevelConfig {
  return LEVEL_CONFIGS[level];
}
