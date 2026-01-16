import chalk from "chalk";

type LogLevel = "debug" | "info" | "warn" | "error";
type Transport = "console" | "websocket";

interface LoggerConfig {
  level: LogLevel;
  transport: Transport;
  websocketUrl?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const config: LoggerConfig = {
  level: "info",
  transport: "console",
};

export function setLogLevel(level: LogLevel): void {
  config.level = level;
}

export function setTransport(
  transport: Transport,
  options?: { websocketUrl?: string },
): void {
  config.transport = transport;
  if (options?.websocketUrl) {
    config.websocketUrl = options.websocketUrl;
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

export function logDebug(message: string, context?: object): void {
  if (!shouldLog("debug")) return;
  console.log(
    chalk.gray(`[DEBUG]`),
    message,
    context ? JSON.stringify(context) : "",
  );
}

export function logInfo(message: string): void {
  if (!shouldLog("info")) return;
  console.log(chalk.blue(`[INFO]`), message);
}

export function logSuccess(message: string): void {
  if (!shouldLog("info")) return;
  console.log(chalk.green(`[SUCCESS]`), message);
}

export function logWarning(message: string): void {
  if (!shouldLog("warn")) return;
  console.warn(chalk.yellow(`[WARN]`), message);
}

export function logError(message: string, error?: Error): void {
  if (!shouldLog("error")) return;
  console.error(chalk.red(`[ERROR]`), message);
  if (error && config.level === "debug") {
    console.error(error.stack);
  }
}

export function logDebate(
  agent: string,
  message: string,
  type: "claim" | "challenge" | "defense" | "verdict",
): void {
  if (!shouldLog("info")) return;

  const colors = {
    claim: chalk.blue,
    challenge: chalk.red,
    defense: chalk.green,
    verdict: chalk.yellow,
  };

  if (config.transport === "console") {
    console.log(colors[type](`[${agent}]`), message);
  }

  // WebSocket transport for Phase 6
  if (config.transport === "websocket" && config.websocketUrl) {
    // TODO: Implement WebSocket broadcast
  }
}

export function logCost(report: {
  operation: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  remaining: number;
}): void {
  if (!shouldLog("info")) return;
  console.log(
    chalk.magenta(`[COST]`),
    `${report.operation}: ${report.inputTokens}in/${report.outputTokens}out`,
    `$${report.cost.toFixed(4)} (remaining: $${report.remaining.toFixed(2)})`,
  );
}

export function logProgress(
  phase: string,
  current: number,
  total: number,
  cost?: number,
): void {
  if (!shouldLog("info")) return;
  const __percentage = Math.round((current / total) * 100);
  const barLength = 20;
  const filled = Math.round(barLength * (current / total));
  const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
  const costStr = cost !== undefined ? ` | $${cost.toFixed(2)}` : "";
  console.log(`${phase}: [${bar}] ${current}/${total}${costStr}`);
}

// Export logger config for testing
export function getLoggerConfig(): LoggerConfig {
  return { ...config };
}
