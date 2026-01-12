// server/communication/message-templates.ts
// COM-013: Message Templates - Reusable message formats

import { AgentType } from './types';
import { QuestionType } from './question-delivery';

export type TemplateCategory =
  | 'greeting'
  | 'question'
  | 'notification'
  | 'status'
  | 'error'
  | 'approval'
  | 'summary'
  | 'help';

export interface TemplateContext {
  agentId?: string;
  agentType?: AgentType;
  userName?: string;
  ideaName?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface MessageTemplate {
  id: string;
  category: TemplateCategory;
  name: string;
  telegramText: string;
  telegramParseMode: 'Markdown' | 'HTML';
  emailSubject?: string;
  emailText?: string;
  emailHtml?: string;
  variables: string[];
}

// Template variable interpolation
function interpolate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = context[key];
    if (value === undefined || value === null) {
      return match; // Keep placeholder if no value
    }
    return String(value);
  });
}

// Escape markdown special characters
function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
}

// Pre-defined templates
const TEMPLATES: Record<string, MessageTemplate> = {
  // Greetings
  'greeting.welcome': {
    id: 'greeting.welcome',
    category: 'greeting',
    name: 'Welcome Message',
    telegramText: '👋 Welcome to the Vibe {{agentType}} Bot!\n\n' +
      "I'm here to help with {{agentType}} tasks for your ideas.\n\n" +
      '*Quick Commands:*\n' +
      '/start - Start session\n' +
      '/status - Check current status\n' +
      '/summary - Get session summary\n' +
      '/help - Show available commands\n\n' +
      "Let's build something great together! 🚀",
    telegramParseMode: 'Markdown',
    emailSubject: 'Welcome to Vibe {{agentType}}',
    emailText: 'Welcome to the Vibe {{agentType}} system. Use this channel to receive updates and answer questions from the {{agentType}} agent.',
    variables: ['agentType'],
  },

  'greeting.linked': {
    id: 'greeting.linked',
    category: 'greeting',
    name: 'Account Linked',
    telegramText: '✅ *Account Linked Successfully!*\n\n' +
      "You'll now receive {{agentType}} notifications here.\n\n" +
      'To link other agent bots, message each one with /start.',
    telegramParseMode: 'Markdown',
    variables: ['agentType'],
  },

  // Status messages
  'status.agent_started': {
    id: 'status.agent_started',
    category: 'status',
    name: 'Agent Started',
    telegramText: '🟢 *{{agentType}} Agent Started*\n\n' +
      'Session: {{sessionId}}\n' +
      '{{ideaName}}',
    telegramParseMode: 'Markdown',
    variables: ['agentType', 'sessionId', 'ideaName'],
  },

  'status.agent_blocked': {
    id: 'status.agent_blocked',
    category: 'status',
    name: 'Agent Blocked',
    telegramText: '🔴 *{{agentType}} Agent Blocked*\n\n' +
      'Waiting for your input on {{pendingCount}} question(s).\n\n' +
      'Please respond to continue processing.',
    telegramParseMode: 'Markdown',
    variables: ['agentType', 'pendingCount'],
  },

  'status.agent_completed': {
    id: 'status.agent_completed',
    category: 'status',
    name: 'Agent Completed',
    telegramText: '✅ *{{agentType}} Agent Completed*\n\n' +
      '{{summary}}\n\n' +
      'Duration: {{duration}}\n' +
      'Questions answered: {{questionsAnswered}}',
    telegramParseMode: 'Markdown',
    emailSubject: '[Vibe] {{agentType}} completed for {{ideaName}}',
    emailText: 'The {{agentType}} agent has completed processing.\n\n{{summary}}\n\nDuration: {{duration}}\nQuestions answered: {{questionsAnswered}}',
    variables: ['agentType', 'summary', 'duration', 'questionsAnswered', 'ideaName'],
  },

  // Questions
  'question.blocking': {
    id: 'question.blocking',
    category: 'question',
    name: 'Blocking Question',
    telegramText: '🔴 *Blocking Question*\n\n' +
      '{{content}}\n\n' +
      '_Agent {{agentId}} is waiting for your response._',
    telegramParseMode: 'Markdown',
    variables: ['content', 'agentId'],
  },

  'question.clarifying': {
    id: 'question.clarifying',
    category: 'question',
    name: 'Clarifying Question',
    telegramText: '❓ *Clarifying Question*\n\n{{content}}',
    telegramParseMode: 'Markdown',
    variables: ['content'],
  },

  'question.approval': {
    id: 'question.approval',
    category: 'approval',
    name: 'Approval Request',
    telegramText: '🚨 *Approval Required*\n\n' +
      '*{{title}}*\n\n' +
      '{{description}}\n\n' +
      '{{#details}}_Details:_ {{details}}{{/details}}',
    telegramParseMode: 'Markdown',
    emailSubject: '[Vibe APPROVAL] {{title}}',
    emailHtml: '<div style="font-family: Arial, sans-serif;">' +
      '<h2 style="color: #dc3545;">🚨 Approval Required</h2>' +
      '<h3>{{title}}</h3>' +
      '<p>{{description}}</p>' +
      '{{#details}}<pre style="background: #f8f9fa; padding: 10px;">{{details}}</pre>{{/details}}' +
      '</div>',
    variables: ['title', 'description', 'details'],
  },

  // Notifications
  'notification.info': {
    id: 'notification.info',
    category: 'notification',
    name: 'Info Notification',
    telegramText: 'ℹ️ *{{title}}*\n\n{{message}}',
    telegramParseMode: 'Markdown',
    variables: ['title', 'message'],
  },

  'notification.warning': {
    id: 'notification.warning',
    category: 'notification',
    name: 'Warning Notification',
    telegramText: '⚠️ *{{title}}*\n\n{{message}}',
    telegramParseMode: 'Markdown',
    variables: ['title', 'message'],
  },

  'notification.error': {
    id: 'notification.error',
    category: 'notification',
    name: 'Error Notification',
    telegramText: '❌ *{{title}}*\n\n' +
      '{{message}}\n\n' +
      '_Error code: {{errorCode}}_',
    telegramParseMode: 'Markdown',
    emailSubject: '[Vibe ERROR] {{title}}',
    emailText: '{{title}}\n\n{{message}}\n\nError code: {{errorCode}}',
    variables: ['title', 'message', 'errorCode'],
  },

  'notification.critical': {
    id: 'notification.critical',
    category: 'notification',
    name: 'Critical Notification',
    telegramText: '🚨🚨🚨 *CRITICAL: {{title}}*\n\n' +
      '{{message}}\n\n' +
      '*Immediate attention required!*',
    telegramParseMode: 'Markdown',
    emailSubject: '[Vibe CRITICAL] {{title}}',
    variables: ['title', 'message'],
  },

  // Errors
  'error.generic': {
    id: 'error.generic',
    category: 'error',
    name: 'Generic Error',
    telegramText: '❌ *Error Occurred*\n\n' +
      '{{message}}\n\n' +
      'Please try again or contact support.',
    telegramParseMode: 'Markdown',
    variables: ['message'],
  },

  'error.timeout': {
    id: 'error.timeout',
    category: 'error',
    name: 'Timeout Error',
    telegramText: '⏱️ *Operation Timed Out*\n\n' +
      '{{operation}} took too long and was cancelled.\n\n' +
      '{{#suggestion}}_Suggestion: {{suggestion}}_{{/suggestion}}',
    telegramParseMode: 'Markdown',
    variables: ['operation', 'suggestion'],
  },

  // Summary
  'summary.session': {
    id: 'summary.session',
    category: 'summary',
    name: 'Session Summary',
    telegramText: '📊 *Session Summary*\n\n' +
      '*Idea:* {{ideaName}}\n' +
      '*Duration:* {{duration}}\n' +
      '*Status:* {{status}}\n\n' +
      '*Activity:*\n' +
      '• Questions asked: {{questionsAsked}}\n' +
      '• Answers received: {{answersReceived}}\n' +
      '• Artifacts created: {{artifactsCreated}}\n\n' +
      '{{#nextSteps}}*Next Steps:*\n{{nextSteps}}{{/nextSteps}}',
    telegramParseMode: 'Markdown',
    emailSubject: '[Vibe] Session Summary - {{ideaName}}',
    variables: ['ideaName', 'duration', 'status', 'questionsAsked', 'answersReceived', 'artifactsCreated', 'nextSteps'],
  },

  // Help
  'help.commands': {
    id: 'help.commands',
    category: 'help',
    name: 'Help Commands',
    telegramText: '📚 *Available Commands*\n\n' +
      '/start - Start or reset session\n' +
      '/status - Check current status\n' +
      '/summary - Get session summary\n' +
      '/link - Re-link account\n' +
      '/help - Show this message\n\n' +
      '*Tips:*\n' +
      '• Respond to questions using the buttons\n' +
      '• Type a message for free-form answers\n' +
      '• Use /status to check pending questions',
    telegramParseMode: 'Markdown',
    variables: [],
  },
};

export class MessageTemplates {
  private customTemplates: Map<string, MessageTemplate> = new Map();

  /**
   * Get a template by ID.
   */
  getTemplate(templateId: string): MessageTemplate | null {
    return this.customTemplates.get(templateId) || TEMPLATES[templateId] || null;
  }

  /**
   * Render a template with context.
   */
  render(templateId: string, context: TemplateContext): { telegram: string; email?: { subject: string; text: string; html?: string } } | null {
    const template = this.getTemplate(templateId);

    if (!template) {
      console.warn(`[MessageTemplates] Template not found: ${templateId}`);
      return null;
    }

    // Handle conditional blocks {{#var}}...{{/var}}
    let telegramText = this.processConditionals(template.telegramText, context);
    telegramText = interpolate(telegramText, context);

    const result: { telegram: string; email?: { subject: string; text: string; html?: string } } = {
      telegram: telegramText,
    };

    if (template.emailSubject) {
      let emailText = template.emailText || '';
      emailText = this.processConditionals(emailText, context);
      emailText = interpolate(emailText, context);

      let emailHtml = template.emailHtml || '';
      emailHtml = this.processConditionals(emailHtml, context);
      emailHtml = interpolate(emailHtml, context);

      result.email = {
        subject: interpolate(template.emailSubject, context),
        text: emailText,
        html: emailHtml || undefined,
      };
    }

    return result;
  }

  /**
   * Render a template for Telegram only.
   */
  renderTelegram(templateId: string, context: TemplateContext): string | null {
    const result = this.render(templateId, context);
    return result?.telegram || null;
  }

  /**
   * Register a custom template.
   */
  registerTemplate(template: MessageTemplate): void {
    this.customTemplates.set(template.id, template);
  }

  /**
   * List all available templates.
   */
  listTemplates(): MessageTemplate[] {
    const all = new Map<string, MessageTemplate>();

    // Add built-in templates
    for (const [id, template] of Object.entries(TEMPLATES)) {
      all.set(id, template);
    }

    // Override with custom templates
    for (const [id, template] of this.customTemplates) {
      all.set(id, template);
    }

    return Array.from(all.values());
  }

  /**
   * Get templates by category.
   */
  getTemplatesByCategory(category: TemplateCategory): MessageTemplate[] {
    return this.listTemplates().filter(t => t.category === category);
  }

  /**
   * Process conditional blocks in template.
   */
  private processConditionals(template: string, context: TemplateContext): string {
    // Match {{#var}}...{{/var}} blocks
    return template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) => {
      const value = context[key];
      if (value === undefined || value === null || value === '' || value === false) {
        return ''; // Remove block if value is falsy
      }
      return content;
    });
  }

  /**
   * Create a quick message without a template.
   */
  static formatQuickMessage(
    type: 'info' | 'warning' | 'error' | 'success',
    title: string,
    message: string
  ): string {
    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅',
    }[type];

    return `${emoji} *${escapeMarkdown(title)}*\n\n${message}`;
  }

  /**
   * Format a question for Telegram.
   */
  static formatQuestion(
    type: QuestionType,
    content: string,
    options: { label: string; description?: string }[]
  ): string {
    const emoji: Record<QuestionType, string> = {
      ALERT: 'ℹ️',
      CLARIFYING: '❓',
      CONFIRMING: '✅',
      PREFERENCE: '🎯',
      BLOCKING: '🔴',
      DECISION: '🤔',
      ESCALATION: '⚠️',
      APPROVAL: '🚨',
    };

    const label: Record<QuestionType, string> = {
      ALERT: 'Alert',
      CLARIFYING: 'Clarifying Question',
      CONFIRMING: 'Confirmation Needed',
      PREFERENCE: 'Your Preference?',
      BLOCKING: 'Blocking Question',
      DECISION: 'Decision Required',
      ESCALATION: 'Escalation',
      APPROVAL: 'Approval Required',
    };

    let text = `${emoji[type]} *${label[type]}*\n\n${content}`;

    if (options.length > 0) {
      text += '\n\n*Options:*';
      for (const opt of options) {
        text += `\n• ${opt.label}`;
        if (opt.description) {
          text += ` - _${opt.description}_`;
        }
      }
    }

    return text;
  }
}
