// server/communication/telegram-receiver.ts
// COM-005: Telegram Multi-Bot Receiver (Long Polling)

import { EventEmitter } from "events";
import { BotRegistry } from "./bot-registry";
import { AgentType, RegisteredBot } from "./types";
import { httpsPostIPv4 } from "./http-utils";

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from: { id: number; username?: string };
  chat: { id: number };
  text?: string;
  date: number;
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number; username?: string };
  message?: TelegramMessage;
  data?: string;
}

export interface ReceivedMessage {
  botType: AgentType;
  chatId: string;
  messageId: number;
  text: string;
  fromUserId: number;
  fromUsername?: string;
  timestamp: Date;
}

export interface ReceivedCallback {
  botType: AgentType;
  callbackId: string;
  chatId: string;
  messageId: number;
  data: string;
  fromUserId: number;
}

export class TelegramReceiver extends EventEmitter {
  private botRegistry: BotRegistry;
  private running: boolean = false;
  private offsets: Map<AgentType, number> = new Map();
  private pollingTimeouts: Map<AgentType, ReturnType<typeof setTimeout>> =
    new Map();
  private pollIntervalMs: number;

  constructor(botRegistry: BotRegistry, pollIntervalMs: number = 1000) {
    super();
    this.botRegistry = botRegistry;
    this.pollIntervalMs = pollIntervalMs;
  }

  /**
   * Start polling for all registered bots.
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn("[TelegramReceiver] Already running");
      return;
    }

    this.running = true;
    const bots = this.botRegistry.getAllBots();

    console.log(`[TelegramReceiver] Starting polling for ${bots.length} bots`);

    // Start polling loop for each bot
    for (const bot of bots) {
      this.startBotPolling(bot);
    }

    this.emit("receiver:started", { botCount: bots.length });
  }

  /**
   * Stop polling for all bots.
   */
  async stop(): Promise<void> {
    console.log("[TelegramReceiver] Stopping...");
    this.running = false;

    // Clear all polling timeouts
    const timeouts = Array.from(this.pollingTimeouts.values());
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
    this.pollingTimeouts.clear();

    this.emit("receiver:stopped");
  }

  /**
   * Check if receiver is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Start polling loop for a specific bot.
   */
  private async startBotPolling(bot: RegisteredBot): Promise<void> {
    if (!this.running) return;

    try {
      const updates = await this.getUpdates(bot);

      if (updates.length > 0) {
        console.log(
          `[TelegramReceiver] Got ${updates.length} updates for ${bot.agentType}`,
        );
      }

      for (const update of updates) {
        await this.processUpdate(bot.agentType, update);
        this.offsets.set(bot.agentType, update.update_id + 1);
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(
        `[TelegramReceiver] Polling error for ${bot.agentType}: ${errorMessage}`,
      );
      this.emit("receiver:error", {
        botType: bot.agentType,
        error: errorMessage,
      });
    }

    // Schedule next poll
    if (this.running) {
      const timeout = setTimeout(() => {
        this.startBotPolling(bot);
      }, this.pollIntervalMs);
      this.pollingTimeouts.set(bot.agentType, timeout);
    }
  }

  /**
   * Get updates from Telegram API using long polling.
   * Uses IPv4-forced HTTPS to avoid Node.js IPv6 timeout issues.
   */
  private async getUpdates(bot: RegisteredBot): Promise<TelegramUpdate[]> {
    const offset = this.offsets.get(bot.agentType) || 0;
    const url = `https://api.telegram.org/bot${bot.token}/getUpdates`;

    const data = await httpsPostIPv4(url, {
      offset,
      timeout: 30, // Long polling timeout in seconds
      allowed_updates: ["message", "callback_query"],
    }, 35000); // 35s timeout to account for 30s long poll

    if (data.ok) {
      return data.result as TelegramUpdate[];
    }

    throw new Error(data.description || "Unknown Telegram API error");
  }

  /**
   * Process a single update.
   */
  private async processUpdate(
    botType: AgentType,
    update: TelegramUpdate,
  ): Promise<void> {
    if (update.message) {
      await this.processMessage(botType, update.message);
    }

    if (update.callback_query) {
      await this.processCallbackQuery(botType, update.callback_query);
    }
  }

  /**
   * Process an incoming message.
   */
  private async processMessage(
    botType: AgentType,
    message: TelegramMessage,
  ): Promise<void> {
    const text = message.text || "";

    const receivedMessage: ReceivedMessage = {
      botType,
      chatId: message.chat.id.toString(),
      messageId: message.message_id,
      text,
      fromUserId: message.from.id,
      fromUsername: message.from.username,
      timestamp: new Date(message.date * 1000),
    };

    console.log(
      `[TelegramReceiver] Message from ${botType}: "${text.substring(0, 50)}..."`,
    );

    // Handle commands
    if (text.startsWith("/start")) {
      this.emit("command:start", receivedMessage);
      return;
    }

    if (text.startsWith("/summary")) {
      this.emit("command:summary", receivedMessage);
      return;
    }

    if (text.startsWith("/status")) {
      this.emit("command:status", receivedMessage);
      return;
    }

    if (text.startsWith("/help")) {
      this.emit("command:help", receivedMessage);
      return;
    }

    if (text.startsWith("/link")) {
      this.emit("command:link", receivedMessage);
      return;
    }

    // Task Agent commands (PTE-096 to PTE-103, BA-065 to BA-076)
    if (text.startsWith("/newtask")) {
      this.emit("command:newtask", receivedMessage);
      return;
    }

    if (text.startsWith("/edit")) {
      this.emit("command:edit", receivedMessage);
      return;
    }

    if (text.startsWith("/override")) {
      this.emit("command:override", receivedMessage);
      return;
    }

    if (text.startsWith("/queue")) {
      this.emit("command:queue", receivedMessage);
      return;
    }

    if (text.startsWith("/suggest")) {
      this.emit("command:suggest", receivedMessage);
      return;
    }

    if (text.startsWith("/accept")) {
      this.emit("command:accept", receivedMessage);
      return;
    }

    if (text.startsWith("/reject")) {
      this.emit("command:reject", receivedMessage);
      return;
    }

    if (text.startsWith("/parallel")) {
      this.emit("command:parallel", receivedMessage);
      return;
    }

    if (text.startsWith("/execute")) {
      this.emit("command:execute", receivedMessage);
      return;
    }

    if (text.startsWith("/pause")) {
      this.emit("command:pause", receivedMessage);
      return;
    }

    if (text.startsWith("/resume")) {
      this.emit("command:resume", receivedMessage);
      return;
    }

    if (text.startsWith("/stop")) {
      this.emit("command:stop", receivedMessage);
      return;
    }

    if (text.startsWith("/agents")) {
      this.emit("command:agents", receivedMessage);
      return;
    }

    if (text.startsWith("/lists")) {
      this.emit("command:lists", receivedMessage);
      return;
    }

    if (text.startsWith("/task")) {
      this.emit("command:task", receivedMessage);
      return;
    }

    // Check if it's a verification code (6 digits)
    if (/^\d{6}$/.test(text.trim())) {
      this.emit("verification:code", receivedMessage);
      return;
    }

    // Regular text message (could be free-text answer)
    this.emit("message:text", receivedMessage);
  }

  /**
   * Process a callback query (button press).
   */
  private async processCallbackQuery(
    botType: AgentType,
    callback: TelegramCallbackQuery,
  ): Promise<void> {
    const receivedCallback: ReceivedCallback = {
      botType,
      callbackId: callback.id,
      chatId: callback.message?.chat.id.toString() || "",
      messageId: callback.message?.message_id || 0,
      data: callback.data || "",
      fromUserId: callback.from.id,
    };

    console.log(
      `[TelegramReceiver] Callback from ${botType}: "${callback.data}"`,
    );

    // Answer callback query (removes loading state from button)
    await this.answerCallbackQuery(botType, callback.id);

    // Parse callback data
    // Format: "answer:{questionId}:{action}" or "approve:{approvalId}:{yes|no}"
    const parts = (callback.data || "").split(":");

    if (parts[0] === "answer" && parts.length >= 3) {
      this.emit("answer:button", {
        ...receivedCallback,
        questionId: parts[1],
        action: parts.slice(2).join(":"),
      });
      return;
    }

    if (parts[0] === "approve" && parts.length >= 3) {
      this.emit("approval:response", {
        ...receivedCallback,
        approvalId: parts[1],
        approved: parts[2] === "yes",
      });
      return;
    }

    // Unknown callback
    this.emit("callback:unknown", receivedCallback);
  }

  /**
   * Answer a callback query to remove the loading indicator.
   */
  private async answerCallbackQuery(
    botType: AgentType,
    callbackId: string,
  ): Promise<void> {
    const bot = this.botRegistry.getBot(botType);
    if (!bot) return;

    const url = `https://api.telegram.org/bot${bot.token}/answerCallbackQuery`;

    try {
      await httpsPostIPv4(url, { callback_query_id: callbackId }, 10000);
    } catch (error) {
      console.error(
        `[TelegramReceiver] Failed to answer callback query: ${error}`,
      );
    }
  }
}
