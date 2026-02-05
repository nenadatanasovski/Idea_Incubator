// server/communication/bot-registry.ts
// COM-002: Bot Registry and Token Management

import { AgentType, RegisteredBot, TelegramBot } from "./types";
import { BOT_CONFIGS } from "./config";

export class BotRegistry {
  private bots: Map<AgentType, RegisteredBot> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckIntervalMs: number;

  constructor(healthCheckIntervalMs: number = 5 * 60 * 1000) {
    this.healthCheckIntervalMs = healthCheckIntervalMs;
  }

  async initialize(): Promise<void> {
    console.log("[BotRegistry] Initializing bot registry...");

    for (const config of BOT_CONFIGS) {
      const token = process.env[config.envTokenVar];

      if (!token) {
        console.warn(
          `[BotRegistry] Missing token for ${config.agentType}: ${config.envTokenVar}`,
        );
        continue;
      }

      const botInfo = await this.validateToken(token);

      if (botInfo) {
        this.bots.set(config.agentType, {
          agentType: config.agentType,
          token,
          botId: botInfo.id,
          username: botInfo.username,
          displayName: config.displayName,
          healthy: true,
          lastChecked: new Date(),
        });
        console.log(
          `[BotRegistry] Registered ${config.agentType} bot: @${botInfo.username}`,
        );
      } else {
        console.error(
          `[BotRegistry] Failed to validate token for ${config.agentType}`,
        );
      }
    }

    console.log(`[BotRegistry] Initialized with ${this.bots.size} bots`);

    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Get bot for a specific agent type.
   * Falls back to system bot if the requested bot is unavailable.
   */
  getBot(agentType: AgentType): RegisteredBot | null {
    const bot = this.bots.get(agentType);

    if (bot?.healthy) {
      return bot;
    }

    // Fallback to system bot
    if (agentType !== "system") {
      const systemBot = this.bots.get("system");
      if (systemBot?.healthy) {
        console.warn(
          `[BotRegistry] Using system bot as fallback for ${agentType}`,
        );
        return systemBot;
      }
    }

    return null;
  }

  /**
   * Get bot based on agent ID (extracts agent type from ID).
   */
  getBotForAgent(agentId: string): RegisteredBot | null {
    const agentType = this.extractAgentType(agentId);
    return this.getBot(agentType);
  }

  /**
   * Get all registered bots.
   */
  getAllBots(): RegisteredBot[] {
    return Array.from(this.bots.values());
  }

  /**
   * Get all healthy bots.
   */
  getHealthyBots(): RegisteredBot[] {
    return this.getAllBots().filter((b) => b.healthy);
  }

  /**
   * Get all unhealthy bots.
   */
  getUnhealthyBots(): RegisteredBot[] {
    return this.getAllBots().filter((b) => !b.healthy);
  }

  /**
   * Check if a specific bot is available and healthy.
   */
  isBotAvailable(agentType: AgentType): boolean {
    const bot = this.bots.get(agentType);
    return bot?.healthy ?? false;
  }

  /**
   * Get bot count summary.
   */
  getStatus(): { total: number; healthy: number; unhealthy: number } {
    const all = this.getAllBots();
    const healthy = all.filter((b) => b.healthy);
    return {
      total: all.length,
      healthy: healthy.length,
      unhealthy: all.length - healthy.length,
    };
  }

  /**
   * Validate a bot token by calling Telegram's getMe API.
   * Uses AbortController for timeout to prevent hanging on network issues.
   */
  private async validateToken(token: string): Promise<TelegramBot | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getMe`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      const data = await response.json();

      if (data.ok) {
        return data.result as TelegramBot;
      }

      console.error("[BotRegistry] getMe failed:", data.description);
      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn("[BotRegistry] Token validation timed out (10s)");
      } else {
        console.error("[BotRegistry] Failed to validate bot token:", error);
      }
      return null;
    }
  }

  /**
   * Start periodic health checks for all registered bots.
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      console.log("[BotRegistry] Running health check...");

      const entries = Array.from(this.bots.entries());
      for (const [agentType, bot] of entries) {
        const info = await this.validateToken(bot.token);
        const wasHealthy = bot.healthy;
        bot.healthy = info !== null;
        bot.lastChecked = new Date();

        if (wasHealthy && !bot.healthy) {
          console.error(`[BotRegistry] Bot ${agentType} became unhealthy`);
        } else if (!wasHealthy && bot.healthy) {
          console.log(`[BotRegistry] Bot ${agentType} recovered`);
        }
      }

      const status = this.getStatus();
      console.log(
        `[BotRegistry] Health check complete: ${status.healthy}/${status.total} healthy`,
      );
    }, this.healthCheckIntervalMs);
  }

  /**
   * Force an immediate health check for all bots.
   */
  async forceHealthCheck(): Promise<void> {
    console.log("[BotRegistry] Forcing health check...");

    const entries = Array.from(this.bots.entries());
    for (const [_agentType, bot] of entries) {
      const info = await this.validateToken(bot.token);
      bot.healthy = info !== null;
      bot.lastChecked = new Date();
    }
  }

  /**
   * Extract agent type from an agent ID.
   * Examples:
   *   "monitor-agent-123" → "monitoring"
   *   "spec-agent-456" → "spec"
   *   "build-agent-789" → "build"
   */
  private extractAgentType(agentId: string): AgentType {
    const id = agentId.toLowerCase();

    if (id.includes("monitor")) return "monitoring";
    if (id.includes("orchestrat")) return "orchestrator";
    if (id.includes("spec")) return "spec";
    if (id.includes("build")) return "build";
    if (id.includes("valid")) return "validation";
    if (id.includes("sia")) return "sia";

    return "system";
  }

  /**
   * Stop health checks and clean up.
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Singleton instance
let botRegistryInstance: BotRegistry | null = null;

export function getBotRegistry(): BotRegistry {
  if (!botRegistryInstance) {
    botRegistryInstance = new BotRegistry();
  }
  return botRegistryInstance;
}

export async function initializeBotRegistry(): Promise<BotRegistry> {
  const registry = getBotRegistry();
  await registry.initialize();
  return registry;
}
