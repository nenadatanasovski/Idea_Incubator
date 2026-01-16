// server/communication/email-sender.ts
// COM-008: Email Sender - Fallback channel when Telegram fails

import { AgentType } from "./types.js";
import { QuestionType } from "./question-delivery.js";
import { createSignedAnswerUrl } from "../../utils/url-signer.js";

interface EmailTransport {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}

export interface EmailConfig {
  fromAddress: string;
  fromName: string;
  toAddress: string;
  replyToAddress?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailQuestion {
  id: string;
  agentId: string;
  agentType: AgentType;
  type: QuestionType;
  content: string;
  options: { label: string; action: string; description?: string }[];
  context?: Record<string, unknown>;
  blocking: boolean;
  priority: number;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  ALERT: "Alert",
  CLARIFYING: "Clarifying Question",
  CONFIRMING: "Confirmation Needed",
  PREFERENCE: "Your Preference?",
  BLOCKING: "Blocking Question",
  DECISION: "Decision Required",
  ESCALATION: "Escalation",
  APPROVAL: "Approval Required",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Normal",
  3: "High",
  4: "Urgent",
  5: "Critical",
};

export class EmailSender {
  private transport: EmailTransport;
  private config: EmailConfig;
  private baseUrl: string;

  constructor(
    transport: EmailTransport,
    config: EmailConfig,
    baseUrl: string = "http://localhost:3000",
  ) {
    this.transport = transport;
    this.config = config;
    this.baseUrl = baseUrl;
  }

  /**
   * Send a question via email as fallback.
   */
  async sendQuestion(question: EmailQuestion): Promise<EmailSendResult> {
    const subject = this.buildSubject(question);
    const { text, html } = this.buildQuestionBody(question);

    return this.send(subject, text, html);
  }

  /**
   * Send a simple notification.
   */
  async sendNotification(
    title: string,
    message: string,
    severity: "info" | "warning" | "error" | "critical" = "info",
  ): Promise<EmailSendResult> {
    const severityEmoji = {
      info: "ℹ️",
      warning: "⚠️",
      error: "❌",
      critical: "🚨",
    }[severity];

    const subject = `[Vibe ${severity.toUpperCase()}] ${title}`;
    const text = `${severityEmoji} ${title}\n\n${message}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${this.getSeverityColor(severity)};">${severityEmoji} ${title}</h2>
        <p style="font-size: 16px; line-height: 1.5;">${message.replace(/\n/g, "<br>")}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Sent by Vibe Communication System</p>
      </div>
    `;

    return this.send(subject, text, html);
  }

  /**
   * Send an approval request.
   */
  async sendApprovalRequest(
    approvalId: string,
    title: string,
    description: string,
    details?: string,
  ): Promise<EmailSendResult> {
    const subject = `[Vibe APPROVAL] ${title}`;

    const approveUrl = `${this.baseUrl}/api/approve/${approvalId}/yes`;
    const rejectUrl = `${this.baseUrl}/api/approve/${approvalId}/no`;

    const text = `🔴 APPROVAL REQUIRED

${title}

${description}

${details ? `Details:\n${details}\n` : ""}
To approve: ${approveUrl}
To reject: ${rejectUrl}

Or reply to this email with "APPROVE" or "REJECT".`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc3545; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🔴 Approval Required</h2>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
          <h3 style="margin-top: 0;">${title}</h3>
          <p style="font-size: 16px; line-height: 1.5;">${description.replace(/\n/g, "<br>")}</p>
          ${
            details
              ? `
            <div style="background: #e9ecef; padding: 10px; border-radius: 4px; margin: 15px 0;">
              <strong>Details:</strong>
              <pre style="margin: 10px 0 0 0; white-space: pre-wrap;">${details}</pre>
            </div>
          `
              : ""
          }
          <div style="margin-top: 20px; text-align: center;">
            <a href="${approveUrl}" style="display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-right: 10px;">✅ Approve</a>
            <a href="${rejectUrl}" style="display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">❌ Reject</a>
          </div>
          <p style="margin-top: 20px; color: #666; font-size: 12px; text-align: center;">
            Or reply to this email with "APPROVE" or "REJECT"
          </p>
        </div>
      </div>
    `;

    return this.send(subject, text, html);
  }

  /**
   * Send a digest of multiple pending questions.
   */
  async sendDigest(questions: EmailQuestion[]): Promise<EmailSendResult> {
    if (questions.length === 0) {
      return { success: true };
    }

    const blocking = questions.filter((q) => q.blocking);
    const nonBlocking = questions.filter((q) => !q.blocking);

    const subject = `[Vibe] ${questions.length} pending question${questions.length > 1 ? "s" : ""} - ${blocking.length} blocking`;

    let text = `You have ${questions.length} pending questions from Vibe agents.\n\n`;

    if (blocking.length > 0) {
      text += `⚠️ BLOCKING (${blocking.length}):\n`;
      for (const q of blocking) {
        text += `\n- [${q.agentType}] ${q.content.substring(0, 100)}...\n`;
      }
      text += "\n";
    }

    if (nonBlocking.length > 0) {
      text += `📋 Non-Blocking (${nonBlocking.length}):\n`;
      for (const q of nonBlocking) {
        text += `\n- [${q.agentType}] ${q.content.substring(0, 100)}...\n`;
      }
    }

    text += `\nView all: ${this.baseUrl}/questions`;

    const html = this.buildDigestHtml(blocking, nonBlocking);

    return this.send(subject, text, html);
  }

  /**
   * Build email subject for a question.
   */
  private buildSubject(question: EmailQuestion): string {
    const priority = question.priority >= 4 ? "[URGENT] " : "";
    const blocking = question.blocking ? "[BLOCKING] " : "";
    const type = TYPE_LABELS[question.type] || question.type;

    return `${priority}${blocking}[Vibe ${question.agentType}] ${type}`;
  }

  /**
   * Build email body for a question.
   */
  private buildQuestionBody(question: EmailQuestion): {
    text: string;
    html: string;
  } {
    const typeLabel = TYPE_LABELS[question.type] || question.type;
    const priorityLabel = PRIORITY_LABELS[question.priority] || "Normal";

    // Plain text version
    let text = `${typeLabel}\n${"=".repeat(typeLabel.length)}\n\n`;
    text += `${question.content}\n\n`;

    if (question.options.length > 0) {
      text += "Options:\n";
      question.options.forEach((opt, i) => {
        text += `  ${i + 1}. ${opt.label}`;
        if (opt.description) {
          text += ` - ${opt.description}`;
        }
        text += "\n";
      });
      text += "\n";
    }

    text += `Agent: ${question.agentId}\n`;
    text += `Priority: ${priorityLabel}\n`;
    text += `Blocking: ${question.blocking ? "Yes" : "No"}\n\n`;

    text += `To respond, visit: ${this.baseUrl}/questions/${question.id}\n`;
    text += `Or reply to this email with your choice (number or text).`;

    // HTML version
    const priorityColor = this.getPriorityColor(question.priority);
    const blockingBadge = question.blocking
      ? '<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">BLOCKING</span>'
      : "";

    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${priorityColor}; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">${typeLabel} ${blockingBadge}</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">${question.agentType} agent</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; line-height: 1.5;">${question.content.replace(/\n/g, "<br>")}</p>
    `;

    if (question.options.length > 0) {
      html += '<div style="margin: 20px 0;">';
      question.options.forEach((opt, i) => {
        const answerUrl = createSignedAnswerUrl(
          this.baseUrl,
          question.id,
          opt.action,
        );
        html += `
          <a href="${answerUrl}" style="display: block; background: white; border: 1px solid #ddd; padding: 12px 15px; margin: 8px 0; border-radius: 5px; text-decoration: none; color: #333;">
            <strong>${i + 1}. ${opt.label}</strong>
            ${opt.description ? `<br><span style="color: #666; font-size: 14px;">${opt.description}</span>` : ""}
          </a>
        `;
      });
      html += "</div>";
    }

    html += `
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <table style="width: 100%; font-size: 12px; color: #666;">
            <tr>
              <td>Agent: ${question.agentId}</td>
              <td>Priority: ${priorityLabel}</td>
            </tr>
          </table>
          <p style="margin-top: 15px; font-size: 12px; color: #666;">
            Reply to this email with your choice (number or text response).
          </p>
        </div>
      </div>
    `;

    return { text, html };
  }

  /**
   * Build digest HTML.
   */
  private buildDigestHtml(
    blocking: EmailQuestion[],
    nonBlocking: EmailQuestion[],
  ): string {
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4a90d9; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📬 Vibe Question Digest</h2>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
    `;

    if (blocking.length > 0) {
      html += `
        <div style="background: #fff3cd; border-left: 4px solid #dc3545; padding: 15px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #dc3545;">⚠️ Blocking Questions (${blocking.length})</h3>
          <p style="margin: 0; color: #666;">These are preventing agents from continuing.</p>
        </div>
      `;
      for (const q of blocking) {
        html += this.buildQuestionCard(q);
      }
    }

    if (nonBlocking.length > 0) {
      html += `<h3 style="margin: 20px 0 10px 0;">📋 Other Questions (${nonBlocking.length})</h3>`;
      for (const q of nonBlocking) {
        html += this.buildQuestionCard(q);
      }
    }

    html += `
          <div style="text-align: center; margin-top: 20px;">
            <a href="${this.baseUrl}/questions" style="display: inline-block; background: #4a90d9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">View All Questions</a>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Build a single question card for digest.
   */
  private buildQuestionCard(question: EmailQuestion): string {
    return `
      <div style="background: white; border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin: 10px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold;">${question.agentType}</span>
          <span style="background: ${this.getPriorityColor(question.priority)}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">
            ${PRIORITY_LABELS[question.priority] || "Normal"}
          </span>
        </div>
        <p style="margin: 10px 0;">${question.content.substring(0, 150)}${question.content.length > 150 ? "..." : ""}</p>
        <a href="${this.baseUrl}/questions/${question.id}" style="color: #4a90d9; text-decoration: none; font-size: 14px;">View & Respond →</a>
      </div>
    `;
  }

  /**
   * Get color for priority level.
   */
  private getPriorityColor(priority: number): string {
    switch (priority) {
      case 5:
        return "#dc3545"; // Critical - red
      case 4:
        return "#fd7e14"; // Urgent - orange
      case 3:
        return "#ffc107"; // High - yellow
      case 2:
        return "#4a90d9"; // Normal - blue
      default:
        return "#6c757d"; // Low - gray
    }
  }

  /**
   * Get color for severity.
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case "critical":
        return "#dc3545";
      case "error":
        return "#dc3545";
      case "warning":
        return "#fd7e14";
      default:
        return "#17a2b8";
    }
  }

  /**
   * Send an email.
   */
  private async send(
    subject: string,
    text: string,
    html: string,
  ): Promise<EmailSendResult> {
    try {
      const result = await this.transport.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromAddress}>`,
        to: this.config.toAddress,
        subject,
        text,
        html,
      });

      console.log(`[EmailSender] Sent email: ${subject} (${result.messageId})`);

      return { success: true, messageId: result.messageId };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[EmailSender] Failed to send: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
}
