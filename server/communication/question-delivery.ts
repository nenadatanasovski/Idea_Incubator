// server/communication/question-delivery.ts
// COM-006: Question Delivery with Inline Buttons

import { TelegramSender } from './telegram-sender';
import { AgentType, InlineButton } from './types';

export type QuestionType =
  | 'BLOCKING'
  | 'CLARIFYING'
  | 'CONFIRMING'
  | 'PREFERENCE'
  | 'ALERT'
  | 'ESCALATION'
  | 'APPROVAL'
  | 'DECISION';

type MessageFormat = 'concise' | 'standard' | 'detailed' | 'urgent';

export interface QuestionOption {
  label: string;
  action: string;
  description?: string;
}

export interface Question {
  id: string;
  agentId: string;
  type: QuestionType;
  content: string;
  context?: Record<string, unknown>;
  options: QuestionOption[];
  defaultOption?: string;
  priority: number;
  blocking: boolean;
  // App/project context - critical for multi-project scenarios
  projectName?: string;      // e.g., "Vibe Platform", "My App"
  projectSlug?: string;      // e.g., "vibe-platform", "my-app"
  taskId?: string;           // e.g., "EXE-001"
  taskListName?: string;     // e.g., "SPEC-IMPLEMENTATION-GAPS.md"
}

export interface DeliveryResult {
  success: boolean;
  messageId?: number;
  channel: 'telegram' | 'email';
  deliveredAt: Date;
  error?: string;
}

const FORMAT_CONFIG: Record<QuestionType, MessageFormat> = {
  ALERT: 'concise',
  CLARIFYING: 'concise',
  CONFIRMING: 'standard',
  PREFERENCE: 'standard',
  BLOCKING: 'standard',
  DECISION: 'detailed',
  ESCALATION: 'detailed',
  APPROVAL: 'detailed',
};

const TYPE_EMOJI: Record<QuestionType, string> = {
  ALERT: 'ℹ️',
  CLARIFYING: '❓',
  CONFIRMING: '✅',
  PREFERENCE: '🎯',
  BLOCKING: '🔴',
  DECISION: '🤔',
  ESCALATION: '⚠️',
  APPROVAL: '🚨',
};

export class QuestionDelivery {
  private sender: TelegramSender;
  private deliveryLog: Map<string, DeliveryResult> = new Map();

  constructor(sender: TelegramSender) {
    this.sender = sender;
  }

  /**
   * Deliver a question via Telegram.
   */
  async deliverQuestion(question: Question): Promise<DeliveryResult> {
    const agentType = this.extractAgentType(question.agentId);
    const format = FORMAT_CONFIG[question.type];
    const message = this.formatMessage(question, format);
    const buttons = this.generateButtons(question);

    let result: DeliveryResult;

    if (question.type === 'ALERT') {
      // Alerts don't need buttons
      const sendResult = await this.sender.sendMessage({
        agentType,
        text: message,
        parseMode: 'Markdown',
      });

      result = {
        success: sendResult.success,
        messageId: sendResult.messageId,
        channel: 'telegram',
        deliveredAt: new Date(),
        error: sendResult.error,
      };
    } else {
      const sendResult = await this.sender.sendWithButtons(agentType, message, buttons);

      result = {
        success: sendResult.success,
        messageId: sendResult.messageId,
        channel: 'telegram',
        deliveredAt: new Date(),
        error: sendResult.error,
      };
    }

    this.deliveryLog.set(question.id, result);
    return result;
  }

  /**
   * Get delivery status for a question.
   */
  getDeliveryStatus(questionId: string): DeliveryResult | null {
    return this.deliveryLog.get(questionId) || null;
  }

  /**
   * Format message based on question type and format.
   */
  private formatMessage(question: Question, format: MessageFormat): string {
    const emoji = TYPE_EMOJI[question.type];
    const typeLabel = this.getTypeLabel(question.type);

    switch (format) {
      case 'concise':
        return this.formatConcise(question, emoji, typeLabel);
      case 'standard':
        return this.formatStandard(question, emoji, typeLabel);
      case 'detailed':
        return this.formatDetailed(question, emoji, typeLabel);
      case 'urgent':
        return this.formatUrgent(question, emoji, typeLabel);
      default:
        return this.formatStandard(question, emoji, typeLabel);
    }
  }

  /**
   * Escape special characters for Telegram Markdown
   * For basic Markdown mode, only _ and * need escaping
   */
  private escapeMarkdown(text: string): string {
    // Only escape underscores and asterisks for basic Telegram Markdown
    return text.replace(/[_*]/g, '\\$&');
  }

  /**
   * Build project header for messages
   */
  private buildProjectHeader(q: Question): string {
    const parts: string[] = [];

    if (q.projectName) {
      // Escape special chars in project name before wrapping in bold
      const safeName = this.escapeMarkdown(q.projectName);
      parts.push(`📦 *${safeName}*`);
    }
    if (q.taskId) {
      // taskId in backticks is safe
      parts.push(`🎯 Task: \`${q.taskId}\``);
    }
    if (q.taskListName) {
      const shortName = q.taskListName.split('/').pop() || q.taskListName;
      // Escape special chars in task list name
      const safeName = this.escapeMarkdown(shortName);
      parts.push(`📋 ${safeName}`);
    }

    if (parts.length > 0) {
      return parts.join(' | ') + '\n\n';
    }
    return '';
  }

  private formatConcise(q: Question, emoji: string, typeLabel: string): string {
    const header = this.buildProjectHeader(q);
    return `${header}${emoji} *${typeLabel}*\n\n${q.content}`;
  }

  private formatStandard(q: Question, emoji: string, typeLabel: string): string {
    const header = this.buildProjectHeader(q);
    let msg = `${header}${emoji} *${typeLabel}*\n\n${q.content}`;

    if (q.options.length > 0) {
      msg += '\n\n*Options:*';
      for (const opt of q.options) {
        msg += `\n• ${opt.label}`;
        if (opt.description) {
          msg += ` - _${opt.description}_`;
        }
      }
    }

    if (q.blocking) {
      msg += `\n\n_Agent blocked: \`${q.agentId}\`_`;
    }

    return msg;
  }

  private formatDetailed(q: Question, emoji: string, typeLabel: string): string {
    const header = this.buildProjectHeader(q);
    let msg = `${header}${emoji} *${typeLabel}*\n\n${q.content}`;

    if (q.options.length > 0) {
      msg += '\n\n*Options:*';
      for (const opt of q.options) {
        msg += `\n\n*${opt.label}*`;
        if (opt.description) {
          msg += `\n${opt.description}`;
        }
      }
    }

    if (q.context) {
      msg += '\n\n*Context:*';
      const ctx = q.context as Record<string, unknown>;
      if (ctx.rationale) {
        msg += `\n_${ctx.rationale}_`;
      }
      if (ctx.evidence) {
        const evidenceStr = JSON.stringify(ctx.evidence, null, 2).slice(0, 500);
        msg += `\n\`\`\`\n${evidenceStr}\n\`\`\``;
      }
    }

    if (q.blocking) {
      msg += `\n\n⏸️ _Agent blocked: \`${q.agentId}\`_`;
    }

    if (q.defaultOption) {
      msg += `\n\n💡 _Default (on timeout): ${q.defaultOption}_`;
    }

    return msg;
  }

  private formatUrgent(q: Question, emoji: string, typeLabel: string): string {
    return `🚨🚨🚨\n\n${this.formatDetailed(q, emoji, typeLabel)}\n\n🚨🚨🚨`;
  }

  /**
   * Generate inline keyboard buttons for the question.
   */
  private generateButtons(question: Question): InlineButton[][] {
    if (question.type === 'ALERT') {
      return []; // No buttons for alerts
    }

    const buttons: InlineButton[][] = [];

    // Main options (2 per row for readability)
    for (let i = 0; i < question.options.length; i += 2) {
      const row: InlineButton[] = [];
      row.push({
        text: question.options[i].label,
        callbackData: `answer:${question.id}:${question.options[i].action}`,
      });

      if (question.options[i + 1]) {
        row.push({
          text: question.options[i + 1].label,
          callbackData: `answer:${question.id}:${question.options[i + 1].action}`,
        });
      }

      buttons.push(row);
    }

    // Add "Other" option for free-text responses
    buttons.push([{
      text: '💬 Other (type reply)',
      callbackData: `answer:${question.id}:__other__`,
    }]);

    return buttons;
  }

  /**
   * Get human-readable label for question type.
   */
  private getTypeLabel(type: QuestionType): string {
    const labels: Record<QuestionType, string> = {
      ALERT: 'Alert',
      CLARIFYING: 'Clarifying Question',
      CONFIRMING: 'Confirmation Needed',
      PREFERENCE: 'Your Preference?',
      BLOCKING: 'Blocking Question',
      DECISION: 'Decision Required',
      ESCALATION: 'Escalation',
      APPROVAL: 'Approval Required',
    };
    return labels[type];
  }

  /**
   * Extract agent type from agent ID.
   */
  private extractAgentType(agentId: string): AgentType {
    const id = agentId.toLowerCase();
    if (id.includes('monitor')) return 'monitoring';
    if (id.includes('orchestrat')) return 'orchestrator';
    if (id.includes('spec')) return 'spec';
    if (id.includes('build')) return 'build';
    if (id.includes('valid')) return 'validation';
    if (id.includes('sia')) return 'sia';
    return 'system';
  }
}
