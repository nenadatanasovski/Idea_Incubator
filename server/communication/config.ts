// server/communication/config.ts
// Configuration loader for communication module

import { AgentType } from "./types";

export interface BotConfig {
  agentType: AgentType;
  envTokenVar: string;
  envUsernameVar: string;
  displayName: string;
}

export const BOT_CONFIGS: BotConfig[] = [
  {
    agentType: "monitoring",
    envTokenVar: "TELEGRAM_BOT_MONITOR_TOKEN",
    envUsernameVar: "TELEGRAM_BOT_MONITOR_USERNAME",
    displayName: "Vibe Monitor",
  },
  {
    agentType: "orchestrator",
    envTokenVar: "TELEGRAM_BOT_ORCHESTRATOR_TOKEN",
    envUsernameVar: "TELEGRAM_BOT_ORCHESTRATOR_USERNAME",
    displayName: "Vibe Orchestrator",
  },
  {
    agentType: "spec",
    envTokenVar: "TELEGRAM_BOT_SPEC_TOKEN",
    envUsernameVar: "TELEGRAM_BOT_SPEC_USERNAME",
    displayName: "Vibe Spec",
  },
  {
    agentType: "build",
    envTokenVar: "TELEGRAM_BOT_BUILD_TOKEN",
    envUsernameVar: "TELEGRAM_BOT_BUILD_USERNAME",
    displayName: "Vibe Build",
  },
  {
    agentType: "validation",
    envTokenVar: "TELEGRAM_BOT_VALIDATION_TOKEN",
    envUsernameVar: "TELEGRAM_BOT_VALIDATION_USERNAME",
    displayName: "Vibe Validation",
  },
  {
    agentType: "sia",
    envTokenVar: "TELEGRAM_BOT_SIA_TOKEN",
    envUsernameVar: "TELEGRAM_BOT_SIA_USERNAME",
    displayName: "Vibe SIA",
  },
  {
    agentType: "system",
    envTokenVar: "TELEGRAM_BOT_SYSTEM_TOKEN",
    envUsernameVar: "TELEGRAM_BOT_SYSTEM_USERNAME",
    displayName: "Vibe System",
  },
];

export interface CommunicationConfig {
  primaryUserId: string;
  primaryEmail: string;
  smtpEmail: string;
  smtpPassword: string;
  healthCheckIntervalMs: number;
  messageRetryAttempts: number;
  messageRetryDelayMs: number;
  verificationCodeExpiryMinutes: number;
  questionTimeoutMs: number;
  haltOnNoResponse: boolean;
}

export function loadConfig(): CommunicationConfig {
  return {
    primaryUserId: process.env.PRIMARY_USER_ID || "default-user",
    primaryEmail: process.env.PRIMARY_EMAIL || "",
    smtpEmail: process.env.SMTP_EMAIL || "",
    smtpPassword: process.env.SMTP_PASSWORD || "",
    healthCheckIntervalMs: parseInt(
      process.env.HEALTH_CHECK_INTERVAL_MS || "300000",
      10,
    ), // 5 min
    messageRetryAttempts: parseInt(
      process.env.MESSAGE_RETRY_ATTEMPTS || "3",
      10,
    ),
    messageRetryDelayMs: parseInt(
      process.env.MESSAGE_RETRY_DELAY_MS || "1000",
      10,
    ),
    verificationCodeExpiryMinutes: parseInt(
      process.env.VERIFICATION_CODE_EXPIRY_MINUTES || "30",
      10,
    ),
    questionTimeoutMs: parseInt(
      process.env.QUESTION_TIMEOUT_MS || "300000",
      10,
    ), // 5 min
    haltOnNoResponse: process.env.HALT_ON_NO_RESPONSE !== "false",
  };
}

export function getBotToken(agentType: AgentType): string | null {
  const config = BOT_CONFIGS.find((c) => c.agentType === agentType);
  if (!config) return null;
  return process.env[config.envTokenVar] || null;
}

export function getBotUsername(agentType: AgentType): string | null {
  const config = BOT_CONFIGS.find((c) => c.agentType === agentType);
  if (!config) return null;
  return process.env[config.envUsernameVar] || null;
}
