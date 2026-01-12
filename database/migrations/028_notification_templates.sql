-- Migration 028: Notification Templates
-- Created: 2026-01-10
-- Purpose: Seed default notification templates

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY,
    type TEXT UNIQUE NOT NULL,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    email_subject TEXT,
    email_body TEXT,
    telegram_text TEXT,
    default_channels TEXT DEFAULT '["in_app"]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed default templates
INSERT OR IGNORE INTO notification_templates (id, type, title_template, body_template, email_subject, email_body, telegram_text, default_channels) VALUES
(
    'tmpl-agent-question',
    'agent_question',
    'Agent needs your input',
    '{{agentName}} has a question: {{question}}',
    '[Vibe] Agent Question',
    '<p>{{agentName}} is waiting for your input.</p><p><strong>Question:</strong> {{question}}</p>',
    '🤖 *{{agentName}}* needs your input:\n{{question}}',
    '["in_app", "email", "telegram"]'
),
(
    'tmpl-agent-completed',
    'agent_completed',
    'Agent completed task',
    '{{agentName}} finished: {{taskName}}',
    '[Vibe] Task Completed',
    '<p>{{agentName}} has completed the task: <strong>{{taskName}}</strong>.</p>',
    '✅ *{{agentName}}* completed: {{taskName}}',
    '["in_app"]'
),
(
    'tmpl-agent-error',
    'agent_error',
    'Agent encountered an error',
    '{{agentName}} failed: {{error}}',
    '[Vibe] Agent Error',
    '<p>{{agentName}} encountered an error:</p><pre>{{error}}</pre>',
    '❌ *{{agentName}}* error:\n{{error}}',
    '["in_app", "email"]'
),
(
    'tmpl-session-update',
    'session_update',
    'Session Update',
    '{{sessionName}}: {{update}}',
    '[Vibe] Session Update',
    '<p><strong>{{sessionName}}</strong></p><p>{{update}}</p>',
    '📝 *{{sessionName}}*: {{update}}',
    '["in_app"]'
),
(
    'tmpl-system-alert',
    'system_alert',
    'System Alert',
    '{{message}}',
    '[Vibe] System Alert',
    '<p>{{message}}</p>',
    '⚠️ {{message}}',
    '["in_app", "email"]'
),
(
    'tmpl-build-started',
    'build_started',
    'Build Started',
    'Build {{buildId}} has started for {{specName}}',
    '[Vibe] Build Started',
    '<p>A new build has started for <strong>{{specName}}</strong>.</p>',
    '🏗️ Build started: {{specName}}',
    '["in_app"]'
),
(
    'tmpl-build-completed',
    'build_completed',
    'Build Completed',
    'Build {{buildId}} completed successfully',
    '[Vibe] Build Completed',
    '<p>Build for <strong>{{specName}}</strong> has completed successfully.</p><p>Tasks: {{tasksCompleted}}/{{tasksTotal}}</p>',
    '✅ Build completed: {{specName}} ({{tasksCompleted}}/{{tasksTotal}} tasks)',
    '["in_app", "email"]'
),
(
    'tmpl-build-failed',
    'build_failed',
    'Build Failed',
    'Build {{buildId}} failed: {{error}}',
    '[Vibe] Build Failed',
    '<p>Build for <strong>{{specName}}</strong> has failed.</p><p>Error: {{error}}</p>',
    '❌ Build failed: {{specName}}\n{{error}}',
    '["in_app", "email"]'
),
(
    'tmpl-evaluation-complete',
    'evaluation_complete',
    'Evaluation Complete',
    'Evaluation for {{ideaName}} is ready',
    '[Vibe] Evaluation Complete',
    '<p>The evaluation for <strong>{{ideaName}}</strong> is ready for review.</p><p>Overall score: {{overallScore}}/10</p>',
    '📊 Evaluation complete: {{ideaName}} ({{overallScore}}/10)',
    '["in_app", "email"]'
),
(
    'tmpl-idea-update',
    'idea_update',
    'Idea Updated',
    '{{ideaName}} has been updated',
    '[Vibe] Idea Updated',
    '<p>The idea <strong>{{ideaName}}</strong> has been updated.</p><p>{{description}}</p>',
    '💡 Idea updated: {{ideaName}}',
    '["in_app"]'
);
