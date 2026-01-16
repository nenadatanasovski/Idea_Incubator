/**
 * Tests for Notification Channels
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database functions
vi.mock("../database/db.js", () => ({
  createDelivery: vi.fn(),
  updateDeliveryStatus: vi.fn(),
  getTemplate: vi.fn(),
  getUserEmail: vi.fn(),
  getUserTelegram: vi.fn(),
}));

// Mock WebSocket broadcast
vi.mock("../server/websocket.js", () => ({
  broadcastToUser: vi.fn(),
}));

import {
  createDelivery,
  updateDeliveryStatus,
  getTemplate,
  getUserEmail,
  getUserTelegram,
} from "../database/db.js";
import { broadcastToUser } from "../server/websocket.js";

const mockCreateDelivery = vi.mocked(createDelivery);
const mockUpdateDeliveryStatus = vi.mocked(updateDeliveryStatus);
const mockGetTemplate = vi.mocked(getTemplate);
const mockGetUserEmail = vi.mocked(getUserEmail);
const mockGetUserTelegram = vi.mocked(getUserTelegram);
const mockBroadcastToUser = vi.mocked(broadcastToUser);

describe("Notification Channels", () => {
  const mockNotification = {
    id: "notif-1",
    userId: "user-1",
    type: "agent_question",
    category: "agent" as const,
    title: "Test Notification",
    body: "Test body content",
    data: { key: "value" },
    priority: "normal" as const,
    readAt: null,
    archivedAt: null,
    expiresAt: null,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockCreateDelivery.mockImplementation(async (notificationId, channel) => ({
      id: `deliv-${channel}-123`,
      notificationId,
      channel: channel as "in_app" | "email" | "telegram",
      status: "pending" as const,
      error: null,
      retryCount: 0,
      nextRetryAt: null,
      sentAt: null,
      deliveredAt: null,
      createdAt: new Date().toISOString(),
    }));

    mockUpdateDeliveryStatus.mockResolvedValue(undefined);
  });

  describe("InAppChannel", () => {
    let inAppChannel: typeof import("../server/notifications/channels/in-app.js").inAppChannel;

    beforeEach(async () => {
      vi.resetModules();
      const module = await import("../server/notifications/channels/in-app.js");
      inAppChannel = module.inAppChannel;
    });

    it("should create delivery and broadcast via WebSocket", async () => {
      const delivery = await inAppChannel.send(mockNotification);

      expect(mockCreateDelivery).toHaveBeenCalledWith("notif-1", "in_app");
      expect(mockBroadcastToUser).toHaveBeenCalledWith(
        "user-1",
        "notification:new",
        mockNotification,
      );
      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        "deliv-in_app-123",
        "sent",
      );
      expect(delivery.status).toBe("sent");
      expect(delivery.channel).toBe("in_app");
    });

    it("should handle broadcast errors", async () => {
      mockBroadcastToUser.mockImplementation(() => {
        throw new Error("WebSocket error");
      });

      const delivery = await inAppChannel.send(mockNotification);

      expect(delivery.status).toBe("failed");
      expect(delivery.error).toContain("WebSocket error");
      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        "deliv-in_app-123",
        "failed",
        "WebSocket error",
      );
    });
  });

  describe("EmailChannel", () => {
    let emailChannel: typeof import("../server/notifications/channels/email.js").emailChannel;

    beforeEach(async () => {
      vi.resetModules();
      const module = await import("../server/notifications/channels/email.js");
      emailChannel = module.emailChannel;
    });

    it("should skip if user has no email", async () => {
      mockGetUserEmail.mockResolvedValue(null);

      const delivery = await emailChannel.send(mockNotification);

      expect(delivery.status).toBe("skipped");
      expect(delivery.error).toContain("No email address");
      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        "deliv-email-123",
        "skipped",
        "No email address configured",
      );
    });

    it("should send email with template content", async () => {
      mockGetUserEmail.mockResolvedValue("user@example.com");
      mockGetTemplate.mockResolvedValue({
        id: "tmpl-1",
        type: "agent_question",
        titleTemplate: "Title",
        bodyTemplate: "Body",
        emailSubject: "Email Subject: {{key}}",
        emailBody: "<p>Email Body: {{key}}</p>",
        telegramText: null,
        defaultChannels: ["in_app", "email"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const delivery = await emailChannel.send(mockNotification);

      expect(delivery.status).toBe("sent");
      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        "deliv-email-123",
        "sent",
      );
    });

    it("should use notification title/body if no email template", async () => {
      mockGetUserEmail.mockResolvedValue("user@example.com");
      mockGetTemplate.mockResolvedValue({
        id: "tmpl-1",
        type: "agent_question",
        titleTemplate: "Title",
        bodyTemplate: "Body",
        emailSubject: null,
        emailBody: null,
        telegramText: null,
        defaultChannels: ["in_app"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const delivery = await emailChannel.send(mockNotification);

      expect(delivery.status).toBe("sent");
    });
  });

  describe("TelegramChannel", () => {
    let telegramChannel: typeof import("../server/notifications/channels/telegram.js").telegramChannel;

    beforeEach(async () => {
      vi.resetModules();
      const module =
        await import("../server/notifications/channels/telegram.js");
      telegramChannel = module.telegramChannel;
    });

    it("should skip if user has no Telegram configured", async () => {
      mockGetUserTelegram.mockResolvedValue(null);

      const delivery = await telegramChannel.send(mockNotification);

      expect(delivery.status).toBe("skipped");
      expect(delivery.error).toContain("No Telegram configured");
    });

    it("should send with template text", async () => {
      mockGetUserTelegram.mockResolvedValue("123456789");
      mockGetTemplate.mockResolvedValue({
        id: "tmpl-1",
        type: "agent_question",
        titleTemplate: "Title",
        bodyTemplate: "Body",
        emailSubject: null,
        emailBody: null,
        telegramText: "🤖 *{{key}}*",
        defaultChannels: ["in_app", "telegram"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const delivery = await telegramChannel.send(mockNotification);

      expect(delivery.status).toBe("sent");
      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        "deliv-telegram-123",
        "sent",
      );
    });
  });
});
